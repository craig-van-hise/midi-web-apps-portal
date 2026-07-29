// src/plugins/chord-notator/components/NotationCanvas.prp152.test.tsx
// @ts-nocheck
import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotationCanvas from './NotationCanvas';
import { useMidi } from '../midi/MIDIProvider';
import { vi } from 'vitest';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('PRP #152 - Polyphonic Voice Preservation', () => {
  const mockUpdateActiveNotes = vi.fn();
  const mockSetSelectedNotes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: [null],
      updateActiveNotes: mockUpdateActiveNotes,
      setSelectedNotes: mockSetSelectedNotes,
      listenMode: false,
    });
  });

  const setupCanvas = () => {
    const utils = render(<NotationCanvas />);
    const container = document.querySelector('.notation-canvas-container')!;
    container.getBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 320,
      left: 0,
      top: 0,
      bottom: 320,
      right: 1000,
    } as DOMRect));
    return { ...utils, container };
  };

  const addNote = (midi: number) => {
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, midi, 100]) }
      }));
    });
  };

  describe('Phase 1: Chromatic Unison Doubling', () => {
    test('Test Case 1: Transposing a voice into unison preserves all 3 voices (no pitch deduplication)', async () => {
      const { container } = setupCanvas();

      // Add C Major triad: C4 (60), E4 (64), G4 (67)
      addNote(60);
      addNote(64);
      addNote(67);

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="64"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="67"]')).toBeInTheDocument();
      });

      // Select the lowest note (C4 = MIDI 60) by clicking directly on its container
      const noteC = document.querySelector('.notation-note-container[data-midi-note="60"]')!;
      act(() => {
        fireEvent.pointerDown(noteC);
      });

      // Transpose selected note (C4) up by 4 chromatic semitones → should reach E4 (64)
      // Shift+ArrowUp = chromatic +1
      for (let i = 0; i < 4; i++) {
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            shiftKey: true,
            bubbles: true,
          }));
        });
      }

      // CRITICAL ASSERTION: All 3 voices must still exist
      // The transposed voice is now at MIDI 64, and the original E4 is also at MIDI 64
      // Both must coexist as a unison doubling
      await waitFor(() => {
        const allNoteContainers = document.querySelectorAll('.notation-note-container');
        expect(allNoteContainers.length).toBe(3);
      });

      // Verify updateActiveNotes was called with all 3 voices
      const lastCall = mockUpdateActiveNotes.mock.calls[mockUpdateActiveNotes.mock.calls.length - 1];
      expect(lastCall[0].length).toBe(3);

      // Verify the pitch values are [64, 64, 67] (two unisons + G)
      const pitches = lastCall[0].map((n: any) => n.note).sort((a: number, b: number) => a - b);
      expect(pitches).toEqual([64, 64, 67]);
    });

    test('Test Case 2: Voice crossing preserves all voices after passing through unison', async () => {
      const { container } = setupCanvas();

      // Add C Major triad: C4 (60), E4 (64), G4 (67)
      addNote(60);
      addNote(64);
      addNote(67);

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="64"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="67"]')).toBeInTheDocument();
      });

      // Select C4 (MIDI 60) by clicking directly on its container
      const noteC = document.querySelector('.notation-note-container[data-midi-note="60"]')!;
      act(() => {
        fireEvent.pointerDown(noteC);
      });

      // Step 1: Transpose C4 up 4 chromatic semitones to create unison at E4 (64)
      for (let i = 0; i < 4; i++) {
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            shiftKey: true,
            bubbles: true,
          }));
        });
      }

      // Verify unison state: [64, 64, 67] — 3 voices intact
      let lastCall = mockUpdateActiveNotes.mock.calls[mockUpdateActiveNotes.mock.calls.length - 1];
      expect(lastCall[0].length).toBe(3);

      // Step 2: Continue transposing the selected voice diatonically past G4
      // Alt+ArrowUp x3: E4(64) → F4(65) → G4(67) → A4(69)
      for (let i = 0; i < 3; i++) {
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowUp',
            altKey: true,
            bubbles: true,
          }));
        });
      }

      // CRITICAL ASSERTION: All 3 voices must remain after crossing
      lastCall = mockUpdateActiveNotes.mock.calls[mockUpdateActiveNotes.mock.calls.length - 1];
      expect(lastCall[0].length).toBe(3);

      // All 3 unique IDs must still be present
      const uniqueIds = new Set(lastCall[0].map((n: any) => n.id));
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Phase 1: data-id DOM attribute', () => {
    test('Note containers expose data-id attribute for voice-specific targeting', async () => {
      setupCanvas();

      // Add two notes
      addNote(60);
      addNote(64);

      await waitFor(() => {
        const containers = document.querySelectorAll('.notation-note-container');
        expect(containers.length).toBe(2);

        // Each container should have a data-id attribute with a unique UUID
        containers.forEach(container => {
          expect(container.getAttribute('data-id')).toBeTruthy();
        });

        // The data-id values must be unique
        const ids = Array.from(containers).map(c => c.getAttribute('data-id'));
        expect(new Set(ids).size).toBe(2);
      });
    });
  });
});
