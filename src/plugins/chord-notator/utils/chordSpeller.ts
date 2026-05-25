
import { SMuFL, getEnharmonicSpelling } from './notationMath';
import { getSymmetricalSpelling } from './symmetricalSpeller';

/**
 * PCS_LUT Entry structure based on the provided JSON
 */
export interface PCS_Entry {
    decimal: number;
    chord_type: string;
    root_pc: number;
    chord_intervals: string[];
    base_triad: string;
    base_7th: number;
    cardinality: number;
    pitch_class_set: number[];
}

/**
 * Key definitions for KeySigPC mapping
 */
export const KEY_SIG_MAP: Record<string, number> = {
    "C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
    "F#": 12, "C#": 13, "G#": 14, "D#": 15, "A#": 16
};

export const KEY_NAME_MAP: Record<number, string> = Object.fromEntries(
    Object.entries(KEY_SIG_MAP).map(([name, pc]) => [pc, name])
);

/**
 * Mapping of Pitch Names to Pitch Classes
 */
export const PITCH_TO_PC: Record<string, number> = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "E#": 5, "Fb": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11, "B#": 0, "Cb": 11,
    "Bbb": 9, "Ebb": 2, "Abb": 7, "Dbb": 0, "Gbb": 5, "Cbb": 10, "Fbb": 3,
    "Fx": 7, "Cx": 2, "Gx": 9, "Dx": 4, "Ax": 11, "Ex": 6, "Bx": 1
};

const MINOR_PATTERN_DECIMALS = new Set([3,7,9,13,15,19,27,31,37,41,45,63,91,109,127,137,139,141,169,173,201,203,205,219,255,257,275,283,289,297,301,305,353,397,417,425,429,433,511,517,529,533,537,549,565,579,603,641,651,653,657,683,685,713,715,717,731,769,785,795,805,835,867,1023,1025,1027,1033,1035,1037,1059,1067,1069,1153,1157,1161,1163,1165,1193,1195,1197,1225,1227,1229,1283,1307,1313,1315,1325,1419,1421,1441,1449,1451,1453,1539,1547,1549,1553,1571,1579,1581,1669,1673,1675,1677,1705,1707,1709,1737,1739,1741,1755,2047,2051,2057,2061,2093,2117,2185,2187,2189,2217,2219,2221,2249,2251,2253,2337,2441,2445,2469,2473,2475,2477,2561,2573,2577,2597,2613,2697,2701,2729,2733,2761,2765,2817,2853,3073,4095]);
const DOMINANT_PATTERN_DECIMALS = new Set([69,101,321,357,1041,1043,1049,1051,1075,2369,2401]);
const PHRYGIAN_PATTERN_DECIMALS = new Set([11,43,171,1377,1537,2053]);

/**
 * Diatonic base names for interval calculation
 */
const DIATONIC_NAMES = ["C", "D", "E", "F", "G", "A", "B"];
const DIATONIC_PC = [0, 2, 4, 5, 7, 9, 11];

/**
 * Helper to convert Pitch Set to Decimal (sum of 2^pc)
 * Important: The LUT indexes sets transposed to start at 0.
 */
export function psToDecimal(ps: number[]): number {
    const sortedPS = [...ps].sort((a, b) => a - b);
    if (sortedPS.length === 0) return 0;
    const lowNotePC = sortedPS[0] % 12;
    const uniquePCs = Array.from(new Set(sortedPS.map(p => (p % 12 - lowNotePC + 12) % 12))).sort((a, b) => a - b);
    return uniquePCs.reduce((sum, pc) => sum + Math.pow(2, pc), 0);
}

/**
 * Programmatic Interval to Pitch Spelling
 */
