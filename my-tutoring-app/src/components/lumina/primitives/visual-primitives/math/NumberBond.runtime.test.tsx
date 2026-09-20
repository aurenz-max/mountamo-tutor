// @vitest-environment jsdom
//
// Real NumberBond, real judged runner, real LiveLessonRuntime, real transport and
// rendering shell. Only microphone hardware, evaluation writes and sound are
// substituted. Every case is an action this adapter ADVERTISES, or a mode where it
// deliberately advertises nothing.
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
  isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson', activePrimitiveId: 'bond',
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
import NumberBond, { type NumberBondChallenge, type NumberBondData } from './NumberBond';

type Kind = NumberBondChallenge['type'];

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.audio = false; seam.close = null; seam.held = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** One challenge per mode, each satisfying `itemsFromChallenge`'s own gates. */
function challengeFor(kind: Kind): NumberBondChallenge {
  const base = { id: 'c0', type: kind, instruction: 'Work out the bond.' };
  if (kind === 'ten-and-ones') return { ...base, whole: 13 };
  if (kind === 'decompose') return { ...base, whole: 4 };
  return { ...base, whole: 5, part1: 2, part2: 3 };
}

const ALL_KINDS: Kind[] = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones', 'fact-family', 'build-equation'];
/** The modes whose relationship the counter surface CAN state truthfully. */
const WITH_EXAMPLE: Kind[] = ['decompose', 'missing-part', 'related-fact', 'ten-and-ones'];

async function mount(kind: Kind = 'missing-part', planned = false) {
  seam.conversation = []; seam.audio = false; seam.close = null;
  // The permissive policy every real caller uses, so a withheld detour is the
  // adapter's own choice rather than a policy accident.
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: NumberBondData = { instanceId: 'bond', title: 'Number bonds', gradeBand: '1', maxNumber: 10,
    showCounters: true, showEquation: true, challenges: [challengeFor(kind)] };
  const workspace = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberBond data={data} autoStart runtimePlanItemId={planned ? 'plan-1' : undefined} />
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
  /** Move one counter into a part, the way the child does it. */
  const moveCounter = (side: 'left' | 'right') =>
    fireEvent.click(screen.getAllByLabelText(`Move counter to ${side}`)[0]);
  await speak('Hi! Here is a number bond. Your turn.'); await end();
  return { runtime, transport, view, refresh, speak, end, answer, command, dispatch, strategies, strategy, moveCounter, sent };
}

// ── The advertised capability set, mounted per mode rather than assumed ──

it.each(ALL_KINDS)('%s advertises replay and a text reminder, and never a tutor advance', async kind => {
  const h = await mount(kind);
  expect(h.runtime.getSnapshot().owner).toBe('runner');
  const types = h.runtime.getSnapshot().affordances.map(a => a.action.type);
  // `advance` and `retry` are withheld by construction — the runner owns
  // progression and `correctionFor` owns the re-ask. `point` is withheld
  // because on every hand mode the tap IS the answer gesture.
  expect(types).toContain('replay');
  expect(types).toContain('scaffold');
  expect(types).not.toContain('advance');
  expect(types).not.toContain('retry');
  expect(types).not.toContain('point');
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('does not move a counter or a tile');
  expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
});

it('offers a worked example only where the counter surface can state the relationship', async () => {
  for (const kind of ALL_KINDS) {
    const h = await mount(kind);
    const offered = h.runtime.getSnapshot().affordances.map(a => a.action.type);
    expect(offered.includes('request_support'), `${kind} detour`).toBe(WITH_EXAMPLE.includes(kind));
    cleanup();
  }
});

