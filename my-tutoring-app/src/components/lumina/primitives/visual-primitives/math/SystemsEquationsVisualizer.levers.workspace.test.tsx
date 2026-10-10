// @vitest-environment jsdom
/**
 * systems-equations-visualizer levers on the teaching workspace: a pull changes the screen and the scene in one commit,
 * the next attempt records it, a pull with nothing to show is refused, no help lever puts the key on screen, and the
 * simpler system is ungraded practice with the full item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { SystemsEquationsChallenge, SystemsEquationsVisualizerData } from './SystemsEquationsVisualizer';
import type { SolutionPoint } from './systemsEquationsWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
function enter(h: WorkspaceHarness, p: SolutionPoint) {
  const box = (label: string) => h.view.container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  act(() => { fireEvent.change(box('x'), { target: { value: String(p.x) } }); });
  act(() => { fireEvent.change(box('y'), { target: { value: String(p.y) } }); });
  act(() => { fireEvent.click(q(h, 'button').find(b => /check/i.test(b.textContent ?? ''))!); });
}

const slope = (m: number, b: number, display: string) => ({ display, slope: m, yIntercept: b });
const graph: SystemsEquationsChallenge = { id: 'g1', type: 'graph', systemForm: 'slope-intercept', showAxisLabels: false,
  equationA: slope(2, 1, 'y = 2x + 1'), equationB: slope(-1, 4, 'y = -x + 4'), expectedX: 1, expectedY: 3,
  instruction: 'Find the intersection point and enter (x, y).', hint: '' };
const substitution: SystemsEquationsChallenge = { id: 's1', type: 'substitution', systemForm: 'slope-intercept',
  equationA: slope(2, 1, 'y = 2x + 1'), equationB: slope(-3, 11, 'y = -3x + 11'), expectedX: 2, expectedY: 5,
  instruction: 'Set them equal, solve for x, then find y. Enter (x, y).', hint: '' };
const elimination: SystemsEquationsChallenge = { id: 'e1', type: 'elimination', systemForm: 'standard',
  equationA: { display: '2x + 3y = 12', slope: -2 / 3, yIntercept: 4, a: 2, b: 3, c: 12 },
  equationB: { display: 'x - y = 1', slope: 1, yIntercept: -1, a: 1, b: -1, c: 1 }, expectedX: 3, expectedY: 2,
  instruction: 'Use elimination, then enter (x, y).', hint: '' };
const lesson = (c: SystemsEquationsChallenge): SystemsEquationsVisualizerData => ({ title: 'Systems', description: '',
  xRange: [-10, 10], yRange: [-10, 10], challenges: [c] });
const mount = (c: SystemsEquationsChallenge) => {
  const h = mountWorkspace({ primitiveId: 'systems-equations-visualizer', evalMode: c.type, data: lesson(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};

it('graph: the axis guide draws in the same commit; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount(graph);
  expect(levers(h)).toEqual([['axis_guide', false], ['every_line', false], ['check_both', false], ['method_steps', false],
    ['worked_example', false], ['simpler_item', false]]);
  enter(h, { x: 3, y: 1 });
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'swapped' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'swapped')).toBe('axis_guide');
  const receipt = h.dispatch('pull_lever', { lever: 'axis_guide' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/x across first/);
  expect(q(h, '[data-lever="axis-guide"]')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'axis_guide' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  enter(h, { x: 1, y: 3 });
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'g1', correct: true, levers: ['axis_guide'] });
});

it('check_both with no checked pair yet is refused and changes nothing; after a miss it marks each equation', () => {
  const h = mount(substitution);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'check_both' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  // (3, 2): on y = -3x + 11, not on y = 2x + 1.
  enter(h, { x: 3, y: 2 });
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'one_line_only' });
  expect(h.dispatch('pull_lever', { lever: 'check_both' }).status).toBe('committed');
  h.dispatch('retry');
  expect(q(h, '[data-lever="check-both"] li').map(li => li.textContent)).toEqual([
    '(3, 2) in y = 2x + 1: does not work ✗', '(3, 2) in y = -3x + 11: works ✓']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/\(3, 2\) in line A \(y = 2x \+ 1\): does not work; \(3, 2\) in line B \(y = -3x \+ 11\): works/);
});

/** Visible text, one node per word boundary. */
const screen = (h: WorkspaceHarness) => {
  const walker = document.createTreeWalker(h.view.container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ');
};

it.each([
  // The pair, or a stated "x = <key x>" (not the "2x = 2" of a worked example's own step).
  [graph, { x: 3, y: 1 }, /\(\s*1\s*,\s*3\s*\)|(?<![\w.])x = 1\b/],
  [substitution, { x: 5, y: 2 }, /\(\s*2\s*,\s*5\s*\)|(?<![\w.])x = 2\b/],
  [elimination, { x: 2, y: 3 }, /\(\s*3\s*,\s*2\s*\)|(?<![\w.])x = 3\b/],
] as const)('$id: every help lever draws without the key', (c, wrong, key) => {
  const h = mount(c);
  enter(h, wrong);
  for (const l of h.state().task!.workspace!.levers!.filter(x => x.kind === 'help'))
    expect(h.dispatch('pull_lever', { lever: l.id }).status, `${c.id} ${l.id}`).toBe('committed');
  h.dispatch('retry');
  expect(screen(h), c.id).not.toMatch(key);
  expect(JSON.stringify(h.state().task!.demand), c.id).not.toMatch(key);
});

it('the levers draw what they say', () => {
  const s = mount(substitution);
  enter(s, { x: 5, y: 2 });
  expect(s.dispatch('pull_lever', { lever: 'set_equal' }).status).toBe('committed');
  expect(q(s, '[data-lever="set-equal"]')[0].textContent).toBe('Set the right-hand sides equal: 2x + 1 = -3x + 11');
  expect(s.dispatch('pull_lever', { lever: 'worked_example' }).status).toBe('committed');
  expect(q(s, '[data-lever="worked-example"] li').map(li => li.textContent)[1]).toMatch(/^Set equal: /);
  cleanup();
  const e = mount(elimination);
  enter(e, { x: 2, y: 3 });
  expect(e.dispatch('pull_lever', { lever: 'line_up' }).status).toBe('committed');
  expect(q(e, '[data-lever="line-up"] td').map(td => td.textContent)).toEqual(['A', '2', '3', '12', 'B', '1', '-1', '1']);
  expect(q(e, '[data-lever="line-up"] p')[0].textContent).toMatch(/no column cancels yet/);
  cleanup();
  const g = mount(graph);
  enter(g, { x: 3, y: 1 });
  expect(g.dispatch('pull_lever', { lever: 'worked_example' }).status).toBe('committed');
  expect(q(g, '[data-lever="worked-example"] circle')).toHaveLength(1);
  expect(q(g, '[data-lever="worked-example"] p')[0].textContent).toMatch(/cross at \(/);
});

it('the simpler system is ungraded practice of the same kind; the full item comes back blank and is credited after', () => {
  const h = mount(elimination);
  enter(h, { x: 2, y: 3 });
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'swapped' });
  const r = h.dispatch('pull_lever', { lever: 'simpler_item' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('e1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'e1' });
  expect(r.state.task!.task).toMatch(/^Practice first: add the equations/);
  expect(r.state.task!.demand).toMatchObject({ learnerWork: 'nothing entered yet', equations: 'line A: x + y = 3; line B: x - y = -1' });
  enter(h, { x: 1, y: 2 });
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('e1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'nothing entered yet', equations: 'line A: 2x + 3y = 12; line B: x - y = 1' });
  enter(h, { x: 3, y: 2 });
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['e1', false, false], ['e1~simpler', true, true], ['e1', true, false]]);
});
