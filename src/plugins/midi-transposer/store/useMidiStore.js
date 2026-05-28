import { create } from 'zustand';

export const useMidiStore = create((set, get) => ({
  bypass: false,
  activeChannels: Array.from({ length: 16 }, (_, i) => i + 1), // Default channels 1-16
  zones: [
    { id: 'z-trans', type: 'transpose', startNote: 21, endNote: 59, color: '#f43f5e', octave: 0 },
    { id: 'z-play', type: 'play', startNote: 60, endNote: 108, color: '#3b82f6', octave: 0 },
  ],
  transposeAmount: 0,
  filterMode: 'block',
  filterRange: [21, 108],
  midiInputs: [],
  midiOutputs: [],
  selectedInputId: null,
  transposeOctave: 0,
  playOctave: 0,
  transposeOrigin: 60,
  transposeTarget: 60,
  transposeTargets: [60],
  polyphonyMode: 'mono',
  midiAccessStatus: 'pending',
  midiErrorText: null,
  transposeSustainMode: 'sustain',

  toggleBypass: () => set((state) => ({ bypass: !state.bypass })),
  setActiveChannels: (activeChannels) => set({ activeChannels }),
  setZones: (zones) => set({ zones }),
  setTransposeAmount: (transposeAmount) => set({ transposeAmount }),
  setFilterMode: (filterMode) => set({ filterMode }),
  setFilterRange: (filterRange) => set({ filterRange }),
  setMidiInputs: (midiInputs) => set({ midiInputs }),
  setMidiOutputs: (midiOutputs) => set({ midiOutputs }),
  setSelectedInputId: (selectedInputId) => set({ selectedInputId }),
  setTransposeOctave: (transposeOctave) => set({ transposeOctave }),
  setPlayOctave: (playOctave) => set({ playOctave }),
  setTransposeOrigin: (transposeOrigin) => set({ transposeOrigin }),
  setTransposeTarget: (transposeTarget) => set({ 
    transposeTarget,
    transposeTargets: [transposeTarget]
  }),
  setTransposeTargets: (transposeTargets) => set({
    transposeTargets,
    transposeTarget: transposeTargets[0] ?? 60
  }),
  setPolyphonyMode: (polyphonyMode) => set({ polyphonyMode }),
  setMidiAccessStatus: (status) => set({ midiAccessStatus: status }),
  setMidiErrorText: (text) => set({ midiErrorText: text }),
  setTransposeSustainMode: (transposeSustainMode) => set({ transposeSustainMode }),

  panic: () => {
    const outputs = get().midiOutputs;
    outputs.forEach((output) => {
      try {
        for (let ch = 0; ch < 16; ch++) {
          output.send(new Uint8Array([0xB0 + ch, 123, 0]));
          output.send(new Uint8Array([0xB0 + ch, 120, 0]));
        }
      } catch (err) {
        console.error('Failed to send panic messages:', err);
      }
    });
  },
}));
