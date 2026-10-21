/**
 * tenFrameScript — HAND-AUTHORED judged-loop script for ten-frame (the first
 * MATH port of the tutor-owned DI loop; qa/di/BACKLOG.md item 18, brief
 * `qa/HANDOFF-di-ten-frame-2026-08-12.md`). The exact wording IS the pedagogy —
 * these lines are authored per pack, never generated. Item CONTENT (the
 * numbers) is generator-scoped; this module owns the cue shapes, the build
 * gates, and the in-band judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1), and why math forks where literacy
 *    did not ────────────────────────────────────────────────────────────────
 *
 *   subitize      → SPOKEN count            number_word_to_20   (benched)
 *   make_ten @K   → ENACTED complement      manipulation        (contract R6)
 *   make_ten @1-2 → SPOKEN complement       number_word_to_20   (benched)
 *   build         → ENACTED construction    manipulation
 *   split         → ENACTED partition       manipulation        (contract R9)
 *   add/subtract  → SPOKEN sum/difference   number_word_to_20   (benched)
 *
 * `split` is the newest arrival and it is a PAIR, not a number — which is
 * exactly why it is enacted. Asking a five-year-old to SAY "two and three"
 * would benchmark a two-number spoken class nobody has benched, and it would
 * let a child who cannot partition anything recite a pair they heard last item.
 * Flipping two counters yellow while three stay red IS the decomposition; the
 * costume test has no answer for it (K.OA.3, "decompose numbers ≤ 10 into pairs
 * in more than one way, e.g. by using objects or drawings").
 *
 * In literacy, conversion was almost always right because the clicking stood in
 * for a mouth. IN MATH THE MANIPULATIVE IS OFTEN THE SKILL. Applying the
 * costume test — can a child who cannot do the skill still perform this action
 * correctly? — a stepper is a costume (anyone can operate one), but PLACING
 * COUNTERS IS THE ACT OF BUILDING A QUANTITY. So the steppers died and the
 * frame lived.
 *
 * `make_ten` @ K is the sharp case and it is a CONTRACT ruling, not a
 * preference: R6 (the only REQUIRED requirement on ten-frame) was written by
 * reader-fit item 12 under the standing direct-manipulation-first ruling, and
 * it pins the ABSENCE of a stepper and a Check button. It post-dates the click
 * era. Re-basing it means keeping the manipulation and letting the tutor judge
 * it — never replacing it with a spoken count.
 *
 * ── THE §3 SCRIPT QUESTIONS, ANSWERED FOR TEN-FRAME ─────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For `subitize` and the operations, yes — a model
 *    would say the count. So nothing is modeled before the ask; the count is
 *    earned in the CORRECTION, where DISTAR pays for it. At ten or below the
 *    correction models the counted walk (`countWalk`, reused from
 *    countingBoardScript — not re-rolled); above ten a spoken walk is ear noise
 *    (SWAP-1's sayability lesson) so the correction names the answer instead.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "How many?" against a HIDDEN frame
 *    has exactly one right completion — this primitive is naturally
 *    unambiguous, unlike word-flip's. The asks stay short.
 *
 * 3. THE ASK STATES ITS PROBLEM ALOUD. A pre-reader cannot read the screen, and
 *    every correction re-ask inherits the ask, so `add` SAYS its fact ("Three
 *    plus two. How many altogether?") and `subtract` says its take-away. This
 *    is `findUnspokenStimulus`'s rule and it is the defect a live drive of
 *    di-spoken-practice caught.
 *
 * 4. THE SIGNATURE ERROR, PER MODE — the wrong answer that is fluent,
 *    confident, and most likely to be wrongly affirmed:
 *      subitize  — COUNTING ALOUD ONE-BY-ONE after the flash. It reaches the
 *                  right number by the wrong route and is the exact skill the
 *                  mode exists to defeat. ⚠ But the ACCEPT clause matters just
 *                  as much: a child who says the total FIRST and then verifies
 *                  by counting is correct — land-on-the-total is an accept
 *                  (phoneme-explorer's blend rule, one layer over).
 *      make_ten  — saying the TOTAL (ten) instead of the complement.
 *      split     — TWO of them, and both are gestures rather than words.
 *                  (a) The EMPTY PART: flipping none, or flipping every
 *                  counter, leaves one group and nothing. It looks like a
 *                  finished, confident answer and it is not a decomposition —
 *                  a part is not the whole, and zero is not a group.
 *                  (b) The REPEAT: showing four-and-one again on the next item
 *                  is a correct partition and a wrong answer to "a DIFFERENT
 *                  way", which is the half of K.OA.3 the mode exists for. Both
 *                  are judged in code and handed to the tutor as a verdict; she
 *                  is never asked to count pixels or remember prior items.
 *      add       — saying one of the ADDENDS back.
 *      subtract  — saying the START or the number TAKEN AWAY back.
 *
 * ── CONTENT GATES SPECIFIC TO TEN-FRAME (skill step 4, brief §4) ────────────
 *
 * ZERO IS UNBENCHED. "zero"/"none" is not a benched spoken answer (di-shapes
 * rung 2 residual) and an EMPTY FRAME is a legitimate subitize stimulus while a
 * subtraction can answer 0. Every spoken answer is floored at 1 and any item
 * that computes to 0 is DROPPED — `itemFromChallenge` returns null and the
 * component never shows it. Nothing is backfilled: a placeholder item in a
 * judged loop becomes a spoken ask the tutor must judge.
 *
 * THE ≤20 CEILING. `number_word_to_20` is benched; `number_word_to_120` is
 * build-ahead with #63 acceptance owed. Ten-frame tops out at 20 (double
 * frame), so this primitive fits ENTIRELY inside the benched range — one of the
 * reasons it is the right first math port. The gate is asserted anyway so a
 * future capacity change cannot launder an unbenched class into production.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file: no spoken line below opens
 * a sentence with either.
 */

