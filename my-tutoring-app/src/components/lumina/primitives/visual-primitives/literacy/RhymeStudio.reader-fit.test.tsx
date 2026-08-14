// @vitest-environment jsdom
/**
 * RhymeStudio render contract after the DI port (qa/di/BACKLOG.md item 16),
 * carrying forward the PRE-band reader-fit gates that survived it
 * (qa/reader-fit/rhyme-studio-PRE-2026-07-15.md).
 *
 * What this locks in:
 *  1. §1 GATE A — nothing on screen carries the child forward: no Start
 *     Activity, Next, Finish, Skip or Check. The tutor's verdict is the only
 *     advance.
 *  2. §1 GATE B — nothing names the answer before the child gives it. The rime
 *     highlight and the correct-card ring are post-verdict only, and the
 *     recognition pair shows no highlight on either card (the old surface
 *     painted the comparison card's rime only when the pair rhymed, so the
 *     highlight WAS the yes/no answer).
 *  3. The spoken modes keep their choices ON SCREEN but make nothing tappable:
 *     the cards are the closed set the child speaks from — the thing that keeps
 *     a spoken rhyme a benched response class — not a tap surface.
 *  4. Recognition keeps 👍 / 👎. They are DISABLED until the run starts, so no
 *     tap can commit before the tutor has asked.
 *  5. Pre-reader presentation: every word is picture-primary, adult chrome is
 *     hidden at K and present at a reader grade.
 *
 * The live loop itself is NOT driven here. It cannot be driven honestly in
 * jsdom (the mic never opens, the context refs never re-render), and a green
 * test that never fired the path is worse than no test — the pedagogy is
 * pinned in __tests__/RhymeStudio.di-script.test.ts instead.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

const submitGestureAttempt = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: () => ({
    voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
    queueCue: vi.fn(),
    submitGestureAttempt,
    sendCueNow: vi.fn(),
    clearQueuedCue: vi.fn(),
    arm: vi.fn(),
    disarm: vi.fn(),
    reset: vi.fn(),
    isAwaitingJudgment: () => false,
    config: {},
  }),
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

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import RhymeStudio, { type RhymeStudioData } from './RhymeStudio';

const recognition = (gradeLevel: 'K' | '1'): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [{
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
  }],
});

const identification = (gradeLevel: 'K' | '1'): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [{
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
  }],
});

const production = (): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel: '1',
  challenges: [{
    id: 'c1',
    mode: 'production',
    targetWord: 'sun',
    targetWordImage: 'a bright sun',
    rhymeFamily: '-un',
    acceptableAnswers: ['bun', 'run', 'fun'],
    bankDistractors: ['dog', 'book', 'milk'],
  }],
});

beforeEach(() => {
  sendText.mockClear();
  submitGestureAttempt.mockClear();
  ctxState.isListening = false;
});
afterEach(cleanup);

// ── GATE A: nothing on screen carries the child forward ─────────────────────

describe('RhymeStudio · the tutor owns the clock', () => {
  it('offers no Start, Next, Finish, Skip or Check anywhere', () => {
    render(<RhymeStudio data={recognition('K')} />);
    for (const label of [/^start activity$/i, /next/i, /finish/i, /skip/i, /check/i, /continue/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('the challenge is on screen immediately — no Start gate stands in front of it', () => {
    render(<RhymeStudio data={recognition('K')} />);
    expect(screen.getByText('🐱')).toBeTruthy();
  });
});

// ── GATE B: nothing names the answer before the child gives it ──────────────

describe('RhymeStudio · answer-leak', () => {
  it('recognition shows no rime highlight on either card before the verdict', () => {
    const { container } = render(<RhymeStudio data={recognition('1')} />);
    // The amber span is the rime split; at a reader grade it is the give-away.
    expect(container.querySelectorAll('.text-amber-300')).toHaveLength(0);
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('bat')).toBeTruthy();
  });

  it('identification rings no card before the verdict', () => {
    const { container } = render(<RhymeStudio data={identification('1')} />);
    expect(container.querySelectorAll('.ring-emerald-400\\/40')).toHaveLength(0);
  });

  it('the on-screen question restatement is gone — the tutor asks it', () => {
    render(<RhymeStudio data={identification('1')} />);
    expect(screen.queryByText(/Which word rhymes with/)).toBeNull();
    expect(screen.queryByText('Do these words rhyme?')).toBeNull();
  });
});

// ── The spoken modes: the set is shown, nothing is tapped ───────────────────

describe('RhymeStudio · the choices are a closed set, not a tap surface', () => {
  it('identification shows every choice and makes none of them a button', () => {
    render(<RhymeStudio data={identification('1')} />);
    expect(screen.getByText('bat')).toBeTruthy();
    expect(screen.getByText('dog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^bat$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^dog$/ })).toBeNull();
  });

  it('production shows the four-tile bank — the bank is what makes the mode sayable', () => {
    render(<RhymeStudio data={production()} />);
    for (const word of ['bun', 'run', 'dog', 'book']) {
      expect(screen.getByText(word)).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /^bun$/ })).toBeNull();
  });
});

// ── Nothing in this pack is answered with the hands ─────────────────────────

describe('RhymeStudio · every mode is answered aloud', () => {
  /**
   * REGRESSION. Recognition shipped with a 👍/👎 for one day. The user's first
   * drive removed it — *"we should just be able to say yes to the tutor"* — and
   * the session log showed the tap could not have survived anyway: asked a
   * spoken question, the child answered aloud, the silence contract had no line
   * for that, and the tutor improvised a verdict the engine could not read.
   */
  it('recognition offers NO thumbs — the answer is spoken', () => {
    render(<RhymeStudio data={recognition('K')} />);
    expect(screen.queryByLabelText('Yes, they rhyme')).toBeNull();
    expect(screen.queryByLabelText('No, they do not rhyme')).toBeNull();
    expect(screen.queryByText('👍')).toBeNull();
    expect(screen.queryByText('👎')).toBeNull();
  });

  it('the mic is the ONLY control on the stage, in every mode', () => {
    for (const data of [recognition('K'), identification('1'), production()]) {
      const { unmount } = render(<RhymeStudio data={data} />);
      // The cards repeat the question (role=button for tap-to-hear); no <button>
      // on the stage commits an answer, so nothing can be gesture-submitted.
      fireEvent.click(screen.getAllByRole('button')[0]);
      expect(submitGestureAttempt).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('tells the child how to answer recognition without printing the answer', () => {
    render(<RhymeStudio data={recognition('K')} />);
    expect(screen.getByText(/say yes or no/i)).toBeTruthy();
  });
});

// ── Band presentation ───────────────────────────────────────────────────────

describe('RhymeStudio · pre-reader band', () => {
  it('renders every word picture-primary and hides adult chrome at K', () => {
    render(<RhymeStudio data={identification('K')} />);
    expect(screen.getByText('🐱')).toBeTruthy();   // target
    expect(screen.getByText('🦇')).toBeTruthy();   // option
    expect(screen.getByText('🐶')).toBeTruthy();   // option
    expect(screen.queryByText(/Grade K/)).toBeNull();
    expect(screen.queryByText(/Find the Rhyme/)).toBeNull();
  });

  it('keeps the word-primary card and the chrome at a reader grade (control)', () => {
    render(<RhymeStudio data={recognition('1')} />);
    expect(screen.getAllByText(/Grade 1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Do They Rhyme\?/)).toBeTruthy();
    expect(screen.queryByText('🐱')).toBeNull();   // emoji is a PRE-only affordance
  });
});
