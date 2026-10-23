import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// One server process owns this database; transactions keep related changes atomic.
export class AppDatabase {
  private db: DatabaseSync;
  constructor(filename: string) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, position INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, data TEXT NOT NULL);`);
  }
  load(): any | null {
    const auth = this.db.prepare("SELECT data FROM settings WHERE key = 'auth'").get();
    if (!auth) return null;
    const result: any = { auth: JSON.parse(String(auth.data)) };
    for (const table of ['projects', 'users', 'scans']) {
      result[table] = this.db.prepare(`SELECT data FROM ${table} ORDER BY position`).all().map(row => JSON.parse(String(row.data)));
    }
    return result;
  }
  save(state: { projects: { id: string }[]; users: { id: string }[]; scans: { id: string }[]; auth: unknown }) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of ['projects', 'users', 'scans'] as const) {
        this.db.exec(`DELETE FROM ${table}`);
        const insert = this.db.prepare(`INSERT INTO ${table} (id, position, data) VALUES (?, ?, ?)`);
        state[table].forEach((row, index) => insert.run(row.id, index, JSON.stringify(row)));
      }
      this.db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('auth', ?)").run(JSON.stringify(state.auth));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  getSessions(): any[] {
    return this.db.prepare('SELECT data FROM sessions').all().map(row => JSON.parse(String(row.data)));
  }
  setSession(token: string, session: unknown) {
    this.db.prepare('INSERT OR REPLACE INTO sessions (token, data) VALUES (?, ?)').run(token, JSON.stringify(session));
  }
  deleteSession(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  close() { this.db.close(); }
}
