"""Afegeix les cançons noves (out/*.meta.json) al catàleg de cançons cantades i en deixa com a molt MAX.

Ús: python singing/catalog.py <catàleg actual (pot no existir)> <carpeta out> <catàleg nou> <fitxer on s'escriuen els mp3 que sobren>
"""
import glob, json, os, sys
from voice_timbres import preset_for

MAX = 60
old_path, out_dir, new_path, drop_path = sys.argv[1:5]
catalog = json.load(open(old_path, encoding='utf-8')) if os.path.exists(old_path) else {'songs': []}
fresh = [json.load(open(p, encoding='utf-8')) for p in sorted(glob.glob(os.path.join(out_dir, '*.meta.json')))]
fresh = [s for s in fresh if os.path.exists(os.path.join(out_dir, s['file']))]
# Totes les cançons noves d'aquesta tasca provenen de Matxa i han passat pel
# filtre del seu subgènere. Les antigues es conserven amb la seva pròpia fitxa.
for song in fresh:
    preset = preset_for(song.get('subgenre'))
    song['voiceEngine'] = 'matxa'
    song['voiceName'] = preset.speaker
    song['voiceTimbre'] = preset.name
    song['language'] = 'ca'
ids = {s['id'] for s in fresh}
songs = fresh + [s for s in catalog.get('songs', []) if s['id'] not in ids]
keep, drop = songs[:MAX], songs[MAX:]
json.dump({'format': 'radiospam-sung', 'voice': 'Matxa (Projecte Aina), català, timbre segons subgènere; consulteu-ne la llicència per a usos comercials.',
           'songs': keep}, open(new_path, 'w', encoding='utf-8'), ensure_ascii=False)
open(drop_path, 'w', encoding='utf-8').write('\n'.join(s['file'] for s in drop))
print(f'Catàleg: {len(keep)} cançons ({len(fresh)} noves, {len(drop)} retirades)')
