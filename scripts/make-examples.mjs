// Genera les cançons d'exemple (exemples/*.json): 5 de ska i 5 de punk.
// Cada cançó està dissenyada a mà (estructura, arranjament que creix, dinàmica,
// tempo, to, efectes i lletra) i, per a cada instrument melòdic, es proven
// 60 versions i es tria la que té millor línia (contorn, encaix amb els
// acords, un sol clímax per frase, cadències i ritme ni monòton ni caòtic).
import { mkdir, writeFile } from 'node:fs/promises';
import engine from '../radioambient.js';
import builder from '../song-builder.js';

const TYPES = engine.SONG_PARTS;
const MELODIC = ['vocal', 'trumpet', 'trombone', 'sax', 'synthLead'];

// Lletra: síl·labes, síl·labes tòniques i versos repetits (com a l'app).
const lyricInfo = text => engine.analyzeLyrics(text);

// Qualitat de cada línia dins de la seva secció (acords i cadències), com a la cançó automàtica.
const { lineScore } = builder;

function build(def) {
  const id = def.slug;
  const sections = []; let at = 0;
  def.sections.forEach((s, i) => { sections.push({ id: `${id}-s${i + 1}`, start: at, lyrics: '', ...s }); at += s.bars; });
  const settings = { style: def.style, bpm: def.bpm, tonic: def.key[0], mode: def.key[1], seed: def.seed, bars: at,
    timbres: { guitar: 'auto', bass: 'auto', drums: 'auto', trumpet: 'auto', trombone: 'auto', vocal: 'auto', ...(def.timbres || {}) },
    groove: def.groove, ...(def.fx ? { fx: def.fx } : {}), ...(def.mix ? { mix: def.mix } : {}) };
  const song = { version: 3, title: def.title, settings, base: { instruments: def.base, revision: def.baseRevision || 1, generated: true },
    harmony: def.harmony, sections, clips: [] };
  // Parts del motor per a una secció (com partFor a l'app).
  const partFor = (sec, layers, register) => {
    const h = song.harmony[sec.type] || 1;
    const part = { type: sec.type, bars: sec.bars, energy: sec.energy ?? TYPES[sec.type].energy, revision: h,
      groove: { ...settings.groove, ...(sec.groove || {}) }, instruments: [...def.base, ...Object.keys(layers)], layers };
    if (['intro', 'verse', 'chorus'].includes(sec.type)) part.variantIndex = (h - 1) % 5;
    if (sec.bpm) part.bpm = sec.bpm;
    if (sec.transpose) part.transpose = sec.transpose;
    if (layers.vocal) { if (register) part.register = register; const info = lyricInfo(sec.lyrics); if (info.syllables.length) Object.assign(part, info); }
    return part;
  };
  const pickRevision = (instrument, covered, register) => {
    if (!MELODIC.includes(instrument)) return null;
    let best = 1, bestScore = -Infinity;
    for (let rev = 1; rev <= 60; rev++) {
      let score = 0;
      for (const sec of covered) {
        const spec = engine.composeSongPart(settings, partFor(sec, { [instrument]: rev }, register));
        score += lineScore(spec.lines[instrument] || [], { chords: spec.chords });
      }
      if (score > bestScore) { bestScore = score; best = rev; }
    }
    return best;
  };
  const chosen = new Map();
  def.clips.forEach((c, i) => {
    const first = sections[c.from], last = sections[c.to ?? c.from];
    const covered = sections.filter(s => s.start >= first.start && s.start <= last.start);
    // Les seccions del mateix tipus repeteixen la mateixa idea (com una tornada).
    const key = `${c.instrument}:${covered.map(s => s.type).join(',')}:${c.register || 0}`;
    const revision = c.revision ?? (chosen.has(key) ? chosen.get(key) : pickRevision(c.instrument, covered, c.register) ?? 1);
    chosen.set(key, revision);
    const clip = { id: `${id}-c${i + 1}`, instrument: c.instrument, start: first.start, bars: last.start + last.bars - first.start, revision, generated: true };
    for (const field of ['sound', 'fx', 'feel', 'register']) if (c[field] !== undefined) clip[field] = c[field];
    song.clips.push(clip);
  });
  // Comprovació: cada tram es pot compondre.
  for (const sec of sections) engine.composeSongPart(settings, partFor(sec, {}));
  return song;
}

