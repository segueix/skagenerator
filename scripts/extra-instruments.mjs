// Banc addicional de bateries i baixos gravats (tot CC0). Es publica en un fitxer
// a part (assets/extra-instruments.sf2) i la web només el baixa quan una cançó
// fa servir algun d'aquests sons: el banc principal no creix.
// - Big Rusty Drums (Karoryfer): bombo de 24" i toms grans, so greu i rodó.
// - Virtuosity Drums: kit de club de jazz (micròfons propers + sala) i el seu micròfon lo-fi.
// - Growlybass (Karoryfer): Squier Jazz Bass amb dits, directe.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BasicInstrument, BasicPreset, BasicSoundBank, GeneratorTypes, SpessaLog } from 'spessasynth_core';
import ROUND_ROBIN from '../round-robin.json' with { type: 'json' };
import { download, loadBank, makeSample, readWav, resample, timecents, trim } from './real-instruments.mjs';

const CACHE = '.cache/real', RATE = 32000;
const sha = data => createHash('sha256').update(data).digest('hex');
let flac;
async function decode(path) {
  const data = await readFile(path);
  if (!path.toLowerCase().endsWith('.flac')) return readWav(data);
  if (!flac) { const { FLACDecoder } = await import('@wasm-audio-decoders/flac'); flac = new FLACDecoder(); await flac.ready; }
  await flac.reset();
  const { channelData, sampleRate } = await flac.decodeFile(new Uint8Array(data));
  const mono = new Float32Array(channelData[0].length);
  for (const channel of channelData) for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channelData.length;
  return { data: mono, rate: sampleRate };
}
const url = (base, file) => base + file.split('/').map(encodeURIComponent).join('/');
async function load(base, file, rate) {
  const wav = await decode(await download(url(base, file)));
  return resample(wav.data, wav.rate, rate);
}

// Sonoritat de referència de cada peça (dB RMS en finestres de 400 ms de la capa
// més forta), mesurada al kit Muldjord: així tots els kits sonen equilibrats i es poden intercanviar.
const TARGET = { 35: -20.9, 36: -20.9, 37: -24.7, 38: -20.8, 40: -20.9, 41: -19.7, 42: -31.7, 43: -19.7, 44: -31.7, 45: -20.3, 46: -23.1, 47: -20.3,
  48: -20.4, 49: -23.6, 50: -22, 51: -26.8, 52: -24.5, 53: -21.5, 55: -24.5, 57: -21.8, 59: -26.2 };
function loudness(data, rate, window = .03) {
  const size = Math.min(data.length, Math.round(rate * window)); let best = 0;
  for (let start = 0; start + size <= data.length; start += size >> 1) { let sum = 0; for (let i = start; i < start + size; i++) sum += data[i] * data[i]; best = Math.max(best, sum / size); }
  return Math.sqrt(best);
}
// Porta una mostra a la sonoritat indicada. Si el pic passa de 0,8, l'atac es
// limita suaument (com un compressor de bateria), amb un màxim de 4 dB de limitació.
function louden(a, targetDb, rate, window = .03) {
  const now = loudness(a, rate, window); if (!now) return;
  let peak = 0; for (const x of a) peak = Math.max(peak, Math.abs(x));
  const gain = Math.min(10 ** (targetDb / 20) / now, 1.58 * .95 / peak);
  for (let i = 0; i < a.length; i++) { const y = a[i] * gain; a[i] = Math.abs(y) > .8 ? Math.sign(y) * (.8 + .18 * Math.tanh((Math.abs(y) - .8) / .18)) : y; }
}
// Una bateria: cada cop barreja els micròfons indicats (amb el seu guany) i es
// reparteix en capes de força. Cada peça s'iguala a la sonoritat de referència
// amb el mateix guany per a totes les seves capes (conserva la dinàmica); si el
// cop sobrepassa el límit, l'atac es limita suaument (com un compressor de bateria).
// Les gravacions alternades (round-robin.json) són peces més, a les tecles lliures
// 88-103, igualades a la sonoritat de la peça original.
export function withAlternates(pieces) {
  const all = { ...pieces };
  for (const [gm, piece] of Object.entries(pieces)) if (piece.rr) piece.rr.forEach((layers, k) => {
    all[ROUND_ROBIN.keys[gm][k]] = { seconds: piece.seconds, ...(piece.choke ? { choke: piece.choke } : {}), layers, of: gm };
  });
  return all;
}
async function buildKit(bank, kit, log) {
  const cache = new Map(), done = new Set(), pieces = withAlternates(kit.pieces);
  for (const [gm, piece] of Object.entries(pieces)) {
    // Les tecles que comparteixen gravacions (p. ex. 35 i 36) es processen un sol cop.
    const group = JSON.stringify(piece.layers) + piece.seconds;
    if (done.has(group)) continue;
    done.add(group);
    const audio = [];
    for (const layer of piece.layers) {
      const id = JSON.stringify(layer) + piece.seconds;
      const parts = [];
      for (const [file, gain] of layer) parts.push([await load(kit.base, file, RATE), gain]);
      const length = Math.max(...parts.map(([a]) => a.length)), data = new Float32Array(length);
      for (const [a, gain] of parts) for (let i = 0; i < a.length; i++) data[i] += a[i] * gain;
      const out = trim(data, RATE, piece.seconds);
      cache.set(id, out); audio.push(out);
    }
    // La capa més forta a la sonoritat de referència i cada capa inferior 3,5 dB per
    // sota: el timbre canvia amb la força, però sense els salts de 20 dB de la gravació.
    audio.forEach((a, i) => louden(a, (TARGET[piece.of ?? gm] ?? -18) - (audio.length - 1 - i) * 3.5, RATE, .4));
  }
  const instrument = new BasicInstrument(); instrument.name = kit.name.slice(0, 19);
  const made = new Map();
  for (const [gm, piece] of Object.entries(pieces)) {
    const n = piece.layers.length;
    piece.layers.forEach((layer, li) => {
      const id = JSON.stringify(layer) + piece.seconds;
      if (!made.has(id)) made.set(id, makeSample(bank, `K${kit.program}${gm}v${li}`, cache.get(id), RATE, Number(gm)));
      const zone = instrument.createZone(made.get(id));
      zone.keyRange = { min: Number(gm), max: Number(gm) };
      zone.velRange = { min: Math.round(li * 128 / n), max: Math.round((li + 1) * 128 / n) - 1 };
      zone.setGenerator(GeneratorTypes.overridingRootKey, Number(gm));
      zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(Math.max(1, piece.seconds)));
      if (piece.choke) zone.setGenerator(GeneratorTypes.exclusiveClass, piece.choke);
    });
  }
  bank.addInstruments(instrument);
  const preset = new BasicPreset(bank); preset.name = kit.name.slice(0, 19); preset.program = kit.program; preset.bankMSB = 0; preset.isGMGSDrum = true;
  preset.createZone(instrument); bank.addPresets(preset);
  log(`${kit.name}: ${made.size} mostres, ${Object.keys(kit.pieces).length} cops i ${Object.keys(pieces).length - Object.keys(kit.pieces).length} alternatives`);
}

