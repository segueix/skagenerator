"""Mostra del timbre d'una persona (per a la conversió de veu) a partir de les síl·labes gravades a veu.html.

Ajunta vocals soles i síl·labes amb consonants sonores (les que millor mostren el timbre), sense els
silencis, fins a uns 25 segons. Ús: python singing/reference.py sortida.wav part1.zip [part2.zip …]
"""
import io, sys
import numpy as np, soundfile as sf
sys.path.insert(0, __import__('os').path.dirname(__file__))
import voicebank

def main(out, paths, seconds=25.0):
    bank = voicebank.Bank(paths)
    order = sorted(bank.files, key=lambda k: (0 if k.startswith('V-') else 1 if k.split('-')[1] in ('m', 'n', 'l', 'L', 'J', 'b', 'd') else 2, k))
    pieces, total = [], 0
    for key in order:
        z, name = bank.files[key]
        x, rate = sf.read(io.BytesIO(z.read(name)), dtype='float32', always_2d=True)
        x = x.mean(1)
        hop = int(rate * .01)
        rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
        loud = np.where(rms > rms.max() * .08)[0]
        if not len(loud): continue
        x = x[loud[0] * hop:(loud[-1] + 1) * hop]
        x = x[:int(1.2 * rate)] / (np.abs(x).max() + 1e-9) * .7
        fade = int(.02 * rate); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
        pieces += [x, np.zeros(int(.08 * rate), np.float32)]
        total += len(x) / rate
        if total >= seconds: break
    sf.write(out, np.concatenate(pieces), rate, subtype='PCM_16')
    print(f'Referència: {total:.1f} s de {len(pieces) // 2} síl·labes → {out}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
