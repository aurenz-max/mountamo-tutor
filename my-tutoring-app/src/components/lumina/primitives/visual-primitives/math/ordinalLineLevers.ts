/**
 * The in-item levers on ordinal-line, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 21 M2 for the
 * build and handoff 23 for the spoken modes; tables qa/support-levers/m2-lever-tables-2026-09-28.md). No real-learner
 * evidence: the misses are what `lineMiss` and `ordinalSpokenMisses` name. Pure: the component draws a pulled lever.
 *
 * build_sequence (answered with the hands):
 * - `front_flag` (marks): a flag over the first place, the front end the task names. It marks the end, never a picture.
 * - `place_dots` (marks): one dot under first, two under second, and so on; places only, never a picture.
 * - `three_places` (easier): an ungraded build of three new characters from three clues spoken second, third, first,
 *   then the full item. Only on a line of more than three. Printing the clues is not a lever: every clue names an
 *   absolute place, so printed clues would lay out the whole line.
 * The spoken modes:
 * - `front_flag` (identify, relative_position; marks): a flag at the front of the line.
 * - `tap_marks` (identify; marks): the learner's taps ring pictures on the line; no order, no number.
 * - `word_model` (identify where the answer is a place word, sequence_story; legend): three plain circles with 1st,
 *   2nd, 3rd under them, the same for every item, never on the item's line.
 * - `side_model` (relative_position; model): three plain circles, the middle ringed and the one right before (or
 *   after) it glowing: a different line, solved, fixed per question word.
 * - `place_model` (match; custom): plain circles from a flagged front up to the place the card prints, the last one
 *   ringed, no words.
 * - `shorter_line` (identify, relative_position; easier) and `short_story` (sequence_story; easier): an ungraded item
 *   of the same mode with new characters, another place than the item, then the full item.
 * No lever's scene fact names a character or carries a digit; the place labels on the line stay a post-credit reveal,
 * so `place_dots` is never offered on a spoken line, where dots under the line would count the answer.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { ordinalLineCard } from './ordinalLine.card';
import { itemsFromChallenge, ordinalWordFor, type OrdinalLineItem } from './ordinalLineDomain';

export const FLAG_LEVER = 'front_flag';
export const DOTS_LEVER = 'place_dots';
export const THREE_LEVER = 'three_places';
export const TAP_LEVER = 'tap_marks';
export const WORD_MODEL_LEVER = 'word_model';
export const SIDE_MODEL_LEVER = 'side_model';
export const PLACE_MODEL_LEVER = 'place_model';
export const SHORTER_LEVER = 'shorter_line';
export const STORY_LEVER = 'short_story';

/** The characters an easier item is built from: never the item's own. */
export const CAST: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: 'Cat', emoji: '🐱' }, { name: 'Duck', emoji: '🦆' }, { name: 'Bear', emoji: '🐻' },
  { name: 'Frog', emoji: '🐸' }, { name: 'Owl', emoji: '🦉' }, { name: 'Pig', emoji: '🐷' },
];
/** The picture of an easier item's character. */
export const castEmoji = (name: string) => CAST.find(c => c.name === name)?.emoji;

// Spoken in the order second, third, first: never front to back.
const SPOKEN_PLACES = [2, 3, 1];

const castFor = (item: OrdinalLineItem, n: number) => {
  const own = new Set([...item.lineNames, ...item.clues.map(c => c.name)].map(s => s.toLowerCase()));
  const cast = CAST.filter(c => !own.has(c.name.toLowerCase())).slice(0, n);
  return cast.length === n ? cast : null;
};

/** The easier build, or null when the item already has three places (or no cast fits). */
export function threePlaces(item: OrdinalLineItem | null): OrdinalLineItem | null {
  if (item?.kind !== 'build_sequence' || item.answerOrder.length <= 3) return null;
  const cast = castFor(item, 3);
  if (!cast) return null;
  return itemsFromChallenge({ id: `${item.id}~simpler`, type: 'build-sequence', characters: cast,
    clues: cast.map((c, i) => ({ character: c.name, position: SPOKEN_PLACES[i] })), correctAnswer: '' },
  { band: item.band, context: item.context })[0] ?? null;
}

/** The easier line (identify, relative_position), or null when the item is already this short. */
export function shorterLine(item: OrdinalLineItem | null): OrdinalLineItem | null {
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
  return built ?? null;
}

/** The easier story: four new characters told front to back, asking a middle place the item does not. */
export function shortStory(item: OrdinalLineItem | null): OrdinalLineItem | null {
  if (item?.kind !== 'sequence_story') return null;
  const cast = castFor(item, 4);
  if (!cast) return null;
  const storyText = cast.map((c, i) => `The ${c.name} is ${ordinalWordFor(i + 1)}.`).join(' ');
  for (let k = 0; k < 8; k++) {
    const built = itemsFromChallenge({ id: `${item.id}~simpler${k || ''}`, type: 'sequence-story', characters: cast, storyText,
      clues: cast.map((c, i) => ({ character: c.name, position: i + 1 })) }, { band: item.band, context: item.context })[0];
    if (built && built.askPosition !== item.askPosition) return { ...built, id: `${item.id}~simpler` };
  }
  return null;
}

/** An easier item rebuilt from its id (`<parent>~simpler`), for the journey harness. */
export function practiceFromId(id: string, items: readonly OrdinalLineItem[]): OrdinalLineItem | null {
  const parent = items.find(i => `${i.id}~simpler` === id);
  if (!parent) return null;
  return parent.kind === 'build_sequence' ? threePlaces(parent)
    : parent.kind === 'sequence_story' ? shortStory(parent) : shorterLine(parent);
}

