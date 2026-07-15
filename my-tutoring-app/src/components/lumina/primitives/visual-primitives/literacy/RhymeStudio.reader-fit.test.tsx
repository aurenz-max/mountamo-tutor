// @vitest-environment jsdom
/**
 * Behavioral test for the RhymeStudio pre-reader (PRE band / Kindergarten) presentation —
 * the reader-fit contract (qa/reader-fit/rhyme-studio-PRE-2026-07-15.md):
 *   - every word (target, comparison, each option) is PICTURE-primary (emoji) with the word a caption
 *   - recognition answers are a big 👍 / 👎 icon (tap = choose, no Check button)
 *   - identification is tap = choose (a tap immediately evaluates; no Check button)
 *   - the load-bearing question sentence is NOT on screen at PRE (the tutor voices it)
 *   - adult chrome hidden (title, grade badge, mode badge, progress counter, score ledger)
 *   - the text feedback card is hidden at PRE (ring/sound + spoken tutor carry right/wrong)
 *   - reader grades (Grade 1) keep the word-primary card, the text question, and full chrome (control)
 */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendText = vi.fn();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

vi.mock('../../../hooks/useSpokenWordCapture', () => ({
  useSpokenWordCapture: () => ({
    state: 'idle', level: 0, isSupported: false,
    start: vi.fn(), cancel: vi.fn(),
  }),
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    tap: vi.fn(),
    playCorrect: vi.fn(),
    playIncorrect: vi.fn(),
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
  useEvaluationContext: () => null,
}));

import RhymeStudio, { type RhymeStudioData } from './RhymeStudio';

const recognition = (gradeLevel: 'K' | '1'): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [
    {
      id: 'c1',
      mode: 'recognition',
      targetWord: 'cat',
      targetWordImage: 'a cute cat',
      targetWordEmoji: '🐱',
      rhymeFamily: '-at',
      comparisonWord: 'bat',
      comparisonWordImage: 'a fruit bat',
      comparisonWordEmoji: '🦇',
      doesRhyme: true,
    },
  ],
});

const identification = (gradeLevel: 'K' | '1'): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [
    {
      id: 'c1',
      mode: 'identification',
      targetWord: 'cat',
      targetWordImage: 'a cute cat',
      targetWordEmoji: '🐱',
      rhymeFamily: '-at',
      // At K the option's picture rides the `image` field as a single emoji.
      options: [
        { word: 'bat', image: '🦇', isCorrect: true },
        { word: 'dog', image: '🐶', isCorrect: false },
      ],
    },
  ],
});

const tagsStarting = (prefix: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(prefix));

// The activity opens behind a Start gate; at the start screen there is exactly
// one button. Click it to reveal the first challenge.
const startActivity = () => fireEvent.click(screen.getByRole('button'));

describe('RhymeStudio @ PRE (Kindergarten) — recognition', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('renders both words picture-primary (emoji + word caption), no text question', () => {
    render(<RhymeStudio data={recognition('K')} />);
    startActivity();
    expect(screen.getByText('🐱')).toBeTruthy();
    expect(screen.getByText('🦇')).toBeTruthy();
    // the question is spoken, never on screen at PRE
    expect(screen.queryByText('Do these words rhyme?')).toBeNull();
  });

  it('answers with a picture 👍 / 👎 (tap = choose, no text buttons, no Check)', () => {
    render(<RhymeStudio data={recognition('K')} />);
    startActivity();
    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getByText('👎')).toBeTruthy();
    // the reader-grade text labels are absent
    expect(screen.queryByText('Yes!')).toBeNull();
    // a single tap on 👍 (doesRhyme=true) evaluates immediately
    fireEvent.click(screen.getByLabelText('Yes, they rhyme'));
    expect(tagsStarting('[ANSWER_CORRECT]')).toHaveLength(1);
  });

  it('hides adult chrome and the text feedback card', () => {
    render(<RhymeStudio data={recognition('K')} />);
    startActivity();
    expect(screen.queryByText(/Grade K/)).toBeNull();          // grade badge
    expect(screen.queryByText('Recognition')).toBeNull();      // mode badge
    expect(screen.queryByText(/1 \/ 1/)).toBeNull();           // challenge counter
    expect(screen.queryByText(/correct$/)).toBeNull();         // score ledger
    fireEvent.click(screen.getByLabelText('Yes, they rhyme')); // correct
    // no readable feedback card — ring/sound + spoken tutor carry it
    expect(screen.queryByText(/both end in/i)).toBeNull();
  });
});

describe('RhymeStudio @ PRE (Kindergarten) — identification', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('renders picture-primary option tiles and is tap = choose', () => {
    render(<RhymeStudio data={identification('K')} />);
    startActivity();
    expect(screen.getByText('🦇')).toBeTruthy(); // bat option
    expect(screen.getByText('🐶')).toBeTruthy(); // dog option
    expect(screen.queryByText(/Which word rhymes/)).toBeNull(); // question spoken
    // a single tap on the rhyming option (bat) evaluates immediately, no Check
    fireEvent.click(screen.getByRole('button', { name: /bat/ }));
    expect(tagsStarting('[ANSWER_CORRECT]')).toHaveLength(1);
  });

  it('a wrong tap does not fire ANSWER_CORRECT', () => {
    render(<RhymeStudio data={identification('K')} />);
    startActivity();
    fireEvent.click(screen.getByRole('button', { name: /dog/ })); // dog does not rhyme with cat
    expect(tagsStarting('[ANSWER_INCORRECT]')).toHaveLength(1);
    expect(tagsStarting('[ANSWER_CORRECT]')).toHaveLength(0);
  });
});

describe('RhymeStudio @ reader grade (control, Grade 1)', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('keeps the word-primary card, the text question, and chrome (no big emoji)', () => {
    render(<RhymeStudio data={recognition('1')} />);
    startActivity();
    expect(screen.getByText('Do these words rhyme?')).toBeTruthy();
    expect(screen.getByText('Yes!')).toBeTruthy();
    expect(screen.getAllByText(/Grade 1/).length).toBeGreaterThan(0);
    // emoji is a PRE-only affordance
    expect(screen.queryByText('🐱')).toBeNull();
    expect(screen.queryByText('👍')).toBeNull();
  });
});
