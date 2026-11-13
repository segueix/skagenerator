// Compon cançons amb lletra i n'exporta, per a cadascuna, la banda sense la veu guia (WAV)
// i la partitura de la veu (una nota per síl·laba, amb la paraula i el temps en segons).
// Fa servir l'app mateixa en un Chromium sense pantalla: així la banda sona exactament
// com a la ràdio. Ús: node singing/export.cjs <url de dist> <carpeta de sortida> <quantes> [llavor]
// o, per tornar a fer una cançó concreta: node singing/export.cjs <url> <carpeta> --song <fitxer.json amb «song»>
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

// Estils on una veu sintètica funciona: melòdics, sense crits.
const STYLES = ['jamaican', 'rocksteady', 'bossreggae', 'twotone', 'nutty', 'skaswing', 'poppunk'];
// Amb EXPORT_STYLES=ska,punk les cançons alternen un subgènere d'ska i un de punk (els que canta bé la veu).
const SKA = ['jamaican', 'rocksteady', 'twotone', 'nutty', 'bossreggae', 'skaswing', 'skapunk'];
const PUNK = ['punk77', 'oi', 'skatepunk', 'garage', 'postpunk', 'hardcore', 'poppunk', 'horrorpunk'];
// Llengua de la lletra automàtica: EXPORT_LANG=ca (per defecte) o en (la veu TIGER canta en anglès).
const LANG = process.env.EXPORT_LANG || 'ca';

(async () => {
  const [url, outDir, countArg, seedArg] = process.argv.slice(2);
  const fixed = countArg === '--song' ? JSON.parse(fs.readFileSync(seedArg, 'utf8')) : null;
  // Lletra pròpia: node singing/export.cjs <url> <carpeta> --lyrics <fitxer.txt> <subgènere> [llavor]
  const own = countArg === '--lyrics' ? { text: fs.readFileSync(seedArg, 'utf8'), subgenre: process.argv[6], seed: Number(process.argv[7]) || 1, name: path.basename(seedArg).replace(/\.[^.]+$/, '') } : null;
  const count = fixed ? 1 : Number(countArg) || 1, seed0 = fixed ? 0 : Number(seedArg) || Date.now() % 1000000;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('[pàgina]', error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.SkaStudio && window.SkaSampleAudio && window.SkaLyrics);
  for (let i = 0; i < count; i++) {
    const mixed = process.env.EXPORT_STYLES === 'ska,punk' ? (i % 2 ? PUNK : SKA) : STYLES;
    // En la generació programada, un ska i un punk cada dia; el subgènere rota
    // sistemàticament per acabar cobrint els 15 estils, no sempre els mateixos.
    const selection = process.env.EXPORT_ROTATE === 'daily'
      ? (Math.floor(Date.now() / 86400000) + Math.floor(i / 2)) % mixed.length
      : (seed0 + Math.floor(i / 2)) % mixed.length;
    const subgenre = fixed ? fixed.song.settings.subgenre : own ? own.subgenre : mixed[selection];
    const seed = fixed ? fixed.song.settings.seed : own ? own.seed : (seed0 * 7919 + i * 104729) % 4294967291 + 1;
    const started = Date.now();
    const result = await page.evaluate(async ({ subgenre, seed, fixedSong, ownText, lang }) => {
      const engine = window.ElTaulerRadioAmbient, builder = window.SkaSongBuilder, studio = window.SkaStudio, utils = window.SkaAudioUtils, RATE = studio.RATE;
      // Lletra pròpia (en català): la cançó es fa a la mida dels versos, com al taller.
      const sheet = ownText ? builder.parseLyricsSheet(ownText).map(({ type, text }) => ({ type, text })) : null;
      const song = fixedSong ? studio.validateSong(fixedSong) : studio.validateSong(builder.createAutoSong(engine, subgenre,
        { minutes: 2.25 + (seed % 4) * .25, vocal: true, ...(sheet ? { lyrics: sheet } : { autoLyrics: lang }), seed, vary: true, recent: [], liked: [] }));
      const english = song.settings.lang === 'en', counter = english ? engine.englishWord : engine.catalanWord;
      // La banda sense la veu guia i amb el baix 3 dB més fluix: així no tapa la veu cantada.
      const bv = song.settings.baseVolume || {};
      const band = { ...song, settings: { ...song.settings, baseVolume: { drums: bv.drums || 0, bass: Math.max(-24, (bv.bass || 0) - 3) } },
        clips: song.clips.filter(c => c.instrument !== 'vocal') };
      const parts = [], lengths = [], notes = [], lines = [];
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
            // Les mateixes síl·labes que compta la melodia (amb sinalefes: «que arribi» és una sola unitat de tres notes).
            .flatMap((line, li) => engine.lyricWords(line, english ? 'en' : 'ca')
              .map((w, wi) => ({ word: w.word.replace(/’/g, "'"), line: li, first: wi === 0, count: Math.max(1, w.count) })));
          const lineTexts = text.split('\n').map(l => l.trim()).filter(Boolean);
          let n = 0;
          for (const w of words) for (let s = 0; s < w.count && n < melody.length; s++, n++) {
            const [bar, b, pitch, dur] = melody[n], start = swung(bar * 4 + b);
            if (w.first && s === 0) lines.push({ at: Math.round((at + start * beat) * 100) / 100, text: lineTexts[w.line] });
            notes.push({ t: at + start * beat, d: dur * beat, midi: pitch, word: w.word.toLowerCase(), syllable: s, syllables: w.count, line: w.line, lineStart: w.first && s === 0, section: seg.section.type });
          }
        }
        at += frames / RATE;
      }
      const mixed = utils.mixSections(parts, lengths);
      const wav = new Uint8Array(utils.encodeWav(mixed, RATE));
      let binary = '';
      for (let i = 0; i < wav.length; i += 0x8000) binary += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
      return { wav: btoa(binary), song, notes, lines, seconds: mixed[0].length / RATE };
    }, { subgenre, seed, fixedSong: fixed?.song || null, ownText: own?.text || null, lang: LANG });
    const id = fixed?.id || (own ? `${own.name}-${subgenre}` : `${new Date().toISOString().slice(0, 10)}-${subgenre}-${seed}`);
    fs.writeFileSync(path.join(outDir, `${id}.band.wav`), Buffer.from(result.wav, 'base64'));
    fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ id, subgenre, lang: result.song.settings.lang || 'ca', title: result.song.title, seconds: result.seconds, notes: result.notes, song: result.song }));
    // Fitxa per a la ràdio: el que cal per mostrar-la, votar-la i seguir la lletra.
    fs.writeFileSync(path.join(outDir, `${id}.meta.json`), JSON.stringify({ id, file: `${id}.mp3`, subgenre, style: result.song.settings.style,
      title: result.song.title, seconds: Math.round(result.seconds * 10) / 10, created: new Date().toISOString(), lines: result.lines, song: result.song }));
    console.log(`${id}: «${result.song.title}», ${Math.round(result.seconds)} s, ${result.notes.length} síl·labes, ${Math.round((Date.now() - started) / 1000)} s de càlcul`);
  }
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
