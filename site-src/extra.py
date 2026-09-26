"""
Extra SEO pages (area / faq / column) for the sunrise site.
Each entry returns the <div class="page"> body markup; build.py wraps it with
header, nav, contact and footer, and adds <head> + structured data.
"""
import re

DATE = '2026-09-25'
DATE_JP = '2026.09.25'

def br(text):
    """Site rule: break the line after every 。 (keep 、 inline)."""
    text = text.strip()
    parts = [p for p in text.split('。') if p.strip()]
    out = '。<br>'.join(p.strip() for p in parts)
    if text.endswith('。'):
        out += '。'
    return out

def P(text):
    return f'<p>{br(text)}</p>'

def UL(items):
    return '<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'

def faq_block(qas):
    return '<div class="faq">' + ''.join(
        f'<details><summary><span class="q">Q</span>{q}</summary><p><span class="a">A</span><span class="at">{br(a)}</span></p></details>'
        for q, a in qas) + '</div>'

def cta(title, lead, typ='解体のご相談', label='無料で相談する'):
    return f'''  <section class="pg-cta w">
    <p class="mono">Free survey &amp; estimate</p>
    <h2>{title}</h2>
    <p>{br(lead)}</p>
    <a class="send" href="#contact" data-type="{typ}">{label} <span aria-hidden="true">→</span></a>
  </section>'''

def pg_header(key, en, jp, lead, photo, crumb_mid=None):
    mid = f'<a href="{crumb_mid[0]}">{crumb_mid[1]}</a><span>/</span>' if crumb_mid else ''
    return f'''  <header class="pg-hd w"><div class="pg-hd-l">
    <nav class="crumb mono" aria-label="現在地"><a href="index.html">TOP</a><span>/</span>{mid}<b>{jp}</b></nav>
    <h1 class="pg-title">{en}<span class="sr">{jp}｜愛知県あま市の解体工事 株式会社sunrise</span></h1>
    <p class="pg-jp">{jp}</p>
    <p class="pg-lead">{lead}</p>
  </div>
  <a class="ph svc-mv pg-photo" href="#contact" aria-label="解体工事について相談する"><img data-photo="{photo}" alt="{jp}｜株式会社sunriseの解体工事の現場"></a>
  </header>'''

# ---------------------------------------------------------------- AREA
AICHI_GROUPS = [
    ('海部・津島エリア（拠点）', 'あま市、津島市、愛西市、弥富市、大治町、蟹江町、飛島村'),
    ('名古屋市（全16区）', '千種区、東区、北区、西区、中村区、中区、昭和区、瑞穂区、熱田区、中川区、港区、南区、守山区、緑区、名東区、天白区'),
    ('尾張エリア', '稲沢市、清須市、北名古屋市、一宮市、岩倉市、小牧市、春日井市、江南市、犬山市、豊山町、大口町、扶桑町、瀬戸市、尾張旭市、長久手市、日進市、東郷町、豊明市、大府市、東海市、知多市'),
    ('三河エリア', '豊田市、岡崎市、安城市、刈谷市、知立市、豊橋市ほか'),
]
OTHER_PREFS = [
    ('岐阜県', '岐阜市、大垣市、羽島市、各務原市、海津市など'),
    ('三重県', '桑名市、四日市市、いなべ市、木曽岬町、津市など'),
    ('静岡県', '浜松市、湖西市、磐田市、静岡市など'),
    ('滋賀県', '大津市、彦根市、長浜市、草津市など'),
]

