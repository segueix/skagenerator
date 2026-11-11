'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
test('la composició respecta els silencis de les capes i de la base a cada secció', () => {
  const from = app.indexOf('  function layersFor(');
  const to = app.indexOf('  const specFor =', from);
  assert.ok(from !== -1 && to > from, 'la composició de les seccions ha de ser accessible');
  const section = { id: 'verse-1', type: 'verse', start: 0, bars: 4, mute: ['trumpet'] };
  const song = { settings: { bars: 4, groove: {} }, base: { instruments: ['drums', 'bass'], revision: 1 },
    harmony: { verse: 1 }, sections: [section],
    clips: [{ id: 'horn', instrument: 'trumpet', start: 0, bars: 4, revision: 7, generated: true }] };
  const scope = { song, TYPES: { verse: { energy: 55 } }, segmentsOf: s => [{ start: 0, bars: 4, section: s.sections[0] }], lyricSyllables: () => [] };
  vm.createContext(scope);
  vm.runInContext(app.slice(from, to) + '\nthis.compose = () => partFor(song, segmentsOf(song)[0]);', scope);
  assert.deepEqual(Array.from(scope.compose().instruments), ['drums', 'bass'], 'la trompeta està silenciada');
  section.mute = ['drums'];
  assert.deepEqual(Array.from(scope.compose().instruments), ['bass', 'trumpet'], 'la trompeta torna i la bateria calla');
  section.mute = [];
  assert.deepEqual(Array.from(scope.compose().instruments), ['drums', 'bass', 'trumpet'], 'sense M tots tornen a sonar');
});

test('hi ha dos reguladors visibles, persistents i independents dels de secció', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  for (const name of ['drums', 'bass']) {
    assert.match(html, new RegExp(`type="range" id="base-volume-${name}"`));
    assert.match(html, new RegExp(`id="base-volume-${name}-value"`));
  }
  assert.match(app, /function changeBaseVolume\(name, db\)/);
  assert.match(app, /settings\.baseVolume/);
});
test('la línia té capçal desplaçable i controls M amb les dues vies de reproducció', () => {
  const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /id="playhead"[^>]*role="slider"/);
  assert.match(html, /type="range" id="song-progress"/);
  assert.match(app, /function seekToBar\(bar\)/);
  assert.match(app, /startBuffer\(data, token, fromSeconds = 0\)/);
  assert.match(app, /source\.start\(0, fromSeconds\)/);
  assert.match(app, /player\.start\(startedAt, fromSeconds\)/);
  assert.match(app, /function timelineMuteButton\(sec, name\)/);
});
