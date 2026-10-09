/**
 * length-lab's in-item levers (/add-support-tiers; report qa/eval-reports/length-lab-levers-2026-10-09.md). The misses
 * are what `lengthMiss` observes; there is no real-learner evidence. K band: every help lever changes the picture, and
 * any words on it (the word model's tags, the chain model's captions) are read aloud by the tutor.
 *
 * - compare: `word_model` (help) a picture outside the item of what longer, shorter and same look like on plain grey
 *   bars; `end_lines` (help) each bar's far end carried down across both bars; `unit_marks` (help) each bar split into
 *   unit cells, only where the session hides them; `far_pair` (simplify) two plain objects far apart in length, when
 *   the item's two lengths are close.
 * - tile_and_count / estimate_then_tile: `object_outline` (help) a dashed outline of the object's length behind the
 *   learner's units, so a gap, an overlap or a stop short shows; `shorter_object` (simplify) a plain object about half
 *   as long, same unit, its own guesses.
 * - two_unit_compare: `unit_model` (help) a plain grey bar outside the item measured once with small squares and once
 *   with big squares; `shorter_object` (simplify) a shorter plain object measured with another pair of units.
 * - order: `order_steps` (help) three wordless bars under the slots growing the way the slots run; `end_lines`;
 *   `unit_marks` (where hidden); `far_three` (simplify) three plain objects far apart, when two of the item's are close.
 * - indirect: `chain_model` (help) three plain bars outside the item lined up at one start, with the two "shorter than"
 *   captions that chain them. No simplify: the reference step is the mode's defining property.
 *
 * Leak rules (code, `*Leaks`): no lever text or scene fact carries a digit; a model never uses one of the item's
 * object names; a practice item never repeats the learner's object, length or count, and never its units.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { LengthLabChallenge } from './LengthLab';
import type { LengthMiss } from './lengthLabWorkspace';

export const WORD_MODEL_LEVER = 'word_model';
export const END_LINES_LEVER = 'end_lines';
export const UNIT_MARKS_LEVER = 'unit_marks';
export const FAR_PAIR_LEVER = 'far_pair';
export const OUTLINE_LEVER = 'object_outline';
export const SHORTER_LEVER = 'shorter_object';
export const UNIT_MODEL_LEVER = 'unit_model';
export const ORDER_STEPS_LEVER = 'order_steps';
export const FAR_THREE_LEVER = 'far_three';
export const CHAIN_MODEL_LEVER = 'chain_model';

const SIMPLER = '~simpler';
export const isPracticeLength = (c: Pick<LengthLabChallenge, 'id'>) => c.id.endsWith(SIMPLER);

/** Plain nouns for a practice object; the first one no item object is named. */
const NOUNS = ['ribbon', 'stick', 'rope', 'scarf'];
const itemNames = (c: LengthLabChallenge) => [c.objectName0, c.objectName1, c.objectName2, c.referenceObjectName]
  .filter((n): n is string => !!n).map(n => n.toLowerCase());
const freeNoun = (c: LengthLabChallenge) => NOUNS.find(n => !itemNames(c).some(name => name.includes(n) || n.includes(name)));

/** Two of the item's lengths within this many cells read as close. */
const CLOSE = 2;
const lengthsOf = (c: LengthLabChallenge) => [c.objectLength0, c.objectLength1, c.objectLength2]
  .filter((n): n is number => typeof n === 'number');

// ── simplify builders ──────────────────────────────────────────────────────

/** compare: two plain objects far apart, the answer word the other one from the item's. Null on a same item. */
export function farPair(c: LengthLabChallenge): LengthLabChallenge | null {
  if (c.type !== 'compare' || isPracticeLength(c) || c.correctAnswer === 'same') return null;
  if (Math.abs(c.objectLength0 - c.objectLength1) > CLOSE) return null;
  const noun = freeNoun(c);
  if (!noun) return null;
  // The item asked "longer": the practice asks the first object to be the shorter one, and the other way round.
  const firstLong = c.correctAnswer === 'shorter';
  const [l0, l1] = firstLong ? [9, 3] : [3, 9];
  return {
    ...c, id: `${c.id}${SIMPLER}`,
    instruction: `Look at the blue ${noun} and the green ${noun}. Which one is longer?`,
    objectName0: `blue ${noun}`, objectLength0: l0, objectColor0: '#4A90D9',
    objectName1: `green ${noun}`, objectLength1: l1, objectColor1: '#81C784',
    correctAnswer: firstLong ? 'longer' : 'shorter',
  };
}

