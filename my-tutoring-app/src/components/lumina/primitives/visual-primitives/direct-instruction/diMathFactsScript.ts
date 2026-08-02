/**
 * diMathFactsScript — HAND-AUTHORED Direct Instruction script for the
 * di-math-facts primitive. The exact wording IS the pedagogy (DISTAR
 * discipline), so these lines are authored per pack, never generated. Item
 * CONTENT (which facts, operand ranges) is generator-scoped to the objective;
 * this module owns only the model/guide/test/verify/correction cue SHAPE and
 * the in-band judging contract.
 *
 * DISTAR math facts: the tutor MODELS the whole fact statement ("two plus one
 * is three"), GUIDES it together, then TESTS ("What is two plus one?") and
 * judges the spoken NUMBER WORD from the audio it heard. This cue wording is
 * BENCH-PROVEN — the math-facts probe sitting (2026-07-24, HUMAN-CHECKS #46)
 * ran these exact lines live: 3/3 affirmed, exact script fidelity
 * (`qa/di-bench/run-2026-07-24-math-facts-probe.md`).
 *
 * ONE CUE SHAPE, FOUR SKILLS (L1). The cue lines below are deliberately
 * phrased around `it.problem` rather than around addition, so every L1 identity
 * reads correctly through the SAME bench-proven sentences — "two plus one is
 * three", "three minus one is two", "the number after five is six". Adding an
 * eval mode is therefore a GENERATOR change (which problems, phrased how), not
 * a rewrite of the proven script: the only type-aware line is the counting
 * DIRECTION inside the judging contract. That is what keeps the L0 addition
 * wording byte-for-byte identical to what the probe validated.
 *
 * Sentinels are the engine defaults (affirm "Yes", correct "My turn") —
 * collision-checked against every line below and probe-verified collision-safe
 * (both branches are exact-scripted, so a spontaneous math-tutor "Yes!"
 * cannot leak a verdict). Classic DISTAR's "My turn." model opener remains
 * FORBIDDEN outside the correction branch (standing gate 2); the model line
 * opens with "Listen:". Standing gate 3 holds: every correction re-models the
 * whole fact then re-elicits. NOTE: the correction branch was NOT driven in
 * the bench sitting (3/10 items, all correct) — hearing it live is part of
 * this primitive's L0 human check.
 *
 * CORRECTION SHAPE CHANGED 2026-07-25 (user ruling, ported from the first live
 * correction run in any DI pack — di-sentence-reading, HUMAN-CHECKS #54). A
 * plain re-model leaves the learner nothing to diff their own answer against,
 * so it never teaches WHICH part was wrong; the live reader repeated the same
 * substitution three times against an identical re-model. `correctionLine`
 * survives byte-for-byte as the fallback for a non-answer, and
 * `contrastCorrectionLine` is preferred whenever a wrong number was actually
 * said. The opener is unchanged, so sentinel classification is untouched.
 * UNBENCHED: the contrast branch has not had a sitting in this pack.
 *
 * ANSWER-LEAK RULE: the printed problem ("2 + 1") is the stimulus and the
 * spoken number word is the answer — nothing on screen may show the sum
 * before the child answers. The completed equation ("2 + 1 = 3") is a
 * POST-affirmation reward only.
 *
 * FLUENCY: response time is captured SILENTLY (engine attempt timing) — no
 * visible timer, ever (no-timer ruling). Per-turn judging stays warm and
 * untimed; speed is measured, never performed.
 */

/**
 * The L1 task identities (`/add-eval-modes` 2026-07-24). Every one produces the
 * SAME response class — a spoken number word — which is the class benched in
 * the #46 probe sitting, so no new bench sitting was required (standing gate 1).
 * What differs is the SKILL being drilled, not the mouth-shape of the answer:
 *   - counting_next    — say the number after N (rote counting sequence).
 *   - answer_fact      — say the answer to a printed addition fact. The base.
 *   - fact_review      — cumulative mix drawn WIDE across the taught range.
 *   - subtraction_fact — say the answer to a printed subtraction fact.
 * Deferred by design: the G3 `multiplication_fact` variant (the pack is
 * curriculum-fit at K/G1 only — it needs its own fit probe and a grade gate)
 * and the missing-addend shape ("2 + ? is 5"), queued at L4.
 */
export type DiMathFactsChallengeType =
  | 'counting_next'
  | 'answer_fact'
  | 'fact_review'
  | 'subtraction_fact';

