"""Isolated model inference; all stems preserve the same timing and scale."""
from pathlib import Path
import json, os, sys
import numpy as np
import soundfile as sf
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model

p=Path(sys.argv[1])
device=os.environ.get('STEMLAB_DEVICE') or ('cuda' if torch.cuda.is_available() else 'cpu')
print('Device:', device, flush=True)
model=get_model('htdemucs').to(device).eval()
audio,sr=sf.read(p/'original.wav',dtype='float32',always_2d=True)
assert sr==model.samplerate, 'Unexpected sample rate'
wav=torch.from_numpy(audio.T.copy())
reference=wav.mean(0)
mean=reference.mean()
std=reference.std().clamp(min=1e-8)
wav=(wav-mean)/std
with torch.inference_mode():
    sources=apply_model(model,wav[None].to(device),device=device,shifts=0,split=True,overlap=.25,progress=True)[0].cpu()
sources=sources*std+mean
for name, signal in zip(model.sources,sources):
    sf.write(p/(name+'.wav'),signal.numpy().T,sr,subtype='FLOAT')
(p/'inference.json').write_text(json.dumps({'device':device,'model':'htdemucs'}))
print('Separation finished',flush=True)
