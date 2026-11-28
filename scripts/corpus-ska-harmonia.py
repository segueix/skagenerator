# Converteix les progressions de data/corpus-ska/ a la taula CORPUS_HARMONY de radioambient.js.
# Ús: python3 scripts/corpus-ska-harmonia.py data/corpus-ska
import json, re, sys
src = sys.argv[1]
d = json.load(open(src + '/corpus_ska.json'))
SEC = {'estrofa': 'verse', 'tornada': 'chorus', 'intro': 'intro', 'coda': 'outro', 'interludi': 'bridge', 'pont': 'bridge', 'solo': 'solo', 'tema_instrumental': 'solo', 'pre_tornada': 'prechorus'}
def subgenres(fam, estil):
    if estil in ('rocksteady', 'ska_rocksteady', 'dub'): return ['rocksteady', 'bossreggae']
    if estil == 'reggae_primerenc': return ['bossreggae', 'rocksteady']
    if estil == 'ska_reggae': return ['bossreggae', 'twotone'] if fam != 'jamaica' else ['bossreggae']
    if estil in ('ska_jazz', 'ska_soul'): return ['skaswing', 'jamaican']
    if estil == 'ska_punk': return ['skapunk']
    if estil in ('ska_surf', 'ska_rock_folk'): return ['skapunk', 'twotone']
    if fam == 'jamaica': return ['jamaican', 'skaswing']
    if fam == 'dos_tons': return ['twotone', 'nutty']
    if fam == 'paisos_catalans': return ['skapunk', 'twotone']
    return ['twotone', 'jamaican'] if estil != 'ska_instrumental' else ['jamaican', 'skaswing']
OK = re.compile(r'^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|maj7|7|sus4)?$')
def fix(sym, mode):
    sym = sym.replace('V7b9', 'V7')
    sym = re.sub(r'^(i)(maj7|6)$', r'\1', sym)
    if mode == 'minor' and sym in ('VII', 'VII7'): sym = 'b' + sym
    return sym if OK.match(sym) else None
def shape(p):
    if len(p) in (2, 4, 8): return p
    if len(p) == 3: return p + [p[-1]]
    return (p + [p[-1]] * 8)[:8]
out = {}
def add(sgs, mode, typ, prog):
    for sg in sgs:
        lst = out.setdefault(sg, {}).setdefault(mode, {}).setdefault(typ, [])
        if prog not in lst: lst.append(prog)
skipped = []
for x in d['cancons']:
    mode = 'minor' if x['tonalitat']['mode'] in ('menor', 'minor') else 'major'
    sgs = subgenres(x['familia'], x['estil'])
    progs = [p['graus'] for p in x['progressions'] if p.get('graus')]
    for i, g in enumerate(progs):
        fixed = [fix(s, mode) for s in g]
        if None in fixed or len(set(fixed)) < 2: skipped.append((x['id'], g)); continue
        p = shape(fixed)
        types = ['verse', 'chorus'] if len(progs) == 1 else (['verse'] if i == 0 else ['chorus'])
        for t in types: add(sgs, mode, t, p)
# Progressions amb secció (perfils_ska.json, general).
prof = json.load(open(src + '/perfils_ska.json'))
for sec, table in prof['general']['progressions_per_seccio'].items():
    for prog in table:
        g = prog.split(' > ')
        mode = 'minor' if g[0][0] == 'i' and g[0][:2] != 'iv' and g[0] not in ('ii', 'iii') else 'major'
        fixed = [fix(s, mode) for s in g]
        if None in fixed: skipped.append((sec, g)); continue
        # (Les de secció: per a tots els subgèneres d'ska que tenen aquest mode, menys el rocksteady, massa lent per a girs cromàtics.)
        add(['twotone', 'nutty', 'skapunk', 'jamaican'], mode, SEC[sec], shape(fixed))
print(json.dumps(out, ensure_ascii=False))
print('saltades', skipped, file=sys.stderr)
