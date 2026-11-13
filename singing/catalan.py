"""Català central escrit → fonemes de la veu (símbols ARPAbet de l'anglès), partits en síl·labes.

Fa les mateixes síl·labes que el comptador de l'app (wordStress a radioambient.js): una nota per
síl·laba. Diftongs decreixents (ai, ei, oi, ui, au, eu, ou) en una síl·laba; «gu/qu» + e/i amb la u muda.
Sons: a/e àtones → ə (ax), o àtona → u, ny → n+y, ll → l+y, x → sh, j/g(e,i) → zh, r simple entre
vocals → batec (dx), s entre vocals → z, d entre vocals → dh, r final de paraula llarga muda, t final
després de n/l muda, -ig final → ch. Els sons que l'anglès no té (r forta, ll, ny) són aproximats.
"""
import re

ATONES = {'el', 'la', 'els', 'les', 'lo', 'un', 'una', 'uns', 'unes', 'de', 'del', 'dels', 'a', 'al', 'als', 'i', 'o', 'en', 'em', 'et',
          'es', 'ens', 'us', 'li', 'hi', 'ho', 'que', 'per', 'pel', 'pels', 'amb', 'com', 'si', 'ma', 'ta', 'sa', 'mon', 'ton', 'son', 'me', 'te',
          'se', 'ne', 'ni', 'can'}
VOWELS = 'aeiouàèéíïòóúü'
ACCENTED = 'àèéíòóú'

def nuclei(word):
    """Posicions de les vocals que fan síl·laba, com wordStress: [(inici, final)] dins de la paraula neta."""
    out, i = [], 0
    while i < len(word):
        if word[i] in VOWELS:
            j = i + 1
            # Diftong decreixent: vocal (no i/u) + i/u.
            if j < len(word) and word[j] in 'iu' and word[i] not in 'iu':
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out

def stress_of(word, n, bare=None):
    if n == 0: return -1
    for k, (a, b) in enumerate(nuclei(word)):
        if any(c in ACCENTED for c in word[a:b]): return k
    if n == 1: return -1 if (bare or word) in ATONES else 0
    return n - 2 if re.search(r'([aeiou]s?|[ei]n)$', word) else n - 1

def clean(raw):
    w = raw.lower().replace('’', "'").replace('l·l', 'l').replace("'", '').replace('-', '')
    return re.sub(r'(q|g)u(?=[eiéèí])', r'\1', w)

VOWEL_SOUND = {'a': ('aa', 'ax'), 'à': ('aa', 'aa'), 'e': ('eh', 'ax'), 'è': ('eh', 'eh'), 'é': ('ey', 'ey'), 'i': ('iy', 'iy'), 'í': ('iy', 'iy'),
               'ï': ('iy', 'iy'), 'o': ('ao', 'uw'), 'ò': ('ao', 'ao'), 'ó': ('ow', 'ow'), 'u': ('uw', 'uw'), 'ú': ('uw', 'uw'), 'ü': ('uw', 'uw')}

