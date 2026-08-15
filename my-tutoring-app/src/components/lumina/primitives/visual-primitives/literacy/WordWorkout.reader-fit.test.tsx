// @vitest-environment jsdom
/**
 * Reader-fit for word-workout on the DI modality surface (sixteenth literacy
 * port). The original file pinned a PRE (Kindergarten) band gate: hide the adult
 * chrome, hide the on-screen instruction sentences, and have the tutor voice the
 * play action through [ACTIVITY_START].
 *
 * THE PORT REPLACES THAT CONTRACT WITH A STRONGER ONE rather than dropping it.
 * Every intent the band gate protected is now unconditional:
 *   - the on-screen instruction sentences are gone at EVERY grade, because the
 *     tutor speaks the ask;
 *   - the play action is voiced by the pack's opening cue at EVERY grade, which
 *     is the same channel [ACTIVITY_START] used but scripted rather than
 *     improvised (and it can no longer arrive as a second, competing turn);
 *   - the vowel-scope label that LEAKED the lesson scope is not rendered at all;
 *   - right/wrong is carried by the tutor's voice and the answer ring, so there
 *     is no text feedback card to band-gate.
 * So this file pins BAND INVARIANCE plus the answer surface, and the old PRE-only
 * asserts become "true at K and at Grade 1 alike".
 *
 * ONE THING THE PORT MADE HARDER, deliberately, and it belongs on this record:
 * a child who cannot yet decode CVC print has nothing to work from here, because
 * the tutor no longer reads the words aloud (that channel decided the item
 * without any decoding). The catalog says so in its constraints and routes those
 * objectives to letter-sound-link / phonics-blender; the assert lives in
 * WordWorkout.di-script.test.ts with the rest of the catalog steering.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

const runnerState = vi.hoisted(() => ({ index: 0, packs: [] as Array<{ items: unknown[]; itemCue: (item: unknown, opts: unknown) => string }> }));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (opts: { pack: { items: unknown[]; itemCue: (item: unknown, opts: unknown) => string } }) => {
    runnerState.packs.push(opts.pack);
    return {
      running: true,
      preparing: false,
      stage: 'asking',
      statusLine: '',
      currentIndex: runnerState.index,
      currentItem: opts.pack.items[runnerState.index] ?? null,
      solvedIds: new Set<string>(),
      currentSolved: false,
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
    };
  },
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

import WordWorkout, { type WordWorkoutData } from './WordWorkout';

const realNonsenseData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'real-vs-nonsense',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [{ id: 'c1', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' }],
});

const pictureMatchData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short i',
  mode: 'picture-match',
  masteredVowels: ['i'],
  gradeLevel,
  challenges: [{
    id: 'c1',
    mode: 'picture-match',
    targetWord: 'pig',
    targetImage: '🐷',
    distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }],
  }],
});

const wordChainsData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'word-chains',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [{ id: 'c1', mode: 'word-chains', chain: ['cat', 'bat', 'bad'], changedPositions: [0, 2] }],
});

const lastPack = () => runnerState.packs[runnerState.packs.length - 1];
const openingLine = () => {
  const pack = lastPack();
  return pack.itemCue(pack.items[0], { opening: true, howToPlay: true });
};

afterEach(() => {
  cleanup();
  runnerState.index = 0;
  runnerState.packs = [];
});

describe.each(['K', '1'])('WordWorkout DI stage @ grade %s', (grade) => {
  it('renders no on-screen instruction sentence — the tutor speaks the ask', () => {
    render(<WordWorkout data={realNonsenseData(grade)} />);
    expect(screen.queryByText(/which is a real word/i)).toBeNull();
    expect(screen.queryByText(/sound out both words/i)).toBeNull();
  });

  it('voices the play action through the pack opening cue, answer-free', () => {
    // The successor to [ACTIVITY_START]: same channel, scripted rather than
    // improvised, and it can no longer arrive as a second competing turn.
    render(<WordWorkout data={realNonsenseData(grade)} />);
    const opening = openingLine();
    expect(opening).toContain('one is just silly sounds');
    expect(opening).toContain('tell me the real one');
    // Answer-free: neither printed word is spoken before the child reads them.
    expect(opening.split('The real word is')[0]).not.toContain('cat');
  });

  it('never renders the vowel-scope label that leaked the lesson scope', () => {
    render(<WordWorkout data={realNonsenseData(grade)} />);
    expect(screen.queryByText(/vowels:/i)).toBeNull();
  });

  it('keeps the answer surface honest: the words are printed, not tappable', () => {
    const { container } = render(<WordWorkout data={realNonsenseData(grade)} />);
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('zat')).toBeTruthy();
    // A tappable word card is the costume this port deleted: the answer is said.
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
  });

  it('picture-match is picture-primary and its pictures ARE tappable', () => {
    render(<WordWorkout data={pictureMatchData(grade)} />);
    expect(screen.getByText('🐷')).toBeTruthy();
    expect(screen.getByText('📌')).toBeTruthy();
    // The word is printed (decoding it is the first half of the task)…
    expect(screen.getByText('pig')).toBeTruthy();
    // …and the pictures are the answer surface. (Matched as whole strings: an
    // emoji character class matches by SURROGATE, so it also catches the 🔁
    // tap-to-hear button.)
    const pictureEmoji = ['🐷', '📌', '🗑️'];
    expect(screen.getAllByRole('button').filter((b) => pictureEmoji.includes(b.textContent ?? '')))
      .toHaveLength(3);
  });

  it('word chains print every word with no advance button anywhere', () => {
    render(<WordWorkout data={wordChainsData(grade)} />);
    for (const word of ['cat', 'bat', 'bad']) {
      expect(screen.getByText((_, node) => node?.textContent === word)).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /start reading|next word|finish chain/i })).toBeNull();
  });

  it('has no Next / Finish control — the tutor’s verdict is the advance', () => {
    render(<WordWorkout data={realNonsenseData(grade)} />);
    expect(screen.queryByRole('button', { name: /next|finish|i read it/i })).toBeNull();
  });
});

describe('WordWorkout DI stage · band invariance', () => {
  it('renders the same stage at K and at Grade 1', () => {
    // The click era hid chrome and instruction text at PRE only. The DI stage
    // carries neither at any band, so the two renders agree.
    const k = render(<WordWorkout data={realNonsenseData('K')} />).container.innerHTML;
    cleanup();
    const g1 = render(<WordWorkout data={realNonsenseData('1')} />).container.innerHTML;
    expect(k).toBe(g1);
  });
});
