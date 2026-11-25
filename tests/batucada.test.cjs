const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');
const kit = require('../extra-instruments.json').kits.find(k => k.name === 'Batucada');
const settings = { seed: 7, style: 'ska', bpm: 120, tonic: 0, mode: 'major', timbres: { drums: 'batucada' } };
const part = { type: 'verse', bars: 2, energy: 65, revision: 1, instruments: ['drums'] };
test('cada fila de batucada sona només a la nota i al pas escollits', () => {
  assert.equal(engine.BATUCADA.length, 10);
  // Les deu files de la graella i les cinc variants distorsionades de la cuíca.
  // (més els tres surdos apagats i la campana greu de l'agogô).
  assert.equal(Object.keys(kit.pieces).length, 10 + Object.keys(engine.CUICA_VARIANTS).length - 1 + 3 + 1);
  for (const note of [...Object.values(engine.SURDO_MUTED), engine.AGOGO_LOW]) assert(kit.pieces[note], `peça ${note}`);
  for (const note of Object.keys(engine.CUICA_VARIANTS)) assert(kit.pieces[note], `cuíca ${note}`);
  for (const [row, piece] of engine.BATUCADA.entries()) {
    assert(kit.pieces[piece.note]);
    const pattern = Array(engine.BATUCADA.length).fill('0'.repeat(16));
    pattern[row] = '0010000000000000';
    const spec = engine.composeSongPart({ ...settings, batucadaPattern: pattern }, part);
    assert.deepEqual(spec.batucadaLine.map(hit => hit.slice(0, 3)), [[0, .5, piece.note], [1, .5, piece.note]]);
    const perf = createPerformance(spec);
    assert.equal(perf.channels.find(c => c.channel === 9).program, kit.program);
    assert.deepEqual(perf.events.filter(e => e.type === 'on' && e.channel === 9).map(e => e.note), [piece.note, piece.note]);
  }
});

