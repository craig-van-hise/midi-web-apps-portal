
import { describe, it, expect } from 'vitest';
import { convertIntervalToPitchSpelling, getChordSpelling, getChordSymbol } from './chordSpeller';

describe('chordSpeller Interval Parsing', () => {
  it('should parse compound intervals correctly (9th)', () => {
    // Current logic should fail and return "invalid" or misspelling
    // convertIntervalToPitchSpelling("9", 0) -> 0 is C Major
    expect(convertIntervalToPitchSpelling("9", 0)).toBe("D");
  });

  it('should parse compound intervals correctly (#11th)', () => {
    expect(convertIntervalToPitchSpelling("#11", 0)).toBe("F#");
  });

  it('should parse compound intervals correctly (b13th)', () => {
    expect(convertIntervalToPitchSpelling("b13", 0)).toBe("Ab");
  });

  it('should spell Cmaj9 correctly', () => {
    // Mock LUT entry for Cmaj9 [60, 64, 67, 71, 74]
    // 60=C4, 64=E4, 67=G4, 71=B4, 74=D5
    const mockLut = new Array(4096).fill(null);
    mockLut[2193] = { // Example decimal for Cmaj9 transposed to 0
        decimal: 2193,
        chord_type: "maj9",
        root_pc: 0,
        chord_intervals: ["1", "3", "5", "7", "9"],
        base_triad: "maj",
        cardinality: 5,
        pitch_class_set: [0, 4, 7, 11, 14]
    };
    
    // psToDecimal calculation for [60, 64, 67, 71, 74]
    // PCs: 0, 4, 7, 11, 2
    // Relative to low note 0: 0, 4, 7, 11, 2
    // Decimal: 2^0 + 2^4 + 2^7 + 2^11 + 2^2 = 1 + 16 + 128 + 2048 + 4 = 2197
    // Wait, let me re-calculate decimal logic in psToDecimal
    // uniquePCs = [0, 2, 4, 7, 11]
    // 2^0 + 2^2 + 2^4 + 2^7 + 2^11 = 1 + 4 + 16 + 128 + 2048 = 2197
    
    mockLut[2197] = {
        decimal: 2197,
        chord_type: "maj9",
        root_pc: 0,
        chord_intervals: ["1", "3", "5", "7", "9"],
        base_triad: "maj",
        cardinality: 5,
        pitch_class_set: [0, 2, 4, 7, 11]
    };

    const spelling = getChordSpelling([60, 64, 67, 71, 74], "C Major", mockLut);
    expect(spelling[spelling.length - 1]).toBe("D");
  });

  it('should generate correct chord symbol for Em7b5', () => {
    // E4, G4, Bb4, D5 -> [64, 67, 70, 74]
    // PCs: 4, 7, 10, 2
    // Low note PC: 4
    // Relative PCs: (4-4)%12=0, (7-4)%12=3, (10-4)%12=6, (2-4+12)%12=10
    // Decimal: 2^0 + 2^3 + 2^6 + 2^10 = 1 + 8 + 64 + 1024 = 1097
    
    const mockLut = new Array(4096).fill(null);
    mockLut[1097] = {
        decimal: 1097,
        chord_type: "m7b5",
        root_pc: 0, // Root is the low note
        chord_intervals: ["1", "b3", "b5", "b7"],
        base_triad: "dim",
        cardinality: 4,
        pitch_class_set: [0, 3, 6, 10]
    };

    const symbol = getChordSymbol([64, 67, 70, 74], "C Major", mockLut);
    expect(symbol).toBe("Em7b5");
  });

  it('should spell Major 2nd (decimal 5) as flat-side (Bb, C) in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[5] = {
        decimal: 5,
        chord_type: "M2",
        root_pc: 0, 
        chord_intervals: ["1", "2"],
        base_triad: "other",
        cardinality: 2,
        pitch_class_set: [0, 2]
    };

    const spelling = getChordSpelling([58, 60], "C Major", mockLut);
    expect(spelling).toEqual(["Bb", "C"]);
  });

  it('should spell Perfect 4th (decimal 33) as flat-side (Db, Gb) in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[33] = {
        decimal: 33,
        chord_type: "P4",
        root_pc: 0, 
        chord_intervals: ["1", "4"],
        base_triad: "other",
        cardinality: 2,
        pitch_class_set: [0, 5]
    };

    const spelling = getChordSpelling([61, 66], "C Major", mockLut);
    expect(spelling).toEqual(["Db", "Gb"]);
  });

  it('should spell Perfect 4th on tritone (decimal 33, rootPCN 6) as sharp-side (F#, B) in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[33] = {
        decimal: 33,
        chord_type: "P4",
        root_pc: 0, 
        chord_intervals: ["1", "4"],
        base_triad: "other",
        cardinality: 2,
        pitch_class_set: [0, 5]
    };

    // MIDI [66, 71] -> PCs [6, 11]
    // Low note PC: 6 (F#/Gb)
    // Relative PCs: (6-6)=0, (11-6)=5
    // Decimal: 2^0 + 2^5 = 33
    // In C Major, rootPCN = (6 - 0) = 6
    const spelling = getChordSpelling([66, 71], "C Major", mockLut);
    expect(spelling).toEqual(["F#", "B"]);
  });

  it('should spell Fb major triad (MIDI 64, 68, 71) correctly as [Fb, Ab, Cb] in Eb Major', () => {
    const mockLut = new Array(4096).fill(null);
    // MIDI [64, 68, 71] -> PCs [4, 8, 11]
    // Low note PC: 4 (E/Fb)
    // Relative PCs: (4-4)=0, (8-4)=4, (11-4)=7
    // Decimal: 2^0 + 2^4 + 2^7 = 1 + 16 + 128 = 145
    mockLut[145] = {
        decimal: 145,
        chord_type: "maj",
        root_pc: 0, 
        chord_intervals: ["1", "3", "5"],
        base_triad: "maj",
        cardinality: 3,
        pitch_class_set: [0, 4, 7]
    };

    const spelling = getChordSpelling([64, 68, 71], "Eb Major", mockLut);
    expect(spelling).toEqual(["Fb", "Ab", "Cb"]);
  });

  it('should spell minor 3rd on b3 and b7 (decimal 9, rootPCN 3/10) as flat-side in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[9] = {
        decimal: 9,
        chord_type: "m3",
        root_pc: 0, 
        chord_intervals: ["1", "b3"],
        base_triad: "other",
        cardinality: 2,
        pitch_class_set: [0, 3]
    };

    // Case 1: rootPCN 3 (b3) -> [63, 66]
    const spelling1 = getChordSpelling([63, 66], "C Major", mockLut);
    expect(spelling1).toEqual(["Eb", "Gb"]);

    // Case 2: rootPCN 10 (b7) -> [70, 73]
    const spelling2 = getChordSpelling([70, 73], "C Major", mockLut);
    expect(spelling2).toEqual(["Bb", "Db"]);

    // Case 3 (Control): rootPCN 1 (#1) -> [61, 64]
    const spelling3 = getChordSpelling([61, 64], "C Major", mockLut);
    expect(spelling3).toEqual(["C#", "E"]);
  });

  it('should spell minor 7th on b3 and b7 (decimal 1025, rootPCN 3/10) as flat-side in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[1025] = {
        decimal: 1025,
        chord_type: "m7",
        root_pc: 0, 
        chord_intervals: ["1", "b7"],
        base_triad: "other",
        cardinality: 2,
        pitch_class_set: [0, 10]
    };

    // Case 1: rootPCN 3 (b3) -> [63, 73]
    const spelling1 = getChordSpelling([63, 73], "C Major", mockLut);
    expect(spelling1).toEqual(["Eb", "Db"]);

    // Case 2: rootPCN 10 (b7) -> [70, 80]
    const spelling2 = getChordSpelling([70, 80], "C Major", mockLut);
    expect(spelling2).toEqual(["Bb", "Ab"]);

    // Case 3 (Control): rootPCN 1 (#1) -> [61, 71]
    const spelling3 = getChordSpelling([61, 71], "C Major", mockLut);
    expect(spelling3).toEqual(["C#", "B"]);
  });

  it('should spell m7(no5) in 3rd inversion (decimal 37) with sharps when root is #4 or #5 in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[37] = {
        decimal: 37,
        chord_type: "m7(no5)",
        root_pc: 2, // F# is 2 semitones above E (low note)
        chord_intervals: ["b7", "1", "b3"], // Intervals relative to root F#: E is b7, F# is 1, A is b3
        base_triad: "other",
        cardinality: 3,
        pitch_class_set: [0, 2, 5]
    };

    // Case 1: rootPCN 6 (#4) -> [64, 66, 69] (E, F#, A)
    const spelling1 = getChordSpelling([64, 66, 69], "C Major", mockLut);
    expect(spelling1).toEqual(["E", "F#", "A"]);

    // Case 2: rootPCN 8 (#5) -> [66, 68, 71] (F#, G#, B)
    const spelling2 = getChordSpelling([66, 68, 71], "C Major", mockLut);
    expect(spelling2).toEqual(["F#", "G#", "B"]);
  });

  it('should follow Minor Pattern (#1, b3, #4, #5, b7) for m-type chords', () => {
    const mockLut = new Array(4096).fill(null);
    // C#m(maj7) -> [61, 64, 68, 72] -> Decimal 2185
    mockLut[2185] = {
        decimal: 2185,
        chord_type: "m(maj7)",
        root_pc: 0,
        chord_intervals: ["1", "b3", "5", "7"],
        base_triad: "min",
        base_7th: 0,
        cardinality: 4,
        pitch_class_set: [0, 3, 7, 11]
    };

    const spelling = getChordSpelling([61, 64, 68, 72], "C Major", mockLut);
    expect(spelling).toEqual(["C#", "E", "G#", "B#"]);
  });

  it('should follow Dominant Pattern (b2, b3, #4, b6, b7) for 7th-type chords', () => {
    const mockLut = new Array(4096).fill(null);
    // Db7 -> [61, 65, 68, 71] -> Decimal 1169
    mockLut[1169] = {
        decimal: 1169,
        chord_type: "7",
        root_pc: 0,
        chord_intervals: ["1", "3", "5", "b7"],
        base_triad: "maj",
        base_7th: 7,
        cardinality: 4,
        pitch_class_set: [0, 4, 7, 10]
    };

    const spelling = getChordSpelling([61, 65, 68, 71], "C Major", mockLut);
    expect(spelling).toEqual(["Db", "F", "Ab", "Cb"]);

    // Bbm7 -> [70, 73, 77, 80] -> Rel PCs [0, 3, 7, 10] -> Decimal 1161 (already in MINOR_PATTERN_DECIMALS)
    mockLut[1161] = {
        decimal: 1161,
        chord_type: "m7",
        root_pc: 0,
        chord_intervals: ["1", "b3", "5", "b7"],
        base_triad: "min",
        base_7th: 7,
        cardinality: 4,
        pitch_class_set: [0, 3, 7, 10]
    };
    const spelling2 = getChordSpelling([70, 73, 77, 80], "C Major", mockLut);
    expect(spelling2).toEqual(["Bb", "Db", "F", "Ab"]);

    // Ab7 -> [68, 72, 75, 78] -> Rel PCs [0, 4, 7, 10] -> Decimal 1169
    const spelling3 = getChordSpelling([68, 72, 75, 78], "C Major", mockLut);
    expect(spelling3).toEqual(["Ab", "C", "Eb", "Gb"]);
  });

  it('should spell minor 6th on b7 (decimal 257, rootPCN 10) as flat-side in C Major', () => {
    const mockLut = new Array(4096).fill(null);
    mockLut[257] = {
        decimal: 257,
        chord_type: "m6",
        root_pc: 0, 
        chord_intervals: ["1", "b6"],
        base_triad: "other",
        base_7th: 0,
        cardinality: 2,
        pitch_class_set: [0, 8]
    };

    // Case 1: rootPCN 10 (b7) -> [70, 78]
    const spelling1 = getChordSpelling([70, 78], "C Major", mockLut);
    expect(spelling1).toEqual(["Bb", "Gb"]);

    // Case 2 (Control): rootPCN 2 (2) -> [62, 70]
    const spelling2 = getChordSpelling([62, 70], "C Major", mockLut);
    // Root is 2 (D). Rel PCs [0, 8].
    // Interval "b6" of D is Bb.
    expect(spelling2).toEqual(["D", "Bb"]);
  });

  describe('Phase 47: m2, Dorian, and Phrygian Rules', () => {
    it('Test Case 1 (m2 - Sharp): m2 should be sharp (C#) when out of key context', () => {
      const mockLut = new Array(4096).fill(null);
      mockLut[3] = {
          decimal: 3,
          chord_type: "m2",
          root_pc: 0,
          chord_intervals: ["1", "b2"],
          base_triad: "other",
          cardinality: 2,
          pitch_class_set: [0, 1]
      };
      // MIDI [61, 62] -> PCs [1, 2]. Root is 1. rootPCN = 1.
      const spelling = getChordSpelling([61, 62], "C Major", mockLut);
      expect(spelling[0]).toBe("C#");
    });

    it('Test Case 2 (Dorian - Minor Pattern): Dorian should follow Minor Pattern (#1)', () => {
      const mockLut = new Array(4096).fill(null);
      mockLut[653] = {
          decimal: 653,
          chord_type: "Dorian5",
          root_pc: 0,
          chord_intervals: ["1", "2", "b3", "5", "6"],
          base_triad: "min",
          cardinality: 5,
          pitch_class_set: [0, 2, 3, 5, 7]
      };
      // [61, 64, 68, 70, 75] -> PCs [1, 4, 8, 10, 3]. Root is 1. rootPCN = 1.
      const spelling = getChordSpelling([61, 64, 68, 70, 75], "C Major", mockLut);
      expect(spelling[0]).toBe("C#");
    });

    it('Test Case 3 (Phrygian - Sharp Pattern): Phrygian should resolve to sharp mapping (#1)', () => {
      const mockLut = new Array(4096).fill(null);
      mockLut[171] = {
          decimal: 171,
          chord_type: "Phrygian5",
          root_pc: 0,
          chord_intervals: ["1", "b2", "b3", "4", "5"],
          base_triad: "other",
          cardinality: 5,
          pitch_class_set: [0, 1, 3, 5, 7]
      };
      // [61, 62, 64, 66, 68] -> PCs [1, 2, 4, 6, 8]. Root is 1. rootPCN = 1.
      const spelling = getChordSpelling([61, 62, 64, 66, 68], "C Major", mockLut);
      expect(spelling[0]).toBe("C#");
    });
  });

  describe('Phase 48: Double Accidental Inheritance', () => {
    it('Test Case 1 (Bbb Major in Db Major): Notes should inherit double flats', () => {
      const mockLut = new Array(4096).fill(null);
      mockLut[145] = {
          decimal: 145,
          chord_type: "maj",
          root_pc: 0,
          chord_intervals: ["1", "3", "5"],
          base_triad: "maj",
          cardinality: 3,
          pitch_class_set: [0, 4, 7]
      };
      // [69, 73, 76] -> PCs [9, 1, 4]. Root PC: 9. rootPCN relative to Db (1) is 8.
      // b6 of Db is Bbb. Major triad on Bbb is Bbb, Db, Fb.
      const spelling = getChordSpelling([69, 73, 76], "Db Major", mockLut);
      expect(spelling).toEqual(["Bbb", "Db", "Fb"]);
    });

    it('Test Case 2 (Fx°7 in G# Major): Notes should inherit double sharps', () => {
      const mockLut = new Array(4096).fill(null);
      mockLut[585] = {
          decimal: 585,
          chord_type: "°7",
          root_pc: 0,
          chord_intervals: ["1", "b3", "b5", "bb7"],
          base_triad: "dim",
          cardinality: 4,
          pitch_class_set: [0, 3, 6, 9]
      };
      // [67, 70, 73, 76] -> PCs [7, 10, 1, 4]. Root PC: 7. rootPCN relative to G# (8) is 11.
      // 7th of G# Major is Fx. Dim7 on Fx is Fx, A#, C#, E.
      const spelling = getChordSpelling([67, 70, 73, 76], "G# Major", mockLut);
      expect(spelling).toEqual(["Fx", "A#", "C#", "E"]);
    });
  });

  describe('Phase 2 Symmetrical Speller Integration', () => {
    it('Test Case 1 (Tritone override based on low note in C Major): C Major (key 0) and low note E (PC 4, dist 4)', () => {
      const mockLut = new Array(4096).fill(null);
      // Tritone [64, 70] -> PCs [4, 10] -> Decimal 2^0 + 2^6 = 65 (rel to low note PC 4)
      mockLut[65] = {
          decimal: 65,
          chord_type: "tritone",
          root_pc: 0,
          chord_intervals: ["1", "b5"],
          base_triad: "other",
          cardinality: 2,
          pitch_class_set: [0, 6]
      };
      // For low note E (PC 4) in key C (keyCenterPc = 0), distance = 4. Tritone map for dist 4 gives ["1", "b5"].
      // Root PC is E. E relative to C is M3. E major scale degree 3 is E.
      // So spelling should be ["E", "Bb"].
      const spellingE = getChordSpelling([64, 70], "C Major", mockLut, undefined, 0);
      expect(spellingE).toEqual(["E", "Bb"]);

      // For low note F (PC 5) in key C, distance = 5. Tritone map for dist 5 gives ["b5", "1"].
      // Root idx is 1, so B is the root. B relative to C is M7. B major scale degree 7 is B.
      // So spelling should be ["F", "B"].
      // [65, 71] -> PCs [5, 11] -> Decimal 65
      const spellingF = getChordSpelling([65, 71], "C Major", mockLut, undefined, 0);
      expect(spellingF).toEqual(["F", "B"]);
    });

    it('Test Case 2 (Minor Triad bypasses symmetrical speller and resolves standard LUT spelling)', () => {
      const mockLut = new Array(4096).fill(null);
      // D minor triad [62, 65, 69] -> PCs [2, 5, 9] -> Rel PCs [0, 3, 7] -> Decimal 145
      mockLut[145] = {
          decimal: 145,
          chord_type: "m",
          root_pc: 0,
          chord_intervals: ["1", "b3", "5"],
          base_triad: "min",
          cardinality: 3,
          pitch_class_set: [0, 3, 7]
        };
      const spelling = getChordSpelling([62, 65, 69], "C Major", mockLut, undefined, 0);
      expect(spelling).toEqual(["D", "F", "A"]);
    });

    it('TDD Checkpoint - Test Case 1: Tritone [64, 70] (E, Bb) in C Major', () => {
      const mockLut = new Array(4096).fill(null);
      // Tritone [64, 70] -> PCs [4, 10] -> Decimal 2^0 + 2^6 = 65 (rel to low note PC 4)
      mockLut[65] = {
          decimal: 65,
          chord_type: "tritone",
          root_pc: 0,
          chord_intervals: ["1", "b5"],
          base_triad: "other",
          cardinality: 2,
          pitch_class_set: [0, 6]
      };
      const spelling = getChordSpelling([64, 70], "C Major", mockLut, undefined, 0);
      expect(spelling).toEqual(["E", "Bb"]);
    });

    it('TDD Checkpoint - Test Case 2: Diminished 7th [59, 62, 65, 68] (B, D, F, Ab) in C Major', () => {
      const mockLut = new Array(4096).fill(null);
      // Diminished 7th [59, 62, 65, 68] -> PCs [11, 2, 5, 8] -> rel to low note PC 11:
      // (11-11)%12 = 0, (2-11+12)%12 = 3, (5-11+12)%12 = 6, (8-11+12)%12 = 9.
      // Decimal: 2^0 + 2^3 + 2^6 + 2^9 = 1 + 8 + 64 + 512 = 585
      mockLut[585] = {
          decimal: 585,
          chord_type: "dim7",
          root_pc: 0,
          chord_intervals: ["1", "b3", "b5", "bb7"],
          base_triad: "dim",
          cardinality: 4,
          pitch_class_set: [0, 3, 6, 9]
      };
      const spelling = getChordSpelling([59, 62, 65, 68], "C Major", mockLut, undefined, 0);
      expect(spelling).toEqual(["B", "D", "F", "Ab"]);
    });

    it('TDD Checkpoint - Test Case 3: Tritone [60, 66] (C, Gb) in Gb Major', () => {
      const mockLut = new Array(4096).fill(null);
      mockLut[65] = {
          decimal: 65,
          chord_type: "tritone",
          root_pc: 0,
          chord_intervals: ["1", "b5"],
          base_triad: "other",
          cardinality: 2,
          pitch_class_set: [0, 6]
      };
      const spelling = getChordSpelling([60, 66], "Gb Major", mockLut, undefined, 6);
      expect(spelling).toEqual(["C", "Gb"]);
    });
  });
});
