# StemLab: Deep Learning–Based Music Source Separation and Interactive Rehearsal Studio

**Student:** Krishnakumar Mandal  
**Roll No.:** 23  
**Department:** Artificial Intelligence and Machine Learning  
**Institute:** St. Francis Institute of Technology

## Abstract

StemLab is a local application that transforms mixed music into personalised rehearsal material. It applies a pretrained Hybrid Transformer Demucs model to estimate vocals, drums, bass and remaining accompaniment. Users can adjust individual channels, choose practice presets, compare the result with the original recording, repeat a selected section and export a custom backing track. The project combines deep learning inference with an interactive audio interface. It targets singers, musicians and students preparing performances. The underlying separation model is pretrained; the project's contribution is its integrated application and rehearsal workflow.

## Problem and objectives

A normal music recording combines several instruments into one signal. A student who wants to practise singing or playing an instrument usually cannot turn off that part of the recording. Finding an instrumental version or manually preparing a practice loop adds effort.

The objectives are to separate the recording into four estimated sources, provide synchronised playback, create rehearsal presets, support section looping, preserve sessions and export useful practice tracks.

## Methodology

1. Upload and validate an audio file.
2. Decode to stereo, 44.1 kHz floating-point WAV using FFmpeg.
3. Normalise the waveform using the mean and standard deviation of the mono reference.
4. Apply pretrained `htdemucs` with segmented inference and overlapping segments.
5. Restore amplitude scaling and save vocals, drums, bass and other as aligned float WAV files.
6. Decode the sources into browser audio buffers and start all channels on a shared Web Audio clock.
7. Apply user-selected channel gains, mute/solo and presets.
8. Export the weighted sum of the stems, optionally restricted to an A–B section.

For source signals s_i(t) and channel gains g_i, the exported mix is:

**y(t) = sum_i g_i × s_i(t)**

When a boosted export exceeds the allowed peak, the output is uniformly attenuated. This prevents clipping while retaining the relative channel levels.

## Model explanation

Think of the mixed song as several people speaking at once. You hear only the combined signal. A source separation model uses patterns learned from training examples to estimate which parts belong to each source.

Hybrid Transformer Demucs works with both the waveform and a time-frequency representation. Its encoder/decoder structure extracts and reconstructs audio features; transformer layers connect information across time and across the two representations. It predicts source signals rather than simply classifying the track.

The model was trained by its authors. StemLab performs inference on uploaded music. No new training or fine-tuning is claimed.

## Features and original application contribution

- Personalised singer, drummer, bassist and vocal-focus presets.
- Shared-clock multichannel playback and original-versus-mix comparison.
- Rehearsal section selection and looping.
- Channel volume, mute and multiple-channel solo.
- Persistent local sessions with saved mix and loop settings.
- Full-track or section-only WAV export and source-stem ZIP download.
- Clear separation between generated mixer demonstration and actual model inference.

## Three-minute demonstration

**0:00–0:25:** “This is StemLab, a rehearsal studio that lets us control the layers of a song. I use a pretrained deep learning model to estimate those layers.”

**0:25–0:55:** Open a previously separated real track. Play the original, then switch to the mix. Explain that the recording contains all instruments together.

**0:55–1:35:** Choose Singing and remove vocals. Choose Vocal focus to isolate the estimated vocals. Show Drummer and Bassist presets. Adjust one channel manually.

**1:35–2:05:** Select A and B around a short section. Enable repetition. Explain how a performer can repeatedly practise a difficult passage.

**2:05–2:35:** Export the practice mix. Open/play the downloaded WAV. Save the session and reopen it from the sidebar.

**2:35–3:00:** “The DL component is Hybrid Transformer Demucs. My application integrates inference, playback, rehearsal controls and export. The main limitation is residual instrument bleeding.”

Prepare one real separated excerpt before presenting so model download and processing do not consume the demo. Keep the synthetic demo as a labelled interface fallback.

## Viva questions

**Where is deep learning used?** In `worker.py`, where the pretrained Demucs neural network estimates four source waveforms.

**Did you train the model?** No. I used pretrained weights. The implementation contribution is the application and rehearsal pipeline.

**Why is this harder than removing a frequency band?** Different instruments overlap in frequency and time. A filter cannot reliably distinguish a singer from an instrument producing similar frequencies.

**What does “other” mean?** Remaining accompaniment beyond the three named sources. It is not a separate track for every instrument.

**Why use both waveform and spectrogram representations?** They describe audio in complementary ways: sample-level structure and time-frequency structure.

**How are stems kept in sync?** They have the same sample rate and timeline. The browser schedules all buffer sources against the same audio clock and offset.

**How is karaoke produced?** Set the vocal gain to zero and sum the remaining estimated sources.

**Why can some vocals remain in the instrumental track?** Predictions are imperfect; overlapping instruments, effects and dense mixes cause source leakage.

**What is the synthetic demo?** Generated signals with known individual sources. It demonstrates playback and mixing, not model accuracy.

**How would you evaluate separation accuracy?** Compare predicted sources with genuine isolated reference stems using suitable source-separation metrics such as SDR. Listening alone and reconstruction agreement do not establish source accuracy.

**What can be improved later?** Sample-accurate loops, pitch-preserving time stretching, user recording with latency correction, and evaluation on a ground-truth dataset.

## Suggested slides

1. Title and problem.
2. Users and objectives.
3. Pipeline and model.
4. Live application demonstration.
5. Validation and limitations.
6. Future work and references.

## References

- Demucs: https://github.com/facebookresearch/demucs
- Rouard, Massa and Défossez, *Hybrid Transformers for Music Source Separation*: https://arxiv.org/abs/2211.08553
- Product inspiration: https://github.com/ummerr/stems
