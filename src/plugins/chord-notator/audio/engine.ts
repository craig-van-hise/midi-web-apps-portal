import * as Tone from 'tone';

let activeMidiOutCallback: ((data: number[]) => void) | null = null;

export function setMidiOutCallback(callback: ((data: number[]) => void) | null) {
  activeMidiOutCallback = callback;
}

function sendMidiOut(midiData: number[]) {
  if (activeMidiOutCallback) {
    activeMidiOutCallback(midiData);
  }
}

class AudioEngine {
  isInitialized = true;
  isInstrumentLoading = false;

  async init() {
    this.isInitialized = true;
  }

  async loadInstrument(instrument: string): Promise<void> {
    this.isInstrumentLoading = false;
  }

  noteOn(note: string, velocity: number = 1) {
    try {
      const noteNum = Tone.Frequency(note).toMidi();
      sendMidiOut([0x90, noteNum, Math.round(velocity * 127)]);
    } catch (e) {
      console.error('Error in noteOn:', e);
    }
  }

  releaseNote(note: string | number) {
    try {
      const noteNum = typeof note === 'number' ? note : Tone.Frequency(note).toMidi();
      sendMidiOut([0x80, noteNum, 0]);
    } catch (e) {
      console.error('Error in releaseNote:', e);
    }
  }

  triggerAttack(notes: number[], velocity: number = 1) {
    notes.forEach(noteNum => {
      sendMidiOut([0x90, noteNum, Math.round(velocity * 127)]);
    });
  }

  triggerRelease(notes: number[]) {
    notes.forEach(noteNum => {
      sendMidiOut([0x80, noteNum, 0]);
    });
  }

  releaseAll() {
    // Parent handles panic/reset
  }

  setVolume(db: number) {}
  setPan(pan: number) {}
  setReverbWet(wet: number) {}
  getMeterLevels(): { l: number; r: number } {
    return { l: -100, r: -100 };
  }
  setTuningOffset(cents: number) {}
  setAttack(attack: number) {}
  setDecay(decay: number) {}
  setSustain(sustain: number) {}
  setRelease(release: number) {}
  getSampleMap(instrument: string): Record<string, string> {
    return {};
  }
}

export const audioEngine = new AudioEngine();
