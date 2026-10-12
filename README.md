# StemLab — Hear every layer

**AI Performance & Rehearsal Studio**  
Created for Krishnakumar Mandal · SFIT · AIML

A local Python application that separates a song into vocals, drums, bass and other instruments using pretrained Hybrid Transformer Demucs. A browser mixer turns the result into personalised rehearsal tracks.

## Start on Windows

1. Install **Python 3.11 (64-bit)** from https://www.python.org/downloads/ . The launcher script uses `py -3.11`.
2. Extract the ZIP into a writable folder such as `Desktop/StemLab`.
3. Double-click **start_windows.bat**. Keep the terminal open. Initial dependency installation downloads PyTorch and can take several minutes.
4. Open **http://127.0.0.1:8000** in Chrome or Edge.
5. Click **Load synthetic demo** to try the mixer. This generated 16-second track does not run AI and is clearly labelled.
6. Upload a real 20–40 second WAV/MP3 music excerpt to demonstrate actual separation. The first separation downloads pretrained weights; allow internet access and extra time for that first run.

No API key, paid service, Node.js or manually installed FFmpeg is required. FFmpeg comes through imageio-ffmpeg. Browser font downloads are optional; fallback fonts work offline.

### Faster processing on an NVIDIA laptop

The default PyPI torch build may include CUDA on Windows. The app automatically selects CUDA if PyTorch sees a compatible GPU. To explicitly install the matched CUDA build, stop the app and run in its project folder:

```powershell
.venv\Scripts\python.exe -m pip install --upgrade --force-reinstall torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121
.venv\Scripts\python.exe run.py
```

A compatible NVIDIA driver is required. CPU processing also works, but is slower. If you run out of GPU memory, use a shorter excerpt or set CPU mode before launching:

```powershell
$env:STEMLAB_DEVICE="cpu"
.venv\Scripts\python.exe run.py
```

For Command Prompt use `set STEMLAB_DEVICE=cpu` instead.

## Start manually / macOS / Linux

Use Python 3.11 or 3.12. Do not use Python 3.13 for these pinned model dependencies.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python run.py
```

For a smaller CPU-only installation, install torch and torchaudio before the other requirements:

```bash
python -m pip install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
```

## Prepare before presenting

Once dependencies are installed, run `.venv\Scripts\python.exe prepare_model.py` on Windows (or `python prepare_model.py` in the activated environment). This downloads the weights ahead of time. Then separate and save one short real music clip before the live demo.

## Using the studio

- Upload an audio clip (maximum 100 MB / five minutes). One AI job runs at a time.
- Set levels from 0–200%, mute channels with **M**, and solo one or more channels with **S**.
- Choose Singing (remove vocals), Drums (remove drums), Bass (remove bass), Vocal focus (vocals only), or Full mix.
- Playback uses one shared Web Audio clock for all five buffers, including the original, so channels start and seek together.
- **Hear original** switches monitoring between the original song and your current mix without changing playback position. Export always uses the mix settings, even when monitoring the original.
- Set A and B in seconds or mark them at the current playback position; enable the loop. Loop boundaries are controlled by the UI animation loop and may have a small restart gap; this is rehearsal playback, not sample-accurate looping.
- Export the full mix or selected A–B section as 16-bit WAV. Peak protection attenuates boosted exports when required to avoid clipping. It does not increase the volume of quiet tracks.
- Download all four source stems as a ZIP, stored as float WAV to preserve their scale.
- Save the session to restore effective channel levels and loop settings. Mute/solo is saved as resulting levels, rather than as separate button states.

## Project structure

- `app.py`: FastAPI endpoints, upload/decode pipeline, persistent sessions, mixing and export.
- `worker.py`: isolated Demucs/PyTorch inference process; GPU selected automatically.
- `static/index.html`, `style.css`, `app.js`: responsive mixing desk and Web Audio playback.
- `requirements.txt`: matched dependency versions.
- `tests/test_workflow.py`: integration checks for audio arithmetic, crop lengths, session persistence and invalid requests.
- `SUBMISSION.md`: abstract, methodology, demo script and viva answers.
- `VALIDATION.md`: what was actually verified during development.
- `data/`: created on first launch; contains your sessions, stems and logs.

## Troubleshooting

- **Model download fails:** allow internet on the first real upload and retry. Weights are cached by PyTorch for later runs. Inspect the session's `processing.log` under `data/`.
- **Failed dependency install:** confirm Python 3.11/3.12, a 64-bit interpreter and sufficient disk space. Recreate `.venv` if it was made with another Python version.
- **Port 8000 is occupied:** close the previous StemLab terminal, or change `port=8000` in `run.py` and open the new port.
- **No sound:** press Play after the track loads; browser audio requires a user interaction. Check mute/solo settings.
- **Separation artifacts:** try a different excerpt. Source separation is an estimation problem; effects, dense arrangements and shared harmonics can cause bleeding.
- **Large songs on low-memory devices:** use short excerpts. The browser loads all five WAV files into memory for synchronised playback.
- **Restart during a job:** interrupted jobs are marked as errors on startup. Upload the track again.

## Honest academic scope and credits

StemLab uses **pretrained inference**. It does not train Demucs or claim ownership of its architecture. The application contribution is the upload pipeline, source-preserving audio handling, local session storage, shared-clock mixer, rehearsal workflow and export.

Demucs code/model reference: https://github.com/facebookresearch/demucs (archived upstream repository; MIT code license). Paper: *Hybrid Transformers for Music Source Separation*, https://arxiv.org/abs/2211.08553 .

Product inspiration: https://github.com/ummerr/stems . StemLab's application code was written for this project; that repository was used as feature inspiration, not copied.

Do not report separation accuracy from the synthetic mixer demo. A credible SDR evaluation requires real, paired ground-truth stems. If your course requires training a neural network yourself, this inference-based submission needs an additional training component.

Run locally; there is no authentication or production hosting configuration. Uploaded audio remains in your local `data/` folder. Use tracks you may demonstrate and distribute.
