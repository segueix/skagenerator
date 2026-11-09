import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'radioambient.js']) await copyFile(file, `dist/${file}`);
console.log('Web preparada a dist/');
