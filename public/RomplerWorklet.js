/**
 * RomplerWorklet.js — Custom 32-voice Polyphonic DSP AudioWorkletProcessor
 *
 * Architecture:
 *   - Reads MIDI events from a lock-free SharedArrayBuffer ring buffer
 *   - Performs pitch-shifted sample playback via linear interpolation
 *   - Applies per-voice ADSR envelope state machine
 *   - Zero external dependencies (no DOM, no Tone.js)
 *
 * SAB Layout (Int32Array, 1024 elements):
 *   [0] = writePointer (absolute index, starts at 2)
 *   [1] = readPointer  (absolute index, starts at 2)
 *   [2..1021] = payload triples: [status, note, velocity] × 340 events
 *
 * Message protocol:
 *   { type: 'SAB', buffer: SharedArrayBuffer }
 *   { type: 'SAMPLES', instrument: string, data: { [midiNote]: Float32Array } }
 *   { type: 'ADSR', attack, decay, sustain, release }
 */

// Envelope states
const ENV_IDLE    = 0;
const ENV_ATTACK  = 1;
const ENV_DECAY   = 2;
const ENV_SUSTAIN = 3;
const ENV_RELEASE = 4;

const MAX_VOICES = 32;

class RomplerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();

    // --- SAB ---
    this.sabArray = null;

    // --- Sample buffers: Map<instrument, Map<midiNote, Float32Array>> ---
    this.sampleBuffers = new Map();
    this.activeInstrument = null;

    // --- Default ADSR (seconds) ---
    this.adsrParams = {
      attack:  0.01,
      decay:   0.1,
      sustain: 1.0,
      release: 0.3
    };

    // --- Voice pool ---
    this.voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      this.voices.push({
        id: i,
        state: ENV_IDLE,        // envelope state
        midiNote: -1,           // currently assigned MIDI note
        velocity: 0,            // 0-127
        phase: 0.0,             // fractional phase pointer into sample buffer
        playbackRate: 1.0,      // varispeed ratio
        envLevel: 0.0,          // current envelope amplitude [0..1]
        envSampleCount: 0,      // samples elapsed in current env stage
        sampleBuffer: null,     // reference to the Float32Array for this voice
        lastUsed: 0             // timestamp for voice stealing (monotonic counter)
      });
    }

    this.voiceCounter = 0; // monotonic counter for voice-stealing LRU

    // --- Message handler ---
    this.port.onmessage = (event) => {
      const msg = event.data;

      if (msg.type === 'SAB') {
        this.sabArray = new Int32Array(msg.buffer);
      }

      if (msg.type === 'SET_INSTRUMENT') {
        this.activeInstrument = msg.instrument;
      }

      if (msg.type === 'SAMPLES') {
        // msg.data = { midiNote (int): Float32Array, ... }
        const instrumentMap = new Map();
        for (const [noteKey, pcmData] of Object.entries(msg.data)) {
          instrumentMap.set(Number(noteKey), pcmData);
        }
        this.sampleBuffers.set(msg.instrument, instrumentMap);
        this.activeInstrument = msg.instrument;
      }

      if (msg.type === 'ADSR') {
        if (msg.attack  !== undefined) this.adsrParams.attack  = msg.attack;
        if (msg.decay   !== undefined) this.adsrParams.decay   = msg.decay;
        if (msg.sustain !== undefined) this.adsrParams.sustain = msg.sustain;
        if (msg.release !== undefined) this.adsrParams.release = msg.release;
      }

      if (msg.type === 'PANIC') {
        // Immediately silence all voices
        for (let i = 0; i < MAX_VOICES; i++) {
          this.voices[i].state = ENV_IDLE;
          this.voices[i].midiNote = -1;
          this.voices[i].envLevel = 0.0;
          this.voices[i].sampleBuffer = null;
        }
      }
    };
  }

  /**
   * Find the closest sample buffer to a target MIDI note.
   * Returns { buffer: Float32Array, rootMidi: number } or null.
   */
  findClosestSample(targetMidi) {
    if (!this.activeInstrument) return null;
    const instrumentMap = this.sampleBuffers.get(this.activeInstrument);
    if (!instrumentMap || instrumentMap.size === 0) return null;

    let closestNote = -1;
    let closestDist = Infinity;

    for (const [midiNote] of instrumentMap) {
      const dist = Math.abs(midiNote - targetMidi);
      if (dist < closestDist) {
        closestDist = dist;
        closestNote = midiNote;
      }
    }

    if (closestNote === -1) return null;
    return {
      buffer: instrumentMap.get(closestNote),
      rootMidi: closestNote
    };
  }

  /**
   * Allocate a voice for a Note-On. Steals the oldest voice if pool is full.
   */
  allocateVoice() {
    // 1. Find a free (IDLE) voice
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voices[i].state === ENV_IDLE) {
        return this.voices[i];
      }
    }

    // 2. Steal the oldest active voice (lowest lastUsed)
    let oldest = this.voices[0];
    for (let i = 1; i < MAX_VOICES; i++) {
      if (this.voices[i].lastUsed < oldest.lastUsed) {
        oldest = this.voices[i];
      }
    }
    return oldest;
  }

  /**
   * Handle a Note-On event.
   */
  handleNoteOn(midiNote, velocity) {
    // Retrigger voice if the note is already actively playing
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voices[i].midiNote === midiNote && this.voices[i].state !== ENV_IDLE) {
        this.voices[i].phase = 0.0;
        this.voices[i].state = ENV_ATTACK;
        this.voices[i].velocity = velocity;
        this.voices[i].lastUsed = ++this.voiceCounter;
        
        // SEAMLESS ATTACK RESUME: Do not drop envLevel to 0.0.
        // Fast-forward the envSampleCount to match the current envelope level.
        const sr = sampleRate || 44100;
        const attackSamples = Math.max(1, this.adsrParams.attack * sr);
        this.voices[i].envSampleCount = this.voices[i].envLevel * attackSamples;
        return;
      }
    }

    const sample = this.findClosestSample(midiNote);
    if (!sample) return;

    const voice = this.allocateVoice();
    voice.midiNote = midiNote;
    voice.velocity = velocity;
    voice.phase = 0.0;
    voice.playbackRate = Math.pow(2, (midiNote - sample.rootMidi) / 12);
    voice.sampleBuffer = sample.buffer;
    voice.state = ENV_ATTACK;
    voice.envLevel = 0.0;
    voice.envSampleCount = 0;
    voice.lastUsed = ++this.voiceCounter;
  }

  /**
   * Handle a Note-Off event.
   */
  handleNoteOff(midiNote) {
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voices[i].midiNote === midiNote && this.voices[i].state !== ENV_IDLE) {
        this.voices[i].state = ENV_RELEASE;
        this.voices[i].envSampleCount = 0;
        break;
      }
    }
  }



  /**
   * Compute one sample of ADSR envelope for a voice.
   * Mutates voice.state, voice.envLevel, voice.envSampleCount.
   * Returns the envelope amplitude [0..1].
   */
  computeEnvelope(voice) {
    const sr = sampleRate; // global AudioWorklet variable
    const { attack, decay, sustain, release } = this.adsrParams;

    switch (voice.state) {
      case ENV_ATTACK: {
        const attackSamples = Math.max(1, attack * sr);
        voice.envLevel = voice.envSampleCount / attackSamples;
        voice.envSampleCount++;
        if (voice.envLevel >= 1.0) {
          voice.envLevel = 1.0;
          voice.state = ENV_DECAY;
          voice.envSampleCount = 0;
        }
        return voice.envLevel;
      }

      case ENV_DECAY: {
        const decaySamples = Math.max(1, decay * sr);
        const t = voice.envSampleCount / decaySamples;
        voice.envLevel = 1.0 - (1.0 - sustain) * t;
        voice.envSampleCount++;
        if (t >= 1.0) {
          voice.envLevel = sustain;
          voice.state = ENV_SUSTAIN;
          voice.envSampleCount = 0;
        }
        return voice.envLevel;
      }

      case ENV_SUSTAIN: {
        voice.envLevel = sustain;
        return voice.envLevel;
      }

      case ENV_RELEASE: {
        const releaseSamples = Math.max(1, release * sr);
        const t = voice.envSampleCount / releaseSamples;
        // Store the level at the moment release began
        if (voice.envSampleCount === 0) {
          voice._releaseStartLevel = voice.envLevel;
        }
        voice.envLevel = voice._releaseStartLevel * (1.0 - t);
        voice.envSampleCount++;
        if (t >= 1.0) {
          voice.envLevel = 0.0;
          voice.state = ENV_IDLE;
          voice.midiNote = -1;
          voice.sampleBuffer = null;
        }
        return Math.max(0.0, voice.envLevel);
      }

      default:
        return 0.0;
    }
  }

  /**
   * Read a sample from the buffer using linear interpolation at a fractional index.
   */
  linearInterpolate(buffer, index) {
    const i0 = index | 0; // floor
    const i1 = i0 + 1;
    const frac = index - i0;

    if (i0 < 0 || i0 >= buffer.length) return 0.0;

    const s0 = buffer[i0];
    const s1 = i1 < buffer.length ? buffer[i1] : 0.0;

    return s0 + frac * (s1 - s0);
  }



  drainSAB() {
    if (!this.sabArray) return;
    while (true) {
      const writePtr = Atomics.load(this.sabArray, 0);
      const readPtr = Atomics.load(this.sabArray, 1);
      if (writePtr === readPtr) break;

      const status = Atomics.load(this.sabArray, readPtr);
      const note = Atomics.load(this.sabArray, readPtr + 1);
      const velocity = Atomics.load(this.sabArray, readPtr + 2);

      let nextRead = readPtr + 3;
      if (nextRead > 1021) nextRead = 2;
      Atomics.store(this.sabArray, 1, nextRead);

      const command = status & 0xf0;
      if (command === 0x90 && velocity > 0) this.handleNoteOn(note, velocity);
      else if (command === 0x80 || (command === 0x90 && velocity === 0)) this.handleNoteOff(note);
    }
  }

  process(inputs, outputs, parameters) {
    this.drainSAB();
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channelData = output[0];
    const blockSize = channelData.length;

    // Zero the buffer
    for (let f = 0; f < blockSize; f++) {
      channelData[f] = 0.0;
    }

    for (let v = 0; v < MAX_VOICES; v++) {
      const voice = this.voices[v];
      if (voice.state === ENV_IDLE) continue;

      const buffer = voice.sampleBuffer;
      if (!buffer || buffer.length === 0) {
        voice.state = ENV_IDLE;
        continue;
      }

      const velocityGain = voice.velocity / 127;

      for (let f = 0; f < blockSize; f++) {
        const envAmp = this.computeEnvelope(voice);
        if (voice.state === ENV_IDLE) break;

        // CRITICAL: Strict Bounds Check to prevent NaN poisoning
        if (voice.phase >= buffer.length - 1) {
          voice.state = ENV_IDLE;
          continue;
        }

        const sample = this.linearInterpolate(buffer, voice.phase);

        // CRITICAL: NaN Guard to prevent permanent Web Audio mute
        const sampleValue = Number.isNaN(sample) ? 0.0 : sample;
        channelData[f] += sampleValue * envAmp * velocityGain;

        voice.phase += voice.playbackRate;

        const loopStart = buffer.length * 0.2;
        const loopEnd   = buffer.length * 0.8;
        if (voice.phase >= loopEnd) {
          voice.phase = loopStart + (voice.phase - loopEnd);
        }
      }
    }

    for (let f = 0; f < blockSize; f++) {
      channelData[f] = Math.tanh(channelData[f]);
    }

    return true;
  }
}

registerProcessor('rompler-processor', RomplerWorklet);
