// @vitest-environment jsdom
/**
 * classification-sorter `sort` levers on the real component and shared workspace: a pull changes the screen and the
 * scene fact in the same commit, a refused pull changes nothing, and the next attempt records the lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { ClassificationCategory, ClassificationItem } from './ClassificationSorter';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const cat = (id: string, label: string, description: string): ClassificationCategory => ({ id, label, description, parentId: null });
const item = (id: string, label: string, correctCategoryId: string, hint: string): ClassificationItem =>
  ({ id, label, imagePrompt: null, hint, correctCategoryId, distractorReasoning: '' });
const WINGS = [cat('g-w', 'Has Wings', 'Animals that have wings on their bodies'), cat('g-n', 'No Wings', 'Animals that do not have wings')];
const ITEMS = [item('robin', 'Robin', 'g-w', 'Look closely at its sides. Can it fly using feathers?'),
  item('bat', 'Bat', 'g-w', 'It flies at night, but look at its skin wings and furry body.')];
const mount = (gradeBand: 'K-2' | '3-5' = 'K-2') => mountWorkspace({ primitiveId: 'classification-sorter', evalMode: 'sort',
  data: { title: 'Wings', instructions: 'Sort them.', sortingRule: 'Sort by wings', gradeBand, allowPartialCredit: true,
    categories: WINGS, items: ITEMS }, instanceId: 'sorter-bio' });
const demand = (h: ReturnType<typeof mount>) => h.state().task!.demand as Record<string, unknown>;
const levers = (h: ReturnType<typeof mount>) => h.state().task!.workspace!.levers ?? [];

it('pre-reader: a miss, then the meaning and the clue go on screen with their facts, and the right tap records both', () => {
  const h = mount();
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([['group_meaning', 'help', false], ['card_clue', 'help', false]]);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  h.touch('group-g-n');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_group' });
  expect(h.dispatch('pull_lever', { lever: 'group_meaning' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="group-meaning"]')).map(n => n.textContent))
    .toEqual(['Animals that have wings on their bodies', 'Animals that do not have wings']);
  expect(String(demand(h).onScreen)).toMatch(/^Under each group name, in the order of the groups: 1. "Animals that have wings/);
  expect(h.dispatch('pull_lever', { lever: 'card_clue' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="card-clue"]')!.textContent).toBe('Look closely at its sides. Can it fly using feathers?');
  expect(String(demand(h).onScreen)).toContain('a clue: "Look closely at its sides.');
  // Every lever pulled: none is offered again.
  expect(h.offer('pull_lever')).toBeUndefined();
  h.dispatch('retry'); h.confirmVisible();
  // Try again keeps the levers on the same card.
  expect(h.view.container.querySelector('[data-lever="card-clue"]')).not.toBeNull();
  h.touch('group-g-w');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, levers: ['group_meaning', 'card_clue'] });
});

it('the next card starts bare; the sorted marks ring what is already sorted; the clue blanks the group words', () => {
  const h = mount();
  h.touch('group-g-w');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('bat');
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([['group_meaning', false], ['card_clue', false], ['sorted_marks', false]]);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(h.dispatch('pull_lever', { lever: 'sorted_marks' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="sorted-mark"]')).map(n => n.textContent)).toEqual(['Robin']);
  h.dispatch('pull_lever', { lever: 'card_clue' });
  expect(h.view.container.querySelector('[data-lever="card-clue"]')!.textContent).toBe('It flies at night, but look at its skin ___ and furry body.');
});

it('a reader band already shows the descriptions: only the clue is offered', () => {
  const h = mount('3-5');
  expect(levers(h).map(l => l.id)).toEqual(['card_clue']);
  expect(h.dispatch('pull_lever', { lever: 'group_meaning' }).status).toBe('blocked');
});
