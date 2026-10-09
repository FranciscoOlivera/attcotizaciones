import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Mail,
  Clock,
  ExternalLink,
  PlusCircle,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Download,
  UploadCloud,
  ChevronDown,
  KeyRound,
} from 'lucide-react';
import { downloadSampleATTExcel } from '../utils/sampleExcelGenerator';

interface AutomationConfigBarProps {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  onSetSpreadsheetId: (id: string) => void;
  onCreateSpreadsheet: () => void;
  isCreatingSheet: boolean;
  recipientEmail: string;
  onSetRecipientEmail: (email: string) => void;
  isAutoMonitorActive: boolean;
  onToggleAutoMonitor: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateAndRunSample: () => void;
  isProcessing: boolean;
  hasToken: boolean;
  isOwner?: boolean;
  masterEmail?: string;
  onOpenChangeMasterMailbox?: () => void;
  theme?: 'dark' | 'light';
}

export const AutomationConfigBar: React.FC<AutomationConfigBarProps> = ({
  spreadsheetId,
  spreadsheetUrl,
  onSetSpreadsheetId,
  onCreateSpreadsheet,
  isCreatingSheet,
  recipientEmail,
  onSetRecipientEmail,
  isAutoMonitorActive,
  onToggleAutoMonitor,
  onUploadFile,
  onGenerateAndRunSample,
  isProcessing,
  hasToken,
  isOwner = false,
  masterEmail = 'UserTotix98@gmail.com',
  onOpenChangeMasterMailbox,
  theme = 'dark',
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [tempId, setTempId] = useState(spreadsheetId);
  const [tempEmail, setTempEmail] = useState(recipientEmail);
  const isDark = theme === 'dark';

  return (
    <div
      className={`border-b transition-colors duration-200 ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Indicators */}
          <div className="flex items-center flex-wrap gap-2.5 text-xs">
            {/* Google Sheets status */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
                isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Base Central:</span>
              {spreadsheetUrl ? (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
                >
                  <span>Google Sheets Conectado</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Sincronizada en Servidor
                </span>
              )}
            </div>

            {/* Recipient Email (Owner's email) */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
                isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-300'
              }`}
            >
              <Mail className="w-4 h-4 text-cyan-500" />
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Buzón Maestro:</span>
              <span className="font-medium text-cyan-600 dark:text-cyan-300 truncate max-w-[200px]">
                {masterEmail}
              </span>
              {onOpenChangeMasterMailbox && (
                <button
                  type="button"
                  onClick={onOpenChangeMasterMailbox}
                  className="flex items-center space-x-1 ml-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 rounded transition"
                  title="Cambiar buzón maestro (Protegido por PIN de Administrador)"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Cambiar (PIN)</span>
                </button>
              )}
            </div>

            {/* Auto Monitor Status */}
            <div className="flex items-center space-x-2">
              <div
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  isDark
                    ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                    : 'bg-cyan-100/70 border-cyan-300 text-cyan-800'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                <span>Lector 24/7 en Servidor Activo</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {isOwner && (
              <>
                {/* Download/simulate sample button */}
                <button
                  onClick={onGenerateAndRunSample}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50"
                  title="Simula la recepción de un archivo y prueba la extracción de Promociones AT&T Premium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Simular Excel</span>
                </button>

                {/* Manual file upload */}
                <label
                  className={`flex items-center space-x-1.5 font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Subir Excel</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={onUploadFile}
                    disabled={isProcessing}
                    className="hidden"
                  />
                </label>

                {/* Toggle Config drawer */}
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                  title="Configuración de conexiones"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Collapsible Config Details (Admin Only) */}
        {isOwner && showConfig && (
          <div
            className={`mt-3 pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-fadeIn ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            {/* Sheet Config */}
            <div
              className={`p-3 rounded-lg border ${
                isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white border-slate-300'
              }`}
            >
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                Hoja de Cálculo Central (Google Sheets)
              </label>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Especifica el ID de tu Google Sheet central o crea uno nuevo automáticamente.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ID de la hoja (ej. 1BxiMVs0XRA5nFMdKvB...)"
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value)}
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
                <button
                  onClick={() => onSetSpreadsheetId(tempId)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  Guardar
                </button>
                <button
                  onClick={onCreateSpreadsheet}
                  disabled={isCreatingSheet || !hasToken}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition disabled:opacity-50"
                  title="Crear una hoja de cálculo nueva en tu Google Drive"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isCreatingSheet ? 'Creando...' : 'Crear Nueva'}</span>
                </button>
              </div>
            </div>

            {/* Email Config */}
            <div
              className={`p-3 rounded-lg border ${
                isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white border-slate-300'
              }`}
            >
              <label className={`font-semibold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                Destinatario del Resumen por Correo
              </label>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Al terminar de procesar, se enviará el informe de cambios detallado a esta dirección.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="ejemplo@empresa.com"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
                <button
                  onClick={() => onSetRecipientEmail(tempEmail)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-lg font-medium transition"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
