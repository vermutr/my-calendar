import type { CalendarData } from '../types';

export class UnauthorizedError extends Error {}

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function login(password: string): Promise<string> {
  const { token } = await request<{ token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  return token;
}

export const fetchData = (token: string) =>
  request<CalendarData>('/api/data', { method: 'GET' }, token);

export const saveData = (token: string, data: CalendarData) =>
  request<{ ok: true }>('/api/data', { method: 'PUT', body: JSON.stringify(data) }, token);
