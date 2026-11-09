# Ska Generator

Taller web en català per compondre cançons instrumentals, secció per secció.

## Estructura inicial

Intro (4 compassos) → estrofa (8) → tornada (8) → estrofa (8) → tornada (8) → pont (4) → tornada (8) → final (4).

## Estils i instruments

Només hi ha ska i punk. L’ska té una selecció de 100–180 BPM (128 per defecte) i el punk de 140–220 BPM (180 per defecte). Cada estil ofereix una preselecció de tonalitats majors i menors adequada per treballar amb guitarra i metalls. Són decisions de configuració del taller, no restriccions teòriques dels gèneres.

Guitarres, bateria, baix, trompeta i trombó es poden activar independentment. Els instruments base serveixen de formació inicial per a la cançó. Cada intro, estrofa, tornada, pont, pretornada, instrumental o final pot activar diversos instruments propis; la selecció es desa per secció i no afecta les altres. L’opció «Recupera la formació base» restableix l’herència dels instruments generals. Canviar la formació base només invalida l’àudio de les seccions que la segueixen; canviar l’estil, el tempo o la tonalitat continua afectant-les totes. L’ska utilitza guitarra curta a contratemps i baix caminant; el punk utilitza quintes en corxeres i bateria més directa. Trompeta i trombó tenen mostres i registres diferenciats. No intervenen piano, vibràfon ni coixins de cordes en les noves cançons.

En recuperar un projecte anterior, es conserva l’estructura i la lletra, s’adapta la configuració als dos estils i es deixen les parts pendents de regenerar.

Cada part es genera i s’escolta individualment, amb durada i intensitat pròpies. Tota la cançó comparteix estil, tempo i tonalitat. Per a cada intro, estrofa o tornada, el botó «Genera 5 versions diferents» crea cinc propostes amb progressions d’acords, melodies i patrons rítmics alternatius. Es poden escoltar per separat i escollir la versió definitiva, que és la que es reprodueix a la cançó completa i s’exporta al WAV. Les altres alternatives continuen disponibles. Les seccions repetides (estrofes i tornades) poden tenir una elecció independent. Les cinc composicions es calculen al moment, mentre que l’àudio de les alternatives no seleccionades només es prepara quan s’escolten. La tria i les llavors queden desades al JSON i al navegador. També es poden afegir pretornades i parts instrumentals, reordenar seccions i eliminar-les.

La música instrumental es reprodueix amb mostres enregistrades de GeneralUser GS 2.0.3, mitjançant SpessaSynth Core 4.4.9 dins d’un Web Worker. Les lletres són anotacions: no es genera veu ni cant. No necessita claus d’API ni serveis de generació externs.

## Ús

Compila la web i serveix la carpeta `dist/` des d’un servidor web estàtic (HTTPS o localhost). Prem «Nova cançó», tria la base musical i genera cada part. Quan estiguin totes generades, escolta la cançó completa o exporta-la en WAV estèreo de 44.100 Hz i 16 bits.

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

El build descarrega la versió oficial fixada a `soundbank-source.json`, comprova el SHA-256 i n’extreu vuit presets de guitarra, baix i metalls i dos kits de bateria. La selecció ocupa aproximadament 5,8 MB i es publica a la mateixa web; no hi ha peticions a proveïdors d’àudio durant la reproducció. `.cache/` conserva la font per als builds següents.

El banc conserva les mostres i els moduladors dels presets seleccionats. Els sons de guitarra neta/apagada serveixen per a l’ska, i els de guitarra distorsionada/saturada per al punk. La interpretació introdueix petits canvis de força, temps i ordre de les cordes, sempre a partir de la llavor del projecte. El baix i els dos metalls tenen canals i panoràmiques pròpies.

La primera generació carrega el banc de mostres. La pantalla informa del progrés i permet tornar-ho a provar si falla. El càlcul es fa en un worker per mantenir la interfície disponible. L’escolta individual, la cançó sencera i el WAV fan servir les mateixes mostres estèreo.

Crèdits, llicències i modificacions del banc: [licenses/THIRD_PARTY_NOTICES.md](licenses/THIRD_PARTY_NOTICES.md).
