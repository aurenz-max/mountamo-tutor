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

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';

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

/**
 * The object word in the SINGULAR, for the one line that counts one at a time
 * ("Touch each bear one time as you count").
 *
 * The board's vocabulary is plural everywhere else, and this line read "Touch
 * each butterflies one time" to a five-year-old until the first `--di` plan
 * printed it (19h-i-b, port 1). The generator's object list is closed and
 * short, so the map is exact rather than a stemmer; anything outside it falls
 * back to the plural, which is the wording that shipped.
 */
const SINGULAR: Record<string, string> = {
  bears: 'bear',
  apples: 'apple',
  stars: 'star',
  blocks: 'block',
  fish: 'fish',
  butterflies: 'butterfly',
  objects: 'object',
};

export const objectSingularFor = (objectWord: string): string =>
  SINGULAR[objectWord] ?? objectWord;

/** "five bears" / "one bear" — the noun as the VERDICT lines say it. A board
 *  of one is reachable on every counted mode, and "Yes, one bears." is the
 *  same defect as the how-to-play's, one turn later. */
export const countedNoun = (n: number, objectWord: string): string =>
  `${numberWordFor(n)} ${n === 1 ? objectSingularFor(objectWord) : objectWord}`;

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
    case 'count_all':
    case 'group_count':
      return `Touch each ${objectSingularFor(item.objectWord)} one time as you count. Then say how many! `;
    case 'count_on':
      return 'Some are already counted for you. Keep counting from there, then say how many altogether. ';
    case 'compare':
      return 'Look at both groups and find the one with more. ';
    default:
      return `Touch each ${objectSingularFor(item.objectWord)} one time as you count. Then say how many! `;
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
      return `My turn: start at ${numberWordFor(item.startFrom ?? 0)} and count on — ${cap(countedNoun(item.target, item.objectWord))} altogether. Your turn. How many ${item.objectWord} altogether?`;
    case 'compare':
      return `My turn: the bigger group has ${word}. Your turn. How many in the group with more?`;
    default:
      return item.target <= 10
        ? `My turn: watch me count. ${countWalk(item.target)}. ${cap(countedNoun(item.target, item.objectWord))}. Your turn. How many ${item.objectWord}?`
        : `My turn: there are ${countedNoun(item.target, item.objectWord)} — count each one just once and say the last number. Your turn. How many ${item.objectWord}?`;
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
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

const judgingContract = (item: CountingItem): string => {
  const word = numberWordFor(item.target);
  const wrongAnswers = item.kind === 'count_on'
    ? `The starting number "${numberWordFor(item.startFrom ?? 0)}" said back is NOT the answer. `
    : item.kind === 'compare'
      ? `The smaller group's count is NOT the answer, however confident it sounds. `
      : '';
  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner counts, and their think time is unbounded. Never count aloud with them and never say the answer during their turn. `
    + `The correct answer is "${word}". Counting aloud that ENDS on "${word}" counts as that answer — the last number said tells the total. `
    + `A final number other than "${word}" is wrong. ${wrongAnswers}`
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "Yes, ${countedNoun(item.target, item.objectWord)}." `
    + `If it is wrong, say exactly: "${correctionFor(item)}" — the same line on every wrong answer for this item, never swapped for a different wording.`
  );
};

/** The pre-numeric contract is a SILENCE contract (spell_word's pattern):
 *  nothing to judge until the tap is described, and every number word is
 *  banned from the tutor's mouth for the whole item. */
