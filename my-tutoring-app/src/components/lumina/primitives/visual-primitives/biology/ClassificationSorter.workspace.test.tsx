// @vitest-environment jsdom
/**
 * classification-sorter on the shared teaching workspace (W1, plain shape): what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Each item is one challenge, staged alone; a tap on a group card is the checked answer, and no item's group
 * reaches the tutor.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import { sortMiss, workspaceAssignment } from './classificationSorterWorkspace';
import type { ClassificationCategory, ClassificationItem } from './ClassificationSorter';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const cat = (id: string, label: string, parentId: string | null = null): ClassificationCategory =>
  ({ id, label, description: `Things that are ${label.toLowerCase()}`, parentId });
const item = (id: string, label: string, correctCategoryId: string): ClassificationItem =>
  ({ id, label, imagePrompt: null, hint: 'Think about the rule.', correctCategoryId, distractorReasoning: '' });

const BINARY = [cat('g-wings', 'Has Wings'), cat('g-nowings', 'No Wings')];
const CLASSES = [cat('g-mam', 'Mammals'), cat('g-bird', 'Birds'), cat('g-fish', 'Fish')];
const data = (gradeBand: 'K-2' | '3-5', categories: ClassificationCategory[], items: ClassificationItem[]) => ({
  title: 'Sort the animals', instructions: 'Put each one in its group.', sortingRule: 'Sort by the rule',
  gradeBand, allowPartialCredit: true, categories, items });
const mount = (d: Record<string, unknown>) =>
  mountWorkspace({ primitiveId: 'classification-sorter', evalMode: 'sort', data: d, instanceId: 'sorter-bio' });

const BANDS = [
  ['K-2', BINARY, [item('robin', 'Robin', 'g-wings'), item('dog', 'Dog', 'g-nowings')]],
  ['3-5', CLASSES, [item('bat', 'Bat', 'g-mam'), item('penguin', 'Penguin', 'g-bird')]],
] as const;

it.each(BANDS)('sort (%s) binds as a gesture item: one card on stage, no key, no scripted chrome', (band, categories, items) => {
  const h = mount(data(band, [...categories], [...items]));
  expect(getComponentById('classification-sorter')!.evalModes!.map(m => m.evalMode)).toEqual(['sort']);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(workspaceAssignment(items[0]).task);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const demand = h.state().task!.demand as Record<string, unknown>;
  expect(demand).toMatchObject({ kind: 'sort', cardOnStage: items[0].label });
  // No item's group: every group sits in `groups`, and no fact pairs the card with one.
  expect(JSON.stringify(demand)).not.toContain(items[0].correctCategoryId);
  expect(h.view.container.querySelector('[data-pip-object="card"]')!.textContent).toBe(items[0].label);
  // One card only, no pool, no Submit, no read-aloud; the legacy AI hook is off.
  expect(h.view.container.textContent).not.toContain(items[1].label);
  expect(h.view.container.textContent).not.toMatch(/Submit Classification|Items to Sort/);
  expect(h.view.container.querySelector('[aria-label="Read the instructions to me"]')).toBeNull();
  expect(seam.legacyAI).not.toHaveBeenCalled();
});

it('a wrong group is a named miss; Try again reopens the same card; the same group again is a repeat; right completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(data('3-5', CLASSES, [item('bat', 'Bat', 'g-mam'), item('penguin', 'Penguin', 'g-bird')]));
  h.touch('group-g-bird');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_group',
    response: 'Put "Bat" in "Birds"' });
  // Closed until the observer reopens it.
  h.touch('group-g-fish');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('bat');
  expect((h.state().task!.demand as Record<string, unknown>).learnerWork).toBe('"Bat" is not in a group yet');
  h.touch('group-g-bird');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'repeated_group' });
  h.dispatch('retry'); h.confirmVisible();
  h.touch('group-g-mam');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('penguin');
  // The credited bat now sits in its bin and is a fact; the penguin's group is not.
  expect((h.state().task!.demand as Record<string, unknown>).alreadySorted).toBe('Mammals: Bat; Birds: empty; Fish: empty');
  h.touch('group-g-bird');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics, work] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ type: 'classification-sorter', totalItems: 2, totalCorrect: 2, totalCorrectFirstAttempt: 1 });
  expect(work.teachingAttempts).toHaveLength(4);
});

it('the live host (no evaluation provider) submits nothing', () => {
  const h = mount(data('K-2', BINARY, [item('robin', 'Robin', 'g-wings')]));
  h.touch('group-g-wings');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

it('sortMiss names a hierarchical sort’s parent and sibling groups', () => {
  const tree = [cat('vert', 'Vertebrates'), cat('mammals', 'Mammals', 'vert'), cat('birds', 'Birds', 'vert'), cat('insects', 'Insects')];
  const bat = item('bat', 'Bat', 'mammals');
  expect(sortMiss(bat, tree, 'mammals')).toBeUndefined();
  expect(sortMiss(bat, tree, 'vert')).toBe('parent_group');
  expect(sortMiss(bat, tree, 'birds')).toBe('sibling_group');
  expect(sortMiss(bat, tree, 'insects')).toBe('wrong_group');
  expect(sortMiss(bat, tree, 'insects', 'insects')).toBe('repeated_group');
});
