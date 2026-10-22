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

## Individual downloads and added audio tracks / 13 October 2026

Seven Node test cases pass, including correct gain/mute handling and time offsets for added mono audio in stereo remix exports. Browser checks pass: individual Drums WAV contents/header, download-panel navigation, importing a mono vocal clip, gain and delayed-start export (silent before the chosen start), saved audio/settings across reopening, playback, removal persisted across reopening, and mobile layout. No additional neural inference is performed when adding a mixer track.

## Per-track tuning validation
- Production build and all seven existing Node tests pass.
- Headless Chromium: prompt mapping changes sliders; Apply produces changed WAV
  samples; a solo tuned track matches the rendered remix WAV exactly.
- Saved/reopened effects reproduce identical processed samples; Reset restores
  original samples. Expanded controls fit a 390px viewport without overflow.
- Existing added-track import, offsets, gain export, playback and removal pass.
- No neural-model changes or new separation benchmark claims in this update.

## Gemini chat validation
- Eight Node tests pass, including authenticated chat, origin/history validation,
  missing-key response, API request format and per-user request throttling.
- Headless Chromium: open/send/reply, safe text rendering, clear, close, Escape
  and 390px mobile layout pass. Gemini replies mocked; no live key available.

## Tune coach refinement
- Chat moved to left with an 85–90px bottom inset to separate it from hosting UI.
- Desktop/mobile open, send, clear and close checks pass; mobile layout visually
  inspected and composer corrected to retain a usable textarea beside Send.
- Server request test confirms the artist-reference context is included. It uses
  supported effect ranges and distinguishes tonal treatment from voice conversion.

## Connected coach repair / 21 October 2026
- Eleven Node cases pass, including Flash-model discovery/cache, structured
  response values, rejection of invalid recommendations and safe provider error
  classification. Removed hard-coded model default and sampling temperature.
- Chromium: per-stem Ask tune coach, six returned values, Apply tuning/playback,
  changed vocal WAV, saved/reopened byte-identical WAV, drum targeting, connection
  check, visibly labelled local fallback and stale-session rejection pass.
- Mobile expanded coach visually reviewed at 390px; no horizontal overflow.
- Provider responses are mocked in development. A real configured key and a live
  generation response remain required to verify Google integration end to end.

## Free local AI composer / 21 October 2026
- Fifteen Node tests pass, including tempo/phase detection on known 90/120/150 BPM
  clicks, silence uncertainty, quantized seeds, scale-constrained repeated notes,
  on-grid placement and bounded synthesized samples for four instruments.
- Chromium ran actual pretrained DrumsRNN (4 bars/8 seconds at 120 BPM) and
  MelodyRNN (1 bar/2 seconds), using self-hosted weights and the CPU backend.
- The active demo's estimated BPM was 120. Generated WAVs contained nonzero stereo
  audio, saved/reopened as added tracks, and contributed to remix exports.
- Generation cancellation, shared mixer playback and 390px layout checks pass.
  The expanded generator was visually inspected. The coach regression passes.
- These are functional checks, not an assessment of musical quality, instrument
  realism, polyphonic harmony following or real-phone inference performance.

## Vocal pitch/formant transformation / 22 October 2026
- Eighteen Node tests pass. New coverage checks destination parsing (including
  female-to-male and same-pitch requests), legacy mixes, bounded finite settings,
  half-semitone recommendations and invalid pitch/formant rejection.
- Actual Signalsmith Stretch WASM in Chromium shifts a 120 Hz tone upward with
  +5 semitones and downward with -4, while preserving all 132300 samples of a
  3-second clip. Formant-only processing retains the 120 Hz note.
- Browser integration uses a female-voice prompt without any Gemini request,
  renders pitch +5/formant +3, produces a changed nonzero WAV of unchanged length,
  saves/reopens the settings and restores the raw WAV on Reset. Masculine and
  same-note presets also exercise the actual processor. Mobile controls were
  visually reviewed at 390px with no horizontal overflow.
- No perceptual listening study or guarantee of natural gender presentation.
  This is local DSP, not voice cloning or automatic pitch correction.
