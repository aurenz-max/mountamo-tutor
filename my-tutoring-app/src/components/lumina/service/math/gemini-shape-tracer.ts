import { Type, Schema } from "@google/genai";
import { ShapeTracerData, ShapeTracerChallenge } from "../../primitives/visual-primitives/math/ShapeTracer";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from "../scopeContext";
import type { PedagogicalScope } from "../scopeContext";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type EvalModeConstraint,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// Eval Mode Docs — one entry per challenge type
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'trace': {
    promptDoc:
      `"trace": Student follows a dotted outline by tapping the shape's corners in order. The app draws the shape's vertices; the LLM only sets tone + placement. K: tolerance 30-40px; Grade 1: 20-25px.`,
    schemaDescription: "'trace' (follow dotted outline)",
  },
  'connect-dots': {
    promptDoc:
      `"connect-dots": Numbered dots on canvas; student connects them in order to reveal the shape. The app places the dots forming the shape and sets the order; the LLM only sets tone + placement.`,
    schemaDescription: "'connect-dots' (guided vertex construction)",
  },
  'complete': {
    promptDoc:
      `"complete": Some sides are pre-drawn; student draws the remaining sides to finish the shape. The app pre-draws ~half the sides; the LLM only sets tone + placement.`,
    schemaDescription: "'complete' (finish partial shape)",
  },
  'draw-from-description': {
    promptDoc:
      `"draw-from-description": Student reads a text description (sides, corners, properties) and draws the shape freehand on a grid. Provide description, sides, corners, allSidesEqual, hasCurvedSides.`,
    schemaDescription: "'draw-from-description' (construct from verbal cues)",
  },
};

// ============================================================================
// Within-mode SUPPORT TIER (config.difficulty)
// ============================================================================
// Two-field contract: config.targetEvalMode says WHICH skill (the task identity —
// trace / connect-dots / complete / draw-from-description, matched to the objective
// by the manifest); config.difficulty says how much on-canvas TRACING SUPPORT the
// student gets while doing it. The tier withdraws tracing scaffolds (the ghost guide
// path, the directional ant-trail, the pulsing next-vertex cue, the stroke-order
// numbers) — it NEVER changes the target shape, its vertices, or the eval mode.
// easy = the canvas guides the stroke; hard = only the endpoints remain, the student
// traces from memory of the shape. See memory: structural-difficulty-not-numeric.

type ChallengeType = 'trace' | 'complete' | 'draw-from-description' | 'connect-dots';

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

// ============================================================================
// Within-mode STRUCTURAL DIFFICULTY (axis 2 of config.difficulty)
// ============================================================================
// The SECOND, orthogonal axis. Axis 1 (above) withdraws on-canvas tracing help
// while holding the SAME shape. Axis 2 (here) hardens the PROBLEM ITSELF by
// re-selecting the TARGET SHAPE up the geometric-complexity ladder — more
// vertices/sides = more strokes to trace, a longer dot-ordering chain, more
// missing sides to infer, a denser property description. It NEVER grows the
// canvas footprint or the on-screen size (every shape lives on the same
// 500x400 canvas at the same scale — bigger-on-screen is the banned magnitude
// path) and NEVER leaves the grade-band shape pool (K caps at 4 vertices; only
// G1 unlocks pentagon/hexagon/rhombus). Both axes share ONE source of truth
// (resolveProblemShape) folded into ONE prompt block and code-enforced in the
// post-process. See memory: structural-difficulty-not-numeric.

/**
 * Guardrail line shared by both axes of config.difficulty. Structure (the
 * target shape's vertex/side count) changes up the tier ladder; magnitude (the
 * on-canvas size / footprint) does NOT. A harder tier is a more complex SHAPE,
 * never a bigger one, and never a shape outside the grade-band pool.
 */
const TIER_GUARDRAIL =
  'A harder tier means a more geometrically COMPLEX target shape (more vertices/'
  + 'sides, more direction changes) — NOT a bigger shape on the canvas. Every shape '
  + 'stays inside the same 500x400 canvas at the same scale and inside the grade-band '
  + 'shape pool. Never inflate size or leave the pool to fake difficulty.';

/**
 * Grade-band shape pool, ordered by geometric complexity (vertex/side count).
 * K caps at 4 vertices (square/rectangle); G1 unlocks the 5-6 vertex pool plus
 * the oblique-angle rhombus. These are the ONLY shapes a tier may select — the
 * cap from the brief. Circle is intentionally excluded from the tiered ladder:
 * it has no vertices to trace / order / complete, so a circle challenge is left
 * at whatever shape the LLM produced (no structural re-selection).
 */
const SHAPE_COMPLEXITY: Record<string, number> = {
  triangle: 3,
  square: 4,
  rectangle: 4,
  rhombus: 4,
  pentagon: 5,
  hexagon: 6,
};

/**
 * The complexity ladder the tier climbs, per grade band. Index = rung.
 * K: triangle(3) -> square(4) -> [saturates at 4 — the K pool has no >4-vertex
 *    shape, so K's hard rung is the SAME square as medium; the ladder honestly
 *    saturates rather than escaping the pool].
 * G1: triangle(3) -> square(4) -> hexagon(6) [pentagon(5) is the alternate hard
 *    rung; hexagon is the top of the pool].
 */
const COMPLEXITY_LADDER: Record<'K' | '1', Record<SupportTier, string>> = {
  K: { easy: 'triangle', medium: 'square', hard: 'square' },
  '1': { easy: 'triangle', medium: 'square', hard: 'hexagon' },
};

/**
 * draw-from-description hard rung uses the RHOMBUS at G1 instead of hexagon:
 * the brief's irregular-angle contradiction (4 equal sides BUT non-square
 * corners) is the densest property load for the build-from-words task. Still in
 * the G1 pool, still 4 vertices on the same canvas — denser PROPERTIES, not a
 * bigger shape. (Other modes use vertex COUNT as the lever; draw uses property
 * load, for which rhombus's equal-sides-non-right-angles is the harder rung.)
 */
