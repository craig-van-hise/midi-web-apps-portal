import React, { useEffect, useRef, useState } from 'react';
import { MIDIProvider, useMidi } from './midi/MIDIProvider';
import Keyboard, { updateKeyVisuals88 } from './components/Keyboard';
import NotationCanvas from './components/NotationCanvas';
import SettingsModal from './components/SettingsModal';
import InfoModal from './components/InfoModal';
import { TransformationsDrawer } from './components/toolbar/TransformationsDrawer';
import { setMidiOutCallback } from './audio/engine';

// Component to handle MIDI message listening and keyboard updates
const MidiKeyboardUpdater = () => {
  const displayedNotes = useRef(new Set());

  useEffect(() => {
    const handleMidiMessage = (event) => {
      const customEvent = event;
      const { data, panic } = customEvent.detail || {};

      if (panic) {
        displayedNotes.current.forEach(note => updateKeyVisuals88(note, ''));
        displayedNotes.current.clear();
        return;
      }
      
      if (!data) return;

      const [status, note, velocity] = data;
      const NOTE_ON_COMMAND = 0x90;
      const NOTE_OFF_COMMAND = 0x80;

      const isNoteOn = (status & 0xF0) === NOTE_ON_COMMAND && velocity > 0;
      const isNoteOff = (status & 0xF0) === NOTE_OFF_COMMAND || ((status & 0xF0) === NOTE_ON_COMMAND && velocity === 0);

      if (isNoteOn) {
        if (!displayedNotes.current.has(note)) {
          displayedNotes.current.add(note);
          updateKeyVisuals88(note, '#aa3bff');
        }
      } else if (isNoteOff) {
        displayedNotes.current.delete(note);
        updateKeyVisuals88(note, '');
      }
    };

    window.addEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
    return () => {
      window.removeEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
    };
  }, []); 

  return null;
};

const ChordNotatorContent = ({
  midiBus,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}) => {
  const { dispatchVirtualMidi, dispatchPhysicalMidi, handleMidiPanic } = useMidi();
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync prop changes to local modal visibility state
  useEffect(() => {
    setInfoOpen(showInfo);
  }, [showInfo]);

  useEffect(() => {
    setSettingsOpen(showSettings);
  }, [showSettings]);

  // Listen to incoming MIDI bus
  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiEvent = (e) => {
      const data = e.detail;
      dispatchPhysicalMidi(new Uint8Array(data));
    };

    midiBus.addEventListener('midi', handleMidiEvent);
    return () => midiBus.removeEventListener('midi', handleMidiEvent);
  }, [midiBus, isBypassed, dispatchPhysicalMidi]);

  // Listen to panic trigger prop
  const initialPanicRef = useRef(true);
  useEffect(() => {
    if (initialPanicRef.current) {
      initialPanicRef.current = false;
      return;
    }
    handleMidiPanic();
  }, [triggerPanic, handleMidiPanic]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f8f7f2] dark:bg-[#0a0a0a]">
      {/* Focused Notation Workspace & Keyboard */}
      <main className="flex-1 overflow-y-auto pb-[400px] w-full flex flex-col items-center justify-start gap-[15px] pt-8">
        <div className="w-full max-w-[962px] flex justify-center leading-none" style={{ lineHeight: "1" }}>
          <NotationCanvas />
        </div>
        
        {/* The strict anchor wrapper */}
        <div className="relative isolate flex flex-col items-center w-full max-w-max mx-auto">
          {/* The Ceiling (Keyboard Card) - z-20 forces it above the drawer */}
          <div className="relative z-20 bg-white dark:bg-[#111] p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 w-full">
            <Keyboard />
          </div>
          
          {/* The Drawer - absolute top-full anchors it to the bottom of the wrapper */}
          {/* z-10 forces it below the ceiling. */}
          <div className="absolute left-0 right-0 top-full z-10 flex justify-center">
            <TransformationsDrawer />
          </div>
        </div>
      </main>

      {/* Hoisted Modals */}
      <InfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default function ChordNotator({
  midiBus,
  onMidiOut,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}) {
  // Bind onMidiOut prop to the AudioEngine mutable callback
  useEffect(() => {
    setMidiOutCallback(onMidiOut);
    return () => {
      setMidiOutCallback(null);
    };
  }, [onMidiOut]);

  return (
    <MIDIProvider>
      <MidiKeyboardUpdater />
      <ChordNotatorContent 
        midiBus={midiBus}
        isBypassed={isBypassed}
        showInfo={showInfo}
        showSettings={showSettings}
        triggerPanic={triggerPanic}
      />
    </MIDIProvider>
  );
}
