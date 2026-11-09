#!/usr/bin/env bash
# Builds ../index.html from the sources in this folder.
# The Greek text in the sources is the original; English comes from en_dict.json (Greek -> English).
# If you add or change Greek text, add its English to en_dict.json, or the build stops and lists what is missing.
set -e
cd "$(dirname "$0")"
python3 i18n_extract.py >/dev/null
python3 i18n_runtime.py
python3 - <<'PY'
core=open('i18n/js_core.js',encoding='utf-8').read();rt=open('i18n/runtime.js',encoding='utf-8').read()
assert core.count("'use strict';\n")==1;core=core.replace("'use strict';\n","'use strict';\n"+rt,1)
parts=[open(f,encoding='utf-8').read() for f in ['head.html','css_base.css','css_extra.css','body_top.html','plan_section.html','body_bottom.html']]
js=core+open('i18n/js_plan.js',encoding='utf-8').read()+open('i18n/js_app.js',encoding='utf-8').read()
open('../index.html','w',encoding='utf-8').write(''.join(parts)+js+'</script>\n</body>\n</html>\n')
PY
rm -rf i18n i18n_strings.json
echo "index.html built"
