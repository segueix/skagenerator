(() => {
  'use strict';
  // Radio Spam: tries Ska o Punk i la ràdio compon una cançó rere l'altra.
  // Mentre en sona una, la següent es compon i es grava en segon pla; comença
  // dos segons després que acabi l'anterior. Cada cançó es pot votar i comentar,
  // i l'historial es pot exportar.
  const studio = window.SkaStudio, engine = window.ElTaulerRadioAmbient, builder = window.SkaSongBuilder,
    audioUtils = window.SkaAudioUtils, sampleAudio = window.SkaSampleAudio;
  const $ = id => document.getElementById(id), root = document.documentElement;
  const browserSinger = window.SkaUmidaji?.createSinger({ audioUtils });
  let generationController = null;
  // Cançó que Umidaji està cantant a part: mentrestant la cua s'omple amb cançons de guia i no hi ha silencis.
  let parked = null, historyVoice = null, historyPlayback = null;
  // Veus ja cantades i desades al dispositiu (per identificador de cançó). Les cançons amb 👍 que en tenen
  // formen el repertori: quan n'hi ha prou, omplen la cua en lloc de les cançons noves sense veu.
  const REPERTOIRE_MIN = 8, TAKES_UNVOTED = 12, TAKES_LIKED = 60;
  let savedTakes = new Set();
  const takesReady = browserSinger?.takes.list().then(ids => { savedTakes = new Set(ids); }).catch(() => {});
  // Quantes cançons amb 👍 i veu desada hi ha (de totes les emissores).
  const likedSung = () => readHistory().filter(e => e.vote === 1 && savedTakes.has(e.id)).length;
  function pruneTakes(fresh) {
    const history = readHistory(), known = new Map(history.map(e => [e.id, e])), drop = [];
    // Les que encara no han sonat (acabades de cantar o a la cua) no són a l'historial: no es toquen.
    const pending = new Set([fresh, current?.id, ...queue.map(t => t.id)]);
    const age = id => Math.max(known.get(id).voiceCreated || 0, known.get(id).lastPlayed || known.get(id).created || 0);
    const keepLonger = id => known.get(id).vote === 1 || !!known.get(id).voiceCreated;
    const ids = [...savedTakes].filter(id => !pending.has(id));
    for (const id of ids) if (!known.has(id) || (known.get(id).vote === -1 && !known.get(id).voiceCreated)) drop.push(id);
    const keep = ids.filter(id => !drop.includes(id));
    for (const [list, max] of [[keep.filter(id => !keepLonger(id)), TAKES_UNVOTED], [keep.filter(keepLonger), TAKES_LIKED]])
      drop.push(...list.sort((a, b) => age(b) - age(a)).slice(max));
    for (const id of drop) { savedTakes.delete(id); browserSinger?.takes.remove(id).catch(() => {}); }
    showRepertoire();
  }
  if (!studio || !engine || !builder || !audioUtils || !sampleAudio || !$('radio')) return;

  const RATE = studio.RATE, GAP_SECONDS = 2, TAIL_SECONDS = 1.5;
  const HISTORY_KEY = 'radiospam.history', VIEW_KEY = 'radiospam.view', HISTORY_MAX = 300;
  // De tant en tant torna a sonar una cançó amb 👍 de la mateixa emissora.
  const REPLAY_CHANCE = .3, REPLAY_EVERY = 3, REPLAY_MEMORY = 5;
  // «mix»: emissora Ska-Punk, que barreja cançons de totes dues.
  const STATIONS = { ska: 'Ska', punk: 'Punk', mix: 'Ska-Punk' };
  const inStation = style => station === 'mix' ? style === 'ska' || style === 'punk' : style === station;
  const NOTES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const CANCELLED = Symbol('cancel·lat');
  const audio = $('radio-audio');
  const desktop = window.matchMedia('(min-width: 900px)');

  const clock = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  const reasonOf = error => String(error?.message || error || 'Error desconegut').slice(0, 200);
  const pickOne = list => list[Math.floor(Math.random() * list.length)];
  const subgenreName = key => engine.SUBGENRES[key]?.name || STATIONS[key] || key || '';
  const keyName = s => `${NOTES[s.settings.tonic]} ${s.settings.mode === 'major' ? 'major' : 'menor'}`;
  // Deixa pintar la pantalla abans d'una feina llarga (i no s'encalla amb la pestanya amagada).
  const breathe = () => document.visibilityState === 'visible' ? new Promise(resolve => setTimeout(resolve, 0)) : Promise.resolve();

  let toastTimer;
  function toast(message) {
    const element = $('radio-toast'); element.textContent = message; element.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 4500);
  }

  // ── Historial ───────────────────────────────────────────────────────
  let memoryHistory = null; // Si el navegador no deixa desar, l'historial viu mentre duri la sessió.
  function readHistory() {
    if (memoryHistory) return memoryHistory;
    try { const list = JSON.parse(localStorage.getItem(HISTORY_KEY)); return Array.isArray(list) ? list.filter(e => e && typeof e.id === 'string' && e.song) : []; }
    catch { return []; }
  }
  function writeHistory(list) {
    // Si no hi cap tot, cauen primer les més antigues sense vot ni comentari.
    while (list.length > HISTORY_MAX) {
      let drop = -1;
      for (let i = list.length - 1; i >= 0; i--) if (!list[i].vote && !list[i].comment) { drop = i; break; }
      list.splice(drop < 0 ? list.length - 1 : drop, 1);
    }
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); memoryHistory = null; }
    catch {
      if (!memoryHistory) toast('El navegador no deixa desar l’historial: exporta’l abans de tancar la pàgina.');
      memoryHistory = list;
    }
    $('radio-history-count').textContent = list.length || '';
  }
  function updateEntry(id, change) {
    const list = readHistory(), entry = list.find(e => e.id === id);
    if (!entry) return null;
    change(entry); writeHistory(list); return entry;
  }

  // ── Tria de la cançó següent ─────────────────────────────────────────
  // Sempre hi ha dues cançons a punt per endavant: amb la pantalla apagada el mòbil va més lent
  // i així la ràdio té marge per no quedar-se sense música.
  const AHEAD = 2;
  let station = null, session = 0, current = null, queue = [], waiting = false, filling = false, failures = 0, retryTimer = null, releaseLock = null;
  let sinceReplay = REPLAY_EVERY, lastSubgenre = null, played = [], prep = null, userPaused = false, needsTap = false;

  // ── Cançons cantades ──────────────────────────────────────────────────
  // Per defecte la ràdio crea una cançó nova i la fa cantar al navegador.
  // Els enregistraments preproduïts continuen disponibles per a les preferides.
  // El banc Umidaji importat al dispositiu canta la partitura en un worker.
  let sungCatalog = null, sungLoading = null;
  const bankStatus = $('radio-umidaji-status'), bankInput = $('radio-umidaji-file'), bankLoad = $('radio-umidaji-load'), bankBar = $('radio-umidaji-bar');
  // Barra de càrrega: la lectura del ZIP és el 60 %, la preparació dels models el 35 % i desar-lo el 5 %.
  const PHASES = { read: [0, .6, 'Llegint el fitxer'], models: [.6, .35, 'Preparant els models de veu'], store: [.95, .05, 'Desant-lo al dispositiu'] };
  function showLoad(value, phase) {
    const [from, span, label] = PHASES[phase] || PHASES.read, total = Math.max(0, Math.min(1, from + span * (value || 0)));
    bankLoad.hidden = false; bankLoad.classList.remove('done', 'failed');
    bankBar.style.width = `${Math.round(total * 100)}%`;
    bankBar.parentElement.setAttribute('aria-valuenow', String(Math.round(total * 100)));
    bankStatus.className = 'radio-foot radio-bank-status';
    bankStatus.textContent = `${label}… ${Math.round(total * 100)} %`;
  }
  function endLoad(ok, message) {
    bankLoad.hidden = false; bankLoad.classList.toggle('done', ok); bankLoad.classList.toggle('failed', !ok);
    if (ok) bankBar.style.width = '100%';
    bankStatus.className = `radio-foot radio-bank-status ${ok ? 'ok' : 'error'}`;
    bankStatus.textContent = message;
  }
  // Amb el ZIP ja desat, els models es preparen sols quan cal la primera veu: també es veu el progrés.
  let autoLoad = false;
  browserSinger?.onLoad((value, phase) => {
    if (bankImport) return;
    autoLoad = true; showLoad(value, phase);
    if (phase === 'models' && value >= 1) { autoLoad = false; endLoad(true, '✓ Umidaji carregat.'); setTimeout(showRepertoire, 2500); }
  });
  let bankImport = null;
  let bankReady = false;
  function showRepertoire() {
    if (!bankReady || bankImport) return;
    if (autoLoad) return;
    const n = likedSung();
    bankStatus.className = 'radio-foot radio-bank-status ok';
    bankStatus.textContent = `✓ Umidaji a punt. Repertori cantat que t’agrada: ${n} ${n === 1 ? 'cançó' : 'cançons'}.`;
  }
  const restoringBank = browserSinger?.restore().then(found => { bankReady = !!found; return takesReady; }).then(showRepertoire).catch(() => {});
  bankInput.addEventListener('change', async () => {
    const file = bankInput.files[0];
    if (!file || !browserSinger) return;
    bankInput.disabled = true;
    showLoad(0, 'read');
    try {
      bankImport = browserSinger.install(file, showLoad);
      const stored = await bankImport;
      bankReady = true;
      endLoad(true, stored ? '✓ Umidaji carregat correctament. Ja pot cantar.' : '✓ Umidaji carregat per a aquesta sessió (el navegador no l’ha pogut desar: caldrà tornar-lo a carregar).');
    } catch (error) {
      endLoad(false, '✗ No s’ha pogut carregar Umidaji. ' + reasonOf(error));
    } finally {
      bankImport = null;
      bankInput.disabled = false;
      bankInput.value = '';
    }
  });
  function loadSung() {
    sungLoading ||= fetch(new URL('cantades/catalog.json', document.baseURI), { cache: 'no-cache' })
      .then(response => response.ok ? response.json() : { songs: [] })
      .then(data => {
        const all = Array.isArray(data?.songs) ? data.songs.filter(s => s && s.id && s.file && s.song) : [];
        // El catàleg pot conservar cançons antigues de DiffSinger: no es confonen
        // amb les noves cançons cantades en català per Matxa.
        sungCatalog = all.filter(s => s.voiceEngine === 'matxa' && s.language === 'ca');
      })
      .catch(() => { sungCatalog = []; });
    return sungLoading;
  }
  const sungById = id => sungCatalog?.find(s => s.id === id);
  function historyChoice(entry) {
    const sung = sungById(entry.id);
    return { id: entry.id, replay: true, take: savedTakes.has(entry.id), sung,
      song: studio.validateSong(JSON.parse(JSON.stringify(entry.song))) };
  }
  // filler: cal una cançó per omplir la cua mentre Umidaji en canta una altra (o no hi ha banc de veu).
  function chooseSong(filler = false) {
    const history = readHistory(), queued = [current?.id, ...queue.map(t => t.id), ...played.slice(-REPLAY_MEMORY)];
    // Amb prou repertori cantat, la cua s'omple amb cançons que t'han agradat i ja tenen veu.
    const repertoire = history.filter(e => inStation(e.style) && e.vote === 1 && savedTakes.has(e.id));
    const rested = repertoire.filter(e => !queued.includes(e.id));
    if (filler && repertoire.length >= REPERTOIRE_MIN && rested.length) {
      rested.sort((a, b) => (a.lastPlayed || 0) - (b.lastPlayed || 0));
      const entry = pickOne(rested.slice(0, Math.max(1, Math.ceil(rested.length / 2))));
      try { return historyChoice(entry); }
      catch (error) { console.warn('Cançó de l’historial no vàlida', error); }
    }
    const liked = history.filter(e => inStation(e.style) && e.vote === 1 && !queued.includes(e.id));
    if (liked.length && sinceReplay >= REPLAY_EVERY && !queue.some(t => t.replay) && Math.random() < REPLAY_CHANCE) {
      // Entre les preferides, les que fa més que no sonen.
      liked.sort((a, b) => (a.lastPlayed || 0) - (b.lastPlayed || 0));
      const entry = pickOne(liked.slice(0, Math.max(1, Math.ceil(liked.length / 2))));
      try { return historyChoice(entry); }
      catch (error) { console.warn('Cançó de l’historial no vàlida', error); }
    }
    // Cançó nova: subgènere a l'atzar (diferent de l'anterior) i estructura que s'allunya de les últimes.
    // A l'emissora Ska-Punk els dos estils s'alternen (tres de cada quatre vegades canvia d'estil).
    const lastStyle = engine.SUBGENRES[lastSubgenre]?.style;
    const style = station !== 'mix' ? station : !lastStyle ? pickOne(['ska', 'punk']) : Math.random() < .75 ? (lastStyle === 'ska' ? 'punk' : 'ska') : lastStyle;
    const keys = Object.keys(engine.SUBGENRES).filter(key => engine.SUBGENRES[key].style === style);
    const fresh = keys.filter(key => key !== lastSubgenre), subgenre = pickOne(fresh.length ? fresh : keys);
    // Les que ja esperen torn també compten com a recents.
    const waitingSongs = queue.map(t => ({ subgenre: t.song.settings.subgenre, style: t.song.settings.style, song: t.song })).reverse();
    const recent = [...waitingSongs, ...history.filter(e => Array.isArray(e.song?.sections)).sort((a, b) => (b.lastPlayed || b.created) - (a.lastPlayed || a.created))].slice(0, 12)
      .map(e => ({ subgenre: e.subgenre, style: e.style, plan: [...e.song.sections].sort((a, b) => a.start - b.start).map(s => [s.type, s.bars]) }));
    // Cada cançó nova porta lletra en català; la melodia de veu la segueix.
    const options = { minutes: 2 + Math.floor(Math.random() * 7) * .25, vocal: true, autoLyrics: 'ca', seed: studio.newSeed(), vary: true, recent,
      // Títols de les últimes 150 cançons (i de les que esperen a la cua): no es repeteixen.
      avoidTitles: [...queue.map(t => t.song.title), ...history.slice(0, 150).map(e => e.title)].filter(Boolean),
      liked: history.filter(e => e.subgenre === subgenre && e.vote === 1).map(e => e.song) };
    // Punk: sobretot una guitarra, sovint dues i només excepcionalment tres.
    if (style === 'punk') { const dice = Math.random(); options.guitars = dice < .5 ? 1 : dice < .92 ? 2 : 3; }
    const song = studio.validateSong(builder.createAutoSong(engine, subgenre, options));
    lastSubgenre = subgenre;
    return { id: studio.uid(), replay: false, song };
  }

  // ── Gravació d'una cançó sencera ─────────────────────────────────────
  // WAV de 16 bits amb dos segons de silenci al final: així la pausa entre
  // cançons també funciona amb la pantalla apagada.
  async function wavBlob(channels, gapSeconds) {
    const frames = channels[0].length, total = frames + Math.round(gapSeconds * RATE);
    if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) { // Processador big-endian: codificador genèric.
      const padded = channels.map(c => { const out = new Float32Array(total); out.set(c); return out; });
      return new Blob([audioUtils.encodeWav(padded, RATE)], { type: 'audio/wav' });
    }
    const header = new DataView(new ArrayBuffer(44)), bytes = total * 4;
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) header.setUint8(offset + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF'); header.setUint32(4, 36 + bytes, true); ascii(8, 'WAVE'); ascii(12, 'fmt '); header.setUint32(16, 16, true);
    header.setUint16(20, 1, true); header.setUint16(22, 2, true); header.setUint32(24, RATE, true); header.setUint32(28, RATE * 4, true);
    header.setUint16(32, 4, true); header.setUint16(34, 16, true); ascii(36, 'data'); header.setUint32(40, bytes, true);
    const pcm = new Int16Array(total * 2), left = channels[0], right = channels[1], CHUNK = 500000;
    for (let from = 0; from < frames; from += CHUNK) {
      const to = Math.min(frames, from + CHUNK);
      for (let i = from; i < to; i++) {
        const l = left[i] < -1 ? -1 : left[i] > 1 ? 1 : left[i], r = right[i] < -1 ? -1 : right[i] > 1 ? 1 : right[i];
        pcm[i * 2] = l * (l < 0 ? 32768 : 32767); pcm[i * 2 + 1] = r * (r < 0 ? 32768 : 32767);
      }
      await breathe();
    }
    return new Blob([header.buffer, pcm.buffer], { type: 'audio/wav' });
  }
  async function downloadTrack(choice, signal) {
    const { song, sung } = choice;
    const response = await fetch(new URL(`cantades/${sung.file}`, document.baseURI), { signal });
    if (!response.ok) throw new Error(`No s’ha pogut baixar la cançó cantada (error ${response.status})`);
    const blob = await response.blob();
    const lines = Array.isArray(sung.lines) ? sung.lines.filter(l => l && Number.isFinite(l.at) && typeof l.text === 'string') : [];
    let at = 0;
    const timeline = studio.segmentsOf(song).map(seg => {
      const bpm = seg.section?.bpm ?? song.settings.bpm, length = seg.bars * 240 / bpm;
      const mark = { at, name: seg.section ? engine.SONG_PARTS[seg.section.type].name : 'Base', bpm, lines: lines.filter(l => l.at >= at && l.at < at + length) };
      at += length;
      return mark;
    });
    return { ...choice, sung: true, voiceTimbre: sung.voiceTimbre, seconds: Number(sung.seconds) || at, timeline, url: URL.createObjectURL(blob) };
  }

  function renderPlan(song) {
    let at = 0;
    return studio.segmentsOf(song).map(seg => {
      const spec = engine.composeSongPart(song.settings, studio.partFor(song, seg)), bpm = seg.section?.bpm ?? song.settings.bpm;
      const frames = Math.round(seg.bars * 240 / bpm * RATE), lyrics = seg.section?.lyrics?.trim();
      const vocal = !!lyrics && spec.instruments.includes('vocal') && !!spec.lines?.vocal?.length;
      const item = { seg, spec, bpm, frames, lyrics, vocal, at };
      at += frames / RATE;
      return item;
    });
  }

  function scoreNotes(song, plan) {
    return window.SkaBrowserSinging.scoreNotes(plan.filter(p => p.vocal).map(p => ({
      at: p.at, bpm: p.bpm, text: p.lyrics, melody: p.spec.lines.vocal, type: p.seg.section.type
    })), engine.lyricWords, song.settings.swing || 0);
  }

  async function loadTake(choice, plan) {
    if (!choice.take || !plan.some(p => p.vocal)) return null;
    const stored = await browserSinger.takes.load(choice.id).catch(() => null);
    if (!stored) savedTakes.delete(choice.id);
    return stored;
  }

  async function renderBand(song, plan, withVoice, active, progress) {
    const bars = plan.reduce((n, { seg }) => n + seg.bars, 0), parts = [], lengths = [], timeline = [];
    let done = 0;
    for (const { seg, spec, bpm, frames, vocal, at } of plan) {
      if (!active()) throw CANCELLED;
      const renderSpec = withVoice && vocal ? { ...spec, instruments: spec.instruments.filter(name => name !== 'vocal'), lines: { ...spec.lines, vocal: [] } } : spec;
      let data;
      if (renderSpec.instruments.length) {
        data = await sampleAudio.render(renderSpec, RATE, { onProgress: update => {
          if (!active()) return;
          if (update.stage === 'loading') progress('bank', update.value);
          else progress('render', (done + seg.bars * (update.stage === 'rendering' ? update.value || 0 : 0)) / bars);
        } });
      } else {
        const empty = Math.round((spec.seconds + TAIL_SECONDS) * RATE);
        data = [new Float32Array(empty), new Float32Array(empty)];
      }
      if (!active()) throw CANCELLED;
      if (seg.section?.fade) data = audioUtils.applyFade(data, Math.min(frames, data[0].length), seg.section.fade);
      parts.push(data); lengths.push(Math.min(frames, data[0].length));
      timeline.push({ at, name: seg.section ? engine.SONG_PARTS[seg.section.type].name : 'Base', bpm, lines: lyricLines(song, seg, spec, at) });
      done += seg.bars;
      progress('render', done / bars);
    }
    progress('mix', 1);
    await breathe();
    if (!active()) throw CANCELLED;
    return { band: audioUtils.mixSections(parts, lengths), timeline };
  }

  async function renderTrack(choice, { band, timeline }, pcm) {
    const subgenre = choice.song.settings.subgenre;
    const mixed = pcm ? browserSinger.mix(pcm, band, subgenre) : band;
    const seconds = mixed[0].length / RATE, blob = await wavBlob(mixed, GAP_SECONDS);
    return { ...choice, sung: !!pcm, voiceTimbre: pcm ? browserSinger.timbreName(subgenre) : null, seconds, timeline, url: URL.createObjectURL(blob) };
  }

  async function prepare(mine) {
    setPrep({ stage: 'compose', value: 0 });
    await breathe();
    await restoringBank;
    await takesReady;
    await bankImport?.catch(() => {});
    if (sungCatalog === null) await loadSung();
    const active = () => mine === session;
    if (!active()) throw CANCELLED;
    const controller = new AbortController();
    generationController = controller;
    const choice = chooseSong(!canSing()), song = choice.song;
    const progress = (stage, value) => setPrep({ stage, value, title: song.title });
    if (choice.sung) {
      progress('download', 0);
      return downloadTrack(choice, controller.signal);
    }
    const plan = renderPlan(song), stored = await loadTake(choice, plan);
    if (!active()) throw CANCELLED;
    // Umidaji canta a part: la ràdio continua preparant la cua mentrestant.
    const voiceController = new AbortController();
    let job = null, finishVoice;
    if (!stored && canSing() && song.settings.lang === 'ca') {
      const notes = scoreNotes(song, plan);
      if (notes.length) {
        job = browserSinger.start({
          notes, subgenre: song.settings.subgenre, signal: voiceController.signal,
          onProgress: value => { if (parked?.controller === voiceController) { parked.progress = value; renderPrep(); } }
        });
        const finished = new Promise(resolve => { finishVoice = resolve; });
        parked = { controller: voiceController, title: song.title, progress: 0, finished };
      }
    }
    try {
      const rendered = await renderBand(song, plan, !!(job || stored), active, progress);
      if (!job) return renderTrack(choice, rendered, stored);
      // Quan Umidaji acabi, la cançó passa al davant de la cua.
      // Mentrestant la ràdio continua preparant-ne d'altres.
      (async () => {
        try {
          const pcm = await job.result;
          // La veu es desa: si la cançó agrada, tornarà a sonar cantada sense haver-la de cantar de nou.
          await browserSinger.takes.save(choice.id, pcm).then(() => { savedTakes.add(choice.id); pruneTakes(choice.id); }).catch(error => console.warn('No s’ha pogut desar la veu:', error));
          if (mine !== session) return;
          const track = await renderTrack(choice, rendered, pcm);
          if (!active()) { URL.revokeObjectURL(track.url); return; }
          queue.unshift(track);
        } catch (error) {
          if (mine !== session || voiceController.signal.aborted) return;
          console.warn('Umidaji no ha pogut cantar «' + song.title + '»:', error);
          toast('Umidaji no ha pogut cantar una cançó. La ràdio continua amb la melodia de guia.');
        } finally {
          if (parked?.controller === voiceController) parked = null;
          finishVoice();
          if (mine === session && station) { if (queue.length && waiting) advance(); else renderPrep(); fill(session); }
        }
      })();
      return null;
    } catch (error) {
      // Si la banda no s'ha pogut fer, la veu que s'estava cantant ja no serveix.
      if (parked?.controller === voiceController) { parked = null; voiceController.abort(); }
      finishVoice?.();
      throw error;
    }
  }
  // Es pot posar una cançó a cantar: hi ha el banc de veu i Umidaji no en canta cap altra.
  const canSing = () => !!browserSinger?.available && !parked && !historyVoice;
  // Moment en què comença cada vers: la primera nota de la melodia de veu que el canta
  // (cada síl·laba és una nota, en ordre).
  function lyricLines(song, seg, spec, at) {
    const text = seg.section?.lyrics?.trim(), notes = spec.lines?.vocal;
    if (!text || !Array.isArray(notes) || !notes.length) return [];
    const info = engine.analyzeLyrics(text, song.settings.lang), lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const beat = 60 / (seg.section?.bpm ?? song.settings.bpm), sorted = [...notes].sort((a, b) => a[0] * 4 + a[1] - (b[0] * 4 + b[1]));
    const out = []; let index = 0;
    info.syllables.forEach((count, k) => {
      const first = sorted[index];
      if (first && lines[k]) out.push({ at: at + (first[0] * 4 + first[1]) * beat, text: lines[k] });
      index += count;
    });
    return out;
  }
  // Manté sempre cançons a punt. Si una falla, en prova una altra; si falla tres vegades, ho torna
  // a provar sol al cap d'una estona (amb la pantalla apagada ningú pot prémer «Torna-ho a provar»).
  async function fill(mine) {
    if (filling) return;
    filling = true;
    let fatal = null;
    try {
      clearTimeout(retryTimer);
      // A més de les cançons de la cua, sempre n'hi ha una cantant-se si hi ha veu (i la cua no és plena de més).
      while (mine === session && station && (queue.length < AHEAD || canSing() && queue.length <= AHEAD)) {
        try {
          const track = await prepare(mine);
          if (!track) continue;   // s'està cantant a part: arribarà a la cua quan estigui
          if (mine !== session) { URL.revokeObjectURL(track.url); break; }
          queue.push(track); failures = 0;
          if (waiting) advance(); else renderPrep();
        } catch (error) {
          if (error === CANCELLED || mine !== session) break;
          console.error(error);
          if (++failures >= 3) { fatal = error; break; }
        }
      }
    } finally { filling = false; }
    if (mine !== session) { if (station) fill(session); return; }
    setPrep(fatal ? { stage: 'error', message: reasonOf(fatal) } : null);
    if (fatal) retryTimer = setTimeout(() => { if (mine === session && station) { failures = 0; fill(session); } }, 30000);
    if (queue.length && waiting) advance();
  }

  // ── Reproducció ──────────────────────────────────────────────────────
  // Un sol element <audio>: es desbloqueja amb el toc de triar emissora i
  // després pot canviar de cançó tot sol, també amb el mòbil bloquejat.
  let silenceUrl = null, onTrack = false;
  function playSilence() {
    // No és silenci del tot: un fons greu a −60 dB, que no se sent però fa que el mòbil consideri
    // que la pàgina està sonant i no l'adormi mentre es prepara la cançó.
    if (!silenceUrl) {
      const hum = new Float32Array(RATE * 2); let low = 0;
      for (let i = 0; i < hum.length; i++) { low += (Math.random() * 2 - 1 - low) * .02; hum[i] = low * .012 * Math.min(1, i / 2000, (hum.length - i) / 2000); }
      silenceUrl = URL.createObjectURL(new Blob([audioUtils.encodeWav([hum, hum], RATE)], { type: 'audio/wav' }));
    }
    onTrack = false; audio.loop = true; audio.src = silenceUrl;
    return audio.play().catch(() => {});
  }
  function advance() {
    if (!station) return;
    if (!queue.length) {
      // La següent encara no és a punt: silenci fins que arribi.
      waiting = true; if (current) { URL.revokeObjectURL(current.url); current = null; }
      playSilence(); renderPlayer(); fill(session); return;
    }
    playTrack(queue.shift());
  }
  function playTrack(track) {
    waiting = false;
    if (current && current !== track) URL.revokeObjectURL(current.url);
    current = track;
    const now = Date.now(), list = readHistory(), old = list.find(e => e.id === current.id);
    if (old) {
      old.plays = (old.plays || 1) + 1; old.lastPlayed = now;
      if (current.sung) old.sung = true;
    }
    else list.unshift({ id: current.id, title: current.song.title, style: current.song.settings.style, subgenre: current.song.settings.subgenre || '',
      seconds: Math.floor(current.seconds), created: now, lastPlayed: now, plays: 1, vote: 0, comment: '', ...(current.sung ? { sung: true } : {}), song: current.song });
    writeHistory(list);
    if (station) { played.push(current.id); sinceReplay = current.replay ? 0 : sinceReplay + 1; }
    onTrack = true; userPaused = false; needsTap = false; audio.loop = false; audio.src = current.url; audio.currentTime = 0;
    audio.play().catch(() => { if (onTrack && audio.paused) { needsTap = true; renderPlayer(); } });
    mediaMetadata(); renderPlayer(); renderHistory();
    fill(session);
  }
  function chooseStation(style) {
    if (!STATIONS[style]) return;
    cancelHistoryPlayback();
    studio.stop();
    generationController?.abort();
    parked?.controller.abort(); parked = null;
    session++; station = style; waiting = true; failures = 0; played = []; sinceReplay = REPLAY_EVERY; lastSubgenre = null;
    dropTracks();
    // Mentre la ràdio està engegada, el navegador no ha de congelar la pàgina en segon pla.
    if (navigator.locks?.request && !releaseLock) navigator.locks.request('radiospam-on-air', () => new Promise(resolve => { releaseLock = resolve; })).catch(() => {});
    playSilence(); // dins del toc: desbloqueja el so per a tota la sessió
    setPrep({ stage: 'compose', value: 0 });
    showScreen('player'); renderPlayer(); fill(session);
  }
  function dropTracks() {
    for (const track of [current, ...queue]) if (track) URL.revokeObjectURL(track.url);
    current = null; queue = []; prep = null;
  }
  function leaveStation() {
    generationController?.abort();
    parked?.controller.abort(); parked = null;
    cancelHistoryPlayback();
    if (!historyVoice && !bankImport) browserSinger?.dispose();
    session++; station = null; waiting = false; onTrack = false;
    clearTimeout(retryTimer); releaseLock?.(); releaseLock = null;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    dropTracks(); showScreen('home');
    if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = null; } catch {} }
  }
  function togglePlay() {
    if (!current || !onTrack) return;
    if (audio.paused) { userPaused = false; needsTap = false; audio.play().catch(error => toast(`No s’ha pogut reproduir: ${reasonOf(error)}`)); }
    else { userPaused = true; audio.pause(); }
  }
  function skip() { if (queue.length) advance(); }
  audio.addEventListener('ended', () => { if (onTrack && station) advance(); else renderPlayer(); });
  audio.addEventListener('error', () => {
    if (!onTrack) return;
    console.error(audio.error); toast('Aquesta cançó no s’ha pogut reproduir.');
    onTrack = false;
    if (station) advance(); else renderPlayer();
  });
  for (const type of ['play', 'pause', 'playing']) audio.addEventListener(type, () => renderPlayer());
  audio.addEventListener('timeupdate', renderProgress);

  function mediaMetadata() {
    if (!('mediaSession' in navigator) || !current) return;
    try {
      if (window.MediaMetadata) navigator.mediaSession.metadata = new window.MediaMetadata({ title: current.song.title, artist: `Radio Spam · ${subgenreName(current.song.settings.subgenre)}`, album: station ? `Emissora ${STATIONS[station]}` : 'Historial' });
    } catch {}
  }
  if ('mediaSession' in navigator) {
    const handlers = { play: () => { if (audio.paused) togglePlay(); }, pause: () => { if (!audio.paused) togglePlay(); }, nexttrack: skip };
    for (const [action, handler] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(action, handler); } catch {} }
  }

  // ── Pantalles ────────────────────────────────────────────────────────
  let historyOpen = false, filter = 'all';
  function showScreen(name) {
    $('radio-home').hidden = name !== 'home'; $('radio-player').hidden = name !== 'player';
    $('radio-back').hidden = name !== 'player';
    $('radio-back').setAttribute('aria-label', station ? 'Canvia d’emissora' : 'Torna a les emissores');
    $('radio').dataset.station = name === 'player' ? station || current?.song.settings.style || '' : '';
  }
  function setPrep(value) { prep = value; renderPrep(); }
  function prepText() {
    if (!prep) return ['', null];
    if (prep.stage === 'error') return [`No s’ha pogut preparar la cançó: ${prep.message}`, null];
    if (prep.stage === 'bank') return [`Baixant els instruments${prep.value === null ? '…' : ` · ${Math.round(prep.value * 100)} %`}`, prep.value];
    if (prep.stage === 'compose') return ['Component una cançó nova…', 0];
    if (prep.stage === 'download') return ['Baixant una cançó cantada…', null];
    if (prep.stage === 'voice') return [`Umidaji canta la lletra${prep.value === null ? '…' : ' · ' + Math.round(prep.value * 100) + ' %'}`, prep.value];
    if (prep.stage === 'mix') return ['Fent la mescla final…', 1];
    return [`Gravant la banda · ${Math.round(prep.value * 100)} %`, prep.value];
  }
  function renderPrep() {
    const [text, value] = prepText(), failed = prep?.stage === 'error';
    // Sense cançó sonant, el progrés ocupa l'escenari; si en sona una, va a la línia de «A continuació».
    $('radio-loading-detail').textContent = waiting ? text : '';
    $('radio-loading-bar').style.width = `${Math.round((value ?? 0) * 100)}%`;
    $('radio-loading-bar').parentElement.classList.toggle('unknown', value === null && !failed);
    $('radio-loading-title').textContent = failed ? 'La banda s’ha encallat' : current || played.length ? 'Preparant la cançó següent…' : 'Afinant la banda…';
    $('radio-retry').hidden = !failed;
    const next = $('radio-next');
    const upcoming = queue[0];
    if (upcoming) next.textContent = `A continuació: «${upcoming.song.title}» · ${subgenreName(upcoming.song.settings.subgenre)}${upcoming.replay ? ' · 👍' : ''}${queue.length > 1 ? ` · i ${queue.length - 1} més a punt` : ''}`;
    else if (waiting) next.textContent = '';
    else next.textContent = text ? `A continuació: ${text[0].toLowerCase()}${text.slice(1)}` : '';
    if (parked && !waiting) next.textContent += `${next.textContent ? ' · ' : ''}Umidaji canta «${parked.title}» · ${Math.round(parked.progress * 100)} %`;
    next.classList.toggle('ready', !!upcoming);
    $('radio-skip').hidden = !station;
    $('radio-skip').disabled = !upcoming;
  }
  function renderPlayer() {
    const player = $('radio-player'), entry = current && readHistory().find(e => e.id === current.id);
    const isPlaying = !!current && onTrack && !audio.paused;
    player.classList.toggle('is-playing', isPlaying);
    player.classList.toggle('is-waiting', waiting || !current);
    $('radio-disc-label').textContent = (STATIONS[station || current?.song.settings.style] || '').toUpperCase();
    $('radio-subgenre').textContent = current ? subgenreName(current.song.settings.subgenre) : `Emissora ${STATIONS[station] || ''}`;
    $('radio-replay').hidden = !current?.replay || entry?.vote !== 1;
    $('radio-sung').hidden = !current?.sung;
    $('radio-title').textContent = current ? current.song.title : '';
    $('radio-meta').textContent = current ? `${keyName(current.song)} · ${current.song.settings.bpm} BPM · ${clock(current.seconds)}${current.voiceTimbre ? ' · ' + current.voiceTimbre : ''}` : '';
    const play = $('radio-play');
    play.disabled = !current || !onTrack;
    play.firstElementChild.textContent = isPlaying ? '❚❚' : '▶';
    play.setAttribute('aria-label', isPlaying ? 'Pausa' : 'Reprodueix');
    play.classList.toggle('attention', needsTap && !isPlaying);
    for (const [key, value] of [['radio-up', 1], ['radio-down', -1]]) {
      $(key).disabled = !entry; $(key).setAttribute('aria-pressed', String(!!entry && entry.vote === value));
    }
    const comment = $('radio-comment');
    comment.disabled = !entry;
    if (comment.dataset.song !== (entry?.id || '')) { comment.value = entry?.comment || ''; comment.dataset.song = entry?.id || ''; $('radio-comment-state').textContent = ''; }
    $('radio-seek').disabled = !current || !onTrack;
    $('radio-duration').textContent = current ? clock(current.seconds) : '0:00';
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = isPlaying ? 'playing' : current ? 'paused' : 'none'; } catch {} }
    renderPrep(); renderProgress();
  }
  let seeking = false;
  function renderProgress() {
    if (!current || !onTrack) { $('radio-seek').value = 0; $('radio-time').textContent = '0:00'; $('radio-section').textContent = ''; return; }
    const t = Math.min(current.seconds, audio.currentTime || 0);
    if (!seeking) $('radio-seek').value = Math.round(t / current.seconds * 1000);
    $('radio-time').textContent = clock(t);
    let now = current.timeline[0];
    for (const mark of current.timeline) if (mark.at <= t) now = mark;
    $('radio-section').textContent = audio.currentTime >= current.seconds ? '' : now ? `${now.name} · ${now.bpm} BPM` : '';
    // Lletra: el vers que es canta ara i el següent (a partir de mig segon abans que comenci).
    const lines = current.timeline.flatMap(mark => mark.lines || []);
    let line = -1;
    for (let i = 0; i < lines.length; i++) if (lines[i].at - .5 <= t) line = i;
    const sung = line >= 0 && (lines[line + 1]?.at ?? Infinity) > t && t - lines[line].at < 12 ? lines[line] : null, next = lines[line + 1];
    $('radio-lyrics').hidden = !lines.length;
    $('radio-lyric-now').textContent = sung ? sung.text : '♪';
    $('radio-lyric-next').textContent = next && next.at - t < 8 ? next.text : '';
  }
  $('radio-seek').addEventListener('input', () => { seeking = true; if (current) $('radio-time').textContent = clock($('radio-seek').value / 1000 * current.seconds); });
  $('radio-seek').addEventListener('change', () => {
    seeking = false;
    if (current && onTrack) { try { audio.currentTime = Math.min(current.seconds - .05, $('radio-seek').value / 1000 * current.seconds); } catch {} }
  });

  // ── Vots i comentaris ────────────────────────────────────────────────
  function vote(id, value) {
    const entry = updateEntry(id, e => { e.vote = e.vote === value ? 0 : value; e.voted = Date.now(); });
    if (!entry) return;
    if (current?.id === id) renderPlayer();
    renderHistory();
    pruneTakes();
    if (entry.vote === 1 && savedTakes.has(id)) toast(`👍 Apuntada amb la veu: ${likedSung()} al repertori cantat${likedSung() < REPERTOIRE_MIN ? ` (amb ${REPERTOIRE_MIN} per emissora ja no caldran cançons sense veu)` : ''}.`);
    else if (entry.vote === 1) toast('👍 Apuntada: tornarà a sonar de tant en tant i inspirarà les noves.');
    else if (entry.vote === -1) toast('👎 Apuntada. Explica què milloraries al comentari.');
  }
  function saveComment(id, text) { updateEntry(id, e => { e.comment = text.slice(0, 1000); e.commented = Date.now(); }); }
  let commentTimer;
  $('radio-comment').addEventListener('input', event => {
    const id = event.target.dataset.song, text = event.target.value;
    if (!id) return;
    $('radio-comment-state').textContent = '…'; clearTimeout(commentTimer);
    commentTimer = setTimeout(() => { saveComment(id, text); $('radio-comment-state').textContent = text.trim() ? '· desat ✓' : ''; if (historyOpen) renderHistory(); }, 400);
  });
  $('radio-comment').addEventListener('blur', event => { const id = event.target.dataset.song; if (id) { clearTimeout(commentTimer); saveComment(id, event.target.value); $('radio-comment-state').textContent = event.target.value.trim() ? '· desat ✓' : ''; } });
  $('radio-up').addEventListener('click', () => current && vote(current.id, 1));
  $('radio-down').addEventListener('click', () => current && vote(current.id, -1));

  // ── Historial ────────────────────────────────────────────────────────
  const FILTERS = { all: () => true, ska: e => e.style === 'ska', punk: e => e.style === 'punk', up: e => e.vote === 1, down: e => e.vote === -1, comment: e => !!e.comment?.trim() };
  const dateText = ms => { try { return new Date(ms).toLocaleString('ca', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  function make(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function historyStatus(action, label) {
    if (action) action.label = label;
    const visible = historyPlayback || historyVoice;
    $('radio-history-status').textContent = visible ? `«${visible.title}» · ${visible.label}` : '';
  }
  function cancelHistoryPlayback() {
    historyPlayback?.controller.abort();
    historyPlayback = null;
    historyStatus();
  }
  async function playHistory(entry) {
    cancelHistoryPlayback();
    const controller = new AbortController(), action = { id: entry.id, title: entry.title, controller };
    historyPlayback = action;
    const active = () => historyPlayback === action;
    // Desbloqueja el reproductor amb el toc encara que vinguem de la pantalla d'emissores.
    if (!station && !current) playSilence();
    historyStatus(action, 'Preparant la reproducció…');
    try {
      await takesReady;
      entry = readHistory().find(e => e.id === entry.id) || entry;
      if (entry.sung && sungCatalog === null && !savedTakes.has(entry.id)) await loadSung();
      if (!active()) return;
      let track;
      if (current?.id === entry.id && onTrack && (current.sung || !savedTakes.has(entry.id))) {
        track = current;
      } else {
        const choice = historyChoice(entry);
        const plan = renderPlan(choice.song), stored = await loadTake(choice, plan);
        if (!active()) return;
        if (choice.sung && !stored) {
          track = await downloadTrack(choice, controller.signal).catch(error => {
            if (controller.signal.aborted) throw error;
            console.warn('La versió cantada del catàleg no està disponible:', error);
            return null;
          });
        }
        if (!track) {
          const progress = (stage, value) => {
            const label = stage === 'bank' ? 'Carregant els instruments' : stage === 'mix' ? 'Fent la mescla' : 'Gravant la banda';
            historyStatus(action, stage === 'render' ? `${label} · ${Math.round(value * 100)} %` : `${label}…`);
          };
          const rendered = await renderBand(choice.song, plan, !!stored, active, progress);
          track = await renderTrack(choice, rendered, stored);
        }
      }
      if (!active()) { if (track !== current) URL.revokeObjectURL(track.url); return; }
      studio.stop();
      historyPlayback = null;
      historyStatus();
      queue = queue.filter(queued => {
        if (queued.id !== track.id) return true;
        URL.revokeObjectURL(queued.url);
        return false;
      });
      openHistory(false);
      playTrack(track);
      showScreen('player');
      $('radio-play').focus();
    } catch (error) {
      if (!active()) return;
      if (!station && !current) audio.pause();
      toast(`No s’ha pogut reproduir «${entry.title}». ${reasonOf(error)}`);
    } finally {
      if (active()) {
        historyPlayback = null;
        historyStatus();
        renderHistory();
      }
    }
  }
  function addHistoryLyrics(song) {
    if (song.settings.lang !== 'en' && song.sections.some(sec => sec.lyrics?.trim())) return;
    const { subgenre, style, seed } = song.settings;
    const eligible = song.sections.filter(sec => song.clips.some(clip =>
      clip.instrument === 'vocal' && clip.generated && clip.start < sec.start + sec.bars && clip.start + clip.bars > sec.start));
    const written = window.SkaLyrics.writeLyrics({ subgenre, style, seed: (seed ^ 0x5bd1e995) >>> 0, sections: eligible, lang: 'ca' });
    eligible.forEach((sec, index) => {
      const line = written.sections[index];
      sec.lyrics = line.text;
      if (line.phraseBars === 4) sec.phraseBars = 4;
      else delete sec.phraseBars;
    });
    song.settings.lang = 'ca';
  }
  async function generateHistoryVoice(entry) {
    if (historyVoice) { toast('Umidaji ja prepara una cançó de l’historial.'); return; }
    if (!browserSinger) { toast('Umidaji no està disponible en aquest navegador.'); return; }
    const action = { id: entry.id, title: entry.title };
    historyVoice = action;
    renderHistory();
    try {
      historyStatus(action, 'Preparant Umidaji…');
      await restoringBank;
      await bankImport?.catch(() => {});
      await takesReady;
      if (!bankReady) throw new Error('Carrega el ZIP d’Umidaji a la pantalla de les emissores.');
      if (parked) {
        historyStatus(action, 'Esperant que Umidaji acabi la cançó anterior…');
        await parked.finished;
      }
      if (savedTakes.has(entry.id)) return;
      if (!browserSinger.available) throw new Error('Umidaji encara s’està recuperant. Torna-ho a provar d’aquí a un minut.');
      const { song } = historyChoice(entry);
      addHistoryLyrics(song);
      const notes = scoreNotes(song, renderPlan(song));
      if (!notes.length) throw new Error('La cançó no té cap melodia de veu que es pugui cantar.');
      historyStatus(action, 'Umidaji està preparant la veu…');
      const job = browserSinger.start({
        notes, subgenre: song.settings.subgenre,
        onProgress: value => historyStatus(action, `Umidaji està cantant · ${Math.round(value * 100)} %`)
      });
      const pcm = await job.result;
      historyStatus(action, 'Desant la veu…');
      await browserSinger.takes.save(entry.id, pcm);
      if (!updateEntry(entry.id, e => { e.song = song; e.sung = true; e.voiceCreated = Date.now(); })) {
        await browserSinger.takes.remove(entry.id);
        throw new Error('La cançó ja no és a l’historial.');
      }
      savedTakes.add(entry.id);
      pruneTakes(entry.id);
      toast(`Veu desada per a «${entry.title}». Ja la pots reproduir des de l’historial.`);
    } catch (error) {
      toast(`No s’ha pogut generar la veu de «${entry.title}». ${reasonOf(error)}`);
    } finally {
      historyVoice = null;
      historyStatus();
      renderHistory();
      if (station) fill(session);
    }
  }
  function renderHistory() {
    const all = readHistory();
    $('radio-history-count').textContent = all.length || '';
    if (!historyOpen) return;
    const list = all.filter(FILTERS[filter] || FILTERS.all), box = $('radio-history-list');
    // No es redibuixa mentre s'escriu un comentari de la llista.
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
    const up = all.filter(e => e.vote === 1).length, down = all.filter(e => e.vote === -1).length, commented = all.filter(e => e.comment?.trim()).length;
    $('radio-history-summary').textContent = all.length ? `${all.length} ${all.length === 1 ? 'cançó' : 'cançons'} · 👍 ${up} · 👎 ${down} · 💬 ${commented}` : '';
    box.replaceChildren();
    for (const entry of list) {
      const item = make('li', `history-item ${entry.style}${current?.id === entry.id ? ' now' : ''}`);
      const head = make('div', 'history-row'), text = make('div', 'history-text');
      text.append(make('strong', '', entry.title || 'Sense títol'),
        make('small', '', [subgenreName(entry.subgenre || entry.style), clock(entry.seconds || 0), entry.song?.settings ? keyName(entry.song) : '', dateText(entry.lastPlayed || entry.created),
          entry.plays > 1 ? `sonada ${entry.plays} cops` : '', current?.id === entry.id ? 'sonant ara' : ''].filter(Boolean).join(' · ')));
      const votes = make('div', 'history-votes');
      for (const [value, icon, label] of [[1, '👍', 'M’agrada'], [-1, '👎', 'No m’agrada']]) {
        const button = make('button', `vote small ${value === 1 ? 'up' : 'down'}`, icon); button.type = 'button';
        button.setAttribute('aria-label', `${label}: ${entry.title}`); button.setAttribute('aria-pressed', String(entry.vote === value));
        button.addEventListener('click', () => vote(entry.id, value)); votes.append(button);
      }
      const remove = make('button', 'history-remove', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Esborra de l’historial: ${entry.title}`);
      remove.addEventListener('click', () => {
        if (current?.id === entry.id || historyVoice?.id === entry.id || historyPlayback?.id === entry.id) {
          toast('Espera que acabi la reproducció o la generació de veu per esborrar aquesta cançó.'); return;
        }
        if (!window.confirm(`Esborrar «${entry.title}» de l’historial?`)) return;
        writeHistory(readHistory().filter(e => e.id !== entry.id)); renderHistory();
      });
      head.append(text, votes, remove);
      const actions = make('div', 'history-song-actions');
      const hasVoice = savedTakes.has(entry.id) || !!sungById(entry.id) || (current?.id === entry.id && current.sung);
      const play = make('button', 'radio-button', hasVoice ? '▶ Reprodueix cantada' : '▶ Reprodueix');
      play.type = 'button';
      play.setAttribute('aria-label', `${play.textContent}: ${entry.title}`);
      play.addEventListener('click', () => playHistory(entry));
      actions.append(play);
      if (!hasVoice) {
        const voice = make('button', 'radio-button', historyVoice?.id === entry.id ? 'Generant veu…' : '🎤 Genera veu');
        voice.type = 'button';
        voice.disabled = !!historyVoice;
        voice.setAttribute('aria-label', `${voice.textContent}: ${entry.title}`);
        voice.addEventListener('click', () => generateHistoryVoice(entry));
        actions.append(voice);
      }
      const comment = make('textarea', 'history-comment'); comment.rows = 1; comment.maxLength = 1000; comment.value = entry.comment || '';
      comment.placeholder = 'Afegeix un comentari…'; comment.setAttribute('aria-label', `Comentari de ${entry.title}`);
      const grow = () => { comment.style.height = 'auto'; comment.style.height = `${Math.min(160, comment.scrollHeight + 2)}px`; };
      comment.addEventListener('input', grow);
      comment.addEventListener('change', () => {
        saveComment(entry.id, comment.value);
        if (current?.id === entry.id) { $('radio-comment').value = comment.value; }
        toast('Comentari desat.');
      });
      item.append(head, actions, comment); box.append(item);
      if (comment.value) requestAnimationFrame(grow);
    }
    $('radio-history-empty').hidden = list.length > 0;
    $('radio-history-empty').textContent = all.length ? 'Cap cançó amb aquest filtre.' : 'Encara no ha sonat cap cançó. Tria una emissora i comença a escoltar.';
    for (const button of document.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  function openHistory(open) {
    historyOpen = open; $('radio-history').hidden = !open; $('radio').classList.toggle('history-open', open);
    if (open) {
      renderHistory();
      $('radio-history').scrollTop = 0;
      if (sungCatalog === null) Promise.all([takesReady, loadSung()]).then(renderHistory);
    } else if (historyPlayback) {
      cancelHistoryPlayback();
      if (!station && !current) audio.pause();
    }
  }
  function exportHistory(everything) {
    const list = readHistory().filter(e => everything || e.vote || e.comment?.trim());
    if (!list.length) { toast(everything ? 'L’historial és buit.' : 'Encara no hi ha cap cançó votada o comentada.'); return; }
    try {
      const report = builder.feedbackReport(engine, list.map(e => ({ rating: e.vote === 1 ? 5 : e.vote === -1 ? 1 : 0, created: e.created,
        song: { ...e.song, comments: e.comment?.trim() ? [{ id: 'radio-comment', bar: null, tag: 'general', mood: e.vote === -1 ? 'bad' : e.vote === 1 ? 'good' : 'idea', text: e.comment.trim(), created: e.commented || e.created }] : [] } })));
      report.format = 'radiospam-feedback';
      report.about = 'Cançons que han sonat a Radio Spam, amb el vot (up, down o null), el comentari, quantes vegades han sonat, el resum de les decisions de composició i el projecte complet. «rating» és 5 per a 👍 i 1 per a 👎.';
      report.songs.forEach((item, i) => Object.assign(item, { station: list[i].style, vote: list[i].vote === 1 ? 'up' : list[i].vote === -1 ? 'down' : null,
        sung: !!list[i].sung,
        lyrics: (list[i].song.sections || []).filter(s => s.lyrics?.trim()).map(s => ({ section: engine.SONG_PARTS[s.type]?.name || s.type, text: s.lyrics.trim() })),
        comment: list[i].comment?.trim() || '', plays: list[i].plays || 1, lastPlayed: list[i].lastPlayed ? new Date(list[i].lastPlayed).toISOString() : null }));
      report.totals = { songs: report.songs.length, up: list.filter(e => e.vote === 1).length, down: list.filter(e => e.vote === -1).length, comments: list.filter(e => e.comment?.trim()).length };
      const name = `radiospam-${everything ? 'historial' : 'valoracions'}-${new Date().toISOString().slice(0, 10)}.json`;
      studio.download(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), name);
      toast(`Exportades ${report.totals.songs} cançons (👍 ${report.totals.up} · 👎 ${report.totals.down} · 💬 ${report.totals.comments}).`);
    } catch (error) { console.error(error); toast(`No s’ha pogut exportar: ${reasonOf(error)}`); }
  }

  // ── Ràdio o interfície antiga (només a l'ordinador) ───────────────────
  function setView(view) {
    const radio = view !== 'studio';
    if (!radio) { if (onTrack && !audio.paused) { userPaused = true; audio.pause(); } }
    else studio.stop();
    root.classList.toggle('radio-on', radio);
    try { localStorage.setItem(VIEW_KEY, radio ? 'radio' : 'studio'); } catch {}
    document.title = radio ? 'Radio Spam' : 'Radio Spam · Taller de cançons';
    if (radio) $('theme-color').content = '#0c0b12'; else { studio.refresh(); window.dispatchEvent(new Event('resize')); }
    window.scrollTo(0, 0);
  }
  $('radio-studio').addEventListener('click', () => setView('studio'));
  $('to-radio').addEventListener('click', () => setView('radio'));

  for (const button of document.querySelectorAll('[data-station]')) button.addEventListener('click', () => chooseStation(button.dataset.station));
  for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { filter = button.dataset.filter; renderHistory(); });
  $('radio-back').addEventListener('click', () => { if (historyOpen) openHistory(false); else leaveStation(); });
  $('radio-play').addEventListener('click', togglePlay);
  $('radio-skip').addEventListener('click', skip);
  $('radio-retry').addEventListener('click', () => { failures = 0; setPrep({ stage: 'compose', value: 0 }); if (waiting) playSilence(); fill(session); });
  $('radio-history-open').addEventListener('click', () => openHistory(!historyOpen));
  $('radio-history-close').addEventListener('click', () => openHistory(false));
  $('radio-export').addEventListener('click', () => exportHistory(false));
  $('radio-export-all').addEventListener('click', () => exportHistory(true));
  document.addEventListener('keydown', event => {
    if (!root.classList.contains('radio-on') || /^(TEXTAREA|INPUT|SELECT|BUTTON)$/.test(event.target.tagName)) return;
    if (event.key === ' ' && current) { event.preventDefault(); togglePlay(); }
    else if (event.key === 'Escape' && historyOpen) openHistory(false);
  });
  // En tornar a la pàgina, es reprèn el que el navegador hagi aturat pel seu compte.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !station) return;
    if (waiting && audio.paused) playSilence();
    else if (onTrack && audio.paused && !userPaused && !audio.ended) audio.play().catch(() => { needsTap = true; renderPlayer(); });
    renderPlayer();
  });

  $('radio-history-count').textContent = readHistory().length || '';
  if (root.classList.contains('radio-on')) $('theme-color').content = '#0c0b12';
  showScreen('home');
  window.RadioSpam = { get state() { return { station, waiting, filling, current: current && { id: current.id, title: current.song.title, seconds: current.seconds, replay: current.replay }, queued: queue.length, singing: parked && { title: parked.title, progress: parked.progress }, takes: savedTakes.size, repertoire: likedSung(), upcoming: queue[0] && { id: queue[0].id, title: queue[0].song.title }, prep }; } };
})();
