import React, { useEffect, useRef, useState, useMemo } from 'react';
import throttle from 'lodash/throttle';
import KeySplitKeyboard from './components/KeySplitKeyboard';
import TransposeKeyboard88 from './components/TransposeKeyboard88';
import { NoteRangeFilterKeyboard } from './components/NoteRangeFilterKeyboard';
import { useWebMidi } from './hooks/useWebMidi';
import { useMidiStore } from './store/useMidiStore';

export default function MidiTransposerPlugin({
  midiBus,
  onMidiOut,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}) {
  const { activeChannels, setActiveChannels, panic } = useMidiStore();
  const [logs, setLogs] = useState([]);
  const logsRef = useRef([]);

  // Local state for modals to allow close buttons to dismiss them
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync props to local state
  useEffect(() => {
    setInfoOpen(showInfo);
  }, [showInfo]);

  useEffect(() => {
    setSettingsOpen(showSettings);
  }, [showSettings]);

  // Throttled UI state updates to prevent blocking the audio thread
  const syncLogsUI = useMemo(() => throttle(() => {
    setLogs([...logsRef.current]);
  }, 32), []);

  useEffect(() => {
    return () => {
      syncLogsUI.cancel();
    };
  }, [syncLogsUI]);

  // Intercept onMidiOut to log events in a throttled manner
  const handleMidiOutWithLogging = (data) => {
    if (onMidiOut) {
      onMidiOut(data);
    }
    const [status, note, velocity] = data;
    logsRef.current = [
      `[MIDI OUT] status=0x${status.toString(16)} note=${note} velocity=${velocity}`,
      ...logsRef.current.slice(0, 14)
    ];
    syncLogsUI();
  };

  // Bind MIDI processing hook
  useWebMidi({
    midiBus,
    onMidiOut: handleMidiOutWithLogging,
    isBypassed
  });

  // Panic trigger handling
  const initialPanicRef = useRef(true);
  useEffect(() => {
    if (initialPanicRef.current) {
      initialPanicRef.current = false;
      return;
    }
    panic();
    // Dispatch panic downstream
    for (let ch = 0; ch < 16; ch++) {
      if (onMidiOut) {
        onMidiOut([0xB0 | ch, 123, 0]);
        onMidiOut([0xB0 | ch, 120, 0]);
        onMidiOut([0xB0 | ch, 64, 0]);
      }
    }
    logsRef.current = [`[PANIC TRIGGERED]`, ...logsRef.current.slice(0, 14)];
    setLogs([...logsRef.current]);
  }, [triggerPanic, onMidiOut, panic]);

  const toggleChannel = (ch) => {
    if (activeChannels.includes(ch)) {
      setActiveChannels(activeChannels.filter((c) => c !== ch));
    } else {
      setActiveChannels([...activeChannels, ch].sort((a, b) => a - b));
    }
  };

  const simulateMidi = (data) => midiBus && midiBus.dispatchEvent(new CustomEvent('midi', { detail: data }));

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full min-h-[calc(100vh-3.5rem)] bg-white text-neutral-800 overflow-y-auto">
      {/* Three Keyboard Chassis stack with reduced margins */}
      <div className="flex flex-col gap-4 items-center w-full">
        <KeySplitKeyboard simulateMidi={simulateMidi} />
        <TransposeKeyboard88 simulateMidi={simulateMidi} />
        <NoteRangeFilterKeyboard simulateMidi={simulateMidi} />
      </div>

      {/* Hidden logs for testing/diagnostic throttle assertions */}
      <div data-testid="hidden-logs" style={{ display: 'none' }}>
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>

      {/* Info Modal */}
      {infoOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200"
          data-testid="info-modal"
        >
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-2xl max-w-sm w-full relative text-neutral-800">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 font-bold text-lg cursor-pointer"
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-lg font-extrabold mb-3 text-neutral-900 font-sans">
              MIDI Transposer
            </h2>
            <p className="text-neutral-500 text-sm mb-2 leading-relaxed">
              A real-time MIDI processing utility featuring note splitting, transposing, and filtering.
            </p>
            <p className="text-neutral-400 text-xs mb-6">
              by Craig Van Hise
            </p>
            <div className="border-t border-neutral-100 pt-4 flex flex-col gap-2">
              <a
                href="https://virtualvirgin.net"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                virtualvirgin.net
              </a>
              <a
                href="https://github.com/craig-van-hise"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Github Profile
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200"
          data-testid="settings-modal"
        >
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-2xl max-w-md w-full relative text-neutral-800">
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 font-bold text-lg cursor-pointer"
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-lg font-extrabold mb-4 text-neutral-900">
              MIDI Input Channels
            </h2>
            <p className="text-neutral-500 text-xs mb-4">
              Toggle channels to enable/disable processing. Disabled channels are passed through untouched.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {Array.from({ length: 16 }, (_, i) => {
                const ch = i + 1;
                const isActive = activeChannels.includes(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`py-2 rounded-md font-bold text-xs border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100'
                    }`}
                    data-testid={`channel-toggle-${ch}`}
                  >
                    Ch {ch}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 border-t border-neutral-100 pt-4">
              <button
                onClick={() => setActiveChannels(Array.from({ length: 16 }, (_, i) => i + 1))}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <button
                onClick={() => setActiveChannels([])}
                className="text-xs text-neutral-500 hover:underline font-semibold cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
