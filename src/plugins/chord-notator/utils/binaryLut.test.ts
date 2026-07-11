import { describe, it, expect, vi } from 'vitest';
import { fetchBinaryLUT } from './binaryLut';

describe('binaryLut TDD Tests', () => {
    it('Test Case 1 & 2: parses the PLUT buffer correctly', async () => {
        // Prepare mock string pool
        const mockStringPool = [
            "unused0", "unused1", "unused2", "unused3", // 0-3
            "unused4", "unused5", "unused6", "unused7", // 4-7
            "unused8", "unused9", "unused10", "unused11", // 8-11
            "unused12", "unused13", "unused14", "unused15", // 12-15
            "Major 7th", // 16 (chordTypeIdx)
            "Major", // 17 (baseTriadIdx)
            "R", "3", "5", "7" // 18, 19, 20, 21 (chordIntervals)
        ];
        const stringPoolJson = JSON.stringify(mockStringPool);
        const encoder = new TextEncoder();
        const stringPoolBytes = encoder.encode(stringPoolJson);

        // Header:
        // 0-3: Magic 'PLUT'
        // 4-7: stringPoolOffset (uint32)
        // 8-11: rowsCount (uint32)
        // 12-15: rowOffset for row 0 (uint32)
        
        const rowOffset = 16;
        const stringPoolOffset = rowOffset + 64 + (4 * 2) + (0 * 2) + (0 * 2) + 4; // 16 + 64 + 8 + 4 = 92
        
        const totalSize = stringPoolOffset + stringPoolBytes.length;
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);

        // Set Magic
        dataView.setUint8(0, 0x50); // P
        dataView.setUint8(1, 0x4C); // L
        dataView.setUint8(2, 0x55); // U
        dataView.setUint8(3, 0x54); // T

        dataView.setUint32(4, stringPoolOffset, true);
        dataView.setUint32(8, 1, true); // rowsCount = 1
        dataView.setUint32(12, rowOffset, true); // rowOffset = 16

        // Write row at rowOffset = 16
        // decimal = 42 (uint32) at +0
        dataView.setUint32(rowOffset + 0, 42, true);
        // root_pc = 3 (uint8) at +4
        dataView.setUint8(rowOffset + 4, 3);
        // cardinality = 4 (uint8) at +5
        dataView.setUint8(rowOffset + 5, 4);

        // chord_type index = 16 (uint16) at +16
        dataView.setUint16(rowOffset + 16, 16, true);
        // base_triad index = 17 (uint16) at +20
        dataView.setUint16(rowOffset + 20, 17, true);

        // Variable length array counts
        // chordIntervalsLen = 4 (uint8) at +44
        dataView.setUint8(rowOffset + 44, 4);
        // rotatedIntervalsLen = 0 (uint8) at +45
        dataView.setUint8(rowOffset + 45, 0);
        // scaleIntervalsLen = 0 (uint8) at +46
        dataView.setUint8(rowOffset + 46, 0);
        // pitchClassSetLen = 4 (uint8) at +47
        dataView.setUint8(rowOffset + 47, 4);

        // Variable data block starts at rowOffset + 64
        // Write chord_intervals (4 elements of uint16: index 18, 19, 20, 21)
        dataView.setUint16(rowOffset + 64 + 0, 18, true);
        dataView.setUint16(rowOffset + 64 + 2, 19, true);
        dataView.setUint16(rowOffset + 64 + 4, 20, true);
        dataView.setUint16(rowOffset + 64 + 6, 21, true);

        // Skip rotatedIntervals and scaleIntervals (both 0 length, so 0 bytes skipped)
        // Write pitch_class_set (4 elements of uint8: 0, 4, 7, 11)
        const pcsOffset = rowOffset + 64 + (4 * 2); // 16 + 64 + 8 = 88
        dataView.setUint8(pcsOffset + 0, 0);
        dataView.setUint8(pcsOffset + 1, 4);
        dataView.setUint8(pcsOffset + 2, 7);
        dataView.setUint8(pcsOffset + 3, 11);

        // Write String Pool bytes
        new Uint8Array(buffer, stringPoolOffset, stringPoolBytes.length).set(stringPoolBytes);

        // Mock global fetch
        const mockResponse = {
            arrayBuffer: async () => buffer
        };
        vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as Response);

        const rows = await fetchBinaryLUT('/mock-lut.dat');
        
        // Assertions
        const entry = rows[42];
        expect(entry).not.toBeNull();
        expect(entry?.decimal).toBe(42);
        expect(entry?.root_pc).toBe(3);
        expect(entry?.cardinality).toBe(4);
        
        // Test Case 1: Assert chord_type maps to the string at index 16
        expect(entry?.chord_type).toBe("Major 7th");
        expect(entry?.base_triad).toBe("Major");
        
        // Test Case 2: Assert chord_intervals extracts exactly chordIntervalsLen items starting from offset 64
        expect(entry?.chord_intervals).toEqual(["R", "3", "5", "7"]);
        
        // Pitch class set check
        expect(entry?.pitch_class_set).toEqual([0, 4, 7, 11]);

        vi.restoreAllMocks();
    });
});
