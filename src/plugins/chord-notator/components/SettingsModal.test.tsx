import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import SettingsModal from './SettingsModal';
import { MIDIProvider } from '../midi/MIDIProvider';

describe('SettingsModal', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockOnClose = () => {};

  it('should not render anything when isOpen is false', () => {
    const { container } = render(
      <MIDIProvider>
        <SettingsModal isOpen={false} onClose={mockOnClose} />
      </MIDIProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render content when isOpen is true', () => {
    render(
      <MIDIProvider>
        <SettingsModal isOpen={true} onClose={mockOnClose} />
      </MIDIProvider>
    );
    
    expect(screen.getByText('Split Point (Treble / Bass)')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should update splitPoint when a new option is selected', () => {
    render(
      <MIDIProvider>
        <SettingsModal isOpen={true} onClose={mockOnClose} />
      </MIDIProvider>
    );
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '48' } });
    
    expect(select).toHaveValue('48');
  });

  it('should contain 25 options (MIDI 48 through 72)', () => {
    render(
      <MIDIProvider>
        <SettingsModal isOpen={true} onClose={mockOnClose} />
      </MIDIProvider>
    );
    
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(25);
    expect(options[0]).toHaveValue('48');
    expect(options[24]).toHaveValue('72');
  });

  it('should call onClose when close button is clicked', () => {
    let closed = false;
    const handleClose = () => { closed = true; };
    
    render(
      <MIDIProvider>
        <SettingsModal isOpen={true} onClose={handleClose} />
      </MIDIProvider>
    );
    
    fireEvent.click(screen.getByText('Close'));
    expect(closed).toBe(true);
  });

  it('should render VELOCITY slider and update persistent state when changed', () => {
    render(
      <MIDIProvider>
        <SettingsModal isOpen={true} onClose={mockOnClose} />
      </MIDIProvider>
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '100' } });
    expect(slider).toHaveValue('100');
  });
});
