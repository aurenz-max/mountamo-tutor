/**
 * sortingStationScript — HAND-AUTHORED judged-loop script for sorting-station
 * (SEVENTH math DI port; qa/di/BACKLOG.md item 18). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which objects, which groups, which rule) stays generator-scoped; this module
 * owns the cue shapes, the build gates, the tier ladder and the leak policy.
 *
 * ── WHY THIS PORT EXISTS, IN THE PRIMITIVE'S OWN WORDS ─────────────────────
 *
 * User feedback that opened the slice (2026-08-17): *"there's a lot of mental
 * complexity for young learners, maybe use as an opportunity to simplify and
 * make sequential with voice DI control."*
 *
 * The contract at `docs/contracts/sorting-station.md` had already written that
 * down from the other side. FIVE of seven eval modes are floored to Grade 1+,
 * and every floor reason is a MEDIUM, not a cognition:
 *
 *   G2 — "`two_attributes` exists but is floored to Grade 1+ BECAUSE THE
 *         COMPOUND INSTRUCTION IS WRITTEN. The K curriculum demands the task;
 *         what exceeds a pre-reader is the medium, not the cognition."
 *   G3(a) — a K VOICED-RULE variant of `sort_variety`.
 *   G1 — "At K this must be SPOKEN (a pre-reader can't type a reason)."
 *
 * And the click-era catalog's DEEPEST scaffold, level 3, is this port's default
 * interaction verbatim: *"Let's sort one at a time. Pick up this object — say
 * what it is. Now which bin does it go with?"* What was tier-3 rescue for a
 * drowning child is now how the activity works for everyone.
 *
 * ⚠️ THE BAND FLOOR (R3) IS NOT TOUCHED BY THIS SLICE, DELIBERATELY. The
 * contract is explicit that unflooring needs a reader-fit re-audit — "NOT a
 * simple unflooring" — and shipping the medium is what makes that audit
 * possible, not what replaces it. K keeps `sort_one` + `odd_one_out`; both
 * become sequential and spoken, which is the whole of the user's ask. The other
 * five stay Grade 1+ until the audit passes.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * ALL SEVEN MODES ARE SPOKEN, and every tap is deleted. Picture a teacher at a
 * table with one child, some picture cards and two labelled trays:
 *
 *   "Your turn. Listen: apple. Is it a Need, or a Want?"   → "Need!"
 *   "Yes, apple goes with Need."
 *
 * That is DISTAR classification, and it is sorting-station's whole skill. The
 * arithmetic never reaches the class table's awkward end — every answer this
 * primitive wants is a group name, an object name, a count, a comparison word
 * or a yes/no, and a five-year-old says all five across a table:
 *
 *   sort           the answer is one of the group LABELS      short_spoken_word
 *   pick_rule      the answer is one of the sorting AXES      short_spoken_word
 *   odd_one        the answer is one OBJECT on the screen     short_spoken_word
 *   count_group    the answer is HOW MANY are in a group      number_word_to_20
 *   compare        the answer is WHICH GROUP has more          short_spoken_word
 *   both_criteria  the answer is YES or NO                    yes_no
 *
 * THE COSTUME TEST IS WHAT DECIDES THE TAP, and the click era fails it outright:
 * a child who cannot categorise at all can still drag an object into a bin at a
 * 1-in-2 floor, be told instantly by a Check button that it was wrong, and
 * re-drag until it lands. The drag produced no evidence of the skill; the
 * category NAME does. Same for the number steppers — a 0…9 row is a weak MENU
 * (number-bond's ruling, consumed not re-derived), and the odd-one-out tap is a
 * 1-in-6 guess with instant feedback.
 *
 * WHAT IS NOT A COSTUME, and stays: the TRAYS AND THE CARDS. A sort whose
 * groups are not knowable is not a harder task, it is a broken one. The bins,
 * their `bucketEmoji` picture cues and the object cards are the material a
 * teacher lays on the table — the screen is the PAGE. It is the ACTION that was
 * the costume, never the paper (the ten-frame R6 lesson, and word-sorter's mats
 * before it).
 *
 * ── THREE THINGS THE CLICK ERA HID, WHICH THE MODALITY EXPOSES ─────────────
 *
 *  1. ⭐ `showCounts` PRINTED THE ANSWER TO EVERY COUNT ASK. The click era drew
 *     a live tally badge on each bin — harmless while a stepper graded it, and a
 *     direct answer leak the moment "how many are in the Need group?" became a
 *     spoken question. This is ten-frame's R6 defect exactly: hunt the leak in
 *     PIXELS, not only in strings. `hidesCounts` is now an ITEM property, the
 *     badge is gated on it, and `count_group`/`compare` items set it true.
 *  2. ONE CHALLENGE WAS NEVER ONE ITEM. A sort challenge is a screenful — six
 *     objects, three bins, one Check. Under the judged loop it is six judged
 *     turns, and `two_attributes` is a yes/no per object rather than one
 *     compound instruction held in working memory. That IS the "sequential"
 *     the feedback asked for, and it is the port's biggest measurement change.
 *  3. THE COMPOUND INSTRUCTION WAS THE FLOOR. "Which NEEDS are food?" read at
 *     once is two criteria plus a reading demand; asked object by object out
 *     loud it is one yes/no a K child answers. The cognition never moved.
 *
 * ── TWO WAYS A CAPPED SESSION GOES QUIETLY WRONG, BOTH GATED ───────────────
 *
 * A blind slice of a sort STRANDS A TRAY: take the first five of a shuffled
 * eight and a three-bin sort can lose its third bin entirely, so the tutor
 * offers three groups while only two are ever right — and on a binary sort it
 * makes ONE LABEL RIGHT FOREVER. `capCoveringEveryGroup` displaces instead of
 * truncating (word-sorter's gate, consumed).
 *
 * `two_attributes` has the same disease in a yes/no coat, and it is worse
 * because it is invisible: six objects of which one matches means a child who
 * says "no" every single time scores 83%. `capCoveringBothVerdicts` guarantees
 * the kept set holds at least one YES and at least one NO.
 *
 * ── THE MODEL IS A STRATEGY, NEVER AN EXEMPLAR ─────────────────────────────
 *
 * Modelling a worked exchange ("My turn: apple — Need.") would say a group name
 * that is very often THIS item's answer, since the exemplar and the item come
 * from the same challenge and share one label set. The family's model lines are
 * strategy models for exactly this reason, so this pack's are too: the rule is
 * modelled, the answer is earned in the correction.
 *
 * ── CORRECTIONS NAME THE ANSWER, AND THAT IS DELIBERATE ────────────────────
 *
 * A category assignment is a FACT a child either holds or does not — there is no
 * route to re-model that stops short of it (word-sorter's argument, and the same
 * shape here). So the correction is the full DISTAR model-lead-test: name the
 * fact, then re-elicit the same item. The measurement stays honest because the
 * runner scores a corrected item at 67 (or 33), never at 100.
 *
 * ── SENTINELS ──────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by
 * `validateJudgedScriptPack` in this pack's test file. Every generated string
 * that can reach a spoken line — object labels, group labels, axis names — runs
 * through `opensWithSentinel` and is DROPPED on a hit, on both sides of the wire
 * (the generator imports these gates rather than copying them; the letter-spotter
 * 90-vs-100 drift is why).
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardScript';

// Re-exported so the generator imports its build gates from ONE address — both
// sides of the wire must agree on what is sayable.
export { opensWithSentinel, numberWordFor };

export type SortingStationMode =
  | 'sort-by-one'
  | 'sort-by-attribute'
  | 'sort-variety'
  | 'odd-one-out'
  | 'count-and-compare'
  | 'two-attributes'
  | 'tally-record';

export type SortingStationTier = 'easy' | 'medium' | 'hard';

/**
 * What the child is being asked to produce on THIS turn. A mode may ship more
 * than one — `sort-by-attribute` picks a rule and then sorts by it, and
 * `count-and-compare` counts each group and then compares them — so the item
 * kind, not the mode, is what the cue and the judging contract branch on.
 */
