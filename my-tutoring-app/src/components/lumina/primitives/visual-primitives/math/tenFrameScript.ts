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
 *   add/subtract  → SPOKEN sum/difference   number_word_to_20   (benched)
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

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { countWalk, numberWordFor } from './countingBoardScript';

export type TenFrameItemKind = 'build' | 'subitize' | 'make_ten' | 'add' | 'subtract';
export type TenFrameBand = 'K' | '1-2';

/** The benched spoken-number window. Zero is excluded by the class record
 *  itself; 20 is the ceiling `number_word_to_20` was benched at. */
export const SPOKEN_ANSWER_MIN = 1;
export const SPOKEN_ANSWER_MAX = 20;

export interface TenFrameItem extends JudgedScriptItem {
  kind: TenFrameItemKind;
  /** Frame capacity — 10 for a single frame, 20 for a double. */
  capacity: number;
  /** Counters seeded on the frame when the item opens (make_ten, subtract). */
  shown: number;
  /** The number the child must PRODUCE: said aloud on voice items, enacted on
   *  gesture items (build = counters placed; make_ten @K = the complement). */
  answer: number;
  /** Counters that must be on the frame for a gesture item to auto-commit.
   *  Only make_ten @K has one (R6: it judges when the frame reaches capacity);
   *  `build` has no terminal state and closes its turn on stillness instead. */
  commitAt?: number;
  addend1?: number;
  addend2?: number;
  /** subtract: how many the child takes off the frame. */
  removed?: number;
}

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "one counter" / "two counters" — the number is adjacent in several asks and
 *  "Put one counters on the frame" is the kind of line a five-year-old hears
 *  as noise. */
const countersWord = (n: number) => (n === 1 ? 'counter' : 'counters');

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** A spoken answer must be inside the benched window. This is the gate that
 *  keeps zero and >20 out of the tutor's ear. */
export const isSayableAnswer = (n: unknown): n is number =>
  int(n) && n >= SPOKEN_ANSWER_MIN && n <= SPOKEN_ANSWER_MAX;

/** Model the counted walk only where it is sayable; above ten a chant is ear
 *  noise, so the correction names the answer and the strategy instead
 *  (countingBoardScript's rule, held). */
const WALK_CEILING = 10;

// ── Answer material — the fork, as code ─────────────────────────────────────

export const answerKindFor = (
  kind: TenFrameItemKind,
  band: TenFrameBand,
): 'voice' | 'gesture' =>
  kind === 'build' || (kind === 'make_ten' && band === 'K') ? 'gesture' : 'voice';

export const responseClassFor = (
  kind: TenFrameItemKind,
  band: TenFrameBand,
): ResponseClassId =>
  answerKindFor(kind, band) === 'gesture' ? 'manipulation' : 'number_word_to_20';

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. A mixed session can
 *  interleave placing, filling, looking and operating, so "what to do" is not a
 *  static protocol a non-reader can look up (cvc-speller rule). */
export const actionFor = (kind: TenFrameItemKind, band: TenFrameBand): string => {
  if (kind === 'make_ten') return band === 'K' ? 'fill' : 'complement';
  if (kind === 'add' || kind === 'subtract') return 'operate';
  return kind === 'build' ? 'place' : 'look';
};

// ── Build gates — DROP an unaskable item, never repair it into one ───────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface TenFrameChallengeLike {
  id: string;
  type: TenFrameItemKind;
  targetCount: number;
  startCount?: number;
  addend1?: number;
  addend2?: number;
}

/**
 * One generated challenge → one judged item, or NULL when the item cannot be
 * asked honestly. The drop conditions are ten-frame's two, plus structural
 * coherence:
 *   - a spoken answer of 0 (empty-frame subitize, a subtraction to nothing)
 *   - a spoken answer above 20 (outside the benched class)
 *   - a make-ten with nothing to complete, an add without addends, a
 *     subtraction that removes nothing.
 */
export const itemFromChallenge = (
  ch: TenFrameChallengeLike,
  ctx: { capacity: number; band: TenFrameBand },
): TenFrameItem | null => {
  const { capacity, band } = ctx;
  const base = {
    id: ch.id,
    kind: ch.type,
    answerKind: answerKindFor(ch.type, band),
    responseClass: responseClassFor(ch.type, band),
    action: actionFor(ch.type, band),
    capacity,
  } as const;

  switch (ch.type) {
    case 'build': {
      // Gestural: the target is the QUESTION (spoken in the ask), the placement
      // is the answer — so the ≤20 bench does not bind, only the frame does.
      if (!int(ch.targetCount) || ch.targetCount < 1 || ch.targetCount > capacity) return null;
      return { ...base, shown: 0, answer: ch.targetCount };
    }
    case 'subitize': {
      // An empty frame is a legitimate stimulus whose answer is "zero" — and
      // "zero" is unbenched. Drop it rather than teach the tutor to hear it.
      if (!isSayableAnswer(ch.targetCount) || ch.targetCount > capacity) return null;
      return { ...base, shown: 0, answer: ch.targetCount };
    }
    case 'make_ten': {
      const shown = ch.targetCount;
      if (!int(shown) || shown < 1 || shown >= capacity) return null;
      const complement = capacity - shown;
      // At K the complement is ENACTED, so the spoken bench does not apply;
      // reader grades say it aloud and must stay inside the window.
      if (band !== 'K' && !isSayableAnswer(complement)) return null;
      return {
        ...base,
        shown,
        answer: complement,
        commitAt: band === 'K' ? capacity : undefined,
      };
    }
    case 'add': {
      if (!int(ch.addend1) || !int(ch.addend2) || ch.addend1 < 1 || ch.addend2 < 1) return null;
      const sum = ch.addend1 + ch.addend2;
      if (!isSayableAnswer(sum) || sum > capacity) return null;
      return { ...base, shown: 0, answer: sum, addend1: ch.addend1, addend2: ch.addend2 };
    }
    case 'subtract': {
      const start = ch.startCount;
      if (!int(start) || start < 1 || start > capacity) return null;
      // A difference of zero answers "zero" — unbenched, so the item drops.
      if (!isSayableAnswer(ch.targetCount) || ch.targetCount >= start) return null;
      return { ...base, shown: start, answer: ch.targetCount, removed: start - ch.targetCount };
    }
  }
};

