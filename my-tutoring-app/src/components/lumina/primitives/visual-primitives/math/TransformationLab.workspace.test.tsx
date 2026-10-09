// @vitest-environment jsdom
/**
 * Transformation lab on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { GridPoint, TransformationLabChallenge, TransformationLabData } from './TransformationLab';
import {
  GRID_TARGET, TRANSFORM_MISSES_BY_MODE, transformHarnessInputs, transformMiss, type TransformHarnessInput,
} from './transformationLabWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

/** Mouse drags on the grid canvas in its logical pixels, as the journey driver strokes a canvas (its rect pinned to its size). */
function dragOnGrid(h: WorkspaceHarness, strokes: { x: number; y: number }[][]) {
  const canvas = h.view.container.querySelector(`canvas[data-pip-object="${GRID_TARGET}"]`) as HTMLCanvasElement;
  expect(canvas, 'the grid canvas').toBeTruthy();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height,
    right: canvas.width, bottom: canvas.height, x: 0, y: 0, toJSON: () => ({}) });
  for (const stroke of strokes) {
    act(() => { fireEvent.mouseDown(canvas, { clientX: stroke[0].x, clientY: stroke[0].y }); });
    for (const p of stroke.slice(1)) act(() => { fireEvent.mouseMove(canvas, { clientX: p.x, clientY: p.y }); });
    act(() => { fireEvent.mouseUp(canvas); });
  }
}
/** The journey row's inputs, performed as the driver does. */
function perform(h: WorkspaceHarness, inputs: TransformHarnessInput[]) {
  for (const a of inputs) {
    if (a.type === 'draw') dragOnGrid(h, a.strokes);
    else if (a.type === 'choose') h.press(a.label);
    else h.press('Check');
  }
}

const P = (x: number, y: number): GridPoint => ({ x, y });
const base = { narration: 'A shape moves.', hint: 'Use the rule.' };
const translation: TransformationLabChallenge = { ...base, id: 't1', type: 'apply_translation_reflection', answerKind: 'drag',
  instruction: 'Translate the figure by (3, 2). Drag each pink corner to its new position.',
  preImage: [P(-3, -2), P(-1, -2), P(-3, 1)], expectedImage: [P(0, 0), P(2, 0), P(0, 3)], transformLabel: 'Translation by (3, 2)' };
const rotation: TransformationLabChallenge = { ...base, id: 'r1', type: 'apply_rotation', answerKind: 'drag',
  instruction: 'Rotate the figure 90° counterclockwise about the origin. Drag each pink corner to its image.',
  preImage: [P(1, 3), P(4, 3), P(2, 5)], expectedImage: [P(-3, 1), P(-3, 4), P(-5, 2)],
  transformLabel: 'Rotation 90° counterclockwise about the origin' };
const identify: TransformationLabChallenge = { ...base, id: 'i1', type: 'identify_transformation', answerKind: 'identify',
  instruction: 'A single transformation maps the cyan pre-image onto the amber image. Which transformation is it?',
  preImage: [P(1, 1), P(3, 1), P(1, 4)], expectedImage: [P(1, -1), P(3, -1), P(1, -4)], transformLabel: 'Reflection over the x-axis',
  options: ['Rotation 90° counterclockwise about the origin', 'Reflection over the x-axis', 'Reflection over the y-axis',
    'Rotation 180° about the origin'], correctOption: 1 };
const compose: TransformationLabChallenge = { ...base, id: 'c1', type: 'compose_sequence', answerKind: 'sequence',
  instruction: 'Use the transformation buttons to move the pink figure exactly onto the dashed target. It takes more than one move.',
  preImage: [P(1, 1), P(3, 1), P(1, 2)], expectedImage: [P(0, 2), P(-2, 2), P(0, 3)],
  transformLabel: 'Reflection over the y-axis followed by a translation by (1, 1)' };
const dilation: TransformationLabChallenge = { ...base, id: 'd1', type: 'dilation_similarity', answerKind: 'drag',
  instruction: 'Dilate the figure by a scale factor of 2 about the origin. Drag each pink corner to its image.',
  preImage: [P(1, 0), P(3, 0), P(1, 2)], expectedImage: [P(2, 0), P(6, 0), P(2, 4)],
  transformLabel: 'Dilation about the origin by scale factor 2', isSimilarity: true, scaleFactor: 2 };