const hitsAt = (line, bar) => line.filter(([b]) => b === bar);
test('ritmes de batucada predefinits i variacions generades vàlides i reproduïbles', () => {
  assert.deepEqual(Object.keys(engine.BATUCADA_RHYTHMS), ['samba', 'reggae', 'ijexa', 'percudium']);
  for (const [key, rhythm] of Object.entries(engine.BATUCADA_RHYTHMS)) {
    assert(engine.validBatucadaPattern(rhythm.steps), key);
    const spec = engine.composeSongPart({ ...settings, batucadaRhythm: key }, { ...part, bars: 1 });
    // Els surdos apagats s'afegeixen al patró i la campana greu de l'agogô compta com a agogô.
    const muted = new Set(Object.values(engine.SURDO_MUTED));
    // (Els arrossegaments del Percudium cauen entre semicorxeres i no són del patró.)
    spec.batucadaLine = spec.batucadaLine.filter(h => !muted.has(h[2]) && Number.isInteger(h[1] * 4)).map(h => h[2] === engine.AGOGO_LOW ? [h[0], h[1], 67, h[3]] : h);
    const expected = rhythm.steps.flatMap((row, i) => [...row].map((on, step) => on === '1' ? [step / 4, engine.BATUCADA[i].note] : null)).filter(Boolean);
    assert.deepEqual(new Set(spec.batucadaLine.map(([, t, n]) => `${t}:${n}`)), new Set(expected.map(([t, n]) => `${t}:${n}`)));
    const variants = new Set();
    for (let seed = 1; seed <= 12; seed++) {
      const pattern = engine.generateBatucadaPattern(key, seed);
      assert(engine.validBatucadaPattern(pattern));
      assert.deepEqual(pattern, engine.generateBatucadaPattern(key, seed));
      // Els surdos 1 i 2 i el xocalho porten el pols i no canvien.
      for (const row of [0, 1, 7]) assert.equal(pattern[row], rhythm.steps[row]);
      variants.add(pattern.join());
    }
    assert(variants.size >= 6, `${key}: poques variacions`);
  }
});
test('la batucada segueix la cançó: energia, crida del repique, aturades i final', () => {
  const play = (p, extra = {}) => engine.composeSongPart({ ...settings, ...extra }, { ...part, ...p }).batucadaLine;
  // Els surdos sonen més forts que el xocalho.
  const line = play({ bars: 1 });
  const loud = n => Math.max(...line.filter(h => h[2] === n).map(h => h[3]));
  assert(loud(36) > loud(69) + 15);
  // Poca energia (paradinha): sense repique, tamborim ni cuíca, però la caixa continua.
  const calm = play({ bars: 2, energy: 30 });
  assert(calm.length && calm.every(([, , n]) => ![50, 54, 78].includes(n)) && calm.some(([, , n]) => n === 38));
  // Abans de la secció següent, el repique omple l'últim temps en semicorxeres.
  const call = hitsAt(play({ bars: 2, next: 'chorus' }), 1).filter(([, t, n]) => n === 50 && t >= 3).map(([, t]) => t);
  assert.deepEqual(call, [3, 3.25, 3.5, 3.75]);
  // Aturada: un sol cop de tots a l'u de l'últim compàs.
  const stop = hitsAt(play({ bars: 2, next: 'verse', ending: 'break' }), 1);
  assert(stop.length >= 5 && stop.every(([, t]) => t === 0));
  // Silenci: l'últim compàs no sona.
  assert.equal(hitsAt(play({ bars: 2, next: 'verse', ending: 'silence' }), 1).length, 0);
  // Final de la cançó: cop de tots i prou; amb «fade» el ritme continua.
  const end = hitsAt(play({ type: 'outro', bars: 3, next: 'end' }), 2);
  assert(end.length >= 6 && end.every(([, t]) => t === 0));
  assert(hitsAt(play({ type: 'outro', bars: 3, next: 'end', closing: 'fade' }), 2).some(([, t]) => t > 0));
  // Compte d'entrada amb el repique.
  assert.deepEqual(hitsAt(play({ bars: 2, countIn: true }), 0).map(([, t, n]) => [t, n]), [[0, 50], [1, 50], [2, 50], [3, 50]]);
  // Batucada només en una secció: la resta de la cançó fa servir la bateria.
  assert.equal(engine.composeSongPart({ ...settings, timbres: {} }, part).batucadaLine, undefined);
  assert(engine.composeSongPart({ ...settings, timbres: {} }, { ...part, timbres: { drums: 'batucada' } }).batucadaLine.length);
});

const builder = require('../song-builder.js');
test('ràdio Batucada: cançons només de batucada amb el tempo i la forma de cada ritme', () => {
  const rhythms = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const song = builder.createBatucadaSong(engine, { seed });
    const st = song.settings, range = builder.BATUCADA_STYLES[st.batucadaRhythm].bpm;
    rhythms.add(st.batucadaRhythm);
    assert(builder.isBatucadaSong(song));
    assert.deepEqual(song.base.instruments, ['drums']);
    assert.equal(song.clips.length, 0);
    assert.equal(st.timbres.drums, 'batucada');
    assert(st.bpm >= range[0] && st.bpm <= range[1], `${st.batucadaRhythm} a ${st.bpm} BPM`);
    assert(engine.validBatucadaPattern(st.batucadaPattern));
    // Seccions seguides, sense buits, de la crida inicial al cop final.
    let at = 0;
    for (const sec of song.sections) { assert.equal(sec.start, at); at += sec.bars; }
    assert.equal(at, st.bars);
    assert(st.bars <= 256 && st.bars * 240 / st.bpm <= 300 && st.bars * 240 / st.bpm >= 90, `${st.bars} compassos`);
    assert.equal(song.sections[0].type, 'intro');
    assert.equal(song.sections.at(-1).type, 'outro');
    assert(song.sections.some(s => s.ending === 'break' || s.ending === 'stop'), 'hi ha alguna breca');
    assert(song.sections.some(s => s.batucadaPattern), 'hi ha variacions');
    // Cada secció es pot compondre i només sona la batucada.
    song.sections.forEach((sec, i) => {
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision: 1, instruments: ['drums'], timbres: {},
        next: song.sections[i + 1]?.type ?? 'end', ...(sec.ending ? { ending: sec.ending } : {}), ...(sec.closing ? { closing: sec.closing } : {}),
        ...(sec.batucadaPattern ? { batucadaPattern: sec.batucadaPattern } : {}), ...(sec.bpm ? { bpm: sec.bpm } : {}), ...(i === 0 ? { countIn: true } : {}) };
      const spec = engine.composeSongPart(st, part);
      assert(spec.batucadaLine.length > 0);
      const perf = createPerformance(spec);
      // Només sona la batucada: el canal 9 i els canals dels altres músics, tots amb el kit de batucada.
      const drums = new Set(perf.channels.filter(c => c.drums && c.program === 71).map(c => c.channel));
      assert(perf.events.filter(e => e.type === 'on').every(e => drums.has(e.channel)));
    });
    assert.deepEqual(builder.createBatucadaSong(engine, { seed }), song, 'reproduïble');
  }
  assert.deepEqual([...rhythms].sort(), ['ijexa', 'percudium', 'reggae', 'samba']);
  // No repeteix el ritme de la cançó anterior si no se n'hi demana un.
  for (let seed = 1; seed <= 20; seed++) assert.notEqual(builder.createBatucadaSong(engine, { seed, avoidRhythm: 'samba' }).settings.batucadaRhythm, 'samba');
  assert.equal(builder.createBatucadaSong(engine, { seed: 3, rhythm: 'ijexa' }).settings.batucadaRhythm, 'ijexa');
});

