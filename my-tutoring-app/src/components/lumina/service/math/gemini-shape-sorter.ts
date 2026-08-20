import { Type, Schema } from "@google/genai";
import type { ShapeSorterData } from "../../primitives/visual-primitives/math/ShapeSorter";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from "../scopeContext";

// The geometry table and every build gate come from the SCRIPT module — the one
// address both sides of the wire share. It carried a local copy until the DI
// port (SS-1: it could not import the `'use client'` component); `shapeSorterScript`
// is not a client module, so the copy is deleted rather than re-synced. A
// hand-synced pair drifts, and letter-spotter's 90-vs-100 disagreement is why
// that is a rule and not a preference.
import {
  SHAPE_PROPERTIES,
  VALID_SHAPES,
  isCountable,
  isNameable,
  isSayableLabel,
  isSortable,
  binLabelFor,
  normalizeSortRule,
  opensWithSentinel,
  optionsEarSeparable,
} from "../../primitives/visual-primitives/math/shapeSorterScript";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

/**
 * ⚠️ THESE DOCS DESCRIBE A SPOKEN ACTIVITY. The tutor asks and the child answers
 * OUT LOUD; nothing on the screen is tappable. Prose here reaches the model, and
 * "tap each one" prose is what routed this primitive's content toward a
 * select-all surface for as long as it had one.
 */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": The tutor points to ONE shape at a time and the student SAYS ITS NAME out loud. `
      + `Every DISTINCT shape kind in the pool becomes its own spoken question, so variety of KINDS matters `
      + `more than repeats: 4-8 shapes with at least 3 different kinds. `
      + `Set ruleAttribute to the attribute the pool is built around and targetValue to its value. `
      + `Keep every SQUARE close to upright (rotation within 20 degrees of 0, 90, 180 or 270) — a square `
      + `turned 45 degrees reads as a diamond and then the question has two right answers. `
      + `Other shapes may take any rotation; that is what teaches shape constancy. `
      + `K: circle, square, triangle, rectangle. Grade 1: add hexagon, pentagon, diamond, oval.`,
    schemaDescription: "'identify' (say the shape's name aloud)",
  },
  count: {
    promptDoc:
      `"count": The student SAYS OUT LOUD how many sides (or corners) one shape has. `
      + `Set ruleAttribute to "shape" and targetValue to the shape name. Include exactly 1 shape. `
      + `IT MUST BE A POLYGON — triangle, square, rectangle, diamond, rhombus, pentagon or hexagon. `
      + `NEVER a circle or an oval: "how many sides does a circle have?" is arguable at zero and at one, `
      + `so it has no single right answer a tutor can judge.`,
    schemaDescription: "'count' (say the side or corner count aloud)",
  },
  sort: {
    promptDoc:
      `"sort": The tutor points to ONE shape at a time and the student SAYS WHICH GROUP it belongs with. `
      + `Set ruleAttribute to "sides", "curved" or "color" — NOT "shape" (the groups would just be the shape `
      + `names, which is the identify question with the answer printed on a label). No targetValue needed. `
      + `Include 4-6 shapes reaching at least 2 groups, with more than one shape in at least one group. `
      + `Under ruleAttribute "sides" use POLYGONS ONLY — a curved shape has no defensible side count, so it `
      + `has no defensible "N sides" group either. Curved shapes belong under ruleAttribute "curved". `
      + `Example: sort by sides → mix triangles (3), squares (4), hexagons (6).`,
    schemaDescription: "'sort' (say the group's name aloud)",
  },
};

type ChallengeType = 'identify' | 'count' | 'sort';

// ---------------------------------------------------------------------------
// Within-mode support tiers (config.difficulty) — scaffolding + structural axis
//
// Two axes, both WITHIN one eval mode and NEVER changing which attribute is
// sorted (that is the eval-mode identity) or which shapes are in scope:
//   1. Scaffolding (resolveSupportStructure) — withdraw on-screen self-check
//      cues: sort bin labels + per-bin count badges; count's pre-revealed
//      corner dots.
//   2. Structural problem shape (resolveProblemShape) — distractor tightness
//      for identify (far → near-miss foils). Prompt-shaped + code-guarded;
//      in-mode; structural, not magnitude.
// See memory: structural-difficulty-not-numeric, add-support-tiers skill,
// support-tiers-natural-levers.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

