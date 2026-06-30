import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('GET /api/profile returns profile data', async () => {
  const res = await fetch(`${baseUrl}/api/profile`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.data);
  assert.equal(typeof body.data.name, 'string');
});

test('unknown API route returns 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});

test('GET / serves the index page', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /<div id="app"|id="app"/);
});

test('path traversal attempts are rejected', async () => {
  const res = await fetch(`${baseUrl}/../package.json`);
  assert.notEqual(res.status, 200);
});
