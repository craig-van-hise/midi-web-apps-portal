Here is the comprehensive failure report documenting the architectural sprint, the approaches attempted, and the resulting failures and regressions. This document is structured to provide future developers or AI agents with a clear timeline of what was tried and why it failed to achieve the desired outcome.

---

# Technical Post-Mortem: Audio Latency Reduction Initiative

## 1. Executive Summary & The Problem Statement

**The Goal:** The primary objective was to reduce the audio playback latency of a web-based MIDI Rompler application by at least 10 milliseconds to make the instrument viable for live, real-time performance.

**The Initial State:** The application was built utilizing `Tone.js` (`LoopedSampler` / `Tone.Sampler`). While stable and audibly correct, the latency between a physical MIDI key press and the resulting audio output was noticeably spongy (estimated at 25ms+). The working theory was that the JavaScript event loop, React render cycles, and Tone.js abstraction layers were causing the delay.

**The Proposed Strategy:** Gut Tone.js's audio generation and move sample playback to a custom `AudioWorkletProcessor` running on a dedicated audio thread. To bypass the Main Thread's Inter-Process Communication (IPC) queue, MIDI data would be passed via a lock-free `SharedArrayBuffer` (SAB) memory vault.

---

## 2. Chronological Log of Approaches, Failures, & Regressions

### Attempt 1: The Initial AudioWorklet & SAB Implementation

* **Action:** Wrote a custom 32-voice polyphonic DSP `RomplerWorklet.js`. Refactored `engine.js` to remove Tone.js Samplers. Attempted to connect the native `AudioWorkletNode` into the existing Tone.js mixer chain (Volume, Pan, Reverb).
* **Result (Failure):** `TypeError: Failed to construct 'AudioWorkletNode': parameter 1 is not of type 'BaseAudioContext'`. Tone.js's context polyfills failed the browser's strict C++ prototype checks for native nodes.

### Attempt 2 & 3: Forcing Native Context & Drilling for Nodes

* **Action:** Instantiated a raw, un-polyfilled `window.AudioContext` explicitly and forced Tone.js to adopt it. Attempted to connect the Worklet by manually drilling through Tone.js objects to find the underlying native `GainNode`.
* **Result (Failure):** `TypeError: Failed to execute 'connect' on 'AudioNode'`. Tone.js fundamentally "poisons" the global audio graph by overwriting the `AudioNode` prototype. The native Worklet refused to connect to any node touched by Tone.js.

### Attempt 4: Complete Tone.js Eradication

* **Action:** Abandoned Tone.js entirely inside `engine.js`. Rebuilt the entire mixer graph (Volume, Panner, Splitters, Analysers, Convolver Reverb) using pure HTML5 Web Audio API nodes to guarantee a clean connection.
* **Result (Failure):** The graph connected successfully with zero console errors, but resulted in **No Sound**.
* **Regression Found:** Eradicating Tone.js destroyed the auto-normalization algorithms applied to `.mp3`/`.ogg` files. The raw PCM data for instruments like the Electric Piano, Harp, and Vibraphone was inherently quiet, resulting in a severe **Gain Staging Regression** that unbalanced the entire instrument suite.

### Attempt 5 & 6: Fixing the "No Sound" SAB Pipeline

* **Action:** Discovered the `sabBuffer` prop was not being passed from `App.jsx` to the engine. Fixed prop drilling. Suspected "NaN Poisoning" (the Worklet silently muting itself due to out-of-bounds array reads). Added strict bounds checking and `Number.isNaN` guards to the Worklet DSP loop. Added explicit instrument state synchronization.
* **Result (Failure):** Logs confirmed the Worklet was booting, receiving the SAB, and samples were loading. Still **No Sound**.

### Attempt 7: The "Ghost Buffer" Pivot (`postMessage`)

* **Action:** Diagnosed that the local Vite Dev Server lacked `COOP/COEP` security headers. Consequently, `typeof SharedArrayBuffer` was undefined, falling back to a standard `ArrayBuffer`. When passed to the Worklet, the browser deep-cloned the memory. The UI wrote to one buffer; the Worklet read from an empty clone.
* **Action:** Pivoted away from SAB entirely. Routed MIDI events directly to the Worklet via `postMessage`.
* **Result (Partial Success / New Failures):** Sound successfully played, but introduced two major issues:
1. **Dead Notes / Polyphony Bug:** Repeated notes failed to trigger because the Worklet ignored new Note-On events for actively ringing voices.
2. **Latency Remaining / "Rolling Chords":** The latency was fundamentally unchanged. Furthermore, `postMessage` forced MIDI events into the IPC queue, causing simultaneous chord notes to process across different audio blocks (a "rolling" or arpeggiated jitter effect).



### Attempt 8 & 9: True SAB via Vite Headers & Memory Alignment

* **Action:** Added `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` to `vite.config.js` to force true SharedArrayBuffer activation. Rewrote the Worklet envelope logic to allow repeated notes to re-trigger.
* **Action:** Discovered a fatal memory misalignment (`RingBuffer.js` used an 8-bit array; the Worklet read a 32-bit array). Synchronized both files to a 4096-byte `Int32Array`.
* **Result (Failure):** **No Sound**. The worker agent, when trying to restore the SAB code via `git log`, inadvertently overwrote and deleted the `NaN` DSP safeguards, causing the Web Audio engine to silently mute the Worklet again.

### Attempt 10: Hard Crash Protocol & Monolithic Rewrite

* **Action:** Added a strict `throw new Error()` in `RingBuffer.js` if SAB was undefined to prevent silent clone fallbacks. Monolithically rewrote the Worklet DSP loop to permanently lock in the `NaN` guards and seamless attack re-triggering.
* **Result:** After a hard browser refresh to clear cached headers, true lock-free SAB playback was achieved.
* **Failure/Regression:** Latency was *still* completely unchanged (~25ms). The "rolling chords" jitter remained. The gain-staging regression (quiet electric piano/harp) remained glaringly obvious. Furthermore, the Worklet's strict envelope math resulted in unnaturally long release times (>1 second).

### Attempt 11: Eradicating the FFT Convolver

* **Action:** Theorized that the Native Web Audio `ConvolverNode` (Reverb) was utilizing Fast Fourier Transform (FFT) block processing (1024+ frames), forcing the browser to delay-compensate the entire audio graph and locking in a ~23ms latency floor. Ripped the Reverb graph out entirely, wiring the Worklet directly to the destination speakers.
* **Result (Total Failure / Fatal Regressions):** 1.  **Latency Unchanged:** Removing the FFT Convolver did not alleviate the latency at all. The delay remained entirely perceptible and unchanged from the very first Tone.js implementation.
2.  **Audio Glitches:** The acoustic piano began popping and glitching on repeated notes. The custom Worklet lacked the complex zero-crossing and crossfading algorithms required to steal active voices cleanly.

---

## 3. Final Conclusion & State

The architectural sprint failed to achieve its primary objective. Despite bypassing the JavaScript event loop, utilizing an isolated audio thread, implementing lock-free shared memory, and stripping away complex audio nodes, the latency remained static.

**Identified Regressions during the Sprint:**

1. **Loss of Auto-Normalization:** Moving away from Tone.js Samplers ruined the volume balance across disparate sample libraries.
2. **Audio Artifacts:** Custom DSP voice-stealing introduced popping and clicking on repeated notes.
3. **Loss of Reverb:** Attempting to optimize the graph resulted in a completely dry, unpolished sound.

