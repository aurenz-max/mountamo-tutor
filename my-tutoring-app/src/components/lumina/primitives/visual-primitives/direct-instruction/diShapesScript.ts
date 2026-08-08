/**
 * diShapesScript — HAND-AUTHORED Direct Instruction script for the di-shapes
 * primitive (DI pack #5, born 2026-08-06 from the user's modality call:
 * "this is a triangle — what is this, how many sides does it have"). The exact
 * wording IS the pedagogy (DISTAR discipline), so these lines are authored per
 * pack, never generated. Item CONTENT (which shapes, their geometry, rotation,
 * the counts) is generator-scoped to the objective; this module owns only the
 * model/guide/test/verify/correction cue SHAPE and the in-band judging contract.
 *
 * DISTAR shape work: the tutor MODELS the answer while the child looks at the
 * drawn shape ("Listen: this shape is a triangle."), GUIDES it together, then
 * TESTS ("Your turn. What shape is this?") and judges the spoken answer from the
 * audio it heard. The cue skeleton is the bench-proven family shape (model →
 * guide → test, verify opens "Yes", correction opens "My turn") — the same lines
 * every sitting has validated across four packs. L3 (2026-08-07) makes how much
 * of that sequence is spoken a per-item SUPPORT TIER — see DiShapesSupportTier.
 *
 * TWO RESPONSE CLASSES, both already benched (standing gate 1 satisfied without
 * a new sitting):
 *   - NAMING (`name_shape`, `shape_review`) — a single common word from a small
 *     closed set, inside the word-reading bench's single-spoken-word class. The
 *     "Shapes" bench probe set stresses its two shape-specific risks:
 *     square-vs-rectangle and circle-vs-oval discrimination.
 *   - COUNTING (`count_sides`, `count_corners`) — a spoken NUMBER WORD in 3..8,
 *     the class benched for di-math-facts at #46 and re-affirmed across every
 *     math-facts sitting. No multi-word numerals arise here (the menu's largest
 *     polygon is a hexagon), so the item-10 compound-numeral risk is out of
 *     scope by construction.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn") —
 * collision-checked against every line below for EVERY challenge type in
 * `diShapesScript.test.ts`. Standing gate 3 holds: every correction re-models
 * the answer then re-elicits.
 *
 * CORRECTION SHAPE: contrastive-preferred, the 2026-07-25 family ruling — a
 * child who says "rectangle" at a square must HEAR "not rectangle — this shape
 * is a square", because the near-name is exactly the error this practice exists
 * to catch. The counting modes carry the same shape over the near-COUNT ("not
 * four — this shape has three sides"), which is the equivalent error class:
 * a miscount by one is what side/corner counting exists to correct.
 * `correctionLine` stays the fallback for a non-answer.
 *
 * ANSWER-LEAK RULE: the drawn shape is the stimulus and the spoken answer is
 * the answer — it never appears on screen (or in the session title or
 * description) before the child says it. This binds BOTH classes: under a
 * counting mode the COUNT is the answer, and the shape's NAME is a strong hint
 * for any child who already knows it (triangle → three), so names stay hidden
 * pre-answer under every mode. The labeled reward is a POST-affirmation beat.
 *
 * K CONVENTION, stated once: at this band a clearly-elongated rectangle is a
 * rectangle and a square is a square — "a square is a rectangle" is a G3+
 * abstraction, and the generator draws rectangles at ≥1.6:1 so the two are
 * never both defensible for one drawing (the rule-#1 / R12 class). The same
 * geometry duty covers oval-vs-circle.
 *
 * WHY CURVED SHAPES NEVER CARRY A COUNTING ITEM (rule #1, decided at L1): "how
 * many sides does a circle have?" has no single defensible answer for a young
 * child — 0 (no STRAIGHT sides) and 1 (one continuous curved edge) are both
 * arguable, and the curriculum's own G1 subskill lists circle as (0 sides, 0
 * vertices) while this pack's menu models curved shapes as `sides: null`,
 * i.e. not-applicable rather than zero. One drawing, one defensible answer is
 * the pack's birth discipline, so the generator draws counting items from
 * POLYGONS only. A deliberate zero/none contrast is a real teaching move but a
 * different item shape and a different response class — queued, not smuggled in.
 */

/** The pack's task identities. L0 shipped `name_shape` alone; L1 adds the
 *  cumulative naming review and the two attribute-counting skills (the "how
 *  many sides does it have" half of the founding modality call). */
export type DiShapesChallengeType =
  | 'name_shape'
  | 'shape_review'
  | 'count_sides'
  | 'count_corners';

