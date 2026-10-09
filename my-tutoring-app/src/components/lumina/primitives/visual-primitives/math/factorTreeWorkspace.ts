/**
 * Factor tree on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C15).
 *
 * Pure: the component and any probe read the same assignment and scene. A challenge is one composite to factor
 * into primes on the screen: the learner taps a number that is not prime, types two factors (or, in a guided mode,
 * taps a listed factor pair) and presses Split. Each split is checked by the activity: a right split that leaves a
 * composite on the tree stays and is not a commit; a wrong split, and the split that makes every leaf prime, are.
 * The tutor is never handed a factor pair, a quotient or the factorization.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { FactorTreeChallenge, TreeNode } from './FactorTree';

export type FactorTreeNodes = ReadonlyMap<string, TreeNode>;

export const isPrime = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
  return true;
};

/** The factor pairs of n with both factors above 1, smaller factor first. */
export const factorPairs = (n: number): Array<[number, number]> => {
  const pairs: Array<[number, number]> = [];
  for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) pairs.push([i, n / i]);
  return pairs;
};

/** n's prime factors with multiplicity, smallest first. */
export const primeFactors = (n: number): number[] => {
  const out: number[] = [];
  let rest = n;
  for (let p = 2; p <= rest && rest > 1; p++) while (rest % p === 0) { out.push(p); rest /= p; }
  return out;
};

/** The leaves (unsplit nodes), smallest first. */
export const treeLeaves = (tree: FactorTreeNodes): number[] => {
  const leaves: number[] = [];
  tree.forEach(node => { if (!node.factors) leaves.push(node.value); });
  return leaves.sort((a, b) => a - b);
};

/** The activity's finish line: more than one leaf, every one prime. */
export const treeComplete = (tree: FactorTreeNodes): boolean => {
  const leaves = treeLeaves(tree);
  return leaves.length > 1 && leaves.every(isPrime);
};

/** The splits made so far, in tree order: "36 = 4 × 9; 4 = 2 × 2". */
export function describeSplits(tree: FactorTreeNodes, id = '0'): string[] {
  const node = tree.get(id);
  if (!node?.factors) return [];
  return [`${node.value} = ${node.factors[0]} × ${node.factors[1]}`,
    ...describeSplits(tree, `${id}-0`), ...describeSplits(tree, `${id}-1`)];
}

export function workspaceAssignment(challenge: FactorTreeChallenge): TeachingAssignment {
  return {
    id: challenge.id,
    task: `Find the prime factorization of ${challenge.rootValue}: split it into two factors, then keep splitting `
      + 'every factor that is not prime until every leaf of the tree is prime.',
    response: 'gesture',
  };
}

/** One split the learner tried: the number tapped and the two factors given. */
export interface FactorSplit { value: number; factor1: number; factor2: number }

export const splitCorrect = ({ value, factor1, factor2 }: FactorSplit) =>
  factor1 > 1 && factor2 > 1 && factor1 * factor2 === value;

/** The learner's work in their terms, never the key. */
export function describeFactorWork(tree: FactorTreeNodes, split: FactorSplit | null): string {
  if (split && !splitCorrect(split)) return `Tried to split ${split.value} into ${split.factor1} × ${split.factor2}`;
  const splits = describeSplits(tree);
  if (!splits.length) return 'Nothing split yet';
  return `${treeComplete(tree) ? 'Finished the tree' : 'Split so far'}: ${splits.join('; ')}`;
}

/**
 * What a wrong split shows (`TeachingAttempt.miss`, handoff 20), drawn from the catalog's commonStruggles (using 1
 * as a factor) and the factor-pair errors a split can show:
 * - `used_one`: 1 × the number (the product is right, the pair is useless);
 * - `added`: two numbers that add to the number instead of multiplying to it;
 * - `wrong_partner`: one factor divides the number, but the other is not the number divided by it;
 * - `not_a_factor`: neither number divides the number.
 */
export type FactorTreeMiss = 'used_one' | 'added' | 'wrong_partner' | 'not_a_factor';

