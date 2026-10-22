# 公式LINEで見積書を作る仕組み

公式LINEのトークに「見積」から始まる文章を送ると、見積書の画像とPDFが返ってくる。
登録した人（`ALLOWED_USER_IDS`）以外のメッセージには反応しないので、お客様とのトークには影響しない。

- 動かしている場所: Netlify のプロジェクト `sunrise-mitsumori`（このフォルダを Base directory にしてつなぐ）
- Webhook の URL: `https://sunrise-mitsumori.netlify.app/line`
- 作った見積書の画像・PDF: Netlify Blobs に保存し、推測できない長いアドレス（`/f/…`）で返す。180日で自動削除（`netlify/functions/cleanup.mts`）
- 角印: LINE で「角印」と送ってから画像を送ると登録される（Netlify Blobs に保存。このリポジトリには入れない）

## Netlify の環境変数（値はここに書かない）

| 名前 | 中身 |
|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers の「チャネルシークレット」 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers の「チャネルアクセストークン（長期）」 |
| `ALLOWED_USER_IDS` | 見積書を作れる人の LINE のID（カンマ区切り）。トークで「ID確認」と送ると分かる |
| `COMPANY_JSON` | 見積書に載せる会社情報（会社名・住所・電話・担当） |

## 書き方

`lib/estimate.mjs` の `HELP` を参照。見た目は `lib/render.mjs`（ホームページの `/mitsumori/` と同じ配置）。
フォントは Noto Sans JP（SIL Open Font License）。
