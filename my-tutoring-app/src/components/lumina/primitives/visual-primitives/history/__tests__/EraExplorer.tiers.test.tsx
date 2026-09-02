// @vitest-environment jsdom
/**
 * L3 support-tier gate for era-explorer.
 *
 * A tier-sweep probe proves the GENERATOR stamps the fields; it says nothing
 * about whether the component actually withdraws anything, and this rung's whole
 * value is the withdrawal being visible. So each tier is driven through the real
 * render tree: the easy-only strategy line, the three-rung hint ladder, the bin
 * captions, the relaxed explore gate, and the folded source card.
 *
 * The two invariants that would be silent bugs get their own assertions: the
 * ICON survives every tier (it is the pre-reader's only channel to a choice, not
 * a scaffold), and the tutor's wrong-answer nudge stops naming the lens at hard —
 * a tier that hides the lens on screen and lets the tutor say it is half-applied.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isConnected: true, isAudioPlaying: false }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import EraExplorer, { type EraExplorerData } from '../EraExplorer';

/** Base session; `over` carries the exact fields `applySupportTier` would stamp. */
const data = (over: Partial<EraExplorerData> = {}): EraExplorerData => ({
  title: 'Life Long Ago',
  description: 'Look at how people lived.',
  eraName: 'Pioneer Times',
  eraPeriod: 'about 150 years ago',
  priorEra: { name: 'Before the Wagons', body: 'People walked everywhere.' },
  lenses: [
    { title: 'Daily Life', body: 'Water came in from the pump outside.', icon: '🏠' },
    { title: 'Technology', body: 'Light came from candles and oil lamps.', icon: '🕯️' },
    { title: 'School & Work', body: 'Children did chores before walking to school.', icon: '✏️' },
  ],
  challenges: [
    {
      id: 'c1',
      type: 'era_sort',
      statement: 'Children carry water in from outside.',
      options: ['Pioneer Times', 'Today', 'Both then and now'],
      correctIndex: 0,
      explanation: 'Homes did not have taps yet.',
      lensHint: 'Daily Life',
    },
  ],
  challengeType: 'era_sort',
  gradeLevel: '3',
  ...over,
});

/** The three per-challenge scaffolds exactly as the generator resolves them for era_sort. */
const TIER_FIELDS = {
  easy: { showStrategy: true, hintLevel: 'named_lens' as const, showBinCaptions: true },
  medium: { showStrategy: false, hintLevel: 'generic' as const, showBinCaptions: true },
  hard: { showStrategy: false, hintLevel: 'none' as const, showBinCaptions: false },
};

const tiered = (tier: 'easy' | 'medium' | 'hard'): EraExplorerData => {
  const base = data();
  return {
    ...base,
    supportTier: tier,
    requireAllLenses: tier !== 'hard',
    lensAccess: tier === 'hard' ? 'collapsible' : 'open',
    challenges: base.challenges.map((c) => ({ ...c, ...TIER_FIELDS[tier] })),
  };
};

const STRATEGY = /Check it twice/;

