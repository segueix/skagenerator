'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mixVoice, processVoice, VOICE_EFFECTS, placeTake, levelTake, resampleLinear } = require('../audio-utils.js');

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

test('els filtres de megàfon, telèfon, ràdio i similars processen només la veu', () => {
  const source = tone(44100, .3, 44100, 1200), before = source.slice();
  const clean = processVoice(source, { effect: 'clean' });
  const strength = data => Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
  for (const effect of Object.keys(VOICE_EFFECTS)) {
    const out = processVoice(source, { effect });
    assert.equal(out.length, source.length, effect);
    assert(out.every(Number.isFinite), `mostres finites: ${effect}`);
    assert(out.every(x => Math.abs(x) <= 1), `sense saturació digital: ${effect}`);
    if (effect !== 'clean') {
      // Cada preset té una resposta espectral: «càlida» afecta sobretot els
      // greus, no necessàriament una nota a 1.200 Hz.
      const differs = [140, 1200, 5200].some(hz => {
        const input = tone(44100, .3, 44100, hz);
        return Math.abs(strength(processVoice(input, { effect })) -
          strength(processVoice(input, { effect: 'clean' }))) > .002;
      });
      assert(differs, `el preset ${effect} modifica efectivament el so`);
    }
  }
  // Els filtres shelving són recursius: un signe erroni pot fer divergir
  // els greus/aguts al llarg d'una gravació encara que un clip curt funcioni.
  for (const eq of [{ low: 12 }, { low: -12 }, { high: 12 }, { high: -12 }, { low: 6, mid: -4, high: 5 }])
    for (const effect of ['clean', 'warm', 'megaphone']) {
      const output = processVoice(source, { effect, eq });
      assert(output.every(Number.isFinite), `EQ estable per a ${effect}: ${JSON.stringify(eq)}`);
    }
  assert.deepEqual(source, before, 'la gravació original no queda modificada');
});

test('el megàfon retalla greus i aguts; els tres reguladors de l’EQ canvien el so', () => {
  const rate = 44100, rms = data => Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
  const compare = (hz, effect) => rms(processVoice(tone(rate, .2, rate, hz), { effect }));
  assert(compare(120, 'megaphone') < compare(120, 'clean') * .4, 'el megàfon retalla els greus');
  assert(compare(6500, 'megaphone') < compare(6500, 'clean') * .5, 'el megàfon retalla els aguts');
  const sound = tone(rate, .1, rate, 1200);
  const center = rms(processVoice(sound, { effect: 'clean' }));
  assert(rms(processVoice(sound, { effect: 'clean', eq: { mid: 10 } })) > center * 1.4,
    'els mitjos es poden augmentar');
  assert(rms(processVoice(sound, { effect: 'clean', eq: { mid: -10 } })) < center * .8,
    'els mitjos es poden reduir');
  const stereo = [new Float32Array(rate), new Float32Array(rate)];
  const out = mixVoice(stereo, sound, { effect: 'telephone', eq: { high: -8 }, rate });
  assert(out[0].some(x => x !== 0) && out[0].every((x, i) => x === out[1][i]));
  assert.throws(() => processVoice(sound, { effect: 'x' }), /Filtre/);
  assert.throws(() => processVoice(sound, { eq: { low: 15 } }), /Equalitzador/);
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
