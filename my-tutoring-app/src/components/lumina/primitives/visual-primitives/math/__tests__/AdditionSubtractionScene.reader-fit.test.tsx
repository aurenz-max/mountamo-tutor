// @vitest-environment jsdom
/**
 * AdditionSubtractionScene STAGE behaviour under the judged loop. Every intent
 * this file pinned in the click era is still pinned — re-based, not dropped:
 *
 *  1. (contract R3 / item 11) act-out at K is DIRECT MANIPULATION: the scene is
 *     seeded with the story's startCount objects, tapping an object sends THAT
 *     object away, survivors keep their exact positions, and there is no number
 *     entry. UNCHANGED — the DI port preserved this surface and added a judge.
 *  2. What used to CLOSE those items was an auto-judge that fired when the count
 *     MATCHED, i.e. a Check button that pressed itself: the child could not
 *     produce a wrong answer, so the tutor could never teach. Re-based — a hands
 *     turn now closes on STILLNESS, and a WRONG scene commits exactly as
 *     readily as a right one. That is the pin that matters.
 *  3. (item 1b) solve-story at K pinned "no typing; answer by tapping a numeral
 *     tile". Re-based: no typing at ANY band, and the tile row is gone too — a
 *     menu is recognition, and the answer is now unaided speech. What this file
 *     pins is the ABSENCE of both, plus the counting aid that survived.
 *  4. (item 12) act-out subtraction at Grade 1 enacts the departure, capped at
 *     changeCount, after which taps count the survivors. UNCHANGED, except the
 *     count is spoken rather than typed.
 *  5. (R8) The ten frame mirrors the scene, never the stored result.
 *
 *  Plus WHICH items hold their change group back for the tutor's voice. The
 *  two clock rules themselves (falling edge, `cuedItemId`, silence fallback,
 *  survive-re-render) moved into the runner in 19c and are driven against the
 *  REAL hook in `hooks/useJudgedScriptRunner.test.tsx`; re-asserting them here
 *  would only assert this file's mock.
 *
 * The runner is mocked at the seam — it has its own suite, and the pack has its
 * own (`AdditionSubtractionScene.di-script.test.ts`). What is under test here is
 * the STAGE.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddSubSceneItem } from '../additionSubtractionSceneScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  stage: 'asking' as 'idle' | 'asking' | 'judging' | 'affirmed' | 'done',
  running: true,
  awaiting: false,
  solved: new Set<string>(),
  tutorSpeaking: false,
  /** The item the tutor's live line is about. `null` = "whatever is on screen",
   *  which is what every test that does not exercise the queue wants. */
  cuedItemId: null as string | null,
  /** 18b: is the affirmed item's reveal still on screen? */
  revealHeld: false,
  /** The runner owns the stillness window now (19c); the mock keeps one timer
   *  so the STAGE's arming and cancelling are still exercised here. */
  stillness: null as ReturnType<typeof setTimeout> | null,
  gestureCues: [] as string[],
  options: null as null | {
    pack: { items: AddSubSceneItem[] };
    onItemOpened?: (item: AddSubSceneItem, index: number) => void;
    onAffirmed?: (item: AddSubSceneItem) => void;
    onCorrectionRetry?: (item: AddSubSceneItem, used: number) => void;
    onPresentStimulus?: (item: AddSubSceneItem, index: number) => void;
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

import AdditionSubtractionScene, {
  type AddSubChallenge,
  type AdditionSubtractionSceneData,
} from '../AdditionSubtractionScene';

const ch = (over: Partial<AddSubChallenge>): AddSubChallenge => ({
  id: 'c1',
  type: 'act-out',
  instruction: '',
  storyText: '2 ducks are swimming in the pond. 1 more duck joins them.',
  scene: 'pond',
  objectType: 'ducks',
  operation: 'addition',
  storyType: 'join',
  startCount: 2,
  changeCount: 1,
  resultCount: 3,
  equation: '2 + 1 = 3',
  ...over,
});

const data = (
  gradeBand: AdditionSubtractionSceneData['gradeBand'],
  challenges: AddSubChallenge[],
  over: Partial<AdditionSubtractionSceneData> = {},
): AdditionSubtractionSceneData => ({
  title: 'Story stage test',
  gradeBand,
  maxNumber: gradeBand === 'K' ? 5 : 10,
  showTenFrame: false,
  showEquationBar: true,
  challenges,
  ...over,
});

const sceneObjects = () => Array.from(document.querySelectorAll('svg g'));

/** The (x,y) of each object's hit-target circle — its stable identity on screen. */
const objectPositions = () =>
  sceneObjects().map((g) => {
    const c = g.querySelector('circle')!;
    return `${c.getAttribute('cx')},${c.getAttribute('cy')}`;
  });

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
 *  beat all live in `useJudgedScriptRunner` and are driven against the REAL
 *  hook in `hooks/useJudgedScriptRunner.test.tsx`. What is still this file's
 *  job is WHAT the stage does when it is told to present. */
const presentStimulus = (index = runnerState.index) => {
  const item = runnerState.options!.pack.items[index];
  act(() => runnerState.options!.onPresentStimulus?.(item, index));
};

/**
 * Mount the stage with a re-render that actually re-renders.
 *
 * ⚠️ `rerender(sameElement)` is a no-op — React bails out on a referentially
 * identical element, so the component never re-reads the mocked runner and a
 * `tutorSpeaking` change is invisible. Every re-render here therefore carries a
 * fresh `className`, which is also what makes these tests a faithful stand-in
 * for the real thing: the mic re-renders this component many times a second.
 */
const mount = (fixture: AdditionSubtractionSceneData) => {
  let churn = 0;
  const view = render(<AdditionSubtractionScene data={fixture} className="churn-0" />);
  const repaint = () => {
    churn += 1;
    act(() => { view.rerender(<AdditionSubtractionScene data={fixture} className={`churn-${churn}`} />); });
  };
  return { ...view, repaint };
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

// ── K: act-out stays a direct manipulation (contract R3 item 11) ────────────

describe('act-out at Kindergarten stays enacted', () => {
  it('seeds startCount, sends a tapped object away, and offers no number entry', () => {
    render(<AdditionSubtractionScene data={data('K', [ch({
      operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2,
      storyText: '4 ducks are on the pond. 2 ducks swim away.',
    })])} />);
    openItem();

    expect(sceneObjects()).toHaveLength(4);
    expect(document.querySelector('input')).toBeNull();
    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();

    fireEvent.click(sceneObjects()[0]);
    expect(sceneObjects()).toHaveLength(3);
  });

  it('removes THAT object — survivors keep their exact positions', () => {
    render(<AdditionSubtractionScene data={data('K', [ch({
      operation: 'subtraction', startCount: 4, changeCount: 2, resultCount: 2,
    })])} />);
    openItem();

    const before = objectPositions();
    fireEvent.click(sceneObjects()[1]);
    const after = objectPositions();

    expect(after).toHaveLength(3);
    expect(after).toEqual([before[0], before[2], before[3]]);
  });

  it('brings objects in through the add control on an addition story', () => {
    render(<AdditionSubtractionScene data={data('K', [ch({
      startCount: 2, changeCount: 1, resultCount: 3,
    })])} />);
    openItem();

    expect(sceneObjects()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /add one ducks/i }));
    expect(sceneObjects()).toHaveLength(3);
  });

  // ⭐ THE PIN THAT MATTERS. The click era auto-judged the instant the count
  // MATCHED, so this mode could only ever produce a correct answer and the
  // tutor had nothing to correct. Stillness is not correctness-gated.
  it('commits on STILLNESS, and a WRONG scene commits exactly as readily', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={data('K', [ch({
      startCount: 2, changeCount: 2, resultCount: 4,
      storyText: '2 ducks are swimming in the pond. 2 more ducks join them.',
    })])} />);
    openItem();

    // Stop one short of the story. Nothing on screen says so.
    fireEvent.click(screen.getByRole('button', { name: /add one ducks/i }));
    expect(runnerState.gestureCues).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('does NOT match');
  });

  it('resets the stillness window on every further touch', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={data('K', [ch({
      startCount: 1, changeCount: 2, resultCount: 3,
    })])} />);
    openItem();

    const add = screen.getByRole('button', { name: /add one ducks/i });
    fireEvent.click(add);
    act(() => { vi.advanceTimersByTime(2500); });
    fireEvent.click(add);
    act(() => { vi.advanceTimersByTime(2500); });
    expect(runnerState.gestureCues).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(600); });
    expect(runnerState.gestureCues).toHaveLength(1);
    expect(runnerState.gestureCues[0]).toContain('MATCHES');
  });
});

