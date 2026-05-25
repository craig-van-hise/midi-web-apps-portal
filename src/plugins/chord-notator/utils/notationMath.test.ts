import { describe, it, expect } from 'vitest';
import { getDiatonicMap, SMuFL, getEnharmonicSpelling, transposeDiatonically, enforcePianoRange } from './notationMath';

describe('Phase 1: Diatonic Scale Generator', () => {
    it('should generate Gb Major correctly (Test Case 1)', () => {
        const map = getDiatonicMap("Gb Major");
        // Gb Major has 6 flats: Bb, Eb, Ab, Db, Gb, Cb
        // Cb is pc 11 (B natural) but spelled as Cb (step 0, acc 'b')
        const cbValue = map.get(11);
        expect(cbValue).toBeDefined();
        expect(cbValue?.step).toBe(0);
        expect(cbValue?.acc).toBe(SMuFL.accidentalFlat);
    });

    it('should generate F# Major correctly (Test Case 2)', () => {
        const map = getDiatonicMap("F# Major");
        // F# Major has 6 sharps: F#, C#, G#, D#, A#, E#
        // E# is pc 5 (F natural) but spelled as E# (step 2, acc '#')
        const esValue = map.get(5);
        expect(esValue).toBeDefined();
        expect(esValue?.step).toBe(2);
        expect(esValue?.acc).toBe(SMuFL.accidentalSharp);
    });

    it('should generate C Major correctly', () => {
        const map = getDiatonicMap("C Major");
        expect(map.get(0)).toEqual({ step: 0, acc: null });
        expect(map.get(2)).toEqual({ step: 1, acc: null });
        expect(map.get(11)).toEqual({ step: 6, acc: null });
    });
});

describe('Phase 2: Octave Correction & Step Calculation', () => {
    it('should spell Cb4 correctly in Gb Major (Test Case 1)', () => {
        // MIDI 59 is B3
        const result = getEnharmonicSpelling(59, "Gb Major");
        expect(result.stepOffset).toBe(0); // Middle C ledger line
        expect(result.accidental).toBe(SMuFL.accidentalFlat);
    });

    it('should spell B#3 correctly in C# Major (Test Case 2)', () => {
        // MIDI 60 is C4
        const result = getEnharmonicSpelling(60, "C# Major");
        expect(result.stepOffset).toBe(-1); // B3 position
        expect(result.accidental).toBe(SMuFL.accidentalSharp);
    });

    it('should spell E#4 correctly in F# Major', () => {
        // MIDI 65 is F4
        const result = getEnharmonicSpelling(65, "F# Major");
        // F4 is stepOffset 3. E4 is stepOffset 2.
        expect(result.stepOffset).toBe(2);
        expect(result.accidental).toBe(SMuFL.accidentalSharp);
    });
});

describe('Phase 3: Chromatic Fallback Handling', () => {
    it('should spell C#4 correctly in C Major (Sharp bias)', () => {
        // MIDI 61 is C#/Db
        const result = getEnharmonicSpelling(61, "C Major");
        expect(result.stepOffset).toBe(0); // C
        expect(result.accidental).toBe(SMuFL.accidentalSharp);
    });

    it('should spell Db4 correctly in F Major (Flat bias)', () => {
        const result = getEnharmonicSpelling(61, "F Major");
        expect(result.stepOffset).toBe(1); // D
        expect(result.accidental).toBe(SMuFL.accidentalFlat);
    });

    it('should spell Fb4 correctly in Cb Major', () => {
        // MIDI 64 (E4) -> spelled as Fb4 (Step 3)
        // No octave shift needed. stepOffset = (4-4)*7 + 3 = 3 (F4 line)
        const result = getEnharmonicSpelling(64, "Cb Major");
        expect(result.stepOffset).toBe(3); 
    });

    it('should spell E#4 correctly in C# Major', () => {
        // MIDI 65 (F4) -> spelled as E#4 (Step 2)
        // No octave shift needed. stepOffset = (4-4)*7 + 2 = 2 (E4 line)
        const result = getEnharmonicSpelling(65, "C# Major");
        expect(result.stepOffset).toBe(2);
    });
});

describe('Phase 4: Diatonic Transposition Engine', () => {
    it('should transpose F4 (MIDI 65) up to G4 (MIDI 67) in C Major', () => {
        const result = transposeDiatonically(65, 1, "C Major");
        expect(result).toBe(67); // G4
    });

    it('should transpose Eb4 (MIDI 63) up to F4 (MIDI 65) in Eb Major (Enharmonic shift)', () => {
        const result = transposeDiatonically(63, 1, "Eb Major");
        expect(result).toBe(65); // F4
    });

    it('should transpose B4 (MIDI 71) up to C5 (MIDI 72) in C Major (Octave wrap)', () => {
        const result = transposeDiatonically(71, 1, "C Major");
        expect(result).toBe(72); // C5
    });

    it('should handle Cb4 (MIDI 59) in Cb Major (Octave correction)', () => {
        const result = transposeDiatonically(59, 0, "Cb Major");
        expect(result).toBe(59); // MIDI 59
    });

    it('should handle variable-cardinality scales (Major Pentatonic) correctly', () => {
        const mockLut = new Array(4096).fill(null);
        mockLut[661] = {
            decimal: 661,
            chord_type: "",
            root_pc: 0,
            cardinality: 5,
            base_triad: "",
            base_7th: 0,
            scale_intervals: ["1", "2", "3", "5", "6"],
            chord_intervals: ["1", "2", "3", "5", "6"],
            pitch_class_set: [0, 2, 4, 7, 9]
        };

        const map = getDiatonicMap("C Major Pentatonic", mockLut);
        expect(map.get(0)).toEqual({ step: 0, acc: null });
        expect(map.get(2)).toEqual({ step: 1, acc: null });
        expect(map.get(4)).toEqual({ step: 2, acc: null });
        expect(map.get(7)).toEqual({ step: 4, acc: null });
        expect(map.get(9)).toEqual({ step: 5, acc: null });

        // C4 (60) up 1 step -> D4 (62)
        expect(transposeDiatonically(60, 1, "C Major Pentatonic", mockLut)).toBe(62);
        // E4 (64) up 1 step -> G4 (67)
        expect(transposeDiatonically(64, 1, "C Major Pentatonic", mockLut)).toBe(67);
    });
});

describe('Phase 1: Math Utility Overhaul (enforcePianoRange)', () => {
    it('should allow valid shift (Test Case 1)', () => {
        const proposed = [60, 64, 67];
        const original = [48, 52, 55];
        const result = enforcePianoRange(proposed, original);
        expect(result).toEqual([60, 64, 67]);
    });

    it('should reject out of bounds transformation and block shift (Test Case 2)', () => {
        const proposed = [105, 109];
        const original = [93, 97];
        const result = enforcePianoRange(proposed, original);
        expect(result).toEqual([93, 97]);
    });

    it('should block deep out of bounds shifts (Test Case 3)', () => {
        const proposed = [8, 12, 15];
        const original = [20, 24, 27];
        const result = enforcePianoRange(proposed, original);
        expect(result).toEqual([20, 24, 27]);
    });

    it('should strip out of bounds notes for fresh input fallback (Test Case 4)', () => {
        const proposed = [20, 60];
        const original: number[] = [];
        const result = enforcePianoRange(proposed, original);
        expect(result).toEqual([60]);
    });
});

