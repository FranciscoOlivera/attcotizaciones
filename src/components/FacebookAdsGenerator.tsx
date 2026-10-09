import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Smartphone,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  FolderArchive,
  Search,
  MessageCircle,
  ExternalLink,
  Flame,
  AlertTriangle,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Radio,
  Star,
  Zap,
  ShieldCheck,
  Video,
  CheckSquare,
  Square,
  Sliders,
  Filter,
  Tag,
  ArrowRight,
  Table,
} from 'lucide-react';
import { DevicePriceRecord, ATTPlan } from '../types/pricing';
import { deduplicateDeviceRecords, getLatestModelsPerBrand } from '../utils/recordDeduplicator';
import {
  FacebookAdData,
  calculateAdFinancials,
  generateFacebookAdCanvas,
  renderFacebookAdToCanvas,
  downloadFacebookAdImage,
  copyFacebookAdToClipboard,
  downloadBatchFacebookAdsZip,
  isTikTokIncludedInPlan,
} from '../utils/facebookAdImageGenerator';

interface FacebookAdsGeneratorProps {
  records: DevicePriceRecord[];
  plans?: ATTPlan[];
  theme?: 'dark' | 'light';
  onNavigateToInbox?: () => void;
  onNavigateToQuoter?: (record: DevicePriceRecord) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const getMonthlyCampaignThemes = (monthIndex: number) => {
  switch (monthIndex) {
    case 9: // Octubre (Halloween, Día de Muertos, Otoño, etc.)
      return [
        { id: 'halloween', label: 'Especial Halloween (Ofertas de Miedo 🎃)', icon: '🎃' },
        { id: 'dia-de-muertos', label: 'Día de Muertos (Promociones de Leyenda 💀)', icon: '💀' },
        { id: 'otono', label: 'Especial Octubre / Otoño (Sin Sustos en tu Mensualidad 🍂)', icon: '🍂' },
        { id: 'preventa-buen-fin', label: 'Preventa Anticipada Buen Fin (Precios Congelados 🛍️)', icon: '🛍️' },
        { id: 'cyber-octubre', label: 'Cyber Octubre / Festival de Tecnología ⚡', icon: '⚡' },
        { id: 'lanzamientos', label: 'Lanzamientos 2026 / Gama Alta (Cyber Cyan 🚀)', icon: '🚀' },
        { id: 'aniversario', label: 'Aniversario Sucursal Alsuper Robinson 🏬', icon: '🏬' },
        { id: 'custom', label: 'Personalizado...', icon: '✨' },
      ];
    case 10: // Noviembre (Buen Fin, Black Friday)
      return [
        { id: 'buen-fin', label: 'Gran Venta Buen Fin & Black Friday (Neón & Oro 🛍️)', icon: '🛍️' },
        { id: 'dia-de-muertos', label: 'Día de Muertos (Tradición Mexicana 💀)', icon: '💀' },
        { id: 'cyber-octubre', label: 'Cyber Monday / Mega Descuentos 💻', icon: '💻' },
        { id: 'lanzamientos', label: 'Lanzamientos 2026 / Gama Alta 🚀', icon: '🚀' },
        { id: 'aniversario', label: 'Aniversario Sucursal Alsuper Robinson 🏬', icon: '🏬' },
        { id: 'custom', label: 'Personalizado...', icon: '✨' },
      ];
    case 11: // Diciembre (Navidad, Fin de Año)
      return [
        { id: 'navidad', label: 'Especial Navideño & Fin de Año (Zafiro & Oro 🎄)', icon: '🎄' },
        { id: 'lanzamientos', label: 'Lanzamientos 2026 / Gama Alta 🚀', icon: '🚀' },
        { id: 'aniversario', label: 'Aniversario Sucursal Alsuper Robinson 🏬', icon: '🏬' },
        { id: 'custom', label: 'Personalizado...', icon: '✨' },
      ];
    case 8: // Septiembre (Fiestas Patrias)
      return [
        { id: 'fiestas-patrias', label: 'Fiestas Patrias / Septiembre (Tricolor 🇲🇽)', icon: '🇲🇽' },
        { id: 'lanzamientos', label: 'Lanzamientos 2026 / Gama Alta 🚀', icon: '🚀' },
        { id: 'aniversario', label: 'Aniversario Sucursal Alsuper Robinson 🏬', icon: '🏬' },
        { id: 'custom', label: 'Personalizado...', icon: '✨' },
      ];
    default:
      return [
        { id: 'halloween', label: 'Especial Halloween (Ofertas de Miedo 🎃)', icon: '🎃' },
        { id: 'dia-de-muertos', label: 'Día de Muertos (Promociones de Leyenda 💀)', icon: '💀' },
        { id: 'otono', label: 'Especial Octubre / Otoño (Sin Sustos 🍂)', icon: '🍂' },
        { id: 'lanzamientos', label: 'Lanzamientos 2026 / Gama Alta 🚀', icon: '🚀' },
        { id: 'aniversario', label: 'Aniversario Sucursal Alsuper Robinson 🏬', icon: '🏬' },
        { id: 'custom', label: 'Personalizado...', icon: '✨' },
      ];
  }
};

export const FacebookAdsGenerator: React.FC<FacebookAdsGeneratorProps> = ({
  records,
  plans = [],
  theme = 'dark',
  onNavigateToInbox,
  onNavigateToQuoter,
}) => {
  const isDark = theme === 'dark';

  // Current Month detection
  const currentMonthIndex = useMemo(() => new Date().getMonth(), []);
  const currentMonthName = useMemo(() => {
    return MONTH_NAMES[currentMonthIndex] || 'Octubre';
  }, [currentMonthIndex]);

  const popularCampaignThemes = useMemo(() => {
    return getMonthlyCampaignThemes(currentMonthIndex);
  }, [currentMonthIndex]);

  // Campaign Settings - default to Halloween during October
  const [sucursal, setSucursal] = useState('AT&T Alsuper Robinson');
  const [selectedThemePreset, setSelectedThemePreset] = useState<string>(() => {
    return currentMonthIndex === 9 ? 'halloween' : (getMonthlyCampaignThemes(currentMonthIndex)[0]?.id || 'halloween');
  });
  const [customThemeName, setCustomThemeName] = useState('');
  const [campaignTone, setCampaignTone] = useState<'urgente' | 'asesoria' | 'exclusividad'>('urgente');
  const [aiPostFormat, setAiPostFormat] = useState<'facebook_post' | 'whatsapp_broadcast' | 'reels_script'>('facebook_post');
  const [adStyle, setAdStyle] = useState<'modern-friendly' | 'cyber-blue' | 'retail-pop' | 'titanium-dark'>('modern-friendly');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5'>('1:1');

  // Batch Plan & Plazo controls for multi-image download customization (User Requested)
  const [batchPlan, setBatchPlan] = useState<string>('ALL');
  const [batchPlazo, setBatchPlazo] = useState<string>('ALL');
  const [modelCustomConfig, setModelCustomConfig] = useState<Record<string, { plan?: string; plazo?: number }>>({});

  // Active Menu Section Tab: 'galeria' | 'diseno' | 'copys' | 'matriz'
  const [activeAdTab, setActiveAdTab] = useState<'galeria' | 'diseno' | 'copys' | 'matriz'>('galeria');

  // Display Mode: 'top-5-brand' | 'best-model' | 'all-variants'
  const [viewMode, setViewMode] = useState<'top-5-brand' | 'best-model' | 'all-variants'>('top-5-brand');

  // Filter & Search Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedPlan, setSelectedPlan] = useState('ALL');
  const [selectedPlazo, setSelectedPlazo] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Model Selector Modal State
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [pickerSearchTerm, setPickerSearchTerm] = useState('');
  const [pickerSelectedBrand, setPickerSelectedBrand] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);

  // Full-size Preview Modal
  const [previewModalAd, setPreviewModalAd] = useState<FacebookAdData | null>(null);

