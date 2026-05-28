import { describe, it, expect } from 'vitest';
import { MidiRingBuffer } from './RingBuffer';

describe('MidiRingBuffer Concurrency Tests', () => {
  it('correctly pulls pushed MIDI event array and advances read pointer securely', () => {
    const buffer = new MidiRingBuffer();

    // Push MIDI event (status, note, velocity)
    buffer.push(144, 60, 100);

    // Pull from the buffer
    const event = buffer.pull();

    // Verify it returns the exact pushed event
    expect(event).toEqual([144, 60, 100]);

    // Pulling again should return null or empty as the read pointer advanced
    expect(buffer.pull()).toBeNull();
  });
});
