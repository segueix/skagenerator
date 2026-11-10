(() => {
  'use strict';
  // Flux únic: 1) base musical per a tota la cançó, 2) seccions a la línia,
  // que es poden estirar, moure i reordenar, 3) instruments com a clips propis
  // a la seva pista: poden començar i acabar on calgui, fins i tot a mitja secció.
  const engine = window.ElTaulerRadioAmbient, sampleAudio = window.SkaSampleAudio, audioUtils = window.SkaAudioUtils;
  const $ = id => document.getElementById(id);
  const KEY = 'skagenerator.song.v2', OLD_KEY = 'skagenerator.song.v1', RATE = 44100;
  const MIN_BARS = 8, MAX_BARS = 128, MAX_SECONDS = 360, MAX_SECTION = 32, MAX_SECTIONS = 32, MAX_CLIPS = 96, GAP_CHUNK = 8, MAX_REV = 1000000;
  const INSTRUMENTS = engine.SONG_INSTRUMENTS, TYPES = engine.SONG_PARTS, STYLES = engine.SONG_STYLES;
  // Colors vius que funcionen en mode clar i fosc (la interfície els barreja amb el fons).
  const colors = { intro: '#14b8a6', verse: '#8b5cf6', prechorus: '#f97316', chorus: '#ec4899', bridge: '#3b82f6', solo: '#84cc16', outro: '#10b981' };
  const instrumentColors = { guitar: '#22c55e', drums: '#0ea5e9', bass: '#a855f7', trumpet: '#f59e0b', trombone: '#ef4444', synthLead: '#06b6d4', synthPad: '#6366f1', synthBass: '#7c3aed', electronicDrums: '#14b8a6', sax: '#eab308', organ: '#f43f5e' };
  const plurals = { intro: 'les intros', verse: 'les estrofes', prechorus: 'les pretornades', chorus: 'les tornades', bridge: 'els ponts', solo: 'les parts instrumentals', outro: 'els finals' };
  const noteNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const BASE_CHOICES = ['drums', 'electronicDrums', 'bass', 'synthBass', 'guitar', 'organ', 'synthPad'];
  const baseDefaults = style => style === 'urban' ? ['electronicDrums', 'synthBass'] : ['drums', 'bass'];
  const timbreOptions = {
    // «gravat»: mostres nota a nota de VSCO 2 CE, FreePats o el kit Muldjord.
    guitar: [['auto', 'Segons l’estil'], ['clean', 'Guitarra neta · gravada'], ['cleanGm', 'Guitarra neta GM'], ['muted', 'Guitarra apagada GM'], ['overdrive', 'Guitarra saturada GM'], ['distortion', 'Guitarra distorsionada GM']],
    bass: [['auto', 'Segons l’estil'], ['finger', 'Baix amb dits · gravat'], ['pick', 'Baix amb pua · gravat'], ['fingerGm', 'Baix amb dits GM'], ['pickGm', 'Baix amb pua GM']],
    drums: [['auto', 'Segons l’estil'], ['real', 'Bateria Muldjord · gravada'], ['jazz', 'Kit de jazz GM'], ['room', 'Kit de sala GM'], ['standard', 'Bateria acústica GM'], ['brush', 'Escombretes GM'], ['rock', 'Bateria rock GM'], ['electronic', 'Kit electrònic GM']],
    trumpet: [['auto', 'Trompeta · gravada (VSCO)'], ['gm', 'Trompeta GM'], ['bright', 'Trompeta brillant GM'], ['muted', 'Trompeta amb sordina GM']],
    trombone: [['auto', 'Trombó · gravat (VSCO)'], ['gm', 'Trombó GM'], ['warm', 'Trombó càlid GM']]
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

  const newSong = () => ({ version: 3, title: 'Nova cançó', clips: [],
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
  // Versió 2: els instruments eren capes de cada secció. Ara són clips de la
  // línia; les capes iguals de seccions contigües s'uneixen en un sol clip.
  function upgrade(value) {
    if (value?.version !== 2 || !Array.isArray(value.sections)) return value;
    const clips = [];
    for (const s of [...value.sections].filter(Boolean).sort((a, b) => a.start - b.start)) {
      for (const layer of Array.isArray(s.layers) ? s.layers : []) {
        const last = [...clips].reverse().find(c => c.instrument === layer?.instrument);
        if (last && last.start + last.bars === s.start && last.revision === layer.revision && last.generated === layer.generated) last.bars += s.bars;
        else clips.push({ id: uid(), instrument: layer?.instrument, start: s.start, bars: s.bars, revision: layer?.revision, generated: layer?.generated });
      }
      delete s.layers;
    }
    return { ...value, version: 3, clips };
  }
  let migrated = false;
  function validateSong(value) {
    if (value?.version === 1) { value = migrate(value); migrated = true; }
    if (value?.version === 2) { value = upgrade(value); migrated = true; }
    const fail = message => { throw new Error(message); };
    if (!value || value.version !== 3 || typeof value.title !== 'string' || value.title.length > 100) fail('Projecte no vàlid');
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
        || s.start + s.bars > st.bars || (s.mix !== undefined && (!s.mix || typeof s.mix !== 'object' || Array.isArray(s.mix))) || typeof s.lyrics !== 'string' || s.lyrics.length > 5000) fail('Secció no vàlida');
      ids.add(s.id); end = s.start + s.bars;
    }
    if (!Array.isArray(value.clips) || value.clips.length > MAX_CLIPS || value.clips.some(c => !c || typeof c !== 'object')) fail('Instruments no vàlids');
    value.clips.sort((a, b) => a.start - b.start);
    for (const c of value.clips) {
      if (typeof c.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(c.id) || ids.has(c.id) || !Object.hasOwn(INSTRUMENTS, c.instrument)
        || base.instruments.includes(c.instrument) || !Number.isInteger(c.start) || !Number.isInteger(c.bars) || c.start < 0 || c.bars < 1
        || c.start + c.bars > st.bars || !Number.isInteger(c.revision) || c.revision < 1 || c.revision > MAX_REV || typeof c.generated !== 'boolean') fail('Instrument no vàlid');
      if (value.clips.some(o => o !== c && o.instrument === c.instrument && o.start < c.start + c.bars && c.start < o.start + o.bars)) fail('Instruments encavalcats');
      ids.add(c.id);
    }
    if (value.voice !== undefined) {
      const v = value.voice;
      if (!v || typeof v.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(v.id) || typeof v.enabled !== 'boolean'
        || !Number.isFinite(v.volume) || v.volume < -24 || v.volume > 12 || !Number.isFinite(v.offsetMs) || v.offsetMs < -500 || v.offsetMs > 500) fail('Veu no vàlida');
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
  // Clips que sonen dins d'un tram, amb els compassos on sonen.
  function layersFor(s, seg, options) {
    if (options.baseOnly) return null;
    const active = s.clips.filter(c => c.generated && c.start < seg.start + seg.bars && seg.start < c.start + c.bars);
    if (!active.length) return null;
    const layers = {}, ranges = {};
    for (const c of active) {
      layers[c.instrument] ??= c.revision;
      (ranges[c.instrument] ||= []).push([Math.max(0, c.start - seg.start), Math.min(seg.bars, c.start + c.bars - seg.start)]);
    }
    for (const [name, list] of Object.entries(ranges)) if (list.length === 1 && list[0][0] === 0 && list[0][1] === seg.bars) delete ranges[name];
    return { layers, ranges };
  }
  function partFor(s, seg, options = {}) {
    const base = s.base.instruments, extra = layersFor(s, seg, options);
    let part;
    if (!seg.section) {
      // Si la cançó acaba amb base sola, l'últim tram fa de final.
      const last = seg.start + seg.bars === s.settings.bars && seg.bars >= 2;
      part = { type: last ? 'outro' : 'verse', bars: seg.bars, energy: last ? 40 : 55, revision: s.base.revision, groove: s.settings.groove };
    } else {
      const sec = seg.section, harmony = s.harmony[sec.type] || 1;
      part = { type: sec.type, bars: sec.bars, energy: TYPES[sec.type].energy, revision: harmony, groove: s.settings.groove };
      if (sec.mix && Object.keys(sec.mix).length) part.mix = sec.mix;
      if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (harmony - 1) % 5;
    }
    part.instruments = [...base, ...Object.keys(extra?.layers || {})];
    if (extra) { part.layers = extra.layers; if (Object.keys(extra.ranges).length) part.ranges = extra.ranges; }
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
  let selected = song.sections[0]?.id || null, selectedClip = null, busy = false, noticeTimer;
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
      try {
        if (!context || context.state === 'closed') { try { context = new Native({ sampleRate: RATE, latencyHint: 'interactive' }); } catch { context = new Native(); } }
        pending.push(context.resume());
      }
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
    if (recording) finishRecording();
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
      if (kind === 'section') { data = withVoice(await renderSpec(specFor(segmentOf(sec))), frames(sec.start)); startBar = sec.start; bars = sec.bars; }
      else data = kind === 'base' ? await songAudio({ baseOnly: true }) : withVoice(await songAudio(), 0);
      if (token !== playToken) return;
      const clock = await startBuffer(data, token);
      playing = { kind, id: sec?.id, startBar, bars, seconds: data[0].length / RATE, clock };
      document.body.classList.add('playing');
      runTick(token);
    } catch (error) {
      audioError(error); stop();
      notify(`No s’ha pogut reproduir l’àudio: ${reasonOf(error)}`);
    } finally { setBusy(false); }
  }

  // Progrés, capçal de reproducció, secció activa i lletra (també en gravar).
  function runTick(token) {
    const tick = () => {
      if (!playing || token !== playToken) return;
      const elapsed = Math.min(playing.seconds, playing.clock()), bar = playing.startBar + elapsed / barSeconds();
      $('song-progress').value = elapsed / playing.seconds; $('playback-time').textContent = time(elapsed);
      $('playhead').hidden = bar > playing.startBar + playing.bars || bar < 0;
      $('playhead').style.setProperty('--pos', String(Math.max(0, Math.min(1, bar / song.settings.bars))));
      const active = song.sections.find(s => bar >= s.start && bar < s.start + s.bars);
      $('transport-subtitle').textContent = playing.kind === 'record' ? `● Gravant · ${active ? sectionLabel(active) : 'base'}`
        : playing.kind === 'base' ? 'Escoltant · base musical'
        : `Escoltant · ${active ? sectionLabel(active) : 'base'}${playing.kind === 'section' ? ' (secció)' : ''}`;
      if (playing.kind === 'record') {
        $('voice-live-title').textContent = bar < playing.startBar ? 'Prepara’t…' : active ? sectionLabel(active) : 'Base';
        $('voice-live-lyrics').textContent = active?.lyrics || (active ? 'Sense lletra en aquesta secció.' : '');
        $('voice-meter').style.width = `${Math.min(100, Math.round(Math.sqrt(recording?.level || 0) * 140))}%`;
        if (recording) recording.level *= .85;
      }
      animation = requestAnimationFrame(tick);
    };
    tick();
  }

  // ── La teva veu ─────────────────────────────────────────────────────
  // La veu es grava al mateix context d'àudio que reprodueix la música, de
  // manera que la posició de cada mostra es coneix exactament. Es desa a
  // IndexedDB (és massa gran per a localStorage) en 16 bits.
  let voiceData = null, recording = null;
  const voiceDb = {
    open() {
      return this.ready ??= new Promise((resolve, reject) => {
        const request = indexedDB.open('skagenerator', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('voice');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    },
    async run(mode, action) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('voice', mode), request = action(tx.objectStore('voice'));
        tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error);
      });
    },
    get(id) { return this.run('readonly', store => store.get(id)); },
    put(id, value) { return this.run('readwrite', store => store.put(value, id)); },
    remove(id) { return this.run('readwrite', store => store.delete(id)); }
  };
  const toInt16 = data => { const out = new Int16Array(data.length); for (let i = 0; i < data.length; i++) out[i] = Math.max(-1, Math.min(1, data[i])) * 32767; return out; };
  const toFloat = data => { const out = new Float32Array(data.length); for (let i = 0; i < data.length; i++) out[i] = data[i] / 32767; return out; };
  async function loadVoice() {
    voiceData = null;
    if (!song.voice) return;
    try { const stored = await voiceDb.get(song.voice.id); if (stored) voiceData = toFloat(new Int16Array(stored)); }
    catch (error) { console.warn(error); }
    render();
  }
  function withVoice(data, fromFrame) {
    if (!voiceData || !song.voice?.enabled) return data;
    return audioUtils.mixVoice(data, voiceData, { from: fromFrame, gainDb: song.voice.volume, offset: Math.round(song.voice.offsetMs / 1000 * RATE), rate: RATE });
  }
  async function captureNode(ctx, input, onBlock) {
    if (ctx.audioWorklet && window.AudioWorkletNode) {
      if (!ctx.skaRecorder) {
        const code = `class SkaRecorder extends AudioWorkletProcessor { process(inputs) { const ch = inputs[0] && inputs[0][0];
          if (ch) this.port.postMessage({ frame: currentFrame, data: ch.slice(0) }); return true; } }
          registerProcessor('ska-recorder', SkaRecorder);`;
        const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
        ctx.skaRecorder = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
      }
      await ctx.skaRecorder;
      const node = new AudioWorkletNode(ctx, 'ska-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
      node.port.onmessage = ({ data }) => onBlock(data.frame, data.data);
      input.connect(node); return node;
    }
    // Navegadors sense AudioWorklet: aproximació amb ScriptProcessor (l'ajust de sincronia ho afina).
    const node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = event => onBlock(Math.round((event.playbackTime - 4096 / ctx.sampleRate) * ctx.sampleRate), event.inputBuffer.getChannelData(0).slice(0));
    input.connect(node); return node;
  }
  async function startRecording(fromBar) {
    if (busy || recording || !song.base.generated) return;
    if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) { notify('Aquest navegador no permet gravar amb el micròfon.'); return; }
    stop();
    const token = playToken, unlocked = unlockAudio(), headphones = $('voice-headphones').checked;
    let stream;
    setBusy(true);
    try {
      // Amb auriculars, sense processaments: so més net. Sense auriculars, la
      // cancel·lació d'eco evita que el micròfon torni a gravar la música.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !headphones, noiseSuppression: !headphones, autoGainControl: false, channelCount: 1 } });
      await unlocked;
      if (!context || context.state !== 'running') throw new Error('El navegador no ha activat l’àudio. Torna-ho a provar.');
      const data = await songAudio();
      if (token !== playToken) { stream.getTracks().forEach(t => t.stop()); return; }
      const ctx = context, from = frames(fromBar), lead = .35, startAt = ctx.currentTime + lead;
      const input = ctx.createMediaStreamSource(stream), silent = ctx.createGain(); silent.gain.value = 0;
      const blocks = [];
      const rec = { stream, blocks, input, silent, ctx, from, startFrame: Math.round(startAt * ctx.sampleRate), fromBar, level: 0,
        latency: (ctx.baseLatency || 0) + (ctx.outputLatency || 0) + (stream.getAudioTracks()[0]?.getSettings?.().latency || 0) };
      rec.node = await captureNode(ctx, input, (frame, block) => {
        blocks.push([frame, block]);
        let peak = 0; for (const x of block) peak = Math.max(peak, Math.abs(x));
        rec.level = Math.max(rec.level, peak);
      });
      rec.node.connect(silent); silent.connect(ctx.destination);
      source = ctx.createBufferSource(); source.buffer = makeBuffer(ctx, data);
      gainNode = ctx.createGain(); gainNode.gain.value = .8; source.connect(gainNode); gainNode.connect(ctx.destination);
      source.onended = () => { if (token === playToken) { stop(); render(); } };
      source.start(startAt, from / RATE);
      recording = rec;
      playing = { kind: 'record', startBar: fromBar, bars: song.settings.bars - fromBar, seconds: data[0].length / RATE - from / RATE + lead,
        clock: () => ctx.currentTime - startAt + lead };
      // El capçal comença un instant abans perquè la primera nota no sorprengui.
      playing.startBar = fromBar - lead / barSeconds();
      document.body.classList.add('playing', 'recording');
      runTick(token);
      notify(fromBar ? `Gravant des del compàs ${fromBar + 1}. Prem ■ per acabar.` : 'Gravant. Canta mentre sona la cançó i prem ■ per acabar.');
    } catch (error) {
      stream?.getTracks().forEach(t => t.stop());
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      notify(denied ? 'No hi ha permís per fer servir el micròfon. Activa’l a la configuració del navegador.'
        : error?.name === 'NotFoundError' ? 'No s’ha trobat cap micròfon.' : `No s’ha pogut començar a gravar: ${reasonOf(error)}`);
      console.error(error);
    } finally { setBusy(false); }
  }
  function finishRecording() {
    const rec = recording; recording = null;
    document.body.classList.remove('recording');
    try { rec.input.disconnect(); rec.node.disconnect(); rec.silent.disconnect(); } catch {}
    if (rec.node.port) rec.node.port.onmessage = null; else rec.node.onaudioprocess = null;
    rec.stream.getTracks().forEach(t => t.stop());
    if (!rec.blocks.length) return;
    // Mostres seguides des del primer bloc; la posició a la cançó descompta
    // l'arrencada i la latència d'entrada i de sortida.
    const first = rec.blocks[0][0], total = rec.blocks.reduce((n, [, b]) => n + b.length, 0), raw = new Float32Array(total);
    let at = 0; for (const [, block] of rec.blocks) { raw.set(block, at); at += block.length; }
    const take = audioUtils.levelTake(audioUtils.resampleLinear(raw, rec.ctx.sampleRate, RATE));
    const position = Math.round(((first - rec.startFrame) / rec.ctx.sampleRate - rec.latency) * RATE) + rec.from;
    const keepFrom = Math.max(rec.from, position), start = Math.max(0, keepFrom - position);
    const trimmed = take.subarray(start);
    if (trimmed.length < RATE * .3) { notify('La gravació és massa curta i no s’ha desat.'); return; }
    voiceData = audioUtils.placeTake(voiceData, trimmed, keepFrom, keepFrom);
    song.voice ??= { id: uid(), enabled: true, volume: 0, offsetMs: 0 };
    song.voice.enabled = true; save();
    voiceDb.put(song.voice.id, toInt16(voiceData).buffer)
      .then(() => notify('Veu desada. Prem «Escolta amb la veu» o ▶ per sentir-ho tot junt.'))
      .catch(() => notify('La veu sona, però no s’ha pogut desar al navegador. Descarrega-la si la vols conservar.'));
  }
  async function deleteVoice() {
    if (!song.voice || busy) return;
    if (!await ask('Esborrar la veu?', 'S’eliminarà la veu gravada d’aquesta cançó. La música es conserva.')) return;
    stop(); const id = song.voice.id; delete song.voice; voiceData = null; save(); render();
    voiceDb.remove(id).catch(() => {});
  }
  function renderVoice() {
    const has = !!voiceData, sec = current();
    $('voice-state').textContent = recording ? '● Gravant' : has ? 'Veu gravada ✓' : song.voice ? 'No és en aquest navegador' : 'Sense gravar';
    $('voice-state').classList.toggle('ready', has); $('voice-state').classList.toggle('live', !!recording);
    $('voice-live').hidden = !recording; $('voice-controls').hidden = !has || !!recording;
    $('record-song').textContent = has ? '● Torna a gravar des del principi' : '● Grava des del principi';
    $('record-section').hidden = !sec;
    if (sec) $('record-section').textContent = `● Grava des del compàs ${sec.start + 1} · ${sectionLabel(sec)}`;
    for (const key of ['record-song', 'record-section']) $(key).disabled = busy || !!recording || !song.base.generated;
    if (song.voice) {
      $('voice-enabled').checked = song.voice.enabled;
      $('voice-volume').value = song.voice.volume; $('voice-volume-value').textContent = `${song.voice.volume > 0 ? '+' : ''}${song.voice.volume} dB`;
      $('voice-offset').value = song.voice.offsetMs; $('voice-offset-value').textContent = `${song.voice.offsetMs > 0 ? '+' : ''}${song.voice.offsetMs} ms`;
    }
    $('play-voice').textContent = playing?.kind === 'song' ? '■ Atura' : '▷ Escolta amb la veu';
    for (const key of ['voice-enabled', 'voice-volume', 'voice-offset', 'play-voice', 'download-voice', 'delete-voice']) $(key).disabled = busy;
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
  const endOf = item => item.start + item.bars;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const sectionAt = bar => song.sections.find(s => bar >= s.start && bar < endOf(s));
  const clipLabel = clip => `${INSTRUMENTS[clip.instrument]} · compassos ${clip.start + 1}–${endOf(clip)}`;
  const overlaps = (a, b) => a.start < endOf(b) && b.start < endOf(a);
  async function generateClip(clip) {
    if (busy || !song.base.generated) return;
    stop();
    const before = { revision: clip.revision, generated: clip.generated }, home = sectionAt(clip.start);
    let reused = null;
    if (!clip.generated) {
      // Un instrument que entra en una secció del mateix tipus repeteix la idea, com una tornada.
      reused = home && song.clips.find(c => c !== clip && c.generated && c.instrument === clip.instrument && sectionAt(c.start)?.type === home.type);
      if (reused) clip.revision = reused.revision;
    } else { const previous = clip.revision; do clip.revision = newRev(); while (clip.revision === previous); }
    clip.generated = true;
    setBusy(true);
    try {
      for (const seg of segmentsOf(song)) if (overlaps(seg, clip)) await renderSpec(specFor(seg));
      save();
      notify(reused ? `${INSTRUMENTS[clip.instrument]}: repeteix la idea de ${sectionLabel(sectionAt(reused.start))}. Prem «Genera’n una altra» per variar-la.`
        : `${clipLabel(clip)} generat. Escolta la secció o tota la cançó.`);
    } catch (error) {
      Object.assign(clip, before); audioError(error); notify(`No s’ha pogut generar l’instrument: ${reasonOf(error)}`);
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
    const sec = { id: uid(), type, start, bars, lyrics: '' };
    song.sections.push(sec); song.sections.sort((a, b) => a.start - b.start);
    selected = sec.id; stop(); save(); render();
    notify(`${sectionLabel(sec)} marcada als compassos ${start + 1}–${start + bars}. Ara afegeix-hi un instrument.`);
  }
  function previousSection(sec) { return song.sections.filter(s => s.start < sec.start).at(-1); }
  function changeSection(field, raw) {
    const sec = current(); if (!sec || busy) return;
    const value = Math.round(Number(raw));
    if (field === 'type') { sec.type = raw; song.harmony[raw] ??= newRev(); }
    else if (!Number.isFinite(value)) notify('Escriu un nombre de compassos.');
    else if (field === 'start') moveSection(sec, value - 1, null);
    else if (field === 'bars') resizeSectionRight(sec, value);
    stop(); save(); render();
  }
  async function removeSection() {
    const sec = current(); if (!sec || busy) return;
    const inside = song.clips.filter(c => c.start >= sec.start && endOf(c) <= endOf(sec));
    if ((inside.length || sec.lyrics) && !await ask(`Eliminar ${sectionLabel(sec).toLowerCase()}?`,
      'S’eliminaran la secció i els instruments que només sonen dins seu. En aquest tram sonarà la base.')) return;
    stop(); const index = song.sections.indexOf(sec); song.sections.splice(index, 1);
    song.clips = song.clips.filter(c => !inside.includes(c));
    selected = song.sections[Math.min(index, song.sections.length - 1)]?.id || null; save(); render();
  }

  // ── Edició de la línia: seccions ───────────────────────────────────
  const maxSongBars = () => Math.min(MAX_BARS, Math.floor(MAX_SECONDS / barSeconds()));
  const contentEnd = () => Math.max(0, ...song.sections.map(endOf), ...song.clips.map(endOf));
  // Afegeix (delta > 0) o treu (delta < 0) compassos a la posició «edge»: tot el
  // que ve després es desplaça, i els instruments que hi passen per sobre o hi
  // acaben s'allarguen o s'escurcen amb la secció.
  function ripple(edge, delta) {
    const map = x => x >= edge ? x + delta : delta < 0 ? Math.min(x, edge + delta) : x;
    for (const s of song.sections) if (s.start >= edge) s.start += delta;
    for (const c of song.clips) { const start = c.start >= edge ? c.start + delta : map(c.start), end = map(endOf(c)); c.start = start; c.bars = end - start; }
    song.clips = song.clips.filter(c => c.bars >= 1);
  }
  // Si la cançó acabava amb l'última secció, la durada la segueix.
  function fitSong(tight, delta) {
    const st = song.settings;
    if (tight) st.bars += delta;
    st.bars = clamp(Math.max(st.bars, contentEnd()), MIN_BARS, MAX_BARS);
  }
  function resizeSectionRight(sec, bars) {
    const newBars = clamp(bars, 1, MAX_SECTION), delta = newBars - sec.bars;
    if (!delta) return true;
    const edge0 = endOf(sec), newEnd = Math.max(0, ...[...song.sections, ...song.clips].map(item => endOf(item) >= edge0 ? endOf(item) + delta : endOf(item)));
    if (delta > 0 && newEnd > maxSongBars()) {
      notify(`La cançó no pot passar de ${maxSongBars()} compassos (${time(maxSongBars() * barSeconds())}).`); return false;
    }
    const tight = Math.max(0, ...song.sections.map(endOf)) === song.settings.bars, edge = endOf(sec);
    sec.bars = newBars; ripple(edge, delta);
    fitSong(tight, delta);
    return true;
  }
  function resizeSectionLeft(sec, start) {
    const previous = song.sections.filter(s => s !== sec && s.start < sec.start).at(-1);
    const end = endOf(sec), newStart = clamp(start, Math.max(previous ? endOf(previous) : 0, end - MAX_SECTION), end - 1);
    // Els instruments que entraven amb la secció hi continuen entrant.
    for (const c of song.clips) if (c.start === sec.start && endOf(c) > newStart && !song.clips.some(o => o !== c && o.instrument === c.instrument && o.start < c.start && endOf(o) > newStart)) {
      c.bars = endOf(c) - newStart; c.start = newStart;
    }
    sec.start = newStart; sec.bars = end - newStart;
    return true;
  }
  function freeFor(sec, start) {
    return start >= 0 && start + sec.bars <= song.settings.bars
      && !song.sections.some(s => s !== sec && s.start < start + sec.bars && start < endOf(s));
  }
  // Moure una secció: si cap en un espai lliure, s'hi col·loca (amb els
  // instruments que sonen només dins seu); si cau sobre una altra secció,
  // les seccions es reordenen i la resta es desplaça.
  function moveSection(sec, start, pointerBar) {
    if (start === sec.start) return true;
    if (freeFor(sec, start)) {
      const delta = start - sec.start, inside = song.clips.filter(c => c.start >= sec.start && endOf(c) <= endOf(sec));
      for (const c of inside) {
        const moved = { ...c, start: c.start + delta };
        if (!song.clips.some(o => o !== c && !inside.includes(o) && o.instrument === c.instrument && overlaps(o, moved))) c.start = moved.start;
      }
      sec.start = start; song.sections.sort((a, b) => a.start - b.start);
      return true;
    }
    if (pointerBar === null) { notify('En aquest punt hi ha una altra secció. Arrossega-la a la línia per reordenar-les.'); return false; }
    const target = sectionAt(clamp(pointerBar, 0, song.settings.bars - 1));
    if (!target || target === sec) { notify('Deixa-la anar sobre una altra secció per canviar l’ordre, o en un espai lliure.'); return false; }
    const after = pointerBar >= target.start + target.bars / 2;
    reorder(sec, after ? song.sections[song.sections.indexOf(target) + 1] || null : target);
    return true;
  }
  function reorder(sec, before) {
    const items = []; let at = 0;
    for (const s of song.sections) { if (s.start > at) items.push({ start: at, bars: s.start - at }); items.push({ start: s.start, bars: s.bars, section: s }); at = endOf(s); }
    if (at < song.settings.bars) items.push({ start: at, bars: song.settings.bars - at });
    const moving = items.find(item => item.section === sec);
    items.splice(items.indexOf(moving), 1);
    let index = before ? items.findIndex(item => item.section === before) : -1;
    if (index < 0) { const sectionsOnly = items.filter(item => item.section); index = sectionsOnly.length ? items.indexOf(sectionsOnly.at(-1)) + 1 : 0; }
    items.splice(index, 0, moving);
    let position = 0;
    for (const item of items) { item.to = position; position += item.bars; }
    const map = x => { const item = items.find(i => x >= i.start && x < i.start + i.bars); return item ? item.to + x - item.start : x; };
    for (const c of song.clips) c.start = map(c.start);
    for (const item of items) if (item.section) item.section.start = item.to;
    song.sections.sort((a, b) => a.start - b.start);
    resolveClips();
  }
  // Dos clips del mateix instrument no es poden trepitjar: l'anterior s'escurça.
  function resolveClips() {
    song.clips.sort((a, b) => a.start - b.start);
    for (const c of song.clips) c.bars = Math.min(c.bars, song.settings.bars - c.start);
    for (const name of Object.keys(INSTRUMENTS)) {
      const list = song.clips.filter(c => c.instrument === name);
      for (let i = 1; i < list.length; i++) if (list[i].start < endOf(list[i - 1])) list[i - 1].bars = list[i].start - list[i - 1].start;
    }
    song.clips = song.clips.filter(c => c.bars >= 1);
  }

  // ── Edició de la línia: instruments ────────────────────────────────
  function clipBounds(clip, instrument = clip.instrument) {
    const others = song.clips.filter(c => c !== clip && c.instrument === instrument);
    const before = others.filter(c => endOf(c) <= clip.start).map(endOf), after = others.filter(c => c.start >= endOf(clip)).map(c => c.start);
    return [Math.max(0, ...before), Math.min(song.settings.bars, ...after)];
  }
  function addClip(instrument, from, to) {
    if (song.clips.length >= MAX_CLIPS) { notify(`Com a màxim hi pot haver ${MAX_CLIPS} clips d’instrument.`); return null; }
    const others = song.clips.filter(c => c.instrument === instrument);
    let start = from;
    for (const c of others.sort((a, b) => a.start - b.start)) if (c.start <= start && endOf(c) > start) start = endOf(c);
    const next = Math.min(to, ...others.filter(c => c.start >= start).map(c => c.start));
    if (next - start < 1) { notify(`${INSTRUMENTS[instrument]} ja sona en aquest tram. Estira el seu clip a la línia si el vols allargar.`); return null; }
    const clip = { id: uid(), instrument, start, bars: next - start, revision: newRev(), generated: false };
    song.clips.push(clip); song.clips.sort((a, b) => a.start - b.start); selectedClip = clip.id;
    return clip;
  }
  function addLayer() {
    const sec = current(), instrument = $('layer-instrument').value;
    if (!sec || busy || !Object.hasOwn(INSTRUMENTS, instrument)) return;
    const clip = addClip(instrument, sec.start, endOf(sec));
    if (!clip) return;
    save(); render();
    notify(`${clipLabel(clip)} afegit. Prem «Genera» per crear-ne la part; després pots estirar-lo a la línia.`);
  }
  function removeClip(clip) { if (busy) return; stop(); song.clips = song.clips.filter(c => c !== clip); save(); render(); }
  // Allarga fins al final d'aquesta secció els instruments que acabaven a l'anterior.
  function extendPrevious() {
    const sec = current(), previous = sec && previousSection(sec);
    if (!sec || busy || !previous) return;
    let count = 0;
    for (const c of song.clips.filter(c => endOf(c) === endOf(previous))) {
      const [, limit] = clipBounds(c);
      if (limit >= endOf(sec)) { c.bars = endOf(sec) - c.start; count++; }
    }
    stop(); save(); render();
    notify(count ? `${count} instrument${count > 1 ? 's' : ''} de ${sectionLabel(previous)} continuen fins al final de ${sectionLabel(sec)}.` : 'No hi ha instruments que es puguin allargar fins aquí.');
  }

  // ── Arrossegar amb el cursor ───────────────────────────────────────
  let drag = null;
  const pct = bars => `${bars / song.settings.bars * 100}%`;
  function bindDrag(element, kind, item) {
    element.addEventListener('pointerdown', event => beginDrag(event, kind, item, event.target.dataset.edge || 'move'));
    element.addEventListener('pointermove', dragMove);
    element.addEventListener('pointerup', dragEnd);
    element.addEventListener('pointercancel', () => { if (drag) { drag = null; render(); } });
  }
  function beginDrag(event, kind, item, mode) {
    if (busy || event.button > 0) return;
    event.preventDefault(); event.stopPropagation();
    const element = event.currentTarget, rect = element.parentElement.getBoundingClientRect();
    drag = { kind, item, mode, element, x0: event.clientX, left: rect.left, perBar: rect.width / song.settings.bars, delta: 0, moved: false, pointer: event.pointerId };
    try { element.setPointerCapture(event.pointerId); } catch {}
  }
  function preview(d) {
    const { item, mode, delta, kind } = d, total = song.settings.bars;
    const [lo, hi] = kind === 'clip' ? clipBounds(item) : [0, total];
    if (mode === 'move') return [clamp(item.start + delta, 0, total - item.bars), item.bars];
    if (mode === 'right') return [item.start, clamp(item.bars + delta, 1, kind === 'section' ? MAX_SECTION : hi - item.start)];
    const start = clamp(item.start + delta, kind === 'clip' ? lo : 0, endOf(item) - 1);
    return [start, endOf(item) - start];
  }
  function dragMove(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x0;
    if (Math.abs(dx) > 4 && !drag.moved) { drag.moved = true; drag.element.classList.add('dragging'); }
    if (!drag.moved) return;
    drag.delta = Math.round(dx / drag.perBar);
    const [start, bars] = preview(drag);
    drag.element.style.left = pct(start); drag.element.style.width = pct(bars);
    drag.element.dataset.hint = drag.mode === 'move' ? `compàs ${start + 1}` : `${bars} c. · ${time(bars * barSeconds())}`;
  }
  function dragEnd(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const d = drag; drag = null;
    if (!d.moved) {
      if (d.kind === 'section') { selected = d.item.id; selectedClip = null; if (mobile.matches) { render(); setTab('section'); return; } }
      else { selectedClip = d.item.id; selected = sectionAt(d.item.start)?.id ?? selected; }
      render(); return;
    }
    stop();
    const [start, bars] = preview(d), pointerBar = Math.floor((event.clientX - d.left) / d.perBar);
    let done;
    if (d.kind === 'section') {
      done = d.mode === 'move' ? moveSection(d.item, start, pointerBar) : d.mode === 'right' ? resizeSectionRight(d.item, bars) : resizeSectionLeft(d.item, start);
      selected = d.item.id;
    } else {
      const clip = d.item;
      if (d.mode === 'move') {
        const moved = { ...clip, start };
        done = !song.clips.some(o => o !== clip && o.instrument === clip.instrument && overlaps(o, moved));
        if (done) clip.start = start; else notify(`Aquí ja sona un altre clip de ${INSTRUMENTS[clip.instrument].toLowerCase()}.`);
      } else { clip.start = start; clip.bars = bars; done = true; }
      song.clips.sort((a, b) => a.start - b.start); selectedClip = clip.id;
    }
    if (done) save();
    render();
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
    const kept = song.clips.filter(c => !instruments.includes(c.instrument)), removed = song.clips.length - kept.length;
    song.clips = kept;
    if (removed) notify('Els instruments que ara formen part de la base ja sonen a totes les seccions.');
  }
  function updateSettingsUI() {
    const st = song.settings, profile = STYLES[st.style];
    $('song-title').value = song.title; $('song-style').value = st.style;
    $('song-bpm').min = profile.bpm.min; $('song-bpm').max = profile.bpm.max; $('song-bpm').value = st.bpm;
    fillSelect($('song-key'), profile.keys.map(([tonic, mode]) => [`${tonic}:${mode}`, `${noteNames[tonic]} ${mode === 'major' ? 'major' : 'menor'}`]), `${st.tonic}:${st.mode}`);
    $('song-bars').max = Math.min(MAX_BARS, Math.floor(MAX_SECONDS / barSeconds())); $('song-bars').value = st.bars;
    $('style-description').textContent = `${profile.name} · ${profile.description} La base (bateria i baix) sona durant tota la cançó: genera-la i escolta-la abans d’afegir res més. Per defecte sonen instruments gravats nota a nota.`;
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
        const lost = song.sections.filter(s => s.start + s.bars > bars), lostClips = song.clips.some(c => endOf(c) > bars);
        if ((lost.length || lostClips) && !await ask('Escurçar la cançó?', `${lost.length ? lost.map(sectionLabel).join(', ') : 'Alguns instruments'} queda${lost.length > 1 ? 'en' : ''} fora o s’escurçarà. La resta es conserva.`)) { updateSettingsUI(); return; }
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
    song.clips = song.clips.filter(c => c.start < bars); resolveClips();
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
  function handles(element) {
    for (const edge of ['left', 'right']) {
      const handle = document.createElement('i'); handle.className = `handle ${edge}`; handle.dataset.edge = edge;
      handle.title = edge === 'left' ? 'Arrossega per moure l’inici' : 'Arrossega per allargar o escurçar'; element.append(handle);
    }
  }
  function renderLine() {
    const total = song.settings.bars;
    $('line').style.setProperty('--bars', total);
    const ruler = $('line-ruler'); ruler.replaceChildren();
    const step = total > 64 ? 8 : 4;
    for (let b = 0; b < total; b += step) { const tick = span(ruler, b, step, 'tick', String(b + 1)); tick.title = time(b * barSeconds()); }
    const track = $('section-track'); track.replaceChildren(); track.classList.toggle('locked', !song.base.generated || busy);
    for (const sec of song.sections) {
      const block = document.createElement('div'); block.tabIndex = 0; block.setAttribute('role', 'button');
      block.className = `line-section${sec.id === selected ? ' selected' : ''}${busy ? ' disabled' : ''}`;
      block.style.left = pct(sec.start); block.style.width = pct(sec.bars); block.style.setProperty('--color', colors[sec.type]);
      block.setAttribute('aria-label', `${sectionLabel(sec)}, compassos ${sec.start + 1} a ${endOf(sec)}. Arrossega per moure-la o reordenar-la; fletxes per allargar-la, Maj+fletxes per moure-la.`);
      const name = document.createElement('strong'); name.textContent = sectionLabel(sec);
      const count = song.clips.filter(c => c.generated && overlaps(c, sec)).length;
      const info = document.createElement('small'); info.textContent = `${sec.bars} c. · ${count} instr.`;
      block.append(name, info); handles(block); bindDrag(block, 'section', sec);
      block.addEventListener('keydown', event => {
        if (busy) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = sec.id; selectedClip = null; render(); return; }
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault(); stop();
        if (event.shiftKey ? moveSection(sec, sec.start + step, null) : resizeSectionRight(sec, sec.bars + step)) save();
        selected = sec.id; render();
        document.querySelector('.line-section.selected')?.focus();
      });
      track.append(block);
    }
    const baseTrack = $('base-track'); baseTrack.replaceChildren();
    span(baseTrack, 0, total, `line-base${song.base.generated ? ' ready' : ''}`,
      `${song.base.instruments.map(name => INSTRUMENTS[name]).join(' + ')}${song.base.generated ? '' : ' · pendent de generar'}`);
    const rows = $('layer-rows'); rows.replaceChildren();
    const used = [];
    for (const c of song.clips) if (!used.includes(c.instrument)) used.push(c.instrument);
    for (const name of used) {
      const row = document.createElement('div'); row.className = 'line-row';
      const label = document.createElement('span'); label.className = 'line-label'; label.textContent = INSTRUMENTS[name];
      const lane = document.createElement('div'); lane.className = 'line-track lane'; lane.title = `Fes clic en un espai buit per afegir ${INSTRUMENTS[name].toLowerCase()}`;
      lane.style.setProperty('--color', instrumentColors[name]);
      for (const clip of song.clips.filter(c => c.instrument === name)) {
        const element = document.createElement('div'); element.tabIndex = 0; element.setAttribute('role', 'button');
        element.className = `line-clip${clip.generated ? ' ready' : ''}${clip.id === selectedClip ? ' selected' : ''}`;
        element.style.left = pct(clip.start); element.style.width = pct(clip.bars);
        element.title = `${clipLabel(clip)}${clip.generated ? '' : ' · pendent de generar'}`;
        element.setAttribute('aria-label', `${element.title}. Arrossega per moure’l o estira’l per les vores.`);
        handles(element); bindDrag(element, 'clip', clip);
        lane.append(element);
      }
      lane.addEventListener('click', event => {
        if (busy || event.target !== lane) return;
        const rect = lane.getBoundingClientRect(), bar = clamp(Math.floor((event.clientX - rect.left) / rect.width * total), 0, total - 1);
        const home = sectionAt(bar), clip = addClip(name, home ? home.start : Math.floor(bar / 4) * 4, home ? endOf(home) : Math.min(total, Math.floor(bar / 4) * 4 + 4));
        if (!clip) return;
        selected = sectionAt(clip.start)?.id ?? selected; save(); render();
        notify(`${clipLabel(clip)} afegit. Prem «Genera» al panell de la secció.`);
      });
      row.append(label, lane); rows.append(row);
    }
    $('line-hint').textContent = !song.base.generated ? 'Primer genera la base (pas 1).'
      : song.sections.length ? 'Arrossega una secció per moure-la o reordenar-la, i estira-la per les vores. Els instruments també es poden moure i estirar.'
      : 'Fes clic a la fila «Seccions» on vulguis que comenci la primera secció.';
  }
  function renderSection() {
    const sec = current(), editor = $('section-editor');
    editor.hidden = !sec; $('section-empty').hidden = !!sec;
    $('section-empty').textContent = !song.base.generated ? '3 · Quan tinguis la base, marca una secció a la línia per afegir-hi instruments.'
      : '3 · Marca una secció a la línia (o prem «Afegeix una secció al final») per començar a afegir instruments.';
    if (!sec) return;
    const seg = segmentOf(sec);
    $('section-title').textContent = `${sectionLabel(sec)} · compassos ${sec.start + 1}–${endOf(sec)}`;
    $('section-type').value = sec.type;
    $('section-start').value = sec.start + 1; $('section-start').min = 1; $('section-start').max = song.settings.bars - sec.bars + 1;
    $('section-start-time').textContent = time(sec.start * barSeconds());
    $('section-bars').value = sec.bars; $('section-bars').max = MAX_SECTION;
    $('section-time').textContent = time(sec.bars * barSeconds());
    $('section-chords').textContent = `Acords: ${chordsOf(seg)}`;
    $('section-reharmonize').textContent = song.sections.filter(s => s.type === sec.type).length > 1 ? `↻ Altres acords per a totes ${plurals[sec.type]}` : '↻ Altres acords';
    $('section-lyrics').value = sec.lyrics;
    const list = $('layer-list'); list.replaceChildren();
    const clips = song.clips.filter(c => overlaps(c, sec));
    if (!clips.length) {
      const empty = document.createElement('li'); empty.className = 'layer-empty';
      empty.textContent = 'Encara només sona la base. Tria un instrument a sota i afegeix-lo.'; list.append(empty);
    }
    clips.forEach((clip, index) => {
      const item = document.createElement('li'); item.className = `layer-row${clip.generated ? ' ready' : ''}${clip.id === selectedClip ? ' selected' : ''}`;
      item.style.setProperty('--color', instrumentColors[clip.instrument]);
      const number = document.createElement('span'); number.className = 'layer-number'; number.textContent = String(index + 1);
      const text = document.createElement('div'); text.className = 'layer-title';
      const name = document.createElement('strong'); name.textContent = INSTRUMENTS[clip.instrument];
      const outside = clip.start < sec.start || endOf(clip) > endOf(sec);
      const state = document.createElement('small');
      state.textContent = `${clip.generated ? 'Generat ✓' : 'Pendent de generar'} · compassos ${clip.start + 1}–${endOf(clip)}${outside ? ' (passa a altres seccions)' : ''}`;
      text.append(name, state);
      const generate = document.createElement('button'); generate.type = 'button';
      generate.className = `button ${clip.generated ? '' : 'primary'}`; generate.textContent = clip.generated ? '↻ Genera’n una altra' : '✦ Genera';
      generate.disabled = busy || !song.base.generated; generate.addEventListener('click', () => generateClip(clip));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Eliminar ${clipLabel(clip)}`); remove.title = 'Elimina aquest clip'; remove.disabled = busy;
      remove.addEventListener('click', () => removeClip(clip));
      item.append(number, text, generate, remove); list.append(item);
    });
    const available = Object.keys(INSTRUMENTS).filter(name => !song.base.instruments.includes(name) && !clips.some(c => c.instrument === name && c.start <= sec.start && endOf(c) >= endOf(sec)));
    const chosen = available.includes($('layer-instrument').value) ? $('layer-instrument').value : available[0];
    fillSelect($('layer-instrument'), available.map(name => [name, INSTRUMENTS[name]]), chosen);
    $('layer-instrument').disabled = busy || !available.length; $('add-layer').disabled = busy || !available.length;
    const previous = previousSection(sec), extendable = previous && song.clips.some(c => endOf(c) === endOf(previous) && clipBounds(c)[1] >= endOf(sec));
    $('copy-previous').hidden = !extendable;
    if (previous) $('copy-previous').textContent = `⇢ Allarga fins aquí els instruments de ${sectionLabel(previous)}`;
    const pending = clips.some(c => !c.generated);
    $('play-section').textContent = playing?.kind === 'section' && playing.id === sec.id ? '■ Atura' : `▷ Escolta la secció${pending ? ' (sense els pendents)' : ''}`;
    $('play-song-inline').textContent = playing?.kind === 'song' ? '■ Atura la cançó' : '▷ Escolta tota la cançó';
  }
  // ── Equalitzadors ──────────────────────────────────────────────────
  function eqNames(sec) {
    const names = song.base.instruments.slice();
    for (const c of song.clips) if ((!sec || overlaps(c, sec)) && !names.includes(c.instrument)) names.push(c.instrument);
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
    const generatedLayers = song.clips.filter(c => c.generated).length;
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
    renderTabs(); renderVoice();
  }

  // ── Mòbil: un pas per pantalla, amb pestanyes ──────────────────────
  const mobile = window.matchMedia('(max-width: 899px)');
  function setTab(name, scroll = true) {
    document.body.dataset.tab = name;
    for (const tab of document.querySelectorAll('.tab')) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    try { sessionStorage.setItem('skagenerator.tab', name); } catch {}
    if (scroll && mobile.matches) window.scrollTo(0, 0);
  }
  for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => setTab(tab.dataset.tab));
  for (const button of document.querySelectorAll('[data-go]')) button.addEventListener('click', () => setTab(button.dataset.go));
  function renderTabs() {
    $('tab-base').textContent = song.base.generated ? '✓' : '';
    $('tab-line').textContent = song.sections.length ? String(song.sections.length) : '';
    const pending = song.clips.filter(c => !c.generated).length;
    $('tab-section').textContent = pending ? String(pending) : '';
    $('tab-voice').textContent = recording ? '●' : voiceData ? '✓' : '';
    $('next-line').disabled = !song.base.generated;
    $('next-section').disabled = !current();
    $('next-section').textContent = current() ? `Edita ${sectionLabel(current()).toLowerCase()} →` : 'Edita la secció →';
  }
  // ── Mode clar i fosc ───────────────────────────────────────────────
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : darkQuery.matches;
  function paintTheme() {
    $('theme-toggle').firstElementChild.textContent = isDark() ? '☀' : '☾';
    $('theme-toggle').setAttribute('aria-label', isDark() ? 'Canvia a mode clar' : 'Canvia a mode fosc');
    $('theme-color').content = isDark() ? '#0b0a12' : '#151325';
  }
  $('theme-toggle').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark', root = document.documentElement;
    // Sense transicions durant el canvi: tot canvia de cop.
    root.classList.add('theme-switching');
    root.dataset.theme = next;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    try { localStorage.setItem('skagenerator.theme', next); } catch {}
    paintTheme();
  });
  darkQuery.addEventListener?.('change', paintTheme);
  paintTheme();

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
  $('copy-previous').addEventListener('click', extendPrevious);
  $('section-lyrics').addEventListener('input', event => { const sec = current(); if (sec) { sec.lyrics = event.target.value; save(); } });
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const fileName = () => (song.title || 'nova-canco').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase().slice(0, 90);
  $('download-song').addEventListener('click', async () => {
    if (busy || !song.base.generated) return;
    stop(); setBusy(true);
    try { download(new Blob([audioUtils.encodeWav(withVoice(await songAudio(), 0), RATE)], { type: 'audio/wav' }), `${fileName()}.wav`); notify(voiceData && song.voice?.enabled ? 'Cançó exportada amb la teva veu (WAV estèreo de 44,1 kHz).' : 'Cançó exportada en WAV estèreo de 44,1 kHz.'); }
    catch (error) { audioError(error); notify(`No s’ha pogut exportar la cançó: ${reasonOf(error)}`); }
    finally { setBusy(false); }
  });
  $('new-song').addEventListener('click', async () => {
    if ((song.base.generated || song.sections.length || song.title !== 'Nova cançó') && !await ask('Començar una cançó nova?', 'Es reemplaçarà l’esborrany actual. Desa primer el projecte si el vols recuperar després.')) return;
    stop(); const oldVoice = song.voice?.id; song = newSong(); selected = null; voiceData = null; cache.clear(); cachedFrames = 0; updateSettingsUI(); save(); render();
    if (oldVoice) voiceDb.remove(oldVoice).catch(() => {});
  });
  $('export-project').addEventListener('click', () => { download(new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' }), `${fileName()}.json`); notify(song.voice ? 'Projecte desat. La veu es queda en aquest navegador: descarrega-la a part si la vols portar a un altre lloc.' : 'Projecte desat amb la base, les seccions i els instruments.'); });
  $('import-project').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 300000) throw new Error('Fitxer massa gran');
      migrated = false;
      const imported = validateSong(JSON.parse(await file.text()));
      if (!await ask('Obrir aquest projecte?', 'El projecte importat reemplaçarà l’esborrany actual.')) return;
      stop(); song = imported; selected = song.sections[0]?.id || null; cache.clear(); cachedFrames = 0; updateSettingsUI(); save(); render(); loadVoice();
      notify(migrated ? 'Projecte antic convertit: cada part és ara una secció de la línia.' : 'Projecte obert.');
    } catch { notify('Aquest fitxer no és un projecte vàlid de Ska Generator.'); }
  });
  $('record-song').addEventListener('click', () => startRecording(0));
  $('record-section').addEventListener('click', () => { const sec = current(); if (sec) startRecording(sec.start); });
  $('record-stop').addEventListener('click', () => { stop(); render(); });
  $('play-voice').addEventListener('click', () => play('song'));
  $('delete-voice').addEventListener('click', deleteVoice);
  $('download-voice').addEventListener('click', () => {
    if (!voiceData) return;
    download(new Blob([audioUtils.encodeWav([voiceData, voiceData], RATE)], { type: 'audio/wav' }), `${fileName()}-veu.wav`);
  });
  $('voice-enabled').addEventListener('change', event => { if (!song.voice) return; stop(); song.voice.enabled = event.target.checked; save(); render(); });
  for (const [key, field, unit] of [['voice-volume', 'volume', 'dB'], ['voice-offset', 'offsetMs', 'ms']]) {
    $(key).addEventListener('input', event => { const v = Number(event.target.value); $(`${key}-value`).textContent = `${v > 0 ? '+' : ''}${v} ${unit}`; });
    $(key).addEventListener('change', event => {
      if (!song.voice) return;
      const replay = playing?.kind; stop(); song.voice[field] = Number(event.target.value); save(); render();
      if (replay === 'song' || replay === 'section') play(replay);
    });
  }
  window.addEventListener('pagehide', stop);
  let firstTab = song.base.generated ? (song.sections.length ? 'line' : 'line') : 'song';
  try { firstTab = sessionStorage.getItem('skagenerator.tab') || firstTab; } catch {}
  setTab(firstTab, false);
  updateSettingsUI(); render(); loadVoice();
  if (migrated && storageAvailable) { save(); notify('Projecte anterior convertit al nou flux: cada part és ara una secció de la línia.'); }
  if (!storageAvailable) notify('No s’ha pogut recuperar l’esborrany. Obre un projecte desat o comença una cançó nova.');
})();
