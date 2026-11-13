'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const singer = require('../browser-singing.js');
const M = require('../matxa-singer.js');
const W = require('../world.js');

const rate = 22050;
const tone = (hz, seconds) => Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => Math.sin(2 * Math.PI * hz * i / rate) * .23);
const wasm = fs.readFileSync(path.join(__dirname, '../vendor/world/world.wasm'));
// «Parla» de prova: síl·labes sonores (harmònics a 130 Hz) separades per silencis curts.
function syllables(count, seconds = .18, gap = .07) {
  const out = new Float32Array(Math.round(rate * (count * (seconds + gap) + .3)));
  for (let k = 0; k < count; k++) {
    const a = Math.round(rate * (.15 + k * (seconds + gap))), n = Math.round(rate * seconds);
    for (let i = 0; i < n; i++) { const t = i / rate, env = Math.sin(Math.PI * i / n);
      out[a + i] = env * .3 * (Math.sin(2 * Math.PI * 130 * t) + .6 * Math.sin(4 * Math.PI * 130 * t) + .4 * Math.sin(6 * Math.PI * 130 * t) + .2 * Math.sin(10 * Math.PI * 130 * t)); }
  }
  return out;
}
const median = list => { const s = list.filter(v => v > 0).sort((a, b) => a - b); return s[s.length >> 1]; };

test('timbres de l’acció per als quinze subgèneres, amb veus Matxa vàlides', () => {
  assert.equal(Object.keys(M.TIMBRES).length, 15);
  for (const t of Object.values(M.TIMBRES)) {
    assert(singer.ACCENTS[t.speaker], t.name);
    assert(!['quim', 'olga'].includes(t.speaker), 'veus que cantades s’entenen poc');
  }
  assert.equal(M.timbreFor('oi').speaker, 'grau');
  assert.equal(M.timbreFor('desconegut').name, 'Matxa natural');
  assert.equal(M.noteOf('grau'), 54); assert.equal(M.noteOf('emma'), 64);
});

test('filtres, Savitzky-Golay i pics iguals que SciPy', () => {
  const close = (a, b, msg) => a.forEach((v, i) => assert(Math.abs(v - b[i]) < 1e-9, `${msg}: ${v} ≠ ${b[i]}`));
  const flat = sos => sos.flatMap(s => [...s.b, ...s.a]);
  close(flat(M.butter(2, 110, 'high', 44100)), [0.988979156606, -1.977958313212, 0.988979156606, 1, -1.977836850535, 0.978079775889], 'passaaltes');
  close(flat(M.butter(1, 4, 'low', 44100)), [0.000284870548, 0.000284870548, 0, 1, -0.999430258904, 0], 'passabaixos');
  // Pas banda d'ordre 4: mateixa resposta (l'ordre de les seccions no importa).
  const impulse = new Float64Array(400); impulse[0] = 1;
  const want = [[0.002637848636, 0.005275697271, 0.002637848636, 1, -1.2263990502, 0.398747696129], [1, 2, 1, 1, -1.43710166876, 0.697151142891],
    [1, -2, 1, 1, -1.914047926147, 0.916335065891], [1, -2, 1, 1, -1.969404352712, 0.971266238202]].map(r => ({ b: r.slice(0, 3), a: r.slice(3) }));
  close(M.sosfilt(M.butter(4, [300, 4000], 'band', 44100), impulse), M.sosfilt(want, impulse), 'pas banda');
  close(M.savgol7(Float64Array.from([0, 1, 4, 9, 16, 25, 36, 49, 64])), [0, 1, 4, 9, 16, 25, 36, 49, 64], 'Savitzky-Golay conserva una paràbola');
  const peaks = M.findPeaks(Float64Array.from([0, 3, 1, 1, 5, 5, 5, 2, 0, 4, 0]), 1, 0);
  assert.deepEqual(peaks.map(p => [p.at, p.prominence]), [[1, 2], [5, 5], [9, 4]]);
  assert.deepEqual(M.findPeaks(Float64Array.from([0, 3, 1, 1, 5, 5, 5, 2, 0, 4, 0]), 5, 0).map(p => p.at), [5], 'com SciPy: els pics a menys de 5 del més alt fora');
});

