/**
 * The in-item levers on a strategy-picker item (`/add-support-tiers`, report
 * qa/eval-reports/strategy-picker-levers-2026-10-08.md). No real-learner evidence: the misses are what
 * `strategyPickerMiss` observes. Pure: the component draws from these, the workspace publishes them, the tests hold
 * each leak rule. Every simpler item has the id `<item>~simpler`, the same mode, and is built by `practiceItem`.
 *
 * - guided / try_another / choose (a number set on the stepper): `two_parts` (help) marks the parts of the strategy
 *   picture: on a number line a ring on the start and each hop numbered in order; otherwise each number's part in its
 *   own colour with that number beside it. It writes only the equation's own numbers and hop ordinals, never a total
 *   or a landing (`partsLeak`). `smaller_numbers` (simplify) the same mode and strategy with smaller numbers.
 * - match (a strategy tapped): the strategy IS the answer, so the help acts outside the item: `option_pictures` (help)
 *   a small picture of EVERY choice, each on its own example problem, never the item's (`picturesLeak`).
 *   `two_choices` (simplify) another worked solution, a different strategy, and two choices that draw different
 *   pictures.
 * - compare credits every choice: no miss, no lever.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { StrategyId, StrategyPickerChallenge, StrategyPickerData } from './StrategyPicker';
import { PICTURE_KIND, strategyLabel, type StrategyPickerMiss } from './strategyPickerWorkspace';

export const PARTS_LEVER = 'two_parts';
export const SMALLER_LEVER = 'smaller_numbers';
export const PICTURES_LEVER = 'option_pictures';
export const TWO_CHOICES_LEVER = 'two_choices';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice problem, not graded. The full problem comes back after it.';

type Problem = StrategyPickerChallenge['problem'];
type Op = Problem['operation'];

/** The picker draws at most ten (the ten frame has ten cells). */
const CAP = 10;
const NUMBER_MISSES: readonly StrategyPickerMiss[] = ['other_operation', 'printed_number', 'one_short', 'one_over',
  'short_by_more', 'over_by_more'];
const MATCH_MISSES: readonly StrategyPickerMiss[] = ['similar_strategy', 'different_strategy'];

const solves = (c: StrategyPickerChallenge) =>
  c.type === 'guided-strategy' || c.type === 'try-another' || c.type === 'choose-your-strategy';

export function makeProblem(a: number, b: number, operation: Op): Problem {
  return { equation: `${a} ${operation === 'addition' ? '+' : '-'} ${b}`, operation, operand1: a, operand2: b,
    result: operation === 'addition' ? a + b : a - b };
}
const sameProblem = (p: Problem, q: Problem) => p.operation === q.operation && p.operand1 === q.operand1 && p.operand2 === q.operand2;

/** The problems each strategy's picture can draw (the generator's STRATEGY_CONSTRAINTS). */
export function fits(s: StrategyId, p: Problem): boolean {
  const sum = p.operand1 + p.operand2;
  switch (s) {
    case 'counting-back': return p.operation === 'subtraction' && p.operand1 > p.operand2;
    case 'make-ten': return p.operation === 'addition' && sum >= 8 && sum <= 10;
    case 'doubles': return p.operation === 'addition' && p.operand1 === p.operand2;
    case 'near-doubles': return p.operation === 'addition' && Math.abs(p.operand1 - p.operand2) === 1;
    default: return p.operation === 'addition';
  }
}

/** How much there is to count or move in a strategy's picture: hops, the part that crosses into ten, one group, or all. */
function sizeOf(s: StrategyId, p: Problem): number {
  switch (s) {
    case 'counting-on': case 'counting-back': return p.operand2;
    case 'make-ten': case 'doubles': case 'near-doubles': return Math.min(p.operand1, p.operand2);
    default: return p.operand1 + p.operand2;
  }
}
/** The smallest picture each strategy draws: one hop, one counter to move, a double of one, two marks. */
const FLOOR: Record<StrategyId, number> = {
  'counting-on': 1, 'counting-back': 1, 'make-ten': 1, doubles: 1, 'near-doubles': 1, 'tally-marks': 2, 'draw-objects': 2,
};

