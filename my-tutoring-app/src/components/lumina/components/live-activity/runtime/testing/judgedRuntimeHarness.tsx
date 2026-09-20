/**
 * The mount harness every judged-runner runtime test shares.
 *
 * Nine of the twelve adopted families are `di-runner`, and each of their test files
 * had hand-written the same eight helpers — `speak`, `end`, `answer`, `command`,
 * `dispatch`, `strategies`, `strategy`, `types`. They were BYTE-IDENTICAL across six
 * files and differed in two characters in the other two, which is the signal that
 * they are infrastructure rather than anything a primitive teaches.
 *
 * What stays with the primitive is what the primitive means: the data it mounts, the
 * wording the tutor uses, which misstep each aid answers, and how the child's answer
 * routes between them. This file owns none of that.
 *
 * Everything below drives the REAL runtime, transport and rendering shell. A paint
 * opportunity here is machine evidence that the shell acknowledged a revision. It is
 * never evidence that a person saw anything.
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { LiveLessonRuntime } from '../LiveLessonRuntime';
import { LiveRuntimeContext } from '../LiveRuntimeContext';
import { LiveRuntimeSurface } from '../LiveRuntimeSurface';
import { RuntimeTransport } from '../runtimeTransport';
import type { TransitionReceipt } from '../contract';
import { seam } from './liveRuntimeSeams';

/**
 * The permissive policy EVERY real caller passes (`LiveActivitySandbox`,
 * `primitive-runtime-driver.mjs`). A runtime built without it is never offered
 * `request_support`, and the absence reads as an adapter fault rather than a test
 * fault — so the harness applies it by default and a test opts out explicitly.
 */
export const REAL_CALLER_POLICY = {
  maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true,
} as const;

export interface JudgedHarness {
  runtime: LiveLessonRuntime;
  transport: RuntimeTransport;
  view: ReturnType<typeof render>;
  /** Wire messages the transport has emitted, in order. */
  sent: Array<Record<string, any>>;
  /** The tutor speaks; audio begins and the transcript grows. */
  speak: (text: string) => Promise<void>;
  /** The tutor's turn ends. Pass true to leave audio pending. */
  end: (audioPending?: boolean) => Promise<void>;
  /** The child answers aloud: a closed voice turn plus the recognized text. */
  answer: (text: string) => Promise<void>;
  /** Dispatch the first advertised action of this type and assert it painted. */
  command: (type: string) => Promise<Record<string, any> | undefined>;
  /** Dispatch a raw wire command and return its receipt, asserting nothing. */
  dispatch: (command: Record<string, unknown>) => Promise<TransitionReceipt>;
  /** The strategyIds currently offered in the forward direction. */
  strategies: () => string[];
  /** Dispatch one scaffold BY ID, never "whichever is first". */
  strategy: (strategyId: string, direction?: 1 | -1) => Promise<void>;
  /** The action types currently advertised. */
  types: () => string[];
  /** Advance timers inside `act`, for a cue or a queued re-ask. */
  tick: (ms: number) => Promise<void>;
}

export interface JudgedMountOptions {
  /**
   * The mounted data's `instanceId`. REQUIRED, because the failure mode when it is
   * wrong is silent: the judged runner does not recognise itself as the session's
   * active primitive, never starts, and the snapshot simply reports owner `tutor`
   * with nothing advertised.
   */
  activePrimitiveId: string;
  /**
   * The primitive element. Build its `data` ONCE outside this closure — the harness
   * rerenders on every tutor turn, and a fresh `data` identity each time remounts
   * the runner and loses the session.
   */
  children: () => React.ReactElement;
  /**
   * The opening the runner waits on before anything is advertised. Defaults to a
   * neutral line; pass the family's own wording where the runner keys on it.
   */
  opening?: string;
  policy?: { maxSupportLevel: number; allowAnswerExposure: boolean; allowSupportArtifacts: boolean };
  sessionEpoch?: string;
}

export async function mountJudged(options: JudgedMountOptions): Promise<JudgedHarness> {
  seam.conversation = []; seam.audio = false; seam.close = null;
  seam.activePrimitiveId = options.activePrimitiveId;
  const runtime = new LiveLessonRuntime(options.sessionEpoch ?? 'test', { ...(options.policy ?? REAL_CALLER_POLICY) });
  const sent: Array<Record<string, any>> = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));

  const workspace = () => (
    <LiveRuntimeContext.Provider value={runtime}>
      <LiveRuntimeSurface runtime={runtime}>{options.children()}</LiveRuntimeSurface>
    </LiveRuntimeContext.Provider>
  );
  const view = render(workspace());
  await act(async () => {});

  const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  const end = async (audioPending = false) => {
    await act(async () => { transport.endTurn(audioPending); seam.audio = audioPending; view.rerender(workspace()); });
  };
  const speak = async (text: string) => {
    await act(async () => {
      transport.beginTurn(); seam.audio = true;
      seam.conversation = [...seam.conversation, { role: 'assistant', content: text, timestamp: performance.now() }];
      view.rerender(workspace());
    });
  };
  const answer = async (text: string) => {
    await act(async () => {
      seam.close?.({ kind: 'close', startedAt: performance.now() - 900, durationMs: 900,
        peak: .2, duringTutorAudio: false, belowMinVoice: false });
      seam.conversation = [...seam.conversation, { role: 'user', content: text, isAudio: true, timestamp: performance.now() }];
      view.rerender(workspace());
    });
  };
  const command = async (type: string) => {
    const state = runtime.getSnapshot();
    const offer = state.affordances.find(a => a.action.type === type)!;
    expect(offer, `missing ${type}`).toBeTruthy();
    let pending: Promise<void>;
    await act(async () => {
      pending = transport.command({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
        instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action });
    });
    await tick(40);
    await pending!;
    // The visible receipt, not the commit: the shell acknowledged the revision.
    expect(sent.filter(m => m.type === 'runtime_result').at(-1)?.status).toBe('visible');
    return sent.filter(m => m.type === 'runtime_result').at(-1);
  };
  const dispatch = async (command: Record<string, unknown>) => {
    let receipt: TransitionReceipt;
    await act(async () => { receipt = runtime.dispatch(command); });
    return receipt!;
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
    await act(async () => {
      pending = transport.command({ sessionEpoch: state.sessionEpoch, commandId: crypto.randomUUID(),
        instanceId: state.instanceId!, itemId: state.task!.itemId, expectedRevision: state.revision, action: offer.action });
    });
    await tick(40);
    await pending!;
  };
  const types = () => runtime.getSnapshot().affordances.map(a => a.action.type);

  await speak(options.opening ?? 'Hi! Look at the screen. Your turn.');
  await end();

  return { runtime, transport, view, sent, speak, end, answer, command, dispatch, strategies, strategy, types, tick };
}
