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
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
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

  test('Given sequenceKeyswitches has an entry { 36: 0 }, When sequence[0] is updated to have an empty notes array, Assert the useEffect fires and updates sequenceKeyswitches to {}', () => {
    let currentKeyswitches = { 36: 0 };
    const setKeyswitchesSpy = vi.fn((val) => {
      currentKeyswitches = typeof val === 'function' ? val(currentKeyswitches) : val;
    });

    const TestPruningWrapper: React.FC = () => {
      const [sequence, setSequence] = React.useState([
        { notes: [{ note: 60 }], symbol: 'C' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' },
        { notes: [], symbol: '' }
      ]);

      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        lut: [],
        updateActiveNotes: vi.fn(),
        uiVelocity: 80,
        sequence,
        setSequence,
        mapSequenceToKeys: vi.fn(),
        isListeningForMap: false,
        setIsListeningForMap: vi.fn(),
        sequenceKeyswitches: currentKeyswitches,
        setSequenceKeyswitches: setKeyswitchesSpy,
      });

      return (
        <div>
          <StepSequencer />
          <button data-testid="clear-step-0" onClick={() => {
            setSequence(prev => {
              const next = [...prev];
              next[0] = { notes: [], symbol: '' };
              return next;
            });
          }}>Clear Step 0</button>
        </div>
      );
    };

    render(<TestPruningWrapper />);

    expect(setKeyswitchesSpy).not.toHaveBeenCalled();

    const clearBtn = screen.getByTestId('clear-step-0');
    act(() => {
      clearBtn.click();
    });

    expect(setKeyswitchesSpy).toHaveBeenCalledWith({});
  });

  test('Given the step sequencer has populated steps and active keyswitches, When the Trash Can is clicked, Assert setSequenceKeyswitches({}) is called', () => {
    const mockSetSequenceKeyswitches = vi.fn();
    
    const TestTrashWrapper: React.FC = () => {
      const [sequence, setSequence] = React.useState(Array(8).fill({ notes: [], symbol: '' }));
      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        lut: [],
        updateActiveNotes: vi.fn(),
        uiVelocity: 80,
        sequence,
        setSequence,
        mapSequenceToKeys: vi.fn(),
        isListeningForMap: false,
        setIsListeningForMap: vi.fn(),
        sequenceKeyswitches: { 36: 0 },
        setSequenceKeyswitches: mockSetSequenceKeyswitches,
      });

      return <StepSequencer />;
    };

    render(<TestTrashWrapper />);

    // Click "Clear all steps" (Trash Can) button
    const clearAllButton = screen.getByTitle('Clear all steps');
    expect(clearAllButton).toBeInTheDocument();

    act(() => {
      clearAllButton.click();
    });

    expect(mockSetSequenceKeyswitches).toHaveBeenCalledWith({});
  });

  test('Phase 1: Given sourceNotes is [60, 64], When the copy handler maps the array, Assert copiedNotes remains [60, 64] and not [{id: "..."}]', () => {
    const mockSetSequence = vi.fn();
    const mockSequence = Array(8).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = { notes: [60, 64], symbol: 'C' };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: vi.fn(),
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: mockSetSequence,
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
    });

    const { container } = render(<StepSequencer />);
    const pills = container.querySelectorAll('[data-step-index]');
    
    // Simulate pointer down on step 0 with Alt key
    act(() => {
      const eDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(eDown, 'altKey', { value: true });
      Object.defineProperty(eDown, 'pointerId', { value: 1 });
      pills[0].dispatchEvent(eDown);
    });

    // Simulate pointer move over step 1
    // We mock elementFromPoint to return a mock element with data-step-index="1"
    const originalElementFromPoint = document.elementFromPoint;
    const mockTarget = document.createElement('div');
    mockTarget.setAttribute('data-step-index', '1');
    document.elementFromPoint = () => mockTarget;

    act(() => {
      const eMove = new MouseEvent('pointermove', { bubbles: true, cancelable: true });
      Object.defineProperty(eMove, 'clientX', { value: 10 });
      Object.defineProperty(eMove, 'clientY', { value: 10 });
      pills[0].dispatchEvent(eMove);
    });

    // Simulate pointer up
    act(() => {
      const eUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true });
      Object.defineProperty(eUp, 'pointerId', { value: 1 });
      pills[0].dispatchEvent(eUp);
    });

    // Restore elementFromPoint
    document.elementFromPoint = originalElementFromPoint;

    // Check setSequence was called
    expect(mockSetSequence).toHaveBeenCalled();
    const updateFn = mockSetSequence.mock.calls[0][0];
    const nextSequence = updateFn(mockSequence);
    expect(nextSequence[1].notes).toEqual([60, 64]);
  });

  test('Phase 2: Given a note object with stepOffset: NaN, When computeMiniLayout runs, Assert the function completes successfully without freezing the main thread', () => {
    const mockSequence = Array(8).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = {
      notes: [{ stepOffset: NaN, isTreble: true, accidental: '#' }],
      symbol: 'C'
    };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: vi.fn(),
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
    });

    const renderTask = () => render(<StepSequencer />);
    expect(renderTask).not.toThrow();
  });
});

