import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Info, Settings, Link as LinkIcon, Download } from 'lucide-react';

interface ProcessorState {
  bypass: boolean;
  inGain: number;
  threshold: number;
  ratio: number;
  knee: number;
  outGain: number;
  ccTarget?: number;
  isLearning?: boolean;
  floorAmount: number;
  ceilAmount: number;
}

function processMidi(val: number, paramT: number, paramR: number, paramK: number) {
  const x = val / 127;
  const T = paramT / 127;
  const K = paramK / 127;
  const invR = paramR >= 50.0 ? 0 : 1 / paramR;

  let y = 0;
  if (2 * (x - T) < -K) {
    y = x;
  } else if (2 * Math.abs(x - T) <= K && K > 0) {
    y = x + (invR - 1) * Math.pow(x - T + K / 2, 2) / (2 * K);
  } else {
    y = T + (x - T) * invR;
  }
  return y * 127;
}

function useDragHelper(
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
  isHorizontal = false
) {
  return (e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startPos = isHorizontal ? e.clientX : e.clientY;
    const startVal = value;
    const handleDrag = (eM: PointerEvent) => {
      const currentPos = isHorizontal ? eM.clientX : eM.clientY;
      let delta = startPos - currentPos;
      if (isHorizontal) delta = -delta;

      const step = (max - min) / 200;
      let newVal = startVal + delta * step;
      onChange(Math.max(min, Math.min(max, newVal)));
    };
    const handleDrop = (eUp: PointerEvent) => {
      try {
        target.releasePointerCapture(eUp.pointerId);
      } catch (err) {}
      target.removeEventListener('pointermove', handleDrag);
      target.removeEventListener('pointerup', handleDrop);
    };
    target.addEventListener('pointermove', handleDrag);
    target.addEventListener('pointerup', handleDrop);
  };
}

const displayRatio = (r: number) => (r >= 50 ? '∞:1' : `${r.toFixed(1)}:1`);
const displayDbGain = (g: number) => (g > 0 ? `+${Math.round(g)}` : Math.round(g).toString());
const displayInt = (v: number) => Math.round(v).toString();

const Knob = ({
  value,
  min,
  max,
  label,
  onChange,
  display,
  themeColor = '#00e5ff',
  size = 42
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (v: number) => void;
  display?: (v: number) => string;
  themeColor?: string;
  size?: number;
}) => {
  const handleDrag = useDragHelper(value, min, max, onChange, false);
  const percent = (value - min) / (max - min);

  return (
    <div className="flex flex-col items-center gap-[4px] select-none">
      <div 
        className="rounded-full border-[2px] border-[#111] relative shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_6px_rgba(0,0,0,0.3)] cursor-ns-resize"
        style={{ width: size, height: size, background: 'radial-gradient(circle at 30% 30%, #444, #222)' }}
        onPointerDown={handleDrag}
      >
         <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${ -135 + percent * 270 }deg)` }}>
            <div className="mx-auto w-[2px] rounded-full" style={{ backgroundColor: themeColor, height: size * 0.28, marginTop: size * 0.1 }} />
         </div>
      </div>
      <div className={`${size < 30 ? 'text-[7px]' : 'text-[9px]'} uppercase text-[#888] font-semibold leading-none mt-[2px]`}>{label}</div>
      <div className={`${size < 30 ? 'text-[8px]' : 'text-[10px]'} font-mono leading-none`} style={{ color: themeColor }}>{display ? display(value) : value.toFixed(0)}</div>
    </div>
  );
};

const VerticalMeter = React.forwardRef<
  HTMLDivElement,
  { label: string; inverted?: boolean; isGr?: boolean }
>(({ label, inverted, isGr }, ref) => {
  const gradientStyle = isGr ? { backgroundColor: '#ff9100' } : { backgroundImage: 'linear-gradient(to top, #00ff88, #eeff00, #ff3d00)' };
  return (
    <div className="flex flex-col items-center h-full w-[16px] justify-between">
      <div className="flex-1 w-[12px] bg-black rounded-[2px] relative overflow-hidden flex flex-col-reverse justify-start">
        <div
          ref={ref}
          className="w-full absolute"
          style={{
            height: '0%',
            top: inverted ? '0' : 'auto',
            bottom: inverted ? 'auto' : '0',
            ...gradientStyle
          }}
        />
      </div>
      <span className="text-[8px] text-[#666] uppercase text-center mt-1">{label}</span>
    </div>
  );
});

