/* 入口チェック（公式LINEのメニューから開くページ共通）
   1. LINEのログイン（LIFF）で本人を確かめる
   2. 名簿（スプレッドシート「メンバー」）で「許可」の人だけ中へ。初めての人は「承認待ち」
   3. 開いているあいだ1分ごとに名簿を見直す。「停止」になったらその場で閉じる
   使い方：SunriseGate.start({page:'mitsumori', onAllowed(res){…}, onBlocked(){…}})
   ※ 画面を隠すのは見た目のため。本当に大事な物（会社情報の鍵・保存）は、Apps Script が許可を確かめてから渡す。 */
(function () {
  'use strict';
  var CFG = window.SUNRISE_LINE || {};
  var state = { sid: '', page: '', timer: 0, waitTimer: 0, opts: null, running: false };

  /* ---------- 画面（確認中・承認待ち・停止） ---------- */
  var CSS = '' +
    '.sg{position:fixed;inset:0;z-index:2147483000;background:#0b0b0c;color:#fff;display:flex;align-items:center;justify-content:center;' +
    'padding:24px 16px;font-family:"BIZ UDPGothic","Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif;word-break:auto-phrase;line-break:strict}' +
    '.sg[hidden]{display:none!important}' +
    '.sg-box{width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}' +
    '.sg-tag{font-size:12px;font-weight:700;letter-spacing:.2em;color:#ff6a1a}' +
    '.sg-who{display:flex;align-items:center;gap:10px;background:#1a1a1c;border:1px solid #2c2c30;border-radius:999px;padding:6px 16px 6px 6px;max-width:100%}' +
    '.sg-who img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#333;flex:none}' +
    '.sg-who b{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.sg-h{font-size:28px;font-weight:700;line-height:1.35;margin:0}' +
    '.sg-p{font-size:16px;line-height:1.7;color:#d4d4d8;margin:0;white-space:pre-line}' +
    '.sg-btn{appearance:none;border:0;border-radius:10px;background:#ff6a1a;color:#111;font:inherit;font-size:17px;font-weight:700;padding:14px 22px;width:100%;cursor:pointer}' +
    '.sg-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '.sg-spin{width:40px;height:40px;border-radius:50%;border:4px solid #333;border-top-color:#ff6a1a;animation:sgspin .8s linear infinite}' +
    '.sg-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff6a1a;margin-right:6px;animation:sgblink 1.4s ease-in-out infinite}' +
    '@keyframes sgspin{to{transform:rotate(360deg)}}@keyframes sgblink{50%{opacity:.25}}' +
    '@media (prefers-reduced-motion:reduce){.sg-spin,.sg-dot{animation:none}}';

  var el = null;
  function ensureEl() {
    if (el) return el;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    el = document.createElement('div');
    el.className = 'sg';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-live', 'polite');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }
  function show(o) {
    var box = document.createElement('div');
    box.className = 'sg-box';
    var add = function (tag, cls, text) { var n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; box.appendChild(n); return n; };
    add('div', 'sg-tag', 'SUNRISE ／ 公式LINE');
    if (o.spin) add('div', 'sg-spin');
    if (o.who && o.who.name) {
      var w = add('div', 'sg-who');
      if (o.who.pic) { var im = document.createElement('img'); im.alt = ''; im.src = o.who.pic; im.referrerPolicy = 'no-referrer'; w.appendChild(im); }
      var b = document.createElement('b'); b.textContent = o.who.name; w.appendChild(b);
    }
    var h = add('h1', 'sg-h', o.title);
    if (o.waiting) { var d = document.createElement('span'); d.className = 'sg-dot'; d.setAttribute('aria-hidden', 'true'); h.insertBefore(d, h.firstChild); }
    if (o.text) add('p', 'sg-p', o.text);
    if (o.button) { var bt = add('button', 'sg-btn', o.button.label); bt.type = 'button'; bt.addEventListener('click', o.button.go); }
    var root = ensureEl();
    root.replaceChildren(box);
    root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  }
  // 管理者がメニューから開いたときだけ、右下に「メンバー管理」へのボタンを出す（公式LINEから管理画面へ行けるように）
  function adminButton() {
    if (document.getElementById('sg-admin')) return;
    var st = document.createElement('style');
    st.textContent = '#sg-admin{display:inline-block;flex:none;' +
      'background:#111;color:#ff6a1a;border:2px solid #ff6a1a;border-radius:999px;padding:7px 14px;font:700 14px/1.2 "BIZ UDPGothic","Hiragino Sans",sans-serif;text-decoration:none;}' +
      '#sg-admin:focus-visible{outline:3px solid #fff;outline-offset:2px}@media print{#sg-admin{display:none}}';
    document.head.appendChild(st);
    var a = document.createElement('a');
    a.id = 'sg-admin';
    a.href = '../kanri/';
    a.textContent = 'メンバー管理';
    a.setAttribute('data-html2canvas-ignore', 'true');
    // ページの見出しの並びに入れる（見出しがないページは右上に置く）
    var head = document.querySelector('header.top');
    if (head) head.appendChild(a);
    else { a.style.position = 'fixed'; a.style.right = '12px'; a.style.top = '10px'; a.style.zIndex = '2147482000'; document.body.appendChild(a); }
  }
  function hide() { if (el) el.hidden = true; document.documentElement.style.overflow = ''; }

  /* ---------- Apps Script とのやりとり ---------- */
  function call(body) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, 20000);
    return fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { return r.json(); })
      .finally(function () { clearTimeout(t); });
  }

  function retryButton() { return { label: 'もう一度ためす', go: function () { run(); } }; }

  /* ---------- 本体 ---------- */
  function run(quiet) {
    var o = state.opts;
    clearTimeout(state.waitTimer);
    if (quiet !== true) show({ spin: true, title: 'LINEで確認しています', text: 'すこしお待ちください。' });
    var liff = window.liff;
    if (!liff) { show({ title: 'うまく開けませんでした。', text: '通信の状態を確かめて、もう一度ためしてください。', button: retryButton() }); return; }
    liff.init({ liffId: CFG.liffId }).then(function () {
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href.split('#')[0] }); return null; }
      var tok = liff.getIDToken();
      if (!tok) throw new Error('notoken');
      return call({ action: 'gate', idToken: tok, page: o.page });
    }).then(function (res) {
      if (!res) return;
      handle(res);
    }).catch(function () {
      if (quiet === true) { state.waitTimer = setTimeout(function () { run(true); }, 15000); return; }
      show({ title: 'つながりませんでした。', text: '電波のよい所で、もう一度ためしてください。', button: retryButton() });
    });
  }

  function handle(res) {
    var o = state.opts;
    var who = { name: res.name, pic: res.pic };
    if (!res.ok) {
      if (res.error === 'token' && window.liff && !window.liff.isInClient()) {
        // ログインの期限切れ。LINEのブラウザ以外ならログインし直す
        try { window.liff.logout(); } catch (e) {}
        window.liff.login({ redirectUri: location.href.split('#')[0] });
        return;
      }
      show({ title: 'うまく確認できませんでした。', text: '公式LINEのメニューから、開き直してください。', button: retryButton() });
      return;
    }
    if (res.status === '許可') {
      state.sid = res.sid || '';
      try { sessionStorage.setItem('sg_sid', state.sid); } catch (e) {}
      hide();
      startPing();
      if (res.admin && o.page !== 'kanri') adminButton();
      if (o.onAllowed) o.onAllowed(res);
      return;
    }
    stopPing();
    if (res.status === '承認待ち') {
      show({ who: who, waiting: true, title: '許可待ちです。', text: '松浦が「許可」を押すと、使えるようになります。\nこの画面のままでも、許可されたら自動で開きます。', button: { label: 'いま確かめる', go: function () { run(); } } });
      // 15秒ごとに見直す（ずっと開きっぱなしにならないよう20分まで）
      var started = state.waitStart || (state.waitStart = Date.now());
      if (Date.now() - started < 20 * 60 * 1000) state.waitTimer = setTimeout(function () { run(true); }, 15000);
      return;
    }
    if (res.status === '管理者のみ') {
      show({ who: who, title: 'この画面は、管理者だけが開けます。', text: '必要なときは、松浦に連絡してください。' });
      return;
    }
    // 停止（ほかの値も念のため停止あつかい）
    blocked(who);
  }

  function blocked(who) {
    var o = state.opts;
    stopPing();
    state.sid = '';
    try { sessionStorage.removeItem('sg_sid'); } catch (e) {}
    if (o && o.onBlocked) { try { o.onBlocked(); } catch (e) {} }
    show({ who: who, title: 'このアカウントでは使えません。', text: '必要なときは、松浦に連絡してください。' });
  }

  /* ---------- 開いているあいだの見直し（1分ごと） ---------- */
  function ping() {
    if (!state.sid || document.visibilityState !== 'visible') return;
    call({ action: 'ping', sid: state.sid, page: state.page }).then(function (r) {
      if (!r) return;
      if (r.ok && r.status === '許可') return;
      if (r.ok) { blocked(); return; }
      if (r.error === 'expired') run(); // 6時間たった・名簿から消された → 確認し直す
    }).catch(function () {});
  }
  function startPing() {
    stopPing();
    state.timer = setInterval(ping, 60000);
  }
  function stopPing() { clearInterval(state.timer); state.timer = 0; }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && state.sid) ping(); });

  window.SunriseGate = {
    /* liffId が空なら入口チェックなし（今までどおり） */
    enabled: function () { return !!CFG.liffId; },
    start: function (opts) {
      state.opts = opts || {};
      state.page = state.opts.page || '';
      if (!CFG.liffId) { if (state.opts.onAllowed) state.opts.onAllowed({ ok: true, gate: false, status: '許可' }); return; }
      run();
    },
    sid: function () { return state.sid; },
    call: call
  };
})();
