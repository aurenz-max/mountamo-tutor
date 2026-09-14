// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LearningResponsePreview from './LearningResponsePreview';
import type { PrimitiveEvaluationResult } from '../evaluation/types';
const result = { attemptId: 'client-reference', subskillId: 'NBT004-01-b', primitiveType: 'place-value-chart',
  lessonContext: { gradeLevel: '4', curriculumSubject: 'MATHEMATICS' },
  studentWork: { learningResponses: ['a', 'b'].map(itemId => ({ itemId, phase: 'say_value', challenge: 'Say the digit value',
    expected: 'forty', observed: 'forty', verdict: 'affirmed', source: 'voice', priorCorrections: 0,
    hearTapsSoFar: 0, support: 'Other assistance unknown' })) } } as PrimitiveEvaluationResult;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('disables score-only inference and shows response-linked drafts as unsaved', async () => {
  const view = render(<LearningResponsePreview result={{ ...result, studentWork: {} }} />);
  expect(screen.getByText('Preview strengths and support')).toHaveProperty('disabled', true);
  view.unmount();
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, kind: 'strength',
    summary: 'Tentative success on digit values', teachingImplication: 'Try a fresh example', checkNext: 'Check without correction', evidenceItemIds: ['a', 'b'] }) });
  vi.stubGlobal('fetch', fetch);
  render(<LearningResponsePreview result={result} />);
  fireEvent.click(screen.getByText('Preview strengths and support'));
  expect(await screen.findByText('Unsaved observation preview')).toBeTruthy();
  expect(screen.getAllByText(/unverified transcription; judge affirmed/)).toHaveLength(2);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body).action).toBe('distillLearningObservation');
});
