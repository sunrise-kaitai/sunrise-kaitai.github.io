
const $=id=>document.getElementById(id);
const yen=n=>'¥'+Math.round(n||0).toLocaleString('ja-JP');
const num=v=>{const n=parseFloat(String(v??'').replace(/[,，¥円\s]/g,'').replace(/[０-９．]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)));return isFinite(n)?n:0};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso=d=>new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const jdate=s=>{if(!s)return'';const [y,m,d]=s.split('-');return `${y}年${+m}月${+d}日`};
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}

const PRESETS=[
 ['木造建物 解体工事','坪'],['鉄骨造建物 解体工事','坪'],['RC造建物 解体工事','坪'],['内装解体工事','㎡'],
 ['産業廃棄物 運搬・処分費','式'],['残置物 撤去・処分','㎥'],['養生シート・足場','式'],['重機回送費','回'],
 ['ブロック塀 撤去','m'],['土間コンクリート 撤去','㎡'],['庭木・庭石 撤去','式'],['整地','㎡'],
 ['アスベスト事前調査','式'],['各種届出 代行','式'],['近隣あいさつ・諸経費','式']];

const SEAL0='';
const DEFAULT_CO={coName:'株式会社sunrise',coZip:'',coAddr:'',coAddr2:'',coTel:'',coTel2:'',coRep:'',seal:''};
const DEFAULT_MEMO='';

function newEstimate(sample){
  const t=new Date();
  const no=iso(t).replace(/-/g,'')+'-'+String(Math.floor(Math.random()*90)+10);
  const base={id:'e'+Date.now().toString(36),no,date:iso(t),cust:'',hon:'御中',disc:'',tax:'10',memo:'',items:[{k:'',n:'',q:'1',u:'式',p:''}],sample:false};
  return base;
}

let co=Object.assign({},DEFAULT_CO,LS.get('mt2_co')||{});
let est=LS.get('mt2_draft')||newEstimate(false);
let saved=LS.get('mt2_list')||[];
let db=null,uid=null;

/* ---------- 計算 ---------- */
function calc(e){
  const rows=e.items.filter(i=>i.n||i.k||num(i.p)).map(i=>({...i,a:Math.round(num(i.q)*num(i.p))}));
  const sub=rows.reduce((s,r)=>s+r.a,0)-num(e.disc);
  const rate=num(e.tax)/100;const tax=Math.floor(sub*rate);
  return {rows,sub,tax,total:sub+tax,rate};
}

/* ---------- フォーム ⇄ データ ---------- */
const F=['cust','date','tax','disc','memo'];
const C=['coName','coZip','coAddr','coAddr2','coTel','coTel2','coRep'];
function fill(){
  F.forEach(k=>$(k).value=est[k]??'');
  (est.hon==='様'?$('hon1'):$('hon2')).checked=true;
  C.forEach(k=>$(k).value=co[k]??'');
  sealView();renderItems();render();
}
function renderItems(){
  $('items').innerHTML=est.items.map((it,i)=>`<div class="item" data-i="${i}">
    <input aria-label="名称" id="it${i}k" value="${esc(it.k)}" data-k="k" placeholder="名称（空欄可）">
    <input aria-label="項目" id="it${i}n" value="${esc(it.n)}" data-k="n" placeholder="項目（例：瑞穂区内装解体工事）" style="grid-column:span 2">
    <button class="x" aria-label="この行を消す" data-del="${i}">×</button>
    <div class="q"><input aria-label="数量" id="it${i}q" class="num" inputmode="decimal" value="${esc(it.q)}" data-k="q" placeholder="数量">
    <input aria-label="単位" id="it${i}u" value="${esc(it.u)}" data-k="u" list="units" placeholder="単位">
    <input aria-label="単価" id="it${i}p" class="num" inputmode="numeric" value="${esc(it.p)}" data-k="p" placeholder="単価（円）"></div></div>`).join('')+
    '<datalist id="units"><option>式</option><option>坪</option><option>㎡</option><option>㎥</option><option>m</option><option>台</option><option>回</option><option>t</option><option>人工</option></datalist>';
}
$('items').addEventListener('input',e=>{const r=e.target.closest('.item');if(!r)return;est.items[r.dataset.i][e.target.dataset.k]=e.target.value;changed()});
$('items').addEventListener('click',e=>{const d=e.target.dataset.del;if(d==null)return;est.items.splice(+d,1);if(!est.items.length)est.items.push({k:'',n:'',q:'1',u:'式',p:''});renderItems();changed()});
$('addItem').onclick=()=>{est.items.push({k:'',n:'',q:'1',u:'式',p:''});renderItems();changed();$('it'+(est.items.length-1)+'n').focus()};
$('presets').innerHTML=PRESETS.map((p,i)=>`<button class="chip" data-p="${i}">${p[0]}</button>`).join('');
$('presets').onclick=e=>{const i=e.target.dataset.p;if(i==null)return;const [n,u]=PRESETS[i];
  const last=est.items[est.items.length-1];if(last&&!last.n&&!last.k&&!num(last.p))est.items.pop();
  est.items.push({k:'',n,q:u==='式'?'1':'',u,p:''});renderItems();changed();$('it'+(est.items.length-1)+(u==='式'?'p':'q')).focus()};
