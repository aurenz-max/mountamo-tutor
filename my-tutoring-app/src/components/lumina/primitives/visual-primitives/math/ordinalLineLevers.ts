/**
 * The in-item levers on ordinal-line `build_sequence`, the one mode answered with the hands (`/add-support-tiers`,
 * handoff 21 M2; table qa/support-levers/m2-lever-tables-2026-09-28.md). The four spoken modes are a later slice.
 * No real-learner evidence: the misses are what `lineMiss` observes.
 *
 * - `front_flag` (help): a flag over the first place, the front end the task already names. Answers `reversed`.
 *   It marks the end, never a picture.
 * - `place_dots` (help): under each place, one dot for first, two for second, and so on, so a pre-reader can find the
 *   place a clue names without reading its label. Answers `place_left_empty`, `two_swapped`, `other_order`. Places
 *   only; never a picture.
 * - `three_places` (simplify): an ungraded build of three new characters from three clues, then the full item. Answers
 *   `two_swapped`, `other_order`, `place_left_empty`. Offered only when the item has more than three places.
 *
 * Printing the clues (the draft's `clue_cards`) is not a lever: every clue names an absolute place, so the cards
 * would lay out the whole line but one picture.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemsFromChallenge, type OrdinalLineItem } from './ordinalLineScript';

export const FLAG_LEVER = 'front_flag';
export const DOTS_LEVER = 'place_dots';
export const THREE_LEVER = 'three_places';

const CAST: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: 'Cat', emoji: '🐱' }, { name: 'Duck', emoji: '🦆' }, { name: 'Bear', emoji: '🐻' },
  { name: 'Frog', emoji: '🐸' }, { name: 'Owl', emoji: '🦉' }, { name: 'Pig', emoji: '🐷' },
];
// Spoken in the order second, third, first: never front to back.
const SPOKEN_PLACES = [2, 3, 1];

/** The easier build and the pictures it needs, or null when the item already has three places (or no cast fits). */
export function threePlaces(item: OrdinalLineItem | null): { item: OrdinalLineItem; emojis: Map<string, string> } | null {
  if (item?.kind !== 'build_sequence' || item.answerOrder.length <= 3) return null;
  const lower = item.lineNames.map(n => n.toLowerCase());
  const cast = CAST.filter(c => !lower.includes(c.name.toLowerCase())).slice(0, 3);
  if (cast.length < 3) return null;
  const built = itemsFromChallenge({ id: `${item.id}~simpler`, type: 'build-sequence', characters: cast,
    clues: cast.map((c, i) => ({ character: c.name, position: SPOKEN_PLACES[i] })), correctAnswer: '' },
  { band: item.band, context: item.context })[0];
  return built ? { item: built, emojis: new Map(cast.map(c => [c.name, c.emoji])) } : null;
}

export function ordinalLevers(item: OrdinalLineItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (item?.kind !== 'build_sequence') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  return [
    lever(FLAG_LEVER, 'help', 'both', ['reversed'], 'The learner builds the line from the wrong end.',
      'Puts a flag over the first place, the front of the line. Say which end is the front as you pull it.'),
    lever(DOTS_LEVER, 'help', 'shown', ['place_left_empty', 'two_swapped', 'other_order'],
      'The learner cannot find the place a clue names, or leaves places empty.',
      'Puts dots under each place: one under first, two under second, and so on. No picture is placed.'),
    ...(threePlaces(item) ? [lever(THREE_LEVER, 'simplify', 'both', ['two_swapped', 'other_order', 'place_left_empty'],
      'There are too many clues to hold yet.',
      'Opens an easier line first: three new pictures and three clues. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never a picture's place. */
export function leverFacts(item: OrdinalLineItem | null, pulled: readonly string[]): string {
  if (item?.kind !== 'build_sequence') return '';
  return [
    pulled.includes(FLAG_LEVER) && 'A flag marks the first place, the front of the line.',
    pulled.includes(DOTS_LEVER) && 'Dots under each place count its place: one under first, two under second.',
  ].filter((s): s is string => !!s).join(' ');
}