def area_page():
    rows = ''.join(f'<tr><th>{g}</th><td>{c}</td></tr>' for g, c in AICHI_GROUPS)
    rows2 = ''.join(f'<tr><th>{g}</th><td>{c}</td></tr>' for g, c in OTHER_PREFS)
    qas = [
        ('住所が対応エリアに入っているか分かりません。', '市区町村名をお知らせいただければ、対応できるかどうかを確認してお返事します。一覧にない地域でも、まずはご相談ください。'),
        ('現地調査やお見積りに費用はかかりますか？', '現地調査とお見積りは無料です。お見積りの内容にご納得いただいてからのご契約になります。'),
        ('名古屋市内の狭い道路に面した建物でも解体できますか？', '前面道路の幅や電線の位置を現地調査で確認し、小型の重機や手作業を組み合わせて計画します。条件によって工期と費用が変わるため、お見積りのときにご説明します。'),
    ]
    return f'''<div class="page" data-page="area">
{pg_header('area', 'AREA', '対応エリア', '愛知県あま市を拠点に、<br>東海エリアの解体工事にうかがいます。', 2)}
  <section class="pg-sec w art">
    {P('株式会社sunriseは、愛知県あま市を拠点に、名古屋市をはじめとする愛知県全域と、岐阜県・三重県・静岡県・滋賀県で建屋解体・内装解体・原状回復・アスベスト調査・除去を行っています。拠点のあま市から近い海部・津島エリアや名古屋市西部は、急ぎのご相談にも対応しやすい地域です。')}
  </section>
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>REGION</h2><p>地域別のご案内（補助金・届出先）</p></div>
    <ul class="art-list"><li><a href="area-ama.html">あま市の解体工事｜補助金3制度と届出先</a></li><li><a href="area-nagoya.html">名古屋市の解体工事｜助成制度と区ごとの届出先</a></li><li><a href="area-ama-tsushima.html">海部・津島エリアの解体工事｜津島市・愛西市・弥富市・蟹江町・大治町・飛島村</a></li></ul>
  </section>
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>AICHI</h2><p>愛知県の対応エリア</p></div>
    <div class="art"><div class="tbl"><table class="area-tb">{rows}</table></div>
    {P('上記以外の愛知県内の市町村も対応しています。')}
    <p><a class="art-link" href="column/subsidy-ama-nagoya.html">あま市・名古屋市・海部津島の解体の補助金を見る →</a></p></div>
  </section>
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>TOKAI</h2><p>岐阜県・三重県・静岡県・滋賀県</p></div>
    <div class="art"><div class="tbl"><table class="area-tb">{rows2}</table></div>
    {P('記載のない市町村も、ご相談いただければ日程と条件を確認してお返事します。')}</div>
  </section>
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>SERVICE</h2><p>各エリアで対応している工事</p></div>
    <ul class="scope"><li><span class="mono">01</span><a href="building.html">建屋解体（木造・鉄骨・RC造）</a></li><li><span class="mono">02</span><a href="interior.html">内装解体・スケルトン工事</a></li><li><span class="mono">03</span><a href="restore.html">原状回復工事（オフィス・店舗）</a></li><li><span class="mono">04</span><a href="asbestos.html">アスベスト調査・除去</a></li></ul>
  </section>
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>FAQ</h2><p>エリアについてのご質問</p></div>
    {faq_block(qas)}
  </section>
{cta('対応エリアのご確認も、お気軽にどうぞ。', '建物の住所と概要をお知らせください。現地調査・お見積りは無料です。')}
</div>'''

# ---------------------------------------------------------------- FAQ
GENERAL_QA = [
    ('見積りは無料ですか？', '現地調査とお見積りは無料です。内訳と、追加費用が出る条件を明記してお出しします。'),
    ('どの地域まで来てもらえますか？', '愛知県あま市を拠点に、名古屋市をはじめとする愛知県全域と、岐阜県・三重県・静岡県・滋賀県で対応しています。その他の地域もご相談ください。'),
    ('問い合わせはどうすればよいですか？', 'このページ下のフォームから24時間受け付けています。お急ぎの場合はお電話（090-7686-6461）でもご相談いただけます。'),
    ('解体の補助金は使えますか？', '市町村によっては、空き家や古い木造住宅の解体に補助金が出ます。多くの制度は工事の契約前に申請が必要なため、契約の前にご相談ください。'),
    ('アスベストの調査は必要ですか？', '解体工事や改修工事の前には、規模にかかわらずアスベスト（石綿）の事前調査が法律で義務づけられています。調査から除去までまとめてご相談いただけます。'),
    ('解体したあとに必要な手続きはありますか？', '建物を取り壊したら、1か月以内に法務局へ建物滅失登記を申請する必要があります。登記に使う取壊し証明書などの書類は、工事完了後にお渡しします。'),
]

