// @vitest-environment jsdom
/**
 * Ten-frame STAGE behaviour under the judged loop. Every intent this file
 * pinned in the click era is still pinned — re-based, not dropped:
 *
 *  1. (reader-fit item 12 / contract R6) K make-ten is enacted by tapping empty
 *     frame cells; seed counters are fixed; the frame auto-judges when it is
 *     full; there is no proxy stepper and no Check control. UNCHANGED — the DI
 *     port preserved this surface and added a judge on top of it.
 *  2. K build keeps its construction protocol — but the Check control that used
 *     to close it is gone. A hands turn now closes on STILLNESS, exactly as a
 *     voice turn closes on silence, and the tutor's verdict is what advances.
 *  3. Grades 1-2 make-ten used to pin a numeric stepper + Check. That protocol
 *     is re-based: the complement is still the child's unaided answer, it is
 *     now SPOKEN, so what this file pins is the ABSENCE of the stepper and the
 *     item's classification as a voice item.
 *  4. (R4) Subitize hides its counters before the answer is asked for, and a
 *     hidden frame cannot be tapped.
 *  5. Every challenge owns its starting frame state; a completed make-ten never
 *     carries into the next challenge.
 *
 *  6. (contract R9) `split` opens with the whole group already on the frame,
 *     all red; taps FLIP a counter's colour and never add or remove one, so
 *     the total cannot drift and the partition is the only thing the item
 *     measures. It commits on stillness like `build`, and the pair it commits
 *     is carried as a single number — how many turned yellow.
 *
 *  Plus the leak this port introduced a gate for: the running-count readout is
 *  withdrawn on add/subtract, where it equals the number about to be spoken.
 *
 * The runner is mocked at the seam — it has its own suite
 * (`hooks/useJudgedScriptRunner.test.tsx`) and the pack has its own
 * (`TenFrame.di-script.test.ts`). What is under test here is the STAGE.
 *
 * ⚠️ 19c MOVED A SEAM. The stimulus TIMING rules (falling edge on her voice,
 * `cuedItemId`, the silence fallback, the prep beat) and the stillness WINDOW
 * are the runner's now, and are pinned against the real hook in its own suite.
 * This file drives `onPresentStimulus`/`armStillness` and pins what the STAGE
 * does with them.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenFrameItem } from '../tenFrameScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  stage: 'asking' as 'idle' | 'asking' | 'judging' | 'affirmed' | 'done',
  running: true,
  awaiting: false,
  solved: new Set<string>(),
  tutorSpeaking: false,
  /** The item the tutor's live line is about. `null` = "whatever is on screen",
   *  which is what every test that does not exercise the queue wants. A cue is
   *  QUEUED on an affirm and sent only when the floor clears, so this can name
   *  the PREVIOUS item while the next one is already rendered — see the drive-5
   *  regression below. */
  cuedItemId: null as string | null,
  /** 18b: is the affirmed item's reveal still on screen? */
  revealHeld: false,
  /** The runner owns the stillness window now (19c); the mock keeps one timer
   *  so the STAGE's arming and cancelling are still exercised here. */
  stillness: null as ReturnType<typeof setTimeout> | null,
  gestureCues: [] as string[],
  options: null as null | {
    pack: { items: TenFrameItem[] };
    onItemOpened?: (item: TenFrameItem, index: number) => void;
    onAffirmed?: (item: TenFrameItem) => void;
    onCorrectionRetry?: (item: TenFrameItem, used: number) => void;
    onPresentStimulus?: (item: TenFrameItem, index: number) => void;
  },
}));

vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({
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
      tutorSpeaking: runnerState.tutorSpeaking,
      cuedItemId: runnerState.cuedItemId ?? item?.id ?? null,
      revealHeld: runnerState.revealHeld,
      armStillness: (commit: () => void, ms?: number) => {
        if (runnerState.stillness) clearTimeout(runnerState.stillness);
        runnerState.stillness = setTimeout(commit, ms ?? 3000);
      },
      clearStillness: () => {
        if (runnerState.stillness) clearTimeout(runnerState.stillness);
        runnerState.stillness = null;
      },
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: vi.fn(),
      stimulusTapped: false,
      submitGestureAttempt: (cue: string) => {
        if (runnerState.stillness) clearTimeout(runnerState.stillness);
        runnerState.stillness = null;
        runnerState.gestureCues.push(cue);
        runnerState.awaiting = true;
      },
      isAwaitingGesture: () => runnerState.awaiting,
      loop: {},
    };
  },
}));

