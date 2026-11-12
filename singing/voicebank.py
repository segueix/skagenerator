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
            # Els WAV es reconeixen pel nom (V-a, CV-b-a, CCV-pR-a, VC-a-l), encara que siguin dins
            # de carpetes o el ZIP s'hagi refet a mà sense el manifest.json.
            for name in z.namelist():
                base = name.rsplit('/', 1)[-1]
                if base == 'manifest.json':
                    manifest = json.loads(z.read(name))
                    if manifest.get('note') is not None: notes.add(int(manifest['note']))
                elif base.lower().endswith('.wav') and base.split('-')[0] in ('V', 'CV', 'CCV', 'VC'):
                    self.files[base[:-4]] = (z, name)
        if len(notes) > 1: print(f'Atenció: les parts es van gravar a notes diferents ({sorted(notes)})')
        # La nota on realment es va cantar (sovint més greu que la de referència): així el canvi d'octava
        # de la melodia s'acosta a la veu real.
        self.note = self.measured_note() if self.files else (sorted(notes)[0] if notes else 55)
        print(f'Veu gravada: {len(self.files)} síl·labes ({len(paths)} fitxers), cantades a la nota {self.note}')

    def measured_note(self):
        """Sense manifest: la nota es mesura a les vocals soles."""
        found = []
        for key in [k for k in self.files if k.startswith('V-')][:8]:
            z, name = self.files[key]
            x, rate = sf.read(io.BytesIO(z.read(name)), dtype='float64', always_2d=False)
            if x.ndim > 1: x = x.mean(1)
            f0, _ = pw.harvest(x, rate, f0_floor=60, f0_ceil=900, frame_period=10)
            if (f0 > 0).sum() > 20: found.append(69 + 12 * math.log2(float(np.median(f0[f0 > 0])) / 440))
        return int(round(float(np.median(found)))) if found else 55

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
    """Vocal estable de `length` fotogrames: s'estira de manera contínua sobre tota la part estable
    (índexs fraccionaris, interpolats en col·locar-los). Si cal molt més, va i torna a poc a poc."""
    lo, hi = u.s0, max(u.s0 + 1, u.s1 - 1)
    if length <= 0: return np.zeros(0)
    span = hi - lo
    if length <= 3 * max(1, span): return np.linspace(lo, hi, length)
    # Molt llarga: anada i tornada lenta (cada passada dura 3 vegades la gravació).
    period = 2 * 3 * span
    phase = (np.arange(length) % period) / period
    return lo + span * (1 - np.abs(1 - 2 * phase))

# Durada típica de cada consonant (s): garanteix que no quedi reduïda a res quan la detecció
# automàtica no troba el límit amb la vocal (sobretot amb les consonants sonores: m, n, l…).
CONS_SECONDS = {'p': .07, 't': .07, 'k': .07, 'b': .06, 'd': .06, 'g': .06, 'f': .11, 's': .12, 'z': .1, 'S': .12, 'Z': .1,
                'tS': .11, 'dZ': .1, 'm': .08, 'n': .08, 'J': .1, 'l': .08, 'L': .1, 'r': .09, 'R': .035, 'j': .06, 'w': .06}
import os
CONS_BOOST = 10 ** (float(os.environ.get('VB_CONS_DB', 3)) / 10)   # +3 dB a les consonants: s'entenen millor dins de la banda

def onset_frames(u, cons):
    """Índexs de la consonant d'inici d'una gravació CV/CCV (fins on comença la vocal)."""
    need = int(round(sum(CONS_SECONDS.get(c, .07) for c in cons) * FPS))
    v0 = max(u.v0, min(u.v1 - 8, u.start + need))
    c0 = max(u.start, v0 - int(.22 * FPS))
    return np.arange(c0, v0), v0

def coda_frames(u, cons):
    """Índexs del final d'una gravació VC: 30 ms de transició des de la vocal i la consonant."""
    need = int(round(CONS_SECONDS.get(cons, .08) * FPS))
    c1 = u.end
    c0 = max(u.s0 + 4, min(u.v1, c1 - need))
    return np.arange(max(u.s0, c0 - 6), c1)

def squeeze(idx, length):
    """Escurça (o allarga una mica) una seqüència de fotogrames a `length` fotogrames."""
    if length <= 0 or not len(idx): return idx[:0]
    if length >= len(idx): return idx
    return idx[np.round(np.linspace(0, len(idx) - 1, length)).astype(int)]

# Consonants sordes fabricades: soroll amb l'espectre de cada consonant (en la mateixa escala de potència
# que la vocal de la síl·laba). Fricatives: [banda baixa, banda alta, fracció de potència, fotogrames].
# Oclusives: tancament (silenci), explosió curta i aspiració.
SYNTH = {'s': ('fric', 4500, 10500, .14, 20), 'S': ('fric', 2000, 6500, .16, 22), 'f': ('fric', 1200, 9000, .035, 18),
         'tS': ('aff', 2000, 6500, .16, 14), 't': ('stop', 3000, 8000, .35, 0), 'k': ('stop', 1500, 4500, .3, 0), 'p': ('stop', 500, 3000, .15, 0)}

