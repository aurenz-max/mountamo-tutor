// @vitest-environment jsdom
/**
 * The di-shapes levers (DI family 3 of `/add-support-tiers`) on the shared teaching workspace, mounted the way a
 * lesson mounts it. The model is a different shape; a tapped side is marked with no number; the start dot is one
 * mark; an easier shape is ungraded and gives the full shape back; the easy start is not a pull.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { DiShapeName, DiShapesChallenge, DiShapesChallengeType } from './diShapesScript';
import { shapeItem } from './diShapesLevers';

beforeEach(() => { installRuntimeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) }); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const shape = (s: DiShapeName, type: DiShapesChallengeType, tier: DiShapesChallenge['supportTier'], id: string,
  extra: Partial<DiShapesChallenge> = {}): DiShapesChallenge => ({ ...shapeItem(s, type, id, tier), ...extra });
const mount = (mode: string, ...challenges: DiShapesChallenge[]) => mountWorkspace({ primitiveId: 'di-shapes', evalMode: mode,
  instanceId: 'shapes', data: { title: 'Shapes', description: 'Say it.', challengeType: challenges[0].challengeType, challenges } });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('count_sides at medium: a start dot, then tapped sides marked with no number; the next try carries both levers', () => {
  const h = mount('count_sides', shape('hexagon', 'count_sides', 'medium', 'h1'));
  expect(levers(h)).toEqual([['model_count', false], ['start_mark', false], ['touch_marks', false], ['fewer_sides', false]]);
  h.say('five'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'start_mark' });
  expect(q(h, '[data-shape-start="side"]')).toHaveLength(1);
  h.dispatch('pull_lever', { lever: 'touch_marks' });
  const sides = () => q(h, '[data-shape-tap="side"]');
  expect(sides()).toHaveLength(6);
  act(() => { fireEvent.click(sides()[0]); fireEvent.click(sides()[3]); });
  expect(sides().map(s => s.getAttribute('data-marked'))).toEqual(['true', 'false', 'false', 'true', 'false', 'false']);
  expect(h.view.container.textContent).not.toMatch(/\b6\b|six|hexagon/i);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/six|hexagon/);
  h.say('six'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['start_mark', 'touch_marks'] });
  h.close();
});

it('count_corners: the model marks every corner of a different shape; tap targets are corners', () => {
  const h = mount('count_corners', shape('triangle', 'count_corners', 'hard', 't1'));
  h.dispatch('pull_lever', { lever: 'model_count' });
  const model = q(h, '[data-lever="model_count"]');
  expect(model).toHaveLength(1);
  expect(model[0].getAttribute('data-model-shape')).not.toBe('triangle');
  expect(q(h, '[data-lever="model_count"] [data-shape-corner-dot]').length).toBeGreaterThanOrEqual(5);
  h.dispatch('pull_lever', { lever: 'touch_marks' });
  expect(q(h, '[data-shape-tap="corner"]')).toHaveLength(3);
  h.close();
});

it('easy name_shape starts with a model of a different shape; a try under it records no lever', () => {
  const h = mount('name_shape', shape('triangle', 'name_shape', 'easy', 'n1'));
  const model = q(h, '[data-lever="model_shape"]');
  expect(model).toHaveLength(1);
  expect(['triangle', 'rhombus']).not.toContain(model[0].getAttribute('data-model-shape'));
  expect(String(h.state().task!.demand.onScreen)).toMatch(/different one, solved/);
  // Naming gets no in-item help: no ticks, dots or tap targets on the child's shape.
  expect(q(h, '[data-shape-object="shape"] [data-shape-tap], [data-shape-object="shape"] [data-shape-tick]')).toHaveLength(0);
  h.say('triangle'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  h.close();
});

it('plain_drawing on a variant: an easier, different shape is ungraded, then the full shape is credited', () => {
  const h = mount('shape_review', shape('hexagon', 'shape_review', 'hard', 'v1', { exemplar: 'variant', rotationDeg: 28 }));
  const full = h.state().task!.itemId;
  h.say('pentagon'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'plain_drawing' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  h.say('circle'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('hexagon'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['plain_drawing'] });
  h.close();
});

it('a refused pull changes nothing: fewer_sides on a triangle, plain_drawing on a plain upright shape', () => {
  const h = mount('count_sides', shape('triangle', 'count_sides', 'hard', 'r1'));
  const before = h.view.container.innerHTML;
  h.dispatch('pull_lever', { lever: 'fewer_sides' });
  h.dispatch('pull_lever', { lever: 'plain_drawing' });
  expect(h.view.container.innerHTML).toBe(before);
  h.close();
});