export type SortingItemKind =
  | 'sort'
  | 'pick_rule'
  | 'odd_one'
  | 'count_group'
  | 'compare'
  | 'both_criteria';

// ── The item ────────────────────────────────────────────────────────────────

export interface SortingStationItem extends JudgedScriptItem {
  mode: SortingStationMode;
  kind: SortingItemKind;
  tier: SortingStationTier;
  /** The challenge this item came from — the stage keeps one tray set per
   *  challenge, and the affirm reveal must not light up the wrong one. */
  challengeId: string;
  /** What the tutor SAYS and the card shows. sort/both_criteria: the object
   *  being classified. count_group: the group being counted. odd_one: the
   *  whole group of cards, so this is a description, never a name. NEVER the
   *  answer. */
  stimulus: string;
  stimulusEmoji?: string;
  /** The canonical spoken answer: a group label, an axis name, an object label,
   *  a number word, a comparison word, or yes/no. */
  answer: string;
  /** Numeric answers only (count_group) — the stage reveals the digit, and the
   *  build gate checks the benched 1..20 range against it. */
  answerValue?: number;
  /** Everything the child could legitimately say, in screen order where there
   *  is a screen order. Empty when the answer set is not a printed menu. */
  choices: string[];
  /** Index-aligned with `choices`; '' where the generator supplied no picture. */
  choiceEmojis: string[];
  /**
   * Does the ASK name the options out loud? False only at `hard` for a reader —
   * the tier withholds the criterion and the labels are on screen. At
   * Kindergarten the band floor forces it true at every tier: a pre-reader
   * cannot read a tray, so an unnamed group is an unanswerable question.
   */
  namesChoices: boolean;
  /**
   * ⭐ The pixel leak gate. True on every item whose answer is a COUNT or a
   * comparison of counts — the click era's per-bin tally badge is that answer,
   * drawn on the screen before the child says it. See header note 1.
   */
  hidesCounts: boolean;
  /** Support-tier render lever (#1 perception) — the tray picture cues. */
  showChoiceEmojis: boolean;
  /** two_attributes only: the two criteria, spoken as the question. */
  criteria?: { primary: string; secondary: string };
  /** The sorting axis in force, for the stage caption and the context channel.
   *  Never an answer except on `pick_rule`, where it IS the answer. */
  ruleName?: string;
}

/** Every mode is SAID. Nothing in this pack answers with its hands: a group
 *  name, an object name, a count, a comparison and a yes/no all have spoken
 *  forms, so step 1's fork ends at its first question. */
export const answerKindFor = (_mode: SortingStationMode): 'voice' => 'voice';

/** Standing gate 1, per ITEM KIND — the mode alone does not determine the
 *  class, because `count-and-compare` produces two different answer materials
 *  and `sort-by-attribute` produces two. */
export const responseClassFor = (kind: SortingItemKind): ResponseClassId => {
  switch (kind) {
    case 'count_group':
      return 'number_word_to_20';
    case 'both_criteria':
      return 'yes_no';
    case 'sort':
    case 'pick_rule':
    case 'odd_one':
    case 'compare':
    default:
      return 'short_spoken_word';
  }
};

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** One breath, and a name a child can hold in working memory while they answer.
 *  A three-word tray label read aloud twice a round is recitation. */
export const MAX_LABEL_WORDS = 3;
export const MAX_LABEL_CHARS = 24;
/**
 * An object name here is a short noun PHRASE, not a single word — this
 * primitive's cards are "Fresh Apple", "Water Glass", "Red Toy Car". The cap
 * was 2 when copied from word-sorter, where the stimulus really is one word,
 * and the live probe caught it dropping ordinary content ("Red Toy Car"). Three
 * words is still one breath and still holdable while a child answers.
 */
export const MAX_OBJECT_CHARS = 28;
export const MAX_OBJECT_WORDS = 3;

/**
 * The benched spoken-count range. `number_word_to_20` excludes ZERO by its own
 * class note ("zero"/"none" is an owed bench check), which matters more here
 * than anywhere else in the family: an EMPTY group is a perfectly ordinary sort
 * outcome and a perfectly unaskable count. A group of zero is dropped, never
 * asked and never floored to one.
 */
export const MIN_COUNT = 1;
export const MAX_COUNT = 20;

/**
 * A DI classification drill is FAST and reps are the point — but one judged
 * round costs an ask, a think, a verdict and an affirmation, so an eight-object
 * challenge is a ten-minute sitting. These caps hold a session at the family's
 * shape (6-12 asks) without shortening any individual challenge's answer set.
 * Truncation is NOT a build-gate drop and is reported separately.
 */
export const MAX_ITEMS_PER_CHALLENGE = 5;
export const MAX_ITEMS_PER_SESSION = 12;

/**
 * Content words of this pack's own invariant prose. A tray labelled "Things" or
 * "Group" would make the leak oracle fire on the greeting and the how-to-play —
 * our own sentences, which are the half most worth scanning — and it is a poor
 * label besides. Dropping it is cheaper than exempting our prose, which is the
 * letter-spotter ruling (fix the collision, never switch the oracle off over the
 * lines we wrote).
 */
const PACK_PROSE_TOKENS = new Set([
  'thing', 'things', 'group', 'groups', 'sort', 'sorting', 'turn', 'turns',
  'listen', 'game', 'screen', 'card', 'cards', 'tray', 'trays', 'one', 'ones',
]);

const sanitize = (value: string | undefined | null): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/** No double quotes anywhere: every one of these strings is interpolated into a
 *  `Say exactly: "…"` span, and an embedded quote CLOSES the span early so
 *  everything after it becomes judge-side prose — the structural surface the
 *  performed-"[WAIT silently]" defect lived on. */
