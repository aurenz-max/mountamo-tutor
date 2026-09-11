/**
 * diWordProblemPlan — the CODE-OWNED story, family and answer behind
 * di-word-problem-setup (design brief 2026-09-07 "DI for Older Learners",
 * concept 4; handoff qa/HANDOFF-di-word-problem-setup-2026-09-07.md).
 *
 * The pack's thesis: G1-4 word problems break at SETUP, not arithmetic — a
 * child computes the two numbers they see with whatever operation feels right.
 * Connecting Math Concepts' answer is the NUMBER FAMILY: every addition or
 * subtraction story has two small numbers and a big number, the story gives
 * two of the three, and the child must decide WHICH is the big number before
 * touching the arithmetic. That decision is a MOVE, judged by the same
 * `procedure_step` machinery item 37 built — here made with the HANDS (the big
 * number is PLACED at the arrowhead) — and the family is then SAID.
 *
 * For that to be honest, everything the judge is handed has to come from code:
 * the story frame, the numbers, which quantity is unknown, the family and the
 * answer. Gemini supplies only a THEME (two names, an object noun, a verb pair)
 * and never a number. This module is that plan, and nothing in it knows about
 * cues, React or Gemini.
 *
 * PILOT CONTENT GATES (each a "true by construction" rule, so the judge is
 * never asked to discriminate something the bench cannot see):
 *  - EVERY QUANTITY ≥ 2 — never zero ("zero" is unbenched as a spoken answer)
 *    and never one (an answer of one breaks every plural in the answer
 *    sentence and makes the story trivial).
 *  - THE TWO PRINTED NUMBERS ARE DISTINCT and NEITHER EQUALS THE ANSWER — else
 *    "the biggest number I see" and "combine them any way" can land right.
 *  - THE ANSWER WORD NEVER APPEARS IN THE STORY (token-level, hyphens split,
 *    so an answer of twenty is refused against a story that says twenty-two).
 *  - A THEME IS REFUSED, NEVER REPAIRED: one-word capitalised names, a plain
 *    plural noun that is not a number or size word, a gain/loss verb pair that
 *    is really a gain and a loss (the ambiguous ones — shared, traded — are
 *    refuse-listed), no double quote, no sentinel opener anywhere.
 */

import { numberWord } from './diWorkedProcedurePlan';
import { opensWithSentinel } from '../../../hooks/judgedScriptContract';

export { numberWord };

// ── Shapes, roles, slots ─────────────────────────────────────────────────────

/** CMC's taxonomy of addition/subtraction stories — the classify step's menu. */
export type StoryShape = 'comparison' | 'change' | 'part_whole';
export const STORY_SHAPES: readonly StoryShape[] = ['comparison', 'change', 'part_whole'];

/** How the child says a shape, and the menu word the contract accepts. */
export const SHAPE_WORD: Record<StoryShape, string> = {
  comparison: 'comparison',
  change: 'change',
  part_whole: 'part-whole',
};

export type FamilySlot = 'small1' | 'small2' | 'big';

export type QuantityRole =
  | 'more_person' | 'fewer_person' | 'difference'   // comparison
  | 'start' | 'change' | 'end'                       // change
  | 'part1' | 'part2' | 'whole';                     // part-whole

/** One of the three amounts in a story. `id` is what the stage commits when
 *  the child places it; `label` is what everyone calls it (chip + tutor). */
export interface Quantity {
  id: string;
  role: QuantityRole;
  slot: FamilySlot;
  value: number;
  /** Printed in the story (false = the box). */
  known: boolean;
  label: string;
}

// ── Themes (the only thing Gemini writes) ────────────────────────────────────

export interface StoryTheme {
  nameA: string;
  nameB: string;
  /** Plain plural, lowercase: "stickers". */
  nounPlural: string;
  /** Past tense + base form of a GAIN verb: "found" / "find". */
  gainPast: string;
  gainBase: string;
  /** Past tense + base form of a LOSS verb: "lost" / "lose". */
  losePast: string;
  loseBase: string;
}

/** Adjective pairs for part-whole stories — code-owned, so the two parts are
 *  always separable by ear and never a number or a size. */
export const PART_ADJECTIVE_PAIRS: readonly [string, string][] = [
  ['red', 'blue'],
  ['green', 'yellow'],
  ['striped', 'spotted'],
];

