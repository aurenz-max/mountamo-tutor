import { NextRequest, NextResponse } from 'next/server';
import { POST as observe } from '../../observe-dialogue/route';

/** Compatibility address for saved bench probes. Lessons use the shared route. */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  return observe(request);
}
