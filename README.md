# 株式会社sunrise ホームページ

公開アドレス: https://sunrise-kaitai.github.io/
（GitHub Pages。GitHub の組織 sunrise-kaitai にあるリポジトリ `sunrise-kaitai.github.io` の `main` ブランチ直下がそのまま公開されます）

## フォルダの見かた

| 場所 | 中身 |
|---|---|
| `site-src/` | サイトの元データ。`src/site.html`（デザイン・トップ・サービスページ）、`extra.py`（対応エリア・FAQ・コラム記事）、`service_detail.py`（サービス4ページの詳しい解説）、`region.py`（地域ページ：あま市・名古屋市・海部津島。出典つき）、`build.py`（ページを組み立てる）、画像 |
| 直下の `*.html`, `assets/`, `img/`, `column/`, `sitemap.xml` など | `publish.sh` が作る公開用ファイル。**直接編集しない** |
| `redirect-cloudflare/` | 旧アドレス sunrise-kaitai.pages.dev → 新アドレスへの転送用 zip |
| `ops/seo-log.md` | 毎日のSEOチェックの記録 |
| `ops/owner-tasks.md` | 松浦様にお願いしたい作業（Search Console・転送・Googleビジネスプロフィール・独自ドメイン・口コミ）の手順と文面 |
| `ops/monitor.py`, `.github/workflows/site-monitor.yml` | 公開サイトの自動監視（5分ごと）。異常があると Issue「サイト監視: 異常あり」が立ち、直ると自動で閉じる |
| `ops/lighthouse.py`, `.github/workflows/seo-weekly.yml` | 毎週月曜の SEO・表示速度の採点（Google Lighthouse）。SEO 90点未満・表示速度50点未満があると Issue「週次チェック: 改善が必要」 |
| `.github/workflows/indexnow.yml` | 公開のたびに Bing など IndexNow 対応の検索エンジンへ全ページを自動通知（キーは `build.py` の `INDEXNOW_KEY`、公開してよい値） |

自動チェックはすべて GitHub の無料枠で動き、Claude のクレジットは使いません（2026/10/8 に Claude の毎日チェックは停止）。

## 更新のしかた

1. `site-src/extra.py` や `site-src/src/site.html` を編集
2. `./publish.sh` を実行（ビルド → リンク・構造化データの検査 → 直下へ反映）
3. `main` に commit / push すると、数分で公開サイトに反映

## 注意

- コラム一覧は `/column/`（末尾に / が付く）。GitHub Pages では同じ名前のページとフォルダが並ぶと開けないため、`build.py` の `DIR_INDEX` でフォルダの index.html として書き出しています。

- サイト内のパスは `build.py` の `DOMAIN` から自動で決まります（アドレスの途中にフォルダ名が入る公開先でも、先頭に自動で付けます）。
  独自ドメインに移す場合も `DOMAIN` を変えるだけで全ページのパスが切り替わります。
- 会社概要などの未記入項目（`src/site.html` の `<span class="todo">[ …を入力 ]</span>`）は公開ページに出さない。値が決まったら書き換えると表示される。
- 独自ドメインにするときは `build.py` の `DOMAIN` を変えるだけで、CNAME の作成と監視先の切り替えも自動で行われる。
- Search Console の所有者確認コードは `build.py` の `GSC_CODES` に追加します。
- `site-src/check_site.py` がリンク切れ・パスの付け忘れ・構造化データの壊れを検査します（`publish.sh` から自動で実行）。

## セキュリティのルール（必ず守る）

このリポジトリは **公開** です。`ops/`・`site-src/`・`.github/` などの内部ファイルも含め、中身はすべて誰でも読めます（過去の履歴も消えません）。

- **パスワード・鍵・トークンは絶対に入れない。** GitHub・Google・LINE（チャネルアクセストークン等）・Apps Script のスクリプトプロパティ・サーバー等のパスワードや API キー、秘密鍵ファイルは、コード・メモ・コミットメッセージのどこにも書かない。必要な場合は GitHub の「Secrets」や Apps Script の「スクリプト プロパティ」に保存し、ファイルには名前だけを書く。
- **個人の連絡先は入れない。** 松浦様・従業員・お客様・取引先の個人の携帯番号・メールアドレス・住所・LINE ID などは書かない。書いてよいのは、公開ページにすでに載せている会社の代表連絡先（電話 090-7686-6461）だけ。
- **フォームの問い合わせ内容はリポジトリに保存しない。** 届いた内容（お名前・連絡先・住所など）を ops/ のログやテストデータに貼らない。
- うっかり入れてしまったら、ファイルを消すだけでは履歴に残る。**すぐにそのパスワード・鍵を無効化（再発行）** してから、担当者に連絡する。
- 公開ページの全ページに `build.py` の `SECURITY_META`（Content-Security-Policy と referrer）が入る。外部サービス（地図の埋め込み・動画・アクセス解析など）を追加するときは、`CSP` に許可先を足さないとブロックされる。インラインの `<script>` や `onclick="…"` は使わず、`assets/main.js` に書く（`check_site.py` が検査する）。
- フォーム送信には `t`（ページを開いてから送信までのミリ秒）が付く。Apps Script 側で 3000 未満はロボットとして破棄している。
