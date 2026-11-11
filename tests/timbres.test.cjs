'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const { createPerformance } = require('../audio/performance.cjs');
const config = { seed: 771, style: 'ska', bpm: 128, tonic: 0, mode: 'major',
  instruments: ['guitar', 'bass', 'drums'] };
const part = { type: 'verse', bars: 4, energy: 60, revision: 1 };
const patch = (performance, channel) => performance.channels.find(p => p.channel === channel).program;

test('per defecte els presets mantenen l’estil original', () => {
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 0), 27);
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 2), 33);
  assert.equal(patch(createPerformance(engine.composeSongPart(config, part)), 9), 69);
  const punk = engine.composeSongPart({ ...config, style: 'punk', bpm: 180 }, part);
  assert.equal(patch(createPerformance(punk), 0), 30);
  assert.equal(patch(createPerformance(punk), 2), 34);
  assert.equal(patch(createPerformance(punk), 9), 69);
});

test('els presets triats canvien els tres instruments i la guitarra secundària', () => {
  const spec = engine.composeSongPart({ ...config, timbres: {
    guitar: 'muted', bass: 'pick', drums: 'electronic'
  } }, part);
  const music = createPerformance(spec);
  assert.equal(patch(music, 0), 28);
  assert.equal(patch(music, 1), 28);
  assert.equal(patch(music, 2), 34);
  assert.equal(patch(music, 9), 24);
});

test('els sons de la part substitueixen només els sons base indicats', () => {
  const spec = engine.composeSongPart({ ...config, timbres: {
    guitar: 'clean', bass: 'finger', drums: 'rock'
  } }, { ...part, timbres: { guitar: 'distortion', drums: 'standard' } });
  const performance = createPerformance(spec);
  assert.deepEqual(spec.timbres, { guitar: 'distortion', bass: 'finger', drums: 'standard' });
  assert.equal(patch(performance, 0), 30);
  assert.equal(patch(performance, 2), 33);
  assert.equal(patch(performance, 9), 0);
});

test('es rebutgen els sons desconeguts', () => {
  const spec = engine.composeSongPart(config, part);
  for (const timbres of [{ guitar: 'piano' }, { bass: 'slap' }, { drums: 'disco' }, { cello: 'auto' }]) {
    assert.throws(() => createPerformance({ ...spec, timbres }), /Timbres no vàlids/);
  }
});

test('metalls amb variacions de banc, saxo, orgue i articulació', () => {
  const spec = engine.composeSongPart({ ...config, instruments: ['trumpet', 'trombone', 'sax', 'organ'],
    timbres: { trumpet: 'bright', trombone: 'warm' } }, { ...part, layers: { trumpet: 2, trombone: 3, sax: 4, organ: 2 } });
  const music = createPerformance(spec), entry = channel => music.channels.find(p => p.channel === channel);
  assert.deepEqual([entry(3).bank, entry(3).program, entry(4).bank, entry(4).program], [1, 56, 1, 57]);
  assert.deepEqual([entry(8).program, entry(8).instrument, entry(11).program, entry(11).instrument], [66, 'sax', 16, 'organ']);
  assert.equal(createPerformance(engine.composeSongPart({ ...config, timbres: { trumpet: 'muted' } }, part)).channels.find(p => p.channel === 3).program, 59);
  const on = channel => music.events.filter(e => e.type === 'on' && e.channel === channel);
  assert(on(8).length > 0 && on(11).length > 0);
  // Cada nota de metall porta expressió i inflexió (pujada d'afinació o centre).
  assert(music.events.some(e => e.type === 'pitch' && e.channel === 3 && e.value < 8192));
  assert(music.events.some(e => e.type === 'cc' && e.controller === 11 && e.channel === 8));
  assert(music.events.every((e, i, all) => !i || all[i - 1].time <= e.time));
  assert(music.events.filter(e => e.type === 'pitch').every(e => e.value >= 0 && e.value <= 16383));
  // L'orgue té cinc patrons i el saxo una línia pròpia, una octava sota.
  const organs = [1, 2, 3].map(rev => createPerformance(engine.composeSongPart({ ...config, instruments: ['organ'] }, { ...part, layers: { organ: rev } }))
    .events.filter(e => e.type === 'on').length);
  assert(new Set(organs).size > 1);
  assert(Math.max(...on(8).map(e => e.note)) < Math.max(...on(3).map(e => e.note)));
});

