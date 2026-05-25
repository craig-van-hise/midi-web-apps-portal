// src/components/KeySignatureSelector.tsx
import React from 'react';
import { useMidi } from '../midi/MIDIProvider';
import { SCALE_DECIMAL_MAP } from '../utils/notationMath';

const ROOTS = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'
];

const SCALES = Object.keys(SCALE_DECIMAL_MAP);

const KeySignatureSelector: React.FC = () => {
  const { keySignature, setKeySignature } = useMidi();

  const parts = keySignature.split(' ');
  const currentRoot = parts[0];
  const currentScale = parts.slice(1).join(' ') || 'Major';

  const handleRootChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setKeySignature(`${e.target.value} ${currentScale}`);
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setKeySignature(`${currentRoot} ${e.target.value}`);
  };

  return (
    <div 
      className="flex items-center gap-4 bg-white dark:bg-[#111] shadow-lg rounded-full px-5 py-2.5 border border-gray-100 dark:border-white/5 transition-all w-fit"
      style={{ fontFamily: "'Jost', sans-serif" }}
    >
      <div className="flex flex-col items-start justify-center group">
        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest leading-none mb-1 ml-1 whitespace-nowrap">
          Root Note
        </span>
        <div className="relative flex items-center rounded hover:bg-gray-50 dark:hover:bg-white/5 transition-colors px-1 cursor-pointer">
          <select
            id="key-root-select"
            value={currentRoot}
            onChange={handleRootChange}
            className="appearance-none bg-transparent border-none outline-none text-sm font-bold text-gray-800 dark:text-gray-200 cursor-pointer pr-5 py-0.5 z-10"
          >
            {ROOTS.map((root) => (
              <option key={root} value={root}>
                {root}
              </option>
            ))}
          </select>
          <span className="absolute right-1 text-[10px] text-gray-400 pointer-events-none group-hover:text-[#aa3bff] transition-colors">▾</span>
        </div>
      </div>

      <div className="flex flex-col items-start justify-center group">
        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-widest leading-none mb-1 ml-1 whitespace-nowrap">
          Scale Type
        </span>
        <div className="relative flex items-center rounded hover:bg-gray-50 dark:hover:bg-white/5 transition-colors px-1 cursor-pointer">
          <select
            id="key-scale-select"
            value={currentScale}
            onChange={handleScaleChange}
            className="appearance-none bg-transparent border-none outline-none text-sm font-bold text-gray-800 dark:text-gray-200 cursor-pointer pr-5 py-0.5 z-10"
          >
            {SCALES.map((scale) => (
              <option key={scale} value={scale}>
                {scale}
              </option>
            ))}
          </select>
          <span className="absolute right-1 text-[10px] text-gray-400 pointer-events-none group-hover:text-[#aa3bff] transition-colors">▾</span>
        </div>
      </div>
    </div>
  );
};

export default KeySignatureSelector;
