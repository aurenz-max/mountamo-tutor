/**
 * Kill switch for the shadow objective-coverage eval.
 *
 *   LUMINA_COVERAGE_EVAL=1|on|true   run after every assembled lesson
 *   LUMINA_COVERAGE_EVAL=0|off|false never run
 *   unset                            on outside production (shadow mode is a
 *                                    learning instrument; it is opted INTO in prod)
 *
 *   LUMINA_COVERAGE_EVAL_DIR         where evals.jsonl is appended
 *                                    (default <cwd>/qa/lesson-coverage)
 *
 * Read at call time, not import time, so a test or a shell can flip it.
 */
export function isLessonCoverageEvalEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.LUMINA_COVERAGE_EVAL ?? '').trim().toLowerCase();
  if (['1', 'on', 'true', 'yes'].includes(raw)) return true;
  if (['0', 'off', 'false', 'no'].includes(raw)) return false;
  return env.NODE_ENV !== 'production';
}

export function lessonCoverageEvalDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.LUMINA_COVERAGE_EVAL_DIR ?? '').trim();
  return configured || `${process.cwd()}/qa/lesson-coverage`;
}

export const LESSON_COVERAGE_EVALS_FILE = 'evals.jsonl';
