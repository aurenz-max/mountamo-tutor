// @vitest-environment jsdom
//
// Real SortingStation, real judged runner, real LiveLessonRuntime, real transport
// and rendering shell. Only microphone hardware, evaluation writes and sound are
// substituted. Every case is an action this adapter ADVERTISES, or a mode where it
// deliberately advertises nothing.
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../../hooks/voiceTurnMachine';

const seam = vi.hoisted(() => ({ conversation: [] as any[], audio: false, close: null as any,
  send: vi.fn(), submit: vi.fn(), held: 0 }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson', activePrimitiveId: 'station',
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
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => null }));
import SortingStation, { type SortingStationData } from './SortingStation';

type Kind = 'sort-by-one' | 'sort-by-attribute' | 'count-and-compare' | 'two-attributes' | 'odd-one-out' | 'sort-variety';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.audio = false; seam.close = null; seam.held = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const fruit = (id: string, label: string, color: string, size = 'Big') =>
  ({ id, label, emoji: '', attributes: { color, size } });
const FRUITS = [fruit('o1', 'apple', 'Red'), fruit('o2', 'banana', 'Yellow'), fruit('o3', 'cherry', 'Red'),
  fruit('o4', 'lemon', 'Yellow'), fruit('o5', 'strawberry', 'Red', 'Small')];
const CATEGORIES = [{ label: 'Red', rule: { color: 'Red' } }, { label: 'Yellow', rule: { color: 'Yellow' } }];

/** One challenge per mode, each satisfying the script's own build gates. */
function challengeFor(kind: Kind): Record<string, any> {
  const base = { id: 'c1', type: kind, instruction: 'Sort by color.', sortingAttribute: 'color',
    categories: CATEGORIES, objects: FRUITS };
  switch (kind) {
    case 'count-and-compare': return { ...base, comparisonQuestion: 'Which group has more?', correctComparison: 'more' };
    case 'odd-one-out': return { ...base, oddOneOut: 'o5', oddOneOutReason: 'It is the only small one.' };
    case 'two-attributes': return { ...base, targetCategory: 'Red', secondaryAttribute: 'size', secondaryValue: 'Big' };
    default: return base;
  }
}

const ALL_KINDS: Kind[] = ['sort-by-one', 'sort-by-attribute', 'sort-variety',
  'count-and-compare', 'odd-one-out', 'two-attributes'];

