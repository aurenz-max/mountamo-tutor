/**
 * sortingStationDomain — what sorting-station TEACHES: the build gates that drop an unaskable item, the item builders,
 * the ask and its key, the known misses and the scene. The generator imports its gates from here, so both sides of
 * the wire agree on what is sayable; the boss (`sortingStation.boss.ts`) reads the ask, key and misses.
 *
 * Every answer is SPOKEN. Picture a teacher at a table with one child, picture cards and labelled trays:
 *
 *   sort           the answer is one of the group LABELS      short_spoken_word
 *   pick_rule      the answer is one of the sorting AXES      short_spoken_word
 *   odd_one        the answer is one OBJECT on the screen     short_spoken_word
 *   count_group    the answer is HOW MANY are in a group      number_word_to_20
 *   compare        the answer is WHICH GROUP has more         short_spoken_word
 *   both_criteria  the answer is YES or NO                    yes_no
 *   name_rule      the answer is a GROUP'S RULE (all red)     short_spoken_word, or a tapped chip
 *   misfit         the answer is the card in the WRONG group  short_spoken_word, or a tapped card
 *
 * say-rule (name_rule, misfit) is the one mode that also takes a tap: its answer is one word the child may say or
 * tap (USER 10-13, voice beside the tap), and the activity checks the tap (`sortingStationTapCheck`). Every other
 * kind is said only.
 *
 * A drag-to-bin with a Check button was a costume: a child who cannot categorise can drag until it goes green. The
 * trays and the cards stay, as the page a teacher lays on the table; the action was the costume, never the paper.
 *
 * Two pixel leaks the spoken asks expose, both gated here: the per-tray count badge IS the answer on a count or
 * compare ask (`hidesCounts`), and the easy-tier worked example sits solved in its tray, so it is never asked.
 * A capped session must not strand a tray or a yes/no verdict (`capCoveringEveryGroup`, `capCoveringBothVerdicts`).
 */

import { opensWithSentinel } from '../../../hooks/judgedScriptContract';
import type { ResponseClassId, TeachingItem } from '../../../hooks/teachingItemContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import { offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { numberWordFor } from './countingBoardDomain';

// Re-exported so the generator imports its build gates from ONE address — both sides of the wire must agree on
// what is sayable.
export { opensWithSentinel, numberWordFor };

export type SortingStationMode =
  | 'sort-by-one'
  | 'sort-by-attribute'
  | 'sort-variety'
  | 'odd-one-out'
  | 'count-and-compare'
  | 'two-attributes'
  | 'tally-record'
  | 'say-rule';

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
  | 'both_criteria'
  /** say-rule: a finished sort is on screen; the child says why one group's cards go together (its rule). */
  | 'name_rule'
  /** say-rule: one card sits in the wrong group of a finished sort; the child names it. */
  | 'misfit';

// ── The item ────────────────────────────────────────────────────────────────

