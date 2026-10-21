// @vitest-environment jsdom
/**
 * The real NumberLine on its boss (`numberLine.boss.ts`) and the shared teaching workspace, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The line's own Check commits a checked gesture;
 * the runtime owns progression. Only microphone hardware, evaluation writes and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'line',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0, resetAttempt: vi.fn() }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import NumberLine, { type NumberLineControls, type NumberLineData } from './NumberLine';

beforeEach(() => { vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 240, right: 760, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); seam.evaluationContext = null; });

const jump = (id: string, start: number, back: number) => ({ id, type: 'show_jump' as const, instruction: `Start at ${start} and hop back ${back}.`,
  hint: 'Count each hop.', targetValues: [start - back], startValue: start,
  operations: [{ type: 'subtract' as const, startValue: start, changeValue: back, showJumpArc: false }] });
const DATA: NumberLineData = { title: 'Hops', range: { min: 0, max: 20 }, gradeBand: 'K-2', numberType: 'integer',
  interactionMode: 'jump', supportTier: 'medium', challenges: [jump('j0', 8, 3), jump('j1', 15, 4)] } as NumberLineData;

function mount(evalMode = 'jump') {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data = { ...DATA, instanceId: 'line' } as NumberLineData;
  let controls: NumberLineControls | null = null;
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <NumberLine data={data} runtimePlanItemId="plan-line" runtimeEvalMode={evalMode} onControlsReady={c => { controls = c; }} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name)!;
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'line',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const tap = (value: number) => {
    const svg = document.querySelector('svg[viewBox="0 0 760 240"]')!;
    const view = controls!.getState(), min = Number(view.visibleMin), max = Number(view.visibleMax);
    act(() => { fireEvent.click(svg, { clientX: 60 + ((value - min) / (max - min)) * 640 }); });
  };
  const check = () => act(() => { fireEvent.click(screen.getByRole('button', { name: /check/i })); });
  return { runtime, transport, sent, state, dispatch, confirmVisible, tap, check, controls: () => controls! };
}

it('binds under tutor ownership: no Next button, and the sandbox controls cannot advance', () => {
  const h = mount();
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toBe('Start at 8 and hop back 3.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/"5"|: ?5[,}]/);
  expect(screen.queryByRole('button', { name: /next challenge/i })).toBeNull();
  // The observer owns progression: the tool-lab advance is refused even after a checked success.
  h.tap(5); h.check();
  expect(h.controls().advance(0)).toBe('rejected');
  expect(h.state().task!.task).toBe('Start at 8 and hop back 3.');
});

it('an unbound mount shows the shared "needs the tutor" card, never a drill', () => {
  render(<NumberLine data={DATA} />);
  expect(document.querySelector('svg[viewBox="0 0 760 240"]')).toBeNull();
  expect(screen.queryByRole('button', { name: /check/i })).toBeNull();
});

it('a landing one hop off is kept as evidence, and the one submission carries it with the first-response score', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  h.tap(6); h.check();                    // 8 back 3: one hop short of 5
  h.dispatch('retry');
  h.tap(5); h.check();
  h.dispatch('advance'); h.confirmVisible();
  h.tap(11); h.check();                   // right first time
  h.dispatch('advance'); h.confirmVisible();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, , studentWork, , evidence] = seam.submit.mock.calls[0] as
    [boolean, number, unknown, { jumpResponses: unknown[] }, unknown, Record<string, unknown>];
  // The canonical score is unchanged: every challenge ended correct.
  expect([success, score]).toEqual([true, 100]);
  expect(studentWork.jumpResponses).toMatchObject([
    { challengeId: 'j0', attempt: 1, placedLandings: [6], expectedLandings: [5], correct: false },
    { challengeId: 'j0', attempt: 2, placedLandings: [5], correct: true },
    { challengeId: 'j1', attempt: 1, placedLandings: [11], correct: true },
  ]);
  expect(evidence).toMatchObject({ firstResponseScore: 50, expected: 'landing at 5' });
});

it('attaches no evidence when every first try was right', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  h.tap(5); h.check();
  h.dispatch('advance'); h.confirmVisible();
  h.tap(11); h.check();
  h.dispatch('advance'); h.confirmVisible();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][5]).toBeUndefined();
  expect((seam.submit.mock.calls[0][3] as { jumpResponses: unknown[] }).jumpResponses).toHaveLength(2);
});

it('Check commits a wrong line, the line stays closed until Try again clears it, then a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  h.tap(6); h.check();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Landed the jumps at 6');
  expect(screen.getByRole('button', { name: /check/i })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Landed the jumps at none yet' });
  h.tap(5); h.check();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.task).toBe('Start at 15 and hop back 4.');
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.tap(11); h.check();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 100]);
});
