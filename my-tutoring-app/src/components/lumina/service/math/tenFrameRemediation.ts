import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { TenFrameChallenge } from '../../primitives/visual-primitives/math/TenFrame';

export type TenFrameOperateMove = 'contrast_same_first_number_different_second';

const OPERATE_TYPES = ['add', 'subtract'];
/** The benched spoken-number ceiling; every operate answer and start stays inside it. */
const SPOKEN_MAX = 20;

// Describes the operate task (add / subtract said aloud on the frame), not diagnosis wording.
export const tenFrameOperateTeaching: TeachingCapability<TenFrameOperateMove> = {
  activity: 'ten-frame',
  task: 'A Kindergarten to Grade 2 ten frame where the tutor says an addition or a subtraction aloud and the learner says the answer out loud. '
    + 'In an addition item the frame starts empty and the tutor says both numbers ("three plus two"); the learner may place counters for them, then says how many altogether. '
    + 'In a subtraction item the frame starts with some counters and the tutor says how many to take away ("seven counters, take away three"); the learner may take counters off, then says how many are left. '
    + 'A session may be all addition, all subtraction, or both. Kindergarten uses one frame of ten and numbers within 10 (often within 5); Grades 1 and 2 may use two frames and numbers within 20, where many items cross ten (eight plus five, fifteen take away seven). '
    + 'The tutor judges the number said and, when it is wrong, models the answer and asks again. Every answer is a number from 1 to 20. At the easiest support level readers also see the equation with a question mark. '
    + 'The learner does not build a number without an operation, split a group into two colours, find how many more make ten, compare groups, or write anything.',
  moves: [{
    id: 'contrast_same_first_number_different_second',
    description: 'Make two consecutive items of the same operation share their first number and differ in the second. '
      + 'Kindergarten subtraction: seven counters, take away one, six left; then seven counters, take away three, four left. '
      + 'Kindergarten addition within five: two plus one is three; then two plus three is five. '
      + 'Grades 1 and 2 on two frames: eight plus three is eleven; then eight plus five is thirteen. Fifteen take away seven is eight; then fifteen take away nine is six. '
      + 'Both items start from the same number while their answers differ, and they differ only because of the number added or taken away, so an answer that repeats the first or starting number, or that stays the same whatever is added or taken away, cannot be right on both. '
      + 'Rewrites the second number of one item to follow its neighbour\'s first number; holds every item\'s operation, the item count, the session\'s largest answer, starting number and second number, whether an item crosses ten, the frame and the support level, and the rewritten answer never equals a number the tutor says. '
      + 'Does not address an answer that repeats the number taken away or the second number added, and does not teach counting counters one to one, making ten, recognising a quantity at a glance, splitting a number into two parts, or reading or writing equations.',
  }],
};

export function tenFrameTeachingFor(mode: string | undefined) {
  return mode === 'operate' ? tenFrameOperateTeaching : null;
}

/** Code-owned task gate. The topic names no operand the generator honours, only its number bound. */
export function eligibleTenFrameTeaching(task: AdaptationTask): boolean {
  return ['K', '1', '2'].includes((task.grade ?? '').toUpperCase()) && task.mode === 'operate';
}

/** Delivery gate on the manifest config; the generator still runs the full task gate. */
export function tenFrameDeliveryEligible(config: Record<string, unknown>): boolean {
  return config.targetEvalMode === 'operate';
}

export type TenFrameAdaptationStatus = 'targeted' | 'already-targeted' | 'insufficient-capacity' | 'no-focus';
type Item = Pick<TenFrameChallenge, 'id' | 'type' | 'targetCount' | 'startCount' | 'addend1' | 'addend2'>;

const int = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
/** add: the first addend; subtract: the start. */
const firstOf = (c: Item) => (c.type === 'add' ? c.addend1 as number : c.startCount as number);
/** add: the second addend; subtract: how many are taken away. */
const secondOf = (c: Item) => (c.type === 'add' ? c.addend2 as number : (c.startCount as number) - c.targetCount);

/** An operate item whose rendered fields close and fit the frame: the key is recomputed from the two said numbers. */
const isOperateItem = (c: Item, capacity: number) => {
  const limit = Math.min(capacity, SPOKEN_MAX);
  if (c.type === 'add') {
    return int(c.addend1) && int(c.addend2) && c.addend1 >= 1 && c.addend2 >= 1
      && c.targetCount === c.addend1 + c.addend2 && c.targetCount <= limit;
  }
  return c.type === 'subtract' && int(c.startCount) && int(c.targetCount)
    && c.startCount <= limit && c.targetCount >= 1 && c.targetCount < c.startCount;
};

/** Starts below ten and ends above it (add), or starts above ten and ends below it (subtract). */
const crossesTen = (type: string, first: number, answer: number) =>
  (type === 'add' ? first < 10 && answer > 10 : first > 10 && answer < 10);

