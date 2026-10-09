// @vitest-environment jsdom
/**
 * time-sequencer levers, mounted the way a lesson mounts them. A help pull changes the screen and the scene fact in
 * one commit and names no key; the next attempt records the lever; a refused pull changes nothing; a simplify pull
 * opens an ungraded practice item of the same mode, and the full item comes back blank and is credited after it.
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
import type { TimeSequencerChallenge } from './TimeSequencer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const ev = (id: string, label: string, extra: Record<string, unknown> = {}) => ({ id, label, emoji: '🙂', ...extra });
const MORNING = [ev('w', 'Wake up', { dayFraction: 0.29, clockHour: 7 }), ev('b', 'Eat breakfast', { dayFraction: 0.33, clockHour: 8 }),
  ev('s', 'Catch the bus', { dayFraction: 0.375, clockHour: 9 })];
const C: Record<string, TimeSequencerChallenge> = {
  'sequence-3': { id: 'q', type: 'sequence-events', instruction: 'Put the morning in order.', events: MORNING, correctOrder: ['w', 'b', 's'] },
  'clock-sequence': { id: 'k', type: 'clock-sequence', instruction: 'Look at the clocks.', events: MORNING, correctOrder: ['w', 'b', 's'], showClockFace: true },
  'time-of-day': { id: 't', type: 'match-time-of-day', instruction: 'When do you eat breakfast?', event: ev('e', 'Eat breakfast'), correctPeriod: 'morning' },
  'before-after': { id: 'ba', type: 'before-after', instruction: 'What happens before school?', referenceEvent: ev('r', 'Go to school'),
    relation: 'before', options: [ev('o1', 'Eat breakfast'), ev('o2', 'Eat dinner'), ev('o3', 'Go to bed')], correctEvent: 'o1' },
  'duration-compare': { id: 'd', type: 'duration-compare', instruction: 'Which takes longer?', eventA: ev('a', 'Brush teeth'),
    eventB: ev('bb', 'Go on a long hike'), correctAnswer: 'B' },
  'read-schedule': { id: 'r', type: 'read-schedule', instruction: 'What happens at 10:00 AM?', targetTime: '10:00 AM',
    schedule: [{ time: '8:00 AM', activity: 'Reading', emoji: '📖' }, { time: '10:00 AM', activity: 'Math', emoji: '➕' },
      { time: '12:00 PM', activity: 'Lunch', emoji: '🥪' }], activityOptions: ['Reading', 'Math', 'Lunch', 'Recess'], correctActivity: 'Math' },
};
const mount = (mode: string, extra: TimeSequencerChallenge[] = []) => {
  const h = mountWorkspace({ primitiveId: 'time-sequencer', evalMode: mode, instanceId: 'times',
    data: { title: 'Time', gradeBand: mode === 'read-schedule' ? '1' : 'K', challenges: [C[mode], ...extra] } });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const check = (h: WorkspaceHarness) => h.press(/check/i);
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

it('sequence-3: the sky strip comes onto every card in the same commit, naming no card; a repeat pull changes nothing; the next attempt records it', () => {
  const h = mount('sequence-3');
  expect(levers(h)).toEqual([['sky_strip', false], ['far_apart_cards', false]]);
  ['Catch the bus', 'Eat breakfast', 'Wake up'].forEach(l => h.press(l)); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  expect(q(h, '[data-sky-strip]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'sky_strip' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/sky strip/);
  expect(q(h, '[data-sky-strip]')).toHaveLength(3);
  for (const l of ['Wake up', 'Eat breakfast', 'Catch the bus']) expect(onScreen(h)).not.toContain(l);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'sky_strip' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  ['Wake up', 'Eat breakfast', 'Catch the bus'].forEach(l => h.press(l)); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'q', correct: true, levers: ['sky_strip'] });
});

it('sequence-3: far-apart cards are ungraded practice; the full item comes back with no card placed and is credited after', () => {
  const h = mount('sequence-3');
  ['Catch the bus', 'Eat breakfast', 'Wake up'].forEach(l => h.press(l)); check(h);
  const receipt = h.dispatch('pull_lever', { lever: 'far_apart_cards' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('q~smaller');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'q' });
  expect(receipt.state.task!.demand).toMatchObject({ cards: 'Get dressed, Go to sleep, Play at the park' });
  expect(q(h, '[data-practice]')).toHaveLength(1);
  // A wrong try on the practice item keeps it on screen.
  ['Go to sleep', 'Play at the park', 'Get dressed'].forEach(l => h.press(l)); check(h);
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('q~smaller');
  ['Get dressed', 'Play at the park', 'Go to sleep'].forEach(l => h.press(l)); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('q');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No card placed yet' });
  expect(q(h, '[data-practice]')).toHaveLength(0);
  ['Wake up', 'Eat breakfast', 'Catch the bus'].forEach(l => h.press(l)); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['q', false, false], ['q~smaller', false, true], ['q~smaller', true, true], ['q', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['far_apart_cards'] });
});

it('clock-sequence: no sky strip; face numbers put all twelve numbers on every face, and name no hour', () => {
  const h = mount('clock-sequence');
  expect(levers(h)).toEqual([['face_numbers', false], ['far_apart_cards', false]]);
  expect(h.dispatch('pull_lever', { lever: 'sky_strip' }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'face_numbers' }).status).toBe('committed');
  expect(q(h, '[data-lever="face-number"]')).toHaveLength(36);
  expect(q(h, '[data-sky-strip]')).toHaveLength(0);
  expect(JSON.stringify(h.state().task)).not.toMatch(/clockHour|\b[789] o'clock/);
});

it('time-of-day: anchors beside each choice never name the period; two choices is a practice with another activity', () => {
  const h = mount('time-of-day');
  h.press('Afternoon'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'next_period' });
  expect(h.dispatch('pull_lever', { lever: 'day_anchors' }).status).toBe('committed');
  const anchors = q(h, '[data-lever="day-anchor"]').map(a => a.textContent ?? '');
  expect(anchors).toHaveLength(4);
  ['Wake up', 'Eat lunch', 'Eat dinner', 'Go to sleep'].forEach((l, i) => expect(anchors[i]).toContain(l));
  expect(onScreen(h)).not.toMatch(/morning|breakfast/i);
  h.dispatch('retry');
  h.press('Night'); check(h);
  const receipt = h.dispatch('pull_lever', { lever: 'two_choices' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.demand).toMatchObject({ choices: 'Afternoon, Night' });
  expect(receipt.state.task!.demand.activity).not.toMatch(/breakfast/i);
  expect(q(h, '[aria-label="Morning"]')).toHaveLength(0);
  expect(q(h, '[data-lever="day-anchor"]')).toHaveLength(0);
});

it('before-after: the model day of other cards; never the reference or an option', () => {
  const h = mount('before-after');
  h.press('Eat dinner'); check(h);
  expect(h.dispatch('pull_lever', { lever: 'relation_model' }).status).toBe('committed');
  const model = q(h, '[data-lever="relation-model"]')[0];
  expect(model.textContent).toMatch(/before/);
  expect(model.textContent).toMatch(/after/);
  for (const l of ['Go to school', 'Eat breakfast', 'Eat dinner', 'Go to bed']) {
    expect(model.textContent).not.toContain(l);
    expect(onScreen(h)).not.toContain(l);
  }
});

it('duration-compare: bars on two other pairs; the item\'s cards get none', () => {
  const h = mount('duration-compare');
  h.press('Brush teeth'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'shorter_one' });
  expect(h.dispatch('pull_lever', { lever: 'duration_model' }).status).toBe('committed');
  expect(q(h, '[data-lever="duration-bar"]')).toHaveLength(4);
  const model = q(h, '[data-lever="duration-model"]')[0].textContent ?? '';
  expect(model).not.toMatch(/teeth|hike/i);
  expect(onScreen(h)).not.toMatch(/teeth|hike/i);
});

it('read-schedule: option pictures from the schedule; a short schedule is a practice at another time', () => {
  const h = mount('read-schedule');
  h.press('Lunch'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'next_row' });
  expect(h.dispatch('pull_lever', { lever: 'option_pictures' }).status).toBe('committed');
  expect(q(h, '[data-lever="option-picture"]').map(p => p.textContent)).toEqual(['📖', '➕', '🥪']);
  h.dispatch('retry');
  h.press('Recess'); check(h);
  const receipt = h.dispatch('pull_lever', { lever: 'short_schedule' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.demand).toMatchObject({ scheduleRows: 3 });
  expect(receipt.state.task!.demand.targetTime).not.toBe('10:00 AM');
  expect(q(h, '[data-lever="option-picture"]')).toHaveLength(0);
});
