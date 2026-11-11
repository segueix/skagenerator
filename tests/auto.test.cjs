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
      for (const f of ['bpm', 'transpose', 'feel', 'cymbals', 'ending', 'entrance', 'exit']) if (sec[f] !== undefined) part[f] = sec[f];
      if (sec.closing && sec.type === 'outro') part.closing = sec.closing;
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

test('el selector de qualitat puntua l’harmonia, el clímax, les cadències i els xocs entre línies', () => {
  const C = engine.chordFromSymbol(0, 'I'), chords = Array(4).fill(C);
  // Mateix contorn: notes de l'acord a temps (do-mi-sol) contra notes de fora (re-fa-la).
  const line = pitches => pitches.map((p, i) => [Math.floor(i / 4), i % 4, p, i === pitches.length - 1 ? 2 : 1]);
  const inside = line([60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 62, 60]), outside = line([62, 64, 65, 67, 69, 67, 65, 64, 62, 64, 65, 64, 62]);
  assert(builder.lineScore(inside, { chords }) > builder.lineScore(outside, { chords }) + 1, 'encaix amb els acords');
  // Una segona menor sostinguda contra una altra línia resta punts.
  const clash = inside.map(([b, t, , d]) => [b, t, 61, d]), unison = inside.map(([b, t, p, d]) => [b, t, p - 12, d]);
  assert(builder.lineScore(inside, { chords, others: [unison] }) > builder.lineScore(inside, { chords, others: [clash] }) + 3, 'xocs');
  // Un sol clímax per frase.
  const one = line([60, 62, 64, 67, 72, 67, 64, 62, 60]), many = line([60, 72, 64, 72, 62, 72, 64, 72, 60]);
  assert(builder.lineScore(one) > builder.lineScore(many));
  // La forma de la cançó: estrofa i tornada diferents i arribada a la tornada des de la dominant.
  const form = map => builder.harmonyScore(type => map[type] || null);
  assert(form({ verse: ['vi', 'IV', 'ii', 'V'], chorus: ['I', 'V', 'vi', 'IV'] }) > form({ verse: ['I', 'V', 'vi', 'IV'], chorus: ['I', 'V', 'vi', 'IV'] }) + 3);
});

test('la cançó automàtica tria versions sense xocs i amb la veu de la tornada més aguda', () => {
  for (const key of ['twotone', 'poppunk', 'rocksteady']) {
    const song = builder.createAutoSong(engine, key, { seed: 31 });
    const voice = type => {
      const sec = song.sections.find(s => s.type === type), clip = song.clips.find(c => c.instrument === 'vocal' && c.start === sec.start);
      const h = song.harmony[type] || 1, p = { type, bars: sec.bars, energy: sec.energy, revision: h, instruments: ['vocal'], layers: { vocal: clip.revision } };
      if (['intro', 'verse', 'chorus'].includes(type)) p.variantIndex = (h - 1) % 5;
      for (const f of ['bpm', 'transpose']) if (sec[f] !== undefined) p[f] = sec[f];
      const line = engine.composeSongPart(song.settings, p).lines.vocal;
      return line.reduce((t, n) => t + n[2], 0) / line.length;
    };
    assert(voice('chorus') > voice('verse') + 1, `${key}: tornada més aguda que l’estrofa`);
  }
});

