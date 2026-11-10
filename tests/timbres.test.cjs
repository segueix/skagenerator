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
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 9), 0);
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
  for (const timbres of [{ guitar: 'piano' }, { bass: 'slap' }, { drums: 'jazz' }, { cello: 'auto' }]) {
    assert.throws(() => createPerformance({ ...spec, timbres }), /Timbres no vàlids/);
  }
});
