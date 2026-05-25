import React, { useState, useEffect, useRef } from 'react';
import { Settings2, Info } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { updateKeyVisuals128, MidiNoteRangeFilter } from './components/MidiNoteRangeFilter';
import { FilterMode, processNote } from './lib/midiProcessing';

export default function NoteRangeFilterPlugin({
  midiBus,
  onMidiOut,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}: {
  midiBus: EventTarget | null;
  onMidiOut: (data: number[]) => void;
  isBypassed: boolean;
  showInfo: boolean;
  showSettings: boolean;
  triggerPanic: number;
}) {
  const [activeMode, setActiveMode] = useState<FilterMode>('block');
  const [range, setRange] = useState<[number, number]>([0, 127]);
  const [activeMidiChannels, setActiveMidiChannels] = useState<number[]>(
    Array.from({ length: 16 }, (_, i) => i + 1)
  );

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const mappedNotesRef = useRef<Map<number, number | null>>(new Map());

  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync props to local state
  useEffect(() => {
    setInfoOpen(showInfo);
  }, [showInfo]);

  useEffect(() => {
    setSettingsOpen(showSettings);
  }, [showSettings]);

  // Keep refs of current values for MIDI event processing
  const configRef = useRef({ activeMode, range, activeMidiChannels });
  useEffect(() => {
    configRef.current = { activeMode, range, activeMidiChannels };
  }, [activeMode, range, activeMidiChannels]);

  const sendMidiOutRef = useRef(onMidiOut);
  useEffect(() => {
    sendMidiOutRef.current = onMidiOut;
  }, [onMidiOut]);

  // Handle incoming MIDI messages
  const handleMidiIn = (midiData: number[]) => {
    if (!midiData || midiData.length === 0) return;
    const [status, data1, data2] = midiData;
    const cmd = status >> 4;
    const channel = status & 0xf; // 0-indexed
    const channel1 = channel + 1; // 1-indexed

    const { activeMode, range, activeMidiChannels } = configRef.current;

    if (!activeMidiChannels.includes(channel1)) {
      return; 
    }

    const type = cmd === 9 && data2 > 0 ? 'noteon' : (cmd === 8 || (cmd === 9 && data2 === 0)) ? 'noteoff' : null;

    if (type === 'noteon') {
      const processedNote = processNote(data1, range[0], range[1], activeMode);
      if (processedNote !== null) {
        updateKeyVisuals128(processedNote, '#3b82f6');
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.add(processedNote);
          return next;
        });
        mappedNotesRef.current.set(data1, processedNote);
        if (sendMidiOutRef.current) {
          sendMidiOutRef.current([status, processedNote, data2]);
        }
      } else {
        // Blocked, visualize as muted red
        updateKeyVisuals128(data1, 'rgba(239, 68, 68, 0.4)');
        setActiveNotes((prev) => {
          const next = new Set(prev);
          next.add(data1);
          return next;
        });
        mappedNotesRef.current.set(data1, null);
      }
    } else if (type === 'noteoff') {
      const mappedNote = mappedNotesRef.current.get(data1);
      if (mappedNote !== undefined) {
        mappedNotesRef.current.delete(data1);
        if (mappedNote !== null) {
          let isStillActive = false;
          for (const mapped of mappedNotesRef.current.values()) {
            if (mapped === mappedNote) isStillActive = true;
          }
          if (!isStillActive) {
            updateKeyVisuals128(mappedNote, '');
            setActiveNotes((prev) => {
              const next = new Set(prev);
              next.delete(mappedNote);
              return next;
            });
          }
          if (sendMidiOutRef.current) {
            sendMidiOutRef.current([0x80 | channel, mappedNote, 0]);
          }
        } else {
          // Blocked note off visual cleanup
          let isStillActive = false;
          for (const mapped of mappedNotesRef.current.values()) {
            if (mapped === data1) isStillActive = true;
          }
          if (!isStillActive) {
            updateKeyVisuals128(data1, '');
            setActiveNotes((prev) => {
              const next = new Set(prev);
              next.delete(data1);
              return next;
            });
          }
        }
      }
    } else {
      // Pass CC, Pitch Bend, etc.
      if (sendMidiOutRef.current) {
        sendMidiOutRef.current(midiData);
      }
    }
  };

  const handlePanic = () => {
    mappedNotesRef.current.forEach((mappedNote) => {
      if (mappedNote !== null) {
        for (let ch = 0; ch < 16; ch++) {
          if (sendMidiOutRef.current) {
            sendMidiOutRef.current([0x80 | ch, mappedNote, 0]);
          }
        }
      }
    });
    activeNotes.forEach(note => updateKeyVisuals128(note, ''));
    setActiveNotes(new Set());
    mappedNotesRef.current.clear();

    for (let ch = 0; ch < 16; ch++) {
      if (sendMidiOutRef.current) {
        sendMidiOutRef.current([0xB0 | ch, 123, 0]);
        sendMidiOutRef.current([0xB0 | ch, 120, 0]);
        sendMidiOutRef.current([0xB0 | ch, 64, 0]);
      }
    }
  };

  // Wire incoming MIDI
  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiEvent = (e: Event) => {
      const data = (e as CustomEvent<number[]>).detail;
      handleMidiIn(data);
    };

    midiBus.addEventListener('midi', handleMidiEvent);
    return () => midiBus.removeEventListener('midi', handleMidiEvent);
  }, [midiBus, isBypassed]);

  // Wire panic trigger
  const initialPanicRef = useRef(true);
  useEffect(() => {
    if (initialPanicRef.current) {
      initialPanicRef.current = false;
      return;
    }
    handlePanic();
  }, [triggerPanic]);

  // Handle setting changes: flush pending notes to prevent sticking
  useEffect(() => {
    mappedNotesRef.current.forEach((mappedNote, originalNote) => {
      if (mappedNote !== null) {
        for (let ch = 0; ch < 16; ch++) {
          if (sendMidiOutRef.current) {
            sendMidiOutRef.current([0x80 | ch, mappedNote, 0]);
          }
        }
        updateKeyVisuals128(mappedNote, '');
      } else {
        updateKeyVisuals128(originalNote, '');
      }
    });
    
    setActiveNotes(new Set());
    mappedNotesRef.current.clear();
  }, [activeMode, range]);

  // Cleanup visuals on unmount
  useEffect(() => {
    return () => {
      for (let i = 0; i <= 127; i++) {
        updateKeyVisuals128(i, '');
      }
    };
  }, []);

  const toggleChannel = (ch: number) => {
    setActiveMidiChannels(prev => 
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex flex-col items-center justify-center p-4 w-full min-h-[calc(100vh-3.5rem)] bg-[#0b0c10] text-[#c5c6c7]">
        <MidiNoteRangeFilter
          activeMode={activeMode}
          onModeChange={setActiveMode}
          range={range}
          onRangeChange={setRange}
        />

        {infoOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 max-w-sm w-full shadow-2xl relative text-neutral-100">
              <button 
                onClick={() => setInfoOpen(false)} 
                className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl cursor-pointer"
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-2">MIDI Note Range Filter</h2>
              <p className="text-sm text-neutral-500 mb-6 border-b border-neutral-800 pb-4">by Craig Van Hise</p>
              <p className="text-sm text-neutral-300 mb-6 leading-relaxed">
                An interactive UI for managing, filtering, and remapping MIDI note data based on user-defined bounds.
              </p>
              <div className="flex flex-col gap-3">
                <a href="https://www.virtualvirgin.net/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm font-mono break-all">
                  https://www.virtualvirgin.net/
                </a>
                <a href="https://github.com/craig-van-hise" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm font-mono break-all">
                  https://github.com/craig-van-hise
                </a>
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 max-w-md w-full shadow-2xl relative text-neutral-100">
              <button 
                onClick={() => setSettingsOpen(false)} 
                className="absolute top-4 right-4 text-neutral-400 hover:text-white text-xl cursor-pointer"
              >
                &times;
              </button>
              <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                <Settings2 size={24} className="text-neutral-400" />
                <h2 className="text-xl font-bold">Settings</h2>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-neutral-450 mb-3 uppercase tracking-wider">Active MIDI Channels</h3>
                <div className="grid grid-cols-8 gap-2">
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`w-10 h-10 rounded border text-sm font-mono transition-colors cursor-pointer ${
                        activeMidiChannels.includes(ch)
                          ? 'bg-blue-600 border-blue-500 text-white font-bold shadow-md'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
