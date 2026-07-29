import React, { useState, useEffect, useRef } from 'react';
import { useMidi } from '../midi/MIDIProvider';
import { SMuFL, assignXLevels, calculateWriteModePitch, transposeDiatonically, AccidentalOverride } from '../utils/notationMath';
import { getChordSymbol } from '../utils/chordSpeller';
import { audioEngine } from '../audio/engine';
import * as Tone from 'tone';
import { Copy, Trash2, Keyboard, Maximize2, Minimize2 } from 'lucide-react';

const MINI_STAFF = 5;

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};


// Mathematically identical port of the NotationCanvas layout engine, scaled for the mini-staff
export const computeMiniLayout = (rawNotes: any[], miniStaff: number) => {
  const ottavaLabels: any[] = [];
  const trebleNotes = rawNotes.filter(n => n.isTreble);
  const bassNotes = rawNotes.filter(n => !n.isTreble);

  let trebleShift = 0;
  let trebleLabel: { glyph: string; suffix: string } | null = null;
  if (trebleNotes.length > 0) {
    const maxTrebleStep = Math.max(...trebleNotes.map(n => n.stepOffset));
    const minTrebleStep = Math.min(...trebleNotes.map(n => n.stepOffset));
    if (maxTrebleStep >= 25 && minTrebleStep - 14 >= -2) {
      trebleShift = -14; trebleLabel = { glyph: SMuFL.quindicesima, suffix: 'ma' };
    } else if (maxTrebleStep >= 18 && minTrebleStep - 7 >= -2) {
      trebleShift = -7; trebleLabel = { glyph: SMuFL.ottava, suffix: 'va' };
    }
  }

  let bassShift = 0;
  let bassLabel: { glyph: string; suffix: string } | null = null;
  if (bassNotes.length > 0) {
    const minBassStep = Math.min(...bassNotes.map(n => n.stepOffset));
    const maxBassStep = Math.max(...bassNotes.map(n => n.stepOffset));
    if (minBassStep <= -22 && maxBassStep + 14 <= 2) {
      bassShift = 14; bassLabel = { glyph: SMuFL.quindicesima, suffix: 'mb' };
    } else if (minBassStep <= -15 && maxBassStep + 7 <= 2) {
      bassShift = 7; bassLabel = { glyph: SMuFL.ottava, suffix: 'vb' };
    }
  }

  const NOTE_OFFSET_X_PX = miniStaff * 1.2;
  const PADDING_PX = 2; 
  const ACC_WIDTH_PX = miniStaff * 1.2;

  const processGroup = (groupRaw: any[], shift: number, isTreble: boolean) => {
    const groupNotes = groupRaw.map(n => {
      const finalStep = n.stepOffset + shift;
      const y = (finalStep * (miniStaff / 2)) + miniStaff - (!isTreble ? (2 * miniStaff) : 0);
      return {
        ...n,
        ySteps: finalStep,
        finalStep,
        y
      };
    });

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
          let iter = 0;
          while (!placed && iter < 50) {
            iter++;
            if (!rightColumns[col]) rightColumns[col] = [];
            
            // Bug Trap & Sanitization
            let safeStep = note.finalStep;
            if (!Number.isFinite(safeStep)) {
              console.warn("BUG TRAP: Invalid finalStep detected in rightColumns layout", note);
              safeStep = 0; // Fallback to prevent math failure
            }
            
            if (!rightColumns[col].some(existingStep => Math.abs(existingStep - safeStep) <= 3)) {
              rightColumns[col].push(safeStep);
              placed = true;
            } else { col++; }
          }
          if (iter >= 50) console.error("CIRCUIT BREAKER TRIPPED: rightColumns layout loop exceeded 50 iterations.");
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
        let iter = 0;
        while (!placed && iter < 50) {
          iter++;
          if (!columns[col]) columns[col] = [];
          
          // Bug Trap & Sanitization
          let safeStep = note.finalStep;
          if (!Number.isFinite(safeStep)) {
            console.warn("BUG TRAP: Invalid finalStep detected in columns layout", note);
            safeStep = 0; // Fallback to prevent math failure
          }
          
          if (!columns[col].some(existingStep => Math.abs(existingStep - safeStep) <= 3)) {
            columns[col].push(safeStep);
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
        if (iter >= 50) console.error("CIRCUIT BREAKER TRIPPED: columns layout loop exceeded 50 iterations.");
      });
    };

    processAccColumns(assigned.filter(n => !n.isRightColumn && (!!n.accidental || n.forceAccidentalDisplay)), 0);
    if (rightNotes.length > 0) {
      processAccColumns(assigned.filter(n => n.isRightColumn && (!!n.accidental || n.forceAccidentalDisplay)), rightBaseX);
    }

    if (isTreble && trebleLabel && assigned.length > 0) {
      const highest = assigned.reduce((prev, curr) => (curr.finalStep > prev.finalStep) ? curr : prev);
      ottavaLabels.push({ data: trebleLabel, y: highest.y, type: 'treble', offset: -miniStaff * 2.8 });
    }
    if (!isTreble && bassLabel && assigned.length > 0) {
      const lowest = assigned.reduce((prev, curr) => (curr.finalStep < prev.finalStep) ? curr : prev);
      ottavaLabels.push({ data: bassLabel, y: lowest.y, type: 'bass', offset: miniStaff * 0.8 });
    }

    return assigned;
  };

  const processedNotes = [...processGroup(trebleNotes, trebleShift, true), ...processGroup(bassNotes, bassShift, false)];
  const result: any = processedNotes;
  result.notes = processedNotes;
  result.trebleShift = trebleShift;
  result.bassShift = bassShift;
  result.trebleLabel = trebleLabel;
  result.bassLabel = bassLabel;
  result.ottavaLabels = ottavaLabels;

  return result;
};

