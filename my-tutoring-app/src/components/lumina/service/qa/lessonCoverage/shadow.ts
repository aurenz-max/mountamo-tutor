/**
 * Shadow-mode entry: evaluate an assembled lesson AFTER it has been delivered,
 * persist the verdict, and never let anything here reach the student.
 *
 * Phase 1 contract (do not widen without a ruling):
 *   - runs only when `isLessonCoverageEvalEnabled()`;
 *   - never throws, never blocks, never mutates the exhibit;
 *   - no regeneration, no retries beyond the evaluator's single fallback.
 *
 * Retained for offline research. Both lesson API call sites were removed on
 * 2026-09-07; this helper is not part of lesson delivery.
 */
import type { ExhibitData } from '../../../types';
import { isLessonCoverageEvalEnabled } from './config';
import { evaluateLessonCoverage, type EvaluateOptions } from './evaluateLessonCoverage';
import { persistLessonCoverageEval, type PersistOptions } from './sink';
import type { LessonCoverageEval } from './types';

export interface ShadowOptions extends EvaluateOptions {
  persist?: PersistOptions;
}

export async function runLessonCoverageShadowEval(exhibit: ExhibitData | null | undefined, opts: ShadowOptions = {}): Promise<LessonCoverageEval | null> {
  try {
    if (!isLessonCoverageEvalEnabled()) return null;
    if (!exhibit || !Array.isArray(exhibit.orderedComponents) || exhibit.orderedComponents.length === 0) return null;
    const result = await evaluateLessonCoverage(exhibit, opts);
    await persistLessonCoverageEval(result, opts.persist);
    return result;
  } catch (err) {
    console.warn('[lesson-coverage] shadow eval failed (ignored):', err instanceof Error ? err.message : err);
    return null;
  }
}
