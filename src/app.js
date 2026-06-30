import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { sendError, mimeTypeFor } from './lib/http.js';
import { handleGetProfile, handleHealth, handleUpdateProfile } from './routes/profile.js';

const apiRoutes = {
  'GET /api/health': handleHealth,
  'GET /api/profile': handleGetProfile,
  'PUT /api/profile': handleUpdateProfile,
};

async function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(config.publicDir, relativePath);

  // Prevent path traversal outside the public directory.
  if (!filePath.startsWith(config.publicDir)) {
    return sendError(res, 403, 'Forbidden.');
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return sendError(res, 404, 'Not found.');
    }
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypeFor(path.extname(filePath)) });
    res.end(content);
  } catch {
    sendError(res, 404, 'Not found.');
  }
}

export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const routeKey = `${req.method} ${url.pathname}`;

  const apiHandler = apiRoutes[routeKey];
  if (apiHandler) {
    return apiHandler(req, res);
  }

  if (url.pathname.startsWith('/api/')) {
    return sendError(res, 404, `No API route for ${routeKey}.`);
  }

  return serveStatic(req, res, url.pathname);
}