test('el xiulet és opcional als patrons antics i respecta la durada triada', () => {
  const { note } = engine.BATUCADA_WHISTLE;
  const legacyPattern = Array(9).fill('0000000000000000');
  const compose = (pattern, ms) => engine.composeSongPart({
    ...settings, humanize: 0, batucadaPattern: pattern, batucadaWhistleMs: ms
  }, { ...part, bars: 1 });
  assert.equal(compose(legacyPattern, 750).batucadaLine.length, 0);

  const pattern = [...legacyPattern, '1000100000000000'];
  const spec = compose(pattern, 750);
  const hits = spec.batucadaLine.filter(hit => hit[2] === note);
  assert.deepEqual(hits.map(hit => hit[4]), [.5, .75]);
  const events = createPerformance(spec).events.filter(event => event.note === note);
  assert.deepEqual(events.map(event => [event.type, event.time]), [
    ['on', 0], ['off', .5], ['on', .5], ['off', 1.25]
  ]);
});

test('dinàmica: a poca energia el volum baixa poc i als moments clau puja molt', () => {
  const surdo = (energy, batucada) => {
    const spec = engine.composeSongPart(settings, { ...part, bars: 1, energy, ...(batucada ? { batucada } : {}) });
    return createPerformance({ ...spec, humanize: 0 }).events.find(e => e.type === 'on' && e.note === 36).velocity;
  };
  const low = surdo(40), mid = surdo(75), peak = surdo(75, { peak: true });
  assert(mid - low <= 8, `baixa poc: ${low} → ${mid}`);
  assert(peak - mid >= 12, `puja molt: ${mid} → ${peak}`);
});
test('xiulet del mestre, convenção de tots junts i cadena de cuíca amb distorsions', () => {
  const play = (p, extra = {}) => engine.composeSongPart({ ...settings, ...extra }, { ...part, ...p }).batucadaLine;
  const whistle = engine.BATUCADA_WHISTLE.note;
  // Xiulet a l'entrada (llarg i tres curts) i abans de la crida del repique.
  const entry = play({ bars: 2, countIn: true, batucada: { whistle: true } }).filter(h => h[0] === 0 && h[2] === whistle);
  assert.deepEqual(entry.map(h => h[1]), [0, 2, 2.5, 3]);
  assert(entry[0][4] > entry[1][4]);
  assert(play({ bars: 2, next: 'chorus', batucada: { whistle: true } }).some(h => h[0] === 1 && h[2] === whistle));
  assert(!play({ bars: 2, next: 'chorus' }).some(h => h[2] === whistle));
  // Abans d'una breca, tres xiulets curts.
  assert.equal(play({ bars: 3, next: 'verse', ending: 'break', batucada: { whistle: true } }).filter(h => h[0] === 1 && h[2] === whistle).length, 3);
  // Convenção: totes les peces toquen la mateixa figura, a temps exacte.
  const tutti = '1001001000101000', line = play({ bars: 1, batucada: { tutti } });
  const steps = new Set(line.map(h => h[1] * 4));
  assert.deepEqual([...steps].sort((a, b) => a - b), [0, 3, 6, 10, 12]);
  assert(line.every(h => h[5] === 1));
  const perf = createPerformance(engine.composeSongPart(settings, { ...part, bars: 1, batucada: { tutti } }));
  const ons = perf.events.filter(e => e.type === 'on');
  for (const step of steps) assert.equal(new Set(ons.filter(e => Math.abs(e.time - step / 4 * .5) < .03).map(e => e.time)).size, 1, 'tots alhora');
  // Cadena de cuíca: els cops de cuíca passen per les variants en ordre.
  for (const [index, chain] of engine.CUICA_CHAINS.entries()) {
    const cuica = play({ bars: 2, energy: 80, batucada: { cuica: index } }).filter(h => engine.CUICA_VARIANTS[h[2]]);
    assert(cuica.length >= chain.length);
    assert.deepEqual(cuica.map(h => h[2]), cuica.map((_, k) => chain[k % chain.length]));
  }
  assert.throws(() => play({ batucada: { cuica: 99 } }));
  assert.throws(() => play({ batucada: { tutti: 'x' } }));
});
test('ràdio Batucada: canvis de ritme, moments clau, xiulet, convenções i cuíca', () => {
  let compact = 0, chains = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const song = builder.createBatucadaSong(engine, { seed }), secs = song.sections;
    const rhythmOf = sec => Object.keys(engine.BATUCADA_RHYTHMS).filter(key => sec.batucadaPattern
      && engine.BATUCADA_RHYTHMS[key].steps[0] === sec.batucadaPattern[0] && engine.BATUCADA_RHYTHMS[key].steps[1] === sec.batucadaPattern[1]);
    // Hi ha seccions amb un altre ritme (els surdos 1 i 2 d'un altre ritme).
    // (El Percudium no canvia de ritme: el seu groove és el protagonista.)
    if (song.settings.batucadaRhythm === 'percudium') assert(!secs.some(sec => rhythmOf(sec).length && !rhythmOf(sec).includes('percudium')));
    else assert(secs.some(sec => rhythmOf(sec).length && !rhythmOf(sec).includes(song.settings.batucadaRhythm)) || secs.length < 8, `canvi de ritme (${seed})`);
    assert(secs[0].batucada?.whistle && secs.at(-1).batucada?.peak && secs[1].batucada?.peak);
    // Els moments clau (entrada, última tornada i final) pugen també el volum general.
    assert(secs.filter(sec => sec.volumes).every(sec => sec.batucada?.peak && sec.volumes.master === 3));
    assert(secs[1].volumes && secs.at(-1).volumes);
    // La cuíca només sona als seus arranjaments (solos de cuíca): la de la graella no toca enlloc.
    assert([song.settings.batucadaPattern, ...secs.map(sec => sec.batucadaPattern).filter(Boolean)].every(p => p[8] === '0'.repeat(16)), `cuíca (${seed})`);
    assert(secs.filter(sec => sec.batucada?.cuica !== undefined).every(sec => sec.type === 'solo'));
    assert([2, 3].includes(song.settings.batucadaBand));
    // Cançons enèrgiques: poques seccions fluixes i energia mitjana alta.
    const average = secs.reduce((t, sec) => t + sec.energy * sec.bars, 0) / song.settings.bars;
    assert(average >= 84, `energia mitjana ${average}`);
    assert(secs.filter(sec => sec.energy < 60).length <= 1);
    assert(secs.filter(sec => sec.ending).every(sec => sec.batucada?.whistle));
    if (secs.some(sec => sec.batucada?.tutti)) { compact++; assert(song.settings.humanize < .2); }
    if (secs.some(sec => sec.batucada?.cuica !== undefined)) chains++;
    for (const sec of secs) assert(engine.validBatucadaFx(sec.batucada));
  }
  assert(compact >= 8 && compact <= 35, `cançons compactes: ${compact}`);
  assert(chains >= 50, `cançons amb solo de cuíca: ${chains}`);
});

