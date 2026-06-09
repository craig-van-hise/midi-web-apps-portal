import { TriadDefinition } from "./types";

// Spelling Map
export const INTERVAL_TO_NOTE: Record<string, string> = {
    "1": "C", "b2": "Db", "2": "D", "#2": "D#", "b3": "Eb", "3": "E",
    "4": "F", "#4": "F#", "b5": "Gb", "5": "G", "#5": "G#",
    "b6": "Ab", "6": "A", "bb7": "A", "b7": "Bb", "7": "B"
};

export const PITCH_CLASS_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// Triad Definitions (i1 = X-axis interval, i2 = Diagonal interval)
// i1 = set[2], i2 = set[1]
export const TRIAD_TYPES: TriadDefinition[] = [
    { name: "Major", intervals: ["1", "3", "5"], set: [0, 4, 7] },
    { name: "Minor", intervals: ["1", "b3", "5"], set: [0, 3, 7] },
    { name: "Sus2", intervals: ["1", "2", "5"], set: [0, 2, 7] },
    { name: "Sus4", intervals: ["1", "4", "5"], set: [0, 5, 7] },
    { name: "Chromatic3", intervals: ["1", "b2", "2"], set: [0, 1, 2] },
    { name: "Phrygian3", intervals: ["1", "b2", "b3"], set: [0, 1, 3] },
    { name: "m(2, no5)", intervals: ["1", "2", "b3"], set: [0, 2, 3] },
    { name: "(b2, no5)", intervals: ["1", "b2", "3"], set: [0, 1, 4] },
    { name: "(2, no5)", intervals: ["1", "2", "3"], set: [0, 2, 4] },
    { name: "(#2, no5)", intervals: ["1", "#2", "3"], set: [0, 3, 4] },
    { name: "[b2, 4]", intervals: ["1", "b2", "4"], set: [0, 1, 5] },
    { name: "[2, 4]", intervals: ["1", "2", "4"], set: [0, 2, 5] },
    { name: "m(4, no5)", intervals: ["1", "b3", "4"], set: [0, 3, 5] },
    { name: "(4, no5)", intervals: ["1", "3", "4"], set: [0, 4, 5] },
    { name: "[b2, b5]", intervals: ["1", "b2", "b5"], set: [0, 1, 6] },
    { name: "[2, #4]", intervals: ["1", "2", "#4"], set: [0, 2, 6] },
    { name: "Diminished", intervals: ["1", "b3", "b5"], set: [0, 3, 6] },
    { name: "Italian Sixth", intervals: ["1", "3", "#4"], set: [0, 4, 6] },
    { name: "TT(4)", intervals: ["1", "4", "b5"], set: [0, 5, 6] },
    { name: "Augmented", intervals: ["1", "3", "#5"], set: [0, 4, 8] }
];