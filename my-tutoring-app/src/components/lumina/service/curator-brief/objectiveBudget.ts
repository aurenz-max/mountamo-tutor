/**
 * objectiveBudget — how many learning objectives one lesson may carry, by band.
 *
 * Each objective gets its own 2-4 components, so the objective count is what
 * sets lesson length: a three-objective preschool lesson built ten components
 * for a four-year-old (2026-09-16, "orange excavators and red dump trucks").
 * This is a BAND LOAD cap — attention span at the age, ruled by the user — not a
 * scope ceiling, so it binds regardless of what the curator brief asks for.
 *
 *   toddler / preschool → 1
 *   kindergarten        → 2
 *   everything above    → 3
 *
 * Applies to lessons whose objectives the SYSTEM chooses (the curator brief, the
 * recommended fill). Objectives a person picked by hand in the Lesson Builder
 * are theirs and are not trimmed.
 */
import { normalizeObjectiveGrade } from '../generation/resolveGenerationContext';

const PRE_K = /^(toddler|preschool|pre[-\s]?k(indergarten)?|pk|nursery)$/i;

export const maxObjectivesForGrade = (gradeLevel: string | null | undefined): number => {
  const g = (gradeLevel ?? '').trim();
  if (PRE_K.test(g)) return 1;
  if (normalizeObjectiveGrade(g) === 'K') return 2;
  return 3;
};

/** Objectives beyond the band's budget are dropped from the END: the brief's
 *  ordering rule puts the concrete, do-something objective first, so the kept
 *  prefix is the one a young child can start on. */
export const capObjectivesForGrade = <T>(objectives: T[], gradeLevel: string | null | undefined): T[] => {
  const max = maxObjectivesForGrade(gradeLevel);
  return objectives.length > max ? objectives.slice(0, max) : objectives;
};
