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
  vocal: [-4, 3, 2],
  guitar2: [-6, 1, 4], guitar3: [-5, 2, 3],
  drums: [2, -2, 2], electronicDrums: [2, -1, 1], bass: [3, -2, -2], synthBass: [2, 0, -3],
  guitar: [-6, 1, 3], trumpet: [-4, 2, 2], trombone: [-3, 3, 1], sax: [-5, 3, 3], organ: [-5, 1, 1], piano: [-3, 0, 3],
  synthLead: [-3, 0, 2], synthPad: [-4, 0, 1], master: [1, 0, 1]
};
// Presència de la trompeta (gravat VSCO i alternatives GM): el volum MIDI
// ja és gairebé al màxim, així que es reforça el senyal sec sense saturar-lo.
// El compressor i el limitador final continuen protegint la mescla.
// La guitarra solista (punteig) quedava tapada per les guitarres rítmiques distorsionades.
export const INSTRUMENT_GAIN_DB = { trumpet: 3, guitar3: 3 };
export const SONG_GAIN = 10 ** (5.5 / 20);
export const EQ_BANDS = { low: 120, mid: 900, high: 6000 };
// Reverberació: el baix sec, la bateria curta, metalls i orgue amb sala.
export const REVERB = { vocal: 34, guitar2: 30, guitar3: 34, drums: 14, electronicDrums: 8, bass: 4, synthBass: 0, guitar: 30, trumpet: 58, trombone: 38, sax: 40, organ: 30, piano: 26, synthLead: 32, synthPad: 40 };

// Filtres biquadràtics (Robert Bristow-Johnson, «Audio EQ Cookbook»).
function biquad(type, frequency, gainDb, sampleRate, q = .8) {
  const A = 10 ** (gainDb / 40), w = 2 * Math.PI * frequency / sampleRate, cos = Math.cos(w), sin = Math.sin(w);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass' || type === 'highpass') {
    const alpha = sin / (2 * q), lp = type === 'lowpass';
    [b0, b1, b2] = lp ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
  } else if (type === 'peak') {
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
  const gain = 10 ** (((band.volume || 0) + (INSTRUMENT_GAIN_DB[name] || 0)) / 20);
  if (gains.every(g => g === 0) && gain === 1) return null;
  const chain = () => [biquad('low', EQ_BANDS.low, gains[0], sampleRate), biquad('peak', EQ_BANDS.mid, gains[1], sampleRate), biquad('high', EQ_BANDS.high, gains[2], sampleRate)];
  const sides = [chain(), chain()];
  return {
    gain,
    process(side, x) { const [low, mid, high] = sides[side]; return run(high, run(mid, run(low, x))) * gain; }
  };
}

// Volums additius de la base: independents dels EQ de cada secció i
// comuns a bateria i baix acústics i electrònics.
export function baseVolumeDb(score, instrument) {
  const family = instrument === 'drums' || instrument === 'electronicDrums' ? 'drums'
    : instrument === 'bass' || instrument === 'synthBass' ? 'bass' : null;
  return family ? (score.baseVolume?.[family] || 0) : 0;
}

