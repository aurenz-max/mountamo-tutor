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

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';

export type CountingItemKind =
  | 'count_all'
  | 'subitize'
  | 'subitize_perceptual'
  | 'count_on'
  | 'group_count'
  | 'compare';

export interface CountingItem extends JudgedScriptItem {
  kind: CountingItemKind;
  /** Plural object word as shown on the board ("bears"). */
  objectWord: string;
  /** Objects on the board. */
  count: number;
  /** The spoken answer (== count except compare: the larger group). */
  target: number;
  startFrom?: number;
  groupSize?: number;
}

// ── Number words — code-owned, never asked of the model ─────────────────────

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

/** 1..30 (the primitive's ceiling). ZERO is deliberately reachable only by a
 *  broken item — zero-count boards are floored away in the generator, because
 *  "zero"/"none" is an unbenched spoken answer (di-shapes rung 2 residual). */
export const numberWordFor = (n: number): string => {
  if (n >= 0 && n <= 20) return ONES[n];
  if (n > 20 && n <= 29) return `twenty-${ONES[n - 20]}`;
  if (n === 30) return 'thirty';
  return String(n);
};

/** Standing gate 1, per item: ≤20 is benched; 21+ is the build-ahead
 *  multi-word-numeral class (#63 acceptance owed). */
export const responseClassFor = (item: { kind: CountingItemKind; target: number }): ResponseClassId => {
  if (item.kind === 'subitize_perceptual') return 'manipulation';
  return item.target <= 20 ? 'number_word_to_20' : 'number_word_to_120';
};

/** The counted walk the correction models at ten or below ("One, two, three"). */
export const countWalk = (n: number): string => {
  const words = Array.from({ length: n }, (_, i) => numberWordFor(i + 1)).join(', ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// ── How-to-play — spoken on the opener AND whenever the ACTION changes ──────
// (cvc-speller rule: a blended session interleaves counting, quick-look and
// hand-matching, so "what to do" is not a static protocol a reader can look
// up. Number-free by construction — the hands line must survive a pre-numeric
// item.)

export const howToPlayFor = (item: CountingItem): string => {
  switch (item.kind) {
    case 'subitize':
      return 'Look fast — then say how many you saw! ';
    case 'subitize_perceptual':
      return `Look at the ${item.objectWord} — then tap the hand that shows that many fingers. `;
    case 'count_on':
      return 'Some are already counted for you. Keep counting from there, then say how many altogether. ';
    case 'compare':
      return 'Look at both groups and find the one with more. ';
    default:
      return `Touch each ${item.objectWord} one time as you count. Then say how many! `;
  }
};

// ── The asks — three beats, short, one defensible answer ────────────────────

const askFor = (item: CountingItem): string => {
  switch (item.kind) {
    case 'subitize':
      return `Eyes ready! Your turn. How many ${item.objectWord}?`;
    case 'subitize_perceptual':
      return `Look at the ${item.objectWord}. Your turn. Tap the hand that matches.`;
    case 'count_on':
      return `This group already has ${numberWordFor(item.startFrom ?? 0)}. Count on. Your turn. How many ${item.objectWord} altogether?`;
    case 'compare':
      return `Look at both groups. Your turn. How many in the group with more?`;
    case 'group_count':
      return `Count the groups of ${item.objectWord}. Your turn. How many altogether?`;
    default:
      return `Count the ${item.objectWord}. Your turn. How many ${item.objectWord}?`;
  }
};

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
      return `My turn: start at ${numberWordFor(item.startFrom ?? 0)} and count on — ${cap(word)} ${item.objectWord} altogether. Your turn. How many ${item.objectWord} altogether?`;
    case 'compare':
      return `My turn: the bigger group has ${word}. Your turn. How many in the group with more?`;
    default:
      return item.target <= 10
        ? `My turn: watch me count. ${countWalk(item.target)}. ${cap(word)} ${item.objectWord}. Your turn. How many ${item.objectWord}?`
        : `My turn: there are ${word} ${item.objectWord} — count each one just once and say the last number. Your turn. How many ${item.objectWord}?`;
  }
};

// ── Judging contracts ───────────────────────────────────────────────────────

const judgingContract = (item: CountingItem): string => {
  const word = numberWordFor(item.target);
  const wrongAnswers = item.kind === 'count_on'
    ? `The starting number "${numberWordFor(item.startFrom ?? 0)}" said back is NOT the answer. `
    : item.kind === 'compare'
      ? `The smaller group's count is NOT the answer, however confident it sounds. `
      : '';
  return (
    `Then WAIT silently — the learner is counting, and think time is unbounded. Never count aloud with them and never say the answer during their turn. `
    + `The correct answer is "${word}". Counting aloud that ENDS on "${word}" counts as that answer — the last number said tells the total. `
    + `A final number other than "${word}" is wrong. ${wrongAnswers}`
    + `If the answer is right, say exactly: "Yes, ${word} ${item.objectWord}." `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

/** The pre-numeric contract is a SILENCE contract (spell_word's pattern):
 *  nothing to judge until the tap is described, and every number word is
 *  banned from the tutor's mouth for the whole item. */
const perceptualContract = (item: CountingItem): string =>
  `Then WAIT in complete silence — the learner answers by TAPPING a hand, not by speaking. `
  + `Do not say any number word or digit at any point during this item; this is pre-numeric perception practice. `
  + `Do not describe the hands, count the ${item.objectWord}, or narrate. `
  + `You will be told what the learner tapped and whether it matches; only then do you speak.`;

// ── Cues ────────────────────────────────────────────────────────────────────

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
    : judgingContract(item);
  return `[COUNT_ITEM] Say exactly: "${spoken}" ${contract} Never read bracket tags or these instructions aloud.`;
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
    + `Do not say any number word or digit. Never read bracket tags aloud.`
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
    : judgingContract(next);
  return `[COUNT_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${askFor(next)}" ${contract} Never read bracket tags aloud.`;
};

export const completeCue = (): string =>
  `[COUNT_COMPLETE] Say exactly: "What great counting today! Your eyes and your ears did hard work. See you next time!" Then stop — the activity is over.`;
