(() => {
  'use strict';
  const script = document.currentScript.src;
  const workerUrl = new URL('umidaji-worker.js', script);
  // Veu de cada subgènere: barreja dels cinc timbres d'Umidaji, caràcter (gender: negatiu, més fosc i
  // menys femení; mesurat al navegador), articulació (velocity: més d'1, consonants més seques), registre (center: nota MIDI
  // al voltant de la qual canta) i el filtre de la mescla (efecte i equalitzador d'audio-utils.js).
  const V = (name, mix, gender = 0, velocity = 1, center = 64, effect = 'clean', eq = {}) => ({ name, mix, gender, velocity, center, effect, eq });
  const VOICES = {
    jamaican: V('càlida', { rainbow: .7, sun: .3 }, 0, 1, 64, 'warm', { low: 1 }),
    rocksteady: V('vellutada', { rainbow: .6, cloud: .4 }, -.05, .9, 64, 'warm', { high: -1 }),
    bossreggae: V('de vinil', { cloud: .7, rainbow: .3 }, -.1, .95, 64, 'warm', { low: 1, high: -2 }),
    twotone: V('nasal', { moon: .7, sun: .3 }, -.05, 1.1, 64, 'clean', { mid: 2 }),
    nutty: V('teatral', { sun: .8, moon: .2 }, 0, 1.15, 64, 'clean', { mid: 2, high: 1 }),
    skaswing: V('brillant', { sun: .6, rainbow: .4 }, .05, 1.05, 64, 'clean', { high: 2 }),
    skapunk: V('estrident', { moon: .6, snow: .4 }, -.15, 1.2, 64, 'clean', { mid: 3, high: 1 }),
    punk77: V('crua', { moon: .5, snow: .5 }, -.25, 1.25, 62, 'clean', { mid: 3 }),
    oi: V('aspra', { snow: .8, moon: .2 }, -.35, 1.2, 60, 'warm', { low: 2, mid: 2 }),
    skatepunk: V('tensa', { moon: .7, sun: .3 }, -.1, 1.3, 64, 'clean', { mid: 2, high: 2 }),
    garage: V('lo-fi', { snow: .6, cloud: .4 }, -.2, 1.15, 62, 'lofi', { mid: 1 }),
    postpunk: V('fosca', { cloud: .8, snow: .2 }, -.3, .9, 60, 'warm', { low: 2, high: -3 }),
    hardcore: V('agressiva', { snow: 1 }, -.4, 1.35, 60, 'clean', { mid: 4, high: 1 }),
    poppunk: V('lluminosa', { sun: .7, rainbow: .3 }, .1, 1.15, 64, 'clean', { high: 3 }),
    horrorpunk: V('espectral', { cloud: .6, snow: .4 }, -.3, 1, 60, 'warm', { low: 3, high: -2 })
  };
  const voiceFor = subgenre => VOICES[subgenre] || VOICES.jamaican;
  const cancelled = () => new DOMException('Generació cancel·lada', 'AbortError');

  // Base de dades del dispositiu: el banc de veu («banks») i les veus ja cantades («takes»), per poder
  // tornar a posar una cançó cantada sense haver-la de cantar un altre cop.
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('radiospam-voices', 2);
      request.onupgradeneeded = () => { for (const name of ['banks', 'takes']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('El banc de veu està obert en una altra pestanya.'));
    });
  }
  async function withStore(name, mode, action) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(name, mode), request = action(tx.objectStore(name));
        tx.oncomplete = () => resolve(request?.result);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  const storedZip = (mode, file) => withStore('banks', mode, store => file ? store.put(file, 'umidaji-v110') : store.get('umidaji-v110'));
  // Les veus es desen a la meitat de mostres i en 16 bits (uns 8 MB per cançó de tres minuts).
  const TAKE_RATE = 22050;
  const takes = {
    list: () => withStore('takes', 'readonly', store => store.getAllKeys()).then(keys => keys.map(String)),
    async save(id, pcm) {
      const half = new Int16Array(pcm.length >> 1);
      // Mitjana de tres mostres (1-2-1) abans de quedar-se'n una de cada dues: evita l'aliàsing més fort.
      for (let i = 0; i < half.length; i++) {
        const k = 2 * i, v = .25 * (pcm[k - 1] || 0) + .5 * pcm[k] + .25 * (pcm[k + 1] || 0);
        half[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
      }
      await withStore('takes', 'readwrite', store => store.put({ rate: TAKE_RATE, pcm: half.buffer }, id));
    },
    async load(id) {
      const saved = await withStore('takes', 'readonly', store => store.get(id));
      if (!saved?.pcm) return null;
      const half = new Int16Array(saved.pcm), out = new Float32Array(half.length * 2);
      for (let i = 0; i < half.length; i++) { const a = half[i] / 32767, b = (half[i + 1] ?? half[i]) / 32767; out[2 * i] = a; out[2 * i + 1] = (a + b) / 2; }
      return out;
    },
    remove: id => withStore('takes', 'readwrite', store => store.delete(id))
  };

  function createSinger({ audioUtils }) {
    let worker = null, file = null, ready = null, sequence = 0, retryAt = 0, loadListener = null;
    const LOAD_SILENCE = 180000, SING_SILENCE = 240000;
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
            job.seen = Date.now();
            if (Number.isFinite(data.progress)) {
              job.onProgress?.(data.progress, data.phase);
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
        pending.set(id, { resolve, reject, onProgress, seen: Date.now(), quiet: message.type === 'load' ? LOAD_SILENCE : SING_SILENCE });
        watch();
        try { worker.postMessage({ ...message, id }); }
        catch (error) { pending.delete(id); reject(error); }
      });
    }
    // Si el navegador tanca el worker per manca de memòria, sovint no avisa: si una feina passa massa
    // estona sense donar senyals, es dona per fallada.
    let watcher = null;
    function watch() {
      if (watcher) return;
      watcher = setInterval(() => {
        if (!pending.size) { clearInterval(watcher); watcher = null; return; }
        for (const job of pending.values()) if (Date.now() - job.seen > job.quiet) {
          dispose(new Error('El dispositiu no respon: segurament no té prou memòria per a Umidaji (calen uns 700 MB lliures).'));
          return;
        }
      }, 5000);
    }
    function load(zip, onProgress) {
      if (!ready) {
        ready = call({ type: 'load', file: zip }, (value, phase) => { loadListener?.(value, phase); onProgress?.(value, phase); }).catch(error => {
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
      // onProgress(valor 0–1, fase): «read», «models» i «store» (desant-lo al dispositiu).
      async install(zip, onProgress) {
        dispose();
        if (!/\.zip$/i.test(zip.name || '') || zip.size < 100e6) throw new Error('Aquest fitxer no és el ZIP d’Umidaji (Umidaji_DS_v110.zip, 273 MiB).');
        try { await load(zip, onProgress); }
        catch (error) { dispose(); throw error; }
        file = zip;
        retryAt = 0;
        onProgress?.(0, 'store');
        try { await storedZip('readwrite', zip); onProgress?.(1, 'store'); return true; }
        catch { return false; }
      },
      // Avís de progrés quan els models es carreguen sols (en arrencar la ràdio amb el ZIP desat).
      onLoad(listener) { loadListener = listener; },
      start({ notes, subgenre, signal, onProgress }) {
        const voice = voiceFor(subgenre);
        const abort = () => dispose();
        const result = (async () => {
          if (signal?.aborted) throw cancelled();
          signal?.addEventListener('abort', abort, { once: true });
          try {
            await load(file);
            if (signal?.aborted) throw cancelled();
            return await call({ type: 'sing', notes, voice: { mix: voice.mix, gender: voice.gender, velocity: voice.velocity, center: voice.center } }, onProgress);
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
        return { result, subgenre, timbre: { name: 'Umidaji ' + voice.name + ' · Team BRAPA' } };
      },
      // Mescla una veu (acabada de cantar o desada) amb la banda, amb el filtre del subgènere.
      mix(pcm, band, subgenre) {
        const voice = voiceFor(subgenre), vocal = audioUtils.processVoice(pcm, { effect: voice.effect, eq: voice.eq });
        audioUtils.levelTake(vocal, -16);
        return audioUtils.mixVoice(band, vocal, { processed: true });
      },
      timbreName: subgenre => 'Umidaji ' + voiceFor(subgenre).name + ' · Team BRAPA',
      takes,
      dispose
    };
  }

  window.SkaUmidaji = { createSinger, VOICES };
})();
