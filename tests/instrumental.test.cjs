'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../radioambient.js');
const builder = require('../song-builder.js');

const SKA = Object.keys(engine.SUBGENRES).filter(key => engine.SUBGENRES[key].style === 'ska');
const LEADS = ['trumpet', 'sax', 'trombone'];
const inside = (clip, sec) => clip.start < sec.start + sec.bars && sec.start < clip.start + clip.bars;

// Part d'una secció tal com la construeix l'aplicació (instruments, capes, trams, línies i textura).
function partOf(song, sec) {
  const mute = sec.mute || [], base = song.base.instruments.filter(n => !mute.includes(n));
  const clips = song.clips.filter(c => inside(c, sec) && !mute.includes(c.instrument));
  const part = { type: sec.type, bars: sec.bars, energy: sec.energy, revision: song.harmony[sec.type] || 1, groove: { ...song.settings.groove, ...(sec.groove || {}) },
    instruments: [...new Set([...base, ...clips.map(c => c.instrument)])], layers: Object.fromEntries(clips.map(c => [c.instrument, c.revision])) };
  const lineModes = { ...Object.fromEntries(Object.entries(sec.lines || {}).filter(([n]) => base.includes(n))), ...Object.fromEntries(clips.filter(c => c.line).map(c => [c.instrument, c.line])) };
  if (Object.keys(lineModes).length) part.lineModes = lineModes;
  const ranges = {};
  for (const c of clips) (ranges[c.instrument] ||= []).push([Math.max(0, c.start - sec.start), Math.min(sec.bars, c.start + c.bars - sec.start)]);
  for (const [n, list] of Object.entries(ranges)) if (list.length === 1 && list[0][0] === 0 && list[0][1] === sec.bars) delete ranges[n];
  if (Object.keys(ranges).length) part.ranges = ranges;
  for (const field of ['texture', 'themeVariant', 'entrance', 'exit', 'bpm', 'feel', 'transpose', 'volumes']) if (sec[field] !== undefined) part[field] = sec[field];
  return part;
}
const { createPerformance } = require('../audio/performance.cjs');

test('ska instrumental: el protagonisme passa d\'un músic a l\'altre per frases, amb diàlegs i el contratemps sempre', () => {
  const textures = new Set(), roles = new Set(), orders = new Set();
  let answered = 0, nonWind = 0, solos = 0, keysWithMelody = 0, keysUnits = 0;
  for (const key of SKA) for (const seed of [3, 14, 15, 92]) {
    const song = builder.createAutoSong(engine, key, { seed, vocal: false, candidates: 1 });
    const where = `${key} ${seed}`;
    assert(!song.clips.some(c => c.instrument === 'vocal'), `${where}: cap veu`);
    assert(song.sections.every(s => !s.lyrics), `${where}: cap lletra`);
    const ordered = [...song.sections].sort((a, b) => a.start - b.start);
    orders.add(ordered.flatMap(s => s.leads.map(l => l[2])).join());
    for (const sec of ordered) {
      // Els canvis de protagonista respecten les frases: blocs de 4, 8 o 16 compassos que comencen a un múltiple de 4.
      for (const [offset, bars, role] of sec.leads) {
        roles.add(role);
        assert(offset % 4 === 0 && (bars % 4 === 0 || bars === sec.bars), `${where}: bloc ${offset}+${bars}`);
      }
      const spec = engine.composeSongPart(song.settings, partOf(song, sec)), music = createPerformance(spec);
      const lead = sec.leads[0][2];
      if (sec.texture) textures.add(sec.texture);
      if (song.clips.some(c => inside(c, sec) && c.line === 'counter')) textures.add('counter');
      if (sec.type === 'solo' && ['sax', 'trombone', 'trumpet', 'keys', 'guitar', 'bass'].includes(lead)) solos++;
      // Orgue, piano, guitarra o baix porten la melodia: la guitarra base continua fent el contratemps.
      // (Les seccions «dub» —bateria i baix sols— no tenen guitarra.)
      if (sec.leads.some(l => ['keys', 'guitar', 'bass'].includes(l[2])) && !(sec.mute || []).includes('guitar')) {
        nonWind++;
        if (song.clips.some(c => inside(c, sec) && c.line === 'answer') || Object.values(sec.lines || {}).includes('answer')) answered++;
        const skank = music.events.filter(e => e.type === 'on' && e.channel === 0);
        // (Amb swing, el contratemps cau una mica més tard de la meitat del temps.)
        const offbeat = skank.filter(e => { const f = (e.time / spec.beat) % 1; return f > .3 && f < .85; }).length;
        assert(skank.length && offbeat / skank.length > .5, `${where}: contratemps de la guitarra a la secció ${sec.type}`);
      }
      if (sec.leads.some(l => l[2] === 'keys')) {
        keysUnits++;
        if (Array.isArray(spec.lines.organ) || Array.isArray(spec.lines.piano)) keysWithMelody++;
      }
      // El tema torna a cada estrofa i tornada (excepte als passatges només rítmics).
      if (['verse', 'chorus'].includes(sec.type) && sec.leads.some(l => l[2] !== 'rhythm'))
        assert(Object.values(spec.lineModes).includes('theme') || Object.values(spec.lineModes).includes('counter'), `${where}: tema a la secció ${sec.type}`);
    }
  }
  assert.equal(keysWithMelody, keysUnits, 'quan l\'orgue o el piano són protagonistes, toquen la melodia');
  assert(solos > 0, 'hi ha solos');
  for (const texture of ['harmony', 'unison', 'counter']) assert(textures.has(texture), `textura dels vents: ${texture}`);
  for (const role of builder.LEAD_ROLES) assert(roles.has(role), `protagonista: ${role}`);
  assert(answered / nonWind > .3, `diàlegs: ${answered} de ${nonWind}`);
  assert(orders.size >= SKA.length * 4 - 2, 'l\'ordre dels protagonistes canvia d\'una cançó a l\'altra');
});

