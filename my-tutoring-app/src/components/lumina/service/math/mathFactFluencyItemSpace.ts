/**
 * math-fact-fluency facts from an item space (service/itemSpace, skill /add-item-space).
 *
 * The LLM chose the facts, and every tier and every run opened with the same ones (7 + 8, 14 − 6,
 * 9 + 9, 17 − 9; 10-13 probe): the tier moved the distractors and the blank, never the fact. With a
 * tier and an objective the resolver fits to a strand, the space picks each fact at the tier's beta
 * band; the LLM writes only the instruction.
 *
 * Which items each mode can use (contract, item-space clause):
 *   - one step, every number within the lesson's maxNumber, addition only when the lesson has no
 *     subtraction.
 *   - visual-fact, equation-solve, speed-round, match: the result unknown.
 *   - missing-number: the change unknown (a + ? = c, operand2) or the start unknown (? + b = c,
 *     operand1). The space decides which, so the tier's blank preference does not run on this path.
 */
import type { MathFactFluencyChallenge } from '../../primitives/visual-primitives/math/MathFactFluency';
import type { AddSub20Item } from '../itemSpace/addSub20';
import type { ItemSpace, ItemSpaceId } from '../itemSpace';

export type FluencyMode = MathFactFluencyChallenge['type'];

export interface FluencyFact {
  operation: 'addition' | 'subtraction';
  operand1: number;
  operand2: number;
  result: number;
  unknownPosition: 'result' | 'operand1' | 'operand2';
}

const TO_FACT: Partial<Record<ItemSpaceId, (item: any, mode: FluencyMode) => FluencyFact | null>> = {
  'add-sub-20': (it: AddSub20Item, mode: FluencyMode) => {
    if (it.steps.length !== 1) return null;
    const missing = mode === 'missing-number';
    if (missing === (it.unknown === 'result')) return null;
    const { a, b, op } = it.steps[0];
    return {
      operation: op === '+' ? 'addition' : 'subtraction',
      operand1: a,
      operand2: b,
      result: op === '+' ? a + b : a - b,
      unknownPosition: it.unknown === 'change' ? 'operand2' : it.unknown === 'start' ? 'operand1' : 'result',
    };
  },
};

export const fluencySpaceSupported = (space: ItemSpaceId): boolean => !!TO_FACT[space];

export function itemAsFluencyFact(
  space: ItemSpaceId, item: unknown, mode: FluencyMode, maxNumber: number, subtraction: boolean,
): FluencyFact | null {
  const f = TO_FACT[space]?.(item, mode);
  if (!f) return null;
  if (Math.max(f.operand1, f.operand2, f.result) > maxNumber) return null;
  if (!subtraction && f.operation === 'subtraction') return null;
  return f;
}

export const answerOf = (f: FluencyFact): number =>
  f.unknownPosition === 'operand1' ? f.operand1 : f.unknownPosition === 'operand2' ? f.operand2 : f.result;

/**
 * Four multiple-choice options: the answer and three wrong ones inside 0..maxNumber. The wrong ones
 * are the space's mistakes (wrong operation, counting slip, smaller-from-larger) when they fall in
 * range, then the tier's spread fills the rest: easy off by 2 or 3, medium and hard off by 1.
 */
export function fluencyOptions(
  space: ItemSpace<any>, item: unknown, f: FluencyFact, maxNumber: number, spread: 'far' | 'near',
): number[] {
  const answer = answerOf(f);
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= maxNumber && v !== answer;
  const wrong: number[] = [];
  const add = (v: number) => { if (ok(v) && !wrong.includes(v) && wrong.length < 3) wrong.push(v); };
  const mistakes = space.distractors(item).filter((d) => d.distance === 'near').map((d) => Number(d.value));
  for (const v of mistakes.filter((v) => (spread === 'near' ? Math.abs(v - answer) <= 2 : Math.abs(v - answer) >= 2))) add(v);
  const offsets = spread === 'near' ? [1, -1, 2, -2, 3, -3] : [2, -2, 3, -3, 4, -4, 1, -1];
  for (const d of offsets) add(answer + d);
  for (let v = 0; v <= maxNumber && wrong.length < 3; v++) add(v);
  return [answer, ...wrong].sort(() => Math.random() - 0.5);
}

/**
 * The match equations: the correct one and three with different results, each result `gap` or more
 * from the correct one and inside 1..maxNumber, split unevenly so no option stands out.
 */
