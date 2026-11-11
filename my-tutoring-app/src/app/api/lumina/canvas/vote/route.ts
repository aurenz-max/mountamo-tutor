/**
 * The pilot vote (USER 2026-11-11): the pilot student's thumbs up or down on a pilot canvas at the end of a lesson.
 *
 * Up runs `canvas-check --spec=<id> --promote`: every problem is played both ways again, and on a pass the canvas moves
 * from the pilot tier to the library (the generated index changes and `next dev` reloads it). Down records the reasons
 * and holds the canvas out of lessons until `canvas-check` passes its spec again (`pilotVotes.heldCanvasIds`).
 *
 * Development only: promotion rewrites source files, which only the developer's machine can do.
 */
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { appendVote, isPilotStudent } from '@/components/lumina/service/core/agent-canvas/pilotVotes';
import { findCanvas } from '@/components/lumina/service/core/agent-canvas/canvasCandidates';

export const runtime = 'nodejs';

const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;
const PROMOTE_TIMEOUT_MS = 5 * 60_000;

function promote(id: string): Promise<{ ok: boolean; log: string }> {
  return new Promise(done => {
    execFile(process.execPath, ['scripts/canvas-check.mjs', `--spec=${id}`, '--promote'],
      { cwd: process.cwd(), timeout: PROMOTE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const log = `${stdout}${stderr}`.split('\n').filter(l => /^(problem|PASS|BLOCKED|PROMOTED|PILOT|NOT|advisory| - )/.test(l.trim()) || /Error/.test(l)).join('\n').slice(-4000);
        done({ ok: !error && /PROMOTED:/.test(stdout), log });
      });
  });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Votes run on the development server only.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const canvasId = typeof body?.canvasId === 'string' ? body.canvasId : '';
  const vote = body?.vote;
  const studentId = body?.studentId == null ? '' : String(body.studentId);
  if (!ID.test(canvasId) || (vote !== 'up' && vote !== 'down')) return NextResponse.json({ error: 'need canvasId and vote (up or down)' }, { status: 400 });
  if (!isPilotStudent(studentId)) return NextResponse.json({ error: `student ${studentId || '(none)'} is not in the canvas pilot` }, { status: 403 });
  const found = findCanvas(canvasId);
  if (!found?.pilot) return NextResponse.json({ error: found ? `${canvasId} is already in the library` : `${canvasId} is not a pilot canvas` }, { status: 400 });
  if (!existsSync(resolve(process.cwd(), 'qa/canvas/specs', canvasId, 'spec.json'))) return NextResponse.json({ error: `no spec for ${canvasId}` }, { status: 400 });

  const record = {
    canvasId, vote, studentId, at: new Date().toISOString(),
    ...(Array.isArray(body?.reasons) ? { reasons: (body.reasons as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, 10) } : {}),
    ...(typeof body?.note === 'string' && body.note.trim() ? { note: body.note.trim().slice(0, 2000) } : {}),
    ...(body?.outcome && typeof body.outcome === 'object' ? { outcome: body.outcome as Record<string, unknown> } : {}),
    ...(typeof body?.objective === 'string' ? { objective: body.objective } : {}),
    ...(typeof body?.topic === 'string' ? { topic: body.topic } : {}),
  } as const;

  if (vote === 'down') {
    appendVote(record);
    return NextResponse.json({ ok: true, message: `Held: ${found.entry.title} is out of lessons until its spec passes canvas-check again. Your note is in qa/canvas/votes.jsonl.` });
  }
  const result = await promote(canvasId);
  appendVote({ ...record, promote: result });
  if (!result.ok) return NextResponse.json({ error: `Not promoted: the check did not pass.\n${result.log}` }, { status: 500 });
  return NextResponse.json({ ok: true, message: `Promoted: ${found.entry.title} is in the library; every lesson can use it now.` });
}
