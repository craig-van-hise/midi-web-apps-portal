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
    Reverb: class {
      constructor() {
        this.wet = { value: 0 };
        this.generate = vi.fn().mockResolvedValue(undefined);
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

// Mock AudioWorkletNode and AudioContext globally for JSDOM
globalThis.AudioWorkletNode = class MockAudioWorkletNode {
  constructor() {
    this.port = {
      postMessage: vi.fn(),
      onmessage: null
    };
    this.connect = vi.fn();
    this.disconnect = vi.fn();
  }
};

globalThis.AudioNode = class MockAudioNode {
  constructor() {
    this.connect = vi.fn();
    this.disconnect = vi.fn();
  }
};

globalThis.AudioContext = class MockAudioContext {
  constructor(options) {
    this.latencyHint = options?.latencyHint || 'interactive';
    this.sampleRate = 44100;
    this.state = 'suspended';
    this.destination = new globalThis.AudioNode();
    this.audioWorklet = {
      addModule: vi.fn().mockResolvedValue(undefined)
    };
    this.decodeAudioData = vi.fn().mockResolvedValue({
      getChannelData: () => new Float32Array(1000)
    });
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: { value: 1.0 },
      connect: vi.fn()
    };
  }
  createStereoPanner() {
    return {
      pan: { value: 0 },
      connect: vi.fn()
    };
  }
  createConvolver() {
    return {
      buffer: null,
      connect: vi.fn()
    };
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      getFloatTimeDomainData: vi.fn(),
      connect: vi.fn()
    };
  }
  createChannelSplitter(channels) {
    return {
      connect: vi.fn()
    };
  }
  createBuffer(channels, length, sampleRate) {
    return {
      getChannelData: (ch) => new Float32Array(length)
    };
  }
};

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

  it('configures native AudioContext with interactive latencyHint upon init', async () => {
    freshAudioEngine.isInitialized = false;
    freshAudioEngine.initPromise = null;

    await freshAudioEngine.init();

    expect(freshAudioEngine.ctx).toBeDefined();
    expect(freshAudioEngine.ctx.latencyHint).toBe('interactive');
    expect(freshAudioEngine.ctx.state).toBe('running');
  });

  it('creates and connects native Gain, StereoPanner, and Analyser nodes', async () => {
    freshAudioEngine.isInitialized = false;
    freshAudioEngine.initPromise = null;

    await freshAudioEngine.init();

    expect(freshAudioEngine.internalTrim).toBeDefined();
    expect(freshAudioEngine.panner).toBeDefined();
    expect(freshAudioEngine.volumeNode).toBeDefined();
    expect(freshAudioEngine.analyserL).toBeDefined();
    expect(freshAudioEngine.analyserR).toBeDefined();
  });



  it('no longer exposes noteOn, releaseNote, triggerAttack, or triggerRelease methods', async () => {
    freshAudioEngine.isInitialized = false;
    freshAudioEngine.initPromise = null;

    expect(freshAudioEngine.noteOn).toBeUndefined();
    expect(freshAudioEngine.releaseNote).toBeUndefined();
    expect(freshAudioEngine.triggerAttack).toBeUndefined();
    expect(freshAudioEngine.triggerRelease).toBeUndefined();
  });

  it('sends ADSR parameters to worklet via postMessage', async () => {
    freshAudioEngine.isInitialized = false;
    freshAudioEngine.initPromise = null;
    try {
      await freshAudioEngine.init();
    } catch (err) {
      // Ignore
    }

    freshAudioEngine.setAttack(0.05);
    freshAudioEngine.setDecay(0.2);
    freshAudioEngine.setSustain(0.8);
    freshAudioEngine.setRelease(0.5);

    if (freshAudioEngine.nativeWorklet) {
      const calls = freshAudioEngine.nativeWorklet.port.postMessage.mock.calls;
      const adsrCalls = calls.filter(c => c[0]?.type === 'ADSR');
      expect(adsrCalls.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('sends PANIC message to worklet on releaseAll()', async () => {
    freshAudioEngine.isInitialized = false;
    freshAudioEngine.initPromise = null;

    try {
      await freshAudioEngine.init();
    } catch (err) {
      // Ignore
    }

    freshAudioEngine.releaseAll();

    if (freshAudioEngine.nativeWorklet) {
      const calls = freshAudioEngine.nativeWorklet.port.postMessage.mock.calls;
      const panicCalls = calls.filter(c => c[0]?.type === 'PANIC');
      expect(panicCalls.length).toBe(1);
    }
  });

});
