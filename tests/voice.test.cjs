'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mixVoice, placeTake, levelTake, resampleLinear } = require('../audio-utils.js');

const tone = (length, value = .5, rate = 44100, hz = 440) => Float32Array.from({ length }, (_, i) => value * Math.sin(2 * Math.PI * hz * i / rate));

test('la veu se suma centrada, al lloc correcte i amb el desplaçament de sincronia', () => {
  const mix = [new Float32Array(1000), new Float32Array(1000)], voice = new Float32Array(3000);
  voice[1500] = 1;
  const out = mixVoice(mix, voice, { from: 1000 });
  assert.equal(out[0].length, 1000);
  assert(Math.abs(out[0][500]) > .5 && out[0][500] === out[1][500], 'impuls al compàs on es va cantar');
  assert(out[0].slice(0, 500).every(x => x === 0));
  const later = mixVoice(mix, voice, { from: 1000, offset: 100 });
  assert(Math.abs(later[0][600]) > .5 && Math.abs(later[0][500]) < .01, '+100 mostres la retarda');
  assert(mix[0].every(x => x === 0), 'la música original no es modifica');
  const softer = mixVoice(mix, voice, { from: 1000, gainDb: -6 });
  assert(Math.abs(softer[0][500] - out[0][500] * 10 ** (-6 / 20)) < 1e-6);
});

test('el filtre treu el soroll greu i el limitador evita la saturació', () => {
  const mix = [new Float32Array(44100).fill(.8), new Float32Array(44100).fill(.8)];
  const rumble = Float32Array.from({ length: 44100 }, () => .5); // corrent continu
  const out = mixVoice(mix, rumble, { gainDb: 0 });
  assert(Math.abs(out[0][40000] - .8) < .01, 'el component continu desapareix');
  const loud = mixVoice(mix, tone(44100, 1), { gainDb: 12 });
  assert(loud[0].every(x => Math.abs(x) <= 1));
});

test('regravar un tros conserva la resta de la veu', () => {
  const voice = Float32Array.from({ length: 100 }, () => .1), take = Float32Array.from({ length: 40 }, () => .7);
  const out = placeTake(voice, take, 20, 30);
  assert.equal(out.length, 100);
  assert(out.slice(0, 30).every(x => x === Math.fround(.1)), 'abans del punt d’entrada no canvia');
  assert(out.slice(30, 60).every(x => x === Math.fround(.7)));
  assert(out.slice(60).every(x => x === Math.fround(.1)), 'després de la presa no canvia');
  assert.equal(placeTake(null, take, 90).length, 130);
});

test('la presa s’anivella sense saturar i el remostreig conserva la durada', () => {
  const quiet = tone(44100, .03), leveled = levelTake(quiet.slice());
  const rms = Math.sqrt(leveled.reduce((s, x) => s + x * x, 0) / leveled.length);
  assert(Math.abs(20 * Math.log10(rms) + 18) < 1);
  const hot = levelTake(tone(1000, .99));
  assert(Math.max(...hot.map(Math.abs)) <= .9001);
  assert.equal(resampleLinear(new Float32Array(48000), 48000, 44100).length, 44100);
});
