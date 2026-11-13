/* ---------- CSV import: Binance, Kraken, Coinbase, Trading 212 and any broker file ----------
   Reads the exchange's own export, turns every row into a Vestora transaction in euros, matches assets
   (ISIN, ticker, remembered choices), flags duplicates, and lets the user edit everything before saving.
   Written in both languages side by side with T(greek, english); not passed through the i18n extractor. */
const CX={rows:[],src:'',file:'',notes:[],undo:null,shown:150};
const STABLES=new Set(['USDT','USDC','BUSD','FDUSD','TUSD','DAI','USDP','PYUSD','USDE','USDS','USD1','UST']);
const FIAT=new Set(['EUR','USD','GBP','CHF','JPY','CAD','AUD','TRY','PLN','RON','BGN','CZK','SEK','NOK','DKK','HUF','BRL','GBX']);
const KRAKEN_CODE={XBT:'BTC',XXBT:'BTC',XETH:'ETH',XXDG:'DOGE',XDG:'DOGE',XXRP:'XRP',XLTC:'LTC',XXLM:'XLM',XETC:'ETC',XXMR:'XMR',XZEC:'ZEC',ZEUR:'EUR',ZUSD:'USD',ZGBP:'GBP',ZCAD:'CAD',ZJPY:'JPY',ZCHF:'CHF'};
const cxKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ς/g,'σ').replace(/[^\p{L}\p{N}]/gu,'');

