import { NextRequest, NextResponse } from 'next/server';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { composeDemonstration } from '@/components/lumina/service/manifest/composeDemonstration';
import type { DemonstrationEvidence } from '@/components/lumina/components/live-activity/demo/demonstrationEvidence';

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const optional = (v: unknown, max: number) => v === undefined || v === null || v === '' || text(v, max);
const scalar = (v: unknown) => (typeof v === 'string' && v.length <= 400) || (typeof v === 'number' && Number.isFinite(v));

function validEvidence(e: any): e is DemonstrationEvidence {
  return !!e && text(e.primitiveId, 80) && optional(e.evalMode, 80) && text(e.task, 400)
    && (e.values === undefined || (typeof e.values === 'object' && Object.values(e.values).length <= 16 && Object.values(e.values).every(v => typeof v === 'number')))
    && typeof e.facts === 'object' && e.facts !== null && Object.keys(e.facts).length <= 16 && Object.values(e.facts).every(scalar)
    && Array.isArray(e.attempts) && e.attempts.length <= 6
    && e.attempts.every((a: any) => text(a?.response, 200) && (a.correct === null || typeof a.correct === 'boolean') && text(a.source, 20));
}

/**
 * The diagnosis log (LA-15): one record per authored demonstration, keyed by primitive and
 * mode, with no learner identity. Recurring diagnoses on a primitive are the candidates for a
 * code-classified pattern (LIVE_TEACHING_MOVES.md, "discovered, not predicted"). Stdout
 * always; a JSONL file on a dev machine, where the filesystem persists.
 */
async function logDiagnosis(record: Record<string, unknown>) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...record });
  console.info(`[demonstration-log] ${line}`);
  if (process.env.NODE_ENV === 'production') return;
  try {
    const dir = path.join(process.cwd(), 'logs', 'demonstrations');
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`), line + '\n');
  } catch { /* telemetry never breaks a lesson */ }
}

/** Author a composed demonstration from the mounted primitive's evidence. `none` still returns the diagnosis. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const lesson = body?.lesson;
  const evidence = body?.evidence;
  if (!lesson || !text(lesson.objectiveText, 600) || !text(lesson.grade, 4) || !text(lesson.topic, 300) || !text(lesson.gradeLevel, 40)
      || !validEvidence(evidence) || !optional(body.note, 300))
    return NextResponse.json({ error: 'Invalid demonstration request' }, { status: 400 });
  const started = Date.now();
  try {
    const result = await composeDemonstration(
      { topic: lesson.topic, grade: lesson.grade, gradeLevel: lesson.gradeLevel, objectiveText: lesson.objectiveText },
      evidence, body.note || undefined);
    const elapsedMs = Date.now() - started;
    await logDiagnosis({ primitiveId: evidence.primitiveId, evalMode: evidence.evalMode, grade: lesson.grade, task: evidence.task,
      responses: evidence.attempts, note: body.note || null, diagnosis: result.diagnosis, kind: result.kind,
      ...(result.kind === 'demonstration' ? { piece: result.script.piece, operation: result.script.operation, values: result.script.values } : {}),
      elapsedMs });
    return NextResponse.json({ ...result, elapsedMs });
  } catch (error) {
    console.error('[demonstration] authoring failed:', error);
    return NextResponse.json({ error: 'Demonstration authoring failed' }, { status: 502 });
  }
}
