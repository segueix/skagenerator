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

test('un banc absent informa de l’error i permet recuperar les mostres en el següent intent', async () => {
  let available = false, fetches = 0, fallbackCalls = 0;
  class Worker {
    terminate() {}
    postMessage(data) {
      queueMicrotask(() => this.onmessage({ data: { id: data.id,
        type: data.type === 'init' ? 'ready' : 'rendered',
        channels: [Float32Array.from([0, .4, 0]), Float32Array.from([0, .3, 0])] } }));
    }
  }
  const client = loadClient({ Worker,
    async fetch() { fetches++; return { ok: available, headers: { get() { return null; } },
      arrayBuffer: async () => new ArrayBuffer(8) }; },
    async songPartSamples() { fallbackCalls++; }
  });
  await assert.rejects(client.render({ type: 'intro' }), /carregar els instruments/);
  available = true;
  const audio = await client.render({ type: 'verse' });
  assert(audio[0][1] > .3);
  assert.equal(fetches, 3); assert.equal(fallbackCalls, 0);
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

test('un worker que falla durant el render es reinicia amb les mateixes mostres', async () => {
  let workers = 0;
  class Worker {
    constructor() { this.number = ++workers; }
    terminate() {}
    postMessage(data) {
      queueMicrotask(() => {
        if (data.type === 'render' && this.number === 1) { this.onerror(); return; }
        this.onmessage({ data: { id: data.id, type: data.type === 'init' ? 'ready' : 'rendered',
          channels: [Float32Array.from([0, .5, 0]), Float32Array.from([0, .4, 0])] } });
      });
    }
  }
  const client = loadClient({ Worker,
    async fetch() { return { ok: true, headers: { get() { return null; } }, arrayBuffer: async () => new ArrayBuffer(8) }; },
    async songPartSamples() { throw new Error('No s’ha de substituir el so'); }
  });
  assert.equal((await client.render({ type: 'intro' }))[0][1], .5);
  assert.equal(workers, 2);
  client.dispose();
});

test('si el navegador no admet workers, es comunica l’error sense substituir el so', async () => {
  const client = loadClient({
    Worker: class { constructor() { throw new Error('Worker unavailable'); } },
    async fetch() { return { ok: true, headers: { get() { return null; } }, arrayBuffer: async () => new ArrayBuffer(8) }; },
    async songPartSamples() { throw new Error('No s’ha de substituir el so'); }
  });
  await assert.rejects(client.render({ type: 'intro' }), /Worker unavailable/);
  await assert.rejects(client.render({ type: 'verse' }), /Worker unavailable/);
});
