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
