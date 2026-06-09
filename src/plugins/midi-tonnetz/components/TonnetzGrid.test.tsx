import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TonnetzGridContainer from './TonnetzGridContainer';

describe('TonnetzGrid click propagation', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect and clientWidth/clientHeight
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    HTMLDivElement.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect));
  });

  it('calls onNodeDown callback when the canvas is clicked at a valid node', () => {
    const handleToggle = vi.fn();
    const { container } = render(
      <TonnetzGridContainer onNodeDown={handleToggle} />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    if (canvas) {
      // Click at the exact visual coordinates of node (0, 0)
      // width = 800, height = 600, offset.x = -45, offset.y = 25.98
      // Node (0, 0) is at X: 400 - 45 = 355, Y: 300 + 25.98 = 325.98
      fireEvent.pointerDown(canvas, {
        clientX: 355,
        clientY: 326,
      });
    }

    expect(handleToggle).toHaveBeenCalled();
  });
});
