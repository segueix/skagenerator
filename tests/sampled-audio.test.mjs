import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSoundBank, renderSampledPart, baseVolumeDb, createEqualizer, INSTRUMENT_GAIN_DB, REVERB, TAIL_SECONDS } from '../audio/render.mjs';
import { createPerformance } from '../audio/performance.cjs';
import engine from '../radioambient.js';
import audioUtils from '../audio-utils.js';
const { encodeWav, joinStereo, mixSections } = audioUtils;

const raw = await readFile(new URL('../dist/assets/generaluser-ska-punk.sf2', import.meta.url));
const bank = parseSoundBank(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const settings = { seed: 71931, bpm: 128, style: 'ska', tonic: 0, mode: 'major', instruments: Object.keys(engine.SONG_INSTRUMENTS) };
const part = { type: 'chorus', bars: 4, energy: 75, revision: 1 };
const spec = engine.composeSongPart(settings, part);

test('els reguladors generals arriben als dos tipus de bateria i baix sense afectar altres instruments', () => {
  const score = { baseVolume: { drums: -8, bass: 4 } };
  for (const instrument of ['drums', 'electronicDrums']) assert.equal(baseVolumeDb(score, instrument), -8);
  for (const instrument of ['bass', 'synthBass']) assert.equal(baseVolumeDb(score, instrument), 4);
  for (const instrument of ['guitar', 'trumpet', 'organ']) assert.equal(baseVolumeDb(score, instrument), 0);
  assert.equal(baseVolumeDb({}, 'drums'), 0);
});
test('el banc conté les mostres enregistrades dels instruments i els tres kits requerits', () => {
  assert(raw.byteLength > 1000000 && raw.byteLength < 40 * 1024 * 1024);
  assert.equal(bank.presets.length, 35);
  for (const program of [53, 73, 79]) assert(bank.presets.some(p => p.bankMSB === 0 && p.program === program), `veu GM ${program}`);
  assert(bank.presets.some(p => p.bankMSB === 2 && p.program === 71), 'clarinet gravat');
  // Instruments gravats: VSCO 2 CE (banc 2 i staccato al 3), FreePats (banc 2) i el kit Muldjord (64).
  for (const [bankMSB, program] of [[2, 27], [2, 33], [2, 34], [2, 56], [2, 57], [2, 66], [3, 56], [3, 57]])
    assert(bank.presets.some(p => p.bankMSB === bankMSB && p.program === program && !p.isGMGSDrum), `${bankMSB}:${program}`);
  assert(bank.presets.some(p => p.program === 69 && p.isGMGSDrum));
  for (const program of [16, 27, 28, 29, 30, 33, 34, 38, 56, 57, 59, 66, 81, 89]) assert(bank.presets.some(p => p.program === program && !p.isGMGSDrum));
  for (const [bankMSB, program] of [[1, 56], [1, 57]]) assert(bank.presets.some(p => p.bankMSB === bankMSB && p.program === program));
  for (const program of [0, 8, 16, 24, 32, 40]) assert(bank.presets.some(p => p.program === program && p.isGMGSDrum));
  assert(bank.samples.length > 10);
});
test('la interpretació és reproduïble, només activa els instruments seleccionats i respecta contratemps/quintes', () => {
  const ska = createPerformance(spec);
  assert.deepEqual(ska, createPerformance(spec));
  const guitar = ska.events.filter(e => e.type === 'on' && e.channel === 0);
  assert(Math.abs(guitar[0].time - spec.beat / 2) < .01);
  const muted = createPerformance({ ...spec, instruments: ['trumpet'] });
  assert(muted.events.every(e => e.channel === 3 || e.channel === 12));
  const punkSpec = engine.composeSongPart({ ...settings, style: 'punk', bpm: 180 }, part);
  const punk = createPerformance(punkSpec);
  assert.equal(punk.channels.find(c => c.channel === 0).program, 30);
  assert.equal(punk.channels.find(c => c.channel === 9).program, 69);
  const notes = punk.events.filter(e => e.type === 'on' && e.channel === 0).slice(0, 3).map(e => e.note).sort((a,b) => a-b);
  assert.equal(notes[1] - notes[0], 7); assert.equal(notes[2] - notes[0], 12);
  assert(ska.events.every(e => e.time >= 0 && e.time < spec.seconds));
  assert(ska.events.every((e,i,a) => !i || a[i-1].time <= e.time));
});
test('trompeta: més presència i reverberació general sense alterar altres instruments', () => {
  assert.equal(INSTRUMENT_GAIN_DB.trumpet, 3, 'guany general de 3 dB');
  assert.equal(REVERB.trumpet, 58, 'més enviament a sala, tant en legato com en staccato');
  const boosted = createEqualizer('trumpet', { volume: 0 }, 44100);
  assert(Math.abs(boosted.gain - 10 ** (3 / 20)) < 1e-10);
  assert.equal(createEqualizer('trumpet', { volume: -3 }, 44100).gain, 1, 'el volum de l’usuari encara compensa el guany');
  for (const name of ['trombone', 'sax', 'guitar', 'bass'])
    assert.equal(createEqualizer(name, { volume: 0 }, 44100).gain, 1, name);
});
test('els nou instruments produeixen àudio estèreo finit a partir del banc real', async () => {
  const renders = [];
  for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) {
    const solo = { ...spec, instruments: [instrument] };
    const channels = await renderSampledPart(bank, solo, 16000);
    assert.equal(channels.length, 2);
    assert.equal(channels[0].length, Math.round(spec.seconds * 16000) + Math.round(TAIL_SECONDS * 16000));
    let sum = 0;
    for (const channel of channels) {
      assert(channel.every(Number.isFinite)); assert(channel.every(n => Math.abs(n) <= .931));
      assert(channel[0] === 0 && channel.at(-1) === 0);
      sum += channel.reduce((s,n) => s + n*n, 0);
    }
    assert(sum > 1, `L’instrument ${instrument} ha de ser audible`);
    renders.push(channels);
  }
  assert.notDeepEqual(renders[3][0], renders[4][0]);
});
test('ska i punk es renderitzen a 44,1 kHz amb separació estèreo i durada de compàs exacta', async () => {
  for (const style of ['ska', 'punk']) {
    const sp = engine.composeSongPart({ ...settings, style, bpm: engine.SONG_STYLES[style].bpm.default }, part);
    const channels = await renderSampledPart(bank, sp);
    const body = Math.round(sp.seconds * 44100), tail = Math.round(TAIL_SECONDS * 44100);
    assert.equal(channels[0].length, body + tail);
    assert.notDeepEqual(channels[0], channels[1]);
    const joined = joinStereo([channels, channels]);
    assert.equal(joined[0].length, channels[0].length * 2);
    assert.deepEqual(joined[1].slice(channels[0].length), channels[1]);
    // A la cançó, la cua de cada secció sona sobre l'inici de la següent.
    const song = mixSections([channels, channels], [body, body]);
    assert.equal(song[0].length, body * 2 + tail);
    assert.deepEqual(song[0].slice(0, body), channels[0].slice(0, body));
    assert(song[0].every(n => Number.isFinite(n) && Math.abs(n) <= 1));
    assert(channels[0].slice(body, body + 4410).some(n => Math.abs(n) > .001), 'la cua ha de contenir la ressonància');
    assert.notDeepEqual(song[0].slice(body, body + tail), channels[0].slice(0, tail));
    assert.throws(() => mixSections([channels], [channels[0].length + 1]));
  }
});
test('el WAV exportat conserva els canals, la freqüència, les mostres i la durada', () => {
  const wav = encodeWav([new Float32Array([.5, -.5, 0]), new Float32Array([-.25, .25, 1])]);
  const view = new DataView(wav);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2); assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 176400); assert.equal(view.getUint16(32, true), 4);
  assert.equal(view.getUint32(40, true), 12); assert.equal(wav.byteLength, 56);
  assert.equal(view.getInt16(44, true), 16383); assert.equal(view.getInt16(46, true), -8192);
  assert.throws(() => encodeWav([new Float32Array(1), new Float32Array(2)]));
  assert.throws(() => encodeWav([new Float32Array([NaN]), new Float32Array(1)]));
});
test('un error de renderització es comunica i el banc es pot reutilitzar després', async () => {
  await assert.rejects(renderSampledPart(bank, spec, 2000));
  await assert.rejects(renderSampledPart(bank, spec, 16000, { cancelled: () => true }));
  const channels = await renderSampledPart(bank, spec, 16000);
  assert(channels[0].some(n => Math.abs(n) > .01));
});

