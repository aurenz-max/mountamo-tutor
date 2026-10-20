/**
 * compareObjectsDomain — what compare-objects TEACHES, with no teaching engine attached: the item kinds, the build
 * gates that turn generator challenges into items (an unaskable challenge is DROPPED, never repaired), the ask, the
 * spoken key and its known misses, the board's own check of an ordering, the visible scene, and the harness answer
 * material. The boss (`compareObjects.boss.ts`), the levers and the component read it; the generator imports its
 * gates from it.
 *
 * Why the modes are shaped as they are (moved from the retired scripted pack, 2026-10-20):
 *  - K.MD.1 is a SPEAKING standard. identify_attribute, compare_two and non_standard are said: attribute chips, two
 *    object buttons and a number keypad could each be operated without the skill, and the measurement words never
 *    left the child's mouth.
 *  - order_three keeps its hands: the ARRANGEMENT is the answer, and reciting three names in order is a different,
 *    memory-loaded task.
 *  - identify_attribute is ambiguous unless the ask names the closed set (any two objects have a length AND a
 *    weight), so the ask says the menu in the child's words, and the drawing (bars, a seesaw, jars) shows one
 *    attribute. A key that is not the drawn attribute, and a menu offering both length and height, are dropped.
 *  - The drawing must rank the objects as the key does (`visualRankAgrees`): spoken, a child who read the picture
 *    right would be refused.
 *  - The ask names a pair in an order the item id decides (`askOrderFor`), so position never predicts the answer.
 *  - The unit boxes on non_standard are unnumbered until the answer is credited: the last number is the answer.
 *  - Unit counts stay inside 1-20 (one spoken word); object names are sayable, told apart by ear, and never carry a
 *    measure word ("long ribbon" says the answer).
 */