test('WORLD en WebAssembly: troba el to i torna a sintetitzar la veu', async () => {
  const world = await W.load(wasm), x = Float64Array.from(syllables(2, .4));   // veu amb harmònics a 130 Hz
  const { f0, positions } = world.harvest(x, rate, { f0Floor: 60, f0Ceil: 600 });
  assert(Math.abs(12 * Math.log2(median(Array.from(f0)) / 130)) < .3, String(median(Array.from(f0))));
  const { sp, ap, bins, fft } = world.analyse(x, rate, f0, positions);
  assert.equal(fft, 1024); assert.equal(sp.length, f0.length * bins); assert.equal(ap.length, f0.length * bins);
  const twice = f0.map(v => v * 2), y = world.synthesize(twice, sp, ap, fft, rate);
  assert.equal(y.length, Math.floor(f0.length * 5 * rate / 1000));
  assert(y.every(Number.isFinite));
  assert(Math.abs(12 * Math.log2(median(Array.from(world.harvest(y, rate, { f0Floor: 60, f0Ceil: 600 }).f0)) / median(Array.from(f0)) / 2)) < .7, 'una octava amunt');
});

test('de parla a cant: una síl·laba per nota, al to de la melodia i al seu lloc', async () => {
  const world = await W.load(wasm), speech = syllables(4), unit = M.analyse(world, speech, rate, 4);
  assert.equal(unit.sylls.length, 4);
  unit.sylls.forEach(([o0, a, b, c1], k) => { assert(o0 <= a && a < b && b <= c1, JSON.stringify(unit.sylls[k])); if (k) assert(a > unit.sylls[k - 1][1]); });
  const notes = [0, 1, 2, 3].map(k => ({ t: 1 + k * .5, d: .45, midi: 57, word: 'la', syllable: 0, lineStart: k === 0 }));
  const { start, wave } = M.singLine(world, notes, 0, unit);
  assert(Math.abs(start - .55) < 1e-9);
  assert(wave.every(Number.isFinite) && wave.some(v => Math.abs(v) > .01));
  // Al to de la nota (la3 = 220 Hz), amb vibrato i lliscaments: la mediana hi és a prop.
  const sung = Float64Array.from(wave.filter((_, i) => i % 2 === 0));
  const hz = median(Array.from(world.harvest(sung, rate, { f0Floor: 60, f0Ceil: 600 }).f0));
  assert(Math.abs(12 * Math.log2(hz / 220)) < .6, `canta a ${hz.toFixed(1)} Hz`);
  // Cada síl·laba sona a la seva nota i entre notes separades hi ha silenci.
  const level = (a, b) => { let s = 0; for (let i = Math.round(a * 44100); i < Math.round(b * 44100); i++) s += wave[i] * wave[i]; return Math.sqrt(s / ((b - a) * 44100)); };
  for (let k = 0; k < 4; k++) assert(level(.45 + k * .5 + .1, .45 + k * .5 + .3) > .01, `nota ${k}`);
  // Mateix vers, mateix resultat (la tornada sona igual cada cop).
  assert.deepEqual(M.singLine(world, notes, 0, unit).wave, wave);
});

test('partitura com la de l’acció: unitats amb sinalefa, versos, swing i octava', () => {
  const lyricWords = require('../radioambient.js').lyricWords;
  const melody = [[0, 0, 60, 1], [0, 1, 62, .5], [0, 1.5, 64, .5], [0, 2, 65, 1], [0, 3, 67, 1], [1, 0, 69, 2]];
  const notes = singer.scoreNotes([{ at: 10, bpm: 120, text: 'Que arribi el matí\nja', melody, type: 'chorus' }], lyricWords, .6);
  assert.deepEqual(notes.map(n => [n.word, n.syllable]), [['que arribi el', 0], ['que arribi el', 1], ['que arribi el', 2], ['matí', 0], ['matí', 1], ['ja', 0]]);
  assert.deepEqual(notes.map(n => n.lineStart), [true, false, false, false, false, true]);
  assert.equal(notes[0].t, 10); assert(Math.abs(notes[2].t - (10 + (1.5 + .1) * .5)) < 1e-9, 'contratemps amb swing');
  assert.equal(notes[0].section, 'chorus');
  const phrases = M.phrasesOf(notes);
  assert.equal(phrases.length, 2);
  assert.equal(M.lineText(phrases[0]), 'Que arribi el matí.');
  // Conversor de lletra: a les síl·labes llargues (0,3 s o més) la vocal s'escriu tres cops; les consonants,
  // les síl·labes curtes i les unitats amb sinalefa no es toquen.
  assert.equal(M.stretchWord('casa', [.5, .5], .3), 'caaasaaa');
  assert.equal(M.stretchWord('guitarra', [.5, .2, .5], .3), 'guiiitarraaa');
  assert.equal(M.stretchWord('matí', [.2, .6], .3), 'matíii');
  assert.equal(M.stretchWord('quedat', [.2, .2], .3), 'quedat');
  assert.equal(M.spokenText(phrases[0]), 'Que arribi el maaatíii.', 'les dues notes de «matí» duren mig segon o més');
  assert.equal(M.shiftFor(notes, 'grau'), -12); assert.equal(M.shiftFor(notes, 'emma'), 0);
});

