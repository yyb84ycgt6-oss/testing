import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  rootDir,
  publicDir: path.join(rootDir, 'public'),
  dataDir: path.join(rootDir, 'data'),
  profileFile: path.join(rootDir, 'data', 'profile.json'),
};
