import * as XLSX from 'xlsx';
import { DevicePriceRecord, ATTPlan } from '../types/pricing';
import { loadPlans, addCustomPlan } from './plansService';
import { deduplicateDeviceRecords } from '../utils/recordDeduplicator';

export interface ExtractionResult {
  records: DevicePriceRecord[];
  targetSheetFound: boolean;
  targetSheetName: string;
  discardedSheets: string[];
  totalSheetsInFile: number;
  extractedPlans: ATTPlan[];
  warnings: string[];
}

const TARGET_SHEET_PATTERN = /promociones\s*(at&t|att)\s*premium/i;

// Clean numeric values from cells (handles "$", ",", " ", "MXN", "/mes")
export const cleanNumber = (val: unknown): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  if (!val) return 0;
  const str = String(val)
    .replace(/[^0-9.-]/g, '')
    .trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
};

// Helper to detect brand from model name
export const detectBrand = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('iphone') || lower.includes('apple') || lower.includes('ipad')) return 'Apple';
  if (lower.includes('samsung') || lower.includes('galaxy')) return 'Samsung';
  if (lower.includes('motorola') || lower.includes('moto')) return 'Motorola';
  if (lower.includes('xiaomi') || lower.includes('redmi') || lower.includes('poco')) return 'Xiaomi';
  if (lower.includes('honor')) return 'Honor';
  if (lower.includes('oppo')) return 'OPPO';
  if (lower.includes('vivo')) return 'Vivo';
  if (lower.includes('pixel') || lower.includes('google')) return 'Google';
  if (lower.includes('huawei')) return 'Huawei';
  if (lower.includes('zte')) return 'ZTE';
  if (lower.includes('realme')) return 'Realme';
  return 'AT&T';
};

// Known plan names mentioned by user
const KNOWN_PLAN_KEYWORDS = [
  'azul 1',
  'azul 2',
  'azul 3',
  'azul',
  'plata',
  'oro',
  'black',
  'platino',
  'diamante',
  'titanio',
  'premium',
  'ármalo',
  'armalo',
];