test('mescla de l’acció: veu per sobre de la banda, greus de la banda més fluixos i sense saturar', () => {
  const n = 44100 * 3, band = [new Float32Array(n), new Float32Array(n)], vocal = new Float32Array(n);
  for (let i = 0; i < n; i++) { const b = .5 * Math.sin(2 * Math.PI * 60 * i / 44100) + .1 * Math.sin(2 * Math.PI * 1000 * i / 44100); band[0][i] = b; band[1][i] = b; }
  for (let i = 44100; i < 2 * 44100; i++) vocal[i] = .2 * Math.sin(2 * Math.PI * 440 * i / 44100);
  const mix = M.mixSong(band, vocal, 'twotone');
  assert.equal(mix[0].length, n); assert.equal(mix[1].length, n);
  let peak = 0; for (const ch of mix) for (const v of ch) { assert(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
  assert(peak <= .97 + 1e-6);
  const low = M.butter(4, 250, 'low', 44100), bass = (x, a, b) => { const y = M.sosfilt(low, x.subarray(a, b)); let s = 0; for (const v of y.subarray(4410)) s += v * v; return Math.sqrt(s / (y.length - 4410)); };
  const before = bass(mix[0], 0, 44100), during = bass(mix[0], Math.round(1.2 * 44100), 2 * 44100);
  assert(during < before * .8, `greus mentre canta: ${during.toFixed(3)} / ${before.toFixed(3)}`);
});

test('cantant del navegador: un sol cop per vers, la banda va i torna al worker, i si Matxa cau no s’hi insisteix', async () => {
  const oldWindow = global.window; global.window = { SkaMatxaSinger: M };
  try {
    const asked = [], messages = [];
    let fail = false;
    const client = { speak: async (text, speaker) => { asked.push([text, speaker]); if (fail) throw new Error('caigut'); return syllables(3); } };
    const worker = { onmessage: null, terminate() {}, postMessage(data, transfer) {
      messages.push([data.type, transfer?.length || 0]);
      queueMicrotask(() => this.onmessage({ data: data.type === 'sing' ? { id: data.id, mix: data.band.map(c => c.map(v => v + 1)) } : { id: data.id } }));
    } };
    const s = singer.createBrowserSinger({ client, makeWorker: () => worker });
    const line = (t, word) => [0, 1, 2].map(k => ({ t: t + k * .25, d: .2, midi: 60, word, syllable: k, lineStart: k === 0 }));
    const notes = [...line(0, 'tornada'), ...line(2, 'estrofa'), ...line(4, 'tornada')];
    const job = s.start({ notes, subgenre: 'oi' });
    await job.ready;
    assert.deepEqual(asked, [['Tornada.', 'grau'], ['Estrofa.', 'grau']], 'la tornada es demana un sol cop');
    const band = [new Float32Array(4), new Float32Array(4)];
    const mix = await s.finish(job, band);
    assert.deepEqual(Array.from(mix[0]), [1, 1, 1, 1]);
    assert.deepEqual(messages.map(m => m[0]), ['analyse', 'analyse', 'sing']);
    assert.equal(messages[2][1], 2, 'la banda es transfereix sense copiar-la');
    assert.equal(job.timbre.name, 'Oi! aspre i contundent');
    fail = true;
    const broken = s.start({ notes: line(0, 'una altra'), subgenre: 'oi' });
    await assert.rejects(s.finish(broken, band), /caigut/);
    assert.equal(s.available, false, 'durant uns minuts no es torna a provar');
    s.dispose();
  } finally { global.window = oldWindow; }
});

test('el worker canta i mescla una cançó, i si falla retorna la banda', async () => {
  const vm = require('node:vm');
  const out = [];
  const context = { console, URL, Float32Array, Float64Array, Uint8Array, Math, Map, Promise, WebAssembly, Error,
    self: { location: { href: 'https://exemple.cat/' }, postMessage: data => out.push(data) } };
  context.importScripts = () => { context.self.SkaWorld = W; context.self.SkaMatxaSinger = M; };
  context.fetch = async () => ({ arrayBuffer: async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
  context.self.SkaWorld = null;
  vm.runInNewContext(fs.readFileSync(require.resolve('../matxa-worker.js'), 'utf8'), context);
  // world.js fa servir fetch quan rep una adreça.
  const oldFetch = global.fetch; global.fetch = context.fetch;
  try {
    const notes = [0, 1, 2].map(k => ({ t: .6 + k * .4, d: .35, midi: 60, word: 'la', syllable: 0, lineStart: k === 0 }));
    await context.self.onmessage({ data: { type: 'analyse', id: 1, song: 7, key: M.spokenText(notes) + '|3', speech: syllables(3), rate, count: 3 } });
    const n = 44100 * 3, music = () => Float32Array.from({ length: n }, (_, i) => .05 * Math.sin(2 * Math.PI * 1000 * i / 44100)), band = [music(), music()];
    await context.self.onmessage({ data: { type: 'sing', id: 2, song: 7, notes, subgenre: 'twotone', speaker: 'pere', band } });
    const done = out.find(m => m.id === 2);
    assert(!done.error, done.error);
    assert.equal(done.mix[0].length, n);
    assert(done.mix[0].some((v, i) => Math.abs(v) > .12), 'hi ha veu');
    // Sense parla analitzada (Matxa no ha respost): error i la banda tornada intacta.
    const again = [new Float32Array(10).fill(.5), new Float32Array(10).fill(.5)];
    await context.self.onmessage({ data: { type: 'sing', id: 3, song: 99, notes, subgenre: 'twotone', speaker: 'pere', band: again } });
    const failed = out.find(m => m.id === 3);
    assert.match(failed.error, /parla/); assert.equal(failed.band[0][0], .5);
  } finally { global.fetch = oldFetch; }
});

test('protegeix els fitxers de Matxa contra altres dominis', () => {
  assert.match(singer.extractAudioUrl([{ path:'/tmp/test.wav' }]), /\.wav/);
  assert.throws(() => singer.extractAudioUrl([{ url:'https://invalid.example/a.wav' }]), /origen/);
  assert.throws(() => singer.extractAudioUrl([]), /fitxer/);
});

test('una petició Matxa cancel·lada no crida el servei extern', async () => {
  const controller = new AbortController(); controller.abort();
  const client = new singer.MatxaClient();
  await assert.rejects(client.speak('Hola', 'grau', rate, controller.signal), /cancel·lada/);
});

test('el client Matxa segueix la cua Gradio i reutilitza una locució', async () => {
  const oldFetch = global.fetch, oldWindow = global.window;
  let joined = 0, downloads = 0, activeEvent; const sent = [];
  const encoder = new TextEncoder();
  global.window = {
    AudioContext: class {
      decodeAudioData() {
        return Promise.resolve({ length: 2205, sampleRate: rate, numberOfChannels: 1,
          getChannelData: () => tone(180, .1) });
      }
    },
    SkaAudioUtils: { resampleLinear: x => x },
    OfflineAudioContext: class { decodeAudioData() { return Promise.resolve({ length: 2205, sampleRate: rate, numberOfChannels: 1, getChannelData: () => tone(180, .1) }); } }
  };
  global.fetch = async (url, options) => {
    if (url.endsWith('/queue/join')) {
      joined++;
      sent.push(JSON.parse(options.body).data);
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
    // Mateixos paràmetres que l'acció: accent, veu, temperatura 0,2 i escala de durada 1,1.
    assert.deepEqual(sent[1], ['Bon dia', 'central', 'grau', .2, 1.1]);
  } finally { global.fetch = oldFetch; global.window = oldWindow; }
});
