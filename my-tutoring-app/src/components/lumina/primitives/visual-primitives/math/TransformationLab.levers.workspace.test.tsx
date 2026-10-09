// @vitest-environment jsdom
/**
 * transformation-lab levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit,
 * the next attempt records it, a refused pull changes nothing, and the easier item is ungraded practice with the full
 * item back after it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { GridPoint, TransformationLabChallenge, TransformationLabData } from './TransformationLab';
import { GRID_TARGET, fmtPoint, transformHarnessInputs, type TransformHarnessInput } from './transformationLabWorkspace';
import { simplerItem } from './transformationLabLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

function dragOnGrid(h: WorkspaceHarness, strokes: { x: number; y: number }[][]) {
  const canvas = h.view.container.querySelector(`canvas[data-pip-object="${GRID_TARGET}"]`) as HTMLCanvasElement;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height,
    right: canvas.width, bottom: canvas.height, x: 0, y: 0, toJSON: () => ({}) });
  for (const stroke of strokes) {
    act(() => { fireEvent.mouseDown(canvas, { clientX: stroke[0].x, clientY: stroke[0].y }); });
    for (const p of stroke.slice(1)) act(() => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    act(() => { fireEvent.mouseUp(canvas); });
  }
}
const perform = (h: WorkspaceHarness, inputs: TransformHarnessInput[]) => {
  for (const a of inputs) {
    if (a.type === 'draw') dragOnGrid(h, a.strokes);
    else if (a.type === 'choose') h.press(a.label);
    else h.press('Check');
  }
};
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const snapshot = (h: WorkspaceHarness) => ({ demand: JSON.stringify(h.state().task!.demand), levers: levers(h),
  attempts: attempts(h).length, html: h.view.container.innerHTML });

const P = (x: number, y: number): GridPoint => ({ x, y });
const base = { narration: 'A shape moves.', hint: 'Use the rule.' };
const rotation: TransformationLabChallenge = { ...base, id: 'r1', type: 'apply_rotation', answerKind: 'drag',
  instruction: 'Rotate the figure 90° counterclockwise about the origin. Drag each pink corner to its image.',
  preImage: [P(1, 3), P(4, 3), P(2, 5)], expectedImage: [P(-3, 1), P(-3, 4), P(-5, 2)],
  transformLabel: 'Rotation 90° counterclockwise about the origin' };
const dilation: TransformationLabChallenge = { ...base, id: 'd1', type: 'dilation_similarity', answerKind: 'drag',
  instruction: 'Dilate the figure by a scale factor of 2 about the origin. Drag each pink corner to its image.',
  preImage: [P(1, 0), P(3, 0), P(1, 2)], expectedImage: [P(2, 0), P(6, 0), P(2, 4)],
  transformLabel: 'Dilation about the origin by scale factor 2', isSimilarity: true, scaleFactor: 2 };
const identify: TransformationLabChallenge = { ...base, id: 'i1', type: 'identify_transformation', answerKind: 'identify',
  instruction: 'A single transformation maps the cyan pre-image onto the amber image. Which transformation is it?',
  preImage: [P(1, 1), P(3, 1), P(1, 4)], expectedImage: [P(1, -1), P(3, -1), P(1, -4)], transformLabel: 'Reflection over the x-axis',
  options: ['Rotation 90° counterclockwise about the origin', 'Reflection over the x-axis', 'Reflection over the y-axis',
    'Rotation 180° about the origin'], correctOption: 1 };
const compose: TransformationLabChallenge = { ...base, id: 'c1', type: 'compose_sequence', answerKind: 'sequence',
  instruction: 'Use the transformation buttons to move the pink figure exactly onto the dashed target. It takes more than one move.',
  preImage: [P(1, 1), P(3, 1), P(1, 2)], expectedImage: [P(0, 2), P(-2, 2), P(0, 3)],
  transformLabel: 'Reflection over the y-axis followed by a translation by (1, 1)' };
// The hard tier's starting position: no pre-image labels, no rule card.
const lab = (c: TransformationLabChallenge): TransformationLabData => ({ title: 'Transformations', description: '',
  challengeType: c.type, gradeBand: '8', challenges: [{ ...c, supportTier: 'hard', showPreImageCoords: false }] });
const mount = (mode: string, c: TransformationLabChallenge) => {
  const h = mountWorkspace({ primitiveId: 'transformation-lab', evalMode: mode, data: lab(c) as unknown as Record<string, unknown> });
  h.settle(2000);
  return h;
};
const imageCorners = (c: TransformationLabChallenge) => c.expectedImage.map(fmtPoint);

it('apply_rotation: the model point is drawn in the same commit, named in the facts; the next attempt records it; a repeat pull changes nothing', () => {
  const h = mount('apply_rotation', rotation);
  expect(levers(h)).toEqual([['corner_letters', false], ['model_point', false], ['pre_coords', false], ['rule_card', false],
    ['simpler_figure', false]]);
  perform(h, transformHarnessInputs(rotation, 'wrong'));
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'wrong_direction' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_direction')).toBe('model_point');
  const receipt = h.dispatch('pull_lever', { lever: 'model_point' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/model point P at \(-?\d+, -?\d+\) and its image P′ at/);
  expect(q(h, '[data-lever="model-point"]')).toHaveLength(1);
  const before = snapshot(h);
  expect(h.dispatch('pull_lever', { lever: 'model_point' }).status).toBe('blocked');
  expect(snapshot(h)).toEqual(before);
  h.dispatch('retry');
  perform(h, transformHarnessInputs(rotation, 'correct'));
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'r1', correct: true, levers: ['model_point'] });
});

it.each([['apply_rotation', rotation], ['dilation_similarity', dilation]] as const)('%s: every help lever on a hard-tier item draws without naming an image corner, and the item still credits', (mode, c) => {
  {
    const h = mount(mode, c);
    perform(h, transformHarnessInputs(c, 'wrong'));
    const help = h.state().task!.workspace!.levers!.filter(l => l.kind === 'help').map(l => l.id);
    if (mode === 'dilation_similarity') expect(help[0]).toBe('origin_rays');
    for (const id of help) expect(h.dispatch('pull_lever', { lever: id }).status, id).toBe('committed');
    expect(q(h, '[data-lever]').map(e => e.getAttribute('data-lever')).sort())
      .toEqual(['corner-letters', 'model-point', ...(mode === 'dilation_similarity' ? ['origin-rays'] : []), 'pre-coords', 'rule-card'].sort());
    expect(q(h, '[data-lever="rule-card"]')[0].textContent).toMatch(/\(x, y\) → \(/);
    const text = h.view.container.textContent + JSON.stringify(h.state().task!.demand);
    for (const corner of imageCorners(c)) if (!c.preImage.some(p => fmtPoint(p) === corner)) expect(text).not.toContain(corner);
    expect(h.state().task!.demand.preImage).toMatch(/each labelled/);
    h.dispatch('retry');
    perform(h, transformHarnessInputs(c, 'correct'));
    expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  }
});

it('identify: the motion models show one picture per option, none marked, and the right option still credits', () => {
  const h = mount('identify_transformation', identify);
  expect(levers(h)).toEqual([['corner_letters', false], ['motion_models', false], ['pre_coords', false], ['two_choices', false]]);
  perform(h, transformHarnessInputs(identify, 'wrong'));
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'wrong_axis' });
  expect(h.dispatch('pull_lever', { lever: 'motion_models' }).status).toBe('committed');
  const captions = q(h, '[data-lever="motion-models"] figcaption').map(e => e.textContent);
  expect(captions).toEqual(identify.options);
  expect(q(h, '[data-lever="motion-models"] [aria-selected="true"], [data-lever="motion-models"] .ring')).toEqual([]);
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/Reflection over the x-axis[^;]*is|right option/);
  h.dispatch('retry');
  perform(h, transformHarnessInputs(identify, 'correct'));
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['motion_models'] });
});

it('compose: the target\'s corners are labelled for a figure that faces right but sits off; the moves are never named', () => {
  const h = mount('compose_sequence', compose);
  h.press('Reflect over y-axis'); h.press('Check');
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'position_off' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'position_off')).toBe('target_coords');
  expect(h.dispatch('pull_lever', { lever: 'target_coords' }).status).toBe('committed');
  expect(String(h.state().task!.demand.onScreen)).toContain('(0, 2), (-2, 2), (0, 3)');
  expect(String(h.state().task!.demand.onScreen)).not.toMatch(/Right|Up|Left|Down|Reflect|Rotate/);
  h.dispatch('retry');
  perform(h, transformHarnessInputs(compose, 'correct'));
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['target_coords'] });
});

it('the simpler figure is ungraded practice of the same transformation; the full item comes back blank and is credited after', () => {
  const h = mount('apply_rotation', rotation);
  perform(h, transformHarnessInputs(rotation, 'wrong'));
  const r = h.dispatch('pull_lever', { lever: 'simpler_figure' });
  expect(r.status).toBe('committed');
  expect(r.state.task!.itemId).toBe('r1~simpler');
  expect(r.state.task!.workspace!.practice).toEqual({ returnsTo: 'r1' });
  expect(r.state.task!.demand).toMatchObject({ preImage: expect.stringContaining('3 corners'), learnerWork: expect.stringContaining('no corner moved yet') });
  for (const corner of imageCorners(rotation)) expect(JSON.stringify(r.state.task!.demand)).not.toContain(corner);
  const easier = simplerItem(rotation)!;
  perform(h, transformHarnessInputs(easier, 'correct'));
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('r1');
  expect(String(h.state().task!.demand.learnerWork)).toMatch(/no corner moved yet/);
  perform(h, transformHarnessInputs(rotation, 'correct'));
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['r1', false, false], ['r1~simpler', true, true], ['r1', true, false]]);
});

it('identify\'s easier item has two options and another motion; a pull during practice is refused', () => {
  const h = mount('identify_transformation', identify);
  perform(h, transformHarnessInputs(identify, 'wrong'));
  const r = h.dispatch('pull_lever', { lever: 'two_choices' });
  expect(r.status).toBe('committed');
  const options = q(h, 'button').map(b => b.textContent?.trim()).filter(t => /Reflection|Rotation/.test(t ?? ''));
  expect(options).toHaveLength(2);
  expect(options).not.toContain('Reflection over the x-axis');
  expect(h.offer('pull_lever')).toBeFalsy();
});
