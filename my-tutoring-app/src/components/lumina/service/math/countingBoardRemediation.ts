import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { CountingBoardChallenge } from '../../primitives/visual-primitives/math/CountingBoard';

export type CountingBoardChangeMove = 'contrast_same_start_different_change';
export type CountingBoardCountOnMove = 'count_on_exactly_one_more';
export type CountingBoardRemediationMove = CountingBoardChangeMove | CountingBoardCountOnMove;

/** The most a take_away / add_more board changes by. The generator's random draw uses the same bound. */
export const MAX_CHANGE = 3;

const CHANGE_MODES = ['take_away', 'add_more'];
const ADAPTIVE_MODES = [...CHANGE_MODES, 'count_on'];

// Describes the change-then-count task (take_away / add_more), not diagnosis wording.
export const countingBoardChangeTeaching: TeachingCapability<CountingBoardChangeMove> = {
  activity: 'counting-board',
  task: 'A Kindergarten or Grade 1 counting board where objects are taken off or put on and the learner says the new number out loud. '
    + 'In take_away a group of objects starts on the board and the tutor says how many to take away (one, two or three); the learner touches that many to remove them, then says how many are left. '
    + 'In add_more a group starts on the board with faded extra objects beside it and the tutor says how many more to put on (one, two or three); the learner touches the faded ones to put them on, then says how many there are altogether. '
    + 'Boards usually start with 3 to 10 objects and never pass the lesson\'s number bound. The learner may touch each object and count aloud; the tutor judges the last number said and, when it is wrong, counts the result aloud and asks again. '
    + 'No number is printed on the board. The learner does not read or write numerals or equations, compare two groups, or count on from a covered group.',
  moves: [{
    id: 'contrast_same_start_different_change',
    description: 'Make two consecutive items start with the same number of objects and change it by different amounts. '
      + 'In take_away: 7 bears, take away one, 6 left; then 7 bears, take away three, 4 left. '
      + 'In add_more: 4 bears, put one more on, 5 altogether; then 4 bears, put three more on, 7 altogether. '
      + 'The board holds the same number before the change on both items while the correct answers differ, and they differ only by how many were taken away or put on, '
      + 'so an answer that does not depend on the change cannot be right on both. '
      + 'Rewrites the start and the change of one item to match its neighbour\'s start; holds the mode, the item count, changes of one to three, the lesson\'s number bound and largest board, the rule that the spoken change is never the answer, and the support level. '
      + 'Does not teach touching each object exactly once, keeping track in a scattered set, counting on from a covered group, reading or writing numerals, or that moving objects does not change how many.',
  }],
};

// Describes the count-on task in both bands: covered start at K, visible pre-counted start at Grade 1.
export const countingBoardCountOnTeaching: TeachingCapability<CountingBoardCountOnMove> = {
  activity: 'counting-board',
  task: 'Count on from a known group. The tutor says how many are already in the group (a start from 1 to 7) and the learner says how many there are altogether after counting on the remaining objects '
    + '(usually two to five more, never past the lesson\'s number bound). '
    + 'In Kindergarten the started group is covered by a basket, so only the extra objects can be seen and touched; in Grade 1 the started group stays visible and is already marked as counted. '
    + 'The learner touches each extra object while counting on and says the total out loud; the tutor judges the last number said and, when it is wrong, says the start, counts on and asks again. '
    + 'Every item in a session has a different start. The learner does not add written numbers, choose the start, or compare groups.',
  moves: [{
    id: 'count_on_exactly_one_more',
    description: 'Include one item with exactly one object to count on, so the total is the number right after the start. '
      + 'In Kindergarten the tutor says five are already in the basket and one bear sits beside it: the answer is six. '
      + 'In Grade 1 five bears already marked as counted and one unmarked bear are visible: the answer is six. '
      + 'A learner who says the start back, or who says the start number while touching the first extra object, says five on this item, while the next number word after the start gives six. '
      + 'Rewrites how many are counted on for one item that is not the first; holds that item\'s spoken start, the mode, the item count, different starts, the number bound and the support level. '
      + 'Does not teach counting many extra objects one to one, counting a covered group from one, including a covered group the learner ignores, or adding two written numbers.',
  }],
};

export function countingBoardTeachingFor(mode: string | undefined) {
  if (CHANGE_MODES.includes(mode ?? '')) return countingBoardChangeTeaching;
  return mode === 'count_on' ? countingBoardCountOnTeaching : null;
}

/** Code-owned task gate. The generator honours no named start or change from the topic, only its number bound. */
export function eligibleCountingBoardTeaching(task: AdaptationTask): boolean {
  return ['K', '1'].includes((task.grade ?? '').toUpperCase()) && ADAPTIVE_MODES.includes(task.mode ?? '');
}

/** Delivery gate on the manifest config; the generator still runs the full task gate. */
export function countingBoardDeliveryEligible(config: Record<string, unknown>): boolean {
  return ADAPTIVE_MODES.includes(String(config.targetEvalMode));
}

export type CountingBoardAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';
type Board = Pick<CountingBoardChallenge, 'id' | 'type' | 'count' | 'targetAnswer' | 'changeBy' | 'startFrom'>;

/** A change item whose rendered fields close: the board starts with `count`, changes by `changeBy`, and the key is the result. */
const isChangeBoard = (c: Board) => CHANGE_MODES.includes(c.type) && Number.isInteger(c.count) && c.count >= 1
  && Number.isInteger(c.changeBy) && (c.changeBy as number) >= 1 && c.changeBy !== c.targetAnswer
  && c.targetAnswer === (c.type === 'take_away' ? c.count - (c.changeBy as number) : c.count + (c.changeBy as number)) && c.targetAnswer >= 1;