import type { JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import { countWalk, numberWordFor } from './countingBoardDomain';
import {
  askFor, cap, countersWord, howToPlayFor, isPairKind, isTeenKind, judgeSplit, judgeTeen, teenTotalFor, TEEN_TEN, WALK_CEILING,
  type SplitVerdict, type TeenVerdict, type TenFrameItem, type TenFrameSplit,
} from './tenFrameDomain';

// The task itself is domain, not script. Re-exported so the tests, probes and generator keep one address while the
// scripted protocol is retired.
export * from './tenFrameDomain';

// ── The corrections — DISTAR re-model then re-elicit (standing gate 3) ──────
// This is the FIRST place the answer is ever spoken, and it is earned.

/** "eleven, twelve, thirteen, fourteen" — counting ON from the ten already
 *  there, which is the strategy `build_teen` exists to teach. Never more than
 *  nine words (the ones top out at nine). */
const countOnWalk = (from: number, to: number): string =>
  Array.from({ length: to - from }, (_, i) => numberWordFor(from + 1 + i)).join(', ');

/**
 * The teen correction forks on WHICH miss happened, and both branches re-model
 * the SAME strategy: a ten holds still and the ones are counted against it.
 * `build_teen` earns the ones in its model (DISTAR pays for the answer in the
 * correction); `decompose_teen` never names the ones at all, because the ones
 * are what its affirmation is for — its model is of counting out ten.
 */
const teenCorrectionFor = (item: TenFrameItem, verdict: TeenVerdict): string => {
  const total = teenTotalFor(item);
  const totalWord = numberWordFor(total);
  if (item.kind === 'build_teen') {
    const onesWord = numberWordFor(item.answer);
    const opener = verdict === 'too_many'
      ? `My turn: that is past ${totalWord}.`
      : `My turn: that is not ${totalWord} yet.`;
    return (
      `${opener} The top frame is ten. Watch me count on: ${countOnWalk(TEEN_TEN, total)}. `
      + `That is ${onesWord} more than ten. Your turn — make ${totalWord}.`
    );
  }
  const opener = verdict === 'too_many'
    ? `My turn: that is more than ten yellow.`
    : `My turn: that is not ten yellow yet.`;
  return (
    `${opener} Watch me count out ten. ${cap(countWalk(TEEN_TEN))}. Stop at ten. `
    + `Your turn — turn ten of them yellow.`
  );
};

/**
 * `split`'s correction forks on WHICH miss happened, because "you left a group
 * empty" and "you showed that way already" are different lessons and a child
 * who hears the wrong one learns nothing. Every branch models the property that
 * was violated and re-elicits; NO BRANCH NAMES A PAIR, at any point, including
 * the move-on — a valid partition spoken aloud is the answer to every remaining
 * item on this total, not just to this one.
 */
const splitCorrectionFor = (item: TenFrameItem, verdict: SplitVerdict): string => {
  const totalWord = numberWordFor(item.answer);
  switch (verdict) {
    case 'repeat':
      return (
        `My turn: that is a way to make ${totalWord}, and it is the same way you showed me before. `
        + `There is more than one way. Your turn — turn a different number of counters yellow.`
      );
    case 'miscount':
      // Unreachable from the stage (taps only flip colour; nothing is added or
      // removed), so this is the harness's branch and a guard against a future
      // edit that lets the count move.
      return (
        `My turn: all ${totalWord} counters stay on the frame. We are not taking any away — `
        + `we are turning some of them yellow. Your turn.`
      );
    case 'empty_part':
    case 'correct':
    default:
      return (
        `My turn: two groups means I can see red counters AND yellow counters. `
        + `Not all red. Not all yellow. Your turn — turn some of them yellow, but leave some red.`
      );
  }
};

/** `build_pair`'s correction, per miss. Like `split`'s, no branch names a pair; the count branch names only the
 *  total, which the ask already stated. */
const pairCorrectionFor = (item: TenFrameItem, verdict: SplitVerdict): string => {
  const totalWord = numberWordFor(item.answer);
  switch (verdict) {
    case 'miscount':
      return `My turn: I need ${totalWord} counters on the frame altogether, red and yellow together. `
        + `Count them all. Your turn — make ${totalWord}.`;
    case 'repeat':
      return `My turn: that makes ${totalWord}, and it is the same way you made it before. `
        + `Your turn — make ${totalWord} with a different number of yellow counters.`;
    case 'empty_part':
    case 'correct':
    default:
      return `My turn: I want to see red counters AND yellow counters. Not just red. Not just yellow. `
        + `Your turn — make ${totalWord} with both colours.`;
  }
};

const correctionFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  const shownWord = numberWordFor(item.shown);
  const capWord = numberWordFor(item.capacity);

  switch (item.kind) {
    case 'build':
      return item.answer <= WALK_CEILING
        ? `My turn: I need ${answerWord}. Watch me count them. ${countWalk(item.answer)}. That is ${answerWord}. Your turn. Put ${answerWord} ${countersWord(item.answer)} on the frame.`
        : `My turn: I need ${answerWord} — fill the first frame all the way, then keep going. Your turn. Put ${answerWord} ${countersWord(item.answer)} on the frame.`;
    case 'subitize':
      return `My turn: it was ${answerWord}. Look at the whole group at once instead of counting them. Your turn. How many counters did you see?`;
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? `My turn: the frame is not full yet. Every box needs a counter. Your turn — keep tapping the empty boxes.`
        : `My turn: ${shownWord} and ${answerWord} make ${capWord}. ${cap(answerWord)} more. Your turn. How many more counters make ${capWord}?`;
    case 'build_teen':
    case 'decompose_teen':
      // The DEFAULT is the too-few branch — the miss a child makes by stopping
      // early. `teenVerdictCue` overrides it once the count is known.
      return teenCorrectionFor(item, 'too_few');
    case 'split':
      // The DEFAULT correction is the empty-part one, because that is the miss
      // this mode is built to catch. `splitCorrectionFor` overrides it once the
      // verdict is known. Neither line ever names a pair: the model here is of
      // the PROPERTY the child missed ("I can see both colours"), not of a
      // partition, which would hand over the answer the item is asking for —
      // the same restraint the K make-ten gesture correction already keeps.
      return splitCorrectionFor(item, 'empty_part');
    case 'build_pair':
      return pairCorrectionFor(item, 'empty_part');
    case 'add':
      return item.answer <= WALK_CEILING
        ? `My turn: ${numberWordFor(item.addend1 ?? 0)} plus ${numberWordFor(item.addend2 ?? 0)}. Watch me count. ${countWalk(item.answer)}. ${cap(answerWord)} altogether. Your turn. How many altogether?`
        : `My turn: ${numberWordFor(item.addend1 ?? 0)} plus ${numberWordFor(item.addend2 ?? 0)} makes ${answerWord}. Fill the first frame to ten, then count on. Your turn. How many altogether?`;
    case 'subtract':
      return `My turn: ${shownWord} take away ${numberWordFor(item.removed ?? 0)} leaves ${answerWord}. ${cap(answerWord)} ${item.answer === 1 ? 'is' : 'are'} left. Your turn. How many are left?`;
  }
};

