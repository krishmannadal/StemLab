# Development validation

Validated on 12 October 2026 with Python 3.12 and CPU PyTorch 2.5.1.

## Passed

- Python compilation of backend and worker; JavaScript syntax check.
- Two integration tests covering multiple assertions: generated sources reconstruct their original; source files have aligned 44.1 kHz stereo timelines; a bass-only cropped mix matches the expected samples within 16-bit WAV quantisation tolerance; channel levels and loop settings persist; all four stems appear in the ZIP; invalid session IDs, empty uploads, invalid gain maps and reversed ranges are rejected; boosted exports remain below the protected peak.
- Actual pretrained `htdemucs` inference: the model weights downloaded, FFmpeg decoded a two-second generated input, CPU inference ran and four finite aligned stereo WAV files were returned. Total job time was approximately 21 seconds including first-time loading/download in this environment. This is a pipeline smoke test, not a quality benchmark or an estimate of laptop performance.
- Chromium browser interaction with the FastAPI test client serving requests: demo loading, Singing preset, advancing playback, original comparison, saved session, selected-region WAV download and mobile-width layout without horizontal overflow. No JavaScript page errors were observed.
- Desktop and mobile layouts visually inspected internally.
- Installed Python dependencies passed `pip check` in the development environment.

## Limits

No user music track was supplied, so perceptual separation quality on the user's songs was not assessed. No CUDA device was available here, so GPU execution and the Windows launcher were not run in this environment. Browser API requests were routed through the test client because the execution environment restricts local sockets; the full backend plus browser interactions were checked through that route.

The model is pretrained; no training, new separation accuracy or SDR score is claimed. The generated demo has known synthetic sources and does not represent AI performance. A–B loops are controlled by the UI timer and can have a small restart gap. Long tracks consume substantial browser memory because the source buffers are loaded together.

## Repeat backend checks

After setup:

```bash
python -m pip install pytest httpx
python -m pytest tests -q
```

Pre-download the neural model before your presentation:

```bash
python prepare_model.py
```

Then upload a short real music excerpt, wait for separation, listen to each source and export one practice track before presenting.