// JudgedMicPanel subscribes to the live mic level (19b) — the only reason
// this suite touches the AI context at all.
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import TenFrame, { type TenFrameChallenge, type TenFrameData } from '../TenFrame';

const challenge = (
  id: string,
  type: TenFrameChallenge['type'],
  targetCount: number,
  extra: Partial<TenFrameChallenge> = {},
): TenFrameChallenge => ({
  id,
  type,
  targetCount,
  instruction: 'Use the ten frame.',
  hint: 'Look at the frame.',
  narration: 'Use the frame.',
  ...extra,
});

const data = (
  gradeBand: TenFrameData['gradeBand'],
  challenges: TenFrameChallenge[],
  showOptions: TenFrameData['showOptions'] = { showCount: true, showEmptyCount: false, showEquation: false },
): TenFrameData => ({
  title: 'Ten-frame stage test',
  mode: 'single',
  counters: { count: 0, color: 'red', positions: [] },
  challenges,
  showOptions,
  gradeBand,
});

const cells = () => Array.from(document.querySelectorAll<SVGRectElement>('rect.cursor-pointer'));
const counters = () => document.querySelectorAll('svg circle');

/** The runner calls this the moment an item is on screen; the mock leaves it to
 *  the test so timers stay deterministic. */
const openItem = (index = 0) => {
  runnerState.index = index;
  if (runnerState.stillness) clearTimeout(runnerState.stillness);
  runnerState.stillness = null;
  const item = runnerState.options!.pack.items[index];
  act(() => runnerState.options!.onItemOpened?.(item, index));
  return item;
};

/** THE SEAM 19c MOVED. The runner decides WHEN a stimulus may be presented —
 *  falling edge on her voice, `cuedItemId`, the silence fallback and the prep
 *  beat all live in `useJudgedScriptRunner` and are driven against the real
 *  hook in `hooks/useJudgedScriptRunner.test.tsx`. What is still this file's
 *  job is WHAT the stage does when it is told to present. */
const presentStimulus = (index = runnerState.index) => {
  const item = runnerState.options!.pack.items[index];
  act(() => runnerState.options!.onPresentStimulus?.(item, index));
};

beforeEach(() => {
  cleanup();
  runnerState.index = 0;
  runnerState.stage = 'asking';
  runnerState.running = true;
  runnerState.awaiting = false;
  runnerState.solved = new Set();
  runnerState.tutorSpeaking = false;
  runnerState.cuedItemId = null;
  runnerState.revealHeld = false;
  if (runnerState.stillness) clearTimeout(runnerState.stillness);
  runnerState.stillness = null;
  runnerState.gestureCues = [];
  runnerState.options = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TenFrame stage · K make-ten stays a direct manipulation (contract R6)', () => {
  it('seeds the shown counters, fixes them, and auto-judges the enacted complement on a full frame', () => {
    render(<TenFrame data={data('K', [challenge('m1', 'make_ten', 6)])} />);
    openItem();

    expect(counters()).toHaveLength(6);
    // No stepper, no Check, no Next — nothing on screen carries the child on.
    expect(screen.queryByText(/6 \+ ___ = 10/)).toBeNull();
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();

    // The six seeded counters are not removable.
    fireEvent.click(cells()[0]);
    expect(counters()).toHaveLength(6);

    // Three placed counters are not enough; the fourth fills the frame and
    // commits without a timer.
    fireEvent.click(cells()[6]);
    fireEvent.click(cells()[7]);
    fireEvent.click(cells()[8]);
    expect(counters()).toHaveLength(9);
    expect(runnerState.gestureCues).toHaveLength(0);

    fireEvent.click(cells()[9]);
    expect(counters()).toHaveLength(10);
    expect(runnerState.gestureCues).toHaveLength(1);
    // The verdict is about the FOUR the child placed, not the six seeded.
    expect(runnerState.gestureCues[0]).toContain('placed 4 of the 4 counters');
  });

  it('commits a frame the child stopped filling — stopping early is now a wrong answer', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('m1', 'make_ten', 6)])} />);
    openItem();

    fireEvent.click(cells()[6]);
    fireEvent.click(cells()[7]);
    expect(runnerState.gestureCues).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('placed 2 of the 4 counters');
    expect(runnerState.gestureCues[0]).toContain('does NOT fill it');
  });
});

