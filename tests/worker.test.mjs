import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';
import engine from '../radioambient.js';

test('el worker compilat genera totes les parts i les cinc alternatives amb les mostres', async () => {
  const { outputFiles } = await build({ entryPoints: ['audio/worker.mjs'], bundle: true,
    write: false, format: 'iife', platform: 'browser', target: 'es2022', minify: true });
  let result;
  const self = { postMessage(message) { if (message.type !== 'progress') result = message; } };
  const context = vm.createContext({ self, console, setTimeout, clearTimeout, TextDecoder,
    TextEncoder, WebAssembly, performance });
  vm.runInContext(outputFiles[0].text, context);
  const raw = await readFile('dist/assets/generaluser-ska-punk.sf2');
  await self.onmessage({ data: { id: 1, type: 'init', buffer: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) } });
  assert.equal(result.type, 'ready', result.message);
  for (const style of ['ska', 'punk']) for (const type of Object.keys(engine.SONG_PARTS)) {
    const settings = { seed: 71931, style, bpm: engine.SONG_STYLES[style].bpm.default,
      tonic: 0, mode: 'major', instruments: Object.keys(engine.SONG_INSTRUMENTS) };
    const variants = ['intro', 'verse', 'chorus'].includes(type) ? 5 : 1;
    for (let i = 0; i < variants; i++) {
      const part = { type, bars: 4, energy: 70, revision: i + 1 };
      if (variants === 5) part.variantIndex = i;
      const spec = engine.composeSongPart(settings, part);
      await self.onmessage({ data: { id: 2, type: 'render', spec, sampleRate: 44100 } });
      assert.equal(result.type, 'rendered', `${style}/${type}/${i}: ${result.message}`);
      assert.equal(result.channels.length, 2);
      for (const channel of result.channels) {
        assert.equal(channel.length, Math.round(spec.seconds * 44100));
        assert(channel.every(Number.isFinite));
        assert(channel.some(n => Math.abs(n) > .01));
      }
    }
  }
});
