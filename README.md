# Ska Generator

Taller web en català per compondre cançons instrumentals, secció per secció.

## Flux de treball

Hi ha una sola vista, que es treballa de baix cap amunt:

1. **Durada i base musical.** Es marca la durada de la cançó en compassos (amb el temps equivalent, fins a 6 minuts) i es genera la base: bateria i baix (en urban, bateria electrònica i baix sintetitzat) que sonen durant tota la cançó. Es poden triar els instruments de la base, el patró de bateria, la línia de baix i els sons, i escoltar-la. «Genera una altra base» proposa una progressió i uns patrons nous.
2. **La línia de la cançó.** Un clic a la fila «Seccions» afegeix una secció en aquell punt. Cada secció té tipus (intro, estrofa, tornada…), inici i durada (1–32 compassos), i es treballa amb el cursor:
   - **Estirar per la vora dreta** l’allarga o l’escurça i totes les seccions i instruments que venen després es desplacen. Si la cançó acabava amb l’última secció, la durada total la segueix (fins a 6 minuts).
   - **Estirar per la vora esquerra** n’avança o n’endarrereix l’inici dins de l’espai lliure.
   - **Arrossegar-la** a un espai lliure la mou (amb els instruments que sonen només dins seu); deixar-la anar **sobre una altra secció** canvia l’ordre i la resta es reorganitza.
   - Amb el teclat: fletxes per allargar o escurçar, Maj + fletxes per moure.
   On no hi ha cap secció només sona la base; si la cançó acaba amb base sola, l’últim tram fa de final.
3. **Instruments un a un.** Cada instrument és un **clip** a la seva pista: comença amb la secció on l’afegeixes, però es pot moure i estirar per les dues vores, de manera que pot començar o acabar a mitja secció i travessar-ne diverses. Un clic en un espai buit d’una pista n’afegeix un altre clip. Cada clip es genera per separat («Genera», «Genera’n una altra») i després es pot escoltar la secció o tota la cançó. Estirar o moure un clip no el torna a generar. Els clips que entren en seccions del mateix tipus repeteixen per defecte la mateixa idea, com una tornada. «Allarga fins aquí els instruments de…» estén fins a la secció actual els clips que acabaven a l’anterior.

Canviar tempo, tonalitat, estil, patrons o sons no esborra res: tot es torna a calcular a partir de les llavors desades. Els projectes anteriors es converteixen automàticament: cada part passa a ser una secció i els instruments de seccions contigües s’uneixen en un sol clip.

La bateria segueix la forma de cada secció (plat a l’entrada, redobles, intro que es construeix, pont més buit i crescendo abans de la tornada). Cada tram es renderitza amb una cua d’1,5 s que sona sobre l’inici del següent.

Si la reproducció falla, l’avís mostra el motiu concret. Si Tone.js no pot reproduir, s’utilitza directament Web Audio.

## So més autèntic i equalitzadors

- **Més sons del banc.** Saxo tenor i orgue (contratemps, «bubble», sostingut…) com a instruments nous; l’orgue també pot formar part de la base. Trompeta brillant o amb sordina, trombó càlid i kits de jazz, sala i escombretes. En ska, «Segons l’estil» fa servir el kit de jazz, com els bateries jamaicans.
- **Interpretació.** Els metalls entren amb una lleugera pujada d’afinació, fan crescendo a les notes llargues i hi afegeixen vibrato. La bateria té notes fantasma a la caixa, que en ska va lleugerament endarrerida i en punk, una mica avançada.
- **Mescla.** Cada instrument porta una corba d’equalització de partida (baix rodó, guitarra prima i brillant, metalls presents) i una reverberació pròpia (baix sec, metalls amb sala). La banda passa per un compressor de bus suau i un limitador.
- **Equalitzadors.** A «Equalitzador de la cançó» cada instrument té greus (120 Hz), mitjos (900 Hz), aguts (6 kHz) i volum, més una fila per a la mescla total. A cada secció hi ha un equalitzador propi: per defecte segueix el de la cançó i, en moure un control, aquella fila passa a ser de la secció. Si està sonant, el canvi s’escolta de seguida. L’equalitzador s’aplica a la sortida de cada instrument dins del worker, i la reverberació segueix el volum de l’instrument.

## Estils i instruments

Hi ha ska, punk i urban. L’ska té una selecció de 100–180 BPM (128 per defecte) i el punk de 140–220 BPM (180 per defecte). Urban ofereix 70–160 BPM (95 per defecte), sintetitzador melòdic, sintetitzador d’acords, baix sintetitzat i bateria electrònica. Les cinc propostes inclouen urban sincopat, trap a mig temps, dembow electrònic, urban melòdic i urban amb síncopes. Canviar d’estil selecciona la seva formació inicial; després es poden combinar lliurement els nou instruments, també per secció.

Cada estil ofereix una preselecció de tonalitats majors i menors adequada per treballar amb guitarra i metalls. Són decisions de configuració del taller, no restriccions teòriques dels gèneres.

