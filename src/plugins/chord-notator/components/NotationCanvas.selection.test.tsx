// src/components/NotationCanvas.selection.test.tsx
// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotationCanvas from './NotationCanvas';
import { useMidi } from '../midi/MIDIProvider';
import { vi } from 'vitest';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('NotationCanvas Selection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: Array(4096).fill(null),
      updateActiveNotes: vi.fn(),
    });
  });

  test('Single Selection: Clicking a note selects only that note', async () => {
    render(<NotationCanvas />);
 
    // Add notes via MIDI
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });
 
    const note60 = await screen.findByTestId('note-container-60');
    const note64 = await screen.findByTestId('note-container-64');
 
    // Click note 60
    fireEvent.pointerDown(note60);
    expect(note60).toHaveAttribute('data-selected', 'true');
    expect(note64).not.toHaveAttribute('data-selected');
 
    // Click note 64
    fireEvent.pointerDown(note64);
    expect(note64).toHaveAttribute('data-selected', 'true');
    expect(note60).not.toHaveAttribute('data-selected');
  });
 
  test('Multi-Selection: Cmd+Click toggles selection', async () => {
    render(<NotationCanvas />);
 
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]) }
      }));
    });
 
    const note60 = await screen.findByTestId('note-container-60');
    const note64 = await screen.findByTestId('note-container-64');
 
    // Cmd+Click note 60
    fireEvent.pointerDown(note60, { metaKey: true });
    expect(note60).toHaveAttribute('data-selected', 'true');
 
    // Cmd+Click note 64
    fireEvent.pointerDown(note64, { metaKey: true });
    expect(note60).toHaveAttribute('data-selected', 'true');
    expect(note64).toHaveAttribute('data-selected', 'true');
 
    // Cmd+Click note 60 again (toggle off)
    fireEvent.pointerDown(note60, { metaKey: true });
    expect(note60).not.toHaveAttribute('data-selected');
    expect(note64).toHaveAttribute('data-selected', 'true');
  });
 
  test('Range Selection: Shift+Click selects range of pitches', async () => {
    render(<NotationCanvas />);
 
    act(() => {
      [60, 62, 64, 65, 67].forEach(midi => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });
 
    const note60 = await screen.findByTestId('note-container-60');
    const note64 = await screen.findByTestId('note-container-64');
    const note67 = await screen.findByTestId('note-container-67');
 
    // 1. Click 60
    fireEvent.pointerDown(note60);
    expect(note60).toHaveAttribute('data-selected', 'true');
 
    // 2. Shift+Click 64
    fireEvent.pointerDown(note64, { shiftKey: true });
    
    // Should select 60, 62, 64
    expect(await screen.findByTestId('note-container-60')).toHaveAttribute('data-selected', 'true');
    expect(await screen.findByTestId('note-container-62')).toHaveAttribute('data-selected', 'true');
    expect(await screen.findByTestId('note-container-64')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('note-container-65')).not.toHaveAttribute('data-selected');
    expect(screen.getByTestId('note-container-67')).not.toHaveAttribute('data-selected');
  });
 
  test('Clicking background clears selection', async () => {
    render(<NotationCanvas />);
 
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });
 
    const note60 = await screen.findByTestId('note-container-60');
    const container = note60.parentElement!.parentElement!; // The container
 
    fireEvent.pointerDown(note60);
    expect(note60).toHaveAttribute('data-selected', 'true');
 
    fireEvent.pointerDown(container);
    expect(note60).not.toHaveAttribute('data-selected');
  });
 
  test('Marquee Selection: Dragging over notes selects them', async () => {
    render(<NotationCanvas />);
 
    act(() => {
      [60, 64].forEach(midi => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });
 
    const note60 = await screen.findByTestId('note-container-60');
    const note64 = await screen.findByTestId('note-container-64');
    const container = note60.parentElement!.parentElement!;

    // Mock getBoundingClientRect for notes
    // Note 60 at (10, 10, 10, 10)
    note60.getBoundingClientRect = vi.fn(() => ({
      left: 10, top: 10, right: 20, bottom: 20, width: 10, height: 10
    }));
    // Note 64 at (100, 100, 10, 10)
    note64.getBoundingClientRect = vi.fn(() => ({
      left: 100, top: 100, right: 110, bottom: 110, width: 10, height: 10
    }));

    // Start Drag at (0, 0)
    fireEvent.pointerDown(container, { clientX: 0, clientY: 0 });
    
    // Move to (50, 50) - Should cover Note 60 but not 64
    fireEvent.pointerMove(container, { clientX: 50, clientY: 50 });
    
    // Mock marquee getBoundingClientRect
    const marquee = document.querySelector('.selection-marquee');
    marquee.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 50, bottom: 50, width: 50, height: 50
    }));

    // Release
    fireEvent.pointerUp(container);

    expect(note60).toHaveAttribute('data-selected', 'true');
    expect(note64).not.toHaveAttribute('data-selected');
  });

  test('Keyboard PCS Rotation: Option+Cmd+Up rotates inversion', async () => {
    render(<NotationCanvas />);

    act(() => {
      [60, 64, 67].forEach(midi => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });

    const note60 = await screen.findByTestId('note-container-60');
    fireEvent.pointerDown(note60, { metaKey: true });
    fireEvent.pointerDown(await screen.findByTestId('note-container-64'), { metaKey: true });
    fireEvent.pointerDown(await screen.findByTestId('note-container-67'), { metaKey: true });

    // Press Option+Cmd+Up
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true, metaKey: true });

    await waitFor(() => {
      // 60 should be gone, 64, 67, 72 should be present
      expect(document.querySelector('[data-midi-note="60"]')).not.toBeInTheDocument();
      expect(document.querySelector('[data-midi-note="64"]')).toBeInTheDocument();
      expect(document.querySelector('[data-midi-note="67"]')).toBeInTheDocument();
      expect(document.querySelector('[data-midi-note="72"]')).toBeInTheDocument();
    });
  });
});