test('a molta energia la batucada s\'encén: caixa en semicorxeres, xocalho continu i virada del repique', () => {
  const line = engine.composeSongPart(settings, { ...part, bars: 4, energy: 92 }).batucadaLine;
  for (let bar = 0; bar < 4; bar++) {
    const steps = note => new Set(line.filter(h => h[0] === bar && h[2] === note).map(h => h[1] * 4));
    assert.equal(steps(38).size, 16, 'caixa');
    assert.equal(steps(69).size, 16, 'xocalho');
  }
  assert.deepEqual(line.filter(h => h[0] === 3 && h[2] === 50 && h[1] >= 3).map(h => h[1]), [3, 3.25, 3.5, 3.75], 'virada');
  // A energia mitjana, el patró tal qual.
  const calm = engine.composeSongPart(settings, { ...part, bars: 1, energy: 75 }).batucadaLine;
  assert(calm.filter(h => h[2] === 38).length < 16);
});

test('banda: les peces es doblen o tripliquen, cada músic al seu canal, i poden fer contraritmes', () => {
  const compose = (band, fx) => engine.composeSongPart({ ...settings, batucadaBand: band }, { ...part, bars: 1, energy: 75, ...(fx ? { batucada: fx } : {}) });
  const solo = compose(1).batucadaLine, trio = compose(3).batucadaLine;
  const count = (line, note, player) => line.filter(h => h[2] === note && (h[6] || 0) === player).length;
  for (const note of [36, 41, 45, 38, 54, 69]) for (const player of [0, 1, 2]) assert.equal(count(trio, note, player), count(solo, note, 0), `${note}/${player}`);
  for (const note of [50, 67]) assert.equal(count(trio, note, 1) + count(trio, note, 2), 0, `${note} d'un sol músic`);
  // Cada músic té canal propi, obert a una banda i desafinat uns cents; un pèl a destemps.
  const perf = createPerformance({ ...compose(3), humanize: 0 });
  const seats = perf.channels.filter(c => c.drums && c.program === 71 && c.channel !== 9);
  assert.equal(seats.length, 2);
  assert(seats[0].pan < 64 && seats[1].pan > 64 && seats.every(c => c.tuneFine));
  const first = channel => perf.events.find(e => e.type === 'on' && e.channel === channel && e.note === 36).time;
  assert(first(seats[0].channel) > first(9) && first(seats[1].channel) < first(9));
  // Contraritme: el segon músic de caixa, tamborim i surdo 3 fa una altra figura.
  const counter = compose(3, { counter: 1 }).batucadaLine;
  const steps = (line, note, player) => line.filter(h => h[2] === note && (h[6] || 0) === player).map(h => h[1]).join();
  for (const note of [45, 38, 54]) {
    assert.notEqual(steps(counter, note, 1), steps(counter, note, 0), `${note}`);
    assert.equal(steps(counter, note, 2), steps(counter, note, 0));
  }
  // A les convenções no hi ha contraritme: tots junts.
  const tutti = compose(3, { counter: 1, tutti: '1001001000101000' }).batucadaLine;
  assert(tutti.every(h => h[1] * 4 % 1 === 0 && '1001001000101000'[h[1] * 4] === '1'));
  assert.throws(() => compose(4));
});

