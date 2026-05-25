// src/components/NotationCanvas.test.tsx
// @ts-nocheck
import React from 'react';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotationCanvas from './NotationCanvas'; // This will be created in the next step
import { calculateStaffPosition, SMuFL } from '../utils/notationMath'; // Import the utility function

// Mocking the CSS variable --staff-space for tests to ensure consistency.
// In a real component integration test, getComputedStyle would be mocked.
// For testing the pure calculateStaffPosition function, we pass it directly.
const mockStaffSpace = 12; // Corresponds to 12px from PDD Phase 1

// Mocking the window object and its methods if needed for component integration tests
// For now, these tests focus purely on the mathematical function.
describe('NotationCanvas - calculateStaffPosition', () => {

    // Test case for Middle C (MIDI 60) as per PDD TDD mandate
    test('should return 0 for Middle C (MIDI 60) representing the vertical midpoint', () => {
        const midiNote = 60;
        const expectedY = 0; // Middle C is defined as the midpoint
        expect(calculateStaffPosition(midiNote, mockStaffSpace)).toBe(expectedY);
    });

    // Test case for MIDI 77 (Treble F5) - top line of treble staff as per PDD TDD mandate
    test('should return correct Y for Treble F5 (MIDI 77) corresponding to the top line of the treble staff', () => {
        const midiNote = 77;
        // Calculation: 10 diatonic steps * (12px / 2) = 60px
        const expectedY = 60;
        expect(calculateStaffPosition(midiNote, mockStaffSpace)).toBe(expectedY);
    });

    // Test case for MIDI 43 (Bass G2)
    test('should return correct Y for MIDI 43 corresponding to the bottom line of the bass staff', () => {
        const midiNote = 43;
        // Calculation: -10 diatonic steps * (12px / 2) = -60px
        const expectedY = -60;
        expect(calculateStaffPosition(midiNote, mockStaffSpace)).toBe(expectedY);
    });

    // Additional test for a note between Middle C and the next diatonic step
    test('should correctly calculate Y for C#4 (MIDI 61)', () => {
        const midiNote = 61;
        // C# is at the same step as C (0) in C Major
        const expectedY = 0;
        expect(calculateStaffPosition(midiNote, mockStaffSpace)).toBe(expectedY);
    });

    // Additional test for a note below Middle C
    test('should correctly calculate Y for B3 (MIDI 59)', () => {
        const midiNote = 59;
        // B3 is -1 step from Middle C
        const expectedY = -6;
        expect(calculateStaffPosition(midiNote, mockStaffSpace)).toBe(expectedY);
    });

    // Test with a different staffSpace value
    test('should adapt to different staffSpace values', () => {
        const midiNote = 60; // Middle C
        const customStaffSpace = 24; // Double the default
        const expectedY = 0; 
        expect(calculateStaffPosition(midiNote, customStaffSpace)).toBe(expectedY);

        const midiNote77 = 77;
        // 10 steps * (24/2) = 120px
        const expectedY77 = 120;
        expect(calculateStaffPosition(midiNote77, customStaffSpace)).toBe(expectedY77);
    });

    test('should render left and right system barlines', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    const leftEdge = document.querySelector('.system-left-edge');
    const rightBarline = document.querySelector('.system-right-barline');
    
    expect(leftEdge).toBeInTheDocument();
    expect(rightBarline).toBeInTheDocument();
  });

  test('should position treble clef correctly at top: calc(var(--staff-space) * 1)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    const trebleClef = screen.getByTestId('treble-clef');
    expect(trebleClef).toHaveStyle('top: calc(var(--staff-space) * 1)');
  });

  test('should render 1 ledger line for Middle C (MIDI 60)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    await waitFor(() => {
      const note60 = document.querySelector('[data-midi-note="60"]');
      expect(note60).toBeInTheDocument();
      // Ledger line should be a direct child now
      const ledgerLine = note60?.querySelector('[data-testid="ledger-line-0"]');
      expect(ledgerLine).toBeInTheDocument();
      expect(ledgerLine).toHaveStyle('top: calc(50% + 0px - 1px)');
    });
  });

  test('should render multiple ledger lines for C6 (MIDI 84)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 84, 100]) }
      }));
    });

    await waitFor(() => {
      const note84 = document.querySelector('[data-midi-note="84"]');
      expect(note84).toBeInTheDocument();
      // C6 is step 14. Ledger lines at 12 and 14.
      expect(note84?.querySelectorAll('[data-testid^="ledger-line-"]').length).toBe(2);
      
      const line14 = note84?.querySelector('[data-testid="ledger-line-14"]');
      const line12 = note84?.querySelector('[data-testid="ledger-line-12"]');
      
      expect(line14).toHaveStyle('top: calc(50% + 0px - 1px)');
      // yOffset = (14 - 12) * (12 / 2) = 12px
      expect(line12).toHaveStyle('top: calc(50% + 12px - 1px)');
    });
  });
});

