const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');
const kit = require('../extra-instruments.json').kits.find(k => k.name === 'Batucada');
const settings = { seed: 7, style: 'ska', bpm: 120, tonic: 0, mode: 'major', timbres: { drums: 'batucada' } };
const part = { type: 'verse', bars: 2, energy: 65, revision: 1, instruments: ['drums'] };
test('cada fila de batucada sona només a la nota i al pas escollits', () => {
  assert.equal(engine.BATUCADA.length, 11);
  // Les deu files de la graella i les cinc variants distorsionades de la cuíca.
  // (més els tres surdos apagats i la campana greu de l'agogô).
  assert.equal(Object.keys(kit.pieces).length, 11 + Object.keys(engine.CUICA_VARIANTS).length - 1 + 3 + 1 + 1); // corxera del tabal
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

test('tabal: mostra llarga per a negres, curta per a cops seguits i patrons antics sense canvis', () => {
  const row = engine.BATUCADA.findIndex(p => p.name === 'Tabal');
  assert.equal(row, 10);
  assert.equal(kit.pieces[84].layers[0][0][0], 'tabal-negra.opus');
  assert.equal(kit.pieces[85].layers[0][0][0], 'tabal-corxera.opus');
  assert.equal(kit.pieces[84].choke, kit.pieces[85].choke);
  const legacy = Array(10).fill('0'.repeat(16));
  const play = pattern => engine.composeSongPart({ ...settings, batucadaPattern: pattern }, { ...part, bars: 1 });
  assert.deepEqual(play(legacy).batucadaLine, []);
  const spec = play([...legacy, '1000101000001000']);
  assert.deepEqual(spec.batucadaLine.map(h => [h[1], h[2]]), [[0, 84], [1, 85], [1.5, 84], [3, 84]]);
  assert.deepEqual(createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 9).map(e => e.note), [84, 85, 84, 84]);
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
    spec.batucadaLine = spec.batucadaLine.filter(h => !muted.has(h[2]) && Number.isInteger(h[1] * 4)).map(h => h[2] === engine.AGOGO_LOW ? [h[0], h[1], 67, h[3]] : h[2] === 85 ? [h[0], h[1], 84, h[3]] : h);
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
    assert(secs.some(sec => rhythmOf(sec).length && !rhythmOf(sec).includes(song.settings.batucadaRhythm)) || secs.length < 8, `canvi de ritme (${seed})`);
    assert(secs[0].batucada?.whistle && secs.at(-1).batucada?.peak && secs[1].batucada?.peak);
    // Els moments clau (entrada, última tornada i final) pugen també el volum general.
    // (+1 dB: més, el limitador hauria d'aixafar el final i els cops de tots.)
    assert(secs.filter(sec => sec.volumes).every(sec => sec.batucada?.peak && sec.volumes.master === 1));
    assert(song.settings.mix?.drums?.volume <= 1, 'mescla de la batucada sense excés de volum');
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
    // (El Percudium té convenções però conserva una mica de soltesa entre músics.)
    if (song.settings.batucadaRhythm !== 'percudium' && secs.some(sec => sec.batucada?.tutti)) { compact++; assert(song.settings.humanize < .2); }
    if (secs.some(sec => sec.batucada?.cuica !== undefined)) chains++;
    for (const sec of secs) assert(engine.validBatucadaFx(sec.batucada));
  }
  assert(compact >= 4 && compact <= 35, `cançons compactes: ${compact}`);
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
  // Als surdos, els altres músics toquen gairebé tan fort com el principal (so original de la batucada).
  const velocity = (note, player) => trio.find(h => h[2] === note && (h[6] || 0) === player)[3];
  for (const note of [36, 41, 45]) assert(velocity(note, 1) >= velocity(note, 0) * .8, `${note}`);
  assert(velocity(38, 1) >= velocity(38, 0) * .8, 'la caixa, gairebé igual');
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

test('Percudium: dens, als mitjos, amb accents sincopats, arrossegaments i sala, sense compressió de bloc', () => {
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
  // La caixa pesa més que al samba; els surdos, amb el seu pes original (sense rebaixar).
  const samba = engine.composeSongPart({ ...settings, batucadaBand: 3 }, { ...part, bars: 1, energy: 90 }).batucadaLine;
  const first = (l, n) => l.find(h => h[2] === n && !h[6])[3];
  assert(first(line, 38) > first(samba, 38));
  for (const note of [35, 36, 41, 43, 45, 47]) assert.equal(st.gain[note], undefined, `surdo ${note}`);
  // Sala i separació dels músics. Sense compressió de bloc: amb tants cops al màxim, movia el guany al ritme
  // de l'ona i distorsionava el final i els cops de tots.
  assert.equal(spec.batucadaRoom, st.room);
  assert.equal(spec.batucadaGlue, undefined);
  const perf = createPerformance(spec);
  assert(!perf.glue && perf.channels.filter(c => c.drums && c.program === 71).every(c => c.reverb === st.room));
  // Cançons de la ràdio Percudium: 94–102 BPM (a les seccions), banda de tres, contraritmes i mescla brillant.
  for (let seed = 1; seed <= 20; seed++) {
    const song = builder.createBatucadaSong(engine, { seed, rhythm: 'percudium' }), secs = song.sections;
    assert.equal(song.settings.batucadaRhythm, 'percudium');
    assert.equal(song.settings.batucadaBand, 3);
    assert(song.settings.bpm >= 100 && secs.every(sec => (sec.bpm ?? song.settings.bpm) >= 94 && (sec.bpm ?? song.settings.bpm) <= 108));
    assert(song.settings.mix.drums.low === 0 && song.settings.mix.drums.high > 0);
    assert(secs.filter(sec => sec.energy >= 84 && sec.type !== 'intro' && !sec.batucada?.tutti && !sec.batucada?.finale).every(sec => sec.batucada?.counter !== undefined));
    // La caixa contínua es manté a totes les variacions.
    assert([song.settings.batucadaPattern, ...secs.map(sec => sec.batucadaPattern).filter(Boolean)].every(p => p[3] === '1'.repeat(16) || p[4] !== undefined));
  }
  // Cap altre ritme no canvia a Percudium.
  for (let seed = 1; seed <= 30; seed++) {
    const song = builder.createBatucadaSong(engine, { seed, rhythm: 'samba' });
    assert(!song.sections.some(sec => sec.batucadaPattern && sec.batucadaPattern[1] === engine.BATUCADA_RHYTHMS.percudium.steps[1]));
  }
});

test('Percudium: caixa o repique i xiulet, entrada de tots sense cuíca, diàlegs, aturades, canvis de ritme i final al màxim', () => {
  const st = { ...settings, batucadaRhythm: 'percudium', batucadaBand: 3 };
  const compose = p => engine.composeSongPart(st, { ...part, energy: 92, ...p }).batucadaLine;
  // Entrada: només el timbal (surdo 1, un sol músic) i el xiulet del mestre; l'últim compàs, un redoble.
  const intro = compose({ type: 'intro', bars: 2, batucada: { intro: 'timbal', whistle: true } });
  const notes = new Set(intro.map(h => h[2]));
  assert.deepEqual([...notes].sort((a, b) => a - b), [35, 36, engine.BATUCADA_WHISTLE.note]);
  assert(intro.every(h => !h[6]), 'un sol timbal');
  assert(intro.filter(h => h[0] === 1 && h[2] === 36).length > intro.filter(h => h[0] === 0 && h[2] === 36).length, 'redoble');
  // Entrada de caixa o de repique: un sol músic fa el ritme i, alhora, el xiulet fa dos curts i un de llarg.
  for (const intro of ['caixa', 'repique']) {
    const line = compose({ type: 'intro', bars: 2, batucada: { intro } });
    const note = intro === 'caixa' ? 38 : 50, whistle = engine.BATUCADA_WHISTLE.note;
    assert(line.every(h => h[2] === note || h[2] === whistle), intro);
    assert(line.every(h => !h[6]), 'un sol músic');
    for (const bar of [0, 1]) {
      const blows = line.filter(h => h[0] === bar && h[2] === whistle).map(h => h[4]);
      assert.equal(blows.length, 3); assert(blows[0] < .2 && blows[1] < .2 && blows[2] > blows[0] * 2, 'dos curts i un de llarg');
    }
    assert(line.filter(h => h[0] === 0 && h[2] === note).length >= 8, 'fa un ritme');
  }
  // Diàleg: tots continuen tocant, però el grup que parla puja el volum i els altres l'abaixen.
  const rowOf = note => [35, 43, 47].includes(note) ? [35, 43, 47].indexOf(note) : note === engine.AGOGO_LOW ? 6 : engine.BATUCADA.findIndex(p => p.note === note);
  const group = row => engine.BATUCADA_DIALOG.findIndex(g => g.includes(row));
  const plain = compose({ type: 'bridge', bars: 6 }), dialog = compose({ type: 'bridge', bars: 6, batucada: { dialog: 1 } });
  const avg = (line, bar, g) => { const hits = line.filter(h => h[0] === bar && !h[6] && Number.isInteger(h[1] * 4) && group(rowOf(h[2])) === g); return hits.reduce((t, h) => t + h[3], 0) / hits.length; };
  for (const bar of [0, 1, 2, 3]) {
    const speaking = bar % 2, silent = 1 - speaking;
    assert(avg(dialog, bar, speaking) > avg(plain, bar, speaking) + 8, `parla (${bar})`);
    assert(avg(dialog, bar, silent) < avg(plain, bar, silent) - 6 && avg(dialog, bar, silent) > 30, `replica fluix però sona (${bar})`);
  }
  assert.deepEqual(dialog.filter(h => h[0] === 5).map(h => h[3]), plain.filter(h => h[0] === 5).map(h => h[3]), 'al final, tots igual');
  // Per mitjos compassos, i amb un tercer grup que s'hi afegeix a la segona meitat.
  const half = compose({ type: 'bridge', bars: 4, batucada: { dialog: 2 } });
  assert.equal(group(rowOf(half.filter(h => h[0] === 0 && h[1] < 2 && !h[6]).sort((a, b) => b[3] - a[3])[0][2])), 0);
  // (El grup que parla és el que més puja respecte de la mateixa secció sense diàleg.)
  const three = compose({ type: 'bridge', bars: 8, batucada: { dialog: 3 } }), plain8 = compose({ type: 'bridge', bars: 8 });
  const raised = bar => { const up = [0, 1, 2].map(g => avg(three, bar, g) - avg(plain8, bar, g)); return up.indexOf(Math.max(...up)); };
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(raised), [0, 1, 0, 0, 1, 2]);
  // Aturada: un cop de tots al màxim (127) i silenci.
  const stop = compose({ type: 'bridge', bars: 2, next: 'chorus', ending: 'break' }).filter(h => h[0] === 1);
  // Aturada: un cop de tots junts, fort però sense forçar-lo a 127 (24 notes a 127 alhora es distorsionaven).
  assert(stop.length && stop.every(h => h[1] === 0));
  assert.equal(new Set(stop.map(h => h[6] || 0)).size, 3, 'tots els músics');
  const lead = stop.filter(h => !h[6]);
  assert(lead.some(h => h[3] >= 100) && lead.filter(h => h[3] === 127).length <= 1);
  // Final: cops de tots els instruments junts i un cop final de tots, tots els músics, al màxim.
  const end = compose({ type: 'outro', bars: 4, batucada: { finale: true } });
  const lastHit = end.filter(h => h[0] === 3 && h[1] === 2);
  assert.deepEqual([...new Set(lastHit.map(h => rowOf(h[2]) >= 0 ? rowOf(h[2]) : 0))].length >= 8 || lastHit.length >= 8, true);
  // El cop final, el més fort (de cada instrument, el músic principal), sense passar del límit.
  const strongest = row => Math.max(...end.filter(h => h[0] === 3 && h[1] < 2 && !h[6] && rowOf(h[2]) === row).map(h => h[3]));
  for (const h of lastHit.filter(h => !h[6])) assert(h[3] >= strongest(rowOf(h[2])), `final ${h[2]}`);
  assert(new Set(lastHit.map(h => h[6] || 0)).size === 3);
  assert(!end.some(h => h[0] === 3 && h[1] > 2), 'després, silenci');
  // Tot saturat: també el repique i l'agogô els toquen tres músics.
  const groove = compose({ type: 'chorus', bars: 1 });
  for (const note of [50, 67]) assert.equal(new Set(groove.filter(h => h[2] === note || note === 67 && h[2] === engine.AGOGO_LOW).map(h => h[6] || 0)).size, 3, `${note}`);
  // Les cançons Percudium: caixa o repique i xiulet uns 5 segons, entrada de tots amb tota la potència (sense
  // cuíca), diàlegs, aturades i represes, canvis de ritme (al mateix tempo) i final al màxim.
  const intros = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const song = builder.createBatucadaSong(engine, { seed, rhythm: 'percudium' }), secs = song.sections;
    const bpm = secs[0].bpm ?? song.settings.bpm, seconds = secs[0].bars * 240 / bpm;
    intros.add(secs[0].batucada?.intro);
    assert(['caixa', 'repique'].includes(secs[0].batucada?.intro) && seconds >= 4.5 && seconds <= 5.5, `entrada ${seconds}`);
    assert(!secs.some(sec => sec.batucada?.cuica !== undefined), 'sense cuíca');
    assert([song.settings.batucadaPattern, ...secs.map(sec => sec.batucadaPattern).filter(Boolean)].every(p => p[8] === '0'.repeat(16)));
    const rhythmOf = sec => Object.keys(engine.BATUCADA_RHYTHMS).find(key => sec.batucadaPattern && engine.BATUCADA_RHYTHMS[key].steps[1] === sec.batucadaPattern[1]);
    const changes = secs.filter(sec => rhythmOf(sec) && rhythmOf(sec) !== 'percudium');
    assert(changes.length >= 1, `canvis de ritme (${seed})`);
    assert(changes.every(sec => (sec.bpm ?? song.settings.bpm) === bpm), 'mateix tempo');
    assert(changes.every(sec => secs[secs.indexOf(sec) - 1].batucada?.whistle), 'el mestre avisa del canvi');
    assert.equal(song.settings.countIn, false);
    assert(secs[1].batucada?.peak && secs[1].volumes?.master > 0, 'entren tots amb potència');
    assert(secs.some(sec => sec.batucada?.dialog), 'diàlegs');
    const stops = secs.filter(sec => sec.ending);
    assert(stops.length >= 2, 'aturades');
    for (const sec of stops) { const next = secs[secs.indexOf(sec) + 1]; assert(next.batucada?.peak && next.volumes?.master > 0, 'retorn amb potència'); }
    assert(secs.at(-1).batucada?.finale);
  }
  assert.deepEqual([...intros].sort(), ['caixa', 'repique']);
  // Quan canvia de ritme, continua sonant com el Percudium (pes de les peces, sala i compressió).
  const reggae = engine.composeSongPart(st, { ...part, bars: 1, energy: 92, batucadaPattern: engine.BATUCADA_RHYTHMS.reggae.steps });
  assert(reggae.batucadaRoom === engine.BATUCADA_FEEL.percudium.room);
  assert.deepEqual(reggae.batucadaFeel, engine.BATUCADA_FEEL.reggae.feel);
});

