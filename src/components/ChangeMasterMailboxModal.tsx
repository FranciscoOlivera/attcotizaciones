import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, KeyRound, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ChangeMasterMailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMasterEmail: string;
  onMailboxChanged: (newEmail: string) => void;
  isDark?: boolean;
}

export const ChangeMasterMailboxModal: React.FC<ChangeMasterMailboxModalProps> = ({
  isOpen,
  onClose,
  currentMasterEmail,
  onMailboxChanged,
  isDark = true,
}) => {
  const [pin, setPin] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedPin = pin.trim();
    const trimmedEmail = newEmail.trim();

    if (!trimmedPin) {
      setErrorMessage('Por favor ingresa tu PIN de seguridad.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setErrorMessage('Ingresa un correo electrónico de Gmail válido.');
      return;
    }

    if (trimmedEmail.toLowerCase() === currentMasterEmail.toLowerCase()) {
      setErrorMessage('El nuevo correo es idéntico al buzón actual.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/master/change-mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: trimmedPin,
          newEmail: trimmedEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar el buzón maestro.');
      }

      setSuccessMessage(`¡Buzón maestro actualizado exitosamente a: ${data.masterEmail}!`);
      onMailboxChanged(data.masterEmail);
      setTimeout(() => {
        setPin('');
        setNewEmail('');
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión al servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-md border rounded-3xl p-6 shadow-2xl relative transition-all animate-scaleUp ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-white shadow-cyan-950/40'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className={`absolute top-4 right-4 p-2 rounded-xl transition ${
            isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-slate-500 hover:text-slate-900 bg-slate-100'
          }`}
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span>Cambiar Buzón Maestro</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                PIN de Administrador
              </span>
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Acceso restringido para el titular de la aplicación
            </p>
          </div>
        </div>

        {/* Current Mailbox Display */}
        <div
          className={`p-3.5 rounded-2xl border mb-5 flex items-center justify-between text-xs ${
            isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2 truncate">
            <Mail className="w-4 h-4 text-cyan-500 shrink-0" />
            <span className="text-[11px] text-slate-400">Buzón Actual:</span>
            <strong className="truncate font-semibold text-cyan-400">{currentMasterEmail}</strong>
          </div>
          <span className="shrink-0 text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/60 font-bold">
            Activo
          </span>
        </div>

        {/* Notification alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Change Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PIN Input */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              PIN de Seguridad (4 dígitos)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ingresa tu PIN confidencial"
                className={`w-full pl-9 pr-16 py-2.5 rounded-xl border text-sm font-mono tracking-widest transition focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-cyan-500 hover:text-cyan-400 font-semibold"
              >
                {showPin ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Solo el titular autorizado puede realizar este cambio con su PIN secreto personal.
            </p>
          </div>

          {/* New Gmail Address Input */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Nuevo Correo de Buzón Maestro
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                required
              />
            </div>
            <p className="text-[11px] text-slate-500">
              El lector de Gmail leerá los correos y archivos Excel enviados exclusivamente a esta cuenta.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
                isDark
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || pin.length < 4 || !newEmail}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-600/30 transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Verificando...' : 'Guardar Nuevo Buzón'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