export const snapTimelineGhostNote = (
  clientY: number,
  rectOrEl: DOMRect | HTMLElement | any,
  currentStaffSpace: number,
  keySignature: string,
  accidental: AccidentalOverride,
  lut?: any[]
) => {
  const rect = typeof rectOrEl?.getBoundingClientRect === 'function' ? rectOrEl.getBoundingClientRect() : rectOrEl;
  const pointerY = clientY - (rect.top || 0);
  const staffHeight = rect.height || 280;

  if (pointerY < 0 || pointerY > staffHeight) {
    const ghost = document.getElementById('timeline-ghost-note');
    if (ghost) ghost.classList.add('hidden');
    return { isOutOfBounds: true, stepOffset: 0, snappedY: 0, midiNote: 60, calculatedAcc: null };
  }

  const canvasCenterY = staffHeight / 2;
  const relativeY = canvasCenterY - pointerY;
  let stepOffset = 0;

  if (relativeY >= 0) {
    stepOffset = Math.round((relativeY - currentStaffSpace) / (currentStaffSpace / 2));
  } else {
    stepOffset = Math.round((relativeY + currentStaffSpace) / (currentStaffSpace / 2));
  }

  const snappedY = canvasCenterY - (((stepOffset) * (currentStaffSpace / 2)) + (relativeY >= 0 ? currentStaffSpace : -currentStaffSpace));

  const ghost = document.getElementById('timeline-ghost-note');
  if (ghost) {
    ghost.classList.remove('hidden');
    ghost.style.top = `${snappedY}px`;
    (ghost as any).dataset.step = stepOffset.toString();
    
    const { midiNote, accidental: calcAcc } = calculateWriteModePitch(stepOffset, keySignature, accidental, lut || []);
    (ghost as any).dataset.midiNote = midiNote.toString();
    (ghost as any).dataset.accidental = calcAcc === null ? 'null' : calcAcc;
    
    const accElement = document.getElementById('timeline-ghost-accidental');
    if (accElement) accElement.textContent = calcAcc || '';
  }

  const { midiNote, accidental: calculatedAcc } = calculateWriteModePitch(stepOffset, keySignature, accidental, lut || []);
  return { isOutOfBounds: false, stepOffset, snappedY, midiNote, calculatedAcc };
};

export interface StepSequencerProps {
  initialIsExpanded?: boolean;
}

