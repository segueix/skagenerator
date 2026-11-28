'use strict';
// Corpus de 50 cançons d'ska (data/corpus-ska/): progressions (harmonia v3) i formes.
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');

const SKA = Object.keys(engine.SUBGENRES).filter(key => engine.SUBGENRES[key].style === 'ska');

test('corpus: totes les progressions es poden tocar i amplien la paleta de la v3 (la v2 no canvia)', () => {
  let added = 0;
  for (const [key, modes] of Object.entries(engine.CORPUS_HARMONY)) {
    assert(SKA.includes(key), key);
    for (const [mode, types] of Object.entries(modes)) for (const [type, list] of Object.entries(types)) {
      assert(engine.SONG_PARTS[type], type);
      for (const prog of list) {
        assert([2, 4, 8].includes(prog.length), `${key} ${prog}`);
        for (const symbol of prog) engine.chordFromSymbol(0, symbol);
      }
      const v2 = engine.paletteFor(key, mode, type, 2) || [], v3 = engine.paletteFor(key, mode, type, 3);
      assert(v3.length >= v2.length && v2.every((p, i) => p.join() === v3[i].join()), `${key} ${mode} ${type}: la v3 comença per la v2`);
      added += v3.length - v2.length;
    }
  }
  assert(added >= 100, `progressions noves: ${added}`);
});

test('corpus: cançons seguides, totes amb acords diferents i formes variades', () => {
  let prints = [];
  const combos = new Set(), forms = new Set();
  let n = 0;
  for (const key of SKA) for (let seed = 1; seed <= 6; seed++) {
    const song = builder.createAutoSong(engine, key, { seed: seed * 31, minutes: 3, recentPrints: prints });
    assert.equal(song.settings.harmony, 3);
    assert(song.settings.picks && Object.values(song.settings.picks).every(Number.isInteger));
    const print = builder.fingerprintOf(engine, song);
    // Cap estrofa ni tornada no repeteix la de les dues cançons anteriors.
    for (const other of prints.slice(0, 2)) {
      if (print.chorusChords) assert.notEqual(print.chorusChords, other.chorusChords, `${key} ${seed}: tornada repetida`);
    }
    prints = [print, ...prints];
    combos.add(`${print.verseChords}/${print.chorusChords}`);
    forms.add([...song.sections].sort((a, b) => a.start - b.start).map(s => s.type[0] + s.bars).join(''));
    n++;
  }
  assert(combos.size >= n - 2, `combinacions d'acords: ${combos.size} de ${n}`);
  assert(forms.size >= n * .8, `formes: ${forms.size} de ${n}`);
});