describe('TenFrame stage · build keeps its hands and loses its button', () => {
  it('closes a hands turn on stillness and reports the placement to the tutor', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('b1', 'build', 3)])} />);
    openItem();

    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    expect(counters()).toHaveLength(0);

    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    expect(counters()).toHaveLength(2);

    // A further tap restarts the window — the child is still working.
    act(() => { vi.advanceTimersByTime(2000); });
    expect(runnerState.gestureCues).toHaveLength(0);
    fireEvent.click(cells()[2]);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(runnerState.gestureCues).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('put 3 counters on the frame');
    expect(runnerState.gestureCues[0]).toContain('MATCHES');
  });

  it('stays tappable on item 2, where the runner still reports the item-1 affirm', () => {
    // REGRESSION (found by a real drive, 2026-08-13): item 1 built fine and
    // item 2's frame was DEAD. The runner sets stage='affirmed' and opens the
    // next item in the same dispatch, and nothing returns it to 'asking' on the
    // happy path — so a `stage === 'asking'` interaction gate silently killed
    // every item after the first. It came back only if the child got something
    // wrong, because a correction is one of the few paths that resets the stage.
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [
      challenge('b1', 'build', 2),
      challenge('b2', 'build', 3),
    ])} />);

    openItem(0);
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);

    // Exactly what the runner does on an affirm: mark solved, stage stays
    // 'affirmed', open the next item.
    runnerState.stage = 'affirmed';
    runnerState.solved = new Set(['b1']);
    runnerState.awaiting = false;
    openItem(1);

    expect(counters()).toHaveLength(0);
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    fireEvent.click(cells()[2]);
    expect(counters()).toHaveLength(3);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(2);
    expect(runnerState.gestureCues[1]).toContain('put 3 counters on the frame');
  });

  it('locks the frame once THIS item is solved', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('b1', 'build', 2)])} />);
    openItem(0);

    runnerState.stage = 'affirmed';
    runnerState.solved = new Set(['b1']);
    openItem(0);

    fireEvent.click(cells()[0]);
    expect(counters()).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(0);
  });

  it('commits a WRONG placement exactly as readily as a right one', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('b1', 'build', 5)])} />);
    openItem();

    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(runnerState.gestureCues[0]).toContain('put 2 counters on the frame');
    expect(runnerState.gestureCues[0]).toContain('does NOT match');
  });
});

