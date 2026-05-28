import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import MidiTransposerPlugin from './index';
import { useMidiStore } from './store/useMidiStore';
import KeySplitKeyboard from './components/KeySplitKeyboard';


describe('MidiTransposerPlugin Headless Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMidiStore.setState({
      bypass: false,
      activeChannels: Array.from({ length: 16 }, (_, i) => i + 1),
      zones: [
        { id: 'z-trans', type: 'transpose', startNote: 21, endNote: 59, color: '#f97316', octave: 1 },
        { id: 'z-play', type: 'play', startNote: 60, endNote: 108, color: '#3b82f6', octave: 0 },
      ],
      transposeOctave: 1,
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

  it('has correct defaults (Phase 2 Test Case 1)', () => {
    const state = useMidiStore.getState();
    expect(state.transposeOctave).toBe(1);
    expect(state.zones[0].color).toBe('#f97316');
    expect(state.zones[0].octave).toBe(1);
  });

  it('allows polyphony in play zone when transposeTargets has 1 target (Phase 2 Test Case 2)', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    useMidiStore.setState({
      polyphonyMode: 'poly',
      transposeTargets: [60], // 1 target
    });

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

    // Send 3 play zone Note-On events
    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 60, 100] }));
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 62, 100] }));
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 64, 100] }));
    });

    // All 3 notes should be routed to output without sending Note-Offs for previous notes
    const midiOnCalls = mockOnMidiOut.mock.calls.filter(call => (call[0][0] & 0xf0) === 0x90);
    const midiOffCalls = mockOnMidiOut.mock.calls.filter(call => (call[0][0] & 0xf0) === 0x80);

    expect(midiOnCalls).toHaveLength(3);
    expect(midiOffCalls).toHaveLength(0);
  });

  it('restricts play zone to monophony when transposeTargets has more than 1 target (Phase 2 Test Case 3)', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    useMidiStore.setState({
      polyphonyMode: 'poly',
      transposeTargets: [60, 64], // 2 targets
    });

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

    // Send 3 play zone Note-On events in sequence
    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 60, 100] }));
    });
    // First note should trigger 2 output notes (one for each transpose target)
    // Transpose origin is 60. Target 60 -> diff 0 -> output 60. Target 64 -> diff 4 -> output 64.
    expect(mockOnMidiOut).toHaveBeenLastCalledWith([144, 64, 100]);
    mockOnMidiOut.mockClear();

    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 62, 100] }));
    });
    // Second note should trigger Note-Off for the previous note (60 and 64), and Note-On for 62 (targets: 62 and 66)
    const midiOffCalls = mockOnMidiOut.mock.calls.filter(call => (call[0][0] & 0xf0) === 0x80);
    const midiOnCalls = mockOnMidiOut.mock.calls.filter(call => (call[0][0] & 0xf0) === 0x90);

    expect(midiOffCalls).toHaveLength(2);
    expect(midiOffCalls.map(c => c[0][1])).toContain(60);
    expect(midiOffCalls.map(c => c[0][1])).toContain(64);

    expect(midiOnCalls).toHaveLength(2);
    expect(midiOnCalls.map(c => c[0][1])).toContain(62);
    expect(midiOnCalls.map(c => c[0][1])).toContain(66);
  });

  it('given KeySplitKeyboard, when playNote(60) is called, asserts simulateMidi is called with [144, 60, 100] (Phase 3 Test Case 1)', () => {
    const mockSimulateMidi = vi.fn();
    render(
      <KeySplitKeyboard
        onZonesChange={vi.fn()}
        simulateMidi={mockSimulateMidi}
      />
    );

    const keyEl = document.getElementById('pksplit-60');
    expect(keyEl).toBeInTheDocument();
    
    act(() => {
      keyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockSimulateMidi).toHaveBeenCalledWith([144, 60, 100]);
  });
});