// ── Judging contracts ───────────────────────────────────────────────────────

/** What looks like an answer for this mode and is not — plus the right answer
 *  that does not look right. Both halves matter: the refuse clause stops a
 *  fluent miss being affirmed, the accept clause stops a correct child being
 *  corrected. */
const discriminationFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  switch (item.kind) {
    case 'subitize':
      return (
        `Saying "${answerWord}" straight away is correct, and checking it by counting AFTER saying it is still correct. `
        + `But counting up one at a time and only arriving at "${answerWord}" at the end is NOT a subitizing answer — treat that as wrong, because recognising the group at a glance is the whole skill here. `
      );
    case 'make_ten':
      return (
        `The total "${numberWordFor(item.capacity)}" said back is NOT the answer, however confident it sounds — the answer is how many MORE are needed. `
        + `"${answerWord} more" or "${answerWord} counters" counts as "${answerWord}". `
      );
    case 'add':
      return (
        `Either addend said back ("${numberWordFor(item.addend1 ?? 0)}" or "${numberWordFor(item.addend2 ?? 0)}") is NOT the answer. `
        + `Counting aloud that ENDS on "${answerWord}" counts as that answer — the last number said tells the total. `
      );
    case 'subtract':
      return (
        // On a double such as eight take away four the number taken away IS the answer; refusing it
        // would tell the judge to correct a right answer.
        (item.removed === item.answer
          ? `The starting number "${numberWordFor(item.shown)}" is NOT the answer. Here the number taken away is also "${answerWord}", so "${answerWord}" is correct. `
          : `The starting number "${numberWordFor(item.shown)}" and the number taken away "${numberWordFor(item.removed ?? 0)}" are NOT the answer. `)
        + `Counting aloud that ENDS on "${answerWord}" counts as that answer — the last number said tells how many are left. `
      );
    default:
      return '';
  }
};

const affirmTailFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  switch (item.kind) {
    case 'subitize':
      return `${answerWord} ${countersWord(item.answer)}`;
    case 'make_ten':
      return `${answerWord} more`;
    case 'add':
      return `${answerWord} altogether`;
    case 'subtract':
      return `${answerWord} left`;
    default:
      return answerWord;
  }
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE.
 * Drive 2 (2026-08-13) caught the model VOICING `[WAIT silently]` to the child,
 * immediately after the ask — it took the contract's old "Then WAIT silently…"
 * opener, wrapped it in a bracket tag mimicking `[TF_ITEM]`, and performed it.
 * A stage direction phrased as a command to the tutor reads, to the model, like
 * one more thing on the list of things to say. So the contract now states what
 * is true ("the quoted line is the only thing you say") rather than issuing an
 * order, and the cue names the failure explicitly at the end.
 */
/**
 * ⚠️ THE STOP BELONGS TO EACH VERDICT BRANCH, NOT ONLY TO THE ASK.
 * The opening sentence here says "the quoted line is the ONLY thing you say" —
 * but by the time the model reaches the branches below, "the quoted line" reads
 * as the ASK it was just handed, so the verdict lines inherited no stop at all.
 * The first headless DI run (2026-08-14) shows exactly that decay: the first
 * affirm came back clean ("Yes, three counters."), then every later one grew —
 * 26, 31, 37, 35, 34 unscripted words — into praise, a preview of the next
 * activity, and finally "We've completed this activity" at item 4 of 7.
 * The literacy packs never had this: they close every branch with `and stop`.
 */
