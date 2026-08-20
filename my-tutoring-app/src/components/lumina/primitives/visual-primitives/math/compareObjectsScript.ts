/**
 * compareObjectsScript — HAND-AUTHORED judged-loop script for compare-objects
 * (qa/di/BACKLOG.md item 18 P4, the FOURTH math port after ten-frame,
 * addition-subtraction-scene and number-bond). The exact wording IS the
 * pedagogy — these lines are authored per pack, never generated. Item CONTENT
 * (which objects, which attribute, how many units) is generator-scoped; this
 * module owns the cue shapes, the build gates and the in-band judging
 * contracts.
 *
 * ── WHY THIS PRIMITIVE, AND WHY IT IS THE PUREST DI CASE IN MATH ────────────
 *
 * K.MD.1 is *"describe measurable attributes of objects"* — a SPEAKING
 * standard. The shipped surface answered it with four attribute chips, two
 * object buttons, a tap-in-order row and a numeric keypad, under a Check
 * button. The catalog's own scaffolding rung said *"Point to it!"*. At a table
 * a teacher holds up a pencil and a crayon and asks which is longer, and the
 * child SAYS "the pencil" — there is no menu of cards in that picture.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ─────────────────────────────────
 *
 *   identify_attribute (K + 1) → SPOKEN attribute   short_spoken_word (benched)
 *   compare_two        (K + 1) → SPOKEN object name short_spoken_word (benched)
 *   order_three        (1)     → ARRANGED objects   manipulation      (benched)
 *   non_standard       (1)     → SPOKEN count       number_word_to_20 (benched)
 *
 * Three spoken, one placement — and NO new response class, which is why this
 * port ships on the standing rule (machine gates + live generation probe +
 * a `--di` drive) rather than owing a bench sitting. Nothing here touches the
 * #63 multi-word-numeral gate either: the only number the child ever says is a
 * unit count, floored at 1 and ceilinged at 20 by `isSayableUnitCount`.
 *
 * WHY THREE MODES SPEAK. Costume test — can a child who cannot do the skill
 * still perform this action correctly?
 *   - `identify_attribute`: yes, trivially — four chips, one tap, 1-in-3 by
 *     guessing, and the vocabulary the standard is ABOUT never leaves the
 *     child's mouth. The chips are the costume.
 *   - `compare_two`: yes — two buttons is a coin flip. The two object buttons
 *     are the costume, and they are the shape the user has now struck down
 *     three times (rhyme-studio 👍/👎, letter-spotter tiles, decodable-reader
 *     cards).
 *   - `non_standard`: yes — a numeric keypad is operable without counting
 *     anything, and the keypad also let a child brute-force the small range.
 *
 * WHY ORDERING KEPT ITS HANDS. `order_three` is the third unsayable shape: the
 * ARRANGEMENT is the answer. Reciting three names in order is a different
 * (harder, memory-loaded) task, and at the table the child physically moves
 * the objects. The screen IS that page — honest work, not a concession the
 * judge extracted. Precedent: number-bond `decompose`, ten-frame `build`.
 *
 * ── THE §2 SCRIPT QUESTIONS, ANSWERED HERE ──────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? For all three spoken modes, yes — a model would
 *    say the attribute, the winning name, or the count. Nothing is modeled
 *    before the ask. The comparison STRATEGY (line them up at one end; watch
 *    which side of the scale drops) is the thing worth modeling, and it is
 *    earned in the CORRECTION, which is where DISTAR puts it.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? The screen is a picture with names
 *    printed beside it, and a K child cannot read them — so EVERY ask names
 *    its objects aloud, and every correction re-ask inherits them.
 *
 * 3. THE SIGNATURE ERRORS, per mode — the fluent, confident miss:
 *    - compare_two: the DIRECTION REVERSAL. Asked which is *shorter*, the
 *      child names the longer one, quickly and with certainty. It is the
 *      canonical K measurement error and it is what `discriminationFor`
 *      claims the judge refuses.
 *    - non_standard: the OFF-BY-ONE — counting the object's starting edge as
 *      a unit, so the answer comes back one too many.
 *    - identify_attribute: another attribute that is genuinely TRUE of the
 *      objects but is not the one the picture is drawn to show.
 *
 * ── ⭐ WRITING THE SPOKEN ASK AUDITED THE CONTENT — FOUR FINDINGS ───────────
 *
 * (1) `identify_attribute` IS AMBIGUOUS BY CONSTRUCTION unless the ask names
 *     the closed set. Any two physical objects can be compared by length AND
 *     by weight, so *"what can we measure about these?"* has several right
 *     answers and would be a BROKEN task, not a harder one. The ask therefore
 *     names the options (word-sorter's menu clause, `leakExemptSpan` over that
 *     clause and nothing else) and the picture supplies the discrimination —
 *     the component renders bars for length, a seesaw for weight, jars for
 *     capacity, so the drawn attribute IS knowable. Two gates follow from
 *     that and both DROP: `correctAttribute` must equal `attribute` (or the
 *     picture and the key disagree — the generator only ever checked that the
 *     key was *among the options*), and an option set containing BOTH `length`
 *     and `height` is not defensibly answerable for one drawing, so it goes.
 *
 * (2) `compare_two`'s PICTURE COULD CONTRADICT ITS OWN KEY. `visualSize` draws
 *     the bars and `actualValue` decides the answer, and only `order_three`
 *     ever reconciled the two. Under a Check button a child who named the
 *     visibly-longer object was simply "wrong"; spoken, the tutor refuses a
 *     child who is looking at the screen and reading it correctly.
 *     `visualRankAgrees` drops it, and the generator snaps the ranks on the
 *     same import (the repair `reconstructOrderThree` already did).
 *
 * (3) POSITION IN THE ASK MUST NOT PREDICT THE ANSWER. The click era rendered
 *     the two buttons in the model's emitted order, and nothing stopped a
 *     generator from listing the winner first every time — invisible when the
 *     answer is a tap on a labelled button, a learnable shortcut the moment
 *     the ask says the names aloud in that order. `askOrderFor` decides the
 *     spoken order from a hash of the item id, so the CONTENT owns it.
 *
 * (4) THE UNIT BOXES PRINT THE ANSWER. `renderNonStandardMeasure` numbers the
 *     boxes 1..n as a count-along aid, so the last box shows exactly the
 *     number the child is about to say aloud — ten-frame's running-counter
 *     defect, one primitive later, and a leak no string-scanning gate can see.
 *     The numbering is withheld until the tutor affirms (the component gates
 *     it on `revealHeld`); the count-along survives where it belongs, in the
 *     correction, where the tutor counts them with the child.
 *
 * ── CONTENT GATES (skill step 4) — KEEP OR DROP, NEVER BACKFILL ─────────────
 *
 * Every gate below is EXPORTED and the generator IMPORTS it, so there is one
 * predicate per rule on both sides of the wire (letter-spotter's two
 * hand-synced copies disagreeing live is the reason). Nothing is repaired into
 * askability: an unanswerable comparison is dropped, never softened.
 *
 * Nothing generated is spoken by this pack except OBJECT NAMES and UNIT NAMES,
 * so those two are the pack's generated-content surface: `isSayableName`
 * bounds them and the test file's sentinel scan runs over live-drawn packs
 * through `checkPackGates`.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * `checkPackGates` in this pack's test file over every cue it can emit.
 */

