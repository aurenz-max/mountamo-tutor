// @vitest-environment jsdom
//
// Real OrdinalLine, real judged runner, real LiveLessonRuntime, real transport and
// rendering shell. Only microphone hardware, evaluation writes and sound are
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
import { ordinalWordFor } from './ordinalLineScript';

const seam = vi.hoisted(() => ({ conversation: [] as any[], audio: false, close: null as any,
  send: vi.fn(), submit: vi.fn(), held: 0 }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: seam.audio, sessionMode: 'lesson', activePrimitiveId: 'line-up',
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
import OrdinalLine, { type OrdinalLineData } from './OrdinalLine';

type Kind = 'identify' | 'match' | 'relative-position' | 'sequence-story' | 'build-sequence';

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.audio = false; seam.close = null; seam.held = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const LINE = [{ name: 'Fox' }, { name: 'Bear' }, { name: 'Duck' }];
/**
 * A FOUR-long line for `identify`, so "counted from the other end" and "one place
 * out" land on different characters. On a three-long line with the middle asked
 * for, the two conditions collide and either aid would look correct.
 */
const LONG_LINE = [...LINE, { name: 'Mole' }];
const NAMES = ['Fox', 'Bear', 'Duck', 'Mole'];
const CLUES = [{ character: 'Fox', position: 1 }, { character: 'Bear', position: 2 }, { character: 'Duck', position: 3 }];

/** One challenge per mode, each satisfying `itemsFromChallenge`'s own gates. */
function challengeFor(kind: Kind): Record<string, any> {
  const base = { id: 'c0', type: kind, characters: LINE };
  switch (kind) {
    case 'identify': return { ...base, characters: LONG_LINE, targetPosition: 1, correctAnswer: '1' };
    case 'relative-position': return { ...base, targetPosition: 2, relativeQuery: 'after', correctAnswer: 'Duck' };
    case 'match': return { ...base, matchPairs: [{ symbol: '2nd', word: 'second' }] };
    case 'sequence-story': return { ...base, clues: CLUES,
      storyText: 'The Fox got to the front. The Bear came along next. The Duck came along at the end.' };
    default: return { ...base, clues: CLUES };
  }
}

const ALL_KINDS: Kind[] = ['identify', 'match', 'relative-position', 'sequence-story', 'build-sequence'];

async function mount(kind: Kind = 'identify', band: 'K' | '1' = '1') {
  seam.conversation = []; seam.audio = false; seam.close = null;
  // The permissive policy every real caller uses, so a withheld detour is the
  // adapter's own choice rather than a policy accident.
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { instanceId: 'line-up', title: 'The line up', gradeBand: band, maxPosition: 4, context: 'race',
    showOrdinalLabels: true, labelFormat: 'symbol', challenges: [challengeFor(kind)] } as unknown as OrdinalLineData;
  const workspace = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <OrdinalLine data={data} autoStart />
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
  await speak('Hi! Here is the line. Your turn.'); await end();
  return { runtime, transport, view, refresh, speak, end, answer, command, dispatch, strategies, strategy, sent };
}

// ── The advertised capability set, mounted per mode rather than assumed ──

it.each(ALL_KINDS)('%s advertises replay and a text reminder, and never a tutor advance or a detour', async kind => {
  const h = await mount(kind);
  expect(h.runtime.getSnapshot().owner).toBe('runner');
  const types = h.runtime.getSnapshot().affordances.map(a => a.action.type);
  // `advance` and `retry` are withheld by construction — the runner owns
  // progression and `correctionFor` owns the re-ask. `point` is withheld because
  // pointing at a place in the line IS the answer on three of these modes.
  // `request_support` is absent because a counter row states HOW MANY and every
  // mode here teaches WHICH PLACE.
  expect(types).toContain('replay');
  expect(types).toContain('scaffold');
  for (const withheld of ['advance', 'retry', 'point', 'request_support']) {
    expect(types, `${kind} offered ${withheld}`).not.toContain(withheld);
  }
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('does not move, place or highlight anybody');
  expect(reminder.assistance).toEqual({ level: 1, answerExposure: 'none' });
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount('identify');
  await h.strategy('count-along-from-the-front');
  expect(screen.getByText(/count along the places/)).toBeTruthy();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy('count-along-from-the-front', -1);
  expect(screen.queryByText(/count along the places/)).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it.each(ALL_KINDS)('offers only %s’s method reminder before the child has said anything', async kind => {
  const h = await mount(kind);
  expect(h.strategies().length).toBe(1);
});

it('routes identify between counting from the wrong end and being one place out', async () => {
  const h = await mount('identify');          // Fox, Bear, Duck, Mole; the ask is about place 1
  await h.answer('Mole');                      // the far end: counted from the back
  expect(h.strategies()).toContain('the-other-end-is-the-back');
  expect(h.strategies()).not.toContain('the-front-one-already-counts');
  cleanup();
  const g = await mount('identify');
  await g.answer('Bear');                      // the neighbour: one place out
  expect(g.strategies()).toContain('the-front-one-already-counts');
  expect(g.strategies()).not.toContain('the-other-end-is-the-back');
});

it('routes relative-position between naming the anchor and looking the wrong way', async () => {
  const h = await mount('relative-position');  // anchor is place 2 (Bear), asked for AFTER, so Duck
  await h.answer('Bear');                       // named the one the question named
  expect(h.strategies()).toContain('not-the-one-i-named');
  expect(h.strategies()).not.toContain('check-which-side-i-asked-for');
  cleanup();
  const g = await mount('relative-position');
  await g.answer('Fox');                        // the one BEFORE the anchor
  expect(g.strategies()).toContain('check-which-side-i-asked-for');
  expect(g.strategies()).not.toContain('not-the-one-i-named');
});

it('gives match its method reminder and no misstep aid', async () => {
  const h = await mount('match');
  await h.answer('third');
  // Reading the card is the task, and a text reminder cannot help a child read
  // the very card the question is about, so that misstep stays with the correction.
  expect(h.strategies()).toEqual(['read-what-the-card-says']);
});

// ── No aid may state the answer, on any mode ──

it('never says a character name or an ordinal word in any aid it can offer', async () => {
  for (const kind of ALL_KINDS) {
    const h = await mount(kind);
    await h.answer('Bear');
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = offer.description.split('"')[1] ?? '';
      expect(spoken, `${kind} / ${(offer.action as any).strategyId}`).toBeTruthy();
      // Both kinds of answer this primitive has: a character name and an ordinal.
      for (const name of NAMES) {
        expect(spoken.toLowerCase(), `${kind} names ${name}`).not.toContain(name.toLowerCase());
      }
      for (let position = 1; position <= 4; position++) {
        expect(new RegExp(`\\b${ordinalWordFor(position)}\\b`, 'i').test(spoken),
          `${kind} / ${(offer.action as any).strategyId} says ${ordinalWordFor(position)}`).toBe(false);
      }
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
    action: { type: 'scaffold', strategyId: 'one-clue-at-a-time', direction: 1 } })).status).toBe('unsupported');
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

it('re-asks the same line on replay without moving anybody', async () => {
  const h = await mount('identify');
  const before = h.runtime.getSnapshot().task!;
  await h.command('replay');
  const after = h.runtime.getSnapshot().task!;
  expect(after.itemId).toBe(before.itemId);
  expect(after.demand).toEqual(before.demand);
});
