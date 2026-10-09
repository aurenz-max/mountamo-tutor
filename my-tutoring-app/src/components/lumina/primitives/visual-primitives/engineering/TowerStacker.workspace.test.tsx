// @vitest-environment jsdom
/**
 * tower-stacker on the shared teaching workspace (W1) and its three open builds: the real TowerStacker,
 * TeachingSession and LiveLessonRuntime. Every item is a checked gesture with a named miss and no published key; the
 * build starts on an empty area, commits at "I'm done!", keeps the tower through Try again, and its levers come on a miss.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { validateTowerStackerData } from '../../../components/live-activity/adapters/towerStackerLive';
import { getComponentById } from '../../../service/manifest/catalog';
import { towerStackerOracle } from '../../../service/qa/oracles/tower-stacker';
import {
  MIXED_MODES, TOWER_MODES, dropPiece, referenceWindproof, tippingCut, towerChallenges, towerItem, towerMiss, windFor, windLimit,
  type TowerChallenge, type TowerPiece,
} from './towerWorkspace';
import { shorterTower, towerLevers } from './towerLevers';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), watch: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'tower',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, resetAttempt: vi.fn(), elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import TowerStacker, { type TowerStackerData } from './TowerStacker';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); seam.evaluationContext = null; });

const TALL5 = towerItem('build_tall', 5, 'K-1', 't1');
const TALL6 = towerItem('build_tall', 6, 'K-1', 't2');
const FEW8 = towerItem('build_few', 8, '4-5', 'f1');
const WIND6 = towerItem('build_windproof', 6, '2-3', 'w1');

function mount(challenges: TowerChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data: TowerStackerData = { title: 'Towers', challengeType: challenges[0].type, challenges, instanceId: 'tower' };
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <TowerStacker data={data} runtimePlanItemId="plan-tower" runtimeEvalMode={challenges[0].type} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'tower',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  return { state, dispatch, confirmVisible, view, ...controls(view.container) };
}

function controls(container: HTMLElement) {
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const touch = (target: string) => act(() => { fireEvent.click(container.querySelector(`[data-pip-object="${target}"]`)!); });
  /** Pick a kind (turned or not) and drop it at each column in turn. */
  const drop = (kind: string, columns: number[], turn = false) => {
    touch(`tray-${kind}`);
    if (turn) press('Turn');
    columns.forEach(c => touch(`column-${c}`));
  };
  const placed = () => container.querySelectorAll('[data-placed]').length;
  return { press, touch, drop, placed };
}

const workspaceOf = (h: ReturnType<typeof mount>) => h.state().task!.workspace!;
const demand = (h: ReturnType<typeof mount>) => h.state().task!.demand as Record<string, unknown>;

it.each([TALL5, FEW8, WIND6])('$type mounts under tutor ownership as a gesture item with no published key', c => {
  const h = mount([c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(workspaceOf(h).expectedAnswer).toBeUndefined();
  // No wind number, balance point or verdict reaches the tutor.
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/"wind":|balance|limit|tipped|blew/i);
  expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
});

it('opens on an empty area with no readouts; levers start bare; the watcher may not judge stability or say a number', () => {
  const h = mount([WIND6]);
  expect(h.placed()).toBe(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(document.body.textContent).not.toMatch(/stability|center of gravity|wide base|%/i);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(demand(h)).toMatchObject({ kind: 'build_windproof', piecesPlaced: 0, towerHeight: 0, learnerWork: 'No pieces placed yet' });
  expect(workspaceOf(h).levers!.map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['balance_point', 'help', false], ['wind_gust', 'help', false], ['shorter_tower', 'simplify', false]]);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', neverSay: expect.arrayContaining(['wide', 'balance', 'fall']) }) }));
});

it('build_tall: one short is too_short, Try again keeps the tower, one more passes, and the work history shows it', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount([TALL5, TALL6]);
  vi.setSystemTime(Date.now() + 2000);
  h.drop('block', [6, 6, 6, 6]);
  expect(demand(h)).toMatchObject({ piecesPlaced: 4, towerHeight: 4 });
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: false, miss: 'too_short' });
  expect(screen.getByText(/^Not yet./).textContent).toMatch(/green line/);
  h.dispatch('retry');
  expect(h.placed()).toBe(4);
  vi.setSystemTime(Date.now() + 2000);
  // The learner takes the top block off, then builds up past the line.
  h.touch('piece-p4');
  vi.setSystemTime(Date.now() + 2000);
  h.drop('block', [6, 6]);
  expect(demand(h)).toMatchObject({ piecesPlaced: 5, workHistory: expect.stringContaining('piecesPlaced 0 → 4 → 3 → 5') });
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ itemId: 't1', correct: true,
    response: '5 pieces: 5 blocks. 5 tall, 2 wide at the bottom' });
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('t2');
  expect(h.placed()).toBe(0);
});

