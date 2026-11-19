# ホームページ管理（管理画面）の設定手順

松浦様にお願いする作業です。
上から順に進めてください。
①と②だけで、文字・写真の書き換えとブログが使えるようになります。
③（インスタ）と④（Googleマップ）は、あとからでも大丈夫です。

管理画面の開き方：公式LINEのメニュー →「メンバー管理」→ 右上の「ホームページ管理」
（パソコンからは https://liff.line.me/2012260278-4lkJYixg/hp/ を開き、LINEでログイン）
使えるのは、メンバー管理で「管理者」になっている人だけです。

---

## ① Apps Script を新しくする（10分）

1. Google スプレッドシート「sunrise 見積書一覧」を開きます。
2. 上のメニューの「拡張機能」→「Apps Script」を押します。Apps Script の画面が開きます。
3. 左の「ファイル」にある、今のコードのファイルを押します。中身を全部選んで消し、次のページの中身を全部コピーして貼り付けます。
   https://github.com/sunrise-kaitai/sunrise-kaitai.github.io/blob/main/ops/mitsumori-sheet.gs
   （ページ右上の「コピー」のマーク（四角が2つ重なった形）を押すと、全部コピーできます）
4. 「ファイル」の横の「＋」→「スクリプト」を押し、名前を `hp-admin` にします。次のページの中身を全部コピーして貼り付けます。
   https://github.com/sunrise-kaitai/sunrise-kaitai.github.io/blob/main/ops/hp-admin.gs
5. 上の「保存」（フロッピーのマーク）を押します。
6. 右上の「デプロイ」→「デプロイを管理」→ 鉛筆のマーク → 「バージョン」で「新バージョン」を選び →「デプロイ」を押します。
   アドレス（URL）は変わりません。

## ② GitHub の鍵を作って入れる（10分）

管理画面で直した内容を、ホームページのデータ（GitHub）に保存するための鍵です。
この鍵はホームページのデータの読み書きだけができ、ほかのことはできません。

1. https://github.com/settings/personal-access-tokens/new を開きます（GitHub にログインした状態で）。
2. 次のとおりに入れます。
   - Token name：`sunrise-hp-admin`
   - Resource owner：`sunrise-kaitai`
   - Expiration：「366 days」（1年後に作り直しが必要です。期限の前に GitHub からメールが届きます）
   - Repository access：「Only select repositories」→ `sunrise-kaitai.github.io` を選ぶ
   - Permissions：「Repository permissions」の「Contents」を「Read and write」にする
3. 一番下の「Generate token」を押します。`github_pat_` で始まる長い文字が出るので、横のコピーのマークを押します。
   この文字は、ほかの人に見せたり、LINEやメールに貼ったりしないでください。
4. Apps Script の画面に戻り、左の歯車（プロジェクトの設定）を押します。
5. 一番下の「スクリプト プロパティ」→「スクリプト プロパティを追加」を押します。
   - プロパティ：`GITHUB_TOKEN`
   - 値：3でコピーした文字
   →「スクリプト プロパティを保存」を押します。
6. 左の「エディタ」（`< >` のマーク）に戻り、上の関数の欄で `hpSetup` を選んで「実行」を押します。
   初めてのときは「承認が必要です」と出るので、「権限を確認」→ ご自分のアカウント →「許可」を押します。
7. 下の「実行ログ」に「○ GitHub：つながりました」と出れば完了です。

ここまでで、管理画面の「ページを直す」と「ブログ・お知らせ」が使えます。

---

## ③ インスタグラムとつなぐ（20分）

sunrise のインスタだけに投稿するので、Meta（インスタの会社）の審査は、原則いりません。

1. **インスタをプロアカウントにする**
   インスタのアプリ → プロフィール → 右上の「≡」→「アカウントの種類とツール」→「プロアカウントに切り替える」→「ビジネス」を選びます。
   （すでにビジネスなら不要です）
2. **Meta の開発者登録**
   https://developers.facebook.com/ を開き、右上の「スタート」から登録します（Facebook のアカウントでログイン）。
3. **アプリを作る**
   「マイアプリ」→「アプリを作成」→ アプリ名は `sunrise ホームページ` → ユースケースで「Instagramでメッセージとコンテンツを管理」を選び、最後まで進めます。