test('urban activa els sintetitzadors i el kit electrònic amb cinc grooves diferents', async () => {
  const profile = engine.SONG_STYLES.urban;
  const cfg = { ...settings, style: 'urban', bpm: profile.bpm.default, tonic: 9, mode: 'minor', instruments: profile.instruments };
  const grooves = new Set(), basses = new Set();
  for (let i = 0; i < 5; i++) {
    const sp = engine.composeSongPart(cfg, { ...part, revision: i + 1, variantIndex: i });
    const performance = createPerformance(sp);
    assert.deepEqual(new Set(performance.events.map(e => e.channel)), new Set([5, 6, 7, 10]));
    assert.equal(performance.channels.find(c => c.channel === 10).program, 24);
    assert.equal(performance.channels.find(c => c.channel === 10).drums, true);
    grooves.add(JSON.stringify(performance.events.filter(e => e.channel === 10 && e.type === 'on').map(e => [e.time, e.note])));
    basses.add(JSON.stringify(sp.bassLine));
    for (const instrument of profile.instruments) {
      const channels = await renderSampledPart(bank, { ...sp, instruments: [instrument] }, 16000);
      assert(channels[0].some(n => Math.abs(n) > .01), `${instrument}, variant ${i}`);
    }
  }
  assert.equal(grooves.size, 5); assert.equal(basses.size, 5);
  const sp = engine.composeSongPart({ ...cfg, instruments: undefined }, part);
  assert.deepEqual(sp.instruments, profile.instruments);
});

