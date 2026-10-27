/**
 * numberBondScript — HAND-AUTHORED judged-loop script for number-bond
 * (qa/di/BACKLOG.md item 18 P3-correction block, the third MATH port after
 * ten-frame and addition-subtraction-scene). The exact wording IS the pedagogy —
 * these lines are authored per pack, never generated. Item CONTENT (the wholes,
 * the parts) is generator-scoped; this module owns the cue shapes, the build
 * gates and the in-band judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 *   missing-part   (K + 1)  → SPOKEN number        number_word_to_20  (benched)
 *   decompose      (K + 1)  → SPLIT counters       manipulation
 *   fact-family    (1 only) → WRITTEN equations    manipulation
 *   build-equation (1 only) → BUILT number sentence manipulation
 *
 * WHY MISSING-PART SPEAKS. At the table the teacher says "one part is three —
 * what is the other part?" and the child answers OUT LOUD. The shipped surface
 * ended in a −/+ stepper and a Check button: a child who cannot find the part
 * can still operate a stepper, so the stepper was a costume — and a 0…max
 * stepper is also a weak MENU (recognition over production, guess floor 1-in-
 * maxNumber). Same shape ASS's solve-story struck at K.
 *
 * WHY THREE MODES KEPT THEIR HANDS. Costume test — can a child who cannot do
 * the skill still perform this action correctly?
 *   - `decompose`: no. Splitting the counters into two groups IS decomposition
 *     — the K concrete manipulative. Saying pairs aloud would be a different
 *     (and open-ended) task.
 *   - `fact-family`: no. The mode's identity is writing every distinct related
 *     equations — symbolic FORM, the third unsayable shape. Reciting them
 *     aloud would not show the child can write them. The equation workspace is
 *     the page a teacher pushes across the table.
 *   - `build-equation`: no. Same FORM argument, settled on ASS's identical
 *     mode (its docblock calls it "the pack's one genuinely arguable fork" and
 *     rules it built; do not re-derive).
 *
 * ── DECOMPOSE EXPANDS: ONE CHALLENGE → ONE JUDGED TURN PER PAIR ─────────────
 *
 * "Find all the ways to make five" is inherently multi-commit, and the runner's
 * model is one item = one verdict. The click era already paced it one pair per
 * Submit — so the build gate expands each decompose challenge into
 * `pairCount` judged items ("Make five with two parts." → "Find a different
 * way to make five."), the same volume of work with the tutor's verdict where
 * the feedback card used to be. Precedent: decodable-reader splits one passage
 * into per-sentence items. Properties that make it sound:
 *   - each commit CAN be wrong (an under-full split; a pair already made), so
 *     no close is correctness-gated;
 *   - an affirmed sub-item banks exactly one pair, and a capped/moved-on one
 *     banks none, so "find a different way" stays satisfiable to the end;
 *   - the repeat ask is DELIBERATELY short ("Find a different way to make
 *     five.", 7 words) — the invariant-mode short form the repeat-ask gate
 *     requires, with the action stated.
 *
 * ── THE §2 SCRIPT QUESTIONS, ANSWERED HERE ──────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For missing-part, yes — a model would say the
 *    number. Nothing is modeled before the ask; the count-up walk is earned in
 *    the CORRECTION. The fact-family worked example is modeled on content the
 *    session never asks about, picked IN CODE (`familyHelperExample`).
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? The bond diagram is numerals a
 *    K child cannot read, so THE ASK STATES ITS PROBLEM ALOUD at every band:
 *    "Five has two parts. One part is three. What is the other part?" Every
 *    correction re-ask inherits the numbers.
 *
 * 3. THE SIGNATURE ERROR, missing-part — the fluent, confident miss is a
 *    number the ask itself just said: the WHOLE (or the known part) echoed
 *    back. The accept clause matters as much: "two more" counts as two, and
 *    counting up aloud is the child WORKING, not answering — judge the number
 *    they offer when the counting stops. When the bond is symmetric (whole 6,
 *    part 3) the known part IS the answer, so the echo-refusal list excludes
 *    any value equal to the answer (ASS's filter, kept).
 *
 * ── CONTENT GATES (skill step 4) — KEEP OR DROP, NEVER BACKFILL ─────────────
 *
 * ZERO IS UNBENCHED as a spoken answer and 20 is the ceiling; a known part of
 * 0 or of the whole makes the spoken answer the whole itself or zero, so
 * `isValidBondPart` (1..whole−1) gates every non-decompose item ON BOTH SIDES
 * OF THE WIRE — the generator imports it to repair, this module uses it to
 * DROP. whole ≤ 10 by the generator's own clamp, so every spoken answer is
 * 1..9, entirely inside the benched range; the gate is asserted anyway so a
 * capacity change cannot launder an unbenched class into production.
 *
 * Nothing generated is ever SPOKEN by this pack — every cue is code-built from
 * the numeric fields, with numbers as words — so there is no sentinel scan
 * over generated prose to run at build time. Consecutive challenges with the
 * same (type, whole, part) are deduped, both as weak content (N challenges =
 * N problems) and because two byte-identical 13-word missing-part asks in a
 * row would be recitation.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import type { JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardDomain';
import {
  BOND_TEN, BOND_WHOLE_MAX, askFor, bondEquationFaultOf, factFamilyCanonicalKeys, factFamilyForms, parseBondEquation,
  tenAndOnesFaultOf, type NumberBondItem, type BondModelAction,
} from './numberBondDomain';
import { prepareSplit, splitCounts, splitQuestion, validSplit, type BondCounters, type BondPair } from './numberBondSplit';
import { bondActionOf, countersForAction, groupsForBond, relatedQuestion } from './numberBondModes';

export * from './numberBondDomain';

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "two plus three equals five" — an equation spoken; numerals stay off the
 *  tutor's tongue everywhere in this pack. */
