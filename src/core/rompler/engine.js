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

<<<<<<< HEAD
// Note name to MIDI number mapping for sample maps
const NOTE_TO_MIDI = {
  'C1': 24, 'C#1': 25, 'D1': 26, 'D#1': 27, 'E1': 28, 'F1': 29, 'F#1': 30, 'G1': 31, 'G#1': 32, 'A1': 33, 'A#1': 34, 'B1': 35,
  'C2': 36, 'C#2': 37, 'D2': 38, 'D#2': 39, 'E2': 40, 'F2': 41, 'F#2': 42, 'G2': 43, 'G#2': 44, 'A2': 45, 'A#2': 46, 'B2': 47,
  'C3': 48, 'C#3': 49, 'D3': 50, 'D#3': 51, 'E3': 52, 'F3': 53, 'F#3': 54, 'G3': 55, 'G#3': 56, 'A3': 57, 'A#3': 58, 'B3': 59,
  'C4': 60, 'C#4': 61, 'D4': 62, 'D#4': 63, 'E4': 64, 'F4': 65, 'F#4': 66, 'G4': 67, 'G#4': 68, 'A4': 69, 'A#4': 70, 'B4': 71,
  'C5': 72, 'C#5': 73, 'D5': 74, 'D#5': 75, 'E5': 76, 'F5': 77, 'F#5': 78, 'G5': 79, 'G#5': 80, 'A5': 81, 'A#5': 82, 'B5': 83,
  'C6': 84, 'C#6': 85, 'D6': 86, 'D#6': 87, 'E6': 88, 'F6': 89, 'F#6': 90, 'G6': 91, 'G#6': 92, 'A6': 93, 'A#6': 94, 'B6': 95,
};
=======
export class LoopedSampler {
  constructor(urls, baseUrl = '') {
    this.output = new Tone.Volume(0);
    this.envelope = { attack: 0.1, decay: 0.1, sustain: 1.0, release: 1.0 };
    
    this.MAX_VOICES = 32;
    this.voicePool = Array.from({ length: this.MAX_VOICES }, (_, i) => {
        const env = new Tone.AmplitudeEnvelope(this.envelope).connect(this.output);
        const player = new Tone.Player().connect(env);
        player.loop = true;
        return { id: i, player, env, isActive: false, currentNote: null, lastUsed: 0 };
    });

    this.loaded = new Promise((resolve) => {
      this.buffers = new Tone.ToneAudioBuffers(urls, () => resolve(), baseUrl);
    });
  }

  triggerAttack(note, velocity = 1) {
    const existing = this.voicePool.find(v => v.isActive && v.currentNote === note);
    if (existing) return;
    
    // Assume root note is C4 for the string sample (Adjust if the user maps multiple)
    const rootNote = Tone.Frequency('C4').toMidi(); 
    const targetNote = Tone.Frequency(note).toMidi();
    const interval = targetNote - rootNote;
    
    const buffer = this.buffers.get('C4'); // Get the root buffer
    if (!buffer) return;

    let voice = this.voicePool.find(v => !v.isActive);
    if (!voice) {
      // Voice stealing logic: find the voice with the lowest lastUsed timestamp
      voice = this.voicePool.reduce((oldest, current) => {
        return current.lastUsed < oldest.lastUsed ? current : oldest;
      }, this.voicePool[0]);

      voice.env.triggerRelease(Tone.immediate());
      voice.player.stop();
    }

    voice.player.buffer = buffer;

    // Trim the sample to loop only the steady sustain phase (20% to 80%)
    const loopStart = buffer.duration * 0.2;
    const loopEnd = buffer.duration * 0.8;
    if (loopEnd > loopStart) {
      voice.player.loopStart = loopStart;
      voice.player.loopEnd = loopEnd;
    }

    voice.player.playbackRate = Math.pow(2, interval / 12); // Varispeed pitch shift
    
    voice.isActive = true;
    voice.currentNote = note;
    voice.lastUsed = Date.now();
    
    voice.player.start();
    voice.env.triggerAttack(Tone.immediate(), velocity);
  }

