import { SoundBankLoader, SpessaSynthProcessor, SpessaLog } from 'spessasynth_core';
import performance from './performance.cjs';

SpessaLog.setLogLevel(false, false, false);
export function parseSoundBank(buffer) { return SoundBankLoader.fromArrayBuffer(buffer); }

// Cada secció es lliura amb una cua: la reverberació i els plats continuen
// sonant sobre l'inici de la secció següent en lloc de tallar-se en sec.
export const TAIL_SECONDS = 1.5;

// Corba de partida de cada instrument (greus, mitjos, aguts en dB), pensada
// per a una mescla de banda: baix rodó, guitarra prima i brillant, metalls
// presents. L'equalitzador de l'usuari se suma a aquesta corba.
export const EQ_PRESETS = {
  drums: [2, -2, 2], electronicDrums: [2, -1, 1], bass: [3, -2, -2], synthBass: [2, 0, -3],
  guitar: [-6, 1, 3], trumpet: [-4, 1, 2], trombone: [-2, 2, 0], sax: [-3, 2, 1], organ: [-5, 1, 1],
  synthLead: [-3, 0, 2], synthPad: [-4, 0, 1], master: [1, 0, 1]
};
export const SONG_GAIN = 10 ** (5.5 / 20);
export const EQ_BANDS = { low: 120, mid: 900, high: 6000 };
// Reverberació: el baix sec, la bateria curta, metalls i orgue amb sala.
const REVERB = { drums: 14, electronicDrums: 8, bass: 4, synthBass: 0, guitar: 30, trumpet: 40, trombone: 38, sax: 40, organ: 30, synthLead: 32, synthPad: 40 };

