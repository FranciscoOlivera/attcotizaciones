import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Smartphone,
  Search,
  HardDrive,
  Check,
  ChevronDown,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { DevicePriceRecord } from '../types/pricing';

export interface ParsedDeviceItem {
  id: string;
  brand: string;
  fullModel: string;
  baseModel: string;
  storage: string;
  precioContado?: number;
  precioPromocion: number;
}

export interface DeviceFinancingSelectorProps {
  records: DevicePriceRecord[];
  selectedModel: string;
  onSelectModel: (fullModel: string) => void;
}

// Brand theme colors and badges
const BRAND_STYLES: Record<string, { bg: string; text: string; border: string; activeBg: string }> = {
  APPLE: {
    bg: 'bg-zinc-900',
    text: 'text-zinc-200',
    border: 'border-zinc-700',
    activeBg: 'bg-zinc-800 text-white border-zinc-500 ring-2 ring-zinc-400/50',
  },
  SAMSUNG: {
    bg: 'bg-blue-950/60',
    text: 'text-blue-300',
    border: 'border-blue-800/80',
    activeBg: 'bg-blue-900 text-white border-blue-500 ring-2 ring-blue-400/50',
  },
  MOTOROLA: {
    bg: 'bg-indigo-950/60',
    text: 'text-indigo-300',
    border: 'border-indigo-800/80',
    activeBg: 'bg-indigo-900 text-white border-indigo-500 ring-2 ring-indigo-400/50',
  },
  XIAOMI: {
    bg: 'bg-orange-950/60',
    text: 'text-orange-300',
    border: 'border-orange-800/80',
    activeBg: 'bg-orange-900 text-white border-orange-500 ring-2 ring-orange-400/50',
  },
  HONOR: {
    bg: 'bg-cyan-950/60',
    text: 'text-cyan-300',
    border: 'border-cyan-800/80',
    activeBg: 'bg-cyan-900 text-white border-cyan-500 ring-2 ring-cyan-400/50',
  },
  OPPO: {
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-300',
    border: 'border-emerald-800/80',
    activeBg: 'bg-emerald-900 text-white border-emerald-500 ring-2 ring-emerald-400/50',
  },
  GOOGLE: {
    bg: 'bg-rose-950/60',
    text: 'text-rose-300',
    border: 'border-rose-800/80',
    activeBg: 'bg-rose-900 text-white border-rose-500 ring-2 ring-rose-400/50',
  },
  HUAWEI: {
    bg: 'bg-red-950/60',
    text: 'text-red-300',
    border: 'border-red-800/80',
    activeBg: 'bg-red-900 text-white border-red-500 ring-2 ring-red-400/50',
  },
};

const DEFAULT_BRAND_STYLE = {
  bg: 'bg-slate-900',
  text: 'text-slate-300',
  border: 'border-slate-800',
  activeBg: 'bg-cyan-950 text-cyan-200 border-cyan-500 ring-2 ring-cyan-400/50',
};

