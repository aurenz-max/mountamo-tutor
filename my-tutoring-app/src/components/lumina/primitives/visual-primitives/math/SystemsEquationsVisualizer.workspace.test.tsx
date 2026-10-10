// @vitest-environment jsdom
/**
 * Systems of equations on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { SystemsEquationsChallenge, SystemsEquationsVisualizerData } from './SystemsEquationsVisualizer';
import { SYSTEMS_MISSES_BY_MODE, systemsHarnessPoint, systemsMiss, type SolutionPoint } from './systemsEquationsWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

/** Type the pair into the x and y boxes, then press Check, as the journey row does. */
export function enterPair(h: WorkspaceHarness, p: SolutionPoint) {
  const box = (label: string) => h.view.container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  act(() => { fireEvent.change(box('x'), { target: { value: String(p.x) } }); });
  act(() => { fireEvent.change(box('y'), { target: { value: String(p.y) } }); });
  const check = Array.from(h.view.container.querySelectorAll('button')).find(b => /check/i.test(b.textContent ?? ''));
  expect(check, 'Check').toBeTruthy();
  act(() => { fireEvent.click(check!); });
}

const slope = (m: number, b: number, display: string) => ({ display, slope: m, yIntercept: b });
const graph: SystemsEquationsChallenge = { id: 'g1', type: 'graph', systemForm: 'slope-intercept',
  equationA: slope(2, 1, 'y = 2x + 1'), equationB: slope(-1, 4, 'y = -x + 4'), expectedX: 1, expectedY: 3,
  instruction: 'Look at the two lines on the graph. Find the intersection point and enter (x, y).', hint: 'Trace each line.' };
const substitution: SystemsEquationsChallenge = { id: 's1', type: 'substitution', systemForm: 'slope-intercept',
  equationA: slope(1, 2, 'y = x + 2'), equationB: slope(-2, 5, 'y = -2x + 5'), expectedX: 1, expectedY: 3,
  instruction: 'Both equations are solved for y. Set them equal, solve for x, then find y. Enter (x, y).', hint: 'Set them equal.' };
const elimination: SystemsEquationsChallenge = { id: 'e1', type: 'elimination', systemForm: 'standard',
  equationA: { display: '2x + y = 5', slope: -2, yIntercept: 5, a: 2, b: 1, c: 5 },
  equationB: { display: 'x - y = 1', slope: 1, yIntercept: -1, a: 1, b: -1, c: 1 }, expectedX: 2, expectedY: 1,
  instruction: 'Use elimination — add or scale equations so one variable cancels. Then solve and enter (x, y).', hint: 'Add them.' };
const lesson = (challenges: SystemsEquationsChallenge[]): SystemsEquationsVisualizerData => ({
  title: 'Systems of equations', description: 'Find the one point on both lines.', xRange: [-10, 10], yRange: [-10, 10], challenges });

type Case = { mode: string; item: SystemsEquationsChallenge; wrong: SolutionPoint; miss: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'graph', item: graph, wrong: { x: 3, y: 1 }, miss: 'swapped', secret: /\(1, ?3\)|x = 1, y = 3/ },
  { mode: 'substitution', item: substitution, wrong: { x: 1, y: 6 }, miss: 'x_only', secret: /\(1, ?3\)|x = 1, y = 3/ },
  { mode: 'elimination', item: elimination, wrong: { x: 0, y: 5 }, miss: 'one_line_only', secret: /\(2, ?1\)|x = 2, y = 1/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('systems-equations-visualizer')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(SYSTEMS_MISSES_BY_MODE);
  for (const { mode, item } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'systems-equations-visualizer', pin: mode, objectiveIds: ['o'],
      data: lesson([item]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong pair names its miss and Try again clears it; the right one completes once',
  async ({ mode, item, wrong, miss, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'systems-equations-visualizer', evalMode: mode, data: lesson([item]) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    // The key never reaches the packet: not the pair, nor the hint or the expected fields.
    expect(JSON.stringify(h.state().task)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedX|expectedY|"hint"|Trace each line|answer is \(/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // Next, the hint and Peek are not the learner's here; the algebra modes keep the graph hidden.
    expect(h.view.container.textContent).not.toMatch(/Next System|Show hint|Peek/);
    if (mode !== 'graph') expect(h.state().task!.demand.graph).toBe('hidden until the answer is right');

    enterPair(h, wrong);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(h.view.container.textContent).not.toMatch(secret);
    // Closed until Try again: the boxes are disabled and a second check does not count.
    expect((h.view.container.querySelector('input[aria-label="x"]') as HTMLInputElement).disabled).toBe(true);
    expect(h.state().task!.workspace!.attempts).toHaveLength(1);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toBe('nothing entered yet');

    enterPair(h, { x: item.expectedX, y: item.expectedY });
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'systems-equations-visualizer', evalMode: 'graph', data: lesson([graph]) as unknown as Record<string, unknown> });
  enterPair(h, { x: 1, y: 3 });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('systemsMiss names the pattern the pair shows', () => {
  const at = (c: SystemsEquationsChallenge, x: number, y: number) => systemsMiss(c, { x, y });
  expect(at(graph, 1, 3)).toBeUndefined();
  expect(at(graph, 3, 1)).toBe('swapped');
  expect(at(graph, -1, -3)).toBe('both_signs');
  expect(at(graph, -1, 3)).toBe('x_sign');
  expect(at(graph, 1, -3)).toBe('y_sign');
  expect(at(graph, 0, 4)).toBe('intercept_point');
  expect(at(graph, 2, 5)).toBe('one_line_only');
  expect(at(graph, 2, 3)).toBe('off_by_one');
  expect(at(graph, 1, 7)).toBe('x_only');
  expect(at(graph, 5, 3)).toBe('y_only');
  expect(at(graph, 7, -7)).toBe('wrong_point');
  // Elimination prints no b, so (0, b) is only a point on one line there.
  expect(at(elimination, 0, 5)).toBe('one_line_only');
  for (const c of [graph, substitution, elimination]) {
    const m = systemsMiss(c, systemsHarnessPoint(c, 'wrong'));
    expect(m && SYSTEMS_MISSES_BY_MODE[c.type].includes(m) && m !== 'wrong_point', c.id).toBe(true);
  }
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['systems-equations-visualizer'].validate;
  expect(() => validate(lesson([{ ...graph, expectedY: 4 }]))).toThrow();
  expect(() => validate(lesson([{ ...graph, equationB: slope(2, 4, 'y = 2x + 4') }]))).toThrow();
  expect(() => validate(lesson([{ ...graph, instruction: '' }]))).toThrow();
  expect(validate(lesson([graph, substitution, elimination]))).toBeTruthy();
});
