/**
 * countingBoardDomain — what counting-board TEACHES, with no teaching engine
 * attached: the item kinds, the number words, the asks, the build rules that
 * turn generator challenges into items, and the harness answer material.
 *
 * Sunset slice S1 (qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md).
 * This content used to sit in `countingBoardScript` beside the scripted cue
 * protocol, so the live tutor/JEV binding could not read a counting fact
 * without importing the judged runner's pack surface. The split is by
 * ownership, not by file size:
 *
 *   - HERE: the task. What is asked, of which set, with which answer, and
 *     which benched response class it belongs to. Both teaching architectures
 *     read this, and the generator imports its build gates from it.
 *   - `countingBoardScript`: the retiring control protocol — exact correction
 *     and affirmation wording, the two-branch judging contract, the pack base.
 *
 * `askFor` and `howToPlayFor` live here rather than with the cues because they
 * state the ASSIGNMENT — what the child is being asked to do. The scripted
 * runner quotes them inside a "Say exactly" cue; the teaching workspace hands
 * the same sentence to the tutor as the assignment and lets it teach. Same
 * meaning, different transport, which is the whole point of the sunset.
 */

import type { ResponseClassId, TeachingItem } from '../../../hooks/teachingItemContract';


export type CountingItemKind =
  | 'count_all'
  | 'subitize'
  | 'subitize_perceptual'
  | 'count_on'
  | 'group_count'
  | 'compare'
  // ── The K counting-out family (K.CC.B.4b/4c, K.CC.B.5) ──────────────────
  // Four things a five-year-old does with a set that counting it does not
  // cover: make one of a named size, hold the number while the set moves,
  // and say the new number after taking some away or putting more on.
  | 'give_me_n'
  | 'recount_moved'
  | 'take_away'
  | 'add_more';

export interface CountingItem extends TeachingItem {
  kind: CountingItemKind;
  /** Plural object word as shown on the board ("bears"). */
  objectWord: string;
  /** The singular of `objectWord` when the board's noun is themed and so
   *  cannot be in the SINGULAR map ("dump trucks" → "dump truck"). Supplied by
   *  the generator alongside the custom emoji; absent for enum objects, whose
   *  singulars the map already owns. */
  objectSingular?: string;
  /** Objects on the board. */
  count: number;
  /** The spoken answer (== count except compare: the larger group). */
  target: number;
  startFrom?: number;
  groupSize?: number;
  /** compare: the two group sizes in board order (first = left). */
  compareGroups?: number[];
  /** take_away / add_more: how many the child removes or puts on. SPOKEN by the
   *  ask, so it is public — and never equal to the answer (the generator
   *  refuses that draw, because "take away three, three left" recites it). */
  changeBy?: number;
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
  // give_me_n is answered by HANDING OVER a set, not by saying a number — the
  // child already heard the number in the ask. Same gesture class as the
  // pre-numeric hand match (the spell_word ruling: porting it to speech would
  // delete the mode's identity, which is producing a quantity).
  if (item.kind === 'subitize_perceptual' || item.kind === 'give_me_n') return 'manipulation';
  return item.target <= 20 ? 'number_word_to_20' : 'number_word_to_120';
};

