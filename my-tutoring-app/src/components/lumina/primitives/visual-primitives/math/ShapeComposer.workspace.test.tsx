// @vitest-environment jsdom
/**
 * Shape composer on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance. Three modes are answered by
 * dragging pieces, which the dry journey cannot drive, so they are driven here with pointer events.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/build-layer/buildLayer', () => ({ useBuildWatcher: () => '' }));

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ShapeComposerChallenge } from './ShapeComposer';

// jsdom has no svg screen matrix: the canvas maps client coordinates to canvas units one to one.
beforeAll(() => {
  (SVGElement.prototype as any).getScreenCTM = () => ({ inverse: () => ({}) });
  (globalThis as any).DOMPoint = class { constructor(public x = 0, public y = 0) {} matrixTransform() { return { x: this.x, y: this.y }; } };
  if (!(window as any).PointerEvent) (window as any).PointerEvent = MouseEvent;
});
beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

/** The pieces on the board, with the top-left each is drawn at. */
const board = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll<SVGGElement>('[data-pip-object^="piece-"]'))
  .map(el => {
    const [, x, y] = /translate\(([-\d.]+), ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '')!;
    return { el, shape: el.getAttribute('data-shape')!, x: Number(x), y: Number(y) };
  });
/** Drag the last-placed piece of a shape so its top-left lands at (x, y). */
const drag = (h: WorkspaceHarness, shape: string, x: number, y: number) => {
  const piece = board(h).filter(p => p.shape === shape).at(-1)!;
  const svg = h.view.container.querySelector('[data-pip-object="canvas"] svg')!;
  act(() => { fireEvent.pointerDown(piece.el, { clientX: piece.x + 1, clientY: piece.y + 1 }); });
  act(() => { fireEvent.pointerMove(svg, { clientX: x + 1, clientY: y + 1 }); });
  act(() => { fireEvent.pointerUp(svg); });
};
const write = (h: WorkspaceHarness, text: string) => act(() => {
  fireEvent.change(h.view.container.querySelector('input[aria-label="How many pieces"]')!, { target: { value: text } });
});

type Case = {
  c: ShapeComposerChallenge;
  wrong: (h: WorkspaceHarness) => void; miss: string;
  /** What the work reads after Try again: a build is kept to fix, a tap set or a typed number is cleared. */
  afterRetry: string;
  right: (h: WorkspaceHarness) => void;
  secret: RegExp;
};
const CASES: Record<ShapeComposerChallenge['type'], Case> = {
  'compose-match': {
    c: { id: 'm1', type: 'compose-match', instruction: 'Use the pieces to fill the house.', targetShape: 'house',
      targetOutlinePath: 'M 100 0 L 200 100 L 200 200 L 100 200 Z', showSeams: false,
      pieces: [{ id: 'p1', shape: 'square', color: '#00f', width: 100, height: 100, targetX: 100, targetY: 100 },
        { id: 'p2', shape: 'triangle', color: '#f0f', width: 100, height: 100, targetX: 100, targetY: 0 }] },
    wrong: h => { h.press('square'); drag(h, 'square', 100, 100); h.press('Check Answer'); },
    miss: 'pieces_left', afterRetry: 'On the board: 1 square; 1 of 2 pieces snapped into the outline',
    right: h => { h.press('triangle'); drag(h, 'triangle', 110, 10); h.press('Check Answer'); },
    secret: /targetX|targetY|\b100\b/,
  },
  'compose-picture': {
    c: { id: 'p1', type: 'compose-picture', instruction: 'Build a house.', targetPicture: 'house',
      availableShapes: [{ shape: 'square', color: '#00f', count: 1 }, { shape: 'triangle', color: '#f0f', count: 1 }],
      pictureSlots: [{ id: 's1', shape: 'square', x: 150, y: 150, width: 100, height: 100, rotation: 0 },
        { id: 's2', shape: 'triangle', x: 150, y: 50, width: 100, height: 100, rotation: 0 }] },
    wrong: h => { h.press('square'); drag(h, 'square', 150, 150); h.press('Check Answer'); },
    miss: 'shape_missing', afterRetry: 'On the board: 1 square; 1 of 2 picture spots filled',
    right: h => { h.press('triangle'); drag(h, 'triangle', 160, 60); h.press('Check Answer'); },
    secret: /\b150\b|pictureSlots/,
  },
  decompose: {
    c: { id: 'd1', type: 'decompose', instruction: 'What shapes make this square?', compositeShapePath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      compositeDescription: 'A square that can be split into 2 triangles', expectedComponents: [{ shape: 'triangle', count: 2 }] },
    wrong: h => { h.press('triangle'); h.press('Check Answer'); },
    miss: 'missed_part', afterRetry: 'No shapes tapped yet',
    right: h => { h.press('triangle'); h.press('triangle'); h.press('Check Answer'); },
    secret: /split into|2 triangles|expectedComponents/,
  },
  'how-many-ways': {
    c: { id: 'h1', type: 'how-many-ways', instruction: 'How many triangles do you need to build a square?',
      targetForComposition: 'square', allowedPieces: ['triangle'], minimumPiecesNeeded: 2, hint: 'Two triangles make a square!' },
    wrong: h => { write(h, '3'); h.press('Check Answer'); },
    miss: 'too_many', afterRetry: 'No number typed yet',
    right: h => { write(h, '2'); h.press('Check Answer'); },
    secret: /\b2\b|minimumPiecesNeeded|two triangles/i,
  },
  'free-create': {
    c: { id: 'f1', type: 'free-create', instruction: 'Make your own picture with one square and one triangle. Every shape must touch another shape.',
      recipe: [{ shape: 'square', count: 1 }, { shape: 'triangle', count: 1 }] },
    // New pieces land apart, so the two asked shapes placed and not joined do not touch.
    wrong: h => { h.press('square'); h.press('triangle'); h.press("I'm done!"); },
    miss: 'not_touching', afterRetry: 'On the board: 1 square, 1 triangle',
    right: h => { const sq = board(h).find(p => p.shape === 'square')!; drag(h, 'triangle', sq.x + 51, sq.y); h.press("I'm done!"); },
    secret: /correct|touching: (yes|no)/i,
  },
};
const lesson = (challenges: ShapeComposerChallenge[]) => ({ title: 'Shapes', gradeBand: 'K', challenges });