function ladderShapeForMode(
  mode: ChallengeType,
  tier: SupportTier,
  gradeBand: 'K' | '1',
): string {
  const base = COMPLEXITY_LADDER[gradeBand][tier];
  if (mode === 'draw-from-description' && gradeBand === '1' && tier === 'hard') {
    return 'rhombus';
  }
  return base;
}

interface ProblemShape {
  /** The structurally-resolved target shape for this tier+mode+grade. Clamped
   *  to the grade-band pool (the cap) and to a closed polygon (the floor). */
  targetShape: string;
  /** Soft description of what "harder" means here, folded into the prompt. */
  promptLines: string[];
}

/**
 * Axis-2 source of truth: turn one tier into one structural intent — a harder
 * TARGET SHAPE (more vertices/sides) clamped to the grade-band pool. Consumed by
 * BOTH the prompt (promptLines) and the post-process (targetShape re-selection).
 *
 * Floor: every selected shape is a closed polygon with >=3 vertices — every mode
 * is still satisfiable (trace/connect/complete/draw all need >=3 vertices), so we
 * never drop below the task's identity. Cap: SHAPE_COMPLEXITY only — never a
 * shape outside the grade band, never a bigger footprint.
 */
function resolveProblemShape(
  mode: ChallengeType,
  tier: SupportTier,
  gradeBand: 'K' | '1',
): ProblemShape {
  const targetShape = ladderShapeForMode(mode, tier, gradeBand);
  const v = SHAPE_COMPLEXITY[targetShape] ?? 3;
  const saturated = gradeBand === 'K' && tier === 'hard';

  const lines: string[] = [];
  switch (mode) {
    case 'trace':
      lines.push(
        `STRUCTURE: trace a ${targetShape} (${v} vertices, ${v} strokes)${
          tier === 'hard' ? ' — the most direction changes in the grade-band pool' : ''
        }. ${saturated ? 'The K pool caps at 4 vertices, so hard holds at the square.' : ''}`,
      );
      break;
    case 'connect-dots':
      lines.push(
        `STRUCTURE: ${v} numbered dots forming a ${targetShape} — a ${v}-step ordering chain to infer from the labels. Do NOT add decoy or unnumbered dots; the lever is the vertex COUNT, not distractors. ${
          saturated ? 'K caps at 4 dots, so hard holds at the square.' : ''
        }`,
      );
      break;
    case 'complete':
      lines.push(
        `STRUCTURE: a partial ${targetShape} (${v} vertices); about half its sides pre-drawn, the student infers and closes the rest — more vertices means more missing geometry to reconstruct. Keep ~half pre-drawn so it stays a 'finish-the-partial-shape' task. ${
          saturated ? 'K caps at the square here.' : ''
        }`,
      );
      break;
    case 'draw-from-description':
      lines.push(
        targetShape === 'rhombus'
          ? `STRUCTURE: describe a RHOMBUS — 4 equal sides BUT corners that are NOT square (a tilted-diamond). The hard rung's property load is the equal-sides / non-right-angles contradiction the student must hold, not a bigger shape.`
          : `STRUCTURE: describe a ${targetShape} — ${v} sides, ${v} corners${
              v >= 4 ? ', with an equality constraint (all sides equal)' : ' (any triangle, no equality constraint)'
            }. More properties to satisfy unaided. ${saturated ? 'K caps at the square here.' : ''}`,
      );
      break;
  }
  lines.push(TIER_GUARDRAIL);
  return { targetShape, promptLines: lines };
}

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** Ghost outline of the full target shape (the dotted guide path). The strongest
   *  tracing scaffold — withdrawing it leaves the student tracing vertex-to-vertex. */
  showGuidePath: boolean;
  /** Animated directional ant-trail on the guide path (which way the stroke flows). */
  showDirectionArrows: boolean;
  /** Pulsing "next vertex / start here" cue ring — tells the student where to go next. */
  showNextCue: boolean;
  /** Stroke-order numbers (1,2,3…) on the trace vertices. NOTE: for connect-dots the
   *  numbers ARE the answer, so they are never withdrawn there (see apply step). */
  showOrderNumbers: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-canvas tracing-support structure for a tier on a pinned mode.
 * Support is withdrawn as the tier hardens; the SAME shape stays the target.
 * easy = guide path + arrows + next cue + order numbers; hard = endpoints only.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const showGuidePath = tier === 'easy';
  const showDirectionArrows = tier === 'easy';
  const showNextCue = tier !== 'hard';
  const showOrderNumbers = tier !== 'hard';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-canvas TRACING SCAFFOLDING only (${tier === 'easy' ? 'maximum support: the dotted guide path, directional flow, the pulsing "start/next" cue, and the stroke-order numbers all help the student form the stroke' : tier === 'medium' ? 'moderate support: the guide path and directional flow are withdrawn, but a faint next-vertex cue and order numbers remain' : 'minimum support: only the endpoints/vertices remain — no guide path, no arrows, no cue, no numbers; the student traces from memory of the shape'}). Keep the SAME target shape and the SAME vertices at every tier — a harder tier withdraws tracing help, it NEVER changes the shape, its size, or the eval mode.`,
  ];
  switch (pinnedType) {
    case 'trace':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the dotted shape outline and directional flow fully visible; the student traces along the guide with the next-dot cue and the numbered vertices lighting the way.'
          : tier === 'hard'
            ? 'Show only the bare vertex endpoints — no guide outline, no directional flow, no pulsing cue, no order numbers; hints should ask the student to recall the shape and decide their own stroke path.'
            : 'Withdraw the guide outline and directional flow; keep a quiet next-vertex cue and the order numbers so the student tracks their own progress.',
      );
      break;
    case 'connect-dots':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the pulsing next-dot cue active so the student is led from one numbered dot to the next.'
          : tier === 'hard'
            ? 'Withdraw the pulsing next-dot cue; the student must find the order from the dot numbers alone (the numbers stay — they are the puzzle, not a scaffold).'
            : 'Keep a quiet next-dot cue; the student leans on the numbers to choose the order.',
      );
      break;
    case 'complete':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the pulsing next-vertex cue and order numbers on the remaining vertices so the student sees where each missing side goes.'
          : tier === 'hard'
            ? 'Withdraw the pulsing cue and the order numbers on the remaining vertices; the student decides which side to draw next to close the shape.'
            : 'Keep a quiet next-vertex cue; the student tracks which sides remain themselves.',
      );
      break;
    case 'draw-from-description':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the vertex order labels and the dashed preview-closing line visible as the student places corners.'
          : tier === 'hard'
            ? 'Withdraw the order labels and the dashed preview line; the student judges the closed shape unaided from the description.'
            : 'Keep the order labels; withdraw the dashed preview line so the student visualizes the closure themselves.',
      );
      break;
  }
  return { showGuidePath, showDirectionArrows, showNextCue, showOrderNumbers, promptLines };
}

// ============================================================================
// Local helper: constrain challengePlan type enum in setup schema
// ============================================================================

function constrainSetupPlanEnum(
  base: Schema,
  allowedTypes: string[],
  docs: Record<string, ChallengeTypeDoc>,
): Schema {
  const schema: Schema = JSON.parse(JSON.stringify(base));
  const props = (schema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
  const cp = props?.challengePlan as Record<string, unknown> | undefined;
  const items = cp?.items as Record<string, unknown> | undefined;
  const itemProps = items?.properties as Record<string, unknown> | undefined;
  const typeField = itemProps?.type as Record<string, unknown> | undefined;
  if (typeField) {
    typeField.enum = allowedTypes;
    const desc = allowedTypes.map(t => docs[t]?.schemaDescription ?? t).join(', ');
    typeField.description = `Challenge type: ${desc}`;
  }
  return schema;
}

// ============================================================================
// Config interface
// ============================================================================

interface ShapeTracerConfig extends Partial<ShapeTracerData> {
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-canvas tracing scaffolding within it.
   * NEVER changes the target shape, its vertices, or the eval mode.
   */
  difficulty?: string;
}

// ============================================================================
// Shared Setup Schema (lightweight first call)
// ============================================================================

interface SetupResult {
  title: string;
  description: string;
  gridSize: number;
  showPropertyReminder: boolean;
  gradeBand: 'K' | '1';
  challengePlan: Array<{ type: string; targetShape: string }>;
}

const setupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Trace the Triangle!', 'Draw Shapes!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    gridSize: {
      type: Type.NUMBER,
      description: "Grid cell size for snapping: 25 for K, 20 for Grade 1"
    },
    showPropertyReminder: {
      type: Type.BOOLEAN,
      description: "Show shape property reminders? true for Grade 1, false for K"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' or '1'"
    },
    challengePlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Challenge type: 'trace', 'complete', 'draw-from-description', or 'connect-dots'"
          },
          targetShape: {
            type: Type.STRING,
            description: "Shape name: 'triangle', 'square', 'rectangle', 'circle', 'hexagon', 'pentagon', 'rhombus'"
          }
        },
        required: ["type", "targetShape"]
      },
      description: "4-6 challenges, progressive difficulty, at least 2 different types"
    }
  },
  required: ["title", "description", "gridSize", "showPropertyReminder", "gradeBand", "challengePlan"]
};

// ============================================================================
// Deterministic shape PLACER — code owns the answer-bearing geometry
// ----------------------------------------------------------------------------
// SHT-1 / SP-8 (geometry variant): the target shape DETERMINES its vertices, so
// the LLM must never emit the coordinates. Gemini picks only cosmetic knobs
// (size / rotation / position) from a bounded window; placeShape lays down the
// exact ordered vertices by affine-transforming the canonical unit shape. A
// wrong vertex count or a loop-closing duplicate vertex (which deadlocked the
// order-gated tap sequence) is now structurally impossible: placeShape ALWAYS
// returns exactly N distinct, ordered points. Defaults (medium / 0deg / center)
// reproduce the canonical SHAPE_VERTICES positions exactly.
// ============================================================================

const CANVAS_BOUNDS = { minX: 40, maxX: 460, minY: 40, maxY: 360 };

type ShapeSize = 'small' | 'medium' | 'large';
type ShapePosition = 'center' | 'top' | 'bottom' | 'left' | 'right';

const SIZE_SCALE: Record<ShapeSize, number> = { small: 0.8, medium: 1.0, large: 1.2 };
const POSITION_OFFSET: Record<ShapePosition, { dx: number; dy: number }> = {
  center: { dx: 0, dy: 0 },
  top: { dx: 0, dy: -55 },
  bottom: { dx: 0, dy: 55 },
  left: { dx: -85, dy: 0 },
  right: { dx: 85, dy: 0 },
};

/** Rotation cap so a square never reads as a diamond at K/G1 — the shape must
 *  stay recognizable in its canonical orientation. */
const MAX_ROTATION_DEG = 20;

interface PlacementKnobs {
  size?: ShapeSize;
  rotationDeg?: number;
  position?: ShapePosition;
}

/** Cosmetic-placement schema fields shared by every geometry-bearing mode. The
 *  LLM fills these (or omits them → code defaults); it NEVER emits coordinates. */
const placementSchemaProps: Record<string, Schema> = {
  size: { type: Type.STRING, description: "How big the shape is drawn: 'small', 'medium', or 'large'" },
  rotationDeg: { type: Type.NUMBER, description: "Rotation in degrees, -20 to 20 (0 = upright). Keep it small so the shape stays recognizable." },
  position: { type: Type.STRING, description: "Where the shape sits: 'center', 'top', 'bottom', 'left', or 'right'" },
};

/** Sanitize the LLM's placement knobs; anything missing/invalid falls back to a
 *  canonical, recognizable default (medium / upright / centered). */
function resolveKnobs(data: { size?: unknown; rotationDeg?: unknown; position?: unknown } | null): PlacementKnobs {
  const sizes: readonly ShapeSize[] = ['small', 'medium', 'large'];
  const positions: readonly ShapePosition[] = ['center', 'top', 'bottom', 'left', 'right'];
  return {
    size: sizes.includes(data?.size as ShapeSize) ? (data!.size as ShapeSize) : 'medium',
    position: positions.includes(data?.position as ShapePosition) ? (data!.position as ShapePosition) : 'center',
    rotationDeg: typeof data?.rotationDeg === 'number' && Number.isFinite(data.rotationDeg) ? (data.rotationDeg as number) : 0,
  };
}

/** Canonical unit vertices for a shape. Polygons come from the artist-tuned
 *  SHAPE_VERTICES table; circle is sampled as 8 points (it has no polygon entry
 *  — its "vertices" are just trace anchors around the rim). */
function baseVertices(shape: string): Array<{ x: number; y: number }> {
  if (shape === 'circle') {
    const cx = 250, cy = 200, r = 120, n = 8;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return pts;
  }
  return (SHAPE_VERTICES[shape] ?? SHAPE_VERTICES.triangle!).map(v => ({ ...v }));
}

const centroidOf = (pts: Array<{ x: number; y: number }>) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

/** Shrink a point set about its centroid so its bounding box fits the canvas.
 *  A no-op when it already fits — a rotated/large shape that would overflow (a
 *  translation can't rescue a shape bigger than the canvas) is scaled down
 *  uniformly, preserving the shape AND the vertex count. */
function shrinkToFit(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const cw = CANVAS_BOUNDS.maxX - CANVAS_BOUNDS.minX;
  const ch = CANVAS_BOUNDS.maxY - CANVAS_BOUNDS.minY;
  const f = Math.min(1, w > 0 ? cw / w : 1, h > 0 ? ch / h : 1);
  if (f >= 1) return pts;
  const c = centroidOf(pts);
  return pts.map(p => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f }));
}

/** Translate a point set (never distorting) so its bounding box sits fully
 *  inside the canvas — preserves the shape AND the vertex count. Assumes the
 *  bbox already fits (see shrinkToFit); rounds to integer pixels. */
function fitWithinCanvas(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  let dx = 0, dy = 0;
  if (minX < CANVAS_BOUNDS.minX) dx = CANVAS_BOUNDS.minX - minX;
  else if (maxX > CANVAS_BOUNDS.maxX) dx = CANVAS_BOUNDS.maxX - maxX;
  if (minY < CANVAS_BOUNDS.minY) dy = CANVAS_BOUNDS.minY - minY;
  else if (maxY > CANVAS_BOUNDS.maxY) dy = CANVAS_BOUNDS.maxY - maxY;
  return pts.map(p => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) }));
}

/**
 * Place a shape's canonical vertices under cosmetic knobs. Returns EXACTLY the
 * shape's vertex count, ordered, with no closing duplicate, always in-bounds.
 * This is the single source of truth for every mode's answer-bearing geometry.
 * Defaults (medium / 0deg / center) reproduce the canonical SHAPE_VERTICES.
 */
function placeShape(shape: string, knobs: PlacementKnobs = {}): Array<{ x: number; y: number }> {
  const base = baseVertices(shape);
  const c = centroidOf(base);
  const scale = SIZE_SCALE[knobs.size ?? 'medium'] ?? 1;
  const rawRot = knobs.rotationDeg ?? 0;
  const clampedRot = Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, Number.isFinite(rawRot) ? rawRot : 0));
  const rot = (clampedRot * Math.PI) / 180;
  const off = POSITION_OFFSET[knobs.position ?? 'center'] ?? POSITION_OFFSET.center;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  // 1) scale + rotate about the centroid (in place)
  let placed = base.map(v => {
    const rx = (v.x - c.x) * scale, ry = (v.y - c.y) * scale;
    return { x: c.x + (rx * cos - ry * sin), y: c.y + (rx * sin + ry * cos) };
  });
  // 2) shrink if the rotated/scaled bbox is bigger than the canvas
  placed = shrinkToFit(placed);
  // 3) apply the position nudge, then translate any overflow back in-bounds
  placed = placed.map(p => ({ x: p.x + off.dx, y: p.y + off.dy }));
  return fitWithinCanvas(placed);
}

/** Split a vertex ring into ~half pre-drawn sides + the remaining vertices the
 *  student closes. Shared by generateComplete and the axis-2 reconstruct path so
 *  the pre-drawn fraction stays ~half (keeps it 'complete', not 'trace'/'draw'). */
function buildCompleteFromVertices(
  verts: Array<{ x: number; y: number }>,
): {
  drawnSides: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  remainingVertices: Array<{ x: number; y: number }>;
} {
  const half = Math.ceil(verts.length / 2);
  const drawnSides: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  for (let i = 0; i < half; i++) {
    drawnSides.push({ from: { ...verts[i]! }, to: { ...verts[(i + 1) % verts.length]! } });
  }
  const remaining = verts.slice(half);
  return {
    drawnSides,
    remainingVertices: remaining.length > 0 ? remaining.map(v => ({ ...v })) : [{ ...verts[verts.length - 1]! }],
  };
}

// ============================================================================
// Per-Challenge-Type Schemas (small, focused)
// ============================================================================

const traceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Warm instruction like 'Trace the triangle by following the dots!'"
    },
    ...placementSchemaProps,
    tolerance: {
      type: Type.NUMBER,
      description: "Pixel tolerance: 30-40 for K, 20-25 for Grade 1"
    }
  },
  required: ["instruction", "tolerance"]
};

const completeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Finish the square by connecting the missing sides!'"
    },
    ...placementSchemaProps
  },
  required: ["instruction"]
};

const drawFromDescriptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Read the description and draw the shape!'"
    },
    description: {
      type: Type.STRING,
      description: "Text description of the shape (e.g., 'A shape with 3 sides and 3 corners')"
    },
    sides: {
      type: Type.NUMBER,
      description: "Number of sides the shape must have"
    },
    corners: {
      type: Type.NUMBER,
      description: "Number of corners/vertices"
    },
    allSidesEqual: {
      type: Type.BOOLEAN,
      description: "Whether all sides must be equal length"
    },
    hasCurvedSides: {
      type: Type.BOOLEAN,
      description: "Whether the shape has curved sides (e.g., circle)"
    }
  },
  required: ["instruction", "description", "sides", "corners", "allSidesEqual", "hasCurvedSides"]
};

const connectDotsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Connect the dots in order to reveal the shape!'"
    },
    ...placementSchemaProps
  },
  required: ["instruction"]
};

// ============================================================================
// Setup Generator
// ============================================================================

async function generateSetup(
  topic: string,
  gradeLevel: string,
  config?: ShapeTracerConfig,
  evalConstraint?: EvalModeConstraint | null,
  scope?: PedagogicalScope,
): Promise<SetupResult> {
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint ?? null,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainSetupPlanEnum(setupSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : setupSchema;

  // The setup call is where each challenge's targetShape is chosen, so the
  // authoritative scope (topic + objective + intent) must bind HERE — wiring it
  // into the per-challenge prompts would be too late. scope-context-contract wire.
  const scopeSection = scope ? buildScopePromptSection(scope) : "";

  const prompt = `
