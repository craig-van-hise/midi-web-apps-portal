# VV | WebApps Portal

Welcome to the **VV | WebApps Portal**—a unified, browser-based showcase for real-time MIDI processing modules. 

Built to demonstrate advanced MIDI data manipulation and web audio integration, this portal acts as a seamless, centralized workspace. It allows users to explore, test, and interact with a suite of custom-built MIDI tools without the friction of managing multiple applications, windows, or hardware routings. Connect your MIDI controller once, and instantly route it through different visualizers, filters, and processors.

## 🚀 Features

* **Global MIDI Routing:** The portal handles a single `navigator.requestMIDIAccess()` instance and pipes raw hardware data down to the active module instantly.
* **Centralized Audio Engine:** Features a deeply optimized Tone.js and smplr engine. Modules do not generate their own audio; they send processed MIDI events to a centralized engine running with minimal latency context buffers, zero-latency algorithmic reverb (Tone.Freeverb), and parallel Aux sends.
* **"Headless" Plugin Architecture:** Modules are strictly isolated in `src/plugins/`. They receive inputs and commands via standard React props, eliminating cross-origin headaches and redundant UI states.
* **Unified Dashboard Interface:** A dark-mode, hardware-inspired aesthetic with a collapsible navigation sidebar and a global top control bar (Power, Panic, Info, Settings).
* **Zero-Friction Context Switching:** Instantly swap between MIDI tools without losing your hardware input selection or your selected Rompler instrument patch.

---

## 🎹 Included MIDI Modules

Currently, the portal hosts the following integrated plugins:

1.  **VV | MIDI Chord Notator & Sequencer:** Generates and displays standard sheet music notation in real-time from live MIDI input. Features an 8-bar chord recording timeline/step sequencer, a multi-row boundary tracker keyboard to prevent text overlap in dense chords, and option+click chord copying.
2.  **VV | MIDI Pitch Class Matrix:** Maps and quantizes incoming MIDI notes to specific musical scales, pitch classes, and roots.
3.  **VV | MIDI Monitor:** Provides real-time visual analysis and logging of incoming MIDI messages and Continuous Controller (CC) data.
4.  **VV | MIDI Dynamics:** Applies custom processing curves, compression, and expansion to MIDI velocity data.
5.  **VV | MIDI Note Range Filter:** Blocks, wraps, or limits MIDI notes that fall outside of a user-defined keyboard range.
6.  **VV | MIDI Transposer:** Splits keyboards into Play and Transpose zones with polyphonic transposing and output filtering.
7.  **VV | MIDI Tonnetz:** Euler-Riemann topological grid for visualizing harmonic relationships.

---

```text
midi-web-apps-portal/
├── public/                 # Global assets, PCS_LUT.dat database, and fonts
├── src/
│   ├── config/             # App Registry and configurations
│   │   └── appRegistry.js
│   ├── core/               # THE PORTAL HOST
│   │   ├── rompler/        # Tone.js + smplr Audio Engine & UI Drawer
│   │   │   ├── engine.js   # Audio engine context, voice mapping & routing
│   │   │   └── ...
│   │   ├── utils/          # Host utilities (latencyProfiler.js)
│   │   └── App.jsx         # Main Host Layout & State Controller
│   └── plugins/            # THE HEADLESS MODULES
│       ├── chord-notator/  # Renders sheet music notation & sequencer
│       ├── dynamics/       # Velocity compressor/expander
│       ├── midi-tonnetz/   # Topological grid for visualizing harmonic relationships
│       ├── midi-transposer/ # Two-zone keyboard transposer & output filter
│       ├── monitor/        # MIDI log/event visualizer
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
