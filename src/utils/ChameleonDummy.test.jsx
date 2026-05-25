import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ChameleonDummy } from './ChameleonDummy';

describe('ChameleonDummy (isEmbedded)', () => {
  const originalParent = window.parent;

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      value: originalParent,
      writable: true,
      configurable: true
    });
  });

  it('should return false when not embedded (window === window.parent)', () => {
    Object.defineProperty(window, 'parent', {
      value: window,
      writable: true,
      configurable: true
    });

    render(<ChameleonDummy />);
    const span = screen.getByTestId('is-embedded');
    expect(span.textContent).toBe('false');
  });

  it('should return true when embedded (window !== window.parent)', () => {
    const mockParent = {};
    Object.defineProperty(window, 'parent', {
      value: mockParent,
      writable: true,
      configurable: true
    });

    render(<ChameleonDummy />);
    const span = screen.getByTestId('is-embedded');
    expect(span.textContent).toBe('true');
  });
});