describe('TenFrame stage · subitize is flash-then-hide (contract R4)', () => {
  /**
   * ⚠️ THE GATE MOVED (19c). Until 2026-08-15 this block also owned the
   * TIMING rules — falling edge on her voice, `cuedItemId`, the 12s silence
   * fallback, the prep beat, and the re-render-churn invariant. All five are
   * `useJudgedScriptRunner`'s now and are driven against the REAL hook in
   * `hooks/useJudgedScriptRunner.test.tsx` ("the stimulus clock"), because
   * asserting them here would only assert this file's mock.
   *
   * What is still the STAGE's job, and stays here: nothing appears until the
   * runner says present, the counters then show for `flashDuration` and hide
   * before the answer is asked for, a hidden frame cannot be tapped, and the
   * correction path re-hides them.
   */
  const renderSubitize = (fixture = data('K', [challenge('s1', 'subitize', 4, { flashDuration: 1500 })])) =>
    ({ ...render(<TenFrame data={fixture} />), fixture });

  it('shows nothing until the runner presents the stimulus', () => {
    vi.useFakeTimers();
    renderSubitize();
    openItem();

    // However long the item has been on screen: the frame is dark until the
    // tutor has had her say. That decision is not made here.
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(counters()).toHaveLength(0);

    presentStimulus();
    expect(counters()).toHaveLength(4);
  });

  it('hides the counters before the answer is asked for, and a hidden frame cannot be tapped', () => {
    vi.useFakeTimers();
    renderSubitize();
    openItem();

    presentStimulus();
    expect(counters()).toHaveLength(4);

    act(() => { vi.advanceTimersByTime(1499); });
    expect(counters()).toHaveLength(4);
    act(() => { vi.advanceTimersByTime(1); });
    expect(counters()).toHaveLength(0);

    // Hidden counters cannot be manipulated — subitizing is never tap-counting.
    fireEvent.click(cells()[0]);
    expect(counters()).toHaveLength(0);
    expect(runnerState.gestureCues).toHaveLength(0);

    // The stimulus can be re-shown; it is never withdrawn. This one is the
    // CHILD's request, so it is deliberately un-gated.
    const showAgain = screen.getByRole('button', { name: /show again/i });
    act(() => { fireEvent.click(showAgain); });
    expect(counters()).toHaveLength(4);
  });

  it('re-hides the counters on a correction, so the re-flash is a real stimulus again', () => {
    vi.useFakeTimers();
    renderSubitize();
    const item = openItem();

    presentStimulus();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(counters()).toHaveLength(0);
    presentStimulus();
    expect(counters()).toHaveLength(4);

    // The runner re-arms its gate on this path; the stage's job is to clear the
    // board so what she re-asks about is shown afresh.
    act(() => runnerState.options!.onCorrectionRetry?.(item, 1));
    expect(counters()).toHaveLength(0);
    presentStimulus();
    expect(counters()).toHaveLength(4);
  });

  it('restores the counters when the TUTOR affirms — not when a button is clicked', () => {
    vi.useFakeTimers();
    renderSubitize();
    const item = openItem();

    presentStimulus();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(counters()).toHaveLength(0);

    // Exactly what the runner does on an affirm: close the item in the solved
    // ledger, hold the reveal, then call back. 18b: the reveal is keyed to
    // `revealHeld`, NOT to `currentSolved` — the runner opens the next item in
    // the same dispatch, so by render time the current item is the next one.
    runnerState.stage = 'affirmed';
    runnerState.solved = new Set(['s1']);
    runnerState.revealHeld = true;
    act(() => runnerState.options!.onAffirmed?.(item));
    expect(counters()).toHaveLength(4);
    expect(screen.getByText(/4 — four counters!/)).toBeTruthy();
  });

  /**
   * REGRESSION (18b) — the reveal used to paint on the LAST item and nowhere
   * else, in four ports, for a month: the port set the reward in `onAffirmed`
   * and cleared it in `onItemOpened`, and the runner fires both in ONE dispatch
   * on the advance path. Rendering on `currentSolved` had the same hole from the
   * other side. Re-pointing this gate at `currentSolved` fails here.
   */
  it('paints the reveal while the NEXT item is already on screen', () => {
    vi.useFakeTimers();
    renderSubitize(data('K', [
      challenge('s1', 'subitize', 4, { flashDuration: 1500 }),
      challenge('s2', 'subitize', 3, { flashDuration: 1500 }),
    ]));
    const item = openItem(0);

    runnerState.solved = new Set(['s1']);
    runnerState.revealHeld = true;
    act(() => runnerState.options!.onAffirmed?.(item));

    // The advance: item 2 is on screen and is NOT solved, exactly as the runner
    // leaves things while she is still saying "Yes! Four counters."
    openItem(1);
    expect(screen.getByText(/4 — four counters!/)).toBeTruthy();

    // Her cue for item 2 reaches the floor: the reveal is over.
    runnerState.revealHeld = false;
    act(() => { runnerState.index = 1; });
    presentStimulus(1);
    expect(screen.queryByText(/4 — four counters!/)).toBeNull();
  });
});

