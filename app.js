(() => {
  'use strict';
  const engine = window.ElTaulerRadioAmbient;
  const $ = id => document.getElementById(id);
  const KEY = 'skagenerator.song.v1', RATE = 22050;
  const colors = { intro: '#90b8ad', verse: '#bab4d8', prechorus: '#d2b19a', chorus: '#e6b572', bridge: '#91b4cf', solo: '#c1bf8c', outro: '#aebc91' };
  const noteNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const id = () => window.crypto.randomUUID();
  const seed = () => window.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  const makePart = type => ({ id: id(), type, bars: engine.SONG_PARTS[type].bars, energy: engine.SONG_PARTS[type].energy, lyrics: '', generated: false, revision: 1 });
  const newSong = () => ({ version: 1, title: 'Nova cançó', settings: { style: 'ska', bpm: 112, tonic: 0, mode: 'major', seed: seed() }, parts: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'].map(makePart), chorusRevision: 1 });
  function validateSong(value) {
    if (!value || value.version !== 1 || typeof value.title !== 'string' || value.title.length > 100 || !value.settings
      || !Number.isInteger(value.settings.seed) || value.settings.seed < 1 || value.settings.seed > 4294967295
      || !Array.isArray(value.parts) || !value.parts.length || value.parts.length > 16
      || !Number.isInteger(value.chorusRevision) || value.chorusRevision < 1 || value.chorusRevision > 1000000) throw new Error('Projecte no vàlid');
    const seen = new Set();
    for (const part of value.parts) {
      if (!part || typeof part.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(part.id) || seen.has(part.id)
        || typeof part.lyrics !== 'string' || part.lyrics.length > 5000 || typeof part.generated !== 'boolean'
        || !Number.isInteger(part.revision) || part.revision < 1 || part.revision > 1000000) throw new Error('Secció no vàlida');
      seen.add(part.id);
      engine.composeSongPart(value.settings, part);
    }
    return value;
  }
  let song = newSong(), storageAvailable = true;
  try { const saved = localStorage.getItem(KEY); if (saved) song = validateSong(JSON.parse(saved)); }
  catch { storageAvailable = false; }
  let selected = song.parts[0].id, busy = false, cache = new Map(), context, source, playbackGain, playToken = 0, animation;
  let playStarted = 0, playSeconds = 0, isPlaying = false, playingPart = null, noticeTimer;
  const current = () => song.parts.find(p => p.id === selected) || song.parts[0];
  const seconds = p => p.bars * 4 * 60 / song.settings.bpm;
  const totalSeconds = () => song.parts.reduce((sum, p) => sum + seconds(p), 0);
  const time = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  const partLabel = p => {
    const peers = song.parts.filter(q => q.type === p.type);
    return engine.SONG_PARTS[p.type].name + (peers.length > 1 ? ` ${peers.findIndex(q => q.id === p.id) + 1}` : '');
  };
  function notify(message) {
    $('notice').textContent = message; $('notice').classList.add('visible');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 4500);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(song)); storageAvailable = true; $('save-state').textContent = 'Esborrany desat'; }
    catch { storageAvailable = false; $('save-state').textContent = 'Desament no disponible'; notify('No s’ha pogut desar al navegador. Desa el projecte per conservar-lo.'); }
  }
  function ask(title, message) {
    const dialog = $('confirm-dialog');
    if (dialog.open) return Promise.resolve(false);
    $('confirm-title').textContent = title; $('confirm-message').textContent = message; dialog.returnValue = 'cancel';
    return new Promise(resolve => { dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }); dialog.showModal(); });
  }
  for (const mode of ['major', 'minor']) for (let n = 0; n < 12; n++) {
    const option = document.createElement('option'); option.value = `${n}:${mode}`; option.textContent = `${noteNames[n]} ${mode === 'major' ? 'major' : 'menor'}`; $('song-key').append(option);
  }
  function updateSettingsUI() {
    $('song-title').value = song.title; $('song-style').value = song.settings.style;
    $('song-bpm').value = song.settings.bpm; $('song-key').value = `${song.settings.tonic}:${song.settings.mode}`;
  }
  function render() {
    const part = current(), position = song.parts.indexOf(part), ready = song.parts.filter(p => p.generated).length;
    const allReady = ready === song.parts.length;
    $('timeline').replaceChildren(); $('section-list').replaceChildren();
    song.parts.forEach((p, i) => {
      const block = document.createElement('button'); block.className = `timeline-block${p.generated ? ' ready' : ''}${p.id === selected ? ' selected' : ''}`;
      block.style.setProperty('--color', colors[p.type]); block.style.setProperty('--bars', p.bars);
      block.setAttribute('aria-pressed', String(p.id === selected)); block.setAttribute('aria-label', `${partLabel(p)}, ${p.bars} compassos, ${p.generated ? 'generada' : 'pendent'}`);
      const title = document.createElement('strong'); title.textContent = partLabel(p);
      const info = document.createElement('span'); info.textContent = `${p.bars} comp. ${p.generated ? '✓' : ''}`;
      block.append(title, info); block.disabled = busy; block.addEventListener('click', () => select(p.id)); $('timeline').append(block);
      const li = document.createElement('li'), button = document.createElement('button'); button.className = `section-row${p.id === selected ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(p.id === selected)); button.disabled = busy; button.style.setProperty('--color', colors[p.type]);
      const number = document.createElement('span'); number.className = 'section-number'; number.textContent = String(i + 1).padStart(2, '0');
      const text = document.createElement('span'), name = document.createElement('strong'), sub = document.createElement('small'); name.textContent = partLabel(p); sub.textContent = `${p.bars} compassos · ${time(seconds(p))}`; text.append(name, sub);
      const status = document.createElement('span'); status.className = p.generated ? 'row-status' : 'pending-circle'; status.setAttribute('aria-label', p.generated ? 'Generada' : 'Pendent'); status.textContent = p.generated ? '✓' : '';
      button.append(number, text, status); button.addEventListener('click', () => select(p.id)); li.append(button); $('section-list').append(li);
    });
    $('part-count').textContent = `${song.parts.length} parts`;
    $('duration-total').textContent = `${song.parts.reduce((s, p) => s + p.bars, 0)} compassos · ${time(totalSeconds())}`;
    $('part-position').textContent = `PART ${String(position + 1).padStart(2, '0')} / ${String(song.parts.length).padStart(2, '0')}`;
    $('part-title').textContent = partLabel(part); $('part-description').textContent = engine.SONG_PARTS[part.type].description;
    $('part-status').textContent = busy ? 'Preparant el so…' : part.generated ? 'Generada ✓' : 'Per començar'; $('part-status').className = `part-badge${part.generated ? ' ready' : ''}`;
    $('part-bars').value = part.bars; $('part-energy').value = part.energy; $('energy-value').textContent = `${part.energy} %`;
    $('part-lyrics').value = part.lyrics; $('part-duration').textContent = time(seconds(part));
    $('generate-label').textContent = busy ? 'Preparant el so…' : part.generated ? 'Genera una altra versió' : `Genera ${part.type === 'intro' ? 'la intro' : part.type === 'verse' ? 'l’estrofa' : part.type === 'chorus' ? 'la tornada' : part.type === 'outro' ? 'el final' : part.type === 'bridge' ? 'el pont' : part.type === 'solo' ? 'l’instrumental' : 'la pretornada'}`;
    $('sound-preview').classList.toggle('ready', part.generated);
    $('preview-label').textContent = part.generated ? 'La teva música · vista de l’àudio' : position === 0 ? 'El primer compàs comença aquí.' : 'Una nova part per donar forma a la cançó.';
    $('section-hint').textContent = part.type === 'chorus' ? 'Les tornades comparteixen el motiu. Una nova versió actualitza també les tornades ja generades.' : 'Genera, escolta i prova una altra versió fins que trobis la que t’agrada.';
    $('transport-title').textContent = song.title || 'Nova cançó'; $('ready-count').textContent = `${ready} de ${song.parts.length} parts generades`;
    if (!isPlaying) $('transport-subtitle').textContent = allReady ? 'La cançó està a punt per escoltar' : ready ? 'Continua amb les parts pendents' : 'Comença generant la intro';
    if (!isPlaying) $('playback-duration').textContent = time(totalSeconds());
    $('next-part').textContent = position === song.parts.length - 1 ? 'Torna a la intro ↗' : 'Següent part →';
    const locked = ['new-song', 'song-title', 'song-style', 'song-bpm', 'song-key', 'part-bars', 'part-energy', 'part-lyrics', 'generate-part', 'next-part', 'add-type', 'import-project', 'export-project'];
    locked.forEach(key => $(key).disabled = busy);
    $('add-part').disabled = busy || song.parts.length >= 16;
    $('move-up').disabled = busy || position === 0; $('move-down').disabled = busy || position === song.parts.length - 1;
    $('remove-part').disabled = busy || song.parts.length === 1;
    $('play-part').disabled = busy || !part.generated; $('play-song').disabled = busy || !allReady;
    $('download-song').disabled = busy || !allReady; $('stop-playback').disabled = !isPlaying && !busy;
    document.body.classList.toggle('busy', busy);
    renderWave(part);
  }
  function renderWave(part) {
    const wave = $('waveform'); wave.replaceChildren(); const data = cache.get(part.id);
    for (let k = 0; k < 80; k++) {
      const bar = document.createElement('i'); let height = 8;
      if (data) {
        let peak = 0; const start = Math.floor(k * data.length / 80), end = Math.floor((k + 1) * data.length / 80);
        for (let i = start; i < end; i += 55) peak = Math.max(peak, Math.abs(data[i]));
        height = 8 + peak * 90;
      } else if (part.generated) height = 8;
      else height = 8 + Math.abs(Math.sin(k * 1.7) * Math.sin(k * .19)) * 20;
      bar.style.setProperty('--h', `${height}%`); wave.append(bar);
    }
    if (part.generated && !data) $('preview-label').textContent = 'Part desada · escolta-la per mostrar l’àudio';
  }
  function select(partId) { if (busy) return; selected = partId; render(); }
  function setBusy(value) { busy = value; render(); }
  function invalidate(part) { part.generated = false; cache.delete(part.id); stop(); }
  async function getSamples(part) {
    if (!cache.has(part.id)) cache.set(part.id, await engine.songPartSamples(engine.composeSongPart(song.settings, part), RATE));
    return cache.get(part.id);
  }
  async function generate() {
    if (busy) return; stop(); const part = current();
    const revision = part.type === 'chorus' ? (part.generated ? song.chorusRevision + 1 : song.chorusRevision) : (part.generated ? part.revision + 1 : part.revision);
    setBusy(true);
    try {
      const data = await engine.songPartSamples(engine.composeSongPart(song.settings, { ...part, revision }), RATE);
      if (part.type === 'chorus') {
        song.chorusRevision = revision;
        song.parts.filter(p => p.type === 'chorus').forEach(p => { p.revision = revision; cache.delete(p.id); });
      }
      part.revision = revision; part.generated = true; cache.set(part.id, data); save();
      notify(`${partLabel(part)} generada. Ja la pots escoltar.`);
    } catch (error) { console.error(error); notify('No s’ha pogut generar la part. Torna-ho a provar.'); }
    finally { setBusy(false); }
  }
  function stop() {
    playToken++; if (source) { source.onended = null; try { source.stop(); } catch {} source = null; }
    if (playbackGain) { playbackGain.disconnect(); playbackGain = null; }
    cancelAnimationFrame(animation); isPlaying = false; playingPart = null; document.body.classList.remove('playing');
    $('song-progress').value = 0; $('playback-time').textContent = '00:00'; $('play-song').textContent = '▶'; $('stop-playback').disabled = !busy;
    $('playback-duration').textContent = time(totalSeconds());
  }
  function join(parts) {
    const length = parts.reduce((sum, p) => sum + p.length, 0), data = new Float32Array(length); let offset = 0;
    parts.forEach(p => { data.set(p, offset); offset += p.length; }); return data;
  }
  async function play(whole) {
    if (isPlaying && whole) { stop(); render(); return; }
    if (busy) return; stop(); const token = playToken; const part = current();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { notify('Aquest navegador no admet la reproducció d’àudio.'); return; }
    try {
      // Creació i resume dins del clic per respectar el permís d’àudio en mòbils.
      context ||= new Audio(); const resume = context.resume(); setBusy(true); await resume;
      const data = whole ? join(await collectSamples()) : await getSamples(part);
      if (token !== playToken) return;
      const buffer = context.createBuffer(1, data.length, RATE); buffer.copyToChannel(data, 0);
      source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
      const gain = playbackGain = context.createGain(); gain.gain.value = .8; source.disconnect(); source.connect(gain); gain.connect(context.destination);
      source.onended = () => { if (token === playToken) { gain.disconnect(); stop(); render(); } };
      playStarted = context.currentTime; playSeconds = data.length / RATE; playingPart = whole ? null : part.id;
      isPlaying = true; source.start(); document.body.classList.add('playing');
      $('transport-subtitle').textContent = whole ? 'Escoltant la cançó completa' : `Escoltant · ${partLabel(part)}`;
      $('play-song').textContent = '■'; $('playback-duration').textContent = time(playSeconds);
      const tick = () => {
        if (!isPlaying) return;
        const elapsed = Math.min(playSeconds, context.currentTime - playStarted);
        $('song-progress').value = elapsed / playSeconds; $('playback-time').textContent = time(elapsed);
        if (whole) {
          let offset = 0; const active = song.parts.find(p => { offset += seconds(p); return elapsed < offset; });
          if (active) $('transport-subtitle').textContent = `Escoltant · ${partLabel(active)}`;
        }
        animation = requestAnimationFrame(tick);
      }; tick();
    } catch (error) { console.error(error); stop(); notify('No s’ha pogut reproduir l’àudio. Torna a prémer Escolta.'); }
    finally { setBusy(false); }
  }
  async function collectSamples() {
    const result = [];
    for (const part of song.parts) result.push(await getSamples(part));
    return result;
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function fileName() { return (song.title || 'nova-canco').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase().slice(0, 90); }
  async function downloadWav() {
    if (busy || song.parts.some(p => !p.generated)) return;
    stop(); setBusy(true);
    try {
      const data = join(await collectSamples()), wav = new ArrayBuffer(44 + data.length * 2), view = new DataView(wav);
      const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
      ascii(0, 'RIFF'); view.setUint32(4, 36 + data.length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, data.length * 2, true);
      for (let i = 0; i < data.length; i++) { const n = Math.max(-1, Math.min(1, data[i])); view.setInt16(44 + i * 2, n * (n < 0 ? 32768 : 32767), true); }
      download(new Blob([wav], { type: 'audio/wav' }), `${fileName()}.wav`); notify('Cançó exportada en format WAV.');
    } catch (error) { console.error(error); notify('No s’ha pogut exportar la cançó.'); }
    finally { setBusy(false); }
  }
  $('generate-part').addEventListener('click', generate); $('play-part').addEventListener('click', () => play(false)); $('play-song').addEventListener('click', () => play(true));
  $('stop-playback').addEventListener('click', () => { stop(); render(); }); $('download-song').addEventListener('click', downloadWav);
  $('next-part').addEventListener('click', () => { const i = song.parts.indexOf(current()); select(song.parts[(i + 1) % song.parts.length].id); });
  $('song-title').addEventListener('input', event => { song.title = event.target.value; $('transport-title').textContent = song.title || 'Nova cançó'; save(); });
  async function changeSettings() {
    const [tonic, mode] = $('song-key').value.split(':'), bpm = Number($('song-bpm').value);
    const settings = { ...song.settings, style: $('song-style').value, bpm, tonic: Number(tonic), mode };
    if (!Number.isInteger(bpm) || bpm < 60 || bpm > 180) { notify('Tria un tempo entre 60 i 180 BPM.'); updateSettingsUI(); return; }
    if (JSON.stringify(settings) === JSON.stringify(song.settings)) return;
    updateSettingsUI();
    if (song.parts.some(p => p.generated) && !await ask('Canviar la base musical?', 'Les parts generades tornaran a quedar pendents per compartir el nou tempo, estil i tonalitat. La lletra es conservarà.')) return;
    stop(); song.settings = settings; song.parts.forEach(p => { p.generated = false; }); cache.clear(); updateSettingsUI(); save(); render();
  }
  ['song-style', 'song-bpm', 'song-key'].forEach(key => $(key).addEventListener('change', changeSettings));
  $('part-bars').addEventListener('change', event => { const p = current(); p.bars = Number(event.target.value); invalidate(p); save(); render(); });
  $('part-energy').addEventListener('input', event => { $('energy-value').textContent = `${event.target.value} %`; });
  $('part-energy').addEventListener('change', event => { const p = current(); p.energy = Number(event.target.value); invalidate(p); save(); render(); });
  $('part-lyrics').addEventListener('input', event => { current().lyrics = event.target.value; save(); });
  $('add-part').addEventListener('click', () => { if (song.parts.length >= 16) return; stop(); const p = makePart($('add-type').value); if (p.type === 'chorus') p.revision = song.chorusRevision; song.parts.splice(song.parts.indexOf(current()) + 1, 0, p); selected = p.id; save(); render(); });
  function move(delta) { stop(); const i = song.parts.indexOf(current()), j = i + delta; if (j < 0 || j >= song.parts.length) return; [song.parts[i], song.parts[j]] = [song.parts[j], song.parts[i]]; save(); render(); }
  $('move-up').addEventListener('click', () => move(-1)); $('move-down').addEventListener('click', () => move(1));
  $('remove-part').addEventListener('click', async () => {
    const p = current(); if (song.parts.length === 1) return;
    if ((p.generated || p.lyrics) && !await ask(`Eliminar ${partLabel(p).toLowerCase()}?`, 'S’eliminaran aquesta part i les seves anotacions. La resta de la cançó es conservarà.')) return;
    stop(); const i = song.parts.indexOf(p); song.parts.splice(i, 1); cache.delete(p.id); selected = song.parts[Math.min(i, song.parts.length - 1)].id; save(); render();
  });
  $('new-song').addEventListener('click', async () => {
    if ((song.parts.some(p => p.generated || p.lyrics) || song.title !== 'Nova cançó') && !await ask('Començar una cançó nova?', 'Es reemplaçarà l’esborrany actual. Desa primer el projecte si el vols recuperar després.')) return;
    stop(); song = newSong(); selected = song.parts[0].id; cache.clear(); updateSettingsUI(); save(); render();
  });
  $('export-project').addEventListener('click', () => { download(new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' }), `${fileName()}.json`); notify('Projecte desat amb les parts, la lletra i la configuració musical.'); });
  $('import-project').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 200000) throw new Error('Fitxer massa gran');
      const imported = validateSong(JSON.parse(await file.text()));
      if (!await ask('Obrir aquest projecte?', 'El projecte importat reemplaçarà l’esborrany actual.')) return;
      stop(); song = imported; selected = song.parts[0].id; cache.clear(); updateSettingsUI(); save(); render(); notify('Projecte obert. Les parts desades estan a punt per escoltar.');
    } catch { notify('Aquest fitxer no és un projecte vàlid de Ska Generator.'); }
  });
  window.addEventListener('pagehide', stop);
  updateSettingsUI(); render();
  if (!storageAvailable) notify('No s’ha pogut recuperar l’esborrany. Obre un projecte desat o comença una cançó nova.');
})();
