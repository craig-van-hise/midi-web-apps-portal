import React from 'react';
import type { ButtonConfig, ButtonId } from './TransformationsTypes';
import { GraduationCap, Volume2, Trash2 } from 'lucide-react';
import { useMidi } from '../../midi/MIDIProvider';


// --- Arrow Button Context Menu ---

interface ArrowMenuProps {
  buttonId: ButtonId;
  config: ButtonConfig;
  onUpdateConfig: (id: ButtonId, updates: Partial<ButtonConfig>) => void;
  position: { x: number; y: number };
  onClose: () => void;
}

export const ArrowContextMenu: React.FC<ArrowMenuProps> = ({ 
  buttonId, 
  config, 
  onUpdateConfig, 
  position,
  onClose 
}) => {
  const isActionBtn = buttonId === 'PLAY' || buttonId === 'HOME';
  const { clearMidiMapping, startLearnMode } = useMidi();

  return (
    <div 
      className="fixed z-50 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-0 w-64 text-sm font-mono"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center p-3 border-b-2 border-black bg-black text-white">
        <span className="font-bold uppercase tracking-wider">{buttonId} CONFIG</span>
        <button onClick={onClose} className="hover:text-green-400 font-bold px-1">✕</button>
      </div>

      <div className="p-4 space-y-5">
        {/* Step Size Slider - Only show for directional buttons */}
        {!isActionBtn && (
          <div>
            <div className="flex justify-between mb-2 items-center">
              <label className="font-bold uppercase text-xs">Step Size</label>
              <span className="bg-black text-white px-2 py-0.5 text-xs font-bold">{config.stepSize}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="12" 
              step="1"
              value={config.stepSize}
              onChange={(e) => onUpdateConfig(buttonId, { stepSize: parseInt(e.target.value) })}
              className="w-full accent-black h-2 bg-gray-200 appearance-none border border-black hover:bg-gray-300 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-bold">
              <span>1</span>
              <span>12</span>
            </div>
          </div>
        )}

        {/* MIDI Info */}
        <div className="border border-black p-2 bg-gray-50 space-y-2">
          <div>
            <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 mb-1 items-center">
              <span className="text-gray-500 text-xs">MIDI CH</span>
              <input 
                type="number"
                min="1"
                max="16"
                value={config.midiChannel}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 16) {
                    onUpdateConfig(buttonId, { midiChannel: val });
                  }
                }}
                className="w-16 bg-white border border-black px-1 py-0.5 text-xs font-bold text-right outline-none focus:bg-yellow-100"
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-gray-500 text-xs">NOTE #</span>
              <input 
                type="number"
                min="0"
                max="127"
                value={config.midiNote !== -1 ? config.midiNote : ''}
                placeholder="None"
                onChange={(e) => {
                  if (e.target.value === '') {
                    onUpdateConfig(buttonId, { midiNote: -1 });
                  } else {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 0 && val <= 127) {
                      onUpdateConfig(buttonId, { midiNote: val });
                    }
                  }
                }}
                className="w-16 bg-white border border-black px-1 py-0.5 text-xs font-bold text-right outline-none focus:bg-yellow-100 placeholder:text-[10px]"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1 border-t border-gray-300">
            <button 
              onClick={() => { startLearnMode(buttonId); onClose(); }} 
              className="flex-1 bg-black text-white py-1 px-2 text-xs font-bold hover:bg-yellow-400 hover:text-black transition-colors border border-black"
            >
              LEARN
            </button>
            <button 
              onClick={() => { clearMidiMapping(buttonId); onClose(); }} 
              className="flex-1 bg-white text-red-600 py-1 px-2 text-xs font-bold hover:bg-red-600 hover:text-white transition-colors border border-red-600"
            >
              CLEAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Global Context Menu ---

interface GlobalMenuProps {
  onLearnStart: () => void;
  onToggleListen: () => void;
  settings: { listenMode: boolean };
  position: { x: number; y: number };
  onClose: () => void;
}

export const GlobalContextMenu: React.FC<GlobalMenuProps> = ({
  onLearnStart,
  onToggleListen,
  settings,
  position,
  onClose
}) => {
  const { clearAllMidiMappings, uiVelocity = 80, setUiVelocity } = useMidi();

  return (
    <div 
      className="fixed z-50 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] min-w-[220px] flex flex-col font-mono"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-black text-white text-xs font-bold px-4 py-1 uppercase tracking-widest border-b-2 border-black">
        Global Settings
      </div>

      {/* Learn Button */}
      <button 
        onClick={() => { onLearnStart(); onClose(); }}
        className="text-left px-4 py-3 hover:bg-yellow-100 hover:pl-5 border-b border-black flex items-center gap-3 transition-all"
      >
        <div className="w-8 h-8 flex items-center justify-center border border-black bg-white">
            <GraduationCap className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
        <span className="font-extrabold text-black uppercase text-sm">MIDI Learn</span>
      </button>

      {/* Clear All Button */}
      <button 
        onClick={() => { clearAllMidiMappings(); onClose(); }}
        className="text-left px-4 py-3 hover:bg-red-100 hover:pl-5 border-b border-black flex items-center gap-3 transition-all"
      >
        <div className="w-8 h-8 flex items-center justify-center border border-black bg-white">
            <Trash2 className="w-5 h-5 text-red-600" strokeWidth={2.5} />
        </div>
        <span className="font-extrabold text-red-600 uppercase text-sm">Clear All Mappings</span>
      </button>

      {/* Listen Toggle */}
      <button 
        onClick={onToggleListen}
        className="text-left px-4 py-3 hover:bg-gray-100 border-b border-black flex items-center gap-3 transition-colors group"
      >
        <div className={`w-8 h-8 flex items-center justify-center border border-black ${settings.listenMode ? 'bg-green-500 text-white' : 'bg-white text-gray-400'}`}>
             <Volume2 className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
            <span className="font-extrabold text-black text-sm uppercase">Listen Mode</span>
            <span className="text-[10px] text-gray-700 font-bold">{settings.listenMode ? 'ON' : 'OFF'}</span>
        </div>
      </button>

      {/* Velocity Slider */}
      <div className="p-4 bg-gray-50 flex flex-col">
        <div className="flex justify-between mb-2 items-center">
          <label className="font-bold uppercase text-xs text-black">UI Velocity</label>
          <span className="bg-black text-white px-2 py-0.5 text-xs font-bold">{uiVelocity}</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="127" 
          step="1"
          value={uiVelocity}
          onChange={(e) => setUiVelocity?.(parseInt(e.target.value, 10))}
          className="w-full accent-black h-2 bg-gray-200 appearance-none border border-black hover:bg-gray-300 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-bold">
          <span>1</span>
          <span>127</span>
        </div>
      </div>
    </div>
  );
};
