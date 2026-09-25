/**
 * Mount one real primitive on the shared teaching workspace, the way a lesson does: the registry
 * component with the lesson's mount props, under a real LiveLessonRuntime, transport and rendering
 * shell. The substituted seams come from `liveRuntimeSeams` (the test file declares the `vi.mock`
 * preamble; `vi.mock` is hoisted per file and cannot live here).
 *
 * The generic W1 contract (`workspaceContract.test.tsx`) runs every bound family through this, so a
 * primitive's own `<X>.workspace.test.tsx` only tests what is its own: its check, what Try again
 * clears, what stays hidden until credit.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { getPrimitive } from '../../../../config/primitiveRegistry';
import { LiveLessonRuntime } from '../LiveLessonRuntime';
import { LiveRuntimeContext } from '../LiveRuntimeContext';
import { LiveRuntimeSurface } from '../LiveRuntimeSurface';
import { RuntimeTransport } from '../runtimeTransport';
import type { WorkspaceInput } from '../contract';
import { seam } from './liveRuntimeSeams';
import { PipSurfaceContext } from '../../../../pip/PipSurfaceContext';
import type { PipSurfaceStore } from '../../../../pip/PipSurfaceStore';

export interface WorkspaceMount {
  primitiveId: string;
  /** The resolved pin, as a lesson passes it: a catalog mode, a blend, or `mixed`. */
  evalMode: string;
  data: Record<string, unknown>;
  instanceId?: string;
  /** Hosts Pip's surface store around the mount, as a lesson does. */
  pipStore?: PipSurfaceStore;
}

/** The action names only the observer may run. A tutor tool with one of these names breaks TW ownership. */
export const OBSERVER_ONLY = ['apply_tutor_verdict', 'retry', 'advance'] as const;

export function mountWorkspace({ primitiveId, evalMode, data, instanceId = 'ws', pipStore }: WorkspaceMount) {
  const Component = getPrimitive(primitiveId as never)?.component as React.ComponentType<any> | undefined;
  if (!Component) throw new Error(`${primitiveId} is not in the primitive registry`);
  seam.activePrimitiveId = instanceId;
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const payload = { ...data, instanceId };
  const mounted = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <Component data={payload} autoStart runtimePlanItemId={`plan-${instanceId}`} runtimeEvalMode={evalMode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const tree = () => pipStore ? <PipSurfaceContext.Provider value={pipStore}>{mounted()}</PipSurfaceContext.Provider> : mounted();
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && (a.action as { operation?: string }).operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const settle = (ms = 4000) => act(() => { vi.advanceTimersByTime(ms); });
  /** A finished learner turn in the shared conversation. */
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  /** Tutor audio starts or stops (the `seam.audio` a mocked context reads). */
  const speak = (on: boolean) => act(() => { seam.audio = on; view.rerender(tree()); });
  /** The observer's committed reading of the tutor's reply to the pending spoken answer. */
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  /** The tools the tutor itself is offered (observer-only operations excluded). */
  const tutorTools = () => state().affordances.filter(a => !a.controller)
    .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();
  /** The last packet the tutor received. */
  const packet = () => { act(() => transport.publish()); return sent.filter(m => m.type === 'runtime_state').at(-1)?.state; };
  const press = (label: RegExp | string) => act(() => {
    const match = (el: Element) => typeof label === 'string' ? (el.textContent ?? '').trim() === label || el.getAttribute('aria-label') === label
      : label.test(el.textContent ?? '') || label.test(el.getAttribute('aria-label') ?? '');
    const button = Array.from(view.container.querySelectorAll('button')).find(match);
    expect(button, `no button ${label}`).toBeTruthy();
    fireEvent.click(button!);
  });
  const touch = (pipObject: string) => act(() => {
    const el = view.container.querySelector(`[data-pip-object="${pipObject}"]`);
    expect(el, `no object ${pipObject}`).toBeTruthy();
    fireEvent.click(el!);
  });
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, settle, say, speak, feedback, tutorTools,
    packet, press, touch, close: () => transport.close() };
}

export type WorkspaceHarness = ReturnType<typeof mountWorkspace>;

