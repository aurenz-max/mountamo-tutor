// @vitest-environment jsdom
/**
 * coin-counter's open build, `show-amount`, on the shared teaching workspace: the real CoinCounter, TeachingSession and
 * LiveLessonRuntime. The learner makes a stated amount on an empty tray from coin bins; any coins that add up pass at
 * "I'm done!", a miss is named, Try again keeps the tray, and the levers come on a miss (none from the tier).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';
import { getComponentById } from '../../../service/manifest/catalog';
import { coinMiss, workspaceAssignment, type CoinView } from './coinCounterWorkspace';
import { coinCounterLevers, smallerAmount } from './coinCounterLevers';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), watch: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'coins',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true, isAudioPlaying: false,
  activePrimitiveId: 'coins' }) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => null,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
// The live line is the shared layer's (its own leak rules are tested there): here only what the tray asks it.
vi.mock('../../build-layer/buildLayer', () => ({ useBuildWatcher: (o: unknown) => { seam.watch(o); return ''; } }));
import CoinCounter, { type CoinCounterChallenge, type CoinCounterData } from './CoinCounter';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const SHOW: CoinCounterChallenge = { id: 'a', type: 'show-amount', instruction: 'Show 16¢ for a sticker, any way you like.',
  targetAmount: 16, availableCoins: ['penny', 'nickel', 'dime'] };

function mount(challenges: CoinCounterChallenge[], extra: Partial<CoinCounterData> = {}) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Coins', gradeBand: '2', instanceId: 'coins', challenges, ...extra } as CoinCounterData;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CoinCounter data={data} runtimePlanItemId="plan-coins" runtimeEvalMode="show-amount" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name
      || x.action.type === 'workspace' && (x.action as { operation: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    let receipt: ReturnType<typeof runtime.dispatch> | undefined;
    act(() => { receipt = runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'coins',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
    return receipt!;
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const press = (name: string | RegExp, times = 1) => {
    for (let i = 0; i < times; i++) act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  };
  const done = () => press("I'm done!");
  const tray = () => Array.from(view.container.querySelectorAll('[data-tray-index]'));
  const demand = () => state().task!.demand as Record<string, unknown>;
  const levers = () => state().task!.workspace!.levers ?? [];
  return { state, dispatch, confirmVisible, press, done, tray, demand, levers, view };
}

it('opens as a gesture item on an empty tray: the ask states the amount, no target or total beside the coins', () => {
  expect(workspaceAssignment(SHOW).response).toBe('gesture');
  const h = mount([SHOW]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(SHOW.instruction);
  expect(h.tray()).toHaveLength(0);
  expect(screen.getByRole('button', { name: "I'm done!" })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
  expect(document.body.textContent).not.toMatch(/target|on your tray:/i);
  // The made amount and each coin count are numbers, so the shared work history can read them.
  expect(h.demand()).toMatchObject({ kind: 'show-amount', centsMade: 0, penniesOnTray: 0, nickelsOnTray: 0, dimesOnTray: 0,
    learnerWork: 'No coins on the tray yet' });
  expect(h.demand()).not.toHaveProperty('target');
  // Levers start bare: none pulled at any tier.
  expect(h.levers().map(l => [l.id, l.kind, l.pulled])).toEqual([
    ['running_total', 'help', false], ['value_tags', 'help', false], ['smaller_amount', 'simplify', false]]);
  // The watcher is asked never to say a number, and is off on an empty tray.
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false,
    request: expect.objectContaining({ numbers: 'never', task: SHOW.instruction }) }));
});

it('one coin over is named, Try again keeps the build, taking one out passes, and the work history shows the fix', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const h = mount([SHOW, { ...SHOW, id: 'b', targetAmount: 23, instruction: 'Show 23¢ any way you like.' }]);
  // Past the host window of the item opening, so the taps count as the learner's own work.
  vi.setSystemTime(Date.now() + 2000);
  h.press('Add a dime'); h.press('Add a nickel'); h.press('Add a penny', 2);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_coin_over' });
  // The verdict names no amount and no direction.
  expect(screen.getByText(/Not yet/).textContent).not.toMatch(/\d|more|less|too/i);
  expect(seam.watch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  h.dispatch('retry');
  expect(h.tray()).toHaveLength(4);
  expect(h.demand()).toMatchObject({ centsMade: 17, penniesOnTray: 2 });
  expect(screen.getByText(/Not yet/)).toBeTruthy();
  vi.setSystemTime(Date.now() + 2000);
  h.press('Take out penny 4');
  expect(h.demand()).toMatchObject({ centsMade: 16, workHistory: expect.stringContaining('centsMade 0 → 17 → 16') });
  h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ itemId: 'a', correct: true });
  h.dispatch('advance'); h.confirmVisible();
  // A new item opens an empty tray.
  expect(h.state().task!.itemId).toBe('b');
  expect(h.tray()).toHaveLength(0);
});

it('one coin short is named, and any coin mix that adds up passes', () => {
  const h = mount([SHOW]);
  h.press('Add a dime'); h.press('Add a nickel');
  h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'one_coin_short' });
  h.dispatch('retry');
  // A different make from the kept tray: the dime out, then nickels and a penny.
  h.press('Take out dime 1');
  h.press('Add a nickel', 2); h.press('Add a penny');
  expect(h.demand()).toMatchObject({ centsMade: 16, nickelsOnTray: 3, penniesOnTray: 1, dimesOnTray: 0 });
  h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true });
});

it('help levers draw on the tray and never name the amount asked for; aids stay out of the picture', () => {
  const h = mount([SHOW], { showCoinValues: true });
  h.press('Add a dime'); h.press('Add a nickel'); h.done();
  expect(h.dispatch('pull_lever', { lever: 'running_total' }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="running-total"]')!.textContent).toBe('On your tray: 15¢');
  expect(h.dispatch('pull_lever', { lever: 'value_tags' }).status).toBe('committed');
  expect(Array.from(h.view.container.querySelectorAll('[data-lever="value-tag"]')).map(t => t.textContent)).toEqual(['10', '15']);
  expect(String(h.demand().onScreen)).toMatch(/under the tray/i);
  expect(String(h.demand().onScreen)).not.toMatch(/16/);
  expect(h.dispatch('pull_lever', { lever: 'running_total' }).status).toBe('blocked');
  // What the watcher sees: the svg less its `data-aid` parts carries no value or tag.
  const picture = h.view.container.querySelector('svg[data-build-scene="coin-tray"]')!.cloneNode(true) as SVGSVGElement;
  picture.querySelectorAll('[data-aid]').forEach(n => n.remove());
  expect(picture.textContent).toBe('dimenickel');
  h.dispatch('retry');
  h.press('Add a penny'); h.done();
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, levers: ['running_total', 'value_tags'] });
});

it('the simplify lever opens an ungraded half amount on an empty tray, then the full item comes back empty', () => {
  const h = mount([SHOW]);
  h.press('Add a dime', 3); h.done();
  const receipt = h.dispatch('pull_lever', { lever: 'smaller_amount' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('a~smaller');
  expect(receipt.state.task!.task).toBe('Show 8¢ any way you like.');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 'a' });
  expect(h.tray()).toHaveLength(0);
  h.press('Add a nickel'); h.press('Add a penny', 3); h.done();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('a');
  expect(h.tray()).toHaveLength(0);
  h.press('Add a dime'); h.press('Add a nickel'); h.press('Add a penny'); h.done();
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct, 'practice' in a])).toEqual([
    ['a', false, false], ['a~smaller', true, true], ['a', true, false]]);
});

it('misses, lever text and catalog wiring for the build', () => {
  const view: CoinView = { selectedCoin: null, countInput: '', counted: 0, enacted: null, placed: [], selectedGroup: null,
    changeInput: '', valuesShown: true, runningTotalShown: false };
  expect(coinMiss(SHOW, { ...view, placed: ['dime', 'nickel', 'penny', 'penny'] })).toBe('one_coin_over');
  expect(coinMiss(SHOW, { ...view, placed: ['dime', 'penny'] })).toBe('one_coin_short');
  expect(coinMiss(SHOW, { ...view, placed: Array(16).fill('nickel') })).toBe('counted_coins');
  expect(coinMiss(SHOW, { ...view, placed: ['dime', 'dime', 'dime'] })).toBe('over');
  expect(coinMiss(SHOW, { ...view, placed: ['nickel', 'nickel', 'nickel', 'penny'] })).toBeUndefined();

  const levers = coinCounterLevers(SHOW, []);
  // The text names the build (the tray, putting in), never another mode's action or the amount asked for.
  for (const l of levers) expect(`${l.when} ${l.does}`).not.toMatch(/hand|give|type|16/i);
  expect(levers.every(l => /tray|amount/i.test(l.does))).toBe(true);
  expect(smallerAmount(SHOW)).toMatchObject({ id: 'a~smaller', targetAmount: 8 });
  expect(smallerAmount(smallerAmount(SHOW)!)).toBeNull();
  expect(coinCounterLevers({ ...SHOW, type: 'make-amount' }, [])).toEqual([]);

  const entry = getComponentById('coin-counter')!;
  const mode = entry.evalModes!.find(m => m.evalMode === 'show-amount')!;
  expect(mode).toMatchObject({ beta: 3.6, challengeTypes: ['show-amount'], affordances: { answers: ['build'] } });
  // Every miss the check names is answered by a lever (J9).
  const misses = entry.teachingWorkspace!.misses!['show-amount'];
  for (const m of misses) expect(levers.some(l => l.answers?.includes(m)), m).toBe(true);
});
