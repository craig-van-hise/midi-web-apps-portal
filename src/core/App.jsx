import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import throttle from 'lodash/throttle';
import * as Icons from 'lucide-react';
import { appRegistry } from '../config/appRegistry';
import DummyPlugin from '../plugins/DummyPlugin';
import ChordNotator from '../plugins/chord-notator';
import PitchClassMatrix from '../plugins/pitch-class-matrix';
import MidiMonitor from '../plugins/monitor';
import MidiDynamics from '../plugins/dynamics';
import MidiTransposer from '../plugins/midi-transposer';
import { MasterRompler } from './rompler/MasterRompler';
import { motion, AnimatePresence } from 'framer-motion';
import { latencyProfiler } from './utils/latencyProfiler';
import { audioEngine } from './rompler/engine';
import { MidiRingBuffer } from './utils/RingBuffer';

const midiRingBuffer = new MidiRingBuffer();

function AppIcon({ name, className }) {
  const IconComponent = Icons[name] || Icons.Music;
  return <IconComponent className={className} size={18} />;
}

function getPluginComponent(appId) {
  if (appId === 'chord-notator') {
    return ChordNotator;
  }
  if (appId === 'pitch-class-matrix') {
    return PitchClassMatrix;
  }
  if (appId === 'monitor') {
    return MidiMonitor;
  }
  if (appId === 'dynamics') {
    return MidiDynamics;
  }
  if (appId === 'midi-transposer') {
    return MidiTransposer;
  }
  return DummyPlugin;
}


