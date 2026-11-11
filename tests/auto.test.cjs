'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const { createPerformance } = require('../audio/performance.cjs');

test('acords per símbols: prestats, dominants secundàries i setenes', () => {
  const pcs = s => engine.chordFromSymbol(0, s).pcs;
  assert.deepEqual(pcs('V7/vi'), [4, 8, 11, 2]);
  assert.deepEqual(pcs('bVII'), [10, 2, 5]);
  assert.deepEqual(pcs('iv'), [5, 8, 0]);
  assert.deepEqual(pcs('ii7'), [2, 5, 9, 0]);
  assert.deepEqual(pcs('Imaj7'), [0, 4, 7, 11]);
  assert.deepEqual(pcs('vii°'), [11, 2, 5]);
  assert.throws(() => engine.chordFromSymbol(0, 'X7'));
});

test('cada subgènere fa servir el seu llenguatge harmònic', () => {
  const symbols = {};
  for (const [key, sg] of Object.entries(engine.SUBGENRES)) {
    const [tonic, mode] = sg.keys[0], set = new Set();
    for (const type of ['verse', 'chorus', 'bridge']) for (let rev = 1; rev <= 5; rev++) {
      const spec = engine.composeSongPart({ seed: 3, style: sg.style, bpm: sg.bpm[0], tonic, mode, subgenre: key }, { type, bars: 4, energy: 60, revision: rev, instruments: ['bass'] });
      spec.chords.forEach(c => set.add(c.symbol));
    }
    symbols[key] = set;
  }
  assert(symbols.jamaican.has('V7') && symbols.jamaican.has('ii7'), 'jazz jamaicà amb setenes');
  assert(symbols.hardcore.has('bII'), 'hardcore amb el bII frigi');
  assert(symbols.horrorpunk.has('bVI'), 'horror punk amb acords prestats foscos');
  assert(!symbols.punk77.has('ii7'));
  assert.throws(() => engine.composeSongPart({ seed: 3, style: 'ska', bpm: 140, tonic: 0, mode: 'major', subgenre: 'hardcore' }, { type: 'verse', bars: 4, energy: 60, revision: 1 }), /Subgènere/);
});

test('el balanceig endarrereix les corxeres a contratemps', () => {
  const sp = swing => engine.composeSongPart({ seed: 3, style: 'ska', bpm: 120, tonic: 5, mode: 'major', ...(swing ? { swing } : {}) }, { type: 'verse', bars: 2, energy: 60, revision: 1, instruments: ['guitar'] });
  const offbeats = s => createPerformance(s).events.filter(e => e.type === 'on' && e.channel === 0).map(e => (e.time / s.beat) % 1);
  const straight = offbeats(sp()), swung = offbeats(sp(.45));
  assert(straight.every(f => Math.abs(f - .5) < .05));
  assert(swung.every(f => f > .55 && f < .63), swung.slice(0, 4).join(','));
});

test('el riff identifica la cançó: es repeteix, s’harmonitza i les respostes no trepitgen la veu', () => {
  const settings = { seed: 4242, style: 'ska', bpm: 140, tonic: 0, mode: 'major', subgenre: 'twotone' };
  const chorus = rev => engine.composeSongPart(settings, { type: 'chorus', bars: 8, energy: 90, revision: rev, instruments: ['trumpet', 'trombone'],
    layers: { trumpet: 1, trombone: 1 }, lineModes: { trumpet: 'riff', trombone: 'riff' } });
  const a = chorus(1), b = chorus(3), rhythm = s => s.lines.trumpet.map(n => [n[0] % 2, n[1], n[3]]);
  assert.deepEqual(rhythm(a), rhythm(b), 'mateix ritme de riff amb acords diferents');
  assert.notDeepEqual(rhythm(a), rhythm(engine.composeSongPart({ ...settings, seed: 777 }, { type: 'chorus', bars: 8, energy: 90, revision: 1, instruments: ['trumpet'], layers: { trumpet: 1 }, lineModes: { trumpet: 'riff' } })));
  a.lines.trumpet.forEach((n, i) => { const d = n[2] - a.lines.trombone[i][2]; assert(d >= 3 && d <= 5, `tercera per sota: ${d}`); });
  const verse = engine.composeSongPart(settings, { type: 'verse', bars: 8, energy: 60, revision: 2, instruments: ['vocal', 'trumpet'],
    layers: { vocal: 2, trumpet: 1 }, lineModes: { trumpet: 'answer' } });
  const span = ([b, t, , d]) => [b * 4 + t, b * 4 + t + d];
  assert(verse.lines.trumpet.length > 0);
  for (const horn of verse.lines.trumpet.map(span)) for (const voice of verse.lines.vocal.map(span))
    assert(horn[0] >= voice[1] - 1e-6 || horn[1] <= voice[0] + 1e-6, 'la resposta sona als silencis de la veu');
});

