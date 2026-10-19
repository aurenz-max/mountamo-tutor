/**
 * The in-item levers on sorting-station (`/add-support-tiers`, class sweep 2026-10-08; report
 * qa/eval-reports/sorting-station-levers-2026-10-08.md). Every answer is spoken; the misses are what
 * `sortingStationSpokenMisses` names. No real-learner evidence: the misses come from the DI drives' scripted wrong
 * answers and the catalog's commonStruggles.
 *
 * Help (the screen shows more; the question is unchanged):
 * - `try_each` (sort): a copy of the card's picture with a question mark on EVERY tray. Answers the object's name said
 *   back (the trays are the answer set) and another group (check the card against each tray in turn). Marks no tray.
 * - `tray_examples` (sort): one card the learner already had credited in an EARLIER round, on each tray it went to.
 *   Only cards sorted by the same rule, never a card on the current page (sort-variety reuses its set).
 * - `tray_pictures` (sort, reader band): the tray's picture on every tray. The pre-reader render always shows it.
 *   Not offered when a tray picture is the card's own picture (`trayPicturesLeak`): that is picture matching.
 * - `show_trays` (pick_rule): the empty trays under the cards, picture and name. The learner still names the rule.
 *   Not offered when a tray name is one of the ways to sort (`showTraysLeak`).
 * - `odd_model` (odd_one): beside the cards, a fixed model row of three blue circles and one red square. Never the cards.
 * - `focus_tray` (count_group): every tray but the counted one dims.
 * - `tap_marks` (count_group): the counted tray's pictures can be tapped; a tapped one gets a ring. No numbers.
 * - `line_up` (compare): each group's pictures in a row, a picture per column, both rows from the same left edge.
 * - `check_boxes` (both_criteria): an empty box beside each of the two criteria; the learner taps it to yes / no.
 * Simplify (an ungraded easier item of the same kind, new pictures, then the full item):
 * - `three_cards` (odd_one, 4+ cards): three new cards, two of one kind and one of a far kind.
 * - `far_compare` (compare, groups within 2 of each other): two new groups of one and four.
 *
 * No simplify on sort, count_group or both_criteria: a sort at two trays is already the plainest shape, and a simpler
 * sort needs a new card of the generated groups, which no pool keys; the saved counts are 1-3, already the plainest;
 * a two-criteria item with one criterion is another mode.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { sortingStationCard } from './sortingStation.card';
import { itemsFromChallenge, type SortingChallengeLike, type SortingStationItem, type SortingStationMode } from './sortingStationDomain';

export const TRY_EACH_LEVER = 'try_each';
export const EXAMPLES_LEVER = 'tray_examples';
export const PICTURES_LEVER = 'tray_pictures';
export const SHOW_TRAYS_LEVER = 'show_trays';
export const ODD_MODEL_LEVER = 'odd_model';
export const FOCUS_LEVER = 'focus_tray';
export const TAP_LEVER = 'tap_marks';
export const LINE_UP_LEVER = 'line_up';
export const CHECKS_LEVER = 'check_boxes';
export const THREE_CARDS_LEVER = 'three_cards';
export const FAR_COMPARE_LEVER = 'far_compare';

/** The catalog eval mode an item belongs to (its challenge type, as the catalog names it). */
const CATALOG_MODE: Record<SortingStationMode, string> = {
  'sort-by-one': 'sort_one', 'sort-by-attribute': 'sort_attribute', 'sort-variety': 'sort_variety',
  'count-and-compare': 'count_compare', 'odd-one-out': 'odd_one_out', 'two-attributes': 'two_attributes',
  'tally-record': 'tally_record',
};
export const catalogModeOf = (item: SortingStationItem): string => CATALOG_MODE[item.mode];

/** A card the learner had credited on a sort, kept for `tray_examples`. */
export interface CreditedCard { challengeId: string; label: string; emoji: string; group: string; rule: string }

export interface SortingLeverContext {
  /** The item's own generated challenge (the page). */
  challenge: SortingChallengeLike | null;
  preReader: boolean;
  /** Every card credited on a sort so far, in any challenge. */
  credited: readonly CreditedCard[];
}

const lower = (s: string) => s.trim().toLowerCase();
const pageLabels = (challenge: SortingChallengeLike | null) => new Set((challenge?.objects ?? []).map(o => lower(o.label)));

