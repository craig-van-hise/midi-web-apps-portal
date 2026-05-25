import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import mockDummyPlugin from '../plugins/DummyPlugin';
import App from './App';
import { appRegistry } from '../config/appRegistry';

let capturedMidiBus = null;

vi.mock('../plugins/note-range-filter', () => ({
  default: function MockNoteRangeFilter(props) {
    capturedMidiBus = props.midiBus;
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

    const secondSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Pitch Class Matrix', level: 3 });
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

    // Click third item to mount DummyPlugin
    const thirdSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Note Range Filter', level: 3 });
    fireEvent.click(thirdSidebarItem);

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

    // Click third item to mount DummyPlugin / MockNoteRangeFilter
    const thirdSidebarItem = screen.getByRole('heading', { name: 'VV | MIDI Note Range Filter', level: 3 });
    fireEvent.click(thirdSidebarItem);

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
});
