/**
 * Persistence for coverage evals — one JSON row per eval appended to
 * `qa/lesson-coverage/evals.jsonl` (the same append-only shape the Lesson
 * Bench scoreboard uses), plus one structured console line so a deploy
 * without a writable disk still leaves a queryable trace in its logs.
 *
 * Best-effort by contract: a failed write costs one row, never a lesson.
 * `scripts/lesson-coverage.mjs report` aggregates the file.
 */
import { LESSON_COVERAGE_EVALS_FILE, lessonCoverageEvalDir } from './config';
import type { LessonCoverageEval } from './types';

export function coverageLogLine(ev: LessonCoverageEval): string {
  const objectives = ev.objectives
    .map((o) => `${o.objectiveId} ${o.category} ${o.severity} (${o.assessmentCount} item${o.assessmentCount === 1 ? '' : 's'})${o.notes ? ` — ${o.notes.slice(0, 140)}` : ''}`)
    .join(' | ');
  const constraints = ev.detectedConstraints.map((c) => `${c.type}${c.instanceId ? `@${c.instanceId}` : ''}`).join(',');
  return (
    `[lesson-coverage] status=${ev.status} coverage=${ev.overallObjectiveCoverage.toFixed(2)} blocking=${ev.blockingFailure} ` +
    `lesson=${ev.lessonId} source=${ev.meta.source} topic="${ev.meta.topic}" grade=${ev.meta.grade ?? ev.meta.gradeLevel} ` +
    `objectives=${ev.meta.objectiveCount} covered=${ev.meta.objectivesFullyCovered} uncovered=${ev.meta.objectivesUncovered} ` +
    `latency=${ev.meta.latencyMs}ms${ev.meta.usedSchemaFallback ? ` schemaFallback="${ev.meta.schemaError ?? ''}"` : ''}${ev.meta.error ? ` error="${ev.meta.error}"` : ''}` +
    `${constraints ? ` constraints=${constraints}` : ''} :: ${objectives}`
  );
}

export interface PersistOptions {
  dir?: string;
  /** Skip the file append (tests, or a caller that stores the eval elsewhere). */
  file?: boolean;
  console?: boolean;
}

/** Never throws. Returns the file path written, or null. */
export async function persistLessonCoverageEval(ev: LessonCoverageEval, opts: PersistOptions = {}): Promise<string | null> {
  if (opts.console !== false) {
    const line = coverageLogLine(ev);
    if (ev.status === 'fail' || ev.status === 'error') console.warn(line);
    else console.info(line);
  }
  if (opts.file === false) return null;
  try {
    const { appendFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const dir = opts.dir ?? lessonCoverageEvalDir();
    await mkdir(dir, { recursive: true });
    const file = join(dir, LESSON_COVERAGE_EVALS_FILE);
    await appendFile(file, `${JSON.stringify(ev)}\n`, 'utf8');
    return file;
  } catch (err) {
    console.warn('[lesson-coverage] could not append eval row (ignored):', err instanceof Error ? err.message : err);
    return null;
  }
}