export interface SortingStationItem extends TeachingItem {
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
  /** Other answers that are equally right, computed in code from the cards: on `pick_rule` every other way the cards
   *  split into groups (the child's own valid rule), on `name_rule` every other value that makes exactly this group. */
  alsoAccept?: string[];
  /** Draw each card at its size (`sizeScales`): only where size is a way the item lets the child sort or explain, so
   *  the drawing never becomes a cue to a rule the item does not ask about (and never singles out the answer axis
   *  on a pick-the-rule ask, where it is drawn whenever size is one of the offered ways). */
  drawSizes?: boolean;
  /** say-rule: which tray of the finished sort the ask points at (0-based, in tray order). */
  trayIndex?: number;
  /** name_rule: the other groups' rules, the distractors that are another group's rule (the rest are partial). */
  otherGroups?: string[];
  /** A practice item a simplify lever opened (`sortingStationLevers.ts`): the page it draws, in place of its
   *  challenge's. */
  practiceChallenge?: SortingChallengeLike;
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
    case 'name_rule':
    case 'misfit':
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
  /** say-rule only: one card drawn in the wrong tray of the finished sort, for the child to find (PTRN001-02-G).
   *  Code places it (the generator's orchestrator); its true group is still read from its attributes. */
  intruder?: { objectId: string; trayLabel: string };
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

type PageObject = ReturnType<typeof objectsOf>[number];
const valueOf = (o: { attributes?: Record<string, string> }, axis: string) => sanitize(o.attributes?.[axis]).toLowerCase();
const capitalize = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

// ── Real size (K math audit CV1) ──────────────────────────────────────────────

/**
 * Size words, in order. A size sort used to draw every card at the same emoji size, so "big or small?" tested what
 * the child knows about elephants rather than what they see. Only these words are drawn: a size value outside the
 * table ("tall", "long") is a different dimension, and guessing a scale for it would draw something untrue.
 */
const SIZE_RANK: Record<string, number> = {
  tiny: 0, little: 1, small: 1, medium: 2, middle: 2, 'medium-sized': 2, big: 3, large: 3, huge: 4, giant: 4,
};

/** Is this a size the drawing knows? The generator files a sort whose values are all size words under `size`. */
export const isSizeWord = (value: string): boolean => SIZE_RANK[value.trim().toLowerCase()] !== undefined;

/**
 * Card id → drawn scale (0.5 smallest .. 1 largest), read from the cards' own `size` values, or null when the page
 * cannot be drawn to size: some card has no size, a size word outside the table, or every card is one size. Equal
 * size words draw equal; the scale says only the ORDER the data states, never a magnitude it does not.
 */
export function sizeScales(objects: readonly { id: string; attributes?: Record<string, string> }[]): Map<string, number> | null {
  const ranks = objects.map((o) => SIZE_RANK[valueOf(o, 'size')]);
  if (!objects.length || ranks.some((r) => r === undefined)) return null;
  const distinct = Array.from(new Set(ranks as number[])).sort((a, b) => a - b);
  if (distinct.length < 2) return null;
  return new Map(objects.map((o, i) => [o.id, 0.5 + 0.5 * (distinct.indexOf(ranks[i] as number) / (distinct.length - 1))]));
}

// ── Rules a set of cards really has (code checks a rule, never the model) ────

/** The tray cap a rule may split into: Kindergarten 3, Grade 1 4 (contract R8). */
const binCapFor = (isPreReader: boolean) => (isPreReader ? 3 : 4);

/**
 * Every attribute the cards can honestly be sorted by: each card has a value for it, and the values make 2..binCap
 * groups. Any such attribute partitions the set consistently (every card lands in exactly one group by one rule), so
 * a child who picks it has picked a real sorting rule, whichever one the generator planned (PTRN001-02-E).
 */
export function validSortAxes(objects: readonly { attributes?: Record<string, string> }[], binCap = 4): string[] {
  const keys = Array.from(new Set(objects.flatMap((o) => Object.keys(o.attributes ?? {}))));
  return keys.filter((axis) => {
    const values = objects.map((o) => valueOf(o, axis));
    if (values.some((v) => !v)) return false;
    const groups = new Set(values).size;
    return groups >= 2 && groups <= binCap;
  });
}

/**
 * The rules that make exactly this group out of the page: every (attribute, value) whose cards are this group's
 * cards and no others. Empty when no single attribute makes it, which is an inconsistent sort: the group mixes rules,
 * or leaves out a card the rule takes in. This is the check behind crediting a child's own sort and the key of a
 * say-the-rule ask.
 */
export function rulesOfGroup(
  page: readonly { id: string; attributes?: Record<string, string> }[],
  groupIds: readonly string[],
): { axis: string; value: string }[] {
  const ids = new Set(groupIds);
  const members = page.filter((o) => ids.has(o.id));
  if (!members.length || members.length !== ids.size || members.length === page.length) return [];
  const axes = Array.from(new Set(members.flatMap((o) => Object.keys(o.attributes ?? {}))));
  return axes.flatMap((axis) => {
    const value = valueOf(members[0], axis);
    if (!value || members.some((o) => valueOf(o, axis) !== value)) return [];
    const holders = page.filter((o) => valueOf(o, axis) === value);
    return holders.length === members.length ? [{ axis, value }] : [];
  });
}

/** Does every group of a proposed sort follow one rule, the same attribute for every group? The rule, or null. */
export function ruleOfSort(
  page: readonly { id: string; attributes?: Record<string, string> }[],
  groups: readonly (readonly string[])[],
): string | null {
  const placed = groups.flat();
  if (groups.length < 2 || new Set(placed).size !== placed.length || placed.length !== page.length) return null;
  const perGroup = groups.map((g) => new Set(rulesOfGroup(page, g).map((r) => r.axis)));
  const shared = Array.from(perGroup[0]).filter((axis) => perGroup.every((s) => s.has(axis)));
  return shared[0] ?? null;
}

/**
 * The challenge re-sorted by another attribute: its trays are that attribute's values, derived from the cards as the
 * generator derives them. Same challenge (and so the same card ids) when the attribute is already its rule.
 */
export function challengeSortedBy<C extends SortingChallengeLike>(ch: C, axis: string): C {
  if (!axis || axis === ch.sortingAttribute) return ch;
  const values = Array.from(new Set((ch.objects ?? []).map((o) => valueOf(o, axis)).filter(Boolean)));
  return { ...ch, sortingAttribute: axis,
    categories: values.map((v) => ({ label: capitalize(v), rule: { [axis]: v } })) };
}

/**
 * Which valid attribute a child's words name, or null. The axis word ("colour", "kind"), its spoken form, or the
 * values of exactly one axis ("the red ones and the yellow ones") count; words naming two axes name none.
 */
export function axisNamedIn(text: string, ch: SortingChallengeLike, isPreReader = false): string | null {
  const words = new Set(normalizeForEar(text).split(' ').filter(Boolean));
  const axes = validSortAxes(ch.objects ?? [], binCapFor(isPreReader));
  const SYNONYM: Record<string, string[]> = { color: ['color', 'colour', 'colors', 'colours'], category: ['kind', 'kinds', 'category'],
    type: ['type', 'types', 'kind', 'kinds'], size: ['size', 'sizes', 'big', 'small'], shape: ['shape', 'shapes'] };
  const byWord = axes.filter((a) => [a, spokenAxisName(a), ...(SYNONYM[a] ?? [])].some((w) => words.has(w.toLowerCase())));
  if (byWord.length === 1) return byWord[0];
  const byValue = axes.filter((a) => (ch.objects ?? []).some((o) => {
    const v = valueOf(o, a);
    return !!v && v.split(' ').every((w) => words.has(w));
  }));
  return byValue.length === 1 ? byValue[0] : null;
}

// ── say-rule: the finished sort on screen ─────────────────────────────────────

export interface SayRuleTray { label: string; members: PageObject[] }

/**
 * The trays of a say-rule challenge as drawn: every card in the tray its rule puts it in, except the intruder, which
 * is drawn in its wrong tray until `intruderMoved` (once the child has found it, it goes home).
 */
export function sayRuleTrays(ch: SortingChallengeLike, intruderMoved = false): SayRuleTray[] {
  const rule = sanitize(ch.sortingAttribute);
  const page = objectsOf(ch);
  const trays = categoriesOf(ch).map((c) => ({ label: c.label, members: page.filter((o) => valueOf(o, rule) === c.label.toLowerCase()) }));
  const intruder = ch.intruder && page.find((o) => o.id === ch.intruder!.objectId);
  if (!intruder || intruderMoved) return trays;
  const home = trays.find((t) => t.members.includes(intruder));
  const away = trays.find((t) => t.label.toLowerCase() === ch.intruder!.trayLabel.toLowerCase());
  if (!home || !away || home === away) return trays;
  return trays.map((t) => t === home ? { ...t, members: t.members.filter((o) => o !== intruder) }
    : t === away ? { ...t, members: [...t.members, intruder] } : t);
}

const POSITION = ['first', 'second', 'third', 'fourth'];
/** How the ask points at a tray: its place in the row, never its name (on say-rule the name is the answer). */
export const trayPosition = (index: number) => `${POSITION[index] ?? 'last'} group`;

/** A stable order for a tap menu, so the answer is not always the first chip. */
const stableShuffle = (values: string[], seed: string): string[] => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return values.map((v, i) => ({ v, k: (h ^ ((i + 1) * 2654435761)) >>> 0 })).sort((a, b) => a.k - b.k).map((x) => x.v);
};

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
      // Every card is looked at together, so a size the data states is something the child may compare.
      ...(sizeScales(pageObjects) ? { drawSizes: true } : {}),
      ...(ruleName ? { ruleName } : {}),
    }];
  }

  // ── say-rule: a finished sort; say why a group goes together, or find the card in the wrong group ──
  if (ch.type === 'say-rule') return sayRuleItems(ch, base, objects, pageObjects, ruleName);

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
      ...(ruleName === 'size' && sizeScales(pageObjects) ? { drawSizes: true } : {}),
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
            ...(ruleName === 'size' && sizeScales(pageObjects) ? { drawSizes: true } : {}),
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
      ...(secondaryAttr === 'size' && sizeScales(pageObjects) ? { drawSizes: true } : {}),
      ...(ruleName ? { ruleName } : {}),
    }));
  }

  // ── the sort family: sort-by-one, sort-variety, sort-by-attribute ─────────
  const cats = categoriesOf(ch).filter((c) => isSayableLabel(c.label));
  if (cats.length < 2) return [];
  if (new Set(cats.map((c) => c.label.toLowerCase())).size !== cats.length) return [];
  if (!optionsEarSeparable(cats.map((c) => c.label))) return [];
  if (!ruleName) return [];

  const placed = placeForSort(objects, cats, ruleName, namesChoices);
  if (placed.length < 2) return [];

  const kept = capCoveringEveryGroup(placed, (o) => o.group, cats.map((c) => c.label), MAX_ITEMS_PER_CHALLENGE);
  // One answer repeated every round is a sort the child can pass without
  // sorting — the same defect a one-option menu is.
  if (new Set(kept.map((o) => o.group)).size < 2) return [];

  const sortItems = sortItemsFor(ch, kept, cats, ruleName, base, pageObjects);

  // `sort-by-attribute`'s identity is the METACOGNITIVE choice — the click era
  // made the student pick an axis from text buttons, which is the exact reading
  // demand that floored it to Grade 1+. Spoken, it is one short word, so the
  // choice survives and the floor's reason does not. It leads the challenge.
  //
  // REPAIR (K math audit, PTRN001-02-E): any rule the cards really split on is the child's to choose. The answer is
  // still the generator's rule, but every other VALID way (`validSortAxes`, computed from the cards) is accepted the
  // same, and the sorts that follow re-key to the chosen rule (`followRule`). `other_rule` is now only a way these
  // cards do NOT split by: an attribute some card lacks, or one every card shares.
  if (ch.type === 'sort-by-attribute') {
    const axisKeys = Array.from(
      new Set(objects.flatMap((o) => Object.keys(o.attributes))),
    );
    const valid = new Set(validSortAxes(pageObjects, binCapFor(isPreReader)));
    // The child hears and says the SPOKEN form; the key stays on `ruleName`.
    const axes = axisKeys.map(spokenAxisName).filter(isSayableLabel);
    const spokenRule = spokenAxisName(ruleName);
    const alsoAccept = axisKeys.filter((k) => k !== ruleName && valid.has(k)).map(spokenAxisName)
      .filter((a) => axes.includes(a));
    if (
      axes.length >= 2
      && axes.includes(spokenRule)
      && valid.has(ruleName)
      && new Set(axes.map((a) => a.toLowerCase())).size === axes.length
      && optionsEarSeparable(axes)
    ) {
      const sizeOffered = valid.has('size') && !!sizeScales(pageObjects);
      sortItems.unshift({
        ...base,
        id: `${ch.id}::rule`,
        kind: 'pick_rule' as const,
        action: 'pick_rule',
        responseClass: responseClassFor('pick_rule'),
        stimulus: `${objects.length} pictures`,
        answer: spokenRule,
        ...(alsoAccept.length ? { alsoAccept } : {}),
        choices: axes,
        choiceEmojis: axes.map(() => ''),
        namesChoices: true,
        ...(sizeOffered ? { drawSizes: true } : {}),
        ruleName,
      });
    }
  }

  return sortItems.slice(0, MAX_ITEMS_PER_CHALLENGE);
};

