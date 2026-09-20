import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleData } from './_lib/core.js';
import { blobStorage } from './_lib/blobStorage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await handleData(
      req.method ?? 'GET',
      req.headers.authorization,
      req.body,
      process.env,
      blobStorage,
    );
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Storage error. Is the Blob store connected?' });
  }
}
