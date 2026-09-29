/**
 * The in-item levers on ordinal-line's four spoken modes (`/add-support-tiers`, handoff 23 step 2; table
 * qa/support-levers/m2-lever-tables-2026-09-28.md, spoken slice). No real-learner evidence: the misses are what
 * `ordinalSpokenMisses` names (the counting number for the place word, the other end, one place away, the anchor, the
 * other side).
 *
 * Help (the screen shows more; the question is unchanged):
 * - `front_flag` (identify, relative_position): a flag at the front end of the line, the end the ask names. Answers
 *   the line counted from the other end. It marks the end, never a picture.
 * - `tap_marks` (identify): the pictures on the line can be tapped; a tapped one gets a ring. Answers one place away.
 *   It rings only what the learner tapped, in no order and with no number.
 * - `word_model` (identify when the answer is a place word, sequence_story): beside the line, a model of three plain
 *   circles with the place symbols 1st, 2nd, 3rd under them. Answers the counting number for the place word. Leak
 *   rule: the same three places for every item, never on the item's line.
 * - `side_model` (relative_position): a model of three plain circles, the front flagged, the middle one ringed and the
 *   one right before (or after) it glowing. Answers the anchor said, the other side. Fixed per question word.
 * - `place_model` (match): plain circles from a flagged front up to the card's place, the last one ringed, no words.
 *   Answers the counting number, one place away. It counts the place the card already prints; it never says its word.
 * Simplify (an ungraded easier item of the same mode, three or four new characters, then the full item):
 * - `shorter_line` (identify, relative_position): a line of four (identify) or three (relative_position) new
 *   characters. On identify it asks another place than the item. Only when the item's line is longer, or asks past
 *   third.
 * - `short_story` (sequence_story): a four-character story told front to back, asking another middle place.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { CAST } from './ordinalLineLevers';
import { itemsFromChallenge, ordinalWordFor, type OrdinalLineItem } from './ordinalLineScript';

export const FRONT_LEVER = 'front_flag';
export const TAP_LEVER = 'tap_marks';
export const WORD_MODEL_LEVER = 'word_model';
export const SIDE_MODEL_LEVER = 'side_model';
export const PLACE_MODEL_LEVER = 'place_model';
export const SHORTER_LEVER = 'shorter_line';
export const STORY_LEVER = 'short_story';

type Easier = { item: OrdinalLineItem; emojis: Map<string, string> };

/** The three-place model of `side_model`: which circle is ringed (the anchor) and which glows. Fixed per query. */
export const sideModel = (query: 'before' | 'after') => ({ ringed: 1, glow: query === 'before' ? 0 : 2 });

/** The model of `place_model`: circles up to the card's place, the last ringed. */
export const placeModel = (item: OrdinalLineItem) => item.kind === 'match' ? item.askPosition : 0;

const castFor = (item: OrdinalLineItem, n: number) => {
  const own = new Set([...item.lineNames, ...item.clues.map(c => c.name)].map(s => s.toLowerCase()));
  const cast = CAST.filter(c => !own.has(c.name.toLowerCase())).slice(0, n);
  return cast.length === n ? cast : null;
};

/** The easier line (identify, relative_position), or null when the item is already this short. */
export function shorterLine(item: OrdinalLineItem | null): Easier | null {
  if (item?.kind !== 'identify' && item?.kind !== 'relative_position') return null;
  const n = item.kind === 'identify' ? 4 : 3;
  if (item.lineNames.length <= n && item.askPosition <= 3) return null;
  const cast = castFor(item, n);
  if (!cast) return null;
  const ctx = { band: item.band, context: item.context };
  const id = `${item.id}~simpler`;
  const built = item.kind === 'identify'
    ? itemsFromChallenge({ id, type: 'identify', characters: cast, targetPosition: item.askPosition === 3 ? 2 : 3,
      correctAnswer: item.askPosition === 3 ? 2 : 3 }, ctx)[0]
    : itemsFromChallenge({ id, type: 'relative-position', characters: cast, targetPosition: 2, relativeQuery: item.relativeQuery,
      correctAnswer: cast[item.relativeQuery === 'before' ? 0 : 2].name }, ctx)[0];
  return built ? { item: built, emojis: new Map(cast.map(c => [c.name, c.emoji])) } : null;
}

