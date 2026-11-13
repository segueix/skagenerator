(() => {
  'use strict';
  const script = document.currentScript.src;
  const workerUrl = new URL('umidaji-worker.js', script);
  const SPEAKERS = {
    rocksteady: 'rainbow', jamaican: 'rainbow', bossreggae: 'cloud', twotone: 'moon',
    nutty: 'sun', skaswing: 'sun', skapunk: 'moon', punk77: 'moon', oi: 'snow',
    skatepunk: 'moon', garage: 'snow', postpunk: 'cloud', hardcore: 'snow', poppunk: 'sun', horrorpunk: 'cloud'
  };
  const cancelled = () => new DOMException('Generació cancel·lada', 'AbortError');

  async function storedZip(mode, file) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('radiospam-voices', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('banks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('El banc de veu està obert en una altra pestanya.'));
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('banks', mode), store = tx.objectStore('banks');
        const request = file ? store.put(file, 'umidaji-v110') : store.get('umidaji-v110');
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  function createSinger({ audioUtils }) {
    let worker = null, file = null, ready = null, sequence = 0, retryAt = 0;
    const pending = new Map();

    function dispose(error = cancelled()) {
      worker?.terminate();
      worker = null;
      ready = null;
      for (const job of pending.values()) job.reject(error);
      pending.clear();
    }
    function call(message, onProgress) {
      return new Promise((resolve, reject) => {
        if (!worker) {
          worker = new Worker(workerUrl);
          worker.onmessage = ({ data }) => {
            const job = pending.get(data.id);
            if (!job) return;
            if (Number.isFinite(data.progress)) {
              job.onProgress?.(data.progress);
              return;
            }
            pending.delete(data.id);
            if (data.error) job.reject(new Error(data.error));
            else job.resolve(data.pcm);
          };
          worker.onerror = event => dispose(new Error(event.message || 'El motor d’Umidaji ha fallat.'));
          worker.onmessageerror = () => dispose(new Error('No s’ha pogut rebre la veu d’Umidaji.'));
        }
        const id = ++sequence;
        pending.set(id, { resolve, reject, onProgress });
        try { worker.postMessage({ ...message, id }); }
        catch (error) { pending.delete(id); reject(error); }
      });
    }
    function load(zip) {
      if (!ready) {
        ready = call({ type: 'load', file: zip }).catch(error => {
          ready = null;
          throw error;
        });
      }
      return ready;
    }
    return {
      get available() { return !!file && Date.now() >= retryAt; },
      async restore() {
        const saved = await storedZip('readonly');
        if (saved && !file) file = saved;
        return !!file;
      },
      async install(zip) {
        dispose();
        try { await load(zip); }
        catch (error) { dispose(); throw error; }
        file = zip;
        retryAt = 0;
        try { await storedZip('readwrite', zip); return true; }
        catch { return false; }
      },
      start({ notes, subgenre, signal, onProgress }) {
        const speaker = SPEAKERS[subgenre] || 'rainbow';
        const abort = () => dispose();
        const result = (async () => {
          if (signal?.aborted) throw cancelled();
          signal?.addEventListener('abort', abort, { once: true });
          try {
            await load(file);
            if (signal?.aborted) throw cancelled();
            return await call({ type: 'sing', notes, speaker }, onProgress);
          } catch (error) {
            if (!signal?.aborted) {
              retryAt = Date.now() + 60_000;
              dispose();
            }
            throw error;
          } finally {
            signal?.removeEventListener('abort', abort);
          }
        })();
        result.catch(() => {});
        return { result, timbre: { name: 'Umidaji ' + speaker.charAt(0).toUpperCase() + speaker.slice(1) + ' · Team BRAPA' } };
      },
      async finish(job, band) {
        const vocal = audioUtils.processVoice(await job.result);
        audioUtils.levelTake(vocal, -16);
        return audioUtils.mixVoice(band, vocal, { processed: true });
      },
      dispose
    };
  }

  window.SkaUmidaji = { createSinger };
})();