type SortBase = Omit<SortingStationItem, 'id' | 'kind' | 'action' | 'responseClass' | 'stimulus' | 'answer' | 'choices' | 'choiceEmojis'>;

/** The cards a sort may ask about, each with its group under `ruleName`. Drops what cannot be asked honestly. */
function placeForSort(objects: PageObject[], cats: ReturnType<typeof categoriesOf>, ruleName: string, namesChoices: boolean) {
  const labels = cats.map((c) => c.label);
  const labelSet = new Set(labels.map((l) => l.toLowerCase()));
  return objects
    .map((o) => ({ ...o, group: labels.find((l) => l.toLowerCase() === valueOf(o, ruleName)) ?? '' }))
    // An object that IS a group label turns the ask into a riddle; an object
    // with no home cannot be judged at all.
    .filter((o) => !!o.group && !labelSet.has(o.label.toLowerCase()))
    // With no spoken menu, a card whose name holds its own group ("Red Apple" sorted by colour) says the answer. On a
    // size sort it says it even with the menu: the size is drawn, so "Big Ball" would answer by ear what the
    // picture is there to show.
    .filter((o) => (namesChoices && ruleName !== 'size') || !containsPhrase(o.label, o.group));
}

/** One sort item per kept card. */
function sortItemsFor(ch: SortingChallengeLike, kept: (PageObject & { group: string })[], cats: ReturnType<typeof categoriesOf>,
  ruleName: string, base: SortBase, pageObjects: PageObject[]): SortingStationItem[] {
  const labels = cats.map((c) => c.label);
  const emojis = cats.map((c) => c.emoji);
  const drawSizes = ruleName === 'size' && !!sizeScales(pageObjects);
  return kept.map((o) => ({
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
    ...(drawSizes ? { drawSizes: true } : {}),
    ruleName,
  }));
}

