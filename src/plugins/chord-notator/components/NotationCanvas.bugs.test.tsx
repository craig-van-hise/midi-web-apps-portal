// src/components/NotationCanvas.bugs.test.tsx
// @ts-nocheck
import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotationCanvas from './NotationCanvas';
import { useMidi } from '../midi/MIDIProvider';
import { vi } from 'vitest';
import * as chordSpeller from '../utils/chordSpeller';

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

  test('Identity Lock protection: does not break on virtual events', async () => {
    const { container } = setupCanvas();

    // 1. Send Note On (Physical) to establish active notes
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), isVirtual: false }
      }));
    });

    // 2. Click ROT to lock identity
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'ROT_UP', stepSize: 1, isUiClick: true }
      }));
    });

    // 3. Send a Virtual Note On -> Should NOT break the lock (meaning the lock remains active)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]), isVirtual: true }
      }));
    });
  });

  test('Identity Lock breaks on diatonic KEY transpositions', async () => {
    const { container } = setupCanvas();

    // 1. Send Note On (Physical) to establish active notes
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), isVirtual: false }
      }));
    });

    // 2. Click ROT to lock identity
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'ROT_UP', stepSize: 1, isUiClick: true }
      }));
    });

    // Reset spy calls before KEY shift
    const getChordSymbolSpy = vi.spyOn(chordSpeller, 'getChordSymbol');
    getChordSymbolSpy.mockClear();

    // 3. Dispatch KEY_UP event
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'KEY_UP', stepSize: 1, isUiClick: true }
      }));
    });

    // 4. Assert that getChordSymbol was called with chordIdentity where isActive is false
    expect(getChordSymbolSpy).toHaveBeenCalled();
    const lastCall = getChordSymbolSpy.mock.lastCall;
    const identityArg = lastCall[5]; // 6th argument is chordIdentityRef.current
    expect(identityArg.isActive).toBe(false);
  });

  test('Bug: Note removal after rotation updates chord symbol (breaks lock)', async () => {
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: Array(4096).fill(null), 
      updateActiveNotes: mockUpdateActiveNotes,
      isToggleModeActive: true,
    });

    // Mock getChordSymbol and getChordSpelling to simulate chord speller behavior
    const getChordSymbolSpy = vi.spyOn(chordSpeller, 'getChordSymbol');
    getChordSymbolSpy.mockImplementation((ps, keySig, lut, overrides, keyCenter, chordIdentity) => {
      if (ps.length === 0) return "";
      if (chordIdentity && chordIdentity.isActive) {
        const lowestNotePC = (ps[0] % 12 + 12) % 12;
        if (lowestNotePC === chordIdentity.rootPC) {
          return chordIdentity.baseName;
        } else {
          const bassSpelling = chordIdentity.spellingMap[lowestNotePC] || "C";
          return `${chordIdentity.baseName} / ${bassSpelling}`;
        }
      }
      const sorted = [...ps].sort((a, b) => a - b);
      const pcs = sorted.map(p => p % 12);
      if (pcs.length === 3 && pcs.includes(0) && pcs.includes(4) && pcs.includes(7)) {
        const lowest = pcs[0];
        if (lowest === 0) return "C";
        if (lowest === 4) return "C / E";
        if (lowest === 7) return "C / G";
      }
      if (pcs.length === 2 && pcs.includes(4) && pcs.includes(7)) {
        return "Em";
      }
      return "-";
    });

    const getChordSpellingSpy = vi.spyOn(chordSpeller, 'getChordSpelling');
    getChordSpellingSpy.mockImplementation((ps, keySig, lut, overrides, keyCenter, includeOctave, chordIdentity) => {
      return ps.map(pitch => {
        const pc = pitch % 12;
        if (pc === 0) return "C";
        if (pc === 4) return "E";
        if (pc === 7) return "G";
        return "C";
      });
    });

    const { container } = setupCanvas();

    // 1. Establish active notes [C4 (60), E4 (64), G4 (67)] - C Major
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), isVirtual: false }
      }));
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 64, 100]), isVirtual: false }
      }));
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 67, 100]), isVirtual: false }
      }));
    });

    const pill = screen.getByTestId('chord-symbol-pill');
    await waitFor(() => {
      expect(pill).toHaveTextContent('C');
    });

    // 2. Rotate up (yielding [E4 (64), G4 (67), C5 (72)]) -> Chord identity should lock
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'ROT_UP', stepSize: 1, isUiClick: true }
      }));
    });

    await waitFor(() => {
      expect(pill).toHaveTextContent('C / E');
    });

    // 3. Remove C5 (72) via UI keyboard (virtual note-on toggles it off)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 72, 100]), isVirtual: true }
      }));
    });

    // 4. Chord symbol should update to reflect remaining notes [E4, G4] (e.g. not remain "C / E")
    await waitFor(() => {
      expect(pill).toHaveTextContent('Em');
    });
  });

  test('Test Case 1 (Toggle Re-entry): Chromatic shift updates sourceMidi and does not block re-entry', async () => {
    const { container } = setupCanvas();

    // 1. Send Note On (Physical C4 / 60)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), isVirtual: false }
      }));
    });

    // 2. Select the note
    const activeNoteElement = await screen.findByTestId('note-container-60');
    expect(activeNoteElement).toBeInTheDocument();
    
    // Simulating selection
    act(() => {
      fireEvent.pointerDown(activeNoteElement);
    });

    // 3. Shift Chromatically Up (Semitone Up: 60 -> 61, Db4)
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'SEMI_UP', stepSize: 1, isUiClick: true }
      }));
    });

    // 4. Wait for Db4 (61) to be rendered
    const shiftedNoteElement = await screen.findByTestId('note-container-61');
    expect(shiftedNoteElement).toBeInTheDocument();

    // 5. Send Virtual Note On for C4 / 60 (Toggle Mode / Virtual Event)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), isVirtual: true }
      }));
    });

    // 6. Assert that C4 is successfully added alongside Db4, and is not blocked
    await waitFor(() => {
      expect(screen.queryByTestId('note-container-60')).toBeInTheDocument();
      expect(screen.queryByTestId('note-container-61')).toBeInTheDocument();
    });
  });
});

