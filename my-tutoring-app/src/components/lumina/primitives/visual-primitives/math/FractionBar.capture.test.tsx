// @vitest-environment jsdom
/**
 * The misconception evidence fraction-bar attaches at submit (`fractionBarEvidence.ts`, read by the remediation loop in
 * `service/math/fractionBarRemediation.ts`), captured on the teaching workspace under an evaluation provider: every
 * checked response is recorded as it happened, and the submitted score and success are the bar's own.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';

const seam = vi.hoisted(() => ({ submissions: [] as unknown[][] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'bar',
  conversation: [], sendText: vi.fn(),
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', async () => {
  const React = await import('react');
  return { useEvaluationContext: () => ({ lesson: 'test' }), usePrimitiveEvaluation: () => {
    const [hasSubmitted, setSubmitted] = React.useState(false);
    return { hasSubmitted, elapsedMs: 0, submittedResult: null,
      submitResult: (...args: unknown[]) => { seam.submissions.push(args); setSubmitted(true); return null; } };
  } };
});
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import FractionBar, { type FractionBarData } from './FractionBar';
import { isDiagnosableFailure, type DiagnosisEvidence } from '../../../evaluation/diagnosis/types';

beforeEach(() => { seam.submissions = []; });
afterEach(() => { cleanup(); });
const fraction = (id: string, n: number, d: number) => ({ id, numerator: n, denominator: d,
  numeratorChoices: [n, d, n - 1, d + 1], denominatorChoices: [d, n, d + 1, d + 2] });

function mount(data: FractionBarData) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const view = render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FractionBar data={{ ...data, instanceId: 'bar' }} runtimePlanItemId="plan-bar" runtimeEvalMode={data.challengeType} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  let last = '';
  const dispatch = (name: 'retry' | 'advance') => {
    const s = runtime.getSnapshot(), a = s.affordances.find(x => x.action.type === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    last = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: last, instanceId: s.instanceId!, itemId: s.task!.itemId,
      expectedRevision: s.revision, action: a!.action }); });
  };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(last); }); };
  const click = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const answer = (value: number) => { click(String(value)); click('Check Answer'); };
  const shade = (count: number) => {
    act(() => { fireEvent.click(view.container.querySelector(`[data-pip-object="part-${count - 1}"]`)!); });
    click('Submit Fraction');
  };
  return { answer, shade, retry: () => dispatch('retry'), next };
}

it('records swapped first responses as factual evidence without changing the submitted score or success', () => {
  const h = mount({ title: 'Build', description: 'Shade', challengeType: 'build', supportTier: 'medium', showPartitionNumerals: false,
    challenges: [fraction('fraction-bar-1', 3, 4), fraction('fraction-bar-2', 4, 5), fraction('fraction-bar-3', 2, 6)] });

  h.answer(4); h.retry(); h.answer(3); h.answer(4); h.shade(3); h.next(); // numerator swap
  h.answer(5); h.retry(); h.answer(4); h.answer(5); h.shade(4); h.next(); // numerator swap
  h.answer(2); h.answer(6); h.shade(6); h.retry(); h.shade(2); h.next(); // shaded the denominator

  expect(seam.submissions).toHaveLength(1);
  const [success, score, , work, , evidence] = seam.submissions[0] as [boolean, number, unknown, { studentWork: { responses: unknown[] } }, unknown, DiagnosisEvidence];
  expect(success).toBe(true);
  expect(score).toBeGreaterThanOrEqual(60);
  expect(evidence.firstResponseScore).toBe(0);
  expect(evidence.phases?.map(p => [p.itemId, p.phase, p.expected, p.observed])).toEqual([
    ['fraction-bar-1', 'numerator', '3', '4'], ['fraction-bar-2', 'numerator', '4', '5'],
    ['fraction-bar-3', 'build', 'shaded 2 of 6 parts', 'shaded 6 of 6 parts']]);
  expect(evidence.phases?.[0].support).toMatch(/Attempt 1 .*support tier medium/);
  expect(work.studentWork.responses).toHaveLength(12);
  expect(isDiagnosableFailure({ success, score }, evidence)).toBe(true);
});

it('attaches no evidence when every response was correct first time', () => {
  const h = mount({ title: 'Build', description: 'Shade', challengeType: 'build', showPartitionNumerals: false,
    challenges: [fraction('fraction-bar-1', 2, 3)] });
  h.answer(2); h.answer(3); h.shade(2); h.next();
  expect(seam.submissions).toHaveLength(1);
  expect(seam.submissions[0][5]).toBeUndefined();
});
