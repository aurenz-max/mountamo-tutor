/**
 * Diagram primitive — a labeled figure or geometric setup.
 *
 * Renders validated mathematical data as an SVG figure with callouts.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { parseDiagramVisual, numberLineFromTicks } from '../../../primitives/annotated-example/diagramVisual';
import { generateVerifiedStep } from '../content-review';
import type { DiagramStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

const numeric = { type: Type.NUMBER };
const visualShape = (kind: string, fields: Record<string, Schema>): Schema => ({
  type: Type.OBJECT,
  properties: { kind: { type: Type.STRING, enum: [kind] }, ...fields },
  required: ['kind', ...Object.keys(fields)],
});

type VisualKind = 'number-line' | 'groups' | 'fraction-bar' | 'drawing';
const VISUAL_SCHEMAS: Record<VisualKind, Schema> = {
  'number-line': visualShape('number-line', { min: numeric, max: numeric,
    divisions: { type: Type.INTEGER }, startTick: { type: Type.INTEGER },
    jumpTicks: { type: Type.ARRAY, items: { type: Type.INTEGER } } }),
  groups: visualShape('groups', { counts: { type: Type.ARRAY, items: { type: Type.INTEGER } }, itemLabel: { type: Type.STRING } }),
  'fraction-bar': visualShape('fraction-bar', { numerator: { type: Type.INTEGER }, denominator: { type: Type.INTEGER } }),
  drawing: visualShape('drawing', { shapes: { type: Type.ARRAY, items: {
    type: Type.OBJECT, properties: {
      kind: { type: Type.STRING, enum: ['line', 'rect', 'circle', 'text'] },
      x: numeric, y: numeric, x2: numeric, y2: numeric, width: numeric, height: numeric, radius: numeric,
      text: { type: Type.STRING },
    }, required: ['kind', 'x', 'y', 'x2', 'y2', 'width', 'height', 'radius', 'text'],
  } } }),
};

function diagramSchema(kind: VisualKind): Schema {
  return {
  type: Type.OBJECT,
  properties: {
    visual: VISUAL_SCHEMAS[kind],
    altText: { type: Type.STRING, description: 'Accessibility alt text' },
    result: { type: Type.STRING, description: 'KaTeX expression or conclusion from the diagram' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['visual', 'altText', 'result', ...ANNOTATIONS_REQUIRED],
  };
}

async function generateDiagramStep(
  ctx: StepGeneratorContext,
  kind: VisualKind,
): Promise<{ content: DiagramStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a DIAGRAM step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

Supply a REAL structured visual of kind "${kind}" for this move:
- number-line: min, max, divisions (1-40 equal intervals), startTick (integer tick index from min), jumpTicks (up to 12 signed integer interval counts). Code derives the exact distances and landing points from the scale. On a 0-to-1 ninths scale, six jumps of one ninth MUST be jumpTicks=[1,1,1,1,1,1], never rounded decimal distances. On a 20-to-40 scale with 20 divisions, start at 24 using startTick=4. Keep every jump within the scale. Include ONLY jumps in this move, not future moves. Empty jumpTicks is allowed to mark the startTick point. Choose enough divisions to place all required points on ticks.
- groups: counts (one count per group, up to 10 groups of 0-20 dots), itemLabel (singular, e.g. apple). Code draws exactly these counts. Use this for equal-group/counting models, not arbitrary drawing shapes.
- fraction-bar: numerator shaded parts and denominator total equal parts (1-24). Use for a single fraction model.
- drawing: geometry or other schematics, using up to 40 line/rect/circle/text shapes in a 640x360 canvas. Coordinates and all shape extents must fit the canvas. Lines use x,y,x2,y2; rectangles x,y,width,height; circles x,y,radius; text x,y,text. Include real shapes, not text alone. Keep labels short and inside the drawing. Use drawing only when the mathematical models above do not fit.
Supply exactly the required fields for the selected visual kind. For drawing shapes, unused numeric fields must be 0 and unused text must be an empty string, never null. Supply concise alt text that agrees with the rendered visual. Numerical visuals draw all their own group labels, scale labels, and partition counts automatically. For a drawing, put required labels in its text shapes. Never add a second full explanation or invent dimensions.
Include a result — the key conclusion or expression derived from the diagram.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: diagramSchema(kind),
    },
  });

  const text = response.text;
  if (!text) throw new Error('Diagram generator returned empty');
  const data = JSON.parse(text);

  const visual = kind === 'number-line' ? numberLineFromTicks(data.visual) : parseDiagramVisual(data.visual);
  const annotations = extractAnnotations(data);
  // The representation establishes this invariant: the start is a position,
  // not a move. Do not ask an LLM to invent the opposite as a "misconception".
  if (visual.kind === 'number-line') annotations.misconceptions = visual.jumps.length
    ? 'Start at the given number. Count the moves after it, not the starting mark.'
    : 'Read the scale first. Neighboring marks are not always one whole apart.';
  return {
    content: { type: 'diagram', visual, imagePrompt: '', altText: data.altText, labels: [] },
    annotations,
    result: data.result,
  };
}

export const diagramPrimitive: PrimitiveDef = {
  id: 'diagram',
  whenToUse: 'A real structured visual: number-line jumps, counted groups, fraction bars, or labeled geometry. Prefer it for concrete elementary explanations. Do not repeat a figure already provided unless this step adds a new visual action.',
  generate: async (ctx) => {
    // Select representation separately so the content call has a monomorphic
    // schema: its mathematical fields are required, never nullable guesses.
    const selection = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `Choose the simplest diagram representation for this specific worked move.
${buildStepContextPrefix(ctx)}
Use number-line for positions/jumps along a scale; groups for counted objects or equal groups; fraction-bar for part of one whole; drawing for geometry or other schematics. Return the kind only.`,
      config: { responseMimeType: 'application/json', responseSchema: {
        type: Type.OBJECT, properties: { kind: { type: Type.STRING, enum: ['number-line', 'groups', 'fraction-bar', 'drawing'] } }, required: ['kind'],
      } },
    });
    const kind = JSON.parse(selection.text || '{}').kind as VisualKind;
    if (!Object.prototype.hasOwnProperty.call(VISUAL_SCHEMAS, kind)) throw new Error('Invalid visual selection');
    return generateVerifiedStep(ctx, context => generateDiagramStep(context, kind));
  },
  extractResult: (_c, explicit) => explicit ?? '',
};
