import { NextRequest, NextResponse } from 'next/server';
import { judgeReadingRepair } from '@/components/lumina/service/literacy/reading-repair-judge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body.audioBase64 !== 'string' || body.audioBase64.length < 64 || body.audioBase64.length > 1_500_000
      || !/^[A-Za-z0-9+/=]+$/.test(body.audioBase64)
      || typeof body.text !== 'string' || body.text.length > 200 || !body.text.trim()) {
      return NextResponse.json({ error: 'A short WAV recording and printed sentence are required.' }, { status: 400 });
    }
    return NextResponse.json(await judgeReadingRepair(body.audioBase64, body.text));
  } catch {
    // Service faults are abstentions, never a failed reading verdict.
    return NextResponse.json({ status: 'uncertain', transcripts: [], mismatchIndexes: [],
      reason: 'The audio check is unavailable. Try again or continue without a score.' }, { status: 503 });
  }
}
