/**
 * gemini-di-shapes — menu-scoped generator for the di-shapes primitive
 * (DI pack #5). Fork A (menu service, the rhyme-studio K / di-letter-sounds
 * pattern): the item CONTENT is a code-owned shape menu — name, article,
 * sides/corners, judged alternates, ASR aliases, and drawable geometry all
 * live in code — and Gemini's only job is the session wrapper (kid title +
 * description) plus a targetShapes hint used ONLY when the objective text
 * names no shapes itself. Structured-output Gemini never emits a shape's
 * facts; it picks from an enum.
 *
 * SCOPE: the objective text is code-enforced over the model's pick. Shapes
 * NAMED in the text win outright ("triangles and circles" → those, even an
 * extended shape at K — the objective asked for it); then the model's hint,
 * filtered to the grade menu; then the grade default (the K.G.2 five).
 *
 * EVAL MODES (L1, 2026-08-07). Four task identities, resolved per generation:
 * `name_shape` (base), `shape_review` (the same naming act over a WIDE
 * cumulative draw rather than the objective's focused set — the family review
 * convention), and the two attribute-counting skills `count_sides` /
 * `count_corners`. Fork A has no per-challenge schema to constrain, so the
 * resolution drives which challenge types we BUILD, exactly as di-math-facts
 * does. A blend or the unconstrained mixed path interleaves the modes so every
 * resolved identity actually appears (SP-21) — the top-level `challengeType` is
 * then representative metadata and the COMPONENT renders per challenge.
 *
 * COUNTING POOLS ARE POLYGON-ONLY (rule #1). A curved shape carries `sides:
 * null` — not-applicable, not zero — and "how many sides does a circle have?"
 * has two arguable answers for a young child (0 straight sides, or 1 continuous
 * curved edge). One drawing, one defensible answer is this pack's birth
 * discipline, so counting items are drawn from polygons only and a
 * curves-only scope falls back rather than emitting an unanswerable item.
 *
 * K CONVENTION (the pack's rule-#1 duty): at this band square and rectangle
 * are DIFFERENT answers, so the component draws rectangles clearly elongated
 * and ovals clearly non-circular — one drawing, one defensible name. The
 * "diamond" word belongs to rhombus as a judged alternate, never a menu entry.
 *
 * ANSWER-LEAK RULE: the wrapper (title/description) must never contain a
 * shape name — the child produces the answers; they never read or hear them
 * from the chrome first. This binds under the counting modes too: the shape's
 * name hands a child who knows it the count. Guarded in code, defaults on
 * violation.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import {
  isCountingType,
  type DiShapesChallenge,
  type DiShapesChallengeType,
  type DiShapeName,
} from "../../primitives/visual-primitives/direct-instruction/diShapesScript";
import type { DiShapesData } from "../../primitives/visual-primitives/direct-instruction/DiShapes";

// ── The code-owned shape menu ───────────────────────────────────────

interface ShapeSpec {
  word: string;
  article: 'a' | 'an';
  sides: number | null;
  corners: number | null;
  /** In the K.G.2 core five. Extended shapes serve G1+ or a naming objective. */
  core: boolean;
  /** Names the judge must also accept (stated per-item in the contract). */
  spokenAlternates?: string[];
  /** Passive ASR cross-check aliases (never the judge). */
  asrAliases: string[];
  /** Rotation cap (±deg). Square stays low — a 45° square reads as a diamond,
   *  which at K is a DIFFERENT percept than the skill being drilled. Curves
   *  don't rotate meaningfully. */
  maxRotationDeg: number;
}