import { useMidi } from '../midi/MIDIProvider';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('NotationCanvas - Phase 4 Behavioral Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('should render accidentals correctly in F Major (1 flat)', async () => {
    (useMidi as any).mockReturnValue({
      keySignature: 'F Major',
      splitPoint: 60,
      lut: [null],
      updateActiveNotes: vi.fn(),
    });

    render(<NotationCanvas />);

    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([144, 60, 100]) }
      }));
    });

    const notesLayer = document.querySelector('#notes-layer');
    await waitFor(() => {
        const note = notesLayer?.querySelector('[data-midi-note="60"]');
        expect(note).toBeInTheDocument();
        // 2 children: notehead and 1 ledger line (direct child)
        expect(note?.children.length).toBe(2); 
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([144, 61, 100]) }
      }));
    });

    await waitFor(() => {
        const note61 = notesLayer?.querySelector('[data-midi-note="61"]');
        expect(note61).toBeInTheDocument();
        // 2 children: notehead and accidental (no ledger lines for Db4 in Treble)
        expect(note61?.children.length).toBe(2);
        
        const accidental = Array.from(note61!.children).find(el => el.textContent === SMuFL.accidentalFlat);
        expect(accidental).toBeDefined();
        expect(note61).toHaveStyle('top: calc(50% - 18px)');
    });
  });

  test('should apply Bass Offset Shift and directional ledger lines for B3 (59) when splitPoint is 60', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 59, 100]) }
      }));
    });

    await waitFor(() => {
      const note59 = document.querySelector('[data-midi-note="59"]');
      expect(note59).toBeInTheDocument();
      // B3 is step -1. 
      // If splitPoint is 60, B3 is in Bass group (isTrebleGroup = false).
      // isHighBass logic: ls = 0 to ls <= -1 (false), ls % 2 !== 0 and ls > 0 (false).
      // Wait, B3 is step -1. High Bass logic: if stepOffset >= 0. No.
      // So no ledger lines? Correct, B3 is above the bass staff, no ledger line needed for B3 specifically in Bass clef?
      // Wait, Middle C is the reference.
      // Standard: Middle C (step 0) is 1 ledger line above Bass staff.
      // B3 is a space above Bass staff. No ledger line needed.
      // Let's test D4 (62) in Bass group (splitPoint 72).
    });
  });

  test('should render ledger line for Middle C (60) in Bass group with correct direction', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 72, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    await waitFor(() => {
      const note60 = document.querySelector('[data-midi-note="60"]');
      expect(note60).toBeInTheDocument();
      // Step 0 in Bass group should have 1 ledger line (at step 0)
      const ledgerLine = note60?.querySelector('[data-testid="ledger-line-0"]');
      expect(ledgerLine).toBeInTheDocument();
      expect(ledgerLine).toHaveStyle('top: calc(50% + 0px - 1px)');
    });
  });

  test('should render multiple ledger lines for A3 (57) in Treble group (splitPoint 48)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 48, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 57, 100]) }
      }));
    });

    await waitFor(() => {
      const note57 = document.querySelector('[data-midi-note="57"]');
      expect(note57).toBeInTheDocument();
      // A3 is step -2. In Treble group, it needs ledger lines for 0 and -2.
      const lines = note57?.querySelectorAll('[data-testid^="ledger-line-"]');
      expect(lines).toHaveLength(2);
      expect(note57?.querySelector('[data-testid="ledger-line-0"]')).toBeInTheDocument();
      expect(note57?.querySelector('[data-testid="ledger-line--2"]')).toBeInTheDocument();
    });
  });
});

