// @vitest-environment jsdom
/**
 * The math-fact-fluency levers on the shared teaching workspace (handoff 30 M3), mounted the way a lesson mounts it.
 * A pull changes the screen and the scene in the same commit and states no number; the next attempt carries the
 * lever; a simplify pull opens an ungraded easier fact that returns to the full item, which alone is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { MathFactFluencyChallenge } from './MathFactFluency';
import { mathFactHarnessInputs } from './mathFactFluencyWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const base = { operation: 'addition' as const, operand1: 3, operand2: 4, result: 7, equation: '3 + 4 = 7', correctAnswer: 7, unknownPosition: 'result' as const };
const data = (challenges: MathFactFluencyChallenge[]) => ({ title: 'Facts', challenges, maxNumber: 10, includeSubtraction: true,
  showVisualAids: false, targetResponseTime: 3, adaptiveDifficulty: false, gradeBand: '1' as const });
const solve = (id: string, extra: Partial<MathFactFluencyChallenge> = {}): MathFactFluencyChallenge =>
  ({ ...base, id, type: 'equation-solve', instruction: 'Solve the fact.', options: [6, 7, 8, 9], ...extra });

const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const lever = (h: WorkspaceHarness, name: string) => h.view.container.querySelectorAll(`[data-lever="${name}"]`);
const answer = (h: WorkspaceHarness, c: MathFactFluencyChallenge, wrong: boolean) => {
  for (const input of mathFactHarnessInputs(c, wrong, 10)) if (input.type === 'touch') h.touch(input.target); else h.press(input.label);
};

it('equation_solve: fact_dots draws the printed numbers as dots in the same commit, states no number, and the next attempt carries it', () => {
  const c = solve('e1'), next = solve('e2', { operand1: 2, operand2: 2, result: 4, equation: '2 + 2 = 4', correctAnswer: 4, options: [3, 4, 5, 6] });
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'equation_solve', data: data([c, next]), instanceId: 'facts' });
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['fact_dots', 'help', false], ['smaller_fact', 'simplify', false]]);
  answer(h, c, true);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_short' });
  expect(lever(h, 'fact-dots')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'fact_dots' });
  expect(receipt.status).toBe('committed');
  const dots = lever(h, 'fact-dots')[0];
  expect(Array.from(dots.querySelectorAll('[data-lever-dot]')).map(d => d.getAttribute('data-lever-dot')))
    .toEqual([...Array(3).fill('plain'), ...Array(4).fill('added')]);
  expect(dots.textContent).not.toMatch(/\d/);
  expect(receipt.state.task!.demand.onScreen).toMatch(/Dots under the printed fact/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\d/);
  expect(h.dispatch('pull_lever', { lever: 'fact_dots' }).status).toBe('blocked');

  h.dispatch('retry');
  answer(h, c, false);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'e1', correct: true, assisted: true, levers: ['fact_dots'] });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('e2');
  expect(levers(h).every(l => !l.pulled)).toBe(true);
  expect(lever(h, 'fact-dots')).toHaveLength(0);
  h.close();
});

it('visual_fact: count_marks numbers only the dots tapped, and tapping chooses and checks nothing', () => {
  const c: MathFactFluencyChallenge = { ...base, id: 'v1', type: 'visual-fact', instruction: 'How many dots in all?', visualType: 'ten-frame', visualCount: 7, options: [6, 7, 8] };
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'visual_fact', data: data([c]), instanceId: 'facts' });
  expect(levers(h).map(l => l.id)).toEqual(['two_parts', 'count_marks', 'smaller_fact']);
  h.dispatch('pull_lever', { lever: 'count_marks' });
  const dots = () => Array.from(lever(h, 'count-marks')[0].querySelectorAll('button'));
  expect(dots()).toHaveLength(7);
  act(() => { fireEvent.click(dots()[2]); fireEvent.click(dots()[0]); fireEvent.click(dots()[0]); });
  expect(Array.from(lever(h, 'tap-number')).map(t => t.textContent)).toEqual(['2', '1']);
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  h.close();
});

it('visual_fact: two_parts redraws the picture in the two colours of the fact, with no numeral', () => {
  const c: MathFactFluencyChallenge = { ...base, id: 'v1', type: 'visual-fact', instruction: 'How many dots in all?', visualType: 'dot-array', visualCount: 7, options: [6, 7, 8] };
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'visual_fact', data: data([c]), instanceId: 'facts' });
  h.dispatch('pull_lever', { lever: 'two_parts' });
  const parts = lever(h, 'two-parts')[0];
  expect(Array.from(parts.querySelectorAll('[data-lever-dot]')).map(d => d.getAttribute('data-lever-dot')))
    .toEqual([...Array(3).fill('plain'), ...Array(4).fill('added')]);
  expect(parts.textContent).not.toMatch(/\d/);
  h.close();
});

it('missing_number: part_whole shades the known part and leaves the missing part hollow', () => {
  const c: MathFactFluencyChallenge = { ...base, id: 'n1', type: 'missing-number', instruction: 'What number is missing?', unknownPosition: 'operand2', correctAnswer: 4 };
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'missing_number', data: data([c]), instanceId: 'facts' });
  h.dispatch('pull_lever', { lever: 'part_whole' });
  const model = lever(h, 'part-whole')[0];
  expect(Array.from(model.querySelectorAll('[data-lever-dot]')).map(d => d.getAttribute('data-lever-dot')))
    .toEqual([...Array(3).fill('marked'), ...Array(4).fill('empty')]);
  expect(model.textContent).not.toMatch(/\d/);
  h.close();
});

it('speed_round offers no lever (ruled out 2026-10-02)', () => {
  const c: MathFactFluencyChallenge = { ...base, id: 's1', type: 'speed-round', instruction: 'What is 3 + 4?' };
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'speed_round', data: data([c]), instanceId: 'facts' });
  expect(levers(h)).toEqual([]);
  expect(h.offer('pull_lever')).toBeUndefined();
  h.close();
});

it('easy starts with fact_dots on screen: a starting position, not a recorded pull', () => {
  const c = solve('e1', { supportTier: 'easy' });
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'equation_solve', data: data([c]), instanceId: 'facts' });
  expect(levers(h).find(l => l.id === 'fact_dots')!.pulled).toBe(true);
  expect(lever(h, 'fact-dots')).toHaveLength(1);
  answer(h, c, false);
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers).toBeUndefined();
  h.close();
});

it('a simplify pull opens an ungraded smaller fact, keeps it on Try again, then returns to the full item, which alone is credited', () => {
  const c = solve('e1'), next = solve('e2', { operand1: 2, operand2: 2, result: 4, equation: '2 + 2 = 4', correctAnswer: 4, options: [3, 4, 5, 6] });
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'equation_solve', data: data([c, next]), instanceId: 'facts' });
  answer(h, c, true);
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_fact' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('e1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'e1' });
  expect(h.offer('pull_lever')).toBeUndefined();
  // 2 + 1: not the learner's fact, and not its answer.
  const problem = () => h.view.container.querySelector('[data-pip-object="problem"]')?.textContent;
  expect(problem()).toBe('2 + 1 = ?');
  h.touch('option-4');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: false });
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('e1~simpler');
  expect(problem()).toBe('2 + 1 = ?');
  h.touch('option-3');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('e1');
  expect(h.state().task!.workspace!.practice).toBeUndefined();
  expect(problem()).toBe('3 + 4 = ?');
  answer(h, c, false);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['e1', false, false], ['e1~simpler', false, true], ['e1~simpler', true, true], ['e1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ levers: ['smaller_fact'], assisted: true });
  h.close();
});

it('match: far_match opens two far-apart choices on a different fact', () => {
  const c: MathFactFluencyChallenge = { ...base, id: 'm1', type: 'match', instruction: 'Which equation matches the picture?', matchDirection: 'visual-to-equation',
    visualType: 'dot-array', visualCount: 7, equationOptions: ['2 + 4 = 6', '3 + 4 = 7', '4 + 4 = 8'] };
  const h = mountWorkspace({ primitiveId: 'math-fact-fluency', evalMode: 'match', data: data([c]), instanceId: 'facts' });
  expect(levers(h).map(l => l.id)).toEqual(['count_marks', 'far_match']);
  answer(h, c, true);
  h.dispatch('pull_lever', { lever: 'far_match' });
  const eqs = Array.from(h.view.container.querySelectorAll('[data-pip-object^="equation-"]')).map(b => b.textContent);
  expect(eqs).toEqual(['1 + 1 = 2', '4 + 1 = 5']);
  h.close();
});
