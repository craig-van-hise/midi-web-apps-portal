import * as Tone from 'tone';
import { Soundfont } from 'smplr';
import { latencyProfiler } from '../utils/latencyProfiler';

// The baseUrl containing samples
const BASE_URL = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';

const SMPLR_MAP = {
  'electric-piano': 'electric_piano_1',
  'harp': 'orchestral_harp',
  'vibraphone': 'vibraphone',
  'celeste': 'celesta'
};

class LoopedSampler {
  constructor(urls, baseUrl = '') {
    this.output = new Tone.Volume(0);
    this.activeVoices = new Map();
    this.envelope = { attack: 0.1, decay: 0.1, sustain: 1.0, release: 1.0 };
    this.loaded = new Promise((resolve) => {
      this.buffers = new Tone.ToneAudioBuffers(urls, () => resolve(), baseUrl);
    });
  }

  triggerAttack(note, velocity = 1) {
    if (this.activeVoices.has(note)) return; // prevent re-triggering active note
    
    // Assume root note is C4 for the string sample (Adjust if the user maps multiple)
    const rootNote = Tone.Frequency('C4').toMidi(); 
    const targetNote = Tone.Frequency(note).toMidi();
    const interval = targetNote - rootNote;
    
    const buffer = this.buffers.get('C4'); // Get the root buffer
    if (!buffer) return;

    const player = new Tone.Player(buffer);
    player.loop = true; // INFINITE SUSTAIN

    // Trim the sample to loop only the steady sustain phase (20% to 80%)
    const loopStart = buffer.duration * 0.2;
    const loopEnd = buffer.duration * 0.8;
    if (loopEnd > loopStart) {
      player.loopStart = loopStart;
      player.loopEnd = loopEnd;
    }

    player.playbackRate = Math.pow(2, interval / 12); // Varispeed pitch shift
    
    const env = new Tone.AmplitudeEnvelope(this.envelope);
    player.connect(env);
    env.connect(this.output);
    
    this.activeVoices.set(note, { player, env });
    
    player.start();
    env.triggerAttack(Tone.now(), velocity);
  }

  triggerRelease(note) {
    const voice = this.activeVoices.get(note);
    if (!voice) return;
    
    voice.env.triggerRelease();
    this.activeVoices.delete(note);
    
    // Garbage collect after release phase
    setTimeout(() => {
      voice.player.dispose();
      voice.env.dispose();
    }, (this.envelope.release + 0.1) * 1000);
  }

  // Allow dynamic ADSR updates
  set(params) {
    if (params.envelope) {
      this.envelope = { ...this.envelope, ...params.envelope };
    }
  }

  disconnect() {
    this.output.disconnect();
  }

  dispose() {
    this.activeVoices.forEach(voice => {
      voice.player.dispose();
      voice.env.dispose();
    });
    this.activeVoices.clear();
    this.buffers.dispose();
    this.output.dispose();
  }
}