F.forEach(k=>$(k).addEventListener('input',()=>{est[k]=$(k).value;changed()}));
document.querySelectorAll('input[name=hon]').forEach(r=>r.addEventListener('change',()=>{est.hon=r.value;changed()}));
C.forEach(k=>$(k).addEventListener('input',()=>{co[k]=$(k).value;render()}));

function changed(){if(est.sample){est.sample=false}LS.set('mt2_draft',est);render()}

/* ---------- 見積書 ---------- */
const reiwa=s=>{if(!s)return'';const [y,m,d]=s.split('-');return `令和　${+y-2018}年　${+m}月${+d}日`};
const cm=n=>Math.round(n).toLocaleString('ja-JP');
function sheetHTML(e){
  const c=calc(e);const N=15;
  const rows=c.rows.map(r=>{const lump=String(r.u).trim()==='式'&&num(r.q)===1;
    return `<tr><td class="c">${esc(r.k)}</td><td class="c">${esc(r.n)}</td><td class="c">${esc(r.q)}${esc(r.u)}</td><td class="n">${lump?'':cm(num(r.p))}</td><td class="n">${cm(r.a)}</td></tr>`}).join('');
  const disc=num(e.disc)?`<tr><td></td><td class="c">お値引き</td><td></td><td></td><td class="n">-${cm(num(e.disc))}</td></tr>`:'';
  const used=c.rows.length+(disc?1:0);
  const blank='<tr><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(Math.max(0,N-used));
  return `<div class="date">発行日：${reiwa(e.date)}</div>
  <h2 class="ttl">お見積書</h2>
  <div class="to"><div class="nm">${esc(e.cust)||'&nbsp;'}</div><div class="hon">${esc(e.hon||'御中')}</div></div>
  <div class="mid">
    <p class="lead">下記の通りお見積り申し上げます。</p>
    <div class="co">
      <div class="cn">${esc(co.coName)}</div>
      ${co.coZip?`<div>〒 ${esc(co.coZip)}</div>`:''}
      ${co.coAddr?`<div class="sm">住所：${esc(co.coAddr)}</div>`:''}
      ${co.coAddr2?`<div class="sm ind">${esc(co.coAddr2)}</div>`:''}
      ${co.coTel||co.coTel2?`<div class="tel"><span>TEL：</span><span>${esc(co.coTel)}</span>${co.coTel2?`<span>${esc(co.coTel2)}</span>`:''}</div>`:''}
      ${co.coRep?`<div class="rep">担当：${esc(co.coRep)}</div>`:''}
      ${co.seal?`<img class="seal" src="${co.seal}" alt="">`:''}
    </div>
  </div>
  <div class="amount"><span>${c.rate?'税込見積金額':'見積金額'}</span><strong>${yen(c.total)}</strong></div>
  <table><colgroup><col style="width:90px"><col><col style="width:84px"><col style="width:100px"><col style="width:116px"></colgroup>
  <thead><tr><th>名称</th><th>項目</th><th>数量</th><th>単価</th><th>金額</th></tr></thead>
  <tbody>${rows}${disc}${blank}</tbody></table>
  <div class="foot">
    <div class="bk"><h4>備考</h4><div>${esc(e.memo)}</div></div>
    <div class="sum">
      <span>小 計</span><b>${cm(c.sub)}</b>
      ${c.rate?`<span>消費税</span><b>${cm(c.tax)}</b>`:''}
      <span>合計</span><b>${cm(c.total)}</b>
    </div>
  </div>
  <div class="rules"><p></p><p></p><p></p></div>`;
}
function render(){
  $('sheet').innerHTML=sheetHTML(est);
  $('miniTotal').textContent=yen(calc(est).total);
  $('sampleBadge').hidden=!est.sample;
  fit();
}
function fit(){const vp=$('vp'),s=$('sheet');const k=vp.clientWidth/794;s.style.transform=`scale(${k})`;vp.style.height=(s.offsetHeight*k)+'px'}
new ResizeObserver(fit).observe($('vp'));
window.addEventListener('resize',fit);

