// @vitest-environment jsdom
/**
 * SortingStation STAGE behaviour under the judged loop. Every intent this file
 * pinned in the click era is still pinned — RE-BASED, not dropped:
 *
 *  1. (reader-fit PRE / contract R4) Trays are PICTURE-primary at K — the
 *     `bucketEmoji` (or a colour-coded fallback) with the word as a caption —
 *     and adult chrome is hidden. UNCHANGED: the port preserved this surface
 *     exactly, and it was the live regression risk of a whole-file rewrite.
 *  2. (R7) "Sort-family keeps its explicit Check button." RE-BASED. What R7
 *     protects is the COMMIT STEP for multi-part construction; the judged loop
 *     does not remove the commit, it removes the multi-part construction. One
 *     object is now one atomic judged turn and its commit is the child's spoken
 *     answer plus the tutor's verdict. So what this file pins is the ABSENCE of
 *     every Check control and the classification of each item as a VOICE item.
 *  3. (R6) "Odd-one-out is tap = choose; a wrong tap must not latch." RE-BASED
 *     the same way: there is no tap left to latch, because the child SAYS which
 *     card does not belong. Pinned as the absence of a tappable card plus the
 *     item's voice classification.
 *  4. Grade 1 keeps the reader chrome (progress counter, mode badges) — the
 *     control half of the band gate, so nothing leaks across `isPreReader`.
 *  5. The printed INSTRUCTION is gone at BOTH bands, which is new and
 *     deliberate: the tutor speaks the ask, so a printed copy would let a
 *     reader skip listening and would be unreadable to everyone else.
 *
 *  Plus the leak this port introduced a gate for: the per-tray count badge is
 *  withdrawn on a count ask, where it equals the number about to be spoken.
 *
 * The runner is mocked at the seam — it has its own suite
 * (`hooks/useJudgedScriptRunner.test.tsx`) and the pack has its own
 * (`__tests__/SortingStation.di-script.test.ts`). What is under test here is
 * the STAGE.
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SortingStationItem } from './sortingStationScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  stage: 'asking' as 'idle' | 'asking' | 'judging' | 'affirmed' | 'done',
  running: true,
  solved: new Set<string>(),
  /** 18b: is the affirmed item's reveal still on screen? */
  revealHeld: false,
  options: null as null | {
    pack: { items: SortingStationItem[] };
    onItemOpened?: (item: SortingStationItem, index: number) => void;
    onAffirmed?: (item: SortingStationItem) => void;
  },
}));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: typeof runnerState.options) => {
    runnerState.options = options;
    const item = options?.pack.items[runnerState.index] ?? null;
    return {
      running: runnerState.running,
      preparing: false,
      stage: runnerState.stage,
      statusLine: 'status',
      currentIndex: runnerState.index,
      currentItem: item,
      solvedIds: runnerState.solved,
      currentSolved: item != null && runnerState.solved.has(item.id),
      canAttempt:
        runnerState.running && item != null
        && !runnerState.solved.has(item.id) && runnerState.stage !== 'judging',
      summary: null,
      micState: 'armed',
      tutorSpeaking: false,
      cuedItemId: item?.id ?? null,
      revealHeld: runnerState.revealHeld,
      armStillness: vi.fn(),
      clearStillness: vi.fn(),
      start: vi.fn(),
      hearStimulus: vi.fn(),
      stimulusTapped: false,
      submitGestureAttempt: vi.fn(),
      isAwaitingGesture: () => false,
      loop: {},
    };
  },
}));

// JudgedMicPanel subscribes to the live mic level (19b) — the only reason this
// suite touches the AI context at all.
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
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

import SortingStation, { type SortingStationData } from './SortingStation';

const sortByOne = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Needs and Wants',
  description: 'Sort each thing into a need or a want',
  gradeBand,
  maxCategories: 2,
  showCounts: true,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'sort-by-one',
      instruction: 'Sort these into needs and wants',
      sortingAttribute: 'category',
      objects: [
        { id: 'o1', label: 'water', emoji: '💧', attributes: { category: 'need' } },
        { id: 'o2', label: 'toy', emoji: '🧸', attributes: { category: 'want' } },
      ],
      categories: [
        { label: 'Need', rule: { category: 'need' }, bucketEmoji: '🏠' },
        { label: 'Want', rule: { category: 'want' }, bucketEmoji: '🎁' },
      ],
    },
  ],
});

const oddOneOut = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Which One Is Different',
  description: 'Find the one that does not belong',
  gradeBand,
  maxCategories: 2,
  showCounts: false,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'odd-one-out',
      instruction: 'Which one does not belong?',
      sortingAttribute: 'category',
      objects: [
        { id: 'o1', label: 'dog', emoji: '🐶', attributes: { category: 'animal' } },
        { id: 'o2', label: 'cat', emoji: '🐱', attributes: { category: 'animal' } },
        { id: 'o3', label: 'car', emoji: '🚗', attributes: { category: 'vehicle' } },
      ],
      oddOneOut: 'o3',
      oddOneOutReason: 'It is not an animal',
    },
  ],
});

const countCompare = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Count and Compare',
  gradeBand,
  maxCategories: 2,
  showCounts: true,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'count-and-compare',
      instruction: 'Count each group',
      sortingAttribute: 'color',
      correctComparison: 'more',
      objects: [
        { id: 'o1', label: 'apple', emoji: '🍎', attributes: { color: 'red' } },
        { id: 'o2', label: 'cherry', emoji: '🍒', attributes: { color: 'red' } },
        { id: 'o3', label: 'sky', emoji: '🟦', attributes: { color: 'blue' } },
      ],
      categories: [
        { label: 'Red', rule: { color: 'red' }, bucketEmoji: '🔴' },
        { label: 'Blue', rule: { color: 'blue' }, bucketEmoji: '🔵' },
      ],
    },
  ],
});

