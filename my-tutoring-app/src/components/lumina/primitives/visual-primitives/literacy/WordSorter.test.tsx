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
    // PhaseSummaryPanel reads these on completion (its celebration fires on a
    // timer, so a missing method surfaces as an unhandled error, not a failure).
    isEnabled: () => false,
    getVolume: () => 0,
    playComplete: vi.fn(),
    playPerfect: vi.fn(),
    playStreak: vi.fn(),
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

import WordSorter, { type WordSorterData, type WordSorterChallenge } from './WordSorter';

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

// ===========================================================================
// SUPPORT TIERS (/add-support-tiers) — difficulty = scaffold withdrawal.
//
// Every scaffold field is OPTIONAL: a payload with none of them must render the
// legacy full-help UI byte-for-byte. Hard withdraws the bucket picture cue, the
// filed-word exemplars, the criterion-naming instruction/error line, and adds
// non-answer entries to the match column. The K band floor always wins.
// ===========================================================================

/** Distinct emoji per slot so an emoji assertion can only match one element. */
const makeSortData = (
  gradeLevel: string,
  overrides: Partial<WordSorterChallenge> = {},
  supportTier?: 'easy' | 'medium' | 'hard',
): WordSorterData => ({
  title: 'Animal Sort',
  gradeLevel,
  sortingTopic: 'Animals and Actions',
  ...(supportTier ? { supportTier } : {}),
  challenges: [
    {
      id: 'binary_sort-0',
      type: 'binary_sort',
      instruction: 'Put each word where it belongs',
      bucketLabels: ['Animals', 'Actions'],
      bucketEmojis: ['🐾', '⚡'],
      words: [
        { id: 'w0', word: 'cat', emoji: '🐱', correctBucket: 'Animals' },
        { id: 'w1', word: 'run', emoji: '🏃', correctBucket: 'Actions' },
      ],
      ...overrides,
    },
  ],
});

const makeMatchData = (
  overrides: Partial<WordSorterChallenge> = {},
  supportTier?: 'easy' | 'medium' | 'hard',
): WordSorterData => ({
  title: 'Opposites',
  gradeLevel: '1',
  sortingTopic: 'Opposites',
  ...(supportTier ? { supportTier } : {}),
  challenges: [
    {
      id: 'match_pairs-0',
      type: 'match_pairs',
      instruction: 'Match each word with its partner',
      pairs: [
        { id: 'p0', term: 'sun', termEmoji: '🌞', match: 'moon', matchEmoji: '🌙' },
        { id: 'p1', term: 'hot', termEmoji: '🔥', match: 'cold', matchEmoji: '❄️' },
        { id: 'p2', term: 'big', termEmoji: '🐘', match: 'small', matchEmoji: '🐭' },
      ],
      ...overrides,
    },
  ],
});

const HARD_SORT_SCAFFOLD: Partial<WordSorterChallenge> = {
  showBucketEmojis: false,
  showFiledWords: false,
  namesSortCriterion: false,
};

const tagged = (tag: string) =>
  sendText.mock.calls.map(c => String(c[0])).filter(m => m.startsWith(tag));

/** The <button> wrapping one bucket (header + drop zone). */
const bucketButton = (label: string) =>
  screen.getAllByRole('button').find(b => (b.textContent ?? '').includes(label))!;