test('inicis, finals i silencis: cada clic en tria uns altres i la cançó continua sent vàlida', () => {
  const song = builder.createAutoSong(engine, 'twotone', { seed: 77 });
  assert(song.edges && builder.OPENINGS[song.edges.opening] && builder.CLOSINGS[song.edges.closing], 'la cançó automàtica en porta');
  const seen = { opening: new Set(), closing: new Set(), middle: new Set() };
  let previous = song.edges;
  for (let seed = 1; seed <= 30; seed++) {
    const result = builder.designEdges(engine, song, { seed });
    assert.notEqual(result.opening, previous.opening, 'no repeteix l’inici');
    assert.notEqual(result.closing, previous.closing, 'no repeteix el final');
    for (const k of ['opening', 'closing', 'middle']) seen[k].add(result[k]);
    previous = song.edges;
    // Només hi ha un silenci al mig, just abans d'una tornada, i els clips afegits no es dupliquen.
    const silent = song.sections.filter(s => ['break', 'silence'].includes(s.ending));
    assert(silent.length <= 1);
    for (const sec of silent) assert.equal(song.sections[song.sections.indexOf(sec) + 1].type, 'chorus');
    assert(song.clips.filter(c => c.edge).length <= 2);
    for (const sec of song.sections) {
      const active = song.clips.filter(c => c.start < sec.start + sec.bars && sec.start < c.start + c.bars && !(sec.mute || []).includes(c.instrument));
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision: 1, instruments: [...song.base.instruments.filter(n => !(sec.mute || []).includes(n)), ...new Set(active.map(c => c.instrument))],
        layers: Object.fromEntries(active.map(c => [c.instrument, c.revision])) };
      for (const f of ['bpm', 'feel', 'ending', 'entrance', 'exit']) if (sec[f] !== undefined) part[f] = sec[f];
      if (sec.closing) part.closing = sec.closing;
      const spec = engine.composeSongPart(song.settings, part);
      if (spec.instruments.length) createPerformance(spec);
    }
  }
  assert(seen.opening.size >= 7, `inicis diferents: ${[...seen.opening]}`);
  assert(seen.closing.size >= 6, `finals diferents: ${[...seen.closing]}`);
  assert(seen.middle.has('break') && seen.middle.has('silence') && seen.middle.has('none'));
  // Triats a mà: bateria sola a l'inici i la banda que calla per capes al final.
  builder.designEdges(engine, song, { seed: 3, opening: 'drums', closing: 'breakdown', middle: 'none' });
  const first = song.sections[0], last = song.sections.at(-1);
  assert.deepEqual(first.mute, song.base.instruments.filter(n => n !== 'drums').concat(first.mute.filter(n => !song.base.instruments.includes(n))));
  assert(!('drums' in last.exit) && Object.values(last.exit).every(b => b >= 1 && b <= last.bars));
  // El fos d'entrada es desfà en triar-ne un altre.
  builder.designEdges(engine, song, { seed: 4, opening: 'fadein', closing: 'fadeout', middle: 'none' });
  assert.equal(song.sections[0].fade, 'in'); assert.equal(song.sections.at(-1).fade, 'out'); assert.equal(song.sections.at(-1).closing, 'fade');
  builder.designEdges(engine, song, { seed: 5, opening: 'band', closing: 'hit', middle: 'none' });
  assert.equal(song.sections[0].fade, undefined); assert.equal(song.sections.at(-1).fade, undefined); assert.equal(song.sections.at(-1).closing, undefined);
});

test('la cançó automàtica tria la millor de diverses candidates i fa créixer les estrofes', () => {
  const one = builder.createAutoSong(engine, 'poppunk', { seed: 12, candidates: 1 }), three = builder.createAutoSong(engine, 'poppunk', { seed: 12 });
  assert.deepEqual(builder.createAutoSong(engine, 'poppunk', { seed: 12 }), three, 'reproduïble');
  for (const song of [one, three]) {
    const verses = song.sections.filter(s => s.type === 'verse');
    for (let i = 1; i < verses.length; i++) assert(verses[i].energy > verses[i - 1].energy, 'cada estrofa més plena');
  }
});

