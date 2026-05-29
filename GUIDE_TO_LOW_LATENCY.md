# Guide to Low Latency & DSP Best Practices

Here is a targeted guide to pushing the latency of the **VV | WebApps Portal** down to professional, sample-accurate thresholds while maintaining DSP stability.

### 1. Hardcode the AudioContext Latency Target

By default, the Web Audio API prioritizes stability over speed to prevent buffer underruns, injecting 15 to 30 milliseconds of baseline delay.

* **Action:** When initializing Tone.js or your custom `AudioContext` within the `MasterRompler` or `engine.js`, explicitly set `lookAhead = 0.002` (2ms) or pass `latencyHint: "interactive"` in the configuration.
* **Why:** This actively overrides the browser's power-saving heuristics and forces the host OS to allocate the absolute smallest permissible audio buffer block size.

---

### 2. Neutralize Garbage Collection & Decouple UI Render Loops

Heavy abstraction libraries create massive memory footprints by dynamically allocating intermediary objects, wrappers, and envelope nodes for every single incoming MIDI message. When the heap fills, the V8 engine forces a "Stop-The-World" garbage collection sweep, stalling the main thread for 5 to 50 milliseconds and causing audible dropouts.

* **Action (UI Throttling):** Never trigger a React state update (`useState` setter) synchronously inside your MIDI message listeners. Store incoming notes, visual states, and logs in a mutable React `useRef` and use `lodash/throttle` (usually ~30fps/32ms) to flush the ref's content to the React state.
* **Enforce Strict Disposal:** If dynamic voice creation is used for sample playback, you must explicitly invoke `.dispose()` on unused Tone.js nodes or buffers immediately after their envelope release phase concludes. This prevents orphaned nodes from stacking up and triggering massive GC sweeps during extended performances.

---

### 3. The Convolution Reverb Trap

A common trap in Web Audio development is using convolution reverb (`Tone.Reverb` which uses a `ConvolverNode`) to achieve realistic room acoustics. 

* **The Problem:** Convolution reverb relies on Fast Fourier Transforms (FFT) of the incoming signal and the impulse response buffer. To perform FFTs, the browser must buffer audio blocks, which introduces a rigid block processing delay (often 1024 or 2048 samples, adding ~20-40ms of latency) and delay-compensates the entire audio graph.
* **The Solution:** Use an algorithmic reverberator (like `Tone.Freeverb`, a Schroeder reverberator) instead. Algorithmic reverbs use feedback delay networks, comb filters, and all-pass filters that process audio sample-by-sample without block buffering, preserving the zero-latency floor.

---

### 4. The Hz vs. MIDI Integer Bug (Minor Thirds)

Passing raw MIDI integers to a sampler or oscillator expecting frequencies can lead to strange pitch regressions.

* **The Problem:** If you pass raw MIDI pitch integers (e.g. `60` for Middle C) directly into a sampler's play method, libraries like Tone.js might interpret the integer as a frequency in Hertz (60 Hz is roughly B1/C2). Furthermore, passing raw pitch offsets without typecasting can cause Tone.js to interpret ratios mathematically, scaling pitches incorrectly (e.g., playing notes shifted by a minor third because it interprets pitch offsets as frequency ratios).
* **The Solution:** Strictly typecast incoming MIDI note integers to Scientific Pitch Notation strings (e.g., `60` -> `"C4"`) using `Tone.Frequency(note, "midi").toNote()` before passing them to `Tone.Sampler` or other pitch-sensitive instruments.

---

### 5. Spatial Panning via Parallel Aux Sends

To maintain high-fidelity spatial panning without diluting or flattening the stereo image, the audio routing graph must avoid linear insert routing.

* **The Problem:** In a linear insert chain (`Sampler -> PanVol -> Reverb -> Destination`), the panning node affects the signal before it hits the reverb. The reverb processor then mixes the panned signal across its stereo reverberation matrix, which drags the reverb tail alongside the dry signal, flattening the stereo field and muddying the soundstage.
* **The Solution:** Configure Reverb as a parallel send/return bus. Route the output of the dry signal and its panning/volume control (`PanVol`) to the Destination directly, and split a parallel send path post-panning via a gain node (`ReverbSend`) into the reverb processor:
  - `Sampler -> InternalTrim -> PanVol -> Destination` (Dry Path)
  - `PanVol -> ReverbSend (Gain) -> Freeverb -> Destination` (Wet Path)
  This ensures that panning affects the dry source position correctly, while the reverb tail naturally blooms across the entire stereo field.

---

### 6. Manage Environment and OS-Specific Expectations

No amount of code optimization will bypass the physical constraints of the user's connection topology or operating system.

* **Transport Protocols:** Warn users against using Bluetooth Low Energy (BLE) MIDI. BLE mandatory connection intervals pad the input stream with an inescapable 15 to 20 milliseconds of baseline delay. Mandate wired High-Speed USB connections for sub-5 millisecond transport.
* **OS Constraints:** On Windows, browser audio operates in WASAPI Shared Mode, which forces the audio through the Windows Audio Engine mixer, occasionally creating output baselines of 30 to 50 milliseconds. On macOS, CoreAudio is highly optimized, but Chrome still hardcodes a minimum safe buffer size under certain settings.
