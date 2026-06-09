import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Info, Settings, AlertCircle, Power } from 'lucide-react';

interface TitleBarProps {
  bypass: boolean;
  setBypass: (v: boolean) => void;
  onPanic: () => void;
  midiInputs: any[];
  selectedInputId: string;
  setSelectedInputId: (id: string) => void;
  activeChannels: Set<number>;
  setActiveChannels: (fn: (prev: Set<number>) => Set<number> | Set<number>) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  bypass, setBypass, onPanic, midiInputs, selectedInputId, setSelectedInputId,
  activeChannels, setActiveChannels
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleChannel = (ch: number) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  return (
    <>
      <div className="w-full bg-[#1a1a1a] text-white flex items-center justify-between px-3 py-2 shrink-0 shadow-md">
        {/* Left */}
        <div className="font-bold tracking-widest text-[#cccccc] text-sm">
          VV | MIDI Tonnetz
        </div>

        {/* Center: MIDI IN Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">MIDI IN</label>
          <select 
            className="bg-[#2a2a2a] text-xs text-white border border-[#3a3a3a] rounded px-2 py-1 outline-none"
            value={selectedInputId}
            onChange={e => setSelectedInputId(e.target.value)}
          >
            <option value="">None</option>
            {midiInputs.map(input => (
              <option key={input.id} value={input.id}>
                {input.name || `Port ${input.id}`}
              </option>
            ))}
          </select>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setBypass(!bypass)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${bypass ? 'bg-transparent text-gray-500 hover:bg-white/10' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}
            title="Bypass"
          >
            <Power size={16} />
          </button>
          
          <button 
            onClick={onPanic}
            className="w-8 h-8 rounded flex items-center justify-center text-red-400 hover:bg-white/10 transition-colors"
            title="MIDI Panic"
          >
            <AlertCircle size={16} />
          </button>

          <button 
            onClick={() => setInfoOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            title="Info"
          >
            <Info size={16} />
          </button>

          <button 
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      <Modal isOpen={infoOpen} onClose={() => setInfoOpen(false)} title="About">
        <div className="space-y-4 text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-4xl text-blue-500 text-3xl">hub</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900">MIDI Tonnetz Explorer</h3>
          <p className="text-gray-500 text-sm">
            An interactive, variable-coordinate Tonnetz grid for exploring musical triads and harmony via MIDI input.
          </p>
          <div className="text-sm font-medium text-gray-700 py-2">
            by Craig Van Hise
          </div>
          <div className="space-y-2 text-sm">
            <a href="https://www.virtualvirgin.net/" target="_blank" rel="noreferrer" className="block text-blue-500 hover:underline">
              virtualvirgin.net
            </a>
            <a href="https://github.com/craig-van-hise" target="_blank" rel="noreferrer" className="block text-blue-500 hover:underline">
              github.com/craig-van-hise
            </a>
          </div>
        </div>
      </Modal>

      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">MIDI Channel Filter</h3>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({length: 16}, (_, i) => i + 1).map(ch => (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={`py-1 rounded text-xs font-medium transition-colors ${
                    activeChannels.has(ch) 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  Ch {ch}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setActiveChannels(new Set(Array.from({length: 16}, (_, i) => i + 1)))} className="text-xs text-blue-500 hover:underline">All</button>
              <button onClick={() => setActiveChannels(new Set())} className="text-xs text-blue-500 hover:underline">None</button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
