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
    for (const bpm of [engine.SONG_STYLES[style].bpm.min, engine.SONG_STYLES[style].bpm.max]) {
      const spec = engine.composeSongPart({ ...settings, style, bpm, tonic: engine.SONG_STYLES[style].keys[0][0], mode: engine.SONG_STYLES[style].keys[0][1] }, part('chorus'));
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

test('els perfils només admeten ska i punk, amb els seus tempos i tonalitats', () => {
  assert.deepEqual(Object.keys(engine.SONG_STYLES), ['ska', 'punk']);
  assert.throws(() => engine.composeSongPart({ ...settings, style: 'pop' }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, bpm: 99 }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, bpm: 181 }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, style: 'punk', bpm: 139 }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, style: 'punk', bpm: 221 }, part('intro')));
  for (const [style, profile] of Object.entries(engine.SONG_STYLES)) {
    for (const [tonic, mode] of profile.keys) assert.doesNotThrow(() => engine.composeSongPart({ ...settings, style, bpm: profile.bpm.default, tonic, mode }, part('intro')));
  }
  assert.throws(() => engine.composeSongPart({ ...settings, tonic: 11, mode: 'major' }, part('intro')));
});
test('els cinc instruments generen àudio propi i trompeta i trombó són diferents', async () => {
  const samples = [];
  for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) {
    const spec = engine.composeSongPart({ ...settings, instruments: [instrument] }, part('chorus'));
    assert.deepEqual(spec.instruments, [instrument]);
    const audio = await engine.songPartSamples(spec, 4000);
    assert(audio.every(Number.isFinite)); assert(audio.some(n => Math.abs(n) > .01));
    samples.push(audio);
  }
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) assert.notDeepEqual(samples[i], samples[j]);
  assert.throws(() => engine.composeSongPart({ ...settings, instruments: [] }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, instruments: ['piano'] }, part('intro')));
});