const perceptualContract = (item: CountingItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a hand, not by speaking, so you then stay completely silent. `
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

// ── Items — ONE builder for the component and the DI harness ────────────────

/** The generator fields an item is built from. Structural subset of
 *  `CountingBoardChallenge` so the script module owes the component no import. */
export interface CountingChallengeLike {
  id: string;
  type: CountingItemKind;
  targetAnswer: number;
  count: number;
  startFrom?: number | null;
  groupSize?: number | null;
}

/** Task identity for the how-to-play re-speak policy. Counting, quick-look,
 *  counting-on, comparing and hand-matching are five different things to DO,
 *  so a session that interleaves them re-speaks the protocol on each change. */
export const ACTION_FOR_KIND: Record<CountingItemKind, string> = {
  count_all: 'count',
  group_count: 'count',
  compare: 'compare',
  count_on: 'count-on',
  subitize: 'look',
  subitize_perceptual: 'hands',
};

/** The plural object word as SPOKEN. `custom` has no sayable name, so it
 *  becomes "objects" — the one place the board's emoji vocabulary meets the
 *  tutor's mouth, and both sides of the wire must agree on it. */
export const objectWordFor = (objectType: string): string =>
  objectType === 'custom' ? 'objects' : objectType;

/**
 * One challenge → one judged item, or null when the item cannot be ASKED.
 *
 * The family's build gates exist because an unaskable item is worse than a
 * missing one: it is spoken to a five-year-old anyway. Two ways a counting
 * challenge arrives unaskable, both reachable from the live generator:
 *
 *  - `target < 1` — the ask would end on "zero", and "zero"/"none" as a SPOKEN
 *    answer is unbenched (di-shapes rung 2 residual; this module's own
 *    `numberWordFor` docblock says so). The generator floors counts, but the
 *    floor runs on `count`, and `compare` sets `targetAnswer` separately.
 *  - `count_on` without a usable `startFrom` — the ask reads the value aloud
 *    ("This group already has {startFrom}"), so a missing one says "already has
 *    zero" and one at or above the total asks the child to count on from the
 *    answer. Nothing validates `startFrom` on the generator side (it is prompt-
 *    instructed only), and the component's `?? 0` fallback made the broken
 *    value speakable rather than droppable.
 *
 * A dropped item is never backfilled — a high drop rate is a generator finding,
 * which is exactly what `droppedChallenges` reports on a `--di` drive.
 */
export const itemFromChallenge = (
  ch: CountingChallengeLike,
  opts: { objectWord: string },
): CountingItem | null => {
  const target = ch.targetAnswer;
  if (!Number.isFinite(target) || target < 1) return null;

  const startFrom = ch.startFrom ?? undefined;
  if (ch.type === 'count_on' && (startFrom === undefined || startFrom < 1 || startFrom >= target)) {
    return null;
  }

  return {
    id: ch.id,
    kind: ch.type,
    answerKind: ch.type === 'subitize_perceptual' ? 'gesture' : 'voice',
    responseClass: responseClassFor({ kind: ch.type, target }),
    action: ACTION_FOR_KIND[ch.type],
    objectWord: opts.objectWord,
    count: ch.count,
    target,
    startFrom,
    groupSize: ch.groupSize ?? undefined,
  };
};

export const itemsFromChallenges = (
  challenges: CountingChallengeLike[],
  opts: { objectWord: string },
): CountingItem[] =>
  challenges
    .map((ch) => itemFromChallenge(ch, opts))
    .filter((item): item is CountingItem => item !== null);

// ── The context channel — STIMULUS-SIDE ONLY ────────────────────────────────

/**
 * What is on the board right now, ANSWER-FREE BY CONSTRUCTION (di-math-facts
 * rule; ten-frame's `stimulusFor` is the precedent).
 *
 * This replaced a `targetCount` key that pushed `item.target` — the graded
 * spoken answer — into the state block on every item. It was redundant (the
 * per-turn judging contract inside the cue already names the answer, scoped to
 * the turn that needs it) and it was the exact text 19h-i-a caught the model
 * NARRATING to a child, target answer first. On `subitize_perceptual` it also
 * contradicted the item's own contract, which forbids the tutor any number word
 * at all, in the same assembled prompt.
 *
 * So nothing here names a quantity the child is about to say. `count_on`'s
 * `startFrom` and `group_count`'s `groupSize` are the two numbers that survive,
 * and both are legitimately public: the ask speaks the first aloud, and the
 * second describes the board's structure, never its total.
 */
export const stimulusFor = (item: CountingItem): string => {
  switch (item.kind) {
    case 'subitize':
      return `a quick flash of ${item.objectWord} on the board`;
    case 'subitize_perceptual':
      return `a small group of ${item.objectWord}, and finger-count hands to match`;
    case 'count_on':
      return `${numberWordFor(item.startFrom ?? 0)} ${item.objectWord} already counted, and more to count on from`;
    case 'group_count':
      return item.groupSize
        ? `equal groups of ${numberWordFor(item.groupSize)} ${item.objectWord}`
        : `equal groups of ${item.objectWord}`;
    case 'compare':
      return `two groups of ${item.objectWord} side by side, one bigger than the other`;
    default:
      return `a group of ${item.objectWord} to touch and count`;
  }
};

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything counting-board ever sends the tutor. `CountingBoard.tsx` spreads
 * this and adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live board); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * The split exists so the harness cannot drift from production — a Python
 * journey mirroring these cues by hand would be a second source of truth for
 * the wording the pedagogy lives in.
 */
export const countingBoardPackBase = (
  items: CountingItem[],
): JudgedCueSurface<CountingItem> => ({
  primitiveType: 'counting-board',
  activityLine: 'live direct instruction counting practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    objectType: item.objectWord,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

/** Numbers the ask STATES aloud, so hearing one back is not a leak. Only
 *  `count_on` speaks one ("This group already has five"), and its answer is
 *  strictly greater by construction — so the exemption can never empty the
 *  leak scan on this pack. */
const publicValuesFor = (item: CountingItem): number[] =>
  item.kind === 'count_on' ? [item.startFrom ?? 0] : [];

export interface CountingHarnessAnswers {
  /** What a correct child says (or taps). */
  correct: string;
  /** Unambiguously wrong — the baseline refusal test. */
  plainWrong: string;
  /**
   * The FLUENT miss this item's judging contract explicitly refuses. Testing it
   * tests the discrimination clause rather than mere arithmetic: a judge that
   * only catches "four for five" can still affirm a confident counted walk that
   * ends one past the answer.
   */
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit a FINGER COUNT, not a word — code computes the match. */
  placed?: { correct: number; wrong: number };
  /** Answer tokens that must NOT appear in the spoken ask. */
  leakTokens: string[];
}

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `judgingContract` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 *
 * THE WALK IS THE INTERESTING ONE HERE. This pack's contract says a count said
 * aloud that ENDS on the target counts as that answer (cardinality: the last
 * number said tells the total), so the signature wrong for every counted mode
 * is a walk that ends one PAST it — fluent, confident, and containing the right
 * number word without landing on it. A judge that string-matches the target
 * inside the utterance affirms it; the clause says it must not.
 */
export const countingBoardHarnessAnswers = (item: CountingItem): CountingHarnessAnswers => {
  const answerWord = numberWordFor(item.target);
  const wrongValue = item.target > 1 ? item.target - 1 : item.target + 1;
  const leakTokens = publicValuesFor(item).includes(item.target) ? [] : [answerWord];

  const base: CountingHarnessAnswers = {
    correct: answerWord,
    plainWrong: numberWordFor(wrongValue),
    leakTokens,
  };

  switch (item.kind) {
    case 'subitize_perceptual': {
      // Three hands are offered ({1,2,3}, shuffled); the count is clamped to
      // that range, so a wrong hand always exists inside the offered set.
      const wrongHand = item.target === 1 ? 2 : item.target - 1;
      return {
        ...base,
        correct: `tapped the hand showing ${item.target} fingers`,
        plainWrong: `tapped the hand showing ${wrongHand} fingers`,
        placed: { correct: item.target, wrong: wrongHand },
        // The leak oracle stays scoped to the ANSWER word, matching the family.
        // This item's contract is broader — no number word or digit at any
        // point — but that is a different finding than "the ask gave the answer
        // away", and folding it in here would mislabel it as an answer leak.
        // The broader clause rides `di-off-script-ask` and the transcript.
        leakTokens,
      };
    }
    case 'count_on':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.startFrom ?? 0),
          why: 'the starting number said back — the contract names it as NOT the answer',
        },
      };
    case 'compare': {
      const smaller = Math.max(1, item.count - item.target);
      return {
        ...base,
        plainWrong: numberWordFor(item.count),
        signatureWrong: {
          text: numberWordFor(smaller),
          why: "the SMALLER group's count — fluent, confident, and the contract's named miss",
        },
      };
    }
    default:
      return {
        ...base,
        signatureWrong: {
          text: countWalk(item.target + 1),
          why: 'a counted walk that ends one PAST the target — it contains the answer word but does not land on it',
        },
      };
  }
};
