# Project State: VV | WebApps Portal

> [!WARNING]
> **Audio Engine Status: Precarious Position**
> The audio engine is currently in a highly sensitive and precarious state. Multiple structural rewrites to lower latency (bypassing Tone.js in favor of a pure Web Audio API context and a custom lock-free `SharedArrayBuffer` / `AudioWorklet` pipeline) have introduced several regressions that are currently unresolved:
> 1. **Gain Staging / normalization regression**: Removing Tone.js Samplers ruined auto-normalization across different instrument sample maps. Some instruments (Electric Piano, Celeste, Harp) are extremely quiet compared to others.
> 2. **Audio Pops & Clicks**: The custom DSP voice-stealing algorithm lacks zero-crossing/crossfade logic, resulting in pops on repeated notes.
> 3. **Eradicated Reverb**: The convolution reverb and impulse response node were completely bypassed and stripped from the graph in an attempt to eradicate a perceived latency floor, rendering the output entirely dry.

## 1. Architecture & Directory Tree
```text
midi-web-apps-portal/
├── public/
│   ├── fonts/
│   │   └── Bravura.woff2
│   ├── PCS_LUT.dat
│   ├── RomplerWorklet.js      # Custom AudioWorklet DSP processor
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
│   │   │   ├── engine.js          # Pure Native Web Audio Engine (Tone.js bypassed)
│   │   │   ├── engine.test.js
│   │   │   ├── rompler.css
│   │   │   ├── usePersistentState.js
│   │   │   └── utils.js
│   │   ├── utils/
│   │   │   ├── RingBuffer.js      # SAB lock-free ring buffer
│   │   │   ├── RingBuffer.test.js
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
- **Audio Engine**: Pure Web Audio API context with a custom `AudioWorklet` processor (`RomplerWorklet.js`) and a lock-free `SharedArrayBuffer` ring buffer for low-latency voice allocation. (Note: `tone` and `smplr` are in `package.json` but bypassed in `engine.js`).
- **State Management**: React State & Context, Zustand
- **Utility / Performance**: Lodash (`lodash/throttle`) for frame-rate limiting UI rendering, Custom RingBuffer for SAB IPC communication.
- **Icons**: Lucide React
- **Testing**: Vitest, React Testing Library

## 3. Current System Capabilities
- **Audio Engine**: Pure Web Audio context driving a custom polyphonic 32-voice sampler inside an `AudioWorklet`. MIDI events are piped through a lock-free `SharedArrayBuffer` ring buffer directly from the main thread to avoid IPC and React batching latency.
- **Tracking/MIDI Engine**: Global Web MIDI API manager routing hardware input directly down to active plugins using a ref-based `EventTarget` Event Bus, avoiding React batching issues and stuck notes.
- **Visualizer & Processing Plugins**:
  - **Chord Notator**: Renders sheet music notation from live MIDI inputs in real-time.
  - **Pitch Class Matrix**: Maps and quantizes incoming MIDI notes to specific roots and scales.
  - **MIDI Monitor**: Logs live MIDI status messages, note numbers, velocities, and CC changes.
  - **MIDI Dynamics**: Multi-mode velocity curve adjustment with compression, expansion, and custom thresholds.
  - **MIDI Transposer**: Splits keyboard ranges into interactive draggable zones (Play and Transpose) supporting polyphonic chord transpositions, customizable transpose hold sustain modes (Sustain Original, Immediate Cutoff, Retrigger), and range-limit filtering on outputs.
- **UI State Logic**: Frame-rate limited state sync (~30fps / 32ms) separating instant synchronous audio triggers from asynchronous rendering cycles.

## 4. Recent Evolution
We undertook an extensive low-latency sprint to bypass Tone.js, moving sample playback into a dedicated custom `AudioWorkletNode` (`RomplerWorklet.js`) with a lock-free `SharedArrayBuffer` pipeline. While this successfully removed the Tone.js context wrapper and established pure native routing, we encountered significant audio regressions (uneven gain staging, clicks and pops on repeated notes, and dry output due to the removal of the convolution reverb). Recent commits resolved merge conflicts in `App.jsx` and `engine.js` to stabilize this custom-built native audio architecture.
