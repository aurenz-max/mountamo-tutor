// @vitest-environment jsdom
/**
 * Time sequencer on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { LIVE_JOURNEYS } from '../../../components/live-activity/liveJourneySpec';
import { getComponentById } from '../../../service/manifest/catalog';
import type { TimeSequencerChallenge, TimeSequencerData } from './TimeSequencer';
import { EMPTY_TIME_VIEW, timeSequencerMiss } from './timeSequencerWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const ev = (id: string, label: string, extra: Record<string, unknown> = {}) => ({ id, label, emoji: '🙂', ...extra });
const DAY = [ev('w', 'Wake up', { clockHour: 7 }), ev('b', 'Eat breakfast', { clockHour: 8 }), ev('s', 'Go to school', { clockHour: 9 }),
  ev('l', 'Eat lunch', { clockHour: 12 }), ev('h', 'Go home', { clockHour: 3 })];

/** One hand-built challenge per catalog mode. */
const CHALLENGES: Record<string, TimeSequencerChallenge> = {
  'sequence-3': { id: 'q3', type: 'sequence-events', instruction: 'Put the morning in order.', events: DAY.slice(0, 3), correctOrder: ['w', 'b', 's'] },
  'time-of-day': { id: 't', type: 'match-time-of-day', instruction: 'When do you eat breakfast?', event: DAY[1], correctPeriod: 'morning' },
  'sequence-5': { id: 'q5', type: 'sequence-events', instruction: 'Put the day in order.', events: DAY, correctOrder: ['w', 'b', 's', 'l', 'h'] },
  'before-after': { id: 'ba', type: 'before-after', instruction: 'What happens before school?', referenceEvent: DAY[2], relation: 'before',
    options: [ev('o1', 'Eat breakfast'), ev('o2', 'Eat dinner'), ev('o3', 'Go to bed')], correctEvent: 'o1' },
  'duration-compare': { id: 'd', type: 'duration-compare', instruction: 'Which takes longer?', eventA: ev('a', 'Brush teeth'),
    eventB: ev('b', 'A school day'), correctAnswer: 'B' },
  'clock-sequence': { id: 'c', type: 'clock-sequence', instruction: 'Look at the clocks and put the morning in order.',
    events: DAY.slice(0, 3), correctOrder: ['w', 'b', 's'], showClockFace: true },
  'read-schedule': { id: 'r', type: 'read-schedule', instruction: 'What happens at 10:00?', targetTime: '10:00',
    schedule: [{ time: '8:00', activity: 'Reading', emoji: '📖' }, { time: '10:00', activity: 'Math', emoji: '➕' },
      { time: '12:00', activity: 'Lunch', emoji: '🥪' }], activityOptions: ['Reading', 'Math', 'Lunch', 'Recess'], correctActivity: 'Math' },
};
const MODES = (getComponentById('time-sequencer')?.evalModes ?? []).map(m => m.evalMode);
const data = (challenges: TimeSequencerChallenge[], gradeBand: TimeSequencerData['gradeBand'] = '1') =>
  ({ title: 'Time', gradeBand, challenges }) as unknown as Record<string, unknown>;

/** The journey row's own inputs, through the real buttons. */
function perform(h: ReturnType<typeof mountWorkspace>, d: Record<string, unknown>, intent: 'wrong' | 'correct') {
  const inputs = LIVE_JOURNEYS['time-sequencer'].inputsFor(intent, { itemId: h.state().task!.itemId, data: d } as never);
  for (const input of inputs) {
    if (input.type === 'choose') h.press(input.label);
    else if (input.type === 'check') h.press(/check/i);
  }
}

it('every catalog mode has a hand-built challenge', () => {
  expect(MODES.sort()).toEqual(Object.keys(CHALLENGES).sort());
});

