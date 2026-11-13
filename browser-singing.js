(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SkaBrowserSinging = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Veu cantada al navegador amb el mateix procés que l'acció de GitHub (matxa-singer.js i WORLD en
  // WebAssembly, en un Web Worker). La parla de Matxa prové del seu servei públic de Gradio (no és local).
  const BASE = 'https://projecte-aina-matxa-alvocat-tts-ca.hf.space';
  const ACCENTS = { elia: 'central', grau: 'central', emma: 'nord-occidental',
    pere: 'nord-occidental', gina: 'valencia', lluc: 'valencia',
    olga: 'balear', quim: 'balear' };
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
  const SPEECH_RATE = 22050, REQUEST_TIMEOUT = 45000, BREAK_MS = 180000, SPEECH = { lengthScale: 1.1, temperature: .2 };
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
        if (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value);
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
        // Mateixos paràmetres que l'acció: temperatura 0,2 i escala de durada 1,1 (síl·labes més clares).
        const result = await gradio(0, [text, ACCENTS[speaker], speaker, SPEECH.temperature, SPEECH.lengthScale], session, controller.signal);
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
  // Notes de veu d'una cançó, com les exporta singing/export.cjs: una per síl·laba, amb el temps en segons
  // des del començament de la cançó, la unitat cantada (paraula o paraules foses per sinalefa) i l'inici de vers.
  // sections: [{ at (s), bpm, text, melody: [[compàs, temps, midi, durada]], type }]
  function scoreNotes(sections, lyricWords, swing = 0) {
    const notes = [];
    for (const { at, bpm, text, melody, type } of sections) {
      const beat = 60 / bpm, swung = beats => Math.abs(beats % 1 - .5) < .04 ? beats + swing / 6 : beats;
      const sorted = melody.slice().sort((a, b) => a[0] * 4 + a[1] - (b[0] * 4 + b[1]));
      const words = String(text || '').split('\n').map(l => l.trim()).filter(Boolean)
        .flatMap((line, li) => lyricWords(line, 'ca').map((w, wi) => ({ word: w.word.replace(/’/g, "'"), line: li, first: wi === 0, count: Math.max(1, w.count) })));
      let n = 0;
      for (const w of words) for (let s = 0; s < w.count && n < sorted.length; s++, n++) {
        const [bar, b, pitch, dur] = sorted[n], start = swing ? swung(bar * 4 + b) : bar * 4 + b;
        notes.push({ t: at + start * beat, d: dur * beat, midi: pitch, word: w.word.toLowerCase(), syllable: s, syllables: w.count, line: w.line, lineStart: w.first && s === 0, section: type });
      }
    }
    return notes;
  }

  // Cantant del navegador. Per a cada cançó:
  //   const job = singer.start({ notes, subgenre, signal });   // demana la parla de cada vers i l'analitza
  //   … es grava la banda …
  //   const mix = await singer.finish(job, band);              // canta, mescla i retorna [L, R]
  function createBrowserSinger(options = {}) {
    const client = options.client || new MatxaClient();
    const base = typeof document !== 'undefined' ? (document.currentScript?.src || document.baseURI) : '';
    const makeWorker = options.makeWorker || (() => new Worker(new URL('matxa-worker.js', base)));
    let worker = null, serial = 0, brokenUntil = 0;
    const pending = new Map();
    function ensureWorker() {
      if (worker) return worker;
      worker = makeWorker();
      worker.onmessage = ({ data }) => {
        const p = pending.get(data.id);
        if (!p) return;
        pending.delete(data.id);
        if (data.error && !data.band) p.reject(new Error(data.error)); else p.resolve(data);
      };
      worker.onerror = event => {
        for (const p of pending.values()) p.reject(new Error('El motor de veu del navegador ha fallat' + (event?.message ? ': ' + event.message : '')));
        pending.clear(); worker?.terminate(); worker = null;
      };
      return worker;
    }
    const call = (message, transfer = []) => new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      try { ensureWorker().postMessage({ ...message, id }, transfer); } catch (error) { pending.delete(id); reject(error); }
    });
    return {
      get available() { return Date.now() >= brokenUntil; },
      start({ notes, subgenre, signal }) {
        const timbre = window.SkaMatxaSinger.timbreFor(subgenre), speaker = timbre.speaker;
        const phrases = window.SkaMatxaSinger.phrasesOf(notes), song = ++serial;
        // Una locució per vers diferent (la tornada es demana un sol cop); s'analitza en arribar.
        const units = new Map();
        for (const phrase of phrases) {
          const text = window.SkaMatxaSinger.spokenText(phrase), key = text + '|' + phrase.length;
          if (units.has(key)) continue;
          units.set(key, client.speak(text, speaker, SPEECH_RATE, signal).then(pcm => {
            if (signal?.aborted) throw aborted();
            const copy = pcm.slice();
            return call({ type: 'analyse', song, key, speech: copy, rate: SPEECH_RATE, count: phrase.length }, [copy.buffer]);
          }));
        }
        const ready = Promise.all(units.values()).catch(error => {
          if (!signal?.aborted) brokenUntil = Date.now() + BREAK_MS;
          call({ type: 'forget', song }).catch(() => {});
          throw error;
        });
        ready.catch(() => {});
        return { song, notes, subgenre, speaker, timbre, ready };
      },
      // La banda es passa al worker sense copiar-la (són desenes de MB): si el cant falla, el worker la
      // retorna intacta a «error.band» perquè la ràdio hi pugui posar la guia.
      async finish(job, band) {
        await job.ready;
        const id = ++serial;
        return new Promise((resolve, reject) => {
          const fail = data => { const error = new Error(data.error); error.band = data.band; reject(error); };
          pending.set(id, { resolve: data => data.error ? fail(data) : resolve(data.mix), reject });
          try { ensureWorker().postMessage({ type: 'sing', id, song: job.song, notes: job.notes, subgenre: job.subgenre, speaker: job.speaker, band }, band.map(c => c.buffer)); }
          catch (error) { pending.delete(id); error.band = band; reject(error); }
        });
      },
      dispose() {
        worker?.terminate(); worker = null;
        for (const p of pending.values()) p.reject(aborted());
        pending.clear();
      }
    };
  }

  return { ACCENTS, MatxaClient, createBrowserSinger, extractAudioUrl, scoreNotes, SPEECH_RATE };
});