test('l’equalitzador es valida i arriba a la interpretació', () => {
  const flat = { low: 0, mid: 0, high: 0, volume: 0 };
  const spec = engine.composeSongPart({ ...config, mix: { bass: { ...flat, low: 4 }, master: { ...flat, high: -3 } } },
    { ...part, mix: { bass: { ...flat, volume: -6 } } });
  assert.deepEqual(spec.mix, { bass: { ...flat, volume: -6 }, master: { ...flat, high: -3 } });
  assert.deepEqual(createPerformance(spec).mix, spec.mix);
  for (const mix of [{ piano: flat }, { bass: { ...flat, low: 13 } }, { bass: { ...flat, volume: -25 } }, { bass: { low: 0 } }, { bass: { ...flat, mid: NaN } }, [], null])
    assert.throws(() => engine.composeSongPart({ ...config, mix }, part), /Equalitzador/);
});

test('per defecte sonen els instruments gravats i les notes curtes dels metalls van a l’staccato', () => {
  const spec = engine.composeSongPart({ ...config, instruments: ['guitar', 'bass', 'drums', 'trumpet', 'trombone', 'sax'] },
    { ...part, type: 'chorus', layers: { trumpet: 2, trombone: 3, sax: 4 } });
  const music = createPerformance(spec), entry = channel => music.channels.find(p => p.channel === channel);
  assert.deepEqual([0, 2, 3, 4, 8, 12, 13].map(c => `${entry(c).bank}:${entry(c).program}`), ['2:27', '2:33', '2:56', '2:66', '2:66', '3:56', '3:57']);
  assert.equal(entry(9).program, 69);
  const notes = channel => music.events.filter(e => e.type === 'on' && e.channel === channel);
  const off = e => music.events.find(o => o.type === 'off' && o.channel === e.channel && o.note === e.note && o.time >= e.time);
  assert(notes(12).length + notes(13).length > 0, 'hi ha notes en staccato');
  assert(notes(12).every(e => off(e).time - e.time < .31));
  assert(notes(3).every(e => off(e).time - e.time >= .29));
  // Les inflexions van al mateix canal que la nota.
  assert(music.events.filter(e => e.type === 'pitch').every(e => [3, 4, 8, 12, 13].includes(e.channel)));
  // Amb el so GM no hi ha staccato separat.
  const gm = createPerformance(engine.composeSongPart({ ...config, instruments: ['trumpet'], timbres: { trumpet: 'gm' } }, { ...part, layers: { trumpet: 2 } }));
  assert(gm.events.every(e => e.channel === 3));
  assert.equal(gm.channels.find(p => p.channel === 3).bank, 0);
});

test('la força dels metalls s’allunya del canvi de dinàmica perquè no salti de mostra', () => {
  for (const type of ['intro', 'verse', 'bridge', 'chorus', 'outro']) {
    const spec = engine.composeSongPart({ ...config, instruments: ['trumpet', 'trombone'] },
      { type, bars: 8, energy: engine.SONG_PARTS[type].energy, revision: 4, layers: { trumpet: 2, trombone: 3 } });
    const velocities = createPerformance(spec).events.filter(e => e.type === 'on').map(e => e.velocity);
    assert(velocities.every(v => v <= 60 || v >= 68), `${type}: ${velocities.filter(v => v > 60 && v < 68)}`);
    assert(Math.max(...velocities) - Math.min(...velocities) <= 25);
  }
});

test('la força dels metalls depèn de la intensitat, no del tipus de secció', () => {
  const velocities = (type, energy) => createPerformance(engine.composeSongPart({ ...config, instruments: ['trumpet'] },
    { type, bars: 4, energy, revision: 2, layers: { trumpet: 3 } })).events.filter(e => e.type === 'on').map(e => e.velocity);
  const mean = list => list.reduce((a, b) => a + b) / list.length;
  assert(Math.abs(mean(velocities('verse', 80)) - mean(velocities('chorus', 80))) < 3, 'estrofa i tornada iguals amb la mateixa intensitat');
  assert(mean(velocities('verse', 90)) > mean(velocities('verse', 30)) + 10, 'la intensitat canvia la força');
});

