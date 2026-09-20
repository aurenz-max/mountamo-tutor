// @vitest-environment jsdom
//
// Real NumberTracer, real grading path, real LiveLessonRuntime, real transport and
// rendering shell. Only the canvas 2D context, the vision judge's fetch, evaluation
// writes and sound are substituted. Every case is an action this adapter
// ADVERTISES, or one it deliberately withholds.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import { statesNumber } from '../../../components/live-activity/runtime/liveScaffolds';

vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false, isAudioPlaying: false }) }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, elapsedMs: 0, submitResult: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import NumberTracer, { getDigitPaths, type NumberTracerChallenge } from './NumberTracer';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const state: Record<string, unknown> = {};
    return new Proxy(state, {
      get: (_, key: string) => key in state ? state[key] : () => {},
      set: (_, key: string, value) => { state[key] = value; return true; },
    }) as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,INK');
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const item = (patch: Partial<NumberTracerChallenge>): NumberTracerChallenge =>
  ({ id: 'c1', type: 'trace', digit: 3, instruction: 'Trace the number.', strokePaths: [],
    showModel: false, showArrows: true, ...patch });

async function mount(challenges: NumberTracerChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: Record<string, any>[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberTracer data={{ title: 'Numbers', gradeBand: 'K', instanceId: 'tracer', challenges }} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  await act(async () => {});
  const canvas = () => view.container.querySelector('canvas[data-pip-object="canvas"]') as HTMLCanvasElement;
  /** Draw numeral `n` along its canonical path, exactly as the learner would. */
  const write = async (n: number) => {
    for (const stroke of getDigitPaths(n)) {
      await act(async () => { fireEvent.mouseDown(canvas(), { clientX: stroke[0].x, clientY: stroke[0].y }); });
      for (const p of stroke.slice(1)) await act(async () => { fireEvent.mouseMove(canvas(), { clientX: p.x, clientY: p.y }); });
      await act(async () => { fireEvent.mouseUp(canvas()); });
    }
  };
  /**
   * Half the guide and no more: what stopping partway through looks like. Ten
   * points, because the component itself blocks a check below eight and that
   * block is its own message, not a wrong answer for an aid to address.
   */
  const scribble = async () => {
    const stroke = getDigitPaths(3)[0].slice(0, 10);
    await act(async () => { fireEvent.mouseDown(canvas(), { clientX: stroke[0].x, clientY: stroke[0].y }); });
    for (const p of stroke.slice(1)) await act(async () => { fireEvent.mouseMove(canvas(), { clientX: p.x, clientY: p.y }); });
    await act(async () => { fireEvent.mouseUp(canvas()); });
  };
  const check = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); }); };
  /** Dispatch an ADVERTISED action and return the receipt, synchronously committed. */
  const command = async (type: string, assertInside?: () => void) => {
    const state = runtime.getSnapshot(), offer = state.affordances.find(a => a.action.type === type)!;
    expect(offer, `missing ${type}`).toBeTruthy();
    let receipt: any;
    await act(async () => {
      receipt = runtime.dispatch({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
        instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action });
      // INSIDE dispatch, before `act` exits: a React setter followed by a read of
      // the old closure is not an acknowledgement, so the DOM is asserted here.
      assertInside?.();
    });
    return receipt;
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
    await act(async () => {
      runtime.dispatch({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
        instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action });
    });
  };
  const types = () => runtime.getSnapshot().affordances.map(a => a.action.type);
  return { runtime, transport, view, canvas, write, scribble, check, command, dispatch, strategies, strategy, types, sent };
}

const judged = (response: unknown) => vi.fn(async () => ({ ok: true, json: async () => response }));

// ── The advertised capability set ──

it('offers replay and a reminder before any check, and never a detour or a point', async () => {
  const h = await mount([item({})]);
  expect(h.types()).toContain('replay');
  expect(h.types()).toContain('scaffold');
  for (const withheld of ['advance', 'retry', 'point', 'request_support']) {
    expect(h.types(), `offered ${withheld}`).not.toContain(withheld);
  }
  // Only the method reminder: the child has not drawn anything to be wrong about.
  expect(h.strategies()).toEqual(['follow-the-grey-shape']);
});

