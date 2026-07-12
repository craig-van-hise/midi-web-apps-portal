import React from 'react';
import { useMidi } from '../midi/MIDIProvider';
import { getChordSpelling } from '../utils/chordSpeller';
import { TRANSFORMATION_SCHEMA } from './toolbar/TransformationsTypes';
import type { ButtonConfig, ButtonId } from './toolbar/TransformationsTypes';

// Absolute hardware tracking for keyswitches, immune to React lifecycle
const activeKeyswitchesTracker = new Set<number>();
if (typeof window !== 'undefined') {
    window.addEventListener('APP_BUTTON_PRESS_ON', (e: any) => {
        const note = e.detail?.midiNote;
        if (note !== undefined) {
            activeKeyswitchesTracker.add(note);
            updateKeyVisuals88(note, 'ks_active');
        }
    });
    window.addEventListener('APP_BUTTON_PRESS_OFF', (e: any) => {
        const note = e.detail?.midiNote;
        if (note !== undefined) {
            activeKeyswitchesTracker.delete(note);
            updateKeyVisuals88(note, '');
        }
    });
}

/**
 * 88-Key MIDI Keyboard (A0 to C8)
 * - Fixed sizing: 1248px wide (52 white keys @ 24px each)
 * - SPN Notation: Middle C (60) is C4
 * - Performance: Direct DOM manipulation via updateKeyVisuals88
 */

const WHITE_KEY_WIDTH = 18;
const WHITE_KEY_HEIGHT = 88;
const BLACK_KEY_WIDTH = 11;
const BLACK_KEY_HEIGHT = 56;

