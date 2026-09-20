import { describe, expect, it } from 'vitest';
import { createToken, handleData, handleLogin, verifyToken, type Storage } from './core';

const env = { APP_PASSWORD: 'secret-pass' };

function memoryStorage(): Storage & { value: string | null } {
  return {
    value: null,
    async read() {
      return this.value;
    },
    async write(json) {
      this.value = json;
    },
  };
}

describe('tokens', () => {
  it('verifies own tokens and rejects tampered, foreign and expired ones', () => {
    const token = createToken('s1', 1000);
    expect(verifyToken(token, 's1', 2000)).toBe(true);
    expect(verifyToken(token, 's2', 2000)).toBe(false);
    expect(verifyToken('9' + token, 's1', 2000)).toBe(false);
    expect(verifyToken(token, 's1', 1000 + 31 * 86_400_000)).toBe(false);
    expect(verifyToken('', 's1')).toBe(false);
  });
});

describe('login', () => {
  it('issues a token only for the right password', async () => {
    const bad = await handleLogin('POST', { password: 'nope' }, env);
    expect(bad.status).toBe(401);
    const ok = await handleLogin('POST', { password: 'secret-pass' }, env);
    expect(ok.status).toBe(200);
    expect(verifyToken((ok.body as { token: string }).token, 'secret-pass')).toBe(true);
  });

  it('fails closed when the password is not configured', async () => {
    expect((await handleLogin('POST', { password: '' }, {})).status).toBe(500);
  });
});

describe('data', () => {
  const auth = `Bearer ${createToken('secret-pass')}`;

  it('rejects requests without a valid token', async () => {
    const storage = memoryStorage();
    expect((await handleData('GET', undefined, null, env, storage)).status).toBe(401);
    expect((await handleData('PUT', 'Bearer x.y', {}, env, storage)).status).toBe(401);
  });

  it('returns empty data first, then what was saved', async () => {
    const storage = memoryStorage();
    const empty = await handleData('GET', auth, null, env, storage);
    expect(empty.body).toEqual({ tasks: [], done: {}, updatedAt: 0 });

    const data = { tasks: [{ id: '1' }], done: { '1': ['2026-09-20'] }, updatedAt: 5 };
    expect((await handleData('PUT', auth, data, env, storage)).status).toBe(200);
    expect((await handleData('GET', auth, null, env, storage)).body).toEqual(data);
  });

  it('rejects malformed payloads', async () => {
    const storage = memoryStorage();
    expect((await handleData('PUT', auth, { tasks: 'x' }, env, storage)).status).toBe(400);
    expect(storage.value).toBeNull();
  });
});