/* --- CSV text → rows --- */
function cxParse(text){
  text=String(text).replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  const sample=text.split('\n').slice(0,40).join('\n');
  const cnt=d=>{let n=0,q=false;for(const ch of sample){if(ch==='"')q=!q;else if(!q&&ch===d)n++}return n};
  const delim=[',',';','\t'].sort((a,b)=>cnt(b)-cnt(a))[0];
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;
    else if(ch===delim){row.push(cell);cell=''}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=ch}
  if(cell||row.length){row.push(cell);rows.push(row)}
  return {rows:rows.filter(r=>r.some(c=>c.trim()!=='')),delim};
}
/* numbers as exchanges write them: 1,234.56 · 1.234,56 · 0.5BTC · $12.30 · -€5 */
function cxNum(s,delim){
  if(s==null)return NaN;if(typeof s==='number')return s;
  let t=String(s).trim().replace(/\s/g,'');if(!t)return NaN;
  const neg=/^-|^\(.*\)$|-$/.test(t);t=t.replace(/[^0-9.,eE+-]/g,'').replace(/^[+-]/,'').replace(/-$/,'');
  if(/[eE]/.test(t)&&!/[,]/.test(t)){const v=parseFloat(t);return neg?-Math.abs(v):v}
  const c=t.lastIndexOf(','),d=t.lastIndexOf('.');
  if(c>-1&&d>-1)t=c>d?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
  else if(c>-1){const after=t.length-c-1;t=(t.split(',').length===2&&(after!==3||delim===';'))?t.replace(',','.'):t.replace(/,/g,'')}
  const v=parseFloat(t);return neg?-Math.abs(v):v;
}
const cxUnit=s=>{const m=String(s||'').trim().match(/[A-Za-z][A-Za-z0-9]*$/);return m?m[0].toUpperCase():''};
/* dates: ISO, unix seconds, DD/MM/YYYY or MM/DD/YYYY (decided per file), DD.MM.YYYY, YY-MM-DD */
function cxDateOrder(vals){let dm=0,md=0;for(const v of vals){const m=String(v).match(/^\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(!m)continue;if(+m[1]>12)dm++;if(+m[2]>12)md++}return md>dm?'md':'dm'}
function cxDate(v,order){
  const s=String(v||'').trim();if(!s)return '';
  if(/^\d{9,10}(\.\d+)?$/.test(s))return new Date(+s*1000).toISOString().slice(0,10);
  if(/^\d{12,13}$/.test(s))return new Date(+s).toISOString().slice(0,10);
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m=s.match(/^(\d{2})-(\d{2})-(\d{2})\s/);if(m)return `20${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if(m){const y=m[3].length===2?'20'+m[3]:m[3],a=order==='md'?m[2]:m[1],b=order==='md'?m[1]:m[2];return `${y}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`}
  const t=Date.parse(s);return isNaN(t)?'':new Date(t).toISOString().slice(0,10);
}

/* --- money into euros on the transaction's date --- */
function cxWeekFx(date){const ws=DATA?.eurusd;if(!ws||!date)return FXL;const w=Math.floor((Date.parse(date)-START)/(7*DAY));return w>=ws.length||w<0?(w<0?ws[0]:FXL):ws[w]||FXL}
function cxEur(amount,cur,date){
  cur=String(cur||'EUR').toUpperCase();if(!isFinite(amount))return null;
  if(cur==='EUR')return amount;
  if(cur==='USD'||STABLES.has(cur))return amount/cxWeekFx(date);
  const id=cxAsset({sym:cur},true);
  if(id&&PRICES[id]&&date){const p=PRICES[id][toWeek(date)];if(p>0)return amount*p}
  return null;
}

/* --- asset matching: remembered choice → ISIN → ticker → custom with that symbol --- */
function cxAsset(r,quiet){
  const sym=String(r.sym||'').toUpperCase().trim(),isin=String(r.isin||'').toUpperCase().trim();
  const mem=state.csvMap||{};
  if(isin&&mem['isin:'+isin]&&(ASSETS[mem['isin:'+isin]]||state.custom[mem['isin:'+isin]]))return mem['isin:'+isin];
  if(sym&&mem[sym]&&(ASSETS[mem[sym]]||state.custom[mem[sym]]))return mem[sym];
  const DA=DATA?.assets||{};
  if(isin)for(const [k,d] of Object.entries(DA))if(ASSETS[k]&&String(d.isin||'').toUpperCase()===isin)return k;
  if(sym){
    if(ASSETS[sym]&&sym!=='DEP')return sym;
    for(const [k,d] of Object.entries(DA)){if(!ASSETS[k])continue;const y=String(d.y||'').toUpperCase();if(y===sym||y.split('.')[0]===sym&&(r.cls!=='crypto'))return k}
    for(const [k,c] of Object.entries(state.custom))if(String(c.sym||'').toUpperCase()===sym)return k;
  }
  return null;
}

/* --- readers: each returns normalized rows {date,type,sym,isin,name,qty,price,priceCur,fee,feeCur,total,totalCur,ext,note,cls} --- */
const H=(hdr,...names)=>{const ks=hdr.map(cxKey);for(const n of names){const i=ks.indexOf(cxKey(n));if(i>-1)return i}return -1};
const has=(hdr,...names)=>names.every(n=>H(hdr,n)>-1);
function splitPair(pair,base){
  const p=String(pair||'').toUpperCase().replace(/[-_ ]/g,'/');
  if(p.includes('/')){const [a,b]=p.split('/');return [a,b]}
  if(base&&p.startsWith(base))return [base,p.slice(base.length)];
  for(const q of ['FDUSD','USDT','USDC','BUSD','TUSD','EUR','USD','BTC','ETH','BNB','TRY','GBP','DAI'])if(p.endsWith(q)&&p.length>q.length)return [p.slice(0,-q.length),q];
  return [p,''];
}
const READERS=[
 {id:'binance-trades',name:'Binance (Trade History)',test:h=>has(h,'Date(UTC)','Pair')&&(H(h,'Side')>-1||H(h,'Type')>-1),
  read(rows,h,ctx){const iD=H(h,'Date(UTC)'),iP=H(h,'Pair'),iB=H(h,'Base Asset'),iQ=H(h,'Quote Asset'),iS=H(h,'Side')>-1?H(h,'Side'):H(h,'Type'),iPr=H(h,'Price'),
    iEx=H(h,'Executed'),iAm=H(h,'Amount'),iT=H(h,'Total'),iF=H(h,'Fee'),iFC=H(h,'Fee Coin');
    return rows.map(r=>{const execCol=iEx>-1?iEx:iAm,qtyRaw=r[execCol],base0=iB>-1?r[iB].toUpperCase():cxUnit(qtyRaw);
      const [base,quote0]=splitPair(r[iP],base0),quote=iQ>-1?r[iQ].toUpperCase():(cxUnit(iEx>-1?r[iAm]:r[iT])||quote0);
      const qty=cxNum(qtyRaw,ctx.delim),price=cxNum(r[iPr],ctx.delim),total=cxNum(iEx>-1?r[iAm]:(iT>-1?r[iT]:''),ctx.delim);
      return {date:cxDate(r[iD],ctx.order),type:/sell/i.test(r[iS])?'sell':'buy',sym:base,qty,price,priceCur:quote,total:isFinite(total)?total:qty*price,totalCur:quote,
        fee:cxNum(r[iF],ctx.delim)||0,feeCur:iFC>-1?r[iFC].toUpperCase():(cxUnit(r[iF])||quote),cls:'crypto'}})}},
 {id:'binance-statement',name:'Binance (Transaction History)',test:h=>has(h,'UTC_Time','Operation','Coin','Change'),
  read(rows,h,ctx){const iT=H(h,'UTC_Time'),iO=H(h,'Operation'),iC=H(h,'Coin'),iCh=H(h,'Change'),iA=H(h,'Account');
    const REWARD=/interest|reward|staking|distribution|airdrop|launchpool|cashback|commission rebate|savings|earn/i,TRADE=/buy|sell|spend|convert|small assets|transaction|fee|exchange/i;
    const groups=new Map(),out=[];
    for(const r of rows){const op=r[iO]||'',coin=(r[iC]||'').toUpperCase(),ch=cxNum(r[iCh],ctx.delim),t=r[iT];if(!isFinite(ch)||!coin)continue;
      if(REWARD.test(op)&&ch>0&&!/redemption|subscription/i.test(op)){out.push({date:cxDate(t,ctx.order),type:'reward',sym:coin,qty:ch,price:0,priceCur:'EUR',cls:'crypto',note:op});continue}
      if(!TRADE.test(op))continue;const key=t+'|'+(iA>-1?r[iA]:'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({op,coin,ch})}
    for(const [key,g] of groups){const date=cxDate(key.split('|')[0],ctx.order),sum={};let fee=null;
      for(const x of g){if(/fee/i.test(x.op)){fee={coin:x.coin,amt:Math.abs(x.ch)};continue}sum[x.coin]=(sum[x.coin]||0)+x.ch}
      const plus=Object.entries(sum).filter(([,v])=>v>0),minus=Object.entries(sum).filter(([,v])=>v<0);
      if(plus.length!==1||minus.length!==1){if(plus.length||minus.length)out.push({date,type:'skip',sym:Object.keys(sum).join('/'),qty:0,price:0,note:T('Σύνθετη κίνηση, δεν αναγνωρίστηκε','Complex movement, not recognised')});continue}
      const [[got,gq]]=plus,[[gave,ga]]=minus,giveCash=FIAT.has(gave)||STABLES.has(gave),getCash=FIAT.has(got)||STABLES.has(got);
      if(getCash&&!giveCash)out.push({date,type:'sell',sym:gave,qty:-ga,price:gq/-ga,priceCur:got,fee:fee?.amt||0,feeCur:fee?.coin||got,cls:'crypto'});
      else out.push({date,type:'buy',sym:got,qty:gq,price:-ga/gq,priceCur:gave,fee:fee?.amt||0,feeCur:fee?.coin||gave,cls:'crypto'});}
    return out}},
 {id:'kraken-trades',name:'Kraken (Trades)',test:h=>has(h,'txid','pair','vol','cost'),
  read(rows,h,ctx){const iX=H(h,'txid'),iP=H(h,'pair'),iT=H(h,'time'),iTy=H(h,'type'),iPr=H(h,'price'),iC=H(h,'cost'),iF=H(h,'fee'),iV=H(h,'vol');
    return rows.map(r=>{const [b,q]=krakenPair(r[iP]);return {date:cxDate(r[iT],ctx.order),type:/sell/i.test(r[iTy])?'sell':'buy',sym:b,qty:cxNum(r[iV],ctx.delim),
      price:cxNum(r[iPr],ctx.delim),priceCur:q,total:cxNum(r[iC],ctx.delim),totalCur:q,fee:cxNum(r[iF],ctx.delim)||0,feeCur:q,ext:'kraken:'+r[iX],cls:'crypto'}})}},
 {id:'kraken-ledgers',name:'Kraken (Ledgers)',test:h=>has(h,'refid','asset','amount','balance'),
  read(rows,h,ctx){const iR=H(h,'refid'),iT=H(h,'time'),iTy=H(h,'type'),iSu=H(h,'subtype'),iA=H(h,'asset'),iAm=H(h,'amount'),iF=H(h,'fee');
    const g=new Map(),out=[];
    for(const r of rows){const ty=(r[iTy]||'').toLowerCase(),asset=krakenAsset(r[iA]),amt=cxNum(r[iAm],ctx.delim),fee=cxNum(r[iF],ctx.delim)||0,date=cxDate(r[iT],ctx.order);
      if((ty==='staking'||ty==='earn'&&/reward/i.test(r[iSu]||'')||ty==='dividend')&&amt>0){out.push({date,type:'reward',sym:asset,qty:amt-fee,price:0,cls:'crypto',ext:'kraken:'+r[iR]+':'+asset});continue}
      if(!['trade','spend','receive'].includes(ty))continue;if(!g.has(r[iR]))g.set(r[iR],{date,legs:[]});g.get(r[iR]).legs.push({asset,amt,fee})}
    for(const [ref,{date,legs}] of g){const got=legs.find(l=>l.amt>0),gave=legs.find(l=>l.amt<0);if(!got||!gave)continue;
      const getCash=FIAT.has(got.asset)||STABLES.has(got.asset),giveCash=FIAT.has(gave.asset)||STABLES.has(gave.asset);
      if(getCash&&!giveCash)out.push({date,type:'sell',sym:gave.asset,qty:-gave.amt,price:got.amt/-gave.amt,priceCur:got.asset,fee:got.fee+gave.fee*(got.amt/-gave.amt),feeCur:got.asset,ext:'kraken:'+ref,cls:'crypto'});
      else out.push({date,type:'buy',sym:got.asset,qty:got.amt-got.fee,price:-gave.amt/got.amt,priceCur:gave.asset,fee:gave.fee,feeCur:gave.asset,ext:'kraken:'+ref,cls:'crypto'})}
    return out}},
 {id:'coinbase',name:'Coinbase',test:h=>has(h,'Transaction Type','Quantity Transacted'),
  read(rows,h,ctx){const iD=H(h,'Timestamp'),iTy=H(h,'Transaction Type'),iA=H(h,'Asset'),iQ=H(h,'Quantity Transacted'),iId=H(h,'ID'),iN=H(h,'Notes'),
    iPC=H(h,'Price Currency','Spot Price Currency'),iP=H(h,'Price at Transaction','Spot Price at Transaction','USD Spot Price at Transaction'),
    iS=H(h,'Subtotal','USD Subtotal'),iF=H(h,'Fees and/or Spread','Fees','USD Fees');
    const out=[];
    for(const r of rows){const ty=(r[iTy]||'').toLowerCase(),cur=iPC>-1?(r[iPC]||'USD').toUpperCase():'USD',date=cxDate(r[iD],ctx.order),sym=(r[iA]||'').toUpperCase(),qty=Math.abs(cxNum(r[iQ],ctx.delim));
      const price=cxNum(r[iP],ctx.delim),fee=Math.abs(cxNum(r[iF],ctx.delim))||0,ext=iId>-1&&r[iId]?'coinbase:'+r[iId]:'';
      if(/convert/.test(ty)){const m=String(r[iN]||'').match(/converted\s+([\d.,]+)\s+(\S+)\s+to\s+([\d.,]+)\s+(\S+)/i);const sub=Math.abs(cxNum(r[iS],ctx.delim));
        if(m&&sub>0){const q1=cxNum(m[1],','),q2=cxNum(m[3],',');out.push({date,type:'sell',sym:m[2].toUpperCase(),qty:q1,price:sub/q1,priceCur:cur,fee,feeCur:cur,ext:ext&&ext+':a',cls:'crypto'});
          out.push({date,type:'buy',sym:m[4].toUpperCase(),qty:q2,price:sub/q2,priceCur:cur,ext:ext&&ext+':b',cls:'crypto'})}
        else out.push({date,type:'skip',sym,qty,price:0,note:T('Μετατροπή που δεν αναγνωρίστηκε','Conversion not recognised')});continue}
      if(/sell/.test(ty))out.push({date,type:'sell',sym,qty,price,priceCur:cur,fee,feeCur:cur,ext,cls:'crypto'});
      else if(/buy/.test(ty))out.push({date,type:'buy',sym,qty,price,priceCur:cur,fee,feeCur:cur,ext,cls:'crypto'});
      else if(/reward|income|staking|interest|learning|inflation|airdrop/.test(ty))out.push({date,type:'reward',sym,qty,price:0,ext,cls:'crypto',note:r[iTy]});
    }
    return out}},
 {id:'trading212',name:'Trading 212',test:h=>has(h,'Action','No. of shares')&&(H(h,'Price / share')>-1||H(h,'Price per share')>-1),
  read(rows,h,ctx){const iA=H(h,'Action'),iT=H(h,'Time'),iI=H(h,'ISIN'),iTk=H(h,'Ticker'),iN=H(h,'Name'),iQ=H(h,'No. of shares'),iP=H(h,'Price / share','Price per share'),
    iPC=H(h,'Currency (Price / share)'),iX=H(h,'Exchange rate'),iTo=H(h,'Total'),iTC=H(h,'Currency (Total)'),iId=H(h,'ID');
    const totCurFromHdr=(hdr=>{const m=(iTo>-1?h[iTo]:'').match(/\(([A-Z]{3})\)/);return m?m[1]:''})();
    const feeCols=h.map((x,i)=>/fee|stamp duty|tax/i.test(x)&&!/^currency\s*\(/i.test(x)?i:-1).filter(i=>i>-1);
    const out=[];
    for(const r of rows){const a=(r[iA]||'').toLowerCase(),date=cxDate(r[iT],ctx.order),ext=iId>-1&&r[iId]?'t212:'+r[iId]:'';
      const totCur=(iTC>-1&&r[iTC]?r[iTC]:totCurFromHdr||'EUR').toUpperCase(),total=Math.abs(cxNum(r[iTo],ctx.delim));
      const base={date,sym:iTk>-1?r[iTk]:'',isin:iI>-1?r[iI]:'',name:iN>-1?r[iN]:'',ext,cls:'stock'};
      if(/dividend/.test(a)){out.push({...base,type:'div',qty:total,price:1,priceCur:totCur});continue}
      if(!/buy|sell/.test(a))continue;
      const qty=cxNum(r[iQ],ctx.delim),p=cxNum(r[iP],ctx.delim),pc=(iPC>-1&&r[iPC]?r[iPC]:totCur).toUpperCase(),fx=iX>-1?cxNum(r[iX],ctx.delim):NaN;
      const fee=feeCols.reduce((s,i)=>s+(Math.abs(cxNum(r[i],ctx.delim))||0),0);
      const priceAcc=pc===totCur?p:isFinite(fx)&&fx>0?p/fx:NaN;
      out.push({...base,type:/sell/.test(a)?'sell':'buy',qty,price:isFinite(priceAcc)?priceAcc:p,priceCur:isFinite(priceAcc)?totCur:pc,fee,feeCur:totCur})}
    return out}},
];
function krakenAsset(a){a=String(a||'').toUpperCase().replace(/\.(S|M|F|B|P)$/,'').replace(/\d+\.S$/,'');if(KRAKEN_CODE[a])return KRAKEN_CODE[a];if(a.length===4&&/^[XZ]/.test(a)&&!['ZEC','ZRX'].includes(a.slice(1)))return KRAKEN_CODE[a.slice(1)]||a.slice(1);return a}
function krakenPair(p){p=String(p||'').toUpperCase();if(p.includes('/')){const [a,b]=p.split('/');return [krakenAsset(a),krakenAsset(b)]}
  for(const q of ['ZEUR','ZUSD','ZGBP','ZCAD','ZJPY','USDT','USDC','EUR','USD','GBP','XXBT','XBT','XETH','ETH','CHF','DAI'])if(p.endsWith(q)&&p.length>q.length)return [krakenAsset(p.slice(0,-q.length)),krakenAsset(q)];
  return [krakenAsset(p),''];
}

/* generic broker file: columns found by name, the user can change each one */
const GEN_FIELDS=[
 ['date',T('Ημερομηνία','Date'),['date','time','timestamp','tradedate','datetime','executedat','data','ημερομηνια']],
 ['type',T('Αγορά/Πώληση','Buy/Sell'),['type','side','action','direction','transactiontype','buysell','κινηση']],
 ['sym',T('Ticker ή σύμβολο','Ticker or symbol'),['ticker','symbol','asset','coin','instrument','code','product','σύμβολο']],
 ['isin','ISIN',['isin']],
 ['name',T('Όνομα','Name'),['name','instrumentname','securityname','description','ονομα']],
 ['qty',T('Ποσότητα','Quantity'),['quantity','qty','shares','units','amount','noofshares','volume','filled','ποσοτητα','τεμαχια']],
 ['price',T('Τιμή ανά μονάδα','Price per unit'),['price','pricepershare','unitprice','executionprice','avgprice','τιμη']],
 ['priceCur',T('Νόμισμα τιμής','Price currency'),['currency','pricecurrency','ccy','νομισμα']],
 ['fee',T('Προμήθεια','Fee'),['fee','fees','commission','προμηθεια']],
 ['total',T('Σύνολο','Total'),['total','value','netamount','grossamount','σύνολο','αξια']],
];
function genGuess(h){const ks=h.map(cxKey),m={};for(const [f,,names0] of GEN_FIELDS){const names=names0.map(cxKey);let i=ks.findIndex(k=>names.includes(k));if(i<0)i=ks.findIndex(k=>names.some(n=>n.length>3&&k.includes(n)));m[f]=i}
  if(m.price>-1&&m.price===m.total)m.total=-1;return m}
function genRead(rows,h,ctx,map){
  return rows.map(r=>{const g=f=>map[f]>-1?r[map[f]]:'';const ty=g('type').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const qty=Math.abs(cxNum(g('qty'),ctx.delim));let price=cxNum(g('price'),ctx.delim);
    const total=Math.abs(cxNum(g('total'),ctx.delim));if(!(price>0)&&total>0&&qty>0)price=total/qty;
    const type=/sell|πωλ|sale|verkauf|venta|vente/.test(ty)?'sell':/div|μερισ/.test(ty)?'div':/reward|staking|interest|τοκ/.test(ty)?'reward':'buy';
    return {date:cxDate(g('date'),ctx.order),type,sym:g('sym').trim(),isin:g('isin').trim(),name:g('name').trim(),qty:type==='div'?(total||qty*price):qty,price:type==='div'?1:price,
      priceCur:(g('priceCur')||'EUR').trim().toUpperCase().slice(0,5),fee:Math.abs(cxNum(g('fee'),ctx.delim))||0,feeCur:(g('priceCur')||'EUR').trim().toUpperCase().slice(0,5)}});
}

/* --- normalized rows → Vestora transactions (euros), with matching and duplicate checks --- */
function cxBuild(norm,merge){
  let list=norm.filter(r=>r.type!=='skip'||(CX.notes.push(r),false)).map(r=>({...r}));
  /* a trade paid in another crypto (e.g. ETH bought with BTC) also spends that crypto */
  const extra=[];
  for(const r of list){const q=String(r.priceCur||'').toUpperCase();
    if((r.type==='buy'||r.type==='sell')&&q&&!FIAT.has(q)&&!STABLES.has(q)){const tot=isFinite(r.total)&&r.total>0?r.total:r.qty*r.price;
      extra.push({date:r.date,type:r.type==='buy'?'sell':'buy',sym:q,qty:tot,price:NaN,priceCur:'EUR',fee:0,cls:'crypto',ext:r.ext?r.ext+':q':'',note:T('Το νόμισμα πληρωμής της συναλλαγής','The coin used to pay for the trade'),viaQuote:true})}}
  list=list.concat(extra);
  /* stablecoins and fiat bought or sold are cash moves, not investments */
  list=list.filter(r=>{const s=String(r.sym||'').toUpperCase();if(r.type!=='div'&&(STABLES.has(s)||FIAT.has(s))){CX.notes.push({...r,note:T('Stablecoin ή νόμισμα: μετράει ως μετρητά, παραλείπεται','Stablecoin or currency: counts as cash, skipped')});return false}return true});
  const out=list.map(r=>{
    const a=cxAsset(r);let price=null;
    if(r.type==='reward'){price=0}
    else if(r.type==='div'){price=null}
    else if(r.viaQuote){price=a&&PRICES[a]&&r.date?PRICES[a][toWeek(r.date)]:null}
    else price=cxEur(r.price,r.priceCur,r.date);
    /* a fee taken in the coin itself: holdings get the net amount, and the fee's value counts as cost */
    let qty=r.qty,feeAmt=r.fee||0,feeCur=r.feeCur||r.priceCur;
    if(feeAmt&&String(feeCur||'').toUpperCase()===String(r.sym||'').toUpperCase()&&(r.type==='buy'||r.type==='sell')){
      qty=r.type==='buy'?r.qty-feeAmt:r.qty+feeAmt;const fe=price!=null?feeAmt*price:null;feeAmt=0;r._feeEur=fe}
    const fee=r._feeEur!=null?r._feeEur:feeAmt?cxEur(feeAmt,feeCur,r.date):0;
    const divEur=r.type==='div'?cxEur(r.qty,r.priceCur,r.date):null;
    return {on:true,date:r.date,type:r.type,a,sym:String(r.sym||'').toUpperCase(),isin:r.isin||'',name:r.name||'',cls:r.cls,
      qty:r.type==='div'?divEur:qty,price:r.type==='div'?1:price,fee:fee==null?0:fee,feeLost:r.fee>0&&fee==null?r.feeCur:'',ext:r.ext||'',note:r.note||'',srcPrice:r.price,srcCur:r.priceCur};
  });
  let rows=out;
  if(merge){const m=new Map();for(const r of out){if(r.type==='skip')continue;const k=[r.date,r.type,r.a||r.sym,r.isin].join('|');
      if(!m.has(k)){m.set(k,{...r,n:1,ext:r.ext?r.ext:''});continue}const x=m.get(k),q=x.qty+r.qty;
      if(r.type==='buy'||r.type==='sell')x.price=(x.price!=null&&r.price!=null)?(x.price*x.qty+r.price*r.qty)/q:null;
      x.qty=q;x.fee+=r.fee;x.n++;x.ext=x.ext&&r.ext?x.ext+'+':''}
    rows=[...m.values()]}
  for(const r of rows){cxCheck(r);r.on=!r.err&&!r.dup}
  return rows.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
}
function cxCheck(r){
  r.err='';r.dup=false;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date))r.err=T('Λείπει η ημερομηνία','Date missing');
  else if(!(r.qty>0))r.err=T('Λείπει η ποσότητα','Quantity missing');
  else if((r.type==='buy'||r.type==='sell')&&!(r.price>0))r.err=r.srcCur&&!FIAT.has(r.srcCur)&&!STABLES.has(r.srcCur)&&!r.a?T(`Η τιμή είναι σε ${r.srcCur}: αντιστοίχισε πρώτα το ${r.srcCur}`,`The price is in ${r.srcCur}: match ${r.srcCur} first`):T(`Η τιμή σε ${r.srcCur||'?'} δεν μετατρέπεται σε ευρώ: γράψ' την με το χέρι`,`The price in ${r.srcCur||'?'} cannot be converted to euros: type it in`);
  else if(!r.a)r.err=T('Διάλεξε ποιο asset είναι','Choose which asset this is');
  if(!r.err&&r.a){
    const same=state.tx.find(t=>t.a===r.a&&t.date===r.date&&t.type===r.type&&(r.ext&&t.ext===r.ext||Math.abs(t.qty-r.qty)<=Math.max(1e-9,r.qty*1e-6)&&(r.type!=='buy'&&r.type!=='sell'||Math.abs(t.price-r.price)<=r.price*0.01)));
    if(same){r.dup=true}
  }
}

/* --- the dialog --- */
function cxOpen(){
  if(!DATA){toast(T('Περίμενε να φορτώσουν οι τιμές.','Wait for prices to load.'));return}
  CX.rows=[];CX.notes=[];CX.src='';CX.file='';CX.undo=null;CX.gen=false;CX.reader=null;
  let d=$('csvDlg');
  if(!d){d=document.createElement('div');d.id='csvDlg';d.className='cxdlg';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-labelledby','cxTitle');document.body.appendChild(d);
    d.addEventListener('click',cxClick);d.addEventListener('change',cxChange);d.addEventListener('input',cxInput);
    d.addEventListener('keydown',e=>{if(e.key==='Escape')cxClose()})}
  d.hidden=false;document.documentElement.classList.add('cxopen');cxDraw();setTimeout(()=>d.querySelector('.cxx')?.focus(),30);
}
function cxClose(){const d=$('csvDlg');if(d)d.hidden=true;document.documentElement.classList.remove('cxopen')}
const CX_HELP=[
 ['Binance',T('Πορτοφόλι → Orders → Spot Order → Trade History → Export. Ή Wallet → Transaction History → Generate all statements (μαζί με ανταμοιβές Earn).','Orders → Spot Order → Trade History → Export. Or Wallet → Transaction History → Generate all statements (includes Earn rewards).')],
 ['Kraken',T('History → Export → «Trades» (ή «Ledgers» για να μπουν και οι ανταμοιβές staking) → CSV.','History → Export → “Trades” (or “Ledgers” to include staking rewards) → CSV.')],
 ['Coinbase',T('Προφίλ → Statements → Transaction history → Generate report → CSV.','Profile → Statements → Transaction history → Generate report → CSV.')],
 ['Trading 212',T('Ιστορικό → εικονίδιο λήψης → επίλεξε Orders και Dividends → Export CSV.','History → download icon → select Orders and Dividends → Export CSV.')],
 [T('Άλλος broker','Other broker'),T('Οποιοδήποτε CSV με ημερομηνία, σύμβολο ή ISIN, ποσότητα και τιμή. Θα σου δείξουμε ποια στήλη είναι τι, για να το διορθώσεις αν χρειαστεί.','Any CSV with date, symbol or ISIN, quantity and price. We show which column is which, so you can correct it if needed.')],
];
function cxDraw(){
  const d=$('csvDlg');if(!d)return;
  let body='';
  if(CX.undo){body=`<div class="cxdone"><p><b>${T(`Καταχωρήθηκαν ${CX.undo.n} συναλλαγές.`,`${CX.undo.n} transactions added.`)}</b></p><p class="muted small">${T('Αν κάτι δεν σου φαίνεται σωστό, μπορείς να τις αναιρέσεις όλες μαζί.','If something does not look right, you can undo them all at once.')}</p>
      <div class="btns"><button class="btn primary" type="button" data-cx="close">${T('Τέλος','Done')}</button><button class="btn" type="button" data-cx="undo">${T('Αναίρεση εισαγωγής','Undo import')}</button></div></div>`}
  else if(!CX.rows.length&&!CX.gen){body=`<p>${T('Κατέβασε το ιστορικό συναλλαγών από το ανταλλακτήριο ή τον broker σου ως CSV και διάλεξέ το εδώ. Θα δεις όλες τις συναλλαγές πριν καταχωρηθούν, για να τις ελέγξεις και να τις διορθώσεις.','Download your transaction history from your exchange or broker as CSV and pick it here. You will see every transaction before it is saved, to check and correct it.')}</p>
      <label class="btn primary cxfile">${T('Διάλεξε αρχείο CSV','Choose a CSV file')}<input type="file" id="cxFile" accept=".csv,text/csv,text/plain,.tsv,.txt" hidden></label>
      <p class="muted small">${T('Το αρχείο διαβάζεται μόνο μέσα στη συσκευή σου. Δεν ανεβαίνει πουθενά.','The file is read only on your device. It is not uploaded anywhere.')}</p>
      <details class="cxhelp"><summary>${T('Πώς το κατεβάζω;','How do I download it?')}</summary><dl>${CX_HELP.map(([n,t])=>`<dt>${n}</dt><dd>${t}</dd>`).join('')}</dl></details>`}
  else{
    const rows=CX.rows,on=rows.filter(r=>r.on),dups=rows.filter(r=>r.dup).length,errs=rows.filter(r=>r.err).length;
    const unmatched=[...new Set(rows.filter(r=>!r.a&&r.type!=='skip').map(r=>r.isin?'isin:'+r.isin:r.sym).filter(Boolean))];
    body=`<p class="cxsrc"><b>${esc(CX.file)}</b> · ${esc(CX.src)} · ${T(`${rows.length} συναλλαγές`,`${rows.length} transactions`)}${CX.order==='md'?' · '+T('ημερομηνίες μήνας/μέρα','dates month/day'):''}</p>`;
    if(CX.gen)body+=`<details class="cxmap"${CX.genOpen?' open':''}><summary>${T('Ποια στήλη είναι τι','Which column is what')}</summary><div class="cxmapg">${GEN_FIELDS.map(([f,l])=>`<label>${l}<select data-cxmap="${f}"><option value="-1">—</option>${CX.hdr.map((x,i)=>`<option value="${i}"${CX.map[f]===i?' selected':''}>${esc(x||('#'+(i+1)))}</option>`).join('')}</select></label>`).join('')}</div></details>`;
    if(unmatched.length)body+=`<div class="cxun"><h3>${T('Αντιστοίχισε αυτά τα assets','Match these assets')}</h3><p class="muted small">${T('Δεν τα βρήκαμε μόνοι μας. Διάλεξε τι είναι το καθένα· η επιλογή σου θα θυμάται και στις επόμενες εισαγωγές.','We could not find these ourselves. Choose what each one is; your choice is remembered for future imports.')}</p>
      ${unmatched.map((u,i)=>{const r=rows.find(x=>(x.isin?'isin:'+x.isin:x.sym)===u);return `<div class="cxunr"><span class="cxsym">${esc(r.sym||r.isin)}${r.name?` <span class="muted small">${esc(r.name)}</span>`:''}</span><div class="pick cxpick"><input type="search" data-cxu="${esc(u)}" id="cxu${i}" placeholder="${T('Αναζήτηση asset','Search asset')}" autocomplete="off"><div class="plist" id="cxl${i}" role="listbox" hidden></div></div></div>`}).join('')}</div>`;
    body+=`<div class="cxsum"><span>${T(`Θα καταχωρηθούν <b>${on.length}</b>`,`<b>${on.length}</b> will be added`)}</span>${dups?`<span class="cxdupc">${T(`${dups} υπάρχουν ήδη`,`${dups} already exist`)}</span>`:''}${errs?`<span class="neg">${T(`${errs} θέλουν διόρθωση`,`${errs} need fixing`)}</span>`:''}
      <label class="cxmerge"><input type="checkbox" data-cx="merge"${CX.merge?' checked':''}> ${T('Ένωσε τις εκτελέσεις της ίδιας εντολής (ίδια μέρα, ίδιο asset)','Merge fills of the same order (same day, same asset)')}</label></div>
      <div class="cxrows">${rows.slice(0,CX.shown).map((r,i)=>cxRow(r,i)).join('')}</div>
      ${rows.length>CX.shown?`<button class="btn" type="button" data-cx="more">${T(`Δείξε κι άλλες (${rows.length-CX.shown})`,`Show more (${rows.length-CX.shown})`)}</button>`:''}
      ${CX.notes.length?`<details class="cxnotes"><summary>${T(`${CX.notes.length} γραμμές παραλείφθηκαν`,`${CX.notes.length} rows skipped`)}</summary><ul>${CX.notes.slice(0,60).map(n=>`<li>${esc(n.date||'')} ${esc(n.sym||'')} — ${esc(n.note||'')}</li>`).join('')}</ul></details>`:''}
      <div class="cxfoot"><button class="btn" type="button" data-cx="again">${T('Άλλο αρχείο','Another file')}</button><button class="btn primary" type="button" data-cx="save"${on.length?'':' disabled'}>${T(`Καταχώρηση ${on.length}`,`Add ${on.length}`)}</button></div>`;
  }
  d.innerHTML=`<div class="cxbox"><div class="cxhead"><h2 id="cxTitle">${T('Εισαγωγή από CSV','Import from CSV')}</h2><button class="cxx" type="button" data-cx="close" aria-label="${T('Κλείσιμο','Close')}">×</button></div><div class="cxbody">${body}</div></div>`;
  d.querySelectorAll('[data-cxu]').forEach((inp,i)=>attachPicker(inp,$('cxl'+i),it=>cxPick(inp.dataset.cxu,it)));
}
const CXTYPE={buy:T('Αγορά','Buy'),sell:T('Πώληση','Sell'),reward:T('Ανταμοιβή','Reward'),div:T('Μέρισμα','Dividend')};
function cxRow(r,i){
  const name=r.a?meta(r.a).name:(r.sym||r.isin||'?');
  const st=r.err?`<span class="neg">${esc(r.err)}</span>`:r.dup?`<span class="cxdupc">${T('Υπάρχει ήδη στο χαρτοφυλάκιο','Already in your portfolio')}</span>`:r.note?`<span class="muted">${esc(r.note)}</span>`:'';
  const pe=r.type==='buy'||r.type==='sell';
  return `<div class="cxr${r.on?'':' off'}${r.err?' bad':''}" data-i="${i}">
    <label class="cxon"><input type="checkbox" data-f="on"${r.on?' checked':''}${r.err?' disabled':''} aria-label="${T('Να καταχωρηθεί','Include')}"></label>
    <div class="cxn"><b>${esc(name)}</b>${r.n>1?` <span class="muted small">×${r.n}</span>`:''}${!r.a?' <span class="neg small">'+T('χωρίς αντιστοίχιση','not matched')+'</span>':''}</div>
    <input type="date" data-f="date" value="${esc(r.date)}" aria-label="${T('Ημερομηνία','Date')}">
    <select data-f="type" aria-label="${T('Κίνηση','Type')}">${Object.entries(CXTYPE).map(([k,v])=>`<option value="${k}"${r.type===k?' selected':''}>${v}</option>`).join('')}</select>
    <label class="cxf cxq"><span>${r.type==='div'?T('Ποσό €','Amount €'):T('Ποσότητα','Quantity')}</span><input type="number" step="any" min="0" inputmode="decimal" data-f="qty" value="${r.qty>0?+(+r.qty).toPrecision(10):''}"></label>
    ${pe?`<label class="cxf cxp"><span>${T('Τιμή €','Price €')}</span><input type="number" step="any" min="0" inputmode="decimal" data-f="price" value="${r.price>0?+(+r.price).toPrecision(8):''}"></label>
    <label class="cxf cxfee"><span>${T('Προμήθεια €','Fee €')}</span><input type="number" step="any" min="0" inputmode="decimal" data-f="fee" value="${r.fee>0?+(+r.fee).toPrecision(6):''}"></label>`:'<span class="cxph"></span><span class="cxph"></span>'}
    <div class="cxst small">${st}${r.feeLost?` <span class="muted">${T(`προμήθεια σε ${esc(r.feeLost)} δεν μετατράπηκε`,`fee in ${esc(r.feeLost)} not converted`)}</span>`:''}</div></div>`;
}
function cxPick(u,it){
  let id=null;const r0=CX.rows.find(x=>(x.isin?'isin:'+x.isin:x.sym)===u);
  if(it.tok)id=tokCustom(it.tok);
  else if(it.k==='__new'){const sym=r0?.sym||u.replace(/^isin:/,''),last=[...CX.rows].reverse().find(x=>(x.isin?'isin:'+x.isin:x.sym)===u&&x.price>0);
    id='c_'+cxKey(sym).slice(0,16)+'_'+uid().slice(0,3);state.custom[id]={name:(r0?.name||sym).slice(0,40),sym,cls:r0?.cls==='crypto'?'crypto':r0?.cls==='stock'?'stock':'other',current:last?.price||0,at:Date.now(),man:1}}
  else id=it.k;
  if(!id)return;state.csvMap=state.csvMap||{};state.csvMap[u]=id;save();
  /* re-run the conversion: a matched coin can now price trades paid in it */
  cxRebuild();
}
function cxRebuild(){CX.notes=[];const norm=CX.gen?genRead(CX.data,CX.hdr,CX.ctx,CX.map):CX.reader.read(CX.data,CX.hdr,CX.ctx);
CX.rows=cxBuild(norm,CX.merge);cxDraw()}
async function cxLoad(file){
  const text=await file.text();const {rows,delim}=cxParse(text);
  if(rows.length<2){toast(T('Το αρχείο δεν έχει γραμμές.','The file has no rows.'));return}
  /* header = the first row (within 30) that a reader recognises, or the first row with 3+ known column words */
  let hi=-1,reader=null;
  for(let i=0;i<Math.min(30,rows.length);i++){const r=READERS.find(x=>x.test(rows[i]));if(r){hi=i;reader=r;break}}
  if(hi<0){const words=new Set(GEN_FIELDS.flatMap(f=>f[2].map(cxKey)));for(let i=0;i<Math.min(30,rows.length);i++){if(rows[i].filter(c=>words.has(cxKey(c))).length>=3){hi=i;break}}if(hi<0)hi=0}
  const hdr=rows[hi].map(c=>c.trim()),data=rows.slice(hi+1).filter(r=>r.length>=Math.min(3,hdr.length));
  const di=reader?H(hdr,'Date(UTC)','UTC_Time','time','Timestamp','Time'):genGuess(hdr).date;
  CX.ctx={delim,order:cxDateOrder(data.slice(0,500).map(r=>r[di>-1?di:0]))};CX.order=CX.ctx.order;
  CX.file=file.name;CX.hdr=hdr;CX.data=data;CX.reader=reader;CX.gen=!reader;CX.src=reader?reader.name:T('Γενικό αρχείο','Generic file');CX.merge=CX.merge??true;CX.shown=150;
  if(CX.gen){CX.map=genGuess(hdr);CX.genOpen=true}
  cxRebuild();
}
function cxRowOf(e){const el=e.target.closest('.cxr');return el?CX.rows[+el.dataset.i]:null}
function cxClick(e){
  const b=e.target.closest('[data-cx]');if(!b)return;const a=b.dataset.cx;
  if(a==='close')cxClose();
  else if(a==='more'){CX.shown+=300;cxDraw()}
  else if(a==='again'){CX.rows=[];CX.gen=false;cxDraw()}
  else if(a==='undo'){const imp=CX.undo.imp;state.tx=state.tx.filter(t=>t.imp!==imp);save();render();CX.undo=null;cxClose();toast(T('Η εισαγωγή αναιρέθηκε.','The import was undone.'),1)}
  else if(a==='save'){
    const imp='csv'+Date.now().toString(36),src=CX.reader?.id||'csv';let n=0;
    for(const r of CX.rows){if(!r.on||r.err||!r.a)continue;
      const t={id:uid(),a:r.a,type:r.type,date:r.date,qty:+(+r.qty).toPrecision(12),price:r.type==='buy'||r.type==='sell'?+(+r.price).toPrecision(10):r.type==='div'?1:0,fee:r.type==='reward'?0:+(+r.fee||0).toFixed(4),reason:'',src,imp};
      if(r.ext)t.ext=r.ext;state.tx.push(t);n++}
    state.onboarded=true;save();assetOptions('fAsset');render();CX.undo={imp,n};CX.rows=[];cxDraw();
  }
}
function cxChange(e){
  if(e.target.id==='cxFile'){const f=e.target.files&&e.target.files[0];if(f)cxLoad(f).catch(err=>{console.warn(err);toast(T('Το αρχείο δεν διαβάστηκε.','The file could not be read.'))});return}
  if(e.target.dataset.cx==='merge'){CX.merge=e.target.checked;cxRebuild();return}
  if(e.target.dataset.cxmap){CX.map[e.target.dataset.cxmap]=+e.target.value;CX.genOpen=true;cxRebuild();return}
  const r=cxRowOf(e),f=e.target.dataset.f;if(!r||!f)return;
  if(f==='on'){r.on=e.target.checked;cxSum();e.target.closest('.cxr').classList.toggle('off',!r.on);return}
  if(f==='type'){r.type=e.target.value;if(r.type==='reward'){r.price=0;r.fee=0}cxCheck(r);r.on=!r.err&&!r.dup;cxDraw();return}
  if(f==='date'){r.date=e.target.value;cxCheck(r);r.on=!r.err&&!r.dup;cxDraw();return}
}
function cxInput(e){const r=cxRowOf(e),f=e.target.dataset.f;if(!r||!['qty','price','fee'].includes(f))return;r[f]=parseFloat(e.target.value)||0;
  const was=r.err;cxCheck(r);if(!r.err&&was)r.on=true;if(!!was!==!!r.err){const el=e.target.closest('.cxr');el.classList.toggle('bad',!!r.err);el.querySelector('[data-f="on"]').disabled=!!r.err;el.querySelector('[data-f="on"]').checked=r.on;el.classList.toggle('off',!r.on);el.querySelector('.cxst').innerHTML=r.err?`<span class="neg">${esc(r.err)}</span>`:''}cxSum()}
function cxSum(){const d=$('csvDlg');if(!d)return;const n=CX.rows.filter(r=>r.on&&!r.err).length,b=d.querySelector('[data-cx="save"]');if(b){b.textContent=T(`Καταχώρηση ${n}`,`Add ${n}`);b.disabled=!n}
  const s=d.querySelector('.cxsum span');if(s)s.innerHTML=T(`Θα καταχωρηθούν <b>${n}</b>`,`<b>${n}</b> will be added`)}
(()=>{const head=document.querySelector('#txPanel .phead .btns');if(!head)return;const b=document.createElement('button');b.className='btn';b.type='button';b.id='btnCsv';b.textContent=T('Εισαγωγή από CSV','Import from CSV');head.prepend(b);b.addEventListener('click',cxOpen)})();