/** Cross into the challenge phase, opening every lens only when the gate demands it. */
const startQuestions = (gated = true) => {
  if (gated) {
    fireEvent.click(screen.getByText('Technology'));
    fireEvent.click(screen.getByText('School & Work'));
  }
  fireEvent.click(screen.getByText(/Start the Questions/));
};

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('era-explorer L3 — the workspace withdraws its help', () => {
  it('easy names the historian move; medium and hard do not', () => {
    render(<EraExplorer data={tiered('easy')} />);
    startQuestions();
    expect(screen.getByText(STRATEGY)).toBeTruthy();

    for (const tier of ['medium', 'hard'] as const) {
      cleanup();
      render(<EraExplorer data={tiered(tier)} />);
      startQuestions(tier !== 'hard');
      expect(screen.queryByText(STRATEGY)).toBeNull();
    }
  });

  it('walks the hint down from the named lens, to a generic hunt, to nothing', () => {
    render(<EraExplorer data={tiered('easy')} />);
    startQuestions();
    fireEvent.click(screen.getByText(/Need a hint/i));
    expect(screen.getByText('Daily Life', { selector: 'span.font-semibold' })).toBeTruthy();

    cleanup();
    render(<EraExplorer data={tiered('medium')} />);
    startQuestions();
    fireEvent.click(screen.getByText(/Need a hint/i));
    expect(screen.getByText(/Open each lens tab above/)).toBeTruthy();
    expect(screen.queryByText('Daily Life', { selector: 'span.font-semibold' })).toBeNull();

    cleanup();
    render(<EraExplorer data={tiered('hard')} />);
    startQuestions(false);
    expect(screen.queryByText(/Need a hint/i)).toBeNull();
  });

  it('drops the bin captions at hard but never the icon a pre-reader answers by', () => {
    render(<EraExplorer data={tiered('medium')} />);
    startQuestions();
    expect(screen.getByText('Then AND now')).toBeTruthy();

    cleanup();
    render(<EraExplorer data={tiered('hard')} />);
    startQuestions(false);
    expect(screen.queryByText('Then AND now')).toBeNull();
    // The labels stay — only their plain-language gloss went away.
    expect(screen.getByText('Both then and now')).toBeTruthy();
    expect(screen.getByText('🔁')).toBeTruthy();
  });

  it('relaxes the explore gate at hard and folds the source away between questions', () => {
    render(<EraExplorer data={tiered('easy')} />);
    // One lens opened of three: the gate still holds the questions shut.
    expect(screen.queryByText(/Start the Questions/)).toBeNull();
    expect(screen.getByText('1 of 3 lenses explored')).toBeTruthy();

    cleanup();
    render(<EraExplorer data={tiered('hard')} />);
    expect(screen.getByText(/Start the Questions/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Start the Questions/));
    // Source folded, one tap away, and re-foldable.
    expect(screen.queryByText(/Water came in from the pump/)).toBeNull();
    fireEvent.click(screen.getByText(/Look at the lenses again/));
    expect(screen.getByText(/Water came in from the pump/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Put the lenses away/));
    expect(screen.queryByText(/Water came in from the pump/)).toBeNull();
  });

  it('stops the tutor naming the lens at hard — the second scaffold channel', () => {
    const nudge = () => {
      startQuestions(false);
      fireEvent.click(screen.getByText('Today')); // wrong; correctIndex is 0
      fireEvent.click(screen.getByText('Check'));
      return sendTextSpy.mock.calls.map((c) => String(c[0])).find((m) => m.includes('[ANSWER_INCORRECT]'))!;
    };

    render(<EraExplorer data={tiered('hard')} />);
    const hardNudge = nudge();
    expect(hardNudge).toMatch(/WITHOUT naming a lens/);
    expect(hardNudge).not.toMatch(/toward the "Daily Life" lens/);

    cleanup();
    sendTextSpy.mockClear();
    render(<EraExplorer data={tiered('medium')} />);
    fireEvent.click(screen.getByText('Technology'));
    fireEvent.click(screen.getByText('School & Work'));
    expect(nudge()).toMatch(/toward the "Daily Life" lens/);
  });

  it('renders exactly as before when the manifest sends no tier', () => {
    render(<EraExplorer data={data()} />);
    fireEvent.click(screen.getByText('Technology'));
    fireEvent.click(screen.getByText('School & Work'));
    fireEvent.click(screen.getByText(/Start the Questions/));
    expect(screen.queryByText(STRATEGY)).toBeNull();
    expect(screen.getByText('Then AND now')).toBeTruthy();
    fireEvent.click(screen.getByText(/Need a hint/i));
    expect(screen.getByText('Daily Life', { selector: 'span.font-semibold' })).toBeTruthy();
  });
});
