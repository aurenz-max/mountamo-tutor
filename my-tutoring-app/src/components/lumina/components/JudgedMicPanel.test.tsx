// @vitest-environment jsdom
/**
 * The panel's job is the LABEL — everything else it renders is the orb's, and
 * the orb has its own surface. So this pins the one thing fourteen ports each
 * got right or wrong on their own: what the mic claims to be doing on an item
 * the child answers with their HANDS.
 *
 * Trap this deliberately does not fall into (19a finding 1): rendering the
 * panel proves the panel, not that any port still passes the right answerKind.
 * That wiring is asserted per port by its own suite and, ultimately, by ears.
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JudgedMicPanel, { type JudgedRunSurface } from './JudgedMicPanel';

afterEach(cleanup);

// jsdom has no `navigator.mediaDevices`, so the orb's own support probe would
// render the whole surface away. Every case below states support explicitly.
const SUPPORTED = { isSupported: true } as const;

const runWith = (answerKind: 'voice' | 'gesture'): JudgedRunSurface => ({
  micState: 'armed',
  micLevel: 0.02,
  statusLine: 'Listen, then answer.',
  start: vi.fn(async () => {}),
  cancelListening: undefined,
  currentItem: {
    id: 'i1',
    action: 'say',
    answerKind,
    responseClass: answerKind === 'gesture' ? 'manipulation' : 'letter_name',
  },
});

describe('JudgedMicPanel', () => {
  it('says it is listening only when the answer is spoken', () => {
    render(<JudgedMicPanel run={runWith('voice')} {...SUPPORTED} />);
    expect(screen.getByText('I’m listening')).toBeTruthy();
  });

  it('names the hands turn instead of claiming to listen on a gesture item', () => {
    render(<JudgedMicPanel run={runWith('gesture')} {...SUPPORTED} />);
    expect(screen.queryByText('I’m listening')).toBeNull();
    expect(screen.getByText('Your turn — tap it')).toBeTruthy();
  });

  it('lets a port name its own gesture', () => {
    render(<JudgedMicPanel run={runWith('gesture')} gestureLabel="Show me on the frame" {...SUPPORTED} />);
    expect(screen.getByText('Show me on the frame')).toBeTruthy();
  });

  it('renders the status line and anything hung below it', () => {
    render(
      <JudgedMicPanel run={runWith('voice')} {...SUPPORTED}>
        <button type="button">Hear it again</button>
      </JudgedMicPanel>,
    );
    expect(screen.getByText('Listen, then answer.')).toBeTruthy();
    expect(screen.getByText('Hear it again')).toBeTruthy();
  });

  it('drives off plain props for the four ports that predate the runner', () => {
    render(
      <JudgedMicPanel
        state="armed"
        level={0}
        statusLine="Fill in the boxes."
        onStart={vi.fn()}
        {...SUPPORTED}
        answerKind="gesture"
        gestureLabel="Your turn — fill the boxes"
      />,
    );
    expect(screen.getByText('Your turn — fill the boxes')).toBeTruthy();
    expect(screen.getByText('Fill in the boxes.')).toBeTruthy();
  });

  it('shows the tap-to-start prompt while idle, not a listening claim', () => {
    render(
      <JudgedMicPanel
        state="idle"
        level={0}
        statusLine="Tap the microphone to start."
        onStart={vi.fn()}
        {...SUPPORTED}
      />,
    );
    expect(screen.getByText('Tap to start')).toBeTruthy();
    expect(screen.queryByText('I’m listening')).toBeNull();
  });
});
