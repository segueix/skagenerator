// Música de fons original generada al dispositiu: la de Matxa Ràdio a la TV i
// la que acompanya la veu a tota l'app (musicafons.js).
(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ElTaulerRadioAmbient = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
    'use strict';
    // 'music': a cada partida sona una melodia triada a l'atzar. Els sons
    // antics (aire d'estudi, ràdio clàssica i sintonia fixa) es llegeixen com
    // a música.
    const SOUNDS = ['off', 'music'];
    const LEGACY_SOUNDS = ['studio', 'tuning', 'theme'];
    function normalize(raw) {
        const r = raw || {};
        const sound = SOUNDS.includes(r.sound) ? r.sound : (LEGACY_SOUNDS.includes(r.sound) ? 'music' : 'off');
        return { sound,
            volume: typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.max(0, Math.min(100, r.volume)) : 20 };
    }
    function canPlay(s) {
        return !!(s && s.matxa && s.profile === 'radio' && s.voiceOn && s.engine === 'neural'
            && !s.blocked && s.open && s.visible && !s.hidden && !s.paused && !s.error);
    }
    // Totes les melodies duren 32 s i es repeteixen sense tall.
    const THEME_SECONDS = 32;
    const MELODY_SECONDS = 32;
    const MELODIES = [
        { id: 'theme', name: 'Sintonia suau', description: 'piano elèctric, baix i escombretes' },
        { id: 'oriental', name: 'Jardí oriental', description: 'koto, flauta de bambú i campana de temple en escala pentatònica japonesa' },
        { id: 'bossa', name: 'Bossa del tauler', description: 'guitarra de niló, flauta i percussió de bossa nova' },
        { id: 'vals', name: 'Vals de la capsa de música', description: 'capsa de música, pizzicato i cordes en tres temps' },
        { id: 'capvespre', name: 'Capvespre', description: 'arpa, cordes i campanetes en calma' },
        { id: 'havanera', name: 'Havanera del port', description: 'acordió, guitarra i baix amb el ritme d’havanera' },
        { id: 'celta', name: 'Dansa celta', description: 'xiulet, arpa, bordó i bodhran en sis per vuit' },
        { id: 'nocturn', name: 'Nocturn', description: 'piano en arpegis i cordes suaus' },
        { id: 'marimba', name: 'Illa de marimba', description: 'marimba, steel drum, baix i maraca de calipso' },
        { id: 'lofi', name: 'Estudi lo-fi', description: 'piano elèctric, bateria mandrosa i cruixit de vinil' }
    ];
    function melodyId(id) {
        if (parseComposedId(id)) return String(id);
        return MELODIES.some(m => m.id === id) ? id : MELODIES[0].id;
    }
    function melodyInfo(id) {
        const spec = composedLoopSpec(id);
        if (spec) return { id: String(id), name: jingleTitle(spec), description: 'composta ara per l’app', composed: true, style: spec.style, seed: spec.seed };
        return MELODIES.find(m => m.id === melodyId(id));
    }
    // Una melodia a l'atzar per a cada partida; si n'hi ha més d'una, mai la
    // mateixa que la partida anterior.
    function pickMelody(random = Math.random, previous = null) {
        const pool = MELODIES.filter(m => m.id !== previous);
        const list = pool.length ? pool : MELODIES;
        const r = Math.max(0, Math.min(0.999999, Number(random()) || 0));
        return list[Math.floor(r * list.length)].id;
    }

    // ── Sintonia suau ────────────────────────────────────────────────────
    // Una peça curta i tranquil·la de ràdio, sintetitzada aquí mateix: piano
    // elèctric, coixí d'acords, baix, un motiu de vibràfon i percussió
    // d'escombretes. Vuit compassos a 60 ppm (32 s) en do major:
    // Fa7M · Mi m7 · Re m7 · Do7M · Fa7M · Mi m7 · Re m7 · Sol7sus4.
    // Tot s'escriu en un bucle circular (les cues de l'últim compàs continuen
    // al principi), de manera que la repetició no té cap tall ni cap forat.
    // Els timbres porten harmònics a la zona de 200-2000 Hz perquè se sentin
    // en altaveus petits (mòbil, portàtil) sense tapar la veu.
    const THEME = {
        beat: 1,          // 60 ppm: una negra per segon
        swing: 0.06,      // corxeres lleugerament endarrerides
        chords: [
            { bass: 41, notes: [57, 60, 64, 67] },   // Fa7M(9)
            { bass: 40, notes: [55, 59, 62, 64] },   // Mi m7
            { bass: 38, notes: [53, 57, 60, 64] },   // Re m7(9)
            { bass: 36, notes: [52, 55, 59, 62] },   // Do7M(9)
            { bass: 41, notes: [57, 60, 64, 67] },
            { bass: 40, notes: [55, 59, 62, 64] },
            { bass: 38, notes: [53, 57, 60, 64] },
            { bass: 43, notes: [53, 57, 60, 62] }    // Sol7sus4(9)
        ],
        // Motiu de vibràfon (compàs, temps, nota MIDI, durada): pentatònica de do.
        melody: [
            [0, 0.5, 76, 1], [0, 1, 79, 1], [0, 1.5, 81, 1.5], [0, 2.5, 79, 2],
            [1, 0.5, 76, 1], [1, 1.5, 74, 3],
            [4, 0.5, 76, 1], [4, 1, 79, 1], [4, 1.5, 84, 1.5], [4, 2.5, 81, 2],
            [5, 0.5, 79, 1], [5, 1.5, 76, 3],
            [7, 2, 74, 1], [7, 3, 76, 1.5]
        ]
    };
    const TABLE_SIZE = 4096;
    const SINE = new Float32Array(TABLE_SIZE + 1);
    for (let i = 0; i <= TABLE_SIZE; i++) SINE[i] = Math.sin(2 * Math.PI * i / TABLE_SIZE);
    // Sinus per taula (fase en cicles, sempre positiva i petita): ràpid i
    // prou fi per a un fons. La part entera es descarta amb una màscara.
    function sin1(phase) {
        const x = phase * TABLE_SIZE, i = x | 0, k = i & (TABLE_SIZE - 1);
        return SINE[k] + (SINE[k + 1] - SINE[k]) * (x - i);
    }
    function midiHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

    // Instruments que escriuen sobre un bucle circular de `seconds` segons.
    // Cada instrument té el seu bucle amb variables locals (res de clausures
    // per sample) i les envolupants es calculen multiplicant (sense cap exp
    // per sample). L'índex dona la volta (j - length) perquè les cues del
    // final sonin sobre el principi.
    function createSynth(sampleRate, seconds, random) {
        const sr = sampleRate, length = sr * seconds, data = new Float32Array(length);
        // Factor per sample d'una caiguda exponencial de constant `tau` (s).
        const decay = (tau) => Math.exp(-1 / (sr * tau));
        const at = (sec) => ((Math.round(sec * sr) % length) + length) % length;

        // Piano elèctric (FM 1:1 amb un toc de llengüeta a l'atac).
        function epiano(start, midi, vel) {
            const f = midiHz(midi) / sr, kA = decay(0.004), kE = decay(1.1), kI = decay(0.3), kT = decay(0.09);
            const n = Math.round(2.2 * sr);
            let j = at(start), atk = 1, env = vel * 0.2, ix = 1.4, tn = 0.2;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                atk *= kA; env *= kE; ix *= kI; tn *= kT;
                const p = f * i;
                const body = sin1(p + (ix + 0.25) * sin1(p) * 0.159);
                data[j] += (1 - atk) * env * (tn > 0.002 ? body + tn * sin1(p * 4.02) : body);
            }
        }
        // Coixí: dos osciŀladors lleugerament desafinats, amb el segon harmònic.
        function pad(start, midi, dur, level = 0.024, attackSec = 0.8) {
            const fa = midiHz(midi) * 1.003 / sr, fb = midiHz(midi) * 0.997 / sr, kR = decay(0.3);
            const aN = Math.round(attackSec * sr), hold = Math.round(dur * sr), n = hold + Math.round(0.9 * sr);
            let j = at(start), rel = level;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                const attack = i < aN ? (1 - Math.cos(Math.PI * i / aN)) / 2 : 1;
                if (i > hold) rel *= kR;
                data[j] += attack * rel * (sin1(fa * i) + sin1(fb * i + 0.3) + 0.6 * sin1(2 * fa * i + 0.6));
            }
        }
        // Cordes: com el coixí, però amb més harmònics i un vibrato lent.
        function strings(start, midi, dur, level = 0.018, attackSec = 0.7) {
            const f = midiHz(midi) / sr, vr = 4.6 / sr, kR = decay(0.4);
            const aN = Math.round(attackSec * sr), hold = Math.round(dur * sr), n = hold + Math.round(1.4 * sr);
            let j = at(start), rel = level, pa = 0, pb = 0.37;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                const attack = i < aN ? (1 - Math.cos(Math.PI * i / aN)) / 2 : 1;
                if (i > hold) rel *= kR;
                const vib = 1 + 0.0025 * sin1(vr * i);
                pa += f * 1.002 * vib; pb += f * 0.998 * vib;
                const s1 = sin1(pa), c2 = 2 * sin1(pa + 0.25), s2 = c2 * s1, s3 = c2 * s2 - s1, s4 = c2 * s3 - s2;
                data[j] += attack * rel * (s1 + sin1(pb) + 0.5 * s2 + 0.32 * s3 + 0.2 * s4);
            }
        }
        // Baix rodó amb harmònics (perquè s'intueixi també en altaveus petits).
        function bass(start, midi, vel, tau = 0.75) {
            const f = midiHz(midi) / sr, kA = decay(0.008), kE = decay(tau), n = Math.round(Math.max(1.8, tau * 2.4) * sr);
            let j = at(start), atk = 1, env = vel * 0.11;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                atk *= kA; env *= kE;
                const p = f * i;
                data[j] += (1 - atk) * env * (0.7 * sin1(p) + 0.55 * sin1(2 * p) + 0.32 * sin1(3 * p) + 0.15 * sin1(4 * p));
            }
        }
        // Vibràfon: parcial fonamental i el quart parcial (≈ 4 × f), amb trèmolo.
        function vibes(start, midi, dur) {
            const f = midiHz(midi) / sr, tr = 5.2 / sr, kA = decay(0.003), kE = decay(1.4), kP = decay(0.25), kR = decay(0.3);
            const hold = Math.round(dur * sr), n = hold + Math.round(1.2 * sr);
            let j = at(start), atk = 1, env = 0.12, part = 0.22, rel = 1;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                atk *= kA; env *= kE; part *= kP;
                if (i > hold) rel *= kR;
                const trem = 1 - 0.18 * (0.5 + 0.5 * sin1(tr * i));
                data[j] += (1 - atk) * env * rel * trem * (sin1(f * i) + part * sin1(3.93 * f * i));
            }
        }
        // Bombo suau: sinus amb el to que cau de pressa.
        function kick(start, vel, base = 48) {
            const kE = decay(0.16), kP = decay(0.045), n = Math.round(0.42 * sr);
            let j = at(start), phase = 0, env = vel * 0.16, sweep = 70;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                sweep *= kP; env *= kE;
                phase += (base + sweep) / sr;
                data[j] += env * sin1(phase);
            }
        }
        // Escombreta (cop de caixa amb raspall) i maraca: soroll filtrat.
        function brush(start, vel, tau, bright) {
            const a = bright ? 0.55 : 0.25, kA = decay(0.002), kE = decay(tau), n = Math.round(tau * 6 * sr);
            let j = at(start), lp = 0, hp = 0, prev = 0, atk = 1, env = vel * 0.22;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                lp += a * ((random() * 2 - 1) - lp);
                hp = 0.92 * (hp + lp - prev); prev = lp;
                atk *= kA; env *= kE;
                data[j] += (1 - atk) * env * hp;
            }
        }
        // Corda pinçada (koto, guitarra de niló, arpa, pizzicato): parcials
        // harmònics que s'apaguen més de pressa com més aguts són, amb una
        // entrada de to opcional (cents per sota) i un vibrato que apareix tard.
        function pluck(start, midi, vel, o) {
            const p = o || {};
            const f0 = midiHz(midi) / sr, tau = p.decay || 1.2;
            const parts = p.partials || [1, 0.45, 0.25, 0.12];
            const K = parts.length, env = new Float64Array(K), ks = new Float64Array(K);
            for (let k = 0; k < K; k++) {
                env[k] = parts[k] * vel * (p.gain || 0.14);
                ks[k] = decay(tau / (1 + k * (p.damp === undefined ? 0.8 : p.damp)));
            }
            const n = Math.round((p.len || tau * 3.2) * sr), kA = decay(p.attack || 0.0025), kB = decay(0.07);
            const vr = (p.vibRate || 5.5) / sr, vd = (p.vib || 0) / 12 * 0.693, vOn = 0.3 * sr;
            let j = at(start), atk = 1, bend = (p.bend || 0) / 1200 * 0.693, ph = 0, live = K;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                // Els parcials aguts s'apaguen abans: es deixen de calcular.
                if ((i & 255) === 0) { while (live > 1 && env[live - 1] < 2e-5) live--; if (env[0] < 2e-5) break; }
                atk *= kA; bend *= kB;
                const vib = vd ? vd * Math.min(1, i / vOn) * sin1(vr * i + 0.75) : 0;
                ph += f0 * (1 + vib - bend);
                // sin((k+1)·x) per recurrència: dues consultes a la taula per
                // sample, sigui quin sigui el nombre de parcials.
                const s1 = sin1(ph), c2 = 2 * sin1(ph + 0.25);
                env[0] *= ks[0];
                let sum = env[0] * s1, prev2 = 0, prev1 = s1;
                for (let k = 1; k < live; k++) {
                    const sk = c2 * prev1 - prev2;
                    prev2 = prev1; prev1 = sk;
                    env[k] *= ks[k]; sum += env[k] * sk;
                }
                data[j] += (1 - atk) * sum;
            }
        }
        // Metalls: síntesi harmònica amb atac d’alè i obertura gradual.
        function brass(start, midi, dur, vel, kind) {
            const trumpet = kind === 'trumpet', f = midiHz(midi) / sr;
            const hold = Math.max(0.05, dur), release = trumpet ? 0.09 : 0.14;
            const count = Math.round((hold + release) * sr), attack = trumpet ? 0.018 : 0.045;
            let j = at(start), phase = 0;
            for (let i = 0; i < count; i++, j++) {
                if (j >= length) j -= length;
                const t = i / sr;
                const envelope = Math.min(1, t / attack) * (t <= hold ? 1 : Math.max(0, 1 - (t - hold) / release));
                const vibrato = Math.min(1, t / 0.25) * 0.0025 * sin1(t * (trumpet ? 5.4 : 4.7));
                phase += f * (1 + vibrato);
                const brightness = Math.min(1, t / 0.065);
                const tone = sin1(phase) + (trumpet ? 0.72 : 0.48) * sin1(phase * 2)
                    + brightness * ((trumpet ? 0.48 : 0.22) * sin1(phase * 3) + 0.16 * sin1(phase * 4));
                data[j] += envelope * vel * (trumpet ? 0.048 : 0.062) * tone;
            }
        }
        // Flauta (de bambú o travessera): fonamental amb dos harmònics, alè
        // filtrat, entrada lliscada opcional i vibrato que creix.
        function flute(start, midi, dur, vel, o) {
            const p = o || {};
            const f0 = midiHz(midi) / sr, vr = (p.vibRate || 5) / sr, vd = (p.vib === undefined ? 0.2 : p.vib) / 12 * 0.693;
            const aN = Math.round((p.attack || 0.09) * sr), hold = Math.round(dur * sr), n = hold + Math.round(0.6 * sr);
            const kR = decay(p.release || 0.12), kS = decay(0.06), breath = p.breath === undefined ? 0.12 : p.breath;
            let j = at(start), rel = vel * (p.gain || 0.1), slide = (p.slide || 0) / 1200 * 0.693, ph = 0, lp = 0, hp = 0, prev = 0;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                const attack = i < aN ? (1 - Math.cos(Math.PI * i / aN)) / 2 : 1;
                if (i > hold) rel *= kR;
                slide *= kS;
                const grow = Math.min(1, i / (0.4 * sr));
                ph += f0 * (1 + vd * grow * sin1(vr * i) + slide);
                lp += 0.3 * ((random() * 2 - 1) - lp);
                hp = 0.85 * (hp + lp - prev); prev = lp;
                const tone = sin1(ph) + 0.22 * sin1(2 * ph + 0.1) + 0.07 * sin1(3 * ph + 0.2);
                data[j] += attack * rel * (tone + breath * hp * (0.6 + 0.4 * (1 - grow)));
            }
        }
        // Percussió afinada amb parcials inharmònics: campana de temple,
        // capsa de música, celesta i campanetes.
        function struck(start, midi, vel, ratios, amps, taus, o) {
            const p = o || {};
            const f0 = midiHz(midi) / sr, K = ratios.length;
            const env = new Float64Array(K), ks = new Float64Array(K);
            // Cap parcial per sobre de Nyquist (sonaria com un xiulet replegat).
            for (let k = 0; k < K; k++) { env[k] = f0 * ratios[k] < 0.45 ? amps[k] * vel * (p.gain || 0.1) : 0; ks[k] = decay(taus[k]); }
            const n = Math.round((p.len || Math.max(...taus) * 3.5) * sr), kA = decay(p.attack || 0.0015);
            const tr = (p.trem || 0) / sr;
            let j = at(start), atk = 1, live = K;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                if ((i & 255) === 0) { while (live > 1 && env[live - 1] < 2e-5) live--; if (live === 1 && env[0] < 2e-5) break; }
                atk *= kA;
                let sum = 0;
                for (let k = 0; k < live; k++) { env[k] *= ks[k]; sum += env[k] * sin1(f0 * ratios[k] * i + k * 0.13); }
                data[j] += (1 - atk) * (tr ? sum * (1 - 0.15 * (0.5 + 0.5 * sin1(tr * i))) : sum);
            }
        }
        // Bloc de fusta, cop de vora i tambor de mà: sinus esmorteït amb un
        // bri de soroll a l'atac.
        function block(start, vel, hz, tau, noise = 0.2) {
            const f = hz / sr, kE = decay(tau), kN = decay(0.004), kA = decay(0.0008), n = Math.round(tau * 7 * sr);
            let j = at(start), env = vel * 0.12, nz = noise, atk = 1, lp = 0;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                env *= kE; nz *= kN; atk *= kA;
                lp += 0.5 * ((random() * 2 - 1) - lp);
                data[j] += (1 - atk) * env * (sin1(f * i) + nz * lp);
            }
        }
        // Acordió: dues llengüetes desafinades (musette) amb molts harmònics i
        // una manxa que respira.
        function reed(start, midi, dur, vel, o) {
            const p = o || {};
            const f = midiHz(midi) / sr, cents = (p.detune === undefined ? 7 : p.detune) / 1200 * 0.693;
            const aN = Math.round((p.attack || 0.05) * sr), hold = Math.round(dur * sr), n = hold + Math.round(0.5 * sr);
            const kR = decay(p.release || 0.08), sw = 1.3 / sr;
            let j = at(start), rel = vel * (p.gain || 0.05), pa = 0, pb = 0.21;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                const attack = i < aN ? (1 - Math.cos(Math.PI * i / aN)) / 2 : 1;
                if (i > hold) rel *= kR;
                pa += f * (1 + cents); pb += f * (1 - cents);
                const a1 = sin1(pa), ca = 2 * sin1(pa + 0.25), a2 = ca * a1, a3 = ca * a2 - a1, a4 = ca * a3 - a2;
                const b1 = sin1(pb), cb = 2 * sin1(pb + 0.25), b2 = cb * b1, b3 = cb * b2 - b1;
                const swell = 1 - 0.08 * sin1(sw * i);
                data[j] += attack * rel * swell * (a1 + 0.55 * a2 + 0.4 * a3 + 0.22 * a4 + b1 + 0.5 * b2 + 0.35 * b3);
            }
        }
        // Cruixit de vinil: un fil de soroll i petits espetecs a l'atzar.
        function crackle(start, dur, level) {
            const n = Math.round(dur * sr), kC = decay(0.0012);
            let j = at(start), lp = 0, hp = 0, prev = 0, click = 0;
            for (let i = 0; i < n; i++, j++) {
                if (j >= length) j -= length;
                const r = random();
                if (r < 7 / sr) click = (random() < 0.5 ? -1 : 1) * (0.4 + 0.6 * random());
                click *= kC;
                lp += 0.35 * ((random() * 2 - 1) - lp);
                hp = 0.9 * (hp + lp - prev); prev = lp;
                data[j] += level * (0.25 * hp + click);
            }
        }
        // Marge fix: el pic queda per sota de 0,72 i el volum mitjà és el de
        // la sintonia suau, perquè totes les melodies sonin igual de fort.
        function finish(targetRms) {
            let peak = 0, sum = 0;
            for (let i = 0; i < length; i++) { const v = data[i]; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
            const rms = Math.sqrt(sum / length);
            let k = peak > 0 ? 0.72 / peak : 0;
            if (targetRms && rms > 0) k = Math.min(k, targetRms / rms);
            for (let i = 0; i < length; i++) data[i] *= k;
            return data;
        }
        return { sr, length, data, epiano, pad, strings, bass, vibes, kick, brush, pluck, flute, struck, block, reed, crackle, brass, finish };
    }

    function themeScore(syn) {
        const { epiano, pad, bass, vibes, kick, brush } = syn;
        const beat = THEME.beat, bar = beat * 4, sw = THEME.swing;
        THEME.chords.forEach((chord, b) => {
            const t0 = b * bar;
            chord.notes.forEach((n) => pad(t0, n, bar));
            chord.notes.forEach((n, j) => {
                epiano(t0 + j * 0.012, n + 12, 0.85);
                epiano(t0 + 1.5 * beat + sw + j * 0.01, n + 12, 0.45);
                if (j >= 2) epiano(t0 + 3 * beat, n + 12, 0.34);
            });
            bass(t0, chord.bass, 1);
            bass(t0 + 2 * beat, chord.bass + 7, 0.75);
            bass(t0 + 3.5 * beat + sw, chord.bass + 12, 0.5);
            kick(t0, 1);
            kick(t0 + 2 * beat, 0.7);
            brush(t0 + beat, 0.8, 0.09, false);
            brush(t0 + 3 * beat, 0.8, 0.09, false);
            for (let e = 0; e < 8; e++) {
                const off = e % 2 ? sw : 0;
                brush(t0 + e * beat / 2 + off, e % 2 ? 0.55 : 0.32, 0.022, true);
            }
        });
        THEME.melody.forEach(([b, at, n, dur]) => vibes(b * bar + at * beat, n, dur * beat));
        // La sintonia només s'ajusta pel pic (és la referència de volum).
        return null;
    }
    // Volum mitjà de referència (el de la sintonia suau amb el pic a 0,72).
    const TARGET_RMS = 0.105;

    // ── Jardí oriental ───────────────────────────────────────────────────
    // Escala japonesa «in» (miyako-bushi) sobre re: re · mi♭ · sol · la · si♭.
    // Koto amb arpegis i notes doblegades, flauta de bambú (shakuhachi) amb
    // entrades lliscades, bordó de quinta buida, campana de temple i bloc de
    // fusta. Deu compassos de 3,2 s (75 ppm).
    const ORIENTAL = {
        beat: 0.8,
        // Arpegis de koto per compàs: [corxera, nota]. Notes de l'escala in.
        koto: [
            [[0, 62], [1, 69], [2, 74], [3, 70], [4, 69], [6, 67], [7, 63]],
            [[0, 62], [2, 67], [3, 69], [4, 74], [5, 75], [6, 74]],
            [[0, 57], [1, 62], [2, 67], [3, 69], [4, 70], [6, 69], [7, 67]],
            [[0, 63], [2, 62], [3, 57], [4, 55], [6, 57]],
            [[0, 62], [1, 69], [2, 74], [3, 75], [4, 79], [6, 75], [7, 74]],
            [[0, 62], [1, 67], [2, 70], [3, 69], [4, 67], [6, 63]],
            [[0, 55], [1, 62], [2, 63], [3, 67], [4, 69], [5, 70], [6, 74]],
            [[0, 75], [1, 74], [2, 70], [3, 69], [4, 67], [6, 63], [7, 62]],
            [[0, 57], [2, 62], [3, 63], [4, 67], [6, 69]],
            [[0, 62], [2, 69], [4, 63], [5, 62], [6, 57]]
        ],
        // Flauta: [compàs, temps, nota, durada en temps, lliscada en cents].
        flute: [
            [0, 1, 74, 2.5, -80], [1, 0, 75, 1, 0], [1, 1, 74, 2, -40], [1, 3, 70, 1, 0],
            [2, 0, 69, 3, -60], [3, 0, 67, 1.5, 0], [3, 1.5, 69, 2.5, -50],
            [5, 1, 79, 2, -90], [5, 3, 75, 1, 0], [6, 0, 74, 3, -40], [6, 3, 75, 1, 0],
            [7, 0, 74, 1, 0], [7, 1, 70, 2, -60], [8, 0, 69, 2, -40], [8, 2, 67, 2, 0],
            [9, 0, 62, 3.5, -70]
        ]
    };
    function orientalScore(syn) {
        const beat = ORIENTAL.beat, bar = beat * 4, eighth = beat / 2;
        const kotoTone = { decay: 1.1, partials: [1, 0.55, 0.3, 0.18, 0.08], damp: 1.1, gain: 0.13 };
        ORIENTAL.koto.forEach((notes, b) => {
            const t0 = b * bar;
            notes.forEach(([e, n], k) => {
                // Algunes notes es doblegen cap amunt (oshi-de) i vibren.
                const bent = (b + k) % 4 === 1;
                syn.pluck(t0 + e * eighth, n, k === 0 ? 1 : 0.75, Object.assign({}, kotoTone,
                    { bend: bent ? 70 : 0, vib: bent ? 0.35 : 0.12, vibRate: 6 }));
            });
            // Bordó de quinta buida (re-la) que no s'atura mai.
            syn.pad(t0, 50, bar, 0.016, 1.2);
            syn.pad(t0, 57, bar, 0.012, 1.2);
            // Bloc de fusta suau al tercer temps, tambor de mà al primer.
            syn.block(t0, 0.9, 140, 0.09, 0.1);
            syn.block(t0 + 2 * beat, 0.45, 920, 0.03, 0.3);
            if (b % 2) syn.block(t0 + 3.5 * beat, 0.3, 980, 0.025, 0.3);
        });
        ORIENTAL.flute.forEach(([b, t, n, dur, slide]) => syn.flute(b * bar + t * beat, n, dur * beat - 0.05, 1,
            { slide, breath: 0.32, vib: 0.28, vibRate: 4.6, attack: 0.14, gain: 0.085, release: 0.18 }));
        // Campana de temple: parcials inharmònics llargs.
        [0, 5].forEach(b => syn.struck(b * bar, 62, 1, [1, 2.01, 2.76, 4.07, 5.4], [1, 0.5, 0.42, 0.22, 0.12],
            [4, 2.5, 1.8, 1.1, 0.7], { gain: 0.07, len: 8 }));
        return TARGET_RMS;
    }

    // ── Bossa del tauler ─────────────────────────────────────────────────
    // Bossa nova a 120 ppm: guitarra de niló amb el polze al baix i els acords
    // sincopats, flauta, maraca en semicorxeres i cop de vora seguint la
    // clave. Setze compassos de 2 s: Re m9 · Sol13 · Do7M(9) · La7(♭13), dues voltes.
    const BOSSA = {
        beat: 0.5,
        chords: [
            { root: 38, fifth: 45, notes: [53, 57, 60, 64] },   // Re m9
            { root: 43, fifth: 38, notes: [53, 59, 64, 65] },   // Sol13
            { root: 36, fifth: 43, notes: [52, 55, 59, 62] },   // Do7M(9)
            { root: 45, fifth: 40, notes: [55, 61, 65, 67] }    // La7(♭13)
        ],
        // Cops d'acord per compàs (en corxeres): patró de dos compassos.
        comp: [[0, 3, 6], [2, 5]],
        clave: [[0, 3, 6], [2, 4]],
        // Melodia de flauta: [compàs, corxera, nota, durada en corxeres].
        melody: [
            [0, 1, 76, 2], [0, 3, 74, 1], [0, 4, 72, 3], [1, 0, 71, 2], [1, 2, 74, 2], [1, 4, 77, 4],
            [2, 2, 76, 2], [2, 4, 74, 2], [2, 6, 71, 2], [3, 0, 73, 4], [3, 5, 76, 3],
            [4, 1, 77, 2], [4, 3, 76, 1], [4, 4, 74, 3], [5, 0, 72, 2], [5, 2, 71, 2], [5, 4, 67, 4],
            [6, 0, 71, 3], [6, 3, 72, 1], [6, 4, 74, 4], [7, 2, 73, 6],
            [8, 1, 81, 2], [8, 3, 79, 1], [8, 4, 77, 3], [9, 0, 76, 2], [9, 2, 74, 2], [9, 4, 77, 4],
            [10, 2, 79, 2], [10, 4, 76, 2], [10, 6, 74, 2], [11, 0, 73, 3], [11, 4, 69, 4],
            [12, 1, 74, 2], [12, 3, 76, 1], [12, 4, 77, 3], [13, 0, 76, 2], [13, 2, 74, 2], [13, 4, 71, 4],
            [14, 0, 72, 3], [14, 3, 71, 1], [14, 4, 69, 4], [15, 0, 73, 6]
        ]
    };
    function bossaScore(syn) {
        const beat = BOSSA.beat, bar = beat * 4, eighth = beat / 2;
        const nylon = { decay: 0.9, partials: [1, 0.5, 0.28, 0.14], damp: 1.3, gain: 0.1, attack: 0.004 };
        for (let b = 0; b < 16; b++) {
            const t0 = b * bar, chord = BOSSA.chords[b % 4];
            // Polze: fonamental al primer temps i quinta al tercer.
            syn.pluck(t0, chord.root + 12, 1, { decay: 0.8, partials: [1, 0.6, 0.3], damp: 1, gain: 0.12, attack: 0.004 });
            syn.pluck(t0 + 2 * beat, chord.fifth + 12, 0.85, { decay: 0.8, partials: [1, 0.6, 0.3], damp: 1, gain: 0.12, attack: 0.004 });
            syn.bass(t0, chord.root, 0.4, 0.5);
            syn.bass(t0 + 2 * beat, chord.fifth, 0.32, 0.5);
            // Acords rasguejats (cada corda una mica després de l'anterior).
            BOSSA.comp[b % 2].forEach(e => chord.notes.forEach((n, k) =>
                syn.pluck(t0 + e * eighth + k * 0.008, n + 12, 0.55, nylon)));
            // Coixí molt suau perquè mai no quedi buit.
            chord.notes.forEach(n => syn.pad(t0, n, bar, 0.006, 0.4));
            // Maraca (semicorxeres) i cop de vora (clave).
            for (let s16 = 0; s16 < 8; s16++) syn.brush(t0 + s16 * beat / 2, s16 % 2 ? 0.28 : 0.45, 0.018, true);
            BOSSA.clave[b % 2].forEach(e => syn.block(t0 + e * eighth, 0.45, 1750, 0.012, 0.6));
        }
        BOSSA.melody.forEach(([b, e, n, d]) => syn.flute(b * bar + e * eighth, n, d * eighth - 0.03, 0.9,
            { breath: 0.1, vib: 0.18, vibRate: 5.2, attack: 0.05, gain: 0.07 }));
        return TARGET_RMS;
    }

    // ── Vals de la capsa de música ───────────────────────────────────────
    // Tres temps a 90 ppm: capsa de música a la melodia, pizzicato «um-pa-pa»
    // i cordes llargues. Setze compassos de 2 s en sol major.
    const VALS = {
        beat: 2 / 3,
        chords: [
            { root: 43, notes: [59, 62, 67] },   // Sol
            { root: 40, notes: [59, 64, 67] },   // Mi m
            { root: 36, notes: [60, 64, 67] },   // Do
            { root: 38, notes: [60, 62, 66] },   // Re7
            { root: 43, notes: [59, 62, 67] },   // Sol
            { root: 47, notes: [59, 62, 66] },   // Si m
            { root: 36, notes: [60, 64, 67] },   // Do
            { root: 38, notes: [57, 62, 66] },   // Re
            { root: 40, notes: [59, 64, 67] },   // Mi m
            { root: 45, notes: [60, 64, 69] },   // La m
            { root: 38, notes: [60, 62, 66] },   // Re7
            { root: 43, notes: [59, 62, 67] },   // Sol
            { root: 36, notes: [60, 64, 67] },   // Do
            { root: 36, notes: [60, 63, 67] },   // Do m
            { root: 38, notes: [57, 60, 66] },   // Re7
            { root: 43, notes: [59, 62, 67] }    // Sol
        ],
        // [compàs, temps, nota, durada en temps]
        melody: [
            [0, 0, 79, 2], [0, 2, 78, 1], [1, 0, 76, 2], [1, 2, 79, 1], [2, 0, 84, 2], [2, 2, 83, 1], [3, 0, 81, 3],
            [4, 0, 79, 1], [4, 1, 83, 1], [4, 2, 86, 1], [5, 0, 86, 2], [5, 2, 83, 1], [6, 0, 84, 1], [6, 1, 83, 1], [6, 2, 81, 1],
            [7, 0, 78, 3],
            [8, 0, 79, 2], [8, 2, 83, 1], [9, 0, 84, 2], [9, 2, 81, 1], [10, 0, 78, 1], [10, 1, 81, 1], [10, 2, 84, 1],
            [11, 0, 83, 3], [12, 0, 88, 2], [12, 2, 84, 1], [13, 0, 87, 2], [13, 2, 84, 1], [14, 0, 81, 1], [14, 1, 84, 1],
            [14, 2, 78, 1], [15, 0, 79, 2.5]
        ]
    };
    function valsScore(syn) {
        const beat = VALS.beat, bar = beat * 3;
        const pizz = { decay: 0.28, partials: [1, 0.5, 0.3, 0.15], damp: 0.9, gain: 0.13, attack: 0.003 };
        VALS.chords.forEach((chord, b) => {
            const t0 = b * bar;
            syn.pluck(t0, chord.root + 12, 1, Object.assign({}, pizz, { decay: 0.4, gain: 0.16 }));
            syn.bass(t0, chord.root, 0.5, 0.45);
            [1, 2].forEach(t => chord.notes.forEach((n, k) => syn.pluck(t0 + t * beat + k * 0.006, n, t === 1 ? 0.6 : 0.5, pizz)));
            chord.notes.forEach(n => syn.strings(t0, n, bar, 0.0085, 0.6));
        });
        // Capsa de música: llengüetes metàl·liques (parcials 1 · 3 · 5,8 · 9,2).
        VALS.melody.forEach(([b, t, n, d]) => {
            syn.struck(b * bar + t * beat, n, 1, [1, 3.01, 5.8, 9.2], [1, 0.3, 0.12, 0.05], [Math.min(1.6, 0.6 + d * 0.3), 0.5, 0.25, 0.12],
                { gain: 0.11, trem: 0 });
            // Una octava avall, molt suau, per fer-la més rodona.
            syn.struck(b * bar + t * beat + 0.004, n - 12, 0.4, [1, 2.0, 3.0], [1, 0.25, 0.08], [1.2, 0.5, 0.3], { gain: 0.08 });
        });
        return TARGET_RMS;
    }

    // ── Capvespre ────────────────────────────────────────────────────────
    // Ambient tranquil a 60 ppm: cordes amples, arpa en arpegis de corxeres,
    // campanetes esparses i un baix que respira. Vuit compassos de 4 s:
    // La m(9) · Fa7M · Do · Sol/Si · La m · Fa7M · Re m9 · Mi sus4 → Mi.
    const CAPVESPRE = {
        beat: 1,
        chords: [
            { root: 45, pad: [57, 60, 64, 71], arp: [57, 64, 69, 71, 72, 71, 69, 64] },
            { root: 41, pad: [57, 60, 64, 65], arp: [53, 60, 64, 69, 72, 69, 64, 60] },
            { root: 36, pad: [55, 60, 64, 67], arp: [48, 55, 64, 67, 72, 67, 64, 55] },
            { root: 47, pad: [55, 59, 62, 67], arp: [47, 55, 62, 67, 71, 67, 62, 55] },
            { root: 45, pad: [57, 60, 64, 69], arp: [57, 64, 69, 72, 76, 72, 69, 64] },
            { root: 41, pad: [57, 60, 64, 65], arp: [53, 60, 65, 69, 72, 69, 65, 60] },
            { root: 38, pad: [57, 60, 64, 65], arp: [50, 57, 64, 65, 69, 65, 64, 57] },
            { root: 40, pad: [56, 59, 64, 71], arp: [52, 59, 64, 69, 71, 68, 64, 59] }
        ],
        // Campanetes: [compàs, temps, nota]
        bells: [[0, 1, 88], [0, 2.5, 84], [1, 1.5, 81], [2, 0.5, 84], [2, 2, 88], [3, 1, 86], [3, 3, 83],
            [4, 1, 88], [4, 2.5, 91], [5, 1.5, 89], [6, 0.5, 88], [6, 2, 84], [7, 1, 83], [7, 2.5, 80]]
    };
    function capvespreScore(syn) {
        const beat = CAPVESPRE.beat, bar = beat * 4, eighth = beat / 2;
        const harp = { decay: 1.5, partials: [1, 0.35, 0.18, 0.06], damp: 1.4, gain: 0.11, attack: 0.003 };
        CAPVESPRE.chords.forEach((chord, b) => {
            const t0 = b * bar;
            chord.pad.forEach(n => syn.strings(t0, n, bar, 0.011, 1.4));
            chord.arp.forEach((n, k) => syn.pluck(t0 + k * eighth, n + 12, k % 4 === 0 ? 0.9 : 0.65, harp));
            syn.bass(t0, chord.root, 0.7, 1.4);
            syn.bass(t0 + 2.5 * beat, chord.root + 12, 0.35, 0.8);
        });
        CAPVESPRE.bells.forEach(([b, t, n]) => syn.struck(b * bar + t * beat, n, 0.9, [1, 2.76, 5.4], [1, 0.3, 0.1],
            [1.4, 0.6, 0.3], { gain: 0.07, trem: 3.5 }));
        return TARGET_RMS;
    }

    // ── Havanera del port ────────────────────────────────────────────────
    // Dos per quatre a 75 ppm amb el ritme d'havanera al baix (corxera amb
    // punt, semicorxera i dues corxeres), guitarra als contratemps, acordió a
    // la melodia i un coixí d'acordió molt suau. Vint compassos de 1,6 s en
    // re menor.
    const HAVANERA = {
        beat: 0.8,
        harmony: {
            Dm: { bass: [38, 45], notes: [57, 62, 65] },
            A7: { bass: [45, 40], notes: [55, 61, 64] },
            D7: { bass: [38, 45], notes: [57, 60, 66] },
            Gm: { bass: [43, 50], notes: [55, 58, 62] }
        },
        chords: ['Dm', 'Dm', 'A7', 'A7', 'A7', 'A7', 'Dm', 'Dm', 'D7', 'D7',
            'Gm', 'Gm', 'Dm', 'Dm', 'A7', 'A7', 'Gm', 'A7', 'Dm', 'A7'],
        // [compàs, temps, nota, durada en temps]
        melody: [
            [0, 0, 69, 0.75], [0, 0.75, 70, 0.25], [0, 1, 69, 0.5], [0, 1.5, 67, 0.5], [1, 0, 65, 1], [1, 1, 62, 1],
            [2, 0, 64, 0.75], [2, 0.75, 65, 0.25], [2, 1, 67, 0.5], [2, 1.5, 69, 0.5], [3, 0, 73, 1.5], [3, 1.5, 69, 0.5],
            [4, 0, 70, 1 / 3], [4, 1 / 3, 69, 1 / 3], [4, 2 / 3, 67, 1 / 3], [4, 1, 69, 1], [5, 0, 64, 1], [5, 1, 61, 1],
            [6, 0, 62, 0.75], [6, 0.75, 64, 0.25], [6, 1, 65, 0.5], [6, 1.5, 69, 0.5], [7, 0, 74, 2],
            [8, 0, 72, 0.75], [8, 0.75, 74, 0.25], [8, 1, 72, 0.5], [8, 1.5, 69, 0.5], [9, 0, 66, 1], [9, 1, 69, 1],
            [10, 0, 70, 0.75], [10, 0.75, 69, 0.25], [10, 1, 67, 0.5], [10, 1.5, 70, 0.5], [11, 0, 74, 1.5], [11, 1.5, 70, 0.5],
            [12, 0, 69, 0.75], [12, 0.75, 70, 0.25], [12, 1, 69, 0.5], [12, 1.5, 65, 0.5], [13, 0, 62, 1], [13, 1, 65, 1],
            [14, 0, 64, 1 / 3], [14, 1 / 3, 65, 1 / 3], [14, 2 / 3, 67, 1 / 3], [14, 1, 69, 0.5], [14, 1.5, 73, 0.5],
            [15, 0, 76, 1.5], [15, 1.5, 73, 0.5], [16, 0, 74, 0.75], [16, 0.75, 70, 0.25], [16, 1, 67, 1],
            [17, 0, 69, 0.75], [17, 0.75, 67, 0.25], [17, 1, 64, 1], [18, 0, 62, 2],
            [19, 0, 61, 0.5], [19, 0.5, 64, 0.5], [19, 1, 67, 0.5], [19, 1.5, 69, 0.5]
        ]
    };
    function havaneraScore(syn) {
        const beat = HAVANERA.beat, bar = beat * 2;
        const guitar = { decay: 0.45, partials: [1, 0.5, 0.28, 0.14], damp: 1.2, gain: 0.1, attack: 0.004 };
        const thumb = { decay: 0.7, partials: [1, 0.7, 0.45, 0.25], damp: 0.9, gain: 0.08, attack: 0.004 };
        HAVANERA.chords.forEach((name, b) => {
            const t0 = b * bar, chord = HAVANERA.harmony[name], [root, fifth] = chord.bass;
            // Ritme d'havanera al baix.
            [[0, root, 1], [0.75, root, 0.55], [1, fifth, 0.8], [1.5, fifth, 0.6]].forEach(([t, n, v]) => {
                syn.pluck(t0 + t * beat, n + 12, v, thumb);
                syn.bass(t0 + t * beat, n, v * 0.2, 0.35);
            });
            [1, 1.5].forEach(t => chord.notes.forEach((n, k) => syn.pluck(t0 + t * beat + k * 0.01, n + 12, t === 1 ? 0.6 : 0.45, guitar)));
            chord.notes.forEach(n => syn.reed(t0, n, bar, 0.35, { gain: 0.012, attack: 0.25, release: 0.2, detune: 5 }));
            // Pandereta discreta als contratemps.
            syn.brush(t0 + 0.75 * beat, 0.3, 0.03, true);
            syn.brush(t0 + 1.5 * beat, 0.4, 0.03, true);
        });
        HAVANERA.melody.forEach(([b, t, n, d]) => syn.reed(b * bar + t * beat, n + 12, d * beat - 0.04, 1,
            { gain: 0.04, attack: 0.04, release: 0.1 }));
        return TARGET_RMS;
    }

    // ── Dansa celta ──────────────────────────────────────────────────────
    // Sis per vuit (60 negres amb punt per minut): xiulet irlandès a la
    // melodia, arpa en arpegis de corxeres, bordó de re-la i bodhran.
    // Setze compassos de 2 s en re major.
    const CELTA = {
        beat: 1,
        arps: {
            D: [50, 57, 62, 66, 62, 57], G: [43, 50, 55, 59, 55, 50], A: [45, 52, 57, 61, 57, 52],
            Em: [52, 59, 64, 67, 64, 59], Bm: [47, 54, 59, 62, 59, 54]
        },
        chords: ['D', 'G', 'D', 'A', 'D', 'G', 'Em', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'A'],
        // [compàs, corxera, nota, durada en corxeres]
        whistle: [
            [0, 0, 74, 2], [0, 2, 78, 1], [0, 3, 81, 2], [0, 5, 78, 1], [1, 0, 79, 1], [1, 1, 78, 1], [1, 2, 76, 1], [1, 3, 74, 3],
            [2, 0, 78, 2], [2, 2, 81, 1], [2, 3, 86, 2], [2, 5, 83, 1], [3, 0, 81, 3], [3, 3, 76, 2], [3, 5, 78, 1],
            [4, 0, 74, 2], [4, 2, 78, 1], [4, 3, 81, 2], [4, 5, 83, 1], [5, 0, 86, 1], [5, 1, 83, 1], [5, 2, 79, 1], [5, 3, 83, 2], [5, 5, 81, 1],
            [6, 0, 79, 2], [6, 2, 78, 1], [6, 3, 76, 2], [6, 5, 79, 1], [7, 0, 76, 3], [7, 3, 73, 2], [7, 5, 76, 1],
            [8, 0, 78, 2], [8, 2, 74, 1], [8, 3, 71, 2], [8, 5, 74, 1], [9, 0, 79, 2], [9, 2, 83, 1], [9, 3, 86, 3],
            [10, 0, 81, 2], [10, 2, 78, 1], [10, 3, 74, 2], [10, 5, 78, 1], [11, 0, 76, 3], [11, 3, 81, 3],
            [12, 0, 83, 2], [12, 2, 81, 1], [12, 3, 78, 2], [12, 5, 74, 1], [13, 0, 79, 1], [13, 1, 81, 1], [13, 2, 83, 1], [13, 3, 86, 2], [13, 5, 83, 1],
            [14, 0, 81, 2], [14, 2, 79, 1], [14, 3, 76, 2], [14, 5, 73, 1], [15, 0, 76, 3], [15, 3, 69, 1], [15, 4, 71, 1], [15, 5, 73, 1]
        ]
    };
    function celtaScore(syn) {
        const bar = CELTA.beat * 2, eighth = bar / 6;
        const harp = { decay: 1.2, partials: [1, 0.4, 0.2, 0.08], damp: 1.3, gain: 0.1, attack: 0.003 };
        CELTA.chords.forEach((name, b) => {
            const t0 = b * bar;
            CELTA.arps[name].forEach((n, k) => syn.pluck(t0 + k * eighth, n + 12, k % 3 === 0 ? 0.85 : 0.6, harp));
            // Bordó de re-la que no s'atura mai (com una gaita llunyana).
            syn.reed(t0, 50, bar, 0.5, { gain: 0.01, attack: 0.6, release: 0.5, detune: 3 });
            syn.reed(t0, 57, bar, 0.5, { gain: 0.008, attack: 0.6, release: 0.5, detune: 3 });
            // Bodhran: cop greu als dos temps i fregats suaus entremig.
            syn.block(t0, 1, 95, 0.12, 0.45);
            syn.block(t0 + 3 * eighth, 0.75, 105, 0.1, 0.45);
            [2, 5].forEach(e => syn.block(t0 + e * eighth, 0.35, 180, 0.05, 0.6));
        });
        CELTA.whistle.forEach(([b, e, n, d], k) => syn.flute(b * bar + e * eighth, n, d * eighth - 0.03, 1,
            { breath: 0.12, vib: d >= 3 ? 0.22 : 0.08, vibRate: 5.8, attack: 0.03, gain: 0.075, release: 0.08,
                slide: d >= 2 && k % 3 === 0 ? -70 : 0 }));
        return TARGET_RMS;
    }

    // ── Nocturn ──────────────────────────────────────────────────────────
    // Piano a 60 ppm: la mà esquerra en arpegis de corxeres i la dreta
    // cantant, amb un coixí de cordes molt suau. Vuit compassos de 4 s en
    // la♭ major: La♭ · Fa m · Re♭ · Mi♭7 · La♭ · Do m · Si♭ m7 · Mi♭7.
    const NOCTURN = {
        beat: 1,
        chords: [
            { root: 44, arp: [51, 56, 60, 63, 68, 63, 60, 56], pad: [60, 63, 68] },
            { root: 41, arp: [48, 53, 56, 60, 65, 60, 56, 53], pad: [60, 65, 68] },
            { root: 37, arp: [49, 53, 56, 61, 65, 61, 56, 53], pad: [61, 65, 68] },
            { root: 39, arp: [46, 51, 55, 58, 61, 58, 55, 51], pad: [58, 61, 67] },
            { root: 44, arp: [51, 56, 60, 63, 68, 63, 60, 56], pad: [60, 63, 68] },
            { root: 48, arp: [48, 55, 60, 63, 67, 63, 60, 55], pad: [60, 63, 67] },
            { root: 46, arp: [49, 53, 56, 61, 65, 61, 56, 53], pad: [61, 65, 68] },
            { root: 39, arp: [46, 51, 55, 61, 63, 61, 55, 51], pad: [58, 61, 67] }
        ],
        // [compàs, temps, nota, durada en temps]
        melody: [
            [0, 0, 75, 1.5], [0, 1.5, 77, 0.5], [0, 2, 75, 1], [0, 3, 72, 1],
            [1, 0, 77, 2], [1, 2, 80, 1], [1, 3, 77, 1],
            [2, 0, 77, 1.5], [2, 1.5, 75, 0.5], [2, 2, 73, 1], [2, 3, 72, 1],
            [3, 0, 70, 2], [3, 2, 67, 1], [3, 3, 70, 1],
            [4, 0, 72, 1.5], [4, 1.5, 75, 0.5], [4, 2, 80, 1.5], [4, 3.5, 79, 0.5],
            [5, 0, 79, 2], [5, 2, 75, 1], [5, 3, 72, 1],
            [6, 0, 73, 1], [6, 1, 77, 1], [6, 2, 80, 1], [6, 3, 77, 0.5], [6, 3.5, 73, 0.5],
            [7, 0, 72, 1.5], [7, 1.5, 70, 0.5], [7, 2, 67, 1], [7, 3, 70, 1]
        ]
    };
    function nocturnScore(syn) {
        const beat = NOCTURN.beat, bar = beat * 4, eighth = beat / 2;
        const piano = { decay: 2, partials: [1, 0.55, 0.32, 0.22, 0.14, 0.09, 0.05], damp: 0.7, gain: 0.1, attack: 0.005 };
        NOCTURN.chords.forEach((chord, b) => {
            const t0 = b * bar;
            syn.pluck(t0, chord.root, 0.8, Object.assign({}, piano, { decay: 2.6, gain: 0.08 }));
            chord.arp.forEach((n, k) => syn.pluck(t0 + k * eighth, n + 12, k === 0 ? 0.7 : 0.5, piano));
            chord.pad.forEach(n => syn.strings(t0, n, bar, 0.006, 1.6));
        });
                // La mà dreta, una octava amunt i amb menys parcials (cap per sobre
        // de Nyquist).
        NOCTURN.melody.forEach(([b, t, n, d]) => syn.pluck(b * bar + t * beat, n + 12, 0.95,
            Object.assign({}, piano, { partials: [1, 0.5, 0.25, 0.12], decay: 1.4 + 0.4 * d, gain: 0.15, attack: 0.008 })));
        return TARGET_RMS;
    }

    // ── Illa de marimba ──────────────────────────────────────────────────
    // Calipso a 120 ppm: marimba en ostinato de corxeres, steel drum a la
    // melodia, baix pinçat, maraca i bombo suau. Setze compassos de 2 s en
    // fa major.
    const MARIMBA = {
        beat: 0.5,
        harmony: {
            F: { root: 41, notes: [65, 69, 72] }, Bb: { root: 46, notes: [65, 70, 74] },
            C7: { root: 48, notes: [64, 67, 70] }, Dm: { root: 50, notes: [62, 65, 69] }, Gm: { root: 43, notes: [62, 67, 70] }
        },
        chords: ['F', 'Bb', 'C7', 'F', 'F', 'Bb', 'C7', 'F', 'Bb', 'F', 'C7', 'F', 'Dm', 'Gm', 'C7', 'F'],
        ostinato: [0, 2, 1, 2, 0, 2, 1, 2],
        // [compàs, corxera, nota, durada en corxeres]
        melody: [
            [0, 0, 81, 1], [0, 1, 84, 2], [0, 3, 81, 1], [0, 4, 77, 2], [0, 6, 79, 2],
            [1, 0, 82, 1], [1, 1, 86, 2], [1, 3, 82, 1], [1, 4, 77, 2], [1, 6, 74, 2],
            [2, 0, 76, 1], [2, 1, 79, 2], [2, 3, 82, 1], [2, 4, 81, 2], [2, 6, 79, 2],
            [3, 0, 77, 3], [3, 3, 72, 1], [3, 4, 74, 1], [3, 5, 76, 1], [3, 6, 77, 2],
            [4, 0, 81, 1], [4, 1, 84, 2], [4, 3, 86, 1], [4, 4, 84, 2], [4, 6, 81, 2],
            [5, 0, 82, 1], [5, 1, 86, 2], [5, 3, 89, 1], [5, 4, 86, 2], [5, 6, 82, 2],
            [6, 0, 84, 1], [6, 1, 82, 2], [6, 3, 79, 1], [6, 4, 76, 2], [6, 6, 79, 2],
            [7, 0, 77, 4], [7, 5, 81, 1], [7, 6, 84, 2],
            [8, 0, 86, 1], [8, 1, 82, 2], [8, 3, 86, 1], [8, 4, 89, 2], [8, 6, 86, 2],
            [9, 0, 84, 1], [9, 1, 81, 2], [9, 3, 77, 1], [9, 4, 81, 2], [9, 6, 84, 2],
            [10, 0, 82, 1], [10, 1, 79, 2], [10, 3, 76, 1], [10, 4, 79, 2], [10, 6, 82, 2],
            [11, 0, 81, 3], [11, 3, 77, 1], [11, 4, 72, 4],
            [12, 0, 74, 1], [12, 1, 77, 2], [12, 3, 81, 1], [12, 4, 86, 2], [12, 6, 84, 2],
            [13, 0, 82, 1], [13, 1, 79, 2], [13, 3, 74, 1], [13, 4, 79, 2], [13, 6, 82, 2],
            [14, 0, 84, 1], [14, 1, 82, 2], [14, 3, 79, 1], [14, 4, 76, 2], [14, 6, 72, 2],
            [15, 0, 77, 4], [15, 4, 76, 1], [15, 5, 77, 1], [15, 6, 79, 2]
        ]
    };
    function marimbaScore(syn) {
        const beat = MARIMBA.beat, bar = beat * 4, eighth = beat / 2;
        const thumb = { decay: 0.6, partials: [1, 0.55, 0.3, 0.12], damp: 1, gain: 0.13, attack: 0.004 };
        MARIMBA.chords.forEach((name, b) => {
            const t0 = b * bar, chord = MARIMBA.harmony[name];
            // Marimba: barres de fusta (parcials 1 · 4 · 10) que s'apaguen de pressa.
            MARIMBA.ostinato.forEach((idx, e) => syn.struck(t0 + e * eighth, chord.notes[idx], e % 2 ? 0.6 : 0.85,
                [1, 3.98, 9.9], [1, 0.22, 0.05], [0.5, 0.12, 0.04], { gain: 0.11 }));
            [[0, 0, 1], [1.5, 0, 0.7], [2, 7, 0.85], [3, 0, 0.7]].forEach(([t, iv, v]) => {
                syn.pluck(t0 + t * beat, chord.root + iv + 12, v, thumb);
                syn.bass(t0 + t * beat, chord.root + iv, v * 0.35, 0.35);
            });
            syn.kick(t0, 0.7, 52);
            syn.kick(t0 + 2 * beat, 0.55, 52);
            for (let s16 = 0; s16 < 8; s16++) syn.brush(t0 + s16 * eighth, s16 % 2 ? 0.25 : 0.4, 0.016, true);
            [1, 3].forEach(t => syn.block(t0 + t * beat + eighth, 0.35, 1500, 0.012, 0.5));
        });
        // Steel drum: parcials gairebé harmònics amb una mica de trèmolo.
        MARIMBA.melody.forEach(([b, e, n, d]) => syn.struck(b * bar + e * eighth, n, 1, [1, 2.0, 3.01, 4.16],
            [1, 0.5, 0.22, 0.1], [0.5 + 0.12 * d, 0.35, 0.22, 0.14], { gain: 0.1, trem: 6 }));
        return TARGET_RMS;
    }

    // ── Estudi lo-fi ─────────────────────────────────────────────────────
    // Hip-hop tranquil a 90 ppm: acords de piano elèctric endarrerits, baix
    // rodó, bombo i caixa mandrosos, xarleston amb swing, un vibràfon
    // espaiat i el cruixit d'un vinil. Dotze compassos (2,67 s) en mi♭:
    // Mi♭7M(9) · Do m9 · Fa m9 · Si♭13, tres voltes.
    const LOFI = {
        beat: 2 / 3,
        swing: 0.09,
        chords: [
            { root: 39, notes: [55, 58, 62, 65] },   // Mi♭7M(9)
            { root: 36, notes: [58, 62, 63, 67] },   // Do m9
            { root: 41, notes: [56, 60, 63, 67] },   // Fa m9
            { root: 46, notes: [56, 60, 62, 67] }    // Si♭13
        ],
        // [compàs, temps, nota, durada en temps]
        melody: [
            [0, 0.5, 79, 1], [0, 1.5, 82, 1], [0, 2.5, 84, 1.5], [1, 1, 82, 1], [1, 2, 79, 2],
            [2, 0.5, 77, 1], [2, 1.5, 79, 1], [2, 2.5, 75, 1.5], [3, 2, 74, 1], [3, 3, 77, 1],
            [4, 0.5, 79, 1], [4, 1.5, 82, 1], [4, 2.5, 87, 1.5], [5, 1, 84, 1], [5, 2, 82, 2],
            [6, 0.5, 84, 1], [6, 1.5, 82, 1], [6, 2.5, 79, 1.5], [7, 2, 77, 2],
            [8, 0, 75, 1], [8, 1, 79, 1], [8, 2, 82, 1], [8, 3, 84, 1], [9, 0.5, 87, 1.5], [9, 2, 84, 2],
            [10, 0.5, 82, 1], [10, 1.5, 79, 1], [10, 2.5, 77, 1.5], [11, 1, 79, 1], [11, 2, 77, 1], [11, 3, 74, 1]
        ]
    };
    function lofiScore(syn) {
        const beat = LOFI.beat, bar = beat * 4, sw = LOFI.swing;
        for (let b = 0; b < 12; b++) {
            const t0 = b * bar, chord = LOFI.chords[b % 4];
            chord.notes.forEach((n, k) => {
                syn.epiano(t0 + 0.03 + k * 0.018, n + 12, 0.7);
                syn.epiano(t0 + 2.5 * beat + sw + k * 0.012, n + 12, 0.4);
                syn.pad(t0, n, bar, 0.009, 0.5);
            });
            syn.bass(t0, chord.root, 1, 0.9);
            syn.bass(t0 + 2.5 * beat + sw, chord.root + 7, 0.6, 0.5);
            syn.kick(t0, 1, 50);
            syn.kick(t0 + 2.5 * beat + sw, 0.75, 50);
            if (b % 2) syn.kick(t0 + 1.75 * beat, 0.45, 50);
            // Caixa (escombreta greu amb una mica de cos) als temps dos i quatre.
            [1, 3].forEach(t => { syn.brush(t0 + t * beat + 0.02, 0.9, 0.11, false); syn.block(t0 + t * beat + 0.02, 0.4, 190, 0.05, 0.4); });
            for (let e = 0; e < 8; e++) syn.brush(t0 + e * beat / 2 + (e % 2 ? sw : 0), e % 2 ? 0.3 : 0.45, 0.02, true);
        }
        LOFI.melody.forEach(([b, t, n, d]) => syn.vibes(b * bar + t * beat + sw * (t % 1 ? 1 : 0), n, d * beat));
        syn.crackle(0, MELODY_SECONDS, 0.05);
        return TARGET_RMS;
    }

    const SCORES = { theme: themeScore, oriental: orientalScore, bossa: bossaScore, vals: valsScore, capvespre: capvespreScore,
        havanera: havaneraScore, celta: celtaScore, nocturn: nocturnScore, marimba: marimbaScore, lofi: lofiScore };
    const INSTRUMENTS = ['brass', 'epiano', 'pad', 'strings', 'bass', 'vibes', 'kick', 'brush', 'pluck', 'flute', 'struck', 'block', 'reed', 'crackle'];
    // Mostres d'una melodia (Float32Array, 32 s, a `sampleRate`). No hi ha
    // enregistraments, veus ni xarxa: tot es calcula aquí.
    function samples(melody, sampleRate = 22050, random = Math.random) {
        const composed = composedLoopSpec(melody);
        if (composed) return jingleSamples(composed, sampleRate, random);
        const syn = createSynth(sampleRate, MELODY_SECONDS, random);
        return syn.finish(SCORES[melodyId(melody)](syn));
    }
    // El mateix càlcul a trossos de pocs mil·lisegons (nota a nota), perquè
    // generar una melodia nova a cada partida no deixi la pantalla glaçada.
    // El resultat és idèntic al de samples() amb la mateixa font d'atzar.
    function samplesAsync(melody, sampleRate = 22050, random = Math.random, opts = {}) {
        const composed = composedLoopSpec(melody);
        if (composed) return jingleSamplesAsync(composed, sampleRate, random, opts);
        return renderAsync(SCORES[melodyId(melody)], MELODY_SECONDS, sampleRate, random, opts);
    }
    function renderAsync(scoreFn, seconds, sampleRate, random, opts = {}) {
        const syn = createSynth(sampleRate, seconds, random), jobs = [], score = {};
        INSTRUMENTS.forEach(name => { score[name] = (...args) => { jobs.push(() => syn[name](...args)); }; });
        const target = scoreFn(score);
        const budget = opts.budgetMs || 8, clock = opts.now || (() => Date.now());
        const later = opts.later || (fn => setTimeout(fn, 0));
        return new Promise((resolve, reject) => {
            let k = 0;
            const step = () => {
                try {
                    if (opts.cancelled && opts.cancelled()) { reject(new Error('cancelled')); return; }
                    const t0 = clock();
                    do { jobs[k++](); } while (k < jobs.length && clock() - t0 < budget);
                    if (k < jobs.length) later(step); else resolve(syn.finish(target));
                } catch (err) { reject(err); }
            };
            later(step);
        });
    }

    // ══ Tornades de la lliga ═════════════════════════════════════════════
    // Peces de 30 s que sonen UNA vegada a la pantalla entre partida i partida
    // de la lliga amb rellotge (el compte enrere de 30 s): comencen amb el
    // compte i acaben amb un acord final just quan comença la partida
    // següent. Els cinc estils són ARRANJAMENTS (acompanyament i ritme, a
    // tempo tranquil); la música (tonalitat, tempo, acords, melodia, solista i
    // variant) la compon l'app cada vegada.
    const JINGLE_SECONDS = 30;
    const JINGLES = [
        { id: 'fanfarria', name: 'Passeig de jornada', description: 'marxa tranquil·la: trompa, clarinet o cordes amb timbal suau' },
        { id: 'galop', name: 'Tic-tac del rellotge', description: 'arpegis de marimba, celesta, arpa o vibràfon sobre el tic-tac d’un rellotge' },
        { id: 'rumba', name: 'Rumba de la classificació', description: 'rumba catalana tranquil·la: guitarra, palmes suaus i acordió, flauta o vibràfon' },
        { id: 'funk', name: 'Groove de la jugada', description: 'piano elèctric, baix i bateria suaus, amb vibràfon, flauta o cordes' },
        { id: 'himne', name: 'Himne de la lliga', description: 'cordes, arpa, celesta o trompa, solemne i calmat' }
    ];
    function jingleId(id) { return JINGLES.some(j => j.id === id) ? id : JINGLES[0].id; }
    function jingleInfo(id) { return JINGLES.find(j => j.id === jingleId(id)); }
    function pickJingle(random = Math.random, previous = null) {
        const pool = JINGLES.filter(j => j.id !== previous);
        const list = pool.length ? pool : JINGLES;
        const r = Math.max(0, Math.min(0.999999, Number(random()) || 0));
        return list[Math.floor(r * list.length)].id;
    }
    // Crescendo molt suau al llarg de la peça (0,88 al principi, 1 al final):
    // acompanya, no s'enfila.
    const cresc = (t, end) => 0.88 + 0.12 * Math.min(1, Math.max(0, t / end));
    // Cop final amable: acord llarg, timbal suau, plat fregat i campana.
    function jingleFinal(syn, t, notes, root, o) {
        const p = o || {};
        notes.forEach(n => syn.strings(t, n, p.hold || 1.3, 0.022, 0.12));
        notes.forEach(n => syn.pad(t, n, p.hold || 1.3, 0.012, 0.15));
        syn.bass(t, root, 0.9, 1.0);
        syn.kick(t, 0.6, 44);
        syn.brush(t, 0.45, 0.5, true);
        syn.struck(t, notes[notes.length - 1] + 12, 0.6, [1, 2.76, 5.4], [1, 0.4, 0.15], [1.4, 0.6, 0.25], { gain: 0.05, len: 2.4 });
    }

    // ── El compositor ────────────────────────────────────────────────────
    // Cada tornada és una peça NOVA i tranquil·la: l'app tria la tonalitat,
    // un tempo calmat, l'instrument solista i la variant d'acompanyament, la
    // progressió d'acords (frases A · A' · B i cadència) i compon la melodia
    // amb regles de l'ofici: notes de l'acord als temps forts, passos per
    // l'escala entre mig, salts curts, un contorn de frase, el motiu de la
    // primera frase que torna a la segona i el final a la tònica. Tot surt
    // d'una llavor (un enter): la mateixa llavor dona la mateixa peça.
    function seededRng(seed) {
        let a = (seed >>> 0) || 1;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const pickOf = (r, list) => list[Math.floor(r() * list.length) % list.length];
    const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
    const PC_NAMES = ['do', 'do♯', 're', 'mi♭', 'mi', 'fa', 'fa♯', 'sol', 'la♭', 'la', 'si♭', 'si'];
    const MODE_NAMES = { major: 'major', minor: 'menor', dorian: 'menor' };
    // Progressions (graus 0-6) en frases de quatre compassos.
    const PHRASES = {
        major: {
            a: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 1, 4], [5, 3, 0, 4], [0, 2, 3, 4], [3, 0, 4, 0], [0, 3, 5, 4], [0, 5, 3, 4]],
            b: [[3, 4, 2, 5], [5, 3, 1, 4], [3, 0, 3, 4], [1, 4, 0, 5], [5, 2, 3, 4], [3, 4, 5, 1]]
        },
        minor: {
            a: [[0, 3, 4, 0], [0, 5, 2, 6], [0, 3, 6, 2], [5, 6, 0, 0], [0, 4, 0, 3], [0, 6, 5, 4], [0, 3, 0, 4]],
            b: [[5, 6, 2, 4], [2, 6, 0, 4], [3, 6, 2, 5], [5, 3, 4, 4], [3, 4, 0, 5]]
        },
        dorian: {
            a: [[0, 0, 3, 3], [0, 3, 0, 3], [0, 0, 6, 3], [0, 6, 0, 3]],
            b: [[5, 4, 0, 3], [2, 3, 5, 4], [5, 5, 4, 4]]
        }
    };
    // Ritmes de melodia d'un compàs: [temps, durada]. Predominen les notes
    // llargues: és música per descansar entre partides.
    const RHYTHMS = {
        r1: [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5]],
        r2: [[0, 1], [1, 1], [2, 2]],
        r3: [[0, 1.5], [1.5, 0.5], [2, 2]],
        r4: [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
        r5: [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]],
        r6: [[0.5, 0.5], [1, 1], [2.5, 0.5], [3, 1]],
        r7: [[0, 2], [2, 2]],
        r8: [[0, 3], [3, 1]],
        r9: [[0.5, 0.5], [1, 1], [2, 2]]
    };
    const CADENCE_RHYTHMS = [RHYTHMS.r2, RHYTHMS.r3, RHYTHMS.r7];
    // Instruments solistes possibles (nom en català per a la pantalla).
    const LEAD_NAMES = {
        flute: 'flauta', vibes: 'vibràfon', epiano: 'piano elèctric', accordion: 'acordió', clarinet: 'clarinet',
        horn: 'trompa', strings: 'cordes', harp: 'arpa', guitar: 'guitarra', marimba: 'marimba', celesta: 'celesta'
    };
    // Cada estil: mode, tonalitats, tempo (durada del temps, s), registres,
    // ritmes de melodia, salt màxim, solistes i nombre de variants
    // d'acompanyament.
    const STYLES = {
        fanfarria: { mode: 'major', keys: [0, 2, 3, 5, 7, 10], beat: [0.6, 0.68], chordBase: 61, seventh: false, mel: [65, 84], maxJump: 3,
            rhythms: ['r2', 'r3', 'r4', 'r5', 'r7', 'r9'], leads: ['horn', 'clarinet', 'strings', 'flute'], variants: 2 },
        galop: { mode: 'minor', keys: [9, 4, 2, 7, 0, 11], beat: [0.58, 0.65], chordBase: 67, seventh: false, mel: null, maxJump: 3,
            rhythms: [], leads: ['marimba', 'celesta', 'harp', 'vibes'], variants: 2 },
        rumba: { mode: 'minor', keys: [9, 4, 2, 7, 11, 5], beat: [0.58, 0.65], chordBase: 55, seventh: false, four: true, mel: [64, 84], maxJump: 3,
            rhythms: ['r1', 'r2', 'r4', 'r5', 'r6', 'r9'], leads: ['accordion', 'flute', 'guitar', 'vibes'], variants: 2 },
        funk: { mode: 'dorian', keys: [4, 9, 2, 7, 0, 5], beat: [0.62, 0.71], chordBase: 59, seventh: true, mel: [69, 86], maxJump: 3,
            rhythms: ['r6', 'r5', 'r9', 'r2', 'r3'], leads: ['vibes', 'epiano', 'flute', 'strings'], variants: 2 },
        himne: { mode: 'major', keys: [0, 2, 5, 7, 10, 3], beat: [0.71, 0.83], chordBase: 59, seventh: false, mel: [65, 84], maxJump: 4,
            rhythms: ['r2', 'r3', 'r7', 'r8', 'r4'], leads: ['strings', 'celesta', 'horn', 'flute'], variants: 2 }
    };
    // Arpegis del rellotge (índexs de l'acord; -1 = silenci): quatre patrons.
    const GALOP_PATTERNS = [[0, 1, 2, 3, 2, 1, 0, -1], [3, 2, 1, 0, 1, 2, 3, -1], [0, 2, 1, 3, 2, 3, 1, -1], [0, 1, 2, 1, 3, 2, 1, -1]];

    // Notes d'un acord (classes de to) sobre un grau de l'escala. El cinquè grau
    // en mode menor és major (sensible), com a la música tonal.
    function chordPcs(tonic, mode, degree, seventh) {
        const sc = SCALES[mode];
        const pcs = [0, 2, 4].concat(seventh ? [6] : []).map(k => (tonic + sc[(degree + k) % 7]) % 12);
        if ((mode === 'minor' || mode === 'dorian') && degree === 4) pcs[1] = (tonic + 11) % 12;
        return pcs;
    }
    function voice(pcs, base, four) {
        const notes = pcs.map(pc => base + ((pc - base) % 12 + 12) % 12).sort((a, b) => a - b);
        if (four && notes.length === 3) notes.push(notes[0] + 12);
        return notes;
    }
    // Acord en estat fonamental (la fonamental a baix): el de l'acord final.
    function voiceRoot(pcs, base) {
        const root = base + ((pcs[0] - base) % 12 + 12) % 12;
        const notes = [root];
        pcs.slice(1).forEach(pc => notes.push(root + ((pc - root) % 12 + 12) % 12));
        notes.sort((x, y) => x - y);
        notes.push(root + 12);
        return notes;
    }
    function bassOf(pc) { return 33 + ((pc - 33) % 12 + 12) % 12; }
    function buildChord(tonic, mode, degree, st, seventh) {
        const pcs = chordPcs(tonic, mode, degree, seventh);
        return { degree, pcs, root: bassOf(pcs[0]), notes: voice(pcs, st.chordBase, !!st.four) };
    }

    // La melodia: una nota per cada cop de ritme. Als temps forts, una nota de
    // l'acord a prop de la direcció de la frase (salts curts); als febles, un
    // pas per l'escala. `dirs` (opcional) repeteix el contorn d'una frase.
    function composePhrase(r, ctx, bars, rhythms, dirs) {
        const out = [], usedDirs = [];
        let di = 0;
        bars.forEach((bar, bi) => {
            const chord = ctx.chords[bar];
            rhythms[bi].forEach(([t, d]) => {
                let dir = dirs && di < dirs.length ? dirs[di] : (ctx.prev > ctx.center + 5 ? -1 : (ctx.prev < ctx.center - 5 ? 1 : (r() < 0.5 ? -1 : 1)));
                di++;
                const strong = t === 0 || t === 2 || d >= 1;
                let n;
                if (strong) {
                    const jump = 1 + Math.floor(r() * ctx.maxJump);
                    n = nearestTone(ctx.prev + dir * jump, chord.pcs, ctx.lo, ctx.hi);
                    if (n === ctx.prev && r() < 0.6) n = nearestTone(ctx.prev + dir * 3, chord.pcs, ctx.lo, ctx.hi);
                } else {
                    n = stepScale(ctx.prev, dir, ctx.scalePcs, chord, ctx.lo, ctx.hi);
                }
                if (n < ctx.lo || n > ctx.hi) { dir = -dir; n = nearestTone(ctx.prev + dir * 2, chord.pcs, ctx.lo, ctx.hi); }
                usedDirs.push(dir);
                out.push([bar, t, n, d]);
                ctx.prev = n;
            });
        });
        return { notes: out, dirs: usedDirs };
    }
    function nearestTone(target, pcs, lo, hi) {
        let best = null;
        for (let n = lo; n <= hi; n++) {
            if (pcs.indexOf(n % 12) < 0) continue;
            if (best === null || Math.abs(n - target) < Math.abs(best - target)) best = n;
        }
        return best === null ? Math.max(lo, Math.min(hi, target)) : best;
    }
    // Un pas per l'escala; sobre l'acord de dominant en menor, amb la sensible.
    function stepScale(from, dir, scalePcs, chord, lo, hi) {
        const pcs = scalePcs.slice();
        chord.pcs.forEach(pc => { if (pcs.indexOf(pc) < 0) pcs.push(pc); });
        let n = from + dir;
        for (let k = 0; k < 3 && pcs.indexOf(((n % 12) + 12) % 12) < 0; k++) n += dir;
        if (n < lo || n > hi) return n < lo ? stepScale(from, 1, scalePcs, chord, lo, hi) : stepScale(from, -1, scalePcs, chord, lo, hi);
        return n;
    }

    // El cop final arriba entre el segon 24,5 i el 26,5 del compte enrere: es
    // calcula quants compassos hi caben al tempo triat i s'hi ajusta el tempo.
    const JINGLE_END = [24.5, 26.5];
    // opts.loop: bucle de fons de 32 s per a la TV (sense cop final; l'últim
    // compàs és la dominant, que torna a la tònica en començar de nou).
    function composeJingle(style, seed, opts) {
        const loop = !!(opts && opts.loop);
        const id = jingleId(style);
        const st = STYLES[id];
        const s = (seed >>> 0) || 1;
        const r = seededRng(s);
        const tonic = pickOf(r, st.keys);
        const mode = st.mode;
        const wanted = st.beat[0] + r() * (st.beat[1] - st.beat[0]);
        const target = loop ? MELODY_SECONDS : JINGLE_END[0] + r() * (JINGLE_END[1] - JINGLE_END[0]);
        const bars = Math.max(6, Math.round(target / (wanted * 4)));
        const beat = target / (bars * 4);
        const lead = pickOf(r, st.leads);
        const variant = Math.floor(r() * st.variants);
        const phrases = PHRASES[mode];
        const a = pickOf(r, phrases.a);
        const a2 = r() < 0.5 ? a : a.slice(0, 2).concat(pickOf(r, phrases.a).slice(2));
        const b = pickOf(r, phrases.b);
        // A, A' (si hi cap), B i la dominant de la cadència.
        const body = bars - 1;
        let degrees;
        if (body >= 8) degrees = a.concat(a2.slice(0, body - 8), b);
        else degrees = a.concat(b.slice(0, Math.max(0, body - 4)));
        // Bucles lents (rumba a 32 s: fins a 14 compassos): A' té com a molt
        // quatre compassos i la B es repeteix fins a omplir-ho. Abans hi
        // faltaven acords i la composició fallava.
        while (degrees.length < body) degrees = degrees.concat(b);
        degrees = degrees.slice(0, body).concat([4]);
        const chords = degrees.map(dg => buildChord(tonic, mode, dg, st, st.seventh || (mode !== 'major' && dg === 4)));
        const finalPcs = chordPcs(tonic, mode, 0, st.seventh);
        const spec = {
            style: id, seed: s, loop, tonic, mode, beat, degrees, lead, variant,
            keyName: PC_NAMES[tonic] + ' ' + MODE_NAMES[mode],
            leadName: LEAD_NAMES[lead],
            chords,
            final: { root: bassOf(tonic), notes: voiceRoot(finalPcs.slice(0, 3), 57), top: nearestTone(st.mel ? st.mel[1] - 6 : 79, [tonic], 72, 88) },
            melody: [], patterns: []
        };
        if (id === 'galop') {
            spec.patterns = chords.map(() => pickOf(r, GALOP_PATTERNS));
            return spec;
        }
        const scalePcs = SCALES[mode].map(i => (tonic + i) % 12);
        const ctx = { chords, scalePcs, lo: st.mel[0], hi: st.mel[1], center: (st.mel[0] + st.mel[1]) / 2, maxJump: st.maxJump };
        ctx.prev = nearestTone(ctx.center - 3, chords[0].pcs, ctx.lo, ctx.hi);
        const rh = n => Array.from({ length: n }, () => RHYTHMS[pickOf(r, st.rhythms)]);
        // Frases: A (el motiu), A' (mateix ritme i contorn sobre els acords
        // nous, si hi cap), B (contrast) i la cadència a l'últim compàs.
        const idx = n => Array.from({ length: n }, (_, k) => k);
        const aLen = Math.min(4, body), a2Len = body >= 8 ? Math.min(aLen, body - 8) : 0, bLen = body - aLen - a2Len;
        const ra = rh(aLen);
        const A = composePhrase(r, ctx, idx(aLen), ra);
        let notes = A.notes;
        if (a2Len) {
            const A2 = composePhrase(r, ctx, idx(a2Len).map(k => aLen + k), ra.slice(0, a2Len), A.dirs);
            notes = notes.concat(A2.notes);
        }
        if (bLen > 0) notes = notes.concat(composePhrase(r, ctx, idx(bLen).map(k => aLen + a2Len + k), rh(bLen)).notes);
        notes = notes.concat(composePhrase(r, ctx, [bars - 1], [pickOf(r, CADENCE_RHYTHMS)]).notes);
        spec.melody = notes;
        return spec;
    }
    // Empremta d'una peça (melodia, harmonia, solista i variant), per no
    // repetir-ne cap.
    function jingleFingerprint(spec) {
        const str = spec.style + '|' + spec.tonic + '|' + spec.lead + '|' + spec.variant + '|' + spec.degrees.join('') + '|'
            + spec.melody.map(m => m[2] + ':' + m[1]).join(',') + '|' + spec.patterns.map(p => p.join('')).join('');
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
    }
    function jingleTitle(spec) {
        const info = jingleInfo(spec && spec.style);
        return info.name + ' · ' + (spec ? spec.keyName + ' · ' + spec.leadName : '');
    }

    // Instrument solista: una nota.
    function playLead(syn, kind, start, n, dur, v) {
        const d = Math.max(0.12, dur);
        switch (kind) {
            case 'flute': syn.flute(start, n, d, 0.85 * v, { breath: 0.05, vib: 0.18, attack: 0.06, gain: 0.06, release: 0.16 }); break;
            case 'vibes': syn.vibes(start, n, d); break;
            case 'epiano': syn.epiano(start, n, 0.95 * v); break;
            case 'accordion': syn.reed(start, n, d, v, { gain: 0.034, attack: 0.05, release: 0.14, detune: 6 }); break;
            case 'clarinet': syn.reed(start, n, d, v, { gain: 0.03, attack: 0.07, release: 0.16, detune: 1.2 }); break;
            case 'horn':
                syn.reed(start, n, d, 0.7 * v, { gain: 0.026, attack: 0.09, release: 0.18, detune: 2 });
                syn.strings(start, n, d, 0.012 * v, 0.1);
                break;
            case 'strings': syn.strings(start, n, d, 0.026 * v, 0.14); break;
            case 'harp': syn.pluck(start, n, 0.95 * v, { decay: 1.2, partials: [1, 0.5, 0.22, 0.1], damp: 1, gain: 0.11, attack: 0.004 }); break;
            case 'guitar': syn.pluck(start, n, 0.95 * v, { decay: 1.0, partials: [1, 0.5, 0.28, 0.14], damp: 1.3, gain: 0.12, attack: 0.004, vib: 0.1 }); break;
            case 'marimba': syn.struck(start, n, v, [1, 3.98, 9.9], [1, 0.22, 0.05], [0.6, 0.12, 0.04], { gain: 0.11 }); break;
            case 'celesta': syn.struck(start, n, v, [1, 2, 3.01, 4.2], [1, 0.35, 0.12, 0.06], [0.9, 0.4, 0.2, 0.1], { gain: 0.08 }); break;
            default: syn.flute(start, n, d, 0.85 * v, { gain: 0.06 });
        }
    }

    // ── Passeig de jornada ───────────────────────────────────────────────
    // Marxa tranquil·la: el solista sobre acords de cordes i trompes (dues
    // variants: cops suaus o acords llargs), baix i timbal suau.
    function fanfarriaScore(syn, spec) {
        const beat = spec.beat, bar = beat * 4, end = spec.chords.length * bar;
        const cr = spec.loop ? () => 1 : cresc;
        const brass = { gain: 0.014, attack: 0.06, release: 0.12, detune: 2 };
        spec.chords.forEach((chord, b) => {
            const t0 = b * bar, v = cr(t0, end);
            if (spec.variant === 0) {
                [[0, 0.8, 0.9], [2, 1.6, 0.75]].forEach(([t, d, vel]) =>
                    chord.notes.forEach(n => syn.reed(t0 + t * beat, n - 12, d * beat, vel * v, brass)));
            } else {
                chord.notes.forEach(n => syn.reed(t0, n - 12, bar - 0.1, 0.8 * v, Object.assign({}, brass, { attack: 0.3 })));
            }
            chord.notes.forEach(n => syn.strings(t0, n, bar, 0.009, 0.5));
            syn.bass(t0, chord.root, 0.75 * v, 0.7);
            syn.bass(t0 + 2 * beat, chord.root + 7, 0.5 * v, 0.6);
            syn.kick(t0, 0.55 * v, 45);
            [1, 3].forEach(t => syn.brush(t0 + t * beat, 0.35 * v, 0.07, false));
        });
        spec.melody.forEach(([b, t, n, d]) => {
            const start = b * bar + t * beat;
            playLead(syn, spec.lead, start, n, d * beat - 0.04, cr(start, end));
        });
        if (!spec.loop) {
            jingleFinal(syn, end, spec.final.notes, spec.final.root, { hold: 1.4 });
            playLead(syn, spec.lead, end, spec.final.top, 1.4, 1);
        }
        return TARGET_RMS;
    }

    // ── Tic-tac del rellotge ─────────────────────────────────────────────
    // Arpegis tranquils del solista (marimba, celesta, arpa o vibràfon) amb
    // el baix i acords de pizzicato; a la variant 0, el tic-tac del rellotge.
    // Abans del final, un carilló suau.
    function galopScore(syn, spec) {
        const beat = spec.beat, bar = beat * 4, eighth = beat / 2, end = spec.chords.length * bar;
        const cr = spec.loop ? () => 1 : cresc;
        const pizz = { decay: 0.45, partials: [1, 0.5, 0.25, 0.1], damp: 1.2, gain: 0.09, attack: 0.004 };
        spec.chords.forEach((chord, b) => {
            const t0 = b * bar, v = cr(t0, end);
            const tones = chord.notes.slice(0, 3).concat([chord.notes[0] + 12]);
            [0, 2].forEach((t, k) => {
                syn.pluck(t0 + t * beat, chord.root + (k ? 7 : 0) + 12, 0.75 * v, pizz);
                syn.bass(t0 + t * beat, chord.root + (k ? 7 : 0), 0.4 * v, 0.4);
            });
            [1, 3].forEach(t => chord.notes.forEach((n, k) => syn.pluck(t0 + t * beat + k * 0.008, n - 12, 0.4 * v, pizz)));
            chord.notes.forEach(n => syn.pad(t0, n, bar, 0.006, 0.5));
            spec.patterns[b].forEach((idx, e) => {
                if (idx < 0) return;
                playLead(syn, spec.lead, t0 + e * eighth, tones[idx], (e === 6 ? 2 : 1) * eighth - 0.02, (e % 2 ? 0.6 : 0.75) * v);
            });
            if (spec.variant === 0) for (let t = 0; t < 4; t++) syn.block(t0 + t * beat, 0.25, t % 2 ? 1450 : 1900, 0.008, 0.5);
        });
        if (!spec.loop) {
            // Carilló suau (tres notes de l'acord final, avall).
            spec.final.notes.slice(1).reverse().forEach((n, k) => syn.struck(end - bar + 2 * beat + k * beat * 0.5, n + 24, 0.5,
                [1, 2.76, 5.4], [1, 0.35, 0.12], [0.8, 0.3, 0.1], { gain: 0.045 }));
            jingleFinal(syn, end, spec.final.notes, spec.final.root, { hold: 1.2 });
            playLead(syn, spec.lead, end, spec.final.top, 1.2, 1);
        }
        return TARGET_RMS;
    }

    // ── Rumba de la classificació ────────────────────────────────────────
    // Rumba catalana tranquil·la: guitarra amb el ventilador (dues variants:
    // sencer o mig), palmes suaus, bongos discrets, baix i el solista.
    const RUMBA_STRUMS = [
        [[0, 1, false], [2, 0.5, true], [3, 0.7, false], [4, 0.9, false], [6, 0.5, true], [7, 0.7, false]],
        [[0, 1, false], [3, 0.65, true], [4, 0.85, false], [7, 0.6, true]]
    ];
    function rumbaScore(syn, spec) {
        const beat = spec.beat, bar = beat * 4, eighth = beat / 2, end = spec.chords.length * bar;
        const cr = spec.loop ? () => 1 : cresc;
        const guitar = { decay: 0.4, partials: [1, 0.55, 0.3, 0.15], damp: 1.3, gain: 0.075, attack: 0.004 };
        const thumb = { decay: 0.7, partials: [1, 0.6, 0.3], damp: 1, gain: 0.1, attack: 0.004 };
        spec.chords.forEach((chord, b) => {
            const t0 = b * bar, v = cr(t0, end);
            RUMBA_STRUMS[spec.variant % 2].forEach(([e, vel, up]) => {
                const notes = up ? chord.notes.slice().reverse() : chord.notes;
                notes.forEach((n, k) => syn.pluck(t0 + e * eighth + k * 0.011, n, vel * v, guitar));
                if (up) syn.brush(t0 + e * eighth, 0.22 * v, 0.015, false);
            });
            [[0, 0], [2, 7], [3.5, 0]].forEach(([t, iv], k) => {
                syn.pluck(t0 + t * beat, chord.root + iv + 12, (k === 2 ? 0.5 : 0.8) * v, thumb);
                syn.bass(t0 + t * beat, chord.root + iv, 0.4 * v, 0.4);
            });
            [1, 3].forEach(t => syn.brush(t0 + t * beat, 0.5 * v, 0.035, true));
            [[0.5, 480], [1.5, 330], [2.5, 480], [3.5, 330]].forEach(([t, hz]) => syn.block(t0 + t * beat, 0.35 * v, hz, 0.06, 0.2));
        });
        spec.melody.forEach(([b, t, n, d]) => {
            const start = b * bar + t * beat;
            playLead(syn, spec.lead, start, n, d * beat - 0.04, cr(start, end));
        });
        if (!spec.loop) {
            jingleFinal(syn, end, spec.final.notes, spec.final.root, { hold: 1.1 });
            spec.final.notes.forEach((n, k) => syn.pluck(end + k * 0.014, n, 0.9, guitar));
            playLead(syn, spec.lead, end, spec.final.top, 1.2, 1);
        }
        return TARGET_RMS;
    }

    // ── Groove de la jugada ──────────────────────────────────────────────
    // Groove tranquil: acords de piano elèctric (dues variants de cops), baix
    // (dues línies), bombo, caixa i xarleston suaus, i el solista.
    const FUNK_STABS = [[0, 1.5, 2.5], [0, 0.75, 2, 3.25]];
    const FUNK_BASS = [
        [[0, 0, 1], [1.5, 7, 0.7], [2, 12, 0.6], [3, 10, 0.6]],
        [[0, 0, 1], [0.75, 0, 0.6], [2, 7, 0.8], [3.5, 12, 0.6]]
    ];
    function funkScore(syn, spec) {
        const beat = spec.beat, bar = beat * 4, eighth = beat / 2, end = spec.chords.length * bar;
        const cr = spec.loop ? () => 1 : cresc;
        spec.chords.forEach((chord, b) => {
            const t0 = b * bar, v = cr(t0, end);
            FUNK_STABS[spec.variant % 2].forEach((t, k) => chord.notes.forEach((n, j) => syn.epiano(t0 + t * beat + j * 0.008, n, (k === 0 ? 0.5 : 0.36) * v)));
            FUNK_BASS[spec.variant % 2].forEach(([t, iv, vel]) => syn.bass(t0 + t * beat, chord.root + iv, vel * 0.85 * v, 0.35));
            [0, 2.5].forEach((t, k) => syn.kick(t0 + t * beat, (k ? 0.45 : 0.65) * v, 50));
            [1, 3].forEach(t => { syn.brush(t0 + t * beat, 0.55 * v, 0.1, false); syn.block(t0 + t * beat, 0.25 * v, 200, 0.05, 0.3); });
            for (let k = 0; k < 8; k++) syn.brush(t0 + k * eighth, (k % 2 ? 0.16 : 0.24) * v, 0.016, true);
        });
        spec.melody.forEach(([b, t, n, d]) => {
            const start = b * bar + t * beat;
            playLead(syn, spec.lead, start, n, d * beat - 0.04, cr(start, end));
        });
        if (!spec.loop) {
            jingleFinal(syn, end, spec.final.notes, spec.final.root, { hold: 1.2 });
            spec.final.notes.forEach((n, j) => syn.epiano(end + j * 0.012, n + 12, 0.6));
            playLead(syn, spec.lead, end, spec.final.top, 1.4, 1);
        }
        return TARGET_RMS;
    }

    // ── Himne de la lliga ────────────────────────────────────────────────
    // Solemne i calmat: cordes, arpa en arpegis (dues variants: amunt i avall
    // o trencat), timbal suau i el solista.
    const HIMNE_ARPS = [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 1, 2, 0, 2]];
    function himneScore(syn, spec) {
        const beat = spec.beat, bar = beat * 4, eighth = beat / 2, end = spec.chords.length * bar;
        const cr = spec.loop ? () => 1 : cresc;
        const harp = { decay: 1.2, partials: [1, 0.5, 0.22, 0.1], damp: 1, gain: 0.07, attack: 0.004 };
        spec.chords.forEach((chord, b) => {
            const t0 = b * bar, v = cr(t0, end);
            chord.notes.forEach(n => { syn.strings(t0, n - 12, bar, 0.011 * v, 0.6); syn.pad(t0, n, bar, 0.008, 0.6); });
            const tones = chord.notes.slice(0, 3).concat([chord.notes[0] + 12]);
            HIMNE_ARPS[spec.variant % 2].forEach((idx, e) => syn.pluck(t0 + e * eighth, tones[idx], (e === 0 ? 0.8 : 0.5) * v, harp));
            syn.bass(t0, chord.root, 0.75 * v, 1.1);
            syn.kick(t0, 0.5 * v, 44);
        });
        if (!spec.loop) for (let k = 0; k < 8; k++) syn.kick(end - bar / 2 + k * bar / 16, 0.2 + 0.03 * k, 46);
        spec.melody.forEach(([b, t, n, d]) => {
            const start = b * bar + t * beat;
            playLead(syn, spec.lead, start, n, d * beat - 0.05, cr(start, end));
        });
        if (!spec.loop) {
            jingleFinal(syn, end, spec.final.notes, spec.final.root, { hold: 1.0 });
            playLead(syn, spec.lead, end, spec.final.top, 1.2, 1);
        }
        return TARGET_RMS;
    }

    const JINGLE_SCORES = { fanfarria: fanfarriaScore, galop: galopScore, rumba: rumbaScore, funk: funkScore, himne: himneScore };
    // Entrada i sortida: un esvaïment molt curt al principi i un de llarg al
    // final, perquè la peça s'acabi sense tall encara que l'acord final ressoni.
    function shapeJingle(data, sampleRate) {
        const inN = Math.round(0.03 * sampleRate), outStart = Math.round((JINGLE_SECONDS - 1.2) * sampleRate);
        for (let i = 0; i < inN && i < data.length; i++) data[i] *= i / inN;
        const outN = data.length - outStart;
        for (let i = outStart; i < data.length; i++) data[i] *= 0.5 + 0.5 * Math.cos(Math.PI * (i - outStart) / outN);
        return data;
    }
    // `spec` és una peça composta (composeJingle) o el nom d'un estil (es
    // compon amb una llavor nova).
    function asSpec(spec) {
        return spec && typeof spec === 'object' ? spec : composeJingle(spec, Math.floor(Math.random() * 4294967295) + 1);
    }
    // Les tornades (30 s) s'esvaeixen al final; els bucles de la TV (32 s)
    // es repeteixen sense tall, sense esvaïment.
    function jingleSamples(spec, sampleRate = 22050, random = Math.random) {
        const sp = asSpec(spec);
        const syn = createSynth(sampleRate, sp.loop ? MELODY_SECONDS : JINGLE_SECONDS, random);
        const data = syn.finish(JINGLE_SCORES[sp.style](syn, sp));
        return sp.loop ? data : shapeJingle(data, sampleRate);
    }
    function jingleSamplesAsync(spec, sampleRate = 22050, random = Math.random, opts = {}) {
        const sp = asSpec(spec);
        return renderAsync(syn => JINGLE_SCORES[sp.style](syn, sp), sp.loop ? MELODY_SECONDS : JINGLE_SECONDS, sampleRate, random, opts)
            .then(data => sp.loop ? data : shapeJingle(data, sampleRate));
    }

    // ── Música composta a la TV ──────────────────────────────────────────
    // Identificador d'un bucle compost: «c:estil:llavor». El reproductor de
    // fons el tracta com qualsevol melodia (melodyId, melodyInfo, samples).
    function composedMelodyId(style, seed) { return 'c:' + jingleId(style) + ':' + ((seed >>> 0) || 1); }
    function parseComposedId(id) {
        const m = /^c:([a-z]+):(\d+)$/.exec(String(id || ''));
        if (!m || !JINGLES.some(j => j.id === m[1])) return null;
        return { style: m[1], seed: (Number(m[2]) >>> 0) || 1 };
    }
    function composedLoopSpec(id) {
        const p = parseComposedId(id);
        return p ? composeJingle(p.style, p.seed, { loop: true }) : null;
    }
    // Un bucle nou per a cada partida de la TV, d'un estil diferent de l'anterior.
    function composeMelodyId(random = Math.random, previous = null) {
        const prev = parseComposedId(previous);
        const style = pickJingle(random, prev ? prev.style : null);
        return composedMelodyId(style, Math.floor(random() * 4294967295) + 1);
    }

    // ── Registre de la música composta ───────────────────────────────────
    // Cada peça es pot tornar a generar exactament amb l'estil i la llavor:
    // el registre només desa això (i on va sonar, quan i si és preferida),
    // uns 90 bytes per peça; el so no es desa mai. Per això es poden
    // conservar les 200 darreres (uns 18 kB) i totes les preferides (fins a
    // 100). La pantalla en mostra les 5 darreres a la vista i la resta,
    // ordenada (registryGroups).
    const REGISTRY_KEY = 'eltauler_composed_music';
    const REGISTRY_RECENT = 200, REGISTRY_FAVS = 100, REGISTRY_LATEST = 5;
    function storageOf(storage) {
        if (storage) return storage;
        try { return root && root.localStorage ? root.localStorage : null; } catch (err) { return null; }
    }
    function registryList(storage) {
        const st = storageOf(storage);
        if (!st) return [];
        try {
            const raw = JSON.parse(st.getItem(REGISTRY_KEY) || '[]');
            return Array.isArray(raw) ? raw.filter(e => e && JINGLES.some(j => j.id === e.style) && Number(e.seed) > 0) : [];
        } catch (err) { return []; }
    }
    function registrySave(list, storage) {
        const st = storageOf(storage);
        if (!st) return;
        const favs = list.filter(e => e.fav).slice(0, REGISTRY_FAVS);
        const rest = list.filter(e => !e.fav).slice(0, REGISTRY_RECENT);
        const keep = list.filter(e => favs.includes(e) || rest.includes(e));
        try { st.setItem(REGISTRY_KEY, JSON.stringify(keep)); } catch (err) {}
    }
    function registryKey(e) { return e.style + ':' + e.seed + ':' + (e.loop ? 'b' : 't'); }
    // entry = { where: 'lliga' | 'tv', style, seed, loop, at }
    function registerComposition(entry, storage) {
        if (!entry || !JINGLES.some(j => j.id === entry.style)) return null;
        const e = { where: entry.where === 'tv' ? 'tv' : 'lliga', style: entry.style, seed: (entry.seed >>> 0) || 1,
            loop: !!entry.loop, at: entry.at || Date.now(), fav: false };
        const list = registryList(storage);
        const old = list.findIndex(x => registryKey(x) === registryKey(e));
        if (old >= 0) { e.fav = !!list[old].fav; list.splice(old, 1); }
        list.unshift(e);
        registrySave(list, storage);
        return e;
    }
    function toggleFavourite(key, storage) {
        const list = registryList(storage);
        const e = list.find(x => registryKey(x) === key);
        if (!e) return null;
        e.fav = !e.fav;
        registrySave(list, storage);
        return e.fav;
    }
    // Totes les peces del registre es tornen a generar EN BUCLE, sense final
    // (també les tornades antigues de la lliga, que abans acabaven amb un acord).
    function registrySpec(e) { return composeJingle(e.style, e.seed, { loop: true }); }
    function dayKey(ts) {
        const d = new Date(ts);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    // Historial ordenat: les 5 darreres, les preferides i l'arxiu per dies
    // (del més nou al més antic). Cada peça surt en un sol lloc.
    function registryGroups(list, now) {
        const all = (Array.isArray(list) ? list : []).filter(Boolean).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
        const latest = all.slice(0, REGISTRY_LATEST);
        const favs = all.slice(REGISTRY_LATEST).filter(e => e.fav);
        const rest = all.slice(REGISTRY_LATEST).filter(e => !e.fav);
        const t = typeof now === 'number' ? now : Date.now();
        const today = dayKey(t), yesterday = dayKey(t - 86400000);
        const days = [];
        rest.forEach(e => {
            const k = dayKey(e.at || 0);
            let g = days.length ? days[days.length - 1] : null;
            if (!g || g.day !== k) { g = { day: k, label: k === today ? 'Avui' : (k === yesterday ? 'Ahir' : null), items: [] }; days.push(g); }
            g.items.push(e);
        });
        return { latest, favs, days };
    }

    // ── Baixada en MP3 ───────────────────────────────────────────────────
    // La peça és un bucle de 32 s: el fitxer en porta unes quantes voltes
    // (per defecte quatre, uns 2 minuts) i s'esvaeix només als darrers segons
    // perquè el fitxer no acabi amb un tall.
    const EXPORT_RATE = 22050;
    function exportSamples(spec, opts) {
        const o = opts || {};
        const sp = asSpec(spec);
        const loopSpec = sp.loop ? sp : composeJingle(sp.style, sp.seed, { loop: true });
        const cycles = Math.max(1, Math.min(8, Math.round(o.cycles || 4)));
        const fade = Math.max(0, Number(o.fadeSeconds) >= 0 ? Number(o.fadeSeconds) : 3);
        const gen = o.generate || jingleSamplesAsync;
        return Promise.resolve(gen(loopSpec, EXPORT_RATE, o.random || Math.random, { cancelled: o.cancelled })).then(cycle => {
            if (!cycle) return null;
            const out = new Float32Array(cycle.length * cycles);
            for (let c = 0; c < cycles; c++) out.set(cycle, c * cycle.length);
            const n = Math.min(out.length, Math.round(fade * EXPORT_RATE));
            for (let i = 0; i < n; i++) out[out.length - n + i] *= Math.cos((i / n) * Math.PI / 2);
            return out;
        });
    }
    // Codifica a MP3 amb lamejs (es carrega només quan cal). Mono, 22.050 Hz,
    // 64 kbps: uns 0,5 MB per minut. Treballa a trossos perquè la pantalla no
    // es quedi encallada; opts = { kbps, onProgress(0-1), cancelled() }.
    function encodeMp3(samples, lame, opts) {
        const o = opts || {};
        if (!lame || typeof lame.Mp3Encoder !== 'function') return Promise.reject(new Error('no-encoder'));
        const enc = new lame.Mp3Encoder(1, EXPORT_RATE, o.kbps || 64);
        const pcm = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            const v = Math.max(-1, Math.min(1, samples[i]));
            pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        const parts = [];
        const BLOCK = 1152, PER_SLICE = 1152 * 60;
        let pos = 0;
        return new Promise((resolve, reject) => {
            const step = () => {
                if (o.cancelled && o.cancelled()) { reject(new Error('cancelled')); return; }
                try {
                    const end = Math.min(pcm.length, pos + PER_SLICE);
                    for (; pos < end; pos += BLOCK) {
                        const buf = enc.encodeBuffer(pcm.subarray(pos, Math.min(end, pos + BLOCK)));
                        if (buf && buf.length) parts.push(new Uint8Array(buf));
                    }
                    if (typeof o.onProgress === 'function') o.onProgress(pos / pcm.length);
                    if (pos < pcm.length) { setTimeout(step, 0); return; }
                    const tail = enc.flush();
                    if (tail && tail.length) parts.push(new Uint8Array(tail));
                    resolve(parts);
                } catch (err) { reject(err); }
            };
            step();
        });
    }
    // Nom del fitxer: «El Tauler - Rumba de la classificacio - fa menor - vibrafon.mp3».
    // Sense accents: amb lletres no ASCII alguns navegadors canvien el nom
    // del fitxer per «download».
    function mp3FileName(spec) {
        const sp = asSpec(spec);
        const title = jingleTitle(sp).replace(/ · /g, ' - ').replace(/·/g, '.');
        const ascii = ('El Tauler - ' + title).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[’']/g, '').replace(/[^\x20-\x7e]/g, '');
        return ascii.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() + '.mp3';
    }

    // Reproductor d'una peça composta: en bucle si la peça ho és (totes les noves),
    // fins que s'atura. Té el seu propi
    // context d'àudio i respecta l'interruptor general de la música.
    // env = { createContext, generate(id, sampleRate, random, opts) → Promise }
    const JINGLE_LEVEL = 0.8;
    function createJinglePlayer(env = {}) {
        let context = null, entry = null, token = 0, cached = null;
        const Ctor = root && (root.AudioContext || root.webkitAudioContext);
        const generate = env.generate || jingleSamplesAsync;
        const supported = !!(env.createContext || Ctor);
        function ensureContext() {
            if (!context || context.state === 'closed') context = env.createContext ? env.createContext() : new Ctor();
            return context;
        }
        function stop(fade) {
            token++;
            if (!entry) return;
            const e = entry;
            entry = null;
            try {
                if (fade && context) {
                    e.gain.gain.setTargetAtTime(0, context.currentTime, 0.15);
                    e.source.stop(context.currentTime + 0.9);
                } else e.source.stop();
            } catch (err) {}
        }
        const api = {
            supported: () => supported,
            // spec: peça composta (composeJingle). opts = { volume (0-100),
            // startedAt() (s des del principi) }. Retorna una promesa: true si
            // ha començat a sonar.
            play(spec, opts) {
                const o = opts || {};
                stop(true);
                const my = ++token;
                const sp = asSpec(spec);
                const jid = sp.style + ':' + sp.seed;
                if (!allowed || !supported || !(o.volume > 0)) return Promise.resolve(false);
                let ctx;
                try { ctx = ensureContext(); } catch (err) { return Promise.resolve(false); }
                const resumed = ctx.state === 'running' ? Promise.resolve() : Promise.resolve(ctx.resume()).catch(() => {});
                const data = cached && cached.id === jid ? Promise.resolve(cached.data)
                    : Promise.resolve().then(() => generate(sp, 22050, Math.random, { cancelled: () => my !== token }))
                        .then(d => { cached = { id: jid, data: d }; return d; });
                return Promise.all([data, resumed]).then(([samples]) => {
                    if (my !== token || !allowed) return false;
                    const started = typeof o.startedAt === 'function' ? o.startedAt() : (o.offset || 0);
                    const length = samples.length / 22050;
                    // En bucle no hi ha final: el punt d'inici dona la volta.
                    const offset = sp.loop ? (Math.max(0, started) % length) : Math.max(0, Math.min(JINGLE_SECONDS - 0.5, started));
                    const buffer = ctx.createBuffer(1, samples.length, 22050);
                    buffer.getChannelData(0).set(samples);
                    const source = ctx.createBufferSource(), gain = ctx.createGain();
                    source.buffer = buffer;
                    // Les peces compostes sonen en bucle fins que s'aturen.
                    source.loop = !!sp.loop;
                    gain.gain.value = 0;
                    source.connect(gain); gain.connect(ctx.destination);
                    source.start(0, offset);
                    gain.gain.setTargetAtTime(Math.min(1, o.volume / 100) * JINGLE_LEVEL, ctx.currentTime, 0.04);
                    const mine = { source, gain, id: sp.style, spec: sp };
                    entry = mine;
                    source.onended = () => {
                        if (entry === mine) entry = null;
                        try { source.disconnect(); gain.disconnect(); } catch (err) {}
                        if (typeof o.onEnded === 'function') { try { o.onEnded(); } catch (err) {} }
                    };
                    return true;
                }).catch(() => false);
            },
            stop,
            // Pestanya amagada: la tornada s'atura on és i continua en tornar.
            pause() { try { if (context && context.state === 'running') context.suspend(); } catch (err) {} },
            resume() { try { if (context && context.state === 'suspended') context.resume(); } catch (err) {} },
            playing() { return entry ? entry.id : null; },
            // La peça que sona (amb la tonalitat i la llavor).
            current() { return entry ? entry.spec : null; },
            dispose() {
                stop();
                cached = null;
                const ctx = context; context = null;
                try { if (ctx && ctx.close) Promise.resolve(ctx.close()).catch(() => {}); } catch (err) {}
            }
        };
        return api;
    }

    // Nivell màxim de la música (amb el volum al 100 %): deixa el fons uns
    // 20 dB per sota de Matxa amb el volum per defecte (20 %).
    const LEVEL = 0.35;
    // Mentre parla la veu, el fons baixa a aquesta fracció (com a la ràdio) i
    // torna a pujar a poc a poc quan calla.
    const DUCK = 0.45;
    // Només es guarda la melodia que sona (cada una ocupa uns 2,8 MB).
    let cache = null;
    // Interruptor general de la música (Configuració › Veus de lectura): si
    // s'apaga, cap reproductor no sona. Els reproductors vius es registren
    // perquè el canvi s'apliqui al moment.
    let allowed = true;
    const players = new Set();
    function setAllowed(value) {
        allowed = !!value;
        players.forEach(p => { try { p._reconcile(true); } catch (err) {} });
    }
    function isAllowed() { return allowed; }
    // Algun reproductor (llevat de `except`) sona ara mateix?
    function othersPlaying(except) {
        for (const p of players) if (p !== except && p.status() === 'playing') return true;
        return false;
    }
    // env = { createContext, random, sync, onChange(),
    //         generate(melody, sampleRate, random, opts) → Promise }
    // Amb `sync` (o una font d'atzar pròpia) la melodia es genera de cop.
    function createPlayer(env = {}) {
        let context = null, current = null, wanted = normalize(), melody = MELODIES[0].id, active = false, failed = false, ducked = false;
        let cachedBuffer = null, cachedMelody = null, pending = null;
        const sync = !!(env.sync || (env.random && env.random !== Math.random));
        const generate = env.generate || samplesAsync;
        const level = () => wanted.volume / 100 * LEVEL * (ducked ? DUCK : 1);
        const Ctor = root && (root.AudioContext || root.webkitAudioContext);
        const supported = !!(env.createContext || Ctor);
        // fade: en canviar de melodia, l'anterior s'apaga en mig segon.
        function stopSource(fade) {
            if (!current) return;
            const entry = current;
            current = null;
            if (fade && context) {
                try {
                    entry.gain.gain.setTargetAtTime(0, context.currentTime, 0.12);
                    entry.source.onended = () => {
                        try { entry.source.disconnect(); } catch (err) {}
                        try { entry.gain.disconnect(); } catch (err) {}
                    };
                    entry.source.stop(context.currentTime + 0.6);
                    return;
                } catch (err) {}
            }
            try { entry.source.stop(); } catch (err) {}
            try { entry.source.disconnect(); } catch (err) {}
            try { entry.gain.disconnect(); } catch (err) {}
        }
        // Mostres de la melodia si ja hi són; si no, en comença el càlcul (un
        // de sol alhora) i torna null: mentrestant continua l'anterior.
        function readyData(id) {
            if (sync) return samples(id, 22050, env.random || Math.random);
            if (cache && cache.melody === id) return cache.data;
            if (!pending || pending.melody !== id) {
                const job = { melody: id };
                pending = job;
                Promise.resolve().then(() => generate(id, 22050, Math.random, { cancelled: () => pending !== job }))
                    .then(data => {
                        if (pending !== job) return;
                        pending = null;
                        cache = { melody: id, data };
                        if (melody === id) reconcile();
                        if (typeof env.onChange === 'function') { try { env.onChange(); } catch (err) {} }
                    }, () => { if (pending === job) { pending = null; failed = true; } });
            }
            return null;
        }
        // fadeOut: en apagar-se, el bucle s'esvaeix en mig segon.
        function reconcile(fadeOut) {
            if (!allowed || !active || wanted.sound === 'off' || wanted.volume === 0) { stopSource(!!fadeOut); return; }
            if (failed || !context || context.state !== 'running') return;
            try {
                if (!current || current.melody !== melody) {
                    if (cachedMelody !== melody || !cachedBuffer) {
                        const data = readyData(melody);
                        if (!data) {
                            if (current) current.gain.gain.setTargetAtTime(level(), context.currentTime, 0.08);
                            return;
                        }
                        const buffer = context.createBuffer(1, data.length, 22050);
                        buffer.getChannelData(0).set(data);
                        cachedBuffer = buffer; cachedMelody = melody;
                    }
                    const changed = !!current;
                    if (changed) stopSource(true);
                    const source = context.createBufferSource(), gain = context.createGain();
                    current = { source, gain, melody, fadeIn: changed };
                    source.buffer = cachedBuffer;
                    source.loop = true;
                    gain.gain.value = 0;
                    source.connect(gain); gain.connect(context.destination);
                    source.start();
                }
                // Marge de volum per mantenir el fons discret; una melodia nova
                // entra a poc a poc mentre l'anterior s'apaga.
                current.gain.gain.setTargetAtTime(level(), context.currentTime, current.fadeIn ? 0.5 : 0.08);
                current.fadeIn = false;
                failed = false;
            } catch (err) { failed = true; stopSource(); }
        }
        const api = {
            // raw = { sound, volume, melody }: la melodia la tria qui crida
            // (una per partida); si falta, es manté l'anterior.
            // opts.fade: si s'atura, s'esvaeix en lloc de tallar-se.
            update(raw, enabled, opts) {
                wanted = normalize(raw);
                if (raw && raw.melody) melody = melodyId(raw.melody);
                active = !!enabled;
                reconcile(!!(opts && opts.fade));
            },
            // La veu comença (true) o acaba (false) de parlar: el fons baixa de
            // pressa i torna a pujar suaument, sense tocar el bucle.
            duck(on) {
                const value = !!on;
                if (value === ducked) return;
                ducked = value;
                if (!current || !context) return;
                try { current.gain.gain.setTargetAtTime(level(), context.currentTime, value ? 0.12 : 0.6); } catch (err) {}
            },
            // Només crea o reprèn el context des d'una acció autoritzada de la UI.
            unlock() {
                if (!allowed || !active || wanted.sound === 'off' || wanted.volume === 0 || !supported) return;
                try {
                    failed = false;
                    if (!context || context.state === 'closed') context = env.createContext ? env.createContext() : new Ctor();
                    const ctx = context;
                    if (ctx.state !== 'running') {
                        Promise.resolve(ctx.resume()).then(() => { if (context === ctx) reconcile(); }).catch(() => { if (context === ctx) failed = true; });
                    } else reconcile();
                } catch (err) { failed = true; stopSource(); }
            },
            status() {
                if (!allowed || !active || wanted.sound === 'off' || wanted.volume === 0) return 'off';
                if (!supported || failed) return 'unavailable';
                return current && context && context.state === 'running' ? 'playing' : 'waiting';
            },
            // Melodia de la partida i melodia que sona de debò ara mateix.
            melody() { return melody; },
            playing() { return current ? current.melody : null; },
            _reconcile: reconcile,
            dispose() {
                players.delete(api);
                active = false; pending = null; stopSource();
                cachedBuffer = null; cachedMelody = null;
                const ctx = context; context = null;
                try { if (ctx && ctx.close) Promise.resolve(ctx.close()).catch(() => {}); } catch (err) {}
            }
        };
        players.add(api);
        return api;
    }
    // ── Cançons per seccions ────────────────────────────────────────────
    // Comparteix els instruments del motor original. Tempo i tonalitat són
    // globals; cada secció pot sobrescriure els instruments base sense canviar el motiu.
    const SONG_PARTS = {
        intro: { name: 'Intro', bars: 4, energy: 35, description: 'Presenta el ritme i el caràcter de la cançó.' },
        verse: { name: 'Estrofa', bars: 8, energy: 55, description: 'Desenvolupa la història i deixa espai per a la veu.' },
        prechorus: { name: 'Pretornada', bars: 4, energy: 70, description: 'Fa créixer la tensió abans de la tornada.' },
        chorus: { name: 'Tornada', bars: 8, energy: 85, description: 'El motiu principal: memorable i amb més intensitat.' },
        bridge: { name: 'Pont', bars: 4, energy: 45, description: 'Aporta contrast abans de l’última tornada.' },
        solo: { name: 'Instrumental', bars: 8, energy: 75, description: 'Dona protagonisme a la melodia instrumental.' },
        outro: { name: 'Final', bars: 4, energy: 30, description: 'Recupera el motiu i tanca la cançó.' }
    };
    // Preseleccions de treball: no són límits teòrics dels gèneres.
    const SONG_INSTRUMENTS = { guitar: 'Guitarra 1 (rítmica)', drums: 'Bateria', bass: 'Baix', trumpet: 'Trompeta', trombone: 'Segona veu de vent (saxo / trombó)', synthLead: 'Sintetitzador melòdic', synthPad: 'Sintetitzador d’acords', synthBass: 'Baix sintetitzat', electronicDrums: 'Bateria electrònica', sax: 'Saxo tenor', organ: 'Orgue',
        guitar2: 'Guitarra 2 (aguda)', guitar3: 'Guitarra 3 (arpegis)', vocal: 'Melodia de veu (guia)' };
    // Efectes de guitarra que aplica el motor de mostres (vegeu audio/render.mjs).
    const GUITAR_FX = { none: 'Net, sense efecte', boost: 'Boost net', tape: 'Saturació de cinta', crunch: 'Crunch',
        overdrive: 'Overdrive (pedal verd)', distortion: 'Distorsió', metal: 'Metal (guany alt)', fuzz: 'Fuzz', lofi: 'Lo-fi (8 bits)',
        horrorpunk: 'Horror punk (estil Misfits)', horrorpunkFidel: 'Horror punk A · fidel a la gravació', horrorpunkFuzz: 'Horror punk B · fuzz brunzidor',
        horrorpunkGruixut: 'Horror punk C · serra gruixuda', horrorpunkGaratge: 'Horror punk D · garatge cru' };
    const GUITARS = ['guitar', 'guitar2', 'guitar3'];
    function checkFx(fx) {
        if (fx === undefined) return;
        if (!fx || typeof fx !== 'object' || Array.isArray(fx) || Object.entries(fx).some(([name, value]) => !GUITARS.includes(name)
            || !value || typeof value !== 'object' || !Object.hasOwn(GUITAR_FX, value.type)
            || ![value.drive, value.tone].every(n => Number.isFinite(n) && n >= 0 && n <= 100)))
            throw new Error('Efecte de guitarra no vàlid');
    }
    // Equalitzador: greus, mitjos i aguts en dB respecte del so de l'estil, i volum.
    const MIX_LIMITS = { low: [-12, 12], mid: [-12, 12], high: [-12, 12], volume: [-24, 6] };
    function checkMix(mix) {
        if (mix === undefined) return;
        if (!mix || typeof mix !== 'object' || Array.isArray(mix) || Object.entries(mix).some(([name, band]) =>
            (name !== 'master' && !Object.hasOwn(SONG_INSTRUMENTS, name)) || !band || typeof band !== 'object' || Array.isArray(band)
            || Object.keys(band).length !== 4 || Object.entries(MIX_LIMITS).some(([key, [lo, hi]]) => !Number.isFinite(band[key]) || band[key] < lo || band[key] > hi)))
            throw new Error('Equalitzador no vàlid');
    }
    const SONG_STYLES = {
        ska: { instruments: ['guitar', 'drums', 'bass', 'trumpet', 'trombone'], name: 'Ska', bpm: { min: 100, max: 180, default: 128 },
            keys: [[0, 'major'], [5, 'major'], [10, 'major'], [3, 'major'], [7, 'major'], [9, 'minor'], [2, 'minor'], [7, 'minor'], [0, 'minor']],
            description: 'Guitarra a contratemps, baix caminant i metalls.' },
        punk: { instruments: ['guitar', 'drums', 'bass', 'trumpet', 'trombone'], name: 'Punk', bpm: { min: 140, max: 220, default: 180 },
            keys: [[4, 'major'], [9, 'major'], [2, 'major'], [7, 'major'], [0, 'major'], [4, 'minor'], [9, 'minor'], [11, 'minor'], [2, 'minor']],
            description: 'Guitarres amb quintes, corxeres i bateria directa.' },
        urban: { name: 'Urban', instruments: ['synthLead', 'synthPad', 'synthBass', 'electronicDrums'],
            bpm: { min: 70, max: 160, default: 95 },
            keys: [[9, 'minor'], [0, 'minor'], [2, 'minor'], [4, 'minor'], [7, 'minor'], [0, 'major'], [5, 'major'], [7, 'major']],
            description: 'Sintetitzadors melòdics i d’acords, baix profund i bateria electrònica amb ritmes urbans.' }
    };
    // ── Base rítmica ────────────────────────────────────────────────────
    // La bateria, el baix i la guitarra rítmica es trien una vegada per a tota
    // la cançó (i, si cal, per secció). Les cinc versions d'una secció canvien
    // els acords i la melodia, però no la base: així la cançó manté el caràcter.
    const GROOVE_FAMILIES = ['drums', 'bass', 'guitar'];
    const DRUM_GROOVES = {
        ska: [
            { name: 'Ska clàssic', kick: [0, 2], snare: [1, 3], hat: 'offbeat' },
            { name: 'One drop', kick: [2], snare: [2], rim: true, hat: 'eighths' },
            { name: 'Steppers · bombo a negres', kick: [0, 1, 2, 3], snare: [2], rim: true, hat: 'offbeat' },
            { name: 'Rocksteady', kick: [0, 2.5], snare: [1, 3], rim: true, hat: 'eighths' },
            { name: 'Ska-punk', kick: [0, 1.5, 2, 3.5], snare: [1, 3], hat: 'eighths' },
            { name: 'Doble temps', kick: [0, 1, 2, 3], snare: [.5, 1.5, 2.5, 3.5], hat: 'quarters' }
        ],
        punk: [
            { name: 'Punk directe', kick: [0, 2, 2.5], snare: [1, 3], hat: 'eighths' },
            { name: 'Mig temps', kick: [0, 1.5, 3.5], snare: [2], hat: 'quarters' },
            { name: 'D-beat', kick: [0, 1.5, 2, 3.5], snare: [1, 3], hat: 'eighths' },
            { name: 'Skate punk · doble temps', kick: [0, 1, 2, 3], snare: [.5, 1.5, 2.5, 3.5], hat: 'quarters' },
            { name: 'Timbals', kick: [0, 2], snare: [1, 3], hat: 'toms' },
            { name: 'Sincopat', kick: [0, .75, 2, 2.5], snare: [1, 3], hat: 'eighths' }
        ],
        urban: [
            { name: 'Boom bap', kick: [0, 1.75, 2.5], snare: [1, 3], hat: 'eighths', roll: true },
            { name: 'Trap a mig temps', kick: [0, 2.5, 3.25], snare: [2], hat: 'sixteenths', roll: true },
            { name: 'Dembow', kick: [0, 1, 2, 3], snare: [.75, 1.5, 2.75, 3.5], hat: 'eighths', roll: true },
            { name: 'Urban melòdic', kick: [0, .75, 2.5], snare: [1, 3], hat: 'eighths', roll: true },
            { name: 'Sincopat', kick: [0, 1.25, 3], snare: [1, 3], hat: 'sixteenths', roll: true },
            { name: 'Two-step', kick: [0, 2.5], snare: [1, 3], hat: 'offbeat', roll: true }
        ]
    };
    const skaGuitar = ['Contratemps', 'Contratemps amb doble cop', 'Contratemps espaiat', 'Contratemps desplaçat', 'Contratemps sincopat'];
    const SONG_GROOVES = {
        ska: { drums: DRUM_GROOVES.ska.map(g => g.name), guitar: skaGuitar,
            bass: ['Caminant', 'Dub espaiat', 'Octaves', 'Melòdic', 'Sincopat'] },
        punk: { drums: DRUM_GROOVES.punk.map(g => g.name),
            guitar: ['Corxeres', 'Cops i corxeres', 'Sincopat', 'Galop', 'Obert'],
            bass: ['Corxeres', 'Mig temps', 'Galop', 'Riff', 'Sincopat'] },
        urban: { drums: DRUM_GROOVES.urban.map(g => g.name), guitar: skaGuitar,
            bass: ['Sincopat', 'Greu i llarg', 'Dembow', 'Melòdic', 'Amb rebot'] }
    };
    function checkGroove(input, styleName) {
        if (input === undefined) return;
        if (!input || typeof input !== 'object' || Array.isArray(input)
            || Object.entries(input).some(([family, index]) => !GROOVE_FAMILIES.includes(family)
                || !Number.isInteger(index) || index < 0 || index >= SONG_GROOVES[styleName][family].length))
            throw new Error('Base rítmica no vàlida');
    }
    // Partitura de bateria: [compàs, temps, nota General MIDI, força].
    // Segueix la forma de la secció: plat a l'entrada, redoble al final,
    // construcció a la intro, buit al pont i crescendo abans de la tornada.
    // Redobles: cada un és una llista de [temps dins del compàs, peça, força].
    // Mida segons la secció que ve: petit (cap a una estrofa), mitjà o gran
    // (cap a una tornada o un solo). Es tria per secció perquè no es repeteixin.
    const FILLS = {
        small: [
            [[3.5, 38, 70], [3.75, 38, 82]],
            [[3, 38, 84], [3.5, 38, 96]],
            [[3.25, 38, 72], [3.5, 38, 84], [3.75, 38, 96]],
            [[3.5, 45, 90], [3.75, 43, 98]]],
        medium: [
            [[3, 38, 96], [3.25, 38, 82], [3.5, 45, 98], [3.75, 43, 104]],
            [[3, 38, 80], [3.25, 38, 88], [3.5, 38, 96], [3.75, 38, 104]],
            [[3, 48, 98], [3.25, 48, 90], [3.5, 45, 100], [3.75, 43, 106]],
            [[3, 38, 94], [3.333, 38, 98], [3.667, 38, 104]],
            [[2.5, 38, 90], [3, 45, 96], [3.5, 43, 102], [3.75, 36, 100]]],
        big: [
            [[2.5, 38, 98], [2.75, 38, 86], [3, 48, 102], [3.25, 48, 94], [3.5, 45, 104], [3.75, 43, 108]],
            [[2, 38, 84], [2.25, 38, 88], [2.5, 38, 92], [2.75, 38, 96], [3, 38, 100], [3.25, 38, 104], [3.5, 38, 110], [3.75, 38, 116]],
            [[2, 48, 100], [2.5, 45, 100], [3, 43, 104], [3.5, 41, 108], [2, 36, 100], [3, 36, 104]],
            [[2.5, 38, 104], [2.5, 36, 104], [3, 38, 106], [3, 36, 106], [3.5, 38, 112], [3.5, 36, 112]],
            [[2, 38, 92], [2.25, 48, 92], [2.5, 48, 96], [2.75, 45, 96], [3, 45, 100], [3.25, 43, 100], [3.5, 43, 106], [3.75, 41, 110]],
            [[3, 38, 90], [3.125, 38, 76], [3.25, 38, 94], [3.375, 38, 80], [3.5, 38, 100], [3.625, 38, 86], [3.75, 38, 108], [3.875, 38, 92]]]
    };
    function composeDrumLine(styleName, index, type, bars, energy, options = {}) {
        const g = DRUM_GROOVES[styleName][index], line = [];
        // Mida del redoble final segons el que ve després.
        const next = options.next, ending = options.ending || 'fill';
        const size = next === 'chorus' || next === 'solo' || next === 'end' ? 'big' : next === undefined ? null : next === type ? 'small' : 'medium';
        const pickFill = (wanted, salt = 0) => { const list = FILLS[wanted]; return list[((options.fill || 0) * 7 + salt * 3 + index) % list.length]; };
        const hit = (b, t, note, force) => line.push([b, t, note, force]);
        const big = energy >= 70, quiet = energy < 45, half = Math.max(1, Math.floor(bars / 2));
        const buildBars = type === 'intro' ? Math.min(2, half) : 0;
        for (let b = 0; b < bars; b++) {
            const final = type === 'outro' && b === bars - 1;
            // Final: redoble gran al penúltim compàs i cop final de tota la banda.
            const last = b === bars - 1 || (type === 'outro' && b === bars - 2 && bars > 1);
            if (final) { hit(b, 0, 36, 118); hit(b, 0, 38, 104); hit(b, 0, 49, 112); hit(b, 0, 57, 100); continue; }
            // Compte d'entrada: quatre cops de baqueta i comença la banda.
            if (options.countIn && b === 0) { [0, 1, 2, 3].forEach((t, k) => hit(b, t, 37, k < 3 ? 92 : 108)); continue; }
            // Aturada de la banda: un cop junts i silenci fins al redoble que entra.
            if (ending === 'stop' && b === bars - 1 && bars > 1) {
                hit(b, 0, 36, 116); hit(b, 0, 38, 106); hit(b, 0, 49, 108);
                pickFill('small', 1).forEach(([t, note, force]) => hit(b, t, note, force));
                continue;
            }
            const build = b < buildBars, drop = type === 'bridge' && b < half;
            const crescendo = last && (type === 'prechorus' || type === 'bridge');
            const fillSize = last && ending !== 'none' ? (type === 'outro' ? 'big' : size ? (quiet && size === 'big' ? 'medium' : size) : big ? 'big' : quiet ? 'small' : 'medium') : null;
            const fillFrom = crescendo ? 0 : !fillSize ? 4 : Math.min(...pickFill(fillSize).map(([t]) => t));
            if (!build && !drop && ((b === buildBars && !quiet) || (b > 0 && b % 4 === 0 && big))) hit(b, 0, 49, b ? 92 : big ? 108 : 96);
            (build ? [0] : g.kick).forEach((t, k) => { if (t < fillFrom) hit(b, t, 36, build ? 92 : k ? 106 : 112); });
            if (!build) g.snare.forEach(t => {
                if (t < fillFrom) (drop || quiet || g.rim) ? hit(b, t, 37, drop || quiet ? 80 : 94) : hit(b, t, 38, 106);
            });
            const hat = build ? 'eighths' : drop ? 'quarters' : g.hat;
            const steps = hat === 'sixteenths' ? 16 : hat === 'quarters' ? 4 : 8;
            for (let k = 0; k < steps; k++) {
                const t = k * 4 / steps; if (t >= fillFrom) break;
                if (hat === 'sixteenths') hit(b, t, 42, [78, 42, 60, 42][k % 4]);
                else if (hat === 'quarters') hit(b, t, big && !drop ? 51 : 42, drop ? 58 : 84);
                else if (hat === 'toms') hit(b, t, k % 4 === 3 ? 45 : 43, k % 2 ? 68 : 88);
                else if (hat === 'offbeat') hit(b, t, k % 2 && big ? 46 : 42, k % 2 ? 84 : 48);
                else hit(b, t, k === 7 && !quiet && !build ? 46 : 42, k % 2 ? 56 : 76);
            }
            if (crescendo) {
                // Caixa en corxeres i després semicorxeres, cada cop més forta.
                [0, 1, 2, 3].forEach(t => hit(b, t, 36, 104));
                [0, .5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75].forEach((t, k) => hit(b, t, 38, 62 + k * 5));
            } else if (last && g.roll) {
                for (let t = fillFrom; t < 4; t += .125) hit(b, t, 42, 50 + Math.round((t - fillFrom) * 28));
                hit(b, 3.5, 38, 98); if (big) hit(b, 3.75, 38, 104);
            } else if (last && ending !== 'none') {
                const wanted = type === 'outro' ? 'big' : size ? (quiet && size === 'big' ? 'medium' : size) : big ? 'big' : quiet ? 'small' : 'medium';
                const fill = pickFill(wanted);
                fill.forEach(([t, note, force]) => hit(b, t, note, force));
                if (wanted === 'big' && !fill.some(([t, note]) => note === 36 && t === 3)) hit(b, 3, 36, 104);
            } else if (b % 4 === 3 && !build && !drop && !quiet) {
                // Petit avís al final de cada frase de quatre compassos.
                hit(b, 3.75, 38, 64); if (!g.kick.includes(3.5)) hit(b, 3.5, 36, 92);
            }
        }
        return line;
    }
    // ── Harmonia per símbols ────────────────────────────────────────────
    // Graus romans amb alteracions: majúscula = major, minúscula = menor;
    // «7» = setena (dominant si és major), «maj7», «°» = disminuït, «sus4», i
    // dominants secundàries amb «/» (V7/vi). Permet acords prestats (bVII, iv,
    // bVI...) i el llenguatge propi de cada subgènere.
    const ROMAN = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
    const QUALITY = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], sus4: [0, 5, 7] };
    function parseChordSymbol(symbol) {
        const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|maj7|7|sus4)?$/.exec(symbol);
        if (!m) throw new Error(`Acord desconegut: ${symbol}`);
        const upper = m[2] === m[2].toUpperCase();
        const offset = ROMAN[m[2].toUpperCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0);
        const quality = m[3] === '°' ? 'dim' : m[3] === 'maj7' ? 'maj7' : m[3] === '7' ? (upper ? 'dom7' : 'min7') : m[3] === 'sus4' ? 'sus4' : upper ? 'maj' : 'min';
        return { offset, quality };
    }
    function chordFromSymbol(tonic, symbol) {
        const [main, target] = symbol.split('/');
        const base = target ? (tonic + parseChordSymbol(target).offset + 12) % 12 : tonic;
        const { offset, quality } = parseChordSymbol(main), root = (base + offset + 12) % 12;
        const pcs = QUALITY[quality].map(i => (root + i) % 12);
        return { degree: -1, symbol, pcs, root: bassOf(pcs[0]), notes: voice(pcs, 55, false) };
    }
    // ── Subgèneres: cadascun té el seu llenguatge ───────────────────────
    // Tempo, tonalitats, ritmes, balanceig, sons, efectes i progressions pròpies.
    const SUBGENRES = {
        jamaican: { name: 'Ska jamaicà (anys 60)', style: 'ska', bpm: [110, 128], swing: .45, keys: [[5, 'major'], [10, 'major'], [3, 'major'], [0, 'major']],
            groove: { drums: [0, 3], bass: [0, 3], guitar: [0, 1] }, base: ['drums', 'bass', 'guitar', 'organ'], timbres: { drums: 'club', bass: 'upright', trombone: 'vsco' }, humanize: .65,
            description: 'Jazz i rhythm and blues jamaicà: balanceig, kit de club de jazz, contrabaix, acords de setena i secció de vents fent el tema.',
            harmony: { major: {
                verse: [['I', 'vi', 'ii7', 'V7'], ['I', 'IV', 'I', 'V7'], ['Imaj7', 'vi7', 'ii7', 'V7'], ['I', 'I7', 'IV', 'iv']],
                chorus: [['IV', 'V7', 'I', 'vi'], ['ii7', 'V7', 'I', 'VI7'], ['I', 'IV', 'V7', 'IV']],
                prechorus: [['ii7', 'V7', 'ii7', 'V7']], bridge: [['IV', 'iv', 'I', 'VI7'], ['ii7', 'V7', 'iii7', 'VI7']] } } },
        rocksteady: { name: 'Rocksteady', style: 'ska', bpm: [100, 108], swing: .15, keys: [[9, 'minor'], [2, 'minor'], [7, 'minor'], [0, 'major']],
            groove: { drums: [1, 3], bass: [1, 3], guitar: [2] }, base: ['drums', 'bass', 'guitar', 'organ'], timbres: { trumpet: 'muted', bass: 'finger', drums: 'lofi' }, humanize: .7,
            description: 'Més lent i greu que l’ska: one drop, baix dub en primer pla, orgue de fons i vents amb sordina.',
            harmony: { minor: {
                verse: [['i', 'bVII', 'bVI', 'bVII'], ['i', 'iv', 'bVII', 'bIII'], ['i7', 'iv7', 'i7', 'v7']],
                chorus: [['bVI', 'bVII', 'i', 'i'], ['iv', 'bVII', 'bIII', 'bVI'], ['i', 'bVI', 'bIII', 'bVII']],
                bridge: [['iv', 'i', 'bVI', 'V7']] },
              major: { verse: [['I', 'vi', 'IV', 'V'], ['I', 'iii', 'IV', 'V']], chorus: [['IV', 'I', 'V', 'vi']], bridge: [['vi', 'IV', 'ii', 'V7']] } } },
        twotone: { name: 'Ska 2-tone', style: 'ska', bpm: [132, 156], swing: 0, keys: [[0, 'major'], [7, 'major'], [9, 'minor'], [2, 'minor']],
            groove: { drums: [0, 4], bass: [0, 2], guitar: [0, 1] }, base: ['drums', 'bass', 'guitar'], timbres: {}, humanize: .5,
            description: 'L’ska britànic de finals dels 70: més ràpid i nerviós, guitarra a contratemps, orgue i metalls amb riffs.',
            harmony: { major: {
                verse: [['I', 'vi', 'IV', 'V'], ['I', 'IV', 'I', 'V'], ['I', 'V7/vi', 'vi', 'IV']],
                chorus: [['I', 'V', 'vi', 'IV'], ['IV', 'V', 'iii', 'vi'], ['vi', 'IV', 'I', 'V']],
                prechorus: [['ii', 'V', 'ii', 'V']], bridge: [['ii', 'V', 'I', 'vi'], ['IV', 'iv', 'I', 'I']] },
              minor: { verse: [['i', 'bVII', 'bVI', 'V7'], ['i', 'iv', 'bVII', 'i']], chorus: [['bVI', 'bVII', 'i', 'i'], ['i', 'bIII', 'bVII', 'iv']], bridge: [['iv', 'V7', 'i', 'bVI']] } } },
        skapunk: { name: 'Ska-punk', style: 'ska', bpm: [160, 180], swing: 0, keys: [[7, 'major'], [0, 'major'], [10, 'major'], [9, 'minor']],
            groove: { drums: [4, 5], bass: [2, 4], guitar: [3, 4] }, base: ['drums', 'bass', 'guitar'], timbres: { drums: 'real', bass: 'pick' }, humanize: .45, countIn: true,
            description: 'Estrofes a contratemps i tornades amb guitarres distorsionades i metalls a l’uníson, a tota velocitat.',
            harmony: { major: {
                verse: [['I', 'IV', 'V', 'IV'], ['I', 'bVII', 'IV', 'I'], ['I', 'V', 'IV', 'V']],
                chorus: [['I', 'V', 'vi', 'IV'], ['IV', 'I', 'V', 'vi'], ['I', 'IV', 'bVII', 'IV']], bridge: [['vi', 'IV', 'I', 'V']] },
              minor: { verse: [['i', 'bVI', 'bVII', 'i']], chorus: [['bVI', 'bVII', 'i', 'bIII']], bridge: [['iv', 'bVI', 'bVII', 'V']] } } },
        punk77: { name: 'Punk del 77', style: 'punk', bpm: [180, 205], swing: 0, keys: [[9, 'major'], [4, 'major'], [2, 'major'], [7, 'major']],
            groove: { drums: [0], bass: [0], guitar: [0] }, base: ['drums', 'bass', 'guitar'], timbres: { drums: 'rusty', bass: 'pick', guitar: 'clean' }, humanize: .55, countIn: true,
            fx: { type: 'distortion', drive: 60, tone: 60 },
            description: 'Tres acords, corxeres a cops avall i tornades per cridar: directe, ràpid i sense floritures.',
            harmony: { major: {
                verse: [['I', 'IV', 'V', 'IV'], ['I', 'I', 'IV', 'V'], ['I', 'bVII', 'IV', 'I']],
                chorus: [['I', 'IV', 'V', 'I'], ['IV', 'V', 'I', 'I'], ['I', 'V', 'IV', 'IV']], bridge: [['IV', 'IV', 'V', 'V']] } } },
        hardcore: { name: 'Hardcore', style: 'punk', bpm: [200, 220], swing: 0, keys: [[11, 'minor'], [4, 'minor'], [9, 'minor'], [2, 'minor']],
            groove: { drums: [2, 3], bass: [3, 4], guitar: [2, 0] }, base: ['drums', 'bass', 'guitar'], timbres: { drums: 'rusty', bass: 'growly', guitar: 'clean' }, drumTune: -2, humanize: .35, countIn: true,
            fx: { type: 'fuzz', drive: 75, tone: 55 },
            description: 'Molt ràpid i agressiu: D-beat, fuzz, tornades en doble temps i un tros lent i pesant («breakdown»).',
            harmony: { minor: {
                verse: [['i', 'bVI', 'bVII', 'i'], ['i', 'i', 'bII', 'i'], ['i', 'iv', 'bVI', 'bVII']],
                chorus: [['bVI', 'bVII', 'i', 'i'], ['i', 'bIII', 'bVII', 'bVI']], bridge: [['i', 'bII', 'i', 'bII']] } } },
        poppunk: { name: 'Pop-punk', style: 'punk', bpm: [165, 185], swing: 0, keys: [[2, 'major'], [7, 'major'], [4, 'major'], [9, 'major']],
            groove: { drums: [0, 3], bass: [1, 4], guitar: [1, 0] }, base: ['drums', 'bass', 'guitar'], timbres: { drums: 'real', bass: 'finger', guitar: 'clean' }, humanize: .3, countIn: true,
            fx: { type: 'overdrive', drive: 55, tone: 60 },
            description: 'Melòdic i lluminós: tornades enganxoses, guitarres amb overdrive, arpegis i pujada de to final.',
            harmony: { major: {
                verse: [['I', 'V', 'vi', 'IV'], ['vi', 'IV', 'I', 'V'], ['I', 'iii', 'IV', 'V']],
                chorus: [['I', 'V', 'vi', 'IV'], ['IV', 'I', 'V', 'vi'], ['vi', 'IV', 'I', 'V']],
                prechorus: [['IV', 'V', 'vi', 'V']], bridge: [['ii', 'IV', 'vi', 'V'], ['IV', 'V', 'iii', 'vi']] } } },
        horrorpunk: { name: 'Horror punk', style: 'punk', bpm: [170, 192], swing: 0, keys: [[4, 'major'], [9, 'major'], [4, 'minor'], [9, 'minor']],
            groove: { drums: [0], bass: [0], guitar: [0] }, base: ['drums', 'bass', 'guitar'], timbres: { drums: 'rusty', bass: 'pick', guitar: 'clean' }, drumTune: -3, humanize: .5, countIn: true,
            fx: { type: 'horrorpunk', drive: 70, tone: 60 },
            description: 'A l’estil dels Misfits: guitarres «serra mecànica» doblades, acords prestats foscos, veu greu i «whoa-oh».',
            harmony: { major: {
                verse: [['I', 'bVI', 'bVII', 'I'], ['I', 'bIII', 'IV', 'I']], chorus: [['I', 'bVI', 'bVII', 'I'], ['vi', 'IV', 'I', 'V']], bridge: [['bVI', 'bVII', 'I', 'I']] },
              minor: { verse: [['i', 'bVI', 'bIII', 'bVII']], chorus: [['i', 'bVII', 'bVI', 'V7']], bridge: [['iv', 'i', 'V7', 'i']] } } }
    };
    function paletteFor(subgenre, mode, type) {
        const pal = SUBGENRES[subgenre]?.harmony[mode] || Object.values(SUBGENRES[subgenre]?.harmony || {})[0];
        if (!pal) return null;
        const fallback = { intro: 'verse', solo: 'verse', outro: 'chorus', prechorus: 'chorus', bridge: 'verse' };
        return pal[type] || pal[fallback[type]] || pal.verse;
    }
    // ── Riff de la cançó ────────────────────────────────────────────────
    // Un motiu de dos compassos (ritme i contorn en graus de l'escala) que
    // identifica la cançó: es toca a la intro, les tornades i el final, s'adapta
    // als acords de cada compàs i varia el final de cada quarta repetició.
    function composeRiff(seed, punk) {
        const r = seededRng((seed ^ 0x2f7a1c3) >>> 0);
        const rhythms = punk ? [
            [[0, .5], [.5, .5], [1, .5], [1.5, .5], [2, 1], [3, .5], [3.5, .5], [4, .5], [4.5, .5], [5, 1], [6, 2]],
            [[0, 1], [1, .5], [1.5, .5], [2, 1], [3, 1], [4, .5], [4.5, .5], [5, .5], [5.5, .5], [6, 1.5]],
            [[0, .5], [.5, .5], [1, 1], [2.5, .5], [3, 1], [4, .5], [4.5, .5], [5, 1], [6.5, 1]]]
          : [
            [[.5, .5], [1, .5], [1.5, 1], [3, .5], [3.5, .5], [4.5, .5], [5, .5], [5.5, 1.5]],
            [[0, .5], [.5, .5], [1, .5], [1.5, 1], [3.5, .5], [4, .5], [4.5, .5], [5, .5], [5.5, 1], [7, .5]],
            [[0, 1.5], [1.5, .5], [2, .5], [2.5, 1], [4, .5], [4.5, .5], [5, 1], [6, 1]],
            [[.5, .5], [1, 1], [2, .5], [2.5, .5], [3, 1], [4.5, .5], [5, 1.5], [6.5, .5]]];
        const rhythm = rhythms[Math.floor(r() * rhythms.length)], steps = [0];
        const peak = Math.floor(rhythm.length * (.35 + r() * .3));
        for (let i = 1; i < rhythm.length; i++) {
            const up = i <= peak ? 1 : -1, size = r() < .65 ? 1 : r() < .7 ? 2 : 0;
            steps.push(r() < .15 ? -up * Math.max(1, size) : up * size);
        }
        return { rhythm, steps };
    }
    function moveByScale(pitch, steps, scalePcs, chord, lo, hi) {
        let p = pitch;
        for (let k = 0; k < Math.abs(steps); k++) p = stepScale(p, Math.sign(steps), scalePcs, chord, lo, hi);
        return p;
    }
    function realizeRiff(riff, chords, bars, scalePcs, from = 0, to = bars * 4, only = null) {
        const notes = [], lo = 64, hi = 81;
        for (let start = 0, rep = 0; start < bars * 4; start += 8, rep++) {
            let prev = null;
            riff.rhythm.forEach(([t, d], i) => {
                const at = start + t;
                if (at < from || at >= to || (only && !only(t))) return;
                const chord = chords[Math.min(chords.length - 1, Math.floor(at / 4))];
                let step = riff.steps[i];
                // Desenvolupament: la quarta repetició acaba al revés (pregunta-resposta).
                if (rep % 4 === 3 && i >= riff.rhythm.length - 2) step = -step;
                let p = prev === null ? nearestTone(72, chord.pcs, lo, hi) : moveByScale(prev, step, scalePcs, chord, lo, hi);
                if (at % 1 === 0 || d >= 1) p = nearestTone(p, chord.pcs, lo, hi);
                notes.push([Math.floor(at / 4), at % 4, p, Math.min(d, bars * 4 - at)]);
                prev = p;
            });
        }
        return notes;
    }
    // Segona veu: la mateixa línia una tercera diatònica per sota.
    const harmonize = (notes, chords, scalePcs) => notes.map(([b, t, p, d]) => [b, t, moveByScale(p, -2, scalePcs, chords[b], 52, 84), d]);
    // Respostes: fragments del riff als silencis de la veu (pregunta i resposta).
    function answerLine(riff, chords, bars, scalePcs, vocal) {
        const head = riff.rhythm.filter(([t]) => t < 3), span = Math.max(...head.map(([t, d]) => t + d)) - head[0][0];
        // Forats de la veu [inici, final]: la resposta només hi posa les notes que hi caben.
        const gaps = [];
        if (vocal && vocal.length) {
            const abs = vocal.map(([b, t, , d]) => [b * 4 + t, b * 4 + t + d]).sort((a, b) => a[0] - b[0]);
            let cursor = 0;
            for (const [s, e] of [...abs, [bars * 4, bars * 4]]) {
                const from = Math.ceil((cursor + .25) * 2) / 2;
                if (s - from >= 1) gaps.push([from, s]);
                cursor = Math.max(cursor, e);
            }
        } else for (let b = 1; b < bars; b += 2) gaps.push([b * 4 + 1.5, b * 4 + 1.5 + span]);
        const notes = [];
        for (const [gap, end] of gaps) {
            let prev = null;
            head.forEach(([t, d], i) => {
                const at = gap + t - head[0][0];
                if (at >= end - .25 || at >= bars * 4) return;
                const chord = chords[Math.floor(at / 4)];
                let p = prev === null ? nearestTone(74, chord.pcs, 64, 81) : moveByScale(prev, riff.steps[i], scalePcs, chord, 64, 81);
                if (at % 1 === 0) p = nearestTone(p, chord.pcs, 64, 81);
                notes.push([Math.floor(at / 4), at % 4, p, Math.min(d, end - at, bars * 4 - at)]); prev = p;
            });
        }
        return notes;
    }
    // ── Melodia de veu (guia per cantar) ────────────────────────────────
    // Frases de dos compassos amb respiracions: cada línia de la lletra és una
    // frase i té tantes notes com síl·labes. Sense lletra, frases amb pauses i
    // una tornada amb un motiu que es repeteix. Registre cantable, salts curts,
    // notes de l'acord als temps forts i final de frase en una nota estable.
    function composeVocal(r, chords, bars, type, scalePcs, syllables, register) {
        const shift = register * 5, lo = 57 + shift, hi = 74 + shift;
        const center = (type === 'chorus' ? 67 : type === 'prechorus' ? 66 : type === 'verse' ? 63 : 64) + shift;
        const notes = [], lyrics = Array.isArray(syllables) && syllables.length > 0;
        const longest = lyrics ? Math.max(...syllables) : 0, phraseBars = longest > 11 && bars >= 4 ? 4 : 2;
        const rhythmFor = (count, span) => {
            const pickup = r() < .45 ? .5 : r() < .5 ? 0 : 1, rest = type === 'chorus' ? 1 : 1.5;
            const end = span - rest;
            let grid = .5;
            if ((count - 1) * grid + 1 > end - pickup) grid = .25;
            count = Math.max(1, Math.min(count, Math.floor((end - pickup - .5) / grid) + 1));
            const last = Math.max(.5, Math.min(type === 'chorus' ? 2 : 1.5, end - pickup - (count - 1) * grid));
            const lengths = Array(count - 1).fill(grid);
            let extra = end - pickup - last - (count - 1) * grid;
            for (let guard = 0; extra >= grid - 1e-9 && lengths.length && guard < 64; guard++) {
                const k = Math.floor(r() * lengths.length); lengths[k] += grid; extra -= grid;
            }
            const out = []; let at = pickup;
            for (const length of lengths) { out.push([at, length]); at += length; }
            out.push([at, last]);
            return out;
        };
        const pitchesFor = (rhythm, startBar) => {
            const peak = .35 + r() * .3, out = [];
            // Comença a prop d'on va acabar la frase anterior (o del centre del registre).
            const from = lastNote ?? center - 2 + Math.round(r() * 4);
            let prev = nearestTone(Math.round((from * 2 + center) / 3) + (r() < .5 ? 1 : -1), chords[startBar].pcs, lo, hi);
            rhythm.forEach(([at], k) => {
                const bar = Math.min(bars - 1, startBar + Math.floor(at / 4)), chord = chords[bar], pos = k / Math.max(1, rhythm.length - 1);
                const target = center + (pos < peak ? 3 : -2), dir = prev === target ? (r() < .5 ? -1 : 1) : Math.sign(target - prev);
                let n;
                if (k === rhythm.length - 1) n = nearestTone(prev - 1, [chord.pcs[0], chord.pcs[1]], lo, hi);
                else if (k > 0 && r() < .18) n = prev; // síl·labes repetides a la mateixa nota
                else if (at % 1 === 0) n = nearestTone(prev + dir * (1 + Math.floor(r() * 3)), chord.pcs, lo, hi);
                else n = stepScale(prev, dir, scalePcs, chord, lo, hi);
                if (Math.abs(n - prev) > 7) n = nearestTone(prev + Math.sign(n - prev) * 4, chord.pcs, lo, hi);
                out.push(n); prev = n;
            });
            lastNote = prev;
            return out;
        };
        let hook = null, line = 0, lastNote = null;
        for (let start = 0, phrase = 0; start < bars; start += phraseBars, phrase++) {
            const span = Math.min(phraseBars, bars - start) * 4;
            if (span < 2) break;
            let count;
            if (lyrics) { if (line >= syllables.length) break; count = syllables[line++]; }
            else {
                // Respiracions: el pont i la intro canten frase sí, frase no.
                if ((type === 'bridge' || type === 'intro' || type === 'outro') && phrase % 2 === 1) continue;
                count = type === 'chorus' ? 5 + Math.floor(r() * 3) : 6 + Math.floor(r() * 4);
            }
            let rhythm, pitches;
            // A la tornada sense lletra, la frase 1 i la 3 són el mateix motiu.
            if (!lyrics && type === 'chorus' && hook && phrase % 2 === 0) [rhythm, pitches] = hook;
            else { rhythm = rhythmFor(count, span); pitches = pitchesFor(rhythm, start); }
            if (!lyrics && type === 'chorus' && !hook) hook = [rhythm, pitches];
            rhythm.forEach(([at, length], k) => {
                const absolute = start * 4 + at;
                if (absolute < bars * 4) notes.push([Math.floor(absolute / 4), absolute % 4, pitches[k], Math.min(length, bars * 4 - absolute)]);
            });
        }
        return notes;
    }
    function composeSongPart(settings, part) {
        if (!Object.hasOwn(SONG_PARTS, part.type)) throw new Error('Tipus de secció desconegut');
        const bars = Number(part.bars), bpm = Number(settings.bpm);
        let tonic = Number(settings.tonic);
        const style = SONG_STYLES[settings.style];
        if (!Object.hasOwn(SONG_STYLES, settings.style) || !Number.isInteger(bars) || bars < 1 || bars > 64
            || !Number.isInteger(bpm) || bpm < style.bpm.min || bpm > style.bpm.max
            || !style.keys.some(([key, mode]) => key === tonic && mode === settings.mode)) throw new Error('Configuració musical no vàlida per a aquest estil');
        // Tempo propi del tram (canvis de tempo dins la cançó): 40–240 BPM.
        if (part.bpm !== undefined && (!Number.isInteger(part.bpm) || part.bpm < 40 || part.bpm > 240)) throw new Error('Tempo de la secció no vàlid');
        const tempo = part.bpm ?? bpm;
        // Canvi de to de la secció (modulació), en semitons: p. ex. +2 a l'última tornada.
        if (part.transpose !== undefined && (!Number.isInteger(part.transpose) || part.transpose < -6 || part.transpose > 6)) throw new Error('Canvi de to no vàlid');
        tonic = (tonic + (part.transpose || 0) + 12) % 12;
        // Ritme relatiu de cada instrument: mig temps (0,5), normal o doble temps (2).
        if (part.feel !== undefined && (!part.feel || typeof part.feel !== 'object' || Array.isArray(part.feel)
            || Object.entries(part.feel).some(([name, factor]) => !Object.hasOwn(SONG_INSTRUMENTS, name) || ![.5, 1, 2].includes(factor))))
            throw new Error('Ritme d’instrument no vàlid');
        if (settings.subgenre !== undefined && (!Object.hasOwn(SUBGENRES, settings.subgenre) || SUBGENRES[settings.subgenre].style !== settings.style))
            throw new Error('Subgènere no vàlid per a aquest estil');
        if (settings.swing !== undefined && (!Number.isFinite(settings.swing) || settings.swing < 0 || settings.swing > .7)) throw new Error('Balanceig no vàlid');
        // Bateria: platets ('all', 'hats' sense plats, 'none' sense cap platet, 'rim' pols a l'aro),
        // afinació en semitons i humanització del ritme (0 = quantitzat, 1 = molt humà).
        const CYMBALS = ['all', 'hats', 'none', 'rim'];
        if (settings.cymbals !== undefined && !CYMBALS.includes(settings.cymbals)) throw new Error('Opció de platets no vàlida');
        if (part.cymbals !== undefined && !CYMBALS.includes(part.cymbals)) throw new Error('Opció de platets no vàlida');
        if (settings.drumTune !== undefined && (!Number.isInteger(settings.drumTune) || settings.drumTune < -6 || settings.drumTune > 3)) throw new Error('Afinació de bateria no vàlida');
        if (settings.humanize !== undefined && (!Number.isFinite(settings.humanize) || settings.humanize < 0 || settings.humanize > 1)) throw new Error('Humanització no vàlida');
        // Arranjament: secció que ve després (o 'end'), variant del redoble, final de la
        // secció ('fill' redoble, 'stop' aturada de la banda, 'none' sense redoble) i compte d'entrada.
        if (part.next !== undefined && part.next !== 'end' && !Object.hasOwn(SONG_PARTS, part.next)) throw new Error('Secció següent no vàlida');
        if (part.fill !== undefined && (!Number.isInteger(part.fill) || part.fill < 0 || part.fill > 1000)) throw new Error('Redoble no vàlid');
        if (part.ending !== undefined && !['fill', 'stop', 'none'].includes(part.ending)) throw new Error('Final de secció no vàlid');
        if (part.countIn !== undefined && typeof part.countIn !== 'boolean') throw new Error('Compte d’entrada no vàlid');
        if (part.lineModes !== undefined && (!part.lineModes || typeof part.lineModes !== 'object' || Array.isArray(part.lineModes)
            || Object.entries(part.lineModes).some(([name, mode]) => !['trumpet', 'trombone', 'sax', 'synthLead', 'guitar3'].includes(name) || !['riff', 'answer'].includes(mode))))
            throw new Error('Mode de línia no vàlid');
        if (part.syllables !== undefined && (!Array.isArray(part.syllables) || part.syllables.length > 32
            || part.syllables.some(n => !Number.isInteger(n) || n < 1 || n > 24))) throw new Error('Síl·labes de la lletra no vàlides');
        if (part.register !== undefined && ![-1, 0, 1].includes(part.register)) throw new Error('Registre de la veu no vàlid');
        const instruments = part.instruments === undefined ? (settings.instruments === undefined ? style.instruments : settings.instruments) : part.instruments;
        // Una secció pot quedar sense cap instrument (p. ex. tota la base silenciada): sona en silenci.
        if (!Array.isArray(instruments) || new Set(instruments).size !== instruments.length
            || instruments.some(instrument => !Object.hasOwn(SONG_INSTRUMENTS, instrument))) throw new Error('Selecciona instruments vàlids');
        const energy = Number(part.energy);
        if (!Number.isFinite(energy) || energy < 0 || energy > 100) throw new Error('Intensitat no vàlida');
        const eligible = ['intro', 'verse', 'chorus'].includes(part.type);
        const variation = part.variantIndex === undefined
            ? (eligible && Array.isArray(part.variants) ? part.variants.indexOf(part.revision) : -1)
            : part.variantIndex;
        if (!Number.isInteger(variation) || variation < -1 || variation > 4 || (variation !== -1 && !eligible))
            throw new Error('Versió musical no vàlida');
        checkGroove(settings.groove, settings.style); checkGroove(part.groove, settings.style);
        checkMix(settings.mix); checkMix(part.mix); checkFx(settings.fx); checkFx(part.fx);
        // Sense base rítmica (projectes antics), cada versió porta el seu patró.
        const groove = {};
        for (const name of GROOVE_FAMILIES) groove[name] = part.groove?.[name] ?? settings.groove?.[name]
            ?? (variation >= 0 ? variation : name === 'bass' ? -1 : 0);
        const family = part.type === 'chorus' ? 31 : part.type === 'verse' ? 17 : Object.keys(SONG_PARTS).indexOf(part.type) * 47 + 3;
        const seed = ((settings.seed >>> 0) + Math.imul(family, 7919) + Math.imul(part.revision || 1, 104729)) >>> 0;
        const r = seededRng(seed), mode = settings.mode;
        const choices = PHRASES[mode];
        let degrees = pickOf(r, part.type === 'bridge' ? choices.b : choices.a).slice();
        if (part.type === 'chorus') degrees = mode === 'major' ? [0, 4, 5, 3] : [0, 5, 2, 6];
        if (part.type === 'intro') degrees = [0, 0, 3, 4];
        // Cinc recorreguts harmònics i motius rítmics diferenciats per secció.
        // Manté la tonalitat i el tempo comuns, però no recicla la mateixa idea.
        if (variation >= 0) {
            const progressions = {
                intro: [[0, 0, 3, 4], [0, 5, 3, 4], [0, 4, 3, 0], [5, 3, 4, 0], [0, 3, 5, 4]],
                verse: [[0, 3, 4, 0], [0, 5, 4, 3], [5, 4, 0, 3], [0, 4, 5, 0], [0, 3, 5, 4]],
                chorus: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 5], [5, 3, 0, 4], [0, 4, 3, 5]]
            };
            degrees = progressions[part.type][variation].slice();
            if (mode === 'minor' && variation === 0 && part.type === 'chorus') degrees = [0, 5, 2, 6];
        }
        degrees = Array.from({ length: bars }, (_, i) => degrees[i % degrees.length]);
        if (part.type === 'outro') degrees[bars - 1] = 0;
        // Amb subgènere, les progressions surten del seu llenguatge harmònic.
        const palette = settings.subgenre ? paletteFor(settings.subgenre, mode, part.type) : null;
        let chords;
        if (palette) {
            const progression = palette[(variation >= 0 ? variation : (part.revision || 1) - 1) % palette.length];
            chords = Array.from({ length: bars }, (_, i) => chordFromSymbol(tonic, progression[i % progression.length]));
            if (part.type === 'outro') chords[bars - 1] = chordFromSymbol(tonic, mode === 'major' ? 'I' : 'i');
        } else chords = degrees.map(d => buildChord(tonic, mode, d, { chordBase: 55 }, false));
        const ctx = { chords, scalePcs: SCALES[mode].map(n => (tonic + n) % 12), lo: 64, hi: part.type === 'chorus' ? 84 : 79, center: 72, maxJump: 3 };
        ctx.prev = nearestTone(72, chords[0].pcs, 64, 79);
        let rhythms = part.type === 'chorus' ? [RHYTHMS.r2, RHYTHMS.r5, RHYTHMS.r2, RHYTHMS.r7] : [RHYTHMS.r9, RHYTHMS.r3, RHYTHMS.r5, RHYTHMS.r7];
        if (variation >= 0) {
            const patterns = [
                [RHYTHMS.r2, RHYTHMS.r5, RHYTHMS.r2, RHYTHMS.r7],
                [RHYTHMS.r9, RHYTHMS.r3, RHYTHMS.r5, RHYTHMS.r7],
                [RHYTHMS.r3, RHYTHMS.r7, RHYTHMS.r9, RHYTHMS.r5],
                [RHYTHMS.r5, RHYTHMS.r2, RHYTHMS.r7, RHYTHMS.r3],
                [RHYTHMS.r7, RHYTHMS.r9, RHYTHMS.r3, RHYTHMS.r2]
            ];
            rhythms = patterns[variation];
        }
        // Les seccions curtes (menys de quatre compassos) fan servir només una part de la frase.
        const phraseBars = [0, 1, 2, 3].slice(0, Math.min(4, bars));
        const repeat = notes => {
            const out = [];
            for (let b = 0; b < bars; b += 4) notes.forEach(n => { if (n[0] + b < bars) out.push([n[0] + b, n[1], n[2], n[3]]); });
            return out;
        };
        const melody = repeat(composePhrase(r, ctx, phraseBars, rhythms).notes);
        // Capes: cada instrument afegit a una secció té la seva pròpia versió.
        // Els melòdics reben una frase pròpia sobre els mateixos acords; els
        // rítmics i d'acompanyament, un patró propi.
        const layers = part.layers === undefined ? {} : part.layers;
        if (!layers || typeof layers !== 'object' || Array.isArray(layers)
            || Object.entries(layers).some(([name, rev]) => !Object.hasOwn(SONG_INSTRUMENTS, name) || !Number.isInteger(rev) || rev < 1 || rev > 1000000))
            throw new Error('Capes d’instruments no vàlides');
        // Trams dins de la secció on sona cada instrument afegit: un instrument
        // pot començar o acabar a mitja secció (clips que travessen seccions).
        const ranges = part.ranges === undefined ? {} : part.ranges;
        if (!ranges || typeof ranges !== 'object' || Array.isArray(ranges) || Object.entries(ranges).some(([name, list]) =>
            !Object.hasOwn(SONG_INSTRUMENTS, name) || !Array.isArray(list) || !list.length || list.some(range => !Array.isArray(range)
                || range.length !== 2 || !Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] < 0 || range[1] > bars || range[0] >= range[1])))
            throw new Error('Trams d’instruments no vàlids');
        const lines = {}, layerIndex = {};
        const rhythmPool = [RHYTHMS.r1, RHYTHMS.r2, RHYTHMS.r3, RHYTHMS.r4, RHYTHMS.r5, RHYTHMS.r6, RHYTHMS.r7, RHYTHMS.r9];
        Object.keys(layers).forEach(name => {
            const rev = layers[name], salt = name.split('').reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
            layerIndex[name] = (rev - 1) % 5;
            if (name === 'vocal') {
                const vr = seededRng((seed ^ salt) + Math.imul(rev, 2654435761) >>> 0);
                lines.vocal = composeVocal(vr, chords, bars, part.type, ctx.scalePcs, part.syllables, part.register || 0);
                return;
            }
            if (!['trumpet', 'trombone', 'synthLead', 'sax'].includes(name)) return;
            const lr = seededRng((seed ^ salt) + Math.imul(rev, 2654435761) >>> 0);
            const lctx = { ...ctx, prev: nearestTone(name === 'trombone' ? 67 : 72, chords[0].pcs, 64, 79) };
            const lrhythms = phraseBars.map(() => rhythmPool[Math.floor(lr() * rhythmPool.length)]);
            if (name === 'synthLead' && lr() < .5) lrhythms[lrhythms.length - 1] = RHYTHMS.r7;
            lines[name] = repeat(composePhrase(lr, lctx, phraseBars, lrhythms).notes);
        });
        // El baix té un riff propi per a cada alternativa; una única partitura
        // alimenta tant el motor de mostres com el sintetitzador de reserva.
        const bassPatterns = settings.style === 'urban' ? [
            [[0,'root',1.4,1.1],[1.75,'root',.65,.9],[3,'fifth',.8,1]],
            [[0,'root',1.8,1.1],[2.5,'octave',.55,.85],[3.25,'root',.65,1]],
            [[0,'root',.7,1.1],[1.5,'fifth',.7,1],[2.75,'root',1,1]],
            [[0,'root',1.1,1.1],[1.5,'third',.4,.85],[2,'fifth',.65,1],[3.5,'root',.4,1]],
            [[0,'root',.9,1.1],[1.25,'octave',.45,.9],[2.5,'fifth',.65,1],[3.5,'root',.4,1]]
        ] : settings.style === 'ska' ? [
            [[0,'root',.85,1.13],[1,'third',.8,1],[2,'fifth',.8,1.08],[3,'approach',.72,1.08]],
            [[0,'root',1.3,1.2],[1.5,'fifth',.8,.92],[2.5,'octave',1,1.04]],
            [[0,'root',.42,1.18],[.5,'octave',.42,.88],[1.5,'fifth',.43,1.04],[2,'root',.75,1.13],[3,'third',.85,1.02]],
            [[0,'root',.65,1.14],[.75,'third',.65,.95],[1.5,'fifth',.65,1.08],[2.25,'octave',.57,.98],[3,'approach',.7,1.1]],
            [[0,'root',.8,1.2],[1,'fifth',.7,.95],[2.5,'third',.65,1.03],[3.5,'approach',.37,1.16]]
        ] : [
            [[0,'root',.42,1.16],[.5,'root',.42,1],[1,'root',.42,1.09],[1.5,'root',.42,1],
             [2,'root',.42,1.13],[2.5,'fifth',.42,.96],[3,'root',.42,1.12],[3.5,'approach',.42,1.05]],
            [[0,'root',.9,1.2],[1,'octave',.75,1.04],[2,'root',.9,1.2],[3,'fifth',.7,1.06]],
            [[0,'root',.4,1.17],[.5,'root',.18,.83],[.75,'fifth',.19,.92],[1.5,'root',.45,1.1],
             [2,'root',.4,1.15],[2.5,'root',.18,.86],[2.75,'octave',.2,.98],[3.5,'approach',.35,1.04]],
            [[0,'root',.42,1.19],[.5,'third',.42,.89],[1,'fifth',.42,1.04],[1.5,'octave',.42,.97],
             [2,'root',.42,1.14],[2.5,'fifth',.42,1.02],[3,'third',.42,.92],[3.5,'approach',.4,1.1]],
            [[0,'root',.65,1.19],[.75,'root',.48,.93],[1.5,'fifth',.42,1.01],
             [2,'root',.66,1.13],[2.75,'octave',.4,1.02],[3.25,'approach',.5,1.12]]
        ];
        const classic = settings.style === 'urban' ? bassPatterns[0] : settings.style === 'punk'
            ? [[0,'root',.42,1.1],[.5,'root',.42,.9],[1,'root',.42,1.05],[1.5,'root',.42,.9],
               [2,'root',.42,1.08],[2.5,'root',.42,.9],[3,'root',.42,1.08],[3.5,'root',.42,.9]]
            : [[0,'root',.8,1.1],[1,'third',.78,.98],[2,'fifth',.78,1.04],[3,'approach',.75,1.02]];
        const bassLine = [];
        for (let b = 0; b < bars; b++) {
            const chord = chords[b], root = chord.root, next = chords[(b+1)%bars].root;
            const tones = { root, third: nearestTone(root+4,chord.pcs,root,root+12),
                fifth: nearestTone(root+7,chord.pcs,root,root+12), octave: root+12,
                approach: next===root ? root+7 : next+(next>root ? -1 : 1) };
            const pattern = part.type==='outro' && b===bars-1
                ? [[0,'root',3.3,1.18]] : groove.bass>=0 ? bassPatterns[groove.bass] : classic;
            for (const [at,tone,length,strength] of pattern)
                bassLine.push([b,at,tones[tone],Math.min(length,4-at),strength]);
        }
        if (part.lineModes) {
            const riff = composeRiff(settings.seed >>> 0, settings.style === 'punk');
            const voiceLine = lines.vocal || null;
            for (const [name, how] of Object.entries(part.lineModes)) {
                if (!(name in layers)) continue;
                const line = how === 'riff' ? realizeRiff(riff, chords, bars, ctx.scalePcs) : answerLine(riff, chords, bars, ctx.scalePcs, voiceLine);
                // Trombó/segona veu: el riff harmonitzat una tercera per sota.
                lines[name] = name === 'trombone' && how === 'riff' ? harmonize(line, chords, ctx.scalePcs) : line;
            }
        }
        const drumOptions = {};
        if ((part.cymbals ?? settings.cymbals) && (part.cymbals ?? settings.cymbals) !== 'all') drumOptions.cymbals = part.cymbals ?? settings.cymbals;
        if (settings.drumTune) drumOptions.drumTune = settings.drumTune;
        if (settings.humanize !== undefined) drumOptions.humanize = settings.humanize;
        // La resta de la banda calla durant el compte d'entrada i després del cop de l'aturada.
        if (part.countIn) drumOptions.countIn = true;
        if (part.ending === 'stop' && bars > 1) drumOptions.stopAt = ((bars - 1) * 4 + .75) * 60 / tempo;
        return { ...drumOptions, style: settings.style, type: part.type, seed, tonic, mode, bars, energy, beat: 60 / tempo, swing: settings.swing || 0,
            seconds: bars * 4 * 60 / tempo, chords, melody, bassLine, instruments: instruments.slice(), variation, groove, lines, layers: layerIndex,
            ranges: JSON.parse(JSON.stringify(ranges)),
            drumLine: composeDrumLine(settings.style, groove.drums, part.type, bars, energy, { next: part.next, fill: part.fill, ending: part.ending, countIn: part.countIn }),
            timbres: { ...(settings.timbres || {}), ...(part.timbres || {}) },
            mix: { ...(settings.mix || {}), ...(part.mix || {}) },
            fx: { ...(settings.fx || {}), ...(part.fx || {}) },
            feel: { ...(part.feel || {}) } };
    }
    function songPartScore(syn, spec) {
        const beat = spec.beat, bar = beat * 4, intensity = 0.35 + spec.energy / 155;
        const has = name => spec.instruments.includes(name), punk = spec.style === 'punk';
        const variation = Number.isInteger(spec.variation) && spec.variation >= 0 && spec.variation <= 4 ? spec.variation : -1;
        const guitar = punk
            ? { decay: 0.28, partials: [1, 0.8, 0.6, 0.42, 0.32, 0.2], damp: 0.3, gain: 0.065, attack: 0.002 }
            : { decay: 0.14, partials: [1, 0.6, 0.25], damp: 1.5, gain: 0.09, attack: 0.003 };
        spec.chords.forEach((chord, b) => {
            const t0 = b * bar, ending = spec.type === 'outro' && b === spec.bars - 1;
            const soft = spec.type === 'intro' || spec.type === 'bridge';
            if (has('synthPad')) chord.notes.forEach(n => syn.pad(t0, n, bar * .95, .018 * intensity, .35));
            if (has('organ')) (ending ? [0] : [.5, 1.5, 2.5, 3.5]).forEach(t => chord.notes.forEach(n => syn.pad(t0 + t * beat, n + 12, beat * .4, .02 * intensity, .01)));
            const guitarPatterns = punk
                ? [[0,.5,1,1.5,2,2.5,3,3.5],[0,1,1.5,2,3,3.5],
                   [0,.5,1.5,2,2.5,3.5],[0,.5,1,1.5,2.5,3],[0,1,2,2.5,3,3.5]]
                : [[.5,1.5,2.5,3.5],[.5,1.5,2.5,3.5,3.75],
                   [.5,1.5,3.5],[.5,1.75,2.5,3.5],[.5,1.5,2.75,3.5]];
            const stabs = ending ? [0] : guitarPatterns[spec.groove?.guitar ?? Math.max(0,variation)];
            const voicing = punk ? [chord.root + 12, chord.root + 19, chord.root + 24] : chord.notes;
            if (has('guitar')) stabs.forEach((t, hit) => voicing.forEach((n, k) => {
                syn.pluck(t0 + t * beat + k * 0.004, n, intensity * (punk && hit % 2 ? 0.5 : 0.75), guitar);
            }));
            if (has('vocal') && b === 0) (spec.lines?.vocal || spec.melody).forEach(([nb, t, n, d]) =>
                syn.brass(nb * bar + t * beat, n, Math.max(.06, d * beat - .03), intensity * .5, 'trumpet'));
            if (has('guitar2')) (ending ? [0] : [.5, 1.5, 2.5, 3.5]).forEach(t => voicing.forEach((n, k) =>
                syn.pluck(t0 + t * beat + .01 + k * .004, n + 12, intensity * .45, guitar)));
            if (has('guitar3')) (ending ? [0] : [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]).forEach((t, k) =>
                syn.pluck(t0 + t * beat, chord.notes[k % chord.notes.length] + 12, intensity * .5, { ...guitar, decay: .3 }));
            if (has('bass') && !Array.isArray(spec.bassLine)) {
                const hits = ending ? [0] : punk ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 1, 2, 3];
                hits.forEach((t, k) => syn.bass(t0 + t * beat,
                    punk ? chord.root : k === 3 ? chord.root + 7 : k === 1 ? bassOf(chord.pcs[1]) : chord.root,
                    intensity * (k % 2 ? 0.65 : 0.85), ending ? 0.8 : 0.21));
            }
            // Acord final dels dos metalls, només si estan activats.
            if (ending) {
                if (has('trumpet')) syn.brass(t0, chord.notes.at(-1) + 12, bar * 0.7, intensity * 0.7, 'trumpet');
                if (has('trombone')) syn.brass(t0, chord.root + 24, bar * 0.7, intensity * 0.65, 'trombone');
            }
        });
        for (const [b, t, note, force] of spec.drumLine || []) {
            const at = (b * 4 + t) * beat, level = intensity * force / 108;
            for (const electronic of [false, true]) {
                if (!has(electronic ? 'electronicDrums' : 'drums')) continue;
                if (note === 36) electronic ? syn.kick(at, level * .8, 42) : syn.kick(at, level * (punk ? .85 : .65));
                else if (note === 38 || note === 37) {
                    syn.brush(at, level * (note === 37 ? .35 : punk ? .95 : .65), punk ? .11 : electronic ? .08 : .07, false);
                    if (punk && note === 38) syn.block(at, level * .24, 180, .05, .3);
                } else if (note === 42 || note === 46 || note === 51) syn.brush(at, level * .26, note === 42 ? .018 : .05, true);
                else if (note === 49) syn.brush(at, level * .3, .22, true);
                else syn.block(at, level * .3, note === 48 ? 165 : note === 45 ? 130 : 105, .09, .15);
            }
        }
        if ((has('bass') || has('synthBass')) && Array.isArray(spec.bassLine)) {
            for (const [b,t,pitch,length,strength] of spec.bassLine) {
                if (has('bass')) syn.bass((b*4+t)*beat, pitch, intensity*strength*1.13, length*beat);
                if (has('synthBass')) syn.bass((b*4+t)*beat, Math.max(24,pitch-12), intensity*strength, length*beat);
            }
        }
        spec.melody.forEach(([b, t, n, d]) => {
            if (spec.type === 'outro' && b === spec.bars - 1) return;
            // Els metalls entren al final de la intro, com a presentació del motiu.
            if (spec.type === 'intro' && b < 2) return;
            const start = b * bar + t * beat, duration = Math.max(0.06, d * beat - 0.05);
            const level = intensity * (spec.type === 'verse' ? 0.42 : 0.72);
            if (has('synthLead')) syn.pluck(start, n, level, { decay: duration, partials: [1,.5,.3,.2], damp: .4, gain: .07, attack: .008 });
            if (has('trumpet')) syn.brass(start, n, duration, level, 'trumpet');
            if (has('sax')) syn.brass(start, n - 12, duration, level * .75, 'trombone');
            const chord = spec.chords[b];
            const harmony = nearestTone(n - 12, chord.pcs, 45, 67);
            if (has('trombone')) syn.brass(start, harmony, duration * 0.92, level * 0.8, 'trombone');
        });
        return TARGET_RMS;
    }
    function songPartSamples(spec, sampleRate = 22050, opts = {}) {
        // Els instruments originals treballen circularment. Un marge final
        // evita que les cues de l’últim compàs reapareguin al començament.
        const seconds = Math.ceil(spec.seconds + 4);
        return renderAsync(syn => songPartScore(syn, spec), seconds, sampleRate, seededRng(spec.seed), opts).then(raw => {
            const data = raw.slice(0, Math.round(spec.seconds * sampleRate));
            const level = 0.5 + spec.energy / 200;
            for (let i = 0; i < data.length; i++) data[i] *= level;
            const fade = Math.min(data.length, Math.round((spec.type === 'outro' ? 0.7 : 0.012) * sampleRate));
            for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
            for (let i = 0; i < Math.min(110, data.length); i++) data[i] *= i / 110;
            return data;
        });
    }

    return { normalize, setAllowed, isAllowed, othersPlaying, canPlay, samples, samplesAsync, createPlayer, pickMelody, melodyId, melodyInfo,
        SONG_PARTS, SONG_STYLES, SONG_INSTRUMENTS, SONG_GROOVES, MIX_LIMITS, GUITAR_FX, SUBGENRES, chordFromSymbol, composeRiff, composeSongPart, songPartSamples,
        MELODIES, LEVEL, DUCK, TARGET_RMS, THEME_SECONDS, MELODY_SECONDS,
        // Tornades de la lliga (pantalla entre partides).
        JINGLES, JINGLE_SECONDS, JINGLE_LEVEL, jingleId, jingleInfo, pickJingle, jingleSamples, jingleSamplesAsync, createJinglePlayer,
        composeJingle, jingleFingerprint, jingleTitle, _jingleStyles: STYLES, _scales: SCALES, _leadNames: LEAD_NAMES,
        // Música composta a la TV i registre de les peces compostes.
        composedMelodyId, parseComposedId, composedLoopSpec, composeMelodyId,
        REGISTRY_KEY, registryList, registerComposition, toggleFavourite, registryKey, registrySpec,
        REGISTRY_LATEST, registryGroups, exportSamples, encodeMp3, mp3FileName,
        // Partitures, per als tests.
        _scores: { theme: THEME, oriental: ORIENTAL, bossa: BOSSA, vals: VALS, capvespre: CAPVESPRE,
            havanera: HAVANERA, celta: CELTA, nocturn: NOCTURN, marimba: MARIMBA, lofi: LOFI } };
});