test('ska instrumental: les seccions llargues de vegades canvien de protagonista a la meitat', () => {
  let handovers = 0;
  for (const key of SKA) for (let seed = 1; seed <= 12; seed++) {
    const song = builder.createAutoSong(engine, key, { seed, vocal: false, candidates: 1 });
    for (const sec of song.sections.filter(s => s.bars >= 16 && s.leads.length === 2)) {
      const [[, a, first], [offset, b, second]] = sec.leads;
      if (offset !== sec.bars / 2) continue;
      assert.notEqual(first, second); assert.equal(a, b);
      handovers++;
    }
  }
  assert(handovers > 0, 'algun relleu a mitja secció');
});

test('motor: tema amb variacions, secció a l\'uníson o harmonitzada, contrapunt, respostes i orgue, piano i baix melòdics', () => {
  const settings = { seed: 41, style: 'ska', bpm: 132, tonic: 0, mode: 'major', subgenre: 'jamaican' };
  const part = (extra) => ({ type: 'verse', bars: 8, energy: 70, revision: 1, ...extra });
  const compose = extra => engine.composeSongPart(settings, part(extra));
  // El tema és el mateix qui el toqui (cadascú al seu registre).
  const sax = compose({ instruments: ['sax'], lineModes: { sax: 'theme' } }).lines.sax, organ = compose({ instruments: ['organ'], lineModes: { organ: 'theme' } }).lines.organ;
  assert.deepEqual(sax.map(n => [n[0], n[1], n[2] % 12]), organ.map(n => [n[0], n[1], n[2] % 12]));
  // Variacions: el tema canvia, però es reconeix (comparteix bona part de les notes).
  for (const themeVariant of [1, 2, 3]) {
    const varied = compose({ instruments: ['sax'], lineModes: { sax: 'theme' }, themeVariant }).lines.sax;
    assert.notDeepEqual(varied, sax, `variació ${themeVariant}`);
    const same = varied.filter(n => sax.some(m => m[0] === n[0] && m[1] === n[1] && m[2] === n[2])).length;
    assert(same / sax.length > .25, `variació ${themeVariant}: es reconeix el tema`);
  }
  assert.throws(() => compose({ instruments: ['sax'], lineModes: { sax: 'theme' }, themeVariant: 4 }), /Variació/);
  // Secció: a l'uníson tots fan les mateixes notes; harmonitzada, la de dalt fa el tema i les altres per sota.
  const winds = { trumpet: 'theme', sax: 'theme', trombone: 'theme' }, instruments = ['trumpet', 'sax', 'trombone'];
  const unison = compose({ instruments, lineModes: winds, texture: 'unison' }).lines;
  assert.deepEqual(unison.trombone.map(n => n[2] % 12), unison.trumpet.map(n => n[2] % 12));
  const harmony = compose({ instruments, lineModes: winds }).lines;
  assert(harmony.sax.every((n, i) => n[2] % 12 !== harmony.trumpet[i][2] % 12 || n[2] < harmony.trumpet[i][2]));
  assert.notDeepEqual(harmony.sax.map(n => n[2] % 12), harmony.trumpet.map(n => n[2] % 12));
  // Contrapunt: notes llargues de l'acord, mai a l'uníson o a l'octava de la melodia al mateix moment.
  const counter = compose({ instruments: ['sax', 'trombone'], lineModes: { sax: 'theme', trombone: 'counter' } });
  assert(counter.lines.trombone.length && counter.lines.trombone.every(n => n[3] >= 1.5 && counter.chords[n[0]].pcs.includes(n[2] % 12)));
  // Respostes: el trombó respon als silencis de l'orgue (gairebé no s'encavalquen).
  const dialog = compose({ instruments: ['organ', 'trombone'], lineModes: { organ: 'theme', trombone: 'answer' } });
  const span = n => [n[0] * 4 + n[1], n[0] * 4 + n[1] + n[3]];
  const overlap = dialog.lines.trombone.reduce((t, n) => { const [a, b] = span(n); return t + dialog.lines.organ.reduce((u, m) => { const [c, d] = span(m); return u + Math.max(0, Math.min(b, d) - Math.max(a, c)); }, 0); }, 0);
  const answerBeats = dialog.lines.trombone.reduce((t, n) => t + n[3], 0);
  assert(dialog.lines.trombone.length && overlap <= answerBeats * .3, 'la resposta va als silencis');
  // Orgue i piano amb melodia: la toquen (i no fan el seu acompanyament); el baix melòdic substitueix el patró.
  for (const name of ['organ', 'piano']) {
    const spec = compose({ instruments: [name, 'guitar'], lineModes: { [name]: 'theme' } }), music = createPerformance(spec);
    const channel = music.channels.find(c => c.instrument === name).channel;
    const played = music.events.filter(e => e.type === 'on' && e.channel === channel).map(e => e.note);
    for (const [, , pitch] of spec.lines[name]) assert(played.includes(pitch), `${name}: nota ${pitch}`);
    const plain = createPerformance(compose({ instruments: [name, 'guitar'] })).events.filter(e => e.type === 'on' && e.channel === channel).length;
    assert(played.length < plain, `${name}: sense l'acompanyament de sempre`);
  }
  const bass = compose({ instruments: ['bass'], lineModes: { bass: 'lead' } });
  assert.deepEqual(bass.bassLine.map(n => n[2]), bass.lines.bass.map(n => n[2]));
  assert(bass.bassLine.every(n => n[2] >= 36 && n[2] <= 55), 'dins del registre del baix');
});

