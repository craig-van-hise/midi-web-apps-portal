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
});