// ── Efectes de guitarra ───────────────────────────────────────────────
// Cadena de pedal i amplificador: filtre d'entrada → guany → saturació (amb
// sobremostreig ×2 per evitar sorolls digitals) → pantalla d'altaveu (pas alt,
// to, pas baix) → nivell compensat perquè sonin tan fort com la guitarra neta.
const FX = {
  boost: { gain: [6, 18], curve: x => Math.tanh(x), tight: 80, mid: 0, scoop: 0, cab: 9000 },
  tape: { gain: [12, 28], curve: x => x / (1 + Math.abs(x) * .6), tight: 60, mid: 0, scoop: 0, cab: 7000 },
  crunch: { gain: [30, 46], curve: x => Math.tanh(x), tight: 120, mid: 3, scoop: 0, cab: 6000 },
  overdrive: { gain: [34, 52], curve: x => x > 0 ? Math.tanh(x) : Math.tanh(x * .7) / .7 * .85, tight: 200, mid: 8, scoop: 0, cab: 5500 },
  distortion: { gain: [38, 58], curve: x => 2 / Math.PI * Math.atan(x * 1.6), tight: 150, mid: 4, scoop: 0, cab: 5000 },
  metal: { gain: [46, 66], curve: x => Math.tanh(x * 1.4), tight: 220, mid: 2, scoop: -7, cab: 6000 },
  fuzz: { gain: [48, 68], curve: x => { const h = Math.max(-.62, Math.min(.62, x)); return h * .8 + Math.abs(Math.tanh(x)) * .25; }, tight: 90, mid: 0, scoop: 0, cab: 4200 },
  lofi: { gain: [10, 24], curve: x => Math.tanh(x), tight: 120, mid: 0, scoop: 0, cab: 4500, bits: true },
  // Horror punk a l'estil dels Misfits: distorsió «serra mecànica» molt saturada,
  // amb un punt de fuzz (part rectificada que fa brunzir), mitjos plens (sense el
  // buit del metal), greus ajustats i presència a 2,5 kHz per tallar la mescla.
  horrorpunk: { gain: [40, 58], curve: x => { const soft = Math.tanh(x * 1.2), hard = Math.max(-.8, Math.min(.8, x)); return .6 * soft + .4 * hard + .08 * Math.abs(soft); },
    tight: 140, mid: 5, scoop: 0, presence: 4, cab: 5200 },
  // Quatre variants ajustades a una gravació de referència d'horror punk (guitarres
  // fosques i gruixudes, poca presència a 2 kHz i brunzit a 3,5-6 kHz). Comparant
  // l'espectre de la banda (bateria, baix i guitarres) amb la referència, l'efecte
  // original quedava a 3,0 dB de mitjana; aquestes, entre 1,3 i 2,2 dB.
  // A: la més fidel a l'espectre de la referència.
  horrorpunkFidel: { gain: [40, 58], curve: x => { const soft = Math.tanh(x * 1.2), hard = Math.max(-.8, Math.min(.8, x)); return .6 * soft + .4 * hard + .08 * Math.abs(soft); },
    tight: 140, mid: 8, scoop: 0, presence: -5, presenceHz: 1900, fizz: [3400, 5], cab: 5600, level: 4 },
  // B: fuzz retallat amb part rectificada, brunzidor i agressiu.
  horrorpunkFuzz: { gain: [48, 66], curve: x => { const h = Math.max(-.6, Math.min(.6, x * 1.1)); return h * .85 + Math.abs(Math.tanh(x)) * .22; },
    tight: 160, mid: 6, scoop: 0, presence: -3, presenceHz: 1900, fizz: [3800, 5], cab: 5800, level: 4 },
  // C: doble saturació, paret de guitarres gruixuda i fosca.
  horrorpunkGruixut: { gain: [44, 62], curve: x => Math.tanh(Math.tanh(x * 1.6) * 2.2) * .95,
    tight: 90, mid: 7, scoop: 0, presence: -6, presenceHz: 1900, body: [230, 4], fizz: [3400, 3], cab: 4600, level: 4 },
  // D: menys guany i més mitjos: garatge cru, s'hi senten més les notes.
  horrorpunkGaratge: { gain: [28, 44], curve: x => x > 0 ? Math.tanh(x) : Math.tanh(x * .8) / .8 * .9,
    tight: 150, mid: 10, scoop: 0, presence: -5, presenceHz: 1900, body: [900, 2], fizz: [3600, 7], cab: 6000, level: 4 }
};
export const GUITAR_FX_TYPES = Object.keys(FX);
export const GUITAR_FX_DEFS = FX;
export function createGuitarFx(fx, sampleRate) {
  const def = fx && FX[fx.type];
  if (!def) return null;
  const drive = fx.drive / 100, tone = fx.tone / 100;
  const pre = 10 ** ((def.gain[0] + (def.gain[1] - def.gain[0]) * drive) / 20);
  const cutoff = Math.min(sampleRate * .45, def.cab * (.45 + tone * 1.1));
  const side = () => ({
    tight: biquad('highpass', def.tight, 0, sampleRate, .7), mid: biquad('peak', 720, def.mid, sampleRate, .9),
    scoop: biquad('peak', 500, def.scoop, sampleRate, .7), low: biquad('highpass', 90, 0, sampleRate, .7),
    presence: biquad('peak', def.presenceHz || 2500, def.presence || 0, sampleRate, .9),
    // Cos (greus-mitjos després de la saturació) i brunzit (aguts després de la pantalla).
    body: biquad('peak', def.body?.[0] || 220, def.body?.[1] || 0, sampleRate, .8),
    fizz: biquad('high', def.fizz?.[0] || 4000, def.fizz?.[1] || 0, sampleRate),
    cab1: biquad('lowpass', cutoff, 0, sampleRate, .7), cab2: biquad('lowpass', cutoff * 1.15, 0, sampleRate, .6),
    last: 0, hold: 0, count: 0, inLevel: 1e-6, outLevel: 1e-6
  });
  const sides = [side(), side()], smooth = Math.exp(-1 / (.06 * sampleRate)), level = 10 ** ((def.level || 0) / 20);
  const bitStep = 2 / (2 ** (8 - drive * 4)), crushEvery = Math.max(1, Math.round(sampleRate / (8000 + tone * 14000)));
  return {
    reverb: def.gain[1] > 42 ? .3 : .6,
    process(index, x) {
      const s = sides[index];
      let y = run(s.mid, run(s.tight, x)) * pre;
      // Sobremostreig ×2: la mostra intermèdia redueix l'aliasing de la saturació.
      const mid = (s.last + y) / 2; s.last = y;
      y = (def.curve(mid) + def.curve(y)) / 2;
      if (def.bits) {
        if (s.count++ % crushEvery === 0) s.hold = Math.round(y / bitStep) * bitStep;
        y = s.hold;
      }
      y = run(s.cab2, run(s.cab1, run(s.low, run(s.presence, run(s.scoop, def.body ? run(s.body, y) : y)))));
      if (def.fizz) y = run(s.fizz, y);
      // Nivell compensat: segueix la sonoritat de la guitarra sense efecte.
      s.inLevel = smooth * s.inLevel + (1 - smooth) * x * x;
      s.outLevel = smooth * s.outLevel + (1 - smooth) * y * y;
      return y * Math.min(8, Math.sqrt(s.inLevel / s.outLevel)) * level;
    }
  };
}