Create a plan for a shape tracing activity teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
${challengeTypeSection}

GUIDELINES:
- Kindergarten (gradeBand "K"): shapes = circle, square, triangle, rectangle. gridSize: 25. showPropertyReminder: false.
- Grade 1 (gradeBand "1"): shapes = triangle, square, rectangle, hexagon, pentagon, rhombus. gridSize: 20. showPropertyReminder: true.

${config?.gridSize ? `- Grid size: ${config.gridSize}` : ''}
${config?.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}

${!evalConstraint ? 'Create 4-6 challenges progressing in difficulty. Use at least 2 different types. Start with easier shapes (triangle, square) and progress to harder ones.' : `Create 4-6 challenges all using the allowed challenge type(s) above. Start with easier shapes (triangle, square) and progress to harder ones.`}
Title should be fun and engaging for young children.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: activeSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No setup data returned from Gemini API');

  // --- Validate ---
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }
  if (!data.gridSize || data.gridSize < 10 || data.gridSize > 50) {
    data.gridSize = data.gradeBand === 'K' ? 25 : 20;
  }
  if (typeof data.showPropertyReminder !== 'boolean') {
    data.showPropertyReminder = data.gradeBand === '1';
  }

  const validTypes = evalConstraint?.allowedTypes ?? ['trace', 'complete', 'draw-from-description', 'connect-dots'];
  if (!Array.isArray(data.challengePlan) || data.challengePlan.length === 0) {
    const fallbackType = validTypes[0] ?? 'trace';
    data.challengePlan = [
      { type: fallbackType, targetShape: 'triangle' },
      { type: fallbackType, targetShape: 'square' },
      { type: validTypes[1] ?? fallbackType, targetShape: 'rectangle' },
      { type: fallbackType, targetShape: 'triangle' },
    ];
  }
  data.challengePlan = data.challengePlan
    .filter((c: { type: string }) => validTypes.includes(c.type))
    .slice(0, 6);
  if (data.challengePlan.length < 1) {
    const fallbackType = validTypes[0] ?? 'trace';
    data.challengePlan = [
      { type: fallbackType, targetShape: 'triangle' },
      { type: fallbackType, targetShape: 'square' },
    ];
  }

  return data as SetupResult;
}

