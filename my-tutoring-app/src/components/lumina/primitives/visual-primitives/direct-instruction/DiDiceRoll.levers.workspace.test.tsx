// @vitest-environment jsdom
/**
 * The di-dice-roll levers (DI family 2 of `/add-support-tiers`) on the shared teaching workspace, mounted the way a
 * lesson mounts it. The model is a different roll; a tapped dot gets a ring and no number; the bracket draws no
 * number; an easier roll starts covered, is ungraded, and gives the full roll back; the easy start is not a pull.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { DiDiceRollChallenge, DiDiceRollChallengeType, DiDiceRollSupportTier } from './diDiceRollScript';
import { diceItem } from './diDiceRollLevers';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const rollOf = (type: DiDiceRollChallengeType, a: number, b: number, tier: DiDiceRollSupportTier, id: string): DiDiceRollChallenge =>
  diceItem(type, a, b, id, tier);
const mount = (type: DiDiceRollChallengeType, ...challenges: DiDiceRollChallenge[]) => mountWorkspace({ primitiveId: 'di-dice-roll',
  evalMode: type, instanceId: 'dice', data: { title: 'Dice', description: 'Roll.', challengeType: type, challenges } });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const roll = () => fireEvent.click(screen.getByRole('button', { name: /Roll/ }));

it('count_pips at medium: tapped dots get rings and no number; the next try carries the lever', () => {
  const h = mount('count_pips', rollOf('count_pips', 5, 0, 'medium', 'c1'));
  expect(levers(h)).toEqual([['model_roll', false], ['touch_dots', false], ['fewer_dots', false]]);
  roll();
  h.say('four'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'touch_dots' });
  const dots = () => q(h, '[data-pip-tap]');
  expect(dots()).toHaveLength(5);
  act(() => { fireEvent.click(dots()[0]); fireEvent.click(dots()[2]); });
  expect(dots().map(d => d.getAttribute('data-ringed'))).toEqual(['true', 'false', 'true', 'false', 'false']);
  expect(h.view.container.textContent).not.toMatch(/\b5\b|five/i);
  h.say('five'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['touch_dots'] });
  h.close();
});

it('easy starts with a model of a different roll, before the roll; a try under it records no lever', () => {
  const h = mount('count_pips', rollOf('count_pips', 3, 0, 'easy', 'e1'));
  const model = q(h, '[data-lever="model_roll"]');
  expect(model).toHaveLength(1);
  expect(model[0].getAttribute('data-model-roll')).not.toBe('3');
  expect(String(h.state().task!.demand.onScreen)).toMatch(/different roll, solved/);
  roll();
  h.say('three'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('compare_dice: the model has the other word; far_pair is an easier pair the child rolls, then the full pair is credited', () => {
  const h = mount('compare_dice', rollOf('compare_dice', 4, 3, 'hard', 'p1'));
  const full = h.state().task!.itemId;
  roll();
  h.say('right'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'model_roll' });
  // R1: three pairs, one per answer; a star on the die with more in the two unequal pairs.
  expect(q(h, '[data-lever="model_roll"] [data-model-pair]').map(e => e.getAttribute('data-model-pair'))).toEqual(['left', 'right', 'same']);
  expect(q(h, '[data-lever="model_roll"] [data-model-star]')).toHaveLength(2);
  h.dispatch('pull_lever', { lever: 'far_pair' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(h.state().task!.demand.rolled).toBe('no');
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  roll();
  h.say('right'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('left'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['model_roll', 'far_pair'] });
  h.close();
});

it('sum_two_dice: the bracket spans both dice and draws no number; a tie-free refusal changes nothing', () => {
  const h = mount('sum_two_dice', rollOf('sum_two_dice', 4, 3, 'hard', 's1'));
  roll();
  h.dispatch('pull_lever', { lever: 'both_bracket' });
  const bracket = q(h, '[data-lever="both_bracket"]');
  expect(bracket).toHaveLength(1);
  expect(bracket[0].textContent).toBe('');
  const before = h.view.container.innerHTML;
  h.dispatch('pull_lever', { lever: 'far_pair' });
  expect(h.view.container.innerHTML).toBe(before);
  h.close();
});
