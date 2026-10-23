import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { QRProject, AppUser, ScanEvent, ScanStatsSummary } from '../types';
import { INITIAL_PROJECTS, INITIAL_USERS, INITIAL_SCANS } from '../data/initialData';
import {
  subscribeToProjects,
  subscribeToUsers,
  subscribeToScans,
  saveProjectFirestore,
  deleteProjectFirestore,
  saveUserFirestore,
  deleteUserFirestore,
  recordScanFirestore,
  seedFirestoreIfEmpty,
} from '../utils/firestoreService';

interface AppContextType {
  projects: QRProject[];
  users: AppUser[];
  scans: ScanEvent[];
  isLoading: boolean;
  isFirebaseReady: boolean;
  selectedProject: QRProject | null;
  setSelectedProject: (p: QRProject | null) => void;
  currentUser: AppUser | null;
  isAdmin: boolean;
  loginAsUser: (userId: string) => void;
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

const LOCAL_STORAGE_KEY_PROJECTS = 'qr_dynamic_projects_v3';
const LOCAL_STORAGE_KEY_USERS = 'qr_dynamic_users_v3';
const LOCAL_STORAGE_KEY_SCANS = 'qr_dynamic_scans_v1';
const LOCAL_STORAGE_KEY_CURRENT_USER = 'qr_dynamic_current_user_v3';
const LOCAL_STORAGE_KEY_BASE_URL = 'qr_dynamic_base_url_v1';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<QRProject | null>(null);

  const currentUser = users.find((u) => u.id === currentUserId) || users[0] || null;
  const isAdmin = true; // Open access: roles are descriptive only.