const SPEECH_SAFE_RE = /^[A-Za-z][A-Za-z' -]*$/;

const speakable = (value: string, maxChars: number, maxWords: number): boolean => {
  const text = sanitize(value);
  if (!text || text.length > maxChars) return false;
  if (!SPEECH_SAFE_RE.test(text)) return false;
  if (text.split(' ').length > maxWords) return false;
  return !opensWithSentinel(text);
};

/** Is this an object name a tutor can say aloud in the middle of an ask? */
export const isSayableObject = (label: string): boolean =>
  speakable(label, MAX_OBJECT_CHARS, MAX_OBJECT_WORDS);

/** Is this a group label a child can hear, hold and say back? */
export const isSayableLabel = (label: string): boolean => {
  if (!speakable(label, MAX_LABEL_CHARS, MAX_LABEL_WORDS)) return false;
  return !sanitize(label)
    .toLowerCase()
    .split(' ')
    .some((token) => PACK_PROSE_TOKENS.has(token));
};

/** Is this a count a child can say, inside the benched class? */
export const isSayableCount = (n: number): boolean =>
  Number.isInteger(n) && n >= MIN_COUNT && n <= MAX_COUNT;

/**
 * Sorting AXIS key → the word a six-year-old actually says.
 *
 * `phonemeVoice`'s job for a different alphabet: the stored form and the sayable
 * form are not the same string. The generator's axis vocabulary is an adult set
 * (`category`, `color`, `shape`, `size`, `type`), and the live probe caught the
 * consequence — `pick_rule` shipped an ask whose correct spoken answer was the
 * word "category". A Grade 1 child asked how to sort a pile of pictures says
 * "kind", never "category", so a contract demanding the key fails children for
 * vocabulary rather than for classifying.
 *
 * Only the SPOKEN side moves: `ruleName` keeps the raw key, which is what the
 * component matches attributes on and what the context channel reports. The
 * ear-separability gate runs AFTER this map, so a collision it introduced would
 * drop the ask rather than ship an unjudgeable one.
 */
const SPOKEN_AXIS: Record<string, string> = {
  category: 'kind',
  type: 'type',
};
export const spokenAxisName = (axis: string): string =>
  SPOKEN_AXIS[axis.toLowerCase()] ?? axis;

const normalizeForEar = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Negation particles bind to the word they negate.
 *
 * "Living" against "Non-living" is one of this primitive's most common axes, and
 * the naive word-token model calls it a COLLISION: "living" carries no token
 * "non-living" lacks, so the pair looks like the unjudgeable subset shape ("A
 * cat" against "A cat and a dog"). Acoustically they are nothing alike — the
 * prefix IS the distinction and a child says it — so the tokens are joined
 * before the comparison. Caught by the live probe, which dropped three of four
 * living/non-living challenges. Handles both "Non-living" and "Non living",
 * since the generator emits either.
 */
const NEGATIONS = new Set(['non', 'not', 'un', 'in', 'no']);
const earTokens = (option: string): string[] => {
  const raw = normalizeForEar(option).split(' ').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (NEGATIONS.has(raw[i]) && raw[i + 1]) {
      out.push(raw[i] + raw[i + 1]);
      i++;
    } else {
      out.push(raw[i]);
    }
  }
  return out;
};

/**
 * Can every option be told from every other BY EAR? decodable-reader's gate,
 * applied to a different closed set for the same reason: if an utterance fits
 * two options there is no honest verdict, and the fix is to drop the ask, never
 * to judge it leniently. "Big" against "Big things" is the shape this catches —
 * a child who says "big" has answered both.
 */
export const optionsEarSeparable = (options: readonly string[]): boolean => {
  const wordsOf = earTokens;
  return options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : wordsOf(o))));
    return wordsOf(option).some((word) => !others.has(word));
  });
};

/**
 * Keep at most `limit` objects, and make sure the kept set still reaches every
 * tray.
 *
 * A cap applied blindly can strand a whole tray: take the first five of a
 * shuffled eight and a three-bin sort can lose its third bin entirely, which
 * turns the ask into a two-way choice while the tutor still offers three. Worse
 * on a binary sort, where losing a group makes "Need, or Want?" answerable with
 * "Need" every single time. So a missing group's first object displaces the last
 * kept object of an over-represented group. That is a SELECTION over content
 * that already passed every gate, not a backfill of content that failed one.
 */
const capCoveringEveryGroup = <T>(
  entries: T[],
  groupOf: (entry: T) => string,
  groups: string[],
  limit: number,
): T[] => {
  if (entries.length <= limit) return entries;
  const kept = entries.slice(0, limit);
  for (const group of groups) {
    if (kept.some((e) => groupOf(e) === group)) continue;
    const candidate = entries.slice(limit).find((e) => groupOf(e) === group);
    if (!candidate) continue;
    const counts = new Map<string, number>();
    for (const e of kept) counts.set(groupOf(e), (counts.get(groupOf(e)) ?? 0) + 1);
    const displaceAt = kept
      .map((e, i) => [e, i] as const)
      .reverse()
      .find(([e]) => (counts.get(groupOf(e)) ?? 0) > 1)?.[1];
    if (displaceAt == null) continue;
    kept[displaceAt] = candidate;
  }
  return kept;
};

/**
 * ⭐ The same disease in a yes/no coat, and it is worse because it is invisible.
 *
 * `two_attributes` shows six to eight objects of which only the matching few are
 * a YES. Cap that blindly and the kept set is very often all-NO — a child who
 * says "no" every single time then scores 100%, and neither the transcript nor
 * the accuracy number looks wrong. A binary answer needs BOTH verdicts present
 * or it measures nothing, so this keeps a balanced slice and drops the challenge
 * outright when one verdict is unreachable.
 */
const capCoveringBothVerdicts = <T>(
  entries: T[],
  isYes: (entry: T) => boolean,
  limit: number,
): T[] => {
  const yes = entries.filter(isYes);
  const no = entries.filter((e) => !isYes(e));
  if (!yes.length || !no.length) return [];
  const keptYes = Math.max(1, Math.min(yes.length, Math.floor(limit / 2)));
  const keptNo = Math.max(1, Math.min(no.length, limit - keptYes));
  // Interleave so the child never hears a run long enough to guess the pattern.
  const picked: T[] = [];
  const a = yes.slice(0, keptYes);
  const b = no.slice(0, keptNo);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) picked.push(a[i]);
    if (i < b.length) picked.push(b[i]);
  }
  return picked.slice(0, limit);
};

// ── The challenge, duck-typed ───────────────────────────────────────────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface SortingChallengeLike {
  id: string;
  type: SortingStationMode;
  instruction?: string;
  sortingAttribute?: string;
  objects?: {
    id: string;
    label: string;
    emoji?: string;
    attributes?: Record<string, string>;
  }[];
  categories?: { label: string; rule?: Record<string, string>; bucketEmoji?: string }[];
  oddOneOut?: string;
  oddOneOutReason?: string;
  comparisonQuestion?: string;
  correctComparison?: 'more' | 'fewer' | 'equal';
  /** two-attributes only. */
  targetCategory?: string;
  secondaryAttribute?: string;
  secondaryValue?: string;
  /**
   * Easy-tier worked example: ONE object pre-placed in its correct tray as a
   * model. It SURVIVES the port — a teacher really does lay one card in a tray
   * and say "this one goes here, see?", which is honest page-work and a real
   * DISTAR fade — but it is EXCLUDED from the judged set below, because its
   * answer is sitting on the screen. Asking about it would be a pixel leak of
   * exactly the kind `showCounts` was.
   */
  modelItemId?: string;
  /** Support-tier stamps, all optional — absent means the full-help render. */
  showBucketEmojis?: boolean;
  namesSortCriterion?: boolean;
}

export interface SortingBuildOptions {
  tier?: SortingStationTier;
  /** Kindergarten. Forces the options to be named aloud at EVERY tier. */
  isPreReader?: boolean;
}

