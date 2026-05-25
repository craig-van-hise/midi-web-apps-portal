import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FilterMode } from '../lib/midiProcessing';

// --- Constants & Geometry ---
const SCALE = 0.75;
const WHITE_KEY_WIDTH = 17 * SCALE;
const WHITE_KEY_HEIGHT = 78 * SCALE;
const BLACK_KEY_WIDTH = 10 * SCALE;
const BLACK_KEY_HEIGHT = 52 * SCALE;
const TOTAL_WIDTH = 75 * WHITE_KEY_WIDTH; // 1275 * 0.75

export const getNoteCenterX = (note: number) => {
  const whiteKeyIndices = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const isWhite = [0, 2, 4, 5, 7, 9, 11].includes(note % 12);
  const whiteKeysBefore = Math.floor(note / 12) * 7 + whiteKeyIndices[note % 12];
  
  if (isWhite) {
    return (whiteKeysBefore + 0.5) * WHITE_KEY_WIDTH;
  } else {
    return (whiteKeysBefore + 1) * WHITE_KEY_WIDTH;
  }
};

const getClosestNote = (x: number) => {
  let minNote = 0;
  let minDist = Infinity;
  for (let i = 0; i <= 127; i++) {
    const cx = getNoteCenterX(i);
    const dist = Math.abs(cx - x);
    if (dist < minDist) {
      minDist = dist;
      minNote = i;
    }
  }
  return minNote;
};

// --- Mode Descriptions ---
const MODE_DESCRIPTIONS: Record<FilterMode, string> = {
  block: 'Mutes notes that fall outside the active range.',
  octave_wrap: 'Folds out-of-range notes by shifting them up or down by octaves until they fit.',
  wrap: 'Folds out-of-range notes back into the range directly.',
  limit: 'Clamps out-of-range notes to the nearest edge (min or max).'
};

// --- Subcomponent: RangeSlider ---
interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({ min, max, value, onValueChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingThumb, setDraggingThumb] = useState<'min' | 'max' | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, thumb: 'min' | 'max') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingThumb(thumb);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!draggingThumb || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const note = getClosestNote(x);

    let newMin = value[0];
    let newMax = value[1];

    if (draggingThumb === 'min') {
      newMin = Math.min(Math.max(note, min), value[1]);
    } else {
      newMax = Math.max(Math.min(note, max), value[0]);
    }

    if (newMin !== value[0] || newMax !== value[1]) {
      onValueChange([newMin, newMax]);
    }
  }, [draggingThumb, value, min, max, onValueChange]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (draggingThumb) {
      setDraggingThumb(null);
    }
  }, [draggingThumb]);

  useEffect(() => {
    if (draggingThumb) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingThumb, handlePointerMove, handlePointerUp]);

  const x1 = getNoteCenterX(value[0]);
  const x2 = getNoteCenterX(value[1]);

  return (
    <div style={{ width: `${TOTAL_WIDTH}px`, display: 'flex', flexDirection: 'column' }}>
        <div 
          ref={containerRef}
          style={{ width: `${TOTAL_WIDTH}px`, height: '32px', position: 'relative', touchAction: 'none' }}
          className="select-none mx-auto"
        >
          {/* Background Track */}
          <div className="absolute top-[22px] left-0 right-0 h-[4px] bg-neutral-850 rounded-full" />
          
          {/* Active Range Track */}
          <div 
            className="absolute top-[22px] h-[4px] bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
            style={{ left: `${x1}px`, width: `${x2 - x1}px` }} 
          />

          {/* Thumbs */}
          <Thumb x={x1} value={value[0]} type="min" onPointerDown={(e) => handlePointerDown(e, 'min')} isDragging={draggingThumb === 'min'} />
          <Thumb x={x2} value={value[1]} type="max" onPointerDown={(e) => handlePointerDown(e, 'max')} isDragging={draggingThumb === 'max'} />
        </div>
    </div>
  );
};