/**
 * The child chose `axis` on a pick-the-rule ask: the sorts that follow in the same challenge are re-keyed to it,
 * card for card, so the session keeps its item ids and length (the workspace session is built from them). The page is
 * the same cards; only the trays change. Unchanged when the axis is the planned rule, is not a valid rule for these
 * cards, or would leave a sort the child can pass without sorting (one group among the asked cards).
 */
export function followRule(
  items: readonly SortingStationItem[],
  ch: SortingChallengeLike,
  axis: string,
  opts: SortingBuildOptions = {},
): SortingStationItem[] {
  const isPreReader = !!opts.isPreReader;
  if (!axis || axis === ch.sortingAttribute || !validSortAxes(ch.objects ?? [], binCapFor(isPreReader)).includes(axis)) return [...items];
  const resorted = challengeSortedBy(ch, axis);
  const cats = categoriesOf(resorted).filter((c) => isSayableLabel(c.label));
  if (cats.length < 2 || !optionsEarSeparable(cats.map((c) => c.label))) return [...items];
  const mine = items.filter((i) => i.challengeId === ch.id && i.kind === 'sort');
  if (!mine.length) return [...items];
  const namesChoices = mine[0].namesChoices;
  const askedIds = new Set(mine.map((i) => i.id.slice(`${ch.id}::`.length)));
  const page = objectsOf(resorted);
  const placed = placeForSort(page.filter((o) => askedIds.has(o.id)), cats, axis, namesChoices);
  if (placed.length !== mine.length || new Set(placed.map((o) => o.group)).size < 2) {
    // eslint-disable-next-line no-console
    console.info(`[sorting-station] ${ch.id}: the cards asked cannot all be re-sorted by ${axis}; the planned rule stays.`);
    return [...items];
  }
  const { id: _i, kind: _k, action: _a, responseClass: _r, stimulus: _s, stimulusEmoji: _e, answer: _an, choices: _c,
    choiceEmojis: _ce, drawSizes: _d, ruleName: _rn, ...base } = mine[0];
  const rebuilt = new Map(sortItemsFor(resorted, placed, cats, axis, base, page).map((i) => [i.id, i]));
  return items.map((i) => rebuilt.get(i.id) ?? i);
}