async function mount(kind: Kind = 'sort-by-one', band: 'K' | '1' = 'K') {
  seam.conversation = []; seam.audio = false; seam.close = null;
  // The permissive policy every real caller uses, so a withheld detour is the
  // adapter's own choice rather than a policy accident.
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'station', title: 'Colors', maxCategories: 2, showCounts: false,
    showTallyChart: false, gradeBand: band, supportTier: 'medium',
    challenges: [challengeFor(kind)] } as unknown as SortingStationData;
  const workspace = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SortingStation data={data} autoStart />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(workspace());
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
  const command = async (type: string) => {
    const state = runtime.getSnapshot(), offer = state.affordances.find(a => a.action.type === type)!;
    expect(offer, `missing ${type}`).toBeTruthy();
    let pending: Promise<void>;
    await act(async () => { pending = transport.command({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(), instanceId: state.instanceId!,
      itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await pending!;
    expect(sent.filter(m => m.type === 'runtime_result').at(-1)?.status).toBe('visible');
  };
  const dispatch = async (command: Record<string, unknown>) => {
    let receipt: any;
    await act(async () => { receipt = runtime.dispatch(command); });
    return receipt;
  };
  const strategies = () => runtime.getSnapshot().affordances
    .filter(a => a.action.type === 'scaffold' && (a.action as any).direction === 1)
    .map(a => (a.action as any).strategyId as string);
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
  await speak('Hi! Time to sort. Your turn.'); await end();
  return { runtime, transport, view, speak, end, answer, command, dispatch, strategies, strategy, sent };
}

// ── The advertised capability set, mounted per mode rather than assumed ──

it.each(ALL_KINDS)('%s advertises replay and a text reminder, and never a tutor advance or a detour', async kind => {
  const h = await mount(kind);
  expect(h.runtime.getSnapshot().owner).toBe('runner');
  const types = h.runtime.getSnapshot().affordances.map(a => a.action.type);
  // `advance` and `retry` are withheld by construction — the runner owns
  // progression and `correctionFor` owns the re-ask. `point` is withheld because
  // pointing at a tray or a card would BE the answer. `request_support` is absent
  // because identical counters have no attribute to sort by.
  expect(types).toContain('replay');
  expect(types).toContain('scaffold');
  for (const withheld of ['advance', 'retry', 'point', 'request_support']) {
    expect(types, `${kind} offered ${withheld}`).not.toContain(withheld);
  }
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('does not sort, move, count or reveal anything');
  expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount('sort-by-one');
  const [method] = h.strategies();
  await h.strategy(method);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy(method, -1);
  expect(screen.queryByRole('status')).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it.each(ALL_KINDS)('offers only %s’s method reminder before the child has said anything', async kind => {
  const h = await mount(kind);
  expect(h.strategies().length).toBe(1);
});

it('withholds every misstep aid while the last answer was right or unjudged', async () => {
  const h = await mount('sort-by-one');
  // A transcript alone cannot tell a wrong answer from a right one phrased
  // differently, so every aid here gates on a wrong verdict, not on the words.
  await h.answer('something else entirely');
  expect(h.runtime.getSnapshot().task?.evidence.correctness).not.toBe('incorrect');
  expect(h.strategies().length).toBe(1);
});

// ── No aid may state the answer, on any mode ──

it('never says a group label, an object name or a count in any aid it can offer', async () => {
  const forbidden = ['red', 'yellow', 'apple', 'banana', 'cherry', 'lemon', 'strawberry',
    'more', 'fewer', 'equal', 'big', 'small'];
  for (const kind of ALL_KINDS) {
    const h = await mount(kind);
    await h.answer('apple');
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = (offer.description.split('"')[1] ?? '').toLowerCase();
      expect(spoken, `${kind} / ${(offer.action as any).strategyId}`).toBeTruthy();
      for (const word of forbidden) {
        expect(new RegExp(`\\b${word}\\b`).test(spoken),
          `${kind} / ${(offer.action as any).strategyId} says "${word}"`).toBe(false);
      }
    }
    cleanup();
  }
});

// ── Refusals ──

it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
  const h = await mount('sort-by-one');
  const state = h.runtime.getSnapshot();
  const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
  expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'b', itemId: state.task!.itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'c', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
  // An aid that exists for another item kind is still unsupported on this one.
  expect((await h.dispatch({ ...base, commandId: 'd', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'count-that-group-only', direction: 1 } })).status).toBe('unsupported');
  const replay = { ...base, commandId: 'same-id', itemId: state.task!.itemId, action: { type: 'replay' } as const };
  expect((await h.dispatch(replay)).status).toBe('committed');
  expect((await h.dispatch(replay)).status).toBe('duplicate');
});

it('refuses every action after the learner stops', async () => {
  const h = await mount('sort-by-one');
  const state = h.runtime.getSnapshot();
  await act(async () => { h.runtime.stop(); });
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  expect((await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop', instanceId: state.instanceId!,
    itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'replay' } })).status).not.toBe('committed');
});

it('re-asks the same question on replay without sorting anything', async () => {
  const h = await mount('sort-by-one');
  const before = h.runtime.getSnapshot().task!;
  await h.command('replay');
  const after = h.runtime.getSnapshot().task!;
  expect(after.itemId).toBe(before.itemId);
  expect(after.demand).toEqual(before.demand);
  expect(after.task).toBe(before.task);
});
