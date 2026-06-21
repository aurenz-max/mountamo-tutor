import { Type, Schema } from "@google/genai";
import { ShapeTracerData, ShapeTracerChallenge } from "../../primitives/visual-primitives/math/ShapeTracer";
import { ai } from "../geminiClient";
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
      `"trace": Student follows a dotted outline by tapping vertices in order. Provide vertices forming the target shape within canvas bounds. K: tolerance 30-40px; Grade 1: 20-25px.`,
    schemaDescription: "'trace' (follow dotted outline)",
  },
  'connect-dots': {
    promptDoc:
      `"connect-dots": Numbered dots on canvas; student connects them in order to reveal the shape. Provide labeled dots and the correctOrder index array.`,
    schemaDescription: "'connect-dots' (guided vertex construction)",
  },
  'complete': {
    promptDoc:
      `"complete": Some sides are pre-drawn; student draws the remaining sides to finish the shape. Provide pre-drawn segments and remainingVertices to connect.`,
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
// Per-Challenge-Type Schemas (small, focused)
// ============================================================================

const traceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Warm instruction like 'Trace the triangle by following the dots!'"
    },
    vertices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate (40-460)" },
          y: { type: Type.NUMBER, description: "Y coordinate (40-360)" }
        },
        required: ["x", "y"]
      },
      description: "Ordered vertices of the shape to trace, within 500x400 canvas"
    },
    tolerance: {
      type: Type.NUMBER,
      description: "Pixel tolerance: 30-40 for K, 20-25 for Grade 1"
    }
  },
  required: ["instruction", "vertices", "tolerance"]
};

const completeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Finish the square by connecting the missing sides!'"
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x1: { type: Type.NUMBER, description: "Start X (40-460)" },
          y1: { type: Type.NUMBER, description: "Start Y (40-360)" },
          x2: { type: Type.NUMBER, description: "End X (40-460)" },
          y2: { type: Type.NUMBER, description: "End Y (40-360)" }
        },
        required: ["x1", "y1", "x2", "y2"]
      },
      description: "Pre-drawn line segments (the sides already visible)"
    },
    remainingVertices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate (40-460)" },
          y: { type: Type.NUMBER, description: "Y coordinate (40-360)" }
        },
        required: ["x", "y"]
      },
      description: "Vertices the student must connect to finish the shape"
    }
  },
  required: ["instruction", "segments", "remainingVertices"]
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
    dots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER, description: "X coordinate (40-460)" },
          y: { type: Type.NUMBER, description: "Y coordinate (40-360)" },
          label: { type: Type.STRING, description: "Dot label (e.g., '1', '2', 'A')" }
        },
        required: ["x", "y", "label"]
      },
      description: "Positioned dots on the canvas"
    },
    correctOrder: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Zero-based indices into dots array defining correct connection order"
    },
    revealShape: {
      type: Type.STRING,
      description: "Name of shape revealed when dots are connected"
    }
  },
  required: ["instruction", "dots", "correctOrder", "revealShape"]
};

// ============================================================================
// Setup Generator
// ============================================================================

async function generateSetup(
  topic: string,
  gradeLevel: string,
  config?: ShapeTracerConfig,
  evalConstraint?: EvalModeConstraint | null,
): Promise<SetupResult> {
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint ?? null,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainSetupPlanEnum(setupSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : setupSchema;

  const prompt = `
Create a plan for a shape tracing activity teaching "${topic}" to ${gradeLevel} students.

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

function coordinateExamples(shape: string): string {
  const examples: Record<string, string> = {
    triangle: 'Triangle: [{x:250,y:80},{x:150,y:280},{x:350,y:280}]',
    square: 'Square: [{x:150,y:100},{x:350,y:100},{x:350,y:300},{x:150,y:300}]',
    rectangle: 'Rectangle: [{x:100,y:120},{x:400,y:120},{x:400,y:280},{x:100,y:280}]',
    pentagon: 'Pentagon: [{x:250,y:60},{x:390,y:160},{x:340,y:330},{x:160,y:330},{x:110,y:160}]',
    hexagon: 'Hexagon: [{x:250,y:60},{x:370,y:110},{x:370,y:250},{x:250,y:310},{x:130,y:250},{x:130,y:110}]',
    circle: 'Circle: use 8+ points along radius 120 centered at (250,200)',
    rhombus: 'Rhombus: [{x:250,y:60},{x:400,y:200},{x:250,y:340},{x:100,y:200}]',
  };
  return examples[shape] || examples.triangle!;
}

const clampPoint = (pt: { x: number; y: number }) => ({
  x: Math.max(40, Math.min(460, pt.x ?? 250)),
  y: Math.max(40, Math.min(360, pt.y ?? 200)),
});

async function generateTrace(shape: string, setup: SetupResult, tierSection = ''): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a TRACE challenge for a "${shape}" shape tracing activity for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Canvas is 500x400. All coordinates must be x: 40-460, y: 40-360.
Coordinate reference: ${coordinateExamples(shape)}

The student follows a dotted outline by tapping vertices in order.
- instruction: warm, encouraging (e.g., "Trace the ${shape} by following the dots!")
- vertices: ordered points that form the ${shape}. Must be within canvas bounds.
- tolerance: ${setup.gradeBand === 'K' ? '30-40' : '20-25'} pixels
${tierSection}`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: traceSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data || !Array.isArray(data.vertices) || data.vertices.length < 3) {
    return fallbackTrace(shape, setup);
  }

  return {
    id: '',
    type: 'trace',
    instruction: data.instruction || `Trace the ${shape} by following the dots!`,
    targetShape: shape,
    tracePath: data.vertices.map(clampPoint),
    tolerance: (data.tolerance && data.tolerance > 0) ? data.tolerance : (setup.gradeBand === 'K' ? 35 : 22),
  };
}

