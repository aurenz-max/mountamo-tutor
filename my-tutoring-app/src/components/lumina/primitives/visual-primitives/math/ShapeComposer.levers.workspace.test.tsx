// @vitest-environment jsdom
/**
 * shape-composer levers, mounted the way a lesson mounts them. A pull changes the screen and the scene fact in one
 * commit and draws no number; the next attempt records the lever; a refused pull changes nothing; a simpler item is
 * ungraded practice of the same mode and the full item comes back blank and is credited after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ShapeComposerChallenge } from './ShapeComposer';

beforeAll(() => {
  (SVGElement.prototype as any).getScreenCTM = () => ({ inverse: () => ({}) });
  (globalThis as any).DOMPoint = class { constructor(public x = 0, public y = 0) {} matrixTransform() { return { x: this.x, y: this.y }; } };
  if (!(window as any).PointerEvent) (window as any).PointerEvent = MouseEvent;
});
beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mount = (mode: ShapeComposerChallenge['type'], challenges: ShapeComposerChallenge[]) => {
  const h = mountWorkspace({ primitiveId: 'shape-composer', evalMode: mode, data: { title: 'Shapes', gradeBand: 'K', challenges } });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });
const board = (h: WorkspaceHarness) => q(h, '[data-pip-object^="piece-"]').map(el => {
  const [, x, y] = /translate\(([-\d.]+), ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '')!;
  return { el, shape: el.getAttribute('data-shape')!, x: Number(x), y: Number(y), mark: el.getAttribute('data-lever-mark') };
});
const drag = (h: WorkspaceHarness, shape: string, x: number, y: number) => {
  const p = board(h).filter(b => b.shape === shape).at(-1)!;
  const svg = h.view.container.querySelector('[data-pip-object="canvas"] svg')!;
  act(() => { fireEvent.pointerDown(p.el, { clientX: p.x + 1, clientY: p.y + 1 }); });
  act(() => { fireEvent.pointerMove(svg, { clientX: x + 1, clientY: y + 1 }); });
  act(() => { fireEvent.pointerUp(svg); });
};
const write = (h: WorkspaceHarness, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="How many pieces"]')!, { target: { value: text } });
});

const DECOMPOSE: ShapeComposerChallenge = { id: 'd1', type: 'decompose', instruction: 'What shapes make this house?',
  compositeShapePath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', expectedComponents: [{ shape: 'triangle', count: 2 }, { shape: 'square', count: 1 }],
  divisionLineHints: [{ x1: 0, y1: 0, x2: 100, y2: 100 }, { x1: 0, y1: 50, x2: 100, y2: 50 }] };
const MATCH: ShapeComposerChallenge = { id: 'm1', type: 'compose-match', instruction: 'Fill the house.', targetShape: 'house',
  targetOutlinePath: 'M 100 0 L 200 100 L 200 200 L 100 200 Z', showSeams: false,
  pieces: [{ id: 'p1', shape: 'square', color: '#00f', width: 100, height: 100, targetX: 100, targetY: 100 },
    { id: 'p2', shape: 'triangle', color: '#f0f', width: 100, height: 100, targetX: 100, targetY: 0 }] };
const PICTURE: ShapeComposerChallenge = { id: 'p1', type: 'compose-picture', instruction: 'Build a snowman.', targetPicture: 'snowman',
  showSnapGuides: false, availableShapes: [{ shape: 'circle', color: '#fff', count: 3 }],
  pictureSlots: [0, 1, 2].map(i => ({ id: `s${i}`, shape: 'circle', x: 150, y: 20 + 100 * i, width: 100, height: 100, rotation: 0 })) };
const HEXAGON: ShapeComposerChallenge = { id: 'h1', type: 'how-many-ways', instruction: 'How many triangles do you need to build a hexagon?',
  targetForComposition: 'hexagon', allowedPieces: ['triangle'], minimumPiecesNeeded: 6 };
const BUILD: ShapeComposerChallenge = { id: 'f1', type: 'free-create', instruction: 'Make your own picture with two triangles and one square.',
  recipe: [{ shape: 'triangle', count: 2 }, { shape: 'square', count: 1 }] };

it('decompose: the parts model shows in the same commit, names none of the parts and no number, the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('decompose', [DECOMPOSE]);
  expect(levers(h)).toEqual([['parts_model', false], ['two_parts', false]]);
  h.press('triangle'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'missed_part' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'missed_part')).toBe('parts_model');
  expect(q(h, '[data-lever="parts-model"]')).toHaveLength(0);
  const receipt = h.dispatch('pull_lever', { lever: 'parts_model' });
  expect(receipt.status).toBe('committed');
  const onScreen = String(receipt.state.task!.demand.onScreen);
  expect(onScreen).toMatch(/semicircle/);
  expect(onScreen).not.toMatch(/\d|triangle|\bsquare/);
  expect(q(h, '[data-lever="parts-model"]')[0].textContent).not.toMatch(/\d|triangle|square/);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'parts_model' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  h.press('triangle'); h.press('triangle'); h.press('square'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'd1', correct: true, levers: ['parts_model'] });
});

it('decompose: split lines draw only where the session hides them; two parts is ungraded practice, then the full item', () => {
  const h = mount('decompose', [{ ...DECOMPOSE, showSeams: false }]);
  expect(levers(h).map(l => l[0])).toEqual(['split_lines', 'parts_model', 'two_parts']);
  expect(q(h, 'svg line')).toHaveLength(0);
  h.press('circle'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'not_a_part' });
  h.dispatch('pull_lever', { lever: 'split_lines' });
  expect(q(h, 'svg line')).toHaveLength(2);
  expect(h.state().task!.demand).toMatchObject({ splitLines: 'shown: dashed lines inside it' });
  const r = h.dispatch('pull_lever', { lever: 'two_parts' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('d1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'd1' });
  h.press('square'); h.press('square'); h.press('Check Answer');
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('d1');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No shapes tapped yet' });
  h.press('triangle'); h.press('triangle'); h.press('square'); h.press('Check Answer');
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['d1', false, false], ['d1~simpler', true, true], ['d1', true, false]]);
});

it('compose-match: in place is refused on an empty board; then it rings the learner\'s pieces and the empty space lights', () => {
  const h = mount('compose-match', [MATCH]);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'in_place' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.press('square'); drag(h, 'square', 100, 100);
  h.press('triangle');
  h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'piece_off_outline' });
  h.dispatch('pull_lever', { lever: 'in_place' });
  expect(board(h).map(b => [b.shape, b.mark])).toEqual([['square', 'in-place'], ['triangle', 'not-in-place']]);
  h.dispatch('pull_lever', { lever: 'empty_space' });
  expect(q(h, '[data-lever="empty-space"]')).toHaveLength(1);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  h.dispatch('retry');
  drag(h, 'triangle', 105, 5); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['in_place', 'empty_space'] });
});

it('compose-picture: empty spots glow where no shape sits, even with the spots hidden', () => {
  const h = mount('compose-picture', [PICTURE]);
  h.press('circle'); drag(h, 'circle', 150, 20);
  h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'shape_missing' });
  h.dispatch('pull_lever', { lever: 'empty_spots' });
  expect(q(h, '[data-lever="empty-spot"]')).toHaveLength(2);
  const r = h.dispatch('pull_lever', { lever: 'smaller_picture' });
  expect(r.state.task!.itemId).toBe('p1~simpler');
  expect(JSON.stringify(r.state.task!.demand)).not.toMatch(/snowman/);
  expect(q(h, '[data-lever="empty-spot"]')).toHaveLength(0);
});

it('how-many-ways: the pieces model writes no number; the smaller build is practice, then the full item', () => {
  const h = mount('how-many-ways', [HEXAGON]);
  write(h, '3'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'too_few' });
  h.dispatch('pull_lever', { lever: 'pieces_model' });
  expect(q(h, '[data-lever="pieces-model"] rect')).toHaveLength(3);
  expect(q(h, '[data-lever="pieces-model"]')[0].textContent).toBe('');
  const r = h.dispatch('pull_lever', { lever: 'smaller_build' });
  expect(r.state.task!.itemId).toBe('h1~simpler');
  write(h, '2'); h.press('Check Answer');
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('h1');
  write(h, '6'); h.press('Check Answer');
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'h1', correct: true });
});

it('free-create: join marks ring each shape by touching, list match lights the list; the shorter list is practice', () => {
  const h = mount('free-create', [BUILD]);
  expect(h.dispatch('pull_lever', { lever: 'join_marks' }).status).toBe('blocked');
  h.press('triangle'); h.press('square'); h.press("I'm done!");
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'missing_piece' });
  h.dispatch('pull_lever', { lever: 'list_match' });
  expect(q(h, '[data-lever="list-lit"]')).toHaveLength(2);
  h.dispatch('pull_lever', { lever: 'join_marks' });
  expect(board(h).map(b => b.mark)).toEqual(['alone', 'alone']);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  const r = h.dispatch('pull_lever', { lever: 'smaller_recipe' });
  expect(r.state.task!.itemId).toBe('f1~simpler');
  expect(r.state.task!.task).toMatch(/one triangle and one square/);
  expect(board(h)).toHaveLength(0);
});
