import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { fetchBinaryLUT } from '../utils/binaryLut';
import type { PCS_Entry } from '../utils/chordSpeller';
import { audioEngine } from '../audio/engine';
import type { ButtonId, ButtonConfig, ButtonConfigMap, LearnState } from '../components/toolbar/TransformationsTypes';
import { usePersistentState } from '../lib/usePersistentState';
import { transposeDiatonically, enforcePianoRange } from '../utils/notationMath';

interface MidiContextType {
  midiAccess: MIDIAccess | null;
  selectedInputId: string;
  selectedOutputId: string;
  keySignature: string; // e.g., "C Major", "Gb Major"
  loading: boolean;
  error: string | null;
  setInputPort: (portId: string) => void;
  setOutputPort: (portId: string) => void;
  setKeySignature: (name: string) => void;
  splitPoint: number;
  setSplitPoint: (note: number) => void;
  handleMidiPanic: () => void;
  isSustainActive: boolean;
  isToggleModeActive: boolean;
  setIsToggleModeActive: (b: boolean) => void;
  isHoldModeActive: boolean;
  setIsHoldModeActive: (b: boolean) => void;
  dispatchVirtualMidi: (data: Uint8Array) => void;
  dispatchPhysicalMidi: (data: Uint8Array) => void;
  updateActiveNotes: (notes: any[]) => void;
  lut: (PCS_Entry | null)[];
  selectedNotes: number[];
  setSelectedNotes: (notes: number[]) => void;

  // New fields for Phase 1, Phase 2, Phase 3
  listenMode: boolean;
  setListenMode: (b: boolean | ((val: boolean) => boolean)) => void;
  configs: ButtonConfigMap;
  setConfigs: (configs: ButtonConfigMap | ((prev: ButtonConfigMap) => ButtonConfigMap)) => void;
  updateButtonConfig: (id: ButtonId, updates: Partial<ButtonConfig>) => void;
  clearAllMidiMappings: () => void;
  clearMidiMapping: (id: ButtonId) => void;
  learnState: LearnState;
  startLearnMode: (targetId?: ButtonId) => void;
  stopLearnMode: () => void;
  activeTransformationNotes: Map<number, number[]>;
  uiVelocity: number;
  setUiVelocity: (val: number | ((prev: number) => number)) => void;
  homeChord: number[];
  setHomeChord: (val: number[] | ((prev: number[]) => number[])) => void;
}

const MidiContext = createContext<MidiContextType | undefined>(undefined);

const DEFAULT_CONFIG: ButtonConfig = {
  stepSize: 1,
  midiChannel: 1,
  midiNote: -1,
};

const INITIAL_BUTTONS: ButtonId[] = [
  'SEMI_DOWN', 'SEMI_UP', 'KEY_DOWN', 'KEY_UP', 
  'ROT_DOWN', 'ROT_UP', 'OCT_DOWN', 'OCT_UP', 
  'PLAY', 'HOME'
];

const INITIAL_CONFIGS: ButtonConfigMap = (() => {
  const map: any = {};
  INITIAL_BUTTONS.forEach(id => map[id] = { ...DEFAULT_CONFIG, midiNote: -1 });
  return map;
})();

