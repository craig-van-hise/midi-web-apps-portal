
export type ButtonId = 
  | 'UP' 
  | 'DOWN' 
  | 'LEFT' 
  | 'RIGHT' 
  | 'UP_LEFT' 
  | 'UP_RIGHT' 
  | 'DOWN_LEFT' 
  | 'DOWN_RIGHT' 
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
  showDiagonals: boolean;
  showActions: boolean;
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
