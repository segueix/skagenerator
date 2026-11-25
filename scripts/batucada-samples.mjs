// Variants de la cuíca de la batucada, fetes a partir de la gravació original (audio/samples/cuica.wav)
// amb canvis de to i distorsions. Cada variant té un caràcter propi perquè es puguin encadenar
// (aguda, greu, trencada, robòtica i glissando). Es tornen a generar amb:
//   node scripts/batucada-samples.mjs
import { readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../audio/samples/', import.meta.url);

function readWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 12, rate = 0, channels = 1, bits = 16, data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4), size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') { channels = view.getUint16(offset + 10, true); rate = view.getUint32(offset + 12, true); bits = view.getUint16(offset + 22, true); }
    if (id === 'data') data = [offset + 8, size];
    offset += 8 + size + (size & 1);
  }
  if (bits !== 16 || !data) throw new Error('Només WAV PCM de 16 bits');
  const frames = data[1] / 2 / channels, out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += view.getInt16(data[0] + (i * channels + c) * 2, true) / 32768;
    out[i] = sum / channels;
  }
  return { data: out, rate };
}
function writeWav(samples, rate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii'); buffer.writeUInt32LE(36 + samples.length * 2, 4); buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii'); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii'); buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return buffer;
}
// Lectura a velocitat variable (to que canvia al llarg del cop): ratio(t) en semitons.
function repitch(data, semitones) {
  const out = [];
  for (let pos = 0; pos < data.length - 1;) {
    const i = Math.floor(pos), frac = pos - i;
    out.push(data[i] * (1 - frac) + data[i + 1] * frac);
    pos += 2 ** (semitones(pos / data.length) / 12);
  }
  return Float32Array.from(out);
}
const drive = (data, amount) => data.map(x => Math.tanh(x * amount) / Math.tanh(amount));
function lowpass(data, rate, hz) {
  const a = 1 - Math.exp(-2 * Math.PI * hz / rate); let y = 0;
  return data.map(x => (y += a * (x - y)));
}
// Robòtica: retall dur, menys resolució i mostres retingudes.
function crush(data, hold, levels) {
  const out = new Float32Array(data.length); let last = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % hold === 0) last = Math.round(Math.max(-.35, Math.min(.35, data[i] * 3)) / .35 * levels) / levels;
    out[i] = last;
  }
  return out;
}
function normalize(data, peak = .89) {
  let max = 0; for (const v of data) max = Math.max(max, Math.abs(v));
  const fadeOut = Math.min(data.length, 200);
  return data.map((v, i) => v / (max || 1) * peak * Math.min(1, (data.length - 1 - i) / fadeOut));
}

const { data, rate } = readWav(await readFile(new URL('cuica.wav', DIR)));
const VARIANTS = {
  'cuica-aguda.wav': () => drive(repitch(data, () => 7), 2),
  'cuica-greu.wav': () => lowpass(drive(repitch(data, () => -5), 3.5), rate, 3800),
  'cuica-trencada.wav': () => lowpass(drive(repitch(data, () => 2), 14), rate, 5200),
  'cuica-robotica.wav': () => lowpass(crush(repitch(data, () => -2), 5, 7), rate, 6000),
  'cuica-glissando.wav': () => drive(repitch(data, t => -6 + 14 * t), 4)
};
for (const [file, make] of Object.entries(VARIANTS)) {
  await writeFile(new URL(file, DIR), writeWav(normalize(make()), rate));
  console.log(`audio/samples/${file}`);
}
