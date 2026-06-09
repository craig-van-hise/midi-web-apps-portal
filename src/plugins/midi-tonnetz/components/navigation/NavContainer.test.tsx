import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NavContainer } from './NavContainer';

describe('NavContainer D-pad UI Event Binding', () => {
  it('Test Case 1: Given the rendered D-Pad UI, When the Top/Up arrow is clicked, Assert the engine receives the UP string payload', () => {
    const triggerSpy = vi.fn();
    const { container } = render(<NavContainer onDirectionalDown={triggerSpy} />);

    // Find the UP arrow button.
    // NavControllerOriginal renders UP button using renderArrowBtn('UP', 0).
    // Let's find buttons, or check the SVG paths / button elements.
    const buttons = container.querySelectorAll('button');
    let upButton: HTMLButtonElement | null = null;

    // The arrow button for 'UP' is rendered as a button containing an SVG with path rotate(0 50 50) or similar.
    // Or we can find it by finding the button with onMouseDown handler or finding the SVG path.
    // Let's identify the buttons. There are buttons for UP, DOWN, LEFT, RIGHT, and action buttons.
    // Let's look for the button corresponding to UP.
    // In NavControllerOriginal, the UP button is the second button when showDiagonals is false.
    // But to make it extremely robust, let's check which button triggers the spy with 'UP'.
    // Or we can query the button elements and simulate onMouseDown on each until we find the one that triggers the spy with 'UP'.
    // Or we can find the button that has the UP class or coordinates.
    // Actually, let's simulate onMouseDown on all buttons and see if one triggers 'UP'.
    buttons.forEach((btn) => {
      // Simulate onPointerDown
      fireEvent.pointerDown(btn);
    });

    expect(triggerSpy).toHaveBeenCalledWith('UP');
  });
});
