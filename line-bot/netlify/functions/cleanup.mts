import type {} from '@netlify/functions';
// 毎日 日本時間3時（UTC 18時）に、180日を過ぎた見積書の画像・PDFを消す。
import { getStore } from '@netlify/blobs';

const KEEP_DAYS = 180;

export default async () => {
  const s = getStore({ name: 'mitsumori' });
  const { blobs } = await s.list({ prefix: 'files/' });
  const limit = Date.now() - KEEP_DAYS * 86400e3;
  let removed = 0;
  for (const b of blobs) {
    const r = await s.getMetadata(b.key);
    const created = Number(r?.metadata?.created || 0);
    if (created && created < limit) { await s.delete(b.key); removed++; }
  }
  console.log('removed', removed);
};

export const config = { schedule: '0 18 * * *' };
