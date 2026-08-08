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
 * SUPPORT TIERS (L3, 2026-08-07). `config.difficulty` stamps a per-challenge
 * `supportTier` that the SCRIPT composes the cue from — easy = model + guide +
 * test, medium = model + test, hard = the ask alone. It is applied at the very
 * END, per challenge, from each challenge's OWN mode, and gated only on a tier
 * being present so a blended/mixed session gets it too.
 *
 * STRUCTURAL DIFFICULTY (L4, 2026-08-07). The SAME `config.difficulty` dial also
 * changes the PROBLEM, not just the help — because L3 alone left easy/medium/hard
 * drawing byte-identical pictures with only the spoken scaffold toggled, so a
 * child who had mastered the mode had nowhere left to climb. The lever is
 * EXEMPLAR TYPICALITY: how far the drawn instance sits from the prototype the
 * child has memorised, across three sub-dials that are one lever —
 *   exemplar   prototype (the textbook picture) → variant (scalene obtuse
 *              triangle, irregular hexagon, portrait rectangle)
 *   rotation   near-upright → up to the shape's rule-#1 safe ceiling
 *   scale      fixed → varied
 * A child who only ever meets the prototype learns the PICTURE, not the shape.
 * Separating defining attributes (three straight sides, three corners) from
 * non-defining ones (which way up, how regular, how big) IS the skill — it is
 * the literal wording of both curriculum homes /curriculum-fit measured for this
 * pack (K `GEOM001-01-A` "…regardless of size, color, or orientation";
 * G1 `GEOM001-01-c` "defining versus non-defining attributes").
 *
 * THE GUARDRAIL, stated truthfully: a tier changes how each selected shape is
 * DRAWN. It never changes the ANSWER (a scalene triangle is still "triangle",
 * still three sides), never changes which shapes are SELECTED (that is the
 * objective's business, not the student's level), never changes the counts, the
 * item count, or the mode identity. The rotation ceiling is a rule-#1 guard, not
 * a knob: a square at 45° reads as a DIAMOND, which is a judged alternate for
 * rhombus, so it would be an item with two right answers. See SAFE_ROTATION_DEG.
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
  type DiShapesSupportTier,
  type ShapeExemplar,
} from "../../primitives/visual-primitives/direct-instruction/diShapesScript";
import {
  hasVariantDrawing,
  SAFE_ROTATION_DEG,
} from "../../primitives/visual-primitives/direct-instruction/diShapesGeometry";
import type { DiShapesData } from "../../primitives/visual-primitives/direct-instruction/DiShapes";

// ── Support tier harness (L3) ───────────────────────────────────────

type SupportTier = DiShapesSupportTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; the L0/L1 easy shape stands). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * How much of the DISTAR sequence precedes the child's answer.
 *
 * The withdrawal is IDENTICAL across all four eval modes, and that is correct
 * rather than lazy: every mode is the same act (look at the drawing, produce
 * the answer aloud), so the same three sub-steps precede it. What a MODE
 * changes is which shapes are drawn and how the cue is phrased (the script owns
 * that); what a TIER changes is how much of the sequence is handed over. Kept
 * per-type-capable so a future mode can diverge.
 *
 * This is axis ONE of the tier. It moves only the SPOKEN scaffold; how the shape
 * is DRAWN is axis two (resolveProblemShape, L4). Neither axis changes which
 * shapes are selected, the counts, or the item count — see TIER_GUARDRAIL.
 */
const resolveSupportStructure = (
  _type: DiShapesChallengeType,
  tier: SupportTier,
): { tier: SupportTier; describe: string } => ({
  tier,
  describe:
    tier === 'hard'
      ? 'cold answer — no model, no choral practice; the child retrieves it unaided'
      : tier === 'medium'
        ? 'modeled once, then answered alone — the choral "Together" step is withdrawn'
        : 'modeled and practiced together first — the full DISTAR sequence',
});

// ── Structural difficulty (L4) ──────────────────────────────────────

/**
 * TIER_GUARDRAIL — what a tier may and may not change, stated once so the two
 * axes cannot drift apart.
 *
 * MAY change (structure — the percept the child must resolve):
 *   the DRAWING (prototype vs non-prototypical variant), how far it is rotated
 *   within the shape's own cap, how large it is drawn, and the ORDER items
 *   appear in (whether confusable neighbours sit side by side).
 * MAY NOT change (magnitude / identity):
 *   WHICH shapes are drawn (the objective's scope wins — named shapes above
 *   all), the grade menu, the item count, the counts themselves, or the eval
 *   mode. And never the rule-#1 guards: a rectangle stays ≥1.6:1, an oval
 *   stays clearly non-circular, a counting item stays a polygon, and a shape's
 *   rotation cap is never RAISED (a 45° square reads as a diamond — a
 *   different percept, not a harder one).
 *
 * The answer is untouched at every tier, by construction: a scalene triangle is
 * still "triangle" and still has three sides. That is what makes this a
 * difficulty axis rather than a different question.
 */