// ── K: solve-story loses BOTH answer surfaces it used to have ──────────────

describe('solve-story answers with the mouth at every band', () => {
  const solve = (band: 'K' | '1') => data(band, [ch({
    type: 'solve-story',
    operation: 'subtraction',
    storyText: '5 bunnies are in the garden. 2 bunnies hop away.',
    objectType: 'bunnies',
    scene: 'garden',
    startCount: 5, changeCount: 2, resultCount: 3,
    unknownPosition: 'result',
  })]);

  it.each(['K', '1'] as const)('offers no keyboard and no numeral menu at %s', (band) => {
    render(<AdditionSubtractionScene data={solve(band)} />);
    openItem();

    expect(document.querySelector('input')).toBeNull();
    // The 0…max tile row (item 1b's K answer surface) is gone: a menu turns
    // production into recognition and floors a guess at one in six.
    expect(screen.queryByRole('group', { name: /choose the number/i })).toBeNull();
    for (const n of ['0', '1', '2', '3', '4', '5']) {
      expect(screen.queryByRole('button', { name: n })).toBeNull();
    }
  });

  // The counting aid survives — it is one-to-one correspondence (K.CC.4), the
  // child's own work, not a readout of the answer.
  it('still counts a tapped object with a highlight', () => {
    render(<AdditionSubtractionScene data={solve('K')} />);
    openItem();

    const before = document.querySelectorAll('svg circle').length;
    fireEvent.click(sceneObjects()[0]);
    expect(document.querySelectorAll('svg circle').length).toBeGreaterThan(before);
  });
});

