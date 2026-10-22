// 見積書をA4の画像（PNG）とPDFにする。配置はホームページの見積書メーカーと同じ。
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calc, yen, comma } from './estimate.mjs';

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dirs = [path.join(here, '../fonts'), path.join(process.cwd(), 'fonts'), path.join(process.cwd(), 'line-bot/fonts'), '/var/task/fonts', '/var/task/line-bot/fonts'];
  const dir = dirs.find((d) => existsSync(path.join(d, 'NotoSansJP_400Regular.ttf')));
  if (!dir) throw new Error('fonts not found');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSansJP_400Regular.ttf'), 'JP');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSansJP_700Bold.ttf'), 'JPB');
  fontsReady = true;
}

const W = 794, H = 1123, S = 2; // A4（96dpi）を2倍で描く
const L = 72, R = 722;

function reiwa(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `発行日：令和　${y - 2018}年　${m}月${d}日`;
}

export async function renderPNG(e, co = {}, sealBuf = null) {
  ensureFonts();
  const c = calc(e);
  const cv = createCanvas(W * S, H * S);
  const g = cv.getContext('2d');
  g.scale(S, S);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#111'; g.strokeStyle = '#111'; g.textBaseline = 'alphabetic';

  const font = (size, bold) => { g.font = `${size}px ${bold ? 'JPB' : 'JP'}`; };
  const text = (t, x, y, align = 'left') => { g.textAlign = align; g.fillText(String(t ?? ''), x, y); };
  const fit = (t, x, y, maxW, align) => { // はみ出す文字は詰める
    const w = g.measureText(t).width;
    if (w <= maxW) return text(t, x, y, align);
    g.save(); const k = maxW / w;
    const ox = align === 'center' ? x - (w * k) / 2 : align === 'right' ? x - w * k : x;
    g.translate(ox, y); g.scale(k, 1); g.textAlign = 'left'; g.fillText(t, 0, 0); g.restore();
  };
  const line = (x1, y1, x2, y2, w = 1) => { g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const rect = (x, y, w, h, fill, lw = 1) => { if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); g.fillStyle = '#111'; } g.lineWidth = lw; g.strokeRect(x, y, w, h); };

  // 発行日・タイトル
  font(13); text(reiwa(e.date), R, 66, 'right');
  font(32, true);
  { const t = 'お見積書', sp = 4; let w = 0; for (const ch of t) w += g.measureText(ch).width + sp; w -= sp;
    let x = W / 2 - w / 2; g.textAlign = 'left'; for (const ch of t) { g.fillText(ch, x, 118); x += g.measureText(ch).width + sp; } }

  // 宛名
  font(21); fit(e.cust || '', L + 220, 166, 430, 'center');
  line(L, 174, L + 440, 174, 1.5);
  text(e.hon || '御中', L + 450, 166);

  // 会社情報
  const cx = L + 440;
  let y = 210;
  font(18, true); text(co.coName || '株式会社sunrise', cx, y); y += 26;
  font(13.5); if (co.coZip) { text(`〒 ${co.coZip}`, cx, y); y += 21; }
  font(12.5); if (co.coAddr) { fit(`住所：${co.coAddr}`, cx, y, R - cx + 4); y += 20; }
  if (co.coAddr2) { fit(co.coAddr2, cx + 42, y, R - cx - 38); y += 22; }
  font(13.5);
  if (co.coTel || co.coTel2) { text('TEL：', cx, y); if (co.coTel) { text(co.coTel, cx + 48, y); y += 21; } if (co.coTel2) { text(co.coTel2, cx + 48, y); y += 21; } }
  const leadY = Math.max(y + 2, 340);
  if (co.coRep) text(`担当：${co.coRep}`, cx, leadY);
  font(14); text('下記の通りお見積り申し上げます。', L, leadY);

  // 見積金額
  const ay = leadY + 18;
  rect(L, ay, 220, 42, '#F2F2F2', 1.5); rect(L + 220, ay, 220, 42, null, 1.5);
  font(17); text(c.rate ? '税込見積金額' : '見積金額', L + 110, ay + 27, 'center');
  font(22, true); text(yen(c.total), L + 330, ay + 29, 'center');

  // 角印
  if (sealBuf) {
    try { const img = await loadImage(sealBuf); const sw = 72, sh = (img.height / img.width) * sw; g.drawImage(img, R - 10 - sw, ay - 10, sw, sh); } catch {}
  }

  // 明細
  const ty = ay + 62, rh = 26, hh = 28;
  const xs = [L, L + 90, R - 300, R - 216, R - 116, R];
  const N = Math.max(15, c.rows.length + (e.disc ? 1 : 0));
  g.fillStyle = '#BFBFBF'; g.fillRect(L, ty, R - L, hh); g.fillStyle = '#111';
  font(13.5, true);
  ['名称', '項目', '数量', '単価', '金額'].forEach((h, i) => text(h, (xs[i] + xs[i + 1]) / 2, ty + 19, 'center'));
  const rows = c.rows.map((r) => {
    const lump = String(r.u).trim() === '式' && r.q === 1;
    return [r.k || '', r.n, `${Number.isInteger(r.q) ? r.q : r.q}${r.u}`, lump ? '' : comma(r.p), comma(r.a)];
  });
  if (e.disc) rows.push(['', 'お値引き', '', '', '-' + comma(e.disc)]);
  font(13);
  rows.forEach((r, i) => {
    const yy = ty + hh + rh * i + 18;
    fit(r[0], (xs[0] + xs[1]) / 2, yy, xs[1] - xs[0] - 10, 'center');
    fit(r[1], (xs[1] + xs[2]) / 2, yy, xs[2] - xs[1] - 12, 'center');
    fit(r[2], (xs[2] + xs[3]) / 2, yy, xs[3] - xs[2] - 10, 'center');
    fit(r[3], xs[4] - 8, yy, xs[4] - xs[3] - 12, 'right');
    fit(r[4], xs[5] - 8, yy, xs[5] - xs[4] - 12, 'right');
  });
  const tb = ty + hh + rh * N;
  g.lineWidth = 1;
  for (let i = 0; i <= N; i++) line(L, ty + hh + rh * i, R, ty + hh + rh * i);
  line(L, ty, R, ty);
  xs.forEach((x) => line(x, ty, x, tb));

  // 備考・合計
  const fy = tb + 8;
  font(13.5, true); text('備考', L + 210, fy + 16, 'center');
  rect(L, fy + 24, 420, 86);
  font(12.5);
  if (e.memo) String(e.memo).split('\n').slice(0, 4).forEach((m, i) => fit(m, L + 8, fy + 44 + i * 19, 404, 'left'));
  const sx = L + 450, sl = 90, sv = R - sx - sl;
  const sums = [['小 計', comma(c.sub)], ...(c.rate ? [['消費税', comma(c.tax)]] : []), ['合計', comma(c.total)]];
  sums.forEach(([k, v], i) => {
    const yy = fy + i * 27, last = i === sums.length - 1;
    rect(sx, yy, sl, 27, '#BFBFBF'); rect(sx + sl, yy, sv, 27);
    font(last ? 15 : 13.5, last); text(k, sx + sl / 2, yy + 19, 'center');
    font(last ? 15 : 14, last); text(v, R - 8, yy + 19, 'right');
  });

  // 下の罫線
  const ry = fy + 110 + 16;
  for (let i = 1; i <= 3; i++) line(L, ry + 26 * i, R, ry + 26 * i);

  return cv.toBuffer('image/png');
}

export async function renderPDF(png) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const img = await pdf.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  pdf.setTitle('お見積書');
  return Buffer.from(await pdf.save());
}

export async function renderPreviewJPEG(png) {
  const img = await loadImage(png);
  const w = 600, h = Math.round((img.height / img.width) * w);
  const cv = createCanvas(w, h); const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  return cv.toBuffer('image/jpeg', 85);
}