import type { ResponseClassId, TeachingItem } from '../../../hooks/teachingItemContract';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { offByMisses, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { numberWordFor } from './countingBoardDomain';
import { isSayableName, namesEarSeparable, nameCarriesAny, MEASURE_ADJECTIVES } from './spokenNameGates';
import type { CompareOrderMiss } from './compareObjects.card';

export type { CompareOrderMiss, SpokenCompareMiss } from './compareObjects.card';
export { isSayableName, namesEarSeparable, MEASURE_ADJECTIVES } from './spokenNameGates';

// ============================================================================
// Domain vocabulary
// ============================================================================

export type CompareObjectsKind = 'identify_attribute' | 'compare_two' | 'order_three' | 'non_standard';

export type CompareBand = 'K' | '1';

export type MeasurableAttribute = 'length' | 'height' | 'weight' | 'capacity';

export type ComparisonWord =
  | 'longer' | 'shorter'
  | 'taller' | 'shorter_height'
  | 'heavier' | 'lighter'
  | 'holds_more' | 'holds_less';

export const VALID_ATTRIBUTES: readonly MeasurableAttribute[] = ['length', 'height', 'weight', 'capacity'];

export const COMPARISON_WORDS: readonly ComparisonWord[] =
  ['longer', 'shorter', 'taller', 'shorter_height', 'heavier', 'lighter', 'holds_more', 'holds_less'];

/** Which comparison words belong to which attribute: a `heavier` ask over a LENGTH drawing asks about a picture that
 *  is not on the screen. */
const ATTRIBUTE_OF_WORD: Record<ComparisonWord, MeasurableAttribute> = {
  longer: 'length', shorter: 'length', taller: 'height', shorter_height: 'height',
  heavier: 'weight', lighter: 'weight', holds_more: 'capacity', holds_less: 'capacity',
};

/** Words whose winner is the object with the LARGER measurement. */
const GREATER_WORDS: readonly ComparisonWord[] = ['longer', 'taller', 'heavier', 'holds_more'];

export const isGreaterComparison = (word: ComparisonWord): boolean => GREATER_WORDS.includes(word);

/** How a comparison word is SAID. `shorter_height` is an internal distinction; a child hears "shorter" either way. */
const COMPARISON_SPOKEN: Record<ComparisonWord, string> = {
  longer: 'longer', shorter: 'shorter', taller: 'taller', shorter_height: 'shorter',
  heavier: 'heavier', lighter: 'lighter', holds_more: 'holds more', holds_less: 'holds less',
};

export const spokenComparison = (word: ComparisonWord): string => COMPARISON_SPOKEN[word];

/** The spoken predicate: "is longer", "holds more" (two of the words are already verbs). */
export const comparisonPredicate = (word: ComparisonWord): string =>
  (word === 'holds_more' || word === 'holds_less' ? COMPARISON_SPOKEN[word] : `is ${COMPARISON_SPOKEN[word]}`);

/** The ordering endpoints: "from longest to shortest". */
const ORDER_ENDPOINTS: Record<MeasurableAttribute, { low: string; high: string }> = {
  length: { low: 'shortest', high: 'longest' },
  height: { low: 'shortest', high: 'tallest' },
  weight: { low: 'lightest', high: 'heaviest' },
  capacity: { low: 'least', high: 'most' },
};

/** "paper clip" → "paper clips", "cubes" → "cubes". */
export const plural = (word: string): string => (/s$/i.test(word.trim()) ? word.trim() : `${word.trim()}s`);

/**
 * The menu in a child's words. "capacity" is not a word a K child owns, so the ask offers the child form; the grown-up
 * word is accepted too (the key's `alsoAccept`).
 */
export const ATTRIBUTE_CHILD_FORM: Record<MeasurableAttribute, string> = {
  length: 'how long they are',
  height: 'how tall they are',
  weight: 'how heavy they are',
  capacity: 'how much they hold',
};

/** The one word that tells each menu choice apart by ear. */
export const ATTRIBUTE_KEY_WORD: Record<MeasurableAttribute, string> = {
  length: 'long', height: 'tall', weight: 'heavy', capacity: 'hold',
};

const int = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** Deterministic, so the harness and the component agree on which object the ask names first. */
const hashOf = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

// ============================================================================
// Sayability + content gates (the generator imports these)
// ============================================================================

/** The spoken-number window for the unit count: one word each. */
export const UNIT_COUNT_MIN = 1;
export const UNIT_COUNT_MAX = 20;

export const isSayableUnitCount = (n: unknown): n is number => int(n) && n >= UNIT_COUNT_MIN && n <= UNIT_COUNT_MAX;

/** A name with a measure word in it ("heavy backpack") says the answer aloud. */
export const nameCarriesTheAnswer = (name: string): boolean => nameCarriesAny(name, MEASURE_ADJECTIVES);

/** The comparison word must be about the attribute the picture DRAWS. */
export const comparisonMatchesAttribute = (attribute: MeasurableAttribute, word: ComparisonWord): boolean =>
  ATTRIBUTE_OF_WORD[word] === attribute;

export interface MeasuredObject {
  name: string;
  visualSize: number;
  actualValue: number;
}

/**
 * The DRAWING must rank the objects the same way the KEY does. `visualSize` paints them and `actualValue` decides
 * the answer. Ties in either fail: a picture with no visible difference cannot be compared.
 */
export const visualRankAgrees = (objects: readonly MeasuredObject[]): boolean => {
  if (objects.length < 2) return true;
  const values = objects.map(o => o.actualValue);
  const sizes = objects.map(o => o.visualSize);
  if (new Set(values).size !== values.length) return false;
  if (new Set(sizes).size !== sizes.length) return false;
  const byValue = [...objects].sort((a, b) => a.actualValue - b.actualValue).map(o => o.name);
  const bySize = [...objects].sort((a, b) => a.visualSize - b.visualSize).map(o => o.name);
  return byValue.every((name, i) => name === bySize[i]);
};

/**
 * The attribute options, gated for a SPOKEN menu: real attributes only, the correct one present with at least one
 * distractor, and never `length` beside `height` (one drawing cannot be about only one of them).
 */
export const askableAttributeOptions = (options: readonly unknown[] | undefined, correct: MeasurableAttribute)
  : MeasurableAttribute[] | null => {
  const valid = (options ?? []).filter((o): o is MeasurableAttribute => VALID_ATTRIBUTES.includes(o as MeasurableAttribute));
  const unique = Array.from(new Set(valid));
  if (!unique.includes(correct) || unique.length < 2) return null;
  if (unique.includes('length') && unique.includes('height')) return null;
  return unique;
};

// ============================================================================
// Items
// ============================================================================

export const answerKindFor = (kind: CompareObjectsKind): 'voice' | 'gesture' =>
  (kind === 'order_three' ? 'gesture' : 'voice');

export const responseClassFor = (kind: CompareObjectsKind): ResponseClassId =>
  (kind === 'order_three' ? 'manipulation' : kind === 'non_standard' ? 'number_word_to_20' : 'short_spoken_word');

export interface CompareObjectsItem extends TeachingItem {
  kind: CompareObjectsKind;
  band: CompareBand;
  attribute: MeasurableAttribute;
  /** The comparison direction; unused by identify_attribute and non_standard. */
  comparisonWord: ComparisonWord;
  /** Object names in SCREEN order. */
  objectNames: string[];
  /** The drawing: each object's drawn size and measurement, in screen order. */
  objects: MeasuredObject[];
  /** The order the ASK names them in: hash-decided, so position cannot predict the answer. */
  askOrder: string[];
  /** compare_two: the winning name. order_three: the full correct order. */
  answerNames: string[];
  /** identify_attribute: the spoken menu, in ask order. */
  attributeOptions: MeasurableAttribute[];
  /** non_standard */
  unitName: string;
  unitCount: number;
  /** The lesson's support tier (default medium): when the model lever comes. */
  supportTier: SupportTier;
}

/** The challenge shape as the generator emits it (duck-typed, so this module never imports the component). */
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
  supportTier?: SupportTier;
}

