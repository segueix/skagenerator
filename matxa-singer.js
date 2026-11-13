(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaMatxaSinger = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Port al navegador del cant de l'acció de GitHub (singing/speech2sing.py, la mescla de singing/sing.py
  // i els timbres de singing/voice_timbres.py), amb el mateix WORLD (world.js) i els mateixos paràmetres:
  //   1. Matxa diu cada vers (escala de durada 1,1 i temperatura 0,2).
  //   2. WORLD (Harvest, CheapTrick, D4C) n'extreu el to, l'envolupant espectral i l'aperiodicitat.
  //   3. Els nuclis vocàlics (un per síl·laba) són els pics de l'envolupant de la veu sonora.
  //   4. Cada síl·laba es col·loca a la seva nota: consonants d'inici abans de la nota, la vocal
  //      estirada (amb els extrems a velocitat natural) i les consonants finals al final; entonació de
  //      cantant (entrada per sota, lliscament, deriva, vibrato tardà, caiguda final) i dinàmica.
  //   5. WORLD sintetitza la veu amb el to de la melodia.
  //   6. Mescla: passaaltes, compressor, timbre del subgènere, veu 5 dB per sobre de la banda als mitjos,
  //      greus de la banda 4 dB avall mentre canta, sala, veu doblada i límit de pic.
  // L'única diferència amb l'acció: allà un alineador de veu (MMS, 1,2 GB) troba on sona cada lletra; al
  // navegador no hi cap, i es fa servir la mateixa alternativa que l'acció quan no el té (pics de volum).
  const PERIOD = 5, FPS = 1000 / PERIOD, OUT_RATE = 44100;
  const MALE = new Set(['grau', 'pere', 'lluc', 'quim']);
  const noteOf = speaker => MALE.has(speaker) ? 54 : 64;   // centre del registre cantat de cada veu
  // Matxa: com a l'acció (speech2sing.MatxaSinger.speech).
  const SPEECH = Object.freeze({ lengthScale: 1.1, temperature: .2 });

  // Timbres per subgènere (singing/voice_timbres.py).
  const T = (name, speaker, highpass = 100, lowpass = 8000, o = {}) => Object.freeze({ name, speaker, highpass, lowpass, body: 0, nasal: 0, presence: 0, grit: 0, slapMs: 0, slapLevel: 0, ...o });
  const TIMBRES = Object.freeze({
    jamaican: T('Ska jamaicà càlid', 'grau', 95, 8200, { body: .24, presence: .10 }),
    rocksteady: T('Rocksteady vellutat', 'emma', 90, 6900, { body: .38, presence: -.12, slapMs: 78, slapLevel: .11 }),
    twotone: T('2 Tone nasal', 'pere', 120, 7700, { nasal: .36, presence: .18, grit: .10 }),
    nutty: T('Nutty teatral', 'lluc', 130, 8300, { nasal: .31, presence: .28, grit: .13 }),
    bossreggae: T('Boss reggae de vinil', 'lluc', 100, 6000, { body: .33, presence: -.08, grit: .08, slapMs: 100, slapLevel: .12 }),
    skaswing: T('Ska-swing brillant', 'elia', 120, 9300, { body: .14, presence: .38 }),
    skapunk: T('Ska-punk estrident', 'pere', 140, 8100, { nasal: .27, presence: .35, grit: .30 }),
    punk77: T('Punk 77 cru', 'grau', 155, 7900, { nasal: .16, presence: .40, grit: .38 }),
    oi: T('Oi! aspre i contundent', 'grau', 115, 6800, { body: .32, presence: .15, grit: .48 }),
    skatepunk: T('Skate punk tens', 'lluc', 145, 8500, { nasal: .12, presence: .41, grit: .28 }),
    garage: T('Garage lo-fi', 'grau', 170, 5300, { body: .13, nasal: .20, presence: .18, grit: .55, slapMs: 55, slapLevel: .08 }),
    postpunk: T('Post-punk fosc', 'grau', 95, 5750, { body: .40, presence: -.20, grit: .08, slapMs: 120, slapLevel: .12 }),
    hardcore: T('Hardcore agressiu', 'pere', 180, 7200, { nasal: .15, presence: .36, grit: .65 }),
    poppunk: T('Pop-punk brillant', 'gina', 140, 9600, { body: .08, presence: .38, grit: .09 }),
    horrorpunk: T('Horror punk espectral', 'pere', 100, 6200, { body: .38, nasal: .14, presence: .12, grit: .34, slapMs: 145, slapLevel: .18 })
  });
  const DEFAULT_TIMBRE = T('Matxa natural', 'grau');
  const timbreFor = subgenre => TIMBRES[subgenre] || DEFAULT_TIMBRE;

  // ── Utilitats numèriques (equivalents de NumPy/SciPy) ─────────────────
  function rng(seed) {   // xorshift128+ amb normal de Box-Muller
    let s0 = (seed ^ 0x9E3779B9) >>> 0 || 1, s1 = Math.imul(seed, 0x85EBCA6B) >>> 0 || 2, spare = null;
    const next = () => { let x = s0, y = s1; s0 = y; x ^= x << 23; x ^= x >>> 17; x ^= y ^ (y >>> 26); s1 = x >>> 0; return ((s0 + s1) >>> 0) / 4294967296; };
    return {
      uniform: (a = 0, b = 1) => a + (b - a) * next(),
      integers: (a, b) => a + Math.floor(next() * (b - a)),
      normal() { if (spare !== null) { const v = spare; spare = null; return v; } let u = 0; while (!u) u = next(); const v = next(), m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v); }
    };
  }
  function hashText(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }
  // np.convolve(x, k, mode='same')
  function convolveSame(x, k) {
    const n = x.length, m = k.length, out = new Float64Array(n), off = Math.floor((m - 1) / 2);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < m; j++) { const t = i + off - j; if (t >= 0 && t < n) s += x[t] * k[j]; } out[i] = s; }
    return out;
  }
  // scipy.signal.savgol_filter(x, 7, 2) (mode 'interp': els extrems amb el polinomi ajustat a les 7 primeres/últimes mostres)
  function savgol7(x) {
    const n = x.length, out = new Float64Array(n), c = [-2, 3, 6, 7, 6, 3, -2].map(v => v / 21);
    if (n < 7) return Float64Array.from(x);
    for (let i = 3; i < n - 3; i++) { let s = 0; for (let j = 0; j < 7; j++) s += c[j] * x[i - 3 + j]; out[i] = s; }
    const fit = (from, at) => {   // mínims quadrats d'ordre 2 sobre x[from..from+6], avaluat a «at» (0..6)
      let S = [0, 0, 0, 0, 0], B = [0, 0, 0];
      for (let j = 0; j < 7; j++) { const y = x[from + j]; let p = 1; for (let e = 0; e < 5; e++) { S[e] += p; if (e < 3) B[e] += p * y; p *= j; } }
      const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], c3 = solve3(M, B);
      return c3[0] + c3[1] * at + c3[2] * at * at;
    };
    for (let i = 0; i < 3; i++) { out[i] = fit(0, i); out[n - 1 - i] = fit(n - 7, 6 - i); }
    return out;
  }
  function solve3(M, b) {
    const a = M.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      [a[c], a[p]] = [a[p], a[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k]; }
    }
    return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
  }
  // scipy.signal.find_peaks(x, distance, prominence) → [{ at, prominence }]
  function findPeaks(x, distance, minProminence) {
    const n = x.length; let peaks = [];
    for (let i = 1; i < n - 1;) {
      if (x[i - 1] < x[i]) {
        let ahead = i + 1;
        while (ahead < n - 1 && x[ahead] === x[i]) ahead++;
        if (x[ahead] < x[i]) { peaks.push((i + ahead - 1) >> 1); i = ahead; continue; }
        i = ahead; continue;
      }
      i++;
    }
    if (distance > 1 && peaks.length > 1) {
      const keep = new Array(peaks.length).fill(true), order = peaks.map((_, k) => k).sort((a, b) => x[peaks[a]] - x[peaks[b]] || a - b);
      for (let o = order.length - 1; o >= 0; o--) {
        const j = order[o]; if (!keep[j]) continue;
        for (let k = j - 1; k >= 0 && peaks[j] - peaks[k] < distance; k--) keep[k] = false;
        for (let k = j + 1; k < peaks.length && peaks[k] - peaks[j] < distance; k++) keep[k] = false;
      }
      peaks = peaks.filter((_, k) => keep[k]);
    }
    const out = [];
    for (const p of peaks) {
      let left = x[p], right = x[p];
      for (let i = p; i >= 0 && x[i] <= x[p]; i--) if (x[i] < left) left = x[i];
      for (let i = p; i < n && x[i] <= x[p]; i++) if (x[i] < right) right = x[i];
      const prominence = x[p] - Math.max(left, right);
      if (prominence >= minProminence) out.push({ at: p, prominence });
    }
    return out;
  }
  // ── Filtres Butterworth en seccions de segon ordre (scipy.signal.butter(..., output='sos')) ──
  const C = (re, im = 0) => ({ re, im });
  const add = (a, b) => C(a.re + b.re, a.im + b.im), sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const csqrt = a => { const r = Math.hypot(a.re, a.im), re = Math.sqrt((r + a.re) / 2), im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (r - a.re) / 2)); return C(re, im); };
  const butterCache = new Map();
  function butter(order, freq, type, fs) {
    const key = [order, freq, type, fs].join('|');
    if (butterCache.has(key)) return butterCache.get(key);
    const fs2 = 4, warp = f => fs2 * Math.tan(Math.PI * (f / (fs / 2)) / 2);
    let poles = [], zeros = [], gain = 1;
    for (let k = 0; k < order; k++) { const t = Math.PI * (2 * k + order + 1) / (2 * order); poles.push(C(Math.cos(t), Math.sin(t))); }
    if (type === 'low') { const w = warp(freq); poles = poles.map(p => mul(p, C(w))); gain = w ** order; }
    else if (type === 'high') { const w = warp(freq); let prod = C(1); for (const p of poles) prod = mul(prod, C(-p.re, -p.im)); gain = div(C(1), prod).re; poles = poles.map(p => div(C(w), p)); zeros = poles.map(() => C(0)); }
    else {
      const w1 = warp(freq[0]), w2 = warp(freq[1]), bw = w2 - w1, wo2 = w1 * w2, bp = [];
      for (const p of poles) { const h = mul(p, C(bw / 2)), r = csqrt(sub(mul(h, h), C(wo2))); bp.push(add(h, r), sub(h, r)); }
      poles = bp; zeros = new Array(order).fill(0).map(() => C(0)); gain = bw ** order;
    }
    // Transformació bilineal.
    let num = C(1), den = C(1);
    for (const z of zeros) num = mul(num, sub(C(fs2), z));
    for (const p of poles) den = mul(den, sub(C(fs2), p));
    gain *= div(num, den).re;
    const zp = poles.map(p => div(add(C(fs2), p), sub(C(fs2), p)));
    const zz = zeros.map(z => div(add(C(fs2), z), sub(C(fs2), z)));
    while (zz.length < zp.length) zz.push(C(-1));
    // Seccions: pols conjugats junts (els reals, de dos en dos) i dos zeros (reals: ±1) a cada secció.
    const complex = zp.filter(p => p.im > 1e-12), real = zp.filter(p => Math.abs(p.im) <= 1e-12).map(p => p.re);
    const zr = zz.map(z => z.re).sort((a, b) => a - b), sos = [];
    const takeZeros = () => { const a = zr.length ? zr.shift() : null, b = zr.length ? zr.pop() : null; return [a, b]; };
    for (const p of complex) { const [a, b] = takeZeros(); sos.push(section(a, b, [2 * -p.re, p.re * p.re + p.im * p.im])); }
    for (let i = 0; i < real.length; i += 2) {
      const [a, b] = takeZeros();
      sos.push(i + 1 < real.length ? section(a, b, [-(real[i] + real[i + 1]), real[i] * real[i + 1]]) : section(a, null, [-real[i], 0]));
    }
    sos[0].b = sos[0].b.map(v => v * gain);
    butterCache.set(key, sos);
    return sos;
    function section(z1, z2, [a1, a2]) {
      const b = z1 === null ? [1, 0, 0] : z2 === null ? [1, -z1, 0] : [1, -(z1 + z2), z1 * z2];
      return { b, a: [1, a1, a2] };
    }
  }
  function sosfilt(sos, x, zi = null) {
    const y = Float64Array.from(x);
    sos.forEach(({ b, a }, s) => {
      let z1 = zi ? zi[s][0] : 0, z2 = zi ? zi[s][1] : 0;
      for (let i = 0; i < y.length; i++) { const v = y[i], o = b[0] * v + z1; z1 = b[1] * v - a[1] * o + z2; z2 = b[2] * v - a[2] * o; y[i] = o; }
    });
    return y;
  }
  // Estat inicial en règim permanent per a un esglaó (scipy.signal.sosfilt_zi).
  function sosfiltZi(sos) {
    let scale = 1;
    return sos.map(({ b, a }) => {
      const m00 = 1 + a[1], m01 = -1, m10 = a[2], m11 = 1, B0 = b[1] - a[1] * b[0], B1 = b[2] - a[2] * b[0];
      const det = m00 * m11 - m01 * m10, z = [(B0 * m11 - m01 * B1) / det, (m00 * B1 - m10 * B0) / det].map(v => v * scale);
      scale *= (b[0] + b[1] + b[2]) / (1 + a[1] + a[2]);
      return z;
    });
  }
  // scipy.signal.sosfiltfilt (extensió senar als extrems)
  function sosfiltfilt(sos, x) {
    const n = x.length, pad = Math.min(n - 1, 3 * (2 * sos.length + 1 - Math.min(sos.filter(s => s.b[2] === 0).length, sos.filter(s => s.a[2] === 0).length)));
    const ext = new Float64Array(n + 2 * pad);
    for (let i = 0; i < pad; i++) { ext[i] = 2 * x[0] - x[pad - i]; ext[n + pad + i] = 2 * x[n - 1] - x[n - 2 - i]; }
    ext.set(x, pad);
    const zi = sosfiltZi(sos), scaled = v => zi.map(z => [z[0] * v, z[1] * v]);
    let y = sosfilt(sos, ext, scaled(ext[0]));
    y.reverse(); y = sosfilt(sos, y, scaled(y[0])); y.reverse();
    return y.subarray(pad, pad + n);
  }
  // ── FFT (radix 2) i convolució per solapament i suma ──────────────────
  const twiddles = new Map();
  function fft(re, im, inverse) {
    const n = re.length;
    let tw = twiddles.get(n);
    if (!tw) { tw = { cos: new Float64Array(n / 2), sin: new Float64Array(n / 2), rev: new Uint32Array(n) };
      for (let i = 0; i < n / 2; i++) { tw.cos[i] = Math.cos(2 * Math.PI * i / n); tw.sin[i] = Math.sin(2 * Math.PI * i / n); }
      for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; tw.rev[i] = j; }
      twiddles.set(n, tw); }
    for (let i = 1; i < n; i++) { const j = tw.rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    const sign = inverse ? 1 : -1;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) for (let j = 0; j < half; j++) {
        const wr = tw.cos[j * step], wi = sign * tw.sin[j * step], a = i + j, b = a + half;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  function convolveLong(x, h) {   // scipy.signal.fftconvolve(x, h)[:len(x)]
    const n = x.length, out = new Float64Array(n);
    let size = 1; while (size < 2 * h.length) size <<= 1;
    const block = size - h.length + 1, hr = new Float64Array(size), hi = new Float64Array(size);
    hr.set(h); fft(hr, hi, false);
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let at = 0; at < n; at += block) {
      const len = Math.min(block, n - at);
      let silent = true; for (let i = 0; i < len; i++) if (x[at + i] !== 0) { silent = false; break; }
      if (silent) continue;
      re.fill(0); im.fill(0);
      for (let i = 0; i < len; i++) re[i] = x[at + i];
      fft(re, im, false);
      for (let i = 0; i < size; i++) { const r = re[i] * hr[i] - im[i] * hi[i]; im[i] = re[i] * hi[i] + im[i] * hr[i]; re[i] = r; }
      fft(re, im, true);
      for (let i = 0; i < size && at + i < n; i++) out[at + i] += re[i];
    }
    return out;
  }
  // scipy.signal.resample_poly(x, up, 1): filtre de Kaiser (β = 5) de 20·up mostres a cada banda.
  function besselI0(x) { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t; } return s; }
  function upsample(x, up) {
    if (up === 1) return Float64Array.from(x);
    const half = 10 * up, taps = 2 * half + 1, h = new Float64Array(taps), cutoff = 1 / up;
    for (let i = 0; i < taps; i++) {
      const m = i - half, sinc = m === 0 ? 1 : Math.sin(Math.PI * cutoff * m) / (Math.PI * cutoff * m);
      h[i] = cutoff * sinc * besselI0(5 * Math.sqrt(1 - (2 * i / (taps - 1) - 1) ** 2)) / besselI0(5);
    }
    let sum = 0; for (const v of h) sum += v; for (let i = 0; i < taps; i++) h[i] *= up / sum;
    const out = new Float64Array(x.length * up);
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      for (let k = (i + half) % up; k < taps; k += up) { const j = (i + half - k) / up; if (j >= 0 && j < x.length) s += h[k] * x[j]; }
      out[i] = s;
    }
    return out;
  }

  // ── De parla a cant (speech2sing.MatxaSinger) ─────────────────────────
  // Anàlisi d'una locució: paràmetres de WORLD i, per a cada una de les «count» síl·labes,
  // [inici de les consonants, inici de la vocal, final de la vocal, final de les consonants finals] (en trames).
  function analyse(world, speech, rate, count) {
    let peak = 0; for (const v of speech) peak = Math.max(peak, Math.abs(v));
    const x = new Float64Array(speech.length); for (let i = 0; i < x.length; i++) x[i] = speech[i] / (peak + 1e-9) * .5;
    const { f0, positions } = world.harvest(x, rate, { f0Floor: 60, f0Ceil: 600, framePeriod: PERIOD });
    const { sp, ap, bins, fft: fftSize } = world.analyse(x, rate, f0, positions);
    const hop = Math.floor(rate * PERIOD / 1000), n = f0.length, rms = new Float64Array(n), voicedRms = new Float64Array(n);
    let top = 0;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0; for (let j = i * hop; j < Math.min(x.length, (i + 1) * hop); j++) { s += x[j] * x[j]; c++; }
      rms[i] = Math.sqrt((c ? s / c : NaN) + 1e-12); if (!(rms[i] >= 0)) rms[i] = 1e-6;
      voicedRms[i] = f0[i] > 0 ? rms[i] : 0; if (rms[i] > top) top = rms[i];
    }
    const env = savgol7(voicedRms).map(v => Math.max(0, v));
    const nuclei = findNuclei(env, count), sylls = [], bounds = [];
    nuclei.forEach((p, k) => {
      const lo = k ? nuclei[k - 1] : 0, hi = k + 1 < nuclei.length ? nuclei[k + 1] : n - 1, thr = env[p] * .45;
      let a = p; while (a > lo + 1 && env[a - 1] > thr && f0[a - 1] > 0) a--;
      let b = p; while (b < hi - 1 && env[b + 1] > thr && f0[b + 1] > 0) b++;
      bounds.push([a, b + 1]);
    });
    let s0 = 0; while (s0 < n && !(rms[s0] > top * .03)) s0++; if (s0 >= n) s0 = 0;
    let s1 = n; for (let i = n - 1; i >= 0; i--) if (rms[i] > top * .03) { s1 = i + 1; break; }
    bounds.forEach(([a, b], k) => {
      const o0 = k ? bounds[k - 1][1] + Math.trunc((a - bounds[k - 1][1]) * .4) : s0;   // 60 % de les consonants, per a aquesta síl·laba
      const c1 = k === bounds.length - 1 ? s1 : b + Math.trunc((bounds[k + 1][0] - b) * .4);
      sylls.push([Math.min(o0, a), a, b, Math.max(b, c1)]);
    });
    const voiced = new Uint8Array(n); for (let i = 0; i < n; i++) voiced[i] = f0[i] > 0 ? 1 : 0;
    // L'envolupant es guarda en logaritme (Float32): ocupa la meitat i s'interpola directament.
    const logSp = new Float32Array(sp.length); for (let i = 0; i < sp.length; i++) logSp[i] = Math.log(sp[i]);
    return { logSp, ap: Float32Array.from(ap), bins, fft: fftSize, voiced, sylls, n, rate };
  }
  function findNuclei(env, count) {
    let top = 0; for (const v of env) top = Math.max(top, v);
    const found = findPeaks(env, 8, top * .04);
    if (found.length >= count) return found.slice().sort((a, b) => b.prominence - a.prominence).slice(0, count).map(p => p.at).sort((a, b) => a - b);
    // Menys pics que síl·labes: es parteixen les vocals més llargues.
    const peaks = found.map(p => p.at); if (!peaks.length) { let m = 0; for (let i = 1; i < env.length; i++) if (env[i] > env[m]) m = i; peaks.push(m); }
    while (peaks.length < count) {
      const ext = [0, ...peaks, env.length - 1]; let g = -1, at = 0;
      for (let i = 0; i < ext.length - 1; i++) if (ext[i + 1] - ext[i] >= g) { g = ext[i + 1] - ext[i]; at = i; }
      peaks.push(Math.trunc(ext[at] + g / 2)); peaks.sort((a, b) => a - b);
    }
    return peaks;
  }
  // Text que diu Matxa per a un vers: les paraules de la partitura, amb majúscula i punt (_line_text).
  // Amb «stretch», les vocals de les síl·labes que es canten llargues s'escriuen repetides («caaasa»):
  // Matxa mateixa les allarga de manera natural (fins a un 50–75 %) i WORLD les ha d'estirar menys, amb
  // les consonants intactes. Més de tres lletres per vocal ja li fa dir coses rares (mesurat).
  const VOWELS = 'aeiouàèéíïòóúü';
  function vowelNuclei(word) {   // [inici, final] de cada nucli, com catalan.nuclei (amb la u muda de «que», «gui»)
    const out = [];
    for (let i = 0; i < word.length; i++) {
      if (!VOWELS.includes(word[i])) continue;
      if (word[i] === 'u' && i && 'qg'.includes(word[i - 1]) && 'eiéèí'.includes(word[i + 1] || '')) continue;
      let j = i + 1;
      if (j < word.length && 'iu'.includes(word[j]) && !'iu'.includes(word[i])) j++;
      out.push([i, j]); i = j - 1;
    }
    return out;
  }
  function stretchWord(word, durations, minSeconds) {
    const nuclei = vowelNuclei(word);
    if (nuclei.length !== durations.length) return word;   // sinalefes i casos estranys: tal com és
    let out = '', at = 0;
    nuclei.forEach(([a], k) => {
      const plain = { à: 'a', è: 'e', é: 'e', í: 'i', ï: 'i', ò: 'o', ó: 'o', ú: 'u', ü: 'u' }[word[a]] || word[a];
      out += word.slice(at, a + 1) + (durations[k] >= minSeconds ? plain + plain : ''); at = a + 1;
    });
    return out + word.slice(at);
  }
  function lineText(notes, { stretch = false, minSeconds = .3 } = {}) {
    const words = [];
    for (let i = 0; i < notes.length;) {
      let j = i + 1;
      while (j < notes.length && notes[j].syllable > 0 && notes[j].word === notes[i].word) j++;
      const group = notes.slice(i, j), word = notes[i].word;
      // Durada de cada síl·laba: fins a la nota següent si hi va enganxada.
      const durations = group.map((n, k) => { const next = notes[i + k + 1]; return next && next.t - (n.t + n.d) < .09 ? next.t - n.t : n.d; });
      words.push(stretch && !word.includes(' ') ? stretchWord(word, durations, minSeconds) : word);
      i = j;
    }
    const text = words.join(' ');
    return text.slice(0, 1).toUpperCase() + text.slice(1) + '.';
  }
  // El que es demana a Matxa a la ràdio: vocals triplicades a les síl·labes de 0,3 s o més. Mesurat amb
  // quatre cançons: de 40 % a 44 % de paraules enteses de mitjana, i el punk ràpid de 16 % a 36 %.
  const spokenText = notes => lineText(notes, { stretch: true, minSeconds: .3 });
  // Un vers cantat → { start (segons), wave (Float32 a 44,1 kHz) }  (MatxaSinger._sing_take)
  function singLine(world, notes, shift, unit, seed = 0) {
    const { rate, bins, n: unitFrames } = unit;
    const start = notes[0].t - .45, end = notes[notes.length - 1].t + notes[notes.length - 1].d + .4;
    const total = Math.ceil((end - start) * FPS);
    const logSp = new Float64Array(total * bins).fill(Math.log(1e-12)), AP = new Float64Array(total * bins).fill(1);
    const V = new Uint8Array(total), have = new Uint8Array(total), midi = new Float64Array(total);
    const fr = t => Math.round((t - start) * FPS);
    const put = (at, idx, m) => {
      const n = Math.min(idx.length, total - at);
      if (n <= 0 || at < 0) return;
      for (let k = 0; k < n; k++) {
        const f = idx[k], i0 = Math.min(unitFrames - 1, Math.max(0, Math.floor(f))), i1 = Math.min(i0 + 1, unitFrames - 1), w = f - Math.floor(f), o = (at + k) * bins;
        for (let j = 0; j < bins; j++) {
          logSp[o + j] = unit.logSp[i0 * bins + j] * (1 - w) + unit.logSp[i1 * bins + j] * w;
          AP[o + j] = unit.ap[i0 * bins + j] * (1 - w) + unit.ap[i1 * bins + j] * w;
        }
        V[at + k] = unit.voiced[Math.min(unitFrames - 1, Math.max(0, Math.round(f)))]; have[at + k] = 1; midi[at + k] = m;
      }
    };
    const range = (a, b) => { const r = []; for (let i = a; i < b; i++) r.push(i); return r; };
    const r = rng((hashText(lineText(notes)) + seed) >>> 0), gain = new Float64Array(total).fill(1), vstart = [];
    const maxOn = Math.trunc(.22 * FPS), maxCoda = Math.trunc(.16 * FPS);
    notes.forEach((note, k) => {
      const [o0, a, b, c1] = unit.sylls[k], m = note.midi + shift;
      const late = r.integers(0, 4);   // cada nota entra uns mil·lisegons tard (mai abans)
      let na = fr(note.t) + late, nb = fr(note.t + note.d);
      const on = range(Math.max(o0, a - maxOn), a), coda = range(b, Math.min(c1, b + maxCoda));
      if (k + 1 < notes.length) {   // si la nota següent va seguida, es deixa lloc a les seves consonants
        const [no0, naa] = unit.sylls[k + 1];
        nb = Math.min(nb, Math.max(na + 3, fr(notes[k + 1].t) - Math.min(naa - no0, maxOn)));
      }
      const ve = Math.max(na + 2, nb - coda.length);
      if (on.length) put(na - on.length, on, m);
      // Vocal: els extrems (30 ms) a velocitat natural i el centre estirat.
      const length = ve - na, edge = Math.max(0, Math.min(6, Math.trunc((b - a) / 3), Math.trunc(length / 3)));
      const midCount = Math.max(0, length - 2 * edge), from = a + edge, to = Math.max(a + edge, b - edge - 1), idx = range(a, a + edge);
      for (let i = 0; i < midCount; i++) idx.push(midCount === 1 ? from : from + (to - from) * i / (midCount - 1));
      idx.push(...range(b - edge, b));
      put(na, idx, m);
      vstart.push([na, ve, k === 0 || !have[Math.max(0, na - on.length - 2)]]);
      // Dinàmica: atac de 30 ms, una mica de caiguda a les notes llargues i ±1 dB d'una nota a l'altra.
      const level = 10 ** (r.uniform(-1, 1) / 20), att = Math.min(6, length);
      for (let i = 0; i < Math.max(0, Math.min(length, total - na)); i++) {
        let g = level;
        if (i < att) g *= att === 1 ? .75 : .75 + .25 * i / (att - 1);
        if (length > 60 && i >= 60) g *= length - 60 === 1 ? 1 : 1 - .18 * (i - 60) / (length - 61);
        gain[na + i] = g;
      }
      if (coda.length) put(ve, coda.slice(0, Math.max(0, total - ve)), m);
    });
    for (let f = 0; f < total; f++) { const g = Math.log(gain[f] * gain[f]); if (g) for (let j = 0; j < bins; j++) logSp[f * bins + j] += g; }
    // Entonació de cantant.
    const semis = Float64Array.from(midi), noise = new Float64Array(total + 400);
    for (let i = 0; i < noise.length; i++) noise[i] = r.normal();
    const drift = convolveSame(noise, new Float64Array(200).fill(1 / 200)).subarray(200, 200 + total);
    let dmax = 0; for (const v of drift) dmax = Math.max(dmax, Math.abs(v));
    for (let i = 0; i < total; i++) semis[i] += drift[i] / (dmax + 1e-9) * .2;
    vstart.forEach(([na, ve, fresh], i) => {
      const length = ve - na; if (length <= 0) return;
      const scoop = (fresh ? .9 : .25) * r.uniform(.6, 1.2), rateHz = r.uniform(5, 6), depth = r.uniform(.18, .38), phase = r.uniform(0, 6.28);
      for (let t = 0; t < length && na + t < total; t++) {
        let v = -scoop * Math.exp(-t / (fresh ? 14 : 8));
        v += depth * Math.min(1, Math.max(0, (t - 44) / 50)) * Math.sin(2 * Math.PI * rateHz * t / FPS + phase);
        if (i === vstart.length - 1 && length > 30) { const fall = Math.min(1, Math.max(0, (t - (length - 30)) / 30)); v -= .6 * fall * fall; }
        semis[na + t] += v;
      }
    });
    for (let i = 0; i < total; i++) semis[i] += r.normal() * .03;
    const kern = new Float64Array(15); let ks = 0;
    for (let i = 0; i < 15; i++) { kern[i] = .5 - .5 * Math.cos(2 * Math.PI * i / 14); ks += kern[i]; }
    for (let i = 0; i < 15; i++) kern[i] /= ks;
    const filled = new Float64Array(total), haveF = new Float64Array(total);
    for (let i = 0; i < total; i++) { filled[i] = have[i] ? semis[i] : 0; haveF[i] = have[i]; }
    const num = convolveSame(filled, kern), weight = convolveSame(haveF, kern);
    const F0 = new Float64Array(total), SP = new Float64Array(total * bins);
    for (let i = 0; i < total; i++) {
      const s = have[i] ? num[i] / Math.max(weight[i], 1e-6) : semis[i];
      F0[i] = V[i] && have[i] ? 440 * 2 ** ((s - 69) / 12) : 0;
    }
    for (let i = 0; i < SP.length; i++) SP[i] = Math.exp(logSp[i]);
    const y = world.synthesize(F0, SP, AP, unit.fft, rate, PERIOD);
    const up = Math.round(OUT_RATE / rate), wave = up >= 1 && OUT_RATE % rate === 0 ? upsample(y, up) : linear(y, rate, OUT_RATE);
    return { start, wave: Float32Array.from(wave) };
  }
  function linear(x, from, to) {
    const out = new Float64Array(Math.round(x.length * to / from)), ratio = from / to;
    for (let i = 0; i < out.length; i++) { const p = i * ratio, k = Math.floor(p), f = p - k; out[i] = (x[k] || 0) * (1 - f) + (x[k + 1] || 0) * f; }
    return out;
  }
  // Versos de la partitura (com sing.py: una frase nova a cada lineStart).
  function phrasesOf(notes) {
    const out = [];
    for (const n of notes.slice().sort((a, b) => a.t - b.t)) { if (n.lineStart || !out.length) out.push([]); out[out.length - 1].push(n); }
    return out;
  }
  // L'octava més cantable per a la veu: la mediana de totes les notes de la cançó, a prop del centre del registre.
  function shiftFor(notes, speaker) {
    const m = notes.map(n => n.midi).sort((a, b) => a - b), median = m.length % 2 ? m[m.length >> 1] : (m[m.length / 2 - 1] + m[m.length / 2]) / 2;
    return 12 * Math.round((noteOf(speaker) - median) / 12) || 0;
  }
  // Col·loca un vers a la pista de veu amb fosos de 256 mostres als extrems (sing.py, lay).
  function lay(target, start, wave) {
    let a = Math.round(start * OUT_RATE), w = wave;
    if (a < 0) { w = w.subarray(-a); a = 0; }
    const end = Math.min(target.length, a + w.length), len = end - a; if (len <= 0) return;
    const fade = Math.min(256, Math.floor(w.length / 4));
    for (let i = 0; i < len; i++) {
      let v = w[i];
      if (i < fade) v *= fade === 1 ? 0 : i / (fade - 1);
      if (i >= len - fade) v *= fade === 1 ? 0 : (len - 1 - i) / (fade - 1);
      target[a + i] += v;
    }
  }

  // ── Mescla (singing/sing.py, main) ────────────────────────────────────
  function compress(x, thresholdDb = -20, ratio = 3, attack = .005, release = .12) {
    const a = Math.exp(-1 / (attack * OUT_RATE)), r = Math.exp(-1 / (release * OUT_RATE)), out = new Float64Array(x.length);
    let env = 0;
    for (let i = 0; i < x.length; i += 64) {
      let peak = 0; for (let j = i; j < Math.min(x.length, i + 64); j++) peak = Math.max(peak, Math.abs(x[j]));
      env = peak > env ? a * env + (1 - a) * peak : r * env + (1 - r) * peak;
      const db = 20 * Math.log10(env + 1e-9), g = 10 ** (-(Math.max(0, db - thresholdDb) * (1 - 1 / ratio)) / 20);
      for (let j = i; j < Math.min(x.length, i + 64); j++) out[j] = x[j] * g;
    }
    return out;
  }
  let roomIr = null;
  function room(x) {
    if (!roomIr) {
      const r = rng(7), n = Math.trunc(1.3 * OUT_RATE), ir = new Float64Array(n);
      for (let i = 0; i < n; i++) ir[i] = i < Math.trunc(.012 * OUT_RATE) ? 0 : r.normal() * Math.exp(-i / (.32 * OUT_RATE));
      roomIr = sosfilt(butter(2, [300, 6000], 'band', OUT_RATE), ir);
    }
    let sum = 0; for (const v of roomIr) sum += Math.abs(v);
    const wet = convolveLong(x, roomIr), k = 1 / (Math.sqrt(sum) * 6 + 1e-9);
    for (let i = 0; i < wet.length; i++) wet[i] *= k;
    return wet;
  }
  function applyTimbre(x, subgenre) {
    const p = TIMBRES[subgenre]; if (!p) return Float64Array.from(x);
    const band = (lo, hi) => { hi = Math.min(hi, Math.trunc(OUT_RATE * .47)); return lo >= hi ? new Float64Array(x.length) : sosfilt(butter(2, [lo, hi], 'band', OUT_RATE), x); };
    const y = sosfilt(butter(2, [p.highpass, Math.min(p.lowpass, Math.trunc(OUT_RATE * .47))], 'band', OUT_RATE), x);
    for (const [amount, lo, hi] of [[p.body, 180, 650], [p.nasal, 760, 1650], [p.presence, 1750, 3900]]) if (amount) { const b = band(lo, hi); for (let i = 0; i < y.length; i++) y[i] += amount * b[i]; }
    if (p.grit) for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * (1 + 5 * p.grit));
    if (p.slapMs && p.slapLevel) { const d = Math.trunc(p.slapMs * OUT_RATE / 1000); for (let i = y.length - 1; i >= d; i--) y[i] += p.slapLevel * y[i - d]; }
    let before = 0, after = 0;
    for (let i = 0; i < y.length; i++) { y[i] = .88 * y[i] + .12 * x[i]; before += x[i] * x[i]; after += y[i] * y[i]; }
    before = Math.sqrt(before / y.length); after = Math.sqrt(after / y.length);
    if (before > 1e-7 && after > 1e-7) { const g = Math.min(2.5, Math.max(.4, before / after)); for (let i = 0; i < y.length; i++) y[i] *= g; }
    return y;
  }
  // band: [L, R] (Float32Array); vocal: veu seca col·locada (Float32Array). Retorna la mescla [L, R].
  function mixSong(band, vocalDry, subgenre, { double = true } = {}) {
    const n = band[0].length;
    let vocal = new Float64Array(n); vocal.set(vocalDry.subarray(0, n));
    vocal = sosfilt(butter(2, 110, 'high', OUT_RATE), vocal);
    vocal = compress(vocal);
    vocal = applyTimbre(vocal, subgenre);
    // Nivell: als mitjos (300–4.000 Hz), la veu 5 dB per sobre de la banda mentre canta.
    const mids = x => sosfilt(butter(4, [300, 4000], 'band', OUT_RATE), x);
    const mono = new Float64Array(n); for (let i = 0; i < n; i++) mono[i] = (band[0][i] + band[1][i]) / 2;
    const vm = mids(vocal), bm = mids(mono);
    let vs = 0, bs = 0, c = 0;
    for (let i = 0; i < n; i++) if (Math.abs(vocal[i]) > 1e-3) { vs += vm[i] * vm[i]; bs += bm[i] * bm[i]; c++; }
    if (c) { const k = (Math.sqrt(bs / c + 1e-12) * 10 ** (5 / 20)) / (Math.sqrt(vs / c) + 1e-9); for (let i = 0; i < n; i++) vocal[i] *= k; }
    // Mentre canta la veu, els greus de la banda (per sota de 250 Hz) baixen 4 dB.
    const on = new Float64Array(n); for (let i = 0; i < n; i++) on[i] = Math.abs(vocal[i]) > 2e-3 ? 1 : 0;
    const env = sosfiltfilt(butter(1, 4, 'low', OUT_RATE), on), low = butter(4, 250, 'low', OUT_RATE), depth = 1 - 10 ** (-4 / 20);
    const out = [new Float32Array(n), new Float32Array(n)];
    for (let ch = 0; ch < 2; ch++) {
      const lows = sosfiltfilt(low, band[ch]);
      for (let i = 0; i < n; i++) { const duck = 1 - depth * Math.min(1, Math.max(0, env[i] * 1.5)); out[ch][i] = band[ch][i] - lows[i] + lows[i] * duck; }
    }
    const wet = room(vocal), wetLevel = .9;
    for (let i = 0; i < n; i++) { out[0][i] += vocal[i] + wet[i] * wetLevel * .9; out[1][i] += vocal[i] + wet[i] * wetLevel * 1.1; }
    if (double) {
      // Veu doblada: dues còpies a banda i banda, uns mil·lisegons tard i amb un retard que es mou lentament, 8 dB per sota.
      const g = 10 ** (-8 / 20);
      [[19, .31, 0], [27, .23, 1.7]].forEach(([baseMs, lfo, phase], side) => {
        for (let i = 0; i < n; i++) {
          const p = i - (baseMs + 3.5 * Math.sin(2 * Math.PI * lfo * i / OUT_RATE + phase)) * OUT_RATE / 1000;
          if (p < 0) continue;
          const k = Math.floor(p), f = p - k; out[side][i] += g * (vocal[k] * (1 - f) + (k + 1 < n ? vocal[k + 1] : vocal[k]) * f);
        }
      });
    }
    let peak = 0; for (const ch of out) for (const v of ch) peak = Math.max(peak, Math.abs(v));
    if (peak > .97) for (const ch of out) for (let i = 0; i < n; i++) ch[i] *= .97 / peak;
    return out;
  }

  return { SPEECH, TIMBRES, timbreFor, noteOf, lineText, spokenText, phrasesOf, shiftFor, analyse, singLine, lay, mixSong, applyTimbre,
    // Per a les proves.
    stretchWord, butter, sosfilt, sosfiltfilt, savgol7, findPeaks, findNuclei, upsample, convolveLong, rng };
});
