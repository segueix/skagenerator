"""De veu parlada a veu cantada: fa cantar Matxa (veu neuronal catalana) sobre la melodia.

Per a cada vers:
  1. Matxa diu el vers de manera natural (es desa en memòria cau per no repetir-lo).
  2. Es troben els nuclis vocàlics (un per síl·laba) a l'envolupant de la veu sonora i, per a cada
     síl·laba, on comença i acaba la vocal.
  3. Amb WORLD: la consonant d'inici es manté amb la seva durada just abans de la nota, la vocal
     s'estira fins a omplir la nota i les consonants finals la tanquen; l'entonació és la de la
     melodia, amb portament curt i vibrato suau.
"""
import hashlib, math, os, re
import numpy as np
import pyworld as pw
import soundfile as sf
from scipy import signal
from scipy.signal import resample_poly

PERIOD = 5.0
FPS = 1000 / PERIOD

def _line_text(notes):
    words, out = [], []
    for n in notes:
        if n['syllable'] == 0: out.append(n['word'])
    text = ' '.join(out)
    return text[:1].upper() + text[1:] + '.'

class MatxaSinger:
    # Centre del registre cantat: veus masculines al voltant de Fa♯3 i femenines una octava amunt.
    MALE = {'grau', 'pere', 'lluc', 'quim'}

    def __init__(self, speaker='grau', cache='matxa-cache'):
        import matxa
        self.client = None
        self.speaker, self.cache = speaker, cache
        self.note = 54 if speaker in self.MALE else 64
        self._matxa = matxa
        self._units = {}
        os.makedirs(cache, exist_ok=True)

    def speech(self, text):
        scale = float(os.environ.get('MATXA_SCALE', 1.1))   # una mica més a poc a poc: síl·labes més clares (mesurat)
        key = hashlib.sha1(f'{self.speaker}|{scale}|{text}'.encode()).hexdigest()[:16]
        path = os.path.join(self.cache, f'{key}.wav')
        if not os.path.exists(path):
            self.client = self.client or self._matxa.Matxa(self.speaker)
            self.client.say(text, path, length_scale=scale)
        x, rate = sf.read(path, dtype='float64', always_2d=True)
        return x.mean(1), rate

    def analyse(self, text, count):
        """Matxa diu `text`; retorna els paràmetres WORLD i, per a cada una de les `count` síl·labes,
        (inici de les consonants, inici de la vocal, final de la vocal, final de les consonants finals)."""
        key = (text, count)
        if key in self._units: return self._units[key]
        x, rate = self.speech(text)
        x = x / (np.abs(x).max() + 1e-9) * .5
        f0, t = pw.harvest(x, rate, f0_floor=60, f0_ceil=600, frame_period=PERIOD)
        sp = pw.cheaptrick(x, f0, t, rate); ap = pw.d4c(x, f0, t, rate)
        hop = int(rate * PERIOD / 1000); n = len(f0)
        rms = np.array([math.sqrt(float(np.mean(x[i * hop:(i + 1) * hop] ** 2)) + 1e-12) for i in range(n)])
        voiced = f0 > 0
        env = signal.savgol_filter(np.where(voiced, rms, 0), 7, 2).clip(0)
        nuclei = self._nuclei(env, count)
        bounds = []
        for k, p in enumerate(nuclei):
            lo = nuclei[k - 1] if k else 0
            hi = nuclei[k + 1] if k + 1 < len(nuclei) else n - 1
            thr = env[p] * .45
            a = p
            while a > lo + 1 and env[a - 1] > thr and voiced[a - 1]: a -= 1
            b = p
            while b < hi - 1 and env[b + 1] > thr and voiced[b + 1]: b += 1
            bounds.append([a, b + 1])
        s0 = int(np.argmax(rms > rms.max() * .03)); s1 = n - int(np.argmax(rms[::-1] > rms.max() * .03))
        sylls = []
        for k, (a, b) in enumerate(bounds):
            if k == 0: o0 = s0
            else: o0 = bounds[k - 1][1] + int((a - bounds[k - 1][1]) * .4)   # 60 % de les consonants, per a aquesta síl·laba
            c1 = s1 if k == len(bounds) - 1 else bounds[k][1] + int((bounds[k + 1][0] - bounds[k][1]) * .4)
            sylls.append((min(o0, a), a, b, max(b, c1)))
        unit = {'sp': sp, 'ap': ap, 'voiced': voiced, 'rate': rate, 'sylls': sylls, 'n': n}
        self._units[key] = unit
        return unit

    def sing_line(self, notes, shift, syllables_of):
        """Notes d'un vers → (inici en segons, ona a 44,1 kHz)."""
        # Unitats de veu: cada paraula dita per separat (límits de síl·laba fiables) o el vers sencer.
        plan = []   # (nota, unitat, índex de síl·laba)
        if os.environ.get('MATXA_UNIT', 'line') == 'line':
            unit = self.analyse(_line_text(notes), len(notes))
            plan = [(n, unit, k) for k, n in enumerate(notes)]
        else:
            i = 0
            while i < len(notes):
                group = [notes[i]]; i += 1
                while i < len(notes) and notes[i]['syllable'] > 0 and notes[i]['word'] == group[0]['word']:
                    group.append(notes[i]); i += 1
                unit = self.analyse(group[0]['word'] + '.', len(group))
                plan += [(n, unit, k) for k, n in enumerate(group)]
        rate = plan[0][1]['rate']; bins = plan[0][1]['sp'].shape[1]
        start = notes[0]['t'] - .45
        end = notes[-1]['t'] + notes[-1]['d'] + .4
        total = int(math.ceil((end - start) * FPS))
        SP = np.full((total, bins), 1e-12); AP = np.ones((total, bins)); V = np.zeros(total, bool)
        have = np.zeros(total, bool); midi = np.zeros(total)
        fr = lambda tt: int(round((tt - start) * FPS))
        def put(at, unit, idx, m):
            idx = np.asarray(idx, float); n = min(len(idx), total - at)
            if n <= 0 or at < 0: return
            idx = idx[:n]
            i0 = np.clip(np.floor(idx).astype(int), 0, unit['n'] - 1); i1 = np.minimum(i0 + 1, unit['n'] - 1); w = (idx - np.floor(idx))[:, None]
            sl = slice(at, at + n)
            SP[sl] = np.exp(np.log(unit['sp'][i0]) * (1 - w) + np.log(unit['sp'][i1]) * w)
            AP[sl] = unit['ap'][i0] * (1 - w) + unit['ap'][i1] * w
            V[sl] = unit['voiced'][np.rint(idx).astype(int).clip(0, unit['n'] - 1)]
            have[sl] = True; midi[sl] = m
        max_on, max_coda = int(.22 * FPS), int(.16 * FPS)
        for k, (note, unit, si) in enumerate(plan):
            o0, a, b, c1 = unit['sylls'][si]
            m = note['midi'] + shift
            na, nb = fr(note['t']), fr(note['t'] + note['d'])
            on = np.arange(max(o0, a - max_on), a)
            coda = np.arange(b, min(c1, b + max_coda))
            # Si la nota següent va seguida, el final de la síl·laba deixa lloc a les seves consonants.
            if k + 1 < len(plan):
                nn, nu, nsi = plan[k + 1]
                no0, naa = nu['sylls'][nsi][0], nu['sylls'][nsi][1]
                room_end = fr(nn['t']) - min(naa - no0, max_on)
                nb = min(nb, max(na + 3, room_end))
            ve = max(na + 2, nb - len(coda))
            if len(on): put(na - len(on), unit, on, m)
            # Vocal: els extrems (transicions, 30 ms) a velocitat natural i el centre estirat.
            length = ve - na; edge = min(6, (b - a) // 3, length // 3)
            mid = np.linspace(a + edge, max(a + edge, b - edge - 1), max(0, length - 2 * edge))
            put(na, unit, np.concatenate([np.arange(a, a + edge), mid, np.arange(b - edge, b)]), m)
            if len(coda): put(ve, unit, coda[:max(0, total - ve)], m)
        # Entonació amb vibrato suau (a partir de 250 ms dins de la nota) i portament de 40 ms.
        semis = np.zeros(total); prev, run = None, 0
        for f in range(total):
            if not have[f]: prev, run = None, 0; continue
            mm = midi[f]
            if mm != prev: run = 0
            run += 1; prev = mm
            semis[f] = mm + .2 * math.sin(2 * math.pi * 5.4 * run / FPS) * min(1, max(0, (run - 50) / 40))
        kern = np.ones(8) / 8
        inside = np.convolve(have.astype(float), kern, mode='same') > .99
        semis = np.where(inside, np.convolve(semis, kern, mode='same'), semis)
        F0 = np.where(V & have, 440 * 2 ** ((semis - 69) / 12), 0.0)
        y = pw.synthesize(np.ascontiguousarray(F0), np.ascontiguousarray(SP), np.ascontiguousarray(AP), rate, PERIOD)
        if rate != 44100: y = resample_poly(y, 44100, rate)
        return start, y.astype(np.float32)

    @staticmethod
    def _nuclei(env, count):
        """`count` pics d'energia vocàlica (un per síl·laba), en ordre de temps."""
        peaks, props = signal.find_peaks(env, distance=8, prominence=env.max() * .04)
        if len(peaks) >= count:
            keep = np.sort(peaks[np.argsort(props['prominences'])[::-1][:count]])
            return list(keep)
        # Menys pics que síl·labes: es parteixen les vocals més llargues.
        peaks = list(peaks) or [int(np.argmax(env))]
        while len(peaks) < count:
            ext = [0] + peaks + [len(env) - 1]
            gaps = [(ext[i + 1] - ext[i], i) for i in range(len(ext) - 1)]
            g, i = max(gaps)
            peaks.append(int(ext[i] + g / 2)); peaks.sort()
        return peaks
