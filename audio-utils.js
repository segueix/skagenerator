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
      if (a > .93) out[k] = Math.sign(out[k]) * (.93 + .055 * Math.tanh((a - .93) / .055));
    }
    return result;
  }
  // Fos d'entrada o de sortida d'un tram (secció amb la seva cua). Retorna una
  // còpia: les dades originals poden ser a la memòria cau. «in» puja de silenci
  // al volum ple al llarg de la durada nominal; «out» baixa fins a silenci al
  // final de la durada nominal i la cua queda muda.
  function applyFade(part, nominal, kind) {
    check(part);
    if (!['in', 'out'].includes(kind)) throw new Error('Fos no vàlid');
    if (!Number.isInteger(nominal) || nominal < 1 || nominal > part[0].length) throw new Error('Durada de fos no vàlida');
    const out = [new Float32Array(part[0]), new Float32Array(part[1])];
    for (let k = 0; k < out[0].length; k++) {
      const x = Math.min(1, k / nominal);
      // Corba de potència constant: el fos sona lineal a l'orella.
      const gain = kind === 'in' ? Math.sin(x * Math.PI / 2) ** 2 : k >= nominal ? 0 : Math.cos(x * Math.PI / 2) ** 2;
      out[0][k] *= gain; out[1][k] *= gain;
    }
    return out;
  }
  // ── Filtres de la veu enregistrada ──────────────────────────────────
  // Els presets combinen bandes de freqüència, saturació i, quan escau,
  // modulació. El so es calcula a partir de la presa original, sense alterar-la.
  const VOICE_EFFECTS = Object.freeze({
    clean: 'Natural', megaphone: 'Megàfon', telephone: 'Telèfon',
    radio: 'Ràdio antiga', walkie: 'Walkie-talkie',
    robot: 'Robòtica', lofi: 'Lo-fi', warm: 'Càlida'
  });
  const VOICE_EQ_KEYS = ['low', 'mid', 'high'];
  function voiceBiquad(type, hz, gainDb, rate, q = .7071067811865476) {
    const w = 2 * Math.PI * Math.min(rate * .44, hz) / rate, c = Math.cos(w), s = Math.sin(w);
    const alpha = s / (2 * q), A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'highpass') {
      b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else if (type === 'lowpass') {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else if (type === 'peak') {
      b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A;
    } else {
      const sign = type === 'lowshelf' ? 1 : -1, root = 2 * Math.sqrt(A) * s / Math.SQRT2;
      b0 = A * ((A + 1) - sign * (A - 1) * c + root);
      b1 = 2 * sign * A * ((A - 1) - sign * (A + 1) * c);
      b2 = A * ((A + 1) - sign * (A - 1) * c - root);
      a0 = (A + 1) + sign * (A - 1) * c + root;
      a1 = -2 * sign * ((A - 1) + sign * (A + 1) * c);
      a2 = (A + 1) + sign * (A - 1) * c - root;
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
      a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  }
  function voiceTick(f, x) {
    const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
    f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
    return y;
  }
  function processVoice(voice, options = {}) {
    if (!(voice instanceof Float32Array)) throw new Error('Mostres de veu no vàlides');
    const { effect = 'clean', eq = {}, rate = 44100 } = options;
    if (!Object.hasOwn(VOICE_EFFECTS, effect)) throw new Error('Filtre de veu no vàlid');
    if (!Number.isFinite(rate) || rate < 8000 || rate > 96000) throw new Error('Freqüència de veu no vàlida');
    if (!eq || typeof eq !== 'object' || Array.isArray(eq) ||
      Object.keys(eq).some(key => !VOICE_EQ_KEYS.includes(key)) ||
      VOICE_EQ_KEYS.some(key => !Number.isFinite(eq[key] ?? 0) || Math.abs(eq[key] ?? 0) > 12))
      throw new Error('Equalitzador de veu no vàlid');
    const preset = {
      clean: { highpass: 80 },
      megaphone: { highpass: 480, lowpass: 3200, peak: [1700, 8], drive: 3.3 },
      telephone: { highpass: 330, lowpass: 3000, peak: [1300, 2] },
      radio: { highpass: 260, lowpass: 4100, peak: [1600, 4], drive: 2.1 },
      walkie: { highpass: 420, lowpass: 2900, peak: [1900, 5], drive: 2.6 },
      robot: { highpass: 160, lowpass: 4300, peak: [1100, 3], robot: true },
      lofi: { highpass: 190, lowpass: 3700, drive: 2, hold: 4 },
      warm: { highpass: 70, lowpass: 7500, low: 3, high: -2 }
    }[effect];
    const chain = [voiceBiquad('highpass', preset.highpass, 0, rate)];
    if (preset.lowpass) chain.push(voiceBiquad('lowpass', preset.lowpass, 0, rate));
    if (preset.peak) chain.push(voiceBiquad('peak', preset.peak[0], preset.peak[1], rate, 1));
    if (preset.low) chain.push(voiceBiquad('lowshelf', 240, preset.low, rate));
    if (preset.high) chain.push(voiceBiquad('highshelf', 3500, preset.high, rate));
    for (const [key, type, hz] of [['low', 'lowshelf', 180], ['mid', 'peak', 1200], ['high', 'highshelf', 4500]])
      if (eq[key]) chain.push(voiceBiquad(type, hz, eq[key], rate, key === 'mid' ? 1 : .707));
    const result = new Float32Array(voice.length);
    let held = 0;
    for (let i = 0; i < voice.length; i++) {
      // La saturació és abans del pas baix per evitar aguts artificials.
      let x = voice[i];
      if (preset.drive) x = Math.tanh(x * preset.drive) / Math.sqrt(preset.drive);
      if (preset.hold) {
        if (i % preset.hold === 0) held = Math.round(x * 2048) / 2048;
        x = held;
      }
      for (const f of chain) x = voiceTick(f, x);
      if (preset.robot) x *= .3 + .7 * Math.sin(2 * Math.PI * 52 * i / rate);
      result[i] = Math.max(-1, Math.min(1, x));
    }
    return result;
  }
  // ── Veu gravada (mono, a la mateixa freqüència que la cançó) ──────────
  // Suma la veu, centrada i amb un filtre passaaltes de 80 Hz, a un tros de
  // la cançó que comença a la mostra «from». «offset» desplaça la veu
  // (positiu: més tard) per afinar la sincronia.
  function mixVoice(mix, voice, options = {}) {
    check(mix);
    const { from = 0, gainDb = 0, offset = 0, rate = 44100, processed = false } = options;
    const out = [mix[0].slice(), mix[1].slice()];
    if (!(voice instanceof Float32Array) || !voice.length) return out;
    const vocal = processed ? voice : processVoice(voice, options);
    const gain = 10 ** (gainDb / 20) * Math.SQRT1_2;
    for (let i = 0; i < out[0].length; i++) {
      const at = from + i - offset, y = at >= 0 && at < vocal.length ? vocal[at] : 0;
      for (const channel of out) {
        let v = channel[i] + y * gain;
        const level = Math.abs(v);
        if (level > .93) v = Math.sign(v) * (.93 + .055 * Math.tanh((level - .93) / .055));
        channel[i] = v;
      }
    }
    return out;
  }
  // Regravació d'un tros: la presa substitueix la veu des de «from» fins on
  // acaba; el que hi ha abans i després es conserva.
  function placeTake(voice, take, at, from = at) {
    const end = at + take.length, length = Math.max(voice ? voice.length : 0, end), out = new Float32Array(length);
    if (voice) out.set(voice);
    for (let i = Math.max(0, from, at); i < end; i++) out[i] = take[i - at];
    return out;
  }
  // Anivella una presa perquè soni amb un volum semblant a la música.
  function levelTake(take, targetDb = -18) {
    let sum = 0, count = 0, peak = 0;
    for (const x of take) { const a = Math.abs(x); peak = Math.max(peak, a); if (a > .002) { sum += x * x; count++; } }
    if (!count || !peak) return take;
    const gain = Math.min(10 ** (targetDb / 20) / Math.sqrt(sum / count), .9 / peak, 16);
    for (let i = 0; i < take.length; i++) take[i] *= gain;
    return take;
  }
  function resampleLinear(data, from, to) {
    if (from === to) return data;
    const ratio = from / to, out = new Float32Array(Math.round(data.length * to / from));
    for (let i = 0; i < out.length; i++) {
      const x = i * ratio, k = Math.floor(x), f = x - k;
      out[i] = (data[k] || 0) * (1 - f) + (data[k + 1] || 0) * f;
    }
    return out;
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
  return { joinStereo, mixSections, applyFade, mixVoice, processVoice, VOICE_EFFECTS, VOICE_EQ_KEYS, placeTake, levelTake, resampleLinear, encodeWav };
});
