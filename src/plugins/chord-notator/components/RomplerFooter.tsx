import React, { useState, useEffect, useRef } from 'react';
import { usePersistentState } from '../lib/usePersistentState';
import * as Tone from 'tone';
import { Power, Info, Settings, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { audioEngine } from '../audio/engine';
import { Knob } from './Knob';
import { VUMeter } from './VUMeter';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RomplerFooterProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function RomplerFooter({ isOpen, onToggle }: RomplerFooterProps) {
  const [power, setPower] = useState(true);
  const [instrument, setInstrument] = usePersistentState('rompler_instrument', 'piano');
  const [isLoading, setIsLoading] = useState(false);
  const [audioSuspendedWarning, setAudioSuspendedWarning] = useState(false);
  
  const [volume, setVolume] = usePersistentState('rompler_volume', -12);
  const [pan, setPan] = usePersistentState('rompler_pan', 0);
  const [reverbWet, setReverbWet] = usePersistentState('rompler_reverb_wet', 0.2);
  const [tuningOffset, setTuningOffset] = usePersistentState('rompler_tuning_offset', 0);
  const [midiChannel, setMidiChannel] = usePersistentState('rompler_midi_channel', 1);
  
  const [attack, setAttack] = usePersistentState('rompler_attack', 0.1);
  const [decay, setDecay] = usePersistentState('rompler_decay', 0.2);
  const [sustain, setSustain] = usePersistentState('rompler_sustain', 1.0);
  const [release, setRelease] = usePersistentState('rompler_release', 1.0);
  
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Handle Power
  useEffect(() => {
    if (power) {
      const start = async () => {
        setIsLoading(true);
        await audioEngine.init();
        await audioEngine.loadInstrument(instrument);
        audioEngine.setVolume(volume);
        audioEngine.setPan(pan);
        audioEngine.setReverbWet(reverbWet);
        audioEngine.setTuningOffset(tuningOffset);
        audioEngine.setAttack(attack);
        audioEngine.setDecay(decay);
        audioEngine.setSustain(sustain);
        audioEngine.setRelease(release);
        setIsLoading(false);
      };
      start();
    } else {
      audioEngine.releaseAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [power]); // Only run on power toggle

  // Handle Instrument change
  useEffect(() => {
    if (!power) return;
    const load = async () => {
      setIsLoading(true);
      await audioEngine.loadInstrument(instrument);
      audioEngine.setTuningOffset(tuningOffset);
      audioEngine.setAttack(attack);
      audioEngine.setDecay(decay);
      audioEngine.setSustain(sustain);
      audioEngine.setRelease(release);
      setIsLoading(false);
    };
    load();
  }, [instrument, power]);

  // Handle Knobs
  useEffect(() => { audioEngine.setVolume(volume); }, [volume]);
  useEffect(() => { audioEngine.setPan(pan); }, [pan]);
  useEffect(() => { audioEngine.setReverbWet(reverbWet); }, [reverbWet]);
  useEffect(() => { audioEngine.setTuningOffset(tuningOffset); }, [tuningOffset]);
  useEffect(() => { audioEngine.setAttack(attack); }, [attack]);
  useEffect(() => { audioEngine.setDecay(decay); }, [decay]);
  useEffect(() => { audioEngine.setSustain(sustain); }, [sustain]);
  useEffect(() => { audioEngine.setRelease(release); }, [release]);

  // Interaction Trap for Autoplay compliance
  useEffect(() => {
    const initTrap = async () => {
        if (!audioEngine.isInitialized && power) {
            try {
                await audioEngine.init();
                // Engine is now awake and ready
                setAudioSuspendedWarning(false);
            } catch (err) {
                console.error("Audio initialization failed:", err);
            }
        } else if (audioEngine.isInitialized && Tone.context.state !== 'running') {
            // Resume context if it was suspended
            await Tone.context.resume();
            setAudioSuspendedWarning(false);
        }
    };

    // Listen for first interaction anywhere on the document
    window.addEventListener('pointerdown', initTrap, { once: true });
    window.addEventListener('keydown', initTrap, { once: true });

    return () => {
        window.removeEventListener('pointerdown', initTrap);
        window.removeEventListener('keydown', initTrap);
    };
  }, [power]);

  // Channel Drag Logic
  const channelDragRef = useRef(false);
  const startYRef = useRef(0);
  const startChanRef = useRef(1);

  const handleMidiChanMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    channelDragRef.current = true;
    startYRef.current = e.clientY;
    startChanRef.current = midiChannel;

    const handleMouseMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const deltaY = startYRef.current - ev.clientY; // drag up -> increase
      const steps = Math.floor(deltaY / 10);
      let newChan = startChanRef.current + steps;
      if (newChan < 1) newChan = 1;
      if (newChan > 16) newChan = 16;
      setMidiChannel(newChan);
    };

    const handleMouseUp = () => {
      channelDragRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handlePanic = () => {
    if (power) {
      audioEngine.releaseAll();
    }
  };

  return (
    <motion.div 
      className="fixed bottom-0 left-0 w-full z-50 flex flex-col items-center"
      initial={false}
      animate={{ y: isOpen ? 0 : "100%" }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
    >
      {/* Toggle Tab */}
      <div 
        onClick={onToggle}
        className="absolute bottom-full left-0 h-8 px-6 bg-[#121213] text-white rounded-tr-lg rounded-tl-none cursor-pointer border-t border-r border-[#1e1e20] shadow-[0_-10px_20px_rgba(0,0,0,0.4)] flex items-center gap-2 hover:bg-[#1a1a1c] transition-colors"
      >
        <div className={cn("w-2 h-2 rounded-full", power ? "bg-[#00ff88] shadow-[0_0_8px_#00ff88]" : "bg-[#184a30]")} />
        <span className="text-[10px] font-black italic tracking-wider">ROMPLER</span>
        {isOpen ? <ChevronDown className="w-3 h-3 text-[#6b6b75]" /> : <ChevronUp className="w-3 h-3 text-[#6b6b75]" />}
      </div>

      {/* Main Unit */}
      <div className="w-full bg-[#121213] border-t border-[#1e1e20] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center">
        
        {/* Audio Suspended Warning */}
        <AnimatePresence>
          {audioSuspendedWarning && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute top-[-60px] left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded shadow-[0_10px_30px_rgba(255,0,0,0.4)] z-50 flex items-center gap-3 animate-bounce border border-red-400"
              >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-bold text-sm tracking-wide">ACTION REQUIRED: Click anywhere to enable audio!</span>
              </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-[900px] w-full flex flex-col items-stretch">
          
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#242426]">
            
            <div className="flex items-baseline gap-2">
              <h2 className="text-white font-black italic tracking-tighter text-xl">
                MIDI ROMPLER
              </h2>
              <span className="text-[#6b6b75] text-[10px] font-bold tracking-wider">V1.0</span>
            </div>

            <div className="flex items-center space-x-3">
              
              <button 
                onClick={() => setPower(!power)}
                className="w-8 h-8 bg-[#1a1a1c] border border-[#2a2a2e] rounded-md flex items-center justify-center hover:bg-[#222225] transition-colors shadow-inner active:scale-95"
              >
                <Power className={cn("w-4 h-4", power ? "text-[#00ff88]" : "text-[#184a30]")} />
              </button>

              <button 
                onClick={handlePanic}
                className="w-8 h-8 bg-[#1a1a1c] border border-[#2a2a2e] rounded-md flex items-center justify-center hover:bg-[#222225] transition-colors shadow-inner active:scale-95 group"
                title="MIDI Panic"
              >
                <AlertTriangle className="w-4 h-4 text-[#ff1744] opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>

              <button 
                onClick={() => setSettingsOpen(true)}
                className="w-8 h-8 bg-[#1a1a1c] border border-[#2a2a2e] rounded-md flex items-center justify-center hover:bg-[#222225] transition-colors shadow-inner active:scale-95"
              >
                <Settings className="w-4 h-4 text-[#8a8a93]" />
              </button>

              <button onClick={() => setInfoOpen(true)} className="w-8 h-8 bg-[#1a1a1c] border border-[#2a2a2e] rounded-md flex items-center justify-center hover:bg-[#222225] transition-colors shadow-inner active:scale-95">
                <Info className="w-4 h-4 text-[#8a8a93]" />
              </button>

            </div>
          </div>

          {/* Player Module Rack Surface */}
          <div className="relative p-4 flex items-center justify-center bg-[#121213]">
             <div className="w-full bg-[#242426] rounded-lg shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.05)] border border-[#333] relative flex px-6 pt-6 pb-6">
                
                {/* Screws */}
                <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#1a1a1c] to-[#0c0c0d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.5)] border border-[#111]" />
                <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#1a1a1c] to-[#0c0c0d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.5)] border border-[#111]" />
                <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#1a1a1c] to-[#0c0c0d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.5)] border border-[#111]" />
                <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#1a1a1c] to-[#0c0c0d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.5)] border border-[#111]" />

                <div className="w-full flex items-start justify-between z-10 gap-6">
                   
                   {/* Channel */}
                   <div className="flex flex-col flex-shrink-0">
                     <span className="mb-[12px] text-[9px] font-bold text-[#8a8a93] uppercase tracking-widest pl-1">
                       MIDI Channel
                     </span>
                     <div 
                       className="w-14 h-12 bg-[#0a0f0a] rounded border border-[#1a1c1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] flex items-center justify-center mb-2 cursor-ns-resize select-none"
                       onMouseDown={handleMidiChanMouseDown}
                     >
                        <span className="text-[#00ff88] font-mono text-xl tracking-wide drop-shadow-[0_0_8px_rgba(0,255,136,0.6)]">
                           {String(midiChannel).padStart(2, '0')}
                        </span>
                     </div>
                     <div className="flex justify-between w-14">
                        <button className="w-[26px] h-6 rounded border border-[#111] bg-[#1a1a1c] text-[#8a8a93] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#222225] active:scale-95 transition-all outline-none text-xs" onClick={() => setMidiChannel(Math.min(16, midiChannel + 1))}>+</button>
                        <button className="w-[26px] h-6 rounded border border-[#111] bg-[#1a1a1c] text-[#8a8a93] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),_0_2px_4px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#222225] active:scale-95 transition-all outline-none text-xs" onClick={() => setMidiChannel(Math.max(1, midiChannel - 1))}>-</button>
                     </div>
                   </div>

                   {/* Patch Name & Envelope */}
                   <div className="flex flex-col flex-1 min-w-[200px] relative">
                     <span className="mb-[12px] text-[9px] font-bold text-[#8a8a93] uppercase tracking-widest pl-1">
                       Instrument Patch
                     </span>
                     <div className="relative w-full h-10 bg-[#0a0f0a] rounded border border-[#1a1c1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] flex items-center px-4 group outline-none overflow-hidden hover:bg-[#0d140d] transition-colors">
                       <select 
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                         value={instrument}
                         onChange={e => setInstrument(e.target.value)}
                         disabled={isLoading || !power}
                       >
                         <option value="piano">PIANO</option>
                         <option value="electric-piano">ELECTRIC PIANO</option>
                         <option value="harp">HARP</option>
                         <option value="vibraphone">VIBRAPHONE</option>
                         <option value="strings">STRINGS</option>
                         <option value="celeste">CELESTE</option>
                         <option value="guitar-acoustic">ACOUSTIC GUITAR</option>
                         <option value="bass-electric">ELECTRIC BASS</option>
                       </select>
                       {isLoading ? (
                           <div className="flex items-center gap-2">
                             <Loader2 className="w-4 h-4 text-[#00ff88] animate-spin" />
                             <span className="text-[#00ff88] font-mono text-xs tracking-widest opacity-80">LOADING...</span>
                           </div>
                       ) : (
                           <span className="text-[#00ff88] font-mono text-sm tracking-[0.1em] drop-shadow-[0_0_8px_rgba(0,255,136,0.6)] uppercase select-none w-full flex justify-between items-center">
                              {instrument.replace('-', ' ')}
                              <ChevronDown className="w-4 h-4 opacity-60 text-[#00ff88]" />
                           </span>
                       )}
                     </div>

                     <div className="absolute top-full flex flex-row items-center gap-2 px-1 mt-2">
                       <Knob size={20} label="A" value={attack} min={0} max={2} onChange={setAttack} valueLabel={`${Math.round(attack * 100) / 100}s`} />
                       <Knob size={20} label="D" value={decay} min={0} max={2} onChange={setDecay} valueLabel={`${Math.round(decay * 100) / 100}s`} />
                       <Knob size={20} label="S" value={sustain} min={0} max={1} onChange={setSustain} valueLabel={`${Math.round(sustain * 100)}%`} />
                       <Knob size={20} label="R" value={release} min={0.1} max={5} onChange={setRelease} valueLabel={`${Math.round(release * 100) / 100}s`} />
                     </div>
                   </div>

                   {/* Knobs */}
                   <div className="flex items-center gap-4">
                     <Knob label="Volume" value={volume} min={-60} max={0} onChange={setVolume} valueLabel={`${volume.toFixed(0)} dB`} />
                     <Knob label="Pan" value={pan} min={-1} max={1} onChange={setPan} valueLabel={`${pan.toFixed(1)}`} />
                     <Knob label="Reverb" value={reverbWet} min={0} max={1} onChange={setReverbWet} valueLabel={`${reverbWet.toFixed(1)} MIX`} />
                   </div>

                   {/* Output Meter */}
                   <div className="flex items-center justify-center pl-2">
                     <VUMeter />
                   </div>

                </div>
             </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-5 py-4 bg-[#0c0c0e]">
             <div className="flex items-center gap-6">
                <div className="flex flex-col gap-0.5">
                   <span className="text-[#6b6b75] text-[9px] uppercase font-bold tracking-widest">Designer</span>
                   <span className="text-[#a0a0a8] text-xs">Craig Van Hise</span>
                </div>
                <div className="h-6 w-px bg-[#2a2a2e]" />
                <div className="flex flex-col gap-0.5">
                   <span className="text-[#6b6b75] text-[9px] uppercase font-bold tracking-widest">Audio Engine</span>
                   <span className="text-[#a0a0a8] text-xs">Tone.js v15.x</span>
                </div>
             </div>

             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className={cn("w-1.5 h-1.5 rounded-full", power ? "bg-[#00ff88] shadow-[0_0_8px_#00ff88]" : "bg-[#184a30]")} />
                   <span className={cn("text-[9px] font-bold tracking-widest uppercase", power ? "text-[#00ff88]" : "text-[#184a30]")}>
                      {power ? "Online" : "Offline"}
                   </span>
                </div>
                <span className="text-[#8a8a93] text-[10px] font-sans tracking-widest uppercase">
                   VIRTUALVIRGIN.NET
                </span>
             </div>
          </div>

        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
           <div className="bg-[#121213] border border-[#2a2a2e] p-8 rounded-lg max-w-sm w-full relative shadow-2xl">
             <h2 className="text-xl font-bold text-white mb-4 tracking-wider italic">MIDI ROMPLER</h2>
             <div className="space-y-4 text-sm text-[#8a8a93] leading-relaxed font-sans">
                <p>Created by <span className="text-white">Craig Van Hise</span></p>
                <div className="flex flex-col gap-1">
                   <a href="https://virtualvirgin.net" target="_blank" rel="noreferrer" className="text-[#00ff88] hover:underline">virtualvirgin.net</a>
                   <a href="https://github.com/craig-van-hise" target="_blank" rel="noreferrer" className="text-[#00ff88] hover:underline">github.com/craig-van-hise</a>
                </div>
                <div className="w-full h-px bg-[#2a2a2e] my-6"></div>

                <div className="mt-6">
                    <h3 className="text-sm font-bold text-white mb-3 tracking-widest uppercase">Credits & Attribution</h3>
                    <ul className="space-y-3 text-xs text-[#8a8a93] leading-relaxed">
                        <li>
                            <strong className="text-[#00ff88]">Tone.js Instruments:</strong> Acoustic Piano, Guitar, and Bass samples provided by <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">nbrosowsky</a>.
                        </li>
                        <li>
                            <strong className="text-[#00ff88]">smplr Library:</strong> Electric Piano, Harp, Vibraphone, and Celeste playback powered by <a href="https://github.com/danigb/smplr" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">smplr (danigb)</a>.
                        </li>
                        <li>
                            <strong className="text-[#00ff88]">MIDI.js Soundfonts:</strong> String Ensemble sample from MusyngKite, hosted by <a href="https://github.com/gleitz/midi-js-soundfonts" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">gleitz</a>.
                        </li>
                    </ul>
                </div>
             </div>
             <button 
               onClick={() => setInfoOpen(false)}
               className="mt-8 px-6 py-3 bg-[#1a1a1c] border border-[#2a2a2e] hover:bg-[#222225] text-white rounded font-bold uppercase tracking-widest text-xs transition-colors w-full"
             >
               Close
             </button>
           </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
           <div className="bg-[#121213] border border-[#2a2a2e] p-8 rounded-lg max-w-sm w-full relative shadow-2xl">
             <h2 className="text-xl font-bold text-white mb-6 tracking-wider italic">SETTINGS</h2>
             
             <div className="space-y-6">
                <div>
                   <label className="block text-[10px] uppercase tracking-widest text-[#8a8a93] font-bold mb-3">
                      Master Tuning Offset (cents)
                   </label>
                   <div className="flex items-center gap-4">
                     <input 
                       type="number" 
                       value={tuningOffset}
                       onChange={(e) => setTuningOffset(parseFloat(e.target.value) || 0)}
                       className="bg-[#0a0f0a] text-[#00ff88] px-3 py-2 rounded border border-[#1a1c1a] font-mono text-sm w-full outline-none focus:border-[#00ff88]/50"
                     />
                     <span className="text-[#6b6b75] text-xs font-mono w-12 shrink-0">{tuningOffset > 0 ? '+' : ''}{tuningOffset}</span>
                   </div>
                </div>
             </div>

             <button 
               onClick={() => setSettingsOpen(false)}
               className="mt-8 px-6 py-3 bg-[#1a1a1c] border border-[#2a2a2e] hover:bg-[#222225] text-white rounded font-bold uppercase tracking-widest text-xs transition-colors w-full"
             >
               Close
             </button>
           </div>
        </div>
      )}
    </motion.div>
  );
}
