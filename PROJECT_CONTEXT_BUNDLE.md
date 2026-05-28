### FILE: project_tree.txt


/Users/vv2024/Documents/Repos - vv2024/MIDI/WebApps/midi-web-apps-portal
├── # Prompts
|  ├── # 0.md
|  ├── # 1.md
|  ├── # 10.md
|  ├── # 11.md
|  ├── # 12.md
|  ├── # 13.md
|  ├── # 14.md
|  ├── # 15.md
|  ├── # 16.md
|  ├── # 17.md
|  ├── # 18.md
|  ├── # 19.md
|  ├── # 2.md
|  ├── # 20.md
|  ├── # 22.md
|  ├── # 23.md
|  ├── # 24.md
|  ├── # 25.md
|  ├── # 26.md
|  ├── # 27.md
|  ├── # 28.md
|  ├── # 29.md
|  ├── # 3.md
|  ├── # 30.md
|  ├── # 31.md
|  ├── # 32.md
|  ├── # 33.md
|  ├── # 4.md
|  ├── # 5.md
|  ├── # 6.md
|  ├── # 7.md
|  ├── # 8.md
|  └── # 9.md
├── 2026-05-25_REPO_REPORT.md
├── DropFolder
├── GUIDE_TO_LOW_LATENCY.md
├── PROJECT_CONTEXT_BUNDLE.md
├── PROJECT_STATE.md
├── README.md
├── README_original.md
├── eslint.config.js
├── index.html
├── llms.txt
├── package-lock.json
├── package.json
├── project_tree.txt
├── public
|  ├── PCS_LUT.dat
|  ├── favicon.svg
|  ├── fonts
|  |  └── Bravura.woff2
|  └── icons.svg
├── src
|  ├── assets
|  |  ├── hero.png
|  |  ├── react.svg
|  |  └── vite.svg
|  ├── config
|  |  ├── appRegistry.js
|  |  └── appRegistry.test.js
|  ├── core
|  |  ├── App.css
|  |  ├── App.jsx
|  |  ├── App.test.jsx
|  |  ├── rompler
|  |  |  ├── Knob.jsx
|  |  |  ├── MasterRompler.jsx
|  |  |  ├── VUMeter.jsx
|  |  |  ├── engine.js
|  |  |  ├── engine.test.js
|  |  |  ├── rompler.css
|  |  |  ├── usePersistentState.js
|  |  |  └── utils.js
|  |  └── utils
|  |     ├── latencyProfiler.js
|  |     └── latencyProfiler.test.js
|  ├── index.css
|  ├── main.jsx
|  ├── plugins
|  |  ├── DummyPlugin.jsx
|  |  ├── DummyPlugin.test.jsx
|  |  ├── chord-notator
|  |  |  ├── audio
|  |  |  |  └── engine.ts
|  |  |  ├── components
|  |  |  |  ├── InfoModal.tsx
|  |  |  |  ├── KeySignatureSelector.test.tsx
|  |  |  |  ├── KeySignatureSelector.tsx
|  |  |  |  ├── Keyboard.colorMatrix.test.tsx
|  |  |  |  ├── Keyboard.test.tsx
|  |  |  |  ├── Keyboard.tsx
|  |  |  |  ├── NotationCanvas.bugs.test.tsx
|  |  |  |  ├── NotationCanvas.colorMatrix.test.tsx
|  |  |  |  ├── NotationCanvas.events.test.tsx
|  |  |  |  ├── NotationCanvas.headless.test.tsx
|  |  |  |  ├── NotationCanvas.history.test.tsx
|  |  |  |  ├── NotationCanvas.listenMode.test.tsx
|  |  |  |  ├── NotationCanvas.selection.test.tsx
|  |  |  |  ├── NotationCanvas.shortcutAudio.test.tsx
|  |  |  |  ├── NotationCanvas.test.tsx
|  |  |  |  ├── NotationCanvas.tsx
|  |  |  |  ├── SettingsModal.test.tsx
|  |  |  |  ├── SettingsModal.tsx
|  |  |  |  └── toolbar
|  |  |  ├── hooks
|  |  |  ├── index.jsx
|  |  |  ├── index.test.jsx
|  |  |  ├── lib
|  |  |  |  ├── usePersistentState.ts
|  |  |  |  └── utils.ts
|  |  |  ├── midi
|  |  |  |  ├── MIDIProvider.playable.test.tsx
|  |  |  |  ├── MIDIProvider.test.tsx
|  |  |  |  └── MIDIProvider.tsx
|  |  |  └── utils
|  |  |     ├── binaryLut.ts
|  |  |     ├── chordSpeller.test.ts
|  |  |     ├── chordSpeller.ts
|  |  |     ├── notationMath.test.ts
|  |  |     ├── notationMath.ts
|  |  |     ├── notationMath.xLevel.test.ts
|  |  |     ├── symmetricalSpeller.test.ts
|  |  |     └── symmetricalSpeller.ts
|  |  ├── dynamics
|  |  |  └── index.tsx
|  |  ├── monitor
|  |  |  ├── index.test.tsx
|  |  |  └── index.tsx
|  |  ├── note-range-filter
|  |  |  ├── components
|  |  |  |  └── MidiNoteRangeFilter.tsx
|  |  |  ├── index.tsx
|  |  |  └── lib
|  |  |     └── midiProcessing.ts
|  |  └── pitch-class-matrix
|  |     ├── components
|  |     |  └── 88-key.tsx
|  |     ├── index.test.tsx
|  |     ├── index.tsx
|  |     └── styles
|  |        └── matrix.css
|  ├── setupTests.js
|  └── utils
└── vite.config.js

