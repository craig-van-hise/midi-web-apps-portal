// src/components/NotationCanvas.bugs.test.tsx
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

describe('NotationCanvas - PRP #94 Bug Fixes', () => {
  const mockUpdateActiveNotes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: Array(4096).fill(null), 
      updateActiveNotes: mockUpdateActiveNotes,
    });
  });

  const setupCanvas = () => {
    const utils = render(<NotationCanvas />);
    const container = screen.getByTestId('notation-canvas-container');
    
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

  test('Bug 1: Global shortcuts fire without selection', async () => {
    const { container } = setupCanvas();

    // 1. Enter Write Mode via Shift+W (No selection)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', shiftKey: true, bubbles: true }));
    });

    const ghost = document.getElementById('ghost-note');
    expect(ghost).not.toHaveClass('hidden');

    // 2. Exit Write Mode via Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(ghost).toHaveClass('hidden');
  });

  test('Bug 2: commitState captures MIDI NoteOn/Off', async () => {
    const { container } = setupCanvas();

    // 1. Send Note On
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });

    // 2. Undo the MIDI Note On
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).not.toBeInTheDocument();
    });

    // 3. Redo the MIDI Note On
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-midi-note="60"]')).toBeInTheDocument();
    });
  });

  test('Bug 3: Ghost note snaps instantly on mode enter', async () => {
    const { container } = setupCanvas();

    // 1. Move pointer to Middle C position (148) while NOT in write mode
    act(() => {
      fireEvent.pointerMove(container, { clientX: 500, clientY: 148 });
    });

    // 2. Enter Write Mode via Shift+W
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', shiftKey: true, bubbles: true }));
    });

    const ghost = document.getElementById('ghost-note');
    expect(ghost).not.toHaveClass('hidden');
    // It should have snapped to the last known pointer Y (148)
    expect(ghost).toHaveStyle('top: 148px');
  });
});
