'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const singer = require('../browser-singing.js');

const rate = 22050;
const tone = (hz, seconds) => Float32Array.from({ length: Math.round(rate * seconds) },
  (_, i) => Math.sin(2 * Math.PI * hz * i / rate) * .23);

test('quinze timbres diferents i totes les veus Matxa vàlides', () => {
  assert.equal(Object.keys(singer.PRESETS).length, 15);
  assert.equal(new Set(Object.values(singer.PRESETS).map(v => v.name)).size, 15);
  for (const preset of Object.values(singer.PRESETS)) {
    assert(preset.name && singer.ACCENTS[preset.speaker]);
    assert(['clean','warm','radio','lofi','megaphone'].includes(preset.effect));
    for (const value of Object.values(preset.eq)) assert(Math.abs(value) <= 12);
  }
  assert.equal(singer.presetFor('punk77').name, 'Punk 77 cru');
  assert.equal(singer.presetFor('unknown').name, singer.presetFor('jamaican').name);
});

test('estima la freqüència fonamental d’una veu de prova', () => {
  const pitch = singer.estimatePitch(tone(185, .3), rate);
  assert(Math.abs(pitch - 185) < 20, String(pitch));
});

test('els límits del fragment de parla són creixents i preserven el total', () => {
  const speech = tone(185, .6), b = singer.boundaries(speech, 6, rate);
  assert.equal(b.length, 7); assert.equal(b[0], 0); assert.equal(b.at(-1), speech.length);
  for(let i=1;i<b.length;i++)assert(b[i] > b[i-1]);
});

test('veu cantada dins la secció, amb notes, silencis i longitud exacta', () => {
  const speech = tone(185, .8);
  const notes = [{ text: 'Canto', notes: [
    { at: .1, dur: .18, midi: 57 },
    { at: .55, dur: .21, midi: 60 },
    { at: 1.10, dur: .2, midi: 62 }
  ] }];
  const output = singer.renderPCM(speech, notes, rate * 2, rate);
  assert.equal(output.length, rate * 2);
  assert(output.every(Number.isFinite));
  assert(output.slice(0, rate / 12).every(x => x === 0), 'silenci abans de la primera síl·laba');
  assert(output.slice(Math.ceil(.35*rate), Math.floor(.50*rate)).every(x => x === 0), 'silenci entre notes');
  assert(output.slice(Math.ceil(1.42*rate)).every(x => x === 0), 'silenci posterior');
  const peak = Math.max(...output.slice(Math.floor(.12*rate), Math.floor(.14*rate)).map(Math.abs));
  assert(peak > .001, 'veu efectiva en una nota');
  assert.deepEqual(output, singer.renderPCM(speech, notes, rate * 2, rate), 'cant reproduïble');
});

test('protegeix els fitxers de Matxa contra altres dominis', () => {
  assert.match(singer.extractAudioUrl([{ path:'/tmp/test.wav' }]), /\.wav/);
  assert.throws(() => singer.extractAudioUrl([{ url:'https://invalid.example/a.wav' }]), /origen/);
  assert.throws(() => singer.extractAudioUrl([]), /fitxer/);
});

test('el motor passa el preset al worker i lliura un buffer mono', async () => {
  let received;
  const mockWorker = {
    onmessage: null, terminate() {},
    postMessage(data) {
      received = data;
      queueMicrotask(() => this.onmessage({ data: { id: data.id, voice: new Float32Array(data.frames).fill(.25) } }));
    }
  };
  const renderer = singer.createBrowserSinger({
    rate,
    client: { speak: async () => tone(185, .5) },
    makeWorker: () => mockWorker
  });
  const voice = await renderer.renderSection({
    text:'Vine a ballar', subgenre:'skaswing', frames:3000,
    lines:[{ text:'Vine a ballar', notes:[{ at:.1, dur:.1, midi:60 }] }]
  });
  assert.equal(voice.length, 3000);
  assert.equal(received.preset.name, 'Ska-swing brillant');
  assert.equal(received.type, 'sing');
  renderer.dispose();
});

