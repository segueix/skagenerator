"""Fa cantar una veu gravada síl·laba a síl·laba (veu.html) amb WORLD (pyworld).

El ZIP té manifest.json i un WAV per síl·laba, totes cantades a la mateixa nota (manifest.note):
  V-a.wav (vocal sola), CV-b-a.wav («ba»), CCV-pR-a.wav («pra»), VC-a-l.wav («al»)…
Per a cada nota de la melodia:
  · la consonant d'inici (de la síl·laba CV o CCV) entra just abans de la nota, com fa un cantant;
  · la vocal (amb la transició natural des de la consonant) s'estira o es repeteix fins a omplir la nota;
  · les consonants finals (de les síl·labes VC) tanquen la nota.
Tot es fa amb els paràmetres de WORLD (envolupant espectral, aperiodicitat i f0), enganxats amb
fosos curts, i l'entonació es reescriu a la melodia amb un portament curt i un vibrato suau.
"""
import io, json, math, zipfile
import numpy as np
import pyworld as pw
import soundfile as sf

RATE, PERIOD = 44100, 5.0          # ms per frame
FPS = 1000 / PERIOD

# Fonemes del convertidor català (catalan.py, símbols ARPAbet) → símbols de la gravació.
VOWEL = {'aa': 'a', 'ax': '@', 'eh': 'E', 'ey': 'e', 'iy': 'i', 'ao': 'O', 'ow': 'o', 'uw': 'u'}
CONS = {'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'dh': 'd', 'k': 'k', 'g': 'g', 'f': 'f', 's': 's', 'z': 'z', 'sh': 'S', 'zh': 'Z',
        'ch': 'tS', 'jh': 'dZ', 'm': 'm', 'n': 'n', 'ng': 'n', 'l': 'l', 'r': 'r', 'dx': 'R', 'y': 'j', 'w': 'w'}
CLUSTER_VOWEL = {'e': 'E', 'o': 'O'}
NEAR = {'a': 'a@E', '@': '@aE', 'e': 'eEi', 'E': 'Eea', 'i': 'ie', 'o': 'oOu', 'O': 'Ooa', 'u': 'uo'}

def convert(onset, vowel, coda):
    """Síl·laba de catalan.py → (inici, vocal, final) amb els símbols de la gravació (ny, ll en un sol so)."""
    def group(seq):
        out, i = [], 0
        while i < len(seq):
            a, b = seq[i], seq[i + 1] if i + 1 < len(seq) else None
            if b == 'y' and a in ('n', 'l'): out.append('J' if a == 'n' else 'L'); i += 2; continue
            out.append(CONS.get(a, a)); i += 1
        return out
    return group(onset), VOWEL.get(vowel, '@'), group(coda)

class Unit:
    """Una gravació analitzada: paràmetres WORLD i on comença i acaba la vocal."""
    def __init__(self, x, note):
        x = x.astype(np.float64)
        peak = float(np.abs(x).max()) or 1.0
        x = x / peak * .5
        self.f0, t = pw.harvest(x, RATE, f0_floor=60, f0_ceil=900, frame_period=PERIOD)
        self.sp = pw.cheaptrick(x, self.f0, t, RATE)
        self.ap = pw.d4c(x, self.f0, t, RATE)
        hop = int(RATE * PERIOD / 1000)
        n = len(self.f0)
        self.rms = np.array([math.sqrt(float(np.mean(x[i * hop:(i + 1) * hop] ** 2)) + 1e-12) for i in range(n)])
        voiced = self.f0 > 0
        steady = float(np.median(self.rms[voiced])) if voiced.any() else float(self.rms.max())
        loud = np.where(self.rms >= .04 * steady)[0]
        self.start = int(loud[0]) if len(loud) else 0
        self.end = int(loud[-1]) + 1 if len(loud) else n
        vowel = np.where(voiced & (self.rms >= .5 * steady))[0]
        self.v0 = int(vowel[0]) if len(vowel) else self.start
        self.v1 = int(vowel[-1]) + 1 if len(vowel) else self.end
        # Tros estable de la vocal: sense els 30 ms dels extrems.
        self.s0, self.s1 = min(self.v1 - 1, self.v0 + 6), max(self.v0 + 7, self.v1 - 6)
        self.note = note

