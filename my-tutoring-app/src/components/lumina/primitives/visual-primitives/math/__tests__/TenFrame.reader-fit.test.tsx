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
 *  Plus the leak this port introduced a gate for: the running-count readout is
 *  withdrawn on add/subtract, where it equals the number about to be spoken.
 *
 * The runner is mocked at the seam — it has its own suite
 * (`hooks/useJudgedScriptRunner.test.tsx`) and the pack has its own
 * (`TenFrame.di-script.test.ts`). What is under test here is the STAGE.
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
  gestureCues: [] as string[],
  options: null as null | {
    pack: { items: TenFrameItem[] };
    onItemOpened?: (item: TenFrameItem, index: number) => void;
    onAffirmed?: (item: TenFrameItem) => void;
    onCorrectionRetry?: (item: TenFrameItem, used: number) => void;
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
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: vi.fn(),
      stimulusTapped: false,
      submitGestureAttempt: (cue: string) => {
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
  const item = runnerState.options!.pack.items[index];
  act(() => runnerState.options!.onItemOpened?.(item, index));
  return item;
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
  /** Render with a handle that drives the tutor's voice, the way the runner
   *  passes `ctx.isAudioPlaying` through. The flash gate is a falling edge on
   *  this, so a test that never speaks never flashes — deliberately. */
  const renderSubitize = (fixture = data('K', [challenge('s1', 'subitize', 4, { flashDuration: 1500 })])) => {
    const utils = render(<TenFrame data={fixture} />);
    return {
      ...utils,
      fixture,
      setTutorSpeaking: (speaking: boolean) => {
        runnerState.tutorSpeaking = speaking;
        act(() => { utils.rerender(<TenFrame data={fixture} />); });
      },
    };
  };

  /** She speaks her line, then stops — the normal path into a flash. */
  const tutorSays = (view: ReturnType<typeof renderSubitize>, ms = 4000) => {
    view.setTutorSpeaking(true);
    act(() => { vi.advanceTimersByTime(ms); });
    view.setTutorSpeaking(false);
  };

  it('waits for the TUTOR to finish before flashing — she instructs, then the frame flashes', () => {
    // DRIVE 3 (2026-08-13, user): "the ten frame needs to flash after her first
    // intro, right now it flashes then she instructs, this would be confusing
    // for the child." It was: the flash ran on a beat measured from item-open
    // while her opening line took ~4s, so the counters came and went while she
    // was still saying "watch the frame", and the ask landed on a frame the
    // child never saw. THE TUTOR OWNS THE CLOCK applies to the stimulus too.
    vi.useFakeTimers();
    const view = renderSubitize();
    openItem();

    // Her whole utterance: the frame stays dark, however long she takes.
    view.setTutorSpeaking(true);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(counters()).toHaveLength(0);

    // She stops. A breath, then the counters.
    view.setTutorSpeaking(false);
    act(() => { vi.advanceTimersByTime(699); });
    expect(counters()).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(1); });
    expect(counters()).toHaveLength(4);
  });

  it('does not mistake the silence BEFORE she starts for the silence after', () => {
    // "Not speaking" is also true in the gap between the cue being queued and
    // her audio arriving, so the gate is a falling edge, not a level.
    vi.useFakeTimers();
    renderSubitize();
    openItem();

    act(() => { vi.advanceTimersByTime(3000); });
    expect(counters()).toHaveLength(0);
  });

  it('flashes anyway if her audio never arrives at all', () => {
    // A child cannot answer a question about a frame that never flashed.
    vi.useFakeTimers();
    renderSubitize();
    openItem();

    // Two beats: the fallback fires and React flushes, and only then does the
    // prep timer get armed.
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(counters()).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(700); });
    expect(counters()).toHaveLength(4);
  });

  it('hides the counters before the answer is asked for, and a hidden frame cannot be tapped', () => {
    vi.useFakeTimers();
    const view = renderSubitize();
    openItem();

    expect(counters()).toHaveLength(0);
    tutorSays(view);
    act(() => { vi.advanceTimersByTime(700); });
    expect(counters()).toHaveLength(4);

    act(() => { vi.advanceTimersByTime(1500); });
    expect(counters()).toHaveLength(0);

    // Hidden counters cannot be manipulated — subitizing is never tap-counting.
    fireEvent.click(cells()[0]);
    expect(counters()).toHaveLength(0);
    expect(runnerState.gestureCues).toHaveLength(0);

    // The stimulus can be re-shown; it is never withdrawn.
    expect(screen.getByRole('button', { name: /show again/i })).toBeTruthy();
  });

  it('re-flashes after her CORRECTION finishes, on the same gate as the first ask', () => {
    // This is what retired the hand-tuned "wait 3s for the correction to
    // finish" window: there is no window, there is her voice.
    vi.useFakeTimers();
    const view = renderSubitize();
    const item = openItem();

    tutorSays(view);
    act(() => { vi.advanceTimersByTime(700 + 1500); });
    expect(counters()).toHaveLength(0);

    act(() => runnerState.options!.onCorrectionRetry?.(item, 1));

    // Her correction is long. Nothing flashes underneath it.
    view.setTutorSpeaking(true);
    act(() => { vi.advanceTimersByTime(8000); });
    expect(counters()).toHaveLength(0);

    view.setTutorSpeaking(false);
    act(() => { vi.advanceTimersByTime(700); });
    expect(counters()).toHaveLength(4);
  });

  it('does not flash on the tail of the PREVIOUS item’s affirmation', () => {
    // REGRESSION (drive 5, 2026-08-14, user): "when i get it wrong, the very
    // next one flashes way too fast before she finishes her statement."
    //
    // The falling edge was right and its SUBJECT was wrong. On an affirm the
    // runner queues the next item's cue and opens the item in the same
    // dispatch, but a queued cue waits for the floor — so item 2 is on screen
    // for the entire tail of item 1's affirmation. The latch filled on that
    // tail, her affirm drained, and the flash fired in the silence BEFORE the
    // ask for item 2 had even been sent. `cuedItemId` is what makes "she
    // stopped" mean "she stopped saying THIS item's line".
    vi.useFakeTimers();
    const fixture = data('K', [
      challenge('s1', 'subitize', 4, { flashDuration: 1500 }),
      challenge('s2', 'subitize', 3, { flashDuration: 1500 }),
    ]);
    const view = renderSubitize(fixture);
    openItem(0);

    // Item 1 runs normally.
    tutorSays(view);
    act(() => { vi.advanceTimersByTime(700 + 1500); });
    expect(counters()).toHaveLength(0);

    // She AFFIRMS item 1 and the runner opens item 2 underneath her voice. Her
    // cue for item 2 is queued, not sent — `cuedItemId` still names item 1.
    runnerState.cuedItemId = 's1';
    view.setTutorSpeaking(true);
    openItem(1);

    // Her affirmation ends. Nothing may flash: this silence is the gap before
    // the ask, not after it. (Pre-fix, the counters appeared right here.)
    view.setTutorSpeaking(false);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(counters()).toHaveLength(0);

    // The queued cue goes out and she asks about item 2. NOW the gate arms.
    runnerState.cuedItemId = 's2';
    tutorSays(view);
    act(() => { vi.advanceTimersByTime(700) });
    expect(counters()).toHaveLength(3);
  });

  it('flashes even while the component re-renders continuously (mic-level churn)', () => {
    // REGRESSION (drive 2, 2026-08-13): the frame NEVER flashed — the screen sat
    // on "Get ready to look…" forever while the tutor asked "How many counters
    // did you see?" against an empty frame. The prep timer lives in an effect
    // that depends on the flash callback; that callback closed over `runner`,
    // which is a fresh object every render, and back then `ctx.micLevel` updated
    // once per audio frame. So the effect tore down and re-armed its timer many
    // times a second and the timer could never reach its deadline.
    // 19b took the level off the context value, so the mic no longer SUPPLIES
    // that churn — but the frame's own re-render does, and the invariant this
    // pins is the one that matters: a stimulus timer must survive its component
    // re-rendering. Hence: re-render throughout the wait.
    vi.useFakeTimers();
    const fixture = data('K', [challenge('s1', 'subitize', 4, { flashDuration: 1500 })]);
    const { rerender } = render(<TenFrame data={fixture} className="churn-0" />);
    openItem();

    runnerState.tutorSpeaking = true;
    act(() => { rerender(<TenFrame data={fixture} className="churn-speaking" />); });
    act(() => { vi.advanceTimersByTime(2000); });
    runnerState.tutorSpeaking = false;
    act(() => { rerender(<TenFrame data={fixture} className="churn-quiet" />); });

    for (let i = 1; i <= 10; i++) {
      act(() => { vi.advanceTimersByTime(100); });
      rerender(<TenFrame data={fixture} className={`churn-${i}`} />);
    }

    expect(counters()).toHaveLength(4);
  });

  it('restores the counters when the TUTOR affirms — not when a button is clicked', () => {
    vi.useFakeTimers();
    const view = renderSubitize();
    const item = openItem();

    tutorSays(view);
    act(() => { vi.advanceTimersByTime(700 + 1500); });
    expect(counters()).toHaveLength(0);

    // Exactly what the runner does on an affirm: close the item in the solved
    // ledger, then call back. The reveal is keyed to that ledger, not to the
    // stage word, for the same reason the tap gate is.
    runnerState.stage = 'affirmed';
    runnerState.solved = new Set(['s1']);
    act(() => runnerState.options!.onAffirmed?.(item));
    expect(counters()).toHaveLength(4);
    expect(screen.getByText(/4 — four counters!/)).toBeTruthy();
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
