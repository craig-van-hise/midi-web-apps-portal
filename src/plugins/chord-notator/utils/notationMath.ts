// src/utils/notationMath.ts

export type AccidentalOverride = null | 'b' | 'bb' | 'n' | '#' | 'x';

// Constants for SMuFL glyphs
export const SMuFL = {
    noteheadWhole: '\uE0A2', // Whole Notehead
    noteheadBlack: '\uE0A4', // Black Notehead
    accidentalSharp: '\uE262',
    accidentalFlat: '\uE260',
    accidentalNatural: '\uE261',
    accidentalDoubleSharp: '\uE263',
    accidentalDoubleFlat: '\uE264',
    // ... other glyphs as needed
};

// Default staff space in pixels, as defined in PDD Phase 1
// This value should ideally be read from CSS variables at runtime.
// For pure function testing, we'll pass it as an argument.
const DEFAULT_STAFF_SPACE_PX = 12;
const MIDI_NOTE_MIN = 0;
const MIDI_NOTE_MAX = 127;

const C_MAJOR_SCALE = [
    { step: 0, pc: 0 }, { step: 1, pc: 2 }, { step: 2, pc: 4 }, { step: 3, pc: 5 },
    { step: 4, pc: 7 }, { step: 5, pc: 9 }, { step: 6, pc: 11 }
];
const ORDER_OF_SHARPS = [3, 0, 4, 1, 5, 2, 6]; // F, C, G, D, A, E, B (Steps)
const ORDER_OF_FLATS = [6, 2, 5, 1, 4, 0, 3]; // B, E, A, D, G, C, F (Steps)
const KEY_SIG_ACCIDENTALS: Record<string, number> = {
    "C Major": 0, "G Major": 1, "D Major": 2, "A Major": 3, "E Major": 4, "B Major": 5, "F# Major": 6, "C# Major": 7,
    "F Major": -1, "Bb Major": -2, "Eb Major": -3, "Ab Major": -4, "Db Major": -5, "Gb Major": -6, "Cb Major": -7
};
const ACCIDENTAL_TO_KEY_NAME: Record<number, string> = {
    0: "C Major", 1: "G Major", 2: "D Major", 3: "A Major", 4: "E Major", 5: "B Major", 6: "F# Major", 7: "C# Major",
    [-1]: "F Major", [-2]: "Bb Major", [-3]: "Eb Major", [-4]: "Ab Major", [-5]: "Db Major", [-6]: "Gb Major", [-7]: "Cb Major"
};

/**
 * Generates the diatonic pitch classes for the active key signature.
 */
export const SCALE_DECIMAL_MAP: Record<string, number> = {
  'Major': 2741,
  'Minor (Natural)': 1453,
  'Melodic Minor': 2733,
  'Harmonic Minor': 2477,
  'Harmonic Major': 2485,
  'Major Pentatonic': 661,
  'Whole Tone': 1365,
  'Augmented': 2457,
  'Diminished': 2925
};

function getRootPC(name: string): number {
    const pcMap: Record<string, number> = {
        "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11, "Cb": 11
    };
    return pcMap[name] ?? 0;
}

