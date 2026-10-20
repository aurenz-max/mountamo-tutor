/**
 * The in-item levers on a periodic-table item, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/periodic-table-levers-2026-10-08.md). No real-learner evidence: the misses are what `periodicMiss`
 * (a tap) and `periodicSpokenMisses` (a spoken answer) name. Pure: the component draws from these, the tests hold
 * each leak rule. A simpler item has the id `<item>~simpler`, the same mode and the same clue, and is built by
 * `periodicPracticeItem`. On easy, every help lever offered starts on screen (`helpShownFromStart`); that is not a pull.
 *
 * - Element Hunt / Name It, by the clue: `axis_marks` (marks, group-and-period clue) rings the asked group number at
 *   the top and the asked period number at the side, never a box; `row_ranges` (legend, number clue) writes each
 *   row's first and last atomic number beside its period number, the same for every item; `letter_lit` (marks, name
 *   or symbol clue) lights every box whose name or symbol starts with the asked first letter and dims the rest,
 *   offered only when at least three boxes light (`litLeaks`).
 * - Name It: `box_key` (legend) a key beside the table, another element's box with its number, symbol and name
 *   labelled, which reads every box alike; the key element is in no item of the session (`keyLeaks`).
 * - Trends, compare: `column_model` (model, size only) a model column of another group, each atom drawn as a circle
 *   of its size, in a group no session item touches (`columnModelLeaks`); `pair_marks` (marks) both named boxes
 *   ringed alike.
 * - Trends, outer electrons: `tall_columns` (marks) the short middle block (groups 3 to 12) dimmed; no column numbered.
 * - Element Hunt, Name It, outer electrons: `simpler_item` (easier) the same clue on an element in the first two
 *   rows (or, for outer electrons, in group 1 or 2), in no item of the session (`practiceLeaks`). Never offered on an
 *   item already that plain. A two-element compare has no simpler shape in the mode.
 */
import { leverSet } from '../../components/live-activity/bossLevers';
import { periodicTableCard } from '../periodicTable.card';
import { ELEMENTS } from './constants';
import {
  elementFactsOf, evalModeOf, itemFromChallenge, SIZE_COMPARE_GROUPS, type ElementFacts, type PeriodicTableItem,
} from './periodicTableDomain';

export const AXIS_LEVER = 'axis_marks';
export const RANGES_LEVER = 'row_ranges';
export const LETTER_LEVER = 'letter_lit';
export const KEY_LEVER = 'box_key';
export const PAIR_LEVER = 'pair_marks';
export const COLUMN_LEVER = 'column_model';
export const TALL_LEVER = 'tall_columns';
export const SIMPLER_LEVER = 'simpler_item';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** Fewer lit boxes than this and the lit set is the answer, not a narrowing. */
export const MIN_LIT = 3;

/** The clue an Element Hunt or Name It item gives. */
export const clueOf = (item: PeriodicTableItem) => item.kind === 'find' ? item.findBy : item.kind === 'name' ? item.clueBy : undefined;

/** Every element number an item names or asks about. */
const touched = (item: PeriodicTableItem) => item.pair ? item.pair.map(e => e.number) : item.element ? [item.element.number] : [];
const sessionNumbers = (items: readonly PeriodicTableItem[]) => new Set(items.flatMap(touched));

// ── letter_lit ───────────────────────────────────────────────────────────────

/** The leak rule: too few boxes lit (the lit set is the answer), or the asked box not among them. */
export const litLeaks = (lit: readonly number[], item: PeriodicTableItem) =>
  lit.length < MIN_LIT || !item.element || !lit.includes(item.element.number);

/** Name or symbol clue: the boxes whose name (or symbol) starts with the asked one's first letter; null when it leaks. */
export function letterLit(item: PeriodicTableItem): number[] | null {
  const by = clueOf(item), e = item.element;
  if (!e || (by !== 'name' && by !== 'symbol')) return null;
  const word = (x: { name: string; symbol: string }) => (by === 'name' ? x.name : x.symbol)[0].toLowerCase();
  const lit = ELEMENTS.filter(x => word(x) === word(e)).map(x => x.number);
  return litLeaks(lit, item) ? null : lit;
}

// ── row_ranges ───────────────────────────────────────────────────────────────

/** Each row's first and last atomic number (the detached rows count in their period). The same for every item. */
export const ROW_RANGES: ReadonlyArray<{ period: number; first: number; last: number }> = Array.from({ length: 7 }, (_, i) => {
  const row = ELEMENTS.filter(e => e.period === i + 1).map(e => e.number);
  return { period: i + 1, first: Math.min(...row), last: Math.max(...row) };
});

// ── box_key ──────────────────────────────────────────────────────────────────

/** Key elements, none of them in the simpler-item pool (the first two rows), so a key never answers a practice ask. */
const KEY_POOL = [29, 47, 79, 26, 30, 28, 50, 78, 80, 82];

/** The leak rule: the key element is an element some item of the session asks about. */
export const keyLeaks = (key: ElementFacts, items: readonly PeriodicTableItem[]) => sessionNumbers(items).has(key.number);

