import { describe, it, expect } from 'vitest';
import { appRegistry } from './appRegistry';

describe('appRegistry', () => {
  it('should contain exactly 6 objects with valid url strings', () => {
    expect(appRegistry).toBeDefined();
    expect(Array.isArray(appRegistry)).toBe(true);
    expect(appRegistry.length).toBe(6);

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
});
