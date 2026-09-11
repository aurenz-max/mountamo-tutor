// @vitest-environment jsdom
/**
 * DiWordProblemSetup STAGE behaviour under the judged loop — the hands half of
 * the family's first hands+voice math pack.
 *
 * The runner is mocked at the seam (it has its own suite); the pack has its
 * own pure suite (`diWordProblemScript.test.ts`). What is under test here is
 * the STAGE's gesture wiring and its scribe:
 *
 *   - tap-to-place and literal drag-and-drop both move story parts into roles;
 *   - the focused mode arms after one placement and family modes after three
 *     (neither commits on the placement itself);
 *   - the stillness commit hands the runner the `[WPS_BIG]` verdict cue naming
 *     what was placed, with the match computed in code;
 *   - a tap on the placed amount takes it back and CLEARS the window;
 *   - nothing marks which amount is the big number before the affirmation;
 *   - the affirmation locks the chip, hides the bank and draws the bar model;
 *   - the family slots stay empty until the family step is affirmed.
 *
 * Still NOT covered — jsdom is blind to it: the drag-and-drop path, the chip
 * hit targets under a finger, and the tutor's spoken verdict. Those are the
 * mic/eyes row on HUMAN-CHECKS.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { WordProblemItem } from './diWordProblemScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  running: true,
  revealHeld: false,
  stage: 'asking' as 'asking' | 'judging' | 'affirmed',
  armStillness: vi.fn(),
  clearStillness: vi.fn(),
  submitGestureAttempt: vi.fn(),
  options: null as null | {
    pack: { items: WordProblemItem[] };
    onFinished: (summary: unknown) => void;
    onAffirmed?: (item: WordProblemItem) => void;
    onItemOpened?: (item: WordProblemItem, index: number) => void;
    onCorrectionRetry?: (item: WordProblemItem, used: number) => void;
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
      solvedIds: new Set<string>(),
      currentSolved: false,
      canAttempt: runnerState.running && item != null && runnerState.stage !== 'judging',
      summary: null,
      micState: 'armed',
      tutorSpeaking: false,
      cuedItemId: item?.id ?? null,
      revealHeld: runnerState.revealHeld,
      armStillness: runnerState.armStillness,
      clearStillness: runnerState.clearStillness,
      cancelListening: undefined,
      start: vi.fn(),
      hearStimulus: vi.fn(),
      stimulusTapped: false,
      submitGestureAttempt: runnerState.submitGestureAttempt,
      isAwaitingGesture: () => runnerState.stage === 'judging',
      loop: {},
    };
  },
}));

vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: true, sendText: vi.fn() }),
}));

const submitResultSpy = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitResultSpy,
    hasSubmitted: false,
    submittedResult: null,
    resetAttempt: vi.fn(),
    elapsedMs: 1234,
  }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));
vi.mock('../../../components/JudgedMicPanel', () => ({
  default: () => <div data-testid="mic-panel" />,
}));

import DiWordProblemSetup, { type DiWordProblemSetupData } from './DiWordProblemSetup';
import { WORD_PROBLEM_BENCH_THEME } from '../../../service/qa/di/wordProblemBench';

// Jen has 12. Tom has 8 more than Jen. How many does Tom have? → Tom's is the
// big number (the box); Jen's 12 is "the biggest number I see".
const DATA: DiWordProblemSetupData = {
  title: 'Set Up the Story',
  description: 'Find the big number and say the family.',
  challengeType: 'build_family',
  problems: [
    { id: 'p1', frameId: 'comparison:more_person', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 8, challengeType: 'build_family' },
    { id: 'p2', frameId: 'change:loss_end', theme: WORD_PROBLEM_BENCH_THEME, first: 15, second: 6, challengeType: 'build_family' },
  ],
  gradeLevel: 'Grade 2',
  instanceId: 'stage-test',
};

const FIND_DATA: DiWordProblemSetupData = {
  ...DATA,
  challengeType: 'find_big_number',
  problems: DATA.problems.map((problem) => ({ ...problem, challengeType: 'find_big_number' })),
};

const storyPart = (label: string) => screen.getByRole('button', { name: `Select ${label}` });
const smallZones = () => screen.getAllByLabelText('small amount drop zone');
const bigZone = () => screen.getByLabelText('big amount drop zone');
const place = (label: string, zone: HTMLElement) => {
  fireEvent.click(storyPart(label));
  fireEvent.click(zone);
};
const buildCorrectFamily = () => {
  place("Jen's stickers", smallZones()[0]);
  place('how many more', smallZones()[1]);
  place("Tom's stickers", bigZone());
};
const buildWrongFamily = () => {
  place("Tom's stickers", smallZones()[0]);
  place('how many more', smallZones()[1]);
  place("Jen's stickers", bigZone());
};

beforeEach(() => {
  runnerState.index = 0;
  runnerState.running = true;
  runnerState.revealHeld = false;
  runnerState.stage = 'asking';
  runnerState.armStillness.mockReset();
  runnerState.clearStillness.mockReset();
  runnerState.submitGestureAttempt.mockReset();
  runnerState.options = null;
});
afterEach(cleanup);

describe('the family builder is honest page-work', () => {
  it('prints the story, three empty equation slots, and all three story parts', () => {
    render(<DiWordProblemSetup data={DATA} />);
    expect(screen.getByLabelText('The story').textContent).toBe(
      'Jen has 12 stickers. Tom has 8 more stickers than Jen. How many stickers does Tom have?',
    );
    const bank = screen.getByLabelText('Story parts');
    const chips = bank.querySelectorAll('button');
    expect(chips).toHaveLength(3);
    for (const chip of Array.from(chips)) {
      expect(chip.className).not.toMatch(/emerald|correct/);
      expect(chip.getAttribute('data-state')).toBeNull();
    }
    // The unknown shows "?", the known amounts show their story values.
    expect(storyPart("Tom's stickers").textContent).toContain('?');
    expect(storyPart("Jen's stickers").textContent).toContain('12');
    expect(smallZones()).toHaveLength(2);
    expect(bigZone().textContent).toContain('Drop a story part here');
    expect(screen.getByLabelText('Number family equation').textContent).toContain('+');
    expect(screen.getByLabelText('Number family equation').textContent).toContain('=');
    expect(screen.queryByLabelText('Bar model')).toBeNull();
    expect(screen.queryByTestId('mic-panel')).toBeNull();
  });

  it('keeps the lesson start control before the active hands turn begins', () => {
    runnerState.running = false;
    render(<DiWordProblemSetup data={DATA} />);
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });

  it('a tap places the amount at the arrowhead and ARMS stillness — it never commits on the tap', () => {
    render(<DiWordProblemSetup data={DATA} />);
    place("Jen's stickers", smallZones()[0]);
    expect(screen.getByRole('button', { name: "Jen's stickers, in the small1 slot" })).toBeTruthy();
    expect(screen.getByLabelText('Story parts').querySelectorAll('button')).toHaveLength(2);
    expect(runnerState.armStillness).not.toHaveBeenCalled();
    place('how many more', smallZones()[1]);
    expect(runnerState.armStillness).not.toHaveBeenCalled();
    place("Tom's stickers", bigZone());
    expect(runnerState.armStillness).toHaveBeenCalledTimes(1);
    expect(runnerState.submitGestureAttempt).not.toHaveBeenCalled();
    const [, ms] = runnerState.armStillness.mock.calls[0];
    expect(ms).toBe(1800);
  });

  it('supports the literal drag-and-drop path into an equation slot', () => {
    render(<DiWordProblemSetup data={DATA} />);
    let payload = '';
    const dataTransfer = {
      effectAllowed: 'none',
      setData: (_type: string, value: string) => { payload = value; },
      getData: () => payload,
    };
    const target = smallZones()[0];
    fireEvent.dragStart(storyPart("Jen's stickers"), { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(screen.getByRole('button', { name: "Jen's stickers, in the small1 slot" })).toBeTruthy();
    expect(runnerState.armStillness).not.toHaveBeenCalled();
  });

  it('the stillness commit hands the runner the verdict cue — the match is computed in code', () => {
    render(<DiWordProblemSetup data={DATA} />);
    buildWrongFamily();
    const [commit] = runnerState.armStillness.mock.calls[0] as [() => void, number];
    act(() => commit());
    expect(runnerState.submitGestureAttempt).toHaveBeenCalledTimes(1);
    const cue = runnerState.submitGestureAttempt.mock.calls[0][0] as string;
    expect(cue).toMatch(/^\[WPS_BIG\] The learner built the family with 'Jen's stickers' in the big-number slot; that does NOT match/);
    expect(cue).toContain('Say exactly: "My turn: the big number is the whole amount');
  });

  it('a right placement commits a MATCHES cue with the affirmation', () => {
    render(<DiWordProblemSetup data={DATA} />);
    buildCorrectFamily();
    const [commit] = runnerState.armStillness.mock.calls[0] as [() => void, number];
    act(() => commit());
    const cue = runnerState.submitGestureAttempt.mock.calls[0][0] as string;
    expect(cue).toContain("built the family with 'Tom's stickers' in the big-number slot; that MATCHES");
    expect(cue).toContain('Say exactly: "Yes, the big number is Tom\'s stickers');
  });

  it('tapping the placed amount takes it back and CLEARS the window — starting over is thinking', () => {
    render(<DiWordProblemSetup data={DATA} />);
    buildCorrectFamily();
    runnerState.clearStillness.mockClear();
    fireEvent.click(screen.getByRole('button', { name: "Jen's stickers, in the small1 slot" }));
    expect(runnerState.clearStillness).toHaveBeenCalledTimes(1);
    expect(runnerState.submitGestureAttempt).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Story parts').querySelectorAll('button')).toHaveLength(1);
    expect(storyPart("Jen's stickers")).toBeTruthy();
  });

  it('a correction retry clears the board so the child places again', () => {
    render(<DiWordProblemSetup data={DATA} />);
    buildWrongFamily();
    act(() => runnerState.options!.onCorrectionRetry!(runnerState.options!.pack.items[0], 1));
    expect(screen.getByLabelText('Story parts').querySelectorAll('button')).toHaveLength(3);
    expect(bigZone().textContent).toContain('Drop a story part here');
  });

  it('while a verdict is pending the board is dead', () => {
    runnerState.stage = 'judging';
    render(<DiWordProblemSetup data={DATA} />);
    fireEvent.click(storyPart("Tom's stickers"));
    fireEvent.click(bigZone());
    expect(runnerState.armStillness).not.toHaveBeenCalled();
  });
});

describe('the focused find-big-number mode', () => {
  it('shows one clear target and commits after one placement', () => {
    render(<DiWordProblemSetup data={FIND_DATA} />);
    expect(screen.getByLabelText('Big amount builder')).toBeTruthy();
    expect(screen.queryByLabelText('Number family equation')).toBeNull();
    expect(screen.queryAllByLabelText('small amount drop zone')).toHaveLength(0);
    expect(screen.getByText('Drag the story part that names the big amount into the big amount box.')).toBeTruthy();

    place("Tom's stickers", bigZone());
    expect(runnerState.armStillness).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('mic-panel')).toBeNull();
  });
});

describe('the scribe follows the affirmation', () => {
  it('the affirmation locks the complete equation, hides the bank, and draws the bar model', () => {
    const { rerender } = render(<DiWordProblemSetup data={DATA} />);
    const items = runnerState.options!.pack.items;
    act(() => {
      runnerState.options!.onAffirmed!(items[0]);
      runnerState.revealHeld = true;
      runnerState.stage = 'affirmed';
      runnerState.index = 1; // the runner opens the family step in the same dispatch
      runnerState.options!.onItemOpened!(items[1], 1);
    });
    rerender(<DiWordProblemSetup data={DATA} />);
    expect(screen.queryByLabelText('Story parts')).toBeNull();
    const zone = bigZone();
    expect(zone.textContent).toContain("Tom's stickers");
    expect(screen.getByLabelText('Bar model').textContent).toContain("Tom's stickers");
    // The family slots are still empty — the family has not been said.
    expect(screen.getByRole('button', { name: "Jen's stickers, in the small1 slot" }).textContent).toContain('12');
    expect(screen.getByRole('button', { name: 'how many more, in the small2 slot' }).textContent).toContain('8');
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
  });

  it('the family remains visible as the child moves from reading to choosing an operation', () => {
    const { rerender } = render(<DiWordProblemSetup data={DATA} />);
    const items = runnerState.options!.pack.items;
    act(() => {
      runnerState.options!.onAffirmed!(items[0]);
      runnerState.index = 1;
      runnerState.options!.onItemOpened!(items[1], 1);
    });
    rerender(<DiWordProblemSetup data={DATA} />);
    act(() => {
      runnerState.options!.onAffirmed!(items[1]);
      runnerState.index = 2;
      runnerState.options!.onItemOpened!(items[2], 2);
    });
    rerender(<DiWordProblemSetup data={DATA} />);
    expect(screen.getByRole('button', { name: "Jen's stickers, in the small1 slot" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'how many more, in the small2 slot' })).toBeTruthy();
    expect(bigZone().textContent).toContain('?');
    // No working line until the operation is said, and the box is still open.
    expect(screen.queryByLabelText('The working')).toBeNull();
    expect(screen.getByLabelText('Bar model').textContent).toContain('?');
  });

  it('a move-on carries the placement: the next step opens with the big number drawn, dimmer', () => {
    const { rerender } = render(<DiWordProblemSetup data={DATA} />);
    const items = runnerState.options!.pack.items;
    // The cap closed the placement with no affirmation; the runner opens the family step.
    act(() => {
      runnerState.index = 1;
      runnerState.options!.onItemOpened!(items[1], 1);
    });
    rerender(<DiWordProblemSetup data={DATA} />);
    const zone = bigZone();
    expect(zone.textContent).toContain("Tom's stickers");
    expect(zone.querySelector('button')!.className).toContain('opacity-70');
    expect(screen.queryByLabelText('Story parts')).toBeNull();
  });
});
