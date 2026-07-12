import React, { useState, useEffect, useRef } from 'react';
import { useMidi } from '../midi/MIDIProvider';
import { SMuFL, assignXLevels } from '../utils/notationMath';
import { getChordSymbol } from '../utils/chordSpeller';
import { audioEngine } from '../audio/engine';
import * as Tone from 'tone';

const MINI_STAFF = 5;

// Mathematically identical port of the NotationCanvas layout engine, scaled for the mini-staff
const computeMiniLayout = (rawNotes: any[], miniStaff: number) => {
  const trebleNotes = rawNotes.filter(n => n.isTreble);
  const bassNotes = rawNotes.filter(n => !n.isTreble);

  const NOTE_OFFSET_X_PX = miniStaff * 1.2;
  const PADDING_PX = 2; 
  const ACC_WIDTH_PX = miniStaff * 1.2;

  const processGroup = (groupRaw: any[], isTreble: boolean) => {
    const groupNotes = groupRaw.map(n => ({
      ...n,
      ySteps: n.stepOffset,
      finalStep: n.stepOffset,
      y: (n.stepOffset * (miniStaff / 2)) + miniStaff - (!isTreble ? (2 * miniStaff) : 0)
    }));

    const assigned = assignXLevels(groupNotes).map(n => ({...n}));
    const leftNotes = assigned.filter(n => !n.isRightColumn);
    const rightNotes = assigned.filter(n => n.isRightColumn);

    let rightBaseX = 0;
    if (rightNotes.length > 0) {
      let leftMaxX = 0;
      const leftLevelOffsets: Record<number, number> = { 0: 0 };
      leftNotes.sort((a, b) => (a.xLevel || 0) - (b.xLevel || 0));
      leftNotes.forEach(note => {
        const L = note.xLevel || 0;
        if (L === 0) note.xOffset = 0;
        else if (L === 1) {
          note.xOffset = NOTE_OFFSET_X_PX + PADDING_PX;
          leftLevelOffsets[1] = note.xOffset;
        } else {
          const prevOffset = leftLevelOffsets[L-1] || leftLevelOffsets[0];
          const hasAcc = !!note.accidental || note.forceAccidentalDisplay;
          const offset = prevOffset + NOTE_OFFSET_X_PX + PADDING_PX + (hasAcc ? ACC_WIDTH_PX : 0);
          note.xOffset = offset;
          leftLevelOffsets[L] = Math.max(leftLevelOffsets[L] || 0, offset);
        }
      });

      leftNotes.forEach(n => {
        const rightEdge = (n.xOffset || 0) + NOTE_OFFSET_X_PX;
        if (rightEdge > leftMaxX) leftMaxX = rightEdge;
      });

      let maxRightAccReachPx = 0;
      const rightAccNotesForReach = rightNotes.filter(n => !!n.accidental || n.forceAccidentalDisplay);
      if (rightAccNotesForReach.length > 0) {
        const sortedRightAcc = [...rightAccNotesForReach].sort((a, b) => b.finalStep - a.finalStep);
        const rightColumns: number[][] = [];
        sortedRightAcc.forEach(note => {
          let col = 0;
          let placed = false;
          while (!placed) {
            if (!rightColumns[col]) rightColumns[col] = [];
            if (!rightColumns[col].some(existingStep => Math.abs(existingStep - note.finalStep) <= 3)) {
              rightColumns[col].push(note.finalStep);
              placed = true;
            } else { col++; }
          }
        });
        maxRightAccReachPx = (1.5 + ((rightColumns.length - 1) * 1.2)) * miniStaff;
      }

      rightBaseX = leftMaxX + maxRightAccReachPx + (0.8 * miniStaff);

      const rightLevelOffsets: Record<number, number> = { 0: rightBaseX };
      rightNotes.sort((a, b) => (a.xLevel || 0) - (b.xLevel || 0));
      rightNotes.forEach(note => {
        const L = note.xLevel || 0;
        if (L === 0) note.xOffset = rightBaseX;
        else if (L === 1) {
          note.xOffset = rightBaseX + NOTE_OFFSET_X_PX + PADDING_PX;
          rightLevelOffsets[1] = note.xOffset;
        } else {
          const prevOffset = rightLevelOffsets[L-1] || rightLevelOffsets[0];
          const hasAcc = !!note.accidental || note.forceAccidentalDisplay;
          const offset = prevOffset + NOTE_OFFSET_X_PX + PADDING_PX + (hasAcc ? ACC_WIDTH_PX : 0);
          note.xOffset = offset;
          rightLevelOffsets[L] = Math.max(rightLevelOffsets[L] || 0, offset);
        }
      });
    } else {
      const levelOffsets: Record<number, number> = { 0: 0 };
      leftNotes.sort((a, b) => (a.xLevel || 0) - (b.xLevel || 0));
      leftNotes.forEach(note => {
        const L = note.xLevel || 0;
        if (L === 0) note.xOffset = 0;
        else if (L === 1) {
          note.xOffset = NOTE_OFFSET_X_PX + PADDING_PX;
          levelOffsets[1] = note.xOffset;
        } else {
          const prevOffset = levelOffsets[L-1] || levelOffsets[0];
          const hasAcc = !!note.accidental || note.forceAccidentalDisplay;
          const offset = prevOffset + NOTE_OFFSET_X_PX + PADDING_PX + (hasAcc ? ACC_WIDTH_PX : 0);
          note.xOffset = offset;
          levelOffsets[L] = Math.max(levelOffsets[L] || 0, offset);
        }
      });
    }

    const processAccColumns = (accNotes: any[], baseX: number) => {
      const sorted = accNotes.sort((a, b) => b.finalStep - a.finalStep);
      const columns: number[][] = [];
      sorted.forEach(note => {
        let col = 0;
        let placed = false;
        while (!placed) {
          if (!columns[col]) columns[col] = [];
          if (!columns[col].some(existingStep => Math.abs(existingStep - note.finalStep) <= 3)) {
            columns[col].push(note.finalStep);
            const offsetMultiplier = -1.5 - (col * 1.2);
            const compactionOffset = (baseX > 0) ? (0.15 * miniStaff) : 0;
            const currentCompaction = compactionOffset;
            const relativeShift = (note.xOffset || 0) - baseX;
            const leftStr = `${offsetMultiplier} * ${miniStaff}px`;
            const compactionStr = currentCompaction !== 0 ? ` + ${compactionOffset.toFixed(1)}px` : '';
            const shiftStr = relativeShift !== 0 ? ` - ${relativeShift}px` : '';
            note.accidentalLeft = (compactionStr || shiftStr) ? `calc(${leftStr}${compactionStr}${shiftStr})` : `calc(${leftStr})`;
            placed = true;
          } else { col++; }
        }
      });
    };

    processAccColumns(assigned.filter(n => !n.isRightColumn && (!!n.accidental || n.forceAccidentalDisplay)), 0);
    if (rightNotes.length > 0) {
      processAccColumns(assigned.filter(n => n.isRightColumn && (!!n.accidental || n.forceAccidentalDisplay)), rightBaseX);
    }

    return assigned;
  };

  return [...processGroup(trebleNotes, true), ...processGroup(bassNotes, false)];
};

