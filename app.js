(() => {
  'use strict';
  const engine = window.ElTaulerRadioAmbient;
  const $ = id => document.getElementById(id);
  const KEY = 'skagenerator.song.v1', RATE = 44100;
  const sampleAudio = window.SkaSampleAudio, audioUtils = window.SkaAudioUtils;
  const colors = { intro: '#90b8ad', verse: '#bab4d8', prechorus: '#d2b19a', chorus: '#e6b572', bridge: '#91b4cf', solo: '#c1bf8c', outro: '#aebc91' };
  const noteNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const id = () => window.crypto.randomUUID();
  const seed = () => window.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  const makePart = type => ({ id: id(), type, bars: engine.SONG_PARTS[type].bars, energy: engine.SONG_PARTS[type].energy, lyrics: '', generated: false, revision: 1 });
  const fiveVersions = part => ['intro', 'verse', 'chorus'].includes(part.type);
  let recoveredMigration = false;
  const newSong = () => ({ version: 1, title: 'Nova cançó', settings: { style: 'ska', bpm: 128, tonic: 0, mode: 'major', seed: seed(), instruments: engine.SONG_STYLES.ska.instruments.slice() }, parts: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'].map(makePart), chorusRevision: 1 });
  function validateSong(value) {
    if (!value || value.version !== 1 || typeof value.title !== 'string' || value.title.length > 100 || !value.settings
      || !Number.isInteger(value.settings.seed) || value.settings.seed < 1 || value.settings.seed > 4294967295
      || !Array.isArray(value.parts) || !value.parts.length || value.parts.length > 16
      || !Number.isInteger(value.chorusRevision) || value.chorusRevision < 1 || value.chorusRevision > 1000000) throw new Error('Projecte no vàlid');
    // Els projectes antics conserven la lletra i l’estructura. El nou
    // arranjament instrumental es torna a generar amb la configuració admesa.
    const legacy = value.settings.instruments === undefined || ['rumba', 'funk', 'pop'].includes(value.settings.style);
    if (legacy) {
      if (['rumba', 'funk', 'pop'].includes(value.settings.style)) value.settings.style = 'ska';
      const profile = engine.SONG_STYLES[value.settings.style];
      if (!Object.hasOwn(engine.SONG_STYLES, value.settings.style)) throw new Error('Estil no vàlid');
      if (Number.isInteger(value.settings.bpm)) value.settings.bpm = Math.max(profile.bpm.min, Math.min(profile.bpm.max, value.settings.bpm));
      if (!profile.keys.some(([tonic, mode]) => tonic === value.settings.tonic && mode === value.settings.mode)) [value.settings.tonic, value.settings.mode] = profile.keys[0];
      value.settings.instruments ||= profile.instruments.slice();
      value.parts.forEach(part => { part.generated = false; });
      recoveredMigration = true;
    }
    if (!Array.isArray(value.settings.instruments) || !value.settings.instruments.length
      || new Set(value.settings.instruments).size !== value.settings.instruments.length
      || value.settings.instruments.some(name => !Object.hasOwn(engine.SONG_INSTRUMENTS, name))) throw new Error('Instruments base no vàlids');
    const seen = new Set();
    for (const part of value.parts) {
      if (!part || typeof part.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(part.id) || seen.has(part.id)
        || typeof part.lyrics !== 'string' || part.lyrics.length > 5000 || typeof part.generated !== 'boolean'
        || !Number.isInteger(part.revision) || part.revision < 1 || part.revision > 1000000) throw new Error('Secció no vàlida');
      if (part.instruments !== undefined && (!Array.isArray(part.instruments) || !part.instruments.length
        || new Set(part.instruments).size !== part.instruments.length
        || part.instruments.some(name => !Object.hasOwn(engine.SONG_INSTRUMENTS, name)))) throw new Error('Instruments de la part no vàlids');
      if (part.variants !== undefined) {
        if (!fiveVersions(part) || !Array.isArray(part.variants) || part.variants.length !== 5
          || new Set(part.variants).size !== 5 || part.variants.some(rev => !Number.isInteger(rev) || rev < 1 || rev > 1000000)
          || !Number.isInteger(part.selectedVariant) || part.selectedVariant < 0 || part.selectedVariant > 4
          || part.revision !== part.variants[part.selectedVariant]) throw new Error('Versions de la secció no vàlides');
      } else if (part.selectedVariant !== undefined) throw new Error('Selecció de versió no vàlida');
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
  const instrumentsFor = part => part.instruments === undefined ? song.settings.instruments : part.instruments;
  const hasVersions = part => fiveVersions(part) && part.generated && Array.isArray(part.variants) && part.variants.length === 5;
  const cacheKey = (part, revision = part.revision) => `${part.id}:${revision}`;
  function clearPartCache(part) {
    for (const key of cache.keys()) if (key.startsWith(`${part.id}:`)) cache.delete(key);
  }
  function chooseVersion(part, index) {
    if (busy || !hasVersions(part) || index < 0 || index >= 5) return;
    stop(); part.selectedVariant = index; part.revision = part.variants[index]; save(); render();
    notify(`${partLabel(part)} · versió ${index + 1} escollida per a la cançó.`);
  }
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
  for (const [instrument, name] of Object.entries(engine.SONG_INSTRUMENTS)) {
    const label = document.createElement('label'); label.className = 'instrument-toggle';
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = `instrument-${instrument}`; input.value = instrument;
    const text = document.createElement('span'); text.textContent = name; label.append(input, text); $('song-instruments').append(label);
    input.addEventListener('change', changeSettings);
    const partLabelElement = document.createElement('label'); partLabelElement.className = 'instrument-toggle';
    const partInput = document.createElement('input'); partInput.type = 'checkbox'; partInput.id = `part-instrument-${instrument}`; partInput.value = instrument;
    const partName = document.createElement('span'); partName.textContent = name;
    partLabelElement.append(partInput, partName); $('part-instruments').append(partLabelElement);
    partInput.addEventListener('change', changePartInstruments);
  }
  function changePartInstruments() {
    if (busy) return;
    const part = current();
    const instruments = Object.keys(engine.SONG_INSTRUMENTS).filter(name => $(`part-instrument-${name}`).checked);
    if (!instruments.length) { notify('Cada part ha de tenir com a mínim un instrument.'); render(); return; }
    if (JSON.stringify(instruments) === JSON.stringify(instrumentsFor(part))) return;
    part.instruments = instruments;
    invalidate(part); save(); render();
  }
  $('reset-part-instruments').addEventListener('click', () => {
    if (busy || current().instruments === undefined) return;
    const part = current(); delete part.instruments; invalidate(part); save(); render();
  });
  function updateSettingsUI() {
    const profile = engine.SONG_STYLES[song.settings.style];
    $('song-title').value = song.title; $('song-style').value = song.settings.style;
    $('song-bpm').min = profile.bpm.min; $('song-bpm').max = profile.bpm.max;
    $('song-bpm').value = song.settings.bpm;
    $('song-key').replaceChildren();
    for (const [tonic, mode] of profile.keys) {
      const option = document.createElement('option'); option.value = `${tonic}:${mode}`;
      option.textContent = `${noteNames[tonic]} ${mode === 'major' ? 'major' : 'menor'}`; $('song-key').append(option);
    }
    $('song-key').value = `${song.settings.tonic}:${song.settings.mode}`;
    $('style-summary').textContent = `${profile.name} · ${profile.bpm.min}–${profile.bpm.max} BPM`;
    $('style-description').textContent = profile.description;
    for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) $(`instrument-${instrument}`).checked = song.settings.instruments.includes(instrument);
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
      const info = document.createElement('span'); info.textContent = `${p.bars} comp. · ${instrumentsFor(p).length} instr. ${p.generated ? '✓' : ''}`;
      block.append(title, info); block.disabled = busy; block.addEventListener('click', () => select(p.id)); $('timeline').append(block);
      const li = document.createElement('li'), button = document.createElement('button'); button.className = `section-row${p.id === selected ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(p.id === selected)); button.disabled = busy; button.style.setProperty('--color', colors[p.type]);
      const number = document.createElement('span'); number.className = 'section-number'; number.textContent = String(i + 1).padStart(2, '0');
      const text = document.createElement('span'), name = document.createElement('strong'), sub = document.createElement('small'); name.textContent = partLabel(p); sub.textContent = `${p.bars} compassos · ${instrumentsFor(p).length} instruments · ${time(seconds(p))}`; text.append(name, sub);
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
    for (const name of Object.keys(engine.SONG_INSTRUMENTS)) $(`part-instrument-${name}`).checked = instrumentsFor(part).includes(name);
    const custom = part.instruments !== undefined;
    $('part-instrument-mode').textContent = custom ? 'Selecció pròpia d’aquesta part' : 'Segueix els instruments base de la cançó';
    $('reset-part-instruments').hidden = !custom;
    $('reset-part-instruments').disabled = busy || !custom;
    $('generate-label').textContent = busy ? 'Preparant el so…'
      : fiveVersions(part) ? (hasVersions(part) ? 'Genera 5 versions noves' : 'Genera 5 versions diferents')
      : part.generated ? 'Genera una altra versió'
      : `Genera ${part.type === 'outro' ? 'el final' : part.type === 'bridge' ? 'el pont' : part.type === 'solo' ? 'l’instrumental' : 'la pretornada'}`;
    renderVersions(part);
    $('sound-preview').classList.toggle('ready', part.generated);
    $('preview-label').textContent = part.generated ? 'La teva música · vista de l’àudio' : position === 0 ? 'El primer compàs comença aquí.' : 'Una nova part per donar forma a la cançó.';
    $('section-hint').textContent = fiveVersions(part)
      ? 'Escolta les cinc propostes, tria’n una i serà la que es farà servir en la cançó i en el WAV.'
      : 'Genera, escolta i prova una altra versió fins que trobis la que t’agrada.';
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
    $('download-song').disabled = busy || !allReady; $('stop-playback').disabled = !isPlaying;
    for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) { $(`instrument-${instrument}`).disabled = busy; $(`part-instrument-${instrument}`).disabled = busy; }
    document.body.classList.toggle('busy', busy);
    renderWave(part);
  }
  function renderVersions(part) {
    const panel = $('variant-panel'); panel.hidden = !fiveVersions(part);
    if (!fiveVersions(part)) return;
    const ready = hasVersions(part), list = $('variant-list');
    $('variant-intro').textContent = ready
      ? 'Escolta cada proposta i decideix quina utilitzar. Les altres es conservaran per si canvies d’opinió.'
      : 'Genera cinc idees amb melodies, acords i ritmes diferents; després les podràs escoltar i triar.';
    list.replaceChildren();
    if (!ready) return;
    part.variants.forEach((revision, index) => {
      const chosen = index === part.selectedVariant;
      const row = document.createElement('div'); row.className = `variant-row${chosen ? ' chosen' : ''}`;
      const label = document.createElement('div'); label.className = 'variant-title';
      const name = document.createElement('strong'); name.textContent = `Versió ${index + 1}`;
      const grooves = song.settings.style === 'ska'
        ? ['Baix caminant', 'Baix dub espaiat', 'Octaves i contratemps', 'Baix melòdic', 'Baix sincopat']
        : song.settings.style === 'urban' ? ['Urban sincopat', 'Trap a mig temps', 'Dembow electrònic', 'Urban melòdic', 'Urban amb síncopes']
        : ['Punk de corxeres', 'Punk a mig temps', 'Punk galopant', 'Baix amb riff', 'Punk sincopat'];
      const note = document.createElement('span');
      note.textContent = `${grooves[index]}${chosen ? ' · ✓ Escollida' : ''}`;
      label.append(name, note);
      const listen = document.createElement('button'); listen.type = 'button'; listen.className = 'button variant-listen';
      listen.textContent = '▷ Escolta'; listen.disabled = busy;
      listen.setAttribute('aria-label', `Escoltar ${partLabel(part)}, versió ${index + 1}`);
      listen.addEventListener('click', () => play(false, index));
      const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'button variant-choose';
      choose.textContent = chosen ? '✓ Escollida' : 'Escull'; choose.disabled = busy || chosen;
      choose.setAttribute('aria-label', `Escollir ${partLabel(part)}, versió ${index + 1}`);
      choose.addEventListener('click', () => chooseVersion(part, index));
      row.append(label, listen, choose); list.append(row);
    });
  }
  function renderWave(part) {
    const wave = $('waveform'); wave.replaceChildren(); const data = cache.get(cacheKey(part))?.[0];
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
  function invalidate(part) { part.generated = false; clearPartCache(part); stop(); }
  function audioProgress(progress) {
    const status = $('audio-status');
    status.parentElement.classList.remove('error');
    status.parentElement.classList.toggle('loading', progress.stage === 'loading');
    if (progress.stage === 'loading') status.textContent = `Carregant instruments${progress.value === null ? '…' : ` · ${Math.round(progress.value * 100)} %`}`;
    else if (progress.stage === 'rendering') status.textContent = progress.value === 1 ? 'So enregistrat · Instruments a punt' : `Preparant la part · ${Math.round(progress.value * 100)} %`;
    else status.textContent = 'So enregistrat · Instruments a punt';
  }
  function audioError(error) {
    const reason = String(error?.message || error || 'Error desconegut').slice(0, 140);
    $('audio-status').textContent = `Error del motor: ${reason}`;
    $('audio-status').parentElement.classList.remove('loading'); $('audio-status').parentElement.classList.add('error');
    console.error(error);
  }
  async function getSamples(part, versionIndex = null) {
    const revision = versionIndex === null ? part.revision : part.variants?.[versionIndex];
    if (!Number.isInteger(revision)) throw new Error('La versió no existeix');
    const key = cacheKey(part, revision);
    if (!cache.has(key)) {
      const specPart = { ...part, revision };
      if (versionIndex !== null) specPart.variantIndex = versionIndex;
      cache.set(key, await sampleAudio.render(engine.composeSongPart(song.settings, specPart), RATE, { onProgress: audioProgress }));
    }
    return cache.get(key);
  }
  async function generate() {
    if (busy) return; stop(); const part = current();
    const latest = Math.max(part.revision, ...(part.variants || []));
    const multiple = fiveVersions(part), count = multiple ? 5 : 1;
    let start = part.generated || part.variants ? latest + 1 : part.revision;
    if (start + count - 1 > 1000000) start = 1;
    setBusy(true);
    try {
      const versions = Array.from({ length: count }, (_, i) => start + i);
      const specs = versions.map((revision, index) => engine.composeSongPart(song.settings,
        { ...part, revision, variants: multiple ? versions : undefined, variantIndex: multiple ? index : undefined }));
      if (multiple && new Set(specs.map(spec => JSON.stringify([spec.chords.map(chord => chord.root), spec.melody]))).size !== 5)
        throw new Error('No s’han pogut diferenciar les cinc composicions');
      // Es calcula l'àudio de la primera proposta. Les altres quatre s'han
      // compost, i es renderitzen en escoltar-les per evitar esperes i consum de memòria.
      const data = await sampleAudio.render(specs[0], RATE, { onProgress: audioProgress });
      clearPartCache(part);
      if (multiple) { part.variants = versions; part.selectedVariant = 0; }
      else { delete part.variants; delete part.selectedVariant; }
      part.revision = start; part.generated = true; cache.set(cacheKey(part), data); save();
      notify(multiple
        ? `${partLabel(part)}: 5 versions diferents creades. Escolta-les i escull-ne una.`
        : `${partLabel(part)} generada. Ja la pots escoltar.`);
    } catch (error) { audioError(error); notify('No s’han pogut preparar les versions. Comprova la connexió i torna-ho a provar.'); }
    finally { setBusy(false); }
  }
  function stop() {
    playToken++; if (source) { source.onended = null; try { source.stop(); } catch {} source = null; }
    if (playbackGain) { playbackGain.disconnect(); playbackGain = null; }
    cancelAnimationFrame(animation); isPlaying = false; playingPart = null; document.body.classList.remove('playing');
    $('song-progress').value = 0; $('playback-time').textContent = '00:00'; $('play-song').textContent = '▶'; $('stop-playback').disabled = true;
    $('playback-duration').textContent = time(totalSeconds());
  }
  const join = parts => audioUtils.joinStereo(parts);
  async function play(whole, versionIndex = null) {
    if (isPlaying && whole) { stop(); render(); return; }
    if (busy) return; stop(); const token = playToken; const part = current();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { notify('Aquest navegador no admet la reproducció d’àudio.'); return; }
    try {
      // Creació i resume dins del clic per respectar el permís d’àudio en mòbils.
      context ||= new Audio(); const resume = context.resume(); setBusy(true); await resume;
      const data = whole ? join(await collectSamples()) : await getSamples(part, versionIndex);
      if (token !== playToken) return;
      const buffer = context.createBuffer(2, data[0].length, RATE); buffer.copyToChannel(data[0], 0); buffer.copyToChannel(data[1], 1);
      source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
      const gain = playbackGain = context.createGain(); gain.gain.value = .8; source.disconnect(); source.connect(gain); gain.connect(context.destination);
      source.onended = () => { if (token === playToken) { gain.disconnect(); stop(); render(); } };
      playStarted = context.currentTime; playSeconds = data[0].length / RATE; playingPart = whole ? null : part.id;
      isPlaying = true; source.start(); document.body.classList.add('playing');
      $('transport-subtitle').textContent = whole ? 'Escoltant la cançó completa' : `Escoltant · ${partLabel(part)}${versionIndex !== null ? ` · versió ${versionIndex + 1}` : ''}`;
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
    } catch (error) { audioError(error); stop(); notify('No s’ha pogut reproduir l’àudio. Torna a prémer Escolta.'); }
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
      const data = join(await collectSamples()), wav = audioUtils.encodeWav(data, RATE);
      download(new Blob([wav], { type: 'audio/wav' }), `${fileName()}.wav`); notify('Cançó exportada en WAV estèreo de 44,1 kHz.');
    } catch (error) { audioError(error); notify('No s’ha pogut exportar la cançó.'); }
    finally { setBusy(false); }
  }
  $('generate-part').addEventListener('click', generate); $('play-part').addEventListener('click', () => play(false)); $('play-song').addEventListener('click', () => play(true));
  $('stop-playback').addEventListener('click', () => { stop(); render(); }); $('download-song').addEventListener('click', downloadWav);
  $('next-part').addEventListener('click', () => { const i = song.parts.indexOf(current()); select(song.parts[(i + 1) % song.parts.length].id); });
  $('song-title').addEventListener('input', event => { song.title = event.target.value; $('transport-title').textContent = song.title || 'Nova cançó'; save(); });
  async function changeSettings(event) {
    const style = $('song-style').value, profile = engine.SONG_STYLES[style];
    const changingStyle = event.target.id === 'song-style';
    let [tonic, mode] = $('song-key').value.split(':'); tonic = Number(tonic);
    if (!profile.keys.some(([key, keyMode]) => key === tonic && keyMode === mode)) [tonic, mode] = profile.keys[0];
    const bpm = changingStyle ? profile.bpm.default : Number($('song-bpm').value);
    const instruments = changingStyle ? profile.instruments.slice() : Object.keys(engine.SONG_INSTRUMENTS).filter(name => $(`instrument-${name}`).checked);
    if (!instruments.length) { notify('Mantén com a mínim un instrument activat.'); updateSettingsUI(); return; }
    if (!Number.isInteger(bpm) || bpm < profile.bpm.min || bpm > profile.bpm.max) {
      notify(`Per a ${profile.name.toLowerCase()}, tria un tempo entre ${profile.bpm.min} i ${profile.bpm.max} BPM.`); updateSettingsUI(); return;
    }
    const settings = { ...song.settings, style, bpm, tonic, mode, instruments };
    if (JSON.stringify(settings) === JSON.stringify(song.settings)) return;
    const musicChanged = style !== song.settings.style || bpm !== song.settings.bpm || tonic !== song.settings.tonic || mode !== song.settings.mode;
    // Els canvis de formació base només afecten les parts que encara la segueixen.
    const affected = musicChanged ? song.parts : song.parts.filter(p => p.instruments === undefined);
    updateSettingsUI();
    if (affected.some(p => p.generated) && !await ask('Canviar la base musical?',
      musicChanged
        ? 'Canviar l’estil, el tempo o la tonalitat deixa totes les parts pendents de regenerar. Es conservaran els instruments triats a cada part i la lletra.'
        : 'Les parts que segueixen els instruments base quedaran pendents de regenerar. Les parts amb instruments propis i la lletra es conservaran.')) return;
    stop(); song.settings = settings;
    affected.forEach(p => { p.generated = false; clearPartCache(p); });
    updateSettingsUI(); save(); render();
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
    stop(); const i = song.parts.indexOf(p); song.parts.splice(i, 1); clearPartCache(p); selected = song.parts[Math.min(i, song.parts.length - 1)].id; save(); render();
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
  if (recoveredMigration && storageAvailable) { save(); notify('Projecte adaptat als nous estils i instruments. Genera de nou les parts; la lletra s’ha conservat.'); }
  if (!storageAvailable) notify('No s’ha pogut recuperar l’esborrany. Obre un projecte desat o comença una cançó nova.');
})();
