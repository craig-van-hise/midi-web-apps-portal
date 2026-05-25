import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Piano88 from '../Keyboard';
import { TransformationsDrawer } from './TransformationsDrawer';

// Mock useMidi
vi.mock('../../midi/MIDIProvider', () => ({
  useMidi: () => ({
    dispatchVirtualMidi: vi.fn(),
    lut: [],
    keySignature: 'C Major',
    selectedNotes: [],
    configs: {},
    listenMode: true,
    setListenMode: vi.fn(),
    learnState: { isActive: false, currentButtonIndex: 0, sequence: [] },
    startLearnMode: vi.fn(),
    stopLearnMode: vi.fn(),
    updateButtonConfig: vi.fn(),
  }),
}));

describe('TransformationsDrawer Integration', () => {
  it('renders the TransformationsToolbar alongside the Keyboard component', () => {
    render(
      <div>
        <Piano88 />
        <TransformationsDrawer />
      </div>
    );
    
    // Check for some labels in the toolbar
    expect(screen.getByText('semi')).toBeInTheDocument();
    expect(screen.getByText('key')).toBeInTheDocument();
    expect(screen.getByText('rot')).toBeInTheDocument();
    expect(screen.getByText('oct')).toBeInTheDocument();
  });

  it('toggles the drawer visibility when the tab button is clicked', () => {
    render(
      <div>
        <Piano88 />
        <TransformationsDrawer />
      </div>
    );
    
    const toggleButton = screen.getByRole('button', { name: /toggle drawer/i });
    
    // Check initial state (closed)
    // The drawer container has the sliding classes
    const drawerContainer = screen.getByText('semi').closest('.transition-all');
    expect(drawerContainer).toHaveClass('-translate-y-[155px]');

    // Click to open
    fireEvent.click(toggleButton);
    
    // Check open state
    expect(drawerContainer).toHaveClass('translate-y-0');
    expect(drawerContainer).not.toHaveClass('-translate-y-[155px]');

    // Click to close
    fireEvent.click(toggleButton);
    expect(drawerContainer).toHaveClass('-translate-y-[155px]');
  });

  it('calculates vertical velocity for the PLAY button', () => {
    // Mock dispatchEvent
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    
    render(<TransformationsDrawer />);
    
    const playButton = screen.getByLabelText(/PLAY transformation/i);
    
    // Mock getBoundingClientRect
    playButton.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      height: 100,
      left: 0,
      width: 100
    });

    // Simulate pointer down at TOP (clientY = 100) -> Velocity should be 127
    fireEvent.pointerDown(playButton, { clientY: 100, pointerId: 1 });
    
    const playCalls1 = dispatchSpy.mock.calls.filter(c => c[0].type === 'APP_PLAY_ON');
    const call1 = playCalls1[playCalls1.length - 1][0] as CustomEvent;
    expect(call1.type).toBe('APP_PLAY_ON');
    expect(call1.detail.velocity).toBe(127);

    // Simulate pointer down at BOTTOM (clientY = 200) -> Velocity should be 1
    fireEvent.pointerDown(playButton, { clientY: 200, pointerId: 1 });
    
    const playCalls2 = dispatchSpy.mock.calls.filter(c => c[0].type === 'APP_PLAY_ON');
    const call2 = playCalls2[playCalls2.length - 1][0] as CustomEvent;
    expect(call2.type).toBe('APP_PLAY_ON');
    expect(call2.detail.velocity).toBe(1);
    
    dispatchSpy.mockRestore();
  });
});
