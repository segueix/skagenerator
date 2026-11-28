# Radio Spam

Una ràdio de ska i punk que compon cada cançó al navegador. A sota hi continua havent el taller de cançons (l’antic Ska Generator).

## La ràdio

- **Quatre emissores**: Ska-Punk, que barreja les altres dues alternant estils (tres de cada quatre cançons canvien d’estil), Ska (jamaicà, rocksteady, early reggae, 2-tone, nutty sound, ska-swing, ska-punk) i Punk (punk del 77, street punk / Oi!, garage, post-punk, skate punk, hardcore, pop-punk, horror punk, punk californià de l’East Bay a l’estil de Green Day i Rancid). En triar-ne una s’obre el reproductor, es compon la primera cançó i comença a sonar sola.
- **Cada emissora té la seva adreça** (`?emissora=ska`, `punk`, `ska-punk` o `batucada`; a la Batucada, amb l’estil triat, `&estil=percudium`, `samba`, `samba-reggae` o `ijexa`), que es veu a la barra d’adreces i al títol de la pestanya, i el botó «Comparteix» del reproductor l’envia amb el full de compartir del dispositiu (o en copia l’enllaç). L’enllaç compartit és la pàgina de l’emissora (`punk/`, `ska/`, `ska-punk/`, `batucada/` i `batucada/percudium/`, `batucada/samba/`…): a WhatsApp i a les altres apps surt amb el títol «Escolta Punk a Ràdio SPAM» (o l’emissora que toqui) i una imatge pròpia de cada emissora, i porta de seguida a la ràdio. Les pàgines i les etiquetes Open Graph es generen en compilar (`scripts/share-pages.mjs`; l’adreça pública es pot canviar amb `SITE_URL`) i les imatges, de 1200 × 630, amb `node scripts/share-images.mjs` (carpeta `share/`). Qui obre l’enllaç veu un avís amb l’emissora i un botó per escoltar-la (el navegador demana un toc abans de sonar). Les cançons no es comparteixen: cadascú sent les que es componen al seu dispositiu. Els botons enrere i endavant del navegador entren i surten de l’emissora.
- **Secció de vents de l’ska amb dues trompetes gravades**: a més de la trompeta VSCO i del segon trompetista (una tercera per sota), un tercer trompetista amb una altra trompeta gravada (audio/samples/trompeta2, banc 5 programa 56) dobla la principal a l’uníson, a l’altre costat; les notes per sobre del Re5 les toca una octava avall. Les trompetes sonen uns 1,7 dB més fortes. Només amb el so de trompeta per defecte i no al punk.
- **Dos trombons amb les dues trompetes**: a l’ska, sempre que sonen les dues trompetes també sonen dos trombons: el principal (VSCO) i un altre trombó gravat (audio/samples/trombo2, banc 5 programa 57) que el dobla a l’uníson a l’altre costat (per sobre del Sol4, una octava avall). Si la secció no porta trombó, el trombó harmonitza la línia de la trompeta amb notes de l’acord, una octava avall, i segueix el volum i l’equalitzador de la trompeta.
- **Batucada: pols de fons, ritmes diferents i senyal del mestre**: el bombo toca el centre (el cop greu) a tots els temps a tots els ritmes i, amb els surdos 1 i 2, no baixa als diàlegs: és el fons que marca el pols. Els surdos i el bombo porten harmònics afegits (en compilar el banc) perquè se sentin també pels altaveus petits. Tres ritmes nous amb una altra base de surdos i bombo: maracatu, baião i samba-funk. El xiulet del mestre només sona a l’inici de la cançó i com a senyal, fort i per sobre de tota la colla: abans de cada canvi de ritme, un llarg i dos curts (al tercer i al quart temps de l’últim compàs); abans de cada aturada, un sol xiulet llarg que s’acaba just abans del cop.
- **Batucada amb frase i bombo que pregunta i resol**: cada cançó de la ràdio Batucada té una frase pròpia que toca el tabal (tres compassos iguals i, al quart, un final diferent); abans de cada tornada el repique repeteix aquell final mentre la caixa baixa i els surdos mantenen el pols. El bombo fa servir el centre per resoldre (temps forts, primer temps de cada frase, cop final) i el marge per preguntar (últim compàs de cada frase i dos cops curts abans de cada represa o breca). A l’editor, si s’edita la fila del tabal o es canvia el ritme, mana la graella.
- **Historial fàcil d’esborrar i d’organitzar**: la × de cada cançó l’esborra de seguida amb «↶ Desfés» uns segons (sense confirmacions); «☑ Selecciona» marca diverses cançons (o totes les del filtre) per esborrar-les o afegir-les a una llista; «🧹 Neteja» esborra d’un cop les 👎, les que no tenen vot, comentari ni llista, o les de fa més d’un mes (sense 👍 ni llista), amb el nombre de cançons de cada opció. Per organitzar: cerca per títol, estil o comentari; ordre (més recents, més antigues, títol A–Z, més sonades, millor valorades, més llargues; es recorda), i llistes pròpies («＋ Llista nova», menú 📁 de cada cançó), que surten com a filtres i es poden reanomenar o esborrar sense perdre les cançons. Les cançons en ús no s’esborren i les de les llistes no cauen quan l’historial és ple.
- **Compon l’inici de la teva batucada**: només a l’emissora Batucada i abans que soni res (un cop sona, ja no es pot canviar): la targeta de la Batucada obre una pantalla de preparació amb l’editor plegable «🥁 Compon l’inici» dels primers segons de la cançó (uns 6 s: de 2 a 4 compassos segons el tempo), en tres passos i sense editar cops: 1) el timbal (o instrument) de fons; 2) el seu ritme, entre 15 patrons fets (negres, samba, marxa, samba-reggae, ijexá, maracatu, baião, samba-funk, clau…), amb redoble final si es vol; 3) els xiulets del mestre, entre 10 patrons (per defecte, dos curts i un llarg), que s’ajusten sols al ritme triat: cada xiulet cau sobre el cop del timbal més proper. També l’estil i el tempo de la cançó. «Escolta l’inici» el fa sonar per poder-lo canviar; «Comença la batucada» engega l’emissora amb una primera cançó que comença amb aquest inici (si la casella «Comença la primera cançó amb aquest inici» està marcada) i, després, hi entra tota la colla. L’editor recorda l’últim inici i si estava plegat.
- **Inici gravat amb la veu**: a l’editor de l’inici, «🎤 Amb la veu» grava 6 s del ritme fet amb la boca («ta ta ta taaa»…). L’app en detecta els cops (alguns més fluixos i alguns més forts), els sons llargs i el tempo, tria el timbal que s’hi escau més (greu o agut segons el to de la veu i la densitat de cops) i fa sonar la frase dues o tres vegades (l’intro s’allarga el que cal) amb un sol xiulet llarg abans que entri la colla. Primer cal escoltar-la («Escolta l’inici») per validar-la; després ja es pot començar la batucada.
- **Volums de l’inici**: el timbal i el xiulet de l’inici tenen cadascun un volum de «Fluix» a «Molt fort»; després, tota la colla s’adapta al volum del timbal i els xiulets de la cançó (canvis de ritme i aturades), al del xiulet.
- **Solos a la batucada**: les cançons de batucada tenen solos d’un instrument (caixa, repique, tamborim, agogô, xocalho o tabal; mai la cuíca) sempre acompanyat dels surdos o del bombo, i de vegades dos o tres solos enllaçats d’instruments diferents que dialoguen: es passen la paraula (torns d’un o dos compassos) i qui la pren imita el ritme de la frase que acaba de sentir i la contesta amb la seva; cada solista té un motiu propi (pregunta i resposta) que varia quan el repeteix. Al final del solo, tots els solistes junts fan només dos cops abans que torni a entrar la colla. Tots els instruments junts només toquen d’un en un o de dos en dos cops (aturades, final i final del Percudium): ja no hi ha convenções ni traques de cops de tots.
- **Ska amb mans de músic**: la guitarra rítmica de l’ska fa cops secs, oberts o apagats amb una mica de variació de força i de temps, i cada tipus de secció repeteix una manera de tocar cada quatre compassos (p. ex. a l’estrofa, contratemps secs i l’últim del quart compàs apagat; a la tornada, aquell cop s’obre). I quan s’acaba una secció, baix, bombo i guitarra preparen junts l’entrada de la següent amb un gest (el baix anticipa la nota que ve a l’última corxera amb el bombo i la guitarra s’hi calla; o hi puja per semitons; o tots piquen al tercer temps i deixen el quart buit); cada pas (estrofa → tornada…) tria el seu gest una vegada i el repeteix sempre que torna.
- **Guitarra d’skank**: la guitarra rítmica de l’ska fa posicions de guitarra de debò a les quatre cordes agudes (Re, Sol, Si i Mi) i passa d’un acord a l’altre movent-se al mínim pel mànec; cada cop és un cop amunt (de l’aguda a la greu, 8–12 ms entre cordes) amb el «xic» de les cordes apagades just abans, i sona més prima i brillant (sense el cos greu que xocava amb el baix i l’orgue) i amb una mica més de reverberació.
- **Ska més variat i més real**:
  - *Harmonia*: cada subgènere té moltes més progressions (frases de vuit compassos, vamps de dos acords, girs de jazz) i cada cançó tria les seves; hi ha compassos amb dos acords («ii7|V7») que segueixen el baix, la guitarra, l’orgue i el piano, i les seccions sovint tanquen amb un gir al darrer compàs (ii–V, IV–V…). Les cançons desades abans sonen com sempre.
  - *Formes*: blues de 12 compassos (amb el blues de jazz al jamaicà, l’ska-swing i el nutty), forma AABA, una secció «dub» amb bateria i baix sols, un «tag» (la tornada curta repetida abans del final) i, als instrumentals, estrofes i tornades de 12 compassos.
  - *Baix i bateria per estil*: baix caminant de jazz (tres camins que s’alternen) i baix de rocksteady; bateria amb notes fantasma a la caixa, shuffle de swing amb ride i rockers amb charles a semicorxeres. Cada subgènere en fa servir els seus.