/** Leak rule (tray_pictures): a tray picture that is the card's own picture answers the sort by matching. */
export const trayPicturesLeak = (item: SortingStationItem) =>
  !!item.stimulusEmoji && item.choiceEmojis.some(e => e === item.stimulusEmoji);

/** Leak rule (show_trays): a tray named with a way to sort says the rule. */
export const showTraysLeak = (item: SortingStationItem, challenge: SortingChallengeLike | null) => {
  const ways = new Set(item.choices.map(lower));
  return (challenge?.categories ?? []).some(c => ways.has(lower(c.label)) || lower(c.label).split(/\s+/).some(w => ways.has(w)));
};

/**
 * `tray_examples`: per tray (lower-cased group), the first credited card sorted by the same rule in another challenge.
 * Leak rule: never a card on the current page (sort-variety asks the same set by every rule) and never the card asked.
 */
export function trayExamples(item: SortingStationItem | null, ctx: SortingLeverContext): Map<string, CreditedCard> {
  const out = new Map<string, CreditedCard>();
  if (item?.kind !== 'sort' || !item.ruleName) return out;
  const page = pageLabels(ctx.challenge);
  const groups = new Set(item.choices.map(lower));
  for (const card of ctx.credited) {
    const group = lower(card.group);
    if (card.challengeId === item.challengeId || lower(card.rule) !== lower(item.ruleName) || !groups.has(group) || out.has(group)) continue;
    if (page.has(lower(card.label)) || lower(card.label) === lower(item.stimulus)) continue;
    out.set(group, card);
  }
  return out;
}

/** The two groups a compare item weighs, with their counts over the page. */
export function compareCounts(item: SortingStationItem, challenge: SortingChallengeLike | null): number[] {
  const rule = item.ruleName;
  if (item.kind !== 'compare' || !rule) return [];
  return item.choices.filter(c => c !== 'the same').map(label => (challenge?.objects ?? [])
    .filter(o => lower(o.attributes?.[rule] ?? '') === lower(label)).length);
}

// ── Simplify builders ──────────────────────────────────────────────────────

/** New pictures for an easier item, by kind. The tray picture is never a member's own picture. */
const POOL: readonly { kind: string; tray: string; members: readonly (readonly [string, string])[] }[] = [
  { kind: 'Animal', tray: '🐾', members: [['Dog', '🐶'], ['Pig', '🐷'], ['Cow', '🐮'], ['Duck', '🦆'], ['Horse', '🐴'], ['Sheep', '🐑']] },
  { kind: 'Fruit', tray: '🧺', members: [['Apple', '🍎'], ['Banana', '🍌'], ['Grapes', '🍇'], ['Pear', '🍐'], ['Lemon', '🍋'], ['Cherry', '🍒']] },
  { kind: 'Vehicle', tray: '🛣️', members: [['Bus', '🚌'], ['Train', '🚂'], ['Boat', '⛵'], ['Plane', '✈️'], ['Truck', '🚚'], ['Rocket', '🚀']] },
  { kind: 'Bird', tray: '🪺', members: [['Owl', '🦉'], ['Parrot', '🦜'], ['Chick', '🐤'], ['Eagle', '🦅'], ['Swan', '🦢'], ['Penguin', '🐧']] },
  { kind: 'Flower', tray: '🪴', members: [['Rose', '🌹'], ['Tulip', '🌷'], ['Daisy', '🌼'], ['Sunflower', '🌻'], ['Hibiscus', '🌺'], ['Blossom', '🌸']] },
];

const freshMembers = (kind: (typeof POOL)[number], taken: Set<string>) => kind.members.filter(([label]) => !taken.has(lower(label)));
const objectOf = (id: string, [label, emoji]: readonly [string, string], kind: string) =>
  ({ id, label, emoji, attributes: { category: lower(kind) } });

