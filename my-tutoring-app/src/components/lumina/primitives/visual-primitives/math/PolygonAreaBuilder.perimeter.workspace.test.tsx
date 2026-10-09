// @vitest-environment jsdom
/**
 * polygon-area-builder `build_perimeter` (3.MD.D.8) on the shared teaching workspace: the real component,
 * TeachingSession and LiveLessonRuntime. The grid opens empty; the learner shades a shape whose perimeter is stated and
 * presses "I'm done!"; a miss is named (two over / two short, the area made instead, a hole, two pieces), Try again keeps
 * the build, a two-shape item refuses the first shape turned and passes a different shape with the same perimeter, and
 * the levers come on a miss.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { buildPerimeterAsk, buildPerimeterLevers } from './polygonAreaBuild';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), watch: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'area',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: seam.send, isConnected: true, isAudioPlaying: false,
  activePrimitiveId: 'area' }) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import PolygonAreaBuilder, { type PolygonAreaChallenge, type PolygonAreaBuilderData } from './PolygonAreaBuilder';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const build = (id: string, p: number, shapes: 1 | 2): PolygonAreaChallenge => ({ id, type: 'build_perimeter', figureType: 'grid',
  targetPerimeter: p, expectedArea: p, shapesAsked: shapes, unitLabel: 'units',
  narration: 'Each side of a square on the grid is one unit long.', instruction: buildPerimeterAsk(p, shapes),
  hint: 'Walk around the outside of your shape and count each side.' });

function mount(challenges: PolygonAreaChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Perimeter', description: '', challengeType: 'build_perimeter', gradeBand: '3', instanceId: 'area',
    challenges } as PolygonAreaBuilderData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <PolygonAreaBuilder data={data} runtimePlanItemId="plan-area" runtimeEvalMode="build_perimeter" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'area',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const tap = (...cells: Array<[number, number]>) => cells.forEach(([c, r]) =>
    act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="cell-${c}-${r}"]`)!); }));
  const done = () => press("I'm done!");
  const shaded = () => view.container.querySelectorAll('[data-shaded="true"]').length;
  const demand = () => state().task!.demand as Record<string, unknown>;
  const levers = () => state().task!.workspace!.levers ?? [];
  const last = () => state().task!.workspace!.attempts.at(-1);
  return { state, dispatch, confirmVisible, press, tap, done, shaded, demand, levers, last, view };
}

/** A rectangle `cols` wide and `rows` tall at the grid's top-left (or at `at`). */
const rect = (cols: number, rows: number, at: [number, number] = [0, 0]) =>
  Array.from({ length: cols * rows }, (_, i) => [at[0] + (i % cols), at[1] + Math.floor(i / cols)] as [number, number]);

it('opens an empty grid: the ask states the perimeter, no count or target on screen, levers bare', () => {
  const h = mount([build('a', 12, 1)]);
  expect(h.shaded()).toBe(0);
  expect(screen.getByText('Make a shape with a perimeter of 12 units.')).toBeTruthy();
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(h.demand()).toMatchObject({ kind: 'build_perimeter', sidesAround: 0, squaresPlaced: 0, holes: 0,
    learnerWork: 'No squares shaded yet' });
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.demand())).not.toMatch(/targetPerimeter|expectedArea/);
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['edge_marks', 'help', false], ['piece_colors', 'help', false], ['smaller_perimeter', 'simplify', false]]);
  h.tap([0, 0]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true,
    request: expect.objectContaining({ numbers: 'never', made: 'one shape of shaded squares' }) }));
  // The made perimeter is a number the work history can read; the target is never beside it.
  expect(h.demand()).toMatchObject({ sidesAround: 4, squaresPlaced: 1 });
});

it('two over is named, Try again keeps the build, taking a column off passes, and the work history shows the fix', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount([build('a', 12, 1), build('b', 16, 1)]);
  vi.setSystemTime(Date.now() + 2000);
  h.tap(...rect(5, 2));
  h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'two_over' });
  expect(screen.getByText(/Not yet/).textContent).not.toMatch(/\d|more|less|too|fewer/i);
  h.dispatch('retry');
  expect(h.shaded()).toBe(10);
  expect(h.demand()).toMatchObject({ sidesAround: 14 });
  vi.setSystemTime(Date.now() + 2000);
  h.tap([4, 0], [4, 1]);
  expect(h.demand()).toMatchObject({ sidesAround: 12, workHistory: expect.stringContaining('sidesAround') });
  expect(String(h.demand().workHistory)).toMatch(/14 → 12/);
  h.done();
  expect(h.last()).toMatchObject({ itemId: 'a', correct: true });
  expect(screen.getByText('Yes! Your shape has a perimeter of 12 units.')).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b');
  expect(h.shaded()).toBe(0);
});