export const SHAPE_MENU: Record<DiShapeName, ShapeSpec> = {
  circle: { word: 'circle', article: 'a', sides: null, corners: null, core: true, asrAliases: ['circle', 'circles', 'surkle'], maxRotationDeg: 0 },
  triangle: { word: 'triangle', article: 'a', sides: 3, corners: 3, core: true, asrAliases: ['triangle', 'triangles', 'twiangle'], maxRotationDeg: 25 },
  square: { word: 'square', article: 'a', sides: 4, corners: 4, core: true, asrAliases: ['square', 'squares', 'sware'], maxRotationDeg: 10 },
  rectangle: { word: 'rectangle', article: 'a', sides: 4, corners: 4, core: true, asrAliases: ['rectangle', 'rectangles', 'wectangle'], maxRotationDeg: 15 },
  hexagon: { word: 'hexagon', article: 'a', sides: 6, corners: 6, core: true, asrAliases: ['hexagon', 'hexagons'], maxRotationDeg: 25 },
  oval: { word: 'oval', article: 'an', sides: null, corners: null, core: false, asrAliases: ['oval', 'ovals'], maxRotationDeg: 0 },
  pentagon: { word: 'pentagon', article: 'a', sides: 5, corners: 5, core: false, asrAliases: ['pentagon', 'pentagons'], maxRotationDeg: 25 },
  rhombus: { word: 'rhombus', article: 'a', sides: 4, corners: 4, core: false, spokenAlternates: ['diamond'], asrAliases: ['rhombus', 'diamond', 'rhombuses'], maxRotationDeg: 15 },
  trapezoid: { word: 'trapezoid', article: 'a', sides: 4, corners: 4, core: false, asrAliases: ['trapezoid', 'trapezoids'], maxRotationDeg: 20 },
};

const ALL_SHAPES = Object.keys(SHAPE_MENU) as DiShapeName[];
const CORE_SHAPES = ALL_SHAPES.filter((s) => SHAPE_MENU[s].core);

/** Shapes that can carry a COUNTING item: straight-sided, so `sides`/`corners`
 *  are real numbers and the item has exactly one defensible answer. */
export const isPolygon = (shape: DiShapeName): boolean =>
  SHAPE_MENU[shape].sides !== null && SHAPE_MENU[shape].corners !== null;

const polygonsOf = (shapes: DiShapeName[]): DiShapeName[] => shapes.filter(isPolygon);

/** Spoken number words for the counting answers. The menu tops out at a
 *  hexagon, so 3..6 is the live range; 0..8 is carried for headroom and so a
 *  future menu addition cannot emit `undefined` into a cue (the item-10
 *  `NUMBER_WORDS[n]` lesson). */
const COUNT_WORDS: Record<number, string> = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
  5: 'five', 6: 'six', 7: 'seven', 8: 'eight',
};

/** Word → menu shape, including the K "diamond" word for rhombus. */
const SHAPE_WORD_LOOKUP: Record<string, DiShapeName> = {
  ...Object.fromEntries(ALL_SHAPES.map((s) => [SHAPE_MENU[s].word, s])),
  diamond: 'rhombus',
} as Record<string, DiShapeName>;

/** Shapes the objective text NAMES, in first-mention order, deduped. */
export const parseNamedShapes = (text: string): DiShapeName[] => {
  const named: DiShapeName[] = [];
  const re = new RegExp(
    `\\b(${Object.keys(SHAPE_WORD_LOOKUP).join('|')})s?\\b`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const shape = SHAPE_WORD_LOOKUP[m[1].toLowerCase()];
    if (shape && !named.includes(shape)) named.push(shape);
  }
  return named;
};

const isKindergarten = (gradeLevel: string): boolean =>
  /kinder|pre-?k|\bk\b/i.test(gradeLevel);

// ── Challenge builder (all fields derived — never from the LLM) ─────

/** Fisher-Yates. App code, not a workflow script — Math.random is fine. */
const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const rotationFor = (shape: DiShapeName): number => {
  const cap = SHAPE_MENU[shape].maxRotationDeg;
  if (cap === 0) return 0;
  return Math.round((Math.random() * 2 - 1) * cap);
};

/** Passive ASR aliases for a spoken count. Never the judge — the Live tutor
 *  judges the audio; these only cross-check the transcript. */
