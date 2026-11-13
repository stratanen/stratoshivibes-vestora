/* ---------- plan ---------- */
const PKEY='vestora-plan-v1';
const PC={eq:{n:'Μετοχές & ETF',mu:.06,s:.16,c:'var(--c-etf)'},crypto:{n:'Crypto',mu:.08,s:.65,c:'var(--c-crypto)'},
  cash:{n:'Καταθέσεις',mu:.02,s:.005,c:'var(--c-cash)'},other:{n:'Άλλα',mu:.03,s:.10,c:'var(--c-other)'}};
const PK=Object.keys(PC);
const RHO={'eq|crypto':.5,'eq|other':.3,'crypto|other':.2};
const CSHOCK={eq:(1-.28)/1.1-1,crypto:(1-.5)/1.1-1,cash:0,other:0};
const ASSN={'-0.02':'συντηρητικές','0':'μέτριες','0.02':'αισιόδοξες'};
const pcls=c=>c==='stock'||c==='etf'?'eq':c==='crypto'?'crypto':c==='cash'?'cash':'other';
let plan={goal:null,monthly:null,years:15,fee:.3,ass:'0',real:'1',target:null,next:null,exp:'',res:'',inc:'',vr:'',debt:'',tol:'30',b:null,bShow:true};
try{Object.assign(plan,JSON.parse(localStorage.getItem(PKEY))||{})}catch(e){}
const savePlan=()=>{try{localStorage.setItem(PKEY,JSON.stringify(plan))}catch(e){}};
function curAlloc(Dd){const a={eq:0,crypto:0,cash:0,other:0};if(Dd)Dd.hold.forEach(h=>{const k=ASSETS[h.a]?.k;a[k==='mm'?'cash':k==='bond'?'other':k==='btc'?'crypto':pcls(meta(h.a).cls)]+=h.val});return a}
const toW=a=>{const t=Object.values(a).reduce((s,x)=>s+x,0)||1;return Object.fromEntries(PK.map(k=>[k,a[k]/t]))};
function histMonthly(Dd){if(!Dd)return 200;let s=0;for(let w=Math.max(0,W-52);w<W;w++)s+=Dd.C[w];return Math.max(0,Math.round(s/12/10)*10)}
const targetSum=()=>plan.target?PK.reduce((s,k)=>s+(+plan.target[k]||0),0):0;
const targetValid=()=>!!plan.target&&Math.abs(targetSum()-100)<.5;
function riskParams(w,ass){let mu=0,v=0;
  PK.forEach(k=>{mu+=w[k]*(PC[k].mu+(k==='cash'?0:ass));v+=w[k]**2*PC[k].s**2});
  for(let i=0;i<PK.length;i++)for(let j=i+1;j<PK.length;j++){const r=RHO[PK[i]+'|'+PK[j]]||0;v+=2*w[PK[i]]*w[PK[j]]*r*PC[PK[i]].s*PC[PK[j]].s}
  return{mu,s:Math.sqrt(v)}}
