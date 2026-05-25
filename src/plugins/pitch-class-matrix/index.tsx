import React, { useEffect, useRef, useState, useMemo } from 'react';
import throttle from 'lodash/throttle';
import { Settings, Info, X, ChevronDown, ChevronRight, Plus, Copy, Trash2 } from 'lucide-react';
import { Piano88, updateKeyVisuals88, PianoArrow } from './components/88-key';
import './styles/matrix.css';

interface Preset {
  id: string;
  name: string;
  mapping: number[];
  isFactory: boolean;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];

function isWhiteKey(pitchClass: number) {
  return WHITE_KEYS.includes(pitchClass % 12);
}

const FACTORY_PRESETS: Preset[] = [
  { id: 'f-1', isFactory: true, name: 'Chromatic (default)', mapping: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'f-2', isFactory: true, name: 'Major Scale (round down)', mapping: [0, 0, 2, 2, 4, 5, 5, 7, 7, 9, 9, 11] },
  { id: 'f-3', isFactory: true, name: 'Major Scale (round up)', mapping: [0, 2, 2, 4, 4, 5, 7, 7, 9, 9, 11, 11] },
  { id: 'f-4', isFactory: true, name: 'Minor Pentatonic (round down)', mapping: [0, 0, 0, 3, 3, 5, 5, 7, 7, 7, 10, 10] },
  { id: 'f-5', isFactory: true, name: 'Whole Tone Scale (round down)', mapping: [0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10] },
  { id: 'f-6', isFactory: true, name: 'Root Drone', mapping: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'f-7', isFactory: true, name: 'Octave Split', mapping: [0, 0, 0, 0, 0, 0, 12, 12, 12, 12, 12, 12] },
];

