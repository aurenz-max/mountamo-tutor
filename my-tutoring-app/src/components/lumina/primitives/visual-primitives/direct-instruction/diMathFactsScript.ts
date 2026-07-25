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
 * ANSWER-LEAK RULE: the printed problem ("2 + 1") is the stimulus and the
 * spoken number word is the answer — nothing on screen may show the sum
 * before the child answers. The completed equation ("2 + 1 = 3") is a
 * POST-affirmation reward only.
 *
 * FLUENCY: response time is captured SILENTLY (engine attempt timing) — no
 * visible timer, ever (no-timer ruling). Per-turn judging stays warm and
 * untimed; speed is measured, never performed.
 */

import type { TutoringScaffold } from '../../../types';

/**
 * The single L0 task identity. Ladder candidates for a LATER /add-eval-modes
 * (do NOT build now): `counting_next` (say the number after N — counting
 * sequence), `fact_review` (cumulative spaced mix of taught facts),
 * `subtraction_fact` (within 10), and the G3 `multiplication_fact` variant.
 */
export type DiMathFactsChallengeType = 'answer_fact';

/** One printed addition fact the tutor drills. Mirrors the generator output. */
export interface DiMathFactsChallenge {
  id: string;
  /** Which eval-mode SKILL this item drills — one identity at birth. */
  challengeType: DiMathFactsChallengeType;
  /** Operands. The answer is always a + b, derived in code, never by the LLM. */
  a: number;
  b: number;
  /** Printed stimulus shown on the stage, e.g. "2 + 1". Never contains the sum. */
  display: string;
  /** Spoken form of the printed problem, e.g. "two plus one". */
  problem: string;
  /** The spoken target: the answer as a number word, e.g. "three". */
  answerWord: string;
  /** The numeric answer (a + b) — completes the equation AFTER affirmation. */
  answerNumeral: number;
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

/** Correction branch. MUST begin with "My turn" — the engine scans that
 *  sentinel. Standing gate 3: every correction re-models the whole fact then
 *  re-elicits. */
export const correctionLine = (it: DiMathFactsChallenge) =>
  `My turn: ${it.problem} is ${it.answerWord}. Your turn. What is ${it.problem}?`;

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
- The learner said ${it.answerWord} — right away, with young-child pronunciation, or after counting up to it: say exactly "${verifyLine(it)}" and stop.
- A different number, no number, or anything else: say exactly "${correctionLine(it)}" and stop, then wait again.
A different number word is always wrong — never affirm a wrong quantity to be kind.
Never begin any other sentence with the word "Yes" or the words "My turn".
Speak nothing beyond these exact lines. After you affirm, wait silently for the application's next instruction.`;

/** Present one item: model, guide, test, then judge in-band until told otherwise. */
export const itemCue = (it: DiMathFactsChallenge, opening = false) => `[DI_ITEM]${opening
  ? ' You are running a short, brisk math-facts practice for a young learner. Never say, reproduce, or invent text inside square brackets; those labels are private application metadata.'
  : ''}
Speak exactly:
"${modelLine(it)} ${guideLine(it)} ${testLine(it)}"
${judgingContract(it)}`;

/** Corrections cap reached: acknowledge neutrally and move the lesson forward.
 *  A hard fact resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
export const moveOnCue = (it: DiMathFactsChallenge, next?: DiMathFactsChallenge) => next
  ? `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. ${modelLine(next)} ${guideLine(next)} ${testLine(next)}"
${judgingContract(next)}`
  : `[DI_MOVE_ON] Stop correcting "${it.id}". Speak exactly:
"Good try. We will practice more later. That's the end of our math practice."`;

/** Final item affirmed: close the session warmly. */
export const completeCue = () =>
  `[DI_COMPLETE] Speak exactly: "That's the end of our math practice. Great work today!"`;

/**
 * The DI tutoring block. Hand-authored per pack (the "custom-made" rule):
 * exact wording is the pedagogy. This ships WITH the primitive at birth
 * because the DI mechanism IS the in-band judging contract — the generic
 * tutor cannot judge or hold the sentinel discipline. (The DI family's
 * justified departure from the L0 "defer the tutoring block" default.)
 * Sentinel discipline: no line here begins with "Yes" or "My turn".
 */
export const DI_MATH_FACTS_TUTORING: TutoringScaffold = {
  taskDescription:
    'Live-judged Direct Instruction math-facts practice for a young learner. You speak the ' +
    'exact scripted lines from each bracketed application message and judge each learner attempt ' +
    'from the audio you heard, using only the two allowed reply branches.',
  scaffoldingLevels: {
    level1: 'Repeat the question once, slowly.',
    level2: 'Model the whole fact, then ask for one retry.',
    level3: 'Accept the attempt warmly and continue as instructed.',
  },
  aiDirectives: [
    {
      title: 'LIVE-JUDGED DIRECT INSTRUCTION',
      instruction:
        'Messages tagged [DI_ITEM], [DI_MOVE_ON], or [DI_COMPLETE] contain the only lesson words you may ' +
        'speak. The square-bracket label is private metadata: never speak, reproduce, or invent it. Each ' +
        '[DI_ITEM] message includes a two-branch judging rule: affirmations must begin with "Yes" and ' +
        'corrections must begin with "My turn", using the exact quoted lines. Never begin any other ' +
        'sentence with those words — even excited praise like "Yes!" outside the affirmation line is ' +
        'forbidden. Judge honestly from the audio: affirm the right number, correct a wrong or missing ' +
        'one. EVERY correction re-models the whole fact and begins with "My turn". Do not praise to be ' +
        'kind. The application decides which fact comes next; never introduce one yourself.',
    },
    {
      title: 'NUMBER WORDS',
      instruction:
        'Always say numbers as words ("two plus one is three"), never as digits or symbols — read ' +
        '"2 + 1" aloud as "two plus one". The learner answers with a spoken number word; affirm a ' +
        'correct answer whether it came instantly, with young-child pronunciation (like "free" for ' +
        'three), or after counting up out loud — but a DIFFERENT number is always wrong and gets the ' +
        'correction branch.',
    },
    {
      title: 'BREVITY',
      instruction:
        'Speak only the exact quoted lesson text. Never narrate judging, scoring, or application state. ' +
        'Keep pacing brisk: no filler, no chit-chat. Never mention time or speed — practice stays warm ' +
        'and unhurried out loud even though the learner is building quickness.',
    },
  ],
};
