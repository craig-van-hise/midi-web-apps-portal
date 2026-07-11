import type { PCS_Entry } from './chordSpeller';

export async function fetchBinaryLUT(url: string): Promise<(PCS_Entry | null)[]> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    // Header Check
    const magic = String.fromCharCode(
        dataView.getUint8(0),
        dataView.getUint8(1),
        dataView.getUint8(2),
        dataView.getUint8(3)
    );

    if (magic !== 'PLUT') {
        throw new Error('Invalid binary LUT format');
    }

    const stringPoolOffset = dataView.getUint32(4, true);
    const rowsCount = dataView.getUint32(8, true);

    // Decode String Pool
    const stringPoolBuffer = arrayBuffer.slice(stringPoolOffset);
    const decoder = new TextDecoder();
    const stringPool: string[] = JSON.parse(decoder.decode(stringPoolBuffer));

    const rows: (PCS_Entry | null)[] = new Array(4096).fill(null);

    for (let i = 0; i < rowsCount; i++) {
        const rowOffset = dataView.getUint32(12 + (i * 4), true);
        if (rowOffset === 0) continue;

        const decimal = dataView.getUint32(rowOffset + 0, true);
        const root_pc = dataView.getUint8(rowOffset + 4);
        const cardinality = dataView.getUint8(rowOffset + 5);
        
        // String Pool Indices
        const chordTypeIdx = dataView.getUint16(rowOffset + 16, true);
        const baseTriadIdx = dataView.getUint16(rowOffset + 20, true);

        // Variable Length Array Counts
        const chordIntervalsLen = dataView.getUint8(rowOffset + 44);
        const rotatedIntervalsLen = dataView.getUint8(rowOffset + 45);
        const scaleIntervalsLen = dataView.getUint8(rowOffset + 46);
        const pitchClassSetLen = dataView.getUint8(rowOffset + 47);

        // Variable Data Block starts at offset 64
        let cursor = rowOffset + 64;
        
        // 1. Read chord_intervals (uint16)
        const chord_intervals: string[] = [];
        for (let k = 0; k < chordIntervalsLen; k++) {
            const strIdx = dataView.getUint16(cursor, true);
            if (strIdx < stringPool.length) chord_intervals.push(stringPool[strIdx]);
            cursor += 2;
        }

        // 2. Skip rotated and scale intervals to advance cursor to pitch_class_set
        cursor += (rotatedIntervalsLen * 2) + (scaleIntervalsLen * 2);

        // 3. Read pitch_class_set (uint8)
        const pitch_class_set: number[] = [];
        for (let k = 0; k < pitchClassSetLen; k++) {
            pitch_class_set.push(dataView.getUint8(cursor));
            cursor += 1;
        }

        rows[decimal] = {
            decimal,
            chord_type: (chordTypeIdx < stringPool.length) ? stringPool[chordTypeIdx] : "",
            root_pc,
            cardinality,
            base_triad: (baseTriadIdx < stringPool.length) ? stringPool[baseTriadIdx] : "",
            base_7th: 0,
            chord_intervals,
            pitch_class_set
        };
    }

    return rows;
}
