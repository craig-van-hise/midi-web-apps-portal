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
│   │   ├── appRegistry.test.js
│   │   └── indexHtml.test.js
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
│   │   ├── midi-tonnetz/
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
- **Styling**: Tailwind CSS v4, Custom CSS variables, Framer Motion (via `motion`), Radix UI Primitives (e.g. Radix Tooltip)
- **Audio Engine**: Highly-optimized native `Tone.js` and `smplr` instances with algorithmic routing (parallel Aux sends for reverb to bypass convolver latency).
- **State Management**: React State & Context, Zustand
- **Utility / Performance**: Lodash (`lodash/throttle`) for frame-rate limiting UI rendering.
- **Icons**: Lucide React
- **Testing**: Vitest, React Testing Library

## 3. Current System Capabilities
- **Audio Engine**: Low-latency `Tone.js` + `smplr` architecture running on the main thread (`Tone.context.lookAhead = 0.002`). Executes MIDI triggers synchronously (bypassing React batching) and typecasts raw MIDI notes to Scientific Pitch Notation strings (`"C4"`) using `Tone.Frequency` before trigger. Reverb is configured as a parallel send/return bus using algorithmic `Tone.Freeverb` (Schroeder reverberator) to avoid FFT convolution delays.
- **Tracking/MIDI Engine**: Global Web MIDI API manager routing hardware input directly down to active plugins using a ref-based `EventTarget` Event Bus, avoiding React batching issues and stuck notes. MIDI permissions status pill is integrated directly in the `TitleBar` to prevent visual layout overlaps.
- **Visualizer & Processing Plugins**:
  - **Chord Notator**: Renders sheet music notation from live MIDI inputs in real-time. Features a transformation engine with real-time UI/Audio integration, Radix-based accessible tooltips, and physical/virtual keyswitch binds for rapid trigger control.
  - **MIDI Tonnetz**: Euler-Riemann topological grid for visualizing harmonic relationships.
  - **Pitch Class Matrix**: Maps and quantizes incoming MIDI notes to specific roots and scales.
  - **MIDI Monitor**: Logs live MIDI status messages, note numbers, velocities, and CC changes.
  - **MIDI Dynamics**: Multi-mode velocity curve adjustment with compression, expansion, and custom thresholds.
  - **MIDI Transposer**: Splits keyboard ranges into interactive draggable zones (Play and Transpose) supporting polyphonic chord transpositions, customizable transpose hold sustain modes (Sustain Original, Immediate Cutoff, Retrigger), and range-limit filtering on outputs.
- **UI State Logic**: Frame-rate limited state sync (~30fps / 32ms) separating instant synchronous audio triggers from asynchronous rendering cycles. Z-index layering is strictly audited to resolve popovers, settings overlays, and interactive canvas components.

## 4. Recent Evolution
We completed integration of Radix Tooltip primitives into the Chord Notator transformations toolbar, resolved settings overlay z-index stacking issues, and implemented physical keyboard keyswitches to toggle chord transformations on-the-fly. We also refined the WebMIDI permission flows, moving the status indicator pill into the host TitleBar. Prior to this, we solidified the Tone.js + smplr low-latency architecture, completely bypassing AudioWorklet overhead.
