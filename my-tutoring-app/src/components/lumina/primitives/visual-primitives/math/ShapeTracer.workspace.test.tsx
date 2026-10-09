// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real ShapeTracer on the shared teaching workspace, mounted the way a lesson
 * mounts it. A finished trace or completion, a connect-dots tap out of order, and Check Shape each commit a checked
 * gesture; the runtime owns progression; the scored session is what gets submitted. The tutor is never handed the
 * dot order or a shape the screen has not named.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { ShapeTracerChallenge } from './ShapeTracer';
import { checkShapeProperties, drawCorners, gridDots, shapeTracerMiss } from './shapeTracerWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const A = { x: 150, y: 100 }, B = { x: 350, y: 100 }, C = { x: 350, y: 300 }, D = { x: 150, y: 300 };
const TRI = [{ x: 250, y: 80 }, { x: 150, y: 280 }, { x: 350, y: 280 }];
const CHALLENGES: Record<string, ShapeTracerChallenge> = {
  trace: { id: 't', type: 'trace', instruction: 'Trace the square by following the dots!', targetShape: 'square', tracePath: [A, B, C, D] },
  complete: { id: 'c', type: 'complete', instruction: 'Finish the square!', targetShape: 'square',
    drawnSides: [{ from: A, to: B }], remainingVertices: [C, D] },
  connect_dots: { id: 'd', type: 'connect-dots', instruction: 'Connect the dots to discover the hidden shape!', targetShape: 'triangle',
    dots: TRI.map((p, i) => ({ ...p, label: String(i + 1) })), correctOrder: [0, 1, 2], revealShape: 'triangle' },
  draw_from_description: { id: 'f', type: 'draw-from-description', instruction: 'Read the clue and draw the shape!', targetShape: 'square',
    description: 'A shape with 4 equal sides and 4 corners', requiredProperties: { sides: 4, corners: 4, allSidesEqual: true } },
};

const mount = (evalMode: string, challenges: ShapeTracerChallenge[], gridSize = 50) =>
  mountWorkspace({ primitiveId: 'shape-tracer', evalMode, instanceId: 'shapes',
    data: { title: 'Shapes', gradeBand: 'K', gridSize, showPropertyReminder: true, challenges } });
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const taps = (h: WorkspaceHarness, prefix: string, ids: number[]) => ids.forEach(i => h.touch(`${prefix}-${i}`));

it.each(Object.keys(CHALLENGES))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = CHALLENGES[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task.startsWith(c.instruction)).toBe(true);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/correctOrder|requiredProperties/);
  // A hidden shape (connect-dots) and the shape a clue describes are named nowhere before the work is done.
  if (mode === 'connect_dots' || mode === 'draw_from_description') {
    expect(facts).not.toContain(c.targetShape);
    expect(h.view.container.textContent).not.toContain(c.targetShape);
  }
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.queryByRole('button', { name: /next challenge/i })).toBeNull();
  h.close();
});

it('connect_dots: a dot out of order commits its named miss and closes the dots until Try again starts over; a right order completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('connect_dots', [CHALLENGES.connect_dots, { ...CHALLENGES.connect_dots, id: 'd2' }]);
  h.touch('dot-1');
  expect(last(h)).toMatchObject({ correct: false, miss: 'started_elsewhere' });
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Tapped dot 2');
  h.touch('dot-0');
  expect(demand(h)).toMatchObject({ learnerWork: 'No dot joined yet' });
  h.dispatch('retry');
  taps(h, 'dot', [0, 1]);
  expect(demand(h)).toMatchObject({ learnerWork: 'Joined 1, 2' });
  h.touch('dot-2');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  // Joined: the shape is named now, on screen and to the tutor.
  expect(demand(h)).toMatchObject({ revealed: 'triangle' });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('d2');
  expect(demand(h)).toMatchObject({ learnerWork: 'No dot joined yet' });
  taps(h, 'dot', [0, 1, 2]);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work, , evidence] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'd', miss: 'started_elsewhere' })]);
  h.close();
});

it('draw_from_description: three corners for a four-sided clue is too_few_sides; Try again clears the grid; a square passes', () => {
  const h = mount('draw_from_description', [CHALLENGES.draw_from_description]);
  const corners = drawCorners(CHALLENGES.draw_from_description, 50);
  taps(h, 'grid', corners.slice(0, 3));
  h.press(/check shape/i);
  expect(last(h)).toMatchObject({ correct: false, miss: 'too_few_sides' });
  expect((h.view.getByRole('button', { name: /check shape/i }) as HTMLButtonElement).disabled).toBe(true);
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ learnerWork: 'No corner placed yet' });
  taps(h, 'grid', corners);
  expect(demand(h)).toMatchObject({ learnerWork: 'Placed 4 corners on the grid' });
  h.press(/check shape/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('trace: a corner out of turn is refused on the dot, never checked; the corners in turn close the shape', () => {
  const h = mount('trace', [CHALLENGES.trace]);
  h.touch('vertex-2');
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(String(demand(h).learnerWork)).toMatch(/not drawn/);
  taps(h, 'vertex', [0, 1, 2, 3]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  h.close();
});

it('trace with no numbers and no glow starts at any corner and goes either way round', () => {
  const free = { ...CHALLENGES.trace, showOrderNumbers: false, showNextCue: false, showGuidePath: false, showDirectionArrows: false };
  const h = mount('trace', [free]);
  expect(String(demand(h).howToAnswer)).toMatch(/any corner/);
  h.touch('vertex-2'); h.touch('vertex-0');
  expect(String(demand(h).learnerWork)).toMatch(/not drawn/);
  taps(h, 'vertex', [1, 0, 3]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('complete: the open corners in turn finish the shape', () => {
  const h = mount('complete', [CHALLENGES.complete]);
  h.touch('remaining-1');
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  taps(h, 'remaining', [0, 1]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('shapeTracerMiss names each wrong check; drawCorners builds shapes the check accepts', () => {
  const cd = CHALLENGES.connect_dots, fd = CHALLENGES.draw_from_description;
  expect(shapeTracerMiss(cd, { tapped: [0], points: [], wrongDot: 0 })).toBe('went_back');
  expect(shapeTracerMiss(cd, { tapped: [0], points: [], wrongDot: 2 })).toBe('skipped_number');
  expect(shapeTracerMiss(cd, { tapped: [0], points: [], wrongDot: 1 })).toBeUndefined();
  const grid = gridDots(50);
  const pts = (ids: number[]) => ids.map(i => grid[i]);
  expect(shapeTracerMiss(fd, { tapped: [], points: pts(drawCorners({ ...fd, requiredProperties: { sides: 5 } }, 50)) })).toBe('too_many_sides');
  expect(shapeTracerMiss(fd, { tapped: [], points: [{ x: 40, y: 40 }, { x: 440, y: 40 }, { x: 440, y: 90 }, { x: 40, y: 90 }] }))
    .toBe('sides_unequal');
  for (const size of [25, 50]) for (const sides of [3, 4, 5, 6]) for (const equal of [false, true]) {
    const required = { sides, corners: sides, allSidesEqual: equal };
    const ids = drawCorners({ ...fd, requiredProperties: required }, size);
    expect(new Set(ids).size).toBe(sides);
    expect(checkShapeProperties(ids.map(i => gridDots(size)[i]), required).correct).toBe(true);
  }
});
