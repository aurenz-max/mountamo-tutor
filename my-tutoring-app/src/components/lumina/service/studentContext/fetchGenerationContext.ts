// Client-side fetch for the per-student generation context.
// Called from useExhibitSession between the curator brief and the manifest.
//
// HARD RULE: this fetch must never block or fail lesson generation — every
// failure path (network, auth, timeout, available:false) resolves to null
// and the pipeline proceeds unpersonalized, exactly as it did before.

import { authApi } from '@/lib/authApiClient';
import type { StudentGenerationContext, StudentPersona } from './types';

export interface GenerationContextParams {
  studentId: string;
  topic: string;
  gradeLevel: string;
  /** Freeform subject from the curator brief (e.g. "Mathematics") */
  subject?: string;
  /**
   * Objectives may carry a known curriculum subskill (multi-subskill launches
   * like daily-session blocks). When present, the backend skips embedding
   * retrieval for that objective and keys straight into the student's β.
   */
  objectives: Array<{ id: string; text: string; verb?: string; subskillId?: string; skillId?: string }>;
  /**
   * A single known curriculum node for the whole lesson (single-subskill launch
   * from the curriculum browser). Applied to every objective that doesn't carry
   * its own subskillId — so the brief's generated objectives resolve without a
   * retrieval sweep.
   */
  curriculumContext?: { skillId: string; subskillId: string };
  /**
   * When false, the backend skips rebuilding the persona (and its attempt-log
   * read). Pass false when the caller already fetched the persona via
   * {@link fetchStudentPersona} — it's identical across calls for a student.
   * The caller is then responsible for injecting the cached persona into the
   * returned context. Defaults true.
   */
  includePersona?: boolean;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Fetch the student's generation context, or null if anything goes wrong.
 * The timeout bounds how long personalization may delay the manifest.
 */
export async function fetchGenerationContext(
  params: GenerationContextParams,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<StudentGenerationContext | null> {
  const studentIdNum = parseInt(params.studentId, 10);
  if (!Number.isFinite(studentIdNum)) return null;

  const request = authApi.post<StudentGenerationContext>(
    '/api/student-profile/generation-context',
    {
      student_id: studentIdNum,
      topic: params.topic,
      grade_level: params.gradeLevel,
      subject: params.subject,
      objectives: params.objectives.map(o => ({
        id: o.id,
        text: o.text,
        verb: o.verb,
        subskill_id: o.subskillId,
        skill_id: o.skillId,
      })),
      curriculum_context: params.curriculumContext
        ? {
            skill_id: params.curriculumContext.skillId,
            subskill_id: params.curriculumContext.subskillId,
          }
        : undefined,
      include_persona: params.includePersona,
    },
  );

  const timeout = new Promise<null>(resolve =>
    setTimeout(() => resolve(null), timeoutMs),
  );

  try {
    const result = await Promise.race([request, timeout]);
    if (!result || !result.available) {
      if (result?.reason) {
        console.log(`[StudentContext] Personalization unavailable: ${result.reason}`);
      }
      return null;
    }
    console.log(
      `[StudentContext] Generation context: ${result.objectives.filter(o => o.tier === 'exact').length}/${result.objectives.length} objectives resolved`,
    );
    return result;
  } catch (error) {
    console.warn('[StudentContext] Generation context fetch failed (continuing unpersonalized):', error);
    return null;
  }
}

/**
 * Lightweight persona-only fetch, used BEFORE the curator brief is generated so
 * the brief can greet the student by name and tie into their last session.
 *
 * The persona (name, interests, streak, last session) is pure identity — it
 * does NOT depend on the brief's objectives, unlike the IRT objective state.
 * The backend returns the persona alone when `objectives` is empty (no
 * curriculum retrieval runs), so this is a cheap profile read.
 *
 * Same HARD RULE as fetchGenerationContext: never blocks or fails the lesson —
 * every failure path resolves to null and the brief greets generically.
 */
export async function fetchStudentPersona(
  studentId: string,
  topic: string,
  timeoutMs: number = 5000,
): Promise<StudentPersona | null> {
  const studentIdNum = parseInt(studentId, 10);
  if (!Number.isFinite(studentIdNum)) return null;

  // Empty objectives ⇒ backend skips retrieval and returns persona only.
  const request = authApi.post<StudentGenerationContext>(
    '/api/student-profile/generation-context',
    { student_id: studentIdNum, topic, objectives: [] },
  );

  const timeout = new Promise<null>(resolve =>
    setTimeout(() => resolve(null), timeoutMs),
  );

  try {
    const result = await Promise.race([request, timeout]);
    return result?.studentProfile ?? null;
  } catch (error) {
    console.warn('[StudentContext] Persona fetch failed (continuing without greeting):', error);
    return null;
  }
}
