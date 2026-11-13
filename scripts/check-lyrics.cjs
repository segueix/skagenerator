// Validador del vocabulari català de les lletres: rima dins de cada família, síl·labes, duplicats.
// Ús: node scripts/check-lyrics.cjs  (surt amb error si hi ha algun problema)
'use strict';
const engine = require('../radioambient.js');
const { DATA } = require('../lyrics-ca.js');
const V = 'aeiouàèéíïòóúü', ACC = 'àèéíòóú';
const plain = s => s.replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/[íï]/g, 'i').replace(/[òó]/g, 'o').replace(/[úü]/g, 'u');
// Clau de rima: de l'última vocal tònica fins al final de l'última paraula (sense accents; la r final
// dels infinitius i de paraules com «calor» no sona).
function rhymeKey(line) {
  const word = line.toLowerCase().replace(/[’']/g, ' ').replace(/[^a-zàèéíïòóúüç·\s-]/g, '').trim().split(/[\s-]+/).pop().replace(/(q|g)u(?=[eiéèí])/g, '$1');
  const nuc = [];
  for (let i = 0; i < word.length; i++) if (V.includes(word[i])) { let j = i + 1; if (j < word.length && 'iu'.includes(word[j]) && !'iu'.includes(word[i])) j++; nuc.push([i, j]); i = j - 1; }
  if (!nuc.length) return word;
  let k = nuc.findIndex(([a, b]) => [...word.slice(a, b)].some(c => ACC.includes(c)));
  // Un diftong decreixent al final («canteu», «remei») és tònic.
  if (k < 0 && nuc.at(-1)[1] - nuc.at(-1)[0] === 2) k = nuc.length - 1;
  if (k < 0) k = nuc.length === 1 ? 0 : /([aeiou]s?|[ei]n)$/.test(word) ? nuc.length - 2 : nuc.length - 1;
  let key = plain(word.slice(nuc[k][0])).replace(/ç/g, 'ss').replace(/ss$/, 's');
  key = key.replace(/^([aeiou])r$/, '$1').replace(/^([aeiou])rs$/, '$1s');
  return key;
}
const syll = line => engine.analyzeLyrics(line).syllables[0];
let problems = 0, families = 0, hooks = 0, ends = 0; const seen = new Map();
const flag = msg => { problems++; console.log(msg); };
for (const [theme, subs] of Object.entries(DATA)) for (const [sub, { open, fam }] of Object.entries(subs)) {
  for (const o of open) { const n = syll(o); if (n < 2 || n > 6) flag(`${theme}/${sub} començament «${o}»: ${n} síl·labes`); }
  for (const f of fam) {
    families++;
    const [h, e] = f.split(' ; ').map(part => part.split('|').map(x => x.trim()));
    if (!e) { flag(`${theme}/${sub}: família mal escrita: ${f.slice(0, 40)}`); continue; }
    hooks += h.length; ends += e.length;
    for (const x of h) { const n = syll(x); if (n < 2 || n > 7) flag(`${theme}/${sub} tornada «${x}»: ${n} síl·labes`); }
    for (const x of e) { const n = syll(x); if (n < 3 || n > 9) flag(`${theme}/${sub} final «${x}»: ${n} síl·labes`); }
    for (const x of [...h, ...e]) { const k = x.toLowerCase(); if (seen.has(k)) flag(`duplicat «${x}» (${theme}/${sub} i ${seen.get(k)})`); seen.set(k, `${theme}/${sub}`); }
    // Rima: la clau més freqüent de la família; la resta es marquen.
    const keys = [...h, ...e].map(x => [x, rhymeKey(x)]), count = {};
    for (const [, k] of keys) count[k] = (count[k] || 0) + 1;
    const main = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    const off = keys.filter(([, k]) => k !== main);
    if (off.length) flag(`${theme}/${sub} rima «-${main}»: no rimen → ${off.map(([x, k]) => `${x} (-${k})`).join(' | ')}`);
  }
}
console.log(`${families} famílies, ${hooks} tornades, ${ends} finals; ${problems} problemes`);
if (require.main === module) process.exit(problems ? 1 : 0);
module.exports = { rhymeKey };