/** `three_cards`: two cards of one kind and one of another, all new, the odd one in the middle. */
export function threeCards(item: SortingStationItem | null, challenge: SortingChallengeLike | null): SortingStationItem | null {
  if (item?.kind !== 'odd_one' || item.choices.length < 4) return null;
  const taken = new Set([...item.choices, ...(challenge?.objects ?? []).map(o => o.label)].map(lower));
  for (const a of POOL) for (const b of POOL) {
    if (a === b) continue;
    const [a1, a2] = freshMembers(a, taken), [b1] = freshMembers(b, taken);
    if (!a1 || !a2 || !b1) continue;
    const id = `${item.challengeId}~simpler`;
    const ch: SortingChallengeLike = { id, type: 'odd-one-out', sortingAttribute: 'category',
      objects: [objectOf('s1', a1, a.kind), objectOf('s2', b1, b.kind), objectOf('s3', a2, a.kind)], oddOneOut: 's2' };
    const built = itemsFromChallenge(ch, { tier: item.tier })[0];
    if (built) return { ...built, id: `${item.id}~simpler`, practiceChallenge: ch };
  }
  return null;
}

/** `far_compare`: two new groups of one and four (gap 3), never the same, only when the item's groups are within 2. */
export function farCompare(item: SortingStationItem | null, challenge: SortingChallengeLike | null): SortingStationItem | null {
  if (item?.kind !== 'compare') return null;
  const counts = compareCounts(item, challenge);
  if (counts.length !== 2 || Math.abs(counts[0] - counts[1]) >= 3) return null;
  const taken = new Set([...(challenge?.objects ?? []).map(o => o.label), ...item.choices].map(lower));
  for (const small of POOL) for (const big of POOL) {
    if (small === big || taken.has(lower(small.kind)) || taken.has(lower(big.kind))) continue;
    const s = freshMembers(small, taken).slice(0, 1), b = freshMembers(big, taken).slice(0, 4);
    if (s.length < 1 || b.length < 4) continue;
    const id = `${item.challengeId}~simpler`;
    const ch: SortingChallengeLike = { id, type: 'count-and-compare', sortingAttribute: 'category',
      categories: [small, big].map(k => ({ label: k.kind, rule: { category: lower(k.kind) }, bucketEmoji: k.tray })),
      objects: [...s.map((m, i) => objectOf(`s${i}`, m, small.kind)), ...b.map((m, i) => objectOf(`b${i}`, m, big.kind))],
      correctComparison: 'more' };
    const built = itemsFromChallenge(ch, { tier: item.tier }).find(i => i.kind === 'compare');
    if (built) return { ...built, id: `${item.id}~simpler`, namesChoices: true, practiceChallenge: ch };
  }
  return null;
}

/** The easier item behind a `~simpler` id (the journey row rebuilds it from its parent with the same builder). */
export function simplerFromParent(item: SortingStationItem, challenge: SortingChallengeLike | null): SortingStationItem | null {
  return item.kind === 'odd_one' ? threeCards(item, challenge) : item.kind === 'compare' ? farCompare(item, challenge) : null;
}

// ── The lever set ──────────────────────────────────────────────────────────

const SORTS = ['sort_one', 'sort_attribute', 'sort_variety'];
const COUNTS = ['count_compare', 'tally_record'];
const PRACTICE = 'Opens an easier one of the same kind first, with new pictures. It is not graded; the full item comes back after it.';
const kindIs = (kind: SortingStationItem['kind']) => (item: SortingStationItem) => item.kind === kind;