/* ---------- 印鑑 ---------- */
function sealView(){$('sealImg').hidden=!co.seal;$('sealDel').hidden=!co.seal;if(co.seal)$('sealImg').src=co.seal}
$('seal').onchange=e=>{const f=e.target.files[0];if(!f)return;const img=new Image();const r=new FileReader();
  r.onload=()=>{img.onload=()=>{const cv=document.createElement('canvas');const s=Math.min(1,300/Math.max(img.width,img.height));cv.width=img.width*s;cv.height=img.height*s;
    const x=cv.getContext('2d');x.drawImage(img,0,0,cv.width,cv.height);
    // 白い背景を透明にして、朱色だけ残す
    const d=x.getImageData(0,0,cv.width,cv.height),p=d.data;for(let i=0;i<p.length;i+=4){const l=(p[i]+p[i+1]+p[i+2])/3;if(l>200&&Math.abs(p[i]-p[i+2])<40)p[i+3]=0}
    x.putImageData(d,0,0);co.seal=cv.toDataURL('image/png');sealView();render()};img.src=r.result};r.readAsDataURL(f)};
$('sealDel').onclick=()=>{co.seal='';$('seal').value='';sealView();render()};

/* ---------- 保存（クラウド優先、使えなければこの端末） ---------- */
async function initStore(){
  try{
    const [d,u]=await Promise.all([claude.use('db'),claude.use('user')]);
    if(d&&u){db=d;uid=await u.id();}
  }catch(e){db=null}
  if(db){
    $('sync').textContent='保存先：あなたのアカウント（スマホとパソコンで共通）';
    try{const s=await db.doc(`data/users/${uid}/settings/company`).get();if(s.exists){co=Object.assign({},DEFAULT_CO,s.data());C.forEach(k=>$(k).value=co[k]??'');sealView();render()}}catch(e){}
    db.collection(`data/users/${uid}/estimates`).orderBy('updatedAt','desc').limit(200).onSnapshot(s=>{saved=s.docs.map(d=>d.data());drawHist()},()=>{});
  }else{
    $('sync').textContent='保存先：この端末のブラウザ';
    drawHist();
  }
}
$('sync').textContent='保存先：このスマホ（このブラウザ）';drawHist();

$('coImport').onclick=()=>{
  const v=$('coCode').value.trim().replace(/^SUNRISE:/,'');
  try{const o=JSON.parse(decodeURIComponent(escape(atob(v))));C.forEach(k=>{if(typeof o[k]==='string')co[k]=o[k]});C.forEach(k=>$(k).value=co[k]??'');LS.set('mt2_co',co);render();$('coCode').value='';toast('会社情報を取り込みました')}
  catch(e){toast('コードが読み取れません。全部コピーできているか確認してください')}
};
$('saveCo').onclick=async()=>{LS.set('mt2_co',co);
  if(db){try{await db.doc(`data/users/${uid}/settings/company`).set(co);toast('会社情報を保存しました')}catch(e){toast('保存できませんでした。もう一度押してください')}}
  else toast('会社情報をこのスマホに保存しました')};

$('save').onclick=async()=>{
  const c=calc(est);const rec={...est,sample:false,total:c.total,updatedAt:new Date().toISOString()};
  LS.set('mt2_co',co);
  if(db){try{await db.doc(`data/users/${uid}/estimates/${est.id}`).set(rec);await db.doc(`data/users/${uid}/settings/company`).set(co);toast('保存しました')}catch(e){toast('保存できませんでした。もう一度押してください')}}
  else{saved=[rec,...saved.filter(s=>s.id!==est.id)];LS.set('mt2_list',saved);drawHist();toast('このスマホに保存しました')}
};
function drawHist(){
  const el=$('hist');
  if(!saved.length){el.innerHTML='<p class="note">まだありません。下の「保存」を押すとここに残ります。</p>';return}
  el.innerHTML=saved.map(s=>`<div class="h" data-id="${esc(s.id)}"><div><strong>${esc(s.cust||'（お客様名なし）')}　${esc((s.items&&s.items[0]&&s.items[0].n)||'')}</strong><span>${jdate(s.date)}・${yen(s.total)}</span></div>
    <div class="acts"><button class="btn small" data-open>開く</button><button class="btn small" data-copy>複製</button><button class="btn small" data-del>削除</button></div></div>`).join('');
}
$('hist').onclick=async e=>{
  const h=e.target.closest('.h');if(!h)return;const s=saved.find(x=>x.id===h.dataset.id);if(!s)return;
  if(e.target.hasAttribute('data-open')){est=structuredClone(s);LS.set('mt2_draft',est);fill();toast('開きました');show('edit')}
  else if(e.target.hasAttribute('data-copy')){const n=newEstimate(false);est={...structuredClone(s),id:n.id,no:n.no,date:n.date};LS.set('mt2_draft',est);fill();toast('複製しました。お客様名などを直してください')}
  else if(e.target.hasAttribute('data-del')){
    const a=h.querySelector('.acts');a.innerHTML='<span class="confirm">消しますか？<button class="btn small" data-yes>消す</button><button class="btn small" data-no>やめる</button></span>';}
  else if(e.target.hasAttribute('data-yes')){
    if(db){try{await db.doc(`data/users/${uid}/estimates/${s.id}`).delete()}catch(err){toast('削除できませんでした')}}
    else{saved=saved.filter(x=>x.id!==s.id);LS.set('mt2_list',saved);drawHist()}}
  else if(e.target.hasAttribute('data-no'))drawHist();
};
$('newEst').onclick=()=>{est=newEstimate(false);LS.set('mt2_draft',est);fill();$('cust').focus()};

