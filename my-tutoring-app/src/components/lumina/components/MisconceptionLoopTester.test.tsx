// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePrimitiveEvaluation } from '../evaluation/hooks/usePrimitiveEvaluation';

const mocks = vi.hoisted(() => ({ get: vi.fn(), submit: vi.fn(), capture: vi.fn(), learningCapture: vi.fn(), context: vi.fn(), anonymous: false }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'test-token' } } }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { get: mocks.get } }));
// The launch step: the backend signs this learner's observations once; the tester forwards the packet verbatim.
vi.mock('../service/studentContext/fetchGenerationContext', () => ({ fetchGenerationContext: mocks.context }));
vi.mock('../contexts/StudentContext', () => ({ useStudent: () => ({ studentId: '123', ready: true, isAnonymous: mocks.anonymous }) }));
vi.mock('../evaluation/api/evaluationApi', () => ({ submitEvaluationToBackend: mocks.submit }));
vi.mock('../evaluation/diagnosis/captureMisconception', () => ({ captureMisconception: mocks.capture }));
vi.mock('../evaluation/diagnosis/captureLearningObservation', () => ({ captureLearningObservation: mocks.learningCapture }));
vi.mock('../primitives/visual-primitives/math/PlaceValueChart', () => ({
  default: ({ data }: { data: { instanceId: string; skillId: string; subskillId: string; exhibitId: string } }) => {
    const evaluation = usePrimitiveEvaluation({ primitiveType: 'place-value-chart', ...data });
    return <button onClick={() => evaluation.submitResult(false, 0, { type: 'place-value-chart', evalMode: 'compare' } as never)}>Complete chart</button>;
  },
}));
import Tester from './MisconceptionLoopTester';

beforeEach(() => {
  mocks.anonymous = false;
  mocks.get.mockResolvedValue({ status: 'not-recorded', revision: null, scopeCompatible: false });
  mocks.submit.mockResolvedValue({}); mocks.capture.mockResolvedValue(null);
  mocks.learningCapture.mockResolvedValue(null);
  mocks.context.mockResolvedValue({ available: true, objectives: [], learningObservations: { payload: '{"v":1}', signature: 'a'.repeat(64) } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
    title: 'Place value', challengeType: 'compare', supportTier: 'medium', challenges: [],
  } }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('pins authenticated generation and carries its stable instance and curriculum through the real evaluation provider', async () => {
  render(<Tester onBack={() => {}} />);
  fireEvent.click(screen.getByText('Generate first activity'));
  await screen.findByText('Complete chart');
  const options = vi.mocked(fetch).mock.calls[0][1]!;
  expect(options.headers).toMatchObject({ Authorization: 'Bearer test-token' });
  const request = JSON.parse(options.body as string);
  expect(request.params.config).toMatchObject({ targetEvalMode: 'compare', difficulty: 'medium',
    objectiveGrade: '4', skillId: 'NBT004-01', subskillId: 'NBT004-01-b' });
  expect(request.learningObservations).toEqual({ payload: '{"v":1}', signature: 'a'.repeat(64) });
  expect(mocks.context.mock.calls[0][0]).toMatchObject({ studentId: '123', includePersona: false,
    objectives: [{ subskillId: 'NBT004-01-b', skillId: 'NBT004-01', grade: '4' }] });
  expect(screen.getByText('Generate next activity')).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByText('Complete chart'));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
  expect(mocks.submit.mock.calls[0][0]).toMatchObject({ instanceId: request.params.instanceId,
    skillId: 'NBT004-01', subskillId: 'NBT004-01-b', lessonContext: { gradeLevel: '4', curriculumSubject: 'MATHEMATICS' } });
  await waitFor(() => expect(screen.getByText('Generate next activity')).toHaveProperty('disabled', false));
  expect(mocks.capture).toHaveBeenCalledOnce();
  expect(mocks.learningCapture).toHaveBeenCalledWith(expect.objectContaining({ instanceId: request.params.instanceId }),
    expect.objectContaining({ studentId: '123', subskillId: 'NBT004-01-b' }));
  expect(screen.getByText(/No verification receipt/)).toBeTruthy();
});

it('reports submission failure and does not enable the next activity or retry automatically', async () => {
  mocks.submit.mockRejectedValue(new Error('offline'));
  render(<Tester onBack={() => {}} />);
  fireEvent.click(screen.getByText('Generate first activity')); await screen.findByText('Complete chart');
  fireEvent.click(screen.getByText('Complete chart'));
  await screen.findByText(/Failed — do not repeat/);
  expect(screen.getByText('Generate next activity')).toHaveProperty('disabled', true);
  expect(mocks.submit).toHaveBeenCalledOnce();
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.learningCapture).not.toHaveBeenCalled();
});

it('requires sign-in before exposing generation', () => {
  mocks.anonymous = true;
  render(<Tester onBack={() => {}} />);
  expect(screen.getByText(/Sign in to use/)).toBeTruthy();
  expect(screen.queryByText('Generate first activity')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it('shows the capture outcome after the real evaluation provider dispatches diagnosis', async () => {
  mocks.capture.mockImplementationOnce(async (_result, options) => {
    options.onStatus({ stage: 'abstained', message: 'No reliable transcript was captured.' });
    return { abstain: true };
  });
  render(<Tester onBack={() => {}} />);
  fireEvent.click(screen.getByText('Generate first activity'));
  fireEvent.click(await screen.findByText('Complete chart'));
  expect(await screen.findByText(/Observation capture: abstained/)).toBeTruthy();
});
