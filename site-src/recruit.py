"""
採用ページ（/recruit）。
トップページの採用欄（src/site.html の #recruit）と同じ内容を、専用ページとして詳しく見せる。
給与・勤務時間・休日・雇用形態などの募集要項は、会社から受け取った内容だけを RECRUIT_TERMS に入れる。
空のうちは募集要項の表も求人の構造化データ（JobPosting）も出さない（確認していない条件を書かないため）。
"""
import re
from extra import P, cta, pg_header

# 募集要項：[(項目, 内容)]。会社から受け取った内容だけを入れる（例: ('雇用形態', '正社員')）
RECRUIT_TERMS = []

TITLE = '採用情報｜解体作業スタッフ・重機オペレーター・施工管理 株式会社sunrise（愛知県あま市）'
DESC = ('愛知県あま市の解体工事会社、株式会社sunriseの採用情報。解体作業スタッフ（未経験歓迎）、重機オペレーター、施工管理を募集しています。'
        '名古屋市をはじめ愛知県全域の解体工事・内装解体・原状回復の現場で働く仲間を探しています。')

def SEC(en, jp, inner, art=True, cls=''):
    body = f'<div class="art">{inner}</div>' if art else inner
    return f'''  <section class="pg-sec w{cls}">
    <div class="pg-sec-hd"><h2>{en}</h2><p>{jp}</p></div>
    {body}
  </section>
'''

def page(src):
    rec = re.search(r'<section[^>]*id="recruit".*?</section>', src, re.S).group(0)
    message = re.search(r'<p class="svc-desc[^"]*"[^>]*>(.*?)</p>', rec, re.S).group(1)
    jobs = re.search(r'<div class="jobs">.*?</div>\s*</section>', rec, re.S).group(0)
    jobs = jobs[:jobs.rindex('</section>')].rstrip()
    jobs = jobs.replace(' rv"', '"')   # 専用ページでは最初から表示する（紺色の背景はトップと同じ .rec で付ける）
    terms = ''
    if RECRUIT_TERMS:
        rows = ''.join(f'<tr><th>{k}</th><td>{v}</td></tr>' for k, v in RECRUIT_TERMS)
        terms = SEC('TERMS', '募集要項', f'<div class="tbl"><table>{rows}</table></div>')
    entry = ('<ol class="art-ol">'
             '<li>このページ下のフォームで、お問い合わせ種別「採用について」を選んで送信するか、お電話（<a href="tel:09076866461">090-7686-6461</a>）でご連絡ください。</li>'
             '<li>内容を確認のうえ、担当者よりご連絡します。</li></ol>'
             + P('働き方や仕事の内容について、応募の前に聞いてみたいことがあれば、お気軽にお問い合わせください。'))
    work = (P('株式会社sunriseは、愛知県あま市を拠点に、名古屋市をはじめとする愛知県全域と、岐阜県・三重県・静岡県・滋賀県で解体工事を行っています。')
            + P('木造・鉄骨造・RC造の建屋解体、店舗やオフィスの内装解体、原状回復、アスベストの調査・除去など、現場の種類はさまざまです。')
            + '<ul class="scope"><li><span class="mono">01</span><a href="building.html">建屋解体（木造・鉄骨・RC造）</a></li>'
              '<li><span class="mono">02</span><a href="interior.html">内装解体・スケルトン工事</a></li>'
              '<li><span class="mono">03</span><a href="restore.html">原状回復工事（オフィス・店舗）</a></li>'
              '<li><span class="mono">04</span><a href="asbestos.html">アスベスト調査・除去</a></li></ul>')
    return f'''<div class="page" data-page="recruit">
{pg_header('recruit', 'RECRUIT', '採用情報', '更地に立ったとき、<br>自分の仕事が目に見えて残る。', 3)}
{SEC('MESSAGE', 'sunriseで働くということ', f'<p>{message}</p>')}{SEC('JOBS', '募集している仕事', jobs, art=False, cls=' rec')}{terms}{SEC('WORK', 'どんな現場で働くか', work)}{SEC('ENTRY', '応募の方法', entry)}{cta('応募・お問い合わせをお待ちしています。', 'フォームのお問い合わせ種別で「採用について」を選んでお送りください。お電話でも受け付けています。', '採用について', '応募・問い合わせをする')}
</div>'''
