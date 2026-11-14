import { authApi } from '@/lib/authApiClient';
import { auth } from '@/lib/firebase';
import type { PrimitiveEvaluationResult } from '../types';
import { hasItemRecord, type AttemptNote } from '../../service/attemptNotes/notes';

const captures = new Set<string>();
export function resetAttemptNoteCaptureLatch() { captures.clear(); }

/** Where the attempt is filed, as the submission resolved it. Names are for the note writer only. */
export interface AttemptNoteHome {
  subskillId?: string; subject?: string; gradeLevel?: string;
  unit?: string; skill?: string; subskill?: string;
}

/**
 * Shared post-submission path, beside the misconception and observation captures: a small model reads the
 * attempt's record and the backend files its note under unit / skill / subskill. Needs a signed-in learner, a
 * resolved curriculum home and the workspace's per-item record; anything else is a skip with no model call.
 * Never throws and never blocks the submission.
 */
export async function captureAttemptNote(result: PrimitiveEvaluationResult, home: AttemptNoteHome): Promise<AttemptNote | null> {
  const subskillId = home.subskillId ?? result.subskillId;
  const subject = home.subject ?? result.lessonContext?.curriculumSubject;
  const ownerUid = auth.currentUser?.uid;
  if (!ownerUid || !result.attemptId || !subskillId || ['unknown', 'free-form'].includes(subskillId) || !subject
    || !hasItemRecord(result.studentWork)) return null;
  const key = `${ownerUid}:${result.primitiveType}:${result.attemptId}`;
  if (captures.has(key)) return null;
  captures.add(key);
  try {
    const metrics = { ...(result.metrics as unknown as Record<string, unknown>) };
    delete metrics.componentTallies;
    const evalMode = (metrics.evalMode ?? metrics.challengeType) as string | undefined;
    const response = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'writeAttemptNote', params: { record: {
        activity: result.primitiveType, mode: evalMode, subject, unit: home.unit, skill: home.skill, subskill: home.subskill,
        scoreOutOf10: Math.round(result.score) / 10, metrics, work: result.studentWork } } }) });
    if (!response.ok) throw new Error(`Attempt note HTTP ${response.status}`);
    const note: AttemptNote | null = await response.json();
    if (!note) return null;
    if (auth.currentUser?.uid !== ownerUid) return null;
    await authApi.post('/api/student-profile/attempt-notes', {
      primitive_type: result.primitiveType, source_attempt_id: result.attemptId, subject,
      grade: home.gradeLevel ?? result.lessonContext?.gradeLevel, subskill_id: subskillId,
      eval_mode: typeof evalMode === 'string' ? evalMode : undefined, score: result.score,
      did: note.did, signals: note.signals,
    });
    return note;
  } catch (error) {
    captures.delete(key);
    console.warn('[AttemptNote] capture failed (the submission is unaffected):', error);
    return null;
  } finally {
    if (captures.size > 500) captures.delete(captures.values().next().value!);
  }
}
