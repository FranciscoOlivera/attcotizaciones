import React, { useState, useMemo } from 'react';
import {
  MessageCircle,
  Smartphone,
  Copy,
  Check,
  Calculator,
  Sliders,
  Sparkles,
  DollarSign,
  User,
  Phone,
  Tag,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Image as ImageIcon,
  Download,
  Share2,
  Trophy,
  Award,
  Zap,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingDown,
  Pencil,
} from 'lucide-react';
import { DevicePriceRecord, ATTPlan } from '../types/pricing';
import { deduplicateDeviceRecords } from '../utils/recordDeduplicator';
import { VisualQuoteCard } from './VisualQuoteCard';
import { QuoteImageData, downloadQuoteImage } from '../utils/quoteImageGenerator';
import {
  evaluateGoldenRule,
  analyzeLowestInitialPaymentForModel,
  GoldenRuleEvaluation,
  PlanPlazoOptionComparison,
} from '../utils/goldenRuleCalculator';
import { DeviceFinancingSelector } from './DeviceFinancingSelector';

interface CotizadorWhatsAppProps {
  records: DevicePriceRecord[];
  plans: ATTPlan[];
  selectedDeviceRecord?: DevicePriceRecord | null;
  onNavigateToInbox?: () => void;
  onNavigateToPlanes?: () => void;
}

