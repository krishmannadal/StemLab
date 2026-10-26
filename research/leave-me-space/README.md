# Leave Me Space — experimental foreground-aware accompaniment

## What is implemented
StemLab's local MusicRNN supplies a short note motif. A 1,443-parameter bidirectional GRU (12 units/direction) predicts onset suitability, preferred length and intensity on a half-beat grid. A constrained decoder ranks complete one-, two- or four-beat windows and rejects windows overlapping the lead plus a breathing margin. It selects windows within a user density budget. Short motifs are time-scaled into these windows, reserving 150 ms for synthesis release. This is offline clip planning, not real-time performance accompaniment.

Inputs: lead-active mask, backing energy, sine/cosine beat position, relative clip position. Energy activity detection on the chosen lead track is editable and is NOT a calibrated vocal detector. Imported lead offsets and stereo energy are respected. Background rhythm comes from the current drum stem. Tempo is constant, key/scale remain manual. For continuous vocals the planner may find no suitable windows; it reports infeasibility rather than a successful silent output.

The generator offers fixed-intensity responses (for controlled comparison), predicted-intensity responses (creative mode), continuous placement, and generate-then-mute. All audio stays in the browser. Added responses use the existing save/reopen, effects and WAV export path. Planning metadata is saved with the generated track.

## Model provenance — read before presenting
The shipped model was actually trained with PyTorch on 1,000 **synthetic activity sequences**, split 800/100/100 by synthetic sequence identity. Labels come from documented procedural rules, not musicians. Its low regression error measures imitation of those rules. It does not establish real musical quality, novelty, superiority to heuristics, or publication readiness. The pretrained MusicRNN is separate from this new small planner.

`training-report.json` contains seed, parameter count, versions, losses and chosen epoch. `parity.json` verifies JavaScript inference against held-out PyTorch output. Weights are bundled in `web/src/phrase-planner-weights.json` (~32 KB), with no extra API or model download.

## Reproduce / train on annotated music
Use a separate Python environment; do not add PyTorch to the Netlify deployment dependencies.

```
python -m venv .venv-research
# Activate the environment for your platform.
python -m pip install torch numpy
python research/leave-me-space/train.py
npm test
npm run build
```

For real annotations, supply `--data path/to/annotations.json`. Each record must have `song_id`, `split` (train/validation/test), `features` (T×5) and `targets` (T×3). No song may cross splits. Use the browser's `makeFeatures` implementation to ensure identical units/order. Targets are independently annotated onset suitability [0,1], preferred length in eight half-beats [0,1], and intensity [0,1]. Do not label the test set with the same algorithm being evaluated. The script rejects song leakage, nonfinite inputs and invalid targets. Training overwrites weights/report/parity; inspect validation before deploying.

## Comparison protocol
1. Use licensed music or original recordings. Keep all excerpts/performances of a song in the same split. Record performer and song grouping; obtain permission for listening-test use.
2. Annotate clean lead phrase boundaries independently from the detector. Evaluate clean stems and separated stems separately. Compare annotations before adjudication; retain uncertainty.
3. Fix notes, seed/checkpoint, instrument, tempo, key, mix gain and density targets. Record requested AND achieved density. Include 15%, 25%, 40% and report infeasible trials, never silently discard them.
4. Compare continuous placement, activity muting, the shipped rule imitation model, a direct gap heuristic (`method:'heuristic'`), and a model retrained on real human annotations. The heuristic is an essential ablation: gap constraints alone can explain zero overlap.
5. Browser comparison matches phrase-window time: continuous motif playback is budgeted; the muting baseline removes protected intervals then retains surviving fragments up to the same budget. This produces real cut phrases. It is not an unconstrained continuous baseline. Exported JSON includes that definition and actual audible seconds at a fixed 1e-4 sample threshold. Reject or separately analyze listening trials differing by >0.1 audible seconds. Report density mismatch and failure rates rather than calling mismatched trials fair.
6. Measure lead overlap, cut phrases, requested/achieved density and boundary clearance against INDEPENDENT annotations. The UI uses the same intervals as planning, so its overlap number is a diagnostic, not independent accuracy. Boundary clearance is not boundary timing error; reference response annotations are required for the latter. Use a consistent RMS/frame threshold for a real study, not only this sample threshold.
7. Blind listening: randomize anonymous A/B/C labels, loudness-match complete mixes (not isolated accompaniment), hide method names, counterbalance order. Ask for continuity, interference and preference. Use multiple listeners and multiple held-out songs. Publish number of listeners/trials and confidence intervals; do not invent ratings.
8. Ablate learned ranking, predicted duration, breathing margin and density constraint. Report latency/device and detector errors. The expressive intensity preview is excluded from the fixed-intensity comparison table.

## Three-day execution plan
Day 1: collect/annotate licensed excerpts; establish song-disjoint split and independent lead boundaries; verify end-to-end baseline exports. Day 2: train on real annotations, run held-out metrics and ablations, curate blinded loudness-matched trials. Day 3: listening study, uncertainty/error analysis, final demo and paper. If evidence is inconclusive, report the prototype and limitations honestly.

## Related work and technical reference
- Villa-Renteria et al., Subtractive Training for Music Stem Insertion using Latent Diffusion Models (2024, revised 2025): https://arxiv.org/abs/2406.19328 . Context-conditioned stem insertion already exists; the proposed study concerns explicit phrase planning under controlled density, not inventing stem insertion.
- PyTorch GRU equations and parameter order: https://docs.pytorch.org/docs/stable/generated/torch.nn.GRU.html . JavaScript uses the PyTorch r/z/n gate convention; parity is checked within 1e-6.

No trained-on-real-music or research-superiority claim is made by this implementation.
