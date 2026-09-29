"""
Build the sunrise site from src/site.html (single-file source) into:
  dist/     full HTML documents for real hosting (index + 4 service pages)
  preview/  same pages, index written as page body only (artifact skeleton wraps it)
"""
import re, json, os, shutil, html
import extra
import recruit
import service_detail   # サービス4ページの詳しい解説（対応物件・費用の要素・近隣対策・トラブル）
import region           # 地域ページ（あま市・名古屋市・海部津島）

SRC = open('src/site.html', encoding='utf-8').read()
DOMAIN = 'https://sunrise-kaitai.github.io'
# GitHub Pages のプロジェクトサイトはアドレスの途中にフォルダ名（/-sunrise）が入るため、
# サイト内の絶対パス（/img/… や /building など）の先頭にこれを付ける。
from urllib.parse import urlparse
BASE = urlparse(DOMAIN).path.rstrip('/') if DOMAIN else ''

AREA = ['愛知県', '岐阜県', '三重県', '静岡県', '滋賀県']
TEL = '090-7686-6461'
WITH_EXTRA = True
IMG_EXT = 'webp'

PAGES = {
  'index':    dict(file='index.html',
                   title='愛知県あま市の解体会社｜名古屋・愛知全域の解体工事・内装解体 株式会社sunrise',
                   desc='愛知県あま市の解体工事会社、株式会社sunrise。木造・鉄骨・RC造の建屋解体、内装解体（スケルトン工事）、オフィス・店舗の原状回復、アスベスト調査・除去に対応。名古屋市をはじめ愛知・岐阜・三重・静岡・滋賀で現地調査・お見積り無料。'),
  'building': dict(file='building.html', jp='建屋解体', en='Building Demolition',
                   title='建屋解体（木造・鉄骨・RC造）｜愛知県あま市の解体工事 株式会社sunrise',
                   desc='木造住宅・アパート・店舗・倉庫の建屋解体なら愛知県あま市の株式会社sunrise。基礎撤去・整地・各種届出まで一貫対応。名古屋市・愛知県全域、岐阜・三重・静岡・滋賀も対応。現地調査・お見積り無料。'),
  'interior': dict(file='interior.html', jp='内装解体', en='Interior Strip-out',
                   title='内装解体・スケルトン工事｜愛知・名古屋エリア 株式会社sunrise',
                   desc='店舗・オフィス・マンション住戸の内装解体、スケルトン工事は愛知県あま市の株式会社sunriseへ。営業中のビルでも騒音・粉じんを抑えて施工。名古屋市ほか東海エリア対応、お見積り無料。'),
  'restore':  dict(file='restore.html', jp='原状回復', en='Restoration',
                   title='原状回復工事（オフィス・店舗）｜愛知県あま市 株式会社sunrise',
                   desc='賃貸オフィス・店舗の原状回復、スケルトン返しは株式会社sunrise。工事区分表に沿ってお見積りし、退去日に間に合わせて引き渡します。愛知県あま市・名古屋市ほか東海エリア対応。'),
  'asbestos': dict(file='asbestos.html', jp='アスベスト調査・除去', en='Asbestos',
                   title='アスベスト事前調査・除去｜愛知県あま市の解体工事 株式会社sunrise',
                   desc='解体・改修工事前に義務づけられたアスベスト（石綿）の事前調査から、含有建材の除去・処分まで法令に沿って対応。愛知県あま市の株式会社sunrise。名古屋市ほか東海エリア、ご相談無料。'),
}

