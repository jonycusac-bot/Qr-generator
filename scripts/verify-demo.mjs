import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';

const env = parse(fs.readFileSync('.env.local', 'utf8'));
const base = 'https://qr-generator-three-opal.vercel.app';
if (!env.PANEL_PASSWORD) throw new Error('Falta la clave privada del panel.');
const headers = { 'Content-Type': 'application/json', 'X-Panel-Key': env.PANEL_PASSWORD };
async function api(path, method = 'GET', data) {
  const response = await fetch(base + path, { method, headers, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`API ${path}: HTTP ${response.status}`);
  return response.json();
}
assert.equal((await fetch(`${base}/api/health`)).status, 200);
assert.equal((await fetch(`${base}/api/state`)).status, 401, 'La gestión debe estar protegida.');
const projects = await api('/api/projects');
let demo = projects.find(project => project.shortCode === 'demo-dinamico');
if (demo && demo.clientName !== 'Demostración QR dinámico') throw new Error('El código de demostración ya pertenece a otra instalación; no se modifica.');
const destinationA = `${base}/demo/destino-a.html`;
const destinationB = `${base}/demo/destino-b.html`;
if (!demo) {
  demo = await api('/api/projects', 'POST', { clientName: 'Demostración QR dinámico', projectName: 'Misma pegatina, dos destinos', shortCode: 'demo-dinamico', destinationUrl: destinationA, notes: 'Datos ficticios para demostrar el cambio de destino conservando el mismo QR.' });
} else {
  await api(`/api/projects/${demo.id}`, 'PUT', { destinationUrl: destinationA, status: 'active', changeReason: 'Inicio de demostración A → B' });
}
const qr = `${base}/r/demo-dinamico`;
const first = await fetch(qr, { redirect: 'manual' });
assert.equal(first.status, 302); assert.equal(first.headers.get('location'), destinationA);
assert.equal((await fetch(destinationA)).status, 200);
await api(`/api/projects/${demo.id}`, 'PUT', { destinationUrl: destinationB, changeReason: 'Demostración: mismo QR, nuevo destino' });
const second = await fetch(qr, { redirect: 'manual' });
assert.equal(second.status, 302); assert.equal(second.headers.get('location'), destinationB);
assert.equal((await fetch(destinationB)).status, 200);
const existing = await fetch(`${base}/r/aa-1k1r`, { redirect: 'manual' });
assert.equal(existing.status, 302, 'El QR del usuario debe redirigir públicamente.');
console.log(`PASS público: ${qr} devolvió 302 hacia A y después 302 hacia B sin cambiar la URL del QR.`);
console.log('PASS: páginas A/B accesibles; panel sin clave devuelve 401; aa-1k1r devuelve 302 a su destino existente.');