test('la cançó automàtica fa servir els recursos especials amb mesura i als millors moments', () => {
  const counts = {};
  for (const key of Object.keys(engine.SUBGENRES)) for (let seed = 1; seed <= 6; seed++) for (const minutes of [2, 4]) {
    const song = builder.createAutoSong(engine, key, { seed: seed * 13 + minutes, minutes });
    const seconds = song.sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || song.settings.bpm), 0);
    const stops = song.sections.filter(s => s.ending === 'stop'), silent = song.sections.filter(s => ['break', 'silence'].includes(s.ending));
    const fades = song.sections.filter(s => s.fade), colors = song.clips.filter(c => c.color);
    const used = (song.edges.opening !== 'band') + (song.edges.closing !== 'hit') + stops.length + silent.length + colors.length;
    assert(used <= (seconds < 150 ? 2 : seconds < 210 ? 3 : 4), `${key} ${seed}: ${used} recursos en ${seconds.toFixed(0)} s`);
    assert(stops.length <= 1 && silent.length <= 1 && fades.length <= 1 && colors.length <= 1, `${key} ${seed}: sense abusar`);
    // Silencis i aturades només abans d'una tornada, i mai seguits.
    for (const sec of [...stops, ...silent]) assert.equal(song.sections[song.sections.indexOf(sec) + 1].type, 'chorus');
    if (stops.length && silent.length) assert(Math.abs(song.sections.indexOf(stops[0]) - song.sections.indexOf(silent[0])) >= 2);
    // El fos de sortida només en un final prou llarg; el color, a la intro o al pont.
    if (song.sections.at(-1).fade === 'out') assert(song.sections.at(-1).bars >= 4);
    for (const c of colors) assert(['intro', 'bridge', 'solo'].includes(song.sections.find(s => s.start === c.start).type));
    counts[used] = (counts[used] || 0) + 1;
  }
  assert(Object.keys(counts).length >= 3, `quantitats variades: ${JSON.stringify(counts)}`);
  // Els subgèneres lents tendeixen al fos; el hardcore, al tall en sec.
  const closings = key => Array.from({ length: 8 }, (_, i) => builder.createAutoSong(engine, key, { seed: 100 + i, candidates: 1 }).edges.closing);
  assert(closings('rocksteady').filter(c => c === 'fadeout').length >= 5);
  assert(closings('hardcore').filter(c => c === 'cold').length >= 5);
  assert(!closings('hardcore').includes('fadeout'));
});

test('comentaris de les cançons i informe exportable per analitzar-les', () => {
  const song = builder.createAutoSong(engine, 'poppunk', { seed: 8 });
  const chorus = song.sections.find(s => s.type === 'chorus');
  song.comments = [
    { id: 'c1', text: '  La tornada enganxa  ', bar: chorus.start, tag: 'melody', mood: 'good', created: 1 },
    { id: 'c2', text: 'Final massa sobtat', bar: null, tag: 'closing', mood: 'bad', created: 2 },
    { id: 'c3', text: 'Fora de la cançó', bar: 9999, tag: 'other', mood: 'idea', created: 3 },
    { id: 'c1', text: 'repetit', bar: null, tag: 'general', mood: 'good' },
    { id: 'c4', text: '   ', bar: null, tag: 'general', mood: 'good' },
    { id: 'c5', text: 'tema dolent', bar: null, tag: 'kazoo', mood: 'good' }];
  const clean = builder.cleanComments(song.comments, song.settings.bars);
  assert.deepEqual(clean.map(c => c.id), ['c1', 'c2', 'c3']);
  assert.equal(clean[0].text, 'La tornada enganxa');
  assert.equal(clean[2].bar, song.settings.bars - 1, 'el compàs es limita a la cançó');
  const report = builder.feedbackReport(engine, [{ rating: 4, created: 5, song }, { rating: 0, created: 6, song: { ...song, comments: [] } }], 0);
  assert.equal(report.format, 'skagenerator-feedback');
  assert.deepEqual(report.totals, { songs: 2, rated: 1, comments: 3 });
  const first = report.songs[0];
  assert.equal(first.rating, 4);
  assert.match(first.comments[0].where, /^Tornada \(compassos \d+–\d+\) · compàs \d+ · \d+:\d\d$/);
  assert.equal(first.comments[0].mood, '👍 M’agrada'); assert.equal(first.comments[1].where, 'Tota la cançó');
  assert.equal(first.summary.sections.length, song.sections.length);
  assert.equal(first.summary.resources.opening, song.edges.opening);
  assert.equal(first.project.title, song.title);
  assert(!('libraryId' in first.project));
  assert.doesNotThrow(() => JSON.stringify(report));
});

