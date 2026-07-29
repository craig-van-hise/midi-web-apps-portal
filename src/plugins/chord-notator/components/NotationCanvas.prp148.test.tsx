// src/plugins/chord-notator/components/NotationCanvas.prp148.test.tsx
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

describe('PRP #148 - History Restoration & Write Mode Auto-Selection', () => {
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

  describe('Phase 1: Restore Main Notation Undo/Redo & Event Priority', () => {
    test('Test Case 1: Reverts chromatic transposition shift via Cmd+Z or lowercase app history event', async () => {
      const { container } = setupCanvas();

      // Initial C Major chord [60, 64, 67]
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

      // Apply SEMI_UP chromatic shift (transposes selection to [61, 65, 68])
      act(() => {
        window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
          detail: { type: 'SEMI_UP', stepSize: 1, isUiClick: false }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="61"]')).toBeInTheDocument();
      });

      // Case-insensitive APP_HISTORY undo event
      act(() => {
        window.dispatchEvent(new CustomEvent('APP_HISTORY', { detail: { action: 'undo' } }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="61"]')).not.toBeInTheDocument();
      });
    });

    test('Test Case 2: Redo restoration via APP_HISTORY action REDO', async () => {
      const { container } = setupCanvas();

      // Initial C Major chord [60, 64, 67]
      act(() => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, 60, 100]) }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
      });

      // Shift SEMI_UP
      act(() => {
        window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
          detail: { type: 'SEMI_UP', stepSize: 1, isUiClick: false }
        }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="61"]')).toBeInTheDocument();
      });

      // Undo
      act(() => {
        window.dispatchEvent(new CustomEvent('APP_HISTORY', { detail: { action: 'undo' } }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="60"]')).toBeInTheDocument();
      });

      // Redo
      act(() => {
        window.dispatchEvent(new CustomEvent('APP_HISTORY', { detail: { action: 'REDO' } }));
      });

      await waitFor(() => {
        expect(document.querySelector('.notation-note-container[data-midi-note="61"]')).toBeInTheDocument();
      });
    });
  });

  describe('Phase 2: Write Mode New Note Auto-Selection', () => {
    test('Test Case 1: Write Mode click auto-selects newly added note and calls setSelectedNotes', async () => {
      const { container } = setupCanvas();

      // Enter Write Mode (Shift + W)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
      });

      // Pointer move to C5 (y = 12 + 6*7 = 54 -> centerY 160 - 54 = 106)
      act(() => {
        fireEvent.pointerMove(container, { clientX: 500, clientY: 106 });
        fireEvent.pointerDown(container, { clientX: 500, clientY: 106 });
      });

      await waitFor(() => {
        const noteEl = document.querySelector('.notation-note-container[data-midi-note="72"]');
        expect(noteEl).toBeInTheDocument();
        // Check that setSelectedNotes was called with [72]
        expect(mockSetSelectedNotes).toHaveBeenCalledWith([72]);
      });
    });

    test('Test Case 2: Immediate Keyboard Transposition after Write Mode click without re-selecting', async () => {
      const { container } = setupCanvas();

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

      // Dispatch ArrowUp keydown event without clicking notehead
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
      });

      await waitFor(() => {
        // ArrowUp + Shift applies chromatic shift up (+1) -> MIDI 73
        expect(document.querySelector('.notation-note-container[data-midi-note="73"]')).toBeInTheDocument();
        expect(document.querySelector('.notation-note-container[data-midi-note="72"]')).not.toBeInTheDocument();
      });
    });
  });
});
