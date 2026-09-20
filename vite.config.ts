import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { handleData, handleLogin, type Env, type Storage } from './api/_lib/core.js';

// Локальная замена Vercel-функций: тот же код API, но данные лежат в файле на диске.
const DATA_DIR = '.local-data';
const DATA_FILE = `${DATA_DIR}/calendar.json`;

const fileStorage: Storage = {
  async read() {
    try {
      return await readFile(DATA_FILE, 'utf8');
    } catch {
      return null;
    }
  },
  async write(json) {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, json, 'utf8');
  },
};

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function devApi(env: Env): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== '/api/login' && path !== '/api/data') return next();
        const method = req.method ?? 'GET';
        const body = method === 'GET' ? null : await readJson(req);
        const result =
          path === '/api/login'
            ? await handleLogin(method, body, env)
            : await handleData(method, req.headers.authorization, body, env, fileStorage);
        res.statusCode = result.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, process.cwd(), '');
  const env: Env = {
    APP_PASSWORD: loaded.APP_PASSWORD || 'dev',
    AUTH_SECRET: loaded.AUTH_SECRET,
  };
  return {
    plugins: [react(), devApi(env)],
    test: { environment: 'node' },
  };
});
