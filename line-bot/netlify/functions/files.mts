import type {} from '@netlify/functions';
// 作った見積書（画像・PDF）を返す。アドレスは推測できない長い番号つき。
import { getStore } from '@netlify/blobs';

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf' };

export default async (req: Request, context: { params: Record<string, string> }) => {
  const name = context.params.name || '';
  const m = name.match(/^([a-f0-9]{32})\.(png|jpg|pdf)$/);
  if (!m) return new Response('Not found', { status: 404 });
  const data = await getStore({ name: 'mitsumori' }).get(`files/${name}`, { type: 'arrayBuffer' });
  if (!data) return new Response('この見積書は保存期間が過ぎたため表示できません。', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(data, {
    headers: {
      'Content-Type': TYPES[m[2]],
      'Content-Disposition': `inline; filename="mitsumori.${m[2]}"`,
      'Cache-Control': 'private, max-age=86400',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
  });
};

export const config = { path: '/f/:name' };