export const CotizadorWhatsApp: React.FC<CotizadorWhatsAppProps> = ({
  records,
  plans,
  selectedDeviceRecord,
  onNavigateToInbox,
  onNavigateToPlanes,
}) => {
  // Filter records to ONLY show devices with active promotion (> 0)
  const activePromoRecords = useMemo(() => {
    return deduplicateDeviceRecords(records.filter((r) => r.precioPromocion > 0));
  }, [records]);

  // Unique list of models with active promotions
  const uniqueModels = useMemo(() => {
    const map = new Map<string, { brand: string; model: string }>();
    activePromoRecords.forEach((r) => {
      if (!map.has(r.model)) {
        map.set(r.model, { brand: r.brand, model: r.model });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.model.localeCompare(b.model));
  }, [activePromoRecords]);

  // If no table is linked or empty records
  const isTableMissing = activePromoRecords.length === 0 || plans.length === 0;

  // Selected state
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (selectedDeviceRecord) return selectedDeviceRecord.model;
    return uniqueModels[0]?.model || '';
  });

  const [selectedPlanName, setSelectedPlanName] = useState<string>(() => {
    if (selectedDeviceRecord) return selectedDeviceRecord.planNombre;
    const azul3 = plans.find((p) => p.name.toLowerCase().includes('azul 3'));
    return azul3?.name || plans[0]?.name || 'Azul 3 (14GB)';
  });

  const [selectedPlazo, setSelectedPlazo] = useState<number>(() => {
    if (selectedDeviceRecord) return selectedDeviceRecord.plazo;
    return 36;
  });

  // Client info
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [customNotes, setCustomNotes] = useState('¡Promoción oficial vigente con redes sociales ilimitadas y Roaming USA/Canadá!');
  const [copied, setCopied] = useState(false);

  // Analysis UI expansion state
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);

  // Handle explicit model selection: keeps the user-selected plan and plazo!
  const handleSelectModel = (newModel: string) => {
    setSelectedModel(newModel);
  };

  // Sync selected model if list changes (case-insensitive and trimmed)
  React.useEffect(() => {
    if (
      uniqueModels.length > 0 &&
      !uniqueModels.some((m) => m.model.toLowerCase().trim() === selectedModel.toLowerCase().trim())
    ) {
      handleSelectModel(uniqueModels[0].model);
    }
  }, [uniqueModels, selectedModel]);

  // Sync selected plan if list changes
  React.useEffect(() => {
    if (plans.length > 0 && !plans.some((p) => p.name.toLowerCase().trim() === selectedPlanName.toLowerCase().trim())) {
      setSelectedPlanName(plans[0].name);
    }
  }, [plans, selectedPlanName]);

  // Find matching price record for current selection with resilient plan matching
  const matchingRecord = useMemo(() => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const selModel = selectedModel.toLowerCase().trim();
    const selPlan = selectedPlanName.toLowerCase().trim();
    const selPlanClean = clean(selectedPlanName);

    // 1. Direct exact match
    const exact = activePromoRecords.find(
      (r) =>
        r.model.toLowerCase().trim() === selModel &&
        r.planNombre.toLowerCase().trim() === selPlan &&
        Number(r.plazo) === Number(selectedPlazo)
    );
    if (exact) return exact;

    // 2. Base plan match (e.g. "Azul 3" matches "Azul 3 (14GB)")
    return activePromoRecords.find(
      (r) =>
        r.model.toLowerCase().trim() === selModel &&
        clean(r.planNombre) === selPlanClean &&
        Number(r.plazo) === Number(selectedPlazo)
    );
  }, [activePromoRecords, selectedModel, selectedPlanName, selectedPlazo]);

  // Selected Plan Object
  const currentPlan = useMemo(() => {
    return plans.find((p) => p.name.toLowerCase().trim() === selectedPlanName.toLowerCase().trim()) || {
      id: 'custom',
      name: selectedPlanName,
      monthlyPrice: matchingRecord?.costoPlan || 0,
    };
  }, [plans, selectedPlanName, matchingRecord]);

  // Promotional price from record
  const precioPromocion = useMemo(() => {
    if (matchingRecord) return matchingRecord.precioPromocion;
    return 0;
  }, [matchingRecord]);

  const costoPlan = Number(currentPlan?.monthlyPrice || 0);

  // Reference Market Cash Price (Precio de Contado CONSTANTE del modelo)
  // Calcula el valor retail real en mercado del modelo para evaluar fielmente la regla del 30%
  const defaultPrecioContado = useMemo(() => {
    const modelRecords = activePromoRecords.filter(
      (r) => r.model.toLowerCase().trim() === selectedModel.toLowerCase().trim()
    );
    if (modelRecords.length === 0) return Math.round((precioPromocion || 0) * 1.25);
    const maxContado = Math.max(...modelRecords.map((r) => Number(r.precioContado || 0)));
    const maxPromo = Math.max(...modelRecords.map((r) => Number(r.precioPromocion || 0)));
    return maxContado > 0 ? maxContado : Math.round(maxPromo * 1.25);
  }, [activePromoRecords, selectedModel, precioPromocion]);

  const [customPrecioContado, setCustomPrecioContado] = useState<number | null>(null);
  const [isEditingContado, setIsEditingContado] = useState(false);

  // Reset custom precio contado when model changes
  React.useEffect(() => {
    setCustomPrecioContado(null);
    setIsEditingContado(false);
  }, [selectedModel]);

  const precioContado = customPrecioContado !== null && customPrecioContado > 0
    ? customPrecioContado
    : defaultPrecioContado;

  // Available plans for currently selected model
  const availablePlansForModel = useMemo(() => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const modelMatches = activePromoRecords.filter(
      (r) => r.model.toLowerCase().trim() === selectedModel.toLowerCase().trim()
    );
    const set = new Set(modelMatches.map((r) => clean(r.planNombre)));
    return plans.filter((p) => set.has(clean(p.name)));
  }, [activePromoRecords, selectedModel, plans]);

  // If the current plan is not available for this model, auto-switch to first available plan for it
  React.useEffect(() => {
    if (availablePlansForModel.length > 0) {
      const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
      const currentClean = clean(selectedPlanName);
      const isAvailable = availablePlansForModel.some((p) => clean(p.name) === currentClean);
      if (!isAvailable) {
        setSelectedPlanName(availablePlansForModel[0].name);
      }
    }
  }, [availablePlansForModel, selectedPlanName]);

  // Available plazos for current model & plan
  const availablePlazos = useMemo(() => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const selPlanClean = clean(selectedPlanName);
    const matches = activePromoRecords.filter(
      (r) =>
        r.model.toLowerCase().trim() === selectedModel.toLowerCase().trim() &&
        clean(r.planNombre) === selPlanClean
    );
    if (matches.length > 0) {
      const set = new Set(matches.map((r) => r.plazo));
      return [24, 30, 36].filter((p) => set.has(p));
    }
    const allMatches = activePromoRecords.filter(
      (r) => r.model.toLowerCase().trim() === selectedModel.toLowerCase().trim()
    );
    const set = new Set(allMatches.map((r) => r.plazo));
    return [24, 30, 36].filter((p) => set.has(p));
  }, [activePromoRecords, selectedModel, selectedPlanName]);

  // Auto-switch plazo if current plazo is not available for this model
  React.useEffect(() => {
    if (availablePlazos.length > 0 && !availablePlazos.includes(selectedPlazo)) {
      setSelectedPlazo(availablePlazos[availablePlazos.length - 1]);
    }
  }, [availablePlazos, selectedPlazo]);

  // =========================================================================
  // REGLA OFICIAL MUTUAMENTE EXCLUYENTE:
  // "Es una cosa u otra, solo pueden pedirte enganche o rentas por adelantado...
  // Si precioPromocion < 0.30 * precioContado -> NO PIDEN ENGANCHE, PIDEN RENTAS POR ADELANTADO (3 rentas).
  // De lo contrario (hasta 70% de descuento) -> PIDEN ENGANCHE (máximo 50% de precioPromocion)".
  // =========================================================================
  const goldenRule = useMemo(() => {
    return evaluateGoldenRule(precioPromocion, precioContado, costoPlan);
  }, [precioPromocion, precioContado, costoPlan]);

  const isRentasAdelantadas = goldenRule.tipoPagoInicial === 'rentas_adelantadas';
  const numRentasAdelantadas = isRentasAdelantadas ? 3 : 0;
  const montoRentasAdelantadas = isRentasAdelantadas ? Math.round(3 * costoPlan * 100) / 100 : 0;

  // Enganche percent presets (para cuando pide enganche): 10%, 20%, 30%, 40%, 50% (máximo permitido)
  const [chosenPercent, setChosenPercent] = useState<number>(50); // Default 50% as requested
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const maxEnganche50 = useMemo(() => {
    return Math.round((precioPromocion * 0.50) * 100) / 100;
  }, [precioPromocion]);
  const [customEngancheInput, setCustomEngancheInput] = useState<number>(maxEnganche50);

  // Sync custom input with max when price changes
  React.useEffect(() => {
    setCustomEngancheInput(maxEnganche50);
  }, [maxEnganche50]);

  // Monto de Enganche (solo existe si la regla exige enganche)
  const montoEnganche = useMemo(() => {
    if (isRentasAdelantadas || precioPromocion === 0) return 0;
    if (isCustomAmount) {
      return Math.min(Math.max(0, customEngancheInput), maxEnganche50);
    }
    return Math.round((precioPromocion * (chosenPercent / 100)) * 100) / 100;
  }, [isRentasAdelantadas, precioPromocion, isCustomAmount, customEngancheInput, maxEnganche50, chosenPercent]);

  const porcentajeEngancheEfectivo = useMemo(() => {
    if (isRentasAdelantadas || precioPromocion === 0) return 0;
    return Math.round((montoEnganche / precioPromocion) * 100);
  }, [isRentasAdelantadas, precioPromocion, montoEnganche]);

  // Pago Inicial Efectivo requerido para esta combinación
  const pagoInicialEfectivo = useMemo(() => {
    if (isRentasAdelantadas) {
      return montoRentasAdelantadas; // 3 rentas del plan
    }
    return montoEnganche; // 50% enganche (o elegido)
  }, [isRentasAdelantadas, montoRentasAdelantadas, montoEnganche]);

  // Saldo financiado de equipo
  const montoFinanciado = useMemo(() => {
    if (isRentasAdelantadas) {
      // 100% financed because initial payment was strictly advance plan rent, $0 equipment down payment
      return precioPromocion;
    }
    return Math.max(0, Math.round((precioPromocion - montoEnganche) * 100) / 100);
  }, [isRentasAdelantadas, precioPromocion, montoEnganche]);

  const mensualidadEquipo = useMemo(() => {
    if (selectedPlazo === 0) return 0;
    return Math.round((montoFinanciado / selectedPlazo) * 100) / 100;
  }, [montoFinanciado, selectedPlazo]);

  const mensualidadTotal = useMemo(() => {
    return Math.round((mensualidadEquipo + costoPlan) * 100) / 100;
  }, [mensualidadEquipo, costoPlan]);

  // =========================================================================
  // ANÁLISIS GLOBAL: CHECAR EN TODOS LOS PLAZOS Y PLANES CUÁL PIDE MENOR PAGO INICIAL
  // (Contemplando el 50% de enganche o las 3 rentas por adelantado que pudieran pedir)
  // =========================================================================
  const paymentAnalysis = useMemo(() => {
    return analyzeLowestInitialPaymentForModel(
      activePromoRecords,
      selectedModel,
      customPrecioContado || undefined
    );
  }, [activePromoRecords, selectedModel, customPrecioContado]);

  // Format toggle: Image Card vs Text
  const [quoteFormat, setQuoteFormat] = useState<'image' | 'text'>('image');

  // Structured Data for High-Converting Image Card
  const quoteData: QuoteImageData = useMemo(() => {
    return {
      clientName,
      clientPhone,
      brand: matchingRecord?.brand || uniqueModels.find((m) => m.model === selectedModel)?.brand || 'AT&T',
      model: selectedModel || 'Equipo AT&T',
      planName: currentPlan?.name || 'AT&T',
      costoPlan,
      plazo: selectedPlazo,
      precioPromocion,
      precioContado,
      esMenor30Contado: isRentasAdelantadas,
      tipoPagoInicial: isRentasAdelantadas ? 'rentas_adelantadas' : 'enganche',
      numRentasAdelantadas,
      montoRentasAdelantadas,
      porcentajeEnganche: porcentajeEngancheEfectivo,
      montoEnganche: isRentasAdelantadas ? montoRentasAdelantadas : montoEnganche,
      montoFinanciado,
      mensualidadEquipo,
      mensualidadTotal,
      customNotes,
    };
  }, [
    clientName,
    clientPhone,
    matchingRecord,
    uniqueModels,
    selectedModel,
    currentPlan,
    costoPlan,
    selectedPlazo,
    precioPromocion,
    precioContado,
    isRentasAdelantadas,
    numRentasAdelantadas,
    montoRentasAdelantadas,
    porcentajeEngancheEfectivo,
    montoEnganche,
    montoFinanciado,
    mensualidadEquipo,
    mensualidadTotal,
    customNotes,
  ]);

  // WhatsApp Message Generator
  const whatsappMessage = useMemo(() => {
    const greeting = clientName ? `¡Hola ${clientName}! 👋` : '¡Hola! 👋';

    if (isRentasAdelantadas) {
      return (
`${greeting}
Te comparto tu cotización oficial de *AT&T Premium* (Promoción Vigente):

📱 *Equipo:* ${selectedModel || 'Equipo AT&T'}
📶 *Plan AT&T:* ${currentPlan?.name || 'Plan AT&T'} ($${Number(costoPlan || 0).toLocaleString('es-MX')}/mes)
⏱️ *Plazo:* ${selectedPlazo || 36} meses

━━━━━━━━━━━━━━━━━━━━━
🌟 *MODALIDAD DE PAGO INICIAL: 3 RENTAS POR ADELANTADO*
• *Precio de Contado en Mercado:* $${Number(precioContado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
• *Precio de Promoción con Plan:* $${Number(precioPromocion || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${goldenRule.porcentajeDelContado}% del valor de contado)
• *Condición Oficial:* Al ser menor al 30% del precio de contado ($${Number(goldenRule.umbral30Contado || 0).toLocaleString('es-MX')}), ¡NO SE PIDE ENGANCHE DE EQUIPO!
• *Enganche de Equipo:* $0.00 (¡$0.00 de Enganche!)
• *Pago Inicial Requerido:* 3 Rentas por Adelantado del Plan ($${Number(montoRentasAdelantadas || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })})
━━━━━━━━━━━━━━━━━━━━━
💰 *DESGLOSE MENSUAL:*
• *Mensualidad del Equipo:* $${Number(mensualidadEquipo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes
• *Costo del Plan:* $${Number(costoPlan || 0).toLocaleString('es-MX')}/mes

🔥 *MENSUALIDAD TOTAL A PAGAR:*
👉 *$${Number(mensualidadTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} al mes*
━━━━━━━━━━━━━━━━━━━━━

${customNotes ? `✨ *Beneficios:* ${customNotes}\n` : ''}
*Vigencia:* Promoción oficial vigente sujeta a validación.
¿Te gustaría iniciar tu trámite con esta promoción? ¡Solo requiero tu identificación para validar tu línea!`
      );
    }

    // Modalidad Enganche (precio promo >= 30% contado)
    return (
`${greeting}
Te comparto tu cotización oficial de *AT&T Premium* (Promoción Vigente):

📱 *Equipo:* ${selectedModel || 'Equipo AT&T'}
📶 *Plan AT&T:* ${currentPlan?.name || 'Plan AT&T'} ($${Number(costoPlan || 0).toLocaleString('es-MX')}/mes)
⏱️ *Plazo:* ${selectedPlazo || 36} meses

━━━━━━━━━━━━━━━━━━━━━
💳 *MODALIDAD DE PAGO INICIAL: ENGANCHE*
• *Precio de Contado en Mercado:* $${Number(precioContado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
• *Precio de Promoción con Plan:* $${Number(precioPromocion || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
• *Enganche Requerido (${porcentajeEngancheEfectivo || 50}%):* $${Number(montoEnganche || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
• *Rentas por Adelantado:* $0.00 (NO se piden rentas por adelantado)
• *Monto a Financiar:* $${Number(montoFinanciado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
• *Mensualidad del Equipo:* $${Number(mensualidadEquipo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes
• *Costo del Plan:* $${Number(costoPlan || 0).toLocaleString('es-MX')}/mes

🔥 *MENSUALIDAD TOTAL A PAGAR:*
👉 *$${Number(mensualidadTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} al mes*
━━━━━━━━━━━━━━━━━━━━━

${customNotes ? `✨ *Beneficios:* ${customNotes}\n` : ''}
*Vigencia:* Promoción oficial vigente sujeta a validación.
¿Te gustaría iniciar tu trámite con esta promoción? ¡Solo requiero tu identificación para validar tu línea!`
    );
  }, [
    clientName,
    selectedModel,
    currentPlan,
    costoPlan,
    selectedPlazo,
    precioPromocion,
    precioContado,
    goldenRule,
    isRentasAdelantadas,
    montoRentasAdelantadas,
    porcentajeEngancheEfectivo,
    montoEnganche,
    montoFinanciado,
    mensualidadEquipo,
    mensualidadTotal,
    customNotes,
  ]);

  // AI WhatsApp Pitch State (Gemini 3.8 Flash)
  const [aiPitchText, setAiPitchText] = useState<string>('');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [useAIPitch, setUseAIPitch] = useState(false);

  const handleGenerateAIPitch = async () => {
    if (!matchingRecord) return;
    try {
      setIsGeneratingPitch(true);
      const res = await fetch('/api/ai/whatsapp-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          brand: matchingRecord.brand,
          model: selectedModel,
          storage: matchingRecord.storage,
          plan: currentPlan.name,
          plazo: selectedPlazo,
          precioPromo: precioPromocion,
          precioContado,
          esMenor30Contado: isRentasAdelantadas,
          pagoInicial: pagoInicialEfectivo,
          tipoPagoInicial: isRentasAdelantadas ? 'rentas_adelantadas' : 'enganche',
          enganche: montoEnganche,
          porcentajeEnganche: porcentajeEngancheEfectivo,
          mensualidadTotal,
          costoPlan,
          sucursal: 'AT&T Alsuper Robinson',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pitch) {
          setAiPitchText(data.pitch);
          setUseAIPitch(true);
        }
      }
    } catch (err) {
      console.warn('Error generating AI pitch:', err);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  const effectiveMessage = (useAIPitch && aiPitchText) ? aiPitchText : whatsappMessage;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(effectiveMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(effectiveMessage);
    const cleanNumber = clientPhone.replace(/\D/g, '');
    const url = cleanNumber
      ? `https://wa.me/52${cleanNumber}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Helper to apply best option from analysis
  const handleApplyOption = (opt: PlanPlazoOptionComparison) => {
    setSelectedPlanName(opt.planNombre);
    setSelectedPlazo(opt.plazo);
    if (opt.tipoPagoInicial === 'enganche') {
      setChosenPercent(50);
      setIsCustomAmount(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Missing Table Warning */}
      {isTableMissing && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-amber-300">FALTA VINCULAR TABLA DE PRECIOS</h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                El cotizador no puede calcular mensualidades oficiales ni enganches porque no hay una lista de precios con vigencia activa cargada.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                {onNavigateToInbox && (
                  <button
                    onClick={onNavigateToInbox}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-3 py-1.5 rounded-lg font-semibold text-xs transition"
                  >
                    Ir a Bandeja / Cargar Archivo
                  </button>
                )}
                {onNavigateToPlanes && (
                  <button
                    onClick={onNavigateToPlanes}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  >
                    Ver Planes Disponibles
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Inputs on Left, Visual/Text Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Device, Plan, Plazo, Analysis & Pago Inicial */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Configuración del Financiamiento AT&amp;T</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">Sucursal: AT&amp;T Alsuper Robinson</span>
            </div>

            {/* 1. SELECCIÓN INTUITIVA DE EQUIPO: MARCA, MODELO Y ALMACENAMIENTO */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
              <DeviceFinancingSelector
                records={activePromoRecords}
                selectedModel={selectedModel}
                onSelectModel={handleSelectModel}
              />
            </div>

            {/* ========================================================================= */}
            {/* 2. ANÁLISIS OFICIAL: EN QUÉ PLAN Y PLAZO PIDEN MENOR PAGO INICIAL         */}
            {/* Contemplando 50% de enganche o 3 rentas por adelantado que pudieran pedir  */}
            {/* ========================================================================= */}
            <div className="bg-gradient-to-r from-slate-950 via-[#071328] to-slate-950 border-2 border-cyan-500/50 rounded-2xl p-4 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                    <Trophy className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center space-x-1.5">
                      <span>Análisis Oficial: Menor Pago Inicial entre Planes y Plazos</span>
                    </h4>
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span>Precio de Contado:</span>
                      {isEditingContado ? (
                        <div className="inline-flex items-center space-x-1">
                          <span className="text-white font-bold">$</span>
                          <input
                            type="number"
                            value={customPrecioContado !== null ? customPrecioContado : defaultPrecioContado}
                            onChange={(e) => setCustomPrecioContado(Number(e.target.value) || 0)}
                            className="w-20 bg-slate-900 border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-white font-bold focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setIsEditingContado(false)}
                            className="bg-cyan-600 text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-cyan-500 font-bold cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center space-x-1.5">
                          <strong className="text-white font-bold text-xs">
                            ${precioContado.toLocaleString('es-MX')}
                          </strong>
                          <button
                            type="button"
                            onClick={() => setIsEditingContado(true)}
                            title="Ajustar o corregir precio de contado manualmente"
                            className="text-slate-400 hover:text-cyan-300 p-0.5 rounded transition cursor-pointer"
                          >
                            <Pencil className="w-3 h-3 text-cyan-400" />
                          </button>
                          {customPrecioContado !== null && (
                            <button
                              type="button"
                              onClick={() => setCustomPrecioContado(null)}
                              className="text-[9px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                              title="Restablecer precio del sistema"
                            >
                              (Personalizado • Restablecer)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Regla Oficial:</span>
                  <span className="text-[10px] text-cyan-300 font-semibold">
                    &lt; 30% Contado = 3 Rentas | &ge; 30% = 50% Enganche
                  </span>
                </div>
              </div>

              {/* 🏆 Ganador Absoluto: Plan y Plazo que exige MENOS dinero de inicio */}
              {paymentAnalysis.bestInitialOption && (
                <div className="bg-gradient-to-r from-emerald-950/80 via-cyan-950/80 to-emerald-950/80 border-2 border-emerald-500/70 p-3.5 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase text-amber-300 tracking-wider">
                      <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span>Opción Ganadora: Menor Pago Inicial de Todos los Planes y Plazos:</span>
                    </div>
                    <div className="text-sm font-black text-white flex items-center space-x-2">
                      <span>Plan {paymentAnalysis.bestInitialOption.planNombre} a {paymentAnalysis.bestInitialOption.plazo} Meses</span>
                    </div>
                    <div className="text-xs text-emerald-300 font-semibold flex items-center space-x-1.5 flex-wrap">
                      <span>Pago Inicial: <strong className="text-white text-sm">${paymentAnalysis.bestInitialOption.pagoInicialRequerido.toLocaleString('es-MX')}</strong></span>
                      <span className="text-slate-300">({paymentAnalysis.bestInitialOption.pagoInicialConcepto})</span>
                      <span className="text-cyan-300">• Mensualidad: ${paymentAnalysis.bestInitialOption.mensualidadTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyOption(paymentAnalysis.bestInitialOption!)}
                    className="shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Aplicar Este Plan y Plazo</span>
                  </button>
                </div>
              )}

              {/* Botón para expandir la matriz comparativa de todos los planes y plazos */}
              <button
                type="button"
                onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                className="w-full text-center text-xs text-cyan-400 hover:text-cyan-300 font-semibold pt-1 flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>
                  {isAnalysisExpanded
                    ? '▲ Ocultar matriz comparativa de todos los planes y plazos'
                    : `▼ Ver comparativa de todos los planes y plazos (${paymentAnalysis.options.length} opciones)`}
                </span>
                {isAnalysisExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Matriz comparativa completa de todos los planes y plazos */}
              {isAnalysisExpanded && (
                <div className="pt-2 border-t border-slate-800 space-y-2 animate-fadeIn">
                  <div className="text-[10px] text-slate-400 font-medium">
                    Evaluación de cada plan y plazo: si el precio promo es &lt; 30% del contado se contemplan 3 rentas por adelantado ($0 enganche), de lo contrario se contempla el 50% de enganche.
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Plan</th>
                          <th className="py-2.5 px-2">Plazo</th>
                          <th className="py-2.5 px-2 text-right">Precio Promo</th>
                          <th className="py-2.5 px-2 text-center">% Contado</th>
                          <th className="py-2.5 px-3">¿Qué pide AT&amp;T?</th>
                          <th className="py-2.5 px-3 text-right">Pago Inicial</th>
                          <th className="py-2.5 px-2.5 text-right">Mensualidad</th>
                          <th className="py-2.5 px-2.5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {paymentAnalysis.options.map((opt, i) => {
                          const isCurrent =
                            opt.planNombre.toLowerCase().trim() === selectedPlanName.toLowerCase().trim() &&
                            Number(opt.plazo) === Number(selectedPlazo);

                          return (
                            <tr
                              key={i}
                              className={`transition ${
                                isCurrent
                                  ? 'bg-cyan-950/50 text-cyan-200 font-bold'
                                  : 'hover:bg-slate-900/60 text-slate-300'
                              }`}
                            >
                              <td className="py-2 px-3 font-semibold text-white">
                                {opt.planNombre}
                              </td>
                              <td className="py-2 px-2 text-slate-400">{opt.plazo}m</td>
                              <td className="py-2 px-2 text-right text-slate-300">
                                ${opt.precioPromocion.toLocaleString('es-MX')}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-400 text-[11px]">
                                {opt.porcentajeDelContado}%
                              </td>
                              <td className="py-2 px-3">
                                {opt.tipoPagoInicial === 'rentas_adelantadas' ? (
                                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-md font-bold inline-flex items-center space-x-1">
                                    <span>🌟 3 Rentas ($0 Eng)</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-medium inline-flex items-center space-x-1">
                                    <span>💳 50% Enganche</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-black">
                                <span className="text-emerald-400 text-xs">
                                  ${opt.pagoInicialRequerido.toLocaleString('es-MX')}
                                </span>
                                {opt.isLowestInitialPayment && (
                                  <span className="ml-1.5 text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-black uppercase">
                                    🏆 Menor
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-right text-slate-200">
                                ${opt.mensualidadTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m
                              </td>
                              <td className="py-2 px-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleApplyOption(opt)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer ${
                                    isCurrent
                                      ? 'bg-cyan-500 text-slate-950 font-black'
                                      : 'bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-300'
                                  }`}
                                >
                                  {isCurrent ? 'Actual' : 'Elegir'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Plan Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Selecciona el Plan AT&amp;T</span>
                </span>
                {costoPlan > 0 && (
                  <span className="text-[11px] text-cyan-400 font-medium">
                    Renta Plan: ${Number(costoPlan || 0).toLocaleString('es-MX')}/mes
                  </span>
                )}
              </label>
              {plans.length === 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 text-center">
                  Falta vincular tabla para cargar los planes oficiales.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {plans.map((p) => {
                    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
                    const isSelected = clean(selectedPlanName) === clean(p.name);
                    const isOfferedForModel = availablePlansForModel.some(
                      (ap) => clean(ap.name) === clean(p.name)
                    );
                    const isOptimalPlan =
                      paymentAnalysis.bestInitialOption &&
                      clean(paymentAnalysis.bestInitialOption.planNombre) === clean(p.name);

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanName(p.name)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-cyan-950 border-cyan-500 ring-1 ring-cyan-500/40 text-white shadow-md'
                            : isOfferedForModel
                            ? 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                            : 'bg-slate-950/50 border-slate-900 text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-white">{p.name}</span>
                          {isOptimalPlan ? (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-black uppercase">
                              🏆 Menor
                            </span>
                          ) : !isOfferedForModel ? (
                            <span className="text-[9px] text-slate-500">
                              No aplica
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-medium">
                          ${Number(p.monthlyPrice || 0).toLocaleString('es-MX')}/mes
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Plazo Selector (24, 30, 36 meses) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Plazo de Financiamiento</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[24, 30, 36].map((p) => {
                  const isSelected = selectedPlazo === p;
                  const isOptimalPlazo = paymentAnalysis.bestInitialOption?.plazo === p;

                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPlazo(p)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                        isSelected
                          ? 'bg-cyan-600 border-cyan-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{p} Meses</span>
                      {isOptimalPlazo && (
                        <span className={`text-[9px] px-1 rounded font-black uppercase ${
                          isSelected ? 'bg-black/30 text-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          🏆 Menor
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 5. MODALIDAD DE PAGO INICIAL EXIGIDA PARA ESTA SELECCIÓN ACTUAL            */}
            {/* Es una cosa u otra: o pide 3 rentas por adelantado o pide enganche         */}
            {/* ========================================================================= */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
              {isRentasAdelantadas ? (
                // CASO A: PRECIO PROMO < 30% CONTADO -> PIDEN RENTAS POR ADELANTADO (3 RENTAS). NO PIDEN ENGANCHE.
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                        Modalidad Exigida: 3 Rentas por Adelantado
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-500/50">
                      Pago Inicial: ${montoRentasAdelantadas.toLocaleString('es-MX')}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/40 text-xs text-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between font-bold">
                      <span>✓ Enganche de Equipo:</span>
                      <span className="text-white text-sm font-black">$0.00 (¡NO SE PIDE ENGANCHE!)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">✓ Rentas por Adelantado exigidas:</span>
                      <span className="font-bold text-white">3 rentas de ${costoPlan.toLocaleString('es-MX')} = ${montoRentasAdelantadas.toLocaleString('es-MX')}</span>
                    </div>
                    <p className="text-[10px] text-emerald-300/80 pt-1 border-t border-emerald-900/60 leading-relaxed">
                      El precio de promoción actual ($${precioPromocion.toLocaleString('es-MX')}) es menor al 30% del valor de contado ($${goldenRule.umbral30Contado.toLocaleString('es-MX')}). Por regla oficial de AT&amp;T, únicamente se solicitan 3 rentas por adelantado del plan contratado.
                    </p>
                  </div>
                </div>
              ) : (
                // CASO B: PRECIO PROMO >= 30% CONTADO -> PIDEN ENGANCHE (MÁXIMO 50%). NO PIDEN RENTAS POR ADELANTADO.
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                        Modalidad Exigida: Enganche (Máx. 50%)
                      </span>
                    </div>
                    <span className="text-xs font-black text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-500/50">
                      Pago Inicial: ${montoEnganche.toLocaleString('es-MX')} ({porcentajeEngancheEfectivo}%)
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                    <span>Rentas por Adelantado:</span>
                    <span className="font-bold text-slate-400">$0.00 (NO se piden rentas por adelantado)</span>
                  </div>

                  {/* Selector de Porcentaje de Enganche (10% a 50%) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Porcentaje de Enganche Comercial:</span>
                      <span className="text-cyan-400 font-bold">{porcentajeEngancheEfectivo}% (${montoEnganche.toLocaleString('es-MX')})</span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {[10, 20, 30, 40, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setIsCustomAmount(false);
                            setChosenPercent(pct);
                          }}
                          className={`py-2 rounded-lg font-bold border transition text-center cursor-pointer ${
                            !isCustomAmount && chosenPercent === pct
                              ? 'bg-cyan-950 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/40'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pct === 50 ? '50% (Máx)' : `${pct}%`}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setIsCustomAmount(!isCustomAmount)}
                        className="text-cyan-400 hover:text-cyan-300 font-medium text-[11px] underline cursor-pointer"
                      >
                        {isCustomAmount ? '← Usar botones de porcentaje' : 'O teclear cantidad en pesos'}
                      </button>
                      {isCustomAmount && (
                        <span className="text-[11px] text-slate-400">
                          Máximo permitido (50%): ${maxEnganche50.toLocaleString('es-MX')}
                        </span>
                      )}
                    </div>

                    {isCustomAmount && (
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            max={maxEnganche50}
                            step="50"
                            value={customEngancheInput}
                            onChange={(e) => setCustomEngancheInput(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                          />
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={maxEnganche50}
                          step="50"
                          value={customEngancheInput}
                          onChange={(e) => setCustomEngancheInput(Number(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 6. Client Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1 flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>Nombre del Cliente (Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1 flex items-center space-x-1">
                  <Phone className="w-3 h-3" />
                  <span>Teléfono WhatsApp (10 dígitos)</span>
                </label>
                <input
                  type="tel"
                  placeholder="Ej. 5512345678"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Calculations & WhatsApp Preview */}
        <div className="lg:col-span-5 space-y-6">
          {/* Calculation Result Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-800/40 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs uppercase tracking-wider font-bold text-cyan-400">
                Desglose de Mensualidad
              </span>
              <span className="bg-cyan-950 text-cyan-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-cyan-800">
                Fórmula Oficial AT&amp;T
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Precio de Contado en Mercado:</span>
                <span className="font-semibold text-white">
                  ${precioContado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Precio de Promoción Actual:</span>
                <span className="font-semibold text-white">
                  {precioPromocion > 0
                    ? `$${Number(precioPromocion || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                    : 'No disponible con este plan'}
                </span>
              </div>

              {isRentasAdelantadas ? (
                <div className="flex justify-between items-center py-2 bg-emerald-950/50 px-3 rounded-xl border border-emerald-500/50">
                  <div>
                    <span className="text-emerald-300 font-black block">Pago Inicial (3 Rentas):</span>
                    <span className="text-[10px] text-emerald-400">¡$0.00 de enganche de equipo!</span>
                  </div>
                  <span className="font-black text-emerald-400 text-base">
                    ${Number(pagoInicialEfectivo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center py-2 bg-cyan-950/50 px-3 rounded-xl border border-cyan-500/50">
                  <div>
                    <span className="text-cyan-300 font-black block">Enganche Requerido ({porcentajeEngancheEfectivo}%):</span>
                    <span className="text-[10px] text-slate-400">Sin rentas por adelantado</span>
                  </div>
                  <span className="font-black text-cyan-400 text-base">
                    ${Number(montoEnganche || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Saldo Restante a Financiar:</span>
                <span className="font-medium text-slate-300">
                  ${Number(montoFinanciado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-slate-800/60 pt-2">
                <span className="text-slate-400">
                  Mensualidad Equipo ({selectedPlazo}m):
                </span>
                <span className="font-bold text-slate-200">
                  ${Number(mensualidadEquipo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Renta Mensual Plan {currentPlan.name}:</span>
                <span className="font-bold text-slate-200">
                  {costoPlan > 0
                    ? `$${Number(costoPlan || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes`
                    : '-'}
                </span>
              </div>

              <div className="pt-3 border-t-2 border-cyan-500/40 flex justify-between items-baseline">
                <div>
                  <span className="text-xs uppercase tracking-wider font-extrabold text-white block">
                    Mensualidad Total:
                  </span>
                  <span className="text-[10px] text-slate-400">Equipo financiado + Plan</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400">
                    ${Number(mensualidadTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-slate-400">/mes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggle View: Visual Image Card vs WhatsApp Text */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setQuoteFormat('image')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                  quoteFormat === 'image'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Tarjeta Visual (Imagen HD)</span>
              </button>

              <button
                type="button"
                onClick={() => setQuoteFormat('text')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                  quoteFormat === 'text'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Texto WhatsApp Oficial</span>
              </button>
            </div>

            {quoteFormat === 'image' ? (
              <VisualQuoteCard quoteData={quoteData} />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center space-x-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Texto Listo para WhatsApp</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateAIPitch}
                    disabled={isGeneratingPitch || !matchingRecord}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold px-2.5 py-1 rounded-lg border border-cyan-800 flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    <span>{isGeneratingPitch ? 'Creando...' : 'Optimizar con IA'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {effectiveMessage}
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Abrir en WhatsApp</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
