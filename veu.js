(() => {
  'use strict';
  // Gravació de la teva veu, síl·laba a síl·laba, per fer-la cantar (singing/voicebank.py).
  // Cada síl·laba es canta a la mateixa nota, sostinguda i a volum constant. Les gravacions es
  // desen en aquest navegador (IndexedDB) i s'exporten en un ZIP amb un manifest.json.
  const $ = id => document.getElementById(id);

  // ── Llista de síl·labes (català central) ──────────────────────────────
  // Símbols: vocals a e(é) E(è) i o(ó) O(ò) u @(ə); consonants p b t d k g f s z S(x) Z(j) tS(tx)
  // dZ(tj) m n J(ny) l L(ll) r(rr) R(r suau); semivocals j w.
  const VOWELS = [['a', 'a'], ['e', 'é'], ['E', 'è'], ['i', 'i'], ['o', 'ó'], ['O', 'ò'], ['u', 'u'], ['@', 'ə']];
  const CLUSTER_VOWELS = ['a', 'E', 'i', 'O', 'u', '@'];
  const ONSETS = [['p', 'p'], ['b', 'b'], ['t', 't'], ['d', 'd'], ['k', 'k'], ['g', 'g'], ['f', 'f'], ['s', 's'], ['z', 'z'], ['S', 'x'], ['Z', 'j'],
    ['tS', 'tx'], ['dZ', 'tj'], ['m', 'm'], ['n', 'n'], ['J', 'ny'], ['l', 'l'], ['L', 'll'], ['r', 'rr'], ['R', 'r']];
  const CLUSTERS = [['p', 'R'], ['b', 'R'], ['t', 'R'], ['d', 'R'], ['k', 'R'], ['g', 'R'], ['f', 'R'], ['p', 'l'], ['b', 'l'], ['k', 'l'], ['g', 'l'], ['f', 'l']];
  const CODAS = [['l', 'l'], ['n', 'n'], ['m', 'm'], ['s', 's'], ['t', 't'], ['k', 'k'], ['p', 'p'], ['R', 'r'], ['S', 'ix'], ['tS', 'tx'], ['j', 'i'], ['w', 'u']];
  const spell = Object.fromEntries([...ONSETS, ['j', 'i'], ['w', 'u']]);
  const vowelText = Object.fromEntries(VOWELS);
  const HINTS = { k: 'k com a «casa»', g: 'g com a «gat»', z: 'z com a «zero» (brunzida)', S: 'x com a «xarxa»', Z: 'j com a «jo»', tS: 'tx com a «cotxe»',
    dZ: 'tj com a «platja»', J: 'ny com a «canya»', L: 'll com a «lluna»', r: 'rr forta com a «rosa»', R: 'r suau com a «cara»', '@': 'ə: vocal neutra, la a de «casa»',
    e: 'é tancada, com a «mes»', E: 'è oberta, com a «cel»', o: 'ó tancada, com a «molt»', O: 'ò oberta, com a «sol»' };
  const items = [];
  for (const [v, vt] of VOWELS) items.push({ id: `V-${v}`, kind: 'V', onset: [], vowel: v, coda: [], text: vt });
  for (const [c, ct] of ONSETS) for (const [v, vt] of VOWELS) items.push({ id: `CV-${c}-${v}`, kind: 'CV', onset: [c], vowel: v, coda: [], text: ct + vt });
  for (const [c1, c2] of CLUSTERS) for (const v of CLUSTER_VOWELS) items.push({ id: `CCV-${c1}${c2}-${v}`, kind: 'CCV', onset: [c1, c2], vowel: v, coda: [], text: spell[c1] + spell[c2] + vowelText[v] });
  for (const [v, vt] of VOWELS) for (const [c, ct] of CODAS) {
    if ((c === 'j' && v === 'i') || (c === 'w' && v === 'u')) continue;
    items.push({ id: `VC-${v}-${c}`, kind: 'VC', onset: [], vowel: v, coda: [c], text: vt + ct });
  }
  const hintOf = item => [...item.onset, item.vowel, ...item.coda].map(s => HINTS[s]).filter(Boolean).join(' · ');
  const KIND = { V: 'Vocals soles', CV: 'Consonant + vocal', CCV: 'Grups (pr, bl…) + vocal', VC: 'Vocal + final' };

  // ── Desament (IndexedDB) ──────────────────────────────────────────────
  const DB = 'radiospam-veu', STORE = 'samples';
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result); t.onerror = () => reject(t.error);
  }); };
  const put = (key, value) => tx('readwrite', s => s.put(value, key));
  const get = key => tx('readonly', s => s.get(key));
  const del = key => tx('readwrite', s => s.delete(key));
  const keys = () => tx('readonly', s => s.getAllKeys());

  // ── Àudio ─────────────────────────────────────────────────────────────
  let ctx, stream, recorded = new Set(), index = 0, note = 55, busy = false, chain = false, stopChain = false;
  const NOTE_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const noteName = m => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  async function ensureAudio() {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') await ctx.resume();
    stream ||= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  }
  function tone(seconds = .8) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = 'triangle'; o.frequency.value = hz(note);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + .03); g.gain.setValueAtTime(.25, t + seconds - .08); g.gain.linearRampToValueAtTime(0, t + seconds);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + seconds);
    return new Promise(resolve => setTimeout(resolve, seconds * 1000 + 150));
  }
  // Captura amb un ScriptProcessor (funciona a tots els navegadors mòbils).
  function capture(seconds, onLevel) {
    return new Promise(resolve => {
      const source = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(2048, 1, 1), mute = ctx.createGain();
      mute.gain.value = 0; const chunks = []; let total = 0; const need = Math.round(seconds * ctx.sampleRate);
      proc.onaudioprocess = event => {
        const data = new Float32Array(event.inputBuffer.getChannelData(0)); chunks.push(data); total += data.length;
        let peak = 0; for (const x of data) peak = Math.max(peak, Math.abs(x)); onLevel?.(peak, total / need);
        if (total >= need) {
          proc.disconnect(); source.disconnect(); mute.disconnect();
          const out = new Float32Array(total); let at = 0; for (const c of chunks) { out.set(c, at); at += c.length; }
          resolve(out);
        }
      };
      source.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    });
  }
  async function play(data, rate) {
    await ensureAudio();
    const buffer = ctx.createBuffer(1, data.length, rate); buffer.copyToChannel(data, 0);
    const s = ctx.createBufferSource(); s.buffer = buffer; s.connect(ctx.destination); s.start();
  }

  // ── Pantalla ──────────────────────────────────────────────────────────
  function render() {
    const item = items[index];
    $('veu-count').textContent = `${recorded.size} de ${items.length}`;
    $('veu-progress').style.width = `${recorded.size / items.length * 100}%`;
    $('veu-kind').textContent = `${KIND[item.kind]} · ${index + 1}/${items.length}`;
    $('veu-text').textContent = item.text;
    $('veu-hint').textContent = hintOf(item);
    $('veu-state').textContent = recorded.has(item.id) ? '✓ Gravada' : 'Pendent';
    $('veu-state').classList.toggle('ok', recorded.has(item.id));
    $('veu-play').disabled = !recorded.has(item.id) || busy;
    $('veu-record').disabled = busy && !chain;
    $('veu-record').textContent = chain ? '■ Atura' : '● Grava';
    $('veu-chain').disabled = busy;
    $('veu-prev').disabled = busy || index === 0; $('veu-next').disabled = busy || index === items.length - 1;
    $('veu-note').textContent = noteName(note);
    $('veu-export').disabled = !recorded.size || busy;
    const list = $('veu-list'); list.replaceChildren();
    let group = '';
    items.forEach((it, i) => {
      if (it.kind !== group) { group = it.kind; const h = document.createElement('p'); h.className = 'veu-group'; h.textContent = KIND[group]; list.append(h); }
      const b = document.createElement('button'); b.type = 'button'; b.textContent = it.text;
      b.className = `veu-chip${recorded.has(it.id) ? ' done' : ''}${i === index ? ' now' : ''}`;
      b.addEventListener('click', () => { if (!busy) { index = i; render(); } }); list.append(b);
    });
  }
  function level(peak, progress) {
    $('veu-meter').style.width = `${Math.min(100, Math.round(peak * 140))}%`;
    $('veu-meter').classList.toggle('hot', peak > .95);
    $('veu-timer').style.width = `${Math.round(progress * 100)}%`;
  }
  async function recordOne() {
    const item = items[index];
    await ensureAudio();
    $('veu-msg').textContent = `Escolta la nota (${noteName(note)})…`;
    await tone();
    $('veu-msg').textContent = `Canta «${item.text}» sostingut, a la mateixa nota`;
    const data = await capture(2.2, level);
    let peak = 0; for (const x of data) peak = Math.max(peak, Math.abs(x));
    level(0, 0);
    if (peak < .02) { $('veu-msg').textContent = 'No s’ha sentit res: apropa’t al micròfon i torna-ho a provar.'; return false; }
    await put(item.id, { rate: ctx.sampleRate, data });
    recorded.add(item.id);
    $('veu-msg').textContent = peak > .98 ? 'Gravada, però satura: canta una mica més fluix o allunya’t.' : 'Gravada. Escolta-la o passa a la següent.';
    return true;
  }
  async function onRecord() {
    if (chain) { stopChain = true; return; }
    busy = true; render();
    try { if (await recordOne() && index < items.length - 1) index++; }
    catch (error) { $('veu-msg').textContent = `No s’ha pogut gravar: ${error.message || error}`; }
    finally { busy = false; render(); }
  }
  async function onChain() {
    chain = true; stopChain = false; busy = true; render();
    try {
      while (!stopChain && index < items.length) {
        const ok = await recordOne();
        if (!ok || stopChain) break;
        if (index === items.length - 1) break;
        index++; render(); await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) { $('veu-msg').textContent = `No s’ha pogut gravar: ${error.message || error}`; }
    finally { chain = false; busy = false; render(); }
  }

  // ── Exportació: ZIP (sense compressió) amb WAV de 44,1 kHz i manifest.json ──
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = bytes => { let c = 0xFFFFFFFF; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    for (const { name, data } of files) {
      const n = enc.encode(name), crc = crc32(data), head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint32(14, crc, true);
      head.setUint32(18, data.length, true); head.setUint32(22, data.length, true); head.setUint16(26, n.length, true);
      parts.push(new Uint8Array(head.buffer), n, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), n);
      offset += 30 + n.length + data.length;
    }
    const size = central.reduce((t, p) => t + p.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }
  function wav(data, rate) {
    const view = new DataView(new ArrayBuffer(44 + data.length * 2)), ascii = (o, t) => [...t].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
    ascii(0, 'RIFF'); view.setUint32(4, 36 + data.length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, data.length * 2, true);
    data.forEach((x, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 32767, true));
    return new Uint8Array(view.buffer);
  }
  async function resample(data, rate) {
    if (rate === 44100) return data;
    const off = new OfflineAudioContext(1, Math.round(data.length * 44100 / rate), 44100);
    const buffer = off.createBuffer(1, data.length, rate); buffer.copyToChannel(data, 0);
    const s = off.createBufferSource(); s.buffer = buffer; s.connect(off.destination); s.start();
    return (await off.startRendering()).getChannelData(0);
  }
  // Treu el silenci d'abans i de després (deixa 80 ms i 150 ms de marge).
  function trim(data, rate) {
    let peak = 0; for (const x of data) peak = Math.max(peak, Math.abs(x));
    const hop = Math.round(rate * .01), gate = peak * .03, loud = [];
    for (let i = 0; i + hop <= data.length; i += hop) {
      let s = 0; for (let k = i; k < i + hop; k++) s += data[k] * data[k];
      if (Math.sqrt(s / hop) > gate) loud.push(i);
    }
    if (!loud.length) return data;
    const a = Math.max(0, loud[0] - Math.round(rate * .08)), b = Math.min(data.length, loud.at(-1) + hop + Math.round(rate * .15));
    return data.subarray(a, b);
  }
  // Fitxers de com a molt 24 MB (per poder-los enviar): cada part té el seu manifest.json.
  const PART_BYTES = 24 * 1024 * 1024;
  async function onExport() {
    busy = true; render(); $('veu-msg').textContent = 'Preparant els fitxers…';
    const box = $('veu-parts'); box.replaceChildren();
    try {
      const stamp = new Date().toISOString().slice(0, 10), parts = [];
      let files = [], size = 0, samples = [];
      const flush = () => { if (samples.length) parts.push({ files, samples }); files = []; size = 0; samples = []; };
      for (const item of items) {
        if (!recorded.has(item.id)) continue;
        const rec = await get(item.id);
        const file = `${item.id}.wav`, data = wav(trim(await resample(rec.data, rec.rate), 44100), 44100);
        if (size + data.length > PART_BYTES) flush();
        files.push({ name: file, data }); samples.push({ ...item, file }); size += data.length;
      }
      flush();
      const blobs = parts.map((part, k) => {
        const manifest = { format: 'radiospam-voicebank', version: 1, language: 'ca-central', note, rate: 44100, created: new Date().toISOString(),
          part: k + 1, parts: parts.length, samples: part.samples };
        return zip([{ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) }, ...part.files]);
      });
      blobs.forEach((blob, k) => {
        const a = document.createElement('a'), name = parts.length > 1 ? `la-meva-veu-${stamp}-part${k + 1}de${parts.length}.zip` : `la-meva-veu-${stamp}.zip`;
        a.href = URL.createObjectURL(blob); a.download = name; a.className = 'btn part';
        a.textContent = `⇩ ${parts.length > 1 ? `Part ${k + 1} de ${parts.length}` : 'Fitxer'} · ${(blob.size / 1048576).toFixed(1)} MB`;
        box.append(a);
      });
      $('veu-msg').textContent = parts.length > 1 ? `Llest: ${parts.length} fitxers (cap passa de 24 MB). Baixa’ls tots.` : 'Llest: baixa el fitxer.';
    } catch (error) { $('veu-msg').textContent = `No s’ha pogut exportar: ${error.message || error}`; }
    finally { busy = false; render(); }
  }

  $('veu-record').addEventListener('click', onRecord);
  $('veu-chain').addEventListener('click', onChain);
  $('veu-play').addEventListener('click', async () => { const rec = await get(items[index].id); if (rec) play(rec.data, rec.rate); });
  $('veu-prev').addEventListener('click', () => { index = Math.max(0, index - 1); render(); });
  $('veu-next').addEventListener('click', () => { index = Math.min(items.length - 1, index + 1); render(); });
  $('veu-tone').addEventListener('click', async () => { await ensureAudio(); tone(1.2); });
  $('veu-down').addEventListener('click', () => { note = Math.max(40, note - 1); try { localStorage.setItem('radiospam.veu.note', note); } catch {} render(); });
  $('veu-up').addEventListener('click', () => { note = Math.min(72, note + 1); try { localStorage.setItem('radiospam.veu.note', note); } catch {} render(); });
  $('veu-export').addEventListener('click', onExport);
  $('veu-delete').addEventListener('click', async () => {
    if (!recorded.has(items[index].id) || !confirm(`Esborrar la gravació de «${items[index].text}»?`)) return;
    await del(items[index].id); recorded.delete(items[index].id); render();
  });
  try { note = Number(localStorage.getItem('radiospam.veu.note')) || note; } catch {}
  keys().then(list => { recorded = new Set(list); index = Math.max(0, items.findIndex(it => !recorded.has(it.id))); render(); }).catch(() => render());
  render();
  window.RadioSpamVoice = { items };
})();
