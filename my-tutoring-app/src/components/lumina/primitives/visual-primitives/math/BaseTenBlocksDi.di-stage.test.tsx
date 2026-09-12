// @vitest-environment jsdom
/**
 * BaseTenBlocksDi STAGE behaviour under the judged loop.
 *
 * Three of the four cases this file opens with are RE-BASED from
 * `BaseTenBlocks.answer-channel.test.tsx`, which pinned the click era's answer
 * channel per challenge type. That suite's `regroup` and `read_blocks` blocks
 * broke the moment those two modes started routing here, and the intents they
 * carried are not dropped — they are re-stated against the transport the child
 * now gets:
 *
 *  1. "asks the student to trade, not to type the number already on screen" —
 *     STRENGTHENED. There is no keypad AND no Check button: the trade commits
 *     on stillness, so a wrong trade is a real wrong answer the tutor corrects
 *     instead of a state the child can sit in until they press the right thing.
 *  2. "accepts a value-preserving trade" — RE-BASED onto the code-computed
 *     verdict. The component no longer decides; it hands `[BT_CHECK]` a mat and
 *     the cue carries `solved=`.
 *  3. "never states the target in the wrong-answer feedback" — RE-BASED AND
 *     WIDENED TO A UNIVERSAL. The click era withheld the target only in the
 *     miss message; on `read_blocks` the column COUNT is the answer the child
 *     is about to say out loud, so nothing on this stage prints a count, a
 *     total, or the composed number at any tier. That is the pixel half of the
 *     leak rule, which no string gate over the cues can see.
 *
 * The runner is mocked at the seam — it has its own suite
 * (`hooks/useJudgedScriptRunner.test.tsx`) and the pack has its own
 * (`baseTenScript.test.ts`). What is under test here is the STAGE.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseTenItem } from './baseTenScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  running: true,
  solved: new Set<string>(),
  awaitingGesture: false,
  hearStimulus: vi.fn(),
  armStillness: vi.fn(),
  clearStillness: vi.fn(),
  submitGestureAttempt: vi.fn(),
  queueCue: vi.fn(),
  clearQueuedCue: vi.fn(),
  options: null as null | {
    pack: { items: BaseTenItem[]; contextFor: (item: BaseTenItem) => Record<string, string> };
    onItemOpened?: (item: BaseTenItem, index: number) => void;
    onFinished?: (summary: unknown) => void;
  },
}));

vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: typeof runnerState.options) => {
    runnerState.options = options;
    const item = options?.pack.items[runnerState.index] ?? null;
    return {
      running: runnerState.running,
      preparing: false,
      stage: 'asking',
      statusLine: 'status',
      currentIndex: runnerState.index,
      currentItem: item,
      solvedIds: runnerState.solved,
      currentSolved: item != null && runnerState.solved.has(item.id),
      canAttempt: runnerState.running && item != null,
      summary: null,
      micState: 'armed',
      tutorSpeaking: false,
      cuedItemId: item?.id ?? null,
      revealHeld: false,
      armStillness: runnerState.armStillness,
      clearStillness: runnerState.clearStillness,
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: runnerState.hearStimulus,
      stimulusTapped: false,
      submitGestureAttempt: runnerState.submitGestureAttempt,
      isAwaitingGesture: () => runnerState.awaitingGesture,
      loop: { queueCue: runnerState.queueCue, clearQueuedCue: runnerState.clearQueuedCue },
    };
  },
}));

const submitResult = vi.hoisted(() => vi.fn());
const evaluationState = vi.hoisted(() => ({ hasSubmitted: false }));

vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult,
    hasSubmitted: evaluationState.hasSubmitted,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import BaseTenBlocksDi from './BaseTenBlocksDi';
import type { BaseTenBlocksChallenge, BaseTenBlocksData } from './BaseTenBlocks';
import { tradedColumns } from './baseTenModel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const data = (
  type: 'read_blocks' | 'regroup',
  ...targets: number[]
): BaseTenBlocksData => ({
  title: 'Place value with blocks',
  description: 'Read the mat and trade between places.',
  numberValue: targets[0],
  interactionMode: type === 'regroup' ? 'regroup' : 'decompose',
  maxPlace: 'hundreds',
  gradeBand: '2-3',
  instanceId: 'stage-test',
  challenges: targets.map((targetNumber, index) => ({
    type,
    instruction: 'unused — the pack owns every ask',
    targetNumber,
    hint: 'unused',
    id: `c${index + 1}`,
  })) as unknown as BaseTenBlocksChallenge[],
});

const items = () => runnerState.options!.pack.items;

/** The runner calls this the moment an item is on screen. */
const openItem = (index: number) => {
  runnerState.index = index;
  const item = items()[index];
  act(() => runnerState.options!.onItemOpened?.(item, index));
  return item;
};