const categoriesOf = (ch: SortingChallengeLike) =>
  (ch.categories ?? []).map((c) => ({
    label: sanitize(c.label),
    emoji: sanitize(c.bucketEmoji),
    rule: c.rule ?? {},
  }));

/** Every object ON THE PAGE, including the pre-placed worked example. This is
 *  what a COUNT must be taken over: the model item is visible in its tray, so a
 *  count that skipped it would contradict the screen. */
const objectsOf = (ch: SortingChallengeLike) =>
  (ch.objects ?? []).map((o) => ({
    id: o.id,
    label: sanitize(o.label),
    emoji: sanitize(o.emoji),
    attributes: o.attributes ?? {},
  }));

/**
 * The objects a judged item may be built FROM — the page minus the worked
 * example.
 *
 * The easy-tier model is pre-placed in its tray on screen, so an ask about it
 * would be answerable by LOOKING rather than by sorting: the `showCounts` defect
 * in a different pixel. It stays on the page and stays inside every count; it is
 * only never the question.
 */
const askableObjectsOf = (ch: SortingChallengeLike) =>
  objectsOf(ch).filter((o) => !ch.modelItemId || o.id !== ch.modelItemId);

/**
 * Every judged item one challenge can ask, or `[]` when it can ask none.
 *
 * Nothing here backfills: a placeholder in a judged loop becomes a spoken ask
 * the tutor has to stand behind. The gates, and what each one closes:
 *
 *  - group labels must be SAYABLE, distinct and ear-separable. Two labels a
 *    judge cannot tell apart give an utterance two homes and no honest verdict.
 *  - no label may be an OBJECT that is being sorted. "Listen: fruit. Fruit, or
 *    Vegetable?" is a riddle, not a question.
 *  - a sort needs at least two groups actually represented among its kept
 *    objects, or the child can say one label every round and be right.
 *  - a count must land inside the benched 1..20 — an EMPTY group is unaskable
 *    (zero is not in the class) and is dropped rather than floored.
 *  - a yes/no sort needs both verdicts reachable, or it measures nothing.
 *  - nothing generated may open a sentence with a verdict sentinel.
 */
