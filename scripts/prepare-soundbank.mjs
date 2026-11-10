import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SoundBankLoader, SpessaLog } from 'spessasynth_core';
import source from '../soundbank-source.json' with { type: 'json' };

export async function prepareSoundBank() {
  await mkdir('.cache', { recursive: true });
  await mkdir('dist/assets', { recursive: true });
  let raw;
  try { raw = await readFile('.cache/GeneralUser-GS.sf2'); } catch { /* Download below. */ }
  const valid = data => data && createHash('sha256').update(data).digest('hex') === source.sha256;
  if (!valid(raw)) {
    console.log('Descarregant GeneralUser GS des de la versió fixada…');
    const response = await fetch(source.url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`No s’ha pogut obtenir el banc: HTTP ${response.status}`);
    raw = Buffer.from(await response.arrayBuffer());
    if (!valid(raw)) throw new Error('La verificació SHA-256 del banc ha fallat');
    await writeFile('.cache/GeneralUser-GS.sf2', raw);
  }
  SpessaLog.setLogLevel(false, false, false);
  const bank = SoundBankLoader.fromArrayBuffer(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  for (const preset of [...bank.presets]) {
    // Variacions GS (banc 1): trompeta i trombó alternatius.
    const variation = !preset.isGMGSDrum && preset.bankLSB === 0
      && (source.variations || []).some(([msb, program]) => msb === preset.bankMSB && program === preset.program);
    const keep = variation || preset.bankMSB === 0 && preset.bankLSB === 0
      && (preset.isGMGSDrum ? source.drumPrograms : source.programs).includes(preset.program);
    if (!keep) bank.deletePreset(preset);
  }
  bank.removeUnusedElements();
  const subset = bank.writeSF2();
  if (subset.byteLength >= 24 * 1024 * 1024) throw new Error('El banc reduït supera el límit dels recursos estàtics');
  await writeFile('dist/assets/generaluser-ska-punk.sf2', new Uint8Array(subset));
  const info = { name: source.name, version: source.version, bytes: subset.byteLength,
    sha256: createHash('sha256').update(new Uint8Array(subset)).digest('hex'),
    sourceCommit: source.commit, presets: bank.presets.map(({ name, program, isGMGSDrum }) => ({ name, program, drums: isGMGSDrum })) };
  await writeFile('dist/assets/soundbank.json', JSON.stringify(info, null, 2));
  console.log(`Mostres preparades: ${(subset.byteLength / 1024 / 1024).toFixed(1)} MB, ${bank.presets.length} instruments i kits.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await prepareSoundBank();
