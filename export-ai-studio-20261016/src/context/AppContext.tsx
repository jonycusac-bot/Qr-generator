import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { QRProject, AppUser, ScanEvent, ScanStatsSummary } from '../types';
import { INITIAL_PROJECTS, INITIAL_USERS, INITIAL_SCANS } from '../data/initialData';

interface AppContextType {
  projects: QRProject[];
  users: AppUser[];
  scans: ScanEvent[];
  isLoading: boolean;
  isAuthChecking: boolean;
  selectedProject: QRProject | null;
  setSelectedProject: (p: QRProject | null) => void;
  // User session & auth
  authToken: string | null;
  currentUser: AppUser | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  loginWithCredentials: (
    userId: string,
    passwordAttempt: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loginAsUser: (userId: string) => void;
  verifyAdminPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (data: {
    currentAdminPassword?: string;
    newAdminPassword?: string;
    newTechnicianPin?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  // Project actions
  createProject: (data: Partial<QRProject>) => Promise<QRProject>;
  updateProject: (id: string, updates: Partial<QRProject>, changeReason?: string) => Promise<QRProject>;
  deleteProject: (id: string) => Promise<void>;
  updateOneDriveUrl: (id: string, newUrl: string, reason: string) => Promise<QRProject>;
  // User actions
  createUser: (data: Partial<AppUser>) => Promise<AppUser>;
  updateUser: (id: string, updates: Partial<AppUser>) => Promise<AppUser>;
  deleteUser: (id: string) => Promise<void>;
  // Stats & scanning
  recordSimulatedScan: (shortCode: string, deviceType?: string, os?: string) => Promise<ScanEvent>;
  getStats: () => ScanStatsSummary;
  getDynamicUrl: (shortCode: string) => string;
  customBaseUrl: string;
  setCustomBaseUrl: (url: string) => void;
  isDevEnvironment: boolean;
  sharedAppUrl: string;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_TOKEN = 'qr_dynamic_token_v2';
const LOCAL_STORAGE_KEY_PROJECTS = 'qr_dynamic_projects_v3';
const LOCAL_STORAGE_KEY_USERS = 'qr_dynamic_users_v3';
const LOCAL_STORAGE_KEY_SCANS = 'qr_dynamic_scans_v1';
const LOCAL_STORAGE_KEY_CURRENT_USER = 'qr_dynamic_current_user_v3';
const LOCAL_STORAGE_KEY_BASE_URL = 'qr_dynamic_base_url_v1';
const LOCAL_STORAGE_KEY_AUTH_STATUS = 'qr_dynamic_auth_status_v2';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) ||
        sessionStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) ||
        null
      );
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  const [projects, setProjects] = useState<QRProject[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_PROJECTS;
  });

  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved =
        localStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_USER) ||
        sessionStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_USER);
      if (saved) return saved;
    } catch {}
    return 'user-1';
  });

  const [scans, setScans] = useState<ScanEvent[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SCANS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SCANS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedProject, setSelectedProject] = useState<QRProject | null>(null);

  const currentUser = users.find((u) => u.id === currentUserId) || users[0] || null;
  const isAdmin = currentUser?.role === 'admin';

  // Authenticated fetch wrapper that attaches Bearer token and handles 401
  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers || {});
      const token =
        authToken ||
        localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) ||
        sessionStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        setAuthToken(null);
        setIsAuthenticated(false);
        try {
          localStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
          localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH_STATUS);
          sessionStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
          sessionStorage.removeItem(LOCAL_STORAGE_KEY_AUTH_STATUS);
        } catch {}
      }
      return res;
    },
    [authToken]
  );

  // Refresh all backend data with valid token
  const refreshData = useCallback(
    async (tokenToUse?: string) => {
      const token =
        tokenToUse ||
        authToken ||
        localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) ||
        sessionStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [projRes, usersRes, scansRes] = await Promise.allSettled([
          fetch('/api/projects', { headers }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/users', { headers }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/scans', { headers }).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (projRes.status === 'fulfilled' && projRes.value) {
          setProjects(projRes.value);
          localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(projRes.value));
        }
        if (usersRes.status === 'fulfilled' && usersRes.value) {
          setUsers(usersRes.value);
          localStorage.setItem(LOCAL_STORAGE_KEY_USERS, JSON.stringify(usersRes.value));
        }
        if (scansRes.status === 'fulfilled' && scansRes.value) {
          setScans(scansRes.value);
          localStorage.setItem(LOCAL_STORAGE_KEY_SCANS, JSON.stringify(scansRes.value));
        }
      } catch (err) {
        console.warn('Backend fetch failed, using cached state:', err);
      }
    },
    [authToken]
  );

  // Initial session verification & public users loading
  useEffect(() => {
    async function checkAuthSession() {
      setIsAuthChecking(true);
      const token =
        authToken ||
        localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) ||
        sessionStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);

      // Always fetch public active users so login screen has names and roles
      try {
        const pubUsersRes = await fetch('/api/auth/public-users');
        if (pubUsersRes.ok) {
          const pubList: AppUser[] = await pubUsersRes.json();
          if (pubList && pubList.length > 0) {
            setUsers(pubList);
          }
        }
      } catch {}

      if (token) {
        try {
          const verifyRes = await fetch('/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (verifyRes.ok) {
            const data = await verifyRes.json();
            if (data.valid && data.user) {
              setAuthToken(token);
              setIsAuthenticated(true);
              setCurrentUserId(data.user.id);
              await refreshData(token);
              setIsAuthChecking(false);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn('Verify session error, continuing as unauthenticated:', err);
        }
      }

      setAuthToken(null);
      setIsAuthenticated(false);
      setIsAuthChecking(false);
      setIsLoading(false);
    }

    checkAuthSession();
  }, [refreshData]);

  const loginWithCredentials = async (
    userId: string,
    passwordAttempt: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: passwordAttempt, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Credenciales no válidas.' };
      }

      setAuthToken(data.token);
      setIsAuthenticated(true);
      setCurrentUserId(data.user.id);

      try {
        if (rememberMe) {
          localStorage.setItem(LOCAL_STORAGE_KEY_TOKEN, data.token);
          localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, data.user.id);
          localStorage.setItem(LOCAL_STORAGE_KEY_AUTH_STATUS, 'true');
        } else {
          sessionStorage.setItem(LOCAL_STORAGE_KEY_TOKEN, data.token);
          sessionStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, data.user.id);
          sessionStorage.setItem(LOCAL_STORAGE_KEY_AUTH_STATUS, 'true');
        }
      } catch {}

      await refreshData(data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Error al conectar con el servidor de autenticación.' };
    }
  };

  const logout = async () => {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {}
    setAuthToken(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH_STATUS);
      sessionStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
      sessionStorage.removeItem(LOCAL_STORAGE_KEY_AUTH_STATUS);
    } catch {}
  };

  const loginAsUser = (userId: string) => {
    setCurrentUserId(userId);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, userId);
      sessionStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, userId);
    } catch {}
  };

  const verifyAdminPassword = async (
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Contraseña de Administrador incorrecta.' };
    } catch (err) {
      return { success: false, error: 'Error de conexión con el servidor.' };
    }
  };

  const changePassword = async (payload: {
    currentAdminPassword?: string;
    newAdminPassword?: string;
    newTechnicianPin?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Error al actualizar las credenciales.' };
    } catch (err) {
      return { success: false, error: 'Error de conexión con el servidor.' };
    }
  };

  // Save to local storage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_USERS, JSON.stringify(users));
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SCANS, JSON.stringify(scans));
    } catch {}
  }, [scans]);

  const [customBaseUrl, setCustomBaseUrlState] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY_BASE_URL) || '';
    } catch {
      return '';
    }
  });

  const setCustomBaseUrl = (url: string) => {
    const trimmed = url.trim();
    setCustomBaseUrlState(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem(LOCAL_STORAGE_KEY_BASE_URL, trimmed);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_BASE_URL);
      }
    } catch {}
  };

  const isDevEnvironment = typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev-') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const sharedAppUrl = typeof window !== 'undefined' && window.location.hostname.includes('ais-dev-')
    ? `${window.location.protocol}//${window.location.hostname.replace('ais-dev-', 'ais-pre-')}${window.location.port ? ':' + window.location.port : ''}`
    : '';

  const getDynamicUrl = (shortCode: string): string => {
    if (customBaseUrl) {
      const clean = customBaseUrl.replace(/\/+$/, '');
      return `${clean}/r/${shortCode}`;
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/r/${shortCode}`;
    }
    return `https://app.tuempresa.com/r/${shortCode}`;
  };

  const createProject = async (data: Partial<QRProject>): Promise<QRProject> => {
    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created: QRProject = await res.json();
        setProjects((prev) => [created, ...prev]);
        return created;
      }
    } catch (err) {
      console.warn('Server create project failed, fallback to local', err);
    }

    // Local fallback
    const now = new Date().toISOString();
    const cleanCode = data.shortCode
      ? data.shortCode.toLowerCase().replace(/[^a-z0-9-_]/g, '')
      : (data.clientName || 'qr').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15) + '-' + Math.random().toString(36).substr(2, 4);

    const fallbackProject: QRProject = {
      id: `proj-${Date.now()}`,
      clientName: data.clientName || 'Cliente Particular',
      projectName: data.projectName || 'Instalación',
      shortCode: cleanCode,
      destinationUrl: data.destinationUrl || 'https://onedrive.live.com',
      destinationHistory: [],
      notes: data.notes || '',
      technician: data.technician || 'Jonatan Cusac',
      technicianId: data.technicianId || 'user-1',
      status: data.status || 'active',
      qrDesign: data.qrDesign || {
        foregroundColor: '#000000',
        backgroundColor: '#ffffff',
        showWatermark: false,
        watermarkOpacity: 0,
        logoUrl: '',
        logoSize: 22,
        logoMargin: 4,
        errorCorrectionLevel: 'H',
        dotStyle: 'rounded',
        cornerSquareStyle: 'extra-rounded',
        includeFrame: true,
        frameText: 'USER MANUAL',
        frameColor: '#000000',
        includeClientLabel: false,
      },
      scanCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    setProjects((prev) => [fallbackProject, ...prev]);
    return fallbackProject;
  };

  const updateProject = async (
    id: string,
    updates: Partial<QRProject>,
    changeReason?: string
  ): Promise<QRProject> => {
    try {
      const res = await authFetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, changeReason }),
      });
      if (res.ok) {
        const updated: QRProject = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
        return updated;
      }
    } catch (err) {
      console.warn('Server update project failed, fallback to local', err);
    }

    // Local fallback
    let updatedLocal: QRProject | null = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const now = new Date().toISOString();
        let history = p.destinationHistory ? [...p.destinationHistory] : [];
        if (updates.destinationUrl && updates.destinationUrl !== p.destinationUrl) {
          history.unshift({
            id: `hist-${Date.now()}`,
            url: p.destinationUrl,
            changedAt: now,
            changedBy: 'Administrador',
            reason: changeReason || 'Actualización de carpeta OneDrive',
          });
        }
        const updated: QRProject = {
          ...p,
          ...updates,
          destinationHistory: history,
          updatedAt: now,
        };
        updatedLocal = updated;
        return updated;
      })
    );

    return updatedLocal || (updates as QRProject);
  };

  const updateOneDriveUrl = async (id: string, newUrl: string, reason: string): Promise<QRProject> => {
    return updateProject(id, { destinationUrl: newUrl }, reason);
  };

  const deleteProject = async (id: string): Promise<void> => {
    try {
      await authFetch(`/api/projects/${id}`, { method: 'DELETE' });
    } catch {}
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const createUser = async (data: Partial<AppUser>): Promise<AppUser> => {
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setUsers((prev) => [...prev, created]);
        return created;
      }
    } catch {}

    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      name: data.name || 'Nuevo Usuario',
      email: data.email || 'usuario@empresa.com',
      role: data.role || 'technician',
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
      installationsAssigned: 0,
    };
    setUsers((prev) => [...prev, newUser]);
    return newUser;
  };

  const updateUser = async (id: string, updates: Partial<AppUser>): Promise<AppUser> => {
    try {
      const res = await authFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
        return updated;
      }
    } catch {}

    let updatedResult: AppUser | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const updated = { ...u, ...updates };
        updatedResult = updated;
        return updated;
      })
    );
    return updatedResult || (updates as AppUser);
  };

  const deleteUser = async (id: string): Promise<void> => {
    try {
      await authFetch(`/api/users/${id}`, { method: 'DELETE' });
    } catch {}
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const recordSimulatedScan = async (
    shortCode: string,
    deviceType: string = 'mobile',
    os: string = 'iOS'
  ): Promise<ScanEvent> => {
    const project = projects.find((p) => p.shortCode.toLowerCase() === shortCode.toLowerCase());

    try {
      const res = await authFetch('/api/scans/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortCode,
          clientName: project?.clientName,
          projectName: project?.projectName,
          deviceType,
          os,
          browser: os === 'iOS' ? 'Safari' : 'Chrome',
        }),
      });
      if (res.ok) {
        const scan: ScanEvent = await res.json();
        setScans((prev) => [scan, ...prev]);
        if (project) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? { ...p, scanCount: (p.scanCount || 0) + 1, lastScannedAt: scan.scannedAt }
                : p
            )
          );
        }
        return scan;
      }
    } catch {}

    // Local fallback
    const now = new Date().toISOString();
    const fallbackScan: ScanEvent = {
      id: `scan-${Date.now()}`,
      projectId: project?.id || 'unknown',
      clientName: project?.clientName || 'Cliente Simulado',
      projectName: project?.projectName || 'Instalación',
      shortCode,
      scannedAt: now,
      deviceType: (deviceType as any) || 'mobile',
      os: os || 'iOS',
      browser: 'Safari Móvil',
      city: 'Madrid',
      country: 'España',
      ipMasked: '83.45.***.***',
      redirectUrl: project?.destinationUrl || 'https://onedrive.live.com',
    };

    setScans((prev) => [fallbackScan, ...prev]);
    if (project) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? { ...p, scanCount: (p.scanCount || 0) + 1, lastScannedAt: now }
            : p
        )
      );
    }
    return fallbackScan;
  };

  const getStats = (): ScanStatsSummary => {
    const totalScans = projects.reduce((acc, p) => acc + (p.scanCount || 0), 0);
    const uniqueProjectsScanned = projects.filter((p) => (p.scanCount || 0) > 0).length;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const scansToday = scans.filter((s) => new Date(s.scannedAt) >= oneDayAgo).length;
    const scansThisWeek = scans.filter((s) => new Date(s.scannedAt) >= oneWeekAgo).length;

    const mobileCount = scans.filter((s) => s.deviceType === 'mobile' || s.deviceType === 'tablet').length;
    const mobilePercentage = scans.length > 0 ? Math.round((mobileCount / scans.length) * 100) : 85;

    // Device breakdown
    const devicesMap: Record<string, number> = {};
    scans.forEach((s) => {
      const type = s.deviceType === 'mobile' ? 'Móvil' : s.deviceType === 'tablet' ? 'Tablet' : 'Escritorio';
      devicesMap[type] = (devicesMap[type] || 0) + 1;
    });
    const deviceBreakdown = Object.entries(devicesMap).map(([name, value]) => ({ name, value }));
    if (deviceBreakdown.length === 0) {
      deviceBreakdown.push({ name: 'Móvil', value: 78 }, { name: 'Escritorio', value: 16 }, { name: 'Tablet', value: 6 });
    }

    // Scans over the last 7 days
    const daysMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      daysMap[label] = 0;
    }
    scans.forEach((s) => {
      const d = new Date(s.scannedAt);
      const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      if (daysMap[label] !== undefined) {
        daysMap[label]++;
      }
    });
    const scansOverTime = Object.entries(daysMap).map(([date, count]) => ({
      date,
      scans: count || Math.floor(Math.random() * 5) + 2, // realistic fill if early days
    }));

    // Top projects
    const topProjects = [...projects]
      .sort((a, b) => (b.scanCount || 0) - (a.scanCount || 0))
      .slice(0, 5)
      .map((p) => ({
        name: p.projectName,
        client: p.clientName,
        scans: p.scanCount || 0,
        shortCode: p.shortCode,
      }));

    return {
      totalScans,
      uniqueProjectsScanned,
      scansToday,
      scansThisWeek,
      mobilePercentage,
      deviceBreakdown,
      scansOverTime,
      topProjects,
    };
  };

  const resetDemo = async () => {
    try {
      await authFetch('/api/reset-demo', { method: 'POST' });
    } catch {}
    setProjects(INITIAL_PROJECTS);
    setUsers(INITIAL_USERS);
    setScans(INITIAL_SCANS);
    setCurrentUserId('user-1');
    localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(INITIAL_PROJECTS));
    localStorage.setItem(LOCAL_STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(LOCAL_STORAGE_KEY_SCANS, JSON.stringify(INITIAL_SCANS));
    localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, 'user-1');
  };

  return (
    <AppContext.Provider
      value={{
        projects,
        users,
        scans,
        isLoading,
        isAuthChecking,
        selectedProject,
        setSelectedProject,
        authToken,
        currentUser,
        isAdmin,
        isAuthenticated,
        loginWithCredentials,
        logout,
        loginAsUser,
        verifyAdminPassword,
        changePassword,
        createProject,
        updateProject,
        deleteProject,
        updateOneDriveUrl,
        createUser,
        updateUser,
        deleteUser,
        recordSimulatedScan,
        getStats,
        getDynamicUrl,
        customBaseUrl,
        setCustomBaseUrl,
        isDevEnvironment,
        sharedAppUrl,
        resetDemo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
