import { NextRequest, NextResponse } from 'next/server';
import { SUPPORT_PURPOSES, generateSupportImage, type SupportPurpose } from '@/components/lumina/service/live-support/gemini-support-image';

const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Development-only. Draws the tutor's described picture and checks it before the host may show it. */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || !SUPPORT_PURPOSES.includes(body.purpose) || !text(body.concept, 120)
      || !text(body.description, 600) || !text(body.gradeLevel, 40)
      || !Array.isArray(body.counts) || body.counts.length > 6 || !body.counts.every((n: unknown) => Number.isInteger(n)))
    return NextResponse.json({ error: 'Invalid picture request' }, { status: 400 });
  try {
    const result = await generateSupportImage({ purpose: body.purpose as SupportPurpose, concept: body.concept.trim(),
      description: body.description.trim(), counts: body.counts, gradeLevel: body.gradeLevel });
    if (!result) return NextResponse.json({ error: 'No picture was drawn.' }, { status: 502 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Live support image] Generation failed:', error);
    return NextResponse.json({ error: 'The picture could not be drawn.' }, { status: 502 });
  }
}