EXTRA = {
  'area':   dict(file='area.html', jp='対応エリア', en='Area',
                 title='対応エリア｜あま市・名古屋市・愛知県全域の解体工事 株式会社sunrise',
                 desc='株式会社sunriseの対応エリア。愛知県あま市を拠点に、名古屋市16区・海部津島・尾張・三河の愛知県全域と、岐阜県・三重県・静岡県・滋賀県で解体工事・内装解体・原状回復・アスベスト除去に対応。現地調査・お見積り無料。'),
  'faq':    dict(file='faq.html', jp='よくあるご質問', en='FAQ',
                 title='よくあるご質問｜解体工事・内装解体・原状回復 株式会社sunrise（愛知県あま市）',
                 desc='解体工事の費用・工期・補助金・アスベスト調査・解体後の手続きなど、よくいただくご質問にお答えします。愛知県あま市の解体工事会社、株式会社sunrise。'),
  'column': dict(file='column.html', jp='コラム', en='Column',
                 title='解体工事コラム｜補助金・アスベスト・費用・手続き 株式会社sunrise',
                 desc='解体工事の補助金、アスベスト事前調査、費用が決まるポイント、解体前後の手続き、原状回復とスケルトン工事の違いなど、解体の前に知っておきたいことを愛知県あま市の解体業者が解説します。'),
}
EXTRA['recruit'] = dict(file='recruit.html', jp='採用情報', en='Recruit', title=recruit.TITLE, desc=recruit.DESC)
# 地域ページ：/area-ama など（area.html と同じ名前のフォルダを作らないよう、フォルダにせずファイル名で分ける）
for _r in region.REGIONS:
    EXTRA['area-' + _r['slug']] = dict(file='area-%s.html' % _r['slug'], jp=_r['jp'], en='Area',
                                       title=_r['title'], desc=_r['desc'], reg=_r)
for _c in extra.COLUMNS:
    EXTRA['col-' + _c['slug']] = dict(file='column/%s.html' % _c['slug'], jp=_c['short'], en='Column',
                                      title=_c['title'] + '｜株式会社sunrise', desc=_c['desc'], col=_c)

# ---------- split source ----------
head_links = re.search(r'(<link rel="preconnect".*?<link rel="stylesheet"[^>]*>)', SRC, re.S).group(1)
css = re.search(r'<style>(.*?)</style>', SRC, re.S).group(1) + extra.EXTRA_CSS
js = re.search(r'<script>(.*?)</script>\s*$', SRC, re.S).group(1)
header = re.search(r'(<header class="hd".*?</header>)', SRC, re.S).group(1)
nav = re.search(r'(<nav class="nav".*?</nav>)', SRC, re.S).group(1)
footer = re.search(r'(<footer class="ft">.*?</footer>)', SRC, re.S).group(1)
contact = re.search(r'(<!-- =+ CONTACT =+ -->\s*<section class="ct w" id="contact">.*?</section>)', SRC, re.S).group(1)

def page_div(key):
    m = re.search(r'(<div class="page" data-page="%s"[^>]*>.*?)(?=<div class="page" data-page=|<!-- =+ CONTACT)' % key, SRC, re.S)
    return m.group(1).replace(' hidden>', '>', 1).rstrip()

# ---------- JS adjustments ----------
js = js.replace("const mv=document.querySelector('.mv'),cv=document.getElementById('cover');",
                "const mv=document.querySelector('.mv'),cv=document.getElementById('cover');\n  if(!mv)return;")
js = js.replace("tiles(document.getElementById('rowTop'),10,0);",
                "if(document.getElementById('rowTop'))tiles(document.getElementById('rowTop'),10,0);")
js = re.sub(r'/\* ---------- page router.*?\n\}\)\(\);\n', '', js, flags=re.S)
assert 'page router' not in js

# ---------- link rewriting ----------
SVC = ['building', 'interior', 'restore', 'asbestos']
HOME_ANCHORS = ['about', 'service', 'recruit', 'company', 'area']

def rewrite(h, is_home):
    for k in SVC:
        h = h.replace(f'href="#{k}"', f'href="{PAGES[k]["file"]}"')
    if is_home:
        return h
    for a in HOME_ANCHORS:
        h = h.replace(f'href="#{a}"', f'href="index.html#{a}"')
    h = h.replace('href="#top"', 'href="index.html"')
    return h

# ---------- images: real src in HTML (crawlable), lazy below the fold ----------
def real_imgs(h, eager_first=0):
    n = [0]
    def rep(m):
        tag = m.group(0)
        ph = re.search(r'data-photo="(\d+)"', tag)
        if not ph or ' src=' in tag:
            return tag
        n[0] += 1
        src = 'img/p%02d.%s' % (int(ph.group(1)), IMG_EXT)
        lazy = '' if n[0] <= eager_first else ' loading="lazy"'
        return tag[:-1].rstrip('/') + f' src="{src}"{lazy} decoding="async">'
    return re.sub(r'<img\b[^>]*>', rep, h)