test('amb veu, l’arranjament de ska no canvia', () => {
  const song = builder.createAutoSong(engine, 'twotone', { seed: 5, candidates: 1 });
  assert(song.clips.some(c => c.instrument === 'vocal'));
  assert.equal(song.settings.volumes.vocal, 3);
});

test('la ràdio té l’interruptor instrumental i no fa cantar les cançons instrumentals', () => {
  const fs = require('node:fs'), path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), radio = fs.readFileSync(path.join(__dirname, '..', 'radio.js'), 'utf8');
  assert.match(html, /<input type="checkbox" id="radio-instrumental">/);
  assert.match(radio, /vocal: !instrumental/);
  assert.match(radio, /const canSing = \(\) => !instrumental &&/);
  assert.match(radio, /const repertoire = instrumental \? \[\]/);
});

const PUNK = Object.keys(engine.SUBGENRES).filter(key => engine.SUBGENRES[key].style === 'punk');

test('punk instrumental: la guitarra solista fa un tema a l’estrofa, un altre a la tornada i els solos', () => {
  for (const key of PUNK) for (const [seed, guitars] of [[3, 1], [14, 2], [15, 3], [92, 2]]) {
    const song = builder.createAutoSong(engine, key, { seed, vocal: false, guitars, candidates: 1 });
    const where = `${key} ${seed}`;
    assert(!song.clips.some(c => c.instrument === 'vocal') && song.sections.every(s => !s.lyrics), `${where}: sense veu`);
    assert(song.settings.guitars >= 2, `${where}: amb guitarra solista`);
    const leadIn = sec => song.clips.find(c => inside(c, sec) && c.instrument === 'guitar3' && c.line === 'lead');
    for (const sec of song.sections.filter(s => ['verse', 'chorus'].includes(s.type))) assert(leadIn(sec), `${where}: tema a ${sec.type}`);
    const verse = song.sections.find(s => s.type === 'verse'), chorus = song.sections.find(s => s.type === 'chorus');
    assert(song.sections.some(s => ['solo', 'bridge'].includes(s.type) && leadIn(s)) || !song.sections.some(s => ['solo', 'bridge'].includes(s.type)), `${where}: solo de guitarra`);
    // El tema és una melodia de veritat (amb ritme i altures variats), no un arpegi.
    const spec = engine.composeSongPart(song.settings, { type: chorus.type, bars: chorus.bars, energy: chorus.energy, revision: song.harmony.chorus,
      instruments: [...song.base.instruments, 'guitar3'], layers: { guitar3: leadIn(chorus).revision }, lineModes: { guitar3: 'lead' } });
    const line = spec.lines.guitar3;
    assert(new Set(line.map(n => n[2])).size >= 4 && new Set(line.map(n => n[3])).size >= 2, `${where}: melodia variada`);
    assert(verse && leadIn(verse));
  }
});

