/* 公式LINE（sunriseサーバー用）のページ共通の設定。どちらも公開してよい値（パスワードではない）。
   liffId が空のあいだは入口チェックを使わない（今までどおり誰でも開ける）。
   LINE Developers で LIFF アプリを作ったら、その「LIFF ID」をここに入れて公開すると入口チェックが始まる。 */
window.SUNRISE_LINE = {
  liffId: '',
  api: 'https://script.google.com/macros/s/AKfycbzZYlvLhkLK51jRibjiZudhDAjI-0vNLXBmvkkeV5lRLg65UL33zhD6Y-MTjpFKpIDY/exec'
};
