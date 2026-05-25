import React, { useState, useEffect } from 'react';
import { TransformationsToolbar } from './TransformationsToolbar';
import { ArrowContextMenu, GlobalContextMenu } from './TransformationsContextMenus';
import type { ButtonId, ContextMenuType } from './TransformationsTypes';
import { useMidi } from '../../midi/MIDIProvider';

export const TransformationsDrawer = () => {
  const { configs, updateButtonConfig, listenMode, setListenMode, learnState, startLearnMode, stopLearnMode, uiVelocity = 80 } = useMidi();
  const [pressed, setPressed] = useState<Record<ButtonId, boolean>>({} as any);
  const [contextMenu, setContextMenu] = useState<ContextMenuType>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // Start closed

  // --- HANDLERS: Buttons ---

  const handleButtonDown = (id: ButtonId, e?: React.PointerEvent, hardwareVelocity?: number) => {
    if (!learnState.isActive) {
      const config = configs[id];
      const stepSize = config?.stepSize || 1;

      // History / Home Action
      if (id === 'HOME') {
        let velocity = hardwareVelocity || uiVelocity;
        if (e) {
          const target = e.currentTarget as HTMLElement;
          target.releasePointerCapture(e.pointerId);
          const rect = target.getBoundingClientRect();
          const offsetY = e.clientY - rect.top;
          velocity = Math.max(1, Math.min(127, Math.floor(((rect.height - offsetY) / rect.height) * 127)));
        }

        window.dispatchEvent(new CustomEvent('APP_HOME_ON', {
          detail: { velocity }
        }));
      } 
      // Play Action
      else if (id === 'PLAY') {
        let velocity = hardwareVelocity || uiVelocity;
        if (e) {
          const target = e.currentTarget as HTMLElement;
          target.releasePointerCapture(e.pointerId);
          const rect = target.getBoundingClientRect();
          const offsetY = e.clientY - rect.top;
          // Bottom = 1, Top = 127
          velocity = Math.max(1, Math.min(127, Math.floor(((rect.height - offsetY) / rect.height) * 127)));
        }

        window.dispatchEvent(new CustomEvent('APP_PLAY_ON', {
          detail: { velocity }
        }));
      }
      // Transform Actions
      else {
        window.dispatchEvent(new CustomEvent('APP_TRANSFORM', {
          detail: { 
            type: id as any, 
            stepSize,
            isUiClick: !!e
          }
        }));
      }
    }
    setPressed(prev => ({ ...prev, [id]: true }));
  };

  const handleButtonUp = (id: ButtonId) => {
    if (id === 'PLAY') window.dispatchEvent(new CustomEvent('APP_PLAY_OFF'));
    if (id === 'HOME') window.dispatchEvent(new CustomEvent('APP_HOME_OFF'));
    setPressed(prev => ({ ...prev, [id]: false }));
  };

  // --- HANDLERS: Context Menus ---

  const handleButtonContextMenu = (e: React.MouseEvent, id: ButtonId) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Prevents bubbling to background handler
    
    if (learnState.isActive) return;

    const MENU_HEIGHT = 320;
    const MENU_WIDTH = 260;
    let y = e.clientY;
    let x = e.clientX;
    if (y + MENU_HEIGHT > window.innerHeight) y = window.innerHeight - MENU_HEIGHT - 20;
    if (x + MENU_WIDTH > window.innerWidth) x = window.innerWidth - MENU_WIDTH - 20;

    setContextMenu({
      type: 'BUTTON',
      x,
      y,
      buttonId: id
    });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (learnState.isActive) return;

    const MENU_HEIGHT = 320;
    const MENU_WIDTH = 260;
    let y = e.clientY;
    let x = e.clientX;
    if (y + MENU_HEIGHT > window.innerHeight) y = window.innerHeight - MENU_HEIGHT - 20;
    if (x + MENU_WIDTH > window.innerWidth) x = window.innerWidth - MENU_WIDTH - 20;

    setContextMenu({
      type: 'GLOBAL',
      x,
      y
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const toggleListen = () => {
    setListenMode(prev => !prev);
  };

  // Global click listener to close menus
  useEffect(() => {
    const handleClick = () => {
      // If menu is open, click outside closes it
      if (contextMenu) setContextMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
        if (learnState.isActive) stopLearnMode();
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, learnState.isActive, stopLearnMode]);

  // Listen for MIDI-triggered button press events
  useEffect(() => {
    const handlePressOn = (e: Event) => {
      const { buttonId } = (e as CustomEvent).detail;
      setPressed(prev => ({ ...prev, [buttonId]: true }));
    };

    const handlePressOff = (e: Event) => {
      const { buttonId } = (e as CustomEvent).detail;
      setPressed(prev => ({ ...prev, [buttonId]: false }));
    };

    window.addEventListener('APP_BUTTON_PRESS_ON', handlePressOn as any);
    window.addEventListener('APP_BUTTON_PRESS_OFF', handlePressOff as any);

    return () => {
      window.removeEventListener('APP_BUTTON_PRESS_ON', handlePressOn as any);
      window.removeEventListener('APP_BUTTON_PRESS_OFF', handlePressOff as any);
    };
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center pointer-events-none">
      <div className="pointer-events-auto w-full flex flex-col items-center">
      <div 
        className={`w-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-10 flex flex-col items-center ${isDrawerOpen ? '-mt-10 translate-y-0' : '-mt-10 -translate-y-[155px]'}`}
      >
        <TransformationsToolbar 
          isOpen={isDrawerOpen}
          onToggleTab={() => setIsDrawerOpen(prev => !prev)}
          pressedButtons={pressed}
          configs={configs}
          learnModeTarget={learnState.isActive ? learnState.sequence[learnState.currentButtonIndex] : null}
          onButtonDown={handleButtonDown}
          onButtonUp={handleButtonUp}
          onButtonContextMenu={handleButtonContextMenu}
          onBackgroundContextMenu={handleBackgroundContextMenu}
        />
      </div>

      {/* Render Context Menus */}
      {contextMenu?.type === 'BUTTON' && (
        <ArrowContextMenu 
          buttonId={contextMenu.buttonId}
          config={configs[contextMenu.buttonId]}
          onUpdateConfig={updateButtonConfig}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
        />
      )}

      {contextMenu?.type === 'GLOBAL' && (
        <GlobalContextMenu 
          settings={{ listenMode }}
          onToggleListen={toggleListen}
          onLearnStart={() => startLearnMode()}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
        />
      )}

      {/* Learn Mode Overlay Instruction */}
      {learnState.isActive && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-50">
          <p className="font-bold text-center">LEARN MODE ACTIVE</p>
          <p className="text-xs text-center mt-1 text-gray-300">Play a MIDI note to map: <span className="text-yellow-400 font-bold text-lg">{learnState.sequence[learnState.currentButtonIndex]}</span></p>
          <button onClick={stopLearnMode} className="block w-full text-xs underline mt-2 hover:text-yellow-400">Cancel</button>
        </div>
      )}
      </div>
    </div>
  );
};