  triggerRelease(note) {
    const voice = this.voicePool.find(v => v.isActive && v.currentNote === note);
    if (!voice) return;
    
    voice.env.triggerRelease(Tone.immediate());
    
    // Flag isActive = false after release tail time
    setTimeout(() => {
      if (voice.currentNote === note) {
        voice.isActive = false;
        voice.currentNote = null;
      }
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
    this.voicePool.forEach(voice => {
      voice.player.dispose();
      voice.env.dispose();
    });
    this.voicePool = [];
    this.buffers.dispose();
    this.output.dispose();
  }
}
>>>>>>> 01523582198bf0ef15b3a30740f21ac6d2863ee9

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.internalTrim = null;
    this.panner = null;
    this.volumeNode = null;
    this.convolver = null;
    this.reverbWetNode = null;
    this.reverbDryNode = null;
    this.splitter = null;
    this.analyserL = null;
    this.analyserR = null;
    
    // Worklet bridge
    this.nativeWorklet = null;

    this.isInitialized = false;
    this.isInstrumentLoading = false;
    this.initPromise = null;
  }

<<<<<<< HEAD
  async init(sabBuffer) {
    if (sabBuffer) {
      this.sabBuffer = sabBuffer;
      if (this.isInitialized && this.nativeWorklet) {
        this.nativeWorklet.port.postMessage({ type: 'SAB', buffer: this.sabBuffer });
      }
    }

    if (this.isInitialized || this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // 1. Uncompromising Pure Native Context
      const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new NativeAudioContext({ latencyHint: 'interactive' });
      if (this.ctx.state === 'suspended') await this.ctx.resume();

      // 2. Pure Native Mixer Nodes (Reverb eradicated for live-performance latency)
      this.internalTrim = this.ctx.createGain();
      this.panner = this.ctx.createStereoPanner();
      this.volumeNode = this.ctx.createGain();

      this.internalTrim.gain.value = 1.0;

      // 3. VU Meters (Native AnalyserNodes)
      this.analyserL = this.ctx.createAnalyser();
      this.analyserR = this.ctx.createAnalyser();
      this.splitter = this.ctx.createChannelSplitter(2);

      // 4. Native Routing Graph - DIRECT OUT
      this.internalTrim.connect(this.panner);
      this.panner.connect(this.volumeNode);
      
      // Master Out (Zero FFT Delay)
      this.volumeNode.connect(this.ctx.destination);

      // Meter Routing
      this.volumeNode.connect(this.splitter);
      this.splitter.connect(this.analyserL, 0);
      this.splitter.connect(this.analyserR, 1);

      // 5. Native AudioWorklet Bridge
      try {
        const basePath = import.meta.env?.BASE_URL || '/';
        const workletUrl = `${basePath}RomplerWorklet.js`.replace(/\/\//g, '/');
        await this.ctx.audioWorklet.addModule(workletUrl);
        
        this.nativeWorklet = new AudioWorkletNode(this.ctx, 'rompler-processor');
        
        // THIS WILL NOW SUCCEED: Connecting pure native to pure native
        this.nativeWorklet.connect(this.internalTrim);

        if (this.sabBuffer) {
          this.nativeWorklet.port.postMessage({ type: 'SAB', buffer: this.sabBuffer });
        }

        console.log('[AudioEngine] Pure Native Worklet bridge established.');
      } catch (err) {
        console.error('[AudioEngine] Worklet initialization failed:', err);
      }
=======
  async init() {
    if (this.isInitialized || this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Only set a new context if one isn't already running
      if (!Tone.context || Tone.context.state !== 'running') {
        const optimizedContext = new Tone.Context({
          latencyHint: 'interactive',
          lookAhead: 0, // Force absolute zero scheduling delay
          updateInterval: 0.01 
        });
        Tone.setContext(optimizedContext);
      }

      // Start audio (will resolve immediately if user gesture exists, or queue if not)
      try {
        await Tone.start();
      } catch (e) {
        console.warn("Tone.start() waiting for interaction...");
      }

      this.panVol = new Tone.PanVol(0, 0); 
      this.splitter = new Tone.Split(2);
      this.meterL = new Tone.Meter();
      this.meterR = new Tone.Meter();
      this.reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 0 });
      await this.reverb.generate(); 
      this.internalTrim = new Tone.Gain(1).connect(this.panVol);
      this.panVol.connect(this.splitter);
      this.splitter.connect(this.meterL, 0, 0);
      this.splitter.connect(this.meterR, 1, 0);
      this.panVol.chain(this.reverb, Tone.Destination);
      this.sampler = new Tone.Sampler().connect(this.internalTrim);

>>>>>>> 01523582198bf0ef15b3a30740f21ac6d2863ee9
      this.isInitialized = true;
    })();
    return this.initPromise;
  }



