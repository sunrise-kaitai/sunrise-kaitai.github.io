// 公式LINEの「Webhook」の受け口。登録した人（松浦様など）が送った文章から見積書を作って返す。
// 登録していない人（お客様）のメッセージには一切反応しない。
import type {} from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { parseEstimate, calc, yen, TEMPLATE, HELP } from '../../lib/estimate.mjs';
import { renderPNG, renderPDF, renderPreviewJPEG } from '../../lib/render.mjs';

const store = () => getStore({ name: 'mitsumori', consistency: 'strong' });

function verify(body: string, sig: string | null, secret: string) {
  if (!sig || !secret) return false;
  const mac = createHmac('sha256', secret).update(body).digest();
  const got = Buffer.from(sig, 'base64');
  return got.length === mac.length && timingSafeEqual(got, mac);
}

async function reply(token: string, messages: unknown[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Netlify.env.get('LINE_CHANNEL_ACCESS_TOKEN')}` },
    body: JSON.stringify({ replyToken: token, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) console.log('reply failed', res.status, await res.text());
}

const say = (text: string) => ({ type: 'text', text: text.slice(0, 4900) });

function company() {
  try { return JSON.parse(Netlify.env.get('COMPANY_JSON') || '{}'); } catch { return {}; }
}

// 写真で送られた角印の白い部分を透明にして、朱色だけ残す
async function cleanSeal(buf: Buffer) {
  const img = await loadImage(buf);
  const k = Math.min(1, 400 / Math.max(img.width, img.height));
  const w = Math.round(img.width * k), h = Math.round(img.height * k);
  const cv = createCanvas(w, h); const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (p[i] + p[i + 1] + p[i + 2]) / 3;
    if (l > 200 && Math.abs(p[i] - p[i + 2]) < 40) p[i + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  return cv.toBuffer('image/png');
}

async function makeEstimate(text: string, origin: string) {
  const parsed = parseEstimate(text);
  if (!parsed) return null;
  const { est, errors } = parsed;
  if (errors.length) return [say('見積書を作れませんでした。\n\n' + errors.map((e) => '・' + e).join('\n') + '\n\n書き方は「使い方」と送ると確認できます。')];
  const s = store();
  const seal = await s.get('settings/seal', { type: 'arrayBuffer' });
  const png: Buffer = await renderPNG(est, company(), (seal ? Buffer.from(seal) : null) as any);
  const [pdf, jpg] = await Promise.all([renderPDF(png), renderPreviewJPEG(png)]);
  const id = randomBytes(16).toString('hex');
  const meta = { metadata: { created: Date.now(), cust: est.cust } };
  await Promise.all([
    s.set(`files/${id}.png`, new Blob([new Uint8Array(png)]), meta),
    s.set(`files/${id}.jpg`, new Blob([new Uint8Array(jpg)]), meta),
    s.set(`files/${id}.pdf`, new Blob([new Uint8Array(pdf)]), meta),
  ]);
  const c = calc(est);
  const base = `${origin}/f/${id}`;
  return [
    { type: 'image', originalContentUrl: `${base}.png`, previewImageUrl: `${base}.jpg` },
    say(`${est.cust} ${est.hon}\n${c.rate ? '税込見積金額' : '見積金額'} ${yen(c.total)}\n\nPDF（印刷・メール用）\n${base}.pdf\n\n画像を長押しして「転送」を押すと、そのままお客様に送れます。`),
  ];
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok');
  const body = await req.text();
  if (!verify(body, req.headers.get('x-line-signature'), Netlify.env.get('LINE_CHANNEL_SECRET') || '')) {
    return new Response('bad signature', { status: 401 });
  }
  const origin = new URL(req.url).origin;
  const allowed = (Netlify.env.get('ALLOWED_USER_IDS') || '').split(/[,\s]+/).filter(Boolean);
  const { events = [] } = JSON.parse(body || '{}');

  for (const ev of events) {
    if (ev.type !== 'message' || ev.source?.type !== 'user' || !ev.replyToken) continue;
    const uid: string = ev.source.userId;
    const isOwner = allowed.includes(uid);
    const msg = ev.message;
    const text: string = msg.type === 'text' ? String(msg.text).trim() : '';

    // 初回の登録用：自分のIDを確認する（登録前だけ誰にでも返す）
    if (text === 'ID確認' && (isOwner || allowed.length === 0)) {
      await reply(ev.replyToken, [say('あなたのIDです。Netlifyの ALLOWED_USER_IDS に登録してください。'), say(uid)]);
      continue;
    }
    if (!isOwner) continue; // お客様のメッセージには反応しない

    try {
      const s = store();
      if (msg.type === 'image') {
        const waiting = await s.get(`state/${uid}`, { type: 'text' });
        if (waiting !== 'seal') continue;
        const res = await fetch(`https://api-data.line.me/v2/bot/message/${msg.id}/content`, {
          headers: { Authorization: `Bearer ${Netlify.env.get('LINE_CHANNEL_ACCESS_TOKEN')}` },
        });
        if (!res.ok) { await reply(ev.replyToken, [say('画像を受け取れませんでした。もう一度送ってください。')]); continue; }
        const seal = await cleanSeal(Buffer.from(await res.arrayBuffer()));
        await s.set('settings/seal', new Blob([new Uint8Array(seal)]));
        await s.delete(`state/${uid}`);
        await reply(ev.replyToken, [say('角印を登録しました。次の見積書から押されます。')]);
        continue;
      }
      if (!text) continue;
      if (text === '見積' || text === 'ひな形' || text === '見積書') {
        await reply(ev.replyToken, [say('下の文章をコピーして、中身を書きかえて送ってください。'), say(TEMPLATE)]);
      } else if (text === '使い方' || text === 'ヘルプ') {
        await reply(ev.replyToken, [say(HELP)]);
      } else if (text === '角印') {
        await s.set(`state/${uid}`, 'seal');
        await reply(ev.replyToken, [say('角印の画像を送ってください（白い紙に押して撮った写真でも大丈夫です）。')]);
      } else if (text === '角印を外す') {
        await s.delete('settings/seal');
        await reply(ev.replyToken, [say('角印を外しました。')]);
      } else if (/^見積/.test(text)) {
        const out = await makeEstimate(text, origin);
        if (out) await reply(ev.replyToken, out);
      }
    } catch (e) {
      console.log('error', e);
      await reply(ev.replyToken, [say('見積書を作る途中でエラーになりました。少し待ってもう一度送ってください。')]);
    }
  }
  return new Response('ok');
};

export const config = { path: '/line' };
