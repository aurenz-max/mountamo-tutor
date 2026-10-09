// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real AnalogClock on the shared teaching workspace, mounted the way a lesson
 * mounts it. The activity's own check commits a checked gesture with its named miss; the runtime owns progression;
 * the scored session is what gets submitted. The tutor is never handed the time on the dial, the right option or
 * which hand is asked for.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { AnalogClockData, ClockChallenge } from './AnalogClock';
import { clockMiss, timeMiss, type ClockView } from './analogClockWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const CHALLENGES: Record<string, ClockChallenge> = {
  hand_name: { id: 'h', type: 'hand_name', instruction: 'Touch the hand that tells us the hour.', targetHour: 4, targetMinute: 30,
    targetHand: 'hour', hint: 'One hand is short and one is long.' },
  count_face: { id: 'c', type: 'count_face', instruction: 'Touch the numbers all the way round the clock. Start at 1.',
    targetHour: 3, targetMinute: 0, hint: 'After 1 comes 2.' },
  hear_time: { id: 'e', type: 'hear_time', instruction: "Which clock shows two o'clock?", targetHour: 2, targetMinute: 0,
    option0: '5:00', option1: '2:00', option2: '1:00', option3: '3:00', correctOptionIndex: 1, hint: 'Look at the short hand.' },
  read: { id: 'r', type: 'read', instruction: 'What time does the clock show?', targetHour: 3, targetMinute: 30,
    option0: '4:30', option1: '3:30', option2: '2:30', option3: '3:00', correctOptionIndex: 1, hint: 'The short hand is just past the 3.' },
  match: { id: 'm', type: 'match', instruction: 'Find the digital time for this clock.', targetHour: 7, targetMinute: 45,
    option0: '9:35', option1: '8:45', option2: '7:15', option3: '7:45', correctOptionIndex: 3, hint: 'Count by fives.' },
  set_time: { id: 's', type: 'set_time', instruction: 'Set the clock to 12:30.', targetHour: 12, targetMinute: 30, hint: 'Long hand down.' },
  elapsed: { id: 'l', type: 'elapsed', instruction: 'A movie starts at 2:00 and ends at 3:30. How long is it?', targetHour: 3, targetMinute: 30,
    startHour: 2, startMinute: 0, option0: '30 minutes', option1: '1 hour 30 minutes', option2: '2 hours 30 minutes', option3: '1 hour',
    correctOptionIndex: 1, hint: 'Count the hours, then the minutes.' },
};
/** What each mode's key looks like in words, which must not reach the tutor outside the choices on screen. */
const KEY: Record<string, RegExp> = {
  hand_name: /short (hand )?(=|is|tells).*hour|hour hand/i, count_face: /^$/, hear_time: /face 2\b|2:00/,
  read: /3:30/, match: /7:45/, set_time: /^$/, elapsed: /1 hour 30/,
};

const mount = (evalMode: string, challenges: ClockChallenge[], gradeBand: AnalogClockData['gradeBand'] = '1-2') =>
  mountWorkspace({ primitiveId: 'analog-clock', evalMode, instanceId: 'clock', data: { title: 'Clock', gradeBand, challenges } });
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const check = (h: WorkspaceHarness) => h.press(/check/i);

it.each(Object.keys(CHALLENGES))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = CHALLENGES[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // The options are on screen, so they are facts; what the dial shows and which option is right are not.
  const { timeChoices: _t, durationChoices: _d, ...rest } = demand(h);
  expect(JSON.stringify(rest)).not.toMatch(KEY[mode]);
  expect(JSON.stringify(rest)).not.toMatch(/correct/i);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.queryByRole('button', { name: /^next|finish/i })).toBeNull();
  h.close();
});

