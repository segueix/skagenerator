const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const settings = { seed: 123456, bpm: 112, style: 'ska', tonic: 0, mode: 'major' };
const part = (type, bars = 4, revision = 1) => ({ type, bars, revision, energy: engine.SONG_PARTS[type].energy });
test('les parts comparteixen tonalitat i tempo, i tenen la durada exacta', async () => {
  for (const type of Object.keys(engine.SONG_PARTS)) {
    const spec = engine.composeSongPart(settings, part(type));
    assert.equal(spec.tonic, settings.tonic);
    assert.equal(spec.beat, 60 / settings.bpm);
    const data = await engine.songPartSamples(spec, 4000);
    assert.equal(data.length, Math.round(16 * 60 / settings.bpm * 4000));
    assert(data.every(Number.isFinite));
    assert(data.some(n => Math.abs(n) > .01));
    assert(Math.max(...data) <= .721);
    assert(data[0] === 0); assert(data.at(-1) === 0);
  }
});
test('les tornades repeteixen exactament el motiu i es reprodueixen igual després de desar', async () => {
  const first = engine.composeSongPart(settings, part('chorus', 8));
  const restored = engine.composeSongPart(JSON.parse(JSON.stringify(settings)), JSON.parse(JSON.stringify(part('chorus', 8))));
  assert.deepEqual(first, restored);
  const a = await engine.songPartSamples(first, 4000);
  const b = await engine.songPartSamples(restored, 4000);
  assert.deepEqual(a, b);
  assert.deepEqual(first.melody.filter(n => n[0] < 4), first.melody.filter(n => n[0] >= 4).map(n => [n[0] - 4, ...n.slice(1)]));
  const another = engine.composeSongPart(settings, part('chorus', 8, 2));
  assert.notDeepEqual(first.melody, another.melody);
});
test('els estils i els extrems de tempo generen àudio finit', async () => {
  for (const style of Object.keys(engine.SONG_STYLES)) {
    for (const bpm of [engine.SONG_STYLES[style].bpm.min, engine.SONG_STYLES[style].bpm.max]) {
      const spec = engine.composeSongPart({ ...settings, style, bpm, tonic: engine.SONG_STYLES[style].keys[0][0], mode: engine.SONG_STYLES[style].keys[0][1] }, part('chorus'));
      const data = await engine.songPartSamples(spec, 4000);
      assert.equal(data.length, Math.round(16 * 60 / bpm * 4000));
      assert(data.every(Number.isFinite));
      assert(data.some(n => Math.abs(n) > .01));
    }
  }
});
test('rebutja configuracions impossibles i conserva el compositor original', () => {
  assert.throws(() => engine.composeSongPart({ ...settings, bpm: 0 }, part('intro')));
  assert.throws(() => engine.composeSongPart(settings, part('intro', 100000)));
  assert.throws(() => engine.composeSongPart({ ...settings, mode: 'inventat' }, part('intro')));
  assert.throws(() => engine.composeSongPart(settings, { ...part('intro'), energy: NaN }));
  const original = engine.composeJingle('rumba', 12345, { loop: true });
  assert.equal(original.style, 'rumba'); assert(original.chords.length > 0); assert(original.melody.length > 0);
});

test('els perfils admeten ska, punk i urban, amb els seus tempos i tonalitats', () => {
  assert.deepEqual(Object.keys(engine.SONG_STYLES), ['ska', 'punk', 'urban']);
  assert.throws(() => engine.composeSongPart({ ...settings, style: 'pop' }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, bpm: 99 }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, bpm: 181 }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, style: 'punk', bpm: 139 }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, style: 'punk', bpm: 221 }, part('intro')));
  for (const [style, profile] of Object.entries(engine.SONG_STYLES)) {
    for (const [tonic, mode] of profile.keys) assert.doesNotThrow(() => engine.composeSongPart({ ...settings, style, bpm: profile.bpm.default, tonic, mode }, part('intro')));
  }
  assert.throws(() => engine.composeSongPart({ ...settings, tonic: 11, mode: 'major' }, part('intro')));
});
test('els nou instruments generen àudio propi i trompeta i trombó són diferents', async () => {
  const samples = [];
  for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) {
    const spec = engine.composeSongPart({ ...settings, instruments: [instrument] }, part('chorus'));
    assert.deepEqual(spec.instruments, [instrument]);
    const audio = await engine.songPartSamples(spec, 4000);
    assert(audio.every(Number.isFinite)); assert(audio.some(n => Math.abs(n) > .01));
    samples.push(audio);
  }
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) assert.notDeepEqual(samples[i], samples[j]);
  assert.throws(() => engine.composeSongPart({ ...settings, instruments: [] }, part('intro')));
  assert.throws(() => engine.composeSongPart({ ...settings, instruments: ['piano'] }, part('intro')));
});

