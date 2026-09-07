/**
 * Offline shadow helper only; lesson API routes no longer invoke it.
 * Disabled by default in every environment. An explicit opt-in is only for
 * manual research; it does not reconnect automatic evaluation to lesson builds.
 * LUMINA_COVERAGE_EVAL_DIR controls the offline eval output directory.
 */
export function isLessonCoverageEvalEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.LUMINA_COVERAGE_EVAL ?? '').trim().toLowerCase();
  if (['1', 'on', 'true', 'yes'].includes(raw)) return true;
  if (['0', 'off', 'false', 'no'].includes(raw)) return false;
  return false;
}

export function lessonCoverageEvalDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.LUMINA_COVERAGE_EVAL_DIR ?? '').trim();
  return configured || `${process.cwd()}/qa/lesson-coverage`;
}

export const LESSON_COVERAGE_EVALS_FILE = 'evals.jsonl';
