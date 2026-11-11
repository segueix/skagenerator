(() => {
  'use strict';
  // Flux únic: 1) base musical per a tota la cançó, 2) seccions a la línia,
  // que es poden estirar, moure i reordenar, 3) instruments com a clips propis
  // a la seva pista: poden començar i acabar on calgui, fins i tot a mitja secció.
  const engine = window.ElTaulerRadioAmbient, sampleAudio = window.SkaSampleAudio, audioUtils = window.SkaAudioUtils, builder = window.SkaSongBuilder;
  const $ = id => document.getElementById(id);
  const KEY = 'skagenerator.song.v2', OLD_KEY = 'skagenerator.song.v1', RATE = 44100;
  const MIN_BARS = 8, MAX_BARS = 256, MAX_SECONDS = 360, MAX_SECTION = 32, MAX_SECTIONS = 32, MAX_CLIPS = 96, GAP_CHUNK = 8, MAX_REV = 1000000;
  const INSTRUMENTS = engine.SONG_INSTRUMENTS, TYPES = engine.SONG_PARTS, STYLES = engine.SONG_STYLES;
  // Colors vius que funcionen en mode clar i fosc (la interfície els barreja amb el fons).
  const colors = { intro: '#14b8a6', verse: '#8b5cf6', prechorus: '#f97316', chorus: '#ec4899', bridge: '#3b82f6', solo: '#84cc16', outro: '#10b981' };
  const instrumentColors = { guitar: '#22c55e', drums: '#0ea5e9', bass: '#a855f7', trumpet: '#f59e0b', trombone: '#ef4444', synthLead: '#06b6d4', synthPad: '#6366f1', synthBass: '#7c3aed', electronicDrums: '#14b8a6', sax: '#eab308', organ: '#f43f5e', guitar2: '#84cc16', guitar3: '#10b981', vocal: '#f472b6' };
  const plurals = { intro: 'les intros', verse: 'les estrofes', prechorus: 'les pretornades', chorus: 'les tornades', bridge: 'els ponts', solo: 'les parts instrumentals', outro: 'els finals' };
  const noteNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const GUITARS = ['guitar', 'guitar2', 'guitar3'];
  const STACKABLE_GUITARS = ['guitar', 'guitar2']; // Diverses preses simultànies de la guitarra 1 i la 2.
  // Noms curts per a les etiquetes de la línia (hi caben al mòbil).
  const SHORT = { guitar: 'Guitarra 1', guitar2: 'Guitarra 2', guitar3: 'Guitarra 3', trombone: '2a veu vent', sax: 'Saxo', synthLead: 'Sinte melodia', synthPad: 'Sinte acords', synthBass: 'Baix sinte', electronicDrums: 'Bat. electr.', vocal: 'Veu (guia)' };
  const LINE_INSTRUMENTS = ['trumpet', 'trombone', 'sax', 'synthLead', 'guitar3'];
  const LINES = [['own', 'Pròpia'], ['riff', 'Riff de la cançó'], ['answer', 'Respon a la veu']];
  const defaultFx = () => ({ type: 'none', drive: 50, tone: 50 });
  const VOICE_EFFECTS = audioUtils.VOICE_EFFECTS, VOICE_EQ_KEYS = audioUtils.VOICE_EQ_KEYS;
  const flatVoiceEq = () => ({ low: 0, mid: 0, high: 0 });
  const FEELS = [['1', 'Normal'], ['0.5', 'Mig temps (½)'], ['2', 'Doble temps (×2)']];
  const CYMBAL_MODES = [['all', 'Amb platets'], ['hats', 'Sense plats (només charles)'], ['none', 'Sense platets'], ['rim', 'Sense platets, pols a l’aro']];
  const ENDINGS = [['fill', 'Redoble (segons el que ve)'], ['stop', 'Aturada de la banda'], ['none', 'Sense redoble'],
    ['break', 'Cop i silenci (la banda calla)'], ['silence', 'Últim compàs en silenci']];
  // Final de la cançó (seccions de tipus final).
  const CLOSINGS = [['hit', 'Cop final de tota la banda'], ['fade', 'Sense cop: el ritme continua (per a un fos)'], ['cold', 'Tall en sec'], ['ring', 'Redoble i acord llarg']];
  const COLOR_ICONS = { radio: '📻', megaphone: '📢', telephone: '☎', gramophone: '💿' };
  const OFFBEAT = [['', 'Una bateria'], ['yes', 'Dues bateries: la segona a contratemps']];
  // Recursos d'una secció, en text curt per a la línia.
  function sectionMarks(sec) {
    const out = [];
    if (sec.fade === 'in') out.push('◢ fos d’entrada');
    if (sec.fade === 'out') out.push('◣ fos de sortida');
    if (sec.ending === 'stop') out.push('⏸ aturada');
    if (sec.ending === 'break') out.push('∅ cop i silenci');
    if (sec.ending === 'silence') out.push('∅ silenci');
    if (sec.type === 'outro' && sec.closing) out.push({ fade: '∿ sense cop', cold: '✂ tall en sec', ring: '🥁 redoble final' }[sec.closing]);
    if (sec.entrance && Object.keys(sec.entrance).length) out.push('≡ entrada per capes');
    if (sec.exit && Object.keys(sec.exit).length) out.push('≡ sortida per capes');
    if (sec.offbeat) out.push('🥁🥁 dues bateries');
    return out;
  }
  const FADES = [['', 'Sense fos'], ['in', 'Fos d’entrada (puja des del silenci)'], ['out', 'Fos de sortida (baixa fins al silenci)']];
  const DRUM_TUNES = [['2', 'Aguda (+2)'], ['0', 'Natural'], ['-2', 'Greu (−2)'], ['-4', 'Molt greu (−4)'], ['-6', 'Profunda (−6)']];
  const BASE_CHOICES = ['drums', 'electronicDrums', 'bass', 'synthBass', 'guitar', 'organ', 'synthPad'];
  const baseDefaults = style => style === 'urban' ? ['electronicDrums', 'synthBass'] : ['drums', 'bass'];
  const timbreOptions = {
    // «gravat»: mostres nota a nota de VSCO 2 CE, FreePats o el kit Muldjord.
    guitar: [['auto', 'Segons l’estil'], ['clean', 'Guitarra neta · gravada'], ['cleanGm', 'Guitarra neta GM'], ['muted', 'Guitarra apagada GM'], ['overdrive', 'Guitarra saturada GM'], ['distortion', 'Guitarra distorsionada GM']],
    bass: [['auto', 'Segons l’estil'], ['finger', 'Baix amb dits · gravat'], ['pick', 'Baix amb pua · gravat'], ['growly', 'Jazz Bass directe · gravat (Growlybass)'], ['fingerGm', 'Baix amb dits GM'], ['pickGm', 'Baix amb pua GM']],
    drums: [['auto', 'Segons l’estil'], ['real', 'Bateria Muldjord · gravada'], ['rusty', 'Big Rusty · gravada, greu (bombo de 24")'], ['club', 'Kit de club de jazz · gravat (Virtuosity)'], ['lofi', 'Kit lo-fi, so de disc antic · gravat'], ['jazz', 'Kit de jazz GM'], ['room', 'Kit de sala GM'], ['standard', 'Bateria acústica GM'], ['brush', 'Escombretes GM'], ['rock', 'Bateria rock GM'], ['electronic', 'Kit electrònic GM']],
    trumpet: [['auto', 'Trompeta · gravada (VSCO)'], ['gm', 'Trompeta GM'], ['bright', 'Trompeta brillant GM'], ['muted', 'Trompeta amb sordina GM']],
    trombone: [['auto', 'Saxo tenor · gravat (recomanat)'], ['vsco', 'Trombó · gravat (VSCO)'], ['gm', 'Trombó GM'], ['warm', 'Trombó càlid GM']],
    vocal: [['auto', 'Clarinet · gravat (recomanat)'], ['oohs', 'Veu «uh» GM'], ['flute', 'Flauta GM'], ['ocarina', 'Ocarina GM'], ['clarinetGm', 'Clarinet GM']]
  };
  const defaultTimbres = () => ({ guitar: 'auto', bass: 'auto', drums: 'auto', trumpet: 'auto', trombone: 'auto', vocal: 'auto' });
  // Síl·labes d'un vers en català (aproximat): grups vocàlics, amb els diftongs
  // decreixents (ai, ei, oi, ui, au, eu, iu, ou) com una sola síl·laba i la
  // dièresi (ï, ü) com a hiat. La melodia de veu fa una nota per síl·laba.
  function syllableCount(line) {
    let total = 0;
    for (const word of line.toLowerCase().match(/[a-zàèéíïòóúüç·'’-]+/g) || []) {
      const clean = word.replace(/(q|g)u(?=[eiéèí])/g, '$1');
      for (const group of clean.match(/[aeiouàèéíïòóúü]+/g) || []) {
        let count = 0;
        for (let i = 0; i < group.length; i++) {
          const next = group[i + 1];
          count++;
          if (next && 'iu'.includes(next) && !'iu'.includes(group[i])) i++;
        }
        total += count;
      }
    }
    return total;
  }
  const lyricLines = text => (text || '').split(/\n/).map(l => l.trim()).filter(l => l && /[a-zàèéíòóúïü]/i.test(l)).slice(0, 32);
  const lyricSyllables = text => lyricLines(text).map(line => Math.max(1, Math.min(24, syllableCount(line))));
  // Equalitzador: valors en dB respecte de la corba de cada instrument.
  const EQ_KEYS = [['low', 'Greus'], ['mid', 'Mitjos'], ['high', 'Aguts'], ['volume', 'Volum']];
  const flatEq = () => ({ low: 0, mid: 0, high: 0, volume: 0 });
  const isFlat = band => EQ_KEYS.every(([key]) => band[key] === 0);
  const defaultBaseVolume = () => ({ drums: 0, bass: 0 });
  const validBaseVolume = values => values === undefined || !!values && typeof values === 'object' && !Array.isArray(values)
    && Object.entries(values).every(([name, db]) => ['drums', 'bass'].includes(name) && Number.isInteger(db) && db >= -24 && db <= 6);
  const defaultGroove = () => ({ drums: 0, bass: 0, guitar: 0 });
  const validTimbres = input => input === undefined || !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.entries(input).every(([name, value]) => timbreOptions[name]?.some(([preset]) => preset === value));
  // Edició de la base per secció: instruments silenciats, so propi i patró (orgue i coixí).
  const BASE_SOUNDS = ['drums', 'bass', 'guitar'], BASE_PATTERNS = {
    organ: ['Contratemps', '«Bubble»', 'Sostingut', 'Blanques', 'Síncopa'],
    synthPad: ['Sostingut', 'Blanques', 'Contratemps', 'Negres', 'Síncopa'] };
  const validBaseEdits = s => (s.mute === undefined || Array.isArray(s.mute) && s.mute.length <= Object.keys(INSTRUMENTS).length && new Set(s.mute).size === s.mute.length && s.mute.every(n => Object.hasOwn(INSTRUMENTS, n)))
    && (s.timbres === undefined || validTimbres(s.timbres) && Object.keys(s.timbres).every(n => BASE_SOUNDS.includes(n)))
    && (s.patterns === undefined || !!s.patterns && typeof s.patterns === 'object' && !Array.isArray(s.patterns)
      && Object.entries(s.patterns).every(([n, i]) => Object.hasOwn(BASE_PATTERNS, n) && Number.isInteger(i) && i >= 0 && i < 5));
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
    settings: { style: 'ska', bpm: 128, tonic: 0, mode: 'major', seed: newSeed(), bars: 64, timbres: defaultTimbres(), groove: defaultGroove(), baseVolume: defaultBaseVolume() },
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
    // El contrabaix Meatbass ja no existeix: les cançons que el feien servir passen al Jazz Bass gravat.
    for (const owner of [st, ...(Array.isArray(value.sections) ? value.sections : [])]) if (owner?.timbres?.bass === 'upright') owner.timbres.bass = 'growly';
    if (!validTimbres(st.timbres) || !validGroove(st.groove, st.style)) fail('Sons o patrons no vàlids');
    if (!validBaseVolume(st.baseVolume)) fail('Volums generals de la base no vàlids');
    st.baseVolume = { ...defaultBaseVolume(), ...(st.baseVolume || {}) };
    migrateVolumes(value);
    if (st.countIn !== undefined && typeof st.countIn !== 'boolean') fail('Configuració no vàlida');
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
        || s.start + s.bars > st.bars || (s.transpose !== undefined && (!Number.isInteger(s.transpose) || s.transpose < -6 || s.transpose > 6))
        || (s.groove !== undefined && !validGroove(s.groove, st.style)) || (s.ending !== undefined && !['stop', 'none', 'break', 'silence'].includes(s.ending))
        || (s.closing !== undefined && !['fade', 'cold', 'ring'].includes(s.closing)) || (s.offbeat !== undefined && typeof s.offbeat !== 'boolean') || (s.fade !== undefined && !['in', 'out'].includes(s.fade))
        || ['entrance', 'exit'].some(f => s[f] !== undefined && (!s[f] || typeof s[f] !== 'object' || Array.isArray(s[f]) || Object.entries(s[f]).some(([n, b]) => !Object.hasOwn(INSTRUMENTS, n) || !Number.isInteger(b) || b < 0 || b > MAX_SECTION))) || (s.cymbals !== undefined && !CYMBAL_MODES.some(([k]) => k === s.cymbals))
        || !validBaseEdits(s) || (s.bpm !== undefined && (!Number.isInteger(s.bpm) || s.bpm < 40 || s.bpm > 240))
        || (s.feel !== undefined && (!s.feel || typeof s.feel !== 'object' || Object.values(s.feel).some(f => ![.5, 2].includes(f)))) || (s.energy !== undefined && (!Number.isInteger(s.energy) || s.energy < 10 || s.energy > 100)) || (s.mix !== undefined && (!s.mix || typeof s.mix !== 'object' || Array.isArray(s.mix))) || typeof s.lyrics !== 'string' || s.lyrics.length > 5000) fail('Secció no vàlida');
      ids.add(s.id); end = s.start + s.bars;
    }
    if (!Array.isArray(value.clips) || value.clips.length > MAX_CLIPS || value.clips.some(c => !c || typeof c !== 'object')) fail('Instruments no vàlids');
    value.clips.sort((a, b) => a.start - b.start);
    for (const c of value.clips) {
      if (typeof c.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(c.id) || ids.has(c.id) || !Object.hasOwn(INSTRUMENTS, c.instrument)
        || (base.instruments.includes(c.instrument) && !STACKABLE_GUITARS.includes(c.instrument)) || !Number.isInteger(c.start) || !Number.isInteger(c.bars) || c.start < 0 || c.bars < 1
        || c.start + c.bars > st.bars || !Number.isInteger(c.revision) || c.revision < 1 || c.revision > MAX_REV || typeof c.generated !== 'boolean') fail('Instrument no vàlid');
      if (!STACKABLE_GUITARS.includes(c.instrument) && value.clips.some(o => o !== c && o.instrument === c.instrument && o.start < c.start + c.bars && c.start < o.start + o.bars)) fail('Instruments encavalcats');
      if (c.sound !== undefined && (!GUITARS.includes(c.instrument) || !timbreOptions.guitar.some(([key]) => key === c.sound))) fail('So de guitarra no vàlid');
      if (c.fx !== undefined && !GUITARS.includes(c.instrument)) fail('Efecte no vàlid');
      if (c.feel !== undefined && ![.5, 2].includes(c.feel)) fail('Ritme no vàlid');
      if (c.register !== undefined && (c.instrument !== 'vocal' || ![-1, 1].includes(c.register))) fail('Registre no vàlid');
      if (c.line !== undefined && (!LINE_INSTRUMENTS.includes(c.instrument) || !['riff', 'answer'].includes(c.line))) fail('Línia no vàlida');
      if (c.edge !== undefined && typeof c.edge !== 'boolean') fail('Instrument no vàlid');
      if (c.color !== undefined && (!engine.COLOR_INSTRUMENTS.includes(c.instrument) || !Object.hasOwn(engine.COLOR_FX, c.color))) fail('Efecte de color no vàlid');
      ids.add(c.id);
    }
    if (value.voice !== undefined) {
      const v = value.voice;
      if (!v || typeof v.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(v.id) || typeof v.enabled !== 'boolean'
        || !Number.isFinite(v.volume) || v.volume < -24 || v.volume > 12 || !Number.isFinite(v.offsetMs) || v.offsetMs < -500 || v.offsetMs > 500
        || (v.effect !== undefined && !Object.hasOwn(VOICE_EFFECTS, v.effect))
        || (v.eq !== undefined && (!v.eq || typeof v.eq !== 'object' || Array.isArray(v.eq)
          || Object.keys(v.eq).some(key => !VOICE_EQ_KEYS.includes(key))
          || VOICE_EQ_KEYS.some(key => !Number.isInteger(v.eq[key] ?? 0) || Math.abs(v.eq[key] ?? 0) > 12)))) fail('Veu no vàlida');
      v.effect ??= 'clean'; v.eq = { ...flatVoiceEq(), ...(v.eq || {}) };
    }
    // Inici, final i silenci triats per «Inici i final nous» (per no repetir-los).
    const edges = value.edges;
    if (edges !== undefined && (!edges || typeof edges !== 'object' || !Object.hasOwn(builder.OPENINGS, edges.opening)
      || !Object.hasOwn(builder.CLOSINGS, edges.closing) || !Object.hasOwn(builder.MIDDLES, edges.middle))) delete value.edges;
    // Comentaris: els que no són vàlids es descarten (no impedeixen obrir la cançó).
    if (value.comments !== undefined) value.comments = builder.cleanComments(value.comments, st.bars);
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
    const active = s.clips.filter(c => c.generated && !(seg.section?.mute || []).includes(c.instrument) && c.start < seg.start + seg.bars && seg.start < c.start + c.bars);
    if (!active.length) return null;
    const layers = {}, ranges = {}, timbres = {}, fx = {}, feel = {}, lineModes = {}, colors = {}, guitarTakes = [];
    let register;
    for (const c of active) {
      // Cada guitarra és una presa separada, encara que una altra del mateix
      // tipus ja soni. No es fusionen les revisions ni els efectes.
      if (c.instrument === 'guitar' || c.instrument === 'guitar2') {
        guitarTakes.push({ id: c.id, instrument: c.instrument, revision: c.revision,
          from: Math.max(0, c.start - seg.start), to: Math.min(seg.bars, c.start + c.bars - seg.start),
          ...(c.sound ? { sound: c.sound } : {}), ...(c.fx ? { fx: c.fx } : {}),
          ...(c.feel ? { feel: c.feel } : {}), ...(c.color ? { color: c.color } : {}) });
        continue;
      }
      if (!(c.instrument in layers)) {
        if (c.feel) feel[c.instrument] = c.feel;
        if (c.line) lineModes[c.instrument] = c.line;
        if (c.instrument === 'vocal' && c.register) register = c.register;
        if (c.sound && c.sound !== 'auto') timbres[c.instrument] = c.sound;
        if (c.fx) fx[c.instrument] = c.fx;
        if (c.color) colors[c.instrument] = c.color;
      }
      layers[c.instrument] ??= c.revision;
      (ranges[c.instrument] ||= []).push([Math.max(0, c.start - seg.start), Math.min(seg.bars, c.start + c.bars - seg.start)]);
    }
    for (const [name, list] of Object.entries(ranges)) if (list.length === 1 && list[0][0] === 0 && list[0][1] === seg.bars) delete ranges[name];
    return { layers, ranges, timbres, fx, feel, register, lineModes, colors, guitarTakes };
  }
  function partFor(s, seg, options = {}) {
    // Els instruments de la base silenciats en aquesta secció no sonen.
    const mute = seg.section?.mute || [], base = s.base.instruments.filter(name => !mute.includes(name)), extra = layersFor(s, seg, options);
    let part;
    if (!seg.section) {
      // Si la cançó acaba amb base sola, l'últim tram fa de final.
      const last = seg.start + seg.bars === s.settings.bars && seg.bars >= 2;
      part = { type: last ? 'outro' : 'verse', bars: seg.bars, energy: last ? 40 : 55, revision: s.base.revision, groove: s.settings.groove };
    } else {
      const sec = seg.section, harmony = s.harmony[sec.type] || 1;
      part = { type: sec.type, bars: sec.bars, energy: sec.energy ?? TYPES[sec.type].energy, revision: harmony, groove: s.settings.groove };
      if (sec.mix && Object.keys(sec.mix).length) part.mix = sec.mix;
      if (sec.volumes && Object.keys(sec.volumes).length) part.volumes = sec.volumes;
      if (sec.offbeat) part.offbeat = true;
      // Si en aquesta secció falten instruments (sobretot guitarres fortes), la resta puja una mica.
      const boost = options.baseOnly ? 0 : builder.densityBoost(s, sec);
      if (boost) part.volumes = { ...(part.volumes || {}), master: Math.max(-24, Math.min(12, (part.volumes?.master || 0) + boost)) };
      if (sec.bpm) part.bpm = sec.bpm;
      if (sec.transpose) part.transpose = sec.transpose;
      if (sec.groove) part.groove = { ...s.settings.groove, ...sec.groove };
      if (sec.cymbals) part.cymbals = sec.cymbals;
      // Arranjament: el redoble final depèn de la secció que ve, i cada secció en tria un de diferent.
      if (!options.baseOnly) {
        const list = segmentsOf(s), index = list.findIndex(x => x.section === sec), after = list[index + 1];
        part.next = after ? after.section?.type ?? 'verse' : 'end';
        part.fill = s.sections.indexOf(sec) % 1000;
        if (sec.ending) part.ending = sec.ending;
        if (sec.closing && sec.type === 'outro') part.closing = sec.closing;
        // Entrada i sortida per capes (només els instruments que hi sonen i dins de la secció).
        const here = new Set([...base, ...Object.keys(extra?.layers || {})]);
        const entrance = Object.fromEntries(Object.entries(sec.entrance || {}).filter(([n, b]) => here.has(n) && b > 0 && b < sec.bars));
        const exit = Object.fromEntries(Object.entries(sec.exit || {}).filter(([n, b]) => here.has(n) && b >= 1 && b < sec.bars && b > (entrance[n] ?? 0)));
        if (Object.keys(entrance).length) part.entrance = entrance;
        if (Object.keys(exit).length) part.exit = exit;
        if (s.settings.countIn && sec.start === 0) part.countIn = true;
      }
      if (sec.timbres && Object.keys(sec.timbres).length) part.timbres = { ...sec.timbres };
      if (sec.patterns) { const layers = {}; for (const [name, index] of Object.entries(sec.patterns)) if (base.includes(name)) layers[name] = index + 1; if (Object.keys(layers).length) part.layers = layers; }
      if (sec.feel && Object.keys(sec.feel).length) part.feel = { ...sec.feel };
      if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (harmony - 1) % 5;
    }
    // La guitarra 1 de la base continua sonant; cada clip de guitarra 1 o 2
    // afegeix una veu pròpia sense duplicar noms a la llista d'instruments.
    part.instruments = [...new Set([...base, ...Object.keys(extra?.layers || {}),
      ...(extra?.guitarTakes || []).map(take => take.instrument)])];
    if (extra?.guitarTakes.length) {
      part.guitarTakes = extra.guitarTakes;
      part.guitarBase = base.includes('guitar');
    }
    if (extra) {
      part.layers = { ...(part.layers || {}), ...extra.layers }; if (Object.keys(extra.ranges).length) part.ranges = extra.ranges;
      if (Object.keys(extra.timbres).length) part.timbres = { ...(part.timbres || {}), ...extra.timbres };
      if (Object.keys(extra.fx).length) part.fx = extra.fx;
      if (Object.keys(extra.feel).length) part.feel = { ...(part.feel || {}), ...extra.feel };
      if (Object.keys(extra.lineModes).length) part.lineModes = extra.lineModes;
      if (Object.keys(extra.colors).length) part.colors = extra.colors;
      // La melodia de veu segueix la lletra de la secció: una frase per vers.
      if ('vocal' in extra.layers) {
        if (extra.register) part.register = extra.register;
        // Síl·labes de cada vers, síl·labes tòniques (cauen a temps) i versos repetits (es canten igual).
        const lyric = engine.analyzeLyrics(seg.section?.lyrics || '');
        if (lyric.syllables.length) Object.assign(part, lyric);
      }
    }
    return part;
  }
  const specFor = (seg, options) => engine.composeSongPart(song.settings, partFor(song, seg, options));
  const chordName = chord => {
    const rel = chord.pcs.map(p => (p - chord.pcs[0] + 12) % 12), name = noteNames[chord.pcs[0]];
    if (rel[1] === 5) return `${name}sus4`;
    return name + (rel[2] === 6 ? ' dim' : rel[1] === 3 ? 'm' : '') + (rel[3] === 10 ? '7' : rel[3] === 11 ? 'maj7' : '');
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
  let selected = song.sections[0]?.id || null, selectedClip = null, selectedBase = null, busy = false, noticeTimer;
  const current = () => song.sections.find(s => s.id === selected) || null;
  // Mapa de tempo: cada secció pot tenir el seu BPM; els trams de base sola
  // segueixen el de la cançó. secondsAt i barAt converteixen compassos i temps.
  const barSeconds = (bpm = song.settings.bpm) => 240 / bpm;
  const bpmAtBar = (bar, s = song) => s.sections.find(x => bar >= x.start && bar < x.start + x.bars)?.bpm ?? s.settings.bpm;
  function tempoMap() {
    const starts = [0];
    for (let b = 0; b < song.settings.bars; b++) starts.push(starts[b] + barSeconds(bpmAtBar(b)));
    return starts;
  }
  function secondsAt(bar) {
    const map = tempoMap(), last = map.length - 1;
    if (bar <= 0) return bar * barSeconds();
    if (bar >= last) return map[last] + (bar - last) * barSeconds();
    const b = Math.floor(bar); return map[b] + (bar - b) * (map[b + 1] - map[b]);
  }
  function barAt(seconds) {
    const map = tempoMap(), last = map.length - 1;
    if (seconds <= 0) return seconds / barSeconds();
    if (seconds >= map[last]) return last + (seconds - map[last]) / barSeconds();
    let b = 0; while (map[b + 1] <= seconds) b++;
    return b + (seconds - map[b]) / (map[b + 1] - map[b]);
  }
  const songSeconds = () => secondsAt(song.settings.bars);
  function songSecondsWith({ bpm = song.settings.bpm, section = null, sectionBpm } = {}) {
    let total = 0;
    for (let b = 0; b < song.settings.bars; b++) {
      const sec = song.sections.find(x => b >= x.start && b < x.start + x.bars);
      total += barSeconds(sec === section && section ? sectionBpm ?? bpm : sec?.bpm ?? bpm);
    }
    return total;
  }
  const segBpm = seg => seg.section?.bpm ?? song.settings.bpm;
  const segFrames = seg => Math.round(seg.bars * barSeconds(segBpm(seg)) * RATE);
  const frameAt = bar => Math.round(secondsAt(bar) * RATE);
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
  let libraryTimer;
  function save() {
    if (song.libraryId) { clearTimeout(libraryTimer); libraryTimer = setTimeout(syncLibrary, 400); }
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
    // Secció sense cap instrument (tota la base silenciada): silenci amb la mateixa cua.
    if (!spec.instruments.length) { const frames = Math.round((spec.seconds + 1.5) * RATE); return [new Float32Array(frames), new Float32Array(frames)]; }
    const data = await sampleAudio.render(spec, RATE, { onProgress });
    cache.set(key, data); cachedFrames += data[0].length;
    while (cachedFrames > FRAME_BUDGET && cache.size > 1) {
      const [oldest, value] = cache.entries().next().value; cache.delete(oldest); cachedFrames -= value[0].length;
    }
    return data;
  }
  // Fos d'entrada o de sortida de la secció (sobre una còpia: la memòria cau no canvia).
  const faded = (seg, data, options = {}) => seg.section?.fade && !options.baseOnly ? audioUtils.applyFade(data, Math.min(segFrames(seg), data[0].length), seg.section.fade) : data;
  async function songAudio(options = {}) {
    const segs = segmentsOf(song), parts = [];
    for (const [index, seg] of segs.entries()) {
      parts.push(faded(seg, await renderSpec(specFor(seg, options), progress => {
        if (progress.stage === 'rendering') status(`Preparant la cançó · tram ${index + 1} de ${segs.length}`);
        else audioProgress(progress);
      }), options));
    }
    status('So enregistrat · Instruments a punt');
    return audioUtils.mixSections(parts, segs.map(segFrames));
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
  let cueBar = 0, scrubBar = null; // Posició triada manualment a la cançó.
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
  async function startBuffer(data, token, fromSeconds = 0) {
    const ended = () => { if (token === playToken) { stop(); render(); } };
    if (tone) {
      try {
        const raw = tone.getContext().rawContext;
        if (raw.state !== 'running') throw new Error('Tone.js no està actiu');
        const player = new tone.Player(makeBuffer(raw, data)).toDestination();
        player.volume.value = -1.938; player.onstop = ended;
        const startedAt = tone.now(); player.start(startedAt, fromSeconds); tonePlayer = player;
        return () => fromSeconds + tone.now() - startedAt;
      } catch (error) { console.warn('Tone.js no ha pogut reproduir; es fa servir Web Audio.', error); tonePlayer = null; }
    }
    if (!context) throw new Error('Aquest navegador no admet Web Audio');
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running') throw new Error('El navegador ha bloquejat el so. Torna a prémer el botó d’escoltar.');
    source = context.createBufferSource(); source.buffer = makeBuffer(context, data);
    gainNode = context.createGain(); gainNode.gain.value = .8;
    source.connect(gainNode); gainNode.connect(context.destination); source.onended = ended;
    const startedAt = context.currentTime; source.start(0, fromSeconds);
    return () => fromSeconds + context.currentTime - startedAt;
  }
  function stop() {
    playToken++;
    if (recording) finishRecording();
    if (tonePlayer) { const player = tonePlayer; tonePlayer = null; player.onstop = () => {}; try { player.stop(); } catch {} player.dispose(); }
    if (source) { source.onended = null; try { source.stop(); } catch {} source = null; }
    if (gainNode) { gainNode.disconnect(); gainNode = null; }
    cancelAnimationFrame(animation); playing = null; cueBar = 0; scrubBar = null; document.body.classList.remove('playing');
    $('song-progress').value = 0; $('playback-time').textContent = '00:00'; $('playhead').hidden = true;
  }
  async function play(kind) {
    const sec = current();
    if (playing && playing.kind === kind && (kind !== 'section' || playing.id === sec?.id)) { stop(); render(); return; }
    if (busy || !song.base.generated) return;
    const requestedBar = cueBar;
    stop(); cueBar = requestedBar;
    const token = playToken, unlocked = unlockAudio();
    setBusy(true);
    try {
      await unlocked;
      let data, startBar = 0, bars = song.settings.bars;
      if (kind === 'section') { const seg = segmentOf(sec); data = withVoice(faded(seg, await renderSpec(specFor(seg))), frameAt(sec.start)); startBar = sec.start; bars = sec.bars; }
      else data = kind === 'base' ? await songAudio({ baseOnly: true }) : withVoice(await songAudio(), 0);
      if (token !== playToken) return;
      const seconds = data[0].length / RATE, startSeconds = secondsAt(startBar);
      const targetBar = kind === 'section' && (cueBar < startBar || cueBar >= startBar + bars) ? startBar : Math.max(startBar, cueBar);
      const offset = Math.max(0, Math.min(seconds - .05, secondsAt(targetBar) - startSeconds));
      const clock = await startBuffer(data, token, offset);
      playing = { kind, id: sec?.id, startBar, bars, startSeconds, seconds, data, clock };
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
      if (scrubBar !== null) { animation = requestAnimationFrame(tick); return; }
      const elapsed = Math.min(playing.seconds, playing.clock()), bar = barAt(playing.startSeconds + elapsed);
      $('song-progress').value = Math.max(0, Math.min(1, secondsAt(bar) / songSeconds()));
      $('playback-time').textContent = time(Math.max(0, secondsAt(bar)));
      updatePlayhead(bar);
      $('tempo-badge').textContent = `♩ ${bpmAtBar(Math.max(0, Math.floor(bar)))} BPM`;
      const active = song.sections.find(s => bar >= s.start && bar < s.start + s.bars);
      $('transport-subtitle').textContent = playing.kind === 'record' ? `● Gravant · ${active ? sectionLabel(active) : 'base'}`
        : playing.kind === 'base' ? 'Escoltant · base musical'
        : `Escoltant · ${active ? sectionLabel(active) : 'base'}${playing.kind === 'section' ? ' (secció)' : ''}`;
      if (playing.kind === 'record') {
        $('voice-live-title').textContent = bar < (playing.startBar ?? 0) ? 'Prepara’t…' : active ? sectionLabel(active) : 'Base';
        $('voice-live-lyrics').textContent = active?.lyrics || (active ? 'Sense lletra en aquesta secció.' : '');
        $('voice-meter').style.width = `${Math.min(100, Math.round(Math.sqrt(recording?.level || 0) * 140))}%`;
        if (recording) recording.level *= .85;
      }
      animation = requestAnimationFrame(tick);
    };
    tick();
  }


  // La barra vertical i el regulador inferior comparteixen la mateixa posició.
  let playheadBar = null; // On és el capçal (per situar-hi un comentari).
  function updatePlayhead(bar) {
    const bounded = Math.max(0, Math.min(song.settings.bars, bar));
    playheadBar = bounded;
    const head = $('playhead');
    head.style.setProperty('--pos', String(bounded / song.settings.bars));
    head.hidden = !song.base.generated;
    head.setAttribute('aria-valuemax', String(Math.round(songSeconds())));
    head.setAttribute('aria-valuenow', String(Math.round(secondsAt(bounded))));
    head.setAttribute('aria-valuetext', time(secondsAt(bounded)));
  }
  function showSeekPreview(bar) {
    scrubBar = cueBar = Math.max(0, Math.min(song.settings.bars - .01, bar));
    updatePlayhead(scrubBar);
    $('song-progress').value = Math.max(0, Math.min(1, secondsAt(scrubBar) / songSeconds()));
    $('playback-time').textContent = time(secondsAt(scrubBar));
  }
  function barFromPointer(event) {
    const rect = $('line-ruler').getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * song.settings.bars;
  }
  // Quan ja sona, reutilitza el buffer perquè arrossegar el capçal sigui instantani.
  // Si sortim d'una secció reproduïda individualment, passem a la cançó completa.
  async function seekToBar(bar) {
    if (busy || recording || !song.base.generated) return;
    const target = Math.max(0, Math.min(song.settings.bars - .01, bar));
    const previous = playing, inside = previous?.kind !== 'section'
      || target >= previous.startBar && target < previous.startBar + previous.bars;
    const reusable = previous && previous.kind !== 'record' && inside && previous.data;
    stop(); cueBar = target;
    if (!reusable) {
      render();
      if (previous && previous.kind !== 'record') play(previous.kind === 'section' ? 'song' : previous.kind);
      return;
    }
    const token = playToken;
    const unlocked = unlockAudio();
    try {
      await unlocked;
      if (token !== playToken) return;
      const offset = Math.max(0, Math.min(previous.seconds - .05, secondsAt(target) - previous.startSeconds));
      const clock = await startBuffer(previous.data, token, offset);
      if (token !== playToken) return;
      playing = { ...previous, clock };
      document.body.classList.add('playing');
      render(); runTick(token);
    } catch (error) {
      audioError(error); stop(); render(); notify(`No s’ha pogut anar a aquest punt: ${reasonOf(error)}`);
    }
  }

  // El botó M modifica només l'instrument i la secció corresponents.
  function timelineMuteButton(sec, name) {
    const muted = (sec.mute || []).includes(name);
    const button = document.createElement('button'); button.type = 'button';
    button.className = `track-mute${muted ? ' is-muted' : ''}`;
    button.textContent = 'M'; button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', `${muted ? 'Activa' : 'Silencia'} ${INSTRUMENTS[name]} a ${sectionLabel(sec)}`);
    button.title = `${muted ? 'Torna a activar' : 'Silencia'} ${INSTRUMENTS[name]} només a ${sectionLabel(sec)}`;
    button.disabled = busy || !!recording;
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('keydown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (busy || recording) return;
      const kind = playing?.kind;
      const at = playing ? barAt(playing.startSeconds + playing.clock()) : cueBar;
      setMute(sec, name, !muted);
      stop(); cueBar = Math.max(0, Math.min(song.settings.bars - .01, at));
      save(); render();
      if (kind === 'song' || kind === 'section' || kind === 'base') play(kind);
    });
    return button;
  }

  // ── La teva veu ─────────────────────────────────────────────────────
  // La veu es grava al mateix context d'àudio que reprodueix la música, de
  // manera que la posició de cada mostra es coneix exactament. Es desa a
  // IndexedDB (és massa gran per a localStorage) en 16 bits.
  let voiceData = null, recording = null, processedVoiceCache = null;
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
  function filteredVoice() {
    if (!voiceData) return null;
    const key = JSON.stringify([song.voice?.effect || 'clean', song.voice?.eq || flatVoiceEq()]);
    if (processedVoiceCache?.source === voiceData && processedVoiceCache?.key === key)
      return processedVoiceCache.data;
    const data = audioUtils.processVoice(voiceData, { effect: song.voice?.effect || 'clean', eq: song.voice?.eq || flatVoiceEq(), rate: RATE });
    processedVoiceCache = { source: voiceData, key, data };
    return data;
  }
  function withVoice(data, fromFrame) {
    if (!voiceData || !song.voice?.enabled) return data;
    return audioUtils.mixVoice(data, filteredVoice(), { from: fromFrame, processed: true,
      gainDb: song.voice.volume, offset: Math.round(song.voice.offsetMs / 1000 * RATE), rate: RATE });
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
      const ctx = context, from = frameAt(fromBar), lead = .35, startAt = ctx.currentTime + lead;
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
      // El capçal comença un instant abans perquè la primera nota no sorprengui.
      playing = { kind: 'record', startBar: fromBar, bars: song.settings.bars - fromBar, startSeconds: secondsAt(fromBar) - lead,
        seconds: data[0].length / RATE - from / RATE + lead, clock: () => ctx.currentTime - startAt + lead };
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
    song.voice ??= { id: uid(), enabled: true, volume: 0, offsetMs: 0, effect: 'clean', eq: flatVoiceEq() };
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
      $('voice-effect').value = song.voice.effect || 'clean';
      for (const key of VOICE_EQ_KEYS) {
        const db = song.voice.eq?.[key] ?? 0;
        $(`voice-eq-${key}`).value = db;
        $(`voice-eq-${key}-value`).textContent = `${db > 0 ? '+' : ''}${db} dB`;
      }
    }
    $('play-voice').textContent = playing?.kind === 'song' ? '■ Atura' : '▷ Escolta amb la veu';
    for (const key of ['voice-enabled', 'voice-volume', 'voice-offset', 'voice-effect', 'voice-eq-reset',
      ...VOICE_EQ_KEYS.map(key => `voice-eq-${key}`), 'play-voice', 'download-voice', 'delete-voice']) $(key).disabled = busy;
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
  // Selector de qualitat: entre 24 versions a l'atzar, es queda la que fa la millor
  // línia dins de les seves seccions (contorn, acords, un sol clímax, cadències,
  // ritme equilibrat i cap xoc amb les altres línies que sonen alhora).
  const QUALITY_TRIES = 24;
  function bestRevision(clip, avoid) {
    if (!builder.MELODIC.includes(clip.instrument) || clip.line) return null;
    const segs = segmentsOf(song).filter(seg => overlaps(seg, clip));
    let best = null, bestScore = -Infinity;
    for (let k = 0; k < QUALITY_TRIES; k++) {
      let revision;
      do revision = newRev(); while (revision === avoid);
      clip.revision = revision;
      let score = 0;
      for (const seg of segs) {
        const spec = specFor(seg), from = Math.max(0, clip.start - seg.start), to = Math.min(seg.bars, endOf(clip) - seg.start);
        const own = (spec.lines[clip.instrument] || []).filter(n => n[0] >= from && n[0] < to);
        const others = Object.entries(spec.lines).filter(([name]) => name !== clip.instrument).map(([, line]) => line);
        score += builder.lineScore(own, { chords: spec.chords, others });
      }
      if (score > bestScore) { bestScore = score; best = revision; }
    }
    return best;
  }
  async function generateClip(clip) {
    if (busy || !song.base.generated) return;
    stop();
    const before = { revision: clip.revision, generated: clip.generated }, home = sectionAt(clip.start);
    let reused = null;
    if (!clip.generated) {
      // Les guitarres superposades necessiten revisions independents.
      reused = !STACKABLE_GUITARS.includes(clip.instrument) && home && song.clips.find(c => c !== clip && c.generated && c.instrument === clip.instrument && sectionAt(c.start)?.type === home.type);
      if (reused) clip.revision = reused.revision;
    } else { const previous = clip.revision; do clip.revision = newRev(); while (clip.revision === previous); }
    clip.generated = true;
    setBusy(true);
    let picked = null;
    try {
      if (!reused) { picked = bestRevision(clip, before.generated ? before.revision : null); if (picked) clip.revision = picked; }
      for (const seg of segmentsOf(song)) if (overlaps(seg, clip)) await renderSpec(specFor(seg));
      save();
      notify(reused ? `${INSTRUMENTS[clip.instrument]}: repeteix la idea de ${sectionLabel(sectionAt(reused.start))}. Prem «Genera’n una altra» per variar-la.`
        : clip.instrument === 'vocal' ? `Melodia de veu creada${picked ? ` (la millor de ${QUALITY_TRIES} versions)` : ''}${lyricSyllables(home?.lyrics).length ? ' a partir de la lletra (una nota per síl·laba)' : ' amb frases i respiracions'}. Escolta-la per saber com cantar.`
        : `${clipLabel(clip)} generat${picked ? ` (la millor de ${QUALITY_TRIES} versions)` : ''}. Escolta la secció o tota la cançó.`);
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
    selected = sec.id; selectedClip = null; selectedBase = null; stop(); save(); render();
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
    for (const c of song.clips) if (c.start === sec.start && endOf(c) > newStart && (STACKABLE_GUITARS.includes(c.instrument) || !song.clips.some(o => o !== c && o.instrument === c.instrument && o.start < c.start && endOf(o) > newStart))) {
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
        if (STACKABLE_GUITARS.includes(c.instrument) || !song.clips.some(o => o !== c && !inside.includes(o) && o.instrument === c.instrument && overlaps(o, moved))) c.start = moved.start;
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
  // Només els instruments que no són guitarres apilables s'escurcen si coincideixen.
  function resolveClips() {
    song.clips.sort((a, b) => a.start - b.start);
    for (const c of song.clips) c.bars = Math.min(c.bars, song.settings.bars - c.start);
    for (const name of Object.keys(INSTRUMENTS)) {
      if (STACKABLE_GUITARS.includes(name)) continue;
      const list = song.clips.filter(c => c.instrument === name);
      for (let i = 1; i < list.length; i++) if (list[i].start < endOf(list[i - 1])) list[i - 1].bars = list[i].start - list[i - 1].start;
    }
    song.clips = song.clips.filter(c => c.bars >= 1);
  }

  // ── Edició de la línia: instruments ────────────────────────────────
  function clipBounds(clip, instrument = clip.instrument) {
    if (STACKABLE_GUITARS.includes(instrument)) return [0, song.settings.bars];
    const others = song.clips.filter(c => c !== clip && c.instrument === instrument);
    const before = others.filter(c => endOf(c) <= clip.start).map(endOf), after = others.filter(c => c.start >= endOf(clip)).map(c => c.start);
    return [Math.max(0, ...before), Math.min(song.settings.bars, ...after)];
  }
  function addClip(instrument, from, to) {
    if (song.clips.length >= MAX_CLIPS) { notify(`Com a màxim hi pot haver ${MAX_CLIPS} clips d’instrument.`); return null; }
    const others = song.clips.filter(c => c.instrument === instrument);
    let start = from;
    if (!STACKABLE_GUITARS.includes(instrument))
      for (const c of others.sort((a, b) => a.start - b.start)) if (c.start <= start && endOf(c) > start) start = endOf(c);
    const next = STACKABLE_GUITARS.includes(instrument) ? to : Math.min(to, ...others.filter(c => c.start >= start).map(c => c.start));
    if (next - start < 1) { notify(`${INSTRUMENTS[instrument]} ja sona en aquest tram. Estira el seu clip a la línia si el vols allargar.`); return null; }
    const clip = { id: uid(), instrument, start, bars: next - start, revision: newRev(), generated: false };
    song.clips.push(clip); song.clips.sort((a, b) => a.start - b.start); selectedClip = clip.id; selectedBase = null;
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
    element.addEventListener('pointercancel', () => { if (drag) { const wasTap = drag.tap; drag = null; if (!wasTap) render(); } });
  }
  // Amb el dit, un element que no està triat no s'arrossega: així la línia es pot
  // lliscar per sobre de les seccions. Un toc el tria; un cop triat ja es pot
  // arrossegar o estirar per les vores, i un segon toc l'obre per editar-lo.
  const isPicked = (kind, item) => kind === 'section' ? item.id === selected && !selectedClip && !selectedBase : item.id === selectedClip;
  function beginDrag(event, kind, item, mode) {
    if (busy || event.button > 0) return;
    if (event.pointerType !== 'mouse' && !isPicked(kind, item)) {
      drag = { tap: true, kind, item, x0: event.clientX, y0: event.clientY, pointer: event.pointerId };
      return;
    }
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
    if (!drag || event.pointerId !== drag.pointer || drag.tap) return;
    const dx = event.clientX - drag.x0;
    if (Math.abs(dx) > 4 && !drag.moved) { drag.moved = true; drag.element.classList.add('dragging'); }
    if (!drag.moved) return;
    drag.delta = Math.round(dx / drag.perBar);
    const [start, bars] = preview(drag);
    drag.element.style.left = pct(start); drag.element.style.width = pct(bars);
    drag.element.dataset.hint = drag.mode === 'move' ? `compàs ${start + 1}` : `${bars} c. · ${time(bars * barSeconds(drag.item.bpm))}`;
  }
  function dragEnd(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const d = drag; drag = null;
    if (d.tap) {
      if (Math.hypot(event.clientX - d.x0, event.clientY - d.y0) > 10) return;
      selectedBase = null;
      if (d.kind === 'section') { selected = d.item.id; selectedClip = null; }
      else { selectedClip = d.item.id; selected = sectionAt(d.item.start)?.id ?? selected; }
      render(); revealActions(); return;
    }
    if (!d.moved) {
      const again = isPicked(d.kind, d.item);
      selectedBase = null;
      if (d.kind === 'section') { selected = d.item.id; selectedClip = null; }
      else { selectedClip = d.item.id; selected = sectionAt(d.item.start)?.id ?? selected; }
      // Segon toc (amb el dit) sobre l'element triat: obre'n l'editor.
      if (again && event.pointerType !== 'mouse') { openSectionEditor(); return; }
      render(); revealActions(); return;
    }
    stop();
    const [start, bars] = preview(d), pointerBar = Math.floor((event.clientX - d.left) / d.perBar);
    let done;
    if (d.kind === 'section') {
      done = d.mode === 'move' ? moveSection(d.item, start, pointerBar) : d.mode === 'right' ? resizeSectionRight(d.item, bars) : resizeSectionLeft(d.item, start);
      selected = d.item.id; selectedClip = null; selectedBase = null;
    } else {
      const clip = d.item;
      if (d.mode === 'move') {
        const moved = { ...clip, start };
        done = STACKABLE_GUITARS.includes(clip.instrument) || !song.clips.some(o => o !== clip && o.instrument === clip.instrument && overlaps(o, moved));
        if (done) clip.start = start; else notify(`Aquí ja sona un altre clip de ${INSTRUMENTS[clip.instrument].toLowerCase()}.`);
      } else { clip.start = start; clip.bars = bars; done = true; }
      song.clips.sort((a, b) => a.start - b.start); selectedClip = clip.id; selectedBase = null;
    }
    if (done) save();
    render();
  }

  // ── Configuració ────────────────────────────────────────────────────
  const timbreFamilies = Object.keys(timbreOptions);
  for (const family of timbreFamilies) fillSelect($(`timbre-${family}`), timbreOptions[family]);
  fillSelect($('section-type'), Object.entries(TYPES).map(([type, info]) => [type, info.name]));
  fillSelect($('song-guitar-fx'), Object.entries(engine.GUITAR_FX));
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
    const kept = song.clips.filter(c => STACKABLE_GUITARS.includes(c.instrument) || !instruments.includes(c.instrument)), removed = song.clips.length - kept.length;
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
    for (const name of ['drums', 'bass']) {
      const db = st.baseVolume?.[name] ?? 0;
      $(`base-volume-${name}`).value = db;
      $(`base-volume-${name}-value`).textContent = `${db > 0 ? '+' : ''}${db} dB`;
    }
    for (const family of ['drums', 'bass', 'guitar'])
      fillSelect($(`groove-${family}`), engine.SONG_GROOVES[st.style][family].map((name, index) => [String(index), name]), String(st.groove[family]));
    $('groove-guitar-field').hidden = !song.base.instruments.includes('guitar');
    for (const family of timbreFamilies) $(`timbre-${family}`).value = st.timbres[family];
    $('song-guitar-fx').value = st.fx?.guitar?.type || 'none';
    fillSelect($('song-subgenre'), [['', '— Cap (estil general)'], ...Object.entries(engine.SUBGENRES).filter(([, sg]) => sg.style === st.style).map(([key, sg]) => [key, sg.name])], st.subgenre || '');
    $('song-swing').value = Math.round((st.swing || 0) * 100); $('song-swing-value').textContent = `${Math.round((st.swing || 0) * 100)} %`;
    fillSelect($('song-cymbals'), CYMBAL_MODES, st.cymbals || 'all');
    $('song-count-in').checked = !!st.countIn;
    fillSelect($('song-drum-tune'), DRUM_TUNES, String(st.drumTune || 0));
    const human = Math.round((st.humanize ?? .5) * 100);
    $('song-humanize').value = human; $('song-humanize-value').textContent = human ? `${human} %` : 'quantitzat';
  }
  async function changeSettings(event) {
    if (busy) return;
    const st = song.settings, id = event.target.id;
    const style = $('song-style').value, profile = STYLES[style];
    if (id === 'song-style') {
      song.settings = { ...st, style, bpm: profile.bpm.default, groove: defaultGroove() };
      delete song.settings.subgenre; delete song.settings.swing;
      if (!profile.keys.some(([k, m]) => k === st.tonic && m === st.mode)) [song.settings.tonic, song.settings.mode] = profile.keys[0];
      applyBase(baseDefaults(style));
      song.settings.bars = Math.min(song.settings.bars, Math.floor(MAX_SECONDS / barSeconds()));
      trimSections();
    } else if (id === 'song-bpm') {
      const bpm = Number($('song-bpm').value);
      if (!Number.isInteger(bpm) || bpm < profile.bpm.min || bpm > profile.bpm.max) notify(`Per a ${profile.name.toLowerCase()}, tria un tempo entre ${profile.bpm.min} i ${profile.bpm.max} BPM.`);
      else if (songSecondsWith({ bpm }) > MAX_SECONDS) notify('Amb aquest tempo la cançó superaria els 6 minuts. Escurça-la primer.');
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
    else if (id === 'song-subgenre') {
      const key = event.target.value, sg = engine.SUBGENRES[key];
      if (!sg) { delete st.subgenre; delete st.swing; }
      else {
        // El subgènere decideix d'un cop harmonia, ritmes, balanceig, sons i efectes.
        st.subgenre = key;
        if (sg.swing) st.swing = sg.swing; else delete st.swing;
        st.groove = { drums: sg.groove.drums[0], bass: sg.groove.bass[0], guitar: sg.groove.guitar[0] };
        st.timbres = { ...defaultTimbres(), ...(sg.timbres || {}) };
        for (const key of ['drumTune', 'humanize', 'cymbals', 'countIn']) if (sg[key] !== undefined) st[key] = sg[key]; else delete st[key];
        if (sg.fx) st.fx = { guitar: { ...sg.fx }, guitar2: { ...sg.fx }, guitar3: { ...sg.fx } }; else delete st.fx;
        if (st.bpm < sg.bpm[0] || st.bpm > sg.bpm[1]) st.bpm = Math.min(profile.bpm.max, Math.round((sg.bpm[0] + sg.bpm[1]) / 2));
        if (!sg.keys.some(([t, m]) => t === st.tonic && m === st.mode)) [st.tonic, st.mode] = sg.keys[0];
        applyBase(sg.base);
        notify(`${sg.name}: ${sg.description}`);
      }
    }
    else if (id === 'song-swing') { const v = Number(event.target.value) / 100; if (v) st.swing = v; else delete st.swing; }
    else if (id === 'song-count-in') { if (event.target.checked) st.countIn = true; else delete st.countIn; }
    else if (id === 'song-cymbals') { if (event.target.value === 'all') delete st.cymbals; else st.cymbals = event.target.value; }
    else if (id === 'song-drum-tune') { const v = Number(event.target.value); if (v) st.drumTune = v; else delete st.drumTune; }
    else if (id === 'song-humanize') { const v = Number(event.target.value) / 100; if (v === .5) delete st.humanize; else st.humanize = v; }
    else if (id === 'song-guitar-fx') {
      const type = event.target.value;
      if (type === 'none') delete st.fx;
      else { const horror = type.startsWith('horrorpunk'), setting = { type, drive: horror ? 70 : 60, tone: horror ? 60 : 50 }; st.fx = { guitar: setting, guitar2: { ...setting }, guitar3: { ...setting } }; }
      if (type.startsWith('horrorpunk')) notify(st.style === 'punk' ? 'Horror punk: acords de quinta a cops avall, apagats a l’estrofa i oberts a la tornada, amb dues guitarres a banda i banda.'
        : 'Horror punk activat. Per sonar com els Misfits, prova l’estil Punk a 160–200 BPM.');
    }
    const replay = id.startsWith('groove-') || id.startsWith('timbre-') || ['song-guitar-fx', 'song-subgenre', 'song-swing', 'song-cymbals', 'song-drum-tune', 'song-humanize', 'song-count-in'].includes(id) ? playing?.kind : null;
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
  // ── Pistes de la base a la línia ───────────────────────────────────
  // Una pista per instrument de la base, partida per seccions: cada tros es pot
  // triar (i silenciar, canviar de patró o de so) com qualsevol altre element.
  function baseNote(sec, name) {
    if ((sec.mute || []).includes(name)) return 'silenci';
    const family = name === 'electronicDrums' ? 'drums' : name === 'synthBass' ? 'bass' : name, notes = [];
    if (sec.groove?.[family] !== undefined && ['drums', 'bass', 'guitar'].includes(name)) notes.push(engine.SONG_GROOVES[song.settings.style][family][sec.groove[family]]);
    if (sec.patterns?.[name] !== undefined) notes.push(BASE_PATTERNS[name][sec.patterns[name]]);
    if (sec.timbres?.[name]) notes.push(timbreOptions[name].find(([k]) => k === sec.timbres[name])?.[1].split(' · ')[0]);
    if (name === 'drums' && sec.cymbals) notes.push(CYMBAL_MODES.find(([k]) => k === sec.cymbals)[1].toLowerCase());
    return notes.join(' · ');
  }
  function renderBaseRows() {
    const rows = $('base-rows'); rows.replaceChildren();
    const total = song.settings.bars;
    if (!song.base.generated) {
      const row = document.createElement('div'); row.className = 'line-row';
      const label = document.createElement('span'); label.className = 'line-label'; label.textContent = 'Base';
      const track = document.createElement('div'); track.className = 'line-track';
      span(track, 0, total, 'line-base', `${song.base.instruments.map(name => INSTRUMENTS[name]).join(' + ')} · pendent de generar`);
      row.append(label, track); rows.append(row); return;
    }
    for (const name of song.base.instruments) {
      const row = document.createElement('div'); row.className = 'line-row base-lane';
      const label = document.createElement('span'); label.className = 'line-label'; label.textContent = SHORT[name] || INSTRUMENTS[name];
      label.title = `${INSTRUMENTS[name]} · base`;
      const track = document.createElement('div'); track.className = 'line-track lane base'; track.style.setProperty('--color', instrumentColors[name]);
      for (const seg of segmentsOf(song)) {
        const sec = seg.section;
        if (!sec) { span(track, seg.start, seg.bars, 'line-base ready gap'); continue; }
        const muted = (sec.mute || []).includes(name), note = baseNote(sec, name);
        const block = document.createElement('div'); block.tabIndex = 0; block.setAttribute('role', 'button');
        block.className = `line-base ready piece${muted ? ' muted' : ''}${note && !muted ? ' own' : ''}${sec.id === selected && selectedBase === name ? ' selected' : ''}${busy ? ' disabled' : ''}`;
        block.style.left = pct(seg.start); block.style.width = pct(seg.bars);
        block.textContent = note;
        block.append(timelineMuteButton(sec, name));
        block.setAttribute('aria-label', `${INSTRUMENTS[name]} a ${sectionLabel(sec)}${note ? `: ${note}` : ''}. Toca per triar-lo.`);
        const pick = () => {
          if (busy) return;
          const again = selected === sec.id && selectedBase === name;
          selected = sec.id; selectedBase = name; selectedClip = null;
          if (again) { openSectionEditor(true); return; }
          render(); revealActions();
        };
        block.addEventListener('click', pick);
        block.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } });
        track.append(block);
      }
      row.append(label, track); rows.append(row);
    }
  }
  // Obre el panell de la secció (al mòbil, la pestanya) i, si cal, la part de la base.
  function openSectionEditor(base = false) {
    render();
    if (mobile.matches) setTab('section', !base);
    $(base ? 'section-base-panel' : 'fold-layers').open = true;
    const target = base ? document.querySelector(`#section-base [data-base="${selectedBase}"]`) || $('section-base-panel') : null;
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // ── Barra d'accions de l'element triat (pensada per al mòbil) ───────
  function actionButton(bar, label, title, handler, options = {}) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `button ${options.className || ''}`;
    // «✎ Edita»: al mòbil només es veu la icona (el text queda per als lectors de pantalla).
    const [icon, ...words] = label.split(' ');
    if (words.length && options.compact) { button.append(icon, Object.assign(document.createElement('span'), { className: 'action-text', textContent: ` ${words.join(' ')}` })); }
    else button.textContent = label;
    button.title = title; button.setAttribute('aria-label', title); button.disabled = busy || !!options.disabled;
    button.addEventListener('click', () => { if (!busy) handler(); });
    bar.append(button); return button;
  }
  function lineEdit(change) { stop(); if (change() !== false) save(); render(); }
  function renderLineActions() {
    const bar = $('line-actions'); bar.replaceChildren();
    const clip = song.clips.find(c => c.id === selectedClip), sec = current();
    const title = document.createElement('div'); title.className = 'line-actions-title';
    if (clip) {
      const [lo, hi] = clipBounds(clip);
      title.append(Object.assign(document.createElement('strong'), { textContent: INSTRUMENTS[clip.instrument] }),
        Object.assign(document.createElement('small'), { textContent: `Compassos ${clip.start + 1}–${endOf(clip)} · ${clip.bars} c.` }));
      bar.append(title);
      const move = delta => lineEdit(() => {
        const moved = { ...clip, start: clip.start + delta };
        if (moved.start < 0 || endOf(moved) > song.settings.bars || (!STACKABLE_GUITARS.includes(clip.instrument) && song.clips.some(o => o !== clip && o.instrument === clip.instrument && overlaps(o, moved)))) { notify('No es pot moure més: hi ha un altre clip o s’acaba la cançó.'); return false; }
        clip.start = moved.start; song.clips.sort((a, b) => a.start - b.start);
      });
      actionButton(bar, '◀', 'Mou-lo un compàs enrere', () => move(-1), { disabled: clip.start <= lo });
      actionButton(bar, '▶', 'Mou-lo un compàs endavant', () => move(1), { disabled: endOf(clip) >= hi });
      actionButton(bar, '−', 'Escurça’l un compàs', () => lineEdit(() => { clip.bars -= 1; }), { disabled: clip.bars <= 1 });
      actionButton(bar, '＋', 'Allarga’l un compàs', () => lineEdit(() => { clip.bars += 1; }), { disabled: endOf(clip) >= hi });
      actionButton(bar, '✎ Edita', 'Edita’l al panell de la secció', () => { selected = sectionAt(clip.start)?.id ?? selected; openSectionEditor(); }, { className: 'primary', compact: true });
      actionButton(bar, '🗑', 'Elimina aquest clip', () => { removeClip(clip); selectedClip = null; render(); }, { className: 'danger' });
    } else if (sec && selectedBase && song.base.instruments.includes(selectedBase)) {
      const name = selectedBase, muted = (sec.mute || []).includes(name);
      title.append(Object.assign(document.createElement('strong'), { textContent: `${INSTRUMENTS[name]} · base` }),
        Object.assign(document.createElement('small'), { textContent: `${sectionLabel(sec)}${baseNote(sec, name) ? ` · ${baseNote(sec, name)}` : ' · com la cançó'}` }));
      bar.append(title);
      actionButton(bar, muted ? '🔊 Fes-la sonar' : '🔇 Silencia-la aquí', muted ? 'Torna a fer sonar aquest instrument en aquesta secció' : 'Silencia aquest instrument només en aquesta secció',
        () => changeSectionValue(s => setMute(s, name, !muted)));
      actionButton(bar, '✎ Patró i so', 'Canvia el patró o el so d’aquest instrument en aquesta secció', () => openSectionEditor(true), { className: 'primary' });
    } else if (sec) {
      title.append(Object.assign(document.createElement('strong'), { textContent: sectionLabel(sec) }),
        Object.assign(document.createElement('small'), { textContent: `Compassos ${sec.start + 1}–${endOf(sec)} · ${sec.bars} c. · ${time(sec.bars * barSeconds(sec.bpm))}` }));
      bar.append(title);
      const index = song.sections.indexOf(sec), before = song.sections[index - 1], after = song.sections[index + 1];
      actionButton(bar, '⇠', 'Posa-la abans de la secció anterior', () => lineEdit(() => reorder(sec, before)), { disabled: !before });
      actionButton(bar, '⇢', 'Posa-la després de la secció següent', () => lineEdit(() => reorder(sec, song.sections[index + 2] || null)), { disabled: !after });
      actionButton(bar, '−', 'Escurça-la un compàs', () => lineEdit(() => resizeSectionRight(sec, sec.bars - 1)), { disabled: sec.bars <= 1 });
      actionButton(bar, '＋', 'Allarga-la un compàs', () => lineEdit(() => resizeSectionRight(sec, sec.bars + 1)), { disabled: sec.bars >= MAX_SECTION });
      actionButton(bar, '⧉', 'Duplica-la just després', () => lineEdit(() => duplicateSection(sec)));
      actionButton(bar, '✎ Edita', 'Edita la secció', () => openSectionEditor(), { className: 'primary', compact: true });
      actionButton(bar, '🗑', 'Elimina la secció', () => removeSection(), { className: 'danger' });
    }
    bar.hidden = !bar.childElementCount || !song.base.generated;
  }
  // En triar un element a la línia, els botons es fan visibles (al mòbil quedarien sota el reproductor).
  function revealActions() {
    const bar = $('line-actions');
    if (!bar.hidden) requestAnimationFrame(() => bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  // Duplica una secció just després: la resta es desplaça i els instruments que
  // hi sonen continuen a la còpia.
  function duplicateSection(sec) {
    if (song.sections.length >= MAX_SECTIONS) { notify(`Com a màxim hi pot haver ${MAX_SECTIONS} seccions.`); return false; }
    const edge = endOf(sec), newEnd = Math.max(0, ...[...song.sections, ...song.clips].map(item => endOf(item) >= edge ? endOf(item) + sec.bars : endOf(item)));
    if (newEnd > maxSongBars()) { notify(`La cançó no pot passar de ${maxSongBars()} compassos.`); return false; }
    const inside = song.clips.filter(c => c.start >= sec.start && endOf(c) < edge);
    const tight = Math.max(0, ...song.sections.map(endOf)) === song.settings.bars;
    ripple(edge, sec.bars); fitSong(tight, sec.bars);
    const copy = { ...JSON.parse(JSON.stringify(sec)), id: uid(), start: edge, lyrics: sec.lyrics };
    song.sections.push(copy); song.sections.sort((a, b) => a.start - b.start);
    for (const c of inside) if (song.clips.length < MAX_CLIPS) song.clips.push({ ...JSON.parse(JSON.stringify(c)), id: uid(), start: c.start + sec.bars });
    resolveClips(); selected = copy.id;
    notify(`${sectionLabel(copy)} afegida just després de ${sectionLabel(sec)}.`);
  }
  // ── Zoom de la línia ────────────────────────────────────────────────
  const ZOOMS = [4, 6, 9, 13, 18, 24, 32, 44, 60];
  let zoom = null;
  try { const stored = localStorage.getItem('skagenerator.zoom'); zoom = stored === 'fit' ? 'fit' : Number(stored) || null; } catch {}
  // Per defecte: compassos amples al mòbil (fàcils de tocar), més estrets a l'ordinador.
  function barPx() {
    if (zoom === 'fit') return null;
    return zoom || (window.matchMedia('(max-width: 899px)').matches ? 24 : 13);
  }
  function applyZoom(keep = true) {
    const scroller = $('line-scroll'), line = $('line'), before = scroller.scrollLeft / Math.max(1, scroller.scrollWidth);
    const label = parseFloat(getComputedStyle(line).getPropertyValue('--label')) || 112;
    let px = barPx();
    if (px === null) px = Math.max(2, (scroller.clientWidth - label - 36) / song.settings.bars);
    line.style.setProperty('--bar-px', `${px}px`);
    $('zoom-label').textContent = zoom === 'fit' ? 'Tota la cançó' : `${Math.round(px)} px per compàs`;
    $('zoom-out').disabled = px <= ZOOMS[0]; $('zoom-in').disabled = px >= ZOOMS.at(-1);
    if (keep) scroller.scrollLeft = before * scroller.scrollWidth;
  }
  function setZoom(next) {
    zoom = next;
    try { localStorage.setItem('skagenerator.zoom', String(next)); } catch {}
    applyZoom();
    document.querySelector('.line .selected')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function stepZoom(direction) {
    const px = parseFloat($('line').style.getPropertyValue('--bar-px')) || barPx() || 13;
    const next = direction > 0 ? ZOOMS.find(z => z > px + .5) : [...ZOOMS].reverse().find(z => z < px - .5);
    if (next) setZoom(next);
  }
  function renderLine() {
    const total = song.settings.bars;
    $('line').style.setProperty('--bars', total);
    const ruler = $('line-ruler'); ruler.replaceChildren();
    const step = total > 64 ? 8 : 4;
    for (let b = 0; b < total; b += step) { const tick = span(ruler, b, step, 'tick', String(b + 1)); tick.title = time(secondsAt(b)); }
    const track = $('section-track'); track.replaceChildren(); track.classList.toggle('locked', !song.base.generated || busy);
    for (const sec of song.sections) {
      const block = document.createElement('div'); block.tabIndex = 0; block.setAttribute('role', 'button');
      block.className = `line-section${sec.id === selected ? (selectedClip || selectedBase ? ' context' : ' selected') : ''}${busy ? ' disabled' : ''}`;
      block.style.left = pct(sec.start); block.style.width = pct(sec.bars); block.style.setProperty('--color', colors[sec.type]);
      block.setAttribute('aria-label', `${sectionLabel(sec)}, compassos ${sec.start + 1} a ${endOf(sec)}. Arrossega per moure-la o reordenar-la; fletxes per allargar-la, Maj+fletxes per moure-la.`);
      const name = document.createElement('strong'); name.textContent = sectionLabel(sec);
      const count = song.clips.filter(c => c.generated && overlaps(c, sec)).length;
      const info = document.createElement('small'); info.textContent = `${sec.bars} c. · ${count} instr.${sec.bpm ? ` · ♩${sec.bpm}` : ''}${sec.transpose ? ` · ${sec.transpose > 0 ? '↑' : '↓'}${Math.abs(sec.transpose)}` : ''}`;
      if (sec.bpm) block.classList.add('tempo-change');
      block.append(name, info);
      // Recursos de la secció visibles a la línia: fosos, silencis, final de la cançó, capes i segona bateria.
      // A la línia d'informació, només les icones; el text sencer, en passar-hi per sobre.
      const marks = sectionMarks(sec);
      if (marks.length) { info.textContent += ` · ${marks.map(m => m.split(' ')[0]).join(' ')}`; block.title = `${sectionLabel(sec)}: ${marks.join(' · ')}`; }
      if (sec.fade) { const ramp = document.createElement('span'); ramp.className = `line-fade ${sec.fade}`; ramp.setAttribute('aria-hidden', 'true'); block.append(ramp); }
      if (['break', 'silence'].includes(sec.ending)) {
        const gap = document.createElement('span'); gap.className = 'line-silence'; gap.setAttribute('aria-hidden', 'true');
        gap.style.width = `${(sec.ending === 'silence' ? 1 : .75) / sec.bars * 100}%`; block.append(gap);
      }
      block.setAttribute('aria-label', `${block.getAttribute('aria-label')}${marks.length ? ` Recursos: ${marks.join(', ')}.` : ''}`);
      handles(block); bindDrag(block, 'section', sec);
      block.addEventListener('keydown', event => {
        if (busy) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = sec.id; selectedClip = null; selectedBase = null; render(); return; }
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault(); stop();
        if (event.shiftKey ? moveSection(sec, sec.start + step, null) : resizeSectionRight(sec, sec.bars + step)) save();
        selected = sec.id; render();
        document.querySelector('.line-section.selected')?.focus();
      });
      track.append(block);
    }
    renderBaseRows();
    const rows = $('layer-rows'); rows.replaceChildren();
    const used = [];
    for (const c of song.clips) if (!used.includes(c.instrument)) used.push(c.instrument);
    for (const name of used) {
      // Clips solapats de guitarra 1 o 2 es reparteixen en pistes visibles;
      // cap clip tapa la forma d'ona/rectangle d'una altra guitarra.
      const stacks = [];
      for (const clip of song.clips.filter(c => c.instrument === name)) {
        const rowIndex = STACKABLE_GUITARS.includes(name)
          ? stacks.findIndex(takes => endOf(takes[takes.length - 1]) <= clip.start) : 0;
        const laneIndex = rowIndex < 0 ? stacks.length : rowIndex;
        (stacks[laneIndex] ||= []).push(clip);
      }
      for (const [laneIndex, laneClips] of stacks.entries()) {
      const row = document.createElement('div'); row.className = 'line-row';
      const label = document.createElement('span'); label.className = 'line-label';
      label.textContent = (SHORT[name] || INSTRUMENTS[name]) + (laneIndex ? ` · pista ${laneIndex + 1}` : '');
      label.title = INSTRUMENTS[name];
      const lane = document.createElement('div'); lane.className = 'line-track lane'; lane.title = `Fes clic en un espai buit per afegir ${INSTRUMENTS[name].toLowerCase()}`;
      lane.style.setProperty('--color', instrumentColors[name]);
      for (const clip of laneClips) {
        const element = document.createElement('div'); element.tabIndex = 0; element.setAttribute('role', 'button');
        element.className = `line-clip${clip.generated ? ' ready' : ''}${clip.id === selectedClip ? ' selected' : ''}`;
        element.style.left = pct(clip.start); element.style.width = pct(clip.bars);
        element.title = `${clipLabel(clip)}${clip.color ? ` · so de ${engine.COLOR_FX[clip.color].toLowerCase()}` : ''}${clip.generated ? '' : ' · pendent de generar'}`;
        // Efecte de color (ràdio, megàfon, telèfon, gramòfon): icona i nom dins del clip.
        if (clip.color) { element.classList.add('colored'); const tag = document.createElement('span'); tag.className = 'line-clip-tag'; tag.textContent = `${COLOR_ICONS[clip.color]} ${engine.COLOR_FX[clip.color]}`; element.append(tag); }
        element.setAttribute('aria-label', `${element.title}. Arrossega per moure’l o estira’l per les vores.`);
        handles(element); bindDrag(element, 'clip', clip);
        lane.append(element);
      }
      // Botons M superposats al tram real de cada instrument i secció.
      for (const sec of song.sections) for (const clip of laneClips) {
        if (!clip.generated || !overlaps(clip, sec)) continue;
        const from = Math.max(clip.start, sec.start), to = Math.min(endOf(clip), endOf(sec));
        if ((sec.mute || []).includes(name)) {
          const overlay = document.createElement('span'); overlay.className = 'line-muted-range';
          overlay.style.left = pct(from); overlay.style.width = pct(to - from); lane.append(overlay);
        }
        const mute = timelineMuteButton(sec, name);
        mute.classList.add('on-layer'); mute.style.left = pct((from + to) / 2);
        lane.append(mute);
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
    }
    $('line-hint').textContent = !song.base.generated ? 'Primer genera la base (pas 1).'
      : song.sections.length ? 'Arrossega una secció o un instrument per moure’l o estirar-lo. Pots afegir diverses guitarres 1 i 2 simultàniament.'
      : 'Fes clic a la fila «Seccions» on vulguis que comenci la primera secció.';
    renderLineActions(); applyZoom(false);
    updatePlayhead(scrubBar ?? (playing ? barAt(playing.startSeconds + playing.clock()) : cueBar));
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
    $('section-start-time').textContent = time(secondsAt(sec.start));
    $('section-bars').value = sec.bars; $('section-bars').max = MAX_SECTION;
    $('section-time').textContent = time(sec.bars * barSeconds(sec.bpm));
    const keyOf = shift => `${noteNames[(song.settings.tonic + shift + 12) % 12]} ${song.settings.mode === 'major' ? 'major' : 'menor'}`;
    fillSelect($('section-transpose'), Array.from({ length: 13 }, (_, i) => i - 6).map(t => [String(t),
      t === 0 ? `Igual que la cançó (${keyOf(0)})` : `${t > 0 ? '+' : '−'}${Math.abs(t)} semitò${Math.abs(t) > 1 ? 'ns' : ''} · ${keyOf(t)}`]), String(sec.transpose || 0));
    $('section-key-name').textContent = sec.transpose ? '↑ modulació' : '';
    renderSectionBase(sec);
    // A la secció final, el selector tria com acaba la cançó.
    const closingMode = sec.type === 'outro';
    $('section-ending-label').textContent = closingMode ? 'FINAL DE LA CANÇÓ' : 'FINAL DE LA SECCIÓ';
    if (closingMode) fillSelect($('section-ending'), CLOSINGS, sec.closing || 'hit');
    else fillSelect($('section-ending'), ENDINGS, sec.ending || 'fill');
    fillSelect($('section-fade'), FADES, sec.fade || '');
    fillSelect($('section-offbeat'), OFFBEAT, sec.offbeat ? 'yes' : '');
    const layered = [sec.entrance && 'entrada per capes', sec.exit && 'sortida per capes'].filter(Boolean);
    $('section-edges-info').textContent = layered.length ? `Aquesta secció té ${layered.join(' i ')} (de «Inici i final nous»).` : '';
    $('section-bpm').value = sec.bpm ?? ''; $('section-bpm').placeholder = String(song.settings.bpm);
    $('section-bpm-hint').textContent = sec.bpm ? (sec.bpm > song.settings.bpm ? 'més ràpida que la cançó' : sec.bpm < song.settings.bpm ? 'més lenta que la cançó' : 'igual que la cançó') : `buit = ${song.settings.bpm} (cançó)`;
    const energy = sec.energy ?? TYPES[sec.type].energy;
    $('section-energy').value = energy; $('section-energy-value').textContent = `${energy} %${sec.energy === undefined ? ' · per defecte' : ''}`;
    renderVolumes(sec);
    $('section-chords').textContent = `Acords: ${chordsOf(seg)}`;
    $('section-reharmonize').textContent = song.sections.filter(s => s.type === sec.type).length > 1 ? `↻ Altres acords per a totes ${plurals[sec.type]}` : '↻ Altres acords';
    $('section-lyrics').value = sec.lyrics;
    renderLyricsInfo(sec);
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
      item.append(number, text, generate, remove);
      item.append(clipTone(clip));
      list.append(item);
    });
    const available = Object.keys(INSTRUMENTS).filter(name => STACKABLE_GUITARS.includes(name) || (!song.base.instruments.includes(name) && !clips.some(c => c.instrument === name && c.start <= sec.start && endOf(c) >= endOf(sec))));
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
  function renderLyricsInfo(sec) {
    const counts = lyricSyllables(sec.lyrics), voice = song.clips.some(c => c.instrument === 'vocal' && overlaps(c, sec));
    $('lyrics-info').textContent = counts.length
      ? `${voice ? 'La melodia de veu fa' : 'Si hi afegeixes la «Melodia de veu», farà'} ${counts.length} frase${counts.length > 1 ? 's' : ''}, una per vers: ${counts.join(' · ')} síl·labes.`
      : voice ? 'Sense lletra, la melodia de veu fa frases amb respiracions. Escriu un vers per línia perquè s’hi ajusti.' : '';
  }
  // So i efecte de cada clip de guitarra.
  function clipTone(clip) {
    const box = document.createElement('div'); box.className = 'clip-tone';
    const fx = clip.fx || defaultFx();
    const select = (label, entries, value, onChange) => {
      const wrap = document.createElement('label'), caption = document.createElement('span'), input = document.createElement('select');
      caption.className = 'field-label'; caption.textContent = label; fillSelect(input, entries, value); input.disabled = busy;
      input.addEventListener('change', () => onChange(input.value)); wrap.append(caption, input); return wrap;
    };
    const slider = (label, key, left, right) => {
      const wrap = document.createElement('label'), caption = document.createElement('span'), output = document.createElement('output'), input = document.createElement('input');
      caption.className = 'field-label'; caption.textContent = label; output.textContent = `${fx[key]}`; caption.append(output);
      input.type = 'range'; input.min = 0; input.max = 100; input.step = 5; input.value = fx[key]; input.disabled = busy || !clip.fx || fx.type === 'none';
      input.setAttribute('aria-label', `${label} · ${INSTRUMENTS[clip.instrument]}`);
      input.addEventListener('input', () => { output.textContent = input.value; });
      input.addEventListener('change', () => changeClipTone(clip, { fx: { ...fx, [key]: Number(input.value) } }));
      const hint = document.createElement('small'); hint.className = 'slider-hint'; hint.innerHTML = '';
      const a = document.createElement('span'), b = document.createElement('span'); a.textContent = left; b.textContent = right; hint.append(a, b);
      wrap.append(caption, input, hint); return wrap;
    };
    const feelSelect = select('RITME', FEELS, String(clip.feel ?? 1), value => changeClipTone(clip, { feel: Number(value) }));
    const lineSelect = LINE_INSTRUMENTS.includes(clip.instrument)
      ? select('LÍNIA', LINES, clip.line || 'own', value => changeClipTone(clip, { line: value })) : null;
    if (clip.instrument === 'vocal') {
      box.classList.add('only-feel');
      box.append(feelSelect, select('REGISTRE', [['-1', 'Greu (veu d’home)'], ['0', 'Mitjà'], ['1', 'Agut (veu de dona)']], String(clip.register ?? 0),
        value => changeClipTone(clip, { register: Number(value) })));
      return box;
    }
    // Efecte de color: el so passa per una ràdio, un megàfon, un telèfon o un gramòfon.
    const colorSelect = engine.COLOR_INSTRUMENTS.includes(clip.instrument)
      ? select('COLOR DEL SO', [['none', 'Directe (sense aparell)'], ...Object.entries(engine.COLOR_FX)], clip.color || 'none', value => changeClipTone(clip, { color: value })) : null;
    if (!GUITARS.includes(clip.instrument)) { box.classList.add('only-feel'); box.append(feelSelect); if (lineSelect) box.append(lineSelect); if (colorSelect) box.append(colorSelect); return box; }
    if (lineSelect) box.append(lineSelect);
    box.append(colorSelect);
    box.append(feelSelect,
      select('SO', timbreOptions.guitar.map(([k, v]) => [k, k === 'auto' ? 'Com la guitarra de la cançó' : v]), clip.sound || 'auto', value => changeClipTone(clip, { sound: value })),
      select('EFECTE', [['inherit', `Com la cançó (${engine.GUITAR_FX[song.settings.fx?.guitar?.type || 'none']})`], ...Object.entries(engine.GUITAR_FX)], clip.fx?.type ?? 'inherit',
        value => changeClipTone(clip, { fx: value === 'inherit' ? null : { ...fx, type: value } })),
      slider('GUANY', 'drive', 'Poc', 'Molt'), slider('TO', 'tone', 'Fosc', 'Brillant'));
    return box;
  }
  function changeClipTone(clip, change) {
    if (busy) return;
    if ('sound' in change) { if (change.sound === 'auto') delete clip.sound; else clip.sound = change.sound; }
    if ('line' in change) { if (change.line === 'own') delete clip.line; else clip.line = change.line; }
    if ('register' in change) { if (change.register === 0) delete clip.register; else clip.register = change.register; }
    if ('feel' in change) { if (change.feel === 1) delete clip.feel; else clip.feel = change.feel; }
    if ('fx' in change) { if (change.fx === null) delete clip.fx; else clip.fx = change.fx; }
    if ('color' in change) { if (change.color === 'none') delete clip.color; else clip.color = change.color; }
    const replay = playing?.kind; stop(); save(); render();
    if (replay === 'song' || replay === 'section') play(replay);
  }
  // Volums ràpids de la secció (fan servir l'equalitzador de la secció).
  // ── La base dins d'una secció ──────────────────────────────────────
  // Cada instrument de la base es pot silenciar, canviar de patró o de so només
  // en aquesta secció; «Com la cançó» torna al valor general.
  function renderSectionBase(sec) {
    const list = $('section-base'); list.replaceChildren();
    const grooves = engine.SONG_GROOVES[song.settings.style];
    for (const name of song.base.instruments) {
      const muted = (sec.mute || []).includes(name);
      const item = document.createElement('li'); item.className = `layer-row base-row${muted ? ' muted' : ' ready'}${name === selectedBase ? ' selected' : ''}`;
      item.style.setProperty('--color', instrumentColors[name]); item.dataset.base = name;
      const toggle = document.createElement('label'); toggle.className = 'base-toggle';
      const box = document.createElement('input'); box.type = 'checkbox'; box.checked = !muted; box.disabled = busy;
      box.setAttribute('aria-label', `${INSTRUMENTS[name]} sona en aquesta secció`);
      box.addEventListener('change', () => changeSectionValue(s => setMute(s, name, !box.checked)));
      const text = document.createElement('span');
      const strong = document.createElement('strong'); strong.textContent = INSTRUMENTS[name];
      const small = document.createElement('small'); small.textContent = muted ? 'En silenci en aquesta secció' : 'Sona en aquesta secció';
      text.append(strong, small); toggle.append(box, text); item.append(toggle);
      const controls = document.createElement('div'); controls.className = 'clip-tone base-tone';
      const field = (label, entries, value, onChange) => {
        const wrap = document.createElement('label'); const caption = document.createElement('span'); caption.className = 'field-label'; caption.textContent = label;
        const select = document.createElement('select'); fillSelect(select, entries, value); select.disabled = busy || muted;
        select.setAttribute('aria-label', `${label.toLowerCase()} de ${INSTRUMENTS[name].toLowerCase()} en aquesta secció`);
        select.addEventListener('change', () => changeSectionValue(s => onChange(s, select.value)));
        wrap.append(caption, select); controls.append(wrap);
      };
      const family = name === 'electronicDrums' ? 'drums' : name === 'synthBass' ? 'bass' : name;
      if (grooves[family] && ['drums', 'bass', 'guitar'].includes(name)) {
        const general = grooves[family][song.settings.groove[family]];
        field('PATRÓ', [['inherit', `Com la cançó (${general})`], ...grooves[family].map((label, i) => [String(i), label])], sec.groove?.[family] === undefined ? 'inherit' : String(sec.groove[family]),
          (s, v) => { const next = { ...(s.groove || {}) }; if (v === 'inherit') delete next[family]; else next[family] = Number(v); if (Object.keys(next).length) s.groove = next; else delete s.groove; });
      }
      if (BASE_PATTERNS[name]) field('PATRÓ', [['inherit', 'Com la cançó'], ...BASE_PATTERNS[name].map((label, i) => [String(i), label])], sec.patterns?.[name] === undefined ? 'inherit' : String(sec.patterns[name]),
        (s, v) => { const next = { ...(s.patterns || {}) }; if (v === 'inherit') delete next[name]; else next[name] = Number(v); if (Object.keys(next).length) s.patterns = next; else delete s.patterns; });
      if (BASE_SOUNDS.includes(name)) {
        const general = timbreOptions[name].find(([k]) => k === song.settings.timbres[name])?.[1] || 'Segons l’estil';
        field('SO', [['inherit', `Com la cançó (${general})`], ...timbreOptions[name].filter(([k]) => k !== 'auto')], sec.timbres?.[name] || 'inherit',
          (s, v) => { const next = { ...(s.timbres || {}) }; if (v === 'inherit') delete next[name]; else next[name] = v; if (Object.keys(next).length) s.timbres = next; else delete s.timbres; });
      }
      // Els platets valen per a la bateria acústica i l'electrònica: es mostren a la primera.
      if (name === song.base.instruments.find(n => n === 'drums' || n === 'electronicDrums'))
        field('PLATETS', [['inherit', `Com la cançó (${CYMBAL_MODES.find(([k]) => k === (song.settings.cymbals || 'all'))[1].toLowerCase()})`], ...CYMBAL_MODES], sec.cymbals || 'inherit',
          (s, v) => { if (v === 'inherit') delete s.cymbals; else s.cymbals = v; });
      if (controls.childElementCount) item.append(controls);
      list.append(item);
    }
  }
  function setMute(sec, name, muted) {
    const next = new Set(sec.mute || []);
    if (muted) next.add(name); else next.delete(name);
    if (next.size) sec.mute = Object.keys(INSTRUMENTS).filter(n => next.has(n)); else delete sec.mute;
  }
  // ── Volums: general de cada instrument + ajust de cada secció ─────────
  // El volum final d'un instrument en una secció és la suma del volum general
  // (tota la cançó) i de l'ajust d'aquella secció. Canviar el general afecta
  // totes les seccions i conserva els ajustos de cadascuna.
  const VOLUME_FAMILY = { drums: 'drums', electronicDrums: 'drums', bass: 'bass', synthBass: 'bass' };
  const dbText = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB`;
  // Bateria i baix fan servir el volum general de la base (també el dels instruments electrònics).
  const generalVolume = name => VOLUME_FAMILY[name] ? song.settings.baseVolume?.[VOLUME_FAMILY[name]] || 0 : song.settings.volumes?.[name] || 0;
  // Projectes anteriors: el volum era dins de l'equalitzador i el d'una secció substituïa el de la cançó.
  function migrateVolumes(value) {
    const st = value.settings, songVolume = name => st.mix?.[name]?.volume || 0, clampDb = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    for (const sec of value.sections || []) {
      if (!sec?.mix || typeof sec.mix !== 'object') continue;
      for (const [name, band] of Object.entries(sec.mix)) {
        if (!band || typeof band !== 'object') continue;
        const offset = (band.volume || 0) - songVolume(name);
        if (offset) sec.volumes = { ...(sec.volumes || {}), [name]: clampDb((sec.volumes?.[name] || 0) + offset, -24, 12) };
        sec.mix[name] = { ...band, volume: 0 };
        if (isFlat(sec.mix[name]) && !songVolume(name) && !st.mix?.[name]) delete sec.mix[name];
      }
      if (!Object.keys(sec.mix).length) delete sec.mix;
    }
    if (st.mix && typeof st.mix === 'object') for (const [name, band] of Object.entries(st.mix)) {
      if (!band?.volume) continue;
      if (VOLUME_FAMILY[name]) st.baseVolume = { ...defaultBaseVolume(), ...(st.baseVolume || {}), [VOLUME_FAMILY[name]]: clampDb((st.baseVolume?.[VOLUME_FAMILY[name]] || 0) + band.volume, -24, 6) };
      else st.volumes = { ...(st.volumes || {}), [name]: clampDb((st.volumes?.[name] || 0) + band.volume, -24, 6) };
      st.mix[name] = { ...band, volume: 0 };
      if (isFlat(st.mix[name])) delete st.mix[name];
    }
    if (st.mix && !Object.keys(st.mix).length) delete st.mix;
  }
  function volumeRow(name, value, [min, max], caption, onChange, describe) {
    const row = document.createElement('label'); row.className = `volume-row${value ? ' own' : ''}`;
    if (name !== 'master') row.style.setProperty('--color', instrumentColors[name]);
    const label = document.createElement('span'); label.textContent = caption;
    const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = 1; input.value = value; input.disabled = busy;
    const output = document.createElement('output'); output.textContent = describe(value);
    input.addEventListener('input', () => { output.textContent = describe(Number(input.value)); });
    input.addEventListener('change', () => onChange(Number(input.value)));
    row.append(label, input, output);
    return [row, input];
  }
  function renderSongVolumes() {
    const list = $('song-volumes'); list.replaceChildren();
    for (const name of eqNames(null)) {
      const caption = name === 'master' ? 'Mescla total' : INSTRUMENTS[name];
      const [row, input] = volumeRow(name, generalVolume(name), [-24, 6], caption, value => changeSongVolume(name, value), dbText);
      input.setAttribute('aria-label', `Volum general de ${caption} a tota la cançó`);
      list.append(row);
    }
  }
  function replayAfter(change) {
    const replay = playing && playing.kind !== 'record' ? { kind: playing.kind, bar: barAt(playing.startSeconds + playing.clock()) } : null;
    stop(); change(); save(); updateSettingsUI(); render();
    if (replay) { cueBar = replay.bar; play(replay.kind); }
  }
  function changeSongVolume(name, db) {
    if (busy || !Number.isInteger(db) || db < -24 || db > 6) return;
    if (VOLUME_FAMILY[name]) { changeBaseVolume(VOLUME_FAMILY[name], db); return; }
    replayAfter(() => {
      const volumes = { ...(song.settings.volumes || {}) };
      if (db) volumes[name] = db; else delete volumes[name];
      if (Object.keys(volumes).length) song.settings.volumes = volumes; else delete song.settings.volumes;
    });
  }
  function changeSectionVolume(sec, name, db) {
    if (busy || !Number.isInteger(db) || db < -24 || db > 12) return;
    replayAfter(() => {
      const volumes = { ...(sec.volumes || {}) };
      if (db) volumes[name] = db; else delete volumes[name];
      if (Object.keys(volumes).length) sec.volumes = volumes; else delete sec.volumes;
    });
  }
  function renderVolumes(sec) {
    const list = $('section-volumes'); list.replaceChildren();
    for (const name of eqNames(sec)) {
      const caption = name === 'master' ? 'Secció sencera' : INSTRUMENTS[name], general = generalVolume(name);
      const [row, input] = volumeRow(name, sec.volumes?.[name] || 0, [-24, 12], caption, value => changeSectionVolume(sec, name, value),
        v => `${dbText(v)}${general || v ? ` · total ${dbText(general + v)}` : ''}`);
      input.setAttribute('aria-label', `Ajust del volum de ${caption} en aquesta secció, sobre el volum general`);
      if (song.base.instruments.includes(name)) {
        const feel = document.createElement('select'); feel.className = 'feel-select'; feel.disabled = busy;
        feel.setAttribute('aria-label', `Ritme de ${caption} en aquesta secció`);
        fillSelect(feel, FEELS, String(sec.feel?.[name] ?? 1));
        feel.addEventListener('change', () => {
          const value = Number(feel.value), next = { ...(sec.feel || {}) };
          if (value === 1) delete next[name]; else next[name] = value;
          if (Object.keys(next).length) sec.feel = next; else delete sec.feel;
          const replay = playing?.kind; stop(); save(); render();
          if (replay === 'song' || replay === 'section') play(replay);
        });
        row.append(feel); row.classList.add('with-feel');
      }
      list.append(row);
    }
  }
  // Volums generals additius: afecten tots els trams, fins i tot les seccions
  // amb mescla particular, i també els instruments electrònics d'urban.
  function changeBaseVolume(name, db) {
    if (busy || !['drums', 'bass'].includes(name) || !Number.isInteger(db) || db < -24 || db > 6) return;
    song.settings.baseVolume = { ...defaultBaseVolume(), ...(song.settings.baseVolume || {}), [name]: db };
    const replay = playing && playing.kind !== 'record'
      ? { kind: playing.kind, bar: barAt(playing.startSeconds + playing.clock()) } : null;
    stop(); save(); updateSettingsUI(); render();
    if (replay) { cueBar = replay.bar; play(replay.kind); }
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
        if (key === 'volume') continue; // El volum es tria a «Volum general» i a «Volums d'aquesta secció».
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
    renderLine(); renderSection(); renderComments();
    renderEq($('song-eq'), null); renderSongVolumes();
    if (current()) renderEq($('section-eq'), current());
    const generatedLayers = song.clips.filter(c => c.generated).length;
    const total = songSeconds();
    $('song-time').textContent = time(total);
    $('duration-total').textContent = `${song.settings.bars} compassos · ${time(total)} · ${song.sections.length} seccions`;
    $('base-state').textContent = busy ? 'Preparant el so…' : song.base.generated ? 'Generada ✓' : 'Pendent de generar';
    $('base-state').classList.toggle('ready', song.base.generated);
    $('generate-base').textContent = song.base.generated ? '↻ Genera una altra base' : '✦ Genera la base';
    $('base-chords').textContent = song.base.generated ? `Acords de la base: ${chordsOf(segmentsOf({ ...song, sections: [] })[0])}` : '';
    $('play-base').textContent = playing?.kind === 'base' ? '■ Atura la base' : '▷ Escolta la base';
    $('transport-title').textContent = song.title || 'Nova cançó';
    const changes = song.sections.some(x => x.bpm && x.bpm !== song.settings.bpm);
    if (!playing) $('tempo-badge').textContent = `♩ ${song.settings.bpm} BPM${changes ? ' · amb canvis' : ''}`;
    $('tempo-badge').title = changes ? 'La cançó té seccions amb un tempo propi' : 'Tempo de la cançó';
    $('ready-count').textContent = song.base.generated ? `Base ✓ · ${song.sections.length} seccions · ${generatedLayers} instruments generats` : 'Genera la base per començar';
    if (!playing) {
      $('transport-subtitle').textContent = !song.base.generated ? 'Comença generant la base' : generatedLayers ? 'Escolta com creix la cançó' : 'Marca seccions i afegeix-hi instruments';
      $('playback-duration').textContent = time(total); $('play-song').textContent = '▶';
      $('song-progress').value = Math.max(0, Math.min(1, secondsAt(cueBar) / total));
      $('playback-time').textContent = time(secondsAt(cueBar));
    } else { $('playback-duration').textContent = time(total); $('play-song').textContent = playing.kind === 'song' ? '■' : '▶'; }
    const ready = song.base.generated;
    for (const key of ['new-song', 'song-title', 'song-style', 'song-bpm', 'song-key', 'song-bars', 'generate-base', 'add-section', 'import-project', 'export-project',
      'groove-drums', 'groove-bass', 'groove-guitar', 'timbre-guitar', 'timbre-bass', 'timbre-drums', 'timbre-trumpet', 'timbre-trombone', 'timbre-vocal', 'song-guitar-fx', 'section-type', 'section-start', 'section-bars',
      'section-reharmonize', 'remove-section', 'copy-previous', 'section-energy', 'section-bpm', 'section-transpose', 'section-ending', 'section-fade', 'section-offbeat', 'design-edges']) $(key).disabled = busy;
    $('add-variety').disabled = busy || !ready || song.sections.length < 3;
    $('clear-variety').hidden = !song.sections.some(s => s.bpm || s.transpose || s.groove || s.feel?.drums);
    for (const name of BASE_CHOICES) $(`base-${name}`).disabled = busy;
    for (const key of ['play-base', 'play-song', 'download-song', 'play-section', 'play-song-inline']) $(key).disabled = busy || !ready;
    $('add-section').disabled = busy || !ready;
    $('stop-playback').disabled = !playing;
    $('song-progress').disabled = busy || !ready || !!recording;
    document.body.classList.toggle('busy', busy);
    renderTabs(); renderVoice();
    if ($('library-list').childElementCount || readLibrary().length) renderLibrary();
  }

  // ── Biblioteca de cançons amb puntuacions ──────────────────────────
  const LIBRARY_KEY = 'skagenerator.library', LIBRARY_MAX = 200;
  function readLibrary() { try { const list = JSON.parse(localStorage.getItem(LIBRARY_KEY)); return Array.isArray(list) ? list : []; } catch { return []; } }
  function writeLibrary(list) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(list.slice(0, LIBRARY_MAX))); return true; }
    catch { notify('No hi ha prou espai al navegador per a la biblioteca. Esborra o exporta alguna cançó.'); return false; }
  }
  const songSecondsOf = s => s.sections.reduce((t, x) => t + x.bars * 240 / (x.bpm || s.settings.bpm), 0)
    + Math.max(0, s.settings.bars - s.sections.reduce((n, x) => n + x.bars, 0)) * 240 / s.settings.bpm;
  function addToLibrary() {
    const list = readLibrary(), id = uid();
    song.libraryId = id;
    list.unshift({ id, title: song.title, subgenre: song.settings.subgenre || '', style: song.settings.style, seconds: Math.round(songSecondsOf(song)), created: Date.now(), rating: 0, song: JSON.parse(JSON.stringify(song)) });
    writeLibrary(list); save(); renderLibrary();
  }
  function syncLibrary() {
    const list = readLibrary(), entry = list.find(e => e.id === song.libraryId);
    if (!entry) { delete song.libraryId; return; }
    Object.assign(entry, { title: song.title, subgenre: song.settings.subgenre || '', style: song.settings.style, seconds: Math.round(songSecondsOf(song)), song: JSON.parse(JSON.stringify(song)) });
    writeLibrary(list); renderLibrary();
  }
  function rate(id, stars) {
    const list = readLibrary(), entry = list.find(e => e.id === id); if (!entry) return;
    entry.rating = entry.rating === stars ? 0 : stars; writeLibrary(list); renderLibrary(); renderAutoDescription();
  }
  async function openFromLibrary(entry) {
    if (busy) return;
    if (song.libraryId !== entry.id && (song.base.generated || song.sections.length) && !song.libraryId
      && !await ask(`Obrir «${entry.title}»?`, 'La cançó actual no és a la biblioteca: desa-la abans si la vols conservar.')) return;
    try { migrated = false; const opened = validateSong(JSON.parse(JSON.stringify(entry.song))); opened.libraryId = entry.id; openSong(opened, `«${entry.title}» oberta.`); if (mobile.matches) setTab('line'); }
    catch (error) { console.error(error); notify('Aquesta cançó de la biblioteca no s’ha pogut obrir.'); }
  }
  async function removeFromLibrary(entry) {
    if (!await ask(`Esborrar «${entry.title}» de la biblioteca?`, 'No es pot desfer. Si la vols conservar, exporta-la abans.')) return;
    writeLibrary(readLibrary().filter(e => e.id !== entry.id));
    if (song.libraryId === entry.id) { delete song.libraryId; save(); }
    renderLibrary(); renderAutoDescription();
  }
  function renderLibrary() {
    const list = readLibrary(), box = $('library-list'), order = $('library-sort').value;
    if (order === 'rating') list.sort((a, b) => b.rating - a.rating || b.created - a.created);
    else if (order === 'subgenre') list.sort((a, b) => (a.subgenre || a.style).localeCompare(b.subgenre || b.style) || b.rating - a.rating);
    box.replaceChildren();
    if (!list.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Encara no hi ha cap cançó. Crea’n una d’automàtica o desa la cançó actual.'; box.append(empty); }
    for (const entry of list) {
      const row = document.createElement('div'); row.className = `library-row ${entry.style}${entry.id === song.libraryId ? ' current' : ''}`;
      const info = document.createElement('div'); info.className = 'library-info';
      const title = document.createElement('strong'); title.textContent = entry.title;
      const meta = document.createElement('small');
      const notes = entry.song?.comments?.length || 0;
      meta.textContent = `${engine.SUBGENRES[entry.subgenre]?.name || (entry.style === 'punk' ? 'Punk' : entry.style === 'urban' ? 'Urban' : 'Ska')} · ${time(entry.seconds)} · ${new Date(entry.created).toLocaleDateString('ca')}${notes ? ` · 💬 ${notes}` : ''}`;
      info.append(title, meta);
      const stars = document.createElement('div'); stars.className = 'stars'; stars.setAttribute('role', 'group'); stars.setAttribute('aria-label', `Puntuació de ${entry.title}`);
      for (let n = 1; n <= 5; n++) {
        const star = document.createElement('button'); star.type = 'button'; star.className = `star${n <= entry.rating ? ' on' : ''}`; star.textContent = n <= entry.rating ? '★' : '☆';
        star.setAttribute('aria-label', `${n} estrella${n > 1 ? 's' : ''}`); star.setAttribute('aria-pressed', String(n <= entry.rating));
        star.addEventListener('click', () => rate(entry.id, n)); stars.append(star);
      }
      const open = document.createElement('button'); open.type = 'button'; open.className = 'button'; open.textContent = entry.id === song.libraryId ? '✓ Oberta' : '▷ Obre';
      open.disabled = busy || entry.id === song.libraryId; open.addEventListener('click', () => openFromLibrary(entry));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Esborrar ${entry.title}`); remove.addEventListener('click', () => removeFromLibrary(entry));
      row.append(info, stars, open, remove); box.append(row);
    }
    $('library-save').hidden = !!song.libraryId; $('library-save').disabled = busy || !song.base.generated;
    // Botó d'exportar amb el nombre de cançons que tenen comentaris.
    const commented = exportableSongs().filter(hasComments).length;
    $('library-export').textContent = `⇩ Baixa les cançons amb comentaris${commented ? ` (${commented})` : ''}`;
    $('library-export').disabled = !commented;
    $('library-export').title = commented ? `Un sol fitxer amb les ${commented} cançons que tenen comentaris` : 'Encara no hi ha cap cançó amb comentaris';
  }
  // ── Comentaris de la cançó ─────────────────────────────────────────
  // De tota la cançó, d'una secció o del punt on és el capçal. Es desen amb la
  // cançó (i a la biblioteca) i s'exporten amb «Exporta les cançons amb comentaris».
  fillSelect($('comment-tag'), Object.entries(builder.COMMENT_TAGS), 'general');
  fillSelect($('comment-mood'), Object.entries(builder.COMMENT_MOODS), 'good');
  const commentPlace = bar => bar === null ? 'Tota la cançó' : `${sectionAt(bar) ? sectionLabel(sectionAt(bar)) : 'Base sola'} · compàs ${bar + 1}`;
  function commentOptions() {
    const where = $('comment-where'), keep = where.value;
    const entries = [['song', 'Tota la cançó'],
      ...(playheadBar !== null && song.base.generated ? [['now', `On és el capçal (compàs ${Math.min(song.settings.bars, Math.floor(playheadBar) + 1)})`]] : []),
      ...[...song.sections].sort((a, b) => a.start - b.start).map(sec => [`sec:${sec.id}`, `${sectionLabel(sec)} · compassos ${sec.start + 1}–${endOf(sec)}`])];
    fillSelect(where, entries, entries.some(([key]) => key === keep) ? keep : 'song');
  }
  // Desa ara mateix la cançó oberta a la biblioteca (sense esperar el desament diferit).
  function flushLibrary() { if (song.libraryId) { clearTimeout(libraryTimer); syncLibrary(); } }
  function renderComments() {
    commentOptions();
    const list = $('comment-list'); list.replaceChildren();
    const comments = [...(song.comments || [])].sort((a, b) => (a.bar ?? -1) - (b.bar ?? -1) || a.created - b.created);
    for (const comment of comments) {
      const item = document.createElement('li'); item.className = `comment ${comment.mood}`;
      const head = document.createElement('small');
      head.textContent = `${builder.COMMENT_MOODS[comment.mood]} · ${builder.COMMENT_TAGS[comment.tag]} · ${commentPlace(comment.bar)}`;
      const text = document.createElement('p'); text.textContent = comment.text;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '×';
      remove.setAttribute('aria-label', 'Esborra el comentari'); remove.title = 'Esborra el comentari';
      remove.addEventListener('click', () => { song.comments = song.comments.filter(c => c.id !== comment.id); save(); flushLibrary(); renderComments(); });
      item.append(head, text, remove); list.append(item);
    }
  }
  function addComment() {
    const text = $('comment-text').value.trim();
    if (!text) { notify('Escriu el comentari abans d’afegir-lo.'); $('comment-text').focus(); return; }
    const where = $('comment-where').value;
    const bar = where === 'now' && playheadBar !== null ? Math.min(song.settings.bars - 1, Math.floor(playheadBar))
      : where.startsWith('sec:') ? song.sections.find(sec => `sec:${sec.id}` === where)?.start ?? null : null;
    song.comments = [...(song.comments || []), { id: uid(), text: text.slice(0, 1000), bar, tag: $('comment-tag').value, mood: $('comment-mood').value, created: Date.now() }].slice(-200);
    $('comment-text').value = '';
    const stored = !song.libraryId && song.base.generated;
    save();
    if (stored) addToLibrary(); else flushLibrary();
    renderComments();
    notify(stored ? 'Comentari afegit. La cançó s’ha desat a «Les meves cançons» perquè es pugui exportar.' : `Comentari afegit (${commentPlace(bar)}).`);
  }
  $('comment-add').addEventListener('click', addComment);
  $('comment-text').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) addComment(); });
  // El capçal es mou mentre sona: l'opció «On és el capçal» s'actualitza en obrir el selector.
  for (const type of ['focus', 'pointerdown']) $('comment-where').addEventListener(type, commentOptions);
  // Cançons per exportar: les de la biblioteca i, si té comentaris i no hi és, la cançó oberta.
  function exportableSongs() {
    const list = readLibrary();
    if (song.comments?.length && !song.libraryId) list.unshift({ title: song.title, rating: 0, created: Date.now(), song });
    return list;
  }
  function hasComments(entry) { return !!entry.song?.comments?.length; }
  // Totes les cançons amb comentaris en un sol fitxer (o totes, amb «Baixa-les totes»).
  function exportSongs(onlyCommented) {
    flushLibrary();
    const all = exportableSongs(), list = onlyCommented ? all.filter(hasComments) : all;
    if (!list.length) {
      notify(onlyCommented ? 'Encara no hi ha cap cançó amb comentaris. Afegeix-ne al panell «Comentaris de la cançó».' : 'Encara no hi ha cap cançó per exportar. Crea’n una o desa la cançó actual.');
      return;
    }
    try {
      const report = builder.feedbackReport(engine, list);
      const name = `skagenerator-${onlyCommented ? 'comentaris' : 'totes'}-${new Date().toISOString().slice(0, 10)}.json`;
      download(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), name);
      notify(`Baixades ${report.totals.songs} cançons en un sol fitxer (${report.totals.comments} comentaris i ${report.totals.rated} puntuades): ${name}.`);
    } catch (error) { console.error(error); notify(`No s’han pogut exportar les cançons: ${reasonOf(error)}`); }
  }
  $('library-export').addEventListener('click', () => exportSongs(true));
  $('library-export-all').addEventListener('click', () => exportSongs(false));

  // ── Cançó automàtica ───────────────────────────────────────────────
  fillSelect($('auto-subgenre'), Object.entries(engine.SUBGENRES).map(([key, sg]) => [key, `${sg.style === 'punk' ? 'Punk' : 'Ska'} · ${sg.name}`]), 'twotone');
  function renderAutoDescription() {
    const key = $('auto-subgenre').value, sg = engine.SUBGENRES[key];
    const rated = readLibrary().filter(e => e.subgenre === key && e.rating), mean = rated.reduce((t, e) => t + e.rating, 0) / (rated.length || 1);
    $('auto-description').textContent = `${sg.description} ${sg.bpm[0]}–${sg.bpm[1]} BPM.${rated.length ? ` Les teves cançons d’aquest subgènere: ★ ${mean.toFixed(1).replace('.', ',')} de mitjana (${rated.length}).` : ''}`;
  }
  // Tonalitats de cada subgènere: les pròpies de l'estil (p. ex. bemolls per als vents a l'ska jamaicà).
  function fillAutoKeys() {
    const sg = engine.SUBGENRES[$('auto-subgenre').value], keep = $('auto-key').value;
    const entries = [['', `A l’atzar (${sg.keys.length} opcions)`], ...sg.keys.map(([t, m]) => [`${t}:${m}`, `${noteNames[t]} ${m === 'major' ? 'major' : 'menor'}`])];
    fillSelect($('auto-key'), entries, entries.some(([key]) => key === keep) ? keep : '');
  }
  fillAutoKeys();
  $('auto-subgenre').addEventListener('change', () => { fillAutoKeys(); renderAutoDescription(); });
  $('auto-minutes').addEventListener('input', event => { const m = Number(event.target.value); $('auto-minutes-value').textContent = `${Math.floor(m)}:${String(Math.round(m % 1 * 60)).padStart(2, '0')}`; });
  $('auto-create').addEventListener('click', async () => {
    if (busy) return;
    if ((song.base.generated || song.sections.length) && !song.libraryId && !await ask('Crear una cançó nova?', 'La cançó actual no és a la biblioteca: desa-la abans si la vols conservar.')) return;
    const key = $('auto-subgenre').value;
    try {
      const liked = readLibrary().filter(e => e.subgenre === key && e.rating >= 4).map(e => e.song);
      const [tonic, mode] = $('auto-key').value ? $('auto-key').value.split(':') : [];
      const project = builder.createAutoSong(engine, key, { minutes: Number($('auto-minutes').value), vocal: $('auto-vocal').checked, seed: newSeed(), liked,
        ...(mode ? { key: [Number(tonic), mode] } : {}) });
      migrated = false;
      openSong(validateSong(project), '');
      addToLibrary();
      // Recursos especials que ha triat (només els que aporten alguna cosa en aquesta cançó).
      const extras = [song.edges?.opening && song.edges.opening !== 'band' && `inici: ${builder.OPENINGS[song.edges.opening]}`,
        song.edges?.closing && song.edges.closing !== 'hit' && `final: ${builder.CLOSINGS[song.edges.closing]}`,
        song.edges?.middle && song.edges.middle !== 'none' && builder.MIDDLES[song.edges.middle],
        song.sections.some(s => s.ending === 'stop') && 'una aturada de la banda',
        ...song.clips.filter(c => c.color).map(c => `${INSTRUMENTS[c.instrument].toLowerCase()} amb so de ${engine.COLOR_FX[c.color].toLowerCase()}`)].filter(Boolean);
      notify(`«${song.title}»: ${engine.SUBGENRES[key].name}, ${noteNames[song.settings.tonic]} ${song.settings.mode === 'major' ? 'major' : 'menor'}, ${time(songSecondsOf(song))}, ${song.sections.length} seccions${extras.length ? `. Recursos: ${extras.join('; ')}` : ''}. Prem ▶ per escoltar-la i puntua-la a «Les meves cançons».`);
      if (mobile.matches) setTab('line');
    } catch (error) { console.error(error); notify(`No s’ha pogut crear la cançó: ${reasonOf(error)}`); }
  });
  $('library-sort').addEventListener('change', renderLibrary);
  $('library-save').addEventListener('click', () => { if (!song.libraryId && song.base.generated) { addToLibrary(); notify('Cançó desada a la biblioteca.'); } });

  // ── Mòbil: un pas per pantalla, amb pestanyes ──────────────────────
  const mobile = window.matchMedia('(max-width: 899px)');
  // Seccions plegables: a l'ordinador totes obertes; al mòbil només l'essencial,
  // perquè cada pestanya càpiga en poques pantalles.
  function applyFolds() {
    const open = { 'section-base-panel': false, 'fold-layers': true, 'fold-volumes': false, 'fold-song-volumes': false, 'fold-examples': false };
    for (const [id, onMobile] of Object.entries(open)) $(id).open = mobile.matches ? onMobile : true;
  }
  // Alçada real del reproductor i les pestanyes fixos: el contingut i els botons
  // d'edició de la línia es col·loquen just per sobre.
  function measureDock() {
    const height = ['.transport', '.tabbar'].reduce((total, selector) => { const el = document.querySelector(selector); return total + (el && getComputedStyle(el).display !== 'none' ? el.offsetHeight : 0); }, 0);
    document.documentElement.style.setProperty('--dock', `${height}px`);
  }
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
  ['song-style', 'song-bpm', 'song-key', 'song-bars', 'groove-drums', 'groove-bass', 'groove-guitar', 'timbre-guitar', 'timbre-bass', 'timbre-drums', 'timbre-trumpet', 'timbre-trombone', 'timbre-vocal', 'song-guitar-fx', 'song-subgenre', 'song-swing', 'song-cymbals', 'song-drum-tune', 'song-humanize', 'song-count-in']
    .forEach(key => $(key).addEventListener('change', changeSettings));
  $('song-humanize').addEventListener('input', event => { const v = Number(event.target.value); $('song-humanize-value').textContent = v ? `${v} %` : 'quantitzat'; });
  $('song-swing').addEventListener('input', event => { $('song-swing-value').textContent = `${event.target.value} %`; });
  for (const name of ['drums', 'bass']) {
    $(`base-volume-${name}`).addEventListener('input', event => {
      const db = Number(event.target.value);
      $(`base-volume-${name}-value`).textContent = `${db > 0 ? '+' : ''}${db} dB`;
    });
    $(`base-volume-${name}`).addEventListener('change', event => changeBaseVolume(name, Number(event.target.value)));
  }

  // Clic al regle, arrossegament del capçal o regulador inferior.
  $('line-ruler').addEventListener('click', event => seekToBar(barFromPointer(event)));
  const head = $('playhead'); let draggingHead = false;
  head.addEventListener('pointerdown', event => {
    if (event.button !== 0 || busy || recording || !song.base.generated) return;
    event.preventDefault(); event.stopPropagation();
    draggingHead = true; head.setPointerCapture(event.pointerId);
    showSeekPreview(barFromPointer(event));
  });
  head.addEventListener('pointermove', event => {
    if (draggingHead) { event.preventDefault(); showSeekPreview(barFromPointer(event)); }
  });
  head.addEventListener('pointerup', event => {
    if (!draggingHead) return;
    draggingHead = false; const target = barFromPointer(event); scrubBar = null; seekToBar(target);
  });
  head.addEventListener('pointercancel', () => {
    draggingHead = false; scrubBar = null; updatePlayhead(playing ? barAt(playing.startSeconds + playing.clock()) : cueBar);
  });
  head.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentBar = playing ? barAt(playing.startSeconds + playing.clock()) : cueBar;
    seekToBar(event.key === 'Home' ? 0 : event.key === 'End' ? song.settings.bars - .01
      : currentBar + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 4 : 1));
  });
  $('song-progress').addEventListener('input', event => showSeekPreview(barAt(Number(event.target.value) * songSeconds())));
  $('song-progress').addEventListener('change', event => {
    const target = scrubBar ?? barAt(Number(event.target.value) * songSeconds());
    scrubBar = null; seekToBar(target);
  });

  $('zoom-in').addEventListener('click', () => stepZoom(1));
  $('zoom-out').addEventListener('click', () => stepZoom(-1));
  $('zoom-fit').addEventListener('click', () => setZoom('fit'));
  window.addEventListener('resize', () => { applyZoom(); measureDock(); });
  mobile.addEventListener('change', applyFolds);
  if (typeof ResizeObserver === 'function') { const observer = new ResizeObserver(measureDock); for (const selector of ['.transport', '.tabbar']) observer.observe(document.querySelector(selector)); }
  applyFolds(); measureDock();
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
  function changeSectionValue(apply) {
    const sec = current(); if (!sec || busy) return;
    apply(sec); const replay = playing?.kind; stop(); save(); render();
    if (replay === 'song' || replay === 'section') play(replay);
  }
  $('section-ending').addEventListener('change', event => changeSectionValue(sec => {
    const value = event.target.value;
    if (sec.type === 'outro') { if (value === 'hit') delete sec.closing; else sec.closing = value; }
    else if (value === 'fill') delete sec.ending; else sec.ending = value;
  }));
  $('section-offbeat').addEventListener('change', event => changeSectionValue(sec => {
    if (event.target.value) sec.offbeat = true; else delete sec.offbeat;
  }));
  $('section-fade').addEventListener('change', event => changeSectionValue(sec => {
    if (event.target.value) sec.fade = event.target.value; else delete sec.fade;
  }));
  $('section-transpose').addEventListener('change', event => changeSectionValue(sec => {
    const t = Number(event.target.value); if (t) sec.transpose = t; else delete sec.transpose;
  }));

  // ── Varietat: canvis de tempo, de to i de ritme ────────────────────
  function addVariety() {
    if (busy || !song.base.generated) return;
    if (song.sections.length < 3) { notify('Marca com a mínim tres seccions a la línia per repartir-hi els canvis.'); return; }
    stop();
    const base = song.settings.bpm, secs = song.sections, done = [], used = new Set();
    const of = type => secs.filter(s => s.type === type);
    const tempo = (sec, factor, label) => {
      if (!sec || used.has(sec)) return false;
      const bpm = Math.max(40, Math.min(240, Math.round(base * factor)));
      if (bpm === base || songSecondsWith({ section: sec, sectionBpm: bpm }) > MAX_SECONDS) return false;
      sec.bpm = bpm; used.add(sec); done.push(`${sectionLabel(sec)} a ${bpm} BPM (${label})`); return true;
    };
    // Idees ordenades a l'atzar; se n'apliquen 2 o 3. Els canvis són suaus (com a molt un 8 %):
    // els salts grans de tempo sonaven bruscos.
    const ideas = [
      () => secs[0].type === 'intro' && tempo(secs[0], .92 + pick(3) * .02, 'intro una mica més lenta'),
      () => tempo(of('bridge')[0] || of('solo')[0], .92 + pick(3) * .02, 'pont més lent'),
      () => of('chorus').length > 1 && tempo(of('chorus').at(-1), 1.03 + pick(3) * .015, 'última tornada més ràpida'),
      () => tempo(of('outro').at(-1), .92 + pick(3) * .02, 'final que s’alenteix'),
      () => tempo(of('prechorus')[0], 1.03 + pick(2) * .02, 'pretornada que empeny'),
      () => tempo(of('verse')[1], .95, 'segona estrofa més tranquil·la')
    ].sort(() => random32() / 4294967296 - .5);
    const wanted = 2 + pick(2);
    for (const idea of ideas) { if (done.length >= wanted) break; idea(); }
    // Si l'estructura no té prou seccions típiques, s'alternen les del mig.
    for (const sec of secs.slice(1)) { if (done.length >= 2) break; tempo(sec, used.size % 2 ? 1.05 : .94, 'contrast'); }
    // Pont a mig temps: bateria i baix a la meitat (si no ha canviat de tempo).
    const bridge = of('bridge')[0];
    if (bridge && !used.has(bridge)) { bridge.feel = { ...(bridge.feel || {}), drums: .5 }; done.push(`${sectionLabel(bridge)} amb la bateria a mig temps`); }
    // Pujada de to a l'última tornada (i al final que la segueix).
    const choruses = of('chorus'), lastChorus = choruses.at(-1);
    if (choruses.length > 1) {
      const up = pick(3) ? 2 : 1;
      for (const sec of secs.filter(s => s.start >= lastChorus.start)) sec.transpose = up;
      done.push(`última tornada ${up === 2 ? 'un to' : 'mig to'} amunt`);
    }
    // Un altre patró de bateria en una estrofa o en el pont.
    const drums = engine.SONG_GROOVES[song.settings.style].drums.length;
    const target = of('verse')[1] || bridge || of('verse')[0];
    if (target) { target.groove = { drums: (song.settings.groove.drums + 1 + pick(drums - 1)) % drums }; done.push(`${sectionLabel(target)} amb un altre ritme de bateria`); }
    // On la cançó s'alenteix, un instrument nou sosté el so perquè no perdi força.
    for (const { section, instrument } of builder.reinforceSlowdowns(song)) done.push(`${INSTRUMENTS[instrument].toLowerCase()} a ${sectionLabel(section)} per sostenir el canvi de tempo`);
    save(); render();
    notify(`Varietat: ${done.join('; ')}.`);
  }
  function clearVariety() {
    if (busy) return;
    stop();
    for (const sec of song.sections) { delete sec.bpm; delete sec.transpose; delete sec.groove; if (sec.feel) { delete sec.feel.drums; if (!Object.keys(sec.feel).length) delete sec.feel; } }
    // També els instruments afegits per sostenir els canvis de tempo.
    song.clips = song.clips.filter(c => !c.id.startsWith('slow-'));
    save(); render(); notify('S’han tret els canvis de tempo, de to i de ritme de bateria.');
  }
  $('add-variety').addEventListener('click', addVariety);
  // ── Inici i final nous: cada clic en tria uns altres (i de vegades un silenci al mig) ──
  function designEdges() {
    if (busy || !song.base.generated) return;
    if (song.sections.length < 2) { notify('Marca com a mínim dues seccions a la línia: la primera fa d’inici i l’última de final.'); return; }
    stop();
    const revisions = {};
    for (const c of song.clips) if (c.generated && !c.edge) revisions[c.instrument] ??= c.revision;
    try {
      const result = builder.designEdges(engine, song, { seed: newSeed(), revisions });
      validateSong(song); save(); render();
      notify(`${result.text} Escolta-la; torna a prémer el botó per provar-ne uns altres.`);
    } catch (error) { console.error(error); notify(`No s’ha pogut canviar l’inici i el final: ${reasonOf(error)}`); }
  }
  $('design-edges').addEventListener('click', designEdges);
  $('clear-variety').addEventListener('click', clearVariety);
  $('section-bpm').addEventListener('change', event => {
    const sec = current(); if (!sec || busy) return;
    const raw = event.target.value.trim(), value = Number(raw);
    if (raw === '' || value === song.settings.bpm) delete sec.bpm;
    else if (!Number.isInteger(value) || value < 40 || value > 240) { notify('El tempo d’una secció pot anar de 40 a 240 BPM.'); render(); return; }
    else if (songSecondsWith({ section: sec, sectionBpm: value }) > MAX_SECONDS) { notify('Amb aquest tempo la cançó superaria els 6 minuts.'); render(); return; }
    else sec.bpm = value;
    const replay = playing?.kind; stop(); save(); render();
    notify(sec.bpm ? `${sectionLabel(sec)} a ${sec.bpm} BPM; la resta de la cançó continua a ${song.settings.bpm}.` : `${sectionLabel(sec)} torna al tempo de la cançó (${song.settings.bpm} BPM).`);
    if (replay === 'song' || replay === 'section') play(replay);
  });
  $('section-energy').addEventListener('input', event => { $('section-energy-value').textContent = `${event.target.value} %`; });
  $('section-energy').addEventListener('change', event => {
    const sec = current(); if (!sec || busy) return;
    const value = Number(event.target.value), replay = playing?.kind;
    if (value === TYPES[sec.type].energy) delete sec.energy; else sec.energy = value;
    stop(); save(); render();
    if (replay === 'song' || replay === 'section') play(replay);
  });
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
  $('section-lyrics').addEventListener('input', event => { const sec = current(); if (sec) { sec.lyrics = event.target.value; save(); renderLyricsInfo(sec); } });
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
  function openSong(imported, message) {
    stop(); song = imported; selected = song.sections[0]?.id || null; selectedClip = null; selectedBase = null; voiceData = null; cache.clear(); cachedFrames = 0;
    updateSettingsUI(); save(); render(); loadVoice(); notify(message);
  }
  // Cançons d'exemple (exemples/*.json, publicades amb la web).
  async function loadExamples() {
    try {
      const response = await fetch(new URL('exemples/index.json', document.baseURI), { cache: 'no-cache' });
      if (!response.ok) throw new Error(response.status);
      const list = $('example-list'); list.replaceChildren();
      for (const example of await response.json()) {
        const card = document.createElement('button'); card.type = 'button'; card.className = `example-card ${example.style}`;
        const head = document.createElement('span'); head.className = 'example-head';
        const tag = document.createElement('span'); tag.className = 'example-tag'; tag.textContent = example.style === 'punk' ? 'Punk' : 'Ska';
        const meta = document.createElement('small'); meta.textContent = `♩ ${example.bpm} · ${time(example.seconds)}`;
        head.append(tag, meta);
        const title = document.createElement('strong'); title.textContent = example.title;
        const text = document.createElement('span'); text.className = 'example-text'; text.textContent = example.description;
        card.append(head, title, text);
        card.addEventListener('click', () => openExample(example));
        list.append(card);
      }
    } catch (error) { console.warn('No s’han pogut carregar els exemples', error); $('example-list').closest('.examples').hidden = true; }
  }
  async function openExample(example) {
    if (busy) return;
    if ((song.base.generated || song.sections.length) && !await ask(`Obrir «${example.title}»?`, 'L’exemple reemplaçarà l’esborrany actual. Desa primer el projecte si el vols conservar.')) return;
    try {
      const response = await fetch(new URL(`exemples/${example.file}`, document.baseURI), { cache: 'no-cache' });
      if (!response.ok) throw new Error(response.status);
      migrated = false;
      openSong(validateSong(await response.json()), `«${example.title}» oberta. Prem ▶ per escoltar-la; la primera vegada es preparen els instruments.`);
      if (mobile.matches) setTab('line');
    } catch (error) { console.error(error); notify('No s’ha pogut obrir aquest exemple.'); }
  }
  $('import-project').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 300000) throw new Error('Fitxer massa gran');
      migrated = false;
      const imported = validateSong(JSON.parse(await file.text()));
      if (!await ask('Obrir aquest projecte?', 'El projecte importat reemplaçarà l’esborrany actual.')) return;
      openSong(imported, migrated ? 'Projecte antic convertit: cada part és ara una secció de la línia.' : 'Projecte obert.');
    } catch { notify('Aquest fitxer no és un projecte vàlid de Ska Generator.'); }
  });
  $('record-song').addEventListener('click', () => startRecording(0));
  $('record-section').addEventListener('click', () => { const sec = current(); if (sec) startRecording(sec.start); });
  $('record-stop').addEventListener('click', () => { stop(); render(); });
  $('play-voice').addEventListener('click', () => play('song'));
  $('delete-voice').addEventListener('click', deleteVoice);
  $('download-voice').addEventListener('click', () => {
    if (!voiceData) return;
    const gain = 10 ** ((song.voice?.volume || 0) / 20), data = filteredVoice();
    const mono = Float32Array.from(data, x => {
      const value = x * gain, a = Math.abs(value);
      return a > .93 ? Math.sign(value) * (.93 + .055 * Math.tanh((a - .93) / .055)) : value;
    });
    download(new Blob([audioUtils.encodeWav([mono, mono], RATE)], { type: 'audio/wav' }), `${fileName()}-veu.wav`);
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
  function updateVoiceProcessing(change) {
    if (!song.voice || busy) return;
    const replay = playing?.kind, position = playing ? barAt(playing.startSeconds + playing.clock()) : 0;
    stop();
    change(song.voice); save(); render();
    if (replay === 'song' || replay === 'section') { cueBar = position; play(replay); }
  }
  $('voice-effect').addEventListener('change', event =>
    updateVoiceProcessing(voice => { voice.effect = event.target.value; }));
  for (const key of VOICE_EQ_KEYS) {
    const input = $(`voice-eq-${key}`);
    input.addEventListener('input', event => {
      const db = Number(event.target.value);
      $(`voice-eq-${key}-value`).textContent = `${db > 0 ? '+' : ''}${db} dB`;
    });
    input.addEventListener('change', event =>
      updateVoiceProcessing(voice => { voice.eq = { ...flatVoiceEq(), ...(voice.eq || {}), [key]: Number(event.target.value) }; }));
  }
  $('voice-eq-reset').addEventListener('click', () => updateVoiceProcessing(voice => { voice.eq = flatVoiceEq(); }));
  window.addEventListener('pagehide', stop);
  let firstTab = song.base.generated ? (song.sections.length ? 'line' : 'line') : 'song';
  try { firstTab = sessionStorage.getItem('skagenerator.tab') || firstTab; } catch {}
  setTab(firstTab, false);
  updateSettingsUI(); render(); loadVoice(); loadExamples(); renderLibrary(); renderAutoDescription();
  if (migrated && storageAvailable) { save(); notify('Projecte anterior convertit al nou flux: cada part és ara una secció de la línia.'); }
  if (!storageAvailable) notify('No s’ha pogut recuperar l’esborrany. Obre un projecte desat o comença una cançó nova.');
})();