export const DeviceFinancingSelector: React.FC<DeviceFinancingSelectorProps> = ({
  records,
  selectedModel,
  onSelectModel,
}) => {
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('TODAS');
  const [justSelectedFeedback, setJustSelectedFeedback] = useState<string | null>(null);

  // 1. Catalog all unique models with clean metadata
  const parsedItems = useMemo<ParsedDeviceItem[]>(() => {
    const map = new Map<string, ParsedDeviceItem>();

    records.forEach((r) => {
      const full = (r.model || '').trim();
      if (!full) return;

      if (!map.has(full.toLowerCase())) {
        const brand = (r.brand || 'OTRO').toUpperCase().trim();

        // Extract storage
        const storageMatch =
          full.match(/(16|32|64|128|256|512)\s*(?:GB|gb)|(1|2)\s*(?:TB|tb)/i) ||
          (r.storage ? [r.storage] : null);
        const storage = storageMatch
          ? storageMatch[0].toUpperCase().replace(/\s+/g, '')
          : (r.storage || '').toUpperCase().trim();

        // Extract base model (strip brand from start if repeated, and strip storage)
        let base = full;
        const brandRegex = new RegExp('^' + brand + '\\s*', 'i');
        base = base.replace(brandRegex, '');
        if (storage) {
          base = base.replace(new RegExp('\\b' + storage + '\\b', 'ig'), '');
        }
        base = base.replace(/\s+/g, ' ').trim();
        if (!base) base = full;

        map.set(full.toLowerCase(), {
          id: r.id,
          brand,
          fullModel: full,
          baseModel: base,
          storage,
          precioContado: r.precioContado,
          precioPromocion: r.precioPromocion,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.fullModel.localeCompare(b.fullModel));
  }, [records]);

  // Find currently active item
  const activeItem = useMemo(() => {
    const cleanCurrent = (selectedModel || '').toLowerCase().trim();
    return (
      parsedItems.find((p) => p.fullModel.toLowerCase().trim() === cleanCurrent) ||
      parsedItems[0] ||
      null
    );
  }, [parsedItems, selectedModel]);

  // Brand list with counts
  const brandList = useMemo(() => {
    const counts: Record<string, number> = {};
    parsedItems.forEach((item) => {
      counts[item.brand] = (counts[item.brand] || 0) + 1;
    });

    const priority = ['APPLE', 'SAMSUNG', 'MOTOROLA', 'XIAOMI', 'HONOR', 'OPPO', 'GOOGLE', 'HUAWEI'];
    const sorted = Object.keys(counts).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sorted.map((b) => ({ brand: b, count: counts[b] }));
  }, [parsedItems]);

  // 2. LIVE SEARCH RESULTS (Fast, exact, and robust)
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const query = searchTerm.toLowerCase().trim();
    const tokens = query.split(/\s+/).filter(Boolean);

    return parsedItems
      .filter((item) => {
        const full = item.fullModel.toLowerCase();
        const brand = item.brand.toLowerCase();
        const base = item.baseModel.toLowerCase();
        const storage = item.storage.toLowerCase();
        const searchTarget = `${brand} ${base} ${storage} ${full}`;

        // Match all typed tokens (e.g. "iphone" and "15")
        return tokens.every((token) => searchTarget.includes(token));
      })
      .slice(0, 15); // Top 15 live matches
  }, [parsedItems, searchTerm]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handler to select an item definitively
  const handleSelectItem = (item: ParsedDeviceItem) => {
    onSelectModel(item.fullModel);
    setSelectedBrand(item.brand);
    setSearchTerm('');
    setIsSearchFocused(false);
    setJustSelectedFeedback(item.fullModel);
    setTimeout(() => setJustSelectedFeedback(null), 2500);
  };

  // Keyboard navigation for search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      handleSelectItem(searchResults[0]);
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
    }
  };

  // 3. Browsing models filtered by selected brand
  const brandFilteredItems = useMemo(() => {
    if (selectedBrand === 'TODAS') return parsedItems;
    return parsedItems.filter((item) => item.brand === selectedBrand);
  }, [parsedItems, selectedBrand]);

  // Group by base model for clean browsing
  const groupedBaseModels = useMemo(() => {
    const map = new Map<string, { baseModel: string; brand: string; variants: ParsedDeviceItem[] }>();

    brandFilteredItems.forEach((item) => {
      const key = `${item.brand}::${item.baseModel}`;
      if (!map.has(key)) {
        map.set(key, { baseModel: item.baseModel, brand: item.brand, variants: [] });
      }
      map.get(key)!.variants.push(item);
    });

    return Array.from(map.values()).sort((a, b) => a.baseModel.localeCompare(b.baseModel));
  }, [brandFilteredItems]);

  // Storages for current active base model
  const availableStoragesForActiveModel = useMemo(() => {
    if (!activeItem) return [];
    const sameBaseItems = parsedItems.filter(
      (p) => p.brand === activeItem.brand && p.baseModel === activeItem.baseModel
    );

    const order: Record<string, number> = {
      '32GB': 32,
      '64GB': 64,
      '128GB': 128,
      '256GB': 256,
      '512GB': 512,
      '1TB': 1024,
      '2TB': 2048,
    };

    return sameBaseItems.sort((a, b) => (order[a.storage] || 0) - (order[b.storage] || 0));
  }, [parsedItems, activeItem]);

  // When a user selects another brand chip, auto-switch to first model of that brand
  const handleSelectBrandChip = (brand: string) => {
    setSelectedBrand(brand);
    setSearchTerm('');
    if (brand !== 'TODAS') {
      const brandItems = parsedItems.filter((p) => p.brand === brand);
      if (brandItems.length > 0 && activeItem?.brand !== brand) {
        // Switch to the first model of this brand so selection stays synchronized!
        handleSelectItem(brandItems[0]);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header title */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-white flex items-center space-x-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>Configuración del Equipo (Buscador y Catálogo)</span>
        </label>
        <span className="text-[11px] text-cyan-400 font-medium">
          {parsedItems.length} equipos en promoción
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 1. BUSCADOR INTERACTIVO EN VIVO CON RESULTADOS INMEDIATOS                */}
      {/* ========================================================================= */}
      <div ref={searchContainerRef} className="relative z-30">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por modelo, marca o capacidad (ej. iPhone 15, S24, 256GB, Edge)..."
            value={searchTerm}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearchFocused(true);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-950 border-2 border-cyan-500/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40 text-xs text-white rounded-xl pl-10 pr-9 py-2.5 placeholder-slate-400 transition focus:outline-none shadow-md"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setIsSearchFocused(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* MENÚ FLOTANTE DE RESULTADOS DE BÚSQUEDA EN TIEMPO REAL */}
        {isSearchFocused && searchTerm.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border-2 border-cyan-500 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-fadeIn z-50">
            <div className="p-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-cyan-400 font-bold flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span>
                  {searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                </span>
              </span>
              <span className="text-[10px] text-slate-400">
                Presiona <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono">Enter</kbd> o haz clic para elegir
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No se encontraron equipos que coincidan con &ldquo;<strong className="text-white">{searchTerm}</strong>&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {searchResults.map((item, idx) => {
                  const isCurrent = activeItem?.fullModel.toLowerCase() === item.fullModel.toLowerCase();
                  const style = BRAND_STYLES[item.brand] || DEFAULT_BRAND_STYLE;

                  return (
                    <button
                      key={item.id || item.fullModel}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-3 flex items-center justify-between transition cursor-pointer ${
                        isCurrent
                          ? 'bg-cyan-950/70 border-l-4 border-cyan-400'
                          : idx === 0
                          ? 'bg-slate-800/80 hover:bg-cyan-950/50'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${style.bg} ${style.text} ${style.border}`}>
                              {item.brand}
                            </span>
                            {item.storage && (
                              <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.2 rounded">
                                {item.storage}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-white mt-0.5">{item.fullModel}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center space-x-3">
                        {item.precioContado && item.precioContado > 0 ? (
                          <div className="hidden sm:block text-right">
                            <span className="text-[9px] text-slate-400 block">Contado:</span>
                            <span className="text-xs font-bold text-slate-200">
                              ${item.precioContado.toLocaleString('es-MX')}
                            </span>
                          </div>
                        ) : null}

                        {isCurrent ? (
                          <span className="bg-emerald-950 text-emerald-300 border border-emerald-500 text-[10px] font-black px-2 py-1 rounded-lg flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow">
                            <span>Elegir</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feedback toast when selected */}
      {justSelectedFeedback && (
        <div className="p-2.5 bg-emerald-950 border border-emerald-500/70 rounded-xl text-xs text-emerald-200 flex items-center space-x-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Equipo seleccionado con éxito: <strong className="text-white">{justSelectedFeedback}</strong>
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FILTRO RÁPIDO POR MARCA (Chips interactivos con scroll horizontal)     */}
      {/* ========================================================================= */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-0.5">
          <span>O filtra por Marca:</span>
          {selectedBrand !== 'TODAS' && (
            <button
              type="button"
              onClick={() => handleSelectBrandChip('TODAS')}
              className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
            >
              Ver Todas ({parsedItems.length})
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          <button
            type="button"
            onClick={() => handleSelectBrandChip('TODAS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
              selectedBrand === 'TODAS'
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-2 ring-cyan-400/50'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            Todas ({parsedItems.length})
          </button>

          {brandList.map(({ brand, count }) => {
            const isSelected = selectedBrand === brand;
            const style = BRAND_STYLES[brand] || DEFAULT_BRAND_STYLE;

            return (
              <button
                key={brand}
                type="button"
                onClick={() => handleSelectBrandChip(brand)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border flex items-center space-x-1.5 ${
                  isSelected ? style.activeBg : `${style.bg} ${style.text} ${style.border} hover:opacity-100`
                }`}
              >
                <span>{brand}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white font-black' : 'bg-black/40 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SELECTOR DE MODELO BASE CON SINCRONIZACIÓN PERFECTA                    */}
      {/* ========================================================================= */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-0.5">
          <span>Selecciona el Modelo de {selectedBrand === 'TODAS' ? 'la Lista' : selectedBrand}:</span>
          <span className="text-cyan-400">{groupedBaseModels.length} modelos</span>
        </div>

        <div className="relative">
          <select
            value={activeItem ? `${activeItem.brand}::${activeItem.baseModel}` : ''}
            onChange={(e) => {
              const [brand, base] = e.target.value.split('::');
              const foundGroup = groupedBaseModels.find(
                (g) => g.brand === brand && g.baseModel === base
              );
              if (foundGroup && foundGroup.variants.length > 0) {
                // Try to keep same storage if exists, otherwise first variant
                const currentStorage = activeItem?.storage;
                const matchStorage = foundGroup.variants.find((v) => v.storage === currentStorage);
                handleSelectItem(matchStorage || foundGroup.variants[0]);
              }
            }}
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none appearance-none cursor-pointer pr-10"
          >
            {groupedBaseModels.map((group) => {
              const isSelected =
                activeItem?.brand === group.brand && activeItem?.baseModel === group.baseModel;
              return (
                <option
                  key={`${group.brand}::${group.baseModel}`}
                  value={`${group.brand}::${group.baseModel}`}
                >
                  {group.brand} — {group.baseModel} ({group.variants.length}{' '}
                  {group.variants.length === 1 ? 'capacidad' : 'capacidades'})
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-cyan-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CHIPS DE ALMACENAMIENTO INTERACTIVOS                                   */}
      {/* ========================================================================= */}
      {availableStoragesForActiveModel.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-0.5">
            <span className="flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Capacidad / Almacenamiento:</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">
              {availableStoragesForActiveModel.length} disponible
              {availableStoragesForActiveModel.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {availableStoragesForActiveModel.map((item) => {
              const isSelected = activeItem?.fullModel.toLowerCase() === item.fullModel.toLowerCase();
              const storageLabel = item.storage || 'Estándar';

              return (
                <button
                  key={item.id || item.fullModel}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer border flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/50'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <HardDrive className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span>{storageLabel}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TARJETA CONFIRMADA DEL EQUIPO EN FINANCIAMIENTO                        */}
      {/* ========================================================================= */}
      {activeItem && (
        <div className="p-3.5 bg-gradient-to-r from-slate-950 via-[#071328] to-slate-950 rounded-2xl border-2 border-cyan-500/70 shadow-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/60 flex items-center justify-center text-cyan-400 shrink-0">
              <Smartphone className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/80 border border-cyan-700 px-1.5 py-0.2 rounded">
                  {activeItem.brand}
                </span>
                {activeItem.storage && (
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700 px-1.5 py-0.2 rounded">
                    {activeItem.storage}
                  </span>
                )}
                <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-0.5">
                  <Check className="w-3 h-3" />
                  <span>Seleccionado para Cotizar</span>
                </span>
              </div>
              <h3 className="font-black text-white text-sm mt-0.5">{activeItem.fullModel}</h3>
            </div>
          </div>

          {activeItem.precioContado && activeItem.precioContado > 0 ? (
            <div className="text-right shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                Precio de Contado:
              </span>
              <span className="font-black text-white text-sm">
                ${activeItem.precioContado.toLocaleString('es-MX')}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
