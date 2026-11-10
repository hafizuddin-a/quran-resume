#!/usr/bin/env python3
"""Builds phone/public/privacy.html and terms.html from PRIVACY.md and TERMS.md,
so the policy the phone app links to always matches the one in this repo.
Run it after editing either file: python3 tools/build-legal.py"""
import html, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = {'PRIVACY.md': ('privacy.html', 'Privacy Policy'), 'TERMS.md': ('terms.html', 'Terms of Use')}
LINKS = {'PRIVACY.md': 'privacy', 'TERMS.md': 'terms'}  # Cloudflare serves the pages without .html

def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    def link(m):
        href = LINKS.get(m.group(2), m.group(2))
        ext = '' if href in LINKS.values() else ' target="_blank" rel="noopener"'
        return f'<a href="{html.escape(href)}"{ext}>{m.group(1)}</a>'
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    return re.sub(r'(?<![">])(https://[^\s<)]+)', r'<a href="\1">\1</a>', text)

def convert(md):
    out, para, lines = [], [], md.splitlines()
    def flush():
        if para:
            out.append(f'<p>{inline(" ".join(para))}</p>')
            para.clear()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            flush(); i += 1; continue
        if line.startswith('#'):
            flush()
            level = len(line) - len(line.lstrip('#'))
            out.append(f'<h{level}>{inline(line[level:].strip())}</h{level}>')
            i += 1; continue
        if line.startswith('|'):
            flush()
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            head, body = rows[0], [r for r in rows[1:] if not set(''.join(r)) <= set('- :')]
            out.append('<div class="table"><table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>'
                       + ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body) + '</tbody></table></div>')
            continue
        if line.startswith('- '):
            flush()
            items = []
            while i < len(lines) and (lines[i].startswith('- ') or lines[i].startswith('  ')):
                if lines[i].startswith('- '): items.append(lines[i][2:].strip())
                else: items[-1] += ' ' + lines[i].strip()
                i += 1
            out.append('<ul>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + '</ul>')
            continue
        para.append(line.strip()); i += 1
    flush()
    return '\n'.join(out)

TEMPLATE = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} · Quran Resume</title>
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1f2125" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="icon.svg" type="image/svg+xml">
  <style>
    :root {{ color-scheme: light dark; --bg: #fff; --text: #272727; --muted: #666; --line: #ebeef0; --accent: #1f8187; }}
    @media (prefers-color-scheme: dark) {{ :root {{ --bg: #1f2125; --text: #e7e9ea; --muted: #a0a4a8; --line: #3a3f44; --accent: #e3b563; }} }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
    main {{ max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }}
    .back {{ display: inline-block; margin-bottom: 16px; color: var(--accent); text-decoration: none; font-weight: 500; }}
    h1 {{ font-size: 28px; line-height: 1.25; margin: 0 0 8px; }}
    h2 {{ font-size: 20px; margin: 32px 0 8px; }}
    h3 {{ font-size: 17px; margin: 24px 0 8px; }}
    p, li {{ color: var(--text); }}
    a {{ color: var(--accent); overflow-wrap: anywhere; }}
    ul {{ padding-left: 22px; }}
    li {{ margin: 6px 0; }}
    .table {{ overflow-x: auto; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 15px; }}
    th, td {{ text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }}
    th {{ color: var(--muted); font-weight: 600; }}
    code {{ font-size: .9em; }}
  </style>
</head>
<body>
  <main>
    <a class="back" href="./">← Quran Resume</a>
{body}
  </main>
</body>
</html>
'''

for src, (dest, title) in PAGES.items():
    md = (ROOT / src).read_text(encoding='utf-8')
    md = re.sub(r'^Also at https://\S+\n\n?', '', md, flags=re.M)  # the page itself
    (ROOT / 'phone/public' / dest).write_text(TEMPLATE.format(title=title, body=convert(md)), encoding='utf-8')
    print('wrote', dest)
