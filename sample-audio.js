(() => {
  'use strict';
  const base = document.currentScript.src;
  const bankURL = new URL('assets/generaluser-ska-punk.sf2?v=2.0.3-urban', base).href;
  const workerURL = new URL('sample-worker.js?v=20261110-samples', base).href;
  let worker, ready, serial = 0;
  const requests = new Map();
  function destroy(error) {
    worker?.terminate(); worker = null; ready = null;
    for (const request of requests.values()) { clearTimeout(request.timer); request.reject(error); }
    requests.clear();
  }
  function send(type, data, progress, transfer = []) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => destroy(new Error('El motor d’àudio ha trigat massa. Torna-ho a provar.')), 120000);
      requests.set(id, { resolve, reject, progress, timer });
      try { worker.postMessage({ id, type, ...data }, transfer); }
      catch (error) { clearTimeout(timer); requests.delete(id); reject(error); }
    });
  }
  async function load(progress) {
    if (ready) return ready;
    ready = (async () => {
      progress?.({ stage: 'loading', value: 0 });
      // El banc fa uns 30 MB: el temps d'espera només salta si la descàrrega
      // s'atura, no pel temps total (al mòbil pot passar d'un minut).
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let idle;
      const watchdog = () => { clearTimeout(idle); idle = setTimeout(() => controller?.abort(), 45000); };
      const get = cache => { watchdog(); return fetch(bankURL, { cache, signal: controller?.signal }); };
      let buffer;
      try {
        // Si el navegador havia desat un error (p. ex. durant una publicació),
        // es torna a demanar el fitxer sense fer servir la memòria cau.
        let response = await get('force-cache');
        if (!response.ok) response = await get('reload');
        if (!response.ok) throw new Error(response.status === 404
          ? 'La web publicada no té el banc d’instruments (error 404). Si s’acaba de publicar, espera un parell de minuts i torna-ho a provar.'
          : `No s’han pogut carregar els instruments (error ${response.status}). Torna-ho a provar.`);
        const bytes = Number(response.headers.get('content-length'));
        if (response.body?.getReader) {
          const reader = response.body.getReader(), chunks = []; let total = 0;
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            watchdog(); chunks.push(value); total += value.length;
            progress?.({ stage: 'loading', value: bytes ? Math.min(.99, total / bytes) : null });
          }
          const joined = new Uint8Array(total); let offset = 0;
          for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
          buffer = joined.buffer;
        } else buffer = await response.arrayBuffer();
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('La descàrrega dels instruments s’ha aturat. Comprova la connexió i torna-ho a provar.');
        if (error instanceof TypeError) throw new Error('No s’han pogut carregar els instruments. Comprova la connexió i torna-ho a provar.');
        throw error;
      } finally { clearTimeout(idle); }
      worker = new Worker(workerURL);
      worker.onmessage = ({ data }) => {
        const request = requests.get(data.id); if (!request) return;
        if (data.type === 'progress') { request.progress?.({ stage: 'rendering', value: data.value }); return; }
        clearTimeout(request.timer); requests.delete(data.id);
        if (data.type === 'error') request.reject(new Error(data.message)); else request.resolve(data.channels);
      };
      worker.onerror = () => destroy(new Error('No s’ha pogut iniciar el motor d’instruments.'));
      await send('init', { buffer }, progress, [buffer]);
      progress?.({ stage: 'ready', value: 1 });
    })().catch(error => { destroy(error); throw error; });
    return ready;
  }
  window.SkaSampleAudio = {
    async render(spec, sampleRate = 44100, options = {}) {
      // Una incidència temporal no ha de substituir els instruments enregistrats.
      // Reintentem amb un worker nou; si falla, la part continua pendent.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await load(options.onProgress);
          return await send('render', { spec, sampleRate }, options.onProgress);
        } catch (error) {
          destroy(error);
          if (attempt === 1) throw error;
        }
      }
    },
    dispose() { destroy(new Error('Motor d’àudio tancat')); }
  };
  window.addEventListener('pagehide', () => window.SkaSampleAudio.dispose());
})();
