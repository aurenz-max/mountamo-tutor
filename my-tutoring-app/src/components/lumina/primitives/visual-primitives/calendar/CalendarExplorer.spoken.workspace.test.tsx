// @vitest-environment jsdom
/**
 * Calendar explorer answered aloud (ROLLOUT.md VB-1): a grid question whose answer is one weekday, date or count is a
 * spoken item that still takes the tap. The observer credits a spoken answer from the tutor's feedback; the tap stays
 * checked by the activity. Marking an event stays tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CalendarExplorerChallenge } from './CalendarExplorer';
import { calendarGridSpokenMisses } from './calendarExplorerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

const base = (over: Partial<CalendarExplorerChallenge>): CalendarExplorerChallenge => ({
  id: 'c1', type: 'identify', question: 'Calendar question', month: 3, year: 2025, correctAnswer: '11',
  options: [], hint: 'Use the calendar.', narration: 'Try it.', ...over,
});
/** One spoken challenge per converted mode, with a wrong and a right spoken answer. */
const SPOKEN: Array<[string, CalendarExplorerChallenge, string, string]> = [
  ['identify', base({ id: 'w1', question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday',
    options: ['Thursday', 'Friday', 'Saturday', 'Sunday'], highlightDates: [15] }), 'Friday', "it's a Saturday"],
  ['identify', base({ id: 'd1', question: 'What date is the second Tuesday of March 2025?', correctAnswer: '11',
    options: ['4', '11', '18', '25'], highlightDates: [11] }), 'the eighteenth', 'the eleventh'],
  ['count', base({ id: 'n1', type: 'count', question: 'How many Fridays are in October 2025?', month: 10, correctAnswer: '5',
    options: ['4', '5', '6', '7'], targetDayOfWeek: 'Friday' }), 'four', 'five Fridays'],
  ['pattern', base({ id: 'p1', type: 'pattern', question: 'March 3, 2025 is a Monday. What day of the week is March 17, 2025?',
    correctAnswer: 'Monday', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday'] }), 'Tuesday', 'Monday'],
  ['day_offset', base({ id: 'o1', type: 'day_offset', question: 'Start on Tuesday. Count forward 3 days. What day do you land on?',
    correctAnswer: 'Friday', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    startDay: 'Tuesday', offsetDays: 3 }), 'Tuesday', 'Friday'],
  ['interval_count', base({ id: 'i1', type: 'interval_count', question: 'How many days are between March 4 and March 9? Do not count the two marked days.',
    correctAnswer: '4', options: ['3', '4', '5', '6'], markedDates: [4, 9], intervalStartDate: 4, intervalEndDate: 9,
    countConvention: 'between' }), 'five', 'four days'],
];
const data = (challenges: CalendarExplorerChallenge[]) => ({ title: 'Calendar Explorer', gradeBand: '1', challenges });
const mount = (mode: string, challenges: CalendarExplorerChallenge[]) =>
  mountWorkspace({ primitiveId: 'calendar-explorer', evalMode: mode, data: data(challenges), instanceId: 'calendar' });

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (mode, c, wrong, right) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // The ask is the question; the key reaches the judge only.
  expect(task.task).toBe(c.question);
  expect(String(task.demand.constraints ?? '')).not.toContain(c.correctAnswer);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken answer shows the credited day, and the next question still takes the tap', () => {
  const [, first] = SPOKEN[0], [, next] = SPOKEN[1];
  const h = mount('identify', [first, next]);
  h.say('Saturday'); h.feedback('correct');
  expect(screen.getByText('Correct!')).toBeTruthy();
  expect(screen.getByTestId('date-15').className).toContain('emerald');
  expect(screen.getByTestId('option-Saturday').className).toContain('blue');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('d1');
  fireEvent.click(screen.getByTestId('date-11'));
  check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a tap after a spoken answer is checked by the activity and ends the pending speech', () => {
  const h = mount('count', [SPOKEN[2][1]]);
  h.say('five');
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  fireEvent.click(screen.getByTestId('option-5'));
  check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct tap is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('count', [SPOKEN[2][1]]);
  fireEvent.click(screen.getByTestId('option-5'));
  check();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ questionsCorrect: 1, questionsTotal: 1, attemptsCount: 1 });
});

it('marking an event stays tap-only with no key', () => {
  const h = mount('mark_events', [base({ id: 'm1', type: 'mark_events', question: 'Mark Library Day on March 11.',
    eventLabel: 'Library Day', markedDates: [] })]);
  expect(h.state().task!.demand.response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
});

it('every spoken miss is one the catalog lists for its mode, and none is the answer', () => {
  const lists = getComponentById('calendar-explorer')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const cases: Array<[string, CalendarExplorerChallenge]> = [...SPOKEN.map(([m, c]) => [m, c] as [string, CalendarExplorerChallenge]),
    // A one-day offset: the start day is the day before, named once as start_day.
    ['day_offset', base({ type: 'day_offset', correctAnswer: 'Wednesday', startDay: 'Tuesday', offsetDays: 1 })],
    ['day_offset', base({ type: 'day_offset', correctAnswer: 'Tuesday', startDay: 'Tuesday', offsetDays: 7 })],
    ['identify', base({ correctAnswer: '1' })], ['identify', base({ correctAnswer: '31' })],
    ['pattern', base({ type: 'pattern', correctAnswer: 'March 17' })],
    ['interval_count', base({ type: 'interval_count', correctAnswer: '1' })]];
  for (const [mode, c] of cases) {
    const misses = calendarGridSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) {
      expect(lists[mode]).toContain(m.id);
      for (const e of m.examples ?? []) expect(e.toLowerCase()).not.toBe(c.correctAnswer.toLowerCase());
    }
  }
  expect(calendarGridSpokenMisses(base({ type: 'day_offset', correctAnswer: 'Wednesday', startDay: 'Tuesday', offsetDays: 1 }))
    .map(m => m.id)).toEqual(['start_day', 'day_after', 'other_day']);
});
