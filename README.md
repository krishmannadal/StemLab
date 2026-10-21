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

### Track tuning and local prompt suggestions
Every original or imported track has a **Tune** disclosure with bass, presence,
air, compression, room reverb and stereo position controls. Apply renders effects
locally using Web Audio; playback, individual WAV downloads and remix export use
the same processed audio. Reset restores the unprocessed track. Save mix persists
effect settings; reopening re-renders from the original audio. The original-stems
ZIP remains unprocessed. Reverb is cropped to the track's duration.

The prompt assistant matches built-in style keywords (bright, warm, smooth,
punchy, vintage, radio, reverb, dry). It is a rule-based preset selector, not an
LLM or audio generation model. Artist references suggest a general treatment,
not voice cloning. Pitch correction and voice identity conversion are not provided.

### Gemini studio chat setup
The corner **Tune coach** button opens a text-only Gemini assistant. Chat requires
an account and is limited to six requests per minute and forty per day per user.
Only typed chat text and recent chat history are sent to Google; audio is never
attached. The assistant suggests settings but does not operate the mixer. History
is in memory, cleared on account changes, and not saved to the session database.

In Netlify → Project configuration → Environment variables, add `GEMINI_API_KEY`
with Functions scope, then trigger a fresh production deploy. Do not put the key
in browser code or GitHub. Leave `GEMINI_MODEL` unset to discover a compatible Flash model automatically.
An optional `GEMINI_MODEL` can pin a model available to your key. Availability and quota depend on the Google account.
Without a key, chat shows a configuration message. Gemini live responses have not
been verified until a real key is configured; API wiring is tested using mocks.


### Connected tuning workflow (21 October 2026)
Open **Tune coach**, select a stem, and describe the desired sound. The coach
returns validated values for all six controls and an **Apply tuning** button.
This renders the selected track locally and updates its sliders; save the mix
to preserve settings. **Ask tune coach** in each track opens the same workflow.
Suggestions are bound to the current session to prevent applying an old card to
a different recording. Imported tracks can also be selected.

**Check connection** verifies server key/model access without generating audio or
text; successful model access does not guarantee remaining generation quota.
Errors distinguish missing/rejected keys, restrictions, unavailable models and
quota. If generation fails, supported descriptions offer a separately labelled
**Local preset (offline)**. That fallback is rule-based and is never presented as
a Gemini answer. No voice cloning or pitch correction is added.

If chat reports a model error, remove `GEMINI_MODEL` and redeploy. If it reports
key/access errors, update `GEMINI_API_KEY` in the Netlify server environment and
check Google AI Studio restrictions. Never paste credentials into the app or git.
