import JSZip from 'jszip';
import { DevicePriceRecord } from '../types/pricing';

export interface FacebookAdData {
  id: string;
  brand: string;
  model: string;
  storage?: string;
  precioLista: number;
  precioPromocion: number;
  engancheMinimo: number; // 10%
  engancheMaximo: number; // 50%
  plazo: number; // 24, 30, 36
  planName: string;
  costoPlan: number;
  mensualidadEquipo: number;
  mensualidadTotal: number; // mensualidadEquipo + costoPlan (at 50% down payment)
  mensualidadEquipoSinEnganche: number;
  mensualidadTotalSinEnganche: number;
  sucursal: string;
  eventBadge?: string;
  campaignThemeId?: string; // 'fiestas-patrias' | 'buen-fin' | 'navidad' | 'lanzamientos' | 'mes-actual' | 'aniversario' | 'regreso-clases' | 'custom';
  campaignThemeName?: string;
  themeStyle?: 'modern-friendly' | 'cyber-blue' | 'retail-pop' | 'titanium-dark' | 'fiestas-patrias' | 'buen-fin' | 'navidad';
  aspectRatio?: '1:1' | '4:5';
  precioContado?: number;
  esMenor30Contado?: boolean;
  tipoPagoInicial?: 'rentas_adelantadas' | 'enganche';
  numRentasAdelantadas?: number;
  montoRentasAdelantadas?: number;
  pagoInicialMinimo?: number;
}

/**
 * Checks if TikTok is included in the plan.
 * Per official rule: TikTok is included ONLY ABOVE Plan Azul 3 (Plata, Oro, Black, Platino, Diamante).
 * Azul 1, Azul 2, and Azul 3 do NOT include TikTok.
 */
export function isTikTokIncludedInPlan(planName: string, costoPlan: number): boolean {
  const p = (planName || '').toUpperCase();
  if (
    p.includes('AZUL 1') ||
    p.includes('AZUL 2') ||
    p.includes('AZUL 3') ||
    p.includes('AZUL1') ||
    p.includes('AZUL2') ||
    p.includes('AZUL3')
  ) {
    return false;
  }
  if (
    p.includes('PLATA') ||
    p.includes('ORO') ||
    p.includes('BLACK') ||
    p.includes('PLATINO') ||
    p.includes('DIAMANTE')
  ) {
    return true;
  }
  return Number(costoPlan || 0) > 550;
}

/**
 * Calculates all official advertising numbers for Facebook creatives
 * Applying the exact same official AT&T Golden Rule as the Quoter.
 */
export function calculateAdFinancials(
  record: DevicePriceRecord,
  sucursal: string = 'AT&T Alsuper Robinson',
  eventBadge: string = 'OFERTA DESTACADA',
  campaignThemeId: string = 'mes-actual',
  overrideContado?: number
): FacebookAdData {
  const promo = Number(record.precioPromocion || 0);
  const plazo = Number(record.plazo || 36);
  const costoPlan = Number(record.costoPlan || 0);

  // Exact Down Payment Formulas
  const engancheMinimo = Math.round((promo * 0.10) * 100) / 100;
  const engancheMaximo = Math.round((promo * 0.50) * 100) / 100;

  // Regla de Oro: Rentas por Adelantado vs Enganche
  // Resolve official cash price accurately
  const recordedContado = Number(record.precioContado || 0);
  const effectiveContado = overrideContado && overrideContado > 0
    ? overrideContado
    : recordedContado > 0
      ? recordedContado
      : Math.round(promo * 1.25);

  const umbral30 = Math.round(effectiveContado * 0.30 * 100) / 100;
  const esMenor30Contado = effectiveContado > 0 && promo < umbral30;
  const tipoPagoInicial: 'rentas_adelantadas' | 'enganche' = esMenor30Contado ? 'rentas_adelantadas' : 'enganche';
  const numRentasAdelantadas = esMenor30Contado ? 3 : 0;
  const montoRentasAdelantadas = esMenor30Contado ? Math.round(3 * costoPlan * 100) / 100 : 0;
  const pagoInicialMinimo = esMenor30Contado ? montoRentasAdelantadas : engancheMaximo;

  // Saldo a financiar y mensualidades según la modalidad oficial exigida:
  // Si promo < 30% contado: $0 enganche de equipo, se financia el 100% de promo
  // Si promo >= 30% contado: 50% de enganche, se financia el 50% restante
  const saldoFinanciado = esMenor30Contado ? promo : Math.max(0, promo - engancheMaximo);
  const mensualidadEquipo = plazo > 0 ? Math.round((saldoFinanciado / plazo) * 100) / 100 : 0;
  const mensualidadTotal = Math.round((mensualidadEquipo + costoPlan) * 100) / 100;

  const mensualidadEquipoSinEnganche = plazo > 0 ? Math.round((promo / plazo) * 100) / 100 : 0;
  const mensualidadTotalSinEnganche = Math.round((mensualidadEquipoSinEnganche + costoPlan) * 100) / 100;

  return {
    id: record.id,
    brand: (record.brand || 'AT&T').toUpperCase(),
    model: record.model,
    storage: record.storage,
    precioLista: effectiveContado > promo ? effectiveContado : Math.round(promo * 1.25),
    precioPromocion: promo,
    engancheMinimo,
    engancheMaximo,
    plazo,
    planName: record.planNombre || 'Ármalo',
    costoPlan,
    mensualidadEquipo,
    mensualidadTotal,
    mensualidadEquipoSinEnganche,
    mensualidadTotalSinEnganche,
    sucursal,
    eventBadge,
    campaignThemeId,
    campaignThemeName: eventBadge,
    themeStyle: 'modern-friendly',
    aspectRatio: '1:1',
    precioContado: effectiveContado,
    esMenor30Contado,
    tipoPagoInicial,
    numRentasAdelantadas,
    montoRentasAdelantadas,
    pagoInicialMinimo,
  };
}

