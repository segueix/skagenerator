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
  // Qualitat d'una línia: graus conjunts, salts compensats, registre equilibrat i poques repeticions mecàniques.
  function lineScore(notes) {
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
    return 5 * steps / n - 3 * leaps / n + 1.5 * recovered / Math.max(1, leaps) - 1.2 * stuck - Math.abs(range - 10) * .35 - Math.abs(turns / n - .35) * 2;
  }
  const TITLES = {
    ska: [['Ball', 'Nit', 'Festa', 'Passeig', 'Revetlla', 'Matinada', 'Rumbeta', 'Vermut', 'Contratemps', 'Rude boy'],
      ['al port', 'de barri', 'a la Rambla', 'sense son', 'de dissabte', 'a contratemps', 'del Raval', 'de Gràcia', 'a la platja', 'de les sis']],
    punk: [['Crits', 'Soroll', 'Ràbia', 'Fum', 'Ferro', 'Vidres', 'Ombres', 'Sirenes', 'Cendres', 'Asfalt'],
      ['de barri', 'a mitjanit', 'sense nom', 'al terrat', 'contra el vent', 'de diumenge', 'de neó', 'al metro', 'i benzina', 'a tot drap']],
    horror: [['Tombes', 'Lluna', 'Vampirs', 'Difunts', 'Calaveres', 'Espectres', 'Corbs'], ['a mitjanit', 'de cementiri', 'sense ànima', 'de Tots Sants', 'i ossos', 'al soterrani']]
  };

  function createAutoSong(engine, key, options = {}) {
    const sg = engine.SUBGENRES[key];
    if (!sg) throw new Error('Subgènere desconegut');
    const seed = (options.seed >>> 0) || 1, r = rng(seed), pick = list => list[Math.floor(r() * list.length)];
    const minutes = Math.max(2, Math.min(4, Number(options.minutes) || 3)), vocal = options.vocal !== false;
    const punk = sg.style === 'punk', TYPES = engine.SONG_PARTS;
    // Preferències: de vegades parteix d'una cançó d'aquest subgènere que t'ha agradat (★4 o més).
    const liked = (options.liked || []).filter(Boolean), model = liked.length && r() < .5 ? pick(liked).settings : null;
    let bpm = model ? model.bpm + Math.round((r() - .5) * 8) : sg.bpm[0] + Math.round(r() * (sg.bpm[1] - sg.bpm[0]));
    bpm = Math.max(sg.bpm[0], Math.min(sg.bpm[1], bpm, engine.SONG_STYLES[sg.style].bpm.max));
    const [tonic, mode] = model && sg.keys.some(([t, m]) => t === model.tonic && m === model.mode) ? [model.tonic, model.mode] : pick(sg.keys);
    const groove = model?.groove && sg.groove.drums.includes(model.groove.drums) ? { ...model.groove }
      : { drums: pick(sg.groove.drums), bass: pick(sg.groove.bass), guitar: pick(sg.groove.guitar) };
    const settings = { style: sg.style, subgenre: key, bpm, tonic, mode, seed: (seed * 2654435761 >>> 0) || 7, bars: 0, swing: sg.swing || 0,
      timbres: { guitar: 'auto', bass: 'auto', drums: 'auto', trumpet: 'auto', trombone: 'auto', vocal: 'auto', ...(sg.timbres || {}) }, groove };
    if (sg.fx) settings.fx = { guitar: { ...sg.fx }, guitar2: { ...sg.fx }, guitar3: { ...sg.fx } };
    for (const option of ['drumTune', 'humanize', 'cymbals']) if (sg[option] !== undefined) settings[option] = sg[option];
    if (settings.swing === 0) delete settings.swing;

    // ── Estructura de 2 a 4 minuts ────────────────────────────────────
    const len = bpm >= 160 ? 16 : 8, pre = ['twotone', 'poppunk', 'jamaican'].includes(key) && r() < .7;
    const middle = punk ? 'bridge' : key === 'rocksteady' ? 'bridge' : r() < .6 ? 'solo' : 'bridge';
    const block = () => [['verse', len], ...(pre ? [['prechorus', 4]] : []), ['chorus', len]];
    let plan = [['intro', key === 'jamaican' || key === 'rocksteady' ? 8 : 4], ...block(), ...block(), [middle, 8], ['chorus', len], ['outro', punk ? 4 : 8]];
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
    plan.forEach(([type, bars], i) => {
      sections.push({ id: `${id}-s${i + 1}`, type, start: at, bars, lyrics: '', energy: Math.min(100, energy[type] + (type === 'chorus' && i > plan.length - 4 ? 8 : 0)) });
      at += bars;
    });
    settings.bars = at;
    const of = type => sections.filter(s => s.type === type), lastChorus = of('chorus').at(-1);
    // ── Moviments propis del subgènere (tempo, to, ritme) ─────────────
    const tempo = (sec, factor) => { if (sec) sec.bpm = Math.max(40, Math.min(240, Math.round(bpm * factor))); };
    if (key === 'jamaican') { tempo(sections[0], .88); }
    // Rocksteady: estrofes amb cops d'aro en lloc de charles (sense platets); horror punk: intro de toms sense platets.
    if (key === 'rocksteady') { tempo(of('bridge')[0], .86); tempo(of('outro')[0], .9); of('verse').forEach(s => { s.cymbals = 'rim'; }); }
    if (key === 'horrorpunk') sections[0].cymbals = 'none';
    if (key === 'jamaican') of('bridge').forEach(s => { s.cymbals = 'hats'; });
    if (key === 'twotone' || key === 'punk77') sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; });
    if (key === 'skapunk') { const b = of('bridge')[0] || of('solo')[0]; if (b) b.feel = { drums: .5 }; tempo(lastChorus, 1.04); sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 1; }); }
    if (key === 'hardcore') { of('chorus').forEach(s => { s.groove = { drums: 3 }; }); tempo(of('bridge')[0], .5); }
    if (key === 'poppunk') { of('prechorus').forEach(s => tempo(s, 1.04)); const b = of('bridge')[0]; if (b) b.feel = { drums: .5 }; sections.filter(s => s.start >= lastChorus.start).forEach(s => { s.transpose = 2; }); }
    if (key === 'horrorpunk') { tempo(sections[0], .65); const b = of('bridge')[0]; if (b) b.feel = { drums: .5 }; }
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
        if (sec.type === 'verse') { verses++; if (key === 'poppunk') add(sec, 'guitar3', { revision: 1, fx: { type: 'none', drive: 50, tone: 50 } }); else if (verses > 1) add(sec, 'guitar3', { line: 'answer' }); }
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
    const partFor = (sec, layers, extra) => {
      const h = harmony[sec.type] || 1;
      const part = { type: sec.type, bars: sec.bars, energy: sec.energy ?? TYPES[sec.type].energy, revision: h,
        groove: { ...groove, ...(sec.groove || {}) }, instruments: [...base, ...Object.keys(layers)], layers };
      if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (h - 1) % 5;
      for (const field of ['bpm', 'transpose', 'feel']) if (sec[field] !== undefined) part[field] = sec[field];
      if (extra?.register) part.register = extra.register;
      return part;
    };
    const chosen = new Map(), clips = [];
    layersOf.forEach((layer, i) => {
      let revision = layer.revision;
      if (revision === undefined && MELODIC.includes(layer.instrument) && !layer.line) {
        const memo = `${layer.instrument}:${layer.sec.type}`;
        if (chosen.has(memo)) revision = chosen.get(memo);
        else {
          let best = -Infinity;
          for (let rev = 1; rev <= 30; rev++) {
            const spec = engine.composeSongPart(settings, partFor(layer.sec, { [layer.instrument]: rev }, layer));
            const score = lineScore(spec.lines[layer.instrument]);
            if (score > best) { best = score; revision = rev; }
          }
          chosen.set(memo, revision);
        }
      }
      const clip = { id: `${id}-c${i + 1}`, instrument: layer.instrument, start: layer.sec.start, bars: layer.sec.bars, revision: revision || 1, generated: true };
      for (const field of ['line', 'fx', 'register', 'feel']) if (layer[field] !== undefined) clip[field] = layer[field];
      clips.push(clip);
    });
    const words = TITLES[key === 'horrorpunk' ? 'horror' : punk ? 'punk' : 'ska'];
    const title = `${pick(words[0])} ${pick(words[1])}`;
    return { version: 3, title, settings, base: { instruments: base.slice(), revision: 1 + Math.floor(r() * 50), generated: true }, harmony, sections, clips };
  }
  return { createAutoSong, lineScore };
});