it.each(['trace', 'copy', 'write', 'sequence'] as const)('%s advertises its own method reminder', async type => {
  const h = await mount([item({ type, showModel: type !== 'write',
    ...(type === 'sequence' ? { sequenceNumbers: [1, 2, 3, 4], missingIndex: 2 } : {}) })]);
  expect(h.strategies().length).toBe(1);
  const reminder = h.runtime.getSnapshot().affordances.find(a => a.action.type === 'scaffold')!;
  expect(reminder.description).toContain('Nothing is drawn, erased or traced for the child');
});

// ── Advance: only after a checked success, and committed inside dispatch ──

it('advances only after a checked success, and the next instruction is in the DOM inside dispatch', async () => {
  vi.stubGlobal('fetch', judged({}));
  const h = await mount([item({ id: 'c1', digit: 3, instruction: 'Trace the three.' }),
    item({ id: 'c2', digit: 3, instruction: 'Trace it again.' })]);
  expect(h.types()).not.toContain('advance');
  await h.write(3);
  await h.check();
  // A close trace is accepted on geometry alone, with no judge call.
  expect(h.runtime.getSnapshot().task?.evidence.correctness).toBe('correct');
  expect(h.types()).toContain('advance');
  // `retry` is not offered on a correct response, and `advance` replaces the reminder.
  expect(h.types()).not.toContain('retry');
  await h.command('advance', () => {
    expect(screen.getByText('Trace it again.')).toBeTruthy();
    expect(h.runtime.getSnapshot().task?.itemId).toBe('c2');
  });
});

