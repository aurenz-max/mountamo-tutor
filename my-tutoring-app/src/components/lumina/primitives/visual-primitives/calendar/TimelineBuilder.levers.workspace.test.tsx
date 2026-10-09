// @vitest-environment jsdom
/**
 * timeline-builder levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and draws no event; the next attempt records the lever; a refused pull changes nothing; the practice timeline
 * is ungraded, none of its events is the item's, and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { TimelineBuilderChallenge } from './TimelineBuilder';
import { practiceTimeline } from './timelineBuilderLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const challenge = (id: string, type: TimelineBuilderChallenge['type'], scale: [string, string], events: Array<[string, string]>): TimelineBuilderChallenge =>
  ({ id, type, title: `${type} order`, instruction: `Put these in order from ${scale[0]} to ${scale[1]}.`, scaleStart: scale[0],
    scaleEnd: scale[1], hint: 'Think.', narration: '',
    events: events.map(([label, description], i) => ({ id: `evt-${i}`, label, description, correctPosition: i })) });

const YEARLY = challenge('y', 'yearly', ['August', 'June'], [['First Day', 'in August'], ['Picture Day', 'in October'],
  ['Holiday Show', 'in December'], ['Field Day', 'in May']]);
const DAILY = challenge('d', 'daily', ['Morning', 'Bedtime'], [['Wake Up', 'get up'], ['Homeroom', 'school starts'],
  ['Board the Bus', 'go home'], ['Go to Sleep', 'lights out']]);

const mount = (mode: string, challenges: TimelineBuilderChallenge[]) => mountWorkspace({ primitiveId: 'timeline-builder',
  evalMode: mode, instanceId: 'timeline', data: { title: 'Timelines', gradeBand: '2-3', challenges } });
const place = (h: WorkspaceHarness, labels: string[]) => {
  labels.forEach((label, i) => { h.press(label); h.press(`Slot ${i + 1}`); });
  h.press('Check Order');
};
const inOrder = (c: TimelineBuilderChallenge) => c.events.map(e => e.label);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const noEvent = (c: TimelineBuilderChallenge, s: string) => c.events.every(e => !s.toLowerCase().includes(e.label.toLowerCase()));

it('yearly: a swap pulls the month ruler in the same commit, naming no event; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('sequence-yearly', [YEARLY]);
  expect(levers(h)).toEqual([['time_arrow', false], ['time_ruler', false], ['fewer_events', false]]);
  const [a, b, ...rest] = inOrder(YEARLY);
  place(h, [b, a, ...rest]);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'adjacent_swap' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'adjacent_swap')).toBe('time_ruler');
  expect(q(h, '[data-lever="time-ruler"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'time_ruler' });
  expect(receipt.status).toBe('committed');
  const fact = String(receipt.state.task!.demand.onScreen);
  expect(fact).toMatch(/every month in order/);
  expect(noEvent(YEARLY, fact)).toBe(true);
  const marks = q(h, '[data-lever="ruler-mark"]').map(m => m.textContent);
  expect(marks).toEqual(['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
  expect(noEvent(YEARLY, q(h, '[data-lever="time-ruler"]')[0].textContent ?? '')).toBe(true);
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length,
    html: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: 'time_ruler' }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h), attempts: attempts(h).length,
    html: h.view.container.innerHTML }).toEqual(before);
  h.dispatch('retry');
  // Try again keeps the ruler; the board is blank.
  expect(q(h, '[data-lever="time-ruler"]')).toHaveLength(1);
  place(h, inOrder(YEARLY));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'y', correct: true, levers: ['time_ruler'] });
});

it('daily: reversed pulls the arrow, then the day-part pictures; the next item opens bare', () => {
  const h = mount('sequence-daily', [DAILY, { ...DAILY, id: 'd2' }]);
  place(h, [...inOrder(DAILY)].reverse());
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'reversed' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'reversed')).toBe('time_arrow');
  expect(h.dispatch('pull_lever', { lever: 'time_arrow' }).status).toBe('committed');
  expect(q(h, '[data-lever="time-arrow"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/from Morning \(earlier, flagged\).*to Bedtime \(later\)/);
  expect(nextLever(h.state().task!.workspace!.levers!, 'reversed')).toBe('time_ruler');
  expect(h.dispatch('pull_lever', { lever: 'time_ruler' }).status).toBe('committed');
  expect(q(h, '[data-lever="ruler-mark"]').map(m => m.textContent)).toEqual(['🌅morning', '☀️middle of the day', '🌇evening', '🌙night']);
  expect(noEvent(DAILY, JSON.stringify(h.state().task!.demand.onScreen))).toBe(true);
  h.dispatch('retry');
  place(h, inOrder(DAILY));
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('d2');
  expect(q(h, '[data-lever]')).toHaveLength(0);
  expect(levers(h)).toEqual([['time_arrow', false], ['time_ruler', false], ['fewer_events', false]]);
});

it('fewer events: an ungraded practice timeline of the same kind with none of the item\'s events; the full item comes back blank and is credited after', () => {
  const h = mount('sequence-yearly', [YEARLY]);
  const [a, b, ...rest] = inOrder(YEARLY);
  place(h, [b, a, ...rest]);
  const receipt = h.dispatch('pull_lever', { lever: 'fewer_events' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('y~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'y' });
  expect(receipt.state.task!.demand).toMatchObject({ kind: 'yearly timeline', practice: expect.any(String) });
  expect(receipt.state.task!.workspace!.levers ?? []).toEqual([]);
  expect(q(h, '[data-practice]')).toHaveLength(1);
  const practiceLabels = q(h, 'button[aria-label]').map(x => x.getAttribute('aria-label')!).filter(l => !/^Slot /.test(l));
  expect(practiceLabels).toHaveLength(3);
  expect(practiceLabels.some(l => inOrder(YEARLY).includes(l))).toBe(false);
  // Solve the practice in its own order (the pool entry the builder picked).
  place(h, inOrder(practiceTimeline(YEARLY, [YEARLY])!));
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('y');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No event placed yet' });
  expect(q(h, '[data-practice]')).toHaveLength(0);
  place(h, inOrder(YEARLY));
  expect(attempts(h).map(x => [x.itemId, x.correct, !!(x as { practice?: boolean }).practice])).toEqual([
    ['y', false, false], ['y~simpler', true, true], ['y', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['fewer_events'] });
});
