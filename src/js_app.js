
/* ---------- wallet and Pro (real: Mobile Wallet Adapter, read-only checks through Helius) ---------- */
const WKEY='vestora-wallet-v1', THRESH_EUR=20;
const HELIUS='https://mainnet.helius-rpc.com/?api-key=b9b945b9-2831-4343-aab8-9d8a62c5719f';
const validAddr=a=>typeof a==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
let wallet=readJSON(WKEY);if(!wallet||!validAddr(wallet.addr))wallet=null;
const saveWallet=()=>wallet?LS.set(WKEY,JSON.stringify(wallet)):LS.del(WKEY);
/* Google Play edition: the Play app opens ?edition=play. No wallet and no SKR; every feature is free there (Play rules). */
const PLAY=(()=>{const q=/[?&]edition=play\b/.test(location.search);try{if(q)localStorage.setItem('vestora-edition','play');return localStorage.getItem('vestora-edition')==='play'}catch(e){return q}})();
if(PLAY){wallet=null;document.documentElement.classList.add('play')}
const isPro=()=>PLAY||!!wallet&&(!!wallet.genesis||(wallet.skrEur!=null&&wallet.skrEur>=THRESH_EUR));
const needSkr=()=>skrEur?Math.ceil(THRESH_EUR/skrEur):null;
const LOCK='<svg class="lk" width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><rect x="1" y="5" width="9" height="6.5" rx="1.5" fill="currentColor"/><path d="M3 5V3.6a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const short=a=>a.slice(0,4)+'…'+a.slice(-4);
function rpc(method,params,ms){
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),ms||12000);
  return fetch(HELIUS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'vestora',method,params}),signal:ctl.signal})
    .then(r=>r.json()).then(j=>{if(j.error)throw new Error(j.error.message||'rpc error');return j.result}).finally(()=>clearTimeout(to));
}
/* Seeker Genesis Token check, the same as in the other StratoshiVibes apps (ported from @solana-mobile/skr-genesis-token, Apache-2.0). */
const SGT_GROUP='GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te', TOKEN_2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const B58A='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58enc(bytes){let n=0n;for(const x of bytes)n=n*256n+BigInt(x);let s='';while(n>0n){s=B58A[Number(n%58n)]+s;n/=58n}for(const x of bytes){if(x===0)s='1'+s;else break}return s}
function b64bytes(str){const bin=atob(str);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
function isSgtMint(d){
  if(d.length<166||d[165]!==1)return false;
  let off=166,group=null,meta=null,member=false;
  while(off+4<=d.length){
    const type=d[off]|(d[off+1]<<8),len=d[off+2]|(d[off+3]<<8),s=off+4,e=s+len;
    if(type===0||e>d.length)break;
    if(type===18&&len===64)meta=b58enc(d.subarray(s+32,s+64));
    else if(type===23&&len===72){group=b58enc(d.subarray(s+32,s+64));member=true}
    off=e;
  }
  return member&&group===SGT_GROUP&&meta===SGT_GROUP;
}
async function hasSgt(owner){
  const ta=await rpc('getTokenAccountsByOwner',[owner,{programId:TOKEN_2022},{encoding:'jsonParsed',commitment:'confirmed'}]);
  const mints=[...new Set((ta.value||[]).filter(a=>a.account.data.parsed.info.tokenAmount.amount!=='0').map(a=>a.account.data.parsed.info.mint))];
  for(let i=0;i<mints.length;i+=100){
    const batch=mints.slice(i,i+100),r=await rpc('getMultipleAccounts',[batch,{encoding:'base64',commitment:'confirmed'}]);
    if((r.value||[]).some(acc=>acc&&acc.owner===TOKEN_2022&&isSgtMint(b64bytes(acc.data[0]))))return true;
  }
  return false;
}
/* Staked SKR (Solana Mobile staking program). Staked SKR leaves the wallet, so it is read from the program's UserStake accounts.
   Layout from the program IDL: UserStake (169 bytes) user@41, shares u128@105, unstaking_amount u64@153; StakeConfig share_price u128@137 (1e9 = 1.0). */
const SKR_STAKE_PROG='SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ',SKR_STAKE_CFG='4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw';
const uLE=(d,o,n)=>{let v=0n;for(let i=n-1;i>=0;i--)v=v*256n+BigInt(d[o+i]);return v},u128=(d,o)=>uLE(d,o,16),u64=(d,o)=>uLE(d,o,8);
const SKR_GUARDIAN='DPJ58trLsF9yPrBa2pk6UaRkvqW8hWUYjawe788WBuqr',PUBLIC_RPC='https://api.mainnet-beta.solana.com';
function b58dec(str){let n=0n;for(const c of str){const i=B58A.indexOf(c);if(i<0)throw new Error('b58');n=n*58n+BigInt(i)}
  const out=[];while(n>0n){out.unshift(Number(n&255n));n>>=8n}for(const c of str){if(c==='1')out.unshift(0);else break}
  while(out.length<32)out.unshift(0);return new Uint8Array(out)}
/* PDA = sha256(seeds, bump, program, "ProgramDerivedAddress") that is NOT a valid ed25519 point */
const EP=2n**255n-19n,ED=(-121665n*((x=>{let r=1n,b=121666n,e=EP-2n;while(e){if(e&1n)r=r*b%EP;b=b*b%EP;e>>=1n}return r})()))%EP+EP;
const mpow=(b,e)=>{let r=1n;b%=EP;while(e){if(e&1n)r=r*b%EP;b=b*b%EP;e>>=1n}return r};
function onCurve(k){let y=0n;for(let i=31;i>=0;i--)y=y*256n+BigInt(i===31?k[i]&127:k[i]);y%=EP;
  const y2=y*y%EP,u=(y2-1n+EP)%EP,v=(ED%EP*y2+1n)%EP;if(u===0n)return true;
  const x2=u*mpow(v,EP-2n)%EP;return mpow(x2,(EP-1n)/2n)===1n}
async function findPda(seeds,prog){const P=b58dec(prog),tag=new TextEncoder().encode('ProgramDerivedAddress');
  for(let bump=255;bump>=0;bump--){const parts=[...seeds,Uint8Array.of(bump),P,tag],len=parts.reduce((s,x)=>s+x.length,0),buf=new Uint8Array(len);let o=0;for(const x of parts){buf.set(x,o);o+=x.length}
    const h=new Uint8Array(await crypto.subtle.digest('SHA-256',buf));if(!onCurve(h))return b58enc(h)}throw new Error('no pda')}
function rpcAt(url,method,params,ms){const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),ms||12000);
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'vestora',method,params}),signal:ctl.signal})
    .then(r=>r.json()).then(j=>{if(j.error)throw new Error(j.error.message||'rpc error');return j.result}).finally(()=>clearTimeout(to))}
