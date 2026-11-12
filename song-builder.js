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

  // ── Guitarres del punk ───────────────────────────────────────────────
  // 1: només la rítmica (la de la base); 2: rítmica i solista (guitarra 3, que fa el riff
  // i les respostes); 3: dues rítmiques (guitarra 1 i 2) i solista.
  const GUITAR_SETUPS = { 1: 'una guitarra (rítmica)', 2: 'dues guitarres (rítmica i solista)', 3: 'tres guitarres (dues rítmiques i solista)' };
  function excludedBy(song) {
    const n = song?.settings?.style === 'punk' ? song.settings.guitars : undefined;
    return new Set(n === 1 ? ['guitar2', 'guitar3'] : n === 2 ? ['guitar2'] : []);
  }

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
    nutty: { open: { riff: .8, voice: .6, drums: .6, countin: .55, buildup: .5 }, close: { hit: .8, cold: .7, riff: .6, ritard: .55, ring: .5 }, silence: .6, stop: .8, color: .6 },
    bossreggae: { open: { riddim: .85, fadein: .7, riff: .6, drums: .5 }, close: { fadeout: .9, riff: .6, ritard: .5, hit: .4 }, silence: .3, stop: .4, color: .7 },
    skaswing: { open: { riff: .8, drums: .75, buildup: .65, countin: .5 }, close: { hit: .85, ring: .7, ritard: .65, riff: .5 }, silence: .5, stop: .75, color: .5 },
    skapunk: { open: { drums: .7, halftime: .65, buildup: .6, riff: .6, countin: .5 }, close: { cold: .8, ring: .7, hit: .7, breakdown: .35 }, silence: .7, stop: .7, color: .45 },
    punk77: { open: { countin: .8, drums: .7, riff: .7, voice: .45, buildup: .4 }, close: { hit: .8, cold: .8, ring: .6 }, silence: .6, stop: .7, color: .45 },
    hardcore: { open: { countin: .8, drums: .7, riff: .5 }, close: { cold: .9, hit: .7, ring: .4 }, silence: .8, stop: .75, color: .25 },
    poppunk: { open: { riff: .8, voice: .7, buildup: .6, drums: .6, countin: .4 }, close: { ring: .8, hit: .7, cold: .55, riff: .5, ritard: .4 }, silence: .7, stop: .6, color: .55 },
    horrorpunk: { open: { drums: .7, riff: .7, voice: .6, buildup: .6, fadein: .5 }, close: { ring: .8, cold: .7, ritard: .6, breakdown: .5 }, silence: .6, stop: .55, color: .65 }
  };
  const THRESHOLD = .55;
  function planHighlights(song, key, r, options = {}) {
    const fit0 = FIT[key] || FIT.twotone, sections = song.sections, st = song.settings, excluded = excludedBy(song);
    // Sense guitarra solista (punk amb una o dues guitarres), no hi ha riff sol a l'inici ni al final.
    const noRiff = st.style === 'punk' && excluded.has('guitar3');
    const without = table => Object.fromEntries(Object.entries(table).filter(([name]) => !(noRiff && name === 'riff')));
    const fit = { ...fit0, open: without(fit0.open), close: without(fit0.close) };
    const first = sections[0], last = sections.at(-1), outro = last.type === 'outro', punk = st.style === 'punk';
    const seconds = sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || st.bpm), 0);
    const budget = seconds < 150 ? 2 : seconds < 210 ? 3 : 4;
    const vary = () => .8 + r() * .4; // una mica d’atzar perquè no sigui sempre el mateix
    const best = (table, context) => Object.entries(table).map(([name, v]) => [name, v * context(name) * vary()]).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const candidates = [];
    // Si la cançó comença directament per la tornada, no es buida: com a molt, compte de baquetes.
    const openTable = first.type === 'intro' ? fit.open : { countin: fit.open.countin || .5 };
    const [opening, openValue] = best(openTable, name => ({
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
        ...(excluded.has(riffer) ? [] : [{ where: first, instrument: riffer, color: punk ? (r() < .5 ? 'radio' : 'megaphone') : (r() < .6 ? 'gramophone' : 'radio'),
          value: fit.color * (plan.opening === 'riff' ? 1.2 : first.bars >= 8 ? .8 : .6) * vary() }]),
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
  const LAYER_ORDER = ['drums', 'electronicDrums', 'bass', 'synthBass', 'guitar', 'organ', 'piano', 'synthPad', 'guitar2', 'guitar3', 'trumpet', 'trombone', 'sax', 'synthLead', 'vocal'];
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
    const excluded = excludedBy(song);
    const ensure = (sec, instrument, extra = {}) => {
      if (excluded.has(instrument)) return false; // p. ex. punk sense guitarra solista
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
    const minutes = Math.max(2, Math.min(4, Number(options.minutes) || 3));
    // Amb lletra enganxada, la cançó la canta (melodia de veu sempre) i en surt la forma.
    const sheet = Array.isArray(options.lyrics) ? options.lyrics.filter(s => s && engine.SONG_PARTS[s.type] && String(s.text || '').trim()) : [];
    const vocal = sheet.length ? true : options.vocal !== false;
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
    // Es proven moltes formes (catàleg de plantilles i llargades variables) i es tria la que
    // s'acosta a la durada demanada i s'assembla menys a les estructures de les últimes cançons.
    const target = minutes * 60;
    const form = sheet.length ? { plan: lyricsPlan(engine, sheet, { bpm, target, punk }), penalty: 0 }
      : chooseForm({ key, style: sg.style, bpm, target, r, recent: options.recent || [], vary: options.vary !== false });
    let plan = form.plan;
    const formPenalty = form.penalty;

    const id = `auto-${seed.toString(36)}`, sections = [];
    let at = 0;
    const energy = { intro: 55, verse: 62, prechorus: 76, chorus: 90, bridge: 55, solo: 82, outro: 60 };
    // Corba d'energia: cada estrofa i cada tornada una mica més plenes que l'anterior.
    const seen = {}, roles = new Map();
    plan.forEach(([type, bars, role, words, phraseBars], i) => {
      const n = seen[type] = (seen[type] || 0) + 1, grow = type === 'verse' ? (n - 1) * 6 : type === 'chorus' ? (n - 1) * 3 : 0;
      const sec = { id: `${id}-s${i + 1}`, type, start: at, bars, lyrics: '', energy: Math.min(100, energy[type] + grow + (type === 'chorus' && i > plan.length - 4 ? 6 : 0)) };
      // Pont trencat («breakdown»): bateria i baix a mig temps, pesant. Riff: interludi curt amb el riff de la cançó.
      if (role === 'breakdown') { sec.feel = { drums: .5, bass: .5 }; sec.energy = 80; }
      if (role === 'riff') sec.energy = 85;
      if (role) roles.set(sec, role);
      if (words) sec.lyrics = words;
      if (phraseBars) sec.phraseBars = phraseBars;
      sections.push(sec);
      at += bars;
    });
    settings.bars = at;
    const of = type => sections.filter(s => s.type === type), lastChorus = of('chorus').at(-1);
    // ── Moviments propis del subgènere (tempo, to, ritme) ─────────────
    const tempo = (sec, factor) => { if (sec) sec.bpm = Math.max(40, Math.min(240, Math.round(bpm * factor))); };
    // Canvis de tempo suaus (els salts grans sonaven bruscos): com a molt un 7 %. Per sonar
    // «més lent» sense canviar de tempo, la bateria i el baix van a mig temps.
    if (key === 'jamaican') { tempo(of('intro')[0], .94); }
    // Rocksteady: estrofes amb cops d'aro en lloc de charles (sense platets); horror punk: intro de toms sense platets.
    // Piano de la base: cada secció toca el seu patró (0 contratemps, 1 «bounce», 2 boogie, 3 llargs, 4 corxeres).
    const pianoBy = { nutty: { intro: 0, verse: 1, prechorus: 4, chorus: 4, bridge: 3, solo: 2, outro: 1 },
      skaswing: { intro: 2, verse: 2, prechorus: 0, chorus: 2, bridge: 3, solo: 2, outro: 2 }, bossreggae: { bridge: 3 } }[key];
    if (pianoBy) for (const s of sections) if (pianoBy[s.type] !== undefined) s.patterns = { ...(s.patterns || {}), piano: pianoBy[s.type] };
    // Early reggae: l'orgue fa el «bubble» tota la cançó i el final es relaxa.
    if (key === 'bossreggae') { sections.forEach(s => { s.patterns = { ...(s.patterns || {}), organ: s.type === 'bridge' ? 2 : 1 }; }); tempo(of('outro')[0], .95); }
    // Nutty: de vegades l'última tornada puja un to, com al 2-tone.
    if (key === 'nutty' && r() < .5) sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; });
    if (key === 'rocksteady') { tempo(of('bridge')[0], .93); tempo(of('outro')[0], .95); of('verse').forEach(s => { s.cymbals = 'rim'; }); }
    if (key === 'horrorpunk' && of('intro')[0]) of('intro')[0].cymbals = 'none';
    // Un altre ritme de bateria a la segona estrofa (de vegades), com fa «Dona-li varietat».
    const drumCount = engine.SONG_GROOVES[sg.style].drums.length;
    if (of('verse').length > 1 && key !== 'hardcore' && r() < .5) of('verse')[1].groove = { drums: (groove.drums + 1 + Math.floor(r() * (drumCount - 1))) % drumCount };
    if (key === 'jamaican') of('bridge').forEach(s => { s.cymbals = 'hats'; });
    if (key === 'twotone' || key === 'punk77') sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; });
    if (key === 'skapunk') { const b = of('bridge')[0] || of('solo')[0]; if (b) b.feel = { drums: .5 }; tempo(lastChorus, 1.04); sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 1; }); }
    if (key === 'hardcore') { of('chorus').forEach(s => { s.groove = { drums: 3 }; }); const b = of('bridge')[0]; if (b) b.feel = { drums: .5, bass: .5 }; }
    if (key === 'poppunk') { of('prechorus').forEach(s => tempo(s, 1.04)); const b = of('bridge')[0]; if (b) b.feel = { drums: .5 }; sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; }); }
    if (key === 'horrorpunk') { if (of('intro')[0]) of('intro')[0].feel = { drums: .5, bass: .5 }; const b = of('bridge')[0]; if (b) b.feel = { drums: .5 }; }
    // Punk: de vegades una segona bateria a contratemps a partir de la segona tornada.
    if (['punk77', 'hardcore', 'horrorpunk'].includes(key) && r() < .55) of('chorus').slice(1).forEach(s => { s.offbeat = true; });
    const harmony = {};
    for (const type of new Set(sections.map(s => s.type))) harmony[type] = 1 + Math.floor(r() * 5);

    // ── Arranjament: el riff identifica la cançó; els vents responen a la veu ──
    const register = key === 'rocksteady' || key === 'horrorpunk' ? -1 : key === 'poppunk' ? 1 : 0;
    const base = sg.base, layersOf = [];
    // Subgèneres lents: vents més escassos (sense saxo als riffs).
    const mellow = key === 'rocksteady' || key === 'bossreggae';
    // Punk: nombre de guitarres triat (1, 2 o 3); les que no hi són no s'afegeixen enlloc.
    if (punk) settings.guitars = [1, 2, 3].includes(Number(options.guitars)) ? Number(options.guitars) : 3;
    const excluded = excludedBy({ settings });
    const add = (sec, instrument, extra = {}) => { if (!base.includes(instrument) && !excluded.has(instrument)) layersOf.push({ sec, instrument, ...extra }); };
    let verses = 0;
    for (const sec of sections) {
      // Amb lletra, canten les seccions que en tenen; sense, les estrofes, pretornades i tornades.
      const sing = sheet.length ? !!sec.lyrics : vocal && ['verse', 'prechorus', 'chorus'].includes(sec.type) || vocal && key === 'horrorpunk' && sec.type === 'bridge';
      const role = roles.get(sec);
      if (role === 'riff') {
        if (punk) { add(sec, 'guitar3', { line: 'riff' }); add(sec, 'guitar2', { revision: 2 }); }
        else { add(sec, 'trumpet', { line: 'riff' }); add(sec, 'trombone', { line: 'riff' }); if (!mellow) add(sec, 'sax', { line: 'riff' }); }
        continue;
      }
      if (role === 'breakdown' && punk) { add(sec, 'guitar2', { revision: 2 }); continue; }
      if (sing) add(sec, 'vocal', register ? { register } : {});
      if (!punk) {
        if (sec.type === 'intro' || sec.type === 'outro') { add(sec, 'trumpet', { line: 'riff' }); add(sec, 'trombone', { line: 'riff' }); if (!mellow) add(sec, 'sax', { line: 'riff' }); }
        // Nutty: el piano ja omple l'estrofa i hi respon el saxo; l'orgue entra a la tornada.
        if (sec.type === 'verse') { verses++; if (key !== 'nutty') add(sec, 'organ', { revision: 2 }); if (verses > 1) add(sec, key === 'nutty' ? 'sax' : 'trumpet', { line: 'answer' }); }
        if (sec.type === 'prechorus') add(sec, 'trombone', { line: 'answer' });
        if (sec.type === 'chorus') {
          add(sec, 'trumpet', { line: 'riff' }); add(sec, 'trombone', { line: 'riff' });
          if (!mellow) add(sec, 'sax', { line: 'riff' });
          if (key === 'nutty') add(sec, 'organ', { revision: 1 });
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
      // La melodia de veu segueix la lletra de la secció (síl·labes, tòniques i versos repetits).
      if (layers.vocal !== undefined && sec.lyrics) { const info = engine.analyzeLyrics(sec.lyrics); if (info.syllables.length) Object.assign(part, info); }
      if (sec.phraseBars) part.phraseBars = sec.phraseBars;
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
    // Amb lletra, el títol és el primer vers de la tornada (o de la cançó).
    const hook = (sections.find(s => s.type === 'chorus' && s.lyrics) || sections.find(s => s.lyrics))?.lyrics.split('\n')[0].replace(/[.,;:!?¡¿«»"]+$/g, '').trim();
    const title = hook ? (hook[0].toUpperCase() + hook.slice(1)).slice(0, 60) : `${pick(words[0])} ${pick(words[1])}`;
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
    // La forma que s'assembla a les últimes cançons resta punts.
    const rating = bestForm + quality / Math.max(1, judged) - 1.5 * formPenalty + 
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
      if (excludedBy(song).has(instrument) || song.base.instruments.includes(instrument) || song.clips.some(c => c.instrument === instrument && inside(c, sec))) return;
      song.clips.push({ id: `slow-${instrument}-${sec.id}`.slice(0, 64), instrument, start: sec.start, bars: sec.bars,
        revision: instrument === 'organ' ? 3 : instrument === 'guitar2' ? 2 : 1, generated: true });
      added.push({ section: sec, instrument });
    });
    return added;
  }
  // ── Formes de cançó ────────────────────────────────────────────────
  // Plantilles: I intro, V estrofa, P pretornada, C tornada, B pont, K pont trencat a mig temps
  // («breakdown»), S instrumental (solo), R riff curt entre blocs, O final. Algunes comencen
  // directament per la tornada o no tenen pont; el punk en té més perquè és on les cançons
  // s'assemblaven més.
  const FORMS = {
    punk: ['IVCVCBCO', 'IVCVCCO', 'CVCVCBCO', 'IVPCVPCBCO', 'IVVCVCSCCO', 'IVCVCSCO', 'IVCSVCBCO', 'ICVCVCBCO', 'IVCVCBCCO',
      'IVCRVCKCO', 'VCVCKCCO', 'IVCVCKCO', 'IVVCVVCBCO', 'ICVCRVCCO', 'IVPCVPCSCO',
      'IVCVCRVCKCCO', 'IVVCVCKCCO', 'IVCVCKVCCO', 'ICVCVCKCCO', 'IVCRVCRVCBCO'],
    ska: ['IVPCVPCSCO', 'IVCVCBSCO', 'IVCVCSCO', 'ICVCSVCCO', 'IVVCSVCO', 'IVPCVPCBCO', 'IVCSVCBCO', 'IVCRVCSCO', 'IVCVCBCCO', 'IVCVCRVCSCO'],
    urban: ['IVCVCBCO', 'IVCVCCO']
  };
  const FORM_TYPES = { I: 'intro', V: 'verse', P: 'prechorus', C: 'chorus', B: 'bridge', K: 'bridge', S: 'solo', R: 'solo', O: 'outro' };
  // Semblança entre dues estructures (0 = res a veure, 1 = idèntiques): ordre de les seccions i llargades.
  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function formSimilarity(a, b) {
    if (!a.length || !b.length) return 0;
    const types = x => x.map(([t]) => t), full = x => x.map(([t, n]) => `${t}${n}`), n = Math.max(a.length, b.length);
    return .7 * (1 - editDistance(types(a), types(b)) / n) + .3 * (1 - editDistance(full(a), full(b)) / n);
  }
  // Penalització per repetir: les cançons més recents i del mateix subgènere (o estil) pesen més.
  function formPenaltyOf(plan, recent, key, style) {
    return recent.slice(0, 12).reduce((t, song, i) => {
      const weight = .85 ** i * (song.subgenre === key ? 1 : song.style === style ? .7 : .3);
      return t + weight * formSimilarity(plan, song.plan) ** 3;
    }, 0);
  }
  function chooseForm({ key, style, bpm, target, r, recent = [], vary = true }) {
    const fast = bpm >= 160, punk = style === 'punk', pick = list => list[Math.floor(r() * list.length)];
    const lengths = {
      I: fast ? [4, 4, 8] : [4, 8, 8], V: fast ? [8, 16, 16] : [8, 8, 16], P: fast ? [4, 8] : [4, 4, 8], C: fast ? [8, 16, 16] : [8, 8, 16],
      B: [8, 8, 16], K: fast ? [8, 16] : [8], S: fast ? [8, 16] : [8, 16], R: [4], O: fast ? [4, 4, 8] : [4, 8, 8]
    };
    // Gèneres: el hardcore sense pretornada i amb breakdown; el rocksteady sense solos ràpids.
    let templates = FORMS[style] || FORMS.punk;
    if (key === 'hardcore') templates = templates.filter(t => !t.includes('P'));
    if (key === 'rocksteady' || key === 'bossreggae') templates = templates.filter(t => !t.includes('R'));
    const seconds = plan => plan.reduce((t, [, bars]) => t + bars * 240 / bpm, 0);
    const candidates = [];
    for (let k = 0; k < 160; k++) {
      const template = pick(templates), sizes = {};
      // Cada tipus de secció té la mateixa llargada a tota la cançó (com en una cançó real).
      // K i R porten un paper especial: pont trencat a mig temps i riff curt entre blocs.
      const plan = [...template].map(token => [FORM_TYPES[token], sizes[token] ??= pick(lengths[token]), ...(token === 'K' ? ['breakdown'] : token === 'R' ? ['riff'] : [])]);
      // De vegades l'última tornada és doble (el doble de llarga), per acabar amb força.
      if (r() < .25) { const last = plan.map(([t]) => t).lastIndexOf('chorus'); if (plan[last][1] <= 16) plan[last] = ['chorus', plan[last][1] * 2]; }
      const total = plan.reduce((t, [, bars]) => t + bars, 0), time = seconds(plan);
      if (plan.length > 24 || total > 256 || time < 125 || time > 235) continue;
      const penalty = vary ? formPenaltyOf(plan, recent, key, style) : 0;
      // Dins de ±20 s de la durada demanada, qualsevol forma serveix: així no guanya sempre la mateixa.
      // Més de 45 s lluny de la durada demanada ja no compensa. Al punk, repetir forma pesa més.
      const off = Math.abs(time - target);
      candidates.push({ plan, penalty, template, score: Math.max(0, off - 20) / 30 + Math.max(0, off - 45) / 8 + (punk ? 6 : 4) * penalty + r() * .6 });
    }
    // Si cap forma no encaixa amb la durada, la clàssica ajustada.
    if (!candidates.length) {
      const len = fast ? 16 : 8;
      return { plan: [['intro', 4], ['verse', len], ['chorus', len], ['verse', len], ['chorus', len], ['bridge', 8], ['chorus', len], ['outro', 4]], penalty: 0 };
    }
    // La millor versió de cada plantilla, i després la millor plantilla: així totes les formes
    // tenen les mateixes opcions (abans guanyaven les que tenien més versions dins de la durada).
    const byTemplate = new Map();
    for (const c of candidates) if (!byTemplate.has(c.template) || c.score < byTemplate.get(c.template).score) byTemplate.set(c.template, c);
    return [...byTemplate.values()].map(c => ({ ...c, score: c.score + r() * .8 })).sort((a, b) => a.score - b.score)[0];
  }

  // Pes sonor de cada instrument dins de la banda (les guitarres distorsionades pesen més).
  const WEIGHT = { drums: 3, electronicDrums: 3, bass: 2, synthBass: 2, guitar: 2, guitar2: 2, guitar3: 1.5, trumpet: 1.2, trombone: 1.2, sax: 1.2,
    organ: 1, piano: 1.2, synthPad: 1, synthLead: 1, vocal: .8 };
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

  // ── Lletra enganxada abans de crear la cançó ─────────────────────────
  // Reconeix les seccions d'una lletra: per títols («Tornada:», «[Chorus]», «Estrofa 2»,
  // «Pont»…) o, si no n'hi ha, per la forma: l'estrofa que es repeteix és la tornada, una
  // estrofa curta just abans de la tornada és la pretornada i una estrofa única entre les
  // últimes tornades és el pont. Un títol de tornada sense text repeteix l'última tornada.
  const HEADINGS = [
    ['prechorus', /^(pre[\s-]*tornada|pre[\s-]*chorus|pre[\s-]*coro|pre[\s-]*estribillo)/],
    ['chorus', /^(tornada|refrany|chorus|coro|estribillo|hook)/],
    ['verse', /^(estrofa|verse|verso|vers|strophe)/],
    ['bridge', /^(pont|bridge|puente)/],
    ['intro', /^(intro|introducció|introduccion)/],
    ['outro', /^(final|outro|coda|cierre|tancament)/],
    ['solo', /^(solo|instrumental)/]
  ];
  function headingOf(line) {
    const clean = line.trim().toLowerCase().replace(/^[\[\(\*#\s]+|[\]\)\*:\s.]+$/g, '').replace(/\s*(\d+|x\s*\d+|\d+\s*x)$/, '').trim();
    if (!clean || clean.length > 24) return null;
    for (const [type, re] of HEADINGS) if (re.test(clean) && clean.replace(re, '').trim().length <= 3) return type;
    return null;
  }
  const normalLine = line => line.toLowerCase().replace(/[^a-zàèéíïòóúüç\s]/g, '').replace(/\s+/g, ' ').trim();
  function stanzaSimilarity(a, b) {
    const x = a.split('\n').map(normalLine).filter(Boolean), y = b.split('\n').map(normalLine).filter(Boolean);
    if (!x.length || !y.length) return 0;
    return x.filter(line => y.includes(line)).length / Math.max(x.length, y.length);
  }
  function parseLyricsSheet(text) {
    const blocks = [];
    let current = null;
    const close = () => { if (current && (current.lines.length || current.type)) blocks.push(current); current = null; };
    for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
      const line = raw.trim(), heading = line ? headingOf(line) : null;
      if (!line) { if (current?.lines.length) close(); continue; }
      // «Tornada x2»: la secció es repeteix.
      if (heading) { close(); current = { type: heading, lines: [], labelled: true, repeat: Math.min(4, Number(line.toLowerCase().match(/x\s*(\d)|(\d)\s*x/)?.slice(1).find(Boolean) || 1)) }; continue; }
      if (!current) current = { type: null, lines: [], labelled: false };
      current.lines.push(line);
    }
    close();
    // Títol de tornada sense text: es repeteix l'última tornada.
    let lastChorus = null;
    for (const block of blocks) {
      if (block.type === 'chorus' && !block.lines.length && lastChorus) block.lines = lastChorus.lines.slice();
      if (block.type === 'chorus' && block.lines.length) lastChorus = block;
    }
    const stanzas = blocks.filter(b => b.lines.length).flatMap(b => Array.from({ length: b.repeat || 1 }, () => ({ type: b.type, text: b.lines.join('\n'), labelled: b.labelled })));
    // Sense títols: la forma ho diu.
    const lines = st => st.text.split('\n').length;
    if (stanzas.some(st => !st.type)) {
      // Grups d'estrofes que es repeteixen (el mateix text, o gairebé).
      const groups = [];
      stanzas.forEach((st, i) => {
        if (st.type) return;
        const group = groups.find(g => stanzaSimilarity(stanzas[g[0]].text, st.text) >= .6);
        if (group) group.push(i); else groups.push([i]);
      });
      const repeated = groups.filter(g => g.length >= 2);
      if (repeated.length) {
        // La tornada és el grup repetit que tanca la cançó o, si no, el de més versos.
        const lastIndex = stanzas.length - 1;
        const chorus = repeated.find(g => g.includes(lastIndex)) || [...repeated].sort((a, b) => lines(stanzas[b[0]]) - lines(stanzas[a[0]]))[0];
        chorus.forEach(i => { stanzas[i].type = 'chorus'; });
        // Un altre grup repetit que sempre va just abans de la tornada és la pretornada.
        for (const group of repeated) if (group !== chorus && group.every(i => chorus.includes(i + 1))) group.forEach(i => { stanzas[i].type = 'prechorus'; });
      } else if (!stanzas.some(st => st.type === 'chorus')) {
        // Cap estrofa repetida: estrofa i tornada alternades (la segona estrofa fa de tornada).
        let k = 0; stanzas.forEach(st => { if (!st.type) st.type = k++ % 2 ? 'chorus' : 'verse'; });
      }
      const verseLines = stanzas.filter(st => !st.type).map(lines).sort((a, b) => b - a)[0] || 4;
      const choruses = stanzas.map((st, i) => st.type === 'chorus' ? i : -1).filter(i => i >= 0);
      stanzas.forEach((st, i) => {
        if (st.type) return;
        // Única entre les dues últimes tornades: pont (si hi ha tres tornades o més, o si no fa
        // la mateixa llargada que les estrofes; si no, és una estrofa més).
        const firstVerse = stanzas.find((o, j) => j < i && (o.type === 'verse' || !o.type) && o !== st);
        if (choruses.length >= 2 && i > choruses.at(-2) && i < choruses.at(-1) && (choruses.length >= 3 || !firstVerse || lines(firstVerse) !== lines(st))) st.type = 'bridge';
        // Curta i just abans d'una tornada: pretornada (si les estrofes són més llargues).
        else if (stanzas[i + 1]?.type === 'chorus' && lines(st) <= 2 && verseLines > 2) st.type = 'prechorus';
        else st.type = 'verse';
      });
    }
    return stanzas.map(({ type, text, labelled }) => ({ type, text, labelled }));
  }
  // Forma de la cançó a partir de la lletra: cada estrofa és una secció i cada vers una frase de
  // 2 compassos (4 si algun vers passa d'11 síl·labes), com fa la melodia de veu. Les seccions
  // d'una mateixa mena tenen la mateixa llargada. S'hi afegeix intro, final i, si la cançó queda
  // curta, un instrumental abans de l'última tornada.
  function lyricsPlan(engine, stanzas, { bpm, target, punk }) {
    const seconds = list => list.reduce((t, [, bars]) => t + bars * 240 / bpm, 0);
    const build = wide => {
      const phrase = text => wide || Math.max(...engine.analyzeLyrics(text).syllables, 0) > 11 ? 4 : 2;
      const barsOf = text => { const n = engine.analyzeLyrics(text).syllables.length; return Math.max(4, Math.min(32, Math.ceil(n * phrase(text) / 4) * 4)); };
      const size = {};
      for (const s of stanzas) size[s.type] = Math.max(size[s.type] || 0, barsOf(s.text));
      const plan = [];
      if (stanzas[0]?.type !== 'intro') plan.push(['intro', bpm >= 160 ? 4 : 8]);
      for (const s of stanzas) {
        // Més versos dels que caben en 32 compassos: es parteix en seccions iguals.
        const lines = s.text.split('\n'), per = Math.max(1, Math.floor(32 / phrase(s.text)));
        for (let k = 0; k < lines.length; k += per) {
          const chunk = lines.slice(k, k + per).join('\n');
          plan.push([s.type, lines.length > per ? barsOf(chunk) : size[s.type], undefined, chunk, wide ? 4 : undefined]);
        }
      }
      return plan;
    };
    // Lletra curta per a la durada triada: cada vers ocupa 4 compassos (frases amples).
    let plan = build(false);
    if (seconds(plan) < target * .7) plan = build(true);
    // Encara curta: instrumental abans de l'última tornada, tornada final repetida i intro llarga.
    const short = () => seconds(plan) < target - 25;
    const lastChorus = () => plan.map(([t]) => t).lastIndexOf('chorus');
    if (short() && lastChorus() > 0 && !plan.some(([t]) => t === 'solo')) plan.splice(lastChorus(), 0, ['solo', bpm >= 160 ? 16 : 8]);
    if (short() && lastChorus() > 0) plan.splice(lastChorus() + 1, 0, [...plan[lastChorus()]]);
    if (short() && plan[0][0] === 'intro' && plan[0][1] < 8) plan[0] = ['intro', 8];
    if (plan.at(-1)[0] !== 'outro') plan.push(['outro', punk ? 4 : 8]);
    return plan.slice(0, 24);
  }


  // ── Esquema per escriure la lletra ───────────────────────────────────
  // A partir de la melodia de veu de cada secció: quants versos, quantes síl·labes té cada
  // vers (una nota per síl·laba) i on cauen les tòniques (notes a temps). Les frases se
  // separen pels silencis de la melodia (respiracions de com a mínim un temps).
  function phrasesOf(notes) {
    const sorted = [...notes].sort((a, b) => a[0] * 4 + a[1] - (b[0] * 4 + b[1])), out = [];
    let current = [], end = -Infinity;
    for (const note of sorted) {
      const at = note[0] * 4 + note[1];
      if (current.length && at - end >= .9) { out.push(current); current = []; }
      current.push(note); end = at + note[3];
    }
    if (current.length) out.push(current);
    return out;
  }
  // Patró rítmic d'un vers: «TA» a les síl·labes que cauen a temps (tòniques), «ta» a la resta.
  const stressPattern = phrase => phrase.map(([, t]) => (t % 1 === 0 ? 'TA' : 'ta')).join('-');
  const phraseKey = phrase => phrase.map(([b, t, p, d]) => `${(b % 2) * 4 + t}:${p}:${d}`).join();
  function lyricsTemplate(info) {
    const lines = [`Esquema de la lletra · «${info.title}»`, `${info.style} · ${info.key} · ${info.bpm} BPM · ${info.duration}`, '',
      'Escriu un vers per línia, amb el nombre de síl·labes indicat (una nota per síl·laba).',
      'Al patró, TA és una síl·laba que cau a temps: hi va bé una síl·laba tònica.',
      'Les tornades es canten igual: fes-ne servir la mateixa lletra. Cada estrofa porta lletra nova amb el mateix patró.', ''];
    const seen = new Map(), silent = [];
    for (const sec of info.sections) {
      if (!sec.notes || !sec.notes.length) { silent.push(sec.label); continue; }
      const phrases = phrasesOf(sec.notes), shape = phrases.map(p => p.length).join('-'), pattern = phrases.map(stressPattern).join('|');
      const twin = seen.get(`${sec.type}:${pattern}`);
      lines.push(`${sec.label} (compassos ${sec.start + 1}–${sec.start + sec.bars}) · ${phrases.length} vers${phrases.length === 1 ? '' : 'os'}${sec.hasLyrics ? ' · ja té lletra' : ''}${sec.guess ? ' · sense melodia de veu (esquema orientatiu)' : ''}`);
      // Tornades iguals: la mateixa lletra. Estrofes amb el mateix patró: lletra nova amb les mateixes síl·labes.
      if (twin) {
        lines.push(sec.type === 'chorus' ? `  Igual que ${twin}: repeteix-ne la lletra.` : `  Mateix patró que ${twin} (${shape} síl·labes): escriu-hi lletra nova.`, '');
        continue;
      }
      seen.set(`${sec.type}:${pattern}`, sec.label);
      const keys = phrases.map(phraseKey);
      phrases.forEach((phrase, i) => {
        const same = keys.indexOf(keys[i]);
        lines.push(`  ${i + 1}. ${String(phrase.length).padStart(2)} síl·labes  ${stressPattern(phrase)}${same < i ? `  (melodia igual que el vers ${same + 1}: pot repetir el text)` : ''}`);
      });
      lines.push('');
    }
    if (silent.length) lines.push(`Sense veu: ${silent.join(', ')}.`, '');
    const total = info.sections.filter(s => s.notes?.length).reduce((t, s) => t + phrasesOf(s.notes).length, 0);
    lines.push(`Total: ${total} versos.`, '',
      'Per demanar la lletra a una IA: «Escriu en català la lletra d’una cançó de ' + info.style.toLowerCase() + ' que segueixi exactament aquest esquema: el mateix nombre de versos per secció i de síl·labes per vers, amb rima (AABB o ABAB) i una tornada fàcil de recordar.»');
    return lines.join('\n');
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
  return { createAutoSong, parseLyricsSheet, lyricsPlan, GUITAR_SETUPS, lyricsTemplate, phrasesOf, chooseForm, formSimilarity, designEdges, planHighlights, reinforceSlowdowns, densityBoost, sectionWeight, cleanComments, feedbackReport, describeSong, COMMENT_TAGS, COMMENT_MOODS, lineScore, harmonyScore, OPENINGS, CLOSINGS, MIDDLES, MELODIC };
});
