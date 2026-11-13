"""Català central escrit → fonemes de la veu (símbols ARPAbet de l'anglès), partits en síl·labes.

Fa les mateixes síl·labes que el comptador de l'app (wordStress a radioambient.js): una nota per
síl·laba. Diftongs decreixents (ai, ei, oi, ui, au, eu, ou) en una síl·laba; «gu/qu» + e/i amb la u muda.
Els símbols ARPAbet també serveixen d'intermediari per als altres bancs de veu.
"""
import re
import unicodedata

ATONES = {'el', 'la', 'els', 'les', 'lo', 'un', 'una', 'uns', 'unes', 'de', 'del', 'dels', 'a', 'al', 'als', 'i', 'o', 'en', 'em', 'et',
          'es', 'ens', 'us', 'li', 'hi', 'ho', 'que', 'per', 'pel', 'pels', 'amb', 'com', 'si', 'ma', 'ta', 'sa', 'mon', 'ton', 'son', 'me', 'te',
          'se', 'ne', 'ni', 'can'}
VOWELS = 'aeiouàèéíïòóúü'
ACCENTED = 'àèéíòóú'
FRONT_VOWELS = set('eiéèíï')
# El timbre de les e/o tòniques sense accent és lèxic. Aquests mots tenen vocal tancada.
CLOSED_E = set('carrer carrers greu greus llei lleis meu meus teu teus seu seus neu preu preus peix peixos lleig passeig passeigs tres mes mesos fer ser ple plens plena plenes'.split())
CLOSED_O = set('amor amors color colors dolor dolors motor motors valor valors rigor molt molts molta moltes dos tot tots tota totes jove joves'.split())
# Mantinguem les erres documentades en mots aguts i les excepcions al patró dels plans.
FINAL_R = set('amor valor rigor futur sospir sonor prematur honor vapor motor terror error dolor humor favor billar cangur'.split())
FINAL_R_SILENT = set('càntir córrer recórrer socórrer créixer decréixer vèncer convèncer pertànyer conèixer reconèixer merèixer néixer aparèixer desaparèixer'.split())
X_KS = re.compile(r'^(?:taxi|fix|afix|asfix|prefix|sufix|crucifix|òxid|oxid|èxit|màxim|maxim|pròxim|proxim|lèxic|lexic|tòxic|toxic|text|sexe|sexual|sax|hex|auxili)')

def nuclei(word):
    """Posicions de les vocals que fan síl·laba, com wordStress: [(inici, final)] dins de la paraula neta."""
    out, i = [], 0
    while i < len(word):
        if word[i] in VOWELS:
            j = i + 1
            # Inclou iu/ui («riu», «avui»). Una vocal amb dièresi manté el hiat.
            hiatus = word[i:] in ('uir', 'uint')
            if not hiatus and j < len(word) and word[j] in 'iu' and word[i] not in ('ï', 'ü', word[j]):
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
    a, b = nuclei(word)[-1]
    has_final_glide = b - a == 2
    return n - 2 if not has_final_glide and re.search(r'([aeiou]s?|[ei]n)$', word) else n - 1

def clean(word):
    # Els marcadors conserven el so sense comptar la u muda o una semivocal com a nucli.
    word = re.sub(r'([qg])u(?=[eiéèíï])', lambda m: 'ĝ' if m[1] == 'g' else 'q', word)
    word = re.sub(r'([qg])[uü](?=[aeiouàèéíïòóúü])', r'\1W', word)
    word = re.sub(r'([aeouàèéòóú])ix', r'\1x', word)
    return re.sub(r'([aeouàèéòóú])ig(?=s?$)', r'\1Č', word)

VOWEL_SOUND = {'a': ('aa', 'ax'), 'à': ('aa', 'aa'), 'e': ('eh', 'ax'), 'è': ('eh', 'eh'), 'é': ('ey', 'ey'), 'i': ('iy', 'iy'), 'í': ('iy', 'iy'),
               'ï': ('iy', 'iy'), 'o': ('ao', 'uw'), 'ò': ('ao', 'ao'), 'ó': ('ow', 'ow'), 'u': ('uw', 'uw'), 'ú': ('uw', 'uw'), 'ü': ('uw', 'uw')}

