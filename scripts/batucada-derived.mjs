// Mostres derivades del kit de batucada, fetes a partir de les gravacions (audio/samples):
// - Surdo apagat («abafado»): el músic atura la pell amb la mà. Es conserva l'atac de la maceta i,
//   després, la pell s'atura de pressa (decaïment exponencial), els harmònics alts s'apaguen
//   (passabaixos que entra després de l'atac) i el to puja una mica (la mà tensa la pell).
//   Tot són operacions lineals: no hi ha saturació ni distorsió.
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
// Surdo apagat: atac intacte (attackMs), després la pell s'atura (tau) i el so s'enfosqueix (passabaixos).
function muted(data, rate, { attackMs = 4, tauMs = 48, cutoff = 480, semitones = .6, lengthMs = 220, click = .55 }) {
  const source = repitch(data, semitones), attack = Math.round(rate * attackMs / 1000), length = Math.min(source.length, Math.round(rate * lengthMs / 1000));
  const dark = lowpass(source, rate, cutoff), out = new Float32Array(length), blend = Math.round(rate * .006);
  for (let i = 0; i < length; i++) {
    // De la pell oberta a l'apagada; fins i tot l'atac és una mica fosc (la mà ja és a la pell).
    const mix = Math.max(1 - click, Math.min(1, (i - attack) / blend));
    const decay = i < attack ? 1 : Math.exp(-(i - attack) / (rate * tauMs / 1000));
    const fade = Math.min(1, (length - 1 - i) / (rate * .02));
    out[i] = (source[i] * (1 - mix) + dark[i] * mix) * decay * fade;
  }
  // Mateix pic que la gravació (només es baixa o es manté el nivell: no hi ha saturació).
  const gain = Math.min(1, peakOf(data) / (peakOf(out) || 1)) * .92;
  return out.map(v => v * gain);
}
const load = async file => readWav(await readFile(new URL(file, DIR)));
const OUTPUTS = {
  'surdo-1-apagat.wav': async () => { const { data, rate } = await load('surdo-1.wav'); return [muted(data, rate, { cutoff: 460 }), rate]; },
  'surdo-2-apagat.wav': async () => { const { data, rate } = await load('surdo-2.wav'); return [muted(data, rate, { cutoff: 430, click: .4 }), rate]; },
  'surdo-3-apagat.wav': async () => { const { data, rate } = await load('surdo-3-greu.wav'); return [muted(data, rate, { cutoff: 420, tauMs: 42 }), rate]; },
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
