'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const { createPerformance } = require('../audio/performance.cjs');

function openingPerformance(song) {
  const sec = song.sections[0];
  const clips = song.clips.filter(c => c.start < sec.start + sec.bars && sec.start < c.start + c.bars
    && !(sec.mute || []).includes(c.instrument));
  const revision = song.harmony[sec.type] || 1;
  const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision,
    instruments: [...new Set([...song.base.instruments.filter(n => !(sec.mute || []).includes(n)), ...clips.map(c => c.instrument)])],
    layers: Object.fromEntries(clips.map(c => [c.instrument, c.revision])),
    lineModes: Object.fromEntries(clips.filter(c => c.line).map(c => [c.instrument, c.line])) };
  if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (revision - 1) % 5;
  for (const field of ['timbres', 'entrance', 'bpm', 'feel', 'transpose']) if (sec[field]) part[field] = sec[field];
  const spec = engine.composeSongPart(song.settings, part);
  return { spec, music: createPerformance(spec) };
}

function assertWindOpening(song, context) {
  const { spec, music } = openingPerformance(song);
  const notes = music.events.filter(e => e.type === 'on');
  assert(!notes.some(e => [3, 12].includes(e.channel)), `${context}: cap trompeta a l'inici`);
  for (const channels of [[8], [4, 13]]) {
    assert(notes.some(e => channels.includes(e.channel) && e.time < spec.beat * 4), `${context}: saxo i trombó al primer compàs`);
  }
  const trombone = music.channels.find(c => c.channel === 4);
  assert.equal(trombone.bank, 2);
  assert.equal(trombone.program, 57, `${context}: trombó real, no un segon saxo`);
}

test('tots els subgèneres de ska comencen amb saxo i trombó i reserven la trompeta per després', () => {
  for (const [key] of Object.entries(engine.SUBGENRES).filter(([, genre]) => genre.style === 'ska')) {
    for (const seed of [11, 22, 33, 44, 55, 66]) {
      const song = builder.createAutoSong(engine, key, { seed, candidates: 1, vocal: seed % 2 === 0 });
      assertWindOpening(song, `${key} ${seed}`);
      assert(!song.clips.some(c => c.instrument === 'trumpet' && c.start === 0));
      assert(song.clips.some(c => c.instrument === 'trumpet' && c.start > 0), 'la trompeta continua disponible més endavant');
    }
  }
});

test('regenerar qualsevol inici de ska conserva el duet, també en cançons antigues', () => {
  const song = builder.createAutoSong(engine, 'rocksteady', { seed: 77, candidates: 1 });
  // Projecte antic: trompeta a la base i cap clip inicial de saxo ni trombó.
  song.base.instruments.push('trumpet');
  song.clips = song.clips.filter(c => c.start > 0);
  let seed = 1;
  for (const opening of [...Object.keys(builder.OPENINGS), ...Object.keys(builder.OPENINGS)]) {
    builder.designEdges(engine, song, { seed: seed++, opening, middle: 'none' });
    assertWindOpening(song, opening);
    assert(song.clips.filter(c => c.edge && c.start === 0).length <= 2, 'sense acumular clips en regenerar');
  }
  song.sections[0].type = 'chorus';
  builder.designEdges(engine, song, { seed: 99, opening: 'band', middle: 'none' });
  assertWindOpening(song, 'cançó sense intro');
});