// ── K: create-story is a build task at BOTH bands now ──────────────────────

describe('create-story builds the scene', () => {
  const create = (band: 'K' | '1', over: Partial<AddSubChallenge> = {}) =>
    data(band, [ch({
      type: 'create-story', storyText: '', objectType: 'birds', scene: 'farm',
      startCount: 3, changeCount: 2, resultCount: 5, equation: '3 + 2 = 5', ...over,
    })], { maxNumber: 10 });

  it('starts empty on an addition equation and commits what was built', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={create('K')} />);
    openItem();

    expect(sceneObjects()).toHaveLength(0);
    const add = screen.getByRole('button', { name: /add one birds/i });
    for (let i = 0; i < 5; i++) fireEvent.click(add);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(runnerState.gestureCues[0]).toContain('MATCHES');
  });

  it('seeds startCount on a subtraction equation', () => {
    render(<AdditionSubtractionScene data={create('K', {
      operation: 'subtraction', startCount: 5, changeCount: 2, resultCount: 3,
      equation: '5 - 2 = 3',
    })} />);
    openItem();
    expect(sceneObjects()).toHaveLength(5);
  });

  // The Grade-1 scene+object PICKER is deleted: it accepted any selection as
  // correct, so it could not produce a wrong answer and had nothing to judge.
  it('gives Grade 1 the same construction, not a picker that cannot be wrong', () => {
    render(<AdditionSubtractionScene data={create('1')} />);
    openItem();

    expect(screen.queryByText(/pick a scene and objects/i)).toBeNull();
    expect(screen.getByRole('button', { name: /add one birds/i })).toBeTruthy();
  });
});

// ── Grade 1: act-out enacts the departure, then SAYS the count ─────────────