export interface CompareBuildContext {
  band: CompareBand;
}

const KINDS: readonly CompareObjectsKind[] = ['identify_attribute', 'compare_two', 'order_three', 'non_standard'];

/** K compares two objects directly; ordering three and non-standard units are the Grade 1 rungs. */
const K_KINDS: readonly CompareObjectsKind[] = ['identify_attribute', 'compare_two'];

/** The ask names the pair in an order the CONTENT decides. */
const askOrderFor = (id: string, names: readonly string[]): string[] =>
  (hashOf(id) % 2 === 0 ? [...names] : [...names].reverse());

const objectsOf = (ch: CompareObjectsChallengeLike): MeasuredObject[] =>
  (ch.objects ?? []).filter((o): o is MeasuredObject => !!o && isSayableName(o.name)
    && typeof o.visualSize === 'number' && Number.isFinite(o.visualSize)
    && typeof o.actualValue === 'number' && Number.isFinite(o.actualValue))
    .map(o => ({ name: o.name.trim(), visualSize: o.visualSize, actualValue: o.actualValue }));

/**
 * One generated challenge → its item, or `null` when it cannot be asked honestly: a mode outside the band; names the
 * tutor cannot say or tell apart by ear; a comparison word not about the drawn attribute; a key that disagrees with
 * the measurements, or a drawing that disagrees with the key; an attribute menu that is not answerable; a unit count
 * outside 1-20. Nothing is backfilled.
 */
