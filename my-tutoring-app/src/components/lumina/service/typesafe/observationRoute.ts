import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { runObservation, type Assessed, type ObservationKind } from './observationKinds';

/**
 * The HTTP edge of an observation kind: bound the body, validate it against the kind's
 * own contract, run it. The server owns the model credentials; a kind added to
 * `observationKinds` gets its route from here rather than from a copied handler.
 */
export function observationRoute<Request, Decision extends Assessed>(
    kind: ObservationKind<Request, Decision>, valid: (body: unknown) => body is Request,
    limits: { maxBytes: number; noun: string }) {
  const Noun = limits.noun[0].toUpperCase() + limits.noun.slice(1);
  return async function POST(request: NextRequest) {
    const raw = await request.text();
    if (raw.length > limits.maxBytes) return NextResponse.json({ error: `${Noun} too large` }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: `Invalid ${limits.noun}` }, { status: 400 }); }
    if (!valid(body)) return NextResponse.json({ error: `Invalid ${limits.noun}` }, { status: 400 });
    // The caller's abort (a superseded turn) stops the upstream model call too.
    return NextResponse.json(await runObservation(kind, body, request.signal));
  };
}
