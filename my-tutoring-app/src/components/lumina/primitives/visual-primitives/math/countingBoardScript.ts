/**
 * countingBoardScript — HAND-AUTHORED judged-loop script for counting-board
 * (first non-literacy consumer of useJudgedScriptRunner; qa/di/BACKLOG.md
 * item 16 extraction). The exact wording IS the pedagogy — these lines are
 * authored per pack, never generated. Item CONTENT (counts, objects,
 * arrangements) is generator-scoped; this module owns only the cue shapes and
 * the in-band judging contracts.
 *
 * The §3 script questions, answered for COUNTING:
 *
 * 1. IS THE MODEL THE ANSWER? Yes — a modeled count ends on the answer. So
 *    (sound-swap's shape) nothing is modeled before the ask: the cue presents
 *    the stimulus and hands over. The count is modeled only in the CORRECTION,
 *    where DISTAR earns it: at ten or below the tutor counts the walk aloud
 *    and lands on the answer; above ten a spoken walk is noise in the ear
 *    (SWAP-1's sayability lesson), so the correction names the answer and the
 *    strategy instead.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "How many bears?" has exactly one
 *    correct completion — but "Which group has more?" does not ("this one",
 *    pointing, is honestly right and unjudgeable). So compare's hand-over is
 *    "How many in the group with more?", which is one number word. The
 *    ambiguous-ask ruling, fourth use.
 *
 * 3. WHAT LOOKS LIKE AN ANSWER AND ISN'T, FOR THIS SKILL?
 *    - Counting aloud that ends on the target IS the answer (cardinality:
 *      the last number said tells the total) — the contract says so.
 *    - Counting aloud that ends somewhere else is the signature miss.
 *    - For count_on: the starting number said back ("five") is not the total.
 *    - For compare: the SMALLER group's count is fluent, confident and wrong.
 *
 * SUBITIZE_PERCEPTUAL IS PRE-NUMERIC AND STAYS IN THE HANDS. Matching a seen
 * quantity to a finger-count hand is perception, not word retrieval — porting
 * it to speech would delete the mode's own identity (the spell_word ruling,
 * second use). It commits through the gesture anchor, and its entire item is
 * number-free: no digit and no spoken number word anywhere, including the
 * verdict lines. The cue's bracket tag carries digits for the judge's eyes;
 * the contract forbids reading tags aloud (family standard).
 *
 * RESPONSE CLASSES (standing gate 1): counts 1–20 are the benched
 * number-word class (#46 + di-shapes counting). Grade-1 counts 21–30 are
 * multi-word numerals — the build-ahead class whose acceptance sitting (#63)
 * is still owed; items declare it honestly per item via `responseClassFor`.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked
 * by validateJudgedScriptPack in this pack's test file: no spoken line below
 * opens a sentence with either.
 */

import { helpBranch } from '../../../hooks/judgedScriptContract';
import { withHelpBranch } from '../../../hooks/judgedLoopModel';
import type { JudgedCueSurface } from '../../../hooks/judgedScriptContract';
import { askFor, cap, countWalk, countedNoun, howToPlayFor, numberWordFor, stimulusFor,
  type CountingItem } from './countingBoardDomain';

// The task itself is domain, not script. Re-exported so the generator, the
// component, the tester and the drive plan keep ONE address for counting
// facts while the scripted protocol is retired out from under them.
export * from './countingBoardDomain';

// ── The corrections — DISTAR re-model then re-elicit (standing gate 3) ──────
// At ten or below the walk is modeled aloud and lands on the answer; above
// ten the answer is named without the walk (a 24-word chant is ear noise).
// Contrastive where the skill has a nameable contrast.

