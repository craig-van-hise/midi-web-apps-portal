# Project State: VV | WebApps Portal

## 1. Architecture & Directory Tree
```text
midi-web-apps-portal/
├── public/
│   ├── fonts/
│   │   └── Bravura.woff2
│   ├── PCS_LUT.dat
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── config/
│   │   ├── appRegistry.js
│   │   └── appRegistry.test.js
│   ├── core/
│   │   ├── rompler/
│   │   │   ├── Knob.jsx
│   │   │   ├── MasterRompler.css
│   │   │   ├── MasterRompler.jsx
│   │   │   ├── VUMeter.jsx
│   │   │   ├── engine.js          # Tone.js + smplr Audio Engine
│   │   │   ├── engine.test.js
│   │   │   ├── rompler.css
│   │   │   ├── usePersistentState.js
│   │   │   └── utils.js
│   │   ├── utils/
│   │   │   ├── latencyProfiler.js
│   │   │   └── latencyProfiler.test.js
│   │   ├── App.css
│   │   ├── App.jsx
│   │   └── App.test.jsx
│   ├── plugins/
│   │   ├── DummyPlugin.jsx
│   │   ├── DummyPlugin.test.jsx
│   │   ├── chord-notator/
│   │   ├── dynamics/
│   │   ├── midi-transposer/       # Two-zone keyboard transposer & output filter
│   │   ├── monitor/
│   │   └── pitch-class-matrix/
│   ├── index.css
│   ├── main.jsx
│   └── setupTests.js
├── xCleanup/                   # Backup folder for dead/decommissioned code
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## 2. Tech Stack
- **Core Framework**: React 19, Vite 8, ES6+ JavaScript
- **Styling**: Tailwind CSS v4, Custom CSS variables, Framer Motion (via `motion`)
- **Audio Engine**: Highly-optimized native `Tone.js` and `smplr` instances with algorithmic routing (e.g. parallel Aux sends for `Tone.Freeverb` to avoid convolver FFT block latency).
- **State Management**: React State & Context, Zustand
- **Utility / Performance**: Lodash (`lodash/throttle`) for frame-rate limiting UI rendering.
- **Icons**: Lucide React
- **Testing**: Vitest, React Testing Library

## 3. Current System Capabilities
- **Audio Engine**: Low-latency `Tone.js` + `smplr` architecture running on the main thread (`Tone.context.lookAhead = 0.002`). Executes MIDI triggers synchronously (bypassing React batching) and typecasts raw MIDI notes to Scientific Pitch Notation strings (`"C4"`) using `Tone.Frequency` before trigger. Reverb is configured as a parallel send/return bus using algorithmic `Tone.Freeverb` (Schroeder reverberator) to avoid FFT convolution delays.
- **Tracking/MIDI Engine**: Global Web MIDI API manager routing hardware input directly down to active plugins using a ref-based `EventTarget` Event Bus, avoiding React batching issues and stuck notes.
- **Visualizer & Processing Plugins**:
  - **Chord Notator**: Renders sheet music notation from live MIDI inputs in real-time.
  - **Pitch Class Matrix**: Maps and quantizes incoming MIDI notes to specific roots and scales.
  - **MIDI Monitor**: Logs live MIDI status messages, note numbers, velocities, and CC changes.
  - **MIDI Dynamics**: Multi-mode velocity curve adjustment with compression, expansion, and custom thresholds.
  - **MIDI Transposer**: Splits keyboard ranges into interactive draggable zones (Play and Transpose) supporting polyphonic chord transpositions, customizable transpose hold sustain modes (Sustain Original, Immediate Cutoff, Retrigger), and range-limit filtering on outputs.
- **UI State Logic**: Frame-rate limited state sync (~30fps / 32ms) separating instant synchronous audio triggers from asynchronous rendering cycles.

## 4. Recent Evolution
We abandoned the experimental custom `SharedArrayBuffer` / `AudioWorklet` architecture due to severe DSP regressions (clipping, clicking, poor gain staging). We reverted to a heavily optimized `Tone.js` + `smplr` framework that achieves the same low-latency floor by eliminating convolution reverb in favor of `Tone.Freeverb` and optimizing MIDI/audio routing on the main thread.