// ============================================================================
// Per-Type Challenge Generators
// ============================================================================

async function generateTrace(shape: string, setup: SetupResult, tierSection = ''): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a TRACE challenge for a "${shape}" shape tracing activity for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

The student follows a dotted outline by tapping the shape's corners in order. YOU DO NOT PLACE THE CORNERS — the app draws the ${shape}'s vertices for you. You only choose:
- instruction: warm, encouraging (e.g., "Trace the ${shape} by following the dots!")
- size / position / rotationDeg: how the ${shape} sits on the 500x400 canvas (keep rotation small, -20 to 20, so it stays recognizable)
- tolerance: ${setup.gradeBand === 'K' ? '30-40' : '20-25'} pixels
${tierSection}`;

  let data: { instruction?: string; tolerance?: number; size?: unknown; rotationDeg?: unknown; position?: unknown } | null = null;
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: traceSchema },
    });
    data = result.text ? JSON.parse(result.text) : null;
  } catch {
    return fallbackTrace(shape, setup);
  }

  return {
    id: '',
    type: 'trace',
    instruction: data?.instruction || `Trace the ${shape} by following the dots!`,
    targetShape: shape,
    // Answer-bearing geometry is CODE-derived from the target shape (never the
    // LLM's coordinates) — placeShape returns exactly N ordered vertices.
    tracePath: placeShape(shape, resolveKnobs(data)),
    tolerance: (typeof data?.tolerance === 'number' && data.tolerance > 0) ? data.tolerance : (setup.gradeBand === 'K' ? 35 : 22),
  };
}

async function generateComplete(shape: string, setup: SetupResult, tierSection = ''): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a COMPLETE challenge for a "${shape}" shape for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Some sides are pre-drawn; the student draws the remaining sides to finish the shape. YOU DO NOT PLACE ANY LINES OR CORNERS — the app draws about half the ${shape}'s sides and leaves the rest for the student. You only choose:
- instruction: encouraging (e.g., "Finish the ${shape}!")
- size / position / rotationDeg: how the ${shape} sits on the 500x400 canvas (keep rotation small, -20 to 20)
${tierSection}`;

  let data: { instruction?: string; size?: unknown; rotationDeg?: unknown; position?: unknown } | null = null;
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: completeSchema },
    });
    data = result.text ? JSON.parse(result.text) : null;
  } catch {
    return fallbackComplete(shape, setup);
  }

  // Answer-bearing geometry is CODE-derived: place the shape, then split it into
  // ~half pre-drawn sides + the remaining vertices to close (never LLM points).
  const { drawnSides, remainingVertices } = buildCompleteFromVertices(placeShape(shape, resolveKnobs(data)));

  return {
    id: '',
    type: 'complete',
    instruction: data?.instruction || `Finish the ${shape}!`,
    targetShape: shape,
    drawnSides,
    remainingVertices,
  };
}

