import React from 'react';
import { useMidi } from '../midi/MIDIProvider';

const getNoteName = (midi: number): string => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = names[midi % 12];
  return `${name}${octave}`;
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { splitPoint, setSplitPoint, isToggleModeActive, setIsToggleModeActive, isHoldModeActive, setIsHoldModeActive, clearAllMidiMappings, uiVelocity, setUiVelocity } = useMidi();

  if (!isOpen) return null;

  // Generate options from MIDI 48 (C3) to 72 (C5)
  const options = Array.from({ length: 72 - 48 + 1 }, (_, i) => 48 + i);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      
      <div
        className="relative z-[100] bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold opacity-50 mb-2 dark:text-white">
              Split Point (Treble / Bass)
            </label>
            <select
              value={splitPoint}
              onChange={(e) => setSplitPoint(parseInt(e.target.value, 10))}
              className="w-full text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#aa3bff] dark:text-white"
            >
              {options.map((midi) => (
                <option key={midi} value={midi}>
                  {getNoteName(midi)} (MIDI {midi})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Notes at or above this pitch will be shown on the Treble staff.
            </p>
          </div>

          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs uppercase tracking-wider font-bold opacity-50 dark:text-white">
                  VELOCITY
                </label>
                <span className="text-xs font-mono font-bold text-[#aa3bff]">{uiVelocity}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="127" 
                value={uiVelocity}
                onChange={(e) => setUiVelocity(parseInt(e.target.value, 10))}
                className="w-full accent-[#aa3bff]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider font-bold opacity-50 dark:text-white">
                Toggle Mode
              </label>
              <input 
                type="checkbox" 
                checked={isToggleModeActive}
                onChange={(e) => setIsToggleModeActive(e.target.checked)}
                className="w-5 h-5 accent-[#aa3bff]"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider font-bold opacity-50 dark:text-white">
                Hold Mode
              </label>
              <input 
                type="checkbox" 
                checked={isHoldModeActive}
                onChange={(e) => setIsHoldModeActive(e.target.checked)}
                className="w-5 h-5 accent-[#aa3bff]"
              />
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { clearAllMidiMappings(); onClose(); }}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-red-600/20 text-xs uppercase tracking-wider"
              >
                Clear All MIDI Mappings
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#aa3bff] hover:bg-[#9226e6] text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-[#aa3bff]/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

