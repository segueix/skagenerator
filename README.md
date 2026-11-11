# Ska Generator

Taller web en català per compondre cançons instrumentals, secció per secció.

## Cançons d’exemple

A la primera pantalla hi ha **10 cançons fetes amb el taller** (5 de ska i 5 de punk), guardades com a projectes a [`exemples/`](exemples/). Un clic les obre per escoltar-les, editar-les o fer-les servir de punt de partida. Mostren la varietat que permet el sistema: estils, tempos i tonalitats diferents, canvis de tempo i de to, mig temps i doble temps, guitarres amb efectes (inclòs l’horror punk), seccions de vents, orgue, sintetitzadors, kits diferents i melodia de veu amb lletra original en català.

| Cançó | Estil | BPM | Durada | Què hi mostra |
|---|---|---|---|---|
| Rude Boys del Raval | Ska | 132 | 1:49 | Ska 2-tone clàssic: guitarra a contratemps, orgue «bubble», trompeta i saxo a les tornades, veu guia amb lletra i pujada de to a l’última tornada. |
| Skatalites al Port | Ska | 116 | 2:15 | Ska jamaicà instrumental: kit de jazz, baix caminant, trompeta, trombó gravat i saxo fent el tema, solo de saxo i pont amb la bateria a mig temps. |
| Rocksteady de Matinada | Ska | 100 | 2:19 | Rocksteady lent en La menor: one drop, baix dub, orgue de fons, trompeta amb sordina, veu guia greu i pont més lent amb coixí de sintetitzador. |
| Ska-punk a Cent Vuitanta | Ska | 168 | 1:19 | Ska-punk: estrofes a contratemps i tornades amb guitarra distorsionada, metalls a l’uníson, pont a mig temps i última tornada més ràpida i mig to amunt. |
| Dub de Sant Joan | Ska | 112 | 1:55 | Ska amb aire dub: steppers, baix dub, guitarres amb cinta i lo-fi, bateria electrònica i sintetitzadors al pont, i un final que s’alenteix. |
| Nit de Difunts | Punk | 184 | 1:17 | Horror punk a l’estil dels Misfits: guitarres «serra mecànica» doblades a banda i banda, quintes a cops avall, veu greu, orgue de terror a la intro i «whoa-oh» al pont. |
| Tres Acords i la Veritat | Punk | 200 | 1:22 | Punk del 77, ràpid i directe: corxeres a tota velocitat, distorsió de pedal, kit de rock i tornades per cridar a cor. |
| Hardcore de Barri | Punk | 216 | 1:29 | Hardcore en Si menor: D-beat a 216 BPM, fuzz, tornades en doble temps tipus skate punk i un «breakdown» a la meitat de tempo amb guitarra metal. |
| Estiu, no te’n vagis | Punk | 172 | 1:29 | Pop-punk d’estiu: guitarra aguda amb overdrive a les tornades, arpegis a les estrofes, veu aguda, pretornada que empeny i última tornada un to amunt. |
| Mig Temps | Punk | 150 | 1:33 | Punk fosc i melòdic en Mi menor: patró a mig temps, baix amb riff molt present, arpegis amb crunch, guitarra metal a les tornades i un pont que baixa de to. |

Es generen amb `node scripts/make-examples.mjs`: cada cançó està dissenyada a mà (estructura, arranjament que creix, dinàmica, tempo, to, efectes i lletra) i, per a cada instrument melòdic, el script prova 60 versions i tria la que té millor línia (vegeu «Composició: melodies i selector de qualitat»).

## Realisme: preses diferents i arranjament viu

**Que res no soni dues vegades igual**
- **Gravacions alternades a la bateria**: als kits gravats, el bombo, la caixa, el cop d’aro i el charles tenen tres gravacions de cada força (a les tecles MIDI lliures 88–103, vegeu `round-robin.json`). Cada cop repetit en fa servir una de diferent, mai la mateixa dues vegades seguides. Als kits Big Rusty i Virtuosity són preses diferents de la mateixa força; al Muldjord, que té una gravació per a cada força, són les de força veïna. Els kits GM no en tenen.
- **Guitarres doblades**: a l’horror punk i al punk, les dues guitarres són dues «preses»: una afinada 5 cèntims avall i l’altra 7 amunt, la segona amb el pedal menys saturat i més brillant, i cadascuna amb el seu propi ritme humà. Desapareix el so de «fase» de dues guitarres idèntiques.