export const itemsFromChallenge = (
  ch: SortingChallengeLike,
  opts: SortingBuildOptions = {},
): SortingStationItem[] => {
  const tier = opts.tier ?? 'medium';
  const isPreReader = !!opts.isPreReader;
  // The band floor beats the tier: a pre-reader cannot read a tray, so the ask
  // names the groups at hard too. What hard withholds at K is the RULE.
  const namesChoices = isPreReader || ch.namesSortCriterion !== false;
  const showChoiceEmojis = isPreReader || ch.showBucketEmojis !== false;
  const base = {
    mode: ch.type,
    tier,
    challengeId: ch.id,
    answerKind: 'voice' as const,
    namesChoices,
    showChoiceEmojis,
    hidesCounts: false,
  };

  // `objects` is what may be ASKED about; `pageObjects` is what is on screen.
  // They differ by the pre-placed worked example, and only the counts use the
  // second — a count that skipped a visible card would contradict the screen.
  const objects = askableObjectsOf(ch).filter((o) => isSayableObject(o.label));
  const pageObjects = objectsOf(ch);
  const ruleName = sanitize(ch.sortingAttribute) || undefined;

  // ── odd-one-out: ONE judged turn, and the answer is an object's NAME ──────
  if (ch.type === 'odd-one-out') {
    if (objects.length < 3) return [];
    const odd = objects.find((o) => o.id === ch.oddOneOut);
    if (!odd) return [];
    // Every card must be tellable from every other by ear, or "the round one"
    // fits two of them and there is no honest verdict.
    if (!optionsEarSeparable(objects.map((o) => o.label))) return [];
    return [{
      ...base,
      id: `${ch.id}::odd`,
      kind: 'odd_one' as const,
      action: 'odd_one',
      responseClass: responseClassFor('odd_one'),
      // The stimulus is the SET, never a name — naming one would point at it.
      stimulus: `${objects.length} pictures`,
      answer: odd.label,
      choices: objects.map((o) => o.label),
      choiceEmojis: objects.map((o) => o.emoji),
      // The ask never recites the cards: they are pictures on the screen, and
      // reading six labels aloud every round is the recitation the 2026-08-13
      // rulings struck. The oracle is therefore FLAT on this kind.
      namesChoices: false,
      ...(ruleName ? { ruleName } : {}),
    }];
  }

  // ── count-and-compare / tally-record: a count per group, then the compare ─
  if (ch.type === 'count-and-compare' || ch.type === 'tally-record') {
    const cats = categoriesOf(ch).filter((c) => isSayableLabel(c.label));
    if (cats.length < 2) return [];
    if (new Set(cats.map((c) => c.label.toLowerCase())).size !== cats.length) return [];
    if (!optionsEarSeparable(cats.map((c) => c.label))) return [];
    if (!ruleName) return [];

    // Counted over the PAGE, not the askable set — see `pageObjects`.
    const countFor = (label: string) =>
      pageObjects.filter((o) => {
        const value = o.attributes[ruleName];
        return !!value && value.toLowerCase() === label.toLowerCase();
      }).length;

    // An EMPTY group is a fine sort outcome and an unaskable count — zero is
    // outside the benched class. Drop the group, never floor it to one.
    const askable = cats
      .map((c) => ({ ...c, count: countFor(c.label) }))
      .filter((c) => isSayableCount(c.count));
    if (askable.length < 2) return [];

    const items: SortingStationItem[] = askable.map((c) => ({
      ...base,
      id: `${ch.id}::count::${c.label.toLowerCase().replace(/\s+/g, '-')}`,
      kind: 'count_group' as const,
      action: 'count_group',
      responseClass: responseClassFor('count_group'),
      stimulus: c.label,
      ...(c.emoji ? { stimulusEmoji: c.emoji } : {}),
      answer: numberWordFor(c.count),
      answerValue: c.count,
      choices: [],
      choiceEmojis: [],
      // A count ask never names its own answer set.
      namesChoices: false,
      // ⭐ The badge that used to print this number is off for this item.
      hidesCounts: true,
      ...(ruleName ? { ruleName } : {}),
    }));

    // The compare beat is count-and-compare's identity; tally-record records and
    // stops, which is what its own eval-mode description says it does.
    //
    // ⭐ THE ANSWER IS A GROUP NAME, NOT A COMPARISON WORD, and that is a fix the
    // spoken ask forced. The obvious phrasing — "are there more Red, or more
    // Blue?" answered with "more"/"fewer" — puts the answer inside the question
    // by construction, in the one clause a menu exemption cannot cover, because
    // the comparison word appears in the ask TWICE as ordinary grammar. Asking
    // "which group has more?" and taking the LABEL back is both leak-clean and
    // what a five-year-old actually says. `the same` stays as the third option
    // for equal groups, which have no label answer.
    if (ch.type === 'count-and-compare') {
      const [a, b] = askable;
      if (a && b) {
        const answer = a.count > b.count
          ? a.label
          : a.count < b.count
            ? b.label
            : 'the same';
        // A key that disagrees with the counts is a broken ask, not a hard one.
        const claimed = ch.correctComparison;
        const keyAgrees = !claimed
          || (claimed === 'equal' ? a.count === b.count : a.count !== b.count);
        if (keyAgrees) {
          items.push({
            ...base,
            id: `${ch.id}::compare`,
            kind: 'compare' as const,
            action: 'compare',
            responseClass: responseClassFor('compare'),
            stimulus: `${a.label} and ${b.label}`,
            answer,
            choices: [a.label, b.label, 'the same'],
            choiceEmojis: [a.emoji, b.emoji, ''],
            namesChoices: true,
            hidesCounts: true,
            ...(ruleName ? { ruleName } : {}),
          });
        }
      }
    }
    return items.slice(0, MAX_ITEMS_PER_CHALLENGE);
  }

  // ── two-attributes: one YES/NO per object, both verdicts guaranteed ───────
  if (ch.type === 'two-attributes') {
    const primary = sanitize(ch.targetCategory);
    const secondaryAttr = sanitize(ch.secondaryAttribute);
    const secondary = sanitize(ch.secondaryValue);
    if (!primary || !secondaryAttr || !secondary) return [];
    if (!isSayableLabel(primary) || !isSayableLabel(secondary)) return [];
    // Two criteria that sound alike make "is it a red one and a red one" —
    // the child cannot tell which half they are answering.
    if (!optionsEarSeparable([primary, secondary])) return [];
    if (objects.length < 3) return [];

    const matches = (o: (typeof objects)[number]) => {
      const cat = o.attributes.category ?? o.attributes[ruleName ?? 'category'] ?? '';
      const sec = o.attributes[secondaryAttr] ?? '';
      return cat.toLowerCase() === primary.toLowerCase()
        && sec.toLowerCase() === secondary.toLowerCase();
    };
    const kept = capCoveringBothVerdicts(objects, matches, MAX_ITEMS_PER_CHALLENGE);
    if (kept.length < 2) return [];

    return kept.map((o) => ({
      ...base,
      id: `${ch.id}::${o.id}`,
      kind: 'both_criteria' as const,
      action: 'both_criteria',
      responseClass: responseClassFor('both_criteria'),
      stimulus: o.label,
      ...(o.emoji ? { stimulusEmoji: o.emoji } : {}),
      answer: matches(o) ? 'yes' : 'no',
      // The answer set is a spoken yes/no, never a printed menu.
      choices: [],
      choiceEmojis: [],
      namesChoices: false,
      criteria: { primary, secondary },
      ...(ruleName ? { ruleName } : {}),
    }));
  }

  // ── the sort family: sort-by-one, sort-variety, sort-by-attribute ─────────
  const cats = categoriesOf(ch).filter((c) => isSayableLabel(c.label));
  if (cats.length < 2) return [];
  if (new Set(cats.map((c) => c.label.toLowerCase())).size !== cats.length) return [];
  if (!optionsEarSeparable(cats.map((c) => c.label))) return [];
  if (!ruleName) return [];

  const labels = cats.map((c) => c.label);
  const labelSet = new Set(labels.map((l) => l.toLowerCase()));
  const placed = objects
    .map((o) => ({
      ...o,
      group: labels.find(
        (l) => l.toLowerCase() === sanitize(o.attributes[ruleName]).toLowerCase(),
      ) ?? '',
    }))
    // An object that IS a group label turns the ask into a riddle; an object
    // with no home cannot be judged at all.
    .filter((o) => !!o.group && !labelSet.has(o.label.toLowerCase()));
  if (placed.length < 2) return [];

  const kept = capCoveringEveryGroup(placed, (o) => o.group, labels, MAX_ITEMS_PER_CHALLENGE);
  // One answer repeated every round is a sort the child can pass without
  // sorting — the same defect a one-option menu is.
  if (new Set(kept.map((o) => o.group)).size < 2) return [];

  const emojis = cats.map((c) => c.emoji);
  const sortItems: SortingStationItem[] = kept.map((o) => ({
    ...base,
    id: `${ch.id}::${o.id}`,
    kind: 'sort' as const,
    action: 'sort',
    responseClass: responseClassFor('sort'),
    stimulus: o.label,
    ...(o.emoji ? { stimulusEmoji: o.emoji } : {}),
    answer: o.group,
    choices: labels,
    choiceEmojis: emojis,
    ruleName,
  }));

  // `sort-by-attribute`'s identity is the METACOGNITIVE choice — the click era
  // made the student pick an axis from text buttons, which is the exact reading
  // demand that floored it to Grade 1+. Spoken, it is one short word, so the
  // choice survives and the floor's reason does not. It leads the challenge.
  if (ch.type === 'sort-by-attribute') {
    const axisKeys = Array.from(
      new Set(objects.flatMap((o) => Object.keys(o.attributes))),
    );
    // The child hears and says the SPOKEN form; the key stays on `ruleName`.
    const axes = axisKeys.map(spokenAxisName).filter(isSayableLabel);
    const spokenRule = spokenAxisName(ruleName);
    if (
      axes.length >= 2
      && axes.includes(spokenRule)
      && new Set(axes.map((a) => a.toLowerCase())).size === axes.length
      && optionsEarSeparable(axes)
    ) {
      sortItems.unshift({
        ...base,
        id: `${ch.id}::rule`,
        kind: 'pick_rule' as const,
        action: 'pick_rule',
        responseClass: responseClassFor('pick_rule'),
        stimulus: `${objects.length} pictures`,
        answer: spokenRule,
        choices: axes,
        choiceEmojis: axes.map(() => ''),
        namesChoices: true,
        ruleName,
      });
    }
  }

  return sortItems.slice(0, MAX_ITEMS_PER_CHALLENGE);
};

/**
 * The session, capped. `MAX_ITEMS_PER_SESSION` is a LENGTH bound, not a gate —
 * it truncates a run that would otherwise ask thirty questions, and it reports
 * what it dropped rather than silently shortening (a truncated run that reads as
 * "covered everything" is the trap `/add-di-loop` step 7 names).
 *
 * It truncates on a CHALLENGE boundary rather than mid-challenge, because every
 * per-challenge gate above — every tray reached, both verdicts present, the
 * compare beat following its counts — is a property of a whole challenge's item
 * list, and a blind tail slice is exactly what would undo them.
 */
export const itemsFromChallenges = (
  challenges: SortingChallengeLike[],
  opts: SortingBuildOptions = {},
): SortingStationItem[] => {
  const perChallenge = challenges.map((ch) => itemsFromChallenge(ch, opts));
  const kept: SortingStationItem[] = [];
  let heldBack = 0;
  for (const items of perChallenge) {
    if (!items.length) continue;
    if (kept.length && kept.length + items.length > MAX_ITEMS_PER_SESSION) {
      heldBack += items.length;
      continue;
    }
    kept.push(...items);
  }
  if (heldBack) {
    // eslint-disable-next-line no-console
    console.info(
      `[sorting-station] session capped at ${MAX_ITEMS_PER_SESSION} asks — `
      + `${heldBack} askable item(s) held back.`,
    );
  }
  return kept.slice(0, MAX_ITEMS_PER_SESSION);
};

// ── Spoken phrasing helpers ─────────────────────────────────────────────────

const listPhrase = (options: readonly string[]): string => {
  if (options.length <= 1) return options[0] ?? '';
  if (options.length === 2) return `${options[0]}, or ${options[1]}`;
  return `${options.slice(0, -1).join(', ')}, or ${options[options.length - 1]}`;
};

