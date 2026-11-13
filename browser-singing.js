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
  // Les veus «quim» i «olga» no s'hi fan servir: cantades són les que menys s'entenen (mesurat amb un
  // reconeixedor de veu). Tampoc el megàfon ni el filtre de ràdio, que retallen les consonants.
  const PRESETS = Object.freeze({
    jamaican: { name: 'Ska jamaicà càlid', speaker: 'grau', effect: 'warm', eq: { low: 2, mid: 0, high: 1 }, gainDb: 0 },
    rocksteady: { name: 'Rocksteady vellutat', speaker: 'emma', effect: 'warm', eq: { low: 3, mid: -2, high: -2 }, gainDb: 0 },
    twotone: { name: '2 Tone nasal', speaker: 'pere', effect: 'clean', eq: { low: -2, mid: 3, high: 2 }, gainDb: 1 },
    nutty: { name: 'Nutty teatral', speaker: 'lluc', effect: 'clean', eq: { low: 0, mid: 3, high: 2 }, gainDb: 0 },
    bossreggae: { name: 'Boss reggae de vinil', speaker: 'lluc', effect: 'warm', eq: { low: 2, mid: -1, high: -3 }, gainDb: 0 },
    skaswing: { name: 'Ska-swing brillant', speaker: 'elia', effect: 'clean', eq: { low: 0, mid: 1, high: 3 }, gainDb: 0 },
    skapunk: { name: 'Ska-punk estrident', speaker: 'pere', effect: 'clean', eq: { low: -1, mid: 3, high: 2 }, gainDb: 1 },
    punk77: { name: 'Punk 77 cru', speaker: 'grau', effect: 'clean', eq: { low: -1, mid: 4, high: 1 }, gainDb: 0 },
    oi: { name: 'Oi! aspre', speaker: 'grau', effect: 'warm', eq: { low: 3, mid: 3, high: -1 }, gainDb: 1 },
    skatepunk: { name: 'Skate punk tens', speaker: 'lluc', effect: 'clean', eq: { low: -1, mid: 3, high: 2 }, gainDb: 1 },
    garage: { name: 'Garage lo-fi', speaker: 'grau', effect: 'lofi', eq: { low: 1, mid: 2, high: -2 }, gainDb: 0 },
    postpunk: { name: 'Post-punk fosc', speaker: 'grau', effect: 'warm', eq: { low: 3, mid: -2, high: -3 }, gainDb: 0 },
    hardcore: { name: 'Hardcore agressiu', speaker: 'pere', effect: 'clean', eq: { low: -1, mid: 4, high: 2 }, gainDb: 0 },
    poppunk: { name: 'Pop-punk brillant', speaker: 'gina', effect: 'clean', eq: { low: -2, mid: 1, high: 4 }, gainDb: 1 },
    horrorpunk: { name: 'Horror punk espectral', speaker: 'pere', effect: 'warm', eq: { low: 3, mid: 1, high: -3 }, gainDb: 0 }
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

  // Matxa sintetitza a 22.050 Hz: la veu es descodifica i es canta a aquesta freqüència (la meitat de
  // càlcul) i només al final es passa a la de la cançó.
  const SPEECH_RATE = 22050, REQUEST_TIMEOUT = 45000, BREAK_MS = 180000;
  // Un context fora de línia descodifica directament a la freqüència demanada i no manté el maquinari
  // d'àudio despert (un AudioContext normal gasta bateria i al mòbil pot quedar suspès en segon pla).
  function decodeAudio(bytes, rate) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = Offline ? new Offline(1, 1, rate) : new (window.AudioContext || window.webkitAudioContext)();
    return new Promise((resolve, reject) => {
      const done = ctx.decodeAudioData(bytes, resolve, reject);
      if (done?.then) done.then(resolve, reject);
    }).finally(() => { if (!Offline) ctx.close?.(); });
  }
  // Un mateix text de tornada i la mateixa veu només es demanen un cop per sessió.
  class MatxaClient {
    constructor() { this.cache = new Map(); this.active = 0; this.waiting = []; }
    // Com a molt dues peticions alhora: la demo pública de Matxa és compartida.
    async _slot(signal) {
      if (this.active >= 2) await new Promise((resolve, reject) => {
        const entry = { resolve, reject };
        this.waiting.push(entry);
        signal?.addEventListener('abort', () => { const i = this.waiting.indexOf(entry); if (i >= 0) { this.waiting.splice(i, 1); reject(aborted()); } }, { once: true });
      });
      else this.active++;
    }
    _release() { const next = this.waiting.shift(); if (next) next.resolve(); else this.active--; }
    async speak(text, speaker, rate, signal) {
      if (!ACCENTS[speaker]) throw new Error('Veu de Matxa desconeguda');
      if (signal?.aborted) throw aborted();
      const key = speaker + '|' + rate + '|' + text;
      if (!this.cache.has(key)) {
        const task = this._request(text, speaker, rate, signal).catch(e => { this.cache.delete(key); throw e; });
        this.cache.set(key, task);
        if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value);
      }
      return this.cache.get(key);
    }
    async _request(text, speaker, rate, signal) {
      await this._slot(signal);
      // Un timeout evita que la cua de la ràdio quedi penjada si la demo s'atura.
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        // S'usa una sessió per consulta per evitar confondre esdeveniments SSE simultanis.
        const session = 'ska' + Math.random().toString(36).slice(2, 12);
        await gradio(3, [ACCENTS[speaker]], session, controller.signal);
        const result = await gradio(0, [text, ACCENTS[speaker], speaker, .25, 1.08], session, controller.signal);
        const audio = await fetch(extractAudioUrl(result), { signal: controller.signal });
        if (!audio.ok) throw new Error('No s’ha pogut descarregar el WAV de Matxa');
        const bytes = await audio.arrayBuffer();
        const decoded = await decodeAudio(bytes, rate);
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
        this._release();
      }
    }
  }

  // swing: el mateix desplaçament de les corxeres a contratemps que fa servir la banda (audio/performance.cjs).
  function scoreLines(text, counts, vocalNotes, bpm, swing = 0) {
    const names = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!Array.isArray(counts) || !Array.isArray(vocalNotes) || !Number.isFinite(bpm) || bpm <= 0) return [];
    const notes = vocalNotes.slice().sort((a, b) => a[0] * 4 + a[1] - (b[0] * 4 + b[1]));
    if (!names.length || names.length !== counts.length ||
      counts.reduce((sum, n) => sum + n, 0) !== notes.length) return [];
    let index = 0;
    const beat = 60 / bpm;
    return names.map((name, i) => {
      const swung = beats => swing && Math.abs(beats % 1 - .5) < .04 ? beats + swing / 6 : beats;
      const noteGroup = notes.slice(index, index + counts[i]).map(([bar, b, midi, dur]) => {
        const start = swung(bar * 4 + b), end = swung(bar * 4 + b + dur);
        return { at: start * beat, dur: Math.max(.03, (end - start) * beat), midi };
      });
      index += counts[i];
      return { text: name, notes: noteGroup };
    });
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
  // ── De parla a cant (PSOLA) ───────────────────────────────────────────
  // La parla de Matxa es converteix en cant sense tallar-la a trossos: se'n segueix el to (f0),
  // se'n marquen els polsos de la veu i es torna a sintetitzar pols a pols (TD-PSOLA) amb el to de
  // la melodia. Així es conserven les formants (no sona «d'heli») i les consonants. Cada vers es
  // localitza per les pauses que Matxa fa als punts, i dins del vers el temps s'estira sobretot a
  // les vocals perquè cada síl·laba ocupi la seva nota.
  const HOP_SECONDS = .005;
  function analyseSpeech(x, rate) {
    const hop = Math.max(1, Math.round(HOP_SECONDS * rate)), count = Math.floor(x.length / hop);
    // Senyal suavitzat i delmat (~11 kHz) per seguir el to amb poc càlcul.
    const dec = Math.max(1, Math.round(rate / 11025)), r = rate / dec, n = Math.floor(x.length / dec);
    const low = new Float32Array(x.length), y = new Float32Array(n);
    const k = 1 - Math.exp(-2 * Math.PI * 900 / rate);
    let state = 0;
    for (let i = 0; i < x.length; i++) { state += k * (x[i] - state); low[i] = state; }
    for (let i = 0; i < n; i++) y[i] = low[i * dec];
    const energy = new Float32Array(count);
    let peak = 0;
    for (let f = 0; f < count; f++) {
      let sum = 0; const a = Math.max(0, (f - 1) * hop), b = Math.min(x.length, (f + 2) * hop);
      for (let i = a; i < b; i++) sum += x[i] * x[i];
      energy[f] = Math.sqrt(sum / Math.max(1, b - a)); if (energy[f] > peak) peak = energy[f];
    }
    // Candidats de to per trama: màxims de l'autocorrelació normalitzada entre 70 i 400 Hz.
    const minLag = Math.floor(r / 400), maxLag = Math.ceil(r / 70), win = Math.round(.03 * r), CAND = 4;
    const candLag = new Float32Array(count * CAND), candScore = new Float32Array(count * CAND), scores = new Float32Array(maxLag + 2);
    for (let f = 0; f < count; f++) {
      const c = Math.round(f * hop / dec), a = c - (win >> 1);
      if (energy[f] < peak * .03 || a < 0 || a + win + maxLag >= n) continue;
      let e0 = 0;
      for (let i = 0; i < win; i++) e0 += y[a + i] * y[a + i];
      if (e0 < 1e-9) continue;
      let eL = 0;
      for (let i = 0; i < win; i++) eL += y[a + minLag - 1 + i] * y[a + minLag - 1 + i];
      for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
        let corr = 0;
        for (let i = 0; i < win; i++) corr += y[a + i] * y[a + i + lag];
        scores[lag] = corr / Math.sqrt(e0 * eL + 1e-12);
        eL += y[a + lag + win] * y[a + lag + win] - y[a + lag] * y[a + lag];
      }
      let found = 0;
      for (let lag = minLag; lag <= maxLag; lag++) {
        const s = scores[lag];
        if (s < .3 || s < scores[lag - 1] || s <= scores[lag + 1]) continue;
        // Interpolació parabòlica del màxim.
        const d = scores[lag - 1] - 2 * s + scores[lag + 1], fine = lag + (d ? .5 * (scores[lag - 1] - scores[lag + 1]) / d : 0);
        let slot = found < CAND ? found++ : -1;
        if (slot < 0) { let worst = 0; for (let j = 1; j < CAND; j++) if (candScore[f * CAND + j] < candScore[f * CAND + worst]) worst = j; if (candScore[f * CAND + worst] < s) slot = worst; }
        if (slot >= 0) { candLag[f * CAND + slot] = fine; candScore[f * CAND + slot] = s; }
      }
    }
    // Camí més coherent (Viterbi): evita salts d'octava i decideix quines trames són sonores.
    const STATES = CAND + 1, UNVOICED = CAND, cost = new Float32Array(count * STATES), back = new Int8Array(count * STATES);
    for (let f = 0; f < count; f++) for (let s = 0; s < STATES; s++) {
      const score = s === UNVOICED ? 0 : candScore[f * CAND + s];
      const local = s === UNVOICED ? .5 : score ? 1 - score : Infinity;
      let best = 0, from = 0;
      if (f) {
        best = Infinity;
        for (let p = 0; p < STATES; p++) {
          const prev = cost[(f - 1) * STATES + p];
          if (prev === Infinity) continue;
          let move;
          if (s === UNVOICED || p === UNVOICED) move = s === p ? 0 : .12;
          else move = 1.4 * Math.abs(Math.log2(candLag[f * CAND + s] / candLag[(f - 1) * CAND + p]));
          if (prev + move < best) { best = prev + move; from = p; }
        }
      }
      cost[f * STATES + s] = local === Infinity ? Infinity : best + local; back[f * STATES + s] = from;
    }
    const f0 = new Float32Array(count);
    if (count) {
      let s = 0;
      for (let j = 1; j < STATES; j++) if (cost[(count - 1) * STATES + j] < cost[(count - 1) * STATES + s]) s = j;
      for (let f = count - 1; f >= 0; f--) { f0[f] = s === UNVOICED ? 0 : r / candLag[f * CAND + s]; s = back[f * STATES + s]; }
    }
    // Polsos: a les trames sonores, un per període (al pic del senyal suavitzat); a la resta, cada 5 ms.
    const marks = [], periods = [], voiced = [];
    let at = 0;
    while (at < x.length - 1) {
      const hz = f0[Math.min(count - 1, Math.floor(at / hop))] || 0;
      if (!hz) { marks.push(Math.round(at)); periods.push(hop); voiced.push(0); at += hop; continue; }
      const period = rate / hz;
      let centre = at;
      if (marks.length && voiced[voiced.length - 1]) {
        // Segueix el pic més proper a un període de distància de l'anterior.
        const a = Math.max(0, Math.round(at - period * .25)), b = Math.min(x.length - 1, Math.round(at + period * .25));
        let top = -Infinity; for (let i = a; i <= b; i++) if (low[i] > top) { top = low[i]; centre = i; }
      } else {
        const a = Math.round(at), b = Math.min(x.length - 1, Math.round(at + period));
        let top = -Infinity; for (let i = a; i <= b; i++) if (low[i] > top) { top = low[i]; centre = i; }
      }
      marks.push(Math.round(centre)); periods.push(period); voiced.push(1);
      at = centre + period;
    }
    const pitched = Array.from(f0).filter(Boolean).sort((a, b) => a - b);
    return { hop, count, energy, peak, f0, marks, periods, voiced, median: pitched.length ? pitched[pitched.length >> 1] : 0 };
  }
  // Trossos de parla (en trames) separats per les pauses més llargues: un per vers.
  function splitSpeech(info, lineCount, weights) {
    const { energy, count, peak } = info, quiet = peak * .045, loud = f => energy[f] > quiet;
    let first = 0, last = count - 1;
    while (first < last && !loud(first)) first++;
    while (last > first && !loud(last)) last--;
    const pauses = [];
    for (let f = first; f <= last; f++) {
      if (loud(f)) continue;
      let end = f; while (end <= last && !loud(end)) end++;
      if (end - f >= 24) pauses.push([f, end]);   // 120 ms o més
      f = end;
    }
    let cuts;
    if (pauses.length >= lineCount - 1) {
      cuts = pauses.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, lineCount - 1).sort((a, b) => a[0] - b[0]);
    } else {
      // No s'han trobat prou pauses: es reparteix segons les síl·labes de cada vers.
      const total = weights.reduce((a, b) => a + b, 0); let acc = 0; cuts = [];
      for (let i = 0; i < lineCount - 1; i++) { acc += weights[i]; const f = Math.round(first + (last - first) * acc / total); cuts.push([f, f]); }
    }
    const spans = []; let from = first;
    for (const [a, b] of cuts) { spans.push([from, Math.max(from + 1, a)]); from = b; }
    spans.push([from, Math.max(from + 1, last + 1)]);
    return spans;
  }
  // Límits de síl·laba dins d'un vers: repartiment uniforme ajustat al mínim de volum més proper.
  function syllableFrames(info, [from, to], syllables) {
    const out = [from], length = to - from, radius = Math.max(1, Math.min(14, Math.floor(length / syllables / 2.5)));
    for (let i = 1; i < syllables; i++) {
      const target = from + Math.round(length * i / syllables);
      let best = target, value = Infinity;
      for (let f = Math.max(out[out.length - 1] + 1, target - radius); f <= Math.min(to - 1, target + radius); f++) {
        const c = info.energy[f] / (info.peak + 1e-9) + Math.abs(f - target) / (radius + 1) * .12;
        if (c < value) { value = c; best = f; }
      }
      out.push(Math.max(out[out.length - 1] + 1, Math.min(to - 1, best)));
    }
    out.push(Math.max(out[out.length - 1] + 1, to));
    return out;
  }
  // Límits de síl·laba pels nuclis vocàlics: cada pic de l'energia sonora és una vocal i el tall cau a la
  // vall que el separa del següent (on hi ha la consonant). Si la lletra té més síl·labes que no pas
  // vocals pronunciades (sinalefes: «que‿arribi»), es parteix el nucli més llarg; si en té menys, es
  // fonen els dos pics més enganxats.
  function nucleusFrames(info, [from, to], syllables) {
    const length = to - from;
    if (length < syllables * 2) return syllableFrames(info, [from, to], syllables);
    const env = new Float32Array(length);
    let top = 0;
    for (let i = 0; i < length; i++) {
      let sum = 0, n = 0;
      for (let f = Math.max(from, from + i - 3); f <= Math.min(to - 1, from + i + 3); f++) { sum += info.f0[f] ? info.energy[f] : info.energy[f] * .15; n++; }
      env[i] = sum / n; if (env[i] > top) top = env[i];
    }
    let peaks = [];
    for (let i = 0; i < length; i++) {
      if (env[i] < top * .1) continue;
      let isPeak = true;
      for (let j = Math.max(0, i - 4); j <= Math.min(length - 1, i + 4) && isPeak; j++) if (env[j] > env[i] || (env[j] === env[i] && j < i)) isPeak = false;
      if (isPeak) peaks.push(i);
    }
    if (!peaks.length) return syllableFrames(info, [from, to], syllables);
    const valley = (a, b) => { let at = a, low = Infinity; for (let i = a; i <= b; i++) if (env[i] < low) { low = env[i]; at = i; } return at; };
    // Dos pics sense una vall clara entremig són la mateixa vocal.
    const depth = k => { const v = env[valley(peaks[k], peaks[k + 1])]; return 1 - v / Math.min(env[peaks[k]], env[peaks[k + 1]]); };
    const merge = k => peaks.splice(env[peaks[k]] >= env[peaks[k + 1]] ? k + 1 : k, 1);
    for (let k = 0; k < peaks.length - 1;) if (depth(k) < .12) merge(k); else k++;
    while (peaks.length > syllables) { let k = 0; for (let j = 1; j < peaks.length - 1; j++) if (depth(j) < depth(k)) k = j; merge(k); }
    let cuts = [0];
    for (let k = 0; k < peaks.length - 1; k++) cuts.push(valley(peaks[k], peaks[k + 1]));
    cuts.push(length);
    while (cuts.length - 1 < syllables) {
      let k = 0; for (let j = 1; j < cuts.length - 1; j++) if (cuts[j + 1] - cuts[j] > cuts[k + 1] - cuts[k]) k = j;
      if (cuts[k + 1] - cuts[k] < 2) return syllableFrames(info, [from, to], syllables);
      cuts.splice(k + 1, 0, (cuts[k] + cuts[k + 1]) >> 1);
    }
    return cuts.map(c => from + c);
  }
  // speech: parla mono a «speechRate» (per defecte, «rate»). lines: [{ notes: [{ at, dur, midi }] }] (segons).
  // state (opcional) guarda l'octava triada perquè totes les seccions d'una cançó cantin a la mateixa.
  function renderPCM(speech, lines, frames, rate, options = {}) {
    if (!(speech instanceof Float32Array) || !Array.isArray(lines) ||
      !Number.isInteger(frames) || frames < 0 || !Number.isFinite(rate)) throw new Error('Partitura de cant no vàlida');
    const sr = options.speechRate || rate, state = options.state || {};
    const sung = lines.filter(l => l.notes?.length);
    if (!sung.length || speech.length < 256 || !frames) return new Float32Array(frames);
    const info = analyseSpeech(speech, sr), hop = info.hop;
    const length = Math.ceil(frames * sr / rate), out = new Float32Array(length);
    // Una sola octava per a tota la cançó: la que deixa la melodia més a prop del to natural de la veu.
    const hzOf = midi => 440 * 2 ** ((midi - 69) / 12);
    if (state.octave === undefined) {
      const targets = sung.flatMap(l => l.notes.map(n => hzOf(n.midi))).sort((a, b) => a - b);
      state.octave = info.median ? Math.round(Math.log2(info.median * 1.12 / targets[targets.length >> 1])) : 0;
    }
    const shift = 2 ** state.octave;
    const spans = splitSpeech(info, sung.length, sung.map(l => l.notes.length));
    let seed = 12345; const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const nearest = pos => { let a = 0, b = info.marks.length - 1; while (a < b) { const m = (a + b) >> 1; if (info.marks[m] < pos) a = m + 1; else b = m; }
      return a && pos - info.marks[a - 1] < info.marks[a] - pos ? a - 1 : a; };
    sung.forEach((line, li) => {
      const notes = line.notes, bounds = (options.uniform ? syllableFrames : nucleusFrames)(info, spans[li], notes.length);
      // Trossos consecutius: cada síl·laba dura fins a la nota següent si hi és enganxada (legato).
      const pieces = notes.map((note, i) => {
        const o0 = note.at * sr, next = notes[i + 1];
        const o1 = next && next.at - (note.at + note.dur) < .09 ? next.at * sr : (note.at + note.dur) * sr;
        const fa = bounds[i], fb = bounds[i + 1];
        // Les consonants conserven la durada que tenen en parlar; el que sobra o falta de la nota ho
        // absorbeixen les vocals (trames sonores i fortes), que es poden allargar tant com calgui i
        // escurçar fins a un terç. Només si ni així hi cap, s'escurça tot per igual.
        const cum = new Float32Array(fb - fa + 1), elastic = new Float32Array(fb - fa);
        let top = 1e-9, give = 0;
        for (let f = fa; f < fb; f++) if (info.f0[f] && info.energy[f] > top) top = info.energy[f];
        for (let f = fa; f < fb; f++) { elastic[f - fa] = info.f0[f] ? (info.energy[f] / top) ** 2 : 0; give += elastic[f - fa]; }
        const lambda = give > 1e-6 ? Math.max(-.67, ((o1 - o0) / hop - (fb - fa)) / give) : 0;
        for (let f = fa; f < fb; f++) cum[f - fa + 1] = cum[f - fa] + 1 + lambda * elastic[f - fa];
        return { o0, o1, fa, fb, cum, hz: hzOf(note.midi) * shift, start: note.at, dur: note.dur };
      });
      let t = pieces[0].o0, p = 0, cursor = 0, lastNoise = -1;
      while (p < pieces.length && t < length) {
        let piece = pieces[p];
        if (t >= piece.o1) { p++; cursor = 0; if (p < pieces.length && t < pieces[p].o0) t = pieces[p].o0; continue; }
        // Posició a la parla que correspon a aquest instant.
        const want = (t - piece.o0) / (piece.o1 - piece.o0) * piece.cum[piece.cum.length - 1];
        while (cursor < piece.cum.length - 2 && piece.cum[cursor + 1] < want) cursor++;
        const span = piece.cum[cursor + 1] - piece.cum[cursor];
        const src = (piece.fa + cursor + (span ? (want - piece.cum[cursor]) / span : 0)) * hop;
        let m = nearest(src);
        const isVoiced = info.voiced[m];
        let sign = 1;
        if (!isVoiced && m <= lastNoise) {
          // Soroll estirat (s, f, x…): en repetir un gra es barreja amb els veïns perquè no brunzeixi.
          // Sense estirament els grans es copien tal qual, i les oclusives (p, t, k) queden intactes.
          const other = m + Math.floor(random() * 3) - 1;
          if (other >= 0 && other < info.marks.length && !info.voiced[other]) m = other;
          if (random() < .5) sign = -1;
        } else if (!isVoiced) lastNoise = m;
        const half = Math.max(8, Math.round(info.periods[m])), centre = info.marks[m], to = Math.round(t);
        // To de la nota, amb un lliscament curt des de la nota anterior i un vibrato suau a les notes llargues.
        let hz = piece.hz; const into = t / sr - piece.start;
        if (p && into < .04 && pieces[p - 1].o1 >= piece.o0 - 1) hz = pieces[p - 1].hz * (piece.hz / pieces[p - 1].hz) ** (into / .04);
        if (piece.dur > .4 && into > .18) hz *= 2 ** (Math.min(1, (into - .18) / .25) * .018 * Math.sin(2 * Math.PI * 5.4 * into));
        const step = isVoiced ? sr / hz : info.periods[m];
        const gain = sign * (isVoiced ? Math.min(1.6, Math.sqrt(step / info.periods[m])) : 1);
        for (let i = -half; i <= half; i++) {
          const a = centre + i, b = to + i;
          if (a < 0 || a >= speech.length || b < 0 || b >= length) continue;
          out[b] += speech[a] * (.5 + .5 * Math.cos(Math.PI * i / half)) * gain;
        }
        t += Math.max(16, step);
      }
      // Entrades i sortides suaus als silencis (no dins del legato).
      const fade = Math.round(sr * .008);
      pieces.forEach((piece, i) => {
        const a = Math.round(piece.o0), b = Math.min(length, Math.round(piece.o1));
        const opens = !i || pieces[i - 1].o1 < piece.o0 - 1, closes = i === pieces.length - 1 || pieces[i + 1].o0 > piece.o1 + 1;
        if (opens) { for (let k = Math.max(0, a - 4 * fade); k < a; k++) out[k] = 0; for (let k = 0; k < fade && a + k < length; k++) out[a + k] *= k / fade; }
        if (closes) { for (let k = 0; k < fade && b - 1 - k >= 0; k++) out[b - 1 - k] *= k / fade; for (let k = b; k < Math.min(length, b + 4 * fade); k++) out[k] = 0; }
      });
    });
    if (sr === rate) return out;
    // De la freqüència de la parla a la de la cançó.
    const result = new Float32Array(frames), ratio = sr / rate;
    for (let i = 0; i < frames; i++) { const pos = i * ratio, k = Math.floor(pos), f = pos - k; result[i] = (out[k] || 0) * (1 - f) + (out[k + 1] || 0) * f; }
    return result;
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
    // Si Matxa falla, durant uns minuts no s'hi torna a insistir: la cua de la ràdio no s'ha d'esperar
    // a un servei caigut a cada secció.
    let brokenUntil = 0;
    const spoken = text => text.replace(/\n+/g, '. ');
    const speak = async (text, subgenre, signal) => {
      if (Date.now() < brokenUntil) throw new Error('Matxa no respon: es reprendrà d’aquí a uns minuts');
      try { return await client.speak(spoken(text), presetFor(subgenre).speaker, SPEECH_RATE, signal); }
      catch (error) { if (!signal?.aborted) brokenUntil = Date.now() + BREAK_MS; throw error; }
    };
    return {
      // Demana per endavant la parla de totes les seccions (les repetides, un sol cop) mentre es grava
      // la banda: quan toca cantar-les ja són a la memòria.
      prefetch(texts, subgenre, signal) {
        for (const text of new Set(texts)) speak(text, subgenre, signal).catch(() => {});
      },
      get available() { return Date.now() >= brokenUntil; },
      async renderSection({ text, lines, subgenre, frames, signal, song, swing }) {
        if (!lines?.length || !lines.some(l => l.notes.length)) return new Float32Array(frames);
        const preset = presetFor(subgenre);
        const pcm = await speak(text, subgenre, signal);
        if (signal?.aborted) throw aborted();
        return new Promise((resolve, reject) => {
          const id = ++serial, copy = pcm.slice();
          pending.set(id, { resolve, reject });
          try { ensureWorker().postMessage({ id, type: 'sing', pcm: copy, speechRate: SPEECH_RATE, song, lines, frames, rate, preset }, [copy.buffer]); }
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
    MatxaClient, createBrowserSinger, extractAudioUrl, scoreLines, analyseSpeech, splitSpeech, SPEECH_RATE };
});
