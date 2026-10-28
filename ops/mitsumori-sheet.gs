// sunrise 公式LINE（sunriseサーバー用）の裏側。スプレッドシート「sunrise 見積書一覧」に入っている Apps Script。
//
// 1. 入口チェック（ログイン管理）
//    公式LINEのメニューから開いたページは、LINEのログイン（LIFF）で本人確認してから使う。
//    初めての人は「承認待ち」。松浦様が管理画面（/line/kanri/）で「許可」を押すと使えるようになり、「停止」を押すと次の操作から使えなくなる。
//    名簿はこのスプレッドシートの「メンバー」シート。
// 2. 見積書の記録
//    見積書メーカー（/line/mitsumori/）の「保存」「PDF」「画像」を押すたびに「見積書一覧」シートに1行足す。
//
// スクリプト プロパティ（値はリポジトリに書かない）
//   LOGIN_CHANNEL_ID … LINE Login チャネルのチャネルID。入れると入口チェックが動き、許可された人しか保存できなくなる。
//   SECURE_KEY       … 見積書メーカーの会社情報（secure.json）を開く鍵。許可された人にだけ渡す。
//   SAVE_TOKEN       … 入口チェックを入れる前の合言葉（LOGIN_CHANNEL_ID が空のあいだだけ使う）。
//   OWNER_ID         … 管理者（松浦様）のLINEのID。最初に管理画面を開いた人が自動で入る。
//
// 一度だけ：エディタで setup を実行 → 「デプロイを管理」で新しいバージョンを公開（URLは変わらない）。

const SHEET = '見積書一覧';
const HEAD = ['保存日時', '操作', '見積番号', '発行日', 'お客様名', '敬称', '項目', '小計', '消費税', '合計', '値引き', '備考', '明細（全部）', 'ID'];
const MEMBER_SHEET = 'メンバー';
const MEMBER_HEAD = ['LINEのID', '名前', 'アイコン', '状態', '最初に開いた日時', '最後に使った日時', '使っていたページ', '管理者', 'メモ'];
const M = { id: 0, name: 1, pic: 2, status: 3, first: 4, last: 5, page: 6, admin: 7, memo: 8 };
const STATUSES = ['許可', '承認待ち', '停止'];
const PAGES = { mitsumori: '見積書作成', threads: 'スレッズ投稿', kanri: '管理画面' };
const SESSION_SEC = 6 * 60 * 60; // 1回の確認で使える時間（6時間。過ぎたら自動で確認し直す）

const out_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const prop_ = (k) => PropertiesService.getScriptProperties().getProperty(k) || '';

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) sh = ss.insertSheet(SHEET, 0);
  const now = sh.getRange(1, 1, 1, HEAD.length).getValues()[0];
  if (now.join('|') !== HEAD.join('|')) {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#17263D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, HEAD.length, 110);
    sh.setColumnWidth(1, 150); sh.setColumnWidth(5, 200); sh.setColumnWidth(7, 260); sh.setColumnWidth(12, 220); sh.setColumnWidth(13, 360);
    sh.getRange('H:K').setNumberFormat('#,##0');
    sh.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm');
  }
  return sh;
}

function memberSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(MEMBER_SHEET);
  if (!sh) sh = ss.insertSheet(MEMBER_SHEET);
  const now = sh.getRange(1, 1, 1, MEMBER_HEAD.length).getValues()[0];
  if (now.join('|') !== MEMBER_HEAD.join('|')) {
    sh.getRange(1, 1, 1, MEMBER_HEAD.length).setValues([MEMBER_HEAD]).setFontWeight('bold').setBackground('#111111').setFontColor('#FF6A1A');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, MEMBER_HEAD.length, 130);
    sh.setColumnWidth(1, 280); sh.setColumnWidth(3, 200); sh.setColumnWidth(9, 220);
    sh.getRange('E:F').setNumberFormat('yyyy/mm/dd hh:mm');
    // 状態の列は「許可・承認待ち・停止」から選ぶだけにする（シートで直接直しても大丈夫）
    sh.getRange(2, M.status + 1, 1000, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  }
  return sh;
}

// 文字は数式として入らないようにする（= + - @ などで始まると、シートを開いたときに数式が動いてしまうため）
function s_(v, n) {
  const t = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n || 500);
  return /^[=+\-@\t\r\n＝＋－＠]/.test(t) ? "'" + t : t;
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case 'gate': return out_(gate_(d));
      case 'ping': return out_(ping_(d));
      case 'members': return out_(members_(d));
      case 'setStatus': return out_(setStatus_(d));
      default: return out_(save_(d));
    }
  } catch (err) {
    return out_({ ok: false, error: 'bad' });
  }
}