export function matchEquations(f: FluencyFact, maxNumber: number, gap: number, rand: () => number = Math.random): string[] {
  const op = f.operation === 'addition' ? '+' : '-';
  const correct = `${f.operand1} ${op} ${f.operand2} = ${f.result}`;
  const results: number[] = [];
  for (const t of [f.result + gap, f.result - gap, f.result + 2 * gap, f.result - 2 * gap, f.result + gap + 1,
    f.result - gap - 1, f.result + 3 * gap, f.result - 3 * gap]) {
    if (t >= 2 && t <= maxNumber && t !== f.result && !results.includes(t)) results.push(t);
    if (results.length === 3) break;
  }
  for (let t = 1; results.length < 3 && t <= maxNumber; t++) if (t !== f.result && !results.includes(t)) results.push(t);
  const split = (r: number) => { const a = r > 1 ? 1 + Math.floor(rand() * (r - 1)) : r; return `${a} + ${r - a} = ${r}`; };
  return [correct, ...results.map(split)].sort(() => rand() - 0.5);
}

/** A plain ask built in code, for when the wording call fails. Never states the answer. */
export function codeAsk(mode: FluencyMode, f: FluencyFact): string {
  const op = f.operation === 'addition' ? '+' : '-';
  switch (mode) {
    case 'match': return 'Which equation matches the picture?';
    case 'missing-number': return 'What number is missing?';
    case 'visual-fact': return `Look at the picture. What is ${f.operand1} ${op} ${f.operand2}?`;
    default: return `What is ${f.operand1} ${op} ${f.operand2}?`;
  }
}

export interface SpaceFluencyFact {
  fact: FluencyFact;
  item: unknown;
  itemSpace: { space: string; structure: string; beta: number };
}

/**
 * A lesson that asks for a mixed set of both operations ("a mixed set of addition and subtraction problems").
 * Its session holds half of each, in a shuffled order (the curriculum's "randomized operation sequence").
 */
export function lessonMixesOperations(lesson: string): boolean {
  const t = lesson.toLowerCase();
  return /\bmix(ed)?\b|\bboth operations\b|randomi[sz]ed operation/.test(t)
    && /\badd(ition|ing)?\b|\bsums?\b/.test(t) && /\bsubtract(ion|ing)?\b|\bdifferences?\b/.test(t);
}

/** Fisher-Yates over a copy. */
const shuffled = <T>(xs: readonly T[], rand: () => number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

type PickFn = (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => { beta: number; structure: string }[];

/** The scope of one operation of a mode, for a pick ranked within that operation. */
export const operationScope = (space: ItemSpaceId, mode: FluencyMode, maxNumber: number, op: FluencyFact['operation']) =>
  (it: unknown) => itemAsFluencyFact(space, it, mode, maxNumber, true)?.operation === op;

/** `count` facts in the band the mode can use, or empty (the caller keeps its own path). */
export function pickFluencyFacts(opts: {
  space: ItemSpaceId;
  pick: (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: any) => boolean) => { beta: number; structure: string }[];
  band: [number, number];
  count: number;
  mode: FluencyMode;
  maxNumber: number;
  subtraction: boolean;
  /**
   * A mixed set: half of each operation (subtraction gets the odd one), shuffled, each operation drawn by its own
   * pick (ranked within that operation, so an easy mixed set has the easiest subtractions, not none).
   */
  balance?: { addition: PickFn; subtraction: PickFn };
  rand?: () => number;
}): SpaceFluencyFact[] {
  const asFact = (it: unknown) => itemAsFluencyFact(opts.space, it, opts.mode, opts.maxNumber, opts.subtraction);
  const rand = opts.rand ?? Math.random;
  let items: { beta: number; structure: string }[];
  if (opts.balance && opts.subtraction) {
    const subCount = Math.ceil(opts.count / 2), addCount = opts.count - subCount;
    const of = (op: FluencyFact['operation']) => (it: unknown) => asFact(it)?.operation === op;
    const adds = opts.balance.addition(addCount, opts.band[0], opts.band[1], undefined, of('addition'));
    const subs = opts.balance.subtraction(subCount, opts.band[0], opts.band[1], undefined, of('subtraction'));
    if (adds.length < addCount || subs.length < subCount) return [];
    items = shuffled([...adds, ...subs], rand);
  } else {
    items = opts.pick(opts.count, opts.band[0], opts.band[1], undefined, (it) => asFact(it) !== null);
  }
  if (items.length < opts.count) return [];
  return items.map((it) => ({
    fact: asFact(it)!,
    item: it,
    itemSpace: { space: opts.space, structure: it.structure, beta: Number(it.beta.toFixed(2)) },
  }));
}
