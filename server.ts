import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent database file on server
const DB_FILE = path.resolve(__dirname, 'server-data.json');

const MASTER_EMAIL = 'usertotix98@gmail.com';

interface ServerState {
  masterEmail: string;
  isMasterConnected: boolean;
  lastSyncAt: string | null;
  records: any[];
  plans: any[];
  latestReport: any | null;
  reports: any[];
  spreadsheetId: string;
  spreadsheetUrl: string;
}

// In-memory master token (never exposed to clients)
let masterAccessToken: string | null = null;

// Initial state
let serverState: ServerState = {
  masterEmail: 'UserTotix98@gmail.com',
  isMasterConnected: false,
  lastSyncAt: null,
  records: [],
  plans: [],
  latestReport: null,
  reports: [],
  spreadsheetId: '',
  spreadsheetUrl: '',
};

function deduplicateRecords(records: any[]): any[] {
  if (!Array.isArray(records)) return [];
  const map = new Map<string, any>();
  for (const r of records) {
    if (!r || !r.model) continue;
    const planUpper = (r.planNombre || '').trim().toUpperCase();
    if (!planUpper || planUpper === 'VIGENCIA' || planUpper === 'FECHA' || planUpper === 'TOTAL') continue;
    const rPromo = Number(r.precioPromocion || 0);
    if (rPromo <= 0 || rPromo > 100000) continue;
    const rCost = Number(r.costoPlan || 0);
    if (rCost <= 0) continue;

    const cleanBrand = (r.brand || '').trim().toLowerCase();
    const cleanModel = (r.model || '').trim().toLowerCase();
    const cleanStorage = (r.storage || '').trim().toLowerCase();
    const cleanPlan = (r.planNombre || '').trim().toLowerCase();
    const plazo = Number(r.plazo || 36);

    const baseKey = `${cleanBrand}-${cleanModel}${cleanStorage ? `-${cleanStorage}` : ''}-${cleanPlan}-${plazo}`
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_()]/g, '');

    // Compute golden rule fields
    const rContado = Number(r.precioContado || 0) > 0 ? Number(r.precioContado) : Math.round(rPromo * 1.25);
    const umbral30 = Math.round(rContado * 0.30 * 100) / 100;
    const esMenor30 = rPromo < umbral30;
    const tipoPagoInicial = esMenor30 ? 'rentas_adelantadas' : 'enganche';
    const numRentas = esMenor30 ? 3 : 0;
    const montoRentas = esMenor30 ? Math.round(3 * rCost * 100) / 100 : 0;
    const engMin = Math.round(rPromo * 0.10 * 100) / 100;
    const pagoInicialMin = esMenor30 ? montoRentas : engMin;

    const enrichedRecord = {
      ...r,
      precioContado: rContado,
      esMenor30Contado: esMenor30,
      tipoPagoInicial,
      numRentasAdelantadas: numRentas,
      montoRentasAdelantadas: montoRentas,
      pagoInicialMinimo: pagoInicialMin,
      id: baseKey,
    };

    if (!map.has(baseKey)) {
      map.set(baseKey, enrichedRecord);
    } else {
      const existing = map.get(baseKey);
      const exPromo = Number(existing.precioPromocion || 0);
      if (rPromo > 0 && (exPromo <= 0 || rPromo < exPromo)) {
        map.set(baseKey, enrichedRecord);
      }
    }
  }

  const result: any[] = [];
  const seenIds = new Set<string>();
  for (const item of map.values()) {
    let finalId = item.id;
    let counter = 1;
    while (seenIds.has(finalId)) {
      finalId = `${item.id}-v${counter++}`;
    }
    seenIds.add(finalId);
    result.push({ ...item, id: finalId });
  }
  return result;
}

// Load persistent state from disk if exists
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    serverState = {
      ...serverState,
      ...parsed,
      masterEmail: parsed.masterEmail || serverState.masterEmail || 'UserTotix98@gmail.com',
    };
    if (Array.isArray(serverState.records) && serverState.records.length > 0) {
      serverState.records = deduplicateRecords(serverState.records);
    }
    console.log(`[Server] Loaded ${serverState.records.length} records and ${serverState.plans.length} plans from disk. Buzón Maestro: ${serverState.masterEmail}`);
  }
} catch (e) {
  console.warn('[Server] Could not read server-data.json:', e);
}