test('tres guitarres poden sonar a la mateixa secció amb sons i efectes propis', () => {
  const spec = engine.composeSongPart({ ...config, instruments: ['guitar', 'guitar2', 'guitar3'],
    fx: { guitar2: { type: 'distortion', drive: 70, tone: 40 } } },
    { ...part, layers: { guitar: 1, guitar2: 2, guitar3: 3 }, timbres: { guitar3: 'muted' }, fx: { guitar: { type: 'fuzz', drive: 30, tone: 60 } } });
  const music = createPerformance(spec), on = channel => music.events.filter(e => e.type === 'on' && e.channel === channel);
  assert(on(0).length && on(14).length && on(15).length);
  assert(Math.min(...on(14).map(e => e.note)) > Math.min(...on(0).map(e => e.note)), 'la guitarra 2 sona més aguda');
  assert(new Set(on(15).map(e => e.time.toFixed(2))).size === on(15).length, 'la guitarra 3 fa notes soltes (arpegis)');
  assert.equal(music.channels.find(c => c.channel === 15).program, 28);
  assert.deepEqual(music.fx, { guitar: { type: 'fuzz', drive: 30, tone: 60 }, guitar2: { type: 'distortion', drive: 70, tone: 40 } });
  for (const fx of [{ guitar: { type: 'wah', drive: 1, tone: 1 } }, { bass: { type: 'fuzz', drive: 1, tone: 1 } }, { guitar: { type: 'fuzz', drive: 101, tone: 1 } }, { guitar: null }])
    assert.throws(() => engine.composeSongPart({ ...config, fx }, part), /Efecte/);
});

test('guitarra 3: arpegis, riffs i respostes sempre harmonitzen amb els acords', () => {
  // Els acords prestats de diversos estils són especialment importants:
  // la melodia de l'escala no sempre encaixa en el tercer grau de l'acord.
  for (const style of ['ska', 'punk']) for (const mode of ['major', 'minor']) {
    const tonic = style === 'ska' ? (mode === 'major' ? 0 : 9) : (mode === 'major' ? 2 : 9);
    if (!engine.SONG_STYLES[style].keys.some(([k, m]) => k === tonic && m === mode)) continue;
    const cfg = { ...config, style, bpm: engine.SONG_STYLES[style].bpm.default, tonic, mode,
      instruments: ['guitar', 'guitar2', 'guitar3'], humanize: 0 };
    for (const line of ['own', 'riff', 'answer']) {
      const section = { ...part, type: 'chorus', bars: 8, layers: { guitar3: 3 },
        ...(line === 'own' ? {} : { lineModes: { guitar3: line } }) };
      const spec = engine.composeSongPart(cfg, section), music = createPerformance(spec);
      const notes = music.events.filter(e => e.type === 'on' && e.channel === 15);
      assert(notes.length > 0, `calen notes per a ${style}/${mode}/${line}`);
      for (const event of notes) {
        const chord = spec.chords[Math.min(spec.chords.length - 1, Math.floor(event.time / (spec.beat * 4) + 1e-6))];
        assert(chord.pcs.includes(event.note % 12),
          `guitarra 3 desentonada a ${style}/${mode}/${line}: ${event.note} fora de ${chord.pcs}`);
        assert(event.note >= 62 && event.note <= 79, `registre excessiu a ${line}: ${event.note}`);
      }
    }
  }
});

test('el trombó toca la seva línia tal com està composta, una octava avall', () => {
  const spec = engine.composeSongPart({ ...config, instruments: ['trombone'] }, { ...part, type: 'chorus', layers: { trombone: 3 } });
  const notes = createPerformance(spec).events.filter(e => e.type === 'on' && (e.channel === 4 || e.channel === 13)).map(e => e.note);
  const line = spec.lines.trombone.map(([, , pitch]) => { let low = pitch - 12; while (low > 67) low -= 12; while (low < 45) low += 12; return low; });
  assert.deepEqual(notes, line);
});