const countAliases = (n: number): string[] => [COUNT_WORDS[n] ?? String(n), String(n)];

const buildChallenge = (
  shape: DiShapeName,
  index: number,
  type: DiShapesChallengeType,
): DiShapesChallenge => {
  const spec = SHAPE_MENU[shape];
  const base: DiShapesChallenge = {
    id: `dish-${index + 1}-${shape}`,
    challengeType: type,
    shape,
    shapeWord: spec.word,
    article: spec.article,
    sides: spec.sides,
    corners: spec.corners,
    rotationDeg: rotationFor(shape),
    asrAliases: spec.asrAliases,
  };

  if (isCountingType(type)) {
    // Pool filtering guarantees a polygon here; the ?? 0 is a type narrowing
    // guard, not a fallback we expect to reach.
    const n = (type === 'count_corners' ? spec.corners : spec.sides) ?? 0;
    return {
      ...base,
      countNumeral: n,
      countWord: COUNT_WORDS[n] ?? String(n),
      // The answer is the COUNT, so the aliases must track the count. A shape
      // name is not an answer under these modes.
      asrAliases: countAliases(n),
    };
  }

  return spec.spokenAlternates
    ? { ...base, spokenAlternates: spec.spokenAlternates }
    : base;
};

/**
 * The session's shape sequence: every selected shape appears before any
 * repeats (variance), repeats fill round-robin over a reshuffle, and the same
 * shape never runs back-to-back when more than one is in play.
 */
export const buildShapeSequence = (
  selected: DiShapeName[],
  count: number,
): DiShapeName[] => {
  const out: DiShapeName[] = [];
  let pool = shuffle(selected);
  while (out.length < count) {
    if (pool.length === 0) pool = shuffle(selected);
    const next = pool.find((s) => s !== out[out.length - 1]) ?? pool[0];
    pool = pool.filter((s, i) => i !== pool.indexOf(next));
    out.push(next);
  }
  return out;
};

/** Split `total` into `k` shares as evenly as possible (di-math-facts). */
const distribute = (total: number, k: number): number[] => {
  const base = Math.floor(total / k);
  const rem = total % k;
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
};

const DEFAULT_INSTANCE_COUNT = 5;
const MAX_INSTANCE_COUNT = 6;

// ── Gemini wrapper (title/description/shape hint ONLY — Fork A) ─────

/** Skill docs for the intent→mode router (Fork A — no schema to constrain). */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  name_shape: {
    promptDoc:
      `"name_shape": the child sees ONE drawn flat shape at some rotation and SAYS ITS NAME ("triangle"). The base skill, drilled over the objective's focused set of shapes.`,
    schemaDescription: "'name_shape' (say the drawn shape's name)",
  },
  shape_review: {
    promptDoc:
      `"shape_review": cumulative / spaced review of shape NAMING — the same act as name_shape, but the shapes are drawn as a WIDE mix across everything taught at this grade rather than the objective's one focused set.`,
    schemaDescription: "'shape_review' (mixed cumulative naming review)",
  },
  count_sides: {
    promptDoc:
      `"count_sides": the child sees ONE drawn flat shape and SAYS HOW MANY SIDES it has ("three"). An attribute skill, not a naming skill — the answer is a number word. Straight-sided shapes only.`,
    schemaDescription: "'count_sides' (say how many sides)",
  },
  count_corners: {
    promptDoc:
      `"count_corners": the child sees ONE drawn flat shape and SAYS HOW MANY CORNERS (vertices) it has ("three"). Corners are harder to enumerate than sides — a point is easier to skip or double-count than a whole edge. Straight-sided shapes only.`,
    schemaDescription: "'count_corners' (say how many corners)",
  },
};