const ProcessorSection = ({
  type,
  title,
  params,
  updateParams,
  metersRefMap,
}: {
  type: 'velocity' | 'cc';
  title: string;
  params: ProcessorState;
  updateParams: (updates: Partial<ProcessorState>) => void;
  metersRefMap: Record<string, React.RefObject<HTMLDivElement>>;
}) => {
  const handleThreshDrag = useDragHelper(params.threshold, 0, 127, (v) => updateParams({ threshold: v }), true);

  const d = React.useMemo(() => {
    if (params.bypass) return 'M 0 127 L 127 0';
    let path = '';
    for (let x = 0; x <= 127; x += 4) {
      const stage1 = x + params.inGain;
      const y_comp = processMidi(stage1, params.threshold, params.ratio, params.knee);
      let y_out = Math.max(0, Math.min(127, y_comp + params.outGain));
      if (params.floorAmount > 0) {
        y_out = Math.max(y_out, Math.min(127, params.floorAmount));
      }
      if (params.ceilAmount < 127) {
        y_out = Math.min(y_out, Math.max(params.floorAmount, params.ceilAmount));
      }
      path += `${x === 0 ? 'M' : 'L'} ${x} ${127 - y_out} `;
    }
    return path;
  }, [params.bypass, params.threshold, params.ratio, params.knee, params.inGain, params.outGain, params.floorAmount, params.ceilAmount]);

  const themeColor = type === 'velocity' ? '#00e5ff' : '#4ade80';
  const titleColorClasses = type === 'velocity' ? 'text-[#00e5ff]' : 'text-[#4ade80]';

  const dotX_val = Math.max(0, Math.min(127, params.threshold - params.inGain));
  const dot_y_comp = processMidi(dotX_val + params.inGain, params.threshold, params.ratio, params.knee);
  const dotY_val = Math.max(0, Math.min(127, dot_y_comp + params.outGain));

  return (
    <div className={`bg-[#222] border border-[#333] rounded-[6px] w-[320px] sm:w-[480px] p-[16px] flex flex-col gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.7)] ${params.bypass ? 'opacity-80 shadow-none' : ''}`}>
      <div className="flex justify-between items-center border-b border-[#333] pb-2">
        <div className="flex items-center gap-2">
          <h2 className={`text-xs font-bold tracking-widest uppercase ${titleColorClasses}`}>{title}</h2>
          {type === 'cc' && (
            <>
              <select
                className="bg-[#121212] border border-[#444] text-[#4ade80] text-[11px] rounded-[2px] h-[20px] outline-none drop-shadow-md cursor-pointer"
                value={params.ccTarget ?? 1}
                onChange={(e) => updateParams({ ccTarget: parseInt(e.target.value) || 0 })}
              >
                {Array.from({ length: 128 }, (_, i) => {
                  let label = `${i}`;
                  if (i === 1) label += ' - Mod Wheel';
                  else if (i === 2) label += ' - Breath';
                  else if (i === 4) label += ' - Foot Pedal';
                  else if (i === 5) label += ' - Portamento';
                  else if (i === 7) label += ' - Volume';
                  else if (i === 10) label += ' - Pan';
                  else if (i === 11) label += ' - Expression';
                  else if (i === 64) label += ' - Sustain';
                  else if (i === 65) label += ' - Portamento';
                  else if (i === 71) label += ' - Resonance';
                  else if (i === 74) label += ' - Cutoff';
                  return (
                    <option key={i} value={i}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={() => updateParams({ isLearning: true })}
                className={`text-[8px] font-bold px-[6px] h-[20px] rounded-[2px] border transition-colors flex items-center leading-none ${
                  params.isLearning
                    ? 'bg-yellow-400 text-black border-yellow-400 animate-pulse'
                    : 'bg-transparent text-yellow-400 border-yellow-400 hover:bg-yellow-400/20'
                }`}
              >
                LEARN
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => updateParams({ bypass: !params.bypass })}
          className={`text-[9px] font-bold px-[8px] py-[2px] rounded-[2px] uppercase border transition-colors cursor-pointer ${
            params.bypass
              ? 'bg-[#ff3d00] text-white border-[#ff3d00]'
              : 'bg-[#333] text-[#666] border-[#444]'
          }`}
        >
          {params.bypass ? 'BYPASSED' : 'BYPASS'}
        </button>
      </div>

      <div className="flex gap-[15px] items-center justify-center">
        <div className="flex gap-[10px] h-[180px] p-[10px] bg-[#1a1a1a] rounded-[4px] border border-[#111]">
          <VerticalMeter label="IN" ref={metersRefMap.in as React.RefObject<HTMLDivElement>} />
          <VerticalMeter label="GR" ref={metersRefMap.gr as React.RefObject<HTMLDivElement>} inverted isGr />
          <VerticalMeter label="OUT" ref={metersRefMap.out as React.RefObject<HTMLDivElement>} />
        </div>

        <div className="w-[180px] h-[180px] aspect-square bg-[#121212] border border-[#444] relative rounded-sm overflow-hidden">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20% 20%' }} />
          <svg viewBox="0 0 127 127" className="w-full h-full overflow-visible absolute inset-0">
            {params.ceilAmount < 127 && (
              <line 
                x1="0" 
                y1={127 - params.ceilAmount} 
                x2="127" 
                y2={127 - params.ceilAmount} 
                stroke={themeColor} 
                strokeWidth="0.5" 
                strokeDasharray="2,2" 
                opacity="0.6"
                style={{ filter: params.bypass ? 'none' : `drop-shadow(0 0 4px ${themeColor})` }}
              />
            )}
            {params.floorAmount > 0 && (
              <line 
                x1="0" 
                y1={127 - params.floorAmount} 
                x2="127" 
                y2={127 - params.floorAmount} 
                stroke={themeColor} 
                strokeWidth="0.5" 
                strokeDasharray="2,2" 
                opacity="0.6"
                style={{ filter: params.bypass ? 'none' : `drop-shadow(0 0 4px ${themeColor})` }}
              />
            )}
            <path d={d} fill="none" stroke={params.bypass ? '#888' : themeColor} strokeWidth="1.5" strokeDasharray={params.bypass ? "4" : "0"} style={{ filter: params.bypass ? 'none' : `drop-shadow(0 0 4px ${themeColor})` }} />
          </svg>

          {!params.bypass && (
            <div
              className="w-[8px] h-[8px] rounded-full absolute -translate-x-1/2 -translate-y-1/2 cursor-ew-resize z-10"
              style={{
                left: `${(dotX_val / 127) * 100}%`,
                top: `${100 - (dotY_val / 127) * 100}%`,
                backgroundColor: themeColor,
                boxShadow: `0 0 10px ${themeColor}`
              }}
              onPointerDown={handleThreshDrag}
            />
          )}

          <div
            ref={metersRefMap.dot}
            className="absolute w-[8px] h-[8px] rounded-full bg-white shadow-[0_0_10px_#fff] -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-75"
            style={{ left: '0%', top: '100%' }}
          />
        </div>

        <div className="flex flex-col justify-between h-[180px]">
          <div className="flex flex-col items-center bg-[#1a1a1a] border border-[#222] p-1 rounded-[4px] w-full">
            <div className={`text-[7px] font-bold py-[2px] rounded-[2px] uppercase leading-none mb-1 px-2 ${params.ceilAmount < 127 ? 'text-black' : 'text-[#666]'}`} style={params.ceilAmount < 127 ? { backgroundColor: themeColor } : {}}>CEIL</div>
            <Knob value={params.ceilAmount} min={0} max={127} label="" onChange={(v) => updateParams({ ceilAmount: v })} display={displayInt} themeColor={themeColor} size={28} />
          </div>
          <div className="flex flex-col items-center bg-[#1a1a1a] border border-[#222] p-1 rounded-[4px] w-full">
            <div className={`text-[7px] font-bold py-[2px] rounded-[2px] uppercase leading-none mb-1 px-1 ${params.floorAmount > 0 ? 'text-black' : 'text-[#666]'}`} style={params.floorAmount > 0 ? { backgroundColor: themeColor } : {}}>FLOOR</div>
            <Knob value={params.floorAmount} min={0} max={127} label="" onChange={(v) => updateParams({ floorAmount: v })} display={displayInt} themeColor={themeColor} size={28} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-[15px] mt-2">
        <Knob value={params.inGain} min={-127} max={127} label="In Gain" onChange={(v) => updateParams({ inGain: v })} display={displayDbGain} themeColor={themeColor} />
        <Knob value={params.threshold} min={0} max={127} label="Threshold" onChange={(v) => updateParams({ threshold: v })} display={displayInt} themeColor={themeColor} />
        <Knob value={params.ratio} min={1} max={50} label="Ratio" onChange={(v) => updateParams({ ratio: v })} display={displayRatio} themeColor={themeColor} />
        <Knob value={params.knee} min={0} max={64} label="Knee" onChange={(v) => updateParams({ knee: v })} display={displayInt} themeColor={themeColor} />
        <Knob value={params.outGain} min={-127} max={127} label="Out Gain" onChange={(v) => updateParams({ outGain: v })} display={displayDbGain} themeColor={themeColor} />
      </div>
    </div>
  );
};

export default function MidiDynamics({
  midiIn,
  onMidiOut,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}: {
  midiIn: number[] | null;
  onMidiOut: (data: number[]) => void;
  isBypassed: boolean;
  showInfo: boolean;
  showSettings: boolean;
  triggerPanic: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setInfoOpen(showInfo); }, [showInfo]);
  useEffect(() => { setSettingsOpen(showSettings); }, [showSettings]);

  const [globalSettings, setGlobalSettings] = useState({
    midiChannel: 'all' as number | 'all',
    midiThru: true,
    ccSmoothing: false,
  });
  const globalSettingsRef = useRef(globalSettings);
  useEffect(() => {
    globalSettingsRef.current = globalSettings;
  }, [globalSettings]);

  const [params, setParams] = useState({
    link: false,
    velocity: { bypass: false, inGain: 0, threshold: 64, ratio: 2.0, knee: 0, outGain: 0, floorAmount: 0, ceilAmount: 127 } as ProcessorState,
    cc: { bypass: false, inGain: 0, threshold: 64, ratio: 2.0, knee: 0, outGain: 0, ccTarget: 1, isLearning: false, floorAmount: 0, ceilAmount: 127 } as ProcessorState,
  });

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const updateParams = (section: 'velocity' | 'cc', newVals: Partial<ProcessorState>) => {
    setParams((prev) => {
      const next = { ...prev };
      next[section] = { ...next[section], ...newVals };

      if (prev.link && section === 'velocity') {
        const linkedKeys = ['inGain', 'threshold', 'ratio', 'knee', 'outGain', 'floorAmount', 'ceilAmount'] as const;
        const updatesForCc: any = {};
        let hasLinkedUpdate = false;
        for (const k of linkedKeys) {
          if (k in newVals) {
            updatesForCc[k] = (newVals as any)[k];
            hasLinkedUpdate = true;
          }
        }
        if (hasLinkedUpdate) {
          next.cc = { ...next.cc, ...updatesForCc };
        }
      }
      return next;
    });
  };

  const sendMidiOut = useCallback((data: number[]) => {
    if (onMidiOut && !isBypassed) {
      onMidiOut(data);
    }
  }, [onMidiOut, isBypassed]);

  const metersData = useRef({
    vel: { in: 0, out: 0, gr: 0, dotX: 0, dotY: 0 },
    cc: { in: 0, out: 0, gr: 0, dotX: 0, dotY: 0 },
  });
  const activeNotes = useRef(0);
  const lastCcVal = useRef<{ [cc: number]: number }>({});

  const metersRefs = {
    velocity: {
      in: useRef<HTMLDivElement>(null),
      out: useRef<HTMLDivElement>(null),
      gr: useRef<HTMLDivElement>(null),
      dot: useRef<HTMLDivElement>(null),
    },
    cc: {
      in: useRef<HTMLDivElement>(null),
      out: useRef<HTMLDivElement>(null),
      gr: useRef<HTMLDivElement>(null),
      dot: useRef<HTMLDivElement>(null),
    },
  };

  const handlePanic = useCallback(() => {
    let ch = 0;
    const interval = setInterval(() => {
      const outStatus = 0x80 | ch;
      for (let note = 0; note <= 127; note++) {
        sendMidiOut([outStatus, note, 0]);
      }
      ch++;
      if (ch >= 16) {
        clearInterval(interval);
      }
    }, 10);
    
    activeNotes.current = 0;
    metersData.current.vel = { in: 0, out: 0, gr: 0, dotX: 0, dotY: 0 };
    metersData.current.cc = { in: 0, out: 0, gr: 0, dotX: 0, dotY: 0 };
  }, [sendMidiOut]);

  const handleMidiMessage = useCallback((midiData: number[]) => {
    const [statusByte, data1, data2] = midiData;
    const statusType = statusByte & 0xf0;
    const msgChannel = (statusByte & 0x0f) + 1;

    let outStatus = statusByte;
    let outData1 = data1;
    let outData2 = data2;

    const p = paramsRef.current;
    const gs = globalSettingsRef.current;
    
    if (gs.midiChannel !== 'all' && msgChannel !== gs.midiChannel) {
      if (gs.midiThru) {
        sendMidiOut(midiData);
      }
      return;
    }

    let isProcessed = false;
    let handledAsync = false;
    
    if (statusType === 0x90 || statusType === 0x80) {
      isProcessed = true;
      if (statusType === 0x80 || (statusType === 0x90 && data2 === 0)) {
        // Note Off
        activeNotes.current = Math.max(0, activeNotes.current - 1);
        if (activeNotes.current === 0) {
          metersData.current.vel = { in: 0, out: 0, gr: 0, dotX: 0, dotY: 0 };
        }
      } else if (statusType === 0x90 && data2 > 0) {
        // Note On
        activeNotes.current++;
        const val = data2;
        if (p.velocity.bypass) {
          metersData.current.vel = { in: val, out: val, gr: 0, dotX: val, dotY: val };
        } else {
          const stage1 = val + p.velocity.inGain;
          const stage2 = processMidi(stage1, p.velocity.threshold, p.velocity.ratio, p.velocity.knee);
          let outVal = Math.max(0, Math.min(127, Math.round(stage2 + p.velocity.outGain)));
          if (p.velocity.floorAmount > 0 && val > 0) {
            outVal = Math.max(outVal, p.velocity.floorAmount);
          }
          if (p.velocity.ceilAmount < 127) {
            outVal = Math.min(outVal, Math.max(p.velocity.floorAmount, p.velocity.ceilAmount));
          }
          outData2 = outVal;
          metersData.current.vel = { in: val, out: outVal, gr: stage1 - stage2, dotX: val, dotY: outVal };
        }
      }
    } else if (statusType === 0xb0) {
      // Control Change
      if (p.cc.isLearning) {
        updateParams('cc', { ccTarget: data1, isLearning: false });
        p.cc.ccTarget = data1; 
      }

      if (data1 === p.cc.ccTarget) {
        isProcessed = true;
        const val = data2;
        let outVal = val;
        if (p.cc.bypass) {
          metersData.current.cc = { in: val, out: val, gr: 0, dotX: val, dotY: val };
        } else {
          const stage1 = val + p.cc.inGain;
          const stage2 = processMidi(stage1, p.cc.threshold, p.cc.ratio, p.cc.knee);
          outVal = Math.max(0, Math.min(127, Math.round(stage2 + p.cc.outGain)));
          if (p.cc.floorAmount > 0 && val > 0) {
            outVal = Math.max(outVal, p.cc.floorAmount);
          }
          if (p.cc.ceilAmount < 127) {
            outVal = Math.min(outVal, Math.max(p.cc.floorAmount, p.cc.ceilAmount));
          }
          outData2 = outVal;
          metersData.current.cc = { in: val, out: outVal, gr: stage1 - stage2, dotX: val, dotY: outVal };
        }

        if (gs.ccSmoothing) {
          const startVal = lastCcVal.current[data1];
          if (startVal !== undefined && Math.abs(outVal - startVal) > 1) {
            handledAsync = true;
            const steps = 4;
            for (let i = 1; i <= steps; i++) {
              const stepVal = Math.round(startVal + (outVal - startVal) * (i / steps));
              setTimeout(() => {
                sendMidiOut([outStatus, outData1, stepVal]);
              }, i * 5);
            }
          }
        }
        lastCcVal.current[data1] = outVal;
      }
    }

    if (!isProcessed) {
      if (!gs.midiThru) return;
    }

    if (!handledAsync) {
      sendMidiOut([outStatus, outData1, outData2]);
    }
  }, [sendMidiOut]);

  // Wire incoming MIDI
  useEffect(() => {
    if (midiIn && midiIn.length > 0 && !isBypassed) {
      handleMidiMessage(midiIn);
    }
  }, [midiIn, handleMidiMessage, isBypassed]);

  // Wire panic trigger
  const initialPanicRef = useRef(true);
  useEffect(() => {
    if (initialPanicRef.current) {
      initialPanicRef.current = false;
      return;
    }
    handlePanic();
  }, [triggerPanic, handlePanic]);

  // Meter Animation Loop
  useEffect(() => {
    let afId: number;
    const loop = () => {
      const d = metersData.current;
      
      const vRefs = metersRefs.velocity;
      if (vRefs.in.current) vRefs.in.current.style.height = `${(Math.max(0, d.vel.in) / 127) * 100}%`;
      if (vRefs.out.current) vRefs.out.current.style.height = `${(Math.max(0, d.vel.out) / 127) * 100}%`;
      if (vRefs.gr.current) vRefs.gr.current.style.height = `${(Math.max(0, d.vel.gr) / 127) * 100}%`;
      if (vRefs.dot.current) {
        vRefs.dot.current.style.left = `${(d.vel.dotX / 127) * 100}%`;
        vRefs.dot.current.style.top = `${100 - (d.vel.dotY / 127) * 100}%`;
        vRefs.dot.current.style.opacity = activeNotes.current > 0 ? '1' : '0';
      }

      const cRefs = metersRefs.cc;
      if (cRefs.in.current) cRefs.in.current.style.height = `${(Math.max(0, d.cc.in) / 127) * 100}%`;
      if (cRefs.out.current) cRefs.out.current.style.height = `${(Math.max(0, d.cc.out) / 127) * 100}%`;
      if (cRefs.gr.current) cRefs.gr.current.style.height = `${(Math.max(0, d.cc.gr) / 127) * 100}%`;
      if (cRefs.dot.current) {
        cRefs.dot.current.style.left = `${(d.cc.dotX / 127) * 100}%`;
        cRefs.dot.current.style.top = `${100 - (d.cc.dotY / 127) * 100}%`;
        cRefs.dot.current.style.opacity = d.cc.dotX > 0 || d.cc.dotY > 0 ? '1' : '0';
      }

      afId = requestAnimationFrame(loop);
    };
    afId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(afId);
  }, []);

  const handleCloseInfo = () => {
    setInfoOpen(false);
  };

  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#121212] text-[#e0e0e0]">
      <section className="bg-[#1e1e1e] px-[24px] py-[10px] flex gap-[20px] items-center justify-center border-b border-black text-[11px] shrink-0">
          <button
            onClick={() => {
              setParams((p) => {
                const newLink = !p.link;
                if (newLink) {
                  return {
                    ...p,
                    link: newLink,
                    cc: {
                      ...p.cc,
                      inGain: p.velocity.inGain,
                      threshold: p.velocity.threshold,
                      ratio: p.velocity.ratio,
                      knee: p.velocity.knee,
                      outGain: p.velocity.outGain,
                      floorAmount: p.velocity.floorAmount,
                      ceilAmount: p.velocity.ceilAmount,
                    }
                  };
                }
                return { ...p, link: newLink };
              });
            }}
            className={`px-[12px] py-[4px] rounded-[20px] uppercase font-bold text-[10px] border transition-colors cursor-pointer ${
              params.link
                ? 'bg-[#00e5ff] text-black border-[#00e5ff]'
                : 'bg-[#333] border-[#444] text-[#eee]'
            }`}
          >
            Link Processors
          </button>
      </section>

      <main className="flex-1 bg-[radial-gradient(circle_at_center,_#2a2a2a_0%,_#09090b_100%)] flex flex-col md:flex-row gap-[24px] p-[15px] justify-center items-start overflow-y-auto">
          <ProcessorSection
            type="velocity"
            title="Velocity Dynamics"
            params={params.velocity}
            updateParams={(v) => updateParams('velocity', v)}
            metersRefMap={metersRefs.velocity}
          />
          <ProcessorSection
            type="cc"
            title="CC Dynamics"
            params={params.cc}
            updateParams={(v) => updateParams('cc', v)}
            metersRefMap={metersRefs.cc}
          />
      </main>

      <footer className="shrink-0 text-[9px] text-[#666] px-[24px] py-[8px] text-center border-t border-black bg-black uppercase tracking-wider">
        V1.2.0 • Built By Craig Van Hise • VirtualVirgin.net
      </footer>

      {infoOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-[6px] p-[24px] shadow-2xl max-w-sm w-full relative">
            <button
              onClick={handleCloseInfo}
              className="absolute top-4 right-4 text-[#888] hover:text-white cursor-pointer"
            >
              x
            </button>
            <h2 className="text-lg font-[800] mb-3 text-[#e0e0e0] flex items-center gap-2">
               Information
            </h2>
            <p className="text-[#aaa] text-sm mb-6 leading-relaxed">
              This application is a real-time Web MIDI Compressor/Limiter designed as an in-line processor transfer curve. It operates similarly to studio dynamics plugins, but specifically targets MIDI Velocity and Control Change (CC) data.
            </p>
            <div className="border-t border-[#333] pt-4">
              <p className="text-[10px] text-[#888] uppercase tracking-widest font-bold mb-2">Developed By</p>
              <p className="font-medium text-[#00e5ff] mb-4">Craig Van Hise</p>
              
              <div className="flex flex-col gap-3">
                <a href="https://www.virtualvirgin.net/" target="_blank" rel="noreferrer" className="text-sm px-4 py-2 bg-[#121212] border border-[#333] text-[#eee] rounded hover:border-[#00e5ff] transition-all flex items-center gap-2">
                   virtualvirgin.net
                </a>
                <a href="https://github.com/craig-van-hise" target="_blank" rel="noreferrer" className="text-sm px-4 py-2 bg-[#121212] border border-[#333] text-[#eee] rounded hover:border-[#00e5ff] transition-all flex items-center gap-2">
                   github.com/craig-van-hise
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-[6px] p-[24px] shadow-2xl max-w-sm w-full relative">
            <button
              onClick={handleCloseSettings}
              className="absolute top-4 right-4 text-[#888] hover:text-white focus:outline-none cursor-pointer"
            >
              x
            </button>
            <h2 className="text-lg font-[800] mb-6 text-[#e0e0e0] flex items-center gap-2">
               Settings
            </h2>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-widest text-[#888] font-bold">Input Channel</label>
                <select
                  value={globalSettings.midiChannel}
                  onChange={(e) => setGlobalSettings(s => ({ ...s, midiChannel: e.target.value === 'all' ? 'all' : parseInt(e.target.value) }))}
                  className="bg-[#121212] border border-[#444] text-[#eee] text-sm p-2 rounded-[3px] outline-none w-full cursor-pointer"
                >
                  <option value="all">OMNI (All Channels)</option>
                  {Array.from({ length: 16 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Channel {i + 1}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#555]">Process only data from this specific channel.</p>
              </div>

              <div className="flex justify-between items-center bg-[#121212] p-3 rounded-[4px] border border-[#222]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#eee]">Pass-Thru Unprocessed</span>
                  <span className="text-[10px] text-[#666]">Send non-targeted MIDI (Mod Wheel, Aftertouch) Thru.</span>
                </div>
                <button
                  onClick={() => setGlobalSettings(s => ({ ...s, midiThru: !s.midiThru }))}
                  className={`relative w-[40px] h-[22px] rounded-full transition-colors cursor-pointer ${globalSettings.midiThru ? 'bg-[#00e5ff]' : 'bg-[#333]'}`}
                >
                  <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${globalSettings.midiThru ? 'left-[20px]' : 'left-[2px]'}`} />
                </button>
              </div>

              <div className="flex justify-between items-center bg-[#121212] p-3 rounded-[4px] border border-[#222]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#eee]">CC Smoothing</span>
                  <span className="text-[10px] text-[#666]">Apply slight interpolation to CC steps.</span>
                </div>
                <button
                  onClick={() => setGlobalSettings(s => ({ ...s, ccSmoothing: !s.ccSmoothing }))}
                  className={`relative w-[40px] h-[22px] rounded-full transition-colors cursor-pointer ${globalSettings.ccSmoothing ? 'bg-[#4ade80]' : 'bg-[#333]'}`}
                >
                  <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${globalSettings.ccSmoothing ? 'left-[20px]' : 'left-[2px]'}`} />
                </button>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={handleCloseSettings}
                className="px-5 py-2 bg-[#333] hover:bg-[#444] text-white rounded transition-colors text-sm font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