La música instrumental es prepara amb mostres enregistrades de GeneralUser GS 2.0.3, mitjançant SpessaSynth Core 4.4.9 dins d’un Web Worker. Tone.js 14.8.49 s'utilitza per reproduir les parts i la cançó sencera al navegador; si la biblioteca externa no es carrega, es manté el reproductor nadiu Web Audio. El WAV continua utilitzant exactament la mescla de les mateixes mostres. Les lletres són anotacions: no es genera veu ni cant. No necessita claus d’API ni serveis de generació externs.

## Triar guitarres, baixos i bateries

A «Instruments base de la cançó» es trien els instruments que sonaran i, a «So de guitarra», «So de baix» i «Kit de bateria», se selecciona un preset enregistrat. La guitarra té els sons net, apagat, saturat i distorsionat; el baix es pot tocar amb dits o pua; la bateria ofereix els kits acústic, rock i electrònic. «Segons l'estil» conserva els presets originals (ska net/baix amb dits/bateria acústica; punk distorsionat/baix amb pua/bateria rock).

Tone.js gestiona la reproducció de les seccions ja renderitzades, no sintetitza les notes ni carrega els bancs SFZ. Els presets de la primera fase pertanyen al SF2 GeneralUser GS existent; no són encara les biblioteques FreePats ni Karoryfer. La biblioteca Tone.js es carrega des d'un CDN fixat a 14.8.49, amb retorn automàtic a Web Audio si no està disponible. Per a instal·lacions sense xarxa, cal servir-ne una còpia local autoritzada.

## Ús

Compila la web i serveix la carpeta `dist/` des d’un servidor web estàtic (HTTPS o localhost). Prem «Nova cançó», marca la durada, genera la base i després les seccions i els instruments. Quan vulguis, escolta la cançó completa o exporta-la en WAV estèreo de 44.100 Hz i 16 bits.

L’esborrany es desa al navegador. «Desa el projecte» exporta un JSON amb la configuració, les anotacions i les llavors necessàries per reconstruir el so. «Obre un projecte» permet recuperar-lo en un altre navegador. La lletra no es fa servir per compondre la melodia.

## Desenvolupament

Requereix Node.js 22 o posterior. Les versions de les dependències es fixen a `package-lock.json`:

```sh
npm ci
npm test
npm run check
npm run build
```

`dist/` conté la web estàtica preparada per publicar. Per a GitHub Pages, cal publicar el resultat de `npm run build` (carpeta `dist/`), que inclou el worker i el banc de mostres. La configuració de publicació a ChatGPT Sites es troba a `.openai/hosting.json`.

El motor original `radioambient.js` conserva la seva API. L’editor fa servir `composeSongPart` per a la composició i `SkaSampleAudio.render` per al so enregistrat. `songPartSamples` es conserva per compatibilitat amb el motor antic; no s’utilitza en l’escolta ni l’exportació de l’editor.

## Banc de mostres i interpretació

El build descarrega la versió oficial fixada a `soundbank-source.json`, comprova el SHA-256 i n’extreu els presets de guitarra, baix, metalls, saxo, orgue i sintetitzadors (amb les variacions GS de trompeta i trombó) i sis kits de bateria. La selecció ocupa aproximadament 9,2 MB i es publica a la mateixa web; no hi ha peticions a proveïdors d’àudio durant la reproducció. `.cache/` conserva la font per als builds següents.

El banc conserva les mostres i els moduladors dels presets seleccionats. Els sons de guitarra neta/apagada serveixen per a l’ska, i els de guitarra distorsionada/saturada per al punk. La interpretació introdueix petits canvis de força, temps i ordre de les cordes, sempre a partir de la llavor del projecte. El baix i els dos metalls tenen canals i panoràmiques pròpies.

La primera generació carrega el banc de mostres. La pantalla informa del progrés i permet tornar-ho a provar si falla. El càlcul es fa en un worker per mantenir la interfície disponible. L’escolta individual, la cançó sencera i el WAV fan servir les mateixes mostres estèreo.

Crèdits, llicències i modificacions del banc: [licenses/THIRD_PARTY_NOTICES.md](licenses/THIRD_PARTY_NOTICES.md).

## Publicació i compatibilitat

La web necessita `dist/sample-worker.js` i `dist/assets/generaluser-ska-punk.sf2` per reproduir les mostres enregistrades. GitHub Pages publicat directament des de l’arrel de `main` només processa els fitxers de codi font amb Jekyll i no construeix aquestes dependències: la pàgina es mostra, però el motor de mostres no hi és. Per publicar els instruments enregistrats cal fer servir el workflow `.github/workflows/deploy-pages.yml` amb l’origen de GitHub Pages configurat com a **GitHub Actions** (Settings → Pages → Build and deployment → Source).

Si falta un recurs o el motor d’àudio falla, el generador reintenta la càrrega amb un worker nou. Si el segon intent falla, informa de l’error i conserva el projecte per tornar-ho a provar. No substitueix les mostres per sons sintetitzats ni desa una part fallida com a generada. El build versiona els scripts i el worker segons el seu contingut per evitar que el navegador reutilitzi un motor anterior després d’una actualització.
