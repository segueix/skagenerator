(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SkaBrowserSinging = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // La conversió de parla a cant i els filtres s'executen al navegador.
  // La parla Matxa encara prové del seu servei públic de Gradio: NO és inferència local.
  const BASE = 'https://projecte-aina-matxa-alvocat-tts-ca.hf.space';
  const ACCENTS = { elia: 'central', grau: 'central', emma: 'nord-occidental',
    pere: 'nord-occidental', gina: 'valencia', lluc: 'valencia',
    olga: 'balear', quim: 'balear' };
  const PRESETS = Object.freeze({
    jamaican: { name: 'Ska jamaicà càlid', speaker: 'grau', effect: 'warm', eq: { low: 2, mid: 0, high: 1 }, gainDb: 0 },
    rocksteady: { name: 'Rocksteady vellutat', speaker: 'olga', effect: 'warm', eq: { low: 3, mid: -2, high: -2 }, gainDb: 0 },
    twotone: { name: '2 Tone nasal', speaker: 'pere', effect: 'clean', eq: { low: -2, mid: 3, high: 2 }, gainDb: 1 },
    nutty: { name: 'Nutty teatral', speaker: 'quim', effect: 'radio', eq: { low: 0, mid: 3, high: 2 }, gainDb: 0 },
    bossreggae: { name: 'Boss reggae de vinil', speaker: 'lluc', effect: 'warm', eq: { low: 2, mid: -1, high: -3 }, gainDb: 0 },
    skaswing: { name: 'Ska-swing brillant', speaker: 'elia', effect: 'clean', eq: { low: 0, mid: 1, high: 3 }, gainDb: 0 },
    skapunk: { name: 'Ska-punk estrident', speaker: 'pere', effect: 'radio', eq: { low: -1, mid: 3, high: 2 }, gainDb: 1 },
    punk77: { name: 'Punk 77 cru', speaker: 'grau', effect: 'radio', eq: { low: -1, mid: 4, high: 1 }, gainDb: 0 },
    oi: { name: 'Oi! aspre', speaker: 'quim', effect: 'warm', eq: { low: 3, mid: 3, high: -1 }, gainDb: 1 },
    skatepunk: { name: 'Skate punk tens', speaker: 'lluc', effect: 'radio', eq: { low: -1, mid: 3, high: 2 }, gainDb: 1 },
    garage: { name: 'Garage lo-fi', speaker: 'grau', effect: 'lofi', eq: { low: 1, mid: 2, high: -2 }, gainDb: 0 },
    postpunk: { name: 'Post-punk fosc', speaker: 'grau', effect: 'warm', eq: { low: 3, mid: -2, high: -3 }, gainDb: 0 },
    hardcore: { name: 'Hardcore agressiu', speaker: 'pere', effect: 'megaphone', eq: { low: -1, mid: 3, high: 1 }, gainDb: 0 },
    poppunk: { name: 'Pop-punk brillant', speaker: 'gina', effect: 'clean', eq: { low: -2, mid: 1, high: 4 }, gainDb: 1 },
    horrorpunk: { name: 'Horror punk espectral', speaker: 'quim', effect: 'radio', eq: { low: 3, mid: 1, high: -3 }, gainDb: 0 }
  });
  const DEFAULT = PRESETS.jamaican;
  const presetFor = subgenre => PRESETS[subgenre] || DEFAULT;
  const aborted = () => { const e = new Error('Generació de veu cancel·lada'); e.name = 'AbortError'; return e; };

  // Protocol Gradio de Matxa: fn 3 selecciona accent, fn 0 retorna un WAV.
  async function gradio(fn, data, session, signal) {
    if (signal?.aborted) throw aborted();
    const res = await fetch(BASE + '/gradio_api/queue/join', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, fn_index: fn, session_hash: session, event_data: null, trigger_id: null }), signal });
    if (!res.ok) throw new Error('Matxa no accepta la petició (' + res.status + ')');
    const joined = await res.json();
    if (!joined.event_id) throw new Error('Matxa no ha retornat un identificador de tasca');
    const events = await fetch(BASE + '/gradio_api/queue/data?session_hash=' + encodeURIComponent(session), { signal });
    if (!events.ok || !events.body?.getReader) throw new Error('No es pot rebre el resultat de Matxa');
    const reader = events.body.getReader(), decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
        let cut;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
          for (const line of block.split('\n')) {
            if (!line.startsWith('data:')) continue;
            let message;
            try { message = JSON.parse(line.slice(5)); } catch { continue; }
            if (message.event_id && message.event_id !== joined.event_id) continue;
            if (message.msg === 'process_completed') {
              if (!message.success) throw new Error('Matxa ha rebutjat la síntesi');
              return message.output?.data;
            }
          }
        }
      }
    } finally { reader.cancel().catch(() => {}); }
    throw new Error('La connexió amb Matxa s’ha tancat abans de rebre la veu');
  }

  function extractAudioUrl(output) {
    const file = output?.[0];
    const raw = file?.url || (typeof file?.path === 'string' ? BASE + '/gradio_api/file=' + encodeURI(file.path) : '');
    if (!raw) throw new Error('Matxa no ha retornat cap fitxer de veu');
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) throw new Error('L’àudio de Matxa prové d’un origen inesperat');
    return url.href;
  }

  // Un mateix text de tornada i la mateixa veu només es demanen un cop per sessió.
  class MatxaClient {
    constructor() { this.cache = new Map(); this.sessions = new Map(); this.ctx = null; }
    async speak(text, speaker, rate, signal) {
      if (!ACCENTS[speaker]) throw new Error('Veu de Matxa desconeguda');
      if (signal?.aborted) throw aborted();
      const key = speaker + '|' + text;
      if (!this.cache.has(key)) {
        const task = this._request(text, speaker, rate, signal).catch(e => { this.cache.delete(key); throw e; });
        this.cache.set(key, task);
        if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value);
      }
      return this.cache.get(key);
    }
    async _request(text, speaker, rate, signal) {
      // Un timeout evita que la cua de la ràdio quedi penjada si la demo s'atura.
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), 100000);
      try {
        // S'usa una sessió per consulta per evitar confondre esdeveniments SSE simultanis.
        const session = 'ska' + Math.random().toString(36).slice(2, 12);
        await gradio(3, [ACCENTS[speaker]], session, controller.signal);
        const result = await gradio(0, [text, ACCENTS[speaker], speaker, .25, 1.08], session, controller.signal);
        const audio = await fetch(extractAudioUrl(result), { signal: controller.signal });
        if (!audio.ok) throw new Error('No s’ha pogut descarregar el WAV de Matxa');
        const bytes = await audio.arrayBuffer();
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await this.ctx.decodeAudioData(bytes);
        const mono = new Float32Array(decoded.length);
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const ch = decoded.getChannelData(c);
          for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
        }
        return decoded.sampleRate === rate ? mono : window.SkaAudioUtils.resampleLinear(mono, decoded.sampleRate, rate);
      } catch (error) {
        if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Generació cancel·lada' : 'Temps d’espera de Matxa exhaurit');
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    }
  }

  // Un segment de veu parlada per síl·laba, ajustat a la durada i la nota musical.
  // És cant aproximat amb granulat: no és el model WORLD/Matxa que funciona en Python.
  function estimatePitch(samples, rate) {
    const start = Math.max(0, Math.floor(samples.length * .25));
    const windowSize = Math.min(2300, samples.length - start);
    if (windowSize < 300) return 180;
    const step = 2, minLag = Math.floor(rate / 410 / step), maxLag = Math.min(Math.floor(rate / 85 / step), Math.floor(windowSize / 3 / step));
    const length = Math.floor(windowSize / step);
    let bestLag = 0, bestScore = 0, firstReliable = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let a = 0, b = 0, corr = 0;
      for (let i = 0; i < length - lag; i++) {
        const x = samples[start + i * step], y = samples[start + (i + lag) * step];
        corr += x * y; a += x * x; b += y * y;
      }
      const score = corr / (Math.sqrt(a * b) + 1e-8);
      if (score > bestScore) { bestScore = score; bestLag = lag; }
      // El màxim global sol caure a dues vegades el període (una octava falsa).
      // Prioritzem el primer període amb una correlació clarament fiable.
      if (!firstReliable && score > .965) firstReliable = lag;
    }
    const chosen = firstReliable || bestLag;
    return chosen && bestScore > .27 ? rate / (chosen * step) : 180;
  }
  function boundaries(samples, count, rate) {
    const out = [0], step = Math.max(1, Math.round(rate * .01)), sums = [];
    let peak = 0;
    for (let i = 0; i < samples.length; i += step) {
      let sum = 0;
      for (let j = i; j < Math.min(samples.length, i + step); j++) sum += samples[j] * samples[j];
      const rms = Math.sqrt(sum / step);
      sums.push(rms); peak = Math.max(peak, rms);
    }
    // Alineació aproximada: busca un mínim de volum al voltant de cada tall esperat.
    for (let i = 1; i < count; i++) {
      const target = Math.floor(sums.length * i / count);
      const radius = Math.max(2, Math.min(12, Math.floor(sums.length / count / 3)));
      let best = target, value = Infinity;
      for (let j = Math.max(1, target - radius); j <= Math.min(sums.length - 2, target + radius); j++) {
        const cost = sums[j] / (peak + 1e-9) + Math.abs(j - target) / (radius + 1) * .15;
        if (cost < value) { best = j; value = cost; }
      }
      out.push(Math.max(out[out.length - 1] + 1, Math.min(samples.length - 1, best * step)));
    }
    out.push(samples.length);
    return out;
  }
  function singNote(source, targetLength, midi, rate) {
    const out = new Float32Array(targetLength);
    if (!source.length || !targetLength) return out;
    const sourcePitch = estimatePitch(source, rate);
    let hz = 440 * 2 ** ((midi - 69) / 12), ratio = hz / sourcePitch;
    // Una octava no canvia l'harmonia: es tria la més propera al registre de la veu.
    while (ratio > 1.7) ratio /= 2;
    while (ratio < .68) ratio *= 2;
    const size = Math.min(1536, Math.max(128, Math.floor(source.length / 2)));
    const hop = Math.max(32, Math.floor(size / 4));
    const accum = new Float32Array(targetLength), weights = new Float32Array(targetLength);
    const inner = Math.max(1, source.length - size);
    for (let dst = 0; dst < targetLength; dst += hop) {
      const srcAt = inner === 1 ? 0 : Math.floor((dst * ratio) % inner);
      const n = Math.min(size, targetLength - dst);
      for (let i = 0; i < n; i++) {
        const win = .5 - .5 * Math.cos((2 * Math.PI * i) / size);
        const position = srcAt + i * ratio;
        const a = Math.floor(position) % source.length, b = (a + 1) % source.length;
        const sample = source[a] + (source[b] - source[a]) * (position - Math.floor(position));
        accum[dst + i] += sample * win;
        weights[dst + i] += win;
      }
    }
    const fade = Math.min(Math.floor(rate * .02), Math.floor(targetLength / 4));
    for (let i = 0; i < targetLength; i++) {
      let gain = weights[i] ? accum[i] / weights[i] : 0;
      if (fade) gain *= Math.min(1, i / fade, (targetLength - 1 - i) / fade);
      out[i] = gain;
    }
    return out;
  }

  function renderPCM(speech, lines, frames, rate) {
    if (!(speech instanceof Float32Array) || !Array.isArray(lines) ||
      !Number.isInteger(frames) || frames < 0 || !Number.isFinite(rate)) throw new Error('Partitura de cant no vàlida');
    const out = new Float32Array(frames);
    const all = lines.flatMap(l => l.notes || []);
    if (!all.length || speech.length < 256) return out;
    const lineCount = lines.reduce((n, l) => n + l.notes.length, 0);
    const lineBreaks = boundaries(speech, lineCount, rate);
    let index = 0;
    for (const line of lines) {
      for (const note of line.notes) {
        const start = Math.max(0, Math.floor(note.at * rate));
        const length = Math.max(0, Math.min(frames - start, Math.floor(note.dur * rate)));
        if (length && start < frames) {
          const source = speech.subarray(lineBreaks[index], lineBreaks[index + 1]);
          const sung = singNote(source, length, note.midi, rate);
          for (let k = 0; k < length; k++) out[start + k] += sung[k];
        }
        index++;
      }
    }
    return out;
  }

  // La petició de Matxa és asíncrona; el càlcul de nota i filtre passa a un Web Worker.
  function createBrowserSinger(options = {}) {
    const rate = options.rate || 44100, client = options.client || new MatxaClient();
    const makeWorker = options.makeWorker || (() => new Worker(new URL('browser-singing-worker.js', document.currentScript?.src || document.baseURI)));
    let worker = null, serial = 0;
    const pending = new Map();
    function ensureWorker() {
      if (worker) return worker;
      worker = makeWorker();
      worker.onmessage = ({ data }) => {
        const p = pending.get(data.id);
        if (!p) return;
        pending.delete(data.id);
        if (data.error) p.reject(new Error(data.error)); else p.resolve(data.voice);
      };
      worker.onerror = () => {
        for (const p of pending.values()) p.reject(new Error('El motor de veu del navegador ha fallat'));
        pending.clear(); worker?.terminate(); worker = null;
      };
      return worker;
    }
    return {
      async renderSection({ text, lines, subgenre, frames, signal }) {
        if (!lines?.length || !lines.some(l => l.notes.length)) return new Float32Array(frames);
        const preset = presetFor(subgenre);
        const pcm = await client.speak(text.replace(/\n+/g, '. '), preset.speaker, rate, signal);
        if (signal?.aborted) throw aborted();
        return new Promise((resolve, reject) => {
          const id = ++serial;
          pending.set(id, { resolve, reject });
          try { ensureWorker().postMessage({ id, type: 'sing', pcm: pcm.slice(), lines, frames, rate, preset }); }
          catch (error) { pending.delete(id); reject(error); }
        });
      },
      dispose() {
        worker?.terminate(); worker = null;
        for (const p of pending.values()) p.reject(aborted());
        pending.clear();
      }
    };
  }

  return { PRESETS, ACCENTS, presetFor, renderPCM, estimatePitch, boundaries,
    MatxaClient, createBrowserSinger, extractAudioUrl };
});