function candidates(cap: number, ops: readonly Op[]): Problem[] {
  const out: Problem[] = [];
  for (const op of ops) for (let a = 1; a <= cap; a++) for (let b = 1; b <= cap; b++) {
    if (op === 'addition' ? a + b <= cap : a > b) out.push(makeProblem(a, b, op));
  }
  return out;
}
const capOf = (data: Pick<StrategyPickerData, 'maxNumber'>) => Math.min(CAP, Math.max(2, data.maxNumber || CAP));
const lessonProblems = (data: Pick<StrategyPickerData, 'challenges'>) => (data.challenges ?? []).map(c => c.problem);

/**
 * The same strategy one step smaller: about half as much to count or move, a different problem from every item of
 * the lesson, and a different answer from the item's. Null when the item is already the smallest picture.
 */
export function simplerProblem(s: StrategyId, p: Problem, cap: number, avoid: readonly Problem[] = []): Problem | null {
  const size = sizeOf(s, p);
  if (size <= FLOOR[s]) return null;
  const target = Math.max(FLOOR[s], Math.ceil(size / 2));
  const bigFirst = p.operand1 >= p.operand2;
  const pool = candidates(cap, [s === 'counting-back' ? 'subtraction' : 'addition'])
    .filter(q => fits(s, q) && sizeOf(s, q) < size && q.result !== p.result && ![p, ...avoid].some(x => sameProblem(x, q)));
  const key = (q: Problem) => [Math.abs(sizeOf(s, q) - target), (q.operand1 >= q.operand2) === bigFirst ? 0 : 1,
    q.operand1 === p.operand1 ? 1 : 0, Math.abs(q.operand1 - p.operand1), q.operand1, q.operand2];
  const cmp = (x: number[], y: number[]) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  return pool.sort((x, y) => cmp(key(x), key(y)))[0] ?? null;
}

/** The steps a practice item prints, built from its own numbers. Never the answer. */
export function practiceSteps(s: StrategyId, p: Problem): string[] {
  const { operand1: a, operand2: b } = p, small = Math.min(a, b);
  switch (s) {
    case 'counting-on': return [`Start at ${a} on the number line.`, `Make ${b} hops forward, one at a time.`, 'The number you land on is the answer.'];
    case 'counting-back': return [`Start at ${a} on the number line.`, `Make ${b} hops back, one at a time.`, 'The number you land on is the answer.'];
    case 'make-ten': return [`The blue counters are ${a} and the yellow counters are ${b}.`, 'A full ten frame holds ten. Count the empty boxes.', 'Ten take away the empty boxes is how many counters there are.'];
    case 'doubles': return [`Both numbers are ${a}.`, 'Look at the two equal groups of dots.', 'Put the two groups together. How many?'];
    case 'near-doubles': return [`Find the double: two groups of ${small}.`, 'Then add the one extra dot.', 'How many in all?'];
    case 'tally-marks': return [`Draw ${a} tally marks.`, `Draw ${b} more.`, 'Count all the marks.'];
    default: return [`Draw ${a} circles.`, `Draw ${b} more circles.`, 'Count them all.'];
  }
}

/** Example problems a strategy draws well, for the option pictures and the match practice item. */
const EXAMPLES: Record<StrategyId, [number, number][]> = {
  'counting-on': [[5, 2], [6, 3], [4, 3], [3, 2], [2, 1]],
  'counting-back': [[7, 2], [8, 3], [6, 2], [5, 2], [4, 1]],
  'make-ten': [[8, 2], [9, 1], [7, 3], [6, 3]],
  doubles: [[3, 3], [4, 4], [2, 2], [1, 1]],
  'near-doubles': [[3, 4], [2, 3], [4, 5], [1, 2]],
  'tally-marks': [[3, 2], [4, 3], [2, 4], [2, 1]],
  'draw-objects': [[2, 3], [3, 4], [4, 2], [1, 2]],
};
const ALL_STRATEGIES = Object.keys(EXAMPLES) as StrategyId[];

