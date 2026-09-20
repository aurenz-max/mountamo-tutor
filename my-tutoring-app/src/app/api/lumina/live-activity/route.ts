import { NextRequest, NextResponse } from 'next/server';
import { generateComponentContent } from '@/components/lumina/service/geminiService';
import { LIVE_ADAPTERS, generatedActivityState, gradeRefusal, parseActivityRequest, validateGeneratedActivity } from '@/components/lumina/components/live-activity/activityContract';
import { getComponentById } from '@/components/lumina/service/manifest/catalog';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  let args, gradeLevel;
  try {
    const body = await request.json();
    args = parseActivityRequest(body.request);
    gradeLevel = body.gradeLevel;
    if (!['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'].includes(gradeLevel))
      throw new Error('Choose a grade from Kindergarten through Grade 5');
    // The per-family grade gate is the adapter's own `grades`, never a branch here.
    const refusal = gradeRefusal(args.primitiveId, gradeLevel);
    if (refusal) throw new Error(refusal);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
  try {
    const instanceId = `live-${crypto.randomUUID()}`;
    const result = await generateComponentContent({ componentId: args.primitiveId, instanceId,
      config: { intent: args.intent, targetEvalMode: args.mode, difficulty: 'easy', objectiveGrade: gradeLevel },
    }, args.topic, gradeLevel);
    const data = validateGeneratedActivity(args.primitiveId, result?.data);
    // Both judged-runner families are registered DI ports, so the probe plan is
    // the adapter's own — never a per-primitive branch in the harness.
    const diPlan = LIVE_ADAPTERS[args.primitiveId].teachingOwner === 'di-runner' && request.nextUrl.searchParams.get('probe') === '1'
      ? (await import('@/components/lumina/service/qa/di/diDrivePlan')).buildDiDrivePlan(args.primitiveId, { ...data }, gradeLevel)
      : undefined;
    return NextResponse.json({ instanceId, data: { ...data, instanceId },
      initialState: generatedActivityState(args.primitiveId, data), tutoring: getComponentById(args.primitiveId)?.tutoring, diPlan });
  } catch (error) {
    console.error('[Live activity] Generation failed:', error);
    return NextResponse.json({ error: 'The activity could not be generated. Please try again.' }, { status: 502 });
  }
}
