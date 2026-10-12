# StemLab — Make room for your sound.

**Browser music separation and rehearsal studio**  
Krishnakumar Mandal · SFIT AIML

The web edition runs pretrained Demucs entirely in the browser using ONNX Runtime Web. Netlify hosts the static application, email/password account Functions and persistent account records in Netlify Blobs. No Python server, paid inference API or GPU hosting service is required for this edition.

## Web features

- Unique email/password accounts, server-side salted scrypt password hashes and opaque cookie sessions.
- Four-source neural separation in a dedicated browser worker; WASM on desktop browsers with bounded memory settings.
- Shared-clock mixer, original comparison, practice presets, mute/solo and channel volumes.
- A–B rehearsal loops, section export, individual stem WAV downloads and source-stem ZIP download.
- A small Download button jumps to the downloads panel. Choose Vocals, Drums, Bass, Other or Download my remix.
- Add up to three audio tracks (instruments/vocals, up to 30 seconds and 10 MB each). Set volume, mute/solo and a start time from 0–30 seconds; these tracks are included in the remix export. The timeline extends to fit them, and additions persist in the current browser session store.
- Per-account audio sessions stored in IndexedDB on the current device.
- Responsive editorial interface inspired by contemporary Godly design references: oversized type, warm paper colours, acid green accents and a vinyl record motif.

Account records persist across deployments. Audio is processed and saved locally in the browser: logging in on a different device does not transfer audio sessions. Clearing browser site storage removes local audio. Email verification and password recovery are not implemented in this basic account system; a signup does not verify ownership of the email address.

## Deploy to Netlify

Import this GitHub repository into Netlify. The root `netlify.toml` configures everything:

- Build: `npm run build`
- Publish directory: `dist`
- Functions: `netlify/functions`
- Node: 22

Choose the **Free** plan. No database credentials or model API keys are required. Functions receive Netlify Blobs credentials from the platform. The project uses metered hosting bandwidth/requests/Functions within Netlify's plan limits; it is not unlimited hosting.

The build downloads the pretrained ONNX weights from the pinned `demucs` npm package, splits them into 8 MiB static parts and copies the runtime assets. The first visitor separation downloads approximately **166 MiB**; the worker caches it for later runs. Use a laptop with Chrome or Edge and begin with a **10–30 second excerpt**. The web app limits inference input to **30 seconds / 10 MB** to reduce browser memory pressure. Phones and tablets are prevented from starting neural separation before model download because the model can crash mobile renderers. Accounts and the generated demo mixer still work on phones.

Netlify deploys include COOP/COEP response headers for WASM threading. All inference assets are served from the same origin.

## Build and test

```bash
npm ci
npm run build
npm test
```

`npm ci` uses `.npmrc` to skip lifecycle scripts: the native Node ONNX runtime is unnecessary for browser inference. esbuild uses its installed platform binary. This prevents downloading an unused native inference engine.

For full local account testing, use Netlify CLI (`npx netlify dev`) in your own environment. Opening `dist/index.html` as a `file://` document does not provide Function endpoints or the cross-origin isolation headers. Static preview alone can demonstrate layout, but cannot authenticate users.

## Architecture

```
Browser UI → Netlify Function → Netlify Blobs (accounts / sessions)
Browser audio file → Web Worker → Demucs ONNX → aligned sources
Aligned sources → Web Audio mixer → WAV / ZIP export
IndexedDB → per-account audio sessions on this device
```

`web/src/` contains the browser source. `web/build.mjs` bundles it and packages static model assets. `web/auth.mjs` contains account logic; `netlify/functions/account.mjs` wires it to the real Blob store. Backend passwords never appear in API responses or browser storage. Cookies are HttpOnly, Secure and SameSite=Strict. Mutating account requests require the same Origin; account attempts use atomic per-IP rate buckets.

## Academic scope and model credits

This is a **pretrained inference application**, not a new model or training result. The browser source-separation implementation comes from the `demucs` npm package by Kevin Gibbons and contributors (MIT code); its ONNX weights derive from Meta's pretrained Demucs weights. That package identifies weights as personal/research use only. This college demonstration is intended for that scope; the application license does not relicense the model.

References:

- Model and Python implementation: https://github.com/facebookresearch/demucs
- Browser inference library: https://github.com/bakkot/demucs-js
- Browser deployment inspiration: https://github.com/mcfredrick/client-side-ml
- Product inspiration: https://github.com/ummerr/stems
- Design reference: https://godly.design/websites/

The generated demo has known synthetic sources and tests the mixer; it is not a model separation result. Source leakage and audible artifacts remain possible. Loop boundaries use the UI timer and may have a small restart gap.

## Original Python edition

The original local Python/FastAPI edition remains available via `start_windows.bat` and `run.py`. Its setup guide is in `LOCAL_SETUP.md`. Netlify builds the browser edition from `web/`; it does not run those Python files.
