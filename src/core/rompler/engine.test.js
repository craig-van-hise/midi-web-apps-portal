import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Tone from 'tone';

// Global mock for Tone.js
vi.mock('tone', () => {
  const mockContext = {
    lookAhead: 0,
    updateInterval: 0,
    latencyHint: 'interactive',
    rawContext: {
      baseLatency: 0.005,
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined)
      },
      decodeAudioData: vi.fn().mockResolvedValue({
        getChannelData: () => new Float32Array(1000)
      })
    }
  };
  return {
    context: mockContext,
    getContext: () => mockContext,
    setContext: vi.fn((ctx) => {
      mockContext.lookAhead = ctx.lookAhead;
      mockContext.updateInterval = ctx.updateInterval;
      mockContext.latencyHint = ctx.latencyHint;
      mockContext.rawContext = ctx.rawContext || mockContext.rawContext;
    }),
    start: vi.fn().mockResolvedValue(undefined),
    Context: class {
      constructor(options) {
        this.lookAhead = options?.lookAhead ?? 0.005;
        this.updateInterval = options?.updateInterval ?? 0.01;
        this.latencyHint = options?.latencyHint ?? 'interactive';
        this.rawContext = mockContext.rawContext;
      }
    },
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
    Freeverb: class {
      constructor(options) {
        this.wet = { value: 0 };
        this.roomSize = options?.roomSize ?? 0.7;
        this.dampening = options?.dampening ?? 4000;
        this.connect = vi.fn().mockReturnThis();
      }
    },
    Sampler: class {
      constructor() {
        this.connect = vi.fn().mockReturnThis();
        this.triggerAttack = vi.fn();
        this.triggerRelease = vi.fn();
        this.releaseAll = vi.fn();
      }
    },
    Destination: {
      connect: vi.fn()
    },
    connect: vi.fn(),
    Frequency: vi.fn((val) => {
      return {
        toMidi: () => {
          if (typeof val === 'number') return val;
          if (val === 'C4') return 60;
          return 60;
        },
        toNote: () => 'C4'
      };
    }),
    now: vi.fn(() => 0),
    immediate: vi.fn(() => 0),
  };
});

describe('AudioEngine Low Latency Tone.js Reconstruct Tests', () => {
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

  it('configures Tone.js with low latency and lookAhead upon init', async () => {
    freshAudioEngine.isInitialized = false;
    await freshAudioEngine.init();

    expect(freshAudioEngine.isInitialized).toBe(true);
    expect(Tone.context.lookAhead).toBe(0.002);
  });

  it('creates and connects Tone nodes and instantiates Freeverb', async () => {
    freshAudioEngine.isInitialized = false;
    await freshAudioEngine.init();

    expect(freshAudioEngine.panVol).toBeDefined();
    expect(freshAudioEngine.splitter).toBeDefined();
    expect(freshAudioEngine.meterL).toBeDefined();
    expect(freshAudioEngine.meterR).toBeDefined();
    expect(freshAudioEngine.reverb).toBeDefined();
    expect(freshAudioEngine.reverb).toBeInstanceOf(Tone.Freeverb);
    expect(freshAudioEngine.reverb.roomSize).toBe(0.7);
    expect(freshAudioEngine.reverb.dampening).toBe(4000);
    expect(freshAudioEngine.reverbSend).toBeDefined();
    expect(freshAudioEngine.reverbSend).toBeInstanceOf(Tone.Gain);
  });

  it('updates reverbSend gain value when setReverbWet is called', async () => {
    freshAudioEngine.isInitialized = false;
    await freshAudioEngine.init();
    
    freshAudioEngine.setReverbWet(0.5);
    expect(freshAudioEngine.reverbSend.gain.value).toBe(0.5);
  });

  it('exposes noteOn, releaseNote, triggerAttack, and triggerRelease methods directly', async () => {
    expect(freshAudioEngine.noteOn).toBeDefined();
    expect(freshAudioEngine.releaseNote).toBeDefined();
    expect(freshAudioEngine.triggerAttack).toBeDefined();
    expect(freshAudioEngine.triggerRelease).toBeDefined();
  });

  it('typecasts note integers to strings (e.g. C4) for Tone.Sampler in noteOn and releaseNote', async () => {
    await freshAudioEngine.init();
    
    // Tone.Sampler is the default sampler in init, or we can mock/stub
    // Let's spy on triggerAttack and triggerRelease of the mock Tone.Sampler instance
    const triggerAttackSpy = vi.spyOn(freshAudioEngine.sampler, 'triggerAttack');
    const triggerReleaseSpy = vi.spyOn(freshAudioEngine.sampler, 'triggerRelease');

    freshAudioEngine.noteOn(60, 0.8);
    expect(triggerAttackSpy).toHaveBeenCalledWith('C4', expect.any(Number), 0.8);

    freshAudioEngine.releaseNote(60);
    expect(triggerReleaseSpy).toHaveBeenCalledWith('C4', expect.any(Number));
  });
});