async function skrStaked(owner){
  const cfg=await rpc('getAccountInfo',[SKR_STAKE_CFG,{encoding:'base64',commitment:'confirmed'}]);
  const price=u128(b64bytes(cfg.value.data[0]),137);
  const gpa=[SKR_STAKE_PROG,{encoding:'base64',commitment:'confirmed',filters:[{dataSize:169},{memcmp:{offset:41,bytes:owner}}]}];
  let datas=null;
  /* 1) every pool at once (Helius, then the public RPC); 2) if both refuse, the Solana Mobile guardian pool by its PDA */
  for(const f of [()=>rpc('getProgramAccounts',gpa,15000),()=>rpcAt(PUBLIC_RPC,'getProgramAccounts',gpa,15000)]){
    try{const r=await f(),l=Array.isArray(r)?r:(r?.value||[]);datas=l.map(a=>a.account.data[0]);break}catch(e){console.warn('skr gpa',e)}}
  if(!datas||!datas.length){
    const pda=await findPda([new TextEncoder().encode('user_stake'),b58dec(SKR_STAKE_CFG),b58dec(owner),b58dec(SKR_GUARDIAN)],SKR_STAKE_PROG);
    const r=await rpc('getAccountInfo',[pda,{encoding:'base64',commitment:'confirmed'}]);datas=r?.value?[r.value.data[0]]:[]}
  let raw=0n;
  for(const x of datas){const d=b64bytes(x);if(d.length<169)continue;raw+=u128(d,105)*price/1000000000n+u64(d,153)}
  return Number(raw)/1e6;
}
async function skrPrice(){
  if(skrEur)return skrEur;
  try{const r=await fetch(JUP+MINT.SKR),j=await r.json();const p=j[MINT.SKR]?.usdPrice;if(p>0)skrEur=p/FXL}catch(e){}
  return skrEur;
}
let wBusy=false;
async function checkWallet(force){
  if(!wallet||wBusy)return;
  if(!force&&wallet.status==='ok'&&Date.now()-(wallet.t||0)<5*60e3)return;
  wBusy=true;renderWallet();if(!$('overlay').hidden&&flow.step==='done')drawSheet();
  try{
    const ta=await rpc('getTokenAccountsByOwner',[wallet.addr,{mint:MINT.SKR},{encoding:'jsonParsed',commitment:'confirmed'}]);
    wallet.skr=(ta.value||[]).reduce((s,a)=>s+(+a.account.data.parsed.info.tokenAmount.uiAmountString||0),0);
    try{wallet.skrStaked=await skrStaked(wallet.addr);wallet.skr+=wallet.skrStaked;wallet.stakeErr=false}catch(e){console.warn('skr stake',e);wallet.stakeErr=true}
    const p=await skrPrice();wallet.skrEur=p?wallet.skr*p:null;
    try{wallet.genesis=await hasSgt(wallet.addr)}catch(e){console.warn('sgt',e)}
    wallet.status='ok';wallet.t=Date.now();
  }catch(e){console.warn('wallet check',e);wallet.status='error'}
  finally{wBusy=false;saveWallet();render();if(!$('overlay').hidden&&(flow.step==='done'||flow.step==='info'))drawSheet()}
}
/* ---------- Ethereum, read-only: the user pastes a public address; balances come from a public block explorer ---------- */
const EKEY='vestora-eth-v1', ETH_API='https://eth.blockscout.com/api/v2/addresses/', ETH_ALT='https://api.ethplorer.io/getAddressInfo/';
const validEth=a=>typeof a==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a);
const shortE=a=>a.slice(0,6)+'…'+a.slice(-4);
const WBTC='0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
/* dollar stablecoins count as cash, not as crypto risk */
const STABLE=new Set(['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48','0xdac17f958d2ee523a2206206994597c13d831ec7','0x6b175474e89094c44da98b954eedeac495271d0f',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB']);
function getJSON(url,ms){const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),ms||15000);
  return fetch(url,{signal:ctl.signal}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).finally(()=>clearTimeout(to))}
function ethToken(contract,name,sym,qty,usd){
  contract=String(contract||'').toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(contract)||!(qty>0)||!(usd>0))return null;
  sym=String(sym||'').trim().slice(0,12);name=String(name||sym||'Token').trim().slice(0,40);
  return{contract,id:contract===WBTC&&ASSETS.BTC?'BTC':null,name,sym,qty,eur:usd/FXL,cls:STABLE.has(contract)?'cash':'crypto'};
}
async function ethRead(addr){
  const list=[];
  try{
    const [a,tb]=await Promise.all([getJSON(ETH_API+addr),getJSON(ETH_API+addr+'/token-balances')]);
    const q=Number(a.coin_balance||0)/1e18,usd=+a.exchange_rate||nowPrice('ETH')*FXL;
    if(q>0)list.push({id:'ETH',name:'Ethereum',sym:'ETH',qty:q,eur:usd/FXL,cls:'crypto'});
    for(const it of (Array.isArray(tb)?tb:tb.items||[])){
      const k=it.token||{};if(k.type&&k.type!=='ERC-20')continue;if(k.reputation&&k.reputation!=='ok')continue;
      const qty=Number(it.value||0)/10**(+k.decimals||0),usd=+k.exchange_rate||0,cap=+k.circulating_market_cap||0;
      if(cap>0&&qty*usd>cap)continue;                       // a "balance" worth more than the whole token is a fake
      const t=ethToken(k.address_hash||k.address,k.name,k.symbol,qty,usd);if(t)list.push(t);
    }
  }catch(e1){
    console.warn('blockscout',e1);list.length=0;
    const j=await getJSON(ETH_ALT+addr+'?apiKey=freekey');
    const q=+j.ETH?.balance||0,usd=+j.ETH?.price?.rate||nowPrice('ETH')*FXL;
    if(q>0)list.push({id:'ETH',name:'Ethereum',sym:'ETH',qty:q,eur:usd/FXL,cls:'crypto'});
    for(const it of j.tokens||[]){const k=it.tokenInfo||{};
      const t=ethToken(k.address,k.name,k.symbol,Number(it.rawBalance??it.balance??0)/10**(+k.decimals||0),+(k.price&&k.price.rate)||0);if(t)list.push(t)}
  }
  for(const t of list)if(t.id&&nowPrice(t.id)>0)t.eur=nowPrice(t.id);   // ETH and wrapped BTC use the app's own price, so the list shows exactly what gets added
  return list.filter(t=>t.qty*t.eur>=1).sort((a,b)=>b.qty*b.eur-a.qty*a.eur);
}
/* Hyperliquid uses the same 0x address. Spot balances, staked HYPE, the perps account and vault deposits. */
const HL_MAP={UBTC:'BTC',UETH:'ETH',USOL:'SOL'},HL_CASH=new Set(['USDC','USDT0','USDE','USDH']);
async function hlRead(addr){
  addr=addr.toLowerCase();   // the Hyperliquid API answers with an empty account for a mixed-case (checksummed) address
  const [sp,pe,dg,vt,px]=await Promise.all([hlPost({type:'spotClearinghouseState',user:addr}),hlPost({type:'clearinghouseState',user:addr}).catch(()=>null),
    hlPost({type:'delegatorSummary',user:addr}).catch(()=>null),hlPost({type:'userVaultEquities',user:addr}).catch(()=>[]),hlSpotPx()]);
  const out=[],add=(key,name,sym,qty,usd,cls,extra)=>{if(qty>0&&usd>0)out.push({hlKey:key,name,sym,qty,eur:usd/FXL,cls,tag:'Hyperliquid',...extra})};
  for(const b of sp?.balances||[]){const q=+b.total||0,p=(b.token!=null?px['#'+b.token]:px[b.coin])||0,id=HL_MAP[b.coin]&&ASSETS[HL_MAP[b.coin]]?HL_MAP[b.coin]:null;
    if(id)out.push({id,name:ASSETS[id].name,sym:b.coin,qty:q,eur:p/FXL,cls:'crypto',tag:'Hyperliquid'});
    else add('s_'+b.coin,b.coin==='HYPE'?'Hyperliquid':b.coin,b.coin,q,p,HL_CASH.has(b.coin)?'cash':'crypto',{hl:b.token!=null?'#'+b.token:b.coin})}
  const st=(+dg?.delegated||0)+(+dg?.undelegated||0)+(+dg?.totalPendingWithdrawal||0);
  add('stake_HYPE','Hyperliquid (staked)','HYPE',st,px.HYPE||0,'crypto',{hl:'HYPE',staked:true});
  const av=+pe?.marginSummary?.accountValue||0,open=(pe?.assetPositions||[]).length;
  add('perps','Hyperliquid perps','USDC',av,1,open?'crypto':'cash',{usdv:true});
  const vq=(Array.isArray(vt)?vt:[]).reduce((s,v)=>s+(+v.equity||0),0);
  add('vaults','Hyperliquid vaults','USDC',vq,1,'crypto',{usdv:true});
  return out.filter(t=>t.qty*t.eur>=1);
}
async function loadEth(addr){
  flow.eth={addr,loading:true};drawSheet();
  try{const [l1,l2]=await Promise.all([ethRead(addr).catch(e=>{console.warn('eth',e);return null}),hlRead(addr).catch(e=>{console.warn('hl',e);return null})]);if(!l1&&!l2)throw new Error('both failed');
    const list=[...(l1||[]),...(l2||[])].sort((a,b)=>b.qty*b.eur-a.qty*a.eur);flow.hlErr=!l2;flow.hlNone=!!l2&&!l2.length;LS.set(EKEY,addr);flow.imp={list,src:'eth',addr};flow.eth={addr};flow.step='import'}
  catch(e){console.warn(e);flow.eth={addr,error:true}}
  if(!$('overlay').hidden&&(flow.step==='eth'||flow.step==='import'))drawSheet();
}
let bundleState=0;
function loadBundle(){
  if(bundleState)return;bundleState=1;
  addEventListener('svwallet-ready',()=>{bundleState=2;const re=()=>{if(!$('overlay').hidden&&flow.step==='pick')drawSheet()};try{SVWallet.onList(re)}catch(e){}re()},{once:true});
  const sc=document.createElement('script');sc.src='wallet.bundle.js';sc.onerror=()=>{bundleState=0};document.head.appendChild(sc);
}

