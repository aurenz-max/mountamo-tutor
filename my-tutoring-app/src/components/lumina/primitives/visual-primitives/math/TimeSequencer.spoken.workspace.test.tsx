// @vitest-environment jsdom
/**
 * Time sequencer answered aloud (ROLLOUT.md VB-1): a one-choice challenge (time of day, before/after, which takes
 * longer, the activity at a schedule time) is a SAY_OR_SHOW item on the boss (`timeSequencer.boss.ts`) that still
 * takes the tap. The observer credits a spoken answer from the tutor's feedback; the tap stays checked by the
 * activity. Putting cards in order stays tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { TimeSequencerChallenge } from './TimeSequencer';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { timeAsk, timeKey, timeSpokenMisses } from './timeSequencerWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const ev = (id: string, label: string) => ({ id, label, emoji: '🙂' });
const TIME: TimeSequencerChallenge = { id: 't', type: 'match-time-of-day', instruction: 'When do you eat breakfast?',
  event: ev('b', 'Eat breakfast'), correctPeriod: 'morning' };
const BEFORE: TimeSequencerChallenge = { id: 'ba', type: 'before-after', instruction: 'What happens before school?',
  referenceEvent: ev('s', 'Go to school'), relation: 'before',
  options: [ev('o1', 'Eat breakfast'), ev('o2', 'Eat dinner'), ev('o3', 'Go to bed')], correctEvent: 'o1' };
const LONGER: TimeSequencerChallenge = { id: 'd', type: 'duration-compare', instruction: 'Which takes longer?',
  eventA: ev('a', 'Brush teeth'), eventB: ev('b', 'A school day'), correctAnswer: 'B' };
const SCHEDULE: TimeSequencerChallenge = { id: 'r', type: 'read-schedule', instruction: 'What happens at 10:00?', targetTime: '10:00',
  schedule: [{ time: '8:00', activity: 'Board the big yellow bus', emoji: '🚌' }, { time: '10:00', activity: 'Explore the dinosaur fossils', emoji: '🦕' },
    { time: '12:00', activity: 'Eat packed lunches', emoji: '🥪' }],
  activityOptions: ['Board the big yellow bus', 'Explore the dinosaur fossils', 'Eat packed lunches', 'Recess'],
  correctActivity: 'Explore the dinosaur fossils' };

/** One spoken challenge per converted mode, with a wrong and a right spoken answer and the tap that is right. */
const SPOKEN: Array<[string, TimeSequencerChallenge, string, string, string]> = [
  ['time-of-day', TIME, 'in the afternoon', 'in the morning', 'Morning'],
  ['before-after', BEFORE, 'eat dinner', 'breakfast', 'Eat breakfast'],
  ['duration-compare', LONGER, 'the same', 'the school day', 'A school day'],
  ['read-schedule', SCHEDULE, 'the bus', 'the dinosaurs', 'Explore the dinosaur fossils'],
];
const data = (challenges: TimeSequencerChallenge[]) => ({ title: 'Time', gradeBand: '1', challenges }) as unknown as Record<string, unknown>;
const mount = (mode: string, challenges: TimeSequencerChallenge[]) =>
  mountWorkspace({ primitiveId: 'time-sequencer', evalMode: mode, data: data(challenges) });

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (mode, c, wrong, right) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  expect(JSON.stringify(task)).not.toMatch(/correctPeriod|correctEvent|correctAnswer|correctActivity/);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken answer shows the credited choice, and the next challenge still takes the tap', () => {
  const h = mount('time-of-day', [TIME, { ...TIME, id: 't2', instruction: 'When do you go to sleep?', event: ev('z', 'Go to sleep'), correctPeriod: 'night' }]);
  h.say('morning'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Picked Morning' });
  expect(screen.getByText("Yes, that's right!")).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('t2');
  h.press('Night'); h.press(/check/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it.each(SPOKEN)('%s: a tap after a spoken answer is checked by the activity and ends the pending speech', (mode, c, _wrong, right, tap) => {
  const h = mount(mode, [c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  h.press(tap); h.press(/check/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct tap is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('before-after', [BEFORE]);
  h.press('Eat breakfast'); h.press(/check/i);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengesCompleted: 1, challengesTotal: 1, totalAttempts: 1 });
});

it('putting cards in order stays tap-only with no key', () => {
  const day = [ev('w', 'Wake up'), ev('b', 'Eat breakfast'), ev('s', 'Go to school')];
  for (const [mode, type] of [['sequence-3', 'sequence-events'], ['clock-sequence', 'clock-sequence']] as const) {
    const h = mount(mode, [{ id: 'q', type, instruction: 'Put them in order.', events: day, correctOrder: ['w', 'b', 's'] }]);
    expect(h.state().task!.demand.response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    cleanup();
  }
});

it('a picture choice is asked with its whole menu; a schedule is asked as printed, and its key never in the ask', () => {
  expect(timeAsk(TIME)).toBe('When do you eat breakfast? Morning, afternoon, evening, or night?');
  expect(timeAsk(BEFORE)).toBe('What happens before school? Eat breakfast, Eat dinner, or Go to bed?');
  expect(timeAsk(LONGER)).toBe('Which takes longer? Brush teeth, A school day, or about the same?');
  expect(timeAsk(SCHEDULE)).toBe(SCHEDULE.instruction);
  expect(timeKey({ ...TIME, periodChoices: ['afternoon', 'night'], correctPeriod: 'night' })).toMatchObject({ menu: ['afternoon', 'night'],
    alsoAccept: ['in the night', 'at night', 'nighttime'] });
  expect(timeAsk({ ...TIME, periodChoices: ['afternoon', 'night'] })).toMatch(/Afternoon or night\?$/);
  expect(spokenKeyText(timeKey(LONGER)!)).toContain('"school day"');
  expect(spokenKeyText(timeKey(SCHEDULE)!)).toMatch(/"Explore the dinosaur fossils" \(also accept "fossils", "the fossils"\)/);
  expect(timeKey({ ...LONGER, correctAnswer: 'same' })!.answer).toBe('about the same');
});

it('every spoken miss is one the catalog lists for its mode, and none is the answer', () => {
  const lists = getComponentById('time-sequencer')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const cases: Array<[string, TimeSequencerChallenge, string]> = [
    ...SPOKEN.map(([m, c, , , tap]) => [m, c, tap] as [string, TimeSequencerChallenge, string]),
    ['time-of-day', { ...TIME, correctPeriod: 'night' }, 'night'],
    ['duration-compare', { ...LONGER, correctAnswer: 'same' }, 'the same'],
    ['duration-compare', { ...LONGER, correctAnswer: 'A' }, 'Brush teeth'],
    ['read-schedule', { ...SCHEDULE, targetTime: '8:00', correctActivity: 'Board the big yellow bus' }, 'Board the big yellow bus'],
  ];
  for (const [mode, c, key] of cases) {
    const misses = timeSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) {
      expect(lists[mode]).toContain(m.id);
      for (const e of m.examples ?? []) expect(e.toLowerCase()).not.toBe(key.toLowerCase());
    }
  }
  expect(timeSpokenMisses(SCHEDULE).map(m => m.id)).toEqual(['next_row', 'not_on_schedule']);
});