export function getDiatonicMap(keySignature: string, lut?: any[]): Map<number, { step: number, acc: string | null }> {
    const parts = keySignature.split(' ');
    const rootName = parts[0];
    const scaleType = parts.slice(1).join(' ') || 'Major';

    if (!lut || lut.length === 0 || SCALE_DECIMAL_MAP[scaleType] === undefined || !lut[SCALE_DECIMAL_MAP[scaleType]]) {
        const lookupKey = KEY_SIG_ACCIDENTALS[keySignature] !== undefined ? keySignature : (rootName + " Major");
        if (KEY_SIG_ACCIDENTALS[lookupKey] === undefined) {
            throw new Error(`[NotationEngine] Invalid key signature provided: "${keySignature}". Expected a valid string mapping.`);
        }
        const count = KEY_SIG_ACCIDENTALS[lookupKey];
        const scale = C_MAJOR_SCALE.map(s => ({ ...s, acc: null as string | null }));

        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const step = ORDER_OF_SHARPS[i];
                scale[step].pc = (scale[step].pc + 1) % 12;
                scale[step].acc = SMuFL.accidentalSharp;
            }
        } else if (count < 0) {
            for (let i = 0; i < Math.abs(count); i++) {
                const step = ORDER_OF_FLATS[i];
                scale[step].pc = (scale[step].pc + 11) % 12;
                scale[step].acc = SMuFL.accidentalFlat;
            }
        }

        const map = new Map<number, { step: number, acc: string | null }>();
        scale.forEach(s => map.set(s.pc, { step: s.step, acc: s.acc }));
        return map;
    }

    const entry = lut[SCALE_DECIMAL_MAP[scaleType]];
    if (!entry) {
        throw new Error(`LUT entry not found for scale type: ${scaleType}`);
    }
    const intervals: string[] = entry.scale_intervals || entry.chord_intervals || [];
    const rootPC = getRootPC(rootName);
    const rootLetter = rootName[0];
    const rootLetterIndex = ["C", "D", "E", "F", "G", "A", "B"].indexOf(rootLetter);

    const map = new Map<number, { step: number, acc: string | null }>();
    const majorSteps = [0, 2, 4, 5, 7, 9, 11];

    intervals.forEach(interval => {
        const match = interval.match(/^([b#x]*)(\d+)$/);
        if (!match) return;
        const accPrefix = match[1];
        const degree = parseInt(match[2], 10);
        const simpleDegree = ((degree - 1) % 7) + 1;
        const baseSemitones = majorSteps[simpleDegree - 1];

        let intervalOffset = 0;
        if (accPrefix === "b") intervalOffset = -1;
        else if (accPrefix === "bb") intervalOffset = -2;
        else if (accPrefix === "#") intervalOffset = 1;
        else if (accPrefix === "x") intervalOffset = 2;

        const intervalPC = (baseSemitones + intervalOffset + 12) % 12;
        const absolutePC = (rootPC + intervalPC) % 12;
        const step = (rootLetterIndex + simpleDegree - 1) % 7;
        const targetLetterPC = majorSteps[step];

        let diff = (absolutePC - targetLetterPC + 12) % 12;
        if (diff > 6) diff -= 12;

        let acc: string | null = null;
        if (diff === 1) acc = SMuFL.accidentalSharp;
        else if (diff === 2) acc = SMuFL.accidentalDoubleSharp;
        else if (diff === -1) acc = SMuFL.accidentalFlat;
        else if (diff === -2) acc = SMuFL.accidentalDoubleFlat;

        map.set(absolutePC, { step, acc });
    });

    return map;
}


// Custom error class for domain-specific logic failures
export class InvalidMidiNoteError extends Error {
    public readonly midiNote: number;

    constructor(midiNote: number, message: string = `Invalid MIDI note: ${midiNote}. Notes must be between ${MIDI_NOTE_MIN} and ${MIDI_NOTE_MAX}.`) {
        super(message);
        this.name = "InvalidMidiNoteError";
        this.midiNote = midiNote;
        // Ensure the stack trace is captured correctly
        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, InvalidMidiNoteError);
        }
    }
}

/**
 * Calculates the vertical Y-coordinate for a given MIDI note on the Grand Staff.
 * The calculation is based on Middle C (MIDI 60) being the vertical midpoint (Y=0).
 * Each semitone shift corresponds to a vertical shift of staffSpace / 2 pixels.
 * This function provides a clef-neutral Y-coordinate, assuming a linear mapping
 * of MIDI notes to vertical positions. The rendering engine will need to apply
 * clef-specific offsets if necessary.
 *
 * @param midiNote - The MIDI note number (0-127).
 * @param staffSpace - The vertical distance between staff lines in pixels. Defaults to DEFAULT_STAFF_SPACE_PX.
 * @returns The calculated Y-coordinate relative to the Grand Staff midpoint (Middle C).
 * @throws {InvalidMidiNoteError} If the midiNote is outside the valid MIDI range (0-127).
 */
