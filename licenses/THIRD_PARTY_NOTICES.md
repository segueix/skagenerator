# Instruments i motor de reproducció

- GeneralUser GS 2.0.3, S. Christian Collins: https://schristiancollins.com/generaluser.php
  Font fixada: https://github.com/mrbumpy409/GeneralUser-GS/tree/684543d5e5efaef08d02be50dcda8d552478fa60
  Banc modificat: selecció de guitarres, baixos, trompeta, trombó (i les seves variacions GS), trompeta amb sordina, saxo tenor, orgue, Synth Bass 1, Saw Wave, Warm Pad i kits Standard 1, Room, Power, Electronic, Jazz i Brush. S’han eliminat els altres presets i les mostres no utilitzades. Es conserven els moduladors i les mostres dels instruments seleccionats. Llicència completa a GeneralUser-GS-LICENSE.txt.

## Instruments gravats nota a nota

El build descarrega aquestes fonts (versions fixades a `real-instruments.json`, amb SHA-256 o commit) i les converteix en un banc propi: mono, remostreig a 32 kHz (baixos a 22,05 kHz), silenci inicial retallat, cues escurçades amb una baixada suau, sense bucles i amb nivells normalitzats.

- **Trompeta i trombó tenor, sostinguts i staccato** — Versilian Community Sample Library 2 Community Edition (VSCO 2 CE), Versilian Studios LLC. CC0 1.0 (domini públic). https://github.com/sgossner/VSCO-2-CE (commit 440300901dfe9275fd84e0b7763af1f8443ae62e). Es fan servir dues dinàmiques per nota; s’hi ha afegit una correcció d’afinació mesurada. Llicència a VSCO-2-CE-LICENSE.txt.
- **Baix amb dits i baix amb pua (YR)** — Andrea Biasior, FreePats. CC0 1.0. https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html
- **Guitarra elèctrica neta FSBS (pastilla del pont, versió reduïda)** — FreePats. CC0 1.0. https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html
- **Saxo tenor (versió reduïda)** — roberto@zenvoid.org per a FreePats, amb mostres de VSCO. CC0 1.0. https://freepats.zenvoid.org/Reed/saxophone.html
- **Muldjord Kit** — © Lars Muldjord (www.muldjord.com, www.drumgizmo.org); versió SF2 de FreePats preparada per roberto@zenvoid.org. Llicència **Creative Commons Reconeixement 4.0 Internacional (CC BY 4.0)**: https://creativecommons.org/licenses/by/4.0/. Modificacions: s’ha construït un kit GM nou amb tres capes de força per cop, barrejant els dos canals en mono, remostrejant a 32 kHz i escurçant les cues dels plats. Llicència completa a MuldjordKit-LICENSE.txt.

## Bateries i baixos addicionals (banc `extra-instruments.sf2`)

Es baixen a part, només quan una cançó els fa servir. Tots són CC0 1.0 (domini públic); se citen igualment.

- **Big Rusty Drums** — Karoryfer Lecolds. CC0 1.0. https://github.com/sfzinstruments/karoryfer.big-rusty-drums
- **Virtuosity Drums** (kit de club i micròfon lo-fi) — Virtuosity Musical Instruments, bateria d’Austin McMahon. CC0 1.0. https://github.com/sfzinstruments/virtuosity_drums
- **Meatbass** (contrabaix de 1958 en pizzicato) — Karoryfer Lecolds. CC0 1.0. https://github.com/sfzinstruments/karoryfer.meatbass
- **Growlybass** (Squier Jazz Bass, directe) — Karoryfer Lecolds. CC0 1.0. https://github.com/sfzinstruments/karoryfer.growlybass

Modificacions: selecció d’unes quantes capes de força per cop o nota (una sola gravació per capa), barreja dels micròfons en mono, remostreig (32 kHz bateries, 22 kHz baixos), retall de cues i igualació de sonoritat amb el kit Muldjord i el baix amb dits. Els FLAC es descodifiquen amb @wasm-audio-decoders/flac (MIT, només al build).

## Motor i biblioteques

- SpessaSynth Core 4.4.9, Spessasus: https://github.com/spessasus/spessasynth_core
  Apache-2.0; llicència a SpessaSynth-LICENSE.txt.
- stb-vorbis 0.0.7, Spessasus: https://github.com/spessasus/stb-vorbis
  Apache-2.0; llicència a stb-vorbis-LICENSE.txt. La seva distribució inclou els avisos dels components incorporats.
- fflate 0.8.3, Arjun Barrett: https://github.com/101arrowz/fflate
  MIT; llicència a fflate-LICENSE.txt.

Les dependències són reproduïdes al bundle local sample-worker.js. Les llicències també es distribueixen amb la web.

- Tone.js 14.8.49, Yotam Mann i col·laboradors: https://github.com/Tonejs/Tone.js
  MIT; biblioteca carregada externament des de jsDelivr per al reproductor de l'editor, no inclosa dins del bundle local.
