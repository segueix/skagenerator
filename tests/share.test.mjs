import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSharePages, SHARE_PAGES, SITE_URL, shareTitle } from '../scripts/share-pages.mjs';

test('pàgines per compartir cada emissora: títol, imatge per a WhatsApp i redirecció a la ràdio', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'share-'));
  await writeFile(join(dist, 'index.html'), '<head><title>Radio Spam</title>\n  <!-- share-meta -->\n</head>');
  await buildSharePages(dist);
  const og = (html, property) => html.match(new RegExp(`<meta property="${property}" content="([^"]*)">`))?.[1];
  // Pàgina principal: etiquetes generals de Ràdio SPAM.
  const index = await readFile(join(dist, 'index.html'), 'utf8');
  assert.equal(og(index, 'og:title'), 'Ràdio SPAM');
  assert.equal(og(index, 'og:image'), `${SITE_URL}share/radio-spam.jpg`);
  assert(!index.includes('share-meta'));
  const titles = {};
  for (const page of SHARE_PAGES) {
    const html = await readFile(join(dist, page.path, 'index.html'), 'utf8');
    titles[page.path] = og(html, 'og:title');
    assert.equal(og(html, 'og:title'), shareTitle(page));
    // La imatge té adreça absoluta (WhatsApp no en llegeix de relatives), existeix i és petita.
    assert.equal(og(html, 'og:image'), `${SITE_URL}share/${page.image}`);
    const image = await stat(join(dist, 'share', page.image));
    assert(image.size > 20000 && image.size < 300 * 1024, `${page.image}: ${image.size}`);
    assert.equal(og(html, 'og:url'), SITE_URL + page.path);
    // Porta a la ràdio amb l'emissora (i l'estil de batucada).
    const back = '../'.repeat(page.path.split('/').filter(Boolean).length);
    assert(html.includes(`url=${back}?${page.query.replace('&', '&amp;')}`) && html.includes(`location.replace("${back}?${page.query}"`), page.path);
  }
  assert.equal(titles['punk/'], 'Escolta Punk a Ràdio SPAM');
  assert.equal(titles['ska-punk/'], 'Escolta Ska-Punk a Ràdio SPAM');
  assert.equal(titles['batucada/'], 'Escolta Batucada a Ràdio SPAM');
  assert.equal(titles['batucada/percudium/'], 'Escolta Batucada Percudium a Ràdio SPAM');
});