class Bank:
    """Una veu gravada, en un o més ZIP (les parts de l'exportació de veu.html)."""
    def __init__(self, paths):
        if isinstance(paths, str): paths = [paths]
        self.files, self.cache, notes = {}, {}, set()
        for path in paths:
            z = zipfile.ZipFile(path)
            manifest = json.loads(z.read('manifest.json'))
            notes.add(int(manifest.get('note', 55)))
            for s in manifest['samples']: self.files[s['id']] = (z, s['file'])
        if len(notes) > 1: print(f'Atenció: les parts es van gravar a notes diferents ({sorted(notes)})')
        self.note = sorted(notes)[0]
        print(f'Veu gravada: {len(self.files)} síl·labes ({len(paths)} fitxers), cantades a la nota {self.note}')

    def unit(self, key):
        if key not in self.files: return None
        if key not in self.cache:
            z, name = self.files[key]
            x, rate = sf.read(io.BytesIO(z.read(name)), dtype='float64', always_2d=False)
            if x.ndim > 1: x = x.mean(1)
            if rate != RATE: raise SystemExit(f'{key}: freqüència {rate}, s’esperava {RATE}')
            self.cache[key] = Unit(x, self.note)
        return self.cache[key]

    def find(self, kind, cons, vowel):
        """La gravació més propera: la mateixa vocal o, si falta, la més semblant."""
        for v in NEAR.get(vowel, vowel) + 'aE@iOu':
            key = {'V': f'V-{v}', 'CV': f'CV-{cons}-{v}', 'CCV': f'CCV-{cons}-{CLUSTER_VOWEL.get(v, v)}', 'VC': f'VC-{v}-{cons}'}[kind]
            u = self.unit(key)
            if u: return u
        return None

    def onset_unit(self, onset, vowel):
        if not onset: return None
        if len(onset) >= 2:
            u = self.find('CCV', ''.join(onset[-2:]), vowel)
            if u: return u
        return self.find('CV', onset[-1], vowel)

def frames_between(u, a, b):
    return u.sp[a:b], u.ap[a:b], u.f0[a:b]

def stretch(u, length):
    """Vocal estable de `length` frames: s'estira fins a 3 vegades i, si cal més, es fa anar i tornar."""
    idx = np.arange(u.s0, u.s1)
    if length <= 0 or len(idx) == 0: return np.zeros(0, int)
    if length <= 3 * len(idx): return idx[np.clip(np.round(np.linspace(0, len(idx) - 1, length)).astype(int), 0, len(idx) - 1)]
    cycle = np.concatenate([idx, idx[::-1]])
    return cycle[np.arange(length) % len(cycle)]