/** The counted walk the correction models at ten or below ("One, two, three"). */
export const countWalk = (n: number): string => {
  const words = Array.from({ length: n }, (_, i) => numberWordFor(i + 1)).join(', ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Shared with the cue module, which capitalizes a modeled count walk. */
export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * The object word in the SINGULAR, for the one line that counts one at a time
 * ("Touch each bear one time as you count").
 *
 * The board's vocabulary is plural everywhere else, and this line read "Touch
 * each butterflies one time" to a five-year-old until the first `--di` plan
 * printed it (19h-i-b, port 1). The map covers the generators' enum nouns;
 * anything outside it falls back to the plural, which is the wording that
 * shipped.
 */
/**
 * ⚠️ AN EXACT MAP, NOT A STEMMER, AND THAT IS THE POINT. English cannot
 * singularise these by rule: `bunnies` → bunny and `cookies` → cookie are the
 * same three letters with different answers, and `fish` must not move at all.
 * Both consumers' ENUM nouns are closed and short
 * (`gemini-counting-board`'s object list and `gemini-addition-subtraction-scene`'s
 * `VALID_OBJECT_TYPES`), so an exhaustive map is achievable there and a rule is
 * not. The di-script suites assert this covers both enums, so adding an object
 * type to either generator fails a gate rather than reaching a child as "one
 * bunnies".
 *
 * A THEMED board's noun is open ("dump trucks", "excavators"), so it cannot be
 * in this map by construction. That is why the counting-board generator emits
 * `objects.wordSingular` next to the custom word and validates both: the
 * singular arrives WITH the plural rather than being derived from it. The
 * `singular` override below is that value; a themed board missing one is
 * rejected back to the enum in the generator, never stemmed here.
 */
const SINGULAR: Record<string, string> = {
  // counting-board's board objects
  bears: 'bear',
  blocks: 'block',
  objects: 'object',
  // shared by both generators
  apples: 'apple',
  stars: 'star',
  fish: 'fish',
  butterflies: 'butterfly',
  // addition-subtraction-scene's story objects
  ducks: 'duck',
  frogs: 'frog',
  birds: 'bird',
  dogs: 'dog',
  cats: 'cat',
  flowers: 'flower',
  cookies: 'cookie',
  cupcakes: 'cupcake',
  rockets: 'rocket',
  bunnies: 'bunny',
};

export const objectSingularFor = (objectWord: string, singular?: string): string =>
  (singular && singular.trim()) || SINGULAR[objectWord] || objectWord;

/** "five bears" / "one bear" — the noun as the VERDICT lines say it. A board
 *  of one is reachable on every counted mode, and "Yes, one bears." is the
 *  same defect as the how-to-play's, one turn later. */
export const countedNoun = (n: number, objectWord: string, singular?: string): string =>
  `${numberWordFor(n)} ${n === 1 ? objectSingularFor(objectWord, singular) : objectWord}`;

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
      return `Touch each ${objectSingularFor(item.objectWord, item.objectSingular)} one time as you count. Then say how many! `;
    case 'count_on':
      return 'Some are already counted for you. Keep counting from there, then say how many altogether. ';
    case 'compare':
      return 'Look at both groups and find the one with more. ';
    case 'give_me_n':
      return `Touch the ${item.objectWord} you want to give me. Touch one again to put it back. `;
    case 'recount_moved':
      return `Touch each ${objectSingularFor(item.objectWord, item.objectSingular)} as you count. Then they will move — but do not count again. `;
    case 'take_away':
      return `Touch the ${item.objectWord} to take away. Then say how many are left. `;
    case 'add_more':
      return `Touch the faded ${item.objectWord} to put them on the board. Then say how many altogether. `;
    default:
      return `Touch each ${objectSingularFor(item.objectWord, item.objectSingular)} one time as you count. Then say how many! `;
  }
};

// ── The asks — three beats, short, one defensible answer ────────────────────

/** Exported for the live runtime adapter's `task`: the mounted tutor state
 *  reports the question the child was ASKED, never the bracketed cue the model
 *  was sent. */
export const askFor = (item: CountingItem): string => {
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
    case 'give_me_n':
      // The number is the ASK here, not the answer — the child hands back a set.
      return `Here are lots of ${item.objectWord}. Your turn. Give me ${countedNoun(item.target, item.objectWord, item.objectSingular)}.`;
    case 'recount_moved':
      // Spoken BEFORE the move, and deliberately short: every item in a
      // conservation session asks the same thing, and the repeated-ask gate
      // caps what a child listens through to reach an identical question.
      return `Count the ${item.objectWord}. They will move. Your turn. How many then?`;
    case 'take_away':
      return `Take away ${countedNoun(item.changeBy ?? 1, item.objectWord, item.objectSingular)}. Your turn. How many ${item.objectWord} are left?`;
    case 'add_more':
      return `Put ${countedNoun(item.changeBy ?? 1, item.objectWord, item.objectSingular)} more on the board. Your turn. How many ${item.objectWord} altogether?`;
    default:
      return `Count the ${item.objectWord}. Your turn. How many ${item.objectWord}?`;
  }
};


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
  compareGroups?: number[] | null;
  changeBy?: number | null;
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
  give_me_n: 'give',
  recount_moved: 'watch-and-hold',
  take_away: 'take-away',
  add_more: 'add-more',
};

/** The catalog eval mode a board type is tracked under. Two types carry a different name from their
 *  mode; every other type is its own mode (CNB-3). */
