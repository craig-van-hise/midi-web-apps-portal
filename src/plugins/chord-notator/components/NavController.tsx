import React from 'react';
import type { ButtonId, ButtonConfigMap } from './navTypes';

interface NavControllerProps {
  pressedButtons: Record<ButtonId, boolean>;
  configs: ButtonConfigMap;
  showDiagonals: boolean;
  showActions: boolean;
  onToggleActions: () => void;
  learnModeTarget: ButtonId | null; // If not null, this button should pulse/highlight
  onButtonDown: (id: ButtonId) => void;
  onButtonUp: (id: ButtonId) => void;
  onButtonContextMenu: (e: React.MouseEvent, id: ButtonId) => void;
  onBackgroundContextMenu: (e: React.MouseEvent) => void;
}

export const NavController: React.FC<NavControllerProps> = ({
  pressedButtons,
  configs,
  showDiagonals,
  showActions,
  onToggleActions,
  learnModeTarget,
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
    const isDiagonal = ['UP_LEFT', 'UP_RIGHT', 'DOWN_LEFT', 'DOWN_RIGHT'].includes(id);
    const btnSize = isDiagonal ? 'w-10 h-10' : 'w-14 h-14';

    // SVG Path for a block arrow
    const arrowPath = "M50 5 L90 45 L70 45 L70 95 L30 95 L30 45 L10 45 Z";

    // Animation / Transform constants
    const pressTransform = isPressed ? 'translate(2px, 2px)' : 'translate(0, 0)'; 
    const transition = isPressed ? 'all 0.05s ease-out' : 'all 0.1s ease-out';

    // Dynamic Styles for the SVG element (Visuals)
    const svgStyle: React.CSSProperties = {
      filter: isPressed ? 'none' : 'drop-shadow(3px 3px 0px #000)',
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
    const strokeWidth = isLearning ? 6 : 3;

    return (
      <button
        className={`relative ${btnSize} flex items-center justify-center outline-none select-none touch-none group bg-transparent border-none p-0 focus:outline-none`}
        onMouseDown={() => onButtonDown(id)}
        onMouseUp={() => onButtonUp(id)}
        onMouseLeave={() => onButtonUp(id)}
        onContextMenu={(e) => onButtonContextMenu(e, id)}
        onTouchStart={(e) => { e.preventDefault(); onButtonDown(id); }}
        onTouchEnd={(e) => { e.preventDefault(); onButtonUp(id); }}
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
            <div className={`bg-black text-white ${isDiagonal ? 'text-[8px] w-4 h-4' : 'text-[10px] w-5 h-5'} font-bold font-mono border border-white flex items-center justify-center rounded-full shadow-sm`}>
              {config.stepSize}
            </div>
          </div>
        )}
      </button>
    );
  };

  // Render Circular Button (Actions: Play, Home)
  const renderCircleBtn = (id: ButtonId, icon: string) => {
    const isPressed = pressedButtons[id];
    const isLearning = learnModeTarget === id;
    
    // Compact size w-12 (48px)
    let baseClasses = "relative w-12 h-12 flex items-center justify-center border border-black rounded-full transition-all select-none ";
    
    if (isPressed) {
      baseClasses += "bg-green-500 shadow-none translate-y-[2px] translate-x-[2px] ";
    } else if (isLearning) {
      baseClasses += "bg-white animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.9)] z-10 "; 
    } else {
      baseClasses += "bg-white hover:bg-gray-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[3px] active:translate-x-[3px] ";
    }

    return (
      <button
        className={baseClasses}
        onMouseDown={() => onButtonDown(id)}
        onMouseUp={() => onButtonUp(id)}
        onMouseLeave={() => onButtonUp(id)}
        onContextMenu={(e) => onButtonContextMenu(e, id)}
        onTouchStart={(e) => { e.preventDefault(); onButtonDown(id); }}
        onTouchEnd={(e) => { e.preventDefault(); onButtonUp(id); }}
      >
        <span className="material-symbols-outlined text-black pointer-events-none text-3xl">
          {icon}
        </span>
      </button>
    );
  };

  return (
    <div 
      className="relative w-full h-full min-h-[400px] flex flex-col items-center justify-center no-context-menu"
      onContextMenu={onBackgroundContextMenu}
    >
      {/* 
          Card Container 
          - Logic: 'aspect-square' enforces 1:1 ratio only when actions are hidden.
      */}
      <div 
        className={`relative bg-white p-10 rounded-[2.5rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] flex items-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${!showActions ? 'aspect-square justify-center' : 'pr-12'}`}
      >
        
        {/* LEFT SIDE: D-PAD */}
        <div className="grid grid-cols-3 grid-rows-3 gap-0 z-10">
          {/* Row 1 */}
          <div className="flex items-end justify-end">
            {showDiagonals && renderArrowBtn('UP_LEFT', 315)}
          </div>
          <div className="flex items-center justify-center">
            {renderArrowBtn('UP', 0)}
          </div>
          <div className="flex items-end justify-start">
            {showDiagonals && renderArrowBtn('UP_RIGHT', 45)}
          </div>

          {/* Row 2 */}
          <div className="flex items-center justify-center">
            {renderArrowBtn('LEFT', 270)}
          </div>
          <div className="w-14 h-14 flex items-center justify-center">
             {/* Center cell empty - Clean */}
          </div>
          <div className="flex items-center justify-center">
            {renderArrowBtn('RIGHT', 90)}
          </div>

          {/* Row 3 */}
          <div className="flex items-start justify-end">
            {showDiagonals && renderArrowBtn('DOWN_LEFT', 225)}
          </div>
          <div className="flex items-center justify-center">
            {renderArrowBtn('DOWN', 180)}
          </div>
          <div className="flex items-start justify-start">
            {showDiagonals && renderArrowBtn('DOWN_RIGHT', 135)}
          </div>
        </div>

        {/* VERTICAL DIVIDER & ACTIONS CONTAINER */}
        <div 
          className={`flex items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${showActions ? 'w-auto opacity-100 ml-6' : 'w-0 opacity-0 ml-0'}`}
        >
          {/* Divider Line Removed */}

          {/* Action Buttons */}
          <div className="flex flex-col gap-8 min-w-[3rem] items-center p-3">
             {renderCircleBtn('PLAY', 'play_arrow')}
             {renderCircleBtn('HOME', 'home')}
          </div>
        </div>

        {/* 
            TOGGLE: 2 Little Dots in Bottom RH Corner 
            - Logic: Simple view pager metaphor.
            - State 1 (Collapsed): Left dot active.
            - State 2 (Expanded): Right dot active.
            - Updated colors to be subtle grays instead of stark black.
        */}
        <button 
          onClick={onToggleActions}
          className="absolute bottom-6 right-6 flex gap-1.5 p-2 outline-none group"
          title={showActions ? "Collapse" : "Expand"}
        >
          <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${!showActions ? 'bg-gray-400' : 'bg-gray-200 group-hover:bg-gray-300'}`} />
          <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${showActions ? 'bg-gray-400' : 'bg-gray-200 group-hover:bg-gray-300'}`} />
        </button>

      </div>
    </div>
  );
};