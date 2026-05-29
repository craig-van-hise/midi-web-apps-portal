export class MidiRingBuffer {
  constructor() {
<<<<<<< HEAD
    if (typeof SharedArrayBuffer === 'undefined') {
      const errorMsg = "FATAL ERROR: SharedArrayBuffer is undefined. You MUST kill and restart your terminal Vite Dev Server for the COOP/COEP security headers to apply.";
      alert(errorMsg);
      throw new Error(errorMsg);
    }
    
    const buffer = new SharedArrayBuffer(4096);
    this.array = new Int32Array(buffer);
    
=======
    // 1024 elements * 4 bytes per Int32 = 4096 bytes
    const buffer = typeof SharedArrayBuffer !== 'undefined' 
      ? new SharedArrayBuffer(4096) 
      : new ArrayBuffer(4096);
    
    this.array = new Int32Array(buffer);
    
    // Index 0: write_pointer (starts at absolute index 2)
    // Index 1: read_pointer (starts at absolute index 2)
>>>>>>> 01523582198bf0ef15b3a30740f21ac6d2863ee9
    Atomics.store(this.array, 0, 2);
    Atomics.store(this.array, 1, 2);
  }

  push(status, note, velocity) {
    const writePtr = Atomics.load(this.array, 0);
    const readPtr = Atomics.load(this.array, 1);

    // Compute next write pointer (payload ranges from index 2 to 1021 inclusive, size is 1020 bytes = 340 events)
    let nextWrite = writePtr + 3;
    if (nextWrite > 1021) {
      nextWrite = 2; // Wrap around
    }

    // If buffer is full, drop the event to avoid overwriting unread data
    if (nextWrite === readPtr) {
      return false;
    }

    // Write MIDI payload securely
    Atomics.store(this.array, writePtr, status);
    Atomics.store(this.array, writePtr + 1, note);
    Atomics.store(this.array, writePtr + 2, velocity);

    // Advance write pointer
    Atomics.store(this.array, 0, nextWrite);
    return true;
  }

  pull() {
    const writePtr = Atomics.load(this.array, 0);
    const readPtr = Atomics.load(this.array, 1);

    // Buffer is empty if write pointer equals read pointer
    if (writePtr === readPtr) {
      return null;
    }

    // Read MIDI payload securely
    const status = Atomics.load(this.array, readPtr);
    const note = Atomics.load(this.array, readPtr + 1);
    const velocity = Atomics.load(this.array, readPtr + 2);

    // Compute next read pointer
    let nextRead = readPtr + 3;
    if (nextRead > 1021) {
      nextRead = 2; // Wrap around
    }

    // Advance read pointer
    Atomics.store(this.array, 1, nextRead);

    return [status, note, velocity];
  }
}
