'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');

const part = (settings = {}, extra = {}) => engine.composeSongPart({ seed: 21, style: 'ska', bpm: 140, tonic: 0, mode: 'major', ...settings },
  { type: 'chorus', bars: 8, energy: 90, revision: 1, instruments: ['drums', 'bass', 'guitar', 'trumpet'], ...extra });
const hits = (perf, channel = 9) => perf.events.filter(e => e.type === 'on' && e.channel === channel);
const CYMBALS = [49, 51, 52, 53, 55, 57, 59], HATS = [42, 44, 46];

test('opcions de platets: amb, sense plats, sense platets i pols a l’aro', () => {
  const all = hits(createPerformance(part()));
  assert(all.some(e => CYMBALS.includes(e.note)) && all.some(e => HATS.includes(e.note)));
  const hats = hits(createPerformance(part({ cymbals: 'hats' })));
  assert(!hats.some(e => CYMBALS.includes(e.note)) && hats.some(e => HATS.includes(e.note)));
  const none = hits(createPerformance(part({ cymbals: 'none' })));
  assert(!none.some(e => CYMBALS.includes(e.note) || HATS.includes(e.note)));
  assert(none.some(e => e.note === 36) && none.some(e => e.note === 38), 'bombo i caixa continuen');
  const rim = hits(createPerformance(part({ cymbals: 'rim' })));
  assert(!rim.some(e => CYMBALS.includes(e.note) || HATS.includes(e.note)) && rim.filter(e => e.note === 37).length > 8, 'pols amb l’aro');
  // La secció pot canviar l'opció de la cançó.
  const section = hits(createPerformance(part({ cymbals: 'all' }, { cymbals: 'none' })));
  assert(!section.some(e => HATS.includes(e.note)));
  assert.throws(() => part({ cymbals: 'gong' }), /platets/);
});

test('afinació greu de la bateria i sons gravats nous', () => {
  const perf = createPerformance(part({ drumTune: -4, timbres: { drums: 'rusty', bass: 'upright' } }));
  const drums = perf.channels.find(c => c.channel === 9), bass = perf.channels.find(c => c.channel === 2);
  assert.equal(drums.tune, -4); assert.deepEqual([drums.bank, drums.program], [0, 68]); assert.deepEqual([bass.bank, bass.program], [2, 32]);
  assert(drums.gainDb > 0, 'nivell calibrat');
  for (const [drumsTimbre, program] of [['real', 69], ['club', 66], ['lofi', 67]])
    assert.equal(createPerformance(part({ timbres: { drums: drumsTimbre } })).channels.find(c => c.channel === 9).program, program);
  assert.deepEqual((({ bank, program }) => [bank, program])(createPerformance(part({ timbres: { bass: 'growly' } })).channels.find(c => c.channel === 2)), [4, 33]);
  // Els programes 64 i 65 són els «User Drum Set» GS del sintetitzador: cap kit els fa servir.
  for (const t of ['auto', 'real', 'rusty', 'club', 'lofi']) assert(![64, 65].includes(createPerformance(part({ timbres: { drums: t } })).channels.find(c => c.channel === 9).program));
  assert.throws(() => part({ drumTune: -9 }), /Afinació/);
});

test('humanització: 0 és quantitzat; si no, cada músic té el seu lloc respecte del temps', () => {
  const grid = (perf, channel) => hits(perf, channel).map(e => { const pos = e.time / perf.beat; return (pos - Math.round(pos * 4) / 4) * perf.beat * 1000; });
  const zero = part({ humanize: 0 }), zp = createPerformance(zero); zp.beat = zero.beat;
  for (const ch of [2, 9]) assert(grid(zp, ch).every(ms => Math.abs(ms) < .01 || ch === 9), `canal ${ch} exacte`);
  assert(grid(zp, 2).every(ms => Math.abs(ms) < .01));
  const velocities = hits(zp, 2).map(e => e.velocity);
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  const sp = part({ humanize: 1 }), hp = createPerformance(sp); hp.beat = sp.beat;
  // A l'ska el baix va relaxat, una mica darrere del temps.
  assert(mean(grid(hp, 2)) > 4, `baix endarrerit: ${mean(grid(hp, 2)).toFixed(1)} ms`);
  assert(Math.max(...grid(hp, 2).map(Math.abs)) < 35, 'mai fora de temps');
  assert(new Set(hits(hp, 2).map(e => e.velocity)).size > new Set(velocities).size, 'força variada');
  // Al punk la guitarra empeny endavant.
  const punkGrid = humanize => { const sp = engine.composeSongPart({ seed: 21, style: 'punk', bpm: 180, tonic: 0, mode: 'major', humanize }, { type: 'chorus', bars: 8, energy: 90, revision: 1, instruments: ['guitar'] });
    const perf = createPerformance(sp); perf.beat = sp.beat; return mean(grid(perf, 0)); };
  assert(punkGrid(1) < punkGrid(0) - 1, 'guitarra punk avançada');
  // La deriva és lenta: les desviacions de notes consecutives s'assemblen més que les d'aleatòries.
  const g = grid(hp, 2), diffs = g.slice(1).map((x, i) => Math.abs(x - g[i])), spread = Math.max(...g) - Math.min(...g);
  assert(mean(diffs) < spread * .6);
  assert.throws(() => part({ humanize: 2 }), /Humanització/);
});
