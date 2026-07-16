// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for word-workout @ PRE
 * (qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md). The PRE
 * (Kindergarten) contract this locks in:
 *  1. Adult chrome is hidden at gradeLevel 'K': the title, the mode badge, the
 *     "Vowels: a" label (which also LEAKS the scope), the "1 / N" counter, and
 *     the progress bar.
 *  2. On-screen instruction sentences are hidden (a pre-reader can't read
 *     "Which is a real word?" / "Read each word as it changes") — the tutor
 *     voices the play action instead.
 *  3. ORIENT: on mount the tutor is asked (via [ACTIVITY_START]) to voice the
 *     play action for the current mode, answer-free — it names the task, never
 *     the answer.
 *  4. Text feedback cards are hidden at PRE (SFX + the answer-choice ring carry
 *     right vs wrong).
 *  5. The answer surface survives: real/nonsense words are still tappable, and
 *     picture-match options render their emoji.
 *  6. Reader grades (control, Grade 1) keep the full chrome + instructions +
 *     feedback text.
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
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

// Voice answer path off (isSupported false) so the mic UI doesn't render — the
// band-gate assertions are about chrome/text, not the mic.
vi.mock('../../../hooks/useVoiceAnswer', () => ({
  useVoiceAnswer: () => ({
    state: 'idle', level: 0, isSupported: false, dormant: true,
    startManual: vi.fn(), cancel: vi.fn(),
  }),
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import WordWorkout, { type WordWorkoutData } from './WordWorkout';

const realNonsenseData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'real-vs-nonsense',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [
    { id: 'c1', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' },
  ],
});

const pictureMatchData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'picture-match',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [
    {
      id: 'c1', mode: 'picture-match', targetWord: 'cat', targetImage: '🐱',
      distractorImages: [{ word: 'bat', image: '🦇' }, { word: 'rat', image: '🐀' }],
    },
  ],
});

const wordChainsData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'word-chains',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [
    { id: 'c1', mode: 'word-chains', chain: ['cat', 'bat', 'bad'], changedPositions: [0, 2] },
  ],
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

describe('WordWorkout @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome (title, mode badge, vowel label, counter)', () => {
    render(<WordWorkout data={realNonsenseData('K')} />);
    expect(screen.queryByText('CVC Word Workout: short a')).toBeNull(); // title
    expect(screen.queryByText(/Real vs\. Nonsense/)).toBeNull();        // mode badge
    expect(screen.queryByText(/Vowels:/)).toBeNull();                   // scope leak
    expect(screen.queryByText('1 / 1')).toBeNull();                     // counter
  });

  it('hides the on-screen instruction sentence (tutor voices it)', () => {
    render(<WordWorkout data={realNonsenseData('K')} />);
    expect(screen.queryByText('Which is a real word?')).toBeNull();
  });

  it('ORIENT: [ACTIVITY_START] voices the play action, answer-free', () => {
    render(<WordWorkout data={realNonsenseData('K')} />);
    const starts = tagged('[ACTIVITY_START]');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatch(/tap the one that is a REAL word/i);
    expect(starts[0]).not.toMatch(/\bcat\b/i); // never leak the answer
  });

  it('keeps the answer surface: both words are still tappable', () => {
    render(<WordWorkout data={realNonsenseData('K')} />);
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('zat')).toBeTruthy();
  });

  it('hides the text feedback card on a wrong tap (SFX + ring carry it)', () => {
    render(<WordWorkout data={realNonsenseData('K')} />);
    fireEvent.click(screen.getByText('zat')); // the nonsense (wrong) word
    expect(screen.queryByText(/Try again/)).toBeNull();
  });

  it('picture-match is picture-primary: option emoji render, instruction hidden', () => {
    render(<WordWorkout data={pictureMatchData('K')} />);
    expect(screen.queryByText('Which picture matches this word?')).toBeNull();
    expect(screen.getByText('🐱')).toBeTruthy();
    expect(screen.getByText('🦇')).toBeTruthy();
    expect(screen.getByText('cat')).toBeTruthy(); // the word stimulus stays
  });

  it('word-chains instruction sentence is hidden at PRE', () => {
    render(<WordWorkout data={wordChainsData('K')} />);
    expect(screen.queryByText('Read each word as it changes')).toBeNull();
  });
});

describe('WordWorkout @ reader grade (control, Grade 1)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the full chrome: title, mode badge, vowel label, counter, instruction', () => {
    render(<WordWorkout data={realNonsenseData('1')} />);
    expect(screen.getByText('CVC Word Workout: short a')).toBeTruthy();
    expect(screen.getByText(/Real vs\. Nonsense/)).toBeTruthy();
    expect(screen.getByText('Vowels: a')).toBeTruthy();
    expect(screen.getByText('1 / 1')).toBeTruthy();
    expect(screen.getByText('Which is a real word?')).toBeTruthy();
  });

  it('shows the text feedback card on a wrong tap at reader grade', () => {
    render(<WordWorkout data={realNonsenseData('1')} />);
    fireEvent.click(screen.getByText('zat'));
    expect(screen.getByText(/Try again/)).toBeTruthy();
  });
});