export const extractATTPriceList = (
  fileData: ArrayBuffer | Uint8Array,
  filename?: string
): ExtractionResult => {
  const warnings: string[] = [];
  
  // Read Excel binary
  const workbook = XLSX.read(fileData, { type: 'array', cellDates: true, cellNF: false });
  const allSheetNames = [...workbook.SheetNames];
  
  // 1. Locate the target sheet: "Promociones AT&T Premium"
  let matchedSheetName = workbook.SheetNames.find((name) =>
    TARGET_SHEET_PATTERN.test(name.trim())
  );

  if (!matchedSheetName) {
    matchedSheetName = workbook.SheetNames.find((name) =>
      /at&t.*premium|premium.*promocion/i.test(name.trim())
    );
  }

  if (!matchedSheetName) {
    if (workbook.SheetNames.length === 1) {
      matchedSheetName = workbook.SheetNames[0];
      warnings.push(
        `No se encontró la hoja con nombre exacto 'Promociones AT&T Premium'. Se procesó la única hoja disponible: '${matchedSheetName}'.`
      );
    } else {
      throw new Error(
        `El archivo no contiene la hoja obligatoria "Promociones AT&T Premium". Hojas encontradas en el archivo: ${allSheetNames.join(
          ', '
        )}`
      );
    }
  }

  // 2. DISCARD ALL OTHER SHEETS TO SAVE MEMORY AND SPACE
  // Explicitly required by user: "únicamente utilizarás la hoja 'Promociones AT&T Premium', las demás hojas no las necesitas, puedes deshacerte de ellas para ahorrar espacio"
  const discardedSheets = allSheetNames.filter((name) => name !== matchedSheetName);
  for (const sheetName of discardedSheets) {
    delete workbook.Sheets[sheetName];
  }
  workbook.SheetNames = [matchedSheetName];

  // Get sheet data
  const worksheet = workbook.Sheets[matchedSheetName];
  if (!worksheet) {
    throw new Error(`La hoja "${matchedSheetName}" está vacía o no se pudo cargar.`);
  }

  const rows: (string | number | boolean | null | undefined)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rows.length < 3) {
    throw new Error(`La hoja "${matchedSheetName}" no contiene suficientes datos para extraer precios.`);
  }

  // 3. IDENTIFY ROW WITH PLAN HEADERS
  // Scans first 12 rows to find the row that contains plan names like "Azul 1", "Azul 2", "Plata", "Oro", "Black", etc.
  let planHeaderRowIndex = -1;

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    const rowJoined = row.map((cell) => String(cell || '').toLowerCase().trim()).join(' ');
    
    const matchedCount = KNOWN_PLAN_KEYWORDS.filter((k) => rowJoined.includes(k)).length;
    if (matchedCount >= 2) {
      planHeaderRowIndex = i;
      break;
    }
  }

  // If not found by keyword, check if any row has multiple text headers followed by a numeric row directly underneath
  if (planHeaderRowIndex === -1) {
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const nextRow = rows[i + 1] || [];
      const numCountInNextRow = nextRow.filter((c) => typeof c === 'number' && c > 50).length;
      if (numCountInNextRow >= 3) {
        planHeaderRowIndex = i;
        break;
      }
    }
  }

  const extractedPlans: ATTPlan[] = [];
  const currentSavedPlans = loadPlans();

  interface PlanColMap {
    colIndex: number;
    planName: string;
    planMonthlyCost: number;
    plazo: number; // 24, 30, 36
  }

  const planColumns: PlanColMap[] = [];

  let brandColIndex = -1;
  let modelColIndex = -1;
  let storageColIndex = -1;
  let precioContadoColIndex = -1;
  let dataStartRow = 1;

  if (planHeaderRowIndex !== -1) {
    // EXACT STRUCTURE SPECIFIED BY USER:
    // 1. planHeaderRowIndex: Nombre del plan (ej. "Azul 1", "Azul 2", etc.)
    // 2. planHeaderRowIndex + 1: Costo del plan (precio mensual del plan)
    // 3. planHeaderRowIndex + 2: Plazos (3 celdas: 24, 30, 36)
    // 4. planHeaderRowIndex + 3+: Costo del equipo (precio de promoción) bajo cada plazo
    const planPriceRowIndex = planHeaderRowIndex + 1;
    const planRow = rows[planHeaderRowIndex] || [];
    const priceRow = rows[planPriceRowIndex] || [];

    let plazoRowIndex = planHeaderRowIndex + 2;
    for (let offset = 2; offset <= 3; offset++) {
      const candidateRow = rows[planHeaderRowIndex + offset] || [];
      const has24 = candidateRow.some((c) => {
        const s = String(c || '').trim().toLowerCase();
        return s === '24' || s === '24m' || s.startsWith('24');
      });
      const has36 = candidateRow.some((c) => {
        const s = String(c || '').trim().toLowerCase();
        return s === '36' || s === '36m' || s.startsWith('36');
      });
      if (has24 && has36) {
        plazoRowIndex = planHeaderRowIndex + offset;
        break;
      }
    }

    const plazoRow = rows[plazoRowIndex] || [];
    dataStartRow = plazoRowIndex + 1;

    // Detect column indexes for Marca, Modelo and Precio de Contado across ALL columns in header rows
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const headerCandidate = rows[r] || [];
      for (let c = 0; c < headerCandidate.length; c++) {
        const rawText = String(headerCandidate[c] || '').trim();
        const text = rawText.toLowerCase().replace(/\s+/g, ' ');
        if (!text) continue;

        if (
          precioContadoColIndex === -1 &&
          (text === 'precio de contado' ||
            text.includes('precio de contado') ||
            text.includes('precio contado') ||
            text.includes('p. contado') ||
            text.includes('p.contado') ||
            text === 'contado' ||
            (text.includes('contado') && !text.includes('descontado')) ||
            text === 'precio de lista' ||
            text.includes('precio de lista') ||
            text.includes('precio lista') ||
            text.includes('p. lista') ||
            text.includes('p.lista') ||
            text === 'lista' ||
            text.includes('pvp') ||
            text.includes('retail'))
        ) {
          precioContadoColIndex = c;
        }

        if (brandColIndex === -1 && (text === 'marca' || text.includes('fabricante'))) {
          brandColIndex = c;
        }
        if (modelColIndex === -1 && (text === 'modelo' || text.includes('equipo') || text.includes('terminal') || text.includes('descripcion'))) {
          modelColIndex = c;
        }
        if (storageColIndex === -1 && (text.includes('capacidad') || text.includes('memoria') || text === 'gb')) {
          storageColIndex = c;
        }
      }
    }

    // Fallbacks if columns were not labeled with text
    if (modelColIndex === -1 && brandColIndex === -1) {
      brandColIndex = 0;
      modelColIndex = 1;
    } else if (modelColIndex === -1) {
      modelColIndex = brandColIndex === 0 ? 1 : 0;
    } else if (brandColIndex === -1) {
      brandColIndex = modelColIndex === 0 ? 1 : 0;
    }

    // Traverse the columns to map each column to its Plan, Plan Monthly Cost, and Plazo
    let activePlanName = '';
    let activePlanPrice = 0;
    let plazoCounter = 0; // standard sequence 24, 30, 36 when not explicit

    for (let c = 0; c < Math.max(planRow.length, priceRow.length); c++) {
      // Exclude identified equipment info columns and PRECIO DE CONTADO column
      if (
        c === precioContadoColIndex ||
        c === brandColIndex ||
        c === modelColIndex ||
        c === storageColIndex
      ) {
        continue;
      }

      const cellPlanText = String(planRow[c] || '').trim();
      const cellPriceVal = cleanNumber(priceRow[c]);
      const cellPlazoText = String(plazoRow[c] || '').trim().toLowerCase();

      // Check if this column starts a new Plan Header or a non-plan section
      const upperCellText = cellPlanText.toUpperCase();
      const isBogusPlan =
        upperCellText.includes('VIGENCIA') ||
        upperCellText.includes('FECHA') ||
        upperCellText.includes('TOTAL') ||
        upperCellText.includes('CODIGO') ||
        upperCellText.includes('SKU') ||
        upperCellText.includes('MARCA') ||
        upperCellText.includes('MODELO') ||
        upperCellText.includes('CONTADO') ||
        upperCellText.includes('LISTA') ||
        upperCellText.includes('NOTA') ||
        upperCellText.includes('POLITICA');

      if (isBogusPlan) {
        // Crucial: Clear active plan so trailing/summary columns are never mistaken for plan equipment prices!
        activePlanName = '';
        activePlanPrice = 0;
        continue;
      }

      if (cellPlanText && isNaN(Number(cellPlanText)) && cellPlanText.length > 1) {
        // Clean up plan name (e.g. "Azul 1", "Azul 2", "Plata", "Oro", "Black", "Platino", "Diamante")
        activePlanName = cellPlanText.replace(/\s+/g, ' ');
        plazoCounter = 0; // reset counter for this plan's subcolumns

        // DYNAMIC EXTRACTION: Read the price directly from the cell below
        if (cellPriceVal > 0) {
          activePlanPrice = cellPriceVal;
          // Save or update plan in persistent plans table
          addCustomPlan(activePlanName, activePlanPrice);
          if (!extractedPlans.some((p) => p.name.toLowerCase() === activePlanName.toLowerCase())) {
            extractedPlans.push({
              id: activePlanName.toLowerCase().replace(/\s+/g, '-'),
              name: activePlanName,
              monthlyPrice: activePlanPrice,
            });
          }
        } else {
          // If the cell directly below was empty, check if adjacent cell in merged range has the price
          const nextPriceVal = cleanNumber(priceRow[c + 1]) || cleanNumber(priceRow[c + 2]);
          if (nextPriceVal > 0) {
            activePlanPrice = nextPriceVal;
            addCustomPlan(activePlanName, activePlanPrice);
          } else {
            // Check previously saved plans
            const match = currentSavedPlans.find(
              (p) => p.name.toLowerCase() === activePlanName.toLowerCase()
            );
            activePlanPrice = match ? match.monthlyPrice : 0;
          }
        }
      }

      // If active plan has no price yet, but current column in priceRow has a number:
      if (activePlanPrice === 0 && cellPriceVal > 0) {
        activePlanPrice = cellPriceVal;
        if (activePlanName) {
          addCustomPlan(activePlanName, activePlanPrice);
        }
      }

      // Detect Plazo (24, 30, 36)
      let plazo = 0;
      if (cellPlazoText) {
        if (cellPlazoText.includes('36')) plazo = 36;
        else if (cellPlazoText.includes('30')) plazo = 30;
        else if (cellPlazoText.includes('24')) plazo = 24;
        else if (cellPlazoText.includes('12')) plazo = 12;
        else if (cellPlazoText.includes('18')) plazo = 18;
      }

      // If not explicit in plazoRow, infer from sequential sub-columns (24, 30, 36)
      if (!plazo && activePlanName) {
        const standardCycle = [24, 30, 36];
        plazo = standardCycle[plazoCounter % 3];
      }

      if (activePlanName && plazo > 0) {
        planColumns.push({
          colIndex: c,
          planName: activePlanName,
          planMonthlyCost: activePlanPrice,
          plazo,
        });
        plazoCounter++;
        if (plazoCounter >= 3) {
          activePlanName = ''; // Each plan has exactly 3 plazos (24, 30, 36). Reset so extra columns are never mistaken for plan prices!
          activePlanPrice = 0;
        }
      }
    }
  }

  const records: DevicePriceRecord[] = [];
  const nowStr = new Date().toISOString();

  // Helper to find model name in row if default column was empty
  const findModelInRow = (row: (string | number | boolean | null | undefined)[]): { model: string; brand: string; storage?: string } | null => {
    // 1. Try detected modelColIndex
    let candidate = String(row[modelColIndex] || '').trim();
    let brandCandidate = brandColIndex !== -1 ? String(row[brandColIndex] || '').trim() : '';

    // If candidate is a pure number or empty, search first 4 columns
    if (!candidate || (!isNaN(Number(candidate)) && candidate.length < 5)) {
      for (let c = 0; c < Math.min(row.length, 5); c++) {
        const cell = String(row[c] || '').trim();
        // Skip pure numbers or short codes
        if (cell && isNaN(Number(cell)) && cell.length > 2) {
          // If looks like brand only (e.g. "Apple") and next column has model:
          const next = String(row[c + 1] || '').trim();
          if (next && next.length > 2 && isNaN(Number(next))) {
            brandCandidate = cell;
            candidate = next;
            break;
          } else {
            candidate = cell;
            break;
          }
        }
      }
    }

    if (!candidate) return null;

    // Detect storage from candidate string (e.g. "256GB")
    const storageMatch = candidate.match(/(\d+\s*(?:gb|tb))/i);
    const storage = storageMatch ? storageMatch[1].toUpperCase() : undefined;

    if (!brandCandidate) {
      brandCandidate = detectBrand(candidate);
    }

    return {
      model: candidate,
      brand: brandCandidate,
      storage,
    };
  };

  // 4. PARSE EQUIPMENT ROWS (from dataStartRow to the end of sheet)
  if (planColumns.length > 0) {
    for (let r = dataStartRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const modelInfo = findModelInRow(row);
      if (!modelInfo || !modelInfo.model) continue;

      // Filter out section divider rows (e.g. "GAMA ALTA", "PORTABILIDAD", "EQUIPOS", etc.)
      const lowerModel = modelInfo.model.toLowerCase();
      if (
        lowerModel === 'marca' ||
        lowerModel === 'modelo' ||
        lowerModel === 'equipo' ||
        lowerModel === 'gama alta' ||
        lowerModel === 'gama media' ||
        lowerModel === 'gama premium' ||
        lowerModel === 'promociones' ||
        lowerModel.startsWith('lista de')
      ) {
        continue;
      }

      // Check if this row has ANY numeric prices in the mapped plan columns
      let rowHasValidPrices = false;
      const rawPrecioContado = precioContadoColIndex !== -1 ? cleanNumber(row[precioContadoColIndex]) : 0;

      for (const mapping of planColumns) {
        const precioPromocion = cleanNumber(row[mapping.colIndex]);
        if (precioPromocion > 100) { // Valid equipment cost
          rowHasValidPrices = true;

          // EXACT FORMULA EXPLAINED BY USER:
          // 1. precioPromocion: costo de promoción del equipo con el plan y plazo (ej: $28,690.30 para iPhone 18 Pro Max en Plan Black a 36m)
          // 2. engancheMaximo: El 50% del valor de promoción (ej: $14,345.15)
          // 3. mensualidadEquipo: El saldo restante financiado dividido en el plazo: ($14,345.15 / 36 = $398.48/mes)
          // 4. mensualidadTotal: mensualidad del equipo + costo del plan ($398.48 + costoPlan)
          const costoPlan = mapping.planMonthlyCost;

          // REGLA DE ORO AT&T:
          // Si precioPromocion < 0.30 * precioContado -> NO piden enganche, piden Rentas por Adelantado (máx 3 rentas)
          const precioContado = rawPrecioContado > 0 ? rawPrecioContado : Math.round(precioPromocion * 1.25);
          const umbral30 = Math.round(precioContado * 0.30 * 100) / 100;
          const esMenor30Contado = precioContado > 0 && precioPromocion < umbral30;
          const tipoPagoInicial: 'rentas_adelantadas' | 'enganche' = esMenor30Contado ? 'rentas_adelantadas' : 'enganche';
          const numRentasAdelantadas = esMenor30Contado ? 3 : 0;
          const montoRentasAdelantadas = esMenor30Contado ? Math.round(3 * costoPlan * 100) / 100 : 0;
          const engancheMinimo = Math.round((precioPromocion * 0.10) * 100) / 100;
          const pagoInicialMinimo = esMenor30Contado ? montoRentasAdelantadas : engancheMinimo;

          const engancheMaximo = Math.round((precioPromocion * 0.5) * 100) / 100;
          const saldoFinanciado = precioPromocion - engancheMaximo;
          const mensualidadEquipoConMaxEnganche = Math.round((saldoFinanciado / mapping.plazo) * 100) / 100;
          const mensualidadTotalConMaxEnganche = Math.round((mensualidadEquipoConMaxEnganche + costoPlan) * 100) / 100;

          // Also with 0% enganche
          const mensualidadEquipoSinEnganche = Math.round((precioPromocion / mapping.plazo) * 100) / 100;
          const mensualidadTotalSinEnganche = Math.round((mensualidadEquipoSinEnganche + costoPlan) * 100) / 100;

          records.push({
            id: `${modelInfo.brand}-${modelInfo.model}-${mapping.planName}-${mapping.plazo}`
              .replace(/\s+/g, '-')
              .toLowerCase(),
            brand: modelInfo.brand,
            model: modelInfo.model,
            storage: modelInfo.storage,
            planNombre: mapping.planName,
            costoPlan,
            plazo: mapping.plazo,
            precioPromocion,
            engancheMaximo,
            mensualidadEquipoConMaxEnganche,
            mensualidadTotalConMaxEnganche,
            mensualidadEquipoSinEnganche,
            mensualidadTotalSinEnganche,
            mensualidad: mensualidadTotalConMaxEnganche,
            pagoInicial: pagoInicialMinimo,
            precioLista: precioContado,
            promocion: esMenor30Contado
              ? `Plan ${mapping.planName} (${mapping.plazo}m) • ¡$0 Enganche (3 Rentas)!`
              : `Plan ${mapping.planName} (${mapping.plazo} meses)`,
            updatedAt: nowStr,
            precioContado,
            esMenor30Contado,
            tipoPagoInicial,
            numRentasAdelantadas,
            montoRentasAdelantadas,
            pagoInicialMinimo,
          });
        }
      }

      if (!rowHasValidPrices) {
        // Row might have been an empty spacer or banner row
      }
    }
  }

  return {
    records: deduplicateDeviceRecords(records),
    targetSheetFound: true,
    targetSheetName: matchedSheetName,
    discardedSheets,
    totalSheetsInFile: allSheetNames.length,
    extractedPlans,
    warnings,
  };
};