/**
 * The within-mode SUPPORT tier (L3, 2026-08-07). Second field of the two-field
 * contract: `challengeType` = WHICH shape skill, `supportTier` = HOW MUCH of the
 * DISTAR sequence the child is handed before they answer. Fourth use of the DI
 * L3 template (di-sentence-reading 07-25 the original, di-math-facts and
 * di-letter-sounds 08-01):
 *
 *   easy   MODEL + GUIDE + TEST   hear the answer twice, then say it alone
 *   medium MODEL + TEST           hear it once, then say it alone
 *   hard   TEST only              answer COLD, never having heard it
 *
 * Why `hard` matters here: the model line SPEAKS the very answer the child is
 * about to produce — the echo route. Withdrawing it turns the item into a
 * genuine retrieval probe (see this drawing, retrieve its name / enumerate its
 * sides) and makes the silent `responseMs` true retrieval time rather than
 * partly an echo delay.
 *
 * ONE PACK-SPECIFIC SIMPLIFICATION, worth stating because the sibling packs
 * needed carve-outs and this one does not: the STIMULUS here is DRAWN, never
 * spoken. di-letter-sounds had to keep speaking the stimulus word at `hard`
 * (an onset ask has no printed grapheme), so its fade needed a per-mode
 * inversion guard. Here the stimulus is already on screen at every tier, and
 * `ask()` is answer-free by construction under all four identities — so `hard`
 * reduces to exactly `testLine(it)` with no carve-out on any mode.
 *
 * NEVER withdrawn at any tier:
 *  - the drawn shape (it IS the task — withdrawing it changes the identity);
 *  - the CORRECTION's re-model, plain OR contrastive (standing gate 3 — DISTAR
 *    always re-models on an error; remediation is not scaffolding);
 *  - the restating AFFIRM (it models the answer where it is most useful);
 *  - the judging contract (a tier changes how much help precedes the attempt,
 *    never how it is judged — else tiers stop being comparable evidence).
 */
export type DiShapesSupportTier = 'easy' | 'medium' | 'hard';

/**
 * Which DRAWING of a shape an item puts on screen — the L4 structural axis
 * (2026-08-07). `prototype` is the textbook picture (upright isoceles triangle,
 * regular hexagon, landscape rectangle); `variant` is the same shape by its
 * DEFINING attributes drawn against that prototype (scalene obtuse triangle,
 * irregular hexagon, portrait rectangle).
 *
 * This is the pack's structural lever precisely because the ANSWER is unchanged:
 * a scalene triangle is still "triangle" and still has three sides. What gets
 * harder is the percept — a child who learned the picture rather than the shape
 * fails the variant, which is the G1 defining-vs-non-defining-attributes skill
 * (`GEOM001-01-c`) and the "regardless of size, color, or orientation" half of
 * K's `GEOM001-01-A`. The geometry itself, and the guards on it, live in
 * `diShapesGeometry.ts`.
 */
export type ShapeExemplar = 'prototype' | 'variant';

/** Shapes the pack can draw. CORE = the K.G.2 five; the rest are the
 *  generator's extended menu (G1+, or named by the objective). */
export type DiShapeName =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'rectangle'
  | 'hexagon'
  | 'oval'
  | 'pentagon'
  | 'rhombus'
  | 'trapezoid';

/** One drawn shape the tutor drills. Mirrors the generator output. */
export interface DiShapesChallenge {
  id: string;
  challengeType: DiShapesChallengeType;
  /** How much of the DISTAR sequence precedes the child's answer. Absent =
   *  easy (the L0/L1 shape), so a session generated before L3 behaves exactly
   *  as it did. */
  supportTier?: DiShapesSupportTier;
  /** Which shape the component draws — geometry is code-owned per name. */
  shape: DiShapeName;
  /** The shape's name, e.g. "triangle". Under a NAMING mode this is the spoken
   *  target; under a COUNTING mode it is still withheld pre-answer (it hints
   *  the count). Never rendered pre-affirmation under any mode. */
  shapeWord: string;
  /** Indefinite article for the cue lines ("a triangle", "an oval"). */
  article: 'a' | 'an';
  /** Straight sides / corners; null for curved shapes, which therefore never
   *  carry a counting item (see the module docblock). */
  sides: number | null;
  corners: number | null;
  /** COUNTING modes only: the numeric answer this item asks for (its `sides`
   *  or its `corners`, per challengeType) and its spoken number word. Both are
   *  derived in code by the generator — the LLM never emits either. */
  countNumeral?: number;
  countWord?: string;
  /** Generator-stamped rotation (degrees) so "regardless of orientation"
   *  (K.G.2) is real and the render is deterministic from data. The L4 tier
   *  scales the FRACTION of each shape's own cap used here; it never raises the
   *  cap (a 45° square reads as a diamond — a different percept, not a harder
   *  one). */
  rotationDeg: number;
  /** Which drawing to render (L4). Absent = `prototype`, the pre-L4 shape. */
  exemplar?: ShapeExemplar;
  /** Draw size as a percentage of the canonical stage size (L4). Absent = 100.
   *  "Regardless of SIZE" is the other half of K.G.2's orientation clause. */
  scalePct?: number;
  /** Whole-token ASR aliases for THIS item's answer — passive cross-check
   *  only, never the judge. Shape-name aliases under a naming mode, number-word
   *  aliases under a counting mode. */
  asrAliases?: string[];
  /** Names the judge must ALSO accept as correct (e.g. "diamond" for a
   *  rhombus — the K word for it). Naming modes only; a count has no synonym. */
  spokenAlternates?: string[];
}

