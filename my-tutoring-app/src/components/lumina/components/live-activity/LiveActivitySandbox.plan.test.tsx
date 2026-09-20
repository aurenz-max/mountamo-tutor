// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LiveActivitySandbox from './LiveActivitySandbox';
import type { LiveLessonRuntime } from './runtime/LiveLessonRuntime';

const mocks = vi.hoisted(() => ({ runtime: null as LiveLessonRuntime | null, lineProps: null as any, event: null as null | ((v: Record<string, unknown>) => void),
  ai: { connectLesson: vi.fn(), disconnect: vi.fn(), sendActivityMessage: vi.fn(), sendText: vi.fn(),
    isConnected: true, isListening: true, startListening: vi.fn(), stopListening: vi.fn(), conversation: [] },
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => mocks.ai,
  LuminaAIProvider: ({ children, onActivityEvent, liveLessonRuntime }: any) => { mocks.event = onActivityEvent; mocks.runtime = liveLessonRuntime; return children; },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'tester' } }) }));
const finishButton = (data: any, label: string) =>
  <button onClick={() => data.onEvaluationSubmit?.({ success: false, score: 75 })}>{label}</button>;
// One mock for every adopted family; a new adoption needs no edit here. The
// number-line row still records its props, because the plan projection asserts
// the resolved eval mode and plan item reach the mounted primitive.
vi.mock('./liveRenderers', () => {
  const Mounted = ({ id, data, autoStart, planItemId, evalMode }: any) => {
    if (id === 'number-line') mocks.lineProps = { data, runtimePlanItemId: planItemId, runtimeEvalMode: evalMode };
    return <div data-testid={id} data-auto-start={String(autoStart)}>{data.title}{finishButton(data, `finish ${id}`)}</div>;
  };
  return { LIVE_RENDERERS: new Proxy({}, { get: (_t, id: string) => (p: any) => <Mounted id={id} {...p} /> }) };
});

const frame = { title: 'Frame practice', mode: 'single', gradeBand: '1-2', challenges: [
  { id: 'a', type: 'subtract', targetCount: 4, startCount: 7, instruction: 'Take away 3.' }] };
const line = { title: 'Hop practice', range: { min: 0, max: 10 }, challenges: [{ id: 'c', type: 'show_jump',
  instruction: 'Start at 7 and hop back 3.', hint: 'Left.', startValue: 7, targetValues: [4],
  operations: [{ type: 'subtract', startValue: 7, changeValue: 3, showJumpArc: true }] }] };
const pkg = { benchVersion: 1, id: 'pkg-sub', provenance: { generatedAt: '2026-09-16T00:00:00Z', source: 'topic-trace' },
  curatorBrief: { hook: { content: 'Hi' }, objectives: [] },
  manifest: { topic: 'Take-away stories', gradeLevel: '1st Grade', themeColor: '#fff',
    layout: [{ componentId: 'ten-frame', instanceId: 'tf', title: 'Frame', intent: 'x' }],
    objectiveBlocks: [
      { objectiveId: 'obj1', objectiveText: 'Act out take-away stories', objectiveVerb: 'apply', components: [
        { componentId: 'ten-frame', instanceId: 'tf', title: 'Take away on a frame', intent: 'Remove counters', config: { targetEvalMode: 'operate' } },
        { componentId: 'concept-card-grid', instanceId: 'cards', title: 'Cards', intent: 'Define words' }] },
      { objectiveId: 'obj2', objectiveText: 'Subtract by hopping left', objectiveVerb: 'explain', components: [
        { componentId: 'number-line', instanceId: 'nl', title: 'Hop back', intent: 'Hop left to subtract', config: { targetEvalMode: 'jump' } }] },
    ] },
  components: [{ instanceId: 'tf', componentId: 'ten-frame', data: frame }, { instanceId: 'nl', componentId: 'number-line', data: line },
    { instanceId: 'cards', componentId: 'concept-card-grid', data: {} }],
};

