import { useEffect, useState, useRef } from 'react';
import { audioEngine } from '../audio/engine';

export function VUMeter() {
  const [levelL, setLevelL] = useState(-Infinity);
  const [levelR, setLevelR] = useState(-Infinity);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const updateMeter = () => {
      const { l, r } = audioEngine.getMeterLevels();
      setLevelL(l);
      setLevelR(r);
      rafRef.current = requestAnimationFrame(updateMeter);
    };

    rafRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const numLeds = 11;
  const ledsL = [];
  const ledsR = [];
  
  const minDb = -60;
  const maxDb = 0;
  
  for (let i = 0; i < numLeds; i++) {
    const actThreshold = minDb + ((i+1) * ((maxDb - minDb) / numLeds));
    const isActiveL = levelL >= actThreshold;
    const isActiveR = levelR >= actThreshold;
    
    let colorClassL = "bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.6)]";
    let colorClassR = "bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.6)]";
    if (i >= 7) {
      colorClassL = "bg-[#ffea00] shadow-[0_0_6px_rgba(255,234,0,0.6)]";
      colorClassR = "bg-[#ffea00] shadow-[0_0_6px_rgba(255,234,0,0.6)]";
    }
    if (i >= 9) {
      colorClassL = "bg-[#ff1744] shadow-[0_0_6px_rgba(255,23,68,0.6)]";
      colorClassR = "bg-[#ff1744] shadow-[0_0_6px_rgba(255,23,68,0.6)]";
    }
    
    if (!isActiveL) colorClassL = "bg-[#181a18] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]";
    if (!isActiveR) colorClassR = "bg-[#181a18] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]";

    ledsL.push(
      <div key={`l-${i}`} className={`w-[8px] h-[3px] rounded-[1px] transition-colors duration-75 ${colorClassL}`} />
    );
    ledsR.push(
      <div key={`r-${i}`} className={`w-[8px] h-[3px] rounded-[1px] transition-colors duration-75 ${colorClassR}`} />
    );
  }

  // Visually top should be index max, bottom index 0
  ledsL.reverse();
  ledsR.reverse();

  return (
    <div className="flex flex-col items-center select-none">
      <span className="mb-[12px] text-[9px] font-bold text-[#8a8a93] uppercase tracking-widest">
        Output
      </span>
      <div className="flex gap-[4px] p-2 bg-[#111113] rounded-md shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] border border-[#222]">
        <div className="flex flex-col gap-[2px]">
          {ledsL}
        </div>
        <div className="flex flex-col gap-[2px]">
          {ledsR}
        </div>
      </div>
    </div>
  );
}
