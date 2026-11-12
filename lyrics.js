(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaLyrics = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Lletres automàtiques en anglès per a la cançó automàtica i la ràdio.
  // Cada tema té famílies de rima: unes frases curtes per a la tornada (el «hook»,
  // que també fa de títol) i versos de 5 a 9 síl·labes. Les estrofes són de rima
  // AABB, la tornada repeteix el hook i les seccions llargues ajunten dos versos
  // en una frase de quatre compassos. No es repeteix cap vers dins de la cançó,
  // tret de la tornada, que es canta igual cada vegada (i amb la mateixa melodia).
  const POOLS = {
    ska: [
      { hooks: ["Dance into the night", "Skanking through the night"], lines: ["the streetlights burning bright", "the shoes are shining bright", "we're feeling out of sight", "we move until the light", "the horns are sounding right", "nobody wants to fight", "the city feels so right", "we hold each other tight"] },
      { hooks: ["Rude boys run this town", "Nobody can slow us down"], lines: ["the music shakes the ground", "the bass is so profound", "the best that can be found", "the band is coming round", "we never let you down", "from uptown to downtown", "the records spinning round"] },
      { hooks: ["Move your feet", "Feel the offbeat"], lines: ["out here on the street", "it's such a summer treat", "from the shoulders to the feet", "the summer and the heat", "a rhythm hard to beat", "with everyone we meet", "the drummer keeps the beat"] },
      { hooks: ["Dance the blues away", "Saturday"], lines: ["forget the working day", "the boss is far away", "tomorrow's far away", "the band begins to play", "nobody stays away", "the rent can wait a day", "we dance till break of day"] },
      { hooks: ["Under the sun", "Everyone come on"], lines: ["the party has begun", "we come together as one", "the trouble's on the run", "until the song is done", "the summer's just begun"] },
      { hooks: ["Stand together", "Now or never"], lines: ["we'll be friends forever", "nobody's that clever", "we're never gonna sever", "through any kind of weather", "it's better all together", "the good times last forever"] },
      { hooks: ["Rudy, come back", "Back on track"], lines: ["the needle hits the track", "a suit of white and black", "we're never looking back", "the vinyl in a stack", "the crowd begins to crack"] },
      { hooks: ["Ring the bell", "All is well"], lines: ["the stories we could tell", "the trumpet and the bell", "a summer evening spell", "the night we know so well"] },
      { hooks: ["Shine your shoes", "Nothing to lose"], lines: ["we're dancing off the blues", "the trumpet sings the news", "we've paid our dues", "no time for us to lose", "the sound we always choose"] }
    ],
    punk: [
      { hooks: ["Burn it down", "Tear it down"], lines: ["this is our town", "we're never gonna drown", "we're wearing the crown", "we won't back down", "they kick us to the ground", "the sirens all around", "the walls come tumbling down"] },
      { hooks: ["Stand and fight", "Not tonight"], lines: ["we're screaming through the night", "we're burning out of sight", "we know that we are right", "under the neon light", "we'll never be polite", "nothing here feels right", "we're ready for a fight"] },
      { hooks: ["Make some noise", "Raise your voice"], lines: ["we never had a choice", "they took away our voice", "we're broken girls and boys", "the city's full of noise"] },
      { hooks: ["Get out of our way", "No future today"], lines: ["the sky is always grey", "we're here to make you pay", "they want us gone today", "they never let us play", "there's nothing left to say", "we're going anyway", "the boss just took our pay"] },
      { hooks: ["No more lies", "Open your eyes"], lines: ["the sirens and the cries", "the sun will never rise", "the television lies", "under the factory skies", "the smoke begins to rise", "we see it in their eyes", "the anger never dies"] },
      { hooks: ["Wasted youth", "Tell the truth"], lines: ["they never tell the truth", "we're living in a booth", "the fire of our youth", "the poison and the proof"] },
      { hooks: ["Smash it up", "Never give up"], lines: ["we're never giving up", "they're filling up the cup", "the city's waking up", "the coffee in the cup"] },
      { hooks: ["Say it loud", "Out in the crowd"], lines: ["we're screaming with the crowd", "we're angry and we're proud", "the sky is one big cloud", "they say it's not allowed"] },
      { hooks: ["On our own", "Not alone"], lines: ["the concrete and the stone", "the noise of the unknown", "we're reaping what was sown", "we're never going home", "the streets are all we've known", "we're broken to the bone"] }
    ],
    horror: [
      { hooks: ["Rising from the grave", "Nothing left to save"], lines: ["the dead will not behave", "inside a dirty cave", "the ghouls begin to rave", "a dance upon your grave"] },
      { hooks: ["Under the moon", "Coming for you soon"], lines: ["we howl a darker tune", "the coffin opens soon", "your heart is out of tune", "the bats fly from the moon"] },
      { hooks: ["Walking dead", "Bloody red"], lines: ["the voices in my head", "beneath your little bed", "the candles burning red", "the words the devil said", "the ghosts have to be fed"] },
      { hooks: ["Into the night", "Out of sight"], lines: ["the ghouls come out to bite", "the moon is pale and white", "you're shaking with the fright", "there's no one here in sight"] }
    ],
    love: [
      { hooks: ["Summer days", "Stay"], lines: ["you smile and look away", "I wish that you would stay", "the summer slips away", "we're older every day"] },
      { hooks: ["Me and you", "Nothing new"], lines: ["the sky was turning blue", "I'm thinking about you", "I never really knew", "the summer that we knew"] },
      { hooks: ["Take me home", "All alone"], lines: ["I'm staring at my phone", "I'm walking on my own", "the best I've ever known", "I'm waiting by the phone"] },
      { hooks: ["Hold on tight", "Late at night"], lines: ["the car with one headlight", "we talked until the light", "you said it was all right", "under the city light"] }
    ],
    dark: [
      { hooks: ["Cold", "Growing old"], lines: ["the streets are grey and cold", "the stories never told", "the city's bought and sold", "the winter takes a hold"] },
      { hooks: ["Into the rain", "Again and again"], lines: ["the windows and the rain", "a shadow on the train", "the silence in my brain", "a feeling I can't explain"] },
      { hooks: ["Fading light", "No one in sight"], lines: ["the screens are cold and white", "I'm waiting for the night", "the towers out of sight", "the shadows hold me tight"] },
      { hooks: ["Alone", "Concrete and stone"], lines: ["a voice on the telephone", "the faces I have known", "the static on the phone", "the cities made of stone"] }
    ]
  };
  // Temes de cada subgènere (el primer pesa més).
  const THEMES = { horrorpunk: ['horror'], poppunk: ['love', 'punk'], postpunk: ['dark'], skapunk: ['ska', 'punk'], oi: ['punk'], garage: ['punk', 'love'] };
  const themesOf = (subgenre, style) => THEMES[subgenre] || (style === 'punk' ? ['punk'] : ['ska']);
  // Seccions que es canten (com a la cançó automàtica): estrofes, pretornades i tornades; a l'horror punk, també el pont.
  const SUNG = ['verse', 'prechorus', 'chorus'];

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const capital = text => text[0].toUpperCase() + text.slice(1);

  // sections: [{ type, bars }] → { hook, sections: [{ text, phraseBars }] } (text buit a les seccions que no es canten).
  function writeLyrics({ subgenre, style, sections, seed = 1, sung } = {}) {
    const r = rng(seed), pick = list => list[Math.floor(r() * list.length)];
    const themes = themesOf(subgenre, style);
    // Famílies disponibles: les del tema principal dues vegades (pesen més).
    const families = [...POOLS[themes[0]], ...POOLS[themes[0]], ...(themes[1] ? POOLS[themes[1]] : [])];
    const used = new Set();
    // Un vers que encara no ha sortit: de la família demanada o, si ja s'ha gastat, d'una altra.
    const unused = family => family.lines.filter(line => !used.has(line));
    const fresh = family => {
      let left = unused(family);
      if (!left.length) { const other = families.filter(f => f !== chorusFamily && unused(f).length); left = other.length ? unused(pick(other)) : family.lines; }
      const line = pick(left); used.add(line); return line;
    };
    // La tornada: una família pròpia amb el seu hook.
    const chorusFamily = pick(families), hook = pick(chorusFamily.hooks);
    const chorusAnswers = [fresh(chorusFamily), fresh(chorusFamily)];
    const verseFamilies = () => {
      const others = families.filter(f => f !== chorusFamily);
      const a = pick(others), rest = others.filter(f => f !== a);
      return [a, rest.length ? pick(rest) : a];
    };
    const canSing = sung || (type => SUNG.includes(type) || subgenre === 'horrorpunk' && type === 'bridge');
    let prechorus = null, bridge = null;
    const result = sections.map(sec => {
      if (!canSing(sec.type) || sec.bars < 2) return { text: '', phraseBars: 2 };
      if (sec.type === 'chorus') {
        // Frases de dos compassos: hook, resposta, hook, resposta… (sempre iguals a cada tornada).
        const lines = [], count = Math.max(1, Math.min(16, Math.floor(sec.bars / 2)));
        for (let i = 0; i < count; i++) lines.push(i % 2 === 0 ? hook : chorusAnswers[(i >> 1) % 2]);
        if (count > 1 && count % 2 === 1) lines[count - 1] = hook;
        return { text: lines.map(capital).join('\n'), phraseBars: 2 };
      }
      // Seccions llargues (12 compassos o més): frases de quatre compassos amb dos versos cadascuna.
      const wide = sec.bars >= 12, phraseBars = wide ? 4 : 2, count = Math.max(1, Math.min(16, Math.floor(sec.bars / phraseBars)));
      const make = () => {
        const [a, b] = verseFamilies(), lines = [];
        for (let i = 0; i < count; i++) {
          // Rima AABB; a les frases llargues la primera meitat ve d'una altra família (la rima és al final).
          const family = i % 4 < 2 ? a : b;
          if (!wide) { lines.push(fresh(family)); continue; }
          const filler = pick(families.filter(f => f !== family && f !== chorusFamily && unused(f).length).concat([b === family ? a : b]));
          lines.push(`${fresh(filler)}, ${fresh(family)}`);
        }
        return { text: lines.map(capital).join('\n'), phraseBars };
      };
      // La pretornada i el pont es repeteixen igual si tornen a sortir.
      if (sec.type === 'prechorus') return prechorus && prechorus.count === count ? prechorus.value : (prechorus = { count, value: make() }).value;
      if (sec.type === 'bridge') return bridge && bridge.count === count ? bridge.value : (bridge = { count, value: make() }).value;
      return make();
    });
    return { lang: 'en', hook: capital(hook), sections: result };
  }
  return { writeLyrics, POOLS, THEMES, themesOf };
});
