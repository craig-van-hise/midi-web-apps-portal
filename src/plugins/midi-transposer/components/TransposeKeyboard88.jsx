import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useMidiStore } from '../store/useMidiStore';
import { Modal } from './ui/Modal';
import { Tooltip } from './ui/Tooltip';

export const NoteRects = {};
const whiteKeys = [];
const blackKeys = [];

let currentX = 0;
for (let n = 21; n <= 108; n++) {
  const relativeToC = n % 12;
  const isBlack = [false, true, false, true, false, false, true, false, true, false, true, false][relativeToC];
  
  if (isBlack) {
    NoteRects[n] = { note: n, x: currentX - 5.5, w: 11, isBlack: true };
    blackKeys.push(n);
  } else {
    NoteRects[n] = { note: n, x: currentX, w: 19, isBlack: false };
    whiteKeys.push(n);
    currentX += 19;
  }
}

const DEFAULT_ORIGIN = 60; // C4

export default function TransposeKeyboard88({ onTransposeChange } = {}) {
  const {
    transposeOrigin: originNote,
    setTransposeOrigin: setOriginNote,
    transposeTarget: targetNote,
    transposeTargets,
    setTransposeTargets,
    polyphonyMode,
    setPolyphonyMode,
    transposeSustainMode,
    setTransposeSustainMode,
  } = useMidiStore();

  const activeTargets = transposeTargets && transposeTargets.includes(targetNote)
    ? transposeTargets
    : [targetNote];
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    onTransposeChange?.(targetNote - originNote);
  }, [targetNote, originNote, onTransposeChange]);
  
  const wrapperRef = useRef(null);
  const [originX, setOriginX] = useState(() => {
    const r = NoteRects[DEFAULT_ORIGIN];
    return r ? r.x + (r.w / 2) : 0;
  });

  const getHandleX = (note) => {
    const targetEl = document.getElementById(`pktranspose-${note}`);
    if (targetEl && wrapperRef.current) {
        const targetRect = targetEl.getBoundingClientRect();
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        return targetRect.left - wrapperRect.left + (targetRect.width / 2);
    } else {
        const r = NoteRects[note];
        return r ? r.x + (r.w / 2) : 0;
    }
  };

  const updatePositions = () => {
    if (!wrapperRef.current) return;
    
    let originCenter = 0;
    const originEl = document.getElementById(`pktranspose-${originNote}`);
    if (originEl && wrapperRef.current) {
        const originRect = originEl.getBoundingClientRect();
        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        originCenter = originRect.left - wrapperRect.left + (originRect.width / 2);
        setOriginX(originCenter);
    } else {
        const r = NoteRects[originNote];
        originCenter = r ? r.x + (r.w / 2) : 0;
        setOriginX(originCenter);
    }
  };

  useEffect(() => {
    updatePositions();
    const timer = setTimeout(updatePositions, 50);
    return () => clearTimeout(timer);
  }, [originNote, targetNote, isCollapsed]);

  const getClosestNote = (localX) => {
    let best = 21;
    let minDiff = Infinity;
    for (let n = 21; n <= 108; n++) {
      const el = document.getElementById(`pktranspose-${n}`);
      let noteCenter = 0;
      if (el && wrapperRef.current) {
         const rect = el.getBoundingClientRect();
         const wRect = wrapperRef.current.getBoundingClientRect();
         noteCenter = rect.left - wRect.left + (rect.width / 2);
      } else {
         const r = NoteRects[n];
         noteCenter = r ? r.x + (r.w / 2) : 0;
      }
      
      const diff = Math.abs(noteCenter - localX);
      if (diff < minDiff) {
        minDiff = diff;
        best = n;
      }
    }
    return best;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingIndex === null || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const note = getClosestNote(localX);
      
      const newTargets = [...activeTargets];
      newTargets[draggingIndex] = note;
      setTransposeTargets(newTargets);
    };

    const handleMouseUp = () => {
      if (draggingIndex !== null) {
        setDraggingIndex(null);
      }
    };

    if (draggingIndex !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIndex, activeTargets]);

  const handleTrackMouseDown = (e) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const note = getClosestNote(localX);
    
    if (polyphonyMode === 'mono') {
      setTransposeTargets([note]);
      setDraggingIndex(0);
    } else {
      let closestIdx = 0;
      let minDiff = Infinity;
      activeTargets.forEach((t, idx) => {
        const diff = Math.abs(t - note);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      const newTargets = [...activeTargets];
      newTargets[closestIdx] = note;
      setTransposeTargets(newTargets);
      setDraggingIndex(closestIdx);
    }
  };

  const handleKeyClick = (e, note) => {
    if (e.shiftKey || e.altKey) {
      setOriginNote(note);
    } else {
      if (polyphonyMode === 'mono') {
        setTransposeTargets([note]);
      } else {
        if (activeTargets.includes(note)) {
          if (activeTargets.length > 1) {
            setTransposeTargets(activeTargets.filter(t => t !== note));
          }
        } else {
          setTransposeTargets([...activeTargets, note]);
        }
      }
    }
  };

  const primaryHandleX = getHandleX(targetNote);
  const trackFillStart = Math.min(originX, primaryHandleX);
  const trackFillWidth = Math.abs(primaryHandleX - originX);
  
  return (
    <div 
      className={`relative bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.15)] outline-none w-[1020px] flex flex-col focus:ring-4 ring-rose-100 select-none transition-all duration-300 ${isCollapsed ? 'h-[40px]' : 'pt-[36px] pb-[16px] px-[16px]'}`}
      tabIndex={0}
    >
      {/* Collapse Toggle */}
      <div 
        className="absolute top-[10px] left-[14px] flex items-center gap-1.5 cursor-pointer z-30 opacity-70 hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed(!isCollapsed);
        }}
        title="Toggle Keyboard"
      >
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
        )}
        <span className="font-semibold text-[14px] text-gray-700 select-none">Transpose</span>
      </div>

      {/* Transpose Settings Gear Icon */}
      <div 
        className="absolute top-[10px] right-[14px] flex items-center z-30 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
        title="Transpose Settings"
        onClick={(e) => {
          e.stopPropagation();
          setIsSettingsOpen(true);
        }}
      >
        <Settings 
          className="w-4 h-4 text-gray-700 pointer-events-none" 
          strokeWidth={2.5}
        />
      </div>

      <Modal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        title="Transpose Settings"
      >
        <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider font-sans">Polyphony Mode</span>
        <div className="flex gap-4 mb-1">
          <Tooltip content="Mono: Single note shifting">
            <label className="flex items-center gap-1.5 cursor-pointer text-[13px] font-sans">
              <input 
                type="radio" 
                name="polyphonyMode" 
                value="mono" 
                checked={polyphonyMode === 'mono'} 
                onChange={() => setPolyphonyMode('mono')}
                className="accent-rose-500 cursor-pointer"
              />
              <span className="font-semibold text-gray-800">Mono</span>
            </label>
          </Tooltip>
          <Tooltip content="Allows parallel chord transpositions. Enforces strict monophonic (last-note priority) playing in the Play zone.">
            <label className="flex items-center gap-1.5 cursor-pointer text-[13px] font-sans">
              <input 
                type="radio" 
                name="polyphonyMode" 
                value="poly" 
                checked={polyphonyMode === 'poly'} 
                onChange={() => setPolyphonyMode('poly')}
                className="accent-rose-500 cursor-pointer"
              />
              <span className="font-semibold text-gray-800">Poly</span>
            </label>
          </Tooltip>
        </div>

        <hr className="border-neutral-100 my-1" />

        <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider font-sans">Transpose Sustain Mode</span>
        <div className="flex flex-col gap-2">
          <Tooltip content="Notes finish playing on their original pitch.">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] hover:bg-neutral-50 p-1.5 rounded w-full font-sans">
              <input 
                type="radio" 
                name="holdMode" 
                value="sustain" 
                checked={transposeSustainMode === 'sustain'} 
                onChange={() => setTransposeSustainMode('sustain')}
                className="accent-rose-500 cursor-pointer"
              />
              <span className="font-semibold text-gray-800">Sustain Original</span>
            </label>
          </Tooltip>

          <Tooltip content="Held notes are instantly silenced.">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] hover:bg-neutral-50 p-1.5 rounded w-full font-sans">
              <input 
                type="radio" 
                name="holdMode" 
                value="cutoff" 
                checked={transposeSustainMode === 'cutoff'} 
                onChange={() => setTransposeSustainMode('cutoff')}
                className="accent-rose-500 cursor-pointer"
              />
              <span className="font-semibold text-gray-800">Immediate Cutoff</span>
            </label>
          </Tooltip>

          <Tooltip content="Held notes instantly shift to the new pitch.">
            <label className="flex items-center gap-2 cursor-pointer text-[13px] hover:bg-neutral-50 p-1.5 rounded w-full font-sans">
              <input 
                type="radio" 
                name="holdMode" 
                value="retrigger" 
                checked={transposeSustainMode === 'retrigger'} 
                onChange={() => setTransposeSustainMode('retrigger')}
                className="accent-rose-500 cursor-pointer"
              />
              <span className="font-semibold text-gray-800">Retrigger</span>
            </label>
          </Tooltip>
        </div>
      </Modal>

      {!isCollapsed && (
        <>
          {/* Upper Control Surface - Transpose Slider */}
          <div className="relative w-[988px] h-[32px] mb-1 flex items-center">
            {/* The Track Container */}
            <div 
               className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[8px] rounded-full bg-gray-200 cursor-pointer shadow-inner"
               onMouseDown={handleTrackMouseDown}
            >
              {/* Neutral Center Notch for Origin Note */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-[2px] h-[16px] bg-gray-400 z-10"
                style={{ left: originX - 1 }}
              />
              
              {/* Dynamic Fill */}
              <div 
                className="absolute top-0 bottom-0 bg-rose-500 rounded-full transition-all duration-75"
                style={{ 
                   left: trackFillStart, 
                   width: trackFillWidth 
                }}
              />
            </div>

            {/* The Pointer Handles */}
            {(() => {
              const activeTargets = transposeTargets && transposeTargets.includes(targetNote)
                ? transposeTargets
                : [targetNote];
              const sorted = [...activeTargets].sort((a, b) => a - b);
              const tiers = {};
              let prevX = -Infinity;
              let prevTier = 0;

              sorted.forEach((note) => {
                const x = getHandleX(note);
                let tier = 0;
                if (x - prevX < 42) {
                  tier = (prevTier + 1) % 2;
                } else {
                  tier = 0;
                }
                tiers[note] = tier;
                prevX = x;
                prevTier = tier;
              });

              return activeTargets.map((target, idx) => {
                const handleXValue = getHandleX(target);
                const tier = tiers[target] || 0;
                const handleTransposeVal = target - originNote;
                const displayLabelVal = handleTransposeVal > 0 ? `+${handleTransposeVal}` : `${handleTransposeVal}`;
                return (
                  <div 
                    key={target}
                    data-testid={`transpose-handle-${target}`}
                    className="absolute top-1/2 flex flex-col items-center justify-center cursor-ew-resize z-20 group transition-transform duration-75"
                    style={{ 
                      left: handleXValue - 20,
                      transform: `translateY(${tier === 0 ? '-100%' : '20%'})`
                    }}
                    onMouseDown={(e) => {
                       e.stopPropagation();
                       setDraggingIndex(idx);
                    }}
                  >
                    <div className="w-[40px] h-[26px] bg-white border-2 border-rose-500 rounded-md shadow-md flex items-center justify-center font-mono text-sm font-bold text-gray-800 z-10">
                      {displayLabelVal}
                    </div>
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-rose-500 -mt-[1px] z-0" />
                  </div>
                );
              });
            })()}
          </div>

          {/* Lower Surface - Physical Keyboard */}
          <div ref={wrapperRef} id="keyboard-wrapper" className="relative flex w-[988px] h-[88px] bg-white pointer-events-auto border-t border-[#7a7a7a]" style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
            {whiteKeys.map((n) => {
              const isActive = activeTargets.includes(n);
              const isOrigin = n === originNote;
              const isC = n % 12 === 0;
              const octave = Math.floor(n / 12) - 1;
              return (
                <div
                  key={n}
                  id={`pktranspose-${n}`}
                  className="relative transition-colors duration-75 flex items-end justify-center pb-[4px]"
                  style={{
                    width: '19px',
                    height: '88px',
                    flexShrink: 0,
                    backgroundColor: isActive ? '#f43f5e' : (isOrigin ? '#f3f4f6' : '#ffffff'),
                    borderLeft: '1px solid #7a7a7a',
                    borderRight: '1px solid #7a7a7a',
                    borderBottom: '1px solid #7a7a7a',
                    borderTop: 'none',
                    borderBottomLeftRadius: '4px',
                    borderBottomRightRadius: '4px',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    boxShadow: isActive ? 'inset 0 0 10px rgba(255,255,255,0.4), 0 0 8px rgba(244,63,94,0.6)' : 'none',
                  }}
                  onMouseDown={(e) => handleKeyClick(e, n)}
                >
                  {isC && (
                    <span 
                      style={{
                        color: '#111827',
                        fontWeight: '600',
                        fontSize: '10px',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    >
                      C{octave}
                    </span>
                  )}
                </div>
              );
            })}
            
            {blackKeys.map((n) => {
              const isActive = activeTargets.includes(n);
              const isOrigin = n === originNote;
              return (
                <div
                  key={n}
                  id={`pktranspose-${n}`}
                  className={`absolute z-10 transition-colors duration-75`}
                  style={{
                    left: `${NoteRects[n].x}px`,
                    top: '-1px',
                    width: '11px',
                    height: '56px',
                    backgroundColor: isActive ? '#f43f5e' : (isOrigin ? '#4b5563' : '#3a3a3a'),
                    borderBottom: '8px solid #050505',
                    borderLeft: '2px solid #050505',
                    borderRight: '2px solid #050505',
                    borderTop: 'none',
                    borderRadius: '0px',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    boxShadow: isActive ? 'inset 0 0 6px rgba(255,255,255,0.4), 0 0 10px rgba(244,63,94,0.8)' : 'none',
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleKeyClick(e, n);
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
