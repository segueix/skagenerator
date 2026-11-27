'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const { createPerformance } = require('../audio/performance.cjs');

const settings = { seed: 11, style: 'ska', bpm: 150, tonic: 0, mode: 'major', instruments: ['drums', 'bass', 'guitar'] };
const part = (extra = {}) => ({ type: 'verse', bars: 4, energy: 70, revision: 1, next: 'chorus', ...extra });

test('gest de canvi de secció: baix, bombo i guitarra preparen junts la secció següent', () => {
  const plain = engine.composeSongPart(settings, part());
  const last = 3, root = plain.chords[last].root;
  // Anticipa: el baix avança la fonamental de l'acord que ve a l'última corxera, el bombo hi pica i la guitarra calla.
  const ahead = engine.composeSongPart(settings, part({ push: 'anticipa', nextRoot: 7 }));
  assert.equal(ahead.push, 'anticipa');
  const bassLast = ahead.bassLine.filter(n => n[0] === last);
  assert.deepEqual(bassLast.at(-1).slice(1, 2), [3.5]); assert.equal(((bassLast.at(-1)[2] % 12) + 12) % 12, 7);
  assert(Math.abs(bassLast.at(-1)[2] - root) <= 6, 'al registre del baix');
  assert(bassLast.every(n => n[1] >= 3.5 || n[1] + n[3] <= 3.5), 'res no s\'hi encavalca');
  assert(ahead.drumLine.some(h => h[0] === last && h[1] === 3.5 && h[2] === 36), 'bombo amb el baix');
  assert(!ahead.drumLine.some(h => h[0] === last && h[1] > 3.5), 'res després del gest');
  const guitar = spec => createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 0).map(e => e.time / spec.beat);
  assert(guitar(plain).some(t => t >= 15.4), 'sense gest, l\'últim contratemps hi és');
  assert(!guitar(ahead).some(t => t >= 15.4), 'amb el gest, la guitarra se\'l menja');
  // Puja: dues notes cromàtiques fins a la fonamental; buit: un cop al tercer temps i el quart, buit.
  const up = engine.composeSongPart(settings, part({ push: 'puja', nextRoot: 7 })).bassLine.filter(n => n[0] === last && n[1] >= 3);
  assert.deepEqual(up.map(n => n[1]), [3, 3.5]); assert.equal(up[1][2] - up[0][2], 1);
  const hole = engine.composeSongPart(settings, part({ push: 'buit' }));
  assert.deepEqual(hole.bassLine.filter(n => n[0] === last && n[1] >= 3).map(n => n[1]), [3]);
  assert(!hole.drumLine.some(h => h[0] === last && h[1] > 3) && !guitar(hole).some(t => t >= 15));
  // No es fa cap a una aturada ni a l'últim compàs de la cançó.
  assert.equal(engine.composeSongPart(settings, part({ push: 'anticipa', ending: 'break' })).push, undefined);
  assert.equal(engine.composeSongPart(settings, part({ push: 'anticipa', next: 'end' })).push, undefined);
  assert.throws(() => engine.composeSongPart(settings, part({ push: 'salta' })), /Gest/);
});

test('el generador tria un gest per a cada pas de secció i el repeteix quan torna', () => {
  let songs = 0, repeated = 0;
  for (const key of ['jamaican', 'twotone', 'rocksteady', 'skaswing']) for (let seed = 1; seed <= 12; seed++) {
    const song = builder.createAutoSong(engine, key, { seed });
    if (song.settings.style !== 'ska') continue;
    const ordered = [...song.sections].sort((a, b) => a.start - b.start), seen = new Map();
    ordered.forEach((sec, i) => {
      if (!sec.push) return;
      const k = `${sec.type}>${ordered[i + 1].type}`;
      if (seen.has(k)) { assert.equal(sec.push, seen.get(k), `${key} ${seed}: ${k}`); repeated++; }
      seen.set(k, sec.push);
    });
    if (seen.size) songs++;
  }
  assert(songs >= 20 && repeated >= 10, `${songs} cançons, ${repeated} represes`);
});

test('mà dreta de l\'ska: cops secs, oberts i apagats que es repeteixen cada quatre compassos', () => {
  const lengths = spec => {
    const perf = createPerformance(spec), on = perf.events.filter(e => e.channel === 0 && e.type === 'on'), off = perf.events.filter(e => e.channel === 0 && e.type === 'off');
    // (Durada de la primera corda de cada cop, per compàs i cop.)
    const byBar = new Map();
    for (const e of on) {
      const end = off.find(o => o.note === e.note && o.time > e.time).time, bar = Math.floor(e.time / (spec.beat * 4) + 1e-6);
      const key = `${bar}:${Math.round((e.time / spec.beat - bar * 4) * 4) / 4}`;
      if (!byBar.has(key)) byBar.set(key, (end - e.time) / spec.beat);
    }
    return byBar;
  };
  const opts = { ...settings, instruments: ['guitar'] };
  const verse = lengths(engine.composeSongPart(opts, { type: 'verse', bars: 8, energy: 70, revision: 1 }));
  const chorus = lengths(engine.composeSongPart(opts, { type: 'chorus', bars: 8, energy: 80, revision: 1 }));
  const lastHit = (map, bar) => map.get([...map.keys()].filter(k => k.startsWith(`${bar}:`)).sort((a, b) => parseFloat(a.split(':')[1]) - parseFloat(b.split(':')[1])).at(-1));
  // A l'estrofa, l'últim cop del quart compàs és apagat (molt curt); a la tornada, obert (llarg).
  for (const bar of [3, 7]) { assert(lastHit(verse, bar) < .1, `apagat ${bar}`); assert(lastHit(chorus, bar) > .3, `obert ${bar}`); }
  for (const bar of [0, 4]) assert(lastHit(verse, bar) > .1 && lastHit(verse, bar) < .3, `sec ${bar}`);
});