/** say-rule's items: see the header of `itemsFromChallenge`'s branch. */
function sayRuleItems(ch: SortingChallengeLike, base: SortBase, askable: PageObject[], page: PageObject[],
  ruleName: string | undefined): SortingStationItem[] {
  if (!ruleName) return [];
  const cats = categoriesOf(ch).filter((c) => isSayableLabel(c.label));
  if (cats.length < 2 || cats.length !== (ch.categories ?? []).length) return [];
  if (!optionsEarSeparable(cats.map((c) => c.label))) return [];
  const trueTrays = sayRuleTrays(ch, true);
  const drawn = sayRuleTrays(ch, false);
  // A tray with fewer than two cards has no "all of them" to explain.
  if (trueTrays.some((t) => t.members.length < 2)) return [];
  const askableIds = new Set(askable.map((o) => o.id));
  const sizesDrawn = !!sizeScales(page);
  const items: SortingStationItem[] = [];

  // PTRN001-02-G: the card in the wrong group comes first, then why the group's own cards go together.
  const intruder = ch.intruder && page.find((o) => o.id === ch.intruder!.objectId);
  const holds = (t: SayRuleTray | undefined, id: string) => !!t?.members.some((o) => o.id === id);
  const awayIndex = intruder ? drawn.findIndex((t, i) => holds(t, intruder.id) && !holds(trueTrays[i], intruder.id)) : -1;
  if (intruder && awayIndex >= 0) {
    const cards = drawn[awayIndex].members;
    if (cards.length >= 3 && cards.every((o) => askableIds.has(o.id)) && optionsEarSeparable(cards.map((o) => o.label))) {
      items.push({
        ...base,
        id: `${ch.id}::misfit`,
        kind: 'misfit' as const,
        action: 'misfit',
        responseClass: responseClassFor('misfit'),
        stimulus: trayPosition(awayIndex),
        answer: intruder.label,
        choices: cards.map((o) => o.label),
        choiceEmojis: cards.map((o) => o.emoji),
        // The cards are pictures on the screen; the ask never recites them (odd_one's ruling).
        namesChoices: false,
        trayIndex: awayIndex,
        ...(sizesDrawn ? { drawSizes: true } : {}),
        ruleName,
      });
    }
  }

  // ONE group is explained per challenge. Asking every tray in turn with one menu lets the last ask be answered by
  // elimination ("first group: Need" makes the second "Want"), so the asked tray rotates across challenges instead:
  // the misplaced card's tray when there is one, else the challenge's place in the session.
  const ordinal = Math.max(0, (parseInt(ch.id.replace(/\D+/g, ''), 10) || 1) - 1);
  const order = [awayIndex >= 0 ? awayIndex : ordinal % trueTrays.length];
  for (const index of order) {
    const tray = trueTrays[index];
    const credited = rulesOfGroup(page, tray.members.map((o) => o.id));
    const own = credited.find((r) => r.axis === ruleName);
    if (!own) continue;
    const answer = cats[index].label;
    const others = credited.filter((r) => r !== own).map((r) => capitalize(r.value)).filter(isSayableLabel);
    const creditedWords = new Set([answer, ...others].map((w) => w.toLowerCase()));
    // A card whose own name says the rule ("Red Apple" in the red group) answers by reading or by ear.
    if (tray.members.some((o) => Array.from(creditedWords).some((w) => containsPhrase(o.label, w)))) continue;
    // Real wrong rules, never a value every card here has: the other groups' rules, and what only SOME cards here are.
    const otherTrays = cats.filter((_, i) => i !== index).map((c) => c.label);
    const partial = Array.from(new Set(tray.members.flatMap((o) => Object.entries(o.attributes)
      .filter(([axis, v]) => axis !== ruleName && !!sanitize(v)
        && tray.members.some((m) => valueOf(m, axis) !== sanitize(v).toLowerCase()))
      .map(([, v]) => capitalize(sanitize(v).toLowerCase())))));
    const distractors = [otherTrays[0], partial[0], partial[1], otherTrays[1]]
      .filter((d): d is string => !!d && isSayableLabel(d) && !creditedWords.has(d.toLowerCase()))
      .filter((d, i, all) => all.findIndex((x) => x.toLowerCase() === d.toLowerCase()) === i)
      .slice(0, 2);
    if (!distractors.length) continue;
    const choices = stableShuffle([answer, ...distractors], `${ch.id}:${index}`);
    if (!optionsEarSeparable(choices)) continue;
    items.push({
      ...base,
      id: `${ch.id}::rule-${index}`,
      kind: 'name_rule' as const,
      action: 'name_rule',
      responseClass: responseClassFor('name_rule'),
      stimulus: trayPosition(index),
      answer,
      ...(others.length ? { alsoAccept: others } : {}),
      choices,
      choiceEmojis: choices.map(() => ''),
      trayIndex: index,
      otherGroups: distractors.filter((d) => otherTrays.includes(d)),
      ...((ruleName === 'size' || choices.some((c) => SIZE_RANK[c.toLowerCase()] !== undefined)) && sizesDrawn ? { drawSizes: true } : {}),
      ruleName,
    });
  }
  // Only the kept explanations: a misfit with no explanation after it is half of PTRN001-02-G.
  if (items[0]?.kind === 'misfit' && items[1]?.trayIndex !== items[0].trayIndex) items.shift();
  return items.slice(0, MAX_ITEMS_PER_CHALLENGE);
}