**Arranjament**
- **Redobles variats**: el redoble del final de cada secció depèn del que ve després (petit cap a una estrofa, gran cap a una tornada, un solo o el final) i cada secció en tria un de diferent d’una col·lecció de 15.
- **Aturades de la banda**: «Final de la secció → Aturada de la banda» fa que tota la banda doni un cop junta i calli fins al redoble que entra a la secció següent. Les cançons automàtiques en fan una o dues abans d’alguna tornada.
- **Compte d’entrada**: opció del panell de la base (activada per defecte als subgèneres punk). El primer compàs són quatre cops de baqueta i la banda entra després.
- **Final**: redoble gran al penúltim compàs i cop final de tota la banda amb dos plats.

## La línia al mòbil i la base editable

- **Lliscar sense moure res**: amb el dit, la línia es llisca per sobre de les seccions i els instruments. Un toc tria l’element; només l’element triat es pot arrossegar o estirar (amb vores més amples), i un segon toc l’obre per editar-lo.
- **Zoom**: botons − ＋ i «Tota la cançó». Al mòbil, per defecte cada compàs fa 24 px; l’elecció es recorda.
- **Botons d’edició** sota la línia per a l’element triat, sense haver d’encertar vores petites:
  - secció: posar-la abans o després de la veïna, escurçar-la o allargar-la un compàs, duplicar-la just després, editar-la o eliminar-la;
  - instrument: moure’l un compàs, escurçar-lo o allargar-lo, editar-lo o eliminar-lo;
  - tros de la base: silenciar-lo o tornar-lo a fer sonar, i obrir-ne el patró i el so.
- **La base també s’edita per seccions**: cada instrument de la base té la seva pista a la línia, partida per seccions. A cada secció es pot silenciar (p. ex. una intro només de guitarra), canviar-ne el patró (bateria, baix, guitarra, orgue i coixí) o el so (bateria, baix i guitarra), i triar els platets. «Com la cançó» torna al valor general. Si una secció es queda sense cap instrument, sona en silenci.
- Així les cançons automàtiques es poden editar del tot, base inclosa. El pop-punk i el punk del 77 de vegades comencen amb una intro només de guitarra.

### Pantalles pensades per al mòbil

- **Reproductor compacte**: una sola fila (reproduir, títol i tempo, temps, aturar, exportar) amb el progrés en una barra fina; deixa més espai al contingut.
- **Botons d’edició de la línia sempre a la vista**: en triar un element, la barra de botons queda fixada just sobre el reproductor.
- **Seccions plegables**: a la pestanya «Secció», la base, els volums i l’equalitzador es despleguen quan calen (la pestanya passa de més de 5.600 px a uns 2.200); les cançons d’exemple també es pleguen. A l’ordinador tot continua obert.
- **«Escolta la secció»** és a dalt de tot de la pestanya, i les etiquetes de la línia fan servir noms curts.
- Controls de 44 px com a mínim (estrelles, selectors, botons d’esborrar) i cap desbordament horitzontal a 360 px d’amplada.

## Bateria: platets, afinació i humanització

Al panell de la base hi ha tres controls nous per a la bateria i el ritme:

- **Platets**: amb platets, sense plats (només charles), sense platets (només bombo, caixa i toms) o sense platets amb el pols del charles fet amb cops d’aro. Els plats d’accent passen al bombo. Cada secció ho pot canviar (selector «Platets» de la secció): per exemple, estrofes amb aro i tornades amb plats.
- **Afinació de la bateria**: de +2 a −6 semitons. «Greu» i «Molt greu» afinen totes les peces cap avall (bombo i toms més profunds, caixa més grossa). Combinat amb el kit Big Rusty (bombo de 24") dona el so més greu.
- **Humanització del ritme** (0–100 %): a 0 % tot va quantitzat, com una caixa de ritmes. Amb humanització, cada músic té el seu lloc respecte del temps: a l’ska el baix i els metalls van una mica endarrerits (relaxats) i la caixa arrossega; al punk la guitarra i la bateria empenyen. A més, una deriva lenta fa que cada músic s’avanci o s’endarrereixi uns mil·lisegons durant uns compassos (com una persona, no a l’atzar nota a nota), la força varia, el charles accentua els temps i el bombo és el més regular. Als tempos ràpids les desviacions es redueixen.

Kits i baixos gravats nous: **Big Rusty** (greu), **kit de club de jazz** i **kit lo-fi** (so de disc antic), **contrabaix pizzicato** i **Jazz Bass directe**. Cada subgènere en tria uns per defecte: l’ska jamaicà sona amb kit de club i contrabaix, el rocksteady amb el kit lo-fi i estrofes amb aro, el punk del 77 i l’horror punk amb Big Rusty (l’horror punk afinat −3 i amb la intro sense platets), el hardcore amb Big Rusty −2 i Jazz Bass.

## Cançó automàtica, biblioteca i puntuacions

Al panell **Cançó automàtica** tries un subgènere, la durada (de 2 a 4 minuts) i si vols melodia de veu, i el taller compon una cançó sencera: introducció, estrofes, pretornades, tornades, pont o solo i final, amb els canvis de tempo propis del subgènere (introduccions lentes, ponts a mig temps, última tornada pujada de to…). Cada cançó es desa sola a **Les meves cançons**, al navegador, i s’hi pot posar de 1 a 5 estrelles. Quan d’un subgènere tens cançons de ★4 o més, les noves cançons d’aquest subgènere s’inspiren sovint en el seu tempo, tonalitat i groove. També pots desar-hi la cançó que estàs fent a mà.

### Subgèneres amb personalitat

| Subgènere | BPM | Trets |
|---|---|---|
| Ska jamaicà (anys 60) | 110–128 | Swing marcat, bateria jazz, baix de dits, acords amb setena i ii–V |
| Rocksteady | 100–108 | Més lent i greu, trompeta amb sordina, tonalitats menors |
| Ska 2-tone | 132–156 | Nerviós, orgue i metalls amb riffs |
| Ska-punk | 160–180 | Guitarres distorsionades, ponts a mig temps |
| Punk 77 | 180–205 | Tres acords amb bVII, distorsió clàssica |
| Hardcore | 200–220 | Fuzz, acord bII i breakdown a mig temps |
| Pop punk | 165–185 | Overdrive, vi–IV–I–V, pretornada que accelera |
| Horror punk | 170–192 | Distorsió Misfits, acords prestats foscos (bVI, iv) |

El subgènere també es pot triar al panell de la base, juntament amb el **balanceig** (swing), que endarrereix les corxeres a contratemps.

### Harmonia i riffs

- Cada subgènere té paletes d’acords per secció amb acords prestats (bVII, bVI, iv), dominants secundàries (V7/vi, V7/IV) i setenes.
- Cada cançó té un **riff** propi (ritme generat de dos compassos —una cèl·lula a contratemps a l’ska o a cops avall al punk, i un segon compàs que la contesta amb una nota llarga— i contorn melòdic) que es repeteix a la intro, les tornades i el final, adaptat als acords de cada secció.
- El trombó toca el riff harmonitzat una tercera per sota de la trompeta.
- Amb la línia **Respon a la veu**, els metalls o la guitarra solista toquen fragments del riff als silencis de la melodia de veu (pregunta i resposta).
- A cada instrument melòdic (trompeta, trombó, saxo, sintetitzador i guitarra 3) l’opció **LÍNIA** tria entre línia pròpia, riff de la cançó o resposta a la veu.

### Composició: melodies i selector de qualitat

**El motiu es desenvolupa.** Les línies de vent, sintetitzador i la melodia de base ja no repeteixen la mateixa frase de quatre compassos: la secció es construeix per blocs **A – A′ – B – A″**. A′ repeteix A però acaba oberta (a la terça o la quinta de l’acord), B és una frase nova de contrast una mica més aguda i A″ tanca a la fonamental. En vuit compassos: A i A″; en dotze: A, B i A″.

**La veu segueix la lletra de debò:**
- **Síl·labes tòniques a temps**: el taller troba la tònica de cada paraula (accent gràfic; si no n’hi ha, planes les acabades en vocal, vocal + s, -en o -in, i agudes la resta; articles, preposicions i pronoms febles són àtons) i allarga la síl·laba anterior perquè la tònica caigui a la part del temps. El temps que sobra allarga les tòniques.
- **Versos repetits, mateixa melodia**: si un vers es repeteix dins la secció («Rude boys del Raval»), es canta igual.
- **Estrofes germanes**: cada frase té el seu propi atzar, de manera que dues estrofes amb la mateixa versió tenen la mateixa melodia adaptada a les síl·labes de cada vers.

**Selector de qualitat.** Per triar la millor de 30 (cançó automàtica) o 60 (exemples) versions de cada línia, a més del contorn (graus conjunts, salts compensats, registre, poques notes repetides) es valora:
- encaix amb l’harmonia (notes de l’acord als temps);
- un sol clímax per frase;
- equilibri entre repetició i novetat rítmica d’un compàs a l’altre;
- cadències: final de frase llarg i en una nota de l’acord;
- **xocs** amb les altres línies que sonen alhora (segones menors, trítons i setenes majors), comprovats contra el riff i les línies ja triades de la secció.

**La cançó sencera.** La cançó automàtica prova 8 combinacions d’harmonia i es queda la que dona més forma: estrofa i tornada amb acords diferents, tornada que comença a la tònica, arribada a la tornada des de la dominant i pont diferent de tots dos. La veu de la tornada es tria perquè quedi per sobre de la de l’estrofa.

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

## Melodia de veu (guia per cantar)

L’instrument **«Melodia de veu (guia)»** toca una melodia pensada per ser cantada, independent de les de la trompeta, el saxo o les guitarres, per saber com s’ha de cantar la cançó:

- **Segueix la lletra**: cada línia de la lletra de la secció és una frase, amb tantes notes com síl·labes (el recompte segueix les regles bàsiques del català: diftongs com *ai*, *eu* o *ou* compten una síl·laba i la dièresi marca hiat). Si hi ha menys versos que frases, la resta són pauses.
- **Sense lletra**, fa frases de dos compassos amb respiracions; al pont, la intro i el final canta frase sí, frase no, i a la tornada repeteix el motiu perquè sigui fàcil de recordar.
- **Cantable**: registre d’una desena i mitja de notes, salts de com a molt una quarta dins de la frase, notes de l’acord als temps forts i final de frase en una nota estable. «Registre» del clip: greu (veu d’home), mitjà o agut (veu de dona).
- **So**: per defecte, **clarinet gravat (VSCO 2 CE)**, l’instrument recomanat per imitar la veu: té una tessitura com la d’un cantant, pot lligar les notes i fer crescendos, i l’atac és prou clar per sentir on comença cada síl·laba. Alternatives a «So de la melodia de veu»: veu «uh», flauta, ocarina i clarinet GM. La veu «uh» té el timbre més semblant a la veu, però és més difusa.
- Es toca lligada, amb vibrato a les notes llargues, i fa servir un canal MIDI propi (el 17è).

## Canvis de tempo i ritme per instrument

- **El tempo de la cançó es veu sempre** a l’etiqueta ♩ del reproductor (a escriptori i al mòbil). Mentre sona, mostra el tempo de la secció que s’està escoltant; si alguna secció en té un de propi, hi diu «amb canvis».
- **Tempo per secció** (40–240 BPM, també fora del rang de l’estil): al camp «Tempo de la secció»; buit vol dir el de la cançó. Les seccions amb tempo propi porten la marca ♩ a la línia. Durada, temps de cada compàs, capçal, gravació de veu i WAV segueixen el mapa de tempo; els trams de base sola van al tempo de la cançó.
- **Ritme per instrument**: un tempo diferent per instrument desquadraria els compassos, així que cada instrument pot anar a **mig temps (½)** o a **doble temps (×2)** respecte de la secció. Per als instruments de la base es tria a «Volums d’aquesta secció»; per als altres, a cada clip («Ritme»). A doble temps, el patró de cada compàs es toca dues vegades; a mig temps, s’estira sobre dos compassos i les notes que canvien de compàs s’ajusten al nou acord.

### Varietat: perquè cada cançó soni diferent

Moltes cançons s’assemblaven perquè anaven a un sol tempo, en una sola tonalitat i amb el mateix ritme de bateria de principi a final. El botó **«✦ Dona-li varietat»** (pas 2, amb tres seccions o més) hi afegeix canvis amb sentit musical:

- **2 o 3 canvis de tempo** triats entre: intro lenta, pont més lent, pretornada que empeny, última tornada més ràpida, segona estrofa més tranquil·la o final que s’alenteix. Si el pont no canvia de tempo, la bateria hi va a mig temps.
- **Pujada de to** (mig to o un to) a l’última tornada i al que la segueix.
- **Un altre patró de bateria** a la segona estrofa o al pont.

Tot es pot ajustar a cada secció («Tempo de la secció», «To de la secció», «Patró de bateria») i «Treu la varietat» ho desfà.

## Volum per seccions, diverses guitarres i efectes

- **Intensitat de cada secció** (10–100 %): controla la força amb què toquen tots els instruments de la secció. Abans els metalls sonaven uns 9 dB més fluix a les estrofes de manera automàtica; ara depenen només d’aquesta intensitat.
- **Volums d’aquesta secció**: un control de volum per instrument i per a la secció sencera, en dB respecte de la cançó (és el mateix volum que hi ha a l’equalitzador de la secció).
- **Fins a tres guitarres a la mateixa secció**: Guitarra 1 (rítmica), Guitarra 2 (rítmica una octava amunt, amb un patró diferent) i Guitarra 3 (arpegis i punteig). Cadascuna té el seu canal, el seu clip, el seu so i el seu efecte.
- **Efectes de guitarra** per a cada clip: boost net, saturació de cinta, crunch, overdrive, distorsió, metal, fuzz i lo-fi, amb **guany** i **to**. La cadena és la d’un pedal i un amplificador: filtre d’entrada, saturació amb sobremostreig ×2, pantalla d’altaveu i nivell compensat (la guitarra sona igual de forta amb efecte que sense). Amb efectes de guany alt, la reverberació es redueix.

### Horror punk (estil Misfits)

L’efecte **«Horror punk (estil Misfits)»** imita el so de guitarra dels primers discos dels Misfits: distorsió tipus «serra mecànica» molt saturada amb un punt de fuzz, mitjos plens (no buidats com en el metal), greus ajustats i presència a 2,5 kHz. Es pot triar per a tota la cançó a «Efecte de guitarra» (s’aplica a les tres guitarres; cada clip el pot canviar) o només en un clip.

Amb aquest efecte, la guitarra principal també toca a la manera del grup: acords de quinta (fonamental, quinta i octava) **tot a cops avall en corxeres**, **apagats amb el palmell a les estrofes** i **oberts a les tornades**, amb **dues guitarres iguals a esquerra i dreta**. La guitarra entra neta a l’«amplificador» perquè no es distorsioni dues vegades. Per sonar com ells: estil Punk, 160–200 BPM.

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
| Bateria greu (bombo de 24", toms de 14–22") | Big Rusty Drums, Karoryfer | CC0 |
| Kit de club de jazz i kit lo-fi | Virtuosity Drums | CC0 |
| Contrabaix pizzicato | Meatbass, Karoryfer | CC0 |
| Jazz Bass directe | Growlybass, Karoryfer | CC0 |

- VSCO només publica els WAV: el build llegeix el nom de cada fitxer (nota i dinàmica), en mesura l’afinació, el remostreja i en crea les zones de tecla i de força. Les notes curtes de trompeta i trombó fan servir les mostres d’staccato, que donen els cops secs típics de l’ska.
- Les gravacions de VSCO tenen nivells molt desiguals (més de 20 dB entre notes). El build iguala la sonoritat de cada mostra: totes les notes d’una dinàmica sonen igual, la dinàmica suau queda 4 dB per sota de la forta i l’staccato 5 dB per sota del sostingut. La força dels metalls s’allunya del canvi de dinàmica perquè no saltin de mostra nota a nota.
- El trombó i el clarinet tenien un atac lent (el clarinet trigava fins a mig segon a sonar ple) i les notes curtes quedaven apagades: el build fa començar aquestes mostres just quan la nota ja sona (atac de ~20 ms, més ràpid que la trompeta). Les notes del trombó on no hi ha staccato gravat a menys de 2 semitons fan servir la gravació sostinguda retallada, i la línia pròpia del trombó es toca tal com està composta, una octava avall.
- **Segona veu de vent**: per defecte sona amb **saxo tenor gravat** en lloc de trombó. És un instrument de claus, amb una articulació més clara que la vara del trombó i l’atac més ràpid dels vents gravats; és la parella clàssica de la trompeta a l’ska jamaicà. Toca la mateixa línia (una octava sota la trompeta) uns 2 dB per sota d’aquesta. El trombó gravat (VSCO) i els GM continuen disponibles a «So de la segona veu de vent». Les mostres del saxo també s’igualen nota a nota.
- **Saxos audibles dins la banda**: el saxo i la segona veu quedaven 2,5–5 dB per sota de la trompeta i tapats per la guitarra i el baix, en el mateix registre. Ara el saxo toca en el registre agut del tenor (per sobre de la segona veu), tots dos tenen menys greus i més presència, i el volum està calibrat perquè els tres vents pesin el mateix dins la mescla.
- Totes les seccions reben el mateix guany (abans cada secció es normalitzava per separat i un instrument que passava d’una secció a l’altra pujava o baixava de volum). Un compressor suau i un limitador controlen els pics.
- FreePats ja publica aquests instruments en SF2: no cal convertir l’SFZ. El build els remostreja a 32 kHz (baixos a 22 kHz), treu els bucles i escurça les cues.
- El kit Muldjord original ocupa 209 MB i té un mapa de tecles propi: se’n construeix un kit GM nou (bombo, caixa, cop de vora, charleston, plats, ride i timbals) amb tres capes de força.
- El banc final ocupa uns 30 MB i es carrega una sola vegada. Les descàrregues i el banc convertit es guarden a `.cache/` i a la memòria cau de GitHub Actions.
- Els sons de GeneralUser GS continuen disponibles com a alternatives («… GM») als selectors de so. L’orgue continua sent el de GeneralUser: l’orgue de FreePats és una emulació sintetitzada, no una gravació.
- **Banc addicional** (`assets/extra-instruments.sf2`, uns 10 MB): les bateries Big Rusty i Virtuosity i els baixos Meatbass i Growlybass. Es publiquen en SFZ amb FLAC/WAV: el build tria unes quantes capes de força, barreja els micròfons (p. ex. bombo + ambient, caixa a sobre i a sota + ambient) i ho converteix a SF2 (FLAC descodificat amb `@wasm-audio-decoders/flac`). La web només el baixa quan una cançó fa servir algun d’aquests sons, així el banc principal no creix.
- Cada peça de cada kit s’iguala a la sonoritat de la mateixa peça del kit Muldjord (bombo amb bombo, charles amb charles…) i les capes més suaus queden 3,5 dB per sota cada una; els baixos s’igualen al baix amb dits. Un guany calibrat amb parts reals fa que canviar de kit o de baix no canviï el volum de la mescla.
- **Correcció**: el kit Muldjord era al programa 64, que al sintetitzador (SpessaSynth 4) és un «User Drum Set» GS: en realitat sonava el kit GM estàndard. Ara és al programa 69 i se sent el kit gravat de debò.

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