test('cada surdo talla el seu so anterior (obert i apagat): els redobles no s\'acumulen', () => {
  const pieces = kit.pieces;
  for (const [open, muted] of [[36, 35], [41, 43], [45, 47]]) {
    assert(pieces[open].choke && pieces[open].choke === pieces[muted].choke, `surdo ${open}`);
  }
  assert.equal(new Set([36, 41, 45].map(n => pieces[n].choke)).size, 3, 'cada surdo, el seu grup');
  assert(!pieces[38].choke && !pieces[69].choke, 'la caixa i el xocalho no es tallen');
});

test('els surdos de la batucada no van a la reverberació (sonaven com un to metàl·lic després dels cops)', () => {
  const perf = createPerformance(engine.composeSongPart({ ...settings, batucadaBand: 3 }, { ...part, bars: 1 }));
  const drums = perf.channels.filter(c => c.drums && c.program === 71);
  assert.equal(drums.length, 3);
  for (const channel of drums) assert.deepEqual(channel.dryKeys, [35, 36, 41, 43, 45, 47]);
  const ska = createPerformance(engine.composeSongPart({ ...settings, timbres: {}, instruments: ['drums'] }, { ...part, bars: 1 }));
  assert(ska.channels.every(c => !c.dryKeys), 'les bateries de l\'ska no canvien');
});
