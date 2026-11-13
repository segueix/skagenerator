(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaWorld = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // WORLD (M. Morise, llicència BSD modificada; vegeu licenses/) compilat a WebAssembly: el mateix
  // analitzador i sintetitzador de veu que fa servir pyworld a l'acció de GitHub. Valors per defecte
  // com els de pyworld: Harvest, CheapTrick (q1 = -0,15, terra de 71 Hz), D4C (llindar 0,85) i Synthesis.
  async function load(source) {
    const bytes = source instanceof ArrayBuffer || ArrayBuffer.isView(source) ? source : await (await fetch(source)).arrayBuffer();
    // Només calen tres funcions de WASI (sortida d'errors), que no es fan servir.
    const wasi = { fd_close: () => 0, fd_seek: () => 0, fd_write: () => 0 };
    const { instance } = await WebAssembly.instantiate(bytes, { wasi_snapshot_preview1: wasi });
    const e = instance.exports;
    e._initialize?.();
    const heap = () => new Float64Array(e.memory.buffer);
    const put = data => { const p = e.w_alloc(data.length * 8); heap().set(data, p / 8); return p; };
    const take = (p, n) => heap().slice(p / 8, p / 8 + n);
    const space = n => e.w_alloc(Math.max(1, n) * 8);
    return {
      // x: Float64Array; retorna { f0, positions }.
      harvest(x, fs, { f0Floor = 71, f0Ceil = 800, framePeriod = 5 } = {}) {
        const n = e.w_harvest_length(fs, x.length, framePeriod), px = put(x), pt = space(n), pf = space(n);
        e.w_harvest(px, x.length, fs, f0Floor, f0Ceil, framePeriod, pt, pf);
        const out = { f0: take(pf, n), positions: take(pt, n) };
        e.w_free(px); e.w_free(pt); e.w_free(pf);
        return out;
      },
      fftSize: fs => e.w_fft_size(fs),
      // Envolupant espectral i aperiodicitat: matrius planes de n × (fft/2 + 1).
      analyse(x, fs, f0, positions) {
        const n = f0.length, fft = e.w_fft_size(fs), bins = fft / 2 + 1;
        const px = put(x), pf = put(f0), pt = put(positions), ps = space(n * bins), pa = space(n * bins);
        e.w_cheaptrick(px, x.length, fs, pt, pf, n, fft, ps);
        e.w_d4c(px, x.length, fs, pt, pf, n, fft, .85, pa);
        const out = { sp: take(ps, n * bins), ap: take(pa, n * bins), bins, fft };
        for (const p of [px, pf, pt, ps, pa]) e.w_free(p);
        return out;
      },
      synthesize(f0, sp, ap, fft, fs, framePeriod = 5) {
        const n = f0.length, length = Math.floor(n * framePeriod * fs / 1000);
        const pf = put(f0), ps = put(sp), pa = put(ap), py = space(length);
        heap().fill(0, py / 8, py / 8 + length);   // Synthesis hi suma: ha de començar a zero
        e.w_synthesis(pf, n, ps, pa, fft, framePeriod, fs, length, py);
        const y = take(py, length);
        for (const p of [pf, ps, pa, py]) e.w_free(p);
        return y;
      }
    };
  }
  return { load };
});
