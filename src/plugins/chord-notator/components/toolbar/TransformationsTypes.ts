
export type ButtonId = 
  | 'SEMI_UP' 
  | 'SEMI_DOWN' 
  | 'KEY_UP' 
  | 'KEY_DOWN' 
  | 'ROT_UP' 
  | 'ROT_DOWN' 
  | 'OCT_UP' 
  | 'OCT_DOWN' 
  | 'PLAY' 
  | 'HOME';

export interface ButtonConfig {
  stepSize: number; // 1-12
  midiChannel: number;
  midiNote: number;
}

export type ButtonConfigMap = Record<ButtonId, ButtonConfig>;

export interface GlobalSettings {
  listenMode: boolean;
}

export type ContextMenuType = 
  | { type: 'GLOBAL'; x: number; y: number }
  | { type: 'BUTTON'; x: number; y: number; buttonId: ButtonId }
  | null;

export interface LearnState {
  isActive: boolean;
  currentButtonIndex: number;
  sequence: ButtonId[];
}

// --- EVENT BUS TYPES ---

export interface AppTransformEventDetail {
  type: ButtonId;
  stepSize: number;
}

export interface AppHistoryEventDetail {
  action: 'HOME';
}

export interface AppPlayEventDetail {
  velocity: number;
}

export interface AppConfigUpdateEventDetail {
  configs: ButtonConfigMap;
}

declare global {
  interface WindowEventMap {
    'APP_TRANSFORM': CustomEvent<AppTransformEventDetail>;
    'APP_HISTORY': CustomEvent<AppHistoryEventDetail>;
    'APP_PLAY': CustomEvent<AppPlayEventDetail>;
    'APP_PLAY_ON': CustomEvent<AppPlayEventDetail>;
    'APP_PLAY_OFF': CustomEvent<void>;
    'APP_HOME_ON': CustomEvent<AppPlayEventDetail>;
    'APP_HOME_OFF': CustomEvent<void>;
    'APP_CONFIG_UPDATE': CustomEvent<AppConfigUpdateEventDetail>;
    'APP_BUTTON_PRESS_ON': CustomEvent<{ buttonId: ButtonId }>;
    'APP_BUTTON_PRESS_OFF': CustomEvent<{ buttonId: ButtonId }>;
  }
}
