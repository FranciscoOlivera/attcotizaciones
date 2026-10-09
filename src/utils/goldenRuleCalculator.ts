import { DevicePriceRecord } from '../types/pricing';

export interface GoldenRuleEvaluation {
  precioContado: number;
  precioPromocion: number;
  umbral30Contado: number;
  porcentajeDelContado: number;
  esMenor30Contado: boolean;
  tipoPagoInicial: 'rentas_adelantadas' | 'enganche';
  numRentasAdelantadas: number;
  montoRentasAdelantadas: number;
  porcentajeEngancheRequerido: number;
  montoEngancheRequerido: number;
  montoPagoInicialRequerido: number;
  explicacion: string;
}

/**
 * REGLA OFICIAL DE ORO AT&T (Estricta y mutuamente excluyente):
 * - Si precioPromocion < 0.30 * precioContado:
 *     -> NO PIDEN ENGANCHE ($0.00). PIDEN RENTAS POR ADELANTADO (3 rentas).
 *     -> Pago inicial = 3 * costoPlan.
 * - De lo contrario (hasta 70% de descuento):
 *     -> PIDEN ENGANCHE (máximo 50% del precio de promoción).
 *     -> NO PIDEN RENTAS POR ADELANTADO ($0.00).
 *     -> Pago inicial = 50% de precioPromocion.
 */
export function evaluateGoldenRule(
  precioPromocion: number,
  precioContado: number,
  costoPlan: number
): GoldenRuleEvaluation {
  const promo = Number(precioPromocion || 0);
  const contado = Number(precioContado || 0);
  const plan = Number(costoPlan || 0);

  const effectiveContado = contado > 0 ? contado : Math.round(promo * 1.25);
  const umbral30Contado = Math.round(effectiveContado * 0.30 * 100) / 100;
  const porcentajeDelContado = effectiveContado > 0 ? Math.round((promo / effectiveContado) * 100) : 100;

  // Condición: estrictamente menor al 30% del valor de contado
  const esMenor30Contado = effectiveContado > 0 && promo < umbral30Contado;

  let tipoPagoInicial: 'rentas_adelantadas' | 'enganche';
  let numRentasAdelantadas = 0;
  let montoRentasAdelantadas = 0;
  let porcentajeEngancheRequerido = 0;
  let montoEngancheRequerido = 0;
  let montoPagoInicialRequerido = 0;
  let explicacion = '';

  if (esMenor30Contado) {
    // Caso 1: RENTAS POR ADELANTADO (3 rentas). NO SE PIDE ENGANCHE ($0.00).
    tipoPagoInicial = 'rentas_adelantadas';
    numRentasAdelantadas = 3;
    montoRentasAdelantadas = Math.round(3 * plan * 100) / 100;
    porcentajeEngancheRequerido = 0;
    montoEngancheRequerido = 0;
    montoPagoInicialRequerido = montoRentasAdelantadas;
    explicacion = `El precio promo ($${promo.toLocaleString('es-MX')}) es menor al 30% del valor de contado ($${umbral30Contado.toLocaleString('es-MX')}). Piden RENTAS POR ADELANTADO (3 rentas: $${montoRentasAdelantadas.toLocaleString('es-MX')}). NO piden enganche ($0.00).`;
  } else {
    // Caso 2: ENGANCHE (50% del precio de promoción). NO SE PIDEN RENTAS POR ADELANTADO ($0.00).
    tipoPagoInicial = 'enganche';
    numRentasAdelantadas = 0;
    montoRentasAdelantadas = 0;
    porcentajeEngancheRequerido = 50;
    montoEngancheRequerido = Math.round(promo * 0.50 * 100) / 100;
    montoPagoInicialRequerido = montoEngancheRequerido;
    explicacion = `El precio promo ($${promo.toLocaleString('es-MX')}) es ${porcentajeDelContado}% del valor de contado. Piden ENGANCHE (50%: $${montoEngancheRequerido.toLocaleString('es-MX')}). NO piden rentas por adelantado ($0.00).`;
  }

  return {
    precioContado: effectiveContado,
    precioPromocion: promo,
    umbral30Contado,
    porcentajeDelContado,
    esMenor30Contado,
    tipoPagoInicial,
    numRentasAdelantadas,
    montoRentasAdelantadas,
    porcentajeEngancheRequerido,
    montoEngancheRequerido,
    montoPagoInicialRequerido,
    explicacion,
  };
}

