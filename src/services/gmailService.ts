import { DetectedEmailMessage, SyncExecutionReport } from '../types/pricing';
import { generateEmailHTMLSummary } from './diffService';

interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: { name: string; value: string }[];
  body: {
    attachmentId?: string;
    size: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: GmailMessagePart[];
    body?: {
      attachmentId?: string;
      size: number;
      data?: string;
    };
  };
  internalDate: string;
}

// Find all attachment parts recursively
function findAttachments(parts?: GmailMessagePart[]): { id: string; filename: string; mimeType: string; size: number }[] {
  if (!parts) return [];
  const results: { id: string; filename: string; mimeType: string; size: number }[] = [];

  for (const part of parts) {
    if (part.filename && part.body?.attachmentId) {
      results.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
      });
    }
    if (part.parts) {
      results.push(...findAttachments(part.parts));
    }
  }

  return results;
}

/**
 * Searches Gmail for emails with subject "LISTA DE PRECIOS"
 */
export const searchPriceListEmails = async (accessToken: string): Promise<DetectedEmailMessage[]> => {
  const query = 'subject:"LISTA DE PRECIOS"';
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
    query
  )}&maxResults=15`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (netErr: any) {
    console.warn('Network error reaching Gmail API:', netErr);
    return [];
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn(`Gmail API returned status ${res.status}: ${errText}`);
    return [];
  }

  let listData: any = {};
  try {
    listData = await res.json();
  } catch (e) {
    return [];
  }

  const messageRefs: { id: string; threadId: string }[] = listData.messages || [];

  if (messageRefs.length === 0) {
    // If exact subject quotes returned 0, try without quotes to be resilient
    try {
      const fallbackRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=LISTA+DE+PRECIOS&maxResults=10`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackData.messages) {
          messageRefs.push(...fallbackData.messages);
        }
      }
    } catch (e) {
      console.warn('Fallback search fetch failed:', e);
    }
  }

  const uniqueRefs = Array.from(new Map(messageRefs.map((m) => [m.id, m])).values());
  const detectedEmails: DetectedEmailMessage[] = [];

  // Fetch details for each message
  for (const ref of uniqueRefs.slice(0, 10)) {
    try {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!detailRes.ok) continue;

      const detail: GmailMessageDetail = await detailRes.json();
      if (!detail?.payload) continue;
      const headers = detail.payload.headers || [];

      const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || 'Sin asunto';
      const sender = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Desconocido';
      const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value;
      
      let date = new Date().toISOString();
      try {
        if (dateHeader && !isNaN(new Date(dateHeader).getTime())) {
          date = new Date(dateHeader).toISOString();
        } else if (detail.internalDate && !isNaN(Number(detail.internalDate))) {
          date = new Date(Number(detail.internalDate)).toISOString();
        }
      } catch (e) {
        date = new Date().toISOString();
      }

      const attachments = findAttachments(detail.payload.parts || []);

      // Filter attachments: must contain "LISTA DE PRECIOS" in filename or be excel
      const validAttachments = attachments.filter((att) => {
        const lowerName = att.filename.toLowerCase();
        return (
          lowerName.endsWith('.xlsx') ||
          lowerName.endsWith('.xls') ||
          lowerName.includes('lista de precios') ||
          lowerName.includes('precios')
        );
      });

      detectedEmails.push({
        id: detail.id,
        threadId: detail.threadId,
        subject,
        sender,
        date,
        snippet: detail.snippet || '',
        attachments: validAttachments,
        processed: false,
      });
    } catch (err) {
      console.error(`Error procesando mensaje ${ref.id}:`, err);
    }
  }

  return detectedEmails;
};

/**
 * Downloads attachment binary from Gmail
 */
export const downloadGmailAttachment = async (
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Uint8Array> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err: any) {
    throw new Error(`Error de conexión al descargar archivo adjunto: ${err?.message || 'Fallo de red'}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Error descargando archivo adjunto (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawBase64 = json.data;
  if (!rawBase64) {
    throw new Error('El archivo adjunto no contiene datos legibles.');
  }

  // Gmail uses URL-safe base64: replace '-' with '+' and '_' with '/'
  const base64Standard = rawBase64.replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(base64Standard);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
};

/**
 * Helper to encode text to UTF-8 base64url safely without unescape()
 */
function utf8ToBase64Url(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

/**
 * Sends summary report email via backend proxy (eliminates browser CORS) with direct fallback
 */
export const sendSyncSummaryEmail = async (
  accessToken: string,
  toEmail: string,
  report: SyncExecutionReport
): Promise<{ success: boolean; messageId?: string }> => {
  const subject = `Resumen de Cambios: Lista de Precios AT&T Premium (${report.newRecordsCount} nuevos, ${report.priceDropsCount} reducciones)`;
  const htmlBody = generateEmailHTMLSummary(report);

  // 1. Prefer server-side proxy route: avoids browser CORS limitations
  try {
    const proxyRes = await fetch('/api/gmail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toEmail,
        subject,
        htmlBody,
      }),
    });

    if (proxyRes.ok) {
      const result = await proxyRes.json().catch(() => ({ id: 'ok' }));
      return { success: true, messageId: result.id };
    } else {
      const errData = await proxyRes.json().catch(() => ({}));
      console.warn('Proxy route returned error:', errData);
    }
  } catch (proxyErr) {
    console.warn('Proxy route /api/gmail/send unavailable, trying direct API:', proxyErr);
  }

  // 2. Direct Google API call as fallback
  try {
    const emailLines = [
      `To: ${toEmail}`,
      `Subject: =?utf-8?B?${utf8ToBase64Url(subject)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlBody,
    ];

    const rawEmail = emailLines.join('\r\n');
    const encodedRaw = utf8ToBase64Url(rawEmail);

    const directRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedRaw }),
    });

    if (directRes.ok) {
      const result = await directRes.json().catch(() => ({ id: 'ok' }));
      return { success: true, messageId: result.id };
    }

    const errText = await directRes.text().catch(() => '');
    throw new Error(`Gmail API (${directRes.status}): ${errText}`);
  } catch (directErr: any) {
    throw new Error(`Error de conexión al enviar correo: ${directErr?.message || 'Fallo de red'}`);
  }
};
