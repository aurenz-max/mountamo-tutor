// @vitest-environment jsdom
/**
 * Analog clock answered aloud (ROLLOUT.md VB-1): read, match and elapsed ask for one time or duration and hand_name for
 * one of two hands, so they are spoken items that still take the pick and Check. The observer credits a spoken answer
 * from the tutor's feedback; a Check stays checked by the activity. Setting the hands, counting the face and picking a
 * face on hear_time stay tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ClockChallenge } from './AnalogClock';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { clockKey, clockSpokenMisses, spokenDurationForms, spokenTimeForms } from './analogClockWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const READ: ClockChallenge = { id: 'r', type: 'read', instruction: 'What time does the clock show?', targetHour: 3, targetMinute: 30,
  option0: '4:30', option1: '3:30', option2: '2:30', option3: '3:00', correctOptionIndex: 1, hint: 'Look at the short hand.' };
const MATCH: ClockChallenge = { id: 'm', type: 'match', instruction: 'Find the digital time for this clock.', targetHour: 7, targetMinute: 45,
  option0: '9:35', option1: '8:45', option2: '7:15', option3: '7:45', correctOptionIndex: 3, hint: 'Count by fives.' };
const ELAPSED: ClockChallenge = { id: 'l', type: 'elapsed', instruction: 'A movie starts at 2:00 and ends at 3:30. How long is it?',
  targetHour: 3, targetMinute: 30, startHour: 2, startMinute: 0, option0: '30 minutes', option1: '1 hour 30 minutes',
  option2: '2 hours 30 minutes', option3: '1 hour', correctOptionIndex: 1, hint: 'Count the hours, then the minutes.' };
const HAND: ClockChallenge = { id: 'h', type: 'hand_name', instruction: 'Touch the hand that tells us the hour.', targetHour: 4,
  targetMinute: 30, targetHand: 'hour', hint: 'One hand is short and one is long.' };

const check = (h: WorkspaceHarness) => h.press(/check/i);
/** One spoken challenge per converted mode: a wrong and a right spoken answer, the right tap, and the scene's key. */
const SPOKEN: Array<[string, ClockChallenge, string, string, (h: WorkspaceHarness) => void, RegExp]> = [
  ['read', READ, 'four thirty', 'half past three', h => { h.press('3:30'); check(h); }, /3:30|half past/i],
  ['match', MATCH, 'eight forty-five', 'quarter to eight', h => { h.press('7:45'); check(h); }, /7:45|quarter to/i],
  ['elapsed', ELAPSED, 'thirty minutes', 'an hour and a half', h => { h.press('1 hour 30 minutes'); check(h); }, /1 hour 30|and a half/i],
  ['hand_name', HAND, 'the long one', 'the short one', h => { h.touch('hand-short'); check(h); }, /short (hand )?(=|is|tells).*hour|hour hand/i],
];
const mount = (mode: string, challenges: ClockChallenge[]) => mountWorkspace({ primitiveId: 'analog-clock', evalMode: mode,
  instanceId: 'clock', data: { title: 'Clock', gradeBand: mode === 'hand_name' ? 'K' : '1-2', challenges } });