const TIER_GUARDRAIL =
  'Keep the SAME shapes and the SAME sort attribute in scope — this tier changes '
  + 'on-screen perception aids and distractor TIGHTNESS, NOT which attribute is '
  + 'sorted and NOT the shape set.';

/**
 * Scaffolding levers — perception aids withdrawn at harder tiers.
 *
 * ⭐ TWO OF THE CLICK ERA'S FOUR ARE GONE, AND BOTH FOR THE SAME REASON: they
 * were levers over a TAP.
 *
 *   `showBinLabels: false` blanked the mats at `hard`. That is legal while the
 *   answer is a POSITION you can tap; once the answer is the label SAID ALOUD,
 *   an unlabelled mat is an unanswerable question. The withdrawal moved into
 *   the ASK — `shapeSorterScript`'s `namesChoices` stops SPEAKING the groups at
 *   `hard` for a reader while they stay printed (letter-sound-link's
 *   tier-conditional exemption). It rides `supportTier`, stamped below.
 *
 *   `showMatchCount` printed a "find N" badge — the select-all answer, as a
 *   number. The mode names one shape at a time now; there is nothing to count.
 *
 * The two that survive are true perception aids: corner DOTS mark what to count
 * without stating how many, and the mat count reports AFFIRMED progress.
 */
interface SupportScaffold {
  /** sort: show each mat's running count of affirmed shapes (progress). */
  showBinCounts?: boolean;
  /** count: pre-reveal the corner dots so the student can count them directly.
   *  hard → off; the student finds the corners unaided. */
  showCornerHints?: boolean;
  promptLines: string[];
}

function resolveSupportStructure(mode: ChallengeType, tier: SupportTier): SupportScaffold {
  const lines: string[] = [TIER_GUARDRAIL];
  switch (mode) {
    case 'sort': {
      const showBinCounts = tier === 'easy';
      lines.push(
        'The groups are LABELLED on screen at every tier — the student says a group name out loud, '
        + 'so an unlabelled group would be an unanswerable question.',
      );
      lines.push(showBinCounts
        ? 'Each group shows a live count of the shapes already placed there, so the student can self-check the balance.'
        : 'Groups hide the running count — the student tracks placement unaided.');
      return { showBinCounts, promptLines: lines };
    }
    case 'count': {
      const showCornerHints = tier === 'easy';
      lines.push(showCornerHints
        ? 'Corner dots are pre-revealed on the shape so the student can count them directly. The dots mark WHERE the corners are and never state how many.'
        : 'No corner dots are pre-shown — the student finds the sides and corners unaided.');
      return { showCornerHints, promptLines: lines };
    }
    case 'identify': {
      lines.push(tier === 'easy'
        ? 'Use clearly different shape kinds so each name is easy to retrieve.'
        : 'Mix in shape kinds that look alike so the student must look carefully before naming.');
      return { promptLines: lines };
    }
    default:
      lines.push('Same task; difficulty rides the structural axis below.');
      return { promptLines: lines };
  }
}

/** Structural problem-shape levers — in-mode, structural, NEVER magnitude
 *  and NEVER a change of the assessed attribute. */
interface ProblemShape {
  /** identify: distractor tightness — 'far' (clearly distinct) → 'near' (near-miss foils
   *  sharing the target's other attributes, e.g. square vs rhombus when sorting by sides). */
  distractorTightness?: 'far' | 'moderate' | 'near';
  promptLines: string[];
}

function resolveProblemShape(mode: ChallengeType, tier: SupportTier): ProblemShape {
  const lines: string[] = [];
  switch (mode) {
    case 'identify': {
      const distractorTightness =
        tier === 'easy' ? 'far' : tier === 'medium' ? 'moderate' : 'near';
      lines.push(
        distractorTightness === 'near'
          ? 'Make the DISTRACTORS near-misses: shapes that share the target shape\'s OTHER attributes but differ on the rule attribute (e.g. when the rule is "triangle", include a near-pointy diamond; when the rule is "4 sides", mix squares, rectangles, rhombuses, diamonds so the student must look carefully). Keep the SAME rule attribute and target value.'
          : distractorTightness === 'moderate'
            ? 'Mix moderately similar distractors with the target — some share a feature, some clearly differ.'
            : 'Make the DISTRACTORS clearly distinct from the target (e.g. a circle and a triangle as foils when finding squares) so matches are obvious at a glance.'
      );
      return { distractorTightness, promptLines: lines };
    }
    default:
      // sort / count: the structural difficulty rides the scaffolding axis
      // (bin labels, corner pre-reveal). No magnitude lever — adding shapes
      // would change the in-scope set, which the guardrail forbids.
      return { promptLines: lines };
  }
}

