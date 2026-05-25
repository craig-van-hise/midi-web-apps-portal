import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotationCanvas from './NotationCanvas';
import { useMidi } from '../midi/MIDIProvider';
import { audioEngine } from '../audio/engine';
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

vi.mock('tone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tone')>();
  return {
    ...actual,
    context: {
      state: 'running',
    },
  };
});

vi.mock('../audio/engine', () => ({
  audioEngine: {
    isInitialized: true,
    init: vi.fn(),
    loadInstrument: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn(),
    setPan: vi.fn(),
    setTuningOffset: vi.fn(),
    setAttack: vi.fn(),
    setDecay: vi.fn(),
    setSustain: vi.fn(),
    setRelease: vi.fn(),
    setReverbWet: vi.fn(),
    getMeterLevels: vi.fn().mockReturnValue({ l: -100, r: -100 }),
    noteOn: vi.fn(),
    releaseNote: vi.fn(),
    releaseAll: vi.fn(),
  }
}));

describe('NotationCanvas - Keyboard Shortcut Audio Playback', () => {
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

  test('Given an active selection, When Alt+ArrowUp is pressed, Then applyDiatonicShift is called AND playPreviewNotes is subsequently called with the new pitches', async () => {
    render(<NotationCanvas />);

    // 1. Add note 60 (C4) via MIDI
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    const note60 = await screen.findByTestId('note-container-60');

    // 2. Select note 60
    fireEvent.pointerDown(note60);
    expect(note60).toHaveAttribute('data-selected', 'true');

    // Clear previous audio calls from noteOn during MIDI message
    vi.clearAllMocks();

    // 3. Press Alt + ArrowUp
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    });

    // 4. Verify audioEngine.noteOn was called with D4 (MIDI 62)
    expect(audioEngine.noteOn).toHaveBeenCalledWith('D4', expect.any(Number));
  });
});
