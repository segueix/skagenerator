"""Afegeix les cançons noves (out/*.meta.json) al catàleg de cançons cantades i en deixa com a molt MAX.

Ús: python singing/catalog.py <catàleg actual (pot no existir)> <carpeta out> <catàleg nou> <fitxer on s'escriuen els mp3 que sobren>
"""
import glob, json, os, sys

MAX = 60
old_path, out_dir, new_path, drop_path = sys.argv[1:5]
catalog = json.load(open(old_path, encoding='utf-8')) if os.path.exists(old_path) else {'songs': []}
fresh = [json.load(open(p, encoding='utf-8')) for p in sorted(glob.glob(os.path.join(out_dir, '*.meta.json')))]
fresh = [s for s in fresh if os.path.exists(os.path.join(out_dir, s['file']))]
ids = {s['id'] for s in fresh}
songs = fresh + [s for s in catalog.get('songs', []) if s['id'] not in ids]
keep, drop = songs[:MAX], songs[MAX:]
json.dump({'format': 'radiospam-sung', 'voice': 'TIGER DS (tigermeat), DiffSinger. CC BY-NC-ND 4.0 + Commons Clause: només ús no comercial.',
           'songs': keep}, open(new_path, 'w', encoding='utf-8'), ensure_ascii=False)
open(drop_path, 'w', encoding='utf-8').write('\n'.join(s['file'] for s in drop))
print(f'Catàleg: {len(keep)} cançons ({len(fresh)} noves, {len(drop)} retirades)')