test('l’equalitzador canvia el volum i el timbre de cada instrument per separat', async () => {
  const flat = { low: 0, mid: 0, high: 0, volume: 0 };
  const rms = data => Math.sqrt(data[0].reduce((s, x) => s + x * x, 0) / data[0].length);
  const solo = { ...settings, instruments: ['trumpet', 'bass'] }, sp = mix => engine.composeSongPart({ ...solo, mix }, { ...part, layers: { trumpet: 2 } });
  const base = rms(await renderSampledPart(bank, sp(undefined), 16000, { raw: true }));
  const quiet = rms(await renderSampledPart(bank, sp({ trumpet: { ...flat, volume: -24 }, bass: { ...flat, volume: -24 } }), 16000, { raw: true }));
  assert(Math.abs(20 * Math.log10(quiet / base) + 24) < 2.5, 'el volum ha de baixar uns 24 dB');
  const high = (data, sign) => { let prev = 0, e = 0; for (const x of data[0]) { e += (x - prev) ** 2; prev = x; } return e; };
  const bright = await renderSampledPart(bank, sp({ master: { ...flat, high: 12 } }), 44100, { raw: true });
  const dark = await renderSampledPart(bank, sp({ master: { ...flat, high: -12 } }), 44100, { raw: true });
  assert(high(bright) > high(dark) * 2, 'els aguts de la mescla han de canviar');
  const normal = await renderSampledPart(bank, sp(undefined), 16000);
  assert(normal.every(ch => ch.every(x => Number.isFinite(x) && Math.abs(x) <= .931)));
});

