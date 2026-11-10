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

## Grava la teva veu

Al pas **4 · La teva veu** (pestanya «Veu» al mòbil) pots cantar mentre sona la cançó:

- «Grava des del principi» o «Grava des del compàs…» de la secció seleccionada. Aquesta segona opció substitueix només el tros que tornes a cantar i conserva la resta.
- Mentre graves, es mostra la lletra de la secció que sona i un indicador del nivell del micròfon. ■ atura la gravació.
- La veu es grava al mateix context d’àudio que reprodueix la música i es descompta la latència d’entrada i de sortida, de manera que queda alineada. Si cal, «Sincronia» l’avança o la retarda (±300 ms), per exemple amb auriculars Bluetooth.
- Se suma a «Escolta la cançó», a l’escolta de cada secció i al WAV exportat, amb volum ajustable i un filtre que treu els sorolls greus. «Inclou la veu…» permet escoltar i exportar la música sola, i «Només la veu» en descarrega un WAV.
- Amb auriculars el micròfon grava sense processaments (so més net). Sense auriculars cal desmarcar l’opció: s’activa la cancel·lació d’eco perquè el micròfon no torni a gravar la música.
- La veu es desa en aquest navegador (IndexedDB), no dins del fitxer JSON del projecte: per portar-la a un altre lloc, descarrega-la en WAV.

## Mòbil, colors i mode fosc

- **Al mòbil** l’editor es fa pas a pas amb una barra de pestanyes inferior: **Cançó** (nom, estil, tempo, tonalitat i durada), **Base**, **Línia** i **Secció**. Cada pantalla té un botó «Següent» i, en tocar una secció a la línia, s’obre directament el seu editor. Les pestanyes mostren l’estat (base generada ✓, nombre de seccions, instruments pendents de generar). El reproductor queda sempre visible just a sobre de les pestanyes.
- Els controls tenen una mida tàctil de 44 px com a mínim i els camps fan servir lletra de 16 px perquè l’iPhone no s’apropi en tocar-los. A la línia, els noms de les pistes queden fixos en desplaçar-se i les vores de seccions i clips són més amples al tacte.
- **Colors**: cada pas té el seu color (base turquesa, línia rosa, secció ambre), i seccions i instruments tenen colors vius que funcionen en els dos modes.
- **Mode fosc**: segueix el del sistema i es pot canviar amb el botó ☾/☀ de la capçalera; l’elecció es recorda en aquest navegador.

## Instruments gravats nota a nota

Per defecte sonen instruments gravats per músics, nota a nota i amb diverses dinàmiques, que el build converteix i afegeix al banc:

| Instrument | Font | Llicència |
|---|---|---|
| Trompeta i trombó (sostinguts i staccato) | VSCO 2 Community Edition | CC0 |
| Saxo tenor | FreePats (amb mostres de VSCO) | CC0 |
| Baix amb dits i amb pua | FreePats, Yamaha RBX d’Andrea Biasior | CC0 |
| Guitarra neta | FreePats FSBS (pont) | CC0 |
| Bateria | Muldjord Kit, de Lars Muldjord (via FreePats) | CC BY 4.0 |

- VSCO només publica els WAV: el build llegeix el nom de cada fitxer (nota i dinàmica), en mesura l’afinació, el remostreja i en crea les zones de tecla i de força. Les notes curtes de trompeta i trombó fan servir les mostres d’staccato, que donen els cops secs típics de l’ska.
- Les gravacions de VSCO tenen nivells molt desiguals (més de 20 dB entre notes). El build iguala la sonoritat de cada mostra: totes les notes d’una dinàmica sonen igual, la dinàmica suau queda 4 dB per sota de la forta i l’staccato 5 dB per sota del sostingut. La força dels metalls s’allunya del canvi de dinàmica perquè no saltin de mostra nota a nota.
- Totes les seccions reben el mateix guany (abans cada secció es normalitzava per separat i un instrument que passava d’una secció a l’altra pujava o baixava de volum). Un compressor suau i un limitador controlen els pics.
- FreePats ja publica aquests instruments en SF2: no cal convertir l’SFZ. El build els remostreja a 32 kHz (baixos a 22 kHz), treu els bucles i escurça les cues.
- El kit Muldjord original ocupa 209 MB i té un mapa de tecles propi: se’n construeix un kit GM nou (bombo, caixa, cop de vora, charleston, plats, ride i timbals) amb tres capes de força.
- El banc final ocupa uns 30 MB i es carrega una sola vegada. Les descàrregues i el banc convertit es guarden a `.cache/` i a la memòria cau de GitHub Actions.
- Els sons de GeneralUser GS continuen disponibles com a alternatives («… GM») als selectors de so. L’orgue continua sent el de GeneralUser: l’orgue de FreePats és una emulació sintetitzada, no una gravació.
- No s’han fet servir les biblioteques de Karoryfer: només es distribueixen en SFZ amb FLAC/OGG i caldria un descodificador més; FreePats ja cobreix baix, guitarra i bateria amb mostres reals i llicències lliures.

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

El build descarrega la versió oficial fixada a `soundbank-source.json`, comprova el SHA-256 i n’extreu els presets de guitarra, baix, metalls, saxo, orgue i sintetitzadors (amb les variacions GS de trompeta i trombó) i sis kits de bateria. La selecció de GeneralUser ocupa aproximadament 9,2 MB i, amb els instruments gravats, el banc publicat en fa uns 30 i es publica a la mateixa web; no hi ha peticions a proveïdors d’àudio durant la reproducció. `.cache/` conserva la font per als builds següents.

El banc conserva les mostres i els moduladors dels presets seleccionats. Els sons de guitarra neta/apagada serveixen per a l’ska, i els de guitarra distorsionada/saturada per al punk. La interpretació introdueix petits canvis de força, temps i ordre de les cordes, sempre a partir de la llavor del projecte. El baix i els dos metalls tenen canals i panoràmiques pròpies.

La primera generació carrega el banc de mostres. La pantalla informa del progrés i permet tornar-ho a provar si falla. El càlcul es fa en un worker per mantenir la interfície disponible. L’escolta individual, la cançó sencera i el WAV fan servir les mateixes mostres estèreo.

Crèdits, llicències i modificacions del banc: [licenses/THIRD_PARTY_NOTICES.md](licenses/THIRD_PARTY_NOTICES.md).

## Publicació i compatibilitat

La web necessita `dist/sample-worker.js` i `dist/assets/generaluser-ska-punk.sf2` per reproduir les mostres enregistrades. GitHub Pages publicat directament des de l’arrel de `main` només processa els fitxers de codi font amb Jekyll i no construeix aquestes dependències: la pàgina es mostra, però el motor de mostres no hi és. Per publicar els instruments enregistrats cal fer servir el workflow `.github/workflows/deploy-pages.yml` amb l’origen de GitHub Pages configurat com a **GitHub Actions** (Settings → Pages → Build and deployment → Source).

Si falta un recurs o el motor d’àudio falla, el generador reintenta la càrrega amb un worker nou. Si el segon intent falla, informa de l’error i conserva el projecte per tornar-ho a provar. No substitueix les mostres per sons sintetitzats ni desa una part fallida com a generada. El build versiona els scripts i el worker segons el seu contingut per evitar que el navegador reutilitzi un motor anterior després d’una actualització.
