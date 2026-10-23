import React, { useState } from 'react';
import {
  QrCode,
  Plus,
  BarChart3,
  Users,
  Smartphone,
  FolderSync,
  Layers,
  Sparkles,
  Shield,
  Wrench,
  ChevronDown,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserSwitchModal } from './UserSwitchModal';

export type TabType = 'projects' | 'new-project' | 'analytics' | 'users' | 'simulator';

interface HeaderProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onNewProjectClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onNewProjectClick,
}) => {
  const { currentUser, isAdmin, logout } = useApp();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('projects')}>
              <div className="h-10 px-3 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-sm">
                <img
                  src="/illusion-logo-highres-white.png"
                  alt="Illusion"
                  className="h-6 w-auto object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base sm:text-lg tracking-tight text-white">QR Dinámico</span>
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full">
                    <FolderSync className="w-3 h-3" />
                    OneDrive Sync
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Gestión de instalaciones y documentación de clientes
                </p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60">
              <button
                id="nav-projects-tab"
                onClick={() => onTabChange('projects')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'projects'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Instalaciones</span>
              </button>

              <button
                id="nav-analytics-tab"
                onClick={() => onTabChange('analytics')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'analytics'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Estadísticas</span>
              </button>

              <button
                id="nav-users-tab"
                onClick={() => onTabChange('users')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'users'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Equipo</span>
              </button>

              <button
                id="nav-simulator-tab"
                onClick={() => onTabChange('simulator')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === 'simulator'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Simulador QR</span>
              </button>
            </nav>

            {/* Right Actions: User Switcher & New Project */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* User Switch Badge */}
              <button
                onClick={() => setIsSwitchModalOpen(true)}
                title="Cambiar de usuario o identificarte"
                className={`flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition cursor-pointer text-left ${
                  isAdmin
                    ? 'bg-sky-950/60 border-sky-600/40 hover:bg-sky-900/60 text-sky-200'
                    : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg font-bold text-[11px] flex items-center justify-center shadow-sm shrink-0 ${
                    isAdmin
                      ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="hidden md:block leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white max-w-[120px] truncate">
                      {currentUser?.name || 'Jonatan Cusac'}
                    </span>
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-sky-500/20 text-sky-400 font-semibold px-1.5 py-0.2 rounded border border-sky-500/30">
                        <Shield className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 font-semibold px-1.5 py-0.2 rounded border border-emerald-500/30">
                        <Wrench className="w-2.5 h-2.5" />
                        Técnico
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <span>Cambiar acceso</span>
                    <ChevronDown className="w-2.5 h-2.5" />
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 md:hidden" />
              </button>

              {/* Logout button */}
              <button
                id="btn-logout"
                onClick={logout}
                title="Cerrar sesión"
                className="p-2 sm:px-2.5 sm:py-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-xl border border-transparent hover:border-rose-500/30 transition cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline text-xs font-medium">Salir</span>
              </button>

              <button
                id="btn-create-project-header"
                onClick={onNewProjectClick}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-sky-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Nuevo Proyecto</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            </div>
          </div>

          {/* Mobile Sub-Navigation Bar */}
          <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 border-t border-slate-800 text-xs space-x-1">
            <button
              onClick={() => onTabChange('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                currentTab === 'projects' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Instalaciones</span>
            </button>
            <button
              onClick={() => onTabChange('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                currentTab === 'analytics' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Estadísticas</span>
            </button>
            <button
              onClick={() => onTabChange('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                currentTab === 'users' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Equipo</span>
            </button>
            <button
              onClick={() => onTabChange('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                currentTab === 'simulator' ? 'bg-indigo-600 text-white' : 'text-indigo-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Simulador</span>
            </button>
          </div>
        </div>
      </header>

      {/* User Switch Modal */}
      <UserSwitchModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
      />
    </>
  );
};