const equationSpoken = (left: number, op: '+' | '-', right: number, result: number): string =>
  `${numberWordFor(left)} ${op === '+' ? 'plus' : 'take away'} ${numberWordFor(right)} equals ${numberWordFor(result)}`;


// ── How-to-play — spoken on the opener AND whenever the ACTION changes ──────

export const howToPlayFor = (item: NumberBondItem): string => {
  switch (item.kind) {
    case 'decompose':
      return 'Tap the two circles to split the counters into two parts. When you stop, I will look at your way. ';
    case 'ten-and-ones':
      // The RULE has to be taught, not just the gesture: this is the one bond
      // mode where only one split is accepted, and a child who has just come
      // from `decompose` has been told the opposite.
      return 'Tap the two circles to split the counters. Put a whole ten in one circle and the rest in the other. ';
    case 'missing-part':
      return 'Look at the number bond and think, then say the missing part out loud. ';
    case 'related-fact':
      // NO NUMBER WORDS. "the same three numbers two ways" reads naturally and
      // is a leak: "three" and "two" are both answers this mode produces, and
      // the how-to-play is spoken immediately before the ask. Said in counts
      // ("twice") rather than numerals, the same sentence carries no answer.
      return 'I will ask about the same number bond twice. Look at it, think, then say your answer out loud. ';
    case 'fact-family':
      return 'Build every distinct equation for this bond, one move at a time. When you stop, I will check each one. ';
    case 'build-equation':
      return 'Tap the tiles to build the number sentence. When you stop, I will check it. ';
  }
};


// ── The correction — DISTAR re-model then re-elicit; the answer is EARNED ───

/** "four, five" — the count-up walk from the known part to the whole, the
 *  strategy the correction models. Never more than 9 words (whole ≤ 10). */
const countUpWalk = (from: number, to: number): string =>
  Array.from({ length: to - from }, (_, i) => numberWordFor(from + 1 + i)).join(', ');

const correctionFor = (item: NumberBondItem): string => {
  const answerWord = numberWordFor(item.answer);
  const knownWord = numberWordFor(item.knownPart);
  const wholeWord = numberWordFor(item.whole);
  // Only the spoken modes carry a correction inside the item cue; the hand
  // modes are corrected through their code-computed verdict cues below.
  if (item.kind === 'related-fact' && item.pairIndex === 1) {
    // The subtraction turn is not corrected by counting up — the whole point is
    // that the addition fact ALREADY answers it. The correction states the
    // relationship, then re-asks in the same words the ask used.
    return `My turn: ${knownWord} and ${answerWord} make ${wholeWord}, so ${wholeWord} take away ${knownWord} is ${answerWord}. `
      + `Your turn. ${cap(wholeWord)} take away ${knownWord}. What is left?`;
  }
  const reAsk = item.kind === 'related-fact'
    ? `${cap(knownWord)} and how many more make ${wholeWord}?`
    : `One part is ${knownWord} — what is the other part?`;
  return `My turn: start at ${knownWord} and count up to ${wholeWord}: ${countUpWalk(item.knownPart, item.whole)}. `
    + `That is ${answerWord} more. Your turn. ${reAsk}`;
};

/**
 * The affirmation — the ONE line a right answer earns. On the related-fact
 * subtraction turn it says the connection out loud, because that connection is
 * what the mode measures and the child has just supplied the evidence for it.
 */
