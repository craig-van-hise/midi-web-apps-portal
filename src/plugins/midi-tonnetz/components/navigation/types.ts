export type ButtonId = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'UP_LEFT' | 'UP_RIGHT' | 'DOWN_LEFT' | 'DOWN_RIGHT' | 'PLAY' | 'HOME';
export interface ButtonConfig { stepSize: number; midiChannel: number; midiNote: number; }
export type ButtonConfigMap = Record<ButtonId, ButtonConfig>;
export interface GlobalSettings { listenMode: boolean; showDiagonals: boolean; showActions: boolean; }
export type ContextMenuType = { type: 'BUTTON'; x: number; y: number; buttonId: ButtonId } | { type: 'GLOBAL'; x: number; y: number } | null;
export interface LearnState { isActive: boolean; currentButtonIndex: number; sequence: ButtonId[]; }
