// @vitest-environment jsdom
/**
 * The di-math-facts levers (the DI pilot of `/add-support-tiers`, user ruling 2026-10-02) on the shared teaching
 * workspace, mounted the way a lesson mounts it. The model card is a DIFFERENT fact; a pull changes the screen and
 * the scene in one commit and never draws this fact's answer; the next spoken attempt carries the lever; the easier
 * fact is ungraded and gives the full fact back; an easy tier's starting model is not recorded as a pull.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { DiMathFactsChallengeType } from './diMathFactsModes';
import type { DiMathFactsSupportTier } from './diMathFactsDomain';
import { factItem } from './diMathFactsLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const challenge = (type: DiMathFactsChallengeType, a: number, b: number, supportTier: DiMathFactsSupportTier, id: string) => {
  const { terms: _t, countingRoute: _c, ask: _a, accepted: _ac, assignment: _as, answerKind: _k, responseClass: _r, ...c } =
    factItem(type, a, b, id, supportTier)!;
  return { ...c, a, b };
};
const data = (type: DiMathFactsChallengeType, ...challenges: ReturnType<typeof challenge>[]) =>
  ({ title: 'Facts', challengeType: type, challenges });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('answer_fact at medium: the model is a different fact, dots draw only the printed numbers, the next try carries both', () => {
  const h = mountWorkspace({ primitiveId: 'di-math-facts', evalMode: 'answer_fact', instanceId: 'facts',
    data: data('answer_fact', challenge('answer_fact', 3, 2, 'medium', 'f1')) });
  expect(levers(h)).toEqual([['model_fact', false], ['dot_model', false], ['smaller_fact', false]]);
  expect(q(h, '[data-lever="model_fact"]')).toHaveLength(0);
  h.say('three'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'model_fact' });
  const model = q(h, '[data-lever="model_fact"]')[0];
  expect(model.getAttribute('data-model-fact')).not.toBe('3 + 2');
  expect(model.textContent).not.toMatch(/\b5\b/);
  h.dispatch('pull_lever', { lever: 'dot_model' });
  expect(q(h, '[data-dot-group]').map(g => g.getAttribute('data-dots'))).toEqual(['3', '2']);
  const onScreen = String(h.state().task!.demand.onScreen);
  expect(onScreen).toMatch(/different problem solved/);
  expect(onScreen).not.toMatch(/\bfive\b|\b5\b/);
  h.say('five'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: ['model_fact', 'dot_model'] });
  h.close();
});

it('easy starts with the model card on screen, and a first try under it is not recorded as a pull', () => {
  const h = mountWorkspace({ primitiveId: 'di-math-facts', evalMode: 'answer_fact', instanceId: 'facts',
    data: data('answer_fact', challenge('answer_fact', 4, 1, 'easy', 'e1')) });
  expect(levers(h)[0]).toEqual(['model_fact', true]);
  expect(q(h, '[data-lever="model_fact"]')).toHaveLength(1);
  expect(h.state().task!.demand.support).toMatch(/model card of a different fact/);
  h.say('five'); h.feedback('correct');
  const last = h.state().task!.workspace!.attempts.at(-1)!;
  expect(last.correct).toBe(true);
  expect(last.levers ?? []).toEqual([]);
  h.close();
});

it('subtraction: take_one_away is an ungraded easier fact, then the full fact is credited', () => {
  const h = mountWorkspace({ primitiveId: 'di-math-facts', evalMode: 'subtraction_fact', instanceId: 'facts',
    data: data('subtraction_fact', challenge('subtraction_fact', 5, 3, 'hard', 's1')) });
  const full = h.state().task!.itemId;
  h.say('five'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'take_away_dots' });
  expect(q(h, '[data-dot-crossed]')).toHaveLength(3);
  h.dispatch('pull_lever', { lever: 'take_one_away' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(h.state().task!.workspace!.expectedAnswer).toBe('four');
  expect(q(h, '[data-practice-item]')[0].textContent).toBe('5-1');
  expect(q(h, '[data-dot-crossed]')).toHaveLength(0);
  h.say('three'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('two'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, false, true], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['take_away_dots', 'take_one_away'] });
  h.close();
});

it('counting_next: number_path stops at the printed number; a refused pull changes nothing', () => {
  const h = mountWorkspace({ primitiveId: 'di-math-facts', evalMode: 'counting_next', instanceId: 'facts',
    data: data('counting_next', challenge('counting_next', 7, 1, 'hard', 'c1')) });
  expect(levers(h).map(([id]) => id)).toEqual(['model_fact', 'number_path']);
  h.dispatch('pull_lever', { lever: 'number_path' });
  expect(q(h, '[data-path-number]').map(n => n.textContent)).toEqual(['5', '6', '7']);
  expect(q(h, '[data-path-box="empty"]')).toHaveLength(1);
  const before = h.view.container.innerHTML;
  h.dispatch('pull_lever', { lever: 'inside_decade' });
  expect(h.view.container.innerHTML).toBe(before);
  h.close();
});