export const Piano88: React.FC = () => {
    const { dispatchVirtualMidi, lut, keySignature, selectedNotes, buttonConfigs, updateButtonConfig, clearMidiMapping } = useMidi() as any;

    const displayedPitches = React.useRef<Set<number>>(new Set());
    const currentSpellings = React.useRef<{ note: number; spelling: string }[]>([]);
    const pianoKeys = [];


    // Listen for MIDI messages to update spelled notes strip
    React.useEffect(() => {
        const handleMidi = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (!detail) return;

            if (detail.panic) {
                displayedPitches.current.clear();
                currentSpellings.current = [];
                updateSpelledNotesStrip([], selectedNotes);
                for (let n = 21; n <= 108; n++) updateKeyVisuals88(n, '');
                return;
            }

            // Only update visuals when NotationCanvas broadcasts the true computational state
            if (detail.refresh && lut.length > 0) {
                if (detail.notes) {
                    displayedPitches.current.clear();
                    const spelledData: { note: number; spelling: string }[] = [];
                    
                    detail.notes.forEach((n: any) => {
                        const pitch = typeof n === 'object' ? n.note : n;
                        displayedPitches.current.add(pitch);
                        
                        // Read directly from the NotationCanvas payload
                        if (typeof n === 'object' && n.spellingString) {
                            spelledData.push({ note: pitch, spelling: n.spellingString });
                        }
                    });
                    
                    spelledData.sort((a, b) => a.note - b.note);
                    
                    if (spelledData.length > 0) {
                        currentSpellings.current = spelledData;
                    } else {
                        // Fallback for empty state or legacy events
                        const pitches = Array.from(displayedPitches.current).sort((a, b) => a - b);
                        const spellings = getChordSpelling(pitches, keySignature, lut);
                        currentSpellings.current = pitches.map((p, i) => ({ note: p, spelling: spellings[i] }));
                    }
                    updateSpelledNotesStrip(currentSpellings.current, selectedNotes);
                }
                
                // Update the physical key highlights
                for (let n = 21; n <= 108; n++) {
                    const isActive = displayedPitches.current.has(n);
                    const isSelected = selectedNotes?.includes(n);
                    const isKsHeld = activeKeyswitchesTracker.has(n);

                    let color = '';
                    if (isKsHeld) color = 'ks_active';
                    else if (isSelected) color = '#aa3bff';
                    else if (isActive) color = '#3b82f6';

                    updateKeyVisuals88(n, color);
                }
            }
        };

        window.addEventListener('MIDI_MESSAGE_RECEIVED', handleMidi);
        return () => {
            window.removeEventListener('MIDI_MESSAGE_RECEIVED', handleMidi);
        };
    }, [lut, keySignature, selectedNotes]);

    // Ensure keyboard updates when selection changes, even without a MIDI event
    React.useEffect(() => {
        for (let n = 21; n <= 108; n++) {
            const isActive = displayedPitches.current.has(n);
            const isSelected = selectedNotes?.includes(n);
            let color = '';
            if (isSelected) color = '#aa3bff';
            else if (isActive) color = '#3b82f6';
            updateKeyVisuals88(n, color);
        }
        updateSpelledNotesStrip(currentSpellings.current, selectedNotes);
    }, [selectedNotes]);

    // Keep keyswitch badges updated when button configs (MIDI mappings) change
    React.useEffect(() => {
        const noteToConfigMap = new Map<number, any>();
        if (buttonConfigs) {
            Object.entries(buttonConfigs).forEach(([id, cfg]: [string, any]) => {
                if (cfg && cfg.midiNote !== -1) {
                    noteToConfigMap.set(cfg.midiNote, { ...cfg, id });
                }
            });
        }
        
        for (let note = 21; note <= 108; note++) {
            const configForNote = noteToConfigMap.get(note) || null;
            updateKeyswitchBadge(note, configForNote);
        }
    }, [buttonConfigs]);

    const handleKeyInteraction = (note: number, isDown: boolean, velocity: number = 100) => {
        if (isDown) {
            dispatchVirtualMidi(new Uint8Array([0x90, note, velocity]));
        } else {
            dispatchVirtualMidi(new Uint8Array([0x80, note, 0]));
        }
    };

    // Range: A0 (MIDI 21) to C8 (MIDI 108)
    for (let note = 21; note <= 108; note++) {
        const noteInOctave = note % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);

        if (!isBlack) {
            const hasRightBlack = [0, 2, 5, 7, 9].includes(noteInOctave) && (note + 1 <= 108);
            const isC = noteInOctave === 0;
            const octave = Math.floor(note / 12) - 1; 

            pianoKeys.push(
                <div
                    key={`w-${note}`}
                    id={`pk88-${note}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                    onDragEnter={(e) => { e.currentTarget.style.outline = '3px solid #aa3bff'; e.currentTarget.style.outlineOffset = '-3px'; }}
                    onDragLeave={(e) => { e.currentTarget.style.outline = ''; }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.outline = '';
                        try {
                            const data = JSON.parse(e.dataTransfer.getData('application/json'));
                            if (data.type === 'KEYSWITCH_DRAG' && data.buttonId) {
                                updateButtonConfig(data.buttonId, { midiNote: note });
                            }
                        } catch (err) {}
                    }}
                    onPointerDown={(e) => {
                        if (e.altKey) {
                            e.preventDefault();
                            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                            const assignedId = Object.keys(buttonConfigs).find(id => buttonConfigs[id]?.midiNote === note);
                            if (assignedId) clearMidiMapping(assignedId);
                            return; // Halt standard note triggering
                        }
                        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        const offsetY = e.nativeEvent.offsetY;
                        const height = (e.target as HTMLElement).clientHeight;
                        let vel = Math.floor((offsetY / height) * 127);
                        vel = Math.max(1, Math.min(127, vel)); // Clamp 1-127
                        handleKeyInteraction(note, true, vel);
                    }}
                    onPointerUp={() => handleKeyInteraction(note, false)}
                    onPointerLeave={() => handleKeyInteraction(note, false)}
                    style={{
                        width: `${WHITE_KEY_WIDTH}px`,
                        height: `${WHITE_KEY_HEIGHT}px`,
                        borderLeft: '1px solid #ccc',
                        borderRight: '1px solid #ccc',
                        borderBottom: '1px solid #ccc',
                        backgroundColor: '#fff',
                        position: 'relative',
                        boxSizing: 'border-box',
                        borderBottomLeftRadius: '3px',
                        borderBottomRightRadius: '3px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        flexShrink: 0
                    }}
                >
                    {hasRightBlack && (
                        <div
                            id={`pk88-${note + 1}`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
                            onDragEnter={(e) => { e.stopPropagation(); e.currentTarget.style.outline = '2px solid #aa3bff'; e.currentTarget.style.outlineOffset = '-2px'; }}
                            onDragLeave={(e) => { e.stopPropagation(); e.currentTarget.style.outline = ''; }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.style.outline = '';
                                try {
                                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                                    if (data.type === 'KEYSWITCH_DRAG' && data.buttonId) {
                                        updateButtonConfig(data.buttonId, { midiNote: note + 1 });
                                    }
                                } catch (err) {}
                            }}
                            onPointerDown={(e) => {
                                if (e.altKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                                    const targetNote = note + 1;
                                    const assignedId = Object.keys(buttonConfigs).find(id => buttonConfigs[id]?.midiNote === targetNote);
                                    if (assignedId) clearMidiMapping(assignedId);
                                    return; // Halt standard note triggering
                                }
                                e.stopPropagation();
                                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                                const offsetY = e.nativeEvent.offsetY;
                                const height = (e.target as HTMLElement).clientHeight;
                                let vel = Math.floor((offsetY / height) * 127);
                                vel = Math.max(1, Math.min(127, vel)); // Clamp 1-127
                                handleKeyInteraction(note + 1, true, vel);
                            }}
                            onPointerUp={(e) => { e.stopPropagation(); handleKeyInteraction(note + 1, false); }}
                            onPointerLeave={(e) => { e.stopPropagation(); handleKeyInteraction(note + 1, false); }}
                            style={{
                                position: 'absolute',
                                zIndex: 10,
                                top: 0,
                                right: '-5.5px', 
                                width: `${BLACK_KEY_WIDTH}px`,
                                height: `${BLACK_KEY_HEIGHT}px`,
                                backgroundColor: '#444', // Slightly darker gray for a more balanced look
                                borderBottom: '6px solid #000',
                                borderLeft: '1px solid #333',
                                borderRight: '1px solid #333',
                                borderTop: 'none',
                                borderBottomLeftRadius: '2px',
                                borderBottomRightRadius: '2px',
                                boxSizing: 'border-box'
                            }}
                        />
                    )}
                    {isC && (
                        <span style={{
                            fontSize: '8px',
                            fontFamily: 'sans-serif',
                            color: '#333',
                            marginBottom: '4px',
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}>
                            C{octave}
                        </span>
                    )}
                </div>
            );
        }
    }

    return (
        <div className="flex flex-col items-center gap-2">

            {/* Spelled Notes Strip - Tall version with zipper logic support */}
            <div 
                id="spelled-notes-strip"
                className="w-[936px] h-[30px] relative overflow-visible z-50 text-[10px] font-bold tracking-tight text-blue-500 dark:text-blue-400 pointer-events-none"
                style={{ 
                    fontFamily: "'Jost', sans-serif",
                    backgroundColor: 'rgba(59, 130, 246, 0.03)',
                    borderRadius: '2px',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    transition: 'background-color 0.1s ease, border-color 0.1s ease'
                }}
            >
                {/* Spelled notes will be injected here as absolute elements */}
            </div>

            <div className="piano-container flex justify-center bg-transparent z-[40]">
                <div
                    style={{
                        display: 'flex',
                        width: '936px', 
                        height: 'fit-content',
                        backgroundColor: '#ccc',
                        borderTop: '1px solid #ddd',
                        borderBottom: '1px solid #ccc',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                        position: 'relative',
                        borderRadius: '4px 4px 3px 3px',
                        overflow: 'hidden',
                        touchAction: 'none'
                    }}
                >
                    {pianoKeys}
                </div>
            </div>
        </div>
    );
};

/**
 * Updates visuals for the 88-key component via direct DOM access
 * This bypasses React reconciliation for 60fps performance.
 */
export const updateKeyVisuals88 = (note: number, color: string) => {
    const el = document.getElementById(`pk88-${note}`);
    if (!el) return;

    const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
    const ksColor = el.dataset.ksColor;
    
    // The function checks the hardware truth itself
    const isKsHeld = activeKeyswitchesTracker.has(note); 

    let finalColor = color;
    
    // ARMOR: If it's a keyswitch and it's physically held, FORCE IT ON.
    // This prevents rogue React effects from turning it off with a '' command.
    if (ksColor && isKsHeld) {
        finalColor = ksColor; 
    } else if (ksColor && color && color !== '') {
        finalColor = ksColor; // Allow standard UI clicks to trigger it
    }

    if (finalColor && finalColor !== '') {
        // ACTIVE STATE
        el.style.backgroundColor = finalColor;
        el.style.boxShadow = `inset 0 -5px 10px rgba(0,0,0,0.1), 0 0 12px ${finalColor}`;
        if (isBlack) {
            el.style.zIndex = '11';
            el.style.borderBottom = '1px solid #000';
            el.style.borderLeft = '1px solid #333';
            el.style.borderRight = '1px solid #333';
            if (ksColor) el.style.borderTop = `2px solid ${ksColor}`;
        }
    } else {
        // IDLE STATE
        if (ksColor) {
            el.style.backgroundColor = isBlack 
                ? `color-mix(in srgb, ${ksColor} 60%, #444444)` 
                : `color-mix(in srgb, ${ksColor} 45%, #ffffff)`;
            el.style.borderTop = `2px solid ${ksColor}`;
        } else {
            el.style.backgroundColor = isBlack ? '#444' : '#fff';
            el.style.borderTop = 'none';
        }
        el.style.boxShadow = 'none';
        if (isBlack) {
            el.style.zIndex = '10';
            el.style.borderBottom = '6px solid #000';
            el.style.borderLeft = '1px solid #333';
            el.style.borderRight = '1px solid #333';
        }
    }
};

/**
 * Updates the spelled notes strip via direct DOM access
 * Aligns labels horizontally and vertically with the keys.
 * Implements a Multi-Row Boundary Tracker to prevent text overlap.
 */
export const updateSpelledNotesStrip = (spellings: { note: number; spelling: string }[], selectedNotes?: number[]) => {
    const el = document.getElementById('spelled-notes-strip');
    if (!el) return;
    
    // Clear existing
    el.innerHTML = '';

    // Dynamically adjust container border/background to reflect active selection
    const hasSelection = spellings.some(data => selectedNotes?.includes(data.note));
    if (hasSelection) {
        el.style.backgroundColor = 'rgba(170, 59, 255, 0.03)';
        el.style.borderColor = 'rgba(170, 59, 255, 0.1)';
    } else {
        el.style.backgroundColor = 'rgba(59, 130, 246, 0.03)';
        el.style.borderColor = 'rgba(59, 130, 246, 0.1)';
    }

    // 5-Row Zipper Tracking with tight 14px vertical clearances
    const rowEdges = [-100, -100, -100, -100, -100];
    const rowPositions = ['15px', '1px', '29px', '-13px', '43px'];
    const PADDING = 2;

    spellings.forEach(data => {
        const x = getNoteX(data.note);
        
        // Approximate width based on character count (avg 6px per character for 10px Jost font)
        const approxWidth = data.spelling.length * 6 + PADDING;
        const leftEdge = x - (approxWidth / 2);
        const rightEdge = x + (approxWidth / 2);

        let assignedRow = -1;

        // 1. Try to find a row with no collision, prioritizing Bottom -> Top -> Middle
        for (let i = 0; i < rowEdges.length; i++) {
            if (leftEdge >= rowEdges[i]) {
                assignedRow = i;
                break;
            }
        }

        // 2. If all rows collide (extreme clusters), pick the row with the least overlap
        if (assignedRow === -1) {
            let minOverflow = Infinity;
            let bestRow = 0;
            for (let i = 0; i < rowEdges.length; i++) {
                const overflow = rowEdges[i] - leftEdge;
                if (overflow < minOverflow) {
                    minOverflow = overflow;
                    bestRow = i;
                }
            }
            assignedRow = bestRow;
        }

        // 3. Update the boundary edge tracker
        rowEdges[assignedRow] = rightEdge;

        const label = document.createElement('div');
        label.textContent = data.spelling;
        
        // Structure styling
        label.style.position = 'absolute';
        label.style.left = `${x}px`;
        label.style.top = rowPositions[assignedRow];
        label.style.transform = 'translate(-50%, -50%)';
        label.style.whiteSpace = 'nowrap';
        label.style.padding = '0px 2px'; // Tighter visual padding
        label.style.borderRadius = '2px';
        
        // Tailwind classes for contextual backgrounds to maintain legibility
        label.className = 'bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-[2px] transition-colors';
        
        // State styling
        const isSelected = selectedNotes?.includes(data.note);
        label.style.color = isSelected ? '#aa3bff' : '#3b82f6';
        if (isSelected) {
             label.style.fontWeight = '900';
             label.style.zIndex = '10';
        } else {
             label.style.zIndex = '5';
        }
        
        el.appendChild(label);
    });
};

/**
 * Helper to calculate the horizontal center of a MIDI note (21-108)
 */
const getNoteX = (note: number): number => {
    let whiteKeysBefore = 0;
    for (let n = 21; n < note; n++) {
        if (![1, 3, 6, 8, 10].includes(n % 12)) {
            whiteKeysBefore++;
        }
    }
    const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
    return isBlack ? (whiteKeysBefore * 18) : (whiteKeysBefore * 18 + 9);
};

const iconSvgMap: Record<string, string> = {
    ArrowUp: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    ArrowDown: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    Play: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    House: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
};

/**
 * Renders or removes a semantic badge overlay on a physical key
 */
export const updateKeyswitchBadge = (note: number, config: (ButtonConfig & { id: ButtonId }) | null) => {
    const el = document.getElementById(`pk88-${note}`);
    if (!el) return;

    // Strict DOM Cleanup: IMMEDIATELY remove any existing badges
    el.querySelectorAll('.ks-badge').forEach(b => b.remove());

    const isBlack = [1, 3, 6, 8, 10].includes(note % 12);

    if (!config || config.midiNote === -1 || !config.id) {
        delete el.dataset.ksColor;
        delete el.dataset.keyswitchColor;
        el.style.backgroundColor = isBlack ? '#444' : '#fff';
        el.style.borderTop = 'none';
        return;
    }

    const schema = TRANSFORMATION_SCHEMA[config.id];
    if (!schema) {
        delete el.dataset.ksColor;
        delete el.dataset.keyswitchColor;
        el.style.backgroundColor = isBlack ? '#444' : '#fff';
        el.style.borderTop = 'none';
        return;
    }

    const hex = schema.color;
    el.dataset.ksColor = hex;

    // Apply stronger color-mix background and top border
    el.style.backgroundColor = isBlack 
        ? `color-mix(in srgb, ${hex} 60%, #444444)` 
        : `color-mix(in srgb, ${hex} 45%, #ffffff)`;
    el.style.borderTop = `2px solid ${hex}`;

    // Create badge div (strictly 14px x 14px)
    const badge = document.createElement('div');
    badge.className = 'ks-badge';
    badge.style.position = 'absolute';
    badge.style.left = '50%';
    badge.style.transform = 'translateX(-50%)';
    badge.style.width = '14px';
    badge.style.height = '14px';
    badge.style.borderRadius = '50%';
    badge.style.backgroundColor = '#ffffff';
    badge.style.border = '1.5px solid #000';
    badge.style.color = '#000';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.zIndex = '20';
    badge.style.pointerEvents = 'none';

    if (isBlack) {
        badge.style.bottom = '4px';
        badge.style.top = 'auto';
    } else {
        badge.style.bottom = '12px';
        badge.style.top = 'auto';
    }

    const iconSvg = iconSvgMap[schema.icon];
    if (iconSvg) {
        badge.innerHTML = iconSvg;
    } else {
        badge.innerHTML = '';
    }

    el.appendChild(badge);
};

export default Piano88;