function project({initial,monthly,years,fee,mu,s,real,goal}){
  const Rn=rng(424242),g=()=>{let u=0,v=0;while(!u)u=Rn();while(!v)v=Rn();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  const P=400,inf=.025,m=(mu-fee-s*s/2)/12,sd=s/Math.sqrt(12);
  const yv=Array.from({length:years+1},()=>new Float64Array(P));
  for(let p=0;p<P;p++){let v=initial;yv[0][p]=v;for(let y=1;y<=years;y++){for(let k=0;k<12;k++)v=v*Math.exp(m+sd*g())+monthly;yv[y][p]=v}}
  const q=(arr,f)=>{const a=Array.from(arr).sort((x,y)=>x-y);return a[Math.floor(f*(a.length-1))]};
  const defl=y=>real?Math.pow(1+inf,y):1;
  const band=yv.map((arr,y)=>({y,p10:q(arr,.1)/defl(y),p50:q(arr,.5)/defl(y),p90:q(arr,.9)/defl(y),contrib:(initial+monthly*12*y)/defl(y)}));
  let hit=0;for(let p=0;p<P;p++)if(yv[years][p]/defl(years)>=goal)hit++;
  const hitY=yv.map((arr,y)=>{let h=0;for(let p=0;p<P;p++)if(arr[p]/defl(y)>=goal)h++;return h/P});
  return{band,hit:hit/P,hitY,last:band[years]};
}
function planRun(o={}){
  const w=targetValid()?Object.fromEntries(PK.map(k=>[k,plan.target[k]/100])):toW(curAlloc(D));
  const ass=+(o.ass??plan.ass);const {mu,s}=riskParams(w,ass);
  const args={initial:D?D.end:0,monthly:Math.max(0,+(o.monthly??plan.monthly)||0),years:Math.max(1,Math.min(50,Math.round(+(o.years??plan.years)||1))),
    fee:Math.max(0,+(o.fee??plan.fee)||0)/100,mu,s,real:(o.real??plan.real)==='1'||(o.real??plan.real)===true,goal:Math.max(0,+(o.goal??plan.goal)||0)};
  return{...project(args),args,w,mu,s};
}
function nextRows(amt){
  const cur=curAlloc(D),tot=Object.values(cur).reduce((s,x)=>s+x,0);const base=D?stressCalc(D,'all').tot:0;
  const dev=a=>targetValid()?PK.reduce((s,k)=>s+Math.abs(a[k]/(tot+amt||1)*100-plan.target[k]),0)/2:null;
  const mk=(label,add)=>{const a={...cur};PK.forEach(k=>a[k]+=add[k]||0);const st=base+PK.reduce((s,k)=>s+(add[k]||0)*CSHOCK[k],0);
    const T=Object.values(a).reduce((s,x)=>s+x,0)||1;return{label,w:Object.fromEntries(PK.map(k=>[k,a[k]/T])),dev:dev(a),st,stp:st/T}};
  const rows=[mk('Χωρίς νέα καταβολή (σήμερα)',{})];rows[0].dev=targetValid()?PK.reduce((s,k)=>s+Math.abs(cur[k]/(tot||1)*100-plan.target[k]),0)/2:null;rows[0].stp=base/(tot||1);
  PK.forEach(k=>rows.push(mk('Όλο σε '+PC[k].n,{[k]:amt})));
  if(targetValid())rows.push(mk('Μοιρασμένο όπως η κατανομή-στόχος',Object.fromEntries(PK.map(k=>[k,amt*plan.target[k]/100]))));
  return rows;
}
let targetBuilt=false,lastProj=null,lastNeed=null,lastB=null,lastRes=null;
function renderPlan(D){
  if(plan.monthly==null)plan.monthly=histMonthly(D);
  if(plan.goal==null)plan.goal=150000;
  if(!plan.target&&D&&D.hold.length){const w=toW(curAlloc(D));const t=Object.fromEntries(PK.map(k=>[k,Math.round(w[k]*20)*5]));const diff=100-PK.reduce((s,k)=>s+t[k],0);t.eq+=diff;plan.target=t}
  const set=(id,v)=>{const el=$(id);if(document.activeElement!==el)el.value=v};
  set('pGoal',plan.goal);set('pMonthly',plan.monthly);set('pYears',plan.years);set('pFee',plan.fee);set('pAss',plan.ass);set('pReal',plan.real);set('pTol',plan.tol);
  $('pYearsO').textContent=plan.years;
  if(plan.next==null)plan.next=plan.monthly;set('nAmt',plan.next);
  set('rExp',plan.exp);set('rRes',plan.res);
  $('pHint').textContent=D?`Ξεκινά από τη σημερινή αξία (${eur.format(D.end)}).`+(D.years>=1?` Τους τελευταίους 12 μήνες έβαλες κατά μέσο όρο περίπου ${eur.format(histMonthly(D))} τον μήνα.`:''):'Πρόσθεσε θέσεις ή ξεκίνα από το μηδέν με μηνιαία καταβολή.';
  const R0=planRun(),L=R0.last,real=R0.args.real;
  $('projHead').innerHTML=`<div class="projhead"><div><span class="lbl">Μεσαίο σενάριο σε ${R0.args.years} χρόνια</span><span class="big2 num">${eur.format(L.p50)}</span></div>
    <div><span class="lbl">Εύρος (8 στα 10 σενάρια)</span><span class="num">${eur.format(L.p10)} – ${eur.format(L.p90)}</span></div>
    <div><span class="lbl">Δικά σου χρήματα</span><span class="num">${eur.format(L.contrib)}</span></div>
    <span class="goalchip" style="color:${R0.hit>=.7?'var(--good)':R0.hit>=.4?'var(--warn)':'var(--bad)'};border-color:currentColor">Στόχος ${eur.format(R0.args.goal)}: σε ${Math.round(R0.hit*100)} από τα 100 σενάρια</span></div>`+splitHtml(L);
  // levers
  const f=+plan.fee,lv=[['Το πλάνο σου όπως είναι',{}],['+50 € τον μήνα',{monthly:R0.args.monthly+50}],['−50 € τον μήνα',{monthly:Math.max(0,R0.args.monthly-50)}],
    ['+3 χρόνια',{years:R0.args.years+3}],[f>=.5?'Έξοδα −0,5 μονάδα':'Χωρίς έξοδα',{fee:f>=.5?f-.5:0}]];
  $('levers').innerHTML=`<thead><tr><th>Αν αλλάξει…</th><th>Μεσαίο σενάριο</th><th>Δυσμενές (1 στα 10)</th><th>Δικά σου χρήματα</th><th>Σενάρια με στόχο</th></tr></thead><tbody>`+
    lv.map(([n,o],i)=>{const r=i?planRun(o):R0,d=r.last.p50-L.p50;return `<tr${i?'':' class="sel"'}><td>${n}</td><td class="num">${eur.format(r.last.p50)}${i?` <span class="${sgn(d)} small">${(d>0?'+':'')+eur.format(d)}</span>`:''}</td><td class="num">${eur.format(r.last.p10)}</td><td class="num">${eur.format(r.last.contrib)}</td><td class="num">${Math.round(r.hit*100)}/100</td></tr>`}).join('')+'</tbody>';
  lastProj=R0;
  lastNeed=renderNeed(R0);renderTol(R0);lastB=renderPlanB(R0);drawProj(R0,plan.bShow!==false?lastB:null);
  $('projAssume').textContent=`Εκτιμήσεις (${ASSN[plan.ass]}): ετήσια απόδοση μετοχών ${nf(0).format((PC.eq.mu+ +plan.ass)*100)}%, crypto ${nf(0).format((PC.crypto.mu+ +plan.ass)*100)}%, καταθέσεων ${nf(1).format(PC.cash.mu*100)}%, με διακυμάνσεις αντίστοιχες κάθε κατηγορίας. Εφαρμόζονται ${targetValid()?'στην κατανομή-στόχο σου':'στη σημερινή σου κατανομή'}: αναμενόμενη απόδοση ${nf(1).format(R0.mu*100)}% και διακύμανση ${nf(0).format(R0.s*100)}% τον χρόνο. 400 προσομοιωμένες πορείες, καταβολή στο τέλος κάθε μήνα, χωρίς φόρους.${real?' Τα ποσά είναι σε σημερινά ευρώ, με πληθωρισμό 2,5%.':''} Δεν είναι πρόβλεψη: οι πραγματικές αποδόσεις μπορεί να βγουν έξω από το εύρος.`;
  renderTarget();renderNext();lastRes=renderReserve();renderHow(R0);
}
/* The plan in plain steps: what to do every month, before and after each contribution, and when the market falls. It describes; it does not recommend assets. */
function renderHow(R0){
  const a=R0.args,m50=lastNeed?lastNeed.μηνιαία_για_50_στα_100:null,tol=+plan.tol||30;
  const st=D&&D.hold.length?stressCalc(D,'all'):null,dd=st?Math.max(0,-st.pct)*100:null;
  const goalLine=!(a.goal>0)?'':m50==null?' Με αυτά τα χρόνια ο στόχος δεν πιάνεται στα μισά σενάρια όσο κι αν ανέβει η καταβολή: δες τα χρόνια ή τον στόχο.'
    :m50<=a.monthly?' Με αυτή την καταβολή ο στόχος πιάνεται ήδη τουλάχιστον στα μισά σενάρια.':` Για να πιάνεται ο στόχος στα μισά σενάρια χρειάζονται περίπου <b class="num">${eur.format(m50)}</b> τον μήνα.`;
  $('planHow').innerHTML=`<h3 class="sub">Πώς το δουλεύεις</h3>
   <p class="howlead">Με <b class="num">${eur.format(a.monthly)}</b> τον μήνα για <b>${a.years} χρόνια</b>, το μεσαίο σενάριο δίνει <b class="num">${eur.format(R0.last.p50)}</b>${a.goal>0?` και ο στόχος των <span class="num">${eur.format(a.goal)}</span> πιάνεται σε <b class="num">${Math.round(R0.hit*100)} από τα 100</b> σενάρια`:''}.</p>
   <ol class="how">
    <li><b>Κάθε μήνα</b> βάζεις <span class="num">${eur.format(a.monthly)}</span>.${goalLine}</li>
    <li><b>Πριν από κάθε καταβολή</b> βλέπεις πώς αλλάζει η κατανομή και η έκθεσή σου με κάθε επιλογή. <button class="lnk" type="button" data-h="next">Έλεγχος νέας καταβολής</button></li>
    <li><b>Μετά από κάθε αγορά</b> την καταγράφεις, για να μένουν σωστά η αξία και η απόδοση. <button class="lnk" type="button" data-h="tx">+ Συναλλαγή</button></li>
    <li><b>Όταν η αγορά πέφτει</b> θυμάσαι το όριο που δήλωσες: έως <span class="num">−${tol}%</span>.${dd!=null?` Στο σενάριο «Όλα μαζί» το σημερινό χαρτοφυλάκιο πέφτει περίπου <span class="num">${nf(0).format(dd)}%</span>, ${dd<=tol?'μέσα στο όριό σου':'πάνω από το όριό σου'}.`:''} <button class="lnk" type="button" data-h="risk">Σενάρια πτώσης</button></li>
    <li><b>Μία φορά τον χρόνο</b> ξαναβλέπεις στόχο, καταβολή και χρόνια, και κρατάς αντίγραφο ασφαλείας.</li>
   </ol>`;
}
function drawProj(R0,RB){
  const svg=$('projChart'),box=$('projBox');const cw=Math.max(280,box.clientWidth),ch=cw<560?220:260;
  svg.setAttribute('viewBox',`0 0 ${cw} ${ch}`);svg.setAttribute('height',ch);
  const P={l:cw<560?46:58,r:12,t:14,b:24},B=R0.band,goal=R0.args.goal;
  const Y=Math.max(R0.args.years,RB?RB.args.years:0);
  const mx=Math.max(B[B.length-1].p90,RB?RB.band[RB.band.length-1].p50*1.05:0,goal*1.05,1);const T=nice(0,mx,4);
  const x=y=>P.l+y/Y*(cw-P.l-P.r),yy=v=>P.t+(1-(v-T.lo)/(T.hi-T.lo))*(ch-P.t-P.b);
  const fm=v=>v>=1e6?nf(1).format(v/1e6)+'M':v>=1000?nf(0).format(v/1000)+'k':nf(0).format(v);
  let g='';T.t.forEach(v=>g+=`<line x1="${P.l}" x2="${cw-P.r}" y1="${yy(v)}" y2="${yy(v)}" stroke="${css('--line')}"/><text x="${P.l-8}" y="${yy(v)+4}" text-anchor="end">${fm(v)}</text>`);
  const step=Y<=10?1:Y<=20?5:10;for(let y=0;y<=Y;y+=step)g+=`<text x="${x(y)}" y="${ch-6}" text-anchor="${y===0?'start':'middle'}">${y===0?'σήμερα':y+'ε'}</text>`;
  const pth=(Bd,k)=>Bd.map((b,i)=>(i?'L':'M')+x(b.y).toFixed(1)+','+yy(b[k]).toFixed(1)).join('');
  g+=`<path d="${pth(B,'p90')}L${B.slice().reverse().map(b=>x(b.y).toFixed(1)+','+yy(b.p10).toFixed(1)).join('L')}Z" fill="${css('--accent')}" fill-opacity=".16" stroke="none"/>`;
  g+=`<path d="${pth(B,'contrib')}" fill="none" stroke="${css('--invest')}" stroke-width="1.6" stroke-dasharray="4 4"/>`;
  if(RB)g+=`<path d="${pth(RB.band,'p50')}" fill="none" stroke="${css('--c-stock')}" stroke-width="2" stroke-dasharray="7 3"/><circle cx="${x(RB.args.years)}" cy="${yy(RB.last.p50)}" r="4" fill="${css('--c-stock')}" stroke="${css('--surface')}" stroke-width="2"/>`;
  g+=`<path d="${pth(B,'p50')}" fill="none" stroke="${css('--accent')}" stroke-width="2.4"/>`;
  if(goal>0){g+=`<line x1="${P.l}" x2="${cw-P.r}" y1="${yy(goal)}" y2="${yy(goal)}" stroke="${css('--bench')}" stroke-width="1.4" stroke-dasharray="6 3"/><text x="${P.l+6}" y="${yy(goal)-5}" style="fill:var(--bench)">στόχος</text>`}
  g+=`<circle cx="${x(R0.args.years)}" cy="${yy(R0.last.p50)}" r="4.5" fill="${css('--accent')}" stroke="${css('--surface')}" stroke-width="2"/>`;
  svg.innerHTML=g;
  $('projLegend').innerHTML=`<span><i style="background:${css('--accent')}"></i>Μεσαίο σενάριο</span><span><i style="background:${css('--accent')};opacity:.3;height:8px"></i>Εύρος 8 στα 10 σενάρια</span><span><i style="background:${css('--invest')}"></i>Δικά σου χρήματα</span><span><i style="background:${css('--bench')}"></i>Στόχος</span>${RB?`<span><i style="background:${css('--c-stock')}"></i>Πλάνο Β, μεσαίο σενάριο</span>`:''}`;
}
function splitHtml(L){
  const gr=L.p50-L.contrib,tot=L.contrib+Math.max(0,gr)||1;
  return `<div class="split" aria-hidden="true"><b style="width:${L.contrib/tot*100}%;background:var(--invest)"></b><b style="width:${Math.max(0,gr)/tot*100}%;background:var(--accent)"></b></div>
   <div class="splitl"><span><i class="dot" style="background:var(--invest)"></i>Σημερινή αξία και καταβολές <b class="num">${eur.format(L.contrib)}</b></span><span><i class="dot" style="background:var(--accent)"></i>Υποθετική ανάπτυξη στο μεσαίο σενάριο <b class="num ${sgn(gr)}">${(gr>0?'+':'')+eur.format(gr)}</b></span></div>`;
}
function solveMonthly(frac,o={}){
  const run=m=>planRun({...o,monthly:m}).hit;
  if(run(0)>=frac)return 0;
  let lo=0,hi=Math.max(500,(+(o.goal??plan.goal)||0)/120),it=0;
  while(run(hi)<frac&&it<8){lo=hi;hi*=2;it++}
  if(run(hi)<frac)return null;
  for(let i=0;i<16;i++){const m=(lo+hi)/2;run(m)>=frac?hi=m:lo=m}
  return Math.ceil(hi/10)*10;
}
function yearsToGoal(frac,o={}){const r=planRun({...o,years:50});const y=r.hitY.findIndex(h=>h>=frac);return y<0?null:y}
function renderNeed(R0){
  const box=$('needBox'),a=R0.args;
  if(!(a.goal>0)){box.innerHTML='<p class="muted small" style="margin:0">Όρισε έναν στόχο σε ευρώ για να δεις τι χρειάζεται.</p>';return null}
  const m50=solveMonthly(.5),m75=solveMonthly(.75),y50=yearsToGoal(.5);
  const rel=m=>m==null?'Δεν φτάνει ούτε με πολλαπλάσια καταβολή μέσα σε αυτά τα χρόνια.':m<=a.monthly?`Η σημερινή καταβολή (${eur.format(a.monthly)}) αρκεί ήδη.`:`${eur.format(m-a.monthly)} τον μήνα περισσότερα από τη σημερινή καταβολή.`;
  const line=(lbl,v,sub)=>`<div class="need"><span>${lbl}</span><b class="num">${v}</b><small>${sub}</small></div>`;
  box.innerHTML=`<div class="needs">
    ${line('Καταβολή για τον στόχο στα μισά σενάρια',m50==null?'—':eur.format(m50)+' /μήνα',rel(m50))}
    ${line('Καταβολή για τον στόχο σε 3 στα 4 σενάρια',m75==null?'—':eur.format(m75)+' /μήνα',rel(m75))}
    ${line('Χρόνια με τη σημερινή καταβολή (μισά σενάρια)',y50==null?'πάνω από 50':y50+' χρόνια',y50==null?'Με αυτή την καταβολή ο στόχος δεν πιάνεται στα μισά σενάρια μέσα σε 50 χρόνια.':y50<=a.years?`Μέσα στον ορίζοντα των ${a.years} ετών που έβαλες.`:`${y50-a.years} χρόνια μετά τον ορίζοντα που έβαλες.`)}
  </div>
  <p class="assume" style="margin-top:8px">Ίδιες εκτιμήσεις και ίδιες πορείες με την προβολή. Δείχνει ποιες μεταβλητές κάνουν τον στόχο πιο ή λιγότερο εφικτό. Δεν υπόσχεται ότι θα επιτευχθεί.</p>`;
  return {μηνιαία_για_50_στα_100:m50,μηνιαία_για_75_στα_100:m75,χρόνια_για_50_στα_100_με_σημερινή_καταβολή:y50};
}
function renderTol(R0){
  const box=$('tolBox'),tol=(+plan.tol||30)/100,base=D?D.end:0;
  const it=[];
  if(D&&D.hold.length){const s=stressCalc(D,'all');it.push({l:'Σενάριο «Όλα μαζί» στο σημερινό χαρτοφυλάκιο',dd:Math.max(0,-s.pct),e:s.tot});
    if(!D.short)it.push({l:'Η χειρότερη πτώση που έχει ήδη περάσει',dd:Math.max(0,-D.mdd),e:null})}
  const sh=PK.reduce((s,k)=>s+R0.w[k]*CSHOCK[k],0);
  it.push({l:targetValid()?'Το ίδιο σενάριο στην κατανομή-στόχο σου':'Το ίδιο σενάριο στην κατανομή του πλάνου',dd:Math.max(0,-sh),e:sh*base});
  const mx=Math.max(.6,tol*1.25,...it.map(x=>x.dd*1.1));
  const over=it.filter(x=>x.dd>tol).length;
  box.innerHTML=`<p class="small" style="margin:0 0 8px">Δήλωσες ότι αντέχεις πτώση έως <b class="num">−${nf(0).format(tol*100)}%</b>${base?`, δηλαδή περίπου <b class="num neg">−${eur.format(base*tol)}</b> με τη σημερινή αξία`:''}.</p>`+
   it.map(x=>`<div class="tolrow"><span>${x.l}</span><span class="num neg" style="text-align:right">−${nf(0).format(x.dd*100)}%</span><span class="pill ${x.dd>tol?'over':'ok'}">${x.dd>tol?'πάνω από το όριο':'μέσα στο όριο'}</span><span class="tr"><b class="${x.dd>tol?'':'in'}" style="width:${x.dd/mx*100}%"></b><i style="left:calc(${tol/mx*100}% - 1px)"></i></span></div>`).join('')+
   `<p class="assume" style="margin-top:8px">${over?`Σε ${over} από τα ${it.length} μέτρα η πτώση ξεπερνά αυτό που δήλωσες. Αν συμβεί κάτι τέτοιο, το πιθανότερο ρίσκο είναι να πουλήσεις μέσα στην κρίση και να κλειδώσεις τη ζημιά.`:'Όλα τα μέτρα είναι μέσα στο όριο που δήλωσες.'} Η γραμμή δείχνει το όριό σου. Η εφαρμογή δεν προτείνει αλλαγή κατανομής.</p>`;
}
function bArgs(){if(!plan.b)plan.b={monthly:(+plan.monthly||0)+50,years:+plan.years||15,fee:+plan.fee||0,ass:plan.ass};return plan.b}
function renderPlanB(R0){
  const b=bArgs();const set=(id,v)=>{const el=$(id);if(document.activeElement!==el)el.value=v};
  set('bMonthly',b.monthly);set('bYears',b.years);set('bFee',b.fee);set('bAss',b.ass);$('bShow').checked=plan.bShow!==false;
  const RB=planRun({monthly:b.monthly,years:b.years,fee:b.fee,ass:b.ass});
  const A=R0,Bp=RB,diff=(f,fmt)=>{const d=f(Bp)-f(A);return `<span class="num ${sgn(d)}">${Math.abs(d)>1e-9?(d>0?'+':'−')+fmt(Math.abs(d)):'—'}</span>`};
  const rows=[
    ['Μηνιαία καταβολή',r=>r.args.monthly,eur.format],
    ['Χρόνια',r=>r.args.years,v=>nf(0).format(v)],
    ['Ετήσια έξοδα',r=>r.args.fee*100,v=>nf(1).format(v)+'%'],
    ['Δικά σου χρήματα',r=>r.last.contrib,eur.format],
    ['Μεσαίο σενάριο',r=>r.last.p50,eur.format],
    ['Δυσμενές (1 στα 10)',r=>r.last.p10,eur.format],
    ['Ευνοϊκό (1 στα 10)',r=>r.last.p90,eur.format],
    ['Σενάρια με στόχο',r=>Math.round(r.hit*100),v=>v+'/100']];
  $('planBTable').innerHTML=`<thead><tr><th></th><th>Α (σημερινό)</th><th>Β</th><th>Β − Α</th></tr></thead><tbody>`+
    rows.map(([n,f,fmt])=>`<tr><td>${n}</td><td class="num">${fmt(f(A))}</td><td class="num">${fmt(f(Bp))}</td><td>${diff(f,fmt)}</td></tr>`).join('')+
    `<tr><td>Εκτιμήσεις</td><td>${ASSN[plan.ass]}</td><td>${ASSN[b.ass]}</td><td></td></tr></tbody>`;
  return RB;
}
function renderTarget(){
  const box=$('targetBox'),w=toW(curAlloc(D));
  if(!plan.target){box.innerHTML='<div class="muted small">Πρόσθεσε θέσεις για να οριστεί η κατανομή.</div>';targetBuilt=false;return}
  if(!targetBuilt){box.innerHTML=`<div class="trow muted small"><span></span><span>σήμερα (μπάρα) · στόχος (γραμμή)</span><span style="text-align:right">στόχος</span><span style="text-align:right">σήμερα</span></div>`+
    PK.map(k=>`<div class="trow"><span>${PC[k].n}</span><span class="tbars"><b id="tb_${k}" style="background:${PC[k].c}"></b><i id="tm_${k}"></i></span><input id="tg_${k}" data-t="${k}" type="number" min="0" max="100" step="5" inputmode="numeric" aria-label="Στόχος ${PC[k].n} %"><span class="num" id="tc_${k}" style="text-align:right"></span></div>`).join('')+
    `<div class="tsum" id="tsum"></div>`;targetBuilt=true}
  PK.forEach(k=>{$('tb_'+k).style.width=(w[k]*100)+'%';$('tm_'+k).style.left=`calc(${Math.min(100,+plan.target[k]||0)}% - 1px)`;
    const el=$('tg_'+k);if(document.activeElement!==el)el.value=plan.target[k];$('tc_'+k).textContent=nf(0).format(w[k]*100)+'%'});
  const s=targetSum();$('tsum').innerHTML=targetValid()?`<span class="muted">Σύνολο 100%. Η προβολή χρησιμοποιεί αυτή την κατανομή.</span>`:`<span class="neg">Σύνολο ${nf(0).format(s)}%. Χρειάζεται 100% για να χρησιμοποιηθεί. Μέχρι τότε η προβολή χρησιμοποιεί τη σημερινή κατανομή.</span>`;
}
function renderNext(){
  const t=$('nextTable');if(!D||!D.hold.length){t.innerHTML='';return}
  const amt=Math.max(0,+plan.next||0),rows=nextRows(amt);
  const ab={eq:'Μετ.',crypto:'Crypto',cash:'Κατ.',other:'Άλλα'};
  t.innerHTML=`<thead><tr><th>Πού πάει η καταβολή</th><th>Νέα κατανομή</th><th>Απόσταση από στόχο</th><th>«Όλα μαζί» σενάριο</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${r.label}</td><td class="num small">${PK.filter(k=>r.w[k]>.005).map(k=>ab[k]+' '+nf(0).format(r.w[k]*100)+'%').join(' · ')}</td><td class="num">${r.dev==null?'—':nf(0).format(r.dev)+' μον.'}</td><td class="num neg">${eur.format(r.st)} <span class="small">(${pct(r.stp,0)})</span></td></tr>`).join('')+'</tbody>';
}
function renderReserve(){
  const out=$('reserveOut'),n=k=>plan[k]===''||plan[k]==null?null:+plan[k];
  const inc=n('inc'),vr=n('vr')||0,exp=n('exp'),debt=n('debt')||0,res=n('res'),mo=+plan.monthly||0;
  if(!(exp>0)||res==null){out.innerHTML='<p class="muted small" style="margin:12px 0 0">Συμπλήρωσε τουλάχιστον βασικά έξοδα και αποθεματικό. Με το εισόδημα βλέπεις και πόσα περισσεύουν για επένδυση.</p>';return null}
  const need=exp+debt,months=res/need,R={μήνες_κάλυψης:Math.round(months*10)/10};
  let k=`<div class="resk"><div><span class="v num">${nf(1).format(months)}</span><span class="l">μήνες βασικών υποχρεώσεων καλύπτει το αποθεματικό</span></div>`;
  const ck=[];
  ck.push(months>=3?['good',`Αποθεματικό ${nf(1).format(months)} μηνών`,'Συνήθως αναφέρεται αποθεματικό 3–6 μηνών βασικών υποχρεώσεων πριν από επενδύσεις με κίνδυνο. Το δικό σου είναι '+(months<=6?'μέσα σε αυτό το εύρος.':'πάνω από αυτό το εύρος.')]
    :[months<1?'bad':'warn',`Αποθεματικό κάτω από 3 μήνες`,`Συνήθως αναφέρεται αποθεματικό 3–6 μηνών βασικών υποχρεώσεων πριν από επενδύσεις με κίνδυνο. Το δικό σου καλύπτει ${nf(1).format(months)}.`]);
  if(inc!=null){
    const sur=inc-need;R.περίσσευμα_σταθερό=Math.round(sur);R.περίσσευμα_με_ασταθές=Math.round(sur+vr);
    k+=`<div><span class="v num ${sgn(sur)}">${eur.format(sur)}</span><span class="l">περισσεύουν τον μήνα από το σταθερό εισόδημα</span></div><div><span class="v num">${sur>0?nf(0).format(mo/sur*100)+'%':'—'}</span><span class="l">του περισσεύματος είναι η καταβολή των ${eur.format(mo)}</span></div>`;
    const plus=sur-(mo+50);
    if(mo<=sur)ck.push(['good','Η καταβολή χωράει στο σταθερό εισόδημα',`Μετά την καταβολή μένουν ${eur.format(sur-mo)} τον μήνα. Με +50 € καταβολή θα έμεναν ${eur.format(plus)}.`]);
    else if(mo<=sur+vr)ck.push(['warn','Η καταβολή στηρίζεται εν μέρει στο ασταθές εισόδημα',`Σε μήνα χωρίς ασταθές εισόδημα λείπουν ${eur.format(mo-sur)}, που θα έβγαιναν από το αποθεματικό ή θα σήμαιναν μικρότερη καταβολή.`]);
    else{const gap=mo-(sur+vr);ck.push(['bad','Η καταβολή ξεπερνά όσα περισσεύουν',`Λείπουν περίπου ${eur.format(gap)} τον μήνα. Αν έβγαιναν από το αποθεματικό, θα κρατούσε περίπου ${nf(0).format(res/gap)} μήνες.`])}
    const short=Math.max(0,need-.7*inc);
    if(!short)ck.push(['good','Πτώση εισοδήματος 30% για 6 μήνες','Ακόμα και τότε το σταθερό εισόδημα καλύπτει τις βασικές υποχρεώσεις, αν σταματήσουν οι καταβολές.']);
    else{const after=res-6*short;ck.push([after>=0?'warn':'bad','Πτώση εισοδήματος 30% για 6 μήνες',after>=0?`Με σταματημένες καταβολές, θα έλειπαν ${eur.format(short)} τον μήνα και το αποθεματικό θα έπεφτε στα ${eur.format(after)}.`:`Με σταματημένες καταβολές, θα έλειπαν ${eur.format(short)} τον μήνα. Το αποθεματικό θα τελείωνε σε περίπου ${nf(1).format(res/short)} μήνες.`]);R.πτώση_εισοδήματος_30_6μήνες_αποθεματικό_μετά=Math.round(after)}
  }
  const ex=2000,after2=res-ex;
  ck.push([after2/need>=3?'good':after2>=0?'warn':'bad','Έκτακτο έξοδο 2.000 €',after2>=0?`Το αποθεματικό θα έπεφτε στα ${eur.format(after2)}, δηλαδή ${nf(1).format(after2/need)} μήνες κάλυψης.`:`Το αποθεματικό δεν φτάνει. Θα έλειπαν ${eur.format(-after2)}, που θα έπρεπε να βγουν από τις επενδύσεις.`]);
  if(D&&D.hold.length){const loss=stressCalc(D,'all').tot;ck.push(['warn','Αν χρειαστείς χρήματα μέσα σε κρίση',`Στο σενάριο «Όλα μαζί» το χαρτοφυλάκιο θα είχε χάσει περίπου ${eur.format(Math.abs(loss))}. Ό,τι ξεπερνά το αποθεματικό θα έβγαινε πουλώντας σε χαμηλές τιμές.`])}
  k+='</div>';
  out.innerHTML=`<div class="res">${k}<div class="ckl">${ck.map(([l,t,d])=>`<div class="ck" data-l="${l}"><b>${t}</b><span>${d}</span></div>`).join('')}</div>
    <p class="assume">Η εφαρμογή δεν σου λέει πόσα να επενδύεις. Δείχνει πόσο αντέχει το πλάνο σου σε δυσκολίες, με τα ποσά που έβαλες. Τα ασταθή εισοδήματα δεν μετρούν ως βέβαια.</p></div>`;
  return R;
}
function onPlanInput(e){
  const el=e.target,map={pGoal:'goal',pMonthly:'monthly',pYears:'years',pFee:'fee',pAss:'ass',pReal:'real',pTol:'tol',nAmt:'next',rExp:'exp',rRes:'res',rInc:'inc',rVar:'vr',rDebt:'debt'};
  const bmap={bMonthly:'monthly',bYears:'years',bFee:'fee',bAss:'ass'},str=['ass','real','tol','exp','res','inc','vr','debt'];
  if(map[el.id]){const k=map[el.id];plan[k]=str.includes(k)?el.value:(el.value===''?0:+el.value)}
  else if(bmap[el.id]){const k=bmap[el.id];plan.b={...bArgs(),[k]:k==='ass'?el.value:(el.value===''?0:+el.value)}}
  else if(el.id==='bShow')plan.bShow=el.checked;
  else if(el.dataset.t)plan.target={...plan.target,[el.dataset.t]:el.value===''?0:+el.value};
  else return;
  savePlan();clearTimeout(planT);planT=setTimeout(()=>renderPlan(D),140);
}
document.querySelector('.plan').addEventListener('input',onPlanInput);
document.querySelector('.plan').addEventListener('change',onPlanInput);
let planT;
