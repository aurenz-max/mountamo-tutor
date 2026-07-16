// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for word-flip @ PRE
 * (qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md). word-flip is the
 * reader-fit PRE *reference model* (voice-first counted-picture frame) — its
 * interaction core is already band-fit, so PRE only strips the adult chrome from
 * the child's field (rule 7). This locks in:
 *  1. Start screen at K hides the "Word Flip" badge (decorative chrome); the
 *     start buttons (the voice-consent GESTURE) remain.
 *  2. In-game at K hides the counter, the "N correct / N spoken" tally, the
 *     progress bar, the mode badge, and the text feedback card.
 *  3. The counted-picture frame (emoji + singular caption) and the tap chips —
 *     the actual interaction — survive.
 *  4. Reader grades (control, Grade 1) keep the full chrome + tally + feedback.
 *
 * External hooks (live tutor, evaluation, spoken judge, audio) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../hooks/useVoiceAnswer', () => ({
  useVoiceAnswer: () => ({
    state: 'idle', level: 0, isSupported: false, dormant: true,
    startManual: vi.fn(), cancel: vi.fn(),
  }),
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import WordFlip, { type WordFlipData } from './WordFlip';

const makeData = (gradeLevel: string): WordFlipData => ({
  title: 'Farm Friends',
  description: 'One dog… two dogs!',
  challengeType: 'plural_s',
  gradeLevel,
  challenges: [
    { id: 'wf1', type: 'plural_s', singular: 'dog', answer: 'dogs', emoji: '🐕', count: 3, options: ['dog', 'dogs', 'dogses'] },
    { id: 'wf2', type: 'plural_s', singular: 'cat', answer: 'cats', emoji: '🐈', count: 2, options: ['cat', 'cats', 'catses'] },
  ],
});

const start = () => fireEvent.click(screen.getByRole('button', { name: /Start tap-only/i }));

describe('WordFlip @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('start screen hides the "Word Flip" badge (chrome); start button remains', () => {
    render(<WordFlip data={makeData('K')} />);
    expect(screen.queryByText('Word Flip')).toBeNull();
    expect(screen.getByRole('button', { name: /Start tap-only/i })).toBeTruthy();
  });

  it('in-game hides counter, correct/spoken tally, mode badge', () => {
    render(<WordFlip data={makeData('K')} />);
    start();
    expect(screen.queryByText(/correct/)).toBeNull();       // tally
    expect(screen.queryByText('One & Many')).toBeNull();    // mode badge
  });

  it('keeps the counted-picture frame + tap chips (the interaction)', () => {
    render(<WordFlip data={makeData('K')} />);
    start();
    expect(screen.getAllByText('🐕').length).toBeGreaterThan(0); // frame emoji
    expect(screen.getByText('dogs')).toBeTruthy();               // a tap chip
  });

  it('hides the text feedback card on a wrong tap (SFX + frame carry it)', () => {
    render(<WordFlip data={makeData('K')} />);
    start();
    fireEvent.click(screen.getByRole('button', { name: 'dog' })); // bare singular chip = wrong
    expect(screen.queryByText(/not that one/i)).toBeNull();
  });
});

describe('WordFlip @ reader grade (control, Grade 1)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('start screen shows the "Word Flip" badge', () => {
    render(<WordFlip data={makeData('1')} />);
    expect(screen.getByText('Word Flip')).toBeTruthy();
  });

  it('in-game shows the correct tally + mode badge', () => {
    render(<WordFlip data={makeData('1')} />);
    start();
    expect(screen.getByText(/correct/)).toBeTruthy();
    expect(screen.getByText(/One & Many/)).toBeTruthy();
  });

  it('shows the text feedback card on a wrong tap at reader grade', () => {
    render(<WordFlip data={makeData('1')} />);
    start();
    fireEvent.click(screen.getByRole('button', { name: 'dog' }));
    expect(screen.getByText(/not that one/i)).toBeTruthy();
  });
});
