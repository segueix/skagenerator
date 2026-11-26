'use strict';
const ROUND_ROBIN = require('../round-robin.json');
// Tecla d'una gravació alternada → peça original (per a la humanització).
const ORIGINAL = {};
for (const [drum, keys] of Object.entries(ROUND_ROBIN.keys)) for (const key of keys) ORIGINAL[key] = Number(drum);
const pieceOf = pitch => ORIGINAL[pitch] ?? pitch;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function createPerformance(spec) {
  if (!spec || !['ska', 'punk', 'urban'].includes(spec.style) || !Number.isFinite(spec.beat) || spec.beat <= 0
    || !Number.isFinite(spec.seconds) || spec.seconds <= 0 || spec.seconds > 400 || !Array.isArray(spec.chords)
    || !Array.isArray(spec.melody) || !Array.isArray(spec.instruments) || !spec.instruments.length
    || spec.instruments.some(i => !['guitar', 'bass', 'drums', 'trumpet', 'trombone', 'synthLead', 'synthPad', 'synthBass', 'electronicDrums', 'sax', 'organ', 'piano', 'guitar2', 'guitar3', 'vocal'].includes(i))) throw new Error('Partitura no vàlida');
  // [banc, programa]. Banc 2: instruments gravats nota a nota (VSCO 2 CE i
  // FreePats); banc 3: staccato de VSCO; banc 1: variacions GS; banc 0: GM.
  // Kit 69: Muldjord (gravat; els programes 64 i 65 són els «User Drum Set» GS del sintetitzador). Banc addicional (CC0, es baixa a part): kits 68 Big Rusty,
  // 66 Virtuosity club i 67 Virtuosity lo-fi; baix [4,33]
  // Growlybass. La resta són sons de GeneralUser GS.
  const presets = {
    // Guitarres gravades de FreePats (FSBS): neta, jazz, directa (sense amplificador) i dues distorsionades.
    guitar: { auto: null, clean: [2, 27], cleanGm: [0, 27], muted: [0, 28], overdrive: [0, 29], distortion: [0, 30], jazz: [2, 26], direct: [2, 28], dist1: [2, 29], dist2: [2, 30] },
    bass: { auto: null, finger: [2, 33], pick: [2, 34], growly: [4, 33], fingerGm: [0, 33], pickGm: [0, 34] },
    drums: { auto: null, real: [0, 69], surdo3: [0, 70], batucada: [0, 71], rusty: [0, 68], club: [0, 66], lofi: [0, 67], standard: [0, 0], rock: [0, 16], electronic: [0, 24], jazz: [0, 32], room: [0, 8], brush: [0, 40] },
    trumpet: { auto: null, gm: [0, 56], bright: [1, 56], muted: [0, 59] },
    // (Trompeta 2 gravada: [5, 56]. No és un so triable; és el tercer trompetista de l'ska.)
    // La segona veu de vent és un trombó gravat (VSCO), com a les seccions de vent de ska
    // (trompeta, trombó i saxo tenor). El saxo tenor gravat queda com a opció ('sax').
    trombone: { auto: null, vsco: [2, 57], sax: [2, 66], gm: [0, 57], warm: [1, 57] }
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
  const tromboneSound = chosen('trombone') ?? [2, 57];
  // Staccato gravat només amb els metalls de VSCO (el saxo i els sons GM no en tenen).
  const realBrass = { 3: !chosen('trumpet'), 4: tromboneSound[0] === 2 && tromboneSound[1] === 57 };
  const guitarTakes = Array.isArray(spec.guitarTakes) ? spec.guitarTakes : [];
  // L'últim compàs de l'outro és el final de la cançó, tret que s'esvaeixi (el groove continua).
  const finale = spec.type === 'outro' && spec.closing !== 'fade';
  const instrumentOf = { 16: 'vocal', 14: 'guitar2', 15: 'guitar3', 12: 'trumpet', 13: 'trombone', 0: 'guitar', 1: 'guitar', 2: 'bass', 3: 'trumpet', 4: 'trombone', 5: 'synthLead', 6: 'synthPad', 7: 'synthBass', 8: 'sax', 9: 'drums', 10: 'electronicDrums', 11: 'organ' };
  // Punk, estrofa: rítmiques apagades amb el palmell (so de guitarra apagada que passa per l'amplificador).
  const palm = punk && spec.palmMute === true && !misfits, MUTED = [0, 28];
  // Punk: les rítmiques van doblades i obertes a banda i banda, com als discos. Si la part no té
  // segona rítmica, la guitarra 1 es toca dues vegades (canal 0 a l'esquerra, canal 1 a la dreta).
  const rhythmPreset = palm ? MUTED : chosen('guitar') ?? (punk && !amped('guitar') ? [0, 30] : [2, 27]);
  const wideRhythm = punk && !misfits;
  const doubleRhythm = wideRhythm && !has('guitar2') && !guitarTakes.some(take => take.instrument === 'guitar2');
  const channels = [
    patch(0, rhythmPreset, wideRhythm ? 16 : 42, 94),
    patch(1, doubleRhythm ? rhythmPreset : chosen('guitar') ?? (amped('guitar') ? [2, 27] : punk && spec.type === 'chorus' ? [0, 29] : [0, 28]), doubleRhythm ? 112 : 84, doubleRhythm ? 94 : 66),
    patch(2, chosen('bass') ?? (punk ? [2, 34] : [2, 33]), 64, 115),
    patch(3, chosen('trumpet') ?? [2, 56], 50, 116),
    patch(4, tromboneSound, 79, 112),
    // Staccato gravat per a les notes curtes de trompeta i trombó.
    patch(12, [3, 56], 50, 116), patch(13, [3, 57], 79, 127),
    patch(16, chosen('vocal') ?? [2, 71], 64, 112),
    patch(14, palm ? MUTED : chosen('guitar2') ?? (punk && !amped('guitar2') ? [0, 30] : [2, 27]), wideRhythm ? 112 : 96, 84), patch(15, chosen('guitar3') ?? [2, 27], 30, 80),
    patch(8, [2, 66], 30, 94),
    // Orgue de rodes sintetitzat (banc 2) amb altaveu rotatori: lent a les estrofes, ràpid a tornades i solos.
    { channel: 11, bank: 2, program: 16, pan: 76, volume: 84, leslie: ['chorus', 'solo'].includes(spec.type) ? 'fast' : 'slow' },
    { channel: 5, program: 81, pan: 58, volume: 106 },
    { channel: 6, program: 89, pan: 76, volume: 90 },
    { channel: 7, program: 38, pan: 64, volume: 110 },
    { channel: 10, program: 24, pan: 64, volume: 106, drums: true, ...(spec.drumTune ? { tune: spec.drumTune } : {}) },
    { ...patch(9, chosen('drums') ?? [0, 69], 64, 106), drums: true, ...(spec.drumTune ? { tune: spec.drumTune } : {}) }
  ];
  // Cada presa de guitarra té un canal MIDI independent: així no es trepitgen
  // les notes ni els presets de dues guitarres de la mateixa família.
  const takeChannels = new Map();
  for (const [index, take] of guitarTakes.entries()) {
    const channel = 17 + index, family = take.instrument;
    const chosenSound = take.sound || spec.timbres?.[family] || 'auto';
    const settingsFx = take.fx || spec.fx?.[family];
    const takeAmped = settingsFx && (['crunch', 'overdrive', 'distortion', 'metal', 'fuzz'].includes(settingsFx.type) || isHorror(settingsFx.type));
    const fallback = family === 'guitar' ? (punk && !takeAmped ? [0, 30] : [2, 27])
      : (punk && !takeAmped ? [0, 30] : [2, 27]);
    const preset = palm && !take.sound ? MUTED : presets[family][chosenSound] ?? fallback;
    const entry = patch(channel, preset, wideRhythm ? (index % 2 ? 112 : 16) : index % 2 ? 93 : 35, 84);
    if (take.fx) entry.clipFx = take.fx;
    if (take.color) entry.clipColor = take.color;
    channels.push(entry);
    instrumentOf[channel] = family;
    takeChannels.set(channel, take);
  }
  // Piano vertical gravat (VSCO 2 CE): canal propi, després de les preses de guitarra.
  const PIANO = 17 + guitarTakes.length;
  if (has('piano')) { channels.push(patch(PIANO, [2, 0], 74, 94)); instrumentOf[PIANO] = 'piano'; }
  // Ska: secció de vents doblada. Cada vent té un segon músic (trompeta 2, trombó 2 i saxo 2) que
  // toca la mateixa frase una tercera diatònica per sota, una mica més fluix i obert a l'altre costat:
  // la secció sona més plena i a diverses veus. Cada segon músic té canals propis (i staccato).
  const T2 = PIANO + 1, B2 = PIANO + 2, S2 = PIANO + 3, T2S = PIANO + 4, B2S = PIANO + 5;
  const SECOND = {}, STACCATO = { 3: 12, 4: 13, [T2]: T2S, [B2]: B2S };
  // Ska: un tercer trompetista, amb una altra trompeta gravada (banc 5), dobla la trompeta principal a
  // l'uníson a l'altre costat: dues trompetes diferents juntes fan la secció més plena i més forta.
  // Les seves gravacions van del Si♭3 al Si♭4: les notes de més amunt del Re5 les toca una octava avall.
  // (Només amb la trompeta gravada per defecte: amb un altre so triat, la secció queda com era.)
  const T3 = PIANO + 9, TRUMPET3 = [5, 56], UNISON = {};
  // I quan sonen les dues trompetes, sempre sonen també dos trombons: el principal (canal 4) i un altre trombó
  // gravat (banc 5) que el dobla a l'uníson a l'altre costat. Si la secció no porta trombó, el trombó harmonitza
  // la línia de la trompeta amb notes de l'acord, una octava avall (com quan no té línia pròpia).
  // Les gravacions del segon trombó van del Do3 al Do4: les notes de més amunt del Sol4 les toca una octava avall.
  const TB3 = PIANO + 10, TROMBONE3 = [5, 57];
  const third = pitch => pitch > 74 ? pitch - 12 : pitch;
  const unisonPitch = (channel, pitch) => channel === 3 ? third(pitch) : pitch > 67 ? pitch - 12 : pitch < 40 ? pitch + 12 : pitch;
  if (spec.style === 'ska') {
    if (has('trumpet')) { channels.push(patch(T2, chosen('trumpet') ?? [2, 56], 72, 106), patch(T2S, [3, 56], 72, 106)); instrumentOf[T2] = instrumentOf[T2S] = 'trumpet'; SECOND[3] = T2; }
    if (has('trombone')) { channels.push(patch(B2, tromboneSound, 58, 102), patch(B2S, [3, 57], 58, 116)); instrumentOf[B2] = instrumentOf[B2S] = 'trombone'; SECOND[4] = B2; }
    if (has('sax')) { channels.push(patch(S2, [2, 66], 98, 86)); instrumentOf[S2] = 'sax'; SECOND[8] = S2; }
    realBrass[T2] = realBrass[3]; realBrass[B2] = realBrass[4];
    if (has('trumpet') && !chosen('trumpet')) { channels.push(patch(T3, TRUMPET3, 82, 110)); instrumentOf[T3] = 'trumpet'; UNISON[3] = T3; }
    if (UNISON[3] !== undefined) { channels.push(patch(TB3, TROMBONE3, 46, 112)); instrumentOf[TB3] = 'trombone'; UNISON[4] = TB3; }
  }
  // Trombó que acompanya les dues trompetes encara que la secció no el porti.
  const autoTrombone = UNISON[4] !== undefined && !has('trombone');
  const plays = name => has(name) || (name === 'trombone' && autoTrombone);
  // Punk, última tornada: segona guitarra solista (una tercera per sota), oberta a l'altre costat.
  const LEAD2 = punk && spec.shout && has('guitar3') && Array.isArray(spec.lines?.guitar3) ? PIANO + 6 : null;
  if (LEAD2 !== null) { channels.push(patch(LEAD2, chosen('guitar3') ?? [2, 27], 100, 80)); instrumentOf[LEAD2] = 'guitar3'; }
  // Batucada en banda: el segon i el tercer músic de cada peça tenen canal propi, un a cada banda,
  // amb l'afinació una mica diferent (cada pell és diferent) i el seu temps (un pèl abans o després).
  const BAND_PLAYERS = Array.isArray(spec.batucadaLine) ? Math.max(0, ...spec.batucadaLine.map(hit => hit[6] || 0)) : 0;
  const BAND = PIANO + 7, BAND_SEATS = [{ pan: 14, cents: -24, offset: .009, tight: .006 }, { pan: 114, cents: 19, offset: -.006, tight: -.005 }];
  const bandChannel = player => player ? BAND + player - 1 : 9;
  const drumChannel = channel => channel === 9 || channel === 10 || (channel >= BAND && channel < BAND + BAND_PLAYERS);
  const room = Number.isInteger(spec.batucadaRoom) && spec.batucadaRoom >= 0 && spec.batucadaRoom <= 100 ? spec.batucadaRoom : undefined;
  const spread = Number.isFinite(spec.batucadaSpread) && spec.batucadaSpread >= 1 && spec.batucadaSpread <= 3 ? spec.batucadaSpread : 1;
  for (let p = 1; p <= BAND_PLAYERS; p++) {
    channels.push({ ...patch(bandChannel(p), chosen('drums') ?? [0, 69], BAND_SEATS[p - 1].pan, 90), drums: true, tuneFine: BAND_SEATS[p - 1].cents, ...(room !== undefined ? { reverb: room } : {}) });
    instrumentOf[bandChannel(p)] = 'drums';
  }
  if (room !== undefined && spec.batucadaLine) channels.find(c => c.channel === 9).reverb = room;
  // Els surdos i el bombo de la batucada, secs (com el bombo d'una bateria): la reverberació del sintetitzador convertia
  // la seva energia greu en un to metàl·lic que es quedava sonant després dels cops (sobretot el surdo 3).
  if (spec.batucadaLine) for (const entry of channels) if (entry.channel === 9 || (entry.channel >= BAND && entry.channel < BAND + BAND_PLAYERS)) entry.dryKeys = [35, 36, 41, 43, 45, 47, 86, 87];
  // Tercera diatònica per sota (dins de l'escala de la secció); fora de l'escala, la nota de l'acord
  // de 3 a 4 semitons per sota. Si queda massa greu, l'octava avall o, si tampoc hi cap, l'uníson.
  const SCALE = (spec.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : spec.mode === 'dorian' ? [0, 2, 3, 5, 7, 9, 10] : [0, 2, 3, 5, 7, 8, 10])
    .map(n => (n + (spec.tonic || 0)) % 12);
  function thirdBelow(pitch, chord, lo) {
    let q = pitch, steps = 0;
    if (SCALE.includes(((pitch % 12) + 12) % 12)) {
      while (steps < 2 && q > pitch - 5) { q--; if (SCALE.includes(((q % 12) + 12) % 12)) steps++; }
    } else q = chord ? nearest(pitch - 3.5, chord.pcs, pitch - 4, pitch - 3) : pitch - 3;
    if (q >= lo) return q;
    return pitch - 12 >= lo ? pitch - 12 : pitch;
  }
  // Un instrument amb trams només sona dins d'aquests compassos.
  function audible(channel, start) {
    const take = takeChannels.get(channel);
    if (take) { const position = start / bar + 1e-6; return position >= take.from && position < take.to; }
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
    const factor = takeChannels.get(channel)?.feel ?? spec.feel?.[instrumentOf[channel]] ?? 1;
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
    // Punk: la bateria empeny i respira més (menys mecànica); l'ska, més regular.
    drums: punk ? [-3, 5, 4.5, 11] : [0, 3, 2.6, 8], electronicDrums: [0, 0, .4, 3],
    bass: [spec.style === 'ska' ? 9 : punk ? -1 : 4, 4, 3.5, 8], synthBass: [0, .5, .5, 2],
    guitar: [punk ? -4 : 3, 4, 3.5, 9], guitar2: [punk ? -3 : 5, 4, 4.5, 9], guitar3: [2, 5, 6, 10], organ: [5, 4, 5, 8], piano: [4, 4, 5, 10],
    // Vents: mateix retard (relaxat) per a tota la secció i variació de força moderada dins de la frase.
    trumpet: [punk ? 3 : 10, 7, 8, 5], trombone: [punk ? 3 : 10, 7, 8, 5], sax: [punk ? 3 : 10, 7, 8, 5], vocal: [12, 8, 9, 9],
    synthLead: [0, 1, 1, 3], synthPad: [0, 0, 0, 0]
  };
  // Als tempos ràpids els músics han de ser més justos: les desviacions s'escalen amb el temps de negra.
  // Als tempos ràpids les desviacions es redueixen (menys al punk, que és cru per definició).
  const tempoScale = Math.max(punk ? .85 : .55, Math.min(1.15, beat / .43));
  // Membres de la bateria: peu (bombo i pedal del charles), mà de la caixa, mà dels platets i toms.
  const limb = (channel, key) => { if (channel !== 9 && channel !== 10) return 0; const pitch = pieceOf(key); return [35, 36, 44].includes(pitch) ? 1 : [37, 38, 39, 40].includes(pitch) ? 2 : [42, 46, 51, 53, 59].includes(pitch) ? 3 : 4; };
  // Deriva lenta i contínua (suma de sinusoides amb fases pròpies de cada músic):
  // un humà s'avança o s'endarrereix uns quants mil·lisegons durant uns compassos.
  const phases = new Map(), seedBase = (spec.seed >>> 0) || 1;
  function drift(key, t) {
    if (!phases.has(key)) { const r = rng(seedBase * 31 + key * 977); phases.set(key, [r(), r(), r()].map(x => x * Math.PI * 2)); }
    const [a, b, c] = phases.get(key);
    return (.55 * Math.sin(2 * Math.PI * .09 * t + a) + .3 * Math.sin(2 * Math.PI * .23 * t + b) + .15 * Math.sin(2 * Math.PI * .51 * t + c));
  }
  const gauss = () => (random() + random() + random() - 1.5) / .5; // aproximadament normal, σ ≈ 1
  // Secció de vents (trompeta, trombó i saxo, amb els canals d'staccato): toquen junts com una
  // secció real. Comparteixen la deriva i la variació de cada cop (una per moment de la partitura);
  // cada músic només hi afegeix ±2 ms propis. Abans cada vent i cada canal d'staccato derivava per
  // separat i els cops del riff sortien desajustats fins a 26 ms.
  const HORNS = new Set([3, 4, 8, 12, 13, T2, B2, S2, T2S, B2S, T3, TB3]), sectionHit = new Map();
  // Ska: cada músic de la secció té el seu lloc. La trompeta mana, el saxo va un pèl darrere i el
  // trombó (més greu i lent de resposta) una mica més; i cap no està afinat exactament igual
  // (uns pocs cents amunt o avall, en unitats de pitch bend: 41 ≈ 1 cent). Això fa el so de secció.
  const HORN_SEAT = punk ? {} : { 3: 0, 12: 0, 8: 3, 4: 5, 13: 5, [T2]: 2, [T2S]: 2, [S2]: 4, [B2]: 7, [B2S]: 7, [T3]: 3, [TB3]: 6 };
  const HORN_TUNE = punk || !human ? {} : { 3: 100, 12: 100, 8: 170, 4: -140, 13: -140, [T2]: -120, [T2S]: -120, [S2]: -150, [B2]: 110, [B2S]: 110, [T3]: -60, [TB3]: 70 };
  // Atzar propi per al rasgueig i les caigudes: no altera la resta de la interpretació.
  const extraRandom = rng(seedBase * 71 + 5);
  function hornJitter(start) {
    const key = Math.round(start * 200);
    if (!sectionHit.has(key)) { const r = rng(seedBase * 131 + key); sectionHit.set(key, (r() + r() + r() - 1.5) / .5); }
    return sectionHit.get(key);
  }
  function humanTime(channel, pitch, start) {
    const name = instrumentOf[channel], [offset, slow, jitter] = FEEL[name] || [0, 0, 0], member = limb(channel, pitch);
    if (HORNS.has(channel)) return human * tempoScale * (offset + (HORN_SEAT[channel] || 0) + slow * drift(99, start) + jitter * .8 * hornJitter(start) + 2 * gauss()) / 1000;
    // El bombo és el més regular; la mà del charles és la que més respira.
    const limbScale = member === 1 ? .6 : member === 3 ? 1.2 : 1;
    return human * tempoScale * limbScale * (offset + slow * drift(channel * 8 + member, start) + jitter * gauss()) / 1000;
  }
  function humanVelocity(channel, pitch, start, velocity) {
    const name = instrumentOf[channel], spread = (FEEL[name] || [0, 0, 0, 0])[3] / 100;
    let v = velocity * (1 + human * (spread * gauss() + .05 * drift(channel * 8 + 7, start)));
    // Accents mètrics al charles i al ride: més fort a la parte del temps, més suau a les semicorxeres.
    if ((channel === 9 || channel === 10) && [42, 44, 46, 51, 59].includes(pieceOf(pitch))) {
      const frac = (start / beat) % 1;
      v *= 1 + human * (frac < .08 || frac > .92 ? .1 : Math.abs(frac - .5) < .08 ? -.02 : -.14);
    }
    return v;
  }
  // Compte d'entrada (primer compàs només amb baquetes) i aturada de la banda
  // (després del cop, només sona la bateria fins a la secció següent).
  if (spec.stopAt !== undefined && (!Number.isFinite(spec.stopAt) || spec.stopAt <= 0 || spec.stopAt > spec.seconds)) throw new Error('Aturada no vàlida');
  const silentBand = (channel, start) => !drumChannel(channel) && ((spec.countIn && start < bar - .01) || (spec.stopAt !== undefined && start >= spec.stopAt - .01));
  // Talls de la banda. «Stop time» (primers compassos de la secció): la banda només fa un cop a l'u
  // de cada compàs i calla; la veu i les melodies pròpies (tema, solo) continuen. Cops de secció
  // (últim compàs): tota la banda, vents inclosos, toca uns cops curts junts i calla entremig.
  const HIT_PATTERNS = [[0, 1.5], [0, 2.5], [2, 3.5], [.5, 1.5, 2.5], [0, 1, 2], [1.5, 3]];
  const breaks = [];
  if (spec.stopTime !== undefined && (!Number.isInteger(spec.stopTime) || spec.stopTime < 1 || spec.stopTime > 8)) throw new Error('Stop time no vàlid');
  for (let b = 0; b < Math.min(spec.stopTime || 0, spec.chords.length); b++) breaks.push({ from: b * bar, to: (b + 1) * bar, hits: [0], melodyGoesOn: true });
  if (spec.hits && spec.chords.length >= 2 && !finale) {
    const pick = rng(((spec.seed >>> 0) || 1) * 17 + spec.chords.length);
    // Punk: la meitat de les vegades, «stop and go»: un cop a l'u, silenci i un redoble de caixa cap a la tornada.
    const stopAndGo = punk && pick() < .5;
    breaks.push({ from: (spec.chords.length - 1) * bar, to: spec.chords.length * bar, hits: stopAndGo ? [0] : HIT_PATTERNS[pick() * HIT_PATTERNS.length | 0], melodyGoesOn: false, roll: stopAndGo });
  }
  const ownMelody = channel => {
    if (channel === 16 || channel === 5) return true;
    const name = instrumentOf[channel];
    return ['trumpet', 'trombone', 'sax', 'guitar3'].includes(name) && Array.isArray(spec.lines?.[name]) && !['riff', 'answer'].includes(spec.lineModes?.[name]);
  };
  // La veu no para mai; al «stop time» tampoc la melodia pròpia.
  const keepsPlaying = (channel, window) => channel === 16 || window.keep?.includes(channel) || (window.melodyGoesOn && ownMelody(channel));
  // Baix sol: als primers compassos de la secció (després del compte de baquetes, si n'hi ha) o a
  // l'últim compàs (abans de l'última tornada). Només sonen el baix i la veu.
  if (spec.bassSolo !== undefined && (!Number.isInteger(spec.bassSolo) || spec.bassSolo < 1 || spec.bassSolo > 8)) throw new Error('Baix sol no vàlid');
  if (spec.bassSolo) breaks.push({ from: spec.countIn ? bar : 0, to: Math.min(spec.bassSolo, spec.chords.length) * bar, hits: [], keep: [2, 7] });
  if (spec.bassBreak && spec.chords.length >= 2) breaks.push({ from: (spec.chords.length - 1) * bar, to: spec.chords.length * bar, hits: [], keep: [2, 7] });
  let bypassBreaks = false;
  function play(channel, pitch, start, duration, velocity, jitter, exact) {
    if (start >= spec.seconds || !audible(channel, start) || silentBand(channel, start)) return;
    if (!bypassBreaks) for (const window of breaks) {
      if (keepsPlaying(channel, window)) continue;
      if (start >= window.from - .005 && start < window.to - .005) return;
      if (start < window.from && start + duration > window.from) duration = Math.max(.02, window.from - start - .01);
    }
    if (spec.stopAt !== undefined && channel !== 9 && channel !== 10 && start < spec.stopAt) duration = Math.min(duration, spec.stopAt - start);
    const guitarTake = takeChannels.get(channel);
    if (guitarTake) duration = Math.min(duration, guitarTake.to * bar - start);
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
  const control = (channel, time, controller, value) => {
    if (!Number.isInteger(controller) || controller < 0 || controller > 119 || !Number.isFinite(value)) throw new Error('Control MIDI no vàlid');
    for (const [at] of feel(channel, swung(time), 0)) if (at < spec.seconds)
    events.push({ time: Math.max(0, Math.min(spec.seconds - .01, at)), type: 'cc', channel, controller, value: Math.round(Math.max(0, Math.min(127, value))) }); };
  const bend = (channel, time, value) => { for (const [at] of feel(channel, swung(time), 0)) if (at < spec.seconds)
    events.push({ time: Math.max(0, Math.min(spec.seconds - .01, at)), type: 'pitch', channel, value: Math.round(Math.max(0, Math.min(16383, value))) }); };
  // Articulació de metalls: entrada amb una lleugera pujada d'afinació,
  // crescendo d'expressió a les notes llargues i vibrato al final.
  function horn(channel, pitch, start, duration, velocity, accent, connected = false, slurred = false, connectedBefore = false, endsPhrase = false) {
    // Només els accents curts separats fan servir les mostres de staccato.
    if (realBrass[channel] && STACCATO[channel] !== undefined && duration < .3 && !connected) channel = STACCATO[channel];
    const at = Math.max(0, start), long = duration > beat * .9, center = 8192 + (HORN_TUNE[channel] || 0);
    // Nota lligada a l'anterior: atac suau (CC73, uns 30 ms) perquè no se senti el cop de llengua
    // de la mostra gravada; la resta de notes, atac natural.
    control(channel, at - .003, 73, slurred ? 127 : 64);
    bend(channel, at - .002, accent && random() < .55 ? center - 700 - random() * 500 : center);
    if (accent) for (let k = 1; k <= 4; k++) bend(channel, at + k * .016, center - (4 - k) * 260 * (1 - k / 5));
    // Ska: de vegades la nota llarga que tanca una frase cau (el «fall» dels metalls).
    if (!punk && human && endsPhrase && long && extraRandom() < .22)
      for (let k = 1; k <= 4; k++) bend(channel, at + duration * (.8 + k * .045), center - k * k * 260);
    // Crescendo subtil a les notes llargues (uns 2 dB): més fort sonava com si la nota s'apagués.
    // L'expressió és de tot el canal: dins d'una frase lligada no es toca, perquè cada canvi
    // també movia la cua de la nota anterior i la frase sonava a batzegades.
    if (!connectedBefore) {
      control(channel, at - .002, 11, long ? 112 : 124);
      // (Abans aquí faltava el número de control: s'enviaven els controls 117, 122 i 127 sense valor,
      // i el 127 —«Poly Mode On»— apaga totes les notes del canal: les notes llargues es tallaven.)
      if (long) for (let k = 1; k <= 3; k++) control(channel, at + duration * .12 * k, 11, 112 + k * 5);
    }
    control(channel, at - .002, 1, 0);
    if (duration > .55) { control(channel, at + duration * .45, 1, 28); control(channel, at + duration * .7, 1, 46); }
    // Els metalls gravats tenen dues dinàmiques (canvi a 64). La força s'allunya
    // d'aquesta frontera perquè la trompeta no salti de mostra nota a nota.
    let vel = Math.round(velocity * energy);
    vel = (vel < 64 ? Math.min(vel, 58) : Math.max(vel, 70)) + Math.round((random() - .5) * 4);
    note(channel, pitch, start, duration, vel, .006, true);
  }
  // ── Guitarra solista amb línia (riff, resposta o tema) ─────────────
  // Les notes a temps s'ajusten a l'acord; al tema («lead»), les de contratemps poden ser notes de
  // pas. Al punk, cada secció tria una manera de tocar: en octaves (estil Green Day), amb dobles
  // cordes a les notes llargues o nota a nota; les notes llargues del tema i de les respostes
  // poden entrar amb un «bend» (des d'un to per sota) o un lliscament, i acabar amb vibrato.
  // A l'última tornada («shout») una segona guitarra la dobla una tercera per sota, a l'altre costat.
  function playLeadGuitar() {
    const mode = spec.lineModes?.guitar3, lead = mode === 'lead', dice = rng(((spec.seed >>> 0) || 1) * 29 + spec.chords.length * 3);
    const style = !punk ? 'single' : (() => { const v = dice(); return v < .35 && mode !== 'answer' ? 'octaves' : v < .7 ? 'doublestops' : 'single'; })();
    const expressive = punk && (lead || mode === 'answer');
    const line = spec.lines.guitar3;
    for (const [index, [nb, t, pitch, duration]] of line.entries()) {
      const harmony = spec.chords[nb];
      if (!harmony) continue;
      let tuned = lead && t % 1 !== 0 ? pitch : nearest(pitch, harmony.pcs, 62, 79);
      while (tuned > 79) tuned -= 12; while (tuned < 62) tuned += 12;
      const at = nb * bar + t * beat, length = Math.max(.06, duration * beat * .9), force = t % 1 === 0 ? 96 : 84;
      const channels = LEAD2 !== null ? [[15, tuned, force], [LEAD2, thirdBelow(tuned, harmony, 52), force - 6]] : [[15, tuned, force]];
      // Inflexions: es tornen a zero abans de cada nota; un «bend» o un lliscament a les notes llargues.
      const long = duration >= .75, previous = line[index - 1];
      const afterRest = !previous || (previous[0] * 4 + previous[1] + previous[3]) < nb * 4 + t - .3;
      const shape = expressive && long ? (dice() < .4 ? 'bend' : afterRest && dice() < .35 ? 'slide' : null) : null;
      for (const [channel] of channels) {
        if (expressive) bend(channel, at - .003, 8192);
        if (shape === 'bend') for (let k = 0; k <= 5; k++) bend(channel, at + k * Math.min(.14, length * .35) / 5, Math.round(8192 - 8191 * (1 - k / 5)));
        if (shape === 'slide') for (let k = 0; k <= 3; k++) bend(channel, at + k * .02, Math.round(8192 - 8191 * (1 - k / 3)));
        // Vibrato a la segona meitat de les notes llargues.
        if (expressive && duration >= 1.5) for (let k = 0; k < 8; k++) bend(channel, at + length * (.5 + k * .06), Math.round(8192 + Math.sin(k * Math.PI / 2) * 300));
      }
      for (const [channel, p, f] of channels) {
        note(channel, p, at, length, f, .004);
        if (style === 'octaves') note(channel, p - 12, at, length, f - 8, .004);
        else if (style === 'doublestops' && long && channel === 15) note(channel, thirdBelow(p, harmony, 50), at, length, f - 10, .004);
      }
    }
  }
  // Rasgueig: la pua recorre les cordes, no sonen totes alhora. A l'ska cada cop té la seva
  // velocitat de pua (3-9 ms entre cordes), les últimes cordes sonen una mica més fluix i
  // de tant en tant el cop va en sentit contrari. Al punk es manté el cop compacte de sempre.
  function strum(channel, pitches, start, duration, velocity, gap) {
    if (punk || !human) { pitches.forEach((pitch, k) => note(channel, pitch, start + k * gap, duration, velocity)); return; }
    const spread = (.003 + extraRandom() * .006) * Math.min(1.4, .6 + human * .8);
    const order = extraRandom() < .3 ? pitches.slice().reverse() : pitches;
    order.forEach((pitch, k) => note(channel, pitch, start + k * spread, duration * (1 - .04 * k), velocity * (1 - .05 * k)));
  }
  const nearest = (target, pcs, lo, hi) => {
    let result = lo, dist = Infinity;
    for (let n = lo; n <= hi; n++) if (pcs.includes(n % 12) && Math.abs(n - target) < dist) { result = n; dist = Math.abs(n - target); }
    return result;
  };
  for (let b = 0; b < spec.chords.length; b++) {
    const chord = spec.chords[b], t0 = b * bar, ending = finale && b === spec.chords.length - 1;
    const soft = spec.type === 'intro' || spec.type === 'bridge';
    const guitarPatterns = punk
      ? [[0, .5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 1, 1.5, 2, 3, 3.5], [0, .5, 1.5, 2, 2.5, 3.5], [0, .5, 1, 1.5, 2.5, 3], [0, 1, 2, 2.5, 3, 3.5]]
      : [[.5, 1.5, 2.5, 3.5], [.5, 1.5, 2.5, 3.5, 3.75], [.5, 1.5, 3.5], [.5, 1.75, 2.5, 3.5], [.5, 1.5, 2.75, 3.5]];
    const guitarIndex = spec.layers?.guitar ?? spec.groove?.guitar ?? Math.max(0, variation);
    const restrained = punk && !misfits && !palm && ['verse', 'bridge'].includes(spec.type);
    // Apagades: corxeres seguides (el «chug»), curtes, amb els temps forts accentuats.
    // Obertes (tornada): el primer cop de cada compàs ressona.
    const CHUG = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5];
    const openRing = punk && !palm && ['chorus', 'prechorus', 'outro'].includes(spec.type);
    const punkLength = (t, base) => palm ? beat * .2 : openRing && t === 0 ? beat * .95 : base;
    // (La guitarra apagada sona més fluixa: les apagades van més fortes perquè l'estrofa no caigui massa.)
    const punkForce = (t, hit, strong, weak) => spec.shout && !palm ? Math.min(127, (hit % 2 ? weak : strong) + 8) : palm ? Math.min(127, t % 1 === 0 ? strong + 14 : weak + 22) : hit % 2 ? weak : strong;
    let hits = ending ? [0] : palm ? CHUG : restrained
      ? [[0, .5, 2], [0, 1.5], [0, 1.5, 2.5], [0, .5, 2, 3], [0, 2.5]][(guitarIndex + b % 2) % 5]
      : guitarPatterns[guitarIndex % guitarPatterns.length];
    // Perquè l'acord de l'u ressoni, la rítmica principal no toca la corxera de just després.
    if (openRing && !ending) hits = hits.filter(t => t !== .5);
    // Horror punk (estil Misfits): acords de quinta tot a cops avall en corxeres,
    // apagats amb el palmell a les estrofes i oberts a les tornades, amb dues
    // guitarres iguals a esquerra i dreta (paret de guitarres).
    if (has('guitar') && spec.guitarBase !== false && misfits) {
      const open = ['chorus', 'prechorus', 'solo', 'outro'].includes(spec.type);
      (ending ? [0] : [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]).forEach(t => [chord.root + 12, chord.root + 19, chord.root + 24].forEach((pitch, k) => {
        const length = ending ? bar * .75 : beat * (open ? .46 : .2), force = open ? 104 : 86;
        note(0, pitch, t0 + t * beat + k * .004, length, force, .002);
        note(1, pitch, t0 + t * beat + .009 + k * .004, length, force - 4, .002);
      }));
    } else if (has('guitar') && spec.guitarBase !== false) hits.forEach((t, hit) => {
      const pitches = punk ? (palm ? [chord.root + 12, chord.root + 19] : [chord.root + 12, chord.root + 19, chord.root + 24]) : chord.notes.slice().reverse();
      const duration = ending ? bar * .75 : punk ? punkLength(t, beat * (restrained ? .23 : .46)) : beat * .18;
      strum(0, pitches, t0 + t * beat, duration, punk ? punkForce(t, hit, 100, 76) : 90, .007);
      // La segona presa de la mateixa part, a la dreta, uns 14 ms més tard i una mica més fluixa.
      if (doubleRhythm) strum(1, pitches, t0 + t * beat + .014, duration, punkForce(t, hit, 100, 76) - 3, .007);
      // El punk reserva la segona guitarra per a una capa explícita de l’arranjament.
      if (!punk && hit % 2 === 1) strum(1, pitches, t0 + t * beat + .012, duration * .85, 46, .006);
    });
    // Guitarra 2: rítmica aguda (acords una octava amunt) amb el seu propi patró.
    if (has('guitar2') && !guitarTakes.some(take => take.instrument === 'guitar2')) {
      const index = ((spec.layers?.guitar2 ?? 2) + 2) % guitarPatterns.length;
      (ending ? [0] : palm ? CHUG : guitarPatterns[index]).forEach((t, hit) => {
        const pitches = punk ? [chord.root + 24, chord.root + 31] : chord.notes.map(n => n + 12).reverse();
        strum(14, pitches, t0 + t * beat + (wideRhythm ? .016 : .009), ending ? bar * .7 : punk ? punkLength(t, beat * .35) : beat * .18, punk ? punkForce(t, hit, 88, 70) : 80, .006);
      });
    }
    // Preses independents de guitarra 1 i 2: patró i canal propis, sempre
    // sobre els mateixos acords de la secció, amb els seus sons i efectes.
    for (const [takeIndex, take] of guitarTakes.entries()) {
      const channel = 17 + takeIndex;
      const index = (take.revision + takeIndex * 3 + (take.instrument === 'guitar2' ? 2 : 0)) % guitarPatterns.length;
      const pattern = ending ? [0] : palm ? CHUG : guitarPatterns[index];
      if (take.instrument === 'guitar') {
        const pitches = punk ? [chord.root + 12, chord.root + 19, chord.root + 24] : chord.notes.slice().reverse();
        for (const [hit, t] of pattern.entries())
          strum(channel, pitches, t0 + t * beat + .004 * (takeIndex % 3), ending ? bar * .7 : punk ? punkLength(t, beat * .35) : beat * .22, punk ? punkForce(t, hit, 95, 76) : 82, .007);
      } else {
        const pitches = punk ? [chord.root + 24, chord.root + 31] : chord.notes.map(n => n + 12).reverse();
        for (const [hit, t] of pattern.entries())
          strum(channel, pitches, t0 + t * beat + .009 + .004 * (takeIndex % 3), ending ? bar * .7 : punk ? punkLength(t, beat * .35) : beat * .18, punk ? punkForce(t, hit, 84, 68) : 78, .006);
      }
    }
    // Guitarra 3: punteig dins del registre real de la guitarra i harmonitzat
    // amb l'acord que sona a cada compàs. Els riffs de l'escala poden contenir
    // notes de pas que xoquin amb acords prestats o amb les altres guitarres.
    // Manté el contorn rítmic, però resol les altures a notes de l'acord.
    if (has('guitar3') && Array.isArray(spec.lines?.guitar3)) {
      if (b === 0) playLeadGuitar();
    } else if (has('guitar3')) {
      // Abans el quart to era una altra octava sobre l'acord i pujava fins
      // a notes extremes. La quarta nota repeteix una veu interior de l'acord.
      const upper = chord.notes.map(n => nearest(n + 12, chord.pcs, 62, 79));
      const tones = [upper[0], upper[1] ?? upper[0], upper[2] ?? upper[0], upper[0]];
      const index = (spec.layers?.guitar3 ?? 0) % 5;
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
    if (has('piano')) {
      // Piano vertical: contratemps, «bounce» de music-hall (baix a l'esquerra, acords a la dreta),
      // boogie (baix caminant a corxeres), acords llargs o corxeres martellejades.
      const pattern = (spec.layers?.piano ?? 0) % 5, drop = soft ? 8 : 0;
      const right = chord.notes.map(pitch => pitch + 12), low = chord.root + 12;
      const minor = (chord.pcs[1] - chord.pcs[0] + 12) % 12 === 3, third = minor ? 3 : 4;
      const hand = (t, length, velocity, pitches = right) => pitches.forEach((pitch, k) =>
        note(PIANO, pitch, t0 + t * beat + k * .005, length * beat, velocity - drop - k * 2, .004));
      const bassNote = (t, pitch, length, velocity) => note(PIANO, pitch, t0 + t * beat, length * beat, velocity - drop, .004);
      if (ending) { bassNote(0, low - 12, 3.4, 96); bassNote(0, low, 3.4, 92); hand(0, 3.4, 92, [...chord.notes, right.at(-1)]); }
      else if (pattern === 0) [.5, 1.5, 2.5, 3.5].forEach((t, k) => hand(t, .3, k % 2 ? 84 : 90));
      else if (pattern === 1) {
        bassNote(0, low, .85, 96); bassNote(2, b % 2 ? low + third : low + 7 > 55 ? low - 5 : low + 7, .85, 88);
        [.5, 1.5, 2.5, 3.5].forEach(t => hand(t, .28, 88));
        [1, 3].forEach(t => hand(t, .4, 70, right.slice(0, 2)));
      } else if (pattern === 2) {
        [0, third, 7, 9, 10, 9, 7, third].forEach((step, k) => bassNote(k * .5, low + step, .45, k % 2 ? 78 : 92));
        hand(0, .35, 78); [1.5, 3.5].forEach(t => hand(t, .3, 90)); hand(2.5, .25, 76, right.slice(1));
      } else if (pattern === 3) { bassNote(0, low, 3.7, 84); hand(0, 1.9, 82); hand(2, 1.8, 76); }
      else {
        bassNote(0, low, .9, 94); bassNote(2, low, .9, 86);
        for (let k = 0; k < 8; k++) hand(k * .5, .3, k % 2 ? 92 : 74, k % 2 ? right : right.slice(0, 2));
      }
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
      if (UNISON[3] !== undefined) note(T3, third(chord.notes.at(-1) + 12), t0 + .009, bar * .68, 80);
      if (plays('trombone')) note(4, chord.root + 24, t0 + .012, bar * .7, 83);
      if (UNISON[4] !== undefined) note(TB3, unisonPitch(4, chord.root + 24), t0 + .015, bar * .7, 80);
    }
  }
  // La bateria ve escrita a la partitura; el kit acústic i l'electrònic la comparteixen.
  if (spec.drumLine !== undefined && (!Array.isArray(spec.drumLine) || spec.drumLine.some(hit => !Array.isArray(hit)
    || hit.length !== 4 || !hit.every(Number.isFinite) || hit[2] < 27 || hit[2] > 87))) throw new Error('Partitura de bateria no vàlida');
  // Gravacions alternades: als kits gravats, cada cop repetit d'una peça fa servir
  // una gravació diferent (mai la mateixa dues vegades seguides).
  const kitProgram = channels.find(c => c.channel === 9)?.program, alternates = new Set(ROUND_ROBIN.kits[String(kitProgram)] || []);
  const lastTake = new Map();
  const take = drum => {
    if (!alternates.has(String(drum))) return drum;
    const previous = lastTake.get(drum) ?? 0, next = (previous + 1 + Math.floor(random() * 2)) % 3;
    lastTake.set(drum, next);
    return next ? ROUND_ROBIN.keys[String(drum)][next - 1] : drum;
  };
  const snareFeel = spec.style === 'ska' ? .009 : punk ? -.003 : 0;
  const drumBars = new Map();
  for (const [b, t, drum] of spec.drumLine || []) { if (!drumBars.has(b)) drumBars.set(b, new Set()); drumBars.get(b).add(`${t}:${drum}`); }
  if (!spec.batucadaLine && has('drums') && spec.style !== 'urban' && spec.energy >= 40) for (const [b, hits] of drumBars) {
    if (hits.size < 6 || finale && b === spec.chords.length - 1) continue;
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
    if (has('drums') && !spec.batucadaLine) note(9, drum, at, length, force, .003);
    if (has('electronicDrums')) {
      note(10, drum, at, length, force, 0);
      if (drum === 38) note(10, 39, at + .008, .1, force * .72, 0);
    }
  }
  if (has('drums') && spec.batucadaLine) {
    // La batucada ja porta la dinàmica escrita (cop a cop): no es torna a escalar amb l'energia.
    // Els cops marcats com a junts (convenções, cops de tots) i el xiulet van a temps exacte.
    // Balanç del ritme: cada semicorxera del temps es desplaça igual per a tots els músics (el xiulet, no).
    const swingFeel = spec.batucadaFeel;
    if (swingFeel !== undefined && (!Array.isArray(swingFeel) || swingFeel.length !== 4 || !swingFeel.every(x => Number.isFinite(x) && Math.abs(x) <= .1)))
      throw new Error('Balanç de batucada no vàlid');
    for (const [barIndex, step, pitch, velocity, duration, tight, player] of spec.batucadaLine) {
      // Junts (convenções i cops de tots): gairebé exactes, només un mil·lisegon de diferència.
      const sixteenth = Math.round(step * 4);
      const offset = (player ? BAND_SEATS[player - 1][tight ? 'tight' : 'offset'] * (tight ? 1 : spread) : 0)
        + (swingFeel && duration == null && Math.abs(step * 4 - sixteenth) < 1e-6 ? swingFeel[sixteenth % 4] * beat : 0);
      note(bandChannel(player || 0), pitch, Math.max(0, (barIndex * 4 + step) * beat + offset), duration ?? .35, velocity / energy, duration == null && !tight ? .002 : 0);
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
    if (!plays(instrument)) continue;
    // (El trombó afegit segueix la línia de la trompeta i l'harmonitza.)
    const follows = instrument === 'trombone' && autoTrombone, source = follows ? 'trumpet' : instrument;
    const own = Array.isArray(spec.lines?.[source]), line = own ? spec.lines[source] : spec.melody, harmonize = follows || !own;
    let lastPlayed = null;
    const channel = { synthLead: 5, trumpet: 3, trombone: 4, sax: 8 }[instrument];
    // Registre: tota la línia es mou la mateixa quantitat d'octaves (la que n'hi deixa més notes
    // dins del registre preferit) i només es pleguen les notes que surten de l'extensió de l'instrument. Abans cada nota es
    // plegava per separat i el riff saltava una octava enmig de la frase (p. ex. 74 → 65 en lloc de 77).
    // Si alguna octava fa cabre tota la frase dins de l'extensió de l'instrument (min–max), es tria
    // entre aquestes: així no cal plegar cap nota (les veus de secció poden anar més amunt que el riff).
    const fitOctave = (pitches, lo, hi, min = -Infinity, max = Infinity) => {
      const shifts = [0, -1, 1, -2, 2, -3], fits = shifts.filter(k => pitches.every(p => p + 12 * k >= min && p + 12 * k <= max));
      let best = 0, inside = -1;
      for (const k of fits.length ? fits : shifts) { const n = pitches.filter(p => p + 12 * k >= lo && p + 12 * k <= hi).length; if (n > inside) { best = k; inside = n; } }
      return best * 12;
    };
    const fold = (p, lo, hi) => { while (p > hi) p -= 12; while (p < lo) p += 12; return p; };
    const saxShift = instrument === 'sax' ? fitOctave(line.map(n => n[2]), 55, 74, 46, 76) : 0;
    const tromboneShift = instrument === 'trombone' && !harmonize ? fitOctave(line.map(n => n[2]), 45, 67, 40, 72) : 0;
    for (const [index, [b, t, pitch, duration]] of line.entries()) {
      const at = b * bar + t * beat, last = finale && b === spec.chords.length - 1;
      if (last) continue;
      // Sense capa pròpia, els metalls esperen a la segona meitat de la intro.
      if (!own && instrument !== 'synthLead' && spec.type === 'intro' && b < 2) continue;
      // La força depèn només de la intensitat de la secció (abans l'estrofa baixava uns 9 dB).
      const chord = spec.chords[b], velocity = 84;
      // Lliguem notes contigües, però preservem els silencis escrits i les respiracions.
      const next = line[index + 1], previous = line[index - 1];
      const joins = (a, z) => a && z && Math.abs(a[0] * 4 + a[1] + a[3] - (z[0] * 4 + z[1])) < .01
        && Math.floor((a[0] * 4 + a[1]) / 16) === Math.floor((z[0] * 4 + z[1]) / 16);
      const joinedNext = joins(line[index], next), joinedPrevious = joins(previous, line[index]);
      const connected = joinedNext || joinedPrevious;
      // Notes lligades: la nota s'allarga 25 ms per sota de la següent (que entra amb atac suau),
      // així no queda cap forat. Les altres respiren una mica abans de la següent.
      const gap = joinedNext ? -.025 : Math.min(.065, duration * beat * .18);
      // El balanceig endarrereix l'inici de les notes a contratemps: el final s'ha de moure igual,
      // si no les notes lligades quedaven separades (o trepitjades) fins a 50 ms.
      const nominalEnd = at + duration * beat, swingShift = (swung(nominalEnd) - nominalEnd) - (swung(at) - at);
      const length = Math.max(.025, duration * beat - gap + swingShift);
      const accent = !joinedPrevious && (t % 1 === 0 || duration >= 1);
      // Lligat (sense cop de llengua) només quan canvia l'altura: una nota repetida es torna a articular.
      const slurred = joinedPrevious && previous[2] !== pitch;
      if (instrument === 'synthLead') { note(5, pitch, at, Math.max(.07, duration * beat - .03), 82, 0); continue; }
      // Final de frase: després hi ha un silenci de mig temps o més (o s'acaba la línia).
      const endsPhrase = !next || (next[0] * 4 + next[1]) - (b * 4 + t + duration) >= .5;
      let channel, played, force = velocity, lowest;
      if (instrument === 'trumpet') { channel = 3; played = pitch; lowest = 55; }
      else if (instrument === 'sax') {
        // El saxo toca la seva línia en el registre agut del tenor (55–74), per sobre
        // de la segona veu i de la guitarra, perquè no quedi tapat.
        // Les notes que encara en queden fora només es pleguen si surten de l'extensió real del tenor.
        channel = 8; played = fold(pitch + saxShift, 46, 76); lowest = 46;
      }
      else {
        // Amb línia pròpia es toca tal com està composta (dins del registre del trombó);
        // sense, harmonitza la melodia amb notes de l'acord.
        channel = 4; played = !harmonize ? fold(pitch + tromboneShift, 40, 72) : nearest(pitch - 12, chord.pcs, 45, 67); force = velocity - 5; lowest = 40;
      }
      // Tornada «shout»: tota la secció forta.
      if (spec.shout) force += 14;
      horn(channel, played, at, length, force, accent, connected, slurred, joinedPrevious, endsPhrase);
      // Amb la secció repartint-se l'acord (riff o resposta), el segon músic dobla la seva veu a
      // l'uníson (més cos sense embrutar l'acord); amb una melodia pròpia, fa la tercera per sota.
      const unison = ['riff', 'answer'].includes(spec.lineModes?.[instrument]);
      if (SECOND[channel] !== undefined)
        horn(SECOND[channel], unison ? played : thirdBelow(played, chord, lowest), at, length, force - (spec.shout ? 4 : 10), accent, connected, slurred, joinedPrevious, endsPhrase);
      // (El tercer trompetista dobla la principal: si la nota anterior l'ha tocada una octava avall
      // i aquesta no, o al revés, no es lliga, perquè el salt d'octava no soni com un glissando.)
      // (I el segon trombó, el principal.)
      if (UNISON[channel] !== undefined) {
        const octave = lastPlayed !== null && (unisonPitch(channel, lastPlayed) - lastPlayed) !== (unisonPitch(channel, played) - played);
        horn(UNISON[channel], unisonPitch(channel, played), at, length, force - (spec.shout ? 2 : 4), accent || octave, connected, slurred && !octave, joinedPrevious && !octave, endsPhrase);
      }
      lastPlayed = played;
    }
  }
  // Els cops dels talls: bateria (bombo i plat), baix, guitarra i els vents a tres veus, junts i curts.
  bypassBreaks = true;
  for (const window of breaks) for (const [k, h] of window.hits.entries()) {
    const at = window.from + h * beat, chord = spec.chords[Math.min(spec.chords.length - 1, Math.floor(at / bar + 1e-6))];
    if (!chord) continue;
    const stab = beat * .3, force = window.melodyGoesOn ? 96 : 108;
    if (has('drums')) { note(9, 36, at, .2, force + 6, .002); if (!window.melodyGoesOn || window.from === 0 || k === 0) note(9, 49, at, .6, window.melodyGoesOn ? 84 : 104, .002); }
    if (has('bass')) note(2, 40 + ((chord.pcs[0] - 4 + 12) % 12), at, stab * 1.3, force, .002);
    // Guitarres: al punk, acords de quinta (també la segona rítmica i les preses); a l'ska, l'acord sencer.
    const power = [chord.root + 12, chord.root + 19, chord.root + 24];
    if (has('guitar') && spec.guitarBase !== false) strum(0, punk ? power : chord.notes.slice().reverse(), at, punk ? beat * .45 : stab, force - 8, .006);
    if (punk && has('guitar2')) strum(14, power.map(p => p + 12), at, beat * .45, force - 12, .006);
    if (punk) for (const [index, take] of guitarTakes.entries()) strum(17 + index, take.instrument === 'guitar' ? power : power.map(p => p + 12), at, beat * .45, force - 10, .006);
    const top = nearest(76, chord.pcs, 70, 81), below = p => { for (let q = p - 1; q >= p - 9; q--) if (chord.pcs.includes(q % 12)) return q; return p - 3; };
    // «Stop and go»: després del cop, redoble de caixa en semicorxeres que creix cap a la tornada.
    if (window.roll && k === 0 && has('drums')) for (let i = 0; i < 8; i++) note(9, 38, window.from + (2 + i * .25) * beat, .08, 58 + i * 7, .002);
    const voices = { trumpet: [3, top], sax: [8, below(top)], trombone: [4, below(below(top)) - 12] };
    for (const [name, [channel, pitch]] of Object.entries(voices)) {
      if (!plays(name)) continue;
      horn(channel, pitch, at, stab, force, true);
      if (SECOND[channel] !== undefined) horn(SECOND[channel], pitch, at, stab, force - 8, true);
      if (UNISON[channel] !== undefined) horn(UNISON[channel], unisonPitch(channel, pitch), at, stab, force - 4, true);
    }
  }
  // Entrada dels vents just abans del temps (pickup): a l'últim compàs, dues corxeres que pugen
  // cap a la tònica on comença la secció següent, amb tota la secció a tres veus.
  if (spec.pickup && spec.style === 'ska' && spec.chords.length && !finale) {
    const last = spec.chords.length - 1, tonicPc = ((spec.tonic || 0) % 12 + 12) % 12;
    let target = 72; while (target % 12 !== tonicPc) target++;
    const steps = [];
    for (let q = target - 1; steps.length < 2 && q > target - 6; q--) if (SCALE.includes(((q % 12) + 12) % 12)) steps.unshift(q);
    const savedAudible = audible;
    audible = () => true; // els vents poden no sonar en aquesta secció (p. ex. al final d'un solo)
    steps.forEach((top, i) => {
      const at = last * bar + (3 + i * .5) * beat;
      for (const [channel, pitch] of [[3, top], [8, thirdBelow(top, null, 55)], [4, thirdBelow(thirdBelow(top, null, 55), null, 48) - 12]]) {
        horn(channel, pitch, at, beat * .42, 96, i === 0);
        if (SECOND[channel] !== undefined) horn(SECOND[channel], pitch, at, beat * .42, 88, i === 0);
        if (UNISON[channel] !== undefined) horn(UNISON[channel], unisonPitch(channel, pitch), at, beat * .42, 92, i === 0);
      }
    });
    audible = savedAudible;
  }
  bypassBreaks = false;
  const order = { off: 0, cc: 1, pitch: 1, on: 2 };
  events.sort((a, b) => a.time - b.time || order[a.type] - order[b.type]);
  // Una nota repetida (mateix canal i mateixa tecla) no pot encavalcar-se amb l'anterior:
  // el final de l'anterior tallaria la nova just en començar (la trompeta sonava «trencada»).
  // L'anterior s'acaba 4 ms abans que entri la nova.
  const pending = new Map(), pairs = [];
  for (const e of events) {
    if (e.channel === 9 || e.channel === 10 || (e.type !== 'on' && e.type !== 'off')) continue;
    const key = `${e.channel}:${e.note}`;
    if (e.type === 'on') { const list = pending.get(key) || []; list.push(e); pending.set(key, list); }
    else { const on = pending.get(key)?.shift(); if (on) pairs.push([key, on, e]); }
  }
  const byKey = new Map();
  for (const [key, on, off] of pairs) (byKey.get(key) || byKey.set(key, []).get(key)).push([on, off]);
  let moved = false;
  for (const list of byKey.values()) {
    list.sort((a, b) => a[0].time - b[0].time);
    for (let i = 1; i < list.length; i++) {
      const [prevOn, prevOff] = list[i - 1], [on] = list[i];
      if (prevOff.time > on.time - .004) { prevOff.time = Math.max(prevOn.time + .01, on.time - .004); moved = true; }
    }
  }
  if (moved) events.sort((a, b) => a.time - b.time || order[a.type] - order[b.type]);
  // Alternança en ordre de temps (els cops fantasma també compten). La bateria no
  // fa cas de les notes off, així que només cal canviar la tecla de cada cop.
  for (const e of events) if (e.type === 'on' && e.channel === 9) e.note = take(e.note);
  // Volums calibrats: els sons gravats sonen al mateix nivell que els GM equivalents.
  const level = { '2:16': 64, '2:0': 94, '2:66': 94, '2:71': 124, '2:27': 77, '2:33': 99, '2:34': 99, '2:56': 124, '3:56': 124, '5:56': 120, '5:57': 120, '2:57': 127 };
  // Guany fix (dB) dels kits i baixos gravats addicionals: calibrat amb parts reals
  // perquè sonin al mateix nivell que el kit GM i el baix amb dits.
  const boost = { '0:69': 7.4, '0:68': 7.2, '0:66': 6.8, '0:67': 8.1, '2:32': 1.2, '4:33': 5.5 };
  channels.forEach(entry => { entry.instrument = instrumentOf[entry.channel]; entry.bank ??= 0; entry.volume = level[`${entry.bank}:${entry.program}`] ?? entry.volume;
    if (boost[`${entry.bank}:${entry.program}`] && (entry.channel === 9 || entry.channel === 2)) entry.gainDb = boost[`${entry.bank}:${entry.program}`];
    // Saxo fent de segona veu: registre més greu, necessita més volum per sentir-se.
    if (entry.channel === 4 && entry.bank === 2 && entry.program === 66) entry.volume = 110; });
  // Estil Misfits: les dues guitarres igual de fortes i obertes a banda i banda.
  if (misfits) for (const [channel, pan] of [[0, 22], [1, 106]]) Object.assign(channels.find(c => c.channel === channel), { pan, volume: 62 });
  // Guitarres doblades com en un disc: el guitarrista toca la part dues vegades, i
  // cada presa queda una mica desafinada respecte de l'altra i amb el pedal en un
  // punt diferent. Amb el ritme humà propi de cada canal, desapareix el so de «fase».
  if (has('guitar') && spec.guitarBase !== false && (misfits || amped('guitar') || punk)) {
    const detune = { 0: -5, 1: 7 };
    for (const [channel, cents] of Object.entries(detune)) {
      const value = Math.round(8192 + cents / 200 * 8192);
      events.unshift({ time: 0, type: 'pitch', channel: Number(channel), value });
    }
    channels.find(c => c.channel === 1).fxTweak = { drive: -10, tone: 8 };
  }
  return { channels, events, seconds: spec.seconds, seed: spec.seed, type: spec.type,
    // (El trombó afegit a les trompetes fa part del seu so: segueix el volum i l'equalitzador de la trompeta.)
    mix: autoTrombone && spec.mix?.trumpet ? { ...spec.mix, trombone: spec.mix.trumpet } : spec.mix || {},
    baseVolume: spec.baseVolume || {}, fx: spec.fx || {}, colors: spec.colors || {} };
}
module.exports = { createPerformance };
