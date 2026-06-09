import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PitchClassSet } from '../types';
import { PITCH_CLASS_NAMES } from '../constants';

interface TonnetzGridProps {
    activePitchClasses: PitchClassSet;
    i1: number; // X-axis interval
    i2: number; // Diagonal interval
    onNodeDown?: (noteIndex: number) => void;
    onNodeUp?: (noteIndex: number) => void;
}

const BASE_GRID_SIZE = 60; // Distance between nodes in pixels (at scale 1)
const NODE_RADIUS = 16;
const FONT_SIZE = 12;

const TonnetzGrid: React.FC<TonnetzGridProps> = ({ activePitchClasses, i1, i2, onNodeDown, onNodeUp }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pressedNodeRef = useRef<number | null>(null);

    // Viewport State
    const [offset, setOffset] = useState(() => {
        const initialZoom = 1.5;
        const u = { x: BASE_GRID_SIZE, y: 0 };
        const v = { x: BASE_GRID_SIZE * 0.5, y: -BASE_GRID_SIZE * Math.sqrt(3) / 2 };
        const q_c = 1/3; // Centroid of C (0,0), G (1,0), E (0,1)
        const r_c = 1/3;
        return {
            x: -(q_c * u.x + r_c * v.x) * initialZoom,
            y: -(q_c * u.y + r_c * v.y) * initialZoom
        };
    });
    const [zoom, setZoom] = useState(1.5);
    const [isDragging, setIsDragging] = useState(false);
    const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

    // --- GEOMETRY HELPERS ---

    // Basis Vectors (Visual)
    // u = (1, 0) * SIZE
    // v = (cos(-60), sin(-60)) * SIZE = (0.5, -0.866) * SIZE
    // We invert Y for canvas (Canvas +Y is down), so -60 degrees becomes +60 degrees visually if we treat UP as -Y.
    // However, strictly adhering to screen coords:
    // X-Axis: Right (1, 0)
    // Y-Axis: Top-Right. Top is -Y. Right is +X. So (+0.5, -0.866).
    const getBasis = useCallback(() => {
        const u = { x: BASE_GRID_SIZE, y: 0 };
        const v = { x: BASE_GRID_SIZE * 0.5, y: -BASE_GRID_SIZE * Math.sqrt(3) / 2 };
        return { u, v };
    }, []);

    // Map Grid(q, r) -> Screen(x, y)
    // P = Center + (q*u + r*v) * zoom + offset
    const gridToScreen = useCallback((q: number, r: number, width: number, height: number) => {
        const { u, v } = getBasis();
        const centerX = width / 2 + offset.x;
        const centerY = height / 2 + offset.y;
        
        const x = centerX + (q * u.x + r * v.x) * zoom;
        const y = centerY + (q * u.y + r * v.y) * zoom;
        return { x, y };
    }, [getBasis, offset, zoom]);

    // Map Screen(x, y) -> Grid(q, r) (Fractional)
    // Used for hit testing
    const screenToGrid = useCallback((sx: number, sy: number, width: number, height: number) => {
        const { u, v } = getBasis();
        const centerX = width / 2 + offset.x;
        const centerY = height / 2 + offset.y;

        // Apply inverse zoom and translation
        const dx = (sx - centerX) / zoom;
        const dy = (sy - centerY) / zoom;

        // Linear solve: 
        // dx = q*ux + r*vx
        // dy = q*uy + r*vy
        // Determinant = ux*vy - vx*uy
        const det = u.x * v.y - v.x * u.y;
        const q = (dx * v.y - dy * v.x) / det;
        const r = (u.x * dy - u.y * dx) / det;

        return { q, r };
    }, [getBasis, offset, zoom]);

    // Calculate Note Index at (q, r)
    const getNoteAt = useCallback((q: number, r: number) => {
        // Javascript modulo bug with negative numbers: ((n % m) + m) % m
        const raw = (0 + (q * i1) + (r * i2)) % 12;
        return (raw + 12) % 12;
    }, [i1, i2]);


    // --- RENDERING LOOP ---

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Setup Canvas
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Handle High DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // 2. Determine Visible Bounds
        // Transform screen corners to grid space to limit loops
        // We add a buffer to ensure we cover partially visible cells
        const corners = [
            screenToGrid(0, 0, width, height),
            screenToGrid(width, 0, width, height),
            screenToGrid(width, height, width, height),
            screenToGrid(0, height, width, height)
        ];

        let minQ = Math.floor(Math.min(...corners.map(c => c.q))) - 2;
        let maxQ = Math.ceil(Math.max(...corners.map(c => c.q))) + 2;
        let minR = Math.floor(Math.min(...corners.map(c => c.r))) - 2;
        let maxR = Math.ceil(Math.max(...corners.map(c => c.r))) + 2;

        // Safety limit to prevent infinite loops if math breaks or huge zoom out
        if (maxQ - minQ > 100) { maxQ = minQ + 100; }
        if (maxR - minR > 100) { maxR = minR + 100; }

        // --- LAYER 1: TRIANGLES (FILLED) ---
        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                const noteA = getNoteAt(q, r);
                const noteB = getNoteAt(q + 1, r);
                const noteC = getNoteAt(q, r + 1);
                
                // Screen coords
                const posA = gridToScreen(q, r, width, height);
                const posB = gridToScreen(q + 1, r, width, height);
                const posC = gridToScreen(q, r + 1, width, height);

                const aActive = activePitchClasses.has(noteA);
                const bActive = activePitchClasses.has(noteB);
                const cActive = activePitchClasses.has(noteC);

                // Up Triangle (A-B-C)
                // Actually in our skew coords: (q,r), (q+1,r), (q,r+1) form a triangle
                if (aActive && bActive && cActive) {
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Light Blue
                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);
                    ctx.lineTo(posC.x, posC.y);
                    ctx.closePath();
                    ctx.fill();
                }

                // Down Triangle needs vertex D(q+1, r+1)
                const noteD = getNoteAt(q + 1, r + 1);
                const posD = gridToScreen(q + 1, r + 1, width, height);
                const dActive = activePitchClasses.has(noteD);

                // Triangle (B-C-D)
                if (bActive && cActive && dActive) {
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(posB.x, posB.y);
                    ctx.lineTo(posC.x, posC.y);
                    ctx.lineTo(posD.x, posD.y);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        // --- LAYER 2: CONNECTIONS ---
        ctx.lineCap = 'round';
        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                const posA = gridToScreen(q, r, width, height);
                const posRight = gridToScreen(q + 1, r, width, height); // Horizontal
                const posUpRight = gridToScreen(q, r + 1, width, height); // Diagonal A
                // For the full hexagonal mesh, we also need Diagonal B from (q+1, r) to (q, r+1)
                // But typically drawing 3 lines per node A->Right, A->UpRight, Right->UpRight covers the grid
                
                // However, simple loop: Draw Horizontal and Diag A from current node.
                // Draw Diag B for the cell.
                
                const noteA = getNoteAt(q, r);
                const noteRight = getNoteAt(q + 1, r);
                const noteUpRight = getNoteAt(q, r + 1);

                const activeA = activePitchClasses.has(noteA);
                const activeRight = activePitchClasses.has(noteRight);
                const activeUpRight = activePitchClasses.has(noteUpRight);

                // Horizontal: (q,r) -> (q+1,r)
                ctx.beginPath();
                ctx.moveTo(posA.x, posA.y);
                ctx.lineTo(posRight.x, posRight.y);
                if (activeA && activeRight) {
                    ctx.strokeStyle = '#3B82F6';
                    ctx.lineWidth = 2 * zoom; // Scale line width slightly with zoom for visibility? No, prompt says 2. Let's keep fixed or subtle.
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = '#E5E7EB';
                    ctx.lineWidth = 1;
                }
                ctx.stroke();

                // Diagonal A: (q,r) -> (q, r+1)
                ctx.beginPath();
                ctx.moveTo(posA.x, posA.y);
                ctx.lineTo(posUpRight.x, posUpRight.y);
                if (activeA && activeUpRight) {
                    ctx.strokeStyle = '#3B82F6';
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = '#E5E7EB';
                    ctx.lineWidth = 1;
                }
                ctx.stroke();

                // Diagonal B: (q+1,r) -> (q, r+1) (Connects the other two)
                ctx.beginPath();
                ctx.moveTo(posRight.x, posRight.y);
                ctx.lineTo(posUpRight.x, posUpRight.y);
                if (activeRight && activeUpRight) {
                    ctx.strokeStyle = '#3B82F6';
                    ctx.lineWidth = 2;
                } else {
                    ctx.strokeStyle = '#E5E7EB';
                    ctx.lineWidth = 1;
                }
                ctx.stroke();
            }
        }

        // --- LAYER 3: NODES ---
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${FONT_SIZE}px Inter, sans-serif`;

        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                const note = getNoteAt(q, r);
                const isActive = activePitchClasses.has(note);
                const pos = gridToScreen(q, r, width, height);

                ctx.beginPath();
                ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
                
                if (isActive) {
                    ctx.fillStyle = '#3B82F6'; // Blue
                    ctx.fill();
                    // No Stroke
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillText(PITCH_CLASS_NAMES[note], pos.x, pos.y);
                } else {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#000000'; // Thick Black Stroke
                    ctx.stroke();
                    ctx.fillStyle = '#374151'; // Dark Grey Text
                    ctx.fillText(PITCH_CLASS_NAMES[note], pos.x, pos.y);
                }
            }
        }

    }, [activePitchClasses, i1, i2, gridToScreen, getNoteAt, screenToGrid, activePitchClasses, zoom]);

    // Animation Frame Loop
    useEffect(() => {
        let animationFrameId: number;
        const loop = () => {
            render();
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [render]);


    // --- EVENTS ---

    const handleWheel = (e: React.WheelEvent) => {
        if (e.metaKey || e.ctrlKey) {
            // Zoom
            e.preventDefault();
            const zoomSpeed = 0.001;
            const newZoom = Math.max(0.5, Math.min(3.0, zoom - e.deltaY * zoomSpeed));
            setZoom(newZoom);
        } else {
            // Pan
            e.preventDefault();
            setOffset(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canvasRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to Grid
        const { q, r } = screenToGrid(x, y, containerRef.current.clientWidth, containerRef.current.clientHeight);
        
        // Round to nearest integer node
        const nQ = Math.round(q);
        const nR = Math.round(r);

        // Check distance to center of that node to see if we actually clicked IT
        const pos = gridToScreen(nQ, nR, containerRef.current.clientWidth, containerRef.current.clientHeight);
        const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));

        if (dist <= NODE_RADIUS) {
            const noteIndex = getNoteAt(nQ, nR);
            pressedNodeRef.current = noteIndex;
            if (onNodeDown) {
                onNodeDown(noteIndex);
            }
        } else {
            setIsDragging(true);
            setLastMouse({ x: e.clientX, y: e.clientY });
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastMouse({ x: e.clientX, y: e.clientY });
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        if (pressedNodeRef.current !== null) {
            if (onNodeUp) {
                onNodeUp(pressedNodeRef.current);
            }
            pressedNodeRef.current = null;
        }
    };

    const handlePointerLeave = () => {
        setIsDragging(false);
        if (pressedNodeRef.current !== null) {
            if (onNodeUp) {
                onNodeUp(pressedNodeRef.current);
            }
            pressedNodeRef.current = null;
        }
    };

    return (
        <div 
            ref={containerRef} 
            className="w-full h-full cursor-move overflow-hidden relative"
            onWheel={handleWheel}
        >
            <canvas
                ref={canvasRef}
                className="block"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
            />
        </div>
    );
};

export default TonnetzGrid;