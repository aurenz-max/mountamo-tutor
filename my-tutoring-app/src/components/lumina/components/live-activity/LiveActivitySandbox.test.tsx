// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LiveActivitySandbox from './LiveActivitySandbox';
import { LIVE_ADAPTERS, LIVE_PRIMITIVE_IDS } from './activityContract';

const mocks = vi.hoisted(() => ({ event: null as null | ((v: Record<string, unknown>) => void),
  ai: { connectLesson: vi.fn(), disconnect: vi.fn(), sendActivityMessage: vi.fn(), sendText: vi.fn(),
    isConnected: true, isListening: false, startListening: vi.fn(), stopListening: vi.fn(), conversation: [] },
  controls: { advance: vi.fn(), getState: vi.fn() },
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => mocks.ai,
  LuminaAIProvider: ({ children, onActivityEvent }: any) => { mocks.event = onActivityEvent; return children; },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'tester' } }) }));
// One mock for every adopted family. The sandbox owns mounting, autoStart and
// control registration; the primitives themselves are covered by their own
// runtime tests, so a new adoption needs no edit here.
vi.mock('./liveRenderers', () => {
  const Mounted = ({ id, data, autoStart, onControls }: any) => {
    React.useEffect(() => { onControls?.(mocks.controls); return () => onControls?.(null); }, [onControls]);
    return <div data-testid={id} data-auto-start={String(autoStart)}>{data.title}</div>;
  };
  return { LIVE_RENDERERS: new Proxy({}, { get: (_t, id: string) => (p: any) => <Mounted id={id} {...p} /> }) };
});

const args = { primitiveId: 'number-line', topic: 'Subtract', intent: 'Practice subtraction', mode: 'jump' };
const result = (id: string) => ({ instanceId: id, data: { title: `Activity ${id}`, instanceId: id,
  range: { min: 0, max: 10 }, challenges: [{ id: 'c', type: 'show_jump', instruction: 'Subtract 3 from 7',
    hint: 'Move left', startValue: 7, targetValues: [4], operations: [{ type: 'subtract', startValue: 7, changeValue: 3, showJumpArc: true }] }],
} });
let frames: FrameRequestCallback[];
beforeEach(() => {
  vi.clearAllMocks(); frames = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { frames.push(f); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function emit(v: Record<string, unknown>) { await act(async () => { mocks.event!(v); }); }
async function paint() { await act(async () => { const todo = frames.splice(0); todo.forEach(f => f(0)); }); }

it('initiates a full runner-owned lesson once and arms DI only after its correlated server handoff', async () => {
  const line = [{ name: 'Rabbit', emoji: '🐰' }, { name: 'Turtle', emoji: '🐢' }, { name: 'Fox', emoji: '🦊' },
    { name: 'Bear', emoji: '🐻' }, { name: 'Frog', emoji: '🐸' }];
  const data = { title: 'Parade', maxPosition: 5, context: 'race', showOrdinalLabels: true, labelFormat: 'both', gradeBand: '1',
    challenges: [{ id: 'one', type: 'identify', instruction: '', characters: line, targetPosition: 3, correctAnswer: '3' }] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ instanceId: 'frame-1', data }) }));
  render(<LiveActivitySandbox />);
  fireEvent.click(screen.getByText('Start lesson'));
  expect(mocks.ai.sendText).not.toHaveBeenCalled();
  await emit({ type: 'session_ready' }); await emit({ type: 'session_ready' });
  expect(mocks.ai.sendText).toHaveBeenCalledTimes(1);
  expect(mocks.ai.sendText).toHaveBeenCalledWith(expect.stringContaining('[LESSON_START]'), { silent: true });
  await emit({ type: 'activity_request', callId: 'frame-call', args: { primitiveId: 'ordinal-line', mode: 'identify', topic: 'Ordinal positions', intent: 'Find the third animal.' } });
  await screen.findByTestId('ordinal-line');
  expect(screen.getByTestId('ordinal-line').getAttribute('data-auto-start')).toBe('false');
  await emit({ type: 'activity_ready', callId: 'frame-call', instanceId: 'frame-1' });
  expect(screen.getByTestId('ordinal-line').getAttribute('data-auto-start')).toBe('false');
  await paint(); await paint();
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({ status: 'mounted', primitiveId: 'ordinal-line' }));
  await emit({ type: 'activity_ready', callId: 'old', instanceId: 'frame-1' });
  expect(screen.getByTestId('ordinal-line').getAttribute('data-auto-start')).toBe('false');
  await emit({ type: 'activity_ready', callId: 'frame-call', instanceId: 'frame-1' });
  expect(screen.getByTestId('ordinal-line').getAttribute('data-auto-start')).toBe('true');
});