describe('act-out at Grade 1 enacts, then speaks', () => {
  const subtractStory = () => data('1', [ch({
    operation: 'subtraction', objectType: 'frogs', scene: 'farm',
    storyText: '6 frogs sit on a log. 2 frogs hop away.',
    startCount: 6, changeCount: 2, resultCount: 4,
    equation: '6 - 2 = 4',
  })]);

  it('sends objects away up to changeCount, then taps count the survivors', () => {
    render(<AdditionSubtractionScene data={subtractStory()} />);
    openItem();

    expect(sceneObjects()).toHaveLength(6);
    fireEvent.click(sceneObjects()[0]);
    fireEvent.click(sceneObjects()[0]);
    expect(sceneObjects()).toHaveLength(4);

    // The story's departure is enacted; a further tap must NOT remove a fifth.
    const circlesBefore = document.querySelectorAll('svg circle').length;
    fireEvent.click(sceneObjects()[0]);
    expect(sceneObjects()).toHaveLength(4);
    expect(document.querySelectorAll('svg circle').length).toBeGreaterThan(circlesBefore);
  });

  it('reports the count with the mouth — no input, and no gesture commit', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={subtractStory()} />);
    openItem();

    expect(document.querySelector('input')).toBeNull();
    fireEvent.click(sceneObjects()[0]);
    act(() => { vi.advanceTimersByTime(6000); });
    // A voice item's turn is closed by the child's silence, never by the scene
    // settling: the enactment models the story, the mouth answers it.
    expect(runnerState.gestureCues).toHaveLength(0);
  });
});

// ── The tutor owns the STIMULUS clock (ten-frame drives 3 and 5) ───────────

describe('the change group arrives on the tutor’s voice', () => {
  /**
   * ⚠️ THE GATE MOVED (19c). This block used to own the TIMING rules too —
   * falling edge on her voice, `cuedItemId`, the 12s silence fallback and the
   * re-render-churn invariant. All of them are `useJudgedScriptRunner`'s now and
   * are driven against the REAL hook in `hooks/useJudgedScriptRunner.test.tsx`
   * ("the stimulus clock"); asserting them here would only assert this file's
   * mock. What stays: WHICH items hold their change group back, and what the
   * scene does when the runner says present.
   */
  const joinStory = (ids = ['c1']) => data('1', ids.map((id) => ch({
    id, startCount: 2, changeCount: 1, resultCount: 3,
  })), { groupedReveal: true });

  it('shows only the start group until the runner presents the join', () => {
    vi.useFakeTimers();
    mount(joinStory());
    openItem();

    // However long the item has been on screen, the ducks do not arrive on a
    // clock — the decision is not made here.
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(sceneObjects()).toHaveLength(2);

    presentStimulus();
    expect(sceneObjects()).toHaveLength(3);
  });

  /**
   * The `when` predicate is the port's half of the gate, and it is the half a
   * second copy gets wrong: a reveal that waits for a voice which will never
   * mention it is a scene that never completes.
   */
  it('holds nothing back where there is nothing to withhold', () => {
    vi.useFakeTimers();
    // groupedReveal withdrawn (hard tier) means "everything at once" by design.
    mount(data('1', [ch({ startCount: 2, changeCount: 1, resultCount: 3 })], { groupedReveal: false }));
    openItem();
    expect(sceneObjects()).toHaveLength(3);
  });

  it('holds nothing back on an ENACTED scene, which the child builds herself', () => {
    vi.useFakeTimers();
    mount(data('K', [ch({ startCount: 2, changeCount: 1, resultCount: 3 })], { groupedReveal: true }));
    const item = openItem();
    expect(item.answerKind).toBe('gesture');
    expect(sceneObjects()).toHaveLength(2);   // seeded start group, hers to add to
  });
});

// ── R8: the ten frame mirrors the SCREEN, never a stored count ─────────────

