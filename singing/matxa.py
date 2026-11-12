"""Client de Matxa (veu neuronal catalana del Projecte Aina, BSC) a través del seu espai públic de Hugging Face.

Mateix protocol que fa servir eltauler (veuneural.js): cua de Gradio. Primer es tria l'accent (fn 3)
i després es demana la síntesi (fn 0): text, accent, parlant, temperatura i escala de durada.
Ús: python singing/matxa.py "Balla, balla, a contratemps" sortida.wav [--speaker grau]
"""
import json, random, string, sys, time, urllib.request

BASE = 'https://projecte-aina-matxa-alvocat-tts-ca.hf.space'
VOICES = {'elia': 'central', 'grau': 'central', 'emma': 'nord-occidental', 'pere': 'nord-occidental',
          'gina': 'valencia', 'lluc': 'valencia', 'olga': 'balear', 'quim': 'balear'}

def _post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)

def _call(session, fn, data):
    joined = _post(f'{BASE}/gradio_api/queue/join', {'data': data, 'fn_index': fn, 'session_hash': session, 'event_data': None, 'trigger_id': None})
    with urllib.request.urlopen(f'{BASE}/gradio_api/queue/data?session_hash={session}', timeout=120) as r:
        for raw in r:
            line = raw.decode('utf-8', 'replace').strip()
            if not line.startswith('data:'): continue
            ev = json.loads(line[5:])
            if ev.get('msg') == 'process_completed' and ev.get('event_id') in (None, joined.get('event_id')):
                if not ev.get('success'): raise RuntimeError(f'Matxa ha fallat: {ev}')
                return ev['output']['data']
    raise RuntimeError('Matxa no ha respost')

class Matxa:
    def __init__(self, speaker='grau'):
        self.speaker, self.accent = speaker, VOICES[speaker]
        self.session = 'radiospam' + ''.join(random.choice(string.ascii_lowercase) for _ in range(10))
        _call(self.session, 3, [self.accent])

    def say(self, text, out_path, length_scale=1.0, temperature=0.2, tries=3):
        for attempt in range(tries):
            try:
                out = _call(self.session, 0, [text, self.accent, self.speaker, temperature, length_scale])
                f = out[0]
                url = f.get('url') or f'{BASE}/gradio_api/file={f["path"]}'
                urllib.request.urlretrieve(url, out_path)
                return out_path
            except Exception:
                if attempt == tries - 1: raise
                time.sleep(3 * (attempt + 1))

if __name__ == '__main__':
    args = sys.argv[1:]
    speaker = args[args.index('--speaker') + 1] if '--speaker' in args else 'grau'
    Matxa(speaker).say(args[0], args[1])
    print('fet:', args[1])