// ── Efectes de color (vents i guitarres) ──────────────────────────────
// El so de l'instrument passa per un aparell: filtres de banda (pas alt i pas
// baix de 12 dB/oct), la ressonància de l'altaveu o de la botzina i una
// saturació pròpia. El nivell es compensa com als efectes de guitarra i la
// reverberació es redueix (l'aparell sona sec i a prop).
const COLORS = {
  // Ràdio de vàlvules: banda de 320 Hz a 3,4 kHz i saturació suau.
  radio: { hp: 320, lp: 3400, peak: [1400, 5, 1.1], drive: 2.2, curve: x => Math.tanh(x), reverb: .35 },
  // Megàfon: molt estret, botzina a 2 kHz i saturació dura.
  megaphone: { hp: 650, lp: 4200, peak: [2000, 9, 1.4], drive: 4, curve: x => Math.max(-.7, Math.min(.7, x)) * 1.2, reverb: .25 },
  // Telèfon: de 420 Hz a 2,9 kHz, prim i sec.
  telephone: { hp: 420, lp: 2900, peak: [1800, 3, 1], drive: 1.6, curve: x => Math.tanh(x), reverb: .15 },
  // Gramòfon (disc antic): sense greus ni aguts, botzina a 1 kHz.
  gramophone: { hp: 220, lp: 4800, peak: [1000, 6, .8], drive: 1.8, curve: x => x / (1 + Math.abs(x)), reverb: .5 }
};
export const COLOR_TYPES = Object.keys(COLORS);
export function createColorFx(type, sampleRate) {
  const def = COLORS[type];
  if (!def) return null;
  const lp = Math.min(sampleRate * .45, def.lp);
  const side = () => ({
    hp1: biquad('highpass', def.hp, 0, sampleRate, .7), hp2: biquad('highpass', def.hp, 0, sampleRate, .7),
    lp1: biquad('lowpass', lp, 0, sampleRate, .7), lp2: biquad('lowpass', lp, 0, sampleRate, .7),
    peak: biquad('peak', def.peak[0], def.peak[1], sampleRate, def.peak[2]), inLevel: 1e-6, outLevel: 1e-6
  });
  const sides = [side(), side()], smooth = Math.exp(-1 / (.06 * sampleRate));
  return {
    reverb: def.reverb,
    process(index, x) {
      const s = sides[index];
      let y = run(s.peak, run(s.hp2, run(s.hp1, x)));
      y = run(s.lp2, run(s.lp1, def.curve(y * def.drive)));
      s.inLevel = smooth * s.inLevel + (1 - smooth) * x * x;
      s.outLevel = smooth * s.outLevel + (1 - smooth) * y * y;
      return y * Math.min(8, Math.sqrt(s.inLevel / s.outLevel));
    }
  };
}
const colorFor = (score, patch) => patch.clipColor ?? score.colors?.[patch.instrument];

