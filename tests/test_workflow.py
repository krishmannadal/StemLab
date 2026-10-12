"""Integration checks of audio output, session storage and input boundaries."""
import os, io, tempfile, sys, zipfile
from pathlib import Path
os.environ['STEMLAB_DATA']=tempfile.mkdtemp(prefix='stemlab-test-')
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from app import app
client=TestClient(app)

def test_mix_export_loop_and_session():
    s=client.post('/api/demo').json()
    sid=s['id']
    assert s['demo'] and s['status']=='ready'
    loaded={}
    for name in ['vocals','drums','bass','other','original']:
        response=client.get(f'/api/audio/{sid}/{name}')
        assert response.status_code==200
        loaded[name],sr=sf.read(io.BytesIO(response.content))
        assert sr==44100 and loaded[name].shape==(44100*16,2)
    assert np.allclose(sum(loaded[n] for n in ['vocals','drums','bass','other']),loaded['original'],atol=1e-7)
    gains=dict(vocals=0,drums=0,bass=.5,other=0)
    result=client.post(f'/api/export/{sid}',json=dict(gains=gains,start=1,end=3))
    output,sr=sf.read(io.BytesIO(result.content))
    assert output.shape==(88200,2)
    assert np.max(np.abs(output-loaded['bass'][44100:132300]*.5))<4e-5
    settings=dict(gains=gains,loop_start=1,loop_end=3,loop=True)
    assert client.put(f'/api/sessions/{sid}/settings',json=settings).status_code==200
    assert client.get(f'/api/sessions/{sid}').json()['settings']==settings
    zipped=client.get(f'/api/stems/{sid}')
    assert set(zipfile.ZipFile(io.BytesIO(zipped.content)).namelist())=={'vocals.wav','drums.wav','bass.wav','other.wav'}

def test_errors_and_peak_protection():
    s=client.post('/api/demo').json();sid=s['id']
    assert client.get('/api/sessions/not-a-session').status_code==404
    assert client.get(f'/api/audio/{sid}/invalid').status_code==404
    assert client.post('/api/upload',files={'file':('empty.wav',b'','audio/wav')}).status_code==400
    assert client.post(f'/api/export/{sid}',json={'gains':{'bass':1}}).status_code==400
    gains={n:2 for n in ['vocals','drums','bass','other']}
    assert client.post(f'/api/export/{sid}',json=dict(gains=gains,start=3,end=1)).status_code==400
    response=client.post(f'/api/export/{sid}',json=dict(gains=gains))
    audio,sr=sf.read(io.BytesIO(response.content))
    assert np.max(np.abs(audio))<=.9901