const NAME_RE = /^[A-Z][a-z]{1,9}$/;
const WORD_RE = /^[a-z]{2,12}$/;
const PHRASE_RE = /^[a-z]{2,12}( [a-z]{2,8})?$/;

/** Nouns that are numbers, sizes or groups in disguise — a story about "three
 *  dozen" or "two pairs" has a second number in it the child cannot see. */
const NOUN_REFUSE = new Set([
  'dozen', 'dozens', 'pair', 'pairs', 'half', 'halves', 'couple', 'couples', 'few', 'some',
  'many', 'several', 'hundred', 'hundreds', 'thousand', 'thousands', 'ten', 'tens', 'twenty',
  'group', 'groups', 'set', 'sets', 'bunch', 'bunches', 'lot', 'lots', 'number', 'numbers',
  'money', 'dollars', 'cents', 'minutes', 'hours', 'inches', 'feet', 'pounds',
]);

/** Verbs that are neither a plain gain nor a plain loss. */
const VERB_REFUSE = new Set([
  'shared', 'share', 'traded', 'trade', 'swapped', 'swap', 'moved', 'move', 'changed', 'change',
  'counted', 'count', 'used', 'use', 'sorted', 'sort', 'kept', 'keep', 'saw', 'see', 'had', 'have',
  'made', 'make', 'played', 'play', 'put', 'took', 'take', 'got', 'get',
]);