/** One ## SUPPORT TIER block describing both axes for the prompt (tone + shape). */
function buildTierPromptSection(mode: ChallengeType, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier).promptLines,
  ];
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}" (scaffolding level + distractor tightness — NOT shape set or sort attribute)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const shapeSorterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title (e.g., 'Shape Safari!')" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID (e.g., 'c1', 'c2')" },
          type: {
            type: Type.STRING,
            enum: ['identify', 'count', 'sort'],
            description: "Challenge type: 'identify' (find matching shapes), 'count' (count sides/corners), 'sort' (classify by attribute)",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          ruleAttribute: {
            type: Type.STRING,
            enum: ['shape', 'color', 'sides', 'curved'],
            description: "Attribute being tested. Must be one of: shape, color, sides, curved",
          },
          targetValue: {
            type: Type.STRING,
            description: "For 'identify': the value to match — must be EXACTLY one of: shape name (circle/oval/triangle/square/rectangle/diamond/rhombus/hexagon/pentagon), color name (red/blue/green/yellow/purple/orange/pink/cyan), side count as digit ('0','3','4','5','6'), or 'true'/'false' for curved. For 'count': the shape name to examine. Omit for 'sort'.",
          },
          shapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                shape: {
                  type: Type.STRING,
                  enum: ['circle', 'oval', 'triangle', 'square', 'rectangle', 'diamond', 'rhombus', 'hexagon', 'pentagon'],
                  description: "Shape name",
                },
                color: {
                  type: Type.STRING,
                  enum: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'],
                  description: "Shape color",
                },
                size: {
                  type: Type.STRING,
                  enum: ['small', 'medium', 'large'],
                  description: "Shape size",
                },
                rotation: {
                  type: Type.NUMBER,
                  description: "Rotation in degrees (0-360). Vary to teach shape constancy.",
                },
              },
              required: ["shape", "color", "size", "rotation"],
            },
            description: "Pool of 4-8 shapes for this challenge. Ensure a good mix of targets and distractors.",
          },
        },
        required: ["id", "type", "instruction", "ruleAttribute", "shapes"],
      },
      description: "Array of 4-5 progressive challenges",
    },
    gradeBand: { type: Type.STRING, enum: ['K', '1'], description: "Grade band" },
  },
  required: ["title", "description", "challenges", "gradeBand"],
};

// ── Validation constants ─────────────────────────────────────────

// VALID_SHAPES comes from the script module's geometry table — one list, both
// sides of the wire.
const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
const VALID_SIZES = ['small', 'medium', 'large'];
const VALID_TYPES = ['identify', 'count', 'sort'];
const VALID_RULES = ['shape', 'color', 'sides', 'curved'];

// ── Generator ────────────────────────────────────────────────────

type ShapeSorterConfig = Partial<ShapeSorterData> & {
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = within-mode scaffolding + distractor tightness. NEVER changes
   * the shape set or the sorted attribute (the eval-mode identity).
   */
  difficulty?: string;
};