/** Every identity this pack can build, easiest → hardest (the mixed spread). */
const ALL_TYPES: DiShapesChallengeType[] = [
  'name_shape', 'shape_review', 'count_sides', 'count_corners',
];

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a young learner (e.g. 'Shape Detectives!'). " +
        "It MUST NOT contain any shape name — the shapes stay hidden until practice.",
    },
    description: {
      type: Type.STRING,
      description:
        "One friendly sentence telling the child they will look at shapes and answer out loud. " +
        "Same rule: no shape names.",
    },
    targetShapes: {
      type: Type.ARRAY,
      minItems: '2',
      maxItems: '6',
      items: { type: Type.STRING, enum: ALL_SHAPES as string[] },
      description:
        "Your read of which shapes this objective drills. Used only when the objective text " +
        "does not name shapes itself.",
    },
  },
  required: ["title", "targetShapes"],
};

/** Answer-leak guard: any judged shape word (or "diamond") in the wrapper. */
const leaksShapeNames = (text: string): boolean =>
  new RegExp(`\\b(${Object.keys(SHAPE_WORD_LOOKUP).join('|')})s?\\b`, 'i').test(text);

const DEFAULT_TITLE = 'Shape Time';
const DEFAULT_DESCRIPTION = 'Look at each shape and answer out loud!';