class AudioEngine {
  constructor() {
    this.sampler = null;
    this.panVol = null;
    this.splitter = null;
    this.meterL = null;
    this.meterR = null;
    this.reverb = null;
    this.internalTrim = null;
    
    this.isInitialized = false;
    this.isInstrumentLoading = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    await Tone.start();
    Tone.context.lookAhead = 0.002;
    
    if (Tone.context.rawContext && Tone.context.rawContext.baseLatency !== undefined) {
      // Tone.js automatically attempts interactive latency, but we force lookAhead down.
      Tone.context.lookAhead = 0.002; // 2ms safety buffer instead of 10ms
    }
    
    // The Chain: Sampler -> PanVol -> ChannelSplitter -> MeterL / MeterR
    //                            \-> Reverb -> Destination

    this.panVol = new Tone.PanVol(0, 0); // pan 0, vol 0 (dB)
    this.splitter = new Tone.Split(2);
    this.meterL = new Tone.Meter();
    this.meterR = new Tone.Meter();
    this.reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.01,
      wet: 0,
    });
    
    await this.reverb.generate(); // Ensure impulse response is created

    this.internalTrim = new Tone.Gain(1);
    this.internalTrim.connect(this.panVol);

    this.panVol.connect(this.splitter);
    this.splitter.connect(this.meterL, 0, 0);
    this.splitter.connect(this.meterR, 1, 0);
    this.panVol.chain(this.reverb, Tone.Destination);

    // Create a dummy sampler just to have the chain setup
    this.sampler = new Tone.Sampler().connect(this.internalTrim);

    this.isInitialized = true;
  }

  async loadInstrument(instrument) {
    if (!this.isInitialized) return;
    this.isInstrumentLoading = true;

    try {
      // Disconnect and dispose old sampler
      if (this.sampler) {
        if (typeof this.sampler.disconnect === 'function') {
          this.sampler.disconnect();
        }
        if (typeof this.sampler.dispose === 'function') {
          this.sampler.dispose();
        }
      }

      if (instrument === 'strings') {
        // 1. Fetch the Base64 JS payload from the CDN
        const response = await fetch('https://gleitz.github.io/midi-js-soundfonts/MusyngKite/string_ensemble_1-ogg.js');
        const text = await response.text();
        
        // 2. Extract the C4 Data URI
        const match = text.match(/"C4":\s*"(data:audio\/ogg;base64,[^"]+)"/);
        if (!match || !match[1]) {
          throw new Error("Failed to parse C4 Base64 data from soundfont.");
        }
        const dataUri = match[1];
        
        // 3. Initialize LoopedSampler with the raw Data URI and an empty baseUrl
        const loopedSampler = new LoopedSampler({ 'C4': dataUri }, '');
        
        await loopedSampler.loaded;
        this.sampler = loopedSampler;
        if (this.internalTrim) {
          this.sampler.output.connect(this.internalTrim);
        }
      } else if (SMPLR_MAP[instrument]) {
        const smplr = new Soundfont(Tone.context.rawContext, {
          instrument: SMPLR_MAP[instrument],
          destination: this.internalTrim || this.panVol?.input || Tone.context.rawContext.destination
        });
        
        this.sampler = smplr;
        await smplr.load;
        console.log(`Loaded ${instrument} (smplr: ${SMPLR_MAP[instrument]})`);
      } else {
        const sampleMap = this.getSampleMap(instrument);
        const baseUrl = `${BASE_URL}${instrument}/`;

        await new Promise((resolve) => {
          this.sampler = new Tone.Sampler({
            urls: sampleMap,
            baseUrl: baseUrl,
            onload: () => {
              if (this.sampler && this.internalTrim) {
                this.sampler.connect(this.internalTrim);
                console.log(`Loaded ${instrument}`);
              }
              resolve();
            }
          });
        });
      }

      // Apply Gain Staging Map
      const gainMap = {
        'electric-piano': 2.0,
        'vibraphone': 2.0,
        'strings': 2.0,
        'celeste': 2.0,
        'harp': 2.5
      };

      if (this.internalTrim) {
        this.internalTrim.gain.value = gainMap[instrument] || 1.0;
      }
    } catch (err) {
      console.error(`Failed to load ${instrument}:`, err);
    } finally {
      this.isInstrumentLoading = false;
    }
  }

  noteOn(note, velocity = 1) {
    if (!this.sampler || !this.isInitialized || this.isInstrumentLoading) return;
    
    let midiNote;
    if (typeof note === 'number') {
      midiNote = note;
    } else {
      midiNote = Tone.Frequency(note).toMidi();
    }
    latencyProfiler.markAudioTrigger(midiNote);

    if (this.sampler instanceof Tone.Sampler) {
      this.sampler.triggerAttack(note, Tone.now(), velocity);
    } else if (this.sampler instanceof LoopedSampler) {
      this.sampler.triggerAttack(note, velocity);
    } else if (typeof this.sampler.start === 'function') {
      // smplr uses 0-127
      this.sampler.start({
        note: note,
        velocity: velocity * 127
      });
    }
  }

  releaseNote(note) {
    if (!this.sampler || !this.isInitialized || this.isInstrumentLoading) return;
    
    // If the instrument is a LoopedSampler
    if (this.sampler instanceof LoopedSampler) {
      this.sampler.triggerRelease(note);
    }
    // If the instrument is a smplr Soundfont
    else if (typeof this.sampler.stop === 'function') { 
        // Pass the primitive note directly. Do NOT use { note: note }
        this.sampler.stop(note); 
    } 
    // If the instrument is a Tone.Sampler
    else if (typeof this.sampler.triggerRelease === 'function') {
        this.sampler.triggerRelease(note, Tone.now());
    }
  }

  triggerAttack(notes, velocity = 1) {
    if (!this.sampler || !this.isInitialized || this.isInstrumentLoading) return;
    notes.forEach(noteNum => {
      const noteStr = Tone.Frequency(noteNum, "midi").toNote();
      this.noteOn(noteStr, velocity);
    });
  }

  triggerRelease(notes) {
    if (!this.sampler || !this.isInitialized || this.isInstrumentLoading) return;
    notes.forEach(noteNum => {
      const noteStr = Tone.Frequency(noteNum, "midi").toNote();
      this.releaseNote(noteStr);
    });
  }

  releaseAll() {
    if (!this.sampler || !this.isInitialized) return;
    if (this.sampler instanceof Tone.Sampler) {
      this.sampler.releaseAll();
    } else if (this.sampler instanceof LoopedSampler) {
      this.sampler.activeVoices.forEach((_, note) => this.sampler.triggerRelease(note));
    } else if (typeof this.sampler.stop === 'function') {
      this.sampler.stop();
    }
  }

  setVolume(db) {
    if (!this.panVol) return;
    this.panVol.volume.value = db; // ranges from -60 to 0
    if (db <= -60) {
      this.panVol.volume.value = -Infinity;
    }
  }

  setPan(pan) {
    if (!this.panVol) return;
    this.panVol.pan.value = pan;
  }

  setReverbWet(wet) {
    if (!this.reverb) return;
    this.reverb.wet.value = wet;
  }

  getMeterLevels() {
    if (!this.meterL || !this.meterR) return { l: -100, r: -100 };
    const l = this.meterL.getValue();
    const r = this.meterR.getValue();
    return {
      l: typeof l === 'number' ? l : l[0],
      r: typeof r === 'number' ? r : r[0]
    };
  }

  setTuningOffset(cents) {
    if (!this.sampler) return;
    const samplerAny = this.sampler;
    if (samplerAny._detune) {
       samplerAny._detune.value = cents;
    } else if (samplerAny.detune) {
       samplerAny.detune.value = cents;
    }
  }

  setAttack(attack) {
    if (!this.sampler) return;
    if (this.sampler instanceof Tone.Sampler) {
      this.sampler.attack = attack;
    } else if (this.sampler instanceof LoopedSampler) {
      this.sampler.set({ envelope: { attack } });
    }
  }

  setDecay(decay) {
    if (!this.sampler) return;
    if (this.sampler instanceof LoopedSampler) {
      this.sampler.set({ envelope: { decay } });
    }
  }

  setSustain(sustain) {
    if (!this.sampler) return;
    if (this.sampler instanceof LoopedSampler) {
      this.sampler.set({ envelope: { sustain } });
    }
  }

  setRelease(release) {
    if (!this.sampler) return;
    if (this.sampler instanceof Tone.Sampler) {
      this.sampler.release = release;
    } else if (this.sampler instanceof LoopedSampler) {
      this.sampler.set({ envelope: { release } });
    }
  }

  getSampleMap(instrument) {
    if (instrument === 'piano') {
      return {
        'A1': 'A1.mp3', 'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3', 'A5': 'A5.mp3', 'A6': 'A6.mp3',
        'C1': 'C1.mp3', 'C2': 'C2.mp3', 'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3', 'C6': 'C6.mp3',
        'D#1': 'Ds1.mp3', 'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3', 'D#5': 'Ds5.mp3', 'D#6': 'Ds6.mp3',
        'F#1': 'Fs1.mp3', 'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3', 'F#5': 'Fs5.mp3', 'F#6': 'Fs6.mp3',
      };
    }
    
    if (instrument === 'electric-piano') {
        return {
            'C2': 'C2.mp3',
            'C3': 'C3.mp3',
            'C4': 'C4.mp3',
            'C5': 'C5.mp3'
        };
    }

    if (instrument === 'guitar-acoustic') {
        return {
             'A2': 'A2.mp3', 'A3': 'A3.mp3', 'A4': 'A4.mp3',
             'C3': 'C3.mp3', 'C4': 'C4.mp3', 'C5': 'C5.mp3',
             'D#2': 'Ds2.mp3', 'D#3': 'Ds3.mp3', 'D#4': 'Ds4.mp3',
             'F#2': 'Fs2.mp3', 'F#3': 'Fs3.mp3', 'F#4': 'Fs4.mp3',
        };
    }

    if (instrument === 'bass-electric') {
        return {
            'A#1': 'As1.mp3', 'A#2': 'As2.mp3', 'A#3': 'As3.mp3', 'A#4': 'As4.mp3',
            'C#1': 'Cs1.mp3', 'C#2': 'Cs2.mp3', 'C#3': 'Cs3.mp3', 'C#4': 'Cs4.mp3',
            'E1': 'E1.mp3', 'E2': 'E2.mp3', 'E3': 'E3.mp3', 'E4': 'E4.mp3',
            'G1': 'G1.mp3', 'G2': 'G2.mp3', 'G3': 'G3.mp3', 'G4': 'G4.mp3',
        };
    }

    return { 'C4': 'C4.mp3' };
  }
}

export const audioEngine = new AudioEngine();