/**
 * The within-mode SUPPORT tier (L3, 2026-08-01). Second field of the two-field
 * contract: `challengeType` = WHICH fact skill, `supportTier` = HOW MUCH of the
 * DISTAR sequence the child is handed before they answer. The fade the birth
 * certificate specified, worked template di-sentence-reading L3:
 *
 *   easy   MODEL + GUIDE + TEST   hear the fact twice, then answer alone
 *   medium MODEL + TEST           hear the fact once, then answer alone
 *   hard   TEST only              RETRIEVE the answer cold, never having heard it
 *
 * `hard` matters MORE here than in the sentence pack. There the withheld model
 * was an echo route onto a target already printed on screen; here the screen
 * never shows the answer (answer-leak rule), so the model line is the ONLY
 * pre-answer channel that carries it. Withdrawing it turns the item into a
 * genuine retrieval probe — which is what fact FLUENCY exists to measure, and
 * what makes the silent `responseMs` a true retrieval-time signal rather than
 * partly an echo delay.
 *
 * The withdrawal is identical across all four task identities, and that is
 * correct rather than lazy: every mode is the same act (see the printed
 * problem, speak the number word), so the same three sub-steps precede it. A
 * MODE changes which facts are drawn; a TIER changes how much of the sequence
 * is handed over.
 *
 * NEVER withdrawn at any tier:
 *  - the PRINTED PROBLEM on screen (it is the stimulus — withdrawing it would
 *    turn a read fact into a dictated one, a different task);
 *  - the CORRECTION's re-model (standing gate 3 — DISTAR always re-models on
 *    an error; remediation is not scaffolding);
 *  - the restating AFFIRM ("Yes, two plus one is three." — it models the
 *    complete fact at the moment it is most useful);
 *  - the judging contract (a tier changes how much help precedes the answer,
 *    never how the answer is judged — else tiers stop being comparable evidence).
 */
export type DiMathFactsSupportTier = 'easy' | 'medium' | 'hard';

/** One printed problem the tutor drills. Mirrors the generator output. */
export interface DiMathFactsChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills. */
  challengeType: DiMathFactsChallengeType;
  /** How much of the DISTAR sequence precedes the child's answer. Absent =
   *  easy (the L0 shape), so a session generated before L3 behaves exactly as
   *  it did. */
  supportTier?: DiMathFactsSupportTier;
  /** The two numbers in the printed problem. Their RELATIONSHIP depends on the
   *  challengeType (a + b / a − b / the number after a, where b is 1), so
   *  `answerNumeral` is authoritative — never recompute it from a and b. */
  a: number;
  b: number;
  /** Printed stimulus shown on the stage, e.g. "2 + 1", "3 − 1", "5 →".
   *  Never contains the answer. */
  display: string;
  /** Spoken form of the printed problem, e.g. "two plus one", "the number
   *  after five". Reads correctly inside every cue line below. */
  problem: string;
  /** The spoken target: the answer as a number word, e.g. "three". */
  answerWord: string;
  /** The numeric answer — derived in code, never by the LLM. */
  answerNumeral: number;
  /** The COMPLETED form, e.g. "2 + 1 = 3" or "5 → 6". Built in code because
   *  only the generator knows the relation. Rendered ONLY after affirmation
   *  (answer-leak rule) — the stage shows `display` until then. */
  solvedDisplay: string;
  /** Whole-token ASR aliases — passive cross-check only, never the judge.
   *  Digit lexicalizations ("3") and homophones (won/to/for/ate) live here. */
  asrAliases?: string[];
}

/** MODEL: the tutor states the whole fact once. Single repetition — brisk
 *  pacing is the product at this age (bench run-2 timing ruling). */
export const modelLine = (it: DiMathFactsChallenge) =>
  `Listen: ${it.problem} is ${it.answerWord}.`;

/** GUIDE: tutor and learner say the fact together. */
export const guideLine = (it: DiMathFactsChallenge) =>
  `Together: ${it.problem} is ${it.answerWord}.`;

/** TEST: the learner answers alone. */
export const testLine = (it: DiMathFactsChallenge) =>
  `Your turn. What is ${it.problem}?`;

/** Affirmation branch. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (it: DiMathFactsChallenge) =>
  `Yes, ${it.problem} is ${it.answerWord}.`;

/** Correction branch — FALLBACK. MUST begin with "My turn" — the engine scans
 *  that sentinel. Standing gate 3: every correction re-models the whole fact
 *  then re-elicits. Used when there is NOTHING to contrast (silence, or an
 *  answer that was not a number). Byte-for-byte the bench-proven line;
 *  `contrastCorrectionLine` is the preferred branch. */
export const correctionLine = (it: DiMathFactsChallenge) =>
  `My turn: ${it.problem} is ${it.answerWord}. Your turn. What is ${it.problem}?`;

/** Correction branch — CONTRASTIVE (preferred whenever the learner said a
 *  number). Names the wrong quantity and contrasts it against the right one,
 *  so the child learns WHICH number was wrong rather than hearing the fact
 *  restated at them. Ported from di-sentence-reading's 2026-07-25 finding
 *  (whole-fact re-models leave the learner nothing to diff against).
 *
 *  `⟨…⟩` is a SLOT the tutor fills from the audio it just judged; it is not
 *  spoken. The opener stays "My turn" byte-for-byte, so sentinel
 *  classification is untouched — the engine matches OPENERS only
 *  (`matchesOpener`, judgedLoopModel.ts). Ends on the correct fact, then
 *  re-elicits. */
