import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Keyboard from './Keyboard';

// Mock useMidi
vi.mock('../midi/MIDIProvider', () => ({
  useMidi: () => ({
    dispatchVirtualMidi: vi.fn(),
    lut: [],
    keySignature: 'C Major'
  }),
}));

describe('Keyboard Component - Clean UI Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given the Keyboard component renders, When it mounts, Then it should NOT contain the text KEYBOARD MODES or buttons for TOGGLE MODE or HOLD MODE', () => {
    render(<Keyboard />);
    expect(screen.queryByText(/KEYBOARD MODES/i)).not.toBeInTheDocument();
    expect(screen.queryByText('TOGGLE MODE')).not.toBeInTheDocument();
    expect(screen.queryByText('HOLD MODE')).not.toBeInTheDocument();
  });
});
