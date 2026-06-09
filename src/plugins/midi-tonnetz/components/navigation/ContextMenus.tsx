import React from 'react';
import { ButtonConfig, ButtonId } from './types';

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
        <div className="border border-black p-2 bg-gray-50">
          <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 mb-1">
            <span className="text-gray-500 text-xs">MIDI CH</span>
            <span className="font-bold">{config.midiChannel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-xs">NOTE #</span>
            <span className="font-bold">{config.midiNote}</span>
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
  onToggleDiagonals: () => void;
  settings: { listenMode: boolean; showDiagonals: boolean };
  position: { x: number; y: number };
  onClose: () => void;
}

export const GlobalContextMenu: React.FC<GlobalMenuProps> = ({
  onLearnStart,
  onToggleListen,
  onToggleDiagonals,
  settings,
  position,
  onClose
}) => {
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
            <span className="material-symbols-outlined text-sm">school</span>
        </div>
        <span className="font-bold uppercase text-sm">MIDI Learn</span>
      </button>

      {/* Listen Toggle */}
      <button 
        onClick={onToggleListen}
        className="text-left px-4 py-3 hover:bg-gray-100 border-b border-black flex items-center gap-3 transition-colors group"
      >
        <div className={`w-8 h-8 flex items-center justify-center border border-black ${settings.listenMode ? 'bg-green-500 text-white' : 'bg-white text-gray-400'}`}>
             <span className="material-symbols-outlined text-sm">volume_up</span>
        </div>
        <div className="flex flex-col">
            <span className="font-bold text-sm uppercase">Listen Mode</span>
            <span className="text-[10px] text-gray-500">{settings.listenMode ? 'ON' : 'OFF'}</span>
        </div>
      </button>

      {/* Diagonals Toggle */}
      <button 
        onClick={onToggleDiagonals}
        className="text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3 transition-colors group"
      >
        <div className={`w-8 h-8 flex items-center justify-center border border-black ${settings.showDiagonals ? 'bg-black text-white' : 'bg-white text-gray-400'}`}>
            <span className="material-symbols-outlined text-sm">open_with</span>
        </div>
        <div className="flex flex-col">
            <span className="font-bold text-sm uppercase">Diagonals</span>
            <span className="text-[10px] text-gray-500">{settings.showDiagonals ? 'ENABLED' : 'DISABLED'}</span>
        </div>
      </button>
    </div>
  );
};