/** True for the two attribute-counting identities (spoken number-word answer). */
export const isCountingType = (type: DiShapesChallengeType): boolean =>
  type === 'count_sides' || type === 'count_corners';

/** The countable feature this item asks about, in the child's word. K-1
 *  curriculum vocabulary is "corners"; "vertices" is the G1+ formal term and
 *  deliberately NOT spoken to a five-year-old. */
export const countNoun = (type: DiShapesChallengeType): 'sides' | 'corners' =>
  type === 'count_corners' ? 'corners' : 'sides';

/** The spoken answer for one item: a shape name, or a number word. */
export const answerWordFor = (it: DiShapesChallenge): string =>
  isCountingType(it.challengeType) ? (it.countWord ?? '') : it.shapeWord;

/** The MODELLED statement — the sentence the tutor asserts about the drawing.
 *  "this shape is a triangle" / "this shape has three sides". */
const statement = (it: DiShapesChallenge): string =>
  isCountingType(it.challengeType)
    ? `this shape has ${it.countWord} ${countNoun(it.challengeType)}`
    : `this shape is ${it.article} ${it.shapeWord}`;

/** The ASK — the one sentence spoken WITHOUT the answer in it. */
const ask = (it: DiShapesChallenge): string =>
  isCountingType(it.challengeType)
    ? `How many ${countNoun(it.challengeType)} does this shape have?`
    : `What shape is this?`;

/** MODEL: the tutor states the answer once. Single repetition — brisk pacing is
 *  the product at this age (bench run-2 timing ruling). */
export const modelLine = (it: DiShapesChallenge) =>
  `Listen: ${statement(it)}.`;

/** GUIDE: tutor and learner say it together. */
export const guideLine = (it: DiShapesChallenge) =>
  `Together: ${statement(it)}.`;

/** TEST: the learner answers alone. */
export const testLine = (it: DiShapesChallenge) =>
  `Your turn. ${ask(it)}`;

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiShapesChallenge) =>
  `Yes, ${statement(it)}.`;

/** Correction branch — FALLBACK for a non-answer (silence, or anything that
 *  was neither a shape name nor a number). MUST begin with "My turn". Standing
 *  gate 3: every correction re-models the answer then re-elicits. */
export const correctionLine = (it: DiShapesChallenge) =>
  `My turn: ${statement(it)}. Your turn. ${ask(it)}`;

/** Correction branch — CONTRASTIVE (preferred whenever the learner produced an
 *  answer of the right KIND — a shape name under a naming mode, a number under
 *  a counting mode). Names the wrong answer against the right one so the child
 *  learns WHICH answer was wrong: "rectangle" at a square, or "four" at a
 *  triangle, is the error this practice exists to catch, not a near-miss.
 *  `⟨…⟩` is a SLOT the tutor fills from the audio it just judged; it is not
 *  spoken. The opener stays "My turn" byte-for-byte (the engine matches
 *  OPENERS only). */
export const contrastCorrectionLine = (it: DiShapesChallenge) =>
  `My turn: not ⟨what they said⟩ — ${statement(it)}. Your turn. ${ask(it)}`;

/** The judge must also accept these names for this item, stated explicitly so
 *  permissiveness is per-item and auditable, never a judge improvisation. */
const alternatesClause = (it: DiShapesChallenge): string =>
  it.spokenAlternates && it.spokenAlternates.length > 0
    ? `\nThe learner may also call this shape ${it.spokenAlternates.map((w) => `"${w}"`).join(' or ')} — that is correct too.`
    : '';

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt ITSELF; the engine reads which branch it took
 * from the output transcript (sentinel scan) and alone decides progression.
 *
 * NAMING: permissive on young-child pronunciation of the RIGHT name
 * ("twiangle" and "wectangle" are developmental gliding, not wrong answers) and
 * on a dropped or added article ("triangle" / "a triangle" — both correct);
 * STRICT on a DIFFERENT shape name — the near-name IS the error class here.
 *
 * COUNTING: permissive on the ROUTE — counting aloud and landing on the right
 * number is exactly what a five-year-old should be doing, and is correct;
 * STRICT on a different final number. The child's own count is the evidence,
 * so the judge reads where it LANDS, not how it got there.
 */