/** order: three plain objects far apart; listed (and drawn, alphabetically) never in answer order. */
export function farThree(c: LengthLabChallenge): LengthLabChallenge | null {
  if (c.type !== 'order' || isPracticeLength(c)) return null;
  const ls = [...lengthsOf(c)].sort((a, b) => a - b);
  if (!ls.some((l, i) => i > 0 && l - ls[i - 1] <= CLOSE)) return null;
  const noun = freeNoun(c);
  if (!noun) return null;
  // Alphabetical (the drawing's order) is blue, green, pink: middle, longest, shortest.
  const objs = [{ name: `blue ${noun}`, length: 6, color: '#4A90D9' }, { name: `green ${noun}`, length: 10, color: '#81C784' },
    { name: `pink ${noun}`, length: 2, color: '#F06292' }];
  const answer = [...objs].sort((a, b) => a.length - b.length).map(o => o.name).join(',');
  return {
    ...c, id: `${c.id}${SIMPLER}`,
    instruction: `Put the three ${noun}s in order from shortest to longest!`,
    objectName0: objs[0].name, objectLength0: objs[0].length, objectColor0: objs[0].color,
    objectName1: objs[1].name, objectLength1: objs[1].length, objectColor1: objs[1].color,
    objectName2: objs[2].name, objectLength2: objs[2].length, objectColor2: objs[2].color,
    correctAnswer: answer, correctOrderCsv: answer,
  };
}

/** Practice unit pairs for two_unit_compare: small first, the bigger one drawn wider. */
const UNIT_PAIRS: ReadonlyArray<readonly [string, string]> = [['paper_clips', 'erasers'], ['cubes', 'bears'], ['fingers', 'hands']];

/**
 * tile_and_count / estimate_then_tile: a plain object about half as long (at least 2), same unit, with its own four
 * guesses around its count. two_unit_compare: a plain object of four small units and two big ones, measured with a
 * pair of units the item does not use. Null on a short item (nothing shorter to ask) and on a practice item.
 */
export function shorterObject(c: LengthLabChallenge, sessionUnit = 'cubes'): LengthLabChallenge | null {
  if (isPracticeLength(c)) return null;
  const noun = freeNoun(c);
  if (!noun) return null;
  const count = c.correctUnitCount || c.objectLength0;
  if (c.type === 'tile_and_count' || c.type === 'estimate_then_tile') {
    if (count < 4) return null;
    const n = Math.max(2, Math.floor(count / 2));
    const unit = (c.unitType || sessionUnit).replace('_', ' ');
    const start = Math.max(1, n - 1);
    return {
      ...c, id: `${c.id}${SIMPLER}`,
      instruction: c.type === 'estimate_then_tile'
        ? `Look at the ${noun}. Guess how many ${unit} long it is, then measure it!`
        : `How many ${unit} long is the ${noun}?`,
      objectName0: noun, objectLength0: n, correctUnitCount: n, correctAnswer: String(n),
      estimateOptions: c.type === 'estimate_then_tile' ? [start, start + 1, start + 2, start + 3] : undefined,
    };
  }
  if (c.type === 'two_unit_compare') {
    if (c.objectLength0 <= 4) return null;
    const used = [c.unitType || sessionUnit, c.unitTypeB || sessionUnit];
    const pair = UNIT_PAIRS.find(p => !p.some(u => used.includes(u)));
    if (!pair) return null;
    return {
      ...c, id: `${c.id}${SIMPLER}`,
      instruction: `Measure the ${noun} with ${pair[0].replace('_', ' ')} and then with ${pair[1].replace('_', ' ')}. Which one do you need more of?`,
      objectName0: noun, objectLength0: 4, unitType: pair[0], correctUnitCount: 4, unitTypeB: pair[1], correctUnitCountB: 2,
      correctAnswer: pair[0],
    };
  }
  return null;
}

