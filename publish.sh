#!/usr/bin/env bash
# サイトをビルドして、GitHub Pages が公開するリポジトリ直下に反映する。
#   使い方: ./publish.sh   → 反映後に git commit / push（main）すると数分で公開される
set -euo pipefail
cd "$(dirname "$0")"
python3 -c "import PIL" 2>/dev/null || pip install -q pillow
( cd site-src && python3 build.py && python3 check_site.py )
# 前回のビルド結果を消してから入れ替える（site-src や .github などは触らない）
rm -rf assets img column blog cms ./*.html robots.txt sitemap.xml .nojekyll CNAME
cp -r site-src/dist/. .
rm -f _headers   # Cloudflare 専用の設定ファイルなので GitHub Pages には置かない
echo "反映完了: git add -A && git commit && git push で公開されます"