describe('TenFrame stage · re-based and new leak gates', () => {
  it('Grades 1-2 make-ten drops the stepper and becomes a spoken item', () => {
    render(<TenFrame data={data('1-2', [challenge('g1', 'make_ten', 6)])} />);
    const item = openItem();

    expect(item.answerKind).toBe('voice');
    expect(item.answer).toBe(4);
    expect(screen.queryByText(/6 \+ ___ = 10/)).toBeNull();
    expect(screen.queryByRole('button', { name: '+' })).toBeNull();
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();

    // Taps on a voice item are working, not committing.
    fireEvent.click(cells()[6]);
    expect(runnerState.gestureCues).toHaveLength(0);
  });

  it('every challenge owns its starting frame state', () => {
    render(<TenFrame data={data('K', [
      challenge('m1', 'make_ten', 9),
      challenge('a1', 'add', 5, { addend1: 2, addend2: 3 }),
    ])} />);

    openItem(0);
    expect(counters()).toHaveLength(9);
    fireEvent.click(cells()[9]);
    expect(runnerState.gestureCues).toHaveLength(1);

    runnerState.awaiting = false;
    openItem(1);
    expect(counters()).toHaveLength(0);
  });

  it('withdraws the running count on add/subtract, where it equals the spoken answer', () => {
    render(<TenFrame data={data('1-2', [challenge('a1', 'add', 5, { addend1: 2, addend2: 3 })])} />);
    openItem();

    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    expect(counters()).toHaveLength(2);
    // REVERT-BITE: showCount is true in this fixture. The readout is still gone.
    expect(screen.queryByText(/Counters:/)).toBeNull();
  });

  it('keeps the running count on build, where it is the child’s own trace', () => {
    render(<TenFrame data={data('K', [challenge('b1', 'build', 3)])} />);
    openItem();

    fireEvent.click(cells()[0]);
    expect(screen.getByText(/Counters:/)).toBeTruthy();
  });

  it('never renders an empty-space readout — on a make-ten item that IS the answer (R5)', () => {
    // REVERT-BITE: the flag is forced TRUE here. R5 used to rest on the
    // generator always writing false; the stage no longer trusts it.
    render(<TenFrame data={data(
      '1-2',
      [challenge('g1', 'make_ten', 6)],
      { showCount: true, showEmptyCount: true, showEquation: true },
    )} />);
    openItem();
    expect(screen.queryByText(/Empty:/)).toBeNull();
  });
});


describe('TenFrame stage · split is a partition, not a construction (contract R9)', () => {
  /** Counter fills, in DOM order — the colour is the answer material here, so
   *  the tests read it rather than trusting a count. */
  const fills = () =>
    Array.from(document.querySelectorAll<SVGCircleElement>('svg circle'))
      .map((c) => c.getAttribute('fill'));
  const RED = '#ef4444';
  const YELLOW = '#eab308';

  it('seeds the whole group all-red and leaves the empty cells inert', () => {
    render(<TenFrame data={data('K', [challenge('s1', 'split', 5)])} />);
    openItem();

    // The group ARRIVES. The child is not asked to build it — `build` is the
    // mode that does that, and conflating them is how the judge came back
    // "only asks to place N counters on a frame".
    expect(fills()).toEqual([RED, RED, RED, RED, RED]);

    // Tapping an empty cell adds nothing: the total the child was handed is the
    // total they hand back, so the only variable is where the colour line goes.
    fireEvent.click(cells()[7]);
    expect(fills()).toHaveLength(5);
    expect(runnerState.gestureCues).toHaveLength(0);
  });

  it('flips a counter on tap and flips it back, without changing the total', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('s1', 'split', 5)])} />);
    openItem();

    fireEvent.click(cells()[0]);
    expect(fills()).toEqual([YELLOW, RED, RED, RED, RED]);

    fireEvent.click(cells()[1]);
    expect(fills()).toEqual([YELLOW, YELLOW, RED, RED, RED]);

    // A second tap on the same counter turns it back — the two-colour counter
    // has two faces, and a child who mis-taps must be able to undo it.
    fireEvent.click(cells()[1]);
    expect(fills()).toEqual([YELLOW, RED, RED, RED, RED]);
    expect(fills()).toHaveLength(5);
  });

  it('commits on STILLNESS, carrying the yellow count, and nothing on screen commits it', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('s1', 'split', 5)])} />);
    openItem();

    // No control closes a hands turn — that was the Check button's job and it
    // does not exist here.
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();

    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    expect(runnerState.gestureCues).toHaveLength(0);   // still moving

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    // Two turned yellow out of five → the pair is 3 and 2, computed in code.
    expect(runnerState.gestureCues[0]).toContain('left 3 counters red and turned 2 yellow');
    expect(runnerState.gestureCues[0]).toContain('CORRECT');
  });

  it('commits a wrong partition exactly as readily as a right one', () => {
    // The property a Check button used to fake: if only correct states could
    // commit, the mode would have no wrong answer and nothing to teach.
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('s1', 'split', 4)])} />);
    openItem();

    for (const cell of cells().slice(0, 4)) fireEvent.click(cell);
    expect(fills()).toEqual([YELLOW, YELLOW, YELLOW, YELLOW]);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('EMPTY_PART');
  });

  it('remembers the ways already shown, so a repeat on the same total is corrected', () => {
    // THE SESSION IS THE UNIT. "Decompose in more than one way" is not
    // assessable from one item however well it is judged, so the ledger has to
    // survive the advance between items.
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [
      challenge('s1', 'split', 5),
      challenge('s2', 'split', 5),
    ])} />);

    openItem(0);
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues[0]).toContain('CORRECT');

    // Item two, same total, same pair.
    runnerState.awaiting = false;
    openItem(1);
    expect(fills()).toEqual([RED, RED, RED, RED, RED]);   // starts all-red again
    fireEvent.click(cells()[3]);
    fireEvent.click(cells()[4]);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(runnerState.gestureCues).toHaveLength(2);
    expect(runnerState.gestureCues[1]).toContain('REPEAT');
    expect(runnerState.gestureCues[1]).toContain('already shown this exact pair');
  });

  it('accepts a different pair on the second ask', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [
      challenge('s1', 'split', 5),
      challenge('s2', 'split', 5),
    ])} />);

    openItem(0);
    fireEvent.click(cells()[0]);
    act(() => { vi.advanceTimersByTime(3000); });

    runnerState.awaiting = false;
    openItem(1);
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(runnerState.gestureCues[1]).toContain('CORRECT');
  });

  it('clears the flips on a correction retry, back to the all-red group', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('s1', 'split', 5)])} />);
    const item = openItem();

    for (const cell of cells().slice(0, 5)) fireEvent.click(cell);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues[0]).toContain('EMPTY_PART');

    runnerState.awaiting = false;
    act(() => runnerState.options!.onCorrectionRetry?.(item, 1));
    // The tutor re-modelled and re-asked; the working surface goes back to what
    // the ask describes, not to the state that was just judged wrong.
    expect(fills()).toEqual([RED, RED, RED, RED, RED]);
  });

  it('never prints a count readout on a split item — the honest one would be the answer', () => {
    render(<TenFrame data={data('K', [challenge('s1', 'split', 5)])} />);
    openItem();
    // `build` and make-ten keep their trace; here the total is already on
    // screen and in the ask, and the PARTS are what a readout would add.
    expect(screen.queryByText(/^Counters:/)).toBeNull();
  });

  it('reveals the pair the CHILD built, and only after the tutor affirms', () => {
    vi.useFakeTimers();
    render(<TenFrame data={data('K', [challenge('s1', 'split', 5)])} />);
    const item = openItem();

    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[1]);
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('3 + 2 = 5')).toBeNull();   // nothing before the verdict
    runnerState.revealHeld = true;
    act(() => runnerState.options!.onAffirmed?.(item));
    expect(screen.getByText('3 + 2 = 5')).not.toBeNull();
  });
});