const hasQuote = (s: string): boolean => /["“”]/.test(s);

/** Is this theme usable as it stands? Refuse, never repair. */
export const themeUsable = (t: StoryTheme | null | undefined): t is StoryTheme => {
  if (!t) return false;
  const { nameA, nameB, nounPlural, gainPast, gainBase, losePast, loseBase } = t;
  if (![nameA, nameB, nounPlural, gainPast, gainBase, losePast, loseBase].every((v) => typeof v === 'string')) return false;
  if (!NAME_RE.test(nameA) || !NAME_RE.test(nameB) || nameA === nameB) return false;
  if (!WORD_RE.test(nounPlural) || !nounPlural.endsWith('s') || NOUN_REFUSE.has(nounPlural)) return false;
  for (const v of [gainPast, gainBase, losePast, loseBase]) {
    if (!PHRASE_RE.test(v) || VERB_REFUSE.has(v)) return false;
  }
  if (gainPast === losePast || gainBase === loseBase) return false;
  const all = [nameA, nameB, nounPlural, gainPast, gainBase, losePast, loseBase].join(' ');
  if (hasQuote(all) || opensWithSentinel(all)) return false;
  return true;
};

// ── Frames ───────────────────────────────────────────────────────────────────

export type FrameId =
  | 'comparison:more_person'
  | 'comparison:difference'
  | 'comparison:fewer_person'
  | 'change:gain_end'
  | 'change:loss_end'
  | 'change:gain_change'
  | 'change:loss_change'
  | 'part_whole:whole'
  | 'part_whole:part';

export const FRAME_IDS: readonly FrameId[] = [
  'comparison:more_person', 'comparison:difference', 'comparison:fewer_person',
  'change:gain_end', 'change:loss_end', 'change:gain_change', 'change:loss_change',
  'part_whole:whole', 'part_whole:part',
];

export const shapeOfFrame = (frameId: FrameId): StoryShape => frameId.split(':')[0] as StoryShape;

export const isFrameId = (v: unknown): v is FrameId =>
  typeof v === 'string' && (FRAME_IDS as readonly string[]).includes(v);

/** How the answer comes from the two PRINTED numbers, in printed order. */
type Arithmetic = 'sum' | 'first_minus_second' | 'second_minus_first';

const FRAME_ARITHMETIC: Record<FrameId, Arithmetic> = {
  'comparison:more_person': 'sum',
  'comparison:difference': 'first_minus_second',
  'comparison:fewer_person': 'first_minus_second',
  'change:gain_end': 'sum',
  'change:loss_end': 'first_minus_second',
  'change:gain_change': 'second_minus_first',
  'change:loss_change': 'first_minus_second',
  'part_whole:whole': 'sum',
  'part_whole:part': 'first_minus_second',
};

/** Frames whose big number is the UNKNOWN — where "the biggest number I see"
 *  is a live wrong move. `find_big_number` draws at least one of these. */
export const BIG_UNKNOWN_FRAMES: readonly FrameId[] = [
  'comparison:more_person', 'change:gain_end', 'part_whole:whole',
];

// ── The plan ─────────────────────────────────────────────────────────────────

export interface WordProblemSpec {
  id: string;
  frameId: FrameId;
  theme: StoryTheme;
  /** The two PRINTED numbers, in the order the story prints them. */
  first: number;
  second: number;
  /** Part-whole only: which adjective pair. Defaults to the first. */
  adjectivePair?: number;
}

export interface WordProblemPlan {
  shape: StoryShape;
  frameId: FrameId;
  /** Printed: digits. */
  story: string;
  /** Spoken by the tutor: number words. */
  storySpoken: string;
  /** The question sentence alone, spoken — the solve step's re-ask. */
  questionSpoken: string;
  quantities: Quantity[];
  big: Quantity;
  small1: Quantity;
  small2: Quantity;
  unknown: Quantity;
  answer: number;
  /** add when the box is the big number, else subtract. */
  operation: 'add' | 'subtract';
  /** The operation the story's own word suggests to a child, and that word. */
  verbCueOperation: 'add' | 'subtract';
  verbCueWord: string;
  /** "Jen has twenty stickers." — the closing sentence after the solve. */
  answerSentence: string;
  /** Why this quantity is the big number — the affirmation's reason. */
  bigReason: string;
  maxNumber: number;
}

const w = numberWord;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Number-word tokens of a spoken string (hyphens split). */
const numberTokens = (spoken: string): Set<string> =>
  new Set(spoken.toLowerCase().replace(/[^a-z-]+/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean));

const q = (
  id: string, role: QuantityRole, slot: FamilySlot, value: number, known: boolean, label: string,
): Quantity => ({ id, role, slot, value, known, label });

/**
 * Plan one story, or return null when the spec violates a pilot gate (see the
 * module docblock). The caller never backfills a null — a problem that fails
 * here is dropped, exactly as an unaskable item is dropped from a judged pack.
 */
export function planWordProblem(spec: WordProblemSpec, maxNumber = 20): WordProblemPlan | null {
  if (!isFrameId(spec.frameId) || !themeUsable(spec.theme)) return null;
  const { first, second } = spec;
  if (!Number.isInteger(first) || !Number.isInteger(second)) return null;
  if (first < 2 || second < 2 || first > maxNumber || second > maxNumber || first === second) return null;

  const arithmetic = FRAME_ARITHMETIC[spec.frameId];
  const answer = arithmetic === 'sum' ? first + second
    : arithmetic === 'first_minus_second' ? first - second
      : second - first;
  // Every quantity ≥ 2: "zero" is unbenched, and an answer of one breaks every
  // plural in the answer sentence ("one shells are spotted") while making the
  // story trivial ("sixteen of the seventeen").
  if (answer < 2 || answer > maxNumber || answer === first || answer === second) return null;

  const t = spec.theme;
  const A = t.nameA;
  const B = t.nameB;
  const nouns = t.nounPlural;
  const [adj1, adj2] = PART_ADJECTIVE_PAIRS[spec.adjectivePair ?? 0] ?? PART_ADJECTIVE_PAIRS[0];
  const shape = shapeOfFrame(spec.frameId);

  // Each frame: the story in two forms, the three quantities with their family
  // slots, the verb cue, the answer sentence and the big-number reason.
  type Built = {
    printed: string; spoken: string; question: string;
    quantities: [Quantity, Quantity, Quantity];
    verbCue: 'add' | 'subtract'; verbCueWord: string;
    answerSentence: string; bigReason: string;
  };
  const twoForms = (template: (n1: string, n2: string) => string): [string, string] =>
    [template(String(first), String(second)), template(w(first), w(second))];

  let built: Built;
  switch (spec.frameId) {
    case 'comparison:more_person': {
      const [printed, spoken] = twoForms((n, d) =>
        `${A} has ${n} ${nouns}. ${B} has ${d} more ${nouns} than ${A}. How many ${nouns} does ${B} have?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} does ${B} have?`,
        quantities: [
          q('q-a', 'fewer_person', 'small1', first, true, `${A}'s ${nouns}`),
          q('q-diff', 'difference', 'small2', second, true, 'how many more'),
          q('q-b', 'more_person', 'big', answer, false, `${B}'s ${nouns}`),
        ],
        verbCue: 'add', verbCueWord: 'more',
        answerSentence: `${B} has ${w(answer)} ${nouns}.`,
        bigReason: `${B} has more than ${A}, so ${B}'s ${nouns} is the whole amount`,
      };
      break;
    }
    case 'comparison:difference': {
      const [printed, spoken] = twoForms((n, m) =>
        `${A} has ${n} ${nouns}. ${B} has ${m} ${nouns}. How many more ${nouns} does ${A} have than ${B}?`);
      built = {
        printed, spoken,
        question: `How many more ${nouns} does ${A} have than ${B}?`,
        quantities: [
          q('q-a', 'more_person', 'big', first, true, `${A}'s ${nouns}`),
          q('q-b', 'fewer_person', 'small1', second, true, `${B}'s ${nouns}`),
          q('q-diff', 'difference', 'small2', answer, false, 'how many more'),
        ],
        verbCue: 'add', verbCueWord: 'more',
        answerSentence: `${A} has ${w(answer)} more ${nouns} than ${B}.`,
        bigReason: `${A} has more than ${B}, so ${A}'s ${nouns} is the whole amount`,
      };
      break;
    }
    case 'comparison:fewer_person': {
      const [printed, spoken] = twoForms((n, d) =>
        `${A} has ${n} ${nouns}. ${B} has ${d} fewer ${nouns} than ${A}. How many ${nouns} does ${B} have?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} does ${B} have?`,
        quantities: [
          q('q-a', 'more_person', 'big', first, true, `${A}'s ${nouns}`),
          q('q-diff', 'difference', 'small1', second, true, 'how many fewer'),
          q('q-b', 'fewer_person', 'small2', answer, false, `${B}'s ${nouns}`),
        ],
        verbCue: 'subtract', verbCueWord: 'fewer',
        answerSentence: `${B} has ${w(answer)} ${nouns}.`,
        bigReason: `${B} has fewer than ${A}, so ${A}'s ${nouns} is the whole amount`,
      };
      break;
    }
    case 'change:gain_end': {
      const [printed, spoken] = twoForms((n, m) =>
        `${A} had ${n} ${nouns}. Then ${A} ${t.gainPast} ${m} more. How many ${nouns} does ${A} have now?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} does ${A} have now?`,
        quantities: [
          q('q-start', 'start', 'small1', first, true, `what ${A} started with`),
          q('q-change', 'change', 'small2', second, true, `what ${A} ${t.gainPast}`),
          q('q-now', 'end', 'big', answer, false, `what ${A} has now`),
        ],
        verbCue: 'add', verbCueWord: t.gainPast,
        answerSentence: `${A} has ${w(answer)} ${nouns} now.`,
        bigReason: `${A} ${t.gainPast} more, so what ${A} has now is the whole amount`,
      };
      break;
    }
    case 'change:loss_end': {
      const [printed, spoken] = twoForms((n, m) =>
        `${A} had ${n} ${nouns}. Then ${A} ${t.losePast} ${m} of them. How many ${nouns} does ${A} have now?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} does ${A} have now?`,
        quantities: [
          q('q-start', 'start', 'big', first, true, `what ${A} started with`),
          q('q-change', 'change', 'small1', second, true, `what ${A} ${t.losePast}`),
          q('q-now', 'end', 'small2', answer, false, `what ${A} has now`),
        ],
        verbCue: 'subtract', verbCueWord: t.losePast,
        answerSentence: `${A} has ${w(answer)} ${nouns} now.`,
        bigReason: `${A} ${t.losePast} some, so what ${A} started with is the whole amount`,
      };
      break;
    }
    case 'change:gain_change': {
      const [printed, spoken] = twoForms((n, k) =>
        `${A} had ${n} ${nouns}. Then ${A} ${t.gainPast} some more. Now ${A} has ${k} ${nouns}. How many ${nouns} did ${A} ${t.gainBase}?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} did ${A} ${t.gainBase}?`,
        quantities: [
          q('q-start', 'start', 'small1', first, true, `what ${A} started with`),
          q('q-now', 'end', 'big', second, true, `what ${A} has now`),
          q('q-change', 'change', 'small2', answer, false, `what ${A} ${t.gainPast}`),
        ],
        verbCue: 'add', verbCueWord: t.gainPast,
        answerSentence: `${A} ${t.gainPast} ${w(answer)} ${nouns}.`,
        bigReason: `${A} ${t.gainPast} more, so what ${A} has now is the whole amount`,
      };
      break;
    }
    case 'change:loss_change': {
      const [printed, spoken] = twoForms((n, k) =>
        `${A} had ${n} ${nouns}. Then ${A} ${t.losePast} some of them. Now ${A} has ${k} ${nouns}. How many ${nouns} did ${A} ${t.loseBase}?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} did ${A} ${t.loseBase}?`,
        quantities: [
          q('q-start', 'start', 'big', first, true, `what ${A} started with`),
          q('q-now', 'end', 'small1', second, true, `what ${A} has now`),
          q('q-change', 'change', 'small2', answer, false, `what ${A} ${t.losePast}`),
        ],
        verbCue: 'subtract', verbCueWord: t.losePast,
        answerSentence: `${A} ${t.losePast} ${w(answer)} ${nouns}.`,
        bigReason: `${A} ${t.losePast} some, so what ${A} started with is the whole amount`,
      };
      break;
    }
    case 'part_whole:whole': {
      const [printed, spoken] = twoForms((n, m) =>
        `There are ${n} ${adj1} ${nouns} and ${m} ${adj2} ${nouns}. How many ${nouns} are there in all?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} are there in all?`,
        quantities: [
          q('q-part1', 'part1', 'small1', first, true, `${adj1} ${nouns}`),
          q('q-part2', 'part2', 'small2', second, true, `${adj2} ${nouns}`),
          q('q-all', 'whole', 'big', answer, false, `all the ${nouns}`),
        ],
        verbCue: 'add', verbCueWord: 'in all',
        answerSentence: `There are ${w(answer)} ${nouns} in all.`,
        bigReason: `all the ${nouns} together is the whole amount`,
      };
      break;
    }
    case 'part_whole:part': {
      const [printed, spoken] = twoForms((k, n) =>
        `There are ${k} ${nouns}. ${cap(n)} of them are ${adj1}. The rest are ${adj2}. How many ${nouns} are ${adj2}?`);
      built = {
        printed, spoken,
        question: `How many ${nouns} are ${adj2}?`,
        quantities: [
          q('q-all', 'whole', 'big', first, true, `all the ${nouns}`),
          q('q-part1', 'part1', 'small1', second, true, `${adj1} ${nouns}`),
          q('q-part2', 'part2', 'small2', answer, false, `${adj2} ${nouns}`),
        ],
        verbCue: 'subtract', verbCueWord: 'the rest',
        answerSentence: `${cap(w(answer))} ${nouns} are ${adj2}.`,
        bigReason: `all the ${nouns} together is the whole amount`,
      };
      break;
    }
  }

  // The answer word never appears in the story — token-level, hyphens split.
  const storyNumbers = numberTokens(built.spoken);
  for (const token of Array.from(numberTokens(w(answer)))) {
    if (storyNumbers.has(token)) return null;
  }
  if (hasQuote(built.printed) || opensWithSentinel(built.spoken)) return null;

  const quantities = built.quantities;
  const bySlot = (slot: FamilySlot): Quantity => quantities.find((x) => x.slot === slot)!;
  const big = bySlot('big');
  const unknown = quantities.find((x) => !x.known)!;
  return {
    shape,
    frameId: spec.frameId,
    story: built.printed,
    storySpoken: built.spoken,
    questionSpoken: built.question,
    quantities,
    big,
    small1: bySlot('small1'),
    small2: bySlot('small2'),
    unknown,
    answer,
    operation: unknown.slot === 'big' ? 'add' : 'subtract',
    verbCueOperation: built.verbCue,
    verbCueWord: built.verbCueWord,
    answerSentence: built.answerSentence,
    bigReason: built.bigReason,
    maxNumber,
  };
}

// ── The family, spoken ───────────────────────────────────────────────────────

/** A slot's spoken value, or "box" for the unknown. */
export const slotWord = (x: Quantity): string => (x.known ? w(x.value) : 'box');

/** "twelve plus box equals twenty" — the canonical family. */
export const familySpoken = (plan: WordProblemPlan): string =>
  `${slotWord(plan.small1)} plus ${slotWord(plan.small2)} equals ${slotWord(plan.big)}`;

/** The two small numbers in the other order — equally right. */
export const familySpokenSwapped = (plan: WordProblemPlan): string =>
  `${slotWord(plan.small2)} plus ${slotWord(plan.small1)} equals ${slotWord(plan.big)}`;

/**
 * The family UPSIDE DOWN — the big number in a small slot — which is what "the
 * biggest number I see" sounds like once it reaches the family. When the big
 * number is the box, a known number gets promoted to the big slot and the box
 * demoted; when the big number is known, it is said before "equals".
 */
export const familyMisplaced = (plan: WordProblemPlan): string => {
  if (!plan.big.known) {
    const [lo, hi] = [plan.small1.value, plan.small2.value].sort((a, b) => a - b);
    return `${w(lo)} plus box equals ${w(hi)}`;
  }
  const knownSmall = plan.small1.known ? plan.small1 : plan.small2;
  return `${w(plan.big.value)} plus ${w(knownSmall.value)} equals box`;
};

/** "twenty minus twelve equals box" — arithmetic, not a family. Only the
 *  subtraction frames have one. */
export const familyAsSubtraction = (plan: WordProblemPlan): string | null => {
  if (!plan.big.known) return null;
  const knownSmall = plan.small1.known ? plan.small1 : plan.small2;
  return `${w(plan.big.value)} minus ${w(knownSmall.value)} equals box`;
};

/** A family with a number missing. */
export const familyIncomplete = (plan: WordProblemPlan): string =>
  plan.big.known ? `box equals ${w(plan.big.value)}` : `${w(plan.small1.value)} plus box`;

/** The family with the box filled by the right number — a child who solves
 *  inline has the family right. */
export const familySolved = (plan: WordProblemPlan): string =>
  `${w(plan.small1.value)} plus ${w(plan.small2.value)} equals ${w(plan.big.value)}`;

/** The arithmetic sentence the solve step affirms: "twelve plus eight equals
 *  twenty" or "twenty minus twelve equals eight". */
export const equationSpoken = (plan: WordProblemPlan): string => {
  if (plan.operation === 'add') return familySolved(plan);
  const knownSmall = plan.small1.known ? plan.small1 : plan.small2;
  return `${w(plan.big.value)} minus ${w(knownSmall.value)} equals ${w(plan.answer)}`;
};

/** The two printed numbers combined the WRONG way — the solve step's signature
 *  error (the numbers you see, with the other operation). */
export const wrongWayAnswer = (plan: WordProblemPlan): number => {
  const known = plan.quantities.filter((x) => x.known).map((x) => x.value);
  const [a, b] = known;
  return plan.operation === 'add' ? Math.abs(a - b) : a + b;
};

/**
 * The "biggest number I see" placement — the quantity a child puts at the
 * arrowhead when they pick by size instead of by role. When the big number is
 * the box that is the larger printed number; when the big number is printed
 * that strategy lands right, so the live wrong placement is the other printed
 * number.
 */
export const bigNumberWrongPlacement = (plan: WordProblemPlan): Quantity => {
  const known = plan.quantities.filter((x) => x.known && x.slot !== 'big');
  return known.reduce((best, x) => (x.value > best.value ? x : best), known[0]);
};

// ── The pool ─────────────────────────────────────────────────────────────────

let seed = 0x5a17c3d;
/** Deterministic PRNG so a test can pin a session; the generator reseeds from time. */
export const reseedWordProblemPool = (value: number): void => { seed = value >>> 0 || 1; };
const rand = (): number => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0x100000000;
};
const randInt = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