it('the area made instead of the perimeter, a hole and two pieces are each named; an L passes', () => {
  const h = mount([build('a', 12, 1)]);
  h.tap(...rect(4, 3)); h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'counted_squares' });
  expect(screen.getByText(/not the squares inside/)).toBeTruthy();
  h.dispatch('retry');
  h.press('Clear grid');
  h.tap(...rect(3, 3).filter(([c, r]) => !(c === 1 && r === 1))); h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'has_hole' });
  expect(h.demand()).toMatchObject({ holes: 1 });
  h.dispatch('retry');
  h.press('Clear grid');
  h.tap([0, 0], [0, 1], [5, 5]); h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'not_connected' });
  h.dispatch('retry');
  // An L of five: four down, one across the foot.
  h.tap([5, 5], [0, 2], [0, 3], [1, 3]);
  expect(h.demand()).toMatchObject({ sidesAround: 12, squaresPlaced: 5, separatePieces: 1 });
  h.done();
  expect(h.last()).toMatchObject({ correct: true });
});

it('a two-shape item keeps the first shape, refuses it turned, and passes a different area with the same perimeter', () => {
  const h = mount([build('a', 12, 2)]);
  h.tap(...rect(4, 2)); h.done();
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(screen.getByText(/Now change it into a different shape with the same perimeter/)).toBeTruthy();
  expect(h.demand()).toMatchObject({ shape: 'second', firstShape: expect.stringContaining('2 rows tall and 4 columns wide') });
  expect(h.levers().map(l => l.id)).toContain('turned_first');
  h.press('Clear grid');
  h.tap(...rect(2, 4, [3, 1])); h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'same_as_first' });
  expect(h.dispatch('pull_lever', { lever: 'turned_first' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="turned-first"]')).toBeTruthy();
  h.dispatch('retry');
  h.press('Clear grid');
  h.tap(...rect(3, 3)); h.done();
  expect(h.last()).toMatchObject({ correct: true });
  expect(screen.getByText(/Two different shapes, each with a perimeter of 12 units/)).toBeTruthy();
});

it('the edge-marks lever dots every side around the shape, no number, and stays out of the picture', () => {
  const h = mount([build('a', 12, 1)]);
  h.tap(...rect(3, 2)); h.done();
  expect(h.last()).toMatchObject({ miss: 'two_short' });
  expect(h.view.container.querySelectorAll('[data-lever="edge-mark"]')).toHaveLength(0);
  expect(h.dispatch('pull_lever', { lever: 'edge_marks' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="edge-mark"]')).toHaveLength(10);
  expect(String(h.demand().onScreen)).toMatch(/a dot sits on every side/);
  expect(String(h.demand().onScreen)).not.toMatch(/\b12\b/);
  const picture = h.view.container.querySelector('svg[data-build-scene="area-grid"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.querySelectorAll('circle')).toHaveLength(0);
  expect(picture.textContent).toBe('');
  h.dispatch('retry');
  h.tap([3, 0], [3, 1]);
  expect(h.view.container.querySelectorAll('[data-lever="edge-mark"]')).toHaveLength(12);
  h.done();
  expect(h.last()).toMatchObject({ correct: true, levers: ['edge_marks'] });
});

it('the simplify lever opens an ungraded smaller perimeter on an empty grid, then the full item comes back empty', () => {
  const h = mount([build('a', 16, 2)]);
  h.tap(...rect(2, 2)); h.done();
  expect(h.last()).toMatchObject({ miss: 'short_by_more' });
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_perimeter' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a~smaller');
  expect(receipt.state.task!.task).toBe('Make a shape with a perimeter of 8 units.');
  expect(h.shaded()).toBe(0);
  h.tap(...rect(3, 1)); h.done();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a');
  expect(h.shaded()).toBe(0);
});

it('the catalog mode is a build at beta 2.4, and every catalog miss is answered by a lever', () => {
  const entry = getComponentById('polygon-area-builder')!;
  expect(entry.evalModes!.find(m => m.evalMode === 'build_perimeter')).toMatchObject({ beta: 2.4,
    challengeTypes: ['build_perimeter'], affordances: { answers: ['build'] } });
  const levers = buildPerimeterLevers(build('a', 18, 2), []);
  for (const m of entry.teachingWorkspace!.misses!.build_perimeter) expect(levers.some(l => l.answers?.includes(m)), m).toBe(true);
});