def faq_page(service_faqs):
    """service_faqs: list of (jp_name, file, faq_html_inner)"""
    sections = ''
    for jp, f, inner in service_faqs:
        sections += f'''  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>{jp}</h2><p><a href="{f}">{jp}のページを見る →</a></p></div>
    {inner}
  </section>
'''
    return f'''<div class="page" data-page="faq">
{pg_header('faq', 'FAQ', 'よくあるご質問', 'ご依頼の前に、<br>よくいただくご質問をまとめました。', 5)}
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>GENERAL</h2><p>ご依頼全般</p></div>
    {faq_block(GENERAL_QA)}
  </section>
{sections}{cta('ここにないご質問も、お気軽にどうぞ。', 'フォームは24時間受け付けています。内容を確認のうえ、担当者よりご連絡します。')}
</div>'''

# ---------------------------------------------------------------- COLUMNS
# each: slug, title, desc, lead, photo, related services, body sections [(h2, html)]
COLUMNS = []

def col(slug, title, short, desc, photo, related, sections, sources):
    COLUMNS.append(dict(slug=slug, title=title, short=short, desc=desc, photo=photo,
                        related=related, sections=sections, sources=sources))

col('asbestos-survey',
    '解体・リフォーム前のアスベスト事前調査は義務です｜対象・報告・注意点',
    'アスベスト事前調査の義務',
    '解体工事やリフォームの前に必要なアスベスト（石綿）事前調査について、義務の内容、行政への報告が必要な工事、有資格者による調査、記録の保存までを解体業者がわかりやすく解説します。',
    3, ['asbestos', 'building'],
    [('アスベストの事前調査とは',
      P('アスベスト（石綿）は、かつて断熱材や屋根材、外壁材、床材などに広く使われていた建材です。解体や改修で壊すと繊維が飛び散り、吸い込むと健康被害につながるおそれがあります。そのため、建物を解体・改修する前には、アスベストを含む建材が使われているかどうかを調べる「事前調査」が法律で義務づけられています。')
      + P('この調査は、工事の規模にかかわらず必要です。小さな工事だから、自宅だからという理由で省略することはできません。')),
     ('いつから、何が義務になったのか',
      UL(['<b>2022年4月から：</b>一定規模以上の工事について、事前調査の結果を行政へ報告することが義務になりました。',
          '<b>2023年10月から：</b>建築物の事前調査は、所定の講習を修了した資格者（建築物石綿含有建材調査者など）が行うことが義務になりました。'])
      + P('調査の結果は、工事現場に掲示するとともに、記録を3年間保存することも定められています。')),
     ('行政への報告が必要な工事',
      P('事前調査そのものはすべての工事で必要ですが、結果を行政へ報告する必要があるのは、次のような工事です。')
      + UL(['建築物の解体工事で、解体する部分の床面積の合計が80㎡以上のもの',
            '建築物の改修工事で、請負金額が税込100万円以上のもの',
            '一定の工作物の解体・改修工事で、請負金額が税込100万円以上のもの'])
      + P('報告は、国の「石綿事前調査結果報告システム」から電子申請で行うのが基本です。報告を怠ったり、虚偽の報告をしたりすると罰則の対象になります。')),
     ('アスベストが見つかったら',
      P('含有建材が見つかった場合は、建材の種類に応じて、飛散を防ぐ養生や湿潤化などの対策をしたうえで除去します。除去したアスベストは、ほかの廃材と分けて法令に沿って処分します。')
      + P('建材の種類や量によって作業の手間が変わるため、費用と工期も変わります。見積りの段階で、調査の結果と除去の範囲を確認しておくことが大切です。')),
     ('sunriseにご相談いただく場合',
      P('株式会社sunriseでは、解体工事とあわせて、アスベストの事前調査から除去・処分までまとめてご相談いただけます。近隣への説明や、作業中の飛散対策についても着工前にご説明します。愛知県あま市・名古屋市をはじめ、東海エリアで対応しています。')
      + '<p><a class="art-link" href="asbestos.html">アスベスト調査・除去のページを見る →</a></p>')],
    [('環境省 石綿飛散防止対策', 'https://www.env.go.jp/air/asbestos/'),
     ('石綿事前調査結果報告システム（厚生労働省）', 'https://www.ishiwata-houkoku.mhlw.go.jp/')])

