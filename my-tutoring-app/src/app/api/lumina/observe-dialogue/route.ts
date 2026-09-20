import { NextRequest, NextResponse } from 'next/server';
import { observeDialogue } from '@/components/lumina/service/typesafe/observeDialogue';
import { validDialogueRequest } from '@/components/lumina/components/live-activity/runtime/dialogueContract';

/** Shared lesson observer. Server owns model credentials; response commits stay scoped in the runtime. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 12000) return NextResponse.json({ error: 'Exchange too large' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid exchange' }, { status: 400 }); }
  if (!validDialogueRequest(body)) return NextResponse.json({ error: 'Invalid exchange' }, { status: 400 });
  return NextResponse.json(await observeDialogue(body));
}