it('dispatches tutor advance to the mounted primitive and acknowledges the painted state, rejecting stale screens', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => result('one') }));
  render(<LiveActivitySandbox />);
  await emit({ type: 'activity_request', callId: 'call-1', args });
  await screen.findByText('Activity one');
  await paint(); await paint();
  mocks.ai.sendActivityMessage.mockClear();
  mocks.controls.advance.mockReturnValue('advanced');
  mocks.controls.getState.mockReturnValue({ currentChallengeIndex: 1, instruction: 'Next visible problem' });
  await emit({ type: 'activity_command', callId: 'next', instanceId: 'one', challengeIndex: 0 });
  expect(mocks.controls.advance).toHaveBeenCalledWith(0);
  expect(mocks.ai.sendActivityMessage).not.toHaveBeenCalled();
  await paint(); expect(mocks.ai.sendActivityMessage).not.toHaveBeenCalled();
  await paint();
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'activity_command_result',
    callId: 'next', status: 'advanced', state: { currentChallengeIndex: 1, instruction: 'Next visible problem' } }));
  await emit({ type: 'activity_command', callId: 'stale', instanceId: 'old', challengeIndex: 0 });
  expect(mocks.controls.advance).toHaveBeenCalledTimes(1);
  expect(mocks.ai.sendActivityMessage).toHaveBeenLastCalledWith(expect.objectContaining({ callId: 'stale', status: 'rejected' }));
});

it('acknowledges visible content after commit/paint and requests another example in the same session', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => result('one') }));
  render(<LiveActivitySandbox />);
  fireEvent.click(screen.getByText('Start lesson'));
  await emit({ type: 'session_ready' });
  await emit({ type: 'activity_request', callId: 'call-1', args });
  await screen.findByText('Activity one');
  expect(mocks.ai.sendActivityMessage).not.toHaveBeenCalled();
  await paint(); expect(mocks.ai.sendActivityMessage).not.toHaveBeenCalled();
  await paint();
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({ status: 'mounted', instanceId: 'one' }));
  fireEvent.click(screen.getByText('Ask for another example'));
  expect(mocks.ai.sendText).toHaveBeenCalledWith(expect.stringContaining('another example'), { interrupt: true });
  expect(mocks.ai.connectLesson).toHaveBeenCalledTimes(1);
});

it('ignores generation that finishes after a newer request even if fetch ignores abort', async () => {
  let finishOld!: (v: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(r => { finishOld = r; }))
    .mockResolvedValueOnce({ ok: true, json: async () => result('new') }));
  render(<LiveActivitySandbox />);
  await emit({ type: 'activity_request', callId: 'old', args });
  await emit({ type: 'activity_request', callId: 'new', args });
  await screen.findByText('Activity new');
  await act(async () => finishOld({ ok: true, json: async () => result('old') }));
  expect(screen.queryByText('Activity old')).toBeNull();
  await paint(); await paint();
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledTimes(1);
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({ callId: 'new' }));
});

it('cancels pending generation and never acknowledges a cancelled render', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => result('cancelled') }));
  render(<LiveActivitySandbox />);
  await emit({ type: 'activity_request', callId: 'cancelled', args });
  await screen.findByText('Activity cancelled');
  await emit({ type: 'activity_cancelled', callId: 'cancelled', reason: 'model cancelled' });
  await paint(); await paint();
  expect(mocks.ai.sendActivityMessage).not.toHaveBeenCalled();
  expect(screen.queryByTestId('live-activity')).toBeNull();
});

it('reports generator failure to both tutor and learner', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Generation unavailable' }) }));
  render(<LiveActivitySandbox />);
  await emit({ type: 'activity_request', callId: 'failed', args });
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Generation unavailable'));
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({ callId: 'failed', status: 'error' }));
});

