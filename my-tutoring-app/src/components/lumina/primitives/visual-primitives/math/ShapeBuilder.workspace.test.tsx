// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape, plus the open build `make_shape`: the real ShapeBuilder on the shared teaching
 * workspace, with the real TeachingSession, LiveLessonRuntime and rendering shell. Every mode mounts under tutor
 * ownership with no scripted cue and no published key; on make_shape the learner makes any shape with the asked
 * properties on an empty grid, "I'm done!" commits, a miss is named per property, Try again keeps the shape, and the
 * levers come on a miss (none from the tier). Only sound, evaluation writes and the legacy AI hook are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { shapeBuilderLevers } from './shapeBuilderLevers';
import { shapeAskText } from './shapeMakeBuild';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), watch: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'shapes',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy('enabled');
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'shapes' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
// The live line is the shared layer's (its leak rules are tested in shapeMakeBuild.test.ts): here only what the grid asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import ShapeBuilder, { type ShapeBuilderChallenge, type ShapeBuilderData } from './ShapeBuilder';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); seam.evaluationContext = null; });

const SQUARE = [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 2, y: 4 }];
const TRIANGLE = { id: 't1', vertices: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 3 }], name: 'Shape A', locked: true, correctCategory: 'Triangles' };
const MAKE = (id: string, ask: Parameters<typeof shapeAskText>[0], band: 'K-2' | '3-5' = '3-5'): ShapeBuilderChallenge => ({
  id, type: 'make_shape', instruction: shapeAskText(ask, band), hint: 'Count your sides.', narration: '',
  targetProperties: { sides: ask.sides, rightAngles: ask.rightAngles, parallelPairs: ask.parallelPairs,
    equalSides: ask.equalSides, linesOfSymmetry: ask.linesOfSymmetry } });

const CHALLENGES: Record<string, ShapeBuilderChallenge> = {
  build: { id: 'b', type: 'build', instruction: 'Build a shape with 4 equal sides and 4 right angles.', hint: '', narration: '',
    targetProperties: { sides: 4, rightAngles: 4, equalSides: 'all' } },
  make_shape: MAKE('m', { sides: 4, rightAngles: 1 }),
  measure: { id: 'me', type: 'measure', instruction: 'Measure the sides of this shape.', hint: '', narration: '' },
  classify_by_lines: { id: 'cl', type: 'classify_by_lines', instruction: 'Sort by lines.', hint: '', narration: '' },
  classify: { id: 'c', type: 'classify', instruction: 'Sort the shapes.', hint: '', narration: '' },
  compose: { id: 'co', type: 'compose', instruction: 'Put shapes together.', hint: '', narration: '' },
  find_symmetry: { id: 's', type: 'find_symmetry', instruction: 'Draw a line of symmetry.', hint: '', narration: '',
    targetProperties: { linesOfSymmetry: 1 } },
  coordinate_shape: { id: 'cs', type: 'coordinate_shape', instruction: 'Plot (1,1), (4,1), (4,4), (1,4).', hint: '', narration: '',
    targetProperties: { sides: 4, rightAngles: 4 } },
};

function mount(evalMode: string, challenges: ShapeBuilderChallenge[], extra: Partial<ShapeBuilderData> = {}) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Shapes', mode: 'build', gradeBand: '3-5', instanceId: 'shapes', challenges,
    grid: { type: 'dot', size: { rows: 10, columns: 10 }, showCoordinates: false },
    tools: { ruler: true, protractor: true, symmetryLine: false, parallelMarker: true },
    preloadedShapes: [{ ...TRIANGLE }], classificationCategories: ['Triangles', 'Quadrilaterals'], ...extra } as ShapeBuilderData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ShapeBuilder data={data} runtimePlanItemId="plan-shapes" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'shapes',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const dot = (x: number, y: number) => act(() => {
    fireEvent.click(view.container.querySelector(`[data-pip-object="dot-${x}-${y}"]`)!);
  });
  /** Tap each corner, then the first again to close the shape. */
  const draw = (pts: Array<{ x: number; y: number }>) => { pts.forEach(p => dot(p.x, p.y)); dot(pts[0].x, pts[0].y); };
  const done = () => act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
  const demand = () => state().task!.demand as Record<string, unknown>;
  const levers = () => state().task!.workspace!.levers ?? [];
  const last = () => state().task!.workspace!.attempts.at(-1);
  return { runtime, view, state, dispatch, confirmVisible, dot, draw, done, demand, levers, last };
}

it.each(Object.keys(CHALLENGES))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = CHALLENGES[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // No category key, target shape name or placement reaches the tutor.
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/correctCategory|"Triangles"|targetShape|ghost/i);
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /next challenge/i })).toBeNull();
});

