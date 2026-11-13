(function (root, factory) {
  // El vocabulari català per subtemes és a lyrics-ca.js (es carrega abans que aquest fitxer).
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./lyrics-ca.js') : root.SkaLyricsCa);
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaLyrics = api;
})(typeof self !== 'undefined' ? self : this, function (catalan) {
  'use strict';
  // Lletres automàtiques (en català o en anglès) per a la cançó automàtica i la ràdio.
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
  // Català: mateixa estructura (famílies de rima; versos de 5 a 9 síl·labes comptades com l'app).
  const POOLS_CA = {
    ska: [
      { hooks: ["Ballem a la ciutat", "Ningú no s'ha cansat"], lines: ["el barri s'ha despertat", "el ritme s'ha quedat", "les trompetes han sonat", "dissabte tan esperat", "el sol ja s'ha colgat"] },
      { hooks: ["Vine a ballar", "A la vora del mar"], lines: ["ningú no vol parar", "la nit no ha d'acabar", "el baix comença a sonar", "ens tornem a trobar", "deixa la feina per demà"] },
      { hooks: ["Fins que surti el sol", "Ballem sota el sol"], lines: ["tothom balla com vol", "ningú no està tot sol", "les sabates de xarol", "el cel és un llençol"] },
      { hooks: ["A contratemps", "Tota la gent"], lines: ["la plaça plena de gent", "la música dins del vent", "ballem tots en un moment", "el món sembla diferent"] },
      { hooks: ["Festa tot el dia", "Quina alegria"], lines: ["la banda fa harmonia", "la nit sembla un nou dia", "som una gran companyia", "ningú no se n'aniria"] },
      { hooks: ["Ritme i calor", "Amb tot el cor"], lines: ["la plaça bull de calor", "trompetes i tambor", "la nit fa olor de flor", "ballem amb tot el cor"] }
    ],
    punk: [
      { hooks: ["Ens volen fer callar", "Tot ho farem petar"], lines: ["no volen deixar parlar", "el barri vol cridar", "mai no podran guanyar", "tornem a començar"] },
      { hooks: ["Volem llibertat", "Ningú ens ha comprat"], lines: ["ens han tancat la ciutat", "el lloguer s'ha disparat", "el silenci s'ha trencat", "som el barri revoltat"] },
      { hooks: ["Som la gent", "Contra el vent"], lines: ["la tele sempre ens ment", "ningú no és innocent", "cridem tots al mateix temps", "la ràbia creix lentament"] },
      { hooks: ["Sense sortida", "És la nostra vida"], lines: ["la ràbia no s'oblida", "el carrer és una ferida", "la lluita està decidida", "la nit és una crida"] },
      { hooks: ["Crida la cançó", "Tenim la raó"], lines: ["no demanem perdó", "no tenim cap patró", "ens volen a la presó", "fem soroll pel carreró"] }
    ],
    horror: [
      { hooks: ["Fills de la nit", "Un crit a la nit"], lines: ["la lluna ens ha seguit", "ningú no ha dormit", "el cementiri ha cruixit", "el mort ja s'ha vestit", "el cel s'ha enfosquit"] },
      { hooks: ["Ball de la mort", "Rellotge de la mort"], lines: ["el rellotge sona fort", "la nit fa un fred tan fort", "el corb vola cap al nord", "ningú no té bona sort", "la campana toca a mort"] },
      { hooks: ["Sang a la lluna", "Una per una"], lines: ["les ombres d'una en una", "la boira com una duna", "no ens queda cap fortuna", "la tomba és tan profunda"] }
    ],
    love: [
      { hooks: ["Ets la meva alegria", "Cada dia"], lines: ["pensant en tu tot el dia", "la teva veu em guia", "no sé què faria", "la platja ens esperaria"] },
      { hooks: ["Tot és per amor", "Amb tot el cor"], lines: ["la platja i la calor", "el teu nom en una flor", "les nits i la calor", "l'estiu té un altre color"] },
      { hooks: ["Torna a casa", "Aquesta nit passa"], lines: ["el telèfon que no passa", "la ràdio que s'apaga", "la tarda que s'acaba", "la lluna que ens abraça"] }
    ],
    dark: [
      { hooks: ["Pluja i vent", "Lentament"], lines: ["les llums s'apaguen lentament", "un tren que passa sense gent", "la ciutat dorm sense temps", "el silenci és transparent"] },
      { hooks: ["Fa fred", "Carrer estret"], lines: ["la ciutat és un secret", "el teu nom en un paret", "un vidre trencat i fred", "el món és cada cop més estret"] },
      { hooks: ["Ombres de neó", "Sense cap raó"], lines: ["la nit sense cap cançó", "les ombres del balcó", "un llum dins el racó", "les fàbriques i el carbó"] }
    ]
  };
  // Ampliació de rimes, escenes i situacions per a cançons variades.
  // Frases validades amb el comptador de síl·labes de la mateixa aplicació.
  const EXTRA_CA = {
    ska: [
      { hooks: ["La plaça s'encén","La nit és nostra"], lines: [
        "El barri s'omple de color", "El barri ja desprèn calor", "El barri fa olor de flor", "El barri ens regala escalfor",
        "El barri té un nou color", "El carrer s'omple de color", "El carrer ja desprèn calor", "El carrer fa olor de flor",
        "El carrer ens regala escalfor", "El carrer té un nou color", "El mercat s'omple de color", "El mercat ja desprèn calor",
        "El mercat fa olor de flor", "El mercat ens regala escalfor", "El mercat té un nou color", "El local s'omple de color",
        "El local ja desprèn calor", "El local fa olor de flor", "El local ens regala escalfor", "El local té un nou color",
        "El terrat s'omple de color", "El terrat ja desprèn calor", "El terrat fa olor de flor", "El terrat ens regala escalfor",
        "El terrat té un nou color"
      ] },
      { hooks: ["Torna a ballar","Que no pari mai"], lines: [
        "La banda ja vol ballar", "La banda no vol parar", "La banda ens fa cantar", "La banda ens convida a saltar",
        "La banda ens torna a cridar", "La colla ja vol ballar", "La colla no vol parar", "La colla ens fa cantar",
        "La colla ens convida a saltar", "La colla ens torna a cridar", "La festa ja vol ballar", "La festa no vol parar",
        "La festa ens fa cantar", "La festa ens convida a saltar", "La festa ens torna a cridar", "La gent ja vol ballar",
        "La gent no vol parar", "La gent ens fa cantar", "La gent ens convida a saltar", "La gent ens torna a cridar",
        "La plaça ja vol ballar", "La plaça no vol parar", "La plaça ens fa cantar", "La plaça ens convida a saltar",
        "La plaça ens torna a cridar"
      ] },
      { hooks: ["Sona de valent","El baix no s'atura"], lines: [
        "El saxo sona de valent", "El saxo desperta la gent", "El saxo fa ballar el jovent", "El saxo repica amb el vent",
        "El saxo sembla diferent", "El trombó sona de valent", "El trombó desperta la gent", "El trombó fa ballar el jovent",
        "El trombó repica amb el vent", "El trombó sembla diferent", "El tambor sona de valent", "El tambor desperta la gent",
        "El tambor fa ballar el jovent", "El tambor repica amb el vent", "El tambor sembla diferent", "El teclat sona de valent",
        "El teclat desperta la gent", "El teclat fa ballar el jovent", "El teclat repica amb el vent", "El teclat sembla diferent",
        "El baix sona de valent", "El baix desperta la gent", "El baix fa ballar el jovent", "El baix repica amb el vent",
        "El baix sembla diferent"
      ] },
      { hooks: ["Un altre cop de nit","Que arribi el matí"], lines: [
        "El bombo ressona de nit", "El bombo ens deixa sense llit", "El bombo respon al nostre crit", "El bombo no ha dormit",
        "El bombo s'ha quedat adormit", "El saxo ressona de nit", "El saxo ens deixa sense llit", "El saxo respon al nostre crit",
        "El saxo no ha dormit", "El saxo s'ha quedat adormit", "El ritme ressona de nit", "El ritme ens deixa sense llit",
        "El ritme respon al nostre crit", "El ritme no ha dormit", "El ritme s'ha quedat adormit", "El baix ressona de nit",
        "El baix ens deixa sense llit", "El baix respon al nostre crit", "El baix no ha dormit", "El baix s'ha quedat adormit",
        "El trombó ressona de nit", "El trombó ens deixa sense llit", "El trombó respon al nostre crit", "El trombó no ha dormit",
        "El trombó s'ha quedat adormit"
      ] },
      { hooks: ["Cap al mar","Encara queda nit"], lines: [
        "La brisa ens porta al mar", "La brisa ens fa navegar", "La brisa ens torna a cridar", "La brisa ens convida a saltar",
        "La brisa no ens deixa marxar", "La nit ens porta al mar", "La nit ens fa navegar", "La nit ens torna a cridar",
        "La nit ens convida a saltar", "La nit no ens deixa marxar", "La plaça ens porta al mar", "La plaça ens fa navegar",
        "La plaça ens torna a cridar", "La plaça ens convida a saltar", "La plaça no ens deixa marxar", "La lluna ens porta al mar",
        "La lluna ens fa navegar", "La lluna ens torna a cridar", "La lluna ens convida a saltar", "La lluna no ens deixa marxar",
        "La música ens porta al mar", "La música ens fa navegar", "La música ens torna a cridar", "La música no ens deixa marxar"
      ] },
    ],
    punk: [
      { hooks: ["El barri no calla","Ara és el moment"], lines: [
        "El barri s'ha revoltat", "El barri s'ha despertat", "El barri s'ha organitzat", "El barri ja s'ha aixecat",
        "El barri mai no ha callat", "El poble s'ha revoltat", "El poble s'ha despertat", "El poble s'ha organitzat",
        "El poble ja s'ha aixecat", "El poble mai no ha callat", "El carrer s'ha revoltat", "El carrer s'ha despertat",
        "El carrer s'ha organitzat", "El carrer ja s'ha aixecat", "El carrer mai no ha callat", "El jovent s'ha revoltat",
        "El jovent s'ha despertat", "El jovent s'ha organitzat", "El jovent ja s'ha aixecat", "El jovent mai no ha callat",
        "El veïnat s'ha revoltat", "El veïnat s'ha despertat", "El veïnat s'ha organitzat", "El veïnat ja s'ha aixecat",
        "El veïnat mai no ha callat"
      ] },
      { hooks: ["No ens faran callar","No em penso rendir"], lines: [
        "La gent vol despertar", "La gent no vol callar", "La gent ens farà cridar", "La gent no es deixa comprar",
        "La gent ens convida a lluitar", "La colla vol despertar", "La colla no vol callar", "La colla ens farà cridar",
        "La colla no es deixa comprar", "La ràbia vol despertar", "La ràbia no vol callar", "La ràbia ens farà cridar",
        "La ràbia no es deixa comprar", "La banda vol despertar", "La banda no vol callar", "La banda ens farà cridar",
        "La banda no es deixa comprar", "La plaça vol despertar", "La plaça no vol callar", "La plaça ens farà cridar",
        "La plaça no es deixa comprar"
      ] },
      { hooks: ["Ja no tenim por","Que caigui el teló"], lines: [
        "El govern vol tenir raó", "El govern ens demana perdó", "El govern ens ven la solució", "El govern ens talla la cançó",
        "El govern ens imposa un sermó", "El patró vol tenir raó", "El patró ens demana perdó", "El patró ens ven la solució",
        "El patró ens talla la cançó", "El patró ens imposa un sermó", "El banquer vol tenir raó", "El banquer ens demana perdó",
        "El banquer ens ven la solució", "El banquer ens talla la cançó", "El banquer ens imposa un sermó", "El jutge vol tenir raó",
        "El jutge ens demana perdó", "El jutge ens ven la solució", "El jutge ens talla la cançó", "El jutge ens imposa un sermó",
        "El senyor vol tenir raó", "El senyor ens demana perdó", "El senyor ens ven la solució", "El senyor ens talla la cançó",
        "El senyor ens imposa un sermó"
      ] },
      { hooks: ["Carrers en flames","Encara estem drets"], lines: [
        "Els carrers s'omplen de gent", "Els carrers bateguen amb el vent", "Els carrers s'alcen de valent", "Els carrers van a contracorrent",
        "Els carrers no miren enrere mai", "Els barris s'omplen de gent", "Els barris bateguen amb el vent", "Els barris s'alcen de valent",
        "Els barris van a contracorrent", "Els barris no miren enrere mai", "Els veïns s'omplen de gent", "Els veïns bateguen amb el vent",
        "Els veïns s'alcen de valent", "Els veïns van a contracorrent", "Els veïns no miren enrere mai", "Els portals s'omplen de gent",
        "Els portals bateguen amb el vent", "Els portals s'alcen de valent", "Els portals van a contracorrent", "Els portals no miren enrere mai",
        "Els carrils s'omplen de gent", "Els carrils bateguen amb el vent", "Els carrils s'alcen de valent", "Els carrils van a contracorrent",
        "Els carrils no miren enrere mai"
      ] },
      { hooks: ["Mai ens rendirem","Sempre al davant"], lines: [
        "Les veïnes ja s'han unit", "Les veïnes no han fugit", "Les veïnes han fet un crit", "Les veïnes no han dormit",
        "Les veïnes han resistit", "Les companyes ja s'han unit", "Les companyes no han fugit", "Les companyes han fet un crit",
        "Les companyes no han dormit", "Les companyes han resistit", "Les obreres ja s'han unit", "Les obreres no han fugit",
        "Les obreres han fet un crit", "Les obreres no han dormit", "Les obreres han resistit", "Les amigues ja s'han unit",
        "Les amigues no han fugit", "Les amigues han fet un crit", "Les amigues no han dormit", "Les amigues han resistit",
        "Les famílies ja s'han unit", "Les famílies no han fugit", "Les famílies han fet un crit", "Les famílies no han dormit",
        "Les famílies han resistit"
      ] },
    ],
    horror: [
      { hooks: ["El vampir no dorm","Tornem de nit"], lines: [
        "El vampir ja surt de nit", "El vampir ha tornat al llit", "El vampir no ha dormit", "El vampir ha fet un crit",
        "El vampir s'ha quedat adormit", "El taüt ja surt de nit", "El taüt ha tornat al llit", "El taüt no ha dormit",
        "El taüt ha fet un crit", "El taüt s'ha quedat adormit", "El fantasma ja surt de nit", "El fantasma ha tornat al llit",
        "El fantasma no ha dormit", "El fantasma ha fet un crit", "El fantasma s'ha quedat adormit", "El monstre ja surt de nit",
        "El monstre ha tornat al llit", "El monstre no ha dormit", "El monstre ha fet un crit", "El monstre s'ha quedat adormit",
        "El dimoni ja surt de nit", "El dimoni ha tornat al llit", "El dimoni no ha dormit", "El dimoni ha fet un crit",
        "El dimoni s'ha quedat adormit"
      ] },
      { hooks: ["La campana de mort","A les dotze en punt"], lines: [
        "El rellotge anuncia la mort", "El rellotge ens crida molt fort", "El rellotge ens porta mala sort", "El rellotge vola cap al nord",
        "El rellotge fa un soroll molt fort", "El cementiri ens crida molt fort", "El cementiri vola cap al nord", "El carreró anuncia la mort",
        "El carreró ens crida molt fort", "El carreró ens porta mala sort", "El carreró vola cap al nord", "El carreró fa un soroll molt fort",
        "El vell castell anuncia la mort", "El vell castell ens crida molt fort", "El vell castell ens porta mala sort", "El vell castell vola cap al nord",
        "El vell castell fa un soroll molt fort", "El corb anuncia la mort", "El corb ens crida molt fort", "El corb ens porta mala sort",
        "El corb vola cap al nord", "El corb fa un soroll molt fort"
      ] },
      { hooks: ["La casa fa por","Que tremoli el cor"], lines: [
        "La bruixa fa molta por", "La bruixa em roba el color", "La bruixa em gela el cor", "La bruixa em porta el dolor",
        "La lluna fa molta por", "La lluna em roba el color", "La lluna em gela el cor", "La lluna em porta el dolor",
        "La lluna no em deixa escalfor", "La tomba fa molta por", "La tomba em roba el color", "La tomba em gela el cor",
        "La tomba em porta el dolor", "La tomba no em deixa escalfor", "La casa fa molta por", "La casa em roba el color",
        "La casa em gela el cor", "La casa em porta el dolor", "La casa no em deixa escalfor", "La boira fa molta por",
        "La boira em roba el color", "La boira em gela el cor", "La boira em porta el dolor", "La boira no em deixa escalfor"
      ] },
      { hooks: ["La porta tancada","Hi ha algú a dins"], lines: [
        "La finestra ha quedat tancada", "La finestra sembla encantada", "La finestra ha quedat glaçada", "La porta ha quedat tancada",
        "La porta sembla encantada", "La porta està tota tacada", "La porta ha quedat glaçada", "La cadira ha quedat tancada",
        "La cadira sembla encantada", "La cadira ha quedat glaçada", "La ràdio ha quedat tancada", "La ràdio sembla encantada",
        "La ràdio ha quedat glaçada", "La mirada ha quedat tancada", "La mirada sembla encantada", "La mirada ha quedat glaçada"
      ] },
    ],
    love: [
      { hooks: ["Em fas recordar","Un altre estiu"], lines: [
        "La nit em fa recordar", "La nit em convida a ballar", "La nit no em deixa marxar", "La nit em torna a trobar",
        "La nit em fa somiar", "El teu riure em fa recordar", "El teu riure em fa somiar", "La teva veu em fa recordar",
        "La teva veu no em deixa marxar", "La teva veu em torna a trobar", "La teva veu em fa somiar", "La pluja em fa recordar",
        "La pluja em convida a ballar", "La pluja no em deixa marxar", "La pluja em torna a trobar", "La pluja em fa somiar",
        "La ciutat em fa recordar", "La ciutat no em deixa marxar", "La ciutat em torna a trobar", "La ciutat em fa somiar"
      ] },
      { hooks: ["Torna'm el color","Quan tornes a casa"], lines: [
        "El matí em roba el dolor", "El matí em canvia el color", "El matí em fa perdre la por", "El matí em desperta l'amor",
        "El matí em deixa escalfor", "El vespre em roba el dolor", "El vespre em canvia el color", "El vespre em fa perdre la por",
        "El vespre em desperta l'amor", "El vespre em deixa escalfor", "El teu bes em roba el dolor", "El teu bes em canvia el color",
        "El teu bes em fa perdre la por", "El teu bes em desperta l'amor", "El teu bes em deixa escalfor", "El teu gest em roba el dolor",
        "El teu gest em canvia el color", "El teu gest em fa perdre la por", "El teu gest em desperta l'amor", "El teu gest em deixa escalfor",
        "El record em roba el dolor", "El record em canvia el color", "El record em fa perdre la por", "El record em desperta l'amor",
        "El record em deixa escalfor"
      ] },
      { hooks: ["La carta guardada","Paraules de paper"], lines: [
        "La carta ha quedat guardada", "La carta s'ha quedat gravada", "La carta semblava oblidada", "La postal ha quedat guardada",
        "La postal s'ha quedat gravada", "La postal semblava oblidada", "La trucada s'ha quedat gravada", "La mirada s'ha quedat gravada",
        "La paraula s'ha quedat gravada"
      ] },
      { hooks: ["Encara estàs amb mi","Les fotos de l'estiu"], lines: [
        "El teu record encara és viu", "El teu record sempre em somriu", "El teu record sembla més festiu", "El carrer encara és viu",
        "El carrer sempre em somriu", "El carrer sembla més festiu", "El carrer ens uneix com un riu", "El jardí encara és viu",
        "El jardí sempre em somriu", "El jardí sembla més festiu", "El jardí ens uneix com un riu", "El matí encara és viu",
        "El matí sempre em somriu", "El matí sembla més festiu", "El matí ens uneix com un riu", "El retrat encara és viu",
        "El retrat sempre em somriu", "El retrat sembla més festiu", "El retrat ens uneix com un riu"
      ] },
    ],
    dark: [
      { hooks: ["El carrer és buit","El secret del carrer"], lines: [
        "El carrer té un gran secret", "El carrer és massa estret", "El carrer es queda quiet", "El carrer em fa sentir fred",
        "El carrer té un reflex discret", "El cementiri té un gran secret", "El cementiri és massa estret", "El cementiri es queda quiet",
        "El cementiri em fa sentir fred", "El terrat té un gran secret", "El terrat és massa estret", "El terrat es queda quiet",
        "El terrat em fa sentir fred", "El terrat té un reflex discret", "El portal té un gran secret", "El portal és massa estret",
        "El portal es queda quiet", "El portal em fa sentir fred", "El portal té un reflex discret", "El passadís té un gran secret",
        "El passadís és massa estret", "El passadís es queda quiet", "El passadís em fa sentir fred", "El passadís té un reflex discret"
      ] },
      { hooks: ["El tren de la nit","El silenci parla"], lines: [
        "El tren passa lentament", "El tren ja no escolta gent", "El tren sembla transparent", "El tren travessa el present",
        "El tren fa fugir la gent", "El vent passa lentament", "El vent ja no escolta gent", "El vent sembla transparent",
        "El vent travessa el present", "El vent fa fugir la gent", "El fum passa lentament", "El fum ja no escolta gent",
        "El fum sembla transparent", "El fum travessa el present", "El fum fa fugir la gent", "El silenci passa lentament",
        "El silenci ja no escolta gent", "El silenci sembla transparent", "El silenci travessa el present", "El silenci fa fugir la gent",
        "El temps passa lentament", "El temps ja no escolta gent", "El temps sembla transparent", "El temps travessa el present",
        "El temps fa fugir la gent"
      ] },
      { hooks: ["Una llum al balcó","L'última cançó"], lines: [
        "El neó s'encén sense raó", "El neó em dicta una cançó", "El neó no troba cap perdó", "El neó es perd en el racó",
        "El neó s'apaga al balcó", "El telèfon s'encén sense raó", "El telèfon no troba cap perdó", "El telèfon es perd en el racó",
        "El telèfon s'apaga al balcó", "El balcó s'encén sense raó", "El balcó em dicta una cançó", "El balcó no troba cap perdó",
        "El balcó es perd en el racó", "El balcó s'apaga al balcó", "El semàfor s'encén sense raó", "El semàfor no troba cap perdó",
        "El semàfor es perd en el racó", "El semàfor s'apaga al balcó", "El transistor s'encén sense raó", "El transistor no troba cap perdó",
        "El transistor es perd en el racó", "El transistor s'apaga al balcó"
      ] },
      { hooks: ["Sense escalfor","La ciutat sense color"], lines: [
        "El fred em deixa sense color", "El fred em fa sentir temor", "El fred em parla de dolor", "El fred em roba l'escalfor",
        "El fred fa ombra al corredor", "El vent em deixa sense color", "El vent em fa sentir temor", "El vent em parla de dolor",
        "El vent em roba l'escalfor", "El vent fa ombra al corredor", "El fum em deixa sense color", "El fum em fa sentir temor",
        "El fum em parla de dolor", "El fum em roba l'escalfor", "El fum fa ombra al corredor", "El tren em deixa sense color",
        "El tren em fa sentir temor", "El tren em parla de dolor", "El tren em roba l'escalfor", "El tren fa ombra al corredor",
        "El carrer em deixa sense color", "El carrer em fa sentir temor", "El carrer em parla de dolor", "El carrer em roba l'escalfor",
        "El carrer fa ombra al corredor"
      ] },
    ],
  };

  const EXTRA_EN = {
    ska: [
      { hooks: ["The lights are on","The midnight train"], lines: [
        "The street is moving tonight", "The street is shining so bright", "The street is dancing all night", "The street feels ready for flight",
        "The street is glowing with light", "The town is moving tonight", "The town is shining so bright", "The town is dancing all night",
        "The town feels ready for flight", "The town is glowing with light", "The club is moving tonight", "The club is shining so bright",
        "The club is dancing all night", "The club feels ready for flight", "The club is glowing with light", "The band is moving tonight",
        "The band is shining so bright", "The band is dancing all night", "The band feels ready for flight", "The band is glowing with light",
        "The crowd is moving tonight", "The crowd is shining so bright", "The crowd is dancing all night", "The crowd feels ready for flight",
        "The crowd is glowing with light"
      ] },
      { hooks: ["Keep on moving","The weekend is ours"], lines: [
        "The drummer is keeping the beat", "The drummer is shaking the street", "The drummer is bringing the heat", "The drummer makes everyone meet",
        "The drummer is moving our feet", "The bass line is keeping the beat", "The bass line is shaking the street", "The bass line is bringing the heat",
        "The bass line makes everyone meet", "The bass line is moving our feet", "The trumpet is keeping the beat", "The trumpet is shaking the street",
        "The trumpet is bringing the heat", "The trumpet makes everyone meet", "The trumpet is moving our feet", "The old sax is keeping the beat",
        "The old sax is shaking the street", "The old sax is bringing the heat", "The old sax makes everyone meet", "The old sax is moving our feet",
        "The organ is keeping the beat", "The organ is shaking the street", "The organ is bringing the heat", "The organ makes everyone meet",
        "The organ is moving our feet"
      ] },
      { hooks: ["The music goes on","When the sun comes up"], lines: [
        "The dancers are back in the town", "The dancers are passing around", "The dancers are shaking the ground", "The dancers will never back down",
        "The dancers are wearing the crown", "The neighbors are back in the town", "The neighbors are passing around", "The neighbors are shaking the ground",
        "The neighbors will never back down", "The neighbors are wearing the crown", "The players are back in the town", "The players are passing around",
        "The players are shaking the ground", "The players will never back down", "The players are wearing the crown", "The strangers are back in the town",
        "The strangers are passing around", "The strangers are shaking the ground", "The strangers will never back down", "The strangers are wearing the crown",
        "The singers are back in the town", "The singers are passing around", "The singers are shaking the ground", "The singers will never back down",
        "The singers are wearing the crown"
      ] },
      { hooks: ["Two steps to the sea","Summer on repeat"], lines: [
        "The tide is calling my name", "The tide will never be tame", "The tide is lighting a flame", "The tide is winning the game",
        "The tide is always the same", "The breeze is calling my name", "The breeze will never be tame", "The breeze is lighting a flame",
        "The breeze is winning the game", "The breeze is always the same", "The waves is calling my name", "The waves will never be tame",
        "The waves is lighting a flame", "The waves is winning the game", "The waves is always the same", "The sun is calling my name",
        "The sun will never be tame", "The sun is lighting a flame", "The sun is winning the game", "The sun is always the same",
        "The moon is calling my name", "The moon will never be tame", "The moon is lighting a flame", "The moon is winning the game",
        "The moon is always the same"
      ] },
    ],
    punk: [
      { hooks: ["We won't back down","No room for lies"], lines: [
        "The streets are standing their ground", "The streets are making a sound", "The streets are coming around", "The streets are shaking the town",
        "The streets will never be bound", "The kids are standing their ground", "The kids are making a sound", "The kids are coming around",
        "The kids are shaking the town", "The kids will never be bound", "The punks are standing their ground", "The punks are making a sound",
        "The punks are coming around", "The punks are shaking the town", "The punks will never be bound", "The bands are standing their ground",
        "The bands are making a sound", "The bands are coming around", "The bands are shaking the town", "The bands will never be bound",
        "The workers are standing their ground", "The workers are making a sound", "The workers are coming around", "The workers are shaking the town",
        "The workers will never be bound"
      ] },
      { hooks: ["Not for sale","No more control"], lines: [
        "The boss is counting the cash", "The boss is making a dash", "The boss is talking such trash", "The boss is planning a crash",
        "The boss is hiding the stash", "The mayor is counting the cash", "The mayor is making a dash", "The mayor is talking such trash",
        "The mayor is planning a crash", "The mayor is hiding the stash", "The landlord is counting the cash", "The landlord is making a dash",
        "The landlord is talking such trash", "The landlord is planning a crash", "The landlord is hiding the stash", "The banker is counting the cash",
        "The banker is making a dash", "The banker is talking such trash", "The banker is planning a crash", "The banker is hiding the stash",
        "The liar is counting the cash", "The liar is making a dash", "The liar is talking such trash", "The liar is planning a crash",
        "The liar is hiding the stash"
      ] },
      { hooks: ["We own the night","We won't obey"], lines: [
        "The sirens are burning so bright", "The sirens are calling tonight", "The sirens will put up a fight", "The sirens are breaking the light",
        "The sirens are ready to bite", "The voices are burning so bright", "The voices are calling tonight", "The voices will put up a fight",
        "The voices are breaking the light", "The voices are ready to bite", "The engines are burning so bright", "The engines are calling tonight",
        "The engines will put up a fight", "The engines are breaking the light", "The engines are ready to bite", "The crowds are burning so bright",
        "The crowds are calling tonight", "The crowds will put up a fight", "The crowds are breaking the light", "The crowds are ready to bite",
        "The speakers are burning so bright", "The speakers are calling tonight", "The speakers will put up a fight", "The speakers are breaking the light",
        "The speakers are ready to bite"
      ] },
      { hooks: ["No time to waste","The clock is ticking"], lines: [
        "The clock is running too fast", "The clock is shaking the past", "The clock will never quite last", "The clock is breaking the cast",
        "The clock is coming at last", "The train is running too fast", "The train is shaking the past", "The train will never quite last",
        "The train is breaking the cast", "The train is coming at last", "The crowd is running too fast", "The crowd is shaking the past",
        "The crowd will never quite last", "The crowd is breaking the cast", "The crowd is coming at last", "The noise is running too fast",
        "The noise is shaking the past", "The noise will never quite last", "The noise is breaking the cast", "The noise is coming at last",
        "The storm is running too fast", "The storm is shaking the past", "The storm will never quite last", "The storm is breaking the cast",
        "The storm is coming at last"
      ] },
    ],
    horror: [
      { hooks: ["A knock at the door","The moon is red"], lines: [
        "The vampire is under my bed", "The vampire is back from the dead", "The vampire is painting things red", "The vampire is inside my head",
        "The vampire has nothing to dread", "The phantom is under my bed", "The phantom is back from the dead", "The phantom is painting things red",
        "The phantom is inside my head", "The phantom has nothing to dread", "The monster is under my bed", "The monster is back from the dead",
        "The monster is painting things red", "The monster is inside my head", "The monster has nothing to dread", "The stranger is under my bed",
        "The stranger is back from the dead", "The stranger is painting things red", "The stranger is inside my head", "The stranger has nothing to dread",
        "The shadow is under my bed", "The shadow is back from the dead", "The shadow is painting things red", "The shadow is inside my head",
        "The shadow has nothing to dread"
      ] },
      { hooks: ["Don't look behind","After midnight"], lines: [
        "The graveyard is cold in the night", "The graveyard is out of the light", "The graveyard is hiding from sight", "The graveyard is glowing in white",
        "The graveyard is giving a fright", "The old house is cold in the night", "The old house is out of the light", "The old house is hiding from sight",
        "The old house is glowing in white", "The old house is giving a fright", "The dark room is cold in the night", "The dark room is out of the light",
        "The dark room is hiding from sight", "The dark room is glowing in white", "The dark room is giving a fright", "The staircase is cold in the night",
        "The staircase is out of the light", "The staircase is hiding from sight", "The staircase is glowing in white", "The staircase is giving a fright",
        "The churchyard is cold in the night", "The churchyard is out of the light", "The churchyard is hiding from sight", "The churchyard is glowing in white",
        "The churchyard is giving a fright"
      ] },
      { hooks: ["Dance of the bones","The clock strikes twelve"], lines: [
        "The skeletons are making a sound", "The skeletons are circling round", "The skeletons are shaking the ground", "The skeletons are crawling around",
        "The skeletons have finally been found", "The shadows are making a sound", "The shadows are circling round", "The shadows are shaking the ground",
        "The shadows are crawling around", "The shadows have finally been found", "The zombies are making a sound", "The zombies are circling round",
        "The zombies are shaking the ground", "The zombies are crawling around", "The zombies have finally been found", "The spirits are making a sound",
        "The spirits are circling round", "The spirits are shaking the ground", "The spirits are crawling around", "The spirits have finally been found",
        "The witches are making a sound", "The witches are circling round", "The witches are shaking the ground", "The witches are crawling around",
        "The witches have finally been found"
      ] },
      { hooks: ["The dead don't sleep","No way out"], lines: [
        "The window is turning to stone", "The window is hiding a bone", "The window is groaning alone", "The window is ringing my phone",
        "The window will never be home", "The hallway is turning to stone", "The hallway is hiding a bone", "The hallway is groaning alone",
        "The hallway is ringing my phone", "The hallway will never be home", "The mirror is turning to stone", "The mirror is hiding a bone",
        "The mirror is groaning alone", "The mirror is ringing my phone", "The mirror will never be home", "The doorway is turning to stone",
        "The doorway is hiding a bone", "The doorway is groaning alone", "The doorway is ringing my phone", "The doorway will never be home",
        "The basement is turning to stone", "The basement is hiding a bone", "The basement is groaning alone", "The basement is ringing my phone",
        "The basement will never be home"
      ] },
    ],
    love: [
      { hooks: ["Stay one more day","The summer we knew"], lines: [
        "Your smile is calling me home", "Your smile will follow me home", "Your smile is all I have known", "Your smile won't leave me alone",
        "Your smile is written in stone", "Your voice is calling me home", "Your voice will follow me home", "Your voice is all I have known",
        "Your voice won't leave me alone", "Your voice is written in stone", "Your song is calling me home", "Your song will follow me home",
        "Your song is all I have known", "Your song won't leave me alone", "Your song is written in stone", "Your laugh is calling me home",
        "Your laugh will follow me home", "Your laugh is all I have known", "Your laugh won't leave me alone", "Your laugh is written in stone",
        "Your name is calling me home", "Your name will follow me home", "Your name is all I have known", "Your name won't leave me alone",
        "Your name is written in stone"
      ] },
      { hooks: ["The last train home","A postcard for you"], lines: [
        "The postcard is fading away", "The postcard was sent yesterday", "The postcard is asking to stay", "The postcard is lost on the way",
        "The postcard will brighten my day", "The letter is fading away", "The letter was sent yesterday", "The letter is asking to stay",
        "The letter is lost on the way", "The letter will brighten my day", "The message is fading away", "The message was sent yesterday",
        "The message is asking to stay", "The message is lost on the way", "The message will brighten my day", "The picture is fading away",
        "The picture was sent yesterday", "The picture is asking to stay", "The picture is lost on the way", "The picture will brighten my day",
        "The ticket is fading away", "The ticket was sent yesterday", "The ticket is asking to stay", "The ticket is lost on the way",
        "The ticket will brighten my day"
      ] },
      { hooks: ["Under the stars","We're still the same"], lines: [
        "The lights are shining for you", "The lights are turning to blue", "The lights are bringing us through", "The lights are starting anew",
        "The lights are showing what's true", "The waves are shining for you", "The waves are turning to blue", "The waves are bringing us through",
        "The waves are starting anew", "The waves are showing what's true", "The roads are shining for you", "The roads are turning to blue",
        "The roads are bringing us through", "The roads are starting anew", "The roads are showing what's true", "The trees are shining for you",
        "The trees are turning to blue", "The trees are bringing us through", "The trees are starting anew", "The trees are showing what's true",
        "The clouds are shining for you", "The clouds are turning to blue", "The clouds are bringing us through", "The clouds are starting anew",
        "The clouds are showing what's true"
      ] },
      { hooks: ["The way back home","Meet me again"], lines: [
        "Our friends will make it all right", "Our friends will stay through the night", "Our friends will hold on so tight", "Our friends will keep up the fight",
        "Our friends will follow the light", "Our letters will make it all right", "Our letters will stay through the night", "Our letters will hold on so tight",
        "Our letters will keep up the fight", "Our letters will follow the light", "Our records will make it all right", "Our records will stay through the night",
        "Our records will hold on so tight", "Our records will keep up the fight", "Our records will follow the light", "Our stories will make it all right",
        "Our stories will stay through the night", "Our stories will hold on so tight", "Our stories will keep up the fight", "Our stories will follow the light",
        "Our dreams will make it all right", "Our dreams will stay through the night", "Our dreams will hold on so tight", "Our dreams will keep up the fight",
        "Our dreams will follow the light"
      ] },
    ],
    dark: [
      { hooks: ["The last streetlight","The empty train"], lines: [
        "The city is cold as a stone", "The city is sleeping alone", "The city is talking by phone", "The city is far from my home",
        "The city is full of unknowns", "The station is cold as a stone", "The station is sleeping alone", "The station is talking by phone",
        "The station is far from my home", "The station is full of unknowns", "The tower is cold as a stone", "The tower is sleeping alone",
        "The tower is talking by phone", "The tower is far from my home", "The tower is full of unknowns", "The basement is cold as a stone",
        "The basement is sleeping alone", "The basement is talking by phone", "The basement is far from my home", "The basement is full of unknowns",
        "The hallway is cold as a stone", "The hallway is sleeping alone", "The hallway is talking by phone", "The hallway is far from my home",
        "The hallway is full of unknowns"
      ] },
      { hooks: ["No signal here","The screen goes black"], lines: [
        "The window is fading to grey", "The window is drifting away", "The window has nothing to say", "The window is losing the day",
        "The window is waiting for day", "The signal is fading to grey", "The signal is drifting away", "The signal has nothing to say",
        "The signal is losing the day", "The signal is waiting for day", "The streetlight is fading to grey", "The streetlight is drifting away",
        "The streetlight has nothing to say", "The streetlight is losing the day", "The streetlight is waiting for day", "The mirror is fading to grey",
        "The mirror is drifting away", "The mirror has nothing to say", "The mirror is losing the day", "The mirror is waiting for day",
        "The skyline is fading to grey", "The skyline is drifting away", "The skyline has nothing to say", "The skyline is losing the day",
        "The skyline is waiting for day"
      ] },
      { hooks: ["Another long night","Echoes in the hall"], lines: [
        "The silence is holding me tight", "The silence is hiding the light", "The silence is blocking my sight", "The silence is turning to white",
        "The silence is swallowing night", "The darkness is holding me tight", "The darkness is hiding the light", "The darkness is blocking my sight",
        "The darkness is turning to white", "The darkness is swallowing night", "The cold wind is holding me tight", "The cold wind is hiding the light",
        "The cold wind is blocking my sight", "The cold wind is turning to white", "The cold wind is swallowing night", "The long night is holding me tight",
        "The long night is hiding the light", "The long night is blocking my sight", "The long night is turning to white", "The long night is swallowing night",
        "The grey fog is holding me tight", "The grey fog is hiding the light", "The grey fog is blocking my sight", "The grey fog is turning to white",
        "The grey fog is swallowing night"
      ] },
      { hooks: ["Static on the line","A voice from the past"], lines: [
        "The radio is calling my name", "The radio is still not the same", "The radio is playing a game", "The radio is hiding the flame",
        "The radio is losing its aim", "The telephone is calling my name", "The telephone is still not the same", "The telephone is playing a game",
        "The telephone is hiding the flame", "The telephone is losing its aim", "The old tape is calling my name", "The old tape is still not the same",
        "The old tape is playing a game", "The old tape is hiding the flame", "The old tape is losing its aim", "The speaker is calling my name",
        "The speaker is still not the same", "The speaker is playing a game", "The speaker is hiding the flame", "The speaker is losing its aim",
        "The echo is calling my name", "The echo is still not the same", "The echo is playing a game", "The echo is hiding the flame",
        "The echo is losing its aim"
      ] },
    ],
  };

  for (const [theme, families] of Object.entries(EXTRA_CA)) POOLS_CA[theme].push(...families);
  // Vocabulari per subtemes (festa, barri, mar…): cada família porta quatre tornades i sis versos que
  // rimen, i recorda el seu subtema perquè les estrofes parlin del mateix que la tornada.
  {
    const seen = new Set(Object.values(POOLS_CA).flat().flatMap(f => [...f.hooks, ...f.lines]).map(x => x.toLocaleLowerCase()));
    const fresh = list => list.map(x => x.trim()).filter(x => x && !seen.has(x.toLocaleLowerCase()) && seen.add(x.toLocaleLowerCase()));
    for (const [theme, subs] of Object.entries(catalan?.DATA || {})) for (const [name, { fam }] of Object.entries(subs)) for (const text of fam) {
      const [hooks, lines] = text.split(' ; ').map(part => fresh(part.split('|')));
      if (hooks.length && lines.length >= 2) POOLS_CA[theme].push({ hooks, lines, sub: theme + '/' + name });
    }
  }
  for (const [theme, families] of Object.entries(EXTRA_EN)) POOLS[theme].push(...families);

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
  // lang: 'en' (anglès) o 'ca' (català).
  function writeLyrics({ subgenre, style, sections, seed = 1, sung, lang = 'en', avoid = [] } = {}) {
    const r = rng(seed), pick = list => list[Math.floor(r() * list.length)];
    const themes = themesOf(subgenre, style), pools = lang === 'ca' ? POOLS_CA : POOLS;
    // Famílies disponibles: les del tema principal dues vegades (pesen més).
    const families = [...pools[themes[0]], ...pools[themes[0]], ...(themes[1] ? pools[themes[1]] : [])];
    const used = new Set();
    // Un vers que encara no ha sortit: de la família demanada o, si ja s'ha gastat, d'una altra.
    const normalized = line => line.toLocaleLowerCase().normalize('NFC');
    const unused = family => family.lines.filter(line => !used.has(normalized(line)));
    // Xocs de vocals entre paraules («la trompeta escalfa»): cantats es fonen i s'entenen pitjor.
    const clashes = line => { const w = line.toLowerCase().replace(/[’']/g, ' ').split(/\s+/); let c = 0;
      for (let i = 0; i + 1 < w.length; i++) if ('aeiouàèéíïòóú'.includes(w[i].at(-1)) && 'aeiouàèéíïòóúüh'.includes(w[i + 1][0])) c++; return c; };
    // Tria un vers: els que no tenen cap xoc de vocals surten tres vegades més sovint.
    const choose = list => { const best = list.filter(line => !clashes(line)); return pick(best.length && r() < .75 ? best : list); };
    const fresh = family => {
      let left = unused(family);
      if (!left.length) { const other = families.filter(f => f !== chorusFamily && unused(f).length); left = other.length ? unused(pick(other)) : family.lines; }
      const line = choose(left); used.add(normalized(line)); return line;
    };
    // La tornada: una família pròpia amb el seu hook.
    // «avoid»: títols de cançons recents (la ràdio hi passa el seu historial) que no s'han de repetir.
    const taken = new Set(avoid.map(normalized)), free = f => f.hooks.filter(h => !taken.has(normalized(h)));
    const open = families.filter(f => free(f).length);
    const chorusFamily = pick(open.length ? open : families), hook = pick(free(chorusFamily).length ? free(chorusFamily) : chorusFamily.hooks);
    const chorusAnswers = [fresh(chorusFamily), fresh(chorusFamily)];
    const verseFamilies = () => {
      // Si la tornada té subtema, les estrofes en parlen gairebé sempre.
      const all = families.filter(f => f !== chorusFamily), same = all.filter(f => chorusFamily.sub && f.sub === chorusFamily.sub && unused(f).length >= 2);
      const others = same.length >= 2 && r() < .75 ? same : all;
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
          // En català (es canta amb veu sintètica) un sol vers per frase llarga: les síl·labes tenen més temps.
          lines.push(lang === 'ca' ? fresh(family) : `${fresh(filler)}, ${fresh(family)}`);
        }
        return { text: lines.map(capital).join('\n'), phraseBars };
      };
      // La pretornada i el pont es repeteixen igual si tornen a sortir.
      if (sec.type === 'prechorus') return prechorus && prechorus.count === count ? prechorus.value : (prechorus = { count, value: make() }).value;
      if (sec.type === 'bridge') return bridge && bridge.count === count ? bridge.value : (bridge = { count, value: make() }).value;
      return make();
    });
    return { lang, hook: capital(hook), sections: result };
  }
  return { writeLyrics, POOLS, POOLS_CA, THEMES, themesOf };
});