// ── How-to-play — spoken on the opener AND whenever the ACTION changes ──────

export const howToPlayFor = (item: TenFrameItem): string => {
  switch (item.kind) {
    case 'build':
      return 'Tap the boxes to put counters on the frame. ';
    case 'subitize':
      return 'Watch the frame — the counters show for just a moment. Then say how many you saw! ';
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? 'Some counters are already there. Tap the empty boxes until every box is full. '
        : 'Some counters are already there. Then say how many MORE counters fill the frame. ';
    case 'add':
      return 'Put the counters on the frame, then say how many there are altogether. ';
    case 'subtract':
      return 'Take counters off the frame, then say how many are left. ';
  }
};

// ── The asks — short, one defensible answer, problem STATED aloud ───────────

const askFor = (item: TenFrameItem): string => {
  const answerWord = numberWordFor(item.answer);
  const shownWord = numberWordFor(item.shown);
  const capWord = numberWordFor(item.capacity);

  switch (item.kind) {
    case 'build':
      return `Put ${answerWord} ${countersWord(item.answer)} on the frame. Your turn.`;
    case 'subitize':
      // Past tense on purpose: by the time this is answered the counters are
      // hidden (R4). Nothing here names a quantity.
      return 'Eyes ready — watch the frame! Your turn. How many counters did you see?';
    case 'make_ten':
      return item.answerKind === 'gesture'
        ? `There are ${shownWord} ${countersWord(item.shown)} on the frame. Your turn — fill it up.`
        : `There are ${shownWord} ${countersWord(item.shown)} on the frame. Your turn. How many more counters make ${capWord}?`;
    case 'add':
      return `${cap(numberWordFor(item.addend1 ?? 0))} plus ${numberWordFor(item.addend2 ?? 0)}. Your turn. How many altogether?`;
    case 'subtract':
      return `${cap(shownWord)} ${countersWord(item.shown)}. Take away ${numberWordFor(item.removed ?? 0)}. Your turn. How many are left?`;
  }
};

// ── The corrections — DISTAR re-model then re-elicit (standing gate 3) ──────
// This is the FIRST place the answer is ever spoken, and it is earned.

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
        `The starting number "${numberWordFor(item.shown)}" and the number taken away "${numberWordFor(item.removed ?? 0)}" are NOT the answer. `
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
export const frameVerdictCue = (item: TenFrameItem, placed: number): string => {
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
 * `diagnosisObservation` that reads the live board); the drive-plan endpoint
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

// ── Harness answer material — what a right and a wrong child sound like ─────

/** Numbers the ask STATES aloud, so hearing one back is not a leak. A
 *  make-ten of five into a frame of ten asks "there are five… how many more?"
 *  where the answer is also five; forbidding the word there would flag the
 *  question itself. */
const publicValuesFor = (item: TenFrameItem): number[] => {
  switch (item.kind) {
    case 'build':
      return [item.answer];
    case 'subitize':
      return [];
    case 'make_ten':
      return [item.shown, item.capacity];
    case 'add':
      return [item.addend1 ?? 0, item.addend2 ?? 0];
    case 'subtract':
      return [item.shown, item.removed ?? 0];
  }
};

export interface TenFrameHarnessAnswers {
  /** What a correct child says (or places). */
  correct: string;
  /** Unambiguously wrong — the baseline refusal test. */
  plainWrong: string;
  /**
   * The FLUENT miss this item's judging contract explicitly refuses. Testing
   * it tests the discrimination clause rather than mere arithmetic: a judge
   * that only catches "four for five" can still affirm the addend said back.
   */
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit a placement, not a word — code computes the match. */
  placed?: { correct: number; wrong: number };
  /** Answer tokens that must NOT appear in the spoken ask. */
  leakTokens: string[];
}

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `discriminationFor` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 */
export const tenFrameHarnessAnswers = (item: TenFrameItem): TenFrameHarnessAnswers => {
  const answerWord = numberWordFor(item.answer);
  const wrongValue = item.answer < SPOKEN_ANSWER_MAX ? item.answer + 1 : item.answer - 1;
  const leakTokens = publicValuesFor(item).includes(item.answer) ? [] : [answerWord];

  const base: TenFrameHarnessAnswers = {
    correct: answerWord,
    plainWrong: numberWordFor(wrongValue),
    leakTokens,
  };

  switch (item.kind) {
    case 'build':
    case 'make_ten':
      if (item.answerKind === 'gesture') {
        return {
          ...base,
          correct: `${item.answer} counters placed`,
          plainWrong: `${Math.max(0, item.answer - 1)} counters placed`,
          placed: { correct: item.answer, wrong: Math.max(0, item.answer - 1) },
        };
      }
      // make_ten @1-2: the contract refuses the TOTAL said back.
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.capacity),
          why: 'the total said back instead of how many MORE are needed',
        },
      };
    case 'subitize':
      return {
        ...base,
        signatureWrong: {
          text: countWalk(item.answer),
          why: 'counted up one at a time — lands on the right number, but subitizing is the skill',
        },
      };
    case 'add':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.addend1 ?? 0),
          why: 'an addend said back instead of the total',
        },
      };
    case 'subtract':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.shown),
          why: 'the starting number said back instead of what is left',
        },
      };
  }
};