import type {
  JudgedScriptItem,
  ResponseClassId,
  JudgedCueSurface,
} from '../../../hooks/judgedScriptContract';
import { numberWordFor } from './countingBoardScript';
import {
  isSayableName,
  namesEarSeparable,
  nameCarriesAny,
  MEASURE_ADJECTIVES,
} from './spokenNameGates';

// ============================================================================
// Domain vocabulary
// ============================================================================

export type CompareObjectsKind =
  | 'identify_attribute'
  | 'compare_two'
  | 'order_three'
  | 'non_standard';

export type CompareBand = 'K' | '1';

export type MeasurableAttribute = 'length' | 'height' | 'weight' | 'capacity';

export type ComparisonWord =
  | 'longer' | 'shorter'
  | 'taller' | 'shorter_height'
  | 'heavier' | 'lighter'
  | 'holds_more' | 'holds_less';

export const VALID_ATTRIBUTES: readonly MeasurableAttribute[] =
  ['length', 'height', 'weight', 'capacity'];

export const COMPARISON_WORDS: readonly ComparisonWord[] =
  ['longer', 'shorter', 'taller', 'shorter_height', 'heavier', 'lighter', 'holds_more', 'holds_less'];

/** Which comparison words belong to which attribute. A `heavier` ask over a
 *  LENGTH drawing is an ask about a picture that is not on the screen — the
 *  tap era never had to justify the pairing because the buttons said only the
 *  object names. */
const ATTRIBUTE_OF_WORD: Record<ComparisonWord, MeasurableAttribute> = {
  longer: 'length',
  shorter: 'length',
  taller: 'height',
  shorter_height: 'height',
  heavier: 'weight',
  lighter: 'weight',
  holds_more: 'capacity',
  holds_less: 'capacity',
};

/** Words whose winner is the object with the LARGER measurement. */
const GREATER_WORDS: readonly ComparisonWord[] = ['longer', 'taller', 'heavier', 'holds_more'];

export const isGreaterComparison = (word: ComparisonWord): boolean =>
  GREATER_WORDS.includes(word);

/** How the tutor SAYS a comparison word. `shorter_height` is an internal
 *  distinction (short in height vs short in length); a child hears "shorter"
 *  either way, and the drawing carries the rest. */
const COMPARISON_SPOKEN: Record<ComparisonWord, string> = {
  longer: 'longer',
  shorter: 'shorter',
  taller: 'taller',
  shorter_height: 'shorter',
  heavier: 'heavier',
  lighter: 'lighter',
  holds_more: 'holds more',
  holds_less: 'holds less',
};

export const spokenComparison = (word: ComparisonWord): string => COMPARISON_SPOKEN[word];

/**
 * The full spoken PREDICATE — "is longer", "holds more". Six of the eight
 * comparison words are adjectives needing a copula and two are already verbs,
 * so a bare word substituted into "Which one ___?" produces "Which one longer?"
 * for six of them. Split from `spokenComparison`, which stays the bare word
 * because the judging contract quotes what the child HEARS ("a learner who
 * hears 'longer'…").
 */
const comparisonPredicate = (word: ComparisonWord): string =>
  word === 'holds_more' || word === 'holds_less'
    ? COMPARISON_SPOKEN[word]
    : `is ${COMPARISON_SPOKEN[word]}`;

