window.__PH={"1": "/img/p01.webp", "2": "/img/p02.webp", "3": "/img/p03.webp", "4": "/img/p04.webp", "5": "/img/p05.webp", "6": "/img/p06.webp", "7": "/img/p07.webp", "8": "/img/p08.webp", "9": "/img/p09.webp", "10": "/img/p10.webp", "11": "/img/p11.webp"};

(function(){
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
var hd=document.getElementById('hd'),fix=document.getElementById('fix');
function onS(){var y=scrollY;hd.classList.toggle('s',y>40);fix.classList.toggle('on',y>innerHeight*.6);}
addEventListener('scroll',onS,{passive:true});onS();
/* slides */
var sl=[].slice.call(document.querySelectorAll('.slide')),dots=document.getElementById('dots'),si=0,h1=document.getElementById('nari');
sl.forEach(function(){dots.appendChild(document.createElement('i'));});
function show(i){sl.forEach(function(s,k){s.classList.toggle('on',k===i)});[].forEach.call(dots.children,function(d,k){d.classList.toggle('on',k===i)});}
show(0);
if(!RM)setInterval(function(){si=(si+1)%sl.length;show(si);h1.classList.remove('shake');void h1.offsetWidth;h1.classList.add('shake');},4800);
/* rotating lines */
var R=['重機を、動かせ。','仲間と、デカい現場を落とせ。','一生モノの腕を、手に入れろ。','いつか、自分の看板を掲げろ。'],ri=0,rot=document.getElementById('rot');
function type(s){if(RM){rot.textContent=s;return;}var k=0;rot.textContent='';var id=setInterval(function(){rot.textContent=s.slice(0,++k);if(k>=s.length)clearInterval(id);},55);}
var rotP=rot.parentNode;function rotH(){var keep=rot.textContent,mh=0;rotP.style.minHeight='';R.forEach(function(s){rot.textContent=s;mh=Math.max(mh,rotP.offsetHeight);});rot.textContent=keep;rotP.style.minHeight=mh+'px';}
rotH();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(rotH);
setInterval(function(){ri=(ri+1)%R.length;type(R[ri]);},3200);
/* dust */
var cv=document.getElementById('dust'),g=cv.getContext('2d'),P=[];
function sz(){var w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==w)cv.width=w;if(Math.abs(cv.height-h)>120)cv.height=h;}sz();addEventListener('resize',sz);
for(var i=0;i<70;i++)P.push({x:Math.random(),y:Math.random(),r:Math.random()*2.2+.4,v:Math.random()*.25+.05,d:Math.random()*.2-.1,a:Math.random()*.5+.15});
function dust(){g.clearRect(0,0,cv.width,cv.height);P.forEach(function(p){p.y-=p.v/cv.height*2;p.x+=p.d/cv.width*2;if(p.y<0){p.y=1;p.x=Math.random();}g.fillStyle='rgba(255,200,150,'+p.a+')';g.beginPath();g.arc(p.x*cv.width,p.y*cv.height,p.r,0,7);g.fill();});if(!RM)requestAnimationFrame(dust);}
dust();
/* count up */
var cs=[].slice.call(document.querySelectorAll('[data-count]'));
function cnt(){cs.forEach(function(c){if(c._d)return;var r=c.getBoundingClientRect();if(r.top<innerHeight*.9){c._d=1;if(RM)return;var n=+c.dataset.count,k=0;c.textContent='0';var id=setInterval(function(){k++;c.textContent=k;if(k>=n)clearInterval(id);},160);}});}
addEventListener('scroll',cnt,{passive:true});cnt();
/* tilt */
if(!RM&&matchMedia('(hover:hover)').matches)document.querySelectorAll('.dream').forEach(function(d){d.addEventListener('mousemove',function(e){var r=d.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;d.style.transform='perspective(900px) rotateY('+(x*6)+'deg) rotateX('+(-y*6)+'deg)';});d.addEventListener('mouseleave',function(){d.style.transform='';});});
function mapUpd(i){var mob=matchMedia('(max-width:760px)').matches,k=mob?'m':'d',p=document.getElementById('rp-'+k),L=p.getTotalLength(),vb=mob?[400,760]:[1000,460];
  var ms=document.querySelectorAll('.gmap .ms'),pts=[];ms.forEach(function(b,j){var pt=p.getPointAtLength(L*j/(ms.length-1));pts.push(pt);b.style.left=(pt.x/vb[0]*100)+'%';b.style.top=(pt.y/vb[1]*100)+'%';if(!mob){var up=pt.y/vb[1]>0.45;b.classList.toggle('up',up);b.classList.toggle('dn',!up);var fx=pt.x/vb[0];b.style.setProperty('--ax',fx<0.16?'-14%':fx>0.84?'-86%':'-50%');}});
  p.style.strokeDasharray=L;p.style.strokeDashoffset=L*(1-i/(ms.length-1));
  var gv=document.getElementById('gveh');gv.classList.toggle('below',!mob&&ms[i].classList.contains('up'));gv.style.left=(pts[i].x/vb[0]*100)+'%';gv.style.top=(pts[i].y/vb[1]*100)+'%';
  document.getElementById('hud-st').textContent=i===4?'COMPLETE':'TIER '+(i+1)+' / 5';document.getElementById('hud-exp').style.width=(i/4*100)+'%';}
/* road */
var RK=[['見習い','道具と安全の基本を、体で覚える。',['安全の基本','養生','片付け'],3],['職人','手ばらし・分別を任される。',['手ばらし','分別','積み込み'],1],['重機オペ','資格をとって、重機を動かす側へ。',['重機操作','つかむ・くだく','散水連携'],7],['リーダー','現場の段取りを回し、仲間を動かす。',['段取り','安全管理','後輩を育てる'],9],['親方・独立','いつか、自分の看板を掲げる。',['現場を仕切る','看板を背負う'],4]];
var stp=[].slice.call(document.querySelectorAll('.ms')),veh=document.getElementById('veh'),rfill=document.getElementById('rfill'),rmap=document.getElementById('rmap'),rank=document.getElementById('rank'),segs=[].slice.call(document.querySelectorAll('.segs i')),cur=0;
var MQ=matchMedia('(max-width:760px)');
function go(i,quiet){cur=i;stp.forEach(function(b,k){b.classList.toggle('cur',k===i);b.classList.toggle('done',k<i);b.setAttribute('aria-pressed',String(k===i));});
  segs.forEach(function(g,k){g.classList.toggle('on',k<=i)});
  document.getElementById('rk-lv').textContent=i+1;document.getElementById('rk-step').textContent=(i+1)+' / 5';
  document.getElementById('rk-name').textContent=RK[i][0]+(i===4?'（夢）':'');document.getElementById('rk-txt').textContent=RK[i][1];
  document.getElementById('rk-hint').textContent=i<4?'NEXT：'+RK[i+1][0]:'ここがゴール。いや、スタートだ。';
  document.getElementById('rk-next').textContent=i<4?'次のランクへ ▶':'もう一度のぼる ↺';
  rank.classList.toggle('dream',i===4);mapUpd(i);
  document.getElementById('rk-skills').innerHTML=RK[i][2].map(function(x){return '<span>'+x+'</span>'}).join('');
  document.getElementById('insig').innerHTML=i===4?'<i class="star"></i>':new Array(i+1).join('<i></i>');
  var rb=rank.querySelector('.bg');if(window.__PH)rb.style.backgroundImage='url('+window.__PH[RK[i][3]]+')';
  var n=stp[i].querySelector('.node'),mr=rmap.getBoundingClientRect(),nr=n.getBoundingClientRect();
  if(MQ.matches){rfill.style.height=(nr.top-mr.top+nr.height/2)+'px';}
  else{var x=nr.left-mr.left+nr.width/2;rfill.style.width=x+'px';veh.style.left=x+'px';}
  if(i>0&&!RM&&!quiet){var bu=document.getElementById('burst');bu.textContent=i===4?'DREAM!':'RANK UP!';bu.classList.remove('go');void bu.offsetWidth;bu.classList.add('go');}
  var big=document.querySelector('.rank .big');if(!RM&&!quiet&&big.animate)big.animate([{transform:'scale(1.25)',opacity:.3},{transform:'scale(1)',opacity:1}],{duration:380,easing:'cubic-bezier(.2,1.4,.4,1)'});}
stp.forEach(function(b,i){b.addEventListener('click',function(){go(i)});});
document.getElementById('rk-next').addEventListener('click',function(){go(cur<4?cur+1:0);});
var lastW=innerWidth,rzT;addEventListener('resize',function(){if(innerWidth===lastW)return;lastW=innerWidth;clearTimeout(rzT);rzT=setTimeout(function(){go(cur,true);rotH();},150);});
go(0,true);
var played=false;function autoplay(){if(played||RM)return;var r=rmap.getBoundingClientRect();if(r.top<innerHeight*.7&&r.bottom>0){played=true;var k=0;var id=setInterval(function(){k++;go(k);if(k>=4)clearInterval(id);},800);}}
addEventListener('scroll',autoplay,{passive:true});autoplay();
/* gallery */
var st=document.getElementById('strip');function mv(d){var f=st.querySelector('figure');st.scrollBy({left:d*(f?f.getBoundingClientRect().width+12:300),behavior:'smooth'});}
document.getElementById('prev').addEventListener('click',function(){mv(-1)});document.getElementById('next').addEventListener('click',function(){mv(1)});
var lb=document.getElementById('lb'),li=document.getElementById('lbimg'),lc=document.getElementById('lbcap'),last=null;
st.addEventListener('click',function(e){var b=e.target.closest('button[data-p]');if(!b)return;last=b;li.src=window.__PH[b.dataset.p];li.alt=b.dataset.cap;lc.textContent=b.dataset.cap;lb.hidden=false;document.getElementById('lbx').focus();});
function cl(){lb.hidden=true;if(last)last.focus();}
document.getElementById('lbx').addEventListener('click',cl);lb.addEventListener('click',function(e){if(e.target===lb)cl();});
addEventListener('keydown',function(e){if(e.key==='Escape'&&!lb.hidden)cl();});
document.querySelectorAll('.fq button').forEach(function(q){q.addEventListener('click',function(){var o=q.getAttribute('aria-expanded')==='true';q.setAttribute('aria-expanded',String(!o));q.nextElementSibling.hidden=o;});});
var t=document.getElementById('toast');function toast(m){t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('on')},1800);}
document.getElementById('copy').addEventListener('click',function(){function sel(){var r=document.createRange();r.selectNodeContents(document.getElementById('num'));var s=getSelection();s.removeAllRanges();s.addRange(r);toast('番号を選択しました');}
  try{navigator.clipboard.writeText('090-7686-6461').then(function(){toast('番号をコピーしました')},sel);}catch(e){sel()}});
})();
/* 右上のメニュー（ホームページ本体と同じ行き先） */
(function(){var nav=document.getElementById('rnav'),op=document.getElementById('rnav-open'),cl=document.getElementById('rnav-close');if(!nav||!op||!cl)return;
function set(o){nav.hidden=!o;op.setAttribute('aria-expanded',String(o));document.documentElement.style.overflow=o?'hidden':'';if(o)cl.focus();else op.focus();}
op.addEventListener('click',function(){set(true)});cl.addEventListener('click',function(){set(false)});
nav.addEventListener('click',function(e){if(e.target.closest('a'))set(false)});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!nav.hidden)set(false)});})();
