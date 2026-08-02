// @vitest-environment jsdom
/**
 * RhymeStudio — support tiers (difficulty = scaffold withdrawal) + the recognition
 * answer-leak regression.
 *
 * WHAT THIS LOCKS DOWN
 *  1. ANSWER LEAK (rule-#1 class): recognition used to paint the amber rime
 *     highlight on the comparison card ONLY when doesRhyme was true — the
 *     highlight WAS the yes/no answer. Pre-answer there must be NO rime highlight
 *     on either card, for either value of doesRhyme. Post-resolution reveal is fine.
 *  2. LEGACY DEFAULT: a payload with none of the tier fields renders full help —
 *     rime highlight, instruction restatement, image captions, 2-correct bank.
 *  3. HARD WITHDRAWAL: the tier fields hide the highlight, the restatements and the
 *     captions, drop the bank to 1 correct + 3 distractors, and stop the tutor from
 *     enumerating the answer choices.
 *  4. BAND WINS: at PRE (K) the picture surface and the tutor's read-aloud of the
 *     choices survive a hard tier — a non-reader has no other channel.
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

type Scaffold = Partial<{
  showRhymeFamilyHighlight: boolean;
  showWordImage: boolean;
  showInstructionText: boolean;
  tutorNamesOptions: boolean;
  productionCorrectCount: number;
}>;

const recognition = (
  gradeLevel: 'K' | '1',
  doesRhyme: boolean,
  scaffold: Scaffold = {},
): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [{
    id: 'c1',
    mode: 'recognition',
    targetWord: 'cat',
    targetWordImage: 'a cute cat',
    targetWordEmoji: '🐱',
    rhymeFamily: '-at',
    comparisonWord: doesRhyme ? 'bat' : 'dog',
    comparisonWordImage: doesRhyme ? 'a fruit bat' : 'a happy dog',
    comparisonWordEmoji: doesRhyme ? '🦇' : '🐶',
    doesRhyme,
    ...scaffold,
  }],
});

const identification = (gradeLevel: 'K' | '1', scaffold: Scaffold = {}): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [{
    id: 'c1',
    mode: 'identification',
    targetWord: 'cat',
    targetWordImage: 'a cute cat',
    targetWordEmoji: '🐱',
    rhymeFamily: '-at',
    options: [
      { word: 'bat', image: gradeLevel === 'K' ? '🦇' : 'a fruit bat', isCorrect: true },
      { word: 'dog', image: gradeLevel === 'K' ? '🐶' : 'a happy dog', isCorrect: false },
    ],
    ...scaffold,
  }],
});

const ACCEPTABLE = ['bat', 'hat', 'mat', 'sat'];

const production = (scaffold: Scaffold = {}): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel: '1',
  challenges: [{
    id: 'c1',
    mode: 'production',
    targetWord: 'cat',
    targetWordImage: 'a cute cat',
    rhymeFamily: '-at',
    acceptableAnswers: ACCEPTABLE,
    ...scaffold,
  }],
});

const startActivity = () => fireEvent.click(screen.getAllByRole('button')[0]);

/** Every amber rime-highlight span currently painted. */
const amberCount = (container: HTMLElement) =>
  container.querySelectorAll('.text-amber-300').length;

/** The production word-bank tiles (all buttons after the activity has started). */
const bankWords = () =>
  screen.getAllByRole('button').map(b => (b.textContent ?? '').trim());

const sentTagged = (prefix: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(prefix));

beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
afterEach(cleanup);

// ---------------------------------------------------------------------------
// 1. ANSWER-LEAK REGRESSION (recognition)
// ---------------------------------------------------------------------------
describe('RhymeStudio recognition — rime highlight is not the answer', () => {
  it('paints NO rime highlight pre-answer when the pair DOES rhyme', () => {
    const { container } = render(<RhymeStudio data={recognition('1', true)} />);
    startActivity();
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('bat')).toBeTruthy();
    // Before the fix the rhyming pair lit up BOTH cards (2 amber spans).
    expect(amberCount(container)).toBe(0);
  });

  it('paints NO rime highlight pre-answer when the pair does NOT rhyme', () => {
    const { container } = render(<RhymeStudio data={recognition('1', false)} />);
    startActivity();
    // Before the fix the target card alone lit up (1 amber span) — the asymmetry
    // between this case and the rhyming case was the leak.
    expect(amberCount(container)).toBe(0);
  });

  it('reveals the shared rime only AFTER the challenge resolves', () => {
    const { container } = render(<RhymeStudio data={recognition('1', true)} />);
    startActivity();
    expect(amberCount(container)).toBe(0);
    fireEvent.click(screen.getByLabelText('Yes, they rhyme'));
    // resolved → both cards show the shared -at rime as feedback
    expect(amberCount(container)).toBe(2);
  });

  it('the leak-free render is identical for rhyming and non-rhyming pairs', () => {
    const { container: yes, unmount } = render(<RhymeStudio data={recognition('1', true)} />);
    startActivity();
    const yesAmber = amberCount(yes);
    unmount();
    const { container: no } = render(<RhymeStudio data={recognition('1', false)} />);
    startActivity();
    expect(amberCount(no)).toBe(yesAmber);
  });
});

