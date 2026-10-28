/* 公式LINEメニュー「スレッズ投稿」：入口チェックを通った人だけ Threads の投稿画面へ */
(function () {
  var URL = 'https://www.threads.net/intent/post';
  var go = function () {
    var liff = window.liff;
    try {
      if (liff && liff.isInClient && liff.isInClient()) {
        liff.openWindow({ url: URL, external: true });
        setTimeout(function () { try { liff.closeWindow(); } catch (e) {} }, 800);
        return;
      }
    } catch (e) {}
    location.replace(URL);
  };
  window.SunriseGate.start({ page: 'threads', onAllowed: go });
})();
