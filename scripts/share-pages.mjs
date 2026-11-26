// Pàgines per compartir cada emissora (i cada estil de batucada). WhatsApp i les altres apps no executen
// JavaScript: llegeixen les etiquetes Open Graph de l'HTML. Cada pàgina porta el seu títol («Escolta Punk a
// Ràdio SPAM») i la seva imatge, i porta de seguida a la ràdio amb l'emissora (?emissora=punk).
// L'adreça pública de la web es pot canviar amb la variable SITE_URL en compilar.
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

export const SITE_URL = (process.env.SITE_URL || 'https://segueix.github.io/skagenerator/').replace(/\/?$/, '/');
export const SHARE_PAGES = [
  { path: 'ska/', station: 'ska', query: 'emissora=ska', label: 'Ska', image: 'ska.jpg', sub: 'Jamaicà, rocksteady, 2-tone, ska-punk… cançons noves, compostes al teu dispositiu.' },
  { path: 'punk/', station: 'punk', query: 'emissora=punk', label: 'Punk', image: 'punk.jpg', sub: 'Punk del 77, Oi!, hardcore, pop-punk… cançons noves, compostes al teu dispositiu.' },
  { path: 'ska-punk/', station: 'mix', query: 'emissora=ska-punk', label: 'Ska-Punk', image: 'ska-punk.jpg', sub: 'Una de ska, una de punk. Cançons noves, compostes al teu dispositiu.' },
  { path: 'batucada/', station: 'batucada', query: 'emissora=batucada', label: 'Batucada', image: 'batucada.jpg', sub: 'Només percussió: samba, samba-reggae, ijexá, maracatu, baião, samba-funk i Percudium.' },
  { path: 'batucada/samba/', station: 'batucada', query: 'emissora=batucada&estil=samba', label: 'Samba', image: 'batucada-samba.jpg', sub: 'Batucada de samba: surdos, caixes, repiques i tamborins.' },
  { path: 'batucada/samba-reggae/', station: 'batucada', query: 'emissora=batucada&estil=samba-reggae', label: 'Samba-reggae', image: 'batucada-samba-reggae.jpg', sub: 'Batucada de samba-reggae, a ritme de Salvador.' },
  { path: 'batucada/ijexa/', station: 'batucada', query: 'emissora=batucada&estil=ijexa', label: 'Ijexá', image: 'batucada-ijexa.jpg', sub: 'Batucada d’ijexá: agogô de dues campanes i surdos.' },
  { path: 'batucada/percudium/', station: 'batucada', query: 'emissora=batucada&estil=percudium', label: 'Percudium', image: 'batucada-percudium.jpg', sub: 'Batucada saturada de tambors: diàlegs, aturades i represes.' },
  { path: 'batucada/maracatu/', station: 'batucada', query: 'emissora=batucada&estil=maracatu', label: 'Maracatu', image: 'batucada.jpg', sub: 'Batucada de maracatu: alfaies greus, caixa de guerra i gonguê.' },
  { path: 'batucada/baiao/', station: 'batucada', query: 'emissora=batucada&estil=baiao', label: 'Baião', image: 'batucada.jpg', sub: 'Batucada de baião: el ritme de la zabumba i el triangle.' },
  { path: 'batucada/samba-funk/', station: 'batucada', query: 'emissora=batucada&estil=samba-funk', label: 'Samba-funk', image: 'batucada.jpg', sub: 'Batucada de samba-funk: surdos amb groove i caixa al contratemps.' }
];
// Text del títol de l'enllaç: «Escolta Punk a Ràdio SPAM» (a la Batucada amb estil, «Escolta Batucada Percudium…»).
export const shareTitle = p => `Escolta ${p.station === 'batucada' && p.path !== 'batucada/' ? `Batucada ${p.label}` : p.label} a Ràdio SPAM`;
const escape = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function metaTags({ title, description, image, url }) {
  return [`<meta property="og:type" content="website">`, `<meta property="og:site_name" content="Ràdio SPAM">`,
    `<meta property="og:locale" content="ca_ES">`, `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`, `<meta property="og:url" content="${escape(url)}">`,
    `<meta property="og:image" content="${escape(image)}">`, `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`, `<meta property="og:image:alt" content="${escape(title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(description)}">`, `<meta name="twitter:image" content="${escape(image)}">`].join('\n  ');
}
// Escriu les imatges i les pàgines a dist/ i posa les etiquetes generals a dist/index.html.
export async function buildSharePages(dist = 'dist') {
  await mkdir(`${dist}/share`, { recursive: true });
  for (const file of await readdir('share')) if (file.endsWith('.jpg')) await copyFile(`share/${file}`, `${dist}/share/${file}`);
  for (const p of SHARE_PAGES) {
    const depth = p.path.split('/').filter(Boolean).length, back = '../'.repeat(depth), target = `${back}?${p.query}`;
    const title = shareTitle(p), url = SITE_URL + p.path;
    const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(p.sub)}">
  ${metaTags({ title, description: p.sub, image: SITE_URL + 'share/' + p.image, url })}
  <link rel="canonical" href="${escape(url)}">
  <meta http-equiv="refresh" content="0; url=${escape(target)}">
  <script>location.replace(${JSON.stringify(target)} + location.hash)</script>
</head>
<body style="background:#0c0b12;color:#f4f1ff;font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0">
  <a href="${escape(target)}" style="color:#c2f53b">${escape(title)} ▶</a>
</body>
</html>
`;
    await mkdir(`${dist}/${p.path}`, { recursive: true });
    await writeFile(`${dist}/${p.path}index.html`, html);
  }
  const index = await readFile(`${dist}/index.html`, 'utf8');
  const tags = metaTags({ title: 'Ràdio SPAM', description: 'Una ràdio de ska, punk i batucada que compon cada cançó al teu dispositiu. Cadascú sent les seves.',
    image: SITE_URL + 'share/radio-spam.jpg', url: SITE_URL });
  await writeFile(`${dist}/index.html`, index.replace('<!-- share-meta -->', tags));
}