/**
 * The ordering endpoints, in TWO grammatical shapes because one string cannot
 * fill both frames: `short` goes in "from longest to shortest" and `phrase`
 * goes in "find the longest one first". Capacity is why — "find the holds the
 * most one first" is not a sentence, and the click era never had to say either
 * of these out loud.
 */
const ORDER_ENDPOINTS: Record<
  MeasurableAttribute,
  { low: string; high: string; lowPhrase: string; highPhrase: string }
> = {
  length: { low: 'shortest', high: 'longest', lowPhrase: 'the shortest one', highPhrase: 'the longest one' },
  height: { low: 'shortest', high: 'tallest', lowPhrase: 'the shortest one', highPhrase: 'the tallest one' },
  weight: { low: 'lightest', high: 'heaviest', lowPhrase: 'the lightest one', highPhrase: 'the heaviest one' },
  capacity: {
    low: 'least', high: 'most',
    lowPhrase: 'the one that holds the least', highPhrase: 'the one that holds the most',
  },
};

/** "paper clip" → "paper clips", "cubes" → "cubes". The unit name is generated
 *  content and arrives in either number. */
const plural = (word: string): string =>
  /s$/i.test(word.trim()) ? word.trim() : `${word.trim()}s`;

/**
 * THE MENU, IN A CHILD'S WORDS. `identify_attribute` asks a five-year-old to
 * name a measurable attribute, and "capacity" is not a word a K child owns —
 * demanding it would fail children for vocabulary they are here to LEARN. So
 * the ask offers the child form and the AFFIRMATION teaches the formal noun as
 * the reward ("Yes, how long they are. That is called length."). DISTAR: the
 * new word arrives attached to something the child has already got right.
 */
const ATTRIBUTE_CHILD_FORM: Record<MeasurableAttribute, string> = {
  length: 'how long they are',
  height: 'how tall they are',
  weight: 'how heavy they are',
  capacity: 'how much they hold',
};

/** The ONE word that distinguishes each option by ear — the `closed_set_choice`
 *  ear-separability requirement applied to a spoken menu. */
const ATTRIBUTE_KEY_WORD: Record<MeasurableAttribute, string> = {
  length: 'long',
  height: 'tall',
  weight: 'heavy',
  capacity: 'hold',
};

/** The comparison STRATEGY the correction models — per attribute, because
 *  "line them up at one end" is nonsense for a scale. This is the pedagogy the
 *  hint strings used to carry as improvised tutor prose. */
const COMPARISON_STRATEGY: Record<MeasurableAttribute, string> = {
  length: 'line them up at one end and look at the other end',
  height: 'stand them side by side and look at the tops',
  weight: 'look at which side of the scale sinks down',
  capacity: 'look at which one is filled up higher',
};

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const int = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** Deterministic, stable across renders and across the wire — the harness and
 *  the component must agree on which object the ask names first. */
const hashOf = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// ============================================================================
// Sayability + content gates — EXPORTED, and imported by the generator
// ============================================================================

/** The benched spoken-number window for the unit count. Zero is excluded by
 *  the class record itself; 20 is the benched ceiling (#63 is the gate above
 *  it, and this primitive never reaches it). */
export const UNIT_COUNT_MIN = 1;
export const UNIT_COUNT_MAX = 20;

export const isSayableUnitCount = (n: unknown): n is number =>
  int(n) && n >= UNIT_COUNT_MIN && n <= UNIT_COUNT_MAX;

/**
 * THE NAME GATES LIVE IN `spokenNameGates.ts` NOW (ordinal-line port, open
 * decision 2). They are re-exported here rather than moved away, so this
 * module's public API, its generator's imports and its test file are unchanged
 * — one definition, two import paths, no drift. `nameCarriesTheAnswer` is the
 * generalised `nameCarriesAny` bound to this pack's own vocabulary; the SCAN is
 * shared because defect class 11 has the same shape in every math pack, and only
 * the word list is per-primitive.
 */
export {
  isSayableName,
  namesEarSeparable,
  MEASURE_ADJECTIVES,
} from './spokenNameGates';

export const nameCarriesTheAnswer = (name: string): boolean =>
  nameCarriesAny(name, MEASURE_ADJECTIVES);

/** The comparison word must be about the attribute the picture DRAWS. */
export const comparisonMatchesAttribute = (
  attribute: MeasurableAttribute,
  word: ComparisonWord,
): boolean => ATTRIBUTE_OF_WORD[word] === attribute;

export interface MeasuredObject {
  name: string;
  visualSize: number;
  actualValue: number;
}

/**
 * The DRAWING must rank the objects the same way the KEY does. `visualSize`
 * paints the bars and `actualValue` decides the answer; where they disagree
 * the tutor refuses a child who read the screen correctly. Ties in either
 * dimension fail — a picture with no visible difference cannot be compared.
 */
export const visualRankAgrees = (objects: readonly MeasuredObject[]): boolean => {
  if (objects.length < 2) return true;
  const values = objects.map((o) => o.actualValue);
  const sizes = objects.map((o) => o.visualSize);
  if (new Set(values).size !== values.length) return false;
  if (new Set(sizes).size !== sizes.length) return false;
  const byValue = [...objects].sort((a, b) => a.actualValue - b.actualValue).map((o) => o.name);
  const bySize = [...objects].sort((a, b) => a.visualSize - b.visualSize).map((o) => o.name);
  return byValue.every((name, i) => name === bySize[i]);
};