test('millores dels comentaris: transicions suaus, guitarra 2, varietat al punk i compensació de volum', () => {
  // Canvis de tempo de la cançó automàtica: com a molt un 7 % (abans hi havia salts del 35 %).
  for (const key of Object.keys(engine.SUBGENRES)) for (let seed = 1; seed <= 4; seed++) {
    const song = builder.createAutoSong(engine, key, { seed: seed * 17 });
    for (const sec of song.sections) if (sec.bpm) assert(Math.abs(sec.bpm / song.settings.bpm - 1) <= .071, `${key}: ${sec.type} a ${sec.bpm} (cançó ${song.settings.bpm})`);
    // Una intro on la bateria no toca: entra a l'últim compàs amb un redoble.
    const intro = song.sections[0];
    if (intro.entrance?.drums !== undefined) assert.equal(intro.entrance.drums, intro.bars - 1);
    assert(!(intro.mute || []).includes('drums') || intro.bars < 2 || song.edges.opening === 'band', `${key}: la bateria no queda muda a la intro`);
    // Les estrofes punk porten guitarra 2.
    if (['punk77', 'hardcore', 'horrorpunk'].includes(key)) for (const verse of song.sections.filter(s => s.type === 'verse'))
      assert(song.clips.some(c => c.instrument === 'guitar2' && c.start === verse.start), `${key}: guitarra 2 a l’estrofa`);
  }
  // El punk del 77 ja no surt sempre igual.
  const prints = new Set(), sounds = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    const song = builder.createAutoSong(engine, 'punk77', { seed: seed * 31 });
    prints.add(JSON.stringify([song.settings.tonic, song.settings.mode, song.settings.groove, song.sections.map(s => s.type + s.bars).join()]));
    sounds.add(song.settings.fx.guitar.type);
  }
  assert(prints.size >= 8, `punk del 77 variat: ${prints.size}`); assert(sounds.size >= 3, `sons de guitarra: ${[...sounds]}`);
  // Ska jamaicà: baix més suau i vents més presents.
  const jamaican = builder.createAutoSong(engine, 'jamaican', { seed: 5 });
  assert(jamaican.settings.baseVolume.bass < 0 && jamaican.settings.volumes.trumpet > 0);
  // Reforç quan la cançó s'alenteix: un instrument que sosté el so.
  const song = builder.createAutoSong(engine, 'punk77', { seed: 3 });
  // Una secció del mig (no totes les formes tenen pont), sense guitarra 2, que s'alenteix.
  const bridge = song.sections.find((s, i) => i > 1 && s.type === 'verse');
  song.clips = song.clips.filter(c => !(c.instrument === 'guitar2' && c.start === bridge.start));
  bridge.bpm = Math.round(song.settings.bpm * .9);
  const added = builder.reinforceSlowdowns(song);
  assert.deepEqual(added.map(a => [a.section.id, a.instrument]), [[bridge.id, 'guitar2']]);
  assert.equal(builder.reinforceSlowdowns(song).length, 0, 'no es duplica');
  // Compensació: si calla una guitarra forta, la resta puja una mica (com a molt 3 dB).
  const verse = song.sections.find(s => s.type === 'verse');
  assert.equal(builder.densityBoost(song, song.sections.find(s => s.type === 'chorus')), 0);
  const before = builder.densityBoost(song, verse);
  verse.mute = ['guitar', 'guitar2'];
  const after = builder.densityBoost(song, verse);
  assert(after > before && after <= 3, `${before} → ${after}`);
});

test('la cançó automàtica deixa triar la tonalitat entre les del subgènere', () => {
  for (const [key, sg] of Object.entries(engine.SUBGENRES)) {
    assert(sg.keys.length >= 4, `${key}: diverses tonalitats`);
    for (const [tonic, mode] of sg.keys) {
      assert(sg.harmony[mode], `${key}: hi ha acords per al mode ${mode}`);
      const song = builder.createAutoSong(engine, key, { seed: 7, key: [tonic, mode], candidates: 1 });
      assert.deepEqual([song.settings.tonic, song.settings.mode], [tonic, mode]);
    }
    // Una tonalitat que no és del subgènere s'ignora (es tria a l'atzar entre les seves).
    const other = builder.createAutoSong(engine, key, { seed: 7, key: [1, 'major'], candidates: 1 });
    assert(sg.keys.some(([t, m]) => t === other.settings.tonic && m === other.settings.mode));
  }
});