const affirmationFor = (item: NumberBondItem): string => {
  const answerWord = numberWordFor(item.answer);
  const knownWord = numberWordFor(item.knownPart);
  const wholeWord = numberWordFor(item.whole);
  if (item.kind === 'related-fact' && item.pairIndex === 1) {
    return `Yes, ${answerWord} — ${knownWord} and ${answerWord} make ${wholeWord}, and ${wholeWord} take away ${knownWord} is ${answerWord}. The same bond, both ways.`;
  }
  return `Yes, ${answerWord} — ${answerWord} and ${knownWord} make ${wholeWord}.`;
};

// ── Judging contract (missing-part — the pack's one spoken mode) ────────────

/** The refuse clause and the accept clause, both halves load-bearing. Values
 *  equal to the answer are excluded from the echo list — a symmetric bond
 *  (whole six, part three) makes the known part the RIGHT answer. */
const discriminationFor = (item: NumberBondItem): string => {
  const answerWord = numberWordFor(item.answer);
  const echo = [item.whole, item.knownPart]
    .filter((value, i, all) => all.indexOf(value) === i && value !== item.answer)
    .map((value) => `"${numberWordFor(value)}"`);
  const echoClause = echo.length > 0
    ? `The question already says ${echo.join(' and ')} out loud, so ${echo.length > 1 ? 'those numbers' : 'that number'} said back ${echo.length > 1 ? 'are' : 'is'} NOT the answer, however confident it sounds. `
    : '';
  return (
    echoClause
    + `Counting up aloud is the learner working, not answering — judge the number they OFFER when the counting stops. `
    + `"${answerWord}", "${answerWord} more", or "${answerWord}" said after counting up all count as ${answerWord}. `
  );
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE — an
 * imperative aimed at the tutor gets PERFORMED (ten-frame voiced "[WAIT
 * silently]" to a child). `findPerformedStageDirections` keeps this structural.
 */
const judgingContract = (item: NumberBondItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner works, and their think time is unbounded. `
  + `Never say the answer during their turn and never count aloud with them. `
  + `The correct answer is "${numberWordFor(item.answer)}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "${affirmationFor(item)}" and stop there — add no praise, no encouragement and no mention of what comes next. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the whole turn, `
  + `and it is the SAME line on every wrong answer, including a repeat of the same wrong answer — `
  + `never paraphrase it, never soften it, and never replace it with a hint of your own.`;

/** The gesture contract is a SILENCE contract: nothing to judge until the
 *  commit is described, and the quantities are banned from the tutor's mouth
 *  for the whole item. */
const silenceContract = (item: NumberBondItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the screen, not with their voice, so you then stay completely silent. `
  + (item.kind === 'decompose'
    ? `Do not count the counters aloud and never say which pairs make ${numberWordFor(item.whole)}. `
    : item.kind === 'ten-and-ones'
      // Ten may be said — it is the ask. What is banned is the REST, which is
      // the number the child is producing.
      ? `Do not count the counters aloud and never say how many are left over after the ten. `
      : item.kind === 'fact-family'
      ? `Do not read the equations aloud and never say what any equation should be. `
      : `Do not read the tiles aloud and never say what the number sentence should be. `)
  + `Do not narrate what they are doing or fill the pause. `
  + `You will be told what they made and whether it matches; only then do you speak.`;

/** Named at the end of every contract-carrying cue — it names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: NumberBondItem): string =>
  item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);

// ── Cues ────────────────────────────────────────────────────────────────────

export interface NumberBondCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: NumberBondItem, opts: NumberBondCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time for number bonds! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[NB_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The decompose verdict — THE MATCH IS COMPUTED IN CODE (sum + novelty
 * against the pairs already banked); the tutor is never asked to count pixels.
 * The digits in the head are for the judge's eyes; spoken lines carry WORDS.
 * Not correctness-gated anywhere upstream: an under-full split and a repeated
 * pair both arrive here and are corrected, which is what makes the item
 * judgeable at all.
 */
export const splitVerdictCue = (
  item: NumberBondItem,
  left: number,
  right: number,
  foundBefore: ReadonlyArray<readonly [number, number]>,
): string => {
  const wholeWord = numberWordFor(item.whole);
  const sum = left + right;
  const lo = Math.min(left, right);
  const hi = Math.max(left, right);
  const duplicate = sum === item.whole && foundBefore.some((p) => p[0] === lo && p[1] === hi);
  const matches = sum === item.whole && !duplicate;
  const head =
    `[NB_SPLIT] The learner split the counters into ${left} and ${right}; the whole is ${item.whole}`
    + `${duplicate ? ', and they already made that pair' : ''} — that ${matches ? 'MATCHES' : 'does NOT match'}. `;

  let line: string;
  if (matches) {
    const foundAll = foundBefore.length + 1 >= item.pairCount;
    line = `Say exactly: "Yes! ${cap(numberWordFor(left))} and ${numberWordFor(right)} make ${wholeWord}.`
      + `${foundAll ? ` You found every way to make ${wholeWord}!` : ''}" `;
  } else if (sum === 0) {
    line = `Say exactly: "My turn: the counters go into the circles first. Your turn — make ${wholeWord} with two parts." `;
  } else if (sum !== item.whole) {
    line = `Say exactly: "My turn: ${numberWordFor(left)} and ${numberWordFor(right)} make ${numberWordFor(sum)}, not ${wholeWord}. Count all ${wholeWord} in. Your turn — make ${wholeWord} with two parts." `;
  } else {
    line = `Say exactly: "My turn: you already made ${numberWordFor(lo)} and ${numberWordFor(hi)}. Your turn — find a way you have not made yet." `;
  }
  return `${head}${line}Never read bracket tags aloud.`;
};


/**
 * The `ten-and-ones` verdict. Ten may be spoken on every branch — it is the
 * ask — but the LEFTOVER is the child's to produce and appears only in the
 * affirmation, where it names the decomposition they just built.
 */
export const tenAndOnesVerdictCue = (
  item: NumberBondItem,
  left: number,
  right: number,
): string => {
  const fault = tenAndOnesFaultOf(item, left, right);
  const wholeWord = numberWordFor(item.whole);
  const onesWord = numberWordFor(item.otherPart);
  const head =
    `[NB_TEN] The learner split the counters into ${left} and ${right}; the whole is ${item.whole} `
    + `and exactly one part must be a full ten — that ${fault === 'match' ? 'MATCHES' : 'does NOT match'}. `;

  if (fault === 'match') {
    return `${head}Say exactly: "Yes! A ten and ${onesWord} more. ${cap(wholeWord)} is one ten and ${onesWord} ones." Never read bracket tags aloud.`;
  }
  const specific =
    fault === 'empty'
      ? `My turn: the counters go into the circles first. Your turn — put a whole ten in one circle and the rest in the other.`
      : fault === 'miscount'
        ? `My turn: ${numberWordFor(left)} and ${numberWordFor(right)} make ${numberWordFor(left + right)}, not ${wholeWord}. Count all ${wholeWord} in. Your turn — put a whole ten in one circle and the rest in the other.`
        // Names NO part: "not a ten" is the property that was missed, and the
        // leftover is exactly what the child still has to work out.
        : `My turn: that makes ${wholeWord}, but neither part is a ten. ${cap(wholeWord)} is one ten and some more. Your turn — put a whole ten in one circle and the rest in the other.`;
  return `${head}Say exactly: "${specific}" Never read bracket tags aloud.`;
};

/** Which of the fact-family faults happened — code-decided so the correction
 *  names the actual misconception rather than issuing one generic line. */
export type FamilyFault = 'match' | 'incomplete' | 'bad-math' | 'wrong-numbers' | 'duplicate';

export const familyFaultOf = (
  item: NumberBondItem,
  inputs: readonly string[],
): { fault: FamilyFault; uniqueCorrect: number; needed: number } => {
  const keys = factFamilyCanonicalKeys(item.whole, item.knownPart, item.otherPart);
  const seen = new Set<string>();
  let badMath = false;
  let wrongNumbers = false;
  let duplicate = false;
  for (const raw of inputs) {
    if (!raw || !raw.trim()) continue;
    const parsed = parseBondEquation(raw, item.whole, item.knownPart, item.otherPart);
    if (!parsed) continue; // an unparseable slot reads as incomplete below
    if (!parsed.valid) { badMath = true; continue; }
    if (!parsed.usesCorrectNumbers) { wrongNumbers = true; continue; }
    if (seen.has(parsed.familyFormKey)) { duplicate = true; continue; }
    if (keys.has(parsed.familyFormKey)) seen.add(parsed.familyFormKey);
  }
  const fault: FamilyFault = seen.size >= keys.size
    ? 'match'
    : badMath ? 'bad-math'
      : wrongNumbers ? 'wrong-numbers'
        : duplicate ? 'duplicate'
          : 'incomplete';
  return { fault, uniqueCorrect: seen.size, needed: keys.size };
};

export const familyVerdictCue = (item: NumberBondItem, inputs: readonly string[]): string => {
  const { fault, uniqueCorrect, needed } = familyFaultOf(item, inputs);
  const p1w = numberWordFor(item.knownPart);
  const p2w = numberWordFor(item.otherPart);
  const ww = numberWordFor(item.whole);
  const wrote = inputs.filter((s) => s && s.trim()).join(' ; ') || 'nothing';
  const head =
    `[NB_FAMILY] The learner wrote "${wrote}"; the fact family is ${item.knownPart}+${item.otherPart}=${item.whole} `
    + `(${uniqueCorrect} of ${needed} unique facts) — that ${fault === 'match' ? 'MATCHES' : 'does NOT match'}. `;
  if (fault === 'match') {
    return `${head}Say exactly: "Yes! The same three numbers — ${p1w}, ${p2w} and ${ww}. You wrote the whole fact family!" Never read bracket tags aloud.`;
  }
  const specific =
    fault === 'bad-math'
      ? `My turn: one of your equations does not add up. Count each group, then the whole. Your turn — fix the equation that does not add up.`
      : fault === 'wrong-numbers'
        ? `My turn: a fact family uses the SAME three numbers the bond shows — the two groups and the whole, and no others. Your turn — write all ${needed} distinct equations with just those.`
      : fault === 'duplicate'
          ? needed === 2
            ? `My turn: this equal-parts family has one distinct plus equation and one distinct take-away equation. Your turn — build each once.`
            : `My turn: two of your equations say the same thing. ${cap(ww)} take away ${p1w} and ${ww} take away ${p2w} are different facts. Your turn — make every equation different.`
          : needed === 2
            ? `My turn: this equal-parts family has two distinct equations — one plus and one take away. Your turn — write both.`
            : `My turn: a fact family needs four equations — two plus and two take away. Your turn — write all four.`;
  return `${head}Say exactly: "${specific}" Never read bracket tags aloud.`;
};


export const bondEquationVerdictCue = (
  item: NumberBondItem,
  tiles: readonly string[],
  action?: BondModelAction,
): string => {
  const fault = bondEquationFaultOf(item, tiles, action);
  const p1w = numberWordFor(item.knownPart);
  const p2w = numberWordFor(item.otherPart);
  const ww = numberWordFor(item.whole);
  const built = tiles.join(' ').trim() || 'nothing';
  const head = `[NB_EQUATION] The learner built "${built}"; the bond is ${item.knownPart}+${item.otherPart}=${item.whole} — that ${fault === 'match' ? 'MATCHES' : 'does NOT match'}. `;
  if (fault === 'match') {
    const parsed = parseBondEquation(tiles.join(''), item.whole, item.knownPart, item.otherPart)!;
    return `${head}Say exactly: "Yes! ${cap(equationSpoken(parsed.left, parsed.op, parsed.right, parsed.result))}. Your number sentence tells the truth about the bond!" Never read bracket tags aloud.`;
  }
  const actionPrompt = action === 'join' || action === 'swap'
    ? 'That equation belongs to this bond. Show the joining you just did.'
    : 'That equation belongs to this bond. Show the taking-apart action you just did.';
  const specific =
    fault === 'arithmetic'
      ? `My turn: those numbers do not make that total. Count each group, then count the whole. Your turn — build the number sentence again.`
      : fault === 'numbers'
        ? `My turn: use only the numbers the bond shows — the two groups and the whole. Your turn — build the number sentence with just those.`
        : fault === 'action'
          ? `My turn: ${actionPrompt} Your turn — build the number sentence for that action.`
        : `My turn: a number sentence needs two numbers, a sign, an equals, and the total. Your turn — build the whole number sentence.`;
  return `${head}Say exactly: "${specific}" Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: NumberBondItem,
  next: NumberBondItem | null,
  opts: NumberBondCueOptions = {},
): string => {
  if (!next) {
    return `[NB_MOVE] Say exactly: "Good try! Number bonds take practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[NB_MOVE] Say exactly: "Good try! ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[NB_COMPLETE] Say exactly: "What great number bond work today! You broke numbers apart and put them back together. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer, and never a hint. */
export const pronounceCue = (item: NumberBondItem): string =>
  `[NB_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY,
 * answer-free by construction: it names the task's SHAPE. The decompose whole
 * is public (the ask states it); missing-part names NO number at all, so no
 * branch can carry the value the child is about to produce.
 */
export const stimulusFor = (item: NumberBondItem): string => {
  switch (item.kind) {
    case 'decompose':
      return `breaking ${numberWordFor(item.whole)} into two parts on the number bond`;
    case 'ten-and-ones':
      // Stimulus-side only: the whole is on screen and in the ask, and the ten
      // is the structure being taught. The leftover ones are never pushed.
      return `breaking ${numberWordFor(item.whole)} into a full ten and the ones left over`;
    case 'missing-part':
      // "one part shown" would put the word "one" in the channel — and one IS
      // the answer whenever whole − part = 1. Same class as the "two parts"
      // ask fix.
      return 'a number bond with the whole shown and a single part shown; the other part is hidden';
    case 'related-fact':
      // Stimulus-side only, and the SAME line on both turns: naming which turn
      // it is would tell the tutor that turn 2's answer is the part turn 1
      // started from. The shape is all the channel carries.
      return 'a number bond with the whole shown and a single part shown; the other part is hidden, and the same three numbers are asked about twice';
    case 'fact-family':
      return 'a number bond with all three numbers shown; writing every distinct related equation';
    case 'build-equation':
      return 'a number bond with all three numbers shown; building one number sentence from tiles';
  }
};


// ── The retired workspace-phase cues (split and say, the persistent-model moves) ──────
// Kept for `__tests__/NumberBond.*` and the probes; the boss never sends them.

const SPLIT_WAIT = 'Never speak bracket tags or private rules. Only the app advances steps. After the quoted line, wait. ';
export function splitAndSayCue(item: NumberBondItem, opts: NumberBondCueOptions, counters: BondCounters, found: readonly BondPair[], moveOn = false): string {
  if (item.splitPhase === 'build') {
    const how = opts.opening || opts.howToPlay ? 'Tap a counter, then where it should go, or drag it. You can move counters between the parts or bring them back together. ' : '';
    const ask = item.kind === 'ten-and-ones' ? `Split ${numberWordFor(item.whole)} into a ten and some ones.`
      : item.pairIndex === 0 ? `Split ${numberWordFor(item.whole)} into two parts.` : `Move the counters to make a different way to split ${numberWordFor(item.whole)}.`;
    return `[NS_ITEM] Say exactly: "${opts.opening ? 'Let us split and say. ' : ''}${how}${ask}" Hands only. Do not judge speech or name the part counts. Wait for [NS_SPLIT] to supply a code-computed result. ` + SPLIT_WAIT;
  }
  const prepared = prepareSplit(item, counters, found);
  const question = splitQuestion(item, prepared.counters);
  return `[NS_ITEM] Highlighted answer side: ${question.answerSide}. Say exactly: "${moveOn && prepared.modeled ? 'I have shown a split. Use my example. ' : ''}${question.ask}" `
    + `Private expected number: ${question.answer}. Judge only fresh speech for this turn. Accept number words or short sentences such as "${numberWordFor(question.answer)} in that part". `
    + 'Reject negated correct numbers, conflicting guesses, and a whole/known-part echo unless it is also the actual answer. Counting without a final answer is unfinished. Silence, questions and off-task speech are not wrong answers. '
    + `If correct say exactly "Yes, ${numberWordFor(question.answer)} in that part." If incorrect say exactly "My turn: this part has ${numberWordFor(question.answer)}. Your turn. ${question.ask}" ` + SPLIT_WAIT;
}
export function splitAndSayVerdict(item: NumberBondItem, counters: BondCounters, found: readonly BondPair[]) {
  const valid = validSplit(item, counters, found);
  const { left, right, whole } = splitCounts(counters);
  return `[NS_SPLIT] Code-computed valid=${valid}; left=${left}, right=${right}, unplaced=${whole}. Say exactly: "${valid
    ? item.kind === 'ten-and-ones' ? 'Yes, a full ten and some ones.' : 'Yes, you made two parts.'
    : whole > 0 ? 'My turn: move all the counters into the parts, then we can look at your split.'
      : item.kind === 'ten-and-ones' ? 'My turn: make a full ten in one part, and put the rest in the other.'
        : 'My turn: that is a way you already made. Move a counter to make a different pair.'}" Do not name the other part before the spoken turn. ` + SPLIT_WAIT;
}
const MODE_WAIT = 'Never speak bracket tags or private rules. Only the app advances steps. After the quoted line, wait.';

