# Project State: VV | WebApps Portal

## 1. Architecture & Directory Tree
```text
midi-web-apps-portal/
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── public/
│   ├── PCS_LUT.dat
│   ├── favicon.svg
│   ├── icons.svg
│   └── fonts/
│       └── Bravura.woff2
└── src/
    ├── main.jsx
    ├── index.css
    ├── setupTests.js
    ├── assets/
    │   ├── hero.png
    │   ├── react.svg
    │   └── vite.svg
    ├── config/
    │   ├── appRegistry.js
    │   └── appRegistry.test.js
    ├── core/
    │   ├── App.css
    │   ├── App.jsx
    │   ├── App.test.jsx
    │   ├── rompler/
    │   │   ├── MasterRompler.css
    │   │   └── MasterRompler.jsx
    │   └── utils/
    │       ├── latencyProfiler.js
    │       └── latencyProfiler.test.js
    ├── hooks/
    ├── plugins/
    │   ├── DummyPlugin.jsx
    │   ├── DummyPlugin.test.jsx
    │   ├── chord-notator/
    │   ├── dynamics/
    │   ├── monitor/
    │   ├── note-range-filter/
    │   └── pitch-class-matrix/
    └── utils/
        ├── ChameleonDummy.jsx
        └── ChameleonDummy.test.jsx
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
- **Portal Host Architecture**: A hardware-inspired dark-mode master interface featuring:
  - Collapsible Sidebar with an integrated, extensible application registry.
  - Global master controls (Power, Panic reset, Info modals, Settings panels).
  - Global Web MIDI API manager routing hardware input directly down to active plugins.
  - Global Sample-based Audio Rompler drawer that plugins hook into using a unified MIDI output prop.
  - **UI Throttling**: Frame-rate limited state sync (~30fps / 32ms) separating instant synchronous audio triggers from asynchronous rendering cycles.
- **Integrated Plugins**:
  - **Chord Notator**: Renders sheet music notation (using Bravura music font and VexFlow-style rendering) from live MIDI inputs.
  - **Pitch Class Matrix**: Maps and quantizes incoming MIDI notes to selected roots and scales in real-time. Includes arrow visualizations and throttled keyboard mapping.
  - **MIDI Monitor**: Visualizes live MIDI status messages, note numbers, velocities, and CC changes.
  - **MIDI Dynamics**: Multi-mode velocity curve adjustment with compression, expansion, and custom thresholds.
  - **Note Range Filter**: Restricts, clips, or wraps incoming MIDI notes based on user-defined key limits.

## 4. Recent Evolution
- **UI Throttling & Latency Optimization**: Resolved a "strummed" audio effect during polyphonic chord inputs by throttling host and plugin state updates to 32ms using `useRef` + `lodash/throttle` while keeping Tone.js audio generation strictly synchronous.
- **Midi Event Bus Refactoring**: Moved from state-based `midiIn` prop-drilling to a ref-based `EventTarget` Event Bus, eliminating React state batching issues and stuck notes.
- **CI/CD Deployment Setup**: Added a custom GitHub Actions workflow for automatic deployment to GitHub Pages.