test('la segona veu de vent sona amb saxo tenor gravat i el trombó és opcional', () => {
  const sp = timbres => engine.composeSongPart({ ...config, instruments: ['trombone'], timbres }, { ...part, type: 'chorus', layers: { trombone: 3 } });
  const music = createPerformance(sp(undefined)), entry = c => music.channels.find(p => p.channel === c);
  assert.deepEqual([entry(4).bank, entry(4).program], [2, 66]);
  assert(music.events.filter(e => e.type === 'on').every(e => e.channel === 4), 'el saxo no fa servir l’staccato del trombó');
  const trombone = createPerformance(sp({ trombone: 'vsco' }));
  assert.deepEqual([trombone.channels.find(p => p.channel === 4).bank, trombone.channels.find(p => p.channel === 4).program], [2, 57]);
  assert(trombone.events.some(e => e.type === 'on' && e.channel === 13), 'el trombó gravat conserva l’staccato');
  assert.equal(createPerformance(sp({ trombone: 'gm' })).channels.find(p => p.channel === 4).bank, 0);
});

test('els dos saxos toquen en registres separats i amb volum suficient', () => {
  const spec = engine.composeSongPart({ ...config, instruments: ['trombone', 'sax'] }, { ...part, type: 'chorus', layers: { trombone: 3, sax: 4 } });
  const music = createPerformance(spec), notes = c => music.events.filter(e => e.type === 'on' && e.channel === c).map(e => e.note);
  assert(notes(8).every(n => n >= 55 && n <= 74), 'saxo: registre agut del tenor');
  assert(notes(4).every(n => n >= 45 && n <= 67), 'segona veu: per sota');
  const mean = list => list.reduce((a, b) => a + b) / list.length;
  assert(mean(notes(8)) > mean(notes(4)) + 3, 'el saxo queda per sobre de la segona veu');
  const volume = c => music.channels.find(p => p.channel === c).volume;
  assert(volume(4) >= 100 && volume(8) >= 90);
});

test('guitarra horror punk (estil Misfits): quintes a cops avall, apagades a l’estrofa i dues guitarres', () => {
  const fx = { guitar: { type: 'horrorpunk', drive: 70, tone: 60 } };
  const sp = type => engine.composeSongPart({ ...config, style: 'punk', bpm: 180, tonic: 4, instruments: ['guitar'], fx }, { ...part, type });
  const verse = createPerformance(sp('verse')), chorus = createPerformance(sp('chorus'));
  const on = (m, c) => m.events.filter(e => e.type === 'on' && e.channel === c);
  const length = (m, e) => m.events.find(o => o.type === 'off' && o.channel === e.channel && o.note === e.note && o.time >= e.time).time - e.time;
  // Corxeres seguides: 8 cops per compàs, cadascun un acord de quinta (fonamental, quinta, octava).
  const bar = verse.events.length && sp('verse').beat * 4;
  assert.equal(on(verse, 0).filter(e => e.time < bar - .01).length, 24);
  const chord = on(verse, 0).slice(0, 3).map(e => e.note).sort((a, b) => a - b);
  assert.deepEqual([chord[1] - chord[0], chord[2] - chord[0]], [7, 12]);
  // Apagades a l'estrofa, obertes a la tornada.
  assert(length(verse, on(verse, 0)[0]) < length(chorus, on(chorus, 0)[0]) * .6);
  // Dues guitarres iguals, obertes a banda i banda, i sense distorsionar dues vegades.
  assert.equal(on(verse, 1).length, on(verse, 0).length);
  const ch = c => verse.channels.find(p => p.channel === c);
  assert(ch(0).pan < 30 && ch(1).pan > 100 && ch(0).volume === ch(1).volume);
  assert.deepEqual([ch(0).bank, ch(0).program], [2, 27], 'entra el so net a l’amplificador');
  assert.equal(verse.fx.guitar.type, 'horrorpunk');
});