/**
 * Helper to draw a rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Helper to truncate text if too long
 */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

/**
 * Draw decorative theme atmosphere elements based on campaign theme
 */
function drawThemeAtmosphere(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  themeId: string
): void {
  ctx.save();

  if (themeId === 'halloween') {
    // 🎃 HALLOWEEN / OCTUBRE: Glowing orange spooky orbs, purple bats, jack-o-lantern sparks
    const halloweenColors = ['#f97316', '#a855f7', '#fb923c', '#c084fc', '#ea580c', '#ffffff'];
    for (let i = 0; i < 50; i++) {
      const sx = (i * 79 + 37) % (width - 80) + 40;
      const sy = (i * 101 + 29) % (height - 120) + 60;
      const size = 3 + (i % 5);
      ctx.fillStyle = halloweenColors[i % halloweenColors.length];
      ctx.globalAlpha = 0.55;
      if (i % 4 === 0) {
        // Little glowing ghost/bat silhouettes
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((i * 45 * Math.PI) / 180);
        ctx.fillRect(-size, -size / 2, size * 2.4, size);
        ctx.restore();
      }
    }
  } else if (themeId === 'dia-de-muertos') {
    // 💀 DÍA DE MUERTOS / NOVIEMBRE: Cempasúchil bright orange & marigold yellow petals, deep magenta
    const cempasuchilColors = ['#f97316', '#fbbf24', '#f59e0b', '#ec4899', '#f43f5e', '#ffffff'];
    for (let i = 0; i < 48; i++) {
      const sx = (i * 71 + 43) % (width - 80) + 40;
      const sy = (i * 97 + 31) % (height - 120) + 60;
      const size = 3.5 + (i % 4);
      ctx.fillStyle = cempasuchilColors[i % cempasuchilColors.length];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (themeId === 'otono') {
    // 🍂 OTOÑO / OCTUBRE: Falling warm amber leaves and golden embers
    const otonoColors = ['#f59e0b', '#d97706', '#b45309', '#ea580c', '#fbbf24', '#ffffff'];
    for (let i = 0; i < 46; i++) {
      const sx = (i * 73 + 41) % (width - 80) + 40;
      const sy = (i * 97 + 33) % (height - 120) + 60;
      const size = 3 + (i % 4);
      ctx.fillStyle = otonoColors[i % otonoColors.length];
      ctx.globalAlpha = 0.55;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((i * 40 * Math.PI) / 180);
      ctx.fillRect(-size, -size / 2, size * 2.2, size * 1.2);
      ctx.restore();
    }
  } else if (themeId === 'cyber-octubre') {
    // ⚡ CYBER OCTUBRE: Electric cyan and neon violet pulses
    const cyberColors = ['#00e5ff', '#a855f7', '#38bdf8', '#c084fc', '#ffffff'];
    for (let i = 0; i < 48; i++) {
      const sx = (i * 67 + 53) % (width - 80) + 40;
      const sy = (i * 89 + 37) % (height - 120) + 60;
      const size = 2.5 + (i % 4);
      ctx.fillStyle = cyberColors[i % cyberColors.length];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (themeId === 'fiestas-patrias') {
    // 🇲🇽 MEXICAN FIESTAS PATRIAS: Tricolor celebratory confetti, gold ribbons, stars
    const colors = ['#10b981', '#ffffff', '#ef4444', '#fbbf24', '#059669', '#dc2626'];
    for (let i = 0; i < 48; i++) {
      const sx = (i * 73 + 47) % (width - 80) + 40;
      const sy = (i * 97 + 31) % (height - 120) + 60;
      const size = 3 + (i % 4);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.55;
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((i * 30 * Math.PI) / 180);
        ctx.fillRect(-size, -size / 2, size * 2.2, size * 1.2);
        ctx.restore();
      }
    }
  } else if (themeId === 'buen-fin' || themeId === 'preventa-buen-fin') {
    // 🛍️ BUEN FIN / PREVENTA: Explosive gold grid lines & glowing bursts
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.12)';
    ctx.lineWidth = 1.5;
    for (let x = 60; x < width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    const goldBurst = ctx.createRadialGradient(width - 60, 60, 10, width - 60, 60, 420);
    goldBurst.addColorStop(0, 'rgba(234, 179, 8, 0.35)');
    goldBurst.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = goldBurst;
    ctx.fillRect(0, 0, width, height);
  } else if (themeId === 'navidad') {
    // 🎄 NAVIDAD: Soft snow crystal dots and golden starry glow
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 55; i++) {
      const sx = (i * 89 + 23) % width;
      const sy = (i * 113 + 51) % height;
      const radius = 1.5 + (i % 3) * 0.9;
      ctx.globalAlpha = 0.3 + (i % 4) * 0.15;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 🚀 LANZAMIENTOS / MODERN TECH: Ambient neon glowing grid and cyber accents
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    for (let dx = 45; dx < width - 45; dx += 45) {
      for (let dy = 45; dy < height - 45; dy += 45) {
        ctx.beginPath();
        ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Draw a stylized smartphone mockup directly on canvas for visual appeal
 */
function drawPhoneMockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brand: string,
  hasTikTok: boolean
): void {
  ctx.save();

  // Drop shadow for phone
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 16;

  // Outer bezel frame
  const frameGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  frameGrad.addColorStop(0, '#64748b');
  frameGrad.addColorStop(0.25, '#1e293b');
  frameGrad.addColorStop(0.75, '#0f172a');
  frameGrad.addColorStop(1, '#475569');
  ctx.fillStyle = frameGrad;
  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Thin metallic border
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.stroke();

  // Screen inner area
  const screenPad = 7;
  const screenX = x + screenPad;
  const screenY = y + screenPad;
  const screenW = w - screenPad * 2;
  const screenH = h - screenPad * 2;

  const screenGrad = ctx.createLinearGradient(screenX, screenY, screenX, screenY + screenH);
  screenGrad.addColorStop(0, '#020617');
  screenGrad.addColorStop(0.35, '#03396c');
  screenGrad.addColorStop(0.75, '#0077b6');
  screenGrad.addColorStop(1, '#0096c7');
  ctx.fillStyle = screenGrad;
  drawRoundedRect(ctx, screenX, screenY, screenW, screenH, 20);
  ctx.fill();

  // Glass reflection diagonal sheen
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, screenX, screenY, screenW, screenH, 20);
  ctx.clip();

  const sheenGrad = ctx.createLinearGradient(screenX, screenY, screenX + screenW, screenY + screenH);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
  sheenGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.06)');
  sheenGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(screenX, screenY, screenW, screenH);

  // Dynamic Island / Camera Notch on top
  const notchW = w * 0.36;
  const notchH = 10;
  const notchX = x + (w - notchW) / 2;
  ctx.fillStyle = '#020617';
  drawRoundedRect(ctx, notchX, screenY + 4, notchW, notchH, 5);
  ctx.fill();

  // Screen content: 5G Badge
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('5G', screenX + screenW / 2, screenY + screenH * 0.38);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('RED AT&T', screenX + screenW / 2, screenY + screenH * 0.49);

  // If TikTok included, draw mini badge on screen
  if (hasTikTok) {
    ctx.fillStyle = '#000000';
    drawRoundedRect(ctx, screenX + screenW / 2 - 32, screenY + screenH * 0.60, 64, 22, 9);
    ctx.fill();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.font = '900 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('♪ TIKTOK', screenX + screenW / 2, screenY + screenH * 0.60 + 15);
  }

  // Pulse rings on screen
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(screenX + screenW / 2, screenY + screenH * 0.36, 30, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

/**
 * Render high-impact, visually compelling Facebook & Instagram Ad on HTML5 Canvas.
 * DRAMATICALLY HIGHLIGHTS:
 * 1. PRECIO DE PROMOCIÓN ACTUAL (Hero badge & card)
 * 2. PAGO INICIAL (3 Rentas por Adelantado vs 50% Enganche)
 * 3. MENSUALIDAD TOTAL (Giant 96px unmissable centerpiece)
 */
export function renderFacebookAdToCanvas(
  canvas: HTMLCanvasElement,
  data: FacebookAdData,
  targetWidth = 1080
): void {
  const isSquare = data.aspectRatio !== '4:5';
  const width = 1080;
  const height = isSquare ? 1080 : 1350;
  const scale = targetWidth / width;

  canvas.width = targetWidth;
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  const themeId = data.campaignThemeId || 'mes-actual';
  const hasTikTok = isTikTokIncludedInPlan(data.planName, data.costoPlan);

  // =========================================================================
  // 1. DYNAMIC HIGH-IMPACT THEME BACKGROUND
  // =========================================================================
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);

  if (themeId === 'halloween') {
    // 🎃 Halloween / Octubre: Mystic Midnight Violet & Spooky Pumpkin Orange
    bgGrad.addColorStop(0, '#0d021a');
    bgGrad.addColorStop(0.35, '#1e0736');
    bgGrad.addColorStop(0.70, '#2b0f14');
    bgGrad.addColorStop(1, '#08010f');
  } else if (themeId === 'dia-de-muertos') {
    // 💀 Día de Muertos / Noviembre: Royal Deep Plum & Marigold Orange
    bgGrad.addColorStop(0, '#10021c');
    bgGrad.addColorStop(0.35, '#230728');
    bgGrad.addColorStop(0.70, '#2d1405');
    bgGrad.addColorStop(1, '#080112');
  } else if (themeId === 'fiestas-patrias') {
    // 🇲🇽 Fiestas Patrias: Rich Mexican Navy with deep green & red aura
    bgGrad.addColorStop(0, '#03140e');
    bgGrad.addColorStop(0.35, '#071d2b');
    bgGrad.addColorStop(0.70, '#1c0a12');
    bgGrad.addColorStop(1, '#050a12');
  } else if (themeId === 'buen-fin') {
    // 🛍️ Buen Fin: Intense luxury dark carbon & hot neon gold
    bgGrad.addColorStop(0, '#05070a');
    bgGrad.addColorStop(0.4, '#121217');
    bgGrad.addColorStop(0.75, '#1e1405');
    bgGrad.addColorStop(1, '#08080a');
  } else if (themeId === 'navidad') {
    // 🎄 Navidad: Royal midnight navy & frosty sapphire
    bgGrad.addColorStop(0, '#020b1c');
    bgGrad.addColorStop(0.4, '#071e3d');
    bgGrad.addColorStop(0.8, '#0b162c');
    bgGrad.addColorStop(1, '#040914');
  } else {
    // 🚀 Default / Lanzamientos / Mes en curso: High-contrast Tech Navy
    bgGrad.addColorStop(0, '#020817');
    bgGrad.addColorStop(0.3, '#071a36');
    bgGrad.addColorStop(0.7, '#0a254a');
    bgGrad.addColorStop(1, '#030b1a');
  }

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Vibrant ambient glowing light orbs for depth & energy
  if (themeId === 'halloween') {
    const orangeOrb = ctx.createRadialGradient(150, 160, 20, 150, 160, 520);
    orangeOrb.addColorStop(0, 'rgba(249, 115, 22, 0.42)');
    orangeOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orangeOrb;
    ctx.fillRect(0, 0, width, height);

    const purpleOrb = ctx.createRadialGradient(width - 150, height - 200, 30, width - 150, height - 200, 520);
    purpleOrb.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
    purpleOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = purpleOrb;
    ctx.fillRect(0, 0, width, height);
  } else if (themeId === 'dia-de-muertos') {
    const marigoldOrb = ctx.createRadialGradient(width * 0.8, 160, 20, width * 0.8, 160, 500);
    marigoldOrb.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
    marigoldOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = marigoldOrb;
    ctx.fillRect(0, 0, width, height);
  } else if (themeId === 'fiestas-patrias') {
    const greenOrb = ctx.createRadialGradient(150, 150, 20, 150, 150, 520);
    greenOrb.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    greenOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = greenOrb;
    ctx.fillRect(0, 0, width, height);

    const redOrb = ctx.createRadialGradient(width - 150, height - 200, 30, width - 150, height - 200, 520);
    redOrb.addColorStop(0, 'rgba(239, 68, 68, 0.30)');
    redOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = redOrb;
    ctx.fillRect(0, 0, width, height);
  } else if (themeId === 'buen-fin') {
    const goldOrb = ctx.createRadialGradient(width * 0.8, 160, 20, width * 0.8, 160, 500);
    goldOrb.addColorStop(0, 'rgba(234, 179, 8, 0.38)');
    goldOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = goldOrb;
    ctx.fillRect(0, 0, width, height);
  } else {
    const cyanOrb = ctx.createRadialGradient(width * 0.85, 140, 20, width * 0.85, 140, 500);
    cyanOrb.addColorStop(0, 'rgba(0, 168, 232, 0.35)');
    cyanOrb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cyanOrb;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw atmosphere sparkles / confetti
  drawThemeAtmosphere(ctx, width, height, themeId);

  // Outer Glowing Border
  const outerBorderColor =
    themeId === 'halloween'
      ? '#f97316'
      : themeId === 'dia-de-muertos'
        ? '#fbbf24'
        : themeId === 'otono'
          ? '#f59e0b'
          : themeId === 'cyber-octubre'
            ? '#00e5ff'
            : themeId === 'preventa-buen-fin'
              ? '#eab308'
              : themeId === 'fiestas-patrias'
                ? 'rgba(16, 185, 129, 0.7)'
                : themeId === 'buen-fin'
                  ? '#eab308'
                  : 'rgba(56, 189, 248, 0.7)';

  ctx.strokeStyle = outerBorderColor;
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 32);
  ctx.stroke();

  // =========================================================================
  // 2. THEME HEADER: AT&T + SUCURSAL + EVENT BADGE
  // =========================================================================
  const headerY = 36;
  const headerH = 78;

  // Header Pill
  const headerGrad = ctx.createLinearGradient(40, headerY, width - 40, headerY);
  headerGrad.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
  headerGrad.addColorStop(0.5, 'rgba(8, 28, 60, 0.98)');
  headerGrad.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
  ctx.fillStyle = headerGrad;
  drawRoundedRect(ctx, 40, headerY, width - 80, headerH, 22);
  ctx.fill();

  ctx.strokeStyle =
    themeId === 'halloween'
      ? '#f97316'
      : themeId === 'dia-de-muertos'
        ? '#fbbf24'
        : themeId === 'otono'
          ? '#f59e0b'
          : themeId === 'cyber-octubre'
            ? '#00e5ff'
            : themeId === 'preventa-buen-fin'
              ? '#eab308'
              : themeId === 'fiestas-patrias'
                ? '#10b981'
                : themeId === 'buen-fin'
                  ? '#eab308'
                  : '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // AT&T Globe Icon
  const globeX = 82;
  const globeY = headerY + headerH / 2;
  const globeGrad = ctx.createRadialGradient(globeX - 3, globeY - 3, 2, globeX, globeY, 22);
  globeGrad.addColorStop(0, '#38bdf8');
  globeGrad.addColorStop(0.6, '#0284c7');
  globeGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = globeGrad;
  ctx.beginPath();
  ctx.arc(globeX, globeY, 22, 0, Math.PI * 2);
  ctx.fill();

  // Globe white rings
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(globeX, globeY, 13, 0.25, Math.PI * 1.6);
  ctx.stroke();

  // Brand Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AT&T', 118, globeY + 10);

  // SUCURSAL BADGE (Prominent: "Sucursal Alsuper Robinson")
  ctx.fillStyle = themeId === 'halloween' ? '#fb923c' : themeId === 'otono' ? '#fde047' : '#fde047';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(`📍 ${data.sucursal.toUpperCase()}`, 198, globeY + 8);

  // Event Theme Ribbon on right side of header
  let eventText = (data.eventBadge || '🔥 LANZAMIENTO DESTACADO').toUpperCase();
  if (themeId === 'halloween') eventText = '🎃 ESPECIAL HALLOWEEN 🎃';
  else if (themeId === 'dia-de-muertos') eventText = '💀 DÍA DE MUERTOS 💀';
  else if (themeId === 'otono') eventText = '🍂 ESPECIAL OTOÑO 🍂';
  else if (themeId === 'cyber-octubre') eventText = '⚡ CYBER OCTUBRE ⚡';
  else if (themeId === 'preventa-buen-fin') eventText = '🛍️ PREVENTA BUEN FIN 🛍️';
  else if (themeId === 'fiestas-patrias') eventText = '🇲🇽 FIESTAS PATRIAS 🇲🇽';
  else if (themeId === 'buen-fin') eventText = '🛍️ GRAN VENTA BUEN FIN';
  else if (themeId === 'navidad') eventText = '🎄 ESPECIAL NAVIDEÑO';

  ctx.font = '900 14px system-ui, -apple-system, sans-serif';
  const tagW = ctx.measureText(eventText).width + 36;
  const tagX = width - 60 - tagW;
  const tagY = headerY + 16;
  const tagH = 46;

  const tagGrad = ctx.createLinearGradient(tagX, tagY, tagX + tagW, tagY);
  if (themeId === 'halloween') {
    tagGrad.addColorStop(0, '#ea580c');
    tagGrad.addColorStop(0.5, '#7e22ce');
    tagGrad.addColorStop(1, '#f97316');
  } else if (themeId === 'dia-de-muertos') {
    tagGrad.addColorStop(0, '#f59e0b');
    tagGrad.addColorStop(0.5, '#db2777');
    tagGrad.addColorStop(1, '#ea580c');
  } else if (themeId === 'otono') {
    tagGrad.addColorStop(0, '#d97706');
    tagGrad.addColorStop(0.5, '#b45309');
    tagGrad.addColorStop(1, '#f59e0b');
  } else if (themeId === 'cyber-octubre') {
    tagGrad.addColorStop(0, '#0284c7');
    tagGrad.addColorStop(0.5, '#9333ea');
    tagGrad.addColorStop(1, '#06b6d4');
  } else if (themeId === 'preventa-buen-fin') {
    tagGrad.addColorStop(0, '#b45309');
    tagGrad.addColorStop(0.5, '#eab308');
    tagGrad.addColorStop(1, '#d97706');
  } else if (themeId === 'fiestas-patrias') {
    tagGrad.addColorStop(0, '#10b981');
    tagGrad.addColorStop(0.5, '#ffffff');
    tagGrad.addColorStop(1, '#ef4444');
  } else if (themeId === 'buen-fin') {
    tagGrad.addColorStop(0, '#eab308');
    tagGrad.addColorStop(1, '#dc2626');
  } else {
    tagGrad.addColorStop(0, '#0284c7');
    tagGrad.addColorStop(1, '#06b6d4');
  }
  ctx.fillStyle = tagGrad;
  drawRoundedRect(ctx, tagX, tagY, tagW, tagH, 14);
  ctx.fill();

  ctx.fillStyle = themeId === 'fiestas-patrias' ? '#000000' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(eventText, tagX + tagW / 2, tagY + 28);

  // =========================================================================
  // 3. HERO SHOWCASE CARD: PHONE MODEL & STYLIZED MOCKUP
  // =========================================================================
  const showcaseY = 126;
  const showcaseH = isSquare ? 175 : 205;

  const cardGrad = ctx.createLinearGradient(40, showcaseY, width - 40, showcaseY + showcaseH);
  cardGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
  cardGrad.addColorStop(0.5, 'rgba(10, 32, 64, 0.98)');
  cardGrad.addColorStop(1, 'rgba(8, 20, 44, 0.95)');
  ctx.fillStyle = cardGrad;
  drawRoundedRect(ctx, 40, showcaseY, width - 80, showcaseH, 26);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // LEFT SIDE OF SHOWCASE: Brand, Storage, Model
  const textLeftX = 70;

  // Brand Pill
  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
  drawRoundedRect(ctx, textLeftX, showcaseY + 16, 150, 32, 12);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`●  ${data.brand}`, textLeftX + 75, showcaseY + 37);

  // Storage badge next to brand
  if (data.storage) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    drawRoundedRect(ctx, textLeftX + 162, showcaseY + 16, 96, 32, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(data.storage, textLeftX + 210, showcaseY + 37);
  }

  // 5G Network Pill
  const networkX = data.storage ? textLeftX + 270 : textLeftX + 162;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  drawRoundedRect(ctx, networkX, showcaseY + 16, 110, 32, 12);
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#34d399';
  ctx.font = '900 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('⚡ RED 5G', networkX + 55, showcaseY + 37);

  // Model Name (BIG & BOLD: 42px)
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  const modelName = truncate(ctx, data.model, width - 380);
  ctx.fillText(modelName, textLeftX, showcaseY + 95);

  // Active Plan & Plazo subtitle
  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Plan AT&T ${data.planName} ($${data.costoPlan}/mes) • Plazo a ${data.plazo} Meses`,
    textLeftX,
    showcaseY + 130
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('✨ Equipo 100% Nuevo & Sellado • Garantía Oficial de Fábrica', textLeftX, showcaseY + 155);

  // RIGHT SIDE OF SHOWCASE: Stylized Phone Vector Mockup
  const phoneW = 108;
  const phoneH = showcaseH - 28;
  const phoneX = width - 40 - phoneW - 32;
  const phoneY = showcaseY + 14;
  drawPhoneMockup(ctx, phoneX, phoneY, phoneW, phoneH, data.brand, hasTikTok);

  // =========================================================================
  // 4. THE TWO HERO HIGHLIGHTED PILLARS:
  //    PILLAR 1: PRECIO DE PROMOCIÓN ACTUAL (DRAMATICALLY HIGHLIGHTED)
  //    PILLAR 2: PAGO INICIAL REQUERIDO (DRAMATICALLY HIGHLIGHTED)
  // =========================================================================
  const pillarsY = showcaseY + showcaseH + 16;
  const pillarGap = 18;
  const pillarW = (width - 80 - pillarGap) / 2;
  const pillarH = isSquare ? 186 : 210;

  // -------------------------------------------------------------------------
  // PILLAR 1: PRECIO DE PROMOCIÓN ACTUAL (LEFT)
  // -------------------------------------------------------------------------
  const p1X = 40;
  const p1Grad = ctx.createLinearGradient(p1X, pillarsY, p1X + pillarW, pillarsY + pillarH);
  p1Grad.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
  p1Grad.addColorStop(0.5, 'rgba(6, 78, 59, 0.28)');
  p1Grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = p1Grad;
  drawRoundedRect(ctx, p1X, pillarsY, pillarW, pillarH, 24);
  ctx.fill();

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Pillar 1 Header Badge
  const p1BadgeText = '🔥 PRECIO DE PROMOCIÓN ACTUAL';
  ctx.font = '900 16px system-ui, -apple-system, sans-serif';
  const p1BadgeW = ctx.measureText(p1BadgeText).width + 32;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
  drawRoundedRect(ctx, p1X + (pillarW - p1BadgeW) / 2, pillarsY + 16, p1BadgeW, 30, 12);
  ctx.fill();
  ctx.fillStyle = '#6ee7b7';
  ctx.textAlign = 'center';
  ctx.fillText(p1BadgeText, p1X + pillarW / 2, pillarsY + 36);

  // Pillar 1: Giant Promotional Price ($X,XXX)
  const promoFormatted = `$${Number(data.precioPromocion).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 50px system-ui, -apple-system, sans-serif';
  ctx.fillText(promoFormatted, p1X + pillarW / 2, pillarsY + 92);

  // Regular Price Strikethrough
  const regularPrice = Number(data.precioContado || data.precioLista || 0);
  if (regularPrice > data.precioPromocion) {
    const regText = `Precio de Contado: $${regularPrice.toLocaleString('es-MX')}`;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(regText, p1X + pillarW / 2, pillarsY + 128);

    const regWidth = ctx.measureText(regText).width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p1X + pillarW / 2 - regWidth / 2 - 4, pillarsY + 123);
    ctx.lineTo(p1X + pillarW / 2 + regWidth / 2 + 4, pillarsY + 123);
    ctx.stroke();

    const savings = Math.max(0, regularPrice - data.precioPromocion);
    ctx.fillStyle = '#34d399';
    ctx.font = '800 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`¡Ahorro directo de $${savings.toLocaleString('es-MX')} en este plan!`, p1X + pillarW / 2, pillarsY + 158);
  } else {
    ctx.fillStyle = '#34d399';
    ctx.font = '800 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('¡Costo subsidiado en este plan!', p1X + pillarW / 2, pillarsY + 134);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('Sin sobreprecio comercial', p1X + pillarW / 2, pillarsY + 158);
  }

  // -------------------------------------------------------------------------
  // PILLAR 2: PAGO INICIAL REQUERIDO (RIGHT)
  // -------------------------------------------------------------------------
  const p2X = 40 + pillarW + pillarGap;
  const isRentasAdelantadas = data.esMenor30Contado;

  const p2Grad = ctx.createLinearGradient(p2X, pillarsY, p2X + pillarW, pillarsY + pillarH);
  if (isRentasAdelantadas) {
    p2Grad.addColorStop(0, 'rgba(2, 132, 199, 0.22)');
    p2Grad.addColorStop(0.5, 'rgba(3, 105, 161, 0.32)');
    p2Grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  } else {
    p2Grad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    p2Grad.addColorStop(0.5, 'rgba(5, 150, 105, 0.32)');
    p2Grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  }
  ctx.fillStyle = p2Grad;
  drawRoundedRect(ctx, p2X, pillarsY, pillarW, pillarH, 24);
  ctx.fill();

  ctx.strokeStyle = isRentasAdelantadas ? '#0284c7' : '#10b981';
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Pillar 2 Header Badge
  const p2BadgeText = isRentasAdelantadas
    ? '⭐ PAGO INICIAL (3 RENTAS)'
    : '💳 PAGO INICIAL (ENGANCHE 50%)';

  ctx.font = '900 16px system-ui, -apple-system, sans-serif';
  const p2BadgeW = ctx.measureText(p2BadgeText).width + 32;
  ctx.fillStyle = isRentasAdelantadas ? 'rgba(2, 132, 199, 0.35)' : 'rgba(16, 185, 129, 0.35)';
  drawRoundedRect(ctx, p2X + (pillarW - p2BadgeW) / 2, pillarsY + 16, p2BadgeW, 30, 12);
  ctx.fill();

  ctx.fillStyle = isRentasAdelantadas ? '#7dd3fc' : '#6ee7b7';
  ctx.textAlign = 'center';
  ctx.fillText(p2BadgeText, p2X + pillarW / 2, pillarsY + 36);

  // Pillar 2: Giant Initial Payment Price
  const initialPaymentValue = isRentasAdelantadas
    ? Number(data.montoRentasAdelantadas || data.costoPlan * 3)
    : Number(data.engancheMaximo);

  const initialFormatted = `$${initialPaymentValue.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  ctx.fillStyle = isRentasAdelantadas ? '#38bdf8' : '#34d399';
  ctx.font = '900 50px system-ui, -apple-system, sans-serif';
  ctx.fillText(initialFormatted, p2X + pillarW / 2, pillarsY + 92);

  // Reassurance sub-tag
  if (isRentasAdelantadas) {
    ctx.fillStyle = '#fde047';
    ctx.font = '900 17px system-ui, -apple-system, sans-serif';
    ctx.fillText('¡$0.00 ENGANCHE DE EQUIPO!', p2X + pillarW / 2, pillarsY + 128);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`3 rentas de $${data.costoPlan}/m • No piden enganche`, p2X + pillarW / 2, pillarsY + 158);
  } else {
    ctx.fillStyle = '#fde047';
    ctx.font = '900 17px system-ui, -apple-system, sans-serif';
    ctx.fillText('¡SIN RENTAS POR ADELANTADO!', p2X + pillarW / 2, pillarsY + 128);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('Pago inicial único para entrega inmediata', p2X + pillarW / 2, pillarsY + 158);
  }

  // =========================================================================
  // 5. HERO CENTERPIECE: MENSUALIDAD TOTAL (HUGE 100px & UNMISSABLE)
  // =========================================================================
  const heroY = pillarsY + pillarH + 16;
  const heroH = isSquare ? 230 : 270;

  const heroGrad = ctx.createLinearGradient(40, heroY, width - 40, heroY + heroH);
  heroGrad.addColorStop(0, 'rgba(4, 28, 56, 0.98)');
  heroGrad.addColorStop(0.5, 'rgba(9, 48, 92, 0.99)');
  heroGrad.addColorStop(1, 'rgba(4, 20, 44, 0.98)');
  ctx.fillStyle = heroGrad;
  drawRoundedRect(ctx, 40, heroY, width - 80, heroH, 30);
  ctx.fill();

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // Top Badge inside hero: "MENSUALIDAD TOTAL CON EQUIPO Y PLAN INCLUIDO"
  const badgeText = '✦ MENSUALIDAD TOTAL CON EQUIPO Y PLAN INCLUIDO ✦';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 40;
  const badgeX = (width - badgeW) / 2;
  const badgeY = heroY + 18;

  ctx.fillStyle = 'rgba(16, 185, 129, 0.32)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, 36, 18);
  ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = '#6ee7b7';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, width / 2, badgeY + 25);

  // Giant Monthly Price: e.g. "$749.50" + "/ mes" (HUGE 100px)
  const formattedMonthly = `$${Number(data.mensualidadTotal).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  ctx.fillStyle = '#10b981';
  ctx.font = '900 100px system-ui, -apple-system, sans-serif';
  const monthlyTextWidth = ctx.measureText(formattedMonthly).width;
  ctx.textAlign = 'left';
  const priceStartX = (width - monthlyTextWidth - 130) / 2;
  const priceBaselineY = heroY + (isSquare ? 134 : 150);
  ctx.fillText(formattedMonthly, priceStartX, priceBaselineY);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText('/ mes', priceStartX + monthlyTextWidth + 18, priceBaselineY - 8);

  // Subtitle explaining breakdown
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Equipo financiado ($${data.mensualidadEquipo.toFixed(2)}) + Plan AT&T ${data.planName} ($${data.costoPlan}/m) • Plazo a ${data.plazo} Meses`,
    width / 2,
    priceBaselineY + 42
  );

  // Reassurance sub-tag inside hero
  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('¡Mensualidad fija congelada durante todo tu contrato sin incrementos!', width / 2, priceBaselineY + 70);

  // =========================================================================
  // 6. PLAN BENEFITS RIBBON (EXPLICIT OFFICIAL BENEFITS)
  // "REDES SOCIALES ILIMITADAS, TIKTOK INCLUIDO" (TikTok solo arriba de Azul 3)
  // "LLAMADAS Y MENSAJES ILIMITADOS EN MÉXICO, ESTADOS UNIDOS Y CANADÁ"
  // =========================================================================
  const benefitsY = heroY + heroH + 16;
  const benefitsH = isSquare ? 120 : 155;

  const benefitsGrad = ctx.createLinearGradient(40, benefitsY, width - 40, benefitsY + benefitsH);
  benefitsGrad.addColorStop(0, 'rgba(15, 23, 42, 0.98)');
  benefitsGrad.addColorStop(0.5, 'rgba(8, 30, 60, 0.98)');
  benefitsGrad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
  ctx.fillStyle = benefitsGrad;
  drawRoundedRect(ctx, 40, benefitsY, width - 80, benefitsH, 24);
  ctx.fill();

  ctx.strokeStyle = hasTikTok ? '#06b6d4' : '#38bdf8';
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // LINE 1: REDES SOCIALES ILIMITADAS (+ TIKTOK INCLUIDO IF > AZUL 3)
  const line1Y = benefitsY + 40;
  ctx.textAlign = 'center';

  if (hasTikTok) {
    ctx.fillStyle = '#06b6d4';
    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('📱 REDES SOCIALES ILIMITADAS', width / 2 - 130, line1Y);

    const tiktokPillX = width / 2 + 75;
    const tiktokPillW = 230;
    const tiktokPillH = 36;
    ctx.fillStyle = '#000000';
    drawRoundedRect(ctx, tiktokPillX, line1Y - 26, tiktokPillW, tiktokPillH, 12);
    ctx.fill();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.font = '900 17px system-ui, -apple-system, sans-serif';
    ctx.fillText('🎵 TIKTOK INCLUIDO', tiktokPillX + tiktokPillW / 2, line1Y);
  } else {
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('📱 REDES SOCIALES ILIMITADAS (WHATSAPP, FB, IG, X)', width / 2, line1Y);
  }

  // LINE 2: LLAMADAS Y MENSAJES ILIMITADOS EN MÉXICO, ESTADOS UNIDOS Y CANADÁ
  const line2Y = benefitsY + 78;
  ctx.fillStyle = '#34d399';
  ctx.font = '900 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('📞 LLAMADAS Y MENSAJES ILIMITADOS EN MÉXICO, ESTADOS UNIDOS Y CANADÁ', width / 2, line2Y);

  // LINE 3: Requisitos claros
  const line3Y = benefitsY + 106;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('✓ Red 5G AT&T de Máxima Velocidad  •  ✓ Trámite en minutos con solo tu INE vigente', width / 2, line3Y);

  // =========================================================================
  // 7. BOTTOM STORE CALL TO ACTION
  // =========================================================================
  const footerY = benefitsY + benefitsH + 14;
  const footerH = height - footerY - 28;

  if (footerH > 35) {
    const footerGrad = ctx.createLinearGradient(40, footerY, width - 40, footerY + footerH);
    footerGrad.addColorStop(0, 'rgba(15, 23, 42, 0.98)');
    footerGrad.addColorStop(0.5, 'rgba(10, 32, 64, 0.98)');
    footerGrad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = footerGrad;
    drawRoundedRect(ctx, 40, footerY, width - 80, footerH, 20);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 21px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💬 ¡Cotiza por WhatsApp o Visítanos Hoy en ${data.sucursal.toUpperCase()}!`, width / 2, footerY + footerH / 2 + 7);
  }

  ctx.restore();
}

/**
 * Render high-resolution Facebook Ad on HTML5 Canvas
 */
export function generateFacebookAdCanvas(data: FacebookAdData, targetWidth = 1080): HTMLCanvasElement {
  const isSquare = data.aspectRatio !== '4:5';
  const width = 1080;
  const height = isSquare ? 1080 : 1350;
  const scale = targetWidth / width;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = Math.round(height * scale);
  renderFacebookAdToCanvas(canvas, data, targetWidth);
  return canvas;
}

/**
 * Download single ad as high-res PNG
 */
export async function downloadFacebookAdImage(data: FacebookAdData): Promise<void> {
  const canvas = generateFacebookAdCanvas(data, 1080);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) throw new Error('No se pudo generar el archivo PNG');

  const cleanName = `${data.brand}_${data.model}_Plan_${data.planName}_${data.plazo}m`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Publicidad_${cleanName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Copy ad image to system clipboard
 */
export async function copyFacebookAdToClipboard(data: FacebookAdData): Promise<boolean> {
  try {
    const canvas = generateFacebookAdCanvas(data, 1080);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return false;

    if (navigator.clipboard && (window as any).ClipboardItem) {
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({
          'image/png': blob,
        }),
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    return false;
  }
}

/**
 * Download batch of Facebook Ads as a ZIP archive in 1 Clic
 */
export async function downloadBatchFacebookAdsZip(
  ads: FacebookAdData[],
  zipFilename: string = 'Publicidad_ATT_Equipos.zip',
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('Publicidad_ATT');

  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i];
    const canvas = generateFacebookAdCanvas(ad, 1080);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );

    if (blob && folder) {
      const cleanName = `${String(i + 1).padStart(2, '0')}_${ad.brand}_${ad.model}_Plan_${ad.planName}_${ad.plazo}m`
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      folder.file(`${cleanName}.png`, blob);
    }

    if (onProgress) {
      onProgress(i + 1, ads.length);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
