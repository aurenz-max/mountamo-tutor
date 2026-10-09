// @vitest-environment jsdom
/**
 * spatial-scene levers (`spatialSceneLevers.ts`), mounted the way a lesson mounts it: a pull changes the screen and the
 * scene fact in one commit, the next attempt records it, a refused pull changes nothing, and the simpler scene is
 * ungraded and gives the full item back blank, credited after.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { SpatialSceneChallenge } from './SpatialScene';
import { positionLabel } from './spatialSceneWorkspace';
import { FEWER_LEVER, MARK_LEVER, PICTURE_LEVER, SIDES_LEVER, practiceItem } from './spatialSceneLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const objs = [
  { name: 'box', image: '📦', position: { row: 1, col: 1 } }, { name: 'ball', image: '⚽', position: { row: 0, col: 1 } },
  { name: 'tree', image: '🌳', position: { row: 2, col: 0 } }, { name: 'cat', image: '🐱', position: { row: 2, col: 2 } },
];
const IDENTIFY: SpatialSceneChallenge = { id: 'i1', type: 'identify', instruction: 'Where is the ball?', sceneObjects: objs,
  targetObject: objs[1], correctPosition: 'above', referenceObjectName: 'box', options: ['below', 'beside', 'above', 'next_to'] };
const star = { name: 'star', image: '⭐', position: { row: 0, col: 0 } };
const PLACE: SpatialSceneChallenge = { id: 'p1', type: 'place', instruction: 'Put the star above the box.',
  sceneObjects: objs.filter(o => o.name !== 'ball'), targetObject: star, correctPosition: 'above', referenceObjectName: 'box',
  correctCell: { row: 0, col: 1 }, acceptableCells: [{ row: 0, col: 1 }] };
const PLACE_IN: SpatialSceneChallenge = { id: 'n1', type: 'place_in', instruction: 'Put the star IN the basket.',
  sceneObjects: [{ name: 'basket', image: '🧺', position: { row: 1, col: 1 } }, ...objs.slice(1)], targetObject: star,
  correctPosition: 'in', referenceObjectName: 'basket', correctCell: { row: 1, col: 1 } };
const SCENE: SpatialSceneChallenge = { id: 'd1', type: 'describe_scene', instruction: 'Tell where the cat is',
  sceneObjects: [{ name: 'cat', image: '🐱', position: { row: 1, col: 0 } }, { name: 'tree', image: '🌳', position: { row: 1, col: 2 } },
    { name: 'house', image: '🏠', position: { row: 0, col: 0 } }, { name: 'flower', image: '🌸', position: { row: 0, col: 2 } }],
  targetObject: { name: 'cat', image: '🐱', position: { row: 1, col: 0 } }, correctPosition: 'left_of', referenceObjectName: 'tree',
  scenePerspective: 'viewer_depth' };
const lesson = (challenges: SpatialSceneChallenge[]) => ({ title: 'Where?', gridSize: 3, gradeBand: 'K', challenges });
const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const choose = (h: WorkspaceHarness, word: string) => { h.press(positionLabel(word)); h.press(/check/i); };
const tap = (h: WorkspaceHarness, row: number, col: number) => { h.touch(`cell-${row}-${col}`); h.press(/check/i); };
const filled = (h: WorkspaceHarness) => Array.from(q(h, '[data-pip-object^="cell-"]')).filter(c => (c.textContent ?? '').trim()).length;

it('identify: a wrong word, then the word pictures on every button in the same commit, recorded on the next try', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'identify', data: lesson([IDENTIFY]) });
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[MARK_LEVER, false], [PICTURE_LEVER, false], [FEWER_LEVER, false]]);
  choose(h, 'below');
  expect(last(h)).toMatchObject({ correct: false, miss: 'opposite_word' });
  expect(observerLever(h.state(), true)).toBe(PICTURE_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: PICTURE_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="word-picture"]')).map(p => p.getAttribute('data-word'))).toEqual(IDENTIFY.options);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Each word button has a small picture of its own word/);
  expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/above|ball/);
  expect(h.dispatch('pull_lever', { lever: PICTURE_LEVER }).status).not.toBe('committed');
  h.dispatch('retry');
  choose(h, 'above');
  expect(last(h)).toMatchObject({ itemId: 'i1', correct: true, assisted: true, levers: [PICTURE_LEVER] });
  h.close();
});

it('a refused pull changes nothing on screen, in the scene or in the attempts', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'place_in', data: lesson([PLACE_IN]) });
  expect(levers(h).map(l => l.id)).toEqual([PICTURE_LEVER, FEWER_LEVER]);
  tap(h, 0, 0);
  expect(last(h)).toMatchObject({ correct: false, miss: 'away_from_container' });
  const before = { html: h.view.container.innerHTML, levers: levers(h), attempts: h.state().task!.workspace!.attempts,
    demand: h.state().task!.demand };
  expect(h.dispatch('pull_lever', { lever: MARK_LEVER }).status).not.toBe('committed');
  expect(h.view.container.innerHTML).toBe(before.html);
  expect(levers(h)).toEqual(before.levers);
  expect(h.state().task!.workspace!.attempts).toEqual(before.attempts);
  expect(h.state().task!.demand).toEqual(before.demand);
  h.close();
});

it('place: an off-line tap, then the ring on the box only; never on an empty square', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'place', data: lesson([PLACE]) });
  tap(h, 0, 0);
  expect(last(h)).toMatchObject({ correct: false, miss: 'off_line_cell' });
  expect(observerLever(h.state(), true)).toBe(MARK_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: MARK_LEVER });
  expect(receipt.status).toBe('committed');
  expect(Array.from(q(h, '[data-lever="mark-reference"]')).map(c => c.getAttribute('data-pip-object'))).toEqual(['cell-1-1']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/the box is ringed/);
  h.dispatch('retry');
  tap(h, 0, 1);
  expect(last(h)).toMatchObject({ correct: true, levers: [MARK_LEVER] });
  h.close();
});

it('the simpler scene is ungraded and keeps its work on Try again; the full item comes back blank and is credited', () => {
  const easier = practiceItem(IDENTIFY)!;
  const wrong = easier.options!.find(o => o !== easier.correctPosition)!;
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'identify', data: lesson([IDENTIFY]) });
  choose(h, 'below');
  h.dispatch('pull_lever', { lever: PICTURE_LEVER });
  h.dispatch('pull_lever', { lever: FEWER_LEVER });
  expect(h.state().task).toMatchObject({ itemId: 'i1~simpler' });
  expect(levers(h)).toEqual([]);
  expect(filled(h)).toBe(2);
  expect(q(h, '[data-practice]')).toHaveLength(1);
  expect(q(h, '[data-lever="word-picture"]')).toHaveLength(0);
  choose(h, wrong);
  expect(last(h)).toMatchObject({ itemId: 'i1~simpler', correct: false });
  h.dispatch('retry');
  choose(h, easier.correctPosition);
  expect(last(h)).toMatchObject({ itemId: 'i1~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'i1' });
  expect(filled(h)).toBe(4);
  expect(q(h, '[data-practice]')).toHaveLength(0);
  expect(q(h, '[data-lever="word-picture"]')).toHaveLength(4);
  choose(h, 'above');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['i1', false, false], ['i1~simpler', false, true], ['i1~simpler', true, true], ['i1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [PICTURE_LEVER, FEWER_LEVER] });
  h.close();
});

it('describe_scene: the side labels go on the scene in the same commit; the relation stays hidden', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'describe_scene', data: lesson([SCENE, IDENTIFY]) });
  expect(levers(h).map(l => l.id)).toEqual([SIDES_LEVER, FEWER_LEVER]);
  expect(q(h, '[data-lever="side-labels"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: SIDES_LEVER });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="side-labels"]')).toHaveLength(1);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/left-hand picture/);
  expect(h.view.container.textContent).not.toMatch(/is left of the tree/);
  h.say('The cat is left of the tree.'); h.feedback('correct');
  expect(last(h)).toMatchObject({ itemId: 'd1', correct: true, levers: [SIDES_LEVER] });
  h.close();
});

it('easy starts with the reference ringed, and that is not a pull', () => {
  const h = mountWorkspace({ primitiveId: 'spatial-scene', evalMode: 'identify', data: lesson([{ ...IDENTIFY, supportTier: 'easy' }]) });
  expect(levers(h).find(l => l.id === MARK_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-lever="mark-reference"]')).toHaveLength(1);
  choose(h, 'above');
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});
