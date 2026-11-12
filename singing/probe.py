# Exploració: estructura de la veu TIGER i del vocoder (fitxers, configuració i entrades/sortides ONNX).
import glob, os, sys
import onnxruntime as ort
root = sys.argv[1]
for path in sorted(glob.glob(f'{root}/**/*', recursive=True)):
    if os.path.isfile(path): print(f'{os.path.getsize(path):>12}  {path}')
for path in sorted(glob.glob(f'{root}/**/*.yaml', recursive=True)) + sorted(glob.glob(f'{root}/**/*.txt', recursive=True)):
    print(f'\n===== {path}'); print(open(path, encoding='utf-8', errors='replace').read()[:3000])
for path in sorted(glob.glob(f'{root}/**/*.onnx', recursive=True)):
    try:
        s = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
        print(f'\n##### {path}')
        for i in s.get_inputs(): print('  in ', i.name, i.shape, i.type)
        for o in s.get_outputs(): print('  out', o.name, o.shape, o.type)
    except Exception as e: print('ERR', path, e)
