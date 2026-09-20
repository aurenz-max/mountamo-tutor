import { NextRequest, NextResponse } from 'next/server';
import { journeyDescriptor } from '@/components/lumina/components/live-activity/liveJourneySpec';
import { isLivePrimitive } from '@/components/lumina/components/live-activity/activityContract';

/**
 * The journey declaration for one primitive, for `run_live_runtime.py`.
 *
 * Deliberately NOT part of the capability envelope: that envelope is what the model
 * is given, and a harness fact has no business in it. This is the same module the
 * mounted driver loads, so the descriptor and the resolver functions cannot drift.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const id = request.nextUrl.searchParams.get('primitive') ?? '';
  if (!isLivePrimitive(id)) return NextResponse.json({ error: 'Unsupported activity' }, { status: 400 });
  return NextResponse.json(journeyDescriptor(id));
}
