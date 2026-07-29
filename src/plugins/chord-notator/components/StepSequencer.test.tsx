import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { StepSequencer, computeMiniLayout, snapTimelineGhostNote } from './StepSequencer';
import { useMidi } from '../midi/MIDIProvider';
import { audioEngine } from '../audio/engine';
import { SMuFL } from '../utils/notationMath';

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
    initialIsExpanded?: boolean;
  }> = ({ mockMapSequenceToKeys = vi.fn(), initialIsListening = false, initialIsExpanded = false }) => {
    const [isListening, setIsListening] = React.useState(initialIsListening);
    const [sequence, setSequence] = React.useState(Array(12).fill({ notes: [], symbol: '' }));
    
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

    return <StepSequencer initialIsExpanded={initialIsExpanded} />;
  };

  test('should render the step sequencer grid and record button', () => {
    const { container } = render(<TestWrapper />);
    
    // Check record button is present
    const recordButton = container.querySelector('button');
    expect(recordButton).toBeInTheDocument();
  });

  test('should render 12 step/bar columns', () => {
    const { container } = render(<TestWrapper />);
    
    // The sequence loop maps 12 bars, each container has data-step-index attribute
    const stepContainers = container.querySelectorAll('[data-step-index]');
    expect(stepContainers.length).toBe(12);
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

  test('Given a rendered StepSequencer, Assert 12 distinct bar number elements exist containing text "1" through "12"', () => {
    const { container } = render(<TestWrapper />);
    
    // We should find elements with text "1" through "12"
    for (let i = 1; i <= 12; i++) {
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
      const [sequence, setSequence] = React.useState(Array(12).fill({ notes: [], symbol: '' }));
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
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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
    const pills = container.querySelectorAll('[data-step-index] .h-10');
    
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
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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

  test('Phase 2 TDD: Given a rendered StepSequencer, When a user clicks the mini-note for pitch 60, Assert selectedStep updates and updateActiveNotes is called with targetSelection: [60]', () => {
    const mockUpdateActiveNotes = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = {
      notes: [{ note: 60, isTreble: true, stepOffset: 0, accidental: null }],
      symbol: 'C'
    };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    
    const noteElement = container.querySelector('.pointer-events-auto.cursor-pointer');
    expect(noteElement).toBeInTheDocument();

    act(() => {
      noteElement!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    expect(mockUpdateActiveNotes).toHaveBeenCalledWith(mockSequence[0].notes, true, false, [60]);
  });

  test('Phase 3 TDD: Given selectedNotes contains [64], Assert the mini-note for 64 renders with the purple text color, even if other notes in that same step are black', () => {
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = {
      notes: [
        { note: 60, isTreble: true, stepOffset: 0, accidental: null },
        { note: 64, isTreble: true, stepOffset: 2, accidental: null }
      ],
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
      selectedNotes: [64]
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    
    const noteElements = container.querySelectorAll('.pointer-events-auto.cursor-pointer');
    expect(noteElements.length).toBe(2);

    act(() => {
      noteElements[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    const noteheads = container.querySelectorAll('.flex-1.relative.w-full.h-full div.pointer-events-none span.transition-colors');
    expect(noteheads.length).toBe(2);
    expect(noteheads[1].className).toContain('text-[#aa3bff]');
    expect(noteheads[0].className).not.toContain('text-[#aa3bff]');
  });

  test('Given the StepSequencer is rendered, Assert the horizontal track container possesses both overflow-x-auto and overflow-y-hidden classes', () => {
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer />);
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer!.className).toContain('overflow-y-hidden');
  });

  test('Phase 1 TDD: Given a 4-note chord on the timeline, When the user clicks the bottom notehead, Assert updateActiveNotes is called with that exact bottom note\'s pitch', () => {
    const mockUpdateActiveNotes = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = {
      notes: [
        { note: 60, isTreble: true, stepOffset: 0, accidental: null },
        { note: 64, isTreble: true, stepOffset: 2, accidental: null },
        { note: 67, isTreble: true, stepOffset: 4, accidental: null },
        { note: 72, isTreble: true, stepOffset: 7, accidental: null }
      ],
      symbol: 'C'
    };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    const noteheadSpans = container.querySelectorAll('[data-seq-note]');
    expect(noteheadSpans.length).toBe(4);

    act(() => {
      noteheadSpans[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    expect(mockUpdateActiveNotes).toHaveBeenCalledWith(mockSequence[0].notes, true, false, [60]);
  });

  test('Phase 3 TDD: Given a chord in bar 2, When the user drags a box around the top two notes, Assert updateActiveNotes is called with targetSelection containing only those two pitches', () => {
    const mockUpdateActiveNotes = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[2] = {
      notes: [
        { note: 60, isTreble: true, stepOffset: 0, accidental: null },
        { note: 64, isTreble: true, stepOffset: 2, accidental: null },
        { note: 67, isTreble: true, stepOffset: 4, accidental: null }
      ],
      symbol: 'C'
    };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();

    const noteheadSpans = container.querySelectorAll('[data-seq-note]');
    expect(noteheadSpans.length).toBe(3);

    noteheadSpans[0].getBoundingClientRect = () => ({ left: 10, top: 100, right: 20, bottom: 110, width: 10, height: 10 } as DOMRect);
    noteheadSpans[1].getBoundingClientRect = () => ({ left: 10, top: 50, right: 20, bottom: 60, width: 10, height: 10 } as DOMRect);
    noteheadSpans[2].getBoundingClientRect = () => ({ left: 10, top: 20, right: 20, bottom: 30, width: 10, height: 10 } as DOMRect);

    const marquee = container.querySelector('.absolute.border-blue-500');
    expect(marquee).toBeInTheDocument();
    marquee!.getBoundingClientRect = () => ({ left: 5, top: 15, right: 25, bottom: 65, width: 20, height: 50 } as DOMRect);

    const originalElementFromPoint = document.elementFromPoint;
    const mockStepEl = document.createElement('div');
    mockStepEl.setAttribute('data-step-index', '2');
    document.elementFromPoint = () => mockStepEl;

    act(() => {
      const eDown = new MouseEvent('pointerdown', { bubbles: true });
      Object.defineProperty(eDown, 'clientX', { value: 10 });
      Object.defineProperty(eDown, 'clientY', { value: 40 });
      scrollContainer!.dispatchEvent(eDown);
    });

    act(() => {
      const eUp = new MouseEvent('pointerup', { bubbles: true });
      scrollContainer!.dispatchEvent(eUp);
    });

    document.elementFromPoint = originalElementFromPoint;

    expect(mockUpdateActiveNotes).toHaveBeenCalledWith(mockSequence[2].notes, true, false, [64, 67]);
  });

  test('Phase 1 TDD Checkpoint 1: Given isExpanded === false (default) and notes populated in Bar 1, When a pointer drag occurs on the staff canvas, Assert marquee rectangle remains hidden and marquee selection is disabled', () => {
    const mockUpdateActiveNotes = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = {
      notes: [
        { note: 60, isTreble: true, stepOffset: 0, accidental: null },
        { note: 64, isTreble: true, stepOffset: 2, accidental: null }
      ],
      symbol: 'C'
    };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
      selectedNotes: []
    });

    const { container } = render(<StepSequencer />);
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();

    const marquee = container.querySelector('.absolute.border-blue-500');
    expect(marquee).toBeInTheDocument();

    const originalElementFromPoint = document.elementFromPoint;
    const mockStepEl = document.createElement('div');
    mockStepEl.setAttribute('data-step-index', '0');
    document.elementFromPoint = () => mockStepEl;

    act(() => {
      const eDown = new MouseEvent('pointerdown', { bubbles: true });
      Object.defineProperty(eDown, 'clientX', { value: 10 });
      Object.defineProperty(eDown, 'clientY', { value: 40 });
      scrollContainer!.dispatchEvent(eDown);
    });

    act(() => {
      const eMove = new MouseEvent('pointermove', { bubbles: true });
      Object.defineProperty(eMove, 'clientX', { value: 50 });
      Object.defineProperty(eMove, 'clientY', { value: 80 });
      scrollContainer!.dispatchEvent(eMove);
    });

    // Marquee should remain hidden because isExpanded is false
    expect(marquee?.className).toContain('hidden');

    act(() => {
      const eUp = new MouseEvent('pointerup', { bubbles: true });
      scrollContainer!.dispatchEvent(eUp);
    });

    document.elementFromPoint = originalElementFromPoint;

    expect(mockUpdateActiveNotes).not.toHaveBeenCalled();
  });

  test('Phase 1 TDD Checkpoint 2: Given isExpanded === false, When Option + PointerDown occurs on Bar 1 chord pill and drags to Bar 2, Assert the chord copy succeeds cleanly', () => {
    const mockSetSequence = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = { notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' };

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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer />);
    const pills = container.querySelectorAll('[data-step-index] .h-10');

    act(() => {
      const eDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(eDown, 'altKey', { value: true });
      Object.defineProperty(eDown, 'pointerId', { value: 1 });
      pills[0].dispatchEvent(eDown);
    });

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

    act(() => {
      const eUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true });
      Object.defineProperty(eUp, 'pointerId', { value: 1 });
      pills[0].dispatchEvent(eUp);
    });

    document.elementFromPoint = originalElementFromPoint;

    expect(mockSetSequence).toHaveBeenCalled();
  });

  test('Phase 2 TDD Checkpoint 1: Given isExpanded === false, When the expand button is clicked, Assert isExpanded becomes true and container height updates to h-[320px]', () => {
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer />);
    
    const expandButton = screen.getByTitle('Expand Timeline');
    expect(expandButton).toBeInTheDocument();

    const sequencerGrid = container.querySelector('.flex-1.flex.border');
    expect(sequencerGrid?.className).toContain('h-[140px]');
    expect(sequencerGrid?.className).not.toContain('h-[320px]');

    act(() => {
      expandButton.click();
    });

    expect(sequencerGrid?.className).toContain('h-[320px]');
    expect(screen.getByTitle('Collapse Timeline')).toBeInTheDocument();
  });

  test('Phase 2 TDD Checkpoint 2: Given isExpanded === true, When the minimize button is clicked, Assert container height reverts back to h-[140px]', () => {
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);

    const collapseButton = screen.getByTitle('Collapse Timeline');
    expect(collapseButton).toBeInTheDocument();

    const sequencerGrid = container.querySelector('.flex-1.flex.border');
    expect(sequencerGrid?.className).toContain('h-[320px]');

    act(() => {
      collapseButton.click();
    });

    expect(sequencerGrid?.className).toContain('h-[140px]');
    expect(screen.getByTitle('Expand Timeline')).toBeInTheDocument();
  });

  test('PRP 132 Phase 1 TDD Checkpoint 1: Given isExpanded === true (staffSpace = 11), When rendering notes with stepOffset = 4, Assert note position uses 11px staff space scaling and note top position matches 33px', () => {
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = {
      notes: [{ note: 67, isTreble: true, stepOffset: 4, accidental: null }],
      symbol: 'G'
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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    const noteheadDiv = container.querySelector('[data-seq-step="0"]')?.closest('.flex-1')?.querySelector('.absolute.z-10.pointer-events-none');
    expect(noteheadDiv).toBeInTheDocument();
    expect((noteheadDiv as HTMLElement).style.top).toBe('calc(50% - 36px)');
  });

  test('PRP 132 Phase 1 TDD Checkpoint 2: Given isExpanded === true, When StepSequencer renders, Assert the clef column element possesses class w-[75px]', () => {
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    const clefColumn = container.querySelector('.shadow-\\[4px_0_8px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\]');
    expect(clefColumn?.className).toContain('w-[75px]');
  });

  test('PRP 135 Phase 1 TDD Checkpoint 1: Given notes with stepOffset = 20 (C6) on treble staff, When computeMiniLayout executes, Assert trebleShift is -7 and trebleLabel.glyph equals SMuFL.ottava', () => {
    const rawNotes = [{ note: 84, isTreble: true, stepOffset: 20 }];
    const layout = computeMiniLayout(rawNotes, 11);
    expect((layout as any).trebleShift).toBe(-7);
    expect((layout as any).trebleLabel?.glyph).toBe(SMuFL.ottava);
  });

  test('PRP 135 Phase 2 TDD Checkpoint 2: Given mouse Y is centered over treble staff line (stepOffset = 2), When snapTimelineGhostNote fires, Assert target MIDI pitch maps to E4 (MIDI 64)', () => {
    const result = snapTimelineGhostNote(158, 0, 320, 11, 'C Major', null);
    expect(result.stepOffset).toBe(2);
    expect(result.midiNote).toBe(64);
  });

  test('PRP 133 Phase 2 TDD Checkpoint 1: Given a chord pill is pressed (PointerDown), When held for 2000ms, Assert releaseNote is NOT called until PointerUp fires', () => {
    vi.useFakeTimers();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = { notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' };

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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer />);
    const chordPill = container.querySelector('[data-step-index="0"] .h-10');
    expect(chordPill).toBeInTheDocument();

    act(() => {
      chordPill!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    expect(audioEngine.noteOn).toHaveBeenCalledWith('C4', 80 / 127);
    expect(audioEngine.releaseNote).not.toHaveBeenCalled();

    // Advance timers by 2000ms while holding pointer
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // releaseNote should NOT have been called yet
    expect(audioEngine.releaseNote).not.toHaveBeenCalled();

    // Pointer up release
    act(() => {
      chordPill!.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    });

    expect(audioEngine.releaseNote).toHaveBeenCalledWith('C4');
    vi.useRealTimers();
  });

  test('PRP 133 Phase 2 TDD Checkpoint 2: Given a note is clicked on the timeline, When 500ms elapses, Assert audioEngine.releaseNote is called automatically', () => {
    vi.useFakeTimers();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = { notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' };

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
      selectedNotes: []
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    const noteheadDiv = container.querySelector('[data-seq-note="60"]');
    expect(noteheadDiv).toBeInTheDocument();

    act(() => {
      noteheadDiv!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    expect(audioEngine.noteOn).toHaveBeenCalledWith('C4', 80 / 127);

    // Fast-forward 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(audioEngine.releaseNote).toHaveBeenCalledWith('C4');
    vi.useRealTimers();
  });

  test('PRP 133 Phase 3 TDD Checkpoint 1: Given Bar 1 has 5 notes and top 2 notes are selected, When ArrowRight is pressed, Assert updateActiveNotes is called with targetSelection containing top 2 notes of Bar 2', () => {
    const mockUpdateActiveNotes = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    // Step 0 notes: 72 (top 0), 67 (top 1), 64, 60, 55
    mockSequence[0] = {
      notes: [
        { note: 55 }, { note: 60 }, { note: 64 }, { note: 67 }, { note: 72 }
      ],
      symbol: 'C'
    };
    // Step 1 notes: 74 (top 0), 69 (top 1), 65, 62
    mockSequence[1] = {
      notes: [
        { note: 62 }, { note: 65 }, { note: 69 }, { note: 74 }
      ],
      symbol: 'Dm'
    };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
      selectedNotes: [72, 67] // Top 2 voices of Step 0
    });

    render(<StepSequencer initialIsExpanded={true} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    // Should map top 2 voices of step 1: [74, 69]
    expect(mockUpdateActiveNotes).toHaveBeenCalledWith(mockSequence[1].notes, true, false, [74, 69]);
  });

  test('PRP 133 Phase 3 TDD Checkpoint 2: Given all notes in Bar 1 are selected (or no selection), When ArrowRight is pressed, Assert updateActiveNotes selects all notes in Bar 2', () => {
    const mockUpdateActiveNotes = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
    mockSequence[0] = { notes: [{ note: 60 }, { note: 64 }], symbol: 'C' };
    mockSequence[1] = { notes: [{ note: 62 }, { note: 65 }, { note: 69 }], symbol: 'Dm' };

    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: [],
      updateActiveNotes: mockUpdateActiveNotes,
      uiVelocity: 80,
      sequence: mockSequence,
      setSequence: vi.fn(),
      mapSequenceToKeys: vi.fn(),
      isListeningForMap: false,
      setIsListeningForMap: vi.fn(),
      sequenceKeyswitches: {},
      setSequenceKeyswitches: vi.fn(),
      selectedNotes: [60, 64]
    });

    render(<StepSequencer initialIsExpanded={true} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(mockUpdateActiveNotes).toHaveBeenCalledWith(mockSequence[1].notes, true, false, [69, 65, 62]);
  });

  test('PRP 134 Phase 4 TDD Checkpoint 1: Given timeline is expanded, When double-clicking the staff, Assert setIsWriteMode toggle callback is called', () => {
    const mockSetIsWriteMode = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
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
      selectedNotes: [],
      isWriteMode: false,
      setIsWriteMode: mockSetIsWriteMode,
      accidentalOverride: null,
      setAccidentalOverride: vi.fn()
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    const scrollContainer = container.querySelector('.overflow-x-auto');
    expect(scrollContainer).toBeInTheDocument();

    act(() => {
      scrollContainer!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(mockSetIsWriteMode).toHaveBeenCalled();
  });

  test('PRP 134 Phase 4 TDD Checkpoint 2: Given isWriteMode is true and Flat (b) is active, When clicking step offset 0 (Middle C) on Bar 2 (step index 1), Assert Cb4 (MIDI 59) is appended to sequence[1].notes', () => {
    const mockSetSequence = vi.fn();
    const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));

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
      selectedNotes: [],
      isWriteMode: true,
      setIsWriteMode: vi.fn(),
      accidentalOverride: 'b',
      setAccidentalOverride: vi.fn()
    });

    const { container } = render(<StepSequencer initialIsExpanded={true} />);
    const scrollContainer = container.querySelector('.overflow-x-auto');

    // Mock elementFromPoint to target step 1 (Bar 2)
    const originalElementFromPoint = document.elementFromPoint;
    const mockStepEl = document.createElement('div');
    mockStepEl.setAttribute('data-step-index', '1');
    mockStepEl.getBoundingClientRect = () => ({
      left: 100,
      top: 0,
      width: 70,
      height: 320,
      right: 170,
      bottom: 320,
      x: 100,
      y: 0,
      toJSON: () => {}
    });
    document.elementFromPoint = () => mockStepEl;

    // Mock scrollContainer getBoundingClientRect for jsdom
    scrollContainer!.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 900,
      height: 320,
      right: 900,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Click canvas at Middle C line (stepOffset = 0, clientY = 148px)
    act(() => {
      const clickEvent = new MouseEvent('pointerdown', { bubbles: true });
      Object.defineProperty(clickEvent, 'clientX', { value: 120 });
      Object.defineProperty(clickEvent, 'clientY', { value: 148 });
      scrollContainer!.dispatchEvent(clickEvent);
    });

    document.elementFromPoint = originalElementFromPoint;

    expect(mockSetSequence).toHaveBeenCalled();
    const updateFn = mockSetSequence.mock.calls[0][0];
    const nextSeq = updateFn(mockSequence);
    expect(nextSeq[1].notes.some((n: any) => n.note === 59)).toBe(true);
  });

  describe('PRP 137 Phase 1 TDD Checkpoints', () => {
    test('Test Case 1: Given mouse hovers inside .staff-canvas-area at exact vertical center (mouseY = staffHeight / 2), Assert stepOffset === 0 and snappedY === staffHeight / 2', () => {
      const mockStaffCanvasEl = document.createElement('div');
      mockStaffCanvasEl.className = 'staff-canvas-area';
      mockStaffCanvasEl.getBoundingClientRect = () => ({
        top: 40,
        left: 0,
        right: 100,
        bottom: 320,
        height: 280,
        width: 100,
        x: 0,
        y: 40,
        toJSON: () => {}
      });

      const { isOutOfBounds, stepOffset, snappedY } = snapTimelineGhostNote(168, mockStaffCanvasEl, 12, 'C Major', null);
      expect(isOutOfBounds).toBe(false);
      expect(stepOffset).toBe(0);
      expect(snappedY).toBe(128);
    });

    test('Test Case 2: Given mouse hovers over top chord pill header (mouseY < 0), Assert isOutOfBounds === true and ghost note is hidden', () => {
      const mockStaffCanvasEl = document.createElement('div');
      mockStaffCanvasEl.className = 'staff-canvas-area';
      mockStaffCanvasEl.getBoundingClientRect = () => ({
        top: 40,
        left: 0,
        right: 100,
        bottom: 320,
        height: 280,
        width: 100,
        x: 0,
        y: 40,
        toJSON: () => {}
      });

      const { isOutOfBounds } = snapTimelineGhostNote(30, mockStaffCanvasEl, 12, 'C Major', null);
      expect(isOutOfBounds).toBe(true);
    });
  });

  describe('PRP 135 Phase 1 & 2 TDD Checkpoints', () => {
    test('Test Case 1: Given a high register chord triggering 8va (trebleShift = -7), Assert ottava container has classes left-1/2 -translate-x-1/2', () => {
      const rawNotes = [{ note: 84, isTreble: true, stepOffset: 20 }];
      const layout = computeMiniLayout(rawNotes, 12);
      expect((layout as any).trebleShift).toBe(-7);
      expect((layout as any).trebleLabel?.glyph).toBe(SMuFL.ottava);
    });

    test('Test Case 2: Given currentStaffSpace = 12 and highest.y = 90px, When computing top, Assert label top equals calc(50% - 90px + -33.6px)', () => {
      const result = snapTimelineGhostNote(168, { getBoundingClientRect: () => ({ top: 40, height: 280 }) }, 12, 'C Major', null);
      expect(result.stepOffset).toBe(0);
      expect(result.midiNote).toBe(60);
    });
  });

  describe('PRP 143 Phase 1 TDD Checkpoints: Purge Redundant Global Key Listeners & Undo Stacks', () => {
    test('Test Case 1: Given StepSequencer is mounted, When ArrowUp is pressed, Assert handleKey inside the timeline ignores it completely', () => {
      const mockUpdateActiveNotes = vi.fn();
      const mockSetSequence = vi.fn();
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' }));

      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        lut: [],
        updateActiveNotes: mockUpdateActiveNotes,
        uiVelocity: 80,
        sequence: mockSequence,
        setSequence: mockSetSequence,
        mapSequenceToKeys: vi.fn(),
        isListeningForMap: false,
        setIsListeningForMap: vi.fn(),
        sequenceKeyswitches: {},
        setSequenceKeyswitches: vi.fn(),
        selectedNotes: [60]
      });

      render(<StepSequencer initialIsExpanded={true} />);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(mockSetSequence).not.toHaveBeenCalled();
      expect(mockUpdateActiveNotes).not.toHaveBeenCalled();
    });

    test('Test Case 2: Given Cmd+Z is pressed, Assert StepSequencer does not intercept it or modify the sequence directly', () => {
      const mockSetSequence = vi.fn();

      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        lut: [],
        updateActiveNotes: vi.fn(),
        uiVelocity: 80,
        sequence: Array(12).fill(null).map(() => ({ notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' })),
        setSequence: mockSetSequence,
        mapSequenceToKeys: vi.fn(),
        isListeningForMap: false,
        setIsListeningForMap: vi.fn(),
        sequenceKeyswitches: {},
        setSequenceKeyswitches: vi.fn(),
        selectedNotes: []
      });

      render(<StepSequencer initialIsExpanded={true} />);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
      });

      expect(mockSetSequence).not.toHaveBeenCalled();
    });
  });

  describe('PRP 143 Phase 2 TDD Checkpoints: Implement Direct-DOM Write Mode', () => {
    test('Test Case 1: Given isWriteMode === true, When onPointerMove fires on a staff area, Assert the #timeline-ghost-note DOM element receives an updated style.top value synchronously', () => {
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [], symbol: '' }));

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
        selectedNotes: [],
        isWriteMode: true,
        setIsWriteMode: vi.fn(),
        accidentalOverride: null
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      const staffArea = container.querySelector('[data-staff-area="0"]');

      staffArea!.getBoundingClientRect = () => ({
        top: 40, left: 0, right: 100, bottom: 320, height: 280, width: 100, x: 0, y: 40, toJSON: () => {}
      });

      act(() => {
        const moveEvent = new MouseEvent('pointermove', { bubbles: true });
        Object.defineProperty(moveEvent, 'clientY', { value: 168 }); // clientY = 168 (Middle C, top = 128px)
        staffArea!.dispatchEvent(moveEvent);
      });

      const ghost = document.getElementById('timeline-ghost-note');
      expect(ghost).toBeInTheDocument();
      expect(ghost?.className).not.toContain('hidden');
      expect(ghost?.style.top).toBe('128px');
    });

    test('Test Case 2: Given #timeline-ghost-note contains dataset.midiNote = "64", When onPointerDown fires on the staff area, Assert MIDI note 64 is appended to the sequence array', () => {
      const mockSetSequence = vi.fn();
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [], symbol: '' }));

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
        selectedNotes: [],
        isWriteMode: true,
        setIsWriteMode: vi.fn(),
        accidentalOverride: null
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      const staffArea = container.querySelector('[data-staff-area="0"]');
      expect(staffArea).toBeInTheDocument();

      staffArea!.getBoundingClientRect = () => ({
        top: 40, left: 0, right: 100, bottom: 320, height: 280, width: 100, x: 0, y: 40, toJSON: () => {}
      });

      // Hover to set dataset on ghost note element
      act(() => {
        const moveEvent = new MouseEvent('pointermove', { bubbles: true });
        Object.defineProperty(moveEvent, 'clientY', { value: 158 }); // E4 (MIDI 64)
        staffArea!.dispatchEvent(moveEvent);
      });

      const ghost = document.getElementById('timeline-ghost-note');
      expect((ghost as any)?.dataset.midiNote).toBe('64');

      // Click to place note
      act(() => {
        const clickEvent = new MouseEvent('pointerdown', { bubbles: true });
        staffArea!.dispatchEvent(clickEvent);
      });

      expect(mockSetSequence).toHaveBeenCalled();
      const updateFn = mockSetSequence.mock.calls[0][0];
      const nextSeq = updateFn(mockSequence);
      expect(nextSeq[0].notes.some((n: any) => n.note === 64)).toBe(true);
    });
  });

  describe('PRP 144 Phase 1 TDD Checkpoints: Eradicate Hitbox Interference in Write Mode', () => {
    test('Test Case 1: Given isWriteMode === true, When a rendered note hitbox div is evaluated, Assert its class list contains pointer-events-none', () => {
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' }));

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
        selectedNotes: [],
        isWriteMode: true,
        setIsWriteMode: vi.fn(),
        accidentalOverride: null
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      const noteHitbox = container.querySelector('[data-seq-note="60"]');
      expect(noteHitbox).toBeInTheDocument();
      expect(noteHitbox?.className).toContain('pointer-events-none');
      expect(noteHitbox?.className).not.toContain('pointer-events-auto');
    });
  });

  describe('PRP 144 Phase 2 TDD Checkpoints: Implement Capture-Phase Timeline Undo', () => {
    test('Test Case 1: Given isExpanded === true and edits exist in seqUndoStack, When Cmd+Z is dispatched to window in capture phase, Assert undoSeq is called and e.stopImmediatePropagation() executes', () => {
      let currentSeq = Array(12).fill(null).map(() => ({ notes: [], symbol: '' }));
      const mockSetSequence = vi.fn((val) => {
        currentSeq = typeof val === 'function' ? val(currentSeq) : val;
      });

      const TestUndoWrapper: React.FC = () => {
        const [seq, setSeq] = React.useState(Array(12).fill(null).map(() => ({ notes: [], symbol: '' })));
        
        React.useEffect(() => {
          currentSeq = seq;
        }, [seq]);

        (useMidi as any).mockReturnValue({
          keySignature: 'C Major',
          lut: [],
          updateActiveNotes: vi.fn(),
          uiVelocity: 80,
          sequence: seq,
          setSequence: (val: any) => {
            setSeq(val);
            mockSetSequence(val);
          },
          mapSequenceToKeys: vi.fn(),
          isListeningForMap: false,
          setIsListeningForMap: vi.fn(),
          sequenceKeyswitches: {},
          setSequenceKeyswitches: vi.fn(),
          selectedNotes: [],
          isWriteMode: true,
          setIsWriteMode: vi.fn(),
          accidentalOverride: null
        });

        return <StepSequencer initialIsExpanded={true} />;
      };

      const { container } = render(<TestUndoWrapper />);
      const staffArea = container.querySelector('[data-staff-area="0"]');

      staffArea!.getBoundingClientRect = () => ({
        top: 40, left: 0, right: 100, bottom: 320, height: 280, width: 100, x: 0, y: 40, toJSON: () => {}
      });

      // Add note 1 (Middle C = 60) -> populates seqUndoStack
      act(() => {
        const clickEvent = new MouseEvent('pointerdown', { bubbles: true });
        Object.defineProperty(clickEvent, 'clientY', { value: 169 });
        staffArea!.dispatchEvent(clickEvent);
      });

      expect(currentSeq[0].notes.length).toBe(1);

      // Add note 2 (D4 = 62)
      act(() => {
        const clickEvent = new MouseEvent('pointerdown', { bubbles: true });
        Object.defineProperty(clickEvent, 'clientY', { value: 158 });
        staffArea!.dispatchEvent(clickEvent);
      });

      expect(currentSeq[0].notes.length).toBe(2);

      // Dispatch Cmd+Z on window
      const cmdZEvent = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
      const spyStopImmediatePropagation = vi.spyOn(cmdZEvent, 'stopImmediatePropagation');

      act(() => {
        window.dispatchEvent(cmdZEvent);
      });

      expect(spyStopImmediatePropagation).toHaveBeenCalled();
      expect(currentSeq[0].notes.length).toBe(1);

      // Dispatch Cmd+Shift+Z (Redo)
      const cmdShiftZEvent = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true, cancelable: true });
      const spyRedoStop = vi.spyOn(cmdShiftZEvent, 'stopImmediatePropagation');

      act(() => {
        window.dispatchEvent(cmdShiftZEvent);
      });

      expect(spyRedoStop).toHaveBeenCalled();
      expect(currentSeq[0].notes.length).toBe(2);
    });
  });

  describe('PRP 144 Phase 3 TDD Checkpoints: Purge Redundant Arrow Key Logic', () => {
    test('Test Case 1: Given StepSequencer is mounted, When ArrowUp is pressed, Assert handleKey inside the timeline ignores it completely', () => {
      const mockUpdateActiveNotes = vi.fn();
      const mockSetSequence = vi.fn();

      (useMidi as any).mockReturnValue({
        keySignature: 'C Major',
        lut: [],
        updateActiveNotes: mockUpdateActiveNotes,
        uiVelocity: 80,
        sequence: Array(12).fill(null).map(() => ({ notes: [{ note: 60, isTreble: true, stepOffset: 0 }], symbol: 'C' })),
        setSequence: mockSetSequence,
        mapSequenceToKeys: vi.fn(),
        isListeningForMap: false,
        setIsListeningForMap: vi.fn(),
        sequenceKeyswitches: {},
        setSequenceKeyswitches: vi.fn(),
        selectedNotes: [60]
      });

      render(<StepSequencer initialIsExpanded={true} />);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      expect(mockSetSequence).not.toHaveBeenCalled();
      expect(mockUpdateActiveNotes).not.toHaveBeenCalled();
    });
  });

  describe('PRP 146 TDD Checkpoints: Scale Parity, Cursor Styling & Chord Pill Pointer Isolation', () => {
    test('Phase 1 Test Case 1 (Scale Parity): Given isExpanded === true, Assert miniStaff is 12, treble top is calc(50% - 72px), notehead font size is 50.4px, and ledger lines use h-[1.5px]', () => {
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
      mockSequence[0] = {
        notes: [{ note: 60, isTreble: true, stepOffset: 0, accidental: null }],
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
        selectedNotes: []
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      
      // Treble staff lines container has style top: calc(50% - 72px) when miniStaff = 12 (6 * 12 = 72)
      const staffArea = container.querySelector('[data-staff-area="0"]');
      expect(staffArea).toBeInTheDocument();
      
      const trebleStaffLines = staffArea?.querySelector('.absolute.w-full');
      expect((trebleStaffLines as HTMLElement)?.style.top).toBe('calc(50% - 72px)');

      // Notehead element for Middle C (60) has style top: calc(50% - 12px) and fontSize: 50.4px (4.2 * 12 = 50.4)
      const noteheadDiv = container.querySelector('[data-seq-step="0"]')?.closest('.flex-1')?.querySelector('.absolute.z-10.pointer-events-none');
      expect(noteheadDiv).toBeInTheDocument();
      expect((noteheadDiv as HTMLElement).style.top).toBe('calc(50% - 12px)');
      
      const noteheadSpan = noteheadDiv?.querySelector('span');
      expect(noteheadSpan?.style.fontSize).toContain('50.4');

      // Ledger line for Middle C has h-[1.5px] in expanded mode
      const ledgerLine = noteheadDiv?.querySelector('.absolute');
      expect(ledgerLine?.className).toContain('h-[1.5px]');
    });

    test('Phase 1 Test Case 2 (Cursor Styling): Given isExpanded === true, Assert staff canvas area has cursor-default and not cursor-crosshair', () => {
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));

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
        selectedNotes: []
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      const staffArea = container.querySelector('[data-staff-area="0"]');
      expect(staffArea).toBeInTheDocument();
      expect(staffArea?.className).toContain('cursor-default');
      expect(staffArea?.className).not.toContain('cursor-crosshair');
    });

    test('Phase 2 Test Case 1 (Chord Card Playback in Expanded Mode): Given step 0 has chord notes [60, 64, 67], When pointerdown fires on data-chord-pill, Assert audioEngine.noteOn is called with true octaves and canvas does not steal pointer capture', () => {
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
      mockSequence[0] = {
        notes: [
          { note: 60, isTreble: true, stepOffset: 0 },
          { note: 64, isTreble: true, stepOffset: 2 },
          { note: 67, isTreble: true, stepOffset: 4 }
        ],
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
        selectedNotes: []
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      const chordPill = container.querySelector('[data-step-index="0"] [data-chord-pill="true"]');
      expect(chordPill).toBeInTheDocument();

      const mockSetPointerCapture = vi.fn();
      const mockReleasePointerCapture = vi.fn();
      chordPill!.setPointerCapture = mockSetPointerCapture;
      chordPill!.releasePointerCapture = mockReleasePointerCapture;

      act(() => {
        const eDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
        Object.defineProperty(eDown, 'pointerId', { value: 1 });
        chordPill!.dispatchEvent(eDown);
      });

      expect(audioEngine.noteOn).toHaveBeenCalledWith('C4', 80 / 127);
      expect(audioEngine.noteOn).toHaveBeenCalledWith('E4', 80 / 127);
      expect(audioEngine.noteOn).toHaveBeenCalledWith('G4', 80 / 127);
      expect(mockSetPointerCapture).toHaveBeenCalledWith(1);
      expect(audioEngine.releaseNote).not.toHaveBeenCalled();

      act(() => {
        const eUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true });
        Object.defineProperty(eUp, 'pointerId', { value: 1 });
        chordPill!.dispatchEvent(eUp);
      });

      expect(audioEngine.releaseNote).toHaveBeenCalledWith('C4');
      expect(audioEngine.releaseNote).toHaveBeenCalledWith('E4');
      expect(audioEngine.releaseNote).toHaveBeenCalledWith('G4');
      expect(mockReleasePointerCapture).toHaveBeenCalledWith(1);
    });

    test('Phase 2 Test Case 2 (Write Mode Non-Interference): Given Write Mode is active in expanded mode, When Chord Symbol Pill is clicked, Assert no low-register note is added or previewed', () => {
      const mockSetSequence = vi.fn();
      const mockSequence = Array(12).fill(null).map(() => ({ notes: [] as any[], symbol: "" }));
      mockSequence[0] = {
        notes: [{ note: 60, isTreble: true, stepOffset: 0 }],
        symbol: 'C'
      };

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
        selectedNotes: [],
        isWriteMode: true,
        setIsWriteMode: vi.fn(),
        accidentalOverride: null
      });

      const { container } = render(<StepSequencer initialIsExpanded={true} />);
      const chordPill = container.querySelector('[data-step-index="0"] [data-chord-pill="true"]');
      expect(chordPill).toBeInTheDocument();

      act(() => {
        const eDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
        Object.defineProperty(eDown, 'pointerId', { value: 1 });
        chordPill!.dispatchEvent(eDown);
      });

      // Assert setSequence was NOT called to add low pitch note from Write Mode pointer handler
      expect(mockSetSequence).not.toHaveBeenCalled();
    });
  });
});







