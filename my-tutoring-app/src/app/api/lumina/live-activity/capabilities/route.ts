import { NextRequest, NextResponse } from 'next/server';
import { buildLiveActivitySpec } from '@/components/lumina/components/live-activity/liveActivitySpec';
import { isLivePrimitive } from '@/components/lumina/components/live-activity/activityContract';

/** Dev probes consume the same host registry as the browser; no copied Python catalog. */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const ids = (request.nextUrl.searchParams.get('primitives') ?? '').split(',').filter(Boolean);
  if (!ids.every(isLivePrimitive)) return NextResponse.json({ error: 'Unsupported activity' }, { status: 400 });
  return NextResponse.json(buildLiveActivitySpec(ids, request.nextUrl.searchParams.get('directVisuals') === 'true'));
}
