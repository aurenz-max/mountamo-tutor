// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ submissions: [] as unknown[][], tutorState: {} as Record<string, unknown>, sendText: vi.fn() }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: ({ primitiveData }: { primitiveData: Record<string, unknown> }) => {
  state.tutorState = primitiveData;
  return { sendText: state.sendText, isConnected: true };
} }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <p>Block complete</p> }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => undefined }) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { usePrimitiveEvaluation: () => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (...args: unknown[]) => { state.submissions.push(args); setSubmitted(true); return {}; } };
  } };
});
import NumberLine, { type NumberLineData, type NumberLineControls } from './NumberLine';

const data: NumberLineData = {
  title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer', interactionMode: 'jump', supportTier: 'medium',
  challenges: [
    { id: 'show_jump-0', type: 'show_jump', instruction: 'Start at 8 and hop back 3.', hint: 'Count each hop.', targetValues: [5], startValue: 8,
      operations: [{ type: 'subtract', startValue: 8, changeValue: 3, showJumpArc: false }] },
    { id: 'show_jump-1', type: 'show_jump', instruction: 'Start at 15 and hop back 4.', hint: 'Count each hop.', targetValues: [11], startValue: 15,
      operations: [{ type: 'subtract', startValue: 15, changeValue: 4, showJumpArc: false }] },
  ],
};