/* ---------- 入口チェック ---------- */

// LINEのログインで受け取った「本人の証明書（IDトークン）」をLINEに問い合わせて、本物か確かめる
function verifyIdToken_(idToken) {
  const channel = prop_('LOGIN_CHANNEL_ID');
  if (!channel || !idToken) return null;
  const r = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post', payload: { id_token: String(idToken), client_id: channel }, muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) return null;
  const j = JSON.parse(r.getContentText());
  if (!j.sub || String(j.aud) !== channel || j.iss !== 'https://access.line.me') return null;
  return { id: String(j.sub), name: String(j.name || ''), pic: String(j.picture || '') };
}

function findMember_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return null;
  const vals = sh.getRange(2, 1, n, MEMBER_HEAD.length).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][M.id]) === id) return { row: i + 2, v: vals[i] };
  return null;
}

function isAdmin_(m) {
  return !!m && (String(m.v[M.id]) === prop_('OWNER_ID') || m.v[M.admin] === '管理者');
}

function gate_(d) {
  if (!prop_('LOGIN_CHANNEL_ID')) return { ok: false, error: 'off' };
  // 送りすぎ防止：10分間に300回まで
  const cache = CacheService.getScriptCache();
  const bucket = 'g' + Math.floor(Date.now() / 600000);
  const cnt = Number(cache.get(bucket) || 0);
  if (cnt >= 300) return { ok: false, error: 'busy' };
  cache.put(bucket, String(cnt + 1), 700);

  const u = verifyIdToken_(d.idToken);
  if (!u) return { ok: false, error: 'token' };
  const page = PAGES[d.page] ? d.page : 'mitsumori';
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let m;
  try {
    const sh = memberSheet_();
    m = findMember_(sh, u.id);
    const now = new Date();
    if (!m) {
      // 管理者がまだいないときは、最初に管理画面を開いた人を管理者にする（松浦様が最初に開く）
      const owner = !prop_('OWNER_ID') && page === 'kanri';
      if (owner) props.setProperty('OWNER_ID', u.id);
      sh.appendRow([u.id, s_(u.name, 100), s_(u.pic, 300), owner ? '許可' : '承認待ち', now, now, PAGES[page], owner ? '管理者' : '', '']);
      m = findMember_(sh, u.id);
    } else {
      // 名前とアイコンはLINEで変えたら追いかける。最後に使った日時とページを更新
      sh.getRange(m.row, M.name + 1, 1, 2).setValues([[s_(u.name, 100), s_(u.pic, 300)]]);
      sh.getRange(m.row, M.last + 1, 1, 2).setValues([[now, PAGES[page]]]);
      m.v[M.name] = u.name;
    }
  } finally {
    lock.releaseLock();
  }
  const admin = isAdmin_(m);
  // 管理者は「停止」にできない（自分を締め出さないように）
  const status = admin ? '許可' : String(m.v[M.status] || '承認待ち');
  const res = { ok: true, status, name: u.name, pic: u.pic, admin };
  if (status === '許可') {
    if (page === 'kanri' && !admin) return { ok: true, status: '管理者のみ', name: u.name, pic: u.pic, admin: false };
    const sid = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
    cache.put('sid:' + sid, u.id, SESSION_SEC);
    res.sid = sid;
    if (page === 'mitsumori') res.key = prop_('SECURE_KEY');
  }
  return res;
}

// 確認済みのしるし（sid）から、今の名簿の状態を引く。停止されていたらここで止まる
function session_(sid) {
  if (!sid) return null;
  const id = CacheService.getScriptCache().get('sid:' + String(sid).slice(0, 80));
  if (!id) return null;
  const sh = memberSheet_();
  const m = findMember_(sh, id);
  if (!m) return null;
  const admin = isAdmin_(m);
  return { sh, m, id, admin, status: admin ? '許可' : String(m.v[M.status] || '承認待ち') };
}

// ページを開いているあいだ1分ごとに届く。「使用中」の表示と、停止された人をすぐ止めるため
function ping_(d) {
  const ss = session_(d.sid);
  if (!ss) return { ok: false, error: 'expired' };
  const cache = CacheService.getScriptCache();
  if (!cache.get('seen:' + ss.id)) {
    const page = PAGES[d.page] || ss.m.v[M.page];
    ss.sh.getRange(ss.m.row, M.last + 1, 1, 2).setValues([[new Date(), page]]);
    cache.put('seen:' + ss.id, '1', 50);
  }
  return { ok: true, status: ss.status };
}