// ---------------------------------------------------------------------------
// 2. LEGACY DEFAULT — no tier fields ⇒ full help
// ---------------------------------------------------------------------------
describe('RhymeStudio legacy default (no tier fields) — full help', () => {
  it('identification keeps the rime highlight, the question and the image caption', () => {
    const { container } = render(<RhymeStudio data={identification('1')} />);
    startActivity();
    // target card suffix + the amber target word inside the question
    expect(amberCount(container)).toBe(2);
    expect(screen.getByText(/Which word rhymes with/)).toBeTruthy();
    expect(screen.getByText('a fruit bat')).toBeTruthy();   // option image caption
    expect(screen.getByText('a cute cat')).toBeTruthy();    // target image caption
  });

  it('production keeps the instruction line and a 2-correct / 2-distractor bank', () => {
    render(<RhymeStudio data={production()} />);
    startActivity();
    expect(screen.getByText(/Pick a word that rhymes with/)).toBeTruthy();
    const words = bankWords();
    expect(words).toHaveLength(4);
    expect(words.filter(w => ACCEPTABLE.includes(w))).toHaveLength(2);
  });

  it('the tutor enumerates the answer choices', () => {
    render(<RhymeStudio data={identification('1')} />);
    startActivity();
    const [start] = sentTagged('[ACTIVITY_START]');
    expect(start).toContain('bat');
    expect(start).toContain('dog');
    expect(start).not.toContain('Do NOT read the answer choices aloud');
    // no tier ⇒ no reveal-policy rider at all
    expect(start).not.toContain('[SUPPORT_TIER');
  });
});

// ---------------------------------------------------------------------------
// 3. HARD TIER — withdrawal
// ---------------------------------------------------------------------------
const HARD: Scaffold = {
  showRhymeFamilyHighlight: false,
  showWordImage: false,
  showInstructionText: false,
  tutorNamesOptions: false,
};

describe('RhymeStudio hard tier — scaffolds withdrawn', () => {
  it('identification hides the rime highlight, the question and the captions', () => {
    const { container } = render(<RhymeStudio data={identification('1', HARD)} />);
    startActivity();
    expect(amberCount(container)).toBe(0);
    expect(screen.queryByText(/Which word rhymes with/)).toBeNull();
    expect(screen.queryByText('a fruit bat')).toBeNull();
    expect(screen.queryByText('a cute cat')).toBeNull();
    // the stimulus + the answer options themselves are NEVER withdrawn
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByRole('button', { name: /bat/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /dog/ })).toBeTruthy();
  });

  it('recognition hides the question but keeps both word cards and Yes/No', () => {
    render(<RhymeStudio data={recognition('1', true, HARD)} />);
    startActivity();
    expect(screen.queryByText('Do these words rhyme?')).toBeNull();
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('bat')).toBeTruthy();
    expect(screen.getByLabelText('Yes, they rhyme')).toBeTruthy();
    expect(screen.getByLabelText('No, they do not rhyme')).toBeTruthy();
  });

  it('production drops to 1 correct + 3 distractors, same bank size', () => {
    render(<RhymeStudio data={production({ ...HARD, productionCorrectCount: 1 })} />);
    startActivity();
    expect(screen.queryByText(/Pick a word that rhymes with/)).toBeNull();
    const words = bankWords();
    expect(words).toHaveLength(4);
    // the correct answer is ALWAYS present — only the hit rate drops
    expect(words.filter(w => ACCEPTABLE.includes(w))).toHaveLength(1);
  });

  it('the tutor stops enumerating the answer choices', () => {
    render(<RhymeStudio data={identification('1', HARD)} />);
    startActivity();
    const [start] = sentTagged('[ACTIVITY_START]');
    expect(start).toContain('Do NOT read the answer choices aloud');
    expect(start).not.toContain('the options: bat');
    expect(start).not.toContain('the options: dog');
  });

  it('threads the tier reveal policy to the tutor', () => {
    const data = { ...identification('1', HARD), supportTier: 'hard' as const };
    render(<RhymeStudio data={data} />);
    startActivity();
    const [start] = sentTagged('[ACTIVITY_START]');
    expect(start).toContain('[SUPPORT_TIER hard]');
    expect(start).toContain('never say which word is the answer');
  });
});

// ---------------------------------------------------------------------------
// 4. BAND SUPPORTS WIN at PRE (K)
// ---------------------------------------------------------------------------
describe('RhymeStudio @ PRE — band supports survive a hard tier', () => {
  it('keeps the picture surface even when showWordImage is withdrawn', () => {
    render(<RhymeStudio data={identification('K', HARD)} />);
    startActivity();
    expect(screen.getByText('🐱')).toBeTruthy();  // target picture
    expect(screen.getByText('🦇')).toBeTruthy();  // option pictures — the answer surface
    expect(screen.getByText('🐶')).toBeTruthy();
  });

  it('keeps the tutor read-aloud of the choices even when tutorNamesOptions is false', () => {
    render(<RhymeStudio data={identification('K', HARD)} />);
    startActivity();
    const [start] = sentTagged('[ACTIVITY_START]');
    expect(start).toContain('bat');
    expect(start).toContain('dog');
    expect(start).not.toContain('Do NOT read the answer choices aloud');
  });

  it('keeps the recognition picture cards and 👍/👎 answer surface', () => {
    render(<RhymeStudio data={recognition('K', true, HARD)} />);
    startActivity();
    expect(screen.getByText('🐱')).toBeTruthy();
    expect(screen.getByText('🦇')).toBeTruthy();
    expect(screen.getByText('👍')).toBeTruthy();
    expect(screen.getByText('👎')).toBeTruthy();
  });
});