const lab = (challenges: TransformationLabChallenge[], over: Partial<TransformationLabChallenge> = {}): TransformationLabData => ({
  title: 'Transformations', description: '', challengeType: challenges[0].type, gradeBand: '8',
  challenges: challenges.map(c => ({ ...c, ...over })) });

type Case = { mode: string; c: TransformationLabChallenge; miss: string; secret: RegExp };
const CASES: Case[] = [
  { mode: 'apply_translation_reflection', c: translation, miss: 'opposite_shift', secret: /\(2, 0\)|\(0, 3\)/ },
  { mode: 'apply_rotation', c: rotation, miss: 'wrong_direction', secret: /\(-3, 1\)|\(-3, 4\)|\(-5, 2\)/ },
  { mode: 'identify_transformation', c: identify, miss: 'wrong_axis', secret: /correctOption|transformLabel|is a reflection over the x/i },
  { mode: 'compose_sequence', c: compose, miss: 'orientation_off', secret: /followed by|translation by \(1, 1\)/i },
  { mode: 'dilation_similarity', c: dilation, miss: 'added_factor', secret: /\(6, 0\)|\(2, 4\)/ },
];

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('transformation-lab')!;
  const modes = (entry.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(CASES.map(c => c.mode).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(TRANSFORM_MISSES_BY_MODE);
  for (const { mode, c } of CASES) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'transformation-lab', pin: mode, objectiveIds: ['o'],
      data: lab([c]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(CASES)('$mode: checked by the activity, no key published; a wrong check names its miss and Try again clears the work; the right one completes once',
  async ({ mode, c, miss, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'transformation-lab', evalMode: mode, data: lab([c]) as unknown as Record<string, unknown> });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(h.state().task)).not.toMatch(secret);
    expect(JSON.stringify(h.state().task)).not.toMatch(/expectedImage|ruleNotation|hint/i);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    // The hint and Next are the tutor's.
    expect(h.view.container.textContent).not.toMatch(/Show hint|Next Problem/);

    perform(h, transformHarnessInputs(c, 'wrong'));
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)?.miss).toBe(miss);
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);
    // Input is closed until Try again: every control, and a drag on the grid.
    const open = Array.from(h.view.container.querySelectorAll('button'))
      .filter(b => !b.disabled && /Check|Reset|Reflect|Rotat|Left|Right|Up|Down/.test(b.textContent ?? ''));
    expect(open).toEqual([]);
    const work = h.state().task!.demand.learnerWork;
    if (c.answerKind === 'drag') {
      perform(h, transformHarnessInputs(c, 'correct').filter(a => a.type === 'draw'));
      expect(h.state().task!.demand.learnerWork).toBe(work);
    }
    h.dispatch('retry');
    expect(String(h.state().task!.demand.learnerWork)).toMatch(/no corner moved yet|no moves yet|no option chosen/);

    perform(h, transformHarnessInputs(c, 'correct'));
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'transformation-lab', evalMode: 'apply_rotation', data: lab([rotation]) as unknown as Record<string, unknown> });
  perform(h, transformHarnessInputs(rotation, 'correct'));
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the tutor is told what is drawn: the pre-image, labels only where shown, the rule card only where shown, the learner\'s corners', () => {
  const h = mountWorkspace({ primitiveId: 'transformation-lab', evalMode: 'apply_rotation',
    data: lab([rotation], { showPreImageCoords: false }) as unknown as Record<string, unknown> });
  expect(h.state().task!.demand).toMatchObject({ preImage: expect.stringContaining('not labelled'),
    target: expect.stringContaining('no target is drawn'), learnerWork: expect.stringContaining('no corner moved yet') });
  expect(h.state().task!.demand.rule).toBeUndefined();
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\(1, 3\)/);
});

it('with the labels and the rule card on screen, the tutor is told both', () => {
  const shown = mountWorkspace({ primitiveId: 'transformation-lab', evalMode: 'apply_rotation',
    data: lab([rotation], { ruleNotation: '(x, y) → (−y, x)' }) as unknown as Record<string, unknown> });
  expect(shown.state().task!.demand).toMatchObject({ preImage: expect.stringContaining('(1, 3), (4, 3), (2, 5)'),
    rule: 'a rule card reads (x, y) → (−y, x)' });
});

