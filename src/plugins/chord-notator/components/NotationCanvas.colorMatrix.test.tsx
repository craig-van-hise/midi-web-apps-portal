import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotationCanvas from './NotationCanvas';
import { useMidi } from '../midi/MIDIProvider';
import { vi } from 'vitest';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('NotationCanvas Color Matrix (Phase 2 TDD Checkpoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    const mockLut = Array(4096).fill(null);
    mockLut[145] = {
      decimal: 145,
      chord_type: "",
      root_pc: 0,
      chord_intervals: ["1", "3", "5"],
      base_triad: "maj",
      base_7th: 0,
      cardinality: 3,
      pitch_class_set: [0, 4, 7]
    };
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      splitPoint: 60,
      lut: mockLut,
      updateActiveNotes: vi.fn(),
    });
  });

  test('renders note elements with black color when isSelected is false', async () => {
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    const note = await screen.findByTestId('note-container-60');
    expect(note).toBeInTheDocument();
    
    const notehead = note.querySelector('.notehead');
    expect(notehead).toBeInTheDocument();
    expect(notehead).toHaveStyle('color: #000000');
  });

  test('renders note elements with the purple color (#aa3bff) when isSelected is true', async () => {
    render(<NotationCanvas />);
    
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: { data: new Uint8Array([0x90, 60, 100]) }
      }));
    });

    const note = await screen.findByTestId('note-container-60');
    expect(note).toBeInTheDocument();

    // Select the note via click
    fireEvent.pointerDown(note);
    expect(note).toHaveAttribute('data-selected', 'true');

    const notehead = note.querySelector('.notehead');
    expect(notehead).toBeInTheDocument();
    expect(notehead).not.toHaveStyle('color: #ef4444');
    expect(notehead).toHaveStyle('color: #aa3bff');
  });

  test('renders the chord symbol with a blue class/color', async () => {
    render(<NotationCanvas />);
    
    // Send notes to form a C Major chord so a chord symbol is rendered
    act(() => {
      [60, 64, 67].forEach(midi => {
        window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
          detail: { data: new Uint8Array([0x90, midi, 100]) }
        }));
      });
    });

    // The chord symbol text "C" should be rendered.
    // Wait, let's find the element containing the chord symbol.
    // In NotationCanvas.tsx:
    // className="absolute top-1/2 -translate-y-1/2 left-[100%] ml-8 text-2xl font-bold text-[#aa3bff] ..."
    // Let's get it by text content "C"
    await waitFor(() => {
      const chordEl = screen.getByTestId('chord-symbol');
      expect(chordEl).toBeInTheDocument();
      expect(chordEl).toHaveTextContent('C');
      expect(chordEl).toHaveClass('text-blue-500');
    });
  });
});
