"""管理画面（/line/hp/）で直した文字・写真を、公開用のページに反映する。

しくみ
  1. ビルドが終わったページ（dist/*.html）の、文字のかたまり（見出し・文章・ボタンなど）と写真に
     目印 data-cms="…" / data-cms-img="…" を付ける。目印は「元の中身」から作るので、ビルドし直しても同じになる。
  2. content/edits.json に入っている書き換えを、その目印の場所に当てはめる。
       {"t": {目印: ["文字1", "文字2", …]}, "i": {目印: "up/ファイル名.jpg"}}
     文字は「文字の切れ目」（太字・リンクなどの区切り）ごとの配列。改行は <br> にする。
     文字はすべてエスケープして入れるので、HTML やスクリプトは入らない。
  3. 管理画面が今の書き換えを読めるように、dist/cms/edits.json にも同じものを置く。

ページのHTMLは読み直して書き出すのではなく、目印と書き換えた所だけを差し込む（それ以外の文字・空白は1文字も変えない）。
ヘッダー・メニュー・フッターの中の文字と写真は全ページ共通（どのページで直しても全ページに反映）。
"""
import hashlib
import html
import json
import os
import re
from html.parser import HTMLParser

CONTENT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'content')
EDITS_FILE = os.path.join(CONTENT, 'edits.json')

INLINE = {'span', 'b', 'strong', 'em', 'i', 'small', 'br', 'wbr', 'a', 'sup', 'sub', 'mark', 'u', 's',
          'time', 'abbr', 'code', 'ruby', 'rt', 'rp', 'q', 'cite', 'bdi', 'data'}