export const judgingContract = (it: DiShapesChallenge) => isCountingType(it.challengeType)
  ? `Then wait for the learner.
Each time the learner responds, judge the audio you heard against the number "${it.countWord}":
- The learner said ${it.countWord} — straight away, or by counting aloud and ending on ${it.countWord}: say exactly "${verifyLine(it)}" and stop. Counting out loud is a correct route at this age, not a hesitation to correct.
- A DIFFERENT number: say exactly "${contrastCorrectionLine(it)}" and stop, then wait again. Replace ⟨what they said⟩ with the number they actually said ("not four", "not two"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Saying their number back is the point of this branch: it is the only way they hear that THEIR count was the wrong one.
- No number at all, or anything else (a shape name, a colour, "lots", "many"): say exactly "${correctionLine(it)}" and stop, then wait again.
Judge the number you heard, never the number you expected. If the learner counts aloud, wait until they stop and judge only the number they finish on.
If the learner gives the SAME wrong number again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`
  : `Then wait for the learner.
Each time the learner responds, judge the audio you heard against the shape name "${it.shapeWord}":
- The learner said ${it.shapeWord} — right away, with young-child pronunciation, or with or without "a" or "an": say exactly "${verifyLine(it)}" and stop.${alternatesClause(it)}
- A DIFFERENT shape name: say exactly "${contrastCorrectionLine(it)}" and stop, then wait again. Replace ⟨what they said⟩ with the shape name they actually said ("not circle", "not rectangle"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their shape is the point of this branch: it is the only way they hear that THEIR name was for a different shape.
- No shape name at all, or anything else (a color, "round", "big"): say exactly "${correctionLine(it)}" and stop, then wait again.
A different shape name is always wrong, however close: a rectangle is not a square, a circle is not an oval, a hexagon is not a pentagon. Judge the name you heard, never the name you expected.
If the learner gives the SAME wrong name again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/**
 * The spoken lead-in for one item, composed from its SUPPORT TIER. This is the
 * whole L3 ladder: `easy` hands over model + guide, `medium` only the model,
 * `hard` nothing at all. Absent tier = `easy`, the L0/L1 shape — at which the
 * composed block is byte-for-byte the "${model} ${guide} ${test}" string the
 * L0/L1 runs validated.
 */
const leadInFor = (it: DiShapesChallenge): string => {
  switch (it.supportTier) {
    case 'hard':   return '';
    case 'medium': return `${modelLine(it)} `;
    case 'easy':
    default:       return `${modelLine(it)} ${guideLine(it)} `;
  }
};

/**
 * At `hard` the tutor must not hand over the answer before the learner speaks
 * it — that is the entire point of the tier. The omitted lines already withhold
 * it (the tutor may only speak what "Speak exactly" quotes), but this makes the
 * intent explicit per item rather than relying on the omission alone: the
 * catalog's scaffolding levels and struggle responses are a second channel that
 * could otherwise volunteer it (the tier gotcha — a tier withheld by the script
 * but revealed by the tutor is only half applied).
 *
 * Under a COUNTING mode the guard names TWO things, and that is the
 * pack-specific part: the count is the answer, and the shape's NAME hands the
 * count to any child who knows it (triangle → three). Same L1 answer-leak rule,
 * restated where the tutor is most likely to improvise. Describing the drawing
 * ("it has three points") is the same leak by another route, so it is named too.
 * The CORRECTION branch still re-models at every tier; this guards the
 * pre-attempt window only.
 */
const coldAnswerGuard = (it: DiShapesChallenge): string => {
  if (it.supportTier !== 'hard') return '';
  return isCountingType(it.challengeType)
    ? `\nThe learner is answering this one cold on purpose: before they answer, do NOT say the count, do NOT say the shape's name (it gives the count away), and do NOT describe or count the drawing aloud.`
    : `\nThe learner is answering this one cold on purpose: before they answer, do NOT say the shape's name and do NOT describe the drawing.`;
};

/** Present one item: the tier's lead-in, then the test, then judge in-band
 *  until told otherwise. */
export const itemCue = (it: DiShapesChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk shape practice for a young learner. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${leadInFor(it)}${testLine(it)}"${coldAnswerGuard(it)}
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A hard shape resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. The NEXT item presents at ITS tier. */
export const moveOnCue = (it: DiShapesChallenge, next?: DiShapesChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${leadInFor(next)}${testLine(next)}"${coldAnswerGuard(next)}
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our shape practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our shape practice. Great work today!"`;

// The DI tutoring block (judging directives, shape-name rules, sentinel
// discipline, struggles) lives on the CATALOG entry — catalog/di.ts — the
// family single-source-of-truth since the L2 layer, so both the standalone
// connect fallback and the lesson auth/switch paths resolve it. Any wording
// change there must be re-checked against the sentinel-collision rule the
// cues above depend on.
