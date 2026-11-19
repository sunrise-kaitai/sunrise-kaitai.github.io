"""ブログ・お知らせ（管理画面 /line/hp/ から書いた記事）を公開用のページにする。

記事は content/posts/<id>.json に1件ずつ入っている（管理画面が Apps Script 経由で保存する）。
  {"id": "20261119-ab12", "date": "2026-11-19", "cat": "blog" または "news",
   "title": "…", "body": "…", "photos": ["up/….jpg", …], "draft": false}
本文は文字だけ。空行で段落、行頭が「■」の行は見出しになる。すべてエスケープして入れる。

できるページ
  /blog/             一覧（ブログ・お知らせをまとめて新しい順）
  /blog/<id>         記事ページ
  トップページの「NEWS」欄（新しい3件）
  /blog/posts.json   管理画面が一覧を読むためのデータ
"""
import html
import json
import os
import re

from extra import br, cta, pg_header

CONTENT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'content')
POSTS_DIR = os.path.join(CONTENT, 'posts')
ID_OK = re.compile(r'^[0-9]{8}-[a-z0-9]{2,12}$')
PHOTO_OK = re.compile(r'^up/[a-z0-9][a-z0-9-]{0,80}\.(?:jpg|jpeg|webp|png)$')
CATS = {'blog': 'ブログ', 'news': 'お知らせ'}


def load_posts():
    posts = []
    if not os.path.isdir(POSTS_DIR):
        return posts
    for f in os.listdir(POSTS_DIR):
        if not f.endswith('.json'):
            continue
        try:
            p = json.load(open(os.path.join(POSTS_DIR, f), encoding='utf-8'))
        except Exception:
            continue
        if not ID_OK.match(str(p.get('id', ''))) or p.get('draft'):
            continue
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(p.get('date', ''))):
            continue
        p['cat'] = p.get('cat') if p.get('cat') in CATS else 'blog'
        p['title'] = str(p.get('title', '')).strip()[:120] or '（題名なし）'
        p['body'] = str(p.get('body', ''))[:20000]
        p['photos'] = [x for x in (p.get('photos') or []) if isinstance(x, str) and PHOTO_OK.match(x)][:10]
        posts.append(p)
    posts.sort(key=lambda p: (p['date'], p['id']), reverse=True)
    return posts


POSTS = load_posts()


def date_jp(d):
    return d.replace('-', '.')


def plain(p, n):
    t = re.sub(r'\s+', ' ', re.sub(r'^■', '', p['body'], flags=re.M)).strip()
    return t if len(t) <= n else t[:n] + '…'


def desc(p):
    return (plain(p, 110) or p['title']) + '｜株式会社sunrise（愛知県あま市の解体工事）'


def register(extra_pages):
    """build.py の EXTRA にページを登録する（サイトマップ・リンクの書き換えに使われる）。記事が0件なら何も作らない。"""
    if not POSTS:
        return
    extra_pages['blog'] = dict(file='blog.html', jp='ブログ・お知らせ', en='Blog',
                               title='ブログ・お知らせ｜愛知県あま市の解体工事 株式会社sunrise',
                               desc='愛知県あま市の解体工事会社、株式会社sunriseのブログとお知らせ。現場のようす、会社からのお知らせを載せています。')
    for p in POSTS:
        extra_pages['post-' + p['id']] = dict(file='blog/%s.html' % p['id'], jp=p['title'], en='Blog',
                                              title=p['title'] + '｜株式会社sunrise', desc=desc(p), post=p)


def body_html(text):
    out = []
    for block in re.split(r'\n\s*\n', text.replace('\r\n', '\n').replace('\r', '\n').strip()):
        lines = [l.rstrip() for l in block.split('\n') if l.strip()]
        if not lines:
            continue
        para = []
        for l in lines:
            if l.lstrip().startswith('■'):
                if para:
                    out.append('<p>' + '<br>'.join(para) + '</p>')
                    para = []
                out.append('<h2>' + html.escape(l.lstrip()[1:].strip()) + '</h2>')
            else:
                para.append(br(html.escape(l)))
        if para:
            out.append('<p>' + '<br>'.join(para) + '</p>')
    return '\n'.join(out)


def thumb(p, cls='ph'):
    if p['photos']:
        return f'<div class="{cls}"><img src="img/{p["photos"][0]}" alt="" loading="lazy" decoding="async"></div>'
    return f'<div class="{cls} blog-noph"><span>SUNRISE</span></div>'


def card(p):
    return (f'<a class="col-card blog-card" href="blog/{p["id"]}.html">{thumb(p)}<div>'
            f'<p class="mono"><time datetime="{p["date"]}">{date_jp(p["date"])}</time>'
            f'<span class="blog-cat blog-cat-{p["cat"]}">{CATS[p["cat"]]}</span></p>'
            f'<b>{html.escape(p["title"])}</b><span>{html.escape(plain(p, 60))}</span></div></a>')


