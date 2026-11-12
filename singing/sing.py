"""Fa cantar la veu TIGER (DiffSinger) sobre la partitura exportada per export.cjs i la mescla amb la banda.

Ús: python singing/sing.py <carpeta de la veu TIGER> <partitura.json> <banda.wav> <sortida.mp3>

Passos per a cada frase (tros de cançó entre respiracions):
  1. Paraules → fonemes (diccionari anglès de la veu; si falta, CMUdict) repartits per síl·labes.
  2. Fonemes amb temps: les consonants d'inici van just abans de la nota (com canta una persona),
     la vocal ocupa la nota i les consonants finals en tanquen el final. Silencis = SP, respiració = AP.
  3. Entonació: el model de pitch de la veu (vibrato, portaments) a partir de les notes.
  4. So: model acústic (mel) i vocoder → ona.
Després la veu es comprimeix, se li posa una mica de sala i es mescla amb la banda.
"""
import glob, json, math, os, subprocess, sys, time
import numpy as np
import onnxruntime as ort
import yaml
from scipy import signal
import soundfile as sf

RATE, HOP = 44100, 512
FPS = RATE / HOP

def load_phonemes(path):
    return [line.strip() for line in open(path, encoding='utf-8') if line.strip()]

def token_map(phonemes):
    return {p: i for i, p in enumerate(phonemes)}

def emb(path):
    return np.fromfile(path, dtype=np.float32).reshape(256)

class Voice:
    def __init__(self, root, speaker='tiger_fresh'):
        base = glob.glob(os.path.join(root, '**', 'dsconfig.yaml'), recursive=True)
        base = min(base, key=len)
        self.dir = os.path.dirname(base)
        cfg = yaml.safe_load(open(base, encoding='utf-8'))
        d = lambda *p: os.path.join(self.dir, *p)
        self.max_depth = int(cfg.get('max_depth', 400))
        so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 4
        sess = lambda p: ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
        self.acoustic = sess(d(cfg['acoustic']))
        self.ac_tokens = token_map(load_phonemes(d(cfg['phonemes'])))
        self.speaker = emb(d('dsacoustic', f'{speaker}.emb'))
        voc = yaml.safe_load(open(d('dsvocoder', 'vocoder.yaml'), encoding='utf-8'))
        self.vocoder = sess(d('dsvocoder', voc['model']))
        pcfg = yaml.safe_load(open(d('dspitch', 'dsconfig.yaml'), encoding='utf-8'))
        self.pitch_ling = sess(d('dspitch', pcfg['linguistic']))
        self.pitch = sess(d('dspitch', pcfg['pitch']))
        self.pitch_tokens = token_map(load_phonemes(d('dspitch', pcfg['phonemes'])))
        self.pitch_speaker = emb(d('dspitch', pcfg['speakers'][0] + '.emb'))
        # Diccionari: símbols (amb el tipus: vocal, oclusiva…) i entrades paraula → fonemes.
        dic = yaml.safe_load(open(d('dsdur', 'dsdict-en.yaml'), encoding='utf-8'))
        self.vowels = {s['symbol'] for s in dic.get('symbols', []) if s.get('type') == 'vowel'} - {'AP', 'SP'}
        self.words = {}
        for e in dic.get('entries', []):
            self.words.setdefault(str(e['grapheme']).lower(), e['phonemes'] if isinstance(e['phonemes'], list) else str(e['phonemes']).split())
        try:
            import cmudict
            self.cmu = cmudict.dict()
        except Exception:
            self.cmu = {}
        print(f'Veu: {len(self.ac_tokens)} fonemes acústics, {len(self.vowels)} vocals, {len(self.words)} paraules al diccionari, CMU {len(self.cmu)}')

    def token(self, table, p):
        for cand in (p, f'en/{p}', p.upper(), p.lower()):
            if cand in table: return table[cand]
        return table.get('SP', 0)

    def phonemes_of(self, word):
        w = word.lower().strip("'")
        for cand in (w, w.replace("'", ''), w.replace("’", "'")):
            if cand in self.words: return list(self.words[cand])
        if w in self.cmu:
            return [''.join(c for c in p if not c.isdigit()).lower() for p in self.cmu[w][0]]
        # Últim recurs: lletra a lletra amb vocals simples (paraules inventades).
        guess = {'a': 'ae', 'e': 'eh', 'i': 'ih', 'o': 'aa', 'u': 'ah', 'y': 'iy'}
        return [guess.get(c, c) for c in w if c.isalpha() and (c in guess or c in 'bdfghjklmnprstvwz')]

    def syllables(self, word):
        """Fonemes partits en síl·labes: (inici, vocal, final)."""
        ph = self.phonemes_of(word)
        nuclei = [i for i, p in enumerate(ph) if p in self.vowels]
        if not nuclei: return [([], 'ah', [])]
        out = []
        for k, v in enumerate(nuclei):
            start = 0 if k == 0 else out[-1][3]
            nxt = nuclei[k + 1] if k + 1 < len(nuclei) else len(ph)
            cons = ph[v + 1:nxt]
            # Màxim una consonant d'inici per a la síl·laba següent; la resta tanca aquesta.
            split = len(cons) if k + 1 == len(nuclei) else max(0, len(cons) - 1)
            out.append([ph[start:v], ph[v], cons[:split], v + 1 + split])
        return [(o, v, c) for o, v, c, _ in out]

