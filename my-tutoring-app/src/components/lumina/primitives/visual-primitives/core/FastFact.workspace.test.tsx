// @vitest-environment jsdom
/**
 * Fast fact on the teaching workspace: what is its own. The generic W1 contract
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
import type { FastFactChallenge } from './FastFact';
import { fastFactMiss, workspaceScene } from './fastFactWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const fact = (id: string, challengeType: FastFactChallenge['challengeType'], text: string, correctAnswer: string, options: string[],
  extra: Partial<FastFactChallenge> = {}): FastFactChallenge =>
  ({ id, type: 'core', challengeType, prompt: { text }, correctAnswer, responseMode: 'choice', options,
    explanation: `Because it is ${correctAnswer}.`, ...extra });

/** One hand-built challenge per catalog mode. */
const CHALLENGES: Record<string, FastFactChallenge> = {
  recognize: fact('r', 'recognize', 'How many stars?', '4', ['3', '4', '5'],
    { prompt: { text: 'How many stars?', visual: { type: 'emoji', emoji: '⭐⭐⭐⭐', alt: 'stars' } } }),
  recall: fact('c', 'recall', '7 + 3 = ?', '10', ['21', '10', '9', '12'], { prompt: { text: '7 + 3 = ?', subtext: 'Find the sum' } }),
  apply: fact('a', 'apply', 'Denver is the capital of which state?', 'Colorado', ['Utah', 'Colorado', 'Kansas']),
};
const MODES = (getComponentById('fast-fact')?.evalModes ?? []).map(m => m.evalMode);
const data = (challenges: FastFactChallenge[]) => ({
  title: 'Facts', subject: 'Math', targetResponseTime: 6, showStreakCounter: true, showAccuracy: true, maxAttemptsPerChallenge: 1,
  phaseConfig: { core: { label: 'Core', icon: '⚡', accentColor: 'blue' } }, gradeBand: 'K-2', challenges,
}) as unknown as Record<string, unknown>;

/** The journey row's own inputs, through the real buttons. */
function perform(h: ReturnType<typeof mountWorkspace>, d: Record<string, unknown>, intent: 'wrong' | 'correct') {
  const inputs = LIVE_JOURNEYS['fast-fact'].inputsFor(intent, { itemId: h.state().task!.itemId, data: d } as never);
  for (const input of inputs) if (input.type === 'choose') h.press(input.label);
}

it('every catalog mode has a hand-built challenge', () => {
  expect(MODES.sort()).toEqual(Object.keys(CHALLENGES).sort());
});

it.each(Object.keys(CHALLENGES))('%s: one checked tap that publishes no key; a wrong one names its miss and shows no answer, Try again clears it, the right one completes once',
  async mode => {
    const c = CHALLENGES[mode];
    const d = data([c]);
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'fast-fact', evalMode: mode, data: d });
    // No Start screen with the tutor: the question and its choices are up at once.
    expect(h.view.container.textContent).not.toMatch(/ready to practice/i);
    const task = h.state().task!;
    expect(task.task).toContain(c.prompt.text);
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(task)).not.toMatch(/correctAnswer|acceptableAnswers|Because it is/);
    expect(task.demand).toMatchObject({ choices: c.options.join(' | '), learnerWork: 'No choice tapped yet' });
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/next challenge/i);

    perform(h, d, 'wrong');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    const miss = h.state().task!.workspace!.attempts.at(-1)?.miss;
    expect(getComponentById('fast-fact')!.teachingWorkspace!.misses![mode]).toContain(miss);
    // maxAttemptsPerChallenge 1 is the scripted path's: with the tutor a wrong tap reveals nothing and records no failure.
    expect(h.view.container.textContent).not.toMatch(/the answer is|Because it is/i);
    const choices = Array.from(h.view.container.querySelectorAll('button')).filter(b => c.options.includes((b.textContent ?? '').trim()));
    expect(choices.every(b => b.disabled)).toBe(true);
    h.dispatch('retry');
    expect(h.state().task!.demand.learnerWork).toBe('No choice tapped yet');
    expect(h.view.container.textContent).not.toMatch(/not quite/i);

    perform(h, d, 'correct');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it('a counting picture\'s label drops the count the alt text states', () => {
  const c = { ...CHALLENGES.recognize, prompt: { text: 'How many stars?', visual: { type: 'emoji' as const, emoji: '⭐⭐⭐⭐', alt: '4 yellow stars' } } };
  const h = mountWorkspace({ primitiveId: 'fast-fact', evalMode: 'recognize', data: data([c]) });
  expect(h.view.container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('yellow stars');
});

it('a counting picture is never counted for the tutor', () => {
  const { picture, ...rest } = workspaceScene(CHALLENGES.recognize, { picked: null }).facts;
  expect(picture).toContain('ask the learner to count');
  expect(String(picture)).not.toMatch(/\b4\b|⭐⭐/);
  // The choices are on screen, so they are listed; nothing else names a number.
  expect(JSON.stringify({ ...rest, choices: '' })).not.toMatch(/\b4\b/);
});

it('nothing advances or grades on a clock: an untouched item stays, and a right answer waits for the observer', () => {
  const d = data([CHALLENGES.recall, { ...CHALLENGES.recall, id: 'c2' }]);
  const h = mountWorkspace({ primitiveId: 'fast-fact', evalMode: 'recall', data: d });
  h.settle(60000);
  expect(h.state().task!.itemId).toBe('c');
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  perform(h, d, 'correct');
  h.settle(30000);
  expect(h.state().task!.itemId).toBe('c');
});

it('fastFactMiss names the shape of a wrong choice', () => {
  const add = CHALLENGES.recall;
  expect(fastFactMiss(add, { picked: '21' })).toBe('wrong_operation');
  expect(fastFactMiss(add, { picked: '4' })).toBe('wrong_operation');
  expect(fastFactMiss(add, { picked: '9' })).toBe('one_less');
  expect(fastFactMiss(add, { picked: '11' })).toBe('one_more');
  expect(fastFactMiss(add, { picked: '12' })).toBe('other_number');
  expect(fastFactMiss(add, { picked: '10' })).toBeUndefined();
  expect(fastFactMiss(CHALLENGES.apply, { picked: 'Utah' })).toBe('other_choice');
  expect(fastFactMiss({ ...CHALLENGES.apply, acceptableAnswers: ['CO'] }, { picked: 'co' })).toBeUndefined();
});

it('the adapter refuses a challenge its check cannot answer', () => {
  const validate = LIVE_ADAPTERS['fast-fact'].validate;
  expect(() => validate(data([CHALLENGES.recall]))).not.toThrow();
  expect(() => validate(data([{ ...CHALLENGES.recall, correctAnswer: '11' }]))).toThrow();
  expect(() => validate(data([{ ...CHALLENGES.recall, options: ['10'] }]))).toThrow();
  expect(() => validate(data([{ ...CHALLENGES.apply, options: ['Colorado', 'CO', 'Utah'], acceptableAnswers: ['CO'] }]))).toThrow();
});