it('shows direct visuals without fetching, streams taps, and acknowledges highlighting after paint', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<LiveActivitySandbox />);
  // Leave exactly one family enabled, whichever families are adopted: the point is
  // that an unchecked family does not reach the tutor's activity spec. Driven from
  // the registry so a new adoption does not silently add a second activity here.
  for (const id of LIVE_PRIMITIVE_IDS) {
    if (id !== 'ten-frame') fireEvent.click(screen.getByLabelText(LIVE_ADAPTERS[id].copy.checkbox));
  }
  fireEvent.click(screen.getByText('Start lesson'));
  expect(mocks.ai.connectLesson).toHaveBeenCalledWith(expect.objectContaining({
    activitySandbox: expect.objectContaining({ activities: [expect.objectContaining({ primitiveId: 'ten-frame', teachingOwner: 'tutor' })], visuals: expect.arrayContaining([expect.objectContaining({ name: 'show_counters' })]) }),
  }));
  await emit({ type: 'session_ready' });
  await emit({ type: 'activity_visual', callId: 'direct', instanceId: 'counters', toolName: 'show_counters', args: { count: 6, layout: 'ten_frame', instruction: 'Take away two.', removedIndices: [], highlightedIndices: [],
  } });
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.ai.sendActivityMessage).not.toHaveBeenCalled();
  await paint(); await paint();
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({
    type: 'activity_result', status: 'mounted', primitiveId: 'live-counters', instanceId: 'counters',
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Counter 1' }));
  expect(mocks.ai.sendActivityMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'visual_state', state: expect.objectContaining({ remainingCount: 5, removedIndices: [0] }),
  }));
  await emit({ type: 'activity_highlight', callId: 'point', instanceId: 'counters', indices: [2] });
  expect(mocks.ai.sendActivityMessage.mock.calls.some(([v]) => v.type === 'activity_command_result')).toBe(false);
  await paint(); await paint();
  expect(mocks.ai.sendActivityMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'activity_command_result', status: 'updated', callId: 'point', state: expect.objectContaining({ highlightedIndices: [2], removedIndices: [0] }),
  }));
});

it('keeps a direct visual when superseded number-line generation finishes late', async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
  render(<LiveActivitySandbox />);
  await emit({ type: 'activity_request', callId: 'slow', args });
  await emit({ type: 'activity_visual', callId: 'direct', instanceId: 'letters', toolName: 'show_letter_tiles', args: { instruction: 'Blend these sounds.', tiles: ['m', 'a', 'p'], selectedIndices: [], highlightedIndices: [],
  } });
  await act(async () => finish({ ok: true, json: async () => result('late') }));
  await paint(); await paint();
  expect(screen.getByRole('button', { name: 'Tile 1: m' })).toBeTruthy();
  expect(screen.queryByText('Activity late')).toBeNull();
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledTimes(1);
  expect(mocks.ai.sendActivityMessage).toHaveBeenCalledWith(expect.objectContaining({ callId: 'direct', primitiveId: 'live-letters', status: 'mounted' }));
});

it('rejects invalid visual parameters without replacing the mounted visual or losing its state stream', async () => {
  render(<LiveActivitySandbox />);
  await emit({ type: 'activity_visual', callId: 'valid', instanceId: 'counters', toolName: 'show_counters',
    args: { count: 6, layout: 'ten_frame', instruction: 'Count.' } });
  await paint(); await paint();
  const original = screen.getByRole('button', { name: 'Counter 1' });
  await emit({ type: 'activity_visual', callId: 'invalid', instanceId: 'fraction', toolName: 'show_fraction',
    args: { numerator: 5, denominator: 4, instruction: 'Look.' } });
  expect(screen.getByRole('button', { name: 'Counter 1' })).toBe(original);
  expect(mocks.ai.sendActivityMessage).toHaveBeenLastCalledWith(expect.objectContaining({ callId: 'invalid', status: 'error' }));
  fireEvent.click(original);
  expect(mocks.ai.sendActivityMessage).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'visual_state', instanceId: 'counters', state: expect.objectContaining({ remainingCount: 5 }),
  }));
});


it('starts the selected Number Line lesson with its mode and shared runtime enabled', async () => {
  render(<LiveActivitySandbox />);
  fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'number-line' } });
  expect((screen.getByLabelText('Lesson') as HTMLSelectElement).value).toBe('jump');
  expect(screen.getByText('Learn with Number Line')).toBeTruthy();
  fireEvent.click(screen.getByText('Start lesson'));
  expect(mocks.ai.connectLesson).toHaveBeenCalledWith(expect.objectContaining({ runtimeSandbox: expect.any(Object) }));
  await emit({ type: 'session_ready' });
  expect(mocks.ai.sendText).toHaveBeenCalledWith(expect.stringContaining('primitiveId number-line, mode jump'), { silent: true });
});
