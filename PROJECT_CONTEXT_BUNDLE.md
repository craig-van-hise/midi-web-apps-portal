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
|  ├── # 2.md
|  ├── # 3.md
|  ├── # 4.md
|  ├── # 5.md
|  ├── # 6.md
|  ├── # 7.md
|  ├── # 8.md
|  └── # 9.md
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
|  |  └── rompler
|  |     ├── Knob.jsx
|  |     ├── MasterRompler.jsx
|  |     ├── VUMeter.jsx
|  |     ├── engine.js
|  |     ├── rompler.css
|  |     ├── usePersistentState.js
|  |     └── utils.js
|  ├── hooks
|  ├── index.css
|  ├── main.jsx
|  ├── plugins
|  |  ├── DummyPlugin.jsx
|  |  ├── chord-notator
|  |  |  ├── audio
|  |  |  |  └── engine.ts
|  |  |  ├── components
|  |  |  |  ├── ErrorBoundary.tsx
|  |  |  |  ├── InfoModal.tsx
|  |  |  |  ├── KeySignatureSelector.test.tsx
|  |  |  |  ├── KeySignatureSelector.tsx
|  |  |  |  ├── Keyboard.colorMatrix.test.tsx
|  |  |  |  ├── Keyboard.test.tsx
|  |  |  |  ├── Keyboard.tsx
|  |  |  |  ├── Knob.tsx
|  |  |  |  ├── NavController.tsx
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
|  |  |  |  ├── RomplerFooter.tsx
|  |  |  |  ├── SettingsModal.test.tsx
|  |  |  |  ├── SettingsModal.tsx
|  |  |  |  ├── VUMeter.tsx
|  |  |  |  ├── navTypes.ts
|  |  |  |  └── toolbar
|  |  |  ├── hooks
|  |  |  ├── index.jsx
|  |  |  ├── lib
|  |  |  |  ├── usePersistentState.ts
|  |  |  |  └── utils.ts
|  |  |  ├── midi
|  |  |  |  ├── MIDIProvider.playable.test.tsx
|  |  |  |  ├── MIDIProvider.test.tsx
|  |  |  |  ├── MIDIProvider.tsx
|  |  |  |  └── MidiPortSelector.tsx
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
|  |     ├── index.tsx
|  |     └── styles
|  |        └── matrix.css
|  ├── setupTests.js
|  └── utils
|     ├── ChameleonDummy.jsx
|     └── ChameleonDummy.test.jsx
└── vite.config.js

directory: 979 file: 7131

ignored: directory (143)


[2K[1G

### FILE: PROJECT_STATE.md

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
│   ├── core/               # THE PORTAL HOST
│   │   ├── rompler/        # Tone.js Audio Engine & UI Drawer
│   │   ├── App.jsx         # Main Layout & State Controller
│   │   └── config.js       # App Registry for the sidebar
│   │
│   └── plugins/            # THE HEADLESS MODULES
│       ├── chord-notator/  # Strictly isolated plugin directory
│       ├── dynamics/
│       └── ...

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
  midiIn,         // Array: Raw MIDI data from hardware (e.g., [144, 60, 100])
  onMidiOut,      // Function: Send processed MIDI back to the Rompler
  isBypassed,     // Boolean: True if the Portal's 'Power' button is off
  showInfo,       // Boolean: True if the Portal's 'i' button is toggled
  showSettings,   // Boolean: True if the Portal's 'Cog' button is toggled
  triggerPanic    // Boolean/Counter: Changes when Portal '!' is clicked
}) {
  
  // Example: Route incoming MIDI to your internal engine
  useEffect(() => {
    if (midiIn && !isBypassed) {
      processMidi(midiIn);
    }
  }, [midiIn, isBypassed]);

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

Open `src/core/config.js` (or `appRegistry.js`) and add your new module to the array:

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

```


