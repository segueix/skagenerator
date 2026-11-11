(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaSongBuilder = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Cançó automàtica: a partir d'un subgènere, compon una cançó sencera de
  // 2 a 4 minuts (estructura, harmonia, arranjament, riff, respostes, canvis
  // de tempo i de to) i tria les millors melodies.
  const MELODIC = ['vocal', 'trumpet', 'trombone', 'sax', 'synthLead'];
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // Qualitat d'una línia [compàs, temps, nota, durada]. Contorn: graus conjunts,
  // salts compensats, registre equilibrat i poques notes repetides mecànicament.
  // Amb context ({ chords, others }) també puntua l'encaix amb l'harmonia, un sol
  // clímax per frase, l'equilibri entre repetició i novetat rítmica, les
  // cadències de final de frase i els xocs amb les altres línies que sonen alhora.
  const CLASH = new Set([1, 6, 11]); // segona menor, trító i setena major
  function lineScore(notes, context = {}) {
    if (!notes || notes.length < 3) return -100;
    const p = notes.map(n => n[2]), range = Math.max(...p) - Math.min(...p);
    let steps = 0, leaps = 0, recovered = 0, stuck = 0, run = 1, turns = 0;
    for (let i = 1; i < p.length; i++) {
      const d = p[i] - p[i - 1], a = Math.abs(d);
      if (a > 0 && a <= 2) steps++;
      if (a >= 5) { leaps++; const next = p[i + 1] - p[i]; if (next !== undefined && Math.sign(next) === -Math.sign(d) && Math.abs(next) <= 2) recovered++; }
      if (d === 0) { run++; if (run >= 3) stuck++; } else run = 1;
      if (i > 1 && Math.sign(d) && Math.sign(p[i - 1] - p[i - 2]) && Math.sign(d) !== Math.sign(p[i - 1] - p[i - 2])) turns++;
    }
    const n = p.length - 1;
    let score = 5 * steps / n - 3 * leaps / n + 1.5 * recovered / Math.max(1, leaps) - 1.2 * stuck - Math.abs(range - 10) * .35 - Math.abs(turns / n - .35) * 2;
    const { chords, others = [] } = context;
    const fits = (note, which) => !chords?.[note[0]] || (which || chords[note[0]].pcs).includes(note[2] % 12);
    // Encaix amb l'harmonia: notes de l'acord als temps.
    if (chords) {
      const on = notes.filter(note => note[1] % 1 === 0);
      if (on.length) score += 3 * on.filter(note => fits(note)).length / on.length - 1.5;
    }
    // Frases de quatre compassos: un sol clímax i un final que reposa (nota de l'acord, prou llarga).
    const phrases = new Map();
    for (const note of notes) { const k = Math.floor(note[0] / 4); if (!phrases.has(k)) phrases.set(k, []); phrases.get(k).push(note); }
    let climax = 0, cadence = 0;
    for (const list of phrases.values()) {
      const top = Math.max(...list.map(note => note[2])), tops = list.filter(note => note[2] === top).length;
      climax += list.length < 3 ? 0 : tops === 1 ? 1 : -.4 * (tops - 1);
      const end = list[list.length - 1];
      cadence += (end[3] >= 1 ? .5 : 0) + (chords ? (fits(end) ? .5 : -.3) : 0);
    }
    score += .6 * climax / phrases.size + 1.5 * cadence / phrases.size;
    // Repetició i novetat rítmica: ni tots els compassos iguals ni tots diferents.
    const bars = new Map();
    for (const note of notes) bars.set(note[0], `${bars.get(note[0]) || ''}${note[1]}:${note[3]},`);
    if (bars.size >= 4) score -= 2.5 * Math.abs(new Set(bars.values()).size / bars.size - .5);
    // Xocs: intervals dissonants entre notes que sonen alhora amb una altra línia.
    if (others.length) {
      let clashes = 0;
      const span = ([b, t, , d]) => [b * 4 + t, b * 4 + t + d];
      for (const note of notes) {
        const [s0, e0] = span(note);
        for (const line of others) for (const other of line) {
          const [s1, e1] = span(other);
          if (Math.min(e0, e1) - Math.max(s0, s1) >= .25 && CLASH.has(Math.abs(note[2] - other[2]) % 12)) clashes++;
        }
      }
      score -= 6 * clashes / notes.length;
    }
    return score;
  }
  const mean = line => line.reduce((t, note) => t + note[2], 0) / Math.max(1, line.length);
  // Harmonia de la cançó sencera: estrofa i tornada contrastades, tornada que
  // comença a la tònica, arribada a la tornada des de la dominant i pont diferent.
  function harmonyScore(chordsOf) {
    const cycle = type => chordsOf(type)?.slice(0, 4).join(' ');
    const verse = chordsOf('verse'), chorus = chordsOf('chorus'), lead = chordsOf('prechorus') || verse, middle = chordsOf('bridge') || chordsOf('solo');
    let score = 0;
    if (verse && chorus) {
      const known = new Set(verse.slice(0, 4));
      score += .6 * new Set(chorus.slice(0, 4).filter(c => !known.has(c))).size;
      if (cycle('verse') === cycle('chorus')) score -= 3;
      if (/^(I|i|Imaj7|i7)$/.test(chorus[0])) score += 1;
    }
    if (lead) { const end = lead[lead.length - 1]; score += /^V7?$/.test(end) ? 1.5 : /^(v7?|IV|iv|bVII|ii7)$/.test(end) ? .6 : 0; }
    if (middle) score += [verse, chorus].every(list => !list || list.slice(0, 4).join(' ') !== middle.slice(0, 4).join(' ')) ? .5 : 0;
    return score;
  }
  const TITLES = {
    ska: [['Ball', 'Nit', 'Festa', 'Passeig', 'Revetlla', 'Matinada', 'Rumbeta', 'Vermut', 'Contratemps', 'Rude boy'],
      ['al port', 'de barri', 'a la Rambla', 'sense son', 'de dissabte', 'a contratemps', 'del Raval', 'de Gràcia', 'a la platja', 'de les sis']],
    punk: [['Crits', 'Soroll', 'Ràbia', 'Fum', 'Ferro', 'Vidres', 'Ombres', 'Sirenes', 'Cendres', 'Asfalt'],
      ['de barri', 'a mitjanit', 'sense nom', 'al terrat', 'contra el vent', 'de diumenge', 'de neó', 'al metro', 'i benzina', 'a tot drap']],
    horror: [['Tombes', 'Lluna', 'Vampirs', 'Difunts', 'Calaveres', 'Espectres', 'Corbs'], ['a mitjanit', 'de cementiri', 'sense ànima', 'de Tots Sants', 'i ossos', 'al soterrani']]
  };

  // ── Inicis i finals de cançó, i silencis al mig ────────────────────
  // ── Recursos especials, amb mesura ─────────────────────────────────
  // La cançó automàtica té tots els recursos a l'abast (inicis i finals
  // especials, aturades, silencis, fosos i efectes de color), però cadascun té
  // un valor segons el subgènere i el moment. Només s'apliquen els que
  // superen un llindar, de més valuós a menys, fins a un pressupost que depèn
  // de la durada: un recurs llueix quan és escàs. Regles extres: com a molt un
  // fos per cançó, un sol efecte de color, i aturada i silenci mai seguits.
  const FIT = {
    jamaican: { open: { riff: .8, riddim: .7, fadein: .65, buildup: .55, drums: .3 }, close: { fadeout: .8, riff: .7, ritard: .6, hit: .5, breakdown: .4 }, silence: .35, stop: .5, color: .7 },
    rocksteady: { open: { riddim: .85, fadein: .8, riff: .6, buildup: .6, voice: .4 }, close: { fadeout: .9, ritard: .55, riff: .6, breakdown: .45 }, silence: .3, stop: .35, color: .65 },
    twotone: { open: { riff: .8, buildup: .7, drums: .6, countin: .45, halftime: .35 }, close: { hit: .8, cold: .65, riff: .6, ring: .5, ritard: .4 }, silence: .55, stop: .65, color: .55 },
    skapunk: { open: { drums: .7, halftime: .65, buildup: .6, riff: .6, countin: .5 }, close: { cold: .8, ring: .7, hit: .7, breakdown: .35 }, silence: .7, stop: .7, color: .45 },
    punk77: { open: { countin: .8, drums: .7, riff: .7, voice: .45, buildup: .4 }, close: { hit: .8, cold: .8, ring: .6 }, silence: .6, stop: .7, color: .45 },
    hardcore: { open: { countin: .8, drums: .7, riff: .5 }, close: { cold: .9, hit: .7, ring: .4 }, silence: .8, stop: .75, color: .25 },
    poppunk: { open: { riff: .8, voice: .7, buildup: .6, drums: .6, countin: .4 }, close: { ring: .8, hit: .7, cold: .55, riff: .5, ritard: .4 }, silence: .7, stop: .6, color: .55 },
    horrorpunk: { open: { drums: .7, riff: .7, voice: .6, buildup: .6, fadein: .5 }, close: { ring: .8, cold: .7, ritard: .6, breakdown: .5 }, silence: .6, stop: .55, color: .65 }
  };
  const THRESHOLD = .55;
  function planHighlights(song, key, r, options = {}) {
    const fit = FIT[key] || FIT.twotone, sections = song.sections, st = song.settings;
    const first = sections[0], last = sections.at(-1), outro = last.type === 'outro', punk = st.style === 'punk';
    const seconds = sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || st.bpm), 0);
    const budget = seconds < 150 ? 2 : seconds < 210 ? 3 : 4;
    const vary = () => .8 + r() * .4; // una mica d’atzar perquè no sigui sempre el mateix
    const best = (table, context) => Object.entries(table).map(([name, v]) => [name, v * context(name) * vary()]).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const candidates = [];
    const [opening, openValue] = best(fit.open, name => ({
      fadein: first.bars >= 8 || st.bpm <= 125 ? 1 : .3, voice: options.vocal ? 1 : 0, countin: st.countIn ? 0 : 1,
      halftime: first.bpm ? 0 : 1, buildup: first.bars >= 4 ? 1 : .4 })[name] ?? 1);
    if (opening) candidates.push({ kind: 'opening', name: opening, value: openValue });
    const [closing, closeValue] = best(Object.fromEntries(Object.entries(fit.close).filter(([name]) => name !== 'hit')), name => ({
      fadeout: outro && last.bars >= 8 ? 1 : outro && last.bars >= 4 ? .5 : .2, cold: outro ? 1 : 0, ring: outro ? 1 : 0, riff: outro ? 1 : 0,
      ritard: last.bpm ? 0 : 1, breakdown: last.bars >= 4 ? 1 : .3 })[name] ?? 1);
    // El cop final és el final natural: un final especial només si val més que ell.
    if (closing && closeValue > (fit.close.hit || 0)) candidates.push({ kind: 'closing', name: closing, value: closeValue });
    // Silenci abans de l'última tornada (més valuós després d'un pont o un solo) i aturada abans d'una tornada anterior.
    const before = sections.map((sec, i) => sections[i + 1]?.type === 'chorus' && sec !== first && sec.bars >= 2 ? sec : null).filter(Boolean);
    const choruses = sections.filter(s => s.type === 'chorus').length;
    if (before.length) {
      const target = before.at(-1);
      candidates.push({ kind: 'middle', name: punk || r() < .5 ? 'break' : 'silence', target,
        value: fit.silence * (['bridge', 'solo', 'prechorus'].includes(target.type) ? 1.1 : .85) * (choruses >= 3 ? 1 : .8) * vary() });
    }
    if (before.length >= 2) candidates.push({ kind: 'stop', target: before.at(-2), value: fit.stop * (choruses >= 3 ? 1 : .85) * vary() });
    const chosen = [];
    for (const c of candidates.sort((a, b) => b.value - a.value)) {
      if (chosen.length >= budget || c.value < THRESHOLD) break;
      if (c.kind === 'stop' && chosen.some(o => o.kind === 'middle' && Math.abs(sections.indexOf(o.target) - sections.indexOf(c.target)) < 2)) continue;
      if (c.kind === 'middle' && chosen.some(o => o.kind === 'stop' && Math.abs(sections.indexOf(o.target) - sections.indexOf(c.target)) < 2)) continue;
      if ((c.name === 'fadein' || c.name === 'fadeout') && chosen.some(o => o.name === 'fadein' || o.name === 'fadeout')) continue;
      chosen.push(c);
    }
    const pick = kind => chosen.find(c => c.kind === kind);
    const plan = { opening: pick('opening')?.name || 'band', closing: pick('closing')?.name || 'hit', middle: pick('middle')?.name || 'none',
      stop: pick('stop')?.target || null, chosen };
    // Efecte de color: un sol moment. L'intro amb el riff sol sona com un disc antic
    // o una ràdio i la banda entra neta; si no, un instrument del pont pel megàfon o el telèfon.
    if (chosen.length < budget) {
      const riffer = punk ? 'guitar3' : 'trumpet';
      const bridge = sections.find(s => s.type === 'bridge' || s.type === 'solo');
      const options2 = [
        { where: first, instrument: riffer, color: punk ? (r() < .5 ? 'radio' : 'megaphone') : (r() < .6 ? 'gramophone' : 'radio'),
          value: fit.color * (plan.opening === 'riff' ? 1.2 : first.bars >= 8 ? .8 : .6) * vary() },
        ...(bridge ? song.clips.filter(c => c.start === bridge.start && ['trumpet', 'trombone', 'sax', 'guitar3', 'guitar2'].includes(c.instrument) && !c.line).slice(0, 1)
          .map(c => ({ where: bridge, instrument: c.instrument, color: punk ? 'megaphone' : r() < .5 ? 'telephone' : 'radio', value: fit.color * .85 * vary() })) : [])
      ].sort((a, b) => b.value - a.value);
      if (options2[0] && options2[0].value >= THRESHOLD) { plan.color = options2[0]; chosen.push({ kind: 'color', ...options2[0] }); }
    }
    return plan;
  }

  // Catàleg de maneres d'entrar i de sortir. designEdges en tria una de cada
  // (diferent de l'anterior), de vegades hi afegeix un silenci abans d'una
  // tornada i ho aplica a la primera i a l'última secció amb les eines del
  // motor: instruments silenciats, entrada i sortida per capes, fos d'entrada
  // o de sortida, compte de baquetes, tempo i tancaments de l'outro.
  const OPENINGS = { band: 'tota la banda de cop', drums: 'bateria sola', buildup: 'entrada per capes', countin: 'compte de baquetes',
    fadein: 'fos d’entrada', riff: 'el riff sol', voice: 'veu i guitarra', riddim: 'baix i bateria', halftime: 'a mig temps i més lenta' };
  const CLOSINGS = { hit: 'cop final de tota la banda', fadeout: 'fos de sortida', cold: 'tall en sec', ritard: 'final que s’alenteix',
    ring: 'redoble i acord llarg', breakdown: 'la banda calla per capes', riff: 'acaba amb el riff sol' };
  const MIDDLES = { none: 'sense silenci', break: 'cop i silenci', silence: 'un compàs de silenci' };
  const LAYER_ORDER = ['drums', 'electronicDrums', 'bass', 'synthBass', 'guitar', 'organ', 'synthPad', 'guitar2', 'guitar3', 'trumpet', 'trombone', 'sax', 'synthLead', 'vocal'];
  function shuffle(list, r) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function designEdges(engine, song, options = {}) {
    const r = rng((options.seed >>> 0) || 1), st = song.settings, previous = song.edges || {};
    const sections = [...song.sections].sort((a, b) => a.start - b.start);
    if (sections.length < 2) throw new Error('Calen com a mínim dues seccions per fer l’inici i el final');
    const first = sections[0], last = sections.at(-1), base = song.base.instruments, punk = st.style === 'punk';
    // Es desfà el disseny anterior (només el que havia fet aquest algorisme).
    for (const sec of [first, last]) for (const field of ['mute', 'entrance', 'exit', 'fade', 'closing']) delete sec[field];
    if (previous.opening === 'halftime') { delete first.bpm; delete first.feel; }
    if (previous.closing === 'ritard') delete last.bpm;
    if (previous.opening === 'countin') delete st.countIn;
    const marked = sections.find(sec => sec.id === previous.middleId);
    if (marked && ['break', 'silence'].includes(marked.ending)) delete marked.ending;
    song.clips = song.clips.filter(c => !c.edge);

    const inside = (c, sec) => c.start < sec.start + sec.bars && sec.start < c.start + c.bars;
    const playing = sec => [...new Set([...base, ...song.clips.filter(c => c.generated && inside(c, sec)).map(c => c.instrument)])]
      .sort((a, b) => LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b));
    const drums = base.find(name => name === 'drums' || name === 'electronicDrums');
    const riffer = punk ? 'guitar3' : 'trumpet', voice = options.vocal ?? song.clips.some(c => c.instrument === 'vocal');
    // Només sonen els instruments triats. La bateria no calla del tot: entra a l'últim compàs amb
    // un redoble, perquè el pas a la secció següent no sigui brusc.
    const only = (sec, keep) => {
      const fill = drums && !keep.includes(drums) && sec.bars >= 2;
      const mute = playing(sec).filter(name => !keep.includes(name) && !(fill && name === drums));
      if (mute.length) sec.mute = mute;
      if (fill) sec.entrance = { ...(sec.entrance || {}), [drums]: sec.bars - 1 };
      return true;
    };
    // Un instrument que ha de sonar a tota la secció: si no hi és, s'hi afegeix un clip (marcat per poder-lo desfer).
    const ensure = (sec, instrument, extra = {}) => {
      const same = song.clips.filter(c => c.instrument === instrument && inside(c, sec));
      if (same.some(c => c.generated && c.start <= sec.start && c.start + c.bars >= sec.start + sec.bars)) return true;
      if (same.length) return false;
      song.clips.push({ id: `edge-${instrument}-${sec.id}`.slice(0, 64), instrument, start: sec.start, bars: sec.bars,
        revision: options.revisions?.[instrument] || 1, generated: true, edge: true, ...extra });
      return true;
    };
    const outro = last.type === 'outro';
    const openings = {
      band: () => true,
      drums: () => !!drums && only(first, [drums]),
      buildup: () => {
        const list = playing(first);
        if (first.bars < 2 || list.length < 2) return false;
        first.entrance = {};
        list.forEach((name, i) => { const at = Math.min(first.bars - 1, Math.floor(i * first.bars / list.length)); if (at > 0) first.entrance[name] = at; });
        return true;
      },
      countin: () => !st.countIn && first.start === 0 && (st.countIn = true),
      fadein: () => first.bars >= 2 && (first.fade = 'in', true),
      riff: () => ensure(first, riffer, { line: 'riff' }) && only(first, [riffer]),
      voice: () => voice && base.includes('guitar') && ensure(first, 'vocal') && only(first, ['vocal', 'guitar']),
      riddim: () => base.includes('bass') && !!drums && only(first, ['bass', drums]),
      halftime: () => {
        if (first.feel || first.bpm) return false;
        first.feel = { drums: .5, bass: .5 }; first.bpm = Math.max(40, Math.round(st.bpm * .94));
        return true;
      }
    };
    const closings = {
      hit: () => true,
      fadeout: () => { last.fade = 'out'; if (outro) last.closing = 'fade'; return true; },
      cold: () => outro && (last.closing = 'cold', true),
      ritard: () => !last.bpm && (last.bpm = Math.max(40, Math.round(st.bpm * .93)), true),
      ring: () => outro && last.bars >= 2 && (last.closing = 'ring', true),
      breakdown: () => {
        // Primer callen les capes de dalt, després la guitarra i el baix; la bateria fa el cop final.
        const list = playing(last).filter(name => name !== drums).reverse();
        if (last.bars < 2 || !list.length || !drums) return false;
        last.exit = {};
        list.forEach((name, i) => { last.exit[name] = Math.max(1, Math.min(last.bars, Math.round((i + 1) * last.bars / (list.length + 1)))); });
        return true;
      },
      riff: () => {
        if (!outro || last.bars < 2 || !ensure(last, riffer, { line: 'riff' })) return false;
        const at = Math.max(1, Math.floor(last.bars / 2));
        last.exit = Object.fromEntries(playing(last).filter(name => name !== riffer).map(name => [name, at]));
        last.closing = 'fade';
        return true;
      }
    };
    const choose = (table, wanted, avoid) => {
      const order = wanted && table[wanted] ? [wanted] : shuffle(Object.keys(table).filter(key => key !== avoid), r);
      for (const key of order) if (table[key]()) return key;
      return Object.keys(table)[0];
    };
    const opening = choose(openings, options.opening, previous.opening);
    const closing = choose(closings, options.closing, previous.closing);
    // Silenci al mig: la secció que porta a una tornada (preferiblement l'última) acaba
    // amb un cop i silenci, o amb un compàs sencer de silenci; la tornada entra amb més força.
    let middle = options.middle ?? (r() < .6 ? (r() < .5 ? 'break' : 'silence') : 'none'), middleId;
    if (middle !== 'none') {
      const before = sections.map((sec, i) => sections[i + 1]?.type === 'chorus' ? sec : null).filter(sec => sec && sec !== first && sec.bars >= 2 && !sec.ending);
      const target = before.at(-1);
      if (target) { target.ending = middle; middleId = target.id; } else middle = 'none';
    }
    song.edges = { opening, closing, middle, ...(middleId ? { middleId } : {}) };
    const where = middleId ? ` abans de la tornada del compàs ${sections[sections.findIndex(sec => sec.id === middleId) + 1].start + 1}` : '';
    return { opening, closing, middle, middleId,
      text: `Inici: ${OPENINGS[opening]}. Final: ${CLOSINGS[closing]}.${middle !== 'none' ? ` Al mig: ${MIDDLES[middle]}${where}.` : ''}` };
  }

  function composeAuto(engine, key, options = {}) {
    const sg = engine.SUBGENRES[key];
    if (!sg) throw new Error('Subgènere desconegut');
    const seed = (options.seed >>> 0) || 1, r = rng(seed), pick = list => list[Math.floor(r() * list.length)];
    const minutes = Math.max(2, Math.min(4, Number(options.minutes) || 3)), vocal = options.vocal !== false;
    const punk = sg.style === 'punk', TYPES = engine.SONG_PARTS;
    // Preferències: de vegades parteix d'una cançó d'aquest subgènere que t'ha agradat (★4 o més).
    const liked = (options.liked || []).filter(Boolean), model = liked.length && r() < .5 ? pick(liked).settings : null;
    let bpm = model ? model.bpm + Math.round((r() - .5) * 8) : sg.bpm[0] + Math.round(r() * (sg.bpm[1] - sg.bpm[0]));
    bpm = Math.max(sg.bpm[0], Math.min(sg.bpm[1], bpm, engine.SONG_STYLES[sg.style].bpm.max));
    // Tonalitat: la triada (si és una de les del subgènere); si no, la d'una cançó que t'ha agradat o una a l'atzar.
    const chosenKey = Array.isArray(options.key) && sg.keys.find(([t, m]) => t === options.key[0] && m === options.key[1]);
    const fromModel = model && sg.keys.some(([t, m]) => t === model.tonic && m === model.mode) ? [model.tonic, model.mode] : null;
    const [tonic, mode] = chosenKey || fromModel || pick(sg.keys);
    const groove = model?.groove && sg.groove.drums.includes(model.groove.drums) ? { ...model.groove }
      : { drums: pick(sg.groove.drums), bass: pick(sg.groove.bass), guitar: pick(sg.groove.guitar) };
    const settings = { style: sg.style, subgenre: key, bpm, tonic, mode, seed: (seed * 2654435761 >>> 0) || 7, bars: 0, swing: sg.swing || 0,
      timbres: { guitar: 'auto', bass: 'auto', drums: 'auto', trumpet: 'auto', trombone: 'auto', vocal: 'auto', ...(sg.timbres || {}) }, groove };
    // So de guitarra: alguns subgèneres en tenen diversos (el punk del 77 no ha de sonar sempre igual).
    const fx = sg.fxChoices ? (([type, drive, tone]) => ({ type, drive, tone }))(pick(sg.fxChoices)) : sg.fx;
    if (fx) settings.fx = { guitar: { ...fx }, guitar2: { ...fx }, guitar3: { ...fx } };
    // Ska jamaicà: el baix tapava els vents (comentaris de les cançons): baix més suau i vents més presents.
    if (key === 'jamaican') { settings.baseVolume = { drums: 0, bass: -3 }; settings.volumes = { trumpet: 2, trombone: 2, sax: 2 }; }
    for (const option of ['drumTune', 'humanize', 'cymbals', 'countIn']) if (sg[option] !== undefined) settings[option] = sg[option];
    if (settings.swing === 0) delete settings.swing;

    // ── Estructura de 2 a 4 minuts ────────────────────────────────────
    // Punk del 77: de vegades pretornada i intro llarga (abans totes les cançons tenien la mateixa forma).
    const len = bpm >= 160 ? 16 : 8;
    const pre = ['twotone', 'poppunk', 'jamaican'].includes(key) && r() < .7 || key === 'punk77' && r() < .35;
    const introBars = key === 'jamaican' || key === 'rocksteady' || key === 'punk77' && r() < .3 ? 8 : 4;
    const middle = punk ? 'bridge' : key === 'rocksteady' ? 'bridge' : r() < .6 ? 'solo' : 'bridge';
    const block = () => [['verse', len], ...(pre ? [['prechorus', 4]] : []), ['chorus', len]];
    let plan = [['intro', introBars], ...block(), ...block(), [middle, 8], ['chorus', len], ['outro', punk ? 4 : 8]];
    const seconds = list => list.reduce((t, [, bars]) => t + bars * 240 / bpm, 0), target = minutes * 60;
    // Ajust voraç: afegeix o treu blocs fins que la durada s'acosta al que s'ha demanat (sempre entre 2 i 4 minuts).
    const ok = list => seconds(list) >= 125 && seconds(list) <= 235;
    const score = list => Math.abs(seconds(list) - target) + (ok(list) ? 0 : 1000);
    const variants = list => {
      const out = [], mid = list.findIndex(([type]) => type === middle), verses = list.filter(([t]) => t === 'verse').length;
      out.push([...list.slice(0, mid), ...block(), ...list.slice(mid)]);
      out.push([...list.slice(0, -1), ['chorus', len], list[list.length - 1]]);
      out.push([...list.slice(0, mid + 1), [middle === 'solo' ? 'bridge' : 'solo', 8], ...list.slice(mid + 1)]);
      if (verses > 1) { const v = list.findIndex(([t]) => t === 'verse'); out.push([...list.slice(0, v), ...list.slice(v + (pre ? 3 : 2))]); }
      const p = list.findIndex(([t]) => t === 'prechorus'); if (p >= 0) out.push(list.filter((_, i) => i !== p));
      if (list[0][1] > 4) out.push([['intro', 4], ...list.slice(1)]);
      const c = list.findIndex(([t], i) => t === 'chorus' && list[i + 1]?.[0] === 'chorus'); if (c >= 0) out.push(list.filter((_, i) => i !== c));
      out.push(list.map(([type, bars]) => [type, type === 'verse' && bars < 16 ? bars * 2 : bars]));
      out.push(list.map(([type, bars]) => [type, type === 'verse' && bars > 8 ? bars / 2 : bars]));
      return out.filter(l => l.length <= 24 && l.reduce((t, [, b]) => t + b, 0) <= 256);
    };
    for (let guard = 0; guard < 12; guard++) {
      const best = variants(plan).reduce((a, b) => (score(b) < score(a) ? b : a), plan);
      if (score(best) >= score(plan) - 4) break;
      plan = best;
    }

    const id = `auto-${seed.toString(36)}`, sections = [];
    let at = 0;
    const energy = { intro: 55, verse: 62, prechorus: 76, chorus: 90, bridge: 55, solo: 82, outro: 60 };
    // Corba d'energia: cada estrofa i cada tornada una mica més plenes que l'anterior.
    const seen = {};
    plan.forEach(([type, bars], i) => {
      const n = seen[type] = (seen[type] || 0) + 1, grow = type === 'verse' ? (n - 1) * 6 : type === 'chorus' ? (n - 1) * 3 : 0;
      sections.push({ id: `${id}-s${i + 1}`, type, start: at, bars, lyrics: '', energy: Math.min(100, energy[type] + grow + (type === 'chorus' && i > plan.length - 4 ? 6 : 0)) });
      at += bars;
    });
    settings.bars = at;
    const of = type => sections.filter(s => s.type === type), lastChorus = of('chorus').at(-1);
    // ── Moviments propis del subgènere (tempo, to, ritme) ─────────────
    const tempo = (sec, factor) => { if (sec) sec.bpm = Math.max(40, Math.min(240, Math.round(bpm * factor))); };
    // Canvis de tempo suaus (els salts grans sonaven bruscos): com a molt un 7 %. Per sonar
    // «més lent» sense canviar de tempo, la bateria i el baix van a mig temps.
    if (key === 'jamaican') { tempo(sections[0], .94); }
    // Rocksteady: estrofes amb cops d'aro en lloc de charles (sense platets); horror punk: intro de toms sense platets.
    if (key === 'rocksteady') { tempo(of('bridge')[0], .93); tempo(of('outro')[0], .95); of('verse').forEach(s => { s.cymbals = 'rim'; }); }
    if (key === 'horrorpunk') sections[0].cymbals = 'none';
    // Un altre ritme de bateria a la segona estrofa (de vegades), com fa «Dona-li varietat».
    const drumCount = engine.SONG_GROOVES[sg.style].drums.length;
    if (of('verse').length > 1 && key !== 'hardcore' && r() < .5) of('verse')[1].groove = { drums: (groove.drums + 1 + Math.floor(r() * (drumCount - 1))) % drumCount };
    if (key === 'jamaican') of('bridge').forEach(s => { s.cymbals = 'hats'; });
    if (key === 'twotone' || key === 'punk77') sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; });
    if (key === 'skapunk') { const b = of('bridge')[0] || of('solo')[0]; if (b) b.feel = { drums: .5 }; tempo(lastChorus, 1.04); sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 1; }); }
    if (key === 'hardcore') { of('chorus').forEach(s => { s.groove = { drums: 3 }; }); const b = of('bridge')[0]; if (b) b.feel = { drums: .5, bass: .5 }; }
    if (key === 'poppunk') { of('prechorus').forEach(s => tempo(s, 1.04)); const b = of('bridge')[0]; if (b) b.feel = { drums: .5 }; sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; }); }
    if (key === 'horrorpunk') { sections[0].feel = { drums: .5, bass: .5 }; const b = of('bridge')[0]; if (b) b.feel = { drums: .5 }; }
    // Punk: de vegades una segona bateria a contratemps a partir de la segona tornada.
    if (['punk77', 'hardcore', 'horrorpunk'].includes(key) && r() < .55) of('chorus').slice(1).forEach(s => { s.offbeat = true; });
    const harmony = {};
    for (const type of new Set(sections.map(s => s.type))) harmony[type] = 1 + Math.floor(r() * 5);

    // ── Arranjament: el riff identifica la cançó; els vents responen a la veu ──
    const register = key === 'rocksteady' || key === 'horrorpunk' ? -1 : key === 'poppunk' ? 1 : 0;
    const base = sg.base, layersOf = [];
    const add = (sec, instrument, extra = {}) => { if (!base.includes(instrument)) layersOf.push({ sec, instrument, ...extra }); };
    let verses = 0;
    for (const sec of sections) {
      const sing = vocal && ['verse', 'prechorus', 'chorus'].includes(sec.type) || vocal && key === 'horrorpunk' && sec.type === 'bridge';
      if (sing) add(sec, 'vocal', register ? { register } : {});
      if (!punk) {
        if (sec.type === 'intro' || sec.type === 'outro') { add(sec, 'trumpet', { line: 'riff' }); add(sec, 'trombone', { line: 'riff' }); if (key !== 'rocksteady') add(sec, 'sax', { line: 'riff' }); }
        if (sec.type === 'verse') { verses++; add(sec, 'organ', { revision: 2 }); if (verses > 1) add(sec, 'trumpet', { line: 'answer' }); }
        if (sec.type === 'prechorus') add(sec, 'trombone', { line: 'answer' });
        if (sec.type === 'chorus') {
          add(sec, 'trumpet', { line: 'riff' }); add(sec, 'trombone', { line: 'riff' });
          if (key !== 'rocksteady') add(sec, 'sax', { line: 'riff' });
          if (key === 'skapunk') add(sec, 'guitar2', { fx: { type: 'distortion', drive: 65, tone: 55 }, revision: 2 });
        }
        if (sec.type === 'solo') { add(sec, key === 'twotone' ? 'trumpet' : 'sax'); add(sec, 'guitar3', { revision: 1 + Math.floor(r() * 5) }); }
        if (sec.type === 'bridge') { if (key === 'rocksteady') add(sec, 'synthPad', { revision: 1 }); else add(sec, 'trombone'); if (key === 'skapunk') add(sec, 'guitar3', { revision: 4, fx: { type: 'crunch', drive: 40, tone: 50 } }); }
      } else {
        if (sec.type === 'intro') { add(sec, 'guitar3', { line: 'riff' }); if (key === 'horrorpunk') add(sec, 'organ', { revision: 3 }); }
        if (sec.type === 'verse') {
          verses++;
          // Sense la segona guitarra les estrofes perdien força (comentaris de les cançons).
          if (key !== 'poppunk' || verses > 1) add(sec, 'guitar2', { revision: 2 });
          if (key === 'poppunk') add(sec, 'guitar3', { revision: 1, fx: { type: 'none', drive: 50, tone: 50 } }); else if (verses > 1) add(sec, 'guitar3', { line: 'answer' });
        }
        if (sec.type === 'prechorus') add(sec, 'guitar2', { revision: 2 });
        if (sec.type === 'chorus') { add(sec, 'guitar2', { revision: 2 }); if (key !== 'hardcore') add(sec, 'guitar3', { line: 'riff' }); }
        if (sec.type === 'bridge') {
          if (key === 'hardcore') add(sec, 'guitar2', { fx: { type: 'metal', drive: 80, tone: 50 } });
          if (key === 'horrorpunk') add(sec, 'organ', { revision: 3 });
          if (key === 'poppunk') add(sec, 'guitar3', { revision: 3, fx: { type: 'none', drive: 50, tone: 50 } });
        }
        if (sec.type === 'outro') { add(sec, 'guitar3', { line: 'riff' }); add(sec, 'guitar2', { revision: 2 }); }
      }
    }
    // ── Millor versió de cada línia pròpia (la mateixa per a seccions iguals) ──
    const partFor = (sec, layers, extra, h = harmony[sec.type] || 1) => {
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy ?? TYPES[sec.type].energy, revision: h,
        groove: { ...groove, ...(sec.groove || {}) }, instruments: [...base, ...Object.keys(layers)], layers };
      if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (h - 1) % 5;
      for (const field of ['bpm', 'transpose', 'feel']) if (sec[field] !== undefined) part[field] = sec[field];
      if (extra?.register) part.register = extra.register;
      return part;
    };
    // ── Harmonia: es proven diverses combinacions i es queda la que dona més forma a la cançó ──
    const kinds = Object.keys(harmony);
    let bestHarmony = { ...harmony }, bestForm = -Infinity;
    for (let c = 0; c < 8; c++) {
      const trial = c === 0 ? { ...harmony } : Object.fromEntries(kinds.map(type => [type, 1 + Math.floor(r() * 5)]));
      const chordsOf = type => {
        const sec = of(type)[0];
        return sec ? engine.composeSongPart(settings, { ...partFor(sec, {}, null, trial[type]), instruments: [] }).chords.map(ch => ch.symbol || ch.pcs.join('-')) : null;
      };
      const form = harmonyScore(chordsOf);
      if (form > bestForm) { bestForm = form; bestHarmony = trial; }
    }
    Object.assign(harmony, bestHarmony);

    // ── Millor versió de cada línia pròpia (la mateixa per a seccions iguals) ──
    // Cada candidata es puntua dins de la seva secció: amb els acords i amb les
    // línies que ja hi sonen (riffs i línies triades abans), per evitar xocs.
    // La veu de la tornada, a més, ha de quedar per sobre de la de l'estrofa.
    const chosen = new Map(), clips = [], revisions = [], voiceMean = {};
    let quality = 0, judged = 0;
    layersOf.forEach((layer, i) => {
      let revision = layer.revision;
      if (revision === undefined && MELODIC.includes(layer.instrument) && !layer.line) {
        const memo = `${layer.instrument}:${layer.sec.type}`;
        if (chosen.has(memo)) revision = chosen.get(memo);
        else {
          const company = layersOf.map((o, j) => [o, j]).filter(([o, j]) => o.sec === layer.sec && o.instrument !== layer.instrument
            && (MELODIC.includes(o.instrument) || o.line) && (o.line === 'riff' || j < i));
          const layers = Object.fromEntries(company.map(([o, j]) => [o.instrument, revisions[j] || 1]));
          const lineModes = Object.fromEntries(company.filter(([o]) => o.line).map(([o]) => [o.instrument, o.line]));
          let best = -Infinity, bestLine = null;
          for (let rev = 1; rev <= 30; rev++) {
            const part = partFor(layer.sec, { ...layers, [layer.instrument]: rev }, layer);
            if (Object.keys(lineModes).length) part.lineModes = lineModes;
            const spec = engine.composeSongPart(settings, part), line = spec.lines[layer.instrument];
            const others = Object.entries(spec.lines).filter(([name]) => name !== layer.instrument).map(([, l]) => l);
            let score = lineScore(line, { chords: spec.chords, others });
            if (layer.instrument === 'vocal' && layer.sec.type === 'chorus' && voiceMean.verse !== undefined) score += mean(line) >= voiceMean.verse + 2 ? 1.5 : -1.5;
            if (score > best) { best = score; revision = rev; bestLine = line; }
          }
          chosen.set(memo, revision); quality += best; judged++;
          if (layer.instrument === 'vocal' && bestLine) voiceMean[layer.sec.type] = mean(bestLine);
        }
      }
      revisions[i] = revision;
      const clip = { id: `${id}-c${i + 1}`, instrument: layer.instrument, start: layer.sec.start, bars: layer.sec.bars, revision: revision || 1, generated: true };
      for (const field of ['line', 'fx', 'register', 'feel']) if (layer[field] !== undefined) clip[field] = layer[field];
      clips.push(clip);
    });
    const words = TITLES[key === 'horrorpunk' ? 'horror' : punk ? 'punk' : 'ska'];
    const title = `${pick(words[0])} ${pick(words[1])}`;
    const song = { version: 3, title, settings, base: { instruments: base.slice(), revision: 1 + Math.floor(r() * 50), generated: true }, harmony, sections, clips };
    // Si alguna secció s'alenteix, s'hi afegeix un instrument que sosté el so.
    reinforceSlowdowns(song);
    // ── Inici, final i silencis: una manera diferent a cada cançó ──
    const revisionsOf = Object.fromEntries(MELODIC.map(name => [name, chosen.get(`${name}:intro`) || chosen.get(`${name}:verse`) || chosen.get(`${name}:chorus`) || 1]));
    // Recursos especials: només els que aporten més en aquesta cançó (vegeu planHighlights).
    const highlights = planHighlights(song, key, r, { vocal });
    if (highlights.stop) highlights.stop.ending = 'stop';
    designEdges(engine, song, { seed: Math.floor(r() * 4294967295) + 1, vocal, revisions: revisionsOf, opening: highlights.opening, closing: highlights.closing, middle: highlights.middle });
    if (highlights.color) {
      const clip = song.clips.find(c => c.instrument === highlights.color.instrument && c.start <= highlights.color.where.start && c.start + c.bars > highlights.color.where.start);
      if (clip) clip.color = highlights.color.color;
    }
    // Puntuació de la cançó: forma harmònica, qualitat mitjana de les línies i varietat d'inici, final i silencis.
    const rating = bestForm + quality / Math.max(1, judged) + 
      // Premia que els recursos aplicats encaixin bé (no que n'hi hagi molts).
      + (highlights.chosen.length ? .3 * highlights.chosen.reduce((t, c) => t + c.value, 0) / highlights.chosen.length : .2);
    return { song, score: rating };
  }
  // ── Transicions i densitat (a partir dels comentaris de les cançons) ──
  // Quan la cançó s'alenteix d'una secció a l'altra, s'hi afegeix un instrument que
  // sosté el so (guitarra 2 al punk, orgue sostingut a l'ska o coixí si l'orgue ja
  // és a la base) perquè el canvi no buidi la cançó.
  function reinforceSlowdowns(song) {
    const st = song.settings, sections = [...song.sections].sort((a, b) => a.start - b.start), added = [];
    const inside = (c, sec) => c.start < sec.start + sec.bars && sec.start < c.start + c.bars;
    sections.forEach((sec, i) => {
      const prev = sections[i - 1];
      if (!prev || (sec.bpm || st.bpm) >= (prev.bpm || st.bpm) * .95) return;
      const instrument = st.style === 'punk' ? 'guitar2' : song.base.instruments.includes('organ') ? 'synthPad' : st.style === 'ska' ? 'organ' : 'synthPad';
      if (song.base.instruments.includes(instrument) || song.clips.some(c => c.instrument === instrument && inside(c, sec))) return;
      song.clips.push({ id: `slow-${instrument}-${sec.id}`.slice(0, 64), instrument, start: sec.start, bars: sec.bars,
        revision: instrument === 'organ' ? 3 : instrument === 'guitar2' ? 2 : 1, generated: true });
      added.push({ section: sec, instrument });
    });
    return added;
  }
  // Pes sonor de cada instrument dins de la banda (les guitarres distorsionades pesen més).
  const WEIGHT = { drums: 3, electronicDrums: 3, bass: 2, synthBass: 2, guitar: 2, guitar2: 2, guitar3: 1.5, trumpet: 1.2, trombone: 1.2, sax: 1.2,
    organ: 1, synthPad: 1, synthLead: 1, vocal: .8 };
  const CLEAN_FX = ['none', 'boost', 'tape', 'lofi'];
  function sectionWeight(song, sec) {
    const mute = sec.mute || [], st = song.settings;
    const loud = name => ['guitar', 'guitar2'].includes(name) && st.fx?.[name] && !CLEAN_FX.includes(st.fx[name].type);
    const weight = name => (WEIGHT[name] || 1) + (loud(name) ? 1 : 0);
    let total = song.base.instruments.filter(name => !mute.includes(name)).reduce((t, name) => t + weight(name), 0);
    const seen = new Set();
    for (const c of song.clips) {
      if (!c.generated || mute.includes(c.instrument) || !(c.start < sec.start + sec.bars && sec.start < c.start + c.bars)) continue;
      // Cada presa de guitarra 1 o 2 suma; la resta d'instruments, un cop.
      if (['guitar', 'guitar2'].includes(c.instrument) || !seen.has(c.instrument)) { total += weight(c.instrument); seen.add(c.instrument); }
    }
    return total;
  }
  // Si en una secció en desapareixen instruments (sobretot guitarres fortes), la resta puja una mica:
  // fins a 3 dB, segons el pes que falta respecte de la secció més plena de la cançó.
  function densityBoost(song, sec) {
    const weight = sectionWeight(song, sec), full = Math.max(...song.sections.map(s => sectionWeight(song, s)));
    if (!weight || weight >= full) return 0;
    return Math.min(3, Math.round(5 * Math.log10(full / weight)));
  }

  // ── Comentaris de les cançons i informe per analitzar-les ─────────
  // Cada comentari és de tota la cançó (bar null) o d'un compàs concret, amb
  // un tema i una valoració. L'informe exportat recull, per a cada cançó, la
  // puntuació, els comentaris situats (secció, compàs i segon), un resum de les
  // decisions del taller (estructura, recursos especials, efectes...) i el
  // projecte complet per poder-la reproduir exactament.
  const COMMENT_TAGS = { general: 'General', opening: 'Inici', closing: 'Final', silence: 'Silencis i aturades', fade: 'Fosos',
    color: 'Efectes de so', melody: 'Melodia', vocal: 'Veu', harmony: 'Acords', rhythm: 'Ritme i bateria', bass: 'Baix',
    guitar: 'Guitarres', horns: 'Vents', mix: 'Mescla i volums', structure: 'Estructura', other: 'Altres' };
  const COMMENT_MOODS = { good: '👍 M’agrada', bad: '👎 Cal millorar', idea: '💡 Idea' };
  const COMMENT_MAX = 200, COMMENT_TEXT = 1000;
  function cleanComments(list, bars) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.filter(c => c && typeof c === 'object' && typeof c.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(c.id) && !seen.has(c.id)
      && typeof c.text === 'string' && c.text.trim() && Object.hasOwn(COMMENT_TAGS, c.tag) && Object.hasOwn(COMMENT_MOODS, c.mood)
      && (c.bar === null || Number.isInteger(c.bar)) && seen.add(c.id))
      .slice(0, COMMENT_MAX)
      .map(c => ({ id: c.id, text: c.text.trim().slice(0, COMMENT_TEXT), bar: c.bar === null ? null : Math.max(0, Math.min(bars - 1, c.bar)),
        tag: c.tag, mood: c.mood, created: Number.isFinite(c.created) ? c.created : 0 }));
  }
  const NOTE_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  // Segon de la cançó on comença un compàs (segueix els canvis de tempo de les seccions).
  function secondsAtBar(song, bar) {
    let t = 0;
    for (let b = 0; b < bar; b++) { const sec = song.sections.find(s => b >= s.start && b < s.start + s.bars); t += 240 / (sec?.bpm || song.settings.bpm); }
    return t;
  }
  function describeSong(engine, song) {
    const st = song.settings, sections = [...song.sections].sort((a, b) => a.start - b.start);
    const typeOf = bar => sections.find(s => bar >= s.start && bar < s.start + s.bars);
    const label = sec => sec ? `${engine.SONG_PARTS[sec.type]?.name || sec.type} (compassos ${sec.start + 1}–${sec.start + sec.bars})` : 'Base sola';
    const fields = ['bpm', 'transpose', 'energy', 'ending', 'closing', 'fade', 'mute', 'entrance', 'exit', 'feel', 'cymbals', 'groove', 'patterns', 'timbres'];
    const instruments = {};
    for (const c of song.clips) instruments[c.instrument] = (instruments[c.instrument] || 0) + 1;
    return {
      subgenre: engine.SUBGENRES[st.subgenre]?.name || st.style, style: st.style, bpm: st.bpm, key: `${NOTE_NAMES[st.tonic]} ${st.mode === 'major' ? 'major' : 'menor'}`,
      seconds: Math.round(secondsAtBar(song, st.bars)), bars: st.bars, base: song.base.instruments.slice(),
      sections: sections.map(sec => Object.assign({ where: label(sec), type: sec.type, lyrics: !!sec.lyrics?.trim() },
        ...fields.filter(f => sec[f] !== undefined).map(f => ({ [f]: sec[f] })))),
      instruments,
      resources: {
        opening: song.edges?.opening ?? null, closing: song.edges?.closing ?? null, middle: song.edges?.middle ?? null,
        stops: sections.filter(s => s.ending === 'stop').map(label),
        silences: sections.filter(s => ['break', 'silence'].includes(s.ending)).map(label),
        fades: sections.filter(s => s.fade).map(s => `${s.fade === 'in' ? 'entrada' : 'sortida'}: ${label(s)}`),
        colors: song.clips.filter(c => c.color).map(c => `${c.instrument} · ${engine.COLOR_FX[c.color] || c.color} · ${label(typeOf(c.start))}`)
      },
      where: bar => bar === null ? 'Tota la cançó' : `${label(typeOf(bar))} · compàs ${bar + 1} · ${Math.floor(secondsAtBar(song, bar) / 60)}:${String(Math.round(secondsAtBar(song, bar) % 60)).padStart(2, '0')}`
    };
  }
  function feedbackReport(engine, entries, now = Date.now()) {
    const songs = entries.filter(e => e && e.song).map(e => {
      const song = JSON.parse(JSON.stringify(e.song)), summary = describeSong(engine, song), where = summary.where;
      delete summary.where; delete song.libraryId;
      const comments = cleanComments(song.comments, song.settings.bars).map(c => ({ where: where(c.bar), bar: c.bar === null ? null : c.bar + 1,
        tag: COMMENT_TAGS[c.tag], mood: COMMENT_MOODS[c.mood], text: c.text, date: c.created ? new Date(c.created).toISOString() : null }));
      return { title: song.title, rating: e.rating || 0, created: e.created ? new Date(e.created).toISOString() : null, comments, summary, project: song };
    });
    return {
      format: 'skagenerator-feedback', version: 1, exported: new Date(now).toISOString(),
      about: 'Cançons del taller amb puntuació (0–5 estrelles), comentaris situats a la cançó, resum de les decisions del taller i projecte complet.',
      totals: { songs: songs.length, rated: songs.filter(s => s.rating).length, comments: songs.reduce((t, s) => t + s.comments.length, 0) },
      songs
    };
  }

  // Cançó automàtica: es componen tres candidates (amb tot el que sap fer el
  // taller) i es queda la que puntua millor.
  function createAutoSong(engine, key, options = {}) {
    const seed = (options.seed >>> 0) || 1, candidates = Math.max(1, Math.min(6, options.candidates ?? 3));
    let best = null;
    for (let k = 0; k < candidates; k++) {
      const attempt = composeAuto(engine, key, { ...options, seed: k ? (Math.imul(seed, 2246822519) + Math.imul(k, 3266489917)) >>> 0 || 1 : seed });
      if (!best || attempt.score > best.score) best = attempt;
    }
    return best.song;
  }
  return { createAutoSong, designEdges, planHighlights, reinforceSlowdowns, densityBoost, sectionWeight, cleanComments, feedbackReport, describeSong, COMMENT_TAGS, COMMENT_MOODS, lineScore, harmonyScore, OPENINGS, CLOSINGS, MIDDLES, MELODIC };
});