/** Name It: the element whose box the key shows, in no item of the session; null when none is left. */
export function boxKey(item: PeriodicTableItem, items: readonly PeriodicTableItem[]): ElementFacts | null {
  if (item.kind !== 'name') return null;
  const all = [...items, item];
  for (const n of KEY_POOL) {
    const key = elementFactsOf(n);
    if (key && !keyLeaks(key, all)) return key;
  }
  return null;
}

// ── column_model ─────────────────────────────────────────────────────────────

export interface ColumnModel { group: number; members: Array<{ name: string; shells: number }> }
const MODEL_GROUPS = [14, 18, 2, 13, 15, 16, 17, 1];

/** The leak rule: the model column is the pair's group, or holds an element some item of the session names. */
export function columnModelLeaks(model: ColumnModel, item: PeriodicTableItem, items: readonly PeriodicTableItem[]): boolean {
  const used = sessionNumbers([...items, item]);
  return model.group === item.pair?.[0].group || (SIZE_COMPARE_GROUPS[model.group] ?? []).some(n => used.has(n));
}

/** Size compare: a model column of another main group, each atom with its shell count (the circle's size). */
export function columnModel(item: PeriodicTableItem, items: readonly PeriodicTableItem[]): ColumnModel | null {
  if (item.kind !== 'compare' || item.axis !== 'size' || !item.pair) return null;
  for (const group of MODEL_GROUPS) {
    const members = (SIZE_COMPARE_GROUPS[group] ?? []).map(n => ELEMENTS.find(e => e.number === n)!)
      .map(e => ({ name: e.name, shells: e.electron_shells.length }));
    const model = { group, members };
    if (!columnModelLeaks(model, item, items)) return model;
  }
  return null;
}

// ── simpler_item ─────────────────────────────────────────────────────────────

/** First-two-row elements for a find or a name; group 1 and 2 elements for an outer-electron count. */
const PLAIN_POOL = [3, 4, 5, 6, 7, 8, 9, 10, 1, 2];
const PLAIN_VALENCE_POOL = [3, 4, 11, 12, 19, 20, 1];

/** Already the plainest shape: a find or a name in the first two rows, a count in group 1 or 2, any compare. */
const isPlainest = (item: PeriodicTableItem) => item.kind === 'compare' || !item.element
  || (item.kind === 'valence' ? (item.element.group ?? 0) <= 2 : item.element.period <= 2);

/** The leak rule: the practice item is not the same mode and clue, not plainer, or asks an element of the session. */
export function practiceLeaks(p: PeriodicTableItem, item: PeriodicTableItem, items: readonly PeriodicTableItem[]): boolean {
  const e = p.element;
  return !e || p.id !== `${item.id}${PRACTICE_SUFFIX}` || p.kind !== item.kind || clueOf(p) !== clueOf(item)
    || sessionNumbers([...items, item]).has(e.number) || !isPlainest(p);
}

/** The simpler item: the same clue on a plainer element no item of the session asks about; null on the plainest. */
export function periodicPracticeItem(item: PeriodicTableItem, items: readonly PeriodicTableItem[]): PeriodicTableItem | null {
  if (isPlainest(item)) return null;
  for (const n of item.kind === 'valence' ? PLAIN_VALENCE_POOL : PLAIN_POOL) {
    const p = itemFromChallenge({ id: `${item.id}${PRACTICE_SUFFIX}`, challengeType: item.challengeType,
      findBy: item.findBy, clueBy: item.clueBy, targetNumber: n }, item.tier);
    if (p && !practiceLeaks(p, item, items)) return p;
  }
  return null;
}