test('modes de línia: cada mode només per als instruments que el poden tocar', () => {
  const settings = { seed: 5, style: 'punk', bpm: 180, tonic: 2, mode: 'major' }, part = { type: 'chorus', bars: 4, energy: 80, revision: 1 };
  assert.doesNotThrow(() => engine.composeSongPart(settings, { ...part, instruments: ['guitar3'], layers: { guitar3: 2 }, lineModes: { guitar3: 'lead' } }));
  // La melodia de solista (i el tema) també la poden portar els vents, l'orgue, el piano i el baix.
  for (const name of ['trumpet', 'organ', 'piano', 'bass']) assert.doesNotThrow(() => engine.composeSongPart(settings, { ...part, instruments: [name], lineModes: { [name]: 'lead' } }), name);
  assert.throws(() => engine.composeSongPart(settings, { ...part, instruments: ['guitar'], lineModes: { guitar: 'lead' } }), /Mode de línia/);
  assert.throws(() => engine.composeSongPart(settings, { ...part, instruments: ['bass'], lineModes: { bass: 'counter' } }), /Mode de línia/);
  assert.throws(() => engine.composeSongPart(settings, { ...part, instruments: ['bass'], lineModes: { bass: 'answer' } }), /Mode de línia/);
  const { createPerformance } = require('../audio/performance.cjs');
  const spec = engine.composeSongPart(settings, { ...part, instruments: ['guitar', 'guitar3'], layers: { guitar3: 2 }, lineModes: { guitar3: 'lead' } });
  const notes = createPerformance(spec).events.filter(e => e.type === 'on' && e.channel === 15);
  // Cada nota de la melodia té el seu atac (les octaves i les dobles cordes sonen al mateix moment).
  const onsets = [];
  for (const e of notes.sort((a, b) => a.time - b.time)) if (!onsets.length || e.time - onsets.at(-1) > .012) onsets.push(e.time);
  assert.equal(onsets.length, spec.lines.guitar3.length, 'la guitarra solista toca la melodia nota a nota');
});

test('amb veu, el punk no canvia', () => {
  const song = builder.createAutoSong(engine, 'punk77', { seed: 5, guitars: 1, candidates: 1 });
  assert.equal(song.settings.guitars, 1);
  assert(!song.clips.some(c => c.line === 'lead'));
});

