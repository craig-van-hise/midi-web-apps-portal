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
    <div className="flex items-center gap-1.5 text-xs">
      <label htmlFor="key-root-select" className="text-gray-400 font-medium whitespace-nowrap">Key:</label>
      <select
        id="key-root-select"
        value={currentRoot}
        onChange={handleRootChange}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#aa3bff]/30 focus:border-[#aa3bff] transition-all cursor-pointer"
      >
        {ROOTS.map((root) => (
          <option key={root} value={root}>
            {root}
          </option>
        ))}
      </select>
      <select
        id="key-scale-select"
        value={currentScale}
        onChange={handleScaleChange}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#aa3bff]/30 focus:border-[#aa3bff] transition-all cursor-pointer"
      >
        {SCALES.map((scale) => (
          <option key={scale} value={scale}>
            {scale}
          </option>
        ))}
      </select>
    </div>
  );
};

export default KeySignatureSelector;
