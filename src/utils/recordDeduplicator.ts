import { DevicePriceRecord } from '../types/pricing';

/**
 * Validates if a record represents a genuine, active promotional offer.
 */
export function isValidActivePromoRecord(r: DevicePriceRecord | any): boolean {
  if (!r || !r.model) return false;
  const plan = (r.planNombre || '').trim().toUpperCase();
  if (!plan || plan === 'VIGENCIA' || plan === 'FECHA' || plan === 'TOTAL' || plan === 'MODELO') {
    return false;
  }
  const promo = Number(r.precioPromocion || 0);
  // Must have a positive promotional price and reasonable realistic ceiling (< 100,000 MXN)
  if (promo <= 0 || promo > 100000) return false;
  const cost = Number(r.costoPlan || 0);
  if (cost <= 0) return false;
  return true;
}

/**
 * Deduplicates device price records to ensure each device-plan-term combination
 * has a single authoritative record with the best promotional price and a strictly unique ID.
 */
export function deduplicateDeviceRecords(records: DevicePriceRecord[]): DevicePriceRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const map = new Map<string, DevicePriceRecord>();

  for (const r of records) {
    if (!isValidActivePromoRecord(r)) continue;

    const cleanBrand = (r.brand || '').trim().toLowerCase();
    const cleanModel = (r.model || '').trim().toLowerCase();
    const cleanStorage = (r.storage || '').trim().toLowerCase();
    const cleanPlan = (r.planNombre || '').trim().toLowerCase();
    const plazo = Number(r.plazo || 36);

    const baseKey = `${cleanBrand}-${cleanModel}${cleanStorage ? `-${cleanStorage}` : ''}-${cleanPlan}-${plazo}`
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_()]/g, '');

    const rPromo = Number(r.precioPromocion || 0);

    if (!map.has(baseKey)) {
      map.set(baseKey, {
        ...r,
        id: baseKey,
      });
    } else {
      const existing = map.get(baseKey)!;
      const exPromo = Number(existing.precioPromocion || 0);

      // Keep the record with the better (lower > 0) promotional price
      if (rPromo > 0 && (exPromo <= 0 || rPromo < exPromo)) {
        map.set(baseKey, {
          ...r,
          id: baseKey,
        });
      }
    }
  }

  // Ensure absolute uniqueness of all IDs
  const result: DevicePriceRecord[] = [];
  const seenIds = new Set<string>();

  for (const item of map.values()) {
    let finalId = item.id;
    let counter = 1;
    while (seenIds.has(finalId)) {
      finalId = `${item.id}-v${counter++}`;
    }
    seenIds.add(finalId);
    result.push({
      ...item,
      id: finalId,
    });
  }

  return result;
}

/**
 * Scores a model to determine how modern / flagship it is within its brand release lineup.
 * High scores = Latest Generation, Ultra, Pro Max, Pro, Fold, Flip, etc.
 */
export function scoreDeviceRelease(model: string, price: number): number {
  let score = 0;
  const m = model.toLowerCase();

  // Extract model generation number (e.g. 16, 15, 24, 50, 14, etc.)
  const numMatch = m.match(/\b(\d{1,3})\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    // Ignore storage numbers like 128, 256, 512
    if (num <= 100 && num !== 32 && num !== 64) {
      score += num * 120;
    }
  }

  // Flagship tier keywords
  if (m.includes('ultra')) score += 600;
  if (m.includes('pro max')) score += 550;
  if (m.includes('pro')) score += 350;
  if (m.includes('plus')) score += 220;
  if (m.includes('fold')) score += 500;
  if (m.includes('flip') || m.includes('razr')) score += 420;
  if (m.includes('edge')) score += 200;
  if (m.includes('magic')) score += 200;
  if (m.includes('reno')) score += 180;

  // Tie breaker by price (flagships cost more than legacy entry devices)
  score += Math.min(price / 80, 400);

  return score;
}

/**
 * Extracts ONLY the latest models launched per brand (default: 5 per brand),
 * as requested: "solo incluye los últimos modelos que han lanzado de cada marca, los últimos 5 por ejemplo".
 */
export function getLatestModelsPerBrand(
  records: DevicePriceRecord[],
  limitPerBrand: number = 5
): DevicePriceRecord[] {
  const activeRecords = deduplicateDeviceRecords(records);
  const brandGroups = new Map<string, Map<string, { record: DevicePriceRecord; score: number }>>();

  for (const r of activeRecords) {
    const brand = (r.brand || 'OTRA').toUpperCase().trim();
    if (!brandGroups.has(brand)) {
      brandGroups.set(brand, new Map());
    }

    const brandModels = brandGroups.get(brand)!;
    const score = scoreDeviceRelease(r.model, r.precioPromocion);
    const existing = brandModels.get(r.model);

    // Helper to calculate initial payment under official AT&T Golden Rule:
    // If promo < 30% contado -> 3 rentas por adelantado (3 * costoPlan)
    // De lo contrario -> 50% de enganche (0.50 * promo)
    const getInitialPayment = (rec: DevicePriceRecord) => {
      const promo = Number(rec.precioPromocion || 0);
      const contado = Number(rec.precioContado || 0) > 0 ? Number(rec.precioContado) : Math.round(promo * 1.25);
      const isUnder30 = contado > 0 && promo < 0.30 * contado;
      return isUnder30 ? Math.round(3 * rec.costoPlan * 100) / 100 : Math.round(0.50 * promo * 100) / 100;
    };

    // Pick the plan and plazo that requires the LEAST INITIAL PAYMENT for this model
    if (!existing) {
      brandModels.set(r.model, { record: r, score });
    } else {
      const currentInitial = getInitialPayment(r);
      const existingInitial = getInitialPayment(existing.record);
      if (
        currentInitial < existingInitial ||
        (currentInitial === existingInitial &&
          (r.mensualidadTotalConMaxEnganche || r.mensualidad) <
            (existing.record.mensualidadTotalConMaxEnganche || existing.record.mensualidad))
      ) {
        brandModels.set(r.model, { record: r, score });
      }
    }
  }

  const result: DevicePriceRecord[] = [];

  for (const [, modelsMap] of brandGroups) {
    const sortedForBrand = Array.from(modelsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limitPerBrand);

    for (const item of sortedForBrand) {
      result.push(item.record);
    }
  }

  // Sort overall by brand and then score descending
  return result.sort((a, b) => {
    if (a.brand.localeCompare(b.brand) !== 0) {
      // Prioritize Apple, Samsung, Motorola, Xiaomi
      const priority: Record<string, number> = {
        APPLE: 1,
        SAMSUNG: 2,
        MOTOROLA: 3,
        XIAOMI: 4,
        GOOGLE: 5,
        HONOR: 6,
        OPPO: 7,
      };
      const pA = priority[a.brand.toUpperCase()] || 99;
      const pB = priority[b.brand.toUpperCase()] || 99;
      if (pA !== pB) return pA - pB;
      return a.brand.localeCompare(b.brand);
    }
    return scoreDeviceRelease(b.model, b.precioPromocion) - scoreDeviceRelease(a.model, a.precioPromocion);
  });
}
