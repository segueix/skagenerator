'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = require('../radioambient.js');

test('les deu cançons d’exemple són projectes vàlids i diferents entre si', () => {
  const index = JSON.parse(fs.readFileSync('exemples/index.json', 'utf8'));
  assert.equal(index.filter(e => e.style === 'ska').length, 5);
  assert.equal(index.filter(e => e.style === 'punk').length, 5);
  const fingerprints = new Set();
  for (const entry of index) {
    const song = JSON.parse(fs.readFileSync(`exemples/${entry.file}`, 'utf8'));
    assert.equal(song.version, 3); assert.equal(song.title, entry.title); assert.equal(song.settings.style, entry.style);
    assert(song.base.generated && song.clips.every(c => c.generated), 'a punt per escoltar');
    let at = 0;
    for (const sec of song.sections) { assert.equal(sec.start, at); at += sec.bars; }
    assert.equal(at, song.settings.bars);
    for (const clip of song.clips) {
      assert(!song.base.instruments.includes(clip.instrument));
      assert(clip.start + clip.bars <= song.settings.bars);
      assert(!song.clips.some(o => o !== clip && o.instrument === clip.instrument && o.start < clip.start + clip.bars && clip.start < o.start + o.bars), `${entry.file}: ${clip.id}`);
    }
    for (const sec of song.sections) {
      const h = song.harmony[sec.type] || 1;
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy ?? engine.SONG_PARTS[sec.type].energy, revision: h, groove: { ...song.settings.groove, ...(sec.groove || {}) } };
      if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (h - 1) % 5;
      for (const key of ['bpm', 'transpose', 'feel']) if (sec[key] !== undefined) part[key] = sec[key];
      assert.doesNotThrow(() => engine.composeSongPart(song.settings, part), `${entry.file}: ${sec.id}`);
    }
    const seconds = song.sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || song.settings.bpm), 0);
    assert(seconds > 60 && seconds <= 360);
    fingerprints.add(JSON.stringify([song.settings.bpm, song.settings.tonic, song.settings.mode, song.settings.groove]));
  }
  assert.equal(fingerprints.size, 10, 'cada cançó té tempo, to i ritme propis');
});
