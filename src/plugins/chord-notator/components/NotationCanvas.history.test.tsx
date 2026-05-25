// src/components/NotationCanvas.history.test.tsx
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

describe('NotationCanvas - History and Write Mode', () => {
  const mockUpdateActiveNotes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: [null], 
      updateActiveNotes: mockUpdateActiveNotes,
    });
  });

  const setupCanvas = () => {
    const utils = render(<NotationCanvas />);
    const container = document.querySelector('.notation-canvas-container')!;
    
    // Mock getBoundingClientRect for the container
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

  test('Phase 1: Select a note, press Delete, then Undo', async () => {
    const { container } = setupCanvas();

    // 1. Send Note On for pitch 60 (Middle C)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });

    // 2. Select the note
    // Middle C in C Major is Step 0, y=12. Center is (500, 160-12=148).
    act(() => {
      fireEvent.pointerDown(container, { clientX: 500, clientY: 148 });
    });

    // 3. Press Delete
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).not.toBeInTheDocument();
    });

    // 4. Press Cmd+Z (Undo)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });
  });

  test('Phase 3: Write mode note placement and click-away', async () => {
    const { container } = setupCanvas();

    // 1. Enter Write Mode via Shift+W
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
    });

    // 2. Move pointer to Middle C position (148)
    act(() => {
      fireEvent.pointerMove(container, { clientX: 500, clientY: 148 });
    });

    // Verify ghost note is visible
    const ghost = document.getElementById('ghost-note');
    expect(ghost).not.toHaveClass('hidden');
    expect(ghost).toHaveStyle('top: 148px');

    // 3. Click to place note
    act(() => {
      fireEvent.pointerDown(container, { clientX: 500, clientY: 148 });
    });

    await waitFor(() => {
      // Middle C is MIDI 60
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });

    // 4. Click outside the 300px bounds (rect.width is 1000, so center is 500. Bounds are 350 to 650)
    act(() => {
      fireEvent.pointerDown(container, { clientX: 200, clientY: 160 });
    });

    // Verify Write Mode exited and ghost hidden
    expect(ghost).toHaveClass('hidden');
  });

  test('Undo/Redo stack depth and basic flow', async () => {
    const { container } = setupCanvas();

    // 1. Enter Write Mode
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, bubbles: true }));
    });

    // 2. Place Note 60
    act(() => {
      fireEvent.pointerMove(container, { clientX: 500, clientY: 148 });
      fireEvent.pointerDown(container, { clientX: 500, clientY: 148 });
    });

    await waitFor(() => {
      expect(document.querySelectorAll('.notation-note-container').length).toBe(1);
    });

    // 3. Place Note 62 (Step 1, y = (1*6)+12 = 18. centerY = 160 - 18 = 142)
    act(() => {
      fireEvent.pointerMove(container, { clientX: 500, clientY: 142 });
      fireEvent.pointerDown(container, { clientX: 500, clientY: 142 });
    });

    await waitFor(() => {
      expect(document.querySelectorAll('.notation-note-container').length).toBe(2);
    });

    // 4. Undo twice
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('.notation-note-container').length).toBe(1);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('.notation-note-container').length).toBe(0);
    });

    // 5. Redo once
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }));
    });
    await waitFor(() => {
      expect(document.querySelectorAll('.notation-note-container').length).toBe(1);
    });
  });
});
