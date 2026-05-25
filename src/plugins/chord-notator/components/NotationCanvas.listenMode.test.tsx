import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotationCanvas from './NotationCanvas';
import { useMidi } from '../midi/MIDIProvider';
import { audioEngine } from '../audio/engine';

// Mock useMidi
vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

// Mock tone
vi.mock('tone', () => ({
  Frequency: vi.fn().mockReturnValue({
    toNote: vi.fn().mockReturnValue('C4'),
  }),
  context: {
    state: 'running',
  },
}));

// Mock audioEngine
vi.mock('../audio/engine', () => ({
  audioEngine: {
    releaseAll: vi.fn(),
    noteOn: vi.fn(),
    releaseNote: vi.fn(),
  },
}));

describe('NotationCanvas - LISTEN Mode Toggle TDD Checkpoint', () => {
  const mockUpdateActiveNotes = vi.fn();
  const mockSetSelectedNotes = vi.fn();
  
  const mockLut = [
    { name: 'Major', quality: 'major', quality_symbol: '', extensions: '', formula: '0,4,7', intervals: '1,3,5' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given listenMode is false, When a transformation button is clicked or triggered, Then the visual state updates but the mocked audioEngine spy is NOT called', () => {
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      updateActiveNotes: mockUpdateActiveNotes,
      lut: mockLut,
      setSelectedNotes: mockSetSelectedNotes,
      listenMode: false, // LISTEN MODE OFF
    });

    render(<NotationCanvas />);
    
    // 1. Add note via MIDI
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), timestamp: Date.now() }
      }));
    });

    // Clear any initial audio calls from note addition
    vi.clearAllMocks();

    // 2. Dispatch SEMI_UP transformation (simulate UI click/trigger)
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'SEMI_UP', stepSize: 1, isUiClick: true }
      }));
    });

    // 3. Verify visual state updates (updateActiveNotes called)
    const lastCall = mockUpdateActiveNotes.mock.calls[mockUpdateActiveNotes.mock.calls.length - 1][0];
    const pitches = lastCall.map((n: any) => n.note).sort();
    expect(pitches).toEqual([61]);

    // 4. Verify audioEngine is NOT called
    expect(audioEngine.noteOn).not.toHaveBeenCalled();
    expect(audioEngine.releaseAll).not.toHaveBeenCalled();
  });

  it('Given listenMode is true, When a transformation is triggered, Then the visual state updates AND the mocked audioEngine spy IS called', () => {
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      updateActiveNotes: mockUpdateActiveNotes,
      lut: mockLut,
      setSelectedNotes: mockSetSelectedNotes,
      listenMode: true, // LISTEN MODE ON
    });

    render(<NotationCanvas />);
    
    // 1. Add note via MIDI
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]), timestamp: Date.now() }
      }));
    });

    // Clear any initial audio calls from note addition
    vi.clearAllMocks();

    // 2. Dispatch SEMI_UP transformation (simulate UI click/trigger)
    act(() => {
      window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
        detail: { type: 'SEMI_UP', stepSize: 1, isUiClick: true }
      }));
    });

    // 3. Verify visual state updates (updateActiveNotes called)
    const lastCall = mockUpdateActiveNotes.mock.calls[mockUpdateActiveNotes.mock.calls.length - 1][0];
    const pitches = lastCall.map((n: any) => n.note).sort();
    expect(pitches).toEqual([61]);

    // 4. Verify audioEngine IS called
    expect(audioEngine.releaseAll).toHaveBeenCalled();
    expect(audioEngine.noteOn).toHaveBeenCalledWith('C4', expect.any(Number));
  });
});
