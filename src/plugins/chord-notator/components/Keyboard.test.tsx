import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Keyboard from './Keyboard';
import { useMidi } from '../midi/MIDIProvider';

// Mock useMidi
vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('Keyboard Component - Clean UI Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMidi as any).mockReturnValue({
      dispatchVirtualMidi: vi.fn(),
      lut: [],
      keySignature: 'C Major',
      sequenceKeyswitches: {},
      mapSequenceToKeys: vi.fn(),
      sequence: Array(8).fill({ notes: [], symbol: '' }),
    });
  });

  it('Given the Keyboard component renders, When it mounts, Then it should NOT contain the text KEYBOARD MODES or buttons for TOGGLE MODE or HOLD MODE', () => {
    render(<Keyboard />);
    expect(screen.queryByText(/KEYBOARD MODES/i)).not.toBeInTheDocument();
    expect(screen.queryByText('TOGGLE MODE')).not.toBeInTheDocument();
    expect(screen.queryByText('HOLD MODE')).not.toBeInTheDocument();
  });

  it('Given Note 60 is mapped to Step 3, When Keyboard renders, Assert key 60 contains a badge with the text "4"', () => {
    (useMidi as any).mockReturnValue({
      dispatchVirtualMidi: vi.fn(),
      lut: [],
      keySignature: 'C Major',
      sequenceKeyswitches: { 60: 3 }, // Note 60 mapped to step index 3
      mapSequenceToKeys: vi.fn(),
      sequence: Array(8).fill({ notes: [], symbol: '' }),
    });

    const { container } = render(<Keyboard />);
    
    // Find the key element or the badge element
    // Let's find key 60 container and check if there's a badge with "4"
    const key60 = container.querySelector('[data-note="60"]');
    expect(key60).toBeInTheDocument();
    
    const badge = key60?.querySelector('.ks-badge');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe('4');
  });
});
