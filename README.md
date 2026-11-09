# Ska Generator

Taller web en català per compondre cançons instrumentals, secció per secció.

## Estructura inicial

Intro (4 compassos) → estrofa (8) → tornada (8) → estrofa (8) → tornada (8) → pont (4) → tornada (8) → final (4).

Cada part es genera i s’escolta individualment, amb durada i intensitat pròpies. Tota la cançó comparteix estil, tempo i tonalitat. Les tornades comparteixen el motiu musical i les estrofes conserven la mateixa base. També es poden afegir pretornades i parts instrumentals, reordenar seccions i eliminar-les.

La primera versió genera música instrumental amb síntesi al navegador. Les lletres són anotacions: no es genera veu ni cant. No necessita claus d’API ni serveis de generació externs.

## Ús

Obre `index.html` en un servidor web estàtic. Prem «Nova cançó», tria la base musical i genera cada part. Quan estiguin totes generades, escolta la cançó completa o exporta-la en WAV mono de 22.050 Hz.

L’esborrany es desa al navegador. «Desa el projecte» exporta un JSON amb la configuració, les anotacions i les llavors necessàries per reconstruir el so. «Obre un projecte» permet recuperar-lo en un altre navegador. La lletra no es fa servir per compondre la melodia.

## Desenvolupament

Sense dependències d’execució ni pas de compilació obligatori:

```sh
npm test
npm run check
npm run build
```

`dist/` conté la web estàtica preparada per publicar. La carpeta arrel també es pot servir directament, incloent-hi amb GitHub Pages des de la branca `main`. La configuració de publicació a ChatGPT Sites es troba a `.openai/hosting.json`.

El motor original `radioambient.js` conserva la seva API. L’editor fa servir les noves funcions `composeSongPart` i `songPartSamples`, que reutilitzen els instruments sintetitzats del motor.
