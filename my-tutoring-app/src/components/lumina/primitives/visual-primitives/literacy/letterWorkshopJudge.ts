import type { LetterTemplate, TraceStroke } from './letterWorkshopGeometry';
import type { LetterEvaluationResult } from '../../../service/literacy/gemini-letter-evaluation';

export type { LetterEvaluationResult };
export const LETTER_JUDGE_VERSION = 'letter-vision-v1';

/** Letters whose two cases share a shape; case is then a size call the judge makes, not a reading. */
const SAME_SHAPE = new Set(['c', 'o', 's', 'u', 'v', 'w', 'x', 'z']);

/**
 * The judge overrides a failed geometric check only when it read the target
 * letter itself. `recognized` alone is not enough: a model told the target leans
 * toward yes, so its own reading (`writtenAs`) must agree.
 */
export function judgeAcceptsLetter(result: LetterEvaluationResult | null, template: LetterTemplate): boolean {
  if (!result || result.confidence < 60 || !result.recognized || result.score < 50) return false;
  if (result.writtenAs === template.letter) return true;
  return SAME_SHAPE.has(template.letter.toLowerCase()) && result.writtenAs.toLowerCase() === template.letter.toLowerCase();
}

/** The child's ink on the paper's writing lines, at 2x, with no template or guide on it. */
export function renderLetterInkForJudge(strokes: TraceStroke[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(2, 2);
  ctx.fillStyle = '#fffdf5';
  ctx.fillRect(0, 0, 400, 300);
  ctx.strokeStyle = '#bacfda';
  ctx.lineWidth = 1;
  for (const [y, dashed] of [[60, false], [150, true], [240, false]] as const) {
    ctx.setLineDash(dashed ? [5, 5] : []);
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(380, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#244d76';
  ctx.fillStyle = '#244d76';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const { points } of strokes) {
    if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

/** Null on any failure or after 12s; the caller then keeps its geometric verdict. */
export async function judgeLetterDrawing(strokes: TraceStroke[], template: LetterTemplate,
  challengeType: 'trace' | 'copy' | 'write'): Promise<LetterEvaluationResult | null> {
  const imageBase64 = renderLetterInkForJudge(strokes);
  if (!imageBase64) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/lumina', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ action: 'evaluateLetterDrawing',
        params: { imageBase64, targetLetter: template.letter, letterCase: template.letterCase, challengeType } }),
    });
    return res.ok ? await res.json() as LetterEvaluationResult : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
