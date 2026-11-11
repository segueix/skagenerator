// Genera extra-instruments.json a partir dels llistats de fitxers dels repositoris de
// sfzinstruments (Big Rusty, Virtuosity, Meatbass, Growlybass). Ús: clona cada repositori
// amb --filter=blob:none --no-checkout a <dir>/repos/, desa `git rev-parse HEAD` a
// <dir>/repos/<nom>.commit i `git ls-tree -r --name-only HEAD` a <dir>/repos/<nom>.files, i:
//   node scripts/extra-manifest.cjs <dir> > extra-instruments.json
const fs = require('fs'), R = process.argv[2] + '/repos/';
const read = r => fs.readFileSync(R + r + '.files', 'utf8').trim().split('\n');
const commit = r => fs.readFileSync(R + r + '.commit', 'utf8').trim();
// Tria n capes de força repartides entre les disponibles (la més forta sempre hi és).
function layers(files, re, n) {
  const found = new Map();
  for (const f of files) { const m = f.match(re); if (m) { const vl = Number(m[1] || 1); if (!found.has(vl)) found.set(vl, f); } }
  const vls = [...found.keys()].sort((a, b) => a - b);
  if (!vls.length) throw new Error('cap fitxer per a ' + re);
  const pick = n >= vls.length ? vls : Array.from({ length: n }, (_, i) => vls[Math.round((i + 1) * vls.length / n) - 1]);
  return [...new Set(pick)].map(v => found.get(v));
}
function kit(repo, def) {
  const files = read(repo), pieces = {};
  for (const [keys, spec] of Object.entries(def.pieces)) {
    const mics = Object.entries(spec.mics);
    const base = layers(files, spec.re(mics[0][0]), spec.layers);
    const layerList = base.map(first => mics.map(([mic, gain], i) => {
      const file = i ? first.replace(spec.swap(mics[0][0]), `/${mic}/`) : first;
      if (!files.includes(file)) throw new Error('falta ' + file);
      return [file, gain];
    }));
    for (const key of keys.split(',')) pieces[key] = { seconds: spec.seconds, ...(spec.choke ? { choke: spec.choke } : {}), layers: layerList };
  }
  return { name: def.name, author: def.author, license: 'CC0 1.0', program: def.program,
    base: `https://raw.githubusercontent.com/sfzinstruments/${repo}/${commit(repo)}/`, ...(def.levelDb ? { levelDb: def.levelDb } : {}), pieces };
}
// ── Big Rusty Drums (Karoryfer): bombo de 24", caixa de 14", toms de 14-22" ──
const br = (dir, name, micDir = m => m) => ({ re: m => new RegExp(`^Samples/${dir}/${m}/${name}_vl(\\d+)_rr1\\.flac$`), swap: m => new RegExp(`/${m}/(?=[^/]+$)`) });
const rusty = kit('karoryfer.big-rusty-drums', { name: 'Big Rusty Drums', author: 'Karoryfer Lecolds', program: 68, pieces: {
  '35,36': { ...br('kick_24/kick', 'k'), mics: { kick: 1, oh: .45 }, layers: 4, seconds: 1.1 },
  '38': { ...br('snare_14/center', 'sn_center'), mics: { top: 1, btm: .35, oh: .5 }, layers: 4, seconds: .9 },
  '37': { ...br('snare_14/sidestick', 'sn_ss'), mics: { top: 1, oh: .5 }, layers: 2, seconds: .45 },
  '40': { ...br('snare_14/rimshot', 'sn_rims'), mics: { top: 1, btm: .3, oh: .5 }, layers: 2, seconds: 1 },
  '42': { ...br('hihat_14/tc', 'ht_tc'), mics: { cl: 1, oh: .5 }, layers: 3, seconds: .4, choke: 1 },
  '44': { re: m => new RegExp(`^Samples/hihat_14/phit/${m}/ht_phit()_rr1\\.flac$`), swap: m => new RegExp(`/${m}/(?=[^/]+$)`), mics: { cl: 1, oh: .5 }, layers: 1, seconds: .35, choke: 1 },
  '46': { ...br('hihat_14/open', 'ht_open'), mics: { cl: 1, oh: .5 }, layers: 2, seconds: 1.4, choke: 1 },
  '41,43': { ...br('tom_22/center', 't22'), mics: { cl: 1, oh: .45 }, layers: 2, seconds: 1.8 },
  '45,47': { ...br('tom_18/center', 't18'), mics: { cl: 1, oh: .45 }, layers: 2, seconds: 1.5 },
  '48,50': { ...br('tom_14/center', 't14'), mics: { cl: 1, oh: .45 }, layers: 2, seconds: 1.3 },
  '49,57,52,55': { ...br('crash_17/cr', 'cr'), mics: { cl: .7, oh: 1 }, layers: 2, seconds: 2.4 },
  '51,59': { ...br('ride_22/rd', 'rd'), mics: { cl: .8, oh: 1 }, layers: 2, seconds: 2.2 },
  '53': { ...br('ride_22/bl', 'rd_bl'), mics: { cl: .8, oh: 1 }, layers: 1, seconds: 2 }
} });
// ── Virtuosity Drums: kit de club (micròfons propers + sala) i micròfon lo-fi ──
const vd = (piece, art, rr = true) => ({ re: m => new RegExp(`^Samples/${m}/${piece}/${m}_${art}_vl(\\d+)${rr ? '_rr1' : ''}\\.flac$`), swap: m => new RegExp(`(?<=/|^)${m}(?=/|_)`, 'g') });
// El substitut del micròfon ha de canviar la carpeta i el prefix del fitxer.
function vdKit(name, program, mix, levelDb) {
  const files = read('virtuosity_drums');
  const pieces = {
    '35,36': [vd('kick', 'kick_snon'), mix.kick, 3, 1], '38': [vd('snare', 'snare_center', false), mix.snare, 4, .9],
    '37': [vd('snare', 'snare_crossstick', false), mix.snare, 2, .45], '40': [vd('snare', 'snare_rimshot', false), mix.snare, 2, 1],
    '42': [vd('hh', 'hh_closed'), mix.cym, 3, .4, 1], '44': [vd('hh', 'hh_pedal'), mix.cym, 1, .35, 1], '46': [vd('hh', 'hh_open'), mix.cym, 2, 1.4, 1],
    '41,43,45': [vd('ltom', 'ltom_center', false), mix.tom, 2, 1.6], '47,48,50': [vd('htom', 'htom_center', false), mix.tom, 2, 1.3],
    '49,57,52,55': [vd('crash', 'crash_crash'), mix.cym, 2, 2.4], '51,59': [vd('ride', 'ride_ride'), mix.cym, 2, 2.2], '53': [vd('ride', 'ride_bell'), mix.cym, 1, 2]
  };
  const out = {};
  for (const [keys, [p, mics, n, seconds, choke]] of Object.entries(pieces)) {
    const entries = Object.entries(mics), first = entries[0][0];
    const list = layers(files, p.re(first), n).map(f => entries.map(([mic, gain]) => {
      const file = f.replace(`Samples/${first}/`, `Samples/${mic}/`).replace(`/${first}_`, `/${mic}_`);
      if (!files.includes(file)) throw new Error('falta ' + file); return [file, gain];
    }));
    for (const key of keys.split(',')) out[key] = { seconds, ...(choke ? { choke } : {}), layers: list };
  }
  return { name, author: 'Virtuosity Musical Instruments', license: 'CC0 1.0', program,
    base: `https://raw.githubusercontent.com/sfzinstruments/virtuosity_drums/${commit('virtuosity_drums')}/`, ...(levelDb ? { levelDb } : {}), pieces: out };
}
const club = vdKit('Virtuosity Club', 66, { kick: { kickmic: 1, oh: .4, room: .35 }, snare: { snaremic: 1, oh: .45, room: .35 }, tom: { oh: 1, room: .5 }, cym: { oh: 1, room: .45 } });
const lofi = vdKit('Virtuosity Lo-fi', 67, { kick: { lofi: 1 }, snare: { lofi: 1 }, tom: { lofi: 1 }, cym: { lofi: 1 } });
// ── Baixos ──
const NOTE = { c: 0, db: 1, d: 2, eb: 3, e: 4, f: 5, gb: 6, g: 7, ab: 8, a: 9, bb: 10, b: 11 };
function bass(repo, def) {
  const files = read(repo), notes = new Map();
  for (const f of files) {
    const m = f.match(def.re); if (!m) continue;
    const key = (Number(m[2]) + 1) * 12 + NOTE[m[1]] + (def.octave || 0) * 12;
    if (!notes.has(key)) notes.set(key, []);
    notes.get(key).push([def.layerIndex(m[3]), f]);
  }
  return { name: def.name, author: 'Karoryfer Lecolds', license: 'CC0 1.0', bank: def.bank, program: def.program, rate: 22050, maxSeconds: def.maxSeconds, release: def.release, levelDb: def.levelDb,
    base: `https://raw.githubusercontent.com/sfzinstruments/${repo}/${commit(repo)}/`,
    notes: [...notes].sort((a, b) => a[0] - b[0]).map(([key, list]) => ({ key, layers: def.layers.map(l => list.find(([li]) => li === l)?.[1]).filter(Boolean) })) };
}
const upright = bass('karoryfer.meatbass', { name: 'Contrabaix Meatbass', bank: 2, program: 32, maxSeconds: 1.8, release: .12, levelDb: [-9, -13],
  re: /^Samples\/pizz\/([a-g]b?)(\d)_vl(\d)_rr1\.wav$/, layerIndex: Number, layers: [2, 4] });
const growl = bass('karoryfer.growlybass', { name: 'Baix Growlybass', bank: 4, program: 33, maxSeconds: 2, release: .1, levelDb: [-9, -13],
  octave: -1, re: /^sustain\/([a-g]b?)(\d)_(pp|p|f|ff)_rr1\.wav$/, layerIndex: v => ['pp', 'p', 'f', 'ff'].indexOf(v) + 1, layers: [2, 4] });
const extra = { about: 'Bateries i baixos gravats addicionals (CC0). Es carreguen a part, només quan una cançó els fa servir.', kits: [rusty, club, lofi], basses: [upright, growl] };
const count = extra.kits.reduce((t, k) => t + new Set(Object.values(k.pieces).flatMap(p => p.layers.flat().map(([f]) => f))).size, 0)
  + extra.basses.reduce((t, b) => t + b.notes.reduce((s, n) => s + n.layers.length, 0), 0);
console.error('fitxers', count, 'notes', extra.basses.map(b => b.notes.length + ':' + b.notes.map(n => n.layers.length).join('')));
process.stdout.write(JSON.stringify(extra, null, 1));