it('a wrong sort commits misplaced_shape and Try again clears it; a right sort completes', () => {
  const h = mount('classify', [CHALLENGES.classify]);
  // jsdom has no layout: select the shape through the svg at the shape's centre.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 440, height: 440,
    right: 440, bottom: 440, x: 0, y: 0, toJSON: () => ({}) });
  act(() => { fireEvent.click(h.view.container.querySelector('svg')!, { clientX: 20 + 1.67 * 40, clientY: 20 + 1.67 * 40 }); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Quadrilaterals' })); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  expect(h.last()).toMatchObject({ correct: false, miss: 'misplaced_shape' });
  h.dispatch('retry');
  expect(h.demand()).toMatchObject({ learnerWork: 'No shape sorted yet' });
  act(() => { fireEvent.click(h.view.container.querySelector('svg')!, { clientX: 20 + 1.67 * 40, clientY: 20 + 1.67 * 40 }); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: 'Triangles' })); });
  act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  expect(h.last()).toMatchObject({ correct: true });
});

it('make_shape opens bare: an empty grid, no Check, no tools, the ask stated, numeric facts, levers unpulled', () => {
  const h = mount('make_shape', [CHALLENGES.make_shape]);
  expect(h.view.container.querySelector('svg[data-build-scene="shape-grid"]')).toBeTruthy();
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /ruler|protractor|parallel/i })).toBeNull();
  expect(screen.getByText('Make a shape with 4 sides and exactly 1 right angle.')).toBeTruthy();
  expect(h.demand()).toMatchObject({ kind: 'make_shape', cornersPlaced: 0, shapeClosed: 'no', sides: 0, rightAngles: 0,
    parallelPairs: 0, sidesOfOneLength: 0, symmetryLines: 0, learnerWork: 'No corners placed yet' });
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['side_tags', 'help', false], ['corner_marks', 'help', false], ['parallel_marks', 'help', false],
    ['equal_ticks', 'help', false], ['fold_lines', 'help', false], ['fewer_properties', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', neverSay: expect.arrayContaining(['square', 'trapezoid']) }) }));
});

it('a wrong shape is named, the screen shows no checklist or shape name, Try again keeps it, and the fix passes', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount('make_shape', [CHALLENGES.make_shape, MAKE('n', { sides: 3, linesOfSymmetry: 1 })]);
  vi.setSystemTime(Date.now() + 2000);
  h.draw(SQUARE);
  // Closed: the learner's own properties go to the tutor as numbers; nothing on screen measures or names the shape.
  expect(h.demand()).toMatchObject({ shapeClosed: 'yes', sides: 4, rightAngles: 4, parallelPairs: 2, sidesOfOneLength: 4, symmetryLines: 4 });
  expect(document.body.textContent).not.toMatch(/square\b|rectangle|rhombus|right angles|parallel pairs|\bsides: /i);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'right_angles_off' });
  // The verdict names no property, number or shape.
  expect(screen.getByText(/Not yet/).textContent).not.toMatch(/\d|right|angle|square/i);
  h.dispatch('retry');
  expect(h.view.container.querySelectorAll('svg[data-build-scene] circle[stroke-width="1.5"]').length).toBeGreaterThan(0);
  expect(h.demand()).toMatchObject({ shapeClosed: 'yes', sides: 4, rightAngles: 4 });
  expect(screen.getByText(/Not yet/)).toBeTruthy();
  // Revise the kept shape: take the corner at (4,4) out (a right triangle), then add (5,5) on the long side.
  vi.setSystemTime(Date.now() + 2000);
  h.dot(4, 4);
  expect(h.demand()).toMatchObject({ sides: 3, rightAngles: 1 });
  h.dot(5, 5);
  expect(h.demand()).toMatchObject({ sides: 4, rightAngles: 1 });
  expect(String(h.demand().workHistory)).toContain('rightAngles 0 → 4 → 1');
  h.done();
  expect(h.last()).toMatchObject({ itemId: 'm', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  // A new item opens an empty grid.
  expect(h.state().task!.itemId).toBe('n');
  expect(h.demand()).toMatchObject({ cornersPlaced: 0, shapeClosed: 'no' });
});

it.each([
  ['sides_off', { sides: 5 }, SQUARE],
  ['parallel_off', { sides: 4, parallelPairs: 1 }, SQUARE],
  ['equal_sides_off', { sides: 4, equalSides: 'all' as const }, [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 1, y: 2 }]],
  ['symmetry_off', { sides: 4, linesOfSymmetry: 1 }, SQUARE],
])('one miss per property: %s', (miss, ask, shape) => {
  const h = mount('make_shape', [MAKE('x', ask)]);
  h.draw(shape);
  h.done();
  expect(h.last()).toMatchObject({ correct: false, miss });
});

