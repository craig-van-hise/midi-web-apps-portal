import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('index.html structure', () => {
  it('contains the Material Symbols Outlined stylesheet link', () => {
    const htmlPath = path.resolve(__dirname, '../../index.html');
    const content = fs.readFileSync(htmlPath, 'utf-8');
    expect(content).toContain('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
  });
});
