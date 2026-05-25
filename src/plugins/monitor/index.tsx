import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Trash2, Activity, Settings, Info, X } from 'lucide-react';

const CHANNEL_COLORS = [
  '#FF0000', // Ch 1: Red
  '#FF6000', // Ch 2: Orange-Red
  '#FFBF00', // Ch 3: Amber/Gold
  '#DFFF00', // Ch 4: Lime-Yellow
  '#80FF00', // Ch 5: Chartreuse
  '#20FF00', // Ch 6: Bright Green
  '#00FF40', // Ch 7: Spring Green
  '#00FF9F', // Ch 8: Seafoam
  '#00FFFF', // Ch 9: Cyan
  '#009FFF', // Ch 10: Sky Blue
  '#0040FF', // Ch 11: Royal Blue
  '#2000FF', // Ch 12: Indigo
  '#8000FF', // Ch 13: Purple
  '#DF00FF', // Ch 14: Magenta
  '#FF00BF', // Ch 15: Deep Pink
  '#FF0060'  // Ch 16: Crimson/Rose
];

const STREAM_COLORS = [
  '#39ff14', // accent-green
  '#00d1ff', // accent-blue
  '#bd93f9', // accent-purple
  '#ffb86c', // accent-orange
  '#ff5555'  // accent-red
];

const TYPE_COLORS: Record<string, string> = {
  noteon: '#00d1ff',       // Cyan/Blue
  noteoff: '#0077ff',      // Darker Blue
  cc: '#39ff14',           // Neon Green
  pb: '#ff3b3b',           // Red
  aftertouch: '#ffb86c',   // Orange
  polypressure: '#ff77aa', // Pink
  pc: '#bd93f9',           // Purple
  sysex: '#f1fa8c',        // Yellow
  realtime: '#aaaaaa'      // Gray
};

type DataPoint = { t: number, val: number };
type Stream = { id: string, color: string, maxVal: number, data: DataPoint[] };
type ParsedMsg = {
  status: number, cmd: number, channel: number, typeId: string, typeName: string,
  val1: number | null, val2: number | null, dt: number, isNoteOn: boolean,
  isNoteOff: boolean, isContinuous: boolean, hex: string,
};

type ActiveNote = { 
  id: string; // e.g., `${channel}-${note}`
  ch: number; 
  note: number; 
  vel: number; 
  startT: number; 
  endT: number | null; 
};