4. **鍵を作る**
   アプリの画面の左のメニューの「Instagram」→「InstagramログインによるAPI設定」を開きます。
   「アクセストークンを生成する」の欄の「アカウントを追加」を押し、sunrise のインスタでログインして許可します。
   追加されたアカウントの横の「トークンを生成」を押すと、長い文字が出るのでコピーします。
5. **Apps Script に入れる**
   ②の4〜5と同じように、スクリプト プロパティを追加します。
   - プロパティ：`IG_TOKEN`
   - 値：4でコピーした文字
6. ②の6と同じように `hpSetup` を実行し、「○ インスタ：つながりました」と出れば完了です。

鍵は60日で切れますが、Apps Script が1週間ごとに自動で延長します。

## ④ Googleマップ（Googleビジネスプロフィール）とつなぐ

Google に「投稿の機能を使わせてください」という申請が必要です（審査は最大14日ほど）。
申請の前に、ビジネスプロフィールの「オーナー確認」が終わっている必要があります。

### 4-1. 申請する

1. https://console.cloud.google.com/ を開き、上の「プロジェクトを選択」→「新しいプロジェクト」→ 名前 `sunrise-hp` →「作成」。
2. 作ったプロジェクトを選んだ状態で、ホーム（ダッシュボード）にある「プロジェクト番号」（数字）をメモします。
3. https://developers.google.com/my-business/content/prereqs の「アクセスをリクエスト」のフォームを開きます。
   - 種類：「Application for Basic API Access」
   - 会社名：株式会社sunrise ／ ホームページ：https://sunrise-kaitai.github.io/
   - プロジェクト番号：2でメモした数字
   - 使う目的（英語でコピーして貼り付け）：
     `We will use the API only to publish posts (localPosts) to our own Business Profile (株式会社sunrise) when we publish a blog article on our website. Single location, owned by us.`
4. 送ると、結果がメールで届きます。

### 4-2. 申請が通ったら（30分）

1. Google Cloud（sunrise-hp のプロジェクト）の「APIとサービス」→「ライブラリ」で、次の3つを探して「有効にする」を押します。
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API
2. 「APIとサービス」→「OAuth 同意画面」を開き、アプリ名 `sunrise ホームページ`、メールはご自分のものを入れて作成します。
   最後に「公開ステータス」を「本番環境」にします（「テスト」のままだと7日で使えなくなるため）。
3. Apps Script の歯車（プロジェクトの設定）→「Google Cloud Platform（GCP）プロジェクト」→「プロジェクトを変更」→ 4-1の2の番号を入れて「プロジェクトを設定」。
4. 同じ設定の画面で「「appsscript.json」マニフェスト ファイルをエディタで表示する」にチェックを入れます。
5. エディタに戻り、`appsscript.json` を開きます。一番外側の `{ }` の中に、次の1かたまりを足します（前の行の最後に `,` を付けます）。
   ```
   "oauthScopes": [
     "https://www.googleapis.com/auth/spreadsheets.currentonly",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/script.scriptapp",
     "https://www.googleapis.com/auth/business.manage"
   ]
   ```
6. 保存して `hpSetup` を実行 → 承認 →「○ Googleマップ：つながりました」と出れば完了です。
7. ①の6と同じように、新バージョンでデプロイし直します。

---

## しくみ（担当者向け）

- 画面：`line/hp/`（LINEのログインで入口チェック。管理者だけ）
- 裏側：Apps Script（`ops/mitsumori-sheet.gs` ＋ `ops/hp-admin.gs`）。管理者だと確かめてから、GitHub の `site-src/content/` に保存する。
  - `content/edits.json`：ページの文字・写真の書き換え（`site-src/cms.py` がビルド時に当てはめる）
  - `content/posts/*.json`：ブログ・お知らせ（`site-src/blog.py` がページにする）
  - `content/uploads/`：管理画面から入れた写真（公開時は `/img/up/`）
- 公開：`.github/workflows/cms-publish.yml` が `publish.sh` を動かして main に入れる → GitHub Pages で公開 → IndexNow で検索エンジンに通知。
- インスタ・Googleマップ：Apps Script が5分ごとに、ホームページに出た記事を投稿する（結果はスプレッドシートの「SNS投稿」シートと、管理画面の「インスタ・Google」）。
- 開発者が `src/site.html` などの元の文章を変えると、その場所の管理画面での書き換えは外れて元の文章が出ます（目印が元の文章から作られるため）。
- トップの大きな写真のスライド（2枚目以降）は、管理画面では差しかえできません。