/**
 * The activity's own check of a tap, on the kinds that take one (say-rule's choice chips and its cards). Null on
 * every other kind: those are said, and the tutor judges them.
 */
export function sortingStationTapCheck(item: SortingStationItem): (response: string) => boolean | null {
  const accepted = new Set([item.answer, ...(item.alsoAccept ?? [])].map((w) => w.trim().toLowerCase()));
  return (response) => (item.kind === 'name_rule' || item.kind === 'misfit'
    ? accepted.has(response.trim().toLowerCase()) : null);
}

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
    case 'name_rule':
      return item.namesChoices ? `${listPhrase(item.choices)}?` : '';
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
    case 'name_rule':
      return 'Why do these go together?';
    case 'misfit':
      return 'One card in it does not belong there. Which one?';
    default:
      return '';
  }
};

/** What the learner is asked on one item (the tutor's task). Never the answer, except inside a spoken menu. */
export const askFor = (item: SortingStationItem): string => {
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
    // The tray is pointed at by its place and its ring, never its name: on say-rule the name is the answer.
    case 'name_rule':
      return `Your turn. Look at the ${item.stimulus}, the one with the ring. ${questionFor(item)}`
        + (item.namesChoices ? ` ${choicesPhrase(item)}` : '');
    case 'misfit':
      return `Your turn. Look at the ${item.stimulus}, the one with the ring. ${questionFor(item)}`;
    default:
      return '';
  }
};


// ── The key the tutor judges against ───────────────────────────────────────

/** The key one item is judged against (`spokenKeyText` writes its sentence). A sort, rule or compare ask says its
 *  options aloud, so its key is that menu. */
export function sortingStationKey(item: SortingStationItem): SpokenKey {
  const menu = item.namesChoices && item.choices.length ? { menu: item.choices } : {};
  switch (item.kind) {
    case 'sort':
      return { answer: item.answer, alsoAccept: [], ...menu,
        acceptRule: `The group with or without its little words ("the ${item.answer}", "it is a ${item.answer}") is the same answer.`,
        signatureError: `Saying "${item.stimulus}" back names the thing being sorted, not a group.` };
    case 'pick_rule':
      // Every way these cards really split is the child's to choose (`validSortAxes`); the sort follows it.
      return { answer: item.answer, alsoAccept: item.alsoAccept ?? [], ...menu,
        acceptRule: `"By ${item.answer}" or "their ${item.answer}" is the same answer${item.alsoAccept?.length
          ? `, and so is any of ${orList(item.alsoAccept)}: each is a real way to sort these cards, and the child may choose it` : ''}.`,
        signatureError: 'Describing one card is not a way to sort them all.' };
    case 'name_rule':
      return { answer: item.answer, alsoAccept: item.alsoAccept ?? [], ...menu,
        acceptRule: `"They are all ${item.answer}", "because they are all ${item.answer}" or "the ${item.answer} ones" is the same answer.`,
        signatureError: 'Naming one card, or a thing only some of these cards are, does not say why they all go together.' };
    case 'misfit':
      return { answer: item.answer, alsoAccept: [],
        acceptRule: 'Any clear way of naming that card ("the …", "that one, the …"), or a close everyday word for the same picture, counts.',
        signatureError: 'Saying the group is fine, or naming a card that belongs there, chooses no card.' };
    case 'odd_one':
      return { answer: item.answer, alsoAccept: [],
        acceptRule: 'Any clear way of naming that card ("the …", "that one, the …"), or a close everyday word for the same picture, counts.',
        signatureError: 'Saying what the others have in common, or that they all belong, chooses no card.' };
    case 'count_group':
      return { answer: item.answer, alsoAccept: item.answerValue != null ? [String(item.answerValue)] : [],
        acceptRule: 'Counting aloud that lands on the right total is right: only the number they finish on is their answer.',
        signatureError: 'A number one away is still wrong.' };
    case 'compare':
      return item.answer === 'the same'
        ? { answer: item.answer, alsoAccept: ['same', 'equal'], ...menu, acceptRule: '"They match" or "both the same" is the same answer.',
          signatureError: 'Naming either group is wrong: neither has more.' }
        : { answer: item.answer, alsoAccept: [], ...menu, acceptRule: `"${item.answer} has more" is the same answer.`,
          signatureError: 'Saying only "more" names no group.' };
    case 'both_criteria':
    default: {
      const c = item.criteria;
      return { answer: item.answer, alsoAccept: item.answer === 'yes' ? ['yeah', 'yep'] : ['nope'],
        acceptRule: 'Any natural yes or no counts ("it is", "it does not").',
        signatureError: c ? `Answering only one of the two ("it is a ${c.primary}") does not say whether it is also ${c.secondary}.`
          : 'Answering only one of the two things does not answer.' };
    }
  }
}

