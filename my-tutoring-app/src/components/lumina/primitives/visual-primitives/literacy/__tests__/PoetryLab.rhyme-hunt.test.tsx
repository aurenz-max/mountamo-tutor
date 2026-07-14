// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendText, submitResult, playCorrect, playIncorrect } = vi.hoisted(() => ({
  sendText: vi.fn(),
  submitResult: vi.fn(),
  playCorrect: vi.fn(),
  playIncorrect: vi.fn(),
}));

vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult, hasSubmitted: false }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({ playCorrect, playIncorrect }, { get: (target, key) => key in target ? target[key as keyof typeof target] : vi.fn() }),
}));

import PoetryLab, { type PoetryLabData, type RhymeHuntRound } from '../PoetryLab';

const rounds: RhymeHuntRound[] = [
  { id: 'r1', type: 'rhyme_hunt', poemLines: ['Moon is bright', 'Cat has a hat', 'Stars glow at night', 'Hello little cat'], candidates: [{ word: 'bright', emoji: '☀️' }, { word: 'hat', emoji: '🎩' }, { word: 'night', emoji: '🌙' }, { word: 'cat', emoji: '🐱' }], rhymeWordA: 'hat', rhymeWordB: 'cat' },
  { id: 'r2', type: 'rhyme_hunt', poemLines: ['Duck in the sun', 'Frog on a log', 'Fox starts to run', 'Hello little frog'], candidates: [{ word: 'sun', emoji: '☀️' }, { word: 'log', emoji: '🪵' }, { word: 'run', emoji: '🏃' }, { word: 'frog', emoji: '🐸' }], rhymeWordA: 'log', rhymeWordB: 'frog' },
  { id: 'r3', type: 'rhyme_hunt', poemLines: ['Mouse sees a star', 'Bike takes a hike', 'Light shines from far', 'I like that bike'], candidates: [{ word: 'star', emoji: '⭐' }, { word: 'hike', emoji: '🥾' }, { word: 'far', emoji: '🌌' }, { word: 'bike', emoji: '🚲' }], rhymeWordA: 'hike', rhymeWordB: 'bike' },
];

const data: PoetryLabData = {
  title: 'Rhyme Hunt',
  gradeLevel: 'K',
  mode: 'rhyme_hunt',
  rounds,
};

const tap = (word: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(word, 'i') }));

describe('PoetryLab rhyme_hunt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendText.mockClear();
    submitResult.mockClear();
    playCorrect.mockClear();
    playIncorrect.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps the PRE surface to poem + four tap choices and judges the pair immediately', async () => {
    render(<PoetryLab data={data} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByText(/Grade K/)).toBeNull();
    expect(screen.queryByText(/Challenge 1 of 3/)).toBeNull();

    tap('hat');
    tap('cat');
    expect(playCorrect).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('hat')).toHaveLength(2);
    expect(screen.getAllByText('cat')).toHaveLength(2);

    await act(async () => vi.advanceTimersByTime(900));
    expect(screen.getByRole('button', { name: /log/i })).toBeTruthy();
    expect(sendText.mock.calls.some((call) => String(call[0]).startsWith('[ROUND_START]'))).toBe(true);
  });

  it('resets a wrong pair on the object, then scores first-try mastery across all rounds', async () => {
    render(<PoetryLab data={data} />);

    tap('bright');
    tap('hat');
    expect(playIncorrect).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls.some((call) => String(call[0]).startsWith('[RHYME_MISS]'))).toBe(true);
    await act(async () => vi.advanceTimersByTime(600));

    tap('hat');
    tap('cat');
    await act(async () => vi.advanceTimersByTime(900));
    tap('log');
    tap('frog');
    await act(async () => vi.advanceTimersByTime(900));
    tap('hike');
    tap('bike');

    await act(async () => Promise.resolve());
    expect(submitResult).toHaveBeenCalledTimes(1);
    const [success, score, metrics] = submitResult.mock.calls[0];
    expect(success).toBe(true);
    expect(score).toBe(67);
    expect(metrics).toMatchObject({ mode: 'rhyme_hunt', roundsTotal: 3, roundsFirstTry: 2 });
    expect(sendText.mock.calls.some((call) => String(call[0]).startsWith('[ACTIVITY_COMPLETE]'))).toBe(true);
  });
});
