// @ts-nocheck
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChordNotator from './index';
import { useMidi } from './midi/MIDIProvider';

vi.mock('./midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
  MIDIProvider: ({ children }) => <>{children}</>,
}));

vi.mock('./components/Keyboard', () => ({
  default: () => <div data-testid="keyboard" />,
  updateKeyVisuals88: vi.fn(),
}));

vi.mock('./components/NotationCanvas', () => ({
  default: () => <div data-testid="notation-canvas" />,
}));

vi.mock('./components/SettingsModal', () => ({
  default: () => null,
}));

vi.mock('./components/InfoModal', () => ({
  default: () => null,
}));

vi.mock('./components/toolbar/TransformationsDrawer', () => ({
  TransformationsDrawer: () => <div data-testid="transformations-drawer" />,
}));

describe('ChordNotator Hardware Event Bus Routing', () => {
  it('should invoke dispatchPhysicalMidi instead of dispatchVirtualMidi when midiBus fires an event', () => {
    const mockMidiBus = new EventTarget();
    const mockDispatchVirtualMidi = vi.fn();
    const mockDispatchPhysicalMidi = vi.fn();
    
    vi.mocked(useMidi).mockReturnValue({
      dispatchVirtualMidi: mockDispatchVirtualMidi,
      dispatchPhysicalMidi: mockDispatchPhysicalMidi,
      handleMidiPanic: vi.fn(),
      sequence: Array(8).fill({ notes: [], symbol: '' }),
      setSequence: vi.fn(),
      sequenceKeyswitches: {},
      mapSequenceToKeys: vi.fn(),
    });

    render(
      <ChordNotator
        midiBus={mockMidiBus}
        onMidiOut={vi.fn()}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={false}
      />
    );

    act(() => {
      mockMidiBus.dispatchEvent(new CustomEvent('midi', { detail: [144, 60, 100] }));
    });

    expect(mockDispatchPhysicalMidi).toHaveBeenCalledWith(new Uint8Array([144, 60, 100]));
    expect(mockDispatchVirtualMidi).not.toHaveBeenCalled();
  });

  it('PRP 138 Phase 4 Test Case 2: Given isWriteMode === true, When rendering the workspace, Assert the Write Mode accidental toolbar is rendered outside the StepSequencer container', () => {
    vi.mocked(useMidi).mockReturnValue({
      dispatchVirtualMidi: vi.fn(),
      dispatchPhysicalMidi: vi.fn(),
      handleMidiPanic: vi.fn(),
      sequence: Array(12).fill({ notes: [], symbol: '' }),
      setSequence: vi.fn(),
      sequenceKeyswitches: {},
      mapSequenceToKeys: vi.fn(),
      isWriteMode: true,
      setIsWriteMode: vi.fn(),
      accidentalOverride: null,
      setAccidentalOverride: vi.fn(),
    });

    const { container } = render(
      <ChordNotator
        midiBus={new EventTarget()}
        onMidiOut={vi.fn()}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={false}
      />
    );

    const accidentalToolbox = container.querySelector('[title="Accidental Toolbox"]');
    expect(accidentalToolbox).toBeInTheDocument();
    
    // Accidental toolbox is rendered outside StepSequencer
    expect(accidentalToolbox.closest('.border-black\\/10')).toBeNull();
  });
});
