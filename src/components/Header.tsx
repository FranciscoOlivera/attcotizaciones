import React from 'react';
import { User } from 'firebase/auth';
import {
  Mail,
  FileSpreadsheet,
  ShieldCheck,
  LogIn,
  LogOut,
  Radio,
  RefreshCw,
  Lock,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  isScanning: boolean;
  onScanNow: () => void;
  hasToken: boolean;
  masterEmail?: string;
  isMasterConnected?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  isScanning,
  onScanNow,
  hasToken,
  masterEmail = 'UserTotix98@gmail.com',
  isMasterConnected = true,
  theme = 'dark',
  onToggleTheme,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}) => {
  const isOwner = user?.email?.toLowerCase() === masterEmail.toLowerCase();
  const isDark = theme === 'dark';

  return (
    <header
      className={`border-b z-30 transition-colors duration-200 ${
        isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200 shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Mobile Menu Button + Logo & Title */}
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Menu Toggle */}
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className={`lg:hidden p-2 rounded-xl transition border ${
                  isDark
                    ? 'text-slate-300 hover:text-white bg-slate-800 border-slate-700'
                    : 'text-slate-700 hover:text-slate-900 bg-slate-100 border-slate-200'
                }`}
                title={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-cyan-500" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xl font-bold tracking-tight bg-clip-text text-transparent ${
                    isDark
                      ? 'bg-gradient-to-r from-white via-cyan-100 to-cyan-400'
                      : 'bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700'
                  }`}
                >
                  AT&amp;T Precios Sync
                </span>
                <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
                  Promociones Premium
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className={isDark ? 'text-emerald-300 font-medium' : 'text-emerald-700 font-semibold'}>
                  Buzón: {masterEmail}
                </span>
                <span className="text-slate-400 hidden md:inline">•</span>
                <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'} hidden md:inline`}>
                  Cotizaciones y Publicidad Oficial
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Actions, Theme Toggle & User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Theme Toggle (Dark / Light) */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className={`p-2 rounded-xl border transition flex items-center justify-center ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title={isDark ? 'Cambiar a Tema Claro (Light Mode)' : 'Cambiar a Tema Oscuro (Dark Mode)'}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
            )}

            {/* Master Scan button: visible when owner is authenticated */}
            {isOwner && (
              <button
                onClick={onScanNow}
                disabled={isScanning}
                className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                title="Buscar nuevos correos en el buzón maestro de Gmail"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isScanning ? 'Sincronizando...' : 'Sincronizar Gmail'}</span>
              </button>
            )}

            {/* Role indicator badge */}
            <div
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              {isOwner ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className={isDark ? 'text-emerald-300 font-medium' : 'text-emerald-700 font-semibold'}>
                    Administrador
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Modo Cotizador</span>
                </>
              )}
            </div>

            {/* Auth section */}
            {user ? (
              <div
                className={`flex items-center space-x-2 pl-2.5 pr-2 py-1 rounded-xl border ${
                  isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuario'}
                      className="w-7 h-7 rounded-full ring-2 ring-cyan-500/50"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-bold">
                      {user.email?.[0].toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="text-left hidden lg:block">
                    <p className={`text-xs font-medium leading-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-cyan-500 truncate max-w-[130px] leading-tight">
                      {user.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  title="Cerrar sesión"
                  className={`p-1.5 rounded-lg transition ${
                    isDark
                      ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-700/50'
                      : 'text-slate-500 hover:text-rose-600 hover:bg-slate-200'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className={`flex items-center space-x-1.5 border px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-sm ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
                title="Acceso exclusivo para el administrador de la cuenta"
              >
                <Lock className="w-3.5 h-3.5 text-cyan-500" />
                <span className="hidden sm:inline">{isLoggingIn ? 'Verificando...' : 'Acceso Admin'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
