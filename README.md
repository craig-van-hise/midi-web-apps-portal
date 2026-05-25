
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