/** The spoken menu clause — the ONE span where the answer legitimately appears
 *  (push-pull-arena's shape). `leakExemptSpanFor` subtracts exactly this. */
export const choicesPhrase = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return `${listPhrase(item.choices)}?`;
    case 'pick_rule':
      return `${listPhrase(item.choices)}?`;
    case 'compare':
      return `${listPhrase(item.choices)}?`;
    default:
      return '';
  }
};

/** The question, without its menu. Stated aloud because a pre-reader cannot read
 *  the screen, and every correction re-ask inherits it. */
const questionFor = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return `Where does it go?`;
    case 'pick_rule':
      return `Which way should we sort them?`;
    case 'odd_one':
      return `Which one does not belong?`;
    case 'count_group':
      return `How many are in the ${item.stimulus} group?`;
    case 'compare':
      return `Which group has more?`;
    case 'both_criteria':
      return `Is it a ${item.criteria?.primary}, and is it ${item.criteria?.secondary}?`;
    default:
      return '';
  }
};

/** The whole ask for one item. */
const askFor = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return item.namesChoices
        ? `Your turn. Listen: ${item.stimulus}. ${choicesPhrase(item)}`
        : `Your turn. Listen: ${item.stimulus}. ${questionFor(item)}`;
    case 'pick_rule':
      return `Your turn. Look at them all. ${questionFor(item)} ${choicesPhrase(item)}`;
    case 'odd_one':
      return `Your turn. Look at them all. ${questionFor(item)}`;
    case 'count_group':
      return `Your turn. ${questionFor(item)}`;
    case 'compare':
      return `Your turn. ${questionFor(item)} ${choicesPhrase(item)}`;
    case 'both_criteria':
      return `Your turn. Listen: ${item.stimulus}. ${questionFor(item)}`;
    default:
      return '';
  }
};

/**
 * How the game works — spoken at the run's opening and whenever the ACTION
 * changes, never on every ask. (The lead-in belongs to the INTRODUCTION of an
 * action, never to every ask — ruled twice on 2026-08-13.)
 */
const howToPlayFor = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return `I will say one thing at a time, and you tell me which group it belongs with. `;
    case 'pick_rule':
      return `First we choose HOW to sort these. `;
    case 'odd_one':
      return `All but one of these belong together. `;
    case 'count_group':
      return `Now we count each group out loud. `;
    case 'compare':
      return `Now we compare the two groups. `;
    case 'both_criteria':
      // NEVER "you tell me yes or no": on a `yes_no` item those two words ARE
      // the answer set, and reciting them in the how-to-play puts the answer in
      // the ask on the introducing item. The format needs no announcing — a
      // child asked "is it a need, and is it food?" answers yes or no anyway.
      // Fixed at the cause rather than widened into an exemption, which is the
      // letter-spotter ruling (never switch the oracle off over our own lines).
      return `This time each thing has to match TWO things, and you tell me if it does. `;
    default:
      return '';
  }
};

/**
 * The DISTAR lead-in — a STRATEGY model, never an exemplar. Modelling a worked
 * item ("apple — Need") would say a group name that is very often the next
 * item's answer, because one challenge shares one label set.
 *
 * The tier ladder sets how rich the INTRODUCTION is; it does not speak per item.
 */
const leadInFor = (item: SortingStationItem): string => {
  if (item.tier === 'hard') return '';
  switch (item.kind) {
    case 'sort':
      return item.tier === 'easy'
        ? `Think about what kind of thing it is, then pick the group it matches. `
        : `Think about what kind of thing it is. `;
    case 'pick_rule':
      return item.tier === 'easy'
        ? `Look for something ALL of them have, that is not the same for every one. `
        : `Look for what makes them different. `;
    case 'odd_one':
      return item.tier === 'easy'
        ? `Find what most of them have in common first, then find the one without it. `
        : `Find what most of them have in common first. `;
    case 'count_group':
      // NEVER the word "one" here: it is a legitimate ANSWER to this kind, and a
      // lead-in that says it puts the answer in the ask on every group of one.
      return item.tier === 'easy'
        ? `Touch each thing as you count, and say the last number you land on. `
        : `Touch each thing as you count. `;
    case 'compare':
      return item.tier === 'easy'
        ? `Think about which count was bigger. `
        : `Think about the two counts. `;
    case 'both_criteria':
      return item.tier === 'easy'
        ? `Check the first thing, then check the second thing. Both have to be true. `
        : `Both have to be true. `;
    default:
      return '';
  }
};

/** The affirmation — echoes the canonical answer so the child hears it once,
 *  correctly, attached to the thing it names. */
const affirmFor = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return `Yes, ${item.stimulus} goes with ${item.answer}.`;
    case 'pick_rule':
      return `Yes, we can sort them by ${item.answer}.`;
    case 'odd_one':
      return `Yes, ${item.answer} does not belong.`;
    case 'count_group':
      // "there are one" is not English, and a five-year-old hears it.
      return item.answerValue === 1
        ? `Yes, there is ${item.answer} in the ${item.stimulus} group.`
        : `Yes, there are ${item.answer} in the ${item.stimulus} group.`;
    case 'compare':
      return item.answer === 'the same'
        ? `Yes, the two groups have the same amount.`
        : `Yes, there are more in ${item.answer}.`;
    case 'both_criteria':
      return item.answer === 'yes'
        ? `Yes, ${item.stimulus} matches both.`
        : `Yes, ${item.stimulus} does not match both.`;
    default:
      return `Yes.`;
  }
};

/** The correction — full DISTAR model-lead-test. Names the fact (a category
 *  assignment is a fact a child either holds or does not), then re-elicits the
 *  SAME item. */
const correctionFor = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return `My turn: ${item.stimulus} goes with ${item.answer}. Your turn. Where does ${item.stimulus} go?`;
    case 'pick_rule':
      return `My turn: we can sort these by ${item.answer}. Your turn. Which way should we sort them?`;
    case 'odd_one':
      return `My turn: ${item.answer} does not belong. Your turn. Which one does not belong?`;
    case 'count_group':
      return item.answerValue === 1
        ? `My turn: there is ${item.answer} in the ${item.stimulus} group. Your turn. How many are in the ${item.stimulus} group?`
        : `My turn: there are ${item.answer} in the ${item.stimulus} group. Your turn. How many are in the ${item.stimulus} group?`;
    case 'compare':
      return item.answer === 'the same'
        ? `My turn: the two groups have the same amount. Your turn. Which group has more?`
        : `My turn: there are more in ${item.answer}. Your turn. Which group has more?`;
    case 'both_criteria':
      return item.answer === 'yes'
        ? `My turn: ${item.stimulus} matches both, so the answer is yes. Your turn. Does ${item.stimulus} match both?`
        : `My turn: ${item.stimulus} does not match both, so the answer is no. Your turn. Does ${item.stimulus} match both?`;
    default:
      return `My turn. Your turn.`;
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW` in the
 * extended form counting-board, letter-spotter, picture-vocabulary, phoneme-
 * explorer and word-sorter all carry. Identical across the family on purpose: a
 * grep finds every pack that has it and every pack that does not.
 *
 * Stated BEFORE the branches because the defect is a reply that is NEITHER
 * branch — improvised praise opens with neither sentinel, so the reducer records
 * no verdict, the correction counter freezes, and the child waits on a loop that
 * cannot advance.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's.
 *
 * It matters here for a reason specific to this port: the screen carries trays,
 * cards and (on the sort family) a live count of what has been placed, so
 * "describe what has changed on the screen" is one sentence away from reading a
 * group's tally aloud on a count item that deliberately hides it.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking. `
  // ⭐ Names the block LITERALLY, because the inherited wording did not stop it.
  // Cap drill 2026-08-18: on one ask of roughly sixty the tutor read the entire
  // `[CURRENT STATE]` header and its key/value lines aloud to the child before
  // asking, tag and all — the decodable-reader class, arriving on a pack whose
  // ask is NOT near-empty. "Never announce the activity's state" describes the
  // act; it does not tell the model that the block it can literally see is the
  // thing meant, which is the gap letter-spotter's fabricated tag also fell
  // through.
  + `The activity sends you a block beginning [CURRENT STATE] with lines like activity, challengeType and stimulus. `
  + `That block is BACKGROUND FOR YOU ONLY: never read it out, never read its heading, never repeat any of its lines, `
  + `and never mention what it says. The only words you speak are the ones inside the quotation marks above.`;