export const generateShapeSorter = async (
  ctx: GenerationContext,
): Promise<ShapeSorterData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as ShapeSorterConfig;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'shape-sorter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Support tier (within-mode difficulty) ──
  const supportTier = normalizeSupportTier(config?.difficulty); // STUDENT's tier — DRIVES application (single OR blend)
  // pinnedType is ONLY for the prompt tone / log; when a single mode is pinned we
  // can describe its tier inline. Blends get a per-challenge scaffold at the end.
  const pinnedType = evalConstraint && evalConstraint.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0] as ChallengeType
    : undefined;
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier)
    : '';

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(shapeSorterSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : shapeSorterSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  // Authoritative scope (topic + objective + intent). The LLM authors the shape set,
  // so this binds the intent's focus (e.g. "triangles and hexagons") to the shapes
  // shown — scope-context-contract wire. Correctness is unaffected (the checker reads
  // SHAPE_PROPERTIES, and the eval mode still owns the sorted attribute).
  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `
Create a shape sorting activity for teaching "${topic}" to ${gradeLevel} students.
${scopeSection}
GOAL: Teach Defining Attributes (shape, sides, curved) vs Non-Defining Attributes (color, size, rotation).

SUPPORTED SHAPES: circle, square, triangle, rectangle, diamond, rhombus, hexagon, pentagon, oval
VALID COLORS: red, blue, green, yellow, purple, orange, pink, cyan

${challengeTypeSection}
${tierSection}
THIS IS A SPOKEN ACTIVITY. A live tutor asks one question at a time and the student
ANSWERS OUT LOUD — they say a shape's name, a number, or a group's name. Nothing on
the screen is tapped or dragged, so never write an instruction telling the student to
tap, click, drag or press anything.

${!evalConstraint ? `
CHALLENGE PROGRESSION (generate 4-5 challenges):
1. "identify" with ruleAttribute "shape" — a pool the student names one shape at a time (targetValue: "triangle")
2. "identify" with ruleAttribute "color" — a differently-composed pool (targetValue: "blue")
3. "count" with ruleAttribute "shape" — ONE polygon whose sides the student counts aloud (targetValue: e.g. "hexagon")
4. "sort" with ruleAttribute "sides" — polygons only (no targetValue needed)
5. "sort" with ruleAttribute "curved" — curved and straight shapes (no targetValue needed)

GUIDELINES FOR GRADE LEVELS:
- Kindergarten ("K"): use circle, square, triangle, rectangle. Simple language.
- Grade 1 ("1"): add hexagon, pentagon, diamond, oval. More shapes per challenge.
` : ''}

RULES:
- For EVERY challenge, generate a "shapes" array of 4-8 shapes with varied colors and sizes.
- For "identify": at least 3 DIFFERENT shape kinds — each distinct kind becomes one spoken question,
  and a repeated kind is not asked twice.
- For "count": exactly 1 shape, and it MUST be a polygon (never a circle or an oval).
- For "sort": 4-6 shapes reaching at least 2 groups. Under ruleAttribute "sides", polygons only.
- Vary rotation (0-360) so students recognise rotated shapes — EXCEPT squares, which must stay
  within 20 degrees of 0, 90, 180 or 270. A square turned 45 degrees is a diamond to a young
  child, and then "what shape is this?" has two right answers.
- Every instruction is written for a READER LOOKING ON, not as a command to touch the screen.
${config?.gradeBand ? `\nGrade band: ${config.gradeBand}` : ''}
`;

  logEvalModeResolution('ShapeSorter', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) {
    throw new Error('No valid shape sorter data returned from Gemini API');
  }

  // ── Validation & Defaults ────────────────────────────────────────

  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Filter to valid challenge types
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => VALID_TYPES.includes(c.type),
  );

  /**
   * KEEP-OR-DROP, NEVER BACKFILL — the judged-loop rule, and this generator is
   * where the click era's habit was most expensive. It used to coerce an
   * unknown shape to a circle, invent a four-shape pool out of nothing, and
   * rewrite a broken instruction into "Can you find all the … ? Tap each one!".
   * Under the judged loop a repaired item becomes a SPOKEN ASK the tutor has to
   * stand behind, and a coerced circle in a sides-sort is an ask with no
   * defensible answer.
   *
   * Every gate below is IMPORTED from `shapeSorterScript`, so the build side and
   * the generator side cannot disagree about what is askable.
   */
  const kept: ShapeSorterChallengeDraft[] = [];
  const dropReasons: string[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < data.challenges.length; i++) {
    const ch = data.challenges[i] as ShapeSorterChallengeDraft;

    if (!ch.id || seenIds.has(ch.id)) ch.id = `c${i + 1}`;
    seenIds.add(ch.id);

    if (!VALID_RULES.includes(ch.ruleAttribute)) ch.ruleAttribute = 'shape';

    // Shapes whose ENUM fields are unusable are dropped, never coerced: the
    // colour is a group label under a colour sort and the kind decides every
    // answer, so a substituted value is a substituted answer.
    const pool = (Array.isArray(ch.shapes) ? ch.shapes : []).filter(
      (s: ShapeDraft) =>
        VALID_SHAPES.includes(s?.shape) && VALID_COLORS.includes(s?.color),
    );
    for (const s of pool) {
      if (!VALID_SIZES.includes(s.size)) s.size = 'medium';
      if (typeof s.rotation !== 'number' || !Number.isFinite(s.rotation)) s.rotation = 0;
    }
    if (pool.length === 0) {
      dropReasons.push(`${ch.id}: no usable shapes`);
      continue;
    }
    ch.shapes = pool;

    if (ch.type === 'count') {
      // A COUNTING ASK NEEDS A POLYGON. "How many sides does a circle have?" is
      // arguable at zero and at one, so it is dropped rather than asked.
      const target = typeof ch.targetValue === 'string' ? ch.targetValue.toLowerCase() : '';
      const shape = pool.find((s) => s.shape === target && isCountable(s.shape))
        ?? pool.find((s) => isCountable(s.shape));
      if (!shape) {
        dropReasons.push(`${ch.id}: count challenge has no polygon to count`);
        continue;
      }
      ch.shapes = [shape];
      ch.targetValue = shape.shape;
      ch.instruction = 'Look at this shape and listen for the question.';
      kept.push(ch);
      continue;
    }

    if (ch.type === 'identify') {
      // A NAMING ASK NEEDS ONE DEFENSIBLE NAME: a square rotated toward 45° is
      // a diamond to a young child, so it is dropped from the pool rather than
      // straightened (straightening would silently discard the shape-constancy
      // variation the rest of the pool is generated for).
      const nameable = pool.filter((s) => isNameable(s.shape, s.rotation ?? 0));
      const kinds = new Set(nameable.map((s) => s.shape));
      if (kinds.size === 0) {
        dropReasons.push(`${ch.id}: no shape in the pool has one defensible name`);
        continue;
      }
      ch.shapes = nameable;
      if (!VALID_SHAPES.includes(String(ch.targetValue))) ch.targetValue = nameable[0].shape;
      ch.instruction = 'Look at the shape that is marked and listen for the question.';
      kept.push(ch);
      continue;
    }

    // SORT. The rule must be one a sort can carry, the groups must be sayable
    // and separable by ear, and at least two of them must actually be reached.
    const rule = normalizeSortRule(ch.ruleAttribute);
    if (!rule) {
      dropReasons.push(`${ch.id}: "${ch.ruleAttribute}" cannot carry a sort`);
      continue;
    }
    const sortable = pool.filter((s) => isSortable(s.shape, rule));
    const labels = Array.from(
      new Set(sortable.map((s) => binLabelFor(s.shape, s.color, rule))),
    );
    if (sortable.length < 2 || labels.length < 2) {
      dropReasons.push(`${ch.id}: sort by ${rule} reaches fewer than two groups`);
      continue;
    }
    if (!labels.every(isSayableLabel) || !optionsEarSeparable(labels)) {
      dropReasons.push(`${ch.id}: sort groups are not separable by ear`);
      continue;
    }
    if (labels.some((l) => opensWithSentinel(l))) {
      dropReasons.push(`${ch.id}: a sort group opens with a verdict sentinel`);
      continue;
    }
    ch.shapes = sortable;
    ch.ruleAttribute = rule;
    delete ch.targetValue;
    ch.instruction = 'Look at the shape that is marked and listen for the question.';
    kept.push(ch);
  }

  if (dropReasons.length > 0) {
    console.log(`[ShapeSorter] dropped ${dropReasons.length} unaskable challenge(s): ${dropReasons.join(' | ')}`);
  }
  data.challenges = kept;

  /**
   * The hardcoded fallback, which every gate above can now empty into.
   *
   * ⚠️ IT WARNS RATHER THAN LOGS, and that is this slice's answer to the
   * "silent generator fallbacks" finding (33 generators, 32 of them math): a
   * fallback that ships at `console.log` level reads as a successful generation
   * in every downstream report, which is how phoneme-explorer's truncation ran
   * invisibly. The topic is genuinely LOST here — this is a canned shape set,
   * not content about what the lesson asked for — so it says so at warn level.
   *
   * All three payloads are judged-loop VALID by construction: the identify pool
   * carries four distinct kinds with no 45° square, the count shape is a
   * polygon, and the sort reaches exactly two groups with two shapes in each.
   */
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'identify';
    const fallbacks: Record<string, ShapeSorterChallengeDraft> = {
      identify: {
        id: 'c1',
        type: 'identify',
        instruction: 'Look at the shape that is marked and listen for the question.',
        ruleAttribute: 'shape',
        targetValue: 'circle',
        shapes: [
          { shape: 'circle', color: 'red', size: 'medium', rotation: 0 },
          { shape: 'square', color: 'blue', size: 'medium', rotation: 0 },
          { shape: 'triangle', color: 'yellow', size: 'large', rotation: 45 },
          { shape: 'rectangle', color: 'purple', size: 'large', rotation: 0 },
        ],
      },
      count: {
        id: 'c1',
        type: 'count',
        instruction: 'Look at this shape and listen for the question.',
        ruleAttribute: 'shape',
        targetValue: 'hexagon',
        shapes: [
          { shape: 'hexagon', color: 'blue', size: 'large', rotation: 0 },
        ],
      },
      sort: {
        id: 'c1',
        type: 'sort',
        instruction: 'Look at the shape that is marked and listen for the question.',
        ruleAttribute: 'sides',
        shapes: [
          { shape: 'triangle', color: 'red', size: 'medium', rotation: 0 },
          { shape: 'square', color: 'blue', size: 'medium', rotation: 0 },
          { shape: 'triangle', color: 'green', size: 'large', rotation: 120 },
          { shape: 'rectangle', color: 'yellow', size: 'small', rotation: 0 },
        ],
      },
    };
    console.warn(
      `[ShapeSorter] NO GENERATED CHALLENGE SURVIVED THE BUILD GATES — shipping the canned `
      + `${fallbackType} fallback. The lesson's topic is NOT reflected in this content.`,
    );
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.identify];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[ShapeSorter] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply config overrides
  if (config?.gradeBand !== undefined) data.gradeBand = config.gradeBand;

  // ── Apply the support tier deterministically, per challenge from its OWN mode ──
  // Difficulty is a STUDENT property: a blended/auto session gets it too (single
  // mode just happens to give every challenge the same tier). Gate on supportTier
  // ONLY — never on pinnedType — so blends aren't silently dropped.
  //
  // ⭐ `supportTier` IS NOW A SPOKEN LEVER, NOT ONLY A DISPLAY ONE. The script
  // reads it off the challenge to compose the DISTAR lead-in (easy = model +
  // guide, medium = model, hard = nothing) and, for a reader, to decide whether
  // a sort ask NAMES its groups aloud. The two surviving `show*` flags stay
  // display-only, and correctness is still derived from the geometry table, so
  // no flag can leak or invalidate an answer.
  if (supportTier) {
    for (const ch of data.challenges as ShapeSorterChallengeWithTier[]) {
      const scaffold = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      ch.supportTier = supportTier;
      if (ch.type === 'sort') ch.showBinCounts = scaffold.showBinCounts;
      if (ch.type === 'count') ch.showCornerHints = scaffold.showCornerHints;
    }
    console.log(`[ShapeSorter] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`);
  }

  return data;
};

/** A challenge as it arrives from the model and is narrowed in place. */
type ShapeDraft = { shape: string; color: string; size: string; rotation: number };
type ShapeSorterChallengeDraft = {
  id: string;
  type: string;
  instruction: string;
  ruleAttribute: string;
  targetValue?: string;
  shapes: ShapeDraft[];
};

/** Local view of a challenge augmented with the tier fields the script and the
 *  component read. Mirrors the optional fields on ShapeSorterChallenge. */
type ShapeSorterChallengeWithTier = ShapeSorterData['challenges'][number] & {
  supportTier?: SupportTier;
  showBinCounts?: boolean;
  showCornerHints?: boolean;
};
