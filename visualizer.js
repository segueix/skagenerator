(() => {
  'use strict';
  // VaTuCalla! — visualitzador a pantalla completa per a la batucada (per fer videoclips).
  // Reprodueix la cançó ja gravada (WAV de la ràdio), dibuixa formes que canvien amb el so i
  // mostra els instruments que sonen a cada moment (a partir de la partitura de cada cop).
  // El vídeo s'exporta des del mateix llenç: imatge del llenç + àudio original, sincronitzats.
  // Dissenys: cada un és una funció que dibuixa un fotograma; se n'hi poden afegir més a DESIGNS.
  const PROJECT = 'VaTuCalla!';
  const FORMATS = { landscape: [1920, 1080, 'Horitzontal 16:9'], portrait: [1080, 1920, 'Vertical 9:16'], square: [1080, 1080, 'Quadrat 1:1'] };
  const FONT = '"Archivo Black", "Manrope", system-ui, sans-serif';
  // Color de cada instrument (to HSL), en l'ordre de la graella de la batucada.
  const hueOf = row => (row * 137.5 + 20) % 360;

  // ── Dissenys ──────────────────────────────────────────────────────────
  // draw(ctx, w, h, frame): frame = { t, dt, bass, mid, high, level, hits: [{ row, age }], sparks }
  const DESIGNS = {
    infinit: {
      name: 'Infinit',
      // Lemniscata de Bernoulli (∞): diverses cintes de colors que giren i bateguen amb els greus; cada cop
      // d'instrument fa un esclat del seu color en el seu punt de la corba, que hi corre per sobre.
      draw(ctx, w, h, f, state) {
        // (En vertical, una mica més petit: les cintes no surten tant pels costats quan bateguen.)
        const s = Math.min(w, h) * (w < h ? .86 : 1), cx = w / 2, cy = h / 2;
        // Rastre: cada fotograma esborra una mica l'anterior (formes que no s'acaben mai).
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(6, 4, 14, ${0.16 + 0.1 * (1 - f.level)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        const curve = (t, scale, twist) => {
          const d = 1 + Math.sin(t) ** 2, x = Math.cos(t) / d, y = Math.sin(t) * Math.cos(t) / d;
          const c = Math.cos(twist), sn = Math.sin(twist);
          return [cx + scale * (x * c - y * sn), cy + scale * (x * sn + y * c)];
        };
        const layers = 7, pulse = 1 + f.bass * 0.35;
        for (let k = 0; k < layers; k++) {
          const scale = s * (0.36 + k * 0.022) * pulse, twist = f.t * (0.05 + k * 0.012) * (k % 2 ? -1 : 1);
          const hue = (f.t * 24 + k * 34) % 360;
          ctx.strokeStyle = `hsla(${hue}, 95%, ${48 + f.mid * 22}%, ${0.18 + f.level * 0.35})`;
          ctx.lineWidth = s * (0.002 + f.mid * 0.006) * (1 + k * 0.15);
          ctx.beginPath();
          for (let i = 0; i <= 240; i++) {
            const t = (i / 240) * Math.PI * 2, wobble = 1 + 0.06 * Math.sin(t * (3 + k) + f.t * 2) * (0.3 + f.high);
            const [x, y] = curve(t, scale * wobble, twist);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        // Esclats: cada instrument té el seu lloc a la corba; el cop hi corre i s'esvaeix.
        for (const hit of f.hits) {
          const life = 1 - hit.age / 0.9;
          if (life <= 0) continue;
          const t = (hit.row / 12) * Math.PI * 2 + f.t * 0.6 + hit.age * 2.2;
          const [x, y] = curve(t, s * 0.4 * pulse, f.t * 0.05);
          const r = s * (0.015 + (1 - life) * 0.09);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `hsla(${hueOf(hit.row)}, 100%, 70%, ${0.9 * life})`);
          g.addColorStop(1, `hsla(${hueOf(hit.row)}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // Espurnes dels aguts.
        for (const p of state.sparks) {
          p.x += p.vx * f.dt; p.y += p.vy * f.dt; p.life -= f.dt;
          ctx.fillStyle = `hsla(${p.hue}, 100%, 75%, ${Math.max(0, p.life)})`;
          ctx.fillRect(p.x, p.y, s * 0.004, s * 0.004);
        }
        state.sparks = state.sparks.filter(p => p.life > 0);
        for (let i = 0; i < Math.round(f.high * 6); i++) {
          const a = Math.random() * Math.PI * 2, v = s * (0.1 + Math.random() * 0.3);
          state.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, hue: (f.t * 40 + Math.random() * 120) % 360 });
        }
      }
    }
  };

  // ── Interfície ────────────────────────────────────────────────────────
  // El disseny es dibuixa en una capa pròpia (amb els rastres); el llenç que es veu i es grava és aquesta capa
  // més els textos, nets a cada fotograma.
  let scene, sceneCtx;
  let root, canvas, ctx, ui = {}, audioCtx, analyser, recordDest, buffer, source, song = null;
  let playing = false, startedAt = 0, offset = 0, frame = 0, last = 0, recorder = null, hideTimer = 0;
  const state = { sparks: [] };
  const $ = (tag, props = {}, ...children) => { const el = Object.assign(document.createElement(tag), props); el.append(...children); return el; };
  const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sense memòria */ } } };

  function build() {
    root = $('div', { className: 'vtc', hidden: true, tabIndex: -1 });
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Visualitzador VaTuCalla!');
    canvas = $('canvas', { className: 'vtc-canvas' });
    ctx = canvas.getContext('2d');
    ui.title = $('input', { className: 'vtc-title-input', type: 'text', maxLength: 80, placeholder: 'Nom de la cançó' });
    ui.title.setAttribute('aria-label', 'Nom de la cançó');
    ui.design = $('select', { className: 'vtc-select' }, ...Object.entries(DESIGNS).map(([key, d]) => new Option(d.name, key)));
    ui.design.setAttribute('aria-label', 'Disseny');
    ui.format = $('select', { className: 'vtc-select' }, ...Object.entries(FORMATS).map(([key, [, , name]]) => new Option(name, key)));
    ui.format.setAttribute('aria-label', 'Format del vídeo');
    ui.play = $('button', { className: 'vtc-btn', type: 'button', textContent: '▶' });
    ui.play.setAttribute('aria-label', 'Reprodueix');
    ui.restart = $('button', { className: 'vtc-btn', type: 'button', textContent: '⏮' });
    ui.restart.setAttribute('aria-label', 'Des del principi');
    ui.record = $('button', { className: 'vtc-btn vtc-rec', type: 'button', textContent: '● Grava vídeo' });
    ui.full = $('button', { className: 'vtc-btn', type: 'button', textContent: '⛶' });
    ui.full.setAttribute('aria-label', 'Pantalla completa');
    ui.close = $('button', { className: 'vtc-btn', type: 'button', textContent: '✕' });
    ui.close.setAttribute('aria-label', 'Tanca el visualitzador');
    ui.time = $('span', { className: 'vtc-time', textContent: '0:00' });
    ui.status = $('p', { className: 'vtc-status', role: 'status' });
    ui.bar = $('div', { className: 'vtc-bar' }, ui.title, ui.design, ui.format, ui.restart, ui.play, ui.time, ui.record, ui.full, ui.close);
    root.append(canvas, ui.bar, ui.status);
    document.body.append(root);
    ui.play.addEventListener('click', () => (playing ? pause() : play()));
    ui.restart.addEventListener('click', () => { const was = playing; stopSource(); offset = 0; if (was) play(); });
    ui.close.addEventListener('click', close);
    ui.full.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => {}); });
    // Format: el darrer triat o, la primera vegada, el de la pantalla (vertical al mòbil).
    ui.format.value = FORMATS[store.get('vatucalla-format')] ? store.get('vatucalla-format') : innerHeight > innerWidth ? 'portrait' : 'landscape';
    ui.format.addEventListener('change', () => { store.set('vatucalla-format', ui.format.value); if (!recorder) resize(); });
    ui.title.addEventListener('input', () => { if (song) store.set(`vatucalla-title-${song.id}`, ui.title.value); });
    // Gravant, el botó atura i desa el que s'ha gravat fins ara (per fer un tros de la cançó); tancar ho cancel·la.
    ui.record.addEventListener('click', () => (recorder ? stopRecording(false) : startRecording()));
    root.addEventListener('pointermove', wake);
    root.addEventListener('keydown', event => {
      if (event.target === ui.title) return;
      if (event.key === 'Escape' && !document.fullscreenElement) close();
      if (event.key === ' ') { event.preventDefault(); playing ? pause() : play(); }
    });
  }
  // La barra de controls s'amaga sola (no surt mai al vídeo: el vídeo és només el llenç).
  function wake() {
    root.classList.remove('vtc-idle'); clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (playing && document.activeElement !== ui.title) root.classList.add('vtc-idle'); }, 2500);
  }
  function resize() {
    const [w, h] = FORMATS[ui.format.value];
    canvas.width = w; canvas.height = h;
    scene ??= document.createElement('canvas'); scene.width = w; scene.height = h; sceneCtx = scene.getContext('2d');
    sceneCtx.fillStyle = '#06040e'; sceneCtx.fillRect(0, 0, w, h);
  }

  // ── So: la cançó, l'analitzador i la sortida per a la gravació ────────
  function position() { return playing ? Math.min(buffer.duration, audioCtx.currentTime - startedAt) : offset; }
  function play() {
    if (!buffer || playing) return;
    audioCtx.resume();
    if (offset >= buffer.duration - .05) offset = 0;
    source = audioCtx.createBufferSource(); source.buffer = buffer;
    source.connect(analyser);
    source.onended = () => { if (source && position() >= buffer.duration - .1) { playing = false; offset = buffer.duration; source = null; ui.play.textContent = '▶'; if (recorder) stopRecording(false); } };
    source.start(0, offset); startedAt = audioCtx.currentTime - offset; playing = true;
    ui.play.textContent = '❚❚'; ui.play.setAttribute('aria-label', 'Pausa'); wake();
  }
  function stopSource() { if (source) { source.onended = null; try { source.stop(); } catch { /* ja aturada */ } source = null; } playing = false; }
  function pause() { offset = position(); stopSource(); ui.play.textContent = '▶'; ui.play.setAttribute('aria-label', 'Reprodueix'); root.classList.remove('vtc-idle'); }

  // Energia de tres bandes (greus, mitjos, aguts) i nivell general, suavitzats.
  const bands = { bass: 0, mid: 0, high: 0, level: 0 }, spectrum = new Uint8Array(1024);
  function listen() {
    analyser.getByteFrequencyData(spectrum);
    const binHz = audioCtx.sampleRate / analyser.fftSize, avg = (a, b) => { let s = 0, n = 0; for (let i = Math.floor(a / binHz); i <= Math.floor(b / binHz) && i < spectrum.length; i++) { s += spectrum[i]; n++; } return n ? s / n / 255 : 0; };
    const now = { bass: avg(30, 160), mid: avg(300, 2000), high: avg(4000, 12000) };
    now.level = (now.bass + now.mid + now.high) / 3;
    for (const key of Object.keys(bands)) bands[key] += (now[key] - bands[key]) * (now[key] > bands[key] ? .5 : .12);
  }

  // ── Fotogrames ────────────────────────────────────────────────────────
  function hitsAt(t) {
    // Cops dels últims 0,9 s (cerca binària a la llista ordenada de la partitura).
    const list = song.hits, from = t - .9;
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid][0] < from) lo = mid + 1; else hi = mid; }
    const out = [];
    for (let i = lo; i < list.length && list[i][0] <= t + .02; i++) out.push({ row: list[i][1], age: Math.max(0, t - list[i][0]) });
    return out;
  }
  function overlay(w, h, hits) {
    const s = Math.min(w, h);
    ctx.globalCompositeOperation = 'source-over';
    // Nom de la cançó, a dalt i centrat, en blanc.
    const title = ui.title.value.trim();
    if (title) {
      ctx.font = `${Math.round(s * 0.055)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = s * 0.02; ctx.fillStyle = '#ffffff';
      let size = Math.round(s * 0.055);
      while (ctx.measureText(title).width > w * 0.9 && size > 12) { size -= 2; ctx.font = `${size}px ${FONT}`; }
      ctx.fillText(title, w / 2, h * 0.05);
    }
    // Nom del projecte, sempre a baix a la dreta.
    ctx.font = `${Math.round(s * 0.04)}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = s * 0.015; ctx.fillStyle = '#ffffff';
    ctx.fillText(PROJECT, w - s * 0.04, h - s * 0.035);
    ctx.shadowBlur = 0;
    // Instruments que sonen ara: cada un al seu lloc (a baix a l'esquerra), del seu color, s'encén quan sona.
    const now = new Map();
    for (const hit of hits) if (hit.age < .35) now.set(hit.row, Math.max(now.get(hit.row) ?? 0, 1 - hit.age / .35));
    ctx.font = `${Math.round(s * 0.026)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const rows = song.names.length;
    for (const [row, glow] of now) {
      ctx.fillStyle = `hsla(${hueOf(row)}, 100%, ${55 + glow * 20}%, ${0.35 + glow * 0.65})`;
      ctx.fillText(song.names[row] || '', s * 0.04, h - s * 0.035 - (rows - 1 - row) * s * 0.034);
    }
  }
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (!song) return;
    const dt = Math.min(.1, last ? (now - last) / 1000 : 1 / 60); last = now;
    listen();
    const t = position(), hits = hitsAt(t);
    const design = DESIGNS[ui.design.value] || DESIGNS.infinit;
    design.draw(sceneCtx, scene.width, scene.height, { t, dt, ...bands, hits }, state);
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(scene, 0, 0); ctx.globalCompositeOperation = 'source-over';
    overlay(canvas.width, canvas.height, hits);
    ui.time.textContent = `${clock(t)} / ${clock(buffer.duration)}`;
    if (recorder) ui.status.textContent = `● Gravant el vídeo… ${clock(t)} / ${clock(buffer.duration)} (no canviïs de pestanya)`;
  }

  // ── Exportació a vídeo: llenç + àudio original, en temps real ──────────
  // Primer MP4 amb H.264 i AAC (el que obren tots els reproductors i editors de vídeo), després qualsevol MP4 i, si no, WebM.
  const TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a',
    'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  function startRecording() {
    if (!window.MediaRecorder || !canvas.captureStream) { ui.status.textContent = 'Aquest navegador no pot gravar vídeo. Prova-ho amb Chrome, Edge o Safari.'; return; }
    const type = TYPES.find(t => MediaRecorder.isTypeSupported(t));
    if (!type) { ui.status.textContent = 'Aquest navegador no pot gravar vídeo en MP4 ni en WebM.'; return; }
    stopSource(); offset = 0; resize(); state.sparks = [];
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...recordDest.stream.getAudioTracks()]);
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 256_000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const keep = recorder?.keep; recorder = null;
      ui.record.textContent = '● Grava vídeo'; ui.format.disabled = ui.design.disabled = false;
      if (!keep) { ui.status.textContent = 'Gravació cancel·lada.'; return; }
      const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm', blob = new Blob(chunks, { type: type.split(';')[0] });
      const name = `${(ui.title.value.trim() || 'batucada').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'batucada'} - ${PROJECT.replace('!', '')}.${ext}`;
      const link = $('a', { href: URL.createObjectURL(blob), download: name });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      ui.status.textContent = ext === 'mp4' ? `Vídeo desat: ${name}` : `Vídeo desat en WebM (aquest navegador no grava MP4): ${name}`;
    };
    recorder.keep = false;
    recorder.start(1000);
    ui.record.textContent = '■ Atura i desa'; ui.format.disabled = ui.design.disabled = true;
    play();
  }
  // Atura la gravació i desa el vídeo (al final de la cançó o amb el botó); en tancar, es cancel·la.
  function stopRecording(cancel) {
    if (!recorder) return;
    recorder.keep = !cancel;
    if (playing) pause();
    if (recorder.state !== 'inactive') recorder.stop();
  }

  // ── Obrir i tancar ────────────────────────────────────────────────────
  async function open(input) {
    if (!root) build();
    root.hidden = false; document.body.classList.add('vtc-open');
    ui.status.textContent = 'Preparant la cançó…';
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!analyser) {
      analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .6;
      recordDest = audioCtx.createMediaStreamDestination();
      analyser.connect(audioCtx.destination); analyser.connect(recordDest);
    }
    stopSource(); offset = 0; state.sparks = [];
    const data = await (await fetch(input.url)).arrayBuffer();
    buffer = await audioCtx.decodeAudioData(data);
    song = { id: input.id, hits: input.hits || [], names: input.names || [] };
    ui.title.value = store.get(`vatucalla-title-${input.id}`) ?? input.title ?? '';
    resize();
    ui.status.textContent = '';
    if (!frame) frame = requestAnimationFrame(draw);
    root.focus?.();
    root.requestFullscreen?.().catch(() => {});
    play();
  }
  function close() {
    if (recorder) stopRecording(true);
    stopSource(); offset = 0;
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (document.fullscreenElement) document.exitFullscreen?.();
    root.hidden = true; document.body.classList.remove('vtc-open');
  }

  window.VaTuCalla = { open, close, DESIGNS, PROJECT };
})();
