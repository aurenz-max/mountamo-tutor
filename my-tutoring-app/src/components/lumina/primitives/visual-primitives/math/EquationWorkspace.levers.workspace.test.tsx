// @vitest-environment jsdom
/**
 * equation-workspace levers on the teaching workspace: a pull changes the screen and the scene fact in the same
 * commit, the next attempt records it, a refused pull changes nothing, and the practice equation is ungraded with the
 * full item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { EquationWorkspaceChallenge, EquationWorkspaceData } from './EquationWorkspace';
import { fewerSteps } from './equationWorkspaceLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const op = (verb: string, k: string | number, label: string) => ({ id: `algebraic_${verb}${k === '' ? '' : `_${k}`}`, label, category: 'algebraic' as const });
const step = (o: { id: string; label: string }, resultLatex: string) => ({ operation: o.label, operationId: o.id, resultLatex });
const SUB15 = op('subtract', 15, 'Subtract 15 from both sides'), ADD15 = op('add', 15, 'Add 15 to both sides');
const DIV4 = op('divide', 4, 'Divide both sides by 4'), MUL4 = op('multiply', 4, 'Multiply both sides by 4');
const SUB47 = op('subtract', 47, 'Subtract 47 from both sides');
const item = (type: EquationWorkspaceChallenge['type'], extra: Partial<EquationWorkspaceChallenge> = {}): EquationWorkspaceChallenge => ({
  id: 'eq-1', type, instruction: 'Solve for x.', equation: '4 \\cdot x + 15 = 47', targetVariable: 'x',
  solutionSteps: [step(SUB15, '4 \\cdot x = 32'), step(DIV4, 'x = 8')], availableOperations: [ADD15, DIV4, SUB47, SUB15, MUL4],
  ...(type === 'identify-operation' ? { correctOperationId: SUB15.id } : {}), ...extra,
});
const lesson = (c: EquationWorkspaceChallenge): EquationWorkspaceData => ({ title: 'Equations', challenges: [c] });

const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const mount = (mode: string, c: EquationWorkspaceChallenge) => {
  const h = mountWorkspace({ primitiveId: 'equation-workspace', evalMode: mode, data: lesson(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};
/** The key on this item: the solved line, the line after step one, and the identify answer by itself. */
const KEY = /x = 8|\b32\b/;

it('solve: the marked sides draw in the same commit from the current line; the next attempt records the lever; a repeat pull changes nothing', () => {
  const h = mount('solve', item('solve'));
  expect(levers(h)).toEqual([['inverse_reminder', false], ['layer_order', false], ['sides_marked', false], ['worked_model', false], ['fewer_steps', false]]);
  h.press(SUB47.label);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'wrong_number' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_number')).toBe('sides_marked');
  const receipt = h.dispatch('pull_lever', { lever: 'sides_marked' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/variable's side \(4 × x \+ 15\) and the other side \(47\)/);
  expect(q(h, '[data-lever="sides-marked"]')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'sides_marked' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  h.press(SUB15.label);
  // The boxes follow the line on screen.
  expect(String(h.state().task!.demand.onScreen)).toMatch(/\(4 × x\) and the other side \(32\)/);
  h.press(DIV4.label);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'eq-1', correct: true, levers: ['sides_marked'] });
});

it.each(['guided-solve', 'identify-operation', 'solve'])('%s: every help lever draws without the key; the worked model is another equation', mode => {
  const h = mount(mode, item(mode as EquationWorkspaceChallenge['type'], { showNextStepHint: false }));
  h.press(ADD15.label);
  if (mode === 'identify-operation') h.press(/^check/i);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'not_inverse' });
  const screenBefore = h.view.container.textContent ?? '';
  for (const id of ['inverse_reminder', 'layer_order', 'sides_marked', 'worked_model']) expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  for (const sel of ['inverse-reminder', 'layer-order', 'sides-marked', 'worked-model']) expect(q(h, `[data-lever="${sel}"]`), sel).toHaveLength(1);
  expect(q(h, '[data-lever="inverse-reminder"]')[0].textContent).not.toMatch(/\d/);
  expect(q(h, '[data-lever="layer-order"]')[0].textContent).not.toMatch(/\d/);
  expect(q(h, '[data-lever="worked-model"]')[0].textContent).toMatch(/y/);
  expect(q(h, '[data-lever="worked-model"]')[0].textContent).not.toMatch(/\b(15|47|32|8|4)\b/);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(KEY);
  expect(h.view.container.textContent).not.toMatch(KEY);
  // The menu's labels are unchanged: the answer is still pressed by its own label.
  expect((h.view.container.textContent ?? '').split(SUB15.label).length).toBe(screenBefore.split(SUB15.label).length);
  h.dispatch('retry');
  h.press(SUB15.label);
  if (mode === 'identify-operation') h.press(/^check/i); else h.press(DIV4.label);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
});

it('the easy tier\'s reminder is a starting position: declared pulled, not recorded, and a pull is refused', () => {
  const h = mount('guided-solve', item('guided-solve', { showInverseReminder: true }));
  expect(levers(h)[0]).toEqual(['inverse_reminder', true]);
  expect(q(h, '[data-lever="inverse-reminder"]')).toHaveLength(1);
  expect(h.dispatch('pull_lever', { lever: 'inverse_reminder' }).status).toBe('blocked');
  h.press(SUB15.label); h.press(DIV4.label);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect((attempts(h).at(-1) as { levers?: string[] }).levers ?? []).toEqual([]);
});

it.each(['solve', 'identify-operation'])('%s: the practice equation is ungraded, one step shorter and shares no number; the full item comes back blank and is credited after', mode => {
  const c = item(mode as EquationWorkspaceChallenge['type']);
  const h = mount(mode, c);
  h.press(DIV4.label);
  if (mode === 'identify-operation') h.press(/^check/i);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'later_step' });
  const r = h.dispatch('pull_lever', { lever: 'fewer_steps' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('eq-1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'eq-1' });
  const p = fewerSteps(c)!;
  expect(h.state().task!.demand.equation).not.toMatch(/15|47/);
  h.press(p.solutionSteps[0].operation);
  if (mode === 'identify-operation') h.press(/^check/i);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('eq-1');
  expect(h.state().task!.demand.equation).toBe('4 × x + 15 = 47');
  if (mode === 'solve') expect(h.state().task!.demand.stepsApplied).toBe('none yet');
  h.press(SUB15.label);
  if (mode === 'identify-operation') h.press(/^check/i); else h.press(DIV4.label);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['eq-1', false, false], ['eq-1~simpler', true, true], ['eq-1', true, false]]);
});

it('a pull on an item with no model or practice is refused with a reason', () => {
  const DIST = op('distribute', 3, 'Distribute the 3');
  const multi = item('multi-step', { equation: '3(x + 2) = 21', solutionSteps: [step(DIST, '3x + 6 = 21'), step(op('subtract', 6, 'Subtract 6 from both sides'), '3x = 15'), step(op('divide', 3, 'Divide both sides by 3'), 'x = 5')],
    availableOperations: [DIST, op('subtract', 6, 'Subtract 6 from both sides'), op('divide', 3, 'Divide both sides by 3'), op('add', 6, 'Add 6 to both sides')] });
  const h = mount('multi-step', multi);
  expect(levers(h).map(([id]) => id)).toEqual(['inverse_reminder', 'layer_order', 'sides_marked']);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'fewer_steps' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'layer_order' }).status).toBe('committed');
  expect(q(h, '[data-lever="layer-order"]')[0].textContent).toMatch(/^First tidy each side/);
});
