// Mateixes regles que singing/catalan.py, amb els símbols BRAPA com a sortida.
const VOWELS = 'aeiouàèéíïòóúü';
const ACCENTS = 'àèéíòóú';
const FRONT = 'eiéèíï';
const words = text => new Set(text.split(' '));
const ATONES = words('el la els les lo un una uns unes de del dels a al als i o en em et es ens us li hi ho que per pel pels amb com si ma ta sa mon ton son me te se ne ni can');
const CLOSED_E = words('carrer carrers greu greus llei lleis meu meus teu teus seu seus neu preu preus peix peixos lleig passeig passeigs tres mes mesos fer ser ple plens plena plenes');
const CLOSED_O = words('amor amors color colors dolor dolors motor motors valor valors rigor molt molts molta moltes dos tot tots tota totes jove joves');
const FINAL_R = words('amor valor rigor futur sospir sonor prematur honor vapor motor terror error dolor humor favor billar cangur');
const FINAL_R_SILENT = words('càntir córrer recórrer socórrer créixer decréixer vèncer convèncer pertànyer conèixer reconèixer merèixer néixer aparèixer desaparèixer');
const X_KS = /^(?:taxi|fix|afix|asfix|prefix|sufix|crucifix|òxid|oxid|èxit|màxim|maxim|pròxim|proxim|lèxic|lexic|tòxic|toxic|text|sexe|sexual|sax|hex|auxili)/;
const SOUNDS = {
  a: ['a', 'ax'], à: ['a', 'a'], e: ['eh', 'ax'], è: ['eh', 'eh'], é: ['e', 'e'],
  i: ['i', 'i'], í: ['i', 'i'], ï: ['i', 'i'], o: ['oh', 'u'], ò: ['oh', 'oh'],
  ó: ['o', 'o'], u: ['u', 'u'], ú: ['u', 'u'], ü: ['u', 'u']
};
const PAIRS = { ny: ['nh'], ll: ['lh'], rr: ['rr'], ss: ['s'], tx: ['ch'], tz: ['d', 'z'] };
const ONSETS = words('p:r b:r t:r d:r k:r g:r f:r p:l b:l k:l g:l f:l k:w g:w');

export function syllables(raw) {
  raw = raw.normalize('NFC').toLowerCase().replaceAll('’', "'");
  const bare = raw.split("'").at(-1);
  const word = raw.replace(/['-]/g, '')
    .replace(/([qg])u(?=[eiéèíï])/g, (_, c) => c === 'g' ? 'ĝ' : 'q')
    .replace(/([qg])[uü](?=[aeiouàèéíïòóúü])/g, '$1W')
    .replace(/([aeouàèéòóú])ix/g, '$1x')
    .replace(/([aeouàèéòóú])ig(?=s?$)/g, '$1Č');
  const nuclei = [];
  for (let i = 0; i < word.length; i++) {
    if (!VOWELS.includes(word[i])) continue;
    const next = word[i + 1];
    const glide = (next === 'i' || next === 'u') && !['ï', 'ü', next].includes(word[i])
      && !['uir', 'uint'].includes(word.slice(i));
    nuclei.push({ i, glide: glide ? next : null });
    if (glide) i++;
  }
  if (!nuclei.length) return [[[], 'ax', []]];
  let stress = nuclei.findIndex(({ i }) => ACCENTS.includes(word[i]));
  if (stress === -1) {
    stress = nuclei.length === 1 ? (ATONES.has(bare) ? -1 : 0)
      : nuclei.length - (!nuclei.at(-1).glide && /([aeiou]s?|[ei]n)$/.test(word) ? 2 : 1);
  }
  const result = [];
  let cons = [], vowelIndex = 0;
  const vowelAt = i => i >= 0 && i < word.length && VOWELS.includes(word[i]);
  for (let i = 0; i < word.length; i++) {
    const c = word[i], prev = word[i - 1], next = word[i + 1], tail = word.slice(i + 1);
    const last = !tail;
    const nucleus = nuclei[vowelIndex];
    if (nucleus?.i === i) {
      const tonic = vowelIndex++ === stress;
      let sound = SOUNDS[c][tonic ? 0 : 1];
      if (tonic && c === 'e' && CLOSED_E.has(bare)) sound = 'e';
      if (tonic && c === 'o' && CLOSED_O.has(bare)) sound = 'o';
      const take = result.length ? (ONSETS.has(cons.slice(-2).join(':')) ? 2 : Math.min(1, cons.length)) : cons.length;
      if (result.length) result.at(-1)[2].push(...cons.slice(0, cons.length - take));
      result.push([cons.slice(cons.length - take), sound, nucleus.glide ? [nucleus.glide === 'i' ? 'y' : 'w'] : []]);
      cons = [];
      if (nucleus.glide) i++;
      continue;
    }
    const pair = PAIRS[word.slice(i, i + 2)];
    if (pair) { cons.push(...pair); i++; continue; }
    if (c === 't' && (next === 'j' || (next === 'g' && word[i + 2] && FRONT.includes(word[i + 2])))) {
      cons.push('dj'); i++; continue;
    }
    if (c === 'Č' || (c === 'g' && ['i', 'í'].includes(prev) && (last || tail === 's'))) {
      cons.push('ch'); continue;
    }
    if (c === 'n' && next === 'g' && ['', 's'].includes(word.slice(i + 2))) {
      cons.push('ng'); i++; continue;
    }
    if (c === 'n' && ['c', 'g', 'k', 'q', 'ĝ'].includes(next)
      && (!['c', 'g'].includes(next) || !word[i + 2] || !FRONT.includes(word[i + 2]))) {
      cons.push('ng'); continue;
    }
    switch (c) {
      case 'c': cons.push(next && FRONT.includes(next) ? 's' : 'k'); break;
      case 'ç': cons.push('s'); break;
      case 'q': cons.push('k'); break;
      case 'g': cons.push(last ? 'k' : FRONT.includes(next) ? 'j' : 'g'); break;
      case 'ĝ': cons.push('g'); break;
      case 'j': cons.push('j'); break;
      case 'x':
        if (i === 1 && prev === 'e' && (next === 'h' || vowelAt(i + 1))) cons.push('g', 'z');
        else if (X_KS.test(bare)) cons.push('k', 's');
        else cons.push('sh');
        break;
      case 'b': case 'v':
        if (!(last && prev === 'm')) cons.push(last ? 'p' : 'b');
        break;
      case 'd': cons.push(last ? 't' : 'd'); break;
      case 'r':
        if (last && (FINAL_R_SILENT.has(bare) || (nuclei.length > 1 && stress === nuclei.length - 1 && !FINAL_R.has(bare)))) break;
        cons.push(i === 0 || ['n', 'l', 's'].includes(prev) ? 'rr' : 'r');
        break;
      case 's': cons.push(vowelAt(i - 1) && vowelAt(i + 1) ? 'z' : 's'); break;
      case 't':
        if (!((last || tail === 's') && ['n', 'l'].includes(prev))) cons.push('t');
        break;
      case 'W': cons.push('w'); break;
      default: if ('fklmnpywz'.includes(c)) cons.push(c);
    }
  }
  result.at(-1)[2].push(...cons);
  return result;
}