beforeEach(() => {
  state.submissions = []; state.sendText.mockClear();
  // SVG viewBox is 760 wide: a 760px client rect maps clientX 1:1 onto SVG x.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** Use the committed viewport, so placed value labels cannot masquerade as axis ticks. */
function tap(value: number) {
  const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
  const min = Number(state.tutorState.visibleMin), max = Number(state.tutorState.visibleMax);
  fireEvent.click(svg, { clientX: 60 + ((value - min) / (max - min)) * 640 });
}
const check = () => fireEvent.click(screen.getByRole('button', { name: /check/i }));


import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { TutorAction } from '../../../components/live-activity/runtime/contract';
import { numberLineExample } from './useNumberLineRuntime';

function setup(planned = false, customData = data) {
  const runtime = new LiveLessonRuntime('number-line-test', { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true });
  let sequence = 0;
  const wire = (action: TutorAction) => {
    const s = runtime.getSnapshot();
    return { sessionEpoch: s.sessionEpoch, instanceId: s.instanceId!, itemId: s.task!.itemId,
      expectedRevision: s.revision, commandId: `command-${++sequence}`, action };
  };
  const command = (action: TutorAction) => {
    let receipt!: ReturnType<typeof runtime.dispatch>;
    act(() => { receipt = runtime.dispatch(wire(action)); });
    return receipt;
  };
  let controls: NumberLineControls | null = null;
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberLine data={{ ...customData, instanceId: 'line' }} runtimePlanItemId={planned ? 'plan-one' : undefined}
      onControlsReady={value => { controls = value; }} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  return { runtime, command, wire, view, controls: () => controls! };
}

it('commits real React advance before returning; rejects unchecked, duplicate, stale item and revision commands', () => {
  const { runtime, command, wire } = setup();
  expect(command({ type: 'advance' }).status).toBe('unsupported');
  const old = wire({ type: 'replay' });
  tap(4); check();
  expect(runtime.dispatch(old).status).toBe('stale');
  expect(command({ type: 'advance' }).status).toBe('unsupported');
  expect(command({ type: 'retry' }).state.task).toMatchObject({ evidence: { attemptNumber: 2 }, demand: { endpoints: '[]' } });
  tap(5); check();
  tap(4); // A checked answer cannot be changed underneath its success evidence.
  expect(runtime.getSnapshot().task!.demand.endpoints).toBe('[5]');
  const advance = wire({ type: 'advance' });
  let receipt!: ReturnType<typeof runtime.dispatch>;
  act(() => {
    receipt = runtime.dispatch(advance);
    // This assertion happens BEFORE act exits: queued React state cannot pass it.
    expect(receipt.state.task).toMatchObject({ itemId: 'show_jump-1', demand: { endpoints: '[]' }, evidence: { correctness: 'unknown' } });
    expect(state.tutorState.currentChallengeIndex).toBe(1);
    expect(screen.getByText(data.challenges![1].instruction)).toBeTruthy();
    expect(runtime.dispatch(advance).status).toBe('duplicate');
    expect(runtime.dispatch({ ...advance, commandId: 'late' }).status).toBe('stale');
  });
  expect(receipt.status).toBe('committed');
  expect(state.submissions).toHaveLength(0);
});

it('replays without altering work, shows and fades the reminder, and retains assistance after retry', () => {
  const { runtime, command } = setup();
  tap(4); check();
  const saved = runtime.getSnapshot().task!.demand;
  expect(command({ type: 'replay' }).state.task!.demand).toEqual(saved);
  expect(document.activeElement).toBe(screen.getByLabelText('Current instruction'));
  expect(command({ type: 'scaffold', strategyId: 'invented', direction: 1 }).status).toBe('unsupported');
  expect(command({ type: 'point', targetId: 'answer' }).status).toBe('unsupported');
  expect(command({ type: 'scaffold', strategyId: 'count-spaces', direction: 1 }).status).toBe('committed');
  expect(screen.getByText(/Find the starting mark/)).toBeTruthy();
  expect(command({ type: 'scaffold', strategyId: 'count-spaces', direction: -1 }).state.task!.support.level).toBe(0);
  expect(screen.queryByText(/Find the starting mark/)).toBeNull();
  command({ type: 'retry' });
  expect(runtime.getSnapshot().assistance.map(a => a.action.type)).toEqual(['replay', 'scaffold', 'scaffold']);
});

it('preserves the same DOM and mid-work response across help/return; gates gestures and old controls; transfers to a blank item', () => {
  const { runtime, command, controls } = setup();
  tap(4);
  const svg = document.querySelector('svg[viewBox="0 0 760 240"]');
  const saved = runtime.getSnapshot().task!.demand;
  const staleControl = controls();
  const receipt = command({ type: 'request_support', artifactId: 'example-show_jump-0' });
  expect(receipt.status).toBe('committed');
  expect(screen.getByRole('complementary', { name: 'Worked example' })).toBeTruthy();
  tap(5); // programmatically dispatched click must also be refused on the hidden SVG
  expect(staleControl.advance(0)).toBe('rejected');
  expect(runtime.getSnapshot().task!.demand).toEqual(saved);
  expect(command({ type: 'return' }).status).toBe('committed');
  expect(document.querySelector('svg[viewBox="0 0 760 240"]')).toBe(svg);
  expect(runtime.getSnapshot().task!.demand).toEqual(saved);
  expect(command({ type: 'request_support', artifactId: 'example-show_jump-0' }).status).toBe('unsupported');
  tap(5); check(); command({ type: 'advance' });
  expect(runtime.getSnapshot().task!.demand.endpoints).toBe('[]');
  expect(runtime.getSnapshot().assistance.some(a => a.itemId === 'show_jump-0' && a.answerExposure === 'partial')).toBe(true);
});

it('settles one planned completion after the existing speech hold and suppresses competing final cues', () => {
  const { runtime, command } = setup(true);
  const done = vi.fn(); runtime.onCompletion(done);
  tap(5); check(); command({ type: 'advance' });
  let release!: () => void;
  act(() => { release = runtime.holdTeachingTurn({ allowTutorActions: true }); });
  state.sendText.mockClear(); tap(11); check();
  expect(runtime.getSnapshot().status).toBe('closing');
  expect(done).not.toHaveBeenCalled();
  expect(state.sendText).not.toHaveBeenCalled();
  act(() => release());
  expect(done).toHaveBeenCalledTimes(1);
  expect(runtime.getSnapshot().canStartNext).toBe(true);
  expect(state.submissions).toHaveLength(1);
});

it('stops without completion and rejects controls after unmount', () => {
  const { runtime, controls, view, wire } = setup();
  const control = controls(), late = wire({ type: 'replay' });
  act(() => runtime.stop());
  tap(5);
  expect(runtime.getSnapshot().task!.demand.endpoints).toBe('[]');
  expect(control.advance(0)).toBe('rejected');
  expect(state.submissions).toHaveLength(0);
  view.unmount();
  expect(runtime.dispatch(late).status).toBe('stale');
});

it('withholds examples for unsupported math and avoids exposing the current subtraction answer', () => {
  const challenge = data.challenges![0];
  expect(numberLineExample(challenge, [{ type: 'add', startValue: 8, changeValue: 3, showJumpArc: false }])).toEqual([]);
  expect(numberLineExample(challenge, [{ type: 'subtract', startValue: 8.5, changeValue: 3, showJumpArc: false }])).toEqual([]);
  const [artifact] = numberLineExample(challenge, challenge.operations!);
  expect(artifact.total - artifact.removed).not.toBe(5);
});

it('delivers a visible transport receipt for the rendered reminder', async () => {
  const { runtime, wire } = setup();
  const messages: any[] = [];
  const transport = new RuntimeTransport(runtime, message => messages.push(message));
  let pending!: Promise<void>;
  act(() => { pending = transport.command(wire({ type: 'scaffold', strategyId: 'count-spaces', direction: 1 })); });
  // Let the actual surface's two RAFs acknowledge the committed DOM.
  await act(async () => { await pending; });
  expect(messages.find(m => m.type === 'runtime_result')).toMatchObject({ status: 'visible', state: { task: { support: { level: 1 } } } });
  expect(screen.getByText(/Find the starting mark/)).toBeTruthy();
  transport.close();
});


it.each(['plot_point', 'find_between', 'order_values'] as const)('shares checked retry/advance in %s without advertising jump-only help', type => {
  const first = { id: 'other-0', type, instruction: 'Place the values.', hint: 'Try again.',
    targetValues: type === 'plot_point' ? [6] : [2, 8], ...(type === 'find_between' ? { exactTargetValue: 6 } : {}) };
  const { runtime, command, controls, view } = setup(false, { ...data, challenges: [first, data.challenges![1]] });
  expect(runtime.getSnapshot().affordances.map(a => a.action.type)).toEqual(['replay']);
  const place = (right: boolean) => {
    if (type === 'order_values') {
      fireEvent.click(screen.getByRole('button', { name: '2' })); tap(right ? 2 : 8);
      fireEvent.click(screen.getByRole('button', { name: '8' })); tap(right ? 8 : 2);
    } else tap(right ? 6 : 1);
    check();
  };
  place(false);
  expect(runtime.getSnapshot().task!.evidence.correctness).toBe('incorrect');
  expect(command({ type: 'retry' }).status).toBe('committed');
  expect(runtime.getSnapshot().task!.demand).toMatchObject({ points: '[]', ordered: '[]' });
  place(true);
  const staleControl = controls();
  expect(command({ type: 'advance' }).state.task!.itemId).toBe('show_jump-1');
  view.unmount();
  expect(staleControl.advance(0)).toBe('rejected');
});
