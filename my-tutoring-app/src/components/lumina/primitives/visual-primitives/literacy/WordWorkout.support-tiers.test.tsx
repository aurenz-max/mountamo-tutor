// @vitest-environment jsdom
/**
 * Support-tier (scaffolding-withdrawal) behaviour for WordWorkout — DI modality
 * surface (sixteenth literacy port).
 *
 * ONE LEVER SURVIVED THE PORT, and this file is where that is recorded rather
 * than merely asserted. `chainCueLevel` now drives TWO channels:
 *   1. on screen — the amber changed-letter highlight and the "a → o" delta chip
 *      (full → highlight-only → none);
 *   2. in the ASK — whether the chain correction names what changed at all,
 *      pinned in WordWorkout.di-script.test.ts, because at 'none' noticing the
 *      change IS the task and a tutor that named it would hand back exactly the
 *      scaffold the tier removed.
 *
 * THE OTHER THREE LEVERS ARE GONE, and their old tests are replaced by
 * REGRESSION PINS rather than deleted — each one withdrew an affordance the
 * judged loop deletes outright, so the honest successor assert is "it cannot
 * come back at any tier":
 *   - `allowPronounce` withdrew the per-card speaker buttons. Hearing "cat"
 *     beside "zat" decides that item with zero decoding: a scaffold that fails
 *     the costume test is not a tier lever.
 *   - `allowSentenceModelRead` withdrew the whole-sentence model read, which is
 *     the answer to "read this sentence".
 *   - `comprehensionChoiceCount` sized an answer menu the child now says aloud.
 *   - `showInstruction` withdrew an on-screen instruction line; the tutor speaks
 *     the ask now, and the fade is structural (how-to-play on the opening and on
 *     an action change, short repeat asks after).
 *
 * The runner is mocked to a static "item open, asking" state — this file tests
 * the RENDER halves only; loop behaviour has its own suites.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

const runnerState = vi.hoisted(() => ({ index: 0, solved: false }));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (opts: { pack: { items: unknown[] } }) => ({
    running: true,
    preparing: false,
    stage: 'asking',
    statusLine: '',
    currentIndex: runnerState.index,
    currentItem: opts.pack.items[runnerState.index] ?? null,
    solvedIds: new Set<string>(),
    currentSolved: runnerState.solved,
    canAttempt: true,
    summary: null,
    micState: 'idle' as const,
    tutorSpeaking: false,
    cuedItemId: null,
    cancelListening: undefined,
    start: async () => {},
    hearStimulus: () => {},
    stimulusTapped: false,
    submitGestureAttempt: () => {},
    isAwaitingGesture: () => false,
    loop: {},
  }),
}));

vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import WordWorkout, { type WordWorkoutChallenge, type WordWorkoutData } from './WordWorkout';

const dataOf = (challenge: WordWorkoutChallenge, mode: WordWorkoutData['mode']): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode,
  masteredVowels: ['a', 'o'],
  gradeLevel: '1',
  challenges: [challenge],
});

const CHAIN: WordWorkoutChallenge = {
  id: 'c1', mode: 'word-chains', chain: ['cat', 'hat', 'hot', 'hop'], changedPositions: [0, 1, 2],
};
const REAL_NONSENSE: WordWorkoutChallenge = {
  id: 'c1', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat',
};
const SENTENCE: WordWorkoutChallenge = {
  id: 'c1',
  mode: 'sentence-reading',
  sentence: 'The cat sat on the mat.',
  cvcWords: ['cat', 'sat', 'mat'],
  sightWords: ['the', 'on'],
  comprehensionQuestion: 'Where did the cat sit?',
  comprehensionAnswer: 'mat',
};
const PICTURE: WordWorkoutChallenge = {
  id: 'c1',
  mode: 'picture-match',
  targetWord: 'pig',
  targetImage: '🐷',
  distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }],
};

/** Render a chain at the word whose letter change is visible (index 2 = "hot",
 *  the middle-letter step), which is where every cue lever shows. */
const renderChainAt = (chainCueLevel: WordWorkoutChallenge['chainCueLevel'], index = 2) => {
  runnerState.index = index;
  runnerState.solved = false;
  return render(<WordWorkout data={dataOf({ ...CHAIN, chainCueLevel }, 'word-chains')} />);
};

afterEach(() => {
  cleanup();
  runnerState.index = 0;
  runnerState.solved = false;
});

describe('word-workout — #1 chainCueLevel, the surviving render lever', () => {
  it("'full' (easy) keeps both the amber highlight and the delta chip", () => {
    const { container } = renderChainAt('full');
    expect(container.querySelectorAll('.text-amber-300').length).toBeGreaterThan(0);
    expect(screen.getByText(/a\s*→\s*o/)).toBeTruthy();
  });

  it("'highlight-only' (medium) keeps the amber highlight and drops the delta chip", () => {
    const { container } = renderChainAt('highlight-only');
    expect(container.querySelectorAll('.text-amber-300').length).toBeGreaterThan(0);
    expect(screen.queryByText(/a\s*→\s*o/)).toBeNull();
  });

  it("'none' (hard) withdraws BOTH cues — the chain words still render", () => {
    const { container } = renderChainAt('none');
    expect(container.querySelectorAll('.text-amber-300').length).toBe(0);
    expect(screen.queryByText(/a\s*→\s*o/)).toBeNull();
    // The stimulus is never withdrawn: every word of the chain is still printed.
    for (const word of ['cat', 'hat', 'hot', 'hop']) {
      expect(screen.getByText((_, node) => node?.textContent === word)).toBeTruthy();
    }
  });

  it('absent field ⇒ full cues (an unstamped fallback keeps its scaffolding)', () => {
    const { container } = renderChainAt(undefined);
    expect(container.querySelectorAll('.text-amber-300').length).toBeGreaterThan(0);
    expect(screen.getByText(/a\s*→\s*o/)).toBeTruthy();
  });
});

