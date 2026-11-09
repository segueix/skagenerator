import { mkdir, copyFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
import { prepareSoundBank } from './prepare-soundbank.mjs';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'radioambient.js', 'sample-audio.js', 'audio-utils.js']) await copyFile(file, `dist/${file}`);
await cp('licenses', 'dist/licenses', { recursive: true });
await build({ entryPoints: ['audio/worker.mjs'], bundle: true, outfile: 'dist/sample-worker.js',
  format: 'iife', platform: 'browser', target: 'es2022', minify: true, legalComments: 'external' });
await prepareSoundBank();
console.log('Web i instruments preparats a dist/');
