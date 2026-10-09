// @vitest-environment jsdom
/**
 * The shape-sorter levers (`/add-support-tiers`, class sweep 2026-10-08) on the shared teaching workspace, mounted the
 * way a lesson mounts it. A pull changes the screen and the scene fact in one commit and states no answer; the next
 * spoken attempt carries the lever; a refused pull changes nothing; an easier shape is ungraded and gives the full item
 * back blank, which alone is credited.
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
import { observerLever } from '../../../components/live-activity/runtime/observerLever';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const shape = (kind: string, color: string, size: 'small' | 'medium' | 'large' = 'medium', rotation = 0) =>
  ({ shape: kind, color, size, rotation });
const mount = (mode: string, challenge: Record<string, unknown>, supportTier?: string) => mountWorkspace({
  primitiveId: 'shape-sorter', evalMode: mode, instanceId: 'shapes',
  data: { title: 'Shapes', gradeBand: 'K', challenges: [{ instruction: '', ruleAttribute: 'shape', ...challenge,
    ...(supportTier ? { supportTier } : {}) }] } });
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');

it('count: start_mark and touch_marks mark the learner\'s shape with no number; the next try carries both levers', () => {
  const h = mount('count', { id: 'c1', type: 'count', shapes: [shape('hexagon', 'blue')] });
  expect(levers(h)).toEqual([['model_count', false], ['start_mark', false], ['touch_marks', false], ['fewer_sides', false]]);
  h.say('five'); h.feedback('incorrect', 'retry');
  expect(observerLever(h.state(), true)).toBe('model_count');
  const before = { screen: q(h, '[data-shape-start]').length, fact: onScreen(h) };
  expect(h.dispatch('pull_lever', { lever: 'start_mark' }).status).toBe('committed');
  // Screen and scene fact change in the same commit.
  expect(q(h, '[data-shape-start="side"]')).toHaveLength(1);
  expect(before).toEqual({ screen: 0, fact: '' });
  expect(onScreen(h)).toMatch(/One dot marks a starting side/);
  h.dispatch('pull_lever', { lever: 'touch_marks' });
  const sides = () => q(h, '[data-shape-tap="side"]');
  expect(sides()).toHaveLength(6);
  act(() => { fireEvent.click(sides()[0]); fireEvent.click(sides()[3]); });
  expect(sides().map(s => s.getAttribute('data-marked'))).toEqual(['true', 'false', 'false', 'true', 'false', 'false']);
  expect(h.view.container.textContent).not.toMatch(/\b6\b|six|hexagon/i);
  expect(onScreen(h)).not.toMatch(/six|hexagon|\b6\b/);
  h.say('six'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['start_mark', 'touch_marks'] });
  h.close();
});

it('count corners: the model card is a different shape with a dot on each corner; tap targets are corners', () => {
  const h = mount('count', { id: 'c1', type: 'count', shapes: [shape('triangle', 'red')] });
  // The session's first count asks for sides; a lone triangle has no fewer-sided shape.
  expect(levers(h).map(([id]) => id)).not.toContain('fewer_sides');
  h.dispatch('pull_lever', { lever: 'model_count' });
  const model = q(h, '[data-lever="model_count"]');
  expect(model).toHaveLength(1);
  expect(model[0].getAttribute('data-model-shape')).not.toBe('triangle');
  expect(q(h, '[data-lever="model_count"] [data-shape-tick]').length).toBeGreaterThanOrEqual(5);
  expect(onScreen(h)).toMatch(/different shape with a mark on each of its sides: (five|six) sides/);
  h.close();
});

it('identify: the model card shows a different shape; naming gets no marks on the learner\'s own shape', () => {
  const h = mount('identify', { id: 'c1', type: 'identify', shapes: [shape('triangle', 'red', 'large', 0), shape('circle', 'blue')] });
  const first = levers(h);
  expect(first).toEqual([['model_shape', false]]);
  h.say('diamond'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'model_shape' });
  const model = q(h, '[data-lever="model_shape"]');
  expect(model).toHaveLength(1);
  expect(['triangle', 'diamond', 'rhombus', 'circle']).not.toContain(model[0].getAttribute('data-model-shape'));
  expect(onScreen(h)).toMatch(/a different one, solved/);
  expect(onScreen(h)).not.toMatch(/triangle/);
  expect(q(h, '[data-assignment-target="true"] [data-shape-tick], [data-assignment-target="true"] [data-shape-tap]')).toHaveLength(0);
  h.say('triangle'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['model_shape'] });
  h.close();
});

it('identify: plain_drawing opens an ungraded upright shape, then the full item comes back blank and is credited', () => {
  const h = mount('identify', { id: 'c1', type: 'identify', shapes: [shape('triangle', 'red', 'small', 200), shape('square', 'blue')] });
  const full = h.state().task!.itemId;
  h.say('square'); h.feedback('incorrect', 'retry');
  expect(h.dispatch('pull_lever', { lever: 'plain_drawing' }).status).toBe('committed');
  const task = h.state().task!;
  expect(task.itemId).toBe(`${full}~simpler`);
  expect(task.workspace!.practice).toEqual({ returnsTo: full });
  expect(q(h, '[data-practice-item]')).toHaveLength(1);
  // The practice shape is one shape, alone and upright; it is not the learner's triangle nor its look-alike.
  expect(q(h, '[data-shape-id^="shape-"]')).toHaveLength(1);
  expect(task.workspace!.expectedAnswer).not.toMatch(/triangle|diamond|rhombus/);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  h.say(String(task.workspace!.expectedAnswer).split(' or ')[0]); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  expect(q(h, '[data-practice-item]')).toHaveLength(0);
  expect(q(h, '[data-shape-id^="shape-"]')).toHaveLength(2);
  h.say('triangle'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    [full, false, false], [`${full}~simpler`, true, true], [full, true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['plain_drawing'] });
  h.close();
});

it('count: fewer_sides opens an ungraded triangle, then the full hexagon is credited', () => {
  const h = mount('count', { id: 'c1', type: 'count', shapes: [shape('hexagon', 'green', 'small', 15)] });
  const full = h.state().task!.itemId;
  h.say('eight'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'fewer_sides' });
  expect(h.state().task!.itemId).toBe(`${full}~simpler`);
  expect(h.state().task!.workspace!.expectedAnswer).toBe('three or 3');
  h.say('three'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe(full);
  h.say('six'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: full, correct: true, assisted: true, levers: ['fewer_sides'] });
  h.close();
});

it('find_real_object: outline_only fades the object\'s details and names nothing', () => {
  const h = mount('find_real_object', { id: 'c1', type: 'identify-real-object', shapes: [
    { shape: 'circle', color: 'cyan', size: 'large', rotation: 0, realObject: 'clock face', realObjectId: 'clock' }] });
  expect(levers(h).map(([id]) => id)).toContain('outline_only');
  expect(q(h, '[data-object-details="muted"]')).toHaveLength(0);
  h.say('clock'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'outline_only' });
  expect(q(h, '[data-object-details="muted"]')).toHaveLength(1);
  expect(onScreen(h)).toMatch(/inside details .* faded/);
  expect(onScreen(h)).not.toMatch(/circle|round/);
  h.close();
});

it('sort: mat pictures sit under every mat alike; side ticks mark the ringed shape; easy starts with the pictures', () => {
  const sort = { id: 'c1', type: 'sort', ruleAttribute: 'sides', shapes: [shape('triangle', 'red'), shape('square', 'blue')] };
  const h = mount('sort', sort);
  expect(levers(h)).toEqual([['mat_pictures', false], ['side_ticks', false]]);
  h.say('triangle'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'mat_pictures' });
  expect(q(h, '[data-mat-picture="sticks"]')).toHaveLength(2);
  expect(q(h, '[data-mat-picture="sticks"]').map(s => s.querySelectorAll('line').length)).toEqual([3, 4]);
  h.dispatch('pull_lever', { lever: 'side_ticks' });
  expect(q(h, '[data-assignment-target="true"] [data-shape-tick]')).toHaveLength(3);
  expect(onScreen(h)).not.toMatch(/triangle/);
  h.close();

  const easy = mount('sort', sort, 'easy');
  expect(levers(easy)[0]).toEqual(['mat_pictures', true]);
  expect(q(easy, '[data-mat-picture]')).toHaveLength(2);
  easy.say('3 sides'); easy.feedback('correct');
  // A starting position is not a pull: the attempt records no lever.
  expect(easy.state().task!.workspace!.attempts.at(-1)!.levers ?? []).toEqual([]);
  easy.close();
});

it('a refused pull changes nothing: fewer_sides on a triangle, a lever pulled twice', () => {
  const h = mount('count', { id: 'c1', type: 'count', shapes: [shape('triangle', 'red')] });
  h.dispatch('pull_lever', { lever: 'start_mark' });
  const before = { html: h.view.container.innerHTML, levers: levers(h), fact: onScreen(h),
    attempts: h.state().task!.workspace!.attempts.length };
  expect(h.dispatch('pull_lever', { lever: 'fewer_sides' }).status).not.toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'start_mark' }).status).not.toBe('committed');
  expect({ html: h.view.container.innerHTML, levers: levers(h), fact: onScreen(h),
    attempts: h.state().task!.workspace!.attempts.length }).toEqual(before);
  h.close();
});