describe('WordSorter support tier — hard withdraws scaffolding (reader grade)', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('withdraws the bucket picture cue', () => {
    render(<WordSorter data={makeSortData('2', HARD_SORT_SCAFFOLD, 'hard')} />);
    expect(screen.queryByText('🐾')).toBeNull();
    expect(screen.queryByText('⚡')).toBeNull();
    // The manipulable stimulus is NEVER withdrawn — the word cards keep their emoji.
    expect(screen.getByText('🐱')).toBeTruthy();
    // Bucket labels (and their COUNT — the eval-mode axis) are untouched.
    expect(bucketButton('Animals')).toBeTruthy();
    expect(bucketButton('Actions')).toBeTruthy();
  });

  it('hides the filed-word exemplars but keeps anonymous progress', () => {
    render(<WordSorter data={makeSortData('2', HARD_SORT_SCAFFOLD, 'hard')} />);
    fireEvent.click(screen.getByRole('button', { name: /cat/ }));
    fireEvent.click(bucketButton('Animals'));
    const animals = bucketButton('Animals');
    expect(animals.textContent).not.toContain('cat'); // criterion not inferable
    expect(animals.textContent).toContain('1');       // …but "a word landed" survives
  });

  it('collapses the named error line and withholds the correct bucket from the tutor', () => {
    render(<WordSorter data={makeSortData('2', HARD_SORT_SCAFFOLD, 'hard')} />);
    fireEvent.click(screen.getByRole('button', { name: /run/ }));
    fireEvent.click(bucketButton('Animals'));
    expect(screen.getByText('Try again.')).toBeTruthy();
    expect(screen.queryByText(/doesn't belong/)).toBeNull();

    const incorrect = tagged('[ANSWER_INCORRECT]');
    expect(incorrect).toHaveLength(1);
    expect(incorrect[0]).not.toContain('Actions'); // the correct bucket is withheld
    expect(incorrect[0]).toContain('Do NOT name the correct group');
  });

  it('gives the tutor a name-free coaching stance instead of the bucket-naming opener', () => {
    render(<WordSorter data={makeSortData('2', HARD_SORT_SCAFFOLD, 'hard')} />);
    const start = tagged('[ACTIVITY_START]')[0];
    expect(start).toContain('[SUPPORT_TIER hard]');
    expect(start).toContain('do not read the bucket labels aloud');
    expect(start).not.toContain('name each bucket aloud');
  });
});

describe('WordSorter support tier — easy keeps full help', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  const EASY: Partial<WordSorterChallenge> = {
    showBucketEmojis: true,
    showFiledWords: true,
    namesSortCriterion: true,
  };

  it('grants the bucket picture cue, the filed exemplars, and the named error line', () => {
    render(<WordSorter data={makeSortData('2', EASY, 'easy')} />);
    expect(screen.getByText('🐾')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cat/ }));
    fireEvent.click(bucketButton('Animals'));
    expect(bucketButton('Animals').textContent).toContain('cat');

    fireEvent.click(screen.getByRole('button', { name: /run/ }));
    fireEvent.click(bucketButton('Animals'));
    expect(screen.getByText(/doesn't belong in "Animals"/)).toBeTruthy();
    expect(tagged('[ANSWER_INCORRECT]')[0]).toContain('it belongs in "Actions"');
  });

  it('lets the tutor name the buckets and the rule', () => {
    render(<WordSorter data={makeSortData('2', EASY, 'easy')} />);
    const start = tagged('[ACTIVITY_START]')[0];
    expect(start).toContain('[SUPPORT_TIER easy]');
    expect(start).toContain('name each bucket aloud');
    expect(start).toContain('restate the sorting rule');
  });
});

describe('WordSorter support tier — legacy default (no tier fields)', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('renders full help and emits no reveal policy when the payload carries no tier', () => {
    render(<WordSorter data={makeSortData('2')} />);
    // Reader-grade legacy render was label-only — the bucket cue stays opt-IN.
    expect(screen.queryByText('🐾')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /cat/ }));
    fireEvent.click(bucketButton('Animals'));
    expect(bucketButton('Animals').textContent).toContain('cat'); // exemplars shown

    fireEvent.click(screen.getByRole('button', { name: /run/ }));
    fireEvent.click(bucketButton('Animals'));
    expect(screen.getByText(/doesn't belong in "Animals"/)).toBeTruthy();
    expect(tagged('[ANSWER_INCORRECT]')[0]).toContain('it belongs in "Actions"');

    const start = tagged('[ACTIVITY_START]')[0];
    expect(start).not.toContain('[SUPPORT_TIER');
    expect(start).toContain('name each bucket aloud');
  });

  it('leaves the match column exactly as generated', () => {
    render(<WordSorter data={makeMatchData()} />);
    expect(screen.queryByRole('button', { name: /green/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /sun/ }));
    fireEvent.click(screen.getByRole('button', { name: /cold/ }));
    expect(tagged('[ANSWER_INCORRECT]')[0]).toContain('Correct match is "moon"');
  });
});

