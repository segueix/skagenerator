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
    """Qualsevol veu DiffSinger en format OpenUtau (dsconfig.yaml, dsacoustic, dspitch, dsdict).
    speaker: nom (o part del nom) d'un dels timbres de la veu; vocoder_dir: vocoder ONNX per a les
    veus que no en porten (p. ex. el PC-NSF-HiFiGAN d'OpenVPI)."""
    def __init__(self, root, speaker=None, vocoder_dir=None):
        configs = [p for p in glob.glob(os.path.join(root, '**', 'dsconfig.yaml'), recursive=True)
                   if 'acoustic' in (yaml.safe_load(open(p, encoding='utf-8')) or {})]
        base = min(configs, key=len)
        self.dir = os.path.dirname(base)
        cfg = yaml.safe_load(open(base, encoding='utf-8'))
        d = lambda *p: os.path.join(self.dir, *p)
        self.max_depth = float(cfg.get('max_depth', 400))
        so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 4
        sess = lambda p: ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
        self.acoustic = sess(d(cfg['acoustic']))
        self.ac_tokens = token_map(load_phonemes(d(cfg['phonemes'])))
        self.speakers = [str(x) for x in cfg.get('speakers') or []]
        chosen = next((x for x in self.speakers if speaker and speaker.lower() in os.path.basename(x).lower()), self.speakers[0] if self.speakers else None)
        self.speaker_name = os.path.basename(chosen) if chosen else 'única'
        self.speaker = emb(d(chosen + '.emb')) if chosen else None
        # Vocoder: el de la veu (carpeta amb vocoder.yaml) o un d'extern.
        voc_dir = d(str(cfg.get('vocoder', 'dsvocoder')))
        if os.path.exists(os.path.join(voc_dir, 'vocoder.yaml')):
            voc = yaml.safe_load(open(os.path.join(voc_dir, 'vocoder.yaml'), encoding='utf-8'))
            self.vocoder = sess(os.path.join(voc_dir, voc['model']))
        else:
            models = glob.glob(os.path.join(vocoder_dir or '', '**', '*.onnx'), recursive=True)
            if not models: raise SystemExit(f'La veu demana el vocoder «{cfg.get("vocoder")}» i no n\'hi ha cap a {vocoder_dir}')
            self.vocoder = sess(models[0])
        # Model d'entonació (opcional).
        self.pitch = None
        pitch_cfg = glob.glob(d('dspitch', 'dsconfig.yaml'))
        if pitch_cfg:
            pcfg = yaml.safe_load(open(pitch_cfg[0], encoding='utf-8'))
            pd = lambda *p: os.path.join(self.dir, 'dspitch', *p)
            self.pitch_ling = sess(pd(pcfg['linguistic']))
            self.pitch = sess(pd(pcfg['pitch']))
            self.pitch_tokens = token_map(load_phonemes(pd(pcfg['phonemes'])))
            spk = [str(x) for x in pcfg.get('speakers') or []]
            pick = next((x for x in spk if speaker and speaker.lower() in os.path.basename(x).lower()), spk[0] if spk else None)
            self.pitch_speaker = emb(pd(pick + '.emb')) if pick else None
        # Diccionari anglès: símbols (amb el tipus: vocal, oclusiva…) i entrades paraula → fonemes.
        dicts = sorted(glob.glob(os.path.join(self.dir, '**', 'dsdict*.yaml'), recursive=True),
                       key=lambda p: (0 if os.path.basename(p) == 'dsdict-en.yaml' else 1 if 'en' in os.path.basename(p) else 2, len(p)))
        dic = yaml.safe_load(open(dicts[0], encoding='utf-8')) if dicts else {}
        self.vowels = {s['symbol'] for s in dic.get('symbols', []) if s.get('type') == 'vowel'} - {'AP', 'SP'}
        if not self.vowels: self.vowels = {'aa', 'ae', 'ah', 'ao', 'aw', 'ax', 'ay', 'eh', 'er', 'ey', 'ih', 'iy', 'ow', 'oy', 'uh', 'uw'}
        self.words = {}
        for e in dic.get('entries', []) or []:
            self.words.setdefault(str(e['grapheme']).lower(), e['phonemes'] if isinstance(e['phonemes'], list) else str(e['phonemes']).split())
        try:
            import cmudict
            self.cmu = cmudict.dict()
        except Exception:
            self.cmu = {}
        names = lambda m: [i.name for i in m.get_inputs()]
        print(f'Veu {os.path.basename(self.dir)} · timbre {self.speaker_name} (de {len(self.speakers) or 1}) · {len(self.ac_tokens)} fonemes · '
              f'diccionari {len(self.words)} paraules · entrades acústiques {names(self.acoustic)} · pitch {"sí" if self.pitch else "no"}')

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
        # Possessius i contraccions que no són al diccionari: «trouble's» = «trouble» + z.
        for suffix, extra in (("'s", ['z']), ("'ll", ['l']), ("'re", ['er']), ("'ve", ['v']), ("'d", ['d'])):
            if w.endswith(suffix) and len(w) > len(suffix):
                return self.phonemes_of(w[:-len(suffix)]) + extra
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
    last_vowel = -1e9  # inici de l'última vocal: les consonants següents no se la poden menjar
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
                # Com a molt el 40 % de la nota anterior (si les notes són seguides).
                cs = vs - min(sum(CONS_DUR['default'] for _ in onset), max(.03 * len(onset), (vs - last_vowel) * .4))
                if segs and segs[-1][2] > cs:
                    # La nota anterior (vocal o consonants finals) s'escurça fins on comença aquesta.
                    while segs and segs[-1][1] >= cs - .02 and segs[-1][0] not in voice.vowels: segs.pop()
                    if segs: segs[-1][2] = min(segs[-1][2], cs)
                t = cs
                for c in onset:
                    step = (vs - cs) / max(1, len(onset)); segs.append([c, t, t + step]); t += step
                coda_len = min(.08 * len(coda), (ve - vs) * .4)
                segs.append([vowel, vs, ve - coda_len]); last_vowel = vs
                t = ve - coda_len
                for c in coda:
                    step = coda_len / len(coda); segs.append([c, t, t + step]); t += step
    return [x for x in segs if x[2] - x[1] > .005]

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