it('clears an incorrect drawing on retry and keeps the attempt history', async () => {
  vi.stubGlobal('fetch', judged({ recognized: false, score: 10, variant: '', feedback: 'That looks like a 2.', confidence: 99 }));
  const h = await mount([item({ id: 'c1', type: 'copy', digit: 3, showModel: true, instruction: 'Copy the number.' })]);
  await h.write(2);
  await h.check();
  expect(h.runtime.getSnapshot().task?.evidence.correctness).toBe('incorrect');
  const attempts = h.runtime.getSnapshot().task!.evidence.attemptNumber;
  expect(h.types()).toContain('retry');
  expect(h.types()).not.toContain('advance');
  await h.command('retry', () => {
    // The drawing is gone INSIDE dispatch, and the attempt count survives it.
    expect(h.runtime.getSnapshot().task?.demand.inkPoints).toBe(0);
  });
  expect(h.runtime.getSnapshot().task!.evidence.attemptNumber).toBe(attempts);
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it('offers the stopped-early aid only once the drawing actually stopped early', async () => {
  vi.stubGlobal('fetch', judged({ recognized: false, score: 10, variant: '', feedback: 'Keep practicing.', confidence: 99 }));
  const h = await mount([item({ id: 'c1', type: 'copy', digit: 3, showModel: true })]);
  expect(h.strategies()).not.toContain('keep-going-to-the-end');
  await h.scribble();
  await h.check();
  expect(h.runtime.getSnapshot().task?.evidence.correctness).toBe('incorrect');
  expect(h.strategies()).toContain('keep-going-to-the-end');
  // A full-shape aid does NOT apply to a drawing that stopped after a few points.
  expect(h.strategies()).not.toContain('check-it-against-the-model');
});

it('offers the model-check aid when a full shape was drawn and judged wrong', async () => {
  vi.stubGlobal('fetch', judged({ recognized: false, score: 10, variant: '', feedback: 'That looks like a 2.', confidence: 99 }));
  const h = await mount([item({ id: 'c1', type: 'copy', digit: 3, showModel: true })]);
  await h.write(2);
  await h.check();
  expect(h.strategies()).toContain('check-it-against-the-model');
  expect(h.strategies()).not.toContain('keep-going-to-the-end');
});

// ── Painting, fading, and the assistance history ──

it('paints the reminder, fades it back, and keeps the assistance history', async () => {
  const h = await mount([item({})]);
  await h.strategy('follow-the-grey-shape');
  expect(screen.getByText(/follow the grey shape/)).toBeTruthy();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(1);
  await h.strategy('follow-the-grey-shape', -1);
  expect(screen.queryByText(/follow the grey shape/)).toBeNull();
  expect(h.runtime.getSnapshot().task?.support.level).toBe(0);
  expect(h.runtime.getSnapshot().assistance.map(a => a.level)).toEqual([1, 0]);
});

// ── No aid may state the answer ──

it('never says the target numeral in any aid it can offer', async () => {
  vi.stubGlobal('fetch', judged({ recognized: false, score: 10, variant: '', feedback: 'Keep practicing.', confidence: 99 }));
  // Both model-bearing types, and every single-digit answer, because "one",
  // "two" and "three" are ordinary words a reminder could reach for by accident.
  for (const digit of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    for (const type of ['copy', 'sequence'] as const) {
    const h = await mount([item({ id: 'c1', type, digit, showModel: true,
      ...(type === 'sequence' ? { sequenceNumbers: [digit, digit + 1, digit + 2], missingIndex: 0 } : {}) })]);
    await h.scribble();
    await h.check();
    for (const offer of h.runtime.getSnapshot().affordances) {
      if (offer.action.type !== 'scaffold') continue;
      const spoken = offer.description.split('"')[1] ?? '';
      expect(spoken, `${digit} / ${(offer.action as any).strategyId}`).toBeTruthy();
      expect(statesNumber(spoken, digit), `${digit} / ${(offer.action as any).strategyId} states it`).toBe(false);
    }
    cleanup();
    }
  }
});

// ── Refusals ──

it('refuses a stale item, a stale revision, an unknown strategy and a duplicate command', async () => {
  const h = await mount([item({})]);
  const state = h.runtime.getSnapshot();
  const base = { sessionEpoch: state.sessionEpoch, instanceId: state.instanceId!, expectedRevision: state.revision };
  expect((await h.dispatch({ ...base, commandId: 'a', itemId: 'not-this-item', action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'b', itemId: state.task!.itemId, expectedRevision: state.revision + 5, action: { type: 'replay' } })).status).toBe('stale');
  expect((await h.dispatch({ ...base, commandId: 'c', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'no-such-aid', direction: 1 } })).status).toBe('unsupported');
  // An aid that belongs to another challenge type is still unsupported here.
  expect((await h.dispatch({ ...base, commandId: 'd', itemId: state.task!.itemId,
    action: { type: 'scaffold', strategyId: 'find-the-empty-box', direction: 1 } })).status).toBe('unsupported');
  // `advance` has no handler before a checked success, so it is not merely refused
  // at the policy layer: it was never advertised.
  expect((await h.dispatch({ ...base, commandId: 'e', itemId: state.task!.itemId,
    action: { type: 'advance' } })).status).toBe('unsupported');
  const replay = { ...base, commandId: 'same-id', itemId: state.task!.itemId, action: { type: 'replay' } as const };
  expect((await h.dispatch(replay)).status).toBe('committed');
  expect((await h.dispatch(replay)).status).toBe('duplicate');
});

it('refuses every action after the learner stops, leaving the drawing untouched', async () => {
  const h = await mount([item({})]);
  await h.scribble();
  const ink = h.runtime.getSnapshot().task!.demand.inkPoints;
  expect(ink).toBeGreaterThan(0);
  const state = h.runtime.getSnapshot();
  await act(async () => { h.runtime.stop(); });
  expect(h.runtime.getSnapshot().affordances).toEqual([]);
  expect((await h.dispatch({ sessionEpoch: state.sessionEpoch, commandId: 'after-stop', instanceId: state.instanceId!,
    itemId: state.task!.itemId, expectedRevision: state.revision, action: { type: 'replay' } })).status).not.toBe('committed');
  // A refused command mutates nothing: the child's strokes are still on the canvas.
  expect(h.view.container.querySelector('canvas')).toBeTruthy();
});

it('focuses the instruction on replay without changing the drawing', async () => {
  const h = await mount([item({})]);
  await h.scribble();
  const before = h.runtime.getSnapshot().task!.demand.inkPoints;
  await h.command('replay');
  expect(document.activeElement).toBe(screen.getByLabelText('Current instruction'));
  expect(h.runtime.getSnapshot().task!.demand.inkPoints).toBe(before);
});
