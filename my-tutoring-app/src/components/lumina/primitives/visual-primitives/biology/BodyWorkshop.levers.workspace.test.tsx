// @vitest-environment jsdom
/**
 * body-workshop levers mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit; the next attempt records the lever; a refused pull changes nothing; a starting lever is drawn but never
 * recorded; the practice animal is ungraded and the full animal comes back and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { BodyWorkshopData } from './BodyWorkshop';
import { assembleBodyWorkshop } from '../../../service/biology/body-workshop-generator';
import { atlasWords } from '../../../service/biology/body-author';
import { atlasAnimal, jobFor } from './bodyAtlas';
import { seededRng, type BodyGoal, type BodyTask, type Tier } from './bodyModel';
import { practiceBody } from './bodyLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const session = (goal: BodyGoal, animals: string[], tier: Tier = 'hard', task: BodyTask = 'deliver_oxygen') => assembleBodyWorkshop(
  [{ task, authored: { calls: 0, picks: animals.map(id => ({ words: atlasWords(atlasAnimal(id)!, task, goal), source: 'atlas' as const, errors: [] })) } }],
  goal, tier, goal === 'to_muscle' ? 4 : 2, seededRng(1));
const mount = (data: BodyWorkshopData) => mountWorkspace({ primitiveId: 'body-workshop', evalMode: 'deliver_oxygen',
  instanceId: 'body', data: data as unknown as Record<string, unknown> });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const tap = (h: WorkspaceHarness, id: string) => act(() => {
  const el = h.view.container.querySelector(`[data-pip-object="${id}"]`);
  if (!el) throw new Error(`no ${id}`);
  fireEvent.click(el);
});
const build = (h: WorkspaceHarness, parts: string[]) => { tap(h, 'clear-row'); parts.forEach(p => tap(h, `part-${p}`)); h.press("I'm done!"); };
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;

it('where_it_breathes: the habitat shows air in one commit, with its fact; the next attempt records it', () => {
  const h = mount(session('into_body', ['whale']));
  build(h, ['mouth', 'gills']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'wrong_breather' });
  expect(q(h, '[data-body-lever="where_it_breathes"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'where_it_breathes' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-body-lever="where_it_breathes"]')).toHaveLength(1);
  expect(receipt.state.task!.demand).toMatchObject({ onScreen: expect.stringMatching(/top of the water to take a breath of air/) });
  expect(JSON.stringify(receipt.state.task!.demand)).not.toMatch(/blowhole →|→ windpipe/);
  h.dispatch('retry');
  build(h, ['blowhole', 'windpipe', 'lungs']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['where_it_breathes'] });
});

it('a refused pull changes nothing; show_flow and count_parts draw on every part alike and in empty slots', () => {
  const h = mount(session('into_body', ['human']));
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'x_ray' }).status).not.toBe('committed');
  expect(h.view.container.innerHTML).toBe(before);
  expect(h.dispatch('pull_lever', { lever: 'show_flow' }).status).toBe('committed');
  expect(q(h, '[data-body-flow]').length).toBe(q(h, '[data-pip-object^="part-"]').length);
  expect(h.dispatch('pull_lever', { lever: 'show_flow' }).status).not.toBe('committed');
  expect(h.dispatch('pull_lever', { lever: 'count_parts' }).status).toBe('committed');
  expect(q(h, '[data-body-slot]')).toHaveLength(3);
  tap(h, 'part-nose');
  expect(q(h, '[data-body-slot]')).toHaveLength(2);
});

it('easy starts with the food parts off the bench, listed as on screen but never recorded as help', () => {
  const h = mount(session('into_body', ['dog'], 'easy'));
  expect(q(h, '[data-pip-object="part-stomach"]')).toHaveLength(0);
  expect(levers(h)).toContainEqual(['no_food_parts', true]);
  build(h, ['nose', 'windpipe', 'lungs']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect((attempts(h).at(-1) as { levers?: string[] }).levers ?? []).toEqual([]);
});

it('easier_animal: an ungraded practice animal with a smaller bench; the full animal comes back and is credited', () => {
  const data = session('into_body', ['grasshopper']);
  const h = mount(data);
  build(h, ['nose', 'windpipe', 'lungs']);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'not_this_animal' });
  const receipt = h.dispatch('pull_lever', { lever: 'easier_animal' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('animal-1~simpler');
  expect(receipt.state.task!.workspace!.levers ?? []).toEqual([]);
  expect(q(h, '[data-practice]')).toHaveLength(1);
  const p = practiceBody(data.challenges[0])!;
  expect(q(h, '[data-pip-object^="part-"]')).toHaveLength(p.bench.length);
  build(h, [...jobFor(p.animal, p.type)!.paths.into_body[0]]);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('animal-1');
  expect(q(h, '[data-practice]')).toHaveLength(0);
  build(h, ['breathing_holes', 'air_tubes']);
  expect(attempts(h).map(x => [x.itemId, x.correct, !!(x as { practice?: boolean }).practice])).toEqual([
    ['animal-1', false, false], ['animal-1~simpler', true, true], ['animal-1', true, false]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['easier_animal'] });
});
