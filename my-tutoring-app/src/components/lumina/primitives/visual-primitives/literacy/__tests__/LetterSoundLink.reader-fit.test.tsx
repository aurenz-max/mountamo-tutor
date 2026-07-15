// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for letter-sound-link @ PRE
 * (qa/reader-fit/letter-sound-link-PRE-2026-07-14.md). The PRE contract:
 *  1. Adult chrome + the 10px two-tap protocol text are gone at gradeLevel 'K'
 *     (Group/mode badges, counter, "tap to hear"/"tap to choose", footer + task
 *     sentences) — replaced by wordless ear→check glyphs and the spoken tutor beat.
 *  2. The audition-then-commit two-tap still WORKS (rule 2 permits a multi-part
 *     confirm) — first tap previews ([TAP_OPTION]), second tap on the same option
 *     confirms and reaches [ANSWER_CORRECT] + the production beat.
 *  3. Reader grades (control) keep the original text protocol + chrome.
 *
 * External hooks (live tutor, evaluation, audio, spoken judge) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isConnected: true }),
}));

const submitSpy = vi.hoisted(() => vi.fn());
vi.mock('../../../../evaluation', async () => {
  const ReactMod = await import('react');
  return {
    usePrimitiveEvaluation: () => {
      const [hasSubmitted, setHasSubmitted] = ReactMod.useState(false);
      return {
        submitResult: (...args: unknown[]) => { submitSpy(...args); setHasSubmitted(true); },
        hasSubmitted,
        submittedResult: null,
        elapsedMs: 0,
      };
    },
    useEvaluationContext: () => null,
  };
});

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

// No mic → the production beat falls back to a prominent Next/Finish button,
// keeping the advance flow deterministic for this test.
vi.mock('../../../../hooks/useSpokenWordCapture', () => ({
  useSpokenWordCapture: () => ({
    state: 'idle', level: 0, isSupported: false,
    start: vi.fn(), cancel: vi.fn(),
  }),
}));

import LetterSoundLink, { type LetterSoundLinkData } from '../LetterSoundLink';

const makeData = (gradeLevel: string): LetterSoundLinkData => ({
  title: 'Letter Sounds',
  letterGroup: 1,
  cumulativeLetters: ['s', 'a', 't', 'i', 'p', 'n'],
  gradeLevel,
  challenges: [
    {
      id: 'ch1', mode: 'see-hear', targetLetter: 's', targetSound: '/s/',
      keywordWord: 'sun', keywordImage: 'sun',
      options: [{ sound: '/s/', isCorrect: true }, { sound: '/t/', isCorrect: false }],
    },
    {
      id: 'ch2', mode: 'see-hear', targetLetter: 't', targetSound: '/t/',
      keywordWord: 'top', keywordImage: 'top',
      options: [{ sound: '/t/', isCorrect: true }, { sound: '/p/', isCorrect: false }],
    },
  ],
});

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

describe('LetterSoundLink @ PRE (gradeLevel K)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hides adult chrome and the unreadable two-tap protocol text', () => {
    render(<LetterSoundLink data={makeData('K')} />);
    expect(screen.queryByText('Group 1')).toBeNull();
    expect(screen.queryByText('See → Hear')).toBeNull();       // mode badge
    expect(screen.queryByText('tap to hear')).toBeNull();
    expect(screen.queryByText('tap to choose')).toBeNull();
    expect(screen.queryByText(/Tap each speaker to hear the sound/)).toBeNull();
    expect(screen.queryByText('Which sound does this letter make?')).toBeNull();
    // the target letter (the stimulus) still shows
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('audition-then-commit: first tap previews, second tap confirms and reaches the production beat', () => {
    render(<LetterSoundLink data={makeData('K')} />);
    // pre-lock, the only interactive buttons are the two speaker bubbles
    let bubbles = screen.getAllByRole('button');
    expect(bubbles).toHaveLength(2);

    fireEvent.click(bubbles[0]);                 // first tap → preview
    expect(tagged('[TAP_OPTION]')).toHaveLength(1);
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(0);

    bubbles = screen.getAllByRole('button');     // re-query after re-render
    fireEvent.click(bubbles[0]);                 // second tap on same → commit
    expect(tagged('[ANSWER_CORRECT]')).toHaveLength(1);

    // locked but not complete (2 challenges) → prominent Next appears
    expect(screen.getByRole('button', { name: /Next Challenge/ })).toBeTruthy();
  });

  it('completing both challenges submits the evaluation', () => {
    render(<LetterSoundLink data={makeData('K')} />);
    // ch1: audition + commit correct
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Next Challenge/ }));
    // ch2: audition + commit correct → Finish
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(submitSpy).toHaveBeenCalled();
    expect(tagged('[ALL_COMPLETE]')).toHaveLength(1);
  });
});

describe('LetterSoundLink @ reader grade (control, gradeLevel 2)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('keeps the original text protocol + chrome', () => {
    render(<LetterSoundLink data={makeData('2')} />);
    expect(screen.getByText('Group 1')).toBeTruthy();
    expect(screen.getAllByText('tap to hear').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tap each speaker to hear the sound/)).toBeTruthy();
    expect(screen.getByText('Which sound does this letter make?')).toBeTruthy();
  });
});