async function generateDrawFromDescription(shape: string, setup: SetupResult, tierSection = ''): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a DRAW-FROM-DESCRIPTION challenge for a "${shape}" for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

The student reads a text description and draws the shape freehand on a grid.
- instruction: encouraging (e.g., "Read the clue and draw the shape!")
- description: child-friendly text clue about the shape (e.g., "A shape with 3 straight sides and 3 pointy corners")
- sides: number of sides the shape must have
- corners: number of corners/vertices
- allSidesEqual: true if all sides should be equal (e.g., square, equilateral triangle)
- hasCurvedSides: true only for circles
${tierSection}`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: drawFromDescriptionSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackDrawFromDescription(shape, setup);

  return {
    id: '',
    type: 'draw-from-description',
    instruction: data.instruction || `Read the clue and draw a ${shape}!`,
    targetShape: shape,
    description: data.description || `Draw a shape with ${data.sides || 3} sides`,
    requiredProperties: {
      sides: data.sides || 3,
      corners: data.corners || 3,
      allSidesEqual: data.allSidesEqual ?? false,
      hasCurvedSides: data.hasCurvedSides ?? false,
    },
  };
}

async function generateConnectDots(shape: string, setup: SetupResult, tierSection = ''): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a CONNECT-THE-DOTS challenge for a "${shape}" for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Numbered dots on canvas. Student connects them in order to reveal the shape. YOU DO NOT PLACE THE DOTS — the app places the numbered dots forming the ${shape} and sets the 1→2→3 order for you. You only choose:
- instruction: fun (e.g., "Connect the dots to discover the hidden shape!")
- size / position / rotationDeg: how the ${shape} sits on the 500x400 canvas (keep rotation small, -20 to 20)
${tierSection}`;

  let data: { instruction?: string; size?: unknown; rotationDeg?: unknown; position?: unknown } | null = null;
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: connectDotsSchema },
    });
    data = result.text ? JSON.parse(result.text) : null;
  } catch {
    return fallbackConnectDots(shape, setup);
  }

  // Answer-bearing geometry is CODE-derived: the dots ARE the shape's vertices
  // (labeled 1..n) and the canonical order is 0..n-1 — never LLM coordinates.
  const verts = placeShape(shape, resolveKnobs(data));

  return {
    id: '',
    type: 'connect-dots',
    instruction: data?.instruction || `Connect the dots to reveal the ${shape}!`,
    targetShape: shape,
    dots: verts.map((v, i) => ({ ...v, label: String(i + 1) })),
    correctOrder: verts.map((_, i) => i),
    revealShape: shape,
  };
}

