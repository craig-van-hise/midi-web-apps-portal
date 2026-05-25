// src/components/NotationCanvas.headless.test.tsx
import { describe, it, expect } from 'vitest';

// We simulate the logic used in handlePointerDown and handlePointerUp
const calculateIntersection = (pointerX: number, pointerY: number, noteX: number, noteY: number, staffSpace: number) => {
  const horizontalThreshold = staffSpace * 1.5;
  const verticalThreshold = staffSpace * 0.8;
  const dx = Math.abs(pointerX - noteX);
  const dy = Math.abs(pointerY - noteY);
  return dx < horizontalThreshold && dy < verticalThreshold;
};

const calculateMarqueeIntersection = (marquee: {left: number, top: number, right: number, bottom: number}, noteX: number, noteY: number) => {
  return noteX >= marquee.left && noteX <= marquee.right && noteY >= marquee.top && noteY <= marquee.bottom;
};

describe('Headless Mathematical Hit-Testing (PRP #72)', () => {
  describe('Phase 1: Single Click Intersection', () => {
    it('should return true when pointer is within threshold', () => {
      // Given a note at (150, 160) and staffSpace 10
      const noteX = 150;
      const noteY = 160;
      const staffSpace = 10;
      
      // Pointer at (155, 165)
      expect(calculateIntersection(155, 165, noteX, noteY, staffSpace)).toBe(true);
    });

    it('should return false when pointer is outside vertical threshold', () => {
      const noteX = 150;
      const noteY = 160;
      const staffSpace = 10;
      
      // Vertical threshold is 8 (0.8 * 10)
      // Pointer at (150, 170) is 10px away
      expect(calculateIntersection(150, 170, noteX, noteY, staffSpace)).toBe(false);
    });

    it('should return false when pointer is outside horizontal threshold', () => {
        const noteX = 150;
        const noteY = 160;
        const staffSpace = 10;
        
        // Horizontal threshold is 15 (1.5 * 10)
        // Pointer at (170, 160) is 20px away
        expect(calculateIntersection(170, 160, noteX, noteY, staffSpace)).toBe(false);
      });
  });

  describe('Phase 2: Marquee Intersection', () => {
    it('should return true when note center is inside marquee', () => {
      const noteX = 100;
      const noteY = 100;
      const marquee = { left: 50, top: 50, right: 150, bottom: 150 };
      expect(calculateMarqueeIntersection(marquee, noteX, noteY)).toBe(true);
    });

    it('should return false when note center is outside marquee', () => {
      const noteX = 40;
      const noteY = 100;
      const marquee = { left: 50, top: 50, right: 150, bottom: 150 };
      expect(calculateMarqueeIntersection(marquee, noteX, noteY)).toBe(false);
    });
  });
});
