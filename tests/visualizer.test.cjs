'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('visualitzador VaTuCalla!: es carrega a la web, es publica i es veu per sobre de la ràdio', () => {
  const html = read('index.html'), build = read('scripts/build.mjs'), css = read('radio.css'), radio = read('radio.js'), viz = read('visualizer.js');
  assert.match(html, /<script defer src="visualizer.js"><\/script>/);
  assert.match(html, /id="radio-visualizer"/);
  assert.equal((build.match(/'visualizer\.js'/g) || []).length, 2, 'es copia i entra a la llista de recursos');
  // La ràdio amaga tot el que no és seu: el visualitzador n'ha de quedar fora.
  assert.match(css, /body > :not\(\.radio\):not\(dialog\):not\(\.vtc\) \{ display: none !important; \}/);
  assert.match(radio, /window\.VaTuCalla\.open\(/);
  // Nom del projecte a baix a la dreta, títol a dalt i centrat, i exportació a MP4 (o WebM).
  assert.match(viz, /const PROJECT = 'VaTuCalla!'/);
  assert.match(viz, /ctx\.textAlign = 'right'; ctx\.textBaseline = 'bottom'/);
  assert.match(viz, /ctx\.textAlign = 'center'; ctx\.textBaseline = 'top'/);
  assert.match(viz, /'video\/mp4;codecs=avc1\.640028,mp4a\.40\.2'/);
  // Qualitat triable (compressió): de l'alta (10 Mb/s) a la mínima, perquè una Short es pugui enviar per WhatsApp.
  for (const key of ['alta', 'mitjana', 'whatsapp', 'minima']) assert.match(viz, new RegExp(`\\n    ${key}: \\{ name: `), key);
  assert.match(viz, /videoBitsPerSecond: quality\.video, audioBitsPerSecond: quality\.audio/);
  // Una Short de 90 s amb la qualitat WhatsApp: menys de 16 MB.
  const wa = viz.match(/whatsapp: \{ name: 'WhatsApp', scale: [^,]+, video: ([\d_]+), audio: ([\d_]+) \}/);
  assert(wa && (Number(wa[1].replace(/_/g, '')) + Number(wa[2].replace(/_/g, ''))) / 8 * 90 / 1e6 < 16);
  // Cinc dissenys (l'Infinit ja no hi és: el substitueix la colla dels avis).
  assert(!/\n    infinit: \{/.test(viz));
  // La urna que balla (sàtira naïf de les eleccions a l'estat veí): coneix la durada de la cançó per fer el final.
  assert.match(viz, /ELECCIONS A L’ESTAT VEÍ/); assert.match(viz, /duration: buffer\.duration/);
  for (const design of ['colla', 'urna', 'alertes', 'tambors', 'carnaval', 'calcadao', 'rio']) assert.match(viz, new RegExp(`\\n    ${design}: `), design);
});

test('l’editor de l’inici és només dins de la Batucada, abans de començar, i es pot plegar', () => {
  const html = read('index.html'), radio = read('radio.js');
  assert(!html.includes('id="opening-open"') && !html.includes('id="opening-dialog"'), 'no és a la pantalla general');
  const setup = html.slice(html.indexOf('id="radio-batucada"'), html.indexOf('id="radio-player"'));
  assert.match(setup, /<details class="opening-panel" id="opening-panel">/);
  for (const id of ['opening-row', 'opening-rhythm', 'opening-whistles', 'opening-style', 'opening-bpm', 'opening-use', 'opening-preview', 'opening-go']) assert(setup.includes(`id="${id}"`), id);
  // La targeta de la Batucada obre la preparació; les altres emissores comencen de seguida.
  assert.match(radio, /button\.dataset\.station === 'batucada' \? openBatucadaSetup\(\) : chooseStation\(button\.dataset\.station\)/);
  // L'inici només s'aplica a la primera cançó (i només si es fa servir).
  assert.match(radio, /customOpening = design\.use !== false && \(design\.mode !== 'voice' \|\| design\.voice\) \?/);
  assert.match(radio, /const custom = customOpening; customOpening = null;/);
});
