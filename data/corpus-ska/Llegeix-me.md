# Corpus de 50 cançons d’ska

Quatre famílies. Cada entrada correspon a la pista o transcripció que indica la font. La selecció inclou rocksteady, reggae primerenc, dub i fusions per captar com varia el ritme entre famílies.

| Família | Cançons |
| --- | ---: |
| Jamaica i primer ska | 12 |
| 2 Tone i revival britànic | 17 |
| Països Catalans | 14 |
| Revival i fusions internacionals | 7 |

## Fitxers

— `corpus_ska.json` conté les 50 fitxes amb enllaços a fonts i estat de cada dada.
— `cancons.csv` permet filtrar el corpus en un full de càlcul.
— `seccions.csv` mostra l’ordre i, quan es coneixen, els segons, els compassos, els acords i la instrumentació.
— `instruments.csv` recull les observacions per passatge i els crèdits generals.
— `perfils_ska.json` conté els recomptes generals i per família. Es pot importar al generador.

## Lectura de les dades

— Les 50 pistes tenen BPM, una tonalitat publicada o estimada i exemples de progressions amb font. Les notes de versió i el camp `estat` identifiquen dubtes. Una xifra al camp alternatiu indica un altre recompte del mateix pols. Les medianes de BPM es calculen tal com s’indica a cada perfil.
— Les progressions són fragments ordenats. Els graus es calculen amb la tònica de la fitxa. Majúscules i minúscules indiquen l’acord major i menor. Els signes `b` i `#` indiquen el desplaçament cromàtic del grau respecte de l’escala major de referència. Si dues fonts discrepen sobre la tònica, els graus queden buits.
— La forma té quatre estats, identificats com a `documentada`, `estimacio_automatica`, `parcial` i `pendent`. La forma parcial ordena els passatges identificats. En algunes fitxes només es coneix l’ordre dels blocs vocals. Els temps de l’anàlisi automàtica són orientatius. Un camp buit significa que manca evidència. Els crèdits de disc i les estimacions tímbríques es mantenen fora dels recomptes de passatges.
— El mapa harmònic agrupa blocs de 32 mostres de la graella d’acords visible. Un mateix identificador en dos llocs representa perfils d’acords semblants. És un indici per localitzar repeticions i canvis. Els recomptes de forma i de transicions usen únicament formes documentades.
— Els recomptes instrumentals indiquen en quantes gravacions apareix un instrument documentat per a un tipus de secció. Les fonts no solen indicar tots els instruments ni totes les absències. L’indici de cada instrument es compta un cop per pista i tipus de secció.
— Els CSV fan servir punt i coma i UTF-8 amb BOM. Els camps buits equivalen a `null` o a llistes buides del JSON. Les dades contenen anàlisi, acords i referències. Les melodies, les lletres i l’àudio en queden fora.

## Ús a l’Ska Generator

1. Tria una família i genera un BPM dins dels trams observats. Reparteix el pes explícitament entre famílies si vols que tinguin la mateixa presència.
2. Construeix una forma nova a partir de les transicions habituals i fes variar el nombre de repeticions. Si una família té pocs exemples, usa les dades generals.
3. Tria graus d’acords segons l’estil i la funció de cada bloc. Transposa’ls al to escollit i crea un ritme harmònic propi. Evita encadenar tots els elements d’una mateixa fitxa.
4. En una peça instrumental, tracta la veu com una funció de primer pla. Assigna-la a un vent, guitarra o teclat i compon una frase nova. Fes servir tornades amb vents en bloc, estrofes amb respostes breus o interludis amb un sol instrument segons el contrast que busquis.
5. Comprova que la forma i el patró harmònic conjunts tinguin variacions originals. Aquest corpus petit serveix per ajustar preferències i pesos.

## Cobertura

— 23 denominacions d’intèrpret. Prince Buster i Prince Buster & The All Stars comparteixen el mateix artista principal.
— 50 BPM, tonalitats de font i progressions, amb graus calculats en 46 casos.
— 7 formes documentades, 2 estimades automàticament, 21 parcials i 20 pendents.
— 19 pistes amb algun indici instrumental de secció.