test('balanç del samba, dues campanes d\'agogô i surdos apagats', () => {
  const compose = (extra = {}, p = {}) => engine.composeSongPart({ ...settings, ...extra }, { ...part, bars: 1, energy: 75, ...p });
  // Balanç: totes les peces es desplacen igual a cada semicorxera; al samba la 2a s'endarrereix i la 4a s'avança.
  const samba = compose();
  assert.deepEqual(samba.batucadaFeel, engine.BATUCADA_FEEL.samba.feel);
  const perf = createPerformance({ ...samba, humanize: 0 });
  const chocalho = perf.events.filter(e => e.type === 'on' && e.note === 69 && e.channel === 9).map(e => e.time);
  const grid = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5].map(t => t * samba.beat);
  assert(chocalho.length >= 8);
  assert(chocalho.slice(0, 8).every((t, i) => Math.abs(t - grid[i] - (i % 2 ? samba.batucadaFeel[2] : 0) * samba.beat) < .003));
  const fourth = engine.composeSongPart({ ...settings, batucadaPattern: [...Array(7).fill('0'.repeat(16)), '0001000000000000', '0'.repeat(16)] }, { ...part, bars: 1 });
  const at = createPerformance({ ...fourth, humanize: 0 }).events.find(e => e.type === 'on' && e.note === 69).time;
  assert(at < .75 * fourth.beat - .01, 'la quarta semicorxera s\'avança');
  // Cada ritme té el seu balanç.
  assert.notDeepEqual(compose({ batucadaRhythm: 'reggae' }).batucadaFeel, samba.batucadaFeel);
  // Agogô: les dues campanes segons el ritme (al samba, la greu a l'u i al tres).
  const agogo = compose({ batucadaPattern: engine.generateBatucadaPattern('samba', 1).map((row, i) => i === 6 ? '1010001010100010' : row) }).batucadaLine
    .filter(h => h[2] === 67 || h[2] === engine.AGOGO_LOW).map(h => [h[1], h[2]]);
  assert.deepEqual(agogo, [[0, 68], [.5, 67], [1.5, 67], [2, 68], [2.5, 67], [3.5, 67]]);
  // Samba: el surdo 1 apaga la pell quan toca el 2 (i al revés). Al samba-reggae, no.
  const line = samba.batucadaLine;
  assert.deepEqual(line.filter(h => h[2] === engine.SURDO_MUTED[0]).map(h => h[1]), [0, 2]);
  assert.deepEqual(line.filter(h => h[2] === engine.SURDO_MUTED[1]).map(h => h[1]), [1, 3]);
  assert(line.filter(h => h[2] === engine.SURDO_MUTED[0])[0][3] < line.filter(h => h[2] === 36)[0][3], 'l\'apagat és més fluix');
  assert(!compose({ batucadaRhythm: 'reggae' }).batucadaLine.some(h => Object.values(engine.SURDO_MUTED).includes(h[2])));
  // Si un surdo no toca al patró, tampoc no apaga.
  const alone = compose({ batucadaPattern: ['0000100000001000', ...Array(9).fill('0'.repeat(16))] }).batucadaLine;
  assert(!alone.some(h => h[2] === engine.SURDO_MUTED[1]));
});
test('el surdo 3 improvisa: frases que canvien, cops oberts i apagats i redobles al final de frase', () => {
  const compose = (p = {}, extra = {}) => engine.composeSongPart({ ...settings, batucadaSurdo3: 'improv', ...extra }, { ...part, bars: 8, energy: 88, ...p }).batucadaLine;
  const line = compose();
  const bar = b => line.filter(h => h[0] === b && (h[2] === 45 || h[2] === engine.SURDO_MUTED[2]) && !h[6]).map(h => `${h[1]}:${h[2]}`).join();
  const bars = [0, 1, 2, 3, 4, 5, 6, 7].map(bar);
  assert(bars.every(Boolean), 'toca a tots els compassos');
  assert.equal(bars[0], bars[1], 'frases de dos compassos');
  assert(new Set(bars).size >= 3, 'les frases canvien');
  assert(line.some(h => h[2] === engine.SURDO_MUTED[2]) && line.some(h => h[2] === 45), 'cops oberts i apagats');
  // Redoble al final de cada frase de quatre compassos: més cops que la mitjana.
  const count = b => line.filter(h => h[0] === b && h[2] === 45 && !h[6]).length;
  assert(count(3) >= 8 && count(3) > count(0));
  // És reproduïble i depèn de la secció.
  assert.deepEqual(compose(), line);
  assert.notDeepEqual(compose({ fill: 5 }), line);
  assert.throws(() => compose({}, { batucadaSurdo3: 'x' }));
  // Les cançons de la ràdio el fan improvisar.
  assert.equal(builder.createBatucadaSong(engine, { seed: 4 }).settings.batucadaSurdo3, 'improv');
});