export const evalModeForKind = (kind: CountingItemKind): string =>
  kind === 'count_all' ? 'count' : kind === 'group_count' ? 'group' : kind;

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
  opts: { objectWord: string; objectSingular?: string },
): CountingItem | null => {
  const target = ch.targetAnswer;
  if (!Number.isFinite(target) || target < 1) return null;

  const startFrom = ch.startFrom ?? undefined;
  if (ch.type === 'count_on' && (startFrom === undefined || startFrom < 1 || startFrom >= target)) {
    return null;
  }

  // The K counting-out family adds three more ways an item arrives unaskable,
  // all of them reachable from a live draw:
  const changeBy = ch.changeBy ?? undefined;
  //  - give_me_n with a pile no bigger than the request: "give me five" out of
  //    five is handing over the whole board, which is not producing a set.
  if (ch.type === 'give_me_n' && (!Number.isFinite(ch.count) || ch.count <= target)) return null;
  //  - take_away / add_more with no change to make, or one that is spoken as
  //    the answer ("take away three" leaving three RECITES it).
  if (ch.type === 'take_away' || ch.type === 'add_more') {
    if (changeBy === undefined || changeBy < 1) return null;
    if (changeBy === target) return null;
    if (ch.type === 'take_away' && ch.count - changeBy !== target) return null;
    if (ch.type === 'add_more' && ch.count + changeBy !== target) return null;
  }
  //  - compare whose drawn groups disagree with the key: the board renders
  //    `compareGroups`, so two groups that do not add up to the board, tie, or
  //    whose bigger one is not the answer would judge a right child wrong.
  const compareGroups = ch.type === 'compare' ? ch.compareGroups ?? undefined : undefined;
  if (compareGroups && (compareGroups.length !== 2 || compareGroups.some((n) => !Number.isInteger(n) || n < 1)
    || compareGroups[0] + compareGroups[1] !== ch.count || compareGroups[0] === compareGroups[1]
    || Math.max(...compareGroups) !== target)) return null;

  return {
    id: ch.id,
    kind: ch.type,
    answerKind: ch.type === 'subitize_perceptual' || ch.type === 'give_me_n' ? 'gesture' : 'voice',
    responseClass: responseClassFor({ kind: ch.type, target }),
    action: ACTION_FOR_KIND[ch.type],
    objectWord: opts.objectWord,
    objectSingular: opts.objectSingular,
    count: ch.count,
    target,
    startFrom,
    groupSize: ch.groupSize ?? undefined,
    compareGroups,
    changeBy,
  };
};

export const itemsFromChallenges = (
  challenges: CountingChallengeLike[],
  opts: { objectWord: string; objectSingular?: string },
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
    case 'give_me_n':
      return `a big pile of ${item.objectWord} to take some from`;
    case 'recount_moved':
      return `a group of ${item.objectWord} that will move once it has been counted`;
    case 'take_away':
      return `a group of ${item.objectWord}, ${numberWordFor(item.changeBy ?? 0)} of them to take away`;
    case 'add_more':
      return `a group of ${item.objectWord}, with ${numberWordFor(item.changeBy ?? 0)} more to put on`;
    default:
      return `a group of ${item.objectWord} to touch and count`;
  }
};


// Standalone scripted drill only. The live host uses useTeachingWorkspace.
/**
 * Everything counting-board ever sends the tutor. `CountingBoard.tsx` spreads
 * this and adds what only a mounted component can own (status lines, and the
 * `observation` that reads the live board); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * The split exists so the harness cannot drift from production — a Python
 * journey mirroring these cues by hand would be a second source of truth for
 * the wording the pedagogy lives in.
 */

// ── Harness answer material — what a right and a wrong child sound like ─────

/** Numbers the ask STATES aloud, so hearing one back is not a leak. Only
 *  `count_on` speaks one ("This group already has five"), and its answer is
 *  strictly greater by construction — so the exemption can never empty the
 *  leak scan on this pack. */
const publicValuesFor = (item: CountingItem): number[] => {
  switch (item.kind) {
    case 'count_on':
      return [item.startFrom ?? 0];
    // The ask IS the number here ("Give me five bears"), so hearing it back is
    // the task, not a leak.
    case 'give_me_n':
      return [item.target];
    // "Take away two" / "put two more on" — the change is spoken, the total is
    // not, and the build gate refuses a draw where they are the same number.
    case 'take_away':
    case 'add_more':
      return [item.changeBy ?? 0];
    default:
      return [];
  }
};

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
    case 'give_me_n': {
      // One too many is the miss: the child keeps counting past the ask.
      const wrongGive = item.target + 1 <= item.count ? item.target + 1 : Math.max(1, item.target - 1);
      return {
        ...base,
        correct: `handed over ${item.target} ${item.objectWord}`,
        plainWrong: `handed over ${wrongGive} ${item.objectWord}`,
        placed: { correct: item.target, wrong: wrongGive },
        // The asked-for number is spoken by the ask, so there is nothing to leak.
        leakTokens: [],
      };
    }
    case 'recount_moved':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.target + 1),
          why: 'a bigger number after the set spread out — the conservation miss this item exists to catch',
        },
      };
    case 'take_away':
    case 'add_more':
      return {
        ...base,
        signatureWrong: {
          text: numberWordFor(item.count),
          why: 'the count from BEFORE the change — fluent, confident, and the contract names it',
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
