// @vitest-environment jsdom
/**
 * food-web-builder `complete_web` levers (`foodWebLevers.ts` `webLevers`), mounted the way a lesson mounts it. Help
 * levers draw on the learner's own web in the same commit as their scene fact; the arrow counts come from the web's
 * relations and never move as arrows are drawn; the smaller web is ungraded and gives the whole web back empty.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever, observerLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { Connection, FoodWebBuilderData, FoodWebChallenge, Organism } from './FoodWebBuilder';
import { FOOD_WEB_MISSES, smallerWebAsk } from './foodWebWorkspace';
import {
  ARROW_COUNTS_LEVER, ARROW_WORDS_LEVER, FOOD_TAGS_LEVER, SMALLER_WEB_LEVER, foodWebLevers, smallerWeb, webArrowCounts, webLevers,
} from './foodWebLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const org = (id: string, name: string, trophicLevel: Organism['trophicLevel']): Organism =>
  ({ id, name, trophicLevel, imagePrompt: name, position: { x: '50%', y: '50%' } });
const rel = (fromId: string, toId: string): Connection => ({ fromId, toId, relationship: `${toId} eats ${fromId}` });
const WEB_ORGS = [org('g', 'Grass', 'producer'), org('r', 'Rabbit', 'primary-consumer'), org('m', 'Mouse', 'primary-consumer'),
  org('f', 'Fox', 'secondary-consumer'), org('x', 'Bacteria', 'decomposer')];
const WEB = [rel('g', 'r'), rel('g', 'm'), rel('r', 'f'), rel('m', 'f'), rel('f', 'x')];
const WHOLE: FoodWebChallenge = { id: 'web', type: 'complete_web' };
const lesson = (): FoodWebBuilderData => ({ primitiveType: 'food-web-builder', ecosystem: 'Meadow', organisms: WEB_ORGS,
  correctConnections: WEB, gradeBand: '3-5', challengeType: 'complete_web' });

// A bigger web for the builder: a hawk on top, a decomposer under it.
const BIG_ORGS = [org('g', 'Grass', 'producer'), org('b', 'Berries', 'producer'), org('h', 'Grasshopper', 'primary-consumer'),
  org('m', 'Mouse', 'primary-consumer'), org('r', 'Rabbit', 'primary-consumer'), org('f', 'Frog', 'secondary-consumer'),
  org('s', 'Snake', 'secondary-consumer'), org('k', 'Hawk', 'tertiary-consumer'), org('x', 'Bacteria', 'decomposer')];
const BIG = [rel('g', 'h'), rel('g', 'm'), rel('g', 'r'), rel('b', 'm'), rel('b', 'r'), rel('h', 'f'), rel('m', 's'), rel('f', 's'),
  rel('m', 'k'), rel('r', 'k'), rel('s', 'k'), rel('f', 'k'), rel('k', 'x'), rel('s', 'x'), rel('r', 'x')];

const draw = (h: WorkspaceHarness, pairs: Array<[string, string]>) => pairs.forEach(([a, b]) => { h.touch(`web-${a}`); h.touch(`web-${b}`); });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;

describe('the lever rules', () => {
  it('the smaller web drops the top eaters, keeps their relations out, and is never the whole web', () => {
    const small = smallerWeb({ id: 'web', type: 'complete_web' }, BIG_ORGS, BIG)!;
    expect(small).toEqual({ id: 'web~smaller', type: 'complete_web', only: ['g', 'b', 'h', 'm', 'r', 'f', 's', 'x'] });
    expect(smallerWeb(WHOLE, WEB_ORGS, WEB)).toEqual({ id: 'web~smaller', type: 'complete_web', only: ['g', 'r', 'm'] });
    // No consumer level can go (it would leave no relation): the decomposers go instead.
    const decomposerWeb = [rel('g', 'r'), rel('g', 'm'), rel('r', 'x'), rel('m', 'x')];
    expect(smallerWeb(WHOLE, WEB_ORGS, decomposerWeb)).toMatchObject({ only: ['g', 'r', 'm'] });
    // Producers and plant eaters only: nothing can go.
    expect(smallerWeb(WHOLE, WEB_ORGS, [rel('g', 'r'), rel('g', 'm')])).toBeNull();
    // Never on a smaller web, never on a chain.
    expect(smallerWeb(small, BIG_ORGS, BIG)).toBeNull();
    expect(webLevers(small, BIG_ORGS, BIG, [])).toEqual([]);
  });

  it('over many random webs the smaller web is the same task, in the web, at least two relations, and fewer than the source', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let built = 0;
    for (let i = 0; i < 300; i++) {
      const web = BIG.filter(() => rand() < 0.6);
      const small = smallerWeb(WHOLE, BIG_ORGS, web);
      if (!small || small.type !== 'complete_web') continue;
      built++;
      const kept = web.filter(r => small.only!.includes(r.fromId) && small.only!.includes(r.toId));
      expect(kept.length).toBeGreaterThanOrEqual(2);
      expect(kept.length).toBeLessThan(web.length);
      expect(small.id).not.toBe(WHOLE.id);
      // Every living thing shown has a relation to draw.
      for (const id of small.only!) expect(kept.some(r => r.fromId === id || r.toId === id)).toBe(true);
    }
    expect(built).toBeGreaterThan(100);
  });

  it('the arrow counts come from the web only: one per relation end, whatever the learner drew', () => {
    expect(webArrowCounts(WEB_ORGS, WEB)).toEqual({ g: 2, r: 2, m: 2, f: 3, x: 1 });
    // The signature takes no arrows: the count cannot react to whether a drawn arrow is right.
    expect(webArrowCounts.length).toBe(2);
  });

  it.each([
    ['backwards_arrows', [], ARROW_WORDS_LEVER], ['wrong_arrows', [], FOOD_TAGS_LEVER], ['missing_arrows', [], ARROW_COUNTS_LEVER],
    ['missing_arrows', [ARROW_COUNTS_LEVER], SMALLER_WEB_LEVER], ['wrong_arrows', [FOOD_TAGS_LEVER], SMALLER_WEB_LEVER],
    ['backwards_arrows', [ARROW_WORDS_LEVER], FOOD_TAGS_LEVER],
  ])('after %s with %j pulled, the next lever is %s', (miss, pulled, want) => {
    expect(nextLever(webLevers(WHOLE, WEB_ORGS, WEB, pulled as string[]), miss)).toBe(want);
  });

  it('lever texts name no living thing, and every whole-web miss has a lever (J9)', () => {
    const ls = foodWebLevers(WHOLE, BIG_ORGS, BIG, []);
    expect(ls.map(l => [l.id, l.kind])).toEqual([[ARROW_WORDS_LEVER, 'help'], [FOOD_TAGS_LEVER, 'help'],
      [ARROW_COUNTS_LEVER, 'help'], [SMALLER_WEB_LEVER, 'simplify']]);
    for (const l of ls) expect(`${l.when} ${l.does}`).not.toMatch(/grass|mouse|hawk|snake|rabbit|frog|berries|bacteria|\d/i);
    const entry = getComponentById('food-web-builder')!;
    const misses = entry.teachingWorkspace!.misses!.complete_web;
    expect([...misses].sort()).toEqual([...FOOD_WEB_MISSES].sort());
    for (const m of misses) expect(ls.some(l => l.answers?.includes(m)), m).toBe(true);
    expect(entry.teachingWorkspace!.unanswered?.complete_web).toBeUndefined();
  });
});

it('bare at the start; a backwards arrow, then the words: on every drawn arrow in the same commit, recorded on the next try', () => {
  const h = mountWorkspace({ primitiveId: 'food-web-builder', evalMode: 'complete_web', data: lesson() as never });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[ARROW_WORDS_LEVER, false], [FOOD_TAGS_LEVER, false],
    [ARROW_COUNTS_LEVER, false], [SMALLER_WEB_LEVER, false]]);
  expect(q(h, '[data-lever]')).toHaveLength(0);
  draw(h, [['r', 'g'], ['g', 'm'], ['r', 'f'], ['m', 'f'], ['f', 'x']]);
  h.press(/check/i);
  expect(last(h)).toMatchObject({ correct: false, miss: 'backwards_arrows' });
  expect(observerLever(h.state(), true)).toBe(ARROW_WORDS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: ARROW_WORDS_LEVER });
  expect(receipt.status).toBe('committed');
  // The same words on every arrow the learner drew, the backwards one too; no arrow turned round.
  expect(q(h, 'svg [data-lever="arrow-words"]').map(n => n.textContent)).toEqual(Array(5).fill('eaten by'));
  expect(h.view.container.textContent).toMatch(/Rabbit eaten by Grass/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/eaten by/);
  // The fact says what is drawn, never which arrow is wrong.
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/grass|rabbit|mouse|fox|bacteria|wrong|backwards/i);
  // A refused pull changes nothing.
  const before = [levers(h).map(l => l.pulled), q(h, '[data-lever]').length, demand(h).onScreen, h.state().task!.itemId];
  expect(h.dispatch('pull_lever', { lever: ARROW_WORDS_LEVER }).status).toBe('blocked');
  expect([levers(h).map(l => l.pulled), q(h, '[data-lever]').length, demand(h).onScreen, h.state().task!.itemId]).toEqual(before);
  h.dispatch('retry');
  h.settle(2000);
  draw(h, [['g', 'r']]);
  h.press(/check/i);
  expect(last(h)).toMatchObject({ itemId: 'web', correct: true, assisted: true, levers: [ARROW_WORDS_LEVER] });
  h.close();
});

it('missing arrows, then the counts: drawn per living thing from the web, and they do not move when a right arrow is drawn', () => {
  const h = mountWorkspace({ primitiveId: 'food-web-builder', evalMode: 'complete_web', data: lesson() as never });
  draw(h, [['g', 'r'], ['r', 'f']]);
  h.press(/check/i);
  expect(last(h)).toMatchObject({ correct: false, miss: 'missing_arrows' });
  expect(observerLever(h.state(), true)).toBe(ARROW_COUNTS_LEVER);
  h.dispatch('pull_lever', { lever: ARROW_COUNTS_LEVER });
  const counts = () => q(h, '[data-lever="arrow-count"]').map(n => n.textContent);
  expect(counts()).toEqual(['2 arrows', '2 arrows', '2 arrows', '3 arrows', '1 arrow']);
  expect(String(demand(h).onScreen)).toMatch(/how many feeding arrows join it/);
  h.dispatch('retry');
  h.settle(2000);
  draw(h, [['g', 'm']]);
  expect(counts()).toEqual(['2 arrows', '2 arrows', '2 arrows', '3 arrows', '1 arrow']);
  // A wrong arrow, then the food tags under the level labels.
  draw(h, [['g', 'f']]);
  h.press(/check/i);
  expect(last(h)).toMatchObject({ miss: 'wrong_arrows', levers: [ARROW_COUNTS_LEVER] });
  h.dispatch('pull_lever', { lever: FOOD_TAGS_LEVER });
  expect(q(h, '[data-lever="food-tag"]').map(n => n.textContent))
    .toEqual(['makes its own food', 'eats plants', 'eats plants', 'eats animals', 'breaks down dead things']);
  h.close();
});

it('the smaller web is ungraded on fewer living things; the whole web comes back empty and is credited', () => {
  const h = mountWorkspace({ primitiveId: 'food-web-builder', evalMode: 'complete_web', data: lesson() as never });
  draw(h, [['g', 'r']]);
  h.press(/check/i);
  const receipt = h.dispatch('pull_lever', { lever: SMALLER_WEB_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: 'web~smaller', task: smallerWebAsk(3) });
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'web' });
  expect(q(h, '[data-pip-object^="web-"]').map(n => n.getAttribute('data-pip-object'))).toEqual(['web-g', 'web-r', 'web-m']);
  expect(q(h, '[data-practice="smaller-web"]')).toHaveLength(1);
  expect(levers(h)).toEqual([]);
  expect(demand(h)).toMatchObject({ kind: 'complete_web', arrowsDrawn: 0 });
  draw(h, [['g', 'r']]);
  h.press(/check/i);
  expect(last(h)).toMatchObject({ itemId: 'web~smaller', correct: false, miss: 'missing_arrows' });
  h.dispatch('retry');
  h.settle(2000);
  draw(h, [['g', 'm']]);
  h.press(/check/i);
  expect(last(h)).toMatchObject({ itemId: 'web~smaller', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'web' });
  expect(q(h, '[data-pip-object^="web-"]')).toHaveLength(5);
  expect(q(h, 'svg line')).toHaveLength(0);
  h.settle(2000);
  draw(h, [['g', 'r'], ['g', 'm'], ['r', 'f'], ['m', 'f'], ['f', 'x']]);
  h.press(/check/i);
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['web', false, false], ['web~smaller', false, true], ['web~smaller', true, true], ['web', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [SMALLER_WEB_LEVER] });
  h.close();
});
