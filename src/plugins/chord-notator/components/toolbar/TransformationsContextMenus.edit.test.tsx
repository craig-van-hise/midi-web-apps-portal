/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArrowContextMenu, GlobalContextMenu } from './TransformationsContextMenus';
import { useMidi } from '../../midi/MIDIProvider';

vi.mock('../../midi/MIDIProvider', () => ({
  useMidi: vi.fn(),
}));

describe('TransformationsContextMenus - MIDI Learn UI Enhancements TDD Checkpoint', () => {
  const mockClearAllMidiMappings = vi.fn();
  const mockClearMidiMapping = vi.fn();
  const mockStartLearnMode = vi.fn();
  const mockUpdateConfig = vi.fn();
  const mockOnClose = vi.fn();
  const mockSetUiVelocity = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMidi as any).mockReturnValue({
      clearAllMidiMappings: mockClearAllMidiMappings,
      clearMidiMapping: mockClearMidiMapping,
      startLearnMode: mockStartLearnMode,
      uiVelocity: 80,
      setUiVelocity: mockSetUiVelocity,
    });
  });

  it('Given a populated MIDI map state, When "Clear All" is clicked, Then the map is deeply empty (clearAllMidiMappings is called)', () => {
    render(
      <GlobalContextMenu 
        onLearnStart={mockStartLearnMode}
        onToggleListen={vi.fn()}
        settings={{ listenMode: true }}
        position={{ x: 0, y: 0 }}
        onClose={mockOnClose}
      />
    );

    const clearAllBtn = screen.getByText(/Clear All Mappings/i);
    fireEvent.click(clearAllBtn);

    expect(mockClearAllMidiMappings).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('Given the GlobalContextMenu, When the Velocity slider is changed to 100, Then setUiVelocity is called with 100', () => {
    render(
      <GlobalContextMenu 
        onLearnStart={mockStartLearnMode}
        onToggleListen={vi.fn()}
        settings={{ listenMode: true }}
        position={{ x: 0, y: 0 }}
        onClose={mockOnClose}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('80');

    fireEvent.change(slider, { target: { value: '100' } });

    expect(mockSetUiVelocity).toHaveBeenCalledWith(100);
  });

  it('Given the context menu for Diatonic Up (SEMI_UP), When the Note # input is changed from 60 to 62, Then the persistent state updates the mapping for Diatonic Up to 62', () => {
    const config = {
      stepSize: 1,
      midiChannel: 1,
      midiNote: 60,
    };

    render(
      <ArrowContextMenu 
        buttonId="SEMI_UP"
        config={config}
        onUpdateConfig={mockUpdateConfig}
        position={{ x: 0, y: 0 }}
        onClose={mockOnClose}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    // First input is MIDI CH, second is NOTE #
    const noteInput = inputs[1];
    expect(noteInput).toHaveValue(60);

    fireEvent.change(noteInput, { target: { value: '62' } });

    expect(mockUpdateConfig).toHaveBeenCalledWith('SEMI_UP', { midiNote: 62 });
  });
});
