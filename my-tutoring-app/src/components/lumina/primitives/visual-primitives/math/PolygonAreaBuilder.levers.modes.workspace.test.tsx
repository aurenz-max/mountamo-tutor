// @vitest-environment jsdom
/**
 * polygon-area-builder levers on decompose, find_area_trapezoid, composite_area and coordinate_polygon
 * (`polygonAreaLevers.ts`), mounted the way a lesson mounts it. A pull changes the screen and the scene fact in one
 * commit and is recorded on the next attempt; a refused pull changes nothing; a simpler item is ungraded and gives the
 * full item back blank, credited after.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { PolygonAreaChallenge, PolygonAreaChallengeType } from './PolygonAreaBuilder';
import {
  CUT_LEVER, GRID_LEVER, LEFT_OUT_LEVER, OUTSIDE_LEVER, RECTANGLE_FIRST_LEVER, ROWS_LEVER, SLOT_LEVER, SMALLER_FIGURE_LEVER,
  SPLIT_LEVER, TURNED_COPY_LEVER, smallerFigure,
} from './polygonAreaLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const TRAP: PolygonAreaChallenge = { id: 'z1', type: 'find_area_trapezoid', figureType: 'trapezoid', base: 9, base2: 5, height: 4,
  topOffset: 2, expectedArea: 28, unitLabel: 'cm', narration: 'A ramp.', instruction: 'Find the area of this trapezoid.', hint: '' };
const COMP: PolygonAreaChallenge = { id: 'c1', type: 'composite_area', figureType: 'composite', parts: [{ x: 0, y: 0, w: 7, h: 3 },
  { x: 0, y: 3, w: 2, h: 4 }], expectedArea: 29, unitLabel: 'm', narration: 'A patio.', showDecompositionGuides: false,
  instruction: 'Split the figure into rectangles, find each area, then add them up.', hint: '' };
const TRI: PolygonAreaChallenge = { id: 'q1', type: 'coordinate_polygon', figureType: 'coordinate',
  vertices: [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 1, y: 5 }], expectedArea: 12, unitLabel: 'units', narration: 'A garden.',
  instruction: 'Find the area of this polygon using its vertex coordinates.', hint: '' };
const PARA: PolygonAreaChallenge = { id: 'd1', type: 'decompose', figureType: 'parallelogram', base: 8, height: 5, skew: 2,
  expectedArea: 40, unitLabel: 'ft', narration: 'A tile.', showDecompositionGuides: false,
  instruction: 'Drag the cut triangle across to rebuild it as a rectangle, then enter base × height.', hint: '' };

const mount = (c: PolygonAreaChallenge) => mountWorkspace({ primitiveId: 'polygon-area-builder', evalMode: c.type,
  data: { title: 'Area', description: '', challengeType: c.type as PolygonAreaChallengeType, gradeBand: '6', challenges: [c] } as never });
const answer = (h: WorkspaceHarness, v: string) => {
  act(() => { fireEvent.change(screen.getByLabelText('Area'), { target: { value: v } }); });
  h.press('Check');
};
const marks = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-lever]')).map(n => n.getAttribute('data-lever'));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const frozen = (h: WorkspaceHarness) => JSON.stringify([h.state().task!.demand, levers(h), h.state().task!.workspace!.attempts, marks(h)]);

it('trapezoid: the half left out, then the turned copy in one commit, recorded on the next try', () => {
  const h = mount(TRAP);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[GRID_LEVER, 'help', false], [CUT_LEVER, 'help', false],
    [TURNED_COPY_LEVER, 'help', false], [SMALLER_FIGURE_LEVER, 'simplify', false]]);
  answer(h, '56');
  expect(last(h)).toMatchObject({ correct: false, miss: 'forgot_half' });
  expect(observerLever(h.state(), true)).toBe(TURNED_COPY_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: TURNED_COPY_LEVER });
  expect(receipt.status).toBe('committed');
  expect(marks(h)).toEqual(['turned-copy']);
  const onScreen = String(receipt.state.task!.demand.onScreen);
  expect(onScreen).toMatch(/copy of the trapezoid turned upside down/);
  expect(onScreen).not.toMatch(/\d|half/);
  // A refused pull changes nothing: the same lever again, and a lever this item does not have.
  const before = frozen(h);
  expect(h.dispatch('pull_lever', { lever: TURNED_COPY_LEVER }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: SPLIT_LEVER }).status).toBe('blocked');
  expect(frozen(h)).toBe(before);
  h.dispatch('retry');
  answer(h, '28');
  expect(last(h)).toMatchObject({ itemId: 'z1', correct: true, assisted: true, levers: [TURNED_COPY_LEVER] });
  h.close();
});

it('composite: the left-out piece is refused until a one-piece answer, then outlined; the split draws the pieces', () => {
  const h = mount(COMP);
  expect(levers(h).map(l => l.id)).toEqual([SPLIT_LEVER, LEFT_OUT_LEVER, ROWS_LEVER, SMALLER_FIGURE_LEVER]);
  answer(h, '30');
  expect(last(h)).toMatchObject({ miss: 'wrong_area' });
  const before = frozen(h);
  expect(h.dispatch('pull_lever', { lever: LEFT_OUT_LEVER }).status).toBe('blocked');
  expect(frozen(h)).toBe(before);
  h.dispatch('retry');
  answer(h, '21');
  expect(last(h)).toMatchObject({ correct: false, miss: 'one_piece' });
  expect(observerLever(h.state(), true)).toBe(LEFT_OUT_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: LEFT_OUT_LEVER });
  expect(receipt.status).toBe('committed');
  expect(marks(h)).toEqual(['left-out-piece']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/left out are outlined in bold/);
  expect(h.dispatch('pull_lever', { lever: SPLIT_LEVER }).status).toBe('committed');
  expect(marks(h)).toEqual(['split-pieces', 'left-out-piece']);
  // The learner's own typed 21 is their work; the total and the left-out piece's area are never said.
  expect(Object.values(h.state().task!.demand).join(' ')).not.toMatch(/\b(29|8)\b/);
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/\d/);
  h.dispatch('retry');
  answer(h, '29');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [LEFT_OUT_LEVER, SPLIT_LEVER] });
  h.close();
});

it('coordinate triangle: the box answer, then the outside tinted; the rectangle first is ungraded and gives the full item back blank, credited after', () => {
  const h = mount(TRI);
  expect(levers(h).map(l => l.id)).toEqual([OUTSIDE_LEVER, RECTANGLE_FIRST_LEVER]);
  answer(h, '24');
  expect(last(h)).toMatchObject({ correct: false, miss: 'bounding_box' });
  expect(observerLever(h.state(), true)).toBe(OUTSIDE_LEVER);
  expect(h.dispatch('pull_lever', { lever: OUTSIDE_LEVER }).status).toBe('committed');
  expect(marks(h)).toEqual(['outside-box']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/part of it outside the polygon is tinted/);
  const small = smallerFigure(TRI)!;
  const receipt = h.dispatch('pull_lever', { lever: RECTANGLE_FIRST_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('q1~smaller');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'q1' });
  expect(receipt.state.task!.demand.practice).toMatch(/not graded/);
  expect(levers(h)).toEqual([]);
  expect(marks(h)).toEqual([]);
  expect((screen.getByLabelText('Area') as HTMLInputElement).value).toBe('');
  answer(h, String(small.expectedArea));
  expect(last(h)).toMatchObject({ itemId: 'q1~smaller', correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('q1');
  expect((screen.getByLabelText('Area') as HTMLInputElement).value).toBe('');
  expect(marks(h)).toEqual(['outside-box']);
  answer(h, '12');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['q1', false, false], ['q1~smaller', true, true], ['q1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [OUTSIDE_LEVER, RECTANGLE_FIRST_LEVER] });
  h.close();
});

it('decompose at hard: the slot lever draws the slot; the smaller parallelogram opens with its slot drawn', () => {
  const h = mount(PARA);
  expect(levers(h).map(l => [l.id, l.pulled])).toEqual([[SLOT_LEVER, false], [GRID_LEVER, false], [SMALLER_FIGURE_LEVER, false]]);
  const receipt = h.dispatch('pull_lever', { lever: SLOT_LEVER });
  expect(receipt.status).toBe('committed');
  expect(marks(h)).toEqual(['show-slot']);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/dashed slot where the cut triangle fits/);
  const small = smallerFigure(PARA)!;
  expect(small.showDecompositionGuides).toBe(true);
  const practice = h.dispatch('pull_lever', { lever: SMALLER_FIGURE_LEVER });
  expect(practice.status).toBe('committed');
  expect(practice.state.task!.itemId).toBe('d1~smaller');
  expect(practice.state.task!.demand.rearranged).toBe('no');
  expect(String(practice.state.task!.demand.figure)).toMatch(new RegExp(`base \\(${small.base} ft\\)`));
  h.close();
});
