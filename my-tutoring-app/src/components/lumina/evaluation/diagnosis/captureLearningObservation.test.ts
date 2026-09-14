// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ post: vi.fn(), user: { uid: 'owner' } }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: mocks.post } }));
vi.mock('@/lib/firebase', () => ({ auth: { get currentUser() { return mocks.user; } } }));
import { captureLearningObservation, resetLearningObservationCaptureLatch } from './captureLearningObservation';
import type { PrimitiveEvaluationResult } from '../types';
const result = { attemptId: 'attempt', primitiveType: 'place-value-chart', success: true, score: 100,
  subskillId: 'NBT004-01-b', skillId: 'NBT004-01', metrics: { challengeType: 'compare' },
  lessonContext: { gradeLevel: '4', curriculumSubject: 'MATHEMATICS' }, studentWork: { learningResponses: ['a', 'b'].map(itemId => ({
    itemId, phase: 'say_value', challenge: 'Say value', expected: 'forty', observed: 'forty', verdict: 'affirmed',
    source: 'voice', priorCorrections: 0, hearTapsSoFar: 0, support: 'Other assistance unknown',
  })) } } as unknown as PrimitiveEvaluationResult;
const draft = { abstain: false, kind: 'strength', summary: 'Narrow success.', teachingImplication: 'Similar task.', checkNext: 'Fresh item.', evidenceItemIds: ['a', 'b'] };
beforeEach(() => { vi.clearAllMocks(); resetLearningObservationCaptureLatch(); mocks.user = { uid: 'owner' };
  mocks.post.mockResolvedValue({ stored: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => draft })); });
it('captures successful evidence once, preserves references, and reports stored only after confirmation', async () => {
  const statuses: string[] = [];
  const refresh = vi.fn(); window.addEventListener('lumina-learning-observations-updated', refresh);
  try {
    await Promise.all([1, 2].map(() => captureLearningObservation(result, { studentId: '42', onStatus: s => statuses.push(s.stage) })));
    expect(fetch).toHaveBeenCalledTimes(1); expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith('/api/student-profile/learning-observations', expect.objectContaining({
      source_attempt_id: 'attempt', kind: 'strength', responses: (result.studentWork as { learningResponses: unknown }).learningResponses,
    }));
    expect(statuses).toEqual(['distilling', 'saving', 'stored']); expect(refresh).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener('lumina-learning-observations-updated', refresh); }
});
it('does not gate on aggregate success and abstains without writes on scores or model abstention', async () => {
  await captureLearningObservation({ ...result, studentWork: {} }, { studentId: '42' });
  expect(fetch).not.toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ abstain: true, reason: 'No coherent pattern' }) } as Response);
  await captureLearningObservation({ ...result, success: false, score: 67 }, { studentId: '42' });
  expect(fetch).toHaveBeenCalledOnce(); expect(mocks.post).not.toHaveBeenCalled();
});
it('allows retry after failed storage and never saves after owner changes', async () => {
  mocks.post.mockResolvedValueOnce({ stored: false });
  const stages: string[] = [];
  await captureLearningObservation(result, { studentId: '42', onStatus: s => stages.push(s.stage) });
  expect(stages).not.toContain('stored');
  await captureLearningObservation(result, { studentId: '42' });
  expect(mocks.post).toHaveBeenCalledTimes(2);
  vi.mocked(fetch).mockImplementationOnce(async () => {
    mocks.user = { uid: 'other' };
    return { ok: true, json: async () => draft } as Response;
  });
  await captureLearningObservation({ ...result, attemptId: 'another' }, { studentId: '42' });
  expect(mocks.post).toHaveBeenCalledTimes(2);
});