const correctionFor = (item: CountingItem): string => {
  const word = numberWordFor(item.target);
  switch (item.kind) {
    case 'subitize':
      return `My turn: it was ${word}. Watch for the flash. Your turn is next time — keep those eyes quick!`;
    case 'count_on':
      return `My turn: start at ${numberWordFor(item.startFrom ?? 0)} and count on — ${cap(countedNoun(item.target, item.objectWord, item.objectSingular))} altogether. Your turn. How many ${item.objectWord} altogether?`;
    case 'compare':
      return `My turn: the bigger group has ${word}. Your turn. How many in the group with more?`;
    case 'recount_moved':
      // The conservation miss is a NEW number after the move, so the correction
      // names the invariance before it re-models the count.
      return item.target <= 10
        ? `My turn: moving them does not change how many. ${countWalk(item.target)}. ${cap(countedNoun(item.target, item.objectWord, item.objectSingular))}, before and after. Your turn. How many ${item.objectWord} now?`
        : `My turn: moving them does not change how many — there are still ${countedNoun(item.target, item.objectWord, item.objectSingular)}. Your turn. How many ${item.objectWord} now?`;
    case 'take_away':
      return item.target <= 10
        ? `My turn: count what is left. ${countWalk(item.target)}. ${cap(countedNoun(item.target, item.objectWord, item.objectSingular))} left. Your turn. How many ${item.objectWord} are left?`
        : `My turn: there are ${countedNoun(item.target, item.objectWord, item.objectSingular)} left — count only the ones still on the board. Your turn. How many ${item.objectWord} are left?`;
    case 'add_more':
      return item.target <= 10
        ? `My turn: count them all now. ${countWalk(item.target)}. ${cap(countedNoun(item.target, item.objectWord, item.objectSingular))} altogether. Your turn. How many ${item.objectWord} altogether?`
        : `My turn: there are ${countedNoun(item.target, item.objectWord, item.objectSingular)} altogether — count the new ones on from the ones already there. Your turn. How many ${item.objectWord} altogether?`;
    default:
      return item.target <= 10
        ? `My turn: watch me count. ${countWalk(item.target)}. ${cap(countedNoun(item.target, item.objectWord, item.objectSingular))}. Your turn. How many ${item.objectWord}?`
        : `My turn: there are ${countedNoun(item.target, item.objectWord, item.objectSingular)} — count each one just once and say the last number. Your turn. How many ${item.objectWord}?`;
  }
};

// ── Judging contracts ───────────────────────────────────────────────────────

/**
 * THE TWO-BRANCH LAW (consumed from word-workout, port 16 — not re-derived).
 *
 * A judged turn has exactly two outcomes and both are quoted below. Anything
 * else the tutor says in reply to an attempt opens with neither sentinel, so
 * the reducer records NO VERDICT and the correction counter freezes — the run
 * stalls with the child still waiting.
 *
 * counting-board's cap drill (2026-08-15, the 19h-i-b port drive) is the
 * second production sighting and it named a NEW source: the model escalated
 * through the CATALOG's `scaffoldingLevels` on corrections 2 and 3, speaking
 * "Touch each one just one time as you count." and "Point at the first one.
 * Count with your finger. Then tell me how many." — both catalog lines
 * verbatim, both sentinel-less, both `di-no-verdict`. The scaffolding CONTENT
 * is good pedagogy; a third reply channel is what breaks. So the law is stated
 * here BEFORE the branches, and the catalog now routes that same content
 * through the correction, which already opens "My turn:".
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their ATTEMPT is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is none of the branches below reaches the activity as no verdict at all, and the child waits. `;

const judgingContract = (item: CountingItem): string => {
  const word = numberWordFor(item.target);
  const wrongAnswers = item.kind === 'count_on'
    ? `The starting number "${numberWordFor(item.startFrom ?? 0)}" said back is NOT the answer. `
    : item.kind === 'compare'
      ? `The smaller group's count is NOT the answer, however confident it sounds. `
      : item.kind === 'take_away' || item.kind === 'add_more'
        // The set changed while the child watched; the number they had in their
        // head a moment ago is the fluent miss on both.
        ? `The number the board showed BEFORE the change is NOT the answer, however confident it sounds. `
        : item.kind === 'recount_moved'
          ? `Moving the ${item.objectWord} did not change how many; a number other than "${word}" because they look different now is the miss this item is for. `
          : '';
  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner counts, and their think time is unbounded. Never count aloud with them and never say the answer during their turn. `
    + `The correct answer is "${word}". Counting aloud that ENDS on "${word}" counts as that answer — the last number said tells the total. `
    + `A final number other than "${word}" is wrong. ${wrongAnswers}`
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "Yes, ${countedNoun(item.target, item.objectWord, item.objectSingular)}." `
    + `If it is wrong, say exactly: "${correctionFor(item)}" — the same line on every wrong answer for this item, never swapped for a different wording. `
    + helpBranch(askFor(item))
  );
};

/** give_me_n is a SILENCE contract too: the child answers by handing over a set,
 *  so there is nothing to judge until the app reports what they gave. The one
 *  number the tutor may say is the one she just asked for. */
