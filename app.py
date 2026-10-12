"""StemLab: local music separation and rehearsal studio."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import io, json, logging, os, re, subprocess, sys, threading, time, uuid, zipfile
import numpy as np
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('STEMLAB_DATA', str(ROOT / 'data'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
STEMS = ['vocals', 'drums', 'bass', 'other']
SR = 44100
MAX_BYTES = 100 * 1024 * 1024
MAX_SECONDS = 300
pool = ThreadPoolExecutor(max_workers=1)
lock = threading.Lock()
app = FastAPI(title='StemLab')
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')

def folder(sid):
    if not re.fullmatch(r'[a-f0-9]{32}', sid):
        raise HTTPException(404, 'Session not found')
    p = DATA / sid
    if not (p / 'session.json').exists():
        raise HTTPException(404, 'Session not found')
    return p

def read(p):
    return json.loads((p / 'session.json').read_text(encoding='utf-8'))

def write(p, obj):
    temp = p / 'session.tmp'
    temp.write_text(json.dumps(obj, indent=2), encoding='utf-8')
    temp.replace(p / 'session.json')

def update(p, **kwargs):
    with lock:
        obj = read(p)
        obj.update(kwargs)
        write(p, obj)
    return obj

def new_session(title, demo=False):
    sid = uuid.uuid4().hex
    p = DATA / sid
    p.mkdir()
    write(p, dict(id=sid, title=title, demo=demo, status='queued', stage='Waiting for separation', created=time.time(), duration=0, samplerate=SR, settings={}, model='Synthetic demo' if demo else 'htdemucs'))
    return p

def decode(src, dest):
    # FFmpeg makes MP3/M4A decoding independent of torchaudio backend versions.
    import imageio_ffmpeg
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-nostdin', '-y', '-v', 'error', '-i', str(src), '-vn', '-ac', '2', '-ar', str(SR), '-t', str(MAX_SECONDS + 1), '-c:a', 'pcm_f32le', str(dest)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise ValueError('Could not decode this audio file. Try a WAV or MP3 file.')
    info = sf.info(dest)
    if info.duration > MAX_SECONDS:
        raise ValueError('Please use an audio clip of five minutes or less.')
    if info.duration < 1:
        raise ValueError('Please use at least one second of audio.')
    return info.duration

def separate(p, src):
    started = time.time()
    try:
        update(p, status='processing', stage='Decoding audio')
        duration = decode(src, p / 'original.wav')
        update(p, duration=duration, stage='Loading Demucs and separating instruments. First run downloads model weights.')
        env = os.environ.copy()
        env['PYTHONUNBUFFERED'] = '1'
        with (p / 'processing.log').open('w', encoding='utf-8') as log:
            result = subprocess.run([sys.executable, str(ROOT / 'worker.py'), str(p)], stdout=log, stderr=log, env=env)
        if result.returncode:
            raise RuntimeError('Separation failed. See data/' + p.name + '/processing.log. Check the model download, PyTorch installation, or set STEMLAB_DEVICE=cpu.')
        device = json.loads((p / 'inference.json').read_text())['device']
        update(p, status='ready', stage='Ready to rehearse', processing_seconds=round(time.time()-started, 2), device=device)
    except Exception as exc:
        logging.exception('Separation failed')
        update(p, status='error', stage=str(exc))
    finally:
        src.unlink(missing_ok=True)

@app.get('/')
def index():
    return FileResponse(ROOT / 'static' / 'index.html')

@app.get('/api/sessions')
def sessions():
    found = []
    for p in DATA.iterdir():
        if p.is_dir() and (p / 'session.json').exists():
            try: found.append(read(p))
            except (OSError, ValueError): pass
    return sorted(found, key=lambda x:x['created'], reverse=True)

@app.get('/api/sessions/{sid}')
def session(sid: str):
    return read(folder(sid))

@app.post('/api/upload', status_code=202)
async def upload(file: UploadFile = File(...)):
    # Keep one model job queued/running to avoid accidental GPU overload.
    with lock:
        if any(x['status'] in ('queued', 'processing') for x in sessions()):
            raise HTTPException(409, 'A track is already processing. Please wait until it finishes.')
        p = new_session(Path(file.filename or 'Untitled track').name[:120])
    src = p / 'input.audio'
    size = 0
    try:
        with src.open('wb') as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, 'Maximum upload size is 100 MB.')
                output.write(chunk)
        if not size:
            raise HTTPException(400, 'The file is empty.')
    except Exception:
        update(p, status='error', stage='Upload failed or exceeded the size limit.')
        src.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    pool.submit(separate, p, src)
    return read(p)

@app.post('/api/demo')
def demo():
    # Known, generated sources: this demonstrates mixing, NOT neural separation.
    p = new_session('Midnight Circuit — synthetic practice session', demo=True)
    rng = np.random.default_rng(23)
    t = np.arange(SR * 16) / SR
    bass = np.zeros_like(t)
    other = np.zeros_like(t)
    vocal = np.zeros_like(t)
    notes = [110, 130.81, 98, 146.83]
    for bar in range(8):
        a, b = bar * 2 * SR, (bar+1) * 2 * SR
        u = t[a:b] - bar*2
        f = notes[bar % 4]
        bass[a:b] = .12*np.sin(2*np.pi*f*u)*(1-np.exp(-u*20))
        other[a:b] = .055*sum(np.sin(2*np.pi*f*k*u) for k in [2,2.5,3]) * np.sin(np.pi*u/2)**2
        vocal[a:b] = .045*np.sin(2*np.pi*(f*4)*u + .8*np.sin(2*np.pi*5*u)) * np.sin(np.pi*u/2)**2
    drums = np.zeros_like(t)
    for beat in np.arange(0, 16, .5):
        start = int(beat*SR); n = min(int(.22*SR), len(t)-start); u=np.arange(n)/SR
        drums[start:start+n] += .2*np.sin(2*np.pi*(55*u+6*(1-np.exp(-u*30))))*np.exp(-u*22)
        if int(beat*2)%2:
            drums[start:start+n] += .09*rng.normal(size=n)*np.exp(-u*35)
    parts = dict(vocals=vocal, drums=drums, bass=bass, other=other)
    total = np.zeros((len(t),2), dtype=np.float32)
    for name, signal in parts.items():
        audio = np.column_stack([signal, signal]).astype(np.float32)
        sf.write(p / (name+'.wav'), audio, SR, subtype='FLOAT')
        total += audio
    sf.write(p/'original.wav', total, SR, subtype='FLOAT')
    return update(p, status='ready', stage='Synthetic demo: generated sources, no model inference', duration=16, processing_seconds=0, device='Demo')

@app.get('/api/audio/{sid}/{name}')
def audio(sid: str, name: str):
    p = folder(sid)
    if name not in STEMS + ['original'] or not (p/(name+'.wav')).exists():
        raise HTTPException(404, 'Audio is not ready')
    return FileResponse(p/(name+'.wav'), media_type='audio/wav', filename=name+'.wav')

class Mix(BaseModel):
    gains: dict[str, float] = Field(default_factory=lambda:{s:1 for s in STEMS})
    start: float = 0
    end: float | None = None
    normalize: bool = True

class Settings(BaseModel):
    gains: dict[str,float] = Field(default_factory=dict)
    loop_start: float = 0
    loop_end: float = 0
    loop: bool = False

def check_gains(gains):
    if set(gains) != set(STEMS) or any(not np.isfinite(v) or v<0 or v>2 for v in gains.values()):
        raise HTTPException(400, 'Supply a gain between 0 and 2 for every stem.')

@app.put('/api/sessions/{sid}/settings')
def save(sid: str, settings: Settings):
    check_gains(settings.gains)
    p=folder(sid)
    d=read(p)['duration']
    if not 0<=settings.loop_start<=settings.loop_end<=d:
        raise HTTPException(400, 'Invalid loop range')
    return update(p, settings=settings.model_dump())

@app.post('/api/export/{sid}')
def export(sid: str, mix: Mix):
    p = folder(sid)
    meta = read(p)
    if meta['status'] != 'ready': raise HTTPException(409, 'Separation is not ready')
    check_gains(mix.gains)
    end=meta['duration'] if mix.end is None else mix.end
    if not np.isfinite(mix.start) or not np.isfinite(end) or not 0<=mix.start<end<=meta['duration']+.001:
        raise HTTPException(400, 'Select a valid export range')
    begin, count = int(mix.start*SR), int((end-mix.start)*SR)
    combined = np.zeros((count,2), dtype=np.float32)
    for name, gain in mix.gains.items():
        if gain:
            with sf.SoundFile(p/(name+'.wav')) as f:
                f.seek(begin)
                samples=f.read(count, dtype='float32', always_2d=True)
            combined[:len(samples)] += samples*gain
    peak=float(np.max(np.abs(combined))) if combined.size else 0
    # Attenuation only, preserve quiet mixes; never hard-clip boosted exports.
    if peak > .99:
        if mix.normalize: combined *= .99/peak
        else: raise HTTPException(400, 'Mix would clip. Enable peak protection or lower the channel levels.')
    data=io.BytesIO()
    sf.write(data,combined,SR,format='WAV',subtype='PCM_16')
    data.seek(0)
    return StreamingResponse(data,media_type='audio/wav',headers={'Content-Disposition':'attachment; filename="StemLab-practice-mix.wav"'})

@app.get('/api/stems/{sid}')
def download_stems(sid: str):
    p=folder(sid)
    if read(p)['status']!='ready': raise HTTPException(409,'Separation is not ready')
    data=io.BytesIO()
    with zipfile.ZipFile(data,'w',zipfile.ZIP_DEFLATED) as z:
        for name in STEMS: z.write(p/(name+'.wav'),name+'.wav')
    data.seek(0)
    return StreamingResponse(data,media_type='application/zip',headers={'Content-Disposition':'attachment; filename="StemLab-stems.zip"'})

@app.on_event('startup')
def recover():
    for s in sessions():
        if s['status'] in ('queued','processing'):
            update(folder(s['id']),status='error',stage='Processing was interrupted by a server restart. Upload the track again.')
