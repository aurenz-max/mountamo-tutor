/**
 * Coverage eval → Lesson Bench vocabulary.
 *
 * `LESSON_BENCH_CHECKS` already declares `Q4 Coverage` as `code+llm` and the
 * scorer leaves it to Tier B. This adapter expresses the coverage verdict as
 * that check so a bench row and a runtime eval speak one sentence: Q4 passes
 * when every evaluated objective is ASSESSED_SUFFICIENTLY; every deduction
 * cites the objective's first dedicated block; an errored eval is an unknown,
 * never a fail.
 */
import type { LessonBenchScores } from '../lessonBench/lessonPackage';
import type { LessonCoverageEval } from './types';

export const COVERAGE_CHECK_ID = 'Q4';

export interface LessonBenchCoverageSignals {
  checks: Record<string, 0 | 1>;
  citations: NonNullable<LessonBenchScores['citations']>;
  unknowns: NonNullable<LessonBenchScores['unknowns']>;
}

export function coverageToLessonBenchSignals(ev: LessonCoverageEval, firstBlockOf: (objectiveId: string) => string | undefined): LessonBenchCoverageSignals {
  if (ev.status === 'error') {
    return { checks: {}, citations: [], unknowns: [{ checkId: COVERAGE_CHECK_ID, note: `coverage eval errored: ${ev.meta.error ?? 'unknown'}` }] };
  }
  const citations: LessonBenchCoverageSignals['citations'] = [];
  const unknowns: LessonBenchCoverageSignals['unknowns'] = [];
  for (const o of ev.objectives) {
    if (o.category === 'ASSESSED_SUFFICIENTLY') continue;
    if (o.category === 'NOT_EVALUATED') {
      unknowns.push({ checkId: COVERAGE_CHECK_ID, note: `${o.objectiveId}: ${o.notes ?? 'not evaluated'}` });
      continue;
    }
    const instanceId = firstBlockOf(o.objectiveId);
    if (!instanceId) {
      unknowns.push({ checkId: COVERAGE_CHECK_ID, note: `${o.objectiveId} ${o.category} but no dedicated block to cite` });
      continue;
    }
    citations.push({ instanceId, checkId: COVERAGE_CHECK_ID, note: `${o.objectiveId} ${o.category}${o.notes ? `: ${o.notes}` : ''}` });
  }
  const evaluated = ev.objectives.filter((o) => o.category !== 'NOT_EVALUATED');
  const checks: Record<string, 0 | 1> = evaluated.length ? { [COVERAGE_CHECK_ID]: citations.length === 0 ? 1 : 0 } : {};
  return { checks, citations, unknowns };
}