test('una petició Matxa cancel·lada no crida el servei extern', async () => {
  const controller = new AbortController(); controller.abort();
  const client = new singer.MatxaClient();
  await assert.rejects(client.speak('Hola', 'grau', rate, controller.signal), /cancel·lada/);
});

test('el client Matxa segueix la cua Gradio i reutilitza una locució', async () => {
  const oldFetch = global.fetch, oldWindow = global.window;
  let joined = 0, downloads = 0, activeEvent;
  const encoder = new TextEncoder();
  global.window = {
    AudioContext: class {
      decodeAudioData() {
        return Promise.resolve({ length: 2205, sampleRate: rate, numberOfChannels: 1,
          getChannelData: () => tone(180, .1) });
      }
    },
    SkaAudioUtils: { resampleLinear: x => x }
  };
  global.fetch = async (url, options) => {
    if (url.endsWith('/queue/join')) {
      joined++;
      activeEvent = 'test-' + joined;
      return { ok: true, json: async () => ({ event_id: activeEvent }) };
    }
    if (url.includes('/queue/data?')) {
      let read = false;
      const payload = { msg: 'process_completed', event_id: activeEvent, success: true,
        output: { data: [{ url: 'https://projecte-aina-matxa-alvocat-tts-ca.hf.space/gradio_api/file=test.wav' }] } };
      return { ok: true, body: { getReader: () => ({
        read: async () => read ? { done: true } : (read = true, { done: false, value: encoder.encode('data: ' + JSON.stringify(payload) + '\n\n') }),
        cancel: async () => {}
      }) } };
    }
    if (url.includes('file=test.wav')) {
      downloads++;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(12) };
    }
    throw Error('Petició inesperada: ' + url);
  };
  try {
    const client = new singer.MatxaClient();
    const first = await client.speak('Bon dia', 'grau', rate);
    const again = await client.speak('Bon dia', 'grau', rate);
    assert.equal(first, again, 'la locució és a la memòria cau');
    assert.equal(joined, 2, 'només les dues operacions de Gradio');
    assert.equal(downloads, 1, 'WAV descarregat una vegada');
    assert.equal(first.length, 2205);
  } finally { global.fetch = oldFetch; global.window = oldWindow; }
});

test('el mapeig de versos respecta el recompte de síl·labes i el tempo', () => {
  const notes = [[0,0,57,1],[0,1,59,1],[1,0,62,1]];
  const mapped = singer.scoreLines('Vine a ballar\nJa som aquí', [2,1], notes, 120);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].text, 'Vine a ballar');
  assert.equal(mapped[1].notes[0].at, 2);
  assert.equal(mapped[0].notes[1].at, .5);
  assert.equal(singer.scoreLines('Vine a ballar\nJa som aquí', [2,2], notes, 120).length, 0);
});

test('el worker aplica el preset i lliura una veu processada', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  let output;
  const context = {
    Float32Array, Math, console,
    self: { postMessage: data => { output = data; } }
  };
  context.importScripts = () => {
    context.self.SkaAudioUtils = require('../audio-utils.js');
    context.self.SkaBrowserSinging = singer;
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../browser-singing-worker.js'), 'utf8'), context);
  const pcm = tone(185, .5);
  context.self.onmessage({ data: {
    id: 8, type:'sing', pcm, rate, frames: rate,
    lines: [{ text:'Vine', notes: [{ at:.1, dur:.22, midi:60 }] }],
    preset: singer.presetFor('punk77')
  } });
  assert.equal(output.id, 8);
  assert(!output.error, output.error);
  assert.equal(output.voice.length, rate);
  assert(output.voice.some(x => Math.abs(x) > .001));
  assert(output.voice.every(x => Number.isFinite(x) && Math.abs(x) <= 1));
});
