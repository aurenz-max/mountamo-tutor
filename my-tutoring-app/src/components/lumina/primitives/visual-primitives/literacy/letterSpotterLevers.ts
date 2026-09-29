/**
 * The in-item levers on letter spotter's tap modes (`/add-support-tiers`, handoff 22 L1). name_it is spoken
 * and joins L2. Shape descriptions are banned in the tutor's voice, so every lever here is visual.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * find_it (the tutor names a letter; the learner taps it in a grid of capitals):
 * - `other_case_reference` (help): the named letter in LOWERCASE beside the grid. Answers
 *   `same_shape_family`. Leak rule: never the grid's own case, and only where the two cases differ in shape
 *   (a lowercase o beside a grid of capitals is the same glyph to find).
 * - `row_scan` (help): a highlight that sweeps the rows in turn, looping, alike on every row. Answers
 *   `other_letter`. Leak rule: it never stops on or marks the target's row.
 * - `small_far_grid` (simplify): a practice grid of four with a new letter the session never targets, the
 *   others from other shape families.
 * match_it (a big capital; the learner taps its lowercase):
 * - `wrong_choice_partner` (help): the capital of each letter the learner TAPPED wrongly, on that tile. Answers
 *   every miss. Leak rule: only the learner's own wrong choices, never the target's capital.
 * - `two_far_choices` (simplify): a practice item with a new capital and two lowercase choices, the foil from
 *   another shape family.
 * Every practice item is ungraded and uses no letter the session answers (the session invariant).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { LETTER_GROUPS, normalizeLetterGroup } from '../../../service/literacy/letterGroups';
import type { LetterSpotterItem } from './letterSpotterScript';
import { MIRRORS, SHAPE_FAMILIES } from './letterSpotterWorkspace';

export const CASE_LEVER = 'other_case_reference';
export const SCAN_LEVER = 'row_scan';
export const SMALL_GRID_LEVER = 'small_far_grid';
export const PARTNER_LEVER = 'wrong_choice_partner';
export const TWO_CHOICES_LEVER = 'two_far_choices';

/** Letters whose lowercase is the capital's shape at another size: a reference in the other case is the same glyph. */
const SAME_SHAPE_CASES = new Set('cosuvwxzkp'.split(''));
/** Capitals a K reader confuses by shape, beyond the lowercase families. */
const UPPER_NEAR = ['EF', 'MNW', 'OQCG', 'PRB', 'ILT', 'UV', 'KX', 'HN'];

const familyOf = (l: string) => SHAPE_FAMILIES.find(f => f.includes(l.toLowerCase())) ?? '';
const far = (a: string, b: string) => {
  const x = a.toLowerCase(), y = b.toLowerCase();
  if (x === y || familyOf(x).includes(y) || MIRRORS.has(x + y) || MIRRORS.has(y + x)) return false;
  return !UPPER_NEAR.some(g => g.includes(x.toUpperCase()) && g.includes(y.toUpperCase()));
};

export const hasOtherCaseShape = (letter: string) => !SAME_SHAPE_CASES.has(letter.toLowerCase());

/** Leak rule for the reference: true when it is drawn in the grid's own case or the cases share a shape. */
export const referenceLeaks = (item: LetterSpotterItem, drawn: string) =>
  drawn !== item.targetLetter.toLowerCase() || !hasOtherCaseShape(item.targetLetter)
  || (item.letterGrid ?? []).includes(drawn);

/** The capitals drawn on wrong tiles: the learner's own wrong taps, never the target. */
export const partnerCapitals = (item: LetterSpotterItem, wrongTaps: readonly string[]) =>
  Array.from(new Set(wrongTaps.map(l => l.toLowerCase()))).filter(l => l !== item.targetLetter.toLowerCase() && item.options.includes(l));

/** Every letter the session asks for. A practice item may answer none of them. */
export const sessionTargets = (items: readonly LetterSpotterItem[]) => new Set(items.map(i => i.targetLetter.toLowerCase()));

/** A stable spread of the target over the four cells, so it is not always first. */
const slot = (id: string) => Array.from(id).reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4;

/**
 * The practice item for `item`, or null: a new letter in the letter group that the session never targets, with
 * letters far from it and from each other. find_it: a grid of four capitals. match_it: two lowercase tiles.
 */
