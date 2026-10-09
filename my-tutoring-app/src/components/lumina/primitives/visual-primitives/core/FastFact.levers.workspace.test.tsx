// @vitest-environment jsdom
/**
 * fast-fact levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one commit
 * and names no key; the next attempt records the lever; a refused or repeated pull changes nothing; the drop never
 * leaves the answer alone.
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
import type { FastFactChallenge } from './FastFact';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const fact = (challengeType: FastFactChallenge['challengeType'], text: string, correctAnswer: string, options: string[],
  extra: Partial<FastFactChallenge> = {}): FastFactChallenge =>
  ({ id: 'f', type: 'core', challengeType, prompt: { text }, correctAnswer, responseMode: 'choice', options, ...extra });
const C = {
  counting: fact('recognize', 'How many stars?', '5', ['4', '5', '6'], { prompt: { text: 'How many stars?', visual: { type: 'emoji', emoji: '⭐⭐⭐⭐⭐' } } }),
  sum: fact('recall', '7 + 3 = ?', '10', ['21', '10', '9', '12']),
  difference: fact('recall', '9 - 4 = ?', '5', ['4', '5', '6', '13']),
  words: fact('apply', 'Which state has Denver as its capital?', 'Colorado', ['Utah', 'Colorado', 'Kansas', 'Ohio']),
  three: fact('apply', 'Which state has Denver as its capital?', 'Colorado', ['Utah', 'Colorado', 'Kansas']),
};
const mount = (c: FastFactChallenge) => {
  const h = mountWorkspace({ primitiveId: 'fast-fact', evalMode: c.challengeType, instanceId: 'facts',
    data: { title: 'Facts', subject: 'Math', targetResponseTime: 6, showStreakCounter: false, showAccuracy: false,
      maxAttemptsPerChallenge: 1, phaseConfig: {}, challenges: [c] } });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

it('recognize: spreading the stars draws five boxes with no number in one commit; a repeat pull changes nothing; the next tap records it', () => {
  const h = mount(C.counting);
  expect(levers(h)).toEqual([['spread_pictures', false], ['drop_far_choice', false]]);
  h.press('4');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'one_less' });
  const receipt = h.dispatch('pull_lever', { lever: 'spread_pictures' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-spread-box]')).toHaveLength(5);
  expect(onScreen(h)).toMatch(/spread apart/);
  expect(onScreen(h)).not.toMatch(/\d/);
  const spread = q(h, '[data-lever="spread-pictures"]')[0];
  expect(`${spread.textContent} ${Array.from(spread.querySelectorAll('[aria-label]')).map(e => e.getAttribute('aria-label')).join(' ')}`).not.toMatch(/\d/);
  // Marking a box is the learner's counting, not an answer.
  h.view.container.querySelector<HTMLButtonElement>('[data-spread-box="0"]')!.click();
  expect(attempts(h)).toHaveLength(1);
  // Three choices with one tried: no drop is left, and nothing more to pull.
  expect(levers(h)).toEqual([['spread_pictures', true]]);
  expect(h.offer('pull_lever')).toBeFalsy();
  h.dispatch('retry');
  expect(q(h, '[data-spread-box]')).toHaveLength(5);
  h.press('5');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'f', correct: true, levers: ['spread_pictures'] });
});

it('recall: the dot model draws the two numbers as groups, never the total, and names no total', () => {
  const h = mount(C.sum);
  h.press('21');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'wrong_operation' });
  expect(h.dispatch('pull_lever', { lever: 'count_model' }).status).toBe('committed');
  const groups = q(h, '[data-lever="count-model"] > div');
  expect(groups.map(g => g.children.length)).toEqual([7, 3]);
  expect(q(h, '[data-lever="count-model"]')[0].textContent).toBe('');
  expect(onScreen(h)).not.toMatch(/\b10\b/);
  h.dispatch('retry');
  h.press('10');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['count_model'] });
});

it('recall: a difference draws the taken-away dots hollow', () => {
  const h = mount(C.difference);
  expect(h.dispatch('pull_lever', { lever: 'count_model' }).status).toBe('committed');
  const dots = q(h, '[data-lever="count-model"] span');
  expect(dots).toHaveLength(9);
  expect(dots.filter(d => d.className.includes('bg-transparent'))).toHaveLength(4);
});

it('apply: the drop greys out an untried wrong choice, keeps its text, and the next answer counts as helped', () => {
  const h = mount(C.words);
  expect(levers(h)).toEqual([['drop_far_choice', false]]);
  h.press('Utah');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'other_choice' });
  // A lever this item does not declare is refused and changes nothing.
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'count_model' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  expect(h.dispatch('pull_lever', { lever: 'drop_far_choice' }).status).toBe('committed');
  const dropped = q(h, '[data-dropped]') as HTMLButtonElement[];
  expect(dropped.map(b => b.textContent)).toEqual(['Ohio']);
  expect(dropped[0].disabled).toBe(true);
  expect(onScreen(h)).toBe('choice 4, "Ohio", is greyed out and is not the answer');
  h.dispatch('retry');
  h.press('Colorado');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['drop_far_choice'] });
});

it('apply: on three choices after one wrong tap there is no drop, so the answer is never left alone', () => {
  const h = mount(C.three);
  expect(levers(h)).toEqual([['drop_far_choice', false]]);
  h.press('Utah');
  expect(levers(h)).toEqual([]);
  expect(h.offer('pull_lever')).toBeFalsy();
  expect(q(h, '[data-dropped]')).toHaveLength(0);
});

it('the levers are the item\'s own: a new challenge starts with none pulled', () => {
  const h = mountWorkspace({ primitiveId: 'fast-fact', evalMode: 'recall', instanceId: 'facts',
    data: { title: 'Facts', subject: 'Math', targetResponseTime: 6, showStreakCounter: false, showAccuracy: false,
      maxAttemptsPerChallenge: 1, phaseConfig: {}, challenges: [C.sum, { ...C.sum, id: 'g', prompt: { text: '6 + 2 = ?' }, correctAnswer: '8', options: ['7', '8', '9', '14'] }] } });
  h.settle(2000);
  h.dispatch('pull_lever', { lever: 'count_model' });
  h.press('10');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('g');
  expect(levers(h)).toEqual([['count_model', false], ['drop_far_choice', false]]);
  expect(q(h, '[data-lever="count-model"]')).toHaveLength(0);
});