def index_page():
    if POSTS:
        inner = '<div class="col-grid">' + ''.join(card(p) for p in POSTS) + '</div>'
    else:
        inner = '<p class="blog-empty">まだ記事はありません。</p>'
    return f'''<div class="page" data-page="blog">
{pg_header('blog', 'BLOG', 'ブログ・お知らせ', '現場のようすや、会社からのお知らせを<br>載せています。', 4)}
  <section class="pg-sec w">
    {inner}
  </section>
{cta('解体のご相談・お見積りは無料です。', 'お気軽にお問い合わせください。')}
</div>'''


def post_page(p):
    photos = p['photos']
    gallery = ''
    if len(photos) > 1:
        gallery = '<div class="blog-gal">' + ''.join(
            f'<figure><img src="img/{x}" alt="{html.escape(p["title"])}の写真{i + 2}" loading="lazy" decoding="async"></figure>'
            for i, x in enumerate(photos[1:])) + '</div>'
    hero = (f'<div class="ph pg-photo"><img src="img/{photos[0]}" alt="{html.escape(p["title"])}" decoding="async"></div>'
            if photos else '')
    others = [o for o in POSTS if o['id'] != p['id']][:5]
    more = ''
    if others:
        more = ('  <section class="pg-sec w">\n    <div class="pg-sec-hd"><h2>MORE</h2><p>ほかの記事</p></div>\n'
                '    <ul class="art-list">' + ''.join(
                    f'<li><a href="blog/{o["id"]}.html">{html.escape(o["title"])}</a></li>' for o in others)
                + '</ul>\n  </section>\n')
    return f'''<div class="page" data-page="post-{p['id']}">
  <header class="pg-hd w{'' if photos else ' blog-hd-nophoto'}"><div class="pg-hd-l">
    <nav class="crumb mono" aria-label="現在地"><a href="index.html">TOP</a><span>/</span><a href="blog.html">BLOG</a><span>/</span><b>{CATS[p['cat']]}</b></nav>
    <p class="svc-no">{'NEWS' if p['cat'] == 'news' else 'BLOG'} <time datetime="{p['date']}">{date_jp(p['date'])}</time></p>
    <h1 class="art-title">{html.escape(p['title'])}</h1>
  </div>
  {hero}
  </header>
  <article class="pg-sec w art blog-art">
    {body_html(p['body'])}
    {gallery}
    <p class="art-by">株式会社sunrise（愛知県あま市の解体工事会社）</p>
  </article>
{more}{cta('解体のご相談・お見積りは無料です。', '現地調査のうえ、内訳のわかるお見積りをお出しします。', 'お見積り依頼', 'お見積りを依頼する')}
</div>'''


def home_block():
    """トップページの「NEWS」欄。記事がないときは出さない。"""
    if not POSTS:
        return ''
    return ('<section class="blog-home w" id="news">\n'
            '  <div class="pg-sec-hd"><h2>NEWS</h2><p>ブログ・お知らせ</p></div>\n'
            '  <div class="col-grid">' + ''.join(card(p) for p in POSTS[:3]) + '</div>\n'
            '  <p><a class="more" href="blog.html">記事をすべて見る <i>→</i></a></p>\n'
            '</section>\n')


def jsonld(p, domain, url):
    root = domain.rstrip('/')
    img = root + '/img/' + (p['photos'][0] if p['photos'] else 'p01.jpg')
    return {"@context": "https://schema.org", "@type": "BlogPosting" if p['cat'] == 'blog' else "NewsArticle",
            "headline": p['title'], "description": desc(p), "datePublished": p['date'], "dateModified": p['date'],
            "image": img, "mainEntityOfPage": url,
            "author": {"@type": "Organization", "name": "株式会社sunrise", "url": domain},
            "publisher": {"@type": "Organization", "name": "株式会社sunrise",
                          "logo": {"@type": "ImageObject", "url": root + '/img/apple-touch-icon.png'}}}


def posts_json(domain):
    """管理画面用：公開中の記事の一覧（本文つき）。"""
    root = domain.rstrip('/')
    return json.dumps([dict(id=p['id'], date=p['date'], cat=p['cat'], title=p['title'], body=p['body'],
                            photos=p['photos'], rev=str(p.get('rev') or ''), url=f'{root}/blog/{p["id"]}') for p in POSTS], ensure_ascii=False)


CSS = r'''
/* ---------- ブログ・お知らせ ---------- */
.blog-cat{display:inline-block;margin-left:10px;padding:1px 8px;font-size:11px;letter-spacing:.08em;border:1px solid var(--line);border-radius:2px}
.blog-cat-news{background:var(--sun);color:#fff;border-color:var(--sun)}
.blog-noph{display:flex;align-items:center;justify-content:center;background:#17263D;color:rgba(255,255,255,.5);font-weight:800;letter-spacing:.3em;aspect-ratio:4/3}
.blog-empty{color:var(--body)}
.blog-art{max-width:880px}
.blog-art p{white-space:normal}
.blog-gal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:1.6em 0}
.blog-gal figure{margin:0}
.blog-gal img{width:100%;height:auto;display:block}
.blog-home{padding-top:clamp(28px,4vw,56px);padding-bottom:clamp(28px,4vw,56px)}
.blog-home .more{margin-top:16px}
.blog-hd-nophoto{grid-template-columns:1fr!important}
@media (max-width:560px){.blog-gal{grid-template-columns:1fr}}
'''