// ============================================================================
// Fallback Defaults (per-type)
// ============================================================================

const SHAPE_VERTICES: Record<string, Array<{ x: number; y: number }>> = {
  triangle: [{ x: 250, y: 80 }, { x: 150, y: 280 }, { x: 350, y: 280 }],
  square: [{ x: 150, y: 100 }, { x: 350, y: 100 }, { x: 350, y: 300 }, { x: 150, y: 300 }],
  rectangle: [{ x: 100, y: 120 }, { x: 400, y: 120 }, { x: 400, y: 280 }, { x: 100, y: 280 }],
  pentagon: [{ x: 250, y: 60 }, { x: 390, y: 160 }, { x: 340, y: 330 }, { x: 160, y: 330 }, { x: 110, y: 160 }],
  hexagon: [{ x: 250, y: 60 }, { x: 370, y: 110 }, { x: 370, y: 250 }, { x: 250, y: 310 }, { x: 130, y: 250 }, { x: 130, y: 110 }],
  rhombus: [{ x: 250, y: 60 }, { x: 400, y: 200 }, { x: 250, y: 340 }, { x: 100, y: 200 }],
};

function getVertices(shape: string): Array<{ x: number; y: number }> {
  return SHAPE_VERTICES[shape] || SHAPE_VERTICES.triangle!;
}

// ============================================================================
// Axis-2 deterministic RECONSTRUCTION builders (re-build a challenge's
// answer-bearing geometry from a NEW target shape). The shape DETERMINES the
// answer (tracePath / dots+order / drawnSides+remainingVertices / properties),
// so re-selecting the shape and rebuilding from SHAPE_VERTICES stays
// self-consistent. Every shape these touch is in SHAPE_VERTICES (the cap), at
// the canonical canvas scale (no footprint growth). draw-from-description has no
// rendered geometry — its "answer" is requiredProperties, rebuilt from a table.
// ============================================================================

const RECONSTRUCTABLE = new Set(Object.keys(SHAPE_VERTICES));

/** Canonical shape properties for draw-from-description reconstruction. */
const SHAPE_PROPS: Record<string, { sides: number; corners: number; equal: boolean; curved: boolean; desc: string }> = {
  triangle: { sides: 3, corners: 3, equal: false, curved: false, desc: 'A shape with 3 straight sides and 3 pointy corners' },
  square: { sides: 4, corners: 4, equal: true, curved: false, desc: 'A shape with 4 equal sides and 4 square corners' },
  rectangle: { sides: 4, corners: 4, equal: false, curved: false, desc: 'A shape with 4 sides - 2 long and 2 short - and 4 corners' },
  pentagon: { sides: 5, corners: 5, equal: true, curved: false, desc: 'A shape with 5 equal sides and 5 corners' },
  hexagon: { sides: 6, corners: 6, equal: true, curved: false, desc: 'A shape with 6 equal sides and 6 corners' },
  rhombus: { sides: 4, corners: 4, equal: true, curved: false, desc: 'A shape like a tilted square - 4 equal sides but NOT square corners' },
};

