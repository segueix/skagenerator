'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('historial: esborrar fàcilment (amb «Desfés», selecció i neteja) i organitzar (cerca, ordre i llistes)', () => {
  const html = read('index.html'), radio = read('radio.js');
  for (const id of ['history-search', 'history-sort', 'history-select', 'history-clean', 'history-new-list', 'history-bulk', 'history-bulk-delete', 'history-bulk-list', 'history-undo-go', 'history-list-rename', 'history-list-delete'])
    assert(html.includes(`id="${id}"`), id);
  // Esborrar ja no demana confirmació cançó per cançó: es pot desfer.
  assert(!radio.includes('Esborrar «${entry.title}» de l’historial?'));
  assert.match(radio, /remove\.addEventListener\('click', \(\) => removeSongs\(new Set\(\[entry\.id\]\)\)\)/);
  assert.match(radio, /function undoRemove\(\)/);
  // Les cançons en ús no s'esborren, i les de les llistes no cauen soles quan l'historial és ple.
  assert.match(radio, /const busy = id => current\?\.id === id/);
  assert.match(radio, /!list\[i\]\.vote && !list\[i\]\.comment && !list\[i\]\.lists\?\.length/);
  for (const sort of ['recent', 'old', 'title', 'plays', 'votes', 'long']) assert.match(radio, new RegExp(`\\n    ${sort}: \\(a, b\\) =>`), sort);
});