/** An example problem for `s` that is none of `avoid` and stays within `cap`. */
export function exampleProblem(s: StrategyId, avoid: readonly Problem[], cap = CAP): Problem | null {
  for (const [a, b] of EXAMPLES[s] ?? []) {
    const p = makeProblem(a, b, s === 'counting-back' ? 'subtraction' : 'addition');
    if (Math.max(a, b, p.result) <= cap && !avoid.some(x => sameProblem(x, p))) return p;
  }
  return null;
}

/** The option pictures for a match item: every choice, each on its own example, never the item's problem. */
export function optionPictures(c: StrategyPickerChallenge): { strategy: StrategyId; problem: Problem }[] {
  return Array.from(new Set(c.strategyOptions ?? [])).filter((s): s is StrategyId => s in EXAMPLES)
    .map(s => ({ strategy: s, problem: exampleProblem(s, [c.problem])! }));
}
/** Leak rule: the pictures single out no choice (every choice, once) and none is drawn on the item's problem. */
export const picturesLeak = (pics: ReturnType<typeof optionPictures>, c: StrategyPickerChallenge) =>
  pics.length !== new Set(c.strategyOptions ?? []).size
  || (c.strategyOptions ?? []).some(s => !pics.some(p => p.strategy === s))
  || pics.some(p => !p.problem || sameProblem(p.problem, c.problem));

/** The numbers the `two_parts` lever writes on a strategy picture, beside hop ordinals for a number line. */
export interface PartsMarks { labels: number[]; hops: number; extraOne: boolean }
export function partsMarks(s: StrategyId, p: Problem): PartsMarks {
  const { operand1: a, operand2: b } = p;
  switch (s) {
    case 'counting-on': case 'counting-back': return { labels: [a], hops: b, extraOne: false };
    case 'doubles': return { labels: [a, b], hops: 0, extraOne: false };
    case 'near-doubles': { const n = Math.min(a, b); return { labels: [n, n], hops: 0, extraOne: true }; }
    default: return { labels: [a, b], hops: 0, extraOne: false };
  }
}
/**
 * Leak rule for `two_parts`: every number it writes is one the equation already prints (hop ordinals count the
 * second number, over the arcs, never at a tick), so the total or the landing is never written.
 */
export const partsLeak = (marks: PartsMarks, p: Problem) =>
  marks.labels.some(n => n !== p.operand1 && n !== p.operand2) || marks.hops > p.operand2
  || (marks.hops > 0 && marks.labels.some(n => n !== p.operand1));

/** What `two_parts` drew, for the tutor: the marks, never the total or where the picture ends. */
export function partsFact(s: StrategyId, p: Problem): string {
  const { operand1: a, operand2: b } = p;
  switch (s) {
    case 'counting-on': case 'counting-back':
      return `On the number line: a ring on the start, ${a}, and each hop numbered in order above its arc, up to ${b} hops.`;
    case 'make-ten': return `Under the ten frame: the blue counters labelled ${a}, the yellow counters labelled ${b}, and the top row of five outlined.`;
    case 'doubles': return `Each of the two equal groups of dots labelled ${a}.`;
    case 'near-doubles': return `The two equal groups labelled ${Math.min(a, b)} each, and the extra dot labelled +1.`;
    case 'tally-marks': return `The first ${a} tally marks blue and the next ${b} yellow, each part labelled with its number.`;
    default: return `The first ${a} circles blue and the next ${b} yellow, each part labelled with its number.`;
  }
}

/** What `option_pictures` drew, for the tutor: every choice on its own example. */
export const picturesFact = (pics: ReturnType<typeof optionPictures>) =>
  `Under the worked solution, a small picture of every choice, each on its own example problem: ${
    pics.map(p => `${strategyLabel(p.strategy)} on ${p.problem.equation}`).join('; ')}. None is this problem.`;

/** A stable 0/1 from an id, so the practice answer's place is not predictable. */
const bit = (id: string) => id.split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 2;