async function generateComplete(shape: string, setup: SetupResult, tierSection = ''): Promise<ShapeTracerChallenge> {
  const prompt = `
Create a COMPLETE challenge for a "${shape}" shape for ${setup.gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}.

Canvas is 500x400. All coordinates: x: 40-460, y: 40-360.
Coordinate reference: ${coordinateExamples(shape)}

Some sides are pre-drawn. The student draws the remaining sides to finish the shape.
- instruction: encouraging (e.g., "Finish the ${shape}!")
- segments: pre-drawn line segments as [{x1, y1, x2, y2}]. Draw about half the sides.
- remainingVertices: vertices the student connects to complete the shape.

The segments + remaining vertices should form a complete ${shape} when connected.
${tierSection}`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: completeSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data || !Array.isArray(data.segments) || data.segments.length === 0 ||
      !Array.isArray(data.remainingVertices) || data.remainingVertices.length === 0) {
    return fallbackComplete(shape, setup);
  }

  // Convert flat segments to drawnSides format
  const drawnSides = data.segments.map((s: { x1: number; y1: number; x2: number; y2: number }) => ({
    from: clampPoint({ x: s.x1, y: s.y1 }),
    to: clampPoint({ x: s.x2, y: s.y2 }),
  }));

  return {
    id: '',
    type: 'complete',
    instruction: data.instruction || `Finish the ${shape}!`,
    targetShape: shape,
    drawnSides,
    remainingVertices: data.remainingVertices.map(clampPoint),
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

Canvas is 500x400. All coordinates: x: 40-460, y: 40-360.
Coordinate reference: ${coordinateExamples(shape)}

Numbered dots on canvas. Student connects them in order to reveal the shape.
- instruction: fun (e.g., "Connect the dots to discover the hidden shape!")
- dots: positioned dots with labels "1", "2", "3", etc. Place them to form a ${shape}.
- correctOrder: zero-based indices [0, 1, 2, ...] matching the label order
- revealShape: "${shape}"
${tierSection}`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: connectDotsSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data || !Array.isArray(data.dots) || data.dots.length < 3) {
    return fallbackConnectDots(shape, setup);
  }

  const clampedDots = data.dots.map((d: { x: number; y: number; label?: string }, i: number) => ({
    ...clampPoint(d),
    label: d.label || String(i + 1),
  }));

  // Validate correctOrder indices
  let correctOrder = Array.isArray(data.correctOrder) ? data.correctOrder : [];
  correctOrder = correctOrder.filter(
    (i: number) => typeof i === 'number' && i >= 0 && i < clampedDots.length
  );
  if (correctOrder.length === 0) {
    correctOrder = clampedDots.map((_: unknown, i: number) => i);
  }

  return {
    id: '',
    type: 'connect-dots',
    instruction: data.instruction || `Connect the dots to reveal the ${shape}!`,
    targetShape: shape,
    dots: clampedDots,
    correctOrder,
    revealShape: data.revealShape || shape,
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
  const verts = getVertices(shape);
  const half = Math.ceil(verts.length / 2);
  const drawnSides: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  for (let i = 0; i < half; i++) {
    drawnSides.push({ from: { ...verts[i]! }, to: { ...verts[(i + 1) % verts.length]! } });
  }
  const remaining = verts.slice(half);
  ch.drawnSides = drawnSides;
  ch.remainingVertices = remaining.length > 0 ? remaining.map(v => ({ ...v })) : [{ ...verts[verts.length - 1]! }];
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
  topic: string,
  gradeLevel: string,
  config?: ShapeTracerConfig
): Promise<ShapeTracerData> => {
  // Resolve eval mode constraint (null = mixed difficulty)
  const evalConstraint = resolveEvalModeConstraint(
    'shape-tracer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ShapeTracer', config?.targetEvalMode, evalConstraint);

  // The STUDENT's tier — DRIVES application (single OR blended session).
  const supportTier = normalizeSupportTier(config?.difficulty);

  // Step 1: Setup call (lightweight, with eval mode constraint)
  const setup = await generateSetup(topic, gradeLevel, config, evalConstraint);

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