def fill_alts(h, label):
    return re.sub(r'(<img\b[^>]*?)alt=""', lambda m: m.group(1) + f'alt="{label}"', h)

# ---------- structured data ----------
ORG = {
  "@context": "https://schema.org",
  "@type": "GeneralContractor",
  "name": "株式会社sunrise",
  "alternateName": "sunrise",
  "description": "愛知県あま市の解体工事会社。建屋解体・内装解体・原状回復・アスベスト調査・除去。",
  "telephone": "+81-90-7686-6461",
  "address": {"@type": "PostalAddress", "addressRegion": "愛知県", "addressLocality": "あま市", "addressCountry": "JP"},
  "areaServed": [{"@type": "AdministrativeArea", "name": a} for a in AREA],
  "founder": {"@type": "Person", "name": "松浦 恒裕"},
  "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}} for n in ['建屋解体', '内装解体', '原状回復', 'アスベスト調査・除去']],
}

def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False) + '</script>'

def faq_ld(h):
    items = re.findall(r'<summary><span class="q">Q</span>(.*?)</summary><p><span class="a">A</span><span class="at">(.*?)</span></p>', h, re.S)
    if not items:
        return ''
    clean = lambda t: re.sub(r'<[^>]+>', '', t).strip()
    return jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                   "mainEntity": [{"@type": "Question", "name": clean(q), "acceptedAnswer": {"@type": "Answer", "text": clean(a)}} for q, a in items]})

# 同じ名前のページとフォルダ（column.html と column/）があると GitHub Pages では /column が開けないため、
# こうしたページはフォルダの index.html として書き出し、アドレスは /column/ にする。
DIR_INDEX = {'column.html'}

def pretty(file):
    if file == 'index.html':
        return ''
    return file[:-5] + '/' if file in DIR_INDEX else file[:-5]

def out_file(file):
    return file[:-5] + '/index.html' if file in DIR_INDEX else file

def url(file):
    return (DOMAIN.rstrip('/') + '/' + pretty(file)) if DOMAIN else None

# Google Search Console の所有者確認タグ（HTMLタグ方式）。新しいプロパティ用のコードを追加するときはこのリストに足す。
GSC_CODES = ['EHD7npFsME_y0lUbSd0gFg4Rdw76JanglOKxe1ocs6U']
# Search Console の所有者確認ファイル（HTMLファイル方式）。消すと確認が外れるので残しておく。
GSC_FILES = ['google8acb34de16487f3d.html']
GSC = '\n'.join(f'<meta name="google-site-verification" content="{c}">' for c in GSC_CODES)

def clean_links(h):
    for k, p in list(PAGES.items()) + list(EXTRA.items()):
        if p['file'] != 'index.html':
            h = h.replace(f'href="{p["file"]}"', f'href="{BASE}/{pretty(p["file"])}"')
    h = h.replace('href="index.html#', f'href="{BASE}/#').replace('href="index.html"', f'href="{BASE}/"')
    # absolute asset paths so nested pages (/column/...) work
    h = h.replace('href="assets/', f'href="{BASE}/assets/').replace('src="assets/', f'src="{BASE}/assets/')
    h = h.replace('src="img/', f'src="{BASE}/img/').replace('href="img/', f'href="{BASE}/img/')
    # <picture><source srcset="img/…"> も絶対パスに。公開用は写真を webp で置くので拡張子も合わせる
    h = re.sub(r'srcset="img/(p\d+)\.jpg"', lambda m: f'srcset="{BASE}/img/{m.group(1)}.{IMG_EXT}"', h)
    h = h.replace('srcset="img/', f'srcset="{BASE}/img/')
    return h

