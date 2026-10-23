import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppDatabase } from './database.js';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PROJECTS, INITIAL_USERS, INITIAL_SCANS } from './src/data/initialData.js';
import { QRProject, AppUser, ScanEvent } from './src/types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const database = new AppDatabase(path.join(DATA_DIR, 'app.sqlite'));

// Ensure data folder
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface AuthConfig {
  adminPasswordHash: string;
  adminPasswordSalt: string;
  technicianPinHash: string;
  technicianPinSalt: string;
}

export interface UserSession {
  token: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory state initialized from file or initial data
let projects: QRProject[] = [];
let users: AppUser[] = [];
let scans: ScanEvent[] = [];
let authConfig: AuthConfig;

const sessions = new Map<string, UserSession>();
const failedLoginAttempts = new Map<string, { count: number; blockedUntil: number }>();

function hashSecret(secret: string, salt?: string) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(secret, s, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

function verifySecret(secret: string, hash: string, salt: string) {
  const testHash = crypto.pbkdf2Sync(secret, salt, 1000, 64, 'sha512').toString('hex');
  return testHash === hash;
}

function loadData() {
  const stored = database.load();
  // Import once. Invalid legacy data stops startup rather than losing records.
  const data = stored || (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : null);
  projects = data?.projects ?? structuredClone(INITIAL_PROJECTS);
  users = data?.users ?? structuredClone(INITIAL_USERS);
  scans = data?.scans ?? structuredClone(INITIAL_SCANS);
  if (data?.auth?.adminPasswordHash) authConfig = data.auth;
  else {
    const admin = hashSecret('Illusion2026!');
    const tech = hashSecret('1234');
    authConfig = {
      adminPasswordHash: admin.hash, adminPasswordSalt: admin.salt,
      technicianPinHash: tech.hash, technicianPinSalt: tech.salt,
    };
  }
  if (!stored) saveData();
  for (const session of database.getSessions()) {
    if (session.expiresAt > Date.now()) sessions.set(session.token, session);
    else database.deleteSession(session.token);
  }
  console.log('[DB] SQLite loaded:', projects.length, 'projects,', users.length, 'users,', scans.length, 'scans');
}
function saveData() {
  database.save({ projects, users, scans, auth: authConfig });
}

loadData();

function detectDevice(userAgent: string): {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os: string;
  browser: string;
} {
  const ua = userAgent.toLowerCase();
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'desktop';
  let os = 'Desconocido';
  let browser = 'Navegador';

  // Device type
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/iphone|ipod|mobile|android|blackberry|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // OS
  if (ua.includes('iphone') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('ipad')) os = 'iPadOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser
  if (ua.includes('chrome') && !ua.includes('edg') && !ua.includes('opr')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('samsungbrowser')) browser = 'Samsung Internet';

  return { deviceType, os, browser };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Dynamic QR redirection route: /r/:shortCode
  app.get('/r/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    const project = projects.find(
      (p) => p.shortCode.toLowerCase() === shortCode.toLowerCase()
    );

    if (!project) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Código QR No Encontrado</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-slate-800 font-sans">
          <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center">
            <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">!</div>
            <h1 class="text-xl font-bold text-slate-900 mb-2">Instalación No Encontrada</h1>
            <p class="text-slate-600 mb-6 text-sm">El código QR escaneado (<strong>${shortCode}</strong>) no se encuentra registrado en el sistema o ha sido archivado.</p>
            <a href="/" class="inline-block px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl transition">Volver al Panel</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (project.status === 'paused') {
      res.status(403).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Instalación en Mantenimiento</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-slate-800 font-sans">
          <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center">
            <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⏳</div>
            <h1 class="text-xl font-bold text-slate-900 mb-2">Acceso Temporalmente Pausado</h1>
            <p class="text-slate-600 mb-4 text-sm">La documentación para la instalación <strong>${project.projectName}</strong> (${project.clientName}) está en actualización técnica.</p>
            <p class="text-xs text-slate-500">Por favor, inténtelo de nuevo en unos minutos o contacte a su instalador.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Register scan analytics
    const ua = req.headers['user-agent'] || '';
    const { deviceType, os, browser } = detectDevice(ua);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ipMasked = typeof ip === 'string' ? ip.split(',')[0].replace(/\.\d+$/, '.***') : '127.0.0.***';

    const scanRecord: ScanEvent = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      projectId: project.id,
      clientName: project.clientName,
      projectName: project.projectName,
      shortCode: project.shortCode,
      scannedAt: new Date().toISOString(),
      deviceType,
      os,
      browser,
      city: 'España',
      country: 'España',
      ipMasked,
      redirectUrl: project.destinationUrl,
    };

    project.scanCount = (project.scanCount || 0) + 1;
    project.lastScannedAt = scanRecord.scannedAt;
    scans.unshift(scanRecord);
    if (scans.length > 500) scans.pop();
    saveData();

    // Direct 302 or branded interstitial redirect with instant auto-jump
    const isDirect = req.query.direct === 'true';
    if (isDirect) {
      res.redirect(302, project.destinationUrl);
      return;
    }

    // Branded redirect landing page that guarantees redirect even in restrictive camera webviews
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="1;url=${project.destinationUrl}">
        <title>Conectando con OneDrive - ${project.projectName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin-fast { animation: spin 0.8s linear infinite; }
        </style>
      </head>
      <body class="bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center min-h-screen p-6 font-sans">
        <div class="max-w-md w-full bg-slate-800/90 backdrop-blur border border-slate-700 p-8 rounded-3xl shadow-2xl text-center">
          
          <div class="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <div class="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-400 animate-spin-fast"></div>
            <!-- OneDrive Cloud Icon -->
            <svg class="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            </svg>
          </div>

          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Enlace Dinámico Activo
          </span>

          <h1 class="text-xl font-bold tracking-tight text-white mb-1">${project.clientName}</h1>
          <p class="text-sm text-slate-400 mb-6">${project.projectName}</p>

          <p class="text-xs text-slate-300 bg-slate-900/60 py-2.5 px-4 rounded-xl border border-slate-700/60 mb-6">
            Redirigiendo automáticamente a la carpeta de documentación en OneDrive...
          </p>

          <a href="${project.destinationUrl}" id="directBtn" class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-2xl text-sm transition shadow-lg shadow-blue-600/30">
            <span>Abrir Documentación en OneDrive</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </a>
          
          <p class="mt-4 text-[11px] text-slate-400">Si no se abre automáticamente, pulsa el botón superior.</p>
        </div>

        <script>
          // Automatic redirect trigger
          setTimeout(function() {
            window.location.href = "${project.destinationUrl}";
          }, 800);
        </script>
      </body>
      </html>
    `);
  });

  // Helper to extract client IP
  function getClientIp(req: express.Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0].trim();
    return req.socket.remoteAddress || '127.0.0.1';
  }

  // Session verification helper
  function getAuthenticatedSession(req: express.Request): UserSession | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7).trim();
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      database.deleteSession(token);
      sessions.delete(token);
      return null;
    }
    return session;
  }

  // Middleware: require any authenticated user
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthenticatedSession(req);
    if (!session) {
      res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
      return;
    }
    (req as any).session = session;
    next();
  }

  // Middleware: require administrator role
  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const session = getAuthenticatedSession(req);
    if (!session) {
      res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
      return;
    }
    if (session.role !== 'admin') {
      res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador.' });
      return;
    }
    (req as any).session = session;
    next();
  }

  // -------------------------------------------------------------
  // AUTHENTICATION ENDPOINTS
  // -------------------------------------------------------------

  // Public list of active users (for login screen avatar/name selection)
  app.get('/api/auth/public-users', (req, res) => {
    const publicList = users
      .filter((u) => u.active)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));
    res.json(publicList);
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const ip = getClientIp(req);
    const attempt = failedLoginAttempts.get(ip);
    if (attempt && attempt.blockedUntil > Date.now()) {
      const remainingSec = Math.ceil((attempt.blockedUntil - Date.now()) / 1000);
      res.status(429).json({
        error: `Demasiados intentos erróneos. Bloqueado temporalmente durante ${remainingSec} segundos.`,
      });
      return;
    }

    const { userId, password, rememberMe } = req.body;
    const user = users.find((u) => u.id === userId);
    if (!user || !user.active) {
      res.status(404).json({ error: 'Usuario no encontrado o inactivo en el sistema.' });
      return;
    }

    let isValid = false;
    if (user.role === 'admin') {
      isValid = verifySecret(password || '', authConfig.adminPasswordHash, authConfig.adminPasswordSalt);
    } else {
      // Technicians validate against technician PIN, or Master Admin Password
      const matchPin = verifySecret(password || '', authConfig.technicianPinHash, authConfig.technicianPinSalt);
      const matchMaster = verifySecret(password || '', authConfig.adminPasswordHash, authConfig.adminPasswordSalt);
      isValid = matchPin || matchMaster;
    }

    if (!isValid) {
      const currentCount = (attempt?.count || 0) + 1;
      const blockedUntil = currentCount >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
      failedLoginAttempts.set(ip, { count: currentCount, blockedUntil });
      const errorMsg = user.role === 'admin'
        ? 'Contraseña de Administrador incorrecta.'
        : 'PIN de acceso de Técnico incorrecto (por defecto: 1234).';
      res.status(401).json({ error: errorMsg });
      return;
    }

    // Success: clear failed attempts and issue token
    failedLoginAttempts.delete(ip);
    const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
    const duration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const session: UserSession = {
      token,
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
    };
    database.setSession(token, session);
    sessions.set(token, session);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });

  // Verify active session token
  app.get('/api/auth/verify', (req, res) => {
    const session = getAuthenticatedSession(req);
    if (!session) {
      res.status(401).json({ valid: false, error: 'Sesión no válida o expirada' });
      return;
    }
    const user = users.find((u) => u.id === session.userId) || {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    };
    res.json({ valid: true, user });
  });

  // Verify admin password specifically (for switching accounts or sensitive operations)
  app.post('/api/auth/verify-admin', (req, res) => {
    const { password } = req.body;
    const isValid = verifySecret(password || '', authConfig.adminPasswordHash, authConfig.adminPasswordSalt);
    if (isValid) {
      res.json({ success: true, valid: true });
    } else {
      res.status(401).json({ success: false, valid: false, error: 'Contraseña de Administrador incorrecta.' });
    }
  });

  // Change password / PIN
  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const session = (req as any).session as UserSession;
    const { currentAdminPassword, newAdminPassword, newTechnicianPin } = req.body;

    if (session.role !== 'admin') {
      res.status(403).json({ error: 'Solo un Administrador puede cambiar las claves del sistema.' });
      return;
    }

    if (!verifySecret(currentAdminPassword || '', authConfig.adminPasswordHash, authConfig.adminPasswordSalt)) {
      res.status(400).json({ error: 'La contraseña actual de Administrador no es correcta.' });
      return;
    }

    // Modifying admin password
    if (newAdminPassword) {
      if (newAdminPassword.length < 6) {
        res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        return;
      }
      const updated = hashSecret(newAdminPassword);
      authConfig.adminPasswordHash = updated.hash;
      authConfig.adminPasswordSalt = updated.salt;
    }

    // Modifying technician PIN
    if (newTechnicianPin) {
      if (newTechnicianPin.length < 4) {
        res.status(400).json({ error: 'El PIN de técnico debe tener al menos 4 dígitos o caracteres.' });
        return;
      }
      const updated = hashSecret(newTechnicianPin);
      authConfig.technicianPinHash = updated.hash;
      authConfig.technicianPinSalt = updated.salt;
    }

    saveData();
    res.json({ success: true, message: 'Credenciales actualizadas correctamente con cifrado seguro.' });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      database.deleteSession(token);
      sessions.delete(token);
    }
    res.json({ success: true });
  });

  // -------------------------------------------------------------
  // PROTECTED REST API ENDPOINTS
  // -------------------------------------------------------------

  // Projects
  app.get('/api/projects', requireAuth, (req, res) => {
    res.json(projects);
  });

  app.post('/api/projects', requireAuth, (req, res) => {
    const data = req.body;
    const now = new Date().toISOString();
    
    // Auto-generate shortCode if not provided
    const baseCode = data.shortCode
      ? data.shortCode.toLowerCase().replace(/[^a-z0-9-_]/g, '')
      : (data.clientName || 'qr').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15) + '-' + Math.random().toString(36).substr(2, 4);

    const newProject: QRProject = {
      id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientName: data.clientName || 'Cliente Particular',
      projectName: data.projectName || 'Instalación',
      shortCode: baseCode,
      destinationUrl: data.destinationUrl || 'https://onedrive.live.com',
      destinationHistory: [],
      notes: data.notes || '',
      technician: data.technician || 'Carlos Ruiz',
      technicianId: data.technicianId || 'user-1',
      status: data.status || 'active',
      qrTargetType: data.qrTargetType || 'dynamic',
      qrDesign: data.qrDesign || {
        foregroundColor: '#0284c7',
        backgroundColor: '#ffffff',
        logoUrl: '',
        logoSize: 22,
        logoMargin: 4,
        errorCorrectionLevel: 'H',
        dotStyle: 'rounded',
        cornerSquareStyle: 'extra-rounded',
        includeFrame: true,
        frameText: 'DOCUMENTACIÓN Y GARANTÍA',
        frameColor: '#0284c7',
        includeClientLabel: true,
      },
      scanCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    projects.unshift(newProject);
    saveData();
    res.status(201).json(newProject);
  });

  app.put('/api/projects/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const current = projects[index];
    const updates = req.body;
    const now = new Date().toISOString();

    // Check if destinationUrl changed, if so register to history!
    let history = current.destinationHistory ? [...current.destinationHistory] : [];
    if (updates.destinationUrl && updates.destinationUrl !== current.destinationUrl) {
      history.unshift({
        id: `hist-${Date.now()}`,
        url: current.destinationUrl,
        changedAt: now,
        changedBy: updates.changedBy || 'Administrador',
        reason: updates.changeReason || 'Actualización de enlace OneDrive',
      });
    }

    const updatedProject: QRProject = {
      ...current,
      ...updates,
      destinationHistory: history,
      updatedAt: now,
    };

    projects[index] = updatedProject;
    saveData();
    res.json(updatedProject);
  });

  app.delete('/api/projects/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    projects = projects.filter((p) => p.id !== id);
    saveData();
    res.json({ success: true, id });
  });

  // Scans history
  app.get('/api/scans', requireAuth, (req, res) => {
    res.json(scans);
  });

  // Record a simulated or manual test scan
  app.post('/api/scans/record', requireAuth, (req, res) => {
    const { shortCode, clientName, projectName, deviceType, os, browser } = req.body;
    const project = projects.find(
      (p) => p.shortCode.toLowerCase() === (shortCode || '').toLowerCase()
    );

    const newScan: ScanEvent = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      projectId: project ? project.id : 'unknown',
      clientName: clientName || (project ? project.clientName : 'Cliente Prueba'),
      projectName: projectName || (project ? project.projectName : 'Proyecto Prueba'),
      shortCode: shortCode || 'test',
      scannedAt: new Date().toISOString(),
      deviceType: deviceType || 'mobile',
      os: os || 'iOS',
      browser: browser || 'Safari',
      city: 'Madrid',
      country: 'España',
      ipMasked: '88.14.***.***',
      redirectUrl: project ? project.destinationUrl : 'https://onedrive.live.com',
    };

    if (project) {
      project.scanCount = (project.scanCount || 0) + 1;
      project.lastScannedAt = newScan.scannedAt;
    }

    scans.unshift(newScan);
    saveData();
    res.json(newScan);
  });

  // Users (Listing requires auth; Creating/editing/deleting requires Admin)
  app.get('/api/users', requireAuth, (req, res) => {
    res.json(users);
  });

  app.post('/api/users', requireAdmin, (req, res) => {
    const data = req.body;
    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      name: data.name || 'Nuevo Usuario',
      email: data.email || 'usuario@empresa.com',
      role: data.role || 'technician',
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
      installationsAssigned: 0,
    };
    users.push(newUser);
    saveData();
    res.status(201).json(newUser);
  });

  app.put('/api/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    users[idx] = { ...users[idx], ...req.body };
    saveData();
    res.json(users[idx]);
  });

  app.delete('/api/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    users = users.filter((u) => u.id !== id);
    saveData();
    res.json({ success: true, id });
  });

  // Reset database to initial seed (protected by Admin)
  app.post('/api/reset-demo', requireAdmin, (req, res) => {
    projects = [...INITIAL_PROJECTS];
    users = [...INITIAL_USERS];
    scans = [...INITIAL_SCANS];
    saveData();
    res.json({ success: true, message: 'Datos de muestra restaurados con éxito' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Dynamic QR App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
