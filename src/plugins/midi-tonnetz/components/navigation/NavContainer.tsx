import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavControllerOriginal } from './NavControllerOriginal';
import { ArrowContextMenu, GlobalContextMenu } from './ContextMenus';
import { ButtonId, ButtonConfig, ButtonConfigMap, GlobalSettings, ContextMenuType, LearnState } from './types';

const DEFAULT_CONFIG: ButtonConfig = {
  stepSize: 1,
  midiChannel: 1,
  midiNote: 60, // Middle C default
};

const INITIAL_BUTTONS: ButtonId[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'UP_LEFT', 'UP_RIGHT', 'DOWN_LEFT', 'DOWN_RIGHT', 'PLAY', 'HOME'];

export const NavContainer = ({ 
  onDirectionalDown,
  onDirectionalUp,
  onPlayDown,
  onPlayUp
}: { 
  onDirectionalDown?: (direction: string) => void;
  onDirectionalUp?: () => void;
  onPlayDown?: () => void;
  onPlayUp?: () => void;
}) => {
  // --- STATE ---
  const [pressed, setPressed] = useState<Record<ButtonId, boolean>>({} as any);
  
  // Initialize configs for all potential buttons
  const [configs, setConfigs] = useState<ButtonConfigMap>(() => {
    const map: any = {};
    INITIAL_BUTTONS.forEach(id => map[id] = { ...DEFAULT_CONFIG, midiNote: 60 + INITIAL_BUTTONS.indexOf(id) });
    return map;
  });

  const [settings, setSettings] = useState<GlobalSettings>({
    listenMode: true,
    showDiagonals: false,
    showActions: true,
  });

  const [contextMenu, setContextMenu] = useState<ContextMenuType>(null);
  
  const [learnState, setLearnState] = useState<LearnState>({
    isActive: false,
    currentButtonIndex: 0,
    sequence: [],
  });


  // --- HANDLERS: Buttons ---

  const handleButtonDown = (id: ButtonId) => {
    if (settings.listenMode && !learnState.isActive) {
      console.log(`[MOCK MIDI] Note ON | Ch: ${configs[id].midiChannel} | Note: ${configs[id].midiNote}`);
    }
    setPressed(prev => ({ ...prev, [id]: true }));

    const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'UP_LEFT', 'UP_RIGHT', 'DOWN_LEFT', 'DOWN_RIGHT'];
    if (DIRECTIONS.includes(id) && onDirectionalDown) {
      onDirectionalDown(id);
    }
    if (id === 'PLAY' && onPlayDown) {
      onPlayDown();
    }
  };

  const handleButtonUp = (id: ButtonId) => {
    if (settings.listenMode && !learnState.isActive) {
      console.log(`[MOCK MIDI] Note OFF | Ch: ${configs[id].midiChannel} | Note: ${configs[id].midiNote}`);
    }
    setPressed(prev => ({ ...prev, [id]: false }));

    const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'UP_LEFT', 'UP_RIGHT', 'DOWN_LEFT', 'DOWN_RIGHT'];
    if (DIRECTIONS.includes(id) && onDirectionalUp) {
      onDirectionalUp();
    }
    if (id === 'PLAY' && onPlayUp) {
      onPlayUp();
    }
  };


  // --- HANDLERS: Context Menus ---

  const handleButtonContextMenu = (e: React.MouseEvent, id: ButtonId) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Prevents bubbling to background handler
    
    if (learnState.isActive) return;

    const MENU_WIDTH = 260; // Estimated max width
    const MENU_HEIGHT = 220; // Estimated max height
    const padding = 64;
    
    let adjustedX = e.clientX;
    let adjustedY = e.clientY;
    
    if (adjustedX + MENU_WIDTH > window.innerWidth) {
      adjustedX = window.innerWidth - MENU_WIDTH - padding;
    }
    if (adjustedY + MENU_HEIGHT > window.innerHeight) {
      adjustedY = window.innerHeight - MENU_HEIGHT - padding;
    }

    setContextMenu({
      type: 'BUTTON',
      x: adjustedX,
      y: adjustedY,
      buttonId: id
    });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (learnState.isActive) return;

    const MENU_WIDTH = 260; // Estimated max width
    const MENU_HEIGHT = 220; // Estimated max height
    const padding = 64;
    
    let adjustedX = e.clientX;
    let adjustedY = e.clientY;
    
    if (adjustedX + MENU_WIDTH > window.innerWidth) {
      adjustedX = window.innerWidth - MENU_WIDTH - padding;
    }
    if (adjustedY + MENU_HEIGHT > window.innerHeight) {
      adjustedY = window.innerHeight - MENU_HEIGHT - padding;
    }

    setContextMenu({
      type: 'GLOBAL',
      x: adjustedX,
      y: adjustedY
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  // --- LOGIC: Config Updates ---

  const updateButtonConfig = (id: ButtonId, updates: Partial<ButtonConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const toggleListen = () => {
    setSettings(s => ({ ...s, listenMode: !s.listenMode }));
  };

  const toggleDiagonals = () => {
    setSettings(s => ({ ...s, showDiagonals: !s.showDiagonals }));
  };

  const toggleActions = () => {
    setSettings(s => ({ ...s, showActions: !s.showActions }));
  };


  // --- LOGIC: MIDI Learn Mode ---

  const startLearnMode = () => {
    // Determine sequence based on diagonal setting
    const baseSequence: ButtonId[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    const diagSequence: ButtonId[] = ['UP_RIGHT', 'DOWN_RIGHT', 'DOWN_LEFT', 'UP_LEFT'];
    const actionSequence: ButtonId[] = ['PLAY', 'HOME'];

    let sequence = [...baseSequence];
    if (settings.showDiagonals) {
      sequence = [...sequence, ...diagSequence];
    }
    // Only learn actions if they are visible
    if (settings.showActions) {
      sequence = [...sequence, ...actionSequence];
    }

    setLearnState({
      isActive: true,
      currentButtonIndex: 0,
      sequence: sequence
    });
    
    console.log("[Learn Mode] Started. Waiting for input for:", sequence[0]);
  };

  const stopLearnMode = useCallback(() => {
    if (!learnState.isActive) return;
    setLearnState(prev => ({ ...prev, isActive: false }));
    console.log("[Learn Mode] Cancelled/Finished.");
  }, [learnState.isActive]);


  // Simulate receiving a MIDI note from external hardware
  const simulateMidiInput = useCallback(() => {
    if (!learnState.isActive) return;

    const currentId = learnState.sequence[learnState.currentButtonIndex];
    if (!currentId) return; // Finished?

    // Mock assigning a random note
    const randomNote = Math.floor(Math.random() * 127);
    console.log(`[Learn Mode] Assigned MIDI Note ${randomNote} to ${currentId}`);
    
    updateButtonConfig(currentId, { midiNote: randomNote });

    // Advance
    if (learnState.currentButtonIndex >= learnState.sequence.length - 1) {
      stopLearnMode();
    } else {
      setLearnState(prev => ({
        ...prev,
        currentButtonIndex: prev.currentButtonIndex + 1
      }));
    }
  }, [learnState, stopLearnMode]);


  // Global click listener to close menus
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // If menu is open, click outside closes it
      if (contextMenu) setContextMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
        if (learnState.isActive) stopLearnMode();
      }
      // Pressing 'Space' or 'Enter' simulates a MIDI note input during Learn Mode
      if (learnState.isActive && (e.key === ' ' || e.key === 'Enter')) {
        simulateMidiInput();
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, learnState.isActive, stopLearnMode, simulateMidiInput]);


  return (
    <>
      <NavControllerOriginal 
        pressedButtons={pressed}
        configs={configs}
        showDiagonals={settings.showDiagonals}
        showActions={settings.showActions}
        onToggleActions={toggleActions}
        learnModeTarget={learnState.isActive ? learnState.sequence[learnState.currentButtonIndex] : null}
        onButtonDown={handleButtonDown}
        onButtonUp={handleButtonUp}
        onButtonContextMenu={handleButtonContextMenu}
        onBackgroundContextMenu={handleBackgroundContextMenu}
      />

      {/* Render Context Menus */}
      {contextMenu?.type === 'BUTTON' && createPortal(
        <ArrowContextMenu 
          buttonId={contextMenu.buttonId}
          config={configs[contextMenu.buttonId]}
          onUpdateConfig={updateButtonConfig}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
        />,
        document.body
      )}

      {contextMenu?.type === 'GLOBAL' && createPortal(
        <GlobalContextMenu 
          settings={settings}
          onToggleListen={toggleListen}
          onToggleDiagonals={toggleDiagonals}
          onLearnStart={startLearnMode}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
        />,
        document.body
      )}

      {/* Learn Mode Overlay Instruction */}
      {learnState.isActive && (
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 border-2 border-yellow-400 shadow-xl z-50 animate-bounce w-max">
          <p className="font-bold text-center">LEARN MODE ACTIVE</p>
          <p className="text-xs text-center mt-1 text-gray-300">Play a MIDI note (or press SPACE) to map: <span className="text-yellow-400 font-bold text-lg">{learnState.sequence[learnState.currentButtonIndex]}</span></p>
          <button onClick={stopLearnMode} className="block w-full text-xs underline mt-2 hover:text-yellow-400">Cancel</button>
        </div>
      )}
    </>
  );
};