export interface PlanPlazoOptionComparison {
  record: DevicePriceRecord;
  planNombre: string;
  costoPlan: number;
  plazo: number;
  precioPromocion: number;
  precioContado: number;
  umbral30Contado: number;
  porcentajeDelContado: number;
  esMenor30Contado: boolean;
  tipoPagoInicial: 'rentas_adelantadas' | 'enganche';
  pagoInicialRequerido: number;
  pagoInicialConcepto: string;
  pagoInicialDetalle: string;
  mensualidadTotal: number;
  isLowestInitialPayment: boolean;
  isLowestMonthlyPayment: boolean;
}

export interface DeviceInitialPaymentAnalysis {
  model: string;
  brand: string;
  precioContado: number;
  options: PlanPlazoOptionComparison[];
  bestInitialOption: PlanPlazoOptionComparison | null;
  bestMonthlyOption: PlanPlazoOptionComparison | null;
  hasRentasAdelantadas: boolean;
  hasEnganche: boolean;
  resumenGanador: string;
}

/**
 * Evalúa TODOS los planes y plazos disponibles para un modelo específico.
 * Utiliza el Precio de Contado REAL del modelo (constante y no distorsionado por fila)
 * para determinar con exactitud qué pide AT&T en cada combinación y encontrar
 * cuál exige el MENOR PAGO INICIAL (3 rentas o 50% de enganche).
 */
export function analyzeLowestInitialPaymentForModel(
  records: DevicePriceRecord[],
  modelName: string,
  overrideContado?: number
): DeviceInitialPaymentAnalysis {
  const cleanModelName = (modelName || '').toLowerCase().trim();
  const modelRecords = records.filter(
    (r) => r.model.toLowerCase().trim() === cleanModelName && Number(r.precioPromocion || 0) > 0
  );

  if (modelRecords.length === 0) {
    return {
      model: modelName,
      brand: 'AT&T',
      precioContado: 0,
      options: [],
      bestInitialOption: null,
      bestMonthlyOption: null,
      hasRentasAdelantadas: false,
      hasEnganche: false,
      resumenGanador: '',
    };
  }

  // 1. Determinar el PRECIO DE CONTADO CONSTANTE del equipo:
  // Si viene overrideContado explícito del usuario, usarlo. De lo contrario, usar el maxRecordedContado.
  const maxRecordedContado = Math.max(...modelRecords.map((r) => Number(r.precioContado || 0)));
  const maxRecordedPromo = Math.max(...modelRecords.map((r) => Number(r.precioPromocion || 0)));
  const calculatedContado = maxRecordedContado > 0 ? maxRecordedContado : Math.round(maxRecordedPromo * 1.25);
  const baseContado = overrideContado && overrideContado > 0 ? overrideContado : calculatedContado;
  const umbral30 = Math.round(baseContado * 0.30 * 100) / 100;

  // 2. Agrupar por combinación única (planNombre + plazo)
  const planPlazoMap = new Map<string, DevicePriceRecord>();
  for (const rec of modelRecords) {
    const key = `${rec.planNombre.toLowerCase().trim()}_${rec.plazo}`;
    if (!planPlazoMap.has(key)) {
      planPlazoMap.set(key, rec);
    }
  }

  // 3. Evaluar cada opción con la regla oficial y la constante de contado del equipo
  const options: PlanPlazoOptionComparison[] = Array.from(planPlazoMap.values()).map((rec) => {
    const promo = Number(rec.precioPromocion || 0);
    const costoPlan = Number(rec.costoPlan || 0);
    const plazo = Number(rec.plazo || 36);

    const esMenor30Contado = baseContado > 0 && promo < umbral30;
    const porcentajeDelContado = baseContado > 0 ? Math.round((promo / baseContado) * 100) : 0;
    const tipoPagoInicial: 'rentas_adelantadas' | 'enganche' = esMenor30Contado
      ? 'rentas_adelantadas'
      : 'enganche';

    let pagoInicialRequerido = 0;
    let pagoInicialConcepto = '';
    let pagoInicialDetalle = '';
    let saldoFinanciado = promo;
    let mensualidadEquipo = 0;

    if (esMenor30Contado) {
      // 3 Rentas por Adelantado ($0.00 enganche de equipo)
      pagoInicialRequerido = Math.round(3 * costoPlan * 100) / 100;
      pagoInicialConcepto = '3 Rentas por Adelantado';
      pagoInicialDetalle = `3 rentas del Plan ${rec.planNombre} ($${costoPlan}/m) • $0.00 Enganche`;
      saldoFinanciado = promo; // 100% financiado
      mensualidadEquipo = plazo > 0 ? Math.round((saldoFinanciado / plazo) * 100) / 100 : 0;
    } else {
      // 50% de Enganche ($0.00 rentas por adelantado)
      pagoInicialRequerido = Math.round(promo * 0.50 * 100) / 100;
      pagoInicialConcepto = '50% de Enganche';
      pagoInicialDetalle = `50% de Enganche comercial ($${pagoInicialRequerido.toLocaleString('es-MX')}) • $0.00 Rentas`;
      saldoFinanciado = Math.max(0, promo - pagoInicialRequerido);
      mensualidadEquipo = plazo > 0 ? Math.round((saldoFinanciado / plazo) * 100) / 100 : 0;
    }

    const mensualidadTotal = Math.round((mensualidadEquipo + costoPlan) * 100) / 100;

    return {
      record: rec,
      planNombre: rec.planNombre,
      costoPlan,
      plazo,
      precioPromocion: promo,
      precioContado: baseContado,
      umbral30Contado: umbral30,
      porcentajeDelContado,
      esMenor30Contado,
      tipoPagoInicial,
      pagoInicialRequerido,
      pagoInicialConcepto,
      pagoInicialDetalle,
      mensualidadTotal,
      isLowestInitialPayment: false,
      isLowestMonthlyPayment: false,
    };
  });

  // Ordenar opciones:
  // 1. Por menor pago inicial requerido
  // 2. Si hay empate, por menor mensualidad total
  options.sort((a, b) => {
    if (a.pagoInicialRequerido !== b.pagoInicialRequerido) {
      return a.pagoInicialRequerido - b.pagoInicialRequerido;
    }
    return a.mensualidadTotal - b.mensualidadTotal;
  });

  const bestInitialOption = options[0] || null;
  if (bestInitialOption) {
    bestInitialOption.isLowestInitialPayment = true;
  }

  // Identificar también la mensualidad total más baja
  const sortedByMonthly = [...options].sort((a, b) => a.mensualidadTotal - b.mensualidadTotal);
  const bestMonthlyOption = sortedByMonthly[0] || null;
  if (bestMonthlyOption) {
    const match = options.find((o) => o.record.id === bestMonthlyOption.record.id);
    if (match) match.isLowestMonthlyPayment = true;
  }

  const hasRentasAdelantadas = options.some((o) => o.tipoPagoInicial === 'rentas_adelantadas');
  const hasEnganche = options.some((o) => o.tipoPagoInicial === 'enganche');

  let resumenGanador = '';
  if (bestInitialOption) {
    resumenGanador = `El menor pago inicial para ${modelName} se pide en el Plan ${bestInitialOption.planNombre} a ${bestInitialOption.plazo} meses con solo $${bestInitialOption.pagoInicialRequerido.toLocaleString('es-MX')} (${bestInitialOption.pagoInicialConcepto}).`;
  }

  return {
    model: modelName,
    brand: modelRecords[0]?.brand || 'AT&T',
    precioContado: baseContado,
    options,
    bestInitialOption,
    bestMonthlyOption,
    hasRentasAdelantadas,
    hasEnganche,
    resumenGanador,
  };
}
