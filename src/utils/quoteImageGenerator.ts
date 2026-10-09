/**
 * High-converting graphic quote image generator using native HTML5 Canvas
 * Generates crisp, retina-grade 1080x1400 (mobile portrait) sales images with AT&T aesthetic
 */

export interface QuoteImageData {
  clientName?: string;
  clientPhone?: string;
  brand: string;
  model: string;
  planName: string;
  costoPlan: number;
  plazo: number;
  precioPromocion: number;
  precioContado?: number;
  esMenor30Contado?: boolean;
  tipoPagoInicial?: 'rentas_adelantadas' | 'enganche';
  numRentasAdelantadas?: number;
  montoRentasAdelantadas?: number;
  porcentajeEnganche: number;
  montoEnganche: number;
  montoFinanciado: number;
  mensualidadEquipo: number;
  mensualidadTotal: number;
  customNotes?: string;
}

/**
 * Renders a high-resolution, visually impactful sales quote card to an HTML Canvas
 */
export function generateQuoteCanvas(data: QuoteImageData): HTMLCanvasElement {
  const width = 1080;
  const height = 1420;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el motor de renderizado Canvas');

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Cinematic Background Gradient (Luxury AT&T Deep Slate & Navy)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#040914');
  bgGrad.addColorStop(0.3, '#07152B');
  bgGrad.addColorStop(0.65, '#051021');
  bgGrad.addColorStop(1, '#02060D');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Mesh Glow Accents (Cyan top-left & Mint bottom-right)
  const glowTop = ctx.createRadialGradient(200, 150, 40, 200, 150, 500);
  glowTop.addColorStop(0, 'rgba(0, 168, 232, 0.22)');
  glowTop.addColorStop(0.7, 'rgba(0, 168, 232, 0.03)');
  glowTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, width, 600);

  const glowBottom = ctx.createRadialGradient(width - 200, height - 300, 50, width - 200, height - 300, 550);
  glowBottom.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  glowBottom.addColorStop(0.7, 'rgba(16, 185, 129, 0.02)');
  glowBottom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 600, width, height - 600);

  // Outer Border Frame with subtle glow
  ctx.strokeStyle = 'rgba(0, 168, 232, 0.35)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 36);
  ctx.stroke();

  // Corner Accent Highlights
  ctx.strokeStyle = '#00A8E8';
  ctx.lineWidth = 5;
  drawCornerAccents(ctx, 24, 24, width - 48, height - 48, 36, 40);

  // 2. HEADER BRAND RIBBON (Top)
  const headerY = 50;
  const headerH = 76;
  const headerGrad = ctx.createLinearGradient(55, headerY, width - 55, headerY + headerH);
  headerGrad.addColorStop(0, 'rgba(7, 25, 52, 0.95)');
  headerGrad.addColorStop(0.5, 'rgba(12, 38, 77, 0.95)');
  headerGrad.addColorStop(1, 'rgba(7, 25, 52, 0.95)');
  ctx.fillStyle = headerGrad;
  drawRoundedRect(ctx, 55, headerY, width - 110, headerH, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 168, 232, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // AT&T 3D Globe Emblem
  const globeX = 96;
  const globeY = headerY + headerH / 2;
  const globeGrad = ctx.createRadialGradient(globeX - 5, globeY - 5, 2, globeX, globeY, 22);
  globeGrad.addColorStop(0, '#38BDF8');
  globeGrad.addColorStop(0.4, '#00A8E8');
  globeGrad.addColorStop(0.85, '#0284C7');
  globeGrad.addColorStop(1, '#034E7B');
  ctx.fillStyle = globeGrad;
  ctx.beginPath();
  ctx.arc(globeX, globeY, 22, 0, Math.PI * 2);
  ctx.fill();

  // White globe ring lines
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(globeX, globeY, 13, 0.3, Math.PI * 1.7);
  ctx.stroke();

  // Brand Name & Dealer Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 26px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AT&T', 134, headerY + 48);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('• DISTRIBUIDOR AUTORIZADO PREMIUM', 214, headerY + 47);

  // Official Seal Badge Right
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  drawRoundedRect(ctx, width - 330, headerY + 18, 255, 40, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(width - 314, headerY + 38, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#34D399';
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('COTIZACIÓN OFICIAL VIGENTE', width - 298, headerY + 43);

  // 3. Client & Date Subheader Bar
  const metaY = 142;
  const clientNameText = data.clientName?.trim()
    ? `Cliente: ${data.clientName.trim()}`
    : 'Cotización Preferente Personalizada';
  const currentDateText = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 17px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`👤 ${clientNameText}`, 65, metaY);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`📅 ${currentDateText} • Sucursal Alsuper Robinson`, width - 65, metaY);

  // 4. DEVICE SHOWCASE SPOTLIGHT (Hero Equipment Card)
  const deviceY = 168;
  const deviceH = 158;
  const deviceGrad = ctx.createLinearGradient(55, deviceY, width - 55, deviceY + deviceH);
  deviceGrad.addColorStop(0, 'rgba(11, 26, 52, 0.9)');
  deviceGrad.addColorStop(1, 'rgba(8, 19, 39, 0.9)');
  ctx.fillStyle = deviceGrad;
  drawRoundedRect(ctx, 55, deviceY, width - 110, deviceH, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 168, 232, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Brand tag
  ctx.fillStyle = '#38BDF8';
  ctx.font = '900 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`📱 ${(data.brand || 'AT&T').toUpperCase()} • EQUIPO 100% NUEVO DE LÍNEA`, 85, deviceY + 38);

  // Big Model Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  const modelText = data.model || 'Equipo AT&T';
  ctx.fillText(truncateText(ctx, modelText, width - 180), 85, deviceY + 86);

  // Specs badges
  drawBadge(ctx, 85, deviceY + 104, `⏱️ Plazo de Financiamiento: ${data.plazo} Meses`, '#38BDF8', 'rgba(0, 168, 232, 0.15)');
  drawBadge(ctx, 420, deviceY + 104, `📶 Plan ${data.planName || 'AT&T'} ($${data.costoPlan}/mes)`, '#34D399', 'rgba(16, 185, 129, 0.15)');
  drawBadge(ctx, 770, deviceY + 104, `⚡ Red 5G Ultra`, '#F59E0B', 'rgba(245, 158, 11, 0.15)');

  // =========================================================================
  // 5. PRIMARY HIGHLIGHTS REQUESTED BY USER:
  //    A. COSTO DEL EQUIPO EN PRECIO DE PROMOCIÓN (Very prominent!)
  //    B. PAGO INICIAL REQUERIDO (Very prominent!)
  // =========================================================================
  const heroesY = 346;
  const heroCardW = (width - 110 - 24) / 2; // 473px each
  const heroCardH = 215;

  // -------------------------------------------------------------------------
  // 5A. CARD 1: COSTO DEL EQUIPO EN PRECIO DE PROMOCIÓN
  // -------------------------------------------------------------------------
  const promoGrad = ctx.createLinearGradient(55, heroesY, 55 + heroCardW, heroesY + heroCardH);
  promoGrad.addColorStop(0, 'rgba(28, 22, 10, 0.95)');
  promoGrad.addColorStop(0.5, 'rgba(46, 33, 14, 0.95)');
  promoGrad.addColorStop(1, 'rgba(20, 16, 8, 0.95)');
  ctx.fillStyle = promoGrad;
  drawRoundedRect(ctx, 55, heroesY, heroCardW, heroCardH, 26);
  ctx.fill();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Top header label
  ctx.fillStyle = '#FBBF24';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏷️ PRECIO DE PROMOCIÓN DEL EQUIPO', 55 + heroCardW / 2, heroesY + 36);

  // Big Promocion Price Value
  const promoFormatted = `$${Number(data.precioPromocion || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(promoFormatted, 55 + heroCardW / 2, heroesY + 98);

  // Reference cash price comparison
  if (data.precioContado && data.precioContado > data.precioPromocion) {
    const savings = data.precioContado - data.precioPromocion;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Precio de Contado: $${data.precioContado.toLocaleString('es-MX')}`, 55 + heroCardW / 2, heroesY + 134);

    // Savings Tag Banner
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    drawRoundedRect(ctx, 55 + 40, heroesY + 152, heroCardW - 80, 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FDE68A';
    ctx.font = '900 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(`🔥 ¡AHORRO DE $${savings.toLocaleString('es-MX')}!`, 55 + heroCardW / 2, heroesY + 177);
  } else {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Costo subsidiado con Plan ${data.planName}`, 55 + heroCardW / 2, heroesY + 134);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    drawRoundedRect(ctx, 55 + 40, heroesY + 152, heroCardW - 80, 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FDE68A';
    ctx.font = '900 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('🔥 ¡PRECIO PREFERENTE EXCLUSIVO!', 55 + heroCardW / 2, heroesY + 177);
  }

  // -------------------------------------------------------------------------
  // 5B. CARD 2: PAGO INICIAL REQUERIDO (Featured prominently!)
  // -------------------------------------------------------------------------
  const initX = 55 + heroCardW + 24;
  const is3Rentas = !!data.esMenor30Contado;

  const initGrad = ctx.createLinearGradient(initX, heroesY, initX + heroCardW, heroesY + heroCardH);
  if (is3Rentas) {
    // Vibrant Emerald Theme for 3 Rentas ($0 Enganche)
    initGrad.addColorStop(0, 'rgba(8, 38, 25, 0.98)');
    initGrad.addColorStop(0.5, 'rgba(11, 54, 35, 0.98)');
    initGrad.addColorStop(1, 'rgba(6, 30, 20, 0.98)');
  } else {
    // Electric Cyan Theme for 50% Enganche
    initGrad.addColorStop(0, 'rgba(7, 34, 60, 0.98)');
    initGrad.addColorStop(0.5, 'rgba(10, 47, 85, 0.98)');
    initGrad.addColorStop(1, 'rgba(6, 27, 49, 0.98)');
  }
  ctx.fillStyle = initGrad;
  drawRoundedRect(ctx, initX, heroesY, heroCardW, heroCardH, 26);
  ctx.fill();
  ctx.strokeStyle = is3Rentas ? '#10B981' : '#00A8E8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.fillStyle = is3Rentas ? '#6EE7B7' : '#7DD3FC';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    is3Rentas ? '⭐ PAGO INICIAL REQUERIDO' : '💳 PAGO INICIAL REQUERIDO',
    initX + heroCardW / 2,
    heroesY + 36
  );

  // Big Initial Payment Amount
  const initialPaymentAmount = is3Rentas
    ? Number(data.montoRentasAdelantadas || data.costoPlan * 3)
    : Number(data.montoEnganche || 0);
  const initFormatted = `$${initialPaymentAmount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  ctx.fillStyle = is3Rentas ? '#34D399' : '#38BDF8';
  ctx.font = '900 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(initFormatted, initX + heroCardW / 2, heroesY + 98);

  // Subtitle / Concept
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    is3Rentas
      ? `3 Rentas por Adelantado del Plan ($${data.costoPlan}/m)`
      : `50% de Enganche Comercial`,
    initX + heroCardW / 2,
    heroesY + 134
  );

  // Highlight pill ($0 enganche or Sin rentas)
  ctx.fillStyle = is3Rentas ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 168, 232, 0.25)';
  drawRoundedRect(ctx, initX + 35, heroesY + 152, heroCardW - 70, 40, 20);
  ctx.fill();
  ctx.strokeStyle = is3Rentas ? '#10B981' : '#38BDF8';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = is3Rentas ? '#A7F3D0' : '#BAE6FD';
  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    is3Rentas ? '🌟 ¡$0.00 DE ENGANCHE DE EQUIPO!' : '💳 ¡PAGO ÚNICO INICIAL AL ACTIVAR!',
    initX + heroCardW / 2,
    heroesY + 177
  );

  // =========================================================================
  // 6. HERO MONTHLY SPOTLIGHT (Centerpiece for Monthly Payment)
  // =========================================================================
  const monthlyY = 582;
  const monthlyH = 220;

  const monthlyGrad = ctx.createLinearGradient(55, monthlyY, width - 55, monthlyY + monthlyH);
  monthlyGrad.addColorStop(0, 'rgba(8, 26, 56, 0.98)');
  monthlyGrad.addColorStop(0.5, 'rgba(12, 38, 80, 0.98)');
  monthlyGrad.addColorStop(1, 'rgba(7, 21, 46, 0.98)');
  ctx.fillStyle = monthlyGrad;
  drawRoundedRect(ctx, 55, monthlyY, width - 110, monthlyH, 28);
  ctx.fill();
  ctx.strokeStyle = '#00A8E8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Kicker
  ctx.fillStyle = '#38BDF8';
  ctx.font = '900 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ MENSUALIDAD TOTAL CON TODO INCLUIDO ✦', width / 2, monthlyY + 42);

  // Massive Monthly Payment Number
  const monthlyFormatted = `$${Number(data.mensualidadTotal || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  ctx.fillStyle = '#10B981';
  ctx.font = '900 78px system-ui, -apple-system, sans-serif';
  ctx.fillText(monthlyFormatted, width / 2 - 50, monthlyY + 125);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '800 26px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  const totalNumW = ctx.measureText(monthlyFormatted).width;
  ctx.fillText('/ mes', width / 2 - 50 + totalNumW / 2 + 10, monthlyY + 115);

  // Exact Breakdown Description
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 17px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Incluye: Cuota del equipo ($${data.mensualidadEquipo.toFixed(2)}/mes) + Renta del Plan ${data.planName} ($${data.costoPlan}.00/mes)`,
    width / 2,
    monthlyY + 168
  );

  // Guarantee Tag
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    '✓ Tarifa fija sin aumentos sorpresa • Equipo 100% tuyo sin cargos al terminar tu plazo',
    width / 2,
    monthlyY + 196
  );

  // =========================================================================
  // 7. THREE METRIC PILLARS: Financed balance, Plan Cost, Term
  // =========================================================================
  const pillarsY = 822;
  const pillarW = (width - 110 - 32) / 3;
  const pillarH = 110;

  drawPillarCard(
    ctx,
    55,
    pillarsY,
    pillarW,
    pillarH,
    '📊 SALDO FINANCIADO',
    `$${Number(data.montoFinanciado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    `Dividido en ${data.plazo} meses`
  );

  drawPillarCard(
    ctx,
    55 + pillarW + 16,
    pillarsY,
    pillarW,
    pillarH,
    '📶 RENTA DEL PLAN',
    `$${Number(data.costoPlan || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    `Plan ${data.planName} mensual`
  );

  drawPillarCard(
    ctx,
    55 + (pillarW + 16) * 2,
    pillarsY,
    pillarW,
    pillarH,
    '🛡️ GARANTÍA DE FÁBRICA',
    '1 AÑO VIGENTE',
    'Con respaldo oficial AT&T'
  );

  // =========================================================================
  // 8. PLAN INCLUDED PERKS & BENEFITS
  // =========================================================================
  const perksY = 952;
  const perksH = 245;

  ctx.fillStyle = 'rgba(10, 22, 45, 0.85)';
  drawRoundedRect(ctx, 55, perksY, width - 110, perksH, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 168, 232, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Perks title
  ctx.fillStyle = '#38BDF8';
  ctx.font = '900 17px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`✨ BENEFICIOS EXCLUSIVOS INCLUIDOS EN TU PLAN AT&T:`, 85, perksY + 38);

  const perks = [
    {
      icon: '🌐',
      title: 'Redes Sociales Ilimitadas:',
      desc: 'WhatsApp, Facebook, Messenger, Instagram y X sin consumir tus datos.',
    },
    {
      icon: '✈️',
      title: 'Roaming Internacional Norteamérica:',
      desc: 'Usa tus minutos, SMS y GB en México, Estados Unidos y Canadá como en casa.',
    },
    {
      icon: '⚡',
      title: 'Red 5G de Mayor Velocidad:',
      desc: 'Navegación ultra rápida para streaming, videollamadas y juegos sin interrupciones.',
    },
    {
      icon: '🔒',
      title: 'Equipo Garantizado y Facturado:',
      desc: 'Equipo original nuevo en caja sellada con garantía de 1 año y factura deducible.',
    },
  ];

  perks.forEach((p, idx) => {
    const itemY = perksY + 76 + idx * 40;
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(p.icon, 85, itemY);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(p.title, 118, itemY);

    const titleW = ctx.measureText(p.title).width;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(p.desc, 126 + titleW, itemY);
  });

  // =========================================================================
  // 9. HIGH-CONVERTING CLOSING CALL TO ACTION
  // =========================================================================
  const ctaY = 1218;
  const ctaH = 125;

  const ctaGrad = ctx.createLinearGradient(55, ctaY, width - 55, ctaY + ctaH);
  ctaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  ctaGrad.addColorStop(0.5, 'rgba(0, 168, 232, 0.26)');
  ctaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.22)');
  ctx.fillStyle = ctaGrad;
  drawRoundedRect(ctx, 55, ctaY, width - 110, ctaH, 22);
  ctx.fill();
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🚀 ¡APROBACIÓN INMEDIATA ÚNICAMENTE CON TU INE!', width / 2, ctaY + 44);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('Envía tu identificación por este chat para apartado de equipo y activación exprés', width / 2, ctaY + 76);

  ctx.fillStyle = '#34D399';
  ctx.font = '800 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('Atención oficial • Sucursal AT&T Alsuper Robinson • Asesoría personalizada', width / 2, ctaY + 105);

  // Footer Disclaimer
  ctx.fillStyle = '#64748B';
  ctx.font = '500 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Precios en Moneda Nacional (MXN) con IVA del 16% incluido • Sujeto a aprobación crediticia y disponibilidad de inventario',
    width / 2,
    height - 18
  );

  return canvas;
}

