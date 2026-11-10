(() => {
  'use strict';
  const engine = window.ElTaulerRadioAmbient;
  const $ = id => document.getElementById(id);
  const KEY = 'skagenerator.song.v1', RATE = 44100;
  const sampleAudio = window.SkaSampleAudio, audioUtils = window.SkaAudioUtils;
  const colors = { intro: '#90b8ad', verse: '#bab4d8', prechorus: '#d2b19a', chorus: '#e6b572', bridge: '#91b4cf', solo: '#c1bf8c', outro: '#aebc91' };
  const noteNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const timbreOptions = {
    guitar: [['auto', 'Segons l’estil'], ['clean', 'Guitarra neta'], ['muted', 'Guitarra apagada'], ['overdrive', 'Guitarra saturada'], ['distortion', 'Guitarra distorsionada']],
    bass: [['auto', 'Segons l’estil'], ['finger', 'Baix amb dits'], ['pick', 'Baix amb pua']],
    drums: [['auto', 'Segons l’estil'], ['standard', 'Bateria acústica'], ['rock', 'Bateria rock'], ['electronic', 'Kit electrònic']]
  };
  const defaultTimbres = () => ({ guitar: 'auto', bass: 'auto', drums: 'auto' });
  const validTimbres = input => input === undefined || !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.entries(input).every(([name, value]) => timbreOptions[name]?.some(([preset]) => preset === value));
  // Base rítmica: bateria, baix i guitarra comuns a tota la cançó.
  const grooveLabels = { drums: 'Patró de bateria', bass: 'Línia de baix', guitar: 'Ritme de guitarra' };
  const grooveFamilies = Object.keys(grooveLabels);
  const defaultGroove = () => ({ drums: 0, bass: 0, guitar: 0 });
  const validGroove = (input, style) => input === undefined || !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.entries(input).every(([family, index]) => grooveFamilies.includes(family) && Number.isInteger(index)
      && index >= 0 && index < engine.SONG_GROOVES[style][family].length);
  const plurals = { intro: 'les intros', verse: 'les estrofes', prechorus: 'les pretornades', chorus: 'les tornades', bridge: 'els ponts', solo: 'les parts instrumentals', outro: 'els finals' };
  // Paper de cada instrument, per proposar qui toca a cada secció.
  const roles = { drums: 'rhythm', electronicDrums: 'rhythm', bass: 'low', synthBass: 'low', guitar: 'harmony', synthPad: 'harmony', trumpet: 'lead', synthLead: 'lead', trombone: 'second' };
  const tone = window.Tone?.Player ? window.Tone : null;
  for (const [name, options] of Object.entries(timbreOptions)) {
    for (const scope of ['song', 'part']) {
      const select = $(`${scope}-timbre-${name}`);
      const values = scope === 'part' ? [['inherit', 'Com a la cançó'], ...options] : options;
      for (const [value, label] of values) {
        const option = document.createElement('option'); option.value = value; option.textContent = label;
        select.append(option);
      }
    }
  }
  $('tone-status').textContent = tone ? 'Reproductor: Tone.js · instruments enregistrats' : 'Reproductor: Web Audio · Tone.js no disponible';
  const id = () => window.crypto.randomUUID();
  const seed = () => window.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  const makePart = type => ({ id: id(), type, bars: engine.SONG_PARTS[type].bars, energy: engine.SONG_PARTS[type].energy, lyrics: '', generated: false, revision: 1 });
  const fiveVersions = part => ['intro', 'verse', 'chorus'].includes(part.type);
  let recoveredMigration = false;
  const newSong = () => ({ version: 1, title: 'Nova cançó', settings: { style: 'ska', bpm: 128, tonic: 0, mode: 'major', seed: seed(), instruments: engine.SONG_STYLES.ska.instruments.slice(), timbres: defaultTimbres(), groove: defaultGroove() }, parts: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'].map(makePart), chorusRevision: 1 });
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
    if (!validTimbres(value.settings.timbres)) throw new Error('Sons base no vàlids');
    value.settings.timbres = { ...defaultTimbres(), ...(value.settings.timbres || {}) };
    if (!validGroove(value.settings.groove, value.settings.style)) throw new Error('Base rítmica no vàlida');
    // Abans cada versió portava el seu patró: es conserva com a tria de la secció.
    const withoutGroove = value.settings.groove === undefined;
    value.settings.groove = { ...defaultGroove(), ...(value.settings.groove || {}) };
    const seen = new Set();
    for (const part of value.parts) {
      if (!part || typeof part.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(part.id) || seen.has(part.id)
        || typeof part.lyrics !== 'string' || part.lyrics.length > 5000 || typeof part.generated !== 'boolean'
        || !Number.isInteger(part.revision) || part.revision < 1 || part.revision > 1000000) throw new Error('Secció no vàlida');
      if (part.instruments !== undefined && (!Array.isArray(part.instruments) || !part.instruments.length
        || new Set(part.instruments).size !== part.instruments.length
        || part.instruments.some(name => !Object.hasOwn(engine.SONG_INSTRUMENTS, name)))) throw new Error('Instruments de la part no vàlids');
      if (!validTimbres(part.timbres)) throw new Error('Sons de la part no vàlids');
      if (!validGroove(part.groove, value.settings.style)) throw new Error('Base rítmica de la part no vàlida');
      if (withoutGroove && part.groove === undefined && Array.isArray(part.variants) && Number.isInteger(part.selectedVariant)
        && part.selectedVariant >= 0 && part.selectedVariant <= 4)
        part.groove = { drums: part.selectedVariant, bass: part.selectedVariant, guitar: part.selectedVariant };
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
  let selected = song.parts[0].id, busy = false, cache = new Map(), context, source, playbackGain, tonePlayer, playToken = 0, animation;
  let playStarted = 0, playSeconds = 0, isPlaying = false, playingPart = null, playingGroove = false, noticeTimer;
  let showAllRows = false, groovePreview = null;
  const current = () => song.parts.find(p => p.id === selected) || song.parts[0];
  const seconds = p => p.bars * 4 * 60 / song.settings.bpm;
  const totalSeconds = () => song.parts.reduce((sum, p) => sum + seconds(p), 0);
  const time = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  const instrumentsFor = part => part.instruments === undefined ? song.settings.instruments : part.instruments;
  const hasTimbreOverrides = part => !!part.timbres && Object.keys(part.timbres).length > 0;
  const hasGrooveOverrides = part => !!part.groove && Object.keys(part.groove).length > 0;
  const frames = part => Math.round(seconds(part) * RATE);
  const chordName = chord => {
    const third = (chord.pcs[1] - chord.pcs[0] + 12) % 12, fifth = (chord.pcs[2] - chord.pcs[0] + 12) % 12;
    return noteNames[chord.pcs[0]] + (fifth === 6 ? ' dim' : third === 3 ? 'm' : '');
  };
  function chordsOf(part, versionIndex = null) {
    const specPart = versionIndex === null ? part : { ...part, revision: part.variants[versionIndex], variantIndex: versionIndex };
    const chords = engine.composeSongPart(song.settings, specPart).chords.map(chordName);
    // Les progressions es repeteixen cada quatre compassos.
    const cycle = chords.length > 4 && chords.every((name, i) => i >= chords.length - 1 || name === chords[i % 4]) ? chords.slice(0, 4) : chords;
    return cycle.join(' · ');
  }
  function fillSelect(select, entries, value) {
    select.replaceChildren();
    for (const [key, label] of entries) { const option = document.createElement('option'); option.value = key; option.textContent = label; select.append(option); }
    select.value = value;
  }
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
    setPartInstruments(part, instruments); save(); render();
  }
  function setPartInstruments(part, instruments) {
    const base = song.settings.instruments;
    if (instruments.length === base.length && instruments.every(name => base.includes(name))) delete part.instruments;
    else part.instruments = instruments;
    refresh(part);
  }
  function toggleCell(part, instrument, checked) {
    if (busy) return;
    const chosen = new Set(instrumentsFor(part)); if (checked) chosen.add(instrument); else chosen.delete(instrument);
    if (!chosen.size) { notify('Cada part ha de tenir com a mínim un instrument.'); render(); return; }
    setPartInstruments(part, Object.keys(engine.SONG_INSTRUMENTS).filter(name => chosen.has(name)));
    selected = part.id; save(); render();
  }
  // Arranjament de partida: la cançó creix cap a les tornades i respira al pont.
  function suggestedInstruments(part) {
    const base = song.settings.instruments, verses = song.parts.filter(p => p.type === 'verse');
    const plan = { intro: ['harmony', 'rhythm'], verse: ['rhythm', 'low', 'harmony'], prechorus: ['rhythm', 'low', 'harmony', 'second'],
      bridge: ['rhythm', 'low', 'second'] }[part.type];
    if (!plan) return base.slice();
    const wanted = part.type === 'verse' && verses.indexOf(part) > 0 ? [...plan, 'second'] : plan;
    const result = base.filter(name => wanted.includes(roles[name]));
    return result.length ? result : base.slice();
  }
  async function suggestArrangement() {
    if (busy) return;
    if (song.parts.some(p => p.instruments !== undefined) && !await ask('Aplicar l’arranjament proposat?',
      'Se substituirà la tria d’instruments de cada secció. Els acords, les melodies i la lletra es conservaran.')) return;
    for (const part of song.parts) setPartInstruments(part, suggestedInstruments(part));
    save(); render(); notify('Arranjament proposat: la cançó creix cap a les tornades. Retoca’l a la graella.');
  }
  for (const family of Object.keys(timbreOptions)) {
    $(`song-timbre-${family}`).addEventListener('change', changeSettings);
    $(`part-timbre-${family}`).addEventListener('change', () => {
      if (busy) return;
      const part = current(), value = $(`part-timbre-${family}`).value;
      const changed = { ...(part.timbres || {}) };
      if (value === 'inherit') delete changed[family]; else changed[family] = value;
      if (JSON.stringify(changed) === JSON.stringify(part.timbres || {})) return;
      if (Object.keys(changed).length) part.timbres = changed; else delete part.timbres;
      refresh(part); save(); render();
    });
  }
  for (const family of grooveFamilies) {
    $(`song-groove-${family}`).addEventListener('change', changeSettings);
    $(`part-groove-${family}`).addEventListener('change', () => {
      if (busy) return;
      const part = current(), value = $(`part-groove-${family}`).value;
      const changed = { ...(part.groove || {}) };
      if (value === 'inherit') delete changed[family]; else changed[family] = Number(value);
      if (JSON.stringify(changed) === JSON.stringify(part.groove || {})) return;
      if (Object.keys(changed).length) part.groove = changed; else delete part.groove;
      refresh(part); save(); render();
    });
  }
  $('reset-part-instruments').addEventListener('click', () => {
    if (busy || current().instruments === undefined && !hasTimbreOverrides(current()) && !hasGrooveOverrides(current())) return;
    const part = current(); delete part.instruments; delete part.timbres; delete part.groove; refresh(part); save(); render();
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
    for (const family of Object.keys(timbreOptions)) $(`song-timbre-${family}`).value = song.settings.timbres[family] || 'auto';
    for (const family of grooveFamilies) fillSelect($(`song-groove-${family}`),
      engine.SONG_GROOVES[song.settings.style][family].map((name, index) => [String(index), name]), String(song.settings.groove[family]));
  }
  function renderMatrix() {
    const table = $('matrix'); table.replaceChildren();
    const used = new Set(song.settings.instruments);
    song.parts.forEach(p => instrumentsFor(p).forEach(name => used.add(name)));
    const rows = Object.keys(engine.SONG_INSTRUMENTS).filter(name => showAllRows || used.has(name));
    const head = document.createElement('tr'), corner = document.createElement('th');
    corner.scope = 'col'; corner.textContent = 'Instrument'; head.append(corner);
    song.parts.forEach(p => {
      const cell = document.createElement('th'), button = document.createElement('button'); cell.scope = 'col';
      button.type = 'button'; button.className = `matrix-part${p.id === selected ? ' selected' : ''}`; button.disabled = busy;
      button.style.setProperty('--color', colors[p.type]); button.textContent = partLabel(p);
      button.title = `${p.bars} compassos · ${p.generated ? 'generada' : 'pendent'}`;
      button.addEventListener('click', () => select(p.id)); cell.append(button); head.append(cell);
    });
    const thead = document.createElement('thead'), tbody = document.createElement('tbody'); thead.append(head);
    for (const name of rows) {
      const row = document.createElement('tr'), title = document.createElement('th');
      title.scope = 'row'; title.textContent = engine.SONG_INSTRUMENTS[name]; row.append(title);
      song.parts.forEach(p => {
        const cell = document.createElement('td'), label = document.createElement('label'), input = document.createElement('input');
        const on = instrumentsFor(p).includes(name);
        cell.className = `${on ? 'on' : ''}${p.id === selected ? ' selected' : ''}`; cell.style.setProperty('--color', colors[p.type]);
        input.type = 'checkbox'; input.checked = on; input.disabled = busy;
        input.setAttribute('aria-label', `${engine.SONG_INSTRUMENTS[name]} a ${partLabel(p)}`);
        input.addEventListener('change', () => toggleCell(p, name, input.checked));
        label.append(input, document.createElement('span')); cell.append(label); row.append(cell);
      });
      tbody.append(row);
    }
    table.append(thead, tbody);
    $('toggle-rows').textContent = showAllRows ? 'Mostra només els instruments en ús' : 'Mostra tots els instruments';
    $('toggle-rows').hidden = !showAllRows && rows.length === Object.keys(engine.SONG_INSTRUMENTS).length;
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
    const custom = part.instruments !== undefined || hasTimbreOverrides(part) || hasGrooveOverrides(part);
    $('part-instrument-mode').textContent = custom ? 'Selecció pròpia d’aquesta part' : 'Segueix els instruments, els sons i la base rítmica de la cançó';
    for (const family of grooveFamilies) {
      const names = engine.SONG_GROOVES[song.settings.style][family];
      fillSelect($(`part-groove-${family}`), [['inherit', `Com a la cançó (${names[song.settings.groove[family]]})`],
        ...names.map((name, index) => [String(index), name])], part.groove?.[family] === undefined ? 'inherit' : String(part.groove[family]));
    }
    renderMatrix();
    const peers = song.parts.filter(p => p.type === part.type && p.id !== part.id);
    $('apply-peers').hidden = !part.generated || !peers.length;
    $('apply-peers').textContent = `⇉ Fes servir aquesta idea a totes ${plurals[part.type]}`;
    $('part-chords').textContent = part.generated ? `Acords: ${chordsOf(part)}` : '';
    $('part-chords').hidden = !part.generated;
    const pending = song.parts.length - ready;
    $('generate-all').textContent = pending ? `✦ Genera les ${pending === song.parts.length ? '' : `${pending} `}parts pendents` : '✓ Totes les parts generades';
    $('generate-all').disabled = busy || !pending;
    $('play-groove').textContent = playingGroove ? '■ Atura la base' : '▷ Escolta la base';
    for (const family of Object.keys(timbreOptions)) {
      $(`part-timbre-${family}`).value = part.timbres?.[family] || 'inherit';
      const inherited = $(`part-timbre-${family}`).options[0];
      const label = timbreOptions[family].find(([value]) => value === (song.settings.timbres[family] || 'auto'))?.[1] || 'Segons l’estil';
      inherited.textContent = `Com a la cançó (${label})`;
    }
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
      ? 'Tria una de les cinc idees. Després pots afegir o treure instruments i canviar la base sense perdre-la.'
      : 'Genera i prova una altra versió fins que t’agradi. Canviar instruments no modifica la idea.';
    $('transport-title').textContent = song.title || 'Nova cançó'; $('ready-count').textContent = `${ready} de ${song.parts.length} parts generades`;
    if (!isPlaying) $('transport-subtitle').textContent = allReady ? 'La cançó està a punt per escoltar' : ready ? 'Continua amb les parts pendents' : 'Comença generant la intro';
    if (!isPlaying) $('playback-duration').textContent = time(totalSeconds());
    $('next-part').textContent = position === song.parts.length - 1 ? 'Torna a la intro ↗' : 'Següent part →';
    const locked = ['new-song', 'song-title', 'song-style', 'song-bpm', 'song-key', 'part-bars', 'part-energy', 'part-lyrics', 'generate-part', 'next-part', 'add-type', 'import-project', 'export-project', 'suggest-arrangement', 'toggle-rows', 'apply-peers', 'play-groove'];
    locked.forEach(key => $(key).disabled = busy);
    $('add-part').disabled = busy || song.parts.length >= 16;
    $('move-up').disabled = busy || position === 0; $('move-down').disabled = busy || position === song.parts.length - 1;
    $('remove-part').disabled = busy || song.parts.length === 1;
    $('play-part').disabled = busy || !part.generated; $('play-song').disabled = busy || !allReady;
    $('download-song').disabled = busy || !allReady; $('stop-playback').disabled = !isPlaying;
    for (const instrument of Object.keys(engine.SONG_INSTRUMENTS)) { $(`instrument-${instrument}`).disabled = busy; $(`part-instrument-${instrument}`).disabled = busy; }
    for (const family of Object.keys(timbreOptions)) {
      $(`song-timbre-${family}`).disabled = busy || !song.settings.instruments.includes(family);
      $(`part-timbre-${family}`).disabled = busy || !instrumentsFor(part).includes(family);
    }
    const plays = { drums: ['drums', 'electronicDrums'], bass: ['bass', 'synthBass'], guitar: ['guitar'] };
    for (const family of grooveFamilies) {
      $(`song-groove-${family}`).disabled = busy;
      $(`part-groove-${family}`).disabled = busy || !plays[family].some(name => instrumentsFor(part).includes(name));
    }
    document.body.classList.toggle('busy', busy);
    renderWave(part);
  }
  function renderVersions(part) {
    const panel = $('variant-panel'); panel.hidden = !fiveVersions(part);
    if (!fiveVersions(part)) return;
    const ready = hasVersions(part), list = $('variant-list');
    $('variant-intro').textContent = ready
      ? 'Escolta cada proposta i decideix quina utilitzar. Les altres es conservaran per si canvies d’opinió.'
      : 'Genera cinc idees amb acords i melodies diferents sobre la mateixa base rítmica; després les podràs escoltar i triar.';
    list.replaceChildren();
    if (!ready) return;
    part.variants.forEach((revision, index) => {
      const chosen = index === part.selectedVariant;
      const row = document.createElement('div'); row.className = `variant-row${chosen ? ' chosen' : ''}`;
      const label = document.createElement('div'); label.className = 'variant-title';
      const name = document.createElement('strong'); name.textContent = `Versió ${index + 1}`;
      const note = document.createElement('span');
      note.textContent = `${chordsOf(part, index)}${chosen ? ' · ✓ Escollida' : ''}`;
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
  // Un canvi d'arranjament no descarta la idea: només cal tornar a preparar el so.
  function refresh(part) { clearPartCache(part); stop(); }
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
  async function generatePart(part) {
    const latest = Math.max(part.revision, ...(part.variants || []));
    const multiple = fiveVersions(part), count = multiple ? 5 : 1;
    let start = part.generated || part.variants ? latest + 1 : part.revision;
    if (start + count - 1 > 1000000) start = 1;
    {
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
      return multiple;
    }
  }
  async function generate() {
    if (busy) return; stop(); const part = current();
    setBusy(true);
    try {
      notify(await generatePart(part)
        ? `${partLabel(part)}: 5 versions diferents creades. Escolta-les i escull-ne una.`
        : `${partLabel(part)} generada. Ja la pots escoltar.`);
    } catch (error) { audioError(error); notify('No s’han pogut preparar les versions. Comprova la connexió i torna-ho a provar.'); }
    finally { setBusy(false); }
  }
  async function generateAll() {
    const pending = song.parts.filter(p => !p.generated);
    if (busy || !pending.length) return;
    stop(); setBusy(true);
    try {
      for (const part of pending) { selected = part.id; render(); await generatePart(part); }
      notify('Totes les parts tenen una primera idea. Escolta la cançó i retoca el que calgui.');
    } catch (error) { audioError(error); notify('No s’han pogut generar totes les parts. Torna-ho a provar.'); }
    finally { setBusy(false); }
  }
  // Quatre compassos amb la secció rítmica de la formació base.
  async function grooveSamples() {
    const base = song.settings.instruments;
    let band = ['drums', 'electronicDrums', 'bass', 'synthBass', 'guitar'].filter(name => base.includes(name));
    if (!band.length) band = song.settings.style === 'urban' ? ['electronicDrums', 'synthBass'] : ['drums', 'bass', 'guitar'];
    const settings = { ...song.settings, instruments: band }, key = JSON.stringify(settings);
    if (groovePreview?.key !== key) groovePreview = { key, data: await sampleAudio.render(
      engine.composeSongPart(settings, { type: 'verse', bars: 4, energy: 70, revision: 1 }), RATE, { onProgress: audioProgress }) };
    return groovePreview.data;
  }
  function applyToPeers() {
    const part = current(), peers = song.parts.filter(p => p.type === part.type && p.id !== part.id);
    if (busy || !part.generated || !peers.length) return;
    for (const peer of peers) {
      peer.revision = part.revision; peer.generated = true;
      if (part.variants) { peer.variants = part.variants.slice(); peer.selectedVariant = part.selectedVariant; }
      else { delete peer.variants; delete peer.selectedVariant; }
      refresh(peer);
    }
    save(); render(); notify(`Totes ${plurals[part.type]} comparteixen ara els mateixos acords i la mateixa melodia.`);
  }
  function stop() {
    playToken++;
    if (tonePlayer) {
      const playing = tonePlayer; tonePlayer = null;
      playing.onstop = () => {};
      try { playing.stop(); } catch {}
      playing.dispose();
    }
    if (source) { source.onended = null; try { source.stop(); } catch {} source = null; }
    if (playbackGain) { playbackGain.disconnect(); playbackGain = null; }
    cancelAnimationFrame(animation); isPlaying = false; playingPart = null; document.body.classList.remove('playing');
    if (playingGroove) { playingGroove = false; $('play-groove').textContent = '▷ Escolta la base'; }
    $('song-progress').value = 0; $('playback-time').textContent = '00:00'; $('play-song').textContent = '▶'; $('stop-playback').disabled = true;
    $('playback-duration').textContent = time(totalSeconds());
  }
  const join = parts => audioUtils.mixSections(parts, song.parts.map(frames));
  async function play(whole, versionIndex = null, groove = false) {
    if (isPlaying && (whole || groove && playingGroove)) { stop(); render(); return; }
    if (busy) return;
    stop(); const token = playToken, part = current();
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio && !tone) { notify('Aquest navegador no admet la reproducció d’àudio.'); return; }
    // Tone.start() s'invoca directament des del clic, abans de cap await.
    const activation = tone ? tone.start() : null;
    try {
      if (!tone) { context ||= new Audio(); }
      const resume = activation || context.resume();
      setBusy(true); await resume;
      const data = groove ? await grooveSamples() : whole ? join(await collectSamples()) : await getSamples(part, versionIndex);
      if (token !== playToken) return;
      const playbackContext = tone ? tone.getContext().rawContext : context;
      const buffer = playbackContext.createBuffer(2, data[0].length, RATE);
      buffer.copyToChannel(data[0], 0); buffer.copyToChannel(data[1], 1);
      playSeconds = data[0].length / RATE; playingPart = whole || groove ? null : part.id; playingGroove = groove;
      if (tone) {
        // Tone.js gestiona la sortida i el control de la reproducció.
        // Les mostres SF2 es continuen renderitzant al worker per al WAV idèntic.
        tonePlayer = new tone.Player(buffer).toDestination();
        tonePlayer.volume.value = -1.938; // 80 % d'amplitud
        tonePlayer.onstop = () => { if (token === playToken) { stop(); render(); } };
        playStarted = tone.now(); isPlaying = true;
        tonePlayer.start(playStarted);
      } else {
        source = context.createBufferSource(); source.buffer = buffer;
        const gain = playbackGain = context.createGain(); gain.gain.value = .8;
        source.connect(gain); gain.connect(context.destination);
        source.onended = () => { if (token === playToken) { stop(); render(); } };
        playStarted = context.currentTime; isPlaying = true; source.start();
      }
      document.body.classList.add('playing');
      $('transport-subtitle').textContent = groove ? 'Escoltant · base rítmica' : whole ? 'Escoltant la cançó completa' : `Escoltant · ${partLabel(part)}${versionIndex !== null ? ` · versió ${versionIndex + 1}` : ''}`;
      if (!groove) $('play-song').textContent = '■';
      $('playback-duration').textContent = time(playSeconds);
      const tick = () => {
        if (!isPlaying) return;
        const elapsed = Math.min(playSeconds, (tone ? tone.now() : context.currentTime) - playStarted);
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
  $('generate-part').addEventListener('click', generate); $('generate-all').addEventListener('click', generateAll);
  $('play-groove').addEventListener('click', () => play(false, null, true)); $('apply-peers').addEventListener('click', applyToPeers);
  $('suggest-arrangement').addEventListener('click', suggestArrangement);
  $('toggle-rows').addEventListener('click', () => { showAllRows = !showAllRows; render(); });
   $('play-part').addEventListener('click', () => play(false)); $('play-song').addEventListener('click', () => play(true));
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
    const timbres = Object.fromEntries(Object.keys(timbreOptions).map(name => [name, $(`song-timbre-${name}`).value]));
    if (!instruments.length) { notify('Mantén com a mínim un instrument activat.'); updateSettingsUI(); return; }
    if (!Number.isInteger(bpm) || bpm < profile.bpm.min || bpm > profile.bpm.max) {
      notify(`Per a ${profile.name.toLowerCase()}, tria un tempo entre ${profile.bpm.min} i ${profile.bpm.max} BPM.`); updateSettingsUI(); return;
    }
    const groove = changingStyle ? defaultGroove()
      : Object.fromEntries(grooveFamilies.map(family => [family, Number($(`song-groove-${family}`).value)]));
    const settings = { ...song.settings, style, bpm, tonic, mode, instruments, timbres, groove };
    if (JSON.stringify(settings) === JSON.stringify(song.settings)) return;
    // Canviar d'estil o de tonalitat demana idees noves. El tempo, la formació,
    // els sons i la base rítmica conserven els acords i la melodia de cada part.
    const keyChanged = style !== song.settings.style || tonic !== song.settings.tonic || mode !== song.settings.mode;
    const changedTimbres = Object.keys(timbreOptions).filter(name => timbres[name] !== song.settings.timbres[name]);
    const changedGroove = grooveFamilies.filter(name => groove[name] !== song.settings.groove[name]);
    const formationChanged = JSON.stringify(instruments) !== JSON.stringify(song.settings.instruments);
    const affected = keyChanged || bpm !== song.settings.bpm ? song.parts : song.parts.filter(p =>
      (formationChanged && p.instruments === undefined) ||
      changedTimbres.some(name => instrumentsFor(p).includes(name) && p.timbres?.[name] === undefined) ||
      changedGroove.some(name => p.groove?.[name] === undefined));
    if (keyChanged && song.parts.some(p => p.generated) && !await ask('Canviar la base musical?',
      'Canviar l’estil o la tonalitat deixa totes les parts pendents de regenerar. Es conservaran l’estructura, els instruments de cada part i la lletra.')) { updateSettingsUI(); return; }
    const replay = playingGroove && !keyChanged;
    stop(); song.settings = settings;
    affected.forEach(p => { if (keyChanged) p.generated = false; if (changingStyle) delete p.groove; clearPartCache(p); });
    updateSettingsUI(); save(); render();
    if (replay) play(false, null, true);
  }
  ['song-style', 'song-bpm', 'song-key'].forEach(key => $(key).addEventListener('change', changeSettings));
  $('part-bars').addEventListener('change', event => { const p = current(); p.bars = Number(event.target.value); refresh(p); save(); render(); });
  $('part-energy').addEventListener('input', event => { $('energy-value').textContent = `${event.target.value} %`; });
  $('part-energy').addEventListener('change', event => { const p = current(); p.energy = Number(event.target.value); refresh(p); save(); render(); });
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
