/**
 * diShapesScript — HAND-AUTHORED Direct Instruction script for the di-shapes
 * primitive (DI pack #5, born 2026-08-06 from the user's modality call:
 * "this is a triangle — what is this?"). The exact wording IS the pedagogy
 * (DISTAR discipline), so these lines are authored per pack, never generated.
 * Item CONTENT (which shapes, their geometry, rotation) is generator-scoped to
 * the objective; this module owns only the model/guide/test/verify/correction
 * cue SHAPE and the in-band judging contract.
 *
 * DISTAR shape naming: the tutor MODELS the name while the child looks at the
 * drawn shape ("Listen: this shape is a triangle."), GUIDES it together, then
 * TESTS ("Your turn. What shape is this?") and judges the spoken SHAPE NAME
 * from the audio it heard. The cue skeleton is the bench-proven family shape
 * (model → guide → test, verify opens "Yes", correction opens "My turn") —
 * the same lines every sitting has validated across four packs; the response
 * class (a single common word from a small closed set) sits inside the
 * word-reading bench's single-spoken-word class, and the "Shapes" bench probe
 * set exists to stress its two shape-specific risks before/at the L0 sitting:
 * square-vs-rectangle and circle-vs-oval discrimination.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn") —
 * collision-checked against every line below: no other line begins a sentence
 * with either opener. Standing gate 3 holds: every correction re-models the
 * name then re-elicits.
 *
 * CORRECTION SHAPE: contrastive-preferred, the 2026-07-25 family ruling — a
 * child who says "rectangle" at a square must HEAR "not rectangle — this
 * shape is a square", because the near-name is exactly the error this practice
 * exists to catch. `correctionLine` stays the fallback for a non-answer.
 *
 * ANSWER-LEAK RULE: the drawn shape is the stimulus and the spoken name is
 * the answer — the name never appears on screen (or in the session title or
 * description) before the child says it. The labeled shape ("triangle ✓") is
 * a POST-affirmation reward only.
 *
 * K CONVENTION, stated once: at this band a clearly-elongated rectangle is a
 * rectangle and a square is a square — "a square is a rectangle" is a G3+
 * abstraction, and the generator draws rectangles at ≥1.6:1 so the two are
 * never both defensible for one drawing (the rule-#1 / R12 class). The same
 * geometry duty covers oval-vs-circle.
 */

/** The L0 task identity. The ladder (birth-cert follow-ups, /add-eval-modes):
 *  `count_sides` / `count_corners` (spoken number words — already a benched
 *  class via #46) and `shape_review` (cumulative mixed set). */
export type DiShapesChallengeType = 'name_shape';

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
  /** Which shape the component draws — geometry is code-owned per name. */
  shape: DiShapeName;
  /** The spoken target, e.g. "triangle". Never rendered pre-affirmation. */
  shapeWord: string;
  /** Indefinite article for the cue lines ("a triangle", "an oval"). */
  article: 'a' | 'an';
  /** Straight sides / corners; null for curved shapes. Data for the recap and
   *  the future count_sides ladder — never spoken pre-attempt. */
  sides: number | null;
  corners: number | null;
  /** Generator-stamped rotation (degrees) so "regardless of orientation"
   *  (K.G.2) is real and the render is deterministic from data. */
  rotationDeg: number;
  /** Whole-token ASR aliases — passive cross-check only, never the judge. */
  asrAliases?: string[];
  /** Names the judge must ALSO accept as correct (e.g. "diamond" for a
   *  rhombus — the K word for it). Empty for most shapes. */
  spokenAlternates?: string[];
}

/** MODEL: the tutor names the shape once. Single repetition — brisk pacing is
 *  the product at this age (bench run-2 timing ruling). */
export const modelLine = (it: DiShapesChallenge) =>
  `Listen: this shape is ${it.article} ${it.shapeWord}.`;

/** GUIDE: tutor and learner say it together. */
export const guideLine = (it: DiShapesChallenge) =>
  `Together: this shape is ${it.article} ${it.shapeWord}.`;

/** TEST: the learner answers alone. */
export const testLine = (_it: DiShapesChallenge) =>
  `Your turn. What shape is this?`;

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiShapesChallenge) =>
  `Yes, this shape is ${it.article} ${it.shapeWord}.`;

/** Correction branch — FALLBACK for a non-answer (silence, or anything that
 *  was not a shape name). MUST begin with "My turn". Standing gate 3: every
 *  correction re-models the name then re-elicits. */
export const correctionLine = (it: DiShapesChallenge) =>
  `My turn: this shape is ${it.article} ${it.shapeWord}. Your turn. What shape is this?`;

/** Correction branch — CONTRASTIVE (preferred whenever the learner named a
 *  shape). Names the wrong shape against the right one so the child learns
 *  WHICH name was wrong — "rectangle" at a square is the error this practice
 *  exists to catch, not a near-miss. `⟨…⟩` is a SLOT the tutor fills from the
 *  audio it just judged; it is not spoken. The opener stays "My turn"
 *  byte-for-byte (the engine matches OPENERS only). */
export const contrastCorrectionLine = (it: DiShapesChallenge) =>
  `My turn: not ⟨what they said⟩ — this shape is ${it.article} ${it.shapeWord}. Your turn. What shape is this?`;

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
 * Permissive on young-child pronunciation of the RIGHT name ("twiangle" and
 * "wectangle" are developmental gliding, not wrong answers) and on a dropped
 * or added article ("triangle" / "a triangle" — both correct); STRICT on a
 * DIFFERENT shape name — the near-name IS the error class here.
 */
export const judgingContract = (it: DiShapesChallenge) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against the shape name "${it.shapeWord}":
- The learner said ${it.shapeWord} — right away, with young-child pronunciation, or with or without "a" or "an": say exactly "${verifyLine(it)}" and stop.${alternatesClause(it)}
- A DIFFERENT shape name: say exactly "${contrastCorrectionLine(it)}" and stop, then wait again. Replace ⟨what they said⟩ with the shape name they actually said ("not circle", "not rectangle"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their shape is the point of this branch: it is the only way they hear that THEIR name was for a different shape.
- No shape name at all, or anything else (a color, "round", "big"): say exactly "${correctionLine(it)}" and stop, then wait again.
A different shape name is always wrong, however close: a rectangle is not a square, a circle is not an oval, a hexagon is not a pentagon. Judge the name you heard, never the name you expected.
If the learner gives the SAME wrong name again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/** Present one item: model, guide, test, then judge in-band until told
 *  otherwise. (L0 ships the full DISTAR sequence; the tier fade is the
 *  /add-support-tiers rung, following the family's script-composed template.) */
export const itemCue = (it: DiShapesChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk shape-naming practice for a young learner. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${modelLine(it)} ${guideLine(it)} ${testLine(it)}"
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A hard shape resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
export const moveOnCue = (it: DiShapesChallenge, next?: DiShapesChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${modelLine(next)} ${guideLine(next)} ${testLine(next)}"
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