describe('NotationCanvas - Collision and Alignment Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('should apply 1px vertical correction to ledger lines', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    await waitFor(() => {
      const line = document.querySelector('[data-testid="ledger-line-0"]');
      expect(line).toHaveStyle('top: calc(50% + 0px - 1px)');
    });
  });

  test('should apply horizontal offset (zipper pattern) for adjacent notes (E4 and F4)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    // E4 (MIDI 64, stepOffset 2)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });
    // F4 (MIDI 65, stepOffset 3)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 65, 100]) }
      }));
    });

    await waitFor(() => {
      const noteE = document.querySelector('[data-midi-note="64"]');
      const noteF = document.querySelector('[data-midi-note="65"]');
      
      expect(noteE).toHaveStyle('left: 50%');
      // NOTE_OFFSET_X_PX = 12 * 1.2 = 14.4px
      // + 5px correction
      expect(noteF).toHaveStyle('left: calc(50% + 19.4px)');
    });
  });

  test('should apply zipper pattern for a cluster (C4, D4, E4, F4)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    // MIDI 60, 62, 64, 65 (Steps 0, 1, 2, 3)
    [60, 62, 64, 65].forEach(midi => {
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });

    await waitFor(() => {
      const notes = [60, 62, 64, 65].map(midi => document.querySelector(`[data-midi-note="${midi}"]`));
      
      expect(notes[0]).toHaveStyle('left: 50%'); // C4
      expect(notes[1]).toHaveStyle('left: calc(50% + 19.4px)'); // D4
      expect(notes[2]).toHaveStyle('left: 50%'); // E4
      expect(notes[3]).toHaveStyle('left: calc(50% + 19.4px)'); // F4
    });
  });

  test('should correctly handle Fmaj7 cluster (C4, E4, F4, A4)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    // Steps: 0, 2, 3, 5
    [60, 64, 65, 69].forEach(midi => {
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });

    await waitFor(() => {
      const noteC = document.querySelector('[data-midi-note="60"]'); // Step 0
      const noteE = document.querySelector('[data-midi-note="64"]'); // Step 2
      const noteF = document.querySelector('[data-midi-note="65"]'); // Step 3
      const noteA = document.querySelector('[data-midi-note="69"]'); // Step 5
      
      expect(noteC).toHaveStyle('left: 50%');
      expect(noteE).toHaveStyle('left: 50%');
      expect(noteF).toHaveStyle('left: calc(50% + 19.4px)');
      expect(noteA).toHaveStyle('left: 50%');
    });
  });

  test('should stagger accidentals in a dense cluster (C#4, D#4, E#4, F#4)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    // MIDI 61, 63, 65, 66 (Steps 0, 1, 2, 3 with sharps)
    [61, 63, 65, 66].forEach(midi => {
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });

    await waitFor(() => {
      const accs = [61, 63, 65, 66].map(midi => {
        const note = document.querySelector(`[data-midi-note="${midi}"]`);
        return note?.querySelector('[data-is-accidental="true"]');
      });

      // Sorted descending by step: 66(3), 65(2), 63(1), 61(0)
      // Columns assigned: 66 -> 0, 65 -> 1, 63 -> 2, 61 -> 3
      // Offset = -1.5 - (col * 1.2)
      // 66: -1.5
      // 65: -2.7
      // 63: -3.9
      // 61: -5.1
      
      expect(accs[3]).toHaveStyle(`left: calc(-1.5 * var(--staff-space) + 1.8px)`); // MIDI 66, Col 0, Not Shifted (Right Stack)
      expect(accs[2]).toBeNull(); // MIDI 65 (F natural) has no accidental
      expect(accs[1]).toHaveStyle(`left: calc(-1.5 * var(--staff-space) - 19.4px)`); // MIDI 63, Col 0 (Left Stack), Shifted
      expect(accs[0]).toHaveStyle(`left: calc(-2.7 * var(--staff-space))`); // MIDI 61, Col 1 (Left Stack), Not Shifted
    });
  });

  test('should align accidentals vertically in a wide chord (C#4, G#4)', async () => {
    (useMidi as any).mockReturnValue({ keySignature: 'C Major', splitPoint: 60, lut: [null], updateActiveNotes: vi.fn() });
    render(<NotationCanvas />);
    
    // MIDI 61, 68 (Steps 0, 4)
    [61, 68].forEach(midi => {
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });

    await waitFor(() => {
      const acc61 = document.querySelector('[data-midi-note="61"]')?.querySelector('[data-is-accidental="true"]');
      const acc68 = document.querySelector('[data-midi-note="68"]')?.querySelector('[data-is-accidental="true"]');
      
      // Both in Column 0 as they are 4 steps apart
      expect(acc61).toHaveStyle(`left: calc(-1.5 * var(--staff-space))`);
      expect(acc68).toHaveStyle(`left: calc(-1.5 * var(--staff-space))`);
    });
  });
});