/**
 * Maps a MIDI note and key signature to a staff position and accidental.
 */
export interface Spelling {
    stepOffset: number; // Staff steps relative to Middle C
    accidental: string | null; // SMuFL glyph or null
}

/**
 * Returns the enharmonic spelling for a MIDI note given a key signature.
 */
export function getEnharmonicSpelling(
    midiNote: number, 
    keySignature: string | number, 
    lut?: any[]
): { stepOffset: number, accidental: string | null } {
    const keyName = typeof keySignature === 'number' ? ACCIDENTAL_TO_KEY_NAME[keySignature] : keySignature;
    const pitchClass = midiNote % 12;
    const baseOctave = Math.floor(midiNote / 12) - 1; // Standard MIDI octave
    const diatonicMap = getDiatonicMap(keyName, lut);

    const mapping = diatonicMap.get(pitchClass);
    if (mapping) {
        const { step, acc } = mapping;
        let diatonicOctave = baseOctave;
        
        // Octave Boundary Corrections
        // MIDI octaves split at B/C (11/0). Diatonic spelling can cross this boundary.
        if (pitchClass === 11 && step === 0) diatonicOctave += 1; // Cb correction (MIDI B3 -> Cb4)
        if (pitchClass === 0 && step === 6) diatonicOctave -= 1; // B# correction (MIDI C4 -> B#3)
        
        const stepOffset = ((diatonicOctave - 4) * 7) + step;
        return { stepOffset, accidental: acc };
    }

    // Chromatic Fallback Handling
    const rootName = keyName.split(' ')[0];
    const isFlatKey = (KEY_SIG_ACCIDENTALS[keyName] ?? 0) < 0 || 
                      rootName.endsWith('b') || 
                      rootName === 'F';
    
    if (isFlatKey) {
        const flatMapping: Record<number, { step: number, acc: string | null }> = {
            0: { step: 0, acc: null },
            1: { step: 1, acc: SMuFL.accidentalFlat }, // Db
            2: { step: 1, acc: null },
            3: { step: 2, acc: SMuFL.accidentalFlat }, // Eb
            4: { step: 2, acc: null },
            5: { step: 3, acc: null },
            6: { step: 4, acc: SMuFL.accidentalFlat }, // Gb
            7: { step: 4, acc: null },
            8: { step: 5, acc: SMuFL.accidentalFlat }, // Ab
            9: { step: 5, acc: null },
            10: { step: 6, acc: SMuFL.accidentalFlat }, // Bb
            11: { step: 6, acc: null },
        };
        const { step, acc } = flatMapping[pitchClass];
        const stepOffset = ((baseOctave - 4) * 7) + step;
        return { stepOffset, accidental: acc };
    } else {
        const sharpMapping: Record<number, { step: number, acc: string | null }> = {
            0: { step: 0, acc: null },
            1: { step: 0, acc: SMuFL.accidentalSharp }, // C#
            2: { step: 1, acc: null },
            3: { step: 1, acc: SMuFL.accidentalSharp }, // D#
            4: { step: 2, acc: null },
            5: { step: 3, acc: null },
            6: { step: 3, acc: SMuFL.accidentalSharp }, // F#
            7: { step: 4, acc: null },
            8: { step: 4, acc: SMuFL.accidentalSharp }, // G#
            9: { step: 5, acc: null },
            10: { step: 5, acc: SMuFL.accidentalSharp }, // A#
            11: { step: 6, acc: null },
        };
        const { step, acc } = sharpMapping[pitchClass];
        const stepOffset = ((baseOctave - 4) * 7) + step;
        return { stepOffset, accidental: acc };
    }
}