def syllables(raw):
    """[(inici, vocal, final)] amb una síl·laba per cada nucli que compta l'app."""
    # «gue», «gui»: la g és forta (es marca abans de treure la u muda; si no, «guitarra» sonava «jitarra»).
    word = clean(re.sub(r'[gG]u(?=[eiéèí])', 'ĝ', raw))
    nuc = nuclei(word)
    if not nuc: return [([], 'ax', [])]
    bare = raw.lower().replace('’', "'").split("'")[-1]
    stressed = stress_of(word, len(nuc), bare)
    starts = {a: (k, b) for k, (a, b) in enumerate(nuc)}
    is_v = lambda i: 0 <= i < len(word) and word[i] in VOWELS
    units, i, n = [], 0, len(word)   # unitats: ('C', fonema) o ('V', fonema, [semivocal])
    while i < n:
        if i in starts:
            k, b = starts[i]
            v = word[i]
            sound = VOWEL_SOUND[v][0 if k == stressed else 1]
            glide = [{'i': 'y', 'u': 'w'}[word[i + 1]]] if b - i == 2 else []
            units.append(('V', sound, glide)); i = b; continue
        c, nxt, prev = word[i], word[i + 1] if i + 1 < n else '', word[i - 1] if i > 0 else ''
        last = i == n - 1
        two = word[i:i + 2]
        if c in VOWELS:  # u muda després de q/g ja s'ha tret; aquí no hauria d'arribar
            i += 1; continue
        if two == 'ny': units.append(('C', 'n')); units.append(('C', 'y')); i += 2; continue
        if two == 'll': units.append(('C', 'l')); units.append(('C', 'y')); i += 2; continue
        if two == 'rr': units.append(('C', 'r')); i += 2; continue
        if two == 'ss': units.append(('C', 's')); i += 2; continue
        if two == 'tx': units.append(('C', 'ch')); i += 2; continue
        if two == 'tz': units.append(('C', 'd')); units.append(('C', 'z')); i += 2; continue
        if c == 't' and nxt in 'jg' and i + 2 < n and (nxt == 'j' or word[i + 2] in 'eiéèí'):
            units.append(('C', 'jh')); i += 2; continue
        if c == 'g' and last and prev == 'i':  # -ig final: «mig», «puig»
            units.append(('C', 'ch')); i += 1; continue
        if c == 'c': units.append(('C', 's' if nxt in 'eiéèí' else 'k'))
        elif c == 'ç': units.append(('C', 's'))
        elif c == 'q': units.append(('C', 'k'))
        elif c == 'g': units.append(('C', 'zh' if nxt in 'eiéèí' else 'g'))
        elif c == 'ĝ': units.append(('C', 'g'))
        elif c == 'j': units.append(('C', 'zh'))
        elif c == 'x': units.append(('C', 'sh'))
        elif c in 'bv':
            if not (last and prev == 'm'): units.append(('C', 'p' if last else 'b'))  # «amb»: la b no sona
        elif c == 'd': units.append(('C', 't' if last else 'dh' if is_v(i - 1) and is_v(i + 1) else 'd'))
        elif c == 'r':
            if last and len(nuc) > 1: pass  # «carrer», «cantar»: r final muda
            elif i == 0 or prev in 'nls': units.append(('C', 'r'))
            else: units.append(('C', 'dx'))
        elif c == 's': units.append(('C', 'z' if is_v(i - 1) and is_v(i + 1) else 's'))
        elif c == 't':
            if not (last and prev in 'nl' and len(word) > 3): units.append(('C', 't'))
        elif c == 'h': pass
        elif c == 'y': units.append(('C', 'y'))
        elif c == 'z': units.append(('C', 'z'))
        elif c == 'w': units.append(('C', 'w'))
        elif c in 'fklmnp': units.append(('C', c))
        i += 1
    # Síl·labes: les consonants entre dues vocals van a la síl·laba següent (una, o dues si fan grup: pr, bl…).
    groups = {('p', 'dx'), ('b', 'dx'), ('t', 'dx'), ('d', 'dx'), ('k', 'dx'), ('g', 'dx'), ('f', 'dx'), ('p', 'l'), ('b', 'l'), ('k', 'l'), ('g', 'l'), ('f', 'l'),
              ('l', 'y'), ('n', 'y')}  # ll i ny són un sol so: van junts a la síl·laba següent
    vidx = [k for k, u in enumerate(units) if u[0] == 'V']
    sylls = []
    for s, v in enumerate(vidx):
        prev_v = vidx[s - 1] if s else -1
        between = [u[1] for u in units[prev_v + 1:v]]
        take = 0 if not between else 1
        if len(between) >= 2 and (between[-2], between[-1]) in groups: take = 2
        if s == 0: take = len(between)
        onset = between[len(between) - take:]
        if s:
            sylls[-1][2].extend(between[:len(between) - take])
        sylls.append([onset, units[v][1], list(units[v][2])])
    sylls[-1][2].extend(u[1] for u in units[vidx[-1] + 1:])
    return [(o, v, c) for o, v, c in sylls]

if __name__ == '__main__':
    import sys
    for w in sys.argv[1:]:
        print(w, syllables(w))
