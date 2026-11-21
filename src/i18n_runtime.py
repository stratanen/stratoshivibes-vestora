import json,sys
d=json.load(open('en_dict.json',encoding='utf-8'));s=json.load(open('i18n_strings.json',encoding='utf-8'))
miss=[g for g in s['js'] if g not in d['js']]+[g for g in s['html'] if g not in d['html']]
if miss:
    print('MISSING TRANSLATIONS:',len(miss));[print('  ',repr(m[:90])) for m in miss];sys.exit(1)
js=json.dumps({g:d['js'][g] for g in s['js']},ensure_ascii=False)
ht=json.dumps({g:d['html'][g] for g in s['html']},ensure_ascii=False)
# amounts that are fixed in euros (a threshold, not the user's money) keep the euro sign in dollar mode
ex=json.dumps([g for g in s['js'] if 'αξίας 20 €' in g or 'πάνω από 1 €' in g],ensure_ascii=False)
open('i18n/runtime.js','w',encoding='utf-8').write(f"""
/* ---------- language: Greek or English (from the phone's language, or the choice in Settings) ---------- */
const LANG=(()=>{{try{{const s=localStorage.getItem('vestora-lang');if(s==='en'||s==='el')return s}}catch(e){{}}return /^el\\b/i.test(navigator.language||'')?'el':'en'}})();
const EN_JS={js};
const EN_HTML={ht};
const CUR=(()=>{{try{{return localStorage.getItem('vestora-cur')==='USD'?'USD':'EUR'}}catch(e){{return 'EUR'}}}})();
const CS=CUR==='USD'?'$':'€';
const CURXS=CUR==='USD'?(s=>typeof s==='string'?s.replace(/€/g,()=>'$'):s):(s=>s);
const CURX=CUR==='USD'?(s=>typeof s!=='string'?s:CURXS(s).replace(/σημερινά ευρώ/g,()=>'σημερινά δολάρια').replace(/στόχο σε ευρώ/g,()=>'στόχο σε δολάρια').replace(/Αξία σήμερα σε ευρώ/g,()=>'Αξία σήμερα σε δολάρια').replace(/today[’']s euros/gi,m=>m.replace('euros','dollars')).replace(/goal in euros/gi,m=>m.replace('euros','dollars')).replace(/Value today in euros/g,()=>'Value today in dollars')):(s=>s);
const EXCUR=new Set({ex});
const _=(i,g)=>{{const t=LANG==='en'?(EN_JS[g]??g):g;return EXCUR.has(g)?t:CURX(t)}};
const LOC=LANG==='en'?'en-IE':'el-GR';
document.documentElement.lang=LANG;
if(LANG==='en'){{
  const tr=t=>{{const k=t.replace(/\\s+/g,' ').trim();if(!k||!(k in EN_HTML))return t;const m=t.match(/^\\s*/)[0],n=t.match(/\\s*$/)[0];return m+EN_HTML[k]+n}};
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{{acceptNode:n=>n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(n=>{{n.nodeValue=tr(n.nodeValue)}});
  document.querySelectorAll('[placeholder],[aria-label],[title],[data-n]').forEach(el=>{{for(const a of ['placeholder','aria-label','title','data-n'])if(el.hasAttribute(a))el.setAttribute(a,tr(el.getAttribute(a)))}});
}}
if(CUR==='USD'){{
  const w2=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{{acceptNode:n=>n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const ns=[];while(w2.nextNode())ns.push(w2.currentNode);ns.forEach(n=>{{n.nodeValue=CURX(n.nodeValue)}});
  document.querySelectorAll('[placeholder],[aria-label],[title],[data-n]').forEach(el=>{{for(const a of ['placeholder','aria-label','title','data-n'])if(el.hasAttribute(a))el.setAttribute(a,CURX(el.getAttribute(a)))}});
}}
""")
print('runtime ok')