test('punk: tema de la guitarra solista desenvolupat, octaves o dobles cordes, bends i dues guitarres a l’última tornada', () => {
  const { createPerformance } = require('../audio/performance.cjs');
  const settings = { seed: 5, style: 'punk', bpm: 180, tonic: 2, mode: 'major', subgenre: 'eastbay' };
  const sp = (extra = {}, seed = 5) => engine.composeSongPart({ ...settings, seed }, { type: 'verse', bars: 8, energy: 70, revision: 2, instruments: ['guitar', 'guitar3'], layers: { guitar3: 3 }, lineModes: { guitar3: 'lead' }, ...extra });
  // Pregunta-resposta: els compassos 3-4 repeteixen el ritme dels compassos 1-2.
  const line = sp().lines.guitar3, rhythm = (from, to) => line.filter(n => n[0] >= from && n[0] < to).map(n => [n[0] - from, n[1], n[3]]);
  assert.deepEqual(rhythm(2, 4), rhythm(0, 2));
  // Octaves o dobles cordes en alguna secció, i bends que tornen a zero.
  let doubled = 0, bends = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const music = createPerformance(sp({}, seed)), ons = music.events.filter(e => e.type === 'on' && e.channel === 15);
    const at = new Map(); for (const e of ons) at.set(Math.round(e.time * 100), (at.get(Math.round(e.time * 100)) || 0) + 1);
    if ([...at.values()].some(n => n > 1)) doubled++;
    const pitch = music.events.filter(e => e.type === 'pitch' && e.channel === 15);
    if (pitch.some(e => e.value < 4000)) bends++;
    assert(pitch.every(e => e.value >= 0 && e.value <= 16383));
  }
  assert(doubled >= 4 && bends >= 4, `octaves/dobles ${doubled}, bends ${bends}`);
  // Última tornada: una segona guitarra solista una tercera per sota, a l'altre costat.
  const shout = createPerformance(engine.composeSongPart(settings, { type: 'chorus', bars: 4, energy: 95, revision: 1, instruments: ['guitar', 'guitar3'], layers: { guitar3: 2 }, lineModes: { guitar3: 'lead' }, shout: true }));
  const second = shout.channels.find(c => c.instrument === 'guitar3' && c.channel !== 15);
  assert(second && Math.abs(second.pan - shout.channels.find(c => c.channel === 15).pan) > 40, 'segona solista oberta');
  const first = shout.events.filter(e => e.type === 'on' && e.channel === 15), harm = shout.events.filter(e => e.type === 'on' && e.channel === second.channel);
  assert(harm.length > 0 && harm.every(h => first.some(f => Math.abs(f.time - h.time) < .03 && [3, 4, 12, 15, 16].includes(f.note - h.note))), 'harmonia en terceres');
});

test('harmonia punk: cromatismes al hardcore, iv menor al pop-punk, pedal de tònica i pujades de to', () => {
  const symbols = (key, mode, tonic) => {
    const out = new Set();
    for (let rev = 1; rev <= 6; rev++) for (const type of ['verse', 'chorus', 'prechorus', 'bridge'])
      engine.composeSongPart({ seed: 3, style: 'punk', bpm: 190, tonic, mode, subgenre: key }, { type, bars: 4, energy: 70, revision: rev, instruments: ['bass'] }).chords.forEach(c => out.add(c.symbol));
    return out;
  };
  assert(symbols('hardcore', 'minor', 11).has('bII'));
  assert(symbols('poppunk', 'major', 2).has('iv'));
  // Pedal: el baix es queda a la tònica encara que canviïn els acords.
  const pedal = engine.composeSongPart({ seed: 3, style: 'punk', bpm: 180, tonic: 2, mode: 'major', subgenre: 'poppunk' }, { type: 'verse', bars: 4, energy: 60, revision: 1, instruments: ['bass'], pedal: true });
  assert(new Set(pedal.chords.map(c => c.root % 12)).size > 1);
  assert(pedal.bassLine.every(n => [2, 9].includes(n[2] % 12)), 'baix a la tònica (o la seva quinta)');
  // Pujades de to a l'última tornada als subgèneres que no en tenien.
  let lifts = 0, pedals = 0;
  for (const key of ['skatepunk', 'garage', 'hardcore', 'postpunk', 'horrorpunk']) for (let seed = 1; seed <= 6; seed++) {
    const song = builder.createAutoSong(engine, key, { seed: seed * 19, guitars: 2, minutes: 3 });
    if (song.sections.some(s => s.transpose)) lifts++;
    if (song.sections.some(s => s.pedal)) pedals++;
  }
  assert(lifts >= 4, `pujades de to: ${lifts} de 30`);
  assert(pedals >= 1);
});
