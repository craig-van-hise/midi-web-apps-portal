import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransformationsToolbar } from './TransformationsToolbar';
import type { ButtonId, ButtonConfigMap } from './TransformationsTypes';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockConfigs: ButtonConfigMap = {
  SEMI_UP: { stepSize: 1, midiChannel: 1, midiNote: 60 },
  SEMI_DOWN: { stepSize: 1, midiChannel: 1, midiNote: 61 },
  KEY_UP: { stepSize: 1, midiChannel: 1, midiNote: 62 },
  KEY_DOWN: { stepSize: 1, midiChannel: 1, midiNote: 63 },
  OCT_UP: { stepSize: 1, midiChannel: 1, midiNote: 64 },
  OCT_DOWN: { stepSize: 1, midiChannel: 1, midiNote: 65 },
  ROT_UP: { stepSize: 1, midiChannel: 1, midiNote: 66 },
  ROT_DOWN: { stepSize: 1, midiChannel: 1, midiNote: 67 },
  PLAY: { stepSize: 1, midiChannel: 1, midiNote: 68 },
  HOME: { stepSize: 1, midiChannel: 1, midiNote: 69 },
};

const mockPressedButtons: Record<ButtonId, boolean> = Object.keys(mockConfigs).reduce((acc, key) => ({ ...acc, [key]: false }), {} as any);

describe('TransformationsToolbar', () => {
  it('renders with inline-flex and w-max root container', () => {
    const { container } = render(
      <TransformationsToolbar 
        pressedButtons={mockPressedButtons}
        configs={mockConfigs}
        onButtonDown={vi.fn()}
        onButtonUp={vi.fn()}
        onButtonContextMenu={vi.fn()}
        onBackgroundContextMenu={vi.fn()}
        learnModeTarget={null}
        isOpen={true}
        onToggleTab={vi.fn()}
      />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('w-full');
    expect(root.className).toContain('pb-8');
    
    const inner = root.querySelector('.bg-white.rounded-\\[2rem\\]');
    expect(inner).toBeTruthy();
  });

  it('renders 8 SVG arrows and 2 action buttons', () => {
    const { container } = render(
      <TransformationsToolbar 
        pressedButtons={mockPressedButtons}
        configs={mockConfigs}
        onButtonDown={vi.fn()}
        onButtonUp={vi.fn()}
        onButtonContextMenu={vi.fn()}
        onBackgroundContextMenu={vi.fn()}
        learnModeTarget={null}
        isOpen={true}
        onToggleTab={vi.fn()}
      />
    );
    
    // There are 8 arrows (SVG paths) + 2 action icons + 1 tab icon = 11
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(11);

    // There are 2 action buttons in the action zone + 8 arrow buttons + 1 tab button = 11 buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(11);
  });

  it('renders correct labels', () => {
    render(
      <TransformationsToolbar 
        pressedButtons={mockPressedButtons}
        configs={mockConfigs}
        onButtonDown={vi.fn()}
        onButtonUp={vi.fn()}
        onButtonContextMenu={vi.fn()}
        onBackgroundContextMenu={vi.fn()}
        learnModeTarget={null}
        isOpen={true}
        onToggleTab={vi.fn()}
      />
    );
    
    expect(screen.getByText(/semi/i)).toBeTruthy();
    expect(screen.getByText(/key/i)).toBeTruthy();
    expect(screen.getByText(/oct/i)).toBeTruthy();
    expect(screen.getByText(/rot/i)).toBeTruthy();
  });

  it('does not show a tooltip when hovering over an arrow button, but shows a tooltip when hovering over category label KEY', () => {
    const { fireEvent, act } = require('@testing-library/react');
    vi.useFakeTimers();
    render(
      <TransformationsToolbar 
        pressedButtons={mockPressedButtons}
        configs={mockConfigs}
        onButtonDown={vi.fn()}
        onButtonUp={vi.fn()}
        onButtonContextMenu={vi.fn()}
        onBackgroundContextMenu={vi.fn()}
        learnModeTarget={null}
        isOpen={true}
        onToggleTab={vi.fn()}
      />
    );
    
    // Hover over an arrow button (e.g., SEMI_UP)
    const arrowBtn = screen.getByLabelText('SEMI_UP transformation');
    act(() => {
      arrowBtn.dispatchEvent(new Event('pointermove', { bubbles: true }));
      vi.advanceTimersByTime(400);
    });
    
    expect(screen.queryByText('Transpose Chromatically (Semitones)')).toBeNull();
    expect(screen.queryByText('Transpose Up (Chromatic / Semitones)')).toBeNull();
    
    // Hover over the 'key' label
    const keyLabel = screen.getByText('key');
    act(() => {
      // Define a custom PointerEvent if PointerEvent is available or create a generic event with pointerType
      const event = new Event('pointermove', { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      keyLabel.dispatchEvent(event);
      vi.advanceTimersByTime(400);
    });
    
    expect(screen.getAllByText('Transpose Diatonically (Scale Degrees)').length).toBeGreaterThan(0);
    
    vi.useRealTimers();
  });
});
