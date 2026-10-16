import type { PrimitiveEvaluationResult } from '../evaluation/types';

/**
 * Per-challenge first-try results from an evaluation, found the way the
 * backend finds them (problems.py `_find_challenge_results`): the first array
 * in studentWork or metrics whose entries all carry a numeric `attempts`.
 * A challenge counts as first-try when attempts === 1 and it was not marked
 * incorrect. Undefined when the primitive reports no per-challenge results.
 */
export function firstTryResults(result: Pick<PrimitiveEvaluationResult, 'studentWork' | 'metrics'>): boolean[] | undefined {
  for (const src of [result.studentWork, result.metrics] as unknown[]) {
    if (!src || typeof src !== 'object') continue;
    for (const v of Object.values(src as Record<string, unknown>)) {
      if (
        Array.isArray(v) && v.length > 0
        && v.every((e) => e && typeof e === 'object' && typeof (e as { attempts?: unknown }).attempts === 'number')
      ) {
        // Mirrors backend `first_try_of`: right on the first attempt, unaided;
        // workspace outcomes carry `solved`, not `correct`; uncertain items are left out.
        type Entry = { attempts: number; correct?: boolean; solved?: boolean; assisted?: boolean; uncertain?: boolean };
        const flags = (v as Entry[]).filter((e) => !e.uncertain).map((e) => e.attempts === 1
          && e.correct !== false && e.solved !== false && !e.assisted);
        return flags.length ? flags : undefined;
      }
    }
  }
  return undefined;
}