directory: 989 file: 8202

ignored: directory (144)


[2K[1G

### FILE: PROJECT_STATE.md

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


### FILE: README.md


# VV | WebApps Portal

Welcome to the **VV | WebApps Portal**—a unified, browser-based showcase for real-time MIDI processing modules. 

Built to demonstrate advanced MIDI data manipulation and web audio integration, this portal acts as a seamless, centralized workspace. It allows users to explore, test, and interact with a suite of custom-built MIDI tools without the friction of managing multiple applications, windows, or hardware routings. Connect your MIDI controller once, and instantly route it through different visualizers, filters, and processors.

## 🚀 Features

* **Global MIDI Routing:** The portal handles a single `navigator.requestMIDIAccess()` instance and pipes raw hardware data down to the active module instantly.
* **Centralized Audio Engine:** Features a global, sample-based Tone.js Rompler drawer. Modules do not generate their own audio; they simply send processed MIDI data back up to the portal.
* **"Headless" Plugin Architecture:** Modules are strictly isolated in `src/plugins/`. They receive inputs and commands via standard React props, eliminating cross-origin headaches and redundant UI states.
* **Unified Dashboard Interface:** A dark-mode, hardware-inspired aesthetic with a collapsible navigation sidebar and a global top control bar (Power, Panic, Info, Settings).
* **Zero-Friction Context Switching:** Instantly swap between MIDI tools without losing your hardware input selection or your selected Rompler instrument patch.

---

## 🎹 Included MIDI Modules

Currently, the portal hosts the following integrated plugins:

1.  **VV | MIDI Chord Notator:** Generates and displays standard sheet music notation in real-time from live MIDI input.
2.  **VV | MIDI Pitch Class Matrix:** Maps and quantizes incoming MIDI notes to specific musical scales, pitch classes, and roots.
3.  **VV | MIDI Monitor:** Provides real-time visual analysis and logging of incoming MIDI messages and Continuous Controller (CC) data.
4.  **VV | MIDI Dynamics:** Applies custom processing curves, compression, and expansion to MIDI velocity data.
5.  **VV | MIDI Note Range Filter:** Blocks, wraps, or limits MIDI notes that fall outside of a user-defined keyboard range.

---

## 🛠️ Architecture & Directory Structure

The repository is strictly divided into the core host environment and isolated plugins to prevent code bleed and ensure easy porting to desktop/VST formats in the future.

```text
midi-web-apps-portal/
├── public/                 # Global assets, LUTs, and digital fonts
├── src/
│   ├── config/             # App Registry and configurations
│   │   └── appRegistry.js
│   ├── core/               # THE PORTAL HOST
│   │   ├── rompler/        # Tone.js Audio Engine & UI Drawer
│   │   ├── utils/          # Host utilities (e.g. latency profiler)
│   │   └── App.jsx         # Main Host Layout & State Controller
│   │
│   └── plugins/            # THE HEADLESS MODULES
│       ├── chord-notator/  # Renders sheet music notation
│       ├── dynamics/       # Velocity compressor/expander
│       ├── monitor/        # MIDI log/event visualizer
│       ├── note-range-filter/ # Filters MIDI note ranges
│       └── pitch-class-matrix/ # Scale and root quantizer
```

---

## 💻 Development Setup

This project uses [Vite](https://vitejs.dev/) and React.

1. **Install Dependencies:**
```bash
npm install

```


2. **Start the Local Development Server:**
```bash
npm run dev

```


3. **Build for Production (GitHub Pages):**
```bash
npm run build

```



---

## 🔌 How to Add a New Plugin

To keep the ecosystem clean, all new VV MIDI tools should be developed to conform to the Portal's prop-based API.

### 1. Create the Plugin Silo

Create a new folder in `src/plugins/your-new-plugin/`. Keep all specific components, utility functions, and hooks within this folder.

### 2. Implement the Standard API (`index.jsx`)

Your plugin must export a single default React component from its root `index.jsx` file. It must accept the following standardized props from the Master Host:

```jsx
export default function YourNewPlugin({ 
  midiBus,        // EventTarget: Event bus for incoming MIDI messages
  onMidiOut,      // Function: Send processed MIDI back to the Rompler
  isBypassed,     // Boolean: True if the Portal's 'Power' button is off
  showInfo,       // Boolean: True if the Portal's 'i' button is toggled
  showSettings,   // Boolean: True if the Portal's 'Cog' button is toggled
  triggerPanic    // Boolean/Counter: Changes when Portal '!' is clicked
}) {
  
  // Example: Listen to incoming MIDI events from the bus
  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidi = (e) => {
      const data = e.detail; // Array format e.g. [144, 60, 100]
      processMidi(data);
    };

    midiBus.addEventListener('midi', handleMidi);
    return () => {
      midiBus.removeEventListener('midi', handleMidi);
    };
  }, [midiBus, isBypassed]);

  // Example: Send processed notes to the master audio engine
  const handleNoteGenerated = (noteData) => {
    onMidiOut(noteData);
  };

  return (
    <div className="headless-plugin-wrapper">
      {/* Your Core UI Here (NO Title Bars or MIDI Selectors) */}
      
      {/* Conditionally render your native modals based on Portal props */}
      {showInfo && <YourInfoModal />}
    </div>
  );
}
```

### 3. Register the Plugin

Open `src/config/appRegistry.js` (or `src/core/config.js` depending on setup) and add your new module to the array:

```javascript
import YourNewPlugin from '../plugins/your-new-plugin';

export const appRegistry = [
  // ... existing plugins
  {
    id: "your-new-plugin",
    title: "VV | Your New Plugin",
    icon: "Activity", // Lucide React icon name
    component: YourNewPlugin,
    description: "Brief description for the sidebar."
  }
];
```

---

## ⚡ Performance Guidelines: UI Throttling

To prevent **Main Thread Blocking** and audio latency/choking (such as the "strummed" audio artifact during rapid polyphonic chords), you must follow these guidelines:

1. **Keep Audio Path Synchronous:** The `onMidiOut` callback and Tone.js audio generation must execute synchronously and immediately upon receiving a MIDI event.
2. **Decouple React Renders:** Never trigger a React state update (`useState` setter) synchronously inside your MIDI message listeners.
3. **Use the `useRef` + `throttle` Pattern:** 
   - Store incoming note arrays, visual states, and logs in a mutable React `useRef`.
   - Update the `useRef` synchronously on every MIDI event.
   - Use `lodash/throttle` (usually ~30fps/32ms) to flush the ref's content to the React state.

Example throttled implementation:
```javascript
import React, { useEffect, useState, useRef, useMemo } from 'react';
import throttle from 'lodash/throttle';

export default function MyPlugin({ midiBus, onMidiOut, isBypassed }) {
  const [activeNotes, setActiveNotes] = useState([]);
  const activeNotesRef = useRef([]);

  // Throttle state updates to ~30fps
  const syncNotesUI = useMemo(() => throttle(() => {
    setActiveNotes([...activeNotesRef.current]);
  }, 32), []);

  useEffect(() => {
    return () => syncNotesUI.cancel(); // Cleanup on unmount
  }, [syncNotesUI]);

  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiEvent = (e) => {
      const data = e.detail;
      const [status, note, velocity] = data;
      const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;

      // 1. Audio remains synchronous
      if (isNoteOn) {
        onMidiOut(data);
      }

      // 2. UI rendering state is throttled
      if (isNoteOn) {
        activeNotesRef.current.push(note);
      } else {
        activeNotesRef.current = activeNotesRef.current.filter(n => n !== note);
      }
      syncNotesUI();
    };

    midiBus.addEventListener('midi', handleMidiEvent);
    return () => midiBus.removeEventListener('midi', handleMidiEvent);
  }, [midiBus, isBypassed, onMidiOut, syncNotesUI]);

  // ...
}
```


