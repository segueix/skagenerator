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

test('els perfils admeten ska, punk i urban, amb els seus tempos i tonalitats', () => {
  assert.deepEqual(Object.keys(engine.SONG_STYLES), ['ska', 'punk', 'urban']);
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
test('els nou instruments generen àudio propi i trompeta i trombó són diferents', async () => {
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

test('cada part admet una combinació instrumental pròpia independent de la formació base', () => {
  const base = { ...settings, instruments: ['guitar', 'drums', 'bass'] };
  const intro = { ...part('intro'), instruments: ['guitar', 'trumpet', 'trombone'] };
  const verse = { ...part('verse'), instruments: ['bass', 'drums'] };
  const chorus = { ...part('chorus'), instruments: ['guitar', 'drums', 'bass', 'trumpet', 'trombone'] };
  assert.deepEqual(engine.composeSongPart(base, intro).instruments, intro.instruments);
  assert.deepEqual(engine.composeSongPart(base, verse).instruments, verse.instruments);
  assert.deepEqual(engine.composeSongPart(base, chorus).instruments, chorus.instruments);
  assert.deepEqual(engine.composeSongPart(base, part('outro')).instruments, base.instruments);
  assert.deepEqual(base.instruments, ['guitar', 'drums', 'bass']);
  assert.deepEqual(engine.composeSongPart(base, JSON.parse(JSON.stringify(intro))).instruments, intro.instruments);
  assert.deepEqual(engine.composeSongPart({ ...base, instruments: ['drums'] }, intro).instruments, intro.instruments);
  for (const instruments of [[], ['piano'], ['bass', 'bass'], null, 'bass']) {
    assert.throws(() => engine.composeSongPart(base, { ...intro, instruments }));
  }
});

test('cinc versions de cada intro, estrofa i tornada són diferents i recuperables', () => {
  const base = { ...settings, instruments: ['guitar', 'drums', 'bass', 'trumpet', 'trombone'] };
  for (const type of ['intro', 'verse', 'chorus']) {
    const revisions = [11, 12, 13, 14, 15];
    const alternatives = revisions.map((revision, index) =>
      engine.composeSongPart(base, { ...part(type, 8), revision, variants: revisions, selectedVariant: index }));
    assert.equal(new Set(alternatives.map(spec => JSON.stringify([spec.chords.map(chord => chord.root), spec.melody]))).size, 5);
    assert.deepEqual(alternatives.map(spec => spec.variation), [0, 1, 2, 3, 4]);
    assert(alternatives.every(spec => spec.beat === 60 / base.bpm && spec.tonic === base.tonic));
    const restored = JSON.parse(JSON.stringify({ ...part(type, 8), revision: revisions[3], variants: revisions, selectedVariant: 3 }));
    assert.deepEqual(engine.composeSongPart(base, restored), alternatives[3]);
  }
  assert.throws(() => engine.composeSongPart(base, { ...part('bridge'), variantIndex: 3 }));
  assert.throws(() => engine.composeSongPart(base, { ...part('intro'), variantIndex: 6 }));
});

test('les cinc versions donen ritmes de bateria diferents al motor de mostres', () => {
  const performance = require('../audio/performance.cjs');
  const drums = { ...settings, instruments: ['drums'] };
  const patterns = [0, 1, 2, 3, 4].map(index => {
    const spec = engine.composeSongPart(drums, { ...part('verse'), revision: index + 10, variantIndex: index });
    return performance.createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 9)
      .map(e => [e.note, Math.round(e.time / spec.beat * 10) / 10]);
  });
  assert.equal(new Set(patterns.map(JSON.stringify)).size, 5);
});

test('les cinc versions tenen línies de baix diferents en ska i punk', () => {
  const performance = require('../audio/performance.cjs');
  for (const style of ['ska', 'punk']) {
    const cfg = { ...settings, style, bpm: style === 'punk' ? 180 : 128, instruments: ['bass'] };
    for (const type of ['intro', 'verse', 'chorus']) {
      const versions = [21, 22, 23, 24, 25].map((revision, index) =>
        engine.composeSongPart(cfg, { ...part(type, 4), revision, variants: [21, 22, 23, 24, 25], selectedVariant: index }));
      assert.equal(new Set(versions.map(s => JSON.stringify(s.bassLine))).size, 5);
      for (const spec of versions) {
        assert(spec.bassLine.length >= 10);
        assert(spec.bassLine.every(([bar, beat, pitch, length, strength]) =>
          Number.isInteger(bar) && bar >= 0 && beat >= 0 && beat < 4 &&
          Number.isInteger(pitch) && pitch >= 28 && pitch <= 75 && length > 0 && strength > 0));
        const notes = performance.createPerformance(spec).events.filter(e => e.channel === 2 && e.type === 'on');
        assert.equal(notes.length, spec.bassLine.length);
        assert(notes.some(e => e.velocity >= 90));
      }
    }
  }
});

test('el motor alternatiu fa cinc àudios audibles amb només baix', async () => {
  const cfg = { ...settings, instruments: ['bass'] }, versions = [101,102,103,104,105], sounds = [];
  for (let index = 0; index < 5; index++) {
    const spec = engine.composeSongPart(cfg, { ...part('verse', 4),
      revision: versions[index], variants: versions, selectedVariant: index });
    const audio = await engine.songPartSamples(spec, 4000);
    assert(audio.some(value => Math.abs(value) > .01));
    sounds.push(Buffer.from(audio.buffer).toString('base64'));
  }
  assert.equal(new Set(sounds).size, 5);
});
