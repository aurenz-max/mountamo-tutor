// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real CoinCounter on the shared teaching workspace, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The activity's own check commits a checked
 * gesture with its named miss; the runtime owns progression; the scored session is what gets submitted.
 * Only microphone hardware, evaluation writes, sound and the legacy AI-context hook are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { coinMiss } from './coinCounterWorkspace';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), legacy: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'coins',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (o: { enabled?: boolean }) => {
  if (o.enabled !== false) seam.legacy('enabled');
  return { sendText: seam.legacy, isConnected: true, isAudioPlaying: false, activePrimitiveId: 'coins' };
} }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import CoinCounter, { type CoinCounterChallenge, type CoinCounterData } from './CoinCounter';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); seam.evaluationContext = null; });

const CHALLENGES: Record<string, CoinCounterChallenge> = {
  identify: { id: 'i', type: 'identify', instruction: 'Which coin is a nickel?', targetCoin: 'nickel', options: ['penny', 'nickel', 'dime', 'quarter'] },
  'count-like': { id: 'l', type: 'count', instruction: 'How much money is shown?', countMode: 'like', displayedCoins: [{ type: 'nickel', count: 4 }], correctTotal: 20 },
  'count-mixed': { id: 'm', type: 'count', instruction: 'How much money is shown?', countMode: 'mixed',
    displayedCoins: [{ type: 'dime', count: 3 }, { type: 'penny', count: 2 }], correctTotal: 32 },
  compare: { id: 'c', type: 'compare', instruction: 'Which group has more money?', groupA: [{ type: 'penny', count: 6 }],
    groupB: [{ type: 'dime', count: 1 }], correctGroup: 'B' },
  'make-amount': { id: 'a', type: 'make-amount', instruction: 'Make 16¢.', targetAmount: 16, availableCoins: ['penny', 'nickel', 'dime'] },
  'fewest-coins': { id: 'f', type: 'make-amount', instruction: 'Make 30¢ with the fewest coins.', targetAmount: 30, availableCoins: ['nickel', 'dime', 'quarter'] },
  'make-change': { id: 'g', type: 'make-change', instruction: 'You pay 50¢ for a 35¢ toy. What is your change?', paidAmount: 50, itemCost: 35, correctChange: 15 },
};

function mount(evalMode: string, challenges: CoinCounterChallenge[], gradeBand: CoinCounterData['gradeBand'] = '2',
  extra: Partial<CoinCounterData> = {}) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: unknown[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { title: 'Coins', gradeBand, instanceId: 'coins', challenges, ...extra } as CoinCounterData;
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <CoinCounter data={data} runtimePlanItemId="plan-coins" runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name)!;
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'coins',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const choose = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const write = (name: string, text: string) => act(() => { fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value: text } }); });
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  return { runtime, transport, sent, state, dispatch, confirmVisible, choose, write, check };
}

it.each(Object.keys(CHALLENGES))('%s mounts under tutor ownership with no scripted cue and no published key', mode => {
  const c = CHALLENGES[mode];
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe(c.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const demand = JSON.stringify(h.state().task!.demand);
  // The gesture key never reaches the tutor: no total, winner, change or target coin position.
  expect(demand).not.toMatch(/correct|\b32¢|"20|\b15¢|coin 2/i);
  expect(seam.legacy).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /next challenge/i })).toBeNull();
});

it('identify draws the coins without names or values, labelled only by position', () => {
  mount('identify', [CHALLENGES.identify]);
  for (const name of ['Coin 1', 'Coin 2', 'Coin 3', 'Coin 4']) expect(screen.getByRole('button', { name }).textContent).toBe('');
  expect(document.body.textContent).not.toMatch(/penny|dime|quarter|\d¢/i);
});

it('coin values hidden on screen reach the tutor as hidden', () => {
  const h = mount('count-mixed', [CHALLENGES['count-mixed']], '2', { showCoinValues: false });
  expect(h.state().task!.demand).toMatchObject({ coins: '3 dimes, 2 pennies',
    coinValues: 'hidden: do not say what any coin is worth' });
  expect(document.body.textContent).not.toMatch(/10¢|1¢/);
});

it('a wrong total commits its named miss, stays closed until Try again clears it, then a right one completes and submits the miss', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('count-mixed', [CHALLENGES['count-mixed'], { ...CHALLENGES['count-mixed'], id: 'm2',
    displayedCoins: [{ type: 'nickel', count: 2 }], correctTotal: 10 }]);
  h.write('Total in cents', '5'); h.check();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(JSON.stringify(h.state().task)).toContain('counted_coins');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Typed 5¢ as the total');
  expect(screen.getByRole('button', { name: /check/i })).toHaveProperty('disabled', true);
  h.write('Total in cents', '32');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Typed 5¢ as the total' });
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No total typed yet' });
  h.write('Total in cents', '32'); h.check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('m2');
  h.write('Total in cents', '10'); h.check();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, , work, , evidence] = seam.submit.mock.calls[0];
  // One correction on the first item scores it 67: the session is not a flat 100.
  expect([success, score]).toEqual([true, 84]);
  expect(work.teachingAttempts).toHaveLength(3);
  expect(evidence.phases).toEqual([expect.objectContaining({ itemId: 'm', phase: 'count-mixed', miss: 'counted_coins' })]);
  expect(evidence.firstResponseScore).toBe(50);
  expect(seam.legacy).not.toHaveBeenCalled();
});

it('make-amount: Try again takes the placed coins out', () => {
  const h = mount('make-amount', [CHALLENGES['make-amount']]);
  h.choose('Add a dime'); h.choose('Add a nickel'); h.check();
  expect(JSON.stringify(h.state().task)).toContain('one_coin_short');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'No coins placed yet' });
});

it('coinMiss names each type\'s signature error', () => {
  const view = { selectedCoin: null, countInput: '', counted: 0, enacted: null, placed: [], selectedGroup: null, changeInput: '',
    valuesShown: true, runningTotalShown: true } as const;
  expect(coinMiss(CHALLENGES.identify, { ...view, selectedCoin: 'dime' })).toBe('dime_nickel');
  expect(coinMiss(CHALLENGES.identify, { ...view, selectedCoin: 'quarter' })).toBe('silver_coins');
  expect(coinMiss(CHALLENGES['count-mixed'], { ...view, countInput: '5' })).toBe('counted_coins');
  expect(coinMiss(CHALLENGES['count-mixed'], { ...view, countInput: '50' })).toBe('all_one_kind');
  expect(coinMiss(CHALLENGES['count-mixed'], { ...view, countInput: '22' })).toBe('one_coin_short');
  expect(coinMiss(CHALLENGES['count-like'], { ...view, countInput: '25' })).toBe('one_coin_over');
  expect(coinMiss(CHALLENGES['count-mixed'], { ...view, countInput: '32' })).toBeUndefined();
  expect(coinMiss(CHALLENGES.compare, { ...view, selectedGroup: 'A' })).toBe('more_coins');
  expect(coinMiss(CHALLENGES.compare, { ...view, selectedGroup: 'equal' })).toBe('said_equal');
  expect(coinMiss(CHALLENGES['make-amount'], { ...view, placed: ['dime', 'nickel', 'penny', 'penny'] })).toBe('one_coin_over');
  expect(coinMiss(CHALLENGES['make-amount'], { ...view, placed: Array(16).fill('dime') })).toBe('counted_coins');
  expect(coinMiss(CHALLENGES['make-change'], { ...view, changeInput: '35' })).toBe('gave_cost');
  expect(coinMiss(CHALLENGES['make-change'], { ...view, changeInput: '85' })).toBe('added');
});
