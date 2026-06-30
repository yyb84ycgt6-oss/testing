import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { config } from '../src/config.js';
import { writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';

let server;
let baseUrl;
let originalProfileFile;
let tempProfileFile;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  // Use a local temp file in data directory (avoiding /tmp) for API tests.
  originalProfileFile = config.profileFile;
  tempProfileFile = path.join(config.rootDir, 'data', 'temp-api-test-profile.json');

  const realData = await readFile(originalProfileFile, 'utf-8');
  await writeFile(tempProfileFile, realData, 'utf-8');

  config.profileFile = tempProfileFile;
});

after(async () => {
  server.close();
  config.profileFile = originalProfileFile;
  try {
    await rm(tempProfileFile, { force: true });
  } catch {}
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

test('PUT /api/profile rejects when unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'New Name', title: 'New Title' }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error.message, /Missing or invalid token/);
});

test('PUT /api/profile rejects with invalid token', async () => {
  const res = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + 'invalid-token',
    },
    body: JSON.stringify({ name: 'New Name', title: 'New Title' }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error.message, /Invalid token/);
});

test('PUT /api/profile rejects invalid payload', async () => {
  const res = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.adminToken,
    },
    body: JSON.stringify({ name: 'Only Name (No Title)' }),
  });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error.message, /missing required fields/);
});

test('PUT /api/profile successfully updates profile', async () => {
  const testPayload = {
    name: 'Jackie Updated',
    title: 'Principal Engineer & AI Architect',
    tagline: 'Maximum power achieved.',
  };
  const res = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.adminToken,
    },
    body: JSON.stringify(testPayload),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.name, 'Jackie Updated');
  assert.equal(body.data.title, 'Principal Engineer & AI Architect');
  assert.equal(body.data.tagline, 'Maximum power achieved.');

  // Verify get returns the updated profile
  const getRes = await fetch(`${baseUrl}/api/profile`);
  const getBody = await getRes.json();
  assert.equal(getBody.data.name, 'Jackie Updated');
});
