// @vitest-environment jsdom
/**
 * Angle workshop on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { AngleWorkshopChallenge } from './AngleWorkshop';
import { angleWorkshopHarnessInputs, makeAngleMiss, makeAngleAsk } from './angleWorkshopWorkspace';
import { openingAt } from './AngleBuildScene';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const base = { narration: 'A door swings open.', hint: 'Look at the figure.', tolerance: 2 };
const measure: AngleWorkshopChallenge = { ...base, id: 'm1', type: 'measure', instruction: 'Place the protractor and read the angle.',
  answerKind: 'degrees', angleMeasure: 65, expectedAnswer: 65 };
const classify: AngleWorkshopChallenge = { ...base, id: 'c1', type: 'classify_pairs', instruction: 'What is the relationship?',
  answerKind: 'relationship', relationship: 'supplementary', splitAngle: 70, expectedRelationship: 'supplementary', expectedAnswer: 0 };
const solve: AngleWorkshopChallenge = { ...base, id: 's1', type: 'solve_unknown', instruction: 'Find x.', answerKind: 'degrees',
  solveConfig: 'supplementary', knownAngle: 50, expectedAnswer: 130 };
const algebra: AngleWorkshopChallenge = { ...base, id: 'a1', type: 'solve_algebraic', instruction: 'Solve for x.', answerKind: 'x_value',
  algConfig: 'supplementary', a1: 2, b1: 10, a2: 1, b2: 20, expectedAnswer: 50, tolerance: 0.01 };
const transversal: AngleWorkshopChallenge = { ...base, id: 't1', type: 'transversal', instruction: 'Find x.', answerKind: 'degrees',
  transversalShape: 'parallel_transversal', transRelation: 'co_interior', givenAngle: 70, expectedAnswer: 110 };
const make = (id: string, kind: AngleWorkshopChallenge['targetKind'], min?: number, max?: number): AngleWorkshopChallenge => ({
  id, type: 'make_angle', narration: 'A gate swings open.', hint: 'Turn the ray.', answerKind: 'build', instruction: makeAngleAsk(kind!, min, max),
  targetKind: kind, ...(kind === 'range' ? { targetMin: min, targetMax: max } : {}), expectedAnswer: 0, tolerance: 0 });
const obtuse = make('b1', 'obtuse');

const BY_MODE: Record<string, AngleWorkshopChallenge> = {
  measure, classify_pairs: classify, solve_unknown: solve, solve_algebraic: algebra, transversal, make_angle: obtuse,
};
const lesson = (challenges: AngleWorkshopChallenge[], gradeBand: '4' | '7' = '7') => ({ title: 'Angles', description: '', challengeType: challenges[0].type, gradeBand, challenges });

type Mounted = ReturnType<typeof mountWorkspace>;
const perform = (h: Mounted, c: AngleWorkshopChallenge, wrong: boolean) => {
  for (const input of angleWorkshopHarnessInputs(c, wrong, h.state().task!.demand as Record<string, unknown>)) {
    if (input.type === 'choose') h.press(input.label);
    else if (input.type === 'check') h.press('Check');
    else act(() => { fireEvent.change(h.view.container.querySelector(`input[aria-label="${input.label}"]`)!, { target: { value: input.text } }); });
  }
};
const demand = (h: Mounted) => h.state().task!.demand as Record<string, unknown>;
const lastMiss = (h: Mounted) => h.state().task!.workspace!.attempts.at(-1)?.miss;
const press = (h: Mounted, label: string, times = 1) => { for (let i = 0; i < times; i++) h.press(label); };

it('every catalog mode binds', () => {
  const modes = (getComponentById('angle-workshop')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(BY_MODE).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'angle-workshop', pin: mode, objectiveIds: ['o'],
      data: lesson([BY_MODE[mode]]) }), mode).not.toBeNull();
  }
});

it.each(Object.entries(BY_MODE))('%s: a checked gesture that publishes no key; a miss reopens on Try again, the right answer completes once',
  async (mode, c) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: mode, data: lesson([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    const published = JSON.stringify(task);
    for (const key of ['expectedAnswer', 'expectedRelationship', 'angleMeasure', 'targetKind']) expect(published).not.toContain(key);
    if (c.type === 'measure') expect(published).not.toMatch(/\b65\b/);
    if (c.type === 'classify_pairs') expect(published).not.toMatch(/"supplementary"|is supplementary/);

    perform(h, c, true);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.dispatch('retry');
    expect(h.state().task!.phase).toBe('working');
    perform(h, c, false);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

describe('make_angle judge: boundaries and tolerance', () => {
  const cases: Array<[AngleWorkshopChallenge, Array<[number, string | undefined]>]> = [
    [make('r', 'right'), [[86, 'made_acute'], [87, undefined], [90, undefined], [93, undefined], [94, 'made_obtuse']]],
    [make('a', 'acute'), [[4, 'not_opened'], [5, undefined], [86, undefined], [87, 'made_right'], [120, 'made_obtuse']]],
    [make('o', 'obtuse'), [[86, 'made_acute'], [93, 'made_right'], [94, undefined], [176, undefined], [177, 'made_straight']]],
    [make('s', 'straight'), [[176, 'made_obtuse'], [177, undefined], [180, undefined], [90, 'made_right']]],
    [make('d', 'between_right_straight'), [[93, 'made_right'], [94, undefined], [176, undefined], [177, 'made_straight']]],
    [make('g', 'bigger_than_right'), [[93, 'made_right'], [94, undefined], [180, undefined]]],
    [make('l', 'smaller_than_right'), [[0, 'not_opened'], [45, undefined], [87, 'made_right']]],
    [make('n', 'range', 40, 60), [[39, 'below_range'], [40, undefined], [60, undefined], [61, 'above_range'], [2, 'not_opened']]],
  ];
  it.each(cases)('%s', (c, openings) => {
    for (const [deg, miss] of openings) expect(makeAngleMiss(c, deg), `${c.targetKind} at ${deg}`).toBe(miss);
  });

  it('a drag position becomes the opening, pinned to 0..180 below the fixed ray', () => {
    expect(openingAt(280 + 100, 300)).toBe(0);
    expect(openingAt(280, 300 - 100)).toBe(90);
    expect(openingAt(280 - 100, 300)).toBe(180);
    expect(openingAt(280 + 100, 300 + 10)).toBe(0);
    expect(openingAt(280 - 100, 300 + 10)).toBe(180);
  });
});

it('make_angle: the scene publishes the opening as a number, never the kind; workHistory records a turn back; Try again keeps the build', () => {
  const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: 'make_angle', data: lesson([obtuse], '4') });
  expect(demand(h)).toMatchObject({ kind: 'make_angle', openingDegrees: 0 });
  press(h, 'Open wider', 9);
  press(h, 'Close in', 3);
  expect(demand(h)).toMatchObject({ openingDegrees: 30, learnerWork: 'Opened the angle to 30°' });
  expect(String(demand(h).workHistory)).toBe('openingDegrees 0 → 45 → 30');
  // The facts name no kind of angle; the screen writes no degrees.
  expect(JSON.stringify(demand(h))).not.toMatch(/\b(acute|obtuse|right angle|straight angle)\b/i);
  expect(h.view.container.textContent).not.toMatch(/\d+°/);
  press(h, "I'm done!");
  expect(lastMiss(h)).toBe('made_acute');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ response: 'Opened the angle to 30°', correct: false });
  // The verdict's words name neither the kind made nor its degrees.
  expect(h.view.container.textContent).toMatch(/not the angle asked for/);
  expect(h.view.container.textContent).not.toMatch(/\bacute\b|30°/i);
  // Closed until Try again; then the build and the verdict stay to revise.
  expect((Array.from(h.view.container.querySelectorAll('button')).find(b => b.textContent === 'Open wider'))!.disabled).toBe(true);
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ openingDegrees: 30 });
  expect(h.view.container.textContent).toMatch(/not the angle asked for/);
  press(h, 'Open wider', 18); // 120
  press(h, "I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('make_angle: not opened, then each side of a range', () => {
  const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: 'make_angle', data: lesson([make('n', 'range', 40, 60)]) });
  const attempt = (steps: number, miss: string) => {
    press(h, 'Start over'); press(h, 'Open wider', steps); press(h, "I'm done!");
    expect(lastMiss(h), `${steps * 5}`).toBe(miss);
    h.dispatch('retry');
  };
  attempt(0, 'not_opened');
  attempt(7, 'below_range');
  attempt(13, 'above_range');
  press(h, 'Start over'); press(h, 'Open wider', 10); press(h, "I'm done!");
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('make_angle: levers start bare; the corner and the protractor draw on the scene; simplify opens a coarser practice ask', () => {
  const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: 'make_angle', data: lesson([obtuse], '4') });
  const levers = () => h.state().task!.workspace!.levers ?? [];
  expect(levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['corner_marker', 'help', false], ['protractor', 'help', false], ['coarser_class', 'simplify', false]]);
  expect(h.view.container.querySelectorAll('[data-lever]')).toHaveLength(0);
  press(h, 'Open wider', 6); press(h, "I'm done!");
  expect(h.dispatch('pull_lever', { lever: 'corner_marker' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="corner-marker"]')).toHaveLength(1);
  expect(demand(h)).toMatchObject({ onScreen: expect.stringMatching(/square corner/) });
  expect(h.dispatch('pull_lever', { lever: 'protractor' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="protractor"]')).toHaveLength(1);
  expect(h.dispatch('pull_lever', { lever: 'coarser_class' }).status).toBe('committed');
  // The practice ask: one side of a right angle only, on an empty scene, without the session's aids.
  expect(h.view.container.textContent).toMatch(/bigger than a right angle\./);
  expect(demand(h)).toMatchObject({ openingDegrees: 0 });
  expect(h.view.container.querySelectorAll('[data-lever]')).toHaveLength(0);
  press(h, 'Open wider', 36); press(h, "I'm done!"); // 180 passes "bigger than a right angle"
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
});

it('make_angle: a right-angle ask has no coarser side; a range below 90 coarsens to smaller than a right angle', () => {
  const right = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: 'make_angle', data: lesson([make('r', 'right')]) });
  expect((right.state().task!.workspace!.levers ?? []).map(l => l.id)).toEqual(['corner_marker', 'protractor']);
  cleanup();
  const h = mountWorkspace({ primitiveId: 'angle-workshop', evalMode: 'make_angle', data: lesson([make('n', 'range', 40, 60)]) });
  press(h, 'Open wider', 2); press(h, "I'm done!");
  expect(h.dispatch('pull_lever', { lever: 'coarser_class' }).status).toBe('committed');
  expect(h.view.container.textContent).toMatch(/smaller than a right angle\./);
});

it('the adapter refuses a challenge its controls cannot answer', () => {
  const adapter = LIVE_ADAPTERS['angle-workshop'];
  expect(adapter.validate(lesson([obtuse]))).toBeTruthy();
  expect(() => adapter.validate(lesson([make('x', 'range', 60, 40)]))).toThrow();
  expect(() => adapter.validate(lesson([{ ...obtuse, targetKind: undefined }]))).toThrow();
  expect(() => adapter.validate(lesson([{ ...classify, expectedRelationship: 'vertical' }]))).toThrow();
  expect(() => adapter.validate(lesson([{ ...measure, tolerance: 0 }]))).toThrow();
});
