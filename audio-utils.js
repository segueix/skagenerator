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
  // Uneix seccions que porten cua: cada una comença on acaba la durada
  // nominal de l'anterior i les cues se sumen a la secció següent.
  function mixSections(parts, lengths) {
    parts.forEach(check);
    if (!Array.isArray(lengths) || lengths.length !== parts.length
      || lengths.some((n, i) => !Number.isInteger(n) || n < 1 || n > parts[i][0].length)) throw new Error('Durades de secció no vàlides');
    let offset = 0, total = 0;
    parts.forEach((part, i) => { total = Math.max(total, offset + part[0].length); offset += lengths[i]; });
    const result = [new Float32Array(total), new Float32Array(total)]; offset = 0;
    parts.forEach((part, i) => {
      for (let ch = 0; ch < 2; ch++) { const out = result[ch], data = part[ch]; for (let k = 0; k < data.length; k++) out[offset + k] += data[k]; }
      offset += lengths[i];
    });
    // Limitador suau: només actua quan una cua i una entrada forta coincideixen.
    for (const out of result) for (let k = 0; k < out.length; k++) {
      const a = Math.abs(out[k]);
      if (a > .94) out[k] = Math.sign(out[k]) * (.94 + .06 * Math.tanh((a - .94) / .06));
    }
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
  return { joinStereo, mixSections, encodeWav };
});