/**
 * ⭐ THE VERDICT LINE IS THE END OF THE TURN.
 *
 * word-sorter's cap drill caught ELEVEN OF TWELVE affirmations running on into a
 * fabricated next ask — a real word from the challenge that was NOT the item the
 * runner was about to send. It bites a classification pack hardest because the
 * ask is one rigid template spoken a dozen times and the affirmation is short
 * and lands on a label, so the likeliest continuation the model has is the next
 * ask. `TWO_BRANCH_LAW` says the reply is one quoted line "and nothing else" and
 * `NEVER_PERFORM` forbids narrating the state; neither names *continuing the
 * lesson*, which is the thing being done.
 */
const VERDICT_ENDS_THE_TURN =
  `Your verdict line is the END of your turn: you never continue into another question, `
  + `never say the next thing, and never announce what is coming — the activity sends you the `
  + `next question when the screen is ready for it, and a question you ask early is about the wrong thing.`;

// ── The judging contract ────────────────────────────────────────────────────

/**
 * The answer rides in the control channel ahead of the attempt, which is the
 * family's shipped shape under the never-say-it law — a judge cannot decide an
 * answer it was never told.
 *
 * TWO clauses earn their space on every kind:
 *
 *  1. THE ACCEPT CLAUSE. A five-year-old asked "Need, or Want?" answers "need",
 *     or "it's a need", or "needs" — never the label as printed. A contract that
 *     demands the exact string fails children for diction, not for categorising.
 *     The count kind needs it most: counting ALOUD and landing on the total
 *     ("one, two, three… three!") is a correct answer, and it is the one a
 *     careless judge scores as a stream of wrong numbers.
 *  2. THE SIGNATURE ERROR — the miss that is fluent, confident and most likely
 *     to be wrongly affirmed. It differs per kind, and each is named below.
 */