/**
 * The attribute options, gated for a SPOKEN menu:
 *   - every option is one of the four real attributes (the generator emits
 *     them as free text, so "size" and "bigness" both reach here);
 *   - the correct one is present, and there is at least one distractor;
 *   - `length` and `height` never appear together — one drawing cannot
 *     defensibly be about only one of them, and an ambiguous ask is a broken
 *     task, not a harder one.
 */
export const askableAttributeOptions = (
  options: readonly unknown[] | undefined,
  correct: MeasurableAttribute,
): MeasurableAttribute[] | null => {
  const valid = (options ?? []).filter(
    (o): o is MeasurableAttribute => VALID_ATTRIBUTES.includes(o as MeasurableAttribute),
  );
  const unique = Array.from(new Set(valid));
  if (!unique.includes(correct)) return null;
  if (unique.length < 2) return null;
  if (unique.includes('length') && unique.includes('height')) return null;
  return unique;
};

// ============================================================================
// Answer material — the fork, as code
// ============================================================================

export const answerKindFor = (kind: CompareObjectsKind): 'voice' | 'gesture' =>
  kind === 'order_three' ? 'gesture' : 'voice';

export const responseClassFor = (kind: CompareObjectsKind): ResponseClassId => {
  switch (kind) {
    case 'order_three': return 'manipulation';
    case 'non_standard': return 'number_word_to_20';
    default: return 'short_spoken_word';
  }
};

/** Task identity for the runner's how-to-play policy: when consecutive items
 *  change `action`, the next cue re-speaks what to do. */
export const actionFor = (kind: CompareObjectsKind): string => {
  switch (kind) {
    case 'identify_attribute': return 'name-attribute';
    case 'compare_two': return 'name-object';
    case 'order_three': return 'arrange';
    case 'non_standard': return 'count-units';
  }
};

export interface CompareObjectsItem extends JudgedScriptItem {
  kind: CompareObjectsKind;
  band: CompareBand;
  attribute: MeasurableAttribute;
  /** The comparison direction. Carried on every item so the stage and the
   *  verdict lines read from one field; unused by identify_attribute. */
  comparisonWord: ComparisonWord;
  /** Object names in SCREEN order (what the component draws). */
  objectNames: string[];
  /** The order the ASK names them in — hash-decided, never the generator's,
   *  so position cannot predict the answer (finding 3). */
  askOrder: string[];
  /** compare_two: the winning name. order_three: the full correct order. */
  answerNames: string[];
  /** identify_attribute: the spoken menu, in ask order. */
  attributeOptions: MeasurableAttribute[];
  /** non_standard */
  unitName: string;
  unitCount: number;
}

// ============================================================================
// Build gates — DROP an unaskable item, never repair it into one
// ============================================================================

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface CompareObjectsChallengeLike {
  id: string;
  type: string;
  attribute?: string;
  comparisonWord?: string;
  correctAnswer?: string;
  correctAttribute?: string;
  attributeOptions?: string[];
  objects?: MeasuredObject[];
  unitName?: string;
  unitCount?: number;
}

export interface CompareBuildContext {
  band: CompareBand;
}

const KINDS: readonly CompareObjectsKind[] =
  ['identify_attribute', 'compare_two', 'order_three', 'non_standard'];

/** K compares two objects directly; ordering three and non-standard units are
 *  the Grade 1 rungs (the catalog's own band split, enforced in code). */
const K_KINDS: readonly CompareObjectsKind[] = ['identify_attribute', 'compare_two'];

/** The ask names the pair in an order the CONTENT decides. */
const askOrderFor = (id: string, names: readonly string[]): string[] =>
  hashOf(id) % 2 === 0 ? [...names] : [...names].reverse();

const objectsOf = (ch: CompareObjectsChallengeLike): MeasuredObject[] =>
  (ch.objects ?? []).filter(
    (o): o is MeasuredObject =>
      !!o
      && isSayableName(o.name)
      && typeof o.visualSize === 'number' && Number.isFinite(o.visualSize)
      && typeof o.actualValue === 'number' && Number.isFinite(o.actualValue),
  ).map((o) => ({ ...o, name: o.name.trim() }));

/**
 * One generated challenge → its judged item, or `null` when it cannot be asked
 * honestly. Every rejection is a CONTENT fault the spoken ask exposed:
 *   - a mode outside the band, or an unknown type;
 *   - names the tutor cannot say, or a pair that is not separable by ear;
 *   - a comparison word that is not about the drawn attribute;
 *   - a key that disagrees with the measurements, or a drawing that disagrees
 *     with the key;
 *   - an attribute menu that is not defensibly answerable;
 *   - a unit count outside the benched spoken window.
 * Nothing is backfilled: a placeholder here becomes a spoken ask the tutor has
 * to judge.
 */
