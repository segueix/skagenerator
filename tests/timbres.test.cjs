'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');
const config = { seed: 771, style: 'ska', bpm: 128, tonic: 0, mode: 'major',
  instruments: ['guitar', 'bass', 'drums'] };
const part = { type: 'verse', bars: 4, energy: 60, revision: 1 };
const patch = (performance, channel) => performance.channels.find(p => p.channel === channel).program;

test('per defecte els presets mantenen l’estil original', () => {
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 0), 27);
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 2), 33);
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 9), 32);
  const punk = engine.composeSongPart({ ...config, style: 'punk', bpm: 180 }, part);
  assert.equal(patch(createPerformance(punk), 0), 30);
  assert.equal(patch(createPerformance(punk), 2), 34);
  assert.equal(patch(createPerformance(punk), 9), 16);
});

test('els presets triats canvien els tres instruments i la guitarra secundària', () => {
  const spec = engine.composeSongPart({ ...config, timbres: {
    guitar: 'muted', bass: 'pick', drums: 'electronic'
  } }, part);
  const music = createPerformance(spec);
  assert.equal(patch(music, 0), 28);
  assert.equal(patch(music, 1), 28);
  assert.equal(patch(music, 2), 34);
  assert.equal(patch(music, 9), 24);
});

test('els sons de la part substitueixen només els sons base indicats', () => {
  const spec = engine.composeSongPart({ ...config, timbres: {
    guitar: 'clean', bass: 'finger', drums: 'rock'
  } }, { ...part, timbres: { guitar: 'distortion', drums: 'standard' } });
  const performance = createPerformance(spec);
  assert.deepEqual(spec.timbres, { guitar: 'distortion', bass: 'finger', drums: 'standard' });
  assert.equal(patch(performance, 0), 30);
  assert.equal(patch(performance, 2), 33);
  assert.equal(patch(performance, 9), 0);
});

test('es rebutgen els sons desconeguts', () => {
  const spec = engine.composeSongPart(config, part);
  for (const timbres of [{ guitar: 'piano' }, { bass: 'slap' }, { drums: 'disco' }, { cello: 'auto' }]) {
    assert.throws(() => createPerformance({ ...spec, timbres }), /Timbres no vàlids/);
  }
});

test('metalls amb variacions de banc, saxo, orgue i articulació', () => {
  const spec = engine.composeSongPart({ ...config, instruments: ['trumpet', 'trombone', 'sax', 'organ'],
    timbres: { trumpet: 'bright', trombone: 'warm' } }, { ...part, layers: { trumpet: 2, trombone: 3, sax: 4, organ: 2 } });
  const music = createPerformance(spec), entry = channel => music.channels.find(p => p.channel === channel);
  assert.deepEqual([entry(3).bank, entry(3).program, entry(4).bank, entry(4).program], [1, 56, 1, 57]);
  assert.deepEqual([entry(8).program, entry(8).instrument, entry(11).program, entry(11).instrument], [66, 'sax', 16, 'organ']);
  assert.equal(createPerformance(engine.composeSongPart({ ...config, timbres: { trumpet: 'muted' } }, part)).channels.find(p => p.channel === 3).program, 59);
  const on = channel => music.events.filter(e => e.type === 'on' && e.channel === channel);
  assert(on(8).length > 0 && on(11).length > 0);
  // Cada nota de metall porta expressió i inflexió (pujada d'afinació o centre).
  assert(music.events.some(e => e.type === 'pitch' && e.channel === 3 && e.value < 8192));
  assert(music.events.some(e => e.type === 'cc' && e.controller === 11 && e.channel === 8));
  assert(music.events.every((e, i, all) => !i || all[i - 1].time <= e.time));
  assert(music.events.filter(e => e.type === 'pitch').every(e => e.value >= 0 && e.value <= 16383));
  // L'orgue té cinc patrons i el saxo una línia pròpia, una octava sota.
  const organs = [1, 2, 3].map(rev => createPerformance(engine.composeSongPart({ ...config, instruments: ['organ'] }, { ...part, layers: { organ: rev } }))
    .events.filter(e => e.type === 'on').length);
  assert(new Set(organs).size > 1);
  assert(Math.max(...on(8).map(e => e.note)) < Math.max(...on(3).map(e => e.note)));
});

test('l’equalitzador es valida i arriba a la interpretació', () => {
  const flat = { low: 0, mid: 0, high: 0, volume: 0 };
  const spec = engine.composeSongPart({ ...config, mix: { bass: { ...flat, low: 4 }, master: { ...flat, high: -3 } } },
    { ...part, mix: { bass: { ...flat, volume: -6 } } });
  assert.deepEqual(spec.mix, { bass: { ...flat, volume: -6 }, master: { ...flat, high: -3 } });
  assert.deepEqual(createPerformance(spec).mix, spec.mix);
  for (const mix of [{ piano: flat }, { bass: { ...flat, low: 13 } }, { bass: { ...flat, volume: -25 } }, { bass: { low: 0 } }, { bass: { ...flat, mid: NaN } }, [], null])
    assert.throws(() => engine.composeSongPart({ ...config, mix }, part), /Equalitzador/);
});
