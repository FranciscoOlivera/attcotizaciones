import { DevicePriceRecord, PriceChangeDiff, SyncExecutionReport } from '../types/pricing';

export const computePriceDifferences = (
  previousRecords: DevicePriceRecord[],
  newRecords: DevicePriceRecord[]
): {
  changes: PriceChangeDiff[];
  newRecordsCount: number;
  priceDropsCount: number;
  priceIncreasesCount: number;
  unchangedCount: number;
} => {
  const prevMap = new Map<string, DevicePriceRecord>();
  for (const prev of previousRecords) {
    const key = `${prev.brand.toLowerCase()}|${prev.model.toLowerCase()}|${prev.planNombre.toLowerCase()}|${prev.plazo}`;
    prevMap.set(key, prev);
  }

  const changes: PriceChangeDiff[] = [];
  let newRecordsCount = 0;
  let priceDropsCount = 0;
  let priceIncreasesCount = 0;
  let unchangedCount = 0;

  for (const item of newRecords) {
    const key = `${item.brand.toLowerCase()}|${item.model.toLowerCase()}|${item.planNombre.toLowerCase()}|${item.plazo}`;
    const previous = prevMap.get(key);

    const itemTotal = Number(item.mensualidadTotalConMaxEnganche || item.mensualidad || 0);
    const itemPromo = Number(item.precioPromocion || item.precioLista || 0);

    if (!previous) {
      // New record
      newRecordsCount++;
      changes.push({
        id: item.id,
        brand: item.brand,
        model: item.model,
        planNombre: item.planNombre,
        plazo: item.plazo,
        type: 'new',
        newPrecioPromocion: itemPromo,
        newMensualidadTotal: itemTotal,
        promocion: item.promocion,
        details: `Nuevo precio de promoción: $${Number(itemPromo || 0).toLocaleString('es-MX')} en Plan ${item.planNombre} a ${item.plazo} meses. Mensualidad total: $${Number(itemTotal || 0).toLocaleString('es-MX')}/mes.`,
      });
    } else {
      const prevTotal = Number(previous.mensualidadTotalConMaxEnganche || previous.mensualidad || 0);
      const prevPromo = Number(previous.precioPromocion || previous.precioLista || 0);
      const diffMensualidad = itemTotal - prevTotal;

      if (diffMensualidad < -1) {
        // Price drop
        priceDropsCount++;
        const savings = Math.abs(diffMensualidad);
        changes.push({
          id: item.id,
          brand: item.brand,
          model: item.model,
          planNombre: item.planNombre,
          plazo: item.plazo,
          type: 'price_drop',
          oldPrecioPromocion: prevPromo,
          newPrecioPromocion: itemPromo,
          oldMensualidadTotal: prevTotal,
          newMensualidadTotal: itemTotal,
          diffMensualidad,
          promocion: item.promocion,
          details: `Bajó $${Number(savings || 0).toLocaleString('es-MX')}/mes en total (de $${Number(prevTotal || 0).toLocaleString('es-MX')} a $${Number(itemTotal || 0).toLocaleString('es-MX')}). Precio promoción: $${Number(itemPromo || 0).toLocaleString('es-MX')}.`,
        });
      } else if (diffMensualidad > 1) {
        // Price increase
        priceIncreasesCount++;
        changes.push({
          id: item.id,
          brand: item.brand,
          model: item.model,
          planNombre: item.planNombre,
          plazo: item.plazo,
          type: 'price_increase',
          oldPrecioPromocion: prevPromo,
          newPrecioPromocion: itemPromo,
          oldMensualidadTotal: prevTotal,
          newMensualidadTotal: itemTotal,
          diffMensualidad,
          promocion: item.promocion,
          details: `Aumentó $${Number(diffMensualidad || 0).toLocaleString('es-MX')}/mes en total (de $${Number(prevTotal || 0).toLocaleString('es-MX')} a $${Number(itemTotal || 0).toLocaleString('es-MX')}).`,
        });
      } else {
        // Unchanged
        unchangedCount++;
        changes.push({
          id: item.id,
          brand: item.brand,
          model: item.model,
          planNombre: item.planNombre,
          plazo: item.plazo,
          type: 'unchanged',
          oldPrecioPromocion: prevPromo,
          newPrecioPromocion: itemPromo,
          oldMensualidadTotal: prevTotal,
          newMensualidadTotal: itemTotal,
          diffMensualidad: 0,
          promocion: item.promocion,
          details: `Sin variación en Plan ${item.planNombre} a ${item.plazo}m ($${Number(itemTotal || 0).toLocaleString('es-MX')}/mes total).`,
        });
      }
    }
  }

  changes.sort((a, b) => {
    const priority = { price_drop: 0, new: 1, price_increase: 2, plazo_changed: 3, unchanged: 4 };
    return priority[a.type] - priority[b.type];
  });

  return {
    changes,
    newRecordsCount,
    priceDropsCount,
    priceIncreasesCount,
    unchangedCount,
  };
};

