import { parseSoundBank, renderSampledPart } from './render.mjs';
let bank, extra;
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'init') {
      bank = parseSoundBank(data.buffer);
      self.postMessage({ id, type: 'ready' });
    } else if (type === 'extra') {
      // Banc addicional (bateries i baixos), només quan una cançó el necessita.
      extra = parseSoundBank(data.buffer);
      self.postMessage({ id, type: 'ready' });
    } else if (type === 'render') {
      if (!bank) throw new Error('El banc d’instruments encara no està carregat');
      const channels = await renderSampledPart(bank, data.spec, data.sampleRate, {
        extra,
        onProgress: value => self.postMessage({ id, type: 'progress', value })
      });
      self.postMessage({ id, type: 'rendered', channels }, channels.map(channel => channel.buffer));
    }
  } catch (error) { self.postMessage({ id, type: 'error', message: error.message || String(error) }); }
};