function members_(d) {
  const ss = session_(d.sid);
  if (!ss || !ss.admin) return { ok: false, error: 'admin' };
  const sh = ss.sh;
  const n = sh.getLastRow() - 1;
  const vals = n > 0 ? sh.getRange(2, 1, n, MEMBER_HEAD.length).getValues() : [];
  const owner = prop_('OWNER_ID');
  const t = (v) => (v instanceof Date ? v.getTime() : 0);
  return {
    ok: true, now: Date.now(), me: ss.id,
    members: vals.filter((v) => v[M.id]).map((v) => ({
      id: String(v[M.id]), name: String(v[M.name]).replace(/^'/, ''), pic: String(v[M.pic]).replace(/^'/, ''),
      status: String(v[M.status] || '承認待ち'), first: t(v[M.first]), last: t(v[M.last]),
      page: String(v[M.page]), admin: String(v[M.id]) === owner || v[M.admin] === '管理者', memo: String(v[M.memo]),
    })),
  };
}

function setStatus_(d) {
  const ss = session_(d.sid);
  if (!ss || !ss.admin) return { ok: false, error: 'admin' };
  if (STATUSES.indexOf(d.status) < 0) return { ok: false, error: 'bad' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const m = findMember_(ss.sh, String(d.id || ''));
    if (!m) return { ok: false, error: 'none' };
    if (isAdmin_(m)) return { ok: false, error: 'owner' };
    ss.sh.getRange(m.row, M.status + 1).setValue(d.status);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 見積書の記録 ---------- */

function allowedToSave_(d) {
  // 入口チェックが動いているときは、今も「許可」の人だけ。止めた人が手元に合言葉を持っていても保存できない
  if (prop_('LOGIN_CHANNEL_ID')) {
    const ss = session_(d.sid);
    return !!ss && ss.status === '許可';
  }
  const token = prop_('SAVE_TOKEN');
  return !!token && d.token === token;
}

function save_(d) {
  if (!allowedToSave_(d)) return { ok: false, error: 'token' };
  // 同じ押し方（同じ見積書・同じ操作・同じ時刻）が2回届いたら、2回目は記録しない
  const key = [d.id, d.action, d.at].join('|').slice(0, 240);
  const cache = CacheService.getScriptCache();
  // 送りすぎ防止：10分間に120回を超えたら受け付けない（いたずらでシートが埋まらないように）
  const bucket = 'n' + Math.floor(Date.now() / 600000);
  const n = Number(cache.get(bucket) || 0);
  if (n >= 120) return { ok: false, error: 'busy' };
  cache.put(bucket, String(n + 1), 700);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (d.at && cache.get(key)) return { ok: true, row: null, dup: true };
    const sh = sheet_();
    const ACTIONS = ['保存', 'PDF', '画像', '自動保存'];
    d.action = ACTIONS.indexOf(String(d.action)) >= 0 ? d.action : '保存';
    const items = Array.isArray(d.items) ? d.items.slice(0, 50) : [];
    const lines = items.map((i) => [s_(i.k, 50), s_(i.n, 100), s_(i.q, 20) + s_(i.u, 10), Number(i.p) || 0, Number(i.a) || 0].join(' / '));
    const row = [
      new Date(), s_(d.action, 10) || '保存', s_(d.no, 40), s_(d.date, 20), s_(d.cust, 100), s_(d.hon, 10),
      items.map((i) => s_(i.n, 100)).filter(String).join('、'),
      Number(d.sub) || 0, Number(d.tax) || 0, Number(d.total) || 0, Number(d.disc) || 0,
      s_(d.memo, 1000), lines.join('\n'), s_(d.id, 40),
    ];
    sh.appendRow(row);
    if (d.at) cache.put(key, '1', 600);
    return { ok: true, row: sh.getLastRow() };
  } finally {
    lock.releaseLock();
  }
}

// シートの見出しを作る・直す（合言葉や鍵はスクリプト プロパティに入れる）
// LINEへの問い合わせ（UrlFetchApp）を使うので、初回はここで許可の画面が出る。
function setup() {
  sheet_();
  memberSheet_();
  UrlFetchApp.fetch('https://api.line.me/', { muteHttpExceptions: true });
}