const CHECK_CONTROLS = /check answer|check sort|check counts|check tallies|next|finish|submit/i;

beforeEach(() => {
  runnerState.index = 0;
  runnerState.stage = 'asking';
  runnerState.running = true;
  runnerState.solved = new Set();
  runnerState.revealHeld = false;
  runnerState.options = null;
});
afterEach(cleanup);

describe('SortingStation @ PRE (gradeBand K) — R4 survives the rewrite', () => {
  it('renders picture-primary trays (emoji + word caption)', () => {
    render(<SortingStation data={sortByOne('K')} />);
    expect(screen.getByText('🏠')).toBeTruthy();
    expect(screen.getByText('🎁')).toBeTruthy();
    expect(screen.getByText('Need')).toBeTruthy();
    expect(screen.getByText('Want')).toBeTruthy();
  });

  it('hides adult chrome and the unreadable description', () => {
    render(<SortingStation data={sortByOne('K')} />);
    expect(screen.queryByText('Sort each thing into a need or a want')).toBeNull();
    expect(screen.queryByText(/Sort It/)).toBeNull();          // mode badge
    expect(screen.queryByText(/Listen to the question/)).toBeNull(); // helper prose
  });

  /** NEW, and true at both bands: the tutor speaks the ask, so a printed copy
   *  would let a reader skip listening and is unreadable to everyone else. */
  it('never prints the instruction — the tutor speaks it', () => {
    render(<SortingStation data={sortByOne('K')} />);
    expect(screen.queryByText('Sort these into needs and wants')).toBeNull();
  });
});

describe('R7 re-based — the commit step is the verdict, not a button', () => {
  it('the sort family has no Check control at K', () => {
    render(<SortingStation data={sortByOne('K')} />);
    expect(screen.queryByText(CHECK_CONTROLS)).toBeNull();
  });

  it('the sort family has no Check control at Grade 1 either', () => {
    render(<SortingStation data={sortByOne('1')} />);
    expect(screen.queryByText(CHECK_CONTROLS)).toBeNull();
  });

  it('every sort item is an atomic VOICE turn — the commit is the answer', () => {
    render(<SortingStation data={sortByOne('K')} />);
    const items = runnerState.options!.pack.items;
    // One challenge is no longer one screenful: it is one judged turn PER object.
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.answerKind === 'voice')).toBe(true);
    expect(items.every((i) => i.kind === 'sort')).toBe(true);
  });
});

describe('R6 re-based — there is no tap left to latch', () => {
  it('odd-one-out renders cards that are not buttons', () => {
    const { container } = render(<SortingStation data={oddOneOut('K')} />);
    expect(screen.getByText('🐶')).toBeTruthy();
    expect(screen.getByText('🚗')).toBeTruthy();
    // The only button on the stage is the mic orb — no card is clickable, so a
    // wrong "tap" cannot latch a wrong state and cannot auto-submit.
    const cardButtons = Array.from(container.querySelectorAll('button'))
      .filter((b) => /🐶|🐱|🚗/.test(b.textContent ?? ''));
    expect(cardButtons).toHaveLength(0);
  });

  it('the odd-one-out answer is SPOKEN, and one challenge is one turn', () => {
    render(<SortingStation data={oddOneOut('K')} />);
    const items = runnerState.options!.pack.items;
    expect(items).toHaveLength(1);
    expect(items[0].answerKind).toBe('voice');
    expect(items[0].kind).toBe('odd_one');
    expect(items[0].answer).toBe('car');
  });

  it('never prints which card is the odd one before the verdict', () => {
    render(<SortingStation data={oddOneOut('K')} />);
    expect(screen.queryByText(/does(n't| not) belong/i)).toBeNull();
  });
});

describe('the pixel leak the port had to close', () => {
  /** `showCounts` drew a live tally on every tray. Under a Check button that was
   *  progress; the moment "how many are in the Red group?" became a spoken ask it
   *  was the answer, printed, before the child said it. */
  it('withdraws the tray count badge on a count ask, even with showCounts on', () => {
    render(<SortingStation data={countCompare('1')} />);
    const item = runnerState.options!.pack.items[runnerState.index];
    expect(item.kind).toBe('count_group');
    expect(item.hidesCounts).toBe(true);
    // 2 red + 1 blue — neither count may be on screen while it is the answer.
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('restores it once the tutor has affirmed the number', () => {
    runnerState.revealHeld = true;
    render(<SortingStation data={countCompare('1')} />);
    expect(screen.queryByText('2')).toBeTruthy();
  });
});

describe('SortingStation @ reader grade (control, Grade 1)', () => {
  it('keeps the reader chrome: progress counter, mode badge, description', () => {
    render(<SortingStation data={sortByOne('1')} />);
    expect(screen.getByText('Sort each thing into a need or a want')).toBeTruthy();
    expect(screen.getByText(/Sort It/)).toBeTruthy();
  });

  it('keeps text-primary trays — no big picture header leaks down from K', () => {
    render(<SortingStation data={sortByOne('1')} />);
    expect(screen.getByText('Need')).toBeTruthy();
    expect(screen.queryByText('🏠')).toBeNull();
    expect(screen.queryByText('🎁')).toBeNull();
  });
});
