// @vitest-environment jsdom
/**
 * light-shadow-lab levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and draws no answer; the next attempt records the lever; a refused pull changes nothing; an easier item is
 * ungraded practice of the same mode with two choices, and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ShadowChallenge, SunPosition } from './LightShadowLab';
import { keyOption, shadowHarnessAnswers } from './lightShadowWorkspace';
import { practiceItem } from './lightShadowLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const SUNS: SunPosition[] = [
  { time: '8:00 AM', altitude: 20, azimuth: 25 }, { time: '10:00 AM', altitude: 40, azimuth: 65 },
  { time: '12:00 PM', altitude: 65, azimuth: 90 }, { time: '2:00 PM', altitude: 40, azimuth: 120 }, { time: '4:00 PM', altitude: 20, azimuth: 155 },
];
const item = (id: string, type: ShadowChallenge['type'], sun: SunPosition, extra: Partial<ShadowChallenge> = {}): ShadowChallenge =>
  ({ id, type, instruction: 'Which way does the shadow point, and how long is it?', sunPosition: sun,
    correctShadow: { direction: 'W', relativeLength: 'long' }, ...extra });
const mount = (mode: string, challenges: ShadowChallenge[]) => {
  const h = mountWorkspace({ primitiveId: 'light-shadow-lab', evalMode: mode, instanceId: 'shadow',
    data: { title: 'Shadows', description: 'Sun and shadow', theme: 'playground', gradeLevel: '1',
      objects: [{ type: 'flagpole', height: 4 }], sunPositions: SUNS, challenges } });
  h.settle(1000);
  return h;
};
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Check Answer'); h.settle(); };
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;

it('predict: the side pictures show in the same commit and name nothing; a repeat pull changes nothing; the next attempt records it', () => {
  const c = item('p', 'predict', SUNS[0]);
  const h = mount('predict', [c]);
  expect(levers(h)).toEqual([['side_model', false], ['height_model', false], ['easy_sun', false]]);
  answer(h, 'East (left), Long');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'toward_sun' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'toward_sun')).toBe('side_model');
  expect(q(h, '[data-lever="side-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'side_model' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/three small pictures/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toContain(keyOption(c));
  expect(q(h, '[data-lever="side-model"] svg')).toHaveLength(3);
  // Still no shadow on the predicted item: the pictures are models, not the item.
  expect(q(h, 'line[stroke="rgba(0,0,0,0.5)"]')).toHaveLength(0);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length, html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'side_model' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length, html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry'); h.confirmVisible();
  expect(q(h, '[data-lever="side-model"]')).toHaveLength(1);
  answer(h, keyOption(c));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'p', correct: true, levers: ['side_model'] });
  h.close();
});

it('measure: the ground marks are the same on both sides and carry no words', () => {
  const h = mount('measure', [item('m', 'measure', SUNS[1])]);
  answer(h, shadowHarnessAnswers(item('m', 'measure', SUNS[1]), SUNS).plainWrong);
  expect(h.dispatch('pull_lever', { lever: 'shadow_zones' }).status).toBe('committed');
  const xs = q(h, '[data-lever="zone-mark"]').map(l => Number(l.getAttribute('x1')) - 350).sort((a, b) => a - b);
  expect(xs.map(Math.round)).toEqual([-173, -58, 58, 173]);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/both sides/);
  h.close();
});

it('apply: the easier shadow is ungraded practice with two times; the full item comes back blank and is credited after it', () => {
  const c = item('a', 'apply', SUNS[1]);
  const h = mount('apply', [c]);
  answer(h, '2:00 PM');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'mirror_time' });
  const receipt = h.dispatch('pull_lever', { lever: 'easy_shadow' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a~easier');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'a' });
  expect(h.view.container.textContent).toMatch(/Practice/);
  const p = practiceItem(c)!;
  expect(p.choices).toHaveLength(2);
  expect(p.choices).not.toContain(keyOption(c));
  for (const t of p.choices!) expect(h.view.container.textContent).toContain(t);
  expect(h.view.container.textContent).not.toContain(keyOption(c));
  answer(h, keyOption(p));
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a');
  expect(h.view.container.textContent).not.toMatch(/Practice/);
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  answer(h, keyOption(c));
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['a', false, false], ['a~easier', true, true], ['a', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['easy_shadow'] });
  h.close();
});

it('an easy item opens with its starting levers drawn and declared pulled; a right first answer records no lever', () => {
  const c = item('o', 'observe', SUNS[0], { startLevers: ['shadow_zones'] });
  const h = mount('observe', [c]);
  expect(q(h, '[data-lever="zone-mark"]')).toHaveLength(4);
  expect(levers(h)).toContainEqual(['shadow_zones', true]);
  answer(h, keyOption(c));
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect((attempts(h).at(-1) as { levers?: string[] }).levers ?? []).toEqual([]);
  h.close();
});