export const numberBondInteractionCue = (
  item: NumberBondItem,
  opts: NumberBondCueOptions,
  counters: BondCounters,
): string => {
  const opening = opts.opening ? 'Let us use one bond in different ways. ' : '';
  if (item.interactionPhase === 'related-join') {
    return `[NB_MODEL] Say exactly: "${opening}Slide the two groups together." The child answers with their hands. Stay silent while they work. ${MODE_WAIT}`;
  }
  if (item.interactionPhase === 'related-separate') {
    return `[NB_MODEL] Say exactly: "Now move the group you just found out of the whole." The child answers with their hands. Stay silent while they work. ${MODE_WAIT}`;
  }
  if (item.interactionPhase === 'related-say-addend' || item.interactionPhase === 'related-say-remainder') {
    const safeCounters = item.bondAction && bondActionOf(counters, groupsForBond(item)) !== item.bondAction
      ? countersForAction(item, item.bondAction)
      : counters;
    const question = relatedQuestion(item, safeCounters);
    const answer = numberWordFor(question.answer);
    return `[NB_RELATION] Say exactly: "${question.ask}" Private expected number: ${question.answer}. `
      + `Judge only fresh speech for this turn. Accept "${answer}" or a short sentence ending in "${answer}". `
      + 'Reject negated answers, conflicting guesses, and counting without a final answer. Silence and help questions are not wrong answers. '
      + `If correct say exactly "Yes, ${answer}." If incorrect say exactly "My turn: the highlighted group has ${answer}. Your turn. ${question.ask}" ${MODE_WAIT}`;
  }
  if (item.interactionPhase === 'equation-model') {
    return `[NB_MODEL] Say exactly: "${opening}Choose an action. Join the groups, or take one group away." The child answers with their hands. Stay silent while they work. ${MODE_WAIT}`;
  }
  if (item.interactionPhase === 'equation-build') {
    return `[NB_EQUATION_ITEM] Say exactly: "Build an equation that shows what you did." The equation is the assessed response; do not ask for a spoken number. Stay silent while the child builds. ${MODE_WAIT}`;
  }
  if (item.interactionPhase === 'family-model') {
    const line = item.bondAction === 'join'
      ? 'Join the first group, then the second group.'
      : item.bondAction === 'swap'
        ? 'Swap the two groups so the other part comes first.'
        : item.bondAction === 'separate-left'
          ? 'Start with the whole, then move the first group away.'
          : 'Start with the whole, then move the other group away.';
    return `[NB_FAMILY_MODEL] Say exactly: "${opening}${line}" The child answers with their hands. Stay silent while they work. ${MODE_WAIT}`;
  }
  if (item.interactionPhase === 'family-build') {
    return `[NB_FAMILY_ITEM] Say exactly: "Build the equation that shows this move." Do not fill it in or read a prior equation as the answer. Stay silent while the child builds. ${MODE_WAIT}`;
  }
  return '';
};

