// @vitest-environment jsdom
/**
 * Calendar explorer on the teaching workspace. The render pins the runner-era and click-era suites
 * held are re-based onto the real runtime (support tiers, the K band floor, the today marker, the
 * day-name identify defect, the extended mode surfaces, the spoken chain with no printed names),
 * plus the binding's own: the grid key never reaches the tutor, a checked miss waits for Try again,
 * the scene follows the active challenge with its tier's reveal policy, completion is once.
 * The generic W1 contract (runtime/workspaceContract.test.tsx) covers ownership and the packet.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { isGridAnswerChallenge, tutorRevealPolicy, type CalendarExplorerChallenge } from './CalendarExplorer';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const base = (over: Partial<CalendarExplorerChallenge>): CalendarExplorerChallenge => ({
  id: 'c1', type: 'identify', question: 'Calendar question', month: 3, year: 2025, correctAnswer: '11',
  options: ['9', '10', '11', '12'], hint: 'Use the calendar.', narration: 'Try it.', ...over,
});
const count = (over: Partial<CalendarExplorerChallenge> = {}) => base({ id: 'n1', type: 'count',
  question: 'How many Fridays are in October 2025?', month: 10, correctAnswer: '5', options: ['4', '5', '6', '7'],
  targetDayOfWeek: 'Friday', ...over });
const dateIdentify = (over: Partial<CalendarExplorerChallenge> = {}) => base({ id: 'i2',
  question: 'What date is the second Tuesday of March 2025?', options: ['4', '11', '18', '25'], highlightDates: [11], ...over });
const dayNameIdentify = () => base({ id: 'i1', question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday',
  options: ['Thursday', 'Friday', 'Saturday', 'Sunday'], highlightDates: [15] });
const data = (challenges: CalendarExplorerChallenge[], over: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ title: 'Calendar Explorer', gradeBand: '1', challenges, ...over });
const mount = (d: Record<string, unknown>, mode = 'identify') =>
  mountWorkspace({ primitiveId: 'calendar-explorer', evalMode: mode, data: d, instanceId: 'calendar' });
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
const headers = () => screen.queryAllByTestId('day-header');
const tinted = () => document.querySelectorAll('[data-target-day="true"]');

describe('the grid on the workspace', () => {
  it.each(['identify', 'mark_events', 'count', 'pattern', 'day_offset', 'interval_count'])('%s binds and its key never reaches the tutor', mode => {
    const c = mode === 'day_offset' ? base({ type: 'day_offset', correctAnswer: 'Friday', options: ['Thursday', 'Friday'], startDay: 'Tuesday', offsetDays: 3 })
      : mode === 'count' ? count() : base({ type: mode as CalendarExplorerChallenge['type'] });
    const d = data([c]);
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'calendar-explorer', pin: mode, objectiveIds: ['o'], data: d })).not.toBeNull();
    const h = mount(d, mode);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(h.state().task!.task).toBe(c.question);
    expect(screen.queryByRole('button', { name: /Next Question|See Results/ })).toBeNull();
  });

  it('a wrong check closes the item until Try again; a right one completes once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(data([count(), dateIdentify()]), 'mixed');
    fireEvent.click(screen.getByTestId('option-7'));
    check();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.lastResponse?.response).toBe('Picked "7".');
    expect(screen.queryByText(/The answer is/)).toBeNull();
    h.dispatch('retry'); h.confirmVisible();
    expect(screen.queryByText('Not quite.')).toBeNull();
    fireEvent.click(screen.getByTestId('option-5'));
    check();
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    // The scene follows the active challenge.
    expect(h.state().task!.task).toBe('What date is the second Tuesday of March 2025?');
    fireEvent.click(screen.getByTestId('date-11'));
    check();
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
    expect(seam.submit).toHaveBeenCalledOnce();
  });

  it('the scene carries the tier reveal policy, never the answer', () => {
    const h = mount(data([count({ showDayHeaders: false, showMonthLabel: false, showTargetDayColumn: false })], { supportTier: 'hard' }), 'count');
    const facts = h.state().task!.demand;
    expect(String(facts.revealPolicy)).toMatch(/Do NOT recite the Sun, Mon, Tue/);
    expect(String(facts.shown)).toContain('no day-name header row');
    expect(JSON.stringify(facts)).not.toMatch(/"5"|five/);
  });
});

describe('support tiers render', () => {
  it('LEGACY DEFAULT: an unstamped payload renders the full help', () => {
    mount(data([count()]), 'count');
    expect(headers()).toHaveLength(7);
    expect(screen.getByTestId('month-label').textContent).toContain('October 2025');
    expect(Array.from(tinted()).map(n => n.textContent)).toEqual(['3', '10', '17', '24', '31']);
  });

  it('HARD withdraws headers, caption and tint; MEDIUM only the caption', () => {
    mount(data([count({ showDayHeaders: false, showMonthLabel: false, showTargetDayColumn: false })], { supportTier: 'hard' }), 'count');
    expect(headers()).toHaveLength(0);
    expect(screen.queryByTestId('month-label')).toBeNull();
    expect(tinted()).toHaveLength(0);
    cleanup();
    mount(data([count({ showDayHeaders: true, showMonthLabel: false, showTargetDayColumn: true })], { supportTier: 'medium' }), 'count');
    expect(headers()).toHaveLength(7);
    expect(screen.queryByTestId('month-label')).toBeNull();
    expect(tinted()).toHaveLength(5);
  });

  it('K BAND FLOOR: a pre-reader keeps every scaffold even if stamped off', () => {
    mount(data([count({ showDayHeaders: false, showMonthLabel: false, showTargetDayColumn: false })], { gradeBand: 'K', supportTier: 'hard' }), 'count');
    expect(headers()).toHaveLength(7);
    expect(screen.getByTestId('month-label')).toBeTruthy();
    expect(tinted()).toHaveLength(5);
  });

  it('withdrawal is per challenge: the next challenge reads its own stamps', () => {
    const h = mount(data([dateIdentify({ showDayHeaders: true }), count({ showDayHeaders: false, showMonthLabel: false, showTargetDayColumn: false })],
      { supportTier: 'hard' }), 'mixed');
    expect(headers()).toHaveLength(7);
    fireEvent.click(screen.getByTestId('date-11'));
    check();
    h.dispatch('advance'); h.confirmVisible();
    expect(headers()).toHaveLength(0);
  });

  it('the reveal policy text is unchanged', () => {
    expect(tutorRevealPolicy(undefined)).toBe('');
    expect(tutorRevealPolicy('hard')).toMatch(/Do NOT recite the Sun, Mon, Tue/);
  });
});

describe('answer surfaces', () => {
  it('classifies the answer surface by the shape of correctAnswer', () => {
    expect(isGridAnswerChallenge(dateIdentify())).toBe(true);
    expect(isGridAnswerChallenge(dayNameIdentify())).toBe(false);
    expect(isGridAnswerChallenge(count())).toBe(false);
  });

  it('a day-name identify answers from its options, and a grid click does not poison it', () => {
    const h = mount(data([dayNameIdentify(), count()]));
    fireEvent.click(screen.getByTestId('date-15'));
    expect((screen.getByRole('button', { name: 'Check Answer' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('option-Saturday'));
    check();
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('a date identify keeps the grid as the answer (no options)', () => {
    mount(data([dateIdentify(), count()]));
    expect(screen.queryByTestId('option-11')).toBeNull();
    fireEvent.click(screen.getByTestId('date-11'));
    expect(screen.getByText(/Selected:/)).toBeTruthy();
  });

  it('days forward shows the start card and choices, with no month grid', () => {
    mount(data([base({ type: 'day_offset', question: 'Start on Tuesday. Count forward 3 days.', correctAnswer: 'Friday',
      options: ['Monday', 'Friday'], startDay: 'Tuesday', offsetDays: 3 })]), 'day_offset');
    expect(screen.getByTestId('day-offset-surface').textContent).toContain('Tuesday');
    expect(screen.getByLabelText('3 steps forward')).toBeTruthy();
    expect(screen.queryByTestId('calendar-grid')).toBeNull();
  });

  it('mark events places a named marker from a calendar tap', () => {
    const h = mount(data([base({ type: 'mark_events', question: 'Mark Library Day on March 11.', options: [], eventLabel: 'Library Day', markedDates: [] })]), 'mark_events');
    fireEvent.click(screen.getByTestId('date-11'));
    expect(screen.getByLabelText('Library Day marker placed')).toBeTruthy();
    check();
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('an interval shows both marked endpoints before the attempt', () => {
    mount(data([base({ type: 'interval_count', question: 'How many days are between March 4 and March 9? Do not count the two marked days.',
      correctAnswer: '4', options: ['3', '4', '5'], markedDates: [4, 9], intervalStartDate: 4, intervalEndDate: 9, countConvention: 'between' })]), 'interval_count');
    expect(screen.getByTestId('date-4').getAttribute('data-marked')).toBe('true');
    expect(screen.getAllByLabelText('marked event')).toHaveLength(2);
  });

  it('marks today on its cell only, and keeps it while the child selects', () => {
    mount(data([dateIdentify({ id: 't1', question: 'The ⭐ shows today. Tap tomorrow.', correctAnswer: '13', todayDate: 12, highlightDates: [13] })]));
    expect(screen.getByTestId('date-12').getAttribute('data-today')).toBe('true');
    expect(screen.getByTestId('date-13').getAttribute('data-today')).toBeNull();
    fireEvent.click(screen.getByTestId('date-13'));
    expect(screen.getByTestId('date-12').getAttribute('data-today')).toBe('true');
  });
});

describe('the spoken chain', () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const chain = (n = 5) => Array.from({ length: n }, (_, i) => base({ id: `day-${i + 1}`, type: 'day_sequence',
    question: 'Listen, then say the day that comes next.', correctAnswer: days[i + 1], options: [],
    currentDay: days[i], expectedDay: days[i + 1], chainPosition: i + 1 }));

  it('prints no day names; the successor is the spoken key; the tutor is told which day to say', () => {
    const d = data(chain(), { gradeBand: 'K' });
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'calendar-explorer', pin: 'day_sequence', objectiveIds: ['o'], data: d })).not.toBeNull();
    const h = mount(d, 'day_sequence');
    expect(screen.getByTestId('calendar-day-sequence')).toBeTruthy();
    for (const day of ['Sunday', ...days]) expect(screen.queryByText(day, { exact: true })).toBeNull();
    expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^Tuesday\./);
    expect(h.state().task!.demand.say).toBe('the day Monday');
  });

  it('a wrong successor reopens; five right ones complete once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(data(chain(), { gradeBand: 'K' }), 'day_sequence');
    h.say('Monday'); h.feedback('incorrect', 'retry'); h.confirmVisible();
    expect(h.state().task!.itemId).toBe('day-1');
    for (let i = 0; i < 5; i++) { h.say(days[i + 1]); h.feedback('correct', 'advance'); h.confirmVisible(); }
    expect(h.state().status).toBe('completed');
    await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
    expect(seam.submit).toHaveBeenCalledOnce();
  });

  it('the replay button asks silently, as the host, never the answer', () => {
    mount(data(chain(), { gradeBand: 'K' }), 'day_sequence');
    fireEvent.click(screen.getByRole('button', { name: 'Hear the question again' }));
    const [text, options] = seam.send.mock.calls.at(-1)!;
    expect(text).toContain('Listen: Monday.');
    expect(text).not.toMatch(/Tuesday/);
    expect(options).toMatchObject({ silent: true, author: 'host' });
  });

  it('a month chain prints no month names', () => {
    const names = ['November', 'December', 'January', 'February', 'March', 'April'];
    mount(data(Array.from({ length: 5 }, (_, i) => base({ id: `m${i + 1}`, type: 'month_sequence', options: [],
      correctAnswer: names[i + 1], currentMonth: names[i], expectedMonth: names[i + 1], chainPosition: i + 1 }))), 'month_sequence');
    expect(screen.getByTestId('calendar-month-sequence')).toBeTruthy();
    for (const month of names) expect(screen.queryByText(month, { exact: true })).toBeNull();
  });
});

it('the adapter refuses a spoken turn with no day to say', () => {
  const adapter = LIVE_ADAPTERS['calendar-explorer'];
  expect(() => adapter.validate(data([base({ type: 'day_sequence', options: [] })]))).toThrow();
  expect(adapter.validate(data([count()]))).toBeTruthy();
});