/**
 * Draw corner accents for high-end look
 */
function drawCornerAccents(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  len: number
) {
  // Top-left
  ctx.beginPath();
  ctx.moveTo(x + r + len, y);
  ctx.lineTo(x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.lineTo(x, y + r + len);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - r - len, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + r + len);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - r - len);
  ctx.lineTo(x, y + h - r);
  ctx.quadraticCurveTo(x, y + h, x + r, y + h);
  ctx.lineTo(x + r + len, y + h);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - r - len, y + h);
  ctx.lineTo(x + w - r, y + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  ctx.lineTo(x + w, y + h - r - len);
  ctx.stroke();
}

/**
 * Truncate long text to fit inside max width
 */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Draw smooth rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw badge
 */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  textColor: string,
  bgColor: string
) {
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  const textWidth = ctx.measureText(text).width;
  const paddingX = 14;
  const badgeH = 32;

  ctx.fillStyle = bgColor;
  drawRoundedRect(ctx, x, y, textWidth + paddingX * 2, badgeH, 16);
  ctx.fill();
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + paddingX, y + 21);
}

/**
 * Draw breakdown pillar card
 */
function drawPillarCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  value: string,
  subtitle: string
) {
  ctx.fillStyle = 'rgba(10, 22, 45, 0.85)';
  drawRoundedRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 168, 232, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Title
  ctx.fillStyle = '#94A3B8';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, x + w / 2, y + 30);

  // Value
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(value, x + w / 2, y + 66);

  // Subtitle
  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(subtitle, x + w / 2, y + 92);
}