col('subsidy-ama-nagoya',
    'あま市・名古屋市・津島市など海部津島で使える解体の補助金｜申請は「契約前」が鉄則',
    '解体の補助金（あま市・名古屋市・海部津島）',
    '愛知県あま市・名古屋市と、津島市・愛西市・弥富市など海部津島エリアの空き家解体の補助金について、対象となる建物、補助額、申請のタイミングを解体業者が整理しました。',
    8, ['building'],
    [('解体に使える補助金はあるの？',
      P('空き家や古い木造住宅の解体には、市町村が補助金を出していることがあります。制度の内容は市町村ごとに違い、年度によって変わることもあります。ここでは、当社の拠点があるあま市と、ご相談の多い名古屋市、あま市に近い海部・津島エリアの制度を紹介します。')
      + '<div class="note"><b>いちばん大切なこと：</b>どの制度も、工事の契約や着工の前に申請し、交付の決定を受ける必要があります。先に契約してしまうと補助金を受けられません。</div>'),
     ('あま市「空家解体促進費補助金」',
      '<div class="tbl"><table><tr><th>主な対象</th><td>1年以上使われていない木造の住宅（空き家）で、不良住宅と判定されたもの。個人が所有し、所有権以外の権利が設定されていないことなどの条件があります。</td></tr>'
      '<tr><th>補助額</th><td>1戸あたり20万円が上限</td></tr>'
      '<tr><th>申請の時期</th><td>毎年4月から受付。工事着手前（請負契約前）に申請し、交付決定を受ける必要があります。</td></tr>'
      '<tr><th>問い合わせ先</th><td>あま市 建設産業部 都市計画課（052-444-1001）</td></tr></table></div>'
      + P('あま市のほかの補助制度（木造住宅の除却やブロック塀の撤去）と届出先は、<a class="art-link" href="area-ama.html">あま市の解体工事のページ</a>で紹介しています。')),
     ('名古屋市「戸建木造住宅除却助成」',
      '<div class="tbl"><table><tr><th>主な対象</th><td>1981年（昭和56年）5月31日以前に建てられた、2階建て以下の戸建て木造住宅（在来工法）で、耐震診断の判定値が1.0未満のもの。</td></tr>'
      '<tr><th>助成額</th><td>上限20万円。解体費用の3分の1などで計算した額のうち、いちばん低い額。</td></tr>'
      '<tr><th>申請の時期</th><td>工事の契約前に申請が必要です。交付決定の通知が出る前に契約すると助成を受けられません。</td></tr>'
      '<tr><th>問い合わせ先</th><td>名古屋市 耐震化支援課（052-972-2921）</td></tr></table></div>'
      + P('名古屋市のほかの助成制度と、区ごとの届出先は、<a class="art-link" href="area-nagoya.html">名古屋市の解体工事のページ</a>で紹介しています。')),
     ('海部・津島エリア（津島市・愛西市・弥富市など）',
      P('あま市のまわりの津島市・愛西市・弥富市・蟹江町・飛島村にも、危険な空き家の解体に使える補助制度があります。対象や金額、受付期限は市町村ごとに違い、年度によって変わります。')
      + P('6市町村の制度の比べ方と、建設リサイクル法の届出先は、<a class="art-link" href="area-ama-tsushima.html">海部・津島エリアの解体工事のページ</a>にまとめています。')
      + P('どの市町村でも、補助の対象かどうかの判定や交付の決定を受ける前に契約・着工すると、補助金を受けられないのが基本です。')),
     ('補助金を使うときの進め方',
      '<ol class="art-ol"><li>市の窓口やホームページで、今年度の制度の内容と受付状況を確認する</li><li>解体業者に現地調査と見積りを依頼する（この時点では契約しない）</li><li>見積書などを添えて市へ申請し、交付決定を待つ</li><li>交付決定の通知を受け取ってから契約・着工する</li><li>工事が終わったら、完了報告をして補助金を受け取る</li></ol>'
      + P('予算の上限に達すると受付が終わる制度もあります。解体を考え始めたら、早めに確認しておくと安心です。')),
     ('sunriseにご相談いただく場合',
      P('株式会社sunriseでは、補助金の申請に使う見積書の作成や、工事完了後の写真・書類の準備にも対応します。申請はお施主様ご本人が行う制度が多いため、手順を確認しながら一緒に進めます。')
      + '<p><a class="art-link" href="building.html">建屋解体のページを見る →</a></p>')],
    [('あま市空家解体促進費補助金について（あま市公式）', 'https://www.city.ama.aichi.jp/kurashi/kotsu/sumai/1005684/1005688.html'),
     ('戸建木造住宅除却助成（名古屋市公式）', 'https://www.city.nagoya.jp/kurashi/juutaku/1014710/1014649/1034739/1014651.html'),
     ('津島市空家解体促進費補助金（津島市公式）', 'https://www.city.tsushima.lg.jp/kurashi/sumaikenchiku/akiya/akiyahojo.html'),
     ('愛西市危険空き家除却費補助金について（愛西市公式）', 'https://www.city.aisai.lg.jp/0000013443.html'),
     ('空家除却費補助金について（弥富市公式）', 'https://www.city.yatomi.lg.jp/kurashi/1000451/1006129/1003562.html'),
     ('市町村の支援制度（空き家）（愛知県）', 'https://www.pref.aichi.jp/soshiki/jutakukeikaku/akiya-support.html')])

