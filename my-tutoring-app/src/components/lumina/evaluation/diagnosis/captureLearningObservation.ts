import { authApi } from '@/lib/authApiClient';
import { auth } from '@/lib/firebase';
import type { PrimitiveEvaluationResult } from '../types';
import { eligibleLearningResponses, type LearningObservationDraft } from '../learningResponseEvidence';
import type { CaptureStatus } from './captureMisconception';

const captures = new Set<string>();
export function resetLearningObservationCaptureLatch() { captures.clear(); }

/** Shared post-submission path. Evidence opt-in, not primitive names or scores. */
export async function captureLearningObservation(result: PrimitiveEvaluationResult, opts: {
  studentId?: string; subskillId?: string; gradeLevel?: string; onStatus?: (status: CaptureStatus) => void;
}): Promise<LearningObservationDraft | null> {
  const report = (stage: CaptureStatus['stage'], message: string) => opts.onStatus?.({ stage, message });
  const work = result.studentWork as { learningResponses?: unknown } | undefined;
  const evidence = eligibleLearningResponses(work?.learningResponses);
  if (!evidence.length) { report('skipped', 'No corroborating successful response evidence. A score alone cannot establish a strength or support observation.'); return null; }
  const subskillId = opts.subskillId ?? result.subskillId;
  const ownerUid = auth.currentUser?.uid;
  const grade = opts.gradeLevel ?? result.lessonContext?.gradeLevel;
  const subject = result.lessonContext?.curriculumSubject;
  const evalMode = result.metrics?.evalMode ?? (result.metrics as unknown as { challengeType?: string })?.challengeType;
  if (!ownerUid || !opts.studentId || !result.attemptId || !subskillId || ['unknown', 'free-form'].includes(subskillId) || !grade || !subject || !evalMode) {
    report('skipped', 'A signed-in learner, activity reference and resolved curriculum scope are required.'); return null;
  }
  const key = `${opts.studentId}:${result.primitiveType}:${result.attemptId}`;
  if (captures.has(key)) return null;
  captures.add(key);
  try {
    report('distilling', 'Examining successful responses and recorded assistance…');
    const response = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'distillLearningObservation', params: { evidence } }) });
    if (!response.ok) throw new Error(`Observation distiller HTTP ${response.status}`);
    const draft: LearningObservationDraft = await response.json();
    if (draft.abstain) { report('abstained', `No strength or support observation saved: ${draft.reason}`); return draft; }
    if (auth.currentUser?.uid !== ownerUid) throw new Error('Signed-in learner changed during observation capture; nothing saved.');
    report('saving', 'Waiting for confirmation that the response observation was saved…');
    const saved = await authApi.post<{ stored?: boolean }>('/api/student-profile/learning-observations', {
      primitive_type: result.primitiveType, source_attempt_id: result.attemptId,
      subskill_id: subskillId, skill_id: result.skillId, subject, grade, eval_mode: evalMode,
      kind: draft.kind, summary: draft.summary, teachingImplication: draft.teachingImplication,
      checkNext: draft.checkNext, evidenceItemIds: draft.evidenceItemIds, responses: evidence,
    });
    if (saved?.stored !== true) throw new Error('Backend did not confirm observation storage');
    report('stored', 'Strength/support observation saved. The profile is refreshing.');
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('lumina-learning-observations-updated'));
    return draft;
  } catch (error) {
    captures.delete(key);
    report('failed', error instanceof Error ? error.message : 'Observation capture failed; activity submission is separate.');
    return null;
  } finally {
    if (captures.size > 500) captures.delete(captures.values().next().value!);
  }
}