export function convertIntervalToPitchSpelling(interval: string, keySigPC: number): string {
    const keyRootName = KEY_NAME_MAP[keySigPC] || "C";
    const keyRootPC = PITCH_TO_PC[keyRootName.substring(0, 2)] ?? PITCH_TO_PC[keyRootName[0]];
    
    const match = interval.match(/^([b#x]*)(\d+)$/);
    if (!match) return "invalid";
    
    const accidental = match[1];
    const degree = parseInt(match[2], 10);
    const simpleDegree = ((degree - 1) % 7) + 1;
    
    const majorSteps = [0, 2, 4, 5, 7, 9, 11];
    const baseSemitones = majorSteps[simpleDegree - 1];
    
    let offset = 0;
    if (accidental === "b") offset = -1;
    else if (accidental === "bb") offset = -2;
    else if (accidental === "#") offset = 1;
    else if (accidental === "x") offset = 2;
    
    const targetSemitones = (baseSemitones + offset) % 12;
    const targetPC = (keyRootPC + targetSemitones + 12) % 12;
    
    const keyRootLetter = keyRootName[0];
    const keyRootLetterIndex = DIATONIC_NAMES.indexOf(keyRootLetter);
    const targetLetterIndex = (keyRootLetterIndex + simpleDegree - 1) % 7;
    const targetLetter = DIATONIC_NAMES[targetLetterIndex];
    const targetLetterPC = DIATONIC_PC[targetLetterIndex];
    
    let diff = (targetPC - targetLetterPC + 12) % 12;
    if (diff > 6) diff -= 12;
    
    let finalAccidental = "";
    if (diff === 1) finalAccidental = "#";
    else if (diff === 2) finalAccidental = "x";
    else if (diff === -1) finalAccidental = "b";
    else if (diff === -2) finalAccidental = "bb";
    
    return targetLetter + finalAccidental;
}

function getChromaticRootInterval(rootPCN: number, cardinality: number, decimal: number, triadQuality: string): string {
    const chromaticIntervals: Record<number, string[]> = {
        1: ["b2", "#1"], 3: ["b3", "#2"], 6: ["b5", "#4"],
        8: ["b6", "#5"], 10: ["b7", "#6"]
    };

    if (cardinality === 1) return chromaticIntervals[rootPCN][0];

    if (cardinality === 2) {
        if (decimal === 33 && rootPCN === 6) {
            return chromaticIntervals[rootPCN][1];
        }
        if ((decimal === 9 || decimal === 1025) && (rootPCN === 3 || rootPCN === 10)) {
            return chromaticIntervals[rootPCN][0];
        }
        if (decimal === 257 && rootPCN === 10) {
            return chromaticIntervals[rootPCN][0];
        }
        const check14679e = [5, 17, 33, 65, 129, 513, 2049];
        return check14679e.includes(decimal) ? chromaticIntervals[rootPCN][0] : chromaticIntervals[rootPCN][1];
    }

    if (cardinality > 2) {
        if (decimal === 37 && (rootPCN === 6 || rootPCN === 8)) {
            return chromaticIntervals[rootPCN][1];
        }

        if (MINOR_PATTERN_DECIMALS.has(decimal)) {
            const minMapping: Record<number, string> = { 1: "#1", 3: "b3", 6: "#4", 8: "#5", 10: "b7" };
            if (rootPCN in minMapping) return minMapping[rootPCN];
        }

        if (DOMINANT_PATTERN_DECIMALS.has(decimal)) {
            const domMapping: Record<number, string> = { 1: "b2", 3: "b3", 6: "#4", 8: "b6", 10: "b7" };
            if (rootPCN in domMapping) return domMapping[rootPCN];
        }

        if (PHRYGIAN_PATTERN_DECIMALS.has(decimal)) {
            return chromaticIntervals[rootPCN][1]; // Forces sharp-side enharmonics
        }

        const triadMappings: Record<string, Record<number, string>> = {
            "maj": { 1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7" },
            "min": { 1: "#1", 3: "b3", 6: "#4", 8: "b6", 10: "b7" },
            "dim": { 1: "#1", 3: "#2", 6: "#4", 8: "#5", 10: "#6" },
            "aug": { 1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7" },
            "sus4": { 1: "b2", 3: "b3", 6: "#4", 8: "b6", 10: "b7" },
            "other": { 1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7" },
            "chromatic": { 1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7" }
        };
        const mapping = triadMappings[triadQuality] || triadMappings["other"];
        return mapping[rootPCN] || "1";
    }
    return "1";
}

export function getRootSpellingFromKey(ps: number[], keySigPC: number, lut: (PCS_Entry | null)[], overrideRootPc?: number): string {
    const sortedPS = [...ps].sort((a, b) => a - b);
    const decimal = psToDecimal(sortedPS);
    const entry = lut[decimal];
    
    if (!entry) {
        console.warn("PCS entry not found for decimal:", decimal);
        return "C";
    }
    
    const lowPitch = sortedPS[0];
    const rootPC = overrideRootPc !== undefined ? overrideRootPc : ((entry.root_pc + lowPitch) % 12);
    const keyPC = PITCH_TO_PC[KEY_NAME_MAP[keySigPC]?.substring(0, 2) || "C"] ?? 0;
    
    let effectiveKeyPC = keyPC;
    if (keySigPC >= 12) {
        const auxMap: Record<number, number> = { 12: 6, 13: 1, 14: 8, 15: 3, 16: 10 };
        effectiveKeyPC = auxMap[keySigPC];
    }

    const rootPCN = (rootPC - effectiveKeyPC + 12) % 12;
    
    const naturalScaleIntervals: Record<number, string> = {
        0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7"
    };

    let rootInterval = naturalScaleIntervals[rootPCN];
    if (!rootInterval) {
        rootInterval = getChromaticRootInterval(rootPCN, entry.cardinality, decimal, entry.base_triad);
    }

    return convertIntervalToPitchSpelling(rootInterval, keySigPC);
}

function parseIntervalString(interval: string): [number, number] {
    const match = interval.match(/^([b#x]*)(\d+)$/);
    if (!match) return [1, 0];
    const accidental = match[1];
    const degree = parseInt(match[2], 10);
    let offset = 0;
    if (accidental === "b") offset = -1;
    else if (accidental === "bb") offset = -2;
    else if (accidental === "#") offset = 1;
    else if (accidental === "x") offset = 2;
    return [degree, offset];
}

export function sumIntervalStrings(a: string, b: string): string {
    const [degA, offA] = parseIntervalString(a);
    const [degB, offB] = parseIntervalString(b);
    
    const simpleDegA = ((degA - 1) % 7) + 1;
    const simpleDegB = ((degB - 1) % 7) + 1;
    const degSum = ((simpleDegA + simpleDegB - 2) % 7) + 1;
    
    const sharpOffsetPairs = [
        [2, 3], [3, 2], [3, 3], [2, 7], [7, 2], [3, 6], [6, 3], [3, 7], [7, 3],
        [5, 7], [7, 5], [6, 6], [6, 7], [7, 6], [7, 7]
    ];
    
    let offset = 0;
    if (sharpOffsetPairs.some(p => p[0] === simpleDegA && p[1] === simpleDegB)) {
        offset = 1;
    } else if (simpleDegA === 4 && simpleDegB === 4) {
        offset = -1;
    }
    
    const offSum = offA + offB + offset;
    
    let acc = "";
    if (offSum === 1) acc = "#";
    else if (offSum === 2) acc = "x";
    else if (offSum === -1) acc = "b";
    else if (offSum === -2) acc = "bb";
    
    return acc + degSum;
}

export function getChordSpelling(notes: any[], keySignature: string = "C Major", lut: (PCS_Entry | null)[], overrides?: Record<number, string>, keyCenterPc?: number): string[] {
    const keyName = keySignature.split(' ')[0];
    const keySigPC = KEY_SIG_MAP[keyName] ?? 0;
    
    // Normalize input to handle both number[] and objects
    const inputData = notes.map((n, i) => ({
        pitch: typeof n === 'number' ? n : n.note,
        originalIndex: i
    }));

    const sortedInput = [...inputData].sort((a, b) => a.pitch - b.pitch);
    const sortedPitches = sortedInput.map(d => d.pitch);
    
    const decimal = psToDecimal(sortedPitches);
    const entry = lut[decimal];

    let sortedSpellings: string[];

    if (!entry) {
        // Fallback: Use key-aware enharmonic spelling for individual notes
        sortedSpellings = sortedPitches.map(pitch => {
            const { stepOffset, accidental } = getEnharmonicSpelling(pitch, keySignature, lut);
            const letter = DIATONIC_NAMES[((stepOffset % 7) + 7) % 7];
            let acc = "";
            if (accidental === SMuFL.accidentalSharp) acc = "#";
            else if (accidental === SMuFL.accidentalDoubleSharp) acc = "x";
            else if (accidental === SMuFL.accidentalFlat) acc = "b";
            else if (accidental === SMuFL.accidentalDoubleFlat) acc = "bb";
            if (overrides && overrides[pitch]) return overrides[pitch];
            return letter + acc;
        });
    } else {
        const lowPitch = sortedPitches[0];
        const lowPitchPc = lowPitch % 12;

        let keyCenter = keyCenterPc;
        if (keyCenter === undefined) {
            let effectiveKeyPC = keySigPC;
            if (keySigPC >= 12) {
                const auxMap: Record<number, number> = { 12: 6, 13: 1, 14: 8, 15: 3, 16: 10 };
                effectiveKeyPC = auxMap[keySigPC];
            }
            keyCenter = effectiveKeyPC;
        }

        const symIntervals = getSymmetricalSpelling(decimal, lowPitchPc, keyCenter);

        let intervals = entry.chord_intervals;
        let overrideRootPc: number | undefined = undefined;

        if (symIntervals) {
            intervals = symIntervals;
            const rootIdx = symIntervals.indexOf("1");
            if (rootIdx !== -1) {
                overrideRootPc = sortedPitches[rootIdx] % 12;
            }
        }

        let psRootName: string = "";
        let spellingResolved = false;
        if (symIntervals && overrideRootPc !== undefined) {
            try {
                const rootPitchVal = sortedPitches.find(p => p % 12 === overrideRootPc);
                const rootMidi = rootPitchVal !== undefined ? rootPitchVal : (60 + overrideRootPc);
                const { stepOffset, accidental } = getEnharmonicSpelling(rootMidi, keySignature, lut);
                const letter = DIATONIC_NAMES[((stepOffset % 7) + 7) % 7];
                let acc = "";
                if (accidental === SMuFL.accidentalSharp) acc = "#";
                else if (accidental === SMuFL.accidentalDoubleSharp) acc = "x";
                else if (accidental === SMuFL.accidentalFlat) acc = "b";
                else if (accidental === SMuFL.accidentalDoubleFlat) acc = "bb";
                psRootName = letter + acc;
                spellingResolved = true;
            } catch (e) {
                // Fall back to getRootSpellingFromKey
            }
        }
        if (!spellingResolved) {
            psRootName = getRootSpellingFromKey(sortedPitches, keySigPC, lut, overrideRootPc);
        }
        const absoluteRootPC = overrideRootPc !== undefined ? overrideRootPc : ((entry.root_pc + lowPitch) % 12);
        const rootPitch = sortedPitches.find(p => p % 12 === absoluteRootPC);

        // 1. Force the Root Spelling if overridden
        if (rootPitch !== undefined && overrides && overrides[rootPitch]) {
            psRootName = overrides[rootPitch];
        }

        const rootRelKeyInterval = getIntervalBetweenPitches(keyName, psRootName);
        
        sortedSpellings = sortedPitches.map((pitch, idx) => {
            const pc = pitch % 12;
            const semitones = (pc - absoluteRootPC + 12) % 12;
            
            let toneInterval: string | null = null;
            if (symIntervals) {
                toneInterval = intervals[idx];
            } else {
                const majorSteps = [0, 2, 4, 5, 7, 9, 11];
                for (const interval of intervals) {
                     const [deg, off] = parseIntervalString(interval);
                     const simpleDeg = ((deg - 1) % 7) + 1;
                     if ((majorSteps[simpleDeg - 1] + off + 12) % 12 === semitones) {
                         toneInterval = interval;
                         break;
                     }
                }
            }
            
            if (toneInterval === null) {
                // Safety Fallback: If no match found in LUT intervals, use key-aware individual spelling
                const { stepOffset, accidental } = getEnharmonicSpelling(pitch, keySignature, lut);
                const letter = DIATONIC_NAMES[((stepOffset % 7) + 7) % 7];
                let acc = "";
                if (accidental === SMuFL.accidentalSharp) acc = "#";
                else if (accidental === SMuFL.accidentalDoubleSharp) acc = "x";
                else if (accidental === SMuFL.accidentalFlat) acc = "b";
                else if (accidental === SMuFL.accidentalDoubleFlat) acc = "bb";
                return letter + acc;
            }
            
            const absoluteInterval = sumIntervalStrings(toneInterval, rootRelKeyInterval);
            // 2. Force exact individual note spellings
            if (overrides && overrides[pitch]) return overrides[pitch];
            return convertIntervalToPitchSpelling(absoluteInterval, keySigPC);
        });
    }

    // Map back to original order
    const result = new Array(notes.length);
    sortedInput.forEach((data, i) => {
        result[data.originalIndex] = sortedSpellings[i];
    });
    return result;
}

function getIntervalBetweenPitches(referenceName: string, targetName: string): string {
    const referenceLetter = referenceName[0];
    const targetLetter = targetName[0];
    const referenceLetterIndex = DIATONIC_NAMES.indexOf(referenceLetter);
    const targetLetterIndex = DIATONIC_NAMES.indexOf(targetLetter);
    
    const degree = ((targetLetterIndex - referenceLetterIndex + 7) % 7) + 1;
    const referencePC = PITCH_TO_PC[referenceName] ?? PITCH_TO_PC[referenceName.substring(0, 2)] ?? PITCH_TO_PC[referenceName[0]];
    const targetPC = PITCH_TO_PC[targetName] ?? PITCH_TO_PC[targetName.substring(0, 2)] ?? PITCH_TO_PC[targetName[0]];
    
    const semitones = (targetPC - referencePC + 12) % 12;
    const majorSteps = [0, 2, 4, 5, 7, 9, 11];
    const diff = (semitones - majorSteps[degree - 1] + 12) % 12;
    
    let acc = "";
    if (diff === 1) acc = "#";
    else if (diff === 2) acc = "x";
    else if (diff === 11) acc = "b";
    else if (diff === 10) acc = "bb";
    
    return acc + degree;
}

/**
 * Maps pitch names to SMuFL glyphs and staff steps
 */
export function getSpellingData(midiNote: number, spelling: string): { stepOffset: number, accidental: string | null } {
    const letter = spelling[0];
    const accidentalPart = spelling.substring(1);
    const step = DIATONIC_NAMES.indexOf(letter);
    
    const baseOctave = Math.floor(midiNote / 12) - 1;
    const pitchClass = midiNote % 12;
    const targetLetterPC = DIATONIC_PC[step];
    
    let diatonicOctave = baseOctave;
    
    // Octave correction
    if (pitchClass === 11 && targetLetterPC === 0) diatonicOctave += 1;
    if (pitchClass === 0 && targetLetterPC === 11) diatonicOctave -= 1;
    
    const stepOffset = ((diatonicOctave - 4) * 7) + step;
    
    let accGlyph: string | null = null;
    if (accidentalPart === "#") accGlyph = SMuFL.accidentalSharp;
    else if (accidentalPart === "x") accGlyph = SMuFL.accidentalDoubleSharp;
    else if (accidentalPart === "b") accGlyph = SMuFL.accidentalFlat;
    else if (accidentalPart === "bb") accGlyph = SMuFL.accidentalDoubleFlat;
    
    return { stepOffset, accidental: accGlyph };
}

/**
 * Derives a chord symbol from the pitch set and LUT entry.
 */
export function getChordSymbol(ps: number[], keySignature: string = "C Major", lut: (PCS_Entry | null)[], overrides?: Record<number, string>, keyCenterPc?: number): string {
    const sortedPS = [...ps].sort((a, b) => a - b);
    if (sortedPS.length === 0) return "";
    
    const decimal = psToDecimal(sortedPS);
    const entry = lut[decimal];
    if (!entry) return "";

    const keyName = keySignature.split(' ')[0];
    const keySigPC = KEY_SIG_MAP[keyName] ?? 0;
    
    let keyCenter = keyCenterPc;
    if (keyCenter === undefined) {
        let effectiveKeyPC = keySigPC;
        if (keySigPC >= 12) {
            const auxMap: Record<number, number> = { 12: 6, 13: 1, 14: 8, 15: 3, 16: 10 };
            effectiveKeyPC = auxMap[keySigPC];
        }
        keyCenter = effectiveKeyPC;
    }

    const lowPitch = sortedPS[0];
    const lowPitchPc = lowPitch % 12;
    const symIntervals = getSymmetricalSpelling(decimal, lowPitchPc, keyCenter);

    let rootName: string;
    let absoluteRootPC: number;
    let isSymmetricalSlash = false;
    let bassSpelling = "";

    if (symIntervals) {
        const rootIdx = symIntervals.indexOf("1");
        if (rootIdx !== -1) {
            absoluteRootPC = sortedPS[rootIdx] % 12;
            const spellings = getChordSpelling(sortedPS, keySignature, lut, overrides, keyCenter);
            rootName = spellings[rootIdx];
            if (rootIdx !== 0) {
                isSymmetricalSlash = true;
                bassSpelling = spellings[0];
            }
        } else {
            absoluteRootPC = (entry.root_pc + lowPitch) % 12;
            rootName = getRootSpellingFromKey(sortedPS, keySigPC, lut);
        }
    } else {
        absoluteRootPC = (entry.root_pc + lowPitch) % 12;
        rootName = getRootSpellingFromKey(sortedPS, keySigPC, lut);
    }
    
    const rootPitch = sortedPS.find(p => p % 12 === absoluteRootPC);

    // Force the Root Spelling if overridden
    if (rootPitch !== undefined && overrides && overrides[rootPitch]) {
        rootName = overrides[rootPitch];
    }
    
    let symbol = rootName + entry.chord_type;
    
    // Slash notation if root_pc != 0 (meaning the low note is not the root)
    if (symIntervals) {
        if (isSymmetricalSlash) {
            // Force override injection for the bass note specifically
            const bassPitch = sortedPS[0];
            if (overrides && overrides[bassPitch]) {
                bassSpelling = overrides[bassPitch];
            }
            symbol += " / " + bassSpelling;
        }
    } else if (entry.root_pc !== 0) {
        // Find the spelling of the lowest note
        const spellings = getChordSpelling(sortedPS, keySignature, lut, overrides, keyCenter);
        let lowNoteSpelling = spellings[0];
        
        // CRITICAL: Force override injection for the bass note specifically
        const bassPitch = sortedPS[0];
        if (overrides && overrides[bassPitch]) {
            lowNoteSpelling = overrides[bassPitch];
        }
        
        symbol += " / " + lowNoteSpelling;
    }
    
    return symbol;
}
