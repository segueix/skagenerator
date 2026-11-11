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
  const scope = { song, TYPES: { verse: { energy: 55 } }, segmentsOf: s => [{ start: 0, bars: 4, section: s.sections[0] }], lyricSyllables: () => [],
    builder: require('../song-builder.js'), engine: require('../radioambient.js') };
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
test('la línia separa guitarres superposades i les deixa afegir encara que hi hagi guitarra a la base', () => {
  assert.match(app, /const STACKABLE_GUITARS = \['guitar', 'guitar2'\]/);
  assert.match(app, /part\.guitarTakes = extra\.guitarTakes/);
  assert.match(app, /if \(STACKABLE_GUITARS\.includes\(instrument\)\) return \[0, song\.settings\.bars\]/);
  assert.match(app, /stacks\.findIndex\(takes => endOf\(takes\[takes\.length - 1\]\) <= clip\.start\)/);
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

test('volum general de cada instrument + ajust de cada secció (additius) i conversió dels projectes antics', () => {
  const engine = require('../radioambient.js');
  const settings = { seed: 1, style: 'ska', bpm: 120, tonic: 0, mode: 'major', volumes: { trumpet: -6, master: -2 } };
  const part = { type: 'verse', bars: 1, energy: 60, revision: 1, instruments: ['trumpet', 'bass'], volumes: { trumpet: 3 } };
  const mix = engine.composeSongPart(settings, part).mix;
  assert.equal(mix.trumpet.volume, -3, 'general −6 + secció +3');
  assert.equal(mix.master.volume, -2);
  assert.equal(engine.composeSongPart(settings, { ...part, volumes: undefined }).mix.trumpet.volume, -6, 'les altres seccions segueixen el general');
  // L'equalitzador de la secció no anul·la el volum general.
  assert.equal(engine.composeSongPart(settings, { ...part, mix: { trumpet: { low: 3, mid: 0, high: 0, volume: 0 } } }).mix.trumpet.volume, -3);
  for (const bad of [{ volumes: { trumpet: 7 } }, { volumes: { kazoo: 1 } }, { volumes: { trumpet: 1.5 } }])
    assert.throws(() => engine.composeSongPart({ ...settings, ...bad }, part), /Volums/);
  assert.throws(() => engine.composeSongPart(settings, { ...part, volumes: { trumpet: 13 } }), /Volums/);
  // Conversió: abans el volum era dins de l'equalitzador i el de la secció substituïa el de la cançó.
  const from = app.indexOf('  const VOLUME_FAMILY');
  const to = app.indexOf('  function volumeRow(', from);
  assert.ok(from !== -1 && to > from);
  const scope = { isFlat: band => ['low', 'mid', 'high', 'volume'].every(k => band[k] === 0), defaultBaseVolume: () => ({ drums: 0, bass: 0 }) };
  vm.createContext(scope);
  vm.runInContext(app.slice(from, to) + '\nthis.migrate = migrateVolumes;', scope);
  const old = { settings: { mix: { trumpet: { low: 2, mid: 0, high: 0, volume: -4 }, drums: { low: 0, mid: 0, high: 0, volume: -3 } }, baseVolume: { drums: 0, bass: 0 } },
    sections: [{ mix: { trumpet: { low: 0, mid: 0, high: 0, volume: 2 } } }, { mix: { sax: { low: 0, mid: 0, high: 0, volume: -5 } } }, {}] };
  scope.migrate(old);
  const final = (sec, name) => {
    const song = old.settings, band = sec.mix?.[name] || song.mix?.[name] || { volume: 0 };
    return band.volume + (name === 'drums' ? song.baseVolume.drums : song.volumes?.[name] || 0) + (sec.volumes?.[name] || 0);
  };
  assert.equal(final(old.sections[0], 'trumpet'), 2, 'la secció conserva el seu volum');
  assert.equal(final(old.sections[1], 'trumpet'), -4, 'la resta segueix la cançó');
  assert.equal(final(old.sections[1], 'sax'), -5);
  assert.equal(final(old.sections[2], 'drums'), -3, 'la bateria passa al volum general de la base');
  assert.equal(old.settings.mix.trumpet.low, 2, 'l’equalització es conserva');
  assert.equal(old.settings.mix.trumpet.volume, 0);
});