def syllables(raw):
    """[(inici, vocal, final)] amb una síl·laba per cada nucli que compta l'app."""
    raw = unicodedata.normalize('NFC', raw.lower()).replace('’', "'")
    bare = raw.split("'")[-1]
    word = clean(raw.replace("'", '').replace('-', ''))
    nuc = nuclei(word)
    if not nuc: return [([], 'ax', [])]
    stressed = stress_of(word, len(nuc), bare)
    starts = {a: (k, b) for k, (a, b) in enumerate(nuc)}
    is_v = lambda i: 0 <= i < len(word) and word[i] in VOWELS
    units, i, n = [], 0, len(word)   # unitats: ('C', fonema) o ('V', fonema, [semivocal])
    while i < n:
        if i in starts:
            k, b = starts[i]
            v = word[i]
            sound = VOWEL_SOUND[v][0 if k == stressed else 1]
            if k == stressed and v == 'e' and bare in CLOSED_E: sound = 'ey'
            if k == stressed and v == 'o' and bare in CLOSED_O: sound = 'ow'
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
        if c == 'Č' or (c == 'g' and prev in ('i', 'í') and (last or word[i + 1:] == 's')):
            units.append(('C', 'ch')); i += 1; continue
        if two == 'ng' and word[i + 2:] in ('', 's'):
            units.append(('C', 'ng')); i += 2; continue
        if c == 'n' and nxt in ('c', 'g', 'k', 'q', 'ĝ') and (nxt not in ('c', 'g') or i + 2 == n or word[i + 2] not in FRONT_VOWELS):
            units.append(('C', 'ng')); i += 1; continue
        if c == 'c': units.append(('C', 's' if nxt in FRONT_VOWELS else 'k'))
        elif c == 'ç': units.append(('C', 's'))
        elif c == 'q': units.append(('C', 'k'))
        elif c == 'g': units.append(('C', 'k' if last else 'zh' if nxt in FRONT_VOWELS else 'g'))
        elif c == 'ĝ': units.append(('C', 'g'))
        elif c == 'j': units.append(('C', 'zh'))
        elif c == 'x':
            if i == 1 and prev == 'e' and (nxt == 'h' or is_v(i + 1)):
                units.extend([('C', 'g'), ('C', 'z')])
            elif X_KS.match(bare):
                units.extend([('C', 'k'), ('C', 's')])
            else:
                units.append(('C', 'sh'))
        elif c in 'bv':
            if not (last and prev == 'm'): units.append(('C', 'p' if last else 'b'))  # «amb»: la b no sona
        elif c == 'd': units.append(('C', 't' if last else 'dh' if is_v(i - 1) and is_v(i + 1) else 'd'))
        elif c == 'r':
            if last and (bare in FINAL_R_SILENT or (len(nuc) > 1 and stressed == len(nuc) - 1 and bare not in FINAL_R)):
                pass
            elif i == 0 or prev in ('n', 'l', 's'): units.append(('C', 'r'))
            else: units.append(('C', 'dx'))
        elif c == 's': units.append(('C', 'z' if is_v(i - 1) and is_v(i + 1) else 's'))
        elif c == 't':
            if not ((last or word[i + 1:] == 's') and prev in ('n', 'l')): units.append(('C', 't'))
        elif c == 'h': pass
        elif c == 'y': units.append(('C', 'y'))
        elif c == 'z': units.append(('C', 'z'))
        elif c in ('w', 'W'): units.append(('C', 'w'))
        elif c in 'fklmnp': units.append(('C', c))
        i += 1
    # Síl·labes: les consonants entre dues vocals van a la síl·laba següent (una, o dues si fan grup: pr, bl…).
    groups = {('p', 'dx'), ('b', 'dx'), ('t', 'dx'), ('d', 'dx'), ('k', 'dx'), ('g', 'dx'), ('f', 'dx'), ('p', 'l'), ('b', 'l'), ('k', 'l'), ('g', 'l'), ('f', 'l'),
              ('l', 'y'), ('n', 'y'), ('k', 'w'), ('g', 'w')}  # dígrafs i diftongs creixents
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
