// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LearningObservationsPanel from './LearningObservationsPanel';
import { buildLearningContext } from '../evaluation/learningObservations';
import { sampleActivity, sampleLearningObservations } from '../evaluation/learningObservations.fixture';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('keeps samples opt-in, exposes evidence and previews scope changes without network writes', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<LearningObservationsPanel />);
  expect(screen.queryByText('Sample profile')).toBeNull();
  fireEvent.click(screen.getByText('Explore a sample learning profile'));
  expect(screen.getByText('2 of 4 observations included')).toBeTruthy();
  expect(screen.getByText('Response: Two hundred')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Activity scope'), { target: { value: '3' } });
  expect(screen.getByText('1 of 4 observations included')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Include relevant observations in this preview'));
  expect(screen.getByText('0 of 4 observations included')).toBeTruthy();
  fireEvent.click(screen.getByText('Evaluation context'));
  expect(screen.getByText(/Judge the current response against/, { selector: 'p' })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it('omits resolved and mismatched observations and preserves provenance without old answers in evaluator context', () => {
  const context = buildLearningContext(sampleLearningObservations, sampleActivity);
  expect(context.generation.observations.map(o => o.id)).toEqual(['sample-place-names', 'sample-digit-values']);
  expect(context.evaluation.observations[0].evidenceAttemptIds).toEqual(['sample-attempt-1', 'sample-attempt-2']);
  expect(JSON.stringify(context.evaluation)).not.toContain('Two hundred');
  expect(buildLearningContext(sampleLearningObservations, { ...sampleActivity, subject: 'LANGUAGE_ARTS' }).generation.observations).toEqual([]);
  expect(buildLearningContext(sampleLearningObservations, { ...sampleActivity, subskillId: 'unrelated' }).generation.observations).toEqual([]);
});
