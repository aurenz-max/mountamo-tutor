/**
 * The in-item levers on classification-sorter `sort` (`/add-support-tiers`; report
 * qa/eval-reports/classification-sorter-levers-2026-10-09.md). No real-learner evidence: the misses are what
 * `sortMiss` observes, the failures behind them come from the catalog's commonStruggles.
 *
 * - `group_meaning` (help): each group card shows what its group means (the lesson's group descriptions; a group name in
 *   them reads "this group" or is blanked). Offered only where the descriptions are hidden (the pre-reader band) and none of them
 *   names the card. Answers every miss: the learner does not know what the groups mean.
 * - `card_clue` (help): the card's own clue shows under it, with every word of every group name blanked, so it never
 *   names a group (and never rules one out by name). Offered when the blanked clue still says something.
 * - `sorted_marks` (help): rings the cards already sorted in each group, to compare the card with. Offered once a group
 *   holds a sorted card. Answers wrong, repeated and sibling groups.
 *
 * No simplify lever: the one simpler shape of a sort is fewer groups, and on the learner's own card that leaves a
 * choice of two that hands over the answer; any other card is a later graded item of the same lesson.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ClassificationCategory, ClassificationItem } from './ClassificationSorter';
import type { SortMiss } from './classificationSorterWorkspace';

export const MEANING_LEVER = 'group_meaning';
export const CLUE_LEVER = 'card_clue';
export const MARKS_LEVER = 'sorted_marks';

const BLANK = '___';
/** Words of a group name that say nothing about the group. */
const FILLER = new Set(['the', 'and', 'for', 'are', 'its']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words a group name is made of, as stems (lowercase, a plural s off), 3 letters or more. */
export function groupWords(categories: readonly ClassificationCategory[]): string[] {
  const words = categories.flatMap(c => c.label.toLowerCase().split(/[^a-z]+/))
    .filter(w => w.length >= 3 && !FILLER.has(w)).map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
  return Array.from(new Set(words)).sort((a, b) => b.length - a.length);
}

/** `text` with every word built on a group-name stem blanked ("Mammals" also takes "mammal", "wings" takes "wing"). */
export function blankGroupWords(text: string, categories: readonly ClassificationCategory[]): string {
  return groupWords(categories).reduce(
    (out, stem) => out.replace(new RegExp(`\\b${escape(stem)}[a-z]*\\b`, 'gi'), BLANK), text);
}

/** Whether `text` names a group: a word built on one of the group-name stems. The leak rule of both text levers. */
export const namesAGroup = (text: string, categories: readonly ClassificationCategory[]) =>
  groupWords(categories).some(stem => new RegExp(`\\b${escape(stem)}`, 'i').test(text));

const namesCard = (text: string, item: ClassificationItem) =>
  new RegExp(`\\b${escape(item.label.toLowerCase())}`, 'i').test(text);

/**
 * The group descriptions as the meaning lever shows them, or null when one names the card or one is empty. A group's own
 * name in its description reads "this group" and another group's name is blanked, so no description repeats a name.
 */
export function groupMeanings(categories: readonly ClassificationCategory[], item: ClassificationItem): Record<string, string> | null {
  if (categories.some(c => !c.description?.trim() || namesCard(c.description, item))) return null;
  const name = (label: string) => new RegExp(`\\b${escape(label)}\\b`, 'gi');
  return Object.fromEntries(categories.map(c => [c.id, categories.reduce(
    (out, other) => out.replace(name(other.label), other.id === c.id ? 'this group' : BLANK), c.description.trim())]));
}

/** The card's clue as the lever shows it, or null when, blanked, it says too little. */
export function cardClue(item: ClassificationItem, categories: readonly ClassificationCategory[]): string | null {
  const clue = blankGroupWords(item.hint ?? '', categories).trim();
  const words = clue.replace(/_+/g, ' ').split(/\s+/).filter(w => /[a-z]/i.test(w));
  return words.length >= 3 ? clue : null;
}

export interface SortLeverView {
  /** Whether the group descriptions are already on screen (every band but the pre-reader one). */
  descriptionsShown: boolean;
  /** How many cards sit sorted in the groups now. */
  sortedCount: number;
}

const ALL: readonly SortMiss[] = ['repeated_group', 'parent_group', 'sibling_group', 'wrong_group'];

export function sortLevers(item: ClassificationItem | null, categories: readonly ClassificationCategory[],
  view: SortLeverView, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, carrier: WorkspaceLever['carrier'], answers: readonly SortMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind: 'help', carrier, pulled: pulled.includes(id), answers, when, does });
  return [
    ...(!view.descriptionsShown && groupMeanings(categories, item) ? [lever(MEANING_LEVER, 'both', ALL,
      'The learner does not know what the groups mean.',
      'Shows under each group name what that group means. Say it aloud for a learner who cannot read.')] : []),
    ...(cardClue(item, categories) ? [lever(CLUE_LEVER, 'both', ALL,
      'The learner does not know what to look for in the thing on the card.',
      'Shows a clue under the card about the thing on it; it names no group. Say it aloud for a learner who cannot read.')] : []),
    ...(view.sortedCount > 0 ? [lever(MARKS_LEVER, 'shown', ['repeated_group', 'sibling_group', 'wrong_group'],
      'The learner guesses without comparing the card with what is already sorted.',
      'Rings the cards already sorted in each group, so the card can be compared with them.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never the card's group. */
export function leverFact(item: ClassificationItem | null, categories: readonly ClassificationCategory[],
  pulled: readonly string[]): string {
  if (!item) return '';
  const meanings = pulled.includes(MEANING_LEVER) ? groupMeanings(categories, item) : null;
  const clue = pulled.includes(CLUE_LEVER) ? cardClue(item, categories) : null;
  return [
    // By position in the groups list, not by name: a fact that repeats a group name beside the card reads as a pointer.
    meanings && `Under each group name, in the order of the groups: ${categories.map((c, i) => `${i + 1}. "${meanings[c.id]}"`).join(' ')}`,
    clue && `Under the card, a clue: "${clue}".`,
    pulled.includes(MARKS_LEVER) && 'The cards already sorted are ringed in their groups.',
  ].filter((s): s is string => !!s).join(' ');
}