const Thumb = ({ x, value, type, onPointerDown, isDragging }: { x: number, value: number, type: 'min' | 'max', onPointerDown: any, isDragging: boolean }) => {
  return (
    <div 
      onPointerDown={onPointerDown}
      className={`absolute top-[0px] flex flex-col items-center justify-center -translate-x-1/2 ${isDragging ? 'cursor-grabbing z-20' : 'cursor-grab z-10'}`}
      style={{ left: `${x}px` }}
    >
      <div className="bg-neutral-900 border border-blue-500 text-white font-mono text-[10px] leading-none px-1.5 py-0.5 rounded shadow-lg mb-[2px] pointer-events-none whitespace-nowrap">
        {value}
      </div>
      <svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="pointer-events-none drop-shadow-md">
         <path d="M7 15L0 8V3C0 1.34315 1.34315 0 3 0H11C12.6569 0 14 1.34315 14 3V8L7 15Z" fill="#171717" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
         <line x1="7" y1="3" x2="7" y2="7" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
};

// --- Subcomponent: Piano128 ---
interface Piano128Props {
    middleC?: 'C3' | 'C4' | 'C5';
    minRange: number;
    maxRange: number;
}

export const Piano128: React.FC<Piano128Props> = ({ middleC = 'C4', minRange, maxRange }) => {
    const pianoKeys = [];

    // Range: MIDI 0 to 127
    for (let note = 0; note <= 127; note++) {
        const noteInOctave = note % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);
        
        const isOutOfRange = note < minRange || note > maxRange;

        if (!isBlack) {
            const hasRightBlack = [0, 2, 5, 7, 9].includes(noteInOctave) && (note + 1 <= 127);
            const isC = noteInOctave === 0;
            const octave = Math.floor(note / 12) + (middleC === 'C3' ? -2 : middleC === 'C5' ? 0 : -1);

            pianoKeys.push(
                <div
                    key={`w-${note}`}
                    id={`pk128-${note}`}
                    style={{
                        width: `${WHITE_KEY_WIDTH}px`,
                        height: `${WHITE_KEY_HEIGHT}px`,
                        borderLeft: '1px solid #333',
                        borderRight: '1px solid #333',
                        backgroundColor: '#fff',
                        position: 'relative',
                        boxSizing: 'border-box',
                        borderBottomLeftRadius: '3px',
                        borderBottomRightRadius: '3px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        flexShrink: 0
                    }}
                >
                    {/* Darken overlay for white keys out of range */}
                    {isOutOfRange && (
                        <div style={{
                            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', pointerEvents: 'none', zIndex: 1
                        }} />
                    )}

                    {hasRightBlack && (
                        <div
                            id={`pk128-${note + 1}`}
                            style={{
                                position: 'absolute',
                                zIndex: 10,
                                top: 0,
                                right: `-${BLACK_KEY_WIDTH / 2}px`, // Perfectly centered on the seam (half of actual width)
                                width: `${BLACK_KEY_WIDTH}px`,
                                height: `${BLACK_KEY_HEIGHT}px`,
                                backgroundColor: '#222',
                                borderBottom: '6px solid #050505',
                                borderLeft: '1px solid #050505',
                                borderRight: '1px solid #050505',
                                borderTop: 'none',
                                borderRadius: '0',
                                boxSizing: 'border-box'
                            }}
                        >
                            {/* Darken overlay for black keys out of range */}
                            {(note + 1 < minRange || note + 1 > maxRange) && (
                                <div style={{
                                    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', pointerEvents: 'none', zIndex: 12
                                }} />
                            )}
                        </div>
                    )}
                    {isC && (
                        <span style={{
                            fontSize: '8px', 
                            fontFamily: 'sans-serif',
                            color: '#333',
                            marginBottom: '5px',
                            pointerEvents: 'none',
                            userSelect: 'none',
                            zIndex: 2
                        }}>
                            C{octave}
                        </span>
                    )}
                </div>
            );
        }
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
                style={{
                    display: 'flex',
                    width: `${1275 * 0.75}px`, // 75 white keys scaled by 0.75
                    height: `${WHITE_KEY_HEIGHT}px`,
                    backgroundColor: '#fff',
                    borderTop: '2px solid #222',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    position: 'relative'
                }}
            >
                {pianoKeys}
            </div>
        </div>
    );
};

export const updateKeyVisuals128 = (note: number, color: string) => {
    const el = document.getElementById(`pk128-${note}`);
    if (!el) return;

    const isBlack = [1, 3, 6, 8, 10].includes(note % 12);

    if (color) {
        el.style.backgroundColor = color;
        if (color.startsWith('rgba')) {
            el.style.boxShadow = `inset 0 -4px 8px rgba(0,0,0,0.35)`; 
        } else {
            el.style.boxShadow = `inset 0 -4px 8px rgba(0,0,0,0.25), 0 0 10px ${color}`;
        }
        if (isBlack) el.style.zIndex = '11';
    } else {
        el.style.backgroundColor = isBlack ? '#222' : '#fff';
        el.style.boxShadow = '';
        if (isBlack) el.style.zIndex = '10';
    }
};

// --- Main Export: MidiNoteRangeFilter ---
export interface MidiNoteRangeFilterProps {
  activeMode: FilterMode;
  onModeChange: (mode: FilterMode) => void;
  range: [number, number];
  onRangeChange: (range: [number, number]) => void;
}

export function MidiNoteRangeFilter({
  activeMode,
  onModeChange,
  range,
  onRangeChange,
}: MidiNoteRangeFilterProps) {
  const [hoveredMode, setHoveredMode] = useState<FilterMode | null>(null);

  return (
    <div className="w-full max-w-[1050px] mt-6 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 p-4 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <label className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">Processing Mode</label>
        <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          {(['block', 'octave_wrap', 'wrap', 'limit'] as FilterMode[]).map((mode) => (
            <div key={mode} className="relative flex items-center justify-center">
              <button
                onClick={() => onModeChange(mode)}
                onMouseEnter={() => setHoveredMode(mode)}
                onMouseLeave={() => setHoveredMode(null)}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  activeMode === mode 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                }`}
              >
                {mode === 'block' ? 'Block' :
                 mode === 'octave_wrap' ? 'Octave Wrap' :
                 mode === 'wrap' ? 'Wrap' : 'Limit'}
              </button>
              {hoveredMode === mode && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded shadow-lg border border-neutral-700 w-48 text-center pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  {MODE_DESCRIPTIONS[mode]}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-x-auto w-full max-w-full thin-scrollbar">
        <div className="w-fit mx-auto flex flex-col items-center pt-4 pb-4 px-4 gap-0">
          <RangeSlider 
            min={0} 
            max={127} 
            value={range} 
            onValueChange={onRangeChange} 
          />
          <Piano128 minRange={range[0]} maxRange={range[1]} />
        </div>
      </div>
    </div>
  );
}
