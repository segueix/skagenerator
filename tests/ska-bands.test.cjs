'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const bands = require('../ska-bands.js');
const { createPerformance } = require('../audio/performance.cjs');

test('la ràdio alterna formacions i manté un perfil per cançó', () => {
  const recentPrints = [];
  const ids = new Set();
  for (let i = 0; i < 7; i++) {
    const id = bands.choose('twotone', recentPrints, () => 0);
    assert.ok(bands.get(id));
    assert.ok(!ids.has(id));
    ids.add(id);
    recentPrints.unshift({ bandProfile: id });
  }
  assert.equal(bands.choose('twotone', recentPrints, () => 0), [...ids][0]);
  const options = { seed: 122, bandProfiles: true, vocal: false, candidates: 1, recentPrints };
  const song = builder.createAutoSong(engine, 'twotone', options);
  assert.equal(song.settings.bandProfile, [...ids][0]);
  assert.equal(builder.fingerprintOf(engine, song).bandProfile, song.settings.bandProfile);
});

test('els vents d’una formació petita sonen sols fins i tot amb una entrada de vents', () => {
  const settings = { style: 'ska', bpm: 128, tonic: 0, mode: 'major', seed: 17 };
  const part = { type: 'intro', bars: 4, energy: 70, revision: 1, instruments: ['trumpet'], lineModes: { trumpet: 'riff' }, pickup: true };
  const spec = engine.composeSongPart({ ...settings, bandProfile: 'muted' }, part);
  const profiled = createPerformance(spec);
  assert.ok(profiled.events.some(event => event.type === 'on'));
  assert.ok(profiled.events.filter(event => event.type === 'on').every(event => [3, 12].includes(event.channel)));
  const legacy = createPerformance(engine.composeSongPart(settings, part));
  assert.ok(legacy.events.some(event => event.type === 'on' && event.channel === 4));
});

test('el baix amb pua recull el final de frase del saxo en el 2-tone nerviós', () => {
  const spec = engine.composeSongPart({ style: 'ska', bpm: 144, tonic: 0, mode: 'major', seed: 17, humanize: 0, bandProfile: 'angular', timbres: { bass: 'pick' } },
    { type: 'verse', bars: 8, energy: 70, revision: 1, instruments: ['bass', 'sax'], lineModes: { sax: 'theme' } });
  spec.lines.sax = [[3, 2.5, 64, .5]];
  const orig = createPerformance({ ...spec, bandProfile: undefined });
  const answer = createPerformance(spec);
  const at = 14.5 * spec.beat;
  const notes = performance => performance.events.filter(event => event.type === 'on' && Math.abs(event.time - at) < .001);
  assert.ok(notes(orig).some(event => event.channel === 8));
  assert.ok(notes(answer).some(event => event.channel === 2 && event.note === 40));
  assert.ok(notes(answer).every(event => event.channel === 2));
});
