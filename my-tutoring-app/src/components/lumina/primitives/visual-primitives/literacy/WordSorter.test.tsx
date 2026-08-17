// @vitest-environment jsdom
/**
 * WordSorter render contract after the DI port (qa/di/BACKLOG.md item 16).
 *
 * This suite is the click-era render suite REWRITTEN, not replaced: every intent
 * it pinned still has a home. The support-tier levers it tested (bucket picture
 * cues, filed-word badges, the K band floor, match-column distractors) all
 * survived the port as RENDER levers and are re-pinned below on the new surface;
 * the ones that were about TAPPING — a correct bucket tap filing a word, a wrong
 * tap emitting a spoken hint, the named error line — are gone with the taps, and
 * what replaced them (the spoken judging contract, the correction wording) is
 * pinned in `__tests__/WordSorter.di-script.test.ts`.
 *
 * What this locks in:
 *  1. NOTHING ON SCREEN CARRIES THE CHILD FORWARD: no Next, Finish, Skip or
 *     Check, and no bucket, mat or bank entry is clickable. The tutor's verdict
 *     is the only advance, and the only answer channel is the child's voice.
 *  2. The stimulus is on screen and the ANSWER is not: the word card prints the
 *     word (it is the question in every mode), and no mat or bank entry is
 *     marked correct before the tutor affirms.
 *  3. The support-tier render levers, unchanged in meaning:
 *     - `showBucketEmojis` — the mat picture cue, FORCED ON at Kindergarten
 *       whatever the payload says (the pre-reader's way into a mat).
 *     - `showFiledWords` — the placed-word badges; withdrawn at hard, which on
 *       a match challenge is also what withdraws the elimination information
 *       from a bank that deliberately never shrinks.
 *     - `distractorMatches` — decoys sit in the bank beside every correct
 *       partner, indistinguishable from them.
 *  4. Adult chrome is hidden at Kindergarten.
 *
 * The live loop itself is NOT driven here. It cannot be driven honestly in jsdom
 * (the mic never opens, the context refs never re-render), and a green test that
 * never fired the path is worse than no test.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
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

vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: () => ({
    voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
    queueCue: vi.fn(),
    submitGestureAttempt: vi.fn(),
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

import WordSorter, { type WordSorterChallenge, type WordSorterData } from './WordSorter';

// ── Fixtures ────────────────────────────────────────────────────────────────

const SORT: WordSorterChallenge = {
  id: 'ch1',
  type: 'binary_sort',
  instruction: 'Sort these words into animals and food',
  bucketLabels: ['Animals', 'Food'],
  bucketEmojis: ['🐾', '🍎'],
  words: [
    { id: 'w0', word: 'dog', emoji: '🐕', correctBucket: 'Animals' },
    { id: 'w1', word: 'bread', emoji: '🍞', correctBucket: 'Food' },
    { id: 'w2', word: 'cat', emoji: '🐈', correctBucket: 'Animals' },
  ],
};

const MATCH: WordSorterChallenge = {
  id: 'ch2',
  type: 'match_pairs',
  instruction: 'Match each word with its opposite',
  relationLabel: 'opposite',
  pairs: [
    { id: 'p0', term: 'big', match: 'small' },
    { id: 'p1', term: 'hot', match: 'cold' },
    { id: 'p2', term: 'up', match: 'down' },
  ],
};

const makeData = (
  gradeLevel: string,
  challenges: WordSorterChallenge[] = [SORT],
  supportTier?: WordSorterData['supportTier'],
): WordSorterData => ({
  title: 'Word Sorting',
  gradeLevel,
  sortingTopic: 'Animals and Food',
  ...(supportTier ? { supportTier } : {}),
  challenges,
});

beforeEach(() => {
  sendText.mockClear();
  ctxState.isListening = false;
});
afterEach(cleanup);

// ── 1. The tutor owns the clock, and the voice is the only answer channel ───

describe('WordSorter · the tutor owns the clock', () => {
  it('offers no Next, Finish, Skip or Check anywhere', () => {
    render(<WordSorter data={makeData('1', [SORT, MATCH])} />);
    for (const label of [/next/i, /finish/i, /skip/i, /check/i, /continue/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  /**
   * The click era's answer surface was the mats: tap one and the word filed.
   * That failed the costume test — a child who cannot categorise could still
   * land a bucket at a 1-in-2 floor with instant feedback and re-tap — so the
   * mats are printed material now and nothing about them commits an answer.
   */
  it('renders the mats as printed material, with nothing to tap', () => {
    render(<WordSorter data={makeData('1')} />);
    expect(screen.getByText('Animals')).toBeTruthy();
    expect(screen.getByText('Food')).toBeTruthy();
    for (const label of [/animals/i, /food/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('renders the word bank as printed material, with nothing to tap', () => {
    render(<WordSorter data={makeData('1', [MATCH])} />);
    for (const partner of ['small', 'cold', 'down']) {
      expect(screen.getByText(partner)).toBeTruthy();
      expect(screen.queryByRole('button', { name: new RegExp(`^${partner}$`, 'i') })).toBeNull();
    }
  });

  /** The two affordances that survive are both question-side. (The orb itself
   *  returns null in jsdom — no `navigator.mediaDevices` — so the panel is
   *  pinned by its status line, which is the runner's.) */
  it('keeps exactly the question-side affordances: hear-it-again and the mic panel', () => {
    render(<WordSorter data={makeData('1')} />);
    expect(screen.getByLabelText(/hear the question again/i)).toBeTruthy();
    expect(screen.getByText(/tap the microphone to start sorting/i)).toBeTruthy();
  });
});

// ── 2. The stimulus is on screen; the answer is not ─────────────────────────

describe('WordSorter · what is on screen before a verdict', () => {
  it('prints the word and its picture — the word is the QUESTION in every mode', () => {
    render(<WordSorter data={makeData('K')} />);
    expect(screen.getByText('dog')).toBeTruthy();
    expect(screen.getByText('🐕')).toBeTruthy();
  });

  it('prints the match TERM and never marks a bank entry correct at rest', () => {
    const { container } = render(<WordSorter data={makeData('1', [MATCH])} />);
    expect(screen.getByText('big')).toBeTruthy();
    expect(container.querySelectorAll('.border-emerald-400\\/40')).toHaveLength(0);
  });

  it('drops the click-era instruction sentence — the tutor\'s opening IS the instruction', () => {
    render(<WordSorter data={makeData('1')} />);
    expect(screen.queryByText(/Sort these words into animals and food/i)).toBeNull();
    expect(screen.queryByText(/tap a word/i)).toBeNull();
  });
});

// ── 3. The support-tier render levers ───────────────────────────────────────

describe('WordSorter support tier — hard withdraws scaffolding (reader grade)', () => {
  const hard: WordSorterChallenge = {
    ...SORT,
    showBucketEmojis: false,
    showFiledWords: false,
    namesSortCriterion: false,
  };

  it('withdraws the mat picture cue', () => {
    render(<WordSorter data={makeData('1', [hard], 'hard')} />);
    expect(screen.queryByText('🐾')).toBeNull();
    expect(screen.queryByText('🍎')).toBeNull();
  });

  it('withdraws the placed-word badges on a match challenge too', () => {
    const hardMatch: WordSorterChallenge = { ...MATCH, showFiledWords: false };
    const { container } = render(<WordSorter data={makeData('1', [hardMatch], 'hard')} />);
    // Nothing has been affirmed yet either way; the pin is that the bank is
    // whole and no "term → partner" record is rendered.
    expect(container.textContent).not.toContain('→');
  });
});

describe('WordSorter support tier — easy keeps full help', () => {
  const easy: WordSorterChallenge = {
    ...SORT,
    showBucketEmojis: true,
    showFiledWords: true,
    namesSortCriterion: true,
  };

  it('grants the mat picture cue', () => {
    render(<WordSorter data={makeData('1', [easy], 'easy')} />);
    expect(screen.getByText('🐾')).toBeTruthy();
    expect(screen.getByText('🍎')).toBeTruthy();
  });
});

describe('WordSorter support tier — legacy default (no tier fields)', () => {
  it('renders the full-help surface when the payload carries no tier', () => {
    render(<WordSorter data={makeData('K')} />);
    // At K the picture cue is the band floor; the payload said nothing at all.
    expect(screen.getByText('🐾')).toBeTruthy();
  });

  it('leaves the word bank exactly as generated', () => {
    render(<WordSorter data={makeData('1', [MATCH])} />);
    for (const partner of ['small', 'cold', 'down']) {
      expect(screen.getByText(partner)).toBeTruthy();
    }
  });
});

describe('WordSorter support tier — K band floor beats every tier', () => {
  it('keeps the mat picture cue at K even when the payload says to withdraw it', () => {
    const withdrawn: WordSorterChallenge = { ...SORT, showBucketEmojis: false };
    render(<WordSorter data={makeData('K', [withdrawn], 'hard')} />);
    expect(screen.getByText('🐾')).toBeTruthy();
    expect(screen.getByText('🍎')).toBeTruthy();
  });

  it('never withdraws the hear-it-again channel', () => {
    const withdrawn: WordSorterChallenge = { ...SORT, showBucketEmojis: false, showFiledWords: false };
    render(<WordSorter data={makeData('K', [withdrawn], 'hard')} />);
    expect(screen.getByLabelText(/hear the question again/i)).toBeTruthy();
  });

  it('hides adult chrome at K and shows it at a reader grade', () => {
    const { unmount } = render(<WordSorter data={makeData('K')} />);
    expect(screen.queryByText(/Two Groups/i)).toBeNull();
    unmount();
    render(<WordSorter data={makeData('1')} />);
    expect(screen.getByText(/Two Groups/i)).toBeTruthy();
  });
});

describe('WordSorter support tier — match_pairs distractors', () => {
  const withDecoys: WordSorterChallenge = {
    ...MATCH,
    distractorMatches: [
      { id: 'd0', text: 'wet' },
      { id: 'd1', text: 'loud' },
    ],
  };

  it('shows the decoys in the bank alongside every correct partner', () => {
    render(<WordSorter data={makeData('1', [withDecoys], 'hard')} />);
    for (const text of ['small', 'cold', 'down', 'wet', 'loud']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('never lets a decoy become a stimulus — they raise discrimination, not length', () => {
    render(<WordSorter data={makeData('1', [withDecoys], 'hard')} />);
    // The stimulus card holds a real TERM; each decoy appears exactly once, in
    // the bank, and never as a word the child is asked about.
    expect(screen.getByText('big')).toBeTruthy();
    expect(screen.getAllByText('wet')).toHaveLength(1);
    expect(screen.getAllByText('loud')).toHaveLength(1);
  });
});

// ── 4. Nothing to sort ──────────────────────────────────────────────────────

describe('WordSorter · nothing askable', () => {
  it('says so rather than rendering an empty stage', () => {
    render(<WordSorter data={makeData('1', [{ ...SORT, bucketLabels: ['Animals'] }])} />);
    expect(screen.getByText(/still being written/i)).toBeTruthy();
  });
});