function App() {
  const [activeApp, setActiveApp] = useState(appRegistry[0]);
  const [isPowerActive, setIsPowerActive] = useState(true);
  const [midiAccess, setMidiAccess] = useState(null);
  const [midiInputs, setMidiInputs] = useState([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modal & Panic states for Plugins
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [panicTriggerState, setPanicTriggerState] = useState(0);
  const midiBusRef = useRef(new EventTarget());

  // Rompler states (for Phase 5)
  const [activeNotes, setActiveNotes] = useState([]);
  const activeNotesRef = useRef([]);
  const [romplerLoaded, setRomplerLoaded] = useState(false);
  const [volume, setVolume] = useState(-12); // dB

  const syncActiveNotesUI = useMemo(() => throttle(() => {
    setActiveNotes([...activeNotesRef.current]);
  }, 32), []);

  const handleRomplerOutput = useCallback((midiData) => {
    if (!midiData || midiData.length === 0) return;
    const [status, note, velocity] = midiData;
    const command = status & 0xf0;

    // DIRECT FAST-PATH TO AUDIO WORKLET VIA SAB
    if (midiRingBuffer) {
      midiRingBuffer.push(status, note, velocity);
    }

    // Throttled UI Render
    if (command === 0x90 && velocity > 0) {
      if (!activeNotesRef.current.some((n) => n.note === note)) {
        activeNotesRef.current.push({ note, velocity, time: Date.now() });
      }
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      activeNotesRef.current = activeNotesRef.current.filter((n) => n.note !== note);
    }
    syncActiveNotesUI();
  }, [syncActiveNotesUI]);

  // Set up Web MIDI API access
  useEffect(() => {
    let isMounted = true;
    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess()
        .then((access) => {
          if (!isMounted) return;
          setMidiAccess(access);
          const inputs = Array.from(access.inputs.values());
          setMidiInputs(inputs);
          setSelectedInputId((prev) => prev || (inputs.length > 0 ? inputs[0].id : ''));
          
          access.onstatechange = () => {
            if (!isMounted) return;
            const updatedInputs = Array.from(access.inputs.values());
            setMidiInputs(updatedInputs);
            
            setSelectedInputId((prevId) => {
              if (updatedInputs.length > 0) {
                // Keep the current selection if it still exists in the updated list
                const stillExists = updatedInputs.some(i => i.id === prevId);
                return stillExists ? prevId : updatedInputs[0].id;
              }
              return '';
            });
          };
        })
        .catch((err) => {
          console.warn('MIDI Access failed or denied:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Route physical MIDI messages to active plugin state via lock-free ring buffer
  useEffect(() => {
    if (!midiAccess || !selectedInputId) return;
    const input = midiAccess.inputs.get(selectedInputId);
    if (!input) return;

    const handleMidiMessage = (message) => {
      const data = Array.from(message.data);
      if (isPowerActive) {
        if ((data[0] & 0xf0) === 0x90 && data[2] > 0) latencyProfiler.markInput(data[1]);
        const customEvent = new CustomEvent('midi', { detail: data });
        midiBusRef.current.dispatchEvent(customEvent);
      }
    };

    input.addEventListener('midimessage', handleMidiMessage);
    return () => {
      input.removeEventListener('midimessage', handleMidiMessage);
    };
  }, [midiAccess, selectedInputId, isPowerActive]);



  // Reset states on active app transition
  useEffect(() => {
    setActiveNotes([]);
    activeNotesRef.current = [];
    setIsInfoModalOpen(false);
    setIsSettingsModalOpen(false);
    if (window.romplerPanic) {
      window.romplerPanic();
    }
  }, [activeApp]);

  const handleTogglePowerClick = () => {
    setIsPowerActive(!isPowerActive);
  };

  const handlePanicClick = () => {
    setActiveNotes([]);
    activeNotesRef.current = [];
    setPanicTriggerState((prev) => prev + 1);
    if (window.romplerPanic) {
      window.romplerPanic();
    }
  };

  const handleInfoClick = () => {
    setIsInfoModalOpen((prev) => !prev);
  };

  const handleSettingsClick = () => {
    setIsSettingsModalOpen((prev) => !prev);
  };

  const ActivePlugin = getPluginComponent(activeApp.id);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0c10] text-[#c5c6c7] font-sans select-none overflow-hidden">
      {/* Zone A: Top Master Bar */}
      <header className="h-14 bg-[#1f2833] border-b border-[#2f3c4c] flex items-center justify-between px-6 z-10 shrink-0">
        {/* Left: Logo & Dynamic Active App Title */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="text-xl font-bold bg-gradient-to-r from-purple-500 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              VV
            </span>
            <span className="text-[#45f3ff] text-xs font-semibold tracking-wider px-1.5 py-0.5 border border-[#45f3ff]/30 rounded">
              PORTAL
            </span>
          </div>
          <span className="text-zinc-600">|</span>
          <h1 className="text-sm font-medium text-white truncate max-w-[200px] md:max-w-[300px]">
            {activeApp.title}
          </h1>
        </div>

        {/* Center: Global MIDI Selector */}
        <div className="flex items-center space-x-2 bg-[#0b0c10] border border-[#2f3c4c] rounded px-2.5 py-1">
          <Icons.Activity className="text-[#45f3ff] animate-pulse" size={16} />
          <select
            aria-label="MIDI Input Source"
            value={selectedInputId}
            onChange={(e) => setSelectedInputId(e.target.value)}
            className="bg-transparent border-none text-xs text-[#c5c6c7] focus:outline-none cursor-pointer font-mono"
          >
            {midiInputs.length > 0 ? (
              midiInputs.map((input) => (
                <option key={input.id} value={input.id} className="bg-[#1f2833]">
                  {input.name || `MIDI Input (${input.id})`}
                </option>
              ))
            ) : (
              <option value="" className="bg-[#1f2833]">No MIDI Device Connected</option>
            )}
          </select>
        </div>

        {/* Right: Control Cluster */}
        <div className="flex items-center space-x-2">
          {/* Power Button */}
          <button
            aria-label="Power Toggle"
            onClick={handleTogglePowerClick}
            className={`p-2 rounded border transition-all ${
              isPowerActive
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'border-zinc-700 bg-[#0b0c10] text-zinc-500 hover:border-emerald-500/30'
            }`}
          >
            <Icons.Power size={16} />
          </button>

          {/* Panic Button */}
          <button
            aria-label="Panic Button"
            onClick={handlePanicClick}
            className="p-2 rounded border border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all shadow-[0_0_8px_rgba(244,63,94,0.15)]"
          >
            <Icons.AlertOctagon size={16} />
          </button>

          {/* Info Button */}
          <button
            aria-label="Toggle Info Modal"
            onClick={handleInfoClick}
            className="p-2 rounded border border-zinc-700 bg-[#0b0c10] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            <Icons.Info size={16} />
          </button>

          {/* Settings Button */}
          <button
            aria-label="Toggle Settings Modal"
            onClick={handleSettingsClick}
            className="p-2 rounded border border-zinc-700 bg-[#0b0c10] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            <Icons.Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Panel Body */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Zone B: Collapsible Sidebar */}
        <motion.aside
          animate={{ width: isSidebarOpen ? 320 : 64 }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className="bg-[#151a21] border-r border-[#2f3c4c] flex flex-col shrink-0 overflow-hidden relative"
        >
          {/* Sidebar Header - h-14 to match Main Header */}
          <div className="h-14 px-4 border-b border-[#2f3c4c] flex items-center justify-between shrink-0">
            {isSidebarOpen ? (
              <h2 className="text-xs font-bold tracking-widest text-[#45f3ff] uppercase truncate">
                MIDI Modules
              </h2>
            ) : (
              <div className="w-0 overflow-hidden" />
            )}
            <button
              aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1 rounded text-zinc-500 hover:text-[#45f3ff] hover:bg-[#1f2833] transition-all ${
                !isSidebarOpen ? 'mx-auto' : ''
              }`}
            >
              {isSidebarOpen ? <Icons.ChevronLeft size={16} /> : <Icons.ChevronRight size={16} />}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-2">
            {appRegistry.map((app) => {
              const isActive = app.id === activeApp.id;
              return (
                <button
                  key={app.id}
                  onClick={() => setActiveApp(app)}
                  title={!isSidebarOpen ? app.title : undefined}
                  className={`w-full rounded-lg border transition-all flex items-center ${
                    isSidebarOpen ? 'p-3.5 space-x-3 text-left' : 'p-2 justify-center'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-950/40 to-indigo-950/20 border-purple-500/50 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)]'
                      : 'bg-[#1f2833]/40 border-[#2f3c4c]/40 text-[#c5c6c7] hover:bg-[#1f2833]/70 hover:border-[#2f3c4c]'
                  }`}
                >
                  <div className={`p-2 rounded shrink-0 ${isActive ? 'bg-purple-500/20 text-[#45f3ff]' : 'bg-[#0b0c10] text-zinc-400'}`}>
                    <AppIcon name={app.icon} />
                  </div>
                  {isSidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-white truncate">
                        {app.title}
                      </h3>
                      <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {app.description}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </motion.aside>

        {/* Zone C & D: Main Column */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0b0c10] min-w-0">

          {/* Zone C: Plugin Main Pane */}
          <div className="flex-1 relative overflow-y-auto bg-transparent">
            <ActivePlugin
              midiBus={midiBusRef.current}
              onMidiOut={handleRomplerOutput}
              isBypassed={!isPowerActive}
              showInfo={isInfoModalOpen}
              showSettings={isSettingsModalOpen}
              triggerPanic={panicTriggerState}
            />
          </div>

          {/* Zone D: Tone.js Rompler Drawer */}
          <MasterRompler
            isOpen={isDrawerOpen}
            onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
            sabBuffer={midiRingBuffer.array.buffer}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