export function practiceItem(item: LetterSpotterItem, items: readonly LetterSpotterItem[], letterGroup: number | undefined): LetterSpotterItem | null {
  if (item.mode === 'name-it') return null;
  const group = LETTER_GROUPS[normalizeLetterGroup(letterGroup) ?? 4].filter(l => l.length === 1);
  const used = sessionTargets(items);
  const foilCount = item.mode === 'find-it' ? 3 : 1;
  for (const target of group.filter(l => !used.has(l) && hasOtherCaseShape(l))) {
    const foils: string[] = [];
    for (const l of group) {
      if (foils.length === foilCount) break;
      if (far(l, target) && foils.every(f => far(f, l))) foils.push(l);
    }
    if (foils.length < foilCount) continue;
    const base = { ...item, id: `${item.id}~simpler`, targetLetter: target };
    if (item.mode === 'match-it') return { ...base, options: [target, ...foils].sort() };
    const grid = foils.map(f => f.toUpperCase());
    grid.splice(slot(item.id), 0, target.toUpperCase());
    return { ...base, letterGrid: grid, options: [] };
  }
  return null;
}

/** Leak rule for a practice item: true if it answers a session letter or offers no far choice. */
export const practiceLeak = (practice: LetterSpotterItem, items: readonly LetterSpotterItem[]) =>
  sessionTargets(items).has(practice.targetLetter.toLowerCase())
  || (practice.mode === 'find-it' ? practice.letterGrid ?? [] : practice.options)
    .filter(l => l.toLowerCase() !== practice.targetLetter).some(l => !far(l, practice.targetLetter));

/** The levers this item declares. `wrongTaps`: the learner's wrong taps on this item so far. */
export function letterSpotterLevers(item: LetterSpotterItem | null, pulled: readonly string[], items: readonly LetterSpotterItem[],
  letterGroup: number | undefined, wrongTaps: readonly string[] = []): WorkspaceLever[] {
  if (!item || item.mode === 'name-it') return [];
  const levers: WorkspaceLever[] = [];
  const on = (id: string) => pulled.includes(id);
  if (item.mode === 'find-it') {
    if (hasOtherCaseShape(item.targetLetter)) levers.push({
      id: CASE_LEVER, kind: 'help', carrier: 'shown', pulled: on(CASE_LEVER), answers: ['same_shape_family'],
      when: 'The learner taps a letter that looks like the named one.',
      does: 'Shows the named letter as a small letter on a card beside the grid of big letters.',
    });
    levers.push({
      id: SCAN_LEVER, kind: 'help', carrier: 'shown', pulled: on(SCAN_LEVER), answers: ['other_letter'],
      when: 'The learner taps a letter that looks nothing like the named one, as if not searching.',
      does: 'A highlight sweeps the rows of the grid one at a time, over and over, so the learner can check each row in turn.',
    });
  } else if (partnerCapitals(item, wrongTaps).length || on(PARTNER_LEVER)) levers.push({
    id: PARTNER_LEVER, kind: 'help', carrier: 'shown', pulled: on(PARTNER_LEVER),
    answers: ['mirror_form', 'same_shape_family', 'other_letter'],
    when: 'The learner tapped a little letter that does not go with the big one.',
    does: 'Shows the big letter that goes with each little letter the learner tapped wrongly, on that tile.',
  });
  const simplify = practiceItem(item, items, letterGroup);
  if (simplify) {
    const find = item.mode === 'find-it';
    levers.push({
      id: find ? SMALL_GRID_LEVER : TWO_CHOICES_LEVER, kind: 'simplify', carrier: 'shown', pulled: on(find ? SMALL_GRID_LEVER : TWO_CHOICES_LEVER),
      answers: find ? ['same_shape_family', 'other_letter'] : ['mirror_form', 'same_shape_family', 'other_letter'],
      when: 'The learner cannot yet pick this letter out from letters like it.',
      does: `Opens an easier practice item first: a different letter, ${find ? 'in a grid of four' : 'with two little letters to choose from'}, `
        + 'the others shaped nothing like it. It is not graded; the full item comes back after it.',
    });
  }
  return levers;
}