let frames: FrameRequestCallback[];
beforeEach(() => {
  vi.clearAllMocks(); frames = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { frames.push(f); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function emit(v: Record<string, unknown>) { await act(async () => { mocks.event!(v); }); }
async function paint() { await act(async () => { const todo = frames.splice(0); todo.forEach(f => f(0)); }); }
const sent = (type: string) => mocks.ai.sendActivityMessage.mock.calls.map(c => c[0]).filter(m => m.type === type);

it('runs a loaded package as a planned lesson: in order, prepared content, one completion report per item', async () => {
  render(<LiveActivitySandbox />);
  const file = new File([JSON.stringify(pkg)], 'pkg.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(pkg) });
  await act(async () => { fireEvent.change(screen.getByLabelText('Lesson package'), { target: { files: [file] } }); });
  await screen.findByText(/Take-away stories · Grade 1 · 2 live activities/);
  expect(screen.getByText(/concept-card-grid: no live adapter/)).toBeTruthy();

  fireEvent.click(screen.getByText('Start lesson'));
  await waitFor(() => expect(mocks.ai.connectLesson).toHaveBeenCalledTimes(1));
  const connect = mocks.ai.connectLesson.mock.calls[0][0];
  expect(connect.grade_level).toBe('Grade 1');
  expect(connect.activitySandbox).toMatchObject({ activities: [{ primitiveId: 'ten-frame', teachingOwner: 'di-runner' }, { primitiveId: 'number-line', teachingOwner: 'tutor' }], visuals: [], plan: { topic: 'Take-away stories', items: [
    { itemId: 'item-1', primitiveId: 'ten-frame', title: 'Take away on a frame', evalMode: 'operate', objective: 'Act out take-away stories' },
    { itemId: 'item-2', primitiveId: 'number-line', title: 'Hop back', evalMode: 'jump', objective: 'Subtract by hopping left' }] } });
  expect(JSON.stringify(connect)).not.toContain('targetCount');
  await emit({ type: 'session_ready' });
  expect(mocks.ai.sendText).toHaveBeenCalledWith(expect.stringContaining('start_plan_item with itemId item-1'), { silent: true });

  // Out of order: rejected without mounting anything.
  await emit({ type: 'activity_request', callId: 'early', args: { planItemId: 'item-2' } });
  expect(sent('activity_result')).toEqual([expect.objectContaining({ callId: 'early', status: 'error', error: expect.stringContaining('item-1') })]);
  expect(screen.queryByTestId('number-line')).toBeNull();

  await emit({ type: 'activity_request', callId: 'start-1', args: { planItemId: 'item-1' } });
  expect(screen.getByTestId('ten-frame').textContent).toContain('Frame practice');
  await emit({ type: 'activity_request', callId: 'again', args: { planItemId: 'item-1' } });
  expect(sent('activity_result').at(-1)).toMatchObject({ callId: 'again', status: 'error', error: 'That activity is already on screen.' });
  await paint(); await paint();
  const mounted = sent('activity_result').at(-1);
  expect(mounted).toMatchObject({ callId: 'start-1', status: 'mounted', primitiveId: 'ten-frame',
    planItem: { itemId: 'item-1', evalMode: 'operate', objective: 'Act out take-away stories', intent: 'Remove counters' } });
  expect(mounted.data).toMatchObject({ challengeType: 'subtract', teachingOwner: 'ten-frame-di' });
  expect(fetch).not.toHaveBeenCalled();
  await emit({ type: 'activity_ready', callId: 'start-1', instanceId: mounted.instanceId });
  expect(screen.getByTestId('ten-frame').getAttribute('data-auto-start')).toBe('true');

  fireEvent.click(screen.getByText('finish ten-frame'));
  fireEvent.click(screen.getByText('finish ten-frame'));
  expect(sent('plan_item_complete')).toEqual([{ type: 'plan_item_complete', callId: 'start-1', instanceId: mounted.instanceId,
    itemId: 'item-1', nextItemId: 'item-2',
    outcome: { itemId: 'item-1', disposition: 'completed', allCorrect: false, score: 75 } }]);
  expect(screen.getByLabelText('Lesson plan').querySelector('[data-state="done"]')?.textContent).toContain('Take away on a frame');

  await emit({ type: 'activity_request', callId: 'repeat', args: { planItemId: 'item-1' } });
  expect(sent('activity_result').at(-1)).toMatchObject({ callId: 'repeat', status: 'error' });
  expect(screen.getByTestId('ten-frame')).toBeTruthy();

  await emit({ type: 'activity_request', callId: 'start-2', args: { planItemId: 'item-2' } });
  expect(screen.queryByTestId('ten-frame')).toBeNull();
  await paint(); await paint();
  const second = sent('activity_result').at(-1);
  expect(second).toMatchObject({ callId: 'start-2', status: 'mounted', primitiveId: 'number-line', planItem: { itemId: 'item-2', evalMode: 'jump' } });
  expect(second.data).toMatchObject({ instruction: 'Start at 7 and hop back 3.', currentChallengeIndex: 0 });
  fireEvent.click(screen.getByText('finish number-line'));
  expect(sent('plan_item_complete').at(-1)).toMatchObject({ callId: 'start-2', itemId: 'item-2', nextItemId: '' });

  await emit({ type: 'activity_request', callId: 'after', args: { planItemId: 'item-2' } });
  expect(sent('activity_result').at(-1)).toMatchObject({ callId: 'after', status: 'error', error: 'The planned lesson is finished.' });
});


it('preserves plan metadata and holds its completion report until the mounted runtime settles', async () => {
  render(<LiveActivitySandbox />);
  const onlyLine = { ...pkg, manifest: { ...pkg.manifest, objectiveBlocks: [pkg.manifest.objectiveBlocks[1]] } };
  const file = new File([], 'line.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(onlyLine) });
  await act(async () => { fireEvent.change(screen.getByLabelText('Lesson package'), { target: { files: [file] } }); });
  fireEvent.click(screen.getByText('Start lesson'));
  await emit({ type: 'session_ready' });
  await emit({ type: 'activity_request', callId: 'start-line', args: { planItemId: 'item-1' } });
  expect(mocks.lineProps).toMatchObject({ runtimeEvalMode: 'jump', runtimePlanItemId: 'item-1', data: { objectiveId: 'obj2' } });
  const runtime = mocks.runtime!, instanceId = mocks.lineProps.data.instanceId;
  let terminal = false, release!: () => void, registration!: ReturnType<typeof runtime.register>;
  act(() => {
    registration = runtime.register({ instanceId, primitiveId: 'number-line', objectiveId: 'obj2', planItemId: 'item-1', evalMode: 'jump',
      adapter: { getAffordances: () => [], getTutorState: () => ({ itemId: 'c', phase: terminal ? 'done' : 'responding', task: 'Hop back',
        completed: terminal, demand: {}, support: { level: 0, answerExposure: 'none' },
        evidence: { attemptNumber: 1, correctness: terminal ? 'correct' : 'unknown', recentResponses: [] } }) } });
    release = runtime.holdTeachingTurn({ allowTutorActions: true });
  });
  fireEvent.click(screen.getByText('finish number-line'));
  expect(sent('plan_item_complete')).toHaveLength(0);
  act(() => { terminal = true; registration.changed(); runtime.requestCompletion(); });
  expect(runtime.getSnapshot().status).toBe('closing');
  expect(sent('plan_item_complete')).toHaveLength(0);
  act(() => release());
  expect(sent('plan_item_complete')).toHaveLength(1);
  expect(sent('plan_item_complete')[0]).toMatchObject({ itemId: 'item-1', instanceId, nextItemId: '' });
  act(() => runtime.requestCompletion());
  expect(sent('plan_item_complete')).toHaveLength(1);
  act(() => registration.dispose());
});
