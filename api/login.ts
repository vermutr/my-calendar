import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleLogin } from './_lib/core.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await handleLogin(req.method ?? 'GET', req.body, process.env);
  res.status(result.status).json(result.body);
}
