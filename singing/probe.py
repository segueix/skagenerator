# Exploració: estructura de la veu TIGER i del vocoder (fitxers, configuració i entrades/sortides ONNX).
import glob, os, sys
import onnx
root = sys.argv[1]
for path in sorted(glob.glob(f'{root}/**/*', recursive=True)):
    if os.path.isfile(path) and not path.endswith(('.wav', '.png', '.jpg')): print(f'{os.path.getsize(path):>11} {path}')
for path in sorted(glob.glob(f'{root}/**/*.yaml', recursive=True)):
    text = open(path, encoding='utf-8', errors='replace').read()
    print(f'\n===== {path}\n' + (text[:1800] if 'dict' not in path.lower() else text[:400]))
def dims(t):
    return [d.dim_param or d.dim_value for d in t.type.tensor_type.shape.dim]
for path in sorted(glob.glob(f'{root}/**/*.onnx', recursive=True)):
    m = onnx.load(path, load_external_data=False)
    inits = {i.name for i in m.graph.initializer}
    print(f'\n##### {path}')
    for i in m.graph.input:
        if i.name not in inits: print('  in ', i.name, dims(i), onnx.TensorProto.DataType.Name(i.type.tensor_type.elem_type))
    for o in m.graph.output: print('  out', o.name, dims(o), onnx.TensorProto.DataType.Name(o.type.tensor_type.elem_type))
