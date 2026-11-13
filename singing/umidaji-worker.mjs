import { unzipSync } from 'fflate';
import { RATE, phrasesOf, phraseInput } from './umidaji-score.mjs';

const ROOT = 'Umidaji_DS_v110/';
const EMBEDDING_SIZE = 384;
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(bytes, { filter: entry => entry.name.startsWith(ROOT) && names.has(entry.name.slice(ROOT.length)) });
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

async function singPhrase(notes, voice, speaker, shift) {
  const { ort, sessions, tokens, language, speakers } = voice;
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
    retake: bool(constant(1)), spk_embed: embed(speakers[speaker].pitch), steps: scalar(10)
  });
  const f0 = f32(pitch_pred.data.map(p => 440 * 2 ** ((p - 69) / 12)));
  const { mel } = await sessions.acoustic.run({
    tokens: tokenTensor, languages: languageTensor, durations, f0, gender: f32(constant(0)),
    velocity: f32(constant(1)), spk_embed: embed(speakers[speaker].acoustic), steps: scalar(20)
  });
  const { waveform } = await sessions.vocoder.run({ mel, f0 });
  return { wave: waveform.data, start: input.start };
}

async function synthesize(notes, speaker) {
  if (!model) throw new Error('Carrega el ZIP d’Umidaji per generar la veu.');
  const pitches = notes.map(n => n.midi).sort((a, b) => a - b);
  const middle = pitches.length >> 1;
  const median = pitches.length % 2 ? pitches[middle] : (pitches[middle - 1] + pitches[middle]) / 2;
  const shift = 12 * Math.floor((64 - median) / 12 + .5);
  const pcm = new Float32Array(Math.ceil((notes.at(-1).t + notes.at(-1).d + .5) * RATE));
  for (const phrase of phrasesOf(notes)) {
    const { wave, start } = await singPhrase(phrase, model, speaker, shift);
    const offset = Math.round(start * RATE), fade = Math.min(256, wave.length >> 2);
    for (let i = Math.max(0, -offset); i < wave.length && offset + i < pcm.length; i++) {
      pcm[offset + i] += wave[i] * Math.min(1, i / fade, (wave.length - 1 - i) / fade);
    }
  }
  if (pcm.some(x => !Number.isFinite(x)) || !pcm.some(x => Math.abs(x) > .001)) {
    throw new Error('Umidaji ha retornat una pista de veu buida o no vàlida.');
  }
  return pcm;
}

let tail = Promise.resolve();
self.onmessage = ({ data }) => {
  tail = tail.then(async () => {
    const { id, type, file, notes, speaker } = data;
    try {
      if (type === 'load') {
        if (!model) {
          const runtime = new URL('vendor/ort/ort.wasm.min.js', self.location.href);
          self.importScripts(runtime.href);
          model = await loadModel(file);
        }
        self.postMessage({ id });
      } else if (type === 'sing') {
        const pcm = await synthesize(notes, speaker);
        self.postMessage({ id, pcm }, [pcm.buffer]);
      }
    } catch (error) {
      self.postMessage({ id, error: String(error.message || error) });
    }
  });
};