export const itemFromChallenge = (
  ch: CompareObjectsChallengeLike,
  ctx: CompareBuildContext,
): CompareObjectsItem | null => {
  const kind = KINDS.find((k) => k === ch.type);
  if (!kind) return null;
  if (ctx.band === 'K' && !K_KINDS.includes(kind)) return null;

  const attribute = VALID_ATTRIBUTES.find((a) => a === ch.attribute);
  if (!attribute) return null;

  const objects = objectsOf(ch);
  const names = objects.map((o) => o.name);
  if (!namesEarSeparable(names)) return null;
  // The three COMPARISON modes all have an answer a measure adjective can give
  // away — the magnitude for compare-two/order-three, the attribute itself for
  // identify-attribute ("heavy backpack" says "weight" out loud).
  if (kind !== 'non_standard' && names.some(nameCarriesTheAnswer)) return null;

  const base = {
    id: ch.id,
    band: ctx.band,
    attribute,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind),
    action: actionFor(kind),
    objectNames: names,
    unitName: '',
    unitCount: 0,
    attributeOptions: [] as MeasurableAttribute[],
  };

  if (kind === 'non_standard') {
    if (objects.length !== 1) return null;
    if (!isSayableName(ch.unitName)) return null;
    if (!isSayableUnitCount(ch.unitCount)) return null;
    return {
      ...base,
      kind,
      comparisonWord: 'longer',
      askOrder: names,
      answerNames: [],
      unitName: ch.unitName.trim(),
      unitCount: ch.unitCount,
    };
  }

  if (kind === 'identify_attribute') {
    if (objects.length !== 2) return null;
    // The picture is drawn from `attribute`; a key that names anything else is
    // an answer to a question the screen is not asking.
    const correct = VALID_ATTRIBUTES.find((a) => a === ch.correctAttribute);
    if (!correct || correct !== attribute) return null;
    const options = askableAttributeOptions(ch.attributeOptions, correct);
    if (!options) return null;
    // The menu order is code-decided too — a correct answer that is always
    // spoken last is a position the child can learn.
    const rotation = hashOf(ch.id) % options.length;
    const asked = [...options.slice(rotation), ...options.slice(0, rotation)];
    return {
      ...base,
      kind,
      comparisonWord: 'longer',
      askOrder: askOrderFor(ch.id, names),
      answerNames: [],
      attributeOptions: asked,
    };
  }

  const word = COMPARISON_WORDS.find((w) => w === ch.comparisonWord);
  if (!word || !comparisonMatchesAttribute(attribute, word)) return null;
  if (!visualRankAgrees(objects)) return null;

  if (kind === 'compare_two') {
    if (objects.length !== 2) return null;
    const winner = objects.find((o) => o.name === (ch.correctAnswer ?? '').trim());
    const loser = objects.find((o) => o.name !== winner?.name);
    if (!winner || !loser) return null;
    // The key must agree with the measurements AND with the direction. The
    // generator checks this on its own side; a cached challenge does not.
    const shouldWin = isGreaterComparison(word)
      ? winner.actualValue > loser.actualValue
      : winner.actualValue < loser.actualValue;
    if (!shouldWin) return null;
    return {
      ...base,
      kind,
      comparisonWord: word,
      askOrder: askOrderFor(ch.id, names),
      answerNames: [winner.name],
    };
  }

  // order_three
  if (objects.length !== 3) return null;
  const declared = (ch.correctAnswer ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (declared.length !== 3) return null;
  if (!declared.every((name) => names.includes(name))) return null;
  const expected = [...objects]
    .sort((a, b) => (isGreaterComparison(word)
      ? b.actualValue - a.actualValue
      : a.actualValue - b.actualValue))
    .map((o) => o.name);
  if (!declared.every((name, i) => name === expected[i])) return null;
  // A board already sitting in the answer order is not an ordering task.
  if (names.every((name, i) => name === expected[i])) return null;
  return {
    ...base,
    kind,
    comparisonWord: word,
    askOrder: names,
    answerNames: expected,
  };
};

/**
 * The whole session's items.
 *
 * DEDUP IS SESSION-WIDE, NOT CONSECUTIVE (defect class 2). Every item closes by
 * NAMING its answer aloud, so a second ask over the same objects and the same
 * attribute is recall, not measurement — and on `compare_two` the key ignores
 * the DIRECTION deliberately: having heard "the jump rope is longer", the child
 * gets "which is shorter?" over the same pair for free. That half of the class
 * bites here; the OTHER half (an answered thing may not return as a wrong
 * choice) does NOT, and the reason is worth recording so a later session does
 * not add a gate for it: the answer is a RELATION between a pair, not a
 * property of an object, so "the pencil is longer than the crayon" tells a
 * child nothing about the pencil against a ruler.
 */
export const buildCompareItems = (
  challenges: readonly CompareObjectsChallengeLike[],
  ctx: CompareBuildContext,
): { items: CompareObjectsItem[]; droppedChallenges: number } => {
  const items: CompareObjectsItem[] = [];
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  let dropped = 0;
  for (const ch of challenges ?? []) {
    if (!ch?.id || seenIds.has(ch.id)) { dropped++; continue; }
    const item = itemFromChallenge(ch, ctx);
    if (!item) { dropped++; continue; }
    const contentKey = item.kind === 'non_standard'
      ? `non_standard|${item.objectNames[0]}|${item.unitName}`
      : `${item.kind}|${item.attribute}|${[...item.objectNames].sort().join('|')}`;
    if (seenContent.has(contentKey)) { dropped++; continue; }
    seenIds.add(ch.id);
    seenContent.add(contentKey);
    items.push(item);
  }
  return { items, droppedChallenges: dropped };
};

// ============================================================================
// The spoken surface
// ============================================================================

/**
 * Two joiners, because the two frames are different sentences and only one of
 * them is a choice. `namedList` LISTS the board ("the daisy, the tulip and the
 * sunflower" — everything on screen gets ordered); `namedChoice` OFFERS it
 * ("the shoelace or the jump rope" — pick one). Splitting them is not
 * pedantry: "Which one is longer — the shoelace AND the jump rope?" is what
 * the first draft said out loud, and it asks the child for both.
 */