/** The three-place model of `side_model`: which circle is ringed (the anchor) and which glows. Fixed per query. */
export const sideModel = (query: 'before' | 'after') => ({ ringed: 1, glow: query === 'before' ? 0 : 2 });

/** The model of `place_model`: circles up to the card's place, the last ringed. */
export const placeModel = (item: OrdinalLineItem) => (item.kind === 'match' ? item.askPosition : 0);

const PRACTICE = 'Opens an easier one of the same kind first, with new characters. It is not graded; the full item comes back after it.';

export const ORDINAL_LEVERS = leverSet<OrdinalLineItem, null>({
  modeOf: item => item.kind,
  missesOf: mode => ordinalLineCard.modes[mode].misses,
  // Only relative_position has a model lever; the set states no support rule in the other modes.
  support: { tier: item => item.supportTier ?? 'medium', different: 'a different line of three plain circles',
    own: 'who is right before or after this place' },
  specs: [
    // build_sequence
    { id: FLAG_LEVER, type: 'marks', modes: ['build_sequence'], carrier: 'both', answers: ['reversed'],
      when: 'The learner builds the line from the wrong end.',
      does: 'Puts a flag over the first place, the front of the line. Say which end is the front as you pull it.',
      fact: 'A flag marks the first place, the front of the line.' },
    { id: DOTS_LEVER, type: 'marks', modes: ['build_sequence'], answers: ['place_left_empty', 'two_swapped', 'other_order'],
      when: 'The learner cannot find the place a clue names, or leaves places empty.',
      does: 'Puts dots under each place: one under first, two under second, and so on. No picture is placed.',
      fact: 'Dots under each place count its place: one under first, two under second.' },
    { id: THREE_LEVER, type: 'easier', modes: ['build_sequence'], answers: ['two_swapped', 'other_order', 'place_left_empty'],
      when: 'There are too many clues to hold yet.',
      does: 'Opens an easier line first: three new pictures and three clues. It is not graded; the full item comes back after it.',
      content: item => threePlaces(item) },
    // The spoken modes
    { id: FLAG_LEVER, type: 'marks', modes: ['identify', 'relative_position'], carrier: 'both', answers: ['wrong_end', 'wrong_side'],
      answersOn: item => (item.kind === 'identify' ? ['wrong_end'] : ['wrong_side']),
      when: 'The learner counts from the other end of the line.',
      does: 'Puts a flag at the front of the line. Say which end is the front as you pull it.',
      fact: 'A flag marks the front of the line.' },
    { id: TAP_LEVER, type: 'marks', modes: ['identify'], answers: ['next_to_place'],
      when: 'The learner lands one place away while counting the line.',
      does: 'Lets the learner tap each picture as they count it; a tapped picture gets a ring. No numbers.',
      fact: 'The pictures on the line can be tapped; each tapped one gets a ring.' },
    { id: WORD_MODEL_LEVER, type: 'legend', modes: ['identify', 'sequence_story'], carrier: 'both', answers: ['cardinal_for_ordinal'],
      offer: item => item.responseClass === 'ordinal_word',
      when: 'The learner says the counting number instead of the place word.',
      does: 'Shows a model of three plain circles beside the line with 1st, 2nd, 3rd under them. Say only those three place words as you point; '
        + 'never go on to the place the question asks about.',
      fact: 'Beside the line, a model of three plain circles shows the place symbols for first, second and third. It is not this line.' },
    { id: SIDE_MODEL_LEVER, type: 'model', modes: ['relative_position'], answers: ['said_anchor', 'wrong_side'],
      when: 'The learner names the marked one, or the one on its other side.',
      does: item => `Shows a model of three plain circles beside the line, the front flagged, the middle one ringed and the one right ${item.relativeQuery} it glowing. `
        + 'Point at the model, not the line: naming the pictures on the line up to the marked one names the answer.',
      fact: (_content, item) => `Beside the line, a model of three plain circles, its front flagged, shows the one right ${item.relativeQuery} `
        + 'the ringed middle one glowing. It is not this line.' },
    { id: PLACE_MODEL_LEVER, type: 'custom', carrier: 'both', modes: ['match'], answers: ['cardinal_for_ordinal', 'next_to_place'],
      why: 'it draws the place the card already prints as plain circles counted from a flagged front; no stock type draws a '
        + 'new picture of the item\'s own quantity, and it shows no other item solved',
      when: 'The learner says the counting number, or a place word one away.',
      does: 'Shows plain circles from a flagged front up to the place on the card, the last one ringed. No words: count them with place words.',
      fact: 'Beside the card, plain circles from a flagged front count up to the card\'s place, the last one ringed. No words.' },
    { id: SHORTER_LEVER, type: 'easier', modes: ['identify', 'relative_position'],
      answers: ['wrong_end', 'next_to_place', 'said_anchor', 'wrong_side'],
      answersOn: item => (item.kind === 'identify' ? ['wrong_end', 'next_to_place'] : ['said_anchor', 'wrong_side']),
      when: item => (item.kind === 'identify' ? 'This line is too long to count yet.' : 'This line is too long to hold yet.'),
      does: PRACTICE, content: item => shorterLine(item) },
    { id: STORY_LEVER, type: 'easier', modes: ['sequence_story'], carrier: 'voiced', answers: ['next_to_place', 'cardinal_for_ordinal'],
      when: 'The story has too many characters to hold yet.', does: PRACTICE, content: item => shortStory(item) },
  ],
});
