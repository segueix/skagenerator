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

def unit_phones(unit, count):
    """Paraules d'una unitat cantada amb els nuclis vocàlics de cada una, ajustats a `count` síl·labes:
    a la sinalefa l'última vocal d'una paraula i la primera de la següent fan una sola síl·laba (el nucli
    de la segona paraula queda buit i el de la primera s'allarga fins a la paraula següent)."""
    import catalan, unicodedata
    words = []
    for raw in unit.split():
        word = catalan.clean(raw).replace('·', '')
        plain = ''.join(c for c in unicodedata.normalize('NFD', word.replace('ç', 'c')) if 'a' <= c <= 'z')
        nuc = catalan.nuclei(word)
        if len(plain) != len(word) or not nuc: return None
        words.append([plain, list(nuc), raw])
    joins = len(sum((w[1] for w in words), [])) - count
    if joins < 0: return None
    cands = [k for k in range(len(words) - 1)
             if words[k][1][-1][1] == len(words[k][0]) and (words[k + 1][1][0][0] == 0 or words[k + 1][0][:words[k + 1][1][0][0]] == 'h')]
    if len(cands) > joins:   # dues tòniques no es fonen
        tonic = lambda w, k: catalan.stress_of(catalan.clean(w[2]), len(w[1]), w[2].split("'")[-1]) == k
        cands = [k for k in cands if not (tonic(words[k], len(words[k][1]) - 1) and tonic(words[k + 1], 0))][:joins] if joins else []
    if len(cands) != joins: return None
    return [(plain, nuc, k in cands) for k, (plain, nuc, _) in enumerate(words)]

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
        self._best = {}
        os.makedirs(cache, exist_ok=True)

    TEMPERATURES = [.2, .45, .667]   # preses: Matxa diu el vers una mica diferent amb cada temperatura

    def speech(self, text, take=0):
        scale = float(os.environ.get('MATXA_SCALE', 1.1))   # una mica més a poc a poc: síl·labes més clares (mesurat)
        key = hashlib.sha1(f'{self.speaker}|{scale}|{text}{"|t" + str(take) if take else ""}'.encode()).hexdigest()[:16]
        path = os.path.join(self.cache, f'{key}.wav')
        if not os.path.exists(path):
            self.client = self.client or self._matxa.Matxa(self.speaker)
            self.client.say(text, path, length_scale=scale, temperature=self.TEMPERATURES[take % len(self.TEMPERATURES)])
        x, rate = sf.read(path, dtype='float64', always_2d=True)
        return x.mean(1), rate

    _fa = None

    @classmethod
    def _char_times(cls, x, rate, words):
        """Alineació forçada amb el model MMS de torchaudio: segon on sona cada lletra de cada paraula.
        Retorna None si torch/torchaudio no hi són (llavors es fan servir els pics de volum)."""
        if cls._fa is None:
            try:
                import torch, torchaudio
                bundle = torchaudio.pipelines.MMS_FA
                cls._fa = (torch, bundle.get_model(), bundle.get_tokenizer(), bundle.get_aligner())
            except Exception as error:
                print('  (sense alineador MMS:', str(error)[:80], ')'); cls._fa = False
        if not cls._fa: return None
        torch, model, tokenizer, aligner = cls._fa
        wave = torch.tensor(resample_poly(x, 16000, rate), dtype=torch.float32)[None]
        with torch.inference_mode():
            emission, _ = model(wave)
            spans = aligner(emission[0], tokenizer(words))
        ratio = wave.size(1) / emission.size(1) / 16000
        return [[(sp_.start + sp_.end) / 2 * ratio for sp_ in word] for word in spans]

    def analyse(self, text, count, phones=None, take=0):
        """Matxa diu `text`; retorna els paràmetres WORLD i, per a cada una de les `count` síl·labes,
        (inici de les consonants, inici de la vocal, final de la vocal, final de les consonants finals)."""
        key = (text, count, phones is not None, take)
        if key in self._units: return self._units[key]
        x, rate = self.speech(text, take)
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
        unvoiced = np.zeros(n, bool)
        if phones and os.environ.get('MATXA_ALIGN', '1') == '1':
            # phones: paraules del vers (netes, només a-z) amb els nuclis vocàlics de cada una.
            times = self._char_times(x, rate, [w for w, _, _ in phones])
            if times:
                centre = [int(round(tt * FPS)) for word in times for tt in word]
                # Límit entre dues lletres: el punt mig entre els seus centres.
                edge = [s0] + [(centre[i] + centre[i + 1]) // 2 for i in range(len(centre) - 1)] + [s1]
                edge = list(np.maximum.accumulate(np.clip(edge, s0, s1)))
                # Lletres sordes (s, x, f, p, t, k…): el detector de to les marcava com a sonores i sonaven brunzides.
                letters = ''.join(w for w, _, _ in phones)
                for ci, ch in enumerate(letters):
                    if ch in 'sxfptkcq': unvoiced[edge[ci]:edge[ci + 1]] = True
                # Nuclis de tot el vers (índexs de lletra); a la sinalefa, la vocal final d'una paraula i la inicial
                # de la següent fan un sol nucli.
                starts, glob, pos = [], [], 0
                for word, nuc, join in phones:
                    starts.append(pos)
                    merge = bool(glob) and glob[-1][2]
                    for k, (na, nb) in enumerate(nuc):
                        if k == 0 and merge: glob[-1][1] = pos + nb; glob[-1][2] = False; continue
                        glob.append([pos + na, pos + nb, False])
                    if join and glob: glob[-1][2] = True
                    pos += len(word)
                group = lambda c: len(c) >= 2 and (c[-2:] in ('ll', 'ny', 'rr', 'ss', 'tx', 'tj', 'tg') or (c[-1] in 'rl' and c[-2] in 'pbtdcgf'))
                onset = []
                for k, (na, nb, _) in enumerate(glob):
                    prev_end = glob[k - 1][1] if k else 0
                    inside = [w for w in starts if prev_end <= w <= na]
                    if not k: onset.append(0)
                    elif inside: onset.append(inside[-1])   # consonants a l'inici de paraula: totes d'aquesta síl·laba
                    else:
                        cons = letters[prev_end:na]
                        onset.append(na - (0 if not cons else 2 if group(cons) else 1))
                for k, (na, nb, _) in enumerate(glob):
                    coda_end = onset[k + 1] if k + 1 < len(glob) else len(letters)
                    sylls.append((int(edge[onset[k]]), int(edge[na]), int(edge[nb]), int(edge[coda_end])))
                bounds = []
        for k, (a, b) in enumerate(bounds):
            if k == 0: o0 = s0
            else: o0 = bounds[k - 1][1] + int((a - bounds[k - 1][1]) * .4)   # 60 % de les consonants, per a aquesta síl·laba
            c1 = s1 if k == len(bounds) - 1 else bounds[k][1] + int((bounds[k + 1][0] - bounds[k][1]) * .4)
            sylls.append((min(o0, a), a, b, max(b, c1)))
        unit = {'sp': sp, 'ap': ap, 'voiced': voiced & ~unvoiced, 'unvoiced': unvoiced, 'x': x, 'rate': rate, 'sylls': sylls, 'n': n}
        self._units[key] = unit
        return unit

    _asr = None

    def _understood(self, wave, notes):
        """Paraules del vers que un reconeixedor de veu (Whisper) entén a la veu cantada."""
        import difflib, re, intelligibility as it
        if MatxaSinger._asr is None:
            from faster_whisper import WhisperModel
            MatxaSinger._asr = WhisperModel('small', device='cpu', compute_type='int8')
        x = resample_poly(wave, 16000, 44100).astype(np.float32)
        segs, _ = MatxaSinger._asr.transcribe(x, language='ca', beam_size=5, vad_filter=False, condition_on_previous_text=False, without_timestamps=True)
        heard = [it.norm(w) for w in re.split(r"[\s'’-]+", ' '.join(g.text for g in segs)) if it.norm(w)]
        want = it.words_of(notes)
        if len(heard) > 2 * len(want) + 3: return 0
        return sum(b.size for b in difflib.SequenceMatcher(a=want, b=heard, autojunk=False).get_matching_blocks())

    def sing_line(self, notes, shift, syllables_of):
        """Notes d'un vers → (inici en segons, ona). Amb MATXA_TAKES > 1 es canten diverses preses i es tria
        la que s'entén millor; un vers repetit (la tornada) fa servir sempre la mateixa presa."""
        takes = int(os.environ.get('MATXA_TAKES', 1))
        if takes <= 1: return self._sing_take(notes, shift, syllables_of, 0)
        memo = (_line_text(notes), tuple((n['midi'], round(n['d'], 3)) for n in notes))
        if memo not in self._best:
            best = (-1, 0)
            for take in range(takes):
                _, wave = self._sing_take(notes, shift, syllables_of, take)
                got = self._understood(wave, notes)
                if got > best[0]: best = (got, take)
                if got >= len({n['word'] for n in notes if n['syllable'] == 0}): break   # tot entès: no cal provar-ne més
            self._best[memo] = best[1]
        return self._sing_take(notes, shift, syllables_of, self._best[memo])

    def _sing_take(self, notes, shift, syllables_of, take):
        """Una presa d'un vers → (inici en segons, ona a 44,1 kHz)."""
        # Unitats de veu: cada paraula dita per separat (límits de síl·laba fiables) o el vers sencer.
        plan = []   # (nota, unitat, índex de síl·laba)
        if os.environ.get('MATXA_UNIT', 'line') == 'line':
            # Paraules del vers i els seus nuclis vocàlics (si cada paraula té tantes síl·labes com notes).
            import catalan, unicodedata
            phones, i, ok = [], 0, True
            while i < len(notes):
                j = i + 1
                while j < len(notes) and notes[j]['syllable'] > 0 and notes[j]['word'] == notes[i]['word']: j += 1
                # Una unitat pot ser més d'una paraula fosa per sinalefa («que arribi el»): tres síl·labes.
                group = unit_phones(notes[i]['word'], j - i)
                if group is None: ok = False; break
                phones += group; i = j
            unit = self.analyse(_line_text(notes), len(notes), phones if ok else None, take)
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
        human = os.environ.get('MATXA_HUMAN', '1') == '1'
        rnd = np.random.default_rng(abs(hash(_line_text(notes))) % (2 ** 32) + take)
        gain = np.ones(total); vstart = []; splices = []
        max_on, max_coda = int(.22 * FPS), int(.16 * FPS)
        for k, (note, unit, si) in enumerate(plan):
            o0, a, b, c1 = unit['sylls'][si]
            m = note['midi'] + shift
            # Humà: cada nota entra uns mil·lisegons tard (mai abans) i no totes igual de fortes.
            late = int(rnd.integers(0, 4)) if human else 0
            na, nb = fr(note['t']) + late, fr(note['t'] + note['d'])
            on = np.arange(max(o0, a - max_on), a)
            coda = np.arange(b, min(c1, b + max_coda))
            # Si la nota següent va seguida, el final de la síl·laba deixa lloc a les seves consonants.
            if k + 1 < len(plan):
                nn, nu, nsi = plan[k + 1]
                no0, naa = nu['sylls'][nsi][0], nu['sylls'][nsi][1]
                room_end = fr(nn['t']) - min(naa - no0, max_on)
                nb = min(nb, max(na + 3, room_end))
            ve = max(na + 2, nb - len(coda))
            if len(on): put(na - len(on), unit, on, m); splices.append((na - len(on), unit, on))
            # Vocal: els extrems (transicions, 30 ms) a velocitat natural i el centre estirat.
            length = ve - na; edge = min(6, (b - a) // 3, length // 3)
            mid = np.linspace(a + edge, max(a + edge, b - edge - 1), max(0, length - 2 * edge))
            put(na, unit, np.concatenate([np.arange(a, a + edge), mid, np.arange(b - edge, b)]), m)
            vstart.append((na, ve, k == 0 or not have[max(0, na - len(on) - 2)]))
            if human:
                # Dinàmica: atac de 30 ms, una mica de caiguda a les notes llargues i ±1 dB d'una nota a l'altra.
                env = np.ones(length) * 10 ** (rnd.uniform(-1, 1) / 20)
                att = min(6, length); env[:att] *= np.linspace(.75, 1, att)
                if length > 60: env[60:] *= np.linspace(1, .82, length - 60)
                gain[na:ve] = env[:max(0, min(length, total - na))]
            if len(coda): put(ve, unit, coda[:max(0, total - ve)], m); splices.append((ve, unit, coda[:max(0, total - ve)]))
        SP *= (gain ** 2)[:, None]
        if human:
            # Entonació de cantant: cada frase entra per sota i puja a la nota; les notes es lliguen amb un
            # lliscament de 60 ms; el to deriva lentament ±20 centèsimes; el vibrato comença tard i canvia de
            # velocitat i d'amplitud a cada nota; l'última nota cau una mica al final.
            semis = midi.copy()
            drift = np.convolve(rnd.standard_normal(total + 400), np.ones(200) / 200, mode='same')[200:200 + total]
            semis += drift / (np.abs(drift).max() + 1e-9) * .2
            for i, (na, ve, fresh) in enumerate(vstart):
                length = ve - na
                if length <= 0: continue
                t = np.arange(length)
                scoop = (.9 if fresh else .25) * rnd.uniform(.6, 1.2)
                semis[na:ve] -= scoop * np.exp(-t / (14 if fresh else 8))
                rate_hz, depth = rnd.uniform(5.0, 6.0), rnd.uniform(.18, .38)
                ramp = np.clip((t - 44) / 50, 0, 1)
                semis[na:ve] += depth * ramp * np.sin(2 * math.pi * rate_hz * t / FPS + rnd.uniform(0, 6.28))
                if i == len(vstart) - 1 and length > 30:
                    fall = np.clip((t - (length - 30)) / 30, 0, 1); semis[na:ve] -= .6 * fall ** 2
            semis += rnd.standard_normal(total) * .03
            kern = np.hanning(15); kern /= kern.sum()
        else:
            semis = np.zeros(total); prev, run = None, 0
            for f in range(total):
                if not have[f]: prev, run = None, 0; continue
                mm = midi[f]
                if mm != prev: run = 0
                run += 1; prev = mm
                semis[f] = mm + .2 * math.sin(2 * math.pi * 5.4 * run / FPS) * min(1, max(0, (run - 50) / 40))
            kern = np.ones(8) / 8
        filled = np.where(have, semis, 0)
        weight = np.convolve(have.astype(float), kern, mode='same')
        semis = np.where(have, np.convolve(filled, kern, mode='same') / np.maximum(weight, 1e-6), semis)
        F0 = np.where(V & have, 440 * 2 ** ((semis - 69) / 12), 0.0)
        y = pw.synthesize(np.ascontiguousarray(F0), np.ascontiguousarray(SP), np.ascontiguousarray(AP), rate, PERIOD)
        if os.environ.get('MATXA_SPLICE', '1') == '1':
            # Consonants sordes: s'hi posa l'àudio original de Matxa (sense passar pel sintetitzador, que les
            # fa brunzir), amb fosos de 3 ms.
            spf = rate * PERIOD / 1000; fade = int(rate * .003)
            for at, unit, idx in splices:
                idx = np.asarray(idx, int)
                mask = unit['unvoiced'][np.clip(idx, 0, unit['n'] - 1)]
                j = 0
                while j < len(idx):
                    if not mask[j]: j += 1; continue
                    e = j
                    while e < len(idx) and mask[e]: e += 1
                    d0, s0_ = int(round((at + j) * spf)), int(round(idx[j] * spf)); nsm = int(round((e - j) * spf))
                    nsm = min(nsm, len(y) - d0, len(unit['x']) - s0_)
                    if nsm > 2 * fade:
                        w = np.ones(nsm); w[:fade] = np.linspace(0, 1, fade); w[-fade:] = np.linspace(1, 0, fade)
                        y[d0:d0 + nsm] = y[d0:d0 + nsm] * (1 - w) + unit['x'][s0_:s0_ + nsm] * w
                    j = e
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