// Filtres biquadràtics (Robert Bristow-Johnson, «Audio EQ Cookbook»).
function biquad(type, frequency, gainDb, sampleRate, q = .8) {
  const A = 10 ** (gainDb / 40), w = 2 * Math.PI * frequency / sampleRate, cos = Math.cos(w), sin = Math.sin(w);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'peak') {
    const alpha = sin / (2 * q);
    [b0, b1, b2, a0, a1, a2] = [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
  } else {
    const alpha = sin / 2 * Math.SQRT2, root = 2 * Math.sqrt(A) * alpha, sign = type === 'low' ? 1 : -1;
    b0 = A * ((A + 1) - sign * (A - 1) * cos + root); b1 = 2 * sign * A * ((A - 1) - sign * (A + 1) * cos);
    b2 = A * ((A + 1) - sign * (A - 1) * cos - root); a0 = (A + 1) + sign * (A - 1) * cos + root;
    a1 = -2 * sign * ((A - 1) + sign * (A + 1) * cos); a2 = (A + 1) + sign * (A - 1) * cos - root;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function run(filter, x) {
  const y = filter.b0 * x + filter.b1 * filter.x1 + filter.b2 * filter.x2 - filter.a1 * filter.y1 - filter.a2 * filter.y2;
  filter.x2 = filter.x1; filter.x1 = x; filter.y2 = filter.y1; filter.y1 = y;
  return y;
}
// Equalitzador estèreo: corba de l'instrument + ajust de l'usuari.
export function createEqualizer(name, user, sampleRate) {
  const preset = EQ_PRESETS[name] || [0, 0, 0], band = user || {};
  const gains = [preset[0] + (band.low || 0), preset[1] + (band.mid || 0), preset[2] + (band.high || 0)];
  const gain = 10 ** ((band.volume || 0) / 20);
  if (gains.every(g => g === 0) && gain === 1) return null;
  const chain = () => [biquad('low', EQ_BANDS.low, gains[0], sampleRate), biquad('peak', EQ_BANDS.mid, gains[1], sampleRate), biquad('high', EQ_BANDS.high, gains[2], sampleRate)];
  const sides = [chain(), chain()];
  return {
    gain,
    process(side, x) { const [low, mid, high] = sides[side]; return run(high, run(mid, run(low, x))) * gain; }
  };
}

export async function renderSampledPart(bank, spec, sampleRate = 44100, options = {}) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Freqüència de mostreig no vàlida');
  const score = performance.createPerformance(spec);
  const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
  try {
    synth.soundBankManager.addSoundBank(bank, 'generaluser');
    await synth.ready;
    for (const patch of score.channels) {
      if (patch.drums) synth.midiChannels[patch.channel].setDrums(true);
      if (patch.bank) synth.controllerChange(patch.channel, 0, patch.bank);
      synth.programChange(patch.channel, patch.program);
      synth.controllerChange(patch.channel, 7, patch.volume);
      synth.controllerChange(patch.channel, 10, patch.pan);
      // L'enviament a la reverberació segueix el volum de l'instrument.
      const level = Math.min(1, 10 ** ((score.mix[patch.instrument]?.volume || 0) / 20));
      synth.controllerChange(patch.channel, 91, Math.round((REVERB[patch.instrument] ?? 20) * level));
      synth.controllerChange(patch.channel, 93, 0);
    }
    const body = Math.round(score.seconds * sampleRate), tail = Math.round(TAIL_SECONDS * sampleRate);
    const length = body + tail, left = new Float32Array(length), right = new Float32Array(length);
    // Es capta la sortida seca de cada canal i s'hi aplica el seu equalitzador.
    // La diferència (equalitzat − sec) se suma a la mescla, que ja conté la
    // reverberació: així l'equalitzador no deixa la sala sense efecte.
    const BLOCK = 128, eqs = new Map(), dummy = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
    for (const patch of score.channels) {
      const eq = createEqualizer(patch.instrument, score.mix[patch.instrument], sampleRate);
      if (eq) eqs.set(patch.channel, eq);
    }
    const outputs = Array.from({ length: 16 }, (_, channel) => eqs.has(channel) ? [new Float32Array(BLOCK), new Float32Array(BLOCK)] : dummy);
    const blockL = new Float32Array(BLOCK), blockR = new Float32Array(BLOCK);
    let event = 0, offset = 0, lastProgress = 0;
    const scheduled = score.events.map(e => ({ ...e, frame: Math.round(e.time * sampleRate) }));
    while (offset < length) {
      if (options.cancelled?.()) throw new Error('cancelled');
      while (event < scheduled.length && scheduled[event].frame <= offset) {
        const e = scheduled[event++];
        if (e.type === 'on') synth.noteOn(e.channel, e.note, e.velocity);
        else if (e.type === 'off') synth.noteOff(e.channel, e.note);
        else if (e.type === 'cc') synth.controllerChange(e.channel, e.controller, e.value);
        else if (e.type === 'pitch') synth.pitchWheel(e.channel, e.value);
      }
      const next = scheduled[event]?.frame ?? length;
      const count = Math.min(BLOCK, length - offset, Math.max(1, next - offset));
      blockL.fill(0); blockR.fill(0);
      for (const channel of eqs.keys()) { outputs[channel][0].fill(0); outputs[channel][1].fill(0); }
      synth.process(blockL, blockR, 0, count, eqs.size ? outputs : undefined);
      for (const [channel, eq] of eqs) {
        const [dryL, dryR] = outputs[channel];
        for (let i = 0; i < count; i++) {
          blockL[i] += eq.process(0, dryL[i]) - dryL[i];
          blockR[i] += eq.process(1, dryR[i]) - dryR[i];
        }
      }
      left.set(blockL.subarray(0, count), offset); right.set(blockR.subarray(0, count), offset);
      offset += count;
      if (offset - lastProgress > sampleRate * .5) { lastProgress = offset; options.onProgress?.(offset / length); }
    }
    // Equalitzador de la mescla (sense el volum, que s'aplica al final).
    const master = score.mix.master || {}, masterEq = createEqualizer('master', { ...master, volume: 0 }, sampleRate);
    if (masterEq) for (let i = 0; i < length; i++) { left[i] = masterEq.process(0, left[i]); right[i] = masterEq.process(1, right[i]); }
    if (options.raw) return [left, right]; // Només per a proves: sense dinàmica ni nivell.
    // Compressor de bus suau (2,5:1) per cohesionar la banda.
    const attack = Math.exp(-1 / (.012 * sampleRate)), release = Math.exp(-1 / (.3 * sampleRate)), threshold = .16, ratio = 2.2;
    let envelope = 0, peak = 0;
    for (let i = 0; i < length; i++) {
      if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw new Error('El motor ha produït àudio no vàlid');
      const level = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      envelope = level > envelope ? attack * envelope + (1 - attack) * level : release * envelope + (1 - release) * level;
      const reduction = envelope > threshold ? (threshold * (envelope / threshold) ** (1 / ratio)) / envelope : 1;
      left[i] *= reduction; right[i] *= reduction;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    // Nivell fix per a tota la cançó: cada secció rep el mateix guany, de manera
    // que un instrument que passa d'una secció a l'altra no canvia de volum. Les
    // seccions plenes sonen més fortes perquè hi toquen més instruments.
    const gain = SONG_GAIN * 10 ** ((master.volume || 0) / 20);
    const fade = Math.round(.4 * sampleRate);
    const soft = x => { const a = Math.abs(x); return a < .82 ? x : Math.sign(x) * (.82 + .11 * Math.tanh((a - .82) / .11)); };
    for (let i = 0; i < length; i++) {
      const envelopeGain = gain * Math.min(1, i / 64, (length - 1 - i) / fade);
      left[i] = soft(left[i] * envelopeGain); right[i] = soft(right[i] * envelopeGain);
    }
    options.onProgress?.(1);
    return [left, right];
  } finally {
    // destroy() també buida els bancs que encara pertanyen al processador.
    // Desvincula el banc compartit perquè la secció següent conservi les mostres.
    synth.soundBankManager.deleteSoundBank('generaluser', false);
    synth.destroy();
  }
}
