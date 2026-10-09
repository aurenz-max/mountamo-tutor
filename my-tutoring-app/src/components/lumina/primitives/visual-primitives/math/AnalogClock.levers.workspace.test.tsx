// @vitest-environment jsdom
/**
 * analog-clock levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and the fact draws no digit; the next attempt records the lever; a refused pull changes nothing; a simpler
 * item is ungraded practice of the same mode, and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { AnalogClockData, ClockChallenge } from './AnalogClock';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mount = (evalMode: string, challenges: ClockChallenge[], gradeBand: AnalogClockData['gradeBand'] = '1-2') => {
  const h = mountWorkspace({ primitiveId: 'analog-clock', evalMode, instanceId: 'clock', data: { title: 'Clock', gradeBand, challenges } });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const check = (h: WorkspaceHarness) => h.press(/check/i);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const READ: ClockChallenge = { id: 'r', type: 'read', instruction: 'What time does the clock show?', targetHour: 3, targetMinute: 30,
  option0: '4:30', option1: '3:30', option2: '2:30', option3: '3:00', correctOptionIndex: 1, hint: '' };

it('hand_name: the running model clock appears beside the item in the same commit, labels no hand, and the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('hand_name', [{ id: 'h', type: 'hand_name', instruction: 'Touch the hand that tells us the hour.',
    targetHour: 2, targetMinute: 0, targetHand: 'hour', hint: '' }], 'K');
  expect(levers(h)).toEqual([['running_model', false]]);
  h.touch('hand-long'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'other_hand' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_hand')).toBe('running_model');
  expect(q(h, '[data-lever="running-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'running_model' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/small second clock/);
  expect(onScreen(h)).not.toMatch(/\d|hour hand|minute hand/);
  expect(q(h, '[data-lever="running-model"]')).toHaveLength(1);
  // The model runs: its long hand turns while the item's dial stays put.
  const modelHand = () => q(h, '[data-lever="running-model"] line[transform]').at(-1)!.getAttribute('transform');
  const before = modelHand(); h.settle(500);
  expect(modelHand()).not.toBe(before);
  // Its one lever pulled, the item offers no more pulls.
  expect(h.offer('pull_lever')).toBeFalsy();
  h.dispatch('retry');
  h.touch('hand-short'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'h', correct: true, levers: ['running_model'] });
});

it('read: the hand legend and the minute numbers come on at runtime; the next item opens bare', () => {
  const h = mount('read', [READ, { ...READ, id: 'r2', targetHour: 6, targetMinute: 0, option0: '6:00', option1: '12:30',
    option2: '7:00', option3: '5:00', correctOptionIndex: 0 }]);
  expect(levers(h)).toEqual([['hand_legend', false], ['minute_numbers', false], ['running_model', false], ['simpler_item', false]]);
  h.press('4:30'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'next_hour' });
  expect(h.view.container.textContent).not.toMatch(/Hour \(short\)/);
  expect(h.dispatch('pull_lever', { lever: 'hand_legend' }).status).toBe('committed');
  expect(h.view.container.textContent).toMatch(/Hour \(short\)/);
  // A repeat pull is refused and changes nothing.
  const pulledOnce = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'hand_legend' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(pulledOnce);
  expect(h.dispatch('pull_lever', { lever: 'minute_numbers' }).status).toBe('committed');
  // The minute labels are drawn round the face; the fact names them without a digit.
  expect(q(h, 'svg text').map(t => t.textContent)).toContain('55');
  expect(onScreen(h)).toMatch(/counts by fives/);
  expect(onScreen(h)).not.toMatch(/\d/);
  h.dispatch('retry');
  h.press('3:30'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'r', correct: true, levers: ['hand_legend', 'minute_numbers'] });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('r2');
  expect(h.view.container.textContent).not.toMatch(/Hour \(short\)/);
  expect(levers(h).every(([, pulled]) => !pulled)).toBe(true);
});

it('read: the simpler item is a whole hour with two choices, ungraded; the full item comes back blank and is credited after', () => {
  const h = mount('read', [READ]);
  h.press('2:30'); check(h);
  const receipt = h.dispatch('pull_lever', { lever: 'simpler_item' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('r~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'r' });
  expect(h.view.container.textContent).toMatch(/Practice/);
  const choices = q(h, 'button').map(b => b.textContent).filter(t => /^\d{1,2}:\d{2}$/.test(t ?? ''));
  expect(choices).toEqual(['1:00', '7:00']);
  expect(choices).not.toContain('3:30');
  // A wrong practice pick, Try again keeps the practice item.
  h.press('1:00'); check(h);
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('r~simpler');
  h.press('7:00'); check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('r');
  expect(h.view.container.textContent).not.toMatch(/Practice/);
  expect(q(h, 'button').map(b => b.textContent)).toEqual(expect.arrayContaining(['4:30', '3:30', '2:30', '3:00']));
  h.press('3:30'); check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!a.practice])).toEqual([
    ['r', false, false], ['r~simpler', false, true], ['r~simpler', true, true], ['r', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['simpler_item'] });
});

it('hear_time: short hands thicken on every face alike; two faces in practice, never the asked hour', () => {
  const h = mount('hear_time', [{ id: 'e', type: 'hear_time', instruction: "Which clock shows two o'clock?", targetHour: 2,
    targetMinute: 0, option0: '5:00', option1: '2:00', option2: '1:00', option3: '3:00', correctOptionIndex: 1, hint: '' }], 'K');
  expect(levers(h)).toEqual([['short_hands', false], ['simpler_item', false]]);
  h.press('Clock face 4'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'next_hour' });
  expect(h.dispatch('pull_lever', { lever: 'short_hands' }).status).toBe('committed');
  expect(q(h, '[data-lever="short-hand"]')).toHaveLength(4);
  expect(onScreen(h)).toMatch(/every clock face/);
  expect(h.dispatch('pull_lever', { lever: 'simpler_item' }).status).toBe('committed');
  expect(h.state().task!.task).toBe("Which clock shows six o'clock?");
  expect(q(h, 'button[aria-label^="Clock face"]')).toHaveLength(2);
  // Practice draws no lever: the faces are plain again.
  expect(q(h, '[data-lever="short-hand"]')).toHaveLength(0);
});

it('count_face: the round arrow draws a dashed path from the first number, marking none', () => {
  const h = mount('count_face', [{ id: 'c', type: 'count_face', instruction: 'Touch the numbers all the way round the clock. Start at 1.',
    targetHour: 3, targetMinute: 0, hint: '' }], 'K');
  expect(levers(h)).toEqual([['round_arrow', false]]);
  expect(h.dispatch('pull_lever', { lever: 'round_arrow' }).status).toBe('committed');
  expect(q(h, '[data-lever="round-arrow"]')).toHaveLength(1);
  expect(q(h, '[data-lever="round-arrow"] text')).toHaveLength(0);
  expect(onScreen(h)).toMatch(/dashed arrow/);
});

it('elapsed: start hands appear on the pull, the sweep follows the learner\'s own run (a ring per full turn); whole-hours practice', () => {
  const h = mount('elapsed', [{ id: 'l', type: 'elapsed', instruction: 'A movie starts at 2:00 and ends at 3:30. How long is it?',
    targetHour: 3, targetMinute: 30, startHour: 2, startMinute: 0, option0: '30 minutes', option1: '1 hour 30 minutes',
    option2: '2 hours 30 minutes', option3: '1 hour', correctOptionIndex: 1, hint: '' }], '3-5');
  expect(levers(h)).toEqual([['minute_numbers', false], ['start_and_sweep', false], ['simpler_item', false]]);
  h.press('30 minutes'); check(h);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'hour_off' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'hour_off')).toBe('start_and_sweep');
  expect(h.dispatch('pull_lever', { lever: 'start_and_sweep' }).status).toBe('committed');
  expect(q(h, '[data-lever="start-hands"]')).toHaveLength(1);
  expect(q(h, '[data-lever="sweep"]')).toHaveLength(0);
  h.dispatch('retry');
  h.press('Start'); h.settle(100 * 75); h.press('Stop');
  expect(q(h, '[data-lever="sweep-ring"]')).toHaveLength(1);
  expect(q(h, '[data-lever="sweep-wedge"]')).toHaveLength(1);
  expect(onScreen(h)).not.toMatch(/\d/);
  h.press('Reset');
  expect(q(h, '[data-lever="sweep"]')).toHaveLength(0);
  expect(h.dispatch('pull_lever', { lever: 'simpler_item' }).status).toBe('committed');
  expect(h.state().task!.task).toBe('The clock starts at 5:00 and stops at 7:00. How much time passed?');
  expect(q(h, 'button').map(b => b.textContent)).not.toContain('1 hour 30 minutes');
});

it('set_time: the digital echo shows the hands\' time as they move; practice sets a whole hour', () => {
  const h = mount('set_time', [{ id: 's', type: 'set_time', instruction: 'Set the clock to 12:30.', targetHour: 12, targetMinute: 30, hint: '' },
    { id: 's2', type: 'set_time', instruction: 'Set the clock to 3:00.', targetHour: 3, targetMinute: 0, hint: '' }]);
  expect(levers(h)).toEqual([['hand_legend', false], ['minute_numbers', false], ['running_model', false], ['digital_echo', false],
    ['simpler_item', false]]);
  check(h);
  expect(h.dispatch('pull_lever', { lever: 'digital_echo' }).status).toBe('committed');
  expect(q(h, '.font-mono').map(d => d.textContent)).toEqual(['12:00']);
  h.dispatch('retry');
  act(() => { fireEvent.keyDown(h.view.getByRole('slider'), { key: 'PageUp' }); });
  expect(q(h, '.font-mono').map(d => d.textContent)).toEqual(['12:30']);
  check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['digital_echo'] });
  cleanup();
  const s = mount('set_time', [{ id: 's', type: 'set_time', instruction: 'Set the clock to 12:30.', targetHour: 12, targetMinute: 30, hint: '' }]);
  check(s);
  expect(s.dispatch('pull_lever', { lever: 'simpler_item' }).status).toBe('committed');
  expect(s.state().task!.task).toBe('Set the clock to 4:00.');
  expect(s.state().task!.demand).toMatchObject({ learnerWork: 'The hands show 12:00' });
});