const MISSES: readonly FactorTreeMiss[] = ['used_one', 'added', 'wrong_partner', 'not_a_factor'];
export const FACTOR_TREE_MISSES_BY_MODE: Record<string, readonly FactorTreeMiss[]> = {
  guided_small: MISSES, guided_medium: MISSES, unguided: MISSES, unguided_large: MISSES,
  assessment_intro: MISSES, assessment: MISSES,
};

export function factorMiss(split: FactorSplit): FactorTreeMiss | undefined {
  if (splitCorrect(split)) return undefined;
  const { value, factor1: a, factor2: b } = split;
  if ((a === 1 || b === 1) && a * b === value) return 'used_one';
  if (a + b === value) return 'added';
  const divides = (d: number) => Number.isInteger(d) && d > 1 && d < value && value % d === 0;
  return divides(a) || divides(b) ? 'wrong_partner' : 'not_a_factor';
}

export interface FactorTreeView {
  tree: FactorTreeNodes;
  /** The number tapped and waiting for its two factors, if any. */
  selected: number | null;
  /** Guided modes list the selected number's factor pairs to tap. */
  pairsListed: boolean;
  /** Prime leaves drawn green (withdrawn at the hard tier). */
  primesMarked: boolean;
  /** The running "current factorization" panel. */
  runningShown: boolean;
  /** The last split tried, while its wrong answer is on screen. */
  lastSplit: FactorSplit | null;
}

/** What is drawn and asked. The tree as the learner built it; never a factor pair or the factorization to come. */
export function workspaceScene(challenge: FactorTreeChallenge, view: FactorTreeView): WorkspaceScene {
  const splits = describeSplits(view.tree);
  const facts: Record<string, string> = {
    kind: 'factor tree',
    number: String(challenge.rootValue),
    splits: splits.length ? splits.join('; ') : 'none yet',
    leaves: treeLeaves(view.tree).join(', '),
    primeLeaves: view.primesMarked
      ? 'drawn green; a prime cannot be tapped'
      : 'not colored; a prime cannot be tapped',
    factorPairs: view.pairsListed
      ? 'listed as buttons for the number the learner taps'
      : 'not listed: the learner types both factors',
    ...(view.runningShown ? { runningFactorization: 'shown: the leaves written as a product' } : {}),
    ...(view.selected !== null ? { selected: `${view.selected}, waiting for two factors` } : {}),
    learnerWork: describeFactorWork(view.tree, view.lastSplit),
    constraints: 'The learner taps a number that is not prime, types two factors and presses Split (or taps a listed '
      + 'factor pair). The activity checks each split itself: a right split stays on the tree, and the tree is finished '
      + 'when every leaf is prime. You cannot tap, type or press Split.',
  };
  return { objects: [], facts };
}

/**
 * The journey row's splits from the leaves on screen (`liveJourneySpec.ts`). `correct`: every composite leaf split
 * by its smallest prime until all are prime. `wrong`: the first composite leaf split into its smallest prime and the
 * partner plus one (`wrong_partner`, or `added` where those happen to sum to it).
 */
export function factorHarnessSplits(leaves: readonly number[], intent: 'correct' | 'wrong'): FactorSplit[] {
  const composites = leaves.filter(n => n > 3 && !isPrime(n));
  if (intent === 'wrong') {
    const v = composites[0];
    if (v === undefined) return [];
    const p = primeFactors(v)[0];
    return [{ value: v, factor1: p, factor2: v / p + 1 }];
  }
  const out: FactorSplit[] = [];
  const split = (v: number) => {
    if (isPrime(v) || v < 4) return;
    const p = primeFactors(v)[0];
    out.push({ value: v, factor1: p, factor2: v / p });
    split(v / p);
  };
  composites.forEach(split);
  return out;
}

/** The factorization as the screen prints it when the tree is finished ("2^2 × 3^2") and as a plain product. */
export function factorizationForms(n: number): string[] {
  const primes = primeFactors(n);
  const counts = new Map<number, number>();
  primes.forEach(p => counts.set(p, (counts.get(p) ?? 0) + 1));
  const exp = Array.from(counts).map(([p, c]) => (c === 1 ? `${p}` : `${p}^${c}`)).join(' × ');
  return Array.from(new Set([exp, primes.join(' × ')]));
}