export function calculateStaffPosition(midiNote: number, staffSpace: number = DEFAULT_STAFF_SPACE_PX): number {
    if (midiNote < MIDI_NOTE_MIN || midiNote > MIDI_NOTE_MAX) {
        throw new InvalidMidiNoteError(midiNote);
    }

    // Default to C Major for simple position calculation if needed
    const { stepOffset } = getEnharmonicSpelling(midiNote, 0);
    return stepOffset * (staffSpace / 2);
}

export interface NotePosition {
    ySteps: number;
    xLevel?: number;
    [key: string]: any;
}

function applyZipper(notes: NotePosition[]): NotePosition[] {
    const COLLISION_THRESHOLD = 1;
    const xLevels: NotePosition[][] = [];
    const sorted = [...notes].sort((a, b) => a.ySteps - b.ySteps);

    sorted.forEach(currentNote => {
        let currentLevel = 0;
        let placed = false;

        while (!placed) {
            if (!xLevels[currentLevel]) {
                xLevels[currentLevel] = [];
            }

            const collision = xLevels[currentLevel].some(placedNote => 
                Math.abs(placedNote.ySteps - currentNote.ySteps) <= COLLISION_THRESHOLD
            );

            if (collision) {
                currentLevel++;
            } else {
                xLevels[currentLevel].push(currentNote);
                currentNote.xLevel = currentLevel;
                placed = true;
            }
        }
    });

    return sorted;
}

export function assignXLevels(notes: NotePosition[]): NotePosition[] {
    // Phase 1: Group by ySteps to detect chromatic unisons
    const groups: Record<number, NotePosition[]> = {};
    notes.forEach(n => {
        if (!groups[n.ySteps]) groups[n.ySteps] = [];
        groups[n.ySteps].push(n);
    });

    const leftStack: NotePosition[] = [];
    const rightStack: NotePosition[] = [];

    Object.values(groups).forEach(group => {
        if (group.length > 1) {
            // Sort flattest to sharpest
            group.sort((a, b) => (a.note || 0) - (b.note || 0));
            // First (flattest) stays in left stack
            leftStack.push(group[0]);
            // Others go to right stack
            for (let i = 1; i < group.length; i++) {
                group[i].forceAccidentalDisplay = true;
                rightStack.push(group[i]);
            }
        } else {
            leftStack.push(group[0]);
        }
    });

    // Pass 2: Independent Zippering
    const zipperedLeft = applyZipper(leftStack);
    const zipperedRight = applyZipper(rightStack);

    // Flag right notes
    zipperedRight.forEach(n => {
        n.isRightColumn = true;
    });

    return [...zipperedLeft, ...zipperedRight];
}

/**
 * Calculates the target MIDI note for a diatonic transposition.
 * @param currentMidi - The current MIDI note number.
 * @param delta - The shift amount (+1 for up, -1 for down).
 * @param keySignature - The active key signature string.
 * @param lut - Optional PCS LUT.
 * @returns The new MIDI note, clamped between 0 and 127.
 */
