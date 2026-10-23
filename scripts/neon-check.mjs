import pg from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error('Falta DATABASE_URL en .env.local o en las variables de Vercel.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
});

try {
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS qr_app_state (id integer PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
    await client.query('ALTER TABLE qr_app_state ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()');
    const result = await client.query('SELECT current_database() AS database, now() AS checked_at');
    console.log(`Neon conectado correctamente. Base: ${result.rows[0].database}`);
  } finally {
    client.release();
  }
} catch (error) {
  console.error('No se pudo conectar con Neon:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
