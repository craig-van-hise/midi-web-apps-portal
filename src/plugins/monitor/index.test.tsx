import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import MidiMonitor from './index';

describe('MidiMonitor CSS & Layout TDD Tests', () => {
  const mockMidiBus = new EventTarget();
  const mockOnMidiOut = vi.fn();

  it('Given the rendered Monitor, Assert the root container has h-full w-full and lacks h-screen w-screen, and main has overflow-hidden', () => {
    const { container } = render(
      <MidiMonitor
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    // Root container
    const rootContainer = container.querySelector('div');
    expect(rootContainer).not.toBeNull();
    expect(rootContainer!.className).toContain('w-full');
    expect(rootContainer!.className).toContain('h-full');
    expect(rootContainer!.className).not.toContain('w-screen');
    expect(rootContainer!.className).not.toContain('h-screen');

    // Main tag
    const mainElement = container.querySelector('main');
    expect(mainElement).not.toBeNull();
    expect(mainElement!.className).toContain('overflow-hidden');
    expect(mainElement!.className).not.toContain('overflow-x-auto');
  });

  it('Given the Ledger container, Assert it does not have inline styles for flexBasis, and possesses the w-[320px] class', () => {
    const { container } = render(
      <MidiMonitor
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    // Find the Ledger container. It has class starting with 'flex-none flex flex-col bg-[#0a0a0b]'
    const ledgerContainer = container.querySelector('main > div:first-child');
    expect(ledgerContainer).not.toBeNull();
    
    // Assert style flexBasis does not exist or is not max-content
    expect(ledgerContainer!.getAttribute('style')).toBeNull();
    
    // Possesses the w-[320px] class
    expect(ledgerContainer!.className).toContain('w-[320px]');
  });

  it('Given the Graph container, Assert it lacks the min-h-[30vh] class', () => {
    const { container } = render(
      <MidiMonitor
        midiBus={mockMidiBus}
        onMidiOut={mockOnMidiOut}
        isBypassed={false}
        showInfo={false}
        showSettings={false}
        triggerPanic={0}
      />
    );

    // Find the graph container. It is the second child of main
    const graphContainer = container.querySelector('main > div:nth-child(2)');
    expect(graphContainer).not.toBeNull();
    
    // Assert lacks min-h-[30vh]
    expect(graphContainer!.className).not.toContain('min-h-[30vh]');
  });
});
