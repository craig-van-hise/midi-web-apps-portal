import { describe, it, expect } from 'vitest';
import { assignXLevels, type NotePosition } from './notationMath';

describe('Phase 1: Greedy X-Level Assignment Algorithm', () => {
    it('Test Case 1 (No Collision): C Major triad (C, E, G, ySteps: 0, 2, 4)', () => {
        const notes: NotePosition[] = [
            { ySteps: 0 },
            { ySteps: 2 },
            { ySteps: 4 }
        ];
        const result = assignXLevels(notes);
        expect(result[0].xLevel).toBe(0);
        expect(result[1].xLevel).toBe(0);
        expect(result[2].xLevel).toBe(0);
    });

    it('Test Case 2 (Standard Second): C and D (ySteps: 0, 1)', () => {
        const notes: NotePosition[] = [
            { ySteps: 0 },
            { ySteps: 1 }
        ];
        const result = assignXLevels(notes);
        // Sorted lowest to highest: C(0), D(1)
        expect(result[0].xLevel).toBe(0); // C
        expect(result[1].xLevel).toBe(1); // D
    });

    it('Test Case 3 (Cohemitonia / 3-Note Cluster): C, C#, and D (ySteps: 0, 0, 1)', () => {
        const notes: NotePosition[] = [
            { ySteps: 0, note: 60 }, // C
            { ySteps: 0, note: 61 }, // C#
            { ySteps: 1, note: 62 }  // D
        ];
        const result = assignXLevels(notes);
        const c = result.find(n => n.note === 60)!;
        const cs = result.find(n => n.note === 61)!;
        const d = result.find(n => n.note === 62)!;
        expect(c.xLevel).toBe(0);
        expect(cs.xLevel).toBe(0);
        expect(cs.isRightColumn).toBe(true);
        expect(d.xLevel).toBe(1);
    });

    it('Test Case 4 (Gap Recovery): C, D, F, G (ySteps: 0, 1, 3, 4)', () => {
        const notes: NotePosition[] = [
            { ySteps: 0 }, // C
            { ySteps: 1 }, // D
            { ySteps: 3 }, // F
            { ySteps: 4 }  // G
        ];
        const result = assignXLevels(notes);
        expect(result[0].xLevel).toBe(0); // C
        expect(result[1].xLevel).toBe(1); // D
        expect(result[2].xLevel).toBe(0); // F (No collision with C or D at level 0? Wait, F is 3, D is 1. 3-1=2. 2 > 1. So F can be at Level 0.)
        expect(result[3].xLevel).toBe(1); // G (Collides with F at level 0, so Level 1)
    });
});
