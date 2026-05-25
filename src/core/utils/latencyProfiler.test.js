import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { latencyProfiler } from './latencyProfiler';

describe('LatencyProfiler Tests', () => {
  let originalNow;

  beforeEach(() => {
    originalNow = performance.now;
  });

  afterEach(() => {
    performance.now = originalNow;
  });

  it('calculates and returns the delta when markInput and markAudioTrigger are called sequentially', () => {
    let mockTime = 1000;
    performance.now = vi.fn().mockImplementation(() => {
      return mockTime;
    });

    const note = 60;
    
    // Mark input at t = 1000 ms
    latencyProfiler.markInput(note);

    // Advance time by 5 ms
    mockTime = 1005;

    // Mark audio trigger at t = 1005 ms
    const delta = latencyProfiler.markAudioTrigger(note);

    // Delta should be exactly 5 ms
    expect(delta).toBe(5);
  });

  it('returns null if markAudioTrigger is called without a matching markInput', () => {
    const delta = latencyProfiler.markAudioTrigger(99);
    expect(delta).toBeNull();
  });
});