const joinNames = (names: readonly string[], conjunction: 'and' | 'or'): string => {
  const withArticles = names.map((n) => `the ${n}`);
  if (withArticles.length <= 1) return withArticles[0] ?? '';
  return `${withArticles.slice(0, -1).join(', ')} ${conjunction} ${withArticles[withArticles.length - 1]}`;
};

const namedList = (names: readonly string[]): string => joinNames(names, 'and');
const namedChoice = (names: readonly string[]): string => joinNames(names, 'or');

/** The spoken menu clause — "how long they are, how heavy they are, or how
 *  much they hold". */
const optionMenu = (options: readonly MeasurableAttribute[]): string => {
  const forms = options.map((a) => ATTRIBUTE_CHILD_FORM[a]);
  if (forms.length <= 1) return forms[0] ?? '';
  return `${forms.slice(0, -1).join(', ')}, or ${forms[forms.length - 1]}`;
};

/**
 * How-to-play — spoken on the OPENER and whenever the ACTION changes, never
 * per item. The `leadInFor` ladder every pack copies speaks per item and
 * therefore recites; DISTAR fades the model rather than re-reading it.
 */
export const howToPlayFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute':
      return 'Look at the picture, then say what we can measure. ';
    case 'compare_two':
      return 'Look at both things, then say the name of the one I ask for. ';
    case 'order_three':
      return 'Touch the pictures one at a time to put them in order. When you stop, I will look at your order. ';
    case 'non_standard':
      return 'Count the units along the object, then say the number out loud. ';
  }
};

/**
 * The ask — code-owned at every band, and it STATES ITS PROBLEM ALOUD because
 * a pre-reader cannot read the names printed beside the drawing. Every ask
 * names its objects, which is also what keeps consecutive same-mode asks from
 * being byte-identical recitation (`findRepeatedConsecutiveAsks`).
 */
export const askFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute':
      return `Look at ${namedList(item.askOrder)}. `
        + `Is the picture showing us ${optionMenu(item.attributeOptions)}? Say it out loud.`;
    case 'compare_two':
      return `Which one ${comparisonPredicate(item.comparisonWord)} — `
        + `${namedChoice(item.askOrder)}? Say its name.`;
    case 'order_three': {
      const ends = ORDER_ENDPOINTS[item.attribute];
      const forward = isGreaterComparison(item.comparisonWord);
      return `Put ${namedList(item.askOrder)} in order, `
        + `from ${forward ? ends.high : ends.low} to ${forward ? ends.low : ends.high}. `
        + `Touch them one at a time.`;
    }
    case 'non_standard':
      return `How many ${plural(item.unitName)} long is the ${item.objectNames[0]}? `
        + `Count them, then say the number.`;
  }
};

/** The span of the ask inside which the answer may legitimately appear: the
 *  MENU clause, and nothing else. `compare_two` and `identify_attribute` are
 *  closed-set asks — the options have to be named or the question cannot be
 *  answered — so the leak scan subtracts exactly that clause and still treats
 *  an answer in the greeting, the how-to-play or the hand-over as a leak. */
export const leakExemptSpanFor = (item: CompareObjectsItem): string | undefined => {
  switch (item.kind) {
    case 'identify_attribute':
      return `Is the picture showing us ${optionMenu(item.attributeOptions)}?`;
    case 'compare_two':
      return `${namedChoice(item.askOrder)}?`;
    default:
      return undefined;
  }
};

// ── Verdict lines ───────────────────────────────────────────────────────────

const affirmFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute':
      return `Yes, ${ATTRIBUTE_CHILD_FORM[item.attribute]}. That is called ${item.attribute}.`;
    case 'compare_two':
      return `Yes, the ${item.answerNames[0]} ${comparisonPredicate(item.comparisonWord)}.`;
    default:
      return `Yes, ${numberWordFor(item.unitCount)}. `
        + `The ${item.objectNames[0]} is ${numberWordFor(item.unitCount)} ${plural(item.unitName)} long.`;
  }
};

/** The counted walk the non-standard correction models — the count-along that
 *  used to be printed on the unit boxes, moved to where it is earned. */
const unitWalk = (n: number): string =>
  Array.from({ length: n }, (_, i) => numberWordFor(i + 1)).join(', ');

/** Standing gate 3: open "My turn:", re-model, then re-elicit. The re-ask
 *  inherits the whole problem, because the child cannot read it. */
const correctionFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute':
      return `My turn: look at the picture again — it shows us ${ATTRIBUTE_CHILD_FORM[item.attribute]}. `
        + `Your turn. Is the picture showing us ${optionMenu(item.attributeOptions)}?`;
    case 'compare_two':
      return `My turn: ${COMPARISON_STRATEGY[item.attribute]} — `
        + `the ${item.answerNames[0]} ${comparisonPredicate(item.comparisonWord)}. `
        + `Your turn. Which one ${comparisonPredicate(item.comparisonWord)} — ${namedChoice(item.askOrder)}? Say its name.`;
    default:
      return `My turn: count them with me — ${unitWalk(item.unitCount)}. `
        + `That is ${numberWordFor(item.unitCount)} ${plural(item.unitName)}. `
        + `Your turn. How many ${plural(item.unitName)} long is the ${item.objectNames[0]}?`;
  }
};