test('la trompeta i el trombó gravats tenen un nivell igualat a tota la tessitura', () => {
  const loud = data => { const n = 960; let best = 0; for (let s = 0; s + n <= data.length; s += n / 2) { let e = 0; for (let i = s; i < s + n; i++) e += data[i] * data[i]; best = Math.max(best, e / n); } return 10 * Math.log10(best); };
  for (const [bankMSB, program] of [[2, 56], [2, 57], [3, 56], [3, 57]]) {
    const preset = bank.presets.find(p => p.bankMSB === bankMSB && p.program === program);
    const byLayer = new Map();
    for (const zone of preset.zones[0].instrument.zones) {
      const key = zone.velRange.min;
      if (!byLayer.has(key)) byLayer.set(key, []);
      byLayer.get(key).push(loud(zone.sample.getAudioData()));
    }
    for (const levels of byLayer.values()) assert(Math.max(...levels) - Math.min(...levels) < 3, `${bankMSB}:${program} varia ${(Math.max(...levels) - Math.min(...levels)).toFixed(1)} dB`);
  }
});

test('totes les seccions reben el mateix guany: un instrument no canvia de volum en passar d’una a l’altra', async () => {
  const rms = d => Math.sqrt(d[0].reduce((s, x) => s + x * x, 0) / d[0].length);
  const gains = [];
  for (const type of ['intro', 'verse', 'bridge']) {
    const sp = engine.composeSongPart({ ...settings, instruments: ['bass', 'trumpet'] }, { type, bars: 4, energy: engine.SONG_PARTS[type].energy, revision: 2, layers: { trumpet: 3 } });
    gains.push(20 * Math.log10(rms(await renderSampledPart(bank, sp, 16000)) / rms(await renderSampledPart(bank, sp, 16000, { raw: true }))));
  }
  assert(Math.max(...gains) - Math.min(...gains) < 1, gains.join(', '));
});

test('els efectes de guitarra distorsionen sense canviar el volum', async () => {
  const { createGuitarFx, GUITAR_FX_TYPES } = await import('../audio/render.mjs');
  assert.deepEqual(GUITAR_FX_TYPES, Object.keys(engine.GUITAR_FX).filter(type => type !== 'none'));
  const rate = 44100, x = Float32Array.from({ length: rate }, (_, i) => .05 * Math.sin(2 * Math.PI * 220 * i / rate));
  const harmonics = y => { const at = h => { let re = 0, im = 0; for (let i = rate / 2; i < rate; i++) { const a = 2 * Math.PI * 220 * h * i / rate; re += y[i] * Math.cos(a); im += y[i] * Math.sin(a); } return Math.hypot(re, im); };
    return Math.sqrt([2, 3, 4, 5].reduce((s, h) => s + at(h) ** 2, 0)) / at(1); };
  for (const type of ['distortion', 'metal', 'fuzz']) {
    const fx = createGuitarFx({ type, drive: 80, tone: 50 }, rate), y = x.map(v => fx.process(0, v));
    assert(y.every(Number.isFinite));
    assert(harmonics(y) > .2, `${type} ha de distorsionar`);
  }
  assert.equal(createGuitarFx({ type: 'none', drive: 50, tone: 50 }, rate), null);
  const rms = d => Math.sqrt(d[0].reduce((s, v) => s + v * v, 0) / d[0].length);
  const sp = fx => engine.composeSongPart({ ...settings, instruments: ['guitar'], fx }, { ...part, layers: { guitar: 2 } });
  const clean = rms(await renderSampledPart(bank, sp(undefined), 22050, { raw: true }));
  const dirty = rms(await renderSampledPart(bank, sp({ guitar: { type: 'metal', drive: 90, tone: 50 } }), 22050, { raw: true }));
  assert(Math.abs(20 * Math.log10(dirty / clean)) < 2, `${(20 * Math.log10(dirty / clean)).toFixed(1)} dB`);
});

