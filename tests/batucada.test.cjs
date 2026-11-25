const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');
const kit = require('../extra-instruments.json').kits.find(k => k.name === 'Batucada');
const settings = { seed: 7, style: 'ska', bpm: 120, tonic: 0, mode: 'major', timbres: { drums: 'batucada' } };
const part = { type: 'verse', bars: 2, energy: 65, revision: 1, instruments: ['drums'] };
test('cada fila de batucada sona només a la nota i al pas escollits', () => {
  assert.equal(engine.BATUCADA.length, 10);
  assert.equal(Object.keys(kit.pieces).length, 10);
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
  assert.deepEqual(Object.keys(engine.BATUCADA_RHYTHMS), ['samba', 'reggae', 'ijexa']);
  for (const [key, rhythm] of Object.entries(engine.BATUCADA_RHYTHMS)) {
    assert(engine.validBatucadaPattern(rhythm.steps), key);
    const spec = engine.composeSongPart({ ...settings, batucadaRhythm: key }, { ...part, bars: 1 });
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
  // Poca energia: sense caixa, repique, tamborim ni cuíca.
  const calm = play({ bars: 2, energy: 30 });
  assert(calm.length && calm.every(([, , n]) => ![38, 50, 54, 78].includes(n)));
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
      assert(perf.events.filter(e => e.type === 'on').every(e => e.channel === 9));
    });
    assert.deepEqual(builder.createBatucadaSong(engine, { seed }), song, 'reproduïble');
  }
  assert.deepEqual([...rhythms].sort(), ['ijexa', 'reggae', 'samba']);
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
