import { NextResponse, type NextRequest } from 'next/server';
import { observeSpokenHear } from '@/components/lumina/service/typesafe/observeSpokenHear';
import { MAX_HEAR_AUDIO, validSpokenHearRequest } from '@/components/lumina/components/live-activity/runtime/spokenHearContract';

/** `spoken_hear`: which option the learner said, from their clip, blind (gemini-decision-1). Names a miss; credits nothing. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_HEAR_AUDIO + 20000) return NextResponse.json({ error: 'Answer too large' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid answer' }, { status: 400 }); }
  if (!validSpokenHearRequest(body)) return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  return NextResponse.json(await observeSpokenHear(body, request.signal));
}