const TIER_GUARDRAIL =
  'structure changes (which drawing, how rotated, how large, what sits next to what); '
  + 'the shapes, their counts, and the mode identity do not';

/** The two error classes the catalog itself names: "a rectangle is not a
 *  square, a circle is not an oval, and a hexagon is not a pentagon". At `hard`
 *  these are deliberately placed side by side — the near-neighbour made real
 *  for a pack that has no multiple-choice distractors to tighten. */
const CONFUSABLE_NAME_PAIRS: ReadonlyArray<readonly [DiShapeName, DiShapeName]> = [
  ['square', 'rectangle'],
  ['circle', 'oval'],
  ['hexagon', 'pentagon'],
];

interface ProblemShape {
  /** Which drawing to use. `variant` = non-prototypical where one exists. */
  exemplar: ShapeExemplar;
  /**
   * WHICH ceiling this tier rotates within — never a fraction of the safe one.
   *
   * A fraction of the SAFE ceiling was the first design and it was wrong at
   * runtime, in a way no stubbed test could see. Shapes have wildly different
   * safe ceilings (square 15°, triangle 180°), so "25% of safe" means ±4° for a
   * square and ±45° for a triangle — and a live `easy` probe duly handed a
   * Kindergartener a triangle at −36° and a `medium` one at −91°, nearly on its
   * side. The tier's own promise ("easy = near-upright") was true only relative
   * to each shape, which is not what a five-year-old experiences.
   *
   * So the ladder interpolates between the two ceilings the pack already has:
   *   half-gentle  half the untiered default — unambiguously upright, every shape
   *   gentle       the untiered L0 default (triangle 25°) — today's shipped feel
   *   safe         the rule-#1 ceiling (triangle 180°) — the real climb
   * `medium` therefore reproduces the pre-L4 drawing exactly, which makes the
   * tier ladder a superset of what shipped rather than a re-tuning of it.
   */
  rotationBase: 'half-gentle' | 'gentle' | 'safe';
  /** Inclusive draw-size band, as a percentage of the canonical stage size. */
  scaleRange: readonly [number, number];
  /** How the session orders confusable neighbours. */
  adjacency: 'separate' | 'natural' | 'confusable';
  describe: string;
}

/**
 * The structural shape of one item at one tier — the second dial of the single
 * `config.difficulty` enum (axis 1 is resolveSupportStructure above).
 *
 * FORK A MAKES THIS AXIS PURELY CODE-ENFORCED, and that is worth stating rather
 * than assuming. The reference implementations (regrouping-workbench, bar-model)
 * split the lever across two places — a prompt line that DESCRIBES the harder
 * shape to the LLM, then a post-process that ENFORCES the exact value, because
 * the LLM authors the item content and drifts. Here the LLM authors no item
 * content at all: the shape menu, the geometry, the rotations, the counts and
 * the ordering are all code-owned, and Gemini writes only the title and
 * description. So there is no prompt half to keep in sync and nothing to
 * validate an LLM against — `resolveProblemShape` is consumed by the enforcer
 * alone. One dial, one place, no drift possible.
 *
 * The lever is identical across all four eval modes because the percept is the
 * same act in every one (resolve the drawing, then either name it or enumerate
 * it). What differs per mode is only what "confusable" MEANS — a near NAME for
 * the naming modes, a near COUNT for the counting ones — and that lives in
 * `confusableWith` below.
 */
/**
 * The rotation ceiling one tier draws within, in DEGREES — resolved per shape,
 * because the two shapes at the extremes (circle 0°, triangle 180°) cannot share
 * one number and cannot share one fraction either. See `rotationBase`.
 *
 * `gentle` is the menu's own `maxRotationDeg`, the value the pack shipped with
 * before there were tiers, so `medium` reproduces the pre-L4 drawing exactly.
 * `safe` is the rule-#1 ceiling and is never exceeded at any tier.
 */
const rotationCeilingFor = (
  shape: DiShapeName,
  base: ProblemShape['rotationBase'],
): number => {
  const gentle = SHAPE_MENU[shape].maxRotationDeg;
  if (base === 'safe') return SAFE_ROTATION_DEG[shape];
  if (base === 'gentle') return gentle;
  return Math.round(gentle / 2);
};

