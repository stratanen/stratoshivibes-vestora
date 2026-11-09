(function(){
'use strict';
/* ---------- data: weekly prices in EUR, built daily by GitHub Actions (data/history.json) ---------- */
const DAY=864e5;
const MONTHS=['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
const CLS={crypto:'Crypto',etf:'ETF',stock:'Μετοχές',cash:'Καταθέσεις',other:'Άλλα'};
const CUSTOM_CLS={other:'Ακίνητα ή άλλο',stock:'Μετοχή (π.χ. ΧΑ)',etf:'ETF',crypto:'Crypto',cash:'Καταθέσεις'};
let W=0, START=0, FXL=1.1, DATA=null;
let ASSETS={}, PRICES={};
const NAME_EN={GLD:'Gold (GLD)',ETE:'National Bank of Greece',TPEIR:'Piraeus Bank',PPC:'PPC (Public Power Corporation)',HTO:'OTE (Hellenic Telecom)',ALWN:'Allwyn (formerly OPAP)'};
/* Live prices come from Jupiter (Solana) by token address. Wrapped BTC/ETH on Solana follow BTC/ETH closely. */
const MINT={SOL:'So11111111111111111111111111111111111111112',SKR:'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
  BTC:'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',ETH:'7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs'};
const JUP='https://lite-api.jup.ag/price/v3?ids=';
let liveAt=0;

function applyData(d){
  DATA=d; W=d.weeks; START=Date.parse(d.start+'T00:00:00Z'); FXL=d.eurusdLast||d.eurusd[d.eurusd.length-1]||1.1;
  ASSETS={}; PRICES={};
  for(const [id,a] of Object.entries(d.assets)){
    const w=a.w.slice();let first=w.find(v=>v!=null);if(first==null)continue;
    for(let i=0;i<w.length;i++){if(w[i]==null)w[i]=first;else first=w[i]}
    ASSETS[id]={name:LANG==='en'&&NAME_EN[id]||a.name,sym:id,cls:a.cls,usd:a.usd??1};PRICES[id]=w;
  }
  ASSETS.DEP={name:'Κατάθεση με τόκο 2%',sym:'',cls:'cash',usd:0,fixed:.02};
  PRICES.DEP=Array.from({length:W},(_,t)=>Math.pow(1.02,t/52));
}
async function livePrices(){
  if(!DATA)return;
  const ids={...MINT,...(state.mints||{})};
  for(const [k,c] of Object.entries(state.custom))if(c.mint)ids[k]=c.mint;
  const mints=[...new Set(Object.values(ids))];
  try{
    const out={};
    for(let i=0;i<mints.length;i+=50){const r=await fetch(JUP+mints.slice(i,i+50).join(','));if(!r.ok)throw new Error('jup '+r.status);Object.assign(out,await r.json())}
    let changed=false;
    for(const [k,m] of Object.entries(ids)){
      const p=out[m]?.usdPrice;if(!(p>0))continue;const e=p/FXL;
      if(k==='SKR'){skrEur=e;continue}
      if(PRICES[k]){PRICES[k][W-1]=e;ASSETS[k].live=true;changed=true}
      else if(state.custom[k]){state.custom[k].current=e;changed=true}
    }
    liveAt=Date.now();if(changed){save();render()}else renderPriceNote();
  }catch(e){console.warn('live prices',e);renderPriceNote()}
}

/* ---------- helpers ---------- */
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const eur=new Intl.NumberFormat(LOC,{style:'currency',currency:'EUR',maximumFractionDigits:0});
const eur2=new Intl.NumberFormat(LOC,{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const nf=(d)=>new Intl.NumberFormat(LOC,{maximumFractionDigits:d});
const price=v=>v>=1000?eur.format(v):v>=1?eur2.format(v):'€'+nf(6).format(v);
const pct=(v,d=1)=>v==null||!isFinite(v)?'—':(v>0?'+':'')+nf(d).format(v*100)+'%';
const sgn=v=>v>0?'pos':v<0?'neg':'';
const wDate=i=>new Date(START+i*7*DAY);
const iso=d=>d.toISOString().slice(0,10);
const todayIso=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const toWeek=s=>{const w=Math.floor((Date.parse(s)-START)/(7*DAY));return Math.max(0,Math.min(W-1,w))};
const shortDate=d=>MONTHS[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2);
const longDate=s=>{const d=new Date(s+'T00:00:00Z');return d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear()};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const $=id=>document.getElementById(id);
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const readJSON=k=>{try{return JSON.parse(LS.get(k))}catch(e){return null}};

/* ---------- state (stays on this device) ---------- */
const KEY='vestora-portfolio-v1';
let state=readJSON(KEY);
if(!state||!Array.isArray(state.tx))state={sample:false,onboarded:false,custom:{},mints:{},tx:[]};
state.custom=state.custom||{};state.mints=state.mints||{};
function save(){LS.set(KEY,JSON.stringify(state))}
let ui={mode:'value',bench:'SPY'};
let skrEur=null;

function sample(){
  /* An example portfolio with real prices and invented trades, clearly marked as an example in the app. */
  const rows=[[104,'SPY','buy',1500,2,'long'],[104,'BTC','buy',1000,3,'long'],[96,'NVDA','buy',800,2,'opp'],[88,'SOL','buy',500,1.5,'opp'],
    [78,'ETH','buy',600,2,'fomo'],[70,'SPY','buy',700,1,'long'],[60,'SOL','sell',.5,1,'fear'],[52,'BTC','buy',600,2.5,'opp'],
    [40,'QQQ','buy',800,1,'rebal'],[28,'DEP','buy',2000,0,''],[14,'TSLA','buy',500,1,'fomo']];
  const tx=[];const held={};
  for(const [back,a,type,amt,fee,reason] of rows){
    if(!PRICES[a])continue;const w=Math.max(0,W-1-back),p=PRICES[a][w];
    let qty=type==='sell'?(held[a]||0)*amt:amt/p;held[a]=(held[a]||0)+(type==='sell'?-qty:qty);
    tx.push({id:uid(),date:iso(wDate(w)),a,type,qty:+qty.toPrecision(6),fee,reason,price:+p.toPrecision(6)});
  }
  return {sample:true,onboarded:true,custom:{},mints:{},tx};
}

function meta(a){return ASSETS[a]||{name:state.custom[a]?.name||'Άλλο',sym:state.custom[a]?.sym||'',cls:state.custom[a]?.cls||'other',usd:state.custom[a]?.mint?1:0,custom:true}}
function series(a){
  if(PRICES[a])return PRICES[a];
  const c=state.custom[a];const txs=state.tx.filter(t=>t.a===a&&t.type!=='div').sort((x,y)=>x.date.localeCompare(y.date));
  if(!c||!txs.length)return new Array(W).fill(0);
  const w0=toWeek(txs[0].date),p0=txs[0].price||c.current||0,p1=c.current??p0;
  return Array.from({length:W},(_,t)=>t<=w0?p0:p0+(p1-p0)*(t-w0)/Math.max(1,W-1-w0));
}
const nowPrice=a=>{const s=series(a);return s[W-1]||0};

/* ---------- engine ----------
   F = net money in (+) or out (−) of the portfolio each week (used for TWR and XIRR); cash income counts as money out.
   C = the user's own contributions only (used for "money you put in" and the "same amounts, same dates" alternatives). */
function compute(){
  if(!W)return null;
  const txs=state.tx.map(t=>({...t,w:toWeek(t.date)})).sort((x,y)=>x.w-y.w||x.date.localeCompare(y.date));
  if(!txs.length)return null;
  const ids=[...new Set(txs.map(t=>t.a))];
  const S={};ids.forEach(i=>S[i]=series(i));
  const qty={},cost={};ids.forEach(i=>{qty[i]=0;cost[i]=0});
  const V=Array(W).fill(0),F=Array(W).fill(0),C=Array(W).fill(0),INV=Array(W).fill(0);
  let k=0,inv=0,fees=0,bought=0,income=0,rewardsEur=0;
  for(let w=0;w<W;w++){
    while(k<txs.length&&txs[k].w===w){
      const t=txs[k++];fees+=t.fee||0;
      if(t.type==='buy'){const c=t.qty*t.price+(t.fee||0);qty[t.a]+=t.qty;cost[t.a]+=c;F[w]+=c;C[w]+=c;bought+=t.qty*t.price}
      else if(t.type==='sell'){const q=Math.min(t.qty,qty[t.a]);if(qty[t.a]>0)cost[t.a]-=cost[t.a]*q/qty[t.a];qty[t.a]-=q;const c=q*t.price-(t.fee||0);F[w]-=c;C[w]-=c}
      else if(t.type==='reward'){qty[t.a]+=t.qty;rewardsEur+=t.qty*(S[t.a][w]||0)}
      else if(t.type==='div'){F[w]-=t.qty;income+=t.qty}
    }
    inv+=C[w];INV[w]=inv;
    let v=0;for(const i of ids)v+=qty[i]*S[i][w];V[w]=v;
  }
  const w0=txs[0].w;
  const r=Array(W).fill(null),idx=Array(W).fill(null);idx[w0]=1;
  for(let w=w0+1;w<W;w++){const rr=V[w-1]>0?(V[w]-F[w])/V[w-1]-1:0;r[w]=rr;idx[w]=idx[w-1]*(1+rr)}
  const years=(W-1-w0)/52;
  const twr=idx[W-1]-1, twrA=years>=1?Math.pow(idx[W-1],1/years)-1:null;
  const cfs=[];for(let w=0;w<W;w++)if(F[w])cfs.push([(w-w0)/52,-F[w]]);cfs.push([(W-1-w0)/52,V[W-1]]);
  const npv=x=>cfs.reduce((s,[t,c])=>s+c/Math.pow(1+x,t),0);
  let lo=-.99,hi=10,mwr=null;
  if(years>=1&&npv(lo)*npv(hi)<0){for(let i=0;i<120;i++){const m=(lo+hi)/2;(npv(lo)*npv(m)<=0)?hi=m:lo=m}mwr=(lo+hi)/2}
  let peak=0,mdd=0,mddW=w0;for(let w=w0;w<W;w++){peak=Math.max(peak,idx[w]);const d=idx[w]/peak-1;if(d<mdd){mdd=d;mddW=w}}
  const rs=r.filter(x=>x!=null);const mean=rs.reduce((a,b)=>a+b,0)/(rs.length||1);
  const vol=rs.length>8?Math.sqrt(rs.reduce((s,x)=>s+(x-mean)**2,0)/(rs.length-1))*Math.sqrt(52):null;
  const bench={};
  for(const b of ['SPY','QQQ','BTC','DEP']){
    const p=PRICES[b];if(!p)continue;let u=0;const B=Array(W).fill(0);
    for(let w=0;w<W;w++){u+=C[w]/p[w];if(u<0)u=0;B[w]=u*p[w]}
    bench[b]={B,idx:p.map((x,w)=>w<w0?null:x/p[w0])};
  }
  if(PRICES.SPY&&PRICES.BTC){const s=PRICES.SPY,b=PRICES.BTC;let us=0,ub=0;const B=Array(W).fill(0);
   for(let w=0;w<W;w++){us+=.8*C[w]/s[w];ub+=.2*C[w]/b[w];if(us<0)us=0;if(ub<0)ub=0;B[w]=us*s[w]+ub*b[w]}
   bench.MIX={B,idx:s.map((x,w)=>w<w0?null:.8*x/s[w0]+.2*b[w]/b[w0])};}
  if(PRICES.SPY){const s=PRICES.SPY;const months=[];for(let w=w0;w<W;w+=4)months.push(w);
   const amt=Math.max(0,INV[W-1])/months.length;let u=0;const B=Array(W).fill(0);
   for(let w=0;w<W;w++){if(months.includes(w))u+=amt/s[w];B[w]=u*s[w]}
   bench.DCA={B,idx:bench.SPY.idx,amt};}
  const end=V[W-1];
  const hold=ids.filter(i=>qty[i]>1e-12).map(i=>{const val=qty[i]*S[i][W-1];return{a:i,qty:qty[i],avg:cost[i]/qty[i],now:S[i][W-1],val,pl:val-cost[i],plp:cost[i]>0?val/cost[i]-1:0,wt:end>0?val/end:0}}).sort((x,y)=>y.val-x.val);
  return {txs,ids,V,F,C,INV,r,idx,w0,years,twr,twrA,mwr,mdd,mddW,vol,bench,hold,end,inv:INV[W-1],fees,bought,income,rewardsEur,short:W-1-w0<8};
}

/* ---------- render: summary ---------- */
function renderSummary(D){
  if(!D){$('totVal').textContent=eur.format(0);$('totSub').innerHTML='<span>Πρόσθεσε τι έχεις για να ξεκινήσει η παρακολούθηση.</span>';$('kpis').innerHTML='';return}
  const gain=D.end-D.inv+D.income;
  $('totVal').textContent=eur.format(D.end);
  $('totSub').innerHTML=`<span>Καθαρό κεφάλαιο που έβαλες <b class="num">${eur.format(D.inv)}</b></span><span>Κέρδος/ζημιά <b class="num ${sgn(gain)}">${(gain>0?'+':'')+eur.format(gain)}</b></span>${D.income?`<span>Από αυτό, εισόδημα που εισέπραξες <b class="num pos">${eur.format(D.income)}</b></span>`:''}`;
  const b=D.bench[ui.bench];const diff=b?D.end-b.B[W-1]:0;
  const k=[
    [D.short?'—':D.twrA!=null?pct(D.twrA):pct(D.twr),D.twrA!=null?'Απόδοση επιλογών / έτος (TWR)':'Απόδοση επιλογών (TWR)',sgn(D.twr)],
    [pct(D.mwr),'Απόδοση των χρημάτων σου / έτος (MWR)',sgn(D.mwr),true],
    [D.short?'—':(diff>0?'+':'')+eur.format(diff),'Έναντι '+benchName(ui.bench),sgn(diff)],
    [D.short?'—':pct(D.mdd),'Μέγιστη πτώση από κορυφή','neg',true]
  ];
  const pro=isPro();
  $('kpis').innerHTML=k.map(([v,l,c,p])=>p&&!pro
    ?`<div class="kpi locked" role="button" tabindex="0" data-pro="1"><span class="v">${LOCK} Pro</span><span class="l">${l}</span></div>`
    :`<div class="kpi"><span class="v num ${c}">${v}</span><span class="l">${l}</span></div>`).join('');
}
const BN={SPY:['S&P 500','Ίδια ποσά σε S&P 500','S&P 500'],QQQ:['Nasdaq 100','Ίδια ποσά σε Nasdaq 100','Nasdaq 100'],
  BTC:['Bitcoin','Ίδια ποσά σε Bitcoin','Bitcoin'],DEP:['κατάθεσης 2%','Ίδια ποσά σε κατάθεση 2%','Κατάθεση 2%'],
  MIX:['80/20 S&P–BTC','Ίδια ποσά σε 80% S&P 500 / 20% BTC','80% S&P / 20% BTC'],
  DCA:['μηνιαίας αγοράς','Ίδιο σύνολο, ισόποσα κάθε μήνα σε S&P 500','S&P 500 με μηνιαία αγορά']};
const benchName=b=>BN[b][0];

/* ---------- render: chart ---------- */
let CH=null;
function nice(min,max,n){const span=max-min||Math.abs(max)||1;const raw=span/n;const mag=Math.pow(10,Math.floor(Math.log10(raw)));const st=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw);const lo=Math.floor(min/st)*st,hi=Math.ceil(max/st)*st;const t=[];for(let v=lo;v<=hi+st/2;v+=st)t.push(+v.toFixed(10));return{lo,hi,t}}
function renderChart(D){
  const svg=$('chart'),box=$('chartbox');$('tip').hidden=true;box.querySelector('.empty')?.remove();
  const msg=t=>{svg.setAttribute('height',0);svg.innerHTML='';$('legend').innerHTML='';box.insertAdjacentHTML('afterbegin',`<div class="empty">${t}</div>`);CH=null};
  if(!D)return msg('Δεν υπάρχουν ακόμα επενδύσεις. Πρόσθεσε τι έχεις για να δεις τη σύγκριση.');
  if(D.short)return msg('Η σύγκριση χρειάζεται τουλάχιστον δύο μήνες ιστορικού. Αν έχεις τις επενδύσεις από παλιότερα, βάλε στις συναλλαγές πότε και σε ποια τιμή τις αγόρασες.');
  const cw=Math.max(300,box.clientWidth),ch=cw<560?240:320;
  svg.setAttribute('viewBox',`0 0 ${cw} ${ch}`);svg.setAttribute('height',ch);
  const P={l:cw<560?50:62,r:12,t:12,b:26};
  const w0=D.w0,b=D.bench[ui.bench];
  let lines;
  if(ui.mode==='value')lines=[{k:'p',v:D.V,c:css('--accent'),n:'Χαρτοφυλάκιο'},{k:'b',v:b.B,c:css('--bench'),n:BN[ui.bench][1]},{k:'i',v:D.INV,c:css('--invest'),n:'Κεφάλαιο που έβαλες',dash:'4 4'}];
  else lines=[{k:'p',v:D.idx.map(x=>x==null?null:(x-1)*100),c:css('--accent'),n:'Απόδοση επιλογών (TWR)'},{k:'b',v:b.idx.map(x=>x==null?null:(x-1)*100),c:css('--bench'),n:BN[ui.bench][2]}];
  let mn=Infinity,mx=-Infinity;lines.forEach(L=>{for(let w=w0;w<W;w++){const v=L.v[w];if(v!=null){mn=Math.min(mn,v);mx=Math.max(mx,v)}}});
  if(ui.mode==='value')mn=Math.min(0,mn);
  const Y=nice(mn,mx,5);
  const x=w=>P.l+(w-w0)/Math.max(1,W-1-w0)*(cw-P.l-P.r);
  const y=v=>P.t+(1-(v-Y.lo)/(Y.hi-Y.lo))*(ch-P.t-P.b);
  const fmtY=v=>ui.mode==='value'?(Math.abs(v)>=1000?nf(0).format(v/1000)+'k':nf(0).format(v)):nf(0).format(v)+'%';
  let g='';
  Y.t.forEach(v=>{g+=`<line x1="${P.l}" x2="${cw-P.r}" y1="${y(v)}" y2="${y(v)}" stroke="${css(v===0&&ui.mode==='pct'?'--muted':'--line')}" stroke-width="1"/><text x="${P.l-8}" y="${y(v)+4}" text-anchor="end">${fmtY(v)}</text>`});
  const nT=cw<560?3:6;for(let i=0;i<=nT;i++){const w=Math.round(w0+i*(W-1-w0)/nT);const anchor=i===0?'start':i===nT?'end':'middle';g+=`<text x="${x(w)}" y="${ch-6}" text-anchor="${anchor}">${shortDate(wDate(w))}</text>`}
  const path=v=>{let d='';for(let w=w0;w<W;w++){if(v[w]==null)continue;d+=(d?'L':'M')+x(w).toFixed(1)+','+y(v[w]).toFixed(1)}return d};
  const pl=lines[0];const base=y(Math.max(Y.lo,Math.min(Y.hi,0)));
  g+=`<defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${pl.c}" stop-opacity=".22"/><stop offset="1" stop-color="${pl.c}" stop-opacity="0"/></linearGradient></defs>`;
  g+=`<path d="${path(pl.v)}L${x(W-1)},${base}L${x(w0)},${base}Z" fill="url(#ga)" stroke="none"/>`;
  [...lines].reverse().forEach(L=>{g+=`<path d="${path(L.v)}" fill="none" stroke="${L.c}" stroke-width="${L.k==='p'?2.4:1.7}" ${L.dash?`stroke-dasharray="${L.dash}"`:''} stroke-linejoin="round"/>`});
  lines.forEach(L=>{if(L.k!=='i')g+=`<circle cx="${x(W-1)}" cy="${y(L.v[W-1])}" r="${L.k==='p'?4.5:3.5}" fill="${L.c}" stroke="${css('--surface')}" stroke-width="2"/>`});
  const dv=diverge(D,ui.bench);
  if(dv&&dv.w>w0+1&&dv.w<W-3){const xd=x(dv.w);const right=xd+(LANG==='en'?170:150)>cw-P.r;
    g+=`<line x1="${xd}" x2="${xd}" y1="${P.t}" y2="${ch-P.b}" stroke="${css('--ink')}" stroke-width="1" stroke-opacity=".45"/><text x="${right?xd-6:xd+6}" y="${P.t+12}" text-anchor="${right?'end':'start'}" style="fill:var(--ink)">εδώ ανοίγει η διαφορά</text>`}
  g+=`<line id="hx" y1="${P.t}" y2="${ch-P.b}" stroke="${css('--muted')}" stroke-width="1" stroke-dasharray="2 3" visibility="hidden"/>`;
  g+=`<rect id="hit" x="${P.l}" y="${P.t}" width="${cw-P.l-P.r}" height="${ch-P.t-P.b}" fill="transparent"/>`;
  svg.innerHTML=g;
  $('legend').innerHTML=lines.map(L=>`<span><i style="background:${L.c}${L.dash?';opacity:.8':''}"></i>${L.n}</span>`).join('');
  CH={x,lines,w0,cw,P};
}
function diverge(D,bk){
  const B=D.bench[bk].B,gap=w=>D.V[w]-B[w];const s=Math.sign(gap(W-1));if(!s)return null;
  let w=W-1;while(w>D.w0&&Math.sign(gap(w-1))===s)w--;
  return {w,s,diff:gap(W-1)};
}
function renderStory(D){
  const st=$('story'),al=$('alts');
  if(!D||D.short){st.textContent='';al.innerHTML='';return}
  const dv=diverge(D,ui.bench),bn=BN[ui.bench][2];
  let t='';
  if(dv){const pos=dv.s>0;
    t=dv.w<=D.w0+1?`Από την αρχή το χαρτοφυλάκιό σου είναι ${pos?'πάνω':'κάτω'} από την εναλλακτική «${bn}».`
      :`Μέχρι τις ${longDate(iso(wDate(dv.w)))} οι δύο πορείες εναλλάσσονταν. Από εκεί και πέρα το χαρτοφυλάκιό σου μένει σταθερά ${pos?'πάνω':'κάτω'} από την εναλλακτική «${bn}».`;
    t+=` Σήμερα η διαφορά είναι ${(dv.diff>0?'+':'')+eur.format(dv.diff)}.`;
    if(ui.bench==='DCA')t+=` Στη μηνιαία αγορά, το ίδιο συνολικό κεφάλαιο (${eur.format(D.inv)}) μπαίνει ισόποσα κάθε μήνα, ${eur.format(D.bench.DCA.amt)} τη φορά.`;}
  if(D.income)t+=` Το εισόδημα που εισέπραξες (${eur.format(D.income)}) δεν περιλαμβάνεται στην αξία σήμερα.`;
  st.textContent=t;
  const pro=isPro();
  al.innerHTML=`<thead><tr><th>Εναλλακτική</th><th>Σήμερα θα είχες</th><th>Διαφορά από σένα</th></tr></thead><tbody>`+
    `<tr><td>Το χαρτοφυλάκιό σου</td><td class="num">${eur.format(D.end)}</td><td class="num">—</td></tr>`+
    Object.keys(BN).filter(k=>D.bench[k]).map(k=>{const locked=k!=='SPY'&&!pro;const v=D.bench[k].B[W-1],d=D.end-v;
      return locked?`<tr data-b="${k}"><td>${BN[k][2]}</td><td class="num muted">${LOCK} Pro</td><td class="num muted">—</td></tr>`
        :`<tr data-b="${k}" class="${k===ui.bench?'sel':''}"><td>${BN[k][2]}</td><td class="num">${eur.format(v)}</td><td class="num ${sgn(d)}">${(d>0?'+':'')+eur.format(d)}</td></tr>`}).join('')+'</tbody>';
}
$('alts').addEventListener('click',e=>{const r=e.target.closest('tr[data-b]');if(!r)return;const k=r.dataset.b;
  if(k!=='SPY'&&!isPro())return openSheet('info');
  ui.bench=k;[...$('segBench').children].forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===k));render()});

/* ---------- stress test ---------- */
const SCN=[{id:'btc',n:'Bitcoin −50%'},{id:'ndq',n:'Nasdaq −30%'},{id:'world',n:'Μετοχές παγκόσμια −25%'},{id:'fx',n:'Ευρώ +10% έναντι $'},{id:'all',n:'Όλα μαζί'},{id:'custom',n:'Δικό σου σενάριο',pro:true}];
const TECH=new Set(['NVDA','TSLA','COIN','MSTR']), MEGA=new Set(['AAPL','MSFT','AMZN','GOOGL','META']), NDQ=new Set(['QQQ','EQQQ']), GOLD=new Set(['GLD','XGLD']);
/* Market move (before currency) for each scenario, by asset. */
function baseShock(a,id){
  const m=meta(a),c=m.cls;
  if(id==='fx'||c==='cash'||m.custom&&c==='other')return 0;
  const crypto=c==='crypto'?(a==='BTC'?{btc:-.5,ndq:-.3,world:-.3}:{btc:-.6,ndq:-.4,world:-.4}):null;
  if(crypto)return crypto[id]??Math.min(crypto.btc,crypto.ndq,crypto.world);
  if(GOLD.has(a))return 0;
  const S=NDQ.has(a)?{ndq:-.3,world:-.28}:TECH.has(a)?{ndq:-.45,world:-.38}:MEGA.has(a)?{ndq:-.32,world:-.28}:c==='etf'?{ndq:-.22,world:-.25}:{ndq:-.18,world:-.3};
  if(id==='btc')return TECH.has(a)&&(a==='COIN'||a==='MSTR')?-.4:0;
  if(id==='all')return Math.min(S.ndq,S.world,(a==='COIN'||a==='MSTR')?-.4:0);
  return S[id]||0;
}
const SDESC={btc:'Το Bitcoin χάνει το μισό. Τα άλλα crypto πέφτουν συνήθως περισσότερο (−60%), όπως και οι μετοχές που εξαρτώνται από το Bitcoin.',
  ndq:'Πτώση στην τεχνολογία. Το S&P 500 πέφτει λιγότερο (−22%), οι μεμονωμένες τεχνολογικές περισσότερο, τα crypto ακολουθούν εν μέρει.',
  world:'Γενική πτώση μετοχών. Τα crypto ακολουθούν, όπως συνέβη σε προηγούμενες κρίσεις.',
  fx:'Οι τιμές σε δολάρια δεν αλλάζουν, αλλά σε ευρώ αξίζουν λιγότερο. Επηρεάζει ό,τι εξαρτάται από το δολάριο.',
  all:'Για κάθε θέση εφαρμόζεται η χειρότερη πτώση από τα τρία σενάρια αγοράς, μαζί με την άνοδο του ευρώ.',
  custom:'Όρισε εσύ πόσο κινείται κάθε κατηγορία.'};
let sui={id:'btc',c:{crypto:-40,eq:-20,gold:0,fx:5}};
function shockOf(a,id){
  const m=meta(a),usd=m.usd||0;let s=0,fx=0;
  if(id==='custom'){const c=m.cls;s=(c==='crypto'?sui.c.crypto:GOLD.has(a)?sui.c.gold:(c==='stock'||c==='etf')?sui.c.eq:0)/100;fx=sui.c.fx/100}
  else{s=baseShock(a,id);fx=id==='fx'||id==='all'?.1:0}
  return (1+s)*(1-usd+usd/(1+fx))-1;
}
function stressCalc(D,id){const rows=D.hold.map(h=>{const sh=shockOf(h.a,id);return{a:h.a,sh,d:h.val*sh}});const tot=rows.reduce((s,r)=>s+r.d,0);return{rows,tot,pct:D.end>0?tot/D.end:0}}
function renderStress(D){
  const pro=isPro();if(sui.id==='custom'&&!pro)sui.id='btc';
  $('scenChips').innerHTML=SCN.map(s=>`<button type="button" data-s="${s.id}" aria-pressed="${s.id===sui.id}">${s.n}${s.pro&&!pro?LOCK:''}</button>`).join('');
  const cw=$('custWrap');cw.hidden=sui.id!=='custom';
  if(!D||!D.hold.length){$('stressOut').innerHTML='<div class="empty">Πρόσθεσε θέσεις για να δεις τα σενάρια.</div>';return}
  if(sui.id==='custom'&&!cw.childElementCount){
    const S=[['crypto','Crypto',-90,50],['eq','Μετοχές και ETF',-60,40],['gold','Χρυσός',-40,40],['fx','Ευρώ έναντι δολαρίου',-15,15]];
    cw.innerHTML=`<div class="sliders">${S.map(([k,l,mn,mx])=>`<div class="sl"><label for="sl_${k}">${l}</label><input type="range" id="sl_${k}" data-k="${k}" min="${mn}" max="${mx}" step="5" value="${sui.c[k]}"><output class="num" id="o_${k}">${sui.c[k]>0?'+':''}${sui.c[k]}%</output></div>`).join('')}</div>`;
  }
  const r=stressCalc(D,sui.id);
  const mx=Math.max(...r.rows.map(x=>Math.abs(x.d)),1);
  $('stressOut').innerHTML=`<p class="assume" style="margin-bottom:10px">${SDESC[sui.id]}</p>
   <div class="hit"><span class="big2 num ${sgn(r.tot)}">${(r.tot>0?'+':'')+eur.format(r.tot)}</span><span class="num ${sgn(r.pct)}">${pct(r.pct)}</span><span class="muted">νέα αξία <span class="num">${eur.format(D.end+r.tot)}</span></span></div>
   <div class="bars">${r.rows.filter(x=>Math.abs(x.d)>.5).sort((a,b)=>a.d-b.d).map(x=>`<div class="bar"><span>${esc(meta(x.a).name)}</span><span class="tr"><b class="${x.d>0?'up':''}" style="width:${Math.abs(x.d)/mx*100}%"></b></span><span class="num ${sgn(x.d)}">${(x.d>0?'+':'')+eur.format(x.d)}</span></div>`).join('')||'<div class="muted small">Καμία θέση δεν επηρεάζεται σε αυτό το σενάριο.</div>'}</div>
   <p class="assume">Υποθετικός υπολογισμός πάνω στη σημερινή αξία. Δεν είναι πρόβλεψη. Οι καταθέσεις και τα ακίνητα ή άλλα χειροκίνητα στοιχεία θεωρούνται σταθερά, και οι πραγματικές κρίσεις μπορεί να είναι χειρότερες.</p>`;
}
$('scenChips').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  const s=SCN.find(x=>x.id===b.dataset.s);if(s.pro&&!isPro())return openSheet('info');
  sui.id=s.id;renderStress(D)});
