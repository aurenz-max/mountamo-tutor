// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), studentId: '42' }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { get: mocks.get } }));
vi.mock('../contexts/StudentContext', () => ({ useStudent: () => ({ studentId: mocks.studentId, ready: true, isAnonymous: false }) }));
import SavedLearningObservations from './SavedLearningObservations';
import { sampleLearningObservations } from '../evaluation/learningObservations.fixture';
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.studentId = '42'; });
it('distinguishes older diagnoses from missing learning history', async () => {
  mocks.get.mockResolvedValue({ observations: [], legacyCount: 2 });
  render(<SavedLearningObservations studentId={42} />);
  expect(await screen.findByText(/2 earlier diagnosis record/)).toBeTruthy();
});

it('shows saved phase evidence, refreshes after capture, and clears a different owner’s view', async () => {
  mocks.get.mockResolvedValue({ observations: [{ ...sampleLearningObservations[0],
    summary: 'Stored hypothesis', evidence: [{ attemptId: 'ref', task: 'Name a place',
      response: 'Numeric value', support: 'Correction', phase: 'name-place' }] }] });
  const view = render(<SavedLearningObservations studentId={42} />);
  expect(await screen.findByText('Stored hypothesis')).toBeTruthy();
  expect(screen.getByText('Phase: name-place')).toBeTruthy();
  expect(screen.queryByText('Sample profile')).toBeNull();
  mocks.get.mockResolvedValue({ observations: [] });
  act(() => { window.dispatchEvent(new Event('lumina-learning-observations-updated')); });
  await waitFor(() => expect(screen.queryByText('Stored hypothesis')).toBeNull());
  expect(mocks.get).toHaveBeenCalledTimes(2);
  mocks.studentId = '43'; view.rerender(<SavedLearningObservations studentId={42} />);
  expect(screen.getByText(/Sign in as the profile owner/)).toBeTruthy();
  expect(mocks.get).toHaveBeenCalledTimes(2);
});
