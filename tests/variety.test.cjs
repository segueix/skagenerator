'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const { createPerformance } = require('../audio/performance.cjs');

const base = { seed: 9, style: 'ska', bpm: 120, tonic: 0, mode: 'major' };

test('harmonia v2: acords partits, més progressions per subgènere i les cançons antigues igual', () => {
  // Acord partit: dos acords al mateix compàs; el baix i l'acompanyament canvien a la segona meitat.
  const split = engine.chordFromSymbol(0, 'ii7|V7');
  assert.equal(split.half.symbol, 'V7'); assert(split.pcs.includes(2) && split.half.pcs.includes(7));
  let found = 0;
  for (let seed = 1; seed <= 40 && found < 3; seed++) {
    const spec = engine.composeSongPart({ ...base, seed, subgenre: 'skaswing', harmony: 2 }, { type: 'verse', bars: 8, energy: 70, revision: 1, instruments: ['bass', 'guitar'] });
    const bar = spec.chords.findIndex(c => c.half);
    if (bar < 0) continue;
    found++;
    const half = spec.chords[bar].half, notes = spec.bassLine.filter(n => n[0] === bar && n[1] >= 2);
    assert(notes.length && notes.every(n => half.pcs.includes(((n[2] % 12) + 12) % 12) || n === notes.at(-1)), 'el baix segueix l\'acord de la segona meitat');
    const guitar = createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 0 && e.time >= (bar * 4 + 2.1) * spec.beat && e.time < (bar + 1) * 4 * spec.beat);
    assert(guitar.every(e => half.pcs.includes(e.note % 12)), 'la guitarra també');
  }
  assert(found >= 3, 'hi ha acords partits');
  // Més progressions: amb harmony 2, la mateixa versió dona progressions diferents a cançons diferents.
  const progs = new Set();
  for (let seed = 1; seed <= 30; seed++) progs.add(engine.composeSongPart({ ...base, seed, subgenre: 'twotone', harmony: 2 }, { type: 'verse', bars: 4, energy: 70, revision: 1, instruments: [] }).chords.map(c => c.symbol).join());
  assert(progs.size >= 6, `progressions: ${progs.size}`);
  // Sense harmony (cançons desades abans), la progressió és la de sempre.
  const old = engine.composeSongPart({ ...base, seed: 3, subgenre: 'twotone' }, { type: 'verse', bars: 4, energy: 70, revision: 2, instruments: [] }).chords.map(c => c.symbol);
  assert.deepEqual(old, ['I', 'IV', 'I', 'V']);
  assert.throws(() => engine.composeSongPart({ ...base, subgenre: 'twotone', harmony: 4 }, { type: 'verse', bars: 4, energy: 70, revision: 1, instruments: [] }), /harmonia/);
});

