import React, { useState } from 'react';
import {
  Image,
  Download,
  Copy,
  Check,
  Share2,
  Sparkles,
  ShieldCheck,
  Smartphone,
  MessageCircle,
  TrendingDown,
  ExternalLink,
  Flame,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  QuoteImageData,
  downloadQuoteImage,
  copyQuoteImageToClipboard,
  shareQuoteImageViaShareAPI,
} from '../utils/quoteImageGenerator';

interface VisualQuoteCardProps {
  quoteData: QuoteImageData;
  clientPhone?: string;
  isTableMissing?: boolean;
}

export const VisualQuoteCard: React.FC<VisualQuoteCardProps> = ({
  quoteData,
  clientPhone,
  isTableMissing,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleDownload = async () => {
    if (isTableMissing) return;
    try {
      setIsDownloading(true);
      await downloadQuoteImage(quoteData);
      showFeedback('¡Imagen PNG de alta resolución descargada con éxito!');
    } catch (e) {
      console.error(e);
      showFeedback('Error al generar la imagen.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    if (isTableMissing) return;
    try {
      setIsCopied(true);
      const success = await copyQuoteImageToClipboard(quoteData);
      if (success) {
        showFeedback('¡Imagen copiada al portapapeles! Pégala (Ctrl+V) directo en WhatsApp Web.');
      } else {
        await downloadQuoteImage(quoteData);
        showFeedback('Descargando imagen para compartir en WhatsApp.');
      }
    } catch (e) {
      console.error(e);
      showFeedback('No se pudo copiar directamente; descargando imagen...');
      await downloadQuoteImage(quoteData);
    } finally {
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const handleShareImage = async () => {
    if (isTableMissing) return;
    try {
      setIsSharing(true);
      const shared = await shareQuoteImageViaShareAPI(quoteData);
      if (shared) {
        showFeedback('¡Listo! Comparte la imagen en el chat de WhatsApp.');
      } else {
        let cleanPhone = (clientPhone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = `52${cleanPhone}`;
        const waUrl = cleanPhone
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
          : 'https://api.whatsapp.com/send';
        window.open(waUrl, '_blank');
        showFeedback('Imagen descargada. Arrástrala o adjúntala al chat de WhatsApp.');
      }
    } catch (e) {
      console.error(e);
      showFeedback('Error al compartir la imagen.');
    } finally {
      setIsSharing(false);
    }
  };

  const is3Rentas = !!quoteData.esMenor30Contado;
  const initialPaymentAmount = is3Rentas
    ? Number(quoteData.montoRentasAdelantadas || quoteData.costoPlan * 3)
    : Number(quoteData.montoEnganche || 0);

  const savingsAmount =
    quoteData.precioContado && quoteData.precioContado > quoteData.precioPromocion
      ? quoteData.precioContado - quoteData.precioPromocion
      : 0;

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={handleShareImage}
          disabled={isTableMissing || isSharing}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
          title="Compartir tarjeta gráfica directamente por WhatsApp"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{isSharing ? 'Preparando...' : 'Mandar por WhatsApp'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyImage}
          disabled={isTableMissing || isCopied}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold py-3 px-4 rounded-xl text-xs border border-cyan-800/50 shadow-sm transition disabled:opacity-50 cursor-pointer"
          title="Copia la imagen para pegarla con Ctrl+V en WhatsApp Web"
        >
          {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
          <span>{isCopied ? '¡Copiada!' : 'Copiar Imagen (Ctrl+V)'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={isTableMissing || isDownloading}
          className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 px-4 rounded-xl text-xs border border-slate-700 transition disabled:opacity-50 cursor-pointer"
          title="Descarga la imagen en formato PNG de alta resolución"
        >
          <Download className="w-4 h-4 text-slate-400" />
          <span>{isDownloading ? 'Generando...' : 'Descargar PNG HD'}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIBRANT & IMPACTFUL LIVE QUOTE CARD MOCKUP (What the customer receives!) */}
      {/* ========================================================================= */}
      <div className="relative mx-auto max-w-[480px] bg-gradient-to-b from-[#040914] via-[#07162E] to-[#02060D] border-2 border-cyan-500/50 rounded-3xl p-5 shadow-2xl space-y-4 text-white overflow-hidden select-none">
        {/* Glow ambient background effects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-0 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Card Header Ribbon */}
        <div className="relative bg-gradient-to-r from-slate-900/90 via-[#0C264D]/90 to-slate-900/90 border border-cyan-500/40 rounded-2xl px-3.5 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 via-cyan-400 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/40">
              <span className="text-xs font-black text-white">AT</span>
            </div>
            <div>
              <span className="text-sm font-black tracking-wide text-white">AT&amp;T</span>
              <span className="text-[10px] text-cyan-300 font-bold ml-2">
                DISTRIBUIDOR AUTORIZADO PREMIUM
              </span>
            </div>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>COTIZACIÓN VIGENTE</span>
          </span>
        </div>

        {/* 2. Client & Date Subheader */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
          <span className="text-slate-200 truncate max-w-[240px]">
            {quoteData.clientName?.trim() ? `👤 Cliente: ${quoteData.clientName}` : '👤 Cotización Especial Preferente'}
          </span>
          <span className="text-slate-400 text-[11px]">
            📅 {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* 3. Device Spotlight Card */}
        <div className="bg-gradient-to-r from-slate-900/90 to-[#0A1A33]/90 border border-cyan-500/30 rounded-2xl p-4 space-y-2 relative shadow-md">
          <div className="flex items-center space-x-1.5 text-[11px] font-black tracking-wider text-cyan-400 uppercase">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{(quoteData.brand || 'AT&T').toUpperCase()} • EQUIPO 100% NUEVO</span>
          </div>

          <h3 className="text-2xl font-black text-white tracking-tight leading-snug">
            {quoteData.model || 'Equipo AT&T'}
          </h3>

          <div className="flex flex-wrap gap-2 pt-1">
            <span className="bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 text-[11px] font-bold px-2.5 py-1 rounded-lg">
              ⏱️ Plazo: {quoteData.plazo} Meses
            </span>
            <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[11px] font-bold px-2.5 py-1 rounded-lg">
              📶 Plan {quoteData.planName} (${quoteData.costoPlan}/m)
            </span>
            <span className="bg-amber-950/80 text-amber-300 border border-amber-700/60 text-[11px] font-bold px-2.5 py-1 rounded-lg">
              ⚡ Red 5G Ultra
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. PRIMARY SHOWCASES: PROMO PRICE & INITIAL PAYMENT (SIDE BY SIDE)        */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 4A. CARD 1: COSTO DEL EQUIPO EN PRECIO DE PROMOCIÓN */}
          <div className="bg-gradient-to-b from-[#1C160A] to-[#120E05] border-2 border-amber-500 rounded-2xl p-3.5 text-center space-y-1.5 shadow-lg relative overflow-hidden">
            <div className="text-[11px] uppercase tracking-wider font-black text-amber-300 flex items-center justify-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Precio de Promoción</span>
            </div>

            <div className="text-2xl font-black text-white tracking-tight">
              ${Number(quoteData.precioPromocion || 0).toLocaleString('es-MX', {
                minimumFractionDigits: 2,
              })}
            </div>

            {quoteData.precioContado && quoteData.precioContado > quoteData.precioPromocion ? (
              <div className="text-[10px] text-slate-400">
                <span>Contado: </span>
                <span className="line-through">${quoteData.precioContado.toLocaleString('es-MX')}</span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400">Costo preferente con Plan</div>
            )}

            <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg py-1 px-2 text-[10px] text-amber-200 font-black">
              {savingsAmount > 0
                ? `🔥 ¡Ahorras $${savingsAmount.toLocaleString('es-MX')}!`
                : '🔥 ¡Descuento Exclusivo!'}
            </div>
          </div>

          {/* 4B. CARD 2: PAGO INICIAL REQUERIDO (PROMINENTE) */}
          <div
            className={`border-2 rounded-2xl p-3.5 text-center space-y-1.5 shadow-lg relative overflow-hidden ${
              is3Rentas
                ? 'bg-gradient-to-b from-[#082619] to-[#04140D] border-emerald-500'
                : 'bg-gradient-to-b from-[#07223C] to-[#041221] border-cyan-500'
            }`}
          >
            <div
              className={`text-[11px] uppercase tracking-wider font-black flex items-center justify-center space-x-1 ${
                is3Rentas ? 'text-emerald-300' : 'text-cyan-300'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${is3Rentas ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span>Pago Inicial Requerido</span>
            </div>

            <div
              className={`text-2xl font-black tracking-tight ${
                is3Rentas ? 'text-emerald-400' : 'text-cyan-400'
              }`}
            >
              ${initialPaymentAmount.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
              })}
            </div>

            <div className="text-[10px] text-slate-300 font-semibold truncate">
              {is3Rentas
                ? `3 Rentas por Adelantado ($${quoteData.costoPlan}/m)`
                : `50% Enganche Comercial`}
            </div>

            <div
              className={`rounded-lg py-1 px-2 text-[10px] font-black border ${
                is3Rentas
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
              }`}
            >
              {is3Rentas ? '🌟 ¡$0 ENGANCHE DE EQUIPO!' : '💳 ¡PAGO ÚNICO AL ACTIVAR!'}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. HERO MENSUALIDAD TOTAL SPOTLIGHT (Centerpiece)                         */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-b from-[#071C38] via-[#0A264D] to-[#051428] border-2 border-cyan-400 rounded-2xl p-4 text-center space-y-2 relative shadow-xl">
          <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">
            ✦ MENSUALIDAD TOTAL CON TODO INCLUIDO ✦
          </span>

          <div className="flex items-baseline justify-center space-x-1.5 pt-0.5">
            <span className="text-4xl font-black text-emerald-400 tracking-tight">
              ${Number(quoteData.mensualidadTotal || 0).toLocaleString('es-MX', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-sm text-slate-300 font-bold">/ mes</span>
          </div>

          <p className="text-[11px] text-slate-200 font-medium">
            Equipo financiado (${quoteData.mensualidadEquipo.toFixed(2)}/mes) + Plan {quoteData.planName} (${quoteData.costoPlan}.00/mes)
          </p>

          <div className="text-[10px] text-cyan-300 font-semibold">
            ✓ Tarifa fija sin aumentos sorpresa • Equipo 100% tuyo al finalizar el plazo
          </div>
        </div>

        {/* 6. Three Metric Pillars */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Saldo Financiado</div>
            <div className="text-xs font-black text-white mt-0.5">
              ${Number(quoteData.montoFinanciado || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[9px] text-slate-400">{quoteData.plazo} meses</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Renta del Plan</div>
            <div className="text-xs font-black text-cyan-300 mt-0.5">
              ${Number(quoteData.costoPlan || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}/m
            </div>
            <div className="text-[9px] text-cyan-400">Vigencia mensual</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Garantía Fábrica</div>
            <div className="text-xs font-black text-emerald-400 mt-0.5">1 AÑO</div>
            <div className="text-[9px] text-emerald-400">Respaldo AT&amp;T</div>
          </div>
        </div>

        {/* 7. Benefits Box */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">
            ✨ Beneficios Incluidos en tu Plan AT&amp;T:
          </div>
          <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
            <li className="flex items-center space-x-2">
              <span className="text-emerald-400 font-black">✓</span>
              <span><strong>Redes Sociales Ilimitadas:</strong> WhatsApp, Facebook, Instagram y X sin costo</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-emerald-400 font-black">✓</span>
              <span><strong>Roaming Internacional:</strong> Llamadas, SMS y datos en México, USA y Canadá</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-emerald-400 font-black">✓</span>
              <span><strong>Red 5G Ultra:</strong> Máxima velocidad de navegación sin interrupciones</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-emerald-400 font-black">✓</span>
              <span><strong>Equipo 100% Nuevo:</strong> En caja sellada con garantía de 1 año y factura</span>
            </li>
          </ul>
        </div>

        {/* 8. Call To Action Urgency Box */}
        <div className="bg-gradient-to-r from-emerald-950/70 via-cyan-950/70 to-emerald-950/70 border-2 border-emerald-500/50 rounded-2xl p-3 text-center space-y-1 shadow-md">
          <div className="text-xs font-black text-white">
            🚀 ¡Aprobación Inmediata Únicamente con tu INE!
          </div>
          <div className="text-[10px] text-slate-300">
            Envía tu identificación por este chat para apartado de equipo y activación exprés
          </div>
          <div className="text-[10px] text-emerald-300 font-bold">
            Sucursal Oficial: AT&amp;T Alsuper Robinson
          </div>
        </div>

        {/* Footer info badge */}
        <div className="text-[9px] text-center text-slate-500 pt-0.5">
          Tarjeta gráfica de cotización oficial optimizada para envío por WhatsApp • AT&amp;T México
        </div>
      </div>
    </div>
  );
};