test('cada part admet una combinació instrumental pròpia independent de la formació base', () => {
  const base = { ...settings, instruments: ['guitar', 'drums', 'bass'] };
  const intro = { ...part('intro'), instruments: ['guitar', 'trumpet', 'trombone'] };
  const verse = { ...part('verse'), instruments: ['bass', 'drums'] };
  const chorus = { ...part('chorus'), instruments: ['guitar', 'drums', 'bass', 'trumpet', 'trombone'] };
  assert.deepEqual(engine.composeSongPart(base, intro).instruments, intro.instruments);
  assert.deepEqual(engine.composeSongPart(base, verse).instruments, verse.instruments);
  assert.deepEqual(engine.composeSongPart(base, chorus).instruments, chorus.instruments);
  assert.deepEqual(engine.composeSongPart(base, part('outro')).instruments, base.instruments);
  assert.deepEqual(base.instruments, ['guitar', 'drums', 'bass']);
  assert.deepEqual(engine.composeSongPart(base, JSON.parse(JSON.stringify(intro))).instruments, intro.instruments);
  assert.deepEqual(engine.composeSongPart({ ...base, instruments: ['drums'] }, intro).instruments, intro.instruments);
  for (const instruments of [[], ['piano'], ['bass', 'bass'], null, 'bass']) {
    assert.throws(() => engine.composeSongPart(base, { ...intro, instruments }));
  }
});

test('cinc versions de cada intro, estrofa i tornada són diferents i recuperables', () => {
  const base = { ...settings, instruments: ['guitar', 'drums', 'bass', 'trumpet', 'trombone'] };
  for (const type of ['intro', 'verse', 'chorus']) {
    const revisions = [11, 12, 13, 14, 15];
    const alternatives = revisions.map((revision, index) =>
      engine.composeSongPart(base, { ...part(type, 8), revision, variants: revisions, selectedVariant: index }));
    assert.equal(new Set(alternatives.map(spec => JSON.stringify([spec.chords.map(chord => chord.root), spec.melody]))).size, 5);
    assert.deepEqual(alternatives.map(spec => spec.variation), [0, 1, 2, 3, 4]);
    assert(alternatives.every(spec => spec.beat === 60 / base.bpm && spec.tonic === base.tonic));
    const restored = JSON.parse(JSON.stringify({ ...part(type, 8), revision: revisions[3], variants: revisions, selectedVariant: 3 }));
    assert.deepEqual(engine.composeSongPart(base, restored), alternatives[3]);
  }
  assert.throws(() => engine.composeSongPart(base, { ...part('bridge'), variantIndex: 3 }));
  assert.throws(() => engine.composeSongPart(base, { ...part('intro'), variantIndex: 6 }));
});

test('les cinc versions donen ritmes de bateria diferents al motor de mostres', () => {
  const performance = require('../audio/performance.cjs');
  const drums = { ...settings, instruments: ['drums'] };
  const patterns = [0, 1, 2, 3, 4].map(index => {
    const spec = engine.composeSongPart(drums, { ...part('verse'), revision: index + 10, variantIndex: index });
    return performance.createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 9)
      .map(e => [e.note, Math.round(e.time / spec.beat * 10) / 10]);
  });
  assert.equal(new Set(patterns.map(JSON.stringify)).size, 5);
});

test('les cinc versions tenen línies de baix diferents en ska i punk', () => {
  const performance = require('../audio/performance.cjs');
  for (const style of ['ska', 'punk']) {
    const cfg = { ...settings, style, bpm: style === 'punk' ? 180 : 128, instruments: ['bass'] };
    for (const type of ['intro', 'verse', 'chorus']) {
      const versions = [21, 22, 23, 24, 25].map((revision, index) =>
        engine.composeSongPart(cfg, { ...part(type, 4), revision, variants: [21, 22, 23, 24, 25], selectedVariant: index }));
      assert.equal(new Set(versions.map(s => JSON.stringify(s.bassLine))).size, 5);
      for (const spec of versions) {
        assert(spec.bassLine.length >= 10);
        assert(spec.bassLine.every(([bar, beat, pitch, length, strength]) =>
          Number.isInteger(bar) && bar >= 0 && beat >= 0 && beat < 4 &&
          Number.isInteger(pitch) && pitch >= 28 && pitch <= 75 && length > 0 && strength > 0));
        const notes = performance.createPerformance(spec).events.filter(e => e.channel === 2 && e.type === 'on');
        assert.equal(notes.length, spec.bassLine.length);
        assert(notes.some(e => e.velocity >= 90));
      }
    }
  }
});

