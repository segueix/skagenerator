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
        os.makedirs(cache, exist_ok=True)

    def speech(self, text):
        key = hashlib.sha1(f'{self.speaker}|{text}'.encode()).hexdigest()[:16]
        path = os.path.join(self.cache, f'{key}.wav')
        if not os.path.exists(path):
            self.client = self.client or self._matxa.Matxa(self.speaker)
            self.client.say(text, path, length_scale=1.0)
        x, rate = sf.read(path, dtype='float64', always_2d=True)
        return x.mean(1), rate

    def sing_line(self, notes, shift, syllables_of):
        """Notes d'un vers → (inici en segons, ona a 44,1 kHz)."""
        x, rate = self.speech(_line_text(notes))
        x = x / (np.abs(x).max() + 1e-9) * .5
        f0, t = pw.harvest(x, rate, f0_floor=60, f0_ceil=600, frame_period=PERIOD)
        sp = pw.cheaptrick(x, f0, t, rate); ap = pw.d4c(x, f0, t, rate)
        hop = int(rate * PERIOD / 1000); n = len(f0)
        rms = np.array([math.sqrt(float(np.mean(x[i * hop:(i + 1) * hop] ** 2)) + 1e-12) for i in range(n)])
        voiced = f0 > 0
        # Envolupant de les vocals: energia de la veu sonora, suavitzada (~25 ms).
        env = signal.savgol_filter(np.where(voiced, rms, 0), 7, 2).clip(0)
        count = len(notes)
        nuclei = self._nuclei(env, count)
        # Límits de cada vocal: on l'energia cau per sota del 45 % del seu pic.
        bounds = []
        for k, p in enumerate(nuclei):
            lo = nuclei[k - 1] if k else 0
            hi = nuclei[k + 1] if k + 1 < len(nuclei) else n - 1
            thr = env[p] * .45
            a = p
            while a > lo + 1 and env[a - 1] > thr and voiced[a - 1]: a -= 1
            b = p
            while b < hi - 1 and env[b + 1] > thr and voiced[b + 1]: b += 1
            bounds.append((a, b + 1))
        speech_start = int(np.argmax(rms > rms.max() * .03)); speech_end = n - int(np.argmax(rms[::-1] > rms.max() * .03))
        # Línia de temps de sortida (fotogrames de 5 ms): índex de la veu parlada i nota de cada fotograma.
        start = notes[0]['t'] - .45
        end = notes[-1]['t'] + notes[-1]['d'] + .35
        total = int(math.ceil((end - start) * FPS))
        src = np.full(total, -1.0); midi = np.zeros(total)
        fr = lambda tt: int(round((tt - start) * FPS))
        for k, note in enumerate(notes):
            a, b = bounds[k]
            # Consonants entre la vocal anterior i aquesta: abans de la nota, amb la seva durada (com a molt 220 ms).
            prev_b = bounds[k - 1][1] if k else speech_start
            gap = a - prev_b
            on_len = min(gap if k == 0 else int(gap * .6), int(.22 * FPS))
            coda_len = 0
            if k + 1 < len(notes):
                nxt_a = bounds[k + 1][0]
                coda_len = min(int((nxt_a - b) * .4), int(.12 * FPS))
            else:
                coda_len = min(speech_end - b, int(.2 * FPS))
            na, nb = fr(note['t']), fr(note['t'] + note['d'])
            # Consonants d'inici
            if on_len > 0:
                o0 = max(0, na - on_len)
                src[o0:na] = np.linspace(a - (na - o0), a, na - o0, endpoint=False)
                midi[o0:na] = note['midi'] + shift
            # Vocal estirada fins al final de la nota (menys les consonants finals)
            ve = max(na + 2, nb - coda_len)
            src[na:ve] = np.linspace(a, max(a + 1, b - 1), ve - na)
            midi[na:ve] = note['midi'] + shift
            if coda_len > 0:
                src[ve:ve + coda_len] = np.linspace(b, b + coda_len, coda_len, endpoint=False)
                midi[ve:ve + coda_len] = note['midi'] + shift
        # Paràmetres WORLD interpolats.
        bins = sp.shape[1]
        SP = np.full((total, bins), 1e-12); AP = np.ones((total, bins)); V = np.zeros(total, bool)
        have = src >= 0
        i0 = np.clip(np.floor(src).astype(int), 0, n - 1); i1 = np.minimum(i0 + 1, n - 1); w = (src - np.floor(src))[:, None]
        SP[have] = np.exp(np.log(sp[i0]) * (1 - w) + np.log(sp[i1]) * w)[have]
        AP[have] = (ap[i0] * (1 - w) + ap[i1] * w)[have]
        V[have] = voiced[np.rint(src).astype(int).clip(0, n - 1)][have]
        # Entonació amb vibrato suau (a partir de 250 ms dins de la nota) i portament de 40 ms.
        semis = np.zeros(total); prev, run = None, 0
        for f in range(total):
            if not have[f]: prev, run = None, 0; continue
            m = midi[f]
            if m != prev: run = 0
            run += 1; prev = m
            semis[f] = m + .2 * math.sin(2 * math.pi * 5.4 * run / FPS) * min(1, max(0, (run - 50) / 40))
        k = np.ones(8) / 8
        inside = np.convolve(have.astype(float), k, mode='same') > .99
        semis = np.where(inside, np.convolve(semis, k, mode='same'), semis)
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