it('a leaning staircase tips; the balance lever draws on the scene and stays out of the picture; the fallen part stands up on Try again', () => {
  const h = mount([TALL5]);
  // Blocks two wide, each one step right of the last (left edges 0, 1, 2, 3, 4): every step is half held.
  h.drop('block', [1, 2, 3, 4, 5]);
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: false, miss: 'tips_over' });
  expect(h.view.container.querySelector('[data-falling]')).toBeTruthy();
  expect(h.dispatch('pull_lever', { lever: 'balance_point' }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="balance-point"]').length).toBeGreaterThan(0);
  expect(String(demand(h).onScreen)).toMatch(/balance point/);
  const picture = h.view.container.querySelector('svg[data-build-scene="tower"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.querySelectorAll('[data-placed]')).toHaveLength(5);
  expect(picture.querySelector('[data-lever]')).toBeNull();
  h.dispatch('retry');
  expect(h.view.container.querySelector('[data-falling]')).toBeNull();
  // Take the top three off (top first), then straighten.
  ['p5', 'p4', 'p3'].forEach(id => h.touch(`piece-${id}`));
  h.drop('block', [2, 2, 2]);
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: true, levers: ['balance_point'] });
});

it('a piece with something on it cannot be taken off first', () => {
  const h = mount([TALL5]);
  h.drop('block', [6, 6]);
  h.touch('piece-p1');
  expect(h.placed()).toBe(2);
  expect(screen.getByText(/take off the pieces on top/i)).toBeTruthy();
});

it('build_windproof: a plain column blows over; the gust lever tests it ungraded; flat beams pass', () => {
  const h = mount([WIND6]);
  h.drop('block', [6, 6, 6, 6, 6, 6]);
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: false, miss: 'blown_over' });
  expect(h.dispatch('pull_lever', { lever: 'wind_gust' }).status).toBe('committed');
  h.dispatch('retry');
  h.press(/try a gust/i);
  expect(screen.getByText(/gust blew part of your tower over/i)).toBeTruthy();
  expect(workspaceOf(h).attempts).toHaveLength(1);
  h.press('Clear');
  h.drop('beam', [6, 6, 6, 6, 6, 6]);
  h.press(/try a gust/i);
  expect(screen.getByText(/held in the gust/i)).toBeTruthy();
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: true });
});

it('build_few: too many pieces is named; beams stood on end pass within the cap', () => {
  const h = mount([FEW8]);
  expect(FEW8.maxPieces).toBe(3);
  h.drop('big', [6, 6, 6, 6]);
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: false, miss: 'too_many_pieces' });
  h.dispatch('retry');
  h.press('Clear');
  h.drop('beam', [6, 6], true);
  expect(demand(h)).toMatchObject({ towerHeight: 8, learnerWork: expect.stringContaining('stood on end') });
  h.press("I'm done!");
  expect(workspaceOf(h).attempts.at(-1)).toMatchObject({ correct: true });
});

it('the simplify lever opens an ungraded lower tower on an empty area, then the full item comes back empty', () => {
  const h = mount([TALL6]);
  h.drop('block', [6, 6]);
  h.press("I'm done!");
  const receipt = h.dispatch('pull_lever', { lever: 'shorter_tower' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('t2~shorter');
  expect(workspaceOf(h).practice).toEqual({ returnsTo: 't2' });
  expect(h.placed()).toBe(0);
  expect(h.view.container.querySelector('[data-goal-line]')!.getAttribute('data-goal-line')).toBe('4');
  h.drop('block', [6, 6, 6, 6]);
  h.press("I'm done!");
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t2');
  expect(h.placed()).toBe(0);
});

it('scripted path (the tester, no tutor): a miss keeps the tower, Next tower opens an empty area, the session submits once', () => {
  const data: TowerStackerData = { title: 'Towers', challengeType: 'build_tall', challenges: [TALL5, TALL6], instanceId: 'tower' };
  const view = render(<TowerStacker data={data} />);
  const c = controls(view.container);
  c.drop('block', [6, 6, 6]);
  c.press("I'm done!");
  expect(screen.getByText(/^Not yet\./)).toBeTruthy();
  c.drop('block', [6, 6]);
  c.press("I'm done!");
  c.press(/next tower/i);
  expect(c.placed()).toBe(0);
  c.drop('beam', [6, 6, 6, 6, 6, 6]);
  c.press("I'm done!");
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'tower-stacker', towersBuilt: 2, firstTryCount: 1 });
  expect(seam.send).not.toHaveBeenCalled();
});

