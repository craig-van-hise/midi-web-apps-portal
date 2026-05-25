export type FilterMode = 'block' | 'octave_wrap' | 'wrap' | 'limit';

export function processNote(note: number, min: number, max: number, mode: FilterMode): number | null {
  if (note >= min && note <= max) {
    return note; // In range, no processing needed
  }

  // Handle case where range is invalid (min > max) -> should theoretically be blocked by UI, but guard here
  if (min > max) return null;

  switch (mode) {
    case 'block':
      return null;

    case 'limit':
      if (note < min) return min;
      if (note > max) return max;
      return note;

    case 'octave_wrap': {
      // Shift by exactly octaves (12) until inside the range, as close as possible.
      let outNote = note;
      if (outNote > max) {
        while (outNote > max) outNote -= 12;
      } else if (outNote < min) {
        while (outNote < min) outNote += 12;
      }
      
      // If after shifting, it falls below min (when shifting down) or above max (when shifting up),
      // it means the range is less than an octave wide and does not contain this pitch class.
      // E.g., min=60, max=64, note=77 -> 77-12=65 (> max). 65-12 = 53 (< min). Thus it missed the range.
      if (outNote < min || outNote > max) return null;
      return outNote;
    }

    case 'wrap': {
      // Wrap to the *furthest* available octave on the opposite side of the range.
      // If note > max, drop to the LOWEST available octave in the range matching pitch class.
      // If note < min, jump to the HIGHEST available octave in the range matching pitch class.
      const pitchClass = note % 12;
      
      if (note > max) {
        // Find the lowest note in the range with this pitch class
        // Start from min, find first note with matching pitch class
        const diff = (pitchClass - (min % 12) + 12) % 12;
        const lowestMatch = min + diff;
        if (lowestMatch <= max) return lowestMatch;
        return null;
      } else { // note < min
        // Find the highest note in the range with this pitch class
        // Start from max, go downwards
        const diff = ((max % 12) - pitchClass + 12) % 12;
        const highestMatch = max - diff;
        if (highestMatch >= min) return highestMatch;
        return null;
      }
    }

    default:
      return null;
  }
}
