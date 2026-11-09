const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const settings = { seed: 123456, bpm: 112, style: 'ska', tonic: 0, mode: 'major' };
const part = (type, bars = 4, revision = 1) => ({ type, bars, revision, energy: engine.SONG_PARTS[type].energy });
test('les parts comparteixen tonalitat i tempo, i tenen la durada exacta', async () => {
  for (const type of Object.keys(engine.SONG_PARTS)) {
    const spec = engine.composeSongPart(settings, part(type));
    assert.equal(spec.tonic, settings.tonic);
    assert.equal(spec.beat, 60 / settings.bpm);
    const data = await engine.songPartSamples(spec, 4000);
    assert.equal(data.length, Math.round(16 * 60 / settings.bpm * 4000));
    assert(data.every(Number.isFinite));
    assert(data.some(n => Math.abs(n) > .01));
    assert(Math.max(...data) <= .721);
    assert(data[0] === 0); assert(data.at(-1) === 0);
  }
});
test('les tornades repeteixen exactament el motiu i es reprodueixen igual després de desar', async () => {
  const first = engine.composeSongPart(settings, part('chorus', 8));
  const restored = engine.composeSongPart(JSON.parse(JSON.stringify(settings)), JSON.parse(JSON.stringify(part('chorus', 8))));
  assert.deepEqual(first, restored);
  const a = await engine.songPartSamples(first, 4000);
  const b = await engine.songPartSamples(restored, 4000);
  assert.deepEqual(a, b);
  assert.deepEqual(first.melody.filter(n => n[0] < 4), first.melody.filter(n => n[0] >= 4).map(n => [n[0] - 4, ...n.slice(1)]));
  const another = engine.composeSongPart(settings, part('chorus', 8, 2));
  assert.notDeepEqual(first.melody, another.melody);
});
test('els estils i els extrems de tempo generen àudio finit', async () => {
  for (const style of Object.keys(engine.SONG_STYLES)) {
    for (const bpm of [60, 180]) {
      const spec = engine.composeSongPart({ ...settings, style, bpm, tonic: 11, mode: 'minor' }, part('chorus'));
      const data = await engine.songPartSamples(spec, 4000);
      assert.equal(data.length, Math.round(16 * 60 / bpm * 4000));
      assert(data.every(Number.isFinite));
      assert(data.some(n => Math.abs(n) > .01));
    }
  }
});
test('rebutja configuracions impossibles i conserva el compositor original', () => {
  assert.throws(() => engine.composeSongPart({ ...settings, bpm: 0 }, part('intro')));
  assert.throws(() => engine.composeSongPart(settings, part('intro', 100000)));
  assert.throws(() => engine.composeSongPart({ ...settings, mode: 'inventat' }, part('intro')));
  assert.throws(() => engine.composeSongPart(settings, { ...part('intro'), energy: NaN }));
  const original = engine.composeJingle('rumba', 12345, { loop: true });
  assert.equal(original.style, 'rumba'); assert(original.chords.length > 0); assert(original.melody.length > 0);
});
