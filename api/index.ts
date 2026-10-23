import { Pool, type PoolClient } from 'pg';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { appReady, restoreState, snapshotState } from '../server.js';

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
}) : null;
let queue: Promise<void> = Promise.resolve();
const initialState = structuredClone(snapshotState());

// Serialize the small pilot's state locally and across function instances.
// Commit before returning any response so a successful save is durable.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!pool) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Configuración pendiente: base de datos del alojamiento.' }));
    return;
  }
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  const originalEnd = res.end.bind(res);
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(71623001)');
    await client.query('CREATE TABLE IF NOT EXISTS qr_app_state (id integer PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
    await client.query('ALTER TABLE qr_app_state ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()');
    const result = await client.query('SELECT state FROM qr_app_state WHERE id = 1');
    const app = await appReady;
    restoreState(result.rows[0]?.state || structuredClone(initialState));
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Request timed out')), 20000);
      res.write = ((chunk: any, encoding?: any, callback?: any) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : undefined));
        if (typeof encoding === 'function') encoding(); else if (callback) callback();
        return true;
      }) as typeof res.write;
      res.end = ((chunk?: any, encoding?: any) => {
        if (chunk != null) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : undefined));
        clearTimeout(timer);
        resolve();
        return res;
      }) as typeof res.end;
      app(req as any, res as any);
    });
    await client.query('INSERT INTO qr_app_state(id, state, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()', [JSON.stringify(snapshotState())]);
    await client.query('COMMIT');
    originalEnd(Buffer.concat(chunks));
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Cloud request failed:', error instanceof Error ? error.message : 'Unknown error');
    if (!res.headersSent) {
      res.removeHeader('Location');
      res.removeHeader('Content-Length');
      res.removeHeader('ETag');
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      originalEnd(JSON.stringify({ error: 'No se ha podido completar la operación. Inténtalo de nuevo.' }));
    }
  } finally {
    client?.release();
    release();
  }
}