describe('word-workout — the deleted levers cannot come back at any tier', () => {
  it('REGRESSION: real-vs-nonsense renders NO speaker button (allowPronounce is gone)', () => {
    // The click era let the child hear both words at easy/medium, which decides
    // "which is real" from oral vocabulary with no decoding at all.
    runnerState.index = 0;
    const { container } = render(<WordWorkout data={dataOf(REAL_NONSENSE, 'real-vs-nonsense')} />);
    expect(screen.queryByRole('button', { name: /hear (cat|zat)/i })).toBeNull();
    // …and the two words are not tappable either: the answer is spoken.
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('zat')).toBeTruthy();
  });

  it('REGRESSION: sentence-reading renders NO model read and no per-word tap-to-hear', () => {
    runnerState.index = 0;
    render(<WordWorkout data={dataOf(SENTENCE, 'sentence-reading')} />);
    expect(screen.queryByRole('button', { name: /hear the sentence/i })).toBeNull();
    expect(screen.queryByText(/tap any word to hear it/i)).toBeNull();
    // Every word renders as text, none of it as a button — a channel that
    // speaks any word on demand lets a child hear the line and echo it.
    for (const word of ['The', 'cat', 'sat', 'mat.']) {
      expect(screen.getByText(word)).not.toHaveProperty('tagName', 'BUTTON');
    }
  });

  it('REGRESSION: the comprehension answer menu is gone — the child says it', () => {
    runnerState.index = 1; // the answer_question item
    render(<WordWorkout data={dataOf(SENTENCE, 'sentence-reading')} />);
    expect(screen.getByText('Where did the cat sit?')).toBeTruthy();
    // No chips: the old menu printed the answer for any reader.
    expect(screen.queryAllByRole('button', { name: /^(mat|cat|sat)$/ })).toHaveLength(0);
  });

  it('REGRESSION: no on-screen instruction line survives on any mode', () => {
    // showInstruction's successor is structural: the tutor speaks the ask, the
    // how-to-play rides the opening and action changes, and repeats are short.
    for (const [challenge, mode] of [
      [REAL_NONSENSE, 'real-vs-nonsense'],
      [PICTURE, 'picture-match'],
      [CHAIN, 'word-chains'],
      [SENTENCE, 'sentence-reading'],
    ] as const) {
      runnerState.index = 0;
      const { unmount } = render(<WordWorkout data={dataOf(challenge, mode)} />);
      expect(screen.queryByText(/which is a real word|which picture matches|read each word as it changes|^read this sentence$/i))
        .toBeNull();
      unmount();
    }
  });
});

describe('word-workout — the answer is never marked before the tutor affirms', () => {
  it('picture-match rings the right picture only on the affirm', () => {
    runnerState.index = 0;
    runnerState.solved = false;
    const { container, rerender } = render(<WordWorkout data={dataOf(PICTURE, 'picture-match')} />);
    expect(container.querySelectorAll('.ring-emerald-400\\/40').length).toBe(0);
    runnerState.solved = true;
    rerender(<WordWorkout data={dataOf(PICTURE, 'picture-match')} />);
    expect(container.querySelectorAll('.ring-emerald-400\\/40').length).toBe(1);
  });

  it('the comprehension answer is not highlighted inside the sentence before the affirm', () => {
    runnerState.index = 1;
    runnerState.solved = false;
    const { rerender } = render(<WordWorkout data={dataOf(SENTENCE, 'sentence-reading')} />);
    expect(screen.getByText('mat.').className).not.toMatch(/emerald/);
    runnerState.solved = true;
    rerender(<WordWorkout data={dataOf(SENTENCE, 'sentence-reading')} />);
    expect(screen.getByText('mat.').className).toMatch(/emerald/);
  });

  it('the phonics tint rides the READ only — on the question it would point at the answer', () => {
    // With few decodable words surviving the build gate, a blue-tinted CVC set
    // can be a pointer. The read needs the tint; the question must not have it.
    runnerState.index = 0;
    const { container, unmount } = render(<WordWorkout data={dataOf(SENTENCE, 'sentence-reading')} />);
    expect(container.querySelectorAll('.text-blue-200').length).toBeGreaterThan(0);
    unmount();
    runnerState.index = 1;
    const second = render(<WordWorkout data={dataOf(SENTENCE, 'sentence-reading')} />);
    expect(second.container.querySelectorAll('.text-blue-200').length).toBe(0);
  });
});