/** The easier story: four new characters told front to back, asking a middle place the item does not. */
export function shortStory(item: OrdinalLineItem | null): Easier | null {
  if (item?.kind !== 'sequence_story') return null;
  const cast = castFor(item, 4);
  if (!cast) return null;
  const storyText = cast.map((c, i) => `The ${c.name} is ${ordinalWordFor(i + 1)}.`).join(' ');
  for (let k = 0; k < 8; k++) {
    const built = itemsFromChallenge({ id: `${item.id}~simpler${k || ''}`, type: 'sequence-story', characters: cast, storyText,
      clues: cast.map((c, i) => ({ character: c.name, position: i + 1 })) }, { band: item.band, context: item.context })[0];
    if (built && built.askPosition !== item.askPosition)
      return { item: { ...built, id: `${item.id}~simpler` }, emojis: new Map(cast.map(c => [c.name, c.emoji])) };
  }
  return null;
}

export function ordinalSpokenLevers(item: OrdinalLineItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || item.answerKind === 'gesture') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const practiceDoes = 'Opens an easier one of the same kind first, with new characters. It is not graded; the full item comes back after it.';
  const flag = (answers: string[]) => lever(FRONT_LEVER, 'help', 'both', answers, 'The learner counts from the other end of the line.',
    'Puts a flag at the front of the line. Say which end is the front as you pull it.');
  const wordModel = lever(WORD_MODEL_LEVER, 'help', 'both', ['cardinal_for_ordinal'], 'The learner says the counting number instead of the place word.',
    'Shows a model of three plain circles beside the line with 1st, 2nd, 3rd under them. Say only those three place words as you point; '
      + 'never go on to the place the question asks about.');
  switch (item.kind) {
    case 'identify': return [
      flag(['wrong_end']),
      lever(TAP_LEVER, 'help', 'shown', ['next_to_place'], 'The learner lands one place away while counting the line.',
        'Lets the learner tap each picture as they count it; a tapped picture gets a ring. No numbers.'),
      ...(item.direction === 'name_place' ? [wordModel] : []),
      ...(shorterLine(item) ? [lever(SHORTER_LEVER, 'simplify', 'both', ['wrong_end', 'next_to_place'], 'This line is too long to count yet.', practiceDoes)] : [])];
    case 'relative_position': return [
      flag(['wrong_side']),
      lever(SIDE_MODEL_LEVER, 'help', 'both', ['said_anchor', 'wrong_side'], `The learner names the marked one, or the one on its other side.`,
        `Shows a model of three plain circles beside the line, the front flagged, the middle one ringed and the one right ${item.relativeQuery} it glowing. `
          + 'Point at the model, not the line: naming the pictures on the line up to the marked one names the answer.'),
      ...(shorterLine(item) ? [lever(SHORTER_LEVER, 'simplify', 'both', ['said_anchor', 'wrong_side'], 'This line is too long to hold yet.', practiceDoes)] : [])];
    case 'match': return [lever(PLACE_MODEL_LEVER, 'help', 'both', ['cardinal_for_ordinal', 'next_to_place'],
      'The learner says the counting number, or a place word one away.',
      'Shows plain circles from a flagged front up to the place on the card, the last one ringed. No words: count them with place words.')];
    case 'sequence_story': return [wordModel,
      ...(shortStory(item) ? [lever(STORY_LEVER, 'simplify', 'voiced', ['next_to_place', 'cardinal_for_ordinal'],
        'The story has too many characters to hold yet.', practiceDoes)] : [])];
    default: return [];
  }
}

/** What the pulled levers put on screen, as a scene fact. Never a picture's place, the answer, or a digit. */
export function spokenLeverFacts(item: OrdinalLineItem | null, pulled: readonly string[]): string {
  if (!item || item.answerKind === 'gesture') return '';
  return [
    pulled.includes(FRONT_LEVER) && 'A flag marks the front of the line.',
    pulled.includes(TAP_LEVER) && 'The pictures on the line can be tapped; each tapped one gets a ring.',
    pulled.includes(WORD_MODEL_LEVER) && 'Beside the line, a model of three plain circles shows the place symbols for first, second and third. It is not this line.',
    pulled.includes(SIDE_MODEL_LEVER) && item.kind === 'relative_position'
      && `Beside the line, a model of three plain circles, its front flagged, shows the one right ${item.relativeQuery} the ringed middle one glowing. It is not this line.`,
    pulled.includes(PLACE_MODEL_LEVER) && 'Beside the card, plain circles from a flagged front count up to the card\'s place, the last one ringed. No words.',
  ].filter((s): s is string => !!s).join(' ');
}