  async loadInstrument(instrument) {
    if (!this.isInitialized) return;
    this.isInstrumentLoading = true;

    try {
      if (instrument === 'strings') {
        // Fetch the Base64 JS payload from the CDN
        const response = await fetch('https://gleitz.github.io/midi-js-soundfonts/MusyngKite/string_ensemble_1-ogg.js');
        const text = await response.text();
        
        // Extract the C4 Data URI
        const match = text.match(/"C4":\s*"(data:audio\/ogg;base64,[^"]+)"/);
        if (!match || !match[1]) {
          throw new Error("Failed to parse C4 Base64 data from soundfont.");
        }
        
        // Decode the Data URI to raw PCM Float32Array
        const dataUri = match[1];
        const blobResponse = await fetch(dataUri);
        const arrayBuffer = await blobResponse.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        const pcmData = audioBuffer.getChannelData(0);

        // Send to Worklet: C4 = MIDI 60
        if (this.nativeWorklet) {
          this.nativeWorklet.port.postMessage({
            type: 'SAMPLES',
            instrument,
            data: { 60: pcmData }
          });
        }
        console.log(`[AudioEngine] Loaded ${instrument} → Worklet`);

      } else if (SMPLR_MAP[instrument]) {
        // For smplr instruments, we need to fetch the samples ourselves for the worklet
        // smplr uses its own internal format, so we load via Soundfont to get the decoded audio
        // then extract PCM and send to worklet
        const smplr = new Soundfont(this.ctx, {
          instrument: SMPLR_MAP[instrument],
        });
        await smplr.load;

        // smplr doesn't easily expose raw buffers, so for these instruments
        // we fetch the MIDI.js soundfont and decode manually
        const smplrToSoundfont = {
          'electric_piano_1': 'electric_piano_1',
          'orchestral_harp': 'orchestral_harp',
          'vibraphone': 'vibraphone',
          'celesta': 'celesta'
        };
        const sfName = smplrToSoundfont[SMPLR_MAP[instrument]] || SMPLR_MAP[instrument];
        
        try {
          const sfResponse = await fetch(`https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${sfName}-ogg.js`);
          const sfText = await sfResponse.text();
          
          // Parse all note data URIs from the soundfont JS file
          const noteRegex = /"([A-G](?:b|#)?\d)":\s*"(data:audio\/ogg;base64,[^"]+)"/g;
          const sampleData = {};
          let noteMatch;
          
          while ((noteMatch = noteRegex.exec(sfText)) !== null) {
            const noteName = noteMatch[1];
            const noteDataUri = noteMatch[2];
            
            // Normalize note name: convert 'b' flats to '#' sharps for MIDI lookup
            let midiNum = NOTE_TO_MIDI[noteName];
            if (midiNum === undefined) {
              // Try converting flats: Ab -> G#, Bb -> A#, Db -> C#, Eb -> D#, Gb -> F#
              const flatToSharp = { 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#' };
              const baseNote = noteName.slice(0, -1);
              const octave = noteName.slice(-1);
              const sharpName = flatToSharp[baseNote];
              if (sharpName) {
                midiNum = NOTE_TO_MIDI[sharpName + octave];
              }
            }
            if (midiNum === undefined) continue;

            try {
              const blobResp = await fetch(noteDataUri);
              const arrBuf = await blobResp.arrayBuffer();
              const audioBuf = await this.ctx.decodeAudioData(arrBuf);
              sampleData[midiNum] = audioBuf.getChannelData(0);
            } catch (decodeErr) {
              // Skip notes that fail to decode
              console.warn(`[AudioEngine] Failed to decode ${noteName}:`, decodeErr);
            }
          }

          if (this.nativeWorklet && Object.keys(sampleData).length > 0) {
            this.nativeWorklet.port.postMessage({
              type: 'SAMPLES',
              instrument,
              data: sampleData
            });
          }
          console.log(`[AudioEngine] Loaded ${instrument} (${Object.keys(sampleData).length} samples) → Worklet`);
        } catch (sfErr) {
          console.warn(`[AudioEngine] Soundfont fetch failed for ${instrument}, skipping:`, sfErr);
        }

        // Clean up the smplr instance we only used for reference
        if (typeof smplr.stop === 'function') smplr.stop();

      } else {
        // Standard Tone.js instruments (piano, guitar-acoustic, bass-electric)
        const sampleMap = this.getSampleMap(instrument);
        const baseUrl = `${BASE_URL}${instrument}/`;
        const sampleData = {};

        for (const [noteName, filename] of Object.entries(sampleMap)) {
          const midiNum = NOTE_TO_MIDI[noteName];
          if (midiNum === undefined) continue;

          try {
            const resp = await fetch(`${baseUrl}${filename}`);
            const arrBuf = await resp.arrayBuffer();
            const audioBuf = await this.ctx.decodeAudioData(arrBuf);
            sampleData[midiNum] = audioBuf.getChannelData(0);
          } catch (fetchErr) {
            console.warn(`[AudioEngine] Failed to fetch/decode ${noteName}:`, fetchErr);
          }
        }

        if (this.nativeWorklet && Object.keys(sampleData).length > 0) {
          this.nativeWorklet.port.postMessage({
            type: 'SAMPLES',
            instrument,
            data: sampleData
          });
        }
        console.log(`[AudioEngine] Loaded ${instrument} (${Object.keys(sampleData).length} samples) → Worklet`);
      }

