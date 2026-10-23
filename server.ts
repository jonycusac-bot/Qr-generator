import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Pool, type PoolClient } from 'pg';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PROJECTS, INITIAL_USERS, INITIAL_SCANS } from './src/data/initialData.js';
import { QRProject, AppUser, ScanEvent } from './src/types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const localPool = !process.env.VERCEL && DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : null;

// Ensure data folder
if (!process.env.VERCEL && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Application data; access is open and profiles are descriptive only.
let projects: QRProject[] = [];
let users: AppUser[] = [];
let scans: ScanEvent[] = [];

function loadData() {
  if (process.env.VERCEL || localPool) {
    projects = structuredClone(INITIAL_PROJECTS);
    users = structuredClone(INITIAL_USERS);
    scans = [];
    return;
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      projects = data.projects || INITIAL_PROJECTS;
      users = data.users || INITIAL_USERS;
      scans = data.scans || INITIAL_SCANS;
      if (data.auth || data.sessions) saveData();
      console.log(`[DB] Loaded ${projects.length} projects, ${users.length} users, ${scans.length} scans`);
      return;
    }
  } catch (err) {
    console.error('[DB] Error loading db.json, using defaults', err);
  }
  projects = [...INITIAL_PROJECTS];
  users = [...INITIAL_USERS];
  scans = [...INITIAL_SCANS];
  saveData();
}

function saveData() {
  if (process.env.VERCEL || localPool) return;
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ projects, users, scans }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('[DB] Failed to save to db.json:', err);
  }
}

loadData();

export function snapshotState() { return { projects, users, scans }; }
export function restoreState(state: ReturnType<typeof snapshotState>) {
  projects = state.projects; users = state.users; scans = state.scans;
}

async function beginSharedState(client: PoolClient) {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(71623001)');
  await client.query('CREATE TABLE IF NOT EXISTS qr_app_state (id integer PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
  await client.query('ALTER TABLE qr_app_state ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()');
  const result = await client.query('SELECT state FROM qr_app_state WHERE id = 1');
  if (result.rows[0]?.state) restoreState(result.rows[0].state);
}

async function commitSharedState(client: PoolClient) {
  await client.query(
    `INSERT INTO qr_app_state(id, state, updated_at)
     VALUES (1, $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [JSON.stringify(snapshotState())],
  );
  await client.query('COMMIT');
}

function neonStateMiddleware() {
  return async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!localPool) return next();

    let client: PoolClient | undefined;
    try {
      client = await localPool.connect();
      await beginSharedState(client);
    } catch (error) {
      client?.release();
      console.warn('[DB] Database connection unavailable, falling back to local storage:', error instanceof Error ? error.message : error);
      return next();
    }

    const originalEnd = res.end.bind(res);
    let ending = false;
    res.end = ((chunk?: any, encoding?: any, callback?: any) => {
      if (ending) return res;
      ending = true;
      void (async () => {
        try {
          await commitSharedState(client!);
          originalEnd(chunk, encoding, callback);
        } catch (error) {
          await client!.query('ROLLBACK').catch(() => undefined);
          console.warn('[DB] Database save failed, falling back to local persistence:', error instanceof Error ? error.message : error);
          saveData();
          originalEnd(chunk, encoding, callback);
        } finally {
          client!.release();
        }
      })();
      return res;
    }) as typeof res.end;

    next();
  };
}

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

  if (localPool) {
    app.use(['/api', '/r'], neonStateMiddleware());
    console.log('[DB] Neon PostgreSQL enabled for local and Windows execution');
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Dynamic QR redirection route: /r/:shortCode
  app.get('/r/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });
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

    // Use a direct, non-cacheable 302 by default. Embedded camera browsers can
    // break Microsoft 365 authentication when an intermediate HTML page is used.
    const showLanding = req.query.landing === 'true';
    if (!showLanding) {
      res.redirect(302, project.destinationUrl);
      return;
    }

    // Optional branded landing page for manual previews only.
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

  // Profiles are team records, not authenticated identities.
  // Projects
  app.get('/api/projects', (req, res) => {
    res.json(projects);
  });

  app.post('/api/projects', (req, res) => {
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

  app.put('/api/projects/:id', (req, res) => {
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

  app.delete('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    projects = projects.filter((p) => p.id !== id);
    saveData();
    res.json({ success: true, id });
  });

  // Scans history
  app.get('/api/scans', (req, res) => {
    res.json(scans);
  });

  // Record a simulated or manual test scan
  app.post('/api/scans/record', (req, res) => {
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
  app.get('/api/users', (req, res) => {
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
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

  app.put('/api/users/:id', (req, res) => {
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

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    users = users.filter((u) => u.id !== id);
    saveData();
    res.json({ success: true, id });
  });

  // Reset database to initial seed (protected by Admin)
  app.post('/api/reset-demo', (req, res) => {
    projects = [...INITIAL_PROJECTS];
    users = [...INITIAL_USERS];
    scans = [...INITIAL_SCANS];
    saveData();
    res.json({ success: true, message: 'Datos de muestra restaurados con éxito' });
  });

  // Vite middleware for development
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production' && !process.argv[1]?.endsWith('.cjs')) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Dynamic QR App running on http://0.0.0.0:${PORT}`);
  });
  return app;
}

export const appReady = startServer();



