/**
 * Octave Wrap: Folds out-of-range notes by shifting them up or down by octaves until they fit.
 * If the note cannot fit within the min/max range even after octave shifting, it should be dropped.
 * 
 * @param {number} note - The MIDI note number to wrap.
 * @param {number} min - The minimum allowed MIDI note number (inclusive).
 * @param {number} max - The maximum allowed MIDI note number (inclusive).
 * @returns {{ finalNote: number, shouldDrop: boolean }} The resulting note and whether it should be dropped.
 */
export function octaveWrap(note, min, max) {
  let finalNote = note;
  let shouldDrop = false;

  if (finalNote < min || finalNote > max) {
    while (finalNote < min) finalNote += 12;
    while (finalNote > max) finalNote -= 12;
    if (finalNote < min || finalNote > max) {
      shouldDrop = true;
    }
  }

  return { finalNote, shouldDrop };
}

/**
 * Smart Wrap: Wraps out-of-bounds notes to the opposite end of the range, strictly locking to the same pitch class.
 * 
 * @param {number} note - The MIDI note number to wrap.
 * @param {number} min - The minimum allowed MIDI note number (inclusive).
 * @param {number} max - The maximum allowed MIDI note number (inclusive).
 * @returns {{ finalNote: number, shouldDrop: boolean }} The resulting note and whether it should be dropped.
 */
export function smartWrap(note, min, max) {
  let finalNote = note;
  let shouldDrop = false;

  if (finalNote < min || finalNote > max) {
    const pc = ((finalNote % 12) + 12) % 12;

    if (finalNote > max) {
      let wrapped = min - (min % 12) + pc;
      if (wrapped < min) wrapped += 12;

      if (wrapped <= max) {
        finalNote = wrapped;
      } else {
        shouldDrop = true;
      }
    } else if (finalNote < min) {
      let wrapped = max - (max % 12) + pc;
      if (wrapped > max) wrapped -= 12;

      if (wrapped >= min) {
        finalNote = wrapped;
      } else {
        shouldDrop = true;
      }
    }
  }

  return { finalNote, shouldDrop };
}
