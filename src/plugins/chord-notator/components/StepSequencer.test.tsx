import React from 'react';
import { render, screen, act } from '@testing-library/react';
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
  });

  const TestWrapper: React.FC<{
    mockMapSequenceToKeys?: any;
    initialIsListening?: boolean;
  }> = ({ mockMapSequenceToKeys = vi.fn(), initialIsListening = false }) => {
    const [isListening, setIsListening] = React.useState(initialIsListening);
    const [sequence, setSequence] = React.useState(Array(8).fill({ notes: [], symbol: '' }));
    
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence,
      setSequence,
      mapSequenceToKeys: mockMapSequenceToKeys,
      isListeningForMap: isListening,
      setIsListeningForMap: setIsListening,
    });

    return <StepSequencer />;
  };

  test('should render the step sequencer grid and record button', () => {
    const { container } = render(<TestWrapper />);
    
    // Check record button is present
    const recordButton = container.querySelector('button');
    expect(recordButton).toBeInTheDocument();
  });

  test('should render 8 step/bar columns', () => {
    const { container } = render(<TestWrapper />);
    
    // The sequence loop maps 8 bars, each container has data-step-index attribute
    const stepContainers = container.querySelectorAll('[data-step-index]');
    expect(stepContainers.length).toBe(8);
  });

  test('Given isListeningForMap is true, When the UI renders, Assert the instructional overlay and Cancel button are visible', () => {
    const { container } = render(<TestWrapper />);

    const mapButton = screen.getByTitle('Map to Keys (Or Option+Drag to virtual keyboard)');
    act(() => {
      mapButton.click();
    });

    // Check overlay container exists and contains the helper text
    const helperText = screen.getByText(/Press any key on your MIDI controller or virtual keyboard/i);
    expect(helperText).toBeInTheDocument();

    // Check Cancel button exists
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelButton).toBeInTheDocument();

    // Clicking Cancel should turn off listening mode and hide the overlay
    act(() => {
      cancelButton.click();
    });
    expect(screen.queryByText(/Press any key on your MIDI controller or virtual keyboard/i)).not.toBeInTheDocument();
  });

  test('Given a rendered StepSequencer, Assert 8 distinct bar number elements exist containing text "1" through "8"', () => {
    const { container } = render(<TestWrapper />);
    
    // We should find elements with text "1" through "8"
    for (let i = 1; i <= 8; i++) {
      const barNumElement = screen.getByText(i.toString());
      expect(barNumElement).toBeInTheDocument();
      // Ensure it is styled as absolute top-1 left-2
      expect(barNumElement.className).toContain('absolute');
      expect(barNumElement.className).toContain('top-1');
      expect(barNumElement.className).toContain('left-2');
    }
  });
});