col('before-after-demolition',
    '解体工事の前後にやることリスト｜ライフライン・近隣・届出・滅失登記',
    '解体工事の前後にやること',
    '家の解体を決めたら何をすればいい？ライフラインの停止、残置物の整理、近隣へのあいさつ、建設リサイクル法の届出、工事後の建物滅失登記や固定資産税の注意点まで、解体業者が順番にまとめました。',
    4, ['building', 'asbestos'],
    [('工事の前にやること',
      '<ol class="art-ol">'
      '<li><b>補助金の確認</b><br>空き家や古い木造住宅は、市町村の補助金を使える場合があります。多くは契約前の申請が必要なので、最初に確認します。</li>'
      '<li><b>現地調査と見積り</b><br>建物の構造や広さ、前面道路、アスベストの有無などを確認してもらい、内訳のわかる見積りを受け取ります。</li>'
      '<li><b>家財・残置物の整理</b><br>残したい物は先に運び出します。残った家具や家電の撤去を解体業者に頼むこともできますが、量によって費用が変わります。</li>'
      '<li><b>電気・ガス・電話・インターネットの停止</b><br>各社へ連絡して停止と撤去を依頼します。ガスメーターや電気の引込線は、事業者による撤去が必要です。</li>'
      '<li><b>水道は止める前に相談</b><br>解体中は粉じんを抑えるために散水をするので、水道を使えるように残しておくことがあります。止める時期は解体業者と相談しましょう。</li>'
      '<li><b>近隣へのあいさつ</b><br>工事の期間や作業時間、騒音についてお知らせします。当社では着工前にスタッフが近隣を回ってご説明します。</li>'
      '</ol>'),
     ('法律で決められている手続き',
      UL(['<b>アスベストの事前調査：</b>解体・改修の前には、規模にかかわらずアスベストの事前調査が必要です。一定規模以上の工事は、結果を行政へ報告します。',
          '<b>建設リサイクル法の届出：</b>床面積の合計が80㎡以上の建物を解体するときは、工事に着手する7日前までに、発注者（お施主様）が都道府県知事など（名古屋市内の場合は名古屋市）へ届け出ます。手続きは業者が代行することもできます。'])
      + '<p><a class="art-link" href="column/asbestos-survey.html">アスベスト事前調査について詳しく →</a></p>'),
     ('工事が終わったらやること',
      UL(['<b>建物滅失登記：</b>建物を取り壊したら、1か月以内に法務局へ「建物滅失登記」を申請する必要があります。申請するのは建物の所有者です。登録免許税はかからず、土地家屋調査士に依頼することもできます。申請を怠ると10万円以下の過料の対象になります。',
          '<b>書類の受け取り：</b>登記には、解体業者が発行する「取壊し証明書（建物滅失証明書）」などが必要です。当社では工事完了後にお渡しします。',
          '<b>固定資産税の確認：</b>住宅が建っている土地には税金が軽くなる特例があります。毎年1月1日の時点で更地になっていると、その年から特例が外れて土地の税額が上がることがあります。売却や建て替えの予定とあわせて、解体の時期を考えておくと安心です。'])),
     ('迷ったら、まず相談を',
      P('解体の前後には、思ったより多くの手続きがあります。株式会社sunriseでは、現地調査のときに、補助金や届出、工事後の書類まで、必要なことを順番にご説明します。')
      + '<p><a class="art-link" href="building.html">建屋解体のページを見る →</a></p>')],
    [('建物を取り壊した（法務局）', 'https://houmukyoku.moj.go.jp/homu/fudousan5.html'),
     ('建設リサイクル法（環境省）', 'https://www.env.go.jp/recycle/build/')])