/**
 * The refuse clause and the accept clause — both halves load-bearing. The
 * signature error per mode is the fluent, confident miss a tap surface used to
 * absorb silently.
 */
const discriminationFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute': {
      const wrong = item.attributeOptions.filter((a) => a !== item.attribute);
      return `The other choices — ${wrong.map((a) => `"${ATTRIBUTE_CHILD_FORM[a]}"`).join(' and ')} — `
        + `may be true of these objects in real life, but the picture is not drawn to show them, `
        + `so they are NOT the answer however reasonable they sound. `
        + `Accept the child's words ("${ATTRIBUTE_CHILD_FORM[item.attribute]}", or just "${ATTRIBUTE_KEY_WORD[item.attribute]}") `
        + `or the grown-up word "${item.attribute}" — both are right. `;
    }
    case 'compare_two': {
      const loser = item.objectNames.find((n) => n !== item.answerNames[0]) ?? '';
      return `"${loser}" is the confident wrong answer here: a learner who hears `
        + `"${spokenComparison(item.comparisonWord)}" and looks for the opposite says it quickly and surely. `
        + `Accept the name on its own, or any words that name ONLY the ${item.answerNames[0]}. `
        + `A pointing word with no name — "that one", "the first one" — does not answer this question, `
        + `so treat it as wrong and give the correction, which asks for the name again. `;
    }
    default: {
      const over = item.unitCount + 1;
      return `"${numberWordFor(over)}" is the confident wrong answer here — a learner who counts the `
        + `object's starting edge as a unit lands one too many and says it without hesitating. `
        + `Counting out loud is the learner working, not answering: judge the number they land on when `
        + `the counting stops, and "${numberWordFor(item.unitCount)} ${plural(item.unitName)}" counts as `
        + `"${numberWordFor(item.unitCount)}". `;
    }
  }
};

/**
 * ⚠️ THE WAIT IS DESCRIBED AS THE TUTOR'S STATE, NEVER AS AN IMPERATIVE — an
 * imperative aimed at the tutor gets PERFORMED (ten-frame voiced "[WAIT
 * silently]" to a child). `findPerformedStageDirections` keeps this structural.
 */
const judgingContract = (item: CompareObjectsItem): string => {
  const answer = item.kind === 'identify_attribute'
    ? ATTRIBUTE_CHILD_FORM[item.attribute]
    : item.kind === 'compare_two'
      ? item.answerNames[0]
      : numberWordFor(item.unitCount);
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
    + `looks and thinks, and their think time is unbounded. `
    + `Never say the answer during their turn and never compare the objects out loud for them. `
    + `The correct answer is "${answer}". `
    + discriminationFor(item)
    + `If the answer is right, say exactly: "${affirmFor(item)}" and stop there — `
    + `add no praise, no encouragement and no mention of what comes next. `
    + `If it is wrong, say exactly: "${correctionFor(item)}" and stop there; that correction is the whole turn, `
    + `and it is the SAME line on every wrong answer, including a repeat of the same wrong answer — `
    + `never paraphrase it, never soften it, and never replace it with a hint of your own.`;
};

/** The gesture contract is a SILENCE contract: nothing to judge until the
 *  commit is described, and the ordering is banned from the tutor's mouth for
 *  the whole item. */
const silenceContract = (item: CompareObjectsItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS on the `
  + `screen, not with their voice, so you then stay completely silent. `
  + `Never say which object goes first or last, never name ${ORDER_ENDPOINTS[item.attribute].highPhrase} `
  + `or ${ORDER_ENDPOINTS[item.attribute].lowPhrase}, and never read their order back as they touch. `
  + `Do not narrate what they are doing or fill the pause. `
  + `You will be told what order they made and whether it matches; only then do you speak.`;

/** Named at the end of every contract-carrying cue — it names the exact
 *  failure a drive produced rather than trusting a generic "don't read tags". */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const contractFor = (item: CompareObjectsItem): string =>
  item.answerKind === 'gesture' ? silenceContract(item) : judgingContract(item);

// ============================================================================
// Cues
// ============================================================================

export interface CompareCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line, never as a second catalog directive on the same turn). */
export const itemCue = (item: CompareObjectsItem, opts: CompareCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Time to measure and compare! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[CO_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contractFor(item)} ${NEVER_PERFORM}`;
};

/**
 * The ordering verdict — THE MATCH IS COMPUTED IN CODE against the ranked
 * measurements; the tutor is never asked to compare pixels. Not correctness-
 * gated anywhere upstream: an incomplete order and a reversed one both arrive
 * here and are corrected, which is what makes the item judgeable at all.
 *
 * The correction models the STRATEGY and never the answer — reading the right
 * order back and then asking for it again would not be a task.
 */
