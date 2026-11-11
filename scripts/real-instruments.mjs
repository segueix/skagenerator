// Construeix un banc SF2 amb instruments gravats nota a nota:
// - VSCO 2 CE (CC0): trompeta i trombó, sostinguts i staccato, a partir dels WAV.
// - FreePats (CC0): baixos, guitarra neta, saxo tenor i orgue, a partir dels seus SF2.
// - Muldjord Kit (CC-BY 4.0): un kit GM nou amb quatre capes de força per cop.
// Tot es remostreja a 32 kHz en mono i es retalla perquè la web pesi poc.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
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

// ── VSCO 2 CE: metalls a partir dels WAV ─────────────────────────────
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
async function buildVsco(bank, config, log) {
  for (const spec of config.instruments) {
    const parse = file => { const m = file.match(/_([A-G]#?)(-?\d)_v(\d)/); return m && { named: (Number(m[2]) + 2) * 12 + NOTE[m[1]], layer: Number(m[3]) }; };
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
      const match = file.match(/_([A-G]#?)(-?\d)_v(\d)/);
      if (!match) continue;
      // VSCO numera les octaves amb do central = C3.
      const named = (Number(match[2]) + 2) * 12 + NOTE[match[1]];
      const path = await download(config.base + file.split('/').map(encodeURIComponent).join('/'));
      const wav = readWav(await readFile(path));
      const sampled = resample(wav.data, wav.rate, RATE);
      const data = trim(spec.tightAttack || fills.has(file) ? tightenAttack(sampled, RATE) : sampled, RATE, spec.maxSeconds);
      const measured = detectMidi(data, RATE);
      const cents = measured !== null && Math.abs(measured - named) < .5 ? -Math.round((measured - named) * 100) : 0;
      loaded.push({ named, layer: Number(match[3]), data, cents });
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
  const velocities = config.velocities, entries = Object.entries(config.map);
  // 1) Àudio de cada cop i capa; 2) normalització del kit sencer (conserva
  // l'equilibri entre peces i capes); 3) mostres i zones.
  for (const [, [key, seconds]] of entries) for (const velocity of velocities) mono(key, velocity, seconds);
  let peak = 0; for (const p of pieces) for (const x of p) peak = Math.max(peak, Math.abs(x));
  for (const p of pieces) for (let i = 0; i < p.length; i++) p[i] *= .9 / peak;
  const instrument = new BasicInstrument(); instrument.name = 'Muldjord Kit';
  const made = new Map();
  for (const [gm, [key, seconds, choke]] of entries) {
    velocities.forEach((velocity, li) => {
      const id = `${key}:${velocity}:${seconds}`;
      if (!made.has(id)) made.set(id, makeSample(bank, `MK${key}v${li}`, cache.get(id), RATE, Number(gm)));
      const zone = instrument.createZone(made.get(id));
      zone.keyRange = { min: Number(gm), max: Number(gm) };
      zone.velRange = { min: li ? Math.round((velocities[li - 1] + velocity) / 2) + 1 : 0, max: li === velocities.length - 1 ? 127 : Math.round((velocity + velocities[li + 1]) / 2) };
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

export async function buildRealInstruments(config, log = console.log) {
  SpessaLog.setLogLevel(false, false, false);
  await mkdir(CACHE, { recursive: true });
  const fingerprint = sha(JSON.stringify(config) + await readFile(new URL(import.meta.url)));
  const cached = join(CACHE, `real-${fingerprint.slice(0, 16)}.sf2`);
  try { return loadBank(await readFile(cached)); } catch { /* Es construeix. */ }
  const own = new BasicSoundBank();
  own.soundBankInfo.name = 'Ska Generator real instruments';
  await buildVsco(own, config.vsco, log);
  await buildDrums(own, config.drums, log);
  const banks = [own];
  for (const entry of config.freepats) banks.push(await importFreePats(entry, log));
  const merged = BasicSoundBank.mergeSoundBanks(...banks);
  const binary = new Uint8Array(merged.writeSF2());
  await writeFile(cached, binary);
  return loadBank(Buffer.from(binary));
}
