import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSoundBank, renderSampledPart } from '../audio/render.mjs';
import { createPerformance } from '../audio/performance.cjs';
import engine from '../radioambient.js';
import audioUtils from '../audio-utils.js';
const { encodeWav, joinStereo } = audioUtils;

const raw = await readFile(new URL('../dist/assets/generaluser-ska-punk.sf2', import.meta.url));
const bank = parseSoundBank(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const settings = { seed: 71931, bpm: 128, style: 'ska', tonic: 0, mode: 'major', instruments: Object.keys(engine.SONG_INSTRUMENTS) };
const part = { type: 'chorus', bars: 4, energy: 75, revision: 1 };
const spec = engine.composeSongPart(settings, part);

test('el banc conté les mostres enregistrades dels instruments i els dos kits requerits', () => {
  assert(raw.byteLength > 1000000 && raw.byteLength < 24 * 1024 * 1024);
  assert.equal(bank.presets.length, 10);
  for (const program of [27, 28, 29, 30, 33, 34, 56, 57]) assert(bank.presets.some(p => p.program === program && !p.isGMGSDrum));
  for (const program of [0, 16]) assert(bank.presets.some(p => p.program === program && p.isGMGSDrum));
  assert(bank.samples.length > 10);
});
test('la interpretació és reproduïble, només activa els instruments seleccionats i respecta contratemps/quintes', () => {
  const ska = createPerformance(spec);
  assert.deepEqual(ska, createPerformance(spec));
  const guitar = ska.events.filter(e => e.type === 'on' && e.channel === 0);
  assert(Math.abs(guitar[0].time - spec.beat / 2) < .01);
  const muted = createPerformance({ ...spec, instruments: ['trumpet'] });
  assert(muted.events.every(e => e.channel === 3));
  const punkSpec = engine.composeSongPart({ ...settings, style: 'punk', bpm: 180 }, part);
  const punk = createPerformance(punkSpec);
  assert.equal(punk.channels.find(c => c.channel === 0).program, 30);
  assert.equal(punk.channels.find(c => c.channel === 9).program, 16);
  const notes = punk.events.filter(e => e.type === 'on' && e.channel === 0).slice(0, 3).map(e => e.note).sort((a,b) => a-b);
  assert.equal(notes[1] - notes[0], 7); assert.equal(notes[2] - notes[0], 12);
  assert(ska.events.every(e => e.time >= 0 && e.time < spec.seconds));
  assert(ska.events.every((e,i,a) => !i || a[i-1].time <= e.time));
});
test('els cinc instruments produeixen àudio estèreo finit a partir del banc real', async () => {
  const renders = [];
  for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) {
    const solo = { ...spec, instruments: [instrument] };
    const channels = await renderSampledPart(bank, solo, 16000);
    assert.equal(channels.length, 2);
    assert.equal(channels[0].length, Math.round(spec.seconds * 16000));
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
    assert.equal(channels[0].length, Math.round(sp.seconds * 44100));
    assert.notDeepEqual(channels[0], channels[1]);
    const joined = joinStereo([channels, channels]);
    assert.equal(joined[0].length, channels[0].length * 2);
    assert.deepEqual(joined[1].slice(channels[0].length), channels[1]);
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
