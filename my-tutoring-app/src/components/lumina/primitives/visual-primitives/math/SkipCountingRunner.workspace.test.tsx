// @vitest-environment jsdom
/**
 * Skip counting runner on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import SkipCountingRunner, { type SkipCountingChallenge, type SkipCountingRunnerData } from './SkipCountingRunner';
import { skipMiss } from './skipCountingWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const base = { hint: 'Count by 5s: 20 comes next.', narration: '' };
const runner = (challenges: SkipCountingChallenge[], extra: Partial<SkipCountingRunnerData> = {}): SkipCountingRunnerData => ({
  title: 'Hops', skipValue: 5, startFrom: 0, endAt: 30, direction: 'forward', character: { type: 'frog' }, challenges,
  gradeBand: '1-2', ...extra,
});

/** One learner move: tap a tick, type into a box, or press a button. */
type Move = { tap: number } | { type: string } | { press: string };
const BOX: Record<string, string> = { predict: 'Next landing', fill_missing: 'Missing number', find_skip_value: 'Skip value',
  connect_multiplication: 'Number of jumps' };
function play(h: WorkspaceHarness, c: SkipCountingChallenge, moves: Move[]) {
  for (const m of moves) {
    if ('tap' in m) h.touch(`tick-${m.tap}`);
    else if ('press' in m) h.press(m.press);
    else act(() => {
      const box = h.view.container.querySelector(`input[aria-label="${BOX[c.type]}"]`) as HTMLInputElement;
      expect(box, `no box for ${c.type}`).toBeTruthy();
      fireEvent.change(box, { target: { value: m.type } });
    });
  }
}
const check: Move = { press: 'Check Answer' };
const typed = (...values: string[]): Move[] => values.flatMap(v => [{ type: v }, check]);

type Case = { c: SkipCountingChallenge; wrong: Move[]; right: Move[]; miss: string; kept: string; secret: RegExp };
const CASES: Record<SkipCountingChallenge['type'], Case> = {
  count_along: {
    c: { ...base, id: 'a1', type: 'count_along', instruction: 'Tap each landing.', startPosition: 0 },
    // A right hop, then a tick two jumps on: the hop made is kept on Try again.
    wrong: [{ tap: 5 }, { tap: 15 }], right: [{ tap: 10 }, { tap: 15 }, { tap: 20 }, { tap: 25 }, { tap: 30 }, check],
    miss: 'skipped_a_landing', kept: 'Made 1 jump, landing on 5', secret: /^$/,
  },
  predict: {
    c: { ...base, id: 'p1', type: 'predict', instruction: 'Where does it land next?', startPosition: 15 },
    wrong: typed('16'), right: typed('20'), miss: 'added_one', kept: 'Nothing typed yet', secret: /\b20\b/,
  },
  fill_missing: {
    c: { ...base, id: 'f1', type: 'fill_missing', instruction: 'Type each missing number.', startPosition: 0, hiddenPositions: [10, 20] },
    // One gap filled, then a near miss: the filled gap stays on Try again.
    wrong: typed('10', '21'), right: typed('20'), miss: 'near_miss', kept: 'Filled 10', secret: /\b20\b|\b10\b/,
  },
  find_skip_value: {
    c: { ...base, id: 's1', type: 'find_skip_value', instruction: 'How far is each jump?', startPosition: 0 },
    wrong: typed('10'), right: typed('5'), miss: 'twice_the_step', kept: 'Nothing typed yet', secret: /\b5\b|by 5/,
  },
  connect_multiplication: {
    c: { ...base, id: 'm1', type: 'connect_multiplication', instruction: 'How many jumps to reach 20?', startPosition: 20, targetFact: '4 × 5 = 20' },
    wrong: typed('20'), right: typed('4'), miss: 'typed_product', kept: 'Nothing typed yet', secret: /\b4\b/,
  },
};

it('every catalog mode binds', () => {
  const modes = (getComponentById('skip-counting-runner')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(CASES).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'skip-counting-runner', pin: mode, objectiveIds: ['o'],
      data: runner([CASES[mode as SkipCountingChallenge['type']].c]) as never }), mode).not.toBeNull();
  }
});

