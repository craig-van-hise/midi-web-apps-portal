export type DegreeRotationArray = string[];

/**
 * Calculates the normalized pitch class distance from the global key center.
 */
export function getNormalizedDistance(lowNotePc: number, keyCenterPc: number): number {
  return (lowNotePc - keyCenterPc + 12) % 12;
}

// Internal mapping dictionaries for symmetrical chord degree rotations.
// Tritone: length 2
const TRITONE_MAP: Record<number, DegreeRotationArray> = {};
[1, 4, 6, 8, 9, 11].forEach(dist => { TRITONE_MAP[dist] = ["1", "b5"]; });
[0, 2, 3, 5, 7, 10].forEach(dist => { TRITONE_MAP[dist] = ["b5", "1"]; });

// Diminished 7th: length 4
const DIM_7TH_MAP: Record<number, DegreeRotationArray> = {};
[4, 6, 11].forEach(dist => { DIM_7TH_MAP[dist] = ["1", "b3", "b5", "bb7"]; });
[2, 7, 9].forEach(dist => { DIM_7TH_MAP[dist] = ["b3", "b5", "bb7", "1"]; });
[0, 5, 10].forEach(dist => { DIM_7TH_MAP[dist] = ["b5", "bb7", "1", "b3"]; });
[1, 3, 8].forEach(dist => { DIM_7TH_MAP[dist] = ["bb7", "1", "b3", "b5"]; });

// Augmented Triad: length 3
const AUG_TRIAD_MAP: Record<number, DegreeRotationArray> = {};
[0, 2, 5, 7].forEach(dist => { AUG_TRIAD_MAP[dist] = ["1", "3", "#5"]; });
[4, 6, 9, 11].forEach(dist => { AUG_TRIAD_MAP[dist] = ["3", "#5", "1"]; });
[1, 3, 8, 10].forEach(dist => { AUG_TRIAD_MAP[dist] = ["#5", "1", "3"]; });

/**
 * Intercepts spelling logic for symmetrical chords and returns the dynamically overridden rotation.
 */
export function getSymmetricalSpelling(
  decimal: number,
  lowNotePc: number,
  keyCenterPc: number
): DegreeRotationArray | null {
  const distance = getNormalizedDistance(lowNotePc, keyCenterPc);

  if (decimal === 65) return TRITONE_MAP[distance] || null;
  if (decimal === 585) return DIM_7TH_MAP[distance] || null;
  if (decimal === 273) return AUG_TRIAD_MAP[distance] || null;

  return null;
}
