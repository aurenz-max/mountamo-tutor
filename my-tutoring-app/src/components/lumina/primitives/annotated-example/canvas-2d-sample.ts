/**
 * Client-side curve sampler for the annotated-example canvas-2d renderer.
 *
 * Curves arrive from the planner as KaTeX RHS expressions in `x`. We sample
 * them at render time using the same KaTeX-aware evaluator the algebra
 * generator uses for numeric verification, so we don't need a separate parser
 * or to push pre-computed point arrays through the generator schema.
 *
 * Points where the expression doesn't evaluate to a finite number (asymptotes,
 * domain errors) are simply skipped — `drawCurve` already handles gaps.
 */

import { tryEvaluateKatex } from '../../service/annotated-example/mathEvaluator';
import type { CurvePoint } from '../visual-primitives/math/canvas-2d/types';

/**
 * Sample `expression` at `samples + 1` evenly-spaced x values across
 * [xFrom, xTo]. Skips x values where the expression doesn't return a finite
 * number; the caller's drawCurve will treat the gap as a curve break.
 */
export function sampleCurve(
  expression: string,
  xFrom: number,
  xTo: number,
  samples = 200,
): CurvePoint[] {
  if (!expression || !Number.isFinite(xFrom) || !Number.isFinite(xTo) || xTo <= xFrom) return [];
  const step = (xTo - xFrom) / samples;
  const points: CurvePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = xFrom + i * step;
    const y = tryEvaluateKatex(expression, { x });
    if (y != null && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}
