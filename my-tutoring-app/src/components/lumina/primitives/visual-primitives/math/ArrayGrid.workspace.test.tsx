// @vitest-environment jsdom
/**
 * array-grid on the shared teaching workspace (W1, plain shape) and its open build `make_array`: the real ArrayGrid,
 * TeachingSession and LiveLessonRuntime. Every mode is a checked gesture with its named miss and no published key;
 * the build starts on an empty grid, commits at "I'm done!", keeps the squares through Try again, and its levers
 * come on a miss.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { arrayMiss, makeArrayMiss, workspaceAssignment, type ArrayGridView } from './arrayGridWorkspace';
import { arrayGridLevers, smallerArray } from './arrayGridLevers';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), watch: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'arrays',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy('enabled');
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'arrays' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
// The live line is the shared layer's (its own leak rules are tested there): here only what the grid asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import ArrayGrid, { type ArrayGridChallenge, type ArrayGridChallengeType, type ArrayGridData } from './ArrayGrid';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); seam.evaluationContext = null; });

const DIMS: ArrayGridChallenge = { id: 'a', targetRows: 3, targetColumns: 4 };
const MAKE: ArrayGridChallenge = { id: 'm', targetRows: 0, targetColumns: 0, total: 12, ways: 1, instruction: 'Make an array with 12 squares.' };
const TWO: ArrayGridChallenge = { id: 't', targetRows: 0, targetColumns: 0, total: 6, ways: 2,
  instruction: 'Make an array with 6 squares. Then make a different array with 6 squares.' };

function mount(mode: ArrayGridChallengeType, challenges: ArrayGridChallenge[], extra: Partial<ArrayGridData> = {}) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data: ArrayGridData = { title: 'Arrays', description: 'Arrays', challengeType: mode, iconType: 'star', instanceId: 'arrays',
    challenges, ...extra };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ArrayGrid data={data} runtimePlanItemId="plan-arrays" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'arrays',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const write = (name: string, text: string) => act(() => { fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value: text } }); });
  const tap = (r: number, c: number) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="cell-${r}-${c}"]`)!); });
  /** A full rows × columns rectangle from the top-left cell. */
  const fill = (rows: number, columns: number) => { for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) tap(r, c); };
  const squares = () => view.container.querySelectorAll('[data-filled]').length;
  const demand = () => state().task!.demand as Record<string, unknown>;
  const last = () => state().task!.workspace!.attempts.at(-1);
  const levers = () => state().task!.workspace!.levers ?? [];
  return { state, dispatch, confirmVisible, press, write, tap, fill, squares, demand, last, levers, view };
}

const ITEM: Record<ArrayGridChallengeType, ArrayGridChallenge> = { build_array: DIMS, count_array: DIMS, multiply_array: DIMS, make_array: MAKE };

it.each(Object.keys(ITEM) as ArrayGridChallengeType[])('%s mounts under tutor ownership as a gesture item with no published total', mode => {
  const h = mount(mode, [ITEM[mode]]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(workspaceAssignment(ITEM[mode], mode, mode === 'make_array' ? 'square' : 'star').task);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/\b12\b(?! squares)/);
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
});

it('build: a wrong total names its miss, Try again clears the typed total and keeps the array, a right one completes and submits', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build_array', [DIMS, { id: 'b', targetRows: 2, targetColumns: 5 }]);
  h.press('Rows: 3'); h.press('Columns: 4');
  expect(h.demand()).toMatchObject({ rowsBuilt: 3, columnsBuilt: 4, asked: '3 rows and 4 columns' });
  h.write('Total', '7'); h.press(/check/i);
  expect(h.last()).toMatchObject({ correct: false, miss: 'added_sides' });
  expect(screen.getByRole('button', { name: /check/i })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect((screen.getByRole('spinbutton', { name: 'Total' }) as HTMLInputElement).value).toBe('');
  expect(h.demand()).toMatchObject({ rowsBuilt: 3, columnsBuilt: 4 });
  h.write('Total', '12'); h.press(/check/i);
  expect(h.last()).toMatchObject({ correct: true });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b');
  h.press('Rows: 2'); h.press('Columns: 5'); h.write('Total', '10'); h.press(/check/i);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect([success, score]).toEqual([true, 84]);
  expect(metrics).toMatchObject({ type: 'array-grid', challengeType: 'build_array', correctCount: 2 });
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'a', miss: 'added_sides' })]);
});

