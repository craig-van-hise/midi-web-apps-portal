// @ts-nocheck
import React, { useEffect } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MIDIProvider, useMidi } from './MIDIProvider';

const TestConsumer: React.FC<{
  onMidiReady?: (context: any) => void;
  onMidiMessage?: (detail: any) => void;
}> = ({ onMidiReady, onMidiMessage }) => {
  const context = useMidi();

  useEffect(() => {
    if (context && !context.loading) {
      onMidiReady?.(context);
    }
  }, [context, onMidiReady]);

  useEffect(() => {
    const handleMidiMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      onMidiMessage?.(customEvent.detail);
    };

    window.addEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
    return () => {
      window.removeEventListener('MIDI_MESSAGE_RECEIVED', handleMidiMessage);
    };
  }, [onMidiMessage]);

  if (!context) return <div>Context not available</div>;

  return (
    <>
      {context.loading && <div data-testid="loading">Loading...</div>}
      {context.error && <div data-testid="error">{context.error}</div>}
      {!context.loading && !context.error && (
        <div data-testid="midi-ready">
          MIDI Ready
        </div>
      )}
    </>
  );
};

describe('MIDIProvider - Headless', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', {});
  });

  it('should finish loading and not call navigator.requestMIDIAccess', async () => {
    const requestMidiAccessMock = vi.fn();
    vi.stubGlobal('navigator', {
      requestMIDIAccess: requestMidiAccessMock,
    });

    render(
      <MIDIProvider>
        <TestConsumer />
      </MIDIProvider>
    );

    // Wait for loading to finish
    await waitFor(() => expect(screen.getByTestId('midi-ready')).toBeInTheDocument());

    // Verify requestMIDIAccess was NEVER called
    expect(requestMidiAccessMock).not.toHaveBeenCalled();
  });

  it('should handle the MIDI_MESSAGE_RECEIVED event and call the handler', async () => {
    const onMidiMessageSpy = vi.fn();
    render(
      <MIDIProvider>
        <TestConsumer onMidiMessage={onMidiMessageSpy} />
      </MIDIProvider>
    );

    await waitFor(() => expect(screen.getByTestId('midi-ready')).toBeInTheDocument());

    const mockMidiMessageDetail = {
      data: new Uint8Array([0x90, 0x30, 0x7f]),
      timestamp: 12345,
    };

    act(() => {
      window.dispatchEvent(
        new CustomEvent('MIDI_MESSAGE_RECEIVED', { detail: mockMidiMessageDetail })
      );
    });

    expect(onMidiMessageSpy).toHaveBeenCalledWith(mockMidiMessageDetail);
  });

  it('should initialize splitPoint to 60 and allow updating it', async () => {
    let capturedContext: any;
    render(
      <MIDIProvider>
        <TestConsumer onMidiReady={(ctx) => { capturedContext = ctx; }} />
      </MIDIProvider>
    );

    await waitFor(() => expect(capturedContext).toBeDefined());
    expect(capturedContext.splitPoint).toBe(60);

    act(() => {
      capturedContext.setSplitPoint(48);
    });

    expect(capturedContext.splitPoint).toBe(48);
  });
});