SKIP = {'script', 'style', 'noscript', 'svg', 'template', 'head', 'title', 'textarea', 'select', 'option', 'iframe'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
COMMON = {'header', 'footer', 'nav'}          # body 直下のこれらの中は全ページ共通の目印にする
IMG_OK = re.compile(r'^up/[a-z0-9][a-z0-9-]{0,80}\.(?:jpg|jpeg|webp|png)$')


def load_edits():
    try:
        d = json.load(open(EDITS_FILE, encoding='utf-8'))
    except FileNotFoundError:
        d = {}
    return {'t': dict(d.get('t') or {}), 'i': dict(d.get('i') or {}), 'rev': str(d.get('rev') or '')}


class Node:
    __slots__ = ('name', 'attrs', 'start', 'open_end', 'end', 'children', 'parent')

    def __init__(self, name, attrs, start, open_end, parent):
        self.name, self.attrs, self.start, self.open_end, self.parent = name, attrs, start, open_end, parent
        self.end = None          # 終了タグの「<」の位置（空要素は開始タグの直後）
        self.children = []


class Text:
    __slots__ = ('start', 'end', 'parent')

    def __init__(self, start, parent):
        self.start, self.parent, self.end = start, parent, None


class _Tree(HTMLParser):
    """どのタグ・文字が元のHTMLの何文字目から何文字目にあるかを記録する。"""

    def __init__(self, doc):
        super().__init__(convert_charrefs=True)
        self.doc = doc
        self.line_off = [0] + [m.end() for m in re.finditer('\n', doc)]
        self.root = Node('#root', [], 0, 0, None)
        self.cur = self.root
        self.last_text = None
        self.feed(doc)
        self.close()
        self._close_text(len(doc))

    def _pos(self):
        line, col = self.getpos()
        return self.line_off[line - 1] + col

    def _close_text(self, pos):
        if self.last_text is not None and self.last_text.end is None:
            self.last_text.end = pos
        self.last_text = None

    def _add(self, tag, attrs, void):
        p = self._pos()
        self._close_text(p)
        n = Node(tag, attrs, p, p + len(self.get_starttag_text()), self.cur)
        self.cur.children.append(n)
        if void or tag in VOID:
            n.end = n.open_end
        else:
            self.cur = n

    def handle_starttag(self, tag, attrs):
        self._add(tag, attrs, False)

    def handle_startendtag(self, tag, attrs):
        self._add(tag, attrs, True)

    def handle_endtag(self, tag):
        p = self._pos()
        self._close_text(p)
        node = self.cur
        while node is not self.root and node.name != tag:
            node = node.parent
        if node is self.root:
            return
        n = self.cur
        while n is not node:          # 閉じ忘れのタグはここで閉じる
            n.end = p
            n = n.parent
        node.end = p
        self.cur = node.parent

    def handle_data(self, data):
        if self.last_text is None:
            t = Text(self._pos(), self.cur)
            self.cur.children.append(t)
            self.last_text = t

    def _other(self, *a):
        self._close_text(self._pos())

    handle_comment = handle_decl = handle_pi = unknown_decl = _other


def _walk(n):
    for c in n.children:
        yield c
        if isinstance(c, Node):
            yield from _walk(c)


def _ancestors(n, stop=None):
    p = n.parent
    while p is not None and p is not stop:
        yield p
        p = p.parent


def apply(doc, page, edits, base=''):
    """1ページ分のHTMLに目印を付けて、書き換えを当てはめる。"""
    tree = _Tree(doc)
    body = next((n for n in _walk(tree.root) if isinstance(n, Node) and n.name == 'body'), None)
    if body is None:
        return doc

    def texts(el):
        """かたまりの中の「文字の切れ目」。空白だけのものは数えない（管理画面と同じ数え方）。"""
        out = []
        for c in _walk(el):
            if isinstance(c, Text) and c.end is not None \
                    and not any(a.name in SKIP for a in _ancestors(c, el)) \
                    and html.unescape(doc[c.start:c.end]).strip():
                out.append(c)
        return out

    holder_cache = {}

    def is_holder(el):
        if el not in holder_cache:
            ok = (el.name not in SKIP and el.name not in VOID and el.name not in ('html', 'body')
                  and el.end is not None
                  and all(c.name in INLINE for c in _walk(el) if isinstance(c, Node))
                  and bool(texts(el)))
            holder_cache[el] = ok
        return holder_cache[el]

    def scope(el):
        for a in _ancestors(el):
            if a.name in COMMON and a.parent is body:
                return 'common'
        return page

    seen = {}

    def key(prefix, sc, content):
        k = prefix + hashlib.sha1((sc + '\x00' + content).encode('utf-8')).hexdigest()[:10]
        n = seen.get(k, 0)
        seen[k] = n + 1
        return k if n == 0 else f'{k}-{n}'

    reps = []   # (開始, 終了, 入れる文字)

    def close_cut(el):
        tag = doc[el.start:el.open_end]
        return el.start + len(tag) - (2 if tag.endswith('/>') else 1)

    for el in _walk(body):
        if not isinstance(el, Node) or any(a.name in SKIP for a in _ancestors(el)):
            continue
        if el.name == 'img':
            src = dict(el.attrs).get('src') or ''
            if not src or '/img/logo' in src or 'icon' in src or src.startswith('data:'):
                continue
            k = key('i', scope(el), src)
            v = edits['i'].get(k)
            if v and IMG_OK.match(v):
                tag = doc[el.start:el.open_end]
                tag = re.sub(r'\s(?:srcset|sizes)="[^"]*"', '', tag)
                tag = re.sub(r'(\ssrc=")[^"]*(")', lambda m: m.group(1) + f'{base}/img/{v}' + m.group(2), tag, count=1)
                tag = tag[:len(tag) - (2 if tag.endswith('/>') else 1)].rstrip() + f' data-cms-img="{k}">'
                reps.append((el.start, el.open_end, tag))
                if el.parent is not None and el.parent.name == 'picture':
                    for s in el.parent.children:
                        if isinstance(s, Node) and s.name == 'source':
                            reps.append((s.start, s.open_end, ''))
            else:
                c = close_cut(el)
                reps.append((c, c, f' data-cms-img="{k}"'))
            continue
        if not is_holder(el) or (el.parent is not body and is_holder(el.parent)):
            continue
        inner = re.sub(r'\s+', ' ', doc[el.open_end:el.end]).strip()
        k = key('t', scope(el), el.name + '|' + inner)
        c = close_cut(el)
        reps.append((c, c, f' data-cms="{k}"'))
        v = edits['t'].get(k)
        if isinstance(v, list):
            segs = texts(el)
            if len(segs) == len(v):
                for s, val in zip(segs, v):
                    r = doc[s.start:s.end]
                    lead = r[:len(r) - len(r.lstrip())]
                    tail = r[len(r.rstrip()):]
                    val = str(val).replace('\r\n', '\n').replace('\r', '\n')
                    new = '<br>'.join(html.escape(x, quote=False) for x in val.split('\n'))
                    reps.append((s.start, s.end, lead + new + tail))
    reps.sort(key=lambda r: (r[0], r[1]), reverse=True)
    out = doc
    for a, b, t in reps:
        out = out[:a] + t + out[b:]
    return out


def run(dist, base=''):
    """dist の中のすべてのページに当てはめる（line/ と mitsumori/ は対象外）。"""
    edits = load_edits()
    n = 0
    pages = []
    for root, dirs, files in os.walk(dist):
        rel_root = os.path.relpath(root, dist)
        if rel_root.split(os.sep)[0] in ('line', 'mitsumori', 'cms'):
            continue
        for f in files:
            if not f.endswith('.html') or f.startswith('google'):
                continue
            path = os.path.join(root, f)
            page = os.path.relpath(path, dist).replace(os.sep, '/')
            doc = open(path, encoding='utf-8').read()
            open(path, 'w', encoding='utf-8').write(apply(doc, page, edits, base))
            n += 1
            if page != '404.html':
                t = re.search(r'<title>(.*?)</title>', doc, re.S)
                t = html.unescape(t.group(1)) if t else page
                pages.append({'p': page, 't': re.split(r'[｜|]', t)[0].strip()})
    order = lambda x: (x['p'] != 'index.html', x['p'].startswith('blog/'), x['p'].startswith('column/'), x['p'])
    for x in pages:
        if x['p'] == 'index.html':
            x['t'] = 'トップページ'
    os.makedirs(os.path.join(dist, 'cms'), exist_ok=True)
    json.dump(sorted(pages, key=order), open(os.path.join(dist, 'cms', 'pages.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(edits, open(os.path.join(dist, 'cms', 'edits.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    # 管理画面で差し替えた写真を公開用にコピー
    up = os.path.join(CONTENT, 'uploads')
    if os.path.isdir(up):
        os.makedirs(os.path.join(dist, 'img', 'up'), exist_ok=True)
        for f in os.listdir(up):
            if IMG_OK.match('up/' + f):
                with open(os.path.join(up, f), 'rb') as a, open(os.path.join(dist, 'img', 'up', f), 'wb') as b:
                    b.write(a.read())
    return n
