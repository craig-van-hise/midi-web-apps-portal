import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { audioEngine } from './plugins/chord-notator/audio/engine';

// Provide a basic mock for navigator.requestMIDIAccess to prevent failures in 
// tests that render components using MIDIProvider but don't explicitly test MIDI.
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: vi.fn().mockResolvedValue({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
    }),
    configurable: true,
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    length: 0,
    key: vi.fn((index) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock audioEngine.init to prevent Tone.js Web Audio API errors in JSDOM
vi.spyOn(audioEngine, 'init').mockResolvedValue(undefined);

// Mock rompler audioEngine to prevent Tone.js errors
import { audioEngine as romplerAudioEngine } from './core/rompler/engine';
vi.spyOn(romplerAudioEngine, 'init').mockResolvedValue(undefined);
vi.spyOn(romplerAudioEngine, 'loadInstrument').mockResolvedValue(undefined);
vi.spyOn(romplerAudioEngine, 'setVolume').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setPan').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setReverbWet').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setTuningOffset').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setAttack').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setDecay').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setSustain').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'setRelease').mockImplementation(() => {});
vi.spyOn(romplerAudioEngine, 'releaseAll').mockImplementation(() => {});

if (typeof window !== 'undefined' && typeof window.HTMLElement !== 'undefined') {
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
}

// Mock global fetch to return minimal valid binary LUT buffer
if (typeof globalThis !== 'undefined') {
  const minimalLutBuffer = new Uint8Array([
    0x50, 0x4c, 0x55, 0x54, // PLUT
    12, 0, 0, 0,            // stringPoolOffset = 12
    0, 0, 0, 0,             // rowsCount = 0
    0x5b, 0x5d              // "[]"
  ]).buffer;

  globalThis.fetch = vi.fn().mockResolvedValue({
    arrayBuffer: vi.fn().mockResolvedValue(minimalLutBuffer),
  });
}
