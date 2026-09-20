// @vitest-environment jsdom
//
// Real ShapeSorter, real judged runner, real LiveLessonRuntime, real transport and
// rendering shell. Only microphone hardware, evaluation writes and sound are
// substituted. Every case is an action this adapter ADVERTISES, or a mode where it
// deliberately advertises nothing.
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../../hooks/voiceTurnMachine';

const seam = vi.hoisted(() => ({ conversation: [] as any[], audio: false, close: null as any,
  send: vi.fn(), submit: vi.fn(), held: 0 }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson', activePrimitiveId: 'shapes',
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
import ShapeSorter, { type ShapeSorterData } from './ShapeSorter';

type Mode = 'identify' | 'count' | 'sort';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.audio = false; seam.close = null; seam.held = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const shape = (name: string, color: string) => ({ shape: name, color, size: 'medium' as const, rotation: 0 });
const POOL = [shape('triangle', 'red'), shape('square', 'blue'), shape('circle', 'green')];

/** One challenge per mode, each satisfying the script's own build gates. */
function challengeFor(mode: Mode): Record<string, any> {
  const base = { id: 'c1', type: mode, instruction: 'Look at the shape.', shapes: POOL };
  if (mode === 'count') return { ...base, ruleAttribute: 'sides', targetValue: 'triangle' };
  if (mode === 'sort') return { ...base, ruleAttribute: 'color' };
  return { ...base, ruleAttribute: 'shape' };
}

const ALL_MODES: Mode[] = ['identify', 'count', 'sort'];

async function mount(mode: Mode = 'identify', band: 'K' | '1' = 'K') {
  seam.conversation = []; seam.audio = false; seam.close = null;
  // The permissive policy every real caller uses, so a withheld detour is the
  // adapter's own choice rather than a policy accident.
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'shapes', title: 'Shapes', gradeBand: band,
    challenges: [challengeFor(mode)] } as unknown as ShapeSorterData;
  const workspace = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ShapeSorter data={data} autoStart />
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
  const dispatch = async (c: Record<string, unknown>) => {
    let receipt: any;
    await act(async () => { receipt = runtime.dispatch(c); });
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
  const types = () => runtime.getSnapshot().affordances.map(a => a.action.type);
  await speak('Hi! Look at this shape. Your turn.'); await end();
  return { runtime, transport, view, speak, end, answer, command, dispatch, strategies, strategy, types, sent };
}

// ── The advertised capability set, mounted per mode rather than assumed ──

it.each(ALL_MODES)('%s advertises replay and a text reminder, and never a tutor advance or a detour', async mode => {
  const h = await mount(mode);
  expect(h.runtime.getSnapshot().owner).toBe('runner');
  expect(h.types()).toContain('replay');
  expect(h.types()).toContain('scaffold');
  for (const withheld of ['advance', 'retry', 'point', 'request_support']) {
    expect(h.types(), `${mode} offered ${withheld}`).not.toContain(withheld);
  }
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('does not sort, move, ring or count anything');
  expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
});

it.each(ALL_MODES)('offers only %s’s method reminder before the child has said anything', async mode => {
  const h = await mount(mode);
  expect(h.strategies().length).toBe(1);
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it('offers the name-not-a-number aid when a shape question is answered with a count', async () => {
  const h = await mount('identify');
  await h.answer('three');
  expect(h.strategies()).toContain('i-asked-for-a-name-not-a-number');
});

it('offers the go-round-once aid on a count only when the child is a single unit out', async () => {
  // The first count ask of a session is always SIDES (`countAsks % 2`), and the
  // pool's target is a triangle, so the answer is three: two is the near miss.
  const h = await mount('count');
  await h.answer('two');
  expect(h.strategies()).toContain('go-round-once-only');
  cleanup();
  const g = await mount('count');
  await g.answer('twelve');                      // not a near miss; the correction owns it
  expect(g.strategies()).not.toContain('go-round-once-only');
});

// ── No aid may state the answer, on any mode ──

it('never says a shape name, a count or a group label in any aid it can offer', async () => {
  const forbidden = ['triangle', 'square', 'circle', 'rectangle', 'red', 'blue', 'green',
    'three', 'four', 'zero', 'side', 'corner'];
  for (const mode of ALL_MODES) {
    const h = await mount(mode);
    await h.answer('triangle');
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = (offer.description.split('"')[1] ?? '').toLowerCase();
      expect(spoken, `${mode} / ${(offer.action as any).strategyId}`).toBeTruthy();
      for (const word of forbidden) {
        // "sides" and "corners" name WHAT to count, never HOW MANY, so the
        // singular forms above are the guarded ones.
        expect(new RegExp(`\\b${word}\\b`).test(spoken),
          `${mode} / ${(offer.action as any).strategyId} says "${word}"`).toBe(false);
      }
      expect(/\d/.test(spoken), `${mode} / ${(offer.action as any).strategyId} states a numeral`).toBe(false);
    }
    cleanup();
  }
});

// ── Refusals ──

it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
  const h = await mount('identify');
  const state = h.runtime.getSnapshot();
  const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
  expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'b', itemId: state.task!.itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'c', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
  // An aid that exists for another mode is still unsupported on this one.
  expect((await h.dispatch({ ...base, commandId: 'd', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'what-do-the-mats-ask-for', direction: 1 } })).status).toBe('unsupported');
  const replay = { ...base, commandId: 'same-id', itemId: state.task!.itemId, action: { type: 'replay' } as const };
  expect((await h.dispatch(replay)).status).toBe('committed');
  expect((await h.dispatch(replay)).status).toBe('duplicate');
});

it('refuses every action after the learner stops', async () => {
  const h = await mount('identify');
  const state = h.runtime.getSnapshot();
  await act(async () => { h.runtime.stop(); });
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  expect((await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop', instanceId: state.instanceId!,
    itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'replay' } })).status).not.toBe('committed');
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount('identify');
  await h.strategy('look-at-its-sides-and-corners');
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy('look-at-its-sides-and-corners', -1);
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

it('re-asks the same shape on replay without ringing a new one', async () => {
  const h = await mount('identify');
  const before = h.runtime.getSnapshot().task!;
  await h.command('replay');
  const after = h.runtime.getSnapshot().task!;
  expect(after.itemId).toBe(before.itemId);
  expect(after.task).toBe(before.task);
  expect(after.demand).toEqual(before.demand);
});