describe('WordSorter support tier — K band floor beats every tier', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  it('keeps the bucket emoji at K even when the payload says to withdraw them', () => {
    // The generator forces showBucketEmojis TRUE at K; the component enforces it
    // again, so even a mis-stamped payload cannot strand a pre-reader.
    render(<WordSorter data={makeSortData('K', HARD_SORT_SCAFFOLD, 'hard')} />);
    expect(screen.getByText('🐾')).toBeTruthy();
    expect(screen.getByText('⚡')).toBeTruthy();
  });

  it('never withdraws the staged-word read-aloud channel', () => {
    render(<WordSorter data={makeSortData('K', HARD_SORT_SCAFFOLD, 'hard')} />);
    expect(stagedTags()).toHaveLength(1);
    expect(stagedTags()[0]).toContain('"cat"');
  });

  it('tells the tutor to keep naming the buckets aloud at K, withholding only the rule', () => {
    render(<WordSorter data={makeSortData('K', HARD_SORT_SCAFFOLD, 'hard')} />);
    const start = tagged('[ACTIVITY_START]')[0];
    expect(start).toContain('[SUPPORT_TIER hard]');
    expect(start).toContain('Kindergarten floor');
    expect(start).toContain('STILL name each bucket out loud');
    expect(start).toContain('withhold is the sorting RULE');
  });

  it('still hides the filed exemplars at K (that lever is K-safe)', () => {
    render(<WordSorter data={makeSortData('K', HARD_SORT_SCAFFOLD, 'hard')} />);
    fireEvent.click(bucketButton('Animals')); // staged "cat" → Animals
    expect(bucketButton('Animals').textContent).not.toContain('cat');
    expect(screen.getByText('run')).toBeTruthy(); // next word staged normally
  });
});

describe('WordSorter support tier — match_pairs distractors', () => {
  beforeEach(() => { sendText.mockClear(); submitResult.mockClear(); });
  afterEach(cleanup);

  const HARD_MATCH: Partial<WordSorterChallenge> = {
    namesSortCriterion: false,
    distractorMatches: [
      { id: 'd0', text: 'green', emoji: '🟢' },
      { id: 'd1', text: 'happy', emoji: '😀' },
    ],
  };

  it('shows the distractors in the match column alongside every correct partner', () => {
    render(<WordSorter data={makeMatchData(HARD_MATCH, 'hard')} />);
    expect(screen.getByRole('button', { name: /green/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /happy/ })).toBeTruthy();
    // The correct option is ALWAYS present — the answer form never changes.
    for (const m of ['moon', 'cold', 'small']) {
      expect(screen.getByRole('button', { name: new RegExp(m) })).toBeTruthy();
    }
  });

  it('names the tapped distractor to the tutor but withholds the correct partner at hard', () => {
    render(<WordSorter data={makeMatchData(HARD_MATCH, 'hard')} />);
    fireEvent.click(screen.getByRole('button', { name: /sun/ }));
    fireEvent.click(screen.getByRole('button', { name: /green/ }));
    const incorrect = tagged('[ANSWER_INCORRECT]');
    expect(incorrect).toHaveLength(1);
    expect(incorrect[0]).toContain('"green"');  // never the bare "?" fallback
    expect(incorrect[0]).not.toContain('moon'); // the answer stays withheld
  });

  it('completion still keys on pairs.length — unmatched distractors never block it', () => {
    render(<WordSorter data={makeMatchData(HARD_MATCH, 'hard')} />);
    fireEvent.click(screen.getByRole('button', { name: /sun/ }));
    fireEvent.click(screen.getByRole('button', { name: /moon/ }));
    fireEvent.click(screen.getByRole('button', { name: /hot/ }));
    fireEvent.click(screen.getByRole('button', { name: /cold/ }));
    // Two decoys still sitting unmatched, one real pair to go.
    expect(screen.getByRole('button', { name: /green/ })).toBeTruthy();
    expect(submitResult).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /big/ }));
    fireEvent.click(screen.getByRole('button', { name: /small/ }));
    expect(submitResult).toHaveBeenCalled();
  });
});
