import { DevicePriceRecord, SyncExecutionReport } from '../types/pricing';

export interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
}

export const createCentralDatabaseSpreadsheet = async (
  accessToken: string,
  title: string = 'Base de Datos Central - Precios AT&T Premium'
): Promise<SpreadsheetInfo> => {
  const body = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Precios Vigentes',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'Historial de Cambios',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (netErr: any) {
    throw new Error(`Error de conexión con Google Sheets API: ${netErr?.message || 'Fallo de red'}`);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Error creando la hoja de cálculo en Google Sheets: ${err}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize headers with exact fields requested
  await updateSheetRange(accessToken, spreadsheetId, 'Precios Vigentes!A1:J1', [
    [
      'Marca',
      'Equipo / Modelo',
      'Plan AT&T',
      'Costo Plan ($/mes)',
      'Plazo (Meses)',
      'Precio de Promoción ($)',
      'Enganche Máximo 50% ($)',
      'Mensualidad Equipo ($)',
      'Mensualidad Total a Pagar ($)',
      'Última Actualización',
    ],
  ]);

  await updateSheetRange(accessToken, spreadsheetId, 'Historial de Cambios!A1:H1', [
    [
      'Fecha / Hora',
      'Archivo Origen',
      'Total Registros',
      'Nuevos Modelos',
      'Bajaron de Cuota',
      'Aumentaron',
      'Sin Cambios',
      'Estado Sincronización',
    ],
  ]);

  return {
    id: spreadsheetId,
    title,
    url: spreadsheetUrl,
  };
};

export const updateSheetRange = async (
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });
  } catch (err: any) {
    throw new Error(`Error de conexión al actualizar celdas en Google Sheets: ${err?.message || 'Fallo de red'}`);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Error actualizando rango en Google Sheets (${res.status}): ${err}`);
  }
};

export const clearSheetRange = async (
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<void> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:clear`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    console.warn('Network error clearing range in Google Sheets:', e);
  }
};

export const appendSheetRow = async (
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn('Error appending row to Google Sheets:', err);
    }
  } catch (e) {
    console.warn('Network error appending row to Google Sheets:', e);
  }
};

export const syncPricesToGoogleSheet = async (
  accessToken: string,
  spreadsheetId: string,
  records: DevicePriceRecord[],
  report: SyncExecutionReport
): Promise<string> => {
  await clearSheetRange(accessToken, spreadsheetId, 'Precios Vigentes!A2:J6000');

  const rows = records.map((rec) => [
    rec.brand,
    rec.model,
    rec.planNombre,
    rec.costoPlan,
    rec.plazo,
    rec.precioPromocion,
    rec.engancheMaximo,
    rec.mensualidadEquipoConMaxEnganche,
    rec.mensualidadTotalConMaxEnganche,
    new Date(rec.updatedAt).toLocaleString('es-MX'),
  ]);

  if (rows.length > 0) {
    await updateSheetRange(accessToken, spreadsheetId, `Precios Vigentes!A2:J${rows.length + 1}`, rows);
  }

  await appendSheetRow(accessToken, spreadsheetId, 'Historial de Cambios!A:H', [
    [
      new Date(report.timestamp).toLocaleString('es-MX'),
      report.attachmentName,
      report.totalRecords,
      report.newRecordsCount,
      report.priceDropsCount,
      report.priceIncreasesCount,
      report.unchangedCount,
      report.status === 'success' ? 'Completado con éxito' : 'Advertencia / Parcial',
    ],
  ]);

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
};

export const getSpreadsheetMetadata = async (
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetInfo> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err: any) {
    throw new Error(`Error de conexión al consultar Google Sheets: ${err?.message || 'Fallo de red'}`);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`No se pudo acceder a la hoja con ID ${spreadsheetId}: ${err}`);
  }

  const data = await res.json().catch(() => ({}));
  return {
    id: spreadsheetId,
    title: data.properties?.title || 'Hoja de Cálculo',
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
};
