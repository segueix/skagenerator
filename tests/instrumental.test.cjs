'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');

const SKA = Object.keys(engine.SUBGENRES).filter(key => engine.SUBGENRES[key].style === 'ska');
const LEADS = ['trumpet', 'sax', 'trombone'];
const inside = (clip, sec) => clip.start < sec.start + sec.bars && sec.start < clip.start + clip.bars;

test('ska instrumental: sense veu ni lletra, tema als vents a cada estrofa i tornada, i almenys un solo', () => {
  for (const key of SKA) for (const seed of [3, 14, 15, 92]) {
    const song = builder.createAutoSong(engine, key, { seed, vocal: false, candidates: 1 });
    const where = `${key} ${seed}`;
    assert(!song.clips.some(c => c.instrument === 'vocal'), `${where}: cap veu`);
    assert(song.sections.every(s => !s.lyrics), `${where}: cap lletra`);
    const leadsIn = sec => song.clips.filter(c => inside(c, sec) && LEADS.includes(c.instrument) && !c.line);
    // Els interludis de riff (solos de 4 compassos amb tots els vents fent el riff) no tenen solista.
    const riffBreak = sec => sec.type === 'solo' && song.clips.filter(c => inside(c, sec) && LEADS.includes(c.instrument)).every(c => c.line === 'riff');
    for (const sec of song.sections.filter(s => ['verse', 'chorus', 'solo'].includes(s.type) && !riffBreak(s)))
      assert(leadsIn(sec).length, `${where}: la secció ${sec.type} té un vent amb melodia pròpia`);
    assert(song.sections.some(s => s.type === 'solo' && !riffBreak(s) && leadsIn(s).length), `${where}: hi ha un solo`);
    // Tema A (estrofa) i tema B (tornada) els fan vents diferents, excepte als subgèneres lents.
    const leadOf = type => song.clips.find(c => !c.line && LEADS.includes(c.instrument) && song.sections.some(s => s.type === type && inside(c, s)))?.instrument;
    if (!['rocksteady', 'bossreggae'].includes(key)) assert.notEqual(leadOf('verse'), leadOf('chorus'), where);
    // Totes les seccions es poden compondre.
    for (const sec of song.sections) {
      const clips = song.clips.filter(c => inside(c, sec));
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision: song.harmony[sec.type] || 1,
        instruments: [...new Set([...song.base.instruments, ...clips.map(c => c.instrument)])],
        layers: Object.fromEntries(clips.map(c => [c.instrument, c.revision])),
        lineModes: Object.fromEntries(clips.filter(c => c.line).map(c => [c.instrument, c.line])) };
      for (const field of ['entrance', 'exit', 'bpm', 'feel', 'transpose']) if (sec[field]) part[field] = sec[field];
      assert.doesNotThrow(() => engine.composeSongPart(song.settings, part), where);
    }
  }
});

test('els solos llargs es reparteixen entre dos solistes', () => {
  let traded = 0;
  for (const key of SKA) for (let seed = 1; seed <= 12; seed++) {
    const song = builder.createAutoSong(engine, key, { seed, vocal: false, candidates: 1 });
    for (const sec of song.sections.filter(s => s.type === 'solo' && s.entrance && s.exit)) {
      const [second, from] = Object.entries(sec.entrance).find(([name]) => LEADS.includes(name)) || [];
      const [first, to] = Object.entries(sec.exit).find(([name]) => LEADS.includes(name)) || [];
      if (!second) continue;
      assert.notEqual(first, second); assert.equal(from, to); assert.equal(from * 2, sec.bars);
      traded++;
    }
  }
  assert(traded > 0, 'algun solo es reparteix');
});

test('amb veu, l’arranjament de ska no canvia', () => {
  const song = builder.createAutoSong(engine, 'twotone', { seed: 5, candidates: 1 });
  assert(song.clips.some(c => c.instrument === 'vocal'));
  assert.equal(song.settings.volumes.vocal, 3);
});