export const StepSequencer: React.FC = () => {
  const { keySignature, lut, updateActiveNotes, uiVelocity } = useMidi() as any;
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [sequence, setSequence] = useState<Array<{notes: any[], symbol: string}>>(
    Array(8).fill({ notes: [], symbol: '' })
  );

  const isRecordingRef = useRef(isRecording);
  const stepRef = useRef(currentStep);
  const activeKeys = useRef(0);
  const lastSeenChord = useRef<any[]>([]);
  const selectedStepRef = useRef<number | null>(null);
  const sequenceRef = useRef(sequence);
  const uiVelocityRef = useRef(uiVelocity);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { stepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { selectedStepRef.current = selectedStep; }, [selectedStep]);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
  useEffect(() => { uiVelocityRef.current = uiVelocity; }, [uiVelocity]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsRecording(false);
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Block page scrolling defaults
        e.preventDefault(); 
        
        let nextStep = selectedStepRef.current === null ? 0 : selectedStepRef.current + (e.key === 'ArrowRight' ? 1 : -1);
        if (nextStep < 0) nextStep = 0;
        if (nextStep > 7) nextStep = 7;
        
        setSelectedStep(nextStep);
        selectedStepRef.current = nextStep;
        
        const targetBar = sequenceRef.current[nextStep];
        if (targetBar) {
          // Inject current notes array directly into core display provider context
          updateActiveNotes(targetBar.notes, true);
          
          if (targetBar.notes.length > 0) {
            try { Tone.context.resume(); } catch(err){}
            try { audioEngine.releaseAll(); } catch(err){}
            targetBar.notes.forEach((n: any) => {
              const noteStr = Tone.Frequency(n.note, "midi").toNote();
              try { audioEngine.noteOn(noteStr, uiVelocityRef.current / 127); } catch(err){}
              setTimeout(() => {
                try { audioEngine.releaseNote(noteStr); } catch(err){}
              }, 500);
            });
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const handleMidi = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { data, refresh, notes } = customEvent.detail || {};

      if (refresh && notes) {
        lastSeenChord.current = notes;

        // BI-DIRECTIONAL SYNC: Overwrite selected timeline slot in real-time
        if (selectedStepRef.current !== null) {
          const currentNotes = notes;
          const pitches = currentNotes.map((n: any) => typeof n === 'object' ? n.note : n);
          const symbol = pitches.length > 0 ? getChordSymbol(pitches, keySignature, lut) : '';

          setSequence(prev => {
            const next = [...prev];
            next[selectedStepRef.current!] = { notes: [...currentNotes], symbol };
            return next;
          });
        }
      }

      if (data && data instanceof Uint8Array && data.length >= 3) {
        const [status, , vel] = data;
        const isNoteOn = (status & 0xF0) === 0x90 && vel > 0;
        const isNoteOff = (status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && vel === 0);

        if (isNoteOn) activeKeys.current++;
        if (isNoteOff) activeKeys.current = Math.max(0, activeKeys.current - 1);

        if (isNoteOff && activeKeys.current === 0 && isRecordingRef.current) {
          const currentNotes = lastSeenChord.current;
          if (currentNotes.length > 0) {
            const pitches = currentNotes.map(n => typeof n === 'object' ? n.note : n);
            const symbol = getChordSymbol(pitches, keySignature, lut);
            
            setSequence(prev => {
              const next = [...prev];
              next[stepRef.current] = { notes: [...currentNotes], symbol };
              return next;
            });

            setCurrentStep(s => {
              if (s >= 7) {
                setIsRecording(false);
                return 0; 
              }
              return s + 1;
            });
          }
        }
      }
    };

    window.addEventListener('MIDI_MESSAGE_RECEIVED', handleMidi);
    return () => window.removeEventListener('MIDI_MESSAGE_RECEIVED', handleMidi);
  }, [keySignature, lut]);

  return (
    <div className="w-full max-w-[962px] bg-white dark:bg-[#111] p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 flex items-center gap-4 select-none">
      
      {/* Record Button */}
      <button 
        onClick={() => {
          setIsRecording(!isRecording);
          if (!isRecording) setSelectedStep(null); // Clear manual selection when entering record mode
        }}
        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isRecording ? 'border-red-500 bg-red-500/10' : 'border-gray-300 hover:border-gray-400 bg-transparent'}`}
      >
        <div className={`w-4 h-4 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
      </button>

      {/* Sequencer Grid */}
      <div className="flex-1 flex border border-black/10 dark:border-white/10 rounded h-[140px] relative overflow-hidden bg-white dark:bg-[#0a0a0a]">
        
        {/* Clef & Brace Column */}
        <div className="w-[45px] h-full flex flex-col relative flex-shrink-0 bg-white dark:bg-[#0a0a0a] border-r border-black/30 dark:border-gray-600/50">
            
            {/* Top Spacer to align with chord pills */}
            <div className="h-10 border-b border-black/10 dark:border-white/5 bg-gray-50/50 dark:bg-[#1a1a1a]/50" />

            <div className="flex-1 relative w-full h-full">
                {/* System Left Edge (Barline & Brace) */}
                <div className="absolute left-[12px] w-[1.5px] bg-black dark:bg-gray-600" style={{ top: `calc(50% - ${MINI_STAFF * 6}px)`, height: `${MINI_STAFF * 12}px` }}>
                    <div className="absolute right-[calc(100%+1px)] font-['Bravura'] text-black dark:text-gray-300 leading-none" style={{ top: `${MINI_STAFF * 6}px`, fontSize: `${MINI_STAFF * 12}px`, lineHeight: '1' }}>{'\uE000'}</div>
                </div>
                
                {/* Staff Lines */}
                <div className="absolute w-full" style={{ top: `calc(50% - ${MINI_STAFF * 6}px)` }}>
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute opacity-60" style={{ top: `${i * MINI_STAFF}px` }} />)}
                </div>
                <div className="absolute w-full" style={{ top: `calc(50% + ${MINI_STAFF * 2}px)` }}>
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute opacity-60" style={{ top: `${i * MINI_STAFF}px` }} />)}
                </div>
                
                {/* Clefs */}
                <div className="absolute left-[18px] text-black dark:text-gray-300 leading-none" style={{ top: `calc(50% - ${MINI_STAFF * 5}px)`, fontSize: `${MINI_STAFF * 4}px`, fontFamily: 'Bravura' }}>{'\uE050'}</div>
                <div className="absolute left-[18px] text-black dark:text-gray-300 leading-none" style={{ top: `calc(50% + ${MINI_STAFF * 1}px)`, fontSize: `${MINI_STAFF * 4}px`, fontFamily: 'Bravura' }}>{'\uE062'}</div>
            </div>
        </div>

        {/* 8 Bars Sequence */}
        {sequence.map((bar, idx) => {
          const renderedNotes = computeMiniLayout(bar.notes, MINI_STAFF);
          
          return (
          <div key={idx} className="flex-1 flex flex-col relative border-r border-black/30 dark:border-gray-600/50 last:border-0">
            
            {/* Chord Symbol Pill (Top) */}
            <div 
              onPointerDown={(e) => {
                e.preventDefault();
                setSelectedStep(idx);
                selectedStepRef.current = idx;
                
                // Sync selection array upstream to main workspace
                updateActiveNotes(bar.notes, true);
                
                if (bar.notes.length > 0) {
                  try { Tone.context.resume(); } catch(err){}
                  try { audioEngine.releaseAll(); } catch(err){}
                  bar.notes.forEach((n: any) => {
                    const noteStr = Tone.Frequency(n.note, "midi").toNote();
                    try { audioEngine.noteOn(noteStr, uiVelocity / 127); } catch(err){}
                  });
                }
              }}
              onPointerUp={() => {
                if (bar.notes.length > 0) {
                  bar.notes.forEach((n: any) => {
                    const noteStr = Tone.Frequency(n.note, "midi").toNote();
                    try { audioEngine.releaseNote(noteStr); } catch(err){}
                  });
                }
              }}
              onPointerLeave={() => {
                if (bar.notes.length > 0) {
                  bar.notes.forEach((n: any) => {
                    const noteStr = Tone.Frequency(n.note, "midi").toNote();
                    try { audioEngine.releaseNote(noteStr); } catch(err){}
                  });
                }
              }}
              className="h-10 flex items-center justify-center relative bg-gray-50/50 dark:bg-[#1a1a1a]/50 border-b border-black/10 dark:border-white/5 z-20 cursor-pointer group"
            >
              <div className={`shadow-sm rounded-full px-3 py-1 border min-w-[40px] flex justify-center transition-all ${selectedStep === idx ? 'bg-[#aa3bff]/10 border-[#aa3bff] text-[#aa3bff]' : 'bg-white dark:bg-[#111] border-gray-200 dark:border-gray-800 group-hover:border-blue-400'}`}>
                <span className={`text-[10px] font-black whitespace-nowrap ${selectedStep === idx ? 'text-[#aa3bff]' : 'text-blue-500'}`} style={{ fontFamily: "'Jost', sans-serif" }}>
                  {bar.symbol || '-'}
                </span>
              </div>
            </div>

            {/* Playhead Indicator */}
            {isRecording && currentStep === idx && (
              <div className="absolute inset-0 bg-red-500/10 border-l-2 border-r-2 border-red-500/50 z-10 pointer-events-none" />
            )}

            {/* Mini Grand Staff System */}
            <div className="flex-1 relative w-full h-full">
              
              {/* Treble Lines */}
              <div className="absolute w-full" style={{ top: `calc(50% - ${MINI_STAFF * 6}px)` }}>
                {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute opacity-60" style={{ top: `${i * MINI_STAFF}px` }} />)}
              </div>
              
              {/* Bass Lines */}
              <div className="absolute w-full" style={{ top: `calc(50% + ${MINI_STAFF * 2}px)` }}>
                {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute opacity-60" style={{ top: `${i * MINI_STAFF}px` }} />)}
              </div>

              {/* Notes or Rest */}
              {renderedNotes.length === 0 ? (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black dark:text-gray-300 opacity-60" style={{ fontFamily: 'Bravura', fontSize: `${MINI_STAFF * 4}px` }}>
                  {'\uE4E3'} {/* Whole Rest */}
                </div>
              ) : (
                renderedNotes.map((n, i) => {
                  const itemColor = selectedStep === idx ? '#aa3bff' : undefined;
                  return (
                    <div key={i} className="absolute z-10" style={{ 
                      left: n.xOffset !== undefined ? `calc(50% + ${n.xOffset}px)` : '50%', 
                      top: `calc(50% - ${n.y}px)`, 
                      transform: 'translate(-50%, -50%)' 
                    }}>
                      <span className="text-black dark:text-gray-300 transition-colors" style={{ fontFamily: 'Bravura', fontSize: `${MINI_STAFF * 4.2}px`, color: itemColor }}>{SMuFL.noteheadWhole}</span>
                      {(n.accidental || n.forceAccidentalDisplay) && (
                        <span className="absolute text-black dark:text-gray-300 transition-colors" style={{ 
                          left: n.accidentalLeft || `calc(-1.5 * ${MINI_STAFF}px)`, 
                          top: '50%', 
                          transform: 'translateY(-50%)', 
                          fontFamily: 'Bravura', 
                          fontSize: `${MINI_STAFF * 3}px`,
                          color: itemColor
                        }}>
                          {n.accidental || SMuFL.accidentalNatural}
                        </span>
                      )}

                      {/* Ledger Lines */}
                      {(() => {
                        const lines = [];
                        const renderLedgerLine = (lineStep: number) => {
                          const yOffset = (n.finalStep - lineStep) * (MINI_STAFF / 2);
                          return (
                            <div 
                              key={`ledger-${n.note}-${lineStep}`}
                              className="absolute left-1/2 -translate-x-1/2 h-[1px] bg-black dark:bg-gray-400 z-[-1]"
                              style={{
                                width: `${MINI_STAFF * 2.5}px`,
                                top: `calc(50% + ${yOffset}px)`
                              }}
                            />
                          );
                        };

                        if (n.isTreble) {
                          if (n.finalStep >= 12) {
                            for (let ls = 12; ls <= n.finalStep; ls += 2) lines.push(renderLedgerLine(ls));
                          } else if (n.finalStep <= 0) {
                            for (let ls = 0; ls >= n.finalStep; ls -= 2) lines.push(renderLedgerLine(ls));
                          }
                        } else {
                          if (n.finalStep >= 0) {
                            for (let ls = 0; ls <= n.finalStep; ls += 2) lines.push(renderLedgerLine(ls));
                          } else if (n.finalStep <= -12) {
                            for (let ls = -12; ls >= n.finalStep; ls -= 2) lines.push(renderLedgerLine(ls));
                          }
                        }
                        return lines;
                      })()}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )})}
      </div>
    </div>
  );
};
