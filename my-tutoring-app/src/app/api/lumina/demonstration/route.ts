import { NextRequest, NextResponse } from 'next/server';
import { composeDemonstration } from '@/components/lumina/service/manifest/composeDemonstration';

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const optional = (v: unknown, max: number) => v === undefined || v === null || text(v, max);

/**
 * LA-15: author a composed demonstration for the step a stuck learner is missing. The model
 * picks the piece and the example; code builds every frame. `none` means no piece draws it.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parent = body?.parent;
  const need = body?.need;
  if (!parent || !need || !text(parent.componentId, 80) || !text(parent.objectiveText, 600) || !text(parent.grade, 4)
      || !text(parent.topic, 300) || !text(parent.gradeLevel, 40) || !optional(parent.evalMode, 80) || !optional(parent.currentTask, 600) || !optional(parent.lastAnswer, 300)
      || !text(need.obstacle, 300) || !optional(need.evidence, 300) || !text(need.purpose, 300))
    return NextResponse.json({ error: 'Invalid demonstration request' }, { status: 400 });
  const started = Date.now();
  try {
    const result = await composeDemonstration({
      componentId: parent.componentId, evalMode: parent.evalMode ?? undefined, objectiveText: parent.objectiveText,
      grade: parent.grade, topic: parent.topic, gradeLevel: parent.gradeLevel, currentTask: parent.currentTask ?? undefined,
      lastAnswer: parent.lastAnswer ?? undefined,
    }, { obstacle: need.obstacle, evidence: need.evidence ?? '', purpose: need.purpose });
    return NextResponse.json({ ...result, elapsedMs: Date.now() - started });
  } catch (error) {
    console.error('[demonstration] authoring failed:', error);
    return NextResponse.json({ error: 'Demonstration authoring failed' }, { status: 502 });
  }
}