CONS_DUR = {'stop': .055, 'default': .07}

def plan_phrases(notes, gap=.6):
    phrases, cur = [], []
    for n in notes:
        if cur and (n['t'] - (cur[-1]['t'] + cur[-1]['d']) > gap or n.get('lineStart') and n['t'] - (cur[-1]['t'] + cur[-1]['d']) > .25):
            phrases.append(cur); cur = []
        cur.append(n)
    if cur: phrases.append(cur)
    return phrases

def build_phrase(voice, notes, shift):
    """Segments (fonema, inici, final) en segons absoluts i notes per al model de pitch."""
    # Agrupa notes per paraula: cada paraula té 'syllables' notes consecutives.
    words, i = [], 0
    while i < len(notes):
        n = notes[i]; group = [n]; i += 1
        while i < len(notes) and notes[i]['syllable'] > 0 and notes[i]['word'] == n['word']:
            group.append(notes[i]); i += 1
        words.append(group)
    segs = []  # [fonema, inici, final]
    for group in words:
        sylls = voice.syllables(group[0]['word'])
        # Ajusta síl·labes fonètiques a notes: sobren → s'ajunten a l'última nota; falten → la vocal s'allarga.
        per_note = [[s] for s in sylls[:len(group)]]
        for extra in sylls[len(group):]: per_note[-1].append(extra)
        while len(per_note) < len(group): per_note.append([])
        for note, parts in zip(group, per_note):
            t0, t1 = note['t'], note['t'] + note['d']
            if not parts:  # melisma: la vocal anterior continua
                if segs: segs[-1][2] = max(segs[-1][2], t1)
                continue
            slot = (t1 - t0) / len(parts)
            for k, (onset, vowel, coda) in enumerate(parts):
                vs, ve = t0 + k * slot, t0 + (k + 1) * slot
                # Consonants d'inici abans de la vocal; si trepitgen la nota anterior, l'escurcen.
                cs = vs - sum(CONS_DUR['default'] for _ in onset)
                if segs and segs[-1][2] > cs:
                    cs = max(cs, segs[-1][1] + .05)
                    segs[-1][2] = cs
                t = cs
                for c in onset:
                    step = (vs - cs) / max(1, len(onset)); segs.append([c, t, t + step]); t += step
                coda_len = min(.08 * len(coda), (ve - vs) * .4)
                segs.append([vowel, vs, ve - coda_len])
                t = ve - coda_len
                for c in coda:
                    step = coda_len / len(coda); segs.append([c, t, t + step]); t += step
    return segs

def to_frames(segs, start, end):
    """Segments amb SP entre forats i al principi i al final → fonemes i durades en frames."""
    out, t = [], start
    for p, a, b in segs:
        if a - t > .02: out.append(['SP' if a - t < .35 else 'AP', t, a])
        a = max(a, t)
        if b > a: out.append([p, a, b]); t = b
    if end - t > .01: out.append(['SP', t, end])
    names, durs, acc = [], [], 0
    for p, a, b in out:
        f = max(1, round((b - start) * FPS) - acc)
        names.append(p); durs.append(f); acc += f
    return names, durs