export const modeActionVerdictCue = (
  item: NumberBondItem,
  counters: BondCounters,
): { cue: string; committed: BondModelAction | null; matched: boolean } => {
  const committed = bondActionOf(counters, groupsForBond(item));
  const expected = item.interactionPhase === 'equation-model' ? null : item.bondAction ?? null;
  const matched = !!committed && (item.interactionPhase === 'equation-model'
    ? committed !== 'swap'
    : !expected || committed === expected);
  const correction = item.interactionPhase === 'related-join'
    ? 'My turn: keep each colored group together and slide both groups into the whole.'
    : item.interactionPhase === 'related-separate'
      ? 'My turn: move the group you just found out of the whole, and leave the other group there.'
      : item.interactionPhase === 'equation-model'
        ? 'My turn: choose one of the offered actions. Join the groups, or take one group away.'
        : expected === 'swap'
        ? 'My turn: keep each group together and swap their positions.'
        : expected === 'separate-left' || expected === 'separate-right'
          ? 'My turn: start with the whole and move the named group away.'
          : 'My turn: keep each group together and complete the action.';
  const line = matched ? 'Yes, the model is ready.' : correction;
  return {
    committed,
    matched,
    cue: `[NB_MODEL_RESULT] Code-computed action=${committed ?? 'incomplete'}; expected=${expected ?? 'meaningful-choice'}; matched=${matched}. Say exactly: "${line}" Never read bracket tags aloud.`,
  };
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything number-bond ever sends the tutor. `NumberBond.tsx` spreads this
 * and adds what only a mounted component can own (status lines, and the
 * `observation` that reads the live workspace); the drive-plan
 * endpoint builds the identical cues for the headless judged-loop harness.
 */
export const numberBondPackBase = (
  items: NumberBondItem[],
): JudgedCueSurface<NumberBondItem> => ({
  primitiveType: 'number-bond',
  activityLine: 'live direct instruction number bond practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface NumberBondHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit an artifact, not a word — see the encoding note on
   *  `bondVerdictCueForPlaced`. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
}

/** A wrong-but-plausible number that is not the answer, the whole, or the
 *  known part — the baseline refusal test needs it unambiguous. */
const plainWrongFor = (item: NumberBondItem): number => {
  for (let candidate = 1; candidate <= BOND_WHOLE_MAX; candidate++) {
    if (candidate !== item.answer && candidate !== item.whole && candidate !== item.knownPart) {
      return candidate;
    }
  }
  return item.answer + 1;
};

/**
 * The answers a headless student gives on a judged drive. Lives beside the
 * contract it mirrors: `discriminationFor` CLAIMS the judge refuses the whole
 * said back, and this is the claim made testable. Change one, change both.
 */
export const numberBondHarnessAnswers = (item: NumberBondItem): NumberBondHarnessAnswers => {
  switch (item.kind) {
    case 'missing-part': {
      const answerWord = numberWordFor(item.answer);
      return {
        correct: answerWord,
        plainWrong: numberWordFor(plainWrongFor(item)),
        signatureWrong: {
          text: numberWordFor(item.whole),
          why: 'the whole said back instead of the missing part — the ask itself just said it',
        },
        // Words the ask legitimately states are the question, not a leak: the
        // known part on a symmetric bond, and "one" always — every ask says
        // "One part is…".
        leakTokens: item.answer === item.knownPart || item.answer === 1
          ? []
          : [numberWordFor(item.answer)],
      };
    }
    case 'related-fact': {
      const answerWord = numberWordFor(item.answer);
      return {
        correct: answerWord,
        plainWrong: numberWordFor(plainWrongFor(item)),
        // The signature miss is different on each turn, and turn 1's is the
        // reason the mode exists: the child who says their OWN previous answer
        // back has repeated a number instead of using the relationship. On turn
        // 1 `knownPart` IS what they said on turn 0.
        signatureWrong: item.pairIndex === 0
          ? {
            text: numberWordFor(item.whole),
            why: 'the whole said back instead of the missing part — the ask itself just said it',
          }
          : {
            text: numberWordFor(item.knownPart),
            why: 'the answer to turn 1 said again — the ask names it, and repeating it is what a child does instead of turning the fact around',
          },
        // "one" is in every count-up walk; the answer word otherwise must not
        // appear before the child produces it.
        leakTokens: item.answer === 1 ? [] : [answerWord],
      };
    }
    case 'ten-and-ones': {
      // The signature miss is a VALID PAIR THAT IS NOT A TEN — seven and seven
      // for fourteen. It sums correctly, it looks like a finished answer, and
      // it is precisely the child who has not yet seen a ten as one thing.
      const near = Math.floor(item.whole / 2);
      return {
        correct: `split ${BOND_TEN} and ${item.otherPart}`,
        plainWrong: `split 0 and ${item.whole}`,
        signatureWrong: {
          text: `split ${near} and ${item.whole - near}`,
          why: 'a pair that makes the whole but contains no ten — the sum is right and the place-value structure is missing',
        },
        placed: { correct: BOND_TEN * 100 + item.otherPart, wrong: near * 100 + (item.whole - near) },
        leakTokens: [],
      };
    }
    case 'decompose': {
      const a = Math.floor(item.whole / 2);
      const b = item.whole - a;
      return {
        correct: `split ${a} and ${b}`,
        plainWrong: `split 0 and ${item.whole - 1}`,
        placed: { correct: a * 100 + b, wrong: item.whole - 1 },
        leakTokens: [],
      };
    }
    case 'fact-family':
      return {
        correct: `wrote all ${factFamilyForms(item.knownPart, item.otherPart).length} distinct fact-family equations`,
        plainWrong: 'wrote a valid equation over the wrong numbers',
        placed: { correct: 1, wrong: 0 },
        leakTokens: [],
      };
    case 'build-equation':
      return {
        correct: `built ${item.knownPart}+${item.otherPart}=${item.whole}`,
        plainWrong: `built ${item.knownPart}+${item.otherPart}=${item.whole + 1}`,
        placed: { correct: 1, wrong: 0 },
        leakTokens: [],
      };
  }
};

/**
 * Harness-side gesture verdict builder, `DiPortAdapter.gestureVerdictCue`'s
 * one-number shape. THE ENCODING (internal to this module — `placed` values
 * above are produced here and decoded here, nowhere else):
 *   - decompose: left × 100 + right (an under-full commit encodes as its sum
 *     with left 0, e.g. `whole − 1`);
 *   - fact-family / build-equation: 1 = a correct commit, 0 = a wrong one
 *     (wrong-numbers / arithmetic respectively), the artifact built inside.
 */
export const bondVerdictCueForPlaced = (item: NumberBondItem, placed: number): string => {
  switch (item.kind) {
    case 'decompose':
      return splitVerdictCue(item, Math.floor(placed / 100), placed % 100, []);
    case 'ten-and-ones':
      // Same left×100 + right packing as decompose — one gesture shape, two
      // accept sets.
      return tenAndOnesVerdictCue(item, Math.floor(placed / 100), placed % 100);
    case 'fact-family': {
      const { whole, knownPart: p1, otherPart: p2 } = item;
      const inputs = placed === 1
        ? [`${p1}+${p2}=${whole}`, `${p2}+${p1}=${whole}`, `${whole}-${p1}=${p2}`, `${whole}-${p2}=${p1}`]
        : [`${whole}+${whole}=${whole * 2}`, '', '', ''];
      return familyVerdictCue(item, inputs);
    }
    case 'build-equation': {
      const { whole, knownPart: p1, otherPart: p2 } = item;
      const tiles = placed === 1
        ? [String(p1), '+', String(p2), '=', String(whole)]
        : [String(p1), '+', String(p2), '=', String(whole + 1)];
      return bondEquationVerdictCue(item, tiles);
    }
    default:
      return splitVerdictCue(item, 0, 0, []);
  }
};
