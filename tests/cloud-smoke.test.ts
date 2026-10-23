import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';

test('open access preserves dynamic destinations; storage remains required in Vercel', async () => {
  process.env.VERCEL = '1';
  delete process.env.DATABASE_URL;
  const { appReady, snapshotState, restoreState } = await import('../server.js');
  const { default: cloudHandler } = await import('../api/index.js');
  const app = await appReady;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/api/projects`)).status, 200);
    assert.equal((await fetch(`${base}/api/users`)).status, 200);
    const headers = { 'Content-Type': 'application/json' };
    const create = await fetch(`${base}/api/projects`, {
      method: 'POST', headers,
      body: JSON.stringify({ shortCode: 'cloud-test', destinationUrl: 'https://example.com/first' }),
    });
    assert.equal(create.status, 201);
    const project = await create.json() as { id: string };
    const saved = JSON.parse(JSON.stringify(snapshotState()));
    restoreState({ ...saved, projects: [] });
    assert.equal((await (await fetch(`${base}/api/projects`)).json() as unknown[]).length, 0);
    restoreState(saved);
    assert.equal((await fetch(`${base}/api/projects/${project.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ destinationUrl: 'https://example.com/second' }),
    })).status, 200);
    const updated = JSON.parse(JSON.stringify(snapshotState()));
    restoreState(updated);
    const redirect = await fetch(`${base}/r/cloud-test`, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), 'https://example.com/second');
    assert.ok(snapshotState().scans.some(s => s.projectId === project.id));
    await fetch(`${base}/api/projects/${project.id}`, { method: 'PUT', headers, body: JSON.stringify({ status: 'paused' }) });
    assert.equal((await fetch(`${base}/r/cloud-test`)).status, 403);
    assert.equal((await fetch(`${base}/api/projects/${project.id}`, { method: 'DELETE' })).status, 200);
    assert.ok(!snapshotState().projects.some(p => p.id === project.id));
    assert.deepEqual(Object.keys(snapshotState()).sort(), ['projects', 'scans', 'users']);
    app.get('/cloud-config-test', (req, res) => { void cloudHandler(req, res); });
    assert.equal((await fetch(`${base}/cloud-config-test`)).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

