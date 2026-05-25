import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Piano88 from './Keyboard';
import { useMidi } from '../midi/MIDIProvider';
import { vi } from 'vitest';

vi.mock('../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('Keyboard Color Matrix (Phase 3 TDD Checkpoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('Test Case 1 & 2: Active keys color are blue (#3b82f6) and selected keys color are purple (#aa3bff)', async () => {
    // We will render Piano88 with a selectedNotes list containing note 60,
    // and we will dispatch a MIDI message indicating notes 60 and 64 are active.
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: Array(4096).fill(null),
      selectedNotes: [60], // note 60 is selected
    });

    render(<Piano88 />);

    // Trigger a refresh event indicating notes 60 and 64 are active
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: {
          refresh: true,
          notes: [
            { note: 60, spellingString: 'C' },
            { note: 64, spellingString: 'E' },
          ]
        }
      }));
    });

    // Check key 60 (active AND selected): should be purple (#aa3bff)
    const key60 = document.getElementById('pk88-60');
    expect(key60).toBeInTheDocument();
    expect(key60).toHaveStyle('background-color: rgb(170, 59, 255)'); // #aa3bff in rgb

    // Check key 64 (active but NOT selected): should be blue (#3b82f6)
    const key64 = document.getElementById('pk88-64');
    expect(key64).toBeInTheDocument();
    expect(key64).toHaveStyle('background-color: rgb(59, 130, 246)'); // #3b82f6 in rgb
  });

  test('Test Case 3: Note name strip labels are blue (#3b82f6) when not selected, and purple (#aa3bff) when selected', async () => {
    (useMidi as any).mockReturnValue({
      keySignature: 'C Major',
      lut: Array(4096).fill(null),
      selectedNotes: [60], // note 60 is selected
    });

    render(<Piano88 />);

    // Trigger refresh event with notes 60 (selected) and 64 (not selected)
    act(() => {
      window.dispatchEvent(new CustomEvent('MIDI_MESSAGE_RECEIVED', {
        detail: {
          refresh: true,
          notes: [
            { note: 60, spellingString: 'C' },
            { note: 64, spellingString: 'E' },
          ]
        }
      }));
    });

    // Spelled notes strip container should be populated
    const strip = document.getElementById('spelled-notes-strip');
    expect(strip).toBeInTheDocument();

    // The labels inside the strip should correspond to C and E
    const labels = strip?.querySelectorAll('div');
    expect(labels?.length).toBe(2);

    const labelC = Array.from(labels || []).find(l => l.textContent === 'C');
    const labelE = Array.from(labels || []).find(l => l.textContent === 'E');

    expect(labelC).toBeDefined();
    expect(labelE).toBeDefined();

    // C (selected): should be purple (#aa3bff)
    expect(labelC).toHaveStyle('color: rgb(170, 59, 255)');

    // E (not selected): should be blue (#3b82f6)
    expect(labelE).toHaveStyle('color: rgb(59, 130, 246)');
  });
});
