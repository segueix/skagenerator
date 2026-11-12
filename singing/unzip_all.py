# Descomprimeix un zip i, a dins, tots els zip que contingui (noms amb espais inclosos).
import os, sys, zipfile
def unpack(path, target):
    with zipfile.ZipFile(path) as z: z.extractall(target)
    for base, _, files in os.walk(target):
        for name in files:
            if name.lower().endswith(('.zip', '.oudep')):
                inner = os.path.join(base, name)
                try: unpack(inner, os.path.splitext(inner)[0]); os.remove(inner)
                except zipfile.BadZipFile: pass
for src, dst in zip(sys.argv[1::2], sys.argv[2::2]): unpack(src, dst)
