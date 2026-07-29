// src/plugins/chord-notator/utils/notationMath.ottava.test.ts
import { describe, test, expect } from 'vitest';
import { calculateWriteModePitch } from './notationMath';

describe('notationMath - Write Mode Ottava Pitch Calculation', () => {
  const lutFixture = [null]; // Diatonic C Major fallback

  test('Test Case 1 (8va Treble Staff Click): trebleShift = -7, visualStep = 9 (E5 space)', () => {
    // Visual step 9 corresponds to E5. With 8va active (trebleShift = -7),
    // the effective musical step is 9 - (-7) = 16 (E6).
    const result = calculateWriteModePitch(9, 'C Major', null, lutFixture, -7);
    expect(result.midiNote).toBe(88); // E6
    expect(result.accidental).toBeNull();
  });

  test('Test Case 2 (8vb Bass Staff Click): bassShift = 7, visualStep = -14 (musical step -21 = C1)', () => {
    // Effective musical step: -14 - 7 = -21 (C1, MIDI 24)
    const result = calculateWriteModePitch(-14, 'C Major', null, lutFixture, 7);
    expect(result.midiNote).toBe(24); // C1
    expect(result.accidental).toBeNull();
  });
});
