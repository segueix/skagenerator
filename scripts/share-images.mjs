// Imatges per als enllaços compartits (WhatsApp, Telegram…): 1200 × 630, una de general de Ràdio SPAM i una per
// cada emissora i estil de batucada, amb els colors i els motius de la ràdio. Es tornen a generar amb:
//   node scripts/share-images.mjs        (fa servir el Chromium de Playwright)
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { SHARE_PAGES } from './share-pages.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// Motiu i colors de cada emissora (els mateixos de les targetes de la ràdio).
const LOOKS = {
  ska: { bg: '#f4f1e8', ink: '#0d0d0d', accent: '#c2f53b', on: '#0d0d0d',
    art: 'conic-gradient(#0d0d0d 25%, transparent 0 50%, #0d0d0d 0 75%, transparent 0) 0 0 / 64px 64px' },
  punk: { bg: '#ff2e88', ink: '#ffffff', accent: '#ffe600', on: '#14030b', shadow: '6px 6px 0 #14030b', tilt: -3,
    art: 'repeating-linear-gradient(-58deg, #ffe600 0 24px, transparent 24px 66px)' },
  mix: { bg: '#ffe600', ink: '#14030b', accent: '#ff2e88', on: '#ffffff',
    art: 'conic-gradient(#14030b 25%, transparent 0 50%, #14030b 0 75%, transparent 0) 0 0 / 60px 60px, linear-gradient(115deg, transparent 55%, #ff2e88 55%)' },
  batucada: { bg: '#12a150', ink: '#ffffff', accent: '#ffd400', on: '#0a3d22', shadow: '5px 5px 0 #0a3d22',
    art: 'radial-gradient(circle, #ffd400 0 14px, transparent 15px 23px, #ffd400 24px 27px, transparent 28px) 0 0 / 72px 72px' }
};
const page = ({ station, kicker, name, sub }) => {
  const look = LOOKS[station], all = !station;
  const big = 168; // s'encongeix fins que el nom cap en una línia
  return `<!doctype html><html><head><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@500;700&display=block');
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#0c0b12;font-family:'DM Sans',sans-serif;color:#f4f1ff;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(70% 90% at 85% 10%, ${all ? '#c2f53b33' : look.accent + '40'}, transparent 70%)}
.card{position:absolute;left:56px;top:150px;width:690px;height:420px;border-radius:44px;overflow:hidden;background:${all ? '#17151f' : look.bg};color:${all ? '#f4f1ff' : look.ink};padding:44px 48px;display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate}
.card .art{position:absolute;inset:0;z-index:-1;background:${all ? 'none' : look.art};-webkit-mask-image:linear-gradient(200deg,#000 14%,transparent 56%);mask-image:linear-gradient(200deg,#000 14%,transparent 56%)}
.kicker{font:700 30px/1 'DM Sans';letter-spacing:.08em;text-transform:uppercase;opacity:.9;margin-bottom:14px}
.name{font:400 ${big}px/.9 'Archivo Black';letter-spacing:-.02em;white-space:nowrap;padding-bottom:6px;align-self:flex-start;max-width:none;${look?.shadow ? `text-shadow:${look.shadow};` : ''}${look?.tilt ? `transform:rotate(${look.tilt}deg);transform-origin:left bottom;` : ''}}
.sub{font:700 26px/1.25 'DM Sans';margin-top:22px;max-width:560px;opacity:.9}
.logo{position:absolute;left:60px;top:52px;display:flex;align-items:center;gap:18px;font:400 52px/1 'Archivo Black';letter-spacing:.02em}
.logo b{font-weight:400;color:${all ? '#c2f53b' : look.accent}}
.bars{display:flex;align-items:flex-end;gap:7px;height:46px}.bars i{width:10px;border-radius:5px;background:${all ? '#c2f53b' : look.accent}}
.bars i:nth-child(1){height:45%}.bars i:nth-child(2){height:100%}.bars i:nth-child(3){height:68%}
.disc{position:absolute;right:-70px;top:120px;width:500px;height:500px;border-radius:50%;
background:repeating-radial-gradient(circle,#15141c 0 3px,#1d1b26 3px 6px);box-shadow:0 30px 80px #000a, inset 0 0 0 6px #000}
.disc::before{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 210deg,#ffffff00,#ffffff1c 8%,#ffffff00 16%,#ffffff00 50%,#ffffff14 58%,#ffffff00 66%)}
.label{position:absolute;left:50%;top:50%;width:190px;height:190px;margin:-95px 0 0 -95px;border-radius:50%;background:${all ? 'conic-gradient(#f4f1e8 0 25%,#ff2e88 0 50%,#ffe600 0 75%,#12a150 0)' : look.bg};display:grid;place-items:center;box-shadow:inset 0 0 0 6px #0003}
.label span{font:400 ${all ? 0 : Math.min(30, Math.floor(210 / Math.max(...name.split(/[ -]/).map(w => w.length))))}px/1 'Archivo Black';color:${all ? 'transparent' : look.ink};transform:translateY(-44px) rotate(-8deg);text-align:center;line-height:.95}
.label::after{content:'';position:absolute;width:22px;height:22px;border-radius:50%;background:#0c0b12}
.play{position:absolute;right:40px;top:40px;width:104px;height:104px;border-radius:50%;background:${all ? '#c2f53b' : look.accent};color:${all ? '#0c0b12' : look.on};display:grid;place-items:center;font-size:46px;padding-left:8px;box-shadow:0 10px 30px #0006}
.stations{display:flex;gap:12px;margin-top:22px}.stations span{font:700 22px/1 'DM Sans';padding:10px 16px;border-radius:99px;color:#0c0b12}
</style></head><body><div class="glow"></div>
<div class="logo"><span class="bars"><i></i><i></i><i></i></span><span>RÀDIO <b>SPAM</b></span></div>
<div class="disc"><div class="label"><span>${all ? '' : name.split(' · ')[0].toUpperCase()}</span></div></div>
<div class="card"><div class="art"></div>
<div class="kicker">${kicker}</div><div class="name">${name}</div>
${all ? `<div class="stations"><span style="background:#f4f1e8">Ska</span><span style="background:#ff2e88;color:#fff">Punk</span><span style="background:#ffe600">Ska-Punk</span><span style="background:#12a150;color:#fff">Batucada</span></div>` : `<div class="sub">${sub}</div>`}
${all ? '' : '<div class="play">▶</div>'}</div>
</body></html>`;
};

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const images = [{ file: 'radio-spam.jpg', kicker: 'Cançons acabades de fer', name: 'Escolta!', station: null },
  ...SHARE_PAGES.map(p => ({ file: p.image, kicker: p.station === 'batucada' && p.path !== 'batucada/' ? 'Escolta · Batucada' : 'Escolta', name: p.label, sub: p.sub, station: p.station }))];
for (const image of images) {
  await tab.setContent(page(image), { waitUntil: 'networkidle' });
  await tab.evaluate(async () => {
    await document.fonts.ready;
    // El nom, en una sola línia: es redueix la lletra fins que hi cap (i deixa lloc a l'ombra).
    const name = document.querySelector('.name'), room = name.parentElement.clientWidth - 96 - 14;
    let size = parseFloat(getComputedStyle(name).fontSize);
    while (name.scrollWidth > room && size > 60) { size -= 4; name.style.fontSize = size + 'px'; }
  });
  const jpg = await tab.screenshot({ type: 'jpeg', quality: 86 });
  await writeFile(new URL(`../share/${image.file}`, import.meta.url), jpg);
  console.log(`share/${image.file}: ${Math.round(jpg.length / 1024)} kB`);
}
await browser.close();