const sameStartOtherChange = (a: Board, b: Board) => isChangeBoard(a) && isChangeBoard(b) && a.type === b.type
  && a.count === b.count && a.changeBy !== b.changeBy;

/** Recomputed from the rendered fields: neighbouring boards that start the same and change by different amounts. */
export function compiledSameStartContrast(challenges: readonly Board[]) {
  const targets: string[] = [];
  for (let i = 0; i + 1 < challenges.length; i++) {
    if (sameStartOtherChange(challenges[i], challenges[i + 1])) targets.push(challenges[i].id, challenges[i + 1].id);
  }
  const unique = Array.from(new Set(targets));
  return { targets: unique, count: unique.length };
}

/** Changes a board of `start` may legally make: 1..MAX_CHANGE, a result of at least one, never spoken as the answer,
 *  and an add_more total within `maxTotal`. */
export function legalChanges(type: string, start: number, maxTotal: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= MAX_CHANGE; d++) {
    const answer = type === 'take_away' ? start - d : start + d;
    if (answer < 1 || answer === d) continue;
    if (type === 'add_more' && (answer > maxTotal || answer < 3)) continue;
    out.push(d);
  }
  return out;
}

const pick = <T>(list: readonly T[], random: () => number) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** Rewrite the board after an anchor (a later anchor when one works, so the session opens on an ordinary item)
 *  to the anchor's start with a different legal change. Count, ids, arrangement, the largest board and
 *  distinct cards hold; the answer is recomputed from start and change. */
export function selectSameStartContrast<C extends Board>(
  baseline: readonly C[], move: CountingBoardChangeMove | null, ceiling: number, random: () => number = Math.random,
) {
  const result = (challenges: readonly C[], status: CountingBoardAdaptationStatus) =>
    ({ challenges, status, ...compiledSameStartContrast(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (baseline.length < 2 || !baseline.every(isChangeBoard) || new Set(baseline.map(c => c.type)).size !== 1) {
    return result(baseline, 'insufficient-capacity');
  }
  if (compiledSameStartContrast(baseline).count) return result(baseline, 'already-targeted');
  const type = baseline[0].type;
  // add_more's bound caps the TOTAL; never draw a board bigger than the session already shows.
  const maxTotal = Math.min(ceiling, Math.max(...baseline.map(c => c.targetAnswer)));
  const cardKey = (count: number, changeBy: number) => `${count}:${changeBy}`;
  const options: Array<{ replace: number; count: number; changeBy: number }> = [];
  for (let anchor = 0; anchor + 1 < baseline.length; anchor++) {
    const replace = anchor + 1;
    const start = baseline[anchor].count;
    const used = new Set(baseline.filter((_, i) => i !== replace).map(c => cardKey(c.count, c.changeBy as number)));
    for (const changeBy of legalChanges(type, start, maxTotal)) {
      if (changeBy !== baseline[anchor].changeBy && !used.has(cardKey(start, changeBy))) options.push({ replace, count: start, changeBy });
    }
  }
  if (!options.length) return result(baseline, 'insufficient-capacity');
  const later = options.filter(o => o.replace > 1);
  const chosen = pick(later.length ? later : options, random);
  const next = baseline.map((c, i) => (i === chosen.replace ? {
    ...c, count: chosen.count, changeBy: chosen.changeBy,
    targetAnswer: type === 'take_away' ? chosen.count - chosen.changeBy : chosen.count + chosen.changeBy,
  } : c));
  return result(next, 'targeted');
}

const isCountOnBoard = (c: Board) => c.type === 'count_on' && Number.isInteger(c.startFrom) && (c.startFrom as number) >= 1
  && c.count > (c.startFrom as number) && c.targetAnswer === c.count;

/** Recomputed from the rendered fields: count-on boards with exactly one object beyond the start. */
export function compiledOneMoreCountOn(challenges: readonly Board[]) {
  const targets = challenges.filter(c => isCountOnBoard(c) && c.count === (c.startFrom as number) + 1).map(c => c.id);
  return { targets, count: targets.length };
}

/** Shrink the extras of one count-on board (not the first) to exactly one. Its spoken start is kept, so starts
 *  stay distinct; the total only falls, so the number bound holds. */
export function selectOneMoreCountOn<C extends Board>(
  baseline: readonly C[], move: CountingBoardCountOnMove | null, random: () => number = Math.random,
) {
  const result = (challenges: readonly C[], status: CountingBoardAdaptationStatus) =>
    ({ challenges, status, ...compiledOneMoreCountOn(challenges) });
  if (!move) return result(baseline, 'no-focus');
  if (baseline.length < 2 || !baseline.every(isCountOnBoard)) return result(baseline, 'insufficient-capacity');
  if (compiledOneMoreCountOn(baseline).count) return result(baseline, 'already-targeted');
  const cards = new Set(baseline.map(c => `${c.startFrom}:${c.count}`));
  const slots = baseline.map((c, i) => i).filter(i => i > 0 && !cards.has(`${baseline[i].startFrom}:${(baseline[i].startFrom as number) + 1}`));
  if (!slots.length) return result(baseline, 'insufficient-capacity');
  const slot = pick(slots, random);
  const next = baseline.map((c, i) => (i === slot ? { ...c, count: (c.startFrom as number) + 1, targetAnswer: (c.startFrom as number) + 1 } : c));
  return result(next, 'targeted');
}
