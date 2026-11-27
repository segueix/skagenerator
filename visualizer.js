(() => {
  'use strict';
  // VaTuCalla! — visualitzador a pantalla completa per a la batucada (per fer videoclips).
  // Reprodueix la cançó ja gravada (WAV de la ràdio), dibuixa formes que canvien amb el so i
  // mostra els instruments que sonen a cada moment (a partir de la partitura de cada cop).
  // El vídeo s'exporta des del mateix llenç: imatge del llenç + àudio original, sincronitzats.
  // Dissenys: cada un és una funció que dibuixa un fotograma; se n'hi poden afegir més a DESIGNS.
  const PROJECT = 'VaTuCalla!';
  const FORMATS = { landscape: [1920, 1080, 'Horitzontal 16:9'], portrait: [1080, 1920, 'Vertical 9:16'], square: [1080, 1080, 'Quadrat 1:1'] };
  const FONT = '"Archivo Black", "Manrope", system-ui, sans-serif';
  // Color de cada instrument (to HSL), en l'ordre de la graella de la batucada.
  const hueOf = row => (row * 137.5 + 20) % 360;

  // ── La colla: dibuixos de retalls de paper ────────────────────────────
  // Una colla de batucada d'homes d'entre 40 i 55 anys (cabells foscos o amb canes a les temples, entrades,
  // bigotis, barbes curtes i alguns amb ulleres), en formació: els surdos i el bombo al darrere; la caixa, el
  // repique, el tabal i el tamborim al mig; l'agogô, el xocalho i la cuíca al davant, i el mestre al capdavant,
  // amb el xiulet a la boca i el seu repique. Cadascú toca el seu instrument quan sona i en surt una bafarada
  // amb el so (BUM!, TÁ!, FIUUU!…). Tres variants (look): samarretes de colors a la plaça, colla uniformada
  // de nit i festa a l'escenari.
  const INK = '#2a1d2e';
  const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d9a066', '#b97a4a', '#f3c9a0', '#a0673d', '#eab38a', '#c98f5d', '#f6d0ad'];
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
    colors: { head: 1, body: 1, bubble: 'round',
      shirt: row => ['#e63946', '#2a9d8f', '#264653', '#f4a261', '#6a4c93', '#1d3557', '#ff7f11', '#06a77d', '#b5179e', '#3a86ff', '#8338ec', '#d62828'][row],
      trousers: () => '#3d3a4b', hat: row => row === 2 ? 'gorra' : row === 8 ? 'barret' : null },
    uniforme: { head: 1, body: 1.05, bubble: 'round',
      shirt: () => '#f4f1ea', sash: row => ['#1d4ed8', '#dc2626', '#16a34a', '#eab308'][SECTION(row)],
      trousers: () => '#1f2a44', hat: () => 'mocador' },
    festa: { head: .86, body: 1.22, bubble: 'star',
      shirt: row => ['#ff006e', '#3a86ff', '#ffbe0b', '#8338ec', '#fb5607', '#06d6a0', '#ef476f', '#118ab2', '#ffd166', '#e63946', '#00b4d8', '#9b5de5'][row],
      stripes: true, trousers: () => '#222', hat: row => row === 5 ? 'gorra' : row === 1 ? 'barret' : null }
  };

  function collaBackground(ctx, w, h, f, st, look, s, ground) {
    if (look === 'colors') {
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
    } else if (look === 'uniforme') {
      // Carrer de nit: façanes fosques amb finestres enceses i una garlanda de bombetes que bateguen amb els greus.
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0b1230'); sky.addColorStop(1, '#2a1f4a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff8d6'; ctx.beginPath(); ctx.arc(w * .85, h * .12, s * .045, 0, Math.PI * 2); ctx.fill();
      for (let i = 0, x = -s * .05; x < w; i++) {
        const bw = s * (.18 + (i * 37 % 10) / 45), bh = s * (.25 + (i * 53 % 10) / 35);
        ctx.fillStyle = ['#1c1b3a', '#24204a', '#191832'][i % 3]; ctx.fillRect(x, ground - bh, bw, bh + 2);
        for (let wx = x + bw * .15, a = 0; wx < x + bw * .8; wx += bw * .3) for (let wy = ground - bh + bh * .12; wy < ground - bh * .25; wy += bh * .25, a++) {
          ctx.fillStyle = (i * 7 + a * 3) % 5 < 3 ? '#ffd27a' : '#2e2a55'; ctx.fillRect(wx, wy, bw * .15, bh * .13);
        }
        x += bw;
      }
      for (const [y0, sag] of [[.17, .08], [.25, .06]]) {
        ctx.strokeStyle = '#111'; ctx.lineWidth = s * .003; ctx.beginPath(); ctx.moveTo(0, h * y0); ctx.quadraticCurveTo(w / 2, h * (y0 + sag * 2), w, h * y0); ctx.stroke();
        for (let k = 0; k < 22; k++) {
          const tt = (k + .5) / 22, x = tt * w, y = h * y0 + h * sag * 4 * tt * (1 - tt) + s * .008, hue = ['#ffd23f', '#ff5d8f', '#4cc9f0', '#80ed99'][k % 4];
          const g = ctx.createRadialGradient(x, y, 0, x, y, s * (.02 + f.bass * .02)); g.addColorStop(0, hue); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * (.02 + f.bass * .02), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = hue; ctx.beginPath(); ctx.arc(x, y, s * .006, 0, Math.PI * 2); ctx.fill();
        }
      }
      const floor = ctx.createLinearGradient(0, ground, 0, h); floor.addColorStop(0, '#3a3350'); floor.addColorStop(1, '#5a4d6e');
      ctx.fillStyle = floor; ctx.fillRect(0, ground, w, h - ground);
      ctx.fillStyle = 'rgba(255, 210, 122, .08)';
      for (let y = ground + s * .04; y < h; y += s * .06) ctx.fillRect(0, y, w, s * .005);
    } else {
      // Escenari de festa major: fons morat, focus que s'escombren amb el ritme i taulons de fusta.
      const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2b0a4a'); bg.addColorStop(1, '#6a1b6e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) {
        const x0 = w * (k + .5) / 5, a = Math.PI / 2 + Math.sin(st.sway * .5 + k * 1.3) * .45, len = h * 1.1;
        ctx.fillStyle = `hsla(${(k * 70 + f.t * 20) % 360}, 90%, 65%, ${.08 + f.level * .12})`;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + Math.cos(a - .12) * len, Math.sin(a - .12) * len); ctx.lineTo(x0 + Math.cos(a + .12) * len, Math.sin(a + .12) * len); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffd166'; ctx.font = `${Math.round(s * .05)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, w, h * .035);
      for (let k = 0; k < 30; k++) { ctx.fillStyle = k % 2 ? '#a93226' : '#e74c3c'; ctx.beginPath(); ctx.arc((k + .5) / 30 * w, h * .035, w / 60, 0, Math.PI); ctx.fill(); }
      const floor = ctx.createLinearGradient(0, ground, 0, h); floor.addColorStop(0, '#8a5a32'); floor.addColorStop(1, '#b07a45');
      ctx.fillStyle = floor; ctx.fillRect(0, ground, w, h - ground);
      ctx.strokeStyle = 'rgba(60, 30, 10, .35)'; ctx.lineWidth = s * .003;
      for (let k = -10; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(w / 2 + k * w * .03, ground); ctx.lineTo(w / 2 + k * w * .12, h); ctx.stroke(); }
      for (const p of st.confetti) { p.y += p.v * f.dt; p.x += Math.sin(f.t * 2 + p.ph) * .3; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, s * .008, s * .012); }
      st.confetti = st.confetti.filter(p => p.y < h);
      for (let i = 0; i < Math.round(f.bass * 3); i++) st.confetti.push({ x: Math.random() * w, y: -10, v: s * (.08 + Math.random() * .12), ph: Math.random() * 6, c: ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0'][i % 4] });
    }
  }

  // Un músic dret, amb els peus a (0, 0) i mida u; e = força del cop (1 just quan pica).
  function drawMusician(ctx, u, row, e, f, st, V) {
    const L = LOOKS[row], skin = SKIN[row], hair = HAIR[row], B = V.body;
    const legs = u * .7 * B, top = -(legs + u * 1.8 * B), belly = -legs - u * .55 * B, chest = top + u * .55, shoulderY = top + u * .25;
    const shirt = V.shirt(row);
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = u * .09;
    // Cames, sabates i cos (la samarreta, amb la faixa o les ratlles de la variant).
    ctx.fillStyle = V.trousers(row); ctx.fillRect(-u * .55, -legs, u * .45, legs - u * .05); ctx.fillRect(u * .1, -legs, u * .45, legs - u * .05);
    ctx.fillStyle = '#20151c'; ctx.beginPath(); ctx.ellipse(-u * .38, -u * .05, u * .38, u * .14, 0, 0, Math.PI * 2); ctx.ellipse(u * .38, -u * .05, u * .38, u * .14, 0, 0, Math.PI * 2); ctx.fill();
    const torso = () => { ctx.beginPath(); ctx.moveTo(-u * .9, top); ctx.lineTo(u * .9, top); ctx.quadraticCurveTo(u * 1.25, (top - legs) / 2, u * .95, -legs); ctx.lineTo(-u * .95, -legs); ctx.quadraticCurveTo(-u * 1.25, (top - legs) / 2, -u * .9, top); ctx.closePath(); };
    ctx.fillStyle = shirt; torso(); ctx.fill();
    if (V.stripes || V.sash) {
      ctx.save(); torso(); ctx.clip();
      if (V.stripes) { ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let x = -u * 1.3; x < u * 1.3; x += u * .45) ctx.fillRect(x, top, u * .18, -legs - top); }
      if (V.sash) { ctx.strokeStyle = V.sash(row); ctx.lineWidth = u * .38; ctx.beginPath(); ctx.moveTo(-u * 1, top); ctx.lineTo(u * 1.1, -legs); ctx.stroke(); }
      ctx.restore();
    }
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
    // Cap (més petit a la variant de festa), orelles i pentinat.
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
    // Barret de la variant: gorra, barret de palla o mocador lligat (uniforme, del color de la secció).
    const hat = V.hat(row);
    if (hat === 'gorra') { ctx.fillStyle = '#4a5d23'; ctx.beginPath(); ctx.ellipse(0, hy - hr * .5, hr * .98, hr * .5, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(-hr * .1, hy - hr * .58, hr * 1.25, hr * .14, hr * .07); ctx.fill(); ctx.stroke(); }
    else if (hat === 'barret') { ctx.fillStyle = '#f2e8cf'; ctx.beginPath(); ctx.ellipse(0, hy - hr * .6, hr * 1.25, hr * .18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(-hr * .6, hy - hr * 1.15, hr * 1.2, hr * .55, hr * .15); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.fillRect(-hr * .6, hy - hr * .75, hr * 1.2, hr * .12); }
    else if (hat === 'mocador') {
      ctx.fillStyle = V.sash(row); ctx.save(); head(); ctx.clip(); ctx.fillRect(-hr * 1.1, hy - hr * 1.05, hr * 2.2, hr * .5); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = u * .06; ctx.beginPath(); ctx.moveTo(-hr * .99, hy - hr * .55); ctx.lineTo(hr * .99, hy - hr * .55); ctx.stroke();
      ctx.fillStyle = V.sash(row); for (const a of [.5, -.2]) { ctx.save(); ctx.translate(hr * 1.02, hy - hr * .6); ctx.rotate(a + Math.sin(st.sway * 2) * .15); ctx.beginPath(); ctx.ellipse(hr * .25, 0, hr * .25, hr * .1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
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
      collaBackground(ctx, w, h, f, st, look, s, ground);
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
        if (V.bubble === 'star') {
          ctx.rotate(-.08 * b.side); ctx.beginPath();
          for (let k = 0; k < 22; k++) { const a = k * Math.PI / 11, r = k % 2 ? .78 : 1; ctx.lineTo(Math.cos(a) * tw * .62 * r, Math.sin(a) * th * .85 * r); }
          ctx.closePath(); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, th * .45);
          ctx.moveTo(b.side * tw * .12, th / 2 - 1); ctx.lineTo(b.side * tw * .32, th / 2 + b.u * .55); ctx.lineTo(b.side * tw * .3 - b.side * b.u * .35, th / 2 - 1);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillRect(b.side * tw * .14 - b.u * .25, th / 2 - b.u * .1, b.u * .5, b.u * .14);
        }
        ctx.fillStyle = `hsl(${hueOf(b.row)}, 80%, 35%)`; ctx.fillText(b.word, 0, b.u * .03);
        ctx.restore();
      }
    }
  });

  // ── Dissenys ──────────────────────────────────────────────────────────
  // draw(ctx, w, h, frame, state): frame = { t, dt, bass, mid, high, level, hits: [{ row, age }] (cops dels últims 0,9 s),
  // fresh (els cops que acaben de començar en aquest fotograma), names };
  // state és la memòria entre fotogrames (cada disseny hi guarda la seva sota el seu nom).
  const DESIGNS = {
    // Tres propostes de la colla (se n'ha de triar una).
    colla: collaDesign('Colla: samarretes a la plaça', 'colors'),
    uniforme: collaDesign('Colla: uniformada de nit', 'uniforme'),
    festa: collaDesign('Colla: festa a l’escenari', 'festa'),

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
    ui.bar = $('div', { className: 'vtc-bar' }, ui.title, ui.design, ui.format, ui.restart, ui.play, ui.time, ui.record, ui.full, ui.close);
    root.append(canvas, ui.bar, ui.status);
    document.body.append(root);
    ui.play.addEventListener('click', () => (playing ? pause() : play()));
    ui.restart.addEventListener('click', () => { const was = playing; stopSource(); offset = 0; if (was) play(); });
    ui.close.addEventListener('click', close);
    ui.full.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => {}); });
    // Format: el darrer triat o, la primera vegada, el de la pantalla (vertical al mòbil).
    ui.format.value = FORMATS[store.get('vatucalla-format')] ? store.get('vatucalla-format') : innerHeight > innerWidth ? 'portrait' : 'landscape';
    ui.format.addEventListener('change', () => { store.set('vatucalla-format', ui.format.value); if (!recorder) resize(); });
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
    const [w, h] = FORMATS[ui.format.value];
    canvas.width = w; canvas.height = h;
    scene ??= document.createElement('canvas'); scene.width = w; scene.height = h; sceneCtx = scene.getContext('2d');
    sceneCtx.fillStyle = '#06040e'; sceneCtx.fillRect(0, 0, w, h);
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
    design.draw(sceneCtx, scene.width, scene.height, { t, dt, ...bands, hits, fresh, names: song.names }, state);
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
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 256_000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const keep = recorder?.keep; recorder = null;
      ui.record.textContent = '● Grava vídeo'; ui.format.disabled = ui.design.disabled = false;
      if (!keep) { ui.status.textContent = 'Gravació cancel·lada.'; return; }
      const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm', blob = new Blob(chunks, { type: type.split(';')[0] });
      const name = `${(ui.title.value.trim() || 'batucada').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'batucada'} - ${PROJECT.replace('!', '')}.${ext}`;
      const link = $('a', { href: URL.createObjectURL(blob), download: name });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      ui.status.textContent = ext === 'mp4' ? `Vídeo desat: ${name}` : `Vídeo desat en WebM (aquest navegador no grava MP4): ${name}`;
    };
    recorder.keep = false;
    recorder.start(1000);
    ui.record.textContent = '■ Atura i desa'; ui.format.disabled = ui.design.disabled = true;
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
    ui.status.textContent = '';
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