export const generateEmailHTMLSummary = (report: SyncExecutionReport): string => {
  const allChanges = report?.changes || [];
  const topDrops = allChanges.filter((c) => c.type === 'price_drop').slice(0, 10);
  const topNew = allChanges.filter((c) => c.type === 'new').slice(0, 10);

  const dropsRows = topDrops.length
    ? topDrops
        .map(
          (d) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${d.brand || ''} ${d.model || ''}</td>
        <td style="padding: 10px 12px; color: #0284c7; font-weight: 600;">Plan ${d.planNombre || ''}</td>
        <td style="padding: 10px 12px; text-align: center; color: #475569;">${d.plazo || 36}m</td>
        <td style="padding: 10px 12px; text-align: right; color: #64748b;">$${Number(d.newPrecioPromocion || 0).toLocaleString('es-MX')}</td>
        <td style="padding: 10px 12px; text-align: right; text-decoration: line-through; color: #94a3b8;">$${Number(d.oldMensualidadTotal || 0).toLocaleString('es-MX')}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #16a34a;">$${Number(d.newMensualidadTotal || 0).toLocaleString('es-MX')}/m</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #16a34a;">-$${Math.abs(d.diffMensualidad || 0).toLocaleString('es-MX')}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="7" style="padding: 12px; text-align: center; color: #64748b;">No se registraron reducciones de cuota en este lote.</td></tr>`;

  const newRows = topNew.length
    ? topNew
        .map(
          (n) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${n.brand || ''} ${n.model || ''}</td>
        <td style="padding: 10px 12px; color: #0284c7; font-weight: 600;">Plan ${n.planNombre || ''}</td>
        <td style="padding: 10px 12px; text-align: center; color: #475569;">${n.plazo || 36}m</td>
        <td style="padding: 10px 12px; text-align: right; color: #334155; font-weight: 600;">$${Number(n.newPrecioPromocion || 0).toLocaleString('es-MX')}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0284c7;">$${Number(n.newMensualidadTotal || 0).toLocaleString('es-MX')}/m</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #64748b;">No se incorporaron nuevos modelos en este lote.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Resumen de Cambios: Lista de Precios AT&T Premium</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #002f6c 0%, #009fdb 100%); padding: 32px 36px; color:#ffffff;">
              <span style="background:rgba(255,255,255,0.2); padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">AT&T Precios Sync • Fórmula Oficial</span>
              <h1 style="margin: 12px 0 6px; font-size:22px; font-weight:700; color:#ffffff;">Actualización de Precios Promocionales AT&T</h1>
              <p style="margin:0; font-size:14px; opacity:0.9; color:#e0f2fe;">Archivo procesado: <strong>${report.attachmentName}</strong></p>
            </td>
          </tr>

          <!-- Notice banner about formula -->
          <tr>
            <td style="padding: 16px 36px; background-color:#f8fafc; border-bottom:1px solid #e2e8f0; font-size:12px; color:#475569; line-height:1.5;">
              <strong>Fórmula de cálculo aplicada:</strong> Precio Promoción con plan y plazo • Enganche máximo del 50% • Saldo restante financiado a meses + Costo mensual del plan.
            </td>
          </tr>

          <!-- KPI Cards -->
          <tr>
            <td style="padding: 24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  <td width="25%" style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#16a34a;">${report.priceDropsCount}</div>
                    <div style="font-size:11px; font-weight:600; color:#15803d; text-transform:uppercase; margin-top:2px;">Bajaron de Cuota</div>
                  </td>
                  <td width="25%" style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:14px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#0284c7;">${report.newRecordsCount}</div>
                    <div style="font-size:11px; font-weight:600; color:#0369a1; text-transform:uppercase; margin-top:2px;">Nuevos Modelos</div>
                  </td>
                  <td width="25%" style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:14px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#d97706;">${report.priceIncreasesCount}</div>
                    <div style="font-size:11px; font-weight:600; color:#b45309; text-transform:uppercase; margin-top:2px;">Aumentos</div>
                  </td>
                  <td width="25%" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center;">
                    <div style="font-size:24px; font-weight:800; color:#334155;">${report.totalRecords}</div>
                    <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; margin-top:2px;">Total Cotizaciones</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Price Drops Table -->
          <tr>
            <td style="padding: 0 36px 24px;">
              <h3 style="margin: 0 0 10px; font-size:15px; color:#0f172a;">
                🔥 Principales Reducciones de Mensualidad Total
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc; text-align:left; color:#64748b; font-size:10px; text-transform:uppercase;">
                    <th style="padding:8px 10px;">Equipo</th>
                    <th style="padding:8px 10px;">Plan</th>
                    <th style="padding:8px 10px; text-align:center;">Plazo</th>
                    <th style="padding:8px 10px; text-align:right;">P. Promo</th>
                    <th style="padding:8px 10px; text-align:right;">Anterior</th>
                    <th style="padding:8px 10px; text-align:right;">Nueva Total</th>
                    <th style="padding:8px 10px; text-align:right;">Ahorro</th>
                  </tr>
                </thead>
                <tbody>
                  ${dropsRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- New Models Table -->
          <tr>
            <td style="padding: 0 36px 24px;">
              <h3 style="margin: 0 0 10px; font-size:15px; color:#0f172a;">
                ✨ Nuevos Equipos y Promociones
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc; text-align:left; color:#64748b; font-size:10px; text-transform:uppercase;">
                    <th style="padding:8px 10px;">Equipo</th>
                    <th style="padding:8px 10px;">Plan</th>
                    <th style="padding:8px 10px; text-align:center;">Plazo</th>
                    <th style="padding:8px 10px; text-align:right;">Precio Promo</th>
                    <th style="padding:8px 10px; text-align:right;">Mensualidad Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${newRows}
                </tbody>
              </table>
            </td>
          </tr>

          ${
            report.spreadsheetUrl
              ? `
          <!-- Google Sheets Button -->
          <tr>
            <td style="padding: 0 36px 28px; text-align:center;">
              <a href="${report.spreadsheetUrl}" target="_blank" style="background:#009fdb; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; font-size:13px; display:inline-block;">
                Ver Base Central en Google Sheets →
              </a>
            </td>
          </tr>`
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:18px 36px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#94a3b8;">
              <p style="margin:0;">Generado por el Sincronizador y Cotizador de Precios AT&T Premium.</p>
              <p style="margin:4px 0 0;">Únicamente se procesó la hoja "Promociones AT&T Premium" (demás hojas descartadas para ahorro de espacio).</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};
