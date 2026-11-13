'use strict';
// Cant de Matxa en segon pla: WORLD (WebAssembly) i el procés de l'acció (matxa-singer.js).
importScripts('world.js', 'matxa-singer.js');
const WASM = 'vendor/world/world.wasm';
let world = null;
const loadWorld = () => world ||= self.SkaWorld.load(new URL(WASM, self.location.href).href);
// Locucions analitzades de cada cançó (es lliuren en acabar-la).
const songs = new Map();
self.onmessage = async ({ data }) => {
  const reply = (message, transfer = []) => self.postMessage({ id: data.id, ...message }, transfer);
  try {
    if (data.type === 'forget') { songs.delete(data.song); reply({}); return; }
    const w = await loadWorld(), M = self.SkaMatxaSinger;
    if (data.type === 'analyse') {
      if (!songs.has(data.song)) songs.set(data.song, new Map());
      songs.get(data.song).set(data.key, M.analyse(w, data.speech, data.rate, data.count));
      reply({});
      return;
    }
    if (data.type === 'sing') {
      const units = songs.get(data.song);
      try {
        if (!units) throw new Error('Falta la parla de Matxa');
        const notes = data.notes.slice().sort((a, b) => a.t - b.t), shift = M.shiftFor(notes, data.speaker);
        const vocal = new Float32Array(data.band[0].length + 2 * 44100);
        for (const phrase of M.phrasesOf(notes)) {
          const unit = units.get(M.lineText(phrase) + '|' + phrase.length);
          if (!unit) throw new Error('Falta la parla d’un vers');
          const { start, wave } = M.singLine(w, phrase, shift, unit);
          M.lay(vocal, start, wave);
        }
        const mix = M.mixSong(data.band, vocal, data.subgenre);
        reply({ mix }, mix.map(c => c.buffer));
      } catch (error) {
        reply({ error: error.message || String(error), band: data.band }, data.band.map(c => c.buffer));
      } finally { songs.delete(data.song); }
    }
  } catch (error) {
    reply({ error: error.message || String(error) });
  }
};
