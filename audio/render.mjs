import { SoundBankLoader, SpessaSynthProcessor, SpessaLog } from 'spessasynth_core';
import performance from './performance.cjs';

SpessaLog.setLogLevel(false, false, false);
export function parseSoundBank(buffer) { return SoundBankLoader.fromArrayBuffer(buffer); }

// Cada secció es lliura amb una cua: la reverberació i els plats continuen
// sonant sobre l'inici de la secció següent en lloc de tallar-se en sec.
export const TAIL_SECONDS = 1.5;
export async function renderSampledPart(bank, spec, sampleRate = 44100, options = {}) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Freqüència de mostreig no vàlida');
  const score = performance.createPerformance(spec);
  const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
  try {
    synth.soundBankManager.addSoundBank(bank, 'generaluser');
    await synth.ready;
    for (const patch of score.channels) {
      if (patch.drums) synth.midiChannels[patch.channel].setDrums(true);
      synth.programChange(patch.channel, patch.program);
      synth.controllerChange(patch.channel, 7, patch.volume);
      synth.controllerChange(patch.channel, 10, patch.pan);
      synth.controllerChange(patch.channel, 91, patch.drums ? 12 : 27);
      synth.controllerChange(patch.channel, 93, 0);
    }
    const body = Math.round(score.seconds * sampleRate), tail = Math.round(TAIL_SECONDS * sampleRate);
    const length = body + tail, left = new Float32Array(length), right = new Float32Array(length);
    let event = 0, offset = 0, lastProgress = 0;
    const scheduled = score.events.map(e => ({ ...e, frame: Math.round(e.time * sampleRate) }));
    while (offset < length) {
      if (options.cancelled?.()) throw new Error('cancelled');
      while (event < scheduled.length && scheduled[event].frame <= offset) {
        const e = scheduled[event++];
        if (e.type === 'on') synth.noteOn(e.channel, e.note, e.velocity); else synth.noteOff(e.channel, e.note);
      }
      const next = scheduled[event]?.frame ?? length;
      const count = Math.min(128, length - offset, Math.max(1, next - offset));
      synth.process(left, right, offset, count); offset += count;
      if (offset - lastProgress > sampleRate * .5) { lastProgress = offset; options.onProgress?.(offset / length); }
    }
    let peak = 0;
    for (let i = 0; i < length; i++) {
      if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw new Error('El motor ha produït àudio no vàlid');
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    // Nivell: una secció plena queda prop del màxim i una de buida, més avall,
    // però només a mig camí. Així la tornada creix sense que la intro es perdi.
    const gain = peak > 0 ? Math.min(.93, .9 * Math.sqrt(peak / .42)) / peak : 1;
    const fade = Math.round(.4 * sampleRate);
    for (let i = 0; i < length; i++) {
      const envelope = Math.min(1, i / 64, (length - 1 - i) / fade);
      left[i] *= gain * envelope; right[i] *= gain * envelope;
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
