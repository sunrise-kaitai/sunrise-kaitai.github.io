// ホームページ管理（/line/hp/）の裏側。mitsumori-sheet.gs と同じ Apps Script のプロジェクトに、別ファイルとして入れる。
//
// できること
//   hpSave     … 管理画面で直した文字・写真を GitHub（site-src/content/）に保存する
//   postSave   … ブログ・お知らせを保存する（インスタ・Googleマップへの投稿も予約する）
//   postDelete … 記事を消す
//   snsStatus  … インスタ・Googleマップがつながっているか、最近の投稿の結果
//   GitHub に保存すると、GitHub Actions（.github/workflows/cms-publish.yml）が自動でページを作り直して公開する。
//   使えるのは、メンバー管理で「管理者」になっている人だけ（入口チェックの sid で毎回確かめる）。
//
// スクリプト プロパティ（値はリポジトリに書かない）
//   GITHUB_TOKEN  … GitHub の鍵（このリポジトリの Contents の読み書きだけを許可したもの）
//   IG_TOKEN      … インスタの鍵（Meta の開発者画面で作る）。1週間ごとに自動で延長する
//   IG_USER_ID / IG_NAME             … hpSetup が自動で入れる
//   GBP_LOCATION / GBP_NAME          … hpSetup が自動で入れる（Googleビジネスプロフィールのお店）
//   SNS_QUEUE     … 投稿待ちの一覧（自動）
//
// 一度だけ：エディタで hpSetup を実行 → 実行ログに結果が出る。手順は ops/hp-admin-setup.md

const HP = { repo: 'sunrise-kaitai/sunrise-kaitai.github.io', branch: 'main', site: 'https://sunrise-kaitai.github.io' };
const IG_VER = 'v24.0';
const SNS_SHEET = 'SNS投稿';
const SNS_HEAD = ['日時', '記事', 'インスタ', 'Google', 'ページ'];
const KEY_T = /^t[0-9a-f]{10}(-\d{1,3})?$/;
const KEY_I = /^i[0-9a-f]{10}(-\d{1,3})?$/;
const UP = /^up\/[a-z0-9][a-z0-9-]{0,80}\.(?:jpg|jpeg|webp|png)$/;
const POST_ID = /^[0-9]{8}-[a-z0-9]{2,12}$/;

function hpAdmin_(d) {
  const ss = session_(d.sid);
  return ss && ss.admin ? ss : null;
}

