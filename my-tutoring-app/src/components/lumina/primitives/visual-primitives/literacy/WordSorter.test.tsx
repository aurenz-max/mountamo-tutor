// @vitest-environment jsdom
/**
 * Behavioral test for the WordSorter pre-reader (PRE band) presentation —
 * the reader-fit contract for K (qa/reader-fit/word-sorter-PRE-2026-07-14.md):
 * one staged word, tap-a-bucket = choose (no two-tap), tutor voices every card
 * ([WORD_STAGED]/[WORD_TAP]), adult chrome hidden, feedback lands on the bucket.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(),
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
    // PhaseSummaryPanel reads these on completion
    isEnabled: () => false,
    getVolume: () => 0,
    playComplete: vi.fn(),
  },
}));

const submitResult = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult,
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  // PhaseSummaryPanel → DemonstratedSkillDetails reads this on completion.
  useEvaluationContext: () => null,
}));

import WordSorter, { type WordSorterData } from './WordSorter';

const makeData = (gradeLevel: string): WordSorterData => ({
  title: 'Animal Sort',
  description: 'Sort the words',
  gradeLevel,
  sortingTopic: 'Animals and Actions',
  challenges: [
    {
      id: 'binary_sort-0',
      type: 'binary_sort',
      instruction: 'Sort these words into animals and actions',
      bucketLabels: ['Animals', 'Actions'],
      bucketEmojis: ['🐾', '🏃'],
      words: [
        { id: 'w0', word: 'cat', emoji: '🐱', correctBucket: 'Animals' },
        { id: 'w1', word: 'run', emoji: '🏃', correctBucket: 'Actions' },
      ],
    },
  ],
});

const stagedTags = () =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith('[WORD_STAGED]'));

describe('WordSorter @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome and the unreadable instruction/protocol text', () => {
    render(<WordSorter data={makeData('K')} />);
    expect(screen.queryByText('1 / 1')).toBeNull();
    expect(screen.queryByText(/wrong/)).toBeNull();
    expect(screen.queryByText('Sort these words into animals and actions')).toBeNull();
    expect(screen.queryByText(/Tap a word, then tap the bucket/)).toBeNull();
    expect(screen.queryByText('Sort the words')).toBeNull();
  });

  it('stages ONE word, announces it via [WORD_STAGED], and replays on card tap', () => {
    render(<WordSorter data={makeData('K')} />);
    // one staged card, not a pool of chips
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.queryByText('run')).toBeNull();
    expect(stagedTags()).toHaveLength(1);
    expect(stagedTags()[0]).toContain('"cat"');
    // stimulus is announced, never the answer bucket
    expect(stagedTags()[0]).not.toContain('Animals');

    fireEvent.click(screen.getByRole('button', { name: /Hear the word cat/ }));
    const taps = sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith('[WORD_TAP]'));
    expect(taps).toHaveLength(1);
    expect(taps[0]).toContain('"cat"');
  });

  it('tap-a-bucket = choose: correct sort files the word and stages the next', () => {
    render(<WordSorter data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: /🐾/ }));
    // cat filed into the Animals bucket badge; next word staged + announced
    expect(screen.getByText('run')).toBeTruthy();
    expect(stagedTags()).toHaveLength(2);
    expect(stagedTags()[1]).toContain('"run"');
  });

  it('wrong bucket: word stays staged, spoken hint requested, no error text card', () => {
    render(<WordSorter data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: /🏃 Actions/ }));
    const wrong = sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith('[ANSWER_INCORRECT]'));
    expect(wrong).toHaveLength(1);
    expect(screen.getByText('cat')).toBeTruthy(); // still staged
    expect(screen.queryByText(/doesn't belong/)).toBeNull(); // rule 5: no text-only correction
  });

  it('completing the challenge submits the evaluation', () => {
    render(<WordSorter data={makeData('K')} />);
    fireEvent.click(screen.getByRole('button', { name: /🐾/ })); // cat → Animals
    fireEvent.click(screen.getByRole('button', { name: /🏃 Actions/ })); // run → Actions
    expect(submitResult).toHaveBeenCalled();
    const allComplete = sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith('[ALL_COMPLETE]'));
    expect(allComplete).toHaveLength(1);
  });
});

describe('WordSorter @ reader grades (control)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the reader presentation: word pool, protocol line, counter, instruction', () => {
    render(<WordSorter data={makeData('2')} />);
    expect(screen.getByText(/Tap a word, then tap the bucket/)).toBeTruthy();
    expect(screen.getByText('1 / 1')).toBeTruthy();
    expect(screen.getByText('Sort these words into animals and actions')).toBeTruthy();
    // both words visible as chips, no [WORD_STAGED] announcements
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('run')).toBeTruthy();
    expect(stagedTags()).toHaveLength(0);
  });
});