const judgingContract = (item: TenFrameItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner works, and their think time is unbounded. Never say the answer during their turn and never count aloud with them. `
  + `The correct answer is "${numberWordFor(item.answer)}". `
  + discriminationFor(item)
  + `If the answer is right, say exactly: "Yes, ${affirmTailFor(item)}." and stop there — add no praise, no encouragement and no mention of what comes next, and never tell the learner the activity is finished. `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the whole turn.`;

/** The gesture contract is a SILENCE contract (spell_word's pattern): there is
 *  nothing to judge until the placement is described, and the quantity is
 *  banned from the tutor's mouth for the whole item. */
const silenceContract = (item: TenFrameItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the frame, not with their voice, so you then stay completely silent. `
  + (item.kind === 'build'
    ? `Do not count the counters aloud and never say how many are on the frame. `
    : item.kind === 'build_teen'
      // The banned material is the ONES. The ten is on screen and in the ask;
      // how many MORE than ten is what the child is producing.
      ? `Never say how many more than ten are needed and never count the counters aloud. `
      : item.kind === 'decompose_teen'
        // Here the banned material is what is LEFT OVER. Ten is the ask, so it
        // may be said; the red remainder is the decomposition the affirmation
        // exists to name.
        ? `Never say how many counters will be left red and never count the counters aloud for them. `
        : isPairKind(item.kind)
      // The banned material here is a PAIR, not a count — and it stays banned
      // for the whole session, because naming one way answers every later item
      // on this total too.
          ? `Never suggest a pair of numbers that makes ${numberWordFor(item.answer)}, never say how many `
            + `${item.kind === 'split' ? 'to turn yellow' : 'of each colour to use or how many are on the frame'}, and never count the counters aloud. `
          : `Never say how many more are needed and never count the empty boxes aloud. `)
  + `Do not narrate what they are doing or fill the pause. `
  + `You will be told what they placed and whether it matches; only then do you speak.`;

/** Named at the end of every cue that carries a contract. It names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: TenFrameItem): string =>
  item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);

// ── Cues ────────────────────────────────────────────────────────────────────

export interface TenFrameCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: TenFrameItem, opts: TenFrameCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to work with the ten frame! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const spoken = `${greeting}${how}${askFor(item)}`;
  return `[TF_ITEM] Say exactly: "${spoken}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The gesture verdict ask (`build`, `make_ten` @K): describes what the child
 * committed and hands the tutor its exact line. The MATCH IS COMPUTED IN CODE —
 * the tutor is never asked to count pixels. The digits in this instruction are
 * for the judge's eyes; the spoken lines carry number WORDS only.
 */
export const frameVerdictCue = (
  item: TenFrameItem,
  placed: number,
  opts: { alreadyShown?: ReadonlySet<string>; yellow?: number } = {},
): string => {
  // `build_pair` commits the counters on the frame (`placed`) and how many of them are yellow.
  if (item.kind === 'build_pair') return pairVerdictCue(item, { a: placed - (opts.yellow ?? 0), b: opts.yellow ?? 0 }, opts.alreadyShown);
  // `split` commits a PAIR. The gesture channel still carries one number —
  // how many the child turned yellow — because the total is fixed by the item,
  // so `b` determines `a` and no adapter or harness needs a second field.
  if (item.kind === 'split') {
    const b = Math.max(0, Math.min(item.answer, placed));
    return splitVerdictCue(item, { a: item.answer - b, b }, opts.alreadyShown);
  }
  // Teen items commit ONE number too, and which number it is depends on the
  // mode: the ones the child placed, or the counters they turned yellow. The
  // component and the harness both hand this function that number and nothing
  // else, so neither needs to know the target.
  if (isTeenKind(item.kind)) return teenVerdictCue(item, placed);
  const answerWord = numberWordFor(item.answer);
  const matches = placed === item.answer;
  const head = item.kind === 'build'
    ? `[TF_FRAME] The learner put ${placed} counters on the frame; the ask was for ${item.answer} — that ${matches ? 'MATCHES' : 'does NOT match'}. `
    : `[TF_FRAME] The learner placed ${placed} of the ${item.answer} counters the frame still needed — that ${matches ? 'fills it' : 'does NOT fill it'}. `;

  const line = matches
    ? (item.kind === 'build'
      ? `Say exactly: "Yes! ${cap(answerWord)} ${countersWord(item.answer)} on the frame. You built it!" `
      : `Say exactly: "Yes! The frame is full. ${cap(numberWordFor(item.shown))} and ${answerWord} make ${numberWordFor(item.capacity)}." `)
    : `Say exactly: "${correctionFor(item)}" `;

  return `${head}${line}Never read bracket tags aloud.`;
};

/**
 * The teen verdict — the count the child produced, judged in CODE.
 *
 * The AFFIRMATION is the one place the whole decomposition may be spoken, and
 * it is spoken because the child built it: "Ten and four make fourteen". On
 * every wrong branch she gets the correction verbatim and the ones never
 * appear on a `decompose_teen` item at all.
 */
export const teenVerdictCue = (item: TenFrameItem, produced: number): string => {
  const verdict = judgeTeen(item, produced);
  const total = teenTotalFor(item);
  const totalWord = numberWordFor(total);
  const onesWord = numberWordFor(total - TEEN_TEN);
  const head = item.kind === 'build_teen'
    ? `[TF_TEEN] The learner put ${produced} more counters beside the ten already on the frame, `
      + `making ${TEEN_TEN + produced}; the ask was for ${total} — that ${verdict === 'correct' ? 'MATCHES' : 'does NOT match'}. `
    : `[TF_TEEN] The learner turned ${produced} of the ${total} counters yellow; the ask was for ten `
      + `— that ${verdict === 'correct' ? 'MATCHES' : 'does NOT match'}. `;

  const line = verdict === 'correct'
    ? (item.kind === 'build_teen'
      ? `Say exactly: "Yes! Ten and ${onesWord} make ${totalWord}." `
      : `Say exactly: "Yes! Ten yellow, and ${onesWord} left red. ${cap(totalWord)} is ten and ${onesWord}." `)
    : `Say exactly: "${teenCorrectionFor(item, verdict)}" `;

  return `${head}${line}Never read bracket tags aloud.`;
};

/**
 * The `split` verdict — the pair the child enacted, judged in CODE, handed to
 * the tutor as a finished ruling.
 *
 * She is told the two numbers so her AFFIRMATION can name the decomposition the
 * child just built ("Yes! Two red and three yellow make five") — which is the
 * one moment in the item where a pair may be spoken, and it is spoken because
 * the child produced it, not to hand it over. On every wrong branch she gets
 * the correction verbatim and the pair never appears.
 */
export const splitVerdictCue = (
  item: TenFrameItem,
  split: TenFrameSplit,
  alreadyShown: ReadonlySet<string> = new Set(),
): string => {
  const verdict = judgeSplit(item, split, alreadyShown);
  const totalWord = numberWordFor(item.answer);
  const head =
    `[TF_SPLIT] The learner left ${split.a} counters red and turned ${split.b} yellow, `
    + `out of ${item.answer}. Verdict: ${verdict.toUpperCase()}`
    + (verdict === 'repeat' ? ` (they have already shown this exact pair for ${item.answer} in this session)` : '')
    + `. `;

  const line = verdict === 'correct'
    ? `Say exactly: "Yes! ${cap(numberWordFor(split.a))} red and ${numberWordFor(split.b)} yellow make ${totalWord}." `
    : `Say exactly: "${splitCorrectionFor(item, verdict)}" `;

  return `${head}${line}Never read bracket tags aloud.`;
};

/** The `build_pair` verdict: the learner's own pair, judged by `judgeSplit` against the ledger for its total. */
export const pairVerdictCue = (
  item: TenFrameItem,
  pair: TenFrameSplit,
  alreadyShown: ReadonlySet<string> = new Set(),
): string => {
  const verdict = judgeSplit(item, pair, alreadyShown);
  const head = `[TF_PAIR] The learner put ${pair.a} red and ${pair.b} yellow counters on the frame, `
    + `${pair.a + pair.b} altogether; the ask was ${item.answer}. Verdict: ${verdict.toUpperCase()}`
    + (verdict === 'repeat' ? ` (they already made this exact pair for ${item.answer} in this session)` : '') + '. ';
  const line = verdict === 'correct'
    ? `Say exactly: "Yes! ${cap(numberWordFor(pair.a))} red and ${numberWordFor(pair.b)} yellow make ${numberWordFor(item.answer)}." `
    : `Say exactly: "${pairCorrectionFor(item, verdict)}" `;
  return `${head}${line}Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: TenFrameItem,
  next: TenFrameItem | null,
  opts: TenFrameCueOptions = {},
): string => {
  if (!next) {
    return `[TF_MOVE] Say exactly: "Good try! The ten frame takes practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[TF_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[TF_COMPLETE] Say exactly: "What great number work today! Your eyes and your hands did hard thinking. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer. On `subitize` this is
 * the audio half of "flash again": it re-asks, and it must never narrate the
 * count (cvc's `[ISOLATE_VOWEL]` was an answer leak on demand — the same trap).
 */
export const pronounceCue = (item: TenFrameItem): string =>
  `[TF_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule), answer-free by construction: `subitize` pushes no
 * quantity at all because its count IS the answer, and neither make-ten branch
 * pushes the complement.
 */
export const stimulusFor = (item: TenFrameItem): string => {
  switch (item.kind) {
    case 'build':
      return `put ${numberWordFor(item.answer)} ${countersWord(item.answer)} on the frame`;
    case 'subitize':
      return 'a quick flash of counters on the frame';
    case 'make_ten':
      return `${numberWordFor(item.shown)} ${countersWord(item.shown)} shown, frame of ${numberWordFor(item.capacity)}`;
    case 'split':
      // Stimulus-side only: the total is on screen and in the ask. The PAIR the
      // child is working toward is never pushed through this channel.
      return `${numberWordFor(item.answer)} red ${countersWord(item.answer)} to split into two colour groups`;
    case 'build_pair':
      return `an empty frame; make ${numberWordFor(item.answer)} with red and yellow counters`;
    case 'build_teen':
      // Stimulus-side only: the full top frame and the teen number are both
      // public. The ones the child must place are not pushed.
      return `a full top frame of ten, and empty boxes below it, making ${numberWordFor(teenTotalFor(item))}`;
    case 'decompose_teen':
      return `${numberWordFor(item.answer)} red counters scattered over two frames, with a group of ten to find inside`;
    case 'add':
      return `${numberWordFor(item.addend1 ?? 0)} plus ${numberWordFor(item.addend2 ?? 0)}`;
    case 'subtract':
      return `${numberWordFor(item.shown)} ${countersWord(item.shown)}, take away ${numberWordFor(item.removed ?? 0)}`;
  }
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything ten-frame ever sends the tutor. `TenFrame.tsx` spreads this and
 * adds what only a mounted component can own (status lines, and the
 * `observation` that reads the live board); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * The split exists so the harness cannot drift from production: a Python
 * journey that mirrors the cue wording by hand is a second source of truth,
 * and this family has already paid that bill once (letter-spotter's generator
 * and script disagreed live on what a sayable sentence was).
 */
export const tenFramePackBase = (
  items: TenFrameItem[],
): JudgedCueSurface<TenFrameItem> => ({
  primitiveType: 'ten-frame',
  activityLine: 'live direct instruction ten frame practice',
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