/** Rebuild a TRACE challenge's path from the target shape. */
function reconstructTrace(ch: ShapeTracerChallenge, shape: string): void {
  ch.tracePath = getVertices(shape).map(v => ({ ...v }));
  ch.targetShape = shape;
}

/** Rebuild a CONNECT-DOTS challenge: dots = vertices, order = label order. The
 *  numbered dots ARE the answer, so order is the canonical 0..n-1 sequence. */
function reconstructConnectDots(ch: ShapeTracerChallenge, shape: string): void {
  const verts = getVertices(shape);
  ch.dots = verts.map((v, i) => ({ ...v, label: String(i + 1) }));
  ch.correctOrder = verts.map((_, i) => i);
  ch.revealShape = shape;
  ch.targetShape = shape;
}

/** Rebuild a COMPLETE challenge: ~half the sides pre-drawn, the rest left for
 *  the student to close. Mirrors fallbackComplete so the pre-drawn fraction
 *  stays ~half (the floor/cap that keeps it 'complete', not 'trace'/'draw'). */
function reconstructComplete(ch: ShapeTracerChallenge, shape: string): void {
  const { drawnSides, remainingVertices } = buildCompleteFromVertices(getVertices(shape));
  ch.drawnSides = drawnSides;
  ch.remainingVertices = remainingVertices;
  ch.targetShape = shape;
}

/** Rebuild a DRAW-FROM-DESCRIPTION challenge's required properties + clue. */
function reconstructDrawFromDescription(ch: ShapeTracerChallenge, shape: string): void {
  const p = SHAPE_PROPS[shape] ?? SHAPE_PROPS.triangle!;
  ch.requiredProperties = {
    sides: p.sides,
    corners: p.corners,
    allSidesEqual: p.equal,
    hasCurvedSides: p.curved,
  };
  ch.description = p.desc;
  ch.targetShape = shape;
}

/**
 * Post-process a single challenge to the structural tier: re-select its target
 * shape up the complexity ladder, then RECONSTRUCT its answer-bearing geometry
 * from that shape. Returns true if anything was rewritten.
 *
 * Honor-don't-churn: if the LLM already produced the exact target shape, leave
 * its geometry intact (it's already valid + in-band). Only reconstruct on a
 * mismatch. Circle (no vertices) and any shape outside SHAPE_VERTICES are left
 * untouched — the structural ladder only operates on closed polygons.
 */
function applyStructuralShape(ch: ShapeTracerChallenge, tier: SupportTier, gradeBand: 'K' | '1'): boolean {
  const mode = ch.type as ChallengeType;
  const target = resolveProblemShape(mode, tier, gradeBand).targetShape;
  if (!RECONSTRUCTABLE.has(target)) return false;
  // Already on target — don't churn a valid, in-band problem.
  if (ch.targetShape === target) return false;
  switch (mode) {
    case 'trace': reconstructTrace(ch, target); return true;
    case 'connect-dots': reconstructConnectDots(ch, target); return true;
    case 'complete': reconstructComplete(ch, target); return true;
    case 'draw-from-description': reconstructDrawFromDescription(ch, target); return true;
    default: return false;
  }
}

function fallbackTrace(shape: string, setup: SetupResult): ShapeTracerChallenge {
  return {
    id: '',
    type: 'trace',
    instruction: `Trace the ${shape} by following the dots!`,
    targetShape: shape,
    tracePath: getVertices(shape),
    tolerance: setup.gradeBand === 'K' ? 35 : 22,
  };
}

function fallbackComplete(shape: string, setup: SetupResult): ShapeTracerChallenge {
  const verts = getVertices(shape);
  const half = Math.ceil(verts.length / 2);

  // Pre-draw first half as segments
  const drawnSides = [];
  for (let i = 0; i < half; i++) {
    drawnSides.push({
      from: verts[i],
      to: verts[(i + 1) % verts.length],
    });
  }

  // Remaining vertices are the rest
  const remaining = verts.slice(half);

  return {
    id: '',
    type: 'complete',
    instruction: `Finish the ${shape} by connecting the missing sides!`,
    targetShape: shape,
    drawnSides,
    remainingVertices: remaining.length > 0 ? remaining : [verts[verts.length - 1]],
  };
}

function fallbackDrawFromDescription(shape: string, _setup: SetupResult): ShapeTracerChallenge {
  const shapeProps: Record<string, { sides: number; corners: number; equal: boolean; curved: boolean; desc: string }> = {
    triangle: { sides: 3, corners: 3, equal: false, curved: false, desc: 'A shape with 3 straight sides and 3 pointy corners' },
    square: { sides: 4, corners: 4, equal: true, curved: false, desc: 'A shape with 4 equal sides and 4 square corners' },
    rectangle: { sides: 4, corners: 4, equal: false, curved: false, desc: 'A shape with 4 sides - 2 long and 2 short - and 4 corners' },
    circle: { sides: 0, corners: 0, equal: false, curved: true, desc: 'A perfectly round shape with no corners' },
    hexagon: { sides: 6, corners: 6, equal: true, curved: false, desc: 'A shape with 6 equal sides and 6 corners' },
    pentagon: { sides: 5, corners: 5, equal: true, curved: false, desc: 'A shape with 5 sides and 5 corners' },
    rhombus: { sides: 4, corners: 4, equal: true, curved: false, desc: 'A shape like a tilted square - 4 equal sides but not square corners' },
  };
  const props = shapeProps[shape] || shapeProps.triangle!;

  return {
    id: '',
    type: 'draw-from-description',
    instruction: `Read the clue and draw the shape!`,
    targetShape: shape,
    description: props.desc,
    requiredProperties: {
      sides: props.sides,
      corners: props.corners,
      allSidesEqual: props.equal,
      hasCurvedSides: props.curved,
    },
  };
}