export const contrastCorrectionLine = (it: DiMathFactsChallenge) =>
  `My turn: not ⟨what they said⟩ — ${it.problem} is ${it.answerWord}. Your turn. What is ${it.problem}?`;

/**
 * Which way a child counts to reach THIS item's answer. Counting to the answer
 * is the spoken analog of sounding out a word — a legitimate route, not a miss —
 * but the direction differs by skill, and naming the wrong one would tell the
 * tutor to affirm a child who counted the wrong way. Addition and counting-on
 * both count UP; subtraction counts BACK. The addition wording is unchanged
 * from the bench-proven L0 line (#46) byte-for-byte.
 */
const countingDirection = (it: DiMathFactsChallenge): 'up' | 'back' =>
  it.challengeType === 'subtraction_fact' ? 'back' : 'up';

/**
 * The in-band judging contract for one item. The Live tutor hears the raw
 * audio and judges each attempt ITSELF; the engine reads which branch it took
 * from the output transcript (sentinel scan) and alone decides progression.
 * Permissive on young-child pronunciation of the RIGHT number ("free" for
 * three is developmental th-fronting, not a wrong answer) and on counting up
 * to the answer (the spoken analog of a sound-out); STRICT on a DIFFERENT
 * number word — a wrong quantity is always corrected.
 */
export const judgingContract = (it: DiMathFactsChallenge) => `Then wait for the learner.
Each time the learner responds, judge the audio you heard against the answer "${it.answerWord}":
- The learner said ${it.answerWord} — right away, with young-child pronunciation, or after counting ${countingDirection(it)} to it: say exactly "${verifyLine(it)}" and stop.
- A DIFFERENT number: say exactly "${contrastCorrectionLine(it)}" and stop, then wait again. Replace ⟨what they said⟩ with the number word they actually said ("not one", "not five"). Never speak the ⟨ ⟩ marks, and change nothing else in the line. Naming their number is the point of this branch: it is the only way they hear that THEIR answer was the wrong quantity.
- No number at all, or anything else: say exactly "${correctionLine(it)}" and stop, then wait again.
A different number word is always wrong — never affirm a wrong quantity to be kind.
A very common wrong answer is echoing a number straight out of the problem — "${it.problem}" answered with one of its own numbers. Contrast it like any other wrong quantity; do not treat it as close.
If the learner gives the SAME wrong number again, use the contrast branch again — do not fall back to the plain re-model, and do not invent a third wording.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/**
 * The spoken lead-in for one item, composed from its SUPPORT TIER. This is the
 * whole L3 ladder: `easy` hands over model + guide, `medium` only the model,
 * `hard` nothing at all. Absent tier = `easy`, the L0 shape — at which the
 * composed block is byte-for-byte the bench-proven "${model} ${guide} ${test}"
 * string the #46 probe sitting validated.
 */
const leadInFor = (it: DiMathFactsChallenge): string => {
  switch (it.supportTier) {
    case 'hard':   return '';
    case 'medium': return `${modelLine(it)} `;
    case 'easy':
    default:       return `${modelLine(it)} ${guideLine(it)} `;
  }
};

/**
 * At `hard` the tutor must not say the fact — or its answer — before the
 * learner does; that is the entire point of the tier, and unlike the sentence
 * pack the answer exists NOWHERE else pre-attempt (the stage shows only the
 * unsolved problem). The omitted lines already withhold it (the tutor may only
 * speak what "Speak exactly" quotes), but this makes the intent explicit per
 * item rather than relying on the omission alone: the catalog's scaffolding
 * levels and struggle responses are a second channel that could otherwise
 * volunteer the fact (the tier gotcha — a tier withheld by the script but
 * revealed by the tutor is only half applied). The CORRECTION branch still
 * re-models at every tier by design; this guards the pre-attempt window only.
 */
const coldAnswerGuard = (it: DiMathFactsChallenge): string =>
  it.supportTier === 'hard'
    ? '\nThe learner is answering this one cold on purpose: do NOT say the fact, or its answer, before they answer.'
    : '';

/** Present one item: the tier's lead-in, then the test, then judge in-band
 *  until told otherwise. */
export const itemCue = (it: DiMathFactsChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk math-facts practice for a young learner. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${leadInFor(it)}${testLine(it)}"${coldAnswerGuard(it)}
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A hard fact resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. The NEXT item presents at ITS tier. */
export const moveOnCue = (it: DiMathFactsChallenge, next?: DiMathFactsChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${leadInFor(next)}${testLine(next)}"${coldAnswerGuard(next)}
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our math practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our math practice. Great work today!"`;

// The DI tutoring block (judging directives, number-word rules, sentinel
// discipline, struggles) lives on the CATALOG entry — catalog/di.ts — since the
// L2 layer, so both the standalone connect fallback and the lesson auth/switch
// paths resolve it from the single source of truth. Any wording change there
// must be re-checked against the sentinel-collision rule the cues above depend
// on, and against the no-timer ruling (never mention speed out loud).