test('formes: blues de 12 compassos, dub, tag i AABA a les cançons d\'ska', () => {
  const blues = engine.composeSongPart({ ...base, subgenre: 'jamaican', harmony: 2 }, { type: 'verse', bars: 12, energy: 70, revision: 1, instruments: [], form: 'blues' }).chords.map(c => c.symbol);
  assert.deepEqual(blues, ['I', 'IV7', 'I', 'I7', 'IV7', 'iv', 'I', 'VI7', 'ii7', 'V7', 'I|VI7', 'ii7|V7']);
  const plain = engine.composeSongPart({ ...base, subgenre: 'twotone', harmony: 2 }, { type: 'verse', bars: 12, energy: 70, revision: 1, instruments: [], form: 'blues' }).chords.map(c => c.symbol);
  assert.deepEqual(plain, ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V7', 'IV', 'I', 'V7']);
  assert.throws(() => engine.composeSongPart(base, { type: 'verse', bars: 12, energy: 70, revision: 1, instruments: [], form: 'jazz' }), /Forma/);
  const seen = { dub: 0, tag: 0, blues: 0, aaba: 0 };
  for (const key of ['jamaican', 'rocksteady', 'twotone', 'bossreggae', 'skaswing']) for (let seed = 1; seed <= 10; seed++) for (const vocal of [true, false]) {
    const song = builder.createAutoSong(engine, key, { seed, vocal }), types = song.sections.map(s => s.type[0]).join('');
    const dub = song.sections.find(s => s.type === 'bridge' && s.mute?.includes('guitar'));
    if (dub) { seen.dub++; assert(!dub.mute.includes('drums') && !dub.mute.includes('bass'), 'al dub, bateria i baix'); }
    const tag = song.sections.find(s => s.tag);
    if (tag) { seen.tag++; assert.equal(tag.bars, 4); assert.equal(song.sections[song.sections.indexOf(tag) + 1].type, 'outro'); }
    if (song.sections.some(s => s.form === 'blues')) { seen.blues++; assert(!vocal, 'blues als instrumentals'); assert(song.sections.filter(s => s.form === 'blues').every(s => s.bars === 12)); }
    if (/^ivvbv/.test(types)) seen.aaba++;
  }
  for (const [kind, n] of Object.entries(seen)) assert(n >= 3, `${kind}: ${n}`);
});

test('baix i bateria per estil: caminant de jazz, rocksteady, fantasmes, shuffle i rockers', () => {
  const names = engine.SONG_GROOVES.ska;
  assert.deepEqual(names.bass.slice(5), ['Caminant de jazz', 'Rocksteady']);
  assert.deepEqual(names.drums.slice(6), ['Ska amb fantasmes', 'Shuffle de swing', 'Rockers']);
  // Caminant de jazz: una nota per temps i, d'un compàs a l'altre, diferents camins (també notes de l'escala fora de l'acord).
  const walk = engine.composeSongPart({ ...base, groove: { bass: 5 } }, { type: 'verse', bars: 4, energy: 70, revision: 1, instruments: ['bass'] });
  for (let bar = 0; bar < 4; bar++) assert.deepEqual(walk.bassLine.filter(n => n[0] === bar).map(n => n[1]), [0, 1, 2, 3]);
  assert(new Set([0, 1, 2].map(bar => walk.bassLine.filter(n => n[0] === bar).map(n => n[2] - walk.bassLine.find(m => m[0] === bar)[2]).join())).size >= 2, 'camins diferents');
  const rock = engine.composeSongPart({ ...base, groove: { bass: 6 } }, { type: 'verse', bars: 2, energy: 70, revision: 1, instruments: ['bass'] });
  assert.deepEqual(rock.bassLine.filter(n => n[0] === 0).map(n => n[1]), [0, 2.5, 3, 3.5]);
  // Fantasmes: cops de caixa molt fluixos entre els accents.
  const drums = groove => engine.composeSongPart({ ...base, groove: { drums: groove } }, { type: 'verse', bars: 2, energy: 70, revision: 1, instruments: ['drums'] }).drumLine;
  const ghosts = drums(6).filter(h => h[2] === 38 && h[3] < 50);
  assert(ghosts.length >= 6 && drums(6).some(h => h[2] === 38 && h[3] > 100), 'fantasmes i accents');
  assert(drums(7).some(h => h[2] === 51) && drums(8).filter(h => h[2] === 42).length >= 20, 'ride del shuffle i charles a semicorxeres');
  // Els subgèneres els fan servir.
  const used = { bass: new Set(), drums: new Set() };
  for (const key of ['jamaican', 'rocksteady', 'skaswing', 'bossreggae']) for (let seed = 1; seed <= 12; seed++) {
    const song = builder.createAutoSong(engine, key, { seed }); used.bass.add(song.settings.groove.bass); used.drums.add(song.settings.groove.drums);
  }
  for (const n of [5, 6]) assert(used.bass.has(n), `baix ${n}`);
  for (const n of [6, 7, 8]) assert(used.drums.has(n), `bateria ${n}`);
});
