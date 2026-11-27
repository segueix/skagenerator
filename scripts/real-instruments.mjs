// Construeix un banc SF2 amb instruments gravats nota a nota:
// - VSCO 2 CE (CC0): trompeta i trombó, sostinguts i staccato, a partir dels WAV (i el piano vertical del banc addicional).
// - FreePats (CC0): baixos, guitarra neta, saxo tenor i orgue, a partir dels seus SF2.
// - Muldjord Kit (CC-BY 4.0): un kit GM nou amb quatre capes de força per cop.
// - Orgue de rodes fòniques: sintetitzat aquí mateix (additiu), sense mostres externes.
// Tot es remostreja a 32 kHz en mono i es retalla perquè la web pesi poc.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import ROUND_ROBIN from '../round-robin.json' with { type: 'json' };
import {
  BasicInstrument, BasicPreset, BasicSoundBank, EmptySample, GeneratorTypes, SampleTypes, SoundBankLoader, SpessaLog
} from 'spessasynth_core';

const CACHE = '.cache/real', RATE = 32000;
const sha = data => createHash('sha256').update(data).digest('hex');

export async function download(url, expected) {
  const file = join(CACHE, decodeURIComponent(url.split('/').pop()).replace(/[^\w.#+-]/g, '_'));
  try { const data = await readFile(file); if (!expected || sha(data) === expected) return file; } catch { /* Es descarrega. */ }
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (expected && sha(data) !== expected) throw new Error('la verificació SHA-256 ha fallat');
      await writeFile(file, data);
      return file;
    } catch (error) {
      if (attempt >= 3) throw new Error(`No s’ha pogut obtenir ${url}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}
async function extractSf2(archive) {
  const target = `${archive}.d`;
  await mkdir(target, { recursive: true });
  if (archive.endsWith('.7z')) {
    const { path7za } = (await import('7zip-bin')).default;
    await chmod(path7za, 0o755).catch(() => {});
    execFileSync(path7za, ['x', '-y', `-o${target}`, archive], { stdio: 'ignore' });
  } else execFileSync('tar', ['-xf', archive, '-C', target]);
  const find = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { const found = await find(path); if (found) return found; }
      else if (entry.name.toLowerCase().endsWith('.sf2')) return path;
    }
    return null;
  };
  const file = await find(target);
  if (!file) throw new Error(`${archive} no conté cap SF2`);
  return file;
}
export const loadBank = data => SoundBankLoader.fromArrayBuffer(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

// ── Àudio ────────────────────────────────────────────────────────────
export function readWav(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('WAV no vàlid');
  let offset = 12, format, channels, rate, bits, body, bodyLength;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4), size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(offset + 8, true); channels = view.getUint16(offset + 10, true);
      rate = view.getUint32(offset + 12, true); bits = view.getUint16(offset + 22, true);
      if (format === 0xFFFE) format = view.getUint16(offset + 32, true);
    } else if (id === 'data') { body = offset + 8; bodyLength = Math.min(size, data.length - body); }
    offset += 8 + size + (size & 1);
  }
  if (!body || !channels) throw new Error('WAV sense dades');
  const bytes = bits / 8, frames = Math.floor(bodyLength / (bytes * channels)), mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = body + (i * channels + c) * bytes;
      sum += format === 3 ? (bits === 64 ? view.getFloat64(at, true) : view.getFloat32(at, true))
        : bits === 16 ? view.getInt16(at, true) / 32768
        : bits === 24 ? ((view.getUint8(at) | view.getUint8(at + 1) << 8 | view.getInt8(at + 2) << 16) / 8388608)
        : bits === 32 ? view.getInt32(at, true) / 2147483648 : (view.getUint8(at) - 128) / 128;
    }
    mono[i] = sum / channels;
  }
  return { data: mono, rate };
}
// Remostreig amb sinc enfinestrat (Lanczos, 16 punts): sense aliasing audible.
export function resample(input, from, to) {
  if (from === to) return input.slice();
  const ratio = from / to, length = Math.floor(input.length / ratio), output = new Float32Array(length);
  const cutoff = Math.min(1, to / from), a = 8;
  for (let i = 0; i < length; i++) {
    const center = i * ratio, first = Math.floor(center) - a + 1;
    let sum = 0, weight = 0;
    for (let k = first; k <= Math.floor(center) + a; k++) {
      if (k < 0 || k >= input.length) continue;
      const x = (center - k) * cutoff, sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const window = Math.abs(center - k) < a ? (x === 0 ? 1 : Math.sin(Math.PI * (center - k) / a) / (Math.PI * (center - k) / a)) : 0;
      const w = sinc * window; sum += input[k] * w; weight += w;
    }
    output[i] = weight ? sum / weight : 0;
  }
  return output;
}
// Treu el silenci inicial i retalla la cua amb una baixada suau.
// Atac immediat: algunes gravacions (clarinet, trombó) triguen fins a mig segon
// a sonar plenes i les notes curtes quedaven apagades. La mostra comença just
// abans del punt on arriba al 62 % del nivell màxim, amb una entrada de 8 ms.
function tightenAttack(data, rate) {
  const size = Math.round(rate * .005), limit = Math.min(data.length, Math.round(rate * .8)), levels = [];
  for (let s = 0; s + size <= limit; s += size) { let e = 0; for (let i = s; i < s + size; i++) e += data[i] * data[i]; levels.push(Math.sqrt(e / size)); }
  const max = Math.max(...levels); if (!max) return data;
  const start = Math.max(0, levels.findIndex(v => v >= max * .62) * size - Math.round(rate * .006));
  const out = data.slice(start), fade = Math.round(rate * .008);
  for (let i = 0; i < Math.min(fade, out.length); i++) out[i] *= i / fade;
  return out;
}
export function trim(data, rate, maxSeconds, keepFrom = 0) {
  let peak = 0; for (const x of data) peak = Math.max(peak, Math.abs(x));
  let start = keepFrom;
  if (!keepFrom) { const gate = peak * .02; while (start < data.length && Math.abs(data[start]) < gate) start++; start = Math.max(0, start - Math.round(rate * .004)); }
  const end = Math.min(data.length, start + Math.round(maxSeconds * rate)), out = data.slice(start, end);
  const fade = Math.min(out.length, Math.round(rate * Math.min(.25, maxSeconds / 4)));
  if (end < data.length) for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}
// Afinació mesurada (autocorrelació) per corregir mostres desafinades.
function detectMidi(data, rate) {
  const start = Math.min(data.length - 1, Math.round(rate * .15)), size = Math.min(4096, data.length - start);
  if (size < 1024) return null;
  const frame = data.subarray(start, start + size), minLag = Math.floor(rate / 1200), maxLag = Math.min(size - 1, Math.floor(rate / 40));
  let best = 0, bestLag = 0, energy = 0;
  for (const x of frame) energy += x * x;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0; for (let i = 0; i + lag < size; i++) sum += frame[i] * frame[i + lag];
    sum /= energy || 1;
    if (sum > best) { best = sum; bestLag = lag; }
  }
  if (best < .5 || !bestLag) return null;
  return 69 + 12 * Math.log2(rate / bestLag / 440);
}
export function makeSample(bank, name, data, rate, key, cents = 0, loop = null) {
  const sample = new EmptySample();
  sample.name = name.slice(0, 19); sample.originalKey = key; sample.pitchCorrection = cents;
  sample.sampleType = SampleTypes.monoSample;
  sample.setAudioData(data, rate);
  sample.loopStart = loop ? loop[0] : 0; sample.loopEnd = loop ? loop[1] : data.length - 1;
  bank.addSamples(sample);
  return sample;
}
export const timecents = seconds => Math.round(1200 * Math.log2(seconds));
// Sonoritat d'una mostra: la RMS més alta en finestres de 30 ms (val igual
// per a una nota llarga que per a un cop d'staccato).
function loudness(data, rate) {
  const size = Math.round(rate * .03); let best = 0;
  for (let start = 0; start + size <= data.length; start += size >> 1) {
    let sum = 0; for (let i = start; i < start + size; i++) sum += data[i] * data[i];
    best = Math.max(best, sum / size);
  }
  return Math.sqrt(best);
}
// Iguala totes les notes: cada dinàmica té el mateix nivell a tota la tessitura
// (les gravacions originals varien més de 20 dB d'una nota a l'altra).
export function level(data, rate, targetDb) {
  const now = loudness(data, rate); if (!now) return;
  let peak = 0; for (const x of data) peak = Math.max(peak, Math.abs(x));
  const gain = Math.min(10 ** (targetDb / 20) / now, .95 / peak);
  for (let i = 0; i < data.length; i++) data[i] *= gain;
}

// ── VSCO 2 CE: metalls (i piano vertical) a partir dels WAV ─────────────────────────────
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export async function buildVsco(bank, config, log) {
  for (const spec of config.instruments) {
    // Dos formats de nom: «…_A#2_v3_…» (do central = C3) i el piano «UR1_C4_mf_RR1» (do central = C4; pp, mf i f).
    const DYNAMICS = { pp: 1, mf: 2, f: 3 };
    const parse = file => {
      const m = file.match(/_([A-G]#?)(-?\d)_v(\d)/);
      if (m) return { named: (Number(m[2]) + 2) * 12 + NOTE[m[1]], layer: Number(m[3]) };
      const p = file.match(/_([A-G]#?)(\d)_(pp|mf|f)_RR\d/);
      return p && { named: (Number(p[2]) + 1) * 12 + NOTE[p[1]], layer: DYNAMICS[p[3]] };
    };
    let files = config.files.filter(file => file.startsWith(spec.match));
    // Forats de l'staccato: les notes a més de 2 semitons d'una gravació
    // staccato fan servir la sostinguda (retallada i amb atac immediat).
    const fills = new Set();
    if (spec.fill) {
      const own = files.map(parse).filter(Boolean).map(x => x.named);
      for (const file of config.files.filter(f => f.startsWith(spec.fill))) {
        const info = parse(file);
        if (info && Math.min(...own.map(n => Math.abs(n - info.named))) > 2) { files.push(file); fills.add(file); }
      }
    }
    const loaded = [];
    for (const file of files) {
      const info = parse(file);
      if (!info) continue;
      const named = info.named;
      const path = await download(config.base + file.split('/').map(encodeURIComponent).join('/'));
      const wav = readWav(await readFile(path));
      const sampled = resample(wav.data, wav.rate, RATE);
      const data = trim(spec.tightAttack || fills.has(file) ? tightenAttack(sampled, RATE) : sampled, RATE, spec.maxSeconds);
      const measured = detectMidi(data, RATE);
      const cents = measured !== null && Math.abs(measured - named) < .5 ? -Math.round((measured - named) * 100) : 0;
      loaded.push({ named, layer: info.layer, data, cents });
    }
    if (!loaded.length) throw new Error(`No hi ha mostres per a ${spec.name}`);
    // Mateix nivell per a totes les notes i per a staccato i sostingut; la
    // dinàmica suau queda 4 dB per sota (la força de la nota fa la resta);
    // l'staccato queda 5 dB per sota perquè les notes curtes no sobresurtin.
    const loudest = Math.max(...loaded.map(s => s.layer));
    const [loud, soft] = spec.levelDb || [-12, -16];
    for (const s of loaded) level(s.data, RATE, s.layer === loudest ? loud : soft);
    const instrument = new BasicInstrument(); instrument.name = spec.name.slice(0, 19);
    const layers = [...new Set(loaded.map(s => s.layer))].sort((a, b) => a - b);
    const notes = [...new Set(loaded.map(s => s.named))].sort((a, b) => a - b);
    layers.forEach((layer, li) => {
      const velMin = Math.round(li * 128 / layers.length), velMax = Math.round((li + 1) * 128 / layers.length) - 1;
      notes.forEach((note, ni) => {
        let source = loaded.find(s => s.named === note && s.layer === layer);
        if (!source) {
          // Falta aquesta dinàmica: es reutilitza una altra gravació igualada al nivell de la capa.
          const other = loaded.find(s => s.named === note);
          source = { ...other, data: other.data.slice() };
          level(source.data, RATE, layer === loudest ? loud : soft);
        }
        const keyMin = ni === 0 ? 0 : Math.floor((notes[ni - 1] + note) / 2) + 1;
        const keyMax = ni === notes.length - 1 ? 127 : Math.floor((note + notes[ni + 1]) / 2);
        const sample = makeSample(bank, `${spec.program}${spec.bank}${note}v${layer}`, source.data, RATE, note, source.cents);
        const zone = instrument.createZone(sample);
        zone.keyRange = { min: keyMin, max: keyMax }; zone.velRange = { min: velMin, max: velMax };
        zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(spec.release));
      });
    });
    bank.addInstruments(instrument);
    const preset = new BasicPreset(bank); preset.name = spec.name.slice(0, 19); preset.program = spec.program; preset.bankMSB = spec.bank;
    preset.createZone(instrument); bank.addPresets(preset);
    log(`${spec.name}: ${loaded.length} mostres, ${layers.length} dinàmiques`);
  }
}

// ── Vents gravats propis (audio/samples): una gravació per nota, amb bucle a la part estable ──
// Bucle: es busca, a la meitat estable de la nota, un tram d'un nombre sencer de períodes on
// l'ona torna a ser igual que a l'inici; la cua del tram es fon amb el que hi ha abans de
// l'inici, així el bucle no fa clic i les notes poden durar més que la gravació.
function findLoop(data, rate, hz) {
  const period = rate / hz, from = Math.round(data.length * .35), to = Math.round(data.length - rate * .16);
  const cycles = Math.max(2, Math.round(rate * .12 / period)), span = 48;
  let best = null;
  for (let start = from; start < from + period * 6 && start + period * cycles + span < to; start++) {
    if (!(data[start - 1] <= 0 && data[start] > 0)) continue;
    for (let k = cycles; start + Math.round(k * period) + span < to && k <= cycles * 3; k++) {
      const guess = Math.round(start + k * period);
      for (let end = guess - 3; end <= guess + 3; end++) {
        let error = 0;
        for (let i = -span; i < span; i++) error += (data[start + i] - data[end + i]) ** 2;
        if (!best || error < best.error) best = { start, end, error };
      }
    }
  }
  if (!best) return null;
  const out = data.slice(0, best.end + 1), fade = Math.min(best.start, Math.round((best.end - best.start) / 2));
  for (let i = 0; i < fade; i++) { const w = (i + 1) / fade, at = best.end - fade + i + 1; out[at] = data[at] * (1 - w) + data[best.start - fade + i + 1] * w; }
  return { data: out, loop: [best.start, best.end] };
}
export async function buildLocalHorns(bank, specs = [], log) {
  for (const spec of specs) {
    const instrument = new BasicInstrument(); instrument.name = spec.name.slice(0, 19);
    const notes = [...spec.notes].sort((a, b) => a.key - b.key);
    const made = notes.map(entry => {
      const wav = readWav(readFileSync(new URL('../' + spec.directory + entry.file, import.meta.url)));
      // (maxSeconds: només el principi de cada gravació —l'atac i el tros on es fa el bucle—, perquè el banc no creixi.)
      const trimmed = trim(resample(wav.data, wav.rate, RATE), RATE, spec.maxSeconds ?? 10);
      // L'afinació mesurada de la gravació (cents per sobre de la nota): es corregeix aquí.
      const looped = findLoop(trimmed, RATE, 440 * 2 ** ((entry.key - 69) / 12 + entry.cents / 1200));
      if (!looped) throw new Error(`${spec.name}: no hi ha bucle per a la nota ${entry.key}`);
      level(looped.data, RATE, spec.levelDb);
      return { entry, ...looped };
    });
    // Totes les notes amb la mateixa sonoritat sostinguda (la del bucle): algunes gravacions tenen
    // l'atac molt més fort que la nota i, igualades només per l'atac, sonaven fins a 7 dB més fluixes.
    const sustain = ({ data, loop: [a, z] }) => { let e = 0; for (let i = a; i < z; i++) e += data[i] * data[i]; return Math.sqrt(e / (z - a)); };
    const middle = made.map(sustain).sort((a, b) => a - b)[made.length >> 1];
    made.forEach(m => { let peak = 0; for (const x of m.data) peak = Math.max(peak, Math.abs(x)); const gain = Math.min(middle / sustain(m), .95 / peak); for (let i = 0; i < m.data.length; i++) m.data[i] *= gain; });
    made.forEach(({ entry, data, loop }, ni) => {
      const keyMin = ni === 0 ? 0 : Math.floor((notes[ni - 1].key + entry.key) / 2) + 1;
      const keyMax = ni === notes.length - 1 ? 127 : Math.floor((entry.key + notes[ni + 1].key) / 2);
      const sample = makeSample(bank, `L${spec.bank}${spec.program}${entry.key}`, data, RATE, entry.key, -entry.cents, loop);
      const zone = instrument.createZone(sample);
      zone.keyRange = { min: keyMin, max: keyMax };
      zone.setGenerator(GeneratorTypes.sampleModes, 1);
      zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(spec.release));
    });
    bank.addInstruments(instrument);
    const preset = new BasicPreset(bank); preset.name = spec.name.slice(0, 19); preset.program = spec.program; preset.bankMSB = spec.bank;
    preset.createZone(instrument); bank.addPresets(preset);
    log(`${spec.name}: ${notes.length} mostres amb bucle`);
  }
}

// ── FreePats: SF2 existents, remostrejats i retallats ────────────────
async function importFreePats(entry, log) {
  const sf2 = await extractSf2(await download(entry.url, entry.sha256));
  const bank = loadBank(await readFile(sf2));
  const preset = bank.presets[0];
  for (const extra of bank.presets.slice(1)) bank.deletePreset(extra);
  preset.bankMSB = entry.bank; preset.bankLSB = 0; preset.program = entry.program; preset.isGMGSDrum = false;
  preset.name = entry.name.slice(0, 19);
  // Sense bucles: les notes de la cançó són curtes i així cada mostra es pot
  // remostrejar i retallar sense clics.
  for (const instrument of bank.instruments) {
    instrument.globalZone.setGenerator(GeneratorTypes.sampleModes, null);
    for (const zone of instrument.zones) zone.setGenerator(GeneratorTypes.sampleModes, null);
  }
  // Bancs grans (diverses capes de força, repeticions i estèreo per nota): només una gravació
  // per tram de notes, en mono, perquè la web no pesi massa. «keepSample» és una expressió
  // regular sobre el nom de la mostra; es queda la zona de força més alta de cada tram.
  if (entry.keepSample) {
    const wanted = new RegExp(entry.keepSample);
    for (const instrument of bank.instruments) {
      const best = new Map();
      instrument.zones.forEach((zone, index) => {
        if (!wanted.test(zone.sample.name)) return;
        const key = `${zone.keyRange.min}-${zone.keyRange.max}`, current = best.get(key);
        if (!current || zone.velRange.max > instrument.zones[current].velRange.max) best.set(key, index);
      });
      const keep = new Set(best.values());
      for (let index = instrument.zones.length - 1; index >= 0; index--) if (!keep.has(index)) instrument.deleteZone(index, true);
      for (const zone of instrument.zones) {
        zone.velRange = { min: 0, max: 127 };
        zone.setGenerator(GeneratorTypes.pan, null);
        zone.setGenerator(GeneratorTypes.initialAttenuation, null);
      }
      instrument.globalZone.setGenerator(GeneratorTypes.pan, null);
    }
    bank.removeUnusedElements();
    for (const sample of bank.samples) sample.unlinkSample();
  }
  const rate = entry.rate || RATE;
  for (const sample of bank.samples) {
    const data = trim(resample(sample.getAudioData(), sample.sampleRate, rate), rate, entry.maxSeconds, 1);
    // Igualació de nivell entre notes (com amb VSCO), si la font la necessita.
    if (entry.levelDb !== undefined) level(data, rate, entry.levelDb);
    sample.setAudioData(data, rate);
    sample.loopStart = 0; sample.loopEnd = data.length - 1;
  }
  bank.removeUnusedElements();
  log(`${entry.name}: ${bank.samples.length} mostres`);
  return bank;
}

// ── Muldjord Kit: kit GM amb quatre capes de força ───────────────────
async function buildDrums(bank, config, log) {
  const source = loadBank(await readFile(await extractSf2(await download(config.url, config.sha256))));
  const zones = source.instruments[0].zones;
  const pick = (key, velocity) => zones.filter(z => z.keyRange.min <= key && z.keyRange.max >= key && z.velRange.min <= velocity && z.velRange.max >= velocity);
  const cache = new Map(), pieces = [];
  const mono = (key, velocity, seconds) => {
    const id = `${key}:${velocity}:${seconds}`;
    if (cache.has(id)) return cache.get(id);
    const parts = pick(key, velocity);
    if (!parts.length) throw new Error(`El kit no té la tecla ${key}`);
    const audio = parts.map(z => resample(z.sample.getAudioData(), z.sample.sampleRate, RATE));
    const length = Math.min(...audio.map(a => a.length)), data = new Float32Array(length);
    for (const a of audio) for (let i = 0; i < length; i++) data[i] += a[i] / audio.length;
    const out = trim(data, RATE, seconds, 1);
    cache.set(id, out); pieces.push(out); return out;
  };
  const velocities = config.velocities;
  // Gravacions alternades (round-robin.json): el kit original té una gravació per a
  // cada força, així que les alternatives són les de força veïna (±3).
  const entries = Object.entries(config.map).map(([gm, spec]) => [gm, spec, 0]);
  for (const gm of ROUND_ROBIN.kits[String(config.program)] || []) {
    const spec = config.map[gm];
    if (spec) ROUND_ROBIN.keys[gm].forEach((key, k) => entries.push([String(key), spec, k ? 3 : -3]));
  }
  // 1) Àudio de cada cop i capa; 2) normalització del kit sencer (conserva
  // l'equilibri entre peces i capes); 3) mostres i zones.
  for (const [, [key, seconds], shift] of entries) for (const velocity of velocities) mono(key, Math.min(127, velocity + shift), seconds);
  let peak = 0; for (const p of pieces) for (const x of p) peak = Math.max(peak, Math.abs(x));
  for (const p of pieces) for (let i = 0; i < p.length; i++) p[i] *= .9 / peak;
  const instrument = new BasicInstrument(); instrument.name = 'Muldjord Kit';
  const made = new Map();
  for (const [gm, [key, seconds, choke], shift] of entries) {
    velocities.forEach((layerVelocity, li) => {
      const velocity = Math.min(127, layerVelocity + shift), id = `${key}:${velocity}:${seconds}`;
      if (!made.has(id)) made.set(id, makeSample(bank, `MK${key}v${li}${shift ? (shift > 0 ? 'b' : 'a') : ''}`, cache.get(id), RATE, Number(gm)));
      const zone = instrument.createZone(made.get(id));
      zone.keyRange = { min: Number(gm), max: Number(gm) };
      zone.velRange = { min: li ? Math.round((velocities[li - 1] + layerVelocity) / 2) + 1 : 0, max: li === velocities.length - 1 ? 127 : Math.round((layerVelocity + velocities[li + 1]) / 2) };
      zone.setGenerator(GeneratorTypes.overridingRootKey, Number(gm));
      // La bateria sona fins al final encara que la nota s'aturi abans.
      zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(Math.max(1, seconds)));
      if (choke) zone.setGenerator(GeneratorTypes.exclusiveClass, choke);
    });
  }
  bank.addInstruments(instrument);
  const preset = new BasicPreset(bank); preset.name = 'Muldjord Kit'; preset.program = config.program; preset.bankMSB = 0; preset.isGMGSDrum = true;
  preset.createZone(instrument); bank.addPresets(preset);
  log(`${config.name}: ${made.size} mostres, ${Object.keys(config.map).length} cops`);
}

// ── Orgue de rodes fòniques (tipus Hammond), sintetitzat ─────────────
// Cada tirant és una sinusoide (16', 5 1/3', 8', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1');
// cada pas del tirant val 3 dB. Els harmònics per sobre de ~6 kHz es repleguen una
// octava avall, com a les rodes de l'orgue real. Cada mostra té una part inicial amb
// el clic de la tecla i la percussió (que s'apaga del tot) i un bucle exacte: totes
// les sinusoides fan un nombre enter de cicles dins del bucle, sense cap salt.
// L'altaveu rotatori (Leslie) s'aplica en reproduir (audio/render.mjs).
const DRAWBAR_RATIOS = [.5, 1.5, 1, 2, 3, 4, 5, 6, 8];
export function tonewheelNote(note, spec, rate = RATE) {
  const target = 440 * 2 ** ((note - 69) / 12), unit = target / 4; // tots els harmònics són múltiples de f/4
  const fold = ratio => { let r = ratio; while (target * r > 6000) r /= 2; while (target * r < 30) r *= 2; return r; };
  const partials = [];
  spec.drawbars.forEach((step, i) => { if (step > 0) partials.push([fold(DRAWBAR_RATIOS[i]), 10 ** (-(8 - step) * 3 / 20)]); });
  const cycles = Math.max(1, Math.round(spec.loopSeconds * unit));
  const loopLength = Math.round(cycles * rate / unit), actualUnit = cycles * rate / loopLength;
  const cents = 1200 * Math.log2(actualUnit / unit);
  const attack = Math.round(spec.attackSeconds * rate), length = attack + loopLength + 8;
  const data = new Float32Array(length), w = 2 * Math.PI * actualUnit * 4 / rate;
  const perc = spec.percussion, percRatio = perc ? fold(perc.harmonic) : 0;
  let seed = note * 7919 + 1, lowpass = 0;
  const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  const clickLength = Math.round(rate * .006), clickCut = 1 - Math.exp(-2 * Math.PI * 3500 / rate);
  for (let i = 0; i < length; i++) {
    let y = 0;
    for (const [ratio, amp] of partials) y += amp * Math.sin(w * ratio * i);
    if (perc && i < attack) y += perc.level * Math.exp(-i / (perc.decay * rate)) * Math.sin(w * percRatio * i);
    if (spec.click && i < clickLength) { lowpass += clickCut * (noise() - lowpass); y += spec.click * lowpass * Math.exp(-i / (rate * .0015)) * 4; }
    data[i] = y;
  }
  return { data, loop: [attack, attack + loopLength], cents: -Math.round(cents) };
}
export function buildTonewheel(bank, spec, log) {
  const [first, last, step] = spec.notes, notes = [];
  for (let n = first; n <= last; n += step) notes.push(n);
  const made = notes.map(note => ({ note, ...tonewheelNote(note, spec) }));
  // Mateix guany per a totes les notes: la part del bucle continua sent periòdica.
  for (const m of made) level(m.data, RATE, spec.levelDb);
  const instrument = new BasicInstrument(); instrument.name = 'Tonewheel organ';
  made.forEach(({ note, data, loop, cents }, i) => {
    const sample = makeSample(bank, `TW${note}`, data, RATE, note, cents, loop);
    const zone = instrument.createZone(sample);
    zone.keyRange = { min: i === 0 ? 0 : Math.floor((notes[i - 1] + note) / 2) + 1, max: i === notes.length - 1 ? 127 : Math.floor((note + notes[i + 1]) / 2) };
    zone.setGenerator(GeneratorTypes.sampleModes, 1);
    zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(spec.release));
  });
  bank.addInstruments(instrument);
  const preset = new BasicPreset(bank); preset.name = 'Tonewheel organ'; preset.program = spec.program; preset.bankMSB = spec.bank;
  preset.createZone(instrument); bank.addPresets(preset);
  log(`${spec.name}: ${made.length} mostres amb bucle`);
}

// Guitarres solistes gravades (FreePats FSBS): banc a part que la web només baixa quan cal.
// ── Acords de guitarra d'ska (skank) ──────────────────────────────────
// Cada tipus d'acord és un programa (major, menor, 7 i m7) i cada fonamental, una tecla (48 + fonamental, variant 1;
// 60 + fonamental, variant 2), sense transposar: cada tecla toca la seva mostra tal com és. Les mostres es retallen
// (seconds), s'igualen a la mateixa sonoritat i s'apaguen en «release» segons quan la guitarra aixeca la mà.
const CHORD_ROOTS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B'];
const chordFiles = spec => Object.keys(spec.programs).flatMap(quality => CHORD_ROOTS.flatMap((root, pc) =>
  [1, 2].map(variant => ({ quality, pc, variant, file: `${root}_${quality}_0${variant}.wav` }))));
// Poliment dels acords per a l'skank: comencen just a l'atac (2 ms abans), sense el retruny greu que tapa el baix
// (pas alt de 2n ordre a 170 Hz), amb més presència (prestatge aguts +4 dB des de 2,5 kHz), un atac més definit
// (realçador de transitoris: el cop de pua puja fins a 4 dB respecte de la ressonància) i una cua que s'apaga aviat.
function biquad(data, rate, type, hz, gainDb = 0, q = .707) {
  const w = 2 * Math.PI * hz / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), A = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  else { const s = 2 * Math.sqrt(A) * alpha; b0 = A * ((A + 1) + (A - 1) * cos + s); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - s);
    a0 = (A + 1) - (A - 1) * cos + s; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - s; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) { const x = data[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; data[i] = y; }
  return data;
}
export function polishChord(input, rate) {
  let peak = 0; for (const x of input) peak = Math.max(peak, Math.abs(x));
  let onset = 0; while (onset < input.length && Math.abs(input[onset]) < peak * .1) onset++;
  const data = input.slice(Math.max(0, onset - Math.round(rate * .002)));
  biquad(data, rate, 'highpass', 170); biquad(data, rate, 'highshelf', 2500, 4);
  // Transitoris: envolupant ràpida (1 ms) contra lenta (40 ms); on la ràpida passa la lenta, hi ha el cop.
  const fast = Math.exp(-1 / (rate * .001)), slow = Math.exp(-1 / (rate * .04));
  let ef = 0, es = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]); ef = Math.max(a, ef * fast); es = es * slow + a * (1 - slow);
    data[i] *= Math.min(10 ** (4 / 20), Math.max(1, 1 + (ef - es) / (es + 1e-4) * .5));
  }
  // Cua: a partir de 180 ms s'apaga en 120 ms.
  const from = Math.round(rate * .18), len = Math.round(rate * .12);
  for (let i = from; i < data.length; i++) data[i] *= Math.max(0, 1 - (i - from) / len);
  return data;
}
function buildSkankChords(bank, spec, log) {
  for (const [quality, program] of Object.entries(spec.programs)) {
    const instrument = new BasicInstrument(); instrument.name = `${spec.name} ${quality}`.slice(0, 19);
    for (const { pc, variant, file } of chordFiles(spec).filter(entry => entry.quality === quality)) {
      const wav = readWav(readFileSync(new URL('../' + spec.directory + file, import.meta.url)));
      const data = trim(polishChord(resample(wav.data, wav.rate, RATE), RATE), RATE, spec.seconds);
      level(data, RATE, spec.levelDb);
      const key = (variant === 1 ? 48 : 60) + pc;
      const sample = makeSample(bank, `G6${program}${key}`, data, RATE, key, 0);
      const zone = instrument.createZone(sample);
      zone.keyRange = { min: key, max: key };
      zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(spec.release));
    }
    bank.addInstruments(instrument);
    const preset = new BasicPreset(bank); preset.name = instrument.name; preset.program = program; preset.bankMSB = spec.bank;
    preset.createZone(instrument); bank.addPresets(preset);
  }
  log(`${spec.name}: ${chordFiles(spec).length} acords`);
}
// ── Orgue Hammond gravat amb el Leslie girant ─────────────────────────
// El so canvia amb la volta del rotor: el bucle ha de durar més o menys una volta (1,3–2,5 s) i començar i acabar en un
// punt semblant de l'ona (es busca entre els passos per zero) i, a més, s'encreuen els últims 40 ms amb els d'abans de
// l'inici, perquè la volta continuï sense salt.
function rotorLoop(data, rate) {
  const start = Math.round(rate * .35), win = 512, fade = Math.round(rate * .04);
  let best = null;
  for (let end = Math.round(rate * 1.3); end < Math.min(data.length - win, Math.round(rate * 2.5)); end++) {
    if (!(data[end - 1] <= 0 && data[end] > 0)) continue;
    let error = 0, energy = 0;
    for (let i = 0; i < win; i += 2) { error += (data[start + i] - data[end + i]) ** 2; energy += data[start + i] ** 2; }
    error /= energy + 1e-9;
    if (!best || error < best.error) best = { end, error };
  }
  let s = start; while (s < data.length - 1 && !(data[s - 1] <= 0 && data[s] > 0)) s++;
  const end = best.end + (s - start), out = data.slice(0, end + 1);
  for (let i = 0; i < fade; i++) { const w = (i + 1) / fade, at = end - fade + i + 1; out[at] = data[at] * (1 - w) + data[s - fade + i + 1] * w; }
  return { data: out, loop: [s, end] };
}
function buildRotorOrgan(bank, spec, log) {
  const instrument = new BasicInstrument(); instrument.name = spec.name.slice(0, 19);
  const keys = [...spec.keys].sort((a, b) => a - b);
  keys.forEach((key, i) => {
    const wav = readWav(readFileSync(new URL('../' + spec.directory + `orgue-rotor-${key}.wav`, import.meta.url)));
    const { data, loop } = rotorLoop(resample(wav.data, wav.rate, RATE), RATE);
    level(data, RATE, spec.levelDb);
    const sample = makeSample(bank, `O7${key}`, data, RATE, key, 0, loop);
    const zone = instrument.createZone(sample);
    zone.keyRange = { min: i ? Math.floor((keys[i - 1] + key) / 2) + 1 : 0, max: i < keys.length - 1 ? Math.floor((key + keys[i + 1]) / 2) : 127 };
    zone.setGenerator(GeneratorTypes.sampleModes, 1);
    zone.setGenerator(GeneratorTypes.releaseVolEnv, timecents(spec.release));
  });
  bank.addInstruments(instrument);
  const preset = new BasicPreset(bank); preset.name = instrument.name; preset.program = spec.program; preset.bankMSB = spec.bank;
  preset.createZone(instrument); bank.addPresets(preset);
  log(`${spec.name}: ${keys.length} notes amb bucle`);
}
export async function buildGuitarInstruments(entries, log = console.log, chords = null, organ = null) {
  SpessaLog.setLogLevel(false, false, false);
  await mkdir(CACHE, { recursive: true });
  // (També el contingut dels acords propis: si se'n canvia un, el banc es torna a construir.)
  const chordHashes = chords ? chordFiles(chords).map(({ file }) => sha(readFileSync(new URL('../' + chords.directory + file, import.meta.url)))) : [];
  const organHashes = organ ? organ.keys.map(key => sha(readFileSync(new URL('../' + organ.directory + `orgue-rotor-${key}.wav`, import.meta.url)))) : [];
  const fingerprint = sha(JSON.stringify(entries) + JSON.stringify(chords) + JSON.stringify(organ) + await readFile(new URL(import.meta.url)) + chordHashes.join('') + organHashes.join(''));
  const cached = join(CACHE, `guitars-${fingerprint.slice(0, 16)}.sf2`);
  try { return new Uint8Array(await readFile(cached)); } catch { /* Es construeix. */ }
  const banks = [];
  if (chords || organ) {
    const own = new BasicSoundBank();
    if (chords) buildSkankChords(own, chords, log);
    if (organ) buildRotorOrgan(own, organ, log);
    banks.push(own);
  }
  for (const entry of entries) banks.push(await importFreePats(entry, log));
  const merged = BasicSoundBank.mergeSoundBanks(...banks);
  merged.soundBankInfo.name = 'Ska Generator lead guitars';
  const binary = new Uint8Array(merged.writeSF2());
  await writeFile(cached, binary);
  return binary;
}

export async function buildRealInstruments(config, log = console.log) {
  SpessaLog.setLogLevel(false, false, false);
  await mkdir(CACHE, { recursive: true });
  // (També el contingut de les mostres pròpies: si se'n canvia una, el banc es torna a construir.)
  const localHashes = (config.localHorns || []).flatMap(spec => spec.notes.map(entry => sha(readFileSync(new URL('../' + spec.directory + entry.file, import.meta.url)))));
  const fingerprint = sha(JSON.stringify(config) + JSON.stringify(ROUND_ROBIN) + await readFile(new URL(import.meta.url)) + localHashes.join(''));
  const cached = join(CACHE, `real-${fingerprint.slice(0, 16)}.sf2`);
  try { return loadBank(await readFile(cached)); } catch { /* Es construeix. */ }
  const own = new BasicSoundBank();
  own.soundBankInfo.name = 'Ska Generator real instruments';
  await buildVsco(own, config.vsco, log);
  await buildLocalHorns(own, config.localHorns, log);
  await buildDrums(own, config.drums, log);
  if (config.organ) buildTonewheel(own, config.organ, log);
  const banks = [own];
  for (const entry of config.freepats) banks.push(await importFreePats(entry, log));
  const merged = BasicSoundBank.mergeSoundBanks(...banks);
  const binary = new Uint8Array(merged.writeSF2());
  await writeFile(cached, binary);
  return loadBank(Buffer.from(binary));
}
