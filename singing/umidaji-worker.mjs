import { Unzip, UnzipInflate } from 'fflate';
import { RATE, phrasesOf, phraseInput } from './umidaji-score.mjs';

const ROOT = 'Umidaji_DS_v110/';
const EMBEDDING_SIZE = 384;
// Amb WebAssembly la CPU del navegador comparteix temps amb el reproductor.
const PITCH_STEPS = 5;
const ACOUSTIC_STEPS = 6;
const FILES = {
  acoustic: 'dsmain/acoustic.onnx', pitch: 'dspitch/files/pitch.onnx',
  linguistic: 'dspitch/files/linguistic.onnx', vocoder: 'dsvocoder/tgm_hifigan_v110.onnx'
};
const META = ['dsmain/phonemes.json', 'dsmain/languages.json'];
const SPEAKERS = ['rainbow', 'moon', 'sun', 'cloud', 'snow'];
const embedPath = speaker => 'embeds/umidaji-' + speaker + '.emb';
const pitchEmbedPath = speaker => 'dspitch/' + embedPath(speaker);
let model = null;

async function loadModel(file) {
  const names = new Set([...Object.values(FILES), ...META, ...SPEAKERS.flatMap(s => [embedPath(s), pitchEmbedPath(s)])]);
  // El ZIP (273 MiB) es llegeix a trossos i només es guarden els fitxers que calen: tenir-lo tot a la
  // memòria a més dels models descomprimits fa caure el navegador del mòbil.
  const files = {};
  await new Promise((resolve, reject) => {
    const unzip = new Unzip(entry => {
      if (!entry.name.startsWith(ROOT) || !names.has(entry.name.slice(ROOT.length))) return;
      const whole = Number.isFinite(entry.originalSize) && entry.originalSize > 0 ? new Uint8Array(entry.originalSize) : null, chunks = [];
      let at = 0;
      entry.ondata = (error, chunk, final) => {
        if (error) { reject(error); return; }
        if (whole && at + chunk.length <= whole.length) whole.set(chunk, at); else chunks.push(chunk.slice());
        at += chunk.length;
        if (!final) return;
        if (whole && !chunks.length) files[entry.name] = at === whole.length ? whole : whole.subarray(0, at);
        else { const all = new Uint8Array(at); let o = 0; if (whole) { all.set(whole.subarray(0, Math.min(at, whole.length))); o = Math.min(at, whole.length); } for (const c of chunks) { all.set(c, o); o += c.length; } files[entry.name] = all; }
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    (async () => {
      const reader = file.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { unzip.push(new Uint8Array(0), true); break; }
        unzip.push(value, false);
      }
    })().then(resolve, reject);
  });
  for (const name of names) if (!files[ROOT + name]) throw new Error('Cal el ZIP oficial d’Umidaji DS v110.');
  const json = name => JSON.parse(new TextDecoder().decode(files[ROOT + name]));
  const tokens = json(META[0]), languages = json(META[1]);
  const readEmbedding = name => {
    const bytes = files[ROOT + name];
    if (bytes.length !== EMBEDDING_SIZE * 4) throw new Error('El timbre del ZIP no és compatible amb Umidaji v110.');
    return new Float32Array(bytes.buffer, bytes.byteOffset, EMBEDDING_SIZE).slice();
  };
  const speakers = Object.fromEntries(SPEAKERS.map(s => [s, { acoustic: readEmbedding(embedPath(s)), pitch: readEmbedding(pitchEmbedPath(s)) }]));
  const ort = self.ort;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, self.navigator.hardwareConcurrency || 1) : 1;
  ort.env.wasm.wasmPaths = new URL('vendor/ort/', self.location.href).href;
  const sessions = {};
  try {
    for (const [name, path] of Object.entries(FILES)) {
      sessions[name] = await ort.InferenceSession.create(files[ROOT + path], { executionProviders: ['wasm'] });
      delete files[ROOT + path];
    }
    return { ort, sessions, tokens, language: languages.pt, speakers };
  } catch (error) {
    await Promise.allSettled(Object.values(sessions).map(session => session.release()));
    throw error;
  }
}

async function singPhrase(notes, voice, timbre, shift) {
  const { ort, sessions, tokens, language } = voice;
  const input = phraseInput(notes, shift), { frames } = input;
  const i64 = values => new ort.Tensor('int64', BigInt64Array.from(values, x => BigInt(x)), [1, values.length]);
  const f32 = values => new ort.Tensor('float32', Float32Array.from(values), [1, values.length]);
  const bool = values => new ort.Tensor('bool', Uint8Array.from(values), [1, values.length]);
  const scalar = n => new ort.Tensor('int64', BigInt64Array.of(BigInt(n)), []);
  const constant = x => new Float32Array(frames).fill(x);
  const embed = embedding => {
    const data = new Float32Array(frames * EMBEDDING_SIZE);
    for (let i = 0; i < frames; i++) data.set(embedding, i * EMBEDDING_SIZE);
    return new ort.Tensor('float32', data, [1, frames, EMBEDDING_SIZE]);
  };
  const ids = input.phones.map(phone => {
    const id = tokens['pt/' + phone] ?? tokens[phone];
    if (id === undefined) throw new Error('Umidaji no té el fonema ' + phone);
    return id;
  });
  const tokenTensor = i64(ids);
  const languageTensor = i64(input.phones.map(p => p === 'SP' || p === 'AP' ? 0 : language));
  const durations = i64(input.durations);
  const { encoder_out } = await sessions.linguistic.run({ tokens: tokenTensor, languages: languageTensor, ph_dur: durations });
  const { pitch_pred } = await sessions.pitch.run({
    encoder_out, ph_dur: durations, note_midi: f32(input.notesMidi), note_rest: bool(input.notesRest),
    note_dur: i64(input.notesDuration), pitch: f32(input.pitch), expr: f32(constant(1)),
    retake: bool(constant(1)), spk_embed: embed(timbre.pitch), steps: scalar(PITCH_STEPS)
  });
  const f0 = f32(pitch_pred.data.map(p => 440 * 2 ** ((p - 69) / 12)));
  const { mel } = await sessions.acoustic.run({
    tokens: tokenTensor, languages: languageTensor, durations, f0, gender: f32(constant(timbre.gender)),
    velocity: f32(constant(timbre.velocity)), spk_embed: embed(timbre.acoustic), steps: scalar(ACOUSTIC_STEPS)
  });
  const { waveform } = await sessions.vocoder.run({ mel, f0 });
  return { wave: waveform.data, start: input.start };
}

// Timbre d'una cançó: barreja dels cinc timbres del banc (per exemple { moon: .7, snow: .3 }), caràcter de la
// veu (gender: −1 a 1), articulació (velocity: 1 és la normal) i nota central del registre (center, MIDI).
function timbreOf(voice = {}) {
  const mix = Object.entries(voice.mix || { rainbow: 1 }).filter(([name, w]) => model.speakers[name] && w > 0);
  if (!mix.length) mix.push(['rainbow', 1]);
  const total = mix.reduce((sum, [, w]) => sum + w, 0);
  const blend = kind => {
    const out = new Float32Array(EMBEDDING_SIZE);
    for (const [name, w] of mix) { const e = model.speakers[name][kind]; for (let i = 0; i < out.length; i++) out[i] += e[i] * w / total; }
    return out;
  };
  const clamp = (x, lo, hi, fallback) => Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
  return { acoustic: blend('acoustic'), pitch: blend('pitch'), gender: clamp(voice.gender, -1, 1, 0), velocity: clamp(voice.velocity, .5, 2, 1), center: clamp(voice.center, 48, 76, 64) };
}

async function synthesize(notes, voice, onProgress) {
  if (!model) throw new Error('Carrega el ZIP d’Umidaji per generar la veu.');
  const timbre = timbreOf(voice);
  const pitches = notes.map(n => n.midi).sort((a, b) => a - b);
  const middle = pitches.length >> 1;
  const median = pitches.length % 2 ? pitches[middle] : (pitches[middle - 1] + pitches[middle]) / 2;
  const shift = 12 * Math.floor((timbre.center - median) / 12 + .5);
  const pcm = new Float32Array(Math.ceil((notes.at(-1).t + notes.at(-1).d + .5) * RATE));
  const rendered = new Map();
  const phrases = phrasesOf(notes);
  for (const [index, phrase] of phrases.entries()) {
    const first = phrase[0].t;
    const relative = phrase.map(note => ({ ...note, t: note.t - first }));
    // Mateixa lletra, notes i ritme en una tornada: es pot reutilitzar exactament la presa.
    const key = JSON.stringify(relative.map(n => [n.word, n.syllable, n.midi, Math.round(n.t * RATE), Math.round(n.d * RATE)]));
    let take = rendered.get(key);
    if (!take) {
      take = await singPhrase(relative, model, timbre, shift);
      rendered.set(key, take);
    }
    const { wave, start } = take;
    const offset = Math.round((first + start) * RATE), fade = Math.min(256, wave.length >> 2);
    for (let i = Math.max(0, -offset); i < wave.length && offset + i < pcm.length; i++) {
      pcm[offset + i] += wave[i] * Math.min(1, i / fade, (wave.length - 1 - i) / fade);
    }
    onProgress((index + 1) / phrases.length);
  }
  if (pcm.some(x => !Number.isFinite(x)) || !pcm.some(x => Math.abs(x) > .001)) {
    throw new Error('Umidaji ha retornat una pista de veu buida o no vàlida.');
  }
  return pcm;
}

let tail = Promise.resolve();
self.onmessage = ({ data }) => {
  tail = tail.then(async () => {
    const { id, type, file, notes, voice } = data;
    try {
      if (type === 'load') {
        if (!model) {
          const runtime = new URL('vendor/ort/ort.wasm.min.js', self.location.href);
          self.importScripts(runtime.href);
          model = await loadModel(file);
        }
        self.postMessage({ id });
      } else if (type === 'sing') {
        const pcm = await synthesize(notes, voice, progress => self.postMessage({ id, progress }));
        self.postMessage({ id, pcm }, [pcm.buffer]);
      }
    } catch (error) {
      self.postMessage({ id, error: String(error.message || error) });
    }
  });
};