const L = (...lines) => lines.join('\n');
const songs = [
  // ── SKA ────────────────────────────────────────────────────────────
  { slug: 'ska-rude-boys-del-raval', title: 'Rude Boys del Raval', style: 'ska', bpm: 132, key: [0, 'major'], seed: 1101,
    description: 'Ska 2-tone clàssic: guitarra a contratemps, orgue «bubble», trompeta i saxo a les tornades, veu guia amb lletra i pujada de to a l’última tornada.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 0, bass: 0, guitar: 0 }, harmony: { intro: 3, verse: 2, prechorus: 4, chorus: 1, solo: 6, outro: 2 },
    sections: [
      { type: 'intro', bars: 4 },
      { type: 'verse', bars: 8, lyrics: L('Baixo pel carrer amb sabates de xarol', 'la ciutat fa olor de mar i de cafè', 'el bus de nit ja no passa pel barri', 'però el ritme m’empeny endavant') },
      { type: 'prechorus', bars: 4, lyrics: L('Puja el volum que comença', 'tothom a la pista ara') },
      { type: 'chorus', bars: 8, lyrics: L('Rude boys del Raval', 'ballant a contratemps', 'rude boys del Raval', 'ningú no ens atura avui') },
      { type: 'verse', bars: 8, lyrics: L('La mare em diu que torni aviat', 'però la banda encara no ha acabat', 'el trombó riu i la trompeta crida', 'i jo segueixo el baix fins a l’alba') },
      { type: 'chorus', bars: 8, lyrics: L('Rude boys del Raval', 'ballant a contratemps', 'rude boys del Raval', 'ningú no ens atura avui') },
      { type: 'solo', bars: 8, energy: 80 },
      { type: 'chorus', bars: 8, energy: 95, transpose: 2, lyrics: L('Rude boys del Raval', 'ballant a contratemps', 'rude boys del Raval', 'ningú no ens atura avui') },
      { type: 'outro', bars: 4, transpose: 2 }],
    clips: [
      { instrument: 'trumpet', from: 0 }, { instrument: 'trombone', from: 0 },
      { instrument: 'organ', from: 1, revision: 2 }, { instrument: 'vocal', from: 1, to: 3 },
      { instrument: 'trumpet', from: 3 }, { instrument: 'trombone', from: 3 },
      { instrument: 'organ', from: 4, revision: 2 }, { instrument: 'vocal', from: 4, to: 5 },
      { instrument: 'trumpet', from: 5 }, { instrument: 'trombone', from: 5 },
      { instrument: 'sax', from: 6 }, { instrument: 'organ', from: 6, revision: 1 },
      { instrument: 'vocal', from: 7 }, { instrument: 'trumpet', from: 7, to: 8 }, { instrument: 'trombone', from: 7, to: 8 }, { instrument: 'sax', from: 7, to: 8 }] },

  { slug: 'ska-skatalites-al-port', title: 'Skatalites al Port', style: 'ska', bpm: 116, key: [5, 'major'], seed: 2207,
    description: 'Ska jamaicà instrumental: kit de jazz, baix caminant, trompeta, trombó gravat i saxo fent el tema, solo de saxo i pont amb la bateria a mig temps.',
    base: ['drums', 'bass', 'guitar', 'organ'], groove: { drums: 0, bass: 0, guitar: 1 }, timbres: { drums: 'jazz', trombone: 'vsco' },
    harmony: { intro: 2, verse: 4, chorus: 3, solo: 8, bridge: 5, outro: 3 },
    sections: [
      { type: 'intro', bars: 4, bpm: 100, energy: 45 },
      { type: 'verse', bars: 8, energy: 65 }, { type: 'verse', bars: 8, energy: 70 },
      { type: 'chorus', bars: 8, energy: 85 },
      { type: 'solo', bars: 16, energy: 80 },
      { type: 'bridge', bars: 8, energy: 55, feel: { drums: .5 } },
      { type: 'chorus', bars: 8, energy: 95 },
      { type: 'outro', bars: 4, bpm: 104 }],
    clips: [
      { instrument: 'trumpet', from: 0 }, { instrument: 'trumpet', from: 1, to: 2 }, { instrument: 'sax', from: 1, to: 2 },
      { instrument: 'trumpet', from: 3 }, { instrument: 'trombone', from: 3 }, { instrument: 'sax', from: 3 },
      { instrument: 'sax', from: 4 }, { instrument: 'guitar3', from: 4, revision: 3 },
      { instrument: 'trombone', from: 5 },
      { instrument: 'trumpet', from: 6, to: 7 }, { instrument: 'trombone', from: 6, to: 7 }, { instrument: 'sax', from: 6, to: 7 }] },

  { slug: 'ska-rocksteady-de-matinada', title: 'Rocksteady de Matinada', style: 'ska', bpm: 100, key: [9, 'minor'], seed: 3313,
    description: 'Rocksteady lent en La menor: one drop, baix dub, orgue de fons, trompeta amb sordina, veu guia greu i pont més lent amb coixí de sintetitzador.',
    base: ['drums', 'bass', 'guitar', 'organ'], groove: { drums: 1, bass: 1, guitar: 2 }, timbres: { trumpet: 'muted', bass: 'finger' },
    harmony: { intro: 4, verse: 3, chorus: 5, bridge: 7, outro: 4 },
    sections: [
      { type: 'intro', bars: 4, energy: 30 },
      { type: 'verse', bars: 8, energy: 45, lyrics: L('Les cinc del matí i el carrer és buit', 'el fum de l’últim cigarret se’n va', 'tu dorms encara i jo canto baixet', 'una cançó que no sap acabar') },
      { type: 'chorus', bars: 8, energy: 60, lyrics: L('Poc a poc, poc a poc', 'la nit es fa de dia', 'poc a poc, poc a poc', 'ets la meva melodia') },
      { type: 'verse', bars: 8, energy: 45, lyrics: L('El tramvia passa sense ningú', 'les gavines canten sobre el port', 'guardo la teva veu dins la butxaca', 'com una moneda de la sort') },
      { type: 'chorus', bars: 8, energy: 65, lyrics: L('Poc a poc, poc a poc', 'la nit es fa de dia', 'poc a poc, poc a poc', 'ets la meva melodia') },
      { type: 'bridge', bars: 8, bpm: 84, energy: 40, lyrics: L('Si el sol arriba massa aviat', 'deixa’m quedar una mica més') },
      { type: 'chorus', bars: 8, energy: 70, lyrics: L('Poc a poc, poc a poc', 'la nit es fa de dia', 'poc a poc, poc a poc', 'ets la meva melodia') },
      { type: 'outro', bars: 4, bpm: 92, energy: 30 }],
    clips: [
      { instrument: 'trumpet', from: 0 },
      { instrument: 'vocal', from: 1, register: -1 }, { instrument: 'vocal', from: 2, register: -1 }, { instrument: 'trumpet', from: 2 },
      { instrument: 'vocal', from: 3, register: -1 }, { instrument: 'vocal', from: 4, register: -1 }, { instrument: 'trumpet', from: 4 },
      { instrument: 'synthPad', from: 5, revision: 1 }, { instrument: 'vocal', from: 5, register: -1 },
      { instrument: 'vocal', from: 6, register: -1 }, { instrument: 'trumpet', from: 6, to: 7 }, { instrument: 'trombone', from: 6, to: 7 }] },

  { slug: 'ska-punk-a-cent-vuitanta', title: 'Ska-punk a Cent Vuitanta', style: 'ska', bpm: 168, key: [7, 'major'], seed: 4421,
    description: 'Ska-punk: estrofes a contratemps i tornades amb guitarra distorsionada, metalls a l’uníson, pont a mig temps i última tornada més ràpida i mig to amunt.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 4, bass: 4, guitar: 4 }, timbres: { drums: 'rock', bass: 'pick' },
    harmony: { intro: 5, verse: 1, chorus: 2, bridge: 3, outro: 5 },
    sections: [
      { type: 'intro', bars: 4, energy: 80 },
      { type: 'verse', bars: 8, energy: 70, lyrics: L('Corrent pel passeig amb el monopatí', 'la policia xiula i no ens pot seguir', 'tenim tres acords i una trompeta vella', 'i tota la nit per fer-la sonar') },
      { type: 'chorus', bars: 8, energy: 95, lyrics: L('Més ràpid, més fort', 'salta amb nosaltres', 'més ràpid, més fort', 'fins que caigui el sostre') },
      { type: 'verse', bars: 8, energy: 70, lyrics: L('La sala és petita i suem com mai', 'el cantant ha perdut la veu fa estona', 'però ningú no vol tornar a casa', 'mentre el bombo segueixi picant') },
      { type: 'chorus', bars: 8, energy: 95, lyrics: L('Més ràpid, més fort', 'salta amb nosaltres', 'més ràpid, més fort', 'fins que caigui el sostre') },
      { type: 'bridge', bars: 8, energy: 60, feel: { drums: .5 } },
      { type: 'chorus', bars: 8, energy: 100, bpm: 176, transpose: 1, lyrics: L('Més ràpid, més fort', 'salta amb nosaltres', 'més ràpid, més fort', 'fins que caigui el sostre') },
      { type: 'outro', bars: 4, bpm: 176, transpose: 1 }],
    clips: [
      { instrument: 'trumpet', from: 0 }, { instrument: 'sax', from: 0 },
      { instrument: 'vocal', from: 1 }, { instrument: 'vocal', from: 2 }, { instrument: 'guitar2', from: 2, fx: { type: 'distortion', drive: 65, tone: 55 } },
      { instrument: 'trumpet', from: 2 }, { instrument: 'sax', from: 2 },
      { instrument: 'vocal', from: 3 }, { instrument: 'vocal', from: 4 }, { instrument: 'guitar2', from: 4, fx: { type: 'distortion', drive: 65, tone: 55 } },
      { instrument: 'trumpet', from: 4 }, { instrument: 'sax', from: 4 },
      { instrument: 'trombone', from: 5 }, { instrument: 'guitar3', from: 5, revision: 4, fx: { type: 'crunch', drive: 40, tone: 50 } },
      { instrument: 'vocal', from: 6 }, { instrument: 'guitar2', from: 6, to: 7, fx: { type: 'distortion', drive: 75, tone: 60 } },
      { instrument: 'trumpet', from: 6, to: 7 }, { instrument: 'sax', from: 6, to: 7 }, { instrument: 'trombone', from: 6, to: 7 }] },

  { slug: 'ska-dub-de-sant-joan', title: 'Dub de Sant Joan', style: 'ska', bpm: 112, key: [2, 'minor'], seed: 5531,
    description: 'Ska amb aire dub: steppers, baix dub, guitarres amb cinta i lo-fi, bateria electrònica i sintetitzadors al pont, i un final que s’alenteix.',
    base: ['drums', 'bass', 'organ'], groove: { drums: 2, bass: 1, guitar: 3 }, timbres: { drums: 'room' }, mix: { bass: { low: 3, mid: 0, high: 0, volume: 2 } },
    harmony: { intro: 5, verse: 6, chorus: 4, bridge: 2, outro: 5 },
    sections: [
      { type: 'intro', bars: 4, bpm: 96, energy: 35 },
      { type: 'verse', bars: 8, energy: 55, lyrics: L('Revetlla a la platja i fogueres al vent', 'coca i petards i la lluna creixent', 'el baix ressona a dins del pit', 'i el mar respon a cada cop') },
      { type: 'chorus', bars: 8, energy: 80, lyrics: L('Crema, crema la nit', 'salta per sobre del foc', 'crema, crema la nit', 'que l’estiu comença aquí') },
      { type: 'bridge', bars: 8, energy: 50 },
      { type: 'verse', bars: 8, energy: 60, lyrics: L('Les guspires pugen fins als estels', 'algú toca la trompeta a la sorra', 'tanquem els ulls i desitgem fort', 'que aquesta nit no s’acabi mai') },
      { type: 'chorus', bars: 8, energy: 90, lyrics: L('Crema, crema la nit', 'salta per sobre del foc', 'crema, crema la nit', 'que l’estiu comença aquí') },
      { type: 'outro', bars: 8, bpm: 100, energy: 35 }],
    clips: [
      { instrument: 'guitar', from: 0, revision: 3, fx: { type: 'lofi', drive: 50, tone: 40 } },
      { instrument: 'guitar', from: 1, to: 2, revision: 1, fx: { type: 'tape', drive: 50, tone: 50 } },
      { instrument: 'vocal', from: 1 }, { instrument: 'vocal', from: 2 }, { instrument: 'trumpet', from: 2 },
      { instrument: 'electronicDrums', from: 3 }, { instrument: 'synthBass', from: 3 }, { instrument: 'synthLead', from: 3 }, { instrument: 'guitar3', from: 3, revision: 5, fx: { type: 'tape', drive: 40, tone: 60 } },
      { instrument: 'guitar', from: 4, to: 5, revision: 1, fx: { type: 'tape', drive: 50, tone: 50 } },
      { instrument: 'vocal', from: 4 }, { instrument: 'vocal', from: 5 }, { instrument: 'trumpet', from: 5, to: 6 }, { instrument: 'sax', from: 5, to: 6 }] },

  // ── PUNK ───────────────────────────────────────────────────────────
  { slug: 'punk-nit-de-difunts', title: 'Nit de Difunts', style: 'punk', bpm: 184, key: [4, 'major'], seed: 6607,
    description: 'Horror punk a l’estil dels Misfits: guitarres «serra mecànica» doblades a banda i banda, quintes a cops avall, veu greu, orgue de terror a la intro i «whoa-oh» al pont.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 0, bass: 0, guitar: 0 }, timbres: { bass: 'pick' },
    fx: { guitar: { type: 'horrorpunk', drive: 70, tone: 60 }, guitar2: { type: 'horrorpunk', drive: 70, tone: 60 }, guitar3: { type: 'horrorpunk', drive: 70, tone: 60 } },
    harmony: { intro: 4, verse: 3, chorus: 1, bridge: 2, outro: 4 },
    sections: [
      { type: 'intro', bars: 4, bpm: 120, energy: 50 },
      { type: 'verse', bars: 8, energy: 75, lyrics: L('Surto quan la lluna treu el cap', 'entre les tombes del cementiri vell', 'porto la jaqueta i els ulls pintats', 'i un cor que batega sota la pell') },
      { type: 'chorus', bars: 8, energy: 95, lyrics: L('Nit de difunts', 'whoa oh whoa oh', 'nit de difunts', 'ningú no dorm avui') },
      { type: 'verse', bars: 8, energy: 75, lyrics: L('Les campanes toquen a mitjanit', 'els gats negres corren pel teulat', 'vine amb mi que la festa comença', 'on els vius i els morts ballen plegats') },
      { type: 'chorus', bars: 8, energy: 95, lyrics: L('Nit de difunts', 'whoa oh whoa oh', 'nit de difunts', 'ningú no dorm avui') },
      { type: 'bridge', bars: 8, bpm: 160, energy: 70, feel: { drums: .5 }, lyrics: L('Whoa oh oh oh', 'whoa oh oh oh', 'whoa oh oh oh', 'ningú no dorm') },
      { type: 'chorus', bars: 8, energy: 100, lyrics: L('Nit de difunts', 'whoa oh whoa oh', 'nit de difunts', 'ningú no dorm avui') },
      { type: 'outro', bars: 4, energy: 90 }],
    clips: [
      { instrument: 'organ', from: 0, revision: 3 },
      { instrument: 'vocal', from: 1, register: -1 }, { instrument: 'vocal', from: 2, register: -1 }, { instrument: 'guitar2', from: 2 },
      { instrument: 'vocal', from: 3, register: -1 }, { instrument: 'vocal', from: 4, register: -1 }, { instrument: 'guitar2', from: 4 },
      { instrument: 'vocal', from: 5, register: -1 }, { instrument: 'organ', from: 5, revision: 3 },
      { instrument: 'vocal', from: 6, register: -1 }, { instrument: 'guitar2', from: 6, to: 7 }] },

  { slug: 'punk-tres-acords', title: 'Tres Acords i la Veritat', style: 'punk', bpm: 200, key: [9, 'major'], seed: 7717,
    description: 'Punk del 77, ràpid i directe: corxeres a tota velocitat, distorsió de pedal, kit de rock i tornades per cridar a cor.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 0, bass: 0, guitar: 0 }, timbres: { drums: 'rock', bass: 'pick', guitar: 'clean' },
    fx: { guitar: { type: 'distortion', drive: 60, tone: 60 }, guitar2: { type: 'distortion', drive: 60, tone: 60 }, guitar3: { type: 'distortion', drive: 60, tone: 60 } },
    harmony: { intro: 1, verse: 1, chorus: 3, bridge: 1, outro: 1 },
    sections: [
      { type: 'intro', bars: 4, energy: 90 },
      { type: 'verse', bars: 8, energy: 80, lyrics: L('Tinc tres acords i res a perdre', 'un amplificador que fa soroll', 'la sala és petita i plena de gent', 'i el bateria compta fins a quatre') },
      { type: 'chorus', bars: 8, energy: 100, lyrics: L('Un, dos, tres, quatre', 'crida amb mi', 'un, dos, tres, quatre', 'avui som aquí') },
      { type: 'verse', bars: 8, energy: 80, lyrics: L('No sé tocar però tinc ganes', 'les cordes trencades i el cor encès', 'si no t’agrada tanca la porta', 'que nosaltres no callarem mai més') },
      { type: 'chorus', bars: 8, energy: 100, lyrics: L('Un, dos, tres, quatre', 'crida amb mi', 'un, dos, tres, quatre', 'avui som aquí') },
      { type: 'verse', bars: 8, energy: 85, lyrics: L('Demà tindré mal de cap', 'i la veu feta miques', 'però aquesta nit és nostra', 'i la cantarem fins al final') },
      { type: 'chorus', bars: 8, energy: 100, lyrics: L('Un, dos, tres, quatre', 'crida amb mi', 'un, dos, tres, quatre', 'avui som aquí') },
      { type: 'bridge', bars: 4, energy: 60, groove: { drums: 1 } },
      { type: 'chorus', bars: 8, energy: 100, transpose: 2, lyrics: L('Un, dos, tres, quatre', 'crida amb mi', 'un, dos, tres, quatre', 'avui som aquí') },
      { type: 'outro', bars: 4, energy: 100, transpose: 2 }],
    clips: [
      { instrument: 'vocal', from: 1 }, { instrument: 'vocal', from: 2 }, { instrument: 'guitar2', from: 2 },
      { instrument: 'vocal', from: 3 }, { instrument: 'vocal', from: 4 }, { instrument: 'guitar2', from: 4 },
      { instrument: 'vocal', from: 5 }, { instrument: 'guitar3', from: 5, revision: 5 }, { instrument: 'vocal', from: 6 }, { instrument: 'guitar2', from: 6 },
      { instrument: 'vocal', from: 8 }, { instrument: 'guitar2', from: 8, to: 9 }] },

  { slug: 'punk-hardcore-de-barri', title: 'Hardcore de Barri', style: 'punk', bpm: 216, key: [11, 'minor'], seed: 8821,
    description: 'Hardcore en Si menor: D-beat a 216 BPM, fuzz, tornades en doble temps tipus skate punk i un «breakdown» a la meitat de tempo amb guitarra metal.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 2, bass: 3, guitar: 2 }, timbres: { bass: 'pick' },
    fx: { guitar: { type: 'fuzz', drive: 75, tone: 55 }, guitar2: { type: 'fuzz', drive: 75, tone: 55 }, guitar3: { type: 'fuzz', drive: 75, tone: 55 } },
    harmony: { intro: 2, verse: 5, chorus: 4, bridge: 6, outro: 2 },
    sections: [
      { type: 'intro', bars: 4, energy: 90 },
      { type: 'verse', bars: 8, energy: 85, lyrics: L('Ens volen quiets', 'ens volen callats', 'però el barri és nostre', 'i no ens han guanyat') },
      { type: 'chorus', bars: 8, energy: 100, groove: { drums: 3 }, lyrics: L('Mai no ens rendirem', 'mai no callarem', 'mai no ens rendirem', 'som molts i som aquí') },
      { type: 'verse', bars: 8, energy: 85, lyrics: L('Tanquen les places', 'ens treuen el bar', 'però a cada cantonada', 'hi ha algú per cridar') },
      { type: 'chorus', bars: 8, energy: 100, groove: { drums: 3 }, lyrics: L('Mai no ens rendirem', 'mai no callarem', 'mai no ens rendirem', 'som molts i som aquí') },
      { type: 'verse', bars: 8, energy: 90, lyrics: L('Pugem el volum', 'que tremolin els vidres', 'cap porta tancada', 'ens farà callar') },
      { type: 'chorus', bars: 8, energy: 100, groove: { drums: 3 }, lyrics: L('Mai no ens rendirem', 'mai no callarem', 'mai no ens rendirem', 'som molts i som aquí') },
      { type: 'bridge', bars: 8, bpm: 108, energy: 100, groove: { drums: 1 } },
      { type: 'chorus', bars: 8, energy: 100, groove: { drums: 3 }, lyrics: L('Mai no ens rendirem', 'mai no callarem', 'mai no ens rendirem', 'som molts i som aquí') },
      { type: 'outro', bars: 4, energy: 100 }],
    clips: [
      { instrument: 'vocal', from: 1 }, { instrument: 'vocal', from: 2 },
      { instrument: 'vocal', from: 3 }, { instrument: 'vocal', from: 4 },
      { instrument: 'vocal', from: 5 }, { instrument: 'vocal', from: 6 }, { instrument: 'guitar2', from: 6 },
      { instrument: 'guitar2', from: 7, fx: { type: 'metal', drive: 80, tone: 50 } },
      { instrument: 'vocal', from: 8 }, { instrument: 'guitar2', from: 8, to: 9 }] },

  { slug: 'punk-estiu-pop-punk', title: 'Estiu, no te’n vagis', style: 'punk', bpm: 172, key: [2, 'major'], seed: 9931,
    description: 'Pop-punk d’estiu: guitarra aguda amb overdrive a les tornades, arpegis a les estrofes, veu aguda, pretornada que empeny i última tornada un to amunt.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 0, bass: 1, guitar: 1 }, timbres: { bass: 'finger' },
    fx: { guitar: { type: 'overdrive', drive: 55, tone: 60 }, guitar2: { type: 'overdrive', drive: 55, tone: 60 }, guitar3: { type: 'overdrive', drive: 55, tone: 60 } },
    harmony: { intro: 3, verse: 2, prechorus: 5, chorus: 2, bridge: 4, outro: 3 },
    sections: [
      { type: 'intro', bars: 4, energy: 75 },
      { type: 'verse', bars: 8, energy: 60, lyrics: L('Tota la colla a la furgoneta', 'cap a la costa amb la ràdio a tope', 'crema solar i patates fregides', 'i un estiu que no vull que s’acabi') },
      { type: 'prechorus', bars: 4, energy: 80, bpm: 180, lyrics: L('I si demà tot canvia', 'recorda aquesta nit') },
      { type: 'chorus', bars: 8, energy: 95, lyrics: L('Estiu, no te’n vagis', 'queda’t una mica més', 'estiu, no te’n vagis', 'que encara tinc tant per fer') },
      { type: 'verse', bars: 8, energy: 60, lyrics: L('Les nostres ombres llargues a la sorra', 'el mar encara calent a les deu', 'algú ha trobat una guitarra vella', 'i tothom canta sense saber la lletra') },
      { type: 'prechorus', bars: 4, energy: 80, bpm: 180, lyrics: L('I si demà tot canvia', 'recorda aquesta nit') },
      { type: 'chorus', bars: 8, energy: 95, lyrics: L('Estiu, no te’n vagis', 'queda’t una mica més', 'estiu, no te’n vagis', 'que encara tinc tant per fer') },
      { type: 'bridge', bars: 8, energy: 55, feel: { drums: .5 }, lyrics: L('Setembre truca a la porta', 'però encara no l’obrirem') },
      { type: 'chorus', bars: 8, energy: 100, transpose: 2, lyrics: L('Estiu, no te’n vagis', 'queda’t una mica més', 'estiu, no te’n vagis', 'que encara tinc tant per fer') },
      { type: 'outro', bars: 4, transpose: 2 }],
    clips: [
      { instrument: 'guitar2', from: 0 },
      { instrument: 'guitar3', from: 1, revision: 1, fx: { type: 'none', drive: 50, tone: 50 } }, { instrument: 'vocal', from: 1, register: 1 },
      { instrument: 'vocal', from: 2, register: 1 }, { instrument: 'vocal', from: 3, register: 1 }, { instrument: 'guitar2', from: 3 },
      { instrument: 'guitar3', from: 4, revision: 1, fx: { type: 'none', drive: 50, tone: 50 } }, { instrument: 'vocal', from: 4, register: 1 },
      { instrument: 'vocal', from: 5, register: 1 }, { instrument: 'vocal', from: 6, register: 1 }, { instrument: 'guitar2', from: 6 },
      { instrument: 'vocal', from: 7, register: 1 }, { instrument: 'guitar3', from: 7, revision: 3, fx: { type: 'none', drive: 50, tone: 50 } },
      { instrument: 'vocal', from: 8, register: 1 }, { instrument: 'guitar2', from: 8, to: 9 }] },

  { slug: 'punk-mig-temps', title: 'Mig Temps', style: 'punk', bpm: 150, key: [4, 'minor'], seed: 10457,
    description: 'Punk fosc i melòdic en Mi menor: patró a mig temps, baix amb riff molt present, arpegis amb crunch, guitarra metal a les tornades i un pont que baixa de to.',
    base: ['drums', 'bass', 'guitar'], groove: { drums: 1, bass: 3, guitar: 4 }, timbres: { drums: 'room', bass: 'pick' },
    mix: { bass: { low: 2, mid: 2, high: 1, volume: 3 } },
    harmony: { intro: 5, verse: 4, chorus: 3, bridge: 8, outro: 5 },
    sections: [
      { type: 'intro', bars: 4, bpm: 120, energy: 40 },
      { type: 'verse', bars: 8, energy: 55, lyrics: L('Les finestres plenes de pluja', 'els fanals parpellegen al carrer', 'camino sol entre les ombres', 'buscant el que vaig perdre ahir') },
      { type: 'chorus', bars: 8, energy: 85, lyrics: L('Mig temps, mig cor', 'mig camí cap a casa', 'mig temps, mig cor', 'i la nit que no passa') },
      { type: 'verse', bars: 8, energy: 55, lyrics: L('El teu nom escrit a la paret', 'mig esborrat per la tardor', 'encara sento la teva rialla', 'quan passo pel bar del racó') },
      { type: 'chorus', bars: 8, energy: 90, lyrics: L('Mig temps, mig cor', 'mig camí cap a casa', 'mig temps, mig cor', 'i la nit que no passa') },
      { type: 'bridge', bars: 8, bpm: 132, transpose: -2, energy: 50, lyrics: L('Potser demà', 'potser mai') },
      { type: 'chorus', bars: 8, energy: 100, lyrics: L('Mig temps, mig cor', 'mig camí cap a casa', 'mig temps, mig cor', 'i la nit que no passa') },
      { type: 'outro', bars: 4, bpm: 140, energy: 40 }],
    clips: [
      { instrument: 'guitar3', from: 0, to: 1, revision: 2, fx: { type: 'crunch', drive: 45, tone: 55 } },
      { instrument: 'vocal', from: 1 }, { instrument: 'vocal', from: 2 }, { instrument: 'guitar2', from: 2, fx: { type: 'metal', drive: 65, tone: 50 } },
      { instrument: 'guitar3', from: 3, revision: 2, fx: { type: 'crunch', drive: 45, tone: 55 } }, { instrument: 'vocal', from: 3 },
      { instrument: 'vocal', from: 4 }, { instrument: 'guitar2', from: 4, fx: { type: 'metal', drive: 65, tone: 50 } },
      { instrument: 'synthPad', from: 5, revision: 1 }, { instrument: 'vocal', from: 5 },
      { instrument: 'vocal', from: 6 }, { instrument: 'guitar2', from: 6, fx: { type: 'metal', drive: 75, tone: 55 } },
      { instrument: 'guitar3', from: 7, revision: 2, fx: { type: 'crunch', drive: 45, tone: 55 } }] }
];

await mkdir('exemples', { recursive: true });
const index = [];
for (const def of songs) {
  const song = build(def);
  await writeFile(`exemples/${def.slug}.json`, JSON.stringify(song, null, 2) + '\n');
  const seconds = song.sections.reduce((t, s) => t + s.bars * 240 / (s.bpm || song.settings.bpm), 0);
  index.push({ file: `${def.slug}.json`, title: def.title, style: def.style, bpm: def.bpm, seconds: Math.round(seconds), description: def.description });
  console.log(`${def.title.padEnd(26)} ${def.style.padEnd(5)} ${String(def.bpm).padStart(3)} BPM · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} · ${song.sections.length} seccions · ${song.clips.length} clips`);
}
await writeFile('exemples/index.json', JSON.stringify(index, null, 2) + '\n');