function rand_(n) {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function ymd_(d) { return Utilities.formatDate(d || new Date(), 'Asia/Tokyo', 'yyyyMMdd'); }

/* ---------- GitHub ---------- */

function gh_(method, path, body, accept) {
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + HP.repo + path, {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + prop_('GITHUB_TOKEN'), Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  return { code: r.getResponseCode(), text: r.getContentText(), json: () => JSON.parse(r.getContentText()) };
}

// ref の時点のファイルの中身（ないときは null）
function ghText_(path, ref) {
  const r = gh_('get', '/contents/' + path + '?ref=' + ref, null, 'application/vnd.github.raw+json');
  if (r.code === 404) return null;
  if (r.code !== 200) throw new Error('gh read ' + r.code);
  return r.text;
}

// まとめて1回のコミットにする。build(head) が { パス: {text}|{b64}|null(消す) } を返す。
// ほかの保存と重なったら最新の状態で作り直す（3回まで）
function ghCommit_(message, build) {
  for (let i = 0; i < 3; i++) {
    const ref = gh_('get', '/git/ref/heads/' + HP.branch);
    if (ref.code !== 200) throw new Error('gh ref ' + ref.code);
    const head = ref.json().object.sha;
    const base = gh_('get', '/git/commits/' + head).json().tree.sha;
    const changes = build(head);
    const tree = [];
    Object.keys(changes).forEach((path) => {
      const c = changes[path];
      if (c === null) { tree.push({ path: path, mode: '100644', type: 'blob', sha: null }); return; }
      const b = gh_('post', '/git/blobs', c.b64 != null ? { content: c.b64, encoding: 'base64' } : { content: c.text, encoding: 'utf-8' });
      if (b.code !== 201) throw new Error('gh blob ' + b.code);
      tree.push({ path: path, mode: '100644', type: 'blob', sha: b.json().sha });
    });
    const t = gh_('post', '/git/trees', { base_tree: base, tree: tree });
    if (t.code !== 201) throw new Error('gh tree ' + t.code);
    const c = gh_('post', '/git/commits', { message: message, tree: t.json().sha, parents: [head] });
    if (c.code !== 201) throw new Error('gh commit ' + c.code);
    const u = gh_('patch', '/git/refs/heads/' + HP.branch, { sha: c.json().sha, force: false });
    if (u.code === 200) return c.json().sha;
    if (u.code !== 422) throw new Error('gh ref update ' + u.code);
    Utilities.sleep(1500);
  }
  throw new Error('busy');
}

// 送られてきた写真（dataURL の JPEG/PNG/WebP）を確かめて、保存用に変換
function photos_(list, prefix) {
  const out = [];
  (Array.isArray(list) ? list : []).slice(0, 20).forEach((f, n) => {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String((f && f.data) || ''));
    if (!m) throw new Error('photo');
    if (m[2].length > 8 * 1024 * 1024) throw new Error('big');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    out.push({ name: 'up/' + prefix + '-' + n + rand_(3) + '.' + ext, b64: m[2] });
  });
  return out;
}

function hpErr_(e) {
  const m = String((e && e.message) || e);
  return { ok: false, error: m === 'busy' || m === 'big' || m === 'photo' ? m : 'save' };
}

/* ---------- 文字・写真の書き換え ---------- */

function hpSave_(d) {
  if (!hpAdmin_(d)) return { ok: false, error: 'admin' };
  if (!prop_('GITHUB_TOKEN')) return { ok: false, error: 'nogithub' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    const files = photos_(d.files, ymd_() + '-p');
    const rev = new Date().toISOString() + '-' + rand_(4);
    ghCommit_('管理画面：ページの文字・写真を更新', (head) => {
      const now = JSON.parse(ghText_('site-src/content/edits.json', head) || '{}');
      const e = { t: now.t || {}, i: now.i || {}, rev: rev };
      Object.keys(d.t || {}).slice(0, 500).forEach((k) => {
        if (!KEY_T.test(k)) return;
        const v = d.t[k];
        if (v === null) { delete e.t[k]; return; }
        if (!Array.isArray(v) || v.length > 60) return;
        e.t[k] = v.map((x) => String(x == null ? '' : x).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 5000));
      });
      Object.keys(d.i || {}).slice(0, 200).forEach((k) => {
        if (!KEY_I.test(k)) return;
        const v = d.i[k];
        if (v === null) { delete e.i[k]; return; }
        const m = /^#(\d+)$/.exec(String(v));
        if (m && files[Number(m[1])]) e.i[k] = files[Number(m[1])].name;
      });
      const ch = { 'site-src/content/edits.json': { text: JSON.stringify(e, null, 1) + '\n' } };
      files.forEach((f) => { ch['site-src/content/uploads/' + f.name.slice(3)] = { b64: f.b64 }; });
      return ch;
    });
    return { ok: true, rev: rev };
  } catch (e) {
    return hpErr_(e);
  } finally {
    lock.releaseLock();
  }
}

/* ---------- ブログ・お知らせ ---------- */

