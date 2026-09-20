import { get, put } from '@vercel/blob';
import type { Storage } from './core.js';

const PATHNAME = 'calendar.json';

export const blobStorage: Storage = {
  async read() {
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (!result || !result.stream) return null;
    return new Response(result.stream).text();
  },
  async write(json) {
    await put(PATHNAME, json, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
  },
};