it('every catalog mode binds', () => {
  const modes = (getComponentById('shape-composer')?.evalModes ?? []).map(m => m.evalMode);
  expect(modes.sort()).toEqual(Object.keys(CASES).sort());
  for (const mode of modes) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'shape-composer', pin: mode, objectiveIds: ['o'],
      data: lesson([CASES[mode as ShapeComposerChallenge['type']].c]) }), mode).not.toBeNull();
  }
});

it.each(Object.values(CASES))('$c.type: a checked gesture that publishes no key; a wrong check names its miss and Try again reopens it, the right one completes once',
  async ({ c, wrong, miss, afterRetry, right, secret }) => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mountWorkspace({ primitiveId: 'shape-composer', evalMode: c.type, data: lesson([c]) });
    const task = h.state().task!;
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.response).toBe('gesture');
    expect(JSON.stringify(task.demand)).not.toMatch(secret);
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/next challenge/i);

    wrong(h);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss });
    // The miss names the problem, never the generated hint (which can carry the answer).
    expect(h.view.container.textContent).not.toMatch(/two triangles make a square/i);
    // Input is closed until Try again.
    const open = Array.from(h.view.container.querySelectorAll('button, input'))
      .filter(b => !(b as HTMLButtonElement).disabled && !/try again|next challenge/i.test(b.textContent ?? ''));
    expect(open.map(b => b.textContent || b.getAttribute('aria-label'))).toEqual([]);
    h.dispatch('retry');
    expect(h.state().task!.demand).toMatchObject({ learnerWork: afterRetry });
    expect(JSON.stringify(h.state().task!.demand)).not.toMatch(secret);

    right(h);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the live host (no evaluation provider) never submits', async () => {
  const h = mountWorkspace({ primitiveId: 'shape-composer', evalMode: 'decompose', data: lesson([CASES.decompose.c]) });
  CASES.decompose.right(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('decompose offers shapes that are not parts, and no button turns green when enough are tapped', () => {
  const h = mountWorkspace({ primitiveId: 'shape-composer', evalMode: 'decompose', data: lesson([CASES.decompose.c]) });
  const choices = () => Array.from(h.view.container.querySelectorAll('[data-pip-object="choices"] button'));
  expect(choices().map(b => b.getAttribute('aria-label'))).toEqual(['circle', 'rectangle', 'square', 'triangle']);
  h.press('triangle'); h.press('triangle');
  expect(choices().some(b => /emerald/.test(b.className))).toBe(false);
  expect(h.state().task!.demand).toMatchObject({ choices: 'circle | rectangle | square | triangle', learnerWork: 'Tapped: triangle, triangle' });
});

it('the tutor is told what is drawn: the target, the palette, the recipe, and whether guides are on screen', () => {
  const h = mountWorkspace({ primitiveId: 'shape-composer', evalMode: 'compose-match', data: lesson([CASES['compose-match'].c]) });
  expect(h.state().task!.demand).toMatchObject({ target: 'the outline of a house, dashed', palette: '1 square, 1 triangle',
    pieceSpots: 'hidden', learnerWork: 'No pieces on the board yet' });
  cleanup();
  const f = mountWorkspace({ primitiveId: 'shape-composer', evalMode: 'free-create', data: lesson([CASES['free-create'].c]) });
  expect(f.state().task!.demand).toMatchObject({ shapesToUse: expect.stringContaining('one square and one triangle') });
});

it('the adapter refuses a challenge its own check cannot read', () => {
  const v = LIVE_ADAPTERS['shape-composer'].validate;
  expect(() => v(lesson([{ ...CASES.decompose.c, expectedComponents: [] }]))).toThrow();
  expect(() => v(lesson([{ ...CASES['how-many-ways'].c, minimumPiecesNeeded: undefined }]))).toThrow();
  expect(() => v(lesson([{ ...CASES['compose-picture'].c, availableShapes: [{ shape: 'square', color: '#00f', count: 1 }] }]))).toThrow();
  expect(v(lesson(Object.values(CASES).map(x => x.c)))).toBeTruthy();
});
