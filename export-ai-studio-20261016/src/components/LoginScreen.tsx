import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, CheckCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const { users, loginWithCredentials } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string>('user-1'); // Default to Jonatan Cusac (Admin)
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];
  const isAdminSelected = selectedUser?.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const result = await loginWithCredentials(selectedUserId, password, rememberMe);
      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(result.error || 'Contraseña incorrecta. Inténtalo de nuevo.');
      }
    } catch (err) {
      setErrorMsg('Error al conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-sky-500 selection:text-white relative overflow-hidden">
      {/* Background Subtle Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black text-xl shadow-lg shadow-sky-600/20 mb-3 tracking-wider">
            QR
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Illusion • Acceso Seguro
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestión de Cuadros Eléctricos, Domótica y Documentación QR
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* User selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Identifícate como
            </label>
            <div className="grid grid-cols-1 gap-2">
              {users.map((u) => {
                const isSelected = u.id === selectedUserId;
                const isAdmin = u.role === 'admin';

                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => {
                      setSelectedUserId(u.id);
                      setErrorMsg('');
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? isAdmin
                          ? 'bg-sky-950/70 border-sky-500 shadow-md ring-1 ring-sky-500/40 text-white'
                          : 'bg-emerald-950/60 border-emerald-500 shadow-md ring-1 ring-emerald-500/40 text-white'
                        : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          isAdmin
                            ? 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-xs text-white truncate">{u.name}</p>
                          {isAdmin && (
                            <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded font-bold">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isAdmin ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3 stroke-[2.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password-input"
                className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                <span>Contraseña</span>
              </label>
              {isAdminSelected ? (
                <span className="text-[11px] text-sky-400 font-medium">Clave Maestra Requerida</span>
              ) : (
                <span className="text-[11px] text-emerald-400 font-medium">Acceso Técnico</span>
              )}
            </div>

            <div className="relative">
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={
                  isAdminSelected
                    ? 'Clave de Administrador (ej: Illusion2026!)'
                    : 'PIN de Técnico (ej: 1234)'
                }
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember session checkbox */}
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-sky-500 accent-sky-500"
                />
                <span>Recordar sesión en este equipo</span>
              </label>

              <span className="text-[11px] text-slate-500">
                {isAdminSelected ? 'Control total' : 'PIN por defecto: 1234'}
              </span>
            </div>

            {errorMsg && (
              <div className="mt-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isAdminSelected
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-sky-600/20'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
            }`}
          >
            <span>{isSubmitting ? 'Verificando credenciales...' : 'Entrar a la Plataforma'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Sesión protegida por token local</span>
          </div>
          <span className="text-slate-500 font-mono">v3.0 • Illusion S.A.T</span>
        </div>
      </div>
    </div>
  );
};
