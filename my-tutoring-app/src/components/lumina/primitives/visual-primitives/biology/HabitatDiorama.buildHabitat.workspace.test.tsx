// @vitest-environment jsdom
/**
 * habitat-diorama's open build, `build_habitat`, on the real teaching workspace: the habitat opens empty, "I'm done!"
 * commits it, the miss is named without naming the need, Try again keeps the build, a new item opens empty, the
 * made habitat is published as numbers (so the work history records a fix), and the levers come on a miss.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
const watch = vi.hoisted(() => vi.fn());
// The live line is the shared layer's (its own leak rules are tested there): here only what the habitat asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { watch(o); return ''; } }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import { habitatBuildLevers } from './habitatBuild';

beforeEach(() => { installRuntimeTimers(); watch.mockClear(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const FROG = { id: 'frog-1', type: 'build_habitat', prompt: '', explanation: '', targetAnimal: 'frog',
  needs: ['food', 'water', 'shelter', 'weather'], trayPieces: ['pond', 'sea', 'flies', 'carrots', 'log', 'ice', 'rain', 'snow'] };
const PENGUIN = { id: 'penguin-2', type: 'build_habitat', prompt: '', explanation: '', targetAnimal: 'penguin',
  needs: ['food', 'water', 'shelter', 'weather'], trayPieces: ['sea', 'pond', 'fish', 'nuts', 'ice', 'tree', 'snow', 'sun'] };
const data = (...challenges: unknown[]): Record<string, unknown> => ({
  primitiveType: 'habitat-diorama', gradeBand: '3-5',
  habitat: { name: 'Habitat Builder', biome: 'Build a habitat', climate: '', description: 'Build a habitat.' },
  organisms: [], relationships: [], environmentalFeatures: [], challengeType: 'build_habitat', challengeTypes: ['build_habitat'], challenges,
});
const NEED_WORDS = /\b(food|water|shelter|weather|hide|drink|eat)\b/i;

function mount(...challenges: unknown[]) {
  const h = mountWorkspace({ primitiveId: 'habitat-diorama', evalMode: 'build_habitat', data: data(...challenges), instanceId: 'habitat' });
  const put = (...names: string[]) => names.forEach(n => h.press(`Put in ${n}`));
  const placed = () => Array.from(h.view.container.querySelectorAll('[data-piece]')).map(e => e.getAttribute('data-piece'));
  const demand = () => h.state().task!.demand as Record<string, unknown>;
  const last = () => h.state().task!.workspace!.attempts.at(-1);
  const levers = () => h.state().task!.workspace!.levers ?? [];
  /** Past the host window of an item opening, so the taps count as the learner's own work. */
  const later = () => act(() => { vi.advanceTimersByTime(2000); });
  return { ...h, put, placed, demand, last, levers, later };
}

it('binds as a gesture item and opens on an empty habitat: no Check, no key, no need named, levers bare', () => {
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'habitat-diorama', pin: 'build_habitat', objectiveIds: ['o'], data: data(FROG) })).not.toBeNull();
  const h = mount(FROG);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe('Build a habitat where a frog can live. Give it everything it needs.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(h.placed()).toEqual([]);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /^check|next|submit/i })).toBeNull();
  // Nothing on screen or in the scene names a need or which piece serves the frog.
  expect(h.view.container.textContent).not.toMatch(NEED_WORDS);
  expect(h.demand()).toMatchObject({ kind: 'build_habitat', piecesPlaced: 0, needsMet: 0, harmfulPieces: 0 });
  expect(JSON.stringify(h.demand())).not.toMatch(NEED_WORDS);
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['needs_list', 'help', false], ['piece_tags', 'help', false], ['fewer_needs', 'simplify', false]]);
  expect(watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ task: FROG && 'Build a habitat where a frog can live. Give it everything it needs.',
      neverSay: expect.arrayContaining(['food', 'water', 'shelter', 'weather']) }) }));
});

