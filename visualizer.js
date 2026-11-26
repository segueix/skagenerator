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

  // ── Dissenys ──────────────────────────────────────────────────────────
  // draw(ctx, w, h, frame, state): frame = { t, dt, bass, mid, high, level, hits: [{ row, age }] (cops dels últims 0,9 s),
  // fresh (els cops que acaben de començar en aquest fotograma), names };
  // state és la memòria entre fotogrames (cada disseny hi guarda la seva sota el seu nom).
  const DESIGNS = {
    infinit: {
      name: 'Infinit',
      // Lemniscata de Bernoulli (∞): diverses cintes de colors que giren i bateguen amb els greus; cada cop
      // d'instrument fa un esclat del seu color en el seu punt de la corba, que hi corre per sobre.
      draw(ctx, w, h, f, state) {
        // (En vertical, una mica més petit: les cintes no surten tant pels costats quan bateguen.)
        const s = Math.min(w, h) * (w < h ? .86 : 1), cx = w / 2, cy = h / 2;
        // Rastre: cada fotograma esborra una mica l'anterior (formes que no s'acaben mai).
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(6, 4, 14, ${0.16 + 0.1 * (1 - f.level)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        const curve = (t, scale, twist) => {
          const d = 1 + Math.sin(t) ** 2, x = Math.cos(t) / d, y = Math.sin(t) * Math.cos(t) / d;
          const c = Math.cos(twist), sn = Math.sin(twist);
          return [cx + scale * (x * c - y * sn), cy + scale * (x * sn + y * c)];
        };
        const layers = 7, pulse = 1 + f.bass * 0.35;
        for (let k = 0; k < layers; k++) {
          const scale = s * (0.36 + k * 0.022) * pulse, twist = f.t * (0.05 + k * 0.012) * (k % 2 ? -1 : 1);
          const hue = (f.t * 24 + k * 34) % 360;
          ctx.strokeStyle = `hsla(${hue}, 95%, ${48 + f.mid * 22}%, ${0.18 + f.level * 0.35})`;
          ctx.lineWidth = s * (0.002 + f.mid * 0.006) * (1 + k * 0.15);
          ctx.beginPath();
          for (let i = 0; i <= 240; i++) {
            const t = (i / 240) * Math.PI * 2, wobble = 1 + 0.06 * Math.sin(t * (3 + k) + f.t * 2) * (0.3 + f.high);
            const [x, y] = curve(t, scale * wobble, twist);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        // Esclats: cada instrument té el seu lloc a la corba; el cop hi corre i s'esvaeix.
        for (const hit of f.hits) {
          const life = 1 - hit.age / 0.9;
          if (life <= 0) continue;
          const t = (hit.row / 12) * Math.PI * 2 + f.t * 0.6 + hit.age * 2.2;
          const [x, y] = curve(t, s * 0.4 * pulse, f.t * 0.05);
          const r = s * (0.015 + (1 - life) * 0.09);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `hsla(${hueOf(hit.row)}, 100%, 70%, ${0.9 * life})`);
          g.addColorStop(1, `hsla(${hueOf(hit.row)}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // Espurnes dels aguts.
        for (const p of state.sparks) {
          p.x += p.vx * f.dt; p.y += p.vy * f.dt; p.life -= f.dt;
          ctx.fillStyle = `hsla(${p.hue}, 100%, 75%, ${Math.max(0, p.life)})`;
          ctx.fillRect(p.x, p.y, s * 0.004, s * 0.004);
        }
        state.sparks = state.sparks.filter(p => p.life > 0);
        for (let i = 0; i < Math.round(f.high * 6); i++) {
          const a = Math.random() * Math.PI * 2, v = s * (0.1 + Math.random() * 0.3);
          state.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, hue: (f.t * 40 + Math.random() * 120) % 360 });
        }
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
    const design = DESIGNS[ui.design.value] || DESIGNS.infinit;
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