export default function MidiMonitor({
  midiBus,
  onMidiOut,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}: {
  midiBus: EventTarget | null;
  onMidiOut: (data: number[]) => void;
  isBypassed: boolean;
  showInfo: boolean;
  showSettings: boolean;
  triggerPanic: number;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  
  const [timeWindow, setTimeWindow] = useState(5);
  const timeWindowRef = useRef(timeWindow);
  useEffect(() => { timeWindowRef.current = timeWindow; }, [timeWindow]);

  const [filters, setFilters] = useState({
    channels: Array.from({ length: 16 }, () => true),
    types: {
      noteon: true, noteoff: true, cc: true, pb: true, aftertouch: true,
      polypressure: true, pc: true, sysex: true, realtime: false,
    } as Record<string, boolean>
  });
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useEffect(() => { setIsInfoOpen(showInfo); }, [showInfo]);
  useEffect(() => { setIsSettingsOpen(showSettings); }, [showSettings]);

  const [middleC, setMiddleC] = useState('C4');
  const middleCRef = useRef(middleC);
  useEffect(() => { middleCRef.current = middleC; }, [middleC]);

  const [noteFormat, setNoteFormat] = useState('name');
  const noteFormatRef = useRef(noteFormat);
  useEffect(() => { noteFormatRef.current = noteFormat; }, [noteFormat]);

  const [hexMode, setHexMode] = useState(false);
  const hexModeRef = useRef(hexMode);
  useEffect(() => { hexModeRef.current = hexMode; }, [hexMode]);

  const [timeFormat, setTimeFormat] = useState('delta');
  const timeFormatRef = useRef(timeFormat);
  useEffect(() => { timeFormatRef.current = timeFormat; }, [timeFormat]);

  const [bufferSize, setBufferSize] = useState(1000);
  const bufferSizeRef = useRef(bufferSize);
  useEffect(() => { bufferSizeRef.current = bufferSize; }, [bufferSize]);

  const [graphInterpolation, setGraphInterpolation] = useState('smooth');
  const graphInterpolationRef = useRef(graphInterpolation);
  useEffect(() => { graphInterpolationRef.current = graphInterpolation; }, [graphInterpolation]);

  const [colorMode, setColorMode] = useState('channel');
  const colorModeRef = useRef(colorMode);
  useEffect(() => { colorModeRef.current = colorMode; }, [colorMode]);

  const [streamMode, setStreamMode] = useState<'controllers' | 'notes' | 'velocity'>('controllers');
  const streamModeRef = useRef<'controllers' | 'notes' | 'velocity'>('controllers');
  useEffect(() => { 
    streamModeRef.current = streamMode; 
  }, [streamMode]);

  // High-performance DOM Refs
  const ledgerContentRef = useRef<HTMLTableSectionElement>(null);
  const ledgerScrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const activeKeysRef = useRef<number[]>(new Array(128).fill(0));
  const streamsRef = useRef<Map<string, Stream>>(new Map());
  const notesRef = useRef<ActiveNote[]>([]);
  const messageCountRef = useRef(0);
  const lastMessageTimeRef = useRef(0);
  const isAutoScrollRef = useRef(true);
  const animationRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const totalPausedTimeRef = useRef<number>(0);
  const ledgerHistoryRef = useRef<ParsedMsg[]>([]);

  // Keyboard DOM manipulation
  const setKeyColor = useCallback((note: number, color: string) => {
    const el = document.getElementById(`piano-key-${note}`);
    if (el) {
      const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
      if (color) {
        el.style.backgroundColor = color;
        el.style.boxShadow = `0 0 15px ${color}`;
        if (isBlack) {
          el.style.border = '1px solid #1a1a1a';
          el.style.zIndex = '11';
        }
      } else {
        el.style.backgroundColor = '';
        el.style.boxShadow = '';
        if (isBlack) {
          el.style.border = '';
          el.style.zIndex = '';
        }
      }
    }

    const activeDisplay = document.getElementById('active-notes-display');
    if (activeDisplay) {
      const notesArray = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const active = [];
      const octaveOffset = middleCRef.current === 'C3' ? -2 : middleCRef.current === 'C5' ? 0 : -1;
      
      for (let i = 0; i < 128; i++) {
        if (activeKeysRef.current[i] > 0) {
          if (noteFormatRef.current === 'number') {
            active.push(hexModeRef.current ? `0x${i.toString(16).toUpperCase()}` : i.toString());
          } else {
            active.push(`${notesArray[i % 12]}${Math.floor(i / 12) + octaveOffset}`);
          }
        }
      }
      activeDisplay.textContent = active.length > 0 ? `Active Notes: ${active.join(', ')}` : 'Active Notes: None';
    }
  }, []);

  // Ledger DOM Appender
  const appendToLedger = useCallback((msg: ParsedMsg) => {
    if (!ledgerContentRef.current) return;
    
    const row = document.createElement('tr');
    row.className = 'border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]';
    
    const chStyle = msg.channel > 0 ? `color: ${CHANNEL_COLORS[msg.channel - 1]}` : 'color: var(--color-text-dim)';
    const chText = msg.channel > 0 ? msg.channel.toString() : '--';
    const typeColorHex = TYPE_COLORS[msg.typeId] || '#ffffff';
    
    const isSys = msg.status >= 0xF0;
    
    const formatVal = (val: number | null) => val === null ? '--' : hexModeRef.current ? `0x${val.toString(16).toUpperCase().padStart(2, '0')}` : val;
    
    let displayVal1: string | number = isSys ? msg.hex : formatVal(msg.val1);
    
    if (!isSys && msg.val1 !== null && (msg.typeId === 'noteon' || msg.typeId === 'noteoff' || msg.typeId === 'polypressure')) {
      if (noteFormatRef.current === 'name') {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = notes[msg.val1 % 12];
        const octaveOffset = middleCRef.current === 'C3' ? -2 : middleCRef.current === 'C5' ? 0 : -1;
        const octave = Math.floor(msg.val1 / 12) + octaveOffset;
        displayVal1 = `${noteName}${octave}`;
      }
    }

    const val2Content = isSys ? '' : `<td class="px-[8px] py-[4px] whitespace-nowrap overflow-hidden">${formatVal(msg.val2)}</td>`;
    
    const timeStr = timeFormatRef.current === 'absolute' 
      ? new Date().toISOString().substring(11, 23) 
      : `+${msg.dt.toFixed(1)}`;

    row.innerHTML = `
      <td style="${chStyle}" class="pl-[16px] pr-[8px] py-[4px] whitespace-nowrap overflow-hidden">${chText}</td>
      <td style="color: ${typeColorHex}" class="px-[8px] py-[4px] font-semibold whitespace-nowrap overflow-hidden">${msg.typeName}</td>
      <td class="px-[8px] py-[4px] whitespace-nowrap overflow-hidden ${isSys ? 'text-[10px] text-text-dim' : ''}" ${isSys ? 'colspan="2"' : ''}>${displayVal1}</td>
      ${val2Content}
      <td class="pl-[8px] pr-[16px] py-[4px] whitespace-nowrap overflow-hidden text-right text-text-dim">${timeStr}</td>
    `;
    
    ledgerContentRef.current.appendChild(row);
    messageCountRef.current++;
    
    if (messageCountRef.current > bufferSizeRef.current && ledgerContentRef.current.firstChild) {
      ledgerContentRef.current.removeChild(ledgerContentRef.current.firstChild);
      messageCountRef.current--;
    }
    
    if (isAutoScrollRef.current && ledgerScrollContainerRef.current) {
      ledgerScrollContainerRef.current.scrollTop = ledgerScrollContainerRef.current.scrollHeight;
    }

    // Keep history for CSV export
    ledgerHistoryRef.current.push(msg);
    if (ledgerHistoryRef.current.length > bufferSizeRef.current) {
      ledgerHistoryRef.current.shift();
    }
  }, []);

  // Main Event Handler
  const onMidiMessage = useCallback((data: number[], receivedTime: number) => {
    const virtualReceivedTime = receivedTime - totalPausedTimeRef.current;
    
    const status = data[0];
    const cmd = status >> 4;
    
    let channel = (status & 0x0f) + 1;
    let typeId = '';
    let typeName = '';
    let val1: number | null = data.length > 1 ? data[1] : null;
    let val2: number | null = data.length > 2 ? data[2] : null;
    let isContinuous = false;
    
    const hexStr = Array.from(data).map((b: any) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    if (status >= 0xF0) {
      channel = 0;
      if (status === 0xF0) { typeId = 'sysex'; typeName = 'SysEx'; }
      else if (status >= 0xF8) { typeId = 'realtime'; typeName = 'Realtime'; }
      else { typeId = 'sysex'; typeName = 'SysCommon'; }
      val1 = null; val2 = null;
    } else {
      switch (cmd) {
        case 0x8: typeId = 'noteoff'; typeName = 'Note Off'; break;
        case 0x9: typeId = val2 === 0 ? 'noteoff' : 'noteon'; typeName = val2 === 0 ? 'Note Off' : 'Note On'; break;
        case 0xA: typeId = 'polypressure'; typeName = 'Poly Aftertouch'; isContinuous = true; break;
        case 0xB: typeId = 'cc'; typeName = 'CC'; isContinuous = true; break;
        case 0xC: typeId = 'pc'; typeName = 'Prog Change'; val2 = null; break;
        case 0xD: typeId = 'aftertouch'; typeName = 'Aftertouch'; val2 = null; isContinuous = true; break;
        case 0xE: 
          typeId = 'pb'; typeName = 'Pitch Bend'; isContinuous = true;
          if (val1 !== null && val2 !== null) val1 = (val2 << 7) | val1;
          val2 = null;
          break;
      }
    }
    
    let dt = lastMessageTimeRef.current !== 0 ? virtualReceivedTime - lastMessageTimeRef.current : 0;
    lastMessageTimeRef.current = virtualReceivedTime;
    
    const msg: ParsedMsg = {
      status, cmd, channel, typeId, typeName, val1, val2, dt,
      isNoteOn: cmd === 0x9 && val2! > 0,
      isNoteOff: cmd === 0x8 || (cmd === 0x9 && val2 === 0),
      isContinuous, hex: hexStr
    };

    // Forward upstream if callback is registered and app is not bypassed
    if (onMidiOut && !isBypassed) {
      onMidiOut(data);
    }

    // 1. Note-Off Safety: Unconditional updates to Hardware UI
    if ((msg.typeId === 'noteon' || msg.typeId === 'noteoff') && msg.val1 !== null) {
      const note = msg.val1;
      if (msg.isNoteOn) {
        if (!isPausedRef.current && filtersRef.current.channels[msg.channel - 1] && filtersRef.current.types.noteon) {
          activeKeysRef.current[note] = msg.channel;
          let color = CHANNEL_COLORS[msg.channel - 1];
          if (colorModeRef.current === 'velocity' && msg.val2 !== null) {
            const v = msg.val2 / 127;
            color = `hsl(${240 + v * 120}, 100%, 50%)`; // Blue -> Purple -> Red heatmap
          }
          setKeyColor(note, color);
        }

        // Capture for Notes/Velocity Graph
        notesRef.current.push({
          id: `${msg.channel}-${note}`,
          ch: msg.channel,
          note: note,
          vel: msg.val2 || 0,
          startT: virtualReceivedTime,
          endT: null
        });
      } else if (msg.isNoteOff) {
        if (!isPausedRef.current && activeKeysRef.current[note]) {
          activeKeysRef.current[note] = 0;
          setKeyColor(note, '');
        }

        // Find matching note and set endT
        for (let i = notesRef.current.length - 1; i >= 0; i--) {
          const n = notesRef.current[i];
          if (n.ch === msg.channel && n.note === note && n.endT === null) {
            n.endT = virtualReceivedTime;
            break;
          }
        }
      }
    }

    // 2. Hard Stop for Graph/Ledger logic if UI paused
    if (isPausedRef.current) return;
    
    // 3. Smart Filters Check for Graph/Ledger
    if (msg.channel > 0 && !filtersRef.current.channels[msg.channel - 1]) return;
    if (!filtersRef.current.types[msg.typeId]) return;

    // 4. Update Ledger
    appendToLedger(msg);

    // 5. Update Continuous Streams Graph
    if (isContinuous && msg.channel > 0) {
      let streamId = '';
      let streamVal = 0;
      let maxVal = 127;
      
      if (msg.typeId === 'cc') { streamId = `CC${msg.val1}`; streamVal = msg.val2!; }
      else if (msg.typeId === 'polypressure') { streamId = `PP${msg.val1}`; streamVal = msg.val2!; }
      else if (msg.typeId === 'aftertouch') { streamId = `AT`; streamVal = msg.val1!; }
      else if (msg.typeId === 'pb') { streamId = `PB`; streamVal = msg.val1!; maxVal = 16383; }

      const id = `CH${msg.channel} ${streamId}`;
      let stream = streamsRef.current.get(id);
      
      if (!stream) {
        if (streamsRef.current.size >= 5) {
           let oldestId = null;
           let oldestLastTime = Infinity;
           for (const [sId, str] of streamsRef.current.entries()) {
              const lastTime = str.data.length > 0 ? str.data[str.data.length - 1].t : 0;
              if (lastTime < oldestLastTime) {
                 oldestLastTime = lastTime;
                 oldestId = sId;
              }
           }
           if (oldestId) streamsRef.current.delete(oldestId);
        }
        
        let color = TYPE_COLORS[msg.typeId] || '#ffffff';
        if (msg.typeId === 'cc') {
          const usedColors = new Set(Array.from(streamsRef.current.values()).map((s: any) => s.color));
          const availableColors = STREAM_COLORS.filter(c => !usedColors.has(c));
          color = availableColors.length > 0 ? availableColors[0] : STREAM_COLORS[streamsRef.current.size % STREAM_COLORS.length];
        }

        stream = { 
          id, maxVal, data: [],
          color: color
        };
        streamsRef.current.set(id, stream);
      }
      stream.data.push({ t: virtualReceivedTime, val: streamVal });
    }
  }, [appendToLedger, setKeyColor, onMidiOut, isBypassed]);

  // Wire incoming MIDI
  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiEvent = (e: Event) => {
      const data = (e as CustomEvent<number[]>).detail;
      onMidiMessage(data, performance.now());
    };

    midiBus.addEventListener('midi', handleMidiEvent);
    return () => midiBus.removeEventListener('midi', handleMidiEvent);
  }, [midiBus, onMidiMessage, isBypassed]);

  const handlePanic = () => {
    // Reset keys
    activeKeysRef.current.forEach((ch, note) => {
      if (ch > 0) {
        activeKeysRef.current[note] = 0;
        setKeyColor(note, '');
      }
    });
    // Clear streams and notes
    streamsRef.current.clear();
    notesRef.current = [];
    if (ledgerContentRef.current) ledgerContentRef.current.innerHTML = '';
    messageCountRef.current = 0;
    lastMessageTimeRef.current = 0;
    ledgerHistoryRef.current = [];
  };

  // Wire panic triggers
  const initialPanicRef = useRef(true);
  useEffect(() => {
    if (initialPanicRef.current) {
      initialPanicRef.current = false;
      return;
    }
    handlePanic();
  }, [triggerPanic]);

  // Cleanup active keys on unmount
  useEffect(() => {
    return () => {
      for (let i = 0; i < 128; i++) {
        const el = document.getElementById(`piano-key-${i}`);
        if (el) {
          el.style.backgroundColor = '';
          el.style.boxShadow = '';
        }
      }
    };
  }, []);

  // Canvas Render Loop
  useEffect(() => {
    const renderGraph = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationRef.current = requestAnimationFrame(renderGraph);
        return;
      }
      
      const ctx = canvas.getContext('2d')!;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const logicalWidth = rect.width;
      const logicalHeight = rect.height;

      if (canvas.width !== logicalWidth * dpr || canvas.height !== logicalHeight * dpr) {
        canvas.width = logicalWidth * dpr;
        canvas.height = logicalHeight * dpr;
        ctx.scale(dpr, dpr);
      } else {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale for clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      const w = logicalWidth;
      const h = logicalHeight;

      // Draw horizontal grids
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#2e2f36'; // border-color
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25); ctx.lineTo(w, h * 0.25);
      ctx.moveTo(0, h * 0.50); ctx.lineTo(w, h * 0.50);
      ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75);
      ctx.stroke();

      let rawNow = performance.now();
      if (isPausedRef.current) {
        if (!pauseStartRef.current) pauseStartRef.current = rawNow;
        rawNow = pauseStartRef.current;
      } else {
        if (pauseStartRef.current) {
          totalPausedTimeRef.current += rawNow - pauseStartRef.current;
          pauseStartRef.current = 0;
        }
      }
      const now = rawNow - totalPausedTimeRef.current;

      const windowMs = timeWindowRef.current * 1000;
      
      const streams = Array.from(streamsRef.current.values()) as Stream[];
      const padding = h * 0.05;
      const plotHeight = h * 0.90;

      const activeStreams: Stream[] = [];

      // Mode-specific Rendering Logic
      const mode = streamModeRef.current;

      if (mode === 'controllers') {
        for (const stream of streams) {
          let filtered = stream.data.filter(d => d.t > now - windowMs * 1.5);
          if (filtered.length === 0 && stream.data.length > 0) {
            filtered = [stream.data[stream.data.length - 1]];
          }
          stream.data = filtered;
          if (stream.data.length === 0) continue;

          activeStreams.push(stream);

          ctx.strokeStyle = stream.color;
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          let isFirst = true;
          let prevY = 0;

          for (let i = 0; i < stream.data.length; i++) {
            const d = stream.data[i];
            const x = ((d.t - (now - windowMs)) / windowMs) * w;
            const y = h - (d.val / stream.maxVal) * plotHeight - padding;

            if (isFirst) { 
              ctx.moveTo(x, y); 
              isFirst = false; 
            }
            else { 
              if (graphInterpolationRef.current === 'stepped') {
                ctx.lineTo(x, prevY);
                ctx.lineTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            prevY = y;
          }

          const lastData = stream.data[stream.data.length - 1];
          if (lastData.t <= now) {
            const endX = w;
            const endY = h - (lastData.val / stream.maxVal) * plotHeight - padding;
            ctx.lineTo(endX, endY);
          }
          ctx.stroke();
        }

        if (activeStreams.length > 0) {
          const padX = 8;
          const padY = 8;
          const itemH = 16;
          
          ctx.font = 'bold 10px monospace';
          let maxTextW = 0;
          for (const s of activeStreams) {
            const tw = ctx.measureText(s.id).width;
            if (tw > maxTextW) maxTextW = tw;
          }

          const legendW = maxTextW + padX * 2;
          const legendH = activeStreams.length * itemH + padY * 2;
          const legendX = 8;
          const legendY = 8;

          ctx.fillStyle = '#0a0a0b';
          ctx.beginPath();
          ctx.roundRect(legendX, legendY, legendW, legendH, 4);
          ctx.fill();
          
          ctx.strokeStyle = '#2e2f36';
          ctx.lineWidth = 1;
          ctx.stroke();

          let textY = legendY + padY + itemH / 2;
          ctx.textBaseline = 'middle';

          for (const s of activeStreams) {
            ctx.fillStyle = s.color;
            ctx.fillText(s.id, legendX + padX, textY);
            textY += itemH;
          }
        }
      } else if (mode === 'notes') {
        notesRef.current = notesRef.current.filter(n => !(n.endT !== null && n.endT < now - windowMs * 1.5));
        
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        for (const note of notesRef.current) {
          const startX = ((note.startT - (now - windowMs)) / windowMs) * w;
          const endT = note.endT === null ? now : note.endT;
          const endX = ((endT - (now - windowMs)) / windowMs) * w;
          const y = h - (note.note / 127) * plotHeight - padding;

          if (endX < 0 || startX > w) continue;

          ctx.strokeStyle = CHANNEL_COLORS[note.ch - 1];
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
        }
      } else if (mode === 'velocity') {
        notesRef.current = notesRef.current.filter(n => !(n.endT !== null && n.endT < now - windowMs * 1.5));
        
        ctx.lineWidth = 2;
        
        for (const note of notesRef.current) {
          const startX = ((note.startT - (now - windowMs)) / windowMs) * w;
          if (startX < 0 || startX > w) continue;

          const velH = (note.vel / 127) * plotHeight;
          const y = h - velH - padding;

          ctx.strokeStyle = `hsl(${240 + (note.vel / 127) * 120}, 100%, 50%)`;
          ctx.beginPath();
          ctx.moveTo(startX, h - padding);
          ctx.lineTo(startX, y);
          ctx.stroke();
        }
      }
      
      animationRef.current = requestAnimationFrame(renderGraph);
    };

    animationRef.current = requestAnimationFrame(renderGraph);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const handleTogglePause = () => {
    if (isPaused) {
      activeKeysRef.current.forEach((ch, note) => {
        if (ch > 0) {
          activeKeysRef.current[note] = 0;
          setKeyColor(note, '');
        }
      });
    }
    setIsPaused(!isPaused);
  };

  const handleClear = () => {
    if (ledgerContentRef.current) ledgerContentRef.current.innerHTML = '';
    messageCountRef.current = 0;
    lastMessageTimeRef.current = 0;
    streamsRef.current.clear();
    notesRef.current = [];
    ledgerHistoryRef.current = [];
  };

  const handleExportCSV = () => {
    const headers = ['CH', 'TYPE', 'DATA 1', 'DATA 2', 'TIME (Δ)'];
    const rows = ledgerHistoryRef.current.map(msg => [
      msg.channel > 0 ? msg.channel : '--',
      msg.typeName,
      msg.val1 === null ? '--' : msg.val1,
      msg.val2 === null ? '--' : msg.val2,
      msg.dt.toFixed(1)
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "midi-log.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScroll = (e: any) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    isAutoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 50;
  };

  // Pre-generate Piano Keys array (0 to 127)
  const pianoKeys = [];
  const keyboardOctaveOffset = middleC === 'C3' ? -2 : middleC === 'C5' ? 0 : -1;
  for (let note = 0; note < 128; note++) {
    const noteInOctave = note % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);
    
    if (!isBlack) {
      const hasRightBlack = [0, 2, 5, 7, 9].includes(noteInOctave) && (note + 1 < 128);
      const isC = noteInOctave === 0;
      const octave = Math.floor(note / 12) + keyboardOctaveOffset;
      
      pianoKeys.push(
        <div 
          key={`w-${note}`} 
          id={`piano-key-${note}`}
          className="flex-1 h-full border-r border-[#1a1a1a] bg-[#fdfdfd] relative min-w-[5px] sm:min-w-[8px] transition-colors duration-75 ease-out flex flex-col justify-end items-center"
        >
          {hasRightBlack && (
            <div 
               id={`piano-key-${note + 1}`}
               className="absolute z-10 bg-[#1a1a1a] w-[65%] max-w-[12px] h-[64%] top-0 right-0 translate-x-1/2 transition-colors duration-75 ease-out rounded-b-[1px]"
            />
          )}
          {isC && (
            <span className="text-[6px] sm:text-[8px] font-mono font-bold text-[#666] mb-[2px] sm:mb-[4px] pointer-events-none select-none">
              C{octave}
            </span>
          )}
        </div>
      );
    }
  }

  const typeLabels = [
    { id: 'noteon', label: 'NOTE ON', color: TYPE_COLORS['noteon'] },
    { id: 'noteoff', label: 'NOTE OFF', color: TYPE_COLORS['noteoff'] },
    { id: 'cc', label: 'CC', color: TYPE_COLORS['cc'] },
    { id: 'pb', label: 'PITCH BEND', color: TYPE_COLORS['pb'] },
    { id: 'aftertouch', label: 'CHAN AT', color: TYPE_COLORS['aftertouch'] },
    { id: 'polypressure', label: 'POLY AT', color: TYPE_COLORS['polypressure'] },
    { id: 'pc', label: 'PC', color: TYPE_COLORS['pc'] },
    { id: 'sysex', label: 'SYSEX', color: TYPE_COLORS['sysex'] },
    { id: 'realtime', label: 'CLOCK', color: TYPE_COLORS['realtime'] }
  ];

  return (
    <>
    <style>{`
      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border-color, #2e2f36); border-radius: 4px; border: 2px solid var(--color-bg-deep, #0a0a0b); }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-text-dim, #8e9299); }
      
      input[type=range] { -webkit-appearance: none; background: var(--color-border-color, #2e2f36); height: 4px; border-radius: 2px; outline: none; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: var(--color-accent-blue, #00d1ff); border-radius: 50%; cursor: pointer; transition: background 0.15s; }
      input[type=range]::-webkit-slider-thumb:hover { background: #55e6ff; }
    `}</style>
    <div className="h-screen w-screen bg-[#0a0a0b] text-[#e1e1e6] flex flex-col font-sans overflow-hidden">
      {/* CONTROL PANEL */}
      <header className="flex-none flex flex-col lg:flex-row gap-6 p-[8px_12px] md:p-[12px_20px] bg-[#151619] border-b border-[#2e2f36] z-20 h-auto">
          <div className="flex flex-col gap-2 w-full lg:w-[280px] shrink-0 justify-center">
              <div className="flex gap-2">
                <button 
                  onClick={handleTogglePause} 
                  className={`px-[12px] py-[6px] rounded text-[13px] font-semibold border flex items-center gap-[6px] outline-none transition-colors duration-150 cursor-pointer`}
                  style={{ 
                    borderColor: isPaused ? '#ff3b3b' : '#39ff14', 
                    color: isPaused ? '#ff3b3b' : '#39ff14',
                    backgroundColor: 'transparent'
                  }}
                >
                    {isPaused ? (
                       <>
                         <svg className="w-[12px] h-[12px] fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> 
                         RESUME
                       </>
                    ) : (
                       <>
                         <svg className="w-[12px] h-[12px] fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                         PAUSE
                       </>
                    )}
                </button>
                <button onClick={handleClear} className="bg-[#1c1d21] border border-[#2e2f36] text-[#e1e1e6] px-[12px] py-[6px] rounded text-[13px] outline-none cursor-pointer">
                    CLEAR DATA
                </button>
              </div>
          </div>

          <div className="flex flex-col flex-1">
              <div className="text-[10px] uppercase tracking-[0.05em] text-[#8e9299] font-bold mt-1">Channel Filters</div>
              <div className="flex flex-wrap gap-[6px] md:mt-[4px]">
                {Array.from({length: 16}).map((_, i) => (
                  <div 
                    key={i}
                    onClick={() => {
                      const newCh = [...filters.channels];
                      newCh[i] = !newCh[i];
                      setFilters({...filters, channels: newCh});
                    }}
                    className="text-[9px] py-[2px] w-[22px] shrink-0 border rounded-[2px] text-center cursor-pointer transition-colors"
                    style={filters.channels[i] ? { backgroundColor: '#1c1d21', borderColor: CHANNEL_COLORS[i], color: CHANNEL_COLORS[i] } : { backgroundColor: '#1c1d21', borderColor: '#2e2f36', color: '#e1e1e6' }}
                  >
                    {i + 1}
                  </div>
                ))}
            </div>
            
            <div className="text-[10px] uppercase tracking-[0.05em] text-[#8e9299] font-bold mt-3 max-md:hidden">Message Type Filters</div>
            <div className="flex gap-2 flex-wrap mt-[4px]">
              {typeLabels.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setFilters({...filters, types: {...filters.types, [t.id]: !filters.types[t.id]}});
                  }}
                  className="text-[9px] py-[2px] px-[6px] border rounded-[2px] text-center cursor-pointer transition-colors"
                  style={filters.types[t.id] ? {
                    borderColor: t.color,
                    color: t.color,
                    backgroundColor: '#1c1d21'
                  } : {
                    borderColor: '#2e2f36',
                    color: '#e1e1e6',
                    backgroundColor: '#1c1d21'
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          </div>
      </header>

      {/* MAIN BODY */}
      <main className="flex-1 flex flex-row gap-[1px] min-h-0 bg-[#2e2f36] relative z-10 overflow-x-auto overflow-y-hidden">
        {/* Left: Ledger Console */}
        <div className="flex-none flex flex-col bg-[#0a0a0b] border-r border-[#2e2f36] shrink-0 relative" style={{ flexBasis: 'max-content' }}>
          <div 
            ref={ledgerScrollContainerRef} 
            onScroll={handleScroll}
            className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar bg-[#0a0a0b] relative"
          >
            <table className="min-w-full w-max text-left border-collapse table-fixed" style={{ width: 'max-content' }}>
              <thead className="sticky top-0 bg-[#151619] z-10 text-[10px] text-[#8e9299] tracking-wider font-bold shadow-[0_1px_0_#2e2f36]">
                <tr>
                  <th className="py-[8px] pl-[16px] pr-[8px] overflow-hidden whitespace-nowrap" style={{ resize: 'horizontal', width: '45px', minWidth: '40px' }}>CH</th>
                  <th className="py-[8px] px-[8px] overflow-hidden whitespace-nowrap" style={{ resize: 'horizontal', width: '85px', minWidth: '60px' }}>TYPE</th>
                  <th className="py-[8px] px-[8px] overflow-hidden whitespace-nowrap" style={{ resize: 'horizontal', width: '75px', minWidth: '50px' }}>DATA 1</th>
                  <th className="py-[8px] px-[8px] overflow-hidden whitespace-nowrap" style={{ resize: 'horizontal', width: '75px', minWidth: '50px' }}>DATA 2</th>
                  <th className="py-[8px] pl-[8px] pr-[16px] overflow-hidden whitespace-nowrap text-right" style={{ resize: 'horizontal', width: '95px', minWidth: '70px' }}>{timeFormat === 'absolute' ? 'TIME (ABS)' : 'TIME (Δ)'}</th>
                </tr>
              </thead>
              <tbody 
                 ref={ledgerContentRef}
                 className="font-mono text-[11px] text-[#e1e1e6]"
              >
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Graph Monitor */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[30vh] bg-[#0a0a0b] p-[12px] md:p-[20px] relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-[12px]">
              <div className="flex items-center gap-4">
                <div className="text-[10px] uppercase tracking-[0.05em] text-[#8e9299] font-bold">Continuous Data Stream</div>
                <div className="flex bg-[#0a0a0b] rounded p-[2px] border border-[#2e2f36]">
                    <button onClick={() => setStreamMode('controllers')} className={`px-2 py-0.5 rounded text-[9px] uppercase transition-colors outline-none cursor-pointer ${streamMode === 'controllers' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299] hover:text-[#e1e1e6]'}`}>Controllers</button>
                    <button onClick={() => setStreamMode('notes')} className={`px-2 py-0.5 rounded text-[9px] uppercase transition-colors outline-none cursor-pointer ${streamMode === 'notes' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299] hover:text-[#e1e1e6]'}`}>Notes</button>
                    <button onClick={() => setStreamMode('velocity')} className={`px-2 py-0.5 rounded text-[9px] uppercase transition-colors outline-none cursor-pointer ${streamMode === 'velocity' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299] hover:text-[#e1e1e6]'}`}>Velocity</button>
                </div>
              </div>
              <div className="flex items-center gap-[12px] mt-2 sm:mt-0">
                  <span className="text-[10px] uppercase tracking-[0.05em] text-[#8e9299] font-bold">Window: {timeWindow}s</span>
                  <input 
                    type="range" 
                    min="1" max="10" 
                    value={timeWindow} 
                    onChange={(e) => setTimeWindow(Number(e.target.value))} 
                    className="w-[100px]"
                  />
              </div>
          </div>

          <div className="flex-1 flex flex-row relative min-h-0">
            {/* Y-Axis Labels */}
            <div className="w-[28px] flex-none flex flex-col justify-between items-end pr-[6px] py-[5%] text-[10px] text-[#8e9299] font-mono select-none">
              <span>127</span>
              <span>96</span>
              <span>64</span>
              <span>32</span>
              <span>0</span>
            </div>
            
            {/* Canvas Wrapper */}
            <div className="flex-1 border border-[#2e2f36] bg-black relative">
                <canvas ref={canvasRef} className="w-full h-full block absolute inset-0"></canvas>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER: Piano Roll Visualizer */}
      <footer className="flex-none h-[70px] sm:h-[100px] bg-[#151619] border-t border-[#2e2f36] pt-[6px] sm:pt-[10px] flex flex-col z-20">
        <div className="text-[10px] uppercase tracking-[0.05em] text-[#8e9299] font-bold ml-[20px] mb-[4px] max-sm:hidden">
            <span id="active-notes-display">Active Notes: None</span>
        </div>
        <div className="flex-1 flex px-[4px] bg-black">
          {pianoKeys}
        </div>
      </footer>

      {/* MODALS */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#151619] border border-[#2e2f36] rounded-lg shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2e2f36]">
              <h2 className="font-bold text-white tracking-widest text-[14px]">INFO</h2>
              <button onClick={() => setIsInfoOpen(false)} className="text-[#8e9299] hover:text-white transition-colors outline-none cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 text-sm text-[#8e9299] flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="text-white font-bold text-lg">MIDI MONITOR</div>
                <div className="text-[#00d1ff] font-mono text-xs">v1.0.0</div>
              </div>
              
              <div className="text-[#e1e1e6]">
                A high-performance web-based MIDI monitor and visualizer for debugging and performance analysis.
              </div>

              <div className="pt-4 border-t border-[#2e2f36]">
                <div className="text-[10px] uppercase font-bold tracking-wider mb-2">Developed By</div>
                <div className="text-white">Created by Craig Van Hise</div>
              </div>

              <div className="flex gap-4 pt-2">
                <a href="https://www.virtualvirgin.net/" target="_blank" rel="noreferrer" className="text-[#00d1ff] hover:underline">Website</a>
                <a href="https://github.com/craig-van-hise" target="_blank" rel="noreferrer" className="text-[#00d1ff] hover:underline">GitHub</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#151619] border border-[#2e2f36] rounded-lg shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#2e2f36]">
              <h2 className="font-bold text-white tracking-widest text-[14px]">SETTINGS</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-[#8e9299] hover:text-white transition-colors outline-none cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 text-sm text-[#8e9299] overflow-y-auto max-h-[80vh] custom-scrollbar">
              <div className="flex flex-col gap-8">
                {/* MIDI Interpretation */}
                <div>
                  <h3 className="text-[11px] font-bold text-[#00d1ff] uppercase tracking-wider mb-4">MIDI Interpretation</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Middle C Designation</span>
                      <select value={middleC} onChange={e => setMiddleC(e.target.value)} className="bg-[#0a0a0b] border border-[#2e2f36] text-[#e1e1e6] px-2 py-1.5 rounded text-[12px] outline-none cursor-pointer">
                        <option value="C3">C3 (Yamaha)</option>
                        <option value="C4">C4 (Roland / Default)</option>
                        <option value="C5">C5 (Cakewalk)</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Note Display Format</span>
                      <div className="flex bg-[#0a0a0b] rounded p-[3px] border border-[#2e2f36]">
                        <button onClick={() => setNoteFormat('name')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${noteFormat === 'name' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Names</button>
                        <button onClick={() => setNoteFormat('number')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${noteFormat === 'number' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Numbers</button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Hexadecimal Mode</span>
                      <div className="flex bg-[#0a0a0b] rounded p-[3px] border border-[#2e2f36]">
                        <button onClick={() => setHexMode(false)} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${!hexMode ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Decimal</button>
                        <button onClick={() => setHexMode(true)} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${hexMode ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Hex</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time & Logging */}
                <div>
                  <h3 className="text-[11px] font-bold text-[#39ff14] uppercase tracking-wider mb-4">Time & Logging</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Timestamp Format</span>
                      <div className="flex bg-[#0a0a0b] rounded p-[3px] border border-[#2e2f36]">
                        <button onClick={() => setTimeFormat('delta')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${timeFormat === 'delta' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Delta (Δ)</button>
                        <button onClick={() => setTimeFormat('absolute')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${timeFormat === 'absolute' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Absolute</button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">History Buffer Size</span>
                      <select value={bufferSize} onChange={e => setBufferSize(Number(e.target.value))} className="bg-[#0a0a0b] border border-[#2e2f36] text-[#e1e1e6] px-2 py-1.5 rounded text-[12px] outline-none cursor-pointer">
                        <option value={500}>500 Events</option>
                        <option value={1000}>1,000 Events</option>
                        <option value={5000}>5,000 Events</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1 pt-4 border-t border-[#2e2f36]">
                      <span className="font-medium text-white">Export Ledger Data</span>
                      <button onClick={handleExportCSV} className="bg-[#0a0a0b] hover:bg-[#1c1d21] border border-[#2e2f36] text-[#e1e1e6] px-3 py-1.5 rounded text-[12px] font-medium transition-colors outline-none cursor-pointer">
                        Export Log (.csv)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visuals */}
                <div>
                  <h3 className="text-[11px] font-bold text-[#bd93f9] uppercase tracking-wider mb-4">Visuals</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Graph Interpolation</span>
                      <div className="flex bg-[#0a0a0b] rounded p-[3px] border border-[#2e2f36]">
                        <button onClick={() => setGraphInterpolation('smooth')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${graphInterpolation === 'smooth' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Smooth</button>
                        <button onClick={() => setGraphInterpolation('stepped')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${graphInterpolation === 'stepped' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Stepped</button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Visualizer Color Mode</span>
                      <div className="flex bg-[#0a0a0b] rounded p-[3px] border border-[#2e2f36]">
                        <button onClick={() => setColorMode('channel')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${colorMode === 'channel' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Channel</button>
                        <button onClick={() => setColorMode('velocity')} className={`px-3 py-1 rounded text-[10px] uppercase transition-colors outline-none cursor-pointer ${colorMode === 'velocity' ? 'bg-[#1c1d21] text-white font-bold shadow-sm' : 'text-[#8e9299]'}`}>Velocity</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