def sing_phrase(bank, notes, shift, syllables_of):
    """Notes d'una frase → (inici en segons, ona). syllables_of(paraula) → [(inici, vocal, final)] de catalan.py."""
    # Paraules: notes consecutives de la mateixa paraula; cada nota rep les seves síl·labes.
    words, i = [], 0
    while i < len(notes):
        group = [notes[i]]; i += 1
        while i < len(notes) and notes[i]['syllable'] > 0 and notes[i]['word'] == group[0]['word']:
            group.append(notes[i]); i += 1
        words.append(group)
    plan = []  # (nota, [síl·labes convertides]); [] = melisma
    for group in words:
        sylls = [convert(*s) for s in syllables_of(group[0]['word'])]
        per = [[s] for s in sylls[:len(group)]]
        for extra in sylls[len(group):]: per[-1].append(extra)
        while len(per) < len(group): per.append([])
        plan.extend(zip(group, per))
    start = plan[0][0]['t'] - .35
    end = max(n['t'] + n['d'] for n, _ in plan) + .25
    total = int(math.ceil((end - start) * FPS))
    bins = bank.unit(next(iter(bank.files))).sp.shape[1]
    SP = np.full((total, bins), 1e-12); AP = np.ones((total, bins)); F0 = np.zeros(total)
    target = np.zeros(total)             # nota (midi) de cada frame, per a l'entonació
    filled = np.zeros(total, bool)
    def place(at, sp, ap, f0, midi, unit, fade=3):
        n = min(len(sp), total - at)
        if n <= 0 or at < 0: return
        sl = slice(at, at + n)
        w = np.ones(n)
        k = min(fade, n)
        overlap = filled[sl].copy()
        if overlap[:k].any(): w[:k] = np.linspace(0, 1, k + 2)[1:-1]
        lsp = np.log(SP[sl]); lap = AP[sl]
        SP[sl] = np.exp(lsp * (1 - w[:, None]) + np.log(sp[:n]) * w[:, None])
        AP[sl] = lap * (1 - w[:, None]) + ap[:n] * w[:, None]
        # f0 de la gravació (relatiu a la nota on es va cantar): conserva què és sonor i què no.
        F0[sl] = np.where(w > .5, f0[:n] > 0, F0[sl] > 0)
        target[sl] = midi; filled[sl] = True
    prev_vowel_unit = None
    for note, parts in plan:
        midi = note['midi'] + shift
        a = int(round((note['t'] - start) * FPS)); b = int(round((note['t'] + note['d'] - start) * FPS))
        if not parts:  # melisma: la vocal anterior continua a la nota nova
            if prev_vowel_unit:
                idx = stretch(prev_vowel_unit, b - a)
                place(a, prev_vowel_unit.sp[idx], prev_vowel_unit.ap[idx], prev_vowel_unit.f0[idx], midi, prev_vowel_unit)
            continue
        slot = max(1, (b - a) // len(parts))
        for k, (onset, vowel, coda) in enumerate(parts):
            va, vb = a + k * slot, a + (k + 1) * slot if k < len(parts) - 1 else b
            src = bank.onset_unit(onset, vowel)
            vsrc = src or bank.find('V', None, vowel)
            if vsrc is None: continue
            # Consonants finals: el tros final de la síl·laba VC (com a molt el 40 % de la nota).
            tails = []
            for c in coda:
                u = bank.find('VC', c, vowel)
                if u is not None and u.end > u.v1: tails.append((u, u.v1, u.end))
            coda_len = min(sum(e - s for _, s, e in tails), int((vb - va) * .4))
            # Inici: consonant(s) abans de la nota (com a molt 180 ms).
            if src is not None:
                c0 = max(src.start, src.v0 - int(.18 * FPS))
                place(va - (src.v0 - c0), *frames_between(src, c0, src.v0), midi, src)
            # Vocal: transició des de la consonant i després la part estable.
            length = max(1, vb - va - coda_len)
            head = list(range(vsrc.v0, min(vsrc.s0, vsrc.v0 + length)))
            idx = np.concatenate([np.array(head, int), stretch(vsrc, length - len(head))])
            place(va, vsrc.sp[idx], vsrc.ap[idx], vsrc.f0[idx], midi, vsrc)
            prev_vowel_unit = vsrc
            at = va + length
            for u, s, e in tails:
                n = min(e - s, max(0, coda_len - (at - (va + length))))
                place(at, *frames_between(u, s, s + n), midi, u); at += n
    # Entonació: la melodia amb vibrato suau a les notes llargues i portament de 40 ms entre notes.
    semis = np.zeros(total); prev, run = None, 0
    for f in range(total):
        if not filled[f]: prev, run = None, 0; continue
        m = target[f]
        if m != prev: run = 0
        run += 1; prev = m
        semis[f] = m + .22 * math.sin(2 * math.pi * 5.4 * run / FPS) * min(1, max(0, (run - 50) / 40))
    kernel = np.ones(8) / 8
    inside = np.convolve(filled.astype(float), kernel, mode='same') > .99
    semis = np.where(inside, np.convolve(semis, kernel, mode='same'), semis)
    f0 = np.where((F0 > 0) & filled, 440 * 2 ** ((semis - 69) / 12), 0.0)
    wave = pw.synthesize(np.ascontiguousarray(f0), np.ascontiguousarray(SP), np.ascontiguousarray(AP), RATE, PERIOD)
    return start, wave.astype(np.float32)
