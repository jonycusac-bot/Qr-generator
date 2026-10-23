import React, { useState } from 'react';
import { Shield, Wrench, Check, X, Users, Sparkles, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppUser } from '../types';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({ isOpen, onClose }) => {
  const { users, currentUser, loginAsUser, verifyAdminPassword } = useApp();
  const [targetAdminUser, setTargetAdminUser] = useState<AppUser | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSelectUser = (user: AppUser) => {
    if (user.role === 'admin') {
      if (currentUser?.id === user.id) {
        onClose();
        return;
      }
      if (currentUser?.role === 'admin') {
        loginAsUser(user.id);
        onClose();
        return;
      }
      setTargetAdminUser(user);
      setPasswordInput('');
      setErrorMsg('');
      return;
    }

    loginAsUser(user.id);
    onClose();
  };

  const handleConfirmAdminSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAdminUser) return;
    setErrorMsg('');
    setIsVerifying(true);

    try {
      const res = await verifyAdminPassword(passwordInput);
      if (res.success) {
        loginAsUser(targetAdminUser.id);
        setTargetAdminUser(null);
        onClose();
      } else {
        setErrorMsg(res.error || 'Contraseña de Administrador incorrecta.');
      }
    } catch {
      setErrorMsg('Error al verificar la contraseña.');
    } finally {
      setIsVerifying(false);
    }
  };

  const adminUsers = users.filter((u) => u.role === 'admin');
  const techUsers = users.filter((u) => u.role === 'technician');
  const otherUsers = users.filter((u) => u.role !== 'admin' && u.role !== 'technician');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white tracking-tight">
                  Identificación de Usuario / Acceso
                </h3>
                <p className="text-xs text-slate-300">
                  Selecciona tu perfil para trabajar en la plataforma
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {targetAdminUser ? (
          <form onSubmit={handleConfirmAdminSwitch} className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3.5 bg-sky-50 rounded-2xl border border-sky-200">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                {targetAdminUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    Elevación a Administrador
                  </span>
                  <span className="text-[9px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.2 rounded">
                    ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {targetAdminUser.name} ({targetAdminUser.email})
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="switch-admin-pass"
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-sky-600" />
                <span>Introduce la Contraseña de Administrador</span>
              </label>
              <input
                id="switch-admin-pass"
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Clave maestra de administrador..."
                autoFocus
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
              />
              {errorMsg && (
                <div className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTargetAdminUser(null);
                  setErrorMsg('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isVerifying || !passwordInput.trim()}
                className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isVerifying ? 'Verificando...' : 'Confirmar Acceso Admin'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Admin section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-sky-700 tracking-wider uppercase flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-600" />
                Administrador del Sistema
              </span>
              <span className="text-[11px] text-slate-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full font-semibold">
                Control Total
              </span>
            </div>

            <div className="space-y-2">
              {adminUsers.map((user) => {
                const isSelected = currentUser?.id === user.id;

                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50/90 border-sky-500 shadow-sm ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                          <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                            Administrador
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-sky-600 hover:underline">
                        Entrar como Admin
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technicians section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-emerald-700 tracking-wider uppercase flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                Técnicos Instaladores
              </span>
              <span className="text-[11px] text-slate-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                Instalaciones y QR
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {techUsers.map((user) => {
                const isSelected = currentUser?.id === user.id;

                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {otherUsers.length > 0 && (
            <div>
              <div className="mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Otros Perfiles
                </span>
              </div>
              <div className="space-y-2">
                {otherUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-slate-800">{user.name}</span>
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Explanation */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>¿Cómo se diferencia cada acceso?</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              • <strong>Jonatan Cusac (Admin)</strong>: Gestiona todo el equipo, asigna viviendas, restaura el sistema y tiene control total.
            </p>
            <p className="text-[11px] leading-relaxed">
              • <strong>Técnicos (Compañeros)</strong>: Pueden registrar sus viviendas, generar las pegatinas QR y vincular sus carpetas de OneDrive directamente sin riesgo de borrar instalaciones de otros.
            </p>
          </div>
        </div>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">
            Sesión activa: <strong className="text-slate-800">{currentUser?.name}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
