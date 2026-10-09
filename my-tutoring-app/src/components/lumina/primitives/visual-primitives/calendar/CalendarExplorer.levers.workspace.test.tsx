// @vitest-environment jsdom
/**
 * calendar-explorer levers (`calendarExplorerLevers.ts`), mounted the way a lesson mounts it: a help pull changes the
 * screen and the scene fact in one commit and leaves the answer to the learner; the next attempt records the lever; a
 * refused pull changes nothing; the simpler question is ungraded and gives the full item back blank, which is credited
 * with the levers recorded; the spoken chain's model pair is two other days.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { CalendarExplorerChallenge } from './CalendarExplorer';
import {
  MODEL_PAIR_LEVER, RING_LEVER, ROWS_LEVER, SIMPLER_LEVER, STRIP_LEVER, TICKS_LEVER, TINT_LEVER,
} from './calendarExplorerLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ch = (over: Partial<CalendarExplorerChallenge>): CalendarExplorerChallenge => ({ id: 'c1', type: 'identify', question: '',
  month: 3, year: 2025, correctAnswer: '', options: [], hint: 'Use the calendar.', narration: 'Try it.', ...over });
const mount = (challenges: CalendarExplorerChallenge[], mode: string, over: Record<string, unknown> = {}) =>
  mountWorkspace({ primitiveId: 'calendar-explorer', evalMode: mode, instanceId: 'calendar',
    data: { title: 'Calendar', gradeBand: '1', challenges, ...over } });
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const last = (h: WorkspaceHarness) => attempts(h).at(-1);

it('identify: a wrong day, then the ring, in one commit, on the named date; credited with the lever', () => {
  const h = mount([ch({ question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday',
    options: ['Thursday', 'Friday', 'Saturday', 'Sunday'] })], 'identify');
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[RING_LEVER, false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  fireEvent.click(screen.getByTestId('option-Friday'));
  check();
  expect(last(h)).toMatchObject({ correct: false, miss: 'day_before' });
  expect(observerLever(h.state(), true)).toBe(RING_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: RING_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="ring"]')).map(n => n.textContent)).toEqual(['15']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/A ring on March 15/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/Saturday/);

  // Its only lever is pulled: the tool is no longer offered.
  expect(h.offer('pull_lever')).toBeUndefined();

  h.dispatch('retry'); h.confirmVisible();
  fireEvent.click(screen.getByTestId('option-Saturday'));
  check();
  expect(last(h)).toMatchObject({ itemId: 'c1', correct: true, assisted: true, levers: [RING_LEVER] });
  h.close();
});

it('identify "third Wednesday": the tint (a second pull refused, nothing changes), then a simpler question that is ungraded; the full item comes back blank and is credited', () => {
  const h = mount([ch({ question: 'What date is the third Wednesday of January 2025?', month: 1, year: 2025, correctAnswer: '15',
    options: ['8', '15', '22', '29'], highlightDates: [15] })], 'identify');
  expect(levers(h).map(l => l.id)).toEqual([TINT_LEVER, SIMPLER_LEVER]);
  fireEvent.click(screen.getByTestId('date-22'));
  check();
  expect(last(h)).toMatchObject({ correct: false, miss: 'same_column_date' });
  const tint = h.dispatch('pull_lever', { lever: TINT_LEVER });
  expect(tint.status).toBe('committed');
  expect(Array.from(q(h, '[data-target-day="true"]')).map(n => n.textContent)).toEqual(['1', '8', '15', '22', '29']);
  expect(String(tint.state.task!.demand.onScreen)).toBe('Every Wednesday on the calendar is tinted.');

  // Refused (already on screen): the scene, the levers and the attempts are as they were.
  const before = { demand: JSON.stringify(h.state().task!.demand), levers: JSON.stringify(levers(h)), attempts: attempts(h).length,
    screen: h.view.container.innerHTML };
  expect(h.dispatch('pull_lever', { lever: TINT_LEVER }).status).toBe('blocked');
  expect({ demand: JSON.stringify(h.state().task!.demand), levers: JSON.stringify(levers(h)), attempts: attempts(h).length,
    screen: h.view.container.innerHTML }).toEqual(before);

  h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(h.state().task).toMatchObject({ itemId: 'c1~simpler', task: 'What date is the first Wednesday of January 2025?' });
  expect(h.state().task!.demand.practice).toMatch(/ungraded/);
  expect(levers(h)).toEqual([]);
  expect(q(h, '[data-target-day="true"]')).toHaveLength(0);
  expect(screen.getByText('Practice question')).toBeTruthy();
  fireEvent.click(screen.getByTestId('date-8'));
  check();
  expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: false });
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c1~simpler');
  fireEvent.click(screen.getByTestId('date-1'));
  check();
  expect(last(h)).toMatchObject({ itemId: 'c1~simpler', correct: true });

  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'c1', task: 'What date is the third Wednesday of January 2025?' });
  expect(screen.queryByText(/Selected:/)).toBeNull();
  expect(screen.queryByText('Practice question')).toBeNull();
  expect(q(h, '[data-target-day="true"]')).toHaveLength(5);
  fireEvent.click(screen.getByTestId('date-15'));
  check();
  expect(attempts(h).map(a => [a.itemId, a.correct, !!a.practice])).toEqual([
    ['c1', false, false], ['c1~simpler', false, true], ['c1~simpler', true, true], ['c1', true, false]]);
  expect(last(h)).toMatchObject({ assisted: true, levers: [TINT_LEVER, SIMPLER_LEVER] });
  h.close();
});

it('count at hard: the tint comes back as a lever; ticks are the learner\'s own, never placed by the activity', () => {
  const h = mount([ch({ type: 'count', question: 'How many Fridays are in October 2025?', month: 10, correctAnswer: '5',
    options: ['4', '5', '6', '7'], targetDayOfWeek: 'Friday', showDayHeaders: false, showMonthLabel: false, showTargetDayColumn: false })],
  'count', { supportTier: 'hard' });
  expect(levers(h).map(l => l.id)).toEqual([TINT_LEVER, TICKS_LEVER, 'day_headers', SIMPLER_LEVER]);
  expect(q(h, '[data-target-day="true"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: TINT_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-target-day="true"]')).toHaveLength(5);
  expect(String(receipt.state.task!.demand.shown)).toContain('every Friday tinted');
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/"5"|five/);

  fireEvent.click(screen.getByTestId('date-3'));
  expect(q(h, '[data-lever="tick"]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: TICKS_LEVER });
  expect(q(h, '[data-lever="tick"]')).toHaveLength(0);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/only the learner's taps make ticks/);
  fireEvent.click(screen.getByTestId('date-3'));
  fireEvent.click(screen.getByTestId('date-10'));
  expect(q(h, '[data-lever="tick"]')).toHaveLength(2);
  fireEvent.click(screen.getByTestId('date-10'));
  expect(q(h, '[data-lever="tick"]')).toHaveLength(1);
  fireEvent.click(screen.getByTestId('option-5'));
  check();
  expect(last(h)).toMatchObject({ correct: true, levers: [TINT_LEVER, TICKS_LEVER] });
  h.close();
});

it('days forward: the week strip from the start day, only the start marked', () => {
  const h = mount([ch({ type: 'day_offset', question: 'Start on Tuesday. Count forward 3 days. What day do you land on?',
    correctAnswer: 'Friday', options: [...WEEKDAYS], startDay: 'Tuesday', offsetDays: 3 })], 'day_offset');
  fireEvent.click(screen.getByTestId('option-Thursday'));
  check();
  expect(last(h)).toMatchObject({ miss: 'day_before' });
  const receipt = h.dispatch('pull_lever', { lever: STRIP_LEVER });
  const strip = q(h, '[data-lever="week-strip"] span');
  expect(Array.from(strip).map(n => n.textContent)).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday']);
  expect(q(h, '[data-strip-start="true"]')).toHaveLength(1);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/Friday/);
  h.close();
});

it('easy starts with the help shown, and that is not a pull', () => {
  const h = mount([ch({ type: 'mark_events', question: 'Mark Library Day on March 11.', correctAnswer: '11', eventLabel: 'Library Day',
    markedDates: [] })], 'mark_events', { supportTier: 'easy' });
  expect(levers(h).find(l => l.id === ROWS_LEVER)!.pulled).toBe(true);
  expect(Array.from(q(h, '[data-lever="row-range"]')).map(n => n.textContent)).toEqual(['2–8', '9–15', '16–22', '23–29', '30–31']);
  fireEvent.click(screen.getByTestId('date-11'));
  check();
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});

it('the day chain: the model pair is two other days, and the next answer records it', () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const h = mount(Array.from({ length: 5 }, (_, i) => ch({ id: `day-${i + 1}`, type: 'day_sequence', correctAnswer: days[i + 1],
    currentDay: days[i], expectedDay: days[i + 1], chainPosition: i + 1 })), 'day_sequence', { gradeBand: 'K' });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[MODEL_PAIR_LEVER, false]]);
  h.say('Monday'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  const receipt = h.dispatch('pull_lever', { lever: MODEL_PAIR_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="model-pair"]')[0].textContent).toBe('📅 Saturday→📅 Sunday');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Saturday, then Sunday/);
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/Tuesday/);
  h.say('Tuesday'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'day-1', correct: true, levers: [MODEL_PAIR_LEVER] });
  // A new turn: the card is gone and the lever is open again.
  expect(q(h, '[data-lever="model-pair"]')).toHaveLength(0);
  expect(levers(h).map(l => l.pulled)).toEqual([false]);
  h.close();
});
