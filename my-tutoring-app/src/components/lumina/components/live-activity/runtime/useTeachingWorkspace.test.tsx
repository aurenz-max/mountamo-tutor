// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTeachingWorkspace, type TeachingWorkspace } from './useTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { RuntimeTransport } from './runtimeTransport';

const seam = vi.hoisted(() => ({ conversation: [] as any[], sendText: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useLuminaAIContext: () => ({ ...seam, isAudioPlaying: false }) }));
afterEach(cleanup);

/** Deliberately nonnumeric. Reuse requires facts + a checker, not a second runner or protocol. */
function ColorWorkspace() {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const lesson = useTeachingWorkspace({ instanceId: 'colors', primitiveId: 'color-test', evalMode: 'identify',
    items: [{ id: 'red-item', task: 'Find red.', response: 'gesture', checkResponse: text => text === 'red' }],
    workspace });
  useLayoutEffect(() => {
    workspace.current = { objects: ['red', 'blue'].map(id => ({ id, label: id, selected: false })),
      demonstration: marks, facts: { material: 'colored tiles' }, readyForResponse: true,
      canDemonstrate: true, canPresent: false, mark, clearPresentation: () => mark([]) };
    lesson.publishWorkspace();
  });
  return <>{['red', 'blue'].map(color => <button key={color} data-marked={marks.includes(color)}
    disabled={!lesson.canAttempt} onClick={() => lesson.submitGestureResponse(color)}>{color}</button>)}</>;
}

it('runs the same teaching protocol on a different domain with no numeric or counting contract', () => {
  const runtime = new LiveLessonRuntime('colors', { allowAnswerExposure: true, maxSupportLevel: 3, allowSupportArtifacts: false });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><ColorWorkspace /></LiveRuntimeContext.Provider>);
  const state = runtime.getSnapshot();
  const choice = state.affordances.find(a => a.action.type === 'workspace' && a.action.operation === 'demonstrate')!;
  act(() => {
    expect(runtime.dispatch({ sessionEpoch: 'colors', commandId: 'mark', instanceId: 'colors', itemId: 'red-item',
      expectedRevision: state.revision, action: { ...choice.action, input: { targets: ['red'] } } }).status).toBe('committed');
    expect(view.getByText('red').getAttribute('data-marked')).toBe('true');
  });
  expect(runtime.getSnapshot().task!.evidence.attemptNumber).toBe(0);
  fireEvent.click(view.getByText('red'));
  expect(runtime.getSnapshot().task!.workspace!.lastResponse).toMatchObject({ response: 'red', correct: true, assisted: true, answerExposure: 'full' });
});

it('accepts an empty optional target list for help, but refuses object targets on that action', () => {
  const runtime = new LiveLessonRuntime('help');
  render(<LiveRuntimeContext.Provider value={runtime}><ColorWorkspace /></LiveRuntimeContext.Provider>);
  const dispatch = (targets: string[]) => {
    const s = runtime.getSnapshot();
    return runtime.dispatch({ sessionEpoch: s.sessionEpoch, commandId: crypto.randomUUID(), instanceId: s.instanceId,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { type: 'workspace', operation: 'begin_help', input: { targets } } });
  };
  act(() => { expect(dispatch(['red']).status).toBe('blocked'); });
  expect(runtime.getSnapshot().task!.support.level).toBe(0);
  act(() => { expect(dispatch([]).status).toBe('committed'); });
  expect(runtime.getSnapshot().task!.support.level).toBe(2);
  expect(runtime.getSnapshot().task!.evidence.attemptNumber).toBe(0);
});

it('tells the tutor why a demonstration was refused, and marks nothing', () => {
  const runtime = new LiveLessonRuntime('why', { allowAnswerExposure: true, maxSupportLevel: 3, allowSupportArtifacts: false });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><ColorWorkspace /></LiveRuntimeContext.Provider>);
  const demonstrate = (input: { targets?: string[] }) => {
    const s = runtime.getSnapshot();
    return runtime.dispatch({ sessionEpoch: s.sessionEpoch, commandId: crypto.randomUUID(), instanceId: s.instanceId,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { type: 'workspace', operation: 'demonstrate', input } });
  };
  act(() => {
    expect(demonstrate({})).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/needs targets.*workspace\.objects/) });
    expect(demonstrate({ targets: ['green'] })).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/green/) });
  });
  expect(view.getByText('red').getAttribute('data-marked')).toBe('false');
  expect(runtime.getSnapshot().task!.support.level).toBe(0);
});

it('gives every shared-workspace binding learner facts in its packet with nothing wired by the binding', async () => {
  const runtime = new LiveLessonRuntime('facts', { allowAnswerExposure: true, maxSupportLevel: 3, allowSupportArtifacts: false });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><ColorWorkspace /></LiveRuntimeContext.Provider>);
  const sent: any[] = [];
  const classifyLearner = vi.fn(async () => ({ asksForHelp: .9, wantsToStop: .01, attemptsAnswer: .02, accepted: true, reason: 'observed', ms: 1 }));
  const transport = new RuntimeTransport(runtime, m => sent.push(m), undefined, classifyLearner);
  transport.publish();
  const first = sent.at(-1).state.learner;
  expect(first.about).toMatch(/never grade an answer/);
  expect(first.signals).toMatchObject({ itemId: 'red-item', attempts: 0, learnerTurns: 0, helpRequests: 0 });
  // A checked gesture's message is written by the host. The context routes it as a host turn, never as learner words.
  fireEvent.click(view.getByText('blue'));
  expect(seam.sendText.mock.calls.at(-1)![1]).toMatchObject({ author: 'host' });
  act(() => transport.hostText());
  expect(classifyLearner).not.toHaveBeenCalled();
  await act(async () => { transport.learnerText('which one is red', true); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  expect(sent.at(-1).state.learner.signals).toMatchObject({ attempts: 1, wrongAttempts: 1, learnerTurns: 1, helpRequests: 1 });
  transport.close();
});

it('judges a checked gesture with no learner words: the host message is not the learner, and earlier speech does not carry over', async () => {
  const runtime = new LiveLessonRuntime('gesture', { allowAnswerExposure: true, maxSupportLevel: 3, allowSupportArtifacts: false });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><ColorWorkspace /></LiveRuntimeContext.Provider>);
  const requests: any[] = [];
  const classify = vi.fn(async (request: any) => { requests.push(request); return { verdict: 'none' as const, transition: 'none' as const,
    confidence: 0, grounded: 0, accepted: false, reason: 'test', ms: 1 }; });
  const transport = new RuntimeTransport(runtime, () => {}, classify, vi.fn(async () => ({ asksForHelp: .01, wantsToStop: .01,
    attemptsAnswer: .01, accepted: true, reason: 'observed', ms: 1 })));
  act(() => transport.learnerText('um is it the blue one', true));
  fireEvent.click(view.getByText('blue'));
  act(() => { transport.hostText(); transport.beginTurn('That one is blue. Look for red.'); transport.endTurn(false); });
  await act(async () => { await Promise.resolve(); });
  expect(classify).toHaveBeenCalledTimes(1);
  expect(requests[0]).toMatchObject({ learner: '', phase: 'checked', lastResponse: { response: 'blue', correct: false } });
  expect(JSON.stringify(requests[0])).not.toMatch(/submitted their selection|is it the blue one/);
  transport.close();
});