test('el motor alternatiu fa cinc àudios audibles amb només baix', async () => {
  const cfg = { ...settings, instruments: ['bass'] }, versions = [101,102,103,104,105], sounds = [];
  for (let index = 0; index < 5; index++) {
    const spec = engine.composeSongPart(cfg, { ...part('verse', 4),
      revision: versions[index], variants: versions, selectedVariant: index });
    const audio = await engine.songPartSamples(spec, 4000);
    assert(audio.some(value => Math.abs(value) > .01));
    sounds.push(Buffer.from(audio.buffer).toString('base64'));
  }
  assert.equal(new Set(sounds).size, 5);
});

test('la base rítmica es manté en les cinc versions i es pot canviar per secció', () => {
  const performance = require('../audio/performance.cjs');
  assert.deepEqual(Object.keys(engine.SONG_GROOVES), Object.keys(engine.SONG_STYLES));
  const base = { ...settings, instruments: ['guitar', 'drums', 'bass'], groove: { drums: 1, bass: 2, guitar: 3 } };
  const versions = [0, 1, 2, 3, 4].map(index => engine.composeSongPart(base, { ...part('verse'), revision: index + 1, variantIndex: index }));
  // Les versions canvien acords i melodia, però comparteixen la bateria i el ritme.
  assert.equal(new Set(versions.map(spec => JSON.stringify(spec.drumLine))).size, 1);
  assert.equal(new Set(versions.map(spec => JSON.stringify(spec.bassLine.map(([b, t, , length]) => [b, t, length])))).size, 1);
  assert.equal(new Set(versions.map(spec => JSON.stringify(spec.melody))).size, 5);
  assert.deepEqual(versions[0].groove, { drums: 1, bass: 2, guitar: 3 });
  const own = engine.composeSongPart(base, { ...part('verse'), groove: { drums: 4 } });
  assert.deepEqual(own.groove, { drums: 4, bass: 2, guitar: 3 });
  assert.notDeepEqual(own.drumLine, versions[0].drumLine);
  assert.deepEqual(own.melody, engine.composeSongPart(base, part('verse')).melody);
  for (const style of Object.keys(engine.SONG_STYLES)) {
    const cfg = { ...settings, style, bpm: engine.SONG_STYLES[style].bpm.default,
      tonic: engine.SONG_STYLES[style].keys[0][0], mode: engine.SONG_STYLES[style].keys[0][1], instruments: ['drums'] };
    const lines = engine.SONG_GROOVES[style].drums.map((_, drums) => engine.composeSongPart({ ...cfg, groove: { drums } }, part('verse')).drumLine);
    assert.equal(new Set(lines.map(JSON.stringify)).size, lines.length);
    for (const line of lines) assert(line.every(([bar, beat, note, force]) =>
      Number.isInteger(bar) && bar >= 0 && bar < 4 && beat >= 0 && beat < 4 && note >= 35 && note <= 59 && force > 0 && force <= 127));
    const guitars = engine.SONG_GROOVES[style].guitar.map((_, guitar) => performance.createPerformance(
      engine.composeSongPart({ ...cfg, instruments: ['guitar'], groove: { guitar } }, part('verse')))
      .events.filter(e => e.type === 'on' && e.channel === 0).length);
    assert(new Set(guitars).size > 1);
  }
  for (const groove of [{ drums: 6 }, { bass: -1 }, { guitar: 1.5 }, { piano: 0 }, [], null, 'ska'])
    assert.throws(() => engine.composeSongPart({ ...settings, groove }, part('verse')), /Base rítmica/);
  assert.throws(() => engine.composeSongPart(settings, { ...part('verse'), groove: { drums: 9 } }), /Base rítmica/);
});

test('la bateria segueix la forma de cada secció', () => {
  const cfg = { ...settings, groove: { drums: 0, bass: 0, guitar: 0 } };
  const drums = (type, bars = 4, energy) => engine.composeSongPart(cfg, { ...part(type, bars), ...(energy ? { energy } : {}) }).drumLine;
  const at = (line, bar, note) => line.filter(hit => hit[0] === bar && hit[2] === note);
  const chorus = drums('chorus', 8);
  assert.equal(at(chorus, 0, 49).length, 1, 'plat a l’entrada de la tornada');
  assert(chorus.filter(hit => hit[0] === 7 && hit[1] >= 2.5 && [38, 43, 45, 48].includes(hit[2])).length >= 5, 'redoble final');
  assert.equal(at(chorus, 3, 38).some(hit => hit[1] === 3.75), true, 'avís al final de la frase');
  const intro = drums('intro');
  assert.equal(at(intro, 0, 38).length + at(intro, 0, 37).length, 0, 'la intro comença sense caixa');
  assert(at(intro, 2, 37).length > 0, 'la base completa entra a mitja intro');
  const pre = drums('prechorus');
  const roll = at(pre, 3, 38);
  assert(roll.length >= 12 && roll.at(-1)[3] > roll[0][3], 'crescendo abans de la tornada');
  const outro = drums('outro');
  assert.deepEqual(outro.filter(hit => hit[0] === 3).map(hit => hit[1]), [0, 0, 0]);
  assert.notDeepEqual(drums('verse', 4, 30), drums('verse', 4, 90));
});

