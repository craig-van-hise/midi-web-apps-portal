import React from 'react';
import type { ButtonId, ButtonConfigMap } from './TransformationsTypes';
import { Play, House } from 'lucide-react';

export interface TransformationsToolbarProps {
  pressedButtons: Record<ButtonId, boolean>;
  configs: ButtonConfigMap;
  learnModeTarget: ButtonId | null; // If not null, this button should pulse/highlight
  isOpen: boolean;
  onToggleTab: () => void;
  onButtonDown: (id: ButtonId, e?: React.PointerEvent) => void;
  onButtonUp: (id: ButtonId) => void;
  onButtonContextMenu: (e: React.MouseEvent, id: ButtonId) => void;
  onBackgroundContextMenu: (e: React.MouseEvent) => void;
}

export const TransformationsToolbar: React.FC<TransformationsToolbarProps> = ({
  pressedButtons,
  configs,
  learnModeTarget,
  isOpen,
  onToggleTab,
  onButtonDown,
  onButtonUp,
  onButtonContextMenu,
  onBackgroundContextMenu,
}) => {

  // Render SVG Arrow Button (Directional)
  const renderArrowBtn = (id: ButtonId, rotate: number) => {
    const isPressed = pressedButtons[id];
    const isLearning = learnModeTarget === id;
    const config = configs[id];
    const showStep = config?.stepSize > 1;
    const btnSize = 'w-7 h-7'; // Scaled down by 50% from w-14

    // SVG Path for a block arrow
    const arrowPath = "M50 5 L90 45 L70 45 L70 95 L30 95 L30 45 L10 45 Z";

    // Animation / Transform constants
    const pressTransform = isPressed ? 'translate(1px, 1px)' : 'translate(0, 0)'; 
    const transition = isPressed ? 'all 0.05s ease-out' : 'all 0.1s ease-out';

    // Dynamic Styles for the SVG element (Visuals)
    const svgStyle: React.CSSProperties = {
      filter: isPressed ? 'none' : 'drop-shadow(2px 2px 0px #000)',
      transform: pressTransform,
      transition: transition,
      cursor: 'pointer',
    };

    // Style for the label to move with the button press
    const labelStyle: React.CSSProperties = {
      transform: pressTransform,
      transition: transition,
    };

    const fillColor = isPressed ? '#22c55e' : 'white'; 
    const strokeColor = isLearning ? '#facc15' : 'black';
    const strokeWidth = isLearning ? 8 : 4;

    return (
      <button
        className={`relative ${btnSize} flex items-center justify-center outline-none select-none touch-none group bg-transparent border-none p-0 focus:outline-none`}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
          onButtonDown(id, e);
        }}
        onPointerUp={() => onButtonUp(id)}
        onPointerLeave={() => onButtonUp(id)}
        onContextMenu={(e) => onButtonContextMenu(e, id)}
        aria-label={`${id} transformation`}
      >
        <svg 
            viewBox="0 0 100 100" 
            className={`w-full h-full overflow-visible ${isLearning ? 'animate-pulse' : ''}`}
            style={svgStyle}
        >
            <path 
                d={arrowPath} 
                fill={fillColor} 
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                transform={`rotate(${rotate} 50 50)`} 
            />
        </svg>

        {/* Step Size Indicator - Centered on the arrow */}
        {showStep && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            style={labelStyle}
          >
            <div className={`bg-black text-white text-[8px] w-4 h-4 font-bold font-mono border border-white flex items-center justify-center rounded-full shadow-sm`}>
              {config.stepSize}
            </div>
          </div>
        )}
      </button>
    );
  };

  // Render Arrow Pair (Up / Down) with Label
  const renderArrowPair = (upId: ButtonId, downId: ButtonId, label: string) => {
    return (
      <div className="flex flex-col items-center gap-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded-xl shadow-inner">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700 leading-none">{label}</span>
        <div className="flex flex-col gap-1 mt-1">
          {renderArrowBtn(upId, 0)}
          {renderArrowBtn(downId, 180)}
        </div>
      </div>
    );
  };
  // Render Circular/Square Action Button
  const renderActionBtn = (id: ButtonId, Icon: React.FC<any>) => {
    const isPressed = pressedButtons[id];
    const isLearning = learnModeTarget === id;
    
    let baseClasses = "relative w-8 h-8 flex items-center justify-center border-[1.5px] border-black rounded-lg transition-all select-none focus:outline-none touch-none "; 
    
    if (isPressed) {
      baseClasses += "bg-green-400 shadow-none translate-y-[2px] translate-x-[2px] ";
    } else if (isLearning) {
      baseClasses += "bg-white animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.9)] z-10 border-yellow-400 "; 
    } else {
      baseClasses += "bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] ";
    }

    return (
      <button
        className={baseClasses}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
          onButtonDown(id, e);
        }}
        onPointerUp={() => onButtonUp(id)}
        onPointerLeave={() => onButtonUp(id)}
        onContextMenu={(e) => onButtonContextMenu(e, id)}
        aria-label={`${id} transformation`}
      >
        <Icon className={`w-4 h-4 text-black pointer-events-none ${isPressed ? 'transform scale-95' : ''}`} strokeWidth={3} />
      </button>
    );
  };

  return (
    <div 
      className="relative w-full py-8 flex flex-col items-center justify-center no-context-menu"
      onContextMenu={onBackgroundContextMenu}
    >
      <div className="relative">
        <div 
          className="relative bg-white px-8 py-5 rounded-[2rem] border border-gray-200 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1),_0_8px_10px_-5px_rgba(0,0,0,0.05)] flex items-center gap-8 z-10"
        >
          {/* LEFT SIDE: ARROWS */}
          <div className="flex gap-4">
            {renderArrowPair('SEMI_UP', 'SEMI_DOWN', 'semi')}
            {renderArrowPair('KEY_UP', 'KEY_DOWN', 'key')}
            {renderArrowPair('ROT_UP', 'ROT_DOWN', 'rot')}
            {renderArrowPair('OCT_UP', 'OCT_DOWN', 'oct')}
          </div>

          {/* DIVIDER */}
          <div className="w-[2px] h-20 bg-gray-200 rounded-full" />

          {/* RIGHT SIDE: ACTIONS */}
          <div className="grid grid-cols-1 gap-3">
            {renderActionBtn('PLAY', Play)}
            {renderActionBtn('HOME', House)}
          </div>
        </div>
        
        {/* TAB AT BOTTOM CENTER */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-0">
          <button 
            aria-label="Toggle Drawer"
            className="bg-white border text-gray-500 border-gray-200 border-t-0 px-6 py-1 rounded-b-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] hover:bg-gray-50 transition-colors focus:outline-none"
            onClick={(e) => {
               e.stopPropagation();
               onToggleTab();
            }}
          >
             <svg 
               xmlns="http://www.w3.org/2000/svg" 
               width="20" height="20" 
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
               className={`lucide lucide-chevron-down transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
             >
               <path d="m6 9 6 6 6-6"/>
             </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
