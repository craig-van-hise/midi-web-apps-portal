import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Tone from 'tone';
import { audioEngine } from './engine';

describe('AudioEngine Low Latency Initialization Tests', () => {
  beforeEach(() => {
    // Restore init mock if it was mocked in setupTests.js
    if (audioEngine.init.mockRestore) {
      audioEngine.init.mockRestore();
    }
  });

  it('sets Tone.context.lookAhead strictly less than 0.01 when initialized', async () => {
    // Make sure we have a context with lookAhead
    const originalLookAhead = Tone.context.lookAhead;

    // Reset initialization status of audioEngine for this test
    audioEngine.isInitialized = false;

    // Run the actual init method, catching the JSDOM AudioParam failure
    try {
      await audioEngine.init();
    } catch (err) {
      // Ignore environment-specific AudioParam failure in tests
    }

    // Verify lookAhead was updated
    expect(Tone.context.lookAhead).toBeLessThan(0.01);

    // Clean up
    Tone.context.lookAhead = originalLookAhead;
  });
});