/* ---------- 書き出し ---------- */
async function snapshot(){
  const off=$('offscreen');off.innerHTML='';const s=document.createElement('div');s.className='sheet';s.innerHTML=sheetHTML(est);off.appendChild(s);
  await document.fonts.ready;
  const cv=await html2canvas(s,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
  off.innerHTML='';return cv;
}
const fname=ext=>`御見積書_${(est.cust||'').replace(/[\\/:*?"<>|\s]/g,'')||est.no}.${ext}`;
let lastURL=null;
async function offer(filename,data,previewCanvas){
  const type=filename.endsWith('.pdf')?'application/pdf':'image/png';
  const file=new File([data],filename,{type});
  // 1) スマホの共有画面（LINEを選べる）
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return}}
  catch(e){if(e&&e.name==='AbortError')return}
  // 2) 共有画面が使えないとき：画像を表示して長押しで保存してもらう
  if(lastURL)URL.revokeObjectURL(lastURL);lastURL=URL.createObjectURL(file);
  $('ovImg').src=previewCanvas?previewCanvas.toDataURL('image/png'):lastURL;
  $('ovDl').href=lastURL;$('ovDl').download=filename;
  $('ovMsg').textContent=type==='image/png'
    ?'画像を長押しして「保存」または「共有」を選び、LINEのトークで送ってください。'
    :'下の「PDFを開く」を押して保存してください。うまくいかないときは「ブラウザで開く」から開き直してください。';
  $('ovDl').textContent=type==='image/png'?'画像を開く':'PDFを開く';
  $('ov').hidden=false;
}
$('ovClose').onclick=()=>$('ov').hidden=true;
$('ovExt').href=location.origin+location.pathname+'?openExternalBrowser=1';
async function busy(btn,fn){btn.disabled=true;const t=btn.textContent;btn.textContent='作成中…';try{await fn()}finally{btn.disabled=false;btn.textContent=t}}
$('pdf').onclick=e=>busy(e.currentTarget,async()=>{
  const cv=await snapshot();const {jsPDF}=window.jspdf;const pdf=new jsPDF({unit:'mm',format:'a4'});
  const W=210,H=297,pxPerPage=Math.floor(cv.width*H/W);
  for(let y=0,p=0;y<cv.height;y+=pxPerPage,p++){
    const h=Math.min(pxPerPage,cv.height-y);const part=document.createElement('canvas');part.width=cv.width;part.height=h;
    part.getContext('2d').drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
    if(p)pdf.addPage();pdf.addImage(part.toDataURL('image/jpeg',0.92),'JPEG',0,0,W,h*W/cv.width);
  }
  await offer(fname('pdf'),pdf.output('blob'),cv);
});
$('png').onclick=e=>busy(e.currentTarget,async()=>{const cv=await snapshot();const b=await new Promise(r=>cv.toBlob(r,'image/png'));await offer(fname('png'),b,cv)});
$('copyLine').onclick=async()=>{
  const c=calc(est);
  const subj=(est.items.find(i=>i.n)||{}).n||'';
  const t=[`${est.cust||''}${est.cust?' '+(est.hon||'御中'):''}`,'','いつもお世話になっております。','お見積りをお送りします。','',subj?`項目：${subj}`:'',`${c.rate?'税込見積金額':'見積金額'}：${yen(c.total)}`,'','詳しくは添付の見積書をご確認ください。','ご不明な点はお気軽にご連絡ください。','',co.coName,co.coRep?`担当：${co.coRep}`:'',co.coTel?`TEL：${co.coTel}`:''].filter((x,i,a)=>x!==''||a[i-1]!=='').join('\n');
  try{await navigator.clipboard.writeText(t);toast('コピーしました。LINEに貼り付けてください')}
  catch(err){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('コピーしました')}catch(e2){toast('コピーできませんでした')}ta.remove()}
};

/* ---------- スマホ切り替え ---------- */
function show(v){$('grid').dataset.view=v;$('tabEdit').setAttribute('aria-selected',v==='edit');$('tabPrev').setAttribute('aria-selected',v==='prev');if(v==='prev')requestAnimationFrame(fit)}
$('tabEdit').onclick=()=>show('edit');$('tabPrev').onclick=()=>show('prev');

if(!co.coAddr)$('coCard').open=true;
fill();
