import { createHash } from 'node:crypto';
import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { prepareSoundBank } from './prepare-soundbank.mjs';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'radioambient.js', 'sample-audio.js', 'audio-utils.js']) await copyFile(file, `dist/${file}`);
await cp('licenses', 'dist/licenses', { recursive: true });
await build({ entryPoints: ['audio/worker.mjs'], bundle: true, outfile: 'dist/sample-worker.js',
  format: 'iife', platform: 'browser', target: 'es2022', minify: true, legalComments: 'external' });
await prepareSoundBank();
console.log('Web i instruments preparats a dist/');

// Els fitxers d'una nova publicació no han de barrejar-se amb motors en memòria cau.
const hash = async file => createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex').slice(0, 16);
let client = await readFile('dist/sample-audio.js', 'utf8');
client = client.replace(/sample-worker\.js\?v=[^']+/, `sample-worker.js?v=${await hash('sample-worker.js')}`);
client = client.replace(/generaluser-ska-punk\.sf2\?v=[^']+/, `generaluser-ska-punk.sf2?v=${await hash('assets/generaluser-ska-punk.sf2')}`);
await writeFile('dist/sample-audio.js', client);
let html = await readFile('dist/index.html', 'utf8');
for (const file of ['styles.css', 'app.js', 'radioambient.js', 'sample-audio.js', 'audio-utils.js'])
  html = html.replaceAll(`"${file}"`, `"${file}?v=${await hash(file)}` + '"');
await writeFile('dist/index.html', html);
