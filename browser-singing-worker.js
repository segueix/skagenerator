'use strict';
importScripts('audio-utils.js', 'browser-singing.js');
// L'octava triada per a cada cançó: totes les seves seccions canten a la mateixa.
const songs = new Map();
self.onmessage = ({ data }) => {
  if (data.type !== 'sing') return;
  try {
    let state = {};
    if (data.song != null) {
      if (!songs.has(data.song)) { songs.set(data.song, state); if (songs.size > 8) songs.delete(songs.keys().next().value); }
      state = songs.get(data.song);
    }
    const voice = self.SkaBrowserSinging.renderPCM(data.pcm, data.lines, data.frames, data.rate, { speechRate: data.speechRate || data.rate, state });
    const processed = self.SkaAudioUtils.processVoice(voice, { effect: data.preset.effect, eq: data.preset.eq, rate: data.rate });
    // La veu principal és més alta que la guia MIDI i se'n protegeix la dinàmica.
    const gain = Math.pow(10, (data.preset.gainDb || 0) / 20);
    let sum = 0, active = 0, peak = 0;
    for (let i = 0; i < processed.length; i += 8) {
      if (Math.abs(processed[i]) > .004) { sum += processed[i] * processed[i]; active++; }
      peak = Math.max(peak, Math.abs(processed[i]));
    }
    const rms = active ? Math.sqrt(sum / active) : 0;
    const scale = rms ? Math.min(4, .18 / rms, .85 / Math.max(.0001, peak)) * gain : 0;
    for (let i = 0; i < processed.length; i++) processed[i] *= scale;
    self.postMessage({ id: data.id, voice: processed }, [processed.buffer]);
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
};
