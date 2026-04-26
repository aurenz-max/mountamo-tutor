/**
 * Graph-sketch primitive — the catalog id for what the math-primitive PRD calls
 * `canvas-2d`. Renders one or more curves on a 2D plane, with optional
 * shaded regions, labeled points, vectors, and feature badges.
 *
 * Use when the block reasons about geometric/visual structure: a function's
 * shape, two curves bounding a region, a tangent line, a vector setup, or
 * intervals where one curve dominates. Curves are sampled client-side from
 * KaTeX RHS expressions in `x` (see canvas-2d-sample.ts).
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import type { GraphSketchStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

// Flat schema — flash-lite ships malformed nested arrays for schemas above
// ~3 nesting levels (see README "Schema gotchas"). We use Nth-indexed flat
// fields and reconstruct arrays in the parser.
const GRAPH_SKETCH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    // Axes
    xLabel: { type: Type.STRING, nullable: true },
    yLabel: { type: Type.STRING, nullable: true },
    domainMin: { type: Type.NUMBER }, domainMax: { type: Type.NUMBER },
    rangeMin: { type: Type.NUMBER }, rangeMax: { type: Type.NUMBER },

    // Curves (up to 3) — provide a KaTeX RHS in terms of x (e.g. "x^2 - 4")
    curve0Expr: { type: Type.STRING, description: 'Required. KaTeX RHS in x (e.g. "x^2 - 4"). No "f(x) ="; just the body.' },
    curve0Color: { type: Type.STRING, description: '"primary" | "secondary" | "tertiary"', nullable: true },
    curve0Style: { type: Type.STRING, description: '"solid" | "dashed"', nullable: true },
    curve0Label: { type: Type.STRING, description: 'KaTeX label for the legend (e.g. "y = x^2")', nullable: true },
    curve1Expr: { type: Type.STRING, nullable: true },
    curve1Color: { type: Type.STRING, nullable: true },
    curve1Style: { type: Type.STRING, nullable: true },
    curve1Label: { type: Type.STRING, nullable: true },
    curve2Expr: { type: Type.STRING, nullable: true },
    curve2Color: { type: Type.STRING, nullable: true },
    curve2Style: { type: Type.STRING, nullable: true },
    curve2Label: { type: Type.STRING, nullable: true },

    // Shaded regions (up to 2) — area-between-curves, Riemann strips, etc.
    shade0Upper: { type: Type.STRING, description: 'KaTeX RHS — upper bound of the shaded region', nullable: true },
    shade0Lower: { type: Type.STRING, description: 'KaTeX RHS — lower bound of the shaded region', nullable: true },
    shade0From: { type: Type.NUMBER, nullable: true },
    shade0To: { type: Type.NUMBER, nullable: true },
    shade0Label: { type: Type.STRING, description: 'KaTeX label like "A = 4/3" (no $...$ wrapper)', nullable: true },
    shade1Upper: { type: Type.STRING, nullable: true },
    shade1Lower: { type: Type.STRING, nullable: true },
    shade1From: { type: Type.NUMBER, nullable: true },
    shade1To: { type: Type.NUMBER, nullable: true },
    shade1Label: { type: Type.STRING, nullable: true },

    // Key points (up to 4) — drawn as labeled markers on the canvas
    pt0X: { type: Type.NUMBER, nullable: true }, pt0Y: { type: Type.NUMBER, nullable: true }, pt0Label: { type: Type.STRING, nullable: true },
    pt1X: { type: Type.NUMBER, nullable: true }, pt1Y: { type: Type.NUMBER, nullable: true }, pt1Label: { type: Type.STRING, nullable: true },
    pt2X: { type: Type.NUMBER, nullable: true }, pt2Y: { type: Type.NUMBER, nullable: true }, pt2Label: { type: Type.STRING, nullable: true },
    pt3X: { type: Type.NUMBER, nullable: true }, pt3Y: { type: Type.NUMBER, nullable: true }, pt3Label: { type: Type.STRING, nullable: true },

    // Vectors (up to 2)
    vec0FromX: { type: Type.NUMBER, nullable: true }, vec0FromY: { type: Type.NUMBER, nullable: true },
    vec0ToX: { type: Type.NUMBER, nullable: true }, vec0ToY: { type: Type.NUMBER, nullable: true },
    vec0Label: { type: Type.STRING, nullable: true },
    vec1FromX: { type: Type.NUMBER, nullable: true }, vec1FromY: { type: Type.NUMBER, nullable: true },
    vec1ToX: { type: Type.NUMBER, nullable: true }, vec1ToY: { type: Type.NUMBER, nullable: true },
    vec1Label: { type: Type.STRING, nullable: true },

    // Feature badges — descriptive metadata, NOT drawn on the canvas
    feat0Kind: { type: Type.STRING, description: 'asymptote | intercept | maximum | minimum | inflection', nullable: true },
    feat0Label: { type: Type.STRING, nullable: true },
    feat0Value: { type: Type.STRING, nullable: true },
    feat1Kind: { type: Type.STRING, nullable: true },
    feat1Label: { type: Type.STRING, nullable: true },
    feat1Value: { type: Type.STRING, nullable: true },
    feat2Kind: { type: Type.STRING, nullable: true },
    feat2Label: { type: Type.STRING, nullable: true },
    feat2Value: { type: Type.STRING, nullable: true },

    caption: { type: Type.STRING, description: 'One-line caption above the canvas', nullable: true },
    result: { type: Type.STRING, description: 'KaTeX conclusion drawn from the graph (e.g. "A = 4/3")' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: [
    'domainMin', 'domainMax', 'rangeMin', 'rangeMax',
    'curve0Expr',
    'result',
    ...ANNOTATIONS_REQUIRED,
  ],
};

const VALID_FEATURE_KINDS = new Set(['asymptote', 'intercept', 'maximum', 'minimum', 'inflection']);
const VALID_COLORS = new Set(['primary', 'secondary', 'tertiary']);
const VALID_STYLES = new Set(['solid', 'dashed']);
const DEFAULT_COLORS = ['primary', 'secondary', 'tertiary'] as const;

async function generateGraphSketchStep(
  ctx: StepGeneratorContext,
): Promise<{ content: GraphSketchStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a CANVAS-2D graph step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

You are filling a 2D math canvas. The renderer plots curves by sampling the
expressions you provide, fills shaded regions between two curves, and draws
labeled points and vectors. Honor the PLANNER SEED — it tells you which curves
to plot, the relevant interval, which features matter, and whether a region
needs to be shaded.

## How to fill the schema

- **domainMin/Max, rangeMin/Max** — pick a window that comfortably contains every
  curve, every shaded region, and every key point. Round to integers when you can.
- **curve0Expr** is required. Provide a KaTeX RHS *in x* — "x^2 - 4", not
  "f(x) = x^2 - 4" and not "y = x^2 - 4". Add curve1Expr / curve2Expr only when
  the step genuinely needs more than one curve (e.g. two curves bounding a
  region, a function and its tangent line, a piecewise comparison).
- **curveNColor**: "primary" for the main curve, "secondary" / "tertiary" for
  supporting curves. Defaults are sensible if omitted.
- **curveNStyle**: "solid" by default; use "dashed" for tangent lines, asymptotes,
  or "what-if" comparisons.
- **shadeNUpper / shadeNLower / shadeNFrom / shadeNTo** — for area-between-curves,
  the shaded region is bounded above by upper(x) and below by lower(x) over
  [from, to]. shadeNLabel is a short KaTeX answer like "A = 4/3" — do NOT wrap
  in $...$.
- **ptNX / ptNY / ptNLabel** — labeled markers (intersections, extrema, intercepts).
  Use 1-3 of them, only when the value is genuinely informative.
- **vecNFromX/Y, vecNToX/Y** — only when the step is about vectors, displacements,
  or similar arrow-shaped quantities.
- **featNKind / featNLabel / featNValue** — short badge metadata for things you
  could not draw as a curve or marker (e.g. asymptote: "vertical asymptote" = "x=0").
  Skip when nothing fits.
- **caption** — at most one short sentence ("Region bounded by y = x² and y = 2x").
- **result** — the KaTeX conclusion the graph supports (often the same as
  shadeNLabel, but stated as a complete result like "Area = \\frac{4}{3}").

IMPORTANT: Use the GROUNDING PROSE as your source of truth for the math —
extract the actual curves, intersection points, and computed area from it.
Do NOT invent expressions or values.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: GRAPH_SKETCH_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Graph sketch generator returned empty');
  const data = JSON.parse(text);

  // ── Curves ────────────────────────────────────────────────────────
  const curves: NonNullable<GraphSketchStepContent['curves']> = [];
  for (let i = 0; i < 3; i++) {
    const expr = data[`curve${i}Expr`];
    if (!expr || typeof expr !== 'string') continue;
    const colorRaw = data[`curve${i}Color`];
    const styleRaw = data[`curve${i}Style`];
    const labelRaw = data[`curve${i}Label`];
    curves.push({
      expression: expr,
      color: VALID_COLORS.has(colorRaw) ? colorRaw : DEFAULT_COLORS[Math.min(i, DEFAULT_COLORS.length - 1)],
      style: VALID_STYLES.has(styleRaw) ? styleRaw : 'solid',
      ...(labelRaw ? { label: labelRaw } : {}),
    });
  }

  // ── Shaded regions ───────────────────────────────────────────────
  const shadedRegions: NonNullable<GraphSketchStepContent['shadedRegions']> = [];
  for (let i = 0; i < 2; i++) {
    const upper = data[`shade${i}Upper`];
    const lower = data[`shade${i}Lower`];
    const from = data[`shade${i}From`];
    const to = data[`shade${i}To`];
    if (typeof upper === 'string' && typeof lower === 'string' && typeof from === 'number' && typeof to === 'number' && to > from) {
      shadedRegions.push({
        upper, lower, from, to,
        ...(data[`shade${i}Label`] ? { label: data[`shade${i}Label`] } : {}),
      });
    }
  }

  // ── Key points ───────────────────────────────────────────────────
  const keyPoints: GraphSketchStepContent['keyPoints'] = [];
  for (let i = 0; i < 4; i++) {
    const x = data[`pt${i}X`];
    const y = data[`pt${i}Y`];
    const label = data[`pt${i}Label`];
    if (typeof x === 'number' && typeof y === 'number' && typeof label === 'string' && label) {
      keyPoints.push({ x, y, label });
    }
  }

  // ── Vectors ──────────────────────────────────────────────────────
  const vectors: NonNullable<GraphSketchStepContent['vectors']> = [];
  for (let i = 0; i < 2; i++) {
    const fx = data[`vec${i}FromX`], fy = data[`vec${i}FromY`];
    const tx = data[`vec${i}ToX`], ty = data[`vec${i}ToY`];
    if (typeof fx === 'number' && typeof fy === 'number' && typeof tx === 'number' && typeof ty === 'number') {
      vectors.push({
        from: [fx, fy],
        to: [tx, ty],
        ...(data[`vec${i}Label`] ? { label: data[`vec${i}Label`] } : {}),
      });
    }
  }

  // ── Feature badges ───────────────────────────────────────────────
  const features: GraphSketchStepContent['features'] = [];
  for (let i = 0; i < 3; i++) {
    const kind = data[`feat${i}Kind`];
    const label = data[`feat${i}Label`];
    const value = data[`feat${i}Value`];
    if (kind && VALID_FEATURE_KINDS.has(kind) && label && value) {
      features.push({
        kind: kind as GraphSketchStepContent['features'][number]['kind'],
        label,
        value,
      });
    }
  }

  // Legacy `expression` is the first curve's expression — keeps existing
  // consumers (which read `expression` directly) working.
  const expression = curves[0]?.expression ?? '';

  return {
    content: {
      type: 'graph-sketch',
      expression,
      keyPoints,
      domain: [data.domainMin, data.domainMax],
      range: [data.rangeMin, data.rangeMax],
      features,
      ...(data.xLabel ? { xLabel: data.xLabel } : {}),
      ...(data.yLabel ? { yLabel: data.yLabel } : {}),
      ...(curves.length > 0 ? { curves } : {}),
      ...(shadedRegions.length > 0 ? { shadedRegions } : {}),
      ...(vectors.length > 0 ? { vectors } : {}),
      ...(data.caption ? { caption: data.caption } : {}),
    },
    annotations: extractAnnotations(data),
    result: data.result,
  };
}

export const graphSketchPrimitive: PrimitiveDef = {
  id: 'graph-sketch',
  whenToUse:
    "A 2D graph showing one or more curves with optional shaded regions, labeled points, vectors, and feature badges. Use when the block reasons about geometric/visual structure: a function's shape (intercepts, asymptotes, extrema), two curves bounding a region (area-between-curves), a tangent or secant line, a vector or vector-field setup, or intervals where one curve dominates. Prefer this over an algebra step when the pedagogical move is 'see what the problem looks like' rather than 'transform symbols.'",
  generate: generateGraphSketchStep,
  extractResult: (_c, explicit) => explicit ?? '',
};
