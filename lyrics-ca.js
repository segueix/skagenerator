(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SkaLyricsCa = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Vocabulari català de les lletres automàtiques.
  // Tema → subtema → { open: començaments (complements de 2–4 síl·labes que van bé davant de qualsevol
  // frase), fam: famílies de rima }. Cada família és «tornades ; finals»: 4 tornades curtes (fan de
  // títol) i 6 frases completes que rimen entre elles. Un vers és un final sol o «començament + final»,
  // de manera que cada família dona desenes de versos diferents.
  const DATA = {
    ska: {
      festa: {
        open: ['Aquesta nit', 'Per la festa', 'Amb la banda', 'Quan es fa fosc', 'Sota els fanals', 'Tot el poble', 'Fins demà', 'Dalt del carrer', 'Entre amics', 'Cada estiu', 'Ben de nit', 'Pels carrers'],
        fam: [
          "Vine a ballar|No vull parar|Fes-me ballar|Torna a sonar ; tornem a començar|ningú no vol marxar|la banda fa ballar|no deixem de cantar|la nit ens fa volar|tothom vol celebrar",
          "Festa major|Quina calor|Ritme i color|Sona el tambor ; sona fort el tambor|tot pren un altre color|ballem amb tot el cor|la plaça bull de calor|cantem la gran cançó|la nit fa olor de flor",
          "Queda't aquí|Vine amb mi|Fins al matí|Torna a venir ; la festa ja és aquí|ningú no vol dormir|cantem fins al matí|tothom vol repetir|el cel es pot obrir|trobem un bon camí",
          "Tota la gent|Bufa el vent|Un bon moment|Tot diferent ; la plaça és plena de gent|sona un vell instrument|ballem tots lentament|el món és diferent|la música ve amb el vent|tothom està content",
          "Llum de fanal|Nit especial|Tot un carnaval|Ball general ; ballem sota el fanal|la nit és un carnaval|sona un himne final|tot el barri és igual|la lluna fa el senyal|ningú no es troba mal",
          "Nit de meravella|Sota una estrella|Balla amb ella|Sona l'esquella ; quina gran meravella|ballem sota l'estrella|tothom balla amb ella|ja sona l'esquella|la plaça és la més bella|cantem la cançó vella",
          "Foc brillant|Ve el gegant|Tot saltant|Endavant ; ja balla el vell gegant|la colla va saltant|sortim tots al davant|la nit va endavant|el foc es va escampant|la gent passa cantant",
          "La nit és bona|Tot ressona|Passa l'estona|Ve la Ramona ; la nit és llarga i bona|la plaça ja ressona|ballem tota l'estona|canta cada persona|la banda no abandona|la festa emociona"
        ]
      },
      barri: {
        open: ['Al meu barri', 'Pel carrer', 'Des del balcó', 'Cada matí', 'Entre veïns', 'Al bar de baix', 'Sota el pont', 'Vora el mercat', 'Dalt del terrat', 'Pel meu carrer', 'Com cada any', 'Mentrestant'],
        fam: [
          "El meu carrer|Barri obrer|Ja tornaré|Pa i cafè ; tothom es coneix bé|sempre hi ha feina a fer|el forn obre el primer|baixo a prendre un cafè|saludo el sabater|sé que hi tornaré",
          "Barri vell|Canta l'ocell|Com un castell|Cor de clavell ; estimo el barri vell|canta fort un ocell|el bloc sembla un castell|floreix algun clavell|tot gira com un anell|ho porto al cervell",
          "Balcons i flors|Mil colors|Cants i olors|Cors i tambors ; hi ha balcons plens de flors|tot té mil colors|pugen cants i olors|bateguen tots els cors|se senten els tambors|passen vells cantadors",
          "Roba estesa|Llum encesa|Quina sorpresa|Taula estesa ; hi ha la roba estesa|trobo la llum encesa|l'estufa és ben encesa|queda una promesa|em fan una sorpresa|la tarda cau estesa",
          "Bon veïnat|Dalt del terrat|Vora el mercat|Gent de ciutat ; tenim bon veïnat|pugem dalt del terrat|comprem al vell mercat|som gent de la ciutat|el bar ja ha despertat|tot queda al meu costat",
          "Banc de la plaça|Poc a poc passa|Cap amenaça|La vida abraça ; seiem a la plaça|la tarda passa i passa|l'avi riu i abraça|el sol escalfa la plaça|ningú no ens amenaça|tothom hi té la traça",
          "La mateixa gent|Sempre present|Barri valent|Cor calent ; trobo la mateixa gent|tothom hi és present|el barri és ben valent|té el cor sempre calent|ens coneixem al moment|vivim modestament",
          "Olor de pa|Quin dia fa|Tot canviarà|Torna a passar ; el forn fa olor de pa|diem fins demà|tothom es dona la mà|el carrer torna a cantar|el dia vol començar|ningú no en vol marxar"
        ]
      },
      mar: {
        open: ['Vora la mar', "A l'estiu", 'Sobre la sorra', 'Quan surt el sol', 'Amb la marea', 'Cap al tard', 'Lluny del port', 'Sota el sol', 'Per la platja', 'Tot el matí', 'Amb el vent', 'Dins la barca'],
        fam: [
          "Vora la mar|Sol i mar|Torna a salpar|Deixa'm nedar ; les ones fan cantar|la barca vol salpar|el sol ens fa brillar|ens tornem a banyar|ningú no vol tornar|el vent ens fa somiar",
          "Sal i sol|Tot el sol|Com un llençol|Prenc el sol ; tot és de sal i sol|la platja és un llençol|ningú no es queda sol|cantem de cara al sol|la tarda fa de bressol|la brisa dona consol",
          "Onades|Tardes daurades|Nits estelades|Mil petjades ; arriben les onades|són tardes daurades|venen nits estelades|deixem les petjades|les veles són alçades|passen hores salades",
          "Vent de llevant|Cel brillant|Tot cantant|Mar endavant ; bufa el vent de llevant|el cel és ben brillant|tornem a casa cantant|la barca va surant|la tarda va passant|el sol es va apagant",
          "Far del port|Bufa fort|Bona sort|Rumb al port ; brilla el far del port|el vent bufa ben fort|tenim la bona sort|tornem tots cap al port|el mar sona més fort|tothom crida ben fort",
          "Sorra calenta|Tarda lenta|Brisa de menta|Gent contenta ; trepitgem sorra calenta|la tarda passa lenta|ve una brisa de menta|la gent sembla contenta|la calor és violenta|la nit ja es presenta",
          "Gavines|Aigües fines|Cançons marines|Platges veïnes ; volen les gavines|brillen aigües fines|sonen cançons marines|assequem les sardines|juguen nens i nines|tornen barques veïnes",
          "Arriba l'estiu|Tot reviu|Canta el riu|Foc i caliu ; ja arriba l'estiu|la platja reviu|baixem fins al riu|fem foc i caliu|tothom canta i riu|el poble és ben viu"
        ]
      },
      amics: {
        open: ['Amb els amics', 'Com sempre', 'Tots plegats', 'De bracet', 'Any rere any', 'Fins al final', 'Tant se val', 'Des de petits', 'Colze a colze', 'Sense dubtar', 'Per molts anys', 'Plogui o nevi'],
        fam: [
          "Tots plegats|Ben trobats|Mai cansats|Ben animats ; sortim tots plegats|som sempre ben trobats|no estem mai cansats|anem ben agafats|riem com uns sonats|tornem tots abraçats",
          "Bons amics|Com els antics|Pobres i rics|Grans i xics ; som molt bons amics|cantem com els antics|ens trobem grans i xics|no cal que siguem rics|pugem junts tots els pics|passem dies bonics",
          "Dona'm la mà|Fins demà|Com un germà|Ja es veurà ; et dono la mà|ens veurem demà|t'estimo com un germà|sabem cap on anar|tornarem a cantar|ningú no ens pot parar",
          "Colla i carrer|Tot va bé|Ho sé|Ja ho faré ; la colla surt al carrer|sabem que tot va bé|et dic tot el que sé|demà ja ho faré|trobem un bon recer|compartim el cafè",
          "Riure i plor|Tot el cor|Fora la por|Com un tresor ; compartim riure i plor|hi posem tot el cor|fem fora tota por|et guardo com un tresor|tenim el mateix humor|cantem la mateixa cançó",
          "Amistat|Veritat|Llibertat|Sempre al teu costat ; tenim una amistat|diem la veritat|volem la llibertat|tot ho hem superat|res no hem oblidat|sempre ens hem ajudat",
          "Brindem|Cantem|Tornem|Sempre hi serem ; aquesta nit brindem|tots junts cantem|demà hi tornem|sabem el que volem|per res no ens barallem|la nit la celebrem",
          "Vells companys|Tants anys|Sense enganys|Guanys i danys ; som uns vells companys|ja fa tants anys|parlem sense enganys|compartim guanys i danys|esquivem els paranys|passem bons i mals anys"
        ]
      },
      ball: {
        open: ['A contratemps', 'Sense parar', 'Amb els peus', 'A la pista', 'Pas a pas', 'Tota la nit', 'Amb el ritme', 'De cop i volta', 'Cap a les sis', 'Amunt i avall', 'Sobre el terra', 'Fins a les tres'],
        fam: [
          "A contratemps|Tots a temps|Perdo el temps|Bons temps ; ballem a contratemps|arribem tots a temps|el baix marca el temps|tornen els bons temps|no perdem gens el temps|sonen vells passatemps",
          "Sabates de xarol|Ningú balla sol|Com un gresol|Fins que surti el sol ; duc sabates de xarol|aquí ningú no balla sol|la pista és un gresol|ballem fins que surt el sol|el ritme dona consol|giro com un mussol",
          "El baix camina|Nit divina|Dolça rutina|Balla la veïna ; sento que el baix camina|la nit sembla divina|ballar és la rutina|balla fins la veïna|la trompeta s'afina|el ritme ens il·lumina",
          "Ritme i suor|Tot un clamor|Bon humor|So de tambor ; tot és ritme i suor|la pista és un clamor|ballem amb bon humor|ens crida el tambor|el saxo fa un favor|la nit té un gran sabor",
          "Mou la cintura|Quina aventura|Ball sense mesura|Nit segura ; movem la cintura|ballar és l'aventura|saltem sense mesura|la pista és segura|la nit té gran altura|el ritme ens cura",
          "Mira la pista|Canta l'artista|Perdo la vista|Ball de la llista ; omplim tota la pista|ja canta l'artista|et perdo de vista|soc el primer de la llista|la banda és optimista|la nit és una conquista",
          "Trompeta|Samarreta|Sona neta|Volta completa ; ja sona la trompeta|suo la samarreta|faig la volta completa|la pista és ben estreta|ballem a la placeta|la nit és ben inquieta",
          "Tothom al ball|Amunt i avall|Com un cavall|Fora el treball ; tothom surt al ball|saltem amunt i avall|corro com un cavall|oblido el treball|em miro al mirall|no em perdo cap detall"
        ]
      },
      feina: {
        open: ['Quan plego', 'Cada dilluns', 'Després del torn', 'Amb les mans', 'De sol a sol', 'A final de mes', 'Al tren de les sis', 'Fins divendres', 'Per quatre rals', 'Tot el dia', 'Sense parar', 'Dins la nau'],
        fam: [
          "Ja he plegat|Tot acabat|Sou cobrat|Dissabte ha arribat ; per fi ja he plegat|el torn s'ha acabat|ja tinc el sou cobrat|la nit m'ha esperat|surto ben pentinat|la colla m'ha trucat",
          "Vuit hores|Massa hores|Compto hores|A totes hores ; treballo vuit hores|em sobren massa hores|vaig comptant les hores|lentes passen les hores|somio a totes hores|penso en les millores",
          "Dilluns al matí|Quin camí|Vull dormir|Quin patir ; ja és dilluns al matí|faig el mateix camí|jo només vull dormir|el tren torna a venir|ja penso en sortir|compto el que he de patir",
          "Sona la sirena|Trenco la cadena|Fora la pena|Tarda serena ; ja sona la sirena|es trenca la cadena|deixo fora la pena|la tarda és serena|la plaça ja és plena|el cor ja no té pena",
          "Res de res|Un cop més|Tot al revés|L'amo no hi és ; avui no faig res de res|ballaré un cop més|ho veig tot al revés|l'amo avui no hi és|me'n ric de l'interès|torno a tenir vint-i-tres",
          "Poc jornal|Tant se val|Torn final|Tot igual ; cobro poc jornal|a mi ja tant se val|faig el torn final|cada dia és igual|espero el senyal|me'n vaig cap al portal",
          "Fi de jornada|Feina acabada|Nit esperada|Porta tancada ; s'acaba la jornada|la feina és acabada|la nit és esperada|la porta és ben tancada|ja duc roba canviada|la colla és avisada",
          "Ja és divendres|Fora cendres|Nits més tendres|Sogres i gendres ; per fi ja és divendres|espolso totes les cendres|venen nits més tendres|ballen sogres i gendres|les hores són més tendres|visca tots els divendres"
        ]
      }
    },
    punk: {
      rabia: {
        open: ['Dic que prou', 'Ple de ràbia', 'Cridant ben fort', 'Sense permís', 'Contra el mur', 'Des de baix', 'Amb el puny', 'Per dins', 'Cada dia', 'Avui mateix', 'Sense por', 'Dents serrades'],
        fam: [
          "No vull callar|Vull cridar|Deixa'm cridar|No em faràs callar ; ningú no em farà callar|ja no vull esperar|tinc ganes de cridar|no em penso agenollar|ho vull tot rebentar|no em podran aturar",
          "Ja n'hi ha prou|Trenco el jou|Sempre plou|Res no es mou ; cridem que ja n'hi ha prou|no hi ha res de nou|ens roben mig sou|a sobre sempre plou|aquí res no es mou|caiem dins del pou",
          "Foc i foc|Cala foc|Poc a poc|Canvi de joc ; al contenidor hi ha foc|ho cremarem poc a poc|no ens mourem del lloc|s'ha acabat el joc|em planto com un soc|no ens fa por cap xoc",
          "Estic calent|Crit valent|Contra el vent|Mal ambient ; crido contra el vent|tinc el cap ben calent|no soc obedient|m'ofega l'ambient|ho dic ben clarament|em sento diferent",
          "Pura energia|Nit i dia|Rebel·lia|Anarquia ; crido nit i dia|tinc massa energia|visca la rebel·lia|em sobra valentia|no vull la teva guia|trenco la monotonia",
          "Estic perdut|Ja he begut|Salut, salut|No estic mut ; mai no us he cregut|no em dono per vençut|he dit el que he volgut|ja no em quedaré mut|em sobra cada minut|és tot el que he pogut",
          "Fora els senyors|Prou de pors|Trenco els colors|Sense favors ; no volem més senyors|ja no tenim més pors|no demanem favors|fem servir altres colors|trenquem tots els motors|ens sobren els errors",
          "Quina vida|Sense sortida|Sang i ferida|Tot es crida ; no trobo la sortida|m'han robat mitja vida|porto oberta la ferida|la ràbia és ben sentida|la sort és repartida|la nit és una fugida"
        ]
      },
      carrer: {
        open: ['Pels carrerons', 'De matinada', 'Sota el neó', 'A la ciutat', 'Entre parets', 'Vora la via', "Sobre l'asfalt", 'Amb la colla', 'Passat les tres', 'Al descampat', 'Sota la pluja', 'Dins del metro'],
        fam: [
          "Asfalt mullat|Barri oblidat|Tot tancat|Mur pintat ; trepitjo asfalt mullat|el barri està oblidat|ho trobo tot tancat|el mur ja l'hem pintat|ningú no ha preguntat|la nit ens ha salvat",
          "Llum de neó|Sense raó|Tinc la cançó|Últim vagó ; brilla un llum de neó|corro sense raó|em queda una cançó|pujo a l'últim vagó|no vull cap perdó|faig la revolució",
          "Mil parets|Carrers estrets|Vells secrets|Tots ben drets ; pintem totes les parets|pels carrers més estrets|el barri té secrets|aguantem tots ben drets|ens han pres tots els drets|som quatre i ben inquiets",
          "Matinada|Nit cremada|Ciutat cansada|Vida robada ; torno de matinada|la nit està cremada|la ciutat és cansada|la vida ens és robada|la cara és amagada|la lluna és apagada",
          "Fa olor de benzina|Vida canina|Ciutat en ruïna|Fosca cortina ; tot fa olor de benzina|porto vida canina|la ciutat és ruïna|la nit baixa cortina|el fum s'endevina|la boira ens domina",
          "Nit urbana|Fora la gana|Quina setmana|Sona la campana ; cau la nit urbana|passem set i gana|s'acaba la setmana|ja sona la campana|la lluna és ben llunyana|la colla és com germana",
          "Tot és fum|Poca llum|Mal costum|Nit i fum ; la ciutat és tot fum|ens queda poca llum|tenim el mal costum|la nit fa olor de fum|el carrer no té llum|ja no hi ha cap perfum",
          "Pels racons|Mil cançons|Sonen trons|Sense raons ; ens trobem pels racons|cridem mil cançons|a fora sonen trons|perdem les il·lusions|no volem més sermons|omplim els carrerons"
        ]
      },
      sistema: {
        open: ['Des de dalt', 'Per la tele', 'Cada any', 'Amb corbata', 'Al despatx', 'Sense vergonya', 'Com ahir', 'Dia a dia', 'Darrere el vidre', 'Amb paraules', 'Mentre dormim', 'Un cop més'],
        fam: [
          "Prou de mentir|Vull decidir|Ho he de dir|No cal patir ; només saben mentir|volem decidir|algú ho havia de dir|ens fan molt patir|no ens faran fugir|no ens podran dividir",
          "Massa poder|Res a fer|Tot pel diner|Fora el banquer ; tenen massa poder|diuen: no hi ha res a fer|només volen diner|que pagui el banquer|ens volen al carrer|ho tornaran a fer",
          "Corrupció|Televisió|Sense opció|Revolució ; tot és corrupció|ho diu la televisió|no ens donen cap opció|falta una revolució|ens venen la il·lusió|ens sobra la raó",
          "Tots enganyats|Prou de callats|Ben lligats|Com soldats ; ens tenen enganyats|ens volen ben callats|vivim de peus lligats|marxem com uns soldats|estem tots vigilats|ens volen separats",
          "Tots iguals|Per quatre rals|Mals senyals|Mil canals ; ens volen tots iguals|ens compren per quatre rals|ens donen mals senyals|menteixen mil canals|no som uns animals|paguem tots els seus mals",
          "Prou paciència|Zero decència|Mala consciència|Pura urgència ; s'acaba la paciència|no tenen cap decència|demanen obediència|ens dicten la sentència|ens queda la consciència|tot és indiferència",
          "Mà dura|Prou censura|Quina factura|Vida dura ; ens tracten amb mà dura|ens posen la censura|paguem la factura|la vida és massa dura|no hi trobem cap cura|tot és pura impostura",
          "Quina hipocresia|Ve la policia|Mala companyia|Falsa garantia ; tot és hipocresia|ja ve la policia|són mala companyia|no hi ha cap garantia|ens venen fantasia|ens roben cada dia"
        ]
      },
      avorriment: {
        open: ['Tinc vint anys', 'Al sofà', 'Cada tarda', 'Sense un duro', 'Al meu poble', 'Tot el sant dia', 'Un altre estiu', 'Mirant el sostre', 'A casa els pares', 'Sense feina', 'Cada diumenge', 'Ves quin pla'],
        fam: [
          "Cap futur|Tot és dur|Contra el mur|Cel obscur ; no tenim cap futur|tot plegat és molt dur|xoquem contra el mur|el cel és ben obscur|res no és segur|no hi ha res de pur",
          "M'he avorrit|Tot el dia al llit|Quin neguit|Res no he dit ; ja m'he ben avorrit|no m'aixeco del llit|em menja el neguit|tot ja està escrit|em sento petit|torna a fer-se de nit",
          "Passa l'hora|Ningú no m'enyora|Tot s'evapora|Vida a fora ; lenta passa l'hora|ningú ja no m'enyora|el temps s'evapora|la vida és a fora|la tarda em devora|el rellotge plora",
          "Estic mandrós|Ben nerviós|Tot és dubtós|Món enganyós ; em llevo ben mandrós|em poso nerviós|el futur és dubtós|el món és enganyós|el dia és boirós|tot plegat és penós",
          "Quin paisatge|Sense coratge|Mal viatge|Tot és miratge ; miro el mateix paisatge|em falta el coratge|la vida és mal viatge|el futur és miratge|no tinc cap equipatge|m'espera un llarg viatge",
          "Massa calor|Res de millor|Mal humor|Sense valor ; fa massa calor|no hi ha res millor|em llevo amb mal humor|res no té valor|tot fa la mateixa olor|em falta el motor",
          "Tinc vint anys|Mals paranys|Temps estranys|Sense guanys ; ja he fet els vint anys|tot són paranys|vivim temps estranys|treballo sense guanys|em passen els anys|em sobren desenganys",
          "Sol i quiet|Món estret|Res concret|Vell secret ; em quedo sol i quiet|el poble és massa estret|no tinc cap pla concret|guardo un vell secret|tot em sembla imperfet|faig el que sempre he fet"
        ]
      },
      concert: {
        open: ['Al local', 'Tres acords', 'Amb la guitarra', "Dalt l'escenari", 'A tot volum', 'Entre el públic', 'Al soterrani', 'Un, dos, tres', 'Sense assajar', "Amb l'ampli", 'A la fila', 'Suant tots'],
        fam: [
          "Fem soroll|Fins al coll|Cop de genoll|Més soroll ; ens agrada el soroll|suem fins al coll|saltem a cop de genoll|el terra és un toll|l'ampli fa molt soroll|ningú no es queda moll",
          "Toca fort|Més fort|Quina sort|Fins la mort ; la banda toca fort|ho volem molt més fort|tenim molta sort|punk fins a la mort|aguantem com un fort|no ens cal cap passaport",
          "Sona la guitarra|Tots a la barra|Nit de farra|Veu que esgarra ; crida la guitarra|ens trobem a la barra|avui sortim de farra|la veu se m'esgarra|toquem amb molta garra|cantem com la cigarra",
          "Al local|Volum brutal|Bé o mal|Nit total ; assagem al local|el volum és brutal|toquem bé o mal|la nit és total|això és un festival|sona l'acord final",
          "Mil crits|Sang als dits|Quines nits|Tots units ; la sala és plena de crits|ens fan mal tots els dits|recordo aquelles nits|saltem tots ben units|tornem a casa rendits|sortim ben divertits",
          "Alça la veu|Mou el peu|Canteu|Salteu ; tothom alça la veu|ningú no para el peu|vull que tots canteu|vull que tots salteu|digueu-me què voleu|a l'escenari pugeu",
          "Quin embolic|Punk antic|Vine, amic|Cop de pic ; el concert és un embolic|toquem un punk antic|puja aquí dalt, amic|tinc la veu al melic|el plat fa un repic|no cal ser gaire ric",
          "Amplis potents|Crits valents|Tots contents|Sense dents ; els amplis són potents|els crits són valents|tornem tots contents|cantem sense dents|els cops són contundents|estrenyem fort les dents"
        ]
      },
      resistencia: {
        open: ['Braç a braç', 'Tots a una', 'Des del barri', 'Sense treva', 'Fins al final', 'Peti qui peti', 'Amb el cap alt', 'Ni un pas enrere', 'Avui i sempre', 'Carrer a carrer', 'Dempeus', 'Units'],
        fam: [
          "Resistirem|No callarem|Tornarem|Vencerem ; sabem que resistirem|mai més no callarem|demà hi tornarem|un dia vencerem|junts ens en sortirem|no ens agenollarem",
          "No passaran|Ja ho veuran|Cauran|Ens sentiran ; diem que no passaran|aviat ja ho veuran|els murs un dia cauran|de lluny ens sentiran|no ens aturaran|mai no ens venceran",
          "Barricada|Gent plantada|Veu alçada|Lluita guanyada ; muntem la barricada|la gent està plantada|tenim la veu alçada|la lluita és guanyada|la por és superada|la plaça és ocupada",
          "Esperança|Sense venjança|Bona aliança|Confiança ; ens queda l'esperança|no busquem la venjança|fem una gran aliança|tenim la confiança|el poble sempre avança|s'inclina la balança",
          "Tots dempeus|Mil veus|Meus i teus|Sense déus ; aguantem tots dempeus|som més de mil veus|els carrers són meus i teus|no volem amos ni déus|trepitgem amb els peus|cridem amb totes les veus",
          "Sense bandera|Primavera|Cap frontera|Fora barrera ; no tenim cap bandera|vindrà la primavera|no volem cap frontera|saltem cada barrera|omplim la carretera|la gent ja ens espera",
          "Dignitat|Unitat|Barri alçat|Mai derrotat ; lluitem per dignitat|ens salva la unitat|el barri s'ha alçat|el poble no és derrotat|ningú no ha reculat|el mur ja ha tremolat",
          "Som germans|Mil mans|Fora tirans|Nous plans ; lluitem com a germans|alcem totes les mans|fem fora els tirans|tenim uns altres plans|som éssers humans|fem petits els grans"
        ]
      }
    },
    horror: {
      cementiri: {
        open: ['A mitjanit', 'Sota la terra', 'Entre les tombes', 'Dins del taüt', 'Quan toquen dotze', 'Al cementiri', 'Amb la boira', 'Sense cap', 'Des del nínxol', 'Sota la lluna', 'Pas a pas', 'Lentament'],
        fam: [
          "Estic mort|Ball de la mort|Crida fort|Mala sort ; ja fa temps que estic mort|ballem el ball de la mort|el zombi crida fort|tens molt mala sort|ningú no et dona suport|no en sortiràs amb sort",
          "Mou els ossos|Fets a trossos|Udolen gossos|Salten fossos ; fem cruixir tots els ossos|ens cauen els trossos|udolen tots els gossos|sortim de tots els fossos|els cucs es fan més grossos|ens persegueixen mossos",
          "Mil taüts|Tots perduts|Morts i muts|Pocs minuts ; s'obren tots els taüts|estem tots ben perduts|els morts ja no són muts|et queden pocs minuts|fem uns crits ben aguts|anem podrits i bruts",
          "Vull cervell|Fred de clatell|Tros de pell|Tot vermell ; només volem cervell|sents fred al clatell|et cau un tros de pell|el terra és ben vermell|ens surt un nou budell|truquem al teu castell",
          "Sota terra|Fred de serra|La mà s'aferra|Crit de guerra ; dormim sota la terra|se sent una serra|una mà se t'aferra|fem el crit de guerra|la boira tot ho enterra|la tomba es desenterra",
          "Mil horrors|Males olors|Marcides flors|Sense cors ; veuràs mil horrors|pugen males olors|et portem marcides flors|et venen les suors|ens mengem els vostres cors|no tenim ja colors",
          "L'esquelet|Tot estret|Blanc i net|Mig desfet ; balla l'esquelet|el taüt és massa estret|tinc l'os blanc i net|vaig tot mig desfet|somric satisfet|ho guardo en secret",
          "Morts vivents|Pocs supervivents|Mossec de dents|Ulls absents ; som els morts vivents|queden pocs supervivents|clavem totes les dents|tenim els ulls absents|caminem ben lents|venim com els vents"
        ]
      },
      nit: {
        open: ['Amb lluna plena', 'Dalt del castell', 'Quan cau la nit', 'Entre ratpenats', 'Sota la capa', "A l'hora bruixa", 'Vora el bosc', 'Sense mirall', 'Des de la torre', 'Amb els ullals', 'Dins la boira', "Abans de l'alba"],
        fam: [
          "Sota la lluna|Nit bruna|Mala fortuna|Tots a una ; udolem a la lluna|la nit és freda i bruna|tens mala fortuna|ataquem tots a una|no se'n salva ni una|la sang és la fortuna",
          "Vull sang|Sang i fang|Gust de sang|Set de sang ; aquesta nit vull sang|venim de sota el fang|m'agrada el gust de sang|tinc molta set de sang|soc un mort d'alt rang|deixo petjades de fang",
          "Mossec al coll|Sang a doll|Tremola el genoll|Nit de soroll ; et mossego el coll|la sang raja a doll|et tremola el genoll|no facis cap soroll|et caus dins d'un toll|tens el front tot moll",
          "Ratpenats|Condemnats|Mal despertats|Ulls injectats ; volen els ratpenats|estem tots condemnats|sortim mal despertats|tenim ulls injectats|anem ben afamats|deixem els colls marcats",
          "Riu la bruixa|Nit de bruixa|Sang de maduixa|Corda fluixa ; a dalt riu la bruixa|és la nit de la bruixa|la sang té gust de maduixa|balles a la corda fluixa|et pessiga la cuixa|l'olla bull i no afluixa",
          "Clavo l'ullal|Nit infernal|Bes mortal|Soc animal ; et clavo l'ullal|la nit és infernal|et faig un bes mortal|em torno animal|el teu destí és fatal|no et farà gaire mal",
          "Nit obscura|Sepultura|Criatura|Quina tortura ; surto en la nit obscura|deixo la sepultura|soc una criatura|la set és tortura|la lluna és ben pura|la sang és la cura",
          "La lluna creix|El monstre neix|Sempre el mateix|Ningú no et coneix ; a fora la lluna creix|un altre monstre neix|el final és el mateix|ningú no et reconeix|l'ombra s'engrandeix|el fred t'envaeix"
        ]
      },
      casa: {
        open: ['Dalt del turó', 'Darrere la porta', 'Al soterrani', 'Sota el llit', "Per l'escala", "Dins l'armari", 'A les golfes', 'Quan marxa el llum', 'Al passadís', 'Sense fer soroll', 'Rere el mirall', 'Cap a les dotze'],
        fam: [
          "Quina por|Casa del terror|Crit d'horror|Fred i suor ; a casa hi fa molta por|és la casa del terror|se sent un crit d'horror|em cau freda la suor|sento una estranya olor|truquen al corredor",
          "Casa encantada|Escala trencada|Ombra allargada|Nit glaçada ; visc a la casa encantada|l'escala està trencada|veig una ombra allargada|la nit és ben glaçada|la clau està rovellada|sento una riallada",
          "Has de fugir|No puc dormir|Sento gemir|Cal sortir ; d'aquí no pots fugir|aquí no es pot dormir|algú torna a gemir|no trobo per on sortir|la porta es vol obrir|el terra fa cruixir",
          "Casa tenebrosa|Nit boirosa|Mà pelosa|Veu misteriosa ; la casa és tenebrosa|la nit és ben boirosa|em toca una mà pelosa|sento una veu rabiosa|la porta és sorollosa|l'aranya és verinosa",
          "Sota el llit|Quin crit|Mal esperit|Mitjanit ; hi ha un monstre sota el llit|a dalt se sent un crit|volta un mal esperit|ja toca mitjanit|m'ha tocat un dit|el gat s'ha esbalaït",
          "Teranyina|Vella cortina|Ombra veïna|Llum mesquina ; tot és ple de teranyina|es mou la vella cortina|ve una ombra veïna|la llum és mesquina|la por m'assassina|l'escala s'inclina",
          "Va grinyolant|Pas vacil·lant|Ombra gegant|Cor bategant ; la porta va grinyolant|faig un pas vacil·lant|hi ha una ombra gegant|tinc el cor bategant|el vent entra xiulant|l'espelma es va apagant",
          "Calavera|Nit sencera|Ombra lleugera|Veu forastera ; riu una calavera|crido la nit sencera|passa una ombra lleugera|sento una veu forastera|la mort és a l'espera|s'apaga la llumenera"
        ]
      }
    },
    love: {
      enamorament: {
        open: ['Quan et miro', 'Amb tu', 'Des que hi ets', 'Al teu costat', 'Cada cop', 'Sense voler', 'De sobte', 'Amb un somriure', 'Tota la tarda', "A cau d'orella", 'Entre nosaltres', 'Per tu'],
        fam: [
          "Et vull besar|Deixa't estimar|Vull tornar|Fes-me volar ; només et vull besar|em deixo estimar|amb tu vull tornar|em fas volar|no et puc oblidar|et torno a trucar",
          "Els teus ulls|Mil fulls|Entre esculls|Sense orgulls ; em perdo als teus ulls|t'escric més de mil fulls|navego entre esculls|t'estimo sense orgulls|llegeixo els teus ulls|et miro i tu m'aculls",
          "Boig d'amor|Bat el cor|Més que l'or|Dolç tremolor ; estic ben boig d'amor|em bat molt fort el cor|vals molt més que l'or|sento un dolç tremolor|tu em treus tota la por|em tornes el color",
          "Un petó|Dolça cançó|Quina emoció|Tens raó ; et robo un petó|t'escric una cançó|em mata l'emoció|potser tens raó|et demano perdó|perdo la noció",
          "Quina alegria|Cada dia|Melodia|Bogeria ; em dones alegria|et penso cada dia|ets la meva melodia|quina gran bogeria|em fas companyia|et vull de nit i de dia",
          "El teu somriure|Deixa'm viure|Vull riure|Sentir-me lliure ; m'agrada el teu somriure|amb tu aprenc a viure|em fas tornar a riure|em sento molt més lliure|t'acabo d'escriure|ja no em sé pas descriure",
          "Les teves mans|Com abans|Fem plans|Balls llunyans ; agafo les teves mans|t'estimo com abans|fem mil i un plans|sonen balls llunyans|som dos éssers humans|ens fem grans i més grans",
          "Enamorat|Al teu costat|Ben atrapat|Cor robat ; estic enamorat|vull ser al teu costat|m'has ben atrapat|el cor m'has robat|per tu he canviat|per fi t'he trobat"
        ]
      },
      desamor: {
        open: ['Des que no hi ets', 'Sense tu', 'Al teu portal', 'Cada nit', 'Davant del mòbil', "A l'estació", 'Un altre cop', 'Ja fa un any', 'Sota el xàfec', 'Encara avui', 'Sol al bar', 'De cop'],
        fam: [
          "M'has deixat|Cor trencat|Ben plantat|Llit glaçat ; ja fa temps que m'has deixat|tinc el cor trencat|m'has deixat plantat|trobo el llit glaçat|no m'has perdonat|tot ho has oblidat",
          "T'estimava|Et buscava|Em pensava|Tot s'acabava ; jo sí que t'estimava|per tot arreu et buscava|no era el que em pensava|veia com s'acabava|de nit et trucava|el tren ja marxava",
          "Mai més|Ja no hi és|Si tornés|Potser després ; no et vull veure mai més|a casa ja no hi és|què faria si tornés|potser ho entendré després|no en queda res de res|em costa un cop més",
          "Quina mentida|Trista partida|Nit humida|Cara entristida ; tot era una mentida|recordo la partida|la nit cau humida|la cara és entristida|la carta és llegida|la sort és decidida",
          "Estic sol|Sense consol|Fred al llençol|Surt el sol ; ara dormo tot sol|no trobo cap consol|fa fred sota el llençol|em molesta el sol|em quedo com un mussol|el cafè fa de bressol",
          "Mil petons|Tristes cançons|Males raons|Vells racons ; recordo els teus petons|escolto tristes cançons|em dones males raons|et veig per tots els racons|em sobren les lliçons|guardo les teves cançons",
          "Cap trucada|Última mirada|Vella abraçada|Sense tornada ; no rebo cap trucada|recordo la mirada|enyoro l'abraçada|és cançó sense tornada|la porta l'has tancada|la foto és esquinçada",
          "No tornarà|Passarà|El temps dirà|Demà plourà ; ja sé que no tornarà|diuen que passarà|el temps ho curarà|algú altre vindrà|el cor s'acostumarà|la pluja ho rentarà"
        ]
      },
      records: {
        open: ['Aquell estiu', 'Fa molts anys', 'Jo recordo', 'A la platja', 'Amb disset anys', 'Sobre la moto', 'Al vell banc', 'Cada agost', 'Entre fotos', 'Al nostre bar', 'Quan érem joves', 'Aquella nit'],
        fam: [
          "Aquell estiu|Cor esquiu|Foc viu|Record viu ; recordo aquell estiu|tenies el cor esquiu|érem com un foc viu|el record encara és viu|ens banyàvem al riu|el mar encara ho diu",
          "Ballàvem|Cantàvem|Somiàvem|Ens estimàvem ; tota la nit ballàvem|per la platja cantàvem|desperts somiàvem|tu i jo ens estimàvem|fins tard ens quedàvem|mai no ens cansàvem",
          "Fotografia|Aquell dia|Hi tornaria|Vella alegria ; tinc la fotografia|recordo aquell dia|jo sí que hi tornaria|enyoro l'alegria|la ràdio ens seguia|el mar ens coneixia",
          "Aquell moment|Record present|Cor adolescent|Dolç vent ; torno a aquell moment|et tinc sempre present|tot era innocent|bufava un dolç vent|passava lentament|jo era tan diferent",
          "Bicicleta|Vella caseta|Cala secreta|Lluna quieta ; anàvem en bicicleta|dormíem a la caseta|la cala era secreta|la lluna estava quieta|em deies poeta|portaves una jaqueta",
          "Aquell bar|Davant del mar|Puc recordar|Hi vull tornar ; ens vèiem al vell bar|sèiem davant del mar|encara ho puc recordar|un dia hi vull tornar|no paràvem de ballar|ens deixàvem portar",
          "El teu nom|Com tothom|No sé com|Gots de rom ; encara dic el teu nom|érem joves com tothom|et vaig perdre no sé com|bevíem gots de rom|el cel era de plom|ho sabia tothom",
          "Vas ser la primera|Tarda sencera|Vella carretera|Llum de foguera ; tu vas ser la primera|una tarda sencera|per la vella carretera|a la llum de la foguera|quina primavera|el temps no espera"
        ]
      }
    },
    dark: {
      grisa: {
        open: ['Sota la pluja', 'Entre el formigó', 'Pels passadissos', "A l'andana", 'Darrere el vidre', 'Sota el pont', 'Cada vespre', "A l'hora punta", 'Entre la boira', 'Al pàrquing', 'Sense rumb', "Tot l'hivern"],
        fam: [
          "Ciutat grisa|Freda brisa|Paret llisa|Hora imprecisa ; visc en una ciutat grisa|bufa una freda brisa|toco la paret llisa|l'hora és imprecisa|la gent va indecisa|duc la mateixa camisa",
          "Formigó|Vella estació|Cap direcció|Trist cantó ; tot és de formigó|dormo a la vella estació|no tinc cap direcció|m'espero en un cantó|plou sobre el carbó|ningú no dona raó",
          "Carrer desert|Ull obert|Res de cert|Mig despert ; el carrer és desert|dormo amb un ull obert|no hi ha res de cert|camino mig despert|tot queda descobert|el bar no està obert",
          "Freds fanals|Vells portals|Hores iguals|Dies banals ; s'encenen freds fanals|passo per vells portals|les hores són iguals|els dies són banals|els trens són puntuals|les cares són com murals",
          "Tot és grisor|Quina fredor|Plena foscor|Vella remor ; la ciutat és grisor|se'm fica la fredor|camino en la foscor|se sent una remor|el cel no té color|em pren un tremolor",
          "Oficines|Vitrines|Rutines|Boirines ; s'apaguen les oficines|em miro a les vitrines|tornen les rutines|baixen les boirines|tanquen les cortines|dormen les veïnes",
          "Caminar|Res a esperar|Cap lloc on anar|Veure passar ; només sé caminar|no hi ha res a esperar|no tinc cap lloc on anar|veig la gent passar|la pluja no vol parar|el fred torna a entrar",
          "Boira i fum|Sense llum|Vell costum|Baix volum ; respiro boira i fum|visc gairebé sense llum|camino per costum|parlo a baix volum|tot sembla un resum|la fàbrica fa fum"
        ]
      },
      buit: {
        open: ['A les quatre', 'Dins del cap', 'Sense dormir', 'A la cambra', 'Davant del mirall', 'Tot sol', 'Entre llençols', 'Hora a hora', 'Sense ningú', 'Al replà', 'Nit rere nit', 'En silenci'],
        fam: [
          "Em sento buit|Ja són les vuit|Cap fruit|Curtcircuit ; per dins em sento buit|encara no són les vuit|res no dona cap fruit|tinc un curtcircuit|el sopar és mig cuit|tot ha estat un descuit",
          "Absència|Falsa presència|Indiferència|Pura existència ; em pesa la teva absència|noto una presència|visc en la indiferència|arrossego l'existència|perdo la paciència|la nit dicta sentència",
          "Davant del mirall|Fred metall|Cap detall|Cor de cristall ; no em conec al mirall|el llit és de fred metall|no recordo cap detall|tinc el cor de cristall|m'ofega el treball|em trenco com un vitrall",
          "Nit en blanc|Sostre blanc|Fred de banc|Cor estanc ; passo la nit en blanc|miro el sostre blanc|dormo en un fred banc|tinc el cor ben estanc|el llençol és massa blanc|em fa mal tot el flanc",
          "Nit immensa|Corda tensa|Sense defensa|El cap que pensa ; la nit és immensa|la corda és ben tensa|no tinc cap defensa|el cap pensa i pensa|la boira és densa|l'espera és intensa",
          "Mig dormint|Vaig fugint|Cor patint|Temps morint ; visc sempre mig dormint|de mi vaig fugint|tinc el cor patint|el temps es va morint|les hores van seguint|em vaig consumint",
          "No sé per què|Res no va bé|Un altre cafè|No dormiré ; estic trist i no sé per què|ja res no em va bé|em faig un altre cafè|demà m'aixecaré|tampoc no dormiré|a ningú no ho diré",
          "Quina pena|Lluna plena|Llarga cadena|Sang a la vena ; arrossego una pena|no dormo amb lluna plena|em pesa la cadena|el fred corre per la vena|la nit no és serena|l'ànima és aliena"
        ]
      },
      maquines: {
        open: ['A la pantalla', 'A la fàbrica', 'Amb el mòbil', 'Sota el focus', 'Torn de nit', 'Com un robot', 'Dia i nit', 'Sense senyal', 'A la cadena', 'Fitxo i entro', 'Entre cables', 'En sèrie'],
        fam: [
          "Pantalla|Tothom calla|Tot falla|Freda muralla ; visc dins d'una pantalla|aquí tothom calla|el sistema falla|creix una muralla|perdo la batalla|la màquina mai no falla",
          "Sense connexió|Repetició|Massa pressió|Producció ; perdo la connexió|tot és repetició|sento massa pressió|puja la producció|no hi ha cap emoció|falla la transmissió",
          "Soc un robot|Ho veuen tot|Ni un mot|Gran complot ; treballo com un robot|les càmeres ho veuen tot|no puc dir ni un mot|sospito un gran complot|compto cada lot|no val el meu vot",
          "Controlats|Numerats|Programats|Connectats ; vivim tots controlats|anem ben numerats|estem tots programats|dormim ben connectats|ens volen ben clonats|som xifres i resultats",
          "És la llei|Sense remei|Fora de servei|Visca el rei ; diuen que és la llei|no hi ha cap remei|estic fora de servei|la màquina és el rei|cada peça és de servei|obeeixo el nou rei",
          "Estic confús|Quin abús|Cor reclús|Fora d'ús ; em llevo ben confús|això és un abús|visc com un reclús|estic fora d'ús|agafo l'autobús|soc d'un sol ús",
          "Va girant|Funcionant|Sempre vigilant|Tot comptant ; la roda va girant|tot segueix funcionant|hi ha algú vigilant|les hores vaig comptant|la cinta va passant|el motor va roncant",
          "Zeros i uns|Tots els dilluns|Llocs comuns|Només alguns ; som zeros i uns|fitxem tots els dilluns|diem llocs comuns|se salven només alguns|tornem cada dilluns|en queden només uns"
        ]
      }
    }
  };
  return { DATA };
});