/** The session item a practice id stands in for. */
export const periodicPracticeParent = (id: string | null | undefined, items: readonly PeriodicTableItem[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── The lever set ────────────────────────────────────────────────────────────

const FIND_MISSES = ['same_first_letter', 'next_box', 'same_row', 'same_column', 'other_box'];
const VALENCE_MISSES = ['group_number', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];

/** What the set reads beyond the item: the session's items. */
export interface PeriodicLeverContext { items: readonly PeriodicTableItem[] }

/** The clue levers of Element Hunt and Name It: the same lever in both modes, its words by the mode's "never". */
const clueSpecs = (mode: 'explore' | 'identify', never: string, answers: 'all' | readonly string[]) => [
  { id: AXIS_LEVER, type: 'marks' as const, modes: [mode], answers,
    when: 'The learner lands in the wrong row or the wrong column, or cannot find where a group and a period meet.',
    does: `Rings the asked group number at the top of the table and the asked period number at the side; no box is marked. You may point to the two ringed numbers; ${never}.`,
    content: (item: PeriodicTableItem) => (clueOf(item) === 'position' ? item.element ?? null : null),
    fact: (e: ElementFacts) => `The group number ${e.group} at the top and the period number ${e.period} at the side are ringed; no box is marked.` },
  { id: RANGES_LEVER, type: 'legend' as const, modes: [mode], answers,
    when: 'The learner lands near the asked number but in the wrong box, or cannot find the row that holds it.',
    does: `Writes beside each period number the first and last atomic number of that row; no box is marked. You may point to the ranges; never say which row holds the asked number, and ${never}.`,
    offer: (item: PeriodicTableItem) => clueOf(item) === 'number',
    fact: 'Beside each period number, the first and last atomic number of that row is written; no box is marked.' },
  { id: LETTER_LEVER, type: 'marks' as const, modes: [mode], answers,
    when: 'The learner taps or names a box that only looks like the asked one, or cannot narrow the table down.',
    does: (item: PeriodicTableItem) => `Lights every box whose ${clueOf(item) === 'name' ? 'name' : 'symbol'} starts with the asked first letter and dims the rest. You may say the lit boxes are the ones to check; ${never}.`,
    content: (item: PeriodicTableItem) => letterLit(item),
    fact: (lit: number[], item: PeriodicTableItem) => {
      const by = clueOf(item) === 'name' ? 'name' : 'symbol';
      return `The ${lit.length} boxes whose ${by} starts with the letter ${(by === 'name' ? item.element!.name : item.element!.symbol)[0].toUpperCase()} are lit; the rest are dimmed.`;
    } },
];

export const PERIODIC_LEVERS = leverSet<PeriodicTableItem, PeriodicLeverContext>({
  modeOf: evalModeOf,
  missesOf: mode => periodicTableCard.modes[mode].misses,
  support: { tier: item => item.tier, different: 'another group\'s column, each atom drawn to its size',
    own: 'which of this pair is bigger' },
  specs: [
    ...clueSpecs('explore', 'never say or point to which box it is', 'all'),
    ...clueSpecs('identify', 'never say which element it is', ['next_box']),
    { id: KEY_LEVER, type: 'legend', modes: ['identify'], answers: ['said_symbol'],
      when: 'The learner reads the big letters back instead of the name, or is unsure which part of a box is the name.',
      does: (item, ctx) => `Draws a key beside the table: ${boxKey(item, ctx.items)?.name ?? 'another element'}'s box with its atomic number, symbol and name labelled. You may point to the key's labels; never read this item's box or say its name.`,
      content: (item, ctx) => boxKey(item, ctx.items),
      fact: (key: ElementFacts) => `Beside the table, a key: ${key.name}'s box, labelled "atomic number" on its ${key.number}, "symbol" on its ${key.symbol} and "name" on its ${key.name}. It is not this item's element.` },
    { id: COLUMN_LEVER, type: 'model', modes: ['trend'], answers: ['other_of_pair'],
      when: 'The learner picks the smaller atom of the two, or cannot say why one atom is bigger.',
      does: 'Draws a model column of another group beside the table, top to bottom, each atom as a circle of its size. You may point to the model and read its names; never say which of the learner\'s two is bigger, which sits lower, or the rule.',
      content: (item, ctx) => columnModel(item, ctx.items),
      fact: (model: ColumnModel) => `Beside the table, a model column of group ${model.group} (not this pair's group), top to bottom: ${model.members.map(m => m.name).join(', ')}, each with a circle drawn to its atom's size.` },
    { id: PAIR_LEVER, type: 'marks', modes: ['trend'], answers: ['other_of_pair'],
      when: 'The learner answers without finding both elements on the table.',
      does: 'Rings both named boxes on the table, alike. You may say both boxes are ringed; never say which is the answer, which sits lower, or the rule.',
      content: item => item.pair ?? null,
      fact: (pair: [ElementFacts, ElementFacts]) => `${pair[0].name}'s box and ${pair[1].name}'s box are ringed, alike.` },
    { id: TALL_LEVER, type: 'marks', modes: ['trend'], answers: VALENCE_MISSES,
      when: 'The learner says the group number, or miscounts the tall columns.',
      does: 'Dims the short middle block (groups 3 to 12) so only the tall columns stand out; no column is numbered or marked. You may point to the tall columns; never count them for the learner or say the number.',
      offer: item => item.kind === 'valence',
      fact: 'The short middle block (groups 3 to 12) is dimmed; the tall columns stand out. No column is numbered or marked.' },
    { id: SIMPLER_LEVER, type: 'easier', answers: 'all',
      answersOn: item => (item.kind === 'find' ? FIND_MISSES : item.kind === 'name' ? ['next_box', 'said_symbol'] : VALENCE_MISSES),
      when: 'The learner cannot do this item even with the help on screen: a plainer one first.',
      does: item => (item.kind === 'valence'
        ? 'Opens an ungraded practice item: the outer electrons of an element in group 1 or 2; then this item comes back.'
        : 'Opens an ungraded practice item with the same kind of clue on an element in the first two rows; then this item comes back.'),
      content: (item, ctx) => periodicPracticeItem(item, ctx.items) },
  ],
});

/** On easy, the help levers offered on the item start on screen; a starting position is not a pull. */
export const helpShownFromStart = (item: PeriodicTableItem | null, ctx: PeriodicLeverContext): string[] =>
  item?.tier === 'easy' ? PERIODIC_LEVERS.declare(item, ctx, []).filter(l => l.kind === 'help').map(l => l.id) : [];

