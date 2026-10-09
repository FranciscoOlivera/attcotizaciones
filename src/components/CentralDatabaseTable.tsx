import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Download,
  ExternalLink,
  Smartphone,
  Tag,
  Calculator,
  MessageCircle,
  ArrowRight,
  AlertTriangle,
  Layers,
  Calendar,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
  TrendingDown,
  FileSpreadsheet,
} from 'lucide-react';
import { DevicePriceRecord } from '../types/pricing';
import { deduplicateDeviceRecords } from '../utils/recordDeduplicator';
import * as XLSX from 'xlsx';

interface CentralDatabaseTableProps {
  records: DevicePriceRecord[];
  spreadsheetUrl?: string;
  onForceSyncToSheet?: () => void;
  isSyncingToSheet?: boolean;
  onSelectForQuotation?: (record: DevicePriceRecord) => void;
  onNavigateToInbox?: () => void;
}

type ViewOrganizationMode = 'by-plan' | 'by-model' | 'by-plazo' | 'table';

export const CentralDatabaseTable: React.FC<CentralDatabaseTableProps> = ({
  records,
  spreadsheetUrl,
  onForceSyncToSheet,
  isSyncingToSheet,
  onSelectForQuotation,
  onNavigateToInbox,
}) => {
  // Organization View Mode
  const [viewMode, setViewMode] = useState<ViewOrganizationMode>('by-plan');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedPlan, setSelectedPlan] = useState('ALL');
  const [selectedPlazo, setSelectedPlazo] = useState('ALL');
  const [priceRangeFilter, setPriceRangeFilter] = useState<'ALL' | 'under-500' | '500-1000' | 'over-1000'>('ALL');
  const [sortBy, setSortBy] = useState<'mensualidad-asc' | 'mensualidad-desc' | 'promo-price-desc' | 'brand'>('mensualidad-asc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBrand, selectedPlan, selectedPlazo, priceRangeFilter, sortBy, pageSize]);

  // Filter records to ONLY show equipment with active promotional price (> 0)
  // User request: "muestra equipos con la promoción vigente unicamente"
  const activePromoRecords = useMemo(() => {
    return deduplicateDeviceRecords(records.filter((r) => r.precioPromocion > 0));
  }, [records]);

  // Available brands in current database
  const brands = useMemo(() => {
    const set = new Set<string>();
    activePromoRecords.forEach((r) => {
      if (r.brand) set.add(r.brand);
    });
    return Array.from(set).sort();
  }, [activePromoRecords]);

  // Available plans in current database
  const plans = useMemo(() => {
    const set = new Set<string>();
    activePromoRecords.forEach((r) => {
      if (r.planNombre) set.add(r.planNombre);
    });
    return Array.from(set).sort();
  }, [activePromoRecords]);

  // Available plazos in current database
  const plazos = useMemo(() => {
    const set = new Set<number>();
    activePromoRecords.forEach((r) => {
      if (r.plazo) set.add(r.plazo);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [activePromoRecords]);

  // Filtered & Sorted list
  const filteredRecords = useMemo(() => {
    return activePromoRecords
      .filter((rec) => {
        const matchesSearch =
          rec.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rec.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rec.planNombre.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesBrand = selectedBrand === 'ALL' || rec.brand.toLowerCase() === selectedBrand.toLowerCase();
        const matchesPlan = selectedPlan === 'ALL' || rec.planNombre.toLowerCase() === selectedPlan.toLowerCase();
        const matchesPlazo = selectedPlazo === 'ALL' || String(rec.plazo) === selectedPlazo;

        const mens = rec.mensualidadTotalConMaxEnganche || rec.mensualidad || 0;
        let matchesPrice = true;
        if (priceRangeFilter === 'under-500') matchesPrice = mens < 500;
        else if (priceRangeFilter === '500-1000') matchesPrice = mens >= 500 && mens <= 1000;
        else if (priceRangeFilter === 'over-1000') matchesPrice = mens > 1000;

        return matchesSearch && matchesBrand && matchesPlan && matchesPlazo && matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'mensualidad-asc') {
          return (a.mensualidadTotalConMaxEnganche || a.mensualidad) - (b.mensualidadTotalConMaxEnganche || b.mensualidad);
        }
        if (sortBy === 'mensualidad-desc') {
          return (b.mensualidadTotalConMaxEnganche || b.mensualidad) - (a.mensualidadTotalConMaxEnganche || a.mensualidad);
        }
        if (sortBy === 'promo-price-desc') {
          return (b.precioPromocion || b.precioLista) - (a.precioPromocion || a.precioLista);
        }
        return a.brand.localeCompare(b.brand);
      });
  }, [activePromoRecords, searchTerm, selectedBrand, selectedPlan, selectedPlazo, priceRangeFilter, sortBy]);

  // Metrics
  const minMensualidad = useMemo(() => {
    if (activePromoRecords.length === 0) return 0;
    return activePromoRecords.reduce((min, r) => {
      const val = Number(r.mensualidadTotalConMaxEnganche || r.mensualidad || 0);
      return val > 0 ? (min === 0 ? val : Math.min(min, val)) : min;
    }, 0);
  }, [activePromoRecords]);

  const avgPromoPrice = useMemo(() => {
    if (activePromoRecords.length === 0) return 0;
    const sum = activePromoRecords.reduce((acc, r) => acc + Number(r.precioPromocion || r.precioLista || 0), 0);
    return Math.round(sum / activePromoRecords.length);
  }, [activePromoRecords]);

  // Grouped by Plan
  const recordsByPlan = useMemo(() => {
    const map = new Map<string, DevicePriceRecord[]>();
    filteredRecords.forEach((r) => {
      const key = r.planNombre || 'Otros';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRecords]);

  // Grouped by Model
  const recordsByModel = useMemo(() => {
    const map = new Map<string, { brand: string; model: string; variants: DevicePriceRecord[] }>();
    filteredRecords.forEach((r) => {
      const key = `${r.brand} ${r.model}`.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { brand: r.brand, model: r.model, variants: [] });
      }
      map.get(key)!.variants.push(r);
    });
    // Sort models by lowest monthly payment
    return Array.from(map.values()).sort((a, b) => {
      const minA = Math.min(...a.variants.map((v) => v.mensualidadTotalConMaxEnganche || 999999));
      const minB = Math.min(...b.variants.map((v) => v.mensualidadTotalConMaxEnganche || 999999));
      return minA - minB;
    });
  }, [filteredRecords]);

  // Grouped by Plazo
  const recordsByPlazo = useMemo(() => {
    const map = new Map<number, DevicePriceRecord[]>();
    filteredRecords.forEach((r) => {
      const p = r.plazo || 36;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // 36m first, then 24m
  }, [filteredRecords]);

  // Paginated slice for table view
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Export view to Excel
  const handleExportExcel = () => {
    const rows = filteredRecords.map((r) => ({
      Marca: r.brand,
      'Equipo / Modelo': r.model,
      'Plan AT&T': r.planNombre,
      'Costo Plan ($)': r.costoPlan,
      'Plazo (Meses)': r.plazo,
      'Precio Promoción ($)': r.precioPromocion,
      'Enganche Máximo 50% ($)': r.engancheMaximo,
      'Mensualidad Equipo ($)': r.mensualidadEquipoConMaxEnganche,
      'Mensualidad Total a Pagar ($)': r.mensualidadTotalConMaxEnganche,
      'Última Actualización': new Date(r.updatedAt).toLocaleString('es-MX'),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Promociones Vigentes AT&T');
    XLSX.writeFile(wb, `Base_Central_Precios_ATT_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* ⚠️ REQUIRED WARNING LEGEND IF NO TABLE IS LINKED */}
      {activePromoRecords.length === 0 && (
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
                No hay equipos ni precios de planes cargados en la base de datos central. Conecta tu correo de Gmail para leer automáticamente el correo <strong>"LISTA DE PRECIOS"</strong> o carga el archivo Excel para importar las promociones vigentes.
              </p>
              {onNavigateToInbox && (
                <div className="pt-2">
                  <button
                    onClick={onNavigateToInbox}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-3 py-1.5 rounded-lg font-semibold text-xs transition"
                  >
                    Ir a Bandeja de Entrada / Subir Archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-slate-400 block mb-0.5">Equipos con Promo Vigente</span>
          <span className="text-xl font-bold text-white">{activePromoRecords.length}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-slate-400 block mb-0.5">Mensualidad Total Mínima</span>
          <span className="text-xl font-bold text-emerald-400">
            {minMensualidad > 0 ? (
              <>
                ${minMensualidad.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                <span className="text-[10px] text-slate-400 font-normal"> /mes</span>
              </>
            ) : (
              '--'
            )}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-slate-400 block mb-0.5">Precio Promoción Promedio</span>
          <span className="text-xl font-bold text-cyan-400">
            {avgPromoPrice > 0 ? `$${avgPromoPrice.toLocaleString('es-MX')}` : '--'}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-slate-400 block mb-0.5">Google Sheets</span>
            <span className="text-xs font-semibold text-slate-200">
              {spreadsheetUrl ? 'Sincronizada' : 'Sin vincular'}
            </span>
          </div>
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition"
              title="Abrir hoja central en Google Sheets"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* VIEW ORGANIZATION MODE SWITCHER (User Request: "crea una mejor organización por plan, plazo, modelo, etc.") */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Organización de Equipos:
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {filteredRecords.length} promociones encontradas
          </span>
        </div>

        {/* View Mode Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => setViewMode('by-plan')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
              viewMode === 'by-plan'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Por Plan AT&amp;T</span>
          </button>

          <button
            onClick={() => setViewMode('by-model')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
              viewMode === 'by-model'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Por Modelo / Equipo</span>
          </button>

          <button
            onClick={() => setViewMode('by-plazo')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
              viewMode === 'by-plazo'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Por Plazo (36m / 24m)</span>
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
              viewMode === 'table'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Tabla Detallada</span>
          </button>
        </div>
      </div>

      {/* Filter and search toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por equipo, marca o plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filters & Export */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end text-xs">
            {/* Plan selector */}
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Todos los Planes</option>
              {plans.map((p) => (
                <option key={p} value={p}>
                  Plan {p}
                </option>
              ))}
            </select>

            {/* Plazo selector */}
            <select
              value={selectedPlazo}
              onChange={(e) => setSelectedPlazo(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Todos los plazos</option>
              {plazos.map((p) => (
                <option key={p} value={String(p)}>
                  {p} meses
                </option>
              ))}
            </select>

            {/* Sort order */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="mensualidad-asc">Mensualidad: Menor a Mayor</option>
              <option value="mensualidad-desc">Mensualidad: Mayor a Menor</option>
              <option value="promo-price-desc">Precio Promo: Mayor a Menor</option>
              <option value="brand">Marca</option>
            </select>

            {/* Export button */}
            <button
              onClick={handleExportExcel}
              disabled={activePromoRecords.length === 0}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-medium border border-slate-700 transition disabled:opacity-50"
              title="Descargar datos en Excel"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Quick Range Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pt-1">
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap mr-1">
            Presupuesto:
          </span>
          <button
            onClick={() => setPriceRangeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
              priceRangeFilter === 'ALL'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Cualquiera
          </button>
          <button
            onClick={() => setPriceRangeFilter('under-500')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
              priceRangeFilter === 'under-500'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            🔥 Menos de $500/mes
          </button>
          <button
            onClick={() => setPriceRangeFilter('500-1000')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
              priceRangeFilter === '500-1000'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            ⚡ $500 a $1,000/mes
          </button>
          <button
            onClick={() => setPriceRangeFilter('over-1000')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
              priceRangeFilter === 'over-1000'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            💎 Gama Alta (+ $1,000/mes)
          </button>
        </div>

        {/* Brand chips */}
        {brands.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-800/60">
            <button
              onClick={() => setSelectedBrand('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedBrand === 'ALL'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Todas las Marcas ({activePromoRecords.length})
            </button>
            {brands.map((b) => {
              const count = activePromoRecords.filter((r) => r.brand.toLowerCase() === b.toLowerCase()).length;
              return (
                <button
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    selectedBrand.toLowerCase() === b.toLowerCase()
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {b} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: ORGANIZED BY PLAN AT&T                                            */}
      {/* ========================================================================= */}
      {viewMode === 'by-plan' && (
        <div className="space-y-6 animate-fadeIn">
          {recordsByPlan.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
              <p className="font-semibold text-slate-200">No hay equipos con los filtros seleccionados</p>
              <p className="text-xs text-slate-500 mt-1">Ajusta los filtros de búsqueda o marca.</p>
            </div>
          ) : (
            recordsByPlan.map(([planName, planRecords]) => {
              const planCost = planRecords[0]?.costoPlan || 0;
              const minMonthly = Math.min(...planRecords.map((r) => r.mensualidadTotalConMaxEnganche || 999999));

              return (
                <div
                  key={planName}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
                >
                  {/* Plan Header */}
                  <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60 flex items-center justify-center font-bold text-sm shadow">
                        📶
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-white tracking-wide">
                            Plan {planName}
                          </h3>
                          <span className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ${planCost.toLocaleString('es-MX')}/mes
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {planRecords.length} equipos con precio de promoción vigente
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl">
                        <span className="text-slate-400 text-[11px] block">Desde:</span>
                        <span className="font-extrabold text-emerald-400 text-sm">
                          ${minMonthly.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Device Cards Grid for this Plan */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {planRecords.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 space-y-3 transition-all hover:shadow-md flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                              {item.brand}
                            </span>
                            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                              ⏱️ {item.plazo}m
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                            {item.model}
                          </h4>

                          <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-800/60">
                            <span className="text-slate-400 text-[11px]">Precio Promo:</span>
                            <span className="font-semibold text-slate-200">
                              ${item.precioPromocion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-slate-400 text-[11px]">Enganche (50% máx):</span>
                            <span className="font-medium text-emerald-400">
                              ${item.engancheMaximo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Price & Quote CTA */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Total con Plan:</span>
                            <span className="text-base font-black text-emerald-400">
                              ${item.mensualidadTotalConMaxEnganche.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              <span className="text-[10px] text-slate-400 font-normal"> /m</span>
                            </span>
                          </div>

                          {onSelectForQuotation && (
                            <button
                              onClick={() => onSelectForQuotation(item)}
                              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl text-xs shadow transition shrink-0"
                              title="Cotizar este equipo en el Cotizador WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Cotizar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: ORGANIZED BY MODEL / EQUIPMENT                                    */}
      {/* ========================================================================= */}
      {viewMode === 'by-model' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
          {recordsByModel.length === 0 ? (
            <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
              <p className="font-semibold text-slate-200">No hay modelos con los filtros seleccionados</p>
            </div>
          ) : (
            recordsByModel.map((deviceGroup) => {
              const bestVariant = [...deviceGroup.variants].sort(
                (a, b) => a.mensualidadTotalConMaxEnganche - b.mensualidadTotalConMaxEnganche
              )[0];

              return (
                <div
                  key={`${deviceGroup.brand}-${deviceGroup.model}`}
                  className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 shadow-md space-y-3 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                          {deviceGroup.brand}
                        </span>
                        <h4 className="text-base font-bold text-white tracking-tight">
                          {deviceGroup.model}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Desde:</span>
                        <span className="text-sm font-extrabold text-emerald-400">
                          ${bestVariant.mensualidadTotalConMaxEnganche.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m
                        </span>
                      </div>
                    </div>

                    {/* Available options breakdown */}
                    <div className="mt-3 space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Planes y plazos vigentes ({deviceGroup.variants.length} opciones):
                      </span>
                      <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                        {deviceGroup.variants.map((v, idx) => (
                          <div
                            key={`${v.id}-${idx}`}
                            className="bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-200">Plan {v.planNombre}</span>
                                <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.2 rounded">
                                  {v.plazo}m
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Promo: ${v.precioPromocion.toLocaleString('es-MX')} • Enganche: ${v.engancheMaximo.toLocaleString('es-MX')}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-emerald-400 text-xs">
                                ${v.mensualidadTotalConMaxEnganche.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m
                              </span>
                              {onSelectForQuotation && (
                                <button
                                  onClick={() => onSelectForQuotation(v)}
                                  className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg transition"
                                  title="Cotizar esta combinación"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  {onSelectForQuotation && (
                    <button
                      onClick={() => onSelectForQuotation(bestVariant)}
                      className="w-full mt-2 flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2 px-3 rounded-xl text-xs shadow transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Cotizar con Mejor Oferta (${bestVariant.mensualidadTotalConMaxEnganche.toFixed(2)}/m)</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ORGANIZED BY PLAZO (36 MESES VS 24 MESES)                         */}
      {/* ========================================================================= */}
      {viewMode === 'by-plazo' && (
        <div className="space-y-6 animate-fadeIn">
          {recordsByPlazo.map(([plazoMeses, plazoRecords]) => (
            <div
              key={plazoMeses}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
            >
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-bold text-sm">
                    ⏱️
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Financiamiento a {plazoMeses} Meses
                    </h3>
                    <p className="text-xs text-slate-400">
                      {plazoMeses === 36
                        ? 'Plazo estándar de máxima comodidad y mensualidad más baja'
                        : 'Plazo a 24 meses para liquidar más rápido'}
                    </p>
                  </div>
                </div>
                <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-bold px-3 py-1 rounded-full">
                  {plazoRecords.length} opciones
                </span>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plazoRecords.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3.5 space-y-2.5 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-cyan-400 uppercase">{item.brand}</span>
                        <span className="font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          Plan {item.planNombre}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white leading-snug mt-1">
                        {item.model}
                      </h4>
                      <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                        <span>Promo: ${item.precioPromocion.toLocaleString('es-MX')}</span>
                        <span className="text-emerald-400">Enganche: ${item.engancheMaximo.toLocaleString('es-MX')}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total con Plan:</span>
                        <span className="text-sm font-black text-emerald-400">
                          ${item.mensualidadTotalConMaxEnganche.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/m
                        </span>
                      </div>
                      {onSelectForQuotation && (
                        <button
                          onClick={() => onSelectForQuotation(item)}
                          className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1.5 rounded-lg text-xs transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Cotizar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: DETAILED RESPONSIVE DATA TABLE                                    */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-4">Equipo / Modelo</th>
                  <th className="py-3 px-3">Plan AT&amp;T</th>
                  <th className="py-3 px-2 text-center">Plazo</th>
                  <th className="py-3 px-3 text-right">Precio Promoción</th>
                  <th className="py-3 px-3 text-right">Enganche Máx (50%)</th>
                  <th className="py-3 px-3 text-right">Mensualidad Equipo</th>
                  <th className="py-3 px-3 text-right">Mensualidad Total</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
                      <p className="font-semibold text-slate-300">Falta vincular tabla de precios</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No hay equipos con promoción vigente cargados en este momento.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                      {/* Brand & Model */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 text-cyan-400 flex items-center justify-center shrink-0 border border-slate-700/60">
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-200 block text-xs">
                              {item.model}
                            </span>
                            <span className="text-[10px] text-cyan-400 uppercase font-semibold">
                              {item.brand}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plan AT&T */}
                      <td className="py-3 px-3">
                        <span className="inline-block bg-slate-800/80 text-cyan-300 border border-slate-700/60 px-2 py-0.5 rounded text-[11px] font-medium">
                          Plan {item.planNombre}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Renta: ${item.costoPlan?.toLocaleString('es-MX')}/mes
                        </span>
                      </td>

                      {/* Plazo */}
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                          {item.plazo}m
                        </span>
                      </td>

                      {/* Precio Promoción & Contado */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-white text-xs block">
                          ${item.precioPromocion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                        {item.precioContado && item.precioContado > 0 ? (
                          <span className="text-[10px] text-slate-400 block">
                            Contado: ${item.precioContado.toLocaleString('es-MX')}
                          </span>
                        ) : null}
                        {item.esMenor30Contado && (
                          <span className="inline-block text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1 rounded font-bold mt-0.5">
                            🌟 3 Rentas ($0 Eng)
                          </span>
                        )}
                      </td>

                      {/* Enganche Máximo (50%) */}
                      <td className="py-3 px-3 text-right">
                        <span className="text-emerald-400 font-semibold text-xs">
                          ${item.engancheMaximo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Mensualidad Equipo */}
                      <td className="py-3 px-3 text-right">
                        <span className="text-slate-300 font-medium text-xs">
                          ${item.mensualidadEquipoConMaxEnganche.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Mensualidad Total */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-extrabold text-emerald-400 text-xs">
                          ${item.mensualidadTotalConMaxEnganche.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Cotizar CTA */}
                      <td className="py-3 px-4 text-center">
                        {onSelectForQuotation && (
                          <button
                            onClick={() => onSelectForQuotation(item)}
                            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 rounded-lg text-[11px] shadow-sm transition"
                            title="Cotizar en WhatsApp con cálculo oficial"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Cotizar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer pagination & info */}
          <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span>
                Mostrando {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredRecords.length)} de {filteredRecords.length} promociones
              </span>
              <span className="text-slate-600">•</span>
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-slate-400">Por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>

            {/* Page navigation */}
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-300 transition text-[11px]"
                >
                  ← Anterior
                </button>
                <span className="text-[11px] font-medium text-cyan-400">
                  Pág {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-300 transition text-[11px]"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