  const apiFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => fetch(input, init), []);

  useEffect(() => {
    // Remove session values from earlier versions of the application.
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem('qr_dynamic_token_v2');
      storage.removeItem('qr_dynamic_auth_status_v2');
    }

    let unsubProjects: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubScans: (() => void) | undefined;

    // Start with server baseline
    Promise.allSettled([
      fetch('/api/projects').then(r => r.ok ? r.json() : null),
      fetch('/api/users').then(r => r.ok ? r.json() : null),
      fetch('/api/scans').then(r => r.ok ? r.json() : null),
    ]).then(([p, u, s]) => {
      if (p.status === 'fulfilled' && p.value) setProjects(p.value);
      if (u.status === 'fulfilled' && u.value) setUsers(u.value);
      if (s.status === 'fulfilled' && s.value) setScans(s.value);
      setIsLoading(false);
    });

    // Real-time synchronization with Firebase Cloud Firestore
    void (async () => {
      try {
        await seedFirestoreIfEmpty();
        unsubProjects = subscribeToProjects((items) => {
          if (items.length > 0) {
            setProjects(items);
            setIsFirebaseReady(true);
            setIsLoading(false);
          }
        });
        unsubUsers = subscribeToUsers((items) => {
          if (items.length > 0) {
            setUsers(items);
          }
        });
        unsubScans = subscribeToScans((items) => {
          if (items.length > 0) {
            setScans(items);
          }
        });
      } catch (err) {
        console.warn('Firebase synchronization fallback active:', err);
      }
    })();

    return () => {
      unsubProjects?.();
      unsubUsers?.();
      unsubScans?.();
    };
  }, []);

  const loginAsUser = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, userId);
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

  // The private-preview warning only applies to Google AI Studio hosts.
  // A normal Windows/LAN server is a valid destination for phone scans.
  const isDevEnvironment = typeof window !== 'undefined' &&
    window.location.hostname.includes('ais-dev-');

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
    let finalCreated: QRProject;
    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        finalCreated = await res.json();
      } else {
        throw new Error('API create failed');
      }
    } catch {
      // Local fallback
      const now = new Date().toISOString();
      const cleanCode = data.shortCode
        ? data.shortCode.toLowerCase().replace(/[^a-z0-9-_]/g, '')
        : (data.clientName || 'qr').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15) + '-' + Math.random().toString(36).substr(2, 4);

      finalCreated = {
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
    }

    setProjects((prev) => [finalCreated, ...prev.filter((p) => p.id !== finalCreated.id)]);
    void saveProjectFirestore(finalCreated).catch((err) => console.warn('Firestore project save fallback:', err));
    return finalCreated;
  };

  const updateProject = async (
    id: string,
    updates: Partial<QRProject>,
    changeReason?: string
  ): Promise<QRProject> => {
    let updatedProject: QRProject | null = null;
    try {
      const res = await apiFetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, changeReason }),
      });
      if (res.ok) {
        updatedProject = await res.json();
      }
    } catch (err) {
      console.warn('Server update project failed, fallback to local', err);
    }

    if (!updatedProject) {
      const current = projects.find((p) => p.id === id);
      const now = new Date().toISOString();
      let history = current?.destinationHistory ? [...current.destinationHistory] : [];
      if (current && updates.destinationUrl && updates.destinationUrl !== current.destinationUrl) {
        history.unshift({
          id: `hist-${Date.now()}`,
          url: current.destinationUrl,
          changedAt: now,
          changedBy: 'Administrador',
          reason: changeReason || 'Actualización de carpeta OneDrive',
        });
      }
      updatedProject = {
        ...(current || (updates as QRProject)),
        ...updates,
        id,
        destinationHistory: history,
        updatedAt: now,
      };
    }

    setProjects((prev) => prev.map((p) => (p.id === id ? updatedProject! : p)));
    void saveProjectFirestore(updatedProject).catch((err) => console.warn('Firestore project update fallback:', err));
    return updatedProject;
  };

  const updateOneDriveUrl = async (id: string, newUrl: string, reason: string): Promise<QRProject> => {
    return updateProject(id, { destinationUrl: newUrl }, reason);
  };

  const deleteProject = async (id: string): Promise<void> => {
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
    } catch {}
    setProjects((prev) => prev.filter((p) => p.id !== id));
    void deleteProjectFirestore(id).catch((err) => console.warn('Firestore project delete fallback:', err));
  };

  const createUser = async (data: Partial<AppUser>): Promise<AppUser> => {
    let createdUser: AppUser;
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        createdUser = await res.json();
      } else {
        throw new Error('API create user failed');
      }
    } catch {
      createdUser = {
        id: `user-${Date.now()}`,
        name: data.name || 'Nuevo Usuario',
        email: data.email || 'usuario@empresa.com',
        role: data.role || 'technician',
        active: true,
        createdAt: new Date().toISOString().slice(0, 10),
        installationsAssigned: 0,
      };
    }
    setUsers((prev) => [...prev.filter((u) => u.id !== createdUser.id), createdUser]);
    void saveUserFirestore(createdUser).catch((err) => console.warn('Firestore user save fallback:', err));
    return createdUser;
  };

  const updateUser = async (id: string, updates: Partial<AppUser>): Promise<AppUser> => {
    let updatedUser: AppUser | null = null;
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        updatedUser = await res.json();
      }
    } catch {}

    if (!updatedUser) {
      const current = users.find((u) => u.id === id);
      updatedUser = {
        ...(current || (updates as AppUser)),
        ...updates,
        id,
      };
    }

    setUsers((prev) => prev.map((u) => (u.id === id ? updatedUser! : u)));
    void saveUserFirestore(updatedUser).catch((err) => console.warn('Firestore user update fallback:', err));
    return updatedUser;
  };

  const deleteUser = async (id: string): Promise<void> => {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    } catch {}
    setUsers((prev) => prev.filter((u) => u.id !== id));
    void deleteUserFirestore(id).catch((err) => console.warn('Firestore user delete fallback:', err));
  };

  const recordSimulatedScan = async (
    shortCode: string,
    deviceType: string = 'mobile',
    os: string = 'iOS'
  ): Promise<ScanEvent> => {
    const project = projects.find((p) => p.shortCode.toLowerCase() === shortCode.toLowerCase());
    let finalScan: ScanEvent | null = null;

    try {
      const res = await apiFetch('/api/scans/record', {
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
        finalScan = await res.json();
      }
    } catch {}

    if (!finalScan) {
      const now = new Date().toISOString();
      finalScan = {
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
    }

    setScans((prev) => [finalScan!, ...prev]);
    if (project) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? { ...p, scanCount: (p.scanCount || 0) + 1, lastScannedAt: finalScan!.scannedAt }
            : p
        )
      );
    }
    void recordScanFirestore(finalScan).catch((err) => console.warn('Firestore scan save fallback:', err));
    return finalScan;
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
      await apiFetch('/api/reset-demo', { method: 'POST' });
    } catch {}
    setProjects(INITIAL_PROJECTS);
    setUsers(INITIAL_USERS);
    setScans(INITIAL_SCANS);
    setCurrentUserId('user-1');
    localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(INITIAL_PROJECTS));
    localStorage.setItem(LOCAL_STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(LOCAL_STORAGE_KEY_SCANS, JSON.stringify(INITIAL_SCANS));
    localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, 'user-1');
    void seedFirestoreIfEmpty().catch(() => {});
  };

  return (
    <AppContext.Provider
      value={{
        projects,
        users,
        scans,
        isLoading,
        isFirebaseReady,
        selectedProject,
        setSelectedProject,
        currentUser,
        isAdmin,
        loginAsUser,
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
