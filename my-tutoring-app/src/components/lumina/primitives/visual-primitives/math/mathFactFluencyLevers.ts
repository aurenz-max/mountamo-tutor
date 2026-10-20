/**
 * The in-item levers on math-fact-fluency, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 30 M3;
 * table qa/support-levers/m3-lever-tables-2026-10-02.md). No real-learner evidence: the misses are what `mathFactMiss`
 * observes, plus the catalog's documented struggles (subtraction facts, missing-number problems).
 *
 * Every drawing lever draws the same thing, `factModel`: the fact's printed numbers as dots, with no numeral anywhere.
 * - `two_parts` (layout; visual_fact): the picture redrawn as the fact's two parts in two colours (subtraction: the
 *   dots taken away crossed out). Answers `printed_number`, `other_operation`.
 * - `count_marks` (marks; visual_fact and a picture-to-equation match): tapping a dot stamps its running count on it.
 *   Numbers only the dots tapped. Answers off-by-one, and off-by-more on a visual fact with no `smaller_fact` (one
 *   already +1); every miss on a match. On a match it never splits the picture into the fact's parts, which would
 *   point at the matching equation.
 * - `fact_dots` (marks; equation_solve and an equation-to-picture match): dots under the printed fact, nothing under
 *   the "?". Answers every miss.
 * - `part_whole` (marks; missing_number): the dots with the known part shaded and the unknown part hollow and
 *   unlabelled. Answers every miss.
 * - `smaller_fact` (easier; visual_fact, equation_solve, missing_number): an ungraded fact of the same type,
 *   operation and blank whose second number (or blank) is 1 or 2; then the full item. Answers off-by-more.
 * - `far_match` (easier; match): an ungraded match with two choices whose totals are 3 or more apart.
 *
 * None shows a different item solved, so the set has no `model` lever and no support rule.
 * speed_round gets no lever (user ruling 2026-10-02): it is aid-free recall, a picture would make it equation_solve,
 * and recall has no step to make simpler; its misses are the card's `unanswered`.
 *
 * A fingers picture (hand emoji) cannot be tapped or split, so on it `two_parts` and `count_marks` draw their dots
 * UNDER the hands instead of in place of the picture (2026-10-08: fingers items had no help lever, J12).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { StepSegment } from '../../../components/live-activity/runtime/contract';
import type { MathFactFluencyChallenge } from './MathFactFluency';
import { MATH_FACT_MISSES } from './mathFactFluency.card';
import { mathFactMode } from './mathFactFluencyWorkspace';

export const PARTS_LEVER = 'two_parts';
export const MARKS_LEVER = 'count_marks';
export const DOTS_LEVER = 'fact_dots';
export const WHOLE_LEVER = 'part_whole';
export const SMALLER_LEVER = 'smaller_fact';
export const FAR_LEVER = 'far_match';

type C = MathFactFluencyChallenge;
/** The lesson's range, which a simpler item stays inside. */
export interface MathFactLeverContext { maxNumber: number }

const BY_MORE = ['short_by_more', 'over_by_more'];
const pictureToEquation = (c: C) => c.type === 'match' && c.matchDirection !== 'equation-to-visual';
/** A fingers picture keeps its hands; a lever's dots are drawn under them. */
export const fingersPicture = (c: C) => c.visualType === 'fingers';

/**
 * The fact's printed numbers as dot segments, in reading order. `plain` and `added` are the two parts of a sum,
 * `crossed` the dots taken away, `marked` a known part beside an unknown one, `empty` the unknown part: hollow,
 * unlabelled. Nothing here is a numeral.
 */
export function factModel(c: C): StepSegment[] {
  const { operand1: a, operand2: b, result: r } = c;
  const add = c.operation === 'addition';
  const seg = (count: number, tone: StepSegment['tone']): StepSegment => ({ count, tone });
  if (c.unknownPosition === 'result') return add ? [seg(a, 'plain'), seg(b, 'added')] : [seg(a - b, 'plain'), seg(b, 'crossed')];
  if (c.unknownPosition === 'operand2') return add ? [seg(a, 'marked'), seg(r - a, 'empty')] : [seg(r, 'marked'), seg(a - r, 'empty')];
  return add ? [seg(r - b, 'empty'), seg(b, 'marked')] : [seg(r, 'marked'), seg(b, 'crossed')];
}

/** The help lever each challenge's screen can draw, in order. */
export function helpLevers(c: C | null): string[] {
  if (!c) return [];
  if (c.type === 'visual-fact') return [PARTS_LEVER, MARKS_LEVER];
  if (c.type === 'match') return pictureToEquation(c) ? [MARKS_LEVER] : [DOTS_LEVER];
  if (c.type === 'equation-solve') return [DOTS_LEVER];
  if (c.type === 'missing-number') return [WHOLE_LEVER];
  return [];
}

