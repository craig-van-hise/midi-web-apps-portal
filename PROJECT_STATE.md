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
    │   └── rompler/
    │       ├── MasterRompler.css
    │       └── MasterRompler.jsx
    ├── hooks/
    ├── plugins/
    │   ├── DummyPlugin.jsx
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
- **Icons**: Lucide React
- **Testing**: Vitest, React Testing Library

## 3. Current System Capabilities
- **Portal Host Architecture**: A hardware-inspired dark-mode master interface featuring:
  - Collapsible Sidebar with an integrated, extensible application registry.
  - Global master controls (Power, Panic reset, Info modals, Settings panels).
  - Global Web MIDI API manager routing hardware input directly down to active plugins.
  - Global Sample-based Audio Rompler drawer that plugins hook into using a unified MIDI output prop.
- **Integrated Plugins**:
  - **Chord Notator**: Renders sheet music notation (using Bravura music font and VexFlow-style rendering) from live MIDI inputs.
  - **Pitch Class Matrix**: Maps and quantizes incoming MIDI notes to selected roots and scales in real-time.
  - **MIDI Monitor**: Visualizes live MIDI status messages, note numbers, velocities, and CC changes.
  - **MIDI Dynamics**: Multi-mode velocity curve adjustment with compression, expansion, and custom thresholds.
  - **Note Range Filter**: Restricts, clips, or wraps incoming MIDI notes based on user-defined key limits.

## 4. Recent Evolution
- **Initial Setup**: Initialized the project configuration and the global modular architecture.
- **Core Layout & State**: Completed implementation of the master layout UI (`App.jsx`), global MIDI access hooks, and standard routing to the Tone.js audio engine.
- **Headless API**: Configured standard prop-based message passing interface between host and plugins.
