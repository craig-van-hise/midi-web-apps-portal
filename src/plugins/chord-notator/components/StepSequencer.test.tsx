import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { StepSequencer } from './StepSequencer';
import { useMidi } from '../midi/MIDIProvider';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

vi.mock('../audio/engine', () => ({
  audioEngine: {
    noteOn: vi.fn(),
    releaseNote: vi.fn(),
    releaseAll: vi.fn(),
  },
}));

describe('StepSequencer Component UI & Copy Instructions', () => {
  const mockUpdateActiveNotes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
    });
  });

  test('should render the step sequencer grid and record button', () => {
    const { container } = render(<StepSequencer />);
    
    // Check record button is present
    const recordButton = container.querySelector('button');
    expect(recordButton).toBeInTheDocument();
  });

  test('should render 8 step/bar columns', () => {
    const { container } = render(<StepSequencer />);
    
    // The sequence loop maps 8 bars, each container has data-step-index attribute
    const stepContainers = container.querySelectorAll('[data-step-index]');
    expect(stepContainers.length).toBe(8);
  });
});