/** easy starts with the mode's first help lever on screen: a starting position, never a recorded pull. */
export function startLevers(c: C | null): string[] {
  return c?.supportTier === 'easy' ? helpLevers(c).slice(0, 1) : [];
}

// ── Simplify builders ────────────────────────────────────────────────────────

const simplerId = (c: C) => `${c.id}~simpler`;
const MINUS = '−';
const eq = (a: number, op: 'addition' | 'subtraction', b: number, r: number) => `${a} ${op === 'addition' ? '+' : MINUS} ${b} = ${r}`;

function fact(c: C, a: number, b: number): C {
  const r = c.operation === 'addition' ? a + b : a - b;
  const correctAnswer = c.unknownPosition === 'operand1' ? a : c.unknownPosition === 'operand2' ? b : r;
  return { ...c, id: simplerId(c), operand1: a, operand2: b, result: r, correctAnswer, equation: eq(a, c.operation, b, r) };
}

/** Choices around the answer, as many as the item had, never negative. */
function choicesFor(answer: number, n: number): number[] {
  const near = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, answer + 4].filter(v => v >= 0);
  return [answer, ...near.slice(0, Math.max(n, 2) - 1)].sort((x, y) => x - y);
}

/** The second number (or the blank) is already 1 or 2: no step simpler in this mode. */
function alreadySmall(c: C): boolean {
  if (c.unknownPosition === 'result') return c.operand2 <= 1;
  if (c.unknownPosition === 'operand2') return c.operand2 <= 2;
  return c.operation === 'addition' ? c.operand1 <= 2 : c.operand2 <= 1;
}

/** Candidate (operand1, operand2) pairs for a simpler fact of this form, simplest first. */
function smallPairs(c: C): Array<[number, number]> {
  const add = c.operation === 'addition';
  if (c.unknownPosition === 'result') return add ? [[2, 1], [3, 1], [1, 1], [4, 1]] : [[3, 1], [4, 1], [2, 1], [5, 1]];
  if (c.unknownPosition === 'operand2') return add ? [[3, 1], [2, 1], [3, 2], [2, 2], [4, 1]] : [[4, 1], [3, 1], [5, 2], [4, 2], [5, 1]];
  return add ? [[1, 3], [1, 2], [2, 3], [2, 2], [1, 4]] : [[3, 1], [4, 1], [2, 1], [5, 1]];
}

/** Never the learner's fact, never its answer, inside the item's range. */
const fits = (c: C, s: C, maxNumber: number) => s.correctAnswer !== c.correctAnswer
  && !(s.operand1 === c.operand1 && s.operand2 === c.operand2) && Math.max(s.operand1, s.result) <= maxNumber && s.result >= 0;

/** `smaller_fact`: the same type, operation and blank, one step simpler; null when the item already is. */
export function smallerFact(c: C | null, maxNumber: number): C | null {
  if (!c || !['visual-fact', 'equation-solve', 'missing-number'].includes(c.type) || alreadySmall(c)) return null;
  for (const [a, b] of smallPairs(c)) {
    const s = fact(c, a, b);
    if (!fits(c, s, maxNumber)) continue;
    const take = c.operation === 'subtraction';
    if (c.type === 'visual-fact') return { ...s, visualCount: s.correctAnswer, options: choicesFor(s.correctAnswer, c.options?.length ?? 4),
      instruction: take ? 'Look at the picture. How many are left?' : 'Look at the picture. How many in all?' };
    if (c.type === 'equation-solve') return { ...s, options: choicesFor(s.correctAnswer, c.options?.length ?? 4), instruction: 'Solve this fact.' };
    return { ...s, options: undefined, instruction: 'Find the missing number.' };
  }
  return null;
}

/** An equation with the given total that is not the key's fact. */
const foilEquation = (total: number, op: C['operation']) => op === 'addition' ? eq(total - 1, op, 1, total) : eq(total + 1, op, 1, total);

