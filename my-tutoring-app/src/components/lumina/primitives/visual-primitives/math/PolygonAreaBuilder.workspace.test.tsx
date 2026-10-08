// @vitest-environment jsdom
/**
 * polygon-area-builder on the shared teaching workspace: the real component, TeachingSession and LiveLessonRuntime.
 * Every mode is a gesture item whose key never reaches the tutor; a typed area commits through Check with a named
 * miss. The open build (`build_area`) shades squares on an empty grid into one shape with a stated area; "I'm done!"
 * commits, a miss is named, Try again keeps the build, a two-shape item asks for a different second shape, and the
 * levers come on a miss (none from the tier).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { buildAreaAsk, buildAreaLevers } from './polygonAreaBuild';

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
// The live line is the shared layer's (its own leak rules are tested there): here only what the grid asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import PolygonAreaBuilder, { type PolygonAreaChallenge, type PolygonAreaBuilderData } from './PolygonAreaBuilder';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const build = (id: string, area: number, shapes: 1 | 2): PolygonAreaChallenge => ({ id, type: 'build_area', figureType: 'grid',
  targetArea: area, expectedArea: area, shapesAsked: shapes, unitLabel: 'square units',
  narration: 'Each square on the grid is one square unit.', instruction: buildAreaAsk(area, shapes),
  hint: 'Count each square as you shade it.' });
const ONE = build('a', 6, 1);
const TWO = build('b', 6, 2);
const TRIANGLE: PolygonAreaChallenge = { id: 't', type: 'find_area_triangle_parallelogram', figureType: 'triangle', base: 8,
  height: 5, apexX: 3, expectedArea: 20, unitLabel: 'cm', narration: 'A sail.', instruction: 'Find the area of this triangle.',
  hint: 'Half of base times height.' };

function mount(challenges: PolygonAreaChallenge[], mode = 'build_area') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Area', description: '', challengeType: challenges[0].type, gradeBand: '3', instanceId: 'area',
    challenges } as PolygonAreaBuilderData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <PolygonAreaBuilder data={data} runtimePlanItemId="plan-area" runtimeEvalMode={mode} />
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
  /** Tap squares by column and row (0-based). */
  const tap = (...cells: Array<[number, number]>) => cells.forEach(([c, r]) =>
    act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="cell-${c}-${r}"]`)!); }));
  const done = () => press("I'm done!");
  const shaded = () => view.container.querySelectorAll('[data-shaded="true"]').length;
  const demand = () => state().task!.demand as Record<string, unknown>;
  const levers = () => state().task!.workspace!.levers ?? [];
  const last = () => state().task!.workspace!.attempts.at(-1);
  return { state, dispatch, confirmVisible, press, tap, done, shaded, demand, levers, last, view };
}

const row = (n: number, r = 0) => Array.from({ length: n }, (_, c) => [c, r] as [number, number]);

it.each(getComponentById('polygon-area-builder')!.evalModes!.map(m => m.evalMode))(
  '%s binds as a gesture item whose key never reaches the tutor', mode => {
    const ch: PolygonAreaChallenge = mode === 'build_area' ? ONE : mode === 'find_area_triangle_parallelogram' ? TRIANGLE
      : { ...TRIANGLE, type: mode as PolygonAreaChallenge['type'], figureType: mode === 'decompose' ? 'parallelogram' : 'trapezoid',
        base2: 4, skew: 2, expectedArea: mode === 'decompose' ? 40 : 30, parts: [{ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 2, w: 2, h: 2 }],
        vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }] };
    const h = mount([ch], mode);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).toBe(ch.instruction);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(h.demand())).not.toMatch(/expectedArea/);
    if (mode !== 'build_area') expect(Object.values(h.demand()).join(' ')).not.toMatch(new RegExp(`\\b${ch.expectedArea}\\b`));
    // The scripted cues never reach the tutor, and there is no Next of the primitive's own.
    expect(seam.send.mock.calls.flat().filter(x => typeof x === 'string').join(' ')).not.toMatch(/ACTIVITY_START|\[[A-Z]+_/);
    expect(screen.queryByRole('button', { name: /next figure/i })).toBeNull();
  });

it('a typed area commits through Check with a named miss; Try again clears the box; the right area completes', () => {
  const h = mount([TRIANGLE], 'find_area_triangle_parallelogram');
  const type = (v: string) => act(() => { fireEvent.change(screen.getByLabelText('Area'), { target: { value: v } }); });
  type('40'); h.press('Check');
  expect(h.last()).toMatchObject({ correct: false, miss: 'forgot_half' });
  expect(h.demand().learnerWork).toBe('Typed 40 cm² as the area');
  h.dispatch('retry');
  expect((screen.getByLabelText('Area') as HTMLInputElement).value).toBe('');
  type('13'); h.press('Check');
  expect(h.last()).toMatchObject({ correct: false, miss: 'added_sides' });
  h.dispatch('retry');
  type('20'); h.press('Check');
  expect(h.last()).toMatchObject({ itemId: 't', correct: true });
});

it('opens an empty grid: the ask states the area, no count or target beside the squares, levers bare', () => {
  const h = mount([ONE]);
  expect(h.shaded()).toBe(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /^check$/i })).toBeNull();
  expect(h.demand()).toMatchObject({ kind: 'build_area', squaresPlaced: 0, separatePieces: 0, learnerWork: 'No squares shaded yet' });
  expect(h.demand()).not.toHaveProperty('targetArea');
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['square_numbers', 'help', false], ['piece_colors', 'help', false], ['smaller_area', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', task: ONE.instruction }) }));
});

it('one over is named, Try again keeps the build, clearing one passes, and the work history shows the fix', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount([ONE, build('c', 8, 1)]);
  vi.setSystemTime(Date.now() + 2000);
  h.tap(...row(7));
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'one_over' });
  // The verdict names no number and no direction.
  expect(screen.getByText(/Not yet/).textContent).not.toMatch(/\d|more|less|too|fewer/i);
  h.dispatch('retry');
  expect(h.shaded()).toBe(7);
  expect(h.demand()).toMatchObject({ squaresPlaced: 7, separatePieces: 1 });
  expect(screen.getByText(/Not yet/)).toBeTruthy();
  vi.setSystemTime(Date.now() + 2000);
  h.tap([6, 0]);
  expect(h.demand()).toMatchObject({ squaresPlaced: 6, workHistory: expect.stringContaining('squaresPlaced 0 → 7 → 6') });
  h.done();
  expect(h.last()).toMatchObject({ itemId: 'a', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c');
  expect(h.shaded()).toBe(0);
});

it('one short and two pieces are named; any connected shape of the area passes', () => {
  const h = mount([ONE]);
  h.tap(...row(5)); h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'one_short' });
  h.dispatch('retry');
  h.tap([0, 3]); h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'not_connected' });
  expect(screen.getByText(/2 separate pieces/)).toBeTruthy();
  h.dispatch('retry');
  // An L: three along the top, three down from its end (clear the stray square and the last two of the row).
  h.tap([0, 3], [3, 0], [4, 0]);
  h.tap([2, 1], [2, 2], [2, 3]);
  expect(h.demand()).toMatchObject({ squaresPlaced: 6, separatePieces: 1 });
  h.done();
  expect(h.last()).toMatchObject({ correct: true });
});

it('a two-shape item keeps the first shape, refuses it turned, and passes a different shape', () => {
  const h = mount([TWO]);
  h.tap(...row(6)); h.done();
  // A right first shape is not a commit: it is kept and the second shape begins.
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.demand()).toMatchObject({ shape: 'second', firstShape: expect.stringContaining('1 row tall and 6 columns wide') });
  expect(h.view.container.querySelector('[data-first-shape]')).toBeTruthy();
  expect(h.levers().map(l => l.id)).toContain('turned_first');
  // The same strip stood on end.
  h.press('Clear grid');
  h.tap(...Array.from({ length: 6 }, (_, r) => [2, r] as [number, number]));
  h.done();
  expect(h.last()).toMatchObject({ correct: false, miss: 'same_as_first' });
  expect(h.dispatch('pull_lever', { lever: 'turned_first' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="turned-first"]')).toBeTruthy();
  h.dispatch('retry');
  expect(h.shaded()).toBe(6);
  // Move the bottom two across: a different shape, the same area.
  h.tap([2, 4], [2, 5], [3, 0], [3, 1]);
  h.done();
  expect(h.last()).toMatchObject({ correct: true });
  expect(screen.getByText(/Two different shapes/)).toBeTruthy();
});

it('help levers draw on the grid and never name the area asked for; aids stay out of the picture', () => {
  const h = mount([ONE]);
  h.tap(...row(3), [5, 0], [6, 0]); h.done();
  expect(h.last()).toMatchObject({ miss: 'one_short' });
  expect(h.dispatch('pull_lever', { lever: 'square_numbers' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="square-number"]')).map(t => t.textContent))
    .toEqual(['1', '2', '3', '4', '5']);
  expect(h.dispatch('pull_lever', { lever: 'piece_colors' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="piece-tint"]')).toHaveLength(5);
  expect(String(h.demand().onScreen)).toMatch(/carries a number/);
  expect(String(h.demand().onScreen)).not.toMatch(/\b6\b/);
  expect(h.dispatch('pull_lever', { lever: 'square_numbers' }).status).toBe('blocked');
  const picture = h.view.container.querySelector('svg[data-build-scene="area-grid"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.textContent).toBe('');
  h.dispatch('retry');
  h.tap([3, 0], [4, 0], [6, 0]); h.done();
  expect(h.last()).toMatchObject({ correct: true, levers: ['square_numbers', 'piece_colors'] });
});

it('the simplify lever opens an ungraded half area on an empty grid, then the full item comes back empty', () => {
  const h = mount([build('a', 12, 2)]);
  h.tap(...row(3)); h.done();
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_area' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a~smaller');
  expect(receipt.state.task!.task).toBe('Make a shape with an area of 6 squares.');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'a' });
  expect(h.shaded()).toBe(0);
  h.tap(...row(6)); h.done();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a');
  expect(h.shaded()).toBe(0);
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['a', false, false], ['a~smaller', true, true]]);
});

it('every catalog miss of the build is answered by a lever, and no lever text names the area', () => {
  const entry = getComponentById('polygon-area-builder')!;
  expect(entry.evalModes!.find(m => m.evalMode === 'build_area')).toMatchObject({ beta: 1.6, challengeTypes: ['build_area'],
    affordances: { answers: ['build'] } });
  const levers = buildAreaLevers(build('a', 14, 2), []);
  for (const m of entry.teachingWorkspace!.misses!.build_area) expect(levers.some(l => l.answers?.includes(m)), m).toBe(true);
  for (const l of levers) {
    expect(`${l.when} ${l.does}`).not.toMatch(/\b14\b|type|hand|drag/i);
    expect(/square|grid|shape/i.test(l.does)).toBe(true);
  }
});