col('genjo-skeleton',
    '原状回復とスケルトン工事の違い｜テナント退去前に確認すること',
    '原状回復とスケルトンの違い',
    'オフィスや店舗の退去時に求められる「原状回復」と「スケルトン工事（スケルトン返し）」の違い、A工事・B工事・C工事の工事区分、退去日までに間に合わせるための進め方を解説します。',
    6, ['restore', 'interior'],
    [('原状回復とスケルトン工事は何が違う？',
      P('原状回復は、借りたときの状態に戻して物件を返す工事です。入居後に設けた間仕切りや造作、設備を撤去し、床・壁・天井を入居時の状態に仕上げます。')
      + P('スケルトン工事（スケルトン返し）は、内装や設備を取り払い、建物の構造体だけの状態にして返す工事です。飲食店や店舗の退去で求められることが多く、床・壁・天井の下地まで撤去するのが一般的です。')
      + P('どちらで返すかは、賃貸借契約書の特約や、入居時の引き渡し条件で決まります。まず契約書を確認することが出発点です。')),
     ('工事区分（A工事・B工事・C工事）',
      P('オフィスビルや商業施設では、工事の発注先と費用負担を「工事区分」で分けていることがあります。')
      + '<div class="tbl"><table><tr><th>A工事</th><td>ビルの共用部や躯体にかかわる工事。ビルオーナーが発注し、費用もオーナーが負担します。</td></tr>'
      '<tr><th>B工事</th><td>ビルの設備にかかわる工事で、テナントの希望で行うもの。業者はオーナー側が指定し、費用はテナントが負担します。</td></tr>'
      '<tr><th>C工事</th><td>テナントの専有部分の内装など。テナントが業者を選んで発注し、費用も負担します。</td></tr></table></div>'
      + P('原状回復のうち、どの部分をどの区分で行うかは物件ごとに違います。管理会社から工事区分表を取り寄せて確認しましょう。')),
     ('退去日に間に合わせるために',
      UL(['退去日が決まったら、早めに現地調査を依頼する',
          '管理会社やビルの工事ルール（作業できる時間帯、搬出経路、養生の範囲）を確認する',
          '工事申請書など、ビルへの提出書類の期限を確認する',
          'B工事がある場合は、指定業者との工程を合わせる'])
      + P('営業中のビルでは、音の出る作業を夜間や休日に限られることもあり、その分だけ工期が延びます。余裕をもって段取りすることが大切です。')),
     ('sunriseにご相談いただく場合',
      P('株式会社sunriseでは、工事区分表と現地の状況を確認したうえでお見積りし、退去日に間に合わせて引き渡します。スケルトン工事から原状回復の仕上げまでまとめて承ります。オーナー様・管理会社様からのご依頼にも対応しています。')
      + '<p><a class="art-link" href="restore.html">原状回復工事のページを見る →</a>　<a class="art-link" href="interior.html">内装解体のページを見る →</a></p>')],
    [])