it('transformMiss names the pattern the figure or the option shows', () => {
  const w = (image: GridPoint[], steps: string[] = [], selected: number | null = null) =>
    ({ image, steps: steps as never[], selected });
  const at = (c: TransformationLabChallenge, f: (p: GridPoint) => GridPoint) => c.preImage.map(f);
  expect(transformMiss(translation, w(translation.expectedImage))).toBeUndefined();
  expect(transformMiss(translation, w(translation.preImage))).toBe('unmoved');
  expect(transformMiss(translation, w(at(translation, p => P(p.x - 3, p.y - 2))))).toBe('opposite_shift');
  expect(transformMiss(translation, w(at(translation, p => P(p.x + 2, p.y + 3))))).toBe('swapped_shift');
  expect(transformMiss(translation, w(at(translation, p => P(p.x + 3, p.y))))).toBe('one_axis_shift');
  expect(transformMiss(translation, w([P(0, 0), P(2, 0), P(0, 4)]))).toBe('partly_placed');
  expect(transformMiss(translation, w([P(5, 5), P(6, 5), P(5, 7)]))).toBe('shape_changed');
  expect(transformMiss(translation, w(at(translation, p => P(p.x + 5, p.y + 5))))).toBe('misplaced');
  const reflect: TransformationLabChallenge = { ...translation, preImage: [P(1, 1), P(3, 1), P(1, 4)], expectedImage: [P(1, -1), P(3, -1), P(1, -4)] };
  expect(transformMiss(reflect, w([P(-1, 1), P(-3, 1), P(-1, 4)]))).toBe('wrong_axis');
  expect(transformMiss(rotation, w(at(rotation, p => P(p.y, -p.x))))).toBe('wrong_direction');
  expect(transformMiss(rotation, w(at(rotation, p => P(-p.x, -p.y))))).toBe('wrong_angle');
  expect(transformMiss(rotation, w(at(rotation, p => P(-p.x, p.y))))).toBe('reflected_instead');
  expect(transformMiss(dilation, w(at(dilation, p => P(p.x + 2, p.y + 2))))).toBe('added_factor');
  expect(transformMiss(dilation, w(at(dilation, p => P(p.x * 3, p.y * 3))))).toBe('wrong_factor');
  expect(transformMiss(dilation, w(at(dilation, p => P(p.x * 2, p.y))))).toBe('one_axis_scaled');
  expect(transformMiss(identify, w([], [], 2))).toBe('wrong_axis');
  expect(transformMiss(identify, w([], [], 0))).toBe('rotation_for_reflection');
  const turn: TransformationLabChallenge = { ...identify, expectedImage: [P(-1, 1), P(-1, 3), P(-4, 1)], correctOption: 0 };
  expect(transformMiss(turn, w([], [], 1))).toBe('reflection_for_rotation');
  expect(transformMiss(turn, w([], [], 3))).toBe('wrong_angle');
  expect(transformMiss({ ...turn, options: [...turn.options!.slice(0, 3), 'Rotation 270° counterclockwise about the origin'] }, w([], [], 3)))
    .toBe('wrong_direction');
  expect(transformMiss(compose, w(compose.preImage))).toBe('unmoved');
  expect(transformMiss(compose, w([P(2, 2), P(4, 2), P(2, 3)], ['tr_up', 'tr_right']))).toBe('orientation_off');
  expect(transformMiss(compose, w([P(-1, 1), P(-3, 1), P(-1, 2)], ['reflect_y']))).toBe('position_off');
});

it('the adapter refuses an item its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['transformation-lab'].validate;
  expect(() => validate(lab([{ ...rotation, expectedImage: rotation.expectedImage.slice(0, 2) }]))).toThrow();
  expect(() => validate(lab([{ ...identify, correctOption: 7 }]))).toThrow();
  expect(() => validate(lab([{ ...compose, expectedImage: [P(0, 0), P(5, 5), P(1, 6)] }]))).toThrow();
  expect(() => validate(lab([{ ...rotation, preImage: [P(9, 9), P(4, 3), P(2, 5)] }]))).toThrow();
  expect(validate(lab([translation, rotation, identify, compose, dilation]))).toBeTruthy();
});
