import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../lib/utils';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  valueLabel?: React.ReactNode;
  className?: string;
  size?: number;
}

export function Knob({ label, value, min, max, onChange, valueLabel, className, size = 40 }: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValueRef = useRef<number>(0);
  
  const isCompact = size < 30;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaY = startYRef.current - e.clientY; // Drag UP: clientY is smaller, deltaY is positive
      
      // Sensitivity factor
      const range = max - min;
      const valDelta = (deltaY / 150) * range;
      
      let newValue = startValueRef.current + valDelta;
      newValue = Math.max(min, Math.min(max, newValue));
      
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onChange]);

  // Rotation: Map min->-135deg, max->135deg
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rotation = -135 + (percentage * 270);

  return (
    <div className={cn("flex flex-col items-center select-none", className)}>
      <span className={cn(
        "font-bold text-[#8a8a93] uppercase tracking-widest",
        isCompact ? "mb-[4px] text-[7px]" : "mb-[12px] text-[9px]"
      )}>
        {label}
      </span>
      <div 
        className="relative rounded-full flex items-center justify-center cursor-ns-resize"
        onMouseDown={handleMouseDown}
        style={{
           width: size,
           height: size,
           background: 'linear-gradient(135deg, #404044 0%, #222225 100%)',
           boxShadow: '0 6px 8px -3px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.4)',
           border: '1px solid #1a1a1c'
        }}
      >
        <div 
          className="absolute w-full h-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '50% 50%',
          }}
        >
          <div className={cn(
            "absolute left-[50%] -translate-x-[50%] bg-[#00ff88] rounded-full pointer-events-none shadow-[0_0_4px_rgba(0,255,136,0.8)]",
            isCompact ? "top-[3px] w-[1.5px] h-[5px]" : "top-[5px] w-[2.5px] h-[7px]"
          )} />
        </div>
      </div>
      {valueLabel !== undefined && (
        <span className={cn(
          "text-[#6b6b75] uppercase tracking-wider font-mono",
          isCompact ? "mt-[4px] text-[7px]" : "mt-[10px] text-[9px]"
        )}>
          {valueLabel}
        </span>
      )}
    </div>
  );
}