describe('the ten frame aid', () => {
  it('mirrors what is visible, so it cannot fill to the total early', () => {
    vi.useFakeTimers();
    mount(data('1', [ch({ startCount: 2, changeCount: 1, resultCount: 3 })], {
      showTenFrame: true, groupedReveal: true,
    }));
    openItem();

    const filled = () => document.querySelectorAll('.bg-amber-400\\/60').length;
    expect(filled()).toBe(2);

    presentStimulus();
    expect(filled()).toBe(3);
  });

  it('mirrors the enacted scene on a hands item, never the target', () => {
    render(<AdditionSubtractionScene
      data={data('K', [ch({ startCount: 2, changeCount: 1, resultCount: 3 })], { showTenFrame: true })}
    />);
    openItem();
    expect(document.querySelectorAll('.bg-amber-400\\/60')).toHaveLength(2);
  });
});

// ── build-equation: the tray closes itself, and never on correctness ───────

describe('build-equation', () => {
  const equationData = () => data('1', [ch({
    type: 'build-equation', objectType: 'apples', scene: 'kitchen',
    storyText: '4 apples are on the table. 2 more apples are placed on the table.',
    startCount: 4, changeCount: 2, resultCount: 6, equation: '4 + 2 = 6',
  })]);

  const tapTiles = (tiles: string[]) => {
    for (const tile of tiles) {
      const buttons = Array.from(document.querySelectorAll('button'))
        .filter((b) => b.textContent?.trim() === tile);
      fireEvent.click(buttons[buttons.length - 1]);
    }
  };

  it('offers no Check control — a finished sentence commits itself', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={equationData()} />);
    openItem();

    expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
    tapTiles(['4', '+', '2', '=', '6']);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(runnerState.gestureCues[0]).toContain('MATCHES');
  });

  // The structural close is a SHAPE check, never a correctness check.
  it('commits a finished sentence that is WRONG just as readily', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={equationData()} />);
    openItem();

    tapTiles(['4', '+', '2', '=', '9']);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(runnerState.gestureCues[0]).toContain('does NOT match');
    expect(runnerState.gestureCues[0]).toContain('those numbers do not make that total');
  });

  it('waits longer while the sentence is still unfinished, then commits it', () => {
    vi.useFakeTimers();
    render(<AdditionSubtractionScene data={equationData()} />);
    openItem();

    tapTiles(['4', '+']);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(runnerState.gestureCues).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(3100); });
    expect(runnerState.gestureCues[0]).toContain('a number sentence needs two numbers');
  });
});

// ── Answer-leak: nothing names the answer before the tutor affirms ─────────

describe('answer leak', () => {
  it('prints the situation but never the generated question or instruction', () => {
    render(<AdditionSubtractionScene data={data('1', [ch({
      type: 'solve-story',
      instruction: 'Type the answer in the box.',
      storyText: '5 bunnies are in the garden. 2 hop away. How many bunnies are left?',
      operation: 'subtraction', startCount: 5, changeCount: 2, resultCount: 3,
    })])} />);
    openItem();

    expect(screen.getByText('5 bunnies are in the garden. 2 hop away.')).toBeTruthy();
    expect(screen.queryByText(/How many bunnies are left\?/)).toBeNull();
    expect(screen.queryByText(/Type the answer in the box\./)).toBeNull();
  });

  it('shows the number sentence only after the tutor has affirmed', () => {
    const { repaint } = mount(data('1', [ch({
      type: 'solve-story', operation: 'subtraction',
      storyText: '5 bunnies are in the garden. 2 hop away.',
      startCount: 5, changeCount: 2, resultCount: 3, equation: '5 - 2 = 3',
    })]));
    const item = openItem();

    expect(screen.queryByText('5 - 2 = 3')).toBeNull();

    act(() => runnerState.options!.onAffirmed?.(item));
    runnerState.solved = new Set([item.id]);
    runnerState.revealHeld = true;
    repaint();
    expect(screen.getByText('5 - 2 = 3')).toBeTruthy();

    // 18b: it HOLDS while the next item is already on screen and unsolved —
    // that is the whole advance path, and where a `currentSolved` gate showed
    // nothing at all. It ends when her cue for the next item is sent.
    openItem(0);
    expect(screen.getByText('5 - 2 = 3')).toBeTruthy();
    runnerState.revealHeld = false;
    repaint();
    expect(screen.queryByText('5 - 2 = 3')).toBeNull();
  });
});