function getTransformedPitches(
  type: ButtonId,
  stepSize: number,
  activeNotes: any[],
  selectedNotes: number[],
  keySignature: string,
  lut?: any[]
): number[] {
  const targets = selectedNotes.length > 0 ? selectedNotes : activeNotes.map(n => n.note);
  if (targets.length === 0) return [];

  let proposed: number[] = [];
  switch (type) {
    case 'SEMI_UP':
      proposed = targets.map(p => p + stepSize);
      break;
    case 'SEMI_DOWN':
      proposed = targets.map(p => p - stepSize);
      break;
    case 'OCT_UP':
      proposed = targets.map(p => p + 12 * stepSize);
      break;
    case 'OCT_DOWN':
      proposed = targets.map(p => p - 12 * stepSize);
      break;
    case 'KEY_UP':
      proposed = targets.map(p => {
        return transposeDiatonically(p, stepSize, keySignature, lut);
      });
      break;
    case 'KEY_DOWN':
      proposed = targets.map(p => {
        return transposeDiatonically(p, -stepSize, keySignature, lut);
      });
      break;
    case 'ROT_UP':
    case 'ROT_DOWN': {
      const delta = type === 'ROT_UP' ? stepSize : -stepSize;
      const sortedEntries = targets.filter(p => p !== 0).sort((a, b) => a - b);
      const pcs = Array.from(new Set(sortedEntries.map(p => p % 12))).sort((a, b) => a - b);
      if (pcs.length === 0) return targets;

      proposed = targets.map(note => {
        const currentPC = note % 12;
        const currentPcsIndex = pcs.indexOf(currentPC);
        const nextPcsIndex = (currentPcsIndex + delta + (pcs.length * Math.abs(delta))) % pcs.length;
        const targetPC = pcs[nextPcsIndex];

        let newNote = note;
        if (delta > 0) {
          newNote++;
          while (newNote % 12 !== targetPC) { newNote++; }
        } else if (delta < 0) {
          newNote--;
          while (newNote % 12 !== targetPC) { newNote--; }
        }
        return newNote;
      });
      break;
    }
    default:
      proposed = targets;
      break;
  }

  return enforcePianoRange(proposed, targets);
}