function fallbackConnectDots(shape: string, _setup: SetupResult): ShapeTracerChallenge {
  const verts = getVertices(shape);
  return {
    id: '',
    type: 'connect-dots',
    instruction: `Connect the dots in order to reveal the hidden shape!`,
    targetShape: shape,
    dots: verts.map((v, i) => ({ ...v, label: String(i + 1) })),
    correctOrder: verts.map((_, i) => i),
    revealShape: shape,
  };
}

// ============================================================================
// Challenge Dispatcher (routes plan entry → type-specific generator)
// ============================================================================

async function generateChallengeByType(
  plan: { type: string; targetShape: string },
  setup: SetupResult,
  tierSection = '',
): Promise<ShapeTracerChallenge> {
  switch (plan.type) {
    case 'trace':
      return generateTrace(plan.targetShape, setup, tierSection);
    case 'complete':
      return generateComplete(plan.targetShape, setup, tierSection);
    case 'draw-from-description':
      return generateDrawFromDescription(plan.targetShape, setup, tierSection);
    case 'connect-dots':
      return generateConnectDots(plan.targetShape, setup, tierSection);
    default:
      return fallbackTrace(plan.targetShape, setup);
  }
}

// ============================================================================
// Main Generator (public API — signature unchanged)
// ============================================================================

/**
 * Generate shape tracer data using parallel LLM calls.
 *
 * Architecture:
 *   1. Lightweight "setup" call → title, gridSize, gradeBand, challenge plan
 *   2. Parallel calls (one per planned challenge) with focused per-type schemas
 *   3. Recombine into ShapeTracerData
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns ShapeTracerData with complete configuration
 */
export const generateShapeTracer = async (
  ctx: GenerationContext,
): Promise<ShapeTracerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as ShapeTracerConfig;
  // Resolve eval mode constraint (null = mixed difficulty)
  const evalConstraint = resolveEvalModeConstraint(
    'shape-tracer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ShapeTracer', config?.targetEvalMode, evalConstraint);

  // The STUDENT's tier — DRIVES application (single OR blended session).
  const supportTier = normalizeSupportTier(config?.difficulty);

  // Step 1: Setup call (lightweight, with eval mode constraint + authoritative scope)
  const setup = await generateSetup(topic, gradeLevel, config, evalConstraint, ctx.scope);

  // Step 2: Parallel challenge calls (one per plan entry, focused schemas).
  // The tier tunes only the prompt TONE per challenge; the show* scaffolds are
  // applied deterministically in code below.
  const challengePromises = setup.challengePlan.map(plan => {
    // ONE prompt block carries BOTH axes: scaffolding withdrawal
    // (resolveSupportStructure) + structural shape complexity
    // (resolveProblemShape) — so the LLM sees one coherent "what hard means".
    // The structural shape is ultimately CODE-enforced on the geometry below;
    // the prompt just steers the LLM toward the same target.
    const tierSection = supportTier
      ? `\n## WITHIN-MODE TIER "${supportTier}" (tracing-scaffolding level + structural shape complexity — NOT shape size)\n${
          [
            ...resolveSupportStructure(plan.type as ChallengeType, supportTier).promptLines,
            ...resolveProblemShape(plan.type as ChallengeType, supportTier, setup.gradeBand).promptLines,
          ].map(l => `- ${l}`).join('\n')
        }\n`
      : '';
    return generateChallengeByType(plan, setup, tierSection);
  });
  const challenges = await Promise.all(challengePromises);

  // Step 3: Assign IDs
  challenges.forEach((c, i) => { c.id = `c${i + 1}`; });

  // Step 3b: Apply the support tier per-challenge (display-only scaffolds).
  // Resolve each challenge's scaffold from its OWN mode (ch.type) so blended /
  // auto sessions get tiered too. Withdraw tracing help; NEVER touch the shape.
  if (supportTier) {
    let reshapedCount = 0;
    for (const ch of challenges) {
      // AXIS 1 — scaffolding withdrawal (display-only, same shape).
      const sc = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      ch.showGuidePath = sc.showGuidePath;
      ch.showDirectionArrows = sc.showDirectionArrows;
      ch.showNextCue = sc.showNextCue;
      // connect-dots: the order numbers ARE the answer — keep them at every tier.
      ch.showOrderNumbers = ch.type === 'connect-dots' ? true : sc.showOrderNumbers;
      ch.supportTier = supportTier;

      // AXIS 2 — structural shape complexity. Re-select the target shape up the
      // grade-band complexity ladder and RECONSTRUCT the answer-bearing geometry
      // from it (the shape determines the answer, so this stays self-consistent).
      // Honor-don't-churn: skips when the LLM already produced the target shape.
      if (applyStructuralShape(ch, supportTier, setup.gradeBand)) reshapedCount++;
    }
    console.log(
      `[ShapeTracer] Support tier "${supportTier}" applied per-challenge `
      + `(${evalConstraint?.allowedTypes.length === 1 ? `single-mode ${evalConstraint.allowedTypes[0]}` : 'blended'}); `
      + `structural reshapes: ${reshapedCount}/${challenges.length} (grade ${setup.gradeBand})`,
    );
  }

  // Step 4: Recombine
  const data: ShapeTracerData = {
    title: setup.title,
    description: setup.description,
    challenges,
    gridSize: setup.gridSize,
    showPropertyReminder: setup.showPropertyReminder,
    gradeBand: setup.gradeBand,
  };

  // Step 5: Apply explicit config overrides
  if (config) {
    if (config.gridSize !== undefined) data.gridSize = config.gridSize;
    if (config.showPropertyReminder !== undefined) data.showPropertyReminder = config.showPropertyReminder;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.title !== undefined) data.title = config.title;
    if (config.description !== undefined) data.description = config.description;
  }

  return data;
};
