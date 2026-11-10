'use strict';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function createPerformance(spec) {
  if (!spec || !['ska', 'punk', 'urban'].includes(spec.style) || !Number.isFinite(spec.beat) || spec.beat <= 0
    || !Number.isFinite(spec.seconds) || spec.seconds <= 0 || spec.seconds > 180 || !Array.isArray(spec.chords)
    || !Array.isArray(spec.melody) || !Array.isArray(spec.instruments) || !spec.instruments.length
    || spec.instruments.some(i => !['guitar', 'bass', 'drums', 'trumpet', 'trombone', 'synthLead', 'synthPad', 'synthBass', 'electronicDrums', 'sax', 'organ', 'guitar2', 'guitar3'].includes(i))) throw new Error('Partitura no vàlida');
  // [banc, programa]. Banc 2: instruments gravats nota a nota (VSCO 2 CE i
  // FreePats); banc 3: staccato de VSCO; banc 1: variacions GS; banc 0: GM.
  // Kit 64: Muldjord (gravat). La resta són sons de GeneralUser GS.
  const presets = {
    guitar: { auto: null, clean: [2, 27], cleanGm: [0, 27], muted: [0, 28], overdrive: [0, 29], distortion: [0, 30] },
    bass: { auto: null, finger: [2, 33], pick: [2, 34], fingerGm: [0, 33], pickGm: [0, 34] },
    drums: { auto: null, real: [0, 64], standard: [0, 0], rock: [0, 16], electronic: [0, 24], jazz: [0, 32], room: [0, 8], brush: [0, 40] },
    trumpet: { auto: null, gm: [0, 56], bright: [1, 56], muted: [0, 59] },
    trombone: { auto: null, gm: [0, 57], warm: [1, 57] }
  };
  // Les guitarres 2 i 3 tenen els mateixos sons que la primera.
  presets.guitar2 = presets.guitar; presets.guitar3 = presets.guitar;
  if (spec.timbres !== undefined && (!spec.timbres || typeof spec.timbres !== 'object' || Array.isArray(spec.timbres)
    || Object.entries(spec.timbres).some(([family, preset]) => !Object.hasOwn(presets, family) || !Object.hasOwn(presets[family], preset))))
    throw new Error('Timbres no vàlids');
  const chosen = family => presets[family][spec.timbres?.[family] || 'auto'];
  const random = rng(spec.seed), punk = spec.style === 'punk', beat = spec.beat, bar = beat * 4;
  const has = name => spec.instruments.includes(name), energy = .55 + spec.energy / 200;
  const variation = Number.isInteger(spec.variation) && spec.variation >= 0 && spec.variation <= 4 ? spec.variation : -1;
  const events = [];
  const patch = (channel, [bank, program], pan, volume) => ({ channel, bank, program, pan, volume });
  const realBrass = { 3: !chosen('trumpet'), 4: !chosen('trombone') };
  const instrumentOf = { 14: 'guitar2', 15: 'guitar3', 12: 'trumpet', 13: 'trombone', 0: 'guitar', 1: 'guitar', 2: 'bass', 3: 'trumpet', 4: 'trombone', 5: 'synthLead', 6: 'synthPad', 7: 'synthBass', 8: 'sax', 9: 'drums', 10: 'electronicDrums', 11: 'organ' };
  const channels = [
    patch(0, chosen('guitar') ?? (punk ? [0, 30] : [2, 27]), 42, 94),
    patch(1, chosen('guitar') ?? (punk && spec.type === 'chorus' ? [0, 29] : [0, 28]), 84, 66),
    patch(2, chosen('bass') ?? (punk ? [2, 34] : [2, 33]), 64, 115),
    patch(3, chosen('trumpet') ?? [2, 56], 50, 116),
    patch(4, chosen('trombone') ?? [2, 57], 79, 112),
    // Staccato gravat per a les notes curtes de trompeta i trombó.
    patch(12, [3, 56], 50, 116), patch(13, [3, 57], 79, 127),
    patch(14, chosen('guitar2') ?? (punk ? [0, 30] : [2, 27]), 96, 84), patch(15, chosen('guitar3') ?? [2, 27], 30, 80),
    patch(8, [2, 66], 30, 86),
    { channel: 11, program: 16, pan: 92, volume: 84 },
    { channel: 5, program: 81, pan: 58, volume: 106 },
    { channel: 6, program: 89, pan: 76, volume: 90 },
    { channel: 7, program: 38, pan: 64, volume: 110 },
    { channel: 10, program: 24, pan: 64, volume: 106, drums: true },
    { ...patch(9, chosen('drums') ?? [0, 64], 64, 106), drums: true }
  ];
  // Un instrument amb trams només sona dins d'aquests compassos.
  function audible(channel, start) {
    const list = spec.ranges?.[instrumentOf[channel]];
    if (!list) return true;
    const at = start / bar + 1e-6;
    return list.some(([from, to]) => at >= from && at < to);
  }
  function note(channel, pitch, start, duration, velocity, jitter = .004, exact = false) {
    if (!audible(channel, start)) return;
    const at = Math.max(0, Math.min(spec.seconds - .02, start + (random() - .5) * jitter));
    const end = Math.min(spec.seconds - .005, at + Math.max(.025, duration));
    const midi = Math.max(0, Math.min(127, Math.round(pitch)));
    const vel = Math.max(1, Math.min(127, Math.round(exact ? velocity : velocity * energy + (random() - .5) * 9)));
    events.push({ time: at, type: 'on', channel, note: midi, velocity: vel });
    events.push({ time: end, type: 'off', channel, note: midi });
  }
  const control = (channel, time, controller, value) =>
    events.push({ time: Math.max(0, Math.min(spec.seconds - .01, time)), type: 'cc', channel, controller, value: Math.round(Math.max(0, Math.min(127, value))) });
  const bend = (channel, time, value) =>
    events.push({ time: Math.max(0, Math.min(spec.seconds - .01, time)), type: 'pitch', channel, value: Math.round(Math.max(0, Math.min(16383, value))) });
  // Articulació de metalls: entrada amb una lleugera pujada d'afinació,
  // crescendo d'expressió a les notes llargues i vibrato al final.
  function horn(channel, pitch, start, duration, velocity, accent) {
    // Les notes curtes dels metalls gravats fan servir les mostres d'staccato.
    if (realBrass[channel] && duration < .3) channel += 9;
    const at = Math.max(0, start), long = duration > beat * .9;
    bend(channel, at - .002, accent && random() < .55 ? 8192 - 700 - random() * 500 : 8192);
    if (accent) for (let k = 1; k <= 4; k++) bend(channel, at + k * .016, 8192 - (4 - k) * 260 * (1 - k / 5));
    // Crescendo subtil a les notes llargues (uns 2 dB): més fort sonava com si la nota s'apagués.
    control(channel, at - .002, 11, long ? 112 : 124);
    if (long) for (let k = 1; k <= 3; k++) control(channel, at + duration * .12 * k, 112 + k * 5);
    control(channel, at - .002, 1, 0);
    if (duration > .55) { control(channel, at + duration * .45, 1, 28); control(channel, at + duration * .7, 1, 46); }
    // Els metalls gravats tenen dues dinàmiques (canvi a 64). La força s'allunya
    // d'aquesta frontera perquè la trompeta no salti de mostra nota a nota.
    let vel = Math.round(velocity * energy);
    vel = (vel < 64 ? Math.min(vel, 58) : Math.max(vel, 70)) + Math.round((random() - .5) * 4);
    note(channel, pitch, start, duration, vel, .006, true);
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
    // Guitarra 2: rítmica aguda (acords una octava amunt) amb el seu propi patró.
    if (has('guitar2')) {
      const index = ((spec.layers?.guitar2 ?? 2) + 2) % guitarPatterns.length;
      (ending ? [0] : guitarPatterns[index]).forEach((t, hit) => {
        const pitches = punk ? [chord.root + 24, chord.root + 31] : chord.notes.map(n => n + 12).reverse();
        pitches.forEach((pitch, k) => note(14, pitch, t0 + t * beat + .009 + k * .006, ending ? bar * .7 : beat * (punk ? .35 : .18), punk ? hit % 2 ? 70 : 88 : 80));
      });
    }
    // Guitarra 3: arpegis i punteig sobre l'acord.
    if (has('guitar3')) {
      const tones = [...chord.notes, chord.notes[0] + 12].map(n => n + 12), index = (spec.layers?.guitar3 ?? 0) % 5;
      const shapes = [
        [[0, 0], [.5, 1], [1, 2], [1.5, 3], [2, 0], [2.5, 1], [3, 2], [3.5, 3]],
        [[0, 3], [.5, 2], [1, 1], [1.5, 0], [2, 3], [2.5, 2], [3, 1], [3.5, 0]],
        [[0, 0], [.5, 2], [1, 1], [1.5, 3], [2, 2], [2.5, 1], [3, 3], [3.5, 2]],
        [[0, 0], [.75, 2], [1.5, 3], [2.5, 1], [3, 2]],
        [[.5, 1], [.75, 2], [1.5, 1], [2.5, 3], [2.75, 2], [3.5, 1]]];
      for (const [t, k] of ending ? [[0, 0]] : shapes[index]) note(15, tones[k], t0 + t * beat, ending ? bar * .7 : beat * .45, t % 1 ? 70 : 82, .005);
    }
    if (has('bass') && !Array.isArray(spec.bassLine)) (ending ? [0] : punk ? [0, .5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 1, 2, 3]).forEach((t, k) => {
      const pitch = punk || k % 4 === 0 ? chord.root : k % 4 === 1 ? nearest(chord.root + 4, chord.pcs, chord.root, chord.root + 12) : k % 4 === 2 ? chord.root + 7 : chord.root + 12;
      note(2, pitch, t0 + t * beat, ending ? bar * .8 : beat * (punk ? .43 : .8), k % 2 ? 88 : 103, .003);
    });
    if (has('organ')) {
      // Orgue: contratemps, «bubble», sostingut, blanques o síncopa.
      const organPatterns = [[[.5, .38], [1.5, .38], [2.5, .38], [3.5, .38]],
        [[.5, .22], [.75, .16], [1.5, .22], [1.75, .16], [2.5, .22], [2.75, .16], [3.5, .22], [3.75, .16]],
        [[0, 3.85]], [[0, 1.85], [2, 1.85]], [[.5, .4], [1.5, .4], [2.25, .2], [2.5, .4], [3.5, .4]]];
      const organ = ending ? [[0, 3.4]] : organPatterns[(spec.layers?.organ ?? (punk ? 2 : 0)) % organPatterns.length];
      for (const [t, length] of organ) chord.notes.forEach((pitch, k) =>
        note(11, pitch + (length < 1 ? 12 : 0), t0 + t * beat + k * .003, length * beat, (t % 1 === .5 ? 74 : 60) - (soft ? 8 : 0), .003));
    }
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
  const snareFeel = spec.style === 'ska' ? .009 : punk ? -.003 : 0;
  const drumBars = new Map();
  for (const [b, t, drum] of spec.drumLine || []) { if (!drumBars.has(b)) drumBars.set(b, new Set()); drumBars.get(b).add(`${t}:${drum}`); }
  if (has('drums') && spec.style !== 'urban' && spec.energy >= 40) for (const [b, hits] of drumBars) {
    if (hits.size < 6 || spec.type === 'outro' && b === spec.chords.length - 1) continue;
    for (const t of [.75, 1.75, 2.25, 3.25]) if (!hits.has(`${t}:38`) && !hits.has(`${t}:37`) && random() < .4)
      note(9, 38, (b * 4 + t) * beat + snareFeel, .05, 22 + random() * 10, .004);
  }
  for (const [b, t, drum, force] of spec.drumLine || []) {
    const at = (b * 4 + t) * beat + (drum === 38 || drum === 37 ? snareFeel : 0), length = drum === 49 ? 1.4 : drum === 46 || drum === 51 ? beat * .45 : .09;
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
  for (const instrument of ['synthLead', 'trumpet', 'trombone', 'sax']) {
    if (!has(instrument)) continue;
    const own = Array.isArray(spec.lines?.[instrument]), line = own ? spec.lines[instrument] : spec.melody;
    const channel = { synthLead: 5, trumpet: 3, trombone: 4, sax: 8 }[instrument];
    for (const [b, t, pitch, duration] of line) {
      const at = b * bar + t * beat, last = spec.type === 'outro' && b === spec.chords.length - 1;
      if (last) continue;
      // Sense capa pròpia, els metalls esperen a la segona meitat de la intro.
      if (!own && instrument !== 'synthLead' && spec.type === 'intro' && b < 2) continue;
      // La força depèn només de la intensitat de la secció (abans l'estrofa baixava uns 9 dB).
      const chord = spec.chords[b], velocity = 84;
      const length = Math.max(.07, duration * beat - .045), accent = t % 1 === 0 || duration >= 1;
      if (instrument === 'synthLead') note(5, pitch, at, Math.max(.07, duration * beat - .03), 82, 0);
      else if (instrument === 'trumpet') horn(3, pitch, at, length, velocity, accent);
      else if (instrument === 'sax') horn(8, pitch - 12, at + .004, length, velocity - 3, accent);
      else horn(4, nearest(pitch - 12, chord.pcs, 45, 67), at + .006, length * .94, velocity - 5, accent);
    }
  }
  const order = { off: 0, cc: 1, pitch: 1, on: 2 };
  events.sort((a, b) => a.time - b.time || order[a.type] - order[b.type]);
  // Volums calibrats: els sons gravats sonen al mateix nivell que els GM equivalents.
  const level = { '2:27': 77, '2:33': 99, '2:34': 99, '2:56': 124, '3:56': 124, '2:57': 127 };
  channels.forEach(entry => { entry.instrument = instrumentOf[entry.channel]; entry.bank ??= 0; entry.volume = level[`${entry.bank}:${entry.program}`] ?? entry.volume; });
  return { channels, events, seconds: spec.seconds, seed: spec.seed, type: spec.type, mix: spec.mix || {}, fx: spec.fx || {} };
}
module.exports = { createPerformance };