export const MIDIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [selectedInputId, setSelectedInputId] = useState<string>(localStorage.getItem('midi_input_id') || "omni");
  const [selectedOutputId, setSelectedOutputId] = useState<string>("omni");
  const [keySignature, setKeySignature] = useState<string>("C Major"); 
  const [splitPoint, setSplitPoint] = useState<number>(60); // Default: Middle C (60)
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSustainActive, setIsSustainActive] = useState<boolean>(false);
  const [isToggleModeActive, setIsToggleModeActive] = useState<boolean>(true);
  const [isHoldModeActive, setIsHoldModeActive] = useState<boolean>(true);
  const [lut, setLut] = useState<(PCS_Entry | null)[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);

  const [listenMode, setListenMode] = usePersistentState<boolean>('midi_listen_mode', true);
  const [configs, setConfigs] = usePersistentState<ButtonConfigMap>('midiToolbarConfigs', INITIAL_CONFIGS);
  const [uiVelocity, setUiVelocity] = usePersistentState<number>('midi_ui_velocity', 80);
  const [homeChord, setHomeChord] = usePersistentState<number[]>('midi_home_chord', [60]);
  const [learnState, setLearnState] = useState<LearnState>({
    isActive: false,
    currentButtonIndex: 0,
    sequence: [],
  });

  const pendingNoteOffs = React.useRef<Set<number>>(new Set());
  const activeTransformationNotesRef = React.useRef<Map<number, number[]>>(new Map());
  const activeNotesRef = React.useRef<any[]>([]);
  const selectedNotesRef = React.useRef<number[]>([]);
  const keySignatureRef = React.useRef<string>(keySignature);
  const lutRef = React.useRef<any[]>(lut);
  const listenModeRef = React.useRef<boolean>(listenMode);
  const configsRef = React.useRef<ButtonConfigMap>(configs);
  const learnStateRef = React.useRef<LearnState>(learnState);

  useEffect(() => { keySignatureRef.current = keySignature; }, [keySignature]);
  useEffect(() => { lutRef.current = lut; }, [lut]);
  useEffect(() => { listenModeRef.current = listenMode; }, [listenMode]);
  useEffect(() => { configsRef.current = configs; }, [configs]);
  useEffect(() => { learnStateRef.current = learnState; }, [learnState]);
  useEffect(() => { selectedNotesRef.current = selectedNotes; }, [selectedNotes]);

  const updateButtonConfig = useCallback((id: ButtonId, updates: Partial<ButtonConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...(prev[id] || DEFAULT_CONFIG), ...updates }
    }));
  }, [setConfigs]);

  const clearAllMidiMappings = useCallback(() => {
    setConfigs(prev => {
      const map: any = {};
      Object.keys(prev).forEach(id => {
        map[id] = { ...(prev[id as ButtonId] || DEFAULT_CONFIG), midiNote: -1 };
      });
      return map;
    });
  }, [setConfigs]);

  const clearMidiMapping = useCallback((id: ButtonId) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...(prev[id] || DEFAULT_CONFIG), midiNote: -1 }
    }));
  }, [setConfigs]);

  const startLearnMode = useCallback((targetId?: ButtonId) => {
    const sequence: ButtonId[] = targetId ? [targetId] : [...INITIAL_BUTTONS];
    setLearnState({
      isActive: true,
      currentButtonIndex: 0,
      sequence
    });
    console.log("[Learn Mode] Started. Waiting for input for:", sequence[0]);
  }, []);

  const stopLearnMode = useCallback(() => {
    setLearnState(prev => ({ ...prev, isActive: false }));
    console.log("[Learn Mode] Cancelled/Finished.");
  }, []);

  useEffect(() => {
    (window as any).__MIDI_INTERCEPTOR = (data: Uint8Array) => {
      if (!data || data.length < 3) return false;
      const [status, note, velocity] = data;
      const isNoteOn = (status & 0xF0) === 0x90 && velocity > 0;
      const isNoteOff = (status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && velocity === 0);

      // 1. LEARN MODE ACTIVE
      if (learnStateRef.current.isActive) {
        if (isNoteOn) {
          const currentId = learnStateRef.current.sequence[learnStateRef.current.currentButtonIndex];
          if (currentId) {
            updateButtonConfig(currentId, { midiNote: note, midiChannel: (status & 0x0F) + 1 });
            if (learnStateRef.current.currentButtonIndex >= learnStateRef.current.sequence.length - 1) {
              setLearnState(prev => ({ ...prev, isActive: false }));
            } else {
              setLearnState(prev => ({ ...prev, currentButtonIndex: prev.currentButtonIndex + 1 }));
            }
          }
        }
        return true; // Unconditionally block both ON and OFF during learn
      }

      // 2. PLAY MODE (Action Mapping & Playable Transformations)
      const configs = configsRef.current;
      const match = Object.keys(configs).find(id => configs[id as ButtonId]?.midiNote === note && note !== -1);

      if (match) {
        const buttonId = match as ButtonId;
        const config = configs[buttonId];
        const stepSize = config?.stepSize || 1;

        if (isNoteOn) {
          window.dispatchEvent(new CustomEvent('APP_BUTTON_PRESS_ON', { detail: { buttonId } }));
          // History Actions
          if (['UNDO', 'REDO'].includes(buttonId)) {
            window.dispatchEvent(new CustomEvent('APP_HISTORY', { detail: { action: buttonId } }));
          }
          // Home Action
          else if (buttonId === 'HOME') {
            window.dispatchEvent(new CustomEvent('APP_HOME_ON', { detail: { velocity } }));
          }
          // Play Action
          else if (buttonId === 'PLAY') {
            window.dispatchEvent(new CustomEvent('APP_PLAY_ON', { detail: { velocity } }));
          }
          // Transform Actions (Playable Transformations)
          else {
            const transformedChord = getTransformedPitches(
              buttonId, 
              stepSize, 
              activeNotesRef.current, 
              selectedNotesRef.current, 
              keySignatureRef.current,
              lutRef.current
            );
            const safeNotes = transformedChord;
            
            const normalizedVelocity = velocity / 127;
            activeTransformationNotesRef.current.set(note, safeNotes);

            if (listenModeRef.current) {
              audioEngine.triggerAttack(safeNotes, normalizedVelocity);
            }

            window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
              detail: { type: buttonId, stepSize, isUiClick: false }
            }));
          }
        } else if (isNoteOff) {
          window.dispatchEvent(new CustomEvent('APP_BUTTON_PRESS_OFF', { detail: { buttonId } }));
          if (buttonId === 'PLAY') {
            window.dispatchEvent(new CustomEvent('APP_PLAY_OFF'));
          } else if (buttonId === 'HOME') {
            window.dispatchEvent(new CustomEvent('APP_HOME_OFF'));
          } else {
            const transformedNotes = activeTransformationNotesRef.current.get(note);
            if (transformedNotes) {
              if (listenModeRef.current) {
                audioEngine.triggerRelease(transformedNotes);
              }
              activeTransformationNotesRef.current.delete(note);
            }
          }
        }
        return true;
      }
      return false;
    };

    return () => { (window as any).__MIDI_INTERCEPTOR = undefined; };
  }, [updateButtonConfig]);

  const dispatchMidiEvent = useCallback((data: Uint8Array, isVirtual: boolean = false) => {
    const customEvent = new CustomEvent('MIDI_MESSAGE_RECEIVED', { 
      detail: { data, timestamp: performance.now(), isVirtual } 
    });
    window.dispatchEvent(customEvent);
  }, []);

  const handleIncomingMidi = useCallback((data: Uint8Array, isVirtual: boolean = false) => {
    // Global Interceptor: Only intercept PHYSICAL hardware events
    if (!isVirtual && typeof (window as any).__MIDI_INTERCEPTOR === 'function') {
      if ((window as any).__MIDI_INTERCEPTOR(data)) return; // Silently consume the note
    }

    const [status, note, velocity] = data;
    const command = status & 0xF0;
    const channel = status & 0x0F;

    // CC 64 Sustain Pedal
    if (command === 0xB0 && note === 64) {
      const active = velocity >= 64;
      setIsSustainActive(active);
      if (!active) {
        // Sustain turned OFF: Dispatch all pending note offs
        pendingNoteOffs.current.forEach(noteNum => {
          dispatchMidiEvent(new Uint8Array([0x80 + channel, noteNum, 0]), isVirtual);
        });
        pendingNoteOffs.current.clear();
      }
      // Still dispatch the CC message for others to hear
      dispatchMidiEvent(data, isVirtual);
      return;
    }

    // Note On
    if (command === 0x90 && velocity > 0) {
      pendingNoteOffs.current.delete(note);
      dispatchMidiEvent(data, isVirtual);
      return;
    }

    // Note Off
    if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      if (isSustainActive) {
        pendingNoteOffs.current.add(note);
      } else {
        dispatchMidiEvent(data, isVirtual);
      }
      return;
    }

    // Default: Dispatch other messages
    dispatchMidiEvent(data, isVirtual);
  }, [isSustainActive, isHoldModeActive, dispatchMidiEvent]);

  const dispatchVirtualMidi = useCallback((data: Uint8Array) => {
    handleIncomingMidi(data, true);
  }, [handleIncomingMidi]);

  const dispatchPhysicalMidi = useCallback((data: Uint8Array) => {
    handleIncomingMidi(data, false);
  }, [handleIncomingMidi]);

  const handleMidiPanic = useCallback(() => {
    // Reset sustain state
    setIsSustainActive(false);
    setIsToggleModeActive(true);
    setIsHoldModeActive(true);
    pendingNoteOffs.current.clear();

    // ROMPler Integration
    audioEngine.releaseAll();

    // Dispatch proprietary PANIC flag
    const panicEvent = new CustomEvent('MIDI_MESSAGE_RECEIVED', {
      detail: { 
        data: new Uint8Array([0, 0, 0]), 
        timestamp: performance.now(), 
        panic: true 
      }
    });
    window.dispatchEvent(panicEvent);
  }, []);

  const handleMidiMessage = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const { data, refresh, notes, isVirtual } = customEvent.detail || {};

    if (refresh && notes) {
      activeNotesRef.current = notes;
      return;
    }

    if (!isVirtual && data && data instanceof Uint8Array) {
      if (typeof (window as any).__MIDI_INTERCEPTOR === 'function') {
        (window as any).__MIDI_INTERCEPTOR(data);
      }
    }
  }, []);

  const midiAccessRef = React.useRef<MIDIAccess | null>(null);

  useEffect(() => {
    midiAccessRef.current = midiAccess;
  }, [midiAccess]);

  useEffect(() => {
    if (!midiAccess) return;

    const inputsToListen = selectedInputId === 'omni'
      ? Array.from(midiAccess.inputs.values())
      : [midiAccess.inputs.get(selectedInputId)].filter(Boolean) as MIDIInput[];

    inputsToListen.forEach(input => {
      input.onmidimessage = (event: MIDIMessageEvent) => {
        if (event.data) handleIncomingMidi(event.data as Uint8Array, false);
      };
    });

    return () => {
      inputsToListen.forEach(input => {
        input.onmidimessage = null;
      });
    };
  }, [midiAccess, selectedInputId, handleIncomingMidi]);

  useEffect(() => {
    let isMounted = true;

    const initializeMidi = async () => {
      setLoading(true);
      setError(null);
      setMidiAccess(null);

      // Load LUT
      try {
        const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
        const data = await fetchBinaryLUT(`${baseUrl}/PCS_LUT.dat`);
        setLut(data);
      } catch (e) {
        console.error('Failed to load Binary LUT data in MIDIProvider:', e);
      }

      setLoading(false);
    };

    initializeMidi();
    
    window.addEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);

    return () => {
      isMounted = false;
      const access = midiAccessRef.current;
      if (access) {
        access.inputs.forEach(input => {
          input.close().catch(err => console.error('Error closing MIDI input:', err));
          input.onmidimessage = null;
        });
        if (access.outputs) {
          access.outputs.forEach(output => {
            output.close().catch(err => console.error('Error closing MIDI output:', err));
          });
        }
      }
      window.removeEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
    };
  }, [handleMidiMessage, handleIncomingMidi]);

  const setInputPort = (portId: string) => {
    if (portId !== 'omni' && portId !== '' && midiAccess && !midiAccess.inputs.has(portId)) {
      console.warn(`Input port with ID "${portId}" not found.`);
      return;
    }
    setSelectedInputId(portId);
    if (portId === 'omni' || portId === '') {
      localStorage.removeItem('midi_input_id');
    } else {
      localStorage.setItem('midi_input_id', portId);
    }
  };

  const setOutputPort = (portId: string) => {
    setSelectedOutputId(portId);
  };

  const updateActiveNotes = useCallback((notes: any[]) => {
    const refreshEvent = new CustomEvent('MIDI_MESSAGE_RECEIVED', {
      detail: { 
        refresh: true,
        notes 
      }
    });
    window.dispatchEvent(refreshEvent);
  }, []);

  return (
    <MidiContext.Provider
      value={{
        midiAccess,
        selectedInputId,
        selectedOutputId,
        keySignature,
        loading,
        error,
        setInputPort,
        setOutputPort,
        setKeySignature,
        splitPoint,
        setSplitPoint,
        handleMidiPanic,
        isSustainActive,
        isToggleModeActive,
        setIsToggleModeActive,
        isHoldModeActive,
        setIsHoldModeActive,
        dispatchVirtualMidi,
        dispatchPhysicalMidi,
        updateActiveNotes,
        lut,
        selectedNotes,
        setSelectedNotes,
        listenMode,
        setListenMode,
        configs,
        setConfigs,
        updateButtonConfig,
        clearAllMidiMappings,
        clearMidiMapping,
        learnState,
        startLearnMode,
        stopLearnMode,
        activeTransformationNotes: activeTransformationNotesRef.current,
        uiVelocity,
        setUiVelocity,
        homeChord,
        setHomeChord,
      }}
    >
      {children}
    </MidiContext.Provider>
  );
};

export const useMidi = (): MidiContextType => {
  const context = useContext(MidiContext);
  if (context === undefined) {
    throw new Error('useMidi must be used within a MIDIProvider');
  }
  return context;
};