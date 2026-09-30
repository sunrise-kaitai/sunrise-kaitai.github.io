/* =========================================================
   写真の差し替え方法：
   下の PHOTOS に「シーン名: [画像URL, …]」を入れると、
   その種類の仮画像が実際の写真に置き換わります。
   例）excavator: ["https://example.com/site01.jpg"]
   ========================================================= */
const PHOTOS = {
  excavator:[1,4,7,9,10], dawn:[9,1,10,4,7], debris:[1,7,4,10,9], stripes:[10,4,1],
  interior:[2,3,5,6,8], concrete:[6,5,8,3], rebar:[5,8,6], restore:[6,8,5,3]
};
const photo=n=>`/img/p${String(n).padStart(2,'0')}.webp`;

document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- procedural site imagery ---------- */
function rng(seed){let s=seed*9301+49297;return()=>{s=(s*9301+49297)%233280;return s/233280}}
const cache={};
function scene(type,seed,W=640,H=480){
  const key=type+seed; if(cache[key])return cache[key];
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');const r=rng(seed);
  const lg=(a,b,stops)=>{const g=x.createLinearGradient(...a,...b);stops.forEach(([o,col])=>g.addColorStop(o,col));return g};
  const hz=H*(.62+r()*.12);
  const sky=[['#1a1714','#6b3a1c','#e0823a'],['#141518','#3c3a3a','#a9745a'],['#0f1013','#2b2f36','#7a6a5c']][Math.floor(r()*3)];
  if(type==='dawn'||type==='excavator'){
    x.fillStyle=lg([0,0],[0,hz],[[0,sky[0]],[.6,sky[1]],[1,sky[2]]]);x.fillRect(0,0,W,hz);
    const sx=W*(.3+r()*.4),sr=H*(.12+r()*.1);
    const glow=x.createRadialGradient(sx,hz,sr*.2,sx,hz,sr*4);glow.addColorStop(0,'rgba(250,180,90,.55)');glow.addColorStop(1,'rgba(250,180,90,0)');x.fillStyle=glow;x.fillRect(0,0,W,hz);
    x.fillStyle='#f6b35c';x.beginPath();x.arc(sx,hz,sr,Math.PI,0);x.fill();
    x.fillStyle='#0d0c0b';let px=-10;
    while(px<W){const bw=20+r()*70,bh=10+r()*H*.28;x.fillRect(px,hz-bh,bw,bh+2);if(r()<.3){x.fillRect(px+bw*.4,hz-bh-r()*30,3,40)}px+=bw+r()*4}
    x.fillStyle='#0a0908';x.fillRect(0,hz,W,H-hz);
    if(type==='excavator'){
      const ex=W*(.3+r()*.2),gy=hz+H*.06,s=H/420;
      x.fillStyle='#0a0908';x.fillRect(0,hz-4,W,H);
      x.fillStyle='#070706';
      x.fillRect(ex-90*s,gy-26*s,180*s,26*s);
      x.beginPath();x.arc(ex-90*s,gy-13*s,13*s,0,7);x.arc(ex+90*s,gy-13*s,13*s,0,7);x.fill();
      x.fillRect(ex-70*s,gy-80*s,120*s,54*s);
      x.fillRect(ex-60*s,gy-130*s,56*s,50*s);
      x.fillStyle='rgba(240,170,90,.35)';x.fillRect(ex-54*s,gy-124*s,40*s,26*s);
      x.strokeStyle='#070706';x.lineCap='round';x.lineWidth=16*s;
      x.beginPath();x.moveTo(ex+30*s,gy-70*s);x.lineTo(ex+130*s,gy-190*s);x.lineTo(ex+210*s,gy-110*s);x.stroke();
      x.fillStyle='#070706';x.beginPath();x.moveTo(ex+195*s,gy-120*s);x.lineTo(ex+245*s,gy-100*s);x.lineTo(ex+225*s,gy-60*s);x.lineTo(ex+195*s,gy-80*s);x.fill();
      for(let i=0;i<260;i++){const d=r();x.fillStyle=`rgba(210,170,130,${.05+d*.12})`;x.beginPath();x.arc(ex+150*s+(r()-.5)*260*s,gy-60*s-r()*170*s,r()*10*s,0,7);x.fill()}
    }
  }else if(type==='concrete'){
    x.fillStyle=lg([0,0],[W,H],[[0,'#5d5953'],[1,'#34312d']]);x.fillRect(0,0,W,H);
    const pw=W/3,ph=H/2;x.strokeStyle='rgba(20,18,16,.55)';x.lineWidth=2;
    for(let i=1;i<3;i++){x.beginPath();x.moveTo(pw*i,0);x.lineTo(pw*i,H);x.stroke()}
    x.beginPath();x.moveTo(0,ph);x.lineTo(W,ph);x.stroke();
    for(let i=0;i<3;i++)for(let j=0;j<2;j++)for(let a=0;a<2;a++)for(let b=0;b<2;b++){
      const cx=pw*i+pw*(.25+.5*a),cy=ph*j+ph*(.25+.5*b);x.fillStyle='#1d1b18';x.beginPath();x.arc(cx,cy,6,0,7);x.fill();x.fillStyle='rgba(255,255,255,.08)';x.beginPath();x.arc(cx-1,cy-1,6,Math.PI,1.5*Math.PI);x.fill()}
    const lx=r()*W;x.fillStyle=lg([lx-W*.3,0],[lx+W*.3,0],[[0,'rgba(242,161,58,0)'],[.5,'rgba(242,161,58,.18)'],[1,'rgba(242,161,58,0)']]);x.fillRect(0,0,W,H);
  }else if(type==='rebar'){
    x.fillStyle=lg([0,0],[0,H],[[0,'#1e1b18'],[1,'#0c0b0a']]);x.fillRect(0,0,W,H);
    const vx=W*(.3+r()*.4),vy=H*(.2+r()*.2);
    for(let i=-12;i<=12;i++){x.strokeStyle=`rgba(${150+r()*60},${80+r()*30},40,.8)`;x.lineWidth=2+r()*2;x.beginPath();x.moveTo(vx,vy);x.lineTo(vx+i*W*.12,H*1.1);x.stroke()}
    for(let k=1;k<14;k++){const t=Math.pow(k/14,1.6),y=vy+(H*1.1-vy)*t;x.strokeStyle='rgba(170,100,50,.75)';x.lineWidth=1+t*3;x.beginPath();x.moveTo(vx-(y-vy)*1.35,y);x.lineTo(vx+(y-vy)*1.35,y);x.stroke()}
    const g=x.createRadialGradient(vx,vy,0,vx,vy,H*.6);g.addColorStop(0,'rgba(250,190,110,.45)');g.addColorStop(1,'rgba(250,190,110,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  }else if(type==='interior'||type==='restore'){
    const light=type==='restore';
    const cx=W*(.4+r()*.2),cy=H*(.42+r()*.1),iw=W*.34,ih=H*.34;
    const L=cx-iw/2,R=cx+iw/2,T=cy-ih/2,B=cy+ih/2;
    const wall=light?['#cfc7b8','#a79f91']:['#3b3732','#1d1b18'];
    x.fillStyle=light?'#bdb4a4':'#2b2824';x.fillRect(0,0,W,H);
    x.fillStyle=light?'#e7e0d2':'#4a453e';x.beginPath();x.moveTo(0,0);x.lineTo(W,0);x.lineTo(R,T);x.lineTo(L,T);x.fill();
    x.fillStyle=light?'#9d917d':'#141210';x.beginPath();x.moveTo(0,H);x.lineTo(W,H);x.lineTo(R,B);x.lineTo(L,B);x.fill();
    x.fillStyle=lg([0,0],[L,0],[[0,wall[1]],[1,wall[0]]]);x.beginPath();x.moveTo(0,0);x.lineTo(L,T);x.lineTo(L,B);x.lineTo(0,H);x.fill();
    x.fillStyle=lg([W,0],[R,0],[[0,wall[1]],[1,wall[0]]]);x.beginPath();x.moveTo(W,0);x.lineTo(R,T);x.lineTo(R,B);x.lineTo(W,H);x.fill();
    x.fillStyle=light?'#f4efe4':'#e9c48a';x.fillRect(L,T,iw,ih);
    x.fillStyle=light?'rgba(0,0,0,.06)':'rgba(20,18,16,.9)';x.fillRect(L+iw*.48,T,iw*.04,ih);x.fillRect(L,T+ih*.45,iw,ih*.04);
    if(!light){
      x.strokeStyle='rgba(200,190,170,.35)';x.lineWidth=1;
      for(let i=0;i<=10;i++){const t=i/10;x.beginPath();x.moveTo(W*t,0);x.lineTo(L+iw*t,T);x.stroke()}
      for(let k=1;k<6;k++){const t=k/6;x.beginPath();x.moveTo(L*(1-t)*0+ (L-L*t)*0 + L*t*0 + (0*(1-t)+L*t),T*t);x.lineTo(W*(1-t)+R*t,T*t);x.stroke()}
      x.strokeStyle='rgba(242,161,58,.6)';x.lineWidth=3;x.beginPath();x.moveTo(W*.1,H*.12);x.lineTo(L+iw*.1,T+4);x.stroke();
      for(let i=0;i<40;i++){x.fillStyle=`rgba(40,36,32,${.6+r()*.4})`;const px=r()*W,py=B+r()*(H-B);x.fillRect(px,py,10+r()*40,4+r()*10)}
    }else{
      x.fillStyle='rgba(255,250,235,.25)';x.beginPath();x.moveTo(L,B);x.lineTo(R,B);x.lineTo(W*.9,H);x.lineTo(W*.1,H);x.fill();
    }
    const g=x.createRadialGradient(cx,cy,0,cx,cy,W*.7);g.addColorStop(0,light?'rgba(255,245,225,.25)':'rgba(242,161,58,.2)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  }else if(type==='debris'){
    x.fillStyle=lg([0,0],[0,H],[[0,'#2a2622'],[1,'#0e0d0b']]);x.fillRect(0,0,W,H);
    for(let i=0;i<340;i++){
      const px=r()*W,py=H*.25+Math.pow(r(),.6)*H*.8,s=6+r()*38*(py/H);
      const v=40+r()*70|0;x.fillStyle=r()<.08?`rgb(${150+v},${90+v/2},40)`:`rgb(${v+10},${v+6},${v})`;
      x.beginPath();x.moveTo(px,py);for(let k=0;k<4;k++)x.lineTo(px+(r()-.5)*s*2,py+(r()-.5)*s);x.fill();
    }
    const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(242,161,58,.25)');g.addColorStop(1,'rgba(242,161,58,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  }else if(type==='stripes'){
    x.fillStyle='#141210';x.fillRect(0,0,W,H);
    x.save();x.translate(W/2,H/2);x.rotate(-.25+r()*.5);
    for(let b=-1;b<=1;b+=2){const y=b*H*.18;x.save();x.beginPath();x.rect(-W,y-24,W*2,48);x.clip();
      for(let i=-W;i<W;i+=36){x.fillStyle='#e6a13d';x.beginPath();x.moveTo(i,y-24);x.lineTo(i+18,y-24);x.lineTo(i+48,y+24);x.lineTo(i+30,y+24);x.fill()}x.restore()}
    x.restore();
  }
  /* grain + vignette */
  const id=x.getImageData(0,0,W,H),d=id.data;
  for(let i=0;i<d.length;i+=4){const n=(r()-.5)*34;d[i]+=n;d[i+1]+=n;d[i+2]+=n}
  x.putImageData(id,0,0);
  const v=x.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');x.fillStyle=v;x.fillRect(0,0,W,H);
  return cache[key]=c.toDataURL('image/jpeg',.82);
}
const used={};
function src(img){if(img.dataset.photo)return photo(img.dataset.photo);const list=PHOTOS[img.dataset.scene],seed=+img.dataset.seed;if(list&&list.length)return photo(list[seed%list.length]);return scene(img.dataset.scene,seed)}

const TYPES=['dawn','excavator','concrete','rebar','interior','debris','restore','stripes'];
function tiles(el,n,off,cls){let h='';for(let rep=0;rep<2;rep++)for(let i=0;i<n;i++){const t=TYPES[(i+off)%TYPES.length];h+=`<div class="ph ${cls||''}"><img data-scene="${t}" data-seed="${500+off*20+i}" alt=""></div>`}el.innerHTML=h}
/* ---------- MV photo cycle (after the intro) ---------- */
function startCycle(){
  const box=document.getElementById('mvPhotos'),now=document.getElementById('mvNow'),all=document.getElementById('mvAll');
  const narrow=matchMedia('(max-width:700px)').matches;
  const order=narrow?[10,2,1,9,7,5,4,6]:[1,9,5,4,6,7,8,3];
  const alts={1:'重機で木造住宅を解体している現場',2:'マンション住戸の内装解体',3:'住戸の内装を撤去している様子',4:'古い木造家屋を重機で解体している現場',5:'天井を解体し配管が露出したテナント',6:'スケルトン状態に戻したオフィス',7:'重機で家屋を解体している現場',8:'地下テナントの内装解体',9:'青空の下で木造家屋を解体する重機',10:'住宅解体の現場'};
  all.textContent=String(order.length).padStart(2,'0');
  const first=box.querySelector('.mv-slide-img');first.classList.add('first');
  const slides=[first];
  order.slice(1).forEach(n=>{const d=document.createElement('div');d.className='mv-slide-img';d.innerHTML=`<img src="${photo(n)}" alt="${alts[n]}" decoding="async">`;box.appendChild(d);slides.push(d)});
  requestAnimationFrame(()=>first.classList.remove('first'));
  if(reduce)return;
  /* transition styles; the buttons on the photo switch between them for comparison */
  const W=()=>box.clientWidth,H=()=>box.clientHeight;
  function cover(slide){const im=slide.querySelector('img'),w=W(),h=H(),iw=im.naturalWidth||1600,ih=im.naturalHeight||1200,sc=Math.max(w/iw,h/ih);
    return{src:im.currentSrc||im.src,bw:iw*sc,bh:ih*sc,bx:(w-iw*sc)/2,by:(h-ih*sc)/2}}
  const bg=(c,x,y)=>`background-image:url('${c.src}');background-size:${c.bw}px ${c.bh}px;background-position:${c.bx-x}px ${c.by-y}px`;
  const OVER={
    crumble(prev){const c=cover(prev),w=W(),h=H(),cols=w<700?4:8,rows=w<700?6:5,tw=w/cols,th=h/rows,fx=document.createElement('div');fx.className='fx shake';let html='';
      for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){const x=q*tw,y=r*th,d=((rows-1-r)*.06+Math.random()*.22).toFixed(2),rot=((Math.random()-.5)*70).toFixed(1),dx=((Math.random()-.5)*120).toFixed(0);
        html+=`<div class="fx-tile" style="left:${x}px;top:${y}px;width:${tw+1}px;height:${th+1}px;${bg(c,x,y)};transition-delay:${(+d+.3).toFixed(2)}s,${(+d+1.15).toFixed(2)}s" data-t="translate(${dx}px,${(h*1.25).toFixed(0)}px) rotate(${rot}deg)"></div>`}
      fx.innerHTML=html;fx.go=()=>fx.querySelectorAll('.fx-tile').forEach(t=>{t.style.transform=t.dataset.t;t.style.opacity=0});return fx},
    shutter(prev){const c=cover(prev),h=H(),fx=document.createElement('div');fx.className='fx';
      fx.innerHTML=`<div class="fx-half t" style="${bg(c,0,0)}"></div><div class="fx-half b" style="${bg(c,0,h/2)}"></div><div class="fx-seam"></div>`;return fx},
    glitch(prev,next){const c=cover(prev),n=cover(next),h=H(),N=12,fx=document.createElement('div');fx.className='fx fx-glitch';let html='';
      for(let k=0;k<N;k++){const y=k*h/N,a=((Math.random()-.5)*60).toFixed(0)+'px',b2=((Math.random()-.5)*40).toFixed(0)+'px';
        html+=`<div class="fx-sl" data-y="${y}" style="top:${y}px;height:${h/N+1}px;${bg(c,0,y)};--a:${a};--b:${b2};animation-delay:-${(Math.random()*.5).toFixed(2)}s"></div>`}
      fx.innerHTML=html+'<div class="fx-flash"></div>';
      fx.go=()=>{setTimeout(()=>fx.querySelectorAll('.fx-sl').forEach(el=>{el.style.backgroundImage=`url('${n.src}')`;el.style.backgroundSize=`${n.bw}px ${n.bh}px`;el.style.backgroundPosition=`${n.bx}px ${n.by-el.dataset.y}px`;el.style.filter='hue-rotate(160deg) saturate(2)'}),380);
        setTimeout(()=>fx.querySelectorAll('.fx-sl').forEach(el=>{el.style.filter=''}),520);
        setTimeout(()=>fx.querySelectorAll('.fx-sl').forEach(el=>{el.style.animation='none';el.style.transform='none'}),800)};return fx},
    slash(){const fx=document.createElement('div');fx.className='fx';fx.style.filter='none';const ang=Math.atan(.3*W()/H())*180/Math.PI;
      fx.innerHTML=`<div class="fx-blade" style="transform:skewX(-${ang.toFixed(1)}deg)"></div>`;return fx}
  };
  const MODES={zoom:{inC:'m-zoom-in',outC:'m-zoom-out',nextOnTop:false,d:1500},
               circle:{inC:'m-circle',outC:'',nextOnTop:true,d:1800},
               up:{inC:'m-up',outC:'m-up-out',nextOnTop:true,d:1400},
               blur:{inC:'m-blur',outC:'m-blur-out',nextOnTop:true,d:1700},
               slash:{inC:'m-slash',outC:'',nextOnTop:true,d:1400,fx:'slash'},
               crumble:{over:true,d:2300},
               shutter:{over:true,d:1500},
               glitch:{over:true,d:950}};
  const ALL=['m-zoom-in','m-zoom-out','m-circle','m-up','m-up-out','m-blur','m-blur-out','m-slash','go'];
  let mode='glitch',i=0,busy=false,timer;
  const reset=(el,fn)=>{const im=el.querySelector('img');el.style.transition='none';im.style.transition='none';fn();void el.offsetWidth;el.style.transition='';im.style.transition=''};
  function change(){
    if(busy)return;busy=true;const M=MODES[mode];
    const prev=slides[i];i=(i+1)%slides.length;const next=slides[i];
    slides.forEach(s=>{s.style.zIndex=0;s.classList.remove('first')});
    let fx=null;
    if(M.over){
      next.style.zIndex=1;reset(next,()=>{next.classList.remove(...ALL);next.classList.add('m-zoom-in','on')});
      fx=OVER[mode](prev,next);box.appendChild(fx);
      reset(prev,()=>prev.classList.remove('on',...ALL));
      requestAnimationFrame(()=>requestAnimationFrame(()=>{next.classList.add('go');fx.classList.add('go');fx.go&&fx.go()}));
    }else{
      prev.style.zIndex=M.nextOnTop?1:2;next.style.zIndex=M.nextOnTop?2:1;
      reset(next,()=>{next.classList.remove('on',...ALL);next.classList.add(M.inC);if(mode==='zoom')next.classList.add('on')});
      if(M.fx){fx=OVER[M.fx]();box.appendChild(fx)}
      requestAnimationFrame(()=>requestAnimationFrame(()=>{next.classList.add('go','on');if(M.outC)prev.classList.add(M.outC,'go');fx&&fx.classList.add('go')}));
    }
    now.classList.add('flip');setTimeout(()=>{now.textContent=String(i+1).padStart(2,'0');now.classList.remove('flip')},450);
    setTimeout(()=>{
      if(fx)fx.remove();
      reset(prev,()=>prev.classList.remove('on',...ALL));
      if(M.over||mode==='zoom'){const im=next.querySelector('img');im.style.transition='none';next.classList.remove(...ALL);void im.offsetWidth;im.style.transition=''}
      else reset(next,()=>next.classList.remove(...ALL));
      next.classList.add('on');busy=false},M.d+100);
  }
  const loop=()=>{clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&box.offsetParent!==null&&box.getBoundingClientRect().bottom>0)change()},3500)};
  document.querySelectorAll('.mv-pick button').forEach(b=>b.addEventListener('click',()=>{
    mode=b.dataset.m;document.querySelectorAll('.mv-pick button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    if(!busy){change();loop()}
  }));
  loop();
}
/* ---------- MV: scramble-typed copy on black, burned away by a noise front, photo underneath ---------- */
(function(){
  const mv=document.querySelector('.mv'),cv=document.getElementById('cover');
  if(!mv)return;
  if(reduce){mv.classList.add('show');cv.remove();startCycle();return}
  const x=cv.getContext('2d'),m=document.createElement('canvas'),mx=m.getContext('2d');
  const BG='#17263D',S=5;
  const JP='壊すことから、次の朝をつくる職人たちがいる。',EN='CRAFTSMEN WHO CLEAR THE GROUND FOR THE NEXT MORNING OF THE CITY.';
  const POOL_JP=[...'解体更地朝職人壊次街重機養生分別基礎梁柱瓦壁床天井'],POOL_EN=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ#/\\_-=+*'];
  let W,H,dpr,mw,mh,noise,lines=[],logo,img,start=0,done=false;
  const LOGO=new Image();LOGO.src='/img/logo-ink.png';
  function vnoise(w,h,cell,rnd){
    const gw=Math.ceil(w/cell)+2,gh=Math.ceil(h/cell)+2,g=new Float32Array(gw*gh);for(let i=0;i<g.length;i++)g[i]=rnd();
    const out=new Float32Array(w*h),sm=t=>t*t*(3-2*t);
    for(let y=0;y<h;y++){const gy=y/cell,y0=gy|0,ty=sm(gy-y0);for(let xx=0;xx<w;xx++){const gx=xx/cell,x0=gx|0,tx=sm(gx-x0),
      a=g[y0*gw+x0],b=g[y0*gw+x0+1],c=g[(y0+1)*gw+x0],d=g[(y0+1)*gw+x0+1];
      out[y*w+xx]=a+(b-a)*tx+(c-a)*ty+(a-b-c+d)*tx*ty}}
    return out;
  }
  function layout(){
    if(!cv.clientWidth||!cv.clientHeight)return;
    dpr=Math.min(devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;
    mw=Math.ceil(W/S);mh=Math.ceil(H/S);m.width=mw;m.height=mh;img=mx.createImageData(mw,mh);
    const narrow=W<760,js=Math.max(17,Math.min(30,W*.022)),es=Math.max(10,Math.min(14,js*.46));
    const jpL=narrow?['壊すことから、','次の朝をつくる職人たちがいる。']:[JP];
    const enL=narrow?['CRAFTSMEN WHO CLEAR THE GROUND','FOR THE NEXT MORNING OF THE CITY.']:[EN];
    const jf=`700 ${js}px "Shippori Mincho B1","Hiragino Mincho ProN",serif`,ef=`500 ${es}px "Big Shoulders Display","Arial Narrow",sans-serif`;
    const rows=[...jpL.map(t=>({t,f:jf,sz:js,lh:js*1.75,col:'#EDE7DB',pool:POOL_JP,ls:js*.12,d:0})),{gap:js*.9},...enL.map(t=>({t,f:ef,sz:es,lh:es*1.9,col:'#A9B3C2',pool:POOL_EN,ls:es*.28,d:.15}))];
    const total=rows.reduce((a,r)=>a+(r.gap||r.lh),0);let y=H*.47-total/2;lines=[];
    x.setTransform(1,0,0,1,0,0);
    rows.forEach(r=>{if(r.gap){y+=r.gap;return}x.font=r.f;const ch=[...r.t],ws=ch.map(c=>x.measureText(c).width+r.ls),tw=ws.reduce((a,b)=>a+b,0)-r.ls;
      let cx=(W-tw)/2;const xs=ws.map(w=>{const v=cx;cx+=w;return v});lines.push({...r,ch,xs,y:y+r.lh*.7});y+=r.lh});
    logo={y:H-Math.max(70,H*.12),s:Math.max(30,Math.min(46,W*.03))};
    /* burn field: blotchy noise, biased to start from the copy and spread outward */
    const rnd=rng(7),n1=vnoise(mw,mh,Math.max(6,mw/14),rnd),n2=vnoise(mw,mh,Math.max(2,mw/60),rnd),n3=vnoise(mw,mh,1.5,rnd);
    const cx=mw/2,cy=(H*.47)/S,md=Math.hypot(mw/2,mh);noise=new Float32Array(mw*mh);
    for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++){const i=yy*mw+xx,dd=Math.hypot((xx-cx)*.8,(yy-cy)*1.6)/md;
      noise[i]=.42*n1[i]+.2*n2[i]+.08*n3[i]+.5*dd}
    let lo=1e9,hi=-1e9;for(const v of noise){if(v<lo)lo=v;if(v>hi)hi=v}for(let i=0;i<noise.length;i++)noise[i]=(noise[i]-lo)/(hi-lo);
  }
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ss=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
  function drawCover(t){
    x.setTransform(dpr,0,0,dpr,0,0);x.globalCompositeOperation='source-over';x.globalAlpha=1;
    x.fillStyle=BG;x.fillRect(0,0,W,H);
    lines.forEach(L=>{
      const p=clamp((t-.5-L.d)/2.8),n=L.ch.length,shown=Math.floor(p*n),tail=p<1?6:0;x.font=L.f;x.textBaseline='alphabetic';
      for(let i=0;i<Math.min(n,shown+tail);i++){
        if(i<shown){x.globalAlpha=1;x.fillStyle=L.col;x.fillText(L.ch[i],L.xs[i],L.y)}
        else{const k=(i-shown)/tail;x.globalAlpha=(1-k)*(.35+Math.random()*.6);x.fillStyle=Math.random()<.25?'#F2A13A':L.col;
          x.fillText(L.pool[(Math.random()*L.pool.length)|0],L.xs[i]+(Math.random()-.5)*2,L.y+(Math.random()-.5)*3)}
      }
    });
    /* logo */
    const la=clamp((t-.2)/1.2);x.globalAlpha=la;const s=logo.s,lx=W/2,ly=logo.y;
    if(LOGO.complete&&LOGO.naturalWidth){const lw=s*3.4,lh=lw*LOGO.naturalHeight/LOGO.naturalWidth;x.drawImage(LOGO,lx-lw/2,ly-lh*.55,lw,lh);
      x.font=`500 ${s*.24}px "Shippori Mincho B1",serif`;x.fillStyle='#9C958A';x.textAlign='center';x.fillText('解 体 工 事',lx,ly+lh*.45+s*.35);x.textAlign='left'}
    x.globalAlpha=1;
  }
  function burn(thr){
    const d=img.data,band=.07;
    /* mask: keep cover where noise > thr */
    for(let i=0,j=0;i<noise.length;i++,j+=4){const v=noise[i];d[j]=d[j+1]=d[j+2]=255;d[j+3]=255*ss(thr,thr+.035,v)}
    mx.putImageData(img,0,0);x.setTransform(1,0,0,1,0,0);x.imageSmoothingEnabled=true;
    x.globalCompositeOperation='destination-in';x.drawImage(m,0,0,cv.width,cv.height);
    /* glowing, speckled burn edge */
    for(let i=0,j=0;i<noise.length;i++,j+=4){const v=noise[i],e=1-Math.abs(v-(thr+.01))/band;
      if(e>0){const hot=e*e,sp=Math.random();d[j]=255;d[j+1]=190+65*hot;d[j+2]=110+145*hot*hot;d[j+3]=255*clamp(hot*(sp<.55?1:.35)*1.1)}else d[j+3]=0}
    mx.putImageData(img,0,0);x.globalCompositeOperation='lighter';x.drawImage(m,0,0,cv.width,cv.height);
    x.globalCompositeOperation='source-over';
  }
  const T_BURN=4.6,D_BURN=5.2;
  function frame(now){
    if(!noise){layout();if(!noise){requestAnimationFrame(frame);return}}
    if(!start)start=now;const t=(now-start)/1000;
    drawCover(t);
    if(t>=T_BURN){if(!mv.classList.contains('show'))mv.classList.add('show');
      const k=clamp((t-T_BURN)/D_BURN),thr=-.1+1.25*(k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2);burn(thr);
      if(k>=1){done=true;cv.remove();startCycle();return}}
    requestAnimationFrame(frame);
  }
  layout();addEventListener('resize',()=>{if(!done)layout()});
  const go=()=>requestAnimationFrame(frame);
  (document.fonts&&document.fonts.ready?Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]):Promise.resolve()).then(()=>{layout();go()});
})();
if(document.getElementById('rowTop'))tiles(document.getElementById('rowTop'),10,0);