/* ---------- sheet (dialogs) ---------- */
let flow={step:'info',arg:null,imp:null};let lastFocus=null;
function openSheet(step,arg){arm();lastFocus=document.activeElement;flow.step=step||(wallet?'done':'info');flow.arg=arg;$('overlay').hidden=false;if(flow.step==='pick')loadBundle();drawSheet()}
function closeSheet(){$('overlay').hidden=true;lastFocus?.focus?.()}
function cmpTable(){
  const rows=[['Καταχώρηση συναλλαγών, μερισμάτων και staking',1,1],['Ζωντανές τιμές και σύγκριση με S&P 500',1,1],['Συγκέντρωση, κόστος προμηθειών, εισόδημα',1,1],
    ['Το πλάνο σου: στόχος, τι χρειάζεται, πλάνο Β',1,1],['Οικονομική αντοχή και ανεκτή πτώση',1,1],['Stress test με έτοιμα σενάρια',1,1],['Ημερολόγιο αποφάσεων',1,1],['Αντίγραφο ασφαλείας',1,1],
    ['Σύγκριση με Nasdaq, Bitcoin, κατάθεση, 80/20, μηνιαία αγορά',0,1],['Απόδοση των χρημάτων σου (MWR) και χρονισμός',0,1],['Επικάλυψη ETF και συσχετίσεις',0,1],
    ['Μέγιστη πτώση και μεταβλητότητα',0,1],['Stress test με δικό σου σενάριο',0,1],['Εισαγωγή assets από Solana wallet ή διεύθυνση Ethereum',0,1],
    ['Ερωτήσεις «τι θα γίνει αν» με AI (σύντομα)',0,2],['Ειδοποιήσεις με δικά σου όρια (σύντομα)',0,2]];
  return `<div class="cmp"><div class="h">Λειτουργία</div><div class="h c">Δωρεάν</div><div class="h c">Pro</div>${rows.map(([n,f,p])=>`<div>${n}</div><div class="c ${f?'yes':'no'}">${f?'✓':'—'}</div><div class="c ${p===1?'yes':'no'}">${p===1?'✓':p===2?'σύντομα':'—'}</div>`).join('')}</div>`;
}
function drawSheet(){
  const s=$('sheet');const head=t=>`<div class="shead"><h3 id="sheetTitle">${t}</h3><button class="x" type="button" data-act="close" aria-label="Κλείσιμο">×</button></div>`;
  const st=flow.step;
  if(st==='info'){
    const n=needSkr();
    s.innerHTML=head('Vestora Pro')+`<p>Οι προηγμένες αναλύσεις ξεκλειδώνουν όταν το Solana wallet σου κρατάει SKR. Δεν πληρώνεις, δεν ξοδεύεις και δεν δεσμεύεις τίποτα. Το SKR μένει στο wallet σου.</p>`+cmpTable()+
    `<div class="rule"><b>Πώς ξεκλειδώνει</b><span>Κράτα SKR αξίας <b class="num">${eur.format(THRESH_EUR)}</b>${n?`, σήμερα περίπου <b class="num">${nf(0).format(n)} SKR</b>`:''}. Το όριο ορίζεται σε ευρώ και αναπροσαρμόζεται, ώστε να μένει δίκαιο όταν η τιμή αλλάζει.</span><span>Κάτοχοι Seeker Genesis Token (κάθε κινητό Seeker έχει ένα): Pro χωρίς όριο SKR.</span></div>`+
    `<div class="row">${wallet?`<button class="btn" type="button" data-act="done">Κατάσταση wallet</button>`:''}<button class="btn primary" type="button" data-act="pick">${wallet?'Σύνδεση άλλου wallet':'Σύνδεση wallet'}</button></div>`;
  }else if(st==='pick'){
    const ws=window.SVWallet?SVWallet.list():[];
    s.innerHTML=head('Σύνδεση wallet')+`<p class="muted">Η Vestora βλέπει μόνο τη δημόσια διεύθυνσή σου, για να ελέγξει το SKR και, αν το ζητήσεις, να διαβάσει τα υπόλοιπα. Δεν ζητάει ποτέ seed phrase και δεν μπορεί να μετακινήσει τίποτα.</p>`+
    (ws.length?`<div class="opts">${ws.map((w,i)=>`<button class="opt" type="button" data-act="wallet" data-i="${i}"><img class="ic" src="${esc(w.icon)}" alt=""><span><b>${w.mwa?'Wallet του κινητού':esc(w.name)}</b><small>${w.mwa?'Seeker Wallet ή άλλο, μέσω Mobile Wallet Adapter':'Επέκταση του browser'}</small></span></button>`).join('')}</div>`
      :`<p>${bundleState===2?'Δεν βρέθηκε wallet. Στο κινητό Seeker άνοιξε τη Vestora από την εφαρμογή. Σε υπολογιστή χρειάζεται επέκταση wallet, π.χ. Phantom ή Solflare.':'Φορτώνει…'}</p>`)+
    `<p class="muted" id="pickMsg" role="status"></p><div class="row"><button class="btn" type="button" data-act="info">Πίσω</button></div>`;
  }else if(st==='done'){
    const w=wallet;if(!w){flow.step='info';return drawSheet()}
    const ok=isPro(),n=needSkr();
    s.innerHTML=head('Το wallet σου')+`<dl class="status"><dt>Διεύθυνση</dt><dd class="num">${short(w.addr)}</dd>
      <dt>SKR</dt><dd class="num">${w.skr==null?'—':nf(2).format(w.skr)}${w.skrEur!=null?` <span class="muted">(${eur2.format(w.skrEur)})</span>`:''}${w.skrStaked>0?`<br><small class="muted">από αυτά σε staking: ${nf(2).format(w.skrStaked)}</small>`:w.stakeErr?`<br><small class="muted">Το SKR σε staking δεν διαβάστηκε. Πάτα ανανέωση.</small>`:''}</dd><dt>Seeker Genesis Token</dt><dd>${w.genesis?'Ναι':w.status==='ok'?'Όχι':'—'}</dd></dl>`+
      (wBusy?`<p class="muted">Ελέγχεται…</p>`:w.status==='error'?`<div class="verdict short">Δεν ήταν δυνατός ο έλεγχος. Έλεγξε τη σύνδεση στο internet και δοκίμασε ξανά.</div>`:
       ok?`<div class="verdict ok">Το Pro είναι ενεργό${w.genesis?' μέσω Seeker Genesis Token':''}.</div>`
         :`<div class="verdict short">${n?`Χρειάζονται περίπου ${nf(0).format(Math.max(0,n-(w.skr||0)))} SKR ακόμα για το Pro.`:'Για το Pro χρειάζεται SKR αξίας 20 € ή Seeker Genesis Token.'} Οι δωρεάν λειτουργίες μένουν διαθέσιμες κανονικά.</div>`)+
      `<p class="muted">Ο έλεγχος ξαναγίνεται κάθε φορά που ανοίγεις την εφαρμογή. Αν το υπόλοιπο πέσει κάτω από το όριο, το Pro κλειδώνει ξανά χωρίς να χαθεί κανένα δεδομένο.</p>`+
      `<div class="row"><button class="btn" type="button" data-act="disconnect">Αποσύνδεση</button><button class="btn" type="button" data-act="refresh">Έλεγχος ξανά</button>${ok?`<button class="btn" type="button" data-act="import">Εισαγωγή assets</button>`:`<button class="btn" type="button" data-act="info">Τι ξεκλειδώνει</button>`}<button class="btn primary" type="button" data-act="close">Συνέχεια</button></div>`;
  }else if(st==='import'){
    const I=flow.imp,E=I&&I.src==='eth';
    if(!I||I.loading){s.innerHTML=head('Εισαγωγή από wallet')+`<p class="muted">Διαβάζονται τα υπόλοιπα του ${wallet?short(wallet.addr):''}…</p>`;if(!I)loadImport();}
    else if(I.error){s.innerHTML=head('Εισαγωγή από wallet')+`<div class="verdict short">Δεν ήταν δυνατή η ανάγνωση. ${esc(I.error)}</div><div class="row"><button class="btn" type="button" data-act="retryimp">Δοκίμασε ξανά</button><button class="btn" type="button" data-act="done">Πίσω</button></div>`}
    else{
      const dup=state.tx.some(t=>t.src===(E?'eth':'wallet'));
      s.innerHTML=head(E?'Εισαγωγή από Ethereum':'Εισαγωγή από wallet')+(E?`<p class="muted small num">${shortE(I.addr)}</p>`:'')+`<p class="muted">Βρέθηκαν αυτά τα assets αξίας πάνω από 1 €. Διάλεξε ποια θα προστεθούν. Μπαίνουν σαν αγορά σήμερα, με τη σημερινή τιμή. Αν τα αγόρασες παλιότερα, άλλαξε μετά ημερομηνία και τιμή στις συναλλαγές για σωστή απόδοση.</p>`+
      (dup?`<div class="verdict short">${E?'Έχεις ήδη κάνει εισαγωγή από Ethereum.':'Έχεις ήδη κάνει εισαγωγή από wallet.'} Ό,τι επιλέξεις θα προστεθεί ξανά.</div>`:'')+
      (I.list.length?`<div class="imp">${I.list.map((t,i)=>`<label><input type="checkbox" id="imp${i}" data-i="${i}" checked> <span>${esc(t.id?ASSETS[t.id].name:t.name)} <small class="muted">${esc(t.sym)}${t.xstock?' · xStock':''}${t.tag?' · '+t.tag:''}${t.staked?' · staking':''}${t.id?'':' · χωρίς ιστορικό τιμών'}</small></span><span class="num">${nf(t.qty<1?6:2).format(t.qty)} · ${eur.format(t.qty*t.eur)}</span></label>`).join('')}</div>`:'<p>Δεν βρέθηκαν assets με αξία πάνω από 1 €.</p>')+
      (E?`<p class="muted">Η ανάγνωση είναι μόνο για προβολή. Φαίνονται το ETH και τα tokens του Ethereum mainnet που έχουν τιμή αγοράς, και στο Hyperliquid τα spot υπόλοιπα, το HYPE σε staking, η αξία του λογαριασμού perps και τα vaults. Τα perps και τα vaults μπαίνουν με την αξία τους σε δολάρια σήμερα και δεν ενημερώνονται μόνα τους. Ό,τι έχεις σε άλλα δίκτυα (Arbitrum, Base κ.ά.) ή μέσα σε άλλα πρωτόκολλα δεν φαίνεται εδώ: πρόσθεσέ το χειροκίνητα.</p>${flow.hlErr?'<p class="neg small">Το Hyperliquid δεν απάντησε αυτή τη φορά.</p>':flow.hlNone?'<p class="muted small">Στο Hyperliquid δεν βρέθηκαν υπόλοιπα για αυτή τη διεύθυνση.</p>':''}`
        :`<p class="muted">Η ανάγνωση είναι μόνο για προβολή. Το SOL που έχεις σε native stake δεν φαίνεται εδώ: πρόσθεσέ το χειροκίνητα. Liquid staking tokens (π.χ. JitoSOL) εμφανίζονται κανονικά.</p>`)+
      `<div class="row"><button class="btn" type="button" data-act="${E?'eth':'done'}">Πίσω</button>${I.list.length?`<button class="btn primary" type="button" data-act="doimport">Προσθήκη επιλεγμένων</button>`:''}</div>`;
    }
  }else if(st==='eth'){
    const E=flow.eth||{},last=E.addr||LS.get(EKEY)||'';
    s.innerHTML=head('Εισαγωγή από Ethereum')+`<p>Επικόλλησε τη δημόσια διεύθυνση του Ethereum wallet σου. Η Vestora διαβάζει τα υπόλοιπα και σου δείχνει τι βρήκε, για να διαλέξεις τι θα προστεθεί.</p>
      <p class="muted">Μόνο ανάγνωση: δεν συνδέεται wallet, δεν ζητείται υπογραφή, seed phrase ή private key, και τίποτα δεν μπορεί να μετακινηθεί. Η διεύθυνση στέλνεται σε δημόσιο block explorer για να διαβαστούν τα υπόλοιπα.</p>
      <div class="f"><label for="ethAddr">Διεύθυνση Ethereum (0x…)</label><input id="ethAddr" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="0x…" value="${esc(last)}"></div>
      ${E.loading?`<p class="muted" role="status">Διαβάζονται τα υπόλοιπα…</p>`:E.error?`<div class="verdict short" role="status">Δεν ήταν δυνατή η ανάγνωση. Έλεγξε τη σύνδεση στο internet και δοκίμασε ξανά.</div>`:`<p class="neg small" id="ethMsg" role="status"></p>`}
      <div class="row"><button class="btn" type="button" data-act="close">Άκυρο</button><button class="btn primary" type="button" data-act="ethgo"${E.loading?' disabled':''}>Διάβασε τα υπόλοιπα</button></div>`;
  }else if(st==='price'){
    const c=state.custom[flow.arg];if(!c){closeSheet();return}
    s.innerHTML=head('Τρέχουσα τιμή')+`<p>${esc(c.name)}</p><p class="muted">Η τιμή που βάζεις μένει μέχρι να την αλλάξεις. Για ακίνητο, βάλε την αξία που θα έπαιρνες αν το πουλούσες σήμερα.</p>
      <div class="f"><label for="pxNew">Νέα τιμή ανά μονάδα €</label><input id="pxNew" type="number" min="0" step="any" inputmode="decimal" value="${+(+c.current||0).toPrecision(8)}"></div>
      <div class="f"><label for="pxCls">Κατηγορία</label><select id="pxCls">${Object.entries(CUSTOM_CLS).map(([k,v])=>`<option value="${k}"${k===c.cls?' selected':''}>${v}</option>`).join('')}</select></div>
      <p class="muted" id="pxMsg" role="status"></p><div class="row"><button class="btn" type="button" data-act="close">Άκυρο</button><button class="btn primary" type="button" data-act="setprice">Αποθήκευση</button></div>`;
  }
  (s.querySelector('[data-act="pick"],.btn.primary,input')||s.querySelector('.x')).focus();
}
async function loadImport(){
  flow.imp={loading:true};
  try{
    const params=o=>({ownerAddress:wallet.addr,page:1,limit:1000,...o});
    let res;try{res=await rpc('getAssetsByOwner',params({options:{showFungible:true,showNativeBalance:true}}),20000)}
    catch(e){res=await rpc('getAssetsByOwner',params({displayOptions:{showFungible:true,showNativeBalance:true}}),20000)}
    const list=[];
    if(res.nativeBalance?.lamports)list.push({mint:MINT.SOL,id:'SOL',name:'Solana',sym:'SOL',qty:res.nativeBalance.lamports/1e9});
    for(const it of res.items||[]){
      if(!/Fungible/.test(it.interface||''))continue;const ti=it.token_info;if(!ti||!ti.balance)continue;
      const qty=ti.balance/10**(ti.decimals||0),sym=String(ti.symbol||it.content?.metadata?.symbol||'').trim(),mint=it.id;
      const name=String(it.content?.metadata?.name||sym||'Token').trim().slice(0,40);
      let id=null,xstock=false;
      if(mint===MINT.SOL)id='SOL';else if(mint===MINT.BTC)id='BTC';else if(mint===MINT.ETH)id='ETH';
      else if(/^Xs/.test(mint)&&/^[A-Z.]{1,6}x$/.test(sym)&&ASSETS[sym.slice(0,-1)]){id=sym.slice(0,-1);xstock=true}
      list.push({mint,id,name,sym,qty,xstock});
    }
    try{const st=await skrStaked(wallet.addr);if(st>0)list.push({mint:MINT.SKR,id:null,name:'Seeker (staked)',sym:'SKR',qty:st,staked:true})}catch(e){console.warn('skr stake',e)}
    const mints=[...new Set(list.map(t=>t.mint))],pr={};
    for(let i=0;i<mints.length;i+=50){const r=await fetch(JUP+mints.slice(i,i+50).join(','));if(r.ok)Object.assign(pr,await r.json())}
    const out=list.map(t=>({...t,eur:(pr[t.mint]?.usdPrice||0)/FXL})).filter(t=>t.eur>0&&t.qty*t.eur>=1).sort((a,b)=>b.qty*b.eur-a.qty*a.eur);
    flow.imp={list:out};
  }catch(e){console.warn(e);flow.imp={error:'Έλεγξε τη σύνδεση στο internet.'}}
  if(!$('overlay').hidden&&flow.step==='import')drawSheet();
}
$('sheet').addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='close')return closeSheet();
  if(a==='info'||a==='pick'||a==='done'){flow.step=a;if(a==='pick')loadBundle();return drawSheet()}
  if(a==='eth'){flow.step='eth';flow.eth=null;return drawSheet()}
  if(a==='ethgo'){const v=$('ethAddr').value.trim();
    if(!validEth(v)){const m=$('ethMsg');if(m)m.textContent=/\.eth$/i.test(v)?'Τα ονόματα .eth δεν υποστηρίζονται ακόμα. Επικόλλησε τη διεύθυνση που ξεκινά με 0x.':'Αυτή δεν μοιάζει με διεύθυνση Ethereum. Ξεκινά με 0x και έχει 42 χαρακτήρες.';return}
    return loadEth(v)}
  if(a==='import'||a==='retryimp'){if(!isPro()){flow.step='info';return drawSheet()}flow.step='import';flow.imp=null;return drawSheet()}
  if(a==='wallet'){
    const ws=window.SVWallet?SVWallet.list():[],w=ws[+b.dataset.i];if(!w)return;b.disabled=true;$('pickMsg').textContent='Περιμένει έγκριση στο wallet…';
    try{const addr=await SVWallet.connect(w.name);if(!validAddr(addr))throw new Error('bad address');
      if(!wallet||wallet.addr!==addr)wallet={addr};saveWallet();flow.step='done';drawSheet();await checkWallet(true)}
    catch(err){console.warn(err);b.disabled=false;$('pickMsg').textContent='Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.'}
    return;
  }
  if(a==='refresh'){checkWallet(true);return}
  if(a==='disconnect'){try{window.SVWallet&&await SVWallet.disconnect()}catch(err){}wallet=null;saveWallet();if(ui.bench!=='SPY')ui.bench='SPY';render();closeSheet();toast('Το wallet αποσυνδέθηκε.');return}
  if(a==='doimport'){
    const date=todayIso();let n=0;
    if(state.sample)state={sample:false,onboarded:true,custom:{},mints:{},tx:[]};
    const E=flow.imp.src==='eth';
    $('sheet').querySelectorAll('.imp input:checked').forEach(c=>{const t=flow.imp.list[+c.dataset.i];let id=t.id,px=t.eur;
      if(E){if(id)px=nowPrice(id)||t.eur;else if(t.hlKey){id='h_'+t.hlKey;state.custom[id]={name:t.name,sym:t.sym,cls:t.cls,current:t.eur,...(t.hl?{hl:t.hl}:{usdv:1})}}else{id='e_'+t.contract;state.custom[id]={name:t.name,sym:t.sym,cls:t.cls,current:t.eur,evm:t.contract}}}
      else if(id){if(t.xstock)state.mints[id]=t.mint;if(PRICES[id])PRICES[id][W-1]=t.eur}
      else{id='m_'+t.mint+(t.staked?'_st':'');state.custom[id]={name:t.name,sym:t.sym,cls:STABLE.has(t.mint)?'cash':'crypto',current:t.eur,mint:t.mint}}
      state.tx.push({id:uid(),a:id,type:'buy',date,qty:t.qty,price:+px.toPrecision(8),fee:0,reason:'',src:E?'eth':'wallet'});n++});
    state.onboarded=true;save();assetOptions('fAsset');render();closeSheet();if(n)toast(n===1?'Προστέθηκε 1 asset.':`Προστέθηκαν ${n} assets.`,1);
    if(!$('onb').hidden)renderOnb();
    return;
  }
  if(a==='setprice'){const v=parseFloat($('pxNew').value);if(!(v>=0)){$('pxMsg').textContent='Βάλε μια τιμή 0 ή μεγαλύτερη.';return}
    const c=state.custom[flow.arg];c.current=v;c.cls=$('pxCls').value;save();render();closeSheet();toast('Η τιμή ενημερώθηκε.',1)}
});
$('overlay').addEventListener('click',e=>{if(e.target.id==='overlay')closeSheet()});
document.addEventListener('keydown',e=>{
  if($('overlay').hidden){if((e.key==='Enter'||e.key===' ')&&e.target.dataset?.pro){e.preventDefault();openSheet('info')}return}
  if(e.key==='Escape')closeSheet();
  if(e.key==='Tab'){const f=[...$('sheet').querySelectorAll('button,select,input')].filter(x=>!x.disabled);if(!f.length)return;const i=f.indexOf(document.activeElement);
    if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-pro]'))openSheet('info')});
$('btnWallet').addEventListener('click',()=>{if(wallet){openSheet('done');checkWallet(false)}else openSheet('pick')});
$('btnImport').addEventListener('click',()=>{if(!wallet)return openSheet('pick');if(!isPro())return openSheet('info');flow.imp=null;openSheet('import')});
function openEth(){if(!isPro())return openSheet('info');flow.eth=null;openSheet('eth')}
$('btnImportEth').addEventListener('click',openEth);
function renderWallet(){
  const b=$('btnWallet'),pro=isPro();
  b.classList.toggle('on',!!wallet);
  b.innerHTML=wallet?(pro?'<span class="probadge">PRO</span>':'')+`<span class="num">${short(wallet.addr)}</span>`:'Σύνδεση wallet';
  $('btnImport').innerHTML='Εισαγωγή από Solana wallet'+(pro?'':LOCK);$('btnImportEth').innerHTML='Εισαγωγή από Ethereum'+(pro?'':LOCK);
  [...$('segBench').children].forEach(x=>{const lock=x.dataset.v!=='SPY'&&!pro;x.innerHTML=esc(x.dataset.n)+(lock?LOCK:'')});
  if(!pro&&ui.bench!=='SPY'){ui.bench='SPY';[...$('segBench').children].forEach(x=>x.setAttribute('aria-pressed',x.dataset.v==='SPY'))}
}

/* ---------- backup: an encrypted file the user keeps (AES-GCM, key from the password with PBKDF2) ---------- */
const BKEY='vestora-backup-at';
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pw,salt,iter){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function makeBackup(pw){
  const payload={app:'vestora',v:1,created:new Date().toISOString(),portfolio:state,plan};
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iter=250000;
  const key=await deriveKey(pw,salt,iter);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(payload)));
  return JSON.stringify({format:'vestora-backup',v:1,kdf:'PBKDF2-SHA256',iter,salt:b64(salt),iv:b64(iv),data:b64(ct)});
}
async function openBackup(text,pw){
  let j;try{j=JSON.parse(text.trim())}catch(e){throw new Error('Αυτό δεν είναι αντίγραφο ασφαλείας της Vestora.')}
  if(j.format!=='vestora-backup')throw new Error('Αυτό δεν είναι αντίγραφο ασφαλείας της Vestora.');
  const key=await deriveKey(pw,unb64(j.salt),j.iter);
  let pt;try{pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(j.iv)},key,unb64(j.data))}catch(e){throw new Error('Λάθος κωδικός, ή το αρχείο έχει αλλοιωθεί.')}
  const p=JSON.parse(new TextDecoder().decode(pt));if(p.app!=='vestora'||!p.portfolio||!Array.isArray(p.portfolio.tx))throw new Error('Το αντίγραφο δεν έχει τα αναμενόμενα στοιχεία.');
  return p;
}
const bkMsg=(t,bad)=>{const m=$('bkMsg');m.textContent=t;m.classList.toggle('neg',!!bad)};
function bkPw(){const pw=$('bkPw').value;if(pw.length<8){bkMsg('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.',true);return null}return pw}
$('bkFile').addEventListener('click',async()=>{const pw=bkPw();if(!pw)return;
  try{const txt=await makeBackup(pw);const blob=new Blob([txt],{type:'application/json'});const name='vestora-backup-'+todayIso()+'.json';
    let done=false;
    try{const f=new File([blob],name,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Vestora backup'});done=true}}catch(e){if(e.name==='AbortError')return}
    if(!done){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
    LS.set(BKEY,String(Date.now()));renderBackupNote();bkMsg('Έτοιμο. Κράτα το αρχείο σε ασφαλές μέρος, εκτός κινητού. Χωρίς τον κωδικό δεν ανοίγει.');
  }catch(e){console.warn(e);bkMsg('Δεν ήταν δυνατή η δημιουργία του αρχείου. Δοκίμασε την «Αντιγραφή ως κείμενο».',true)}});
$('bkCopy').addEventListener('click',async()=>{const pw=bkPw();if(!pw)return;
  try{const txt=await makeBackup(pw);let ok=false;try{await navigator.clipboard.writeText(txt);ok=true}catch(e){}
    if(!ok){$('rsText').value=txt;$('rsDetails').open=true;$('rsText').select()}
    LS.set(BKEY,String(Date.now()));renderBackupNote();bkMsg(ok?'Αντιγράφηκε. Επικόλλησέ το κάπου ασφαλές, π.χ. σε σημείωση με κωδικό.':'Το κείμενο εμφανίζεται στο πεδίο επαναφοράς: αντέγραψέ το από εκεί.');
  }catch(e){console.warn(e);bkMsg('Δεν ήταν δυνατή η δημιουργία του αντιγράφου.',true)}});
$('rsFile').addEventListener('change',async e=>{const f=e.target.files[0];if(f)$('rsText').value=await f.text()});
let rsArmed=false;
$('rsGo').addEventListener('click',async()=>{const m=$('rsMsg');m.classList.remove('neg');
  const txt=$('rsText').value,pw=$('rsPw').value;if(!txt.trim()){m.textContent='Διάλεξε αρχείο ή επικόλλησε το κείμενο.';return}
  try{const p=await openBackup(txt,pw);
    if(state.tx.length&&!state.sample&&!rsArmed){rsArmed=true;m.textContent=`Το αντίγραφο έχει ${p.portfolio.tx.length} συναλλαγές και θα αντικαταστήσει τις ${state.tx.length} που υπάρχουν τώρα. Πάτα ξανά για επιβεβαίωση.`;$('rsGo').textContent='Επιβεβαίωση επαναφοράς';return}
    state=p.portfolio;state.custom=state.custom||{};state.mints=state.mints||{};state.onboarded=true;state.sample=false;save();
    if(p.plan){plan=Object.assign(plan,p.plan);savePlan()}
    rsArmed=false;$('rsGo').textContent='Επαναφορά';$('rsText').value='';$('rsPw').value='';targetBuilt=false;
    assetOptions('fAsset');$('onb').hidden=true;render();m.textContent=`Επαναφέρθηκαν ${state.tx.length} συναλλαγές.`;livePrices();
  }catch(e){m.textContent=e.message;m.classList.add('neg')}});
function renderBackupNote(){
  const t=+LS.get(BKEY)||0,el=$('bkLast'),days=t?Math.floor((Date.now()-t)/DAY):null;
  el.textContent=t?`Τελευταίο αντίγραφο: ${longDate(iso(new Date(t)))}`:'Δεν έχεις κάνει ακόμα αντίγραφο ασφαλείας.';
  const need=state.tx.length>0&&!state.sample&&(days==null||days>30);
  $('bkNudge').hidden=!need;
}
$('bkNudgeGo').addEventListener('click',()=>{go('tx');setTimeout(()=>$('backupPanel').scrollIntoView({block:'start'}),50)});

/* ---------- settings ---------- */
$('btnSample').addEventListener('click',()=>{state=sample();save();targetBuilt=false;plan.target=null;assetOptions('fAsset');render();go('home');toast('Φορτώθηκε το παράδειγμα.')});
$('btnClear').addEventListener('click',e=>{const b=e.currentTarget;
  if(!b.classList.contains('danger')){b.classList.add('danger');b.textContent='Σίγουρα; Διαγράφονται όλα';setTimeout(()=>{if(b.isConnected){b.classList.remove('danger');b.textContent='Διαγραφή όλων των στοιχείων'}},4000);return}
  b.classList.remove('danger');b.textContent='Διαγραφή όλων των στοιχείων';
  state={sample:false,onboarded:false,custom:{},mints:{},tx:[]};save();LS.del(PKEY);LS.del(EKEY);LS.del(GKEY);plan={goal:null,monthly:null,years:15,fee:.3,ass:'0',real:'1',target:null,next:null,exp:'',res:'',inc:'',vr:'',debt:'',tol:'30',b:null,bShow:true};targetBuilt=false;
  assetOptions('fAsset');render();openOnb()});
$('btnGuide').addEventListener('click',()=>{LS.del(GKEY);openOnb()});
document.querySelectorAll('[data-lang]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.lang===LANG);b.addEventListener('click',()=>{if(b.dataset.lang===LANG)return;LS.set('vestora-lang',b.dataset.lang);location.reload()})});
$('bannerGo').addEventListener('click',()=>{state={sample:false,onboarded:false,custom:{},mints:{},tx:[]};save();plan.target=null;targetBuilt=false;render();openOnb()});
function renderBanner(){$('banner').hidden=!state.sample}

/* ---------- first-run guide ---------- */
let onb={step:0,rows:[{a:'',v:'',name:''}],monthly:'',years:15,goal:'',tol:'30'};
const TOLS=[['10','Έως −10%','Μια μικρή πτώση θα με αγχώσει.'],['20','Έως −20%','Αντέχω μια μέτρια διόρθωση.'],['30','Έως −30%','Αντέχω μια σοβαρή πτώση.'],['50','Έως −50%','Έχω περάσει μεγάλες πτώσεις χωρίς να πουλήσω.'],['70','Έως −70%','Αντέχω πτώσεις τύπου crypto.']];
function openOnb(){arm();onb={step:0,rows:[{a:'',v:'',name:''}],monthly:plan.monthly!=null&&state.tx.length?String(plan.monthly):'',years:+plan.years||15,goal:plan.goal&&state.tx.length?String(plan.goal):'',tol:plan.tol||'30'};$('onb').hidden=false;renderOnb()}
function onbAssetSelect(i,r){
  const groups={crypto:[],etf:[],stock:[],cash:[]};
  for(const [k,a] of Object.entries(ASSETS).sort((a,b)=>a[1].name.localeCompare(b[1].name,'el')))groups[a.cls]?.push(`<option value="${k}"${r.a===k?' selected':''}>${esc(a.name)}</option>`);
  return `<select id="ob_a${i}" data-i="${i}" data-k="a" aria-label="Επένδυση ${i+1}"><option value="">Διάλεξε…</option>${['crypto','etf','stock','cash'].map(c=>`<optgroup label="${CLS[c]}">${groups[c].join('')}</optgroup>`).join('')}<option value="__new"${r.a==='__new'?' selected':''}>Ακίνητο ή κάτι άλλο</option></select>`;
}
function renderOnb(){
  const box=$('onbBody'),s=onb.step,dots=[1,2,3,4].map(n=>`<i class="${n<=s?'on':''}"></i>`).join('');
  $('onbDots').innerHTML=s?dots:'';
  const mine=state.tx.length>0&&!state.sample;
  if(s===0){box.innerHTML=`<div class="onbhero"><div class="mark big" aria-hidden="true">${MARK}</div><h1>Vestora</h1><p class="lead">Δες πώς πάνε οι επενδύσεις σου σε σύγκριση με απλές εναλλακτικές, και σχεδίασε τη συνέχεια με ρεαλιστικά νούμερα.</p>
    <ul class="onbl"><li>Crypto, μετοχές, ETF, χρυσός, ακίνητα και ό,τι άλλο, σε ένα μέρος.</li><li>Τα στοιχεία σου μένουν μόνο σε αυτή τη συσκευή.</li><li>Δεν σου λέει τι να αγοράσεις. Σου δείχνει τι σημαίνει κάθε επιλογή.</li></ul></div>
    ${mine?'<p class="muted small">Ό,τι προσθέσεις στον οδηγό μπαίνει μαζί με όσα έχεις ήδη. Δεν σβήνεται τίποτα.</p>':''}
    <div class="onbbtns"><button class="btn primary" type="button" data-o="next">Ξεκίνα</button>${mine?'':'<button class="btn" type="button" data-o="sample">Δες ένα παράδειγμα</button><button class="btn ghost" type="button" data-o="restore">Έχω αντίγραφο ασφαλείας</button>'}${mine?'<button class="btn ghost" type="button" data-o="close">Κλείσιμο</button>':''}</div>`;return}
  if(s===1){
    const have=mine&&D?D.hold.length:0,lk=isPro()?'':LOCK;
    box.innerHTML=`<h2>Τι έχεις σήμερα;</h2><p class="muted">Πρόσθεσε ό,τι έχεις με όποιον τρόπο σε βολεύει. Μπορείς να τους συνδυάσεις.</p>
    ${have?`<div class="verdict ok">${have===1?'Έχει προστεθεί 1 θέση':`Έχουν προστεθεί ${have} θέσεις`}, συνολικής αξίας <span class="num">${eur.format(D.end)}</span>.</div>`:''}
    ${`<h3 class="sub">Αυτόματα, από το blockchain</h3><div class="opts">
      <button class="opt wallet-only" type="button" data-o="wallet"><span class="ic" style="background:var(--c-crypto)" aria-hidden="true">S</span><span><b>Solana wallet${lk}</b><small>Σύνδεση wallet. Μπαίνουν tokens και xStocks. Μόνο ανάγνωση, χωρίς υπογραφές.</small></span></button>
      <button class="opt" type="button" data-o="eth"><span class="ic" style="background:var(--c-stock)" aria-hidden="true">E</span><span><b>Διεύθυνση Ethereum${lk}</b><small>Επικολλάς τη δημόσια διεύθυνση. Χωρίς σύνδεση wallet, μόνο ανάγνωση.</small></span></button></div>`}
    <h3 class="sub">Με το χέρι</h3><p class="muted small">Μετοχές, ETF, crypto σε ανταλλακτήριο, καταθέσεις, ακίνητα. Βάλε την αξία που έχει σήμερα το καθένα, όσο περίπου. Αργότερα, στις συναλλαγές, μπορείς να βάλεις πότε και σε ποια τιμή αγόρασες, για ακριβή απόδοση.</p>
    <div class="obrows">${onb.rows.map((r,i)=>`<div class="obrow">${onbAssetSelect(i,r)}${r.a==='__new'?`<input id="ob_n${i}" data-i="${i}" data-k="name" placeholder="π.χ. Διαμέρισμα" value="${esc(r.name)}" aria-label="Όνομα">`:''}<input id="ob_v${i}" data-i="${i}" data-k="v" type="number" min="0" step="10" inputmode="decimal" placeholder="Αξία σήμερα €" value="${esc(r.v)}" aria-label="Αξία σήμερα σε ευρώ">${onb.rows.length>1?`<button class="x" type="button" data-o="rm" data-i="${i}" aria-label="Αφαίρεση">×</button>`:''}</div>`).join('')}</div>
    <button class="btn" type="button" data-o="add">+ Άλλη μία</button>
    <p class="neg small" id="obMsg" role="status"></p>
    <div class="onbbtns"><button class="btn primary" type="button" data-o="next">Συνέχεια</button>${have?'':'<button class="btn ghost" type="button" data-o="skip">Δεν έχω ακόμα επενδύσεις</button>'}</div>`;return}
  if(s===2){box.innerHTML=`<h2>Πόσα μπορείς να βάζεις τον μήνα;</h2><p class="muted">Το ποσό που μπορείς να επενδύεις σταθερά, χωρίς να πιεστείς. Μπορεί να είναι και 0.</p>
    <div class="f"><label for="ob_m">Μηνιαία καταβολή €</label><input id="ob_m" data-k="monthly" type="number" min="0" step="10" inputmode="numeric" value="${esc(onb.monthly)}" placeholder="π.χ. 150"></div>
    <div class="chips">${[50,100,200,300,500].map(v=>`<button type="button" data-o="setm" data-v="${v}">${v} €</button>`).join('')}</div>
    <div class="onbbtns"><button class="btn primary" type="button" data-o="next">Συνέχεια</button><button class="btn ghost" type="button" data-o="back">Πίσω</button></div>`;return}
  if(s===3){box.innerHTML=`<h2>Για πόσο καιρό και για ποιο στόχο;</h2><p class="muted">Ο στόχος μπορεί να είναι ένα ποσό, ένα σπίτι, οικονομική ανεξαρτησία. Βάλε το ποσό που αντιστοιχεί, σε σημερινά ευρώ.</p>
    <div class="f"><label for="ob_y">Χρόνια <output class="num" id="ob_yo">${onb.years}</output></label><input id="ob_y" data-k="years" type="range" min="1" max="40" value="${onb.years}"></div>
    <div class="f"><label for="ob_g">Στόχος €</label><input id="ob_g" data-k="goal" type="number" min="0" step="1000" inputmode="numeric" value="${esc(onb.goal)}" placeholder="π.χ. 50000"></div>
    <div class="onbbtns"><button class="btn primary" type="button" data-o="next">Συνέχεια</button><button class="btn ghost" type="button" data-o="back">Πίσω</button></div>`;return}
  if(s===4){box.innerHTML=`<h2>Πόση πτώση θα άντεχες χωρίς να πουλήσεις;</h2><p class="muted">Σκέψου την αξία των επενδύσεών σου να πέφτει για μήνες. Μέχρι πού θα έμενες ήρεμος;</p>
    <div class="opts">${TOLS.map(([v,t,d])=>`<button class="opt${onb.tol===v?' sel':''}" type="button" data-o="tol" data-v="${v}" aria-pressed="${onb.tol===v}"><span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>
    <p class="neg small" id="obMsg" role="status"></p>
    <div class="onbbtns"><button class="btn primary" type="button" data-o="finish">Δες το πλάνο σου</button><button class="btn ghost" type="button" data-o="back">Πίσω</button></div>`;return}
}
$('onbBody').addEventListener('input',e=>{const el=e.target,k=el.dataset.k;if(!k)return;
  if(el.dataset.i!=null){onb.rows[+el.dataset.i][k]=el.value;if(k==='a')renderOnb()}
  else{onb[k]=el.value;if(k==='years')$('ob_yo').textContent=el.value}});
$('onbBody').addEventListener('click',e=>{const b=e.target.closest('[data-o]');if(!b)return;const o=b.dataset.o;
  if(o==='sample'){state=sample();save();plan.target=null;targetBuilt=false;assetOptions('fAsset');$('onb').hidden=true;render();go('home');return}
  if(o==='restore'){$('onb').hidden=true;go('tx');$('rsDetails').open=true;setTimeout(()=>$('backupPanel').scrollIntoView({block:'start'}),50);return}
  if(o==='add'){onb.rows.push({a:'',v:'',name:''});renderOnb();$('ob_a'+(onb.rows.length-1))?.focus();return}
  if(o==='rm'){onb.rows.splice(+b.dataset.i,1);renderOnb();return}
  if(o==='wallet'){if(!wallet)openSheet('pick');else if(isPro()){flow.imp=null;openSheet('import')}else openSheet('done');return}
  if(o==='eth'){openEth();return}
  if(o==='setm'){onb.monthly=b.dataset.v;renderOnb();return}
  if(o==='tol'){onb.tol=b.dataset.v;renderOnb();return}
  if(o==='back'){onb.step=Math.max(0,onb.step-1);renderOnb();return}
  if(o==='skip'){onb.rows=[];onb.step=2;renderOnb();return}
  if(o==='next'){
    if(onb.step===1){const bad=onb.rows.find(r=>(r.a||r.v)&&(!r.a||!(+r.v>0)||r.a==='__new'&&!r.name.trim()));
      if(bad){$('obMsg').textContent='Συμπλήρωσε επένδυση και αξία σε κάθε γραμμή, ή αφαίρεσε τη γραμμή.';return}}
    onb.step++;renderOnb();$('onbBody').querySelector('input,button')?.focus();return}
  if(o==='finish')finishOnb();
  if(o==='close'){$('onb').hidden=true;render()}
});
function finishOnb(){
  if(state.sample)state={sample:false,onboarded:false,custom:{},mints:{},tx:[]};
  const date=todayIso();
  for(const r of onb.rows){const v=+r.v;if(!r.a||!(v>0))continue;
    if(r.a==='__new'){const id='c_'+uid();state.custom[id]={name:r.name.trim(),cls:'other',current:v};state.tx.push({id:uid(),a:id,type:'buy',date,qty:1,price:v,fee:0,reason:''})}
    else{const p=nowPrice(r.a);if(!(p>0))continue;state.tx.push({id:uid(),a:r.a,type:'buy',date,qty:+(v/p).toPrecision(8),price:+p.toPrecision(8),fee:0,reason:''})}}
  state.onboarded=true;save();
  plan.monthly=+onb.monthly||0;plan.years=+onb.years||15;plan.goal=+onb.goal||plan.goal||50000;plan.tol=onb.tol;plan.target=null;plan.next=null;plan.b=null;targetBuilt=false;savePlan();
  LS.del(GKEY);$('onb').hidden=true;assetOptions('fAsset');render();go('home');toast('Έτοιμο. Δες παρακάτω τι δείχνουν τα στοιχεία σου και το πλάνο σου.');
}

/* ---------- "three steps" card on the summary: what you have, what it shows, your plan ---------- */
const GKEY='vestora-guide-off';
function renderGuide(D){
  const box=$('guide');if(!box)return;
  if(state.sample||LS.get(GKEY)==='1'){box.hidden=true;return}
  box.hidden=false;
  const step=(n,done,title,body)=>`<li class="${done?'done':''}"><span class="n" aria-hidden="true">${done?'✓':n}</span><div><b>${title}</b>${body}</div></li>`;
  let h;
  if(!D||!D.hold.length){
    h=step(1,false,'Πρόσθεσε ό,τι έχεις',`<p>${PLAY?'Από διεύθυνση Ethereum ή με το χέρι.':'Από Solana wallet, από διεύθυνση Ethereum ή με το χέρι.'}</p><div class="gbtns"><button class="btn primary" type="button" data-g="add">Πρόσθεσε τώρα</button></div>`)
     +step(2,false,'Δες τι δείχνουν τα στοιχεία σου','<p class="muted">Εμφανίζεται μόλις προσθέσεις θέσεις.</p>')
     +step(3,false,'Δούλεψε το πλάνο σου','<p class="muted">Στόχος, μηνιαία καταβολή και τι χρειάζεται.</p>');
  }else{
    const top=D.hold[0],w=toW(curAlloc(D)),st=stressCalc(D,'all'),dd=Math.max(0,-st.pct),tol=(+plan.tol||30)/100;
    const mix=PK.filter(k=>w[k]>=.005).sort((a,b)=>w[b]-w[a]).map(k=>`${PC[k].n} <span class="num">${nf(0).format(w[k]*100)}%</span>`).join(', ');
    const R=lastProj;
    h=step(1,true,D.hold.length===1?'Έχεις 1 θέση':`Έχεις ${D.hold.length} θέσεις`,`<p>Συνολική αξία <span class="num">${eur.format(D.end)}</span>. Αν λείπει κάτι, πρόσθεσέ το για να είναι σωστή η εικόνα.</p><div class="gbtns"><button class="btn" type="button" data-g="add">Πρόσθεσε κι άλλα</button></div>`)
     +step(2,true,'Τι δείχνουν τα στοιχεία σου',`<ul>
        <li>Μεγαλύτερη θέση: ${esc(meta(top.a).name)}, <span class="num">${nf(0).format(top.wt*100)}%</span> του συνόλου${top.wt>=.4&&D.hold.length>1?'. Το αποτέλεσμά σου εξαρτάται κυρίως από αυτήν':''}.</li>
        <li>Κατανομή: ${mix}.</li>
        <li>Στο σενάριο πτώσης «Όλα μαζί» η αξία πέφτει περίπου <span class="num">${nf(0).format(dd*100)}%</span> (<span class="num">${eur.format(st.tot)}</span>). Δήλωσες ότι αντέχεις έως <span class="num">−${nf(0).format(tol*100)}%</span>: ${dd<=tol?'<b class="pos">μέσα στο όριό σου</b>':'<b class="neg">πάνω από το όριό σου</b>'}.</li></ul>
        <div class="gbtns"><button class="btn" type="button" data-g="ins">Όλες οι παρατηρήσεις</button><button class="btn" type="button" data-g="risk">Σενάρια πτώσης</button></div>`)
     +step(3,false,'Δούλεψε το πλάνο σου',(R?`<p><span class="num">${eur.format(R.args.monthly)}</span> τον μήνα για ${R.args.years} χρόνια. Στόχος <span class="num">${eur.format(R.args.goal)}</span>: πιάνεται σε <b class="num">${Math.round(R.hit*100)} από τα 100</b> σενάρια.</p>`:'')+`<div class="gbtns"><button class="btn primary" type="button" data-g="plan">Άνοιξε το πλάνο</button></div>`);
  }
  box.innerHTML=`<div class="phead"><div><h2>Τα 3 βήματα</h2><div class="muted small">Τι έχεις, τι δείχνει, πώς συνεχίζεις</div></div><button class="x" type="button" data-g="hide" aria-label="Απόκρυψη">×</button></div><ol class="gsteps">${h}</ol>`;
}
$('guide').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;const g=b.dataset.g;
  if(g==='hide'){LS.set(GKEY,'1');renderGuide(D);toast('Ο οδηγός κρύφτηκε. Τον ξαναβρίσκεις στις Συναλλαγές, «Οδηγός ξεκινήματος».');return}
  if(g==='add'){openOnb();onb.step=1;renderOnb();return}
  if(g==='ins'){document.querySelector('#insights').closest('.panel').scrollIntoView({block:'start',behavior:'smooth'});return}
  if(g==='risk')return go('risk');
  if(g==='plan')return go('plan')});
$('planHow').addEventListener('click',e=>{const b=e.target.closest('[data-h]');if(!b)return;
  if(b.dataset.h==='tx'){go('tx');setTimeout(()=>$('fAsset').focus(),60)}
  else if(b.dataset.h==='next'){const m=$('planMore');m.open=true;$('nAmt').scrollIntoView({block:'center',behavior:'smooth'})}
  else if(b.dataset.h==='risk')go('risk')});

/* ---------- views (bottom tabs) ---------- */
const VIEWS=['home','plan','risk','tx'];
function go(v){if(!VIEWS.includes(v))v='home';if(location.hash!=='#'+v)history.replaceState(null,'','#'+v);show(v)}
function show(v){
  VIEWS.forEach(k=>{$('v-'+k).hidden=k!==v;const t=document.querySelector(`.tabs [data-v="${k}"]`);t.setAttribute('aria-current',k===v?'page':'false')});
  $('btnHome').hidden=v==='home';
  if(!RM.matches){const el=$('v-'+v);el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter')}
  window.scrollTo(0,0);requestAnimationFrame(redraw);if(typeof arm==='function')arm();
}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(b)go(b.dataset.v)});
addEventListener('hashchange',()=>show(VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):'home'));
function closeOnb(){$('onb').hidden=true;if(!state.onboarded){state.onboarded=true;save()}render()}
function goHome(){if(!$('overlay').hidden)closeSheet();if(!$('onb').hidden)closeOnb();go('home')}
$('onbHome').addEventListener('click',goHome);
$('btnHome').addEventListener('click',goHome);
$('brandHome').addEventListener('click',goHome);$('brandHome').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goHome()}});
$('btnAdd').addEventListener('click',()=>{go('tx');setTimeout(()=>$('fAsset').focus(),60)});
/* Android back button: close what is open, step back in the guide, return to Summary, and only then leave the app.
   One extra history entry acts as a guard; each handled back press re-arms it. */
let armed=false,booted=false;
function arm(){if(booted&&!armed){history.pushState({vestora:1},'',location.hash||'#home');armed=true}}
addEventListener('popstate',()=>{
  armed=false;let handled=true;
  if(!$('overlay').hidden)closeSheet();
  else if(!$('onb').hidden){if(onb.step>0){onb.step--;renderOnb()}else{closeOnb();go('home')}}
  else if(VIEWS.some(k=>!$('v-'+k).hidden&&k!=='home')){history.replaceState(null,'','#home');show('home')}
  else handled=false;
  if(handled)arm();
  else toast('Πάτα ξανά «πίσω» για έξοδο.');
});

let toastT;function toast(t,ok){const el=$('toast');el.textContent=t;el.classList.toggle('ok',!!ok);el.hidden=false;el.classList.remove('in');void el.offsetWidth;el.classList.add('in');clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,3200)}
/* visual feedback: the total counts to its new value, and pulses green or red when it changed because of something you did */
const RM=matchMedia('(prefers-reduced-motion: reduce)');
let cuRaf=0;
function countUp(prev,D){
  const el=$('totVal');if(!D||prev==null||RM.matches||Math.abs(D.end-prev)<0.5)return;
  const from=prev,to=D.end,t0=performance.now(),dur=650;cancelAnimationFrame(cuRaf);
  const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=eur.format(from+(to-from)*e);if(k<1)cuRaf=requestAnimationFrame(step)};
  cuRaf=requestAnimationFrame(step);
  el.classList.remove('up','down');void el.offsetWidth;el.classList.add(to>from?'up':'down');
}
function renderPriceNote(){
  if(!DATA)return;const u=new Date(DATA.updated),age=(Date.now()-u)/DAY;
  $('priceNote').innerHTML=`Τιμές: κλείσιμο ${longDate(iso(u))}${liveAt?', ζωντανές για crypto και xStocks':''}.${age>4?' <b class="neg">Οι τιμές δεν έχουν ενημερωθεί για μερικές μέρες.</b>':''}`;
}

function render(){renderWallet();const prev=D?D.end:null;D=compute();renderSummary(D);countUp(prev,D);renderChart(D);renderDD(D);renderStory(D);renderHoldings(D);renderInsights(D);renderPlan(D);renderGuide(D);renderStress(D);renderJournal();renderTx();renderBanner();renderPriceNote();renderBackupNote()}
const redraw=()=>{if(!W)return;renderChart(D);if(!$('v-risk').hidden)renderDD(D);if(lastProj)drawProj(lastProj,plan.bShow!==false?lastB:null)};
let rt;const ro=new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(redraw,80)});ro.observe($('chartbox'));ro.observe($('ddBox'));ro.observe($('projBox'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redraw);
const MARK='<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M5 9 L16 25 L27 9" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="9" r="3.2" fill="var(--accent)"/></svg>';

async function boot(){
  $('loadMsg').textContent='Φορτώνουν οι τιμές…';$('loadRetry').hidden=true;
  try{const r=await fetch('data/history.json',{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);applyData(await r.json())}
  catch(e){console.warn(e);$('loadMsg').textContent='Δεν ήταν δυνατή η φόρτωση των τιμών. Έλεγξε τη σύνδεση στο internet.';$('loadRetry').hidden=false;return}
  $('loading').hidden=true;$('app').hidden=false;
  $('fDate').max=todayIso();$('fDate').min=iso(wDate(0));$('fDate').value=todayIso();
  assetOptions('fAsset');autoPrice();render();
  show(VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):'home');
  if(!state.onboarded&&!state.tx.length)openOnb();
  booted=true;arm();
  livePrices();if(wallet&&!PLAY)checkWallet(false);
  setInterval(()=>{if(document.visibilityState==='visible')livePrices()},5*60e3);
}
$('loadRetry').addEventListener('click',boot);
document.querySelectorAll('.markslot').forEach(el=>el.innerHTML=MARK);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
})();