it('multiply: swapped sides and a total one row off are named', () => {
  const h = mount('multiply_array', [DIMS]);
  h.write('Rows', '4'); h.write('Columns', '3'); h.write('Total', '12'); h.press(/check/i);
  expect(h.last()).toMatchObject({ correct: false, miss: 'swapped_sides' });
  h.dispatch('retry');
  h.write('Rows', '3'); h.write('Columns', '4'); h.write('Total', '8'); h.press(/check/i);
  expect(h.last()).toMatchObject({ correct: false, miss: 'one_row_off' });
});

it('make: opens on an empty grid with no target, count or Check; levers start bare; the watcher may say no number', () => {
  const h = mount('make_array', [MAKE]);
  expect(h.squares()).toBe(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  expect(document.body.textContent).not.toMatch(/squares on your grid/i);
  // The made array is three numbers, so the shared work history can read them; the target is not beside them.
  expect(h.demand()).toMatchObject({ kind: 'make_array', rowsMade: 0, columnsMade: 0, squaresMade: 0,
    learnerWork: 'No squares on the grid yet' });
  expect(h.demand()).not.toHaveProperty('total');
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['row_counts', 'help', false], ['square_count', 'help', false], ['smaller_array', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', task: MAKE.instruction }) }));
});

it('make: a ragged build is named, Try again keeps it, the fix passes, and the work history shows the fix', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount('make_array', [MAKE, { ...MAKE, id: 'm2', total: 8, instruction: 'Make an array with 8 squares.' }]);
  // Past the host window of the item opening, so the taps count as the learner's own work.
  vi.setSystemTime(Date.now() + 2000);
  h.fill(3, 4); h.tap(3, 0);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'ragged' });
  // The verdict names no number and no direction.
  expect(screen.getByText(/Not yet/).textContent).not.toMatch(/\d|more|fewer|less|too/i);
  h.dispatch('retry');
  expect(h.squares()).toBe(13);
  expect(screen.getByText(/Not yet/)).toBeTruthy();
  expect(h.demand()).toMatchObject({ rowsMade: 4, columnsMade: 4, squaresMade: 13 });
  vi.setSystemTime(Date.now() + 2000);
  h.tap(3, 0);
  expect(h.demand()).toMatchObject({ squaresMade: 12, workHistory: expect.stringContaining('squaresMade 0 → 13 → 12') });
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ itemId: 'm', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  // A new item opens an empty grid.
  expect(h.state().task!.itemId).toBe('m2');
  expect(h.squares()).toBe(0);
});

it('make, two ways: the first array is kept and not committed, the same one again is named, a turned array passes', () => {
  const h = mount('make_array', [TWO]);
  h.fill(2, 3); h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts).toHaveLength(0);
  expect(h.view.container.querySelector('[data-first-array="2x3"]')).toBeTruthy();
  expect(h.demand()).toMatchObject({ way: 'second', firstArray: expect.stringContaining('2 rows of 3') });
  h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: false, miss: 'same_as_first' });
  h.dispatch('retry');
  h.press('Clear the grid'); h.fill(3, 2); h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: true, response: 'Second array: an array of 3 rows of 2 (first: 2 rows of 3)' });
});

