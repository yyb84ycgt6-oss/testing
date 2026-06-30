import http from 'node:http';
import { config } from './config.js';
import { handleRequest } from './app.js';

export function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { status: 500, message: 'Unexpected server error.' } }));
    });
  });
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`Jackie's profile service listening on http://${config.host}:${config.port}`);
  });
}
