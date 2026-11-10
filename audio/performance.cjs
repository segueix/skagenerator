'use strict';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function createPerformance(spec) {
  if (!spec || !['ska', 'punk', 'urban'].includes(spec.style) || !Number.isFinite(spec.beat) || spec.beat <= 0
    || !Number.isFinite(spec.seconds) || spec.seconds <= 0 || spec.seconds > 180 || !Array.isArray(spec.chords)
    || !Array.isArray(spec.melody) || !Array.isArray(spec.instruments) || !spec.instruments.length
    || spec.instruments.some(i => !['guitar', 'bass', 'drums', 'trumpet', 'trombone', 'synthLead', 'synthPad', 'synthBass', 'electronicDrums'].includes(i))) throw new Error('Partitura no vàlida');
  const presets = {
    guitar: { auto: null, clean: 27, muted: 28, overdrive: 29, distortion: 30 },
    bass: { auto: null, finger: 33, pick: 34 },
    drums: { auto: null, standard: 0, rock: 16, electronic: 24 }
  };
  if (spec.timbres !== undefined && (!spec.timbres || typeof spec.timbres !== 'object' || Array.isArray(spec.timbres)
    || Object.entries(spec.timbres).some(([family, preset]) => !Object.hasOwn(presets, family) || !Object.hasOwn(presets[family], preset))))
    throw new Error('Timbres no vàlids');
  const chosen = family => presets[family][spec.timbres?.[family] || 'auto'];
  const random = rng(spec.seed), punk = spec.style === 'punk', beat = spec.beat, bar = beat * 4;
  const has = name => spec.instruments.includes(name), energy = .55 + spec.energy / 200;
  const variation = Number.isInteger(spec.variation) && spec.variation >= 0 && spec.variation <= 4 ? spec.variation : -1;
  const events = [];
  const channels = [
    { channel: 0, program: chosen('guitar') ?? (punk ? 30 : 27), pan: 42, volume: 94 },
    { channel: 1, program: chosen('guitar') ?? (punk && spec.type === 'chorus' ? 29 : 28), pan: 84, volume: 66 },
    { channel: 2, program: chosen('bass') ?? (punk ? 34 : 33), pan: 64, volume: 115 },
    { channel: 3, program: 56, pan: 50, volume: 116 },
    { channel: 4, program: 57, pan: 79, volume: 112 },
    { channel: 5, program: 81, pan: 58, volume: 106 },
    { channel: 6, program: 89, pan: 76, volume: 90 },
    { channel: 7, program: 38, pan: 64, volume: 110 },
    { channel: 10, program: 24, pan: 64, volume: 106, drums: true },
    { channel: 9, program: chosen('drums') ?? (punk ? 16 : 0), pan: 64, volume: 106, drums: true }
  ];
  function note(channel, pitch, start, duration, velocity, jitter = .004) {
    const at = Math.max(0, Math.min(spec.seconds - .02, start + (random() - .5) * jitter));
    const end = Math.min(spec.seconds - .005, at + Math.max(.025, duration));
    const midi = Math.max(0, Math.min(127, Math.round(pitch)));
    const vel = Math.max(1, Math.min(127, Math.round(velocity * energy + (random() - .5) * 9)));
    events.push({ time: at, type: 'on', channel, note: midi, velocity: vel });
    events.push({ time: end, type: 'off', channel, note: midi });
  }
  const nearest = (target, pcs, lo, hi) => {
    let result = lo, dist = Infinity;
    for (let n = lo; n <= hi; n++) if (pcs.includes(n % 12) && Math.abs(n - target) < dist) { result = n; dist = Math.abs(n - target); }
    return result;
  };
  for (let b = 0; b < spec.chords.length; b++) {
    const chord = spec.chords[b], t0 = b * bar, ending = spec.type === 'outro' && b === spec.chords.length - 1;
    const soft = spec.type === 'intro' || spec.type === 'bridge';
    const guitarPatterns = punk
      ? [[0, .5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 1, 1.5, 2, 3, 3.5], [0, .5, 1.5, 2, 2.5, 3.5], [0, .5, 1, 1.5, 2.5, 3], [0, 1, 2, 2.5, 3, 3.5]]
      : [[.5, 1.5, 2.5, 3.5], [.5, 1.5, 2.5, 3.5, 3.75], [.5, 1.5, 3.5], [.5, 1.75, 2.5, 3.5], [.5, 1.5, 2.75, 3.5]];
    const guitarIndex = spec.layers?.guitar ?? spec.groove?.guitar ?? Math.max(0, variation);
    const hits = ending ? [0] : guitarPatterns[guitarIndex % guitarPatterns.length];
    if (has('guitar')) hits.forEach((t, hit) => {
      const pitches = punk ? [chord.root + 12, chord.root + 19, chord.root + 24] : chord.notes.slice().reverse();
      const duration = ending ? bar * .75 : beat * (punk ? .4 : .22);
      pitches.forEach((pitch, k) => {
        note(0, pitch, t0 + t * beat + k * .007, duration, punk ? hit % 2 ? 76 : 100 : 90);
        // Segona guitarra: apagats a l’estrofa i doblatge obert a la tornada.
        if (punk || hit % 2 === 1) note(1, pitch, t0 + t * beat + .012 + k * .006, duration * .85, punk ? 70 : 46);
      });
    });
    if (has('bass') && !Array.isArray(spec.bassLine)) (ending ? [0] : punk ? [0, .5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 1, 2, 3]).forEach((t, k) => {
      const pitch = punk || k % 4 === 0 ? chord.root : k % 4 === 1 ? nearest(chord.root + 4, chord.pcs, chord.root, chord.root + 12) : k % 4 === 2 ? chord.root + 7 : chord.root + 12;
      note(2, pitch, t0 + t * beat, ending ? bar * .8 : beat * (punk ? .43 : .8), k % 2 ? 88 : 103, .003);
    });
    if (has('synthPad')) {
      // Coixí sostingut, a blanques, a contratemps, a negres o amb síncopa.
      const padPatterns = [[[0, 3.8]], [[0, 1.9], [2, 1.9]], [[.5, .4], [1.5, .4], [2.5, .4], [3.5, .4]], [[0, .8], [1, .8], [2, .8], [3, .8]], [[0, 1.4], [1.5, 1], [3, .9]]];
      const pad = ending ? [[0, 3.2]] : padPatterns[(spec.layers?.synthPad ?? 0) % padPatterns.length];
      for (const [t, length] of pad) chord.notes.forEach(pitch => note(6, pitch, t0 + t * beat, length * beat, soft ? 58 : 70, 0));
    }
    if (ending && has('synthLead')) note(5,chord.notes.at(-1)+12,t0,bar*.7,82,0);
    if (ending) {
      if (has('trumpet')) note(3, chord.notes.at(-1) + 12, t0 + .006, bar * .68, 84);
      if (has('trombone')) note(4, chord.root + 24, t0 + .012, bar * .7, 83);
    }
  }
  // La bateria ve escrita a la partitura; el kit acústic i l'electrònic la comparteixen.
  if (spec.drumLine !== undefined && (!Array.isArray(spec.drumLine) || spec.drumLine.some(hit => !Array.isArray(hit)
    || hit.length !== 4 || !hit.every(Number.isFinite) || hit[2] < 27 || hit[2] > 87))) throw new Error('Partitura de bateria no vàlida');
  for (const [b, t, drum, force] of spec.drumLine || []) {
    const at = (b * 4 + t) * beat, length = drum === 49 ? 1.4 : drum === 46 || drum === 51 ? beat * .45 : .09;
    if (has('drums')) note(9, drum, at, length, force, .003);
    if (has('electronicDrums')) {
      note(10, drum, at, length, force, 0);
      if (drum === 38) note(10, 39, at + .008, .1, force * .72, 0);
    }
  }
  if ((has('bass') || has('synthBass')) && Array.isArray(spec.bassLine)) {
    for (const [b,t,pitch,length,strength] of spec.bassLine)
      {
        if (has('bass')) note(2,pitch,(b*4+t)*beat,length*beat,Math.min(127,Math.round(113*strength)),.002);
        if (has('synthBass')) note(7,Math.max(24,pitch-12),(b*4+t)*beat,length*beat,Math.min(127,Math.round(105*strength)),0);
      }
  }
  for (const instrument of ['synthLead', 'trumpet', 'trombone']) {
    if (!has(instrument)) continue;
    const own = Array.isArray(spec.lines?.[instrument]), line = own ? spec.lines[instrument] : spec.melody;
    const channel = { synthLead: 5, trumpet: 3, trombone: 4 }[instrument];
    for (const [b, t, pitch, duration] of line) {
      const at = b * bar + t * beat, last = spec.type === 'outro' && b === spec.chords.length - 1;
      if (last) continue;
      // Sense capa pròpia, els metalls esperen a la segona meitat de la intro.
      if (!own && instrument !== 'synthLead' && spec.type === 'intro' && b < 2) continue;
      const chord = spec.chords[b], velocity = spec.type === 'verse' ? 65 : 89;
      if (instrument === 'synthLead') note(5, pitch, at, Math.max(.07, duration * beat - .03), spec.type === 'verse' ? 67 : 86, 0);
      else if (instrument === 'trumpet') note(3, pitch, at, Math.max(.07, duration * beat - .045), velocity, .006);
      else note(4, nearest(pitch - 12, chord.pcs, 45, 67), at + .006, Math.max(.07, duration * beat - .045) * .94, velocity - 5, .006);
    }
  }
  events.sort((a, b) => a.time - b.time || (a.type === 'off' ? 0 : 1) - (b.type === 'off' ? 0 : 1));
  return { channels, events, seconds: spec.seconds, seed: spec.seed, type: spec.type };
}
module.exports = { createPerformance };
