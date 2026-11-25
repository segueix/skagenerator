const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');
const kit = require('../extra-instruments.json').kits.find(k => k.name === 'Batucada');
const settings = { seed: 7, style: 'ska', bpm: 120, tonic: 0, mode: 'major', timbres: { drums: 'batucada' } };
const part = { type: 'verse', bars: 2, energy: 65, revision: 1, instruments: ['drums'] };
test('cada fila de batucada sona només a la nota i al pas escollits', () => {
  assert.equal(engine.BATUCADA.length, 9);
  assert.equal(Object.keys(kit.pieces).length, 9);
  for (const [row, piece] of engine.BATUCADA.entries()) {
    assert(kit.pieces[piece.note]);
    const pattern = Array(9).fill('0'.repeat(16));
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
