import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import DummyPlugin from './DummyPlugin';

describe('DummyPlugin Event Bus Tests', () => {
  it('dispatches sequential midi events instantly and invokes onMidiOut', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    render(
      <DummyPlugin
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
      />
    );

    // Dispatch 3 'midi' events sequentially wrapped in act
    const event1 = new CustomEvent('midi', { detail: [144, 60, 100] });
    const event2 = new CustomEvent('midi', { detail: [128, 60, 0] });
    const event3 = new CustomEvent('midi', { detail: [144, 64, 100] });

    act(() => {
      mockMidiBus.dispatchEvent(event1);
      mockMidiBus.dispatchEvent(event2);
      mockMidiBus.dispatchEvent(event3);
    });

    // Verify onMidiOut is called exactly 3 times instantly
    expect(mockOnMidiOut).toHaveBeenCalledTimes(3);
    expect(mockOnMidiOut.mock.calls[0][0]).toEqual([144, 60, 100]);
    expect(mockOnMidiOut.mock.calls[1][0]).toEqual([128, 60, 0]);
    expect(mockOnMidiOut.mock.calls[2][0]).toEqual([144, 64, 100]);

    // Check that logs render in the UI
    expect(screen.getByText('[MIDI IN] [144,60,100]')).toBeInTheDocument();
    expect(screen.getByText('[MIDI IN] [128,60,0]')).toBeInTheDocument();
    expect(screen.getByText('[MIDI IN] [144,64,100]')).toBeInTheDocument();
  });
});