/* fill images: visible ones first, the rest when idle */
const imgs=[...document.querySelectorAll('img[data-scene]')];
const fill=img=>{if(!img.getAttribute('src')){img.decoding='async';img.src=src(img)}};
imgs.forEach(i=>{if(i.getBoundingClientRect().top>innerHeight*1.5)i.loading='lazy'});imgs.filter(i=>i.loading!=='lazy').forEach(fill);
const rest=imgs.filter(i=>!i.getAttribute('src'));let k=0;
(function step(){const t=performance.now();while(k<rest.length&&performance.now()-t<12)fill(rest[k++]);if(k<rest.length)(window.requestIdleCallback||setTimeout)(step)})();

/* ---------- menu ---------- */
const nav=document.getElementById('nav'),openB=document.getElementById('open');
const setNav=o=>{nav.hidden=!o;openB.setAttribute('aria-expanded',o);document.body.style.overflow=o?'hidden':'';if(o)document.getElementById('close').focus()};
openB.onclick=()=>setNav(true);document.getElementById('close').onclick=()=>setNav(false);
nav.querySelectorAll('a').forEach(a=>a.onclick=()=>setNav(false));
addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden)setNav(false)});

/* ---------- reveal (below the fold only) ---------- */
if('IntersectionObserver' in window&&!reduce){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('pre');io.unobserve(e.target)}}),{rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('.rv').forEach(el=>{if(el.getBoundingClientRect().top>innerHeight){el.classList.add('pre');io.observe(el)}});
}

