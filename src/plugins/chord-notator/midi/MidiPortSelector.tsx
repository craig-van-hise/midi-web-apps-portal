// src/midi/MidiPortSelector.tsx

import React from 'react';
import { useMidi } from './MIDIProvider';

const MidiPortSelector: React.FC = () => {
  const {
    midiAccess,
    selectedInputId,
    loading,
    error,
    setInputPort,
  } = useMidi();
  const selectInputRef = React.useRef<HTMLSelectElement>(null);

  if (loading) {
    return <div>Initializing MIDI...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!midiAccess) {
    return <div>No MIDI access available.</div>;
  }

  const inputPorts = Array.from(midiAccess.inputs.entries());

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setInputPort(val);
  };


  // Use the port ID for the value, or a distinct value for null/no selection.
  const selectInputVal = selectedInputId;

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <label htmlFor="midi-input-select" className="text-gray-400 font-medium">In:</label>
        <select
          id="midi-input-select"
          ref={selectInputRef}
          value={selectInputVal}
          onChange={handleInputChange}
          disabled={inputPorts.length === 0}
          className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#aa3bff]/30 focus:border-[#aa3bff] transition-all cursor-pointer disabled:opacity-50"
        >
          {inputPorts.length === 0 ? (
            <option value="">No input</option>
          ) : (
            <>
              <option value="omni">OMNI (All Ports)</option>
              <option value="">No input</option>
              {inputPorts.map(([id, port]) => (
                <option 
                  key={id} 
                  value={id}
                >
                  {port.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>


    </div>
  );
};

export default MidiPortSelector;