def midi_curve(notes, start, n_frames, shift):
    curve = np.zeros(n_frames, np.float32); rest = np.ones(n_frames, bool)
    for n in notes:
        a, b = int(round((n['t'] - start) * FPS)), int(round((n['t'] + n['d'] - start) * FPS))
        curve[max(0, a):min(n_frames, b)] = n['midi'] + shift; rest[max(0, a):min(n_frames, b)] = False
    # Els silencis agafen l'alçada de la nota més propera (com fa el model en entrenar).
    idx = np.where(~rest)[0]
    if len(idx):
        nearest = idx[np.clip(np.searchsorted(idx, np.arange(n_frames)), 0, len(idx) - 1)]
        curve[rest] = curve[nearest[rest]]
    return curve, rest

def sing_phrase(voice, notes, shift, steps):
    pad = .25
    segs = build_phrase(voice, notes, shift)
    start = min(s[1] for s in segs) - pad
    end = max(s[2] for s in segs) + pad
    names, durs = to_frames(segs, start, end)
    n_frames = int(sum(durs))
    base, rest = midi_curve(notes, start, n_frames, shift)
    # Notes per al model de pitch: trams de nota i de silenci que sumen tots els frames.
    note_midi, note_rest, note_dur, cur = [], [], [], None
    for f in range(n_frames):
        key = (float(base[f]), bool(rest[f]))
        if cur and cur[0] == key: cur[1] += 1
        else:
            if cur: note_midi.append(cur[0][0]); note_rest.append(cur[0][1]); note_dur.append(cur[1])
            cur = [key, 1]
    note_midi.append(cur[0][0]); note_rest.append(cur[0][1]); note_dur.append(cur[1])
    i64 = lambda x: np.array([x], np.int64)
    try:
        tokens = i64([voice.token(voice.pitch_tokens, p) for p in names])
        enc, _ = voice.pitch_ling.run(None, {'tokens': tokens, 'ph_dur': i64(durs)})
        f0_midi = voice.pitch.run(None, {
            'encoder_out': enc, 'ph_dur': i64(durs), 'note_midi': np.array([note_midi], np.float32),
            'note_rest': np.array([note_rest], bool), 'note_dur': i64(note_dur), 'pitch': base[None, :],
            'expr': np.ones((1, n_frames), np.float32), 'retake': np.ones((1, n_frames), bool),
            'spk_embed': np.broadcast_to(voice.pitch_speaker, (1, n_frames, 256)).astype(np.float32), 'speedup': np.array(10, np.int64)})[0][0]
    except Exception as error:
        print('  (pitch automàtic no disponible, corba pròpia):', str(error)[:200])
        f0_midi = signal.savgol_filter(base, 9, 2) + .15 * np.sin(np.arange(n_frames) / FPS * 2 * math.pi * 5.5) * np.clip((np.arange(n_frames) % 200) / 60 - .5, 0, 1)
    f0 = (440 * 2 ** ((np.asarray(f0_midi, np.float32) - 69) / 12)).astype(np.float32)
    tokens = i64([voice.token(voice.ac_tokens, p) for p in names])
    mel = voice.acoustic.run(None, {
        'tokens': tokens, 'durations': i64(durs), 'f0': f0[None, :], 'gender': np.zeros((1, n_frames), np.float32),
        'velocity': np.ones((1, n_frames), np.float32), 'spk_embed': np.broadcast_to(voice.speaker, (1, n_frames, 256)).astype(np.float32),
        'depth': np.array(voice.max_depth, np.int64), 'speedup': np.array(max(1, voice.max_depth // steps), np.int64)})[0]
    wave = voice.vocoder.run(None, {'mel': mel, 'f0': f0[None, :]})[0][0]
    return start, wave.astype(np.float32)

def compress(x, threshold_db=-20, ratio=3.0, attack=.005, release=.12):
    env, out = 0.0, np.empty_like(x)
    a, r = math.exp(-1 / (attack * RATE)), math.exp(-1 / (release * RATE))
    level = np.abs(x)
    # Envolupant ràpida per blocs (prou bona per a una veu).
    block = 64
    gains = np.ones(len(x), np.float32)
    for i in range(0, len(x), block):
        peak = float(level[i:i + block].max(initial=0))
        env = a * env + (1 - a) * peak if peak > env else r * env + (1 - r) * peak
        db = 20 * math.log10(env + 1e-9)
        gains[i:i + block] = 10 ** (-(max(0, db - threshold_db) * (1 - 1 / ratio)) / 20)
    return x * gains

def room(x):
    rng = np.random.default_rng(7)
    n = int(1.3 * RATE)
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-np.arange(n) / (.32 * RATE)).astype(np.float32)
    ir[:int(.012 * RATE)] = 0
    ir = signal.sosfilt(signal.butter(2, [300, 6000], 'band', fs=RATE, output='sos'), ir)
    wet = signal.fftconvolve(x, ir)[:len(x)]
    return wet / (np.abs(ir).sum() ** .5 * 6 + 1e-9)

def main(voice_dir, score_path, band_path, out_path, speaker=None, steps=40):
    score = json.load(open(score_path, encoding='utf-8'))
    band, rate = sf.read(band_path, dtype='float32', always_2d=True)
    assert rate == RATE
    notes = sorted(score['notes'], key=lambda n: n['t'])
    if not notes: raise SystemExit('Sense notes de veu')
    # TIGER és una veu masculina: si la melodia va alta, una octava avall (l'harmonia no canvia).
    median = float(np.median([n['midi'] for n in notes]))
    shift = -12 if median > 60 else 0
    speaker = speaker or {'rocksteady': 'tiger_vinyl', 'bossreggae': 'tiger_vinyl', 'jamaican': 'tiger_vinyl', 'poppunk': 'tiger_electric'}.get(score.get('subgenre'), 'tiger_fresh')
    voice = Voice(voice_dir, speaker)
    vocal = np.zeros(len(band) + RATE * 2, np.float32)
    started = time.time()
    for k, phrase in enumerate(plan_phrases(notes)):
        start, wave = sing_phrase(voice, phrase, shift, steps)
        a = int(round(start * RATE))
        if a < 0: wave = wave[-a:]; a = 0
        end = min(len(vocal), a + len(wave))
        # Fos curt als extrems de cada frase per evitar clics.
        fade = min(256, len(wave) // 4)
        w = wave[:end - a].copy(); w[:fade] *= np.linspace(0, 1, fade); w[-fade:] *= np.linspace(1, 0, fade)
        vocal[a:end] += w
        print(f'  frase {k + 1}: {len(phrase)} síl·labes, {len(wave) / RATE:.1f} s')
    print(f'Veu feta en {time.time() - started:.0f} s (to {shift:+d}, timbre {speaker})')
    vocal = vocal[:len(band)]
    vocal = signal.sosfilt(signal.butter(2, 110, 'high', fs=RATE, output='sos'), vocal)
    vocal = compress(vocal)
    # Nivell: la veu uns 2 dB per sota de la banda als trams on canta.
    sung = np.abs(vocal) > 1e-3
    if sung.any():
        vr = math.sqrt(float(np.mean(vocal[sung] ** 2))); br = math.sqrt(float(np.mean(band[sung] ** 2)) + 1e-12)
        vocal *= (br * 10 ** (-1 / 20)) / (vr + 1e-9)
    wet = room(vocal) * .9
    mix = band.copy()
    mix[:, 0] += vocal + wet * .9; mix[:, 1] += vocal + wet * 1.1
    peak = float(np.abs(mix).max())
    if peak > .97: mix *= .97 / peak
    base = os.path.splitext(out_path)[0]
    sf.write(base + '.wav', mix, RATE, subtype='PCM_16')
    sf.write(base + '.vocal.wav', vocal + wet, RATE, subtype='PCM_16')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', base + '.wav', '-codec:a', 'libmp3lame', '-b:a', '160k', out_path], check=True)
    os.remove(base + '.wav')

if __name__ == '__main__':
    main(*sys.argv[1:5])