const judgingContract = (item: SortingStationItem): string => {
  let target = '';
  let signature = '';
  let wrongClause = '';

  switch (item.kind) {
    case 'sort':
      target =
        `The correct answer is the group "${item.answer}". `
        + `They may say it without its little words or with the ending changed — "${item.answer}", `
        + `"the ${item.answer}", "it is a ${item.answer}" all count as the same answer. `;
      // picture-vocabulary's documented trap, and word-sorter's: the stimulus
      // said straight back is a real word the tutor spoke two seconds ago.
      signature =
        `Saying the word "${item.stimulus}" back is NOT an answer however confident it sounds — that thing is the question. `;
      wrongClause = item.choices.length === 2
        ? `The other group is wrong. `
        : `Any of the other groups is wrong. `;
      break;
    case 'pick_rule':
      target =
        `The correct answer is "${item.answer}". `
        + `Any natural way of saying it counts — "${item.answer}", "by ${item.answer}", "their ${item.answer}". `;
      signature =
        `Naming a single object, or describing one object's ${item.answer}, is NOT an answer — the question is which way to sort them ALL. `;
      wrongClause = `Any other way of sorting is wrong. `;
      break;
    case 'odd_one':
      target =
        `The correct answer is the picture of the ${item.answer}. `
        + `Accept any clear way of naming it — "${item.answer}", "the ${item.answer}", "that one, the ${item.answer}", `
        + `or a close everyday word for the same picture. `;
      signature =
        `Saying what the OTHERS have in common is NOT an answer — it is the reason, and the question asks which one is different. `
        + `If they give only the reason, that counts as wrong and you run the correction. `;
      wrongClause = `Naming any of the other pictures is wrong. `;
      break;
    case 'count_group':
      target =
        `The correct answer is the number ${item.answerValue} — the word "${item.answer}". `
        + `Counting out loud and LANDING on it counts as right: if they say "one, two, ${item.answer}", the answer is ${item.answer} and it is correct. `
        + `Only the number they finish on is their answer. `;
      signature =
        `A number that is one away from ${item.answerValue} is the most common miss and it is still wrong — do not round toward it. `;
      wrongClause = `Any other number is wrong. `;
      break;
    case 'compare':
      target = item.answer === 'the same'
        ? `The correct answer is that the groups are the SAME. `
          + `Natural variants count — "the same", "same", "equal", "they match", "both". `
        : `The correct answer is the group "${item.answer}". `
          + `They may say it plainly or inside a phrase — "${item.answer}", "the ${item.answer}", `
          + `"${item.answer} has more" all count as the same answer. `;
      signature =
        `Saying only "more" without naming which group is NOT an answer — the question asks WHICH group, `
        + `and "more" is the word the question itself used. `;
      wrongClause = `Naming the other group, or saying they are the same when they are not, is wrong. `;
      break;
    case 'both_criteria':
      target =
        `The correct answer is "${item.answer}". `
        + `Natural variants count — for yes: "yes", "yeah", "yep", "it is", "it does", "both". `
        + `For no: "no", "nope", "it is not", "it does not", "only one". `;
      // 18d's accept-side sibling: a child who answers ONE half is confident and
      // wrong, and the utterance sounds like an answer to the question asked.
      signature =
        `Answering only ONE of the two things is NOT an answer — "it is a ${item.criteria?.primary}" does not say whether it is also ${item.criteria?.secondary}, `
        + `so it is wrong and you run the correction. `;
      wrongClause = `The opposite verdict is wrong. `;
      break;
    default:
      break;
  }

  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `
    + target
    + `A shy or mumbled try still counts. `
    + signature
    + wrongClause
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface SortingCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: SortingStationItem,
  opts: SortingCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Let us sort some things together! ' : '';
  // Introducing = the run's opening, or the ACTION just changed. Only then does
  // the child hear how the game works and the DISTAR lead-in; every other item
  // goes straight to the ask.
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return (
    `[SST_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} `
    + `${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 *
 * NO CLOSE LINE — the same pack-specific deduction word-sorter recorded. This
 * pack's correction NAMES the fact and the runner runs it TWICE before capping,
 * so the child has already heard "apple goes with Need" twice; a third telling
 * is redundant. It is also the only place a group label would reach the move-on
 * utterance outside the exempt menu clause, and every item of a challenge shares
 * one label set — so the capped item's close line would name a label that is
 * very often the NEXT item's answer too (`di-answer-leak-in-ask`, caught on
 * word-sorter's cap drill 2026-08-16). Deleting a redundant sentence removes the
 * finding at its cause rather than widening an exemption around it.
 */
export const moveOnCue = (
  item: SortingStationItem,
  next: SortingStationItem | null,
  opts: SortingCueOptions = {},
): string => {
  if (!next) {
    return (
      `[SST_MOVE] Say exactly: "Good try! We will sort that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[SST_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

export const completeCue = (): string =>
  `[SST_COMPLETE] Say exactly: "Great sorting today! You told me every one out loud. See you next time!" `
  + `Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn
 * by band or tier. It is the pre-reader's only way back to a stimulus that lives
 * in audio.
 */
export const pronounceCue = (item: SortingStationItem): string => {
  const line = item.namesChoices
    ? `${item.kind === 'sort' ? `Listen: ${item.stimulus}. ` : ''}${questionFor(item)} ${choicesPhrase(item)}`
    : `${item.kind === 'sort' || item.kind === 'both_criteria' ? `Listen: ${item.stimulus}. ` : ''}${questionFor(item)}`;
  return (
    `[SST_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line.trim()}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule). It names what is being asked about and how many options
 * exist, and never the options themselves: at `hard` for a reader the ask
 * deliberately does not say them, and a context line that did would hand the
 * tutor a set it could volunteer.
 *
 * The count kinds push a DESCRIPTION with no number in it at all — the number is
 * the answer, and `[CURRENT STATE]` is a live audio channel whenever an ask is
 * near-empty (decodable-reader's finding).
 */
export const stimulusFor = (item: SortingStationItem): string => {
  switch (item.kind) {
    case 'sort':
      return `the picture of a ${item.stimulus}, with ${item.choices.length} groups shown on the screen`;
    case 'pick_rule':
      return `a set of pictures that could be grouped more than one way`;
    case 'odd_one':
      return `a row of pictures, one of which does not belong`;
    case 'count_group':
      return `the ${item.stimulus} group on the screen`;
    case 'compare':
      return `two groups that have both been counted`;
    case 'both_criteria':
      return `the picture of a ${item.stimulus}, to be checked against two things at once`;
    default:
      return `a sorting activity`;
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/**
 * Everything of this pack that can reach the tutor, in one value. The component
 * spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`); the drive-plan endpoint hands it to
 * `run_tutor_live.py --di`. A harness that re-typed these cues would test a
 * fiction.
 */
export const sortingStationPackBase = (
  items: SortingStationItem[],
): JudgedCueSurface<SortingStationItem> => ({
  primitiveType: 'sorting-station',
  activityLine: 'live direct instruction sorting and classifying practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ──────

/**
 * The span of the ask inside which the answer may legitimately appear.
 *
 * A SORT ASK CLOSES ON A SPOKEN MENU, so the answer word is inside it by
 * construction — push-pull-arena's shape. Subtracting exactly the menu keeps the
 * oracle live over the greeting, the how-to-play, the DISTAR lead-in and the
 * hand-over, which is the half we author and therefore the half most worth
 * scanning.
 *
 * FOUR of the six kinds return nothing, and every one of those is the oracle
 * getting STRONGER, not weaker:
 *  - `hard` for a reader names no groups, so there is no menu to subtract.
 *  - `odd_one` never recites the cards — they are pictures — so an object name
 *    in the tutor's mouth there is always a leak.
 *  - `count_group` has no menu at all: any number the tutor says before the
 *    child answers is a leak, which is the whole point of the flat scan.
 *  - `both_criteria` answers yes/no, and neither word is in the ask.
 */
export const leakExemptSpanFor = (item: SortingStationItem): string | undefined =>
  item.namesChoices && (item.kind === 'sort' || item.kind === 'pick_rule' || item.kind === 'compare')
    ? choicesPhrase(item)
    : undefined;

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each of
 * these; this is that claim made testable. Change one, change both.
 */
export const sortingStationHarnessAnswers = (item: SortingStationItem) => {
  const otherChoice = item.choices.find(
    (c) => c.toLowerCase() !== item.answer.toLowerCase(),
  );

  switch (item.kind) {
    case 'count_group': {
      const off = (item.answerValue ?? 2) > MIN_COUNT
        ? (item.answerValue ?? 2) - 1
        : (item.answerValue ?? 1) + 1;
      return {
        correct: item.answer,
        plainWrong: numberWordFor(Math.min(MAX_COUNT, Math.max(MIN_COUNT, off + 3))),
        signatureWrong: {
          text: numberWordFor(off),
          why:
            'the off-by-one count — the most common miss in a spoken count, and the one a judge '
            + 'grading on "did they say a number" rounds toward. The contract forbids rounding by name',
        },
        leakTokens: [item.answer, String(item.answerValue ?? '')].filter(Boolean),
        leakExemptSpan: leakExemptSpanFor(item),
      };
    }
    case 'both_criteria':
      return {
        correct: item.answer,
        plainWrong: item.answer === 'yes' ? 'no' : 'yes',
        signatureWrong: {
          text: `it is a ${item.criteria?.primary}`,
          why:
            'ONE half of the compound answered confidently. It is a true statement about the object and '
            + 'it sounds like an answer, but it never says whether the SECOND criterion holds — the exact '
            + 'miss the compound instruction used to hide behind a written sentence',
        },
        leakTokens: [item.answer],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    case 'odd_one':
      return {
        correct: item.answer,
        plainWrong: otherChoice ?? 'something else',
        signatureWrong: {
          text: 'they all go together',
          why:
            'the REASON offered in place of the choice. It is the thinking the task wants and it is not '
            + 'the answer to the question asked, so a judge listening for "did they engage" affirms it',
        },
        leakTokens: [item.answer],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    case 'compare':
      return {
        correct: item.answer,
        plainWrong: otherChoice ?? 'the same',
        signatureWrong: {
          text: 'more',
          why:
            'the bare comparison word with no group named. It is the word the QUESTION itself used, said '
            + 'confidently, so a judge listening for "did they say something about more" affirms it — while '
            + 'the child has not said which group',
        },
        leakTokens: [item.answer],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    case 'pick_rule':
      return {
        correct: item.answer,
        plainWrong: otherChoice ?? 'something else',
        signatureWrong: {
          text: `this one is ${item.answer}`,
          why:
            'ONE object described by the right attribute instead of the sorting RULE named. The word the '
            + 'judge is listening for is present, which is exactly why a loose judge affirms it',
        },
        leakTokens: [item.answer],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    case 'sort':
    default:
      return {
        correct: item.answer,
        plainWrong: otherChoice ?? 'something else',
        signatureWrong: {
          text: item.stimulus,
          why:
            'the stimulus said straight back — a real word, said confidently, that the tutor itself spoke '
            + 'two seconds earlier, so a judge listening for "something relevant to this item" affirms it. '
            + 'The contract names this miss by name',
        },
        leakTokens: [item.answer],
        leakExemptSpan: leakExemptSpanFor(item),
      };
  }
};