test('la cançó automàtica compon cançons senceres de 2 a 4 minuts per a cada subgènere', () => {
  const titles = new Set(), fingerprints = new Set();
  for (const key of Object.keys(engine.SUBGENRES)) for (const [seed, minutes] of [[11, 2], [22, 3], [33, 4]]) {
    const song = builder.createAutoSong(engine, key, { seed, minutes });
    const seconds = song.sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || song.settings.bpm), 0);
    assert(seconds >= 110 && seconds <= 255, `${key} ${minutes} min: ${seconds.toFixed(0)} s`);
    assert(Math.abs(seconds - minutes * 60) < 75, `${key}: ${seconds.toFixed(0)} s per a ${minutes} min`);
    let at = 0; for (const s of song.sections) { assert.equal(s.start, at); assert(s.bars <= 32); at += s.bars; }
    assert.equal(at, song.settings.bars);
    for (const c of song.clips) {
      assert(!song.base.instruments.includes(c.instrument));
      assert(!song.clips.some(o => o !== c && o.instrument === c.instrument && o.start < c.start + c.bars && c.start < o.start + o.bars));
    }
    assert(song.clips.some(c => c.line === 'riff'), 'té riff');
    for (const sec of song.sections) {
      const active = song.clips.filter(c => c.start < sec.start + sec.bars && sec.start < c.start + c.bars);
      const h = song.harmony[sec.type] || 1, lineModes = Object.fromEntries(active.filter(c => c.line).map(c => [c.instrument, c.line]));
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision: h, groove: { ...song.settings.groove, ...(sec.groove || {}) },
        instruments: [...song.base.instruments.filter(n => !(sec.mute || []).includes(n)), ...active.map(c => c.instrument)], layers: Object.fromEntries(active.map(c => [c.instrument, c.revision])) };
      if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (h - 1) % 5;
      for (const f of ['bpm', 'transpose', 'feel', 'cymbals', 'ending']) if (sec[f] !== undefined) part[f] = sec[f];
      if (Object.keys(lineModes).length) part.lineModes = lineModes;
      const spec = engine.composeSongPart(song.settings, part);
      if (spec.instruments.length) assert(createPerformance(spec).events.length > 0);
    }
    titles.add(song.title);
    fingerprints.add(JSON.stringify([song.settings.subgenre, song.settings.bpm, song.settings.tonic, song.settings.mode]));
  }
  assert(fingerprints.size >= 20, 'cançons diferents entre elles');
  assert.deepEqual(builder.createAutoSong(engine, 'poppunk', { seed: 9 }), builder.createAutoSong(engine, 'poppunk', { seed: 9 }), 'reproduïble');
});

test('una secció pot quedar sense cap instrument (base silenciada) i continua tenint acords i durada', () => {
  const spec = engine.composeSongPart({ seed: 5, style: 'ska', bpm: 140, tonic: 0, mode: 'major' }, { type: 'intro', bars: 4, energy: 50, revision: 1, instruments: [] });
  assert.equal(spec.instruments.length, 0); assert.equal(spec.chords.length, 4); assert(spec.seconds > 6);
  // Patró propi de l'orgue de la base en una secció.
  const organ = engine.composeSongPart({ seed: 5, style: 'ska', bpm: 140, tonic: 0, mode: 'major' }, { type: 'verse', bars: 2, energy: 50, revision: 1, instruments: ['organ'], layers: { organ: 3 } });
  assert.equal(organ.layers.organ, 2);
});