// Un baix: notes gravades amb dues dinàmiques, igualades nota a nota.
async function buildBass(bank, spec, log) {
  const instrument = new BasicInstrument(); instrument.name = spec.name.slice(0, 19);
  const [loud, soft] = spec.levelDb;
  let count = 0;
  spec.notes.forEach((note, ni) => {
    const keyMin = ni === 0 ? 0 : Math.floor((spec.notes[ni - 1].key + note.key) / 2) + 1;
    const keyMax = ni === spec.notes.length - 1 ? 127 : Math.floor((note.key + spec.notes[ni + 1].key) / 2);
    note.audio.forEach((data, li) => {
      louden(data, li === note.audio.length - 1 ? loud : soft, spec.rate);
      const zone = instrument.createZone(makeSample(bank, `B${spec.bank}${spec.program}${note.key}v${li}`, data, spec.rate, note.key));
      const n = note.audio.length;
      zone.keyRange = { min: keyMin, max: keyMax }; zone.velRange = { min: Math.round(li * 128 / n), max: Math.round((li + 1) * 128 / n) - 1 };
      zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(spec.release));
      count++;
    });
  });
  bank.addInstruments(instrument);
  const preset = new BasicPreset(bank); preset.name = spec.name.slice(0, 19); preset.program = spec.program; preset.bankMSB = spec.bank;
  preset.createZone(instrument); bank.addPresets(preset);
  log(`${spec.name}: ${count} mostres`);
}

export async function buildExtraInstruments(config, log = console.log) {
  SpessaLog.setLogLevel(false, false, false);
  await mkdir(CACHE, { recursive: true });
  const fingerprint = sha(JSON.stringify(config) + JSON.stringify(ROUND_ROBIN) + await readFile(new URL(import.meta.url)));
  const cached = join(CACHE, `extra-${fingerprint.slice(0, 16)}.sf2`);
  try { return new Uint8Array(await readFile(cached)); } catch { /* Es construeix. */ }
  const bank = new BasicSoundBank();
  bank.soundBankInfo.name = 'Ska Generator extra drums and basses';
  for (const kit of config.kits) await buildKit(bank, kit, log);
  for (const spec of config.basses) {
    for (const note of spec.notes) {
      note.audio = [];
      for (const file of note.layers) note.audio.push(trim(await load(spec.base, file, spec.rate), spec.rate, spec.maxSeconds));
    }
    await buildBass(bank, spec, log);
    for (const note of spec.notes) delete note.audio;
  }
  flac?.free(); flac = null;
  const binary = new Uint8Array(bank.writeSF2());
  await writeFile(cached, binary);
  return binary;
}
export { loadBank };
