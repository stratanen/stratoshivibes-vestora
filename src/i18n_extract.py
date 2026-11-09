#!/usr/bin/env python3
"""Finds Greek text in the JS sources and wraps each piece in _(id,"greek").
JS: quoted strings and the literal parts of template strings. HTML: text nodes and a few attributes.
Writes i18n_strings.json (id -> greek) and the wrapped sources into ./i18n/ ."""
import json, re, sys, os, html
from html.parser import HTMLParser

GREEK = re.compile('[Ͱ-Ͽἀ-῿]')
REGEX_PREV = set('(,=:[!&|?{};+-*%<>~^')
strings = {}   # greek -> id
order = []

def sid(text):
    if text not in strings:
        strings[text] = len(order); order.append(text)
    return strings[text]

def wrap_js(src):
    out = []; i = 0; n = len(src)
    stack = []  # for template nesting: each entry = brace depth inside ${}
    last_sig = ''
    def emit(s):
        out.append(s)
    def scan_template(i):
        """i at the char after the opening backtick. Returns (new_i). Handles ${ ... } recursively."""
        seg_start = i; buf = []
        def flush_seg(seg):
            if GREEK.search(seg):
                lead = len(seg) - len(seg.lstrip()); trail = len(seg) - len(seg.rstrip())
                core = seg[lead:len(seg) - trail] if trail else seg[lead:]
                k = sid(core)
                emit(seg[:lead] + '${_(' + str(k) + ',' + json.dumps(core, ensure_ascii=False).replace('`', '\\x60').replace('${', '$\\x7b') + ')}' + (seg[len(seg) - trail:] if trail else ''))
            else:
                emit(seg)
        while i < n:
            c = src[i]
            if c == '\\':
                buf.append(src[i:i + 2]); i += 2; continue
            if c == '`':
                flush_seg(''.join(buf)); emit('`'); return i + 1
            if c == '$' and i + 1 < n and src[i + 1] == '{':
                flush_seg(''.join(buf)); buf = []; emit('${')
                i = scan_code(i + 2, until_brace=True); emit('}')
                continue
            buf.append(c); i += 1
        raise SystemExit('unterminated template')
    def scan_code(i, until_brace=False):
        nonlocal last_sig
        depth = 0
        while i < n:
            c = src[i]
            if until_brace:
                if c == '{': depth += 1
                elif c == '}':
                    if depth == 0: return i + 1
                    depth -= 1
            if c == '/' and i + 1 < n and src[i + 1] == '/':
                j = src.find('\n', i); j = n if j < 0 else j; emit(src[i:j]); i = j; continue
            if c == '/' and i + 1 < n and src[i + 1] == '*':
                j = src.find('*/', i + 2) + 2; emit(src[i:j]); i = j; continue
            if c in '\'"':
                j = i + 1
                while src[j] != c:
                    j += 2 if src[j] == '\\' else 1
                lit = src[i:j + 1]; body = lit[1:-1]
                if GREEK.search(body):
                    val = json.loads('"' + body.replace('"', '\\"').replace("\\'", "'") + '"') if c == "'" else json.loads(lit)
                    emit('_(' + str(sid(val)) + ',' + json.dumps(val, ensure_ascii=False) + ')')
                else:
                    emit(lit)
                i = j + 1; last_sig = 'a'; continue
            if c == '`':
                emit('`'); i = scan_template(i + 1); last_sig = 'a'; continue
            if c == '/':
                # regex literal or division?
                prev = last_sig
                if prev == '' or prev in REGEX_PREV or prev == 'kw':
                    j = i + 1; in_cls = False
                    while True:
                        ch = src[j]
                        if ch == '\\': j += 2; continue
                        if ch == '[': in_cls = True
                        elif ch == ']': in_cls = False
                        elif ch == '/' and not in_cls: break
                        j += 1
                    j += 1
                    while j < n and src[j].isalpha(): j += 1
                    emit(src[i:j]); i = j; last_sig = 'a'; continue
            if not c.isspace():
                if c.isalnum() or c in '_$.':
                    m = re.match(r'[A-Za-z_$][\w$]*', src[i:])
                    if m:
                        word = m.group(0); emit(word); i += len(word)
                        last_sig = 'kw' if word in ('return', 'typeof', 'case', 'in', 'of', 'else', 'do') else 'a'; continue
                    last_sig = 'a'
                elif c in ')]':
                    last_sig = 'a'
                else:
                    last_sig = c
            emit(c); i += 1
        if until_brace: raise SystemExit('unterminated ${')
        return i
    scan_code(0)
    return ''.join(out)


class HTMLScan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.skip = 0; self.found = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
        for k, v in attrs:
            if k in ('placeholder', 'aria-label', 'title', 'data-n') and v and GREEK.search(v): self.found.append(v.strip())
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, d):
        if not self.skip and GREEK.search(d): self.found.append(' '.join(d.split()))


if __name__ == '__main__':
    os.makedirs('i18n', exist_ok=True)
    for f in ('js_core.js', 'js_plan.js', 'js_app.js'):
        w = wrap_js(open(f, encoding='utf-8').read())
        open('i18n/' + f, 'w', encoding='utf-8').write(w)
    js_count = len(order)
    hs = HTMLScan()
    for f in ('body_top.html', 'plan_section.html', 'body_bottom.html'):
        hs.feed(open(f, encoding='utf-8').read())
    html_strings = []
    for t in hs.found:
        if t not in html_strings: html_strings.append(t)
    json.dump({'js': order, 'html': html_strings}, open('i18n_strings.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('js strings', js_count, 'html strings', len(html_strings))