test('la ràdio té l’interruptor instrumental i no fa cantar les cançons instrumentals', () => {
  const fs = require('node:fs'), path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), radio = fs.readFileSync(path.join(__dirname, '..', 'radio.js'), 'utf8');
  assert.match(html, /<input type="checkbox" id="radio-instrumental">/);
  assert.match(radio, /vocal: !instrumental/);
  assert.match(radio, /const canSing = \(\) => !instrumental &&/);
  assert.match(radio, /const repertoire = instrumental \? \[\]/);
});

const PUNK = Object.keys(engine.SUBGENRES).filter(key => engine.SUBGENRES[key].style === 'punk');

test('punk instrumental: la guitarra solista fa un tema a l’estrofa, un altre a la tornada i els solos', () => {
  for (const key of PUNK) for (const [seed, guitars] of [[3, 1], [14, 2], [15, 3], [92, 2]]) {
    const song = builder.createAutoSong(engine, key, { seed, vocal: false, guitars, candidates: 1 });
    const where = `${key} ${seed}`;
    assert(!song.clips.some(c => c.instrument === 'vocal') && song.sections.every(s => !s.lyrics), `${where}: sense veu`);
    assert(song.settings.guitars >= 2, `${where}: amb guitarra solista`);
    const leadIn = sec => song.clips.find(c => inside(c, sec) && c.instrument === 'guitar3' && c.line === 'lead');
    for (const sec of song.sections.filter(s => ['verse', 'chorus'].includes(s.type))) assert(leadIn(sec), `${where}: tema a ${sec.type}`);
    const verse = song.sections.find(s => s.type === 'verse'), chorus = song.sections.find(s => s.type === 'chorus');
    assert(song.sections.some(s => ['solo', 'bridge'].includes(s.type) && leadIn(s)) || !song.sections.some(s => ['solo', 'bridge'].includes(s.type)), `${where}: solo de guitarra`);
    // El tema és una melodia de veritat (amb ritme i altures variats), no un arpegi.
    const spec = engine.composeSongPart(song.settings, { type: chorus.type, bars: chorus.bars, energy: chorus.energy, revision: song.harmony.chorus,
      instruments: [...song.base.instruments, 'guitar3'], layers: { guitar3: leadIn(chorus).revision }, lineModes: { guitar3: 'lead' } });
    const line = spec.lines.guitar3;
    assert(new Set(line.map(n => n[2])).size >= 4 && new Set(line.map(n => n[3])).size >= 2, `${where}: melodia variada`);
    assert(verse && leadIn(verse));
  }
});

test('el mode «solista» de la guitarra 3 només és vàlid per a la guitarra 3', () => {
  const settings = { seed: 5, style: 'punk', bpm: 180, tonic: 2, mode: 'major' }, part = { type: 'chorus', bars: 4, energy: 80, revision: 1 };
  assert.doesNotThrow(() => engine.composeSongPart(settings, { ...part, instruments: ['guitar3'], layers: { guitar3: 2 }, lineModes: { guitar3: 'lead' } }));
  assert.throws(() => engine.composeSongPart(settings, { ...part, instruments: ['trumpet'], layers: { trumpet: 2 }, lineModes: { trumpet: 'lead' } }), /Mode de línia/);
  const { createPerformance } = require('../audio/performance.cjs');
  const spec = engine.composeSongPart(settings, { ...part, instruments: ['guitar', 'guitar3'], layers: { guitar3: 2 }, lineModes: { guitar3: 'lead' } });
  const notes = createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 15);
  assert.equal(notes.length, spec.lines.guitar3.length, 'la guitarra solista toca la melodia nota a nota');
});

test('amb veu, el punk no canvia', () => {
  const song = builder.createAutoSong(engine, 'punk77', { seed: 5, guitars: 1, candidates: 1 });
  assert.equal(song.settings.guitars, 1);
  assert(!song.clips.some(c => c.line === 'lead'));
});
