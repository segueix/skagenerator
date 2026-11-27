(() => {
  'use strict';
  // VaTuCalla! — visualitzador a pantalla completa per a la batucada (per fer videoclips).
  // Reprodueix la cançó ja gravada (WAV de la ràdio), dibuixa formes que canvien amb el so i
  // mostra els instruments que sonen a cada moment (a partir de la partitura de cada cop).
  // El vídeo s'exporta des del mateix llenç: imatge del llenç + àudio original, sincronitzats.
  // Dissenys: cada un és una funció que dibuixa un fotograma; se n'hi poden afegir més a DESIGNS.
  const PROJECT = 'VaTuCalla!';
  const FORMATS = { landscape: [1920, 1080, 'Horitzontal 16:9'], portrait: [1080, 1920, 'Vertical 9:16'], square: [1080, 1080, 'Quadrat 1:1'] };
  // Qualitat (compressió) del vídeo: resolució (escala del format) i bits per segon de vídeo i d'àudio.
  // A 10 Mb/s una Short d'un minut i mig feia més de 100 MB; per enviar-la per WhatsApp, «WhatsApp» o «Mínima».
  const QUALITIES = {
    alta: { name: 'Alta', scale: 1, video: 10_000_000, audio: 256_000 },
    mitjana: { name: 'Mitjana', scale: 1, video: 3_000_000, audio: 160_000 },
    whatsapp: { name: 'WhatsApp', scale: 2 / 3, video: 1_200_000, audio: 128_000 },
    minima: { name: 'Mínima', scale: 4 / 9, video: 550_000, audio: 96_000 }
  };
  // Mida aproximada (MB) de cada minut de vídeo.
  const mbPerMinute = q => (q.video + q.audio) / 8 * 60 / 1e6;
  const FONT = '"Archivo Black", "Manrope", system-ui, sans-serif';
  // Color de cada instrument (to HSL), en l'ordre de la graella de la batucada.
  const hueOf = row => (row * 137.5 + 20) % 360;

  // ── La colla: dibuixos de retalls de paper ────────────────────────────
  // Una colla de batucada d'homes d'entre 40 i 55 anys (cabells foscos o amb canes a les temples, entrades,
  // bigotis, barbes curtes i alguns amb ulleres), en formació: els surdos i el bombo al darrere; la caixa, el
  // repique, el tabal i el tamborim al mig; l'agogô, el xocalho i la cuíca al davant, i el mestre al capdavant,
  // amb el xiulet a la boca i el seu repique. Cadascú toca el seu instrument quan sona i en surt una bafarada
  // amb el so (BUM!, TÁ!, FIUUU!…). Samarretes de colors, a la plaça.
  const INK = '#2a1d2e';
  const SKIN = ['#f6d5b8', '#f1c9a5', '#fadcc4', '#efc19c', '#f8d9bf', '#f3cdb0', '#f5d0ad', '#fbe0cb', '#eec4a2', '#f7d6bb', '#f2cbaa', '#f9dcc6'];
  const HAIR = ['#2b1d14', '#3b2a1e', '#1a1a1a', '#5a3d28', '#4a4038', '#2b1d14', '#6b4a2f', '#1a1a1a', '#3b2a1e', '#5f5650', '#2b1d14', '#4a3326'];
  // Trets de cada músic (fila de la graella): pentinat, pèl a la cara, ulleres i canes.
  const LOOKS = [
    { hair: 'curt', face: 'bigoti', glasses: 'rodones', grey: true }, { hair: 'entrades', face: 'barba' }, { hair: 'arrissat', face: 'res' },
    { hair: 'ratlla', face: 'perilla', glasses: 'quadrades' }, { hair: 'curt', face: 'tres-dies' }, { hair: 'entrades', face: 'bigoti', glasses: 'quadrades', grey: true },
    { hair: 'cua', face: 'barba' }, { hair: 'calb', face: 'perilla', glasses: 'rodones' }, { hair: 'ratlla', face: 'res' },
    { hair: 'curt', face: 'bigoti', glasses: 'quadrades', grey: true }, { hair: 'arrissat', face: 'tres-dies', glasses: 'rodones' }, { hair: 'entrades', face: 'barba', grey: true }
  ];
  const WORDS = ['BUM!', 'BOM!', 'DUM!', 'TÁ!', 'TRRÁ!', 'TIC!', 'DLING!', 'XIC-XIC!', 'UÍ-UÍ!', 'FIUUU!', 'PAM!', 'BOOM!'];
  const SECTION = row => row <= 2 || row === 11 ? 0 : [3, 4, 10].includes(row) ? 1 : row === 9 ? 3 : 2;
  const VARIANTS = {
    colors: { head: 1, body: 1,
      shirt: row => ['#e63946', '#2a9d8f', '#264653', '#f4a261', '#6a4c93', '#1d3557', '#ff7f11', '#06a77d', '#b5179e', '#3a86ff', '#8338ec', '#d62828'][row],
      trousers: () => '#3d3a4b', hat: row => row === 2 ? 'gorra' : row === 8 ? 'barret' : null }
  };

  function collaBackground(ctx, w, h, f, st, s, ground) {
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#7cc6ff'); sky.addColorStop(1, '#ffe7b0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let i = 0, x = -s * .05; x < w; i++) {
      const bw = s * (.2 + (i * 37 % 10) / 50), bh = s * (.2 + (i * 53 % 10) / 40);
      ctx.fillStyle = ['#f4a261', '#e9c46a', '#e76f51', '#f6bd60', '#d4a373'][i % 5]; ctx.fillRect(x, ground - bh, bw, bh + 2);
      ctx.fillStyle = 'rgba(40, 30, 60, .25)';
      for (let wx = x + bw * .18; wx < x + bw * .8; wx += bw * .32) for (let wy = ground - bh + bh * .15; wy < ground - bh * .3; wy += bh * .3) ctx.fillRect(wx, wy, bw * .16, bh * .14);
      x += bw;
    }
    ctx.strokeStyle = '#5b4636'; ctx.lineWidth = s * .003; ctx.beginPath(); ctx.moveTo(0, h * .2);
    ctx.quadraticCurveTo(w / 2, h * .28 + f.bass * s * .03, w, h * .2); ctx.stroke();
    for (let k = 0; k < 18; k++) {
      const x = (k + .5) / 18 * w, tt = (k + .5) / 18, y = h * .2 + (h * .08 + f.bass * s * .03) * 2 * tt * (1 - tt);
      ctx.fillStyle = ['#e63946', '#ffd23f', '#06d6a0', '#118ab2', '#ff7f11'][k % 5];
      ctx.beginPath(); ctx.moveTo(x - s * .018, y); ctx.lineTo(x + s * .018, y); ctx.lineTo(x + Math.sin(st.sway + k) * s * .004, y + s * .04); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#c9b18a'; ctx.fillRect(0, ground, w, h - ground);
    ctx.fillStyle = 'rgba(120, 90, 60, .18)';
    for (let y = ground + s * .03; y < h; y += s * .05) ctx.fillRect(0, y, w, s * .004);
  }

  // Un músic dret, amb els peus a (0, 0) i mida u; e = força del cop (1 just quan pica).
  function drawMusician(ctx, u, row, e, f, st, V) {
    const L = LOOKS[row], skin = SKIN[row], hair = HAIR[row], B = V.body;
    const legs = u * .7 * B, top = -(legs + u * 1.8 * B), belly = -legs - u * .55 * B, chest = top + u * .55, shoulderY = top + u * .25;
    const shirt = V.shirt(row);
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = u * .09;
    // Cames, sabates i cos (la samarreta).
    ctx.fillStyle = V.trousers(row); ctx.fillRect(-u * .55, -legs, u * .45, legs - u * .05); ctx.fillRect(u * .1, -legs, u * .45, legs - u * .05);
    ctx.fillStyle = '#20151c'; ctx.beginPath(); ctx.ellipse(-u * .38, -u * .05, u * .38, u * .14, 0, 0, Math.PI * 2); ctx.ellipse(u * .38, -u * .05, u * .38, u * .14, 0, 0, Math.PI * 2); ctx.fill();
    const torso = () => { ctx.beginPath(); ctx.moveTo(-u * .9, top); ctx.lineTo(u * .9, top); ctx.quadraticCurveTo(u * 1.25, (top - legs) / 2, u * .95, -legs); ctx.lineTo(-u * .95, -legs); ctx.quadraticCurveTo(-u * 1.25, (top - legs) / 2, -u * .9, top); ctx.closePath(); };
    ctx.fillStyle = shirt; torso(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = u * .09; torso(); ctx.stroke();
    // Coll en V.
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-u * .28, top); ctx.lineTo(0, top + u * .3); ctx.lineTo(u * .28, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Braços, baquetes i tambors.
    const arm = (sx, hx, hy) => { ctx.strokeStyle = shirt; ctx.lineWidth = u * .34; ctx.beginPath(); ctx.moveTo(sx, shoulderY); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = u * .07; ctx.beginPath(); ctx.arc(hx, hy, u * .2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    const stick = (hx, hy, a, len = u * .9, color = '#e9d8a6') => { ctx.strokeStyle = color; ctx.lineWidth = u * .1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * len, hy + Math.sin(a) * len); ctx.stroke(); };
    const drum = (dy, rw, rh, color, rim = '#d8d8e0') => {
      ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = u * .08;
      ctx.beginPath(); ctx.rect(-rw, dy, rw * 2, rh); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, dy + rh, rw, rw * .25, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rim; ctx.lineWidth = u * .05; ctx.beginPath();
      for (let z = 0; z <= 6; z++) ctx.lineTo(-rw + z * rw / 3, dy + (z % 2 ? rh * .85 : rh * .15)); ctx.stroke();
      ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = INK; ctx.lineWidth = u * .08; ctx.beginPath(); ctx.ellipse(0, dy, rw, rw * .25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Corretja a l'espatlla.
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = u * .1; ctx.beginPath(); ctx.moveTo(-rw * .7, dy); ctx.lineTo(-u * .55, top + u * .05); ctx.stroke();
    };
    const lift = (1 - e) * u * .7 + Math.sin(st.sway * 2 + row) * u * .05;
    if (row <= 2 || row === 11) {
      // Surdos i bombo: tambor gran a la panxa i maceta.
      const dy = belly - u * .55;
      drum(dy, u * 1.05, u * 1.1, ['#c0c0c8', '#a8a8b8', '#9090a0', '#8b3a3a'][Math.min(row, 3)]);
      arm(-u * .8, -u * .85, dy + u * .1);
      const hx = u * .55, hy = dy - u * .3 - lift, a = Math.PI * .75 - (1 - e) * .5;
      arm(u * .8, hx, hy); stick(hx, hy, a, u * .8);
      ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = INK; ctx.lineWidth = u * .07; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * u * .8, hy + Math.sin(a) * u * .8, u * .17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (row === 3 || row === 4 || row === 10 || row === 9) {
      // Caixa, repique, tabal i el repique del mestre: tambor petit i dues baquetes que piquen alternant.
      const dy = belly - u * .25, l = (1 - e) * u * .55, alt = Math.sin(f.t * 18) > 0 && e > .3;
      drum(dy, u * .8, u * .55, { 3: '#d9d9e0', 4: '#f0c419', 10: '#a0522d', 9: '#d4af37' }[row]);
      if (row === 9) {
        // El mestre: amb una mà toca; amb l'altra, quan xiula, aixeca la baqueta per marcar l'entrada.
        arm(-u * .8, -u * .5, dy - u * .3 - l * .5); stick(-u * .5, dy - u * .3 - l * .5, Math.PI * .15, u * .75);
        const up = e > .05, hx = up ? u * 1.15 : u * .5, hy = up ? top - u * 1.2 - e * u * .3 : dy - u * .3;
        arm(u * .8, hx, hy); stick(hx, hy, up ? -Math.PI * .4 : Math.PI * .85, u * .75);
      } else {
        arm(-u * .8, -u * .5, dy - u * .3 - (alt ? 0 : l)); arm(u * .8, u * .5, dy - u * .3 - (alt ? l : 0));
        stick(-u * .5, dy - u * .3 - (alt ? 0 : l), Math.PI * .15, u * .75); stick(u * .5, dy - u * .3 - (alt ? l : 0), Math.PI * .85, u * .75);
      }
    } else if (row === 5) {
      // Tamborim: a la mà esquerra, davant del pit, i la baqueta a la dreta (es gira una mica quan pica).
      const cx = -u * .55, cy = chest + u * .1;
      arm(-u * .8, cx - u * .1, cy + u * .25);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .85 + e * .1);
      ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = INK; ctx.lineWidth = u * .08; ctx.beginPath(); ctx.arc(0, 0, u * .48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#222'; ctx.lineWidth = u * .12; ctx.beginPath(); ctx.arc(0, 0, u * .48, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const hx = u * .6, hy = chest - lift * .6; arm(u * .8, hx, hy); stick(hx, hy, Math.PI * 1.05 + e * .45, u * .95, '#222');
    } else if (row === 6) {
      // Agogô: les dues campanes de costat davant del pit i la baqueta de fusta.
      arm(-u * .8, -u * .75, chest + u * .35);
      ctx.fillStyle = '#e8c547'; ctx.strokeStyle = INK; ctx.lineWidth = u * .07;
      ctx.beginPath(); ctx.moveTo(-u * .75, chest + u * .35); ctx.quadraticCurveTo(-u * .4, chest + u * .7, -u * .1, chest + u * .4); ctx.stroke();
      for (const [cx, r] of [[-u * .5, u * .32], [u * .05, u * .25]]) {
        ctx.save(); ctx.translate(cx, chest); ctx.rotate(-.5);
        ctx.beginPath(); ctx.moveTo(-r * .45, -r * 1.2); ctx.lineTo(r * .45, -r * 1.2); ctx.lineTo(r, r * .6); ctx.lineTo(-r, r * .6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      const hx = u * .75, hy = chest - u * .1 - lift * .5; arm(u * .8, hx, hy); stick(hx, hy, Math.PI * 1.05 + e * .3, u * 1.05, '#6b4f2a');
    } else if (row === 7) {
      // Xocalho: el marc de platerets davant del pit, que es remena a dreta i esquerra.
      const dx = Math.sin(f.t * 30) * e * u * .25, y = chest + u * .15;
      arm(-u * .8, -u * .95 + dx, y + u * .17); arm(u * .8, u * .95 + dx, y + u * .17);
      ctx.fillStyle = '#b08968'; ctx.strokeStyle = INK; ctx.lineWidth = u * .07; ctx.beginPath(); ctx.roundRect(-u * 1.1 + dx, y, u * 2.2, u * .36, u * .1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; for (let j = -3; j <= 3; j++) { ctx.beginPath(); ctx.ellipse(j * u * .28 + dx, y + u * .18, u * .1, u * .13, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = u * .03; ctx.stroke(); }
    } else {
      // Cuíca: el tambor estirat, de costat sota el braç; la mà de dins frega la canya i la de fora prem la pell.
      const y = belly - u * .45, rub = Math.sin(f.t * 22) * e * u * .25;
      ctx.fillStyle = '#c0c0c8'; ctx.strokeStyle = INK; ctx.lineWidth = u * .08;
      ctx.beginPath(); ctx.rect(-u * 1.2, y - u * .45, u * 1.5, u * .9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7d7d8a'; ctx.lineWidth = u * .05; for (const k of [-.2, .15]) { ctx.beginPath(); ctx.moveTo(-u * 1.2, y + k * u * 2); ctx.lineTo(u * .3, y + k * u * 2); ctx.stroke(); }
      ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = INK; ctx.lineWidth = u * .08; ctx.beginPath(); ctx.ellipse(u * .3, y, u * .2, u * .45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-u * 1.2, y, u * .2, u * .45, 0, 0, Math.PI * 2); ctx.fillStyle = '#c0c0c8'; ctx.fill(); ctx.stroke();
      arm(-u * .8, -u * .7 + rub, y - u * .1); arm(u * .8, u * .42, y - u * .15);
    }
    // Cap, orelles i pentinat.
    const hr = u * 1.05 * V.head, hy = top - hr * .82;
    const head = () => { ctx.beginPath(); ctx.ellipse(0, hy, hr, hr * .95, 0, 0, Math.PI * 2); };
    ctx.fillStyle = skin; ctx.strokeStyle = INK; ctx.lineWidth = u * .08;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * hr, hy + hr * .05, hr * .2, hr * .28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    head(); ctx.fill();
    const grey = L.grey ? '#9c9a98' : hair;
    ctx.save(); head(); ctx.clip();
    ctx.fillStyle = hair;
    if (L.hair === 'calb') { ctx.fillRect(-hr * 1.1, hy - hr * .35, hr * .32, hr * .45); ctx.fillRect(hr * .78, hy - hr * .35, hr * .32, hr * .45); }
    else {
      ctx.beginPath(); ctx.ellipse(0, hy - hr * .8, hr * 1.1, hr * .5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-hr * 1.1, hy - hr * .6, hr * .26, hr * .62); ctx.fillRect(hr * .84, hy - hr * .6, hr * .26, hr * .62);
      if (L.hair === 'entrades') { ctx.fillStyle = skin; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * hr * .42, hy - hr * .5, hr * .28, hr * .26, 0, 0, Math.PI * 2); ctx.fill(); } }
      if (L.hair === 'ratlla') { ctx.strokeStyle = skin; ctx.lineWidth = u * .05; ctx.beginPath(); ctx.moveTo(-hr * .35, hy - hr); ctx.lineTo(-hr * .3, hy - hr * .55); ctx.stroke(); }
    }
    // Canes a les temples.
    if (L.grey) { ctx.fillStyle = grey; ctx.fillRect(-hr * 1.1, hy - hr * .45, hr * .3, hr * .5); ctx.fillRect(hr * .8, hy - hr * .45, hr * .3, hr * .5); }
    // Pèl a la cara: barba curta, perilla o barba de tres dies.
    ctx.fillStyle = L.grey ? '#77716c' : hair;
    if (L.face === 'barba') { ctx.beginPath(); ctx.ellipse(0, hy + hr * .7, hr * .95, hr * .5, 0, 0, Math.PI * 2); ctx.fill(); }
    if (L.face === 'tres-dies') { ctx.globalAlpha = .28; ctx.beginPath(); ctx.ellipse(0, hy + hr * .65, hr * .95, hr * .5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    if (L.hair === 'arrissat') { ctx.fillStyle = hair; for (let k = 0; k < 9; k++) { const a = Math.PI * (1.1 + k * .1); ctx.beginPath(); ctx.arc(Math.cos(a) * hr * .92, hy + Math.sin(a) * hr * .88, hr * .2, 0, Math.PI * 2); ctx.fill(); } }
    if (L.hair === 'cua') { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(-hr * 1.05, hy + hr * .1, hr * .16, hr * .35, .4, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = u * .08; head(); ctx.stroke();
    // Barret: gorra o barret de palla.
    const hat = V.hat(row);
    if (hat === 'gorra') { ctx.fillStyle = '#4a5d23'; ctx.beginPath(); ctx.ellipse(0, hy - hr * .5, hr * .98, hr * .5, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(-hr * .1, hy - hr * .58, hr * 1.25, hr * .14, hr * .07); ctx.fill(); ctx.stroke(); }
    else if (hat === 'barret') { ctx.fillStyle = '#f2e8cf'; ctx.beginPath(); ctx.ellipse(0, hy - hr * .6, hr * 1.25, hr * .18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(-hr * .6, hy - hr * 1.15, hr * 1.2, hr * .55, hr * .15); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.fillRect(-hr * .6, hy - hr * .75, hr * 1.2, hr * .12); }
    // Ulls (es tanquen quan pica fort), celles fosques, nas, ulleres i bigoti o perilla.
    for (const sx of [-1, 1]) {
      const ex = sx * hr * .34, ey = hy - hr * .02;
      if (e > .6 && row !== 9) { ctx.strokeStyle = INK; ctx.lineWidth = u * .08; ctx.beginPath(); ctx.moveTo(ex - hr * .13, ey); ctx.lineTo(ex + hr * .13, ey); ctx.stroke(); }
      else { ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = u * .05; ctx.beginPath(); ctx.ellipse(ex, ey, hr * .16, hr * .19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + sx * hr * .03, ey + hr * .03, hr * .07, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = L.grey ? '#5a5552' : hair; ctx.lineWidth = u * .11; ctx.beginPath(); ctx.moveTo(ex - sx * hr * .16, ey - hr * .3 - e * hr * .06); ctx.lineTo(ex + sx * hr * .18, ey - hr * .33 - e * hr * .06); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = u * .07;
      if (L.glasses === 'rodones') { ctx.beginPath(); ctx.arc(ex, ey, hr * .27, 0, Math.PI * 2); ctx.stroke(); }
      if (L.glasses === 'quadrades') { ctx.beginPath(); ctx.roundRect(ex - hr * .29, ey - hr * .22, hr * .58, hr * .44, hr * .08); ctx.stroke(); }
    }
    if (L.glasses) { ctx.beginPath(); ctx.moveTo(-hr * .08, hy - hr * .04); ctx.lineTo(hr * .08, hy - hr * .04); ctx.stroke(); }
    ctx.fillStyle = 'rgba(150, 70, 50, .35)'; ctx.beginPath(); ctx.ellipse(0, hy + hr * .2, hr * .13, hr * .1, 0, 0, Math.PI * 2); ctx.fill();
    const blowing = row === 9 && e > .05, my = hy + hr * .48;
    if (row !== 9) {
      ctx.strokeStyle = INK; ctx.lineWidth = u * .07; ctx.beginPath();
      if (e > .3) ctx.ellipse(0, my, hr * .14, hr * .11 * (1 + e), 0, 0, Math.PI * 2); else ctx.arc(0, my - hr * .08, hr * .2, Math.PI * .2, Math.PI * .8);
      ctx.stroke();
    }
    if (L.face === 'bigoti') { ctx.fillStyle = L.grey ? '#77716c' : hair; ctx.beginPath(); ctx.ellipse(-hr * .17, hy + hr * .35, hr * .22, hr * .09, -.2, 0, Math.PI * 2); ctx.ellipse(hr * .17, hy + hr * .35, hr * .22, hr * .09, .2, 0, Math.PI * 2); ctx.fill(); }
    if (L.face === 'perilla') { ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-hr * .2, hy + hr * .68); ctx.lineTo(hr * .2, hy + hr * .68); ctx.lineTo(0, hy + hr * .98); ctx.closePath(); ctx.fill(); }
    if (row === 9) {
      // El xiulet de samba (apito): broquet a la boca, cambra rodona amb l'escletxa a dalt i l'anella del cordó.
      // Quan xiula, les galtes s'inflen i en surten ratlles de so.
      if (blowing) { ctx.fillStyle = 'rgba(230, 110, 110, .45)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * hr * .45, hy + hr * .38, hr * (.17 + e * .08), 0, Math.PI * 2); ctx.fill(); } }
      ctx.save(); ctx.translate(0, my); ctx.scale(1.45, 1.45); ctx.translate(0, -my);
      const wx = hr * .02, wy = my, metal = ctx.createLinearGradient(0, wy - hr * .25, 0, wy + hr * .25);
      metal.addColorStop(0, '#f5f5f7'); metal.addColorStop(.5, '#b8bcc6'); metal.addColorStop(1, '#7d828e');
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, wy, hr * .12, hr * .09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = metal; ctx.strokeStyle = INK; ctx.lineWidth = u * .05;
      ctx.beginPath(); ctx.roundRect(wx, wy - hr * .09, hr * .42, hr * .18, hr * .04); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(wx + hr * .62, wy + hr * .03, hr * .24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(wx + hr * .44, wy - hr * .22, hr * .16, hr * .08, hr * .02); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = u * .045; ctx.beginPath(); ctx.arc(wx + hr * .92, wy + hr * .03, hr * .07, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#e63946'; ctx.lineWidth = u * .06; ctx.beginPath(); ctx.moveTo(wx * 1.45 + hr * 1.42, wy + hr * .09);
      ctx.quadraticCurveTo(hr * 1.2, top + u * .2, u * .15, top + u * .35); ctx.quadraticCurveTo(-hr * .6, top + u * .1, -hr * .7, hy + hr * .75); ctx.stroke();
      if (blowing) { ctx.strokeStyle = `rgba(255, 255, 255, ${e})`; ctx.lineWidth = u * .07; for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(hr * 1.55, wy + k * hr * .25); ctx.lineTo(hr * (1.9 + e * .3), wy + k * hr * .45); ctx.stroke(); } }
    }
    return top - hr * 1.9;
  }

  const collaDesign = (name, look) => ({
    name, ownNames: true,
    draw(ctx, w, h, f, state) {
      const s = Math.min(w, h), wide = w >= h, V = VARIANTS[look], st = state['colla-' + look] ??= { sway: 0, confetti: [] };
      st.sway += f.dt * (1.2 + f.level * 3);
      ctx.globalCompositeOperation = 'source-over';
      const ground = h * (wide ? .42 : .45);
      collaBackground(ctx, w, h, f, st, s, ground);
      // Formació (de darrere a davant): les files es veuen escalonades perquè no es tapin, i la del davant deixa el
      // centre lliure per al mestre.
      const LINES = [[0, 1, 2, 11], [3, 4, 10, 5], [6, 7, 8], [9]];
      const depth = wide ? [.5, .65, .8, .92] : [.46, .61, .76, .91], unit = s * (wide ? .041 : .054) / Math.max(1, V.body * .92);
      const PLACE = wide ? [[.17, .39, .61, .83], [.07, .29, .71, .93], [.18, .34, .76], [.5]] : [[.14, .38, .62, .86], [.1, .3, .7, .9], [.13, .32, .8], [.55]];
      const hitOf = row => f.hits.reduce((m, x) => x.row === row ? Math.max(m, 1 - x.age / .3) : m, 0);
      const bubbles = [];
      for (const [li, line] of LINES.entries()) for (const [pi, row] of line.entries()) {
        const u = unit * (.82 + li * .1), e = Math.max(0, hitOf(row)), x = w * PLACE[li][pi], y = h * depth[li];
        const bob = Math.sin(st.sway + row * 1.7) * u * .05 + e * u * .12;
        ctx.save(); ctx.translate(x, y + bob);
        const headTop = drawMusician(ctx, u, row, e, f, st, V);
        ctx.restore();
        // Nom de l'instrument, als peus (més viu quan sona).
        ctx.font = `${Math.round(u * .42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = u * .12; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(f.names[row] || '', x, y + u * .15);
        ctx.fillStyle = e > 0 ? '#ffd23f' : '#fff8e7'; ctx.fillText(f.names[row] || '', x, y + u * .15);
        if (e > 0) bubbles.push({ x: x + (x < w / 2 ? 1 : -1) * u * 1.2, y: y + headTop - u * .2, u, e, word: WORDS[row], row, side: x < w / 2 ? -1 : 1 });
      }
      // Bafarades al damunt de tothom: el so de cada cop, amb la cua cap a qui toca.
      for (const b of bubbles) {
        ctx.font = `${Math.round(b.u * (.62 + b.e * .15))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(b.word).width + b.u * .7, th = b.u * 1.05;
        ctx.save(); ctx.translate(b.x, b.y - (1 - b.e) * b.u * .4); ctx.globalAlpha = Math.min(1, b.e * 2.5);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = b.u * .08;
          ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, th * .45);
          ctx.moveTo(b.side * tw * .12, th / 2 - 1); ctx.lineTo(b.side * tw * .32, th / 2 + b.u * .55); ctx.lineTo(b.side * tw * .3 - b.side * b.u * .35, th / 2 - 1);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillRect(b.side * tw * .14 - b.u * .25, th / 2 - b.u * .1, b.u * .5, b.u * .14);
        ctx.fillStyle = `hsl(${hueOf(b.row)}, 80%, 35%)`; ctx.fillText(b.word, 0, b.u * .03);
        ctx.restore();
      }
    }
  });

  // ── Dissenys ──────────────────────────────────────────────────────────
  // draw(ctx, w, h, frame, state): frame = { t, dt, bass, mid, high, level, hits: [{ row, age }] (cops dels últims 0,9 s),
  // fresh (els cops que acaben de començar en aquest fotograma), names, duration (durada de la cançó, en segons) };
  // state és la memòria entre fotogrames (cada disseny hi guarda la seva sota el seu nom).
  const DESIGNS = {
    colla: collaDesign('La colla', 'colors'),

    urna: {
      name: 'La urna que balla', ownNames: true,
      // Sàtira naïf de les eleccions a l'estat veí: una urna gegant, amb cara, al mig d'un paisatge de colors.
      // Els vots no paren d'entrar a la urna (i encara més a cada cop dels surdos i del bombo): volen fins a sobre
      // la ranura i s'hi veuen caure a dins. A baix, els eslògans de campanya, en lletres grans i cadascun d'un color,
      // apareixen i desapareixen un darrere l'altre amb els cops de caixa, repique, tamborim o tabal.
      // Als últims segons, la urna es buida: només en surt confeti i «Fins d'aquí a 4 anys!».
      draw(ctx, w, h, f, state) {
        const s = Math.min(w, h), wide = w >= h;
        const st = state.urna ??= { ballots: [], confetti: [], votes: 0, said: 0, squash: 0, sway: 0, flow: 0, slogan: null };
        st.sway += f.dt * (1 + f.level * 2); st.squash = Math.max(0, st.squash - f.dt * 4);
        const INK = '#2b1b3d', PAL = ['#ff5d8f', '#ffd23f', '#3ec1d3', '#7bd389', '#ff8c42', '#b388eb', '#f25f5c', '#4d9de0', '#e15fed', '#a3e635'];
        const PROMISES = ['Baixarem impostos!', 'Rodalies puntuals!', 'Habitatge per a tothom!', 'Ara sí que es complirà la immersió lingüística!', 'Ara sí que sí!',
          'Feina per a tothom!', 'Sanitat sense cues!', 'Més diàleg!', 'Rodalies cada 10 minuts!', 'Ho arreglarem!', 'Aquesta vegada és diferent!', 'Ja ho veureu!',
          'Escoles noves!', 'Res no canviarà… vull dir, tot!', 'Pujarem les pensions!', 'Llum més barata!'];
        // Traç tremolós de dibuix d'infant: cada forma es dibuixa amb una mica de soroll que es mou poc a poc.
        const wob = (k, a = 1) => Math.sin(k * 12.9898 + Math.floor(f.t * 6) * 1.7) * s * .004 * a;
        const blob = (cx, cy, rx, ry, fill, seed = 0, n = 22) => {
          ctx.beginPath();
          for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, k = 1 + Math.sin(a * 3 + seed) * .05; ctx.lineTo(cx + Math.cos(a) * rx * k + wob(i + seed), cy + Math.sin(a) * ry * k + wob(i * 2 + seed)); }
          ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = s * .006; ctx.strokeStyle = INK; ctx.stroke();
        };
        const poly = (pts, fill, seed = 0) => {
          ctx.beginPath(); pts.forEach(([x, y], i) => ctx.lineTo(x + wob(i + seed), y + wob(i * 3 + seed))); ctx.closePath();
          ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = s * .006; ctx.strokeStyle = INK; ctx.stroke();
        };
        ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = ctx.lineCap = 'round';
        // Cel a franges de colors, sol amb cara que somriu (i fa l'ullet amb els greus) i núvols.
        const bands = ['#bde0fe', '#cdb4db', '#ffc8dd', '#ffafcc', '#fde68a'];
        bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, h * .62 * i / bands.length, w, i === bands.length - 1 ? h : h * .62 / bands.length + 1); });
        const sx = w * (wide ? .12 : .18), sy = h * (wide ? .2 : .26), sr = s * (.07 + f.bass * .015);
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + st.sway * .3; poly([[sx + Math.cos(a - .1) * sr * 1.15, sy + Math.sin(a - .1) * sr * 1.15], [sx + Math.cos(a) * sr * 1.6, sy + Math.sin(a) * sr * 1.6], [sx + Math.cos(a + .1) * sr * 1.15, sy + Math.sin(a + .1) * sr * 1.15]], k % 2 ? '#ff8c42' : '#ffd23f', k); }
        blob(sx, sy, sr, sr, '#ffd23f', 3);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx - sr * .35, sy - sr * .15, sr * .09, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = s * .005; ctx.beginPath();
        if (f.bass > .6) { ctx.moveTo(sx + sr * .22, sy - sr * .15); ctx.lineTo(sx + sr * .48, sy - sr * .15); } else ctx.arc(sx + sr * .35, sy - sr * .15, sr * .09, 0, Math.PI * 2);
        f.bass > .6 ? ctx.stroke() : ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy + sr * .1, sr * .45, .2, Math.PI - .2); ctx.stroke();
        for (const [cx, cy, r] of [[.55, .1, .06], [.82, .16, .05], [.35, .24, .04]]) { const x = ((cx * w + st.sway * s * .02) % (w + s * .3)) - s * .1; blob(x, h * cy, s * r * 1.6, s * r, '#ffffff', cx * 9); }
        // Turons de colors amb flors i casetes.
        const hills = [['#7bd389', .62, .18], ['#a3e635', .7, .12], ['#3ec1d3', .78, .1]];
        hills.forEach(([c, y, amp], i) => {
          ctx.beginPath(); ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += w / 40) ctx.lineTo(x, h * y - Math.sin(x / w * Math.PI * (2 + i) + i) * h * amp * .4 + wob(x));
          ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = s * .006; ctx.strokeStyle = INK; ctx.stroke();
        });
        for (let k = 0; k < 7; k++) {
          const x = w * (k + .5) / 7 + (k % 2 ? s * .03 : -s * .03), y = h * (.64 + (k % 3) * .015), hw = s * .035;
          if (Math.abs(x - w / 2) < s * .25) continue;
          poly([[x - hw, y], [x + hw, y], [x + hw, y - hw * 1.3], [x - hw, y - hw * 1.3]], PAL[(k * 3) % PAL.length], k);
          poly([[x - hw * 1.25, y - hw * 1.3], [x, y - hw * 2.2], [x + hw * 1.25, y - hw * 1.3]], PAL[(k * 3 + 4) % PAL.length], k + 9);
          ctx.fillStyle = INK; ctx.fillRect(x - hw * .25, y - hw * .7, hw * .5, hw * .7);
        }
        for (let k = 0; k < 26; k++) {
          const x = (k * 97.3 % 100) / 100 * w, y = h * (.8 + (k * 37 % 17) / 100), r = s * (.012 + (k % 3) * .004) * (1 + f.mid * .4);
          for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 + st.sway * .5; ctx.fillStyle = PAL[k % PAL.length]; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .7, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, r * .6, 0, Math.PI * 2); ctx.fill();
        }
        // Rètol de dalt, cada lletra d'un color i que salta amb el ritme. (Es dibuixa al damunt de les promeses.)
        const banner = 'ELECCIONS A L’ESTAT VEÍ', by = h * (wide ? .17 : .14), fs = Math.round(s * (wide ? .062 : .068));
        const drawBanner = () => {
          ctx.font = `${fs}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          const total = ctx.measureText(banner).width, scale = Math.min(1, w * .92 / total);
          ctx.save(); ctx.translate(w / 2 - total * scale / 2, by); ctx.scale(scale, scale);
          let bx = 0;
          [...banner].forEach((ch, i) => {
            const jump = Math.max(0, Math.sin(st.sway * 3 + i * .6)) * fs * .12 * (.3 + f.level), cw = ctx.measureText(ch).width;
            ctx.save(); ctx.translate(bx + cw / 2, -jump); ctx.rotate(Math.sin(i * 1.3 + st.sway) * .08);
            ctx.lineWidth = fs * .14; ctx.strokeStyle = INK; ctx.strokeText(ch, -cw / 2, 0); ctx.fillStyle = PAL[i % PAL.length]; ctx.fillText(ch, -cw / 2, 0);
            ctx.restore(); bx += cw;
          });
          ctx.restore();
        };
        // La urna: caixa de vidre de colors amb cara, ulls que segueixen les paperetes i boca-ranura a dalt.
        const ending = f.duration && f.t > f.duration - 3.2, tilt = ending ? Math.min(1, (f.t - (f.duration - 3.2)) / .6) : 0;
        const ux = w / 2, uy = h * (wide ? .6 : .58), uw = s * (wide ? .3 : .38), uh = uw * 1.05;
        const sq = st.squash, bw = uw * (1 + sq * .08), bh = uh * (1 - sq * .08) + Math.sin(st.sway * 2) * s * .004;
        ctx.save(); ctx.translate(ux, uy + uh / 2); ctx.rotate(Math.sin(st.sway) * .03 + tilt * -.35); ctx.translate(-ux, -(uy + uh / 2));
        const top = uy + uh / 2 - bh;
        poly([[ux - bw / 2, uy + uh / 2], [ux + bw / 2, uy + uh / 2], [ux + bw / 2, top], [ux - bw / 2, top]], 'rgba(255, 255, 255, .55)', 1);
        // Franges de colors dins la urna (i les paperetes que hi ha caigut: s'omple a poc a poc).
        const fill = ending ? Math.max(0, 1 - tilt) * Math.min(.85, st.votes / 220) : Math.min(.85, st.votes / 220);
        for (let i = 0; i < 6; i++) { ctx.fillStyle = PAL[(i * 2 + 1) % PAL.length] + '55'; ctx.fillRect(ux - bw / 2 + bw * i / 6, top, bw / 6, bh); }
        ctx.fillStyle = '#fff8e7'; ctx.fillRect(ux - bw / 2 + s * .006, uy + uh / 2 - bh * fill, bw - s * .012, bh * fill);
        for (let i = 0; i < Math.round(fill * 40); i++) { ctx.fillStyle = PAL[i % PAL.length]; ctx.fillRect(ux - bw / 2 + ((i * 53) % 97) / 97 * (bw - s * .04) + s * .01, uy + uh / 2 - bh * fill * ((i * 31 % 89) / 89) - s * .01, s * .025, s * .006); }
        poly([[ux - bw / 2, uy + uh / 2], [ux + bw / 2, uy + uh / 2], [ux + bw / 2, top], [ux - bw / 2, top]], 'rgba(0,0,0,0)', 1);
        // Tapa de color amb la ranura (la boca), que s'obre quan el mestre xiula i al final.
        const whistle = f.hits.some(x => x.row === 9 && x.age < .3), open = Math.max(whistle ? .8 : 0, tilt);
        poly([[ux - bw * .56, top], [ux + bw * .56, top], [ux + bw * .48, top - uh * .12], [ux - bw * .48, top - uh * .12]], '#ff5d8f', 2);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ux, top - uh * .06, bw * .22, uh * (.018 + open * .05), 0, 0, Math.PI * 2); ctx.fill();
        // Cara a la urna.
        const look = st.ballots[0]?.x !== undefined ? Math.sign(st.ballots[0].x - ux) * s * .006 : Math.sin(st.sway) * s * .004;
        for (const dx of [-.18, .18]) { blob(ux + bw * dx, top + bh * .32, s * .03, s * .036, '#ffffff', dx * 10); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ux + bw * dx + look, top + bh * .33, s * .013, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ff8fab'; for (const dx of [-.3, .3]) { ctx.beginPath(); ctx.arc(ux + bw * dx, top + bh * .48, s * .022, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = INK; ctx.lineWidth = s * .006; ctx.beginPath(); ctx.arc(ux, top + bh * .45, bw * .14, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
        ctx.font = `${Math.round(s * .03)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.fillText('VOTA!', ux, uy + uh / 2 - bh * .18);
        ctx.restore();
        // Paperetes: volen des dels costats fins a sobre la ranura, s'hi posen dretes i hi cauen a dins (es retallen a la
        // ranura: es veu com hi entren). N'entren sense parar i, a cada cop dels surdos i del bombo, una més.
        const slot = [ux, top - uh * .06];
        const launch = () => {
          if (st.ballots.length >= 24) return;
          const left = Math.random() < .5, x0 = left ? -s * .05 : w + s * .05, y0 = h * (.3 + Math.random() * .45);
          st.ballots.push({ x0, y0, p: 0, c: PAL[Math.floor(Math.random() * PAL.length)], spin: (Math.random() - .5) * 8, dx: (Math.random() - .5) * bw * .25 });
        };
        if (!ending) { st.flow += f.dt * 3; while (st.flow >= 1) { st.flow--; launch(); } }
        for (const hit of f.fresh) {
          if (ending) break;
          if ([0, 1, 2, 11].includes(hit.row)) launch();
          // Eslògan nou amb els cops de caixa, repique, tamborim o tabal, quan l'anterior ja ha tingut temps de llegir-se.
          if ([3, 4, 5, 10].includes(hit.row) && (!st.slogan || f.t - st.slogan.born > 1.9 || f.t < st.slogan.born)) {
            st.slogan = { text: PROMISES[st.said % PROMISES.length], c: PAL[(st.said * 3) % PAL.length], born: f.t }; st.said++;
          }
        }
        for (const b of st.ballots) {
          b.p += f.dt / .9; const p = Math.min(1, b.p), above = slot[1] - s * .12;
          // Fins al 70 %: vol en corba fins a sobre la ranura; després, cau recte a dins.
          let x, y, rot;
          if (p < .7) { const q = p / .7; x = b.x0 + (slot[0] + b.dx - b.x0) * q; y = b.y0 + (above - b.y0) * q - Math.sin(q * Math.PI) * s * .2; rot = b.spin * q * (1 - q); }
          else { const q = (p - .7) / .3; x = slot[0] + b.dx * (1 - q); y = above + (slot[1] + s * .07 - above) * q * q; rot = 0; }
          b.x = x; b.y = y;
          ctx.save();
          if (p >= .7) { ctx.beginPath(); ctx.rect(0, 0, w, slot[1]); ctx.clip(); }
          ctx.translate(x, y); ctx.rotate(rot);
          poly([[-s * .045, -s * .03], [s * .045, -s * .03], [s * .045, s * .03], [-s * .045, s * .03]], '#ffffff', b.x0);
          ctx.fillStyle = b.c; ctx.fillRect(-s * .045, -s * .03, s * .018, s * .06);
          ctx.strokeStyle = INK; ctx.lineWidth = s * .006; ctx.beginPath(); ctx.moveTo(s * .0, -s * .012); ctx.lineTo(s * .024, s * .012); ctx.moveTo(s * .024, -s * .012); ctx.lineTo(s * .0, s * .012); ctx.stroke();
          ctx.restore();
          if (b.p >= 1 && !b.done) { b.done = true; st.votes++; st.squash = 1; }
        }
        st.ballots = st.ballots.filter(b => !b.done);
        drawBanner();
        // Eslògans: a baix, sense bafarada, en lletres grans d'un color; apareixen amb un bot i s'esvaeixen.
        if (st.slogan && !ending) {
          const age = f.t - st.slogan.born, life = 1.9;
          if (age >= 0 && age < life) {
            const pop = age < .25 ? .6 + .4 * Math.sin(age / .25 * Math.PI / 2) * 1.08 : 1, alpha = Math.min(1, (life - age) / .35);
            const size = Math.round(s * (wide ? .085 : .075)), words = st.slogan.text.split(' '), lines = [];
            ctx.font = `${size}px ${FONT}`;
            for (const word of words) { const line = lines.length ? `${lines.at(-1)} ${word}` : word; if (lines.length && ctx.measureText(line).width <= w * .9) lines[lines.length - 1] = line; else lines.push(word); }
            const cy = h * (wide ? .87 : .85) - (lines.length - 1) * size * .55;
            ctx.save(); ctx.globalAlpha = alpha; ctx.translate(w / 2, cy); ctx.scale(pop, pop); ctx.rotate(Math.sin(st.said * 2.1) * .03);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            lines.forEach((line, i) => {
              const fit = Math.min(1, w * .92 / ctx.measureText(line).width);
              ctx.save(); ctx.translate(0, i * size * 1.1); ctx.scale(fit, fit);
              ctx.lineWidth = size * .18; ctx.strokeStyle = INK; ctx.strokeText(line, 0, 0); ctx.fillStyle = st.slogan.c; ctx.fillText(line, 0, 0);
              ctx.restore();
            });
            ctx.restore();
          }
        }
        // Final: la urna es buida i només en surt confeti.
        if (ending) {
          for (let i = 0; i < 6; i++) st.confetti.push({ x: slot[0], y: slot[1], vx: (Math.random() - .5) * s * 1.2, vy: -s * (.4 + Math.random() * .6), c: PAL[Math.floor(Math.random() * PAL.length)], life: 2 });
          const msg = 'FINS D’AQUÍ A 4 ANYS!', fs2 = Math.round(s * (wide ? .08 : .085));
          ctx.font = `${fs2}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const sc = Math.min(1, w * .92 / ctx.measureText(msg).width) * (1 + Math.sin(f.t * 8) * .03);
          ctx.save(); ctx.translate(w / 2, h * (wide ? .36 : .34)); ctx.scale(sc * Math.min(1, tilt * 1.5), sc * Math.min(1, tilt * 1.5)); ctx.rotate(-.04);
          ctx.lineWidth = fs2 * .16; ctx.strokeStyle = INK; ctx.strokeText(msg, 0, 0); ctx.fillStyle = '#ffd23f'; ctx.fillText(msg, 0, 0); ctx.restore();
        }
        for (const c of st.confetti) { c.vy += s * 1.2 * f.dt; c.x += c.vx * f.dt; c.y += c.vy * f.dt; c.life -= f.dt; ctx.fillStyle = c.c; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.life * 6); ctx.fillRect(-s * .008, -s * .004, s * .016, s * .008); ctx.restore(); }
        st.confetti = st.confetti.filter(c => c.life > 0 && c.y < h + 20);
      }
    },

    alertes: {
      name: 'Alerta!', ownNames: true,
      // Sàtira naïf de les alertes meteorològiques al mòbil: a un mòbil inventat hi van arribant avisos (amb vibració
      // i un bot), mentre al fons fa just el temps contrari del que diu l'avís. Un vianant va equipat per a l'avís
      // (paraigua sota un sol de justícia, ventall sota la neu…). Els avisos canvien cada pocs segons, amb un cop de
      // caixa, repique, tamborim, tabal o un xiulet; els surdos i el bombo fan vibrar el mòbil. Als últims segons
      // arriba l'avís final: «Mireu per la finestra».
      draw(ctx, w, h, f, state) {
        const s = Math.min(w, h), wide = w >= h, INK = '#2b1b3d';
        const ALERTS = [
          ['Pluges torrencials!', 'No sortiu de casa.', 'sol', 'paraigua'],
          ['Onada de calor extrema!', 'Beveu molta aigua.', 'neu', 'ventall'],
          ['Nevades intenses!', 'Cadenes obligatòries.', 'sol', 'bufanda'],
          ['Sequera extrema!', 'Estalvieu cada gota.', 'pluja', 'ventall'],
          ['Tempesta elèctrica!', 'Allunyeu-vos dels arbres.', 'arc', 'casc'],
          ['Sol radiant tot el dia!', 'Crema solar i ulleres.', 'pluja', 'ulleres'],
          ['Fred polar!', 'Abrigueu-vos bé.', 'sol', 'bufanda'],
          ['Calamarsa gegant!', 'Guardeu el cotxe.', 'arc', 'casc'],
          ['Cel serè i calor!', 'Aneu a la platja.', 'neu', 'ulleres'],
          ['Inundacions!', 'Pugeu als pisos alts.', 'sol', 'paraigua'],
          ['Vent huracanat!', 'Lligueu els testos.', 'arc', 'casc'],
          ['Boira densa!', 'Visibilitat zero.', 'arc', 'paraigua']
        ];
        const st = state.alertes ??= { index: 0, born: 0, shake: 0, sway: 0, rain: [], snow: [], history: [], weather: 'sol', from: 'sol', fade: 1 };
        st.sway += f.dt * (1 + f.level * 2); st.shake = Math.max(0, st.shake - f.dt * 2.5); st.fade = Math.min(1, st.fade + f.dt * 1.6);
        const ending = f.duration && f.t > f.duration - 3.5;
        // Avís nou: cada pocs segons, amb un cop de caixa, repique, tamborim, tabal o un xiulet.
        if (f.t < st.born) Object.assign(st, { index: 0, born: f.t, history: [] });
        for (const hit of f.fresh) {
          if ([0, 1, 2, 11].includes(hit.row)) st.shake = Math.max(st.shake, .35);
          if ([3, 4, 5, 9, 10].includes(hit.row) && f.t - st.born > 4.2 && !ending) {
            st.history.unshift(ALERTS[st.index % ALERTS.length]); st.history.length = Math.min(st.history.length, 2);
            st.index++; st.born = f.t; st.shake = 1;
          }
        }
        const alert = ALERTS[st.index % ALERTS.length], weather = ending ? 'arc' : alert[2];
        if (weather !== st.weather) { st.from = st.weather; st.weather = weather; st.fade = 0; st.rain = []; st.snow = []; }
        const wob = k => Math.sin(k * 12.9898 + Math.floor(f.t * 6) * 1.7) * s * .003;
        const poly = (pts, fill, seed = 0, lw = s * .006) => { ctx.beginPath(); pts.forEach(([x, y], i) => ctx.lineTo(x + wob(i + seed), y + wob(i * 3 + seed))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); };
        const circle = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = s * .006; ctx.strokeStyle = INK; ctx.stroke(); };
        ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = ctx.lineCap = 'round';
        const ground = h * (wide ? .74 : .78);
        // ── El temps que fa de debò (el contrari de l'avís), amb una fosa quan canvia.
        const SKY = { sol: ['#ffb347', '#ffe08a'], pluja: ['#5b6b80', '#9aa7b8'], neu: ['#b8c9dc', '#eef3f8'], arc: ['#6ec6ff', '#c9f0ff'] };
        const sky = (key, alpha) => { const g = ctx.createLinearGradient(0, 0, 0, ground); g.addColorStop(0, SKY[key][0]); g.addColorStop(1, SKY[key][1]); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, w, ground); ctx.globalAlpha = 1; };
        sky(st.from, 1); sky(st.weather, st.fade);
        const sunX = w * (wide ? .2 : .16), sunY = h * (wide ? .22 : .13);
        if (st.weather === 'sol' || st.weather === 'arc') {
          ctx.globalAlpha = st.fade;
          const r = s * (st.weather === 'sol' ? .1 : .06) * (1 + f.bass * .12);
          for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + st.sway * .25; poly([[sunX + Math.cos(a - .09) * r * 1.15, sunY + Math.sin(a - .09) * r * 1.15], [sunX + Math.cos(a) * r * 1.7, sunY + Math.sin(a) * r * 1.7], [sunX + Math.cos(a + .09) * r * 1.15, sunY + Math.sin(a + .09) * r * 1.15]], k % 2 ? '#ff8c42' : '#ffd23f', k); }
          circle(sunX, sunY, r, '#ffd23f');
          ctx.fillStyle = INK; for (const dx of [-.35, .35]) { ctx.beginPath(); ctx.arc(sunX + r * dx, sunY - r * .15, r * .09, 0, Math.PI * 2); ctx.fill(); }
          ctx.lineWidth = s * .005; ctx.beginPath(); ctx.arc(sunX, sunY + r * .1, r * .45, .2, Math.PI - .2); ctx.stroke();
          if (st.weather === 'sol') {
            // Calor: ones que pugen del terra.
            ctx.strokeStyle = 'rgba(255, 120, 60, .35)'; ctx.lineWidth = s * .004;
            for (let k = 0; k < 6; k++) { const x = w * (k + .5) / 6; ctx.beginPath(); for (let y = ground; y > ground - s * .25; y -= s * .01) ctx.lineTo(x + Math.sin(y / (s * .03) + st.sway * 3 + k) * s * .01, y); ctx.stroke(); }
          } else {
            // Arc de Sant Martí.
            ['#ff5d5d', '#ff9f43', '#ffd23f', '#7bd389', '#4d9de0', '#8e6cf0'].forEach((c, k) => { ctx.strokeStyle = c; ctx.lineWidth = s * .018; ctx.beginPath(); ctx.arc(w * .5, ground, s * (.62 - k * .018), Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
          }
          ctx.globalAlpha = 1;
        }
        if (st.weather === 'pluja' || st.weather === 'neu') {
          ctx.globalAlpha = st.fade;
          for (const [cx, cy, r] of [[.2, .12, .08], [.5, .08, .1], [.8, .13, .09], [.35, .2, .07], [.68, .22, .07]]) {
            const x = w * cx + Math.sin(st.sway * .3 + cx * 9) * s * .02, c = st.weather === 'pluja' ? '#7d8796' : '#ffffff';
            circle(x - s * r * .6, h * cy + s * .01, s * r * .55, c); circle(x + s * r * .6, h * cy + s * .015, s * r * .5, c); circle(x, h * cy - s * .01, s * r * .7, c);
          }
          ctx.globalAlpha = 1;
        }
        // Gotes o flocs que cauen (només amb pluja o neu).
        const list = st.weather === 'pluja' ? st.rain : st.snow;
        if (st.weather === 'pluja' || st.weather === 'neu') for (let i = 0; i < (st.weather === 'pluja' ? 10 : 4); i++) list.push({ x: Math.random() * w, y: -s * .02, v: s * (st.weather === 'pluja' ? 1.3 : .18) * (.8 + Math.random() * .4), ph: Math.random() * 6 });
        st.rain = st.rain.filter(p => p.y < ground); st.snow = st.snow.filter(p => p.y < ground);
        ctx.strokeStyle = '#d8e6ff'; ctx.lineWidth = s * .004;
        for (const p of st.rain) { p.y += p.v * f.dt; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - s * .006, p.y + s * .03); ctx.stroke(); }
        ctx.fillStyle = '#ffffff';
        for (const p of st.snow) { p.y += p.v * f.dt; p.x += Math.sin(f.t * 2 + p.ph) * s * .002; ctx.beginPath(); ctx.arc(p.x, p.y, s * .008, 0, Math.PI * 2); ctx.fill(); }
        // Terra: platja amb sorra quan fa sol, neu, toll o gespa.
        const GROUND = { sol: '#f6d58e', pluja: '#6f8f5e', neu: '#f4f8ff', arc: '#7bd389' };
        ctx.fillStyle = GROUND[st.weather]; ctx.fillRect(0, ground, w, h - ground);
        ctx.strokeStyle = INK; ctx.lineWidth = s * .006; ctx.beginPath(); ctx.moveTo(0, ground); for (let x = 0; x <= w; x += w / 30) ctx.lineTo(x, ground + wob(x)); ctx.stroke();
        if (st.weather === 'pluja') for (let k = 0; k < 5; k++) { ctx.fillStyle = '#5a7fa8'; ctx.beginPath(); ctx.ellipse(w * (k + .5) / 5, ground + (h - ground) * (.3 + (k % 2) * .3), s * .07, s * .015, 0, 0, Math.PI * 2); ctx.fill(); }
        // ── El vianant, equipat per a l'avís (no per al temps que fa).
        const px = wide ? w * .3 : w * .2, py = ground + (h - ground) * .45, u = s * (wide ? .06 : .075), prop = ending ? 'ulleres' : alert[3];
        const bob = Math.sin(st.sway * 2) * u * .05;
        ctx.save(); ctx.translate(px, py + bob);
        ctx.fillStyle = '#3d3a4b'; ctx.fillRect(-u * .5, -u * .9, u * .4, u * .85); ctx.fillRect(u * .1, -u * .9, u * .4, u * .85);
        poly([[-u * .8, -u * 2.6], [u * .8, -u * 2.6], [u * .9, -u * .9], [-u * .9, -u * .9]], prop === 'bufanda' ? '#6a4c93' : prop === 'ventall' || prop === 'ulleres' ? '#ff8fab' : '#ffd23f', 2);
        circle(0, -u * 3.3, u * .75, '#f6d5b8');
        ctx.fillStyle = INK; for (const dx of [-.28, .28]) { ctx.beginPath(); ctx.arc(u * dx, -u * 3.4, u * .08, 0, Math.PI * 2); ctx.fill(); }
        // Cara: confós (boca en ziga-zaga) perquè el temps no és el que li han dit.
        ctx.lineWidth = s * .005; ctx.beginPath(); for (let k = 0; k <= 4; k++) ctx.lineTo(-u * .25 + k * u * .125, -u * 3.05 + (k % 2 ? -u * .06 : u * .06)); ctx.stroke();
        if (prop === 'paraigua') {
          ctx.strokeStyle = INK; ctx.lineWidth = s * .006; ctx.beginPath(); ctx.moveTo(u * .9, -u * 1.8); ctx.lineTo(u * .9, -u * 4.6); ctx.stroke();
          poly([[u * .9 - u * 1.6, -u * 4.4], [u * .9, -u * 5.4], [u * .9 + u * 1.6, -u * 4.4]], '#4d9de0', 5);
        } else if (prop === 'ventall') {
          ctx.save(); ctx.translate(u * 1.1, -u * 2.8); ctx.rotate(Math.sin(st.sway * 8) * .4);
          poly([[0, 0], [u * .9, -u * .6], [u * .9, u * .6]], '#ff5d8f', 7); ctx.restore();
        } else if (prop === 'bufanda') {
          ctx.fillStyle = '#e63946'; ctx.fillRect(-u * .7, -u * 2.75, u * 1.4, u * .3); ctx.fillRect(u * .2, -u * 2.6, u * .3, u * .9);
          poly([[-u * .75, -u * 3.7], [u * .75, -u * 3.7], [u * .5, -u * 4.3], [-u * .5, -u * 4.3]], '#e63946', 8); circle(0, -u * 4.4, u * .18, '#ffffff');
        } else if (prop === 'casc') {
          ctx.beginPath(); ctx.arc(0, -u * 3.6, u * .82, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = s * .006; ctx.strokeStyle = INK; ctx.stroke();
        } else if (prop === 'ulleres') {
          ctx.fillStyle = INK; for (const dx of [-.3, .3]) { ctx.beginPath(); ctx.ellipse(u * dx, -u * 3.4, u * .22, u * .16, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillRect(-u * .1, -u * 3.45, u * .2, u * .05);
        }
        ctx.restore();
        // ── El mòbil inventat: vibra amb els greus i amb cada avís nou.
        const phW = s * (wide ? .36 : .5), phH = phW * 1.9, phX = wide ? w * .68 : w * .56, phY = wide ? h * .48 : h * .4;
        const jig = Math.sin(f.t * 90) * st.shake * s * .012;
        ctx.save(); ctx.translate(phX + jig, phY); ctx.rotate(-.04 + jig / s);
        if (st.shake > .2) { ctx.strokeStyle = INK; ctx.lineWidth = s * .005; for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const x = sx * (phW / 2 + s * (.03 + k * .02)); ctx.beginPath(); ctx.moveTo(x, -phH * .12 + k * s * .01); ctx.lineTo(x + sx * s * .015, 0); ctx.lineTo(x, phH * .12 - k * s * .01); ctx.stroke(); } }
        ctx.fillStyle = '#2b2d42'; ctx.strokeStyle = INK; ctx.lineWidth = s * .008;
        ctx.beginPath(); ctx.roundRect(-phW / 2, -phH / 2, phW, phH, phW * .14); ctx.fill(); ctx.stroke();
        const sw = phW * .9, sh = phH * .9;
        const screen = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2); screen.addColorStop(0, '#b388eb'); screen.addColorStop(1, '#ff8fab');
        ctx.fillStyle = screen; ctx.beginPath(); ctx.roundRect(-sw / 2, -sh / 2, sw, sh, phW * .1); ctx.fill();
        ctx.fillStyle = '#2b2d42'; ctx.beginPath(); ctx.roundRect(-phW * .14, -sh / 2 + phW * .03, phW * .28, phW * .06, phW * .03); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `${Math.round(phW * .07)}px ${FONT}`; ctx.textBaseline = 'middle';
        ctx.textAlign = 'left'; ctx.fillText('12:00', -sw / 2 + phW * .06, -sh / 2 + phW * .06);
        ctx.textAlign = 'right'; ctx.fillText('▮▮▮ 3%', sw / 2 - phW * .06, -sh / 2 + phW * .06);
        // Targeta de l'avís (entra amb un bot des de dalt) i, a sota, els avisos anteriors, més petits.
        const card = (y, [title, body], scale, alpha, red) => {
          const cw = sw * .9 * scale, chH = phW * .62 * scale;
          ctx.save(); ctx.globalAlpha = alpha; ctx.translate(0, y);
          ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = INK; ctx.lineWidth = s * .005; ctx.beginPath(); ctx.roundRect(-cw / 2, 0, cw, chH, phW * .05); ctx.fill(); ctx.stroke();
          ctx.fillStyle = red ? '#e63946' : '#8d8d99'; ctx.beginPath(); ctx.roundRect(-cw / 2, 0, cw, chH * .28, [phW * .05, phW * .05, 0, 0]); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `${Math.round(phW * .058 * scale)}px ${FONT}`; ctx.fillText('⚠ ALERTA · Avís meteorològic', -cw / 2 + phW * .04, chH * .14, cw * .9);
          ctx.fillStyle = INK; ctx.font = `${Math.round(phW * .075 * scale)}px ${FONT}`;
          let fsz = phW * .075 * scale; while (ctx.measureText(title).width > cw * .9 && fsz > 6) { fsz -= 1; ctx.font = `${Math.round(fsz)}px ${FONT}`; }
          ctx.fillText(title, -cw / 2 + phW * .04, chH * .48);
          ctx.font = `${Math.round(phW * .055 * scale)}px ${FONT}`; ctx.fillStyle = '#5c5470'; ctx.fillText(body, -cw / 2 + phW * .04, chH * .74, cw * .9);
          ctx.restore();
          return chH;
        };
        const age = f.t - st.born, drop = age < .35 ? 1 - Math.sin(age / .35 * Math.PI / 2) : 0, bounce = age < .6 ? Math.sin(age / .6 * Math.PI * 3) * (1 - age / .6) * phW * .03 : 0;
        const top = -sh / 2 + phW * .16;
        ctx.save(); ctx.beginPath(); ctx.roundRect(-sw / 2, -sh / 2, sw, sh, phW * .1); ctx.clip();
        const current = ending ? ['ALERTA FINAL:', 'Mireu per la finestra.'] : alert;
        let y = top + card(top - drop * phH * .4 + bounce, current, 1, 1, true) + phW * .05;
        for (const [k, old] of st.history.entries()) { if (ending) break; y += card(y, old, .82, .75 - k * .2, false) * 1 + phW * .04; }
        ctx.restore();
        ctx.restore();
        // ── Rètol: el temps que fa de debò, en lletres grans de colors (contradiu l'avís).
        const REAL = { sol: 'Fa un sol de justícia', pluja: 'Plou a bots i barrals', neu: 'Neva a tot neva', arc: 'Cel net i arc de Sant Martí' };
        const real = ending ? 'Avui fa el temps que fa' : REAL[st.weather], fs = Math.round(s * (wide ? .06 : .062));
        ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const fit = Math.min(1, w * .9 / ctx.measureText(real).width), ry = wide ? h * .92 : h * .9;
        ctx.save(); ctx.translate(wide ? w * .3 : w / 2, ry); ctx.scale(fit * (wide ? Math.min(1, w * .5 / (ctx.measureText(real).width * fit)) : 1), fit * (wide ? Math.min(1, w * .5 / (ctx.measureText(real).width * fit)) : 1));
        ctx.lineWidth = fs * .18; ctx.strokeStyle = INK; ctx.strokeText(real, 0, 0); ctx.fillStyle = { sol: '#ffd23f', pluja: '#9fd3ff', neu: '#ffffff', arc: '#7bd389' }[st.weather]; ctx.fillText(real, 0, 0);
        ctx.restore();
      }
    },

    tambors: {
      name: 'Tambors animats', ownNames: true,
      // Dibuixos animats: els instruments de la batucada amb ulls, que salten i s'aixafen quan sonen i
      // criden la seva onomatopeia en una bafarada de còmic. Al fons, raigs de sol que giren amb el ritme.
      draw(ctx, w, h, f, state) {
        const s = Math.min(w, h), st = state.tambors ??= { spin: 0, blink: [] };
        st.spin += f.dt * (0.15 + f.level * 0.8);
        // Fons: sol de raigs grocs i taronges.
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 0, w, h);
        const R = Math.hypot(w, h);
        for (let k = 0; k < 24; k++) {
          const a = st.spin + k * Math.PI / 12;
          ctx.fillStyle = k % 2 ? '#ffb627' : '#ffe066';
          ctx.beginPath(); ctx.moveTo(w / 2, h / 2);
          ctx.arc(w / 2, h / 2, R, a, a + Math.PI / 12); ctx.closePath(); ctx.fill();
        }
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, s * (0.35 + f.bass * 0.15));
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // Graella d'instruments (4×3 en horitzontal, 3×4 en vertical).
        const names = f.names, n = names.length || 12, cols = w >= h ? 4 : 3, rows = Math.ceil(n / cols);
        const cw = w / cols, ch = (h * 0.74) / rows, top = h * 0.15, size = Math.min(cw, ch) * 0.34;
        const ink = '#1b1030', WORDS = ['BUM!', 'BUM!', 'BUM!', 'TÁ!', 'TRRÁ!', 'TIC!', 'DLIM!', 'XIC!', 'UÍ!', 'FIUU!', 'POM!', 'BUM!'];
        const hitOf = row => f.hits.filter(x => x.row === row).reduce((m, x) => Math.max(m, 1 - x.age / .28), 0);
        ctx.lineJoin = ctx.lineCap = 'round';
        for (let row = 0; row < n; row++) {
          const e = Math.max(0, hitOf(row)), cx = cw * (row % cols + .5), cy = top + ch * (Math.floor(row / cols) + .5);
          const bob = Math.sin(f.t * 3 + row) * size * 0.04 - e * size * 0.35;
          ctx.save(); ctx.translate(cx, cy + bob); ctx.scale(1 + e * 0.18, 1 - e * 0.16);
          const color = `hsl(${hueOf(row)}, 85%, 58%)`, dark = `hsl(${hueOf(row)}, 80%, 38%)`;
          ctx.lineWidth = size * 0.07; ctx.strokeStyle = ink;
          const kind = row <= 2 || row === 11 ? 'surdo' : row === 6 ? 'agogo' : row === 7 ? 'xocalho' : row === 9 ? 'xiulet' : row === 5 ? 'tamborim' : 'drum';
          if (kind === 'surdo' || kind === 'drum') {
            // Tambor: cos cilíndric, cordatge en ziga-zaga i pell a dalt.
            const rw = size * (kind === 'surdo' ? 1 : 0.8), rh = size * (kind === 'surdo' ? 1.05 : 0.7);
            ctx.fillStyle = color; ctx.beginPath(); ctx.rect(-rw, -rh * 0.5, rw * 2, rh); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(0, rh * 0.5, rw, rw * 0.28, 0, 0, Math.PI); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = size * 0.035; ctx.beginPath();
            for (let z = 0; z <= 8; z++) ctx.lineTo(-rw + z * rw / 4, z % 2 ? rh * 0.32 : -rh * 0.32);
            ctx.stroke(); ctx.strokeStyle = ink; ctx.lineWidth = size * 0.07;
            ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.ellipse(0, -rh * 0.5, rw, rw * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          } else if (kind === 'tamborim') {
            ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.lineWidth = size * 0.12; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = size * 0.07; ctx.strokeStyle = ink;
          } else if (kind === 'agogo') {
            for (const [dx, r] of [[-0.35, 0.55], [0.4, 0.42]]) {
              ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(size * dx - size * r * 0.5, -size * 0.6); ctx.lineTo(size * dx + size * r * 0.5, -size * 0.6);
              ctx.lineTo(size * dx + size * r, size * 0.6); ctx.lineTo(size * dx - size * r, size * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
          } else if (kind === 'xocalho') {
            ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-size, -size * 0.4, size * 2, size * 0.8, size * 0.15); ctx.fill(); ctx.stroke();
            for (let j = -2; j <= 2; j++) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(j * size * 0.38, (j % 2 ? -1 : 1) * size * 0.12 + e * size * 0.1 * Math.sin(f.t * 40 + j), size * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
          } else {
            ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-size * 0.9, -size * 0.35, size * 1.3, size * 0.7, size * 0.3); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(size * 0.25, 0, size * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
          // Ulls: miren al centre i es tanquen (^ ^) quan l'instrument toca.
          const eyeY = kind === 'surdo' || kind === 'drum' ? 0 : -size * 0.05;
          for (const dx of [-0.28, 0.28]) {
            const ex = dx * size, er = size * 0.17;
            if (e > 0.25) { ctx.beginPath(); ctx.moveTo(ex - er, eyeY + er * 0.3); ctx.lineTo(ex, eyeY - er * 0.5); ctx.lineTo(ex + er, eyeY + er * 0.3); ctx.stroke(); continue; }
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, eyeY, er, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = size * 0.04; ctx.stroke();
            const look = Math.atan2(h / 2 - cy, w / 2 - cx);
            ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(ex + Math.cos(look) * er * 0.4, eyeY + Math.sin(look) * er * 0.4, er * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = size * 0.07;
          }
          ctx.restore();
          // El nom de l'instrument, a sota (més viu quan sona).
          ctx.font = `${Math.round(size * 0.3)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
          ctx.lineWidth = size * 0.08; ctx.strokeStyle = ink; ctx.strokeText(names[row] || '', cx, cy + size * 0.95);
          ctx.fillStyle = e > 0 ? '#ffffff' : '#fff6e0'; ctx.fillText(names[row] || '', cx, cy + size * 0.95);
          // Bafarada de còmic amb l'onomatopeia.
          if (e > 0) {
            const bx = cx + size * 0.9, by = cy - size * 1.05, br = size * (0.55 + e * 0.15);
            ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.15);
            ctx.fillStyle = '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = size * 0.05; ctx.beginPath();
            for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10, r = k % 2 ? br * 0.72 : br; ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r); }
            ctx.closePath(); ctx.globalAlpha = Math.min(1, e * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = dark; ctx.font = `${Math.round(size * 0.42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(WORDS[row] || 'POM!', 0, 0); ctx.globalAlpha = 1; ctx.restore();
          }
        }
      }
    },

    carnaval: {
      name: 'Carnaval',
      // Serpentines que onegen i confeti que cau sense parar, amb els colors del Brasil; cada cop
      // d'instrument dispara confeti del seu color des de baix, i els greus fan bategar la llum del centre.
      draw(ctx, w, h, f, state) {
        const s = Math.min(w, h), PALETTE = ['#009c3b', '#ffdf00', '#002776', '#ffffff', '#ff4f9a', '#ff8c1a', '#00c2d1'];
        const st = state.carnaval ??= { confetti: [], streamers: Array.from({ length: 9 }, (_, i) => ({ x: (i + .5) / 9, phase: Math.random() * 6, color: PALETTE[i % PALETTE.length] })) };
        ctx.globalCompositeOperation = 'source-over';
        const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0b1a4a'); bg.addColorStop(1, '#3b0a57');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        const glow = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, s * (0.45 + f.bass * 0.4));
        glow.addColorStop(0, `rgba(255, 223, 0, ${0.25 + f.bass * 0.35})`); glow.addColorStop(1, 'rgba(255, 223, 0, 0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
        // Serpentines: cintes que pengen de dalt i onegen amb els mitjos.
        ctx.lineCap = 'round';
        for (const sp of st.streamers) {
          ctx.strokeStyle = sp.color; ctx.lineWidth = s * 0.012; ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const y = (i / 40) * h * 1.05, sway = Math.sin(f.t * 2.2 + sp.phase + i * 0.35) * s * (0.03 + f.mid * 0.06) * (i / 40);
            const x = sp.x * w + sway + Math.sin(i * 0.9 + sp.phase) * s * 0.025;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        // Confeti: cau sempre; cada cop nou (una sola vegada) en dispara una ràfega del color de l'instrument.
        for (let i = 0; i < 1 + f.high * 5; i++) st.confetti.push({ x: Math.random() * w, y: -s * 0.02, vx: (Math.random() - .5) * s * 0.05, vy: s * (0.08 + Math.random() * 0.12), r: Math.random() * 6, vr: (Math.random() - .5) * 8, c: PALETTE[Math.floor(Math.random() * PALETTE.length)], life: 8 });
        for (const hit of f.fresh) {
          const x0 = w * ((hit.row + .5) / 12);
          for (let i = 0; i < 18; i++) {
            const a = -Math.PI / 2 + (Math.random() - .5) * 1.1, v = s * (0.6 + Math.random() * 0.6);
            st.confetti.push({ x: x0, y: h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - .5) * 12, c: `hsl(${hueOf(hit.row)}, 95%, 60%)`, life: 4, gravity: true });
          }
        }
        for (const p of st.confetti) {
          if (p.gravity) p.vy += s * 0.9 * f.dt; else p.vx += Math.sin(f.t * 3 + p.y * 0.01) * s * 0.002;
          p.x += p.vx * f.dt; p.y += p.vy * f.dt; p.r += p.vr * f.dt; p.life -= f.dt;
        }
        st.confetti = st.confetti.filter(p => p.life > 0 && p.y < h + s * 0.05).slice(-700);
        // (Cada paperet gira i s'aplana com si caigués; sense desar i restaurar el context: molt més ràpid.)
        for (const p of st.confetti) {
          const c = Math.cos(p.r), sn = Math.sin(p.r), flat = Math.abs(Math.cos(p.r * 1.7)) + .2;
          ctx.setTransform(c, sn, -sn * flat, c * flat, p.x, p.y);
          ctx.fillStyle = p.c; ctx.fillRect(-s * 0.006, -s * 0.0035, s * 0.012, s * 0.007);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    },

    calcadao: {
      name: 'Calçadão',
      // Les ones blanques i negres del passeig de Copacabana, que avancen sense fi: els greus les fan créixer,
      // els mitjos les fan més ondulades i cada cop fa aparèixer pedretes de colors sobre les crestes.
      draw(ctx, w, h, f, state) {
        const s = Math.min(w, h), st = state.calcadao ??= { shift: 0, stones: [] };
        st.shift += f.dt * s * (0.05 + f.level * 0.25);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#f4ecd8'; ctx.fillRect(0, 0, w, h);
        const bands = 9, band = h / bands, amp = band * (0.28 + f.bass * 0.3), wave = s * (0.32 - f.mid * 0.08);
        const crest = (k, x) => k * band + Math.sin((x + st.shift * (k % 2 ? 1 : -1) * 0.6 + k * 40) / wave * Math.PI * 2) * amp;
        for (let k = 0; k < bands + 1; k += 2) {
          ctx.fillStyle = '#16120f'; ctx.beginPath();
          for (let x = 0; x <= w; x += w / 120) ctx.lineTo(x, crest(k, x));
          for (let x = w; x >= 0; x -= w / 120) ctx.lineTo(x, crest(k + 1, x));
          ctx.closePath(); ctx.fill();
        }
        for (const hit of f.fresh) {
          const k = 1 + Math.floor(Math.random() * (bands - 1)), x = Math.random() * w;
          st.stones.push({ k, x, row: hit.row, life: 1.2 });
        }
        for (const st2 of st.stones) { st2.life -= f.dt; st2.x += s * 0.05 * f.dt; }
        st.stones = st.stones.filter(x => x.life > 0).slice(-300);
        for (const st2 of st.stones) {
          const y = crest(st2.k, st2.x), r = s * 0.02 * Math.max(0, Math.min(1, st2.life * 2)) * (1 + f.bass * .5);
          ctx.fillStyle = `hsl(${hueOf(st2.row)}, 90%, 55%)`; ctx.strokeStyle = '#16120f'; ctx.lineWidth = s * 0.004;
          ctx.beginPath(); ctx.arc(st2.x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
    },

    rio: {
      name: 'Rio tropical',
      // Dibuix de postal: posta de sol que batega amb els greus, el Pão de Açúcar, el mar i palmeres que es
      // gronxen amb el so; a cada cop floreix un hibisc del color de l'instrument, i passen ocells.
      draw(ctx, w, h, f, state) {
        const s = Math.min(w, h), ink = '#2a0f2e';
        const st = state.rio ??= { flowers: [], birds: [], next: 0 };
        ctx.globalCompositeOperation = 'source-over';
        const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
        sky.addColorStop(0, '#ff5e8a'); sky.addColorStop(0.55, '#ff9a3c'); sky.addColorStop(1, '#ffd36b');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
        // Sol amb raigs que giren.
        const sx = w * 0.5, sy = h * 0.5, sr = s * (0.16 + f.bass * 0.05);
        ctx.fillStyle = 'rgba(255, 240, 150, .5)';
        for (let k = 0; k < 16; k++) { const a = f.t * 0.3 + k * Math.PI / 8; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, sr * (2.2 + f.level), a, a + Math.PI / 20); ctx.fill(); }
        ctx.fillStyle = '#fff3a8'; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.006;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Muntanyes: el Pão de Açúcar i els turons.
        const hill = (x0, peak, width, height, color) => {
          ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x0 - width, h * 0.68);
          ctx.bezierCurveTo(x0 - width * 0.6, h * 0.68 - height * 0.2, x0 - width * 0.35, h * 0.68 - height, x0 + peak, h * 0.68 - height);
          ctx.bezierCurveTo(x0 + width * 0.4, h * 0.68 - height, x0 + width * 0.6, h * 0.68 - height * 0.3, x0 + width, h * 0.68);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        };
        hill(w * 0.18, 0, w * 0.22, h * 0.22, '#5b2a6e'); hill(w * 0.78, s * 0.02, w * 0.14, h * 0.36, '#4a1f5c'); hill(w * 0.62, 0, w * 0.1, h * 0.16, '#6b3580');
        // Mar amb onades.
        ctx.fillStyle = '#1d7fb8'; ctx.fillRect(0, h * 0.68, w, h * 0.32);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = s * 0.005;
        for (let k = 0; k < 6; k++) {
          ctx.beginPath(); const y0 = h * (0.72 + k * 0.05);
          for (let x = 0; x <= w; x += w / 60) ctx.lineTo(x, y0 + Math.sin(x / (s * 0.06) + f.t * (1.5 + k * 0.3)) * s * (0.006 + f.mid * 0.01));
          ctx.stroke();
        }
        // Ocells que creuen el cel de tant en tant.
        if (f.t > st.next) { st.birds.push({ x: -s * 0.05, y: h * (0.12 + Math.random() * 0.25), v: s * (0.12 + Math.random() * 0.1) }); st.next = f.t + 3 + Math.random() * 4; }
        ctx.strokeStyle = ink; ctx.lineWidth = s * 0.005;
        for (const b of st.birds) {
          b.x += b.v * f.dt; const flap = Math.sin(f.t * 10 + b.y) * s * 0.012;
          ctx.beginPath(); ctx.moveTo(b.x - s * 0.025, b.y - flap); ctx.quadraticCurveTo(b.x - s * 0.01, b.y - s * 0.012, b.x, b.y); ctx.quadraticCurveTo(b.x + s * 0.01, b.y - s * 0.012, b.x + s * 0.025, b.y - flap); ctx.stroke();
        }
        st.birds = st.birds.filter(b => b.x < w + s * 0.1);
        // Palmeres als costats, que es gronxen.
        const palm = (x, dir) => {
          const sway = Math.sin(f.t * 1.4) * s * 0.02 + f.level * s * 0.03 * dir, topX = x + dir * s * 0.08 + sway, topY = h * 0.3;
          ctx.strokeStyle = '#6b3d1c'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(x, h); ctx.quadraticCurveTo(x + dir * s * 0.02, h * 0.6, topX, topY); ctx.stroke();
          for (let k = 0; k < 7; k++) {
            const a = -Math.PI / 2 + (k - 3) * 0.5 + Math.sin(f.t * 2 + k) * 0.06 * (1 + f.mid * 2), len = s * 0.22;
            ctx.fillStyle = k % 2 ? '#1f9d55' : '#27b863'; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.004;
            ctx.beginPath(); ctx.moveTo(topX, topY);
            ctx.quadraticCurveTo(topX + Math.cos(a - .3) * len * .6, topY + Math.sin(a - .3) * len * .6 - s * .03, topX + Math.cos(a) * len, topY + Math.sin(a) * len + s * .06);
            ctx.quadraticCurveTo(topX + Math.cos(a + .3) * len * .6, topY + Math.sin(a + .3) * len * .6, topX, topY);
            ctx.fill(); ctx.stroke();
          }
        };
        palm(w * 0.06, 1); palm(w * 0.94, -1);
        // Hibiscs: cada cop nou en fa florir un del color de l'instrument, que puja i s'esvaeix.
        for (const hit of f.fresh) if (Math.random() < .6) st.flowers.push({ x: w * (0.15 + Math.random() * 0.7), y: h * (0.25 + Math.random() * 0.55), row: hit.row, life: 1.6, spin: Math.random() * 6 });
        for (const fl of st.flowers) { fl.life -= f.dt; fl.y -= s * 0.04 * f.dt; fl.spin += f.dt; }
        st.flowers = st.flowers.filter(x => x.life > 0).slice(-120);
        for (const fl of st.flowers) {
          const grow = Math.min(1, (1.6 - fl.life) * 4), r = s * 0.045 * grow * (1 + f.bass * .3);
          ctx.save(); ctx.translate(fl.x, fl.y); ctx.rotate(fl.spin * 0.5); ctx.globalAlpha = Math.min(1, fl.life);
          ctx.fillStyle = `hsl(${hueOf(fl.row)}, 90%, 60%)`; ctx.strokeStyle = ink; ctx.lineWidth = s * 0.004;
          for (let k = 0; k < 5; k++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(r * 0.6, 0, r * 0.62, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
          ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  // ── Interfície ────────────────────────────────────────────────────────
  // El disseny es dibuixa en una capa pròpia (amb els rastres); el llenç que es veu i es grava és aquesta capa
  // més els textos, nets a cada fotograma.
  let scene, sceneCtx;
  let root, canvas, ctx, ui = {}, audioCtx, analyser, recordDest, buffer, source, song = null;
  let playing = false, startedAt = 0, offset = 0, frame = 0, last = 0, lastT = -1, recorder = null, hideTimer = 0;
  const state = { sparks: [] };
  const resetState = () => { for (const key of Object.keys(state)) delete state[key]; state.sparks = []; lastT = -1; };
  const $ = (tag, props = {}, ...children) => { const el = Object.assign(document.createElement(tag), props); el.append(...children); return el; };
  const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sense memòria */ } } };

  function build() {
    root = $('div', { className: 'vtc', hidden: true, tabIndex: -1 });
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Visualitzador VaTuCalla!');
    canvas = $('canvas', { className: 'vtc-canvas' });
    ctx = canvas.getContext('2d');
    ui.title = $('input', { className: 'vtc-title-input', type: 'text', maxLength: 80, placeholder: 'Nom de la cançó' });
    ui.title.setAttribute('aria-label', 'Nom de la cançó');
    ui.design = $('select', { className: 'vtc-select' }, ...Object.entries(DESIGNS).map(([key, d]) => new Option(d.name, key)));
    ui.design.setAttribute('aria-label', 'Disseny');
    ui.format = $('select', { className: 'vtc-select' }, ...Object.entries(FORMATS).map(([key, [, , name]]) => new Option(name, key)));
    ui.format.setAttribute('aria-label', 'Format del vídeo');
    ui.quality = $('select', { className: 'vtc-select' }, ...Object.entries(QUALITIES).map(([key, q]) => new Option(`${q.name} (≈ ${Math.round(mbPerMinute(q))} MB/min)`, key)));
    ui.quality.setAttribute('aria-label', 'Qualitat i mida del vídeo');
    ui.play = $('button', { className: 'vtc-btn', type: 'button', textContent: '▶' });
    ui.play.setAttribute('aria-label', 'Reprodueix');
    ui.restart = $('button', { className: 'vtc-btn', type: 'button', textContent: '⏮' });
    ui.restart.setAttribute('aria-label', 'Des del principi');
    ui.record = $('button', { className: 'vtc-btn vtc-rec', type: 'button', textContent: '● Grava vídeo' });
    ui.full = $('button', { className: 'vtc-btn', type: 'button', textContent: '⛶' });
    ui.full.setAttribute('aria-label', 'Pantalla completa');
    ui.close = $('button', { className: 'vtc-btn', type: 'button', textContent: '✕' });
    ui.close.setAttribute('aria-label', 'Tanca el visualitzador');
    ui.time = $('span', { className: 'vtc-time', textContent: '0:00' });
    ui.status = $('p', { className: 'vtc-status', role: 'status' });
    ui.bar = $('div', { className: 'vtc-bar' }, ui.title, ui.design, ui.format, ui.quality, ui.restart, ui.play, ui.time, ui.record, ui.full, ui.close);
    root.append(canvas, ui.bar, ui.status);
    document.body.append(root);
    ui.play.addEventListener('click', () => (playing ? pause() : play()));
    ui.restart.addEventListener('click', () => { const was = playing; stopSource(); offset = 0; if (was) play(); });
    ui.close.addEventListener('click', close);
    ui.full.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => {}); });
    // Format: el darrer triat o, la primera vegada, el de la pantalla (vertical al mòbil).
    ui.format.value = FORMATS[store.get('vatucalla-format')] ? store.get('vatucalla-format') : innerHeight > innerWidth ? 'portrait' : 'landscape';
    ui.format.addEventListener('change', () => { store.set('vatucalla-format', ui.format.value); if (!recorder) resize(); });
    // Qualitat: la darrera triada (per defecte, mitjana); mostra quant ocuparà la cançó sencera.
    ui.quality.value = QUALITIES[store.get('vatucalla-quality')] ? store.get('vatucalla-quality') : 'mitjana';
    ui.quality.addEventListener('change', () => { store.set('vatucalla-quality', ui.quality.value); if (!recorder) { resize(); sizeHint(); } });
    // Disseny: el darrer triat; en canviar-lo, comença net (cada disseny té el seu estat).
    if (DESIGNS[store.get('vatucalla-design')]) ui.design.value = store.get('vatucalla-design');
    ui.design.addEventListener('change', () => { store.set('vatucalla-design', ui.design.value); resetState(); resize(); });
    ui.title.addEventListener('input', () => { if (song) store.set(`vatucalla-title-${song.id}`, ui.title.value); });
    // Gravant, el botó atura i desa el que s'ha gravat fins ara (per fer un tros de la cançó); tancar ho cancel·la.
    ui.record.addEventListener('click', () => (recorder ? stopRecording(false) : startRecording()));
    root.addEventListener('pointermove', wake);
    root.addEventListener('keydown', event => {
      if (event.target === ui.title) return;
      if (event.key === 'Escape' && !document.fullscreenElement) close();
      if (event.key === ' ') { event.preventDefault(); playing ? pause() : play(); }
    });
  }
  // La barra de controls s'amaga sola (no surt mai al vídeo: el vídeo és només el llenç).
  function wake() {
    root.classList.remove('vtc-idle'); clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (playing && document.activeElement !== ui.title) root.classList.add('vtc-idle'); }, 2500);
  }
  function resize() {
    // (La resolució del llenç és la de la qualitat triada: menys píxels, vídeo més lleuger.)
    const scale = QUALITIES[ui.quality.value]?.scale ?? 1, [w, h] = FORMATS[ui.format.value].slice(0, 2).map(n => Math.round(n * scale / 2) * 2);
    canvas.width = w; canvas.height = h;
    scene ??= document.createElement('canvas'); scene.width = w; scene.height = h; sceneCtx = scene.getContext('2d');
    sceneCtx.fillStyle = '#06040e'; sceneCtx.fillRect(0, 0, w, h);
  }

  // Quant ocuparà el vídeo de la cançó sencera amb la qualitat triada.
  function sizeHint() {
    if (!buffer || recorder) return;
    const q = QUALITIES[ui.quality.value] || QUALITIES.mitjana, mb = mbPerMinute(q) * buffer.duration / 60;
    ui.status.textContent = `Vídeo de tota la cançó: ≈ ${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB (qualitat ${q.name.toLowerCase()}).`;
  }

  // ── So: la cançó, l'analitzador i la sortida per a la gravació ────────
  function position() { return playing ? Math.min(buffer.duration, audioCtx.currentTime - startedAt) : offset; }
  function play() {
    if (!buffer || playing) return;
    audioCtx.resume();
    if (offset >= buffer.duration - .05) offset = 0;
    source = audioCtx.createBufferSource(); source.buffer = buffer;
    source.connect(analyser);
    source.onended = () => { if (source && position() >= buffer.duration - .1) { playing = false; offset = buffer.duration; source = null; ui.play.textContent = '▶'; if (recorder) stopRecording(false); } };
    source.start(0, offset); startedAt = audioCtx.currentTime - offset; playing = true;
    ui.play.textContent = '❚❚'; ui.play.setAttribute('aria-label', 'Pausa'); wake();
  }
  function stopSource() { if (source) { source.onended = null; try { source.stop(); } catch { /* ja aturada */ } source = null; } playing = false; }
  function pause() { offset = position(); stopSource(); ui.play.textContent = '▶'; ui.play.setAttribute('aria-label', 'Reprodueix'); root.classList.remove('vtc-idle'); }

  // Energia de tres bandes (greus, mitjos, aguts) i nivell general, suavitzats.
  const bands = { bass: 0, mid: 0, high: 0, level: 0 }, spectrum = new Uint8Array(1024);
  function listen() {
    analyser.getByteFrequencyData(spectrum);
    const binHz = audioCtx.sampleRate / analyser.fftSize, avg = (a, b) => { let s = 0, n = 0; for (let i = Math.floor(a / binHz); i <= Math.floor(b / binHz) && i < spectrum.length; i++) { s += spectrum[i]; n++; } return n ? s / n / 255 : 0; };
    const now = { bass: avg(30, 160), mid: avg(300, 2000), high: avg(4000, 12000) };
    now.level = (now.bass + now.mid + now.high) / 3;
    for (const key of Object.keys(bands)) bands[key] += (now[key] - bands[key]) * (now[key] > bands[key] ? .5 : .12);
  }

  // ── Fotogrames ────────────────────────────────────────────────────────
  function hitsAt(t) {
    // Cops dels últims 0,9 s (cerca binària a la llista ordenada de la partitura).
    const list = song.hits, from = t - .9;
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid][0] < from) lo = mid + 1; else hi = mid; }
    const out = [];
    for (let i = lo; i < list.length && list[i][0] <= t + .02; i++) out.push({ row: list[i][1], age: Math.max(0, t - list[i][0]), at: list[i][0] });
    return out;
  }
  function overlay(w, h, hits, design) {
    const s = Math.min(w, h);
    ctx.globalCompositeOperation = 'source-over';
    // Nom de la cançó, a dalt i centrat, en blanc.
    const title = ui.title.value.trim();
    if (title) {
      ctx.font = `${Math.round(s * 0.055)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = s * 0.02; ctx.fillStyle = '#ffffff';
      let size = Math.round(s * 0.055);
      while (ctx.measureText(title).width > w * 0.9 && size > 12) { size -= 2; ctx.font = `${size}px ${FONT}`; }
      // (Amb un contorn fosc, perquè es llegeixi també sobre els fons clars.)
      ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(20, 10, 30, .65)'; ctx.strokeText(title, w / 2, h * 0.05);
      ctx.fillText(title, w / 2, h * 0.05);
    }
    // Nom del projecte, sempre a baix a la dreta.
    ctx.font = `${Math.round(s * 0.04)}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = s * 0.015; ctx.fillStyle = '#ffffff';
    ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.005; ctx.strokeStyle = 'rgba(20, 10, 30, .65)'; ctx.strokeText(PROJECT, w - s * 0.04, h - s * 0.035);
    ctx.fillText(PROJECT, w - s * 0.04, h - s * 0.035);
    ctx.shadowBlur = 0;
    // (Els dissenys que ja escriuen el nom de cada instrument no necessiten la llista.)
    if (design.ownNames) return;
    // Instruments que sonen ara: cada un al seu lloc (a baix a l'esquerra), del seu color, s'encén quan sona.
    const now = new Map();
    for (const hit of hits) if (hit.age < .35) now.set(hit.row, Math.max(now.get(hit.row) ?? 0, 1 - hit.age / .35));
    ctx.font = `${Math.round(s * 0.026)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const rows = song.names.length;
    for (const [row, glow] of now) {
      ctx.fillStyle = `hsla(${hueOf(row)}, 100%, ${55 + glow * 20}%, ${0.35 + glow * 0.65})`;
      const y = h - s * 0.035 - (rows - 1 - row) * s * 0.034;
      ctx.lineWidth = s * 0.004; ctx.strokeStyle = 'rgba(20, 10, 30, .7)'; ctx.strokeText(song.names[row] || '', s * 0.04, y);
      ctx.fillText(song.names[row] || '', s * 0.04, y);
    }
  }
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (!song) return;
    const dt = Math.min(.1, last ? (now - last) / 1000 : 1 / 60); last = now;
    listen();
    const t = position(), hits = hitsAt(t);
    // Cops nous des del fotograma anterior (cadascun una sola vegada; si es torna enrere, es comença de nou).
    if (t + .02 < lastT - .05) lastT = t - 1 / 60;
    const fresh = hits.filter(hit => hit.at > lastT); lastT = Math.max(lastT, t + .02);
    const design = DESIGNS[ui.design.value] || DESIGNS.colla;
    design.draw(sceneCtx, scene.width, scene.height, { t, dt, ...bands, hits, fresh, names: song.names, duration: buffer.duration }, state);
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(scene, 0, 0); ctx.globalCompositeOperation = 'source-over';
    overlay(canvas.width, canvas.height, hits, design);
    ui.time.textContent = `${clock(t)} / ${clock(buffer.duration)}`;
    if (recorder) ui.status.textContent = `● Gravant el vídeo… ${clock(t)} / ${clock(buffer.duration)} (no canviïs de pestanya)`;
  }

  // ── Exportació a vídeo: llenç + àudio original, en temps real ──────────
  // Primer MP4 amb H.264 i AAC (el que obren tots els reproductors i editors de vídeo), després qualsevol MP4 i, si no, WebM.
  const TYPES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4d0028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a',
    'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  function startRecording() {
    if (!window.MediaRecorder || !canvas.captureStream) { ui.status.textContent = 'Aquest navegador no pot gravar vídeo. Prova-ho amb Chrome, Edge o Safari.'; return; }
    const type = TYPES.find(t => MediaRecorder.isTypeSupported(t));
    if (!type) { ui.status.textContent = 'Aquest navegador no pot gravar vídeo en MP4 ni en WebM.'; return; }
    stopSource(); offset = 0; resize(); resetState();
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...recordDest.stream.getAudioTracks()]);
    const chunks = [];
    const quality = QUALITIES[ui.quality.value] || QUALITIES.mitjana;
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: quality.video, audioBitsPerSecond: quality.audio });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const keep = recorder?.keep; recorder = null;
      ui.record.textContent = '● Grava vídeo'; ui.format.disabled = ui.design.disabled = ui.quality.disabled = false;
      if (!keep) { ui.status.textContent = 'Gravació cancel·lada.'; return; }
      const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm', blob = new Blob(chunks, { type: type.split(';')[0] });
      const name = `${(ui.title.value.trim() || 'batucada').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'batucada'} - ${PROJECT.replace('!', '')}.${ext}`;
      const link = $('a', { href: URL.createObjectURL(blob), download: name });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      const size = `${(blob.size / 1e6).toFixed(1).replace('.', ',')} MB`;
      ui.status.textContent = ext === 'mp4' ? `Vídeo desat: ${name} (${size})` : `Vídeo desat en WebM (aquest navegador no grava MP4): ${name} (${size})`;
    };
    recorder.keep = false;
    recorder.start(1000);
    ui.record.textContent = '■ Atura i desa'; ui.format.disabled = ui.design.disabled = ui.quality.disabled = true;
    play();
  }
  // Atura la gravació i desa el vídeo (al final de la cançó o amb el botó); en tancar, es cancel·la.
  function stopRecording(cancel) {
    if (!recorder) return;
    recorder.keep = !cancel;
    if (playing) pause();
    if (recorder.state !== 'inactive') recorder.stop();
  }

  // ── Obrir i tancar ────────────────────────────────────────────────────
  async function open(input) {
    if (!root) build();
    root.hidden = false; document.body.classList.add('vtc-open');
    ui.status.textContent = 'Preparant la cançó…';
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!analyser) {
      analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .6;
      recordDest = audioCtx.createMediaStreamDestination();
      analyser.connect(audioCtx.destination); analyser.connect(recordDest);
    }
    stopSource(); offset = 0; resetState();
    const data = await (await fetch(input.url)).arrayBuffer();
    buffer = await audioCtx.decodeAudioData(data);
    song = { id: input.id, hits: input.hits || [], names: input.names || [] };
    ui.title.value = store.get(`vatucalla-title-${input.id}`) ?? input.title ?? '';
    resize();
    sizeHint();
    if (!frame) frame = requestAnimationFrame(draw);
    root.focus?.();
    root.requestFullscreen?.().catch(() => {});
    play();
  }
  function close() {
    if (recorder) stopRecording(true);
    stopSource(); offset = 0;
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (document.fullscreenElement) document.exitFullscreen?.();
    root.hidden = true; document.body.classList.remove('vtc-open');
  }

  window.VaTuCalla = { open, close, DESIGNS, PROJECT };
})();