export const StepSequencer: React.FC<StepSequencerProps> = ({ initialIsExpanded = false }) => {
  const { keySignature, lut, updateActiveNotes, uiVelocity, sequence, setSequence, mapSequenceToKeys, isListeningForMap, setIsListeningForMap, sequenceKeyswitches, setSequenceKeyswitches, selectedNotes, isWriteMode = false, setIsWriteMode = () => {}, accidentalOverride = null, setAccidentalOverride = () => {} } = useMidi() as any;
  const [isExpanded, setIsExpanded] = useState(initialIsExpanded);
  const miniStaff = isExpanded ? 12 : 5;
  const braceLeftPx = isExpanded ? 24 : 12;
  const lineStartPx = isExpanded ? 24 : 12;
  const clefLeftPx = isExpanded ? 34 : 18;
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  useEffect(() => {
    if (!sequenceKeyswitches || Object.keys(sequenceKeyswitches).length === 0) return;

    let hasChanges = false;
    const updatedSwitches = { ...sequenceKeyswitches };

    Object.entries(updatedSwitches).forEach(([midiNote, stepIndex]) => {
      const idx = typeof stepIndex === 'number' ? stepIndex : parseInt(stepIndex as string, 10);
      if (!sequence[idx] || !sequence[idx].notes || sequence[idx].notes.length === 0) {
        delete updatedSwitches[parseInt(midiNote, 10)];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setSequenceKeyswitches(updatedSwitches);
    }
  }, [sequence, sequenceKeyswitches, setSequenceKeyswitches]);

  const [draggingSource, setDraggingSource] = useState<number | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);
  const [dragCoords, setDragCoords] = useState<{ x: number, y: number } | null>(null);
  const [isOptionPressed, setIsOptionPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsOptionPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsOptionPressed(false);
      }
    };
    const handleBlur = () => {
      setIsOptionPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);


  const isRecordingRef = useRef(isRecording);
  const stepRef = useRef(currentStep);
  const activeKeys = useRef(0);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const seqCanvasRef = useRef<HTMLDivElement>(null);
  const dragTracker = useRef({ isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0, startStep: -1 });
  const lastSeenChord = useRef<any[]>([]);
  const selectedStepRef = useRef<number | null>(null);
  const sequenceRef = useRef(sequence);
  const uiVelocityRef = useRef(uiVelocity);
  const activePreviews = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activeChordNotesRef = useRef<string[]>([]);

  const playPreviewNotes = (noteStrings: string[], interrupt: boolean = true, velocity: number = uiVelocityRef.current) => {
    if (interrupt) {
      activePreviews.current.forEach((timeoutId, noteStr) => {
        clearTimeout(timeoutId);
        try { audioEngine.releaseNote(noteStr); } catch(err) {}
      });
      activePreviews.current.clear();
      try { audioEngine.releaseAll(); } catch(err) {}
    }

    const normalizedVelocity = velocity / 127;

    noteStrings.forEach(noteStr => {
      try { Tone.context.resume(); } catch(err) {}
      try { audioEngine.noteOn(noteStr, normalizedVelocity); } catch(err) {}
      const timeoutId = setTimeout(() => {
        try { audioEngine.releaseNote(noteStr); } catch(err) {}
        activePreviews.current.delete(noteStr);
      }, 500);
      activePreviews.current.set(noteStr, timeoutId);
    });
  };

  const selectedNotesRef = useRef(selectedNotes);
  const isExpandedRef = useRef(isExpanded);
  const isWriteModeRef = useRef(isWriteMode);
  const accidentalOverrideRef = useRef(accidentalOverride);
  const keySignatureRef = useRef(keySignature);
  const lutRef = useRef(lut);

  const seqUndoStack = useRef<any[][]>([]);
  const seqRedoStack = useRef<any[][]>([]);

  const commitSeqState = () => {
    seqUndoStack.current.push(JSON.parse(JSON.stringify(sequenceRef.current)));
    seqRedoStack.current = [];
    if (seqUndoStack.current.length > 50) seqUndoStack.current.shift();
  };

  const undoSeq = () => {
    if (seqUndoStack.current.length === 0) return;
    const prev = seqUndoStack.current.pop()!;
    seqRedoStack.current.push(JSON.parse(JSON.stringify(sequenceRef.current)));
    setSequence(prev);

    const activeIdx = selectedStepRef.current;
    if (activeIdx !== null && prev[activeIdx]) {
      updateActiveNotes(prev[activeIdx].notes || [], true, false, []);
    }
  };

  const redoSeq = () => {
    if (seqRedoStack.current.length === 0) return;
    const next = seqRedoStack.current.pop()!;
    seqUndoStack.current.push(JSON.parse(JSON.stringify(sequenceRef.current)));
    setSequence(next);

    const activeIdx = selectedStepRef.current;
    if (activeIdx !== null && next[activeIdx]) {
      updateActiveNotes(next[activeIdx].notes || [], true, false, []);
    }
  };

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { stepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { selectedStepRef.current = selectedStep; }, [selectedStep]);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
  useEffect(() => { uiVelocityRef.current = uiVelocity; }, [uiVelocity]);
  useEffect(() => { selectedNotesRef.current = selectedNotes; }, [selectedNotes]);

  useEffect(() => {
    const handleBeforeTransform = () => {
      if (selectedStepRef.current !== null) {
        commitSeqState();
      }
    };
    window.addEventListener('APP_TRANSFORM', handleBeforeTransform);
    return () => window.removeEventListener('APP_TRANSFORM', handleBeforeTransform);
  }, []);
  useEffect(() => { isExpandedRef.current = isExpanded; }, [isExpanded]);
  useEffect(() => { isWriteModeRef.current = isWriteMode; }, [isWriteMode]);
  useEffect(() => { accidentalOverrideRef.current = accidentalOverride; }, [accidentalOverride]);
  useEffect(() => { keySignatureRef.current = keySignature; }, [keySignature]);
  useEffect(() => { lutRef.current = lut; }, [lut]);

  useEffect(() => {
    const handleKeyCapture = (e: KeyboardEvent) => {
      if (!isExpandedRef.current && selectedStepRef.current === null) return;
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const keyLower = e.key.toLowerCase();
      if (isCmdOrCtrl && !e.shiftKey && keyLower === 'z') {
        e.stopImmediatePropagation();
        e.preventDefault();
        undoSeq();
      } else if (isCmdOrCtrl && ((e.shiftKey && keyLower === 'z') || keyLower === 'y')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        redoSeq();
      }
    };

    const handleHistory = (e: any) => {
      const rawAction = e.detail?.action || e.detail?.type || '';
      const action = String(rawAction).toUpperCase();
      if (selectedStepRef.current !== null || isExpandedRef.current) {
        if (action === 'UNDO') undoSeq();
        if (action === 'REDO') redoSeq();
      }
    };

    window.addEventListener('keydown', handleKeyCapture, { capture: true });
    window.addEventListener('APP_HISTORY', handleHistory);
    return () => {
      window.removeEventListener('keydown', handleKeyCapture, { capture: true });
      window.removeEventListener('APP_HISTORY', handleHistory);
    };
  }, []);

  const handleVoicePreservingNavigation = (direction: 'left' | 'right') => {
    const currentStepIdx = selectedStepRef.current ?? 0;
    let targetStepIdx = currentStepIdx + (direction === 'right' ? 1 : -1);
    if (targetStepIdx < 0) targetStepIdx = 0;
    if (targetStepIdx > 11) targetStepIdx = 11;

    const currentBar = sequenceRef.current[currentStepIdx];
    const targetBar = sequenceRef.current[targetStepIdx];
    if (!targetBar) return;

    // 1. Sort current bar notes descending by pitch
    const currentSorted = [...(currentBar?.notes || [])].sort((a, b) => {
      const pitchA = typeof a === 'object' ? a.note : a;
      const pitchB = typeof b === 'object' ? b.note : b;
      return pitchB - pitchA;
    });

    // 2. Identify active voice indices
    const activeVoiceIndices = currentSorted
      .map((n, idx) => {
        const pitch = typeof n === 'object' ? n.note : n;
        return selectedNotesRef.current?.includes(pitch) ? idx : -1;
      })
      .filter(idx => idx !== -1);

    // 3. Map voice indices onto target bar
    const targetSorted = [...(targetBar.notes || [])].sort((a, b) => {
      const pitchA = typeof a === 'object' ? a.note : a;
      const pitchB = typeof b === 'object' ? b.note : b;
      return pitchB - pitchA;
    });

    let newSelectedPitches: number[] = [];

    if (activeVoiceIndices.length > 0 && activeVoiceIndices.length < currentSorted.length) {
      // Preserve voice indices (guarded by target pitch count)
      newSelectedPitches = activeVoiceIndices
        .map(idx => {
          const item = targetSorted[idx];
          return typeof item === 'object' ? item?.note : item;
        })
        .filter((pitch): pitch is number => typeof pitch === 'number' && !isNaN(pitch));
    } else {
      // If entire chord was selected (or no selection), select full target chord
      newSelectedPitches = targetSorted
        .map(n => typeof n === 'object' ? n.note : n)
        .filter((pitch): pitch is number => typeof pitch === 'number' && !isNaN(pitch));
    }

    setSelectedStep(targetStepIdx);
    selectedStepRef.current = targetStepIdx;

    updateActiveNotes(targetBar.notes, true, false, newSelectedPitches);

    if (newSelectedPitches.length > 0) {
      const noteStrs = newSelectedPitches.map(p => Tone.Frequency(p, "midi").toNote());
      playPreviewNotes(noteStrs);
    }
  };

  useEffect(() => {
    const activeIndex = selectedStep !== null ? selectedStep : currentStep;
    const activeElement = document.getElementById(`seq-bar-${activeIndex}`);
    if (activeElement && typeof activeElement.scrollIntoView === 'function') {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [currentStep, selectedStep]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRecording(false);
        setIsWriteMode(false);
        const ghost = document.getElementById('timeline-ghost-note');
        if (ghost) ghost.classList.add('hidden');
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); 
        handleVoicePreservingNavigation(e.key === 'ArrowRight' ? 'right' : 'left');
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
        const currentNotes = notes;
        const pitches = currentNotes.map((n: any) => typeof n === 'object' ? n.note : n);
        const symbol = pitches.length > 0 ? getChordSymbol(pitches, keySignature, lut) : '';

        if (isRecordingRef.current && currentNotes.length > 0) {
          // Real-time preview: Draw immediately on NoteOn
          setSequence((prev: any[]) => {
            const next = [...prev];
            next[stepRef.current] = { notes: [...currentNotes], symbol };
            return next;
          });
        } else if (selectedStepRef.current !== null && !isRecordingRef.current) {
          // Existing bi-directional sync for selected step
          setSequence((prev: any[]) => {
            const next = [...prev];
            next[selectedStepRef.current!] = { notes: [...currentNotes], symbol };
            return next;
          });
        }
      }

      if (data && data instanceof Uint8Array && data.length >= 3) {
        const [status, note, vel] = data;
        const isNoteOn = (status & 0xF0) === 0x90 && vel > 0;
        const isNoteOff = (status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && vel === 0);

        if (isNoteOn) activeKeys.current++;
        if (isNoteOff) activeKeys.current = Math.max(0, activeKeys.current - 1);

        if (isNoteOff && activeKeys.current === 0 && isRecordingRef.current) {
          // Check if the real-time sync actually recorded anything before advancing
          const stepHasNotes = sequenceRef.current[stepRef.current]?.notes?.length > 0;
          if (stepHasNotes) {
            setCurrentStep(s => {
              if (s >= 11) {
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!isExpanded) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('[data-seq-note]') || 
      target.closest('[data-chord-pill]')
    ) return;

    if (isWriteModeRef.current) {
      const clickX = e.clientX;
      const clickY = e.clientY;
      const elem = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(clickX, clickY) : null;
      const stepEl = elem?.closest('[data-step-index]');
      if (stepEl) {
        const staffCanvasEl = (stepEl.querySelector('.staff-canvas-area') as HTMLElement) || (stepEl as HTMLElement);
        const { isOutOfBounds, stepOffset: quantizedStepOffset, midiNote, calculatedAcc: accidental } = snapTimelineGhostNote(
          clickY,
          staffCanvasEl,
          miniStaff,
          keySignatureRef.current,
          accidentalOverrideRef.current,
          lutRef.current
        );
        if (isOutOfBounds) return;
        commitSeqState();
        const stepIdx = parseInt(stepEl.getAttribute('data-step-index') || '0', 10);
        const isTreble = quantizedStepOffset >= -2;
        const newNoteObj = {
          id: generateId(),
          note: midiNote,
          stepOffset: quantizedStepOffset,
          isTreble,
          accidental,
          forceAccidentalDisplay: !!accidental
        };

        const existingBar = sequenceRef.current[stepIdx] || { notes: [], symbol: '' };
        const updatedNotes = [...(existingBar.notes || []), newNoteObj];
        const updatedPitches = updatedNotes.map((n: any) => typeof n === 'object' ? n.note : n);
        const symbol = getChordSymbol(updatedPitches, keySignatureRef.current, lutRef.current);

        setSelectedStep(stepIdx);
        selectedStepRef.current = stepIdx;

        setSequence((prev: any[]) => {
          const next = [...prev];
          next[stepIdx] = { notes: updatedNotes, symbol };
          return next;
        });

        updateActiveNotes(updatedNotes, true, false, [midiNote]);
        playPreviewNotes([Tone.Frequency(midiNote, "midi").toNote()]);
      }
      return;
    }

    const rect = seqCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX;
    const clickY = e.clientY;
    const elem = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(clickX, clickY) : null;
    const stepEl = elem?.closest('[data-step-index]');
    let startStep = -1;
    if (stepEl) {
      startStep = parseInt(stepEl.getAttribute('data-step-index') || '', 10);
    }
    
    if (startStep === -1) return;

    setSelectedStep(startStep);
    selectedStepRef.current = startStep;

    const hasModifier = e.shiftKey || e.metaKey || e.ctrlKey || e.altKey;
    if (!hasModifier && sequenceRef.current[startStep]) {
      updateActiveNotes(sequenceRef.current[startStep].notes || [], true, false, []);
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    
    const x = clickX - rect.left + seqCanvasRef.current!.scrollLeft;
    const y = clickY - rect.top;

    dragTracker.current = {
      isDragging: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      startStep
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isExpanded) return;
    if (!dragTracker.current.isDragging || !seqCanvasRef.current || !marqueeRef.current) return;
    
    const rect = seqCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + seqCanvasRef.current.scrollLeft;
    const y = e.clientY - rect.top;

    dragTracker.current.currentX = x;
    dragTracker.current.currentY = y;

    const { startX, startY } = dragTracker.current;
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(startX - x);
    const height = Math.abs(startY - y);

    marqueeRef.current.style.left = `${left}px`;
    marqueeRef.current.style.top = `${top}px`;
    marqueeRef.current.style.width = `${width}px`;
    marqueeRef.current.style.height = `${height}px`;
    marqueeRef.current.classList.remove('hidden');
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isExpanded || !dragTracker.current.isDragging) return;
    dragTracker.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (marqueeRef.current) {
      const marqueeRect = marqueeRef.current.getBoundingClientRect();
      marqueeRef.current.classList.add('hidden');
      const startStep = dragTracker.current.startStep;
      
      if (startStep !== -1 && sequence[startStep]) {
        const notesInStep = document.querySelectorAll(`div[data-seq-step="${startStep}"]`);
        const intersectingPitches: number[] = [];
        
        notesInStep.forEach(el => {
          const elRect = el.getBoundingClientRect();
          const intersects = !(
            elRect.right < marqueeRect.left ||
            elRect.left > marqueeRect.right ||
            elRect.bottom < marqueeRect.top ||
            elRect.top > marqueeRect.bottom
          );
          if (intersects) {
            const pitch = parseInt(el.getAttribute('data-seq-note') || '', 10);
            if (!isNaN(pitch)) {
              intersectingPitches.push(pitch);
            }
          }
        });
        
        if (intersectingPitches.length > 0) {
          updateActiveNotes(sequence[startStep].notes, true, false, intersectingPitches);
        }
      }
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (dragTracker.current.isDragging) {
      handlePointerUp(e);
    }
  };

  return (
    <div className="w-full max-w-[962px] bg-white dark:bg-[#111] p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 flex flex-col gap-2 select-none relative">
      <div className="flex items-center gap-4 w-full">
        {/* Control Buttons (Clear & Record) */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {/* Clear All Button */}
          <button
            onClick={() => {
              setSequence(Array(12).fill({ notes: [], symbol: '' }));
              setSequenceKeyswitches({});
              setSelectedStep(null);
              selectedStepRef.current = null;
              updateActiveNotes([], true);
              try { audioEngine.releaseAll(); } catch(err){}
              setIsRecording(false);
              setCurrentStep(0);
            }}
            title="Clear all steps"
            className="w-12 h-7 rounded border border-gray-200 dark:border-gray-800 hover:border-red-500 hover:text-red-500 text-gray-400 dark:text-gray-500 flex items-center justify-center transition-colors bg-white dark:bg-[#111] cursor-pointer hover:bg-red-500/5"
          >
            <Trash2 size={14} />
          </button>

          {/* Record Button */}
          <button 
            onClick={() => {
              const nextIsRecording = !isRecording;
              setIsRecording(nextIsRecording);
              if (nextIsRecording) {
                // Start from selected step, or 0 if none selected
                setCurrentStep(selectedStep !== null ? selectedStep : 0);
                setSelectedStep(null); // Clear selection visually to avoid UX confusion
              } else {
                setSelectedStep(null);
              }
            }}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isRecording ? 'border-red-500 bg-red-500/10' : 'border-gray-300 hover:border-gray-400 bg-transparent'}`}
          >
            <div className={`w-4 h-4 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
          </button>

          {/* Map to Keys Button */}
          <button
            draggable={true}
            onDragStart={(e) => {
              if (e.altKey) {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'SEQUENCE_MAP_DRAG' }));
              }
            }}
            onClick={() => {
              setIsListeningForMap(!isListeningForMap);
            }}
            title="Map to Keys (Or Option+Drag to virtual keyboard)"
            className={`w-12 h-7 rounded border flex items-center justify-center transition-all cursor-pointer ${
              isListeningForMap
                ? 'border-[#aa3bff] text-[#aa3bff] bg-[#aa3bff]/10 animate-pulse'
                : 'border-gray-200 dark:border-gray-800 hover:border-[#aa3bff] hover:text-[#aa3bff] text-gray-400 dark:text-gray-500 bg-white dark:bg-[#111] hover:bg-[#aa3bff]/5'
            }`}
          >
            <Keyboard size={14} />
          </button>
        </div>

        {/* Sequencer Grid */}
        <div className={`flex-1 flex border border-black/10 dark:border-white/10 rounded ${isExpanded ? 'h-[320px]' : 'h-[140px]'} relative overflow-hidden bg-white dark:bg-[#0a0a0a] transition-all duration-300`}>
          {/* Top-Left Expand Toggle Button */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            title={isExpanded ? "Collapse Timeline" : "Expand Timeline"}
            className="absolute top-2 left-2 z-30 p-1.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#111]/90 hover:border-[#aa3bff] hover:text-[#aa3bff] text-gray-400 dark:text-gray-500 transition-colors shadow-sm cursor-pointer"
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {isListeningForMap && (
            <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center text-center p-4">
              <span className="text-white text-xs font-semibold max-w-[80%] mb-2 leading-relaxed">
                Press any key on your MIDI controller or virtual keyboard to assign the starting note for your sequence.
              </span>
              <button
                onClick={() => setIsListeningForMap(false)}
                className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
          
          {/* Clef & Brace Column */}
          <div className={`${isExpanded ? 'w-[75px]' : 'w-[45px]'} h-full flex flex-col relative flex-shrink-0 bg-white dark:bg-[#0a0a0a] z-20 shadow-[4px_0_8px_rgba(0,0,0,0.05)] border-r border-black/30 dark:border-gray-600/50 transition-all duration-300`}>
              
              {/* Top Spacer to align with chord pills */}
              <div className="h-10 border-b border-black/10 dark:border-white/5 bg-gray-50/50 dark:bg-[#1a1a1a]/50" />

              <div className="flex-1 relative w-full h-full">
                  {/* System Left Edge (Barline & Brace) */}
                  <div className="absolute w-[1.5px] bg-black dark:bg-gray-600" style={{ left: `${braceLeftPx}px`, top: `calc(50% - ${miniStaff * 6}px)`, height: `${miniStaff * 12}px` }}>
                      <div className="absolute right-[calc(100%+1px)] font-['Bravura'] text-black dark:text-gray-300 leading-none" style={{ top: `${miniStaff * 6}px`, fontSize: `${miniStaff * 12}px`, lineHeight: '1' }}>{'\uE000'}</div>
                  </div>
                  
                  {/* Staff Lines */}
                  <div className="absolute opacity-60" style={{ left: `${lineStartPx}px`, right: 0, top: `calc(50% - ${miniStaff * 6}px)` }}>
                      {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute" style={{ top: `${i * miniStaff}px` }} />)}
                  </div>
                  
                  {/* Bass Lines */}
                  <div className="absolute opacity-60" style={{ left: `${lineStartPx}px`, right: 0, top: `calc(50% + ${miniStaff * 2}px)` }}>
                      {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute" style={{ top: `${i * miniStaff}px` }} />)}
                  </div>
                  
                  {/* Clefs */}
                  <div className="absolute text-black dark:text-gray-300 leading-none" style={{ left: `${clefLeftPx}px`, top: `calc(50% - ${miniStaff * 5}px)`, fontSize: `${miniStaff * 4}px`, fontFamily: 'Bravura' }}>{'\uE050'}</div>
                  <div className="absolute text-black dark:text-gray-300 leading-none" style={{ left: `${clefLeftPx}px`, top: `calc(50% + ${miniStaff * 1}px)`, fontSize: `${miniStaff * 4}px`, fontFamily: 'Bravura' }}>{'\uE062'}</div>
              </div>
          </div>

          {/* 12 Bars Sequence Scroll Container */}
          <div 
            ref={seqCanvasRef} 
            className="flex-1 flex overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 relative"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onDoubleClick={() => {
              if (isExpanded) setIsWriteMode(prev => !prev);
            }}
          >
            <div ref={marqueeRef} className="absolute border border-blue-500 bg-blue-500/20 z-50 pointer-events-none hidden" style={{ left: 0, top: 0, width: 0, height: 0 }} />
            <div id="timeline-ghost-note" className="absolute hidden pointer-events-none opacity-60 z-50 transition-none" style={{ left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div id="timeline-ghost-accidental" className="absolute" style={{ left: `calc(-1.5 * ${miniStaff}px)`, top: '50%', transform: 'translateY(-50%)', fontFamily: "'Bravura', sans-serif", fontSize: `${miniStaff * 3}px`, color: '#aa3bff' }}></div>
              <div id="timeline-ghost-notehead" style={{ fontFamily: "'Bravura', sans-serif", fontSize: `${miniStaff * 4.2}px`, color: '#aa3bff' }}>{SMuFL.noteheadBlack}</div>
            </div>
            {(sequence as any[]).map((bar: any, idx: number) => {
              const renderedNotes = computeMiniLayout(bar.notes, miniStaff);
              
              return (
              <div key={idx} id={`seq-bar-${idx}`} data-step-index={idx} className="flex-1 flex flex-col relative border-r border-black/30 dark:border-gray-600/50 last:border-0 min-w-[100px] flex-shrink-0">
              
              {/* Chord Symbol Pill (Top) */}
              <div 
                data-chord-pill="true"
                onPointerDown={(e) => {
                  const hasNotes = bar.notes && bar.notes.length > 0;
                  if (e.altKey && hasNotes) {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDraggingSource(idx);
                    setDragCoords({ x: e.clientX, y: e.clientY });
                    return;
                  }

                  // Normal selection click
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSelectedStep(idx);
                  selectedStepRef.current = idx;
                  
                  // Sync selection array upstream to main workspace
                  updateActiveNotes(bar.notes, true, true);
                  
                  if (bar.notes.length > 0) {
                    try { Tone.context.resume(); } catch(err){}
                    try { audioEngine.releaseAll(); } catch(err){}
                    const noteStrs = bar.notes.map((n: any) => Tone.Frequency(typeof n === 'object' ? n.note : n, "midi").toNote());
                    activeChordNotesRef.current = noteStrs;
                    noteStrs.forEach((noteStr: string) => {
                      try { audioEngine.noteOn(noteStr, uiVelocity / 127); } catch(err){}
                    });
                  }
                }}
                onPointerMove={(e) => {
                  if (draggingSource !== null) {
                    setDragCoords({ x: e.clientX, y: e.clientY });
                    const elem = document.elementFromPoint(e.clientX, e.clientY);
                    const targetPill = elem?.closest('[data-step-index]');
                    if (targetPill) {
                      const targetIdx = parseInt(targetPill.getAttribute('data-step-index') || '', 10);
                      if (!isNaN(targetIdx) && targetIdx !== draggingSource) {
                        setDragOverStep(targetIdx);
                      } else {
                        setDragOverStep(null);
                      }
                    } else {
                      setDragOverStep(null);
                    }
                  }
                }}
                onPointerUp={(e) => {
                  if (draggingSource !== null) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    if (dragOverStep !== null) {
                      const sourceNotes = sequence[draggingSource].notes;
                      const copiedNotes = sourceNotes.map((n: any) => {
                        if (typeof n === 'object' && n !== null) {
                          return { ...n, id: generateId() };
                        }
                        return n; // If it's a raw number, leave it alone.
                      });
                      const symbol = sequence[draggingSource].symbol;

                      setSequence((prev: any[]) => {
                        const next = [...prev];
                        next[dragOverStep] = { notes: copiedNotes, symbol };
                        if (selectedStep === dragOverStep) {
                          updateActiveNotes(copiedNotes, true, true);
                        }
                        return next;
                      });

                      // Trigger short play preview on successful drop
                      if (copiedNotes.length > 0) {
                        const copiedStrs = copiedNotes.map((n: any) => Tone.Frequency(typeof n === 'object' ? n.note : n, "midi").toNote());
                        playPreviewNotes(copiedStrs);
                      }
                    }
                    setDraggingSource(null);
                    setDragOverStep(null);
                    setDragCoords(null);
                    return;
                  }

                  // Normal release
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
                  if (activeChordNotesRef.current.length > 0) {
                    activeChordNotesRef.current.forEach((noteStr: string) => {
                      try { audioEngine.releaseNote(noteStr); } catch(err){}
                    });
                    activeChordNotesRef.current = [];
                  }
                }}
                onPointerCancel={(e) => {
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
                  if (activeChordNotesRef.current.length > 0) {
                    activeChordNotesRef.current.forEach((noteStr: string) => {
                      try { audioEngine.releaseNote(noteStr); } catch(err){}
                    });
                    activeChordNotesRef.current = [];
                  }
                  if (draggingSource !== null) {
                    setDraggingSource(null);
                    setDragOverStep(null);
                    setDragCoords(null);
                  }
                }}
                onPointerLeave={() => {
                  if (activeChordNotesRef.current.length > 0) {
                    activeChordNotesRef.current.forEach((noteStr: string) => {
                      try { audioEngine.releaseNote(noteStr); } catch(err){}
                    });
                    activeChordNotesRef.current = [];
                  }
                  if (draggingSource !== null) return;
                }}
                className="h-10 flex items-center justify-center relative bg-gray-50/50 dark:bg-[#1a1a1a]/50 border-b border-black/10 dark:border-white/5 z-20 select-none group"
                style={{
                  cursor: (isOptionPressed && bar.notes.length > 0) ? 'copy' : draggingSource !== null ? 'grabbing' : 'pointer'
                }}
              >
                {(() => {
                  const isDragging = draggingSource !== null;
                  const isSource = draggingSource === idx;
                  const isTargetHovered = dragOverStep === idx;

                  let pillClasses = "shadow-sm rounded-full px-3 py-1 border min-w-[40px] flex justify-center items-center gap-1.5 transition-all ";

                  if (isSource) {
                    pillClasses += "bg-[#aa3bff]/20 border-dashed border-[#aa3bff] text-[#aa3bff] opacity-50 scale-95";
                  } else if (isTargetHovered) {
                    pillClasses += "bg-[#aa3bff]/20 border-double border-2 border-[#aa3bff] text-[#aa3bff] scale-105 shadow-md animate-pulse";
                  } else if (isDragging) {
                    pillClasses += "bg-white dark:bg-[#111] border-dashed border-gray-400 dark:border-gray-600 text-gray-400 hover:border-[#aa3bff] hover:text-[#aa3bff]";
                  } else if (selectedStep === idx) {
                    pillClasses += "bg-[#aa3bff]/10 border-[#aa3bff] text-[#aa3bff]";
                  } else if (isOptionPressed && bar.notes.length > 0) {
                    pillClasses += "bg-blue-500/10 border-blue-500 text-blue-500 hover:bg-blue-500/20";
                  } else {
                    pillClasses += "bg-white dark:bg-[#111] border-gray-200 dark:border-gray-800 group-hover:border-blue-400 text-blue-500";
                  }

                  return (
                    <div className={pillClasses}>
                      {isOptionPressed && bar.notes.length > 0 && !isSource && !isDragging && (
                        <Copy size={10} className="text-blue-500" />
                      )}
                      <span className="text-[10px] font-black whitespace-nowrap" style={{ fontFamily: "'Jost', sans-serif" }}>
                        {bar.symbol || '-'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Playhead Indicator */}
              {isRecording && currentStep === idx && (
                <div className="absolute inset-0 bg-red-500/10 border-l-2 border-r-2 border-red-500/50 z-10 pointer-events-none" />
              )}

              {/* Mini Grand Staff System */}
              <div 
                data-staff-area={idx}
                className="flex-1 relative w-full h-full staff-canvas-area cursor-default"
                onPointerMove={(e) => {
                  if (!isWriteMode || !isExpanded) return;
                  const ghost = document.getElementById('timeline-ghost-note');
                  if (ghost && ghost.parentElement !== e.currentTarget) {
                    e.currentTarget.appendChild(ghost);
                  }
                  snapTimelineGhostNote(
                    e.clientY,
                    e.currentTarget,
                    miniStaff,
                    keySignatureRef.current,
                    accidentalOverrideRef.current,
                    lutRef.current
                  );
                }}
                onPointerLeave={() => {
                  const ghost = document.getElementById('timeline-ghost-note');
                  if (ghost) ghost.classList.add('hidden');
                }}
                onPointerDown={(e) => {
                  if (!isWriteMode || !isExpanded) return;
                  e.preventDefault();
                  e.stopPropagation();

                  commitSeqState();

                  const ghost = document.getElementById('timeline-ghost-note');
                  let step = parseInt((ghost as any)?.dataset.step || '0', 10);
                  let targetMidiNote = parseInt((ghost as any)?.dataset.midiNote || '60', 10);
                  let targetAccidental = (ghost as any)?.dataset.accidental === 'null' ? null : (ghost as any)?.dataset.accidental;

                  if (isNaN(targetMidiNote) || !ghost || ghost.classList.contains('hidden')) {
                    const snap = snapTimelineGhostNote(
                      e.clientY,
                      e.currentTarget,
                      miniStaff,
                      keySignatureRef.current,
                      accidentalOverrideRef.current,
                      lutRef.current
                    );
                    step = snap.stepOffset;
                    targetMidiNote = snap.midiNote;
                    targetAccidental = snap.calculatedAcc;
                  }

                  const isTreble = step >= -2;
                  const newNoteObj = {
                    id: generateId(),
                    note: targetMidiNote,
                    stepOffset: step,
                    isTreble,
                    accidental: targetAccidental,
                    forceAccidentalDisplay: !!targetAccidental
                  };

                  const existingBar = sequenceRef.current[idx] || { notes: [], symbol: '' };
                  const updatedNotes = [...(existingBar.notes || []), newNoteObj];
                  const updatedPitches = updatedNotes.map((n: any) => typeof n === 'object' ? n.note : n);
                  const symbol = getChordSymbol(updatedPitches, keySignatureRef.current, lutRef.current);

                  setSelectedStep(idx);
                  selectedStepRef.current = idx;

                  setSequence((prev: any[]) => {
                    const next = [...prev];
                    next[idx] = { notes: updatedNotes, symbol };
                    return next;
                  });

                  updateActiveNotes(updatedNotes, true, false, [targetMidiNote]);
                  playPreviewNotes([Tone.Frequency(targetMidiNote, "midi").toNote()]);
                }}
              >
                <span className="absolute top-1 left-2 text-[10px] font-bold text-black/30 dark:text-white/30 z-10 select-none">
                  {idx + 1}
                </span>
                
                {/* Treble Lines */}
                <div className="absolute w-full" style={{ top: `calc(50% - ${miniStaff * 6}px)` }}>
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute opacity-60" style={{ top: `${i * miniStaff}px` }} />)}
                </div>
                
                {/* Bass Lines */}
                <div className="absolute w-full" style={{ top: `calc(50% + ${miniStaff * 2}px)` }}>
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-black dark:border-gray-600 absolute opacity-60" style={{ top: `${i * miniStaff}px` }} />)}
                </div>

                {/* Ottava Labels */}
                {renderedNotes.ottavaLabels && renderedNotes.ottavaLabels.map((label: any, lIdx: number) => (
                  <div 
                    key={`ottava-label-${lIdx}`}
                    className="ottava-label absolute pointer-events-none whitespace-nowrap left-1/2 -translate-x-1/2 flex items-baseline justify-center z-30"
                    style={{
                      top: `calc(50% - ${label.y}px + ${label.offset}px)`,
                    }}
                  >
                    <span 
                      className="text-black dark:text-gray-300"
                      style={{ 
                        fontFamily: "'Bravura', sans-serif", 
                        fontSize: `${miniStaff * 3}px`,
                        lineHeight: 1
                      }}
                    >
                      {label.data.glyph}
                    </span>
                    <span 
                      className="font-serif italic text-black dark:text-gray-300 font-bold"
                      style={{ 
                        fontSize: `${miniStaff * 1.5}px`,
                        marginLeft: '2px'
                      }}
                    >
                      {label.data.suffix}
                    </span>
                  </div>
                ))}

                {/* Notes */}
                {renderedNotes.map((n, i) => {
                  const isStepSelected = selectedStep === idx;
                  const isNoteSelected = isStepSelected && selectedNotes?.includes(n.note);

                  const textCol = isNoteSelected ? 'text-[#aa3bff]' : 'text-black dark:text-gray-300';
                  const bgCol = isNoteSelected ? 'bg-[#aa3bff]' : 'bg-black dark:bg-gray-400';
                  const textShadow = isNoteSelected ? 'drop-shadow(0 0 4px rgba(170, 59, 255, 0.4))' : 'none';

                  return (
                    <div 
                      key={i} 
                      className="absolute z-10 pointer-events-none" 
                      style={{ 
                        left: n.xOffset !== undefined ? `calc(50% + ${n.xOffset}px)` : '50%', 
                        top: `calc(50% - ${n.y}px)`, 
                        transform: 'translate(-50%, -50%)' 
                      }}
                    >
                      <span 
                        className={`transition-colors ${textCol}`} 
                        style={{ fontFamily: 'Bravura', fontSize: `${miniStaff * 4.2}px`, filter: textShadow }}
                      >
                        {SMuFL.noteheadWhole}
                      </span>
                      {(n.accidental || n.forceAccidentalDisplay) && (
                        <span className={`absolute transition-colors ${textCol}`} style={{ 
                          left: n.accidentalLeft || `calc(-1.5 * ${miniStaff}px)`, 
                          top: '50%', 
                          transform: 'translateY(-50%)', 
                          fontFamily: 'Bravura', 
                          fontSize: `${miniStaff * 3}px`,
                          filter: textShadow
                        }}>
                          {n.accidental || SMuFL.accidentalNatural}
                        </span>
                      )}

                      {/* Ledger Lines */}
                      {(() => {
                        const lines = [];
                        const renderLedgerLine = (lineStep: number) => {
                           const yOffset = (n.finalStep - lineStep) * (miniStaff / 2);
                           return (
                             <div 
                               key={`ledger-${n.note}-${lineStep}`}
                               className={`absolute left-1/2 -translate-x-1/2 ${isExpanded ? 'h-[1.5px]' : 'h-[1px]'} z-[-1] transition-colors ${bgCol}`}
                               style={{
                                 width: `${miniStaff * 2.5}px`,
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
                            for (let ls = 0; ls >= n.finalStep; ls += 2) lines.push(renderLedgerLine(ls));
                          } else if (n.finalStep <= -12) {
                            for (let ls = -12; ls >= n.finalStep; ls -= 2) lines.push(renderLedgerLine(ls));
                          }
                        }
                        return lines;
                      })()}

                      {/* ISOLATED HITBOX */}
                      <div 
                        data-seq-note={n.note}
                        data-seq-step={idx}
                        className={`absolute top-1/2 left-1/2 w-6 h-6 -translate-x-1/2 -translate-y-1/2 z-50 rounded-full ${isExpanded && !isWriteMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
                        onPointerDown={(e) => {
                          if (!isExpanded) return;
                          e.preventDefault();
                          e.stopPropagation(); // CRITICAL: Prevents the chord pill from stealing the click
                          
                          setSelectedStep(idx);
                          if (selectedStepRef) selectedStepRef.current = idx;
                          
                          let newSelection = [n.note];
                          if (e.metaKey || e.ctrlKey || e.shiftKey) {
                             const isSelected = selectedNotes?.includes(n.note);
                             newSelection = isSelected 
                                 ? (selectedNotes || []).filter(p => p !== n.note) 
                                 : [...(selectedNotes || []), n.note];
                          }
                          
                          updateActiveNotes(bar.notes, true, false, newSelection);
                          
                          const noteStr = Tone.Frequency(n.note, "midi").toNote();
                          playPreviewNotes([noteStr]);
                        }}
                      />
                    </div>
                  );
                })}
              </div>

            </div>
          )})}
          </div>
        </div>
      </div>


      {/* Ghost Drag Pill */}
      {draggingSource !== null && dragCoords && (
        <div 
          className="fixed pointer-events-none z-50 bg-[#aa3bff] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg border border-[#aa3bff]/30 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-90 transition-transform scale-105"
          style={{
            left: dragCoords.x,
            top: dragCoords.y,
            fontFamily: "'Jost', sans-serif"
          }}
        >
          <Copy size={10} className="text-white animate-pulse" />
          <span>{sequence[draggingSource].symbol || '-'}</span>
        </div>
      )}
    </div>
  );
};