function saveStateToDisk() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(serverState, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Server] Could not write server-data.json:', e);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '30mb' }));

  // ==========================================
  // PUBLIC ENDPOINTS: Accessible by ANY VISITOR
  // No login required, zero exposure of tokens
  // ==========================================

  // 1. Get current synchronized database & plans (Ultra fast response)
  app.get('/api/sync/state', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({
      masterEmail: serverState.masterEmail,
      isMasterConnected: !!masterAccessToken || serverState.records.length > 0,
      lastSyncAt: serverState.lastSyncAt,
      recordsCount: serverState.records.length,
      records: serverState.records,
      plans: serverState.plans,
      latestReport: serverState.latestReport,
      reports: serverState.reports.slice(0, 20), // Send last 20 reports
      spreadsheetUrl: serverState.spreadsheetUrl,
    });
  });

  // ==========================================
  // MASTER / ADMIN ENDPOINTS: Strictly guarded
  // ==========================================

  // Change master mailbox - PROTECTED BY EXCLUSIVE USER PIN
  app.post('/api/master/change-mailbox', (req, res) => {
    const { pin, newEmail } = req.body || {};
    const validPin = process.env.ADMIN_PIN || '2429';
    if (String(pin || '').trim() !== validPin) {
      return res.status(403).json({
        error: 'PIN de seguridad incorrecto. Solo el titular autorizado puede modificar el buzón maestro.',
      });
    }

    const cleanEmail = String(newEmail || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico de Gmail válido.' });
    }

    const previousMail = serverState.masterEmail;
    serverState.masterEmail = cleanEmail;
    saveStateToDisk();

    console.log(`[Server] Buzón maestro actualizado por administrador de ${previousMail} a ${serverState.masterEmail}`);
    return res.json({
      success: true,
      masterEmail: serverState.masterEmail,
      message: `Buzón maestro actualizado con éxito a: ${serverState.masterEmail}`,
    });
  });

  // 2. Register / renew master token from owner
  app.post('/api/master/register-token', (req, res) => {
    const { token, email } = req.body;
    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail !== serverState.masterEmail.toLowerCase()) {
      return res.status(403).json({
        error: `Acceso denegado: Esta aplicación está configurada exclusivamente para el buzón de ${serverState.masterEmail}. Tu cuenta (${email}) no tiene permisos de administrador.`,
      });
    }

    masterAccessToken = token;
    serverState.isMasterConnected = true;
    serverState.lastSyncAt = new Date().toISOString();
    saveStateToDisk();

    console.log(`[Server] Master reader authenticated for ${serverState.masterEmail}`);
    return res.json({
      success: true,
      message: `Buzón maestro conectado y activo para ${serverState.masterEmail}`,
      masterEmail: serverState.masterEmail,
    });
  });

  // 3. Update master state when new prices/plans are parsed
  app.post('/api/master/update-state', (req, res) => {
    const { records, plans, latestReport, reports, spreadsheetId, spreadsheetUrl } = req.body;

    if (Array.isArray(records)) {
      serverState.records = deduplicateRecords(records);
    }
    if (Array.isArray(plans)) {
      serverState.plans = plans;
    }
    if (latestReport) {
      serverState.latestReport = latestReport;
    }
    if (Array.isArray(reports)) {
      serverState.reports = reports;
    }
    if (spreadsheetId) serverState.spreadsheetId = spreadsheetId;
    if (spreadsheetUrl) serverState.spreadsheetUrl = spreadsheetUrl;

    serverState.lastSyncAt = new Date().toISOString();
    saveStateToDisk();

    return res.json({
      success: true,
      recordsCount: serverState.records.length,
      plansCount: serverState.plans.length,
      lastSyncAt: serverState.lastSyncAt,
    });
  });

  // 4. Send Gmail summary (Uses Bearer header or master token)
  app.post('/api/gmail/send', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || (masterAccessToken ? `Bearer ${masterAccessToken}` : null);
      if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization for email dispatch' });
      }

      const { to, subject, htmlBody, raw } = req.body;
      let encodedRaw = raw;

      if (!encodedRaw && to && htmlBody) {
        const emailLines = [
          `To: ${to}`,
          `Subject: =?utf-8?B?${Buffer.from(subject || 'Resumen de Precios AT&T').toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          htmlBody,
        ];
        const rawEmail = emailLines.join('\r\n');
        encodedRaw = Buffer.from(rawEmail, 'utf-8')
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      }

      if (!encodedRaw) {
        return res.status(400).json({ error: 'Missing email recipient or body' });
      }

      const googleRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedRaw }),
      });

      const data = await googleRes.json().catch(() => ({}));
      if (!googleRes.ok) {
        const errorMsg = (data as any)?.error?.message || `Gmail API responded with status ${googleRes.status}`;
        return res.status(googleRes.status).json({ error: errorMsg });
      }

      return res.json({ success: true, id: (data as any).id });
    } catch (err: any) {
      console.error('[Server] Error sending email:', err);
      return res.status(500).json({ error: err?.message || 'Error sending email' });
    }
  });

  // Helper to safely query Gemini AI models with cascade fallbacks
  async function callGeminiSafe(prompt: string, config?: any): Promise<{ text: string; model: string } | null> {
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
    for (const model of modelsToTry) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI();
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          ...(config ? { config } : {}),
        });
        const text = response.text || '';
        if (text.trim()) {
          return { text: text.trim(), model };
        }
      } catch (err: any) {
        console.warn(`[Server] Gemini model ${model} skipped:`, err?.message || err);
      }
    }
    return null;
  }

  // 5. AI Facebook Ad Copy Generator (Gemini 2.5/3.8 Flash with robust offline templates)
  app.post('/api/ai/facebook-copy', async (req, res) => {
    const currentMonthNum = new Date().getMonth();
    const MONTH_NAMES_ES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const defaultCurrentMonth = MONTH_NAMES_ES[currentMonthNum] || 'Octubre';

    const {
      theme = 'Especial del Mes',
      monthName = defaultCurrentMonth,
      eventName = '',
      devices = [],
      sucursal = 'AT&T Alsuper Robinson',
      tone = 'urgente',
      format = 'facebook_post',
    } = req.body;

    const devicesListText = Array.isArray(devices) && devices.length > 0
      ? devices.map((d: any) =>
          `• ${d.brand} ${d.model}: Enganche mín (10%) $${Number(d.engancheMin || 0).toLocaleString('es-MX')} | Enganche máx (50%) $${Number(d.engancheMax || 0).toLocaleString('es-MX')} | Mensualidad total: $${Number(d.mensualidad || 0).toLocaleString('es-MX')}/mes (${d.plazo || 36}m, Plan ${d.plan || 'Ármalo'})`
        ).join('\n')
      : '• Varios modelos disponibles con enganche desde el 10% y mensualidades bajas';

    try {
      const prompt = `Eres un redactor publicitario senior (Copywriter) experto en anuncios virales para redes sociales (Facebook, Instagram y WhatsApp) de distribuidores autorizados de AT&T México.
Escribe un texto publicitario altamente vendedor, fresco, persuasivo y estructurado para promocionar los últimos modelos con vigencia activa.

REGLA CRUCIAL DE TEMPORADA:
- El mes en curso es ${monthName}.
- Enfócate EXCLUSIVAMENTE en eventos y festividades actuales del mes en curso (${monthName}), por ejemplo HALLOWEEN (en Octubre), Día de Muertos o Buen Fin (en Noviembre), Navidad (en Diciembre), etc.
- NUNCA menciones Fiestas Patrias, Septiembre ni eventos que ya pasaron.
- Temática o Campaña seleccionada: ${eventName ? `${eventName} (${theme})` : theme}. Incorpora frases y ganchos ingeniosos acordes a la festividad de ${monthName} (por ejemplo si es Halloween: ofertas de miedo, precios de espanto, sin sustos en tu mensualidad, etc.).

DATOS DE LA CAMPAÑA:
- Sucursal Oficial: ${sucursal}
- Mes / Temporada: ${monthName}
- Temática / Evento: ${eventName ? `${eventName} (${theme})` : theme}
- Enfoque / Tono: ${tone === 'urgente' ? 'Directo, ofertas con sentido de urgencia y llamada a la acción' : tone === 'exclusividad' ? 'Lanzamientos premium, últimos modelos y tecnología' : 'Cercano, explicativo y enfocado en ahorro'}
- Formato solicitado: ${format === 'whatsapp_broadcast' ? 'Mensaje para lista de difusión de WhatsApp con asteriscos para negritas' : format === 'reels_script' ? 'Guión rápido para video corto (Reels/TikTok)' : 'Post para Facebook e Instagram con saltos de línea limpios y emojis'}

LISTA DE EQUIPOS EN PROMOCIÓN:
${devicesListText}

ESTRUCTURA DEL MENSAJE:
1. Gancho llamativo en mayúsculas que detenga el scroll relacionado con la temática (${theme}).
2. Explica que pueden estrenar con ENGANCHE MÍNIMO (10%) o con ENGANCHE MÁXIMO (50%) para mensualidad ultra baja congelada.
3. Lista clara y organizada de los modelos con sus pagos.
4. Beneficios del Plan: Redes sociales ilimitadas y Roaming México/USA/Canadá.
5. Requisitos: Solo INE vigente.
6. Invitación clara a visitar la tienda en ${sucursal} o enviar mensaje directo.
7. Hashtags clave (#ATT #${sucursal.replace(/[^a-zA-Z0-9]/g, '')} #EstrenaCelular #Promociones)

Responde ÚNICAMENTE con el texto publicitario listo para publicar.`;

      const aiResult = await callGeminiSafe(prompt);
      if (aiResult && aiResult.text) {
        return res.json({ success: true, copy: aiResult.text, source: aiResult.model });
      }
    } catch (aiErr) {
      console.warn('[Server] Gemini AI fallback triggered:', (aiErr as any)?.message || aiErr);
    }

    // High-Converting Fallback Templates when API Key is pending or quota reached
    const sampleDevice = devices[0] || {
      brand: 'Samsung / iPhone / Motorola',
      model: 'Equipos en Promoción',
      engancheMin: 800,
      engancheMax: 4000,
      mensualidad: 450,
      plan: 'Ármalo',
      plazo: 36,
    };

    const isHalloweenMonth = monthName.toLowerCase().includes('octub');
    const headerHook = isHalloweenMonth
      ? `🎃 ¡OFERTAS DE MIEDO EN ${sucursal.toUpperCase()}! 👻`
      : `🔥 ¡ESTRENA HOY EN ${sucursal.toUpperCase()}! 🔥`;

    const subHook = isHalloweenMonth
      ? `¡Precios de espanto y sin sustos en tu mensualidad este mes de ${monthName}! 🕸️📲`
      : `¡Aprovecha las promociones oficiales vigentes este mes de ${monthName}! 📲⚡`;

    const fallbackCopy = `${headerHook}
${eventName ? `✨ ${eventName.toUpperCase()} ✨\n` : ''}${subHook}

💥 ¡TÚ ELIGES CÓMO PAGAR!:
👉 Enganche MÍNIMO desde el 10% de su precio promo (¡Llévatelo con poco pago inicial!)
👉 Enganche MÁXIMO del 50% (¡Para tener la mensualidad más baja congelada!)

📱 ALGUNOS MODELOS DESTACADOS:
${Array.isArray(devices) && devices.length > 0 ? devices.slice(0, 6).map((d: any) => `✅ ${d.brand} ${d.model}:
   💳 Enganche mín (10%): $${Number(d.engancheMin || 0).toLocaleString('es-MX')}
   🛡️ Enganche máx (50%): $${Number(d.engancheMax || 0).toLocaleString('es-MX')}
   🚀 Mensualidad: solo $${Number(d.mensualidad || 0).toLocaleString('es-MX')}/mes (${d.plazo || 36} meses con Plan AT&T ${d.plan || ''})`).join('\n\n') : `✅ ${sampleDevice.brand} ${sampleDevice.model}:
   💳 Enganche mín (10%): $${Number(sampleDevice.engancheMin).toLocaleString('es-MX')}
   🛡️ Enganche máx (50%): $${Number(sampleDevice.engancheMax).toLocaleString('es-MX')}
   🚀 Mensualidad: $${Number(sampleDevice.mensualidad).toLocaleString('es-MX')}/mes`}

🎁 TU LÍNEA AT&T INCLUYE:
🌐 Redes Sociales Ilimitadas (WhatsApp, Facebook, Instagram, Messenger, X)
✈️ Roaming Internacional incluido en México, USA y Canadá
⚡ Cobertura en la Red 5G más confiable
🔒 Equipos 100% Nuevos con Garantía Oficial de Fábrica

📋 REQUISITOS:
Únicamente tu INE / Identificación oficial vigente. ¡Aprobación y entrega inmediata!

📍 VISÍTANOS EN NUESTRA SUCURSAL:
🏬 ${sucursal}
💬 ¡Mándanos un mensaje por WhatsApp o déjanos un comentario para apartar tu modelo hoy mismo!

#ATT #${sucursal.replace(/[^a-zA-Z0-9]/g, '')} #PromocionesATT #EstrenaCelular #Ofertas #Chihuahua #PlanesATT`;

    return res.json({ success: true, copy: fallbackCopy, source: 'template-fallback' });
  });

  // 6. AI WhatsApp Closing Pitch Generator (Gemini Safe)
  app.post('/api/ai/whatsapp-pitch', async (req, res) => {
    const {
      clientName = '',
      brand = '',
      model = '',
      storage = '',
      plan = '',
      plazo = 36,
      precioPromo = 0,
      enganche = 0,
      porcentajeEnganche = 50,
      mensualidadTotal = 0,
      costoPlan = 0,
      sucursal = 'AT&T Alsuper Robinson',
    } = req.body;

    try {
      const prompt = `Eres un asesor de ventas de élite de AT&T México en la sucursal "${sucursal}".
Escribe un mensaje de WhatsApp altamente profesional, persuasivo, cálido, directo y vendedor para cerrar la venta con un cliente que pidió cotización.

DATOS DEL CLIENTE Y COTIZACIÓN:
- Nombre del cliente: ${clientName || 'Cliente'}
- Equipo: ${brand} ${model} ${storage ? `(${storage})` : ''}
- Precio Promoción Vigente: $${Number(precioPromo || 0).toLocaleString('es-MX')}
- Opción de Enganche elegida: $${Number(enganche || 0).toLocaleString('es-MX')} (${porcentajeEnganche}%)
- Mensualidad Final a pagar: $${Number(mensualidadTotal || 0).toLocaleString('es-MX')}/mes
- Plan incluido: Plan AT&T ${plan} (${plazo} meses)
- Sucursal de entrega: ${sucursal}

ESTRUCTURA DEL MENSAJE (formato WhatsApp con asteriscos para negritas y emojis amigables):
1. Saludo personalizado y agradecimiento por su interés.
2. Confirmación de que su equipo TIENE PROMOCIÓN VIGENTE ACTIVA.
3. Desglose claro y resumido:
   *Equipo:* ${brand} ${model}
   *Pago Inicial (Enganche):* $${Number(enganche).toLocaleString('es-MX')}
   *Mensualidad Total con Plan:* $${Number(mensualidadTotal).toLocaleString('es-MX')}/mes (Plazo ${plazo} meses)
4. Beneficios del Plan: Redes sociales ilimitadas, llamadas y SMS libres en México/USA/Canadá, red 5G y equipo nuevo con garantía.
5. Requisitos rápidos (solo INE).
6. Pregunta de cierre poderosa para apartarle el equipo o agendar su visita hoy en ${sucursal}.

Responde ÚNICAMENTE con el mensaje de WhatsApp listo para enviar, sin explicaciones previas.`;

      const aiResult = await callGeminiSafe(prompt);
      if (aiResult && aiResult.text) {
        return res.json({ success: true, pitch: aiResult.text, source: aiResult.model });
      }
    } catch (err) {
      console.warn('[Server] Gemini WhatsApp pitch fallback:', (err as any)?.message || err);
    }

    // High converting fallback template
    const fallbackPitch = `¡Hola ${clientName ? clientName : ''}! 👋 Te saluda tu asesor de *${sucursal}*.

¡Excelentes noticias! El *${brand} ${model}* ${storage ? `(${storage})` : ''} que me pediste sí tiene *PROMOCIÓN VIGENTE ACTIVA* 📲✨

Aquí tienes tu cotización oficial:
━━━━━━━━━━━━━━━━━━━━
📱 *Equipo:* ${brand} ${model}
🏷️ *Precio Promo:* $${Number(precioPromo).toLocaleString('es-MX')}
💳 *Enganche (${porcentajeEnganche}%):* $${Number(enganche).toLocaleString('es-MX')}
🚀 *Mensualidad Total:* *$${Number(mensualidadTotal).toLocaleString('es-MX')}/mes*
⏱️ *Plazo:* ${plazo} meses en *Plan AT&T ${plan}*
━━━━━━━━━━━━━━━━━━━━

🎁 *Tu plan incluye:*
✅ Redes sociales ilimitadas (WhatsApp, FB, IG, etc.)
✅ Llamadas y SMS libres en México, USA y Canadá
✅ Equipo 100% nuevo y sellado de fábrica con garantía

📋 *Requisitos:* Solo tu INE vigente.
¿Te aparto el tuyo hoy mismo en ${sucursal} o prefieres que iniciemos tu trámite por aquí? 💬😊`;

    return res.json({ success: true, pitch: fallbackPitch, source: 'template-fallback' });
  });

  // 7. AI Headline & Hook Generator for Ads (Gemini Safe)
  app.post('/api/ai/headline-hook', async (req, res) => {
    const { model = '', brand = '', theme = 'Promoción del Mes', sucursal = 'AT&T Alsuper Robinson' } = req.body;

    try {
      const prompt = `Genera 4 frases de gancho o titulares cortos de impacto publicitario (máximo 7 palabras cada una) para colocar en una imagen de anuncio de Facebook del teléfono ${brand} ${model} en la tienda "${sucursal}".
Temática de campaña: ${theme}.
Deben ser persuasivos, atractivos y generar curiosidad o deseo de estrenar celular nuevo con poco enganche.
Devuelve únicamente un JSON en formato de arreglo de strings: ["frase 1", "frase 2", "frase 3", "frase 4"].`;

      const aiResult = await callGeminiSafe(prompt, { responseMimeType: 'application/json' });
      if (aiResult && aiResult.text) {
        const parsed = JSON.parse(aiResult.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json({ success: true, headlines: parsed, source: aiResult.model });
        }
      }
    } catch (e) {
      console.warn('[Server] Headline hook fallback:', e);
    }

    const isHalloween =
      theme.toLowerCase().includes('halloween') ||
      theme.toLowerCase().includes('miedo') ||
      theme.toLowerCase().includes('octub');

    return res.json({
      success: true,
      headlines: isHalloween
        ? [
            '🎃 ¡Precios de espanto y sin sustos!',
            '👻 Estrena hoy con solo 10% de enganche',
            '🕸️ Ofertas de miedo con mensualidad congelada',
            '🧙 ¡Dulce o truco! Llévatelo sin descapitalizarte',
          ]
        : [
            '¡Estrena hoy con solo 10% de enganche!',
            'Gama Alta disponible con mensualidad congelada',
            `Promoción Oficial en ${sucursal}`,
            '¡Cambia tu celular sin descapitalizarte hoy!',
          ],
      source: 'preset-fallback',
    });
  });

  // ==========================================
  // STATIC ASSETS & VITE MIDDLEWARE
  // ==========================================
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] AT&T Sync Engine running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Startup error:', err);
  process.exit(1);
});
