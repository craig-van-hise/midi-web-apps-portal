import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import MidiTransposerPlugin from './index';
import { useMidiStore } from './store/useMidiStore';

describe('MidiTransposerPlugin Headless Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMidiStore.setState({
      bypass: false,
      activeChannels: Array.from({ length: 16 }, (_, i) => i + 1),
      zones: [
        { id: 'z-trans', type: 'transpose', startNote: 21, endNote: 59, color: '#f43f5e', octave: 0 },
        { id: 'z-play', type: 'play', startNote: 60, endNote: 108, color: '#3b82f6', octave: 0 },
      ],
      transposeOctave: 0,
      playOctave: 0,
      transposeOrigin: 60,
      transposeTarget: 60,
      transposeTargets: [60],
      filterMode: 'block',
      filterRange: [21, 108],
      transposeSustainMode: 'sustain',
    });
  });

  it('mounts successfully and displays the three keyboard components', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    render(
      <MidiTransposerPlugin
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    // Verify keyboard sections exist
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getAllByText('Transpose')[0]).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('correctly listens to mock custom midi events on midiBus and fires onMidiOut synchronously', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    render(
      <MidiTransposerPlugin
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    // Dispatch a Note-On event for C4 (60) on channel 1 (144 status byte) which is in the Play zone
    // By default, transpose amount is 0, so it maps directly.
    const noteOnEvent = new CustomEvent('midi', { detail: [144, 60, 100] });

    act(() => {
      mockMidiBus.dispatchEvent(noteOnEvent);
    });

    expect(mockOnMidiOut).toHaveBeenCalledTimes(1);
    expect(mockOnMidiOut).toHaveBeenCalledWith([144, 60, 100]);
  });

  it('ignores MIDI events when isBypassed is true', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    render(
      <MidiTransposerPlugin
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={true}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    const noteOnEvent = new CustomEvent('midi', { detail: [144, 60, 100] });

    act(() => {
      mockMidiBus.dispatchEvent(noteOnEvent);
    });

    expect(mockOnMidiOut).not.toHaveBeenCalled();
  });

  it('correctly throttles internal React UI state updates (event log renders) while calling onMidiOut synchronously', async () => {
    vi.useFakeTimers();

    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    render(
      <MidiTransposerPlugin
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    expect(screen.getByTestId('hidden-logs').textContent).toBe('');

    // Trigger 4 synchronous note events in sequence
    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 60, 100] }));
    });
    vi.advanceTimersByTime(1);
    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [128, 60, 0] }));
    });
    vi.advanceTimersByTime(1);
    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 61, 100] }));
    });
    vi.advanceTimersByTime(1);
    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [128, 61, 0] }));
    });

    // onMidiOut must be called immediately for all 4
    expect(mockOnMidiOut).toHaveBeenCalledTimes(4);

    // Visual UI log display should be throttled. Only the first event is immediately rendered.
    expect(screen.getByText('[MIDI OUT] status=0x90 note=60 velocity=100')).toBeInTheDocument();
    expect(screen.queryByText('[MIDI OUT] status=0x80 note=60 velocity=0')).not.toBeInTheDocument();

    // Advance time beyond 32ms throttle limit
    act(() => {
      vi.advanceTimersByTime(35);
    });

    // Now all other logs should be rendered in the UI
    expect(screen.getByText('[MIDI OUT] status=0x90 note=60 velocity=100')).toBeInTheDocument();
    expect(screen.getByText('[MIDI OUT] status=0x80 note=60 velocity=0')).toBeInTheDocument();
    expect(screen.getByText('[MIDI OUT] status=0x90 note=61 velocity=100')).toBeInTheDocument();
    expect(screen.getByText('[MIDI OUT] status=0x80 note=61 velocity=0')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
