// src/components/KeySignatureSelector.test.tsx
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import KeySignatureSelector from './KeySignatureSelector';
import { useMidi } from '../midi/MIDIProvider';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('KeySignatureSelector Component', () => {
  const mockSetKeySignature = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      setKeySignature: mockSetKeySignature,
    });
  });

  test('should render both root and scale dropdowns with correct initial values', () => {
    render(<KeySignatureSelector />);

    const rootSelect = document.getElementById('key-root-select') as HTMLSelectElement;
    const scaleSelect = document.getElementById('key-scale-select') as HTMLSelectElement;

    expect(rootSelect).toBeInTheDocument();
    expect(rootSelect.value).toBe('C');

    expect(scaleSelect).toBeInTheDocument();
    expect(scaleSelect.value).toBe('Major');
  });

  test('should list all Circle of Fifths roots in the correct order', () => {
    render(<KeySignatureSelector />);

    const rootSelect = document.getElementById('key-root-select') as HTMLSelectElement;
    const options = Array.from(rootSelect.options).map(opt => opt.value);

    const expectedRoots = [
      'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'
    ];

    expect(options).toEqual(expectedRoots);
  });

  test('should list all supported scale types from SCALE_DECIMAL_MAP', () => {
    render(<KeySignatureSelector />);

    const scaleSelect = document.getElementById('key-scale-select') as HTMLSelectElement;
    const options = Array.from(scaleSelect.options).map(opt => opt.value);

    const expectedScales = [
      'Major',
      'Minor (Natural)',
      'Melodic Minor',
      'Harmonic Minor',
      'Harmonic Major',
      'Major Pentatonic',
      'Whole Tone',
      'Augmented',
      'Diminished'
    ];

    expect(options).toEqual(expectedScales);
  });

  test('should fire setKeySignature when the root dropdown is changed', () => {
    render(<KeySignatureSelector />);

    const rootSelect = document.getElementById('key-root-select') as HTMLSelectElement;
    fireEvent.change(rootSelect, { target: { value: 'Eb' } });

    expect(mockSetKeySignature).toHaveBeenCalledWith('Eb Major');
  });

  test('should fire setKeySignature when the scale dropdown is changed', () => {
    render(<KeySignatureSelector />);

    const scaleSelect = document.getElementById('key-scale-select') as HTMLSelectElement;
    fireEvent.change(scaleSelect, { target: { value: 'Harmonic Minor' } });

    expect(mockSetKeySignature).toHaveBeenCalledWith('C Harmonic Minor');
  });

  test('should render the micro-labels "ROOT NOTE" and "SCALE TYPE"', () => {
    const { getByText } = render(<KeySignatureSelector />);
    expect(getByText(/root note/i)).toBeInTheDocument();
    expect(getByText(/scale type/i)).toBeInTheDocument();
  });

  test('should render outer container with rounded-full and shadow-lg classes', () => {
    const { container } = render(<KeySignatureSelector />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('rounded-full');
    expect(outerDiv).toHaveClass('shadow-lg');
  });

  test('should apply appearance-none class to select elements', () => {
    render(<KeySignatureSelector />);
    const rootSelect = document.getElementById('key-root-select');
    const scaleSelect = document.getElementById('key-scale-select');
    expect(rootSelect).toHaveClass('appearance-none');
    expect(scaleSelect).toHaveClass('appearance-none');
  });

  test('should apply whitespace-nowrap class to both micro-label span elements', () => {
    const { getByText } = render(<KeySignatureSelector />);
    const rootLabel = getByText(/root note/i);
    const scaleLabel = getByText(/scale type/i);
    expect(rootLabel).toHaveClass('whitespace-nowrap');
    expect(scaleLabel).toHaveClass('whitespace-nowrap');
  });
});