def head(key):
    p = PAGES.get(key) or EXTRA[key]
    t, d = html.escape(p['title']), html.escape(p['desc'])
    lines = [f'<title>{t}</title>', f'<meta name="description" content="{d}">', GSC,
             '<meta name="robots" content="index,follow">',
             '<meta name="format-detection" content="telephone=no">',
             f'<meta property="og:type" content="{"website" if key in ("index",) else "article"}">',
             f'<meta property="og:title" content="{t}">', f'<meta property="og:description" content="{d}">',
             '<meta property="og:site_name" content="株式会社sunrise">', '<meta property="og:locale" content="ja_JP">',
             '<meta property="og:image" content="img/p01.jpg">', '<meta name="twitter:card" content="summary_large_image">',
             '<link rel="icon" href="img/favicon-48.png" sizes="48x48" type="image/png">',
             '<link rel="apple-touch-icon" href="img/apple-touch-icon.png">',
             '<meta name="theme-color" content="#17263D">']
    u = url(p['file'])
    if u:
        lines += [f'<link rel="canonical" href="{u}">', f'<meta property="og:url" content="{u}">']
        lines[10] = f'<meta property="og:image" content="{DOMAIN.rstrip("/")}/img/p01.jpg">'
    lines.append(head_links)
    lines.append('<link rel="stylesheet" href="assets/style.css">')
    org = dict(ORG)
    if DOMAIN:
        root = DOMAIN.rstrip('/') + '/'
        org["url"] = root
        # 検索結果に会社のロゴ・写真を出すための情報
        org["logo"] = root + 'img/apple-touch-icon.png'
        org["image"] = root + 'img/p01.jpg'
    lines.append(jsonld(org))
    if key == 'index' and DOMAIN:
        # 検索結果の上に URL ではなく「株式会社sunrise」とサイト名を出すための情報
        lines.append(jsonld({"@context": "https://schema.org", "@type": "WebSite",
                             "name": "株式会社sunrise", "alternateName": "sunrise",
                             "url": DOMAIN.rstrip('/') + '/', "inLanguage": "ja"}))
    if key != 'index':
        trail = [('トップ', url('index.html'))]
        if 'col' in p:
            trail.append(('コラム', url('column.html')))
        if 'reg' in p:
            trail.append(('対応エリア', url('area.html')))
        trail.append((p['jp'], u))
        crumbs = [{"@type": "ListItem", "position": i + 1, "name": n, "item": it} for i, (n, it) in enumerate(trail)]
        lines.append(jsonld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumbs}))
    if 'col' in p:
        lines.append(jsonld({"@context": "https://schema.org", "@type": "Article", "headline": p['col']['title'],
                             "description": p['desc'], "datePublished": p['col']['date'], "dateModified": p['col']['date'],
                             "image": DOMAIN.rstrip('/') + '/img/p%02d.%s' % (p['col']['photo'], 'jpg' if COMPAT else 'webp'),
                             "mainEntityOfPage": u,
                             "author": {"@type": "Organization", "name": "株式会社sunrise", "url": DOMAIN},
                             "publisher": {"@type": "Organization", "name": "株式会社sunrise",
                                           "logo": {"@type": "ImageObject", "url": DOMAIN.rstrip('/') + '/img/apple-touch-icon.png'}}}))
    if key in SVC:
        lines.append(jsonld({"@context": "https://schema.org", "@type": "Service", "name": p['jp'], "serviceType": p['jp'],
                             "provider": {"@type": "GeneralContractor", "name": "株式会社sunrise"},
                             "areaServed": [{"@type": "AdministrativeArea", "name": a} for a in AREA]}))
    return '\n'.join(lines)

# ---------- body per page ----------
AREA_LINE = '<p class="svc-desc svc-area">愛知県あま市を拠点に、名古屋市をはじめとする愛知県全域と、岐阜県・三重県・静岡県・滋賀県で対応しています。<br>その他の地域もご相談ください。</p>'