/** The simpler item a simplify lever opens, by mode. */
export function simplerLength(c: LengthLabChallenge, sessionUnit = 'cubes'): LengthLabChallenge | null {
  if (c.type === 'compare') return farPair(c);
  if (c.type === 'order') return farThree(c);
  return shorterObject(c, sessionUnit);
}

/**
 * Leak rule for a practice item: never the learner's item (its id, an object name, its length or count), and on
 * two_unit_compare never either of its units. The answer is recomputed and the mode is unchanged.
 */
export function simplerLeaks(parent: LengthLabChallenge, simpler: LengthLabChallenge, sessionUnit = 'cubes'): boolean {
  if (simpler.id === parent.id || simpler.type !== parent.type) return true;
  const names = itemNames(parent);
  const newNames = [simpler.objectName0, ...(parent.type === 'compare' || parent.type === 'order' ? [simpler.objectName1] : []),
    ...(parent.type === 'order' ? [simpler.objectName2] : [])].filter((n): n is string => !!n).map(n => n.toLowerCase());
  if (newNames.some(n => names.includes(n))) return true;
  if (parent.type === 'tile_and_count' || parent.type === 'estimate_then_tile') {
    const pc = parent.correctUnitCount || parent.objectLength0, sc = simpler.correctUnitCount || simpler.objectLength0;
    if (sc >= pc || !(simpler.estimateOptions ?? [sc]).includes(sc)) return true;
  }
  if (parent.type === 'two_unit_compare') {
    const used = [parent.unitType || sessionUnit, parent.unitTypeB || sessionUnit];
    if ([simpler.unitType, simpler.unitTypeB].some(u => !u || used.includes(u))) return true;
    if (simpler.objectLength0 >= parent.objectLength0) return true;
  }
  if (parent.type === 'order') {
    const shown = [simpler.objectName0, simpler.objectName1, simpler.objectName2].map(String).sort((a, b) => a.localeCompare(b));
    if (shown.join(',') === simpler.correctOrderCsv) return true;
  }
  return false;
}

// ── declarations ─────────────────────────────────────────────────────────

/** What the session already draws: unit marks on screen take the unit-marks lever away. */
export interface LengthLeverContext { ticksShown: boolean; sessionUnit?: string }

