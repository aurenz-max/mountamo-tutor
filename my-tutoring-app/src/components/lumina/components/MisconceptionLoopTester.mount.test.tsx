// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'test-token' } } }));
vi.mock('@/lib/authApiClient', () => ({ authApi: {
  get: vi.fn().mockResolvedValue({ status: 'not-recorded' }),
  // The launch step: the backend signs this learner's observations once. Unavailable here
  // (no context) is the ordinary unpersonalized fallback, not a failure this test exercises.
  post: vi.fn().mockResolvedValue({ available: false }),
} }));
vi.mock('../contexts/StudentContext', () => ({ useStudent: () => ({ studentId: '123', ready: true, isAnonymous: false }) }));
import Tester from './MisconceptionLoopTester';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('mounts the second representation from the same curriculum scope with safe bridge metadata', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
    title: 'Bridge blocks', description: 'Read the mat', gradeBand: '4-5', numberValue: 2305, supportTier: 'medium',
    learningAdaptation: { move: 'contrast_block_count_and_worth', status: 'targeted', comparisonCount: 2,
      source: 'saved-observation' },
    challenges: [2305, 5206].map(targetNumber => ({ type: 'read_blocks', targetNumber, instruction: 'Read', hint: 'Look' })),
  } }) }));
  render(<Tester onBack={() => {}} />);
  fireEvent.click(screen.getByText('Generate blocks from the same hypothesis'));
  expect(await screen.findByLabelText('Block mat')).toBeTruthy();
  expect(screen.getByText(/saved observation selected a block count\/worth contrast/)).toBeTruthy();
  const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(request.params).toMatchObject({ componentId: 'base-ten-blocks', config: {
    targetEvalMode: 'read_blocks', difficulty: 'medium', subskillId: 'NBT004-01-b', objectiveGrade: '4' } });
  expect(screen.getByText('Generate blocks from the same hypothesis')).toHaveProperty('disabled', true);
});

it('mounts the real generated chart, judged runner and microphone panel inside the real tutor providers', async () => {
  // Only API boundaries are stubbed: mocking the chart or context hooks hides
  // the missing-provider runtime crash this test guards against.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
    title: 'Provider regression chart', description: 'Compare digit values',
    challengeType: 'compare', supportTier: 'medium',
    challenges: [2258, 3997, 9027].map((targetNumber, index) => ({
      id: `pvc-${index + 1}`, targetNumber, highlightedDigitPlace: index === 0 ? 2 : 1,
      minPlace: 0, maxPlace: 3, placeNameChoices: [], digitValueChoices: [],
    })),
  } }) }));
  render(<Tester onBack={() => {}} />);
  fireEvent.click(screen.getByText('Generate first activity'));
  expect(await screen.findByText('Provider regression chart')).toBeTruthy();
  expect(screen.getByText('Tap the microphone to start.')).toBeTruthy();
  expect(screen.getByText('Generate next activity')).toHaveProperty('disabled', true);
});