/* ---------- entry preselect ---------- */
document.querySelectorAll('[data-type]').forEach(a=>a.addEventListener('click',()=>{const r=document.querySelector(`input[name=type][value="${a.dataset.type}"]`);if(r)r.checked=true}));

/* ---------- form → LINE通知 ----------
   FORM_ENDPOINT に Google Apps Script の「ウェブアプリのURL」を入れると、
   送信内容が株式会社sunriseのLINEに届きます。 */
const FORM_ENDPOINT='https://script.google.com/macros/s/AKfycbzMB2zlNcDNW7qnFhyjCGcZqgeZinH4SYKlIUQ7o_SiVkCMGnpMnLEWDBB3xe3-lurF/exec';
(function(){
  const f=document.getElementById('form'),btn=document.getElementById('sendBtn'),err=document.getElementById('err'),done=document.getElementById('done');
  const v=k=>(document.getElementById(k).value||'').trim();
  if(!f)return;   // フォームのないページ（404 など）
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const miss=[...f.querySelectorAll('[required]')].filter(i=>!i.value.trim()||(i.type==='email'&&!/^\S+@\S+\.\S+$/.test(i.value)));
    if(miss.length){err.textContent='お名前・正しい形式のメールアドレス・ご相談内容を入力してください。';err.hidden=false;miss[0].focus();return}
    err.hidden=true;done.hidden=true;
    if(!FORM_ENDPOINT){done.innerHTML='<span class="todo">送信先がまだ設定されていません。公開前に設定します。</span>';done.hidden=false;return}
    const data={type:f.querySelector('input[name=type]:checked').value,name:v('name'),org:v('org'),mail:v('mail'),phone:v('phone'),addr:v('addr'),msg:v('msg'),website:v('website'),t:Math.round(performance.now())};  // t = ページを開いてから送信までのミリ秒（3000未満はロボットとして Apps Script 側で破棄）
    btn.disabled=true;btn.firstChild.textContent='送信中… ';
    try{
      await fetch(FORM_ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)});
      f.querySelectorAll('input:not([type=radio]),textarea').forEach(i=>i.value='');
      done.innerHTML='送信しました。<br>内容を確認のうえ、担当者よりご連絡します。';done.hidden=false;
    }catch(_){
      done.innerHTML='送信できませんでした。<br>お手数ですが、お電話（090-7686-6461）でご連絡ください。<br><span class="todo">※ このプレビュー画面からは送信できません。本番公開後に届くようになります。</span>';done.hidden=false;
    }finally{btn.disabled=false;btn.firstChild.textContent='SEND ';}
  });
})();