const sameFirstOtherSecond = (a: Item, b: Item, capacity: number) => isOperateItem(a, capacity) && isOperateItem(b, capacity)
  && a.type === b.type && firstOf(a) === firstOf(b) && secondOf(a) !== secondOf(b);
const sameSecondOtherFirst = (a: Item, b: Item, capacity: number) => isOperateItem(a, capacity) && isOperateItem(b, capacity)
  && a.type === b.type && secondOf(a) === secondOf(b) && firstOf(a) !== firstOf(b);

/** Recomputed from the rendered fields: neighbouring items of one operation that share the first number and differ in the second. */
export function compiledSameFirstContrast(challenges: readonly Item[], capacity: number) {
  const targets: string[] = [];
  for (let i = 0; i + 1 < challenges.length; i++) {
    if (sameFirstOtherSecond(challenges[i], challenges[i + 1], capacity)) targets.push(challenges[i].id, challenges[i + 1].id);
  }
  const unique = Array.from(new Set(targets));
  return { targets: unique, count: unique.length };
}

/** Second numbers an item of `type` starting from `first` may take: inside the session's own largest answer and second
 *  number, the same ten-crossing as the item it replaces, and an answer that is never one of the two said numbers. */
export function legalSeconds(type: string, first: number, bounds: { maxAnswer: number; maxSecond: number; crosses: boolean }): number[] {
  const out: number[] = [];
  for (let s = 1; s <= bounds.maxSecond; s++) {
    const answer = type === 'add' ? first + s : first - s;
    if (answer < 1 || answer > bounds.maxAnswer || answer === s || answer === first) continue;
    if (crossesTen(type, first, answer) !== bounds.crosses) continue;
    out.push(s);
  }
  return out;
}

const pick = <T>(list: readonly T[], random: () => number) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** Rewrite the item after an anchor of the same operation to the anchor's first number with a different legal second number.
 *  Count, ids, operations and every other item hold; the answer is recomputed from the two said numbers. A later anchor is
 *  preferred (the session opens on an ordinary item), and so is a slot outside a neighbouring same-second pair the baseline
 *  already had, which teaches a different point and is kept when another slot works. */
export function selectSameFirstContrast<C extends Item>(
  baseline: readonly C[], move: TenFrameOperateMove | null, capacity: number, random: () => number = Math.random,
) {
  const result = (challenges: readonly C[], status: TenFrameAdaptationStatus) =>
    ({ challenges, status, ...compiledSameFirstContrast(challenges, capacity) });
  if (!move) return result(baseline, 'no-focus');
  if (baseline.length < 2 || !baseline.every(c => isOperateItem(c, capacity))) return result(baseline, 'insufficient-capacity');
  if (compiledSameFirstContrast(baseline, capacity).count) return result(baseline, 'already-targeted');
  const inSameSecondPair = new Set<number>();
  for (let i = 0; i + 1 < baseline.length; i++) {
    if (sameSecondOtherFirst(baseline[i], baseline[i + 1], capacity)) { inSameSecondPair.add(i); inSameSecondPair.add(i + 1); }
  }
  const card = (c: Item) => `${c.type}:${firstOf(c)}:${secondOf(c)}`;
  const options: Array<{ replace: number; second: number }> = [];
  for (let anchor = 0; anchor + 1 < baseline.length; anchor++) {
    const replace = anchor + 1;
    const [a, r] = [baseline[anchor], baseline[replace]];
    if (a.type !== r.type) continue;
    const sameType = baseline.filter(c => c.type === a.type);
    const bounds = { maxAnswer: Math.max(...sameType.map(c => c.targetCount)), maxSecond: Math.max(...sameType.map(secondOf)),
      crosses: crossesTen(r.type, firstOf(r), r.targetCount) };
    const used = new Set(baseline.filter((_, i) => i !== replace).map(card));
    for (const second of legalSeconds(a.type, firstOf(a), bounds)) {
      if (second !== secondOf(a) && !used.has(`${a.type}:${firstOf(a)}:${second}`)) options.push({ replace, second });
    }
  }
  if (!options.length) return result(baseline, 'insufficient-capacity');
  const preferences = [(o: typeof options[number]) => o.replace > 1 && !inSameSecondPair.has(o.replace),
    (o: typeof options[number]) => !inSameSecondPair.has(o.replace), (o: typeof options[number]) => o.replace > 1];
  const pool = preferences.map(p => options.filter(p)).find(list => list.length) ?? options;
  const chosen = pick(pool, random);
  const next = baseline.map((c, i) => {
    if (i !== chosen.replace) return c;
    const first = firstOf(baseline[i - 1]);
    return c.type === 'add'
      ? { ...c, addend1: first, addend2: chosen.second, targetCount: first + chosen.second }
      : { ...c, startCount: first, targetCount: first - chosen.second };
  });
  return result(next, 'targeted');
}