it('help levers mark the learner shape, never the ask; aids stay out of the picture', () => {
  const h = mount('make_shape', [CHALLENGES.make_shape]);
  h.draw(SQUARE); h.done();
  for (const id of ['side_tags', 'corner_marks', 'parallel_marks', 'equal_ticks', 'fold_lines']) {
    expect(h.dispatch('pull_lever', { lever: id }).status).toBe('committed');
  }
  const marks = (k: string) => h.view.container.querySelectorAll(`[data-lever="${k}"]`).length;
  expect([marks('side-tag'), marks('corner-mark'), marks('parallel-mark'), marks('equal-tick'), marks('fold-line')]).toEqual([4, 4, 4, 4, 4]);
  expect(String(h.demand().onScreen)).toMatch(/small number|small square|arrows|ticks|fold lines/);
  expect(String(h.demand().onScreen)).not.toMatch(/\b1 right angle|exactly/);
  expect(h.dispatch('pull_lever', { lever: 'side_tags' }).status).toBe('blocked');
  // What the watcher sees: the svg less its `data-aid` parts carries no lever mark and no tap target.
  const picture = h.view.container.querySelector('svg[data-build-scene="shape-grid"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.querySelectorAll('[data-lever], [data-pip-object]').length).toBe(0);
  expect(picture.textContent).toBe('');
  h.dispatch('retry');
  h.dot(2, 2); // take a corner out: the right triangle that is left has one right angle
  h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'sides_off' });
});

it('the simplify lever opens the same sides with one property fewer, ungraded on an empty grid, then the full item', () => {
  const full = MAKE('a', { sides: 4, parallelPairs: 1, rightAngles: 2 });
  const h = mount('make_shape', [full]);
  h.draw([{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 3 }, { x: 1, y: 3 }]); h.done();
  expect(h.last()).toMatchObject({ correct: true });
  const h2 = (cleanup(), mount('make_shape', [full]));
  h2.draw(SQUARE); h2.done();
  const receipt = h2.dispatch('pull_lever', { lever: 'fewer_properties' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a~fewer');
  expect(receipt.state.task!.task).toBe('Make a shape with 4 sides and exactly 2 right angles.');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'a' });
  expect(h2.demand()).toMatchObject({ cornersPlaced: 0 });
  h2.draw([{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }]); h2.done();
  expect(h2.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h2.dispatch('advance');
  expect(h2.state().task!.itemId).toBe('a');
  expect(h2.demand()).toMatchObject({ cornersPlaced: 0 });
  expect(h2.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['a', false, false], ['a~fewer', true, true]]);
});

it('a correct session submits once, under a lesson evaluation provider', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('make_shape', [MAKE('a', { sides: 4 })]);
  h.draw(SQUARE); h.done();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledTimes(1);
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'shape-builder', shapesTotal: 1 });
});

it('catalog wiring: the build mode, its misses, and every miss answered by a lever', () => {
  const entry = getComponentById('shape-builder')!;
  const mode = entry.evalModes!.find(m => m.evalMode === 'make_shape')!;
  expect(mode).toMatchObject({ beta: 1.6, challengeTypes: ['make_shape'], affordances: { answers: ['build'] } });
  const levers = shapeBuilderLevers(CHALLENGES.make_shape, [], '3-5');
  for (const m of entry.teachingWorkspace!.misses!.make_shape) expect(levers.some(l => l.answers?.includes(m)), m).toBe(true);
  // The text names the build, never another mode's action, a shape name or the ask's numbers.
  for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/trapezoid|rectangle|rhombus|hexagon|exactly 1|drag|type/i);
  expect(shapeBuilderLevers({ ...CHALLENGES.make_shape, type: 'build' }, [], '3-5')).toEqual([]);
  expect(shapeBuilderLevers(MAKE('s', { sides: 5 }), [], 'K-2').some(l => l.kind === 'simplify')).toBe(false);
});

it('without a tutor (scripted path) the build still commits at "I\'m done!" and offers Next', () => {
  const data = { title: 'Shapes', mode: 'build', gradeBand: '3-5', instanceId: 'solo',
    grid: { type: 'dot', size: { rows: 10, columns: 10 }, showCoordinates: false },
    tools: { ruler: false, protractor: false, symmetryLine: false, parallelMarker: false },
    challenges: [MAKE('a', { sides: 4 }), MAKE('b', { sides: 3 })] } as ShapeBuilderData;
  const view = render(<ShapeBuilder data={data} />);
  const dot = (x: number, y: number) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="dot-${x}-${y}"]`)!); });
  [...SQUARE, SQUARE[0]].forEach(p => dot(p.x, p.y));
  act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
  expect(screen.getByText(/Yes! Your shape/)).toBeTruthy();
  act(() => { fireEvent.click(screen.getByRole('button', { name: /next challenge/i })); });
  expect(screen.getByText('Make a shape with 3 sides.')).toBeTruthy();
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
});