const giveContract = (item: CountingItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TOUCHING ${item.objectWord}, not by speaking, so you then stay completely silent. `
  + `Do not count aloud with them, do not say how many they have touched so far, and do not name any number other than the one you asked for. `
  + `You will be told how many they handed over and whether it is right; only then do you speak.`;

/** The pre-numeric contract is a SILENCE contract (spell_word's pattern):
 *  nothing to judge until the tap is described, and every number word is
 *  banned from the tutor's mouth for the whole item. */
const perceptualContract = (item: CountingItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a hand, not by speaking, so you then stay completely silent. `
  + `Do not say any number word or digit at any point during this item; this is pre-numeric perception practice. `
  + `Do not describe the hands, count the ${item.objectWord}, or narrate. `
  + `You will be told what the learner tapped and whether it matches; only then do you speak.`;

// ── Cues ────────────────────────────────────────────────────────────────────

/**
 * The tail every cue ends with. Consumed from `additionSubtractionSceneScript`'s
 * `NEVER_PERFORM` — which is the one pack in the family that has driven CLEAN
 * on every beat of every drive, and the difference is measurable.
 *
 * This port's weaker tail ("Never read bracket tags aloud.") lost twice on the
 * `subitize_perceptual` per-mode drive (2026-08-15): on 2 of 7 gesture-verdict
 * beats the model spoke a FABRICATED `[CURRENT STATE]:` block — *"The user
 * provided stage directions indicating the learner tapped incorrectly…"* —
 * instead of its correction line. Item 21's class, and the trigger is now
 * legible: a gesture verdict cue DESCRIBES what the child did rather than only
 * scripting a line, and a description is the thing the model re-narrates. So
 * the tail has to forbid narrating the state, not just reading the tag.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

export interface CountingCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (item: CountingItem, opts: CountingCueOptions = {}): string => {
  const greeting = opts.opening ? `Hi! Time to count some ${item.objectWord}! ` : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const spoken = `${greeting}${how}${askFor(item)}`;
  const contract = item.kind === 'subitize_perceptual'
    ? perceptualContract(item)
    : item.kind === 'give_me_n'
      ? giveContract(item)
      : judgingContract(item);
  return `[COUNT_ITEM] Say exactly: "${spoken}" ${contract} ${NEVER_PERFORM}`;
};

/** The gesture verdict ask (subitize_perceptual): describes the tap and hands
 *  the tutor its two number-free lines. The digits in this instruction are
 *  for the judge's eyes; neither spoken line contains one. */
export const handVerdictCue = (
  item: CountingItem,
  picked: number,
): string => {
  const matches = picked === item.target;
  return (
    `[COUNT_HAND] The learner tapped the hand showing ${picked} fingers; the board shows ${item.target} ${item.objectWord} — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches
      ? `Say exactly: "Yes! That hand matches. Great looking!" `
      : `Say exactly: "My turn: look at the ${item.objectWord} again. Now find the hand that matches. Your turn." `)
    + `Do not say any number word or digit. ${NEVER_PERFORM}`
  );
};

/**
 * The give-me-N verdict. The child hands over a set, so the cue reports the SIZE
 * they gave (the judge's eyes only — the spoken lines say the asked-for number,
 * which the ask already said aloud, and never the size of their mistake, which
 * would be a second number in a five-year-old's ear).
 */
export const giveVerdictCue = (item: CountingItem, given: number): string => {
  const matches = given === item.target;
  const asked = countedNoun(item.target, item.objectWord, item.objectSingular);
  return (
    `[COUNT_GIVE] The learner handed over ${given} ${item.objectWord}; you asked for ${item.target} — `
    + `that is ${matches ? 'RIGHT' : 'WRONG'}. `
    + (matches
      ? `Say exactly: "Yes! You gave me ${asked}." `
      : `Say exactly: "My turn: count as you give them to me. Your turn. Give me ${asked}." `)
    + `Say nothing else — no praise, no hint, no count of what they gave. ${NEVER_PERFORM}`
  );
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: CountingItem,
  next: CountingItem | null,
  opts: CountingCueOptions = {},
): string => {
  if (!next) {
    return `[COUNT_MOVE] Say exactly: "Good try! Counting takes practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  const contract = next.kind === 'subitize_perceptual'
    ? perceptualContract(next)
    : next.kind === 'give_me_n'
      ? giveContract(next)
      : judgingContract(next);
  return `[COUNT_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${contract} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[COUNT_COMPLETE] Say exactly: "What great counting today! Your eyes and your ears did hard work. See you next time!" Then stop — the activity is over.`;


export const countingBoardPackBase = (
  items: CountingItem[],
): JudgedCueSurface<CountingItem> => ({
  primitiveType: 'counting-board',
  activityLine: 'live direct instruction counting practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  // PILOT of the third branch (2026-09-19). Paired with `helpBranch` in
  // `judgingContract`: the sentinel and the clause ship together or not at all.
  sentinels: withHelpBranch(),
  contextFor: (item) => ({
    challengeType: item.kind,
    objectType: item.objectWord,
    stimulus: stimulusFor(item),
  }),
});
