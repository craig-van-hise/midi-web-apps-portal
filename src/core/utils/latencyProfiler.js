import * as Tone from 'tone';

class LatencyProfiler {
  constructor() {
    this.notes = new Map();
  }

  markInput(note) {
    this.notes.set(note, performance.now());
  }

  markAudioTrigger(note) {
    const startTime = this.notes.get(note);
    if (startTime === undefined) {
      return null;
    }
    
    const endTime = performance.now();
    const jsDelta = endTime - startTime;
    this.notes.delete(note); // Clean up to prevent memory growth

    const outputLatency = Tone.context ? Tone.context.outputLatency : 0;
    const outputLatencyMs = outputLatency * 1000;

    console.warn(
      `[VV Profiler] Note: ${note} | JS Delta: ${jsDelta.toFixed(2)} ms | Output Latency: ${outputLatencyMs.toFixed(2)} ms`
    );

    return jsDelta;
  }
}

export const latencyProfiler = new LatencyProfiler();
