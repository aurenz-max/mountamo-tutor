// @vitest-environment jsdom
/**
 * The real FractionBar on the shared teaching workspace (W1 binding), with the real TeachingSession,
 * LiveLessonRuntime and rendering shell; only the Live context, evaluation writes and sound are substituted.
 * The three-step item (numerator, denominator, shade): each step's Check is the bar's own, a wrong check commits
 * a named miss and Try again keeps the step reached, a right numerator or denominator moves on without a commit,
 * and the right shading completes the item. Outside a runtime the scripted path is unchanged
 * (`FractionBar.capture.test.tsx`).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ send: vi.fn(), legacy: vi.fn(), writes: [] as any[], evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'bar',
  conversation: [], sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: seam.legacy, isConnected: true,
  isAudioPlaying: false, activePrimitiveId: null }) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => seam.evaluationContext, usePrimitiveEvaluation: () => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (success: boolean, score: number, metrics: any, studentWork: any) => {
        seam.writes.push({ success, score, metrics, studentWork }); setSubmitted(true); return null;
      } };
  } };
});
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import FractionBar, { type FractionBarChallenge, type FractionBarChallengeType } from './FractionBar';

beforeEach(() => { vi.clearAllMocks(); seam.writes = []; seam.evaluationContext = null; });
afterEach(() => { cleanup(); });

const fraction = (id: string, n: number, d: number): FractionBarChallenge => ({ id, numerator: n, denominator: d,
  numeratorChoices: [n, d, d + 1, d + 2], denominatorChoices: [d, n, d + 1, d + 2] });

function mount(mode: FractionBarChallengeType, challenges: FractionBarChallenge[]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionBar data={{ instanceId: 'bar', title: 'Fractions', description: 'Bars', challengeType: mode, challenges }}
      runtimePlanItemId="plan-bar" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let last = '';
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && x.action.operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    last = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: last, instanceId: s.instanceId!,
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(last); });
  const press = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const shadeTo = (n: number) => act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="part-${n - 1}"]`)!); });
  const attempts = () => state().task!.workspace!.attempts;
  /** The whole item, right: numerator, denominator, then the shading. */
  const solve = (c: FractionBarChallenge) => {
    press(String(c.numerator)); press('Check Answer'); press(String(c.denominator)); press('Check Answer');
    shadeTo(c.numerator); press('Submit Fraction');
  };
  return { runtime, view, state, dispatch, confirmVisible, press, shadeTo, attempts, solve };
}

it.each(['identify', 'build', 'compare', 'add_subtract'] as const)('%s binds: a gesture item told the fraction, never a key', mode => {
  const h = mount(mode, [fraction('q0', 3, 4)]);
  const task = h.state().task!;
  expect(task).toMatchObject({ itemId: 'q0' });
  expect(task.task).toMatch(/numerator and the denominator of 3\/4/);
  expect(task.demand).toMatchObject({ response: 'gesture', kind: mode, step: 'numerator', printedFraction: '3/4' });
  expect(task.workspace!.expectedAnswer).toBeUndefined();
  // The pick step's levers (`fractionBarLevers.ts`); no Next or hint buttons on the workspace path.
  expect(task.workspace!.levers!.map(l => l.id)).toContain('model_fraction');
  expect(screen.queryByRole('button', { name: /show hint|next problem/i })).toBeNull();
  // Nothing goes to the tutor from the legacy path.
  expect(seam.legacy).not.toHaveBeenCalled();
});

it('a wrong step commits its named miss, Try again keeps the step reached, and the right shading completes the item', () => {
  const h = mount('build', [fraction('q0', 3, 4), fraction('q1', 2, 5)]);
  h.press('4'); h.press('Check Answer');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'chose_denominator', response: 'Chose 4 as the numerator' });
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ step: 'numerator' });
  // A right numerator moves to the denominator at once, with no commit.
  h.press('3'); h.press('Check Answer');
  expect(h.attempts()).toHaveLength(1);
  expect(h.state().task!.demand).toMatchObject({ step: 'denominator' });
  h.press('3'); h.press('Check Answer');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'chose_numerator' });
  h.dispatch('retry');
  // Try again keeps the denominator step: the numerator is not asked again.
  expect(h.state().task!.demand).toMatchObject({ step: 'denominator' });
  expect(screen.queryByText(/Step 1: Identify the Numerator/)).toBeNull();
  h.press('4'); h.press('Check Answer');
  expect(h.state().task!.demand).toMatchObject({ step: 'shade', barParts: 4, partsShaded: 0 });
  h.shadeTo(4); h.press('Submit Fraction');
  expect(h.attempts().at(-1)).toMatchObject({ correct: false, miss: 'shaded_all', response: 'Shaded 4 of 4 parts' });
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ step: 'shade', partsShaded: 0 });
  h.shadeTo(3); h.press('Submit Fraction');
  expect(h.attempts().map(a => [a.correct, a.miss])).toEqual([[false, 'chose_denominator'], [false, 'chose_numerator'],
    [false, 'shaded_all'], [true, undefined]]);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  // The next item opens at step one with nothing picked or shaded.
  expect(h.state().task).toMatchObject({ itemId: 'q1' });
  expect(h.state().task!.demand).toMatchObject({ step: 'numerator', printedFraction: '2/5' });
  expect(seam.writes).toHaveLength(0);
});

it('completes once and submits once under an evaluation provider', () => {
  seam.evaluationContext = { lesson: 'test' };
  const items = [fraction('q0', 1, 2), fraction('q1', 2, 3)];
  const h = mount('identify', items);
  h.solve(items[0]); h.dispatch('advance'); h.confirmVisible();
  h.solve(items[1]); h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.writes).toHaveLength(1);
  expect(seam.writes[0]).toMatchObject({ success: true, metrics: { type: 'fraction-bar', challengeType: 'identify', correctCount: 2 } });
  expect(h.view.container.textContent).toContain('summary');
});