export function transposeDiatonically(currentMidi: number, delta: number, keySignature: string, lut?: any[]): number {
    const diatonicMap = getDiatonicMap(keySignature, lut);
    
    const scaleMidiNotes: number[] = [];
    for (let m = 0; m <= 127; m++) {
        if (diatonicMap.has(m % 12)) {
            scaleMidiNotes.push(m);
        }
    }

    if (scaleMidiNotes.length === 0) {
        return currentMidi;
    }

    let idx = scaleMidiNotes.indexOf(currentMidi);
    if (idx === -1) {
        let minDiff = Infinity;
        let closestIdx = 0;
        for (let i = 0; i < scaleMidiNotes.length; i++) {
            const diff = Math.abs(scaleMidiNotes[i] - currentMidi);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        idx = closestIdx;
    }

    const targetIdx = idx + delta;
    const finalIdx = Math.max(0, Math.min(scaleMidiNotes.length - 1, targetIdx));
    return scaleMidiNotes[finalIdx];
}

export function calculateWriteModePitch(
    stepOffset: number, 
    keySignature: string, 
    override: AccidentalOverride,
    lut?: any[]
): { midiNote: number, accidental: string | null } {
    const scaleStep = ((stepOffset % 7) + 7) % 7;
    const octaveOffset = Math.floor(stepOffset / 7);
    let targetOctave = 4 + octaveOffset;
    const basePCs = [0, 2, 4, 5, 7, 9, 11]; // Diatonic steps for C, D, E, F, G, A, B

    // 1. Handle Explicit User Overrides
    if (override) {
        const naturalPitch = ((targetOctave + 1) * 12) + basePCs[scaleStep];
        let offset = 0;
        let accGlyph = null;
        if (override === 'b') { offset = -1; accGlyph = SMuFL.accidentalFlat; }
        if (override === 'bb') { offset = -2; accGlyph = SMuFL.accidentalDoubleFlat; }
        if (override === 'n') { offset = 0; accGlyph = SMuFL.accidentalNatural; }
        if (override === '#') { offset = 1; accGlyph = SMuFL.accidentalSharp; }
        if (override === 'x') { offset = 2; accGlyph = SMuFL.accidentalDoubleSharp; }
        return { midiNote: Math.max(0, Math.min(127, naturalPitch + offset)), accidental: accGlyph };
    }

    // 2. Diatonic Fallback (Adaptive to Key)
    const diatonicMap = getDiatonicMap(keySignature, lut);
    let targetPC = 0;
    let diatonicAcc = null;
    for (const [pc, data] of diatonicMap.entries()) {
        if (data.step === scaleStep) {
            targetPC = pc;
            diatonicAcc = data.acc;
            break;
        }
    }

    // Reverse Octave Boundary Corrections for calculation
    if (targetPC === 11 && scaleStep === 0) targetOctave -= 1;
    if (targetPC === 0 && scaleStep === 6) targetOctave += 1;

    const diatonicMidi = ((targetOctave + 1) * 12) + targetPC;
    return { midiNote: Math.max(0, Math.min(127, diatonicMidi)), accidental: diatonicAcc };
}

export function getNoteNameFromPosition(
    stepOffset: number, 
    accidental: string | null, 
    keySignature: string,
    lut?: any[]
): string {
    const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const scaleStep = ((stepOffset % 7) + 7) % 7;
    const letter = letters[scaleStep];
    
    let accStr = '';
    if (accidental === SMuFL.accidentalSharp) accStr = '#';
    else if (accidental === SMuFL.accidentalFlat) accStr = 'b';
    else if (accidental === SMuFL.accidentalDoubleSharp) accStr = 'x';
    else if (accidental === SMuFL.accidentalDoubleFlat) accStr = 'bb';
    else if (accidental === SMuFL.accidentalNatural) accStr = '';
    else {
        // Fallback to diatonic accidental if null
        const diatonicMap = getDiatonicMap(keySignature, lut);
        for (const [_pc, data] of diatonicMap.entries()) {
            if (data.step === scaleStep) {
                if (data.acc === SMuFL.accidentalSharp) accStr = '#';
                if (data.acc === SMuFL.accidentalFlat) accStr = 'b';
                break;
            }
        }
    }
    return letter + accStr;
}

export const enforcePianoRange = (proposedNotes: number[], originalNotes: number[]): number[] => {
  // Check if ANY note in the proposed transformation falls off the 88-key piano
  const isOutOfBounds = proposedNotes.some(n => {
    const num = Number(n);
    return isNaN(num) || num < 21 || num > 108;
  });
  
  if (isOutOfBounds) {
    // If transforming an existing chord, reject the shift entirely to preserve voicing
    if (originalNotes.length > 0) {
      return originalNotes;
    }
    // Fallback for fresh live inputs: just strip the impossible notes
    const filtered = proposedNotes.map(n => Number(n)).filter(n => !isNaN(n) && n >= 21 && n <= 108);
    return Array.from(new Set(filtered)).sort((a, b) => a - b);
  }
  
  const cleaned = proposedNotes.map(n => Number(n)).filter(n => !isNaN(n));
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
};

