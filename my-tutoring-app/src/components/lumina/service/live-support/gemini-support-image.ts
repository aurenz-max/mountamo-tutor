/**
 * Generated support pictures for the live lesson runtime (LA-10b trial).
 *
 * The tutor writes the description; this file draws it and then CHECKS the drawing
 * before a child sees it. An image model miscounts, so a picture that claims six
 * counters and draws seven is a pedagogical lie the structured shapes cannot tell.
 * The check is a separate vision read that reports what it SEES first and only then
 * compares that with the description.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';

/**
 * A drawn picture now carries exactly one move: `illustrate`, something no shape and no
 * primitive here draws. Contrasts, worked examples and step panels became deterministic
 * shapes, which are exact and instant, so the four format words that used to live here have
 * no caller left. See `runtime/moveContract.ts` and `docs/LIVE_TEACHING_MOVES.md` (ruling 2).
 */
export const SUPPORT_PURPOSES = ['illustrate'] as const;
export type SupportPurpose = (typeof SUPPORT_PURPOSES)[number];

export interface SupportImageRequest {
  purpose: SupportPurpose;
  /** What the picture is about, in a few words: "making ten", "b and d". */
  concept: string;
  /** The literal picture: which objects, how many of each, how arranged, what is highlighted. */
  description: string;
  /** Every object count the picture shows; the checker verifies these as facts. */
  counts: number[];
  gradeLevel: string;
}

export interface SupportImageCheck {
  /** What the checker saw, with counts, before it compared anything. */
  seen: string;
  matchesDescription: boolean;
  /** Words or numerals the description did not ask for. */
  unrequestedText: boolean;
  /** Empty when the picture is usable. */
  problem: string;
}

export interface SupportImageResult {
  imageUrl: string;
  check: SupportImageCheck;
  usable: boolean;
  /** 1, or 2 when the first drawing was rejected and redrawn with the checker's complaint. */
  attempts: number;
  timing: { generateMs: number; checkMs: number };
}

const FRAMING: Record<SupportPurpose, string> = {
  illustrate: 'One scene or one collection of real things, drawn once, large and clearly separated.',
};

export async function drawSupportImage(request: SupportImageRequest, fix = ''): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: [{ role: 'user', parts: [{ text:
      `Draw a teaching picture for a ${request.gradeLevel} child about ${request.concept}.\n`
      + `Draw exactly this and nothing else: ${request.description}\n`
      + (fix ? `An earlier drawing was wrong: ${fix} Correct exactly that.\n` : '')
      + `Layout: ${FRAMING[request.purpose]}\n`
      + 'Style: flat, simple shapes with bold outlines on a plain dark navy background. Bright, friendly colours. '
      + 'Countable objects are large, the same size, clearly separated and lined up in neat rows so each one can be counted. '
      + 'Draw every stated number of objects EXACTLY. No extra objects, no decoration, no characters, no hands. '
      + 'No words, letters or numerals anywhere unless the description names a specific letter or numeral to show.' }] }],
    config: { responseModalities: ['image', 'text'], imageConfig: { aspectRatio: '16:9' } },
  });
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('image/')) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  return null;
}

const checkSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    seen: { type: Type.STRING, description: 'What the picture shows. Count every group of objects one by one and state each count.' },
    matchesDescription: { type: Type.BOOLEAN, description: 'True only if every object, count, arrangement and highlight in the description is drawn exactly.' },
    unrequestedText: { type: Type.BOOLEAN, description: 'True if the picture contains words, letters or numerals the description did not ask for.' },
    problem: { type: Type.STRING, description: 'One sentence naming the mismatch, or an empty string if there is none.' },
  },
  required: ['seen', 'matchesDescription', 'unrequestedText', 'problem'],
  propertyOrdering: ['seen', 'matchesDescription', 'unrequestedText', 'problem'],
};

export async function checkSupportImage(imageUrl: string, description: string, counts: readonly number[] = []): Promise<SupportImageCheck> {
  const [, mimeType, data] = imageUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/) ?? [];
  if (!data) throw new Error('Not an inline image');
  const result = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: [{ parts: [{ inlineData: { mimeType, data } }, { text:
      'A young child will count the objects in this teaching picture, so a wrong count teaches a wrong fact.\n'
      + 'FIRST write what you see, counting each group of objects one by one. Do not read the description until you have.\n'
      + `THEN compare with this description: "${description}"\n`
      + (counts.length ? `The object counts it must show are exactly: ${counts.join(', ')}.\n` : '')
      + 'A count that is off by even one is a mismatch. Be strict.' }] }],
    config: { responseMimeType: 'application/json', responseSchema: checkSchema },
  });
  const parsed = JSON.parse(result.text ?? '{}') as Partial<SupportImageCheck>;
  return { seen: String(parsed.seen ?? ''), matchesDescription: parsed.matchesDescription === true,
    unrequestedText: parsed.unrequestedText === true, problem: String(parsed.problem ?? '') };
}

/**
 * Draw, check, and redraw ONCE with the checker's complaint if the first drawing was wrong.
 * `usable` is the only thing the host acts on; the rest is evidence. One redraw, not a loop:
 * the child is waiting, and a second failure means words or a prepared shape serve better.
 */
export async function generateSupportImage(request: SupportImageRequest): Promise<SupportImageResult | null> {
  let generateMs = 0, checkMs = 0, fix = '';
  let last: { imageUrl: string; check: SupportImageCheck } | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = performance.now();
    const imageUrl = await drawSupportImage(request, fix);
    const drawn = performance.now();
    generateMs += drawn - started;
    if (!imageUrl) break;
    const check = await checkSupportImage(imageUrl, request.description, request.counts);
    checkMs += performance.now() - drawn;
    last = { imageUrl, check };
    const usable = check.matchesDescription && !check.unrequestedText;
    if (usable || attempt === 2) return { ...last, usable, attempts: attempt,
      timing: { generateMs: Math.round(generateMs), checkMs: Math.round(checkMs) } };
    fix = check.problem || 'It contained words or numerals that were not asked for.';
  }
  return last ? { ...last, usable: false, attempts: 2, timing: { generateMs: Math.round(generateMs), checkMs: Math.round(checkMs) } } : null;
}
