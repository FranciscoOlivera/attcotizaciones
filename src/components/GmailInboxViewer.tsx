import React from 'react';
import {
  Mail,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Paperclip,
  RefreshCw,
  Sparkles,
  Download,
} from 'lucide-react';
import { DetectedEmailMessage } from '../types/pricing';
import { downloadSampleATTExcel } from '../utils/sampleExcelGenerator';

interface GmailInboxViewerProps {
  emails: DetectedEmailMessage[];
  isScanning: boolean;
  isProcessing: boolean;
  activeProcessingId: string | null;
  onScanNow: () => void;
  onProcessEmail: (email: DetectedEmailMessage) => void;
  hasToken: boolean;
  onSimulateSample: () => void;
}

export const GmailInboxViewer: React.FC<GmailInboxViewerProps> = ({
  emails,
  isScanning,
  isProcessing,
  activeProcessingId,
  onScanNow,
  onProcessEmail,
  hasToken,
  onSimulateSample,
}) => {
  return (
    <div className="space-y-6">
      {/* Informative Notice Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-slate-900 border border-cyan-800/40 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Automatización de Precios AT&amp;T Premium</span>
              <span className="bg-cyan-500/20 text-cyan-300 text-xs px-2.5 py-0.5 rounded-full font-normal border border-cyan-500/30">
                Filtro Activo: "LISTA DE PRECIOS"
              </span>
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              El sistema escucha automáticamente los correos que ingresan con el asunto{' '}
              <strong className="text-cyan-300">"LISTA DE PRECIOS"</strong> y adjunto Excel. Del archivo recibido,
              aísla únicamente la hoja{' '}
              <strong className="text-cyan-300">"Promociones AT&amp;T Premium"</strong>, descartando las demás
              hojas para optimizar espacio, extrae los equipos, plazos y mensualidades, actualiza tu base de datos
              central y te despacha un resumen ejecutivo por correo.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={downloadSampleATTExcel}
                className="inline-flex items-center space-x-1.5 text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-950/50 hover:bg-cyan-900/50 px-3 py-1.5 rounded-lg border border-cyan-700/50 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar archivo Excel de prueba con 4 hojas (para probar en tu correo)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inbox Search Status & Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            <span>Correos Detectados en Gmail</span>
            <span className="text-xs font-normal text-slate-400">
              ({emails.length} {emails.length === 1 ? 'encontrado' : 'encontrados'})
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Búsqueda automática en tu bandeja de entrada: <code className="text-cyan-300">subject:"LISTA DE PRECIOS"</code>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onScanNow}
            disabled={isScanning || !hasToken}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Consultando Gmail...' : 'Actualizar Bandeja'}</span>
          </button>
        </div>
      </div>

      {/* Emails List */}
      {!hasToken ? (
        <div className="text-center py-12 px-4 bg-slate-900/60 rounded-2xl border border-slate-800">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Conecta tu cuenta de Google</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Inicia sesión para que el extractor pueda consultar los correos entrantes de Gmail y actualizar tu Google Sheet.
          </p>
          <div className="inline-block">
            <span className="text-xs text-slate-500">
              O bien puedes probar la extracción de inmediato con el botón "Simular Excel AT&amp;T" en la barra superior.
            </span>
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-200">No hay correos pendientes con "LISTA DE PRECIOS"</h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1">
              En cuanto recibas en tu Gmail un correo con el asunto <strong>"LISTA DE PRECIOS"</strong> y un Excel adjunto,
              aparecerá automáticamente aquí para ser procesado.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onSimulateSample}
              disabled={isProcessing}
              className="inline-flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Simular Recepción Inmediata de Lista AT&amp;T</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {emails.map((msg) => {
            const isCurrentlyActive = activeProcessingId === msg.id;
            const hasValidAttachments = msg.attachments.length > 0;

            return (
              <div
                key={msg.id}
                className={`bg-slate-900 border rounded-xl p-5 transition-all shadow-sm ${
                  msg.processed
                    ? 'border-emerald-800/40 bg-slate-900/60'
                    : isCurrentlyActive
                    ? 'border-cyan-500 ring-1 ring-cyan-500/30 bg-slate-900'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left metadata */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-base">{msg.subject}</span>
                      {msg.processed ? (
                        <span className="inline-flex items-center space-x-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[11px] px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Procesado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 bg-amber-950/80 text-amber-300 border border-amber-800/80 text-[11px] px-2 py-0.5 rounded-full font-medium">
                          <Clock className="w-3 h-3" />
                          <span>Listo para extraer</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-400 flex-wrap">
                      <span>
                        <strong className="text-slate-300">De:</strong> {msg.sender}
                      </span>
                      <span>•</span>
                      <span>
                        <strong className="text-slate-300">Fecha:</strong>{' '}
                        {new Date(msg.date).toLocaleString('es-MX')}
                      </span>
                    </div>

                    {msg.snippet && (
                      <p className="text-xs text-slate-400 line-clamp-1 italic bg-slate-950/40 px-2 py-1 rounded border border-slate-800/60">
                        "{msg.snippet}"
                      </p>
                    )}

                    {/* Attachments list */}
                    <div className="pt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-200"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-medium">{att.filename}</span>
                          <span className="text-[10px] text-slate-400">
                            ({Math.round(att.size / 1024)} KB)
                          </span>
                        </div>
                      ))}

                      {msg.attachments.length === 0 && (
                        <div className="flex items-center space-x-1 text-xs text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>No se detectaron archivos adjuntos .xlsx en este mensaje.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => onProcessEmail(msg)}
                      disabled={isProcessing || !hasValidAttachments}
                      className={`w-full md:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs shadow-md transition disabled:opacity-50 ${
                        msg.processed
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                      }`}
                    >
                      {isCurrentlyActive ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Extrayendo hoja "Promociones AT&amp;T Premium"...</span>
                        </>
                      ) : (
                        <>
                          <span>{msg.processed ? 'Re-procesar y Actualizar' : 'Procesar y Actualizar BD'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