test('Percudium: dens, als mitjos, amb accents sincopats, arrossegaments, sala i compressió de bloc', () => {
  const st = engine.BATUCADA_FEEL.percudium;
  const spec = engine.composeSongPart({ ...settings, batucadaRhythm: 'percudium', batucadaBand: 3 }, { ...part, bars: 2, energy: 90 });
  const line = spec.batucadaLine.filter(h => !h[6]);
  // Caixa i xocalho a totes les semicorxeres, i arrossegaments (una fusa abans dels accents).
  for (let bar = 0; bar < 2; bar++) {
    const caixa = line.filter(h => h[0] === bar && h[2] === 38).map(h => h[1] * 4);
    assert(caixa.filter(Number.isInteger).length === 16);
    assert.deepEqual(caixa.filter(x => !Number.isInteger(x)).sort((a, b) => a - b), [5.5, 8.5, 12.5]);
    assert.equal(line.filter(h => h[0] === bar && h[2] === 69).length, 16);
  }
  // Accents sincopats (1, 7, 10 i 14): la caixa hi és més forta.
  const caixa = step => line.find(h => h[0] === 0 && h[2] === 38 && h[1] * 4 === step)[3];
  for (const step of [0, 6, 9, 13]) assert(caixa(step) > caixa(step + 1));
  assert.equal(st.accents, '1000001001000100');
  // Els surdos pesen menys i la caixa més que al samba.
  const samba = engine.composeSongPart({ ...settings, batucadaBand: 3 }, { ...part, bars: 1, energy: 90 }).batucadaLine;
  const first = (l, n) => l.find(h => h[2] === n && !h[6])[3];
  assert(first(line, 36) < first(samba, 36) && first(line, 38) > first(samba, 38));
  // Sala, separació dels músics i compressió de bloc.
  assert.equal(spec.batucadaRoom, st.room);
  assert.equal(spec.batucadaGlue, true);
  const perf = createPerformance(spec);
  assert(perf.glue && perf.channels.filter(c => c.drums && c.program === 71).every(c => c.reverb === st.room));
  assert(!createPerformance(engine.composeSongPart({ ...settings, batucadaBand: 3 }, { ...part, bars: 1 })).glue);
  // Cançons de la ràdio Percudium: 94–102 BPM (a les seccions), banda de tres, contraritmes i mescla brillant.
  for (let seed = 1; seed <= 20; seed++) {
    const song = builder.createBatucadaSong(engine, { seed, rhythm: 'percudium' }), secs = song.sections;
    assert.equal(song.settings.batucadaRhythm, 'percudium');
    assert.equal(song.settings.batucadaBand, 3);
    assert(song.settings.bpm >= 100 && secs.every(sec => (sec.bpm ?? song.settings.bpm) >= 94 && (sec.bpm ?? song.settings.bpm) <= 108));
    assert(song.settings.mix.drums.low < 0 && song.settings.mix.drums.high > 0);
    assert(secs.filter(sec => sec.energy >= 84 && sec.type !== 'intro' && !sec.batucada?.tutti).every(sec => sec.batucada?.counter !== undefined));
    // La caixa contínua es manté a totes les variacions.
    assert([song.settings.batucadaPattern, ...secs.map(sec => sec.batucadaPattern).filter(Boolean)].every(p => p[3] === '1'.repeat(16) || p[4] !== undefined));
  }
  // Cap altre ritme no canvia a Percudium.
  for (let seed = 1; seed <= 30; seed++) {
    const song = builder.createBatucadaSong(engine, { seed, rhythm: 'samba' });
    assert(!song.sections.some(sec => sec.batucadaPattern && sec.batucadaPattern[1] === engine.BATUCADA_RHYTHMS.percudium.steps[1]));
  }
});
