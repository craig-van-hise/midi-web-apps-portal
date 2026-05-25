import { getSymmetricalSpelling } from './symmetricalSpeller';

describe('Symmetrical Speller mathematical logic', () => {
  it('Test Case 1 (Tritone Math): C Major (key 0) and low note E/F spelling rotations', () => {
    // low note E (PC 4), key C (0). Distance (4 - 0) = 4.
    // Tritone: E to Bb or F to B? Wait, pcsPrime is [0, 6] (Tritone).
    // For a Tritone [0, 6], getSymmetricalSpelling gets:
    // decimal = 65 (Tritone)
    // lowNotePc = 4, keyCenterPc = 0.
    const resE = getSymmetricalSpelling(65, 4, 0);
    expect(resE).toEqual(["1", "b5"]);

    // low note F (PC 5), key C (0). Distance (5 - 0) = 5.
    const resF = getSymmetricalSpelling(65, 5, 0);
    expect(resF).toEqual(["b5", "1"]);
  });

  it('Test Case 2 (Dim 7 Math - Modular Offset): F Major (key 5) and low note Bb (PC 10)', () => {
    // low note Bb (PC 10), key F (5). Distance = (10 - 5 + 12) % 12 = 5.
    // Diminished 7th: decimal = 585.
    const resBb = getSymmetricalSpelling(585, 10, 5);
    expect(resBb).toEqual(["b5", "bb7", "1", "b3"]);
  });

  it('Test Case 3 (Aug Triad Null): Major triad should return null', () => {
    const resMajor = getSymmetricalSpelling(145, 0, 0);
    expect(resMajor).toBeNull();
  });
});
