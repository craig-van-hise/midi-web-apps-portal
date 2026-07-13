/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MIDIProvider, useMidi } from './MIDIProvider';
import { audioEngine } from '../audio/engine';

vi.mock('../audio/engine', () => ({
  audioEngine: {
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    loadInstrument: vi.fn().mockResolvedValue(undefined),
  }
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TestConsumer: React.FC<{ onReady?: (ctx: any) => void }> = ({ onReady }) => {
  const context = useMidi();

  useEffect(() => {
    if (context && !context.loading) {
      onReady?.(context);
    }
  }, [context, onReady]);

  return (
    <div>
      {context?.loading ? 'Loading...' : 'Ready'}
    </div>
  );
};

describe('MIDIProvider - Playable Transformations TDD Checkpoint', () => {
  it('Given a mapped transformation, When a simulated MIDI Note On arrives with velocity 100, Then audioEngine.triggerAttack is called with the transformed notes and corresponding velocity', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(capturedContext).toBeDefined();
    });

    act(() => {
      // Set C major triad [60, 64, 67] as selected notes
      capturedContext.setSelectedNotes([60, 64, 67]);
      // Map SEMI_UP (Diatonic Up / Semitone Up) to MIDI note 48 (C3)
      capturedContext.updateButtonConfig('SEMI_UP', { midiNote: 48, midiChannel: 1 });
    });

    // Simulate Note On for MIDI note 48 with velocity 100 via window event
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 48, 100]), isVirtual: false }
      }));
    });

    // SEMI_UP transforms [60, 64, 67] to [61, 65, 68]
    expect(audioEngine.triggerAttack).toHaveBeenCalledWith([61, 65, 68], 100 / 127);
  });

  it('Given an active transformation held in the Map, When the corresponding simulated MIDI Note Off arrives, Then audioEngine.triggerRelease is called with the exact array of transformed notes, and the Map entry is cleared', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(capturedContext).toBeDefined();
    });

    act(() => {
      capturedContext.setSelectedNotes([60, 64, 67]);
      capturedContext.updateButtonConfig('SEMI_UP', { midiNote: 48, midiChannel: 1 });
    });

    // Simulate Note On for MIDI note 48 with velocity 100
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 48, 100]), isVirtual: false }
      }));
    });

    expect(audioEngine.triggerAttack).toHaveBeenCalledWith([61, 65, 68], 100 / 127);

    // Verify map has the active notes
    expect(capturedContext.activeTransformationNotes.get(48)).toEqual([61, 65, 68]);

    // Simulate Note Off for MIDI note 48 (status 0x80 or 0x90 with velocity 0)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x80, 48, 0]), isVirtual: false }
      }));
    });

    expect(audioEngine.triggerRelease).toHaveBeenCalledWith([61, 65, 68]);
    expect(capturedContext.activeTransformationNotes.has(48)).toBe(false);
  });

  it('Given an input chord containing notes that map beyond bounds, when simulated MIDI Note On arrives, then they are octave wrapped element-wise and the Note Off triggers release on the wrapped notes', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(capturedContext).toBeDefined();
    });

    act(() => {
      // Set boundary chord [100, 105, 107] as selected notes
      capturedContext.setSelectedNotes([100, 105, 107]);
      // Map OCT_UP to MIDI note 48 (C3)
      capturedContext.updateButtonConfig('OCT_UP', { midiNote: 48, midiChannel: 1 });
    });

    // Simulate Note On for MIDI note 48 with velocity 100
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 48, 100]), isVirtual: false }
      }));
    });

    // OCT_UP transforms [100, 105, 107] by +12 to [112, 117, 119]
    // applyGlobalOctaveWrap wraps them to [100, 105, 107] (since 112-12=100, 117-12=105, 119-12=107)
    expect(audioEngine.triggerAttack).toHaveBeenCalledWith([100, 105, 107], 100 / 127);

    // Verify map has the active notes as wrapped pitches
    expect(capturedContext.activeTransformationNotes.get(48)).toEqual([100, 105, 107]);

    // Simulate Note Off for MIDI note 48
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x80, 48, 0]), isVirtual: false }
      }));
    });

    expect(audioEngine.triggerRelease).toHaveBeenCalledWith([100, 105, 107]);
    expect(capturedContext.activeTransformationNotes.has(48)).toBe(false);
  });

  it('Given sequenceKeyswitches maps Note 36 to Step 0 containing [60, 64, 67], When Note 36 NoteOn is received, Assert audio engine receives NoteOn for 60, 64, and 67, and original Note 36 is silenced', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(capturedContext).toBeDefined();
    });

    act(() => {
      // Set the sequence to have C4 (60), E4 (64), G4 (67) at step 0
      capturedContext.setSequence([
        { notes: [{ note: 60 }, { note: 64 }, { note: 67 }], symbol: 'C' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' }
      ]);
      // Map sequence starting at rootNote 36
      capturedContext.mapSequenceToKeys(36, [
        { notes: [{ note: 60 }, { note: 64 }, { note: 67 }], symbol: 'C' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' }
      ]);
    });

    // We will monitor MIDI_MESSAGE_RECEIVED to ensure Note 36 event is silenced (blocked)
    const midiReceivedSpy = vi.fn();
    window.addEventListener('MIDI_MESSAGE_RECEIVED', midiReceivedSpy);

    act(() => {
      capturedContext.dispatchPhysicalMidi(new Uint8Array([0x90, 36, 100]));
    });

    // Assert original Note 36 is silenced, i.e., triggerAttack on 36 is NOT called
    // instead, triggerAttack on [60, 64, 67] is called
    expect(audioEngine.triggerAttack).toHaveBeenCalledWith([60, 64, 67], 100 / 127);
    expect(audioEngine.triggerAttack).not.toHaveBeenCalledWith([36], expect.any(Number));

    // Verify MIDI_MESSAGE_RECEIVED was NOT dispatched for 36 (since it is blocked/silenced)
    // Let's filter calls to only look for Note 36 NoteOn
    const note36Calls = midiReceivedSpy.mock.calls.filter(call => {
      const detail = call[0]?.detail;
      return detail && detail.data && detail.data[0] === 0x90 && detail.data[1] === 36;
    });
    expect(note36Calls.length).toBe(0);

    window.removeEventListener('MIDI_MESSAGE_RECEIVED', midiReceivedSpy);
  });

  it('Given isListeningForMap is true, When a simulated MIDI NoteOn arrives, Then mapSequenceToKeys is called, the note is silenced, and isListeningForMap is set to false', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(capturedContext).toBeDefined();
    });

    act(() => {
      // Turn on mapping listening mode
      capturedContext.setIsListeningForMap(true);
      // Setup some chords in the sequence to map
      capturedContext.setSequence([
        { notes: [{ note: 60 }], symbol: 'C' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' }
      ]);
    });

    // Monitor window events to ensure Note 48 event is silenced (blocked)
    const midiReceivedSpy = vi.fn();
    window.addEventListener('MIDI_MESSAGE_RECEIVED', midiReceivedSpy);

    act(() => {
      capturedContext.dispatchPhysicalMidi(new Uint8Array([0x90, 48, 100]));
    });

    // Assert that the sequence was mapped (key 48 mapped to step 0)
    expect(capturedContext.sequenceKeyswitches[48]).toBe(0);

    // Assert isListeningForMap is set to false
    expect(capturedContext.isListeningForMap).toBe(false);

    // Verify MIDI_MESSAGE_RECEIVED was NOT dispatched for 48 (since it is blocked/silenced)
    const note48Calls = midiReceivedSpy.mock.calls.filter(call => {
      const detail = call[0]?.detail;
      return detail && detail.data && detail.data[0] === 0x90 && detail.data[1] === 48;
    });
    expect(note48Calls.length).toBe(0);

    window.removeEventListener('MIDI_MESSAGE_RECEIVED', midiReceivedSpy);
  });

  it('Given isListeningForMap is true, When a simulated VIRTUAL MIDI NoteOn arrives, Then mapSequenceToKeys is called, the virtual note is silenced, and isListeningForMap is set to false', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(capturedContext).toBeDefined();
    });

    act(() => {
      capturedContext.setIsListeningForMap(true);
      capturedContext.setSequence([
        { notes: [{ note: 60 }], symbol: 'C' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' }
      ]);
    });

    const midiReceivedSpy = vi.fn();
    window.addEventListener('MIDI_MESSAGE_RECEIVED', midiReceivedSpy);

    act(() => {
      capturedContext.dispatchVirtualMidi(new Uint8Array([0x90, 48, 100]));
    });

    // Assert that the sequence was mapped (key 48 mapped to step 0)
    expect(capturedContext.sequenceKeyswitches[48]).toBe(0);

    // Assert isListeningForMap is set to false
    expect(capturedContext.isListeningForMap).toBe(false);

    // Verify MIDI_MESSAGE_RECEIVED was NOT dispatched for 48 (since it is blocked/silenced)
    const note48Calls = midiReceivedSpy.mock.calls.filter(call => {
      const detail = call[0]?.detail;
      return detail && detail.data && detail.data[0] === 0x90 && detail.data[1] === 48;
    });
    expect(note48Calls.length).toBe(0);

    window.removeEventListener('MIDI_MESSAGE_RECEIVED', midiReceivedSpy);
  });
});