  // AI Headlines State
  const [aiHeadlines, setAiHeadlines] = useState<string[]>([]);
  const [isLoadingHeadlines, setIsLoadingHeadlines] = useState(false);

  // AI Copy State
  const [aiCopy, setAiCopy] = useState<string>('');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState<boolean>(false);
  const [isCopyCopied, setIsCopyCopied] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // Batch Zip State
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<string>('');

  const showToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 3500);
  };

  // ONLY equipment with active valid promotion (precioPromocion > 0 and valid plans)
  const activePromoRecords = useMemo(() => {
    return deduplicateDeviceRecords(
      records.filter((r) => r.precioPromocion > 0 && r.precioPromocion < 100000 && r.planNombre !== 'VIGENCIA')
    );
  }, [records]);

  // Master Map of model-level official cash price (Precio de Contado oficial)
  const modelContadoMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of activePromoRecords) {
      const key = (r.model || '').toLowerCase().trim();
      const val = Number(r.precioContado || 0);
      if (val > (map.get(key) || 0)) {
        map.set(key, val);
      }
    }
    return map;
  }, [activePromoRecords]);

  // Top 5 Latest Models per Brand
  const latestModelsByBrand = useMemo(() => {
    return getLatestModelsPerBrand(activePromoRecords, 5);
  }, [activePromoRecords]);

  // Derived effective theme title & ID
  const effectiveThemeId = useMemo(() => {
    if (selectedThemePreset === 'mes-actual') {
      const m = currentMonthName.toLowerCase();
      if (m.includes('octub')) return 'halloween';
      if (m.includes('nov')) return 'buen-fin';
      if (m.includes('dic')) return 'navidad';
      if (m.includes('sept') || m.includes('sep')) return 'fiestas-patrias';
      return 'halloween';
    }
    return selectedThemePreset;
  }, [selectedThemePreset, currentMonthName]);

  const currentEventTitle = useMemo(() => {
    if (selectedThemePreset === 'custom') {
      return customThemeName.trim() || `Especial de ${currentMonthName}`;
    }
    if (selectedThemePreset === 'halloween') {
      return '🎃 ¡Ofertas de Miedo! Especial de Halloween';
    }
    if (selectedThemePreset === 'dia-de-muertos') {
      return '💀 Día de Muertos: Promociones de Leyenda';
    }
    if (selectedThemePreset === 'otono') {
      return `🍂 Especial de ${currentMonthName}: Sin Sustos en tu Mensualidad`;
    }
    if (selectedThemePreset === 'cyber-octubre') {
      return '⚡ Cyber Octubre: Festival de Tecnología 2026';
    }
    if (selectedThemePreset === 'preventa-buen-fin') {
      return '🛍️ Preventa Anticipada: Precios Congelados';
    }
    if (selectedThemePreset === 'fiestas-patrias') {
      return '¡Viva México! Promociones Fiestas Patrias';
    }
    if (selectedThemePreset === 'buen-fin') {
      return 'Gran Venta Buen Fin & Black Friday';
    }
    if (selectedThemePreset === 'navidad') {
      return 'Especial Navideño & Fin de Año';
    }
    if (selectedThemePreset === 'lanzamientos') {
      return 'Lanzamientos 2026 en Promoción';
    }
    const preset = popularCampaignThemes.find((p) => p.id === selectedThemePreset);
    if (selectedThemePreset === 'mes-actual') {
      return `🎃 Gran Venta de ${currentMonthName}`;
    }
    return preset?.label || `Especial de ${currentMonthName}`;
  }, [selectedThemePreset, customThemeName, currentMonthName, popularCampaignThemes]);

  // Unique model catalog for the Model Picker
  // Configured with the Plan and Plazo that requires the LEAST INITIAL PAYMENT under official AT&T Golden Rule
  const uniqueModelsCatalog = useMemo(() => {
    const modelMap = new Map<string, DevicePriceRecord>();

    const getInitialPayment = (rec: DevicePriceRecord) => {
      const promo = Number(rec.precioPromocion || 0);
      const modelKey = (rec.model || '').toLowerCase().trim();
      const modelContado = modelContadoMap.get(modelKey) || Number(rec.precioContado || 0);
      const contado = modelContado > 0 ? modelContado : Math.round(promo * 1.25);
      const isUnder30 = contado > 0 && promo < 0.30 * contado;
      return isUnder30 ? Math.round(3 * rec.costoPlan * 100) / 100 : Math.round(0.50 * promo * 100) / 100;
    };

    for (const rec of activePromoRecords) {
      const key = `${(rec.brand || '').trim()}|${(rec.model || '').trim()}`.toLowerCase();
      if (!modelMap.has(key)) {
        modelMap.set(key, rec);
      } else {
        const existing = modelMap.get(key)!;
        const currentInitial = getInitialPayment(rec);
        const existingInitial = getInitialPayment(existing);

        if (
          currentInitial < existingInitial ||
          (currentInitial === existingInitial &&
            (rec.mensualidadTotalConMaxEnganche || rec.mensualidad) <
              (existing.mensualidadTotalConMaxEnganche || existing.mensualidad))
        ) {
          modelMap.set(key, rec);
        }
      }
    }
    return Array.from(modelMap.values()).sort((a, b) => {
      const brandCmp = a.brand.localeCompare(b.brand);
      if (brandCmp !== 0) return brandCmp;
      return b.precioPromocion - a.precioPromocion;
    });
  }, [activePromoRecords, modelContadoMap]);

  // Available brands in promo records
  const brands = useMemo(() => {
    const set = new Set<string>();
    activePromoRecords.forEach((a) => {
      if (a.brand) set.add(a.brand);
    });
    return Array.from(set).sort();
  }, [activePromoRecords]);

  // Available plans in promo records
  const availablePlans = useMemo(() => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const set = new Set<string>();
    activePromoRecords.forEach((r) => {
      if (r.planNombre) set.add(clean(r.planNombre));
    });
    // Sort with logical order if known
    const order = ['azul 1', 'azul 2', 'azul 3', 'plata', 'oro', 'black', 'platino', 'diamante'];
    return Array.from(set).sort((a, b) => {
      const iA = order.indexOf(a);
      const iB = order.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [activePromoRecords]);

  // Base records to show depending on viewMode and plan/plazo filter
  const baseAdRecords = useMemo(() => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const isPlanFiltered = selectedPlan !== 'ALL';
    const isPlazoFiltered = selectedPlazo !== 'ALL';

    // If specific plan or plazo filter is active, match each unique model to that exact combination
    if (isPlanFiltered || isPlazoFiltered) {
      const matchedMap = new Map<string, DevicePriceRecord>();
      const targetModels = viewMode === 'top-5-brand' ? latestModelsByBrand : uniqueModelsCatalog;

      for (const target of targetModels) {
        const cleanModel = target.model.toLowerCase().trim();
        // Look for exact record matching plan and plazo
        const matches = activePromoRecords.filter((r) => {
          const mMatch = r.model.toLowerCase().trim() === cleanModel;
          const pMatch =
            !isPlanFiltered ||
            clean(r.planNombre) === selectedPlan ||
            r.planNombre.toLowerCase().includes(selectedPlan);
          const zMatch = !isPlazoFiltered || String(r.plazo) === selectedPlazo;
          return mMatch && pMatch && zMatch;
        });

        if (matches.length > 0) {
          // Sort by lowest promotional price or lowest initial payment
          matches.sort((a, b) => a.precioPromocion - b.precioPromocion);
          matchedMap.set(cleanModel, matches[0]);
        }
      }

      if (viewMode === 'all-variants') {
        return activePromoRecords.filter((r) => {
          const pMatch =
            !isPlanFiltered ||
            clean(r.planNombre) === selectedPlan ||
            r.planNombre.toLowerCase().includes(selectedPlan);
          const zMatch = !isPlazoFiltered || String(r.plazo) === selectedPlazo;
          return pMatch && zMatch;
        });
      }

      // If targetModels had no exact match but there are records for this plan and plazo, show them directly
      if (matchedMap.size === 0) {
        const directMatches = activePromoRecords.filter((r) => {
          const pMatch =
            !isPlanFiltered ||
            clean(r.planNombre) === selectedPlan ||
            r.planNombre.toLowerCase().includes(selectedPlan);
          const zMatch = !isPlazoFiltered || String(r.plazo) === selectedPlazo;
          return pMatch && zMatch;
        });
        const grouped = new Map<string, DevicePriceRecord>();
        for (const r of directMatches) {
          const k = r.model.toLowerCase().trim();
          if (!grouped.has(k) || r.precioPromocion < grouped.get(k)!.precioPromocion) {
            grouped.set(k, r);
          }
        }
        return Array.from(grouped.values());
      }

      return Array.from(matchedMap.values());
    }

    if (viewMode === 'top-5-brand') {
      return latestModelsByBrand;
    }
    if (viewMode === 'all-variants') {
      return activePromoRecords;
    }
    return uniqueModelsCatalog;
  }, [activePromoRecords, latestModelsByBrand, uniqueModelsCatalog, viewMode, selectedPlan, selectedPlazo]);

  // Transform records into Facebook Ad Financials with dynamic theme styling
  const allAdsData = useMemo<FacebookAdData[]>(() => {
    return baseAdRecords.map((r) => {
      const modelKey = (r.model || '').toLowerCase().trim();
      const modelContado = modelContadoMap.get(modelKey) || Number(r.precioContado || 0);
      const data = calculateAdFinancials(r, sucursal, currentEventTitle, effectiveThemeId, modelContado);
      data.themeStyle = adStyle;
      data.aspectRatio = aspectRatio;
      return data;
    });
  }, [baseAdRecords, sucursal, currentEventTitle, effectiveThemeId, adStyle, aspectRatio, modelContadoMap]);

  // Filtered ads by brand and search term
  const filteredAds = useMemo(() => {
    return allAdsData.filter((ad) => {
      const matchesSearch =
        ad.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ad.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ad.planName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBrand = selectedBrand === 'ALL' || ad.brand.toLowerCase() === selectedBrand.toLowerCase();

      return matchesSearch && matchesBrand;
    });
  }, [allAdsData, searchTerm, selectedBrand]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBrand, selectedPlan, selectedPlazo, viewMode, pageSize]);

  // Paginated ads for display
  const totalPages = Math.max(1, Math.ceil(filteredAds.length / pageSize));
  const paginatedAds = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAds.slice(startIndex, startIndex + pageSize);
  }, [filteredAds, currentPage, pageSize]);

  // Initial selection: select the Top 5 models of each brand by default
  useEffect(() => {
    if (latestModelsByBrand.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(latestModelsByBrand.map((d) => d.id)));
    }
  }, [latestModelsByBrand]);

  // Available plans and plazos per model for custom bulk selection
  const modelOptions = useMemo(() => {
    const plansByModel = new Map<string, { planNombre: string; costoPlan: number }[]>();
    const plazosByModel = new Map<string, number[]>();
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();

    for (const r of activePromoRecords) {
      const k = (r.model || '').toLowerCase().trim();
      if (!k) continue;

      if (!plansByModel.has(k)) plansByModel.set(k, []);
      const pList = plansByModel.get(k)!;
      const cleanPlan = clean(r.planNombre || '');
      if (cleanPlan && !pList.some((p) => clean(p.planNombre) === cleanPlan)) {
        pList.push({ planNombre: r.planNombre, costoPlan: r.costoPlan });
      }

      if (!plazosByModel.has(k)) plazosByModel.set(k, []);
      const zList = plazosByModel.get(k)!;
      const plazoNum = Number(r.plazo || 36);
      if (plazoNum > 0 && !zList.includes(plazoNum)) {
        zList.push(plazoNum);
      }
    }

    for (const [, list] of plazosByModel) {
      list.sort((a, b) => b - a);
    }

    return { plansByModel, plazosByModel };
  }, [activePromoRecords]);

  // Resolve custom/batch plan & plazo record for a model
  const getConfiguredRecordForModel = (modelName: string): DevicePriceRecord | undefined => {
    const cleanM = (modelName || '').toLowerCase().trim();
    const recordsForModel = activePromoRecords.filter(
      (r) => (r.model || '').toLowerCase().trim() === cleanM
    );
    if (recordsForModel.length === 0) return undefined;

    const custom = modelCustomConfig[cleanM];
    const targetPlan = custom?.plan !== undefined ? custom.plan : (batchPlan !== 'ALL' ? batchPlan : null);
    const targetPlazo = custom?.plazo !== undefined ? custom.plazo : (batchPlazo !== 'ALL' ? Number(batchPlazo) : null);

    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();

    // 1. Both targetPlan and targetPlazo specified
    if (targetPlan && targetPlazo) {
      const exact = recordsForModel.find(
        (r) => clean(r.planNombre) === clean(targetPlan) && Number(r.plazo) === targetPlazo
      );
      if (exact) return exact;
    }

    // 2. targetPlan specified
    if (targetPlan) {
      const planMatches = recordsForModel.filter((r) => clean(r.planNombre) === clean(targetPlan));
      if (planMatches.length > 0) {
        if (targetPlazo) {
          planMatches.sort((a, b) => Math.abs(a.plazo - targetPlazo) - Math.abs(b.plazo - targetPlazo));
        } else {
          planMatches.sort((a, b) => a.precioPromocion - b.precioPromocion);
        }
        return planMatches[0];
      }
    }

    // 3. targetPlazo specified
    if (targetPlazo) {
      const plazoMatches = recordsForModel.filter((r) => Number(r.plazo) === targetPlazo);
      if (plazoMatches.length > 0) {
        plazoMatches.sort((a, b) => a.precioPromocion - b.precioPromocion);
        return plazoMatches[0];
      }
    }

    // 4. Default: least initial payment record from unique catalog
    const base = uniqueModelsCatalog.find((m) => (m.model || '').toLowerCase().trim() === cleanM);
    return base || recordsForModel[0];
  };

  const handleModelPlanChange = (modelName: string, newPlan: string) => {
    const cleanM = (modelName || '').toLowerCase().trim();
    setModelCustomConfig((prev) => ({
      ...prev,
      [cleanM]: {
        ...(prev[cleanM] || {}),
        plan: newPlan === 'AUTO' ? undefined : newPlan,
      },
    }));
  };

  const handleModelPlazoChange = (modelName: string, newPlazo: number | string) => {
    const cleanM = (modelName || '').toLowerCase().trim();
    setModelCustomConfig((prev) => ({
      ...prev,
      [cleanM]: {
        ...(prev[cleanM] || {}),
        plazo: newPlazo === 'AUTO' ? undefined : Number(newPlazo),
      },
    }));
  };

  const handleResetModelConfigs = () => {
    setModelCustomConfig({});
    setBatchPlan('ALL');
    setBatchPlazo('ALL');
    showToast('Plan y Plazo restablecidos a valores automáticos.');
  };

  // Selected items list for batch export and AI Copy - personalized with chosen Plan and Plazo
  const selectedAdsList = useMemo(() => {
    const list: FacebookAdData[] = [];
    const processedModels = new Set<string>();

    const idToModel = new Map<string, string>();
    for (const r of activePromoRecords) {
      idToModel.set(r.id, r.model);
    }

    for (const id of selectedIds) {
      const modelName = idToModel.get(id);
      if (!modelName) continue;
      const cleanKey = modelName.toLowerCase().trim();
      if (processedModels.has(cleanKey)) continue;
      processedModels.add(cleanKey);

      const rec = getConfiguredRecordForModel(modelName);
      if (!rec) continue;

      const modelKey = (rec.model || '').toLowerCase().trim();
      const modelContado = modelContadoMap.get(modelKey) || Number(rec.precioContado || 0);
      const data = calculateAdFinancials(rec, sucursal, currentEventTitle, effectiveThemeId, modelContado);
      data.themeStyle = adStyle;
      data.aspectRatio = aspectRatio;
      list.push(data);
    }

    return list;
  }, [
    activePromoRecords,
    selectedIds,
    modelCustomConfig,
    batchPlan,
    batchPlazo,
    sucursal,
    currentEventTitle,
    effectiveThemeId,
    adStyle,
    aspectRatio,
    modelContadoMap,
  ]);

  // Fetch / Generate AI Copy from server API (Gemini 3.8 Flash)
  const handleGenerateAICopy = async () => {
    try {
      setIsGeneratingCopy(true);
      const devicesSample = (selectedAdsList.length > 0 ? selectedAdsList : paginatedAds).slice(0, 8).map((d) => ({
        brand: d.brand,
        model: d.model,
        precioPromo: d.precioPromocion,
        engancheMin: d.engancheMinimo,
        engancheMax: d.engancheMaximo,
        mensualidad: d.mensualidadTotal,
        plan: d.planName,
        plazo: d.plazo,
      }));

      const res = await fetch('/api/ai/facebook-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: currentEventTitle,
          monthName: currentMonthName,
          eventName: currentEventTitle,
          sucursal,
          devices: devicesSample,
          tone: campaignTone,
          format: aiPostFormat,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.copy) {
          setAiCopy(data.copy);
          showToast(`¡Texto publicitario redactado con Inteligencia Artificial (${data.source || 'Gemini'})!`);
          return;
        }
      }
    } catch (err) {
      console.warn('Error fetching AI copy:', err);
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // Generate AI Headline Hooks
  const handleGenerateHeadlines = async () => {
    try {
      setIsLoadingHeadlines(true);
      const sample = paginatedAds[0] || allAdsData[0];
      const res = await fetch('/api/ai/headline-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: sample?.model || 'Gama Alta',
          brand: sample?.brand || 'AT&T',
          theme: currentEventTitle,
          sucursal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.headlines)) {
          setAiHeadlines(data.headlines);
          showToast('¡Titulares sugeridos por IA listos!');
        }
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoadingHeadlines(false);
    }
  };

  // Automatically generate initial copy on first load
  useEffect(() => {
    if (!aiCopy && allAdsData.length > 0) {
      handleGenerateAICopy();
    }
  }, [allAdsData.length > 0]);

  // Toggle single item selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all Top 5 models of each brand
  const handleSelectTop5ByBrand = () => {
    const ids = new Set(latestModelsByBrand.map((d) => d.id));
    setSelectedIds(ids);
    showToast(`Seleccionados los ${latestModelsByBrand.length} últimos modelos de cada marca.`);
  };

  // Select all of a specific brand
  const handleSelectAllBrand = (brandName: string) => {
    const ids = new Set(selectedIds);
    uniqueModelsCatalog
      .filter((m) => m.brand.toUpperCase() === brandName.toUpperCase())
      .forEach((m) => ids.add(m.id));
    setSelectedIds(ids);
    showToast(`Seleccionados todos los modelos de ${brandName}.`);
  };

  // Select all models in catalog
  const handleSelectAllModels = () => {
    setSelectedIds(new Set(uniqueModelsCatalog.map((m) => m.id)));
    showToast(`Seleccionados todos los ${uniqueModelsCatalog.length} modelos del catálogo.`);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedIds(new Set());
    showToast('Selección borrada.');
  };

  // Copy AI post copy to clipboard
  const handleCopyPostText = () => {
    if (!aiCopy) return;
    navigator.clipboard.writeText(aiCopy);
    setIsCopyCopied(true);
    showToast('¡Texto copiado al portapapeles! Listo para publicar en Facebook o WhatsApp.');
    setTimeout(() => setIsCopyCopied(false), 3000);
  };

  // Batch download ZIP of selected ads in 1 click
  const handleDownloadBatchZip = async () => {
    const itemsToExport = selectedAdsList.length > 0 ? selectedAdsList : paginatedAds;
    if (itemsToExport.length === 0) {
      showToast('No hay modelos seleccionados para descargar. Selecciona al menos uno.');
      return;
    }

    try {
      setIsZipping(true);
      setZipProgress(`0 / ${itemsToExport.length}`);
      await downloadBatchFacebookAdsZip(
        itemsToExport,
        `Publicidad_${effectiveThemeId.toUpperCase()}_ATT_${itemsToExport.length}_Equipos.zip`,
        (completed, total) => {
          setZipProgress(`${completed} / ${total}`);
        }
      );
      showToast(`¡Archivo ZIP con ${itemsToExport.length} imágenes descargado con éxito en 1 Clic!`);
      if (isModelPickerOpen) {
        setIsModelPickerOpen(false);
      }
    } catch (err) {
      console.error('Batch download error:', err);
      showToast('Error al comprimir imágenes.');
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-950/95 border-2 border-emerald-500 text-emerald-200 text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{activeToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SELECTOR DE MODELOS PARA DESCARGA EN 1 CLIC (User Requested)      */}
      {/* ========================================================================= */}
      {isModelPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl animate-scaleUp ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-black flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span>Elegir Modelos para Descargar en 1 Clic</span>
                    <span className="text-xs bg-cyan-900/60 text-cyan-300 px-2 py-0.5 rounded-full font-bold border border-cyan-700">
                      {selectedIds.size} seleccionados
                    </span>
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Marca las casillas de los equipos que deseas. Todas las imágenes se descargarán comprimidas en alta definición.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModelPickerOpen(false)}
                className={`p-2 rounded-xl transition ${
                  isDark ? 'text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 bg-slate-200 hover:bg-slate-300'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Filters in Modal */}
            <div
              className={`p-4 border-b space-y-3 ${
                isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100/90 border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search in picker */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar iPhone, Galaxy, Moto Edge..."
                    value={pickerSearchTerm}
                    onChange={(e) => setPickerSearchTerm(e.target.value)}
                    className={`w-full rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-cyan-500 border ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Preset selection buttons */}
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectTop5ByBrand}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 dark:text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Top 5 de Cada Marca ({latestModelsByBrand.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllModels}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition border ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    Seleccionar Todos ({uniqueModelsCatalog.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className={`px-2.5 py-1.5 rounded-xl font-medium transition border ${
                      isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800' : 'bg-slate-200 hover:bg-slate-300 text-slate-600 border-slate-300'
                    }`}
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Brand Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPickerSelectedBrand('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                    pickerSelectedBrand === 'ALL'
                      ? 'bg-cyan-600 text-white'
                      : isDark
                        ? 'bg-slate-900 text-slate-400 hover:text-white'
                        : 'bg-white text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas las Marcas
                </button>
                {brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setPickerSelectedBrand(b)}
                    className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      pickerSelectedBrand === b
                        ? 'bg-cyan-600 text-white'
                        : isDark
                          ? 'bg-slate-900 text-slate-400 hover:text-white'
                          : 'bg-white text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              {/* ⚡ Custom Plan & Plazo Selector for Batch Image Downloads (User Requested) */}
              <div
                className={`p-3 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
                  isDark ? 'bg-cyan-950/30 border-cyan-800/60' : 'bg-cyan-50/90 border-cyan-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Configurar Plan y Plazo de Descarga
                    </h4>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Elige el plan y plazo general para el paquete de imágenes o cámbialo en cada equipo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                  {/* Global Plan selector */}
                  <div className="flex items-center space-x-1.5 text-xs">
                    <span className="text-[11px] font-semibold text-slate-400">Plan:</span>
                    <select
                      value={batchPlan}
                      onChange={(e) => setBatchPlan(e.target.value)}
                      className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border focus:outline-none focus:border-cyan-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-cyan-300' : 'bg-white border-slate-300 text-cyan-800'
                      }`}
                    >
                      <option value="ALL">🎯 Todos / Mejor Oferta</option>
                      {availablePlans.map((p) => (
                        <option key={p} value={p}>
                          Plan {p.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Global Plazo selector */}
                  <div className="flex items-center space-x-1.5 text-xs">
                    <span className="text-[11px] font-semibold text-slate-400">Plazo:</span>
                    <select
                      value={batchPlazo}
                      onChange={(e) => setBatchPlazo(e.target.value)}
                      className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border focus:outline-none focus:border-cyan-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-cyan-300' : 'bg-white border-slate-300 text-cyan-800'
                      }`}
                    >
                      <option value="ALL">⏱️ Todos / 36m (Mejor)</option>
                      <option value="36">36 Meses (Recomendado)</option>
                      <option value="30">30 Meses</option>
                      <option value="24">24 Meses</option>
                      <option value="18">18 Meses</option>
                      <option value="12">12 Meses</option>
                    </select>
                  </div>

                  {/* Reset button if custom modified */}
                  {(Object.keys(modelCustomConfig).length > 0 || batchPlan !== 'ALL' || batchPlazo !== 'ALL') && (
                    <button
                      type="button"
                      onClick={handleResetModelConfigs}
                      className="text-[11px] text-cyan-500 hover:text-cyan-400 font-bold px-2 py-1 rounded-lg bg-cyan-950 border border-cyan-800 transition"
                    >
                      Restablecer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Models Scrollable Grid */}
            <div className={`p-5 overflow-y-auto max-h-[55vh] space-y-2.5 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {uniqueModelsCatalog
                  .filter((m) => {
                    const matchesSearch =
                      m.model.toLowerCase().includes(pickerSearchTerm.toLowerCase()) ||
                      m.brand.toLowerCase().includes(pickerSearchTerm.toLowerCase());
                    const matchesBrand =
                      pickerSelectedBrand === 'ALL' || m.brand.toUpperCase() === pickerSelectedBrand.toUpperCase();
                    return matchesSearch && matchesBrand;
                  })
                  .map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const cleanKey = (item.model || '').toLowerCase().trim();
                    const currentRec = getConfiguredRecordForModel(item.model) || item;
                    const hasTikTok = isTikTokIncludedInPlan(currentRec.planNombre, currentRec.costoPlan);
                    const promo = Number(currentRec.precioPromocion || 0);
                    const modelKey = (item.model || '').toLowerCase().trim();
                    const modelContado = modelContadoMap.get(modelKey) || Number(currentRec.precioContado || 0);
                    const contado = modelContado > 0 ? modelContado : Math.round(promo * 1.25);
                    const isUnder30 = contado > 0 && promo < 0.30 * contado;
                    const initialPayment = isUnder30
                      ? Math.round(3 * currentRec.costoPlan * 100) / 100
                      : Math.round(0.50 * promo * 100) / 100;
                    const monthly = currentRec.mensualidadTotalConMaxEnganche || currentRec.mensualidad || 0;

                    const availablePlansForThisModel = modelOptions.plansByModel.get(cleanKey) || [];
                    const availablePlazosForThisModel = modelOptions.plazosByModel.get(cleanKey) || [36, 24];

                    const customConfig = modelCustomConfig[cleanKey];

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleSelect(item.id)}
                        className={`p-3.5 rounded-2xl border-2 transition cursor-pointer select-none flex flex-col justify-between space-y-2.5 ${
                          isSelected
                            ? isDark
                              ? 'bg-cyan-950/40 border-cyan-500 shadow-lg'
                              : 'bg-cyan-50 border-cyan-500 shadow-md'
                            : isDark
                              ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isDark ? 'bg-slate-800 text-cyan-300' : 'bg-slate-100 text-cyan-700'
                                }`}
                              >
                                {item.brand}
                              </span>
                              {item.storage && (
                                <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {item.storage}
                                </span>
                              )}
                              {hasTikTok && (
                                <span className="text-[10px] bg-black text-cyan-300 border border-cyan-800 px-1 rounded font-bold">
                                  ♪ TikTok
                                </span>
                              )}
                            </div>
                            <h4 className={`text-xs font-bold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {item.model}
                            </h4>
                          </div>

                          <div className="shrink-0 pt-0.5">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-cyan-500" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Interactive Plan & Plazo selectors for this model */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`p-2 rounded-xl border text-[11px] grid grid-cols-2 gap-2 ${
                            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100/80 border-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <label className="text-[10px] font-bold text-slate-400 block truncate">
                              Plan:
                            </label>
                            <select
                              value={customConfig?.plan || (batchPlan !== 'ALL' ? batchPlan : 'AUTO')}
                              onChange={(e) => handleModelPlanChange(item.model, e.target.value)}
                              className={`w-full text-[11px] font-semibold rounded-lg px-1.5 py-1 border focus:outline-none focus:border-cyan-500 ${
                                isDark ? 'bg-slate-950 border-slate-700 text-cyan-300' : 'bg-white border-slate-300 text-cyan-800'
                              }`}
                            >
                              <option value="AUTO">Mejor oferta ({currentRec.planNombre})</option>
                              {availablePlansForThisModel.map((p) => (
                                <option key={p.planNombre} value={p.planNombre}>
                                  {p.planNombre} (${p.costoPlan})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-0.5">
                            <label className="text-[10px] font-bold text-slate-400 block truncate">
                              Plazo:
                            </label>
                            <select
                              value={customConfig?.plazo || (batchPlazo !== 'ALL' ? batchPlazo : 'AUTO')}
                              onChange={(e) => handleModelPlazoChange(item.model, e.target.value)}
                              className={`w-full text-[11px] font-semibold rounded-lg px-1.5 py-1 border focus:outline-none focus:border-cyan-500 ${
                                isDark ? 'bg-slate-950 border-slate-700 text-cyan-300' : 'bg-white border-slate-300 text-cyan-800'
                              }`}
                            >
                              <option value="AUTO">{currentRec.plazo}m (Auto)</option>
                              {availablePlazosForThisModel.map((z) => (
                                <option key={z} value={z}>
                                  {z} meses
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Pricing summary */}
                        <div className={`grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Precio Promo:</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              ${promo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                              {isUnder30 ? '3 Rentas Inicial:' : 'Enganche 50%:'}
                            </span>
                            <span className="font-bold text-cyan-600 dark:text-cyan-300">
                              ${initialPayment.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="col-span-2 flex items-center justify-between pt-1">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                              Mensualidad Total ({currentRec.plazo}m):
                            </span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                              ${monthly.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer with One-Click Download */}
            <div
              className={`px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <strong className="text-cyan-500 text-sm">{selectedIds.size}</strong> modelos elegidos para descargar
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsModelPickerOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
                    isDark ? 'text-slate-300 hover:text-white bg-slate-900 border-slate-800' : 'text-slate-700 hover:text-slate-900 bg-white border-slate-300'
                  }`}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBatchZip}
                  disabled={isZipping || selectedIds.size === 0}
                  className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-xl transition disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span>
                    {isZipping ? `Comprimiendo (${zipProgress})...` : `Descargar ${selectedIds.size} Imágenes en 1 Clic (ZIP)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Full Resolution High-Definition Ad Preview */}
      {previewModalAd && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scaleUp ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
            }`}
          >
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-cyan-500" />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {previewModalAd.brand} {previewModalAd.model} • Imagen Publicitaria Oficial 1080p
                </h3>
              </div>
              <button
                onClick={() => setPreviewModalAd(null)}
                className={`p-1 rounded-lg transition ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex items-center justify-center bg-[#020612]">
              <ModalAdPreview adData={previewModalAd} />
            </div>

            <div
              className={`px-5 py-4 border-t flex items-center justify-between gap-3 flex-wrap ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-xs space-y-0.5">
                <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Precio Promo: <strong className="text-emerald-500">${previewModalAd.precioPromocion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                </span>
                <span className="mx-2 text-slate-400">•</span>
                <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {previewModalAd.esMenor30Contado ? '3 Rentas Inicial:' : 'Enganche 50%:'}{' '}
                  <strong className="text-cyan-500">
                    ${(previewModalAd.esMenor30Contado
                      ? Number(previewModalAd.montoRentasAdelantadas || previewModalAd.costoPlan * 3)
                      : previewModalAd.engancheMaximo
                    ).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </strong>
                </span>
                <span className="mx-2 text-slate-400">•</span>
                <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Mensualidad: <strong className="text-emerald-500">${previewModalAd.mensualidadTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m</strong>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={async () => {
                    await copyFacebookAdToClipboard(previewModalAd);
                    showToast('¡Imagen copiada al portapapeles!');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-cyan-700 border-slate-300'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Imagen</span>
                </button>
                <button
                  onClick={async () => {
                    await downloadFacebookAdImage(previewModalAd);
                    showToast('Descargando imagen PNG...');
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Warning if no promo table loaded */}
      {allAdsData.length === 0 && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-amber-300">
                FALTA VINCULAR TABLA DE PRECIOS
              </h3>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                No hay equipos con vigencia activa cargados. Sube la lista de precios oficial en Excel para generar la publicidad.
              </p>
              {onNavigateToInbox && (
                <div className="pt-2">
                  <button
                    onClick={onNavigateToInbox}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-3 py-1.5 rounded-lg font-semibold text-xs transition"
                  >
                    Ir a Bandeja / Cargar Archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Banner Header */}
      <div
        className={`border rounded-3xl p-6 shadow-xl relative overflow-hidden ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-[#06152d] to-slate-900 border-cyan-500/40'
            : 'bg-gradient-to-r from-cyan-50 via-white to-blue-50 border-cyan-300 shadow-cyan-500/10'
        }`}
      >
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow">
                DISEÑO PUBLICITARIO PROFESIONAL
              </span>
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>PRECIOS OFICIALES AT&amp;T</span>
              </span>
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>{sucursal}</span>
              </span>
            </div>

            <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Generador de Publicidad para Redes Sociales
            </h2>

            <p className={`text-xs max-w-3xl leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Crea imágenes de alto impacto con el <strong>Precio de Promoción Actual</strong>, <strong>Pago Inicial Requerido</strong> y <strong>Mensualidad en Grande</strong>. Incluye beneficios oficiales de plan: <strong>REDES SOCIALES ILIMITADAS + TIKTOK INCLUIDO</strong> (planes arriba de Azul 3) y <strong>LLAMADAS/SMS EN MÉXICO, USA Y CANADÁ</strong>.
            </p>
          </div>

          {/* Quick Actions: Open Model Picker & 1-Click ZIP Download */}
          <div className="flex items-center space-x-2.5 shrink-0 flex-wrap gap-y-2">
            <button
              onClick={() => setIsModelPickerOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-3 rounded-2xl text-xs shadow-lg transition"
              title="Abre la ventana para seleccionar qué teléfonos descargar"
            >
              <CheckSquare className="w-4 h-4 text-cyan-300" />
              <span>Elegir Modelos ({selectedIds.size})</span>
            </button>

            <button
              onClick={handleDownloadBatchZip}
              disabled={isZipping || allAdsData.length === 0}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 py-3 rounded-2xl text-xs shadow-lg transition disabled:opacity-50"
              title="Descarga todas las imágenes de los modelos seleccionados en 1 Clic"
            >
              <Zap className="w-4 h-4 text-yellow-300" />
              <span>
                {isZipping ? `Comprimiendo (${zipProgress})...` : `Descargar en 1 Clic ZIP (${selectedIds.size})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2-COLUMN CONTROLS: AI Copywriter (Left) + Campaign Themes & Styling (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Gemini AI Ad Copywriter */}
        <div
          className={`lg:col-span-6 border rounded-3xl p-5 shadow-lg space-y-4 flex flex-col justify-between ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="space-y-3">
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold flex items-center space-x-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span>Redactor de Copys con Inteligencia Artificial</span>
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Adaptado al tema: <strong className="text-cyan-500">{currentEventTitle}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={handleGenerateAICopy}
                disabled={isGeneratingCopy || allAdsData.length === 0}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow transition disabled:opacity-50"
                title="Generar nueva versión de texto con Gemini"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingCopy ? 'animate-spin' : ''}`} />
                <span>{isGeneratingCopy ? 'Redactando con IA...' : 'Generar Copy con IA'}</span>
              </button>
            </div>

            {/* Format & Tone Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Formato:
                </span>
                <select
                  value={aiPostFormat}
                  onChange={(e) => setAiPostFormat(e.target.value as any)}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="facebook_post">📱 Post Facebook &amp; Instagram</option>
                  <option value="whatsapp_broadcast">💬 Difusión para WhatsApp / Estados</option>
                  <option value="reels_script">🎬 Guión para Video Corto (Reels/TikTok)</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tono del Mensaje:
                </span>
                <select
                  value={campaignTone}
                  onChange={(e) => setCampaignTone(e.target.value as any)}
                  className={`w-full border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="urgente">🔥 Ofertas y Sentido de Urgencia</option>
                  <option value="asesoria">🤝 Asesoría y Ahorro (Enganche 10%)</option>
                  <option value="exclusividad">⭐ Nuevos Lanzamientos y Gama Alta</option>
                </select>
              </div>
            </div>

            {/* Editable Post Text Area */}
            <div className="relative">
              <textarea
                value={aiCopy}
                onChange={(e) => setAiCopy(e.target.value)}
                rows={9}
                placeholder="El texto publicitario optimizado aparecerá aquí listo para publicarse..."
                className={`w-full border text-xs font-mono p-4 rounded-2xl focus:outline-none focus:border-cyan-500 leading-relaxed resize-none shadow-inner ${
                  isDark ? 'bg-[#070d17] border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>

          {/* Copy CTA Button */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              💡 Puedes editar el texto directamente antes de publicarlo.
            </span>
            <button
              onClick={handleCopyPostText}
              disabled={!aiCopy}
              className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition disabled:opacity-50"
            >
              {isCopyCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{isCopyCopied ? '¡Texto Copiado!' : 'Copiar Texto para Publicar'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT: Campaign Themes & Visual Customizer */}
        <div
          className={`lg:col-span-6 border rounded-3xl p-5 shadow-lg space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`border-b pb-3 flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-500" />
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Temática y Diseño de la Imagen
              </h3>
            </div>
            <button
              onClick={() => setIsModelPickerOpen(true)}
              className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-1 rounded-full flex items-center space-x-1"
            >
              <CheckSquare className="w-3 h-3" />
              <span>{selectedIds.size} elegidos</span>
            </button>
          </div>

          {/* Sucursal Input */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold flex items-center space-x-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Sucursal en la imagen:</span>
            </label>
            <input
              type="text"
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              placeholder="Ej. AT&T Alsuper Robinson"
              className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Campaign / Event Theme Preset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-semibold flex items-center space-x-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                <span>Temática del Anuncio (Cambia fondo y colores):</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateHeadlines}
                disabled={isLoadingHeadlines}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center space-x-1 font-semibold"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isLoadingHeadlines ? 'Pensando...' : 'Sugerir titulares con IA'}</span>
              </button>
            </div>
            <select
              value={selectedThemePreset}
              onChange={(e) => setSelectedThemePreset(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {popularCampaignThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.icon} {theme.label}
                </option>
              ))}
            </select>

            {/* AI Suggested Headlines pills */}
            {aiHeadlines.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-1.5">
                {aiHeadlines.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedThemePreset('custom');
                      setCustomThemeName(h);
                      showToast(`Titular aplicado: "${h}"`);
                    }}
                    className="text-[11px] bg-purple-950/80 hover:bg-purple-900 border border-purple-600/50 text-purple-200 px-2.5 py-1 rounded-lg transition"
                  >
                    ✨ {h}
                  </button>
                ))}
              </div>
            )}

            {selectedThemePreset === 'custom' && (
              <input
                type="text"
                value={customThemeName}
                onChange={(e) => setCustomThemeName(e.target.value)}
                placeholder="Escribe el nombre del evento (ej. Venta Nocturna Robinson)..."
                className={`w-full mt-2 border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark ? 'bg-slate-950 border-cyan-800/80 text-white' : 'bg-slate-50 border-cyan-300 text-slate-900'
                }`}
              />
            )}
          </div>

          {/* Aspect Ratio and Model Selector */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Formato / Relación:
              </label>
              <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'}`}>
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`py-1.5 text-center text-[11px] font-bold rounded-lg transition ${
                    aspectRatio === '1:1'
                      ? 'bg-cyan-600 text-white shadow'
                      : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1:1 Cuadrado
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('4:5')}
                  className={`py-1.5 text-center text-[11px] font-bold rounded-lg transition ${
                    aspectRatio === '4:5'
                      ? 'bg-cyan-600 text-white shadow'
                      : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  4:5 Vertical
                </button>
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setIsModelPickerOpen(true)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Elegir Teléfonos</span>
              </button>
            </div>
          </div>

          {/* Exact Plan Benefits Callout Info */}
          <div
            className={`border p-3.5 rounded-2xl space-y-1.5 text-[11px] ${
              isDark ? 'bg-slate-950/90 border-cyan-800/60 text-slate-300' : 'bg-cyan-50/70 border-cyan-200 text-slate-700'
            }`}
          >
            <div className="font-bold text-cyan-600 dark:text-cyan-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Beneficios Automáticos en Cada Imagen:</span>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>REDES SOCIALES ILIMITADAS</strong> (WhatsApp, FB, IG, X)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-cyan-500 font-bold">✓</span>
                <span>
                  <strong>TIKTOK INCLUIDO</strong> <span className="text-[10px] text-cyan-600 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-950 px-1 rounded border border-cyan-300 dark:border-cyan-800">(Solo planes arriba de Azul 3: Plata, Oro, Black, Platino, Diamante)</span>
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>LLAMADAS Y MENSAJES ILIMITADOS EN MÉXICO, ESTADOS UNIDOS Y CANADÁ</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER, VIEW MODE & SELECTION TOOLBAR (With Plan & Plazo selectors!) */}
      <div
        className={`border rounded-2xl p-4 space-y-3.5 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2 w-full lg:w-auto flex-wrap">
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Mostrar:
            </span>
            <div className={`flex items-center p-1 rounded-xl border flex-wrap gap-1 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => setViewMode('top-5-brand')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  viewMode === 'top-5-brand'
                    ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white shadow'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-yellow-300" />
                <span>Top 5 por Marca ({latestModelsByBrand.length})</span>
              </button>
              <button
                onClick={() => setViewMode('best-model')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'best-model'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos los Modelos ({uniqueModelsCatalog.length})
              </button>
              <button
                onClick={() => setViewMode('all-variants')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'all-variants'
                    ? isDark
                      ? 'bg-slate-800 text-white shadow'
                      : 'bg-white text-slate-900 shadow'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas las opciones ({activePromoRecords.length})
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar modelo o marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Toolbar Row 2: Brand, Plan and Plazo Filter Selectors */}
        <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Brand Filter */}
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Marca:</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="ALL">Todas las marcas</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Plan Filter */}
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Plan:</span>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="ALL">Todos los Planes / Mejor Opción</option>
                {availablePlans.map((p) => (
                  <option key={p} value={p}>
                    Plan {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Plazo Filter */}
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Plazo:</span>
              <select
                value={selectedPlazo}
                onChange={(e) => setSelectedPlazo(e.target.value)}
                className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="ALL">Todos los plazos</option>
                <option value="24">24 meses</option>
                <option value="30">30 meses</option>
                <option value="36">36 meses</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsModelPickerOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Elegir Equipos ({selectedIds.size})</span>
            </button>
          </div>
        </div>

        {/* Results Counter & Pagination Top Bar */}
        <div className={`flex items-center justify-between pt-2 border-t text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span>
              Mostrando <strong>{filteredAds.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredAds.length)}</strong> de <strong>{filteredAds.length}</strong> modelos con vigencia activa
            </span>
            {selectedIds.size > 0 && (
              <span className={`font-semibold px-2 py-0.5 rounded border ${isDark ? 'text-cyan-400 bg-cyan-950 border-cyan-800' : 'text-cyan-800 bg-cyan-100 border-cyan-300'}`}>
                {selectedIds.size} modelos seleccionados para descargar
              </span>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`p-1.5 rounded-lg border disabled:opacity-40 transition ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`p-1.5 rounded-lg border disabled:opacity-40 transition ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ADS GRID: Rendered cleanly and lightning-fast */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
        {filteredAds.length === 0 ? (
          <div
            className={`col-span-3 border rounded-3xl p-12 text-center space-y-2 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <Smartphone className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              No se encontraron modelos con los filtros seleccionados
            </h4>
            <p className="text-xs text-slate-400">Prueba cambiando la marca o el término de búsqueda.</p>
          </div>
        ) : (
          paginatedAds.map((adItem) => (
            <FacebookAdCard
              key={adItem.id}
              adData={adItem}
              allRecordsForModel={activePromoRecords.filter(
                (r) => r.model.toLowerCase().trim() === adItem.model.toLowerCase().trim()
              )}
              isDark={isDark}
              isSelected={selectedIds.has(adItem.id)}
              onToggleSelect={() => handleToggleSelect(adItem.id)}
              onShowToast={showToast}
              onOpenPreview={() => setPreviewModalAd(adItem)}
              onQuoterClick={() => {
                const rec = records.find((r) => r.id === adItem.id) || activePromoRecords.find(
                  (r) => r.model.toLowerCase().trim() === adItem.model.toLowerCase().trim()
                );
                if (rec && onNavigateToQuoter) {
                  onNavigateToQuoter(rec);
                }
              }}
            />
          ))
        )}
      </div>

      {/* Bottom Pagination Bar */}
      {totalPages > 1 && (
        <div
          className={`border rounded-2xl p-4 flex items-center justify-between text-xs ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
          }`}
        >
          <span>
            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredAds.length} anuncios en total)
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-40 transition font-semibold ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Primera
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-40 transition flex items-center space-x-1 ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-40 transition flex items-center space-x-1 ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-40 transition font-semibold ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Última
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface FacebookAdCardProps {
  adData: FacebookAdData;
  allRecordsForModel: DevicePriceRecord[];
  isDark: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onShowToast: (msg: string) => void;
  onOpenPreview: () => void;
  onQuoterClick: () => void;
}

const FacebookAdCard: React.FC<FacebookAdCardProps> = ({
  adData: initialAdData,
  allRecordsForModel,
  isDark,
  isSelected,
  onToggleSelect,
  onShowToast,
  onOpenPreview,
  onQuoterClick,
}) => {
  const [currentAdData, setCurrentAdData] = useState<FacebookAdData>(initialAdData);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if props update
  useEffect(() => {
    setCurrentAdData(initialAdData);
  }, [initialAdData]);

  // Render preview canvas directly
  useEffect(() => {
    if (canvasRef.current) {
      try {
        renderFacebookAdToCanvas(canvasRef.current, currentAdData, 540);
      } catch (e) {
        console.error('Error drawing preview ad:', e);
      }
    }
  }, [currentAdData]);

  // Available plazos for this model
  const availablePlazos = useMemo(() => {
    const set = new Set(allRecordsForModel.map((r) => r.plazo));
    return [24, 30, 36].filter((p) => set.has(p));
  }, [allRecordsForModel]);

  // Available plans for this model
  const availablePlansForModel = useMemo(() => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const set = new Set<string>();
    const planNames: string[] = [];
    allRecordsForModel.forEach((r) => {
      const c = clean(r.planNombre);
      if (!set.has(c)) {
        set.add(c);
        planNames.push(r.planNombre);
      }
    });
    return planNames;
  }, [allRecordsForModel]);

  // Handle local plan change on this card
  const handlePlanChange = (newPlan: string) => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const targetClean = clean(newPlan);
    const match =
      allRecordsForModel.find(
        (r) => clean(r.planNombre) === targetClean && r.plazo === currentAdData.plazo
      ) ||
      allRecordsForModel.find((r) => clean(r.planNombre) === targetClean) ||
      allRecordsForModel[0];

    if (match) {
      const updated = calculateAdFinancials(
        match,
        currentAdData.sucursal,
        currentAdData.eventBadge,
        currentAdData.campaignThemeId,
        currentAdData.precioContado
      );
      updated.themeStyle = currentAdData.themeStyle;
      updated.aspectRatio = currentAdData.aspectRatio;
      setCurrentAdData(updated);
    }
  };

  // Handle local plazo change on this card
  const handlePlazoChange = (newPlazo: number) => {
    const clean = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').trim();
    const match =
      allRecordsForModel.find(
        (r) => r.plazo === newPlazo && clean(r.planNombre) === clean(currentAdData.planName)
      ) ||
      allRecordsForModel.find((r) => r.plazo === newPlazo);

    if (match) {
      const updated = calculateAdFinancials(
        match,
        currentAdData.sucursal,
        currentAdData.eventBadge,
        currentAdData.campaignThemeId,
        currentAdData.precioContado
      );
      updated.themeStyle = currentAdData.themeStyle;
      updated.aspectRatio = currentAdData.aspectRatio;
      setCurrentAdData(updated);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadFacebookAdImage(currentAdData);
      onShowToast(`¡Imagen de ${currentAdData.model} descargada con éxito!`);
    } catch (e) {
      console.error(e);
      onShowToast('Error al descargar la imagen.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      setIsCopied(true);
      const ok = await copyFacebookAdToClipboard(currentAdData);
      if (ok) {
        onShowToast(`¡Imagen copiada al portapapeles! Pégala directo con Ctrl+V en Facebook.`);
      } else {
        await downloadFacebookAdImage(currentAdData);
        onShowToast(`Descargando imagen para compartir.`);
      }
    } catch (e) {
      await downloadFacebookAdImage(currentAdData);
    } finally {
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const hasTikTok = isTikTokIncludedInPlan(currentAdData.planName, currentAdData.costoPlan);
  const isRentas = currentAdData.esMenor30Contado;
  const initialPayment = isRentas
    ? Number(currentAdData.montoRentasAdelantadas || currentAdData.costoPlan * 3)
    : Number(currentAdData.engancheMaximo);

  return (
    <div
      className={`rounded-3xl border-2 overflow-hidden shadow-xl transition-all flex flex-col justify-between ${
        isSelected
          ? 'border-cyan-500 ring-2 ring-cyan-500/20'
          : isDark
            ? 'border-slate-800 hover:border-slate-700 bg-slate-900'
            : 'border-slate-200 hover:border-slate-300 bg-white shadow-md'
      }`}
    >
      {/* Card Header Toolbar */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 text-cyan-600 bg-slate-900 border-slate-700 rounded focus:ring-cyan-500 cursor-pointer"
          />
          <span className={`text-xs font-bold truncate max-w-[190px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {currentAdData.brand} {currentAdData.model}
          </span>
        </label>

        <div className="flex items-center space-x-1.5">
          {hasTikTok && (
            <span className="text-[10px] bg-black text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded font-bold">
              ♪ TikTok
            </span>
          )}
          <button
            type="button"
            onClick={onOpenPreview}
            className={`p-1 rounded-lg transition ${
              isDark ? 'text-slate-400 hover:text-cyan-300' : 'text-slate-600 hover:text-cyan-600'
            }`}
            title="Ver en pantalla completa (1080p)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Fast Canvas Preview */}
      <div
        className="p-3 bg-[#020612] flex items-center justify-center cursor-pointer group relative"
        onClick={onOpenPreview}
      >
        <div className="relative w-full rounded-2xl overflow-hidden shadow-md border border-slate-800/80">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block object-contain"
          />
          <div className="absolute inset-0 bg-cyan-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <span className="bg-slate-900/90 border border-cyan-500/50 text-cyan-300 text-xs font-bold px-3 py-1.5 rounded-xl shadow">
              🔍 Clic para ampliar 1080p
            </span>
          </div>
        </div>
      </div>

      {/* Card Info & Quick Financial Numbers HIGHLIGHTED */}
      <div className={`p-4 space-y-3 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        {/* Plan and Plazo Selector on Card */}
        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className={`text-[11px] font-semibold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Plan:
            </span>
            {availablePlansForModel.length > 1 ? (
              <select
                value={currentAdData.planName}
                onChange={(e) => handlePlanChange(e.target.value)}
                className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition focus:outline-none max-w-[140px] truncate ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-cyan-700'
                }`}
              >
                {availablePlansForModel.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="text-cyan-600 dark:text-cyan-400 font-bold truncate">
                {currentAdData.planName} (${currentAdData.costoPlan}/m)
              </strong>
            )}
          </div>

          {availablePlazos.length > 1 && (
            <div className="flex items-center space-x-1 shrink-0">
              {availablePlazos.map((pz) => (
                <button
                  key={pz}
                  type="button"
                  onClick={() => handlePlazoChange(pz)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition border ${
                    currentAdData.plazo === pz
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                      : isDark
                        ? 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {pz}m
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2-COLUMN FINANCIAL STATS (Precio Promo + Pago Inicial) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Card 1: PRECIO PROMO ACTUAL (Prominently Highlighted) */}
          <div
            className={`p-2.5 rounded-xl border ${
              isDark ? 'bg-slate-950 border-emerald-800/60' : 'bg-emerald-50 border-emerald-300'
            }`}
          >
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold uppercase tracking-wider">
              🏷️ Precio Promo:
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-300 block">
              ${currentAdData.precioPromocion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-[9px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Contado: ${Number(currentAdData.precioContado || 0).toLocaleString('es-MX')}
            </span>
          </div>

          {/* Card 2: PAGO INICIAL REQUERIDO (Prominently Highlighted) */}
          <div
            className={`p-2.5 rounded-xl border ${
              isDark
                ? isRentas
                  ? 'bg-slate-950 border-cyan-800/60'
                  : 'bg-slate-950 border-emerald-800/60'
                : isRentas
                  ? 'bg-cyan-50 border-cyan-300'
                  : 'bg-emerald-50 border-emerald-300'
            }`}
          >
            <span
              className={`text-[10px] block font-bold uppercase tracking-wider ${
                isRentas ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isRentas ? '⭐ Pago Inicial (3 Rentas):' : '💳 Pago Inicial (50%):'}
            </span>
            <span
              className={`text-sm font-black block ${
                isRentas ? 'text-cyan-600 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300'
              }`}
            >
              ${initialPayment.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`text-[9px] font-bold block ${
                isRentas ? 'text-emerald-600 dark:text-emerald-400' : 'text-cyan-600 dark:text-cyan-400'
              }`}
            >
              {isRentas ? '¡$0 Enganche Equipo!' : '¡$0 Rentas Adelantadas!'}
            </span>
          </div>
        </div>

        {/* Card 3: MENSUALIDAD TOTAL CON PLAN */}
        <div
          className={`px-3 py-2.5 rounded-xl border flex items-baseline justify-between ${
            isDark ? 'bg-slate-950/80 border-emerald-500/50' : 'bg-emerald-50/80 border-emerald-300'
          }`}
        >
          <div>
            <span className={`text-xs block font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Mensualidad Total con Plan:
            </span>
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Equipo + Plan {currentAdData.planName}
            </span>
          </div>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
            ${currentAdData.mensualidadTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center justify-center space-x-1 py-2 rounded-xl text-xs font-semibold border transition ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300'
            }`}
            title="Copiar imagen al portapapeles para pegar con Ctrl+V"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? '¡Copiada!' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center justify-center space-x-1 py-2 rounded-xl text-xs font-semibold border transition disabled:opacity-50 ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Descargar imagen PNG de alta resolución"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={onQuoterClick}
            className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-semibold transition shadow-sm"
            title="Abrir este equipo en el Cotizador WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Cotizar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal Canvas Renderer for High Resolution Inspection
 */
const ModalAdPreview: React.FC<{ adData: FacebookAdData }> = ({ adData }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderFacebookAdToCanvas(canvasRef.current, adData, 800);
    }
  }, [adData]);

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
    />
  );
};
