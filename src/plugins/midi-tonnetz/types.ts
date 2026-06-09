export interface TriadDefinition {
    name: string;
    intervals: string[];
    set: number[];
}

export interface NoteCoordinate {
    q: number;
    r: number;
    noteIndex: number;
}

export type PitchClassSet = Set<number>;