def body(key):
    is_home = key == 'index'
    if is_home:
        main = page_div('home')
        main = main.replace('<h1 class="sr">株式会社sunrise｜建屋解体・内装解体・原状回復</h1>',
                            '<h1 class="sr">愛知県あま市の解体工事・内装解体・原状回復・アスベスト調査｜株式会社sunrise</h1>')
        main = fill_alts(main, '株式会社sunriseの解体工事の現場写真')
        main = real_imgs(main, eager_first=1)
    elif key in EXTRA:
        p = EXTRA[key]
        if key == 'area':
            main = extra.area_page()
        elif 'reg' in p:
            main = region.page(p['reg'])
        elif key == 'recruit':
            main = recruit.page(SRC)
        elif key == 'faq':
            sf = []
            for k in SVC:
                d = page_div(k)
                inner = re.search(r'<div class="faq">.*?</div>(?=\s*</section>)', d, re.S).group(0)
                sf.append((PAGES[k]['jp'], PAGES[k]['file'], inner))
            main = extra.faq_page(sf)
        elif key == 'column':
            main = extra.column_index()
        else:
            main = extra.column_page(p['col'])
        main = fill_alts(main, p['jp'] + 'の関連写真')
        main = real_imgs(main, eager_first=1)
    else:
        p = PAGES[key]
        main = page_div(key)
        if WITH_EXTRA:
            main = main.replace('  <section class="pg-sec w">\n    <div class="pg-sec-hd"><h2>OTHER</h2>',
                                extra.related_block(key) + '  <section class="pg-sec w">\n    <div class="pg-sec-hd"><h2>OTHER</h2>', 1)
            # 詳しい解説（対応物件・費用の要素・近隣対策・トラブル）を「お見積り」の前に入れる
            main = main.replace('  <section class="pg-cta w">', service_detail.service_detail(key) + '  <section class="pg-cta w">', 1)
        main = re.sub(r'<h1 class="pg-title">(.*?)</h1>',
                      lambda m: f'<h1 class="pg-title">{m.group(1)}<span class="sr">{p["jp"]}｜愛知県あま市の解体工事 株式会社sunrise</span></h1>',
                      main, count=1)
        # regional line under the description
        main = re.sub(r'(<p class="svc-desc">.*?</p>)', lambda m: m.group(1) + '\n      ' + AREA_LINE, main, count=1, flags=re.S)
        main = fill_alts(main, f'{p["jp"]}の施工写真')
        main = real_imgs(main, eager_first=1)
    nav_h = real_imgs(fill_alts(nav, '解体工事の現場'))
    if WITH_EXTRA:
        # メニューの「RECRUIT 採用情報」は採用ページ（/recruit）を開く
        nav_h = nav_h.replace('<a href="#recruit"><span class="n">RECRUIT</span>', '<a href="recruit.html"><span class="n">RECRUIT</span>', 1)
    ft = footer
    if WITH_EXTRA:
        ft = ft.replace('<a href="#contact">Contact</a></nav>',
                        '<a href="area.html">Area</a><a href="faq.html">FAQ</a><a href="column.html">Column</a><a href="#contact">Contact</a></nav>', 1)
        # 地域ページへのリンク（フッター）
        ft = ft.replace('</nav>\n  </div>', '</nav>\n    <nav class="ft-reg" aria-label="地域別のご案内">'
                        + ''.join(f'<a href="{f}">{t}</a>' for f, t in region.LINK_LABELS) + '</nav>\n  </div>', 1)
        # 採用：フッターは採用ページへ、トップの採用欄の下に詳細へのリンク
        ft = ft.replace('<a href="#recruit">Recruit</a>', '<a href="recruit.html">Recruit</a>', 1)
        if is_home:
            main = re.sub(r'(<section class="svc rec w" id="recruit">.*?)(</section>)',
                          lambda m: m.group(1) + '<p class="rec-more" style="margin-top:28px"><a class="more" href="recruit.html">採用情報を詳しく見る <i>→</i></a></p>\n' + m.group(2),
                          main, count=1, flags=re.S)
            main = main.replace('<p class="map-src">', '<p><a class="more" href="area.html">対応市町村を見る <i>→</i></a></p>\n    '
                                '<p class="map-note map-reg">地域別のご案内：' + '／'.join(f'<a href="{f}">{t}</a>' for f, t in region.LINK_LABELS)
                                + '</p>\n    <p class="map-src">', 1)
    parts = [header, nav_h, '<main>', main, contact, '</main>', ft]
    b = '\n\n'.join(parts)
    b = rewrite(b, is_home)
    # 未記入の項目（src/site.html の <span class="todo">[ …を入力 ]</span>）は公開ページに出さない。
    # 値が決まったら src/site.html の該当行を書き換えれば自動で表示される。
    b = re.sub(r'\n?[ \t]*<div><dt>[^<]*</dt><dd><span class="todo">.*?</span></dd></div>', '', b)
    b += '\n<script src="assets/main.js"></script>'
    return b

