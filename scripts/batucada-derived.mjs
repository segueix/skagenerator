// Mostres derivades del kit de batucada, fetes a partir de les gravacions (audio/samples):
// - Surdo apagat («abafado»): el músic atura la pell amb la mà. Es conserva la gravació sencera (atac,
//   soroll de la pell i to) i només s'esmorteeix: sona uns mil·lisegons i s'apaga de manera progressiva,
//   amb els aguts una mica més suaus. Tot són operacions lineals: no hi ha saturació ni distorsió.
// - Agogô greu: la segona campana, una quarta justa per sota de la gravada.
// Es tornen a generar amb: node scripts/batucada-derived.mjs
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
const peakOf = data => data.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
// Canvi de to per remostreig (interpolació lineal): també canvia la durada, com una pell o una campana més petita.
function repitch(data, semitones) {
  const ratio = 2 ** (semitones / 12), out = new Float32Array(Math.floor((data.length - 1) / ratio));
  for (let k = 0; k < out.length; k++) { const pos = k * ratio, i = Math.floor(pos), frac = pos - i; out[k] = data[i] * (1 - frac) + data[i + 1] * frac; }
  return out;
}
// Passabaixos de segon ordre (biquad RBJ, Q = 0,707), sense ressonància.
function lowpass(data, rate, hz) {
  const w = 2 * Math.PI * hz / rate, alpha = Math.sin(w) / (2 * Math.SQRT1_2), cos = Math.cos(w), a0 = 1 + alpha;
  const b0 = (1 - cos) / 2 / a0, b1 = (1 - cos) / a0, b2 = b0, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
  const out = new Float32Array(data.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return out;
}
// Surdo apagat: la mateixa gravació (amb tot el soroll natural de la pell, sense canviar-ne el to), que sona
// sencera uns mil·lisegons i després s'esmorteeix de manera progressiva, com quan la mà para la pell.
// Només s'enfosqueix una mica (barreja amb un passabaixos suau): un filtre fort la deixaria com una
// sinusoide pura, amb so de caixa de ritmes.
function muted(data, rate, { holdMs = 14, tauMs = 75, tone = .4, cutoff = 1800, lengthMs = 320 }) {
  const length = Math.min(data.length, Math.round(rate * lengthMs / 1000)), hold = rate * holdMs / 1000, tau = rate * tauMs / 1000, ease = rate * .012;
  const dark = lowpass(data, rate, cutoff), out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Corba suau: plana durant l'atac i, amb una transició de 12 ms, decaïment exponencial.
    const t = Math.max(0, i - hold), blend = Math.min(1, t / ease), smooth = blend * blend * (3 - 2 * blend);
    const damp = 1 - smooth + smooth * Math.exp(-t / tau);
    const fade = Math.min(1, (length - 1 - i) / (rate * .03));
    out[i] = (data[i] * (1 - tone) + dark[i] * tone) * damp * fade;
  }
  // Mateix pic que la gravació (només es baixa o es manté el nivell: no hi ha saturació).
  const gain = Math.min(1, peakOf(data) / (peakOf(out) || 1)) * .92;
  return out.map(v => v * gain);
}
const load = async file => readWav(await readFile(new URL(file, DIR)));
const OUTPUTS = {
  'surdo-1-apagat.wav': async () => { const { data, rate } = await load('surdo-1.wav'); return [muted(data, rate, {}), rate]; },
  'surdo-2-apagat.wav': async () => { const { data, rate } = await load('surdo-2.wav'); return [muted(data, rate, { tauMs: 70 }), rate]; },
  'surdo-3-apagat.wav': async () => { const { data, rate } = await load('surdo-3-greu.wav'); return [muted(data, rate, { tauMs: 65 }), rate]; },
  'agogo-greu.wav': async () => {
    const { data, rate } = await load('agogo.wav'), low = repitch(data, -5), gain = peakOf(data) / (peakOf(low) || 1);
    return [low.map(v => v * gain), rate];
  }
};
for (const [file, make] of Object.entries(OUTPUTS)) {
  const [samples, rate] = await make();
  await writeFile(new URL(file, DIR), writeWav(samples, rate));
  console.log(`audio/samples/${file}: ${(samples.length / rate).toFixed(3)} s, pic ${peakOf(samples).toFixed(2)}`);
}
