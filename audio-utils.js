(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaAudioUtils = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function check(channels) {
    if (!Array.isArray(channels) || channels.length !== 2 || !channels.every(c => c instanceof Float32Array)
      || channels[0].length !== channels[1].length) throw new Error('S’esperen dos canals d’àudio de la mateixa durada');
  }
  function joinStereo(parts) {
    parts.forEach(check);
    const length = parts.reduce((sum, part) => sum + part[0].length, 0);
    const result = [new Float32Array(length), new Float32Array(length)]; let offset = 0;
    for (const part of parts) { result[0].set(part[0], offset); result[1].set(part[1], offset); offset += part[0].length; }
    return result;
  }
  function encodeWav(channels, sampleRate = 44100) {
    check(channels);
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error('Freqüència de mostreig no vàlida');
    const frames = channels[0].length, length = frames * 4;
    const wav = new ArrayBuffer(44 + length), view = new DataView(wav);
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF'); view.setUint32(4, 36 + length, true); ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
    view.setUint16(32, 4, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, length, true);
    for (let i = 0; i < frames; i++) for (let ch = 0; ch < 2; ch++) {
      const value = channels[ch][i]; if (!Number.isFinite(value)) throw new Error('Mostra d’àudio no vàlida');
      const n = Math.max(-1, Math.min(1, value)); view.setInt16(44 + i * 4 + ch * 2, n * (n < 0 ? 32768 : 32767), true);
    }
    return wav;
  }
  return { joinStereo, encodeWav };
});