function postSave_(d) {
  if (!hpAdmin_(d)) return { ok: false, error: 'admin' };
  if (!prop_('GITHUB_TOKEN')) return { ok: false, error: 'nogithub' };
  const p = d.post || {};
  const isNew = !p.id;
  if (!isNew && !POST_ID.test(String(p.id))) return { ok: false, error: 'bad' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) return { ok: false, error: 'bad' };
  const title = String(p.title || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  if (!title) return { ok: false, error: 'bad' };
  const id = isNew ? ymd_() + '-' + rand_(6) : String(p.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    const files = photos_(d.files, id);
    const igFiles = d.sns && d.sns.ig ? photos_(d.ig, id + '-ig') : [];
    const photos = [];
    (Array.isArray(p.photos) ? p.photos : []).slice(0, 10).forEach((x) => {
      x = String(x);
      const m = /^#(\d+)$/.exec(x);
      if (m && files[Number(m[1])]) photos.push(files[Number(m[1])].name);
      else if (UP.test(x)) photos.push(x);
    });
    const rev = new Date().toISOString() + '-' + rand_(4);
    const post = {
      id: id, date: String(p.date), cat: p.cat === 'news' ? 'news' : 'blog', title: title,
      body: String(p.body || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 20000),
      photos: photos, rev: rev,
    };
    ghCommit_((isNew ? '管理画面：記事を公開「' : '管理画面：記事を更新「') + title.slice(0, 40) + '」', (head) => {
      if (!isNew && ghText_('site-src/content/posts/' + id + '.json', head) === null) throw new Error('bad');
      const ch = {};
      ch['site-src/content/posts/' + id + '.json'] = { text: JSON.stringify(post, null, 1) + '\n' };
      files.concat(igFiles).forEach((f) => { ch['site-src/content/uploads/' + f.name.slice(3)] = { b64: f.b64 }; });
      return ch;
    });
    // インスタ・Googleマップは、ホームページに出たのを確かめてから投稿する（写真のURLが開けないと投稿できないため）
    if (isNew && d.sns && (d.sns.ig || d.sns.gbp)) {
      const text = String(d.sns.text || title).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 1400);
      const q = queue_();
      q.push({
        id: id, rev: rev, title: title, text: text, at: Date.now(), url: HP.site + '/blog/' + id,
        photo: photos[0] ? HP.site + '/img/' + photos[0] : '',
        ig: igFiles.map((f) => HP.site + '/img/' + f.name),
        wantIg: !!d.sns.ig && igFiles.length > 0, wantGbp: !!d.sns.gbp,
      });
      PropertiesService.getScriptProperties().setProperty('SNS_QUEUE', JSON.stringify(q.slice(-20)));
      ensureTriggers_();
    }
    return { ok: true, id: id, rev: rev, photos: photos };
  } catch (e) {
    return hpErr_(e);
  } finally {
    lock.releaseLock();
  }
}

function postDelete_(d) {
  if (!hpAdmin_(d)) return { ok: false, error: 'admin' };
  if (!prop_('GITHUB_TOKEN')) return { ok: false, error: 'nogithub' };
  const id = String(d.id || '');
  if (!POST_ID.test(id)) return { ok: false, error: 'bad' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    ghCommit_('管理画面：記事を削除 ' + id, (head) => {
      if (ghText_('site-src/content/posts/' + id + '.json', head) === null) return {};
      const ch = {};
      ch['site-src/content/posts/' + id + '.json'] = null;
      return ch;
    });
    return { ok: true };
  } catch (e) {
    return hpErr_(e);
  } finally {
    lock.releaseLock();
  }
}

/* ---------- インスタ・Googleマップ ---------- */

function queue_() {
  try { return JSON.parse(prop_('SNS_QUEUE') || '[]'); } catch (e) { return []; }
}

function snsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SNS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SNS_SHEET);
    sh.getRange(1, 1, 1, SNS_HEAD.length).setValues([SNS_HEAD]).setFontWeight('bold').setBackground('#111111').setFontColor('#FF6A1A');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 140); sh.setColumnWidth(2, 260); sh.setColumnWidths(3, 2, 200); sh.setColumnWidth(5, 300);
    sh.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm');
  }
  return sh;
}

