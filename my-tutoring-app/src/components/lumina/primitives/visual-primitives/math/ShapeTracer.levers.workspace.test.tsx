// @vitest-environment jsdom
/**
 * shape-tracer levers on the real workspace: a pull changes the screen and the scene fact in the same commit, the next
 * attempt records it, a pull that would change nothing is refused, and the simpler item is ungraded and gives the full
 * item back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ShapeTracerChallenge } from './ShapeTracer';
import { drawCorners } from './shapeTracerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mount = (evalMode: string, challenges: ShapeTracerChallenge[]) => {
  const h = mountWorkspace({ primitiveId: 'shape-tracer', evalMode, instanceId: 'shapes',
    data: { title: 'Shapes', gradeBand: 'K', gridSize: 50, showPropertyReminder: true, challenges } });
  h.settle(2000);
  return h;
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const onScreen = (h: WorkspaceHarness) => String(demand(h).onScreen ?? '');
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(demand(h)), levers: levers(h), html: h.view.container.innerHTML });
const taps = (h: WorkspaceHarness, prefix: string, ids: number[]) => ids.forEach(i => h.touch(`${prefix}-${i}`));

const SQ = [{ x: 150, y: 100 }, { x: 350, y: 100 }, { x: 350, y: 300 }, { x: 150, y: 300 }];
const DOTS: ShapeTracerChallenge = { id: 'd', type: 'connect-dots', instruction: 'Connect the dots to discover the hidden shape!',
  targetShape: 'square', dots: SQ.map((p, i) => ({ ...p, label: String(i + 1) })), correctOrder: [0, 1, 2, 3], revealShape: 'square' };
const DRAW: ShapeTracerChallenge = { id: 'f', type: 'draw-from-description', instruction: 'Read the clue and draw the shape!',
  targetShape: 'square', description: 'A shape with 4 equal sides and 4 corners', requiredProperties: { sides: 4, corners: 4, allSidesEqual: true } };
const HARD = { showGuidePath: false, showDirectionArrows: false, showNextCue: false, showOrderNumbers: false, supportTier: 'hard' as const };

it('connect_dots: the number strip appears above the picture in the same commit, marks no dot, and the next attempt records it', () => {
  const h = mount('connect_dots', [DOTS]);
  expect(levers(h)).toEqual([['number_strip', false], ['fade_joined', false], ['simpler_item', false]]);
  taps(h, 'dot', [0]); h.touch('dot-2');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'skipped_number' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'skipped_number')).toBe('number_strip');
  const dotsBefore = q(h, '[data-pip-object^="dot-"]').map(d => d.innerHTML);
  const receipt = h.dispatch('pull_lever', { lever: 'number_strip' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/counting order/);
  expect(onScreen(h)).not.toMatch(/\d/);
  const strip = q(h, '[data-lever="number_strip"] span').map(s => s.textContent);
  expect(strip).toEqual(['1 ✓', '2', '3', '4']);
  expect(q(h, '[data-pip-object^="dot-"]').map(d => d.innerHTML)).toEqual(dotsBefore);
  // A repeat pull is refused and changes nothing.
  const once = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'number_strip' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(once);
  // Try again keeps the joined dot (it was right); the rest in order finish the shape.
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'Joined 1' });
  taps(h, 'dot', [1, 2, 3]);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'd', correct: true, levers: ['number_strip'] });
});

it('connect_dots: fade_joined is refused while no dot is joined, then turns the joined dots into ticks', () => {
  const h = mount('connect_dots', [DOTS]);
  h.touch('dot-1');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'started_elsewhere' });
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'fade_joined' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  taps(h, 'dot', [0, 1]); h.touch('dot-0');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'went_back' });
  expect(h.dispatch('pull_lever', { lever: 'fade_joined' }).status).toBe('committed');
  expect(q(h, '[data-pip-object="dot-0"] text')[0].textContent).toBe('✓');
  expect(q(h, '[data-pip-object="dot-2"] text')[0].textContent).toBe('3');
  expect(onScreen(h)).toMatch(/green tick/);
});

it('connect_dots: the simpler item is three dots, ungraded; the full item comes back and is credited after', () => {
  const h = mount('connect_dots', [DOTS]);
  h.touch('dot-3');
  const receipt = h.dispatch('pull_lever', { lever: 'simpler_item' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('d~simpler');
  expect(h.view.container.textContent).toMatch(/Practice/);
  expect(q(h, '[data-pip-object^="dot-"]')).toHaveLength(3);
  // The hidden practice shape is not named before it is joined.
  expect(JSON.stringify(demand(h))).not.toMatch(/triangle/);
  taps(h, 'dot', [0, 1, 2]);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('d');
  expect(q(h, '[data-pip-object^="dot-"]')).toHaveLength(4);
  expect(demand(h)).toMatchObject({ learnerWork: 'No dot joined yet' });
  taps(h, 'dot', [0, 1, 2, 3]);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!a.practice])).toEqual([
    ['d', false, false], ['d~simpler', true, true], ['d', true, false]]);
});

it('draw_from_description: the corner rings and the side bars show the learner\'s own work against the clue', () => {
  const h = mount('draw_from_description', [DRAW]);
  expect(levers(h)).toEqual([['corner_rings', false], ['side_bars', false], ['simpler_item', false]]);
  // Bars before any corner change nothing, so they are refused.
  expect(h.dispatch('pull_lever', { lever: 'side_bars' }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: 'corner_rings' }).status).toBe('committed');
  expect(q(h, '[data-lever="corner_rings"] span')).toHaveLength(4);
  const corners = drawCorners(DRAW, 50);
  taps(h, 'grid', corners.slice(0, 3));
  expect(q(h, '[data-lever="corner_rings"] span.bg-emerald-400\\/60')).toHaveLength(3);
  h.press(/check shape/i);
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'too_few_sides', levers: ['corner_rings'] });
  expect(h.dispatch('pull_lever', { lever: 'side_bars' }).status).toBe('committed');
  expect(q(h, '[data-lever="side_bars"] div')).toHaveLength(3);
  expect(onScreen(h)).not.toMatch(/\d/);
  h.dispatch('retry');
  taps(h, 'grid', corners);
  h.press(/check shape/i);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['corner_rings', 'side_bars'] });
});

it('trace: on a hard item the guide levers turn the outline, the numbers and the glow back on; the easier item is a triangle', () => {
  const h = mount('trace', [{ id: 't', type: 'trace', instruction: 'Trace the square!', targetShape: 'square', tracePath: SQ, ...HARD }]);
  expect(levers(h)).toEqual([['dotted_outline', false], ['order_numbers', false], ['next_glow', false], ['simpler_item', false]]);
  expect(demand(h)).toMatchObject({ orderNumbers: 'hidden', dottedOutline: 'hidden' });
  expect(h.dispatch('pull_lever', { lever: 'order_numbers' }).status).toBe('committed');
  expect(demand(h)).toMatchObject({ orderNumbers: 'shown' });
  expect(q(h, '[data-pip-object="vertex-0"] text')[0].textContent).toBe('1');
  expect(h.dispatch('pull_lever', { lever: 'dotted_outline' }).status).toBe('committed');
  expect(demand(h)).toMatchObject({ dottedOutline: 'shown' });
  expect(h.dispatch('pull_lever', { lever: 'simpler_item' }).status).toBe('committed');
  expect(q(h, '[data-pip-object^="vertex-"]')).toHaveLength(3);
  // The practice item keeps the item's tier (no numbers); its guides are not the session item's pulls.
  expect(demand(h)).toMatchObject({ orderNumbers: 'hidden' });
  taps(h, 'vertex', [1, 2, 0]);
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t');
  taps(h, 'vertex', [0, 1, 2, 3]);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 't', correct: true, levers: ['order_numbers', 'dotted_outline', 'simpler_item'] });
});

it('complete: the outline lever draws the whole shape through the open corners', () => {
  const h = mount('complete', [{ id: 'c', type: 'complete', instruction: 'Finish the square!', targetShape: 'square',
    drawnSides: [{ from: SQ[0], to: SQ[1] }], remainingVertices: [SQ[2], SQ[3]], showNextCue: false }]);
  expect(levers(h)).toEqual([['dotted_outline', false], ['next_glow', false], ['simpler_item', false]]);
  expect(q(h, '[data-lever="dotted_outline"]')).toHaveLength(0);
  expect(h.dispatch('pull_lever', { lever: 'dotted_outline' }).status).toBe('committed');
  expect(q(h, '[data-lever="dotted_outline"]')).toHaveLength(1);
  expect(onScreen(h)).toMatch(/dashed outline/);
  expect(h.dispatch('pull_lever', { lever: 'next_glow' }).status).toBe('committed');
  expect(demand(h)).toMatchObject({ nextDotGlow: 'shown' });
  taps(h, 'remaining', [0, 1]);
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['dotted_outline', 'next_glow'] });
});