- **Orgue Hammond gravat**: l’orgue fa servir un Hammond B3 de 1957 gravat a través d’un Leslie girant («Real Rotor Organ», Indiginus; vegeu `audio/samples/orgue-rotor/FONT.txt`) en lloc de l’orgue sintetitzat, amb la percussió del 3r harmònic a l’atac i un bucle d’una volta del rotor perquè el gir no es talli; és al banc de guitarres, que les cançons amb orgue es baixen.
- **Acords d’skank gravats**: amb la guitarra rítmica per defecte, l’ska toca acords sencers de guitarra gravats (major, menor, 7 i m7, a les dotze fonamentals, dues variants que s’alternen; vegeu `audio/samples/guitarra-ska/FONT.txt`) en lloc de cordes soltes; són al banc de guitarres (`assets/guitar-instruments.sf2`), que les cançons d’ska es baixen. Els altres acords (disminuïts, suspesos…) continuen amb les cordes soltes.
- **Trombó legato gravat**: les notes lligades del trombó principal (quan canvia de nota sense cop de llengua) sonen amb mostres tretes d’un passatge legato de trombó real (vegeu `audio/samples/trombo-legato/FONT.txt`); les notes repetides i les separades continuen amb el cop de llengua de sempre. Només amb el so de trombó per defecte.
- **Short**: la casella «⚡ Short» de la pantalla de la Batucada fa que les cançons durin entre 60 i 90 segons: molt intenses, amb diversos canvis de ritme, una aturada curta i una tornada final al màxim (sense allargar-se fins a cansar).
- **Visualitzador VaTuCalla! (videoclips de batucada)**: al reproductor de l’emissora Batucada, el botó «🎬 Visualitzador VaTuCalla!» obre la cançó a pantalla completa amb formes de colors que canvien amb el so (greus, mitjos i aguts) i els noms dels instruments que sonen, cadascun del seu color. Set dissenys: «La colla» (dibuixos de retalls de paper: una colla d’homes d’entre 40 i 55 anys —entrades, canes a les temples, bigotis, barbes i alguns amb ulleres— amb samarretes de colors, en formació de batucada a la plaça; tothom porta el seu instrument, el mestre toca el repique i xiula amb el xiulet de samba, i cadascú toca quan sona i en surt una bafarada amb el so: «BUM!», «TÁ!», «FIUUU!»…), «La urna que balla» (sàtira naïf i de molts colors de les «Eleccions a l’estat veí»: els vots no paren d’entrar a una urna amb cara —i encara més a cada cop de surdo o de bombo— i, a baix, els eslògans de campanya («Rodalies puntuals!», «Ara sí que es complirà la immersió lingüística!»…) apareixen i desapareixen un darrere l’altre en lletres grans, cadascun d’un color; als últims segons, la urna es buida i només en surt confeti amb «Fins d’aquí a 4 anys!»), «Alerta!» (sàtira naïf de les alertes meteorològiques al mòbil: a un mòbil inventat hi van arribant avisos —pluges torrencials, onada de calor, nevades, sequera…— que el fan vibrar, mentre al fons fa just el temps contrari un vianant va equipat per a l’avís, no per al temps que fa, i a baix l’avís es repeteix en lletres grans perquè es vegi que no hi té res a veure; al final arriba l’avís «Mireu per la finestra»), «Tambors animats» (els instruments dibuixats amb ulls, que salten quan sonen i criden «BUM!», «TÁ!», «DLIM!»…), «Carnaval» (serpentines i confeti amb els colors del Brasil; cada cop en dispara del seu color), «Calçadão» (les ones blanques i negres de Copacabana, amb pedretes de colors a cada cop) i «Rio tropical» (posta de sol, el Pão de Açúcar, palmeres i hibiscs que floreixen a cada cop); se n’hi poden afegir més a `DESIGNS` de `visualizer.js`. El nom de la cançó es pot editar i surt a dalt, centrat i en blanc; «VaTuCalla!» surt sempre a baix a la dreta. «Grava vídeo» exporta la cançó en MP4 (H.264 i AAC si el navegador els té; si no, WebM) en format horitzontal 16:9, vertical 9:16 o quadrat, amb l’àudio original, i amb la qualitat triada: «Alta» (1080p, ≈ 77 MB per minut), «Mitjana» (1080p, ≈ 24 MB/min, per defecte), «WhatsApp» (720p, ≈ 10 MB/min: una Short de 90 s fa uns 8–15 MB) o «Mínima» (480p, ≈ 5 MB/min); en obrir la cançó es mostra quant ocuparà el vídeo sencer i, en desar-lo, la mida real: es grava en temps real i «Atura i desa» desa el tros gravat fins aleshores.
- **Batucada: què sona ara**: al reproductor de l’emissora Batucada apareixen tots els instruments del kit (surdos, caixa, repique, tamborim, agogô, xocalho, cuíca, xiulet, tabal i bombo) i cada un s’encén en el moment que sona.
- **Emissora Batucada**: cançons només de percussió amb el kit de batucada (surdos 1, 2 i 3, caixa, repique, tamborim, agogô, xocalho, cuíca, tabal i bombo; tabal i bombo enregistrats, a tots els ritmes). Cada cançó tria un ritme diferent de l’anterior, amb el seu tempo: samba (124–144 BPM), samba-reggae (106–118), ijexá (108–122), maracatu de baque virado (96–112), baião (112–128), samba-funk (100–112) o Percudium (94–102). La forma és la d’una batucada de carrer: crida del repique i entrada de tots, ritme base i una variació que s’alternen i creixen, «paradinha» curta i poc freqüent (surdos, caixa, agogô i xocalho), solos de repique, breques (cop de tots i silenci), de vegades una última tornada una mica més ràpida, i cop final. Dura de 2 a 4 minuts aproximadament. Dins de cada cançó el ritme canvia (passa per un o dos ritmes més, cadascun amb el seu tempo, i torna al principal), i el mestre avisa amb el xiulet a l’entrada, abans de cada breca i de cada canvi de ritme. Quan l’energia baixa, el volum baixa poc; als moments clau (l’entrada de tots, la represa després d’una breca, l’última tornada i el final) puja molt. Una de cada tres cançons és compacta: té convenções en què tota la batucada toca la mateixa figura a temps exacte. La cuíca només sona als seus arranjaments: els solos de cuíca, on encadena sis cops enregistrats en cinc frases rítmiques extretes de la interpretació (la cuíca de la graella no toca a les cançons de la ràdio). Sona com una banda: surdos, caixa, tamborim i xocalho els toquen dos o tres músics, cadascun al seu canal (un al centre i els altres a banda i banda), amb l’afinació una mica diferent i un pèl a destemps (uns mil·lisegons abans o després; a les convenções, gairebé junts). A la meitat de les seccions fortes, el segon músic de surdo 3, caixa i tamborim fa un contraritme: una altra figura alhora. El repique, l’agogô, la cuíca i el xiulet són d’un sol músic. Les cançons són molt enèrgiques: a partir d’energia 85 la caixa omple totes les semicorxeres amb cops fluixos, el xocalho no para i el repique fa una virada cada quatre compassos; totes les tornades pugen, i l’entrada, l’última tornada i el final pugen encara més. Cada ritme té el seu balanç (micro-temps): al samba la segona semicorxera de cada temps s’endarrereix i la quarta s’avança; el samba-reggae i l’ijexá tenen un balanç més arrodonit. L’agogô alterna les dues campanes (aguda i greu) segons el ritme. Al samba, cada surdo apaga la pell (cop «abafado») quan toca l’altre, i el surdo 3 improvisa: frases de dos compassos que canvien al llarg de la secció, amb cops oberts i apagats, i un redoble al final de cada frase de quatre compassos. Els surdos apagats i la campana greu es fan a partir de les gravacions amb `node scripts/batucada-derived.mjs`: el surdo apagat és la mateixa gravació (amb el soroll natural de la pell i sense canviar-ne el to) que s’esmorteeix de manera progressiva, amb els aguts només una mica més suaus (sense saturació). Als surdos, els altres músics de la banda toquen gairebé tan fort com el principal (el so original de la batucada), amb l’afinació una mica diferent. El xocalho sona més fort que abans. Cada surdo talla el so anterior del mateix tambor (obert o apagat), com quan es torna a picar la pell: els redobles del surdo 3 que improvisa ja no s’acumulen. Al final de cada part, un limitador amb anticipació abaixa els pics abans que arribin (sense deformar l’ona), en lloc de saturar-los. Els nivells de la batucada estan ajustats perquè el final i els cops de tots arribin al limitador amb poc excés (com a molt uns 3 dB): els cops finals i les aturades són els més forts de la cançó però no es forcen a 127, els moments clau pugen +1 dB i no hi ha compressió de bloc (amb tants cops al màxim, movia el guany al ritme de l’ona dels surdos i el so del final es distorsionava). Els surdos de la batucada no van a la reverberació (deixava un to metàl·lic després dels cops) i, per recuperar el cos que els donava la sala, sonen al nivell màxim del kit. **Percudium** és un subgènere fet a partir d’un enregistrament de referència (uns 97 BPM): textura molt densa (caixa i xocalho a totes les semicorxeres, tamborim atapeït, arrossegaments de caixa abans dels accents), accents sincopats a les semicorxeres 1, 7, 10 i 14, més caixa i repique, amb els surdos al seu so original (sense rebaixar-los ni retallar-ne els greus), banda de tres amb contraritmes a totes les seccions fortes, més sala i més separació entre músics. Les cançons Percudium tenen forma pròpia: comencen amb la caixa o el repique fent un ritme (un sol músic) i, alhora, el xiulet del mestre (dos xiulets curts i un de llarg), uns 5 segons; després entren tots els instruments alhora, sense cuíca (al Percudium no n’hi ha). Hi ha diàlegs en què tots continuen tocant però el grup que parla puja el volum i els altres l’abaixen (surdos / caixa i repique / tamborim, agogô i xocalho): compàs a compàs, cada mig compàs, o primer entre dos grups i després afegint-hi el tercer. També hi ha aturades (cop de tots i silenci) i represes amb tota la potència, convenções de tots junts, sempre algun canvi de ritme (a samba, samba-reggae o ijexá, al mateix tempo i amb el so del Percudium) i acaben amb tots els instruments picant alhora, el cop final el més fort de la cançó. Tot és saturat d’instruments: tres músics a cada peça, també al repique i a l’agogô. Al selector «Subgènere principal» de la ràdio hi ha un grup «Batucada» per triar l’estil (samba, samba-reggae, ijexá o Percudium): totes les cançons de l’emissora Batucada en seran. Al taller, «Músics per peça» tria entre un sol músic i una banda de dos o tres, i «Surdo 3» tria entre la graella i la improvisació.
- **Cada cançó és nova**: subgènere a l’atzar dins de l’emissora (diferent del de la cançó anterior), tonalitat i durada (2–3,5 min) a l’atzar, i l’estructura s’allunya de les 12 últimes cançons de l’historial (l’opció «Estructura diferent de les últimes cançons» del taller). Al punk també varia el nombre de guitarres: la meitat de les cançons en tenen una, el 42 % dues i només el 8 % tres.
- **La següent es prepara en segon pla** mentre sona l’actual i comença **2 segons** després que acabi. El silenci forma part del fitxer d’àudio, de manera que el canvi també funciona amb la pantalla del mòbil apagada. «Següent cançó» hi salta quan ja és a punt.
- **Amb la pantalla apagada**: la ràdio té sempre dues cançons a punt per endavant i continua generant en segon pla. Mentre espera una cançó no posa silenci total sinó un fons a −60 dB (no se sent), perquè el mòbil no adormi la pàgina; també demana un «Web Lock» perquè el navegador no la congeli. El motor només es dona per penjat si passa 3 minuts sense avançar, i si una cançó falla tres vegades es torna a provar sol cada 30 segons.
- **Lletra en català**: la ràdio genera la lletra de cada cançó, hi ajusta les notes de veu i mostra el vers que sona i el següent.
- **Cançons cantades a la ràdio**: baixa el ZIP oficial [Umidaji DS v110](https://github.com/Team-BRAPA/Umidaji-DiffSinger/releases/tag/v110) i carrega’l al selector de l’emissora. El navegador desa el ZIP al dispositiu i sintetitza les cançons en català en un worker mentre sona la cançó anterior. Cada subgènere té un timbre d’Umidaji (Team BRAPA). La primera càrrega del model és d’uns 273 MiB. Amb el banc sense carregar, la ràdio sona amb la melodia de guia. Consulta les condicions d’ús de la veu al repositori oficial.
- **La teva veu en català**: a `veu.html` (enllaç «🎙 Grava la teva veu» a l'inici de la ràdio) es graven unes 330 síl·labes cantades a la mateixa nota: vocals, consonant + vocal, grups (pr, bl…) i finals (al, an, ix…), en pronúncia central. Es desen al navegador i s'exporten en un ZIP amb `manifest.json`. `singing/voicebank.py` les fa cantar amb WORLD: la consonant entra abans de la nota, la vocal s'estira fins al final i les consonants finals la tanquen, amb l'entonació de la melodia, portament i vibrato. `singing/catalan.py` passa la lletra catalana a síl·labes amb les mateixes divisions que l'app. Ús: `python singing/sing.py none partitura.json banda.wav sortida.mp3 --voicebank la-meva-veu.zip`.
- **Ràdio instrumental**: activada per defecte; l’interruptor de la pantalla d’inici (es recorda al navegador) la pot desactivar. fa que les cançons noves no tinguin veu, ni lletra, ni melodia de guia, ni Umidaji; tampoc tornen a sonar preferides cantades. El ska instrumental s’arranja com una banda de ska jamaicà en què els músics es reparteixen el protagonisme per frases (blocs de 4, 8 o 16 compassos): secció de vents (a l’uníson, harmonitzada a veus o amb contrapunt del trombó) uns 30 %, saxo 15 %, trombó 10 %, trompeta 10 %, orgue o piano 15 %, guitarra solista 10 %, baix melòdic 5 % i passatges només rítmics 5 %. Els vents porten la melodia entre el 50 i el 80 % de cada cançó (uns 65 % de mitjana). El tema A torna a cada estrofa i el B a cada tornada, amb variacions (anticipacions, notes de pas, eco del motiu) i en mans d’un altre instrument; el tema i els solos respiren al final de cada frase i un altre músic hi respon (pregunta i resposta). Quan l’orgue, el piano o la guitarra porten la melodia, la guitarra base manté el contratemps (i el piano o l’orgue s’hi sumen). Cap cançó comença amb la trompeta de protagonista, i la intro, l’ordre dels solistes, els relleus a mitja secció i el final canvien de cançó a cançó. El saxo i el trombó pugen 2 i 1 dB. El punk instrumental s’arranja com el surf punk i els instrumentals de garatge: la guitarra solista toca un tema a l’estrofa i un altre a la tornada (mode de línia «Melodia de solista», nou per a la guitarra 3), el riff a la intro, la pretornada i el final, respostes al pont i els solos, també damunt del pont trencat a mig temps; sempre hi ha com a mínim dues guitarres (rítmica i solista) i la solista puja 2 dB. Si la forma no té cap solo ni pont, se n’afegeix un de 8 compassos abans de l’última tornada.
- **👍 / 👎 i comentari** a cada cançó, des del reproductor o des de l’historial.
- **Preferides**: de tant en tant (com a molt una de cada quatre cançons, amb un 30 % de probabilitat) torna a sonar una cançó amb 👍 de la mateixa emissora que no hagi sonat fa poc. Les cançons amb 👍 també inspiren les noves del mateix subgènere.
- **Historial** (fins a 300 cançons, desat al navegador) amb filtres per emissora, vot i comentari. **«Exporta per millorar»** baixa un JSON (`radiospam-feedback`) amb les cançons votades o comentades: vot, comentari, vegades que ha sonat, resum de les decisions de composició i projecte complet. «Exporta-ho tot» inclou també les que no tenen vot.
- **Sempre s’obre la ràdio**: la ràdio ja no té l’enllaç a la interfície antiga (el taller de cançons).

La ràdio és a `radio.js` i `radio.css`. Fa servir el mateix compositor (`song-builder.js`), el mateix motor i les mateixes mostres que el taller; cada cançó es grava tram a tram al worker, es mescla i es reprodueix com a WAV en un element `<audio>` (amb Media Session per als controls de la pantalla de bloqueig).

# Taller de cançons (Ska Generator)

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

Kits i baixos gravats nous: **Big Rusty** (greu), **kit de club de jazz**, **kit lo-fi** (so de disc antic) i **Jazz Bass directe**. Cada subgènere en tria uns per defecte: l’ska jamaicà sona amb kit de club i Jazz Bass, el rocksteady amb el kit lo-fi i estrofes amb aro, el punk del 77 i l’horror punk amb Big Rusty (l’horror punk afinat −3 i amb la intro sense platets), el hardcore amb Big Rusty −2 i Jazz Bass.

## Cançó automàtica, biblioteca i puntuacions

Al panell **Cançó automàtica** tries un subgènere, la **tonalitat** (a l’atzar o una de les pròpies del subgènere), la durada (de 2 a 4 minuts) i si vols melodia de veu, i el taller compon una cançó sencera: introducció, estrofes, pretornades, tornades, pont o solo i final, amb els canvis de tempo propis del subgènere (introduccions lentes, ponts a mig temps, última tornada pujada de to…). Cada cançó es desa sola a **Les meves cançons**, al navegador, i s’hi pot posar de 1 a 5 estrelles. Quan d’un subgènere tens cançons de ★4 o més, les noves cançons d’aquest subgènere s’inspiren sovint en el seu tempo, tonalitat i groove. També pots desar-hi la cançó que estàs fent a mà.

### Quantes guitarres al punk

Quan el subgènere és punk (punk del 77, hardcore, pop-punk o horror punk), el panell de cançó automàtica pregunta **quantes guitarres** ha de tenir la cançó abans de generar-la:

| Opció | Què hi sona |
|---|---|
| Una guitarra (rítmica) | Només la guitarra 1 de la base. Sense riff sol a l’inici ni al final. |
| Dues guitarres (rítmica i solista) | Guitarra 1 i guitarra 3 (riff, respostes i solos). |
| Tres guitarres (dues rítmiques i solista) | Guitarra 1, guitarra 2 i guitarra 3 (per defecte). |

L’elecció es desa amb la cançó: «Inici i final nous» i «Dona-li varietat» no hi afegeixen guitarres que no hi han de ser. L’avís de la cançó nova diu quantes en té.

### Estructures diferents a cada cançó

La forma de la cançó automàtica surt d’un catàleg de plantilles: 20 al punk i 10 a l’ska. Algunes comencen per la tornada, n’hi ha sense pont, amb estrofa doble, pretornada o solo, amb un **pont trencat** (bateria i baix a mig temps, guitarra 2) o amb un **riff curt** entre blocs. Cada tipus de secció tria la llargada (4, 8 o 16 compassos segons el tempo) i de vegades l’última tornada és doble. Es proven 160 combinacions, es guarda la millor de cada plantilla i es tria entre plantilles. Així cap forma no guanya per tenir més versions dins de la durada.

Amb **«Estructura diferent de les últimes cançons»** (activada per defecte), cada forma es compara amb les de les 12 cançons més recents de la biblioteca: ordre de les seccions i llargades. Les més recents i les del mateix subgènere pesen més, i al punk la repetició es penalitza encara més. L’avís de la cançó nova mostra la forma, per exemple «intro › estrofa › tornada › estrofa › tornada › pont › tornada ×2 › final».

### Tonalitats de cada subgènere

Cada subgènere té de 4 a 7 tonalitats pròpies (només en els modes per als quals té progressions d’acords). Al selector **«Tonalitat»** es pot triar una d’aquestes o deixar-la a l’atzar.

| Subgènere | Tonalitats |
|---|---|
| Ska jamaicà | Fa, Si♭, Mi♭, Do i Sol majors (bemolls, còmodes per als vents) |
| Rocksteady | La, Re, Sol i Do menors; Do i Fa majors |
| Ska 2-tone | Do, Sol, Fa i Si♭ majors; La, Re i Sol menors |
| Nutty sound (estil Madness) | Do, Fa, Sol i Si♭ majors; Re, La i Do menors |
| Early reggae | Do, Fa, Sol i Si♭ majors; La i Re menors |
| Ska-swing | Fa, Si♭, Mi♭, Do i Sol majors; Sol i Re menors |
| Ska-punk | Sol, Do, Si♭, Fa i Mi♭ majors; La i Re menors |
| Punk del 77 | La, Mi, Re, Sol i Do majors; Mi i La menors |
| Street punk / Oi! | La, Mi, Re, Sol i Do majors |
| Skate punk | Re, Sol i Do majors; Mi, Si, La i Re menors |
| Garage punk | Mi, La, Sol i Re majors; Mi i La menors |
| Post-punk | Mi, La, Si i Re menors |
| Hardcore | Si, Mi, La i Re menors |
| Pop-punk | Re, Sol, Mi, La i Do majors |
| Horror punk | Mi, La i Sol majors; Mi, La, Si i Re menors |

### Subgèneres amb personalitat

| Subgènere | BPM | Trets |
|---|---|---|
| Ska jamaicà (anys 60) | 110–128 | Swing marcat, bateria jazz, baix de dits, acords amb setena i ii–V |
| Rocksteady | 100–108 | Més lent i greu, trompeta amb sordina, tonalitats menors |
| Ska 2-tone | 132–156 | Nerviós, orgue i metalls amb riffs |
| Nutty sound (estil Madness) | 126–152 | Piano de pub a la base («bounce» a l’estrofa, corxeres martellejades a la tornada), saxo tenor al davant i responent a la veu, orgue només a la tornada, acords de music-hall (VI7, II7, iv), aturades de tota la banda i, de vegades, última tornada un to amunt |
| Early reggae (boss reggae del 69) | 100–116 | Orgue «bubble» tota la cançó, piano i guitarra a contratemps, harmonies de dos acords, baix melòdic, trompeta amb sordina i final en fos |
| Ska-swing (jump blues) | 150–176 | Balanceig fort, baix caminant, piano de boogie, kit de jazz i vents fent riffs de big band; pont de dominants encadenades (III7–VI7–II7–V7) |
| Ska-punk | 160–180 | Guitarres distorsionades, ponts a mig temps |
| Punk 77 | 180–205 | Tres acords amb bVII, distorsió clàssica |
| Hardcore | 200–220 | Fuzz, acord bII i breakdown a mig temps |
| Pop punk | 165–185 | Overdrive, vi–IV–I–V, pretornada que accelera |
| Horror punk | 170–192 | Distorsió Misfits, acords prestats foscos (bVI, iv) |
| Street punk / Oi! | 150–174 | Mig temps amb pes, crunch, tornades d’himne (I–IV–V) i, de vegades, última tornada un to amunt |
| Skate punk (hardcore melòdic) | 196–220 | Tornades a doble temps, progressions melòdiques (vi–IV–I–V), guitarra solista i pont a mig temps |
| Garage punk | 148–176 | Fuzz, orgue de combo a la base, kit lo-fi, riffs amb bVII i bIII i molta humanització |
| Post-punk | 140–164 | Tonalitats menors, el baix porta el riff (+2 dB), guitarra prima amb arpegis nets, bateria seca i veu greu |

El subgènere també es pot triar al panell de la base, juntament amb el **balanceig** (swing), que endarrereix les corxeres a contratemps.

### Piano vertical gravat

L’ska té un instrument nou: un **piano vertical gravat nota a nota** (VSCO 2 CE «Upright Nr. 1», domini públic; 11 notes de Do2 a Do7 amb dues dinàmiques). És al banc addicional, que només es baixa quan una cançó el fa servir. Al taller es pot afegir a la base o com a instrument d’una secció, amb cinc patrons:

| Patró | Què toca |
|---|---|
| Contratemps | Acords curts a les quatre «i», com la guitarra |
| «Bounce» de music-hall | Baix a la mà esquerra (1 i 3), acords a contratemps i un toc suau als temps 2 i 4 |
| Boogie | Baix caminant a corxeres (1–3–5–6–♭7) i acords sincopats |
| Acords llargs | Blanques amb el baix sostingut |
| Corxeres martellejades | Vuit acords per compàs amb l’accent a contratemps |

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

### Inicis, finals i silencis

El botó **«✦ Inici i final nous»** (pas 2, amb dues seccions o més) tria una manera d’entrar a la cançó i una de sortir-ne, cada vegada diferent de l’anterior, i de vegades hi afegeix un silenci al mig. Ho aplica a la primera i a l’última secció, i cada clic desfà el que havia fet el clic anterior.

| Inicis | Finals | Silenci al mig (abans d’una tornada) |
|---|---|---|
| Tota la banda de cop | Cop final de tota la banda | Cop i silenci: la banda dona un cop i calla |
| Bateria sola | Fos de sortida (el ritme continua i s’esvaeix) | Un compàs sencer de silenci |
| Entrada per capes (bateria, baix, guitarra…) | Tall en sec (sense plats) | Sense silenci |
| Compte de baquetes | Final que s’alenteix | |
| Fos d’entrada | Redoble llarg i acord final | |
| El riff sol | La banda calla per capes i la bateria tanca | |
| Veu i guitarra | Acaba amb el riff sol | |
| Baix i bateria | | |
| A mig temps i més lenta | | |

Tot també es pot triar a mà a l’editor de la secció:
- **Final de la secció**: s’hi afegeixen «Cop i silenci» i «Últim compàs en silenci». A la secció de tipus final, el selector passa a ser **«Final de la cançó»** (cop final, ritme que continua per a un fos, tall en sec, o redoble i acord llarg).
- **Fos**: fos d’entrada (puja des del silenci) o de sortida (baixa fins al silenci, i la cua queda muda). S’aplica a l’escolta, a la secció i al WAV.

A la línia, les seccions mostren ∅ (silenci), ◢ / ◣ (fos d’entrada o de sortida) i ≡ (entrada o sortida per capes).

### Efectes de color per a vents i guitarres

Cada clip de trompeta, trombó, saxo o guitarra té un selector **«Color del so»**: el so passa per un aparell i es pot combinar amb l’efecte de guitarra.

| Efecte | Com sona |
|---|---|
| Ràdio antiga | Banda de 320 Hz a 3,4 kHz i saturació suau de vàlvules |
| Megàfon | Molt estret, botzina a 2 kHz i saturació dura |
| Telèfon | De 420 Hz a 2,9 kHz, prim i sec |
| Gramòfon (disc antic) | Sense greus ni aguts i botzina a 1 kHz |

El nivell es compensa (l’instrument sona igual de fort) i la reverberació es redueix, perquè l’aparell sona sec i a prop.

### La cançó automàtica ho fa servir tot, però amb mesura

- Fa servir totes les eines anteriors: motius desenvolupats, veu amb accents, selector de qualitat, harmonia amb forma, riff i respostes, canvis de tempo i de to.
- **Corba d’energia**: cada estrofa i cada tornada són una mica més plenes que l’anterior. De vegades la segona estrofa té **un altre ritme de bateria**.
- Compon **tres cançons candidates** i es queda la que puntua millor (forma harmònica, qualitat de les línies i com encaixen els recursos especials).

**Recursos especials només quan aporten.** L’algorisme té a l’abast tots els recursos: inicis i finals especials, aturades de la banda, silencis al mig, fosos d’entrada i de sortida, i efectes de ràdio, megàfon, telèfon o gramòfon. Cadascun rep un valor segons:
- **el subgènere**: el rocksteady i l’ska jamaicà tendeixen al fos i a l’inici de baix i bateria; el hardcore, al compte de baquetes i al tall en sec, i mai fa un fos;
- **el moment**:
  - un fos d’entrada només amb una intro llarga o un tempo lent;
  - un fos de sortida només amb un final de 8 compassos o més;
  - el silenci, sobretot abans de l’última tornada quan ve d’un pont o d’un solo;
  - el color, a la intro (millor encara si comença amb el riff sol, que sona com un disc antic abans que entri la banda) o al pont.

Només s’apliquen els que superen un llindar, de més valuós a menys, fins a un **pressupost segons la durada**: 2 recursos per sota de 2:30, 3 fins a 3:30 i 4 per sobre. A més:
- com a molt un fos, un efecte de color, una aturada i un silenci per cançó;
- l’aturada i el silenci mai van seguits;
- el cop final només es canvia si el final especial encaixa millor.

L’avís de la cançó nova diu quins recursos ha triat.

### «Genera» i «Genera’n una altra» amb selector de qualitat

En generar a mà la trompeta, el trombó, el saxo, el sintetitzador o la melodia de veu (amb línia pròpia), el taller prova **24 versions** i es queda la que fa la millor línia dins de les seves seccions: acords, clímax, cadències, ritme i cap xoc amb les altres línies que sonen. «Genera’n una altra» sempre en dona una de diferent.

### Comentaris i exportació per analitzar les cançons

Al pas 2 hi ha el panell **«💬 Comentaris de la cançó»**. Cada comentari té:
- **On**: tota la cançó, una secció o el punt on és el capçal (es pot aturar la reproducció on passa alguna cosa i comentar-ho);
- **Tema**: inici, final, silencis, fosos, efectes de so, melodia, veu, acords, ritme, baix, guitarres, vents, mescla, estructura…;
- **Valoració**: 👍 m’agrada, 👎 cal millorar o 💡 idea.

Els comentaris es desen amb la cançó i al projecte JSON. Si la cançó encara no era a «Les meves cançons», s’hi desa sola en afegir el primer comentari. A la biblioteca, cada cançó mostra quants comentaris té (💬).

**«⇩ Baixa les cançons amb comentaris (N)»** (a «Les meves cançons») baixa **en un sol fitxer** totes les cançons que tenen comentaris: `skagenerator-comentaris-AAAA-MM-DD.json`. El botó mostra quantes n’hi ha i queda desactivat si encara no n’hi ha cap. «Baixa-les totes» inclou també les que no tenen comentaris (`skagenerator-totes-AAAA-MM-DD.json`). Per a cada una inclou:
- la puntuació;
- els comentaris situats (secció, compàs i minut:segon);
- un resum de les decisions del taller: estructura, intensitats, tempo i to de cada secció, i recursos especials (inici, final, aturades, silencis, fosos, efectes de color);
- el projecte complet, per poder-la reproduir exactament.

Amb aquest fitxer es pot veure quins recursos funcionen i quins no, i ajustar-ne l’algorisme. La veu gravada no s’hi inclou.

### Millores a partir dels comentaris de les cançons

Amb el primer fitxer de comentaris exportat (6 cançons, 12 comentaris) s'han fet aquests canvis:

| Comentari | Canvi |
|---|---|
| «Transicions molt brusques», «canvi de velocitat exagerat de ràpid a lent» | Els canvis de tempo automàtics i de «Dona-li varietat» són com a molt d’un 7–8 % (abans fins al 35 %). Per sonar més lent sense saltar de tempo, la bateria i el baix van a mig temps. On la cançó s’alenteix s’hi afegeix un instrument que sosté el so (guitarra 2 al punk, orgue sostingut o coixí a l’ska). |
| «La transició d’intro a estrofa és brusca» | En les intros on la bateria no toca (el riff sol, veu i guitarra…), la bateria entra a l’últim compàs amb un redoble. |
| «Sense la guitarra 2 la cançó perd força» | La guitarra 2 també toca a les estrofes del punk. |
| «Si desapareix un instrument la resta hauria de pujar» | Compensació automàtica: si en una secció falten instruments (sobretot guitarres distorsionades), la resta puja fins a 3 dB, segons el pes que falta respecte de la secció més plena. |
| «Falta volum a la guitarra solista» | Guitarra 3 (punteig) +3 dB. |
| «La bateria punk hauria de ser més arrítmica» | Al punk, la bateria empeny i respira més (més humanització, també als tempos ràpids) i no toca tots els compassos iguals: bombos i caixes de més i plats a contratemps. |
| «Es podrien posar dues bateries per portar el contratemps» | Opció **«Bateria: dues bateries, la segona a contratemps»** a cada secció (timbal base a cada contratemps i charles obert a 2 i 4). La cançó automàtica la posa de vegades a les tornades del punk. |
| «Les tres cançons punk 77 són molt semblants» | Punk del 77 amb més tonalitats (també menors), 3 ritmes de bateria, 3 de baix, 4 de guitarra, 4 sons de guitarra (distorsió, overdrive, crunch, fuzz), de vegades pretornada i intro llarga. |
| «El baix està massa fort i els vents queden baixos» (ska jamaicà) | Ska jamaicà amb el baix −3 dB i els vents +2 dB. |

**A la línia** es veuen els recursos de cada secció: una rampa per al fos d’entrada o de sortida, una zona ratllada per al silenci o el cop i silenci, i icones a la informació de la secció (◢ ◣ fosos, ⏸ aturada, ∅ silenci, ✂ tall en sec, 🥁 redoble final, ≡ capes, 🥁🥁 dues bateries), amb el text sencer en passar-hi per sobre. Els clips amb efecte de color mostren l’aparell: 📻 Ràdio antiga, 📢 Megàfon, ☎ Telèfon, 💿 Gramòfon.

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
- **Volum general de cada instrument** (panell de la base): un control per instrument de la cançó i per a la mescla total, de −24 a +6 dB, que s’aplica a totes les seccions. Els de bateria i baix són els mateixos que el «Volum general de la base».
- **Volums d’aquesta secció**: un ajust per instrument i per a la secció sencera, de −24 a +12 dB, que **se suma** al volum general. Cada fila mostra el total (p. ex. «+4 dB · total −2 dB»). Si després canvies el volum general, totes les seccions el segueixen i conserven el seu ajust.
- Els equalitzadors de la cançó i de la secció tracten només greus, mitjos i aguts. Els projectes anteriors, que tenien el volum dins de l’equalitzador, es converteixen sols i sonen igual.
- **Fins a tres guitarres a la mateixa secció**: Guitarra 1 (rítmica), Guitarra 2 (rítmica una octava amunt, amb un patró diferent) i Guitarra 3 (arpegis i punteig). Cadascuna té el seu canal, el seu clip, el seu so i el seu efecte.
- **Efectes de guitarra** per a cada clip: boost net, saturació de cinta, crunch, overdrive, distorsió, metal, fuzz i lo-fi, amb **guany** i **to**. La cadena és la d’un pedal i un amplificador: filtre d’entrada, saturació amb sobremostreig ×2, pantalla d’altaveu i nivell compensat (la guitarra sona igual de forta amb efecte que sense). Amb efectes de guany alt, la reverberació es redueix.

### Horror punk (estil Misfits)

L’efecte **«Horror punk (estil Misfits)»** imita el so de guitarra dels primers discos dels Misfits: distorsió tipus «serra mecànica» molt saturada amb un punt de fuzz, mitjos plens (no buidats com en el metal), greus ajustats i presència a 2,5 kHz. Es pot triar per a tota la cançó a «Efecte de guitarra» (s’aplica a les tres guitarres; cada clip el pot canviar) o només en un clip.

Amb aquest efecte, la guitarra principal també toca a la manera del grup: acords de quinta (fonamental, quinta i octava) **tot a cops avall en corxeres**, **apagats amb el palmell a les estrofes** i **oberts a les tornades**, amb **dues guitarres iguals a esquerra i dreta**. La guitarra entra neta a l’«amplificador» perquè no es distorsioni dues vegades. Per sonar com ells: estil Punk, 160–200 BPM.

## Cançó a partir d’una lletra

Al panell de cançó automàtica, **«✍ Lletra (opcional)»** permet enganxar la lletra abans de crear la cançó.

**Reconeixement de les seccions:**
- Per títols: «Estrofa 2», «Tornada:», «[Chorus]», «Pretornada», «Pont», «Intro», «Final»… (també en castellà i en anglès).
- Si no n’hi ha, per la forma: l’estrofa que es repeteix és la tornada, i un grup repetit que va just abans de la tornada és la pretornada. Una estrofa única entre les dues últimes tornades és el pont, si hi ha tres tornades o més, o si fa una altra llargada que les estrofes. Una estrofa curta abans de la tornada és la pretornada.
- Un títol de tornada sense text la repeteix, i «Tornada x2» la repeteix dues vegades.
- La llista mostra cada secció reconeguda amb els versos i les síl·labes, i el tipus es pot corregir abans de crear.

**Com es crea la cançó:**
- Cada estrofa és una secció amb la seva lletra, i cada vers és una frase de la melodia de veu, amb una nota per síl·laba i les tòniques a temps.
- Les seccions d’una mateixa mena fan la mateixa llargada: 2 compassos per vers, o 4 si algun vers passa d’11 síl·labes.
- S’hi afegeixen intro i final. El títol és el primer vers de la tornada.
- Si la lletra és curta per a la durada triada, els versos passen a ocupar 4 compassos (frases amples) i s’hi afegeixen un instrumental, una tornada final repetida i una intro més llarga.

## Esquema per escriure la lletra

Amb la cançó generada, **«📋 Copia l’esquema de la lletra»** (pas 2) copia al porta-retalls quants versos ha de tenir cada secció i quantes síl·labes cada vers. **«Baixa’l en .txt»** en baixa el mateix text. Com es calcula:
- Surt de la **melodia de veu**: una nota per síl·laba i un vers per frase (les frases se separen per les respiracions de la melodia).
- Cada vers porta el **patró rítmic** (TA = síl·laba que cau a temps, ideal per a una tònica; ta = la resta).
- Les **tornades** iguals remeten a la primera («repeteix-ne la lletra»). Les **estrofes** amb el mateix patró en donen les síl·labes en una línia i demanen lletra nova. Dins d’una tornada s’indiquen els versos amb la mateixa melodia (el ganxo), que poden repetir el text.
- Les estrofes, pretornades i tornades **sense melodia de veu** reben un esquema orientatiu. Les seccions sense veu (intro, solo, final…) es llisten al final.
- Acaba amb el total de versos i una frase preparada per demanar la lletra a una IA.

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
| Guitarres solistes del punk (distorsionada 1 i 2, directa, jazz) | FreePats FSBS (pont) | CC0 |
| Bateria | Muldjord Kit, de Lars Muldjord (via FreePats) | CC BY 4.0 |
| Bateria greu (bombo de 24", toms de 14–22") | Big Rusty Drums, Karoryfer | CC0 |
| Kit de club de jazz i kit lo-fi | Virtuosity Drums | CC0 |
| Jazz Bass directe | Growlybass, Karoryfer | CC0 |

- VSCO només publica els WAV: el build llegeix el nom de cada fitxer (nota i dinàmica), en mesura l’afinació, el remostreja i en crea les zones de tecla i de força. Les notes curtes de trompeta i trombó fan servir les mostres d’staccato, que donen els cops secs típics de l’ska.
- Les gravacions de VSCO tenen nivells molt desiguals (més de 20 dB entre notes). El build iguala la sonoritat de cada mostra: totes les notes d’una dinàmica sonen igual, la dinàmica suau queda 4 dB per sota de la forta i l’staccato 5 dB per sota del sostingut. La força dels metalls s’allunya del canvi de dinàmica perquè no saltin de mostra nota a nota.
- El trombó i el clarinet tenien un atac lent (el clarinet trigava fins a mig segon a sonar ple) i les notes curtes quedaven apagades: el build fa començar aquestes mostres just quan la nota ja sona (atac de ~20 ms, més ràpid que la trompeta). Les notes del trombó on no hi ha staccato gravat a menys de 2 semitons fan servir la gravació sostinguda retallada, i la línia pròpia del trombó es toca tal com està composta, una octava avall.
- **Trombó**: la segona veu de vent sona per defecte amb el **trombó gravat (VSCO)**, amb staccato per a les notes curtes. Abans era un saxo tenor i, quan també tocava el saxo, la secció de vents tenia dos saxos tenors en lloc de trompeta, trombó i saxo. Toca la mateixa línia (una octava sota la trompeta). El saxo tenor gravat i els trombons GM continuen disponibles a «So del trombó».
- **Saxos audibles dins la banda**: el saxo i la segona veu quedaven 2,5–5 dB per sota de la trompeta i tapats per la guitarra i el baix, en el mateix registre. Ara el saxo toca en el registre agut del tenor (per sobre de la segona veu), tots dos tenen menys greus i més presència, i el volum està calibrat perquè els tres vents pesin el mateix dins la mescla.
- Totes les seccions reben el mateix guany (abans cada secció es normalitzava per separat i un instrument que passava d’una secció a l’altra pujava o baixava de volum). Un compressor suau i un limitador controlen els pics.
- FreePats ja publica aquests instruments en SF2: no cal convertir l’SFZ. El build els remostreja a 32 kHz (baixos a 22 kHz), treu els bucles i escurça les cues.
- El kit Muldjord original ocupa 209 MB i té un mapa de tecles propi: se’n construeix un kit GM nou (bombo, caixa, cop de vora, charleston, plats, ride i timbals) amb tres capes de força.
- El banc final ocupa uns 30 MB i es carrega una sola vegada. Les descàrregues i el banc convertit es guarden a `.cache/` i a la memòria cau de GitHub Actions.
- Els sons de GeneralUser GS continuen disponibles com a alternatives («… GM») als selectors de so.
- **Orgue de rodes amb Leslie**: l’orgue ja no és el «Drawbar Organ» GM de GeneralUser. El build el sintetitza com un orgue de rodes fòniques (`buildTonewheel` a `scripts/real-instruments.mjs`, configuració `organ` a `real-instruments.json`): tirants 888400000 (16', 5 1/3', 8' plens i 4' a mitges), percussió del 3r harmònic que s’apaga en ~0,1 s, clic de tecla i harmònics aguts replegats una octava, com a l’orgue real. Cada mostra (una cada 4 semitons) té un bucle exacte, sense salts. En reproduir, l’orgue passa per un altaveu rotatori (`createLeslie` a `audio/render.mjs`): preamplificador amb saturació suau, botzina i tambor separats a 800 Hz que giren a velocitats diferents i modulen el volum i el retard (Doppler), i dos micròfons a angles diferents que obren el so en estèreo. Gira lent (coral) a les estrofes, intros i ponts, i ràpid (trèmolo) a les tornades i els solos. El volum està calibrat al mateix nivell que l’orgue GM anterior.
- **Banc addicional** (`assets/extra-instruments.sf2`, uns 15 MB): les bateries Big Rusty i Virtuosity, el baix Growlybass i el piano vertical de VSCO 2 CE. Es publiquen en SFZ amb FLAC/WAV: el build tria unes quantes capes de força, barreja els micròfons (p. ex. bombo + ambient, caixa a sobre i a sota + ambient) i ho converteix a SF2 (FLAC descodificat amb `@wasm-audio-decoders/flac`). La web només el baixa quan una cançó fa servir algun d’aquests sons, així el banc principal no creix.
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
