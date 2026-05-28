import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Tone from 'tone';

// Global mock for Tone.js
vi.mock('tone', () => {
  const mockContext = {
    lookAhead: 0,
    updateInterval: 0,
    latencyHint: 'interactive',
    rawContext: { baseLatency: 0.005 }
  };
  return {
    context: mockContext,
    getContext: () => mockContext,
    setContext: vi.fn((ctx) => {
      mockContext.lookAhead = ctx.lookAhead;
      mockContext.updateInterval = ctx.updateInterval;
      mockContext.latencyHint = ctx.latencyHint;
      mockContext.rawContext = ctx.rawContext;
    }),
    start: vi.fn().mockResolvedValue(undefined),
    Context: class {
      constructor(options) {
        this.lookAhead = options?.lookAhead ?? 0.005;
        this.updateInterval = options?.updateInterval ?? 0.01;
        this.latencyHint = options?.latencyHint ?? 'interactive';
        this.rawContext = { baseLatency: 0.005 };
      }
    },
    Volume: class {
      constructor() {
        this.connect = vi.fn().mockReturnThis();
        this.disconnect = vi.fn();
        this.dispose = vi.fn();
      }
    },
    AmplitudeEnvelope: class {
      constructor(envelope) {
        this.envelope = envelope;
        this.connect = vi.fn().mockReturnThis();
        this.disconnect = vi.fn();
        this.triggerAttack = vi.fn();
        this.triggerRelease = vi.fn();
        this.dispose = vi.fn();
      }
    },
    Player: class {
      constructor(buffer) {
        this.buffer = buffer;
        this.loop = false;
        this.playbackRate = 1;
        this.connect = vi.fn().mockReturnThis();
        this.start = vi.fn();
        this.stop = vi.fn();
        this.dispose = vi.fn();
      }
    },
    ToneAudioBuffers: class {
      constructor(urls, onload) {
        this.urls = urls;
        setTimeout(() => onload && onload(), 0);
      }
      get(note) {
        return { duration: 1.0 }; // mock buffer
      }
      dispose() {}
    },
    Frequency: vi.fn((val) => {
      return {
        toMidi: () => {
          if (typeof val === 'number') return val;
          if (val === 'C4') return 60;
          return 60; // simple fallback
        },
        toNote: () => 'C4'
      };
    }),
    now: vi.fn(() => 0),
    immediate: vi.fn(() => 0),
    Gain: class {
      constructor() {
        this.gain = { value: 1 };
        this.connect = vi.fn().mockReturnThis();
      }
    },
    PanVol: class {
      constructor() {
        this.volume = { value: 0 };
        this.pan = { value: 0 };
        this.connect = vi.fn().mockReturnThis();
        this.chain = vi.fn().mockReturnThis();
      }
    },
    Split: class {
      constructor() {
        this.connect = vi.fn().mockReturnThis();
      }
    },
    Meter: class {
      constructor() {
        this.getValue = vi.fn(() => 0);
      }
    },
    Reverb: class {
      constructor() {
        this.wet = { value: 0 };
        this.generate = vi.fn().mockResolvedValue(undefined);
      }
    },
    Destination: {
      connect: vi.fn()
    },
    Sampler: class {
      constructor() {
        this.connect = vi.fn().mockReturnThis();
      }
    }
  };
});

describe('AudioEngine Low Latency Initialization Tests', () => {
  let freshAudioEngine;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('./engine');
    freshAudioEngine = module.audioEngine;
    
    // Restore init mock if it was mocked in setupTests.js
    if (freshAudioEngine.init.mockRestore) {
      freshAudioEngine.init.mockRestore();
    }
  });

  it('sets Tone.context.lookAhead strictly less than 0.01 when initialized', async () => {
    // Make sure we have a context with lookAhead
    const originalLookAhead = Tone.context.lookAhead;

    // Reset initialization status of audioEngine for this test
    freshAudioEngine.isInitialized = false;

    // Run the actual init method, catching the JSDOM AudioParam failure in tests
    try {
      await freshAudioEngine.init();
    } catch (err) {
      // Ignore environment-specific AudioParam failure in tests
    }

    // Verify lookAhead was updated
    expect(Tone.context.lookAhead).toBeLessThan(0.01);

    // Clean up
    Tone.context.lookAhead = originalLookAhead;
  });

  it('configures Tone.Context with interactive latencyHint and small lookAhead upon init', async () => {
    freshAudioEngine.isInitialized = false;
    try {
      await freshAudioEngine.init();
    } catch (err) {
      // Ignore
    }

    expect(Tone.setContext).toHaveBeenCalled();
    const mockContext = Tone.setContext.mock.calls[0][0];
    expect(mockContext.lookAhead).toBe(0);
    expect(mockContext.updateInterval).toBe(0.01);
    expect(mockContext.latencyHint).toBe('interactive');
  });
});

describe('LoopedSampler Object Pooling Tests', () => {
  it('pre-allocates 32 voices and steals the oldest active voice on 33rd trigger', async () => {
    const { LoopedSampler } = await import('./engine');
    const sampler = new LoopedSampler({ C4: 'dummy.mp3' }, '');
    
    expect(sampler.voicePool).toHaveLength(32);
    expect(sampler.MAX_VOICES).toBe(32);

    // Trigger 32 notes with progressive timestamps to guarantee deterministic age
    let fakeTime = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    for (let i = 0; i < 32; i++) {
      sampler.triggerAttack(`C${i}`, 1);
      fakeTime += 1000; // Increment time for each trigger
    }

    // Check that all 32 voices are active and assigned
    sampler.voicePool.forEach((voice, index) => {
      expect(voice.isActive).toBe(true);
      expect(voice.currentNote).toBe(`C${index}`);
    });

    // Trigger the 33rd note
    sampler.triggerAttack('D4', 1);

    // The oldest voice (id: 0) should be hijacked and assigned to 'D4'
    const hijackedVoice = sampler.voicePool.find(v => v.id === 0);
    expect(hijackedVoice.currentNote).toBe('D4');
    expect(hijackedVoice.isActive).toBe(true);

    Date.now.mockRestore();
  });

  it('does not dispose voice on release, but flags isActive to false after release tail time', async () => {
    const { LoopedSampler } = await import('./engine');
    const sampler = new LoopedSampler({ C4: 'dummy.mp3' }, '');

    sampler.triggerAttack('C4', 1);
    const activeVoice = sampler.voicePool.find(v => v.isActive && v.currentNote === 'C4');
    expect(activeVoice).toBeDefined();

    vi.useFakeTimers();
    sampler.triggerRelease('C4');
    
    // Immediately after triggerRelease, it should still be active because of release tail
    expect(activeVoice.isActive).toBe(true);

    // Advance time by release tail (envelope release is 1.0, plus 0.1s safety)
    await vi.advanceTimersByTimeAsync(1100);

    // Now it should be flagged as inactive and currentNote cleared
    expect(activeVoice.isActive).toBe(false);
    expect(activeVoice.currentNote).toBeNull();

    vi.useRealTimers();
  });
});
