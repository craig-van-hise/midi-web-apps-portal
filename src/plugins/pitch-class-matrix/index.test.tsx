import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import PitchClassMatrix from './index';
import { Piano88 } from './components/88-key';

describe('PitchClassMatrix UI and Dimension Tests', () => {
  it('main grid container possesses inline style width: 240px and height: 260px', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    const { container } = render(
      <PitchClassMatrix
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    // Find the element with grid-template-columns repeat(12, 1fr)
    const grid = container.querySelector('div[style*="grid-template-columns"]');
    expect(grid).not.toBeNull();
    
    // Assert current width/height is the new scaled-down version
    expect(grid).toHaveStyle({ width: '240px', height: '260px' });
  });

  it('given the rendered Piano88, Assert the total width is 936px', () => {
    const { container } = render(<Piano88 pianoArrows={[]} />);
    const key = container.querySelector('[id^="pk88-"]');
    expect(key).not.toBeNull();
    const keyboardContainer = key!.parentElement;
    expect(keyboardContainer).toHaveStyle({ width: '936px' });
  });

  it('given the rendered PitchClassMatrix, Assert the Piano wrapper has the classes rounded-lg and shadow-sm', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    const { container } = render(
      <PitchClassMatrix
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    const key = container.querySelector('[id^="pk88-"]');
    expect(key).not.toBeNull();
    const piano88Root = key!.parentElement!.parentElement;
    const pianoWrapper = piano88Root!.parentElement;
    expect(pianoWrapper).not.toBeNull();
    expect(pianoWrapper!.className).toContain('rounded-lg');
    expect(pianoWrapper!.className).toContain('shadow-sm');
  });

  it('given the rendered PitchClassMatrix, Assert the top-level container possesses the bg-white, min-w-max, and min-h-screen classes, and does NOT possess bg-[#f3f4f6] or max-w-5xl', () => {
    const mockMidiBus = new EventTarget();
    const mockOnMidiOut = vi.fn();

    const { container } = render(
      <PitchClassMatrix
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    const rootContainer = container.firstChild as HTMLElement;
    expect(rootContainer).not.toBeNull();
    expect(rootContainer.className).toContain('w-full');
    expect(rootContainer.className).toContain('min-w-max');
    expect(rootContainer.className).toContain('min-h-screen');
    expect(rootContainer.className).toContain('bg-white');
    expect(rootContainer.className).not.toContain('bg-[#f3f4f6]');
    expect(rootContainer.className).not.toContain('max-w-5xl');
  });
});
