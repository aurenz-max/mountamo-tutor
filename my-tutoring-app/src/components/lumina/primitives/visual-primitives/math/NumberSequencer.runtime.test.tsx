// @vitest-environment jsdom
//
// Real NumberSequencer, real judged runner, real LiveLessonRuntime, real transport
// and rendering shell. Only microphone hardware, evaluation writes and sound are
// substituted. Every case below is an action this adapter ADVERTISES, or a mode
// where it deliberately advertises nothing.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { statesNumber } from '../../../components/live-activity/runtime/liveScaffolds';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../../hooks/voiceTurnMachine';

const seam = vi.hoisted(() => ({ conversation: [] as any[], audio: false, close: null as any,
  send: vi.fn(), submit: vi.fn(), held: 0 }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson', activePrimitiveId: 'train',
  sessionResumeCount: 0, conversation: seam.conversation, sendText: seam.send, startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn(),
  holdVoiceTurns: () => { seam.held++; return () => { seam.held--; }; },
  sharedVoiceTurns: { subscribe: (listener: any) => { seam.close = listener.onTurnClose; return () => { seam.close = null; }; },
    isVoiceActive: () => false, reset: vi.fn(), lastTurnOpenAtRef: { current: null }, floorsRef: { current: { ambientRms: 0, echoRms: 0 } },
    config: DEFAULT_VOICE_TURN_CONFIG },
}) }));
vi.mock('../../../hooks/useLiveVoiceTurns', async original => ({ ...(await original<any>()), useLiveVoiceTurns: () => ({
  isVoiceActive: () => false, reset: vi.fn(), lastTurnOpenAtRef: { current: null }, floorsRef: { current: {} }, config: DEFAULT_VOICE_TURN_CONFIG,
}) }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/DiActionPanel', () => ({ default: () => null }));
import NumberSequencer, { type NumberSequencerChallenge, type NumberSequencerData } from './NumberSequencer';

type Kind = NumberSequencerChallenge['type'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.audio = false; seam.close = null; seam.held = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/**
 * One challenge per mode, each satisfying `sequencerChallengeValid`. The off-by-one
 * neighbour of a fill-missing answer is deliberately NOT printed, so that aid and
 * the already-printed aid can be routed apart.
 */
function challengeFor(kind: Kind, index: number): NumberSequencerChallenge {
  const id = `c${index}`, instruction = 'Work out the number train.';
  switch (kind) {
    case 'count-from': return { id, type: kind, instruction, sequence: [], correctAnswers: [6, 7],
      startNumber: 5, direction: 'forward', rangeMin: 5, rangeMax: 7 };
    case 'before-after': return { id, type: kind, instruction, sequence: [7, null], correctAnswers: [8],
      rangeMin: 7, rangeMax: 8 };
    case 'fill-missing': return { id, type: kind, instruction, sequence: [null, 5, 6, 7], correctAnswers: [4],
      rangeMin: 4, rangeMax: 7 };
    case 'decade-fill': return { id, type: kind, instruction, sequence: [28, 29, null, null, 32],
      correctAnswers: [30, 31], rangeMin: 28, rangeMax: 32 };
    case 'spot-error': return { id, type: kind, instruction, sequence: [4, 5, 9, 7, 8], wrongIndex: 2,
      correctAnswers: [6], rangeMin: 4, rangeMax: 9 };
    default: return { id, type: 'order-cards', instruction, sequence: [5, 3, 4], correctAnswers: [3, 4, 5],
      rangeMin: 3, rangeMax: 5 };
  }
}

const ALL_KINDS: Kind[] = ['count-from', 'before-after', 'fill-missing', 'decade-fill', 'spot-error', 'order-cards'];

async function mount(kind: Kind = 'count-from', band: 'K' | '1' = '1', planned = false) {
  // A fresh session: a per-mode loop must not let one mount's transcript reach the next runner.
  seam.conversation = []; seam.audio = false; seam.close = null;
  // The permissive policy every real caller uses. A detour is still never offered
  // here, because this family publishes no artifact — that is the adapter's choice,
  // not a policy accident.
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: NumberSequencerData = { instanceId: 'train', title: 'Number trains', gradeBand: band,
    showNumberLine: false, showDotArrays: false, challenges: [challengeFor(kind, 0)] };
  const workspace = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberSequencer data={data} autoStart runtimePlanItemId={planned ? 'plan-1' : undefined} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(workspace());
  const refresh = async () => { await act(async () => view.rerender(workspace())); };
  await act(async () => {});
  const end = async (audioPending = false) => {
    await act(async () => { transport.endTurn(audioPending); seam.audio = audioPending; view.rerender(workspace()); });
  };
  const speak = async (text: string) => {
    await act(async () => { transport.beginTurn(); seam.audio = true;
      seam.conversation = [...seam.conversation, { role: 'assistant', content: text, timestamp: performance.now() }]; view.rerender(workspace()); });
  };
  const answer = async (text: string) => {
    await act(async () => { seam.close?.({ kind: 'close', startedAt: performance.now() - 900, durationMs: 900, peak: .2, duringTutorAudio: false, belowMinVoice: false });
      seam.conversation = [...seam.conversation, { role: 'user', content: text, isAudio: true, timestamp: performance.now() }]; view.rerender(workspace()); });
  };
  /** Dispatch an ADVERTISED action through the wire and require a visible receipt. */
  const command = async (type: string) => {
    const state = runtime.getSnapshot(), offer = state.affordances.find(a => a.action.type === type)!;
    expect(offer, `missing ${type}`).toBeTruthy();
    let pending: Promise<void>;
    await act(async () => { pending = transport.command({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(), instanceId: state.instanceId!,
      itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await pending!;
    expect(sent.filter(m => m.type === 'runtime_result').at(-1)?.status).toBe('visible');
    return sent.filter(m => m.type === 'runtime_result').at(-1)!;
  };
  /** Raw dispatch: for the refusals, which never reach a visible receipt. */
  const dispatch = async (command: Record<string, unknown>) => {
    let receipt: any;
    await act(async () => { receipt = runtime.dispatch(command); });
    return receipt;
  };
  /** Advertised scaffold strategy ids, in offer order. */
  const strategies = () => runtime.getSnapshot().affordances
    .filter(a => a.action.type === 'scaffold' && (a.action as any).direction === 1)
    .map(a => (a.action as any).strategyId as string);
  /** Dispatch one NAMED scaffold rather than "whatever scaffold is first". */
  const strategy = async (strategyId: string, direction: 1 | -1 = 1) => {
    const state = runtime.getSnapshot();
    const offer = state.affordances.find(a => a.action.type === 'scaffold'
      && (a.action as any).strategyId === strategyId && (a.action as any).direction === direction)!;
    expect(offer, `missing scaffold ${strategyId} (${direction})`).toBeTruthy();
    let pending: Promise<void>;
    await act(async () => { pending = transport.command({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
      instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await pending!;
  };
  /** The unplaced number cards, as the child sees them. */
  const cards = () => Array.from(view.container.querySelectorAll('[data-pip-object^="card-"]')) as HTMLElement[];
  const placeCard = (value: number) => fireEvent.click(screen.getByLabelText(`Place ${value}`));
  await speak('Hi! Time for a number train. Your turn.'); await end();
  return { runtime, transport, view, refresh, speak, end, answer, command, dispatch, strategies, strategy, cards, placeCard, sent };
}

// ── The advertised capability set, mounted per mode rather than assumed ──

it.each(ALL_KINDS)('%s advertises replay and a text reminder, and never a tutor advance or a detour', async kind => {
  const h = await mount(kind);
  expect(h.runtime.getSnapshot().owner).toBe('runner');
  const types = h.runtime.getSnapshot().affordances.map(a => a.action.type);
  const offered = types.filter((t, i) => types.indexOf(t) === i).sort();
  // The runner owns progression and correction, so `advance` and `retry` are withheld
  // by construction. `point` is withheld because the tap IS the answer gesture.
  // `request_support` is absent because this family publishes no artifact at all.
  expect(offered).toEqual(['replay', 'scaffold']);
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('does not move a card, fill a space or reorder the train');
  expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
});

it('never offers a worked example, even under the permissive host policy', async () => {
  for (const kind of ALL_KINDS) {
    const h = await mount(kind);
    expect(h.runtime.getSnapshot().affordances.map(a => a.action.type), kind).not.toContain('request_support');
    expect(h.runtime.getSnapshot().supportArtifact, kind).toBeNull();
    cleanup();
  }
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount('fill-missing');
  await h.strategy('count-along-the-train');
  expect(screen.getByText(/Count along the train, car by car/)).toBeTruthy();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy('count-along-the-train', -1); // the same strategy, faded
  expect(screen.queryByText(/Count along the train, car by car/)).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

it('re-asks the same train on replay without clearing, reordering or filling it', async () => {
  const h = await mount('order-cards');
  h.placeCard(5);
  await h.refresh();
  const before = h.runtime.getSnapshot().task!;
  expect(before.demand.placedOrder).toBe('5');
  await h.command('replay');
  const after = h.runtime.getSnapshot().task!;
  expect(after.itemId).toBe(before.itemId);
  expect(after.demand.placedOrder).toBe('5');
  expect(screen.getByLabelText('Remove 5')).toBeTruthy();
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it.each(ALL_KINDS)('offers only %s’s method reminder before the child has done anything', async kind => {
  const h = await mount(kind);
  expect(h.strategies().length).toBe(1);
});

it('routes count-from between echoing the start and counting the other way', async () => {
  const h = await mount('count-from');                       // start 5, forward, answer 6
  await h.answer('five');                                     // said the number we started on
  expect(h.strategies()).toContain('not-the-number-we-started-on');
  expect(h.strategies()).not.toContain('we-are-counting-the-other-way');
  cleanup();
  const g = await mount('count-from');
  await g.answer('four');                                     // counted backwards
  expect(g.strategies()).toContain('we-are-counting-the-other-way');
  expect(g.strategies()).not.toContain('not-the-number-we-started-on');
});

it('routes before-after between echoing the printed number and going the wrong way', async () => {
  const h = await mount('before-after');                      // 7, then the gap; answer 8
  await h.answer('seven');
  expect(h.strategies()).toContain('that-one-is-already-printed');
  cleanup();
  const g = await mount('before-after');
  await g.answer('six');                                      // the neighbour on the other side
  expect(g.strategies()).toContain('the-space-is-on-the-other-side');
  expect(g.strategies()).not.toContain('that-one-is-already-printed');
});

it('routes fill-missing between naming a printed car and being one step out', async () => {
  const h = await mount('fill-missing');                      // _, 5, 6, 7; answer 4
  await h.answer('six');
  expect(h.strategies()).toContain('that-car-already-has-a-number');
  expect(h.strategies()).not.toContain('count-the-cars-again');
  cleanup();
  const g = await mount('fill-missing');
  await g.answer('three');                                    // off by one, and not printed
  expect(g.strategies()).toContain('count-the-cars-again');
  expect(g.strategies()).not.toContain('that-car-already-has-a-number');
});

it('routes decade-fill between slipping back and jumping a whole ten', async () => {
  const h = await mount('decade-fill');                       // 28, 29, _, _, 32; answer 30
  await h.answer('twenty');
  expect(h.strategies()).toContain('do-not-go-back-along-the-train');
  expect(h.strategies()).not.toContain('move-one-car-at-a-time');
  cleanup();
  const g = await mount('decade-fill');
  await g.answer('forty');
  expect(g.strategies()).toContain('move-one-car-at-a-time');
  expect(g.strategies()).not.toContain('do-not-go-back-along-the-train');
});

it('routes spot-error between naming a number that fits and one not on the train', async () => {
  const h = await mount('spot-error');                        // 4, 5, 9, 7, 8; the odd one is 9
  await h.answer('five');
  expect(h.strategies()).toContain('that-number-fits-the-count');
  expect(h.strategies()).not.toContain('name-one-you-can-see');
  cleanup();
  const g = await mount('spot-error');
  await g.answer('three');                                    // not printed anywhere
  expect(g.strategies()).toContain('name-one-you-can-see');
  expect(g.strategies()).not.toContain('that-number-fits-the-count');
});

it('routes order-cards from the arrangement itself, not from a transcript', async () => {
  const h = await mount('order-cards');                       // pool 5, 3, 4; smallest is 3
  h.placeCard(4); await h.refresh();
  expect(h.strategies()).toContain('find-the-very-smallest');
  expect(h.strategies()).not.toContain('start-small-then-grow');
  cleanup();
  const g = await mount('order-cards');
  g.placeCard(5); g.placeCard(4); await g.refresh();          // biggest first
  expect(g.strategies()).toContain('start-small-then-grow');
  expect(g.strategies()).toContain('every-card-gets-a-place');
});

// ── No aid may state the answer, on any mode, however the child was wrong ──

it('never states the answer in any aid it can offer', async () => {
  const wrongFor: Record<Kind, string> = { 'count-from': 'five', 'before-after': 'seven',
    'fill-missing': 'three', 'decade-fill': 'twenty', 'spot-error': 'five', 'order-cards': '' };
  for (const kind of ALL_KINDS) {
    const h = await mount(kind);
    if (kind === 'order-cards') { h.placeCard(5); h.placeCard(4); await h.refresh(); }
    else await h.answer(wrongFor[kind]);
    // Every answer this mounted challenge can demand, not only the current item's.
    const answers = kind === 'spot-error' ? [9] : challengeFor(kind, 0).correctAnswers;
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = offer.description.split('"')[1] ?? '';
      expect(spoken, `${kind} / ${(offer.action as any).strategyId}`).toBeTruthy();
      for (const answer of answers) {
        expect(statesNumber(spoken, answer), `${kind} / ${(offer.action as any).strategyId} states ${answer}`).toBe(false);
      }
    }
    cleanup();
  }
});

// ── Refusals: stale item, stale revision, duplicate, unsupported ──

it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
  const h = await mount('fill-missing');
  const state = h.runtime.getSnapshot();
  const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
  expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'b', itemId: state.task!.itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'c', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
  // An aid that exists for another mode is still unsupported on this one.
  expect((await h.dispatch({ ...base, commandId: 'd', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'smallest-goes-first', direction: 1 } })).status).toBe('unsupported');
  const replay = { ...base, commandId: 'same-id', itemId: state.task!.itemId, action: { type: 'replay' } as const };
  expect((await h.dispatch(replay)).status).toBe('committed');
  expect((await h.dispatch(replay)).status).toBe('duplicate');
});

it('refuses every action after the learner stops', async () => {
  const h = await mount('count-from');
  const state = h.runtime.getSnapshot();
  await act(async () => { h.runtime.stop(); });
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  expect((await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop', instanceId: state.instanceId!,
    itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'replay' } })).status).not.toBe('committed');
});

it('clears the painted reminder when the runner opens the next item', async () => {
  const h = await mount('decade-fill');                       // two blanks, so two items
  await h.strategy('keep-the-count-going');
  expect(screen.getByText(/Keep the count going along the train/)).toBeTruthy();
  await h.answer('thirty');
  await h.speak('Yes! Thirty. Your turn. What is next?'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(screen.queryByText(/Keep the count going along the train/)).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
});