col('demolition-cost-factors',
    '解体費用はどう決まる？見積りで確認したい7つのポイント',
    '解体費用が決まるポイント',
    '家や建物の解体費用は何で決まるのか。構造・面積・立地・付帯工事・残置物・アスベスト・地中埋設物など、見積りが変わる要因と、見積書を比べるときのチェックポイントを解体業者が解説します。',
    9, ['building', 'interior'],
    [('解体費用は「建物」と「現場」で決まる',
      P('解体費用は、坪数だけでは決まりません。同じ広さの家でも、構造や立地、敷地の中に何があるかによって、必要な作業と処分する廃材の量が変わるからです。ここでは、見積りに大きく影響する7つのポイントを紹介します。')),
     ('見積りが変わる7つのポイント',
      '<ol class="art-ol">'
      '<li><b>建物の構造</b><br>木造、鉄骨造、鉄筋コンクリート（RC）造の順に、壊すための重機や手間が大きくなります。</li>'
      '<li><b>延床面積と階数</b><br>面積が大きいほど作業量と廃材が増えます。</li>'
      '<li><b>前面道路と重機の入りやすさ</b><br>道路が狭い、敷地が奥まっているなど、大きな重機が入れない現場では、小型の重機や手作業が増えます。</li>'
      '<li><b>付帯工事</b><br>ブロック塀、カーポート、物置、庭木、土間コンクリートなど、建物以外の撤去も費用に含まれます。</li>'
      '<li><b>残置物の量</b><br>家具や家電、衣類などが残っていると、その分の撤去・処分費がかかります。</li>'
      '<li><b>アスベストの有無</b><br>含有建材が見つかった場合は、飛散対策をしたうえでの除去と、専用の処分が必要になります。</li>'
      '<li><b>地中の埋設物</b><br>古い基礎や浄化槽、井戸、ガラなどが地中から出てきた場合は、撤去の費用が追加になることがあります。</li>'
      '</ol>'),
     ('見積書を比べるときのチェックポイント',
      UL(['「一式」だけでなく、工事ごとの内訳が書かれているか',
          '追加費用が出る条件（地中埋設物、アスベストなど）が書かれているか',
          '廃材の処分費や、届出の代行費用が含まれているか',
          '近隣へのあいさつや養生、整地の範囲が明記されているか',
          '産業廃棄物の処理を、マニフェスト（管理票）で適正に管理しているか'])
      + P('金額の安さだけで選ぶと、工事中に追加費用が発生したり、廃材が不適切に処理されたりするおそれがあります。内容まで比べて選ぶことが大切です。')),
     ('sunriseのお見積り',
      P('株式会社sunriseでは、現地調査のうえで内訳と、追加費用が出る条件を明記したお見積りをお出しします。現地調査とお見積りは無料です。愛知県あま市・名古屋市をはじめ、東海エリアで対応しています。')
      + '<p><a class="art-link" href="building.html">建屋解体のページを見る →</a></p>')],
    [])

def column_page(c):
    body = ''
    toc = ''.join(f'<li><a href="#s{i+1}">{h}</a></li>' for i, (h, _) in enumerate(c['sections']))
    for i, (h, inner) in enumerate(c['sections']):
        body += f'<h2 id="s{i+1}">{h}</h2>\n{inner}\n'
    src = ''
    if c['sources']:
        src = '<div class="art-src"><p class="mono">SOURCES</p><ul>' + ''.join(
            f'<li><a href="{u}" target="_blank" rel="noopener">{t}</a></li>' for t, u in c['sources']) + '</ul></div>'
    others = [o for o in COLUMNS if o['slug'] != c['slug']]
    more = ''.join(f'<li><a href="column/{o["slug"]}.html">{o["title"]}</a></li>' for o in others)
    return f'''<div class="page" data-page="col-{c['slug']}">
  <header class="pg-hd w"><div class="pg-hd-l">
    <nav class="crumb mono" aria-label="現在地"><a href="index.html">TOP</a><span>/</span><a href="column.html">COLUMN</a><span>/</span><b>{c['short']}</b></nav>
    <p class="svc-no">COLUMN <time datetime="{DATE}">{DATE_JP}</time></p>
    <h1 class="art-title">{c['title']}</h1>
  </div>
  <div class="ph pg-photo"><img data-photo="{c['photo']}" alt="{c['short']}のイメージ（株式会社sunriseの現場）"></div>
  </header>
  <article class="pg-sec w art">
    <p class="art-lead">{br(c['desc'])}</p>
    <nav class="art-toc" aria-label="目次"><p class="mono">CONTENTS</p><ol>{toc}</ol></nav>
    {body}
    {src}
    <p class="art-by">この記事を書いた会社：株式会社sunrise（愛知県あま市の解体工事会社）</p>
  </article>
  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>MORE</h2><p>ほかのコラム</p></div>
    <ul class="art-list">{more}</ul>
  </section>
{cta('解体のご相談・お見積りは無料です。', '現地調査のうえ、内訳と追加費用が出る条件を明記したお見積りをお出しします。', 'お見積り依頼', 'お見積りを依頼する')}
</div>'''

def column_index():
    cards = ''
    for c in COLUMNS:
        cards += f'''<a class="col-card" href="column/{c['slug']}.html"><div class="ph"><img data-photo="{c['photo']}" alt=""></div><div><p class="mono"><time datetime="{DATE}">{DATE_JP}</time></p><b>{c['title']}</b><span>{c['desc'][:70]}…</span></div></a>'''
    return f'''<div class="page" data-page="column">
{pg_header('column', 'COLUMN', 'コラム', '解体工事の前に知っておきたいことを、<br>現場の目線でまとめています。', 7)}
  <section class="pg-sec w">
    <div class="col-grid">{cards}</div>
  </section>
{cta('記事を読んで気になったことも、お気軽にどうぞ。', '現地調査・お見積りは無料です。')}
</div>'''

