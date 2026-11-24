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
  for (const [name, channels] of [['trompeta', [3, 12]], ['saxo', [8]], ['trombó', [4, 13]]])
    assert(notes.some(e => channels.includes(e.channel) && e.time < spec.beat * 4), `${context}: ${name} al primer compàs`);
  const trombone = music.channels.find(c => c.channel === 4);
  assert.equal(trombone.bank, 2);
  assert.equal(trombone.program, 57, `${context}: trombó real, no un segon saxo`);
  // Cap control MIDI que apagui notes (abans el crescendo enviava el 127, «Poly Mode On»).
  assert(music.events.filter(e => e.type === 'cc').every(e => e.controller <= 119 && Number.isFinite(e.value)), `${context}: controls vàlids`);
  // Els vents toquen el riff junts (secció compacta) i sense salts d'octava a mitja frase.
  const onsets = channels => notes.filter(e => channels.includes(e.channel)).map(e => e.time);
  const sax = onsets([8]), trumpet = onsets([3, 12]);
  for (const t of sax) { const near = Math.min(...trumpet.map(u => Math.abs(u - t))); if (near < .06) assert(near < .012, `${context}: trompeta i saxo junts (${(near * 1000).toFixed(1)} ms)`); }
  // Cada vent toca els intervals del riff tal com estan escrits (abans el saxo plegava nota a nota
  // i saltava una octava a mitja frase).
  for (const [name, channels] of [['sax', [8]], ['trombone', [4, 13]], ['trumpet', [3, 12]]]) {
    const played = notes.filter(e => channels.includes(e.channel)).sort((a, b) => a.time - b.time).map(e => e.note);
    const written = (spec.lines[name] || []).map(n => n[2]);
    if (played.length !== written.length) continue;
    for (let i = 1; i < played.length; i++) assert.equal(played[i] - played[i - 1], written[i] - written[i - 1], `${context}: ${name} sense plecs d'octava`);
  }
}

test('tots els subgèneres de ska comencen amb la secció de vents sencera fent el riff', () => {
  for (const [key] of Object.entries(engine.SUBGENRES).filter(([, genre]) => genre.style === 'ska')) {
    for (const seed of [11, 22, 33, 44, 55, 66]) {
      const song = builder.createAutoSong(engine, key, { seed, candidates: 1, vocal: seed % 2 === 0 });
      assertWindOpening(song, `${key} ${seed}`);
      assert(!(song.sections[0].mute || []).includes('trumpet'), 'la trompeta no se silencia a la intro');
    }
  }
});

test('regenerar qualsevol inici de ska conserva la secció de vents, també en cançons antigues', () => {
  const song = builder.createAutoSong(engine, 'rocksteady', { seed: 77, candidates: 1 });
  // Projecte antic: cap clip inicial de vents.
  song.clips = song.clips.filter(c => c.start > 0);
  let seed = 1;
  for (const opening of [...Object.keys(builder.OPENINGS), ...Object.keys(builder.OPENINGS)]) {
    builder.designEdges(engine, song, { seed: seed++, opening, middle: 'none' });
    assertWindOpening(song, opening);
    assert(song.clips.filter(c => c.edge && c.start === 0).length <= 3, 'sense acumular clips en regenerar');
  }
  song.sections[0].type = 'chorus';
  builder.designEdges(engine, song, { seed: 99, opening: 'band', middle: 'none' });
  assertWindOpening(song, 'cançó sense intro');
});

test('el crescendo dels vents fa servir el control d\'expressió i no talla la nota', () => {
  const settings = { seed: 3, style: 'ska', bpm: 100, tonic: 0, mode: 'major' };
  const spec = engine.composeSongPart(settings, { type: 'verse', bars: 2, energy: 60, revision: 1, instruments: ['trumpet', 'sax', 'trombone'], layers: { trumpet: 1, sax: 1, trombone: 1 } });
  spec.lines = { trumpet: [[0, 0, 72, 3]], sax: [[0, 0, 67, 3]], trombone: [[0, 0, 64, 3]] };
  const music = createPerformance(spec), ccs = music.events.filter(e => e.type === 'cc');
  assert(ccs.every(e => e.controller <= 119 && Number.isFinite(e.value)));
  const ramp = ccs.filter(e => e.channel === 3 && e.controller === 11).map(e => e.value);
  assert.deepEqual(ramp, [112, 117, 122, 127], 'crescendo amb CC11');
});
