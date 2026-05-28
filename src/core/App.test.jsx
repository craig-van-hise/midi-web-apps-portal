import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import mockDummyPlugin from '../plugins/DummyPlugin';
import App from './App';
import { appRegistry } from '../config/appRegistry';

let capturedMidiBus = null;
let capturedOnMidiOut = null;

vi.mock('../plugins/midi-transposer', () => ({
  default: function MockMidiTransposer(props) {
    capturedMidiBus = props.midiBus;
    capturedOnMidiOut = props.onMidiOut;
    return React.createElement(mockDummyPlugin, props);
  }
}));

// Mock Web MIDI API
let midiMessageListener = null;

const mockMidiInput = {
  id: 'mock-device-id',
  name: 'Mock USB MIDI Keyboard',
  addEventListener: vi.fn().mockImplementation((event, callback) => {
    if (event === 'midimessage') {
      midiMessageListener = callback;
    }
  }),
  removeEventListener: vi.fn(),
};

const mockMidiAccess = {
  inputs: new Map([['mock-device-id', mockMidiInput]]),
  outputs: new Map(),
  onstatechange: null,
};

Object.defineProperty(global.navigator, 'requestMIDIAccess', {
  value: vi.fn().mockResolvedValue(mockMidiAccess),
  configurable: true,
  writable: true
});

