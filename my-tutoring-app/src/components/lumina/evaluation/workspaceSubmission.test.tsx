// @vitest-environment jsdom
/**
 * Handoff 19 slice 6: a workspace-bound submission waits for the scored session and carries its evidence.
 * The real `usePrimitiveEvaluation`, and end to end the real ComparisonBuilder (a plain binding that writes
 * its own evidence) on the real runtime; only the lesson's evaluation store, the exhibit, the Live context,
 * the legacy AI hook and sound are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const seam = vi.hoisted(() => ({ submitEvaluation: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn(), get: vi.fn() } }));
vi.mock('./contexts/EvaluationContext', () => ({ useEvaluationContext: () => ({ submitEvaluation: seam.submitEvaluation }) }));
vi.mock('../contexts/ExhibitContext', () => ({ useExhibitContext: () => ({ getObjectivesForComponent: () => [], manifestItems: [] }) }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'compare',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: vi.fn(), isConnected: true, isAudioPlaying: false, activePrimitiveId: 'compare' }) }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { usePrimitiveEvaluation } from './hooks/usePrimitiveEvaluation';
import { createWorkspaceSubmission, WorkspaceSubmissionContext, type ScoredWorkspaceSession, type WorkspaceSubmission } from './workspaceSubmission';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';
import ComparisonBuilder, { type ComparisonBuilderData } from '../primitives/visual-primitives/math/ComparisonBuilder';

beforeEach(() => { vi.clearAllMocks(); seam.submitEvaluation.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); });

const SESSION: ScoredWorkspaceSession = {
  diagnosisEvidence: { challengeSummary: 'workspace summary', expected: 'Activity-checked response', observed: 'Chose: 7 < 4',
    firstResponseScore: 50, phases: [{ itemId: 'n1', phase: 'compare_numbers', challenge: 'c', expected: 'e', observed: 'o', support: 's', miss: 'reversed' }] },
  learningResponses: [{ itemId: 'n1' }], teachingAttempts: [{ itemId: 'n1', miss: 'reversed' }], assistanceProvenance: 'explicit-actions-only',
};

let submit: ReturnType<typeof usePrimitiveEvaluation>['submitResult'];
function Probe() {
  submit = usePrimitiveEvaluation({ primitiveType: 'comparison-builder', instanceId: 'probe' }).submitResult;
  return null;
}
const mountProbe = (submission: WorkspaceSubmission | null) => render(submission
  ? <WorkspaceSubmissionContext.Provider value={submission}><Probe /></WorkspaceSubmissionContext.Provider> : <Probe />);
const own = { challengeSummary: 'own summary', expected: '7 > 4', observed: 'Chose <' };
const sent = () => seam.submitEvaluation.mock.calls.map(c => c[0]);

it('waits for the scored session, then sends the primitive\'s own record with the workspace evidence added', async () => {
  const submission = createWorkspaceSubmission();
  submission.expect();
  mountProbe(submission);
  act(() => { submit(true, 100, { type: 'comparison-builder' } as never, { challengeResults: ['own'] }, undefined, own); });
  expect(seam.submitEvaluation).not.toHaveBeenCalled();
  await act(async () => { submission.scored(SESSION); });
  expect(sent()).toHaveLength(1);
  const [result] = sent();
  // Recording only: success, score and metrics are the primitive's.
  expect([result.success, result.score, result.metrics.type]).toEqual([true, 100, 'comparison-builder']);
  expect(result.diagnosisEvidence).toEqual({ ...own, firstResponseScore: 50, phases: SESSION.diagnosisEvidence.phases });
  expect(result.studentWork).toMatchObject({ challengeResults: ['own'], teachingAttempts: SESSION.teachingAttempts,
    assistanceProvenance: 'explicit-actions-only' });
});

it('sends at once when the session is already scored, and a primitive with no evidence gets the workspace packet', async () => {
  const submission = createWorkspaceSubmission();
  submission.scored(SESSION);
  mountProbe(submission);
  await act(async () => { submit(true, 100, { type: 'comparison-builder' } as never); });
  expect(sent()[0].diagnosisEvidence).toEqual(SESSION.diagnosisEvidence);
});

it('a waiting submission goes out unchanged when the scope flushes, and outside a scope nothing waits', async () => {
  const submission = createWorkspaceSubmission();
  submission.expect();
  mountProbe(submission);
  act(() => { submit(false, 40, { type: 'comparison-builder' } as never, [1, 2], undefined, own); });
  await act(async () => { submission.flush(); });
  expect(sent()[0]).toMatchObject({ score: 40, studentWork: [1, 2], diagnosisEvidence: own });
  cleanup(); seam.submitEvaluation.mockClear();
  mountProbe(null);
  await act(async () => { submit(true, 100, { type: 'comparison-builder' } as never); });
  expect(sent()).toHaveLength(1);
  // A scope no runner expects (a family that submits the scored session itself) sends at once, unmerged.
  cleanup(); seam.submitEvaluation.mockClear();
  mountProbe(createWorkspaceSubmission());
  await act(async () => { submit(true, 100, { type: 'comparison-builder' } as never, undefined, undefined, own); });
  expect(sent()[0].diagnosisEvidence).toEqual(own);
});

it('end to end: a plain binding\'s wrong check reaches the lesson submission as a named miss', async () => {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const data = { title: 'Comparing', gradeBand: '1', instanceId: 'compare', challenges: [
    { id: 'n1', type: 'compare-numbers', instruction: 'Compare.', leftNumber: 7, rightNumber: 4, correctSymbol: '>' }] } as ComparisonBuilderData;
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <ComparisonBuilder data={data} runtimePlanItemId="plan" runtimeEvalMode="compare_numbers" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const act1 = (name: string) => {
    const s = runtime.getSnapshot(), a = s.affordances.find(x => x.action.type === name)!;
    const commandId = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'compare', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a.action }); });
    return commandId;
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  press('<'); press(/check/i);
  act1('retry');
  press('>'); press(/check/i);
  const advance = act1('advance');
  await act(async () => { runtime.confirmVisibleResponse(advance); });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(runtime.getSnapshot().status).toBe('completed');
  expect(sent()).toHaveLength(1);
  const [result] = sent();
  expect(result.diagnosisEvidence.phases).toEqual([expect.objectContaining({ itemId: 'n1', phase: 'compare_numbers', miss: 'reversed' })]);
  expect(result.diagnosisEvidence.firstResponseScore).toBe(0);
  expect(result.studentWork.teachingAttempts).toHaveLength(2);
});

it('every bound wrapper gives its surface a submission scope; an unbound mount gets none', async () => {
  const { withWorkspaceOnly, withTeachingWorkspace } = await import('../components/live-activity/runtime/withTeachingWorkspace');
  const { useWorkspaceSubmission } = await import('./workspaceSubmission');
  const seen: Array<boolean> = [];
  const Surface = () => { seen.push(!!useWorkspaceSubmission()); return null; };
  const Only = withWorkspaceOnly('hundreds-chart', Surface, () => 'Chart');
  const Teaching = withTeachingWorkspace('hundreds-chart', Surface, () => { seen.push(false); return null; });
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  render(<LiveRuntimeContext.Provider value={runtime}><Only runtimeEvalMode="highlight_sequence" /><Teaching runtimeEvalMode="highlight_sequence" /></LiveRuntimeContext.Provider>);
  expect(seen.slice(0, 2)).toEqual([true, true]);
  cleanup(); seen.length = 0;
  render(<Teaching runtimeEvalMode="highlight_sequence" />);
  expect(seen).toEqual([false]);
});
