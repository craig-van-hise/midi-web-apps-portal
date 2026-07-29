// src/plugins/chord-notator/components/NotationCanvas.prp147.test.tsx
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

describe('PRP #147 - History Regression & Ottava Write Mode Offset', () => {
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

  describe('Phase 1: Main Notation Undo/Redo & Event Priority Restoration', () => {
    test('Test Case 1: Reverts added note via Cmd+Z and broadcasts updated active notes', async () => {
      const { container } = setupCanvas();

      // Initial notes via MIDI noteOn messages
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 60, 100]) }
        }));
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 64, 100]) }
        }));
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 67, 100]) }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="64"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="67"]')).toBeInTheDocument();
      });

      // Enter Write Mode (Shift + W)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
      });

      // Pointer move to C5 (y = 12 + 6*7 = 54 -> centerY 160 - 54 = 106)
      act(() => {
        fireEvent.pointerMove(container, { clientX: 500, clientY: 106 });
      });

      // Click to add note (C5, MIDI 72)
      act(() => {
        fireEvent.pointerDown(container, { clientX: 500, clientY: 106 });
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="72"]')).toBeInTheDocument();
      });

      mockUpdateActiveNotes.mockClear();

      // Press Cmd+Z
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="72"]')).not.toBeInTheDocument();
        expect(mockUpdateActiveNotes).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ note: 60 }),
            expect.objectContaining({ note: 64 }),
            expect.objectContaining({ note: 67 }),
          ])
        );
      });
    });

    test('Test Case 2: Redo via APP_HISTORY CustomEvent restores state', async () => {
      const { container } = setupCanvas();

      // Initial notes via MIDI noteOn messages
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 60, 100]) }
        }));
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 64, 100]) }
        }));
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 67, 100]) }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
      });

      // Enter Write Mode
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
      });

      // Add C5 (72)
      act(() => {
        fireEvent.pointerMove(container, { clientX: 500, clientY: 106 });
        fireEvent.pointerDown(container, { clientX: 500, clientY: 106 });
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="72"]')).toBeInTheDocument();
      });

      // Undo via Cmd+Z
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="72"]')).not.toBeInTheDocument();
      });

      // Dispatch APP_HISTORY REDO event
      act(() => {
        window.dispatchEvent(new CustomEvent('APP_HISTORY', { detail: { action: 'REDO' } }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="72"]')).toBeInTheDocument();
      });
    });
  });

  describe('Phase 2: Ottava (8va/15ma/8vb/15mb) Write Mode Offset Inversion', () => {
    test('Test Case 1: 8va active (shift -7), visual step 9 computes logical step 16 and MIDI 88 (E6)', async () => {
      const { container } = setupCanvas();

      // Dispatch high note G6 (MIDI 91, stepOffset 23) to trigger 8va trebleShift (-7)
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 91, 100]) }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="91"]')).toBeInTheDocument();
      });

      // Enter Write Mode
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
      });

      // Hover over visual step 9 (top E5 space on staff: ySteps = 9 -> y = (9*6)+12 = 66 -> clientY = 160 - 66 = 94)
      act(() => {
        fireEvent.pointerMove(container, { clientX: 500, clientY: 94 });
      });

      const ghost = document.getElementById('ghost-note');
      expect(ghost).not.toBeNull();
      // Visual step 9 with 8va active (-7 shift) should yield logicalStepOffset = 9 - (-7) = 16 (E6, MIDI 88)
      expect(ghost.dataset.step).toBe('16');
      expect(ghost.dataset.midiNote).toBe('88');
    });

    test('Test Case 2: 15ma active (shift -14), clicking visual step 9 places note with MIDI 100 (E7) and stepOffset 23', async () => {
      const { container } = setupCanvas();

      // Dispatch extreme high note G7 (MIDI 103, stepOffset 25) to trigger 15ma trebleShift (-14)
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 103, 100]) }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="103"]')).toBeInTheDocument();
      });

      // Enter Write Mode
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
      });

      // Hover and click at visual step 9 (clientY = 94)
      act(() => {
        fireEvent.pointerMove(container, { clientX: 500, clientY: 94 });
        fireEvent.pointerDown(container, { clientX: 500, clientY: 94 });
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="100"]')).toBeInTheDocument();
      });
    });
  });
});
