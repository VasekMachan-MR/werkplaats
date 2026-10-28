"""Porovná polohy všech slov ve dvou PDF (pdftotext -bbox). Tolerance 0,5 pt (= 0,18 mm)."""
import sys, subprocess, re, html
def slova(f):
    x = subprocess.run(['pdftotext', '-bbox', f, '-'], capture_output=True, text=True).stdout
    out = []; page = 0
    for line in x.splitlines():
        if '<page ' in line: page += 1
        m = re.search(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)</word>', line)
        if m: out.append((page, html.unescape(m.group(5)), *map(float, m.groups()[:4])))
    return out
a, b = slova(sys.argv[1]), slova(sys.argv[2])
zbyva = list(b); maxp = 0; chybi = []
for w in a:
    kand = [q for q in zbyva if q[0] == w[0] and q[1] == w[1]]
    if not kand: chybi.append(w); continue
    q = min(kand, key=lambda q: abs(q[2]-w[2]) + abs(q[3]-w[3]))
    zbyva.remove(q); maxp = max(maxp, abs(q[2]-w[2]), abs(q[3]-w[3]), abs(q[4]-w[4]))
ok = not chybi and not zbyva and maxp < 0.5
print(('OK' if ok else 'ROZDÍL'), f'slov {len(a)}/{len(b)}, největší posun {maxp:.2f} pt', (f'chybí {chybi[:3]} navíc {zbyva[:3]}' if (chybi or zbyva) else ''))
