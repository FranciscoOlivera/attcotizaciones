import React, { useState } from 'react';
import {
  FileCheck2,
  TrendingDown,
  Sparkles,
  MailCheck,
  Send,
  ExternalLink,
  Layers,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Eye,
  FileText,
} from 'lucide-react';
import { SyncExecutionReport } from '../types/pricing';
import { generateEmailHTMLSummary } from '../services/diffService';

interface SyncReportViewerProps {
  report: SyncExecutionReport;
  onResendEmail: () => void;
  isSendingEmail: boolean;
  hasToken: boolean;
  onNavigateToInbox?: () => void;
}

export const SyncReportViewer: React.FC<SyncReportViewerProps> = ({
  report,
  onResendEmail,
  isSendingEmail,
  hasToken,
}) => {
  const [activeTab, setActiveTab] = useState<'kpi' | 'email_preview'>('kpi');

  const priceDrops = report.changes.filter((c) => c.type === 'price_drop');
  const newModels = report.changes.filter((c) => c.type === 'new');
  const priceIncreases = report.changes.filter((c) => c.type === 'price_increase');

  const emailHTML = generateEmailHTMLSummary(report);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <FileCheck2 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Último Resumen de Sincronización Ejecutada
                </h2>
                <p className="text-xs text-slate-400">
                  Archivo procesado:{' '}
                  <strong className="text-slate-200">{report.attachmentName}</strong> •{' '}
                  {new Date(report.timestamp).toLocaleString('es-MX')}
                </p>
              </div>
            </div>

            {/* Space saving callout */}
            <div className="flex items-center space-x-2 text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/80 text-cyan-300">
              <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Aislamiento selectivo:</strong> Se utilizó únicamente la hoja "
                {report.isolatedSheetName}". Las {report.discardedSheetsCount} hojas restantes fueron
                descartadas para optimizar memoria y espacio.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab(activeTab === 'kpi' ? 'email_preview' : 'kpi')}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 transition"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>{activeTab === 'kpi' ? 'Ver Vista Previa del Correo' : 'Ver Tabla de Cambios'}</span>
            </button>

            <button
              onClick={onResendEmail}
              disabled={isSendingEmail || !hasToken}
              className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingEmail ? 'Enviando Correo...' : 'Re-enviar Resumen por Gmail'}</span>
            </button>
          </div>
        </div>

        {/* Email delivery notification banner */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <MailCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Resumen enviado a: <strong className="text-slate-200">{report.emailSentTo}</strong>
            </span>
          </div>

          {report.spreadsheetUrl && (
            <a
              href={report.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 underline"
            >
              <span>Ver Base Central en Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {activeTab === 'email_preview' ? (
        /* Email HTML Preview */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold">
                Vista Previa del Correo HTML Despachado al Usuario
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Destinatario: {report.emailSentTo}
            </span>
          </div>

          <div className="bg-slate-100 rounded-xl overflow-hidden shadow-inner max-h-[600px] overflow-y-auto">
            <iframe
              title="Email Preview"
              srcDoc={emailHTML}
              className="w-full min-h-[550px] border-none bg-transparent"
            />
          </div>
        </div>
      ) : (
        /* KPI & Detailed Diffs */
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-emerald-900/40 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Bajaron de Precio
                </span>
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                {report.priceDropsCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Mensualidades más convenientes</p>
            </div>

            <div className="bg-slate-900 border border-cyan-900/40 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  Nuevos Modelos
                </span>
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold text-cyan-400 mt-2">
                {report.newRecordsCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Agregados al catálogo central</p>
            </div>

            <div className="bg-slate-900 border border-amber-900/40 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Aumentaron
                </span>
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold text-amber-400 mt-2">
                {report.priceIncreasesCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Ajuste de cuota al alza</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Vigentes Sin Cambio
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-3xl font-extrabold text-white mt-2">
                {report.unchangedCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Precios mantenidos</p>
            </div>
          </div>

          {/* Section: Price Drops */}
          {priceDrops.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-emerald-950/40 border-b border-emerald-900/40 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-300 font-semibold text-xs">
                  <TrendingDown className="w-4 h-4" />
                  <span>Equipos que Bajaron de Mensualidad ({priceDrops.length})</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">Mayor ahorro para clientes</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Equipo / Modelo</th>
                      <th className="py-2.5 px-3">Plan</th>
                      <th className="py-2.5 px-3 text-center">Plazo</th>
                      <th className="py-2.5 px-3 text-right">Mensualidad Anterior</th>
                      <th className="py-2.5 px-3 text-right">Nueva Mensualidad</th>
                      <th className="py-2.5 px-3 text-right">Ahorro Mensual</th>
                      <th className="py-2.5 px-4">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {priceDrops.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 font-semibold text-white">
                          {d.brand} {d.model}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-400 font-medium">Plan {d.planNombre}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300">{d.plazo} meses</td>
                        <td className="py-2.5 px-3 text-right text-slate-400 line-through">
                          ${d.oldMensualidadTotal?.toLocaleString('es-MX')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          ${d.newMensualidadTotal.toLocaleString('es-MX')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          -${Math.abs(d.diffMensualidad || 0).toLocaleString('es-MX')}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-300">{d.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section: New models */}
          {newModels.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-cyan-950/40 border-b border-cyan-900/40 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-300 font-semibold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Nuevos Equipos Incorporados al Catálogo ({newModels.length})</span>
                </div>
                <span className="text-[11px] text-cyan-400 font-medium">Novedades</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Equipo / Modelo</th>
                      <th className="py-2.5 px-3">Plan</th>
                      <th className="py-2.5 px-3 text-center">Plazo</th>
                      <th className="py-2.5 px-3 text-right">Mensualidad Total</th>
                      <th className="py-2.5 px-3 text-right">Precio Promoción</th>
                      <th className="py-2.5 px-4">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {newModels.map((n) => (
                      <tr key={n.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 font-semibold text-white">
                          {n.brand} {n.model}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-400 font-medium">Plan {n.planNombre}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300">{n.plazo} meses</td>
                        <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                          ${n.newMensualidadTotal.toLocaleString('es-MX')}/mes
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          ${n.newPrecioPromocion.toLocaleString('es-MX')}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-300">
                          {n.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