/** The match worked solutions, never naming the strategy (the generator's fallback wording). */
function workedSolution(s: StrategyId, p: Problem): string {
  const { operand1: a, operand2: b, result: r } = p;
  switch (s) {
    case 'counting-on': return `I started at ${a} and counted up ${b} more on my fingers. I landed on ${r}.`;
    case 'counting-back': return `I started at ${a} and counted back ${b}. I landed on ${r}.`;
    case 'make-ten': return `I moved some of ${b} over to fill up to 10 first, then added the rest to get ${r}.`;
    case 'doubles': return `I noticed both numbers are the same, and I already knew that fact: ${r}.`;
    case 'near-doubles': return `I thought of the fact with two ${Math.min(a, b)}s, which I already knew, then added 1 more to get ${r}.`;
    case 'tally-marks': return `I drew ${a} little lines, then ${b} more lines. I counted all the lines and got ${r}.`;
    default: return `I drew ${a} circles, then ${b} more. I counted them all and got ${r}.`;
  }
}

/** Whether a match item is already the plainest of its kind: two choices whose pictures differ. */
const plainestMatch = (c: StrategyPickerChallenge) => {
  const opts = c.strategyOptions ?? [];
  return opts.length <= 2 && opts.every(o => o === c.correctStrategy
    || PICTURE_KIND[o as StrategyId] !== PICTURE_KIND[c.correctStrategy as StrategyId]);
};

/** The parent of a practice item, by its id. */
export function practiceParent(id: string, challenges: readonly StrategyPickerChallenge[]): StrategyPickerChallenge | null {
  if (!id.endsWith(PRACTICE_SUFFIX)) return null;
  return challenges.find(c => c.id === id.slice(0, -PRACTICE_SUFFIX.length)) ?? null;
}

/**
 * The easier practice item for `c`, in its own mode, or null when `c` is already the plainest of its kind.
 * - guided / try_another: the same strategy on a smaller problem, with steps built from its own numbers.
 * - choose: a smaller problem; the menu keeps every strategy of the item's menu that still fits it.
 * - match: a different strategy's worked solution on an example problem, with two choices that draw different pictures.
 */
export function practiceItem(c: StrategyPickerChallenge, data: Pick<StrategyPickerData, 'challenges' | 'maxNumber' | 'strategiesIntroduced'>): StrategyPickerChallenge | null {
  const id = `${c.id}${PRACTICE_SUFFIX}`, cap = capOf(data), avoid = lessonProblems(data);
  if (c.type === 'guided-strategy' || c.type === 'try-another') {
    const s = c.assignedStrategy;
    const p = s ? simplerProblem(s, c.problem, cap, avoid) : null;
    if (!s || !p) return null;
    return { id, type: c.type, problem: p, assignedStrategy: s, strategySteps: practiceSteps(s, p),
      instruction: `Practice: solve ${p.equation} with ${strategyLabel(s)}. Follow the steps.` };
  }
  if (c.type === 'choose-your-strategy') {
    const menu = (c.availableStrategies ?? data.strategiesIntroduced ?? []).filter(s => s in EXAMPLES);
    const biggest = (p: Problem) => Math.max(p.operand1, p.operand2, p.result);
    const top = biggest(c.problem);
    if (!menu.length || top <= 2) return null;
    const target = Math.ceil(top / 2);
    const ops = Array.from(new Set(menu.map(s => (s === 'counting-back' ? 'subtraction' : 'addition') as Op)));
    const scored = candidates(cap, ops)
      .filter(q => biggest(q) < top && q.result !== c.problem.result && ![c.problem, ...avoid].some(x => sameProblem(x, q)))
      .map(q => ({ q, menu: menu.filter(s => fits(s, q)) }))
      .filter(x => x.menu.length > 0)
      .sort((x, y) => (y.menu.length - x.menu.length) || (Math.abs(biggest(x.q) - target) - Math.abs(biggest(y.q) - target))
        || (x.q.operand1 - y.q.operand1) || (x.q.operand2 - y.q.operand2));
    const pick = scored[0];
    if (!pick) return null;
    return { id, type: c.type, problem: pick.q, availableStrategies: pick.menu,
      instruction: `Practice: pick a strategy, then solve ${pick.q.equation}.` };
  }
  if (c.type === 'match-strategy') {
    if (!c.correctStrategy || plainestMatch(c)) return null;
    const order = Array.from(new Set([...(c.strategyOptions ?? []), ...(data.strategiesIntroduced ?? []), ...ALL_STRATEGIES]))
      .filter((s): s is StrategyId => s in EXAMPLES && s !== c.correctStrategy);
    for (const s of order) {
      const foil = order.find(f => f !== s && PICTURE_KIND[f] !== PICTURE_KIND[s]);
      const p = exampleProblem(s, avoid, cap);
      if (!foil || !p) continue;
      return { id, type: c.type, problem: p, correctStrategy: s, workedSolution: workedSolution(s, p),
        strategyOptions: bit(c.id) === 0 ? [s, foil] : [foil, s],
        instruction: 'Practice: someone solved this problem. Which strategy did they use?' };
    }
    return null;
  }
  return null;
}