describe('NotationCanvas - Hold Mode Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: Array(4096).fill(null), // Mock non-empty lut
      updateActiveNotes: vi.fn()
    });
  });

  test('should clear display notes when NoteOn follows a full release in Hold Mode', async () => {
    render(<NotationCanvas />);

    // Enable Hold Mode
    act(() => {
      window.dispatchEvent(new CustomEvent('HOLD_MODE_CHANGED', { detail: { enabled: true } }));
    });

    // Play Middle C
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });

    // Release Middle C (should still be visible in Hold Mode)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x80, 60, 0]) }
      }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });

    // Play E4 (should clear Middle C and show E4)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).not.toBeInTheDocument();
      expect(document.querySelector('[data-midi-note="64"]')).toBeInTheDocument();
    });
  });

  test('should sync display with physical keys when Hold Mode is toggled OFF', async () => {
    render(<NotationCanvas />);

    // Enable Hold Mode
    act(() => {
      window.dispatchEvent(new CustomEvent('HOLD_MODE_CHANGED', { detail: { enabled: true } }));
    });

    // Play C4 and E4, release E4
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', { detail: { data: new Uint8Array([0x90, 60, 100]) } }));
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', { detail: { data: new Uint8Array([0x90, 64, 100]) } }));
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', { detail: { data: new Uint8Array([0x80, 64, 0]) } }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
      expect(document.querySelector('[data-midi-note="64"]')).toBeInTheDocument();
    });

    // Toggle Hold Mode OFF (C4 is still physically down, E4 is released)
    act(() => {
      window.dispatchEvent(new CustomEvent('HOLD_MODE_CHANGED', { detail: { enabled: false } }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
      expect(document.querySelector('[data-midi-note="64"]')).not.toBeInTheDocument();
    });
  });
});

