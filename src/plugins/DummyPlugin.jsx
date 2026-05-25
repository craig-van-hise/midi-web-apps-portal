import React, { useEffect, useState, useRef, useMemo } from 'react';
import throttle from 'lodash/throttle';

export default function DummyPlugin({
  midiBus,
  onMidiOut,
  isBypassed,
  showInfo,
  showSettings,
  triggerPanic
}) {
  const [logs, setLogs] = useState([]);
  const logsRef = useRef([]);

  const syncLogsUI = useMemo(() => throttle(() => {
    setLogs([...logsRef.current]);
  }, 32), []);

  useEffect(() => {
    return () => {
      syncLogsUI.cancel();
    };
  }, [syncLogsUI]);

  const processMidi = (data) => {
    // 1. Synchronous Outward Dispatch
    if (onMidiOut) {
      onMidiOut(data);
    }

    // 2. Throttled UI update
    logsRef.current = [`[MIDI IN] ${JSON.stringify(data)}`, ...logsRef.current.slice(0, 19)];
    syncLogsUI();
  };

  useEffect(() => {
    if (!midiBus || isBypassed) return;

    const handleMidiEvent = (e) => {
      const data = e.detail;
      processMidi(data);
    };

    midiBus.addEventListener('midi', handleMidiEvent);
    return () => midiBus.removeEventListener('midi', handleMidiEvent);
  }, [midiBus, isBypassed, onMidiOut]);

  useEffect(() => {
    if (triggerPanic !== undefined) {
      logsRef.current = [`[PANIC TRIGGERED] state=${triggerPanic}`, ...logsRef.current.slice(0, 19)];
      setLogs([...logsRef.current]);
    }
  }, [triggerPanic]);

  const handleTestNoteOn = () => {
    if (onMidiOut) {
      // Send note-on for middle C (60) with velocity 100 on channel 1
      onMidiOut([0x90, 60, 100]);
    }
  };

  const handleTestNoteOff = () => {
    if (onMidiOut) {
      // Send note-off for middle C (60) on channel 1
      onMidiOut([0x80, 60, 0]);
    }
  };

  return (
    <div className="p-6 bg-[#1a1c23] border border-zinc-800 rounded-lg text-zinc-300 max-w-lg mx-auto mt-10">
      <h2 className="text-lg font-bold text-white mb-4">VV | Dummy Plugin Test Harness</h2>
      
      <div className="space-y-3 text-sm">
        <div className="flex justify-between border-b border-zinc-800 pb-2">
          <span>Bypassed:</span>
          <span className={isBypassed ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
            {isBypassed ? 'TRUE' : 'FALSE'}
          </span>
        </div>
        <div className="flex justify-between border-b border-zinc-800 pb-2">
          <span>Show Info:</span>
          <span className={showInfo ? 'text-blue-400 font-bold' : 'text-zinc-500'}>
            {showInfo ? 'TRUE' : 'FALSE'}
          </span>
        </div>
        <div className="flex justify-between border-b border-zinc-800 pb-2">
          <span>Show Settings:</span>
          <span className={showSettings ? 'text-purple-400 font-bold' : 'text-zinc-500'}>
            {showSettings ? 'TRUE' : 'FALSE'}
          </span>
        </div>
        <div className="flex justify-between border-b border-zinc-800 pb-2">
          <span>Panic Count:</span>
          <span className="font-mono font-bold text-red-500">{triggerPanic}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleTestNoteOn}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm transition-colors"
        >
          Test Note On (C4)
        </button>
        <button
          onClick={handleTestNoteOff}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm transition-colors"
        >
          Test Note Off (C4)
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Event Logs</h3>
        <div className="bg-[#0f1015] p-3 rounded h-32 overflow-y-auto font-mono text-xs text-zinc-400 space-y-1">
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic">No events logged yet.</div>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