it('draws a nearby bond, never this bond’s own numbers', async () => {
  const h = await mount('missing-part');                    // whole 5, part 2, answer 3
  await h.command('request_support');
  const example = screen.getByRole('complementary', { name: 'Worked example' });
  expect(example.textContent).toContain('6');               // a nearby whole, not five
  expect(example.textContent).not.toContain('= 5');
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount('missing-part');
  await h.strategy('count-up-from-the-part');
  expect(screen.getByText(/count up to the whole/)).toBeTruthy();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy('count-up-from-the-part', -1);
  expect(screen.queryByText(/count up to the whole/)).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it.each(ALL_KINDS)('offers only %s’s method reminder before the child has done anything', async kind => {
  const h = await mount(kind);
  expect(h.strategies().length).toBe(1);
});

it('routes missing-part by which of the three numbers the child said', async () => {
  const h = await mount('missing-part');                    // whole 5, part 2, answer 3
  await h.answer('five');                                    // the whole
  expect(h.strategies()).toContain('not-the-whole-number');
  expect(h.strategies()).not.toContain('not-the-part-you-can-see');
  cleanup();
  const g = await mount('missing-part');
  await g.answer('two');                                     // the part already shown
  expect(g.strategies()).toContain('not-the-part-you-can-see');
  expect(g.strategies()).not.toContain('not-the-whole-number');
  cleanup();
  const k = await mount('missing-part');
  await k.answer('four');                                    // counted the start as a step
  expect(k.strategies()).toContain('the-part-you-start-on-is-not-a-step');
});

it('withholds the hand aids while the child is still building', async () => {
  const h = await mount('decompose');                        // whole 4, nothing judged yet
  h.moveCounter('left'); await h.refresh();
  // A part that does not yet make the whole is what BUILDING looks like. The aid
  // gates on a wrong verdict, so only the method reminder is offered here.
  expect(h.strategies()).toEqual(['both-parts-make-the-whole']);
  expect(h.runtime.getSnapshot().task?.demand.leftPart).toBe(1);
});

// ── No aid may state the answer, on any mode ──

it('never states the answer in any aid it can offer', async () => {
  for (const kind of ALL_KINDS) {
    const h = await mount(kind);
    await h.answer('five');
    const item = h.runtime.getSnapshot().task!;
    // Both the number the child must produce and the numbers of the bond itself.
    const guarded = [challengeFor(kind).whole, 3, 2];
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = offer.description.split('"')[1] ?? '';
      expect(spoken, `${kind} / ${(offer.action as any).strategyId}`).toBeTruthy();
      for (const n of guarded) {
        expect(statesNumber(spoken, n), `${kind} / ${(offer.action as any).strategyId} states ${n}`).toBe(false);
      }
    }
    expect(item).toBeTruthy();
    cleanup();
  }
});

// ── Refusals ──

it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
  const h = await mount('missing-part');
  const state = h.runtime.getSnapshot();
  const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
  expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'b', itemId: state.task!.itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'c', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
  // An aid that exists for another mode is still unsupported on this one.
  expect((await h.dispatch({ ...base, commandId: 'd', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'make-a-full-ten-first', direction: 1 } })).status).toBe('unsupported');
  const replay = { ...base, commandId: 'same-id', itemId: state.task!.itemId, action: { type: 'replay' } as const };
  expect((await h.dispatch(replay)).status).toBe('committed');
  expect((await h.dispatch(replay)).status).toBe('duplicate');
});

it('refuses every action after the learner stops', async () => {
  const h = await mount('missing-part');
  const state = h.runtime.getSnapshot();
  await act(async () => { h.runtime.stop(); });
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  expect((await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop', instanceId: state.instanceId!,
    itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'replay' } })).status).not.toBe('committed');
});

// ── The detour, and the work it has to give back ──

it('keeps the same bond and the child’s counters through an example and return', async () => {
  const h = await mount('decompose');
  // The work is done BEFORE the detour and AFTER any correction, so the saved
  // state compared on return is genuinely non-empty.
  h.moveCounter('left'); h.moveCounter('right'); await h.refresh();
  const draft = h.runtime.getSnapshot().task!.demand;
  expect(draft.leftPart as number + (draft.rightPart as number)).toBeGreaterThan(0);
  const item = h.runtime.getSnapshot().task!.itemId;
  await h.command('request_support');
  expect(screen.getByRole('complementary', { name: 'Worked example' })).toBeTruthy();
  await h.command('return');
  await h.speak('Your bond is back. Your turn.'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(h.runtime.getSnapshot().task?.itemId).toBe(item);
  expect(h.runtime.getSnapshot().task?.demand).toEqual(draft);
});

it('allows only one detour per item', async () => {
  const h = await mount('missing-part');
  await h.command('request_support');
  await h.command('return');
  await h.speak('Back to your bond. Your turn.'); await h.end();
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(h.runtime.getSnapshot().affordances.map(a => a.action.type)).not.toContain('request_support');
});