/** The scene the tutor reads, without the choices printed on screen. */
const sceneText = (h: WorkspaceHarness) => {
  const { timeChoices: _t, durationChoices: _d, ...rest } = h.state().task!.demand as Record<string, unknown>;
  return JSON.stringify(rest);
};

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (mode, c, wrong, right, _tap, key) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // The scene never says the answer.
  expect(sceneText(h)).not.toMatch(key);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken time shows the credited choice, and the next challenge still takes the tap', () => {
  const h = mount('read', [READ, { ...READ, id: 'r2', targetHour: 6, targetMinute: 0,
    option0: '6:00', option1: '12:30', option2: '7:00', option3: '5:00', correctOptionIndex: 0 }]);
  h.say('half past three'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Picked 3:30' });
  expect(screen.getByText('Correct!')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('r2');
  h.press('6:00'); check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('a credited spoken hand marks that hand as touched', () => {
  const h = mount('hand_name', [HAND]);
  h.say('the short one'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Touched the short hand' });
});

it.each(SPOKEN)('%s: a Check after a spoken answer is checked by the activity and ends the pending speech', (mode, c, _wrong, right, tap) => {
  const h = mount(mode, [c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  tap(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct tap is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('match', [MATCH]);
  h.press('7:45'); check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ totalChallenges: 1, correctAnswers: 1, averageAttempts: 1 });
});

it('setting the hands, counting the face and picking a face stay tap-only with no key', () => {
  const kept: ClockChallenge[] = [
    { id: 's', type: 'set_time', instruction: 'Set the clock to 12:30.', targetHour: 12, targetMinute: 30, hint: '' },
    { id: 'c', type: 'count_face', instruction: 'Touch the numbers all the way round the clock. Start at 1.', targetHour: 3, targetMinute: 0, hint: '' },
    { id: 'e', type: 'hear_time', instruction: "Which clock shows two o'clock?", targetHour: 2, targetMinute: 0,
      option0: '5:00', option1: '2:00', option2: '1:00', option3: '3:00', correctOptionIndex: 1, hint: '' },
  ];
  for (const c of kept) {
    const h = mount(c.type, [c]);
    expect(h.state().task!.demand.response, c.type).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer, c.type).toBeUndefined();
    cleanup();
  }
});

it('the expected answer names every natural way to say the time', () => {
  expect(spokenTimeForms(3, 0)).toEqual(expect.arrayContaining(["three o'clock", '3:00', 'three']));
  expect(spokenTimeForms(3, 15)).toEqual(expect.arrayContaining(['three fifteen', '3:15', 'quarter past three', 'fifteen past three']));
  expect(spokenTimeForms(3, 45)).toEqual(expect.arrayContaining(['three forty-five', 'quarter to four']));
  expect(spokenTimeForms(12, 5)).toEqual(expect.arrayContaining(['twelve oh five', '12:05', 'five past twelve']));
  expect(spokenDurationForms(90)).toEqual(expect.arrayContaining(['one hour thirty minutes', '90 minutes', 'an hour and a half']));
  expect(spokenDurationForms(30)).toEqual(expect.arrayContaining(['thirty minutes', 'half an hour']));
  expect(spokenKeyText(clockKey(MATCH)!)).toContain('"eight forty-five" is wrong');
});

it('every spoken miss is one the catalog lists for its mode, and no example is a way to say the key', () => {
  const lists = getComponentById('analog-clock')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const cases: Array<[string, ClockChallenge, string[]]> = [
    ['read', READ, spokenTimeForms(3, 30)],
    ['read', { ...READ, targetHour: 3, targetMinute: 15 }, spokenTimeForms(3, 15)],
    ['read', { ...READ, targetHour: 12, targetMinute: 0 }, spokenTimeForms(12, 0)],
    ['match', MATCH, spokenTimeForms(7, 45)],
    ['match', { ...MATCH, targetHour: 4, targetMinute: 50 }, spokenTimeForms(4, 50)],
    ['elapsed', ELAPSED, spokenDurationForms(90)],
    ['elapsed', { ...ELAPSED, startHour: 3, startMinute: 0, targetHour: 3, targetMinute: 30 }, spokenDurationForms(30)],
    ['hand_name', HAND, ['the short one', 'the short hand']],
    ['hand_name', { ...HAND, targetHand: 'minute' }, ['the long one', 'the long hand']],
  ];
  for (const [mode, c, keys] of cases) {
    const misses = clockSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) {
      expect(lists[mode], `${mode} ${m.id}`).toContain(m.id);
      for (const e of m.examples ?? []) expect(keys.map(k => k.toLowerCase()), `${mode} ${m.id}`).not.toContain(e.toLowerCase());
    }
  }
  // 3:45 read as 9:15 (the hands swapped) and 4:45 (the hour the short hand is moving toward) are both named.
  const at345 = clockSpokenMisses({ ...READ, targetHour: 3, targetMinute: 45 });
  expect(at345.find(m => m.id === 'hands_swapped')!.examples).toContain('nine fifteen');
  expect(at345.find(m => m.id === 'next_hour')!.examples).toContain('four forty-five');
});
