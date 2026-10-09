"""
毎日のSEO・表示速度チェック（GitHub Actions から毎朝実行。Claude は使わない）。
Google の Lighthouse で主要ページを「スマホ表示」で採点し、
SEO が 90 点未満・表示速度が 50 点未満のページがあれば Issue「週次チェック: 改善が必要」を立てる。
問題がなくなれば自動で閉じる。
問題の有無にかかわらず、毎日「毎日のレポート」を Issue として作る（リポジトリを Watch しているとメールで届く）。結果は毎回 Actions の「Summary」に表として残る。
"""
import os, re, sys, json, glob, time, urllib.request, urllib.error

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

# 直近24時間と1週間の「サイト監視（5分ごと）」の結果をまとめる
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
        day = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 86400))
        done1 = [r for r in done if r['created_at'] >= day]
        bad1 = [r for r in done1 if r['conclusion'] == 'failure']
        monitor = [f'- 直近24時間: 監視 {len(done1)}回 / 異常 {len(bad1)}回',
                   f'- 直近1週間: 監視 {len(done)}回 / 異常 {len(bad)}回']
        open_mon = [i for i in api('GET', '/issues?state=open&labels=site-monitor&per_page=5')]
        monitor.append('- 今も続いている異常: ' + ('あり（Issue「サイト監視: 異常あり」を確認）' if open_mon else 'なし'))
    except Exception as e:
        print('監視結果の取得に失敗:', e)

keys = ['seo', 'performance', 'accessibility', 'best-practices']
lines = [f'## 毎日のチェック {time.strftime("%Y-%m-%d", time.gmtime())}（スマホ表示・100点満点）', '',
         '| ページ | ' + ' | '.join(NAMES[k] for k in keys) + ' |', '|---|' + '---|' * len(keys)]
for url, sc in rows:
    lines.append(f'| {url.replace(SITE, "/")} | ' + ' | '.join(str(sc.get(k, '-')) for k in keys) + ' |')
lines += ['', '### 改善が必要なところ'] + ([f'- {p}' for p in problems] or ['- なし'])
lines += ['', '### サイト監視の結果'] + monitor
lines += ['', '※ 点数の目安: SEO は90点以上、表示速度は50点以上なら問題なし。検索の表示回数・順位は Google Search Console で確認できます。']
report = '\n'.join(lines)
print(report)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write(report + '\n')

TITLE = '週次チェック: 改善が必要'  # 既存の Issue 名を引き継ぐ
report_url = ''
if token and repo:
    try:
        # 毎日のレポート（問題がなくても必ず作る → GitHub からメールで届く。読み終わりの扱いにするため作成後すぐ閉じる）
        status = '要確認' if problems else '問題なし'
        rep = api('POST', '/issues', {'title': f'毎日のレポート {time.strftime("%Y/%m/%d", time.gmtime(time.time() + 9 * 3600))}（{status}）',
                                       'labels': ['daily-report'], 'body': report})
        api('PATCH', f'/issues/{rep["number"]}', {'state': 'closed', 'state_reason': 'completed'})
        report_url = rep.get('html_url', '')
        opened = [i for i in api('GET', '/issues?state=open&labels=seo-weekly&per_page=10') if i['title'] == TITLE]
        if problems and not opened:
            api('POST', '/issues', {'title': TITLE, 'labels': ['seo-weekly'], 'body': report})
        # 問題が続いている間は毎日のレポートで知らせるので、同じ内容を重ねて書き込まない
        elif opened:
            n = opened[0]['number']
            api('POST', f'/issues/{n}/comments', {'body': '改善を確認しました。\n\n' + report})
            api('PATCH', f'/issues/{n}', {'state': 'closed', 'state_reason': 'completed'})
    except Exception as e:
        print('Issue の更新に失敗:', e)

# ---- LINE で知らせる ----
# GitHub の Secrets に LINE_CHANNEL_ACCESS_TOKEN（LINE公式アカウントのチャネルアクセストークン）と
# LINE_TO（受け取る人のユーザーID。U から始まる文字列）が登録されているときだけ送る。
# 値はファイルに書かない（README のセキュリティのルール）。無料プランは月200通まで。
line_token, line_to = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN'), os.environ.get('LINE_TO')
if line_token and line_to:
    jst = time.strftime('%m/%d', time.gmtime(time.time() + 9 * 3600))
    seo = [sc.get('seo', 0) for _, sc in rows]
    perf = [sc.get('performance', 0) for _, sc in rows]
    msg = [f'【ホームページ 毎日のレポート {jst}】',
           '結果: ' + ('要確認' if problems else '問題なし'),
           f'SEO: {min(seo)}〜{max(seo)}点（{len(rows)}ページ）' if rows else 'SEO: 採点できず',
           f'表示速度: {min(perf)}〜{max(perf)}点' if rows else '']
    msg += [m.lstrip('- ') for m in monitor]
    if problems:
        msg += ['', '改善が必要なところ:'] + [p.replace(SITE, '/') for p in problems[:5]]
    if report_url:
        msg += ['', '詳しくはこちら:', report_url]
    text = '\n'.join(x for x in msg if x is not None)[:4900]
    req = urllib.request.Request('https://api.line.me/v2/bot/message/push',
                                 data=json.dumps({'to': line_to, 'messages': [{'type': 'text', 'text': text}]}).encode(),
                                 headers={'Authorization': 'Bearer ' + line_token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print('LINE に送信しました:', r.status)
    except urllib.error.HTTPError as e:
        print('LINE の送信に失敗:', e.code, e.read()[:300].decode('utf-8', 'replace'))
    except Exception as e:
        print('LINE の送信に失敗:', e)
else:
    print('LINE の設定（Secrets）がないので、LINE には送っていません')
