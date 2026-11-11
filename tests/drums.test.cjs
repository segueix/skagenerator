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
  const perf = createPerformance(part({ drumTune: -4, timbres: { drums: 'rusty', bass: 'growly' } }));
  const drums = perf.channels.find(c => c.channel === 9), bass = perf.channels.find(c => c.channel === 2);
  assert.equal(drums.tune, -4); assert.deepEqual([drums.bank, drums.program], [0, 68]); assert.deepEqual([bass.bank, bass.program], [4, 33]);
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

test('arranjament: redobles variats, aturades de banda, compte d’entrada i final', () => {
  const settings = { seed: 4, style: 'punk', bpm: 180, tonic: 9, mode: 'major' };
  const verse = extra => engine.composeSongPart(settings, { type: 'verse', bars: 4, energy: 80, revision: 1, instruments: ['drums', 'bass', 'guitar'], ...extra });
  const lastBar = spec => JSON.stringify(spec.drumLine.filter(h => h[0] === 3 && h[1] >= 2));
  // Cada secció pot triar un redoble diferent, i el que porta a una tornada és més gran que el que porta a una estrofa.
  assert(new Set([0, 1, 2, 3, 4].map(fill => lastBar(verse({ next: 'chorus', fill })))).size >= 4);
  const size = spec => spec.drumLine.filter(h => h[0] === 3 && h[1] >= 2 && h[2] !== 42 && h[2] !== 46).length;
  assert(size(verse({ next: 'chorus', fill: 0 })) > size(verse({ next: 'verse', fill: 0 })));
  // Aturada: la banda calla després del cop i només la bateria fa el redoble d'entrada.
  const stop = verse({ ending: 'stop', next: 'chorus' }), perf = createPerformance(stop);
  assert(stop.stopAt > stop.beat * 12 && stop.stopAt < stop.seconds);
  assert.equal(perf.events.filter(e => e.type === 'on' && e.channel !== 9 && e.time >= stop.stopAt).length, 0);
  assert(perf.events.some(e => e.type === 'on' && e.channel === 9 && e.time >= stop.stopAt));
  assert(perf.events.filter(e => e.type === 'off' && e.channel !== 9).every(e => e.time <= stop.stopAt + .01 || e.time < stop.beat * 12));
  // Compte d'entrada: quatre cops de baqueta i res més al primer compàs.
  const count = verse({ countIn: true }), cp = createPerformance(count);
  assert.deepEqual(cp.events.filter(e => e.type === 'on' && e.time < count.beat * 4 - .02).map(e => e.note), [37, 37, 37, 37]);
  assert.throws(() => verse({ ending: 'pausa' }), /Final de secció/);
  assert.throws(() => verse({ next: 'tornada' }), /Secció següent/);
});

test('gravacions alternades a la bateria i guitarres doblades amb preses diferents', () => {
  const ROUND_ROBIN = require('../round-robin.json');
  const settings = { seed: 4, style: 'punk', bpm: 180, tonic: 9, mode: 'major' };
  const drums = timbre => createPerformance(engine.composeSongPart({ ...settings, timbres: { drums: timbre } }, { type: 'verse', bars: 8, energy: 80, revision: 1, instruments: ['drums'] }));
  for (const kit of ['rusty', 'real']) {
    const hitsOf = piece => drums(kit).events.filter(e => e.type === 'on' && e.channel === 9 && [piece, ...ROUND_ROBIN.keys[piece]].includes(e.note)).map(e => e.note);
    for (const piece of [36, 38]) {
      const list = hitsOf(piece);
      assert(new Set(list).size === 3, `${kit} ${piece}: tres gravacions`);
      assert(list.every((note, i) => i === 0 || note !== list[i - 1]), `${kit} ${piece}: mai la mateixa dues vegades seguides`);
    }
  }
  assert(drums('standard').events.every(e => e.type !== 'on' || e.note < 88), 'els kits GM no fan servir alternatives');
  // Guitarres doblades: dues preses desafinades una mica entre elles, amb el pedal en un punt diferent.
  const horror = createPerformance(engine.composeSongPart({ ...settings, fx: { guitar: { type: 'horrorpunkFidel', drive: 70, tone: 60 } } },
    { type: 'verse', bars: 2, energy: 80, revision: 1, instruments: ['guitar'] }));
  const bends = Object.fromEntries(horror.events.filter(e => e.type === 'pitch' && e.time === 0).map(e => [e.channel, e.value]));
  assert(bends[0] < 8192 && bends[1] > 8192);
  assert.deepEqual(horror.channels.find(c => c.channel === 1).fxTweak, { drive: -10, tone: 8 });
  const takes = channel => horror.events.filter(e => e.type === 'on' && e.channel === channel).map(e => e.time);
  assert(takes(0).some((t, i) => Math.abs(takes(1)[i] - t - .009) > .002), 'cada presa té el seu ritme humà');
});

test('bateria punk menys mecànica i segona bateria a contratemps', () => {
  const engine = require('../radioambient.js');
  const spec = extra => engine.composeSongPart({ seed: 9, style: 'punk', bpm: 186, tonic: 9, mode: 'major' },
    { type: 'verse', bars: 16, energy: 75, revision: 1, instruments: ['drums'], fill: 3, ...extra });
  const bars = line => { const out = []; for (const [b, t, note] of line) (out[b] ||= []).push(`${t}:${note}`); return out.map(x => x.sort().join()); };
  const plain = bars(spec().drumLine).slice(0, 15);
  assert(new Set(plain).size >= 4, 'els compassos no són tots iguals');
  const off = spec({ offbeat: true }).drumLine.filter(([b, t, note]) => note === 43 && b < 15);
  assert(off.length >= 40 && off.every(([, t]) => t % 1 === .5), 'timbal base a cada contratemps');
  assert.throws(() => spec({ offbeat: 'sí' }), /Segona bateria/);
});