$('custWrap').addEventListener('input',e=>{const k=e.target.dataset.k;if(!k)return;sui.c[k]=+e.target.value;$('o_'+k).textContent=(sui.c[k]>0?'+':'')+sui.c[k]+'%';renderStress(D)});

/* ---------- decision journal ---------- */
const REASONS={long:'Μακροπρόθεσμη επένδυση',opp:'Βραχυπρόθεσμη ευκαιρία',rebal:'Αναδιάρθρωση',fear:'Αντίδραση σε πτώση',fomo:'Αντίδραση σε άνοδο',fund:'Αλλαγή θεμελιωδών'};
$('fReason').innerHTML='<option value="">— χωρίς λόγο —</option>'+Object.entries(REASONS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
function journalCalc(){
  const spy=PRICES.SPY;
  const items=state.tx.filter(t=>t.reason&&t.a!=='DEP'&&(t.type==='buy'||t.type==='sell')).map(t=>{const w=toWeek(t.date),p=series(t.a);
    const after=h=>w+h<W&&p[w]>0?p[w+h]/p[w]-1:null,spyA=h=>w+h<W?spy[w+h]/spy[w]-1:null;
    return{t,w,a3:after(13),a6:after(26),s3:spyA(13),s6:spyA(26)}}).sort((x,y)=>y.t.date.localeCompare(x.t.date));
  const groups={};
  items.filter(i=>i.a3!=null).forEach(i=>{const k=i.t.type+':'+i.t.reason;(groups[k]=groups[k]||[]).push(i.t.type==='buy'?i.a3-i.s3:i.a3)});
  const pats=Object.entries(groups).map(([k,v])=>{const [type,reason]=k.split(':');return{type,reason,n:v.length,avg:v.reduce((a,b)=>a+b,0)/v.length}}).sort((a,b)=>b.n-a.n);
  return{items,pats};
}
function renderJournal(){
  const J=journalCalc(),box=$('journal');
  if(!J.items.length){box.innerHTML='<div class="empty">Όταν καταχωρείς μια αγορά ή πώληση, διάλεξε προαιρετικά τον λόγο. Μετά από 3 και 6 μήνες εδώ θα φαίνεται τι ακολούθησε.</div>';return}
  const pats=J.pats.map(p=>{const buy=p.type==='buy';
    const line=buy?`Μετά από τέτοιες αγορές, το asset ${p.avg>=0?'ξεπέρασε':'υστέρησε του'} S&P 500 κατά μέσο όρο <b class="num ${sgn(p.avg)}">${nf(1).format(Math.abs(p.avg*100))} μον.</b> στους 3 μήνες.`
      :`Μετά από τέτοιες πωλήσεις, το asset κινήθηκε κατά μέσο όρο <b class="num ${sgn(p.avg)}">${pct(p.avg)}</b> στους 3 μήνες.`;
    return `<div class="pat"><span><b>${buy?'Αγορές':'Πωλήσεις'}: ${REASONS[p.reason]}</b></span><span class="muted small num">${p.n} ${p.n===1?'απόφαση':'αποφάσεις'}</span><small>${line}${p.n<3?' Λίγα δεδομένα ακόμα, όχι μοτίβο.':''}</small></div>`}).join('');
  const rows=J.items.map(i=>{const t=i.t,buy=t.type==='buy';const left=13-(W-1-i.w);
    let note;
    if(i.a3==null)note=`<span class="muted">Αξιολόγηση σε ${left} εβδ.</span>`;
    else if(buy){const d=(i.a6??i.a3)-(i.s6??i.s3);note=d>=0?'Πήγε καλύτερα από το S&P 500':'Πήγε χειρότερα από το S&P 500'}
    else{const a=i.a6??i.a3;note=a>0?'Το asset ανέβηκε μετά την πώληση':'Το asset συνέχισε να πέφτει'}
    return `<tr><td class="num">${longDate(t.date)}</td><td>${buy?'Αγορά':'Πώληση'} ${esc(meta(t.a).name)}</td><td><span class="rtag">${REASONS[t.reason]}</span></td>
      <td class="num ${sgn(i.a3)}">${i.a3==null?'—':pct(i.a3)}</td><td class="num ${sgn(i.a6)}">${i.a6==null?'—':pct(i.a6)}</td><td class="num muted">${i.s6==null?(i.s3==null?'—':pct(i.s3)):pct(i.s6)}</td><td>${note}</td></tr>`}).join('');
  box.innerHTML=(pats?`<div class="pattern">${pats}</div>`:'')+
    `<div class="tablewrap"><table><thead><tr><th>Ημερομηνία</th><th>Απόφαση</th><th>Λόγος</th><th>Asset +3μ</th><th>Asset +6μ</th><th>S&amp;P ίδιο διάστημα</th><th>Τι ακολούθησε</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="assume" style="margin-top:10px">Δεν είναι βαθμολογία. Μια απόφαση μπορεί να ήταν λογική ακόμα κι αν η αγορά κινήθηκε αντίθετα. Το ημερολόγιο δείχνει τι ακολούθησε, ώστε να εντοπίζεις μοτίβα στη δική σου συμπεριφορά.</p>`;
}

function hover(ev){
  if(!CH)return;const svg=$('chart'),r=svg.getBoundingClientRect();
  const px=(ev.clientX-r.left)*(CH.cw/r.width);
  let w=Math.round(CH.w0+(px-CH.P.l)/(CH.cw-CH.P.l-CH.P.r)*(W-1-CH.w0));w=Math.max(CH.w0,Math.min(W-1,w));
  const hx=$('hx');hx.setAttribute('x1',CH.x(w));hx.setAttribute('x2',CH.x(w));hx.setAttribute('visibility','visible');
  const f=v=>ui.mode==='value'?eur.format(v):pct(v/100);
  const tip=$('tip');tip.hidden=false;
  tip.innerHTML=`<div class="r"><b>${longDate(iso(wDate(w)))}</b></div>`+CH.lines.map(L=>`<div class="r"><span>${L.n.split(' (')[0]}</span><span class="num">${L.v[w]==null?'—':f(L.v[w])}</span></div>`).join('');
  const left=CH.x(w)*(r.width/CH.cw);const tw=tip.offsetWidth;
  tip.style.left=Math.max(0,Math.min(r.width-tw,left+12>r.width-tw?left-tw-12:left+12))+'px';tip.style.top='8px';
}
$('chartbox').addEventListener('pointermove',e=>{if(e.target.id==='hit')hover(e)});
$('chartbox').addEventListener('pointerleave',()=>{$('tip').hidden=true;const hx=$('hx');if(hx)hx.setAttribute('visibility','hidden')});

/* ---------- render: holdings ---------- */
function renderHoldings(D){
  if(!D||!D.hold.length){$('alloc').innerHTML='';$('alegend').innerHTML='';$('holdings').innerHTML='<tbody><tr><td class="empty" colspan="7">Καμία ανοιχτή θέση.</td></tr></tbody>';$('posCount').textContent='';return}
  $('posCount').textContent=D.hold.length+(D.hold.length===1?' θέση':' θέσεις');
  const by={};D.hold.forEach(h=>{const c=meta(h.a).cls;by[c]=(by[c]||0)+h.wt});
  const cls=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  $('alloc').innerHTML=cls.map(([c,w])=>`<span style="width:${w*100}%;background:var(--c-${c})" title="${CLS[c]}"></span>`).join('');
  $('alegend').innerHTML=cls.map(([c,w])=>`<span><i class="dot" style="background:var(--c-${c})"></i>${CLS[c]} <span class="num">${nf(0).format(w*100)}%</span></span>`).join('');
  $('holdings').innerHTML=`<thead><tr><th>Στοιχείο</th><th>Ποσότητα</th><th>Μέση τιμή</th><th>Τρέχουσα</th><th>Αξία</th><th>Κέρδος</th><th>Βάρος</th></tr></thead><tbody>`+
  D.hold.map(h=>{const m=meta(h.a),manual=m.custom&&!state.custom[h.a]?.mint;return `<tr><td><div class="an">${esc(m.name)}</div><div class="ac">${m.sym&&!m.custom?esc(m.sym)+' · ':''}${CLS[m.cls]}${ASSETS[h.a]?.live?' · ζωντανή τιμή':''}</div></td>
  <td class="num">${nf(h.qty<1?4:2).format(h.qty)}</td><td class="num">${price(h.avg)}</td><td class="num">${price(h.now)}${manual?`<div><button class="del edit" type="button" data-price="${esc(h.a)}">Αλλαγή τιμής</button></div>`:''}</td><td class="num">${eur.format(h.val)}</td>
  <td class="num ${sgn(h.pl)}">${(h.pl>0?'+':'')+eur.format(h.pl)}<div class="ac ${sgn(h.pl)}">${pct(h.plp)}</div></td>
  <td class="num">${nf(0).format(h.wt*100)}%<span class="wbar"><b style="width:${h.wt*100}%"></b></span></td></tr>`}).join('')+'</tbody>';
}
$('holdings').addEventListener('click',e=>{const b=e.target.closest('[data-price]');if(b)openSheet('price',b.dataset.price)});

/* ---------- render: insights ---------- */
const PROTEASE={['Χρονισμός']:'Σε βοήθησε ή σου κόστισε ο χρονισμός των αγορών;',['Επικάλυψη']:'Έχεις την ίδια έκθεση από δύο δρόμους;','Crypto':'Πόσο κινούνται τα crypto σου μαζί με τις μετοχές;',['Κίνδυνος']:'Ποια ήταν η χειρότερη στιγμή του χαρτοφυλακίου;'};
function corr(a,b){const n=a.length;const ma=a.reduce((s,x)=>s+x,0)/n,mb=b.reduce((s,x)=>s+x,0)/n;let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2}return c/Math.sqrt(va*vb)}
function renderInsights(D){
  const box=$('insights');
  if(!D){box.innerHTML='<div class="empty">Οι παρατηρήσεις εμφανίζονται μόλις υπάρχουν θέσεις.</div>';return}
  const out=[];const pro=isPro();
  const push0=out.push.bind(out);let tagPro=false;out.push=o=>push0({...o,pro:tagPro});
  if(!D.short&&D.bench.SPY){const sp=D.bench.SPY.B[W-1],d=D.end-sp;
  out.push({l:d>=0?'good':'warn',chip:d>=0?'Πάνω από αγορά':'Κάτω από αγορά',t:'Τι θα είχες με ένα απλό ETF',
    p:`Αν τα ίδια ποσά, τις ίδιες ημερομηνίες, πήγαιναν όλα στο S&P 500, σήμερα θα είχες <b class="num">${eur.format(sp)}</b>. Το χαρτοφυλάκιό σου είναι <b class="num ${sgn(d)}">${(d>0?'+':'')+eur.format(d)}</b> ${d>=0?'πάνω':'κάτω'} από αυτό.`,
    e:'Ένας δείκτης όπως το S&P 500 είναι η «χωρίς κόπο» εναλλακτική. Αν μια πιο σύνθετη επιλογή δεν τον ξεπερνά σε βάθος χρόνου, ο επιπλέον κίνδυνος και χρόνος δεν αποζημιώνεται. Ένα μεμονωμένο διάστημα δεν αποδεικνύει τίποτα, η σύγκριση έχει νόημα σε βάθος ετών.'})}
  tagPro=true;
  if(D.mwr!=null&&D.twrA!=null){const gap=D.mwr-D.twrA;if(Math.abs(gap)>.02)out.push({l:gap<0?'warn':'good',chip:'Χρονισμός',t:gap<0?'Ο χρονισμός των αγορών σου κόστισε':'Ο χρονισμός των αγορών σε βοήθησε',
    p:`Οι επιλογές σου απέδωσαν <b class="num">${pct(D.twrA)}</b> τον χρόνο, αλλά τα δικά σου χρήματα <b class="num">${pct(D.mwr)}</b>. ${gap<0?'Έβαλες περισσότερα κεφάλαια κοντά σε υψηλά.':'Έβαλες περισσότερα κεφάλαια σε χαμηλότερα επίπεδα.'}`,
    e:'Η TWR μετράει πόσο καλά απέδωσαν τα assets που διάλεξες, ανεξάρτητα από το πότε έβαλες χρήματα. Η MWR μετράει τι έβγαλαν πραγματικά τα δικά σου ευρώ. Η διαφορά τους δείχνει την επίδραση του χρονισμού. Πολλές εφαρμογές δείχνουν μόνο ένα απλό ποσοστό που τα ανακατεύει.'})}
  tagPro=false;
  const top=D.hold[0];if(top){const m=meta(top.a);out.push({l:top.wt>.4?'warn':'info',chip:'Συγκέντρωση',t:top.wt>.4?`Το ${nf(0).format(top.wt*100)}% είναι σε ένα στοιχείο`:'Η μεγαλύτερη θέση σου',
    p:`Η μεγαλύτερη θέση είναι ${esc(m.name)} με <b class="num">${nf(0).format(top.wt*100)}%</b> της αξίας. Μια πτώση 30% σε αυτό θα σήμαινε περίπου <b class="num neg">−${eur.format(top.val*.3)}</b> στο σύνολο.`,
    e:'Η συγκέντρωση δεν είναι από μόνη της λάθος, αλλά καθορίζει πόσο πολύ μια κακή εξέλιξη σε ένα asset επηρεάζει όλο το κεφάλαιο. Είναι καλό να είναι επιλογή και όχι κάτι που προέκυψε επειδή ανέβηκε μια θέση.'})}
  tagPro=true;
  const has=a=>D.hold.some(h=>h.a===a);
  const sp500=['SPY','SXR8'].some(has),ndq=['QQQ','EQQQ'].some(has),world=['VWCE','EUNL'].some(has);
  const inIdx=[...MEGA,...TECH].filter(a=>has(a)&&a!=='COIN'&&a!=='MSTR').map(a=>ASSETS[a].name);
  const idxN=[sp500,ndq,world].filter(Boolean).length;
  if(idxN&&(inIdx.length||idxN>1))out.push({l:'info',chip:'Επικάλυψη',t:'Έχεις την ίδια έκθεση από δύο δρόμους',
    p:`${idxN>1?'Οι δείκτες που κατέχεις (S&P 500, Nasdaq 100, παγκόσμιοι) μοιράζονται πολλές από τις μεγαλύτερες εταιρείες. ':''}${inIdx.length?`Η θέση σε ${inIdx.join(', ')} υπάρχει ήδη μέσα στους δείκτες που κατέχεις.`:''} Η πραγματική σου έκθεση στις μεγάλες αμερικανικές τεχνολογικές είναι μεγαλύτερη από όσο δείχνει η λίστα.`,
    e:'Ένα ETF σε δείκτη κατέχει εκατοντάδες εταιρείες με βάρη ανάλογα της αξίας τους. Όταν αγοράζεις και μεμονωμένα μια από τις μεγάλες, αυξάνεις τη συγκέντρωση σε αυτή χωρίς να το βλέπεις στη λίστα θέσεων.'});
  const cryptoW=D.hold.filter(h=>meta(h.a).cls==='crypto').reduce((s,h)=>s+h.wt,0);
  if(cryptoW>0&&!D.short&&PRICES.BTC&&PRICES.QQQ){const a=[],b=[];for(let w=D.w0+1;w<W;w++){a.push(PRICES.BTC[w]/PRICES.BTC[w-1]-1);b.push(PRICES.QQQ[w]/PRICES.QQQ[w-1]-1)}const c=corr(a,b);
    out.push({l:cryptoW>.5?'warn':'info',chip:'Crypto',t:`Crypto: ${nf(0).format(cryptoW*100)}% του χαρτοφυλακίου`,
    p:`Στο ίδιο διάστημα το Bitcoin κινήθηκε με συσχέτιση <b class="num">${nf(2).format(c)}</b> προς το Nasdaq. ${c>.3?'Σε αναταραχές της αγοράς είναι πιθανό να πέφτουν μαζί, άρα η διαφοροποίηση είναι μικρότερη απ’ όσο φαίνεται.':'Σε αυτό το διάστημα κινήθηκε αρκετά ανεξάρτητα.'}`,
    e:'Η συσχέτιση παίρνει τιμές από −1 έως 1. Κοντά στο 1 σημαίνει ότι δύο assets ανεβοκατεβαίνουν μαζί, κοντά στο 0 ότι κινούνται ανεξάρτητα. Η διαφοροποίηση προστατεύει μόνο όταν τα assets δεν πέφτουν ταυτόχρονα.'})}
  if(!D.short)out.push({l:D.mdd<-.3?'warn':'info',chip:'Κίνδυνος',t:`Η χειρότερη στιγμή: ${pct(D.mdd)}`,
    p:`Γύρω στις ${longDate(iso(wDate(D.mddW)))} το χαρτοφυλάκιο ήταν ${pct(-D.mdd).replace('+','')} κάτω από την προηγούμενη κορυφή του. Ετήσια μεταβλητότητα: <b class="num">${D.vol!=null?nf(0).format(D.vol*100)+'%':'—'}</b>.`,
    e:'Η μέγιστη πτώση (drawdown) δείχνει την πιο δύσκολη στιγμή που θα έπρεπε να αντέξεις ψυχολογικά. Αν σε μια τέτοια πτώση θα πουλούσες από πανικό, ο κίνδυνος του χαρτοφυλακίου είναι μεγαλύτερος από όσο σου ταιριάζει.'});
  tagPro=false;
  if(D.bought>0){const fr=D.fees/D.bought;
  out.push({l:fr<.005?'good':'warn',chip:'Κόστος',t:`Πλήρωσες ${eur2.format(D.fees)} σε προμήθειες`,
    p:`Αντιστοιχεί στο <b class="num">${nf(2).format(fr*100)}%</b> του ποσού των αγορών σου. ${fr<.005?'Χαμηλό κόστος.':'Το κόστος αυτό είναι υψηλότερο από 0,5% των αγορών.'}`,
    e:'Οι προμήθειες και τα spreads είναι το μόνο σίγουρο στοιχείο μιας επένδυσης. Μικρά ποσοστά σε κάθε συναλλαγή γίνονται σημαντικά όταν οι αγορές είναι συχνές.'})}
  if(D.income||D.rewardsEur)out.push({l:'good',chip:'Εισόδημα',t:'Εισόδημα από τις επενδύσεις σου',
    p:`${D.income?`Μερίσματα και τόκοι: <b class="num">${eur2.format(D.income)}</b>. `:''}${D.rewardsEur?`Ανταμοιβές staking, με την τιμή της ημέρας που τις πήρες: <b class="num">${eur2.format(D.rewardsEur)}</b>.`:''}`,
    e:'Το εισόδημα μετράει στην απόδοση. Τα μερίσματα και οι τόκοι που εισπράττεις μετρούν ως χρήματα που βγήκαν από το χαρτοφυλάκιο προς εσένα. Οι ανταμοιβές staking αυξάνουν την ποσότητα που κατέχεις χωρίς να βάλεις νέα χρήματα.'});
  const order=[...out.filter(o=>!o.pro),...out.filter(o=>o.pro)];
  box.innerHTML=order.map(o=>o.pro&&!pro
    ?`<article class="ins locked" role="button" tabindex="0" data-pro="1"><div class="t"><span class="chip">${LOCK} ${o.chip}</span><span>${PROTEASE[o.chip]||'Ανάλυση Pro'}</span></div><p>Διαθέσιμο με το Pro.</p><span class="unlock">Ξεκλείδωσε με SKR →</span></article>`
    :`<article class="ins" data-l="${o.l}"><div class="t"><span class="chip">${o.chip}</span><span>${o.t}</span></div><p>${o.p}</p><details><summary>Τι σημαίνει αυτό;</summary><p>${o.e}</p></details></article>`).join('')||'<div class="empty">Οι παρατηρήσεις εμφανίζονται όταν υπάρξει αρκετό ιστορικό.</div>';
}