export default function PitchClassMatrix({
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
  const [activeNotes, setActiveNotes] = useState<Record<number, { xCol: number, isRemapped: boolean }>>({});
  const activeNotesRef = useRef<Record<number, { xCol: number, isRemapped: boolean }>>({});
  const [pianoArrows, setPianoArrows] = useState<PianoArrow[]>([]);
  const pianoArrowsRef = useRef<PianoArrow[]>([]);

  const syncMatrixUI = useMemo(() => throttle(() => {
    setActiveNotes({ ...activeNotesRef.current });
    setPianoArrows([...pianoArrowsRef.current]);
  }, 32), []);

  useEffect(() => {
    return () => {
      syncMatrixUI.cancel();
    };
  }, [syncMatrixUI]);
  const [presetsExpanded, setPresetsExpanded] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 16 channels, index 0 is Channel 1
  const [channelFilters, setChannelFilters] = useState<boolean[]>(Array(16).fill(true));

  // Initialize from LocalStorage
  const [rootNote, setRootNote] = useState<number>(0);
  const [presets, setPresets] = useState<Preset[]>(FACTORY_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>(FACTORY_PRESETS[0].id);

  // Sync prop changes to local modal visibility state
  useEffect(() => {
    setInfoOpen(showInfo);
  }, [showInfo]);

  useEffect(() => {
    setSettingsOpen(showSettings);
  }, [showSettings]);

  useEffect(() => {
    const savedState = localStorage.getItem('midi-mapper-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.presets) setPresets(parsed.presets);
        if (parsed.activePresetId) setActivePresetId(parsed.activePresetId);
        if (parsed.rootNote !== undefined) setRootNote(parsed.rootNote);
        if (parsed.channelFilters) setChannelFilters(parsed.channelFilters);
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('midi-mapper-state', JSON.stringify({
      presets,
      activePresetId,
      rootNote,
      channelFilters
    }));
  }, [presets, activePresetId, rootNote, channelFilters]);

  // Derived state
  const activePreset = presets.find(p => p.id === activePresetId) || presets[0];
  const mapping = activePreset.mapping;

  // Use refs securely in the MIDI context
  const stateRef = useRef({ rootNote, mapping, channelFilters });
  const activeNotesMapRef = useRef(new Map<number, number>()); // input NoteNum -> output NoteNum
  const outputNoteCountsRef = useRef(new Map<number, number>()); // output NoteNum -> count of active inputs mapping to it

  useEffect(() => {
    stateRef.current = { rootNote, mapping, channelFilters };
  }, [rootNote, mapping, channelFilters]);

  const sendMidiOut = (midiData: number[]) => {
    if (onMidiOut && !isBypassed) {
      onMidiOut(midiData);
    }
  };

  const handleMidiIn = (data: number[]) => {
    const [status, data1, data2] = data;
    const cmd = status >> 4;
    const channel = status & 0xf;

    const { rootNote: root, mapping: map, channelFilters: filters } = stateRef.current;

    // Filter out disabled channels
    if (!filters[channel]) return;

    const isNoteOn = cmd === 9 && data2 > 0;
    const isNoteOff = cmd === 8 || (cmd === 9 && data2 === 0);

    if (isNoteOn) {
      const pitchClass = data1 % 12;
      const octaveBase = data1 - pitchClass;

      const inputCol = (pitchClass - root + 12) % 12;
      const outputRow = map[inputCol]; // 0-12

      let outNote = octaveBase + root + outputRow;
      outNote = Math.max(0, Math.min(127, outNote));

      const currentCount = outputNoteCountsRef.current.get(outNote) || 0;
      outputNoteCountsRef.current.set(outNote, currentCount + 1);

      activeNotesMapRef.current.set(data1, outNote);
 
      sendMidiOut([0x90 | channel, outNote, data2]);
 
      const isRemapped = data1 !== outNote;
      if (!isRemapped) {
        updateKeyVisuals88(data1, '#2563eb');
      } else {
        updateKeyVisuals88(data1, '#f97316');
        updateKeyVisuals88(outNote, '#2563eb');
        pianoArrowsRef.current.push({ input: data1, output: outNote });
      }
 
      activeNotesRef.current[data1] = { xCol: inputCol, isRemapped };
      syncMatrixUI();
    }
    else if (isNoteOff) {
      const outNote = activeNotesMapRef.current.get(data1);
      if (outNote !== undefined) {
        activeNotesMapRef.current.delete(data1);
 
        const currentCount = outputNoteCountsRef.current.get(outNote) || 1;
        const nextCount = currentCount - 1;
        outputNoteCountsRef.current.set(outNote, nextCount);
 
        if (data1 !== outNote) {
          updateKeyVisuals88(data1, '');
          const idx = pianoArrowsRef.current.findIndex(p => p.input === data1 && p.output === outNote);
          if (idx > -1) {
            pianoArrowsRef.current.splice(idx, 1);
          }
        }
 
        if (nextCount <= 0) {
          updateKeyVisuals88(outNote, '');
          sendMidiOut([0x80 | channel, outNote, 0]);
        }
      }
      delete activeNotesRef.current[data1];
      syncMatrixUI();
    }
    else {
      // Pass CC and Pitch Bend
      const isCC = cmd === 11;
      const isPitchBend = cmd === 14;
      if (isCC || isPitchBend) {
        sendMidiOut(data);
      }
    }
  };

  const handlePanic = () => {
    // Turn off all specific active notes map
    activeNotesMapRef.current.forEach((outNote) => {
      for (let c = 0; c < 16; c++) {
        sendMidiOut([0x80 | c, outNote, 0]);
      }
    });
    activeNotesMapRef.current.clear();
    outputNoteCountsRef.current.clear();
    activeNotesRef.current = {};
    pianoArrowsRef.current = [];
    setActiveNotes({});
    setPianoArrows([]);

    // Reset all visuals on panic
    for (let i = 21; i <= 108; i++) {
      updateKeyVisuals88(i, '');
    }

    // Send absolute All Notes Off (CC123) and All Sound Off (CC120) to all 16 channels
    for (let c = 0; c < 16; c++) {
      sendMidiOut([0xB0 | c, 123, 0]);
      sendMidiOut([0xB0 | c, 120, 0]);
      sendMidiOut([0xB0 | c, 64, 0]);
    }
  };

  // Wire incoming MIDI messages to local MIDI handler
  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiEvent = (e: Event) => {
      const data = (e as CustomEvent<number[]>).detail;
      handleMidiIn(data);
    };

    midiBus.addEventListener('midi', handleMidiEvent);
    return () => midiBus.removeEventListener('midi', handleMidiEvent);
  }, [midiBus, isBypassed]);

  // Wire panic triggers
  const initialPanicRef = useRef(true);
  useEffect(() => {
    if (initialPanicRef.current) {
      initialPanicRef.current = false;
      return;
    }
    handlePanic();
  }, [triggerPanic]);

  // Cleanup active keys on unmount
  useEffect(() => {
    return () => {
      for (let i = 21; i <= 108; i++) {
        updateKeyVisuals88(i, '');
      }
    };
  }, []);

  const handleCellClick = (col: number, row: number) => {
    if (activePreset.isFactory) {
      const newId = 'u-' + Date.now();
      const newPreset: Preset = {
        id: newId,
        isFactory: false,
        name: activePreset.name + ' (copy)',
        mapping: [...activePreset.mapping]
      };
      newPreset.mapping[col] = row;
      setPresets(prev => [...prev, newPreset]);
      setActivePresetId(newId);
    } else {
      setPresets(prev => prev.map(p => {
        if (p.id === activePresetId) {
          const nextMapping = [...p.mapping];
          nextMapping[col] = row;
          return { ...p, mapping: nextMapping };
        }
        return p;
      }));
    }
  };

  const handleAddPreset = () => {
    const newId = 'u-' + Date.now();
    const newPreset: Preset = {
      id: newId,
      isFactory: false,
      name: 'New Custom Preset',
      mapping: Array.from({ length: 12 }, (_, i) => i)
    };
    setPresets([...presets, newPreset]);
    setActivePresetId(newId);
  };

  const handleDuplicatePreset = () => {
    const newId = 'u-' + Date.now();
    const newPreset: Preset = {
      id: newId,
      isFactory: false,
      name: activePreset.name + ' (copy)',
      mapping: [...activePreset.mapping]
    };
    setPresets([...presets, newPreset]);
    setActivePresetId(newId);
  };

  const handleDeletePreset = () => {
    if (activePreset.isFactory) return;
    const nextPresets = presets.filter(p => p.id !== activePresetId);
    setPresets(nextPresets);
    setActivePresetId(nextPresets[0].id);
  };

  const yLabels = Array.from({ length: 13 }).map((_, i) => {
    const logicalY = 12 - i;
    const pitchStr = NOTES[(logicalY + rootNote) % 12];
    const isActive = (Object.values(activeNotes) as { xCol: number; isRemapped: boolean }[]).some(n => mapping[n.xCol] === logicalY);
    return (
      <div key={i} style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '8px' }} className={isActive ? 'text-[var(--color-primary)] font-bold' : ''}>
        {pitchStr}
      </div>
    );
  });

  const xLabels = Array.from({ length: 12 }).map((_, i) => {
    const pitchStr = NOTES[(i + rootNote) % 12];
    const isActive = (Object.values(activeNotes) as { xCol: number; isRemapped: boolean }[]).some(n => n.xCol === i);
    return (
      <div key={i} style={{ textAlign: 'center', fontSize: '12px' }} className={isActive ? 'text-[var(--color-primary)] font-bold' : ''}>
        {pitchStr}
      </div>
    );
  });

  return (
    <div className="headless-matrix-plugin bg-white text-[#111111] p-6 w-full min-w-max min-h-screen flex flex-col justify-start items-center">
      <main className="flex flex-row justify-center items-start gap-6 w-full max-w-5xl">
        {/* LEFT COLUMN: PRESETS */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm w-[300px] flex flex-col gap-3 h-fit shrink-0">
          <div
            className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity group border-b pb-2"
            onClick={() => setPresetsExpanded(!presetsExpanded)}
          >
            <div className="flex items-center gap-1">
              {presetsExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <h2 className="axis-title my-0">Presets</h2>
            </div>
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={handleAddPreset} className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer" title="New Custom Preset">
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
              <button onClick={handleDuplicatePreset} className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer" title="Duplicate Active Preset">
                <Copy className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={handleDeletePreset}
                disabled={activePreset.isFactory}
                className="p-1 hover:bg-red-50 disabled:opacity-30 rounded transition-colors group/trash cursor-pointer"
                title="Delete Active Preset"
              >
                <Trash2 className="w-4 h-4 text-gray-500 group-hover/trash:text-red-500" />
              </button>
            </div>
          </div>

          {presetsExpanded && (
            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {presets.map(p => {
                const isSelected = p.id === activePresetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePresetId(p.id)}
                    className={`w-full flex-shrink-0 text-left px-2 py-1.5 min-h-[34px] text-xs border rounded-md transition-all line-clamp-1 cursor-pointer ${isSelected
                        ? 'bg-blue-50 border-[var(--color-primary)] text-[var(--color-primary)] font-bold shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    {p.name} {p.isFactory ? <span className="text-[10px] uppercase ml-1 opacity-50 font-normal">(F)</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CENTER COLUMN: MATRIX */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-fit shrink-0 flex flex-col items-center">
          <div className="w-[240px] text-center mb-2 text-lg font-bold flex items-center justify-center border-b pb-2">
            <span>{NOTES[rootNote]}</span>
            {activePreset.isFactory ? (
              <span className="ml-2 font-medium">{activePreset.name}</span>
            ) : (
              <input
                className="ml-2 w-full bg-transparent outline-none border-b border-transparent focus:border-gray-400 hover:border-gray-200 text-center font-medium placeholder-gray-300"
                value={activePreset.name}
                placeholder="Preset Name"
                onChange={(e) => {
                  const val = e.target.value;
                  setPresets(prev => prev.map(p => p.id === activePresetId ? { ...p, name: val } : p));
                }}
              />
            )}
          </div>

          <div className="flex flex-row items-center justify-center">
            {/* Matrix + X Axis */}
            <div className="flex flex-col relative">
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'repeat(13, 1fr)', width: '240px', height: '260px', gap: '0', border: '1px solid #ccc', boxSizing: 'border-box' }} className="border-gray-300 dark:border-gray-700">
                  {Array.from({ length: 13 }).map((_, yVisual) => {
                    const logicalY = 12 - yVisual;
                    return Array.from({ length: 12 }).map((_, xCol) => {
                      const isMapped = mapping[xCol] === logicalY;
                      const absColPitch = (xCol + rootNote) % 12;
                      const absRowPitch = (logicalY + rootNote) % 12;

                      const colWhite = isWhiteKey(absColPitch);
                      const rowWhite = isWhiteKey(absRowPitch);

                      let bgColorClass = 'bg-[var(--color-piano-mixed)]';
                      if (colWhite && rowWhite) bgColorClass = 'bg-[var(--color-piano-white)]';
                      else if (!colWhite && !rowWhite) bgColorClass = 'bg-[var(--color-piano-black)]';

                      const notesForCol = (Object.values(activeNotes) as { xCol: number; isRemapped: boolean }[]).filter(n => n.xCol === xCol);
                      const isActiveCol = notesForCol.length > 0;
                      const hasRemapped = notesForCol.some(n => n.isRemapped);
                      const isIdentity = xCol === logicalY;

                      if (isMapped) {
                        if (isActiveCol) {
                          bgColorClass = '!bg-blue-400';
                        } else {
                          bgColorClass = '!bg-[var(--color-primary)]';
                        }
                      } else if (isIdentity && hasRemapped) {
                        bgColorClass = '!bg-orange-500';
                      }

                      return (
                        <div
                          key={`${xCol}-${logicalY}`}
                          onClick={() => handleCellClick(xCol, logicalY)}
                          className={`matrix-cell transition-colors border border-[rgba(0,0,0,0.05)] ${bgColorClass}`}
                          style={{ width: '100%', height: '100%', margin: '0', padding: '0', boxSizing: 'border-box' }}
                        />
                      );
                    });
                  })}
                </div>

                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#4ade80" />
                    </marker>
                  </defs>
                  {Array.from(new Set((Object.values(activeNotes) as { xCol: number; isRemapped: boolean }[]).filter(n => n.isRemapped).map(n => n.xCol))).map((xCol) => {
                    const mappedY = mapping[xCol];
                    const startX = (xCol + 0.5) * (240 / 12);
                    const startY = (12 - xCol + 0.5) * (260 / 13);
                    const endX = (xCol + 0.5) * (240 / 12);
                    const endY = (12 - mappedY + 0.5) * (260 / 13);
                    return (
                      <line key={xCol} x1={startX} y1={startY} x2={endX} y2={endY} stroke="#4ade80" strokeWidth="2.5" strokeDasharray="3 3" markerEnd="url(#arrowhead)" />
                    );
                  })}
                </svg>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', width: '240px', padding: '0', marginTop: '4px' }} className="label-mono text-gray-450">
                {xLabels}
              </div>

              <div className="text-center mt-1 axis-title w-[240px]">INPUT NOTE</div>
            </div>

            {/* Y-Axis Components right of Matrix */}
            <div className="flex h-[260px] self-start ml-2 w-[50px]">
              <div className="flex flex-col justify-between h-[260px] text-left label-mono text-gray-450 w-[50px]">
                {yLabels}
              </div>
              <div className="flex flex-col items-center justify-center h-[260px] ml-1">
                <span className="axis-title y-axis-title">OUTPUT NOTE</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SCALE ROOT */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm w-[170px] shrink-0 h-fit">
          <h2 className="axis-title mb-4 border-b pb-2">Scale Root</h2>
          <div className="grid grid-cols-2 gap-3">
            {NOTES.map((note, i) => (
              <label
                key={note}
                className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                <input
                  type="radio"
                  name="scaleRoot"
                  value={i}
                  checked={rootNote === i}
                  onChange={() => setRootNote(i)}
                  className="accent-[var(--color-primary)] w-3 h-3 flex-shrink-0 cursor-pointer"
                />
                {note}
              </label>
            ))}
          </div>
        </div>
      </main>

      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm w-fit mx-auto mt-4 flex justify-center overflow-hidden">
        <Piano88 pianoArrows={pianoArrows} />
      </div>

      {/* Info Modal */}
      {infoOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-1">MIDI Scale Mapper</h2>
            <p className="text-sm text-gray-500 mb-4">by Craig Van Hise</p>

            <div className="text-sm text-gray-700 space-y-4">
              <p>
                A WebMIDI tool to dynamically map incoming MIDI notes to desired outputs via a 13x12 matrix grid. Easily snap to presets or create your own custom quantization rules to filter and perform safely within any key.
              </p>
              <p className="font-medium bg-blue-50 text-blue-800 p-3 rounded border border-blue-100">
                Note remapping logic handles Polyphonic Aftertouch and Pitch Bend passthrough automatically.
              </p>
              <div className="pt-4 border-t border-gray-100 space-y-2 flex flex-col">
                <a href="https://www.virtualvirgin.net/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline inline-block">
                  virtualvirgin.net
                </a>
                <a href="https://github.com/craig-van-hise" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline inline-block">
                  github.com/craig-van-hise
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Filter Channels
            </h2>

            <p className="text-sm text-gray-500 mb-4">Toggle which incoming MIDI channels should be processed and remapped.</p>

            <div className="grid grid-cols-4 gap-3">
              {channelFilters.map((enabled, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const next = [...channelFilters];
                    next[i] = !next[i];
                    setChannelFilters(next);
                  }}
                  className={`py-2 rounded text-xs font-bold border transition-colors cursor-pointer ${enabled
                      ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                      : 'bg-white border-gray-300 text-gray-400 hover:bg-gray-50'
                    }`}
                >
                  Ch {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
