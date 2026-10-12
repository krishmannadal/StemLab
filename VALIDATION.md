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

## Browser edition / v2

- Production static build passed: browser app, worker, same-origin ONNX Runtime assets and 21 model parts (~166 MiB).
- Four Node test cases passed: case-normalised unique email registration, hashed password login, secure cookie creation, expiry/logout, wrong-password handling, cross-origin rejection, attempt throttling, stereo WAV headers, gain/crop arithmetic and peak protection.
- Chromium UI passed against the real account handler with an in-memory test implementation of the Blob interface: signup, login, logout, saved per-account IndexedDB sessions, preset levels, advancing playback, original/loop/export interactions, and mobile layout without horizontal overflow.
- Actual browser ONNX inference ran on a two-second generated audio input and returned all four sources to the mixer. This checks the neural pipeline, not perceptual accuracy on real music.
- Desktop/mobile layouts visually inspected. The model-worker transferable buffer handling was corrected after the initial smoke test exposed shared ArrayBuffers.

The live Netlify Blob integration must still be verified after deployment. Local browser checks route static files/account requests through the test harness because this execution environment restricts local socket access. These checks do not establish Netlify deployment success. Chrome's headless WASM path was used here; real-device WebGPU performance was not benchmarked.

### Netlify build correction

The first Netlify deployment detected the legacy root requirements.txt and attempted to install PyTorch using its default Python version before the Node build. Those requirements are now requirements-local.txt, and both local launchers reference that file. Netlify therefore installs only the Node web dependencies.

## Phone renderer crash mitigation / 13 October 2026

The reported Android Chrome “Aw, Snap!” screen indicates a renderer crash rather than a caught application error. Memory pressure during inference is the likely explanation; no phone crash dump was available to prove the exact cause.

- Mobile/tablet and browsers reporting less than 8 GB RAM are blocked before audio decoding, worker creation or model download. This does not add mobile neural inference support.
- Model weights are assembled directly into one preallocated buffer; all parts are no longer retained alongside a second full weights copy.
- Input normalization happens in place. Inference uses single-thread WASM with CPU memory arena/pattern options disabled, and its worker is terminated once output arrives.
- Desktop input is limited to 30 seconds / 10 MB. An interrupted-job marker offers recovery guidance after a reload.
- Six Node tests passed, including mobile/iPad/limited-memory policy checks and sequential model assembly.
- Chromium desktop test passed actual ONNX inference on a two-second generated input plus account/mixer/export flows. An Android user-agent test confirmed both the picker and direct-upload path trigger no model/worker requests; login and the demo still work. This is browser emulation, not a hardware test on the user's Motorola.