/**
 * Leak rule for a practice item: it is a new item of the same mode, solvable, never any item of the lesson's problem,
 * and its answer is not the item's (a different number, or a different strategy on a match).
 */
export function practiceLeaks(p: StrategyPickerChallenge, c: StrategyPickerChallenge, data: Pick<StrategyPickerData, 'challenges'>): boolean {
  if (p.id !== `${c.id}${PRACTICE_SUFFIX}` || p.type !== c.type) return true;
  if (lessonProblems(data).some(x => sameProblem(x, p.problem))) return true;
  const { operand1: a, operand2: b, operation, result } = p.problem;
  if (result !== (operation === 'addition' ? a + b : a - b) || result < 0) return true;
  if (p.type === 'match-strategy') {
    const opts = p.strategyOptions ?? [];
    return p.correctStrategy === c.correctStrategy || !opts.includes(p.correctStrategy ?? '') || opts.length !== 2
      || PICTURE_KIND[opts[0] as StrategyId] === PICTURE_KIND[opts[1] as StrategyId]
      || !fits(p.correctStrategy as StrategyId, p.problem);
  }
  if (result === c.problem.result) return true;
  if (p.type === 'choose-your-strategy') return !(p.availableStrategies ?? []).length || !(p.availableStrategies ?? []).every(s => fits(s, p.problem));
  return !p.assignedStrategy || p.assignedStrategy !== c.assignedStrategy || !fits(p.assignedStrategy, p.problem)
    || (p.strategySteps ?? []).some(step => new RegExp(`\\b${result}\\b`).test(step) && result !== a && result !== b);
}

/** The levers a session item declares, with their state. A practice item declares none. */
export function strategyPickerLevers(c: StrategyPickerChallenge, data: Pick<StrategyPickerData, 'challenges' | 'maxNumber' | 'strategiesIntroduced' | 'supportTier'>,
  pulled: readonly string[]): WorkspaceLever[] {
  const easy = (c.supportTier ?? data.supportTier) === 'easy';
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], answers: readonly StrategyPickerMiss[], when: string, does: string, startsOn = false) =>
    levers.push({ id, kind, carrier: 'both', pulled: startsOn || pulled.includes(id), answers, when, does });
  const simpler = practiceItem(c, data);
  if (solves(c)) {
    add(PARTS_LEVER, 'help', NUMBER_MISSES,
      'The learner answers with one of the two numbers, puts the numbers together the other way, or miscounts the picture.',
      'Marks the parts of the strategy picture: on a number line a ring on the start and each hop numbered in order; '
      + 'otherwise each number\'s part in its own colour with that number beside it. Count along with the learner; never '
      + 'say the total or where the picture ends.', easy);
    if (simpler) add(SMALLER_LEVER, 'simplify', NUMBER_MISSES, 'The learner still cannot get the number after help.',
      'Opens an easier practice problem first: the same kind of task with smaller numbers. Not graded; the full problem comes back after it.');
  } else if (c.type === 'match-strategy') {
    add(PICTURES_LEVER, 'help', MATCH_MISSES, 'The learner taps a strategy the worked solution did not use.',
      'Draws a small picture of every choice under the worked solution, each on its own example problem, the same for '
      + 'every choice. Ask which picture fits what the solver did; never name or point to the one that matches.',
      easy || !!c.showStrategyExemplars);
    if (simpler) add(TWO_CHOICES_LEVER, 'simplify', MATCH_MISSES, 'The learner still cannot tell the strategies apart after help.',
      'Opens an easier practice item first: another worked solution and only two choices that look very different. Not graded; the full item comes back after it.');
  }
  return levers;
}
