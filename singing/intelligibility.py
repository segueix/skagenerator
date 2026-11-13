"""Quant s'entén una veu cantada: la transcriu amb Whisper i compta quantes paraules de la lletra hi surten.

Ús: python singing/intelligibility.py <veu.wav> <partitura.json> [--model small] [--lang ca]
Cada vers (frase de la partitura de export.cjs) es transcriu per separat i es compara amb les seves
paraules: així una frase inventada pel reconeixedor no embolica la resta. El resultat és el percentatge
de paraules cantades que s'encerten en ordre, sense accents ni majúscules. És una mesura relativa: serveix
per comparar versions del motor sobre la mateixa cançó (convé repetir-la i mirar-ne la mitjana).
"""
import argparse, difflib, json, re, unicodedata

def norm(word):
    word = unicodedata.normalize('NFD', word.lower())
    return re.sub(r'[^a-z]', '', ''.join(c for c in word if unicodedata.category(c) != 'Mn'))

def words_of(notes):
    out = []
    for n in notes:
        if n['syllable'] == 0:
            out += [norm(p) for p in re.split(r"['’\s-]", n['word']) if norm(p)]
    return out

def lines_of(score):
    """Versos: notes agrupades pel començament de cada vers (lineStart)."""
    lines = []
    for n in sorted(score['notes'], key=lambda n: n['t']):
        if n.get('lineStart') or not lines: lines.append([])
        lines[-1].append(n)
    return lines

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio'); ap.add_argument('score')
    ap.add_argument('--model', default='small'); ap.add_argument('--lang', default='ca')
    ap.add_argument('--limit', type=float, help='només els versos dels primers N segons')
    a = ap.parse_args()
    import numpy as np, soundfile as sf
    from scipy.signal import resample_poly
    from faster_whisper import WhisperModel
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
    x, rate = sf.read(a.audio, dtype='float32', always_2d=True)
    x = resample_poly(x.mean(1), 16000, rate).astype(np.float32)
    total = hit = 0
    samples = []
    for line in lines_of(json.load(open(a.score, encoding='utf-8'))):
        if a.limit and line[-1]['t'] + line[-1]['d'] > a.limit: continue
        t0 = max(0.0, line[0]['t'] - .35); t1 = line[-1]['t'] + line[-1]['d'] + .35
        chunk = x[int(t0 * 16000):int(t1 * 16000)]
        if len(chunk) < 8000: continue
        segments, _ = model.transcribe(chunk, language=a.lang, beam_size=5, vad_filter=False, condition_on_previous_text=False, without_timestamps=True)
        text = ' '.join(s.text for s in segments).strip()
        heard = [norm(w) for w in re.split(r"[\s'’-]+", text) if norm(w)]
        want = words_of(line)
        # Una frase inventada (molt més llarga que el vers) no compta.
        if len(heard) > 2 * len(want) + 3: heard = []
        matched = sum(b.size for b in difflib.SequenceMatcher(a=want, b=heard, autojunk=False).get_matching_blocks())
        total += len(want); hit += matched
        samples.append(f"«{' '.join(want)}» → «{text}»")
    print(f'Entès: {hit}/{total} paraules ({100 * hit / max(1, total):.0f} %)')
    for s in samples[:40]: print('  ', s[:160])

if __name__ == '__main__':
    main()
