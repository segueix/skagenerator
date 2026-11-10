(() => {
  'use strict';
  // Flux únic: 1) base musical per a tota la cançó, 2) seccions marcades a la
  // línia, 3) instruments que entren un a un a cada secció, cadascun generat
  // i escoltat per separat (la secció o la cançó sencera).
  const engine = window.ElTaulerRadioAmbient, sampleAudio = window.SkaSampleAudio, audioUtils = window.SkaAudioUtils;
  const $ = id => document.getElementById(id);
  const KEY = 'skagenerator.song.v2', OLD_KEY = 'skagenerator.song.v1', RATE = 44100;
  const MIN_BARS = 8, MAX_BARS = 128, MAX_SECONDS = 360, MAX_SECTION = 32, MAX_SECTIONS = 32, GAP_CHUNK = 8, MAX_REV = 1000000;
  const INSTRUMENTS = engine.SONG_INSTRUMENTS, TYPES = engine.SONG_PARTS, STYLES = engine.SONG_STYLES;
  const colors = { intro: '#90b8ad', verse: '#bab4d8', prechorus: '#d2b19a', chorus: '#e6b572', bridge: '#91b4cf', solo: '#c1bf8c', outro: '#aebc91' };
  const instrumentColors = { guitar: '#8aab6a', drums: '#7f9a8e', bass: '#9b8bc0', trumpet: '#d9a24e', trombone: '#c98a5e', synthLead: '#6fa3c7', synthPad: '#a9b6d9', synthBass: '#8676b3', electronicDrums: '#6d8f86', sax: '#b8873f', organ: '#7fae9c' };
  const plurals = { intro: 'les intros', verse: 'les estrofes', prechorus: 'les pretornades', chorus: 'les tornades', bridge: 'els ponts', solo: 'les parts instrumentals', outro: 'els finals' };
  const noteNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const BASE_CHOICES = ['drums', 'electronicDrums', 'bass', 'synthBass', 'guitar', 'organ', 'synthPad'];
  const baseDefaults = style => style === 'urban' ? ['electronicDrums', 'synthBass'] : ['drums', 'bass'];
  const timbreOptions = {
    guitar: [['auto', 'Segons l’estil'], ['clean', 'Guitarra neta'], ['muted', 'Guitarra apagada'], ['overdrive', 'Guitarra saturada'], ['distortion', 'Guitarra distorsionada']],
    bass: [['auto', 'Segons l’estil'], ['finger', 'Baix amb dits'], ['pick', 'Baix amb pua']],
    drums: [['auto', 'Segons l’estil'], ['jazz', 'Kit de jazz (ska clàssic)'], ['room', 'Kit de sala'], ['standard', 'Bateria acústica'], ['brush', 'Escombretes'], ['rock', 'Bateria rock'], ['electronic', 'Kit electrònic']],
    trumpet: [['auto', 'Segons l’estil'], ['bright', 'Trompeta brillant'], ['muted', 'Trompeta amb sordina']],
    trombone: [['auto', 'Segons l’estil'], ['warm', 'Trombó càlid']]
  };
  const defaultTimbres = () => ({ guitar: 'auto', bass: 'auto', drums: 'auto', trumpet: 'auto', trombone: 'auto' });
  // Equalitzador: valors en dB respecte de la corba de cada instrument.
  const EQ_KEYS = [['low', 'Greus'], ['mid', 'Mitjos'], ['high', 'Aguts'], ['volume', 'Volum']];
  const flatEq = () => ({ low: 0, mid: 0, high: 0, volume: 0 });
  const isFlat = band => EQ_KEYS.every(([key]) => band[key] === 0);
  const defaultGroove = () => ({ drums: 0, bass: 0, guitar: 0 });
  const validTimbres = input => input === undefined || !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.entries(input).every(([name, value]) => timbreOptions[name]?.some(([preset]) => preset === value));
  const validGroove = (input, style) => input === undefined || !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.entries(input).every(([family, index]) => Object.hasOwn(engine.SONG_GROOVES[style], family) && Number.isInteger(index)
      && index >= 0 && index < engine.SONG_GROOVES[style][family].length);
  const tone = window.Tone?.Player ? window.Tone : null;
  const random32 = () => window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967295);
  const uid = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : `s${Date.now().toString(36)}-${random32().toString(36)}`;
  const newSeed = () => random32() || 1;
  const newRev = () => random32() % MAX_REV + 1;
  const pick = n => random32() % n;

  const newSong = () => ({ version: 2, title: 'Nova cançó',
    settings: { style: 'ska', bpm: 128, tonic: 0, mode: 'major', seed: newSeed(), bars: 64, timbres: defaultTimbres(), groove: defaultGroove() },
    base: { instruments: baseDefaults('ska'), revision: 1, generated: false }, harmony: {}, sections: [] });

  // Els projectes de la versió per parts es converteixen en seccions
  // consecutives; els instruments que no són de la base passen a ser capes.
  function migrate(old) {
    if (!old || !old.settings || !Array.isArray(old.parts)) throw new Error('Projecte no vàlid');
    const style = Object.hasOwn(STYLES, old.settings.style) ? old.settings.style : 'ska', profile = STYLES[style];
    const bpm = Number.isInteger(old.settings.bpm) ? Math.max(profile.bpm.min, Math.min(profile.bpm.max, old.settings.bpm)) : profile.bpm.default;
    let [tonic, mode] = [old.settings.tonic, old.settings.mode];
    if (!profile.keys.some(([k, m]) => k === tonic && m === mode)) [tonic, mode] = profile.keys[0];
    const base = baseDefaults(style), sections = [], harmony = {};
    let start = 0;
    for (const part of old.parts) {
      if (!part || !Object.hasOwn(TYPES, part.type)) continue;
      const bars = Math.max(1, Math.min(MAX_SECTION, Number.isInteger(part.bars) ? part.bars : 8));
      if (start + bars > MAX_BARS) break;
      const revision = Number.isInteger(part.revision) && part.revision >= 1 && part.revision <= MAX_REV ? part.revision : 1;
      harmony[part.type] ??= revision;
      const names = (Array.isArray(part.instruments) ? part.instruments : Array.isArray(old.settings.instruments) ? old.settings.instruments : profile.instruments)
        .filter((name, i, all) => Object.hasOwn(INSTRUMENTS, name) && !base.includes(name) && all.indexOf(name) === i);
      sections.push({ id: uid(), type: part.type, start, bars, lyrics: typeof part.lyrics === 'string' ? part.lyrics.slice(0, 5000) : '',
        layers: names.map(instrument => ({ instrument, revision, generated: !!part.generated })) });
      start += bars;
    }
    const seed = Number.isInteger(old.settings.seed) && old.settings.seed >= 1 && old.settings.seed <= 4294967295 ? old.settings.seed : newSeed();
    return { version: 2, title: typeof old.title === 'string' ? old.title.slice(0, 100) : 'Nova cançó',
      settings: { style, bpm, tonic, mode, seed, bars: Math.max(MIN_BARS, start),
        timbres: validTimbres(old.settings.timbres) ? { ...defaultTimbres(), ...(old.settings.timbres || {}) } : defaultTimbres(), groove: defaultGroove() },
      base: { instruments: base, revision: 1, generated: old.parts.some(p => p?.generated) }, harmony, sections };
  }
  let migrated = false;
  function validateSong(value) {
    if (value?.version === 1) { value = migrate(value); migrated = true; }
    const fail = message => { throw new Error(message); };
    if (!value || value.version !== 2 || typeof value.title !== 'string' || value.title.length > 100) fail('Projecte no vàlid');
    const st = value.settings, profile = STYLES[st?.style];
    if (!st || !Object.hasOwn(STYLES, st.style) || !Number.isInteger(st.bpm) || st.bpm < profile.bpm.min || st.bpm > profile.bpm.max
      || !profile.keys.some(([k, m]) => k === st.tonic && m === st.mode) || !Number.isInteger(st.seed) || st.seed < 1 || st.seed > 4294967295
      || !Number.isInteger(st.bars) || st.bars < MIN_BARS || st.bars > MAX_BARS) fail('Configuració no vàlida');
    if (!validTimbres(st.timbres) || !validGroove(st.groove, st.style)) fail('Sons o patrons no vàlids');
    st.timbres = { ...defaultTimbres(), ...(st.timbres || {}) }; st.groove = { ...defaultGroove(), ...(st.groove || {}) };
    if (st.mix !== undefined) engine.composeSongPart({ ...st }, { type: 'verse', bars: 1, energy: 50, revision: 1 });
    const base = value.base;
    if (!base || !Array.isArray(base.instruments) || !base.instruments.length || new Set(base.instruments).size !== base.instruments.length
      || base.instruments.some(name => !BASE_CHOICES.includes(name)) || !Number.isInteger(base.revision) || base.revision < 1
      || base.revision > MAX_REV || typeof base.generated !== 'boolean') fail('Base no vàlida');
    if (!value.harmony || typeof value.harmony !== 'object' || Array.isArray(value.harmony)
      || Object.entries(value.harmony).some(([type, rev]) => !Object.hasOwn(TYPES, type) || !Number.isInteger(rev) || rev < 1 || rev > MAX_REV)) fail('Acords no vàlids');
    if (!Array.isArray(value.sections) || value.sections.length > MAX_SECTIONS || value.sections.some(s => !s || typeof s !== 'object')) fail('Seccions no vàlides');
    value.sections.sort((a, b) => a.start - b.start);
    const ids = new Set(); let end = 0;
    for (const s of value.sections) {
      if (typeof s.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(s.id) || ids.has(s.id) || !Object.hasOwn(TYPES, s.type)
        || !Number.isInteger(s.start) || !Number.isInteger(s.bars) || s.bars < 1 || s.bars > MAX_SECTION || s.start < end
        || s.start + s.bars > st.bars || (s.mix !== undefined && (!s.mix || typeof s.mix !== 'object' || Array.isArray(s.mix))) || typeof s.lyrics !== 'string' || s.lyrics.length > 5000 || !Array.isArray(s.layers) || s.layers.length > 9) fail('Secció no vàlida');
      const names = new Set();
      for (const layer of s.layers) {
        if (!layer || !Object.hasOwn(INSTRUMENTS, layer.instrument) || names.has(layer.instrument) || base.instruments.includes(layer.instrument)
          || !Number.isInteger(layer.revision) || layer.revision < 1 || layer.revision > MAX_REV || typeof layer.generated !== 'boolean') fail('Instrument de secció no vàlid');
        names.add(layer.instrument);
      }
      ids.add(s.id); end = s.start + s.bars;
    }
    for (const seg of segmentsOf(value)) engine.composeSongPart(value.settings, partFor(value, seg));
    return value;
  }

  // ── Composició de la cançó ──────────────────────────────────────────
  // La cançó es divideix en trams: les seccions marcades i, entre elles,
  // trams de base sola de fins a vuit compassos (amb redoble al final).
  function segmentsOf(s) {
    const list = [];
    const gap = (from, to) => { for (let b = from; b < to; b += GAP_CHUNK) list.push({ start: b, bars: Math.min(GAP_CHUNK, to - b), section: null }); };
    let at = 0;
    for (const section of s.sections) { gap(at, section.start); list.push({ start: section.start, bars: section.bars, section }); at = section.start + section.bars; }
    gap(at, s.settings.bars);
    return list;
  }
  function partFor(s, seg, options = {}) {
    const base = s.base.instruments;
    if (!seg.section) {
      // Si la cançó acaba amb base sola, l'últim tram fa de final.
      const last = seg.start + seg.bars === s.settings.bars && seg.bars >= 2;
      return { type: last ? 'outro' : 'verse', bars: seg.bars, energy: last ? 40 : 55, revision: s.base.revision, instruments: base.slice(), groove: s.settings.groove };
    }
    const sec = seg.section, harmony = s.harmony[sec.type] || 1;
    const layers = options.baseOnly ? [] : sec.layers.filter(layer => layer.generated);
    const part = { type: sec.type, bars: sec.bars, energy: TYPES[sec.type].energy, revision: harmony, groove: s.settings.groove,
      instruments: [...base, ...layers.map(layer => layer.instrument)], layers: Object.fromEntries(layers.map(layer => [layer.instrument, layer.revision])) };
    if (sec.mix && Object.keys(sec.mix).length) part.mix = sec.mix;
    if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (harmony - 1) % 5;
    return part;
  }
  const specFor = (seg, options) => engine.composeSongPart(song.settings, partFor(song, seg, options));
  const chordName = chord => {
    const third = (chord.pcs[1] - chord.pcs[0] + 12) % 12, fifth = (chord.pcs[2] - chord.pcs[0] + 12) % 12;
    return noteNames[chord.pcs[0]] + (fifth === 6 ? ' dim' : third === 3 ? 'm' : '');
  };
  function chordsOf(seg) {
    const chords = specFor(seg, { baseOnly: true }).chords.map(chordName);
    const cycle = chords.length > 4 && chords.every((name, i) => name === chords[i % 4] || i === chords.length - 1) ? chords.slice(0, 4) : chords;
    return cycle.join(' · ');
  }

  // ── Estat ───────────────────────────────────────────────────────────
  let song, storageAvailable = true;
  try {
    const saved = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    song = saved ? validateSong(JSON.parse(saved)) : newSong();
  } catch { song = newSong(); storageAvailable = false; }
  let selected = song.sections[0]?.id || null, busy = false, noticeTimer;
  const current = () => song.sections.find(s => s.id === selected) || null;
  const barSeconds = () => 4 * 60 / song.settings.bpm;
  const frames = bars => Math.round(bars * barSeconds() * RATE);
  const time = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  const sectionLabel = sec => {
    const peers = song.sections.filter(s => s.type === sec.type);
    return TYPES[sec.type].name + (peers.length > 1 ? ` ${peers.indexOf(sec) + 1}` : '');
  };
  const segmentOf = sec => segmentsOf(song).find(seg => seg.section === sec);
  function notify(message) {
    $('notice').textContent = message; $('notice').classList.add('visible');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').classList.remove('visible'), 5000);
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
  function fillSelect(select, entries, value) {
    select.replaceChildren();
    for (const [key, label] of entries) { const option = document.createElement('option'); option.value = key; option.textContent = label; select.append(option); }
    if (value !== undefined) select.value = value;
  }

  // ── Àudio ───────────────────────────────────────────────────────────
  // Memòria cau per tram, limitada en mostres perquè una cançó llarga no
  // ompli la memòria del navegador.
  const cache = new Map(); let cachedFrames = 0;
  const FRAME_BUDGET = 12000000;
  async function renderSpec(spec, onProgress = audioProgress) {
    const key = JSON.stringify(spec);
    if (cache.has(key)) { const data = cache.get(key); cache.delete(key); cache.set(key, data); return data; }
    const data = await sampleAudio.render(spec, RATE, { onProgress });
    cache.set(key, data); cachedFrames += data[0].length;
    while (cachedFrames > FRAME_BUDGET && cache.size > 1) {
      const [oldest, value] = cache.entries().next().value; cache.delete(oldest); cachedFrames -= value[0].length;
    }
    return data;
  }
  async function songAudio(options = {}) {
    const segs = segmentsOf(song), parts = [];
    for (const [index, seg] of segs.entries()) {
      parts.push(await renderSpec(specFor(seg, options), progress => {
        if (progress.stage === 'rendering') status(`Preparant la cançó · tram ${index + 1} de ${segs.length}`);
        else audioProgress(progress);
      }));
    }
    status('So enregistrat · Instruments a punt');
    return audioUtils.mixSections(parts, segs.map(seg => frames(seg.bars)));
  }
  function status(text, state = '') {
    const element = $('audio-status'); element.textContent = text;
    element.parentElement.classList.toggle('loading', state === 'loading'); element.parentElement.classList.toggle('error', state === 'error');
  }
  function audioProgress(progress) {
    if (progress.stage === 'loading') status(`Carregant instruments${progress.value === null ? '…' : ` · ${Math.round(progress.value * 100)} %`}`, 'loading');
    else if (progress.stage === 'rendering') status(progress.value === 1 ? 'So enregistrat · Instruments a punt' : `Preparant el so · ${Math.round(progress.value * 100)} %`);
    else status('So enregistrat · Instruments a punt');
  }
  const reasonOf = error => String(error?.message || error || 'Error desconegut').slice(0, 160);
  function audioError(error) { status(`Error: ${reasonOf(error)}`, 'error'); console.error(error); }

  let context, source, gainNode, tonePlayer, playToken = 0, animation, playing = null;
  $('tone-status').textContent = tone ? ' · Tone.js' : ' · Web Audio';
  // S'ha de cridar directament des del clic: els navegadors només deixen
  // engegar l'àudio dins d'un gest de l'usuari.
  function unlockAudio() {
    const pending = [], Native = window.AudioContext || window.webkitAudioContext;
    if (tone) { try { pending.push(tone.start()); } catch (error) { console.warn(error); } }
    if (Native) {
      try { if (!context || context.state === 'closed') context = new Native(); pending.push(context.resume()); }
      catch (error) { context = null; console.warn(error); }
    }
    return Promise.allSettled(pending);
  }
  function makeBuffer(audioContext, data) {
    const buffer = audioContext.createBuffer(2, data[0].length, RATE);
    buffer.getChannelData(0).set(data[0]); buffer.getChannelData(1).set(data[1]);
    return buffer;
  }
  async function startBuffer(data, token) {
    const ended = () => { if (token === playToken) { stop(); render(); } };
    if (tone) {
      try {
        const raw = tone.getContext().rawContext;
        if (raw.state !== 'running') throw new Error('Tone.js no està actiu');
        const player = new tone.Player(makeBuffer(raw, data)).toDestination();
        player.volume.value = -1.938; player.onstop = ended;
        const startedAt = tone.now(); player.start(startedAt); tonePlayer = player;
        return () => tone.now() - startedAt;
      } catch (error) { console.warn('Tone.js no ha pogut reproduir; es fa servir Web Audio.', error); tonePlayer = null; }
    }
    if (!context) throw new Error('Aquest navegador no admet Web Audio');
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running') throw new Error('El navegador ha bloquejat el so. Torna a prémer el botó d’escoltar.');
    source = context.createBufferSource(); source.buffer = makeBuffer(context, data);
    gainNode = context.createGain(); gainNode.gain.value = .8;
    source.connect(gainNode); gainNode.connect(context.destination); source.onended = ended;
    const startedAt = context.currentTime; source.start();
    return () => context.currentTime - startedAt;
  }
  function stop() {
    playToken++;
    if (tonePlayer) { const player = tonePlayer; tonePlayer = null; player.onstop = () => {}; try { player.stop(); } catch {} player.dispose(); }
    if (source) { source.onended = null; try { source.stop(); } catch {} source = null; }
    if (gainNode) { gainNode.disconnect(); gainNode = null; }
    cancelAnimationFrame(animation); playing = null; document.body.classList.remove('playing');
    $('song-progress').value = 0; $('playback-time').textContent = '00:00'; $('playhead').hidden = true;
  }
  async function play(kind) {
    const sec = current();
    if (playing && playing.kind === kind && (kind !== 'section' || playing.id === sec?.id)) { stop(); render(); return; }
    if (busy || !song.base.generated) return;
    stop();
    const token = playToken, unlocked = unlockAudio();
    setBusy(true);
    try {
      await unlocked;
      let data, startBar = 0, bars = song.settings.bars;
      if (kind === 'section') { data = await renderSpec(specFor(segmentOf(sec))); startBar = sec.start; bars = sec.bars; }
      else data = await songAudio({ baseOnly: kind === 'base' });
      if (token !== playToken) return;
      const clock = await startBuffer(data, token);
      playing = { kind, id: sec?.id, startBar, bars, seconds: data[0].length / RATE, clock };
      document.body.classList.add('playing');
      const tick = () => {
        if (!playing || token !== playToken) return;
        const elapsed = Math.min(playing.seconds, playing.clock()), bar = playing.startBar + elapsed / barSeconds();
        $('song-progress').value = elapsed / playing.seconds; $('playback-time').textContent = time(elapsed);
        $('playhead').hidden = bar > playing.startBar + playing.bars;
        $('playhead').style.setProperty('--pos', String(Math.min(1, bar / song.settings.bars)));
        const active = song.sections.find(s => bar >= s.start && bar < s.start + s.bars);
        $('transport-subtitle').textContent = kind === 'base' ? 'Escoltant · base musical'
          : `Escoltant · ${active ? sectionLabel(active) : 'base'}${kind === 'section' ? ' (secció)' : ''}`;
        animation = requestAnimationFrame(tick);
      };
      tick();
    } catch (error) {
      audioError(error); stop();
      notify(`No s’ha pogut reproduir l’àudio: ${reasonOf(error)}`);
    } finally { setBusy(false); }
  }

  // ── Generació ───────────────────────────────────────────────────────
  async function generateBase() {
    if (busy) return;
    stop();
    const previous = { revision: song.base.revision, groove: { ...song.settings.groove }, generated: song.base.generated };
    if (song.base.generated) {
      // Una altra base: progressió nova i patrons de bateria i baix a l'atzar.
      const grooves = engine.SONG_GROOVES[song.settings.style];
      song.base.revision = newRev();
      song.settings.groove = { drums: pick(grooves.drums.length), bass: pick(grooves.bass.length), guitar: pick(grooves.guitar.length) };
    }
    setBusy(true);
    try {
      await songAudio({ baseOnly: true });
      song.base.generated = true; save();
      notify(previous.generated ? 'Base nova generada. Escolta-la i, quan t’agradi, marca les seccions a la línia.'
        : 'Base generada. Escolta-la i després marca les seccions a la línia.');
    } catch (error) {
      Object.assign(song.base, { revision: previous.revision, generated: previous.generated }); song.settings.groove = previous.groove;
      audioError(error); notify(`No s’ha pogut generar la base: ${reasonOf(error)}`);
    } finally { setBusy(false); updateSettingsUI(); render(); }
  }
  async function generateLayer(sec, layer) {
    if (busy || !song.base.generated) return;
    stop();
    const before = { revision: layer.revision, generated: layer.generated };
    let reused = null;
    if (!layer.generated) {
      // Les seccions del mateix tipus repeteixen la mateixa idea, com una tornada.
      const peer = song.sections.find(s => s !== sec && s.type === sec.type && s.layers.some(l => l.instrument === layer.instrument && l.generated));
      if (peer) { layer.revision = peer.layers.find(l => l.instrument === layer.instrument).revision; reused = peer; }
    } else { const previous = layer.revision; do layer.revision = newRev(); while (layer.revision === previous); }
    layer.generated = true;
    setBusy(true);
    try {
      await renderSpec(specFor(segmentOf(sec)));
      save();
      notify(reused ? `${INSTRUMENTS[layer.instrument]} a ${sectionLabel(sec)}: repeteix la idea de ${sectionLabel(reused)}. Prem «Genera’n una altra» per variar-la.`
        : `${INSTRUMENTS[layer.instrument]} generat a ${sectionLabel(sec)}. Escolta la secció o tota la cançó.`);
    } catch (error) {
      Object.assign(layer, before); audioError(error); notify(`No s’ha pogut generar l’instrument: ${reasonOf(error)}`);
    } finally { setBusy(false); }
  }

  // ── Seccions i capes ────────────────────────────────────────────────
  function freeRange(bar, ignore = null) {
    let from = 0, to = song.settings.bars;
    for (const s of song.sections) {
      if (s === ignore) continue;
      if (s.start + s.bars <= bar) from = Math.max(from, s.start + s.bars);
      else if (s.start > bar) to = Math.min(to, s.start);
      else return null;
    }
    return [from, to];
  }
  function nextType(start, end) {
    const before = song.sections.filter(s => s.start < start).at(-1);
    if (end === song.settings.bars && before) return 'outro';
    if (!before) return start === 0 ? 'intro' : 'verse';
    return { intro: 'verse', verse: 'chorus', prechorus: 'chorus', chorus: 'verse', bridge: 'chorus', solo: 'chorus', outro: 'verse' }[before.type];
  }
  function addSection(bar) {
    if (busy) return;
    if (!song.base.generated) { notify('Primer genera la base (pas 1).'); return; }
    if (song.sections.length >= MAX_SECTIONS) { notify(`Com a màxim hi pot haver ${MAX_SECTIONS} seccions.`); return; }
    const range = freeRange(bar);
    if (!range || range[1] - range[0] < 1) { notify('No hi ha espai lliure en aquest punt. Escurça una secció o allarga la cançó.'); return; }
    let start = Math.max(range[0], Math.floor(bar / 4) * 4);
    if (range[1] - start < 1) start = range[0];
    const bars = Math.min(8, MAX_SECTION, range[1] - start), type = nextType(start, start + bars);
    song.harmony[type] ??= newRev();
    const sec = { id: uid(), type, start, bars, lyrics: '', layers: [] };
    song.sections.push(sec); song.sections.sort((a, b) => a.start - b.start);
    selected = sec.id; stop(); save(); render();
    notify(`${sectionLabel(sec)} marcada als compassos ${start + 1}–${start + bars}. Ara afegeix-hi un instrument.`);
  }
  function previousSection(sec) { return song.sections.filter(s => s.start < sec.start).at(-1); }
  function changeSection(field, raw) {
    const sec = current(); if (!sec || busy) return;
    const value = Number(raw);
    if (field === 'type') {
      sec.type = raw; song.harmony[raw] ??= newRev();
    } else if (field === 'start') {
      const start = Math.round(value) - 1, range = freeRange(sec.start, sec);
      if (!Number.isFinite(value) || start < range[0] || start + sec.bars > range[1]) {
        notify(`Aquesta secció pot començar entre el compàs ${range[0] + 1} i el ${range[1] - sec.bars + 1}.`);
      } else sec.start = start;
    } else if (field === 'bars') {
      const range = freeRange(sec.start, sec), max = Math.min(MAX_SECTION, range[1] - sec.start);
      const bars = Math.round(value);
      if (!Number.isFinite(value) || bars < 1 || bars > max) notify(`Aquesta secció pot durar entre 1 i ${max} compassos.`);
      else sec.bars = bars;
    }
    stop(); save(); render();
  }
  async function removeSection() {
    const sec = current(); if (!sec || busy) return;
    if ((sec.layers.length || sec.lyrics) && !await ask(`Eliminar ${sectionLabel(sec).toLowerCase()}?`,
      'S’eliminaran la secció i els seus instruments. En aquest tram només sonarà la base.')) return;
    stop(); const index = song.sections.indexOf(sec); song.sections.splice(index, 1);
    selected = song.sections[Math.min(index, song.sections.length - 1)]?.id || null; save(); render();
  }
  function addLayer() {
    const sec = current(), instrument = $('layer-instrument').value;
    if (!sec || busy || !Object.hasOwn(INSTRUMENTS, instrument) || sec.layers.some(l => l.instrument === instrument)) return;
    sec.layers.push({ instrument, revision: newRev(), generated: false });
    save(); render();
    notify(`${INSTRUMENTS[instrument]} afegit a ${sectionLabel(sec)}. Prem «Genera» per crear-ne la part.`);
  }
  function removeLayer(sec, layer) { if (busy) return; stop(); sec.layers.splice(sec.layers.indexOf(layer), 1); save(); render(); }
  function copyPrevious() {
    const sec = current(), previous = sec && previousSection(sec);
    if (!sec || busy || !previous?.layers.length) return;
    sec.layers = previous.layers.map(layer => ({ ...layer })); stop(); save(); render();
    notify(`${sectionLabel(sec)} continua amb els instruments de ${sectionLabel(previous)}. Afegeix-ne un de nou per fer créixer la cançó.`);
  }

  // ── Configuració ────────────────────────────────────────────────────
  const timbreFamilies = Object.keys(timbreOptions);
  for (const family of timbreFamilies) fillSelect($(`timbre-${family}`), timbreOptions[family]);
  fillSelect($('section-type'), Object.entries(TYPES).map(([type, info]) => [type, info.name]));
  for (const name of BASE_CHOICES) {
    const label = document.createElement('label'); label.className = 'instrument-toggle';
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = `base-${name}`; input.value = name;
    const text = document.createElement('span'); text.textContent = INSTRUMENTS[name];
    label.append(input, text); $('base-instruments').append(label);
    input.addEventListener('change', changeBase);
  }
  function changeBase() {
    if (busy) return;
    const instruments = BASE_CHOICES.filter(name => $(`base-${name}`).checked);
    if (!instruments.length) { notify('La base necessita com a mínim un instrument.'); updateSettingsUI(); return; }
    applyBase(instruments); stop(); save(); updateSettingsUI(); render();
  }
  function applyBase(instruments) {
    song.base.instruments = instruments;
    let removed = 0;
    for (const sec of song.sections) {
      const kept = sec.layers.filter(layer => !instruments.includes(layer.instrument));
      removed += sec.layers.length - kept.length; sec.layers = kept;
    }
    if (removed) notify('Els instruments que ara formen part de la base ja sonen a totes les seccions.');
  }
  function updateSettingsUI() {
    const st = song.settings, profile = STYLES[st.style];
    $('song-title').value = song.title; $('song-style').value = st.style;
    $('song-bpm').min = profile.bpm.min; $('song-bpm').max = profile.bpm.max; $('song-bpm').value = st.bpm;
    fillSelect($('song-key'), profile.keys.map(([tonic, mode]) => [`${tonic}:${mode}`, `${noteNames[tonic]} ${mode === 'major' ? 'major' : 'menor'}`]), `${st.tonic}:${st.mode}`);
    $('song-bars').max = Math.min(MAX_BARS, Math.floor(MAX_SECONDS / barSeconds())); $('song-bars').value = st.bars;
    $('style-description').textContent = `${profile.name} · ${profile.description} La base (bateria i baix) sona durant tota la cançó: genera-la i escolta-la abans d’afegir res més.`;
    for (const name of BASE_CHOICES) $(`base-${name}`).checked = song.base.instruments.includes(name);
    for (const family of ['drums', 'bass', 'guitar'])
      fillSelect($(`groove-${family}`), engine.SONG_GROOVES[st.style][family].map((name, index) => [String(index), name]), String(st.groove[family]));
    $('groove-guitar-field').hidden = !song.base.instruments.includes('guitar');
    for (const family of timbreFamilies) $(`timbre-${family}`).value = st.timbres[family];
  }
  async function changeSettings(event) {
    if (busy) return;
    const st = song.settings, id = event.target.id;
    const style = $('song-style').value, profile = STYLES[style];
    if (id === 'song-style') {
      song.settings = { ...st, style, bpm: profile.bpm.default, groove: defaultGroove() };
      if (!profile.keys.some(([k, m]) => k === st.tonic && m === st.mode)) [song.settings.tonic, song.settings.mode] = profile.keys[0];
      applyBase(baseDefaults(style));
      song.settings.bars = Math.min(song.settings.bars, Math.floor(MAX_SECONDS / barSeconds()));
      trimSections();
    } else if (id === 'song-bpm') {
      const bpm = Number($('song-bpm').value);
      if (!Number.isInteger(bpm) || bpm < profile.bpm.min || bpm > profile.bpm.max) notify(`Per a ${profile.name.toLowerCase()}, tria un tempo entre ${profile.bpm.min} i ${profile.bpm.max} BPM.`);
      else if (st.bars * 240 / bpm > MAX_SECONDS) notify('Amb aquest tempo la cançó superaria els 6 minuts. Escurça-la primer.');
      else st.bpm = bpm;
    } else if (id === 'song-key') {
      const [tonic, mode] = $('song-key').value.split(':'); st.tonic = Number(tonic); st.mode = mode;
    } else if (id === 'song-bars') {
      const bars = Number($('song-bars').value), max = Math.min(MAX_BARS, Math.floor(MAX_SECONDS / barSeconds()));
      if (!Number.isInteger(bars) || bars < MIN_BARS || bars > max) notify(`La cançó pot durar entre ${MIN_BARS} i ${max} compassos (${time(max * barSeconds())}).`);
      else {
        const lost = song.sections.filter(s => s.start + s.bars > bars);
        if (lost.length && !await ask('Escurçar la cançó?', `${lost.map(sectionLabel).join(', ')} queda${lost.length > 1 ? 'en' : ''} fora o s’escurçarà. La resta es conserva.`)) { updateSettingsUI(); return; }
        st.bars = bars; trimSections();
      }
    } else if (id.startsWith('groove-')) st.groove = { ...st.groove, [id.slice(7)]: Number(event.target.value) };
    else if (id.startsWith('timbre-')) st.timbres = { ...st.timbres, [id.slice(7)]: event.target.value };
    const replay = id.startsWith('groove-') || id.startsWith('timbre-') ? playing?.kind : null;
    stop(); save(); updateSettingsUI(); render();
    if (replay) play(replay);
  }
  function trimSections() {
    const bars = song.settings.bars;
    song.sections = song.sections.filter(s => s.start < bars);
    for (const s of song.sections) s.bars = Math.min(s.bars, bars - s.start);
    if (!current()) selected = song.sections.at(-1)?.id || null;
  }

  // ── Pantalla ────────────────────────────────────────────────────────
  function setBusy(value) { busy = value; render(); }
  function span(track, start, bars, className, text, color) {
    const element = document.createElement('span'); element.className = className;
    element.style.left = `${start / song.settings.bars * 100}%`; element.style.width = `${bars / song.settings.bars * 100}%`;
    if (color) element.style.setProperty('--color', color);
    if (text) element.textContent = text;
    track.append(element); return element;
  }
  function renderLine() {
    const total = song.settings.bars;
    $('line').style.setProperty('--bars', total);
    const ruler = $('line-ruler'); ruler.replaceChildren();
    const step = total > 64 ? 8 : 4;
    for (let b = 0; b < total; b += step) { const tick = span(ruler, b, step, 'tick', String(b + 1)); tick.title = time(b * barSeconds()); }
    const track = $('section-track'); track.replaceChildren(); track.classList.toggle('locked', !song.base.generated || busy);
    for (const sec of song.sections) {
      const block = document.createElement('button'); block.type = 'button';
      block.className = `line-section${sec.id === selected ? ' selected' : ''}`;
      block.style.left = `${sec.start / total * 100}%`; block.style.width = `${sec.bars / total * 100}%`; block.style.setProperty('--color', colors[sec.type]);
      block.disabled = busy;
      block.setAttribute('aria-label', `${sectionLabel(sec)}, compassos ${sec.start + 1} a ${sec.start + sec.bars}`);
      const name = document.createElement('strong'); name.textContent = sectionLabel(sec);
      const info = document.createElement('small'); info.textContent = `${sec.bars} c. · ${sec.layers.filter(l => l.generated).length} instr.`;
      block.append(name, info);
      block.addEventListener('click', event => { event.stopPropagation(); if (!busy) { selected = sec.id; render(); } });
      track.append(block);
    }
    const baseTrack = $('base-track'); baseTrack.replaceChildren();
    span(baseTrack, 0, total, `line-base${song.base.generated ? ' ready' : ''}`,
      `${song.base.instruments.map(name => INSTRUMENTS[name]).join(' + ')}${song.base.generated ? '' : ' · pendent de generar'}`);
    const rows = $('layer-rows'); rows.replaceChildren();
    const used = [];
    for (const sec of song.sections) for (const layer of sec.layers) if (!used.includes(layer.instrument)) used.push(layer.instrument);
    for (const name of used) {
      const row = document.createElement('div'); row.className = 'line-row';
      const label = document.createElement('span'); label.className = 'line-label'; label.textContent = INSTRUMENTS[name];
      const lane = document.createElement('div'); lane.className = 'line-track';
      for (const sec of song.sections) {
        const layer = sec.layers.find(l => l.instrument === name);
        if (layer) span(lane, sec.start, sec.bars, `line-layer${layer.generated ? ' ready' : ''}`, '', instrumentColors[name]).title = `${INSTRUMENTS[name]} · ${sectionLabel(sec)}${layer.generated ? '' : ' · pendent'}`;
      }
      row.append(label, lane); rows.append(row);
    }
    $('line-hint').textContent = !song.base.generated ? 'Primer genera la base (pas 1).'
      : song.sections.length ? 'Fes clic en un espai buit de la fila «Seccions» per marcar-ne una altra.' : 'Fes clic a la fila «Seccions» on vulguis que entri el primer instrument.';
  }
  function renderSection() {
    const sec = current(), editor = $('section-editor');
    editor.hidden = !sec; $('section-empty').hidden = !!sec;
    $('section-empty').textContent = !song.base.generated ? '3 · Quan tinguis la base, marca una secció a la línia per afegir-hi instruments.'
      : '3 · Marca una secció a la línia (o prem «Afegeix una secció al final») per començar a afegir instruments.';
    if (!sec) return;
    const seg = segmentOf(sec), range = freeRange(sec.start, sec);
    $('section-title').textContent = `${sectionLabel(sec)} · compassos ${sec.start + 1}–${sec.start + sec.bars}`;
    $('section-type').value = sec.type;
    $('section-start').value = sec.start + 1; $('section-start').min = range[0] + 1; $('section-start').max = range[1] - sec.bars + 1;
    $('section-start-time').textContent = time(sec.start * barSeconds());
    $('section-bars').value = sec.bars; $('section-bars').max = Math.min(MAX_SECTION, range[1] - sec.start);
    $('section-time').textContent = time(sec.bars * barSeconds());
    $('section-chords').textContent = `Acords: ${chordsOf(seg)}`;
    $('section-reharmonize').textContent = song.sections.filter(s => s.type === sec.type).length > 1 ? `↻ Altres acords per a totes ${plurals[sec.type]}` : '↻ Altres acords';
    $('section-lyrics').value = sec.lyrics;
    const list = $('layer-list'); list.replaceChildren();
    if (!sec.layers.length) {
      const empty = document.createElement('li'); empty.className = 'layer-empty';
      empty.textContent = 'Encara només sona la base. Tria un instrument a sota i afegeix-lo.'; list.append(empty);
    }
    sec.layers.forEach((layer, index) => {
      const item = document.createElement('li'); item.className = `layer-row${layer.generated ? ' ready' : ''}`;
      item.style.setProperty('--color', instrumentColors[layer.instrument]);
      const number = document.createElement('span'); number.className = 'layer-number'; number.textContent = String(index + 1);
      const text = document.createElement('div'); text.className = 'layer-title';
      const name = document.createElement('strong'); name.textContent = INSTRUMENTS[layer.instrument];
      const state = document.createElement('small'); state.textContent = layer.generated ? 'Generat ✓' : 'Pendent de generar';
      text.append(name, state);
      const generate = document.createElement('button'); generate.type = 'button';
      generate.className = `button ${layer.generated ? '' : 'primary'}`; generate.textContent = layer.generated ? '↻ Genera’n una altra' : '✦ Genera';
      generate.disabled = busy || !song.base.generated; generate.addEventListener('click', () => generateLayer(sec, layer));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Treure ${INSTRUMENTS[layer.instrument]} d’aquesta secció`); remove.disabled = busy;
      remove.addEventListener('click', () => removeLayer(sec, layer));
      item.append(number, text, generate, remove); list.append(item);
    });
    const available = Object.keys(INSTRUMENTS).filter(name => !song.base.instruments.includes(name) && !sec.layers.some(l => l.instrument === name));
    const chosen = available.includes($('layer-instrument').value) ? $('layer-instrument').value : available[0];
    fillSelect($('layer-instrument'), available.map(name => [name, INSTRUMENTS[name]]), chosen);
    $('layer-instrument').disabled = busy || !available.length; $('add-layer').disabled = busy || !available.length;
    const previous = previousSection(sec);
    $('copy-previous').hidden = sec.layers.length > 0 || !previous?.layers.length;
    if (previous) $('copy-previous').textContent = `⇢ Continua amb els instruments de ${sectionLabel(previous)}`;
    const pending = sec.layers.some(l => !l.generated);
    $('play-section').textContent = playing?.kind === 'section' && playing.id === sec.id ? '■ Atura' : `▷ Escolta la secció${pending ? ' (sense els pendents)' : ''}`;
    $('play-song-inline').textContent = playing?.kind === 'song' ? '■ Atura la cançó' : '▷ Escolta tota la cançó';
  }
  // ── Equalitzadors ──────────────────────────────────────────────────
  function eqNames(sec) {
    const names = song.base.instruments.slice();
    for (const s of sec ? [sec] : song.sections) for (const layer of s.layers) if (!names.includes(layer.instrument)) names.push(layer.instrument);
    return [...names, 'master'];
  }
  function renderEq(container, sec) {
    container.replaceChildren();
    for (const name of eqNames(sec)) {
      const own = sec ? sec.mix?.[name] : song.settings.mix?.[name], inherited = sec ? song.settings.mix?.[name] : undefined;
      const values = own || inherited || flatEq();
      const row = document.createElement('div'); row.className = `eq-row${own ? ' own' : ''}`;
      if (name !== 'master') row.style.setProperty('--color', instrumentColors[name]);
      const title = document.createElement('div'); title.className = 'eq-name';
      const label = document.createElement('strong'); label.textContent = name === 'master' ? (sec ? 'Secció sencera' : 'Mescla total') : INSTRUMENTS[name];
      const state = document.createElement('small');
      state.textContent = sec ? (own ? 'Propi d’aquesta secció' : 'Com a la cançó') : (own ? 'Ajustat' : 'So de l’estil');
      title.append(label, state); row.append(title);
      for (const [key, text] of EQ_KEYS) {
        const [min, max] = engine.MIX_LIMITS[key];
        const control = document.createElement('label'); control.className = 'eq-control';
        const caption = document.createElement('span'), output = document.createElement('output');
        const show = value => { output.textContent = `${value > 0 ? '+' : ''}${value} dB`; };
        caption.textContent = text; show(values[key]); caption.append(output);
        const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = 1; input.value = values[key];
        input.disabled = busy; input.setAttribute('aria-label', `${text} · ${label.textContent}`);
        input.addEventListener('input', () => show(Number(input.value)));
        input.addEventListener('change', () => changeEq(sec, name, key, Number(input.value)));
        control.append(caption, input); row.append(control);
      }
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'icon-button eq-reset'; reset.textContent = '↶';
      reset.title = sec ? 'Torna a l’equalitzador de la cançó' : 'Torna al so de l’estil'; reset.setAttribute('aria-label', reset.title);
      reset.disabled = busy || !own; reset.addEventListener('click', () => changeEq(sec, name, null));
      row.append(reset); container.append(row);
    }
  }
  function changeEq(sec, name, key, value) {
    if (busy) return;
    const holder = sec || song.settings, inherited = sec ? song.settings.mix?.[name] || flatEq() : flatEq();
    const mix = { ...(holder.mix || {}) };
    if (key === null) delete mix[name];
    else {
      mix[name] = { ...(mix[name] || inherited), [key]: value };
      if (sec ? EQ_KEYS.every(([k]) => mix[name][k] === inherited[k]) : isFlat(mix[name])) delete mix[name];
    }
    if (Object.keys(mix).length) holder.mix = mix; else delete holder.mix;
    // Si sonava, es torna a escoltar amb el canvi aplicat.
    const replay = playing?.kind;
    stop(); save(); render();
    if (replay) play(replay);
  }
  function render() {
    renderLine(); renderSection();
    renderEq($('song-eq'), null);
    if (current()) renderEq($('section-eq'), current());
    const generatedLayers = song.sections.reduce((n, s) => n + s.layers.filter(l => l.generated).length, 0);
    const total = song.settings.bars * barSeconds();
    $('song-time').textContent = time(total);
    $('duration-total').textContent = `${song.settings.bars} compassos · ${time(total)} · ${song.sections.length} seccions`;
    $('base-state').textContent = busy ? 'Preparant el so…' : song.base.generated ? 'Generada ✓' : 'Pendent de generar';
    $('base-state').classList.toggle('ready', song.base.generated);
    $('generate-base').textContent = song.base.generated ? '↻ Genera una altra base' : '✦ Genera la base';
    $('base-chords').textContent = song.base.generated ? `Acords de la base: ${chordsOf(segmentsOf({ ...song, sections: [] })[0])}` : '';
    $('play-base').textContent = playing?.kind === 'base' ? '■ Atura la base' : '▷ Escolta la base';
    $('transport-title').textContent = song.title || 'Nova cançó';
    $('ready-count').textContent = song.base.generated ? `Base ✓ · ${song.sections.length} seccions · ${generatedLayers} instruments generats` : 'Genera la base per començar';
    if (!playing) {
      $('transport-subtitle').textContent = !song.base.generated ? 'Comença generant la base' : generatedLayers ? 'Escolta com creix la cançó' : 'Marca seccions i afegeix-hi instruments';
      $('playback-duration').textContent = time(total); $('play-song').textContent = '▶';
    } else { $('playback-duration').textContent = time(playing.seconds); $('play-song').textContent = playing.kind === 'song' ? '■' : '▶'; }
    const ready = song.base.generated;
    for (const key of ['new-song', 'song-title', 'song-style', 'song-bpm', 'song-key', 'song-bars', 'generate-base', 'add-section', 'import-project', 'export-project',
      'groove-drums', 'groove-bass', 'groove-guitar', 'timbre-guitar', 'timbre-bass', 'timbre-drums', 'timbre-trumpet', 'timbre-trombone', 'section-type', 'section-start', 'section-bars',
      'section-reharmonize', 'remove-section', 'copy-previous']) $(key).disabled = busy;
    for (const name of BASE_CHOICES) $(`base-${name}`).disabled = busy;
    for (const key of ['play-base', 'play-song', 'download-song', 'play-section', 'play-song-inline']) $(key).disabled = busy || !ready;
    $('add-section').disabled = busy || !ready;
    $('stop-playback').disabled = !playing;
    document.body.classList.toggle('busy', busy);
  }

  // ── Esdeveniments ───────────────────────────────────────────────────
  ['song-style', 'song-bpm', 'song-key', 'song-bars', 'groove-drums', 'groove-bass', 'groove-guitar', 'timbre-guitar', 'timbre-bass', 'timbre-drums', 'timbre-trumpet', 'timbre-trombone']
    .forEach(key => $(key).addEventListener('change', changeSettings));
  $('song-title').addEventListener('input', event => { song.title = event.target.value; $('transport-title').textContent = song.title || 'Nova cançó'; save(); });
  $('generate-base').addEventListener('click', generateBase);
  $('play-base').addEventListener('click', () => play('base'));
  $('play-song').addEventListener('click', () => play('song'));
  $('play-song-inline').addEventListener('click', () => play('song'));
  $('play-section').addEventListener('click', () => play('section'));
  $('stop-playback').addEventListener('click', () => { stop(); render(); });
  $('section-track').addEventListener('click', event => {
    if (busy || event.target !== $('section-track')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    addSection(Math.max(0, Math.min(song.settings.bars - 1, Math.floor((event.clientX - rect.left) / rect.width * song.settings.bars))));
  });
  $('add-section').addEventListener('click', () => addSection(song.sections.length ? song.sections.at(-1).start + song.sections.at(-1).bars : 0));
  $('section-type').addEventListener('change', event => changeSection('type', event.target.value));
  $('section-start').addEventListener('change', event => changeSection('start', event.target.value));
  $('section-bars').addEventListener('change', event => changeSection('bars', event.target.value));
  $('section-reharmonize').addEventListener('click', () => {
    const sec = current(); if (!sec || busy) return;
    song.harmony[sec.type] = (song.harmony[sec.type] || 1) % MAX_REV + 1; stop(); save(); render();
    notify(`Acords nous per a ${plurals[sec.type]}. Els instruments s’hi adapten sols.`);
  });
  $('remove-section').addEventListener('click', removeSection);
  $('add-layer').addEventListener('click', addLayer);
  $('copy-previous').addEventListener('click', copyPrevious);
  $('section-lyrics').addEventListener('input', event => { const sec = current(); if (sec) { sec.lyrics = event.target.value; save(); } });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const fileName = () => (song.title || 'nova-canco').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase().slice(0, 90);
  $('download-song').addEventListener('click', async () => {
    if (busy || !song.base.generated) return;
    stop(); setBusy(true);
    try { download(new Blob([audioUtils.encodeWav(await songAudio(), RATE)], { type: 'audio/wav' }), `${fileName()}.wav`); notify('Cançó exportada en WAV estèreo de 44,1 kHz.'); }
    catch (error) { audioError(error); notify(`No s’ha pogut exportar la cançó: ${reasonOf(error)}`); }
    finally { setBusy(false); }
  });
  $('new-song').addEventListener('click', async () => {
    if ((song.base.generated || song.sections.length || song.title !== 'Nova cançó') && !await ask('Començar una cançó nova?', 'Es reemplaçarà l’esborrany actual. Desa primer el projecte si el vols recuperar després.')) return;
    stop(); song = newSong(); selected = null; cache.clear(); cachedFrames = 0; updateSettingsUI(); save(); render();
  });
  $('export-project').addEventListener('click', () => { download(new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' }), `${fileName()}.json`); notify('Projecte desat amb la base, les seccions i els instruments.'); });
  $('import-project').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 300000) throw new Error('Fitxer massa gran');
      migrated = false;
      const imported = validateSong(JSON.parse(await file.text()));
      if (!await ask('Obrir aquest projecte?', 'El projecte importat reemplaçarà l’esborrany actual.')) return;
      stop(); song = imported; selected = song.sections[0]?.id || null; cache.clear(); cachedFrames = 0; updateSettingsUI(); save(); render();
      notify(migrated ? 'Projecte antic convertit: cada part és ara una secció de la línia.' : 'Projecte obert.');
    } catch { notify('Aquest fitxer no és un projecte vàlid de Ska Generator.'); }
  });
  window.addEventListener('pagehide', stop);
  updateSettingsUI(); render();
  if (migrated && storageAvailable) { save(); notify('Projecte anterior convertit al nou flux: cada part és ara una secció de la línia.'); }
  if (!storageAvailable) notify('No s’ha pogut recuperar l’esborrany. Obre un projecte desat o comença una cançó nova.');
})();
