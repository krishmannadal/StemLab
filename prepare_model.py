"""Download/check weights ahead of the presentation; no input audio needed."""
import torch
from demucs.pretrained import get_model
if __name__=='__main__':
    print('PyTorch:',torch.__version__)
    print('CUDA available:',torch.cuda.is_available())
    model=get_model('htdemucs')
    print('Model ready:',type(model).__name__)
    print('Sources:',', '.join(model.sources))
    print('Sample rate:',model.samplerate)
    print('Weights are cached. Start StemLab with python run.py.')