test('trombó legato gravat: les notes lligades (sense cop de llengua) les toca el canal legato', () => {
  const real = require('../real-instruments.json').localHorns.find(h => h.program === 58);
  assert.deepEqual([real.bank, real.program], [5, 58]);
  for (const n of real.notes) assert(require('node:fs').existsSync(require('node:path').join(__dirname, '..', real.directory, n.file)), n.file);
  const spec = engine.composeSongPart({ ...settings, instruments: ['trombone'] }, { type: 'chorus', bars: 2, energy: 80, revision: 1, layers: { trombone: 3 } });
  // Do–re–mi lligades, després do–do (repetida: es torna a picar) i una nota separada.
  spec.lines.trombone = [[0, 0, 60, 1], [0, 1, 62, 1], [0, 2, 64, 1], [0, 3, 64, 1], [1, 1, 67, 1]];
  const perf = createPerformance(spec), legato = perf.channels.find(p => p.bank === 5 && p.program === 58).channel;
  const on = perf.events.filter(e => e.type === 'on' && [4, 13, legato].includes(e.channel)).sort((a, b) => a.time - b.time);
  assert.deepEqual(on.map(e => e.channel === legato), [false, true, true, false, false], 'lligades al legato; la primera, la repetida i la separada, amb llengua');
  // Amb un altre so de trombó triat, no hi ha canal legato.
  const other = engine.composeSongPart({ ...settings, instruments: ['trombone'], timbres: { trombone: 'vsco' } }, { type: 'chorus', bars: 2, energy: 80, revision: 1, layers: { trombone: 3 } });
  assert(!createPerformance(other).channels.some(p => p.bank === 5 && p.program === 58));
});

test('guitarra d\'skank: posicions de guitarra a les quatre cordes agudes, cop amunt i so brillant', () => {
  const spec = engine.composeSongPart({ ...settings, instruments: ['guitar'] }, { type: 'verse', bars: 8, energy: 70, revision: 1 });
  const perf = createPerformance(spec), on = perf.events.filter(e => e.type === 'on' && e.channel === 0).sort((a, b) => a.time - b.time);
  const strokes = [];
  for (const e of on) { const last = strokes.at(-1); if (last && e.time - last[0].time < .06) last.push(e); else strokes.push([e]); }
  const strings = [50, 55, 59, 64];
  let moves = 0;
  strokes.forEach((stroke, i) => {
    const bar = Math.min(spec.chords.length - 1, Math.floor(stroke[0].time / (spec.beat * 4) + 1e-6)), chord = spec.chords[bar];
    const notes = stroke.map(e => e.note), sorted = notes.slice().sort((a, b) => a - b);
    // Cop amunt: de l'aguda a la greu.
    assert.deepEqual(notes, sorted.slice().reverse(), 'cop amunt');
    // Cada nota és d'una corda (Re, Sol, Si, Mi) entre el trast 0 i el 12, i de l'acord; hi ha la fonamental i la tercera.
    if (sorted.length === 4) {
      const frets = sorted.map((n, k) => n - strings[k]);
      assert(frets.every(f => f >= 0 && f <= 12), `trasts ${frets}`);
      const used = frets.filter(f => f > 0); assert(!used.length || Math.max(...used) - Math.min(...used) <= 3, `obertura ${frets}`);
      assert(sorted.every(n => chord.pcs.includes(n % 12)));
      assert(sorted.some(n => n % 12 === chord.root % 12) && sorted.some(n => n % 12 === chord.notes[1] % 12));
      if (i && strokes[i - 1].length === 4) moves += sorted.reduce((t, n, k) => t + Math.abs(n - strokes[i - 1].map(e => e.note).sort((a, b) => a - b)[k]), 0);
    }
  });
  // D'un acord a l'altre la mà es mou poc (de mitjana, menys de 3 semitons per corda i cop).
  assert(moves / strokes.length / 4 < 3, `moviment ${moves / strokes.length / 4}`);
  // So de l'skank: equalitzador propi i una mica més de reverberació.
  assert.equal(perf.channels.find(c => c.channel === 0).tone, 'skank');
});
