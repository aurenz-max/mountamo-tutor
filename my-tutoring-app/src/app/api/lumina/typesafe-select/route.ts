import { NextRequest, NextResponse } from 'next/server';
import { selectPrimitives } from '@/components/lumina/service/manifest/typesafe/selectPrimitives';
import { TypeSafeError, typesafeConfigured } from '@/components/lumina/service/manifest/typesafe/typesafeClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/lumina/typesafe-select
 *
 * Dev-panel POC: run the TypeSafe primitive-selection step for a topic and
 * return the ranked catalog, per-phase-role winners and the verified shortlist
 * with eval-mode picks. Not on the production lesson path.
 *
 * Body: { topic: string, grade?: string, objectives?: string[], k?: number }
 */
export async function POST(req: NextRequest) {
  if (!typesafeConfigured()) {
    return NextResponse.json({ error: 'TYPESAFE_API_KEY is not set on the server' }, { status: 503 });
  }
  let body: { topic?: unknown; grade?: unknown; objectives?: unknown; k?: unknown; roleFilter?: unknown; focus?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  const grade = typeof body.grade === 'string' && body.grade.trim() ? body.grade.trim() : 'elementary';
  const objectives = Array.isArray(body.objectives)
    ? body.objectives.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    : undefined;
  const k = typeof body.k === 'number' && body.k >= 1 && body.k <= 20 ? Math.floor(body.k) : undefined;
  const roleFilter = body.roleFilter === 'affordances' ? 'affordances' : 'none';
  const focus = body.focus === 'objective' ? 'objective' : 'topic';

  try {
    const result = await selectPrimitives({ topic, grade, objectives, k, roleFilter, focus, signal: req.signal });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof TypeSafeError) {
      return NextResponse.json({ error: e.message, status: e.status }, { status: 502 });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