export const orderVerdictCue = (
  item: CompareObjectsItem,
  placed: readonly string[],
): string => {
  const ends = ORDER_ENDPOINTS[item.attribute];
  const forward = isGreaterComparison(item.comparisonWord);
  const firstShort = forward ? ends.high : ends.low;
  const lastShort = forward ? ends.low : ends.high;
  const firstPhrase = forward ? ends.highPhrase : ends.lowPhrase;
  const lastPhrase = forward ? ends.lowPhrase : ends.highPhrase;
  const complete = placed.length === item.answerNames.length;
  const matches = complete && placed.every((name, i) => name === item.answerNames[i]);
  const head =
    `[CO_ORDER] The learner put them in this order: ${placed.length ? placed.join(', ') : 'nothing'}; `
    + `the correct order is ${item.answerNames.join(', ')} — that ${matches ? 'MATCHES' : 'does NOT match'}. `;

  if (matches) {
    return `${head}Say exactly: "Yes! ${cap(firstShort)} to ${lastShort} — you put every one in the right place." `
      + `Never read bracket tags aloud.`;
  }
  // The correction models the STRATEGY, never the order — reading the right
  // order back and then asking for it again would not be a task.
  const line = !complete
    ? `My turn: every one gets a turn, from ${firstShort} to ${lastShort}. Your turn — touch all ${item.answerNames.length} in order.`
    : `My turn: find ${firstPhrase} first, then the next, then ${lastPhrase}. Your turn — put them in order again.`;
  return `${head}Say exactly: "${line}" Never read bracket tags aloud.`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: CompareObjectsItem,
  next: CompareObjectsItem | null,
  opts: CompareCueOptions = {},
): string => {
  if (!next) {
    return `[CO_MOVE] Say exactly: "Good try! Measuring takes practice — we will look at that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[CO_MOVE] Say exactly: "Good try! ${how}${askFor(next)}" ${contractFor(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[CO_COMPLETE] Say exactly: "What great measuring today! You compared, you ordered, and you counted. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer, and never a hint. */
export const pronounceCue = (item: CompareObjectsItem): string =>
  `[CO_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY,
 * answer-free by construction. `identify_attribute` names NO attribute (the
 * attribute IS the answer) and `non_standard` names no count; every branch
 * describes the task's SHAPE, never its value.
 */
export const stimulusFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute':
      return `two objects drawn side by side so that one measurable attribute is visible`;
    case 'compare_two':
      return `two objects drawn side by side, compared by ${item.attribute}`;
    case 'order_three':
      return `three objects drawn out of order; arranging them by ${item.attribute} is the task`;
    default:
      return `one object with a row of ${plural(item.unitName)} laid along it, waiting to be counted`;
  }
};

// ============================================================================
// The cue surface — one source for the component and the DI harness
// ============================================================================

/**
 * Everything compare-objects ever sends the tutor. `CompareObjects.tsx` spreads
 * this and adds what only a mounted component can own (status lines, and the
 * `diagnosisObservation` that reads the live board); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 */
export const compareObjectsPackBase = (
  items: CompareObjectsItem[],
): JudgedCueSurface<CompareObjectsItem> => ({
  primitiveType: 'compare-objects',
  activityLine: 'live direct instruction measurement comparison practice',
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

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

export interface CompareObjectsHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Gesture items commit an ORDER, not a word — see `orderCueForPlaced`. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/**
 * The answers a headless student gives on a judged drive. Lives beside the
 * contract it mirrors: `discriminationFor` CLAIMS the judge refuses the
 * direction reversal and the off-by-one, and this is the claim made testable.
 * Change one, change both.
 */
export const compareObjectsHarnessAnswers = (
  item: CompareObjectsItem,
): CompareObjectsHarnessAnswers => {
  switch (item.kind) {
    case 'identify_attribute': {
      const wrong = item.attributeOptions.find((a) => a !== item.attribute) ?? 'weight';
      return {
        correct: ATTRIBUTE_CHILD_FORM[item.attribute],
        plainWrong: ATTRIBUTE_CHILD_FORM[wrong],
        signatureWrong: {
          text: ATTRIBUTE_CHILD_FORM[wrong],
          why: 'another attribute that is true of the objects but is not the one the picture draws',
        },
        // The menu has to be spoken or the question cannot be answered; the
        // key word is exempt inside that clause and nowhere else.
        leakTokens: [ATTRIBUTE_KEY_WORD[item.attribute]],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    }
    case 'compare_two': {
      const loser = item.objectNames.find((n) => n !== item.answerNames[0]) ?? '';
      return {
        correct: item.answerNames[0],
        plainWrong: loser,
        signatureWrong: {
          text: loser,
          why: 'the direction reversal — the other object named confidently, the canonical K measurement error',
        },
        leakTokens: [item.answerNames[0]],
        leakExemptSpan: leakExemptSpanFor(item),
      };
    }
    case 'order_three':
      return {
        correct: `arranged ${item.answerNames.join(', ')}`,
        plainWrong: `arranged ${[...item.answerNames].reverse().join(', ')}`,
        placed: { correct: 1, wrong: 0 },
        leakTokens: [],
      };
    default:
      return {
        correct: numberWordFor(item.unitCount),
        plainWrong: numberWordFor(item.unitCount + 1),
        signatureWrong: {
          text: numberWordFor(item.unitCount + 1),
          why: 'the off-by-one — the starting edge counted as a unit',
        },
        leakTokens: [numberWordFor(item.unitCount)],
      };
  }
};

/**
 * Harness-side gesture verdict builder, `DiPortAdapter.gestureVerdictCue`'s
 * one-number shape. THE ENCODING (internal to this module — `placed` values
 * above are produced here and decoded here, nowhere else): 1 = the correct
 * order committed, 0 = the reversed order, which is the ordering mode's own
 * signature error.
 */
export const orderCueForPlaced = (item: CompareObjectsItem, placed: number): string =>
  orderVerdictCue(item, placed === 1 ? item.answerNames : [...item.answerNames].reverse());