/** Every lever of the family, by type, in the order the tutor sees them. */
export const SORTING_LEVERS = leverSet<SortingStationItem, SortingLeverContext>({
  modeOf: catalogModeOf,
  missesOf: mode => sortingStationCard.modes[mode]?.misses ?? [],
  answersOf: item => [item.answer],
  specs: [
    { id: EXAMPLES_LEVER, type: 'custom', modes: SORTS, carrier: 'shown', answers: ['other_group'],
      why: 'It shows cards the learner already had credited in earlier rounds on their trays: earned work, not a model of a new item.',
      when: 'The learner names another group.',
      does: 'Puts one card the learner already sorted in an earlier round on each tray it went to. Not this card.',
      content: (item, ctx) => (trayExamples(item, ctx).size ? true : null),
      fact: 'A card the learner sorted in an earlier round sits on the trays it went to.' },
    { id: PICTURES_LEVER, type: 'meaning', modes: SORTS, carrier: 'shown', answers: ['other_group'],
      offer: (item, ctx) => item.kind === 'sort' && !ctx.preReader && item.choiceEmojis.every(Boolean) && !trayPicturesLeak(item),
      when: 'The learner names another group.', does: 'Shows each tray\'s picture on the tray. Marks no tray.',
      fact: 'Every tray shows its picture.' },
    { id: TRY_EACH_LEVER, type: 'marks', modes: SORTS, carrier: 'both', answers: ['said_object', 'other_group'],
      offer: kindIs('sort'),
      when: 'The learner says the thing\'s own name, or names another group.',
      does: 'Puts a copy of the card\'s picture with a question mark on every tray. Marks no tray: hold the card up to each tray in turn.',
      fact: 'A copy of the card\'s picture with a question mark sits on every tray. No tray is marked.' },
    { id: SHOW_TRAYS_LEVER, type: 'layout', modes: ['sort_attribute'], answers: ['other_rule'],
      offer: (item, ctx) => item.kind === 'pick_rule' && !showTraysLeak(item, ctx.challenge),
      when: 'The learner names another way to sort.',
      does: 'Shows the empty trays the cards will go into, each with its picture and name. It never says the way to sort: the learner still names it.',
      fact: 'Under the cards are the empty trays, each with its picture and name.' },
    { id: ODD_MODEL_LEVER, type: 'custom', modes: ['odd_one_out'], carrier: 'both', answers: ['said_all_belong', 'belonging_card'],
      why: 'A fixed abstract row (three circles, one square) that shows what "does not belong" means; it is not a solved item of this lesson.',
      when: 'The learner says they all belong, or names a card that belongs.',
      does: 'Shows a model row beside the cards: three blue circles and one red square. Point at the model, not the cards. Never say what '
        + 'any of the learner\'s cards have in common or which one differs: the learner still finds it.',
      fact: 'Beside the cards is a model row of three blue circles and one red square. It is not these cards.' },
    { id: THREE_CARDS_LEVER, type: 'easier', modes: ['odd_one_out'], carrier: 'shown', answers: ['belonging_card', 'said_all_belong'],
      when: 'There are too many cards to compare yet.', does: PRACTICE,
      content: (item, ctx) => threeCards(item, ctx.challenge) },
    { id: FOCUS_LEVER, type: 'marks', modes: COUNTS, answers: ['over_by_more', 'one_over'], offer: kindIs('count_group'),
      when: 'The learner counts more than the group has.', does: 'Dims every tray but the tray asked about. No numbers.',
      fact: 'Every tray but the tray asked about is dimmed.' },
    { id: TAP_LEVER, type: 'marks', modes: COUNTS, answers: ['one_short', 'one_over', 'short_by_more', 'over_by_more'],
      offer: kindIs('count_group'), when: 'The learner\'s count of the group is off.',
      does: 'Lets the learner tap each picture in the group as they count it; a tapped picture gets a ring. No numbers.',
      fact: 'The pictures in the tray asked about can be tapped; each tapped picture gets a ring.' },
    { id: LINE_UP_LEVER, type: 'layout', modes: ['count_compare'], answers: ['other_group', 'said_same', 'bare_more'],
      offer: kindIs('compare'),
      when: 'The learner names the group with fewer, says they are the same, or says only "more".',
      does: 'Lines each group\'s pictures up in a row under its tray picture, a picture per column, both rows from the same left edge. No numbers.',
      fact: 'Under the trays, each group\'s pictures are in a row, a picture per column, both rows starting at the same left edge.' },
    { id: FAR_COMPARE_LEVER, type: 'easier', modes: ['count_compare'], carrier: 'shown', answers: ['other_group', 'said_same'],
      when: 'The two groups are too close to tell apart yet.', does: PRACTICE,
      content: (item, ctx) => farCompare(item, ctx.challenge) },
    { id: CHECKS_LEVER, type: 'custom', modes: ['two_attributes'], carrier: 'both', answers: ['one_criterion_only', 'opposite_verdict'],
      why: 'It adds empty boxes the learner ticks or crosses; nothing on screen is marked for them.',
      when: 'The learner answers only half the question, or gives the opposite answer.',
      does: 'Puts an empty box beside each of the two things asked about; the learner taps a box to tick or cross it. '
        + 'Ask about one thing at a time; the boxes start empty and nothing fills them for the learner.',
      fact: 'Beside each of the two things asked about is an empty box the learner can tap to tick or cross.' },
  ],
});