it('help levers draw on the grid and never name the number asked for; aids stay out of the picture', () => {
  const h = mount('make_array', [MAKE]);
  h.fill(2, 5); h.press("I'm done!");
  expect(h.last()).toMatchObject({ miss: 'one_line_short' });
  expect(h.dispatch('pull_lever', { lever: 'row_counts' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="row-count"]')).map(t => t.textContent)).toEqual(['5', '5']);
  expect(h.dispatch('pull_lever', { lever: 'square_count' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="square-count"]')!.textContent).toBe('Squares on your grid: 10');
  expect(String(h.demand().onScreen)).toMatch(/beside each row/i);
  expect(String(h.demand().onScreen)).not.toMatch(/12/);
  expect(h.dispatch('pull_lever', { lever: 'row_counts' }).status).toBe('blocked');
  // What the watcher sees: the svg less its `data-aid` parts carries no number.
  const picture = h.view.container.querySelector('svg[data-build-scene="array-grid"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.textContent).toBe('');
  h.dispatch('retry');
  h.tap(0, 5); h.tap(1, 5); h.press("I'm done!");
  expect(h.last()).toMatchObject({ correct: true, levers: ['row_counts', 'square_count'] });
});

it('the simplify lever opens an ungraded smaller array on an empty grid, then the full item comes back empty', () => {
  const h = mount('make_array', [MAKE]);
  h.fill(2, 2); h.press("I'm done!");
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_array' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('m~smaller');
  expect(receipt.state.task!.task).toBe('Make an array with 6 squares.');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'm' });
  expect(h.squares()).toBe(0);
  h.fill(2, 3); h.press("I'm done!");
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('m');
  expect(h.squares()).toBe(0);
  h.fill(3, 4); h.press("I'm done!");
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['m', false, false], ['m~smaller', true, true], ['m', true, false]]);
});

it('misses, lever text and catalog wiring for the build', () => {
  const cells = (rows: number, columns: number) => Array.from({ length: rows * columns }, (_, i) => `${Math.floor(i / columns)}-${i % columns}`);
  expect(makeArrayMiss(12, cells(3, 4))).toBeUndefined();
  expect(makeArrayMiss(12, cells(1, 12))).toBeUndefined();
  expect(makeArrayMiss(12, [...cells(3, 4).slice(0, -1)])).toBe('ragged');
  expect(makeArrayMiss(12, ['0-0', '0-1', '0-3'])).toBe('ragged');
  expect(makeArrayMiss(12, cells(3, 3))).toBe('one_line_short');
  expect(makeArrayMiss(12, cells(4, 4))).toBe('one_line_over');
  expect(makeArrayMiss(12, cells(2, 2))).toBe('too_few');
  expect(makeArrayMiss(12, cells(5, 5))).toBe('too_many');
  expect(makeArrayMiss(12, cells(3, 4), { rows: 3, columns: 4 })).toBe('same_as_first');
  expect(makeArrayMiss(12, cells(4, 3), { rows: 3, columns: 4 })).toBeUndefined();
  const view: ArrayGridView = { mode: 'count_array', icon: 'star', rows: 3, columns: 4, totalAnswer: '', rowsAnswer: '', columnsAnswer: '',
    labelsShown: true, cells: [], firstWay: null };
  expect(arrayMiss(DIMS, { ...view, totalAnswer: '7' })).toBe('added_sides');
  expect(arrayMiss(DIMS, { ...view, totalAnswer: '8' })).toBe('one_row_off');
  expect(arrayMiss(DIMS, { ...view, totalAnswer: '9' })).toBe('one_column_off');
  expect(arrayMiss(DIMS, { ...view, totalAnswer: '13' })).toBe('off_by_one');
  expect(arrayMiss(DIMS, { ...view, totalAnswer: '20' })).toBe('other_total');

  const levers = arrayGridLevers(MAKE, []);
  // The text names the build (the grid, putting in), never another mode's action or the number asked for.
  for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/type|check|12/i);
  expect(levers.every(l => /grid|row/i.test(l.does))).toBe(true);
  expect(smallerArray(MAKE)).toMatchObject({ id: 'm~smaller', total: 6, ways: 1 });
  expect(smallerArray({ ...MAKE, total: 6 })).toBeNull();
  expect(smallerArray(smallerArray(MAKE)!)).toBeNull();
  expect(arrayGridLevers(DIMS, [])).toEqual([]);

  const entry = getComponentById('array-grid')!;
  expect(entry.evalModes!.find(m => m.evalMode === 'make_array')).toMatchObject({ beta: 1.6, challengeTypes: ['make_array'],
    affordances: { answers: ['build'] } });
  // Every miss the check names is answered by a lever, or listed as unanswered by decision (J9).
  const misses = entry.teachingWorkspace!.misses!.make_array, unanswered = entry.teachingWorkspace!.unanswered!.make_array;
  for (const m of misses) expect(levers.some(l => l.answers?.includes(m)) || unanswered.includes(m), m).toBe(true);
});