function snsStatus_(d) {
  if (!hpAdmin_(d)) return { ok: false, error: 'admin' };
  const igOn = !!(prop_('IG_TOKEN') && prop_('IG_USER_ID'));
  const gbOn = !!prop_('GBP_LOCATION');
  const sh = snsSheet_();
  const n = Math.min(10, sh.getLastRow() - 1);
  const rows = n > 0 ? sh.getRange(sh.getLastRow() - n + 1, 1, n, SNS_HEAD.length).getValues().reverse() : [];
  const fmt = (v) => (v instanceof Date ? Utilities.formatDate(v, 'Asia/Tokyo', 'M/d HH:mm') : String(v));
  const log = queue_().reverse().map((q) => ({ at: '投稿待ち（ホームページに出たら投稿します）', title: q.title, ig: q.wantIg ? '待ち' : '', gbp: q.wantGbp ? '待ち' : '' }))
    .concat(rows.map((r) => ({ at: fmt(r[0]), title: String(r[1]).replace(/^'/, ''), ig: String(r[2]), gbp: String(r[3]) })));
  return {
    ok: true,
    ig: { on: igOn, name: prop_('IG_NAME'), note: igOn ? '' : '設定の手順書の「インスタ」をすると使えます。' },
    gbp: { on: gbOn, name: prop_('GBP_NAME'), note: gbOn ? '' : 'Google の利用申請が通ったあと、設定の手順書の「Googleマップ」をすると使えます。' },
    log: log,
  };
}

// 5分ごとに動く：ホームページに出た記事を、インスタ・Googleマップに投稿する
function snsWorker() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const q = queue_();
    if (!q.length) return;
    const rest = [];
    q.forEach((item) => {
      const live = isLive_(item);
      if (!live) {
        if (Date.now() - item.at < 2 * 60 * 60 * 1000) rest.push(item);
        else snsLog_(item, item.wantIg ? 'できませんでした（ホームページに出ませんでした）' : '', item.wantGbp ? 'できませんでした（ホームページに出ませんでした）' : '');
        return;
      }
      let ig = '', gb = '';
      if (item.wantIg) { try { ig = igPost_(item); } catch (e) { ig = 'できませんでした：' + String(e.message || e).slice(0, 200); } }
      if (item.wantGbp) { try { gb = gbpPost_(item); } catch (e) { gb = 'できませんでした：' + String(e.message || e).slice(0, 200); } }
      snsLog_(item, ig, gb);
    });
    PropertiesService.getScriptProperties().setProperty('SNS_QUEUE', JSON.stringify(rest));
  } finally {
    lock.releaseLock();
  }
}

function isLive_(item) {
  const r = UrlFetchApp.fetch(HP.site + '/blog/posts.json?t=' + Date.now(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return false;
  let list = [];
  try { list = JSON.parse(r.getContentText()); } catch (e) { return false; }
  if (!list.some((p) => p.id === item.id && p.rev === item.rev)) return false;
  const img = item.ig[0] || item.photo;
  return !img || UrlFetchApp.fetch(img, { muteHttpExceptions: true }).getResponseCode() === 200;
}

function snsLog_(item, ig, gb) {
  snsSheet_().appendRow([new Date(), s_(item.title, 200), s_(ig, 300), s_(gb, 300), item.url]);
}

function igCall_(method, url, params) {
  params = Object.assign({}, params, { access_token: prop_('IG_TOKEN') });
  let r;
  if (method === 'post') r = UrlFetchApp.fetch(url, { method: 'post', payload: params, muteHttpExceptions: true });
  else r = UrlFetchApp.fetch(url + '?' + Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&'), { muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || j.error) throw new Error((j.error && j.error.message) || ('instagram ' + r.getResponseCode()));
  return j;
}

function igPost_(item) {
  const uid = prop_('IG_USER_ID');
  if (!prop_('IG_TOKEN') || !uid) return 'つながっていません';
  const base = 'https://graph.instagram.com/' + IG_VER + '/';
  let creation;
  if (item.ig.length === 1) {
    creation = igCall_('post', base + uid + '/media', { image_url: item.ig[0], caption: item.text }).id;
  } else {
    const kids = item.ig.slice(0, 10).map((u) => igCall_('post', base + uid + '/media', { image_url: u, is_carousel_item: 'true' }).id);
    kids.forEach((k) => igWait_(base, k));
    creation = igCall_('post', base + uid + '/media', { media_type: 'CAROUSEL', children: kids.join(','), caption: item.text }).id;
  }
  igWait_(base, creation);
  igCall_('post', base + uid + '/media_publish', { creation_id: creation });
  return '投稿しました';
}

function igWait_(base, id) {
  for (let i = 0; i < 15; i++) {
    const s = igCall_('get', base + id, { fields: 'status_code' }).status_code;
    if (s === 'FINISHED' || !s) return;
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error('写真の準備に失敗しました（' + s + '）');
    Utilities.sleep(3000);
  }
}

function gbpPost_(item) {
  const loc = prop_('GBP_LOCATION');
  if (!loc) return 'つながっていません';
  const body = {
    languageCode: 'ja', topicType: 'STANDARD', summary: item.text.slice(0, 1500),
    callToAction: { actionType: 'LEARN_MORE', url: item.url },
  };
  if (item.photo) body.media = [{ mediaFormat: 'PHOTO', sourceUrl: item.photo }];
  const r = UrlFetchApp.fetch('https://mybusiness.googleapis.com/v4/' + loc + '/localPosts', {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
  });
  if (r.getResponseCode() !== 200) {
    let m = '';
    try { m = JSON.parse(r.getContentText()).error.message; } catch (e) {}
    throw new Error(m || ('google ' + r.getResponseCode()));
  }
  return '投稿しました';
}

// インスタの鍵は60日で切れるので、1週間ごとに延長する
function igRefresh() {
  const tok = prop_('IG_TOKEN');
  if (!tok) return;
  const r = UrlFetchApp.fetch('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' + encodeURIComponent(tok), { muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText() || '{}');
  if (j.access_token) PropertiesService.getScriptProperties().setProperty('IG_TOKEN', j.access_token);
}

function ensureTriggers_() {
  const have = ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction());
  if (have.indexOf('snsWorker') < 0) ScriptApp.newTrigger('snsWorker').timeBased().everyMinutes(5).create();
  if (have.indexOf('igRefresh') < 0) ScriptApp.newTrigger('igRefresh').timeBased().everyDays(7).atHour(4).create();
}

/* ---------- 一度だけ実行する設定 ---------- */
// エディタで hpSetup を選んで「実行」。結果は「実行ログ」に日本語で出る。何度実行しても大丈夫。
function hpSetup() {
  const props = PropertiesService.getScriptProperties();
  const say = (t) => Logger.log(t);
  // 1. GitHub
  if (!prop_('GITHUB_TOKEN')) say('× GitHub：スクリプト プロパティ GITHUB_TOKEN がまだです。');
  else {
    const r = gh_('get', '');
    say(r.code === 200 && r.json().permissions && r.json().permissions.push
      ? '○ GitHub：つながりました（' + HP.repo + ' に保存できます）'
      : '× GitHub：鍵が正しくないか、書き込みの許可がありません（' + r.code + '）');
  }
  // 2. インスタ
  if (!prop_('IG_TOKEN')) say('－ インスタ：IG_TOKEN がまだです（あとで大丈夫）。');
  else {
    try {
      const me = igCall_('get', 'https://graph.instagram.com/' + IG_VER + '/me', { fields: 'user_id,username' });
      props.setProperty('IG_USER_ID', String(me.user_id || me.id));
      props.setProperty('IG_NAME', '@' + me.username);
      igRefresh();
      say('○ インスタ：つながりました（@' + me.username + '）');
    } catch (e) { say('× インスタ：' + e.message); }
  }
  // 3. Googleビジネスプロフィール
  try {
    const h = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
    const a = UrlFetchApp.fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', h);
    if (a.getResponseCode() !== 200) throw new Error('アカウントを読めません（' + a.getResponseCode() + '）。Google の利用申請が通っているか、プロジェクトの設定を確かめてください。');
    const accounts = JSON.parse(a.getContentText()).accounts || [];
    let found = null;
    accounts.forEach((acc) => {
      if (found) return;
      const l = UrlFetchApp.fetch('https://mybusinessbusinessinformation.googleapis.com/v1/' + acc.name + '/locations?readMask=name,title&pageSize=100', h);
      const locs = (JSON.parse(l.getContentText()).locations || []);
      const hit = locs.filter((x) => /sunrise/i.test(x.title))[0] || (locs.length === 1 ? locs[0] : null);
      if (hit) found = { path: acc.name + '/' + hit.name, title: hit.title };
    });
    if (!found) throw new Error('お店（ビジネスプロフィール）が見つかりません。');
    props.setProperty('GBP_LOCATION', found.path);
    props.setProperty('GBP_NAME', found.title);
    say('○ Googleマップ：つながりました（' + found.title + '）');
  } catch (e) { say('－ Googleマップ：' + e.message + '（申請が通るまでは、このままで大丈夫）'); }
  ensureTriggers_();
  snsSheet_();
  say('○ 自動投稿の見回り（5分ごと）と、インスタの鍵の延長（週1回）を設定しました。');
}
