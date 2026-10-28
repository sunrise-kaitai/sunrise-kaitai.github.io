/* メンバー管理（松浦様専用）
   誰が使っているか（使用中・最後に使った日時・ページ）を一覧で見て、「許可」「停止」を押す。
   名簿の中身は Apps Script が管理者だと確かめたときだけ返す。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LIVE_MS = 3 * 60 * 1000; // 最後の合図から3分以内なら「使用中」（開いているあいだ1分ごとに届く）
  var members = [];
  var serverGap = 0; // スマホの時計のずれ
  var asking = '';
  var timer = 0;

  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function now() { return Date.now() + serverGap; }
  function isLive(m) { return m.status === '許可' && m.last && now() - m.last < LIVE_MS; }
  function ago(t) {
    if (!t) return '';
    var s = Math.max(0, Math.round((now() - t) / 1000));
    if (s < 60) return 'たった今';
    var mi = Math.round(s / 60); if (mi < 60) return mi + '分前';
    var h = Math.round(mi / 60); if (h < 24) return h + '時間前';
    var d = Math.round(h / 24); return d + '日前';
  }
  function when(t) {
    if (!t) return '';
    var d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(cls, label, fn) { var b = node('button', 'b ' + cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; }

  function card(m) {
    var live = isLive(m);
    var c = node('div', 'm' + (m.status === '承認待ち' ? ' wait' : m.status === '停止' ? ' off' : '') + (live ? ' live' : ''));
    var av = node('div', 'av');
    if (m.pic) { var im = node('img'); im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.src = m.pic; av.appendChild(im); }
    else av.appendChild(node('div', 'ph', (m.name || '？').slice(0, 1)));
    c.appendChild(av);

    var who = node('div', 'who');
    var nm = node('b', '', m.name || '（名前なし）');
    if (m.admin) nm.appendChild(node('span', 'boss', '管理者'));
    who.appendChild(nm);
    if (live) who.appendChild(node('span', 'st live', '使用中' + (m.page ? '（' + m.page + '）' : '')));
    else if (m.status === '承認待ち') who.appendChild(node('span', 'st', when(m.first) + ' に初めて開きました'));
    else who.appendChild(node('span', 'st', m.last ? '最後に使った日時：' + when(m.last) + '（' + ago(m.last) + '）' + (m.page ? '・' + m.page : '') : 'まだ使っていません'));
    c.appendChild(who);

    if (m.admin) return c;
    var acts = node('div', 'acts');
    if (asking === m.id) {
      acts.appendChild(node('span', 'ask', '止めますか？'));
      acts.appendChild(btn('stop', '止める', function (e) { setStatus(m, '停止', e.currentTarget); }));
      acts.appendChild(btn('plain', 'やめる', function () { asking = ''; draw(); }));
    } else if (m.status === '承認待ち') {
      acts.appendChild(btn('allow', '許可', function (e) { setStatus(m, '許可', e.currentTarget); }));
      acts.appendChild(btn('stop', '停止', function (e) { setStatus(m, '停止', e.currentTarget); }));
    } else if (m.status === '許可') {
      acts.appendChild(btn('stop', '停止', function () { asking = m.id; draw(); }));
    } else {
      acts.appendChild(btn('allow', '許可に戻す', function (e) { setStatus(m, '許可', e.currentTarget); }));
    }
    c.appendChild(acts);
    return c;
  }

  function fillList(id, list, emptyText) {
    var el = $(id);
    el.replaceChildren();
    if (!list.length) { if (emptyText) el.appendChild(node('p', 'empty', emptyText)); return; }
    list.forEach(function (m) { el.appendChild(card(m)); });
  }

  function draw() {
    var wait = members.filter(function (m) { return m.status === '承認待ち'; }).sort(function (a, b) { return b.first - a.first; });
    var ok = members.filter(function (m) { return m.status === '許可' || m.admin; }).sort(function (a, b) {
      var la = isLive(a) ? 1 : 0, lb = isLive(b) ? 1 : 0;
      return lb - la || (b.last || 0) - (a.last || 0);
    });
    var off = members.filter(function (m) { return m.status === '停止' && !m.admin; }).sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
    $('cOn').textContent = ok.filter(isLive).length;
    $('cWait').textContent = wait.length;
    $('cOk').textContent = ok.length;
    $('cOff').textContent = off.length;
    document.querySelector('.n.wait').classList.toggle('has', wait.length > 0);
    $('secWait').hidden = !wait.length;
    $('secOff').hidden = !off.length;
    fillList('listWait', wait);
    fillList('listOk', ok, 'まだいません。');
    fillList('listOff', off);
  }

  function load(quiet) {
    if (!quiet) $('upd').textContent = '読み込み中…';
    return SunriseGate.call({ action: 'members', sid: SunriseGate.sid() }).then(function (r) {
      if (!r || !r.ok) { $('upd').textContent = '読み込めませんでした。メニューから開き直してください。'; return; }
      serverGap = r.now ? r.now - Date.now() : 0;
      members = r.members || [];
      draw();
      $('upd').textContent = when(Date.now()) + ' 時点（20秒ごとに自動更新）';
    }).catch(function () { $('upd').textContent = 'つながりませんでした。「更新」を押してください。'; });
  }

  function setStatus(m, status, b) {
    if (b) b.disabled = true;
    SunriseGate.call({ action: 'setStatus', sid: SunriseGate.sid(), id: m.id, status: status }).then(function (r) {
      asking = '';
      if (!r || !r.ok) { toast('変更できませんでした'); draw(); return; }
      m.status = status;
      draw();
      toast(status === '許可' ? (m.name || '') + 'さんを許可しました' : (m.name || '') + 'さんを停止しました');
      load(true);
    }).catch(function () { asking = ''; toast('つながりませんでした'); draw(); });
  }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(function () { if (document.visibilityState === 'visible' && !asking) load(true); }, 20000);
  }

  $('reload').addEventListener('click', function () { load(false); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && SunriseGate.sid()) load(true); });

  if (!SunriseGate.enabled()) {
    $('upd').textContent = 'まだLINEのログイン設定が入っていません（設定後に使えます）。';
    return;
  }
  SunriseGate.start({ page: 'kanri', onAllowed: function () { load(false); startAuto(); } });
})();
