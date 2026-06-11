// Client-side fetch for the per-student generation context.
// Called from useExhibitSession between the curator brief and the manifest.
//
// HARD RULE: this fetch must never block or fail lesson generation — every
// failure path (network, auth, timeout, available:false) resolves to null
// and the pipeline proceeds unpersonalized, exactly as it did before.

import { authApi } from '@/lib/authApiClient';
import type { StudentGenerationContext } from './types';

export interface GenerationContextParams {
  studentId: string;
  topic: string;
  gradeLevel: string;
  /** Freeform subject from the curator brief (e.g. "Mathematics") */
  subject?: string;
  objectives: Array<{ id: string; text: string; verb?: string }>;
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
      objectives: params.objectives.map(o => ({ id: o.id, text: o.text, verb: o.verb })),
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