const resolveProblemShape = (
  _type: DiShapesChallengeType,
  tier: SupportTier,
): ProblemShape => {
  switch (tier) {
    case 'hard':
      return {
        exemplar: 'variant',
        rotationBase: 'safe',
        scaleRange: [62, 100],
        adjacency: 'confusable',
        describe:
          'non-prototypical drawings (scalene/obtuse triangle, irregular hexagon, portrait '
          + 'rectangle) at the full rotation cap and varied size, with confusable neighbours '
          + 'placed side by side',
      };
    case 'medium':
      return {
        exemplar: 'prototype',
        rotationBase: 'gentle',
        scaleRange: [85, 100],
        adjacency: 'natural',
        describe: 'textbook drawings, moderately rotated, mild size variation',
      };
    case 'easy':
    default:
      return {
        exemplar: 'prototype',
        rotationBase: 'half-gentle',
        scaleRange: [100, 100],
        adjacency: 'separate',
        describe:
          'textbook drawings, near-upright, full size, with confusable neighbours kept apart',
      };
  }
};

/**
 * Are these two items near neighbours — the pair a child is most likely to
 * confuse? Mode-aware, because the answer classes differ:
 *  - naming vs naming: a near NAME (square/rectangle, circle/oval, hexagon/pentagon).
 *  - counting vs counting: a near COUNT — exactly one apart, which is the
 *    off-by-one that side/corner counting exists to correct.
 *  - across the two classes: not comparable, so never "confusable".
 */
const confusableWith = (a: DiShapesChallenge, b: DiShapesChallenge): boolean => {
  const aCount = isCountingType(a.challengeType);
  const bCount = isCountingType(b.challengeType);
  if (aCount !== bCount) return false;
  if (aCount) {
    return a.countNumeral != null && b.countNumeral != null
      && Math.abs(a.countNumeral - b.countNumeral) === 1;
  }
  return CONFUSABLE_NAME_PAIRS.some(
    ([x, y]) => (a.shape === x && b.shape === y) || (a.shape === y && b.shape === x),
  );
};

/**
 * Re-order a session so confusable neighbours sit together (`confusable`) or
 * stay apart (`separate`). Greedy from the existing order, which preserves what
 * buildShapeSequence already guaranteed — every selected shape appears before
 * any repeat — while adding the adjacency preference on top.
 *
 * INVARIANT PRESERVED: the same shape never runs back-to-back (the pack's
 * variance rule), so the reordering can never collapse a session into a run of
 * one shape. It is a permutation only: no item is added, dropped, or altered.
 */
const applyAdjacency = (
  challenges: DiShapesChallenge[],
  adjacency: ProblemShape['adjacency'],
): DiShapesChallenge[] => {
  if (adjacency === 'natural' || challenges.length < 3) return challenges;
  const want = adjacency === 'confusable';
  const remaining = [...challenges];
  // (Seeding the walk from an item that HAS a confusable partner was tried and
  // MEASURED: 1.54 → 1.46 mean adjacencies over 200 sessions, i.e. nothing. The
  // binding constraint is pool composition, not the starting item, so the extra
  // branch was reverted rather than kept on a plausible-sounding argument.)
  const out: DiShapesChallenge[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const prev = out[out.length - 1];
    const legal = remaining.filter((c) => c.shape !== prev.shape);
    const pool = legal.length > 0 ? legal : remaining;
    // Prefer a neighbour that matches the tier's intent; fall back to the next
    // legal item when the pool offers no such pairing (honest saturation — a
    // session of five triangles has no confusable pair to place).
    const preferred = pool.find((c) => confusableWith(prev, c) === want) ?? pool[0];
    out.push(preferred);
    remaining.splice(remaining.indexOf(preferred), 1);
  }
  return repairBackToBack(out);
};

/**
 * A greedy walk can paint itself into a corner: pulling the confusable pairs
 * forward can strand the session's two triangles side by side at the tail, and
 * the same shape twice in a row is the ONE ordering rule this pack already had
 * (buildShapeSequence's variance guarantee) — a tier must not cost it.
 *
 * Repair by swapping a clashing item with any position where BOTH resulting
 * neighbourhoods come out clean. A session with no legal arrangement at all
 * (five triangles from a single-shape objective) is left as it is — that case
 * is genuinely unfixable and buildShapeSequence tolerates it for the same
 * reason.
 */
const repairBackToBack = (items: DiShapesChallenge[]): DiShapesChallenge[] => {
  const clean = (arr: DiShapesChallenge[], i: number): boolean =>
    (i === 0 || arr[i - 1].shape !== arr[i].shape)
    && (i === arr.length - 1 || arr[i + 1].shape !== arr[i].shape);
  let out = items;
  for (let i = 1; i < out.length; i++) {
    if (out[i].shape !== out[i - 1].shape) continue;
    for (let j = 0; j < out.length; j++) {
      if (j === i || j === i - 1) continue;
      const trial = [...out];
      [trial[i], trial[j]] = [trial[j], trial[i]];
      if (clean(trial, i) && clean(trial, j)) { out = trial; break; }
    }
  }
  return out;
};

/** How many adjacent pairs in this session are near neighbours. The measurable
 *  the tier is actually moving — logged, and asserted in the tests. */