export const itemFromChallenge = (ch: CompareObjectsChallengeLike, ctx: CompareBuildContext): CompareObjectsItem | null => {
  const kind = KINDS.find(k => k === ch.type);
  if (!kind) return null;
  if (ctx.band === 'K' && !K_KINDS.includes(kind)) return null;

  const attribute = VALID_ATTRIBUTES.find(a => a === ch.attribute);
  if (!attribute) return null;

  const objects = objectsOf(ch);
  const names = objects.map(o => o.name);
  if (!namesEarSeparable(names)) return null;
  // The three comparison modes have an answer a measure adjective can give away.
  if (kind !== 'non_standard' && names.some(nameCarriesTheAnswer)) return null;

  const base = {
    id: ch.id, band: ctx.band, attribute, answerKind: answerKindFor(kind), responseClass: responseClassFor(kind),
    objectNames: names, objects, unitName: '', unitCount: 0,
    attributeOptions: [] as MeasurableAttribute[], supportTier: ch.supportTier ?? 'medium' as SupportTier,
  };

  if (kind === 'non_standard') {
    if (objects.length !== 1 || !isSayableName(ch.unitName) || !isSayableUnitCount(ch.unitCount)) return null;
    return { ...base, kind, comparisonWord: 'longer', askOrder: names, answerNames: [],
      unitName: ch.unitName.trim(), unitCount: ch.unitCount };
  }

  if (kind === 'identify_attribute') {
    if (objects.length !== 2) return null;
    // The picture is drawn from `attribute`; a key that names anything else answers a question the screen is not asking.
    const correct = VALID_ATTRIBUTES.find(a => a === ch.correctAttribute);
    if (!correct || correct !== attribute) return null;
    const options = askableAttributeOptions(ch.attributeOptions, correct);
    if (!options) return null;
    // The menu order is code-decided too: an answer always said last is a position the child can learn.
    const rotation = hashOf(ch.id) % options.length;
    return { ...base, kind, comparisonWord: 'longer', askOrder: askOrderFor(ch.id, names), answerNames: [],
      attributeOptions: [...options.slice(rotation), ...options.slice(0, rotation)] };
  }

  const word = COMPARISON_WORDS.find(w => w === ch.comparisonWord);
  if (!word || !comparisonMatchesAttribute(attribute, word)) return null;
  if (!visualRankAgrees(objects)) return null;

  if (kind === 'compare_two') {
    if (objects.length !== 2) return null;
    const winner = objects.find(o => o.name === (ch.correctAnswer ?? '').trim());
    const loser = objects.find(o => o.name !== winner?.name);
    if (!winner || !loser) return null;
    const shouldWin = isGreaterComparison(word) ? winner.actualValue > loser.actualValue : winner.actualValue < loser.actualValue;
    if (!shouldWin) return null;
    return { ...base, kind, comparisonWord: word, askOrder: askOrderFor(ch.id, names), answerNames: [winner.name] };
  }

  // order_three
  if (objects.length !== 3) return null;
  const declared = (ch.correctAnswer ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (declared.length !== 3 || !declared.every(name => names.includes(name))) return null;
  const expected = [...objects]
    .sort((a, b) => (isGreaterComparison(word) ? b.actualValue - a.actualValue : a.actualValue - b.actualValue))
    .map(o => o.name);
  if (!declared.every((name, i) => name === expected[i])) return null;
  // A board already sitting in the answer order is not an ordering task.
  if (names.every((name, i) => name === expected[i])) return null;
  return { ...base, kind, comparisonWord: word, askOrder: names, answerNames: expected };
};

/**
 * The whole session's items. Dedup is session-wide and ignores the direction: having heard "the jump rope is longer",
 * the child gets "which is shorter?" over the same pair for free.
 */
export const buildCompareItems = (challenges: readonly CompareObjectsChallengeLike[], ctx: CompareBuildContext)
  : { items: CompareObjectsItem[]; droppedChallenges: number } => {
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

/** An item back to the challenge shape `itemFromChallenge` reads, with its own objects (an easier item is built so). */
export const challengeOf = (item: CompareObjectsItem, objects: MeasuredObject[], extra: Partial<CompareObjectsChallengeLike>)
  : CompareObjectsChallengeLike => ({ id: `${item.id}~simpler`, type: item.kind, attribute: item.attribute,
  comparisonWord: item.comparisonWord, objects, supportTier: item.supportTier, ...extra });

// ============================================================================
// The ask and the key
// ============================================================================

/** "the shoelace, the tulip and the daisy" (a list) or "the shoelace or the jump rope" (a choice). */
const joinNames = (names: readonly string[], conjunction: 'and' | 'or'): string => {
  const withArticles = names.map(n => `the ${n}`);
  if (withArticles.length <= 1) return withArticles[0] ?? '';
  return `${withArticles.slice(0, -1).join(', ')} ${conjunction} ${withArticles[withArticles.length - 1]}`;
};
const namedList = (names: readonly string[]) => joinNames(names, 'and');
const namedChoice = (names: readonly string[]) => joinNames(names, 'or');

/** The spoken menu clause: "how long they are, how heavy they are, or how much they hold". */
const optionMenu = (options: readonly MeasurableAttribute[]): string => {
  const forms = options.map(a => ATTRIBUTE_CHILD_FORM[a]);
  if (forms.length <= 1) return forms[0] ?? '';
  return `${forms.slice(0, -1).join(', ')}, or ${forms[forms.length - 1]}`;
};

/** The ask. It names the objects aloud, because a pre-reader cannot read the names beside the drawing. */
export const askFor = (item: CompareObjectsItem): string => {
  switch (item.kind) {
    case 'identify_attribute':
      return `Look at ${namedList(item.askOrder)}. Is the picture showing us ${optionMenu(item.attributeOptions)}? Say it out loud.`;
    case 'compare_two':
      return `Which one ${comparisonPredicate(item.comparisonWord)} — ${namedChoice(item.askOrder)}? Say its name.`;
    case 'order_three': {
      const ends = ORDER_ENDPOINTS[item.attribute];
      const forward = isGreaterComparison(item.comparisonWord);
      return `Put ${namedList(item.askOrder)} in order, from ${forward ? ends.high : ends.low} to ${forward ? ends.low : ends.high}. `
        + 'Touch them one at a time.';
    }
    case 'non_standard':
      return `How many ${plural(item.unitName)} long is the ${item.objectNames[0]}? Count them, then say the number.`;
  }
};

/** What the ask says by design, which holds the answer: the closed menu on identify_attribute, both names on compare_two. */
export const askGiven = (item: CompareObjectsItem): string[] =>
  (item.kind === 'identify_attribute' ? [optionMenu(item.attributeOptions)]
    : item.kind === 'compare_two' ? [namedChoice(item.askOrder)] : []);

/** The spoken key; null on an ordering, which the board checks. */
export function compareKey(item: CompareObjectsItem): SpokenKey | null {
  if (item.answerKind !== 'voice') return null;
  if (item.kind === 'identify_attribute') {
    const wrong = item.attributeOptions.filter(a => a !== item.attribute).map(a => `"${ATTRIBUTE_CHILD_FORM[a]}"`);
    return { answer: ATTRIBUTE_CHILD_FORM[item.attribute], alsoAccept: [ATTRIBUTE_KEY_WORD[item.attribute], item.attribute],
      acceptRule: 'The learner\'s own words and the grown-up word are both right.',
      signatureError: `${wrong.join(' and ')} may be true of these objects, but the picture is not drawn to show `
        + `${wrong.length > 1 ? 'them' : 'it'}, so it is not the answer.` };
  }
  if (item.kind === 'compare_two') {
    const winner = item.answerNames[0], loser = item.objectNames.find(n => n !== winner) ?? '';
    return { answer: winner, alsoAccept: [], acceptRule: `Any words that name only the ${winner} are that answer.`,
      signatureError: `The ${loser}, the other object, is the comparison turned around. A pointing word such as `
        + '"that one" names no object and is not the answer.' };
  }
  const word = numberWordFor(item.unitCount);
  return { answer: word, alsoAccept: [],
    acceptRule: `Counting aloud and ending on ${word} is that answer, and "${word} ${plural(item.unitName)}" is ${word}.`,
    signatureError: `"${numberWordFor(item.unitCount + 1)}", one too many from counting the object's starting edge as a `
      + 'unit, is not the answer.' };
}

const SHOWS: Record<MeasurableAttribute, string> = ATTRIBUTE_CHILD_FORM;

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other object on
 * compare_two (the comparison turned around), another menu attribute on identify_attribute, and the off-by counts of
 * the unit boxes on non_standard.
 */
export function compareObjectsSpokenMisses(item: CompareObjectsItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  if (item.kind === 'compare_two') {
    const winner = item.answerNames[0], others = item.objectNames.filter(n => n !== winner), w = item.comparisonWord;
    const asked = w.startsWith('holds') ? w.replace('_', ' ') : `is ${w === 'shorter_height' ? 'shorter' : w}`;
    return others.length ? [{ id: 'other_object', pattern: `The question asks which one ${asked}, and that is the `
      + `${winner}. The learner names the ${others.join(' or the ')}, the other object, which is the comparison turned around.`, examples: others }] : [];
  }
  if (item.kind === 'identify_attribute') {
    const others = item.attributeOptions.filter(a => a !== item.attribute);
    return others.length ? [{ id: 'other_attribute', pattern: `The picture shows ${SHOWS[item.attribute]}. The learner's answer is `
      + `${others.map(a => SHOWS[a]).join(' or ')}, another choice from the question that the picture does not show.`,
    examples: others.map(a => SHOWS[a]) }] : [];
  }
  if (item.kind === 'non_standard') return offByMisses(item.unitCount, `the ${item.unitCount} ${item.unitName} boxes along the ${item.objectNames[0]}`);
  return [];
}

// ============================================================================
// The board's check of an ordering, and the scene
// ============================================================================

/** Does the committed arrangement name every object, in the asked order? */
export const orderMatches = (item: CompareObjectsItem, placed: readonly string[]) =>
  placed.length === item.answerNames.length && placed.every((name, i) => name === item.answerNames[i]);

/** What a wrong arrangement shows (`TeachingAttempt.miss`); undefined for a right one and for the spoken kinds. */
export function compareOrderMiss(item: CompareObjectsItem | null, placed: readonly string[]): CompareOrderMiss | undefined {
  if (!item || item.kind !== 'order_three' || orderMatches(item, placed)) return undefined;
  const want = item.answerNames;
  if (placed.length < want.length) return 'not_all_placed';
  if (want.every((name, i) => placed[i] === want[want.length - 1 - i])) return 'reversed';
  return want.filter((name, i) => placed[i] !== name).length === 2 ? 'two_swapped' : 'other_order';
}

/** The committed arrangement in the learner's terms, as the tutor and the observer read it. */
export const describeOrder = (item: CompareObjectsItem, placed: readonly string[]) =>
  (placed.length ? `Touched ${placed.length} of ${item.objectNames.length} in this order: ${placed.join(', ')}` : 'Touched none of the objects');

/** What the tutor and the observer are shown: what is drawn, never the measurements behind it. */
export function workspaceScene(item: CompareObjectsItem, view: { placedOrder: readonly string[] }): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: item.kind, attribute: item.attribute,
      pictured: `${item.objectNames.join(', ')} (left to right)`,
      ...(item.kind === 'non_standard' ? { unit: item.unitName,
        constraints: 'The unit boxes are unnumbered until the answer is credited.' } : {}),
      ...(item.kind === 'order_three' ? { touchedOrder: view.placedOrder.length ? view.placedOrder.join(', ') : 'none yet' } : {}),
      ...(item.kind === 'compare_two' || item.kind === 'identify_attribute'
        ? { constraints: 'The picture is the only measuring tool; nothing on screen can be tapped.' } : {}),
    },
  };
}

// ============================================================================
// Harness answer material
// ============================================================================

/** What a right and a plainly wrong learner say; an ordering is touched, so it has no words. */
export function compareObjectsHarnessAnswers(item: CompareObjectsItem): { correct: string; plainWrong: string } {
  switch (item.kind) {
    case 'identify_attribute': {
      const wrong = item.attributeOptions.find(a => a !== item.attribute) ?? 'weight';
      return { correct: ATTRIBUTE_CHILD_FORM[item.attribute], plainWrong: ATTRIBUTE_CHILD_FORM[wrong] };
    }
    case 'compare_two':
      return { correct: item.answerNames[0], plainWrong: item.objectNames.find(n => n !== item.answerNames[0]) ?? '' };
    case 'order_three':
      return { correct: item.answerNames.join(', '), plainWrong: [...item.answerNames].reverse().join(', ') };
    default:
      return { correct: numberWordFor(item.unitCount), plainWrong: numberWordFor(item.unitCount + 1) };
  }
}
