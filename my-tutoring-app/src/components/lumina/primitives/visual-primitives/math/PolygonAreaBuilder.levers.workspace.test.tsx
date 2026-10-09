// @vitest-environment jsdom
/**
 * polygon-area-builder `find_area_triangle_parallelogram` levers (`polygonAreaLevers.ts`), mounted the way a lesson mounts
 * it. A pull changes the screen and the scene fact in one commit and is recorded on the next attempt; a refused pull
 * changes nothing; the smaller figure is ungraded and gives the full item back blank, credited after.
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
import type { PolygonAreaChallenge, PolygonAreaBuilderData } from './PolygonAreaBuilder';
import { GRID_LEVER, HALF_LEVER, SLIDE_LEVER, SMALLER_FIGURE_LEVER, smallerFigure } from './polygonAreaLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const TRI: PolygonAreaChallenge = { id: 't1', type: 'find_area_triangle_parallelogram', figureType: 'triangle', base: 8, height: 5,
  apexX: 3, expectedArea: 20, unitLabel: 'cm', narration: 'A sail.', instruction: 'Find the area of this triangle.', hint: '' };
const PARA: PolygonAreaChallenge = { id: 'p1', type: 'find_area_triangle_parallelogram', figureType: 'parallelogram', base: 7,
  height: 4, skew: 2, expectedArea: 28, unitLabel: 'm', narration: 'A tile.', instruction: 'Find the area of this parallelogram.', hint: '' };
const lesson = (challenges: PolygonAreaChallenge[]): PolygonAreaBuilderData => ({ title: 'Area', description: '',
  challengeType: 'find_area_triangle_parallelogram', gradeBand: '6', challenges });
const mount = (challenges: PolygonAreaChallenge[]) => mountWorkspace({ primitiveId: 'polygon-area-builder',
  evalMode: 'find_area_triangle_parallelogram', data: lesson(challenges) as never });
const answer = (h: WorkspaceHarness, v: string) => {
  act(() => { fireEvent.change(screen.getByLabelText('Area'), { target: { value: v } }); });
  h.press('Check');
};
const marks = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('[data-lever]')).map(n => n.getAttribute('data-lever'));
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);

it('triangle: the half left out, then the rectangle picture in one commit, recorded on the next try', () => {
  const h = mount([TRI]);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([
    [GRID_LEVER, 'help', false], [HALF_LEVER, 'help', false], [SMALLER_FIGURE_LEVER, 'simplify', false]]);
  expect(marks(h)).toEqual([]);
  answer(h, '40');
  expect(last(h)).toMatchObject({ correct: false, miss: 'forgot_half' });
  expect(observerLever(h.state(), true)).toBe(HALF_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: HALF_LEVER });
  expect(receipt.status).toBe('committed');
  expect(marks(h)).toEqual(['half-of-rectangle']);
  const onScreen = String(receipt.state.task!.demand.onScreen);
  expect(onScreen).toMatch(/dashed rectangle with the same base and height/);
  expect(onScreen).not.toMatch(/\d/);
  expect(receipt.state.task!.workspace!.levers!.find(l => l.id === HALF_LEVER)!.pulled).toBe(true);
  // A refused pull changes nothing.
  const before = JSON.stringify([h.state().task!.demand, levers(h), h.state().task!.workspace!.attempts]);
  expect(h.dispatch('pull_lever', { lever: HALF_LEVER }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: SLIDE_LEVER }).status).toBe('blocked');
  expect(JSON.stringify([h.state().task!.demand, levers(h), h.state().task!.workspace!.attempts])).toBe(before);
  expect(marks(h)).toEqual(['half-of-rectangle']);
  h.dispatch('retry');
  answer(h, '20');
  expect(last(h)).toMatchObject({ itemId: 't1', correct: true, assisted: true, levers: [HALF_LEVER] });
  h.close();
});

it('parallelogram: half the area, then the slid corner; the grid lever draws the grid', () => {
  const h = mount([PARA]);
  expect(levers(h).map(l => l.id)).toEqual([GRID_LEVER, SLIDE_LEVER, SMALLER_FIGURE_LEVER]);
  answer(h, '14');
  expect(last(h)).toMatchObject({ correct: false, miss: 'halved' });
  expect(observerLever(h.state(), true)).toBe(SLIDE_LEVER);
  expect(h.dispatch('pull_lever', { lever: SLIDE_LEVER }).status).toBe('committed');
  expect(h.dispatch('pull_lever', { lever: GRID_LEVER }).status).toBe('committed');
  expect(marks(h)).toEqual(['unit-grid', 'slide-corner']);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/unit grid is drawn.*copy of it is drawn moved/);
  expect(Object.values(h.state().task!.demand).join(' ')).not.toMatch(/\b28\b/);
  h.dispatch('retry');
  answer(h, '28');
  expect(last(h)).toMatchObject({ correct: true, levers: [SLIDE_LEVER, GRID_LEVER] });
  h.close();
});

it('the smaller figure is ungraded, keeps its item on Try again, and gives the full item back blank, credited after', () => {
  const h = mount([TRI]);
  answer(h, '13');
  expect(last(h)).toMatchObject({ miss: 'added_sides' });
  const small = smallerFigure(TRI)!;
  const receipt = h.dispatch('pull_lever', { lever: SMALLER_FIGURE_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('t1~smaller');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 't1' });
  expect(String(receipt.state.task!.demand.figure)).toMatch(new RegExp(`base ${small.base} cm`));
  expect(receipt.state.task!.demand.practice).toMatch(/not graded/);
  expect(levers(h)).toEqual([]);
  expect((screen.getByLabelText('Area') as HTMLInputElement).value).toBe('');
  answer(h, String(small.expectedArea * 2));
  expect(last(h)).toMatchObject({ itemId: 't1~smaller', correct: false, miss: 'forgot_half' });
  h.dispatch('retry');
  expect(h.state().task!.itemId).toBe('t1~smaller');
  answer(h, String(small.expectedArea));
  expect(last(h)).toMatchObject({ itemId: 't1~smaller', correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t1');
  expect((screen.getByLabelText('Area') as HTMLInputElement).value).toBe('');
  expect(String(h.state().task!.demand.figure)).toMatch(/base 8 cm/);
  answer(h, '20');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['t1', false, false], ['t1~smaller', false, true], ['t1~smaller', true, true], ['t1', true, false]]);
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [SMALLER_FIGURE_LEVER] });
  h.close();
});

it('an easy tier starts with the grid on screen: shown as pulled, refused as a pull, not recorded', () => {
  const h = mount([{ ...TRI, showGridOverlay: true, supportTier: 'easy' }]);
  expect(levers(h).find(l => l.id === GRID_LEVER)!.pulled).toBe(true);
  expect(String(h.state().task!.demand.onScreen)).toMatch(/unit grid/);
  expect(h.dispatch('pull_lever', { lever: GRID_LEVER }).status).toBe('blocked');
  answer(h, '20');
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});