describe('TenFrame stage · teen numbers are a K double frame (contract R2 fork)', () => {
  const fills = () =>
    Array.from(document.querySelectorAll<SVGCircleElement>('svg circle'))
      .map((c) => c.getAttribute('fill'));
  const RED = '#ef4444';
  const YELLOW = '#eab308';

  const teenData = (challenges: TenFrameChallenge[]): TenFrameData => ({
    ...data('K', challenges),
    mode: 'double',
  });

  it('renders TWENTY cells at K, which no other mode does', () => {
    render(<TenFrame data={teenData([challenge('t1', 'build_teen', 14)])} />);
    openItem();
    expect(cells()).toHaveLength(20);
  });

  it('build_teen: seeds the full top frame, fixes it, and asks only for the ones', () => {
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t1', 'build_teen', 14)])} />);
    openItem();

    // The ten ARRIVES as one full frame — that is the model K.NBT.1 teaches.
    expect(counters()).toHaveLength(10);

    // The seeded ten is not removable: it is the given, not the answer.
    fireEvent.click(cells()[3]);
    expect(counters()).toHaveLength(10);
    expect(runnerState.gestureCues).toHaveLength(0);

    // The ones go in the bottom frame.
    fireEvent.click(cells()[10]);
    fireEvent.click(cells()[11]);
    fireEvent.click(cells()[12]);
    fireEvent.click(cells()[13]);
    expect(counters()).toHaveLength(14);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    // The committed number is the ONES, not what is on the frame.
    expect(runnerState.gestureCues[0]).toContain('put 4 more counters beside the ten');
    expect(runnerState.gestureCues[0]).toContain('MATCHES');
  });

  it('build_teen does NOT auto-commit on a full frame — it has no terminal state', () => {
    // K make-ten judges the moment the frame fills (contract R6). build_teen
    // must not inherit that: filling all twenty is a WRONG answer to "make
    // fourteen", and a commit fired by the frame rather than by stillness would
    // make the frame the judge.
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t1', 'build_teen', 14)])} />);
    openItem();

    for (let i = 10; i < 20; i++) fireEvent.click(cells()[i]);
    expect(counters()).toHaveLength(20);
    expect(runnerState.gestureCues).toHaveLength(0);   // nothing on screen judged it

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('does NOT match');
  });

  it('build_teen commits a SHORT placement exactly as readily as a right one', () => {
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t1', 'build_teen', 14)])} />);
    openItem();

    fireEvent.click(cells()[10]);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('does NOT match');
    expect(runnerState.gestureCues[0]).toContain('that is not fourteen yet');
  });

  it('decompose_teen: seeds the group SCATTERED, so no full frame gives the ten away', () => {
    render(<TenFrame data={teenData([challenge('t2', 'decompose_teen', 14)])} />);
    const item = openItem();

    expect(counters()).toHaveLength(14);
    expect(fills().every((f) => f === RED)).toBe(true);
    // The seeding is the script's, not "the first fourteen cells".
    expect(item.seedCells).toHaveLength(14);
    const top = item.seedCells!.filter((c) => c < 10).length;
    expect(top).toBeLessThan(10);
    expect(14 - top).toBeLessThan(10);
  });

  it('decompose_teen: taps FLIP, and the empty cells are inert', () => {
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t2', 'decompose_teen', 14)])} />);
    const item = openItem();
    const seeded = item.seedCells!;
    const empty = Array.from({ length: 20 }, (_, i) => i).filter((i) => !seeded.includes(i));

    fireEvent.click(cells()[empty[0]]);
    expect(counters()).toHaveLength(14);            // nothing added
    expect(fills().every((f) => f === RED)).toBe(true);

    fireEvent.click(cells()[seeded[0]]);
    expect(fills().filter((f) => f === YELLOW)).toHaveLength(1);
    fireEvent.click(cells()[seeded[0]]);            // flips back
    expect(fills().filter((f) => f === YELLOW)).toHaveLength(0);
    expect(counters()).toHaveLength(14);            // the total cannot drift
  });

  it('decompose_teen: commits the YELLOW count on stillness, judged against ten', () => {
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t2', 'decompose_teen', 14)])} />);
    const item = openItem();
    const seeded = item.seedCells!;

    for (let i = 0; i < 10; i++) fireEvent.click(cells()[seeded[i]]);
    expect(runnerState.gestureCues).toHaveLength(0);   // still moving

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('turned 10 of the 14 counters yellow');
    expect(runnerState.gestureCues[0]).toContain('MATCHES');
  });

  it('decompose_teen commits a wrong count exactly as readily as a right one', () => {
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t2', 'decompose_teen', 14)])} />);
    const item = openItem();

    for (let i = 0; i < 8; i++) fireEvent.click(cells()[item.seedCells![i]]);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues[0]).toContain('does NOT match');
    expect(runnerState.gestureCues[0]).toContain('that is not ten yellow yet');
  });

  it('never prints a count readout on decompose_teen — the honest one is the answer', () => {
    // build_teen keeps its trace: that number is the TOTAL on the frames, which
    // the ask states aloud. decompose_teen's would be the yellow count, which
    // is exactly what the child is being asked to produce.
    vi.useFakeTimers();
    render(<TenFrame data={teenData([challenge('t2', 'decompose_teen', 14)])} />);
    const item = openItem();
    fireEvent.click(cells()[item.seedCells![0]]);
    expect(screen.queryByText(/Counters:/)).toBeNull();

    cleanup();
    render(<TenFrame data={teenData([challenge('t1', 'build_teen', 14)])} />);
    openItem();
    fireEvent.click(cells()[10]);
    expect(screen.getByText(/Counters:/)).toBeTruthy();
  });

  it('keeps the SAME scatter across a correction retry', () => {
    // Moving the counters between tries would make the correction
    // unfollowable: the child is being asked to count the same group again.
    render(<TenFrame data={teenData([challenge('t2', 'decompose_teen', 14)])} />);
    const item = openItem();
    const before = fills().length;

    fireEvent.click(cells()[item.seedCells![0]]);
    act(() => runnerState.options!.onCorrectionRetry?.(item, 1));

    expect(counters()).toHaveLength(before);
    expect(fills().every((f) => f === RED)).toBe(true);   // back to all-red
  });
});
