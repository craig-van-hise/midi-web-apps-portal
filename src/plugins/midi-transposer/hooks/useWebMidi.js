import { useEffect, useRef } from 'react';
import { useMidiStore } from '../store/useMidiStore';

export function useWebMidi({ midiBus, onMidiOut, isBypassed }) {
  const activeRoutedNotes = useRef(new Map());
  const activeTransposeKeys = useRef(new Set());
  const activePlayNote = useRef(null);

  const triggerVisualNoteFeedback = (note, isActive, color) => {
    const el = document.getElementById(`pk88f-${note}`);
    if (!el) return;
    
    const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
    if (isActive) {
      el.style.backgroundColor = color;
      el.style.boxShadow = `inset 0 0 10px rgba(255,255,255,0.4), 0 0 8px ${color}`;
    } else {
      el.style.backgroundColor = isBlack ? '#3a3a3a' : '#ffffff';
      el.style.boxShadow = 'none';
    }
  };

  const filterAndLimitNote = (transposedNote, state) => {
    const { filterRange, filterMode } = state;
    const [min, max] = filterRange;
    let finalNote = transposedNote;
    let shouldDrop = false;

    if (filterMode === 'block') {
      if (finalNote < min || finalNote > max) {
        shouldDrop = true;
      }
    } else if (filterMode === 'limit') {
      finalNote = Math.max(min, Math.min(max, finalNote));
    } else if (filterMode === 'octave_wrap') {
      if (finalNote < min || finalNote > max) {
        while (finalNote < min) finalNote += 12;
        while (finalNote > max) finalNote -= 12;
        if (finalNote < min || finalNote > max) {
          shouldDrop = true;
        }
      }
    } else if (filterMode === 'wrap') {
      const rangeSize = max - min + 1;
      let offset = (finalNote - min) % rangeSize;
      if (offset < 0) {
        offset += rangeSize;
      }
      finalNote = min + offset;
      if (finalNote < min || finalNote > max) {
        shouldDrop = true;
      }
    } else if (filterMode === 'smart_wrap') {
      if (finalNote < min || finalNote > max) {
        const pc = ((finalNote % 12) + 12) % 12;

        if (finalNote > max) {
          let wrapped = min - (min % 12) + pc;
          if (wrapped < min) wrapped += 12;

          if (wrapped <= max) {
            finalNote = wrapped;
          } else {
            shouldDrop = true;
          }
        } else if (finalNote < min) {
          let wrapped = max - (max % 12) + pc;
          if (wrapped > max) wrapped -= 12;

          if (wrapped >= min) {
            finalNote = wrapped;
          } else {
            shouldDrop = true;
          }
        }
      }
    }

    const outNote = Math.max(0, Math.min(127, finalNote));
    return { outNote, shouldDrop };
  };

  const calculateFinalNotes = (incomingNote, state) => {
    const { playOctave, transposeTargets, transposeTarget, transposeOrigin } = state;
    const effectiveNote = incomingNote + (playOctave * 12);
    
    const targets = transposeTargets && transposeTargets.includes(transposeTarget)
      ? transposeTargets
      : [transposeTarget];

    const deltas = targets.map(t => t - transposeOrigin);
    const outNotes = [];
    for (const d of deltas) {
      const { outNote, shouldDrop } = filterAndLimitNote(effectiveNote + d, state);
      if (!shouldDrop) {
        outNotes.push(outNote);
      }
    }
    return outNotes;
  };

  const { 
    setMidiInputs, 
    setMidiOutputs, 
    selectedInputId, 
    setSelectedInputId, 
    midiInputs,
    setMidiAccessStatus,
    setMidiErrorText 
  } = useMidiStore();

  // Listen for MIDI messages on the midiBus event target
  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiMessage = (event) => {
      const data = event.detail;
      if (!data || data.length < 3) return;

      const status = data[0];
      const statusType = status & 0xf0;
      const channel = status & 0x0f;

      // Only process Note On (0x90) and Note Off (0x80)
      if (statusType !== 0x90 && statusType !== 0x80) {
        // Forward non-note messages
        if (onMidiOut) {
          onMidiOut(data);
        }
        return;
      }

      const incomingNote = data[1];
      const velocity = data[2];
      const isNoteOn = statusType === 0x90 && velocity > 0;

      const state = useMidiStore.getState();

      // Zero-latency visual feedback for Input Keyboard
      const inputEl = document.getElementById(`pksplit-${incomingNote}`);
      const activeVisualZone = state.zones.find(z => incomingNote >= z.startNote && incomingNote <= z.endNote);
      if (inputEl) {
        const isBlack = [1, 3, 6, 8, 10].includes(incomingNote % 12);
        if (isNoteOn && activeVisualZone) {
          inputEl.style.backgroundColor = activeVisualZone.color;
          inputEl.style.boxShadow = `0 0 12px ${activeVisualZone.color}, inset 0 0 6px rgba(255,255,255,0.4)`;
        } else {
          const isAssigned = state.zones.some(z => incomingNote >= z.startNote && incomingNote <= z.endNote);
          if (isBlack) {
            inputEl.style.backgroundColor = isAssigned ? '#3a3a3a' : '#4a4a4a';
          } else {
            inputEl.style.backgroundColor = isAssigned ? '#ffffff' : '#8c8c8c';
          }
          inputEl.style.boxShadow = 'none';
        }
      }

      const {
        zones,
        transposeOctave,
        setTransposeTargets,
        transposeTargets,
        polyphonyMode,
      } = state;

      const activeZone = zones.find(z => incomingNote >= z.startNote && incomingNote <= z.endNote);
      if (!activeZone) {
        return; // Drop note if no active zone
      }

      if (activeZone.type === 'transpose') {
        // Transpose Zone (Left)
        const effectiveNote = incomingNote + (transposeOctave * 12);
        if (polyphonyMode === 'mono') {
          if (isNoteOn) {
            setTransposeTargets([effectiveNote]);
          }
        } else {
          if (isNoteOn) {
            const size = activeTransposeKeys.current.size;
            if (size === 0) {
              setTransposeTargets([effectiveNote]);
            } else {
              if (!transposeTargets.includes(effectiveNote)) {
                setTransposeTargets([...transposeTargets, effectiveNote]);
              }
            }
            activeTransposeKeys.current.add(incomingNote);
          } else {
            activeTransposeKeys.current.delete(incomingNote);
          }
        }
      } else if (activeZone.type === 'play') {
        const forceMono = polyphonyMode === 'poly' && transposeTargets.length > 1;

        if (!isNoteOn) {
          if (forceMono) {
            if (activePlayNote.current !== incomingNote) {
              return; // Return early and drop the Note Off message
            }
            activePlayNote.current = null;
          }

          // Note Off Handling
          const activeNote = activeRoutedNotes.current.get(incomingNote);
          if (activeNote) {
            const notesToTurnOff = activeNote.outNotes || [activeNote.outNote];
            notesToTurnOff.forEach(outNote => {
              triggerVisualNoteFeedback(outNote, false, activeZone.color);
            });

            notesToTurnOff.forEach(outNote => {
              const outMsg = [0x80 | activeNote.channel, outNote, velocity];
              if (onMidiOut) {
                onMidiOut(outMsg);
              }
            });
            activeRoutedNotes.current.delete(incomingNote);
          }
          return;
        }

        // Note On Handling
        if (forceMono) {
          if (activePlayNote.current !== null && activePlayNote.current !== incomingNote) {
            const prevNoteData = activeRoutedNotes.current.get(activePlayNote.current);
            if (prevNoteData) {
              const notesToTurnOff = prevNoteData.outNotes || [prevNoteData.outNote];
              notesToTurnOff.forEach(outNote => {
                triggerVisualNoteFeedback(outNote, false, activeZone.color);
              });
              notesToTurnOff.forEach(outNote => {
                const outMsg = [0x80 | prevNoteData.channel, outNote, 0];
                if (onMidiOut) {
                  onMidiOut(outMsg);
                }
              });
              activeRoutedNotes.current.delete(activePlayNote.current);
            }
          }
          activePlayNote.current = incomingNote;
        }

        const outNotes = calculateFinalNotes(incomingNote, state);

        if (outNotes.length > 0) {
          outNotes.forEach(outNote => {
            triggerVisualNoteFeedback(outNote, true, activeZone.color);
          });

          const outputStatus = 0x90 | channel;
          outNotes.forEach(outNote => {
            const outMsg = [outputStatus, outNote, velocity];
            if (onMidiOut) {
              onMidiOut(outMsg);
            }
          });

          activeRoutedNotes.current.set(incomingNote, { 
            outNote: outNotes[0], 
            outNotes, 
            channel, 
            velocity 
          });
        }
      }
    };

    midiBus.addEventListener('midi', handleMidiMessage);

    return () => {
      midiBus.removeEventListener('midi', handleMidiMessage);
    };
  }, [midiBus, onMidiOut, isBypassed]);

  // Handle active note cutoff/retrigger when transposeTarget or transposeTargets changes
  useEffect(() => {
    const arraysEqual = (a, b) => {
      if (a === b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    const unsub = useMidiStore.subscribe((state, prevState) => {
      const targetsChanged = !arraysEqual(state.transposeTargets, prevState.transposeTargets);
      if (!targetsChanged && state.transposeTarget === prevState.transposeTarget) return;
      if (state.transposeSustainMode === 'sustain') return;

      activeRoutedNotes.current.forEach((activeData, incomingNote) => {
        const notesToTurnOff = activeData.outNotes || [activeData.outNote];
        notesToTurnOff.forEach(outNote => {
          if (onMidiOut) {
            onMidiOut([0x80 | activeData.channel, outNote, 0]);
          }
          triggerVisualNoteFeedback(outNote, false, '#3b82f6');
        });

        if (state.transposeSustainMode === 'cutoff') {
          activeRoutedNotes.current.delete(incomingNote);
        } 
        else if (state.transposeSustainMode === 'retrigger') {
          const newOutNotes = calculateFinalNotes(incomingNote, state);
          if (newOutNotes.length > 0) {
            const activeZone = state.zones.find(z => incomingNote >= z.startNote && incomingNote <= z.endNote);
            const color = activeZone ? activeZone.color : '#3b82f6';
            newOutNotes.forEach(outNote => {
              if (onMidiOut) {
                onMidiOut([0x90 | activeData.channel, outNote, activeData.velocity]);
              }
              triggerVisualNoteFeedback(outNote, true, color);
            });
            activeRoutedNotes.current.set(incomingNote, { 
              ...activeData, 
              outNote: newOutNotes[0], 
              outNotes: newOutNotes 
            });
          } else {
            activeRoutedNotes.current.delete(incomingNote);
          }
        }
      });
    });
    return unsub;
  }, [onMidiOut]);

  return { activeRoutedNotes };
}