/**
 * Draw the two printed numbers for one frame, or null when the frame cannot
 * be filled inside `maxNumber` (it always can for max ≥ 6). Every draw passes
 * `planWordProblem`'s gates by re-planning — the pool never hands the stage a
 * pair the stage would drop.
 */
export function drawNumbersFor(
  frameId: FrameId,
  theme: StoryTheme,
  maxNumber: number,
  avoid: ReadonlySet<string> = new Set(),
  adjectivePair = 0,
): { first: number; second: number } | null {
  const arithmetic = FRAME_ARITHMETIC[frameId];
  for (let attempt = 0; attempt < 400; attempt++) {
    let first: number;
    let second: number;
    if (arithmetic === 'sum') {
      first = randInt(2, maxNumber - 3);
      second = randInt(2, maxNumber - first);
    } else if (arithmetic === 'first_minus_second') {
      first = randInt(5, maxNumber);
      second = randInt(2, first - 2);
    } else {
      second = randInt(5, maxNumber);
      first = randInt(2, second - 2);
    }
    if (avoid.has(`${first}-${second}`)) continue;
    if (planWordProblem({ id: 'draw', frameId, theme, first, second, adjectivePair }, maxNumber)) {
      return { first, second };
    }
  }
  return null;
}

/** Shuffle a copy (Fisher–Yates on the pool's PRNG). */
export const shuffleWithPool = <T,>(list: readonly T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
