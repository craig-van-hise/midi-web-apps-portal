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

        const decimal = dataView.getUint32(rowOffset, true);
        const root_pc = dataView.getUint8(rowOffset + 4);
        const cardinality = dataView.getUint8(rowOffset + 5);
        const chordTypeIdx = dataView.getUint16(rowOffset + 6, true);
        const baseTriadIdx = dataView.getUint16(rowOffset + 8, true);

        // Calculate intervals
        // Find the next non-zero offset or the string pool offset to calculate interval count.
        
        let nextOffset = stringPoolOffset;
        for (let j = i + 1; j < rowsCount; j++) {
            const off = dataView.getUint32(12 + (j * 4), true);
            if (off !== 0) {
                nextOffset = off;
                break;
            }
        }
        
        const currentIntervalsCount = (nextOffset - (rowOffset + 10)) / 2;
        const chord_intervals: string[] = [];
        
        if (currentIntervalsCount > 0 && currentIntervalsCount < 24) { // Safety bound
            for (let k = 0; k < currentIntervalsCount; k++) {
                const idx = dataView.getUint16(rowOffset + 10 + (k * 2), true);
                if (idx < stringPool.length) {
                    chord_intervals.push(stringPool[idx]);
                }
            }
        }

        rows[decimal] = {
            decimal,
            chord_type: (chordTypeIdx < stringPool.length) ? stringPool[chordTypeIdx] : "",
            root_pc,
            cardinality,
            base_triad: (baseTriadIdx < stringPool.length) ? stringPool[baseTriadIdx] : "",
            base_7th: 0,
            chord_intervals,
            pitch_class_set: []
        };
    }

    return rows;
}