export function lengthLabLevers(c: LengthLabChallenge | null, pulled: readonly string[], ctx: LengthLeverContext): WorkspaceLever[] {
  if (!c || isPracticeLength(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly LengthMiss[],
    when: string, does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const simpler = simplerLength(c, ctx.sessionUnit);
  const marks = !ctx.ticksShown;
  const endLines = (answers: readonly LengthMiss[]) => lever(END_LINES_LEVER, 'help', 'shown', answers,
    'The learner misjudges which far end reaches farther.',
    'Carries each bar\'s far end down as a dashed line across all the bars, so the ends can be compared. No bar is marked.');
  const unitMarks = (answers: readonly LengthMiss[]) => lever(UNIT_MARKS_LEVER, 'help', 'shown', answers,
    'The learner cannot see the difference between bars that are close in length.',
    'Splits every bar into equal unit cells. No count is written.');
  switch (c.type) {
    case 'compare': return [
      lever(WORD_MODEL_LEVER, 'help', 'both', ['reversed', 'said_same', 'missed_same'],
        'The learner mixes up longer and shorter, or what same means.',
        'Shows a picture outside the item: a long grey bar tagged longer over a short one tagged shorter, and two equal '
          + 'grey bars tagged same. Read the tags aloud; it names neither object.'),
      endLines(['said_same', 'missed_same']),
      ...(marks ? [unitMarks(['said_same', 'missed_same', 'reversed'])] : []),
      ...(simpler ? [lever(FAR_PAIR_LEVER, 'simplify', 'shown', ['said_same', 'reversed'],
        'These two objects are too close in length to compare yet.',
        'Opens an easier pair first: two plain objects far apart in length. It is not graded; the full item comes back after it.')] : []),
    ];
    case 'tile_and_count':
    case 'estimate_then_tile': return [
      lever(OUTLINE_LEVER, 'help', 'shown',
        c.type === 'estimate_then_tile' ? ['tiled_to_guess', 'one_short', 'one_over', 'short', 'over'] : ['one_short', 'one_over', 'short', 'over'],
        'The learner stops short of the end, goes past it, or leaves gaps.',
        'Draws a dashed outline of the object\'s length behind the learner\'s units, from its start to its end. No count is written.'),
      ...(simpler ? [lever(SHORTER_LEVER, 'simplify', 'shown',
        c.type === 'estimate_then_tile' ? ['tiled_to_guess', 'short', 'over'] : ['short', 'over'],
        'This object is too long to measure yet.',
        'Opens an easier object first, about half as long, with the same unit. It is not graded; the full item comes back after it.')] : []),
    ];
    case 'two_unit_compare': return [
      lever(UNIT_MODEL_LEVER, 'help', 'shown', ['chose_bigger_unit'],
        'The learner picks the unit they needed fewer of.',
        'Shows a picture outside the item: one plain grey bar measured twice, once with small squares and once with big '
          + 'squares, both rows reaching its end. It uses neither of the item\'s units.'),
      ...(simpler ? [lever(SHORTER_LEVER, 'simplify', 'shown', ['chose_bigger_unit'],
        'Measuring this object twice is too much yet.',
        'Opens an easier object first: a shorter plain object measured with two other units. It is not graded; the full item comes back after it.')] : []),
    ];
    case 'order': return [
      lever(ORDER_STEPS_LEVER, 'help', 'shown', ['reversed_order'],
        'The learner orders from the wrong end.',
        'Shows three wordless bars under the slots that grow the way the slots run. They name no object.'),
      endLines(['swapped_pair', 'other_order']),
      ...(marks ? [unitMarks(['swapped_pair', 'other_order'])] : []),
      ...(simpler ? [lever(FAR_THREE_LEVER, 'simplify', 'shown', ['swapped_pair', 'other_order'],
        'Two of these objects are too close in length to order yet.',
        'Opens an easier set first: three plain objects far apart in length. It is not graded; the full item comes back after it.')] : []),
    ];
    case 'indirect': return [
      lever(CHAIN_MODEL_LEVER, 'help', 'both', ['chose_shorter', 'said_same'],
        'The learner cannot chain the two clues through the reference.',
        'Shows a picture outside the item: a red, a blue and a green bar lined up at one start, captioned red is shorter '
          + 'than blue and blue is shorter than green. Read the captions aloud; it names none of the item\'s objects.'),
    ];
    default: return [];
  }
}

/** What the pulled help levers put on screen, for the tutor and JEV. Pictures only: no digit, no answer. */
export function leverFacts(c: LengthLabChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeLength(c)) return '';
  const on = (id: string) => pulled.includes(id);
  return [
    on(WORD_MODEL_LEVER) && 'Beside the objects is a word picture outside the item: a long grey bar tagged longer over a short '
      + 'one tagged shorter, and two equal grey bars tagged same.',
    on(END_LINES_LEVER) && 'Each bar\'s far end is carried down as a dashed line across all the bars.',
    on(UNIT_MARKS_LEVER) && 'Every bar is split into equal unit cells.',
    on(OUTLINE_LEVER) && 'A dashed outline of the object\'s length, from its start to its end, sits behind the learner\'s units.',
    on(UNIT_MODEL_LEVER) && 'Beside the item is a picture outside it: one plain grey bar measured with a row of small squares '
      + 'and with a row of big squares, both rows reaching its end.',
    on(ORDER_STEPS_LEVER) && 'Under the slots are three wordless bars that grow the way the slots run.',
    on(CHAIN_MODEL_LEVER) && 'Beside the clues is a picture outside the item: a red, a blue and a green bar lined up at one start, '
      + 'captioned red is shorter than blue and blue is shorter than green.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Leak rule for the help levers' words: no digit, and none of the item's object names. */
export function leverTextLeaks(c: LengthLabChallenge, text: string): boolean {
  if (/\d/.test(text)) return true;
  const lower = text.toLowerCase();
  return itemNames(c).some(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
}
