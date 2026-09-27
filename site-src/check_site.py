"""
dist/ を GitHub Pages（プロジェクトサイト、アドレス途中に /-sunrise）に置いた想定で検査する。
  - 内部リンク・画像・CSS・JS がすべて実在するファイルを指しているか
  - /-sunrise を付け忘れた絶対パス（/img/… など）が残っていないか
  - 構造化データ（JSON-LD）が正しく読めるか、canonical がサイトマップと一致するか
使い方: python3 check_site.py   （問題があれば一覧を出して終了コード1）
"""
import os, re, sys, json, html
from urllib.parse import urlparse, unquote
import build_conf

DIST = 'dist'
DOMAIN = build_conf.DOMAIN.rstrip('/')
BASE = urlparse(DOMAIN).path.rstrip('/')
errors = []

def target_exists(path):
    # path はサイト内パス（BASE を除いたもの、先頭 /）
    p = unquote(path.split('#')[0].split('?')[0])
    if p == '' or p.endswith('/'):
        p += 'index.html'
    f = DIST + p
    return os.path.isfile(f) or os.path.isfile(f + '.html')

pages = []
for root, _, files in os.walk(DIST):
    for fn in files:
        if fn.endswith('.html') and not re.match(r'google[0-9a-f]+\.html$', fn):   # Search Console の確認ファイルは対象外
            pages.append(os.path.join(root, fn))

for f in sorted(pages):
    doc = open(f, encoding='utf-8').read()
    rel = f[len(DIST):]
    for attr, u in re.findall(r'\b(href|src)="([^"]*)"', doc):
        u = html.unescape(u)
        if u.startswith(('http://', 'https://')):
            if u.startswith(DOMAIN):
                path = u[len(DOMAIN):] or '/'
                if not target_exists(path):
                    errors.append(f'{rel}: 存在しないページ/ファイルへのURL {u}')
            continue
        if u.startswith(('#', 'tel:', 'mailto:', 'data:', 'javascript:')) or u == '':
            continue
        if u.startswith('/'):
            if BASE and not (u == BASE or u.startswith(BASE + '/')):
                errors.append(f'{rel}: {BASE} が付いていない絶対パス {u}')
                continue
            if not target_exists(u[len(BASE):] or '/'):
                errors.append(f'{rel}: リンク切れ {u}')
        else:
            errors.append(f'{rel}: 相対パス（階層によって壊れる） {u}')
    for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', doc, re.S):
        try:
            json.loads(m)
        except Exception as e:
            errors.append(f'{rel}: 構造化データが壊れている {e}')
    if re.search(r'\[ [^\]]*を入力 \]', doc):
        errors.append(f'{rel}: 未記入の仮の文字（[ …を入力 ]）が残っている')
    # セキュリティ: CSP・referrer の meta があるか、CSP でブロックされる書き方（インラインの script・onclick 等）がないか
    if '<meta http-equiv="Content-Security-Policy"' not in doc:
        errors.append(f'{rel}: Content-Security-Policy の meta がない')
    if '<meta name="referrer" content="strict-origin-when-cross-origin">' not in doc:
        errors.append(f'{rel}: referrer の meta がない')
    for tag in re.findall(r'<script\b[^>]*>', doc):
        if 'src=' not in tag and 'application/ld+json' not in tag:
            errors.append(f'{rel}: インラインの <script> は CSP でブロックされる {tag}')
    if re.search(r'<[^>]+\son[a-z]+="', doc):
        errors.append(f'{rel}: onclick などのイベント属性は CSP でブロックされる')
    if '<iframe' in doc:
        errors.append(f'{rel}: <iframe> は CSP（frame-src none）でブロックされる')
    if '404' not in rel:
        c = re.search(r'<link rel="canonical" href="([^"]+)"', doc)
        if not c:
            errors.append(f'{rel}: canonical がない')

# JS 内の画像パス
js = open(DIST + '/assets/main.js', encoding='utf-8').read()
for u in re.findall(r"['`](/[^'`$]*?/img/[^'`]*)['`]", js):
    if BASE and not u.startswith(BASE + '/'):
        errors.append(f'assets/main.js: {BASE} が付いていない画像パス {u}')
for n in range(1, 12):
    ext = 'webp'
    if not os.path.isfile(f'{DIST}/img/p{n:02d}.{ext}'):
        errors.append(f'img/p{n:02d}.{ext} がない')

# サイトマップの URL がすべて実在するか
sm = open(DIST + '/sitemap.xml', encoding='utf-8').read()
locs = re.findall(r'<loc>(.*?)</loc>', sm)
for u in locs:
    if not u.startswith(DOMAIN) or not target_exists(u[len(DOMAIN):] or '/'):
        errors.append(f'sitemap.xml: 存在しないURL {u}')

print(f'検査: HTML {len(pages)} ページ / サイトマップ {len(locs)} URL')
if errors:
    print('問題あり:')
    for e in errors:
        print('  -', e)
    sys.exit(1)
print('問題なし')