// Efecte d'un canal: el de l'instrument, amb el retoc propi de la segona presa d'una guitarra doblada.
function fxFor(score, patch) {
  const fx = patch.clipFx ?? score.fx?.[patch.instrument];
  if (!fx || !patch.fxTweak) return fx;
  const clampPct = v => Math.max(0, Math.min(100, v));
  return { ...fx, drive: clampPct(fx.drive + patch.fxTweak.drive), tone: clampPct(fx.tone + patch.fxTweak.tone) };
}
export async function renderSampledPart(bank, spec, sampleRate = 44100, options = {}) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Freqüència de mostreig no vàlida');
  const score = performance.createPerformance(spec);
  const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
  try {
    synth.soundBankManager.addSoundBank(bank, 'generaluser');
    // Banc addicional (bateries i baixos gravats que es baixen a part).
    if (options.extra) synth.soundBankManager.addSoundBank(options.extra, 'extra');
    await synth.ready;
    // La melodia de veu fa servir un canal més enllà dels 16 del MIDI.
    while (synth.midiChannels.length <= Math.max(...score.channels.map(c => c.channel))) synth.createMIDIChannel();
    for (const patch of score.channels) {
      if (patch.drums) synth.midiChannels[patch.channel].setDrums(true);
      if (patch.bank) synth.controllerChange(patch.channel, 0, patch.bank);
      synth.programChange(patch.channel, patch.program);
      // Bateria més greu: s'afina cada peça del kit (paràmetres de bateria GS/XG).
      if (patch.drums && patch.tune) for (const param of synth.midiChannels[patch.channel].drumParams) param.pitchCoarse = patch.tune;
      synth.controllerChange(patch.channel, 7, patch.volume);
      synth.controllerChange(patch.channel, 10, patch.pan);
      // L'enviament a la reverberació segueix el volum de l'instrument.
      const level = Math.min(1, 10 ** (((score.mix[patch.instrument]?.volume || 0) + baseVolumeDb(score, patch.instrument)) / 20));
      // Amb distorsió, menys sala: la reverberació surt de la guitarra neta.
      const wet = (createGuitarFx(fxFor(score, patch), sampleRate)?.reverb ?? 1) * (createColorFx(colorFor(score, patch), sampleRate)?.reverb ?? 1);
      synth.controllerChange(patch.channel, 91, Math.round((REVERB[patch.instrument] ?? 20) * level * wet));
      synth.controllerChange(patch.channel, 93, 0);
    }
    const body = Math.round(score.seconds * sampleRate), tail = Math.round(TAIL_SECONDS * sampleRate);
    const length = body + tail, left = new Float32Array(length), right = new Float32Array(length);
    // Es capta la sortida seca de cada canal i s'hi aplica el seu equalitzador.
    // La diferència (equalitzat − sec) se suma a la mescla, que ja conté la
    // reverberació: així l'equalitzador no deixa la sala sense efecte.
    const BLOCK = 128, eqs = new Map(), dummy = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
    for (const patch of score.channels) {
      // La segona veu de vent amb saxo fa servir la corba del saxo.
      // gainDb: guany fix del so triat (calibrat perquè tots els kits i baixos sonin al mateix nivell).
      const totalTrim = (patch.gainDb || 0) + baseVolumeDb(score, patch.instrument);
      const user = totalTrim ? { ...(score.mix[patch.instrument] || {}), volume: (score.mix[patch.instrument]?.volume || 0) + totalTrim } : score.mix[patch.instrument];
      const eq = createEqualizer(patch.instrument === 'trombone' && patch.bank === 2 && patch.program === 66 ? 'sax' : patch.instrument, user, sampleRate);
      // Cadena: efecte de guitarra → efecte de color → equalitzador.
      const chain = [createGuitarFx(fxFor(score, patch), sampleRate), createColorFx(colorFor(score, patch), sampleRate), eq].filter(Boolean);
      if (chain.length) eqs.set(patch.channel, chain.length === 1 ? chain[0] : { process: (side, x) => chain.reduce((y, stage) => stage.process(side, y), x) });
    }
    const outputs = Array.from({ length: synth.midiChannels.length }, (_, channel) => eqs.has(channel) ? [new Float32Array(BLOCK), new Float32Array(BLOCK)] : dummy);
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
    if (options.extra) synth.soundBankManager.deleteSoundBank('extra', false);
    synth.destroy();
  }
}
