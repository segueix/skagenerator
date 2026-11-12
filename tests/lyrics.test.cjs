'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');
const lyrics = require('../lyrics.js');

test('anglès: síl·labes i síl·laba tònica de paraules habituals', () => {
  const cases = { the: [1, -1], night: [1, 0], tonight: [2, 1], dancing: [2, 0], fire: [1, 0], tired: [1, 0], faces: [2, 0], candles: [2, 0],
    cities: [2, 0], everybody: [4, 0], together: [3, 1], television: [4, 2], "we're": [1, -1], going: [2, 0], lies: [1, 0], telephone: [3, 0] };
  for (const [word, [count, stress]] of Object.entries(cases)) assert.deepEqual(engine.englishWord(word), { count, stress }, word);
  const info = engine.analyzeLyrics('Dance into the night\nDance into the night', 'en');
  assert.deepEqual(info.syllables, [5, 5]);
  assert.deepEqual(info.repeats, [-1, 0]);
  assert.deepEqual(engine.analyzeLyrics('Ballem tota la nit').syllables, [6]);
});

test('lletra automàtica: totes les frases es poden cantar i cada tema té prou versos', () => {
  for (const [name, pool] of Object.entries(lyrics.POOLS)) {
    assert(pool.reduce((n, f) => n + f.lines.length, 0) >= 16, name);
    for (const family of pool) for (const line of [...family.hooks, ...family.lines]) {
      const [count] = engine.analyzeLyrics(line, 'en').syllables;
      assert(count >= 1 && count <= 10, `${line}: ${count} síl·labes`);
    }
  }
});

test('cançó automàtica amb lletra en anglès: la veu la segueix, la tornada es repeteix i el títol és el hook', () => {
  for (const key of Object.keys(engine.SUBGENRES)) {
    const song = builder.createAutoSong(engine, key, { minutes: 3, seed: 17, autoLyrics: 'en', recent: [], liked: [] });
    assert.equal(song.settings.lang, 'en');
    const sung = song.sections.filter(s => s.lyrics);
    assert(sung.some(s => s.type === 'chorus') && sung.some(s => s.type === 'verse'), key);
    const choruses = sung.filter(s => s.type === 'chorus' && s.bars === sung.find(x => x.type === 'chorus').bars);
    assert(choruses.every(s => s.lyrics === choruses[0].lyrics), `${key}: tornades iguals`);
    assert.equal(song.title, choruses[0].lyrics.split('\n')[0]);
    for (const sec of sung) {
      const info = engine.analyzeLyrics(sec.lyrics, 'en'), phrase = sec.phraseBars === 4 || Math.max(...info.syllables) > 11 ? 4 : 2;
      assert(info.syllables.length <= sec.bars / phrase, `${key} ${sec.type}: hi caben tots els versos`);
      // Cada vers es canta: la melodia de veu té una nota per síl·laba.
      const clip = song.clips.find(c => c.instrument === 'vocal' && c.start === sec.start);
      assert(clip, `${key} ${sec.type}: té veu`);
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision: song.harmony[sec.type] || 1, instruments: ['vocal'], layers: { vocal: clip.revision }, ...info,
        ...(sec.phraseBars ? { phraseBars: sec.phraseBars } : {}), ...(sec.bpm ? { bpm: sec.bpm } : {}), ...(clip.register ? { register: clip.register } : {}) };
      const notes = engine.composeSongPart(song.settings, part).lines.vocal;
      assert.equal(notes.length, info.syllables.reduce((a, b) => a + b, 0), `${key} ${sec.type}: una nota per síl·laba`);
    }
  }
  // Sense l'opció (o amb lletra enganxada) no s'hi posa lletra.
  assert(!builder.createAutoSong(engine, 'twotone', { seed: 17 }).sections.some(s => s.lyrics));
});

test('lletra automàtica en català: versos cantables, tornada repetida i una nota per síl·laba', () => {
  for (const [name, pool] of Object.entries(lyrics.POOLS_CA)) {
    assert(pool.reduce((n, f) => n + f.lines.length, 0) >= 12, name);
    for (const family of pool) for (const line of [...family.hooks, ...family.lines]) {
      const [count] = engine.analyzeLyrics(line).syllables;
      assert(count >= 2 && count <= 10, `${line}: ${count} síl·labes`);
    }
  }
  for (const key of ['twotone', 'punk77', 'horrorpunk', 'poppunk', 'postpunk']) {
    const song = builder.createAutoSong(engine, key, { minutes: 3, seed: 23, autoLyrics: 'ca', recent: [], liked: [] });
    assert.equal(song.settings.lang, 'ca');
    const sung = song.sections.filter(s => s.lyrics);
    const chorus = sung.find(s => s.type === 'chorus');
    assert(chorus && sung.some(s => s.type === 'verse'), key);
    assert.equal(song.title, chorus.lyrics.split('\n')[0]);
    assert(Object.values(lyrics.POOLS_CA).flat().some(f => f.hooks.includes(song.title)), `${key}: títol en català`);
  }
});

test('el repertori ampliat supera els 70 versos per tema i respecta la mètrica', () => {
  for (const [lang, pools] of [['ca', lyrics.POOLS_CA], ['en', lyrics.POOLS]]) {
    for (const [theme, families] of Object.entries(pools)) {
      const lines = families.flatMap(f => f.lines);
      assert(lines.length >= 70, `${lang}/${theme}: repertori insuficient`);
      assert(new Set(families.flatMap(f => f.hooks)).size >= 12, `${lang}/${theme}: falten títols`);
      for (const line of families.flatMap(f => [...f.hooks, ...f.lines])) {
        const count = engine.analyzeLyrics(line, lang).syllables[0];
        assert(count >= (lang === 'ca' ? 2 : 1) && count <= 10, `${lang}: ${line}: ${count} síl·labes`);
      }
    }
  }
});

test('800 cançons de prova: títols variats, lletres deterministes i cap vers duplicat', () => {
  const sections = [
    { type: 'verse', bars: 8 }, { type: 'prechorus', bars: 4 },
    { type: 'chorus', bars: 8 }, { type: 'verse', bars: 16 },
    { type: 'chorus', bars: 8 }, { type: 'verse', bars: 8 }
  ];
  for (const lang of ['ca', 'en']) for (const subgenre of ['twotone', 'punk77', 'horrorpunk', 'poppunk', 'postpunk']) {
    const titles = new Set();
    for (let seed = 1; seed <= 80; seed++) {
      const options = { subgenre, style: subgenre === 'twotone' ? 'ska' : 'punk', sections, seed: seed * 101, lang };
      const song = lyrics.writeLyrics(options);
      titles.add(song.hook);
      const verses = song.sections.filter((_, i) => sections[i].type === 'verse')
        .flatMap(s => s.text.toLocaleLowerCase().split('\n'));
      assert.equal(new Set(verses).size, verses.length, `${lang}/${subgenre}/${seed}: versos repetits`);
      if (seed === 1) assert.deepEqual(song, lyrics.writeLyrics(options), 'mateixa llavor, mateixa lletra');
      assert.equal(song.sections[2].text, song.sections[4].text, 'tornada idèntica');
    }
    assert(titles.size >= 10, `${lang}/${subgenre}: poca varietat de títols`);
  }
});