      // Apply Gain Staging Map via the internalTrim node
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

      if (this.nativeWorklet) {
        this.nativeWorklet.port.postMessage({ type: 'SET_INSTRUMENT', instrument });
      }
    } catch (err) {
      console.error(`Failed to load ${instrument}:`, err);
    } finally {
      this.isInstrumentLoading = false;
    }
  }

<<<<<<< HEAD
  /**
   * Send ADSR parameters to the worklet
   */
=======
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
      this.sampler.triggerAttack(note, Tone.immediate(), velocity);
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
        this.sampler.triggerRelease(note, Tone.immediate());
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
      this.sampler.voicePool.forEach(voice => {
        if (voice.isActive && voice.currentNote) {
          this.sampler.triggerRelease(voice.currentNote);
        }
      });
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

>>>>>>> 01523582198bf0ef15b3a30740f21ac6d2863ee9
  setAttack(attack) {
    if (this.nativeWorklet) {
      this.nativeWorklet.port.postMessage({ type: 'ADSR', attack });
    }
  }

  setDecay(decay) {
    if (this.nativeWorklet) {
      this.nativeWorklet.port.postMessage({ type: 'ADSR', decay });
    }
  }

  setSustain(sustain) {
    if (this.nativeWorklet) {
      this.nativeWorklet.port.postMessage({ type: 'ADSR', sustain });
    }
  }

  setRelease(release) {
    if (this.nativeWorklet) {
      this.nativeWorklet.port.postMessage({ type: 'ADSR', release });
    }
  }

  releaseAll() {
    // The worklet handles voices autonomously; we can't easily "release all" via SAB
    // So we send a special message to the worklet
    if (this.nativeWorklet) {
      this.nativeWorklet.port.postMessage({ type: 'PANIC' });
    }
  }

  setVolume(db) {
    if (!this.volumeNode) return;
    // Convert Decibels to Linear Amplitude
    this.volumeNode.gain.value = db <= -60 ? 0 : Math.pow(10, db / 20);
  }

  setPan(pan) {
    if (this.panner) this.panner.pan.value = pan;
  }

  setReverbWet(wet) {
    // Reverb bypassed for latency. Do not execute routing changes here.
  }

  getMeterLevels() {
    if (!this.analyserL) return { l: -100, r: -100 };
    const dataL = new Float32Array(this.analyserL.fftSize);
    const dataR = new Float32Array(this.analyserR.fftSize);
    this.analyserL.getFloatTimeDomainData(dataL);
    this.analyserR.getFloatTimeDomainData(dataR);
    const rmsL = Math.sqrt(dataL.reduce((sum, val) => sum + val * val, 0) / dataL.length);
    const rmsR = Math.sqrt(dataR.reduce((sum, val) => sum + val * val, 0) / dataR.length);
    return {
      l: 20 * Math.log10(rmsL || 1e-5),
      r: 20 * Math.log10(rmsR || 1e-5)
    };
  }

  setTuningOffset(cents) {
    // Tuning offset is not applicable to the worklet DSP (it uses direct pitch math)
    // Could be implemented by adjusting playbackRate in the worklet, but left as no-op for now
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