it('read: a wrong pick commits its named miss and stays closed until Try again clears it; a right one completes once and submits the miss', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('read', [CHALLENGES.read, { ...CHALLENGES.read, id: 'r2', targetHour: 6, targetMinute: 0,
    option0: '6:00', option1: '12:30', option2: '7:00', option3: '5:00', correctOptionIndex: 0 }]);
  h.press('4:30'); check(h);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'next_hour' });
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Picked 4:30');
  // No hint on screen with the tutor: a generated hint can name where the hands point.
  expect(h.view.container.textContent).not.toContain('just past the 3');
  expect((h.view.getByRole('button', { name: /check/i }) as HTMLButtonElement).disabled).toBe(true);
  h.press('3:30');
  expect(demand(h)).toMatchObject({ learnerWork: 'Picked 4:30' });
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No time picked yet' });
  h.press('3:30'); check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('r2');
  expect(demand(h)).toMatchObject({ learnerWork: 'No time picked yet' });
  h.press('6:00'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'r', phase: 'read', miss: 'next_hour' })]);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('hand_name: touching the other hand is other_hand, and Try again lets go of it', () => {
  const h = mount('hand_name', [CHALLENGES.hand_name], 'K');
  h.touch('hand-long'); check(h);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'other_hand' });
  expect(demand(h)).toMatchObject({ learnerWork: 'Touched the long hand' });
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No hand touched yet' });
  h.touch('hand-short'); check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('count_face: twelve numbers in order open Check and pass; one out of order starts again', () => {
  const h = mount('count_face', [CHALLENGES.count_face], 'K');
  h.touch('number-1'); h.touch('number-3');
  expect(demand(h)).toMatchObject({ learnerWork: 'No number touched yet' });
  for (let n = 1; n <= 12; n++) h.touch(`number-${n}`);
  expect(demand(h)).toMatchObject({ learnerWork: 'Touched 1 to 12 in order' });
  check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('set_time: the hands move by the time bar; a wrong time is named, Try again puts them back at 12:00', () => {
  const h = mount('set_time', [CHALLENGES.set_time]);
  const slider = () => h.view.getByRole('slider');
  check(h);
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_minute' });
  act(() => { fireEvent.keyDown(slider(), { key: 'PageUp' }); });
  // Closed after the check: the bar does not move the hands.
  expect(demand(h)).toMatchObject({ learnerWork: 'The hands show 12:00' });
  h.dispatch('retry');
  act(() => { fireEvent.keyDown(slider(), { key: 'PageUp' }); });
  expect(demand(h)).toMatchObject({ learnerWork: 'The hands show 12:30' });
  check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('hear_time and elapsed: a wrong face or duration names its miss', () => {
  const face = mount('hear_time', [CHALLENGES.hear_time], 'K');
  face.press('Clock face 4'); check(face);
  expect(face.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'next_hour' });
  face.close(); cleanup();
  const long = mount('elapsed', [CHALLENGES.elapsed], '3-5');
  long.press('30 minutes'); check(long);
  expect(long.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'hour_off' });
  long.close();
});

it('clockMiss names each type\'s signature error', () => {
  const view: ClockView = { selectedOption: null, pickedHand: null, countedNumerals: [], displayHour: 12, displayMinute: 0,
    minuteNumbersShown: false, handLegendShown: false, digitalEchoShown: false };
  expect(clockMiss(CHALLENGES.read, { ...view, selectedOption: 2 })).toBe('previous_hour');
  expect(clockMiss(CHALLENGES.read, { ...view, selectedOption: 3 })).toBe('wrong_minute');
  expect(clockMiss(CHALLENGES.read, { ...view, selectedOption: 1 })).toBeUndefined();
  expect(clockMiss(CHALLENGES.match, { ...view, selectedOption: 0 })).toBe('hands_swapped');
  expect(clockMiss(CHALLENGES.elapsed, { ...view, selectedOption: 2 })).toBe('hour_off');
  expect(clockMiss(CHALLENGES.elapsed, { ...view, selectedOption: 0 })).toBe('hour_off');
  expect(clockMiss(CHALLENGES.elapsed, { ...view, selectedOption: 3 })).toBe('too_short');
  expect(clockMiss(CHALLENGES.count_face, view)).toBeUndefined();
  expect(timeMiss({ hour: 9, minute: 15 }, { hour: 3, minute: 45 })).toBe('hands_swapped');
  expect(timeMiss({ hour: 3, minute: 10 }, { hour: 3, minute: 50 })).toBe('minute_as_number');
  expect(timeMiss({ hour: 1, minute: 0 }, { hour: 12, minute: 0 })).toBe('next_hour');
  expect(timeMiss({ hour: 5, minute: 20 }, { hour: 4, minute: 50 })).toBe('other_time');
});
