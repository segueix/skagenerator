'use strict';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function createPerformance(spec) {
  if (!spec || !['ska', 'punk', 'urban'].includes(spec.style) || !Number.isFinite(spec.beat) || spec.beat <= 0
    || !Number.isFinite(spec.seconds) || spec.seconds <= 0 || spec.seconds > 400 || !Array.isArray(spec.chords)
    || !Array.isArray(spec.melody) || !Array.isArray(spec.instruments) || !spec.instruments.length
    || spec.instruments.some(i => !['guitar', 'bass', 'drums', 'trumpet', 'trombone', 'synthLead', 'synthPad', 'synthBass', 'electronicDrums', 'sax', 'organ', 'guitar2', 'guitar3', 'vocal'].includes(i))) throw new Error('Partitura no vàlida');
  // [banc, programa]. Banc 2: instruments gravats nota a nota (VSCO 2 CE i
  // FreePats); banc 3: staccato de VSCO; banc 1: variacions GS; banc 0: GM.
  // Kit 69: Muldjord (gravat; els programes 64 i 65 són els «User Drum Set» GS del sintetitzador). Banc addicional (CC0, es baixa a part): kits 68 Big Rusty,
  // 66 Virtuosity club i 67 Virtuosity lo-fi; contrabaix [2,32] Meatbass i baix [4,33]
  // Growlybass. La resta són sons de GeneralUser GS.
  const presets = {
    guitar: { auto: null, clean: [2, 27], cleanGm: [0, 27], muted: [0, 28], overdrive: [0, 29], distortion: [0, 30] },
    bass: { auto: null, finger: [2, 33], pick: [2, 34], upright: [2, 32], growly: [4, 33], fingerGm: [0, 33], pickGm: [0, 34] },
    drums: { auto: null, real: [0, 69], rusty: [0, 68], club: [0, 66], lofi: [0, 67], standard: [0, 0], rock: [0, 16], electronic: [0, 24], jazz: [0, 32], room: [0, 8], brush: [0, 40] },
    trumpet: { auto: null, gm: [0, 56], bright: [1, 56], muted: [0, 59] },
    // La segona veu de vent sona per defecte amb saxo tenor gravat: articulació més
    // clara que la vara del trombó. El trombó gravat (VSCO) queda com a opció.
    trombone: { auto: null, vsco: [2, 57], gm: [0, 57], warm: [1, 57] }
  };
  // Les guitarres 2 i 3 tenen els mateixos sons que la primera.
  presets.guitar2 = presets.guitar; presets.guitar3 = presets.guitar;
  // Melodia de veu: clarinet gravat (VSCO) o sons GM semblants a la veu.
  presets.vocal = { auto: null, oohs: [0, 53], flute: [0, 73], ocarina: [0, 79], clarinetGm: [0, 71] };
  if (spec.timbres !== undefined && (!spec.timbres || typeof spec.timbres !== 'object' || Array.isArray(spec.timbres)
    || Object.entries(spec.timbres).some(([family, preset]) => !Object.hasOwn(presets, family) || !Object.hasOwn(presets[family], preset))))
    throw new Error('Timbres no vàlids');
  const chosen = family => presets[family][spec.timbres?.[family] || 'auto'];
  // Platets: 'all' (tots), 'hats' (només el charles, sense plats), 'none' (sense
  // cap platet) o 'rim' (sense platets i el pols del charles fet amb l'aro).
  const CYMBALS = ['all', 'hats', 'none', 'rim'];
  if (spec.cymbals !== undefined && !CYMBALS.includes(spec.cymbals)) throw new Error('Opció de platets no vàlida');
  // Afinació de la bateria en semitons (negatiu = més greu).
  if (spec.drumTune !== undefined && (!Number.isInteger(spec.drumTune) || spec.drumTune < -6 || spec.drumTune > 3)) throw new Error('Afinació de bateria no vàlida');
  // Humanització: 0 = quantitzat (màquina), 1 = músics amb força personalitat.
  if (spec.humanize !== undefined && (!Number.isFinite(spec.humanize) || spec.humanize < 0 || spec.humanize > 1)) throw new Error('Humanització no vàlida');
  const random = rng(spec.seed), punk = spec.style === 'punk', beat = spec.beat, bar = beat * 4;
  const has = name => spec.instruments.includes(name), energy = .55 + spec.energy / 200;
  const variation = Number.isInteger(spec.variation) && spec.variation >= 0 && spec.variation <= 4 ? spec.variation : -1;
  const events = [];
  const patch = (channel, [bank, program], pan, volume) => ({ channel, bank, program, pan, volume });
  // Amb un efecte de guany alt, la guitarra entra neta a l'«amplificador» (com una
  // guitarra real a un pedal): no es distorsiona dues vegades.
  // Totes les variants d'horror punk (horrorpunk, horrorpunkB…) toquen a l'estil Misfits.
  const isHorror = type => typeof type === 'string' && type.startsWith('horrorpunk');
  const amped = name => ['crunch', 'overdrive', 'distortion', 'metal', 'fuzz'].includes(spec.fx?.[name]?.type) || isHorror(spec.fx?.[name]?.type);
  const misfits = isHorror(spec.fx?.guitar?.type);
  const realBrass = { 3: !chosen('trumpet'), 4: spec.timbres?.trombone === 'vsco' };
  const instrumentOf = { 16: 'vocal', 14: 'guitar2', 15: 'guitar3', 12: 'trumpet', 13: 'trombone', 0: 'guitar', 1: 'guitar', 2: 'bass', 3: 'trumpet', 4: 'trombone', 5: 'synthLead', 6: 'synthPad', 7: 'synthBass', 8: 'sax', 9: 'drums', 10: 'electronicDrums', 11: 'organ' };
  const channels = [
    patch(0, chosen('guitar') ?? (punk && !amped('guitar') ? [0, 30] : [2, 27]), 42, 94),
    patch(1, chosen('guitar') ?? (amped('guitar') ? [2, 27] : punk && spec.type === 'chorus' ? [0, 29] : [0, 28]), 84, 66),
    patch(2, chosen('bass') ?? (punk ? [2, 34] : [2, 33]), 64, 115),
    patch(3, chosen('trumpet') ?? [2, 56], 50, 116),
    patch(4, chosen('trombone') ?? [2, 66], 79, 112),
    // Staccato gravat per a les notes curtes de trompeta i trombó.
    patch(12, [3, 56], 50, 116), patch(13, [3, 57], 79, 127),
    patch(16, chosen('vocal') ?? [2, 71], 64, 112),
    patch(14, chosen('guitar2') ?? (punk && !amped('guitar2') ? [0, 30] : [2, 27]), 96, 84), patch(15, chosen('guitar3') ?? [2, 27], 30, 80),
    patch(8, [2, 66], 30, 94),
    { channel: 11, program: 16, pan: 92, volume: 84 },
    { channel: 5, program: 81, pan: 58, volume: 106 },
    { channel: 6, program: 89, pan: 76, volume: 90 },
    { channel: 7, program: 38, pan: 64, volume: 110 },
    { channel: 10, program: 24, pan: 64, volume: 106, drums: true, ...(spec.drumTune ? { tune: spec.drumTune } : {}) },
    { ...patch(9, chosen('drums') ?? [0, 69], 64, 106), drums: true, ...(spec.drumTune ? { tune: spec.drumTune } : {}) }
  ];
  // Un instrument amb trams només sona dins d'aquests compassos.
  function audible(channel, start) {
    const list = spec.ranges?.[instrumentOf[channel]];
    if (!list) return true;
    const at = start / bar + 1e-6;
    return list.some(([from, to]) => at >= from && at < to);
  }
  // Ritme relatiu de cada instrument respecte del tempo de la secció.
  //  ×2 (doble temps): el patró de cada compàs es toca dues vegades, el doble de ràpid.
  //  ½ (mig temps): el patró de cada parell de compassos s'estira sobre tots dos; les
  //  notes que cauen al compàs següent s'ajusten al seu acord.
  if (spec.feel !== undefined && (!spec.feel || typeof spec.feel !== 'object' || Object.values(spec.feel).some(f => ![.5, 1, 2].includes(f))))
    throw new Error('Ritme no vàlid');
  function feel(channel, start, duration, pitch) {
    const factor = spec.feel?.[instrumentOf[channel]] ?? 1;
    if (factor === 1) return [[start, duration, pitch]];
    const abs = start / beat + 1e-9, index = Math.floor(abs / 4), within = abs - index * 4;
    if (factor === 2) return [0, 2].map(offset => [(index * 4 + within / 2 + offset) * beat, duration / 2, pitch]);
    if (index % 2) return [];
    const target = index * 4 + within * 2, destination = Math.floor(target / 4 + 1e-9);
    let moved = pitch;
    if (pitch !== undefined && channel !== 9 && channel !== 10 && destination !== index && spec.chords[destination])
      moved = nearest(pitch, spec.chords[destination].pcs, pitch - 3, pitch + 3); // en una tríada sempre n'hi ha una a ±3
    return [[target * beat, duration * 2, moved]];
  }
  // Balanceig (shuffle): les corxeres a contratemps s'endarrereixen; amb 1
  // quedarien en tresets. L'ska jamaicà el fa servir, el punk no.
  const swing = Number.isFinite(spec.swing) ? Math.max(0, Math.min(.7, spec.swing)) : 0;
  const swung = t => { if (!swing) return t; const pos = t / beat, frac = pos - Math.floor(pos); return Math.abs(frac - .5) < .04 ? t + swing * beat / 6 : t; };
  function note(channel, pitch, start, duration, velocity, jitter = .004, exact = false) {
    for (const [at, length, tone] of feel(channel, swung(start), duration, pitch)) play(channel, tone, at, length, velocity, jitter, exact);
  }
  // ── Humanització del ritme ────────────────────────────────────────
  // Cada músic té la seva manera de tocar respecte del temps (ms):
  // [desplaçament fix (+ = darrere del temps), deriva lenta, variació nota a nota, variació de força (%)].
  // A l'ska el baix i els metalls van una mica endarrerits (relaxats) i la caixa
  // arrossega; al punk la guitarra i la bateria empenyen endavant.
  const human = spec.humanize ?? .5;
  const FEEL = {
    drums: [0, 3, 2.6, 8], electronicDrums: [0, 0, .4, 3],
    bass: [spec.style === 'ska' ? 9 : punk ? -1 : 4, 4, 3.5, 8], synthBass: [0, .5, .5, 2],
    guitar: [punk ? -4 : 3, 4, 3.5, 9], guitar2: [punk ? -3 : 5, 4, 4.5, 9], guitar3: [2, 5, 6, 10], organ: [5, 4, 5, 8],
    trumpet: [punk ? 3 : 9, 7, 8, 9], trombone: [punk ? 4 : 11, 7, 8, 9], sax: [punk ? 4 : 10, 7, 8, 9], vocal: [12, 8, 9, 9],
    synthLead: [0, 1, 1, 3], synthPad: [0, 0, 0, 0]
  };
  // Als tempos ràpids els músics han de ser més justos: les desviacions s'escalen amb el temps de negra.
  const tempoScale = Math.max(.55, Math.min(1.15, beat / .43));
  // Membres de la bateria: peu (bombo i pedal del charles), mà de la caixa, mà dels platets i toms.
  const limb = (channel, pitch) => channel !== 9 && channel !== 10 ? 0 : [35, 36, 44].includes(pitch) ? 1 : [37, 38, 39, 40].includes(pitch) ? 2 : [42, 46, 51, 53, 59].includes(pitch) ? 3 : 4;
  // Deriva lenta i contínua (suma de sinusoides amb fases pròpies de cada músic):
  // un humà s'avança o s'endarrereix uns quants mil·lisegons durant uns compassos.
  const phases = new Map(), seedBase = (spec.seed >>> 0) || 1;
  function drift(key, t) {
    if (!phases.has(key)) { const r = rng(seedBase * 31 + key * 977); phases.set(key, [r(), r(), r()].map(x => x * Math.PI * 2)); }
    const [a, b, c] = phases.get(key);
    return (.55 * Math.sin(2 * Math.PI * .09 * t + a) + .3 * Math.sin(2 * Math.PI * .23 * t + b) + .15 * Math.sin(2 * Math.PI * .51 * t + c));
  }
  const gauss = () => (random() + random() + random() - 1.5) / .5; // aproximadament normal, σ ≈ 1
  function humanTime(channel, pitch, start) {
    const name = instrumentOf[channel], [offset, slow, jitter] = FEEL[name] || [0, 0, 0], member = limb(channel, pitch);
    // El bombo és el més regular; la mà del charles és la que més respira.
    const limbScale = member === 1 ? .6 : member === 3 ? 1.2 : 1;
    return human * tempoScale * limbScale * (offset + slow * drift(channel * 8 + member, start) + jitter * gauss()) / 1000;
  }
  function humanVelocity(channel, pitch, start, velocity) {
    const name = instrumentOf[channel], spread = (FEEL[name] || [0, 0, 0, 0])[3] / 100;
    let v = velocity * (1 + human * (spread * gauss() + .05 * drift(channel * 8 + 7, start)));
    // Accents mètrics al charles i al ride: més fort a la parte del temps, més suau a les semicorxeres.
    if ((channel === 9 || channel === 10) && [42, 44, 46, 51, 59].includes(pitch)) {
      const frac = (start / beat) % 1;
      v *= 1 + human * (frac < .08 || frac > .92 ? .1 : Math.abs(frac - .5) < .08 ? -.02 : -.14);
    }
    return v;
  }
  function play(channel, pitch, start, duration, velocity, jitter, exact) {
    if (start >= spec.seconds || !audible(channel, start)) return;
    // jitter 0 = instrument electrònic, a temps exacte.
    // Humanització 0 = quantitzat: temps i força exactes, com una caixa de ritmes.
    const shift = jitter === 0 || !human ? 0 : humanTime(channel, pitch, start);
    const at = Math.max(0, Math.min(spec.seconds - .02, start + shift));
    const end = Math.min(spec.seconds - .005, at + Math.max(.025, duration));
    const midi = Math.max(0, Math.min(127, Math.round(pitch)));
    const vel = Math.max(1, Math.min(127, Math.round(exact ? velocity
      : !human ? velocity * energy : humanVelocity(channel, midi, start, velocity * energy))));
    events.push({ time: at, type: 'on', channel, note: midi, velocity: vel });
    events.push({ time: end, type: 'off', channel, note: midi });
  }
  const control = (channel, time, controller, value) => { for (const [at] of feel(channel, swung(time), 0)) if (at < spec.seconds)
    events.push({ time: Math.max(0, Math.min(spec.seconds - .01, at)), type: 'cc', channel, controller, value: Math.round(Math.max(0, Math.min(127, value))) }); };
  const bend = (channel, time, value) => { for (const [at] of feel(channel, swung(time), 0)) if (at < spec.seconds)
    events.push({ time: Math.max(0, Math.min(spec.seconds - .01, at)), type: 'pitch', channel, value: Math.round(Math.max(0, Math.min(16383, value))) }); };
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
    // Horror punk (estil Misfits): acords de quinta tot a cops avall en corxeres,
    // apagats amb el palmell a les estrofes i oberts a les tornades, amb dues
    // guitarres iguals a esquerra i dreta (paret de guitarres).
    if (has('guitar') && misfits) {
      const open = ['chorus', 'prechorus', 'solo', 'outro'].includes(spec.type);
      (ending ? [0] : [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]).forEach(t => [chord.root + 12, chord.root + 19, chord.root + 24].forEach((pitch, k) => {
        const length = ending ? bar * .75 : beat * (open ? .46 : .2), force = open ? 104 : 86;
        note(0, pitch, t0 + t * beat + k * .004, length, force, .002);
        note(1, pitch, t0 + t * beat + .009 + k * .004, length, force - 4, .002);
      }));
    } else if (has('guitar')) hits.forEach((t, hit) => {
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
    // Guitarra 3: amb línia pròpia (riff de la cançó o respostes) fa de guitarra
    // solista; si no, arpegis i punteig sobre l'acord.
    if (has('guitar3') && Array.isArray(spec.lines?.guitar3)) {
      if (b === 0) for (const [nb, t, pitch, duration] of spec.lines.guitar3)
        note(15, pitch, nb * bar + t * beat, Math.max(.06, duration * beat * .9), t % 1 === 0 ? 96 : 84, .004);
    } else if (has('guitar3')) {
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
  // Sense platets: els plats desapareixen; amb 'none' o 'rim' també el charles
  // ('rim' en manté el pols amb cops d'aro suaus).
  const cymbalMode = spec.cymbals || 'all', CYMBAL_NOTES = [49, 51, 52, 53, 55, 57, 59], HAT_NOTES = [42, 44, 46];
  for (const [b, t, rawDrum, rawForce] of spec.drumLine || []) {
    let drum = rawDrum, force = rawForce;
    if (cymbalMode !== 'all' && CYMBAL_NOTES.includes(drum)) {
      // L'accent del plat passa al bombo (si no n'hi ha ja un).
      if (drum === 49 || drum === 57 || drum === 52 || drum === 55) { if (!drumBars.get(b)?.has(`${t}:36`)) { drum = 36; force = Math.min(force, 100); } else continue; }
      else if (cymbalMode === 'rim') { drum = 37; force *= .6; } else if (cymbalMode === 'hats') { drum = 42; } else continue;
    } else if ((cymbalMode === 'none' || cymbalMode === 'rim') && HAT_NOTES.includes(drum)) {
      if (cymbalMode === 'none' || drum === 44 || drumBars.get(b)?.has(`${t}:38`)) continue;
      force *= drum === 46 ? .75 : .55; drum = 37;
    }
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
  // Melodia de veu: lligada (com si es cantés) i amb la mateixa articulació
  // expressiva dels metalls: entrada suau, crescendo i vibrato a les notes llargues.
  const vocalLine = Array.isArray(spec.lines?.vocal) ? spec.lines.vocal : spec.melody;
  if (has('vocal')) for (const [b, t, pitch, duration] of vocalLine) {
    const at = b * bar + t * beat, next = vocalLine.find(n => n[0] * 4 + n[1] > b * 4 + t);
    const legato = next && Math.abs(next[0] * 4 + next[1] - (b * 4 + t + duration)) < .01;
    horn(16, pitch, at, Math.max(.08, duration * beat - (legato ? .01 : .06)), 80, t % 1 === 0);
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
      else if (instrument === 'sax') {
        // El saxo toca la seva línia en el registre agut del tenor (55–74), per sobre
        // de la segona veu i de la guitarra, perquè no quedi tapat.
        let high = pitch; while (high > 74) high -= 12; while (high < 55) high += 12;
        horn(8, high, at + .004, length, velocity, accent);
      }
      else {
        // Amb línia pròpia es toca tal com està composta (una octava avall, dins del
        // registre del trombó); sense, harmonitza la melodia amb notes de l'acord.
        let low = pitch - 12; while (low > 67) low -= 12; while (low < 45) low += 12;
        horn(4, own ? low : nearest(pitch - 12, chord.pcs, 45, 67), at + .006, length * .94, velocity - 5, accent);
      }
    }
  }
  const order = { off: 0, cc: 1, pitch: 1, on: 2 };
  events.sort((a, b) => a.time - b.time || order[a.type] - order[b.type]);
  // Volums calibrats: els sons gravats sonen al mateix nivell que els GM equivalents.
  const level = { '2:66': 94, '2:71': 124, '2:27': 77, '2:33': 99, '2:34': 99, '2:56': 124, '3:56': 124, '2:57': 127 };
  // Guany fix (dB) dels kits i baixos gravats addicionals: calibrat amb parts reals
  // perquè sonin al mateix nivell que el kit GM i el baix amb dits.
  const boost = { '0:69': 7.4, '0:68': 7.2, '0:66': 6.8, '0:67': 8.1, '2:32': 1.2, '4:33': 5.5 };
  channels.forEach(entry => { entry.instrument = instrumentOf[entry.channel]; entry.bank ??= 0; entry.volume = level[`${entry.bank}:${entry.program}`] ?? entry.volume;
    if (boost[`${entry.bank}:${entry.program}`] && (entry.channel === 9 || entry.channel === 2)) entry.gainDb = boost[`${entry.bank}:${entry.program}`];
    // Saxo fent de segona veu: registre més greu, necessita més volum per sentir-se.
    if (entry.channel === 4 && entry.bank === 2 && entry.program === 66) entry.volume = 110; });
  // Estil Misfits: les dues guitarres igual de fortes i obertes a banda i banda.
  if (misfits) for (const [channel, pan] of [[0, 22], [1, 106]]) Object.assign(channels.find(c => c.channel === channel), { pan, volume: 62 });
  return { channels, events, seconds: spec.seconds, seed: spec.seed, type: spec.type, mix: spec.mix || {}, fx: spec.fx || {} };
}
module.exports = { createPerformance };
