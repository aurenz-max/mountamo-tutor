// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTeachingWorkspace, type TeachingWorkspace } from './useTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';

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