it.each(Object.values(CASES))('$c.type: a checked gesture that publishes no key; a wrong check names its miss, Try again keeps the work made, the right one completes once',
  async ({ c, wrong, right, miss, kept, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: c.type, data: runner([c]) as never });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(JSON.stringify(task.demand)).not.toMatch(/hiddenPositions|targetFact|startPosition/);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/next challenge/i);

    play(h, c, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(JSON.stringify(h.state().task)).toContain(`"${miss}"`);
    // The generated hint (it can name the answer) is never shown on the workspace; the tutor helps.
    expect(h.view.container.textContent).not.toContain(base.hint);
    // Input is closed until Try again.
    expect(Array.from(h.view.container.querySelectorAll('input')).every(i => i.disabled)).toBe(true);
    const checkButton = Array.from(h.view.container.querySelectorAll('button')).find(b => /check answer/i.test(b.textContent ?? ''));
    if (checkButton) expect(checkButton.disabled).toBe(true);
    h.dispatch('retry');
    expect(h.state().task!.demand).toMatchObject({ learnerWork: kept });

    play(h, c, right);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: 'find_skip_value', data: runner([CASES.find_skip_value.c]) as never });
  play(h, CASES.find_skip_value.c, typed('5'));
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('nothing on screen names the answer: no number ahead on predict, no jump size on find, no jump count on connect', () => {
  const labels = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('svg text')).map(t => t.textContent);
  const p = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: 'predict', data: runner([CASES.predict.c]) as never });
  expect(labels(p)).toEqual(expect.arrayContaining(['0', '5', '10', '15']));
  expect(labels(p)).not.toContain('20');
  cleanup();
  // Easy find_skip_value turns every aid on; none of them may print the jump size.
  const f = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: 'find_skip_value', data: runner([CASES.find_skip_value.c], {
    supportTier: 'easy', showOptions: { showArray: true, showEquation: true, showDigitPattern: true, showSkipValueBadge: true } }) as never });
  f.press(/Jump!/); f.settle(500); f.press(/Jump!/); f.settle(500); f.press(/Jump!/);
  expect(f.view.container.textContent).not.toMatch(/Count by|\+5|rows of|Ones digits|× 5/);
  cleanup();
  const m = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: 'connect_multiplication', data: runner([CASES.connect_multiplication.c], {
    showOptions: { showArray: true, showEquation: true } }) as never });
  expect(m.view.container.textContent).not.toMatch(/4 rows|4 ×/);
  expect(m.view.container.textContent).toContain('× 5 = 20');
});

it('the tutor is told what is drawn: the line, where the character stands, the gaps and which aids are on screen', () => {
  const h = mountWorkspace({ primitiveId: 'skip-counting-runner', evalMode: 'fill_missing', data: runner([CASES.fill_missing.c]) as never });
  expect(h.state().task!.demand).toMatchObject({ line: expect.stringContaining('from 0 to 30'), at: 0,
    gaps: '2 numbers of the count hidden as "?"; 0 filled so far' });
  play(h, CASES.fill_missing.c, typed('20'));
  expect(h.state().task!.demand).toMatchObject({ filled: '20', learnerWork: 'Filled 20' });
  expect(h.state().task!.evidence.attemptNumber).toBe(0); // a gap filled with another open is not a check
});

it('the miss function names each pattern', () => {
  const line = { skipValue: 5, startFrom: 0, endAt: 30, direction: 'forward' as const };
  const at = (position: number, answer: number, filled: number[] = []) => ({ position, landings: [0], filled, answer });
  const predict = CASES.predict.c;
  expect([15, 16, 25, 10, 21, 3].map(a => skipMiss(predict, line, at(15, a))))
    .toEqual(['stayed_put', 'added_one', 'two_jumps', 'wrong_way', 'near_miss', 'off_count']);
  const fill = CASES.fill_missing.c;
  expect([5, 10, 11, 13].map(a => skipMiss(fill, line, at(0, a, a === 10 ? [10] : []))))
    .toEqual(['not_a_gap', 'already_filled', 'near_miss', 'off_count']);
  const find = CASES.find_skip_value.c;
  expect([10, 15, 4, 6, 2, 9].map(a => skipMiss(find, line, at(0, a))))
    .toEqual(['twice_the_step', 'typed_a_landing', 'one_short', 'one_over', 'short_by_more', 'over_by_more']);
  const connect = CASES.connect_multiplication.c;
  expect([20, 5, 3, 1, 9].map(a => skipMiss(connect, line, at(20, a))))
    .toEqual(['typed_product', 'typed_skip', 'one_short', 'short_by_more', 'over_by_more']);
  expect(skipMiss(CASES.count_along.c, line, at(5, 20))).toBe('jumped_far');
});

it('the scripted path (no runtime) keeps its own Next and submits once the last challenge is right', () => {
  seam.submit.mockClear();
  const view = render(<SkipCountingRunner data={runner([CASES.find_skip_value.c, CASES.predict.c])} />);
  const type = (label: string, value: string) => act(() => {
    fireEvent.change(view.container.querySelector(`input[aria-label="${label}"]`)!, { target: { value } });
  });
  const press = (re: RegExp) => act(() => {
    fireEvent.click(Array.from(view.container.querySelectorAll('button')).find(b => re.test(b.textContent ?? ''))!);
  });
  type('Skip value', '5'); press(/check answer/i);
  press(/next/i);
  type('Next landing', '20'); press(/check answer/i);
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('the adapter refuses a challenge its own check cannot read', () => {
  const v = LIVE_ADAPTERS['skip-counting-runner'].validate;
  expect(() => v(runner([{ ...CASES.fill_missing.c, hiddenPositions: [0, 7] }]))).toThrow();
  expect(() => v(runner([{ ...CASES.predict.c, startPosition: 30 }]))).toThrow();
  expect(() => v(runner([CASES.predict.c], { skipValue: 0 }))).toThrow();
  expect(v(runner(Object.values(CASES).map(x => x.c)))).toBeTruthy();
});