def power_of(u):
    return float(np.mean(np.sum(u.sp[u.s0:u.s1], axis=1))) if u.s1 > u.s0 else float(np.mean(np.sum(u.sp, axis=1)))

def band(bins, lo, hi):
    f = np.linspace(1, RATE / 2, bins)
    centre, width = math.sqrt(lo * hi), math.log(hi / lo) / 3
    shape = np.exp(-.5 * ((np.log(f) - math.log(centre)) / width) ** 2) + 1e-4
    return shape / shape.sum()

def synth(c, bins, ref, where):
    kind, lo, hi, frac, frames = SYNTH[c]
    rows = []
    if kind in ('stop', 'aff'):
        rows += [np.full(bins, 1e-12)] * (6 if where == 'coda' else 8)          # tancament
    if kind == 'stop':
        shape = band(bins, lo, hi)
        rows += [shape * ref * frac] * 2                                         # explosió
        asp = band(bins, lo * .8, hi * 1.2)
        rows += [asp * ref * frac * .25 * (1 - k / 5) for k in range(2 if where == 'coda' else 4)]  # aspiració
    else:
        shape = band(bins, lo, hi)
        env = np.sin(np.linspace(0, math.pi, frames)) ** .5
        rows += [shape * ref * frac * e + 1e-12 for e in env]
    sp = np.array(rows) + 1e-12
    return sp, np.ones_like(sp), np.zeros(len(sp), bool)

def take(u, idx, boost=1.0):
    """Fotogrames d'una gravació (índexs fraccionaris interpolats; l'espectre, en logaritme)."""
    idx = np.asarray(idx, float)
    if not len(idx): return np.zeros((0, u.sp.shape[1])), np.zeros((0, u.sp.shape[1])), np.zeros(0, bool)
    i0 = np.clip(np.floor(idx).astype(int), 0, len(u.sp) - 1); i1 = np.minimum(i0 + 1, len(u.sp) - 1)
    w = (idx - np.floor(idx))[:, None]
    sp = np.exp(np.log(u.sp[i0]) * (1 - w) + np.log(u.sp[i1]) * w) * boost
    ap = u.ap[i0] * (1 - w) + u.ap[i1] * w
    return sp, ap, u.f0[np.rint(idx).astype(int).clip(0, len(u.f0) - 1)] > 0

def join(segs, bins):
    if not segs: return np.zeros((0, bins)), np.zeros((0, bins)), np.zeros(0, bool)
    return tuple(np.concatenate([s[k] for s in segs]) for k in range(3))

def squeeze_seg(seg, length):
    n = len(seg[0])
    if length >= n: return seg
    if length <= 0: return tuple(a[:0] for a in seg)
    idx = np.round(np.linspace(0, n - 1, length)).astype(int)
    return tuple(a[idx] for a in seg)

