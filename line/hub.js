/* LIFF の入口（LINE Developers の「エンドポイントURL」= https://sunrise-kaitai.github.io/line/ ）。
   liff.line.me/<LIFF ID>/mitsumori/ などで開くと、まずここに来て、liff.init が目的のページへ送る。 */
(function () {
  var cfg = window.SUNRISE_LINE || {};
  var showHub = function () { var h = document.getElementById('hub'); if (h) h.hidden = false; };
  if (!cfg.liffId || !window.liff) { showHub(); return; }
  window.liff.init({ liffId: cfg.liffId }).then(function () {
    // 行き先（liff.state）がないときだけ案内を出す。あるときは liff.init が自動で移動する
    if (!/liff\.state=/.test(location.search)) showHub();
  }).catch(showHub);
})();
