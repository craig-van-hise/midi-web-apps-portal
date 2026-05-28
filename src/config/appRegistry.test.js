import { describe, it, expect } from 'vitest';
import { appRegistry } from './appRegistry';

describe('appRegistry', () => {
  it('should contain exactly 5 objects with valid url strings', () => {
    expect(appRegistry).toBeDefined();
    expect(Array.isArray(appRegistry)).toBe(true);
    expect(appRegistry.length).toBe(5);

    appRegistry.forEach((app) => {
      expect(app).toHaveProperty('id');
      expect(app).toHaveProperty('title');
      expect(app).toHaveProperty('icon');
      expect(app).toHaveProperty('url');
      expect(app).toHaveProperty('description');
      
      // Verify valid URL string
      expect(typeof app.url).toBe('string');
      expect(app.url.startsWith('http://') || app.url.startsWith('https://')).toBe(true);
    });
  });

  it('should not contain note-range-filter (Phase 1 Test Case 1)', () => {
    expect(appRegistry.find((app) => app.id === 'note-range-filter')).toBeUndefined();
  });

  it('should have midi-transposer at index 1 (Phase 1 Test Case 2)', () => {
    expect(appRegistry[1].id).toBe('midi-transposer');
  });
});