/* ---------- transactions ---------- */
function assetOptions(sel,withNew=true){
  const groups={crypto:[],etf:[],stock:[],cash:[]};
  const names=Object.entries(ASSETS).sort((a,b)=>a[1].name.localeCompare(b[1].name,'el'));
  for(const [k,a] of names)groups[a.cls]?.push(`<option value="${k}">${esc(a.name)}</option>`);
  let h='';for(const c of ['crypto','etf','stock','cash'])if(groups[c].length)h+=`<optgroup label="${CLS[c]}">${groups[c].join('')}</optgroup>`;
  const cust=Object.entries(state.custom);
  if(cust.length)h+=`<optgroup label="Δικά σου">${cust.map(([k,c])=>`<option value="${k}">${esc(c.name)}</option>`).join('')}</optgroup>`;
  if(withNew)h+=`<option value="__new">+ Άλλο: ακίνητο, μετοχή ΧΑ ή ό,τι άλλο (δική σου τιμή)</option>`;
  const el=$(sel),cur=el.value;el.innerHTML=h;if(cur&&[...el.options].some(o=>o.value===cur))el.value=cur;
}
let priceTouched=false;
const TYPE_HINT={buy:'',sell:'',div:'Μέρισμα ή τόκος που εισέπραξες σε μετρητά από αυτό το στοιχείο.',reward:'Ανταμοιβή staking ή άλλο εισόδημα σε τεμάχια. Προσθέτει ποσότητα χωρίς νέα χρήματα.'};
function autoPrice(){
  const a=$('fAsset').value,isNew=a==='__new',type=$('fType').value;
  $('wrapCName').hidden=!isNew;$('wrapCNow').hidden=!isNew;$('wrapCCls').hidden=!isNew;
  $('lQty').textContent=type==='div'?'Ποσό €':'Ποσότητα';
  $('wrapPrice').hidden=type==='div'||type==='reward';$('wrapFee').hidden=type==='reward';$('wrapReason').hidden=type==='div'||type==='reward';
  $('typeHint').textContent=TYPE_HINT[type];$('typeHint').hidden=!TYPE_HINT[type];
  if(priceTouched)return;
  if(PRICES[a]&&$('fDate').value){const p=PRICES[a][toWeek($('fDate').value)];$('fPrice').value=+p.toPrecision(6)}
  else if(!isNew&&state.custom[a])$('fPrice').value=+(+state.custom[a].current||0).toPrecision(6);
  else $('fPrice').value='';
}
$('fAsset').addEventListener('change',()=>{priceTouched=false;autoPrice()});
$('fType').addEventListener('change',()=>{autoPrice()});
$('fDate').addEventListener('change',()=>{priceTouched=false;autoPrice()});
$('fPrice').addEventListener('input',()=>{priceTouched=true});
$('fCCls').innerHTML=Object.entries(CUSTOM_CLS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');

const heldOn=(a,date)=>state.tx.filter(t=>t.a===a&&t.date<=date&&t.type!=='div').reduce((s,t)=>s+(t.type==='sell'?-t.qty:t.qty),0);
$('txForm').addEventListener('submit',e=>{
  e.preventDefault();const msg=$('formMsg');msg.textContent='';
  let a=$('fAsset').value;const type=$('fType').value,date=$('fDate').value;
  const qty=parseFloat($('fQty').value),fee=type==='reward'?0:(parseFloat($('fFee').value)||0);
  let pr=parseFloat($('fPrice').value);
  if(!date){msg.textContent='Διάλεξε ημερομηνία.';return}
  if(date>todayIso()){msg.textContent='Η ημερομηνία δεν μπορεί να είναι στο μέλλον.';return}
  if(!(qty>0)){msg.textContent=type==='div'?'Το ποσό πρέπει να είναι μεγαλύτερο από 0.':'Η ποσότητα πρέπει να είναι μεγαλύτερη από 0.';return}
  if(type==='div'||type==='reward')pr=type==='div'?1:(series(a)[toWeek(date)]||0);
  else if(!(pr>0)){msg.textContent='Συμπλήρωσε την τιμή ανά μονάδα.';return}
  if(a==='__new'&&!$('fCName').value.trim()){msg.textContent='Δώσε όνομα στο νέο στοιχείο.';return}
  if(a==='__new'&&type!=='buy'){msg.textContent='Ένα νέο στοιχείο ξεκινά με αγορά.';return}
  if(state.sample)state={sample:false,onboarded:true,custom:{},mints:{},tx:[]};
  if(a==='__new'){const now=parseFloat($('fCNow').value);a='c_'+uid();state.custom[a]={name:$('fCName').value.trim(),cls:$('fCCls').value,current:now>0?now:pr}}
  if(type==='sell'||type==='div'){const held=heldOn(a,date);
    if(type==='sell'&&qty>held+1e-9){msg.textContent=`Μπορείς να πουλήσεις έως ${nf(6).format(Math.max(0,held))} μονάδες σε αυτή την ημερομηνία.`;return}
    if(type==='div'&&!(held>0)){msg.textContent='Δεν κατείχες αυτό το στοιχείο εκείνη την ημερομηνία.';return}}
  state.tx.push({id:uid(),a,type,date,qty,price:pr,fee,reason:type==='buy'||type==='sell'?$('fReason').value:''});$('fReason').value='';
  $('fQty').value='';$('fFee').value='0';$('fCName').value='';$('fCNow').value='';priceTouched=false;
  save();assetOptions('fAsset');$('fAsset').value=a;autoPrice();render();
  msg.textContent='';toast('Καταχωρήθηκε.');
});
const TYPE_N={buy:'Αγορά',sell:'Πώληση',div:'Μέρισμα/τόκος',reward:'Staking/ανταμοιβή'};
function renderTx(){
  const t=$('txTable');
  if(!state.tx.length){t.innerHTML='';return}
  const rows=[...state.tx].sort((x,y)=>y.date.localeCompare(x.date));
  t.innerHTML=`<thead><tr><th>Ημερομηνία</th><th>Στοιχείο</th><th>Κίνηση</th><th>Λόγος</th><th>Ποσότητα</th><th>Τιμή</th><th>Προμήθεια</th><th>Σύνολο</th><th></th></tr></thead><tbody>`+
  rows.map(r=>`<tr><td class="num">${longDate(r.date)}</td><td>${esc(meta(r.a).name)}</td><td><span class="typechip ${r.type}">${TYPE_N[r.type]}</span>${r.src==='wallet'?' <span class="muted small">από wallet</span>':''}</td><td>${r.reason?`<span class="rtag">${REASONS[r.reason]}</span>`:'<span class="muted">—</span>'}</td>
  <td class="num">${r.type==='div'?'—':nf(6).format(r.qty)}</td><td class="num">${r.type==='div'?'—':price(r.price)}</td><td class="num">${eur2.format(r.fee||0)}</td><td class="num">${eur.format(r.type==='div'?r.qty:r.qty*r.price)}</td>
  <td><button class="del" type="button" data-id="${r.id}">Διαγραφή</button></td></tr>`).join('')+'</tbody>';
}
$('txTable').addEventListener('click',e=>{
  const b=e.target.closest('.del');if(!b)return;
  if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Σίγουρα;';setTimeout(()=>{if(b.isConnected){b.classList.remove('armed');b.textContent='Διαγραφή'}},3000);return}
  state.tx=state.tx.filter(t=>t.id!==b.dataset.id);
  for(const k of Object.keys(state.custom))if(!state.tx.some(t=>t.a===k))delete state.custom[k];
  save();assetOptions('fAsset');render();
});

function seg(id,key){$(id).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(key==='bench'&&b.dataset.v!=='SPY'&&!isPro()){openSheet('info');return}
  ui[key]=b.dataset.v;[...$(id).children].forEach(x=>x.setAttribute('aria-pressed',x===b));render()})}
seg('segMode','mode');seg('segBench','bench');

let D=null;