/**
 * Downloads the quote card image as a high-res PNG file
 */
export async function downloadQuoteImage(data: QuoteImageData, customFilename?: string): Promise<void> {
  const canvas = generateQuoteCanvas(data);
  const cleanModel = (data.model || 'Equipo').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanPlan = (data.planName || 'Plan').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = customFilename || `Cotizacion_Oficial_ATT_${cleanModel}_Plan_${cleanPlan}_${data.plazo}m.png`;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, 'image/png');
  });
}

/**
 * Copies the image directly to clipboard for instant pasting (Ctrl+V) into WhatsApp Web / chats
 */
export async function copyQuoteImageToClipboard(data: QuoteImageData): Promise<boolean> {
  try {
    const canvas = generateQuoteCanvas(data);
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob || !navigator.clipboard?.write) {
          resolve(false);
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          resolve(true);
        } catch (err) {
          console.warn('Clipboard image write error:', err);
          resolve(false);
        }
      }, 'image/png');
    });
  } catch (err) {
    console.error('Copy quote image error:', err);
    return false;
  }
}

/**
 * Shares the image via Web Share API directly to WhatsApp if supported on mobile/tablet
 */
export async function shareQuoteImageViaShareAPI(data: QuoteImageData): Promise<boolean> {
  try {
    const canvas = generateQuoteCanvas(data);
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(false);

        const cleanModel = (data.model || 'Equipo').replace(/[^a-zA-Z0-9]/g, '_');
        const file = new File([blob], `Cotizacion_Oficial_ATT_${cleanModel}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Cotización Oficial AT&T - ${data.model}`,
              text: `Te comparto tu cotización oficial de AT&T Premium para ${data.model} a ${data.plazo} meses.`,
              files: [file],
            });
            resolve(true);
            return;
          } catch (shareErr) {
            console.warn('User dismissed or failed share:', shareErr);
            resolve(false);
            return;
          }
        }

        // Fallback to downloading image
        await downloadQuoteImage(data);
        resolve(true);
      }, 'image/png');
    });
  } catch (e) {
    console.warn('Share API not supported:', e);
    return false;
  }
}