/** What the ask says by design: a count names the group it counts, whatever words its label holds. */
export const sortingStationGiven = (item: SortingStationItem): string[] =>
  item.kind === 'count_group' ? [item.stimulus] : [];

// ── Known misses (handoff 20 Part B) ───────────────────────────────────────

/** What a wrong spoken answer at the station shows. */
export type SpokenSortingMiss = OffByMiss | 'said_object' | 'other_group' | 'other_rule' | 'belonging_card' | 'said_all_belong'
  | 'said_same' | 'bare_more' | 'opposite_verdict' | 'one_criterion_only' | 'other_group_rule' | 'partial_rule' | 'said_card';

const list = (words: readonly string[], joiner: 'or' | 'and') => words.length < 2 ? words.join('')
  : `${words.slice(0, -1).join(', ')} ${joiner} ${words.at(-1)}`;
const orList = (words: readonly string[]) => list(words, 'or');
const andList = (words: readonly string[]) => list(words, 'and');

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer. Concrete per item:
 * the card, the printed groups or the counted group, never a cause.
 */
export function sortingStationSpokenMisses(item: SortingStationItem): KnownMiss[] {
  const others = item.choices.filter(c => c.toLowerCase() !== item.answer.toLowerCase());
  switch (item.kind) {
    case 'sort': {
      const fact = `The groups are ${andList(item.choices)}; ${item.stimulus} goes with ${item.answer}.`;
      return [
        { id: 'said_object', pattern: `${fact} The learner's answer is "${item.stimulus}", the name of the thing being sorted, not a group name.`, examples: [item.stimulus] },
        ...(others.length ? [{ id: 'other_group', pattern: `${fact} The learner's answer is ${orList(others)}, another group.`, examples: others.slice(0, 2) }] : []),
      ];
    }
    case 'pick_rule': {
      // A miss is only a way these cards do not split by; every valid way is credited.
      const valid = new Set([item.answer, ...(item.alsoAccept ?? [])].map(w => w.toLowerCase()));
      const invalid = item.choices.filter(c => !valid.has(c.toLowerCase()));
      return invalid.length ? [{ id: 'other_rule', pattern: `These cards can be sorted by ${orList([item.answer, ...(item.alsoAccept ?? [])])}. `
        + `The learner's answer is ${orList(invalid)}, a way these cards do not split into groups.`, examples: invalid.slice(0, 2) }] : [];
    }
    case 'name_rule': {
      const fact = `In the ${item.stimulus} with the ring, the cards go together because they are all ${item.answer}.`;
      const groups = item.otherGroups ?? [];
      const partial = item.choices.filter(c => c.toLowerCase() !== item.answer.toLowerCase() && !groups.includes(c));
      return [
        ...(groups.length ? [{ id: 'other_group_rule', pattern: `${fact} The learner's answer is ${orList(groups)}, the rule of another group.`,
          examples: groups.slice(0, 2) }] : []),
        { id: 'partial_rule', pattern: `${fact} The learner names something only some of these cards are${partial.length ? ` (such as ${orList(partial)})` : ''}, `
          + 'or something the cards in the other groups are too.', examples: partial.length ? partial.slice(0, 2) : ['some of them'] },
        { id: 'said_card', pattern: `${fact} The learner names one card instead of what they all are.`, examples: ['the apple'] },
      ];
    }
    case 'misfit': {
      const fact = `The cards in the ${item.stimulus} with the ring are ${andList(item.choices)}; ${item.answer} does not belong there.`;
      return [
        ...(others.length ? [{ id: 'belonging_card', pattern: `${fact} The learner's answer is ${orList(others)}, a card that belongs there.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_all_belong', pattern: `${fact} The learner says they all belong and names no card.`, examples: ['they all go there'] },
      ];
    }
    case 'odd_one': {
      const fact = `The cards are ${andList(item.choices)}; ${item.answer} is the one that does not belong.`;
      return [
        ...(others.length ? [{ id: 'belonging_card', pattern: `${fact} The learner's answer is ${orList(others)}, a card that belongs with the others.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_all_belong', pattern: `${fact} The learner says they all belong together and names no card.`, examples: ['they all go together'] },
      ];
    }
    case 'count_group':
      return item.answerValue ? offByMisses(item.answerValue, `the ${item.answerValue} things in the ${item.stimulus} group`) : [];
    case 'compare': {
      const labels = item.choices.filter(c => c !== 'the same');
      const other = labels.filter(l => l.toLowerCase() !== item.answer.toLowerCase());
      const fact = item.answer === 'the same' ? `The ${andList(labels)} groups have the same number.` : `The ${item.answer} group has more.`;
      return [
        ...(other.length ? [{ id: 'other_group', pattern: `${fact} The learner's answer is ${orList(other)}, ${item.answer === 'the same' ? 'one group' : 'the group with fewer'}.`,
          examples: other.slice(0, 2) }] : []),
        ...(item.answer !== 'the same' ? [{ id: 'said_same', pattern: `${fact} The learner's answer is that the groups are the same.`, examples: ['the same'] }] : []),
        { id: 'bare_more', pattern: `${fact} The learner says only "more" and names no group.`, examples: ['more'] },
      ];
    }
    case 'both_criteria': {
      const c = item.criteria;
      if (!c) return [];
      const fact = item.answer === 'yes' ? `${item.stimulus} is a ${c.primary} and is ${c.secondary}, so the answer is yes.`
        : `${item.stimulus} is not both a ${c.primary} and ${c.secondary}, so the answer is no.`;
      const wrong = item.answer === 'yes' ? 'no' : 'yes';
      return [
        { id: 'opposite_verdict', pattern: `${fact} The learner says "${wrong}" instead of ${item.answer}.`, examples: [wrong] },
        { id: 'one_criterion_only', pattern: `${fact} The learner says only that it is a ${c.primary} (or only whether it is ${c.secondary}), `
          + 'with no yes or no about both.', examples: [`it is a ${c.primary}`] },
      ];
    }
    default: return [];
  }
}

// ── The scene ──────────────────────────────────────────────────────────────

/** What is drawn and asked for one item. No count beside a spoken count: the counts are hidden until credited
 *  (the card's `special` says so once for every item). */
export function workspaceScene(item: SortingStationItem): SceneOf {
  return {
    objects: [],
    facts: {
      kind: item.kind,
      // The card or group the ask is about; on odd_one, a description of the whole set.
      about: item.stimulus,
      ...(item.choices.length ? { options: item.choices.join(', ') } : {}),
      // On pick_rule and name_rule the sorting rule is the answer.
      ...(item.ruleName && item.kind !== 'pick_rule' && item.kind !== 'name_rule' ? { sortingBy: item.ruleName } : {}),
      ...(item.drawSizes ? { cardsDrawn: 'at their sizes' } : {}),
      ...(item.kind === 'name_rule' || item.kind === 'misfit' ? { trayLabels: 'hidden', respond: 'say it, or tap it on screen' } : {}),
      ...(item.hidesCounts ? { countsShown: 'no' } : {}),
    },
  };
}

// ── Harness answer material ────────────────────────────────────────────────

/** What a headless learner says on a journey: the key's own words, or a plainly different answer of the same kind. */
export const sortingStationHarnessAnswers = (item: SortingStationItem): { correct: string; plainWrong: string } => {
  const other = item.choices.find(c => c.toLowerCase() !== item.answer.toLowerCase());
  switch (item.kind) {
    case 'count_group': {
      const value = item.answerValue ?? 2;
      const off = value > MIN_COUNT ? value - 1 : value + 1;
      return { correct: item.answer, plainWrong: numberWordFor(Math.min(MAX_COUNT, Math.max(MIN_COUNT, off + 3))) };
    }
    case 'both_criteria':
      return { correct: item.answer, plainWrong: item.answer === 'yes' ? 'no' : 'yes' };
    case 'compare':
      return { correct: item.answer, plainWrong: other ?? 'the same' };
    case 'pick_rule': {
      // Another valid way is credited, so the plainly wrong answer is a way these cards do not split by.
      const valid = new Set([item.answer, ...(item.alsoAccept ?? [])].map(w => w.toLowerCase()));
      return { correct: item.answer, plainWrong: item.choices.find(c => !valid.has(c.toLowerCase())) ?? 'the first one' };
    }
    default:
      return { correct: item.answer, plainWrong: other ?? 'something else' };
  }
};
