// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for life-cycle-sequencer — 15B / S13.
 *
 * Queued as SCAFFOLD-GAP ("order picture cards", risk 3 — the lowest in the
 * class). The ordering IS K-fit, but at K-2 the cards carried the image-
 * GENERATION prompt as visible body text, the header carried a developer band
 * badge, the pool carried a live tally, the slots carried "Drop stage here",
 * and placement was select-then-target — two acts.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires and withholds the order, one
 * tap places a card at K-2, each placement is voiced without a verdict, and the
 * chrome is gone at K-2 but kept at 3-5.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import LifeCycleSequencer, { type LifeCycleSequencerData } from '../LifeCycleSequencer';

const IMAGE_PROMPT = 'a female butterfly laying a tiny egg on a milkweed leaf';

const kData = (over: Partial<LifeCycleSequencerData> = {}): LifeCycleSequencerData => ({
  title: 'How a Butterfly Grows',
  instructions: 'Put the pictures in the order they really happen.',
  cycleType: 'linear',
  scaleContext: 'about 4 weeks from egg to butterfly',
  gradeBand: 'K-2',
  misconceptionTrap: {
    commonError: 'Students think the caterpillar sheds its skin to become a butterfly directly',
    correction: 'It forms a chrysalis first',
  },
  stages: [
    {
      id: 'egg', label: 'Egg', imagePrompt: IMAGE_PROMPT,
      description: 'A mama butterfly lays a tiny egg on a leaf.',
      correctPosition: 0, transitionToNext: 'The egg hatches', duration: '5 days',
    },
    {
      id: 'cat', label: 'Caterpillar', imagePrompt: 'a striped caterpillar eating a leaf',
      description: 'The caterpillar eats and eats and grows bigger.',
      correctPosition: 1, transitionToNext: 'It makes a chrysalis', duration: '2 weeks',
    },
    {
      id: 'chry', label: 'Chrysalis', imagePrompt: 'a green chrysalis hanging from a twig',
      description: 'It hangs very still inside a hard shell.',
      correctPosition: 2, transitionToNext: 'A butterfly comes out', duration: '10 days',
    },
  ],
  ...over,
});

const g4Data = () => kData({ gradeBand: '3-5' });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('LifeCycleSequencer reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat that withholds the order', () => {
    render(<LifeCycleSequencer data={kData()} />);
    const orient = sent().find((m) => m.includes('[CYCLE_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toMatch(/pre-reader who cannot read any text/i);
    expect(orient).toMatch(/tap the pictures in the order/i);
    expect(orient).toMatch(/NEVER say which one comes first/i);
    // The answer is the sequence — no stage may be named as first.
    expect(orient).not.toMatch(/Egg comes first|starts with the Egg/i);
  });

  it('voices a placed stage WITHOUT a verdict (the order is the answer)', () => {
    render(<LifeCycleSequencer data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByText('Caterpillar'));
    const msg = sent().find((m) => m.includes('[CYCLE_STAGE_PLACED]'))!;
    expect(msg).toBeTruthy();
    expect(msg).toContain('Caterpillar');
    expect(msg).toMatch(/Do NOT say whether it is in the right place/i);
    expect(msg).toMatch(/do NOT hint at the order/i);
  });

  it('read-aloud sends the instructions verbatim', () => {
    render(<LifeCycleSequencer data={kData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the instructions to me/i }));
    const msg = sent().find((m) => m.includes('[CYCLE_READ_ALOUD]'))!;
    expect(msg).toContain('Put the pictures in the order they really happen.');
  });

  it('every tagged send is silent', () => {
    render(<LifeCycleSequencer data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the instructions to me/i }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('LifeCycleSequencer reader-fit — band contract at PRE (K-2)', () => {
  it('places a card with ONE tap at K-2 — no select-then-target (rule 2)', () => {
    render(<LifeCycleSequencer data={kData()} />);
    // Before: 3 cards in the pool. Tap one; it leaves the pool for a slot.
    fireEvent.click(screen.getByText('Chrysalis'));
    // The placed card is voiced, which only happens on a real placement.
    expect(sent().some((m) => m.includes('[CYCLE_STAGE_PLACED]') && m.includes('Chrysalis')))
      .toBe(true);
  });

  it('does NOT auto-place at 3-5 — that band keeps select-then-target', () => {
    render(<LifeCycleSequencer data={g4Data()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByText('Chrysalis'));
    expect(sent().some((m) => m.includes('[CYCLE_STAGE_PLACED]'))).toBe(false);
  });

  it('never renders imagePrompt — it is an image-generation instruction', () => {
    const { container } = render(<LifeCycleSequencer data={kData()} />);
    expect(container.textContent).not.toContain(IMAGE_PROMPT);
    expect(container.textContent).not.toContain('a striped caterpillar eating a leaf');
  });

  it('does not render imagePrompt at 3-5 either — it was never student copy', () => {
    const { container } = render(<LifeCycleSequencer data={g4Data()} />);
    expect(container.textContent).not.toContain(IMAGE_PROMPT);
  });

  it('hides the developer band badge and the scale prose at K-2 (rule 7)', () => {
    render(<LifeCycleSequencer data={kData()} />);
    expect(screen.queryByText('K-2')).toBeNull();
    expect(screen.queryByText(/about 4 weeks from egg to butterfly/)).toBeNull();
  });

  it('shows the band badge and scale context at 3-5', () => {
    render(<LifeCycleSequencer data={g4Data()} />);
    expect(screen.getByText('3-5')).toBeTruthy();
    expect(screen.getByText(/about 4 weeks from egg to butterfly/)).toBeTruthy();
  });

  it('hides the "Available Cards (N)" tally at K-2', () => {
    render(<LifeCycleSequencer data={kData()} />);
    expect(screen.queryByText(/Available Cards/i)).toBeNull();
  });

  it('hides the "Drop stage here" protocol text at K-2', () => {
    render(<LifeCycleSequencer data={kData()} />);
    expect(screen.queryByText(/Drop stage here/i)).toBeNull();
    expect(screen.queryByText(/Tap or drop to place/i)).toBeNull();
  });

  it('shows the drop prompts at 3-5', () => {
    render(<LifeCycleSequencer data={g4Data()} />);
    expect(screen.getAllByText(/Drop stage here/i).length).toBeGreaterThan(0);
  });
});
