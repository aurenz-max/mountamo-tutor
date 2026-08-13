// @vitest-environment jsdom
/**
 * LetterSoundLink render contract after the DI port (qa/di/BACKLOG.md item 16),
 * carrying forward the PRE-band reader-fit gates that survived it
 * (qa/reader-fit/letter-sound-link-PRE-2026-07-14.md).
 *
 * What this locks in:
 *  1. §1 GATE A — nothing on screen carries the child forward: no Next,
 *     Finish, Skip or Check. The tutor's verdict is the only advance.
 *  2. §1 GATE B — nothing names the answer before the child gives it:
 *     - see-hear: the two SPEAKER BUBBLES are asserted GONE, not merely
 *       unused. They played the answer as audio and asked only for
 *       recognition — the mode now asks the child to produce the sound.
 *     - keyword-match: the two pictures are shown but their WORDS are not
 *       printed, and nothing about them is tappable (the answer is spoken).
 *     - every mode: the keyword anchor picture is absent pre-verdict. It
 *       encodes the sound, so showing it early is the same leak as saying it.
 *  3. hear-see keeps its two letter buttons — that IS its answer surface,
 *     because a letter NAME has no reliable judge — and they are DISABLED
 *     until the run starts, so no tap can commit before the tutor has asked.
 *  4. Adult chrome is hidden at grade K and present at a reader grade.
 *
 * The live loop itself is NOT driven here. It cannot be driven honestly in
 * jsdom (the mic never opens, the context refs never re-render), and a green
 * test that never fired the path is worse than no test — the pedagogy is
 * pinned in LetterSoundLink.di-script.test.ts instead.
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
vi.mock('../../../../hooks/useJudgedSpeechLoop', () => ({
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

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import LetterSoundLink, {
  type LetterSoundLinkChallenge,
  type LetterSoundLinkData,
} from '../LetterSoundLink';

const SAY_SOUND: LetterSoundLinkChallenge = {
  id: 'ch1', mode: 'see-hear', targetLetter: 's', targetSound: '/s/',
  keywordWord: 'sun', keywordImage: 'sun',
};
const FIND_LETTER: LetterSoundLinkChallenge = {
  id: 'ch2', mode: 'hear-see', targetLetter: 't', targetSound: '/t/',
  keywordWord: 'top', keywordImage: 'top',
  options: [{ letter: 't', isCorrect: true }, { letter: 'd', isCorrect: false }],
};
const SAY_WORD: LetterSoundLinkChallenge = {
  id: 'ch3', mode: 'keyword-match', targetLetter: 'm', targetSound: '/m/',
  keywordWord: 'map', keywordImage: 'map',
  options: [{ sound: 'map', isCorrect: true }, { sound: 'net', isCorrect: false }],
};

const makeData = (
  gradeLevel: string,
  challenges: LetterSoundLinkChallenge[] = [SAY_SOUND],
): LetterSoundLinkData => ({
  title: 'Letter Sounds',
  letterGroup: 1,
  cumulativeLetters: ['s', 'a', 't', 'i', 'p', 'n'],
  gradeLevel,
  challenges,
});

beforeEach(() => {
  sendText.mockClear();
  submitGestureAttempt.mockClear();
  ctxState.isListening = false;
});
afterEach(cleanup);

// ── GATE A: nothing on screen carries the child forward ─────────────────────

describe('LetterSoundLink · the tutor owns the clock', () => {
  it('offers no Next, Finish, Skip or Check anywhere', () => {
    render(<LetterSoundLink data={makeData('K', [SAY_SOUND, FIND_LETTER, SAY_WORD])} />);
    for (const label of [/next/i, /finish/i, /skip/i, /check/i, /continue/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });
});

// ── GATE B: nothing names the answer before the child gives it ──────────────

describe('LetterSoundLink · answer-leak', () => {
  it('see-hear: the speaker bubbles are GONE — the child produces the sound', () => {
    render(<LetterSoundLink data={makeData('K')} />);
    // The letter (the stimulus) is on screen…
    expect(screen.getByText('S')).toBeTruthy();
    // …and the two audio options that used to play the answer are not.
    expect(screen.queryByText('tap to hear')).toBeNull();
    expect(screen.queryByText('tap to choose')).toBeNull();
    expect(screen.queryByText('/s/')).toBeNull();
    expect(screen.queryByText('/t/')).toBeNull();
  });

  it('no keyword anchor appears before a verdict, in any mode', () => {
    render(<LetterSoundLink data={makeData('K', [SAY_SOUND])} />);
    expect(screen.queryByText('sun')).toBeNull();
    expect(screen.queryByText('☀️')).toBeNull();
    cleanup();

    render(<LetterSoundLink data={makeData('K', [FIND_LETTER])} />);
    expect(screen.queryByText('top')).toBeNull();
    expect(screen.queryByText('🔝')).toBeNull();
  });

  it('keyword-match: pictures show, words do not, and nothing is tappable', () => {
    render(<LetterSoundLink data={makeData('K', [SAY_WORD])} />);
    expect(screen.getByText('🗺️')).toBeTruthy();
    expect(screen.getByText('🥅')).toBeTruthy();
    expect(screen.queryByText('map')).toBeNull();
    expect(screen.queryByText('net')).toBeNull();
    // The only button on the stage is the mic (the answer is SPOKEN).
    expect(screen.queryByRole('button', { name: /map|net/i })).toBeNull();
  });
});

// ── The one gesture direction ───────────────────────────────────────────────

describe('LetterSoundLink · hear-see keeps its hands', () => {
  it('renders both letters — a letter NAME has no judge, so the grapheme is touched', () => {
    render(<LetterSoundLink data={makeData('K', [FIND_LETTER])} />);
    expect(screen.getByRole('button', { name: 'T' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'D' })).toBeTruthy();
  });

  it('the letters are DISABLED until the run starts — no tap can beat the ask', () => {
    render(<LetterSoundLink data={makeData('K', [FIND_LETTER])} />);
    const target = screen.getByRole('button', { name: 'T' }) as HTMLButtonElement;
    expect(target.disabled).toBe(true);
    fireEvent.click(target);
    expect(submitGestureAttempt).not.toHaveBeenCalled();
  });
});

// ── Band chrome ─────────────────────────────────────────────────────────────

describe('LetterSoundLink · pre-reader chrome gate', () => {
  it('hides adult chrome at grade K', () => {
    render(<LetterSoundLink data={makeData('K')} />);
    expect(screen.queryByText('Group 1')).toBeNull();
    expect(screen.queryByText(/Say the Sound/)).toBeNull();
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('keeps the chrome at a reader grade (control)', () => {
    render(<LetterSoundLink data={makeData('2')} />);
    expect(screen.getByText('Group 1')).toBeTruthy();
    expect(screen.getByText(/Say the Sound/)).toBeTruthy();
  });
});