export const generateDiShapes = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    /** Eval mode pinned by the tester/curator. Wins over intent, no LLM call. */
    targetEvalMode?: string;
    [key: string]: unknown;
  },
): Promise<DiShapesData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // Shapes the objective NAMES win outright — even an extended shape at K,
  // because the objective asked for it (trust-intent ruling).
  const scopeText = `${intent ?? ''} ${config?.objectiveText ?? ''} ${topic}`;
  const namedShapes = parseNamedShapes(scopeText);
  const gradeMenu = isKindergarten(gradeLevel) ? CORE_SHAPES : ALL_SHAPES;

  // Which eval-mode SKILL(s) this objective calls for. Fork A: the resolution
  // drives which challenge types we BUILD (there is no per-challenge schema).
  const resolution = await resolveEvalModes(
    'di-shapes',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeTypes: DiShapesChallengeType[] =
    (resolution?.allowedTypes as DiShapesChallengeType[] | undefined) ?? ALL_TYPES; // mixed = all four

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let modelShapes: DiShapeName[] = [];

  const prompt = `Scope a brisk Direct Instruction shape practice (a drawn 2D shape on screen, spoken answers) for a young learner.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

RULES:
- Read the objective and pick which flat shapes it drills from the allowed list. A generic kindergarten shapes objective means the basic set: circle, triangle, square, rectangle, hexagon.
- Write a warm, short kid title and a one-sentence description. They MUST NOT contain any shape name — the child must produce the answers, never read or hear them first.

Return the wrapper JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wrapperSchema,
        systemInstruction:
          "You are an early-math specialist scoping a Direct Instruction shape drill. " +
          "You classify which flat shapes the objective drills and write a warm kid-facing title " +
          "and description. You never reveal any shape name in the title or description.",
      },
    });
    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as {
        title?: string;
        description?: string;
        targetShapes?: unknown;
      };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (Array.isArray(parsed.targetShapes)) {
        modelShapes = parsed.targetShapes
          .filter((s): s is DiShapeName => typeof s === 'string' && s in SHAPE_MENU);
      }
    }
  } catch (error) {
    console.error("Error generating di-shapes wrapper:", error);
  }

  // Answer-leak guard: the wrapper must never carry a shape name.
  if (leaksShapeNames(title) || leaksShapeNames(description)) {
    title = DEFAULT_TITLE;
    description = DEFAULT_DESCRIPTION;
  }

  // Scope ladder: named in text → model hint (grade-filtered) → grade default.
  const hinted = modelShapes.filter((s) => gradeMenu.includes(s));
  const selected: DiShapeName[] =
    namedShapes.length > 0 ? namedShapes
      : hinted.length >= 2 ? hinted
        : CORE_SHAPES;
  const scopeSource = namedShapes.length > 0 ? 'text' : hinted.length >= 2 ? 'model' : 'grade-default';

  /**
   * The shape pool for one task identity.
   * - naming: the objective's resolved scope.
   * - review: the WIDE grade menu instead of the focused set — a cumulative
   *   draw is the whole point (the fact_review precedent). But review widens
   *   the DEFAULT, never an explicit ask: if the objective NAMED its shapes,
   *   those still win outright (the pack's standing scope doctrine, and the
   *   trust-intent ruling — a curator who asked for triangles and circles must
   *   not get a hexagon back because the mode happened to resolve to review).
   * - counting: polygons only. A curves-only scope has no answerable item, so
   *   it widens to the grade's polygons rather than emitting one.
   */
  let countingScopeWidened = false;
  const poolFor = (type: DiShapesChallengeType): DiShapeName[] => {
    if (type === 'shape_review') return namedShapes.length > 0 ? namedShapes : gradeMenu;
    if (!isCountingType(type)) return selected;
    const scoped = polygonsOf(selected);
    if (scoped.length > 0) return scoped;
    const gradePolygons = polygonsOf(gradeMenu);
    countingScopeWidened = true;
    console.log(
      `[DiShapes] ${type}: scoped shapes are curved (no side/corner count) — widening to the grade's polygons.`,
    );
    return gradePolygons.length > 0 ? gradePolygons : polygonsOf(CORE_SHAPES);
  };

  // Build from the resolved mode(s). Single mode → all one skill; blend or
  // mixed → an interleaved spread so every resolved identity appears (SP-21).
  let challenges: DiShapesChallenge[];
  if (modeTypes.length === 1) {
    challenges = buildShapeSequence(poolFor(modeTypes[0]), count)
      .map((shape, i) => buildChallenge(shape, i, modeTypes[0]));
  } else {
    const shares = distribute(count, modeTypes.length);
    const perMode = modeTypes.map((t, i) => buildShapeSequence(poolFor(t), shares[i]));
    const interleaved: Array<{ shape: DiShapeName; type: DiShapesChallengeType }> = [];
    const maxLen = Math.max(...perMode.map((s) => s.length));
    for (let round = 0; round < maxLen; round++) {
      for (let m = 0; m < modeTypes.length; m++) {
        const shape = perMode[m][round];
        if (shape) interleaved.push({ shape, type: modeTypes[m] });
      }
    }
    challenges = interleaved
      .slice(0, count)
      .map(({ shape, type }, i) => buildChallenge(shape, i, type));
  }

  // Guarantee a runnable session even if every pool emptied out.
  if (challenges.length === 0) {
    challenges = buildShapeSequence(CORE_SHAPES, count)
      .map((shape, i) => buildChallenge(shape, i, 'name_shape'));
  }

  // The wrapper was written from the objective BEFORE the pools were built, so
  // when a counting session had to widen off a curves-only ask the chrome
  // describes shapes the child will never see. A live probe produced exactly
  // that: "Curve Safari! … look at some smooth outlines" over five polygons.
  // Fall back to the neutral defaults — the same revert-to-safe-defaults shape
  // as the answer-leak guard above.
  if (countingScopeWidened) {
    title = DEFAULT_TITLE;
    description = DEFAULT_DESCRIPTION;
  }

  // Session identity = the first item's skill (a pinned mode → that mode). On a
  // blended/mixed session this is representative metadata ONLY — the component
  // renders and cues from each challenge's own challengeType.
  const primaryType: DiShapesChallengeType = challenges[0]?.challengeType ?? 'name_shape';

  const data: DiShapesData = {
    title,
    description,
    challengeType: primaryType,
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
  };

  console.log("DI Shapes Generated:", {
    title: data.title,
    modes: resolution
      ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})`
      : 'mixed',
    types: modeTypes.join(', '),
    scope: `${selected.join('+')} [${scopeSource}]`,
    items: challenges.map((c) => `${c.challengeType}:${c.shape}@${c.rotationDeg}°${
      c.countWord ? `→${c.countWord}` : ''
    }`),
    count: challenges.length,
  });

  return data;
};
