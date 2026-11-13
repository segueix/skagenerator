import { createHash } from 'node:crypto';
import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { prepareSoundBank } from './prepare-soundbank.mjs';
await mkdir('dist', { recursive: true });
for (const file of ['veu.html', 'veu.js', 'index.html', 'styles.css', 'app.js', 'radioambient.js', 'sample-audio.js', 'audio-utils.js', 'lyrics-ca.js', 'lyrics.js', 'song-builder.js', 'radio.js', 'radio.css', 'browser-singing.js', 'browser-singing-worker.js']) await copyFile(file, `dist/${file}`);
await cp('licenses', 'dist/licenses', { recursive: true });
await cp('exemples', 'dist/exemples', { recursive: true });
await build({ entryPoints: ['audio/worker.mjs'], bundle: true, outfile: 'dist/sample-worker.js',
  format: 'iife', platform: 'browser', target: 'es2022', minify: true, legalComments: 'external' });
await prepareSoundBank();
console.log('Web i instruments preparats a dist/');

// Els fitxers d'una nova publicació no han de barrejar-se amb motors en memòria cau.
const hash = async file => createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex').slice(0, 16);
let client = await readFile('dist/sample-audio.js', 'utf8');
client = client.replace(/sample-worker\.js\?v=[^']+/, `sample-worker.js?v=${await hash('sample-worker.js')}`);
client = client.replace(/generaluser-ska-punk\.sf2\?v=[^']+/, `generaluser-ska-punk.sf2?v=${await hash('assets/generaluser-ska-punk.sf2')}`);
client = client.replace(/extra-instruments\.sf2\?v=[^']+/, `extra-instruments.sf2?v=${await hash('assets/extra-instruments.sf2')}`);
await writeFile('dist/sample-audio.js', client);
// El worker de cant carrega el motor i les utilitats amb la seva versió, i la versió del worker en depèn:
// així un canvi del motor no es queda a mitges amb un worker antic a la memòria cau.
let singWorker = await readFile('dist/browser-singing-worker.js', 'utf8');
for (const file of ['audio-utils.js', 'browser-singing.js']) singWorker = singWorker.replace(`'${file}'`, `'${file}?v=${await hash(file)}'`);
await writeFile('dist/browser-singing-worker.js', singWorker);
let singer = await readFile('dist/browser-singing.js', 'utf8');
singer = singer.replaceAll('browser-singing-worker.js', `browser-singing-worker.js?v=${await hash('browser-singing-worker.js')}`);
await writeFile('dist/browser-singing.js', singer);
let html = await readFile('dist/index.html', 'utf8');
for (const file of ['styles.css', 'app.js', 'radioambient.js', 'sample-audio.js', 'audio-utils.js', 'lyrics-ca.js', 'lyrics.js', 'song-builder.js', 'radio.js', 'radio.css', 'browser-singing.js'])
  html = html.replaceAll(`"${file}"`, `"${file}?v=${await hash(file)}` + '"');
await writeFile('dist/index.html', html);