test('les seccions admeten qualsevol durada i cada instrument afegit té la seva part', () => {
  const performance = require('../audio/performance.cjs');
  for (const bars of [1, 2, 3, 5, 7, 13, 32]) {
    const spec = engine.composeSongPart(settings, { ...part('verse'), bars });
    assert.equal(spec.chords.length, bars); assert.equal(spec.drumLine.at(-1)[0], bars - 1);
    assert(spec.melody.every(n => n[0] < bars));
    assert(performance.createPerformance(spec).events.every(e => e.time < spec.seconds));
  }
  assert.throws(() => engine.composeSongPart(settings, { ...part('verse'), bars: 0 }));
  assert.throws(() => engine.composeSongPart(settings, { ...part('verse'), bars: 65 }));
  const base = { ...settings, instruments: ['drums', 'bass'] };
  const layered = layers => engine.composeSongPart(base, { ...part('chorus', 8), instruments: ['drums', 'bass', ...Object.keys(layers)], layers });
  const a = layered({ trumpet: 11, trombone: 12 }), b = layered({ trumpet: 13, trombone: 12 });
  // Una nova versió d'un instrument no toca els acords ni els altres instruments.
  assert.deepEqual(a.chords, b.chords); assert.deepEqual(a.lines.trombone, b.lines.trombone);
  assert.notDeepEqual(a.lines.trumpet, b.lines.trumpet); assert.notDeepEqual(a.lines.trumpet, a.lines.trombone);
  assert.deepEqual(layered({ trumpet: 11, trombone: 12 }), a);
  const trumpet = spec => performance.createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 3).map(e => e.note);
  assert.notDeepEqual(trumpet(a), trumpet(b));
  const guitars = [1, 2, 3].map(rev => performance.createPerformance(layered({ guitar: rev })).events.filter(e => e.type === 'on' && e.channel === 0).length);
  assert(new Set(guitars).size > 1);
  for (const layers of [{ piano: 1 }, { trumpet: 0 }, { trumpet: 1.5 }, [], null])
    assert.throws(() => engine.composeSongPart(base, { ...part('verse'), layers }), /Capes/);
});

test('un instrument pot sonar només en una part del tram (clips que travessen seccions)', () => {
  const performance = require('../audio/performance.cjs');
  const base = { ...settings, instruments: ['drums', 'bass'] };
  const part = (ranges) => ({ type: 'verse', bars: 8, energy: 60, revision: 3, instruments: ['drums', 'bass', 'trumpet', 'organ'],
    layers: { trumpet: 4, organ: 2 }, ...(ranges ? { ranges } : {}) });
  const bars = spec => events => events.filter(e => e.type === 'on').map(e => Math.floor(e.time / (spec.beat * 4)));
  const full = engine.composeSongPart(base, part()), cut = engine.composeSongPart(base, part({ trumpet: [[2, 5]], organ: [[0, 1], [6, 8]] }));
  const on = (spec, channel) => bars(spec)(performance.createPerformance(spec).events.filter(e => e.channel === channel));
  assert(on(full, 3).some(b => b < 2) && on(full, 3).some(b => b >= 5));
  assert(on(cut, 3).length > 0 && on(cut, 3).every(b => b >= 2 && b < 5));
  assert(on(cut, 11).every(b => b === 0 || b >= 6) && on(cut, 11).some(b => b >= 6));
  // La base no es veu afectada pels trams dels instruments afegits.
  assert.deepEqual(on(cut, 9), on(full, 9).length ? on(cut, 9) : []);
  assert.equal(on(cut, 2).length, on(full, 2).length);
  for (const ranges of [{ trumpet: [[3, 3]] }, { trumpet: [[0, 9]] }, { trumpet: [] }, { piano: [[0, 1]] }, { trumpet: [[-1, 2]] }, { trumpet: [1, 2] }])
    assert.throws(() => engine.composeSongPart(base, part(ranges)), /Trams/);
});
