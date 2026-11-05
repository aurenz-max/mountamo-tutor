/**
 * Geometry primitive — a to-scale figure built from named points.
 *
 * The model writes coordinates in the problem's units and the sides, angles
 * and regions to mark. parseGeometryFigure rejects any numeric label that
 * disagrees with the coordinates, so a "5 cm" side is 5 units long in the
 * drawing and the figure cannot contradict the work.
 */

import { Type, ThinkingLevel, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { parseGeometryFigure } from '../../../primitives/annotated-example/geometryFigure';
import { generateVerifiedStep } from '../content-review';
import type { GeometryStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

const S = { type: Type.STRING };
const N = { type: Type.NUMBER };
const obj = (properties: Record<string, Schema>): Schema => ({ type: Type.OBJECT, properties, required: Object.keys(properties) });

const GEOMETRY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    unit: { type: Type.STRING, description: 'Length unit of the coordinates, e.g. cm, m, units' },
    points: { type: Type.ARRAY, items: obj({ name: S, x: N, y: N }) },
    polygons: { type: Type.ARRAY, items: obj({ vertices: { type: Type.ARRAY, items: S }, label: S, shade: { type: Type.STRING, enum: ['none', 'a', 'b'] } }) },
    segments: { type: Type.ARRAY, items: obj({ from: S, to: S, label: S, style: { type: Type.STRING, enum: ['solid', 'dashed'] } }) },
    angles: { type: Type.ARRAY, items: obj({ vertex: S, from: S, to: S, label: S, kind: { type: Type.STRING, enum: ['right', 'arc'] } }) },
    caption: { type: Type.STRING, description: 'One short line under the figure. Must not state a value the student has not been shown yet.' },
    altText: S,
    result: { type: Type.STRING, description: 'What this move establishes, as KaTeX or a short phrase' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['unit', 'points', 'polygons', 'segments', 'angles', 'caption', 'altText', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateGeometryStep(ctx: StepGeneratorContext): Promise<{ content: GeometryStepContent; annotations: StepAnnotations; result: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `Generate a GEOMETRY step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${buildStepContextPrefix(ctx)}

The figure is drawn TO SCALE from your coordinates, and code measures every side, angle and area. A numeric label that disagrees with the coordinates is rejected.
- points: name each vertex with a capital letter (A, B, C...). x and y are in the problem's unit (unit field). A 5 cm side must be 5 units long. Put right angles on the axes: a right triangle with legs 5 and 12 is C(0,0), A(0,5), B(12,0). An L-shape 6 wide and 5 tall with a 3 by 3 notch is (0,0),(6,0),(6,2),(3,2),(3,5),(0,5).
- polygons: each shape as its vertices in order; its sides are drawn automatically. label is empty, a region name ("A"), or its area with units only when this move has found it. shade "a" or "b" picks out a part, e.g. the two rectangles of a split shape; otherwise "none".
- segments: a side you want to label, or an extra line (a split line, height, diagonal). Use style "dashed" for split lines and heights. label is the side's true length with units ("5 cm"), "?" or a letter ("c", "x") for an unknown, or empty.
- angles: kind "right" draws the square corner mark (label empty). kind "arc" draws an arc with a label: its true size ("40°"), "?" or a letter.
The labeled givens must be enough to solve the problem: every length the work uses is labeled, or the work finds it from labeled lengths (a notch width 6 - 4 = 2 needs both 6 and 4 labeled). Label only what the student knows at this move: the givens, and values found in this move or earlier moves. A value found in a later move is "?" or its letter here, never its number. Do not label every side; label the ones this move uses.
Unused arrays are empty. Every point a polygon, segment or angle names must be in points.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: GEOMETRY_SCHEMA,
    },
  });
  const raw = response.text;
  if (!raw) throw new Error('Geometry generator returned empty');
  const data = JSON.parse(raw);
  const figure = parseGeometryFigure(data);
  return {
    content: { type: 'geometry', figure, caption: String(data.caption ?? ''), altText: String(data.altText ?? '') },
    annotations: extractAnnotations(data),
    result: String(data.result ?? ''),
  };
}

export const geometryPrimitive: PrimitiveDef = {
  id: 'geometry',
  whenToUse: 'A to-scale geometry figure with named points: triangles, rectangles, composite shapes, split lines, side lengths, right-angle and angle marks. Code checks every labeled length, angle and area against the drawing. Use it whenever the problem is about a shape (area, perimeter, missing side or angle, Pythagoras). The figure carries the givens, so the problem text need not list every dimension or say how to split the shape.',
  // parseGeometryFigure has checked every label against the coordinates, so a
  // review that times out does not discard the figure.
  generate: (ctx) => generateVerifiedStep(ctx, generateGeometryStep, { keepOnReviewTimeout: true }),
  extractResult: (_c, explicit) => explicit ?? '',
};
