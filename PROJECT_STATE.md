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
│   │   │   ├── MasterRompler.css
│   │   │   └── MasterRompler.jsx
│   │   ├── utils/
│   │   │   ├── latencyProfiler.js
│   │   │   └── latencyProfiler.test.js
│   │   ├── App.css
│   │   ├── App.jsx
│   │   └── App.test.jsx
│   ├── plugins/
│   │   ├── chord-notator/
│   │   ├── dynamics/
│   │   ├── monitor/
│   │   ├── note-range-filter/
│   │   ├── pitch-class-matrix/
│   │   ├── DummyPlugin.jsx
│   │   └── DummyPlugin.test.jsx
│   ├── index.css
│   ├── main.jsx
│   └── setupTests.js
├── xCleanup/
│   └── src/
│       ├── hooks/
│       ├── plugins/
│       └── utils/
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## 2. Tech Stack
- **Core Framework**: React 19, Vite 8, ES6+ JavaScript
- **Styling**: Tailwind CSS v4, Custom CSS variables, Framer Motion (via `motion`)
- **Audio Engine**: Tone.js (via `tone`, `smplr`), custom sample-based Rompler
- **State Management**: React State & Context, Zustand
- **Utility / Performance**: Lodash (`lodash/throttle`) for frame-rate limiting UI rendering
- **Icons**: Lucide React
- **Testing**: Vitest, React Testing Library

## 3. Current System Capabilities
- **Audio Engine**: Unified sample-based Tone.js Rompler that plugins hook into. Supports polyphonic note generation and instrument switching without blocking.
- **Tracking/MIDI Engine**: Global Web MIDI API manager routing hardware input directly down to active plugins using a ref-based `EventTarget` Event Bus, avoiding React batching issues and stuck notes.
- **Visualizer & Processing Plugins**:
  - **Chord Notator**: Renders sheet music notation from live MIDI inputs in real-time.
  - **Pitch Class Matrix**: Maps and quantizes incoming MIDI notes to specific roots and scales.
  - **MIDI Monitor**: Logs live MIDI status messages, note numbers, velocities, and CC changes.
  - **MIDI Dynamics**: Multi-mode velocity curve adjustment with compression, expansion, and custom thresholds.
  - **Note Range Filter**: Restricts, clips, or wraps incoming MIDI notes based on user-defined key limits.
- **UI State Logic**: Frame-rate limited state sync (~30fps / 32ms) separating instant synchronous audio triggers from asynchronous rendering cycles.

## 4. Recent Evolution
Recent updates focused on fixing frozen MIDI input port selection issues and resolving UI layout and styling bugs. Visual polish was applied to the MIDI Monitor, Pitch Class Matrix, and Chord Notator modules to improve UI presentation, rendering stability, and layout sizing.