/** `far_match`: two choices, the foil's total 3 or more from the key's, on a fact that is not the learner's. */
export function farMatch(c: C | null, maxNumber: number): C | null {
  if (c?.type !== 'match') return null;
  const pairs: Array<[number, number]> = c.operation === 'addition' ? [[1, 1], [2, 1], [1, 2], [3, 1], [2, 2], [1, 3], [3, 2]] : [[3, 1], [4, 1], [4, 2], [5, 2]];
  for (const [a, b] of pairs) {
    const s = fact({ ...c, unknownPosition: 'result' }, a, b);
    if (!fits(c, s, maxNumber)) continue;
    const answer = s.correctAnswer;
    const foil = answer + 3 <= Math.max(maxNumber, 5) ? answer + 3 : answer - 3;
    if (foil < 2 && c.operation === 'addition') continue;
    if (foil < 0) continue;
    const totals = [answer, foil].sort((x, y) => x - y);
    if (pictureToEquation(c)) {
      return { ...s, visualCount: answer, instruction: 'Look at the dots. Which fact shows how many in all?',
        equationOptions: totals.map(t => t === answer ? s.equation : foilEquation(t, c.operation)) };
    }
    const type = c.visualOptions?.[0]?.type ?? 'dot-array';
    return { ...s, instruction: 'Which picture shows the answer?', visualOptions: totals.map(count => ({ type, count })) };
  }
  return null;
}

/** The simpler item a simplify lever opens on this challenge (the journey rebuilds it with the same call). */
export function simplerItem(c: C | null, maxNumber: number): C | null {
  return c?.type === 'match' ? farMatch(c, maxNumber) : smallerFact(c, maxNumber);
}

// ── The lever set ────────────────────────────────────────────────────────────

const draws = (id: string) => (c: C) => helpLevers(c).includes(id) || null;
const under = (c: C) => (fingersPicture(c) ? ' The dots are drawn under the hands.' : '');

export const FLUENCY_LEVERS = leverSet<C, MathFactLeverContext>({
  modeOf: mathFactMode,
  missesOf: () => MATH_FACT_MISSES,
  specs: [
    { id: PARTS_LEVER, type: 'layout', modes: ['visual_fact'], answers: ['printed_number', 'other_operation'],
      when: 'The learner answers with a number from the fact, or combines the numbers the wrong way.',
      does: c => `Redraws the picture as the fact's two parts in two colours (taken-away dots crossed out). No numbers are written.${under(c)}`,
      content: draws(PARTS_LEVER),
      fact: (_on, c) => `${fingersPicture(c) ? 'Dots under the hands show' : 'The picture shows'} the fact's two parts in two colours; `
        + 'dots taken away are crossed out. No numbers are written.' },
    { id: MARKS_LEVER, type: 'marks', modes: ['visual_fact', 'match'], answers: 'all',
      // On a visual fact with a smaller fact, a far miscount is the simplify lever's; on a match every miss is this one's.
      answersOn: (c, { maxNumber }) => (c.type === 'match' ? MATH_FACT_MISSES
        : ['one_short', 'one_over', ...(smallerFact(c, maxNumber) ? [] : BY_MORE)]),
      when: 'The learner loses count of the picture.',
      does: c => `Makes each dot a tap target: a tapped dot shows its running count. Only dots the learner taps are numbered.${under(c)}`,
      content: draws(MARKS_LEVER),
      fact: (_on, c) => `${fingersPicture(c) ? 'Dots under the hands are tap targets' : 'Each dot is a tap target'}; a tapped dot shows its running count.` },
    { id: DOTS_LEVER, type: 'marks', modes: ['equation_solve', 'match'], answers: 'all',
      when: 'The learner cannot work the bare fact.',
      does: 'Draws dots under the printed fact: a group for each printed number, the taken-away dots crossed out. Nothing under the "?" and no numbers.',
      content: draws(DOTS_LEVER),
      fact: 'Dots under the printed fact show each printed number; taken-away dots are crossed out. Nothing is drawn for the "?".' },
    { id: WHOLE_LEVER, type: 'marks', modes: ['missing_number'], answers: 'all',
      when: 'The learner cannot find the missing number.',
      does: 'Draws the fact as dots: the known part shaded, the missing part as hollow dots with no number.',
      content: draws(WHOLE_LEVER),
      fact: 'Dots show the fact: the known part shaded, the missing part hollow and unnumbered.' },
    { id: SMALLER_LEVER, type: 'easier', modes: ['visual_fact', 'equation_solve', 'missing_number'], carrier: 'shown', answers: BY_MORE,
      when: 'This fact is too big to work yet.',
      does: 'Opens a smaller fact of the same kind first. It is not graded; the full item comes back after it.',
      content: (c, { maxNumber }) => smallerFact(c, maxNumber) },
    { id: FAR_LEVER, type: 'easier', modes: ['match'], carrier: 'shown', answers: BY_MORE,
      when: 'The choices are too close together to tell apart yet.',
      does: 'Opens an easier match first: a different fact and two choices far apart. It is not graded; the full item comes back after it.',
      content: (c, { maxNumber }) => farMatch(c, maxNumber) },
  ],
});
