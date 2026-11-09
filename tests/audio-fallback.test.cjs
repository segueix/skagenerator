'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const script = readFileSync(require('node:path').join(__dirname, '..', 'sample-audio.js'), 'utf8');

function loadClient({ Worker, fetch, songPartSamples }) {
  const window = {
    ElTaulerRadioAmbient: { songPartSamples },
    addEventListener() {}
  };
  const context = {
    window,
    document: { currentScript: { src: 'https://example.test/skagenerator/sample-audio.js' } },
    Worker, fetch, URL, Float32Array, Uint8Array, setTimeout, clearTimeout,
    AbortSignal, console: { warn() {} }
  };
  vm.runInNewContext(script, context);
  return window.SkaSampleAudio;
}

test('si falta el banc de mostres, la generació funciona amb el sintetitzador local', async () => {
  let workers = 0, fetches = 0, renders = 0;
  class BrokenWorker {
    constructor() { workers++; }
    terminate() {}
    postMessage() { throw new Error('No hauria d’inicialitzar-se'); }
  }
  const client = loadClient({
    Worker: BrokenWorker,
    async fetch() { fetches++; return { ok: false, status: 404 }; },
    async songPartSamples(spec, sampleRate) {
      renders++;
      assert.equal(sampleRate, 44100);
      return Float32Array.from([0, 0.4, -0.3, 0]);
    }
  });
  const stages = [];
  const first = await client.render({ type: 'intro' }, 44100, { onProgress: p => stages.push(p.stage) });
  const second = await client.render({ type: 'verse' }, 44100);
  assert.equal(first.length, 2);
  assert.deepEqual(Array.from(first[0]), Array.from(first[1]));
  assert.notStrictEqual(first[0], first[1]);
  assert.equal(first[0].length, 4);
  assert.equal(second.length, 2);
  assert.deepEqual(stages, ['loading', 'fallback', 'fallback']);
  assert.equal(workers, 1); assert.equal(fetches, 1); assert.equal(renders, 2);
  client.dispose();
});

test('si el banc i el worker funcionen, es manté el so enregistrat', async () => {
  let fallbackCalls = 0, workers = 0;
  class WorkingWorker {
    constructor() { workers++; }
    postMessage(data) {
      queueMicrotask(() => {
        const channels = data.type === 'render'
          ? [Float32Array.from([0, .2, 0]), Float32Array.from([0, -.2, 0])] : undefined;
        this.onmessage({ data: { id: data.id, type: data.type === 'init' ? 'ready' : 'rendered', channels } });
      });
    }
    terminate() {}
  }
  const client = loadClient({
    Worker: WorkingWorker,
    async fetch() {
      return { ok: true, headers: { get() { return null; } }, body: null, arrayBuffer: async () => new ArrayBuffer(8) };
    },
    async songPartSamples() { fallbackCalls++; throw new Error('No hauria de passar al motor alternatiu'); }
  });
  const stereo = await client.render({ type: 'chorus' }, 44100);
  assert.equal(workers, 1); assert.equal(fallbackCalls, 0);
  assert.deepEqual(Array.from(stereo[0]), Array.from(Float32Array.from([0, .2, 0])));
  assert.deepEqual(Array.from(stereo[1]), Array.from(Float32Array.from([0, -.2, 0])));
  client.dispose();
});

test('si el navegador no admet workers, la generació també és recuperable', async () => {
  const client = loadClient({
    Worker: class { constructor() { throw new Error('Worker unavailable'); } },
    async fetch() { throw new Error('No s’hauria de consultar el banc'); },
    async songPartSamples() { return Float32Array.from([0, .5, 0]); }
  });
  const audio = await client.render({ type: 'intro' });
  assert.equal(audio.length, 2);
  assert.equal(audio[0][1], .5);
});
