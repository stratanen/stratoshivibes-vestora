import json,sys
d=json.load(open('en_dict.json',encoding='utf-8'));s=json.load(open('i18n_strings.json',encoding='utf-8'))
miss=[g for g in s['js'] if g not in d['js']]+[g for g in s['html'] if g not in d['html']]
if miss:
    print('MISSING TRANSLATIONS:',len(miss));[print('  ',repr(m[:90])) for m in miss];sys.exit(1)
js=json.dumps({g:d['js'][g] for g in s['js']},ensure_ascii=False)
ht=json.dumps({g:d['html'][g] for g in s['html']},ensure_ascii=False)
open('i18n/runtime.js','w',encoding='utf-8').write(f"""
/* ---------- language: Greek or English (from the phone's language, or the choice in Settings) ---------- */
const LANG=(()=>{{try{{const s=localStorage.getItem('vestora-lang');if(s==='en'||s==='el')return s}}catch(e){{}}return /^el\\b/i.test(navigator.language||'')?'el':'en'}})();
const EN_JS={js};
const EN_HTML={ht};
const _=(i,g)=>LANG==='en'?(EN_JS[g]??g):g;
const LOC=LANG==='en'?'en-IE':'el-GR';
document.documentElement.lang=LANG;
if(LANG==='en'){{
  const tr=t=>{{const k=t.replace(/\\s+/g,' ').trim();if(!k||!(k in EN_HTML))return t;const m=t.match(/^\\s*/)[0],n=t.match(/\\s*$/)[0];return m+EN_HTML[k]+n}};
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{{acceptNode:n=>n.parentNode&&/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(n=>{{n.nodeValue=tr(n.nodeValue)}});
  document.querySelectorAll('[placeholder],[aria-label],[title],[data-n]').forEach(el=>{{for(const a of ['placeholder','aria-label','title','data-n'])if(el.hasAttribute(a))el.setAttribute(a,tr(el.getAttribute(a)))}});
}}
""")
print('runtime ok')