# セキュリティ用の meta（全ページの <head> の先頭近くに入る）。
# 外部から読み込めるのは Google Fonts と、フォーム送信先の Google Apps Script だけに制限している。
# 新しく外部サービス（地図・動画・解析タグなど）を使うときは、ここに許可先を足さないとブロックされる。
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; "
       "connect-src https://script.google.com https://script.googleusercontent.com; form-action 'self'; "
       "base-uri 'self'; object-src 'none'; frame-src 'none'; upgrade-insecure-requests")
SECURITY_META = (f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
                 '<meta name="referrer" content="strict-origin-when-cross-origin">\n')

def full_doc(key):
    return ('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n' + SECURITY_META +
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head(key) + '\n</head>\n<body>\n' + body(key) + '\n</body>\n</html>\n')

def preview_index():
    # artifact skeleton adds doctype/html/head/body; keep title first
    return head('index') + '\n' + body('index') + '\n'

# ---------- write ----------
# ---------- image assets ----------
from PIL import Image
os.makedirs('img_web', exist_ok=True)
for f in sorted(os.listdir('img_opt')):
    if f.endswith('.jpg'):
        w = 'img_web/' + f[:-4] + '.webp'
        if not os.path.exists(w):
            Image.open('img_opt/' + f).save(w, 'WEBP', quality=74, method=6)
for f in ['logo-white.png', 'logo-ink.png']:
    im = Image.open('img/' + f); im.thumbnail((460, 460)); im.save('img_web/' + f, optimize=True)
if not os.path.exists('img_web/apple-touch-icon.png'):
    mark = Image.open('img/logo-ink.png').convert('RGBA').crop((530, 0, 1314, 600))
    for name, size in [('apple-touch-icon.png', 180), ('favicon-48.png', 48), ('icon-512.png', 512)]:
        bg = Image.new('RGBA', (size, size), (23, 38, 61, 255))
        m = mark.copy(); m.thumbnail((int(size * .78), int(size * .78)), Image.LANCZOS)
        bg.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2 + size // 40))
        bg.convert('RGB').save('img_web/' + name, optimize=True)

def write(path, doc):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'w', encoding='utf-8').write(doc)

JS_BASE = js
COMPAT = os.environ.get('COMPAT') == '1'   # browser-assembled deploy: jpg photos, original logos
for out in ['dist', 'preview']:
    is_dist = out == 'dist'
    WITH_EXTRA = is_dist
    IMG_EXT = 'webp' if (is_dist and not COMPAT) else 'jpg'
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out + '/assets'); os.makedirs(out + '/img')
    open(out + '/assets/style.css', 'w', encoding='utf-8').write(css.strip() + '\n')
    j = JS_BASE
    if is_dist:
        j = j.replace("`img/p${String(n).padStart(2,'0')}.jpg`", "`%s/img/p${String(n).padStart(2,'0')}.%s`" % (BASE, IMG_EXT))
        j = j.replace("LOGO.src='img/logo-ink.png'", "LOGO.src='%s/img/logo-ink.png'" % BASE)
        assert BASE + '/img/p$' in j and "'%s/img/logo-ink.png'" % BASE in j
    open(out + '/assets/main.js', 'w', encoding='utf-8').write(j.strip() + '\n')
    for f in os.listdir('img_opt'):
        if not is_dist or COMPAT or f == 'p01.jpg':                        # dist: jpg only for og:image
            shutil.copy('img_opt/' + f, out + '/img/' + f)
    for f in os.listdir('img_web'):
        if COMPAT and is_dist and f.endswith('.webp'): continue
        if COMPAT and is_dist and f in ('logo-ink.png', 'logo-white.png', 'icon-512.png'):
            if f != 'icon-512.png': shutil.copy('img/' + f, out + '/img/' + f)
            continue
        if (is_dist and f != 'icon-512.png') or f.endswith('.png'):
            shutil.copy('img_web/' + f, out + '/img/' + f)
    pages = list(PAGES.items()) + (list(EXTRA.items()) if is_dist else [])
    for key, p in pages:
        doc = preview_index() if (out == 'preview' and key == 'index') else full_doc(key)
        if key != 'index':
            doc = doc.replace('</head>', faq_ld(body(key)) + '\n</head>', 1)
        if is_dist:
            doc = clean_links(doc)
        write(f'{out}/{out_file(p["file"]) if is_dist else p["file"]}', doc)