it('the physics, targets, levers, oracle and catalog wiring', () => {
  const at = (pieces: Array<[string, number, number, number, number]>): TowerPiece[] =>
    pieces.map(([kind, x, y, w, h], i) => ({ id: `q${i}`, kind: kind as TowerPiece['kind'], x, y, w, h }));
  // A half-held piece balances on the edge and stands; a counterweight holds an overhang that alone would tip.
  expect(tippingCut(at([['block', 4, 0, 2, 1], ['block', 5, 1, 2, 1]]))).toBeUndefined();
  expect(tippingCut(at([['block', 4, 0, 2, 1], ['block', 5, 1, 2, 1], ['block', 6, 2, 2, 1]]))).toBeTruthy();
  expect(tippingCut(at([['block', 4, 0, 2, 1], ['beam', 3, 1, 4, 1], ['block', 5, 2, 2, 1], ['small', 3, 2, 1, 1]]))).toBeUndefined();
  // Gravity: a piece falls onto the highest piece under it and needs half its width held.
  const one = at([['block', 4, 0, 2, 1]]);
  expect(dropPiece(one, 'beam', false, 4, 'n')).toEqual({ piece: { id: 'n', kind: 'beam', x: 4, y: 1, w: 4, h: 1 } });
  expect(dropPiece(one, 'beam', false, 5, 'n')).toEqual({ blocked: 'needs_support' });
  expect(dropPiece(one, 'beam', true, 5, 'n')).toMatchObject({ piece: { x: 5, y: 1, w: 1, h: 4 } });
  // Every windproof wind blows a column over and lets the wide reference stand.
  for (const height of [4, 5, 6, 7, 8, 9, 10]) {
    const wind = windFor(height);
    const column = Array.from({ length: height }, (_, y) => ({ id: `c${y}`, kind: 'block' as const, x: 5, y, w: 2, h: 1 }));
    expect(windLimit(column)).toBeLessThan(wind);
    expect(windLimit(referenceWindproof(height))).toBeGreaterThanOrEqual(wind);
    expect(towerMiss(towerItem('build_windproof', height, '4-5', 'w'), referenceWindproof(height))).toBeUndefined();
  }
  // Sessions: three towers, rising, no height asked twice in a mode; mixed covers the band's tiers; every one passes the oracle and the adapter.
  for (const band of ['K-1', '2-3', '4-5'] as const) {
    for (const modes of [...TOWER_MODES.map(m => [m]), MIXED_MODES[band]]) {
      const challenges = towerChallenges(modes, band);
      expect(challenges).toHaveLength(3);
      const data = { title: 'Towers', challenges };
      expect(towerStackerOracle.verify(data as never, { componentId: 'tower-stacker' } as never).violations).toEqual([]);
      expect(() => validateTowerStackerData(data)).not.toThrow();
    }
  }
  expect(Array.from(new Set(towerChallenges(MIXED_MODES['2-3'], '2-3').map(c => c.type)))).toEqual(['build_tall', 'build_few', 'build_windproof']);
  // The easier ask: a lower line, a wind for its own height.
  expect(shorterTower(WIND6)).toMatchObject({ id: 'w1~shorter', targetHeight: 4, wind: windFor(4) });
  expect(shorterTower(shorterTower(WIND6)!)).toBeNull();
  expect(towerLevers(FEW8, []).map(l => l.id)).toEqual(['balance_point', 'piece_count', 'shorter_tower']);
  // Every lever names the build, never another mode's action.
  for (const l of [...towerLevers(WIND6, []), ...towerLevers(FEW8, [])]) expect(l.does).not.toMatch(/hand|answer|choose/i);

  const entry = getComponentById('tower-stacker')!;
  expect(entry.evalModes!.map(m => [m.evalMode, m.beta])).toEqual([['build_tall', 2.5], ['build_few', 3.0], ['build_windproof', 3.5]]);
  expect(entry.teachingWorkspace!.misses).toMatchObject({ build_few: ['tips_over', 'too_short', 'too_many_pieces'] });
});
