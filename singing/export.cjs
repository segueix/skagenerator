// Compon cançons amb lletra i n'exporta, per a cadascuna, la banda sense la veu guia (WAV)
// i la partitura de la veu (una nota per síl·laba, amb la paraula i el temps en segons).
// Fa servir l'app mateixa en un Chromium sense pantalla: així la banda sona exactament
// com a la ràdio. Ús: node singing/export.cjs <url de dist> <carpeta de sortida> <quantes> [llavor]
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

// Estils on una veu sintètica funciona: melòdics, sense crits.
const STYLES = ['jamaican', 'rocksteady', 'bossreggae', 'twotone', 'nutty', 'skaswing', 'poppunk'];

(async () => {
  const [url, outDir, countArg, seedArg] = process.argv.slice(2);
  const count = Number(countArg) || 1, seed0 = Number(seedArg) || Date.now() % 1000000;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('[pàgina]', error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.SkaStudio && window.SkaSampleAudio && window.SkaLyrics);
  for (let i = 0; i < count; i++) {
    const subgenre = STYLES[(seed0 + i) % STYLES.length], seed = (seed0 * 7919 + i * 104729) % 4294967291 + 1;
    const started = Date.now();
    const result = await page.evaluate(async ({ subgenre, seed }) => {
      const engine = window.ElTaulerRadioAmbient, builder = window.SkaSongBuilder, studio = window.SkaStudio, utils = window.SkaAudioUtils, RATE = studio.RATE;
      const song = studio.validateSong(builder.createAutoSong(engine, subgenre, { minutes: 2.25 + (seed % 4) * .25, vocal: true, autoLyrics: 'en', seed, vary: true, recent: [], liked: [] }));
      const band = { ...song, clips: song.clips.filter(c => c.instrument !== 'vocal') };
      const parts = [], lengths = [], notes = [];
      let at = 0;
      const segs = studio.segmentsOf(song), bandSegs = studio.segmentsOf(band);
      for (let k = 0; k < segs.length; k++) {
        const seg = segs[k], bpm = seg.section?.bpm ?? song.settings.bpm, beat = 60 / bpm;
        const frames = Math.round(seg.bars * 4 * beat * RATE);
        const spec = engine.composeSongPart(band.settings, studio.partFor(band, bandSegs[k]));
        let data = spec.instruments.length ? await window.SkaSampleAudio.render(spec, RATE)
          : (n => [new Float32Array(n), new Float32Array(n)])(Math.round((spec.seconds + 1.5) * RATE));
        if (seg.section?.fade) data = utils.applyFade(data, Math.min(frames, data[0].length), seg.section.fade);
        parts.push(data); lengths.push(Math.min(frames, data[0].length));
        // Partitura de la veu: les notes de la melodia en ordre, repartides per paraules i síl·labes.
        const text = seg.section?.lyrics?.trim();
        const sung = text && song.clips.some(c => c.instrument === 'vocal' && c.start < seg.start + seg.bars && seg.start < c.start + c.bars);
        if (sung) {
          const vspec = engine.composeSongPart(song.settings, studio.partFor(song, seg));
          const melody = (vspec.lines?.vocal || []).slice().sort((a, b) => a[0] * 4 + a[1] - (b[0] * 4 + b[1]));
          const swing = song.settings.swing || 0, swung = beats => Math.abs(beats % 1 - .5) < .04 ? beats + swing / 6 : beats;
          const words = text.split('\n').map(l => l.trim()).filter(Boolean)
            .flatMap((line, li) => (line.match(/[A-Za-z'’]+/g) || []).map((w, wi) => ({ word: w.replace(/’/g, "'"), line: li, first: wi === 0, count: Math.max(1, engine.englishWord(w).count) })));
          let n = 0;
          for (const w of words) for (let s = 0; s < w.count && n < melody.length; s++, n++) {
            const [bar, b, pitch, dur] = melody[n], start = swung(bar * 4 + b);
            notes.push({ t: at + start * beat, d: dur * beat, midi: pitch, word: w.word.toLowerCase(), syllable: s, syllables: w.count, line: w.line, lineStart: w.first && s === 0, section: seg.section.type });
          }
        }
        at += frames / RATE;
      }
      const mixed = utils.mixSections(parts, lengths);
      const wav = new Uint8Array(utils.encodeWav(mixed, RATE));
      let binary = '';
      for (let i = 0; i < wav.length; i += 0x8000) binary += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
      return { wav: btoa(binary), song, notes, seconds: mixed[0].length / RATE };
    }, { subgenre, seed });
    const id = `${new Date().toISOString().slice(0, 10)}-${subgenre}-${seed}`;
    fs.writeFileSync(path.join(outDir, `${id}.band.wav`), Buffer.from(result.wav, 'base64'));
    fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ id, subgenre, title: result.song.title, seconds: result.seconds, notes: result.notes, song: result.song }));
    console.log(`${id}: «${result.song.title}», ${Math.round(result.seconds)} s, ${result.notes.length} síl·labes, ${Math.round((Date.now() - started) / 1000)} s de càlcul`);
  }
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