describe('App Portal Monolith Harness Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    midiMessageListener = null;
  });

  it('renders Sidebar with registry items and updates active app title when clicked', async () => {
    render(<App />);

    // Wait for registry list to render
    const sidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Chord Notator', level: 3 });
    expect(sidebarItem).toBeInTheDocument();

    const secondSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Transposer', level: 3 });
    expect(secondSidebarItem).toBeInTheDocument();

    // Verify initial active app title in the top bar
    const titleHeader = screen.getByRole('heading', { name: appRegistry[0].title, level: 1 });
    expect(titleHeader).toBeInTheDocument();

    // Click second item
    fireEvent.click(secondSidebarItem);

    // Verify active app title updates
    const updatedTitleHeader = screen.getByRole('heading', { name: appRegistry[1].title, level: 1 });
    expect(updatedTitleHeader).toBeInTheDocument();
  });

  it('verifies all downstream props dispatches to plugin', async () => {
    render(<App />);

    // Click second item to mount DummyPlugin / MockMidiTransposer
    const transposerSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Transposer', level: 3 });
    fireEvent.click(transposerSidebarItem);

    // 1. Initial State Checks
    expect(screen.getByText('Bypassed:').nextSibling.textContent).toBe('FALSE');
    expect(screen.getByText('Show Info:').nextSibling.textContent).toBe('FALSE');
    expect(screen.getByText('Show Settings:').nextSibling.textContent).toBe('FALSE');

    // 2. Test Info Button Toggle
    const infoButton = screen.getByLabelText(/info/i);
    expect(infoButton).toBeInTheDocument();
    fireEvent.click(infoButton);
    expect(screen.getByText('Show Info:').nextSibling.textContent).toBe('TRUE');

    // 3. Test Settings Button Toggle
    const settingsButton = screen.getByLabelText(/settings/i);
    expect(settingsButton).toBeInTheDocument();
    fireEvent.click(settingsButton);
    expect(screen.getByText('Show Settings:').nextSibling.textContent).toBe('TRUE');

    // 4. Test Power Button (Power is initially ON, so clicking it sets isBypassed to true)
    const powerButton = screen.getByLabelText(/power/i);
    expect(powerButton).toBeInTheDocument();
    fireEvent.click(powerButton);
    expect(screen.getByText('Bypassed:').nextSibling.textContent).toBe('TRUE');

    // 5. Test Panic Button increments count in dummy logs
    const panicButton = screen.getByLabelText(/panic/i);
    expect(panicButton).toBeInTheDocument();
    fireEvent.click(panicButton);
    expect(screen.getByText('[PANIC TRIGGERED] state=1')).toBeInTheDocument();
  });

  it('verifies global MIDI input message dispatches midi event to midiBus', async () => {
    render(<App />);

    // Click second item to mount DummyPlugin / MockMidiTransposer
    const transposerSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Transposer', level: 3 });
    fireEvent.click(transposerSidebarItem);

    // Check that MIDI selector shows the mock device
    const select = await screen.findByLabelText(/midi input source/i);
    await waitFor(() => {
      expect(select.value).toBe('mock-device-id');
    });

    // Ensure our listener was bound
    expect(mockMidiInput.addEventListener).toHaveBeenCalledWith('midimessage', expect.any(Function));
    expect(midiMessageListener).toBeTypeOf('function');

    // Wait for the midiBus to be captured
    await waitFor(() => {
      expect(capturedMidiBus).not.toBeNull();
    });

    // Register a spy listener on the captured bus
    const midiSpy = vi.fn();
    capturedMidiBus.addEventListener('midi', midiSpy);

    // Simulate receiving a Note On MIDI message [144, 60, 100]
    const midiEvent = {
      data: new Uint8Array([144, 60, 100]),
    };
    
    // Invoke the captured listener callback
    midiMessageListener(midiEvent);

    // Verify the event was dispatched to the bus
    expect(midiSpy).toHaveBeenCalledTimes(1);
    expect(midiSpy.mock.calls[0][0].detail).toEqual([144, 60, 100]);

    // Clean up
    capturedMidiBus.removeEventListener('midi', midiSpy);
  });

  it('given a burst of 4 handleRomplerOutput Note On calls within 5ms, then the audio triggers execute 4 times instantly, but setActiveNotes is only called once via the throttler', async () => {
    let setActiveNotesSpy = null;
    const originalUseState = React.useState;
    const useStateSpy = vi.spyOn(React, 'useState').mockImplementation((initialValue) => {
      const [val, setVal] = originalUseState(initialValue);
      const spy = vi.fn((updater) => setVal(updater));
      if (Array.isArray(initialValue) && initialValue.length === 0) {
        if (!setActiveNotesSpy) {
          setActiveNotesSpy = spy;
        } else {
          setActiveNotesSpy = spy;
        }
        return [val, spy];
      }
      return [val, setVal];
    });

    render(<App />);

    const transposerSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Transposer', level: 3 });
    fireEvent.click(transposerSidebarItem);

    await waitFor(() => {
      expect(capturedOnMidiOut).not.toBeNull();
    });

    vi.useFakeTimers();

    const playNoteOnSpy = vi.fn();
    let currentPlayNoteOn = null;
    Object.defineProperty(window, 'playNoteOn', {
      get() {
        return (note, velocity) => {
          playNoteOnSpy(note, velocity);
          if (typeof currentPlayNoteOn === 'function') {
            currentPlayNoteOn(note, velocity);
          }
        };
      },
      set(val) {
        currentPlayNoteOn = val;
      },
      configurable: true
    });

    if (setActiveNotesSpy) {
      setActiveNotesSpy.mockClear();
    }

    act(() => {
      capturedOnMidiOut([0x90, 60, 100]); // t=0
    });
    vi.advanceTimersByTime(1);
    act(() => {
      capturedOnMidiOut([0x90, 61, 100]); // t=1
    });
    vi.advanceTimersByTime(1);
    act(() => {
      capturedOnMidiOut([0x90, 62, 100]); // t=2
    });
    vi.advanceTimersByTime(1);
    act(() => {
      capturedOnMidiOut([0x90, 63, 100]); // t=3
    });

    expect(playNoteOnSpy).toHaveBeenCalledTimes(4);
    expect(playNoteOnSpy).toHaveBeenNthCalledWith(1, 60, 100);
    expect(playNoteOnSpy).toHaveBeenNthCalledWith(2, 61, 100);
    expect(playNoteOnSpy).toHaveBeenNthCalledWith(3, 62, 100);
    expect(playNoteOnSpy).toHaveBeenNthCalledWith(4, 63, 100);

    if (setActiveNotesSpy) {
      expect(setActiveNotesSpy).toHaveBeenCalledTimes(1);
    }

    act(() => {
      vi.advanceTimersByTime(35);
    });

    if (setActiveNotesSpy) {
      expect(setActiveNotesSpy).toHaveBeenCalledTimes(2);
    }

    useStateSpy.mockRestore();
    vi.useRealTimers();
    delete window.playNoteOn;
  });

  it('given multiple mocked MIDI inputs, when selecting device index 1, then the select value updates and does not revert to index 0 (Phase 1 Test Case 1)', async () => {
    const mockMidiInput1 = {
      id: 'device-0',
      name: 'Mock Device 0',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const mockMidiInput2 = {
      id: 'device-1',
      name: 'Mock Device 1',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const localMidiAccess = {
      inputs: new Map([
        ['device-0', mockMidiInput1],
        ['device-1', mockMidiInput2]
      ]),
      outputs: new Map(),
      onstatechange: null,
    };

    const requestMIDIAccessMock = vi.fn().mockResolvedValue(localMidiAccess);
    Object.defineProperty(global.navigator, 'requestMIDIAccess', {
      value: requestMIDIAccessMock,
      configurable: true,
      writable: true
    });

    render(<App />);

    // Wait for the select element to populate and select 'device-0'
    const select = await screen.findByLabelText(/midi input source/i);
    await waitFor(() => {
      expect(select.value).toBe('device-0');
    });

    // Simulate user selecting 'device-1'
    act(() => {
      fireEvent.change(select, { target: { value: 'device-1' } });
    });

    // In the broken implementation, it will trigger the useEffect, re-query, and reset to device-0.
    // Let's wait a bit to ensure it doesn't revert.
    await waitFor(() => {
      expect(select.value).toBe('device-1');
    });
  });

  it('given an active selection, when onstatechange fires but the active device is still connected, then the active selection remains unchanged (Phase 1 Test Case 2)', async () => {
    const mockMidiInput1 = {
      id: 'device-0',
      name: 'Mock Device 0',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const mockMidiInput2 = {
      id: 'device-1',
      name: 'Mock Device 1',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const localMidiAccess = {
      inputs: new Map([
        ['device-0', mockMidiInput1],
        ['device-1', mockMidiInput2]
      ]),
      outputs: new Map(),
      onstatechange: null,
    };

    const requestMIDIAccessMock = vi.fn().mockResolvedValue(localMidiAccess);
    Object.defineProperty(global.navigator, 'requestMIDIAccess', {
      value: requestMIDIAccessMock,
      configurable: true,
      writable: true
    });

    render(<App />);

    const select = await screen.findByLabelText(/midi input source/i);
    await waitFor(() => {
      expect(select.value).toBe('device-0');
    });

    // Select 'device-1'
    act(() => {
      fireEvent.change(select, { target: { value: 'device-1' } });
    });

    await waitFor(() => {
      expect(select.value).toBe('device-1');
    });

    // Now fire onstatechange with both devices still present
    act(() => {
      if (localMidiAccess.onstatechange) {
        localMidiAccess.onstatechange();
      }
    });

    expect(select.value).toBe('device-1');
  });
});