def sing_phrase(bank, notes, shift, syllables_of):
    """Notes d'una frase → (inici en segons, ona). syllables_of(paraula) → [(inici, vocal, final)] de catalan.py."""
    # 1. Síl·labes amb les seves notes (una síl·laba pot ocupar diverses notes: melisma).
    words, i = [], 0
    while i < len(notes):
        group = [notes[i]]; i += 1
        while i < len(notes) and notes[i]['syllable'] > 0 and notes[i]['word'] == group[0]['word']:
            group.append(notes[i]); i += 1
        words.append(group)
    sylls = []   # {onset, vowel, coda, notes:[...], a, b}
    for group in words:
        parts = [convert(*x) for x in syllables_of(group[0]['word'])]
        per = [[x] for x in parts[:len(group)]]
        for extra in parts[len(group):]: per[-1].append(extra)
        while len(per) < len(group): per.append([])
        for note, ps in zip(group, per):
            if not ps:
                if sylls: sylls[-1]['notes'].append(note)
                continue
            for k, (onset, vowel, coda) in enumerate(ps):
                share = note['d'] / len(ps)
                sylls.append({'onset': onset, 'vowel': vowel, 'coda': coda, 'notes': [dict(note, t=note['t'] + k * share, d=share)]})
    if not sylls: return 0.0, np.zeros(1, np.float32)
    start = sylls[0]['notes'][0]['t'] - .4
    end = max(n['t'] + n['d'] for x in sylls for n in x['notes']) + .3
    total = int(math.ceil((end - start) * FPS))
    fr = lambda t: int(round((t - start) * FPS))
    # 2. Peces de cada síl·laba. Les consonants sordes (s, x, f, t, k, p, tx) es fabriquen: a les gravacions
    #    de síl·labes soltes gairebé no hi són. Les sonores (l, m, n, r, b…) surten de la gravació.
    bins = next(u for u in (bank.onset_unit(x['onset'], x['vowel']) or bank.find('V', None, x['vowel']) for x in sylls) if u is not None).sp.shape[1]
    for x in sylls:
        x['a'] = fr(x['notes'][0]['t']); x['b'] = fr(x['notes'][-1]['t'] + x['notes'][-1]['d'])
        src = bank.onset_unit(x['onset'], x['vowel'])
        x['src'] = src; x['vsrc'] = src or bank.find('V', None, x['vowel'])
        ref = power_of(x['vsrc']) if x['vsrc'] is not None else 1e-6
        syn, rest = [], list(x['onset'])
        while rest and rest[0] in SYNTH: syn.append(rest.pop(0))
        segs = [synth(c, bins, ref, 'onset') for c in syn]
        if src is not None and rest:
            idx, x['v0'] = onset_frames(src, rest)
            segs.append(take(src, idx, CONS_BOOST))
        else:
            x['v0'] = x['vsrc'].v0 if x['vsrc'] is not None else 0
        x['on'] = join(segs, bins)
        x['tails'] = []
        for c in x['coda']:
            if c in SYNTH: x['tails'].append(synth(c, bins, ref, 'coda')); continue
            u = bank.find('VC', c, x['vowel'])
            if u is not None: x['tails'].append(take(u, coda_frames(u, c), CONS_BOOST))
    seglen = lambda seg: len(seg[0])
    # 3. Temps: la vocal comença a la nota; la consonant d'inici just abans; el final de la síl·laba i la
    #    consonant de la següent es reparteixen el temps entre una vocal i l'altra (abans es trepitjaven).
    for k, x in enumerate(sylls):
        nxt = sylls[k + 1] if k + 1 < len(sylls) else None
        limit = x['b']
        if nxt is not None and nxt['a'] - x['b'] < int(.15 * FPS):
            limit = min(limit, nxt['a'] - seglen(nxt['on']))
        coda_len = sum(seglen(t) for t in x['tails'])
        room = limit - x['a']
        min_vowel = max(4, int((x['b'] - x['a']) * .35))
        if coda_len and room - coda_len < min_vowel:
            scale = max(0.0, (room - min_vowel) / coda_len)
            x['tails'] = [squeeze_seg(t, int(seglen(t) * scale)) for t in x['tails']]
            coda_len = sum(seglen(t) for t in x['tails'])
        x['vend'] = max(x['a'] + 1, limit - coda_len)
        # La consonant d'inici no pot començar abans que acabi la síl·laba anterior.
        prev_end = sylls[k - 1]['vend'] + sum(seglen(t) for t in sylls[k - 1]['tails']) if k else 0
        room_on = x['a'] - max(prev_end, 0)
        if seglen(x['on']) > room_on: x['on'] = squeeze_seg(x['on'], max(0, room_on))
    # 4. Paràmetres WORLD de la frase.
    SP = np.full((total, bins), 1e-12); AP = np.ones((total, bins)); VOICED = np.zeros(total, bool)
    target = np.zeros(total); filled = np.zeros(total, bool)
    def place(at, seg, midi, fade=4):
        sp, ap, voiced = seg; n = min(len(sp), total - at)
        if n <= 0 or at < 0: return
        sl = slice(at, at + n); w = np.ones(n); k = min(fade, n)
        if filled[sl][:k].any(): w[:k] = np.linspace(0, 1, k + 2)[1:-1]
        SP[sl] = np.exp(np.log(SP[sl]) * (1 - w[:, None]) + np.log(sp[:n]) * w[:, None])
        AP[sl] = AP[sl] * (1 - w[:, None]) + ap[:n] * w[:, None]
        VOICED[sl] = np.where(w > .5, voiced[:n], VOICED[sl])
        target[sl] = midi; filled[sl] = True
    for x in sylls:
        midi0 = x['notes'][0]['midi'] + shift
        if seglen(x['on']): place(x['a'] - seglen(x['on']), x['on'], midi0)
        u = x['vsrc']
        if u is None: continue
        length = x['vend'] - x['a']
        head = np.arange(x['v0'], min(u.s0, x['v0'] + length))
        idx = np.concatenate([head.astype(float), stretch(u, length - len(head))])
        place(x['a'], take(u, idx), midi0)
        # Melisma: la mateixa vocal canvia de nota.
        for n in x['notes'][1:]:
            a = fr(n['t']); target[a:min(x['vend'], fr(n['t'] + n['d']))] = n['midi'] + shift
        at = x['vend']
        last = x['notes'][-1]['midi'] + shift
        for tail in x['tails']:
            place(at, tail, last, fade=6); at += seglen(tail)
    # 5. Entonació: la melodia amb vibrato suau a les notes llargues i portament de 40 ms entre notes.
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
    f0 = np.where(VOICED & filled, 440 * 2 ** ((semis - 69) / 12), 0.0)
    wave = pw.synthesize(np.ascontiguousarray(f0), np.ascontiguousarray(SP), np.ascontiguousarray(AP), RATE, PERIOD)
    return start, wave.astype(np.float32)
