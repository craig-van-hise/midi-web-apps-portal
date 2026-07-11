import React, { useEffect, useRef, useState } from 'react';
import { SMuFL, assignXLevels, transposeDiatonically, calculateWriteModePitch, type AccidentalOverride, getNoteNameFromPosition, enforcePianoRange } from '../utils/notationMath';
import { useMidi } from '../midi/MIDIProvider';
import KeySignatureSelector from './KeySignatureSelector';
import { getChordSpelling, getSpellingData, getChordSymbol, KEY_SIG_MAP, PITCH_TO_PC, type ChordIdentity, transposeChordIdentity } from '../utils/chordSpeller';
import { audioEngine } from '../audio/engine';
import * as Tone from 'tone';

// Define the expected staff space from CSS variables
const STAFF_SPACE_CSS_VAR = '--staff-space';

interface ActiveNoteData {
  id: string;
  note: number;
  stepOffset: number;
  accidental: string | null;
  isTreble: boolean;
  sourceMidi?: number;
  spellingOverride?: string;
  spellingString?: string;
  [key: string]: any; // Preserve MIDI metadata (velocity, etc.)
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

const NotationCanvas: React.FC = () => {
  const [tick, setTick] = useState(0);
  const forceUpdate = () => setTick(t => t + 1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [staffSpace, setStaffSpace] = useState<number>(12); // Default value
  const activeNotes = useRef<ActiveNoteData[]>([]);
  const [chordSymbol, setChordSymbol] = useState<string>("");
  const chordIdentityRef = useRef<ChordIdentity>({
    isActive: false,
    baseName: "",
    rootPC: 0,
    spellingMap: {}
  });
  const { keySignature = 'C Major', splitPoint = 60, lut = [], updateActiveNotes, isToggleModeActive, isHoldModeActive, setSelectedNotes, listenMode = true, uiVelocity = 80, homeChord = [60], setHomeChord } = useMidi();
  const [localHoldMode, setLocalHoldMode] = useState<boolean>(false);
  const effectiveHoldModeRef = useRef<boolean>(false);
  effectiveHoldModeRef.current = isHoldModeActive !== undefined ? isHoldModeActive : localHoldMode;
  const keySignatureRef = useRef(keySignature);
  const splitPointRef = useRef(splitPoint);
  const lutRef = useRef(lut);
  const listenModeRef = useRef(listenMode);
  const uiVelocityRef = useRef(uiVelocity);
  const homeChordRef = useRef(homeChord);
  const setHomeChordRef = useRef(setHomeChord);

  useEffect(() => { listenModeRef.current = listenMode; }, [listenMode]);
  useEffect(() => { uiVelocityRef.current = uiVelocity; }, [uiVelocity]);
  useEffect(() => { homeChordRef.current = homeChord; }, [homeChord]);
  useEffect(() => { setHomeChordRef.current = setHomeChord; }, [setHomeChord]);
  
  // Data-binding state for rendering
  const [renderedNotes, setRenderedNotes] = useState<any[]>([]);
  const [ottavaLabels, setOttavaLabels] = useState<any[]>([]);
  
  // Hold Mode State Machine Variables
  const physicalKeysDown = useRef<Set<number>>(new Set());
  const isWaitingForNewChord = useRef<boolean>(false);
  const selectedNoteIds = useRef<Set<string>>(new Set());
  const lastSelectedNoteId = useRef<string | null>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const dragTracker = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  
  const undoStack = useRef<ActiveNoteData[][]>([]);
  const redoStack = useRef<ActiveNoteData[][]>([]);
  const isWriteMode = useRef<boolean>(false);
  const lastPointerY = useRef<number>(0);
  const activePreviews = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  const [accidentalOverride, setAccidentalOverride] = useState<AccidentalOverride>(null);
  const accidentalOverrideRef = useRef<AccidentalOverride>(null);

  useEffect(() => {
    accidentalOverrideRef.current = accidentalOverride;
  }, [accidentalOverride]);

  const handleFlatClick = () => setAccidentalOverride(prev => prev === 'b' ? 'bb' : prev === 'bb' ? null : 'b');
  const handleNaturalClick = () => setAccidentalOverride(prev => prev === 'n' ? null : 'n');
  const handleSharpClick = () => setAccidentalOverride(prev => prev === '#' ? 'x' : prev === 'x' ? null : '#');
  
  const commitState = () => {
    undoStack.current.push(activeNotes.current.map(n => ({ ...n })));
    redoStack.current = []; // Clear redo stack on new action
    if (undoStack.current.length > 50) undoStack.current.shift(); // Max 50 states
  };
  
  const playPreviewNotes = (noteStrings: string[], interrupt: boolean = true, velocity: number = 100) => {
    if (interrupt) {
        // Force note-offs for anything currently previewing
        activePreviews.current.forEach((timeoutId, noteStr) => {
            clearTimeout(timeoutId);
            try { audioEngine.releaseNote(noteStr); } catch(err) { console.error("[AudioEngine] releaseNote failed for pitch:", noteStr, err); }
        });
        activePreviews.current.clear();
    }

    const normalizedVelocity = velocity / 127;

    noteStrings.forEach(noteStr => {
        try { audioEngine.noteOn(noteStr, normalizedVelocity); } catch(err) { console.error("[AudioEngine] noteOn failed for pitch:", noteStr, err); }
        const timeoutId = setTimeout(() => {
            try { audioEngine.releaseNote(noteStr); } catch(err) { console.error("[AudioEngine] releaseNote failed for pitch:", noteStr, err); }
            activePreviews.current.delete(noteStr);
        }, 500);
        activePreviews.current.set(noteStr, timeoutId);
    });
  };

  
  // 1. Update staffSpace from CSS
  useEffect(() => {
    const updateStaffSpace = () => {
      if (canvasRef.current) {
        const computedStyle = getComputedStyle(document.documentElement);
        const spaceValue = computedStyle.getPropertyValue(STAFF_SPACE_CSS_VAR).trim();
        const parsedSpace = parseFloat(spaceValue) || 12;
        setStaffSpace(parsedSpace);
      }
    };
    updateStaffSpace();
  }, []);

  // 2. Logic functions defined in component body for access to latest state
  const snapGhostNote = (clientY: number, rect: DOMRect) => {
    const pointerY = clientY - rect.top;
    const canvasCenterY = rect.height / 2;
    const relativeY = canvasCenterY - pointerY;
    let stepOffset = 0;

    if (relativeY >= 0) {
        stepOffset = Math.round((relativeY - staffSpace) / (staffSpace / 2));
    } else {
        stepOffset = Math.round((relativeY + staffSpace) / (staffSpace / 2));
    }

    const snappedY = canvasCenterY - (((stepOffset) * (staffSpace / 2)) + (relativeY >= 0 ? staffSpace : -staffSpace));

    const ghost = document.getElementById('ghost-note');
    if (ghost) {
        ghost.classList.remove('hidden');
        ghost.style.top = `${snappedY}px`;
        (ghost as any).dataset.step = stepOffset.toString();
        
        const { midiNote, accidental } = calculateWriteModePitch(stepOffset, keySignatureRef.current, accidentalOverrideRef.current, lutRef.current);
        (ghost as any).dataset.midiNote = midiNote.toString();
        (ghost as any).dataset.accidental = accidental === null ? 'null' : accidental;
        
        const accElement = document.getElementById('ghost-accidental');
        if (accElement) accElement.textContent = accidental || '';
    }
  };

  // --- TRANSFORMATION HELPERS ---

  const applyChromaticShift = (delta: number, stepSize: number = 1, isUiClick: boolean = true) => {
    if (selectedNoteIds.current.size === 0) return;
    const shift = delta * stepSize;

    const originalPitches = activeNotes.current.map(n => n.note);
    const proposedPitches = activeNotes.current.map((noteData) => {
      const isSelected = selectedNoteIds.current.has(noteData.id);
      if (!isSelected) return noteData.note;
      return noteData.note + shift;
    });

    const safePitches = enforcePianoRange(proposedPitches, originalPitches);
    if (safePitches === originalPitches) {
      return; // Blocked entirely!
    }

    commitState();

    if (chordIdentityRef.current.isActive) {
        chordIdentityRef.current = transposeChordIdentity(chordIdentityRef.current, shift, keySignatureRef.current, lutRef.current);
    }

    const updatedNotes = activeNotes.current.map((noteData) => {
      const isSelected = selectedNoteIds.current.has(noteData.id);
      if (!isSelected) return noteData;
      const index = activeNotes.current.findIndex(n => n.id === noteData.id);
      return { ...noteData, note: safePitches[index], sourceMidi: safePitches[index], spellingOverride: undefined };
    });

    const uniqueNotes: typeof updatedNotes = [];
    const seenPitches = new Set<number>();
    updatedNotes.forEach(noteData => {
      if (!seenPitches.has(noteData.note)) {
        seenPitches.add(noteData.note);
        uniqueNotes.push(noteData);
      }
    });

    activeNotes.current = uniqueNotes;

    const newSelection = new Set<string>();
    uniqueNotes.forEach(noteData => {
      if (selectedNoteIds.current.has(noteData.id)) {
        newSelection.add(noteData.id);
      }
    });
    selectedNoteIds.current = newSelection;

    updateSpellings();
    updateActiveNotes?.([...activeNotes.current]);
    recalculateLayout();

    if (listenModeRef.current && isUiClick) {
      // Force note-offs for active previews to prevent smearing
      try { audioEngine.releaseAll(); } catch(e) {}
      
      // Play the newly mutated pitches directly
      const transposedStrings = Array.from(selectedNoteIds.current)
        .map(id => activeNotes.current.find(n => n.id === id)?.note)
        .filter((n): n is number => typeof n === 'number')
        .map(pitch => Tone.Frequency(pitch, "midi").toNote());

      transposedStrings.forEach(noteStr => {
          if (Tone.context.state === 'running') {
              try { audioEngine.noteOn(noteStr, uiVelocityRef.current / 127); } catch (e) { console.error(e); }
          }
      });
    }
    forceUpdate();
  };

  const applyDiatonicShift = (delta: number, stepSize: number = 1, isUiClick: boolean = true) => {
    chordIdentityRef.current.isActive = false;
    if (selectedNoteIds.current.size === 0) return;
    const keyName = keySignatureRef.current;

    const originalPitches = activeNotes.current.map(n => n.note);
    const proposedPitches = activeNotes.current.map((noteData) => {
      const isSelected = selectedNoteIds.current.has(noteData.id);
      if (!isSelected) return noteData.note;
      return transposeDiatonically(noteData.note, delta * stepSize, keyName, lutRef.current, noteData.spellingString);
    });

    const safePitches = enforcePianoRange(proposedPitches, originalPitches);
    if (safePitches === originalPitches) {
      return; // Blocked entirely!
    }

    commitState();

    const updatedNotes = activeNotes.current.map((noteData) => {
      const isSelected = selectedNoteIds.current.has(noteData.id);
      if (!isSelected) return noteData;
      const index = activeNotes.current.findIndex(n => n.id === noteData.id);
      return { ...noteData, note: safePitches[index], sourceMidi: safePitches[index], spellingOverride: undefined };
    });

    const uniqueNotes: typeof updatedNotes = [];
    const seenPitches = new Set<number>();
    updatedNotes.forEach(noteData => {
      if (!seenPitches.has(noteData.note)) {
        seenPitches.add(noteData.note);
        uniqueNotes.push(noteData);
      }
    });

    activeNotes.current = uniqueNotes;

    const newSelection = new Set<string>();
    uniqueNotes.forEach(noteData => {
      if (selectedNoteIds.current.has(noteData.id)) {
        newSelection.add(noteData.id);
      }
    });
    selectedNoteIds.current = newSelection;

    updateSpellings();
    updateActiveNotes?.([...activeNotes.current]);
    recalculateLayout();

    if (listenModeRef.current && isUiClick) {
      // Force note-offs for active previews to prevent smearing
      try { audioEngine.releaseAll(); } catch(e) {}
      
      // Play the newly mutated pitches directly
      const transposedStrings = Array.from(selectedNoteIds.current)
        .map(id => activeNotes.current.find(n => n.id === id)?.note)
        .filter((n): n is number => typeof n === 'number')
        .map(pitch => Tone.Frequency(pitch, "midi").toNote());

      transposedStrings.forEach(noteStr => {
          if (Tone.context.state === 'running') {
              try { audioEngine.noteOn(noteStr, uiVelocityRef.current / 127); } catch (e) { console.error(e); }
          }
      });
    }
    forceUpdate();
  };

  const applyPcsRotation = (delta: number, stepSize: number = 1, isUiClick: boolean = true) => {
    if (selectedNoteIds.current.size === 0) return;
    
    // Voicing-Aware PCS Rotation
    const selectedEntries = Array.from(selectedNoteIds.current).map(id => {
      const noteData = activeNotes.current.find(n => n.id === id);
      return { id, pitch: noteData ? noteData.note : 0 };
    }).filter(en => en.pitch !== 0).sort((a, b) => a.pitch - b.pitch);

    const pcs = Array.from(new Set(selectedEntries.map(se => se.pitch % 12))).sort((a,b)=>a-b);
    if (pcs.length === 0) return;

    const pcOverrides: Record<number, string> = {};
    activeNotes.current.forEach(n => {
        if (n.spellingOverride) pcOverrides[n.note % 12] = n.spellingOverride;
    });

    const totalDelta = delta * stepSize;

    const originalPitches = activeNotes.current.map(n => n.note);
    const proposedPitches = activeNotes.current.map((noteData) => {
      const isSelected = selectedNoteIds.current.has(noteData.id);
      if (!isSelected) return noteData.note;

      const note = noteData.note;
      const currentPC = note % 12;
      const currentPcsIndex = pcs.indexOf(currentPC);
      
      // Calculate rotation index with wrap-around
      const nextPcsIndex = (currentPcsIndex + totalDelta + (pcs.length * Math.abs(totalDelta))) % pcs.length;
      const targetPC = pcs[nextPcsIndex];
      
      let newNote = note;
      if (totalDelta > 0) {
        newNote++;
        while(newNote % 12 !== targetPC) { newNote++; }
      } else if (totalDelta < 0) {
        newNote--;
        while(newNote % 12 !== targetPC) { newNote--; }
      }
      return newNote;
    });

    const safePitches = enforcePianoRange(proposedPitches, originalPitches);
    if (safePitches === originalPitches) {
      return; // Blocked entirely!
    }

    commitState();

    const updatedNotes = activeNotes.current.map((noteData) => {
      const isSelected = selectedNoteIds.current.has(noteData.id);
      if (!isSelected) return noteData;
      const index = activeNotes.current.findIndex(n => n.id === noteData.id);
      const note = safePitches[index];
      const targetPC = note % 12;
      return { ...noteData, note, sourceMidi: note, spellingOverride: pcOverrides[targetPC] };
    });

    const uniqueNotes: typeof updatedNotes = [];
    const seenPitches = new Set<number>();
    updatedNotes.forEach(noteData => {
      if (!seenPitches.has(noteData.note)) {
        seenPitches.add(noteData.note);
        uniqueNotes.push(noteData);
      }
    });

    activeNotes.current = uniqueNotes;

    // Immediately activate Identity Lock on rotation
    chordIdentityRef.current.isActive = true;

    const newSelection = new Set<string>();
    uniqueNotes.forEach(noteData => {
      if (selectedNoteIds.current.has(noteData.id)) {
        newSelection.add(noteData.id);
      }
    });
    selectedNoteIds.current = newSelection;

    updateSpellings();
    updateActiveNotes?.([...activeNotes.current]);
    recalculateLayout();

    if (listenModeRef.current && isUiClick) {
      // Force note-offs for active previews to prevent smearing
      try { audioEngine.releaseAll(); } catch(e) {}
      
      // Play the newly mutated pitches directly
      const transposedStrings = Array.from(selectedNoteIds.current)
        .map(id => activeNotes.current.find(n => n.id === id)?.note)
        .filter((n): n is number => typeof n === 'number')
        .map(pitch => Tone.Frequency(pitch, "midi").toNote());

      transposedStrings.forEach(noteStr => {
          if (Tone.context.state === 'running') {
              try { audioEngine.noteOn(noteStr, uiVelocityRef.current / 127); } catch (e) { console.error(e); }
          }
      });
    }
    forceUpdate();
  };

  const undo = () => {
    if (undoStack.current.length > 0) {
      redoStack.current.push(activeNotes.current.map(n => ({ ...n })));
      activeNotes.current = undoStack.current.pop() || [];
      selectedNoteIds.current.clear();
      updateSpellings();
      updateActiveNotes?.([...activeNotes.current]);
      recalculateLayout();
    }
  };

  const redo = () => {
    if (redoStack.current.length > 0) {
      undoStack.current.push(activeNotes.current.map(n => ({ ...n })));
      activeNotes.current = redoStack.current.pop() || [];
      selectedNoteIds.current.clear();
      updateSpellings();
      updateActiveNotes?.([...activeNotes.current]);
      recalculateLayout();
    }
  };

  const applyHome = () => {
    const homePitches = homeChordRef.current && homeChordRef.current.length > 0 ? homeChordRef.current : [60];
    activeNotes.current = homePitches.map((pitch: number) => ({
      id: generateId(),
      note: pitch,
      stepOffset: 0,
      accidental: null,
      isTreble: pitch >= splitPointRef.current,
      sourceMidi: pitch,
    }));
    selectedNoteIds.current.clear();
    updateSpellings();
    updateActiveNotes?.([...activeNotes.current]);
    recalculateLayout();

    try { audioEngine.releaseAll(); } catch(e) {}
    homePitches.forEach((pitch: number) => {
      const noteStr = Tone.Frequency(pitch, "midi").toNote();
      try { audioEngine.noteOn(noteStr, uiVelocityRef.current / 127); } catch(e) { console.error(e); }
      setTimeout(() => {
        try { audioEngine.releaseNote(noteStr); } catch(e) {}
      }, 500);
    });
  };

  const recalculateLayout = () => {
    try {
      const noteDatas = activeNotes.current;
      if (noteDatas.length === 0) {
        setRenderedNotes([]);
        setOttavaLabels([]);
        return;
      }

      const trebleNotesRaw = noteDatas.filter(n => n.isTreble);
      const bassNotesRaw = noteDatas.filter(n => !n.isTreble);

      let trebleShift = 0;
      let trebleLabelText: string | null = null;
      if (trebleNotesRaw.length > 0) {
        const maxTrebleStep = Math.max(...trebleNotesRaw.map(n => n.stepOffset));
        if (maxTrebleStep >= 28) { trebleShift = -14; trebleLabelText = "15ma"; }
        else if (maxTrebleStep >= 21) { trebleShift = -7; trebleLabelText = "8va"; }
      }

      let bassShift = 0;
      let bassLabelText: string | null = null;
      if (bassNotesRaw.length > 0) {
        const minBassStep = Math.min(...bassNotesRaw.map(n => n.stepOffset));
        if (minBassStep <= -30) { bassShift = 14; bassLabelText = "15mb"; }
        else if (minBassStep <= -23) { bassShift = 7; bassLabelText = "8vb"; }
      }



      const labels: any[] = [];
      const allNotes: any[] = [];
      const NOTE_OFFSET_X_PX = staffSpace * 1.2;
      const PADDING_PX = 5;
      const ACC_WIDTH_PX = staffSpace * 1.2;

      const processGroup = (rawNotes: ActiveNoteData[], shift: number, isTreble: boolean) => {
        const groupNotes = rawNotes.map(n => ({
          ...n,
          finalStep: n.stepOffset + shift,
          y: ((n.stepOffset + shift) * (staffSpace / 2)) + staffSpace - (!isTreble ? (2 * staffSpace) : 0),
          ySteps: n.stepOffset + shift,
        }));

        const assignedRaw = assignXLevels(groupNotes);
        // Clone objects to ensure React detects mutations as state changes
        const assigned = assignedRaw.map(n => ({ ...n }));
        
        const leftNotes = assigned.filter(n => !n.isRightColumn);
        const rightNotes = assigned.filter(n => n.isRightColumn);

        let rightBaseX = 0;
        if (rightNotes.length > 0) {
          let leftMaxX = 0;
          // We need to calculate left offsets first to know leftMaxX
          const leftLevelOffsets: Record<number, number> = { 0: 0 };
          leftNotes.sort((a, b) => (a.xLevel || 0) - (b.xLevel || 0));
          leftNotes.forEach(note => {
            const L = note.xLevel || 0;
            if (L === 0) {
              note.xOffset = 0;
            } else if (L === 1) {
              note.xOffset = NOTE_OFFSET_X_PX + PADDING_PX;
              leftLevelOffsets[1] = note.xOffset;
            } else {
              const prevOffset = leftLevelOffsets[L-1] || leftLevelOffsets[0];
              const hasAccidental = !!note.accidental || note.forceAccidentalDisplay;
              const offset = prevOffset + NOTE_OFFSET_X_PX + PADDING_PX + (hasAccidental ? ACC_WIDTH_PX : 0);
              note.xOffset = offset;
              leftLevelOffsets[L] = Math.max(leftLevelOffsets[L] || 0, offset);
            }
          });

          leftNotes.forEach(n => {
            const rightEdge = (n.xOffset || 0) + NOTE_OFFSET_X_PX;
            if (rightEdge > leftMaxX) leftMaxX = rightEdge;
          });

          // Pre-calculate Right Stack Accidental Reach
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
            const maxCol = rightColumns.length - 1;
            // 1.5 base reach + 1.2 for every additional column
            maxRightAccReachPx = (1.5 + (maxCol * 1.2)) * staffSpace;
          }

          const padding = 0.8 * staffSpace;
          rightBaseX = leftMaxX + maxRightAccReachPx + padding;

          const rightLevelOffsets: Record<number, number> = { 0: rightBaseX };
          rightNotes.sort((a, b) => (a.xLevel || 0) - (b.xLevel || 0));
          rightNotes.forEach(note => {
            const L = note.xLevel || 0;
            if (L === 0) {
              note.xOffset = rightBaseX;
            } else if (L === 1) {
              note.xOffset = rightBaseX + NOTE_OFFSET_X_PX + PADDING_PX;
              rightLevelOffsets[1] = note.xOffset;
            } else {
              const prevOffset = rightLevelOffsets[L-1] || rightLevelOffsets[0];
              const hasAccidental = !!note.accidental || note.forceAccidentalDisplay;
              const offset = prevOffset + NOTE_OFFSET_X_PX + PADDING_PX + (hasAccidental ? ACC_WIDTH_PX : 0);
              note.xOffset = offset;
              rightLevelOffsets[L] = Math.max(rightLevelOffsets[L] || 0, offset);
            }
          });
        } else {
          // Standard single column processing
          const levelOffsets: Record<number, number> = { 0: 0 };
          leftNotes.sort((a, b) => (a.xLevel || 0) - (b.xLevel || 0));
          leftNotes.forEach(note => {
            const L = note.xLevel || 0;
            if (L === 0) {
              note.xOffset = 0;
            } else if (L === 1) {
              note.xOffset = NOTE_OFFSET_X_PX + PADDING_PX;
              levelOffsets[1] = note.xOffset;
            } else {
              const prevOffset = levelOffsets[L-1] || levelOffsets[0];
              const hasAccidental = !!note.accidental || note.forceAccidentalDisplay;
              const offset = prevOffset + NOTE_OFFSET_X_PX + PADDING_PX + (hasAccidental ? ACC_WIDTH_PX : 0);
              note.xOffset = offset;
              levelOffsets[L] = Math.max(levelOffsets[L] || 0, offset);
            }
          });
        }

        const notesWithAccidentals = assigned.filter(n => !!n.accidental || n.forceAccidentalDisplay);
        const ACC_BASE_OFFSET = -1.5;
        const ACC_COLUMN_WIDTH = 1.2;

        const processAccColumns = (accNotes: any[], baseX: number) => {
          const sorted = accNotes.sort((a, b) => b.finalStep - a.finalStep);
          const columns: number[][] = [];
          
          sorted.forEach(note => {
            let col = 0;
            let placed = false;
            while (!placed) {
              if (!columns[col]) columns[col] = [];
              const collision = columns[col].some(existingStep => Math.abs(existingStep - note.finalStep) <= 3);
              if (!collision) {
                columns[col].push(note.finalStep);
                const offsetMultiplier = ACC_BASE_OFFSET - (col * ACC_COLUMN_WIDTH);
                
                // Compaction: Bring accidentals slightly closer to noteheads
                const compactionOffset = 0.15 * staffSpace;
                const currentCompaction = (baseX > 0) ? compactionOffset : 0; // Apply to Right Stack
                
                // Calculate position relative to the note's xOffset, but anchored to the stack's baseX
                const relativeShift = (note.xOffset || 0) - baseX;
                const leftStr = `${offsetMultiplier} * var(${STAFF_SPACE_CSS_VAR})`;
                const compactionStr = currentCompaction !== 0 ? ` + ${currentCompaction.toFixed(1)}px` : '';
                const shiftStr = relativeShift !== 0 ? ` - ${relativeShift}px` : '';
                note.accidentalLeft = (compactionStr || shiftStr) ? `calc(${leftStr}${compactionStr}${shiftStr})` : `calc(${leftStr})`;
                placed = true;
              } else {
                col++;
              }
            }
          });
        };

        const leftAccNotes = notesWithAccidentals.filter(n => !n.isRightColumn);
        const rightAccNotes = notesWithAccidentals.filter(n => n.isRightColumn);

        processAccColumns(leftAccNotes, 0);
        if (rightNotes.length > 0) {
          // Use the EXACT same rightBaseX calculated above
          processAccColumns(rightAccNotes, rightBaseX);
        }

        assigned.forEach(n => {
          if (!allNotes.some(existing => existing.id === n.id)) {
            allNotes.push(n);
          }
        });
        if (isTreble && trebleLabelText && assigned.length > 0) {
          const highest = assigned.reduce((prev, curr) => (curr.finalStep > prev.finalStep) ? curr : prev);
          labels.push({ text: trebleLabelText, y: highest.y, type: 'treble', offset: -staffSpace * 2.8 });
        }
        if (!isTreble && bassLabelText && assigned.length > 0) {
          const lowest = assigned.reduce((prev, curr) => (curr.finalStep < prev.finalStep) ? curr : prev);
          labels.push({ text: bassLabelText, y: lowest.y, type: 'bass', offset: staffSpace * 0.8 });
        }
      };

      processGroup(trebleNotesRaw, trebleShift, true);
      processGroup(bassNotesRaw, bassShift, false);
      setRenderedNotes([...allNotes]);
      setOttavaLabels([...labels]);
    } catch (e) {
      // Layout error fallback
    }
  };

  const updateSpellings = () => {
    try {
      activeNotes.current.sort((a, b) => a.note - b.note);
      const pitches = activeNotes.current.map(n => n.note);
      if (pitches.length === 0) {
        setChordSymbol("");
        setRenderedNotes([]);
        setOttavaLabels([]);
        return;
      }
      const keyName = keySignatureRef.current;
      const keyRoot = keyName.split(' ')[0];
      const keySigPC = KEY_SIG_MAP[keyRoot] ?? 0;
      let keyCenterPc = keySigPC;
      if (keySigPC >= 12) {
          const auxMap: Record<number, number> = { 12: 6, 13: 1, 14: 8, 15: 3, 16: 10 };
          keyCenterPc = auxMap[keySigPC];
      }
      
      const overrides: Record<number, string> = {};
      activeNotes.current.forEach(n => {
          if (n.spellingOverride) overrides[n.note] = n.spellingOverride;
      });

      const spellings = getChordSpelling(pitches, keyName, lutRef.current, overrides, keyCenterPc, true, chordIdentityRef.current);
      const symbol = getChordSymbol(pitches, keyName, lutRef.current, overrides, keyCenterPc, chordIdentityRef.current);
      setChordSymbol(symbol);

      if (!chordIdentityRef.current.isActive) {
          const baseName = symbol.split(" / ")[0];
          const rootNameMatch = baseName.match(/^[A-G][b#]*/);
          const rootName = rootNameMatch ? rootNameMatch[0] : "C";
          const rootPC = PITCH_TO_PC[rootName] ?? 0;
          
          const spellingMap: Record<number, string> = {};
          pitches.forEach((pitch, i) => {
              const pc = (pitch % 12 + 12) % 12;
              spellingMap[pc] = spellings[i].replace(/\d+$/, '');
          });
          
          chordIdentityRef.current = {
              isActive: false,
              baseName,
              rootPC,
              spellingMap
          };
      }

      activeNotes.current.forEach((data, i) => {
        // Save the final broadcast string
        activeNotes.current[i].spellingString = spellings[i];
        
        const { stepOffset, accidental } = getSpellingData(data.note, spellings[i]);
        activeNotes.current[i] = {
          ...data,
          stepOffset,
          accidental,
          isTreble: data.note >= splitPointRef.current
        };
      });
      recalculateLayout();
    } catch (e) {
      console.error('Error updating spellings:', e);
    }
  };

  // 3. Event Listeners and Triggers
  useEffect(() => {
    keySignatureRef.current = keySignature;
    lutRef.current = lut;
    updateSpellings();
  }, [keySignature, lut]);

  useEffect(() => {
    splitPointRef.current = splitPoint;
  }, [splitPoint]);


  useEffect(() => {
    const handleMidiMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { data, panic, refresh, notes, isVirtual } = customEvent.detail || {};

      if (panic) {
        activeNotes.current = [];
        physicalKeysDown.current.clear();
        isWaitingForNewChord.current = false;
        chordIdentityRef.current.isActive = false;
        setRenderedNotes([]);
        setOttavaLabels([]);
        updateActiveNotes?.([]);
        return;
      }

      if (refresh) {
        if (notes) {
          const itemPitches = notes.map((item: any) => typeof item === 'object' ? item.note : item);
          const safePitches = enforcePianoRange(itemPitches, []);
          activeNotes.current = safePitches.map((pitch: number) => {
            const existing = notes.find((item: any) => (typeof item === 'object' ? item.note : item) === pitch);
            if (existing && typeof existing === 'object' && existing.id) {
              return { ...existing, note: pitch };
            }
            return {
              id: generateId(),
              note: pitch,
              stepOffset: 0,
              accidental: null,
              isTreble: pitch >= splitPointRef.current,
              sourceMidi: pitch
            };
          });
        }
        updateSpellings();
        return;
      }

      if (!data || !(data instanceof Uint8Array) || data.length < 3) return;
      const status = data[0];
      const note = data[1];
      const velocity = data[2];
      const isNoteOn = (status & 0xF0) === 0x90 && velocity > 0;
      const isNoteOff = (status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && velocity === 0);

      if ((isNoteOn || isNoteOff) && !isVirtual) {
          chordIdentityRef.current.isActive = false;
      }

      let stateCommitted = false;
      const maybeCommit = () => {
          if (!stateCommitted) {
              commitState();
              stateCommitted = true;
          }
      };

      if (isNoteOn) {
          let shouldAdd = true;
          
          if (isVirtual) {
              if (isToggleModeActive) {
                  const idx = activeNotes.current.findIndex(n => n.note === note);
                  if (idx !== -1) {
                      maybeCommit();
                      activeNotes.current.splice(idx, 1); // Toggle Off
                      chordIdentityRef.current.isActive = false;
                      shouldAdd = false;
                  }
              }
          } else {
              // Physical Hardware
              if (effectiveHoldModeRef.current && physicalKeysDown.current.size === 0) {
                  if (activeNotes.current.length > 0) maybeCommit();
                  activeNotes.current = []; // Wipe board for new chord
              }
              physicalKeysDown.current.add(note);
          }

          if (shouldAdd && !activeNotes.current.some(n => n.sourceMidi === note || n.note === note)) {
              maybeCommit();
              activeNotes.current.push({ id: generateId(), note, stepOffset: 0, accidental: null, isTreble: note >= splitPointRef.current, velocity: velocity || 100, channel: 0, status: 0x90, sourceMidi: note });
          }

          if (Tone.context.state === 'running') {
              try { audioEngine.noteOn(Tone.Frequency(note, "midi").toNote(), velocity / 127); } catch(err) { console.error("[AudioEngine] noteOn failed for pitch:", note, err); }
          }
          updateSpellings();
          updateActiveNotes?.([...activeNotes.current]);
          if (activeNotes.current.length > 0) {
              setHomeChordRef.current?.(activeNotes.current.map(n => n.note));
          }
      } else if (isNoteOff) {
          if (!isVirtual) physicalKeysDown.current.delete(note);
          
          if (Tone.context.state === 'running') {
              try { audioEngine.releaseNote(Tone.Frequency(note, "midi").toNote()); } catch(err) { console.error("[AudioEngine] releaseNote failed for pitch:", note, err); }
          }

          let shouldRemove = false;
          if (isVirtual && !isToggleModeActive) {
              shouldRemove = true; // Virtual Momentary
          } else if (!isVirtual && !effectiveHoldModeRef.current) {
              shouldRemove = true; // Physical Momentary
          }

          if (shouldRemove) {
              if (activeNotes.current.some(n => n.sourceMidi === note || n.note === note)) {
                  maybeCommit();
                  activeNotes.current = activeNotes.current.filter(n => n.sourceMidi !== note && n.note !== note);
                  chordIdentityRef.current.isActive = false;
              }
          }

          updateSpellings();
          updateActiveNotes?.([...activeNotes.current]);
      }
      recalculateLayout();
    };
    window.addEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
    return () => window.removeEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
  }, []);

  useEffect(() => {
    const handleHoldChange = (e: any) => {
        const enabled = e.detail?.enabled;
        if (enabled !== undefined) {
            setLocalHoldMode(enabled);
            effectiveHoldModeRef.current = enabled;
            if (!enabled) {
                // Toggle Hold Mode OFF: Sync display with physical keys
                activeNotes.current = activeNotes.current.filter(n => n.sourceMidi !== undefined && physicalKeysDown.current.has(n.sourceMidi));
                updateSpellings();
                updateActiveNotes?.([...activeNotes.current]);
                recalculateLayout();
                forceUpdate();
            }
        }
    };
    window.addEventListener('HOLD_MODE_CHANGED', handleHoldChange);
    return () => window.removeEventListener('HOLD_MODE_CHANGED', handleHoldChange);
  }, []);

  // APP EVENT BRIDGE
  useEffect(() => {
    const handleTransform = (e: any) => {
      const { type, stepSize, isUiClick } = e.detail;

      // PRE-FLIGHT AUTO-SELECT: If no selection, select all active notes
      if (selectedNoteIds.current.size === 0 && activeNotes.current.length > 0) {
        activeNotes.current.forEach(note => selectedNoteIds.current.add(note.id));
        const allIds = Array.from(selectedNoteIds.current);
        setSelectedNotes?.(allIds.map(id => activeNotes.current.find(n => n.id === id)?.note).filter((n): n is number => n !== undefined));
        forceUpdate(); // Ensure UI highlights the newly selected notes
      }

      if (selectedNoteIds.current.size === 0) return;

      const isUi = isUiClick !== undefined ? isUiClick : true;

      switch (type) {
        case 'SEMI_UP': applyChromaticShift(1, stepSize, isUi); break;
        case 'SEMI_DOWN': applyChromaticShift(-1, stepSize, isUi); break;
        case 'KEY_UP': applyDiatonicShift(1, stepSize, isUi); break;
        case 'KEY_DOWN': applyDiatonicShift(-1, stepSize, isUi); break;
        case 'ROT_UP': applyPcsRotation(1, stepSize, isUi); break;
        case 'ROT_DOWN': applyPcsRotation(-1, stepSize, isUi); break;
        case 'OCT_UP': applyChromaticShift(12, stepSize, isUi); break;
        case 'OCT_DOWN': applyChromaticShift(-12, stepSize, isUi); break;
      }
    };

    const handleHistory = (e: any) => {
      const { action } = e.detail;
      switch (action) {
        case 'UNDO': undo(); break;
        case 'REDO': redo(); break;
        case 'HOME': applyHome(); break;
      }
    };

    const handlePlayOn = (e: Event) => {
        const vel = (e as CustomEvent).detail.velocity / 127;
        if (selectedNoteIds.current.size === 0 && activeNotes.current.length > 0) {
            activeNotes.current.forEach(note => selectedNoteIds.current.add(note.id));
            forceUpdate();
        }
        if (selectedNoteIds.current.size === 0) return;
        
        const strings = Array.from(selectedNoteIds.current)
            .map(id => activeNotes.current.find(n => n.id === id)?.note)
            .filter((n): n is number => typeof n === 'number')
            .map(pitch => Tone.Frequency(pitch, "midi").toNote());
        strings.forEach(s => { try { audioEngine.noteOn(s, vel); } catch(err){ console.error("[AudioEngine] noteOn failed for pitch:", s, err); } });
    };
    
    const handlePlayOff = () => {
        const strings = Array.from(selectedNoteIds.current)
            .map(id => activeNotes.current.find(n => n.id === id)?.note)
            .filter((n): n is number => typeof n === 'number')
            .map(pitch => Tone.Frequency(pitch, "midi").toNote());
        strings.forEach(s => { try { audioEngine.releaseNote(s); } catch(err){ console.error("[AudioEngine] releaseNote failed for pitch:", s, err); } });
    };

    const handleHomeOn = (e: Event) => {
        const vel = (e as CustomEvent).detail.velocity / 127;
        const homePitches = homeChordRef.current && homeChordRef.current.length > 0 ? homeChordRef.current : [60];
        activeNotes.current = homePitches.map((pitch: number) => ({
            id: generateId(),
            note: pitch,
            stepOffset: 0,
            accidental: null,
            isTreble: pitch >= splitPointRef.current,
            sourceMidi: pitch,
            velocity: (e as CustomEvent).detail.velocity || 100,
            channel: 0,
            status: 0x90
        }));
        selectedNoteIds.current.clear();
        updateSpellings();
        updateActiveNotes?.([...activeNotes.current]);
        recalculateLayout();

        try { audioEngine.releaseAll(); } catch(err) {}
        homePitches.forEach((pitch: number) => {
            const noteStr = Tone.Frequency(pitch, "midi").toNote();
            try { audioEngine.noteOn(noteStr, vel); } catch(err) { console.error("[AudioEngine] noteOn failed for pitch:", noteStr, err); }
        });
    };

    const handleHomeOff = () => {
        const homePitches = homeChordRef.current && homeChordRef.current.length > 0 ? homeChordRef.current : [60];
        homePitches.forEach((pitch: number) => {
            const noteStr = Tone.Frequency(pitch, "midi").toNote();
            try { audioEngine.releaseNote(noteStr); } catch(err) { console.error("[AudioEngine] releaseNote failed for pitch:", noteStr, err); }
        });
    };

    const handlePreviewOn = (e: Event) => {
        const vel = (e as CustomEvent).detail.velocity / 127;

        if (selectedNoteIds.current.size === 0 && activeNotes.current.length > 0) {
            activeNotes.current.forEach(note => selectedNoteIds.current.add(note.id));
            forceUpdate(); // Update UI to show selection
        }
        if (selectedNoteIds.current.size === 0) return; // Exit if nothing to play

        const strings = Array.from(selectedNoteIds.current)
          .map(id => activeNotes.current.find(n => n.id === id)?.note)
          .filter((n): n is number => typeof n === 'number')
          .map(pitch => Tone.Frequency(pitch, "midi").toNote());
        
        strings.forEach(s => {
            try { audioEngine.noteOn(s, vel); } catch(err) { console.error("[AudioEngine] noteOn failed for pitch:", s, err); }
        });
    };

    const handlePreviewOff = () => {
        const strings = Array.from(selectedNoteIds.current)
          .map(id => activeNotes.current.find(n => n.id === id)?.note)
          .filter((n): n is number => typeof n === 'number')
          .map(pitch => Tone.Frequency(pitch, "midi").toNote());
        strings.forEach(s => {
            try { audioEngine.releaseNote(s); } catch(err) { console.error("[AudioEngine] releaseNote failed for pitch:", s, err); }
        });
    };

    window.addEventListener('APP_TRANSFORM', handleTransform as any);
    window.addEventListener('APP_TRANSFORM_OFF', handlePlayOff);
    window.addEventListener('APP_HISTORY', handleHistory as any);
    window.addEventListener('APP_PLAY_ON', handlePlayOn);
    window.addEventListener('APP_PLAY_OFF', handlePlayOff);
    window.addEventListener('APP_HOME_ON', handleHomeOn);
    window.addEventListener('APP_HOME_OFF', handleHomeOff);
    window.addEventListener('APP_HARDWARE_PREVIEW_ON', handlePreviewOn);
    window.addEventListener('APP_HARDWARE_PREVIEW_OFF', handlePreviewOff);

    return () => {
      window.removeEventListener('APP_TRANSFORM', handleTransform as any);
      window.removeEventListener('APP_TRANSFORM_OFF', handlePlayOff);
      window.removeEventListener('APP_HISTORY', handleHistory as any);
      window.removeEventListener('APP_PLAY_ON', handlePlayOn);
      window.removeEventListener('APP_PLAY_OFF', handlePlayOff);
      window.removeEventListener('APP_HOME_ON', handleHomeOn);
      window.removeEventListener('APP_HOME_OFF', handleHomeOff);
      window.removeEventListener('APP_HARDWARE_PREVIEW_ON', handlePreviewOn);
      window.removeEventListener('APP_HARDWARE_PREVIEW_OFF', handlePreviewOff);
    };
  }, []);

  // Selection Garbage Collector: Prune selected IDs that no longer exist in activeNotes
  // AND Sync global selection state
  useEffect(() => {
    const validIds = new Set(activeNotes.current.map(n => n.id));
    let changed = false;
    selectedNoteIds.current.forEach(id => {
      if (!validIds.has(id)) {
        selectedNoteIds.current.delete(id);
        changed = true;
      }
    });

    const selectedPitches = Array.from(selectedNoteIds.current)
      .map(id => activeNotes.current.find(n => n.id === id)?.note)
      .filter((n): n is number => typeof n === 'number');
    
    setSelectedNotes?.(selectedPitches);

    if (changed) forceUpdate();
  }, [renderedNotes, tick]); // tick ensures sync on forceUpdate calls

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
        return;
    }

    const canvasElement = e.currentTarget as HTMLDivElement;
    if (typeof canvasElement.setPointerCapture === 'function') {
      canvasElement.setPointerCapture(e.pointerId);
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    if (isWriteMode.current) {
      const canvasWidth = canvasElement.offsetWidth > 0 ? canvasElement.offsetWidth : rect.width;
      const isOutsideStaves = pointerX < (canvasWidth / 2 - 150) || pointerX > (canvasWidth / 2 + 150);
      if (isOutsideStaves) {
        isWriteMode.current = false;
        const ghost = document.getElementById('ghost-note');
        if (ghost) ghost.classList.add('hidden');
        forceUpdate();
        return;
      } else {
        // Write the note
        const ghost = document.getElementById('ghost-note');
        const step = parseInt((ghost as any)?.dataset.step || '0');
        const targetMidiNote = parseInt((ghost as any)?.dataset.midiNote || '60');
        const targetAccidental = (ghost as any)?.dataset.accidental === 'null' ? null : (ghost as any)?.dataset.accidental;
        const overrideString = getNoteNameFromPosition(step, targetAccidental, keySignatureRef.current, lutRef.current);

        commitState();
        activeNotes.current.push({
            id: generateId(),
            note: targetMidiNote,
            sourceMidi: targetMidiNote,
            stepOffset: step,
            accidental: targetAccidental,
            spellingOverride: overrideString,
            isTreble: targetMidiNote >= splitPointRef.current,
            velocity: 100,
            channel: 0,
            status: 0x90
        });
        updateSpellings();
        updateActiveNotes?.([...activeNotes.current]);
        playPreviewNotes([Tone.Frequency(targetMidiNote, "midi").toNote()], false);
        return; // Early return to prevent selection logic
      }
    }
    
    let clickedNote: any = undefined;

    // Check DOM target first (crucial for JSDOM unit tests and direct note clicks)
    const targetNode = (e.target as HTMLElement)?.closest?.('[data-note-id]');
    if (targetNode) {
        const notePitch = parseInt((targetNode as HTMLElement).dataset.noteId || '');
        if (!isNaN(notePitch)) {
            clickedNote = renderedNotes.find(n => n.note === notePitch);
        }
    }

    // Fallback to Mathematical Hit-Test if clicking canvas directly
    if (!clickedNote) {
        const staffSpacePx = 10; 
        const horizontalThreshold = staffSpacePx * 1.5;
        const verticalThreshold = staffSpacePx * 0.8;
        
        const canvasWidth = canvasElement.offsetWidth > 0 ? canvasElement.offsetWidth : rect.width;
        const canvasHeight = canvasElement.offsetHeight > 0 ? canvasElement.offsetHeight : rect.height;

        clickedNote = renderedNotes.find((note) => {
          const centerX = canvasWidth / 2 + (note.xOffset || 0);
          const centerY = canvasHeight / 2 - note.y;
          
          const dx = Math.abs(pointerX - centerX);
          const dy = Math.abs(pointerY - centerY);
          const match = dx < horizontalThreshold && dy < verticalThreshold;
          return match;
        });
    }

    if (clickedNote) {
      const id = clickedNote.id;
      const pitch = clickedNote.note;

      if (e.shiftKey && lastSelectedNoteId.current) {
        // Range Selection
        const anchorNote = renderedNotes.find(n => n.id === lastSelectedNoteId.current);
        if (!anchorNote) return;
        const lastPitch = anchorNote.note;
        const min = Math.min(pitch, lastPitch);
        const max = Math.max(pitch, lastPitch);

        selectedNoteIds.current.clear();
        renderedNotes.forEach((n) => {
          if (n.note >= min && n.note <= max) {
            selectedNoteIds.current.add(n.id);
          }
        });
      } else if (e.metaKey || e.ctrlKey) {
        // Multi-Selection (Toggle)
        if (selectedNoteIds.current.has(id)) {
          selectedNoteIds.current.delete(id);
        } else {
          selectedNoteIds.current.add(id);
        }
        lastSelectedNoteId.current = id;
      } else {
        // Single Selection
        selectedNoteIds.current.clear();
        selectedNoteIds.current.add(id);
        lastSelectedNoteId.current = id;
      }
    } else {
      // Click-away deselection
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (selectedNoteIds.current.size > 0) {
          selectedNoteIds.current.clear();
          lastSelectedNoteId.current = null;
        }
      }
    }

    if (clickedNote) {
      const selectedStrings = Array.from(selectedNoteIds.current)
        .map(id => renderedNotes.find(n => n.id === id)?.note)
        .filter((n): n is number => typeof n === 'number')
        .map(pitch => Tone.Frequency(pitch, "midi").toNote());
      
      if (selectedStrings.length > 0) {
        playPreviewNotes(selectedStrings, true);
      }
    }
    
    forceUpdate(); 

    // Initialize Marquee
    dragTracker.current = {
      isDragging: true,
      startX: pointerX,
      startY: pointerY,
      currentX: pointerX,
      currentY: pointerY,
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // --- 1. GLOBAL SHORTCUTS (No selection required) ---
      
      // Escape: Exit Write Mode & Clear Selection
      if (e.key === 'Escape') {
        isWriteMode.current = false;
        const ghost = document.getElementById('ghost-note');
        if (ghost) ghost.classList.add('hidden');
        selectedNoteIds.current.clear();
        lastSelectedNoteId.current = null;
        forceUpdate();
        return;
      }

      // Shift + W: Toggle Write Mode
      if (e.key === 'W' || (e.key === 'w' && e.shiftKey)) {
        isWriteMode.current = !isWriteMode.current;
        selectedNoteIds.current.clear();
        const ghost = document.getElementById('ghost-note');
        if (isWriteMode.current && ghost && canvasRef.current) {
            // Instantly snap ghost note to last known pointer Y
            snapGhostNote(lastPointerY.current, canvasRef.current.getBoundingClientRect());
        } else if (ghost) {
            ghost.classList.add('hidden');
        }
        forceUpdate();
        return;
      }

      // Cmd/Ctrl + Z: Undo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z (or Cmd+Y): Redo
      if (((e.key === 'Z' || e.key === 'z') && e.shiftKey && (e.metaKey || e.ctrlKey)) || (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // --- 2. SELECTION-DEPENDENT SHORTCUTS ---
      if (selectedNoteIds.current.size === 0) return;

      const allPitches = activeNotes.current.map(n => n.note).sort((a, b) => a - b);
      const selectedEntries = Array.from(selectedNoteIds.current).map(id => {
        const noteData = activeNotes.current.find(n => n.id === id);
        return { 
          id, 
          pitch: noteData ? noteData.note : 0 
        };
      }).filter(en => en.pitch !== 0).sort((a, b) => a.pitch - b.pitch);

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const delta = e.key === 'ArrowUp' ? 1 : -1;

        if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
          e.preventDefault();
          
          if (e.altKey && (e.metaKey || e.ctrlKey)) {
            applyPcsRotation(delta, 1);
          } else if (e.altKey) {
            applyDiatonicShift(delta, 1);
          } else {
            const multiplier = (e.metaKey || e.ctrlKey) ? 12 : 1;
            applyChromaticShift(delta, multiplier);
          }
        } else {
          // SELECTION TRAVERSAL
          if (selectedEntries.length === 1) {
            e.preventDefault();
            const currentNoteId = selectedEntries[0].id;
            const currentIndexInActive = activeNotes.current.findIndex(n => n.id === currentNoteId);
            if (currentIndexInActive === -1) return;
            
            const currentPitch = activeNotes.current[currentIndexInActive].note;
            const currentIndexInSorted = allPitches.indexOf(currentPitch);
            const nextIndexInSorted = (currentIndexInSorted + delta + allPitches.length) % allPitches.length;
            const nextPitch = allPitches[nextIndexInSorted];
            
            // Find the note object for the next pitch
            const nextNote = activeNotes.current.find(n => n.note === nextPitch);
            if (nextNote) {
              selectedNoteIds.current.clear();
              selectedNoteIds.current.add(nextNote.id);
              lastSelectedNoteId.current = nextNote.id;
              forceUpdate();
              playPreviewNotes([Tone.Frequency(nextPitch, "midi").toNote()], true);
            }
          }
        }
      }

      // Deletion
      if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          commitState();
          activeNotes.current = activeNotes.current.filter(n => !selectedNoteIds.current.has(n.id));
          chordIdentityRef.current.isActive = false;
          selectedNoteIds.current.clear();
          updateSpellings();
          updateActiveNotes?.([...activeNotes.current]);
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const handlePointerMove = (e: React.PointerEvent) => {
    lastPointerY.current = e.clientY;
    const rect = canvasRef.current!.getBoundingClientRect();

    if (isWriteMode.current) {
      snapGhostNote(e.clientY, rect);
    }

    if (!dragTracker.current.isDragging) return;
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const { startX, startY } = dragTracker.current;
    
    dragTracker.current.currentX = currentX;
    dragTracker.current.currentY = currentY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(startX - currentX);
    const height = Math.abs(startY - currentY);
    
    if (marqueeRef.current) {
      if (width > 5 || height > 5) {
        marqueeRef.current.classList.remove('hidden');
        marqueeRef.current.style.setProperty('position', 'fixed', 'important');
        marqueeRef.current.style.setProperty('left', `${rect.left + left}px`, 'important');
        marqueeRef.current.style.setProperty('top', `${rect.top + top}px`, 'important');
        marqueeRef.current.style.setProperty('width', `${width}px`, 'important');
        marqueeRef.current.style.setProperty('height', `${height}px`, 'important');
        marqueeRef.current.style.setProperty('transform', 'none', 'important');
        marqueeRef.current.style.setProperty('margin', '0', 'important');
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const canvasElement = e.currentTarget as HTMLDivElement;
    if (typeof canvasElement.releasePointerCapture === 'function') {
      try {
        if (typeof canvasElement.hasPointerCapture !== 'function' || canvasElement.hasPointerCapture(e.pointerId)) {
          canvasElement.releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        // Ignore potential pointer capture release errors
      }
    }

    if (!dragTracker.current.isDragging) return;
    dragTracker.current.isDragging = false;
    
    if (marqueeRef.current && !marqueeRef.current.classList.contains('hidden')) {
      const marqueeRect = marqueeRef.current.getBoundingClientRect();
      const rect = canvasElement.getBoundingClientRect();
      const left = Math.min(dragTracker.current.startX, dragTracker.current.currentX);
      const right = Math.max(dragTracker.current.startX, dragTracker.current.currentX);
      const top = Math.min(dragTracker.current.startY, dragTracker.current.currentY);
      const bottom = Math.max(dragTracker.current.startY, dragTracker.current.currentY);
      
      marqueeRef.current.classList.add('hidden');
      
      renderedNotes.forEach((note) => {
        const noteEl = document.querySelector(`[data-testid="note-container-${note.note}"]`);
        let matched = false;
        if (noteEl && noteEl.getBoundingClientRect) {
            const nRect = noteEl.getBoundingClientRect();
            if (marqueeRect.width > 0 && nRect.width > 0) {
                if (!(nRect.right < marqueeRect.left || 
                      nRect.left > marqueeRect.right || 
                      nRect.bottom < marqueeRect.top || 
                      nRect.top > marqueeRect.bottom)) {
                    matched = true;
                }
            }
        }
        if (!matched) {
            const canvasWidth = canvasElement.offsetWidth > 0 ? canvasElement.offsetWidth : rect.width;
            const canvasHeight = canvasElement.offsetHeight > 0 ? canvasElement.offsetHeight : rect.height;
            const noteX = canvasWidth / 2 + (note.xOffset || 0);
            const noteY = canvasHeight / 2 - note.y;
            if (noteX >= left && noteX <= right && noteY >= top && noteY <= bottom) {
              matched = true;
            }
        }
        if (matched) {
          selectedNoteIds.current.add(note.id);
        }
      });
      
      forceUpdate();

      const selectedStrings = Array.from(selectedNoteIds.current)
        .map(id => renderedNotes.find(n => n.id === id)?.note)
        .filter((n): n is number => typeof n === 'number')
        .map(pitch => Tone.Frequency(pitch, "midi").toNote());
      
      if (selectedStrings.length > 0) {
        playPreviewNotes(selectedStrings, true);
      }
    }
  };

  if (!lut || lut.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[320px] bg-white dark:bg-[#0a0a0a] rounded-lg border border-gray-100 dark:border-white/5">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-2 w-24 bg-[#aa3bff]/20 rounded-full mb-4"></div>
          <div className="text-neutral-400 text-xs font-medium tracking-widest uppercase">Loading Database</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDoubleClick={() => {
        isWriteMode.current = !isWriteMode.current;
        selectedNoteIds.current.clear();
        const ghost = document.getElementById('ghost-note');
        if (isWriteMode.current && ghost && canvasRef.current) {
            snapGhostNote(lastPointerY.current, canvasRef.current.getBoundingClientRect());
        } else if (ghost) {
            ghost.classList.add('hidden');
        }
        forceUpdate();
      }}
      data-testid="notation-canvas-container"
      className="notation-canvas-container relative w-[962px] h-[320px] bg-white dark:bg-[#0a0a0a] overflow-visible flex items-center justify-center select-none leading-none rounded-xl shadow-lg border border-gray-200 dark:border-white/10"
      style={{ lineHeight: '1' }}
    >
      {/* Compact Grand Staff System */}
      <div className="grand-staff-system relative w-[300px] h-full flex flex-col justify-center items-center">
        {/* Key Signature Selector - Absolute Positioned */}
        <div className="absolute top-1/2 -translate-y-1/2 right-[100%] mr-8 z-20 flex flex-col gap-3 items-end">
          <KeySignatureSelector />
          
          {isWriteMode.current && (
            <div 
              className="flex items-center gap-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded p-1 shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={handleFlatClick} className={`w-8 h-8 flex items-center justify-center rounded text-[22px] font-['Bravura'] transition-colors ${accidentalOverride === 'b' || accidentalOverride === 'bb' ? 'bg-[#aa3bff]/20 text-[#aa3bff]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                {accidentalOverride === 'bb' ? SMuFL.accidentalDoubleFlat : SMuFL.accidentalFlat}
              </button>
              <button onClick={handleNaturalClick} className={`w-8 h-8 flex items-center justify-center rounded text-[22px] font-['Bravura'] transition-colors ${accidentalOverride === 'n' ? 'bg-[#aa3bff]/20 text-[#aa3bff]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                {SMuFL.accidentalNatural}
              </button>
              <button onClick={handleSharpClick} className={`w-8 h-8 flex items-center justify-center rounded text-[22px] font-['Bravura'] transition-colors ${accidentalOverride === '#' || accidentalOverride === 'x' ? 'bg-[#aa3bff]/20 text-[#aa3bff]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                {accidentalOverride === 'x' ? SMuFL.accidentalDoubleSharp : SMuFL.accidentalSharp}
              </button>
            </div>
          )}
        </div>

        {/* Chord Symbol Label - Floating Pill */}
        <div 
          data-testid="chord-symbol-pill"
          className="absolute top-1/2 -translate-y-1/2 left-[100%] ml-8 z-20 flex items-center justify-center bg-white dark:bg-[#111] shadow-lg rounded-full px-8 py-3 border border-gray-100 dark:border-white/5 transition-all min-w-[120px]"
        >
          <span 
            className="text-2xl font-bold text-blue-500 dark:text-blue-400 whitespace-nowrap pointer-events-none"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            {chordSymbol || "-"}
          </span>
        </div>
        
        {/* Notes Layer */}
        <div id="notes-layer" data-testid="notes-layer" className="absolute inset-0 pointer-events-none z-10">
          <div id="ghost-note" className="absolute hidden pointer-events-none opacity-40 z-50 transition-none" style={{ left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div id="ghost-accidental" className="absolute" style={{ left: 'calc(-1.5 * var(--staff-space))', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Bravura', sans-serif", fontSize: `calc(var(--staff-space) * 3)`, color: 'var(--accent, #aa3bff)' }}></div>
              <div id="ghost-notehead" style={{ fontFamily: "'Bravura', sans-serif", fontSize: `calc(var(--staff-space) * 4.2)`, color: 'var(--accent, #aa3bff)' }}>{SMuFL.noteheadBlack}</div>
          </div>
          {renderedNotes.map(note => (
            <div 
              key={note.id}
              className="notation-note-container transition-all duration-75"
              data-midi-note={note.note}
              data-note-id={note.note}
              data-testid={`note-container-${note.note}`}
              data-selected={selectedNoteIds.current.has(note.id) || undefined}
              style={{
                position: 'absolute',
                left: note.xOffset ? `calc(50% + ${note.xOffset}px)` : '50%',
                top: note.y ? `calc(50% - ${note.y}px)` : '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
              }}
            >
              {/* Visual Notehead (SMuFL) */}
              <div 
                className="notehead" 
                style={{
                  fontFamily: "'Bravura', sans-serif",
                  fontSize: `calc(var(${STAFF_SPACE_CSS_VAR}) * 4.2)`,
                  color: selectedNoteIds.current.has(note.id) ? '#aa3bff' : '#000000',
                  textShadow: selectedNoteIds.current.has(note.id) ? '0 0 15px rgba(170, 59, 255, 0.4)' : 'none',
                  pointerEvents: 'none',
                  transition: 'color 0.1s ease, text-shadow 0.1s ease'
                }}
              >
                {SMuFL.noteheadWhole}
              </div>

              {/* Visual Accidental (SMuFL) */}
              {(note.accidental || note.forceAccidentalDisplay) && (
                <div 
                  data-is-accidental="true"
                  style={{
                    position: 'absolute',
                    left: note.accidentalLeft || `calc(-1.5 * var(${STAFF_SPACE_CSS_VAR}))`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontFamily: "'Bravura', sans-serif",
                    fontSize: `calc(var(${STAFF_SPACE_CSS_VAR}) * 3)`,
                    color: selectedNoteIds.current.has(note.id) ? '#aa3bff' : '#000000',
                    pointerEvents: 'none',
                    transition: 'color 0.1s ease'
                  }}
                >
                  {note.accidental || SMuFL.accidentalNatural}
                </div>
              )}

              {/* Ledger Lines */}
              {(() => {
                const lines = [];
                const renderLedgerLine = (lineStep: number) => {
                  const yOffset = (note.finalStep - lineStep) * (staffSpace / 2);
                  return (
                    <div 
                      key={`ledger-${note.note}-${lineStep}`}
                      className="absolute left-1/2 -translate-x-1/2 h-[1.5px] bg-black dark:bg-gray-400 z-[-1]"
                      style={{
                        width: `calc(var(${STAFF_SPACE_CSS_VAR}) * 2.5)`,
                        top: `calc(50% + ${yOffset}px - 1px)`
                      }}
                      data-testid={`ledger-line-${lineStep}`}
                    />
                  );
                };

                if (note.isTreble) {
                  if (note.finalStep >= 12) {
                    for (let ls = 12; ls <= note.finalStep; ls += 2) lines.push(renderLedgerLine(ls));
                  } else if (note.finalStep <= 0) {
                    for (let ls = 0; ls >= note.finalStep; ls -= 2) lines.push(renderLedgerLine(ls));
                  }
                } else {
                  if (note.finalStep >= 0) {
                    for (let ls = 0; ls <= note.finalStep; ls += 2) lines.push(renderLedgerLine(ls));
                  } else if (note.finalStep <= -12) {
                    for (let ls = -12; ls >= note.finalStep; ls -= 2) lines.push(renderLedgerLine(ls));
                  }
                }
                return lines;
              })()}
            </div>
          ))}

          {/* Ottava Labels */}
          {ottavaLabels.map((label, idx) => (
            <div 
              key={`label-${idx}`}
              className="ottava-label absolute font-serif italic text-black dark:text-gray-300 pointer-events-none whitespace-nowrap -translate-x-1/2 left-1/2"
              style={{
                fontSize: `calc(var(${STAFF_SPACE_CSS_VAR}) * 1.5)`,
                top: `calc(50% - ${label.y}px + ${label.offset}px)`
              }}
            >
              {label.text}
            </div>
          ))}
        </div>

        {/* Treble Staff */}
        <div className="staff-group treble-staff absolute w-full" style={{ top: 'calc(50% - var(--staff-space) * 6)' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={`treble-line-${i}`} className="staff-line w-full border-t border-black dark:border-gray-600 absolute opacity-70" style={{ top: `calc(${i} * var(--staff-space))` }} />
          ))}
          <div data-testid="treble-clef" className="treble-clef absolute left-2 text-black dark:text-gray-300 leading-none" style={{ top: 'calc(var(--staff-space) * 1)', fontSize: 'calc(var(--staff-space) * 4)', fontFamily: 'Bravura', lineHeight: '1' }}>{'\uE050'}</div>
        </div>

        {/* Bass Staff */}
        <div className="staff-group bass-staff absolute w-full" style={{ top: 'calc(50% + var(--staff-space) * 2)' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={`bass-line-${i}`} className="staff-line w-full border-t border-black dark:border-gray-600 absolute opacity-70" style={{ top: `calc(${i} * var(--staff-space))` }} />
          ))}
          <div data-testid="bass-clef" className="bass-clef absolute left-2 text-black dark:text-gray-300 leading-none" style={{ top: 'calc(var(--staff-space) * -1)', fontSize: 'calc(var(--staff-space) * 4)', fontFamily: 'Bravura', lineHeight: '1' }}>{'\uE062'}</div>
        </div>

        {/* Brace and System Barlines */}
        <div className="system-left-edge absolute left-0 h-[calc(var(--staff-space)*12)]" style={{ top: 'calc(50% - var(--staff-space) * 6)' }}>
          <div className="brace absolute right-[calc(100%+var(--staff-space)*0.25)] top-[calc(var(--staff-space)*6)] font-['Bravura'] text-[calc(var(--staff-space)*12)] leading-none text-black dark:text-gray-300" style={{ lineHeight: '1' }}>{'\uE000'}</div>
          <div className="system-barline absolute left-0 w-[1.5px] h-[calc(var(--staff-space)*12)] bg-black dark:bg-gray-600" />
        </div>

        {/* Right System Barline */}
        <div className="system-right-barline absolute right-0 w-[1.5px] h-[calc(var(--staff-space)*12)] bg-black dark:bg-gray-600" style={{ top: 'calc(50% - var(--staff-space) * 6)' }} />

        {/* Middle C reference line (invisible but for alignment) */}
        <div className="absolute w-full h-0 border-t border-transparent" style={{ top: '50%' }} />

      </div>
      <div ref={marqueeRef} className="selection-marquee absolute border border-blue-500 bg-blue-500/20 z-50 pointer-events-none hidden" style={{ left: 0, top: 0, width: 0, height: 0 }} />
    </div>
  );
};

export default NotationCanvas;