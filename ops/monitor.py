"""
公開サイトの自動監視（GitHub Actions から5分ごとに実行）。
  - サイトマップの全ページが表示できるか（200）、表示が遅すぎないか
  - ページ内の画像・CSS・JS・内部リンクが切れていないか
  - SEOの基本（タイトル・説明文・canonical・h1・構造化データ・noindex の混入）が崩れていないか
  - 旧アドレス（Cloudflare）からの転送状況（参考情報。失敗扱いにはしない）
問題があれば GitHub の Issue「サイト監視: 異常あり」を作成/更新し、直ったら自動で閉じる。
Issue が立つと GitHub からメールで届く（Claude のクレジットは使わない）。
"""
import os, re, sys, json, time, html, urllib.request, urllib.error
from urllib.parse import urljoin, urlparse

# 公開アドレスは site-src/build.py の DOMAIN から読む（独自ドメインに切り替えても自動で追従）
_here = os.path.dirname(os.path.abspath(__file__))
SITE = re.search(r"^DOMAIN = '([^']*)'", open(os.path.join(_here, '..', 'site-src', 'build.py'), encoding='utf-8').read(), re.M).group(1).rstrip('/') + '/'
BASE_PATH = urlparse(SITE).path.rstrip('/')
OLD = 'https://sunrise-kaitai.pages.dev'
UA = {'User-Agent': 'sunrise-site-monitor/1.0'}
SLOW = 5.0   # 秒。これより遅いページは警告

errors, warns, notes = [], [], []

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None

def get(url, follow=True, tries=3):
    last = None
    for i in range(tries):
        t = time.time()
        try:
            opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
            with opener.open(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.status, r.read(), time.time() - t, dict(r.headers)
        except urllib.error.HTTPError as e:
            last = (e.code, b'', time.time() - t, dict(e.headers or {}))
            if e.code < 500:
                return last
        except Exception as e:
            last = (0, str(e).encode(), time.time() - t, {})
        time.sleep(3 * (i + 1))
    return last

# ---- サイトマップ ----
st, body, _, _ = get(SITE + 'sitemap.xml')
if st != 200:
    errors.append(f'サイトマップが表示できない（{st}）')
    urls = [SITE]
else:
    urls = re.findall(r'<loc>(.*?)</loc>', body.decode('utf-8'))
    if len(urls) < 10:
        warns.append(f'サイトマップのURLが少ない（{len(urls)}件）')

assets = set()
titles, descs = {}, {}
for u in urls:
    st, b, sec, _ = get(u)
    if st != 200:
        errors.append(f'ページが表示できない（{st}）: {u}')
        continue
    if sec > SLOW:
        warns.append(f'表示が遅い（{sec:.1f}秒）: {u}')
    d = b.decode('utf-8', 'replace')
    t = re.search(r'<title>(.*?)</title>', d, re.S)
    if not t or not t.group(1).strip():
        errors.append(f'タイトルがない: {u}')
    else:
        titles.setdefault(t.group(1).strip(), []).append(u)
    m = re.search(r'<meta name="description" content="([^"]*)"', d)
    if not m or len(m.group(1)) < 50:
        errors.append(f'説明文（description）がない・短すぎる: {u}')
    else:
        descs.setdefault(m.group(1), []).append(u)
    c = re.search(r'<link rel="canonical" href="([^"]+)"', d)
    if not c or c.group(1).rstrip('/') != u.rstrip('/'):
        errors.append(f'canonical が正しくない（{c.group(1) if c else "なし"}）: {u}')
    if re.search(r'<meta name="robots" content="[^"]*noindex', d):
        errors.append(f'検索に出ない設定（noindex）が入っている: {u}')
    if re.search(r'\[ [^\]]*を入力 \]', d):
        errors.append(f'未記入の仮の文字（[ …を入力 ]）が表示されている: {u}')
    if len(re.findall(r'<h1\b', d)) != 1:
        warns.append(f'h1 が1つではない: {u}')
    for j in re.findall(r'<script type="application/ld\+json">(.*?)</script>', d, re.S):
        try:
            json.loads(j)
        except Exception:
            errors.append(f'構造化データが壊れている: {u}')
    for ref in re.findall(r'\b(?:href|src)="([^"#]+)"', d):
        a = urljoin(u, html.unescape(ref))
        if a.startswith(SITE.rstrip('/')) or (BASE_PATH and urlparse(a).path.startswith(BASE_PATH)):
            assets.add(a)

for t, us in titles.items():
    if len(us) > 1:
        warns.append(f'タイトルが重複: {t}（{len(us)}ページ）')
for t, us in descs.items():
    if len(us) > 1:
        warns.append(f'説明文が重複（{len(us)}ページ）: {us[0]} ほか')

for a in sorted(assets - set(urls)):
    st, _, _, _ = get(a)
    if st != 200:
        errors.append(f'リンク切れ・画像などが読めない（{st}）: {a}')

# ---- robots.txt / 404 ----
st, _, _, _ = get(SITE + 'robots.txt')
if st != 200:
    warns.append(f'robots.txt が表示できない（{st}）')
st, _, _, _ = get(SITE + 'this-page-should-not-exist-check')
if st != 404:
    warns.append(f'存在しないページが404にならない（{st}）')

# ---- 旧アドレスからの転送（参考） ----
st, _, _, h = get(OLD + '/building', follow=False)
loc = h.get('Location') or h.get('location') or ''
if st in (301, 308) and loc.startswith(SITE.rstrip('/')):
    notes.append('旧アドレスからの転送: OK')
else:
    notes.append(f'旧アドレスからの転送: まだ設定されていない（{st} {loc}）')

# ---- 結果 ----
lines = [f'## サイト監視 {time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}',
         f'- 確認したページ: {len(urls)} / 画像・リンクなど: {len(assets)}']
lines += ['', '### 異常（すぐ直す必要あり）'] + ([f'- {e}' for e in errors] or ['- なし'])
lines += ['', '### 注意'] + ([f'- {w}' for w in warns] or ['- なし'])
lines += ['', '### 参考'] + [f'- {n}' for n in notes]
report = '\n'.join(lines)
print(report)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write(report + '\n')

# ---- Issue で知らせる（異常のときだけ作成、直ったら閉じる） ----
token, repo = os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY')
TITLE = 'サイト監視: 異常あり'
def api(method, path, data=None):
    req = urllib.request.Request('https://api.github.com/repos/' + repo + path, method=method,
                                 data=json.dumps(data).encode() if data else None,
                                 headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')
if token and repo:
    try:
        open_issues = [i for i in api('GET', '/issues?state=open&labels=site-monitor&per_page=10') if i['title'] == TITLE]
        key = '<!-- errors:' + json.dumps(sorted(errors), ensure_ascii=False) + ' -->'
        if errors and not open_issues:
            api('POST', '/issues', {'title': TITLE, 'labels': ['site-monitor'], 'body': report + '\n' + key})
        elif errors and key not in (open_issues[0]['body'] or ''):
            # 異常の内容が変わったときだけ更新（5分ごとに同じ報告を重ねない）
            n = open_issues[0]['number']
            api('POST', f'/issues/{n}/comments', {'body': report})
            api('PATCH', f'/issues/{n}', {'body': report + '\n' + key})
        elif not errors and open_issues:
            n = open_issues[0]['number']
            api('POST', f'/issues/{n}/comments', {'body': '復旧を確認しました。\n\n' + report})
            api('PATCH', f'/issues/{n}', {'state': 'closed', 'state_reason': 'completed'})
    except Exception as e:
        print('Issue の更新に失敗:', e)

sys.exit(1 if errors else 0)
