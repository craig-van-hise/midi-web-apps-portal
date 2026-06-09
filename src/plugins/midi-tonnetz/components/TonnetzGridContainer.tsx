import React, { useState } from 'react';
import TonnetzGrid from './TonnetzGrid';
import { TRIAD_TYPES } from '../constants';
import { NavContainer } from './navigation/NavContainer';

interface TonnetzGridContainerProps {
    externalPitchClasses?: Set<number>;
    clearSignal?: number;
    onDirectionalDown?: (direction: string) => void;
    onDirectionalUp?: () => void;
    onPlayDown?: () => void;
    onPlayUp?: () => void;
    onNodeDown?: (pc: number) => void;
    onNodeUp?: (pc: number) => void;
}

const TonnetzGridContainer: React.FC<TonnetzGridContainerProps> = ({ 
    externalPitchClasses = new Set(), 
    clearSignal = 0, 
    onDirectionalDown, 
    onDirectionalUp, 
    onPlayDown, 
    onPlayUp,
    onNodeDown,
    onNodeUp
}) => {
    // State
    const [selectedTriadIndex, setSelectedTriadIndex] = useState(0); // Default to Major

    const currentTriad = TRIAD_TYPES[selectedTriadIndex];

    // Calculation of i1 and i2
    // i1 = set[2] (3rd element)
    // i2 = set[1] (2nd element)
    // Note: Triad sets are sorted [root, mid, high] relative to 0
    const i1 = currentTriad.set[2];
    const i2 = currentTriad.set[1];



    return (
        <div className="w-full h-full max-w-6xl max-h-[800px] flex flex-col relative bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
            
            {/* Header / Controls */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-4 bg-white p-2 px-4 rounded-full shadow border border-gray-200">
                <span className="material-symbols-outlined text-gray-500">piano</span>
                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Triad Mapping</label>
                    <select 
                        className="bg-transparent font-semibold text-gray-800 outline-none cursor-pointer text-sm"
                        value={selectedTriadIndex}
                        onChange={(e) => setSelectedTriadIndex(Number(e.target.value))}
                    >
                        {TRIAD_TYPES.map((t, idx) => (
                            <option key={t.name} value={idx}>
                                {t.name} ({t.intervals.join(', ')})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* The Grid Canvas */}
            <div className="flex-1 w-full relative">
                <TonnetzGrid 
                    activePitchClasses={externalPitchClasses}
                    i1={i1}
                    i2={i2}
                    onNodeDown={onNodeDown}
                    onNodeUp={onNodeUp}
                />
            </div>

            <div className="absolute bottom-4 right-4 z-10 text-right bg-white p-3 rounded-lg text-gray-500 text-xs shadow-md border border-gray-100">
                <p>
                     Grid Axis X: <strong className="text-gray-800">+{i1}</strong> semitones <br/>
                     Grid Axis Y: <strong className="text-gray-800">+{i2}</strong> semitones
                </p>
            </div>
            
            {/* Instructions */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 bg-white p-3 rounded-lg text-xs text-gray-500 shadow border border-gray-100 pointer-events-none select-none">
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">swipe</span> Scroll to Pan</div>
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">zoom_in</span> ⌘ + Scroll to Zoom</div>
                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">ads_click</span> Click Node to Toggle</div>
            </div>

            {/* Navigation D-pad floating overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 origin-bottom scale-[0.85] pointer-events-auto">
                <NavContainer 
                    onDirectionalDown={onDirectionalDown} 
                    onDirectionalUp={onDirectionalUp} 
                    onPlayDown={onPlayDown} 
                    onPlayUp={onPlayUp} 
                />
            </div>
        </div>
    );
};

export default TonnetzGridContainer;