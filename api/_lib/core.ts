import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface Storage {
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
}

export interface Env {
  APP_PASSWORD?: string;
  AUTH_SECRET?: string;
}

export interface ApiResult {
  status: number;
  body: unknown;
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const EMPTY_DATA = { tasks: [], done: {}, updatedAt: 0 };

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createToken(secret: string, now = Date.now()): string {
  const exp = String(now + TOKEN_TTL_MS);
  return `${exp}.${sign(exp, secret)}`;
}

export function verifyToken(token: string, secret: string, now = Date.now()): boolean {
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (!safeEqual(sig, sign(exp, secret))) return false;
  return Number(exp) > now;
}

function secretOf(env: Env): string | null {
  return env.AUTH_SECRET || env.APP_PASSWORD || null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handleLogin(method: string, body: unknown, env: Env): Promise<ApiResult> {
  if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } };
  const secret = secretOf(env);
  if (!env.APP_PASSWORD || !secret) {
    return { status: 500, body: { error: 'APP_PASSWORD is not configured' } };
  }
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== 'string' || !safeEqual(password, env.APP_PASSWORD)) {
    await sleep(700); // притормаживаем перебор
    return { status: 401, body: { error: 'Wrong password' } };
  }
  return { status: 200, body: { token: createToken(secret) } };
}

function isCalendarData(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    Array.isArray(d.tasks) &&
    !!d.done &&
    typeof d.done === 'object' &&
    !Array.isArray(d.done) &&
    typeof d.updatedAt === 'number'
  );
}

export async function handleData(
  method: string,
  authHeader: string | undefined,
  body: unknown,
  env: Env,
  storage: Storage,
): Promise<ApiResult> {
  const secret = secretOf(env);
  if (!secret) return { status: 500, body: { error: 'APP_PASSWORD is not configured' } };

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!verifyToken(token, secret)) return { status: 401, body: { error: 'Unauthorized' } };

  if (method === 'GET') {
    const raw = await storage.read();
    return { status: 200, body: raw ? JSON.parse(raw) : EMPTY_DATA };
  }

  if (method === 'PUT') {
    if (!isCalendarData(body)) return { status: 400, body: { error: 'Invalid data' } };
    const json = JSON.stringify(body);
    if (Buffer.byteLength(json) > MAX_BODY_BYTES) {
      return { status: 413, body: { error: 'Data too large' } };
    }
    await storage.write(json);
    return { status: 200, body: { ok: true } };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}