test('estructures variades: es penalitza repetir la forma de les últimes cançons (sobretot al punk)', () => {
  const plan = s => s.sections.map(x => [x.type, x.bars]);
  assert.equal(builder.formSimilarity(plan({ sections: [{ type: 'intro', bars: 4 }, { type: 'verse', bars: 16 }] }), [['intro', 4], ['verse', 16]]), 1);
  assert(builder.formSimilarity([['intro', 4], ['verse', 16], ['chorus', 16]], [['chorus', 8], ['bridge', 8]]) < .4);
  for (const key of ['punk77', 'hardcore', 'horrorpunk', 'twotone']) {
    const measure = vary => {
      const recent = [], forms = new Set(); let sim = 0, n = 0;
      for (let i = 0; i < 10; i++) {
        const song = builder.createAutoSong(engine, key, { seed: 500 + i, recent: vary ? recent : [], vary });
        const p = plan(song);
        // Durada dins de 2–4 minuts i seccions vàlides.
        const seconds = song.sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || song.settings.bpm), 0);
        assert(seconds >= 120 && seconds <= 240, `${key}: ${seconds.toFixed(0)} s`);
        for (const r of recent.slice(0, 3)) { sim += builder.formSimilarity(p, r.plan); n++; }
        recent.unshift({ subgenre: key, style: song.settings.style, plan: p });
        forms.add(p.map(([t]) => t).join());
      }
      return { forms: forms.size, sim: sim / n };
    };
    const off = measure(false), on = measure(true);
    assert(on.sim < off.sim, `${key}: menys semblança (${off.sim.toFixed(2)} → ${on.sim.toFixed(2)})`);
    assert(on.forms >= 6, `${key}: ${on.forms} formes diferents de 10`);
  }
  // Pont trencat a mig temps i riff curt entre blocs: tenen arranjament propi.
  let breakdown = false, riff = false;
  for (let seed = 1; seed <= 40 && !(breakdown && riff); seed++) {
    const song = builder.createAutoSong(engine, 'punk77', { seed, candidates: 1 });
    for (const sec of song.sections) {
      const clips = song.clips.filter(c => c.start === sec.start);
      if (sec.type === 'bridge' && sec.feel?.bass === .5) { breakdown = true; assert(clips.some(c => c.instrument === 'guitar2')); }
      if (sec.type === 'solo' && sec.bars === 4) { riff = true; assert(clips.some(c => c.line === 'riff')); }
    }
  }
  assert(breakdown && riff);
});

test('punk: es tria quantes guitarres té la cançó (1, 2 o 3)', () => {
  const guitarsOf = song => new Set(song.clips.map(c => c.instrument).filter(n => n.startsWith('guitar')));
  for (const key of ['punk77', 'hardcore', 'horrorpunk', 'poppunk']) for (let seed = 1; seed <= 6; seed++) {
    const one = builder.createAutoSong(engine, key, { seed, guitars: 1 }), two = builder.createAutoSong(engine, key, { seed, guitars: 2 });
    const three = builder.createAutoSong(engine, key, { seed, guitars: 3 });
    assert.equal(one.settings.guitars, 1); assert.equal(guitarsOf(one).size, 0, `${key}: només la rítmica de la base`);
    assert(!guitarsOf(two).has('guitar2'), `${key}: sense segona rítmica`);
    assert(three.clips.some(c => c.instrument === 'guitar2') && three.clips.some(c => c.instrument === 'guitar3'));
    // Sense solista, no hi ha inici ni final amb el riff sol.
    assert(one.edges.opening !== 'riff' && one.edges.closing !== 'riff');
    // «Inici i final nous» i el reforç de tempo també ho respecten.
    builder.designEdges(engine, one, { seed: seed + 9, opening: 'riff', closing: 'riff' });
    assert.equal(guitarsOf(one).size, 0);
    one.sections[2].bpm = Math.round(one.settings.bpm * .9);
    assert.equal(builder.reinforceSlowdowns(one).length, 0);
  }
  // Per defecte, tres guitarres; a l'ska l'opció no s'aplica.
  assert.equal(builder.createAutoSong(engine, 'punk77', { seed: 4 }).settings.guitars, 3);
  assert.equal(builder.createAutoSong(engine, 'twotone', { seed: 4, guitars: 1 }).settings.guitars, undefined);
});
