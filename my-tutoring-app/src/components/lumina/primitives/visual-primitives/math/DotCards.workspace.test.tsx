// @vitest-environment jsdom
/**
 * Dot cards on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { buildDotCards, generateDotCards } from '../../../service/math/dot-cards-generator';
import type { DotCardsData } from './DotCards';
import { dotCardsHarnessInputs, dotCardsMiss, dotCardsSpokenMisses } from './dotCardsWorkspace';
import { spokenIntegerWord } from './spokenNumberWords';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const session = (count = 1): DotCardsData & Record<string, unknown> => ({
  title: 'Dot Cards', description: 'Look', challengeType: 'quick_total',
  challenges: buildDotCards('medium', 7, 5).slice(0, count),
});

const dotsDrawn = (h: ReturnType<typeof mountWorkspace>) => h.view.container.querySelectorAll('[data-dot-part]').length;
const pad = (h: ReturnType<typeof mountWorkspace>, n: number) =>
  h.view.container.querySelector(`button[aria-label="Answer ${n}"]`) as HTMLButtonElement;

it('a card starts face down with no dots in the page and a closed pad; one flip shows it, then it turns back over', () => {
  const data = session();
  const card = data.challenges[0];
  const h = mountWorkspace({ primitiveId: 'dot-cards', evalMode: 'quick_total', data });
  expect(dotsDrawn(h)).toBe(0);
  expect(pad(h, 1).disabled).toBe(true);
  expect(h.state().task!.demand).toMatchObject({ looked: 'no' });

  h.press('Flip the card');
  expect(dotsDrawn(h)).toBe(card.total);
  expect(pad(h, 1).disabled).toBe(false);
  h.settle(card.lookMs! + 50);
  expect(dotsDrawn(h)).toBe(0);
  expect(h.state().task!.demand).toMatchObject({ looked: 'yes' });
  // The flip button is gone: one look per try.
  expect(h.view.container.querySelector('button[aria-label="Flip the card"]')).toBeNull();
});

it('the spoken key is the total, and nothing the tutor reads says a group size or the total', () => {
  const data = session();
  const card = data.challenges[0];
  const h = mountWorkspace({ primitiveId: 'dot-cards', evalMode: 'quick_total', data });
  const task = h.state().task!;
  expect(task.workspace!.expectedAnswer?.startsWith(`"${spokenIntegerWord(card.total)}"`)).toBe(true);
  expect(task.demand.response).toBe('speech');
  const demand = JSON.stringify(task.demand);
  for (const n of [card.total, ...card.parts]) expect(demand).not.toMatch(new RegExp(`\\b${n}\\b`));
  expect(demand).not.toMatch(/"parts"|"total"|"dots"/);
});

it('a wrong tap is a named miss; Try again gives one new look; the right tap turns the card up and names the groups', () => {
  const data = session(2);
  const card = data.challenges[0];
  const h = mountWorkspace({ primitiveId: 'dot-cards', evalMode: 'quick_total', data });
  h.press('Flip the card');
  for (const input of dotCardsHarnessInputs(card, true)) h.press(input.label);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(card.total < 10 ? 'one_over' : 'one_short');
  // The miss turns the card over and never shows the answer.
  expect(dotsDrawn(h)).toBe(0);
  expect(h.view.container.textContent).not.toContain(`make ${card.total}`);

  h.dispatch('retry');
  expect(h.view.container.querySelector('button[aria-label="Flip the card"]')).not.toBeNull();
  h.press('Flip the card');
  for (const input of dotCardsHarnessInputs(card, false)) h.press(input.label);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(dotsDrawn(h)).toBe(card.total);
  expect(h.view.container.textContent).toContain(`${card.parts[0]} blue and ${card.parts[1]} orange make ${card.total}`);
  h.dispatch('advance'); h.confirmVisible();
  // The next card opens face down.
  expect(h.state().task!.itemId).toBe(data.challenges[1].id);
  expect(dotsDrawn(h)).toBe(0);
});

it('the total said aloud and credited by the tutor completes the card once', async () => {
  const data = session();
  const card = data.challenges[0];
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'dot-cards', evalMode: 'quick_total', data });
  h.press('Flip the card');
  h.say(String(card.total + 1)); h.feedback('incorrect', 'retry');
  h.say(String(card.total)); h.feedback('correct', 'advance');
  expect(h.view.container.textContent).toContain('cards right on the first try');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('nothing advances on a clock after a right answer', () => {
  const data = session(2);
  const card = data.challenges[0];
  const h = mountWorkspace({ primitiveId: 'dot-cards', evalMode: 'quick_total', data });
  h.press('Flip the card');
  h.press(`Answer ${card.total}`);
  h.settle(30000);
  expect(h.state().task!.itemId).toBe(card.id);
});

it.each([
  [3, 'one_group'], [2, 'one_group'], [4, 'one_short'], [6, 'one_over'], [1, 'short_by_more'], [9, 'over_by_more'], [5, undefined],
] as const)('a tap of %s on a 3 and 2 card is a %s miss', (value, miss) => {
  expect(dotCardsMiss({ id: 'x', type: 'quick_total', parts: [3, 2], total: 5, arrangement: 'dice', dots: [] }, value)).toBe(miss);
});

it('every spoken miss is one the card lists, and the one-group miss comes first', () => {
  const misses = dotCardsSpokenMisses({ id: 'x', type: 'quick_total', parts: [3, 2], total: 5, arrangement: 'dice', dots: [] });
  expect(misses[0]).toMatchObject({ id: 'one_group' });
  for (const m of misses) expect(['one_group', 'one_short', 'one_over', 'short_by_more', 'over_by_more']).toContain(m.id);
});

it('the generator builds valid, varied sessions at every tier', () => {
  const ranges = { easy: [2, 5], medium: [4, 8], hard: [6, 10] } as const;
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const sessions = Array.from({ length: 6 }, (_, seed) => generateDotCards({ raw: { difficulty: tier, seed } } as never));
    for (const s of sessions) {
      expect(() => LIVE_ADAPTERS['dot-cards'].validate(s)).not.toThrow();
      expect(new Set(s.challenges.map(c => `${c.parts}`)).size).toBe(s.challenges.length);
      for (const c of s.challenges) {
        expect(c.total).toBeGreaterThanOrEqual(ranges[tier][0]);
        expect(c.total).toBeLessThanOrEqual(ranges[tier][1]);
      }
    }
    expect(new Set(sessions.map(s => JSON.stringify(s.challenges.map(c => c.parts)))).size).toBeGreaterThan(1);
  }
});

it('the adapter refuses a card whose total or dots do not match its groups', () => {
  const good = session();
  const c = good.challenges[0];
  expect(() => LIVE_ADAPTERS['dot-cards'].validate({ ...good, challenges: [{ ...c, total: c.total + 1 }] })).toThrow();
  expect(() => LIVE_ADAPTERS['dot-cards'].validate({ ...good, challenges: [{ ...c, dots: c.dots.slice(1) }] })).toThrow();
  expect(() => LIVE_ADAPTERS['dot-cards'].validate({ ...good, challenges: [{ ...c, parts: [6, 1], total: 7 }] })).toThrow();
});
