"""
週1回のSEO・表示速度チェック（GitHub Actions から実行。Claude は使わない）。
Google の Lighthouse で主要ページを「スマホ表示」で採点し、
SEO が 90 点未満・表示速度が 50 点未満のページがあれば Issue「週次チェック: 改善が必要」を立てる。
問題がなくなれば自動で閉じる。
問題の有無にかかわらず、毎週「週次レポート」を Issue として作る（リポジトリを Watch しているとメールで届く）。結果は毎回 Actions の「Summary」に表として残る。
"""
import os, re, sys, json, glob, time, urllib.request

_here = os.path.dirname(os.path.abspath(__file__))
SITE = re.search(r"^DOMAIN = '([^']*)'", open(os.path.join(_here, '..', 'site-src', 'build.py'), encoding='utf-8').read(), re.M).group(1).rstrip('/') + '/'
SEO_MIN, PERF_MIN = 90, 50
NAMES = {'seo': 'SEO', 'performance': '表示速度', 'accessibility': '見やすさ', 'best-practices': '安全性・作法'}

rows, problems = [], []
for f in sorted(glob.glob('lh/*.json')):
    d = json.load(open(f, encoding='utf-8'))
    url = d.get('finalDisplayedUrl') or d.get('finalUrl') or f
    sc = {k: round((v.get('score') or 0) * 100) for k, v in d['categories'].items()}
    rows.append((url, sc))
    if sc.get('seo', 0) < SEO_MIN:
        failed = [a['title'] for a in d['audits'].values()
                  if a.get('score') == 0 and a['id'] in {r['id'] for r in d['categories']['seo']['auditRefs']}]
        problems.append(f'SEO {sc["seo"]}点: {url}' + (f'（{" / ".join(failed[:4])}）' if failed else ''))
    if sc.get('performance', 0) < PERF_MIN:
        problems.append(f'表示速度 {sc["performance"]}点: {url}')

if not rows:
    problems.append('採点できたページがありませんでした（Lighthouse の実行に失敗）')

token, repo = os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY')
def api(method, path, data=None):
    req = urllib.request.Request('https://api.github.com/repos/' + repo + path, method=method,
                                 data=json.dumps(data).encode() if data else None,
                                 headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')

# この1週間の「サイト監視（5分ごと）」の結果をまとめる
monitor = ['- （監視結果を取得できませんでした）']
if token and repo:
    try:
        since = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 7 * 86400))
        runs, page = [], 1
        while page <= 10:
            r = api('GET', f'/actions/workflows/site-monitor.yml/runs?created=%3E{since}&per_page=100&page={page}')
            runs += r['workflow_runs']
            if len(r['workflow_runs']) < 100:
                break
            page += 1
        done = [r for r in runs if r['status'] == 'completed']
        bad = [r for r in done if r['conclusion'] == 'failure']
        monitor = [f'- 監視した回数: {len(done)}回 / 異常があった回数: {len(bad)}回']
        open_mon = [i for i in api('GET', '/issues?state=open&labels=site-monitor&per_page=5')]
        monitor.append('- 今も続いている異常: ' + ('あり（Issue「サイト監視: 異常あり」を確認）' if open_mon else 'なし'))
    except Exception as e:
        print('監視結果の取得に失敗:', e)

keys = ['seo', 'performance', 'accessibility', 'best-practices']
lines = [f'## 週次チェック {time.strftime("%Y-%m-%d", time.gmtime())}（スマホ表示・100点満点）', '',
         '| ページ | ' + ' | '.join(NAMES[k] for k in keys) + ' |', '|---|' + '---|' * len(keys)]
for url, sc in rows:
    lines.append(f'| {url.replace(SITE, "/")} | ' + ' | '.join(str(sc.get(k, '-')) for k in keys) + ' |')
lines += ['', '### 改善が必要なところ'] + ([f'- {p}' for p in problems] or ['- なし'])
lines += ['', '### この1週間のサイト監視'] + monitor
lines += ['', '※ 点数の目安: SEO は90点以上、表示速度は50点以上なら問題なし。検索の表示回数・順位は Google Search Console で確認できます。']
report = '\n'.join(lines)
print(report)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write(report + '\n')

TITLE = '週次チェック: 改善が必要'
if token and repo:
    try:
        # 毎週のレポート（問題がなくても必ず作る → GitHub からメールで届く。読み終わりの扱いにするため作成後すぐ閉じる）
        status = '要確認' if problems else '問題なし'
        rep = api('POST', '/issues', {'title': f'週次レポート {time.strftime("%Y/%m/%d", time.gmtime(time.time() + 9 * 3600))}（{status}）',
                                       'labels': ['weekly-report'], 'body': report})
        api('PATCH', f'/issues/{rep["number"]}', {'state': 'closed', 'state_reason': 'completed'})
        opened = [i for i in api('GET', '/issues?state=open&labels=seo-weekly&per_page=10') if i['title'] == TITLE]
        if problems and not opened:
            api('POST', '/issues', {'title': TITLE, 'labels': ['seo-weekly'], 'body': report})
        # 問題が続いている週は週次レポートで知らせるので、同じ内容を重ねて書き込まない
        elif opened:
            n = opened[0]['number']
            api('POST', f'/issues/{n}/comments', {'body': '改善を確認しました。\n\n' + report})
            api('PATCH', f'/issues/{n}', {'state': 'closed', 'state_reason': 'completed'})
    except Exception as e:
        print('Issue の更新に失敗:', e)