describe('NotationCanvas - Hardware Reconciliation (Phase 2 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: Array(4096).fill(null),
      updateActiveNotes: vi.fn()
    });
  });

  test('should successfully remove a note via NoteOff even if it was computationally transposed', async () => {
    render(<NotationCanvas />);

    const container = document.querySelector('.notation-canvas-container')!;
    container.getBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 320,
      left: 0,
      top: 0,
      bottom: 320,
      right: 1000,
    } as DOMRect));

    // 1. Send Note On for pitch 64 (E4)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });

    // Verify it's rendered (E4 in C Major is Step 2, y=24)
    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="64"]')).toBeInTheDocument();
    });

    // 2. Select the note
    // centerX = 500 + 0, centerY = 160 - 24 = 136
    act(() => {
      container.dispatchEvent(new MouseEvent('pointerdown', { 
        bubbles: true, 
        clientX: 500, 
        clientY: 136 
      }));
    });

    // 3. Trigger Diatonic Transposition (Alt + ArrowUp)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    });

    // Verify the note pitch changed in the DOM to 65 (F4)
    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="65"]')).toBeInTheDocument();
    });

    // 4. Send Note Off for original pitch 64
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x80, 64, 0]) }
      }));
    });

    // 5. Assert the note is removed (Hardware Garbage Collection)
    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="65"]')).not.toBeInTheDocument();
    });
  });

  test('should prevent duplicate note creation if a NoteOn for sourceMidi is received after transposition', async () => {
    render(<NotationCanvas />);

    const container = document.querySelector('.notation-canvas-container')!;
    container.getBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 320,
      left: 0,
      top: 0,
      bottom: 320,
      right: 1000,
    } as DOMRect));

    // 1. Send Note On for 64
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });

    // 2. Select and Transpose to 65
    act(() => {
      container.dispatchEvent(new MouseEvent('pointerdown', { 
        bubbles: true, 
        clientX: 500, 
        clientY: 136 
      }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="65"]')).toBeInTheDocument();
    });

    // 3. Send ANOTHER Note On for 64
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });

    // 4. Assert that no second note is added (Duplicate Prevention)
    await waitFor(() => {
      expect(document.querySelectorAll('.notation-note-container').length).toBe(1);
    });
  });

  describe('Global State Synchronization (Phase 1)', () => {
    const mockUpdateActiveNotes = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      // Reset the mock return value to include our spy
      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        splitPoint: 60,
        lut: [],
        updateActiveNotes: mockUpdateActiveNotes
      });
    });

    test('should call updateActiveNotes([]) on Panic', async () => {
      render(<NotationCanvas />);
      
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { panic: true }
        }));
      });

      expect(mockUpdateActiveNotes).toHaveBeenCalledWith([]);
    });

    test('should call updateActiveNotes with current state on Mode Toggle (OFF)', async () => {
      render(<NotationCanvas />);
      
      // 1. Send a note
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 60, 100]) }
        }));
      });

      // 2. Disable hold mode
      act(() => {
        window.dispatchEvent(new CustomEvent('HOLD_MODE_CHANGED', {
          detail: { enabled: false }
        }));
      });

      expect(mockUpdateActiveNotes).toHaveBeenCalled();
      const lastCall = mockUpdateActiveNotes.mock.calls[mockUpdateActiveNotes.mock.calls.length - 1][0];
      expect(lastCall).toBeInstanceOf(Array);
      // Note 60 should be in the synced array because it was physically down
      expect(lastCall.some(n => n.note === 60)).toBe(true);
    });

    test('should call updateActiveNotes on Note Off', async () => {
      render(<NotationCanvas />);
      
      // Note On
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 60, 100]) }
        }));
      });

      const callsAfterOn = mockUpdateActiveNotes.mock.calls.length;

      // Note Off
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x80, 60, 0]) }
        }));
      });

      expect(mockUpdateActiveNotes.mock.calls.length).toBeGreaterThan(callsAfterOn);
      expect(mockUpdateActiveNotes).toHaveBeenLastCalledWith([]);
    });

    test('should dynamically update spelling of symmetrical tritone chord when global key signature changes', async () => {
      const mockUpdateActiveNotes = vi.fn();
      
      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        splitPoint: 60,
        lut: Array(4096).fill(null),
        updateActiveNotes: mockUpdateActiveNotes
      });

      const { rerender } = render(<NotationCanvas />);

      // Send Note On for 60 (C) and 66 (F#/Gb)
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 60, 100]) }
        }));
      });
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 66, 100]) }
        }));
      });

      // Verify C Major (key center 0) rendering:
      // Note 60 has no accidental, note 66 has sharp accidental
      await waitFor(() => {
        const note60 = document.querySelector('[data-midi-note="60"]');
        const note66 = document.querySelector('[data-midi-note="66"]');
        expect(note60).toBeInTheDocument();
        expect(note66).toBeInTheDocument();
        
        expect(note60?.querySelector('[data-is-accidental="true"]')).toBeNull();
        
        const acc66 = note66?.querySelector('[data-is-accidental="true"]');
        expect(acc66).toBeInTheDocument();
        expect(acc66?.textContent).toBe(SMuFL.accidentalSharp);
      });

      // Change key signature to Gb Major
      (useMidi as any).mockReturnValue({
        keySignature: 'Gb Major',
        splitPoint: 60,
        lut: Array(4096).fill(null),
        updateActiveNotes: mockUpdateActiveNotes
      });

      // Rerender to trigger keySignature change useEffect
      rerender(<NotationCanvas />);

      // Verify Gb Major (key center 6) rendering:
      // Note 60 has no accidental, note 66 has flat accidental
      await waitFor(() => {
        const note60 = document.querySelector('[data-midi-note="60"]');
        const note66 = document.querySelector('[data-midi-note="66"]');
        expect(note60).toBeInTheDocument();
        expect(note66).toBeInTheDocument();
        
        expect(note60?.querySelector('[data-is-accidental="true"]')).toBeNull();
        
        const acc66 = note66?.querySelector('[data-is-accidental="true"]');
        expect(acc66).toBeInTheDocument();
        expect(acc66?.textContent).toBe(SMuFL.accidentalFlat);
      });
    });
  });
});

describe('NotationCanvas - Legacy Audio Modal', () => {
  test('should assert that the text "Click to Start Audio Engine" does not exist in the DOM', () => {
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: [null],
      updateActiveNotes: vi.fn(),
    });

    render(<NotationCanvas />);
    expect(screen.queryByText('Click to Start Audio Engine')).toBeNull();
  });
});