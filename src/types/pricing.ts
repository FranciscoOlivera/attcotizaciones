export interface ATTPlan {
  id: string;
  name: string; // e.g. "Azul 1", "Azul 2", "Azul 3", "Plata", "Oro", "Black", "Platino", "Diamante"
  monthlyPrice: number; // e.g. 299, 399, 499, 599, 799, 999, 1299, 1599
  description?: string;
  isCustom?: boolean;
}

export interface DevicePriceRecord {
  id: string;
  brand: string;
  model: string;
  storage?: string;
  planNombre: string; // e.g. "Black", "Azul 1", "Plata", etc.
  costoPlan: number; // Monthly plan price (e.g. 999)
  plazo: number; // 24, 30, 36 meses
  precioPromocion: number; // Promotional device price for this plan & plazo (e.g. 28690.30)
  engancheMaximo: number; // 50% of precioPromocion (e.g. 14345.15)
  // Default calculations:
  // With 50% max enganche:
  mensualidadEquipoConMaxEnganche: number; // (precioPromocion * 0.5) / plazo
  mensualidadTotalConMaxEnganche: number; // mensualidadEquipoConMaxEnganche + costoPlan
  // With 0% enganche:
  mensualidadEquipoSinEnganche: number; // precioPromocion / plazo
  mensualidadTotalSinEnganche: number; // mensualidadEquipoSinEnganche + costoPlan
  // Reference / compatibility fields
  mensualidad: number; // standard default monthly payment (total con max enganche or full)
  pagoInicial: number; // enganche maximo
  precioLista: number; // same as precioPromocion or retail
  promocion?: string;
  updatedAt: string;

  // Regla de Oro AT&T Premium ("Precio de Contado" vs Rentas por Adelantado):
  // Si precioPromocion < 0.30 * precioContado -> NO piden enganche, piden Rentas por Adelantado (máx 3 rentas del plan)
  precioContado?: number; // Precio de mercado en contado
  esMenor30Contado?: boolean; // Flag indicando si califica para Rentas por Adelantado
  tipoPagoInicial?: 'rentas_adelantadas' | 'enganche';
  numRentasAdelantadas?: number; // 3 (estándar AT&T)
  montoRentasAdelantadas?: number; // 3 * costoPlan
  pagoInicialMinimo?: number; // Si rentas adelantadas: 3 * costoPlan; si enganche: 10% de precioPromocion
}

export type ChangeType = 'new' | 'price_drop' | 'price_increase' | 'plazo_changed' | 'unchanged';

export interface PriceChangeDiff {
  id: string;
  brand: string;
  model: string;
  planNombre: string;
  plazo: number;
  type: ChangeType;
  oldPrecioPromocion?: number;
  newPrecioPromocion: number;
  oldMensualidadTotal?: number;
  newMensualidadTotal: number;
  diffMensualidad?: number;
  promocion?: string;
  details: string;
}

export interface SyncExecutionReport {
  id: string;
  timestamp: string;
  sourceType: 'gmail' | 'manual_upload';
  emailSubject?: string;
  emailId?: string;
  sender?: string;
  attachmentName: string;
  totalRecords: number;
  newRecordsCount: number;
  priceDropsCount: number;
  priceIncreasesCount: number;
  unchangedCount: number;
  changes: PriceChangeDiff[];
  emailSentTo?: string;
  emailSentStatus?: 'sent' | 'failed' | 'not_requested';
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  isolatedSheetName: string;
  discardedSheetsCount: number;
  extractedPlansCount?: number;
}

export interface DetectedEmailMessage {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }[];
  processed: boolean;
  processedAt?: string;
}

export interface QuotationConfig {
  device: DevicePriceRecord;
  plan: ATTPlan;
  plazo: number; // 24, 30, 36
  precioPromocion: number;
  porcentajeEnganche: number; // 0 to 50
  montoEnganche: number; // 0 to 50% of precioPromocion
  montoFinanciado: number; // precioPromocion - montoEnganche
  mensualidadEquipo: number; // montoFinanciado / plazo
  costoPlan: number;
  mensualidadTotal: number; // mensualidadEquipo + costoPlan
  clientName?: string;
  clientPhone?: string;
  notes?: string;
}
