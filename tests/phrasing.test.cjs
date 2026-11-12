'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const { createPerformance } = require('../audio/performance.cjs');
const part = (type, instruments) => engine.composeSongPart({ seed: 42, style: 'punk', bpm: 160, tonic: 0, mode: 'major' }, { type, bars: 4, energy: 70, revision: 1, instruments });
test('punk: una sola rítmica i estrofes amb espai respecte a la tornada', () => {
  const verse = createPerformance(part('verse', ['guitar'])), chorus = createPerformance(part('chorus', ['guitar']));
  const attacks = p => p.events.filter(e => e.type === 'on' && e.channel === 0);
  assert(!verse.events.some(e => e.type === 'on' && e.channel === 1));
  assert(attacks(verse).length < attacks(chorus).length);
});
test('trompeta: corxeres lligades sense staccato i silencis conservats', () => {
  const spec = engine.composeSongPart({ seed: 42, style: 'ska', bpm: 120, tonic: 0, mode: 'major' }, { type: 'verse', bars: 4, energy: 70, revision: 1, instruments: ['trumpet'] });
  spec.humanize = 0;
  spec.lines.trumpet = [[0, 0, 67, .5], [0, .5, 69, .5], [0, 2, 71, .5]];
  const events = createPerformance(spec).events;
  const on = events.filter(e => e.type === 'on'), off = events.filter(e => e.type === 'off');
  assert.equal(on[0].channel, 3); assert.equal(on[1].channel, 3);
  assert(on[1].time - off[0].time < .015);
  assert(on[2].time - off[1].time > .45);
});
test('arranjament: les estrofes punk deixen lloc al baix i les tornades responen a la veu', () => {
  for (const seed of [11, 22, 33]) {
    const song = builder.createAutoSong(engine, 'punk77', { seed, vocal: true });
    for (const sec of song.sections.filter(s => s.type === 'verse')) {
      assert.equal(sec.groove.bass, 3);
      assert(!song.clips.some(c => c.start === sec.start && c.instrument === 'guitar2'));
    }
    for (const sec of song.sections.filter(s => s.type === 'chorus')) {
      const lead = song.clips.find(c => c.start === sec.start && c.instrument === 'guitar3');
      assert.equal(lead?.line, 'answer');
    }
  }
});
test('trompeta: notes repetides lligades sense que el final de l’anterior talli la nova', () => {
  const spec = engine.composeSongPart({ seed: 42, style: 'ska', bpm: 120, tonic: 0, mode: 'major' }, { type: 'intro', bars: 4, energy: 70, revision: 1, instruments: ['trumpet'] });
  spec.lines.trumpet = [[0, .5, 70, 2], [0, 2.5, 70, .5], [0, 3, 70, .5], [0, 3.5, 70, 1], [1, .5, 67, 2]];
  const events = createPerformance(spec).events.filter(e => (e.type === 'on' || e.type === 'off') && (e.channel === 3 || e.channel === 12));
  const sounding = new Set();
  for (const e of events) {
    const key = `${e.channel}:${e.note}`;
    if (e.type === 'on') { assert(!sounding.has(key), `la nota ${e.note} encara sonava quan torna a entrar`); sounding.add(key); }
    else sounding.delete(key);
  }
  const ons = events.filter(e => e.type === 'on');
  assert.equal(ons.length, 5);
});