def sing_phrase(voice, notes, shift, steps, gender=0.0):
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
        if voice.pitch is None: raise RuntimeError('la veu no té model de pitch')
        tokens = i64([voice.token(voice.pitch_tokens, p) for p in names])
        lwanted = {i.name for i in voice.pitch_ling.get_inputs()}
        enc = voice.pitch_ling.run(None, {k: v for k, v in {'tokens': tokens, 'ph_dur': i64(durs), 'languages': np.zeros_like(tokens)}.items() if k in lwanted})[0]
        if voice.pitch is None: raise RuntimeError('la veu no té model de pitch')
        feed = {'encoder_out': enc, 'ph_dur': i64(durs), 'note_midi': np.array([note_midi], np.float32),
            'note_rest': np.array([note_rest], bool), 'note_dur': i64(note_dur), 'pitch': base[None, :],
            'expr': np.ones((1, n_frames), np.float32), 'retake': np.ones((1, n_frames), bool), 'speedup': np.array(10, np.int64), 'steps': np.array(10, np.int64)}
        if voice.pitch_speaker is not None: feed['spk_embed'] = np.broadcast_to(voice.pitch_speaker, (1, n_frames, 256)).astype(np.float32)
        wanted = {i.name for i in voice.pitch.get_inputs()}
        f0_midi = voice.pitch.run(None, {k: v for k, v in feed.items() if k in wanted})[0][0]
    except Exception as error:
        print('  (pitch automàtic no disponible, corba pròpia):', str(error)[:200])
        f0_midi = signal.savgol_filter(base, 9, 2) + .15 * np.sin(np.arange(n_frames) / FPS * 2 * math.pi * 5.5) * np.clip((np.arange(n_frames) % 200) / 60 - .5, 0, 1)
    f0 = (440 * 2 ** ((np.asarray(f0_midi, np.float32) - 69) / 12)).astype(np.float32)
    tokens = i64([voice.token(voice.ac_tokens, p) for p in names])
    feed = {'tokens': tokens, 'durations': i64(durs), 'f0': f0[None, :], 'gender': np.full((1, n_frames), gender, np.float32),
        'velocity': np.ones((1, n_frames), np.float32), 'depth': np.array(int(voice.max_depth), np.int64),
        'speedup': np.array(max(1, int(voice.max_depth) // steps), np.int64), 'steps': np.array(steps, np.int64), 'languages': np.zeros_like(tokens),
        'key_shift': np.zeros((1, n_frames), np.float32), 'speed': np.ones((1, n_frames), np.float32),
        'energy': np.zeros((1, n_frames), np.float32), 'breathiness': np.zeros((1, n_frames), np.float32),
        'voicing': np.zeros((1, n_frames), np.float32), 'tension': np.zeros((1, n_frames), np.float32)}
    if voice.speaker is not None: feed['spk_embed'] = np.broadcast_to(voice.speaker, (1, n_frames, 256)).astype(np.float32)
    types = {i.name: i.type for i in voice.acoustic.get_inputs()}
    missing = set(types) - set(feed)
    if missing: raise SystemExit(f'El model acústic demana entrades desconegudes: {sorted(missing)}')
    # Les versions noves de DiffSinger volen la profunditat com a fracció (0–1) i els passos a part.
    if types.get('depth') == 'tensor(float)':
        feed['depth'] = np.array(voice.max_depth / 1000 if voice.max_depth > 1 else voice.max_depth, np.float32)
    cast = {'tensor(float)': np.float32, 'tensor(int64)': np.int64, 'tensor(bool)': bool}
    mel = voice.acoustic.run(None, {k: np.asarray(feed[k]).astype(cast.get(t, np.asarray(feed[k]).dtype)) for k, t in types.items()})[0]
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

def megaphone(x):
    """Megàfon: només els mitjos (500–3.200 Hz), saturació i la ressonància de la botzina."""
    rms = math.sqrt(float(np.mean(x ** 2)) + 1e-12)
    y = signal.sosfilt(signal.butter(4, [500, 3200], 'band', fs=RATE, output='sos'), x)
    y = np.tanh(y / (float(np.abs(y).max()) + 1e-9) * 3.5)
    y = y + .7 * signal.sosfilt(signal.butter(2, [1500, 1900], 'band', fs=RATE, output='sos'), y)
    y = signal.sosfilt(signal.butter(2, [450, 3600], 'band', fs=RATE, output='sos'), y)
    return (y * rms / (math.sqrt(float(np.mean(y ** 2))) + 1e-12)).astype(np.float32)

def main(voice_dir, score_path, band_path, out_path, speaker=None, steps=40, vocoder_dir=None, limit=None, fx=None, gender=0.0):
    score = json.load(open(score_path, encoding='utf-8'))
    band, rate = sf.read(band_path, dtype='float32', always_2d=True)
    assert rate == RATE
    notes = sorted(score['notes'], key=lambda n: n['t'])
    if not notes: raise SystemExit('Sense notes de veu')
    # TIGER és una veu masculina: si la melodia va alta, una octava avall (l'harmonia no canvia).
    median = float(np.median([n['midi'] for n in notes]))
    shift = -12 if median > 60 else 0
    speaker = speaker or {'rocksteady': 'tiger_vinyl', 'bossreggae': 'tiger_vinyl', 'jamaican': 'tiger_vinyl', 'poppunk': 'tiger_electric'}.get(score.get('subgenre'), 'tiger_fresh')
    voice = Voice(voice_dir, speaker, vocoder_dir)
    if limit:
        notes = [n for n in notes if n['t'] < limit]
        band = band[:int((limit + 3) * RATE)]
    vocal = np.zeros(len(band) + RATE * 2, np.float32)
    started = time.time()
    for k, phrase in enumerate(plan_phrases(notes)):
        start, wave = sing_phrase(voice, phrase, shift, steps, gender)
        a = int(round(start * RATE))
        if a < 0: wave = wave[-a:]; a = 0
        end = min(len(vocal), a + len(wave))
        # Fos curt als extrems de cada frase per evitar clics.
        fade = min(256, len(wave) // 4)
        w = wave[:end - a].copy(); w[:fade] *= np.linspace(0, 1, fade); w[-fade:] *= np.linspace(1, 0, fade)
        vocal[a:end] += w
        print(f'  frase {k + 1}: {len(phrase)} síl·labes, {len(wave) / RATE:.1f} s')
    print(f'Veu feta en {time.time() - started:.0f} s (to {shift:+d}, timbre {voice.speaker_name})')
    vocal = vocal[:len(band)]
    vocal = signal.sosfilt(signal.butter(2, 110, 'high', fs=RATE, output='sos'), vocal)
    vocal = compress(vocal)
    if fx == 'megaphone': vocal = megaphone(vocal)
    # Nivell: es compara als mitjos (300–4.000 Hz), on s'entén la veu i on el baix no infla la
    # mesura. La veu queda 5 dB per sobre de la banda en aquesta zona.
    mids = lambda x: signal.sosfilt(signal.butter(4, [300, 4000], 'band', fs=RATE, output='sos'), x, axis=0)
    sung = np.abs(vocal) > 1e-3
    if sung.any():
        vr = math.sqrt(float(np.mean(mids(vocal)[sung] ** 2))); br = math.sqrt(float(np.mean(mids(band.mean(1))[sung] ** 2)) + 1e-12)
        vocal *= (br * 10 ** (5 / 20)) / (vr + 1e-9)
    # Mentre canta la veu, els greus de la banda (baix i bombo per sota de 250 Hz) baixen 4 dB.
    env = signal.sosfiltfilt(signal.butter(1, 4, 'low', fs=RATE, output='sos'), (np.abs(vocal) > 2e-3).astype(np.float32))
    duck = (1 - (1 - 10 ** (-4 / 20)) * np.clip(env * 1.5, 0, 1)).astype(np.float32)
    low = signal.sosfiltfilt(signal.butter(4, 250, 'low', fs=RATE, output='sos'), band, axis=0).astype(np.float32)
    band = band - low + low * duck[:, None]
    wet = room(vocal) * (.35 if fx == 'megaphone' else .9)
    mix = band.copy()
    mix[:, 0] += vocal + wet * .9; mix[:, 1] += vocal + wet * 1.1
    if limit:  # tros de mostra: fos de sortida als 2 últims segons
        fade = min(len(mix), 2 * RATE); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = float(np.abs(mix).max())
    if peak > .97: mix *= .97 / peak
    base = os.path.splitext(out_path)[0]
    sf.write(base + '.wav', mix, RATE, subtype='PCM_16')
    sf.write(base + '.vocal.wav', vocal + wet, RATE, subtype='PCM_16')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', base + '.wav', '-codec:a', 'libmp3lame', '-b:a', '160k', out_path], check=True)
    os.remove(base + '.wav')

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='Fa cantar una partitura amb una veu DiffSinger i la mescla amb la banda.')
    ap.add_argument('voice'); ap.add_argument('score'); ap.add_argument('band'); ap.add_argument('out')
    ap.add_argument('--speaker', help='timbre de la veu (nom o part del nom)')
    ap.add_argument('--vocoder', help='carpeta amb un vocoder ONNX per a veus que no en porten')
    ap.add_argument('--limit', type=float, help='només els primers N segons (mostres)')
    ap.add_argument('--fx', choices=['megaphone'], help='efecte de la veu')
    ap.add_argument('--gender', type=float, default=0.0, help='-1 més greu … +1 més aguda (si el model ho admet)')
    ap.add_argument('--steps', type=int, default=40)
    a = ap.parse_args()
    main(a.voice, a.score, a.band, a.out, a.speaker, a.steps, a.vocoder, a.limit, a.fx, a.gender)