const bodyText = () => document.body.textContent ?? '';

/** Every block button of one place, by its accessible name. */
const blocksOf = (place: 0 | 1 | 2 | 3) => {
  const noun = ['ones cube', 'ten-stick', 'hundred-flat', 'thousand-block'][place];
  return screen.queryAllByRole('button', {
    name: new RegExp(`^(Trade one ${noun} for ten |${noun}$)`),
  });
};

const columnOf = (name: string) => screen.getByLabelText(`${name} column`);

beforeEach(() => {
  runnerState.index = 0;
  runnerState.running = true;
  runnerState.awaitingGesture = false;
  runnerState.solved = new Set();
  runnerState.options = null;
  evaluationState.hasSubmitted = false;
  for (const spy of [
    runnerState.hearStimulus, runnerState.armStillness, runnerState.clearStillness,
    runnerState.submitGestureAttempt, runnerState.queueCue, runnerState.clearQueuedCue,
    submitResult,
  ]) spy.mockClear();
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// 1. ⭐ The pixel leak — nothing on screen may equal what the child will say
// ---------------------------------------------------------------------------

describe('BaseTenBlocksDi stage · answer-leak in PIXELS', () => {
  it('no column count, no running total and no composed number is printed', () => {
    // The click era printed all three: a per-column digit readout, a "Blocks
    // Total" panel, and the target inside the instruction. On `read_blocks` the
    // column count IS the answer the child is about to say, so a readout hands
    // it over in a way no scan of the cue strings could ever see.
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    // NOT ONE DIGIT inside the mat. The scan is scoped to the mat on purpose:
    // the problem counter and the step ordinals elsewhere on the stage do print
    // numerals, and both count things the child can already see.
    const mat = screen.getByLabelText('Block mat');
    expect(mat.textContent).not.toMatch(/\d/);
    expect(mat.textContent).toBe('hundred-flatsten-sticksones cubes');
    expect(bodyText()).not.toContain('247');
    expect(bodyText()).not.toMatch(/blocks total/i);
  });

  it('the columns are labelled by BLOCK NAME, never by count or value', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    expect(bodyText()).toContain('hundred-flats');
    expect(bodyText()).toContain('ten-sticks');
    expect(bodyText()).toContain('ones cubes');
    expect(bodyText()).not.toMatch(/\bforty\b|\btwo hundred\b/i);
  });

  it('no keypad, no Check button and no Next control survives — the DI census in the DOM', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    for (const label of [
      /check my blocks/i, /check my trade/i, /next challenge/i, /^7$/, /^✓$/, /clear/i,
    ]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('the mat renders one block per unit, which is the only place the count lives', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    expect(blocksOf(2)).toHaveLength(2);
    expect(blocksOf(1)).toHaveLength(4);
    expect(blocksOf(0)).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// 2. read_blocks — one place at a time
// ---------------------------------------------------------------------------

describe('BaseTenBlocksDi stage · read_blocks', () => {
  it('highlights the subject column, and only that one', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    const item = openItem(0);
    expect(item.step).toBe('count');
    expect(item.problem.place).toBe(2);
    expect(columnOf('hundreds').getAttribute('data-highlighted')).toBe('true');
    expect(columnOf('tens').getAttribute('data-highlighted')).toBeNull();
    expect(columnOf('ones').getAttribute('data-highlighted')).toBeNull();
  });

  it('the second step asks about the SAME place — the count then its value', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    const worth = openItem(1);
    expect(worth.step).toBe('worth');
    expect(worth.problem.id).toBe(items()[0].problem.id);
    expect(columnOf('hundreds').getAttribute('data-highlighted')).toBe('true');
  });

  it('⭐ no block is tappable — reading is a MOUTH turn, and a tap is not an answer', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    for (const block of [...blocksOf(2), ...blocksOf(1), ...blocksOf(0)]) {
      expect((block as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.queryByRole('button', { name: /put the blocks back/i })).toBeNull();
  });

  it('tap-to-hear replays the ask while the run is live, and is dead before it', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    openItem(0);
    fireEvent.click(screen.getByRole('button', { name: /say that again/i }));
    expect(runnerState.hearStimulus).toHaveBeenCalledTimes(1);

    cleanup();
    runnerState.running = false;
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    expect((screen.getByRole('button', { name: /say that again/i }) as HTMLButtonElement).disabled)
      .toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. regroup — predict, then trade with the hands
// ---------------------------------------------------------------------------

describe('BaseTenBlocksDi stage · regroup', () => {
  it('⭐ the prediction turn is untradeable — the mat cannot be counted off the screen', () => {
    render(<BaseTenBlocksDi data={data('regroup', 247)} />);
    const predict = openItem(0);
    expect(predict.step).toBe('predict');
    for (const block of blocksOf(2)) expect((block as HTMLButtonElement).disabled).toBe(true);
    // The undo control belongs to the hands turn and is not on screen yet.
    expect(screen.queryByRole('button', { name: /put the blocks back/i })).toBeNull();
    // …and no column is highlighted: the subject is the trade, not a place to read.
    expect(columnOf('hundreds').getAttribute('data-highlighted')).toBeNull();
  });

  it('the RIGHT trade splits the block and commits a code-computed solved verdict', () => {
    render(<BaseTenBlocksDi data={data('regroup', 247)} />);
    openItem(0);
    const trade = openItem(1);
    expect(trade.step).toBe('trade');
    expect(trade.answerKind).toBe('gesture');

    expect(blocksOf(2)).toHaveLength(2);
    fireEvent.click(blocksOf(2)[0]);

    // One hundred-flat became ten ten-sticks, on screen.
    expect(blocksOf(2)).toHaveLength(1);
    expect(blocksOf(1)).toHaveLength(14);
    expect(tradedColumns(trade.problem.start, trade.problem.place)).toEqual([7, 14, 1]);
    // No "that is a different block" coaching on the asked-for trade.
    expect(bodyText()).not.toMatch(/different block/i);

    // The commit is armed on stillness, not on a Check button.
    expect(runnerState.armStillness).toHaveBeenCalledTimes(1);
    act(() => (runnerState.armStillness.mock.calls[0][0] as () => void)());
    const cue = String(runnerState.submitGestureAttempt.mock.calls[0][0]);
    expect(cue).toContain('[BT_CHECK]');
    expect(cue).toContain('Code computed solved=true');
  });

  it('⭐ trading the WRONG size is a real wrong answer, not an inert tap', () => {
    // Every block above the ones is tappable on purpose. If only the asked-for
    // block responded, the hands turn could never be wrong and the tutor would
    // never get to teach.
    render(<BaseTenBlocksDi data={data('regroup', 247)} />);
    openItem(1);
    fireEvent.click(blocksOf(1)[0]);

    expect(blocksOf(1)).toHaveLength(3);
    expect(blocksOf(0)).toHaveLength(17);
    expect(bodyText()).toContain('That is a different block from the one we are trading.');

    act(() => (runnerState.armStillness.mock.calls[0][0] as () => void)());
    expect(String(runnerState.submitGestureAttempt.mock.calls[0][0]))
      .toContain('Code computed solved=false');
  });

  it('a ones cube is never tradeable — nothing sits below it', () => {
    render(<BaseTenBlocksDi data={data('regroup', 247)} />);
    openItem(1);
    for (const block of blocksOf(0)) expect((block as HTMLButtonElement).disabled).toBe(true);
  });

  it('the wrong trade is a WRONG answer, not a blocked one — undo restores and re-coaches', () => {
    render(<BaseTenBlocksDi data={data('regroup', 247)} />);
    const trade = openItem(1);
    fireEvent.click(blocksOf(1)[0]);
    expect(blocksOf(0)).toHaveLength(17);

    fireEvent.click(screen.getByRole('button', { name: /put the blocks back/i }));
    expect(blocksOf(1)).toHaveLength(4);
    expect(blocksOf(0)).toHaveLength(7);
    expect(bodyText()).not.toMatch(/different block/i);
    expect(runnerState.clearStillness).toHaveBeenCalled();

    // The re-coach is coaching, never a verdict.
    const queued = String(runnerState.queueCue.mock.calls.at(-1)![0]);
    expect(queued).toContain('[BT_CHANGE]');
    expect(queued).toContain('The mat has not changed yet.');
    // The change cue names [BT_CHECK] as the only tag that carries a verdict —
    // what it must never carry is the verdict itself.
    expect(queued).not.toContain('Code computed solved=');
    expect(trade.problem.start).toEqual([7, 4, 2]);
  });

  it('⭐ a committed gesture does not re-commit while the runner is still judging it', () => {
    render(<BaseTenBlocksDi data={data('regroup', 247)} />);
    openItem(1);
    fireEvent.click(blocksOf(2)[0]);
    runnerState.awaitingGesture = true;
    act(() => (runnerState.armStillness.mock.calls[0][0] as () => void)());
    expect(runnerState.submitGestureAttempt).not.toHaveBeenCalled();
  });

  it('the mat is rebuilt at the START of a problem, never mid-problem', () => {
    // The trade the child made has to still be on screen while the tutor
    // delivers its verdict, so only `predict` resets the mat.
    render(<BaseTenBlocksDi data={data('regroup', 247, 358)} />);
    openItem(1);
    fireEvent.click(blocksOf(2)[0]);
    expect(blocksOf(1)).toHaveLength(14);

    openItem(1); // re-opening the same trade step keeps the child's mat
    expect(blocksOf(1)).toHaveLength(14);

    openItem(0); // re-opening the prediction restores the standard-form mat
    expect(blocksOf(1)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 4. Build gates reach the stage
// ---------------------------------------------------------------------------

describe('BaseTenBlocksDi stage · unaskable payloads', () => {
  it('an unaskable challenge is dropped and the askable ones still run', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 7, 247)} />);
    expect(items().map((item) => item.problem.target)).toEqual([247, 247]);
  });

  it('⭐ a regroup payload of multiples of ten renders the empty state, never a broken ask', () => {
    // Every one of these would make the ask state its own answer.
    render(<BaseTenBlocksDi data={data('regroup', 40, 100, 700)} />);
    expect(items()).toHaveLength(0);
    expect(screen.getByText(/no block-mat challenges are available/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. The finished run
// ---------------------------------------------------------------------------

describe('BaseTenBlocksDi stage · completion', () => {
  it('the submitted metrics count PROBLEMS and record the places that were worked', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    const built = items();
    act(() => runnerState.options!.onFinished?.({
      outcomes: built.map((item) => ({ id: item.id, solved: true, score: 100, corrections: 0 })),
      observations: [],
    }));
    const [correct, score, metrics] = submitResult.mock.calls[0];
    expect(correct).toBe(true);
    expect(score).toBe(100);
    expect(metrics.evalMode).toBe('read_blocks');
    expect(metrics.totalChallenges).toBe(1);
    expect(metrics.challengesCompleted).toBe(1);
    expect(metrics.placeValuesUsed).toEqual(['hundreds']);
  });

  it('a half-answered problem is not a solved one', () => {
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    const built = items();
    act(() => runnerState.options!.onFinished?.({
      outcomes: [
        { id: built[0].id, solved: true, score: 100, corrections: 0 },
        { id: built[1].id, solved: false, score: 0, corrections: 2 },
      ],
      observations: [],
    }));
    const [correct, score, metrics] = submitResult.mock.calls[0];
    expect(correct).toBe(false);
    expect(score).toBe(0);
    expect(metrics.challengesCompleted).toBe(0);
  });

  it('the completion panel praises the work and states no number', () => {
    evaluationState.hasSubmitted = true;
    render(<BaseTenBlocksDi data={data('read_blocks', 247)} />);
    expect(bodyText()).toContain('Nice work with the blocks!');
    expect(bodyText()).not.toMatch(/\d/);
  });
});