# ---------- 採用ページ（/recruit）はユーザーが選んだ専用デザイン版で上書き ----------
# site-src/recruit_page/page.html（完成HTML）と recruit.js をそのまま置く。CSP対応済み（インラインscriptなし）。
# ※ページ一覧・サイトマップ・リンクは EXTRA['recruit'] のまま使う。文章・デザインはユーザー確認済みの版なので変更しない。
shutil.copy('recruit_page/page.html', 'dist/recruit.html')
shutil.copy('recruit_page/recruit.js', 'dist/assets/recruit.js')

# ---------- 404 ----------
NOTFOUND = ('<main><div class="page" data-page="notfound"><header class="pg-hd w"><div class="pg-hd-l">\n'
            '<p class="svc-no">404 NOT FOUND</p><h1 class="pg-title">404</h1><p class="pg-jp">ページが見つかりません</p>\n'
            '<p class="pg-lead">お探しのページは移動したか、削除された可能性があります。<br>'
            '<a class="more" href="index.html">トップへ戻る <i>→</i></a></p>\n</div></header></div></main>')
WITH_EXTRA, IMG_EXT = True, ('jpg' if COMPAT else 'webp')
nf = full_doc('index')
nf = re.sub(r'<main>.*</main>', lambda m: NOTFOUND, nf, flags=re.S)
nf = re.sub(r'<link rel="canonical"[^>]*>\n?|<meta property="og:url"[^>]*>\n?', '', nf)
nf = nf.replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex">')
nf = re.sub(r'<title>.*?</title>', '<title>ページが見つかりません｜株式会社sunrise</title>', nf)
write('dist/404.html', clean_links(nf))

# ---------- GitHub Pages: Jekyll を通さずそのまま公開 ----------
write('dist/.nojekyll', '')
for _f in GSC_FILES:
    write('dist/' + _f, 'google-site-verification: ' + _f + '\n')
# 独自ドメイン（例: https://sunrise-kaitai.jp）にしたときは GitHub Pages 用の CNAME を自動で置く
if DOMAIN and not urlparse(DOMAIN).netloc.endswith('github.io'):
    write('dist/CNAME', urlparse(DOMAIN).netloc + '\n')

# ---------- cache headers (Cloudflare Pages のみ有効。GitHub Pages では publish.sh が除外) ----------
write('dist/_headers', "/assets/*\n  Cache-Control: public, max-age=604800\n/img/*\n  Cache-Control: public, max-age=2592000\n"
                       "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n")

# robots / sitemap
robots = 'User-agent: *\nAllow: /\n' + (f'Sitemap: {DOMAIN.rstrip("/")}/sitemap.xml\n' if DOMAIN else '')
open('dist/robots.txt', 'w').write(robots)
if DOMAIN:
    import datetime
    today = datetime.date.today().isoformat()
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for key, p in list(PAGES.items()) + list(EXTRA.items()):
        pr = '1.0' if key == 'index' else ('0.8' if key in SVC else ('0.7' if (key in ('area', 'faq', 'column') or key.startswith('area-')) else '0.6'))
        sm += f'  <url><loc>{url(p["file"])}</loc><lastmod>{today}</lastmod><priority>{pr}</priority></url>\n'
    sm += '</urlset>\n'
    open('dist/sitemap.xml', 'w').write(sm)
print('built', sorted(os.listdir('dist')), sorted(os.listdir('dist/column')))