it('a harmful piece is named without naming it, Try again keeps the build, the fix passes, the history shows it, a new item opens empty', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(FROG, PENGUIN);
  h.later();
  h.put('Pond', 'Flies', 'Log', 'Snow');
  expect(watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true, buildKey: 'pond|flies|log|snow' }));
  expect(h.demand()).toMatchObject({ piecesPlaced: 4, needsMet: 3, harmfulPieces: 1 });
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'harmful_piece', response: 'Put in: Pond, Flies, Log, Snow' });
  const verdict = screen.getByTestId('build-verdict').textContent!;
  expect(verdict).toMatch(/^Not yet/);
  expect(verdict).not.toMatch(/snow|cold|weather|take out/i);
  h.dispatch('retry'); h.confirmVisible();
  expect(h.placed()).toEqual(['pond', 'flies', 'log', 'snow']);
  expect(screen.getByTestId('build-verdict')).toBeTruthy();
  h.later();
  h.touch('piece-3');
  expect(h.demand()).toMatchObject({ harmfulPieces: 0, workHistory: expect.stringContaining('harmfulPieces 0 → 1 → 0') });
  h.put('Rain');
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ itemId: 'frog-1', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('penguin-2');
  expect(h.placed()).toEqual([]);
  expect(screen.queryByTestId('build-verdict')).toBeNull();
  h.put('Salty sea', 'Fish', 'Ice', 'Snow');
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ itemId: 'penguin-2', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
});

it('names another animal\'s piece and several unmet needs; Clear empties the habitat', () => {
  const h = mount(FROG);
  h.put('Pond', 'Carrots', 'Log', 'Rain');
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'other_animals_piece' });
  h.dispatch('retry'); h.confirmVisible();
  h.press('Clear the habitat');
  expect(h.placed()).toEqual([]);
  h.put('Pond', 'Ice');
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'several_needs_unmet' });
});

it('help levers mark only the learner\'s pieces, stay out of the picture, and name no missing need', () => {
  const h = mount(FROG);
  h.put('Pond', 'Carrots', 'Snow');
  h.press("I'm done!");
  expect(h.dispatch('pull_lever', { lever: 'piece_tags' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="piece-tag"]')).map(t => t.textContent))
    .toEqual(['water', 'not for a frog', 'bad for a frog']);
  expect(h.dispatch('pull_lever', { lever: 'needs_list' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="needs-list"]')!.textContent).toMatch(/food.*water.*a place to hide and rest.*the right weather/);
  expect(String(h.demand().onScreen)).toMatch(/tag/);
  expect(h.dispatch('pull_lever', { lever: 'piece_tags' }).status).toBe('blocked');
  // What the watcher sees: the svg less its `data-aid` parts carries no tag.
  const picture = h.view.container.querySelector('svg[data-build-scene="habitat-diorama"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.textContent).not.toMatch(/not for|bad for|water/);
});

it('the simplify lever opens an ungraded two-need habitat, then the full item comes back empty', () => {
  const h = mount(FROG);
  h.put('Pond');
  h.press("I'm done!");
  const receipt = h.dispatch('pull_lever', { lever: 'fewer_needs' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('frog-1~fewer');
  expect(receipt.state.task!.task).toBe('Make a place where a frog can find food and water.');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'frog-1' });
  expect(h.placed()).toEqual([]);
  h.put('Stream', 'Worms');
  h.press("I'm done!");
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('frog-1');
  expect(h.placed()).toEqual([]);
  h.put('Pond', 'Flies', 'Log', 'Rain');
  h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['frog-1', false, false], ['frog-1~fewer', true, true], ['frog-1', true, false]]);
});

it('catalog and adapter: the build mode, its misses all answered by levers, and an empty build refused', () => {
  const entry = getComponentById('habitat-diorama')!;
  expect(entry.evalModes!.find(m => m.evalMode === 'build_habitat')).toMatchObject({ beta: 6.6, challengeTypes: ['build_habitat'],
    affordances: { answers: ['build'] } });
  const levers = habitatBuildLevers(['food', 'water', 'shelter', 'weather'], [], false);
  const misses = entry.teachingWorkspace!.misses!.build_habitat, unanswered = entry.teachingWorkspace!.unanswered!.build_habitat;
  for (const m of misses) expect(levers.some(l => l.answers?.includes(m)) || unanswered.includes(m), m).toBe(true);
  // The lever text names the build (putting pieces in a habitat), never another mode's action or a need it would fill.
  for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/\b(say|tap the zone|connect|pond|flies|snow)\b/i);
  const adapter = LIVE_ADAPTERS['habitat-diorama'];
  expect(adapter.validate(data(FROG))).toBeTruthy();
  expect(() => adapter.validate(data({ ...FROG, targetAnimal: 'dragon' }))).toThrow();
  // A tray that cannot meet every need is not askable.
  expect(() => adapter.validate(data({ ...FROG, trayPieces: ['sea', 'carrots', 'tree', 'snow'] }))).toThrow();
});