it.each(Object.keys(CHALLENGES))('%s: a checked tap that publishes no key; a wrong one names its miss, Try again clears it, the right one completes once',
  async mode => {
    const c = CHALLENGES[mode];
    const d = data([c]);
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'time-sequencer', evalMode: mode, data: d });
    const task = h.state().task!;
    expect(task.task).toBe(c.instruction);
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    const published = JSON.stringify(task);
    expect(published).not.toMatch(/correctOrder|correctPeriod|correctEvent|correctAnswer|correctActivity|clockHour/);
    // Cards are listed alphabetically, not in the day's order.
    if (c.events) expect(task.demand).toMatchObject({ cards: c.events.map(e => e.label).sort().join(', ') });
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/next challenge/i);

    perform(h, d, 'wrong');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    const miss = h.state().task!.workspace!.attempts.at(-1)?.miss;
    expect(getComponentById('time-sequencer')!.teachingWorkspace!.misses![mode]).toContain(miss);
    // Closed until Try again.
    const check = Array.from(h.view.container.querySelectorAll('button')).find(b => /check/i.test(b.textContent ?? ''));
    expect(check?.disabled).toBe(true);
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/^No /);

    perform(h, d, 'correct');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a pre-placed first card returns after Try again, and the tutor is told it is placed', () => {
  const c = { ...CHALLENGES['sequence-5'], prelabelFirstSlot: true };
  const d = data([c]);
  const h = mountWorkspace({ primitiveId: 'time-sequencer', evalMode: 'sequence-5', data: d });
  expect(h.state().task!.demand).toMatchObject({ startHere: expect.any(String), learnerWork: 'Placed in order: Wake up; 4 cards not placed yet' });
  perform(h, d, 'wrong');
  expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe('out_of_order');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Placed in order: Wake up; 4 cards not placed yet' });
  perform(h, d, 'correct');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('clock-sequence never names the hours to the tutor', () => {
  const h = mountWorkspace({ primitiveId: 'time-sequencer', evalMode: 'clock-sequence', data: data([CHALLENGES['clock-sequence']], 'K') });
  const facts = JSON.stringify(h.state().task!.demand);
  expect(facts).toContain('analog clock face');
  expect(facts).not.toMatch(/\b[789]\b|o'clock/);
});

it('nothing advances on a clock after a right answer', () => {
  const d = data([CHALLENGES['time-of-day'], { ...CHALLENGES['time-of-day'], id: 't2' }]);
  const h = mountWorkspace({ primitiveId: 'time-sequencer', evalMode: 'time-of-day', data: d });
  perform(h, d, 'correct');
  h.settle(30000);
  expect(h.state().task!.itemId).toBe('t');
});

it('timeSequencerMiss names each type\'s signature error', () => {
  const v = EMPTY_TIME_VIEW;
  const q5 = CHALLENGES['sequence-5'];
  expect(timeSequencerMiss(q5, { ...v, order: ['h', 'l', 's', 'b', 'w'] })).toBe('reversed');
  expect(timeSequencerMiss(q5, { ...v, order: ['w', 's', 'b', 'l', 'h'] })).toBe('swapped_pair');
  expect(timeSequencerMiss(q5, { ...v, order: ['b', 's', 'w', 'l', 'h'] })).toBe('wrong_first');
  expect(timeSequencerMiss(q5, { ...v, order: ['w', 's', 'l', 'b', 'h'] })).toBe('out_of_order');
  expect(timeSequencerMiss(q5, { ...v, order: ['w', 'b', 's', 'l', 'h'] })).toBeUndefined();
  const tod = CHALLENGES['time-of-day'];
  expect(timeSequencerMiss(tod, { ...v, period: 'afternoon' })).toBe('next_period');
  expect(timeSequencerMiss(tod, { ...v, period: 'night' })).toBe('next_period');
  expect(timeSequencerMiss(tod, { ...v, period: 'evening' })).toBe('far_period');
  const dur = CHALLENGES['duration-compare'];
  expect(timeSequencerMiss(dur, { ...v, duration: 'same' })).toBe('said_same');
  expect(timeSequencerMiss(dur, { ...v, duration: 'A' })).toBe('shorter_one');
  expect(timeSequencerMiss({ ...dur, correctAnswer: 'same' }, { ...v, duration: 'A' })).toBe('missed_same');
  const rs = CHALLENGES['read-schedule'];
  expect(timeSequencerMiss(rs, { ...v, activity: 'Lunch' })).toBe('next_row');
  expect(timeSequencerMiss(rs, { ...v, activity: 'Recess' })).toBe('not_on_schedule');
  expect(timeSequencerMiss({ ...rs, targetTime: '8:00', correctActivity: 'Reading' }, { ...v, activity: 'Lunch' })).toBe('other_row');
});

it('the adapter refuses a challenge its check cannot answer', () => {
  const validate = LIVE_ADAPTERS['time-sequencer'].validate;
  expect(() => validate(data([CHALLENGES['sequence-3']]))).not.toThrow();
  expect(() => validate(data([{ ...CHALLENGES['sequence-3'], correctOrder: ['w', 'b'] }]))).toThrow();
  expect(() => validate(data([{ ...CHALLENGES['before-after'], correctEvent: 'nope' }]))).toThrow();
  expect(() => validate(data([{ ...CHALLENGES['read-schedule'], correctActivity: 'Art' }]))).toThrow();
  expect(() => validate(data([{ ...CHALLENGES['clock-sequence'], events: DAY.slice(0, 3).map(e => ({ ...e, clockHour: undefined })) }]))).toThrow();
});
