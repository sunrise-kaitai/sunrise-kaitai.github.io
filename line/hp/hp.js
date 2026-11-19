/* ホームページ管理（管理者だけ）
   1. ページを直す：本物のページを下に表示し、オレンジの点線の文字・写真を押して直す → 「公開する」
   2. ブログ・お知らせ：書いて「公開する」。インスタ・Googleマップにも一緒に投稿できる
   3. インスタ・Google：つながっているか、最近の投稿の結果
   保存は Apps Script（ops/hp-admin.gs）が管理者だと確かめてから GitHub に入れ、GitHub が自動でページを作り直して公開する。
   文字は文字のまま送り、ページに入れるときにエスケープするので、HTML やスクリプトは入らない。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CFG = window.SUNRISE_LINE || {};
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|SVG|TEMPLATE|TEXTAREA|SELECT|OPTION)$/;
  var COMMON = /^(HEADER|FOOTER|NAV)$/;
  var STORE = 'sunrise_hp_pend';
  var sid = '';
  var S = {
    pages: [], saved: { t: {}, i: {}, rev: '' },
    pend: { t: {}, i: {} },          // まだ公開していない変更（t: 文字の配列 or null=元に戻す、i: 写真の番号 or null）
    files: {},                       // 写真の番号 → dataURL
    nextFile: 1,
    page: 'index.html',
    posts: [], local: {},            // local: 保存したがまだホームページに出ていない記事
    sns: null,
  };

  /* ---------- 共通 ---------- */
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, ms || 3200); }
  function busy(t) { $('busyT').textContent = t || ''; $('busy').hidden = !t; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fresh(url) { return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function api(body, ms) {
    body.sid = sid;
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 120000);
    return fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { return r.json(); })
      .finally(function () { clearTimeout(t); });
  }
  function errText(r) {
    var e = (r && r.error) || '';
    if (e === 'admin' || e === 'expired') return 'もう一度、公式LINEのメニューから開いてください。（管理者だけが使えます）';
    if (e === 'nogithub') return 'まだ設定が終わっていません（GitHub の鍵）。手順書を見てください。';
    if (e === 'busy') return 'ほかの保存と重なりました。少し待って、もう一度押してください。';
    if (e === 'big') return '写真が大きすぎます。枚数を減らしてください。';
    return '保存できませんでした。電波のよい所で、もう一度押してください。' + (e ? '（' + e + '）' : '');
  }

  // 写真を横1600pxまでに縮めて JPEG にする（square=true ならインスタ用に真ん中を正方形で切り出す）
  function shrink(src, square) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
        if (square) { var m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; }
        var M = square ? 1080 : 1600, k = Math.min(1, M / Math.max(sw, sh));
        var c = document.createElement('canvas');
        c.width = Math.round(sw * k); c.height = Math.round(sh * k);
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      im.onerror = rej;
      im.src = src;
    });
  }
  function fileToData(f) { var u = URL.createObjectURL(f); return shrink(u).finally(function () { URL.revokeObjectURL(u); }); }
  function addFile(data) { var id = 'f' + (S.nextFile++); S.files[id] = data; return id; }

  /* ---------- タブ ---------- */
  var TABS = { tabPage: 'viewPage', tabBlog: 'viewBlog', tabSns: 'viewSns' };
  Object.keys(TABS).forEach(function (t) {
    $(t).addEventListener('click', function () {
      Object.keys(TABS).forEach(function (o) { $(o).setAttribute('aria-selected', String(o === t)); $(TABS[o]).hidden = o !== t; });
      closeSheet(true);
      dock();
      if (t === 'tabBlog') loadPosts();
      if (t === 'tabSns') loadSns();
    });
  });

  /* ================= 1. ページを直す ================= */
  var frame = $('frame');
  var cur = null;   // 今開いている欄 {el, k, kind, nodes, before}

  function savePend() { try { localStorage.setItem(STORE, JSON.stringify({ pend: S.pend, files: S.files, next: S.nextFile })); } catch (e) {} }
  function loadPend() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (d && d.pend) {
        S.pend = { t: d.pend.t || {}, i: d.pend.i || {} }; S.files = d.files || {}; S.nextFile = d.next || 1;
        // 写真が保存しきれていなかった変更は捨てる（スマホの保存容量が足りないとき）
        Object.keys(S.pend.i).forEach(function (k) { var v = S.pend.i[k]; if (v && !S.files[v]) delete S.pend.i[k]; });
      }
    } catch (e) {}
  }
  function pendCount() { return Object.keys(S.pend.t).length + Object.keys(S.pend.i).length; }
  function dock() {
    var n = pendCount();
    $('dock').hidden = !n || $('viewPage').hidden;
    $('dockN').textContent = '変更 ' + n + '件（まだ公開していません）';
  }

  function loadPages() {
    return Promise.all([fresh('/cms/pages.json'), fresh('/cms/edits.json').catch(function () { return { t: {}, i: {} }; })]).then(function (r) {
      S.pages = r[0];
      S.saved = { t: r[1].t || {}, i: r[1].i || {}, rev: r[1].rev || '' };
      var sel = $('pageSel');
      sel.textContent = '';
      S.pages.forEach(function (p) {
        var o = node('option', '', p.t + (p.p === 'index.html' ? '' : '（' + p.p.replace(/\.html$/, '').replace(/\/index$/, '/') + '）'));
        o.value = p.p; sel.appendChild(o);
      });
      sel.value = S.page;
      openPage(S.page);
    });
  }
  $('pageSel').addEventListener('change', function () { closeSheet(true); openPage(this.value); });
  function openPage(p) { S.page = p; frame.src = '/' + p + '?cmsedit=' + Date.now(); }

  function view(sp) {
    $('vwSp').setAttribute('aria-pressed', String(sp)); $('vwPc').setAttribute('aria-pressed', String(!sp));
    $('frameBox').classList.toggle('sp', sp);
  }
  $('vwSp').addEventListener('click', function () { view(true); });
  $('vwPc').addEventListener('click', function () { view(false); });
  view(true);

  function fdoc() { try { return frame.contentDocument; } catch (e) { return null; } }

  // 「文字の切れ目」：空白だけでない文字。ビルド側（site-src/cms.py）と同じ数え方
  function segNodes(el) {
    var out = [], w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      var p = n.parentNode, bad = false;
      while (p && p !== el) { if (p.nodeType === 1 && SKIP.test(p.nodeName.toUpperCase())) { bad = true; break; } p = p.parentNode; }
      if (!bad) out.push(n);
    }
    return out;
  }
  function isCommon(el) {
    var body = el.ownerDocument.body, p = el.parentNode;
    while (p && p !== body) { if (COMMON.test(p.nodeName) && p.parentNode === body) return true; p = p.parentNode; }
    return false;
  }
  function textNow(el, k) {
    if (S.pend.t[k]) return S.pend.t[k].slice();
    if (S.saved.t[k]) return S.saved.t[k].slice();
    return segNodes(el).map(function (n) { return clean(n.nodeValue); });
  }
  function showText(el, vals) {
    var nodes = segNodes(el);
    if (nodes.length !== vals.length) return false;
    nodes.forEach(function (n, i) { n.nodeValue = vals[i].replace(/\n/g, ' '); });
    return true;
  }
  function showImg(img, src) {
    img.removeAttribute('srcset'); img.removeAttribute('sizes');
    if (img.parentNode && img.parentNode.nodeName === 'PICTURE') [].slice.call(img.parentNode.querySelectorAll('source')).forEach(function (s) { s.remove(); });
    img.src = src;
  }

  frame.addEventListener('load', function () {
    var d = fdoc();
    if (!d || !d.body) return;
    var st = d.createElement('style');
    st.textContent = '[data-cms]{outline:2px dashed rgba(255,106,26,.8)!important;outline-offset:2px;cursor:pointer!important}' +
      '[data-cms]:hover{background:rgba(255,106,26,.12)!important}' +
      'img[data-cms-img]{outline:4px dashed #ff6a1a!important;outline-offset:-4px;cursor:pointer!important}' +
      '.cms-on{outline:3px solid #ff6a1a!important;background:rgba(255,106,26,.18)!important}' +
      '.rv{opacity:1!important;transform:none!important}';
    d.head.appendChild(st);
    // まだ公開していない変更を見た目に反映
    [].slice.call(d.querySelectorAll('[data-cms]')).forEach(function (el) {
      var v = S.pend.t[el.getAttribute('data-cms')]; if (v) showText(el, v);
    });
    [].slice.call(d.querySelectorAll('img[data-cms-img]')).forEach(function (img) {
      var v = S.pend.i[img.getAttribute('data-cms-img')]; if (v && S.files[v]) showImg(img, S.files[v]);
    });
    // リンク・ボタン・フォームは動かさず、押した所を直す欄を開く
    d.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var t = e.target;
      var img = t.closest && t.closest('img[data-cms-img]');
      if (!img && t.querySelector) {
        // 写真の上に重なった飾りを押したときも写真を直せるように
        var box = t.closest('.ph,picture,figure');
        img = box && box.querySelector('img[data-cms-img]');
      }
      var el = t.closest && t.closest('[data-cms]');
      if (el) openText(el); else if (img) openImg(img);
    }, true);
    d.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  });

  function openSheet(title, note) {
    $('sheetH').textContent = title;
    $('sheetNote').hidden = !note; $('sheetNote').textContent = note || '';
    $('sheetBody').textContent = '';
    $('sheet').hidden = false;
  }
  function closeSheet(revert) {
    if (cur) {
      if (revert && cur.revert) cur.revert();
      cur.el.classList.remove('cms-on');
    }
    cur = null;
    $('sheet').hidden = true;
  }
  $('sheetClose').addEventListener('click', function () { closeSheet(true); });

  function openText(el) {
    closeSheet(true);
    var k = el.getAttribute('data-cms');
    var before = textNow(el, k);
    var common = isCommon(el);
    openSheet('文字を直す', common ? 'この文字は、すべてのページに共通です（どのページで直しても全部に反映されます）。' : '');
    el.classList.add('cms-on');
    var boxes = before.map(function (v, i) {
      var f = node('label', 'segf');
      if (before.length > 1) f.appendChild(node('span', '', (i + 1) + 'つ目の文字（太字やリンクで区切られています）'));
      var ta = node('textarea');
      ta.rows = Math.min(6, Math.max(1, Math.ceil(v.length / 22)));
      ta.value = v;
      ta.addEventListener('input', function () { showText(el, boxes.map(function (b) { return b.value; })); });
      f.appendChild(ta); $('sheetBody').appendChild(f);
      return ta;
    });
    $('sheetReset').hidden = !(S.saved.t[k] || S.pend.t[k]);
    cur = {
      el: el, k: k, kind: 't',
      revert: function () { showText(el, before); },
      ok: function () {
        var vals = boxes.map(function (b) { return b.value.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, ''); });
        if (!same(vals, before)) { S.pend.t[k] = vals; savePend(); }
        showText(el, vals);
      },
      reset: function () { S.pend.t[k] = null; savePend(); toast('「公開する」を押すと、最初の文字に戻ります。'); },
    };
    if (boxes[0]) setTimeout(function () { boxes[0].focus(); }, 50);
  }

  function openImg(img) {
    closeSheet(true);
    var k = img.getAttribute('data-cms-img');
    var beforeSrc = img.currentSrc || img.src;
    openSheet('写真を差しかえる', isCommon(img) ? 'この写真は、すべてのページに共通です。' : '');
    img.classList.add('cms-on');
    var pv = node('img', 'imgprev'); pv.alt = '今の写真'; pv.src = beforeSrc;
    var lab = node('label', 'ghost file', '新しい写真をえらぶ');
    var inp = node('input'); inp.type = 'file'; inp.accept = 'image/*'; lab.appendChild(inp);
    var chosen = null;
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      busy('写真を準備しています…');
      fileToData(f).then(function (data) { chosen = data; pv.src = data; showImg(img, data); })
        .catch(function () { toast('この写真は読み込めませんでした。別の写真をえらんでください。'); })
        .finally(function () { busy(''); });
    });
    $('sheetBody').appendChild(pv);
    $('sheetBody').appendChild(node('p', 'hint', '横長の場所には横長、縦長の場所には縦長の写真がきれいに入ります。'));
    $('sheetBody').appendChild(lab);
    $('sheetReset').hidden = !(S.saved.i[k] || S.pend.i[k]);
    cur = {
      el: img, k: k, kind: 'i',
      revert: function () { if (chosen) img.src = beforeSrc; },
      ok: function () { if (chosen) { S.pend.i[k] = addFile(chosen); savePend(); } },
      reset: function () { S.pend.i[k] = null; savePend(); toast('「公開する」を押すと、最初の写真に戻ります。'); },
    };
  }

  $('sheetOk').addEventListener('click', function () { if (cur && cur.ok) cur.ok(); if (cur) { cur.revert = null; } closeSheet(false); dock(); });
  $('sheetReset').addEventListener('click', function () { if (cur && cur.reset) cur.reset(); if (cur) cur.revert = null; closeSheet(false); dock(); });

  $('dockUndo').addEventListener('click', function () {
    if (!this.classList.contains('armed')) { this.classList.add('armed'); this.textContent = 'もう一度押すと全部やめます'; var b = this; setTimeout(function () { b.classList.remove('armed'); b.textContent = 'やめる'; }, 4000); return; }
    S.pend = { t: {}, i: {} }; S.files = {}; savePend(); dock(); openPage(S.page);
    this.classList.remove('armed'); this.textContent = 'やめる';
  });

  $('dockSave').addEventListener('click', function () {
    closeSheet(false);
    var files = [], map = {}, i = {};
    Object.keys(S.pend.i).forEach(function (k) {
      var v = S.pend.i[k];
      if (v && S.files[v]) { if (!(v in map)) { map[v] = files.length; files.push({ data: S.files[v] }); } i[k] = '#' + map[v]; }
      else if (v === null) i[k] = null;
    });
    busy('公開しています…\nこの画面のままお待ちください。');
    api({ action: 'hpSave', t: S.pend.t, i: i, files: files }).then(function (r) {
      if (!r || !r.ok) { toast(errText(r), 6000); return; }
      Object.keys(S.pend.t).forEach(function (k) { if (S.pend.t[k]) S.saved.t[k] = S.pend.t[k]; else delete S.saved.t[k]; });
      S.pend = { t: {}, i: {} }; S.files = {}; savePend(); dock();
      toast('受け付けました。2〜3分でホームページに出ます。', 6000);
      watch('/cms/edits.json', function (d) { return d && d.rev === r.rev; }, function () { toast('ホームページに反映されました。'); loadPages(); });
    }).catch(function () { toast(errText(null), 6000); }).finally(function () { busy(''); });
  });

  // 公開されるまで20秒ごとに確かめる（最長10分）
  function watch(url, test, done) {
    var n = 0;
    (function tick() {
      if (++n > 30) return;
      setTimeout(function () { fresh(url).then(function (d) { if (test(d)) done(); else tick(); }).catch(tick); }, 20000);
    })();
  }

  /* ================= 2. ブログ・お知らせ ================= */
  var form = { id: '', photos: [], snsEdited: false };
  var CATS = { blog: 'ブログ', news: 'お知らせ' };

  function loadPosts() {
    $('posts').textContent = '';
    $('posts').appendChild(node('p', 'hint', '読み込み中…'));
    fresh('/blog/posts.json').catch(function () { return []; }).then(function (list) {
      S.posts = list;
      var byId = {};
      list.forEach(function (p) { byId[p.id] = p; });
      Object.keys(S.local).forEach(function (id) {
        var l = S.local[id];
        if (byId[id] && byId[id].rev === l.rev) delete S.local[id];
      });
      renderPosts();
    });
  }
  function allPosts() {
    var out = S.posts.slice(), seen = {};
    out = out.map(function (p) { seen[p.id] = 1; return S.local[p.id] || p; });
    Object.keys(S.local).forEach(function (id) { if (!seen[id] && !S.local[id].deleted) out.unshift(S.local[id]); });
    return out.filter(function (p) { return !p.deleted; }).sort(function (a, b) { return (b.date + b.id).localeCompare(a.date + a.id); });
  }
  function photoSrc(x) { return /^up\//.test(x) ? '/img/' + x : (S.files[x] || ''); }
  function renderPosts() {
    var box = $('posts'); box.textContent = '';
    var list = allPosts();
    if (!list.length) { box.appendChild(node('p', 'hint', 'まだ記事はありません。「＋ 新しく書く」から書けます。')); return; }
    list.forEach(function (p) {
      var b = node('button', 'post'); b.type = 'button';
      if (p.photos && p.photos[0]) { var im = node('img'); im.alt = ''; im.loading = 'lazy'; im.src = photoSrc(p.photos[0]); b.appendChild(im); }
      else b.appendChild(node('div', 'noph'));
      var mid = node('div');
      var t = node('b', '', p.title); mid.appendChild(t);
      var sm = node('small', '', p.date.replace(/-/g, '.')); var c = node('span', 'cat ' + p.cat, CATS[p.cat] || 'ブログ'); sm.appendChild(c); mid.appendChild(sm);
      b.appendChild(mid);
      b.appendChild(node('span', 'st', S.local[p.id] ? '反映待ち' : '公開中'));
      b.addEventListener('click', function () { openPost(p); });
      box.appendChild(b);
    });
  }

  $('newPost').addEventListener('click', function () { openPost(null); });
  $('postBack').addEventListener('click', showList);
  function showList() { $('postForm').hidden = true; $('blogList').hidden = false; renderPosts(); window.scrollTo(0, 0); }

  function openPost(p) {
    form = { id: p ? p.id : '', photos: p ? (p.photos || []).slice() : [], snsEdited: false };
    $('postHead').textContent = p ? '記事を直す' : '新しく書く';
    [].slice.call(document.querySelectorAll('input[name=cat]')).forEach(function (r) { r.checked = r.value === (p ? p.cat : 'blog'); });
    $('pDate').value = p ? p.date : today();
    $('pTitle').value = p ? p.title : '';
    $('pBody').value = p ? p.body : '';
    $('snsIg').checked = false; $('snsGbp').checked = false;
    $('snsBox').hidden = !!p;   // インスタ・Googleへの投稿は、初めて公開するときだけ
    $('snsText').value = ''; snsVisible();
    $('postErr').hidden = true;
    $('postDel').hidden = !p; $('postDel').classList.remove('armed'); $('postDel').textContent = 'この記事を消す';
    renderPhotos();
    snsAvail();
    $('blogList').hidden = true; $('postForm').hidden = false; window.scrollTo(0, 0);
  }

  function renderPhotos() {
    var box = $('pPhotos'); box.textContent = '';
    form.photos.forEach(function (x, i) {
      var d = node('div', 'ph');
      var im = node('img'); im.alt = '写真' + (i + 1); im.src = photoSrc(x); d.appendChild(im);
      if (i === 0) d.appendChild(node('span', 'cover', '表紙'));
      var tools = node('div', 'tools');
      if (i > 0) tools.appendChild(tool('← 前へ', function () { var t = form.photos[i - 1]; form.photos[i - 1] = form.photos[i]; form.photos[i] = t; renderPhotos(); }));
      tools.appendChild(tool('✕ 外す', function () { form.photos.splice(i, 1); renderPhotos(); }));
      d.appendChild(tools); box.appendChild(d);
    });
    function tool(label, fn) { var b = node('button', '', label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  }
  $('pFile').addEventListener('change', function () {
    var fs = [].slice.call(this.files || []).slice(0, 10 - form.photos.length);
    this.value = '';
    if (!fs.length) { toast('写真は10枚までです。'); return; }
    busy('写真を準備しています…');
    fs.reduce(function (pr, f) {
      return pr.then(function () { return fileToData(f).then(function (d) { form.photos.push(addFile(d)); }).catch(function () { toast('読み込めない写真がありました。'); }); });
    }, Promise.resolve()).then(function () { renderPhotos(); busy(''); });
  });

  // インスタ・Googleに載せる文章（題名＋本文のはじめ）。自分で直したら、それ以降は自動で変えない
  function autoSns() {
    if (form.snsEdited) return;
    var body = $('pBody').value.replace(/^■/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    if (body.length > 300) body = body.slice(0, 300) + '…';
    $('snsText').value = ($('pTitle').value.trim() + '\n\n' + body + '\n\n株式会社sunrise（愛知県あま市の解体工事）\n詳しくはホームページのブログをご覧ください。').trim();
  }
  function snsVisible() { var on = $('snsIg').checked || $('snsGbp').checked; $('snsTextBox').hidden = !on; if (on) autoSns(); }
  ['pTitle', 'pBody'].forEach(function (id) { $(id).addEventListener('input', function () { if (!$('snsTextBox').hidden) autoSns(); }); });
  $('snsText').addEventListener('input', function () { form.snsEdited = true; });
  $('snsIg').addEventListener('change', snsVisible);
  $('snsGbp').addEventListener('change', snsVisible);

  function snsAvail() {
    var set = function () {
      var s = S.sns || {};
      var ig = s.ig && s.ig.on, gb = s.gbp && s.gbp.on;
      $('snsIg').disabled = !ig; $('igNote').textContent = ig ? '' : '（まだつながっていません）';
      $('snsGbp').disabled = !gb; $('gbpNote').textContent = gb ? '' : '（まだつながっていません）';
    };
    if (S.sns) set(); else api({ action: 'snsStatus' }, 30000).then(function (r) { if (r && r.ok) S.sns = r; set(); }).catch(set);
  }

  $('postForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = function (t) { $('postErr').textContent = t; $('postErr').hidden = false; $('postErr').scrollIntoView({ block: 'center' }); };
    $('postErr').hidden = true;
    var title = $('pTitle').value.trim();
    if (!title) return err('題名を入れてください。');
    if (!/^\d{4}-\d{2}-\d{2}$/.test($('pDate').value)) return err('日付を入れてください。');
    var ig = !$('snsBox').hidden && $('snsIg').checked, gbp = !$('snsBox').hidden && $('snsGbp').checked;
    if (ig && !form.photos.length) return err('インスタに投稿するには、写真が1枚以上必要です。');
    var cat = (document.querySelector('input[name=cat]:checked') || {}).value || 'blog';
    var files = [], photos = [], igFiles = [];
    busy('公開しています…\nこの画面のままお待ちください。');
    var prep = Promise.resolve();
    form.photos.forEach(function (x) {
      if (/^up\//.test(x)) photos.push(x);
      else { photos.push('#' + files.length); files.push({ data: S.files[x] }); }
    });
    // インスタ用は正方形に切り出したものを別に送る（インスタは縦長すぎる写真を受け付けないため）
    if (ig) {
      prep = form.photos.reduce(function (pr, x) {
        return pr.then(function () { return shrink(photoSrc(x), true).then(function (d) { igFiles.push(d); }); });
      }, prep);
    }
    prep.then(function () {
      var post = { id: form.id, date: $('pDate').value, cat: cat, title: title, body: $('pBody').value, photos: photos };
      return api({ action: 'postSave', post: post, files: files, ig: igFiles.map(function (d) { return { data: d }; }),
                   sns: { ig: ig, gbp: gbp, text: $('snsText').value } });
    }).then(function (r) {
      if (!r || !r.ok) { err(errText(r)); return; }
      var saved = { id: r.id, rev: r.rev, date: $('pDate').value, cat: cat, title: title, body: $('pBody').value, photos: r.photos || [] };
      S.local[r.id] = saved;
      toast((ig || gbp) ? '受け付けました。2〜3分でホームページに出て、そのあとインスタ・Googleにも投稿されます。' : '受け付けました。2〜3分でホームページに出ます。', 7000);
      showList();
      watch('/blog/posts.json', function (list) { return (list || []).some(function (p) { return p.id === r.id && p.rev === r.rev; }); },
        function () { toast('ブログがホームページに出ました。'); if (!$('viewBlog').hidden) loadPosts(); });
    }).catch(function () { err(errText(null)); }).finally(function () { busy(''); });
  });

  $('postDel').addEventListener('click', function () {
    var b = this;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'もう一度押すと消えます'; setTimeout(function () { b.classList.remove('armed'); b.textContent = 'この記事を消す'; }, 4000); return; }
    busy('消しています…');
    api({ action: 'postDelete', id: form.id }).then(function (r) {
      if (!r || !r.ok) { toast(errText(r), 6000); return; }
      S.local[form.id] = { id: form.id, deleted: true, rev: 'x' };
      toast('消しました。2〜3分でホームページからも消えます。（インスタ・Googleの投稿は、それぞれのアプリで消してください）', 8000);
      showList();
    }).catch(function () { toast(errText(null), 6000); }).finally(function () { busy(''); });
  });

  /* ================= 3. インスタ・Google ================= */
  function loadSns() {
    var st = $('snsState'), lg = $('snsLog');
    st.textContent = ''; st.appendChild(node('p', 'hint', '読み込み中…')); lg.textContent = '';
    api({ action: 'snsStatus' }, 30000).then(function (r) {
      st.textContent = '';
      if (!r || !r.ok) { st.appendChild(node('p', 'ng', errText(r))); return; }
      S.sns = r;
      [['インスタグラム', r.ig], ['Googleマップ（ビジネスプロフィール）', r.gbp]].forEach(function (x) {
        var c = node('div', 'card'); c.appendChild(node('b', '', x[0]));
        var s = x[1] || {};
        c.appendChild(node('span', s.on ? 'ok' : 'ng', s.on ? 'つながっています' + (s.name ? '（' + s.name + '）' : '') : 'まだつながっていません'));
        if (s.note) c.appendChild(node('small', 'hint', s.note));
        st.appendChild(c);
      });
      (r.log || []).forEach(function (l) {
        var d = node('div', 'log');
        d.appendChild(node('b', '', l.title));
        d.appendChild(node('div', '', 'インスタ：' + (l.ig || '—') + '　Google：' + (l.gbp || '—')));
        d.appendChild(node('small', '', l.at));
        lg.appendChild(d);
      });
      if (!(r.log || []).length) lg.appendChild(node('p', 'hint', 'まだありません。'));
    }).catch(function () { st.textContent = ''; st.appendChild(node('p', 'ng', errText(null))); });
  }

  /* ---------- はじまり ---------- */
  loadPend();
  window.SunriseGate.start({
    page: 'hp',
    onAllowed: function (res) {
      // 古い Apps Script のままだと、保存の合図が別の処理（見積書の記録）に入ってしまうので、何もしない
      if (!res || !res.admin || !res.hp) {
        document.querySelector('.wrap').replaceChildren(node('h1', '', 'ホームページ管理'),
          node('p', 'ng', !res || !res.admin ? 'この画面は、管理者だけが使えます。' : 'まだ準備中です（Apps Script の更新がまだです）。手順書 ops/hp-admin-setup.md を見てください。'));
        return;
      }
      sid = (res && res.sid) || window.SunriseGate.sid();
      loadPages().catch(function () { toast('ページの一覧を読み込めませんでした。開き直してください。', 6000); });
      dock();
    },
  });
})();