test('el trombó i el clarinet gravats sonen de seguida (atac curt) per a les notes curtes', () => {
  const env = data => { const w = 320, out = []; for (let s = 0; s + w < data.length; s += w) { let e = 0; for (let i = s; i < s + w; i++) e += data[i] * data[i]; out.push(Math.sqrt(e / w)); } return out; };
  for (const [bankMSB, program] of [[2, 56], [2, 57], [2, 71]]) {
    const preset = bank.presets.find(p => p.bankMSB === bankMSB && p.program === program), times = [];
    for (const sample of new Set(preset.zones[0].instrument.zones.map(z => z.sample))) {
      const e = env(sample.getAudioData()), max = Math.max(...e.slice(0, 150));
      times.push(e.findIndex(v => v >= max * .7) * 10);
    }
    times.sort((a, b) => a - b);
    assert(times[times.length >> 1] <= 60, `${bankMSB}:${program} atac mediana ${times[times.length >> 1]} ms`);
  }
  // L'staccato del trombó no té forats de més de 2 semitons.
  const stac = bank.presets.find(p => p.bankMSB === 3 && p.program === 57);
  const keys = [...new Set(stac.zones[0].instrument.zones.map(z => z.sample.originalKey))].sort((a, b) => a - b);
  for (let k = 40; k <= 65; k++) assert(Math.min(...keys.map(n => Math.abs(n - k))) <= 2, `nota ${k}`);
});

test('banc addicional: bateries i baixos gravats al mateix nivell, Muldjord real i afinació greu', async () => {
  const extraRaw = await readFile(new URL('../dist/assets/extra-instruments.sf2', import.meta.url));
  assert(extraRaw.byteLength > 1000000 && extraRaw.byteLength < 20 * 1024 * 1024);
  const extra = parseSoundBank(extraRaw.buffer.slice(extraRaw.byteOffset, extraRaw.byteOffset + extraRaw.byteLength));
  for (const program of [66, 67, 68]) assert(extra.presets.some(p => p.isGMGSDrum && p.program === program), `kit ${program}`);
  for (const [bankMSB, program] of [[2, 32], [4, 33]]) assert(extra.presets.some(p => !p.isGMGSDrum && p.bankMSB === bankMSB && p.program === program));
  const db = channels => { let s = 0, n = 0; for (const c of channels) for (const x of c) { s += x * x; n++; } return 10 * Math.log10(s / n); };
  const crossings = channels => { let z = 0; const c = channels[0]; for (let i = 1; i < c.length; i++) if ((c[i] >= 0) !== (c[i - 1] >= 0)) z++; return z; };
  const drums = engine.composeSongPart({ seed: 3, style: 'ska', bpm: 140, tonic: 0, mode: 'major' }, { type: 'verse', bars: 2, energy: 70, revision: 1, instruments: ['drums'] });
  const render = (timbres, more = {}) => renderSampledPart(bank, { ...drums, timbres, ...more }, 16000, { extra, raw: true });
  const reference = db(await render({ drums: 'standard' }));
  const levels = {};
  for (const kit of ['real', 'rusty', 'club', 'lofi']) levels[kit] = db(await render({ drums: kit }));
  for (const [kit, level] of Object.entries(levels)) assert(Math.abs(level - reference) < 2.5, `${kit}: ${(level - reference).toFixed(1)} dB`);
  // El kit Muldjord sona amb les seves mostres, no amb el kit GM estàndard.
  assert.notEqual(crossings(await render({ drums: 'real' })), crossings(await render({ drums: 'standard' })));
  // Afinació greu: menys passos per zero (so més greu).
  assert(crossings(await render({ drums: 'rusty' }, { drumTune: -4 })) < crossings(await render({ drums: 'rusty' })) * .9);
  const bassPart = engine.composeSongPart({ seed: 3, style: 'ska', bpm: 140, tonic: 0, mode: 'major' }, { type: 'verse', bars: 2, energy: 70, revision: 1, instruments: ['bass'] });
  const finger = db(await renderSampledPart(bank, { ...bassPart, timbres: { bass: 'finger' } }, 16000, { extra, raw: true }));
  for (const bass of ['upright', 'growly']) {
    const level = db(await renderSampledPart(bank, { ...bassPart, timbres: { bass } }, 16000, { extra, raw: true }));
    assert(Math.abs(level - finger) < 3, `${bass}: ${(level - finger).toFixed(1)} dB`);
  }
});
