import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn().mockResolvedValue({}) } }));
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
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ abstain: true, reason: 'No reliable transcript' }) } as Response);
  await captureMisconception(result, { sessionId: 's', subskillId: result.subskillId });
  expect(authApi.post).not.toHaveBeenCalled();
});
