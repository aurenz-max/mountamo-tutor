import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn().mockResolvedValue({ stored: true }) } }));
import { authApi } from '@/lib/authApiClient';
import { captureMisconception, resetMisconceptionCaptureLatch } from './captureMisconception';
import type { PrimitiveEvaluationResult } from '../types';
import { itemsFromChallenges } from '../../primitives/visual-primitives/math/placeValueScript';
import { placeValueVoiceObservation } from '../../primitives/visual-primitives/math/placeValueEvidence';
const item = itemsFromChallenges([{ id: 'a', targetNumber: 342, highlightedDigitPlace: 1 }], { mode: 'compare', tier: 'medium' }).items[1];
const observation = placeValueVoiceObservation(item, 'four');
const result = { primitiveType: 'place-value-chart', skillId: 'NBT003-02', subskillId: 'NBT003-02-a', success: false, score: 40, attemptId: 'synthetic', metrics: { type: 'place-value-chart', challengeType: 'compare' }, diagnosisEvidence: { challengeSummary: observation.challenge, expected: observation.expected, observed: observation.observed } } as unknown as PrimitiveEvaluationResult;
beforeEach(() => { vi.clearAllMocks(); resetMisconceptionCaptureLatch(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, misconceptionText: 'The student gives the bare digit for worth.', confidence: 'high', evidenceTier: 'judge' }) })); });
it('transports actual skill and subskill identity to capture and qualifies only failure', async () => {
  await captureMisconception({ ...result, success: true, score: 100 }, { sessionId: 's', subskillId: result.subskillId });
  expect(fetch).not.toHaveBeenCalled();
  await captureMisconception(result, { sessionId: 's', subskillId: result.subskillId });
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({ primitive_type: 'place-value-chart', scope: 'skill', skill_id: 'NBT003-02', subskill_id: 'NBT003-02-a' }));
});
it('does not write on honest abstention', async () => {
  const onStatus = vi.fn();
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ abstain: true, reason: 'No reliable transcript' }) } as Response);
  await captureMisconception(result, { sessionId: 's', subskillId: result.subskillId, onStatus });
  expect(authApi.post).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith({ stage: 'abstained', message: 'No hypothesis saved: No reliable transcript' });
});
it('explains a successful activity without calling the LLM', async () => {
  const onStatus = vi.fn();
  await captureMisconception({ ...result, success: true, score: 100 }, { sessionId: 's', onStatus });
  expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ stage: 'skipped' }));
  expect(fetch).not.toHaveBeenCalled();
});
it('does not claim storage when the backend declines it', async () => {
  vi.mocked(authApi.post).mockResolvedValueOnce({ stored: false });
  const onStatus = vi.fn();
  await captureMisconception(result, { sessionId: 's', subskillId: result.subskillId, onStatus });
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'failed' }));
});
it('persists phase evidence and teaching guidance while preserving the selected eval mode', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ abstain: false,
    misconceptionText: 'Possible confusion.', confidence: 'medium', evidenceTier: 'structured',
    teachingImplication: 'Contrast place and value.', checkNext: 'Use a fresh example.' }) } as Response);
  const phases = [{ itemId: 'item-1', phase: 'name-place', challenge: 'Name the place',
    expected: 'tens', observed: 'forty', support: 'Correction observation' }];
  await captureMisconception({ ...result, diagnosisEvidence: { ...result.diagnosisEvidence!, phases } },
    { sessionId: 'phase-test', subskillId: result.subskillId, gradeLevel: '3' });
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).params).toMatchObject({ evalMode: 'compare', evidence: { phases } });
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({
    grade: '3', learning_observation: expect.objectContaining({ phases, teachingImplication: 'Contrast place and value.' }),
  }));
});