def related_block(service_key):
    items = [c for c in COLUMNS if service_key in c['related']]
    if not items:
        return ''
    lis = ''.join(f'<li><a href="column/{c["slug"]}.html">{c["title"]}</a></li>' for c in items)
    return f'''  <section class="pg-sec w">
    <div class="pg-sec-hd"><h2>COLUMN</h2><p>関連するコラム</p></div>
    <ul class="art-list">{lis}</ul>
  </section>
'''

EXTRA_CSS = r'''
/* ---------- SEO pages: area / faq / column ---------- */
.art{max-width:880px}
.art h2{font-family:var(--min);font-weight:800;font-size:clamp(19px,2vw,24px);line-height:1.6;letter-spacing:.08em;margin:2.4em 0 .9em;padding-left:14px;border-left:4px solid var(--sun)}
.art p{margin:0 0 1.1em;color:var(--body)}
.art ul,.art ol{margin:0 0 1.2em;padding-left:1.4em;color:var(--body)}
.art li{margin-bottom:.6em}
.art li::marker{color:var(--sun-d)}
.art b{color:var(--ink)}
.art-ol li b{font-size:15.5px}
.art-title{font-family:var(--min);font-weight:800;font-size:clamp(22px,3vw,38px);line-height:1.5;letter-spacing:.06em;margin-top:8px;max-width:22em;text-wrap:balance}
.art-lead{font-size:15.5px;border-bottom:1px solid var(--line);padding-bottom:1.4em}
.art-toc{background:var(--bg2);padding:18px 22px;margin:1.6em 0}
.art-toc .mono{color:var(--sun-d);margin:0 0 6px}
.art-toc ol{margin:0}
.art-toc a:hover,.art a.art-link:hover,.art-list a:hover{color:var(--sun-d)}
.art a.art-link{color:var(--sun-d);font-weight:700;border-bottom:1px solid currentColor}
.art .note{background:#FFF4E8;border-left:4px solid var(--sun);padding:12px 16px;margin:1.2em 0;color:var(--ink)}
.art .tbl{overflow-x:auto;margin:0 0 1.2em}
.art table{width:100%;border-collapse:collapse;font-size:14.5px}
.art th,.art td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}
.art th{background:var(--bg2);width:28%;font-weight:700;color:var(--ink);white-space:nowrap}
.art td{color:var(--body)}
.area-tb th{width:32%;white-space:normal}
.art-src{margin-top:2.4em;font-size:13px}
.art-src .mono{color:var(--dim);margin:0 0 4px}
.art-src a{text-decoration:underline}
.art-by{margin-top:1.8em;font-size:13px;color:var(--dim)}
.art-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.art-list li{border-bottom:1px solid var(--line)}
.art-list a{display:flex;justify-content:space-between;gap:16px;padding:14px 4px;font-weight:500}
.art-list a::after{content:"→";color:var(--sun-d)}
.col-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(18px,2.4vw,32px)}
.col-card{display:grid;gap:12px;align-content:start}
.col-card .ph{aspect-ratio:4/3}
.col-card .ph img{width:100%;height:100%;object-fit:cover}
.col-card b{display:block;font-size:16px;line-height:1.6;margin:4px 0 6px}
.col-card span{font-size:13px;color:var(--body);line-height:1.8}
.col-card .mono{color:var(--sun-d);margin:0}
.col-card:hover b{color:var(--sun-d)}
.col-card:hover .ph img{transform:scale(1.04)}
.ft-links{display:flex;gap:20px;flex-wrap:wrap}
/* ---------- サービスページの解説表・地域ページへのリンク ---------- */
.art .tb-wrap th{white-space:normal;width:36%}
.art .tb-wrap tr:first-child th{background:var(--ink);color:#fff}
.map-reg a{text-decoration:underline;text-underline-offset:3px}
.ft-reg{flex-basis:100%;display:flex;gap:8px 20px;flex-wrap:wrap}
@media (max-width:960px){.col-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.col-grid{grid-template-columns:1fr}.art th{white-space:normal;width:34%}}
'''