export const countConfusableAdjacencies = (challenges: DiShapesChallenge[]): number =>
  challenges.reduce(
    (n, ch, i) => (i > 0 && confusableWith(challenges[i - 1], ch) ? n + 1 : n),
    0,
  );

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
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second field of the two-field contract: targetEvalMode = which shape
     * skill, difficulty = how hard it is WITHIN that skill. ONE enum driving
     * both within-mode dials — how much of the DISTAR sequence precedes the
     * answer (L3) and how far the drawn instance sits from the prototype the
     * child has memorised (L4: exemplar, rotation, scale, and what sits next to
     * what). It never changes WHICH shapes are drawn, the counts, the item
     * count, or the mode identity — see TIER_GUARDRAIL.
     */
    difficulty?: string;
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
  const supportTier = normalizeSupportTier(config?.difficulty);

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

  // ── Both tier axes, applied deterministically at the END ───────────
  // Gated ONLY on a tier being present, and resolved from each challenge's OWN
  // mode — difficulty is a STUDENT property, so a blended/mixed session must get
  // it too (gating on a single pinned mode is the silent no-op this layer exists
  // to kill). It runs after every structural fixup above, so nothing downstream
  // can re-open a fade the tier just closed. The no-tier path is untouched:
  // every field written here is optional and absent without a tier.
  //
  // One enum, two dials: resolveSupportStructure (L3 — how much of the DISTAR
  // sequence precedes the answer) and resolveProblemShape (L4 — which drawing,
  // how rotated, how large, what sits next to what). See TIER_GUARDRAIL.
  if (supportTier) {
    let saturatedExemplars = 0;
    for (const ch of challenges) {
      ch.supportTier = resolveSupportStructure(ch.challengeType, supportTier).tier;

      const shape = resolveProblemShape(ch.challengeType, supportTier);

      // Exemplar. A circle and a square have no non-prototypical drawing, so
      // they saturate at the prototype — counted and logged rather than
      // silently pretending the lever moved.
      const wantsVariant = shape.exemplar === 'variant';
      const exemplar: ShapeExemplar =
        wantsVariant && hasVariantDrawing(ch.shape) ? 'variant' : 'prototype';
      if (wantsVariant && exemplar === 'prototype') saturatedExemplars += 1;
      ch.exemplar = exemplar;

      // Rotation: a FRACTION of this shape's SAFE ceiling, re-rolled so the tier
      // owns the value. The ceiling is the rule-#1 guard (past it a drawing
      // gains a second defensible answer — a 45° square is a diamond) and is
      // never raised; the tier only chooses how much of it to use.
      //
      // The safe ceiling is deliberately NOT the menu's `maxRotationDeg`. That
      // one is a gentle untiered default (triangle 25°), and a triangle that
      // never leaves 25° means this pack has never actually tested the thing
      // K.G.2 asks for — "name shapes regardless of their orientations". A
      // point-down triangle at 180° is the single best item in the menu for
      // that standard, and `hard` is where it belongs.
      const ceiling = rotationCeilingFor(ch.shape, shape.rotationBase);
      ch.rotationDeg = ceiling === 0 ? 0 : Math.round((Math.random() * 2 - 1) * ceiling);

      // Size. "Regardless of size" is half of K.G.2's own wording.
      const [lo, hi] = shape.scaleRange;
      ch.scalePct = lo === hi ? lo : Math.round(lo + Math.random() * (hi - lo));
    }

    // Ordering is a session-level lever, so it runs once over the whole set.
    challenges = applyAdjacency(
      challenges,
      resolveProblemShape(challenges[0]?.challengeType ?? 'name_shape', supportTier).adjacency,
    );

    const shape = resolveProblemShape(challenges[0]?.challengeType ?? 'name_shape', supportTier);
    console.log(
      `[DiShapes] Tier "${supportTier}" applied per-challenge (${
        modeTypes.length === 1 ? `single-mode ${modeTypes[0]}` : 'blended'
      }) — support: ${resolveSupportStructure(challenges[0]?.challengeType ?? 'name_shape', supportTier).describe}`
      + `; structure: ${shape.describe}`
      + `; confusable adjacencies ${countConfusableAdjacencies(challenges)}/${challenges.length - 1}`
      + (saturatedExemplars > 0
        ? ` (${saturatedExemplars} exemplar${saturatedExemplars === 1 ? '' : 's'} saturated — circle/square have no variant drawing)`
        : '')
      + `. Guardrail: ${TIER_GUARDRAIL}.`,
    );
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
    tier: supportTier ?? 'none (easy shape)',
    scope: `${selected.join('+')} [${scopeSource}]`,
    items: challenges.map((c) => `${c.challengeType}:${c.shape}@${c.rotationDeg}°${
      c.countWord ? `→${c.countWord}` : ''
    }`),
    count: challenges.length,
  });

  return data;
};
