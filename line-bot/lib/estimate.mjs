// LINEに打ち込まれた文章を見積書のデータに変える。
//
// 書き方の例（1行目は「見積」）:
//   見積
//   宛名 株式会社J.F.I.N.E 御中
//   瑞穂区内装解体工事 1式 3700000
//   ブロック塀撤去 12m 6000
//   値引き 50000
//   備考 地中埋設物は別途
//   日付 10/21

const Z2H = (s) =>
  s.replace(/[０-９Ａ-Ｚａ-ｚ．，：／＠－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');

export function toNumber(raw) {
  if (raw == null) return NaN;
  let s = Z2H(String(raw)).replace(/[,¥￥円\s]/g, '');
  let mul = 1;
  if (/万$/.test(s)) { mul = 10000; s = s.slice(0, -1); }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * mul);
}

const HONORIFICS = ['御中', '様', '殿'];

function splitName(text) {
  let t = text.trim();
  for (const h of HONORIFICS) {
    if (t.endsWith(h)) return { name: t.slice(0, -h.length).trim(), hon: h === '殿' ? '様' : h };
  }
  const corp = /(株式会社|有限会社|合同会社|\(株\)|（株）|\(有\)|（有）|組合|法人|事務所|工務店|建設|不動産)/.test(t);
  return { name: t, hon: corp ? '御中' : '様' };
}

function jstToday() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.toISOString().slice(0, 10);
}

function parseDate(v) {
  const s = Z2H(v).trim();
  const today = jstToday();
  let m = s.match(/^(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})日?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/\-月.](\d{1,2})日?$/);
  if (m) return `${today.slice(0, 4)}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

const KEYS = [
  [/^(宛名|宛先|お客様|客先|御中)[\s:：]*/, 'to'],
  [/^(日付|発行日)[\s:：]*/, 'date'],
  [/^(値引き|値引|お値引き)[\s:：]*/, 'disc'],
  [/^(備考|メモ)[\s:：]*/, 'memo'],
];

// 明細の1行: 「項目 数量単位 単価」/「項目 金額」（1式）/「名称／項目 数量単位 単価」
function parseItem(line) {
  const parts = Z2H(line).trim().split(/\s+/);
  if (parts.length < 2) return null;
  const price = toNumber(parts[parts.length - 1]);
  if (!Number.isFinite(price)) return null;
  let q = 1, u = '式', nameParts = parts.slice(0, -1);
  if (parts.length >= 3) {
    const m = parts[parts.length - 2].match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (m) { q = parseFloat(m[1]); u = m[2] || '式'; nameParts = parts.slice(0, -2); }
  }
  let label = nameParts.join(' ');
  let k = '';
  const sep = label.match(/^(.+?)[\/／](.+)$/);
  if (sep) { k = sep[1].trim(); label = sep[2].trim(); }
  if (!label) return null;
  return { k, n: label, q, u, p: price };
}

export function parseEstimate(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length || !/^見積/.test(lines[0])) return null;
  const head = lines[0].replace(/^見積(もり|書)?/, '').trim();
  const est = { cust: '', hon: '御中', date: jstToday(), disc: 0, memo: '', tax: 10, items: [] };
  const errors = [];
  if (head) Object.assign(est, (({ name, hon }) => ({ cust: name, hon }))(splitName(head)));
  for (const line of lines.slice(1)) {
    let handled = false;
    for (const [re, key] of KEYS) {
      if (re.test(line)) {
        const v = line.replace(re, '').trim();
        if (key === 'to') { const { name, hon } = splitName(v); est.cust = name; est.hon = hon; }
        else if (key === 'date') { const d = parseDate(v); if (d) est.date = d; else errors.push(`日付「${v}」が読み取れません（例：日付 10/21）`); }
        else if (key === 'disc') { const n = toNumber(v); if (Number.isFinite(n)) est.disc = n; else errors.push(`値引き「${v}」が数字ではありません`); }
        else if (key === 'memo') { est.memo = est.memo ? est.memo + '\n' + v : v; }
        handled = true;
        break;
      }
    }
    if (handled) continue;
    if (/^税込(み)?$/.test(line)) { est.tax = 0; continue; }
    const it = parseItem(line);
    if (it) est.items.push(it);
    else errors.push(`「${line}」が読み取れません（例：瑞穂区内装解体工事 1式 3700000）`);
  }
  if (!est.items.length) errors.push('明細が1行もありません（例：瑞穂区内装解体工事 1式 3700000）');
  return { est, errors };
}

export function calc(e) {
  const rows = e.items.map((i) => ({ ...i, a: Math.round(i.q * i.p) }));
  const sub = rows.reduce((s, r) => s + r.a, 0) - (e.disc || 0);
  const rate = (e.tax || 0) / 100;
  const tax = Math.floor(sub * rate);
  return { rows, sub, tax, total: sub + tax, rate };
}

export const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
export const comma = (n) => Math.round(n).toLocaleString('ja-JP');

export const TEMPLATE = `見積
宛名 株式会社〇〇 御中
〇〇区内装解体工事 1式 3700000
ブロック塀撤去 12m 6000
備考 `;

export const HELP = `【見積書の作り方】
1行目に「見積」と書いて、その下に内容を1行ずつ送ってください。

宛名 株式会社〇〇 御中
（「様」「御中」を省くと、会社名なら御中・個人名なら様になります）

明細は「項目 数量単位 単価」
　例）ブロック塀撤去 12m 6000
1式のものは「項目 金額」だけでOK
　例）瑞穂区内装解体工事 3700000
金額は「370万」とも書けます。

ほかに使える行
・日付 10/21（書かなければ今日）
・値引き 50000
・備考 〇〇
・税込（金額が税込のとき。消費税を分けません）

「ひな形」と送ると、コピーして使える文章が届きます。`;
