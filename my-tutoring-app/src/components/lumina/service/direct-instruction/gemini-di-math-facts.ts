/**
 * gemini-di-math-facts — pool-scoped generator for the di-math-facts
 * primitive. Fork A (pool service): the item CONTENT is a code-owned fact pool
 * scoped to the objective — per-challenge data is value-only (operands,
 * answers, number words), and structured-output Gemini is convergent on
 * values, so Gemini NEVER emits per-challenge facts. Gemini's only job is the
 * session wrapper (kid title + description) and a factScope hint used ONLY
 * when the objective text is too generic for the code regexes to pin a scope.
 * Operands, display, spoken problem, answer word/numeral, the solved form, and
 * ASR aliases are all derived deterministically in code.
 *
 * SCOPE: the objective text is code-enforced over the model's pick (the
 * census lesson — the prompt asks, the code guarantees). Named facts
 * ("3 + 2", "three plus two") win outright; then make-ten / doubles /
 * within-N patterns; then the model's factScope; then a grade default
 * (K → within 5, else within 10).
 *
 * VARIANCE: a session never drills one answer by accident — the first
 * selection pass keeps at most ONE fact per distinct ANSWER until the count is
 * met, trivial facts (adding/subtracting zero, counting from zero) are capped
 * at one per session, and duplicates collapse on a per-skill canonical key
 * (addition commutes, subtraction does not). make-ten sessions are the
 * sanctioned exception: every answer IS ten, so the back-fill pass supplies
 * the rest.
 *
 * EVAL MODES (L1) — task identities, resolved from intent or pinned by the
 * tester/curator, then built HERE (Fork A: Gemini never emits the challenge
 * type — code stamps it, so there is no schema enum to constrain):
 *   - counting_next    — say the number after N (rote counting sequence).
 *   - answer_fact      — say the answer to a printed addition fact. The base.
 *   - fact_review      — cumulative mix drawn WIDE across the grade's whole
 *                        fact space, anchored on the objective's focus.
 *   - subtraction_fact — say the answer to a printed subtraction fact.
 * Every mode's spoken answer is a NUMBER WORD — the response class benched in
 * the #46 probe sitting — so the ladder needed no new bench sitting (standing
 * gate 1). The unconstrained ("mixed", resolution === null) path builds a
 * spread across ALL FOUR modes — never one Gemini-picked type (SP-21 Fork-A
 * discipline).
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type { DiMathFactsData } from "../../primitives/visual-primitives/direct-instruction/DiMathFacts";
import type {
  DiMathFactsChallenge,
  DiMathFactsChallengeType,
  DiMathFactsSupportTier,
} from "../../primitives/visual-primitives/direct-instruction/diMathFactsScript";

// ── Support tier harness (L3) ───────────────────────────────────────

type SupportTier = DiMathFactsSupportTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; the L0 easy shape stands). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * How much of the DISTAR sequence precedes the child's answer.
 *
 * The withdrawal is IDENTICAL across all four eval modes, and that is correct
 * rather than lazy: every mode is the same act (see the printed problem, speak
 * the number word), so the same three sub-steps precede it. What a MODE changes
 * is which facts are drawn; what a TIER changes is how much of the sequence is
 * handed over. Kept per-type-capable so a future mode can diverge.
 *
 * The tier NEVER changes which facts are selected — that would be structural
 * difficulty (operand structure — within 5 → crossing five → crossing ten — is
 * this pack's structural axis, queued for /add-structural-difficulty), and
 * mixing the two would make a tier change the content instead of the support.
 */
const resolveSupportStructure = (
  _type: DiMathFactsChallengeType,
  tier: SupportTier,
): { tier: SupportTier; describe: string } => ({
  tier,
  describe:
    tier === 'hard'
      ? 'cold answer — no model, no choral practice; the child retrieves the fact unaided'
      : tier === 'medium'
        ? 'modeled once, then answered alone — the choral "Together" step is withdrawn'
        : 'modeled and practiced together first — the full DISTAR sequence',
});

// ── Structural difficulty (L4): operand-boundary shape ─────────────

export interface DiMathFactsProblemShape {
  /** Largest answer/minuend/start+1 this tier prefers, inside the pool cap. */
  maximum: number;
  /** Boundary the selected fact must cross; null means the within-five floor. */
  crossingBoundary: 5 | 10 | null;
  /** True when the requested rung cannot exist inside this pool's ceiling. */
  saturated: boolean;
  promptLines: string[];
}

/**
 * One source of truth for the birth-certificate axis:
 *   easy   → within five
 *   medium → within ten, crossing five
 *   hard   → within twenty, crossing ten
 *
 * The objective/eval-mode pool remains authoritative. A within-five pool
 * collapses every tier to the floor; a within-ten pool honestly saturates hard
 * at crossing five. Crossing ten is available only when the objective already
 * permits a pool above ten — difficulty never widens that pool by itself.
 */
export const resolveProblemShape = (
  _type: DiMathFactsChallengeType,
  tier: SupportTier,
  poolCeiling: number,
): DiMathFactsProblemShape => {
  const legalCeiling = Math.max(1, Math.min(20, Math.floor(poolCeiling)));
  const requestedMaximum = tier === 'easy' ? 5 : tier === 'medium' ? 10 : 20;
  const requestedBoundary: 5 | 10 | null =
    tier === 'easy' ? null : tier === 'medium' ? 5 : 10;
  const maximum = Math.min(legalCeiling, requestedMaximum);
  const crossingBoundary: 5 | 10 | null =
    requestedBoundary !== null && maximum > requestedBoundary
      ? requestedBoundary
      : maximum > 5
        ? 5
        : null;
  const saturated = maximum < requestedMaximum || crossingBoundary !== requestedBoundary;
  const description = crossingBoundary === 10
    ? 'prefer facts that cross ten, staying within the objective pool'
    : crossingBoundary === 5
      ? 'prefer facts that cross five, staying within the objective pool'
      : 'keep facts within five';

  return {
    maximum,
    crossingBoundary,
    saturated,
    promptLines: [
      `${description}; never widen factScope or replace an explicitly named/focused fact`,
    ],
  };
};

const buildTierPromptSection = (tier: SupportTier | null): string => {
  if (!tier) return '';
  // Twenty is the design ceiling, not a license to widen the actual pool. The
  // post-process resolves again with each mode's real cap before selection.
  const shape = resolveProblemShape('answer_fact', tier, 20);
  return `\nDIFFICULTY TIER (${tier}):\n- ${shape.promptLines.join('\n- ')}\n`;
};

// ── Number words + ASR aliases (code-owned) ─────────────────────────

/** Number words 0..20 — the full answer range this pack can ever speak. */
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/** Whole-token ASR homophones — passive cross-check only, never the judge. */
const HOMOPHONES: Partial<Record<string, string[]>> = {
  one: ['won'],
  two: ['to', 'too'],
  three: ['free', 'tree'],
  four: ['for', 'fore'],
  six: ['sick'],
  eight: ['ate'],
  ten: ['tin'],
};

/** Aliases for answer n: the word, its digit string, and any homophones. */
const aliasesFor = (n: number): string[] => {
  const word = NUMBER_WORDS[n];
  return [word, String(n), ...(HOMOPHONES[word] ?? [])];
};

// ── Fact scope resolution (code-enforced regex over the objective) ──

interface FactPair { a: number; b: number }

type FactScope =
  | { kind: 'named'; facts: FactPair[] }
  | { kind: 'make_10' }
  | { kind: 'doubles' }
  | { kind: 'within'; maxSum: number };

/** Operand words for named-fact parsing ("three plus two") — 0..10 only. */
const OPERAND_WORDS = NUMBER_WORDS.slice(0, 11);
const wordOf = (w: string): number => OPERAND_WORDS.indexOf(w.toLowerCase());

const validPair = (a: number, b: number): boolean =>
  Number.isInteger(a) && Number.isInteger(b) &&
  a >= 0 && a <= 10 && b >= 0 && b <= 10 && a + b >= 1 && a + b <= 20;

/** Exact facts the objective names ("3 + 2", "3+2", "three plus two"). */
const parseNamedFacts = (text: string): FactPair[] => {
  const facts: FactPair[] = [];
  const digitRe = /(\d{1,2})\s*\+\s*(\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = digitRe.exec(text)) !== null) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (validPair(a, b)) facts.push({ a, b });
  }
  const wordRe = new RegExp(
    `\\b(${OPERAND_WORDS.join('|')})\\s+plus\\s+(${OPERAND_WORDS.join('|')})\\b`,
    'gi',
  );
  while ((m = wordRe.exec(text)) !== null) {
    const a = wordOf(m[1]);
    const b = wordOf(m[2]);
    if (validPair(a, b)) facts.push({ a, b });
  }
  return facts;
};

/**
 * The objective's fact scope, resolved from ALL the text we have. Named facts
 * win over patterns; patterns win over the model's factScope hint; the model
 * hint wins over the grade default (applied by the caller). Null means the
 * text pinned nothing.
 */
const resolveTextScope = (text: string): FactScope | null => {
  const named = parseNamedFacts(text);
  if (named.length > 0) return { kind: 'named', facts: named };
  if (/make\s+(a\s+)?ten|sums?\s+of\s+(ten|10)|ten[\s-]*frame/i.test(text)) {
    return { kind: 'make_10' };
  }
  if (/doubles/i.test(text)) return { kind: 'doubles' };
  const within = /(?:within|up\s+to|sums?\s+to|to)\s+(\d{1,2})/i.exec(text);
  if (within) {
    const maxSum = Math.min(20, Math.max(5, parseInt(within[1], 10)));
    return { kind: 'within', maxSum };
  }
  return null;
};

/** The model's factScope hint — used ONLY when the text pinned nothing. */
const scopeFromModel = (s: string): FactScope | null =>
  s === 'within_5' ? { kind: 'within', maxSum: 5 }
    : s === 'within_10' ? { kind: 'within', maxSum: 10 }
      : s === 'make_10' ? { kind: 'make_10' }
        : s === 'doubles' ? { kind: 'doubles' }
          : null;

/** Grade default: K-band → within 5, everyone else → within 10. */
const gradeDefaultScope = (gradeLevel: string): { kind: 'within'; maxSum: number } => ({
  kind: 'within',
  maxSum: /kinder|pre-?k|\bk\b/i.test(gradeLevel) ? 5 : 10,
});

/** The largest number this session may reach — the ceiling every non-addition
 *  pool is built against (subtraction minuends, the counting sequence). */
const ceilingOf = (scope: FactScope, gradeLevel: string): number => {
  if (scope.kind === 'within') return scope.maxSum;
  if (scope.kind === 'make_10') return 10;
  if (scope.kind === 'doubles') return 10;
  return gradeDefaultScope(gradeLevel).maxSum; // named facts → the grade band
};

// ── Pool builders (deterministic, in code, one per skill) ───────────

/** Addition pool. Named scopes never reach here. */
const buildPool = (scope: Exclude<FactScope, { kind: 'named' }>): FactPair[] => {
  if (scope.kind === 'make_10') {
    // Every pair that makes ten: (0,10) .. (10,0).
    return Array.from({ length: 11 }, (_, a) => ({ a, b: 10 - a }));
  }
  if (scope.kind === 'doubles') {
    // 1+1 .. 5+5 (sums stay within 10).
    return Array.from({ length: 5 }, (_, i) => ({ a: i + 1, b: i + 1 }));
  }
  const pool: FactPair[] = [];
  // The within-twenty L4 rung crosses ten with two single-digit/ten operands;
  // never turn it into multi-digit addition (e.g. 15 + 2) by accident.
  const operandCap = Math.min(10, scope.maxSum);
  for (let a = 0; a <= operandCap; a++) {
    for (let b = 0; b <= Math.min(operandCap, scope.maxSum - a); b++) {
      if (a + b >= 1) pool.push({ a, b });
    }
  }
  return pool;
};

/**
 * Subtraction pool, derived from the SAME objective scope so a "make ten"
 * lesson drills ten's partners rather than arbitrary differences:
 *   make_10 → the make-ten inverse (10 − n, the partner fact)
 *   doubles → halving (2n − n)
 *   within N / named → every minuend up to the ceiling.
 * `b < a` throughout, so no item ever answers zero (a K child reading "3 − 3"
 * as an answer is a separate concept, not fact fluency).
 */
const buildSubtractionPool = (scope: FactScope, ceiling: number): FactPair[] => {
  if (scope.kind === 'make_10') {
    return Array.from({ length: 9 }, (_, i) => ({ a: 10, b: i + 1 })); // 10−1 .. 10−9
  }
  if (scope.kind === 'doubles') {
    return Array.from({ length: 5 }, (_, i) => ({ a: 2 * (i + 1), b: i + 1 }));
  }
  const pool: FactPair[] = [];
  for (let a = 1; a <= ceiling; a++) {
    for (let b = 0; b < a; b++) pool.push({ a, b });
  }
  return pool;
};

/** Counting-sequence pool: start at n, say n+1. `b` is fixed at 1 (the step). */
const buildCountingPool = (ceiling: number): FactPair[] =>
  Array.from({ length: ceiling }, (_, i) => ({ a: i, b: 1 }));

// ── Per-skill answer / identity / triviality ───────────────────────

/** The answer for one pair UNDER a given skill — the single authority. */
const answerFor = (type: DiMathFactsChallengeType, p: FactPair): number =>
  type === 'counting_next' ? p.a + 1
    : type === 'subtraction_fact' ? p.a - p.b
      : p.a + p.b;

/** Canonical identity. Addition commutes (2+3 ≡ 3+2); subtraction does not. */
const keyFor = (type: DiMathFactsChallengeType, p: FactPair): string =>
  type === 'counting_next' ? `next:${p.a}`
    : type === 'subtraction_fact' ? `${p.a}-${p.b}`
      : p.a <= p.b ? `${p.a}+${p.b}` : `${p.b}+${p.a}`;

/** Facts that teach nothing when repeated: ± zero, or counting up from zero. */
const isTrivial = (type: DiMathFactsChallengeType, p: FactPair): boolean =>
  type === 'counting_next' ? p.a === 0
    : type === 'subtraction_fact' ? p.b === 0
      : p.a === 0 || p.b === 0;

/** The value whose ceiling defines "within N" for each task identity. */
const structuralMagnitude = (
  type: DiMathFactsChallengeType,
  p: FactPair,
): number =>
  type === 'counting_next' ? p.a
    : type === 'subtraction_fact' ? p.a
      : p.a + p.b;

/** Does this fact actually require stepping across the requested boundary? */
export const crossesOperandBoundary = (
  type: DiMathFactsChallengeType,
  p: FactPair,
  boundary: 5 | 10,
): boolean => {
  if (type === 'counting_next') return p.a === boundary;
  if (type === 'subtraction_fact') {
    return p.a > boundary && answerFor(type, p) <= boundary;
  }
  // Addition is commutative for identity but not for the spoken route. The
  // code-owned pool contains both orientations, so require the displayed first
  // addend to begin at/below the boundary and the sum to land above it.
  return p.a <= boundary && p.a + p.b > boundary;
};

// ── Misconception remediation (pilot): deterministic pool emphasis ─────────

export type DiMathFactsRemediationMove =
  | 'subtracts_by_adding'
  | 'echoes_operand'
  | 'reverses_count_direction';

/**
 * Resolve only reviewed, task-bounded signatures. This pack stores one
 * primitive-scoped diagnosis across four task identities, so the task gate is
 * part of the safety boundary: counting up is an error for subtraction and
 * the correct response for `counting_next`.
 */
export const resolveDiRemediationMove = (
  challengeType: DiMathFactsChallengeType,
  remediationFocus?: string,
): DiMathFactsRemediationMove | null => {
  const focus = remediationFocus?.trim().toLowerCase();
  if (!focus) return null;
  const namesSubtraction = /\b(?:subtraction|subtracts?|subtracting|minus)\b|take[ -]?away/.test(focus);
  const predictsSuccessor = /\b(?:adds?|adding|successor)\b|\bcomes?\s+after\b/.test(focus);
  if (challengeType === 'subtraction_fact' && namesSubtraction && predictsSuccessor) {
    return 'subtracts_by_adding';
  }

  if (challengeType === 'counting_next') {
    const namesCounting = /\b(?:count(?:s|ed|ing)?|number\s+after|sequence)\b/.test(focus);
    const reverses = /\b(?:before|back(?:ward|wards)?|previous|predecessor)\b/.test(focus);
    return namesCounting && reverses ? 'reverses_count_direction' : null;
  }

  const echoes = /\b(?:first|second|last)\s+(?:number|operand|addend)\b/.test(focus)
    || /\b(?:echo(?:es|ed|ing)?|repeat(?:s|ed|ing)?)\s+(?:the\s+)?(?:first|second|last)?\s*(?:number|operand|addend)\b/.test(focus);
  const taskCompatible = challengeType === 'subtraction_fact'
    ? namesSubtraction
    : /\b(?:addition|adds?|adding|plus|addend|fact review)\b/.test(focus);
  return echoes && taskCompatible ? 'echoes_operand' : null;
};

const isRemediationTarget = (
  move: DiMathFactsRemediationMove,
  type: DiMathFactsChallengeType,
  pair: FactPair,
): boolean => {
  if (move === 'subtracts_by_adding') {
    return pair.b === 1 && pair.a - 1 !== pair.a + 1;
  }
  if (move === 'echoes_operand') {
    const answer = answerFor(type, pair);
    return answer !== pair.a && answer !== pair.b;
  }
  return type === 'counting_next' && (pair.a % 5 === 0 || pair.a % 5 === 4);
};

/**
 * Put at most `requested` legal counterexamples ahead of ordinary transfer
 * items. Narrow moves with ample transfer capacity withhold extra matches;
 * echo-safe facts may remain as ordinary tail fill so item count never drops.
 */
const rankForRemediation = (
  pairs: FactPair[],
  move: DiMathFactsRemediationMove | null,
  type: DiMathFactsChallengeType,
  requested: number,
): FactPair[] => {
  if (!move || requested <= 0) return pairs;
  const eligible = pairs.filter((pair) => isRemediationTarget(move, type, pair));
  const targets = move === 'echoes_operand' && eligible.length > 1
    ? [
        eligible[0],
        eligible.find((pair) =>
          pair.a !== eligible[0].a
          && pair.b !== eligible[0].b
          && keyFor(type, pair) !== keyFor(type, eligible[0])
          && answerFor(type, pair) !== answerFor(type, eligible[0])) ?? eligible[1],
      ].slice(0, requested)
    : eligible.slice(0, requested);
  const targetKeys = new Set(targets.map((pair) => keyFor(type, pair)));
  const transfer = pairs.filter((pair) => !isRemediationTarget(move, type, pair));
  // Echo-safe addition facts make up almost the whole legal pool, so residual
  // matches remain available as ordinary transfer to preserve item count. The
  // narrower successor/boundary moves have ample non-target transfer capacity
  // and can enforce the two-item dosage exactly.
  const residualMatches = move === 'echoes_operand'
    ? eligible.filter((pair) => !targetKeys.has(keyFor(type, pair)))
    : [];
  return [...targets, ...transfer, ...residualMatches];
};

/**
 * Stable structural ranking: exact tier shape first, then the same tier's
 * legal upper band, then lower-band fallbacks. The input has already been
 * shuffled, so this changes only structural priority, not within-shape variety.
 */
const rankByProblemShape = (
  pairs: FactPair[],
  type: DiMathFactsChallengeType,
  shape: DiMathFactsProblemShape,
): FactPair[] => {
  const rank = (p: FactPair): number => {
    const magnitude = structuralMagnitude(type, p);
    if (magnitude > shape.maximum) return 3;
    if (shape.crossingBoundary === null) return magnitude <= shape.maximum ? 0 : 3;
    if (crossesOperandBoundary(type, p, shape.crossingBoundary)) return 0;
    if (magnitude > shape.crossingBoundary) return 1;
    return 2;
  };
  return pairs
    .map((pair, index) => ({ pair, index, rank: rank(pair) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ pair }) => pair);
};

/** Fisher-Yates. App code, not a workflow script — Math.random is fine. */
const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Variance-enforced selection for ONE skill: seed facts (explicitly named by
 * the objective) are taken first and bypass the variance caps; then a first
 * pass keeps at most ONE item per distinct ANSWER until the count is met; then
 * a back-fill pass completes the session. Trivial items are capped at one, and
 * everything dedupes on the skill's canonical key.
 */
const selectVaried = (
  pool: FactPair[],
  count: number,
  type: DiMathFactsChallengeType,
  seed: FactPair[] = [],
): FactPair[] => {
  const out: FactPair[] = [];
  const keys = new Set<string>();
  const answers = new Set<number>();
  let trivials = 0;
  const take = (p: FactPair) => {
    keys.add(keyFor(type, p));
    answers.add(answerFor(type, p));
    if (isTrivial(type, p)) trivials += 1;
    out.push(p);
  };
  for (const p of seed) {
    if (out.length >= count) break;
    if (keys.has(keyFor(type, p))) continue;
    take(p); // the objective asked for this exact fact — it always ships
  }
  // Pass 1: distinct answers only.
  for (const p of pool) {
    if (out.length >= count) break;
    if (keys.has(keyFor(type, p))) continue;
    if (isTrivial(type, p) && trivials >= 1) continue;
    if (answers.has(answerFor(type, p))) continue;
    take(p);
  }
  // Pass 2: back-fill (repeat answers allowed — the make-ten case lives here).
  for (const p of pool) {
    if (out.length >= count) break;
    if (keys.has(keyFor(type, p))) continue;
    if (isTrivial(type, p) && trivials >= 1) continue;
    take(p);
  }
  return out;
};

/**
 * Count → honor → reconstruct for a code-owned pool. Exact boundary facts are
 * exhausted before same-tier upper-band fallbacks, and only then may an
 * objective-defined pool that cannot express the tier (make-ten / named facts)
 * fill from its remaining legal items. Reusing the prior result as `seed`
 * preserves identities and variance across each stage.
 */
const selectVariedForShape = (
  pool: FactPair[],
  count: number,
  type: DiMathFactsChallengeType,
  shape: DiMathFactsProblemShape,
  seed: FactPair[] = [],
  remediationMove: DiMathFactsRemediationMove | null = null,
  remediationRequested = 0,
): FactPair[] => {
  const insideTier = pool.filter((p) => structuralMagnitude(type, p) <= shape.maximum);
  const exact = shape.crossingBoundary === null
    ? insideTier
    : insideTier.filter((p) => crossesOperandBoundary(type, p, shape.crossingBoundary!));
  let out = selectVaried(
    rankForRemediation(exact, remediationMove, type, remediationRequested),
    count,
    type,
    seed,
  );
  if (out.length < count) {
    out = selectVaried(
      rankForRemediation(insideTier, remediationMove, type, remediationRequested),
      count,
      type,
      out,
    );
  }
  if (out.length < count) {
    out = selectVaried(
      rankForRemediation(pool, remediationMove, type, remediationRequested),
      count,
      type,
      out,
    );
  }
  return out;
};

const DEFAULT_INSTANCE_COUNT = 5;
const MAX_INSTANCE_COUNT = 6;
/** Guaranteed-runnable easy spread — the never-empty final fallback. */
const EASY_SPREAD: FactPair[] = [
  { a: 1, b: 1 }, { a: 2, b: 1 }, { a: 2, b: 2 }, { a: 3, b: 1 }, { a: 3, b: 2 },
];

/**
 * The pool ONE skill draws from, given the objective's resolved scope.
 *
 * `fact_review` is the deliberate departure: its POOL is the grade's ENTIRE
 * fact space, not the narrow focus, because a review that re-drills only the
 * freshly-taught cluster is not a review. Its thread back to the lesson comes
 * from `seedForType`, which anchors up to 2 items from the focused pool. True
 * spaced review is bounded by the taught-set from student history, which is
 * unavailable at generation time — this grade-wide spread is the L1
 * approximation (same call as di-letter-sounds `letter_sound_review`; see the
 * L2 contextKeys note there).
 */
const poolForType = (
  type: DiMathFactsChallengeType,
  scope: FactScope,
  gradeLevel: string,
  ceiling: number,
): FactPair[] => {
  switch (type) {
    case 'counting_next':
      return buildCountingPool(ceiling);
    case 'subtraction_fact':
      return buildSubtractionPool(scope, ceiling);
    case 'fact_review':
      return buildPool(gradeDefaultScope(gradeLevel));
    case 'answer_fact':
    default:
      return buildPool(scope.kind === 'named' ? gradeDefaultScope(gradeLevel) : scope);
  }
};

/**
 * The items that ALWAYS ship for a skill, ahead of its pool.
 *
 * Two different jobs, both addition-only (a named "3 + 2" says nothing about
 * which subtraction or counting item to drill, so those skills draw purely
 * from their own scoped pool):
 *  - Facts the objective NAMED — the census lesson: if the objective said
 *    "3 + 2", that fact ships.
 *  - `fact_review` ANCHORS — review broadens across the whole grade band, but
 *    a review of a doubles lesson containing no doubles has lost its thread to
 *    what was just taught. Up to 2 items from the focused pool keep it.
 *    (Observed live: a `doubles` objective drew zero doubles before this.)
 */
const seedForType = (
  type: DiMathFactsChallengeType,
  scope: FactScope,
  shape?: DiMathFactsProblemShape,
): FactPair[] => {
  if (type !== 'answer_fact' && type !== 'fact_review') return [];
  if (scope.kind === 'named') return scope.facts;
  if (type === 'fact_review') {
    const candidates = shuffle(buildPool(scope));
    return (shape ? rankByProblemShape(candidates, type, shape) : candidates).slice(0, 2);
  }
  return []; // answer_fact's pool already IS the focused scope
};

// ── Challenge builder (all fields derived — never from the LLM) ─────

const buildChallenge = (
  pair: FactPair,
  index: number,
  type: DiMathFactsChallengeType,
): DiMathFactsChallenge => {
  const answer = answerFor(type, pair);
  const base = {
    challengeType: type,
    answerWord: NUMBER_WORDS[answer],
    answerNumeral: answer,
    asrAliases: aliasesFor(answer),
  };
  if (type === 'counting_next') {
    return {
      ...base,
      id: `dimf-${index + 1}-n${pair.a}`,
      a: pair.a,
      b: 1,
      display: `${pair.a} →`,
      problem: `the number after ${NUMBER_WORDS[pair.a]}`,
      solvedDisplay: `${pair.a} → ${answer}`,
    };
  }
  if (type === 'subtraction_fact') {
    return {
      ...base,
      id: `dimf-${index + 1}-${pair.a}m${pair.b}`,
      a: pair.a,
      b: pair.b,
      display: `${pair.a} - ${pair.b}`,
      problem: `${NUMBER_WORDS[pair.a]} minus ${NUMBER_WORDS[pair.b]}`,
      solvedDisplay: `${pair.a} - ${pair.b} = ${answer}`,
    };
  }
  return {
    ...base,
    id: `dimf-${index + 1}-${pair.a}p${pair.b}`,
    a: pair.a,
    b: pair.b,
    display: `${pair.a} + ${pair.b}`,
    problem: `${NUMBER_WORDS[pair.a]} plus ${NUMBER_WORDS[pair.b]}`,
    solvedDisplay: `${pair.a} + ${pair.b} = ${answer}`,
  };
};

/** Split `count` across `k` skills as evenly as possible, each skill ≥1. */
const distribute = (count: number, k: number): number[] => {
  const base = Math.floor(count / k);
  const rem = count % k;
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
};

// ── Gemini wrapper (title/description/scope hint ONLY — Fork A) ─────

/** Skill docs for the intent→mode router (Fork A — no schema to constrain). */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  counting_next: {
    promptDoc:
      `"counting_next": the child sees a number ("5 →") and says the number that comes NEXT ("six"). Rote counting sequence — the skill underneath counting on.`,
    schemaDescription: "'counting_next' (say the number after)",
  },
  answer_fact: {
    promptDoc:
      `"answer_fact": the child sees ONE printed addition fact ("2 + 1") and speaks the answer number word ("three"). The base skill, drilled as the objective's focused set.`,
    schemaDescription: "'answer_fact' (say the answer to the printed fact)",
  },
  fact_review: {
    promptDoc:
      `"fact_review": cumulative / spaced review — the child answers facts already taught, drawn as a WIDE mix across the whole grade range rather than one focused set.`,
    schemaDescription: "'fact_review' (mixed cumulative review)",
  },
  subtraction_fact: {
    promptDoc:
      `"subtraction_fact": the child sees ONE printed subtraction fact ("3 - 1") and speaks the answer number word ("two"). Take-away facts within the same range.`,
    schemaDescription: "'subtraction_fact' (say the answer to a take-away fact)",
  },
};

/** Every identity this pack can build, easiest → hardest (the mixed spread). */
const ALL_TYPES: DiMathFactsChallengeType[] = [
  'counting_next', 'answer_fact', 'fact_review', 'subtraction_fact',
];

const FACT_SCOPES = ['within_5', 'within_10', 'make_10', 'doubles'];

/** Gemini emits ONLY the wrapper — never the per-challenge facts (Fork A). */
const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a young learner (e.g. 'Fact Time!'). " +
        "It MUST NOT contain any digits or number words — the facts stay hidden until practice.",
    },
    description: {
      type: Type.STRING,
      description:
        "One friendly sentence telling the child they will say math facts out loud. " +
        "Same rule: no digits, no number words.",
    },
    factScope: {
      type: Type.STRING,
      enum: FACT_SCOPES,
      description:
        "Your read of the objective's number range: sums within 5, sums within 10, " +
        "pairs that make ten, or doubles. Used only when the objective text does not pin one itself.",
    },
  },
  required: ["title", "factScope"],
};

/** Answer-leak guard: a digit or a whole number word in the wrapper text. */
const leaksNumbers = (text: string): boolean =>
  /\d/.test(text) ||
  new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\b`, 'i').test(text);

const DEFAULT_TITLE = 'Math Facts';
const DEFAULT_DESCRIPTION = 'Let’s say our math facts out loud!';

export const generateDiMathFacts = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    /** Eval mode pinned by the tester/curator. Wins over intent, no LLM call. */
    targetEvalMode?: string;
    /** Private student-model input; consumed only by code-owned pool ranking. */
    remediationFocus?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which fact skill,
     * difficulty = both DISTAR withdrawal and in-pool operand structure.
     */
    difficulty?: string;
    [key: string]: unknown;
  },
): Promise<DiMathFactsData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );
  const supportTier = normalizeSupportTier(config?.difficulty);
  const remediationFocus = config?.remediationFocus;

  // The objective's fact scope, resolved from ALL the text we have and
  // code-enforced below (topic/objective beats whatever the model picks).
  const scopeText = `${intent ?? ''} ${config?.objectiveText ?? ''} ${topic}`;
  const textScope = resolveTextScope(scopeText);

  const prompt = `Scope a brisk Direct Instruction math-facts practice (printed problems, spoken number-word answers) for a young learner.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}${buildTierPromptSection(supportTier)}

RULES:
- Read the objective and pick the factScope that matches its number range: 'within_5' (numbers to five), 'within_10' (numbers to ten), 'make_10' (pairs that make ten), or 'doubles' (a number plus itself). A generic objective for a kindergartner means 'within_5'; otherwise 'within_10'.
- Write a warm, short kid title and a one-sentence description. They MUST NOT contain any digits or number words — the child must produce the answers, never hear or see them first.

Return the wrapper JSON only.`;

  // Resolve which eval-mode SKILL(s) this objective calls for. Fork A: the
  // resolution drives which challenge types we BUILD (no schema enum exists).
  const resolution = await resolveEvalModes(
    'di-math-facts',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeTypes: DiMathFactsChallengeType[] =
    (resolution?.allowedTypes as DiMathFactsChallengeType[] | undefined) ?? ALL_TYPES; // mixed = all four

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let modelScope: FactScope | null = null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wrapperSchema,
        systemInstruction:
          "You are an early-math specialist scoping a Direct Instruction math-facts drill. " +
          "You classify the objective's number range and write a warm kid-facing title and " +
          "description. You never reveal any fact or answer — no digits and no number words appear " +
          "in the title or description.",
      },
    });
    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as {
        title?: string;
        description?: string;
        factScope?: unknown;
      };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (typeof parsed.factScope === 'string') {
        modelScope = scopeFromModel(parsed.factScope);
      }
    }
  } catch (error) {
    console.error("Error generating di-math-facts wrapper:", error);
  }

  // Answer-leak guard: the wrapper must never carry a digit or number word.
  if (leaksNumbers(title) || leaksNumbers(description)) {
    title = DEFAULT_TITLE;
    description = DEFAULT_DESCRIPTION;
  }

  // Scope ladder: objective text → model hint → grade default. The text
  // always wins over the model's pick (code-enforced scope).
  const scope: FactScope = textScope ?? modelScope ?? gradeDefaultScope(gradeLevel);
  const scopeSource = textScope ? 'text' : modelScope ? 'model' : 'grade-default';
  const ceiling = ceilingOf(scope, gradeLevel);

  /** Review is capped by the taught grade-wide pool; other identities inherit
   * the objective's resolved ceiling. The tier can narrow, never widen, it. */
  const poolCeilingFor = (type: DiMathFactsChallengeType): number =>
    type === 'fact_review' ? gradeDefaultScope(gradeLevel).maxSum : ceiling;

  /** One skill's share of the session — its own scoped pool, own variance. */
  const buildFor = (type: DiMathFactsChallengeType, n: number): FactPair[] => {
    const pool = shuffle(poolForType(type, scope, gradeLevel, ceiling));
    const shape = supportTier
      ? resolveProblemShape(type, supportTier, poolCeilingFor(type))
      : undefined;
    const seed = seedForType(type, scope, shape);
    const remediationMove = resolveDiRemediationMove(type, remediationFocus);
    const remediationRequested = Math.min(2, n);
    const selected = shape
      ? selectVariedForShape(
          pool,
          n,
          type,
          shape,
          seed,
          remediationMove,
          remediationRequested,
        )
      : selectVaried(
          rankForRemediation(pool, remediationMove, type, remediationRequested),
          n,
          type,
          seed,
        );

    if (remediationFocus?.trim()) {
      const actual = remediationMove
        ? selected.slice(0, remediationRequested)
          .filter((pair) => isRemediationTarget(remediationMove, type, pair)).length
        : 0;
      console.log('[DiRemediation]', {
        primitive: 'di-math-facts',
        type,
        move: remediationMove,
        requested: remediationMove ? remediationRequested : 0,
        actual,
        skippedReason: !remediationMove
          ? (type === 'subtraction_fact' ? 'unsupported_focus' : 'mode_conflict')
          : actual < remediationRequested
            ? 'insufficient_eligible_targets'
            : null,
      });
    }

    return selected;
  };

  // Build the challenge set from the resolved mode(s). Single mode → all one
  // skill; blend/mixed → an interleaved spread so every mode appears (SP-21).
  let challenges: DiMathFactsChallenge[];
  if (modeTypes.length === 1) {
    challenges = buildFor(modeTypes[0], count)
      .map((pair, i) => buildChallenge(pair, i, modeTypes[0]));
  } else {
    const shares = distribute(count, modeTypes.length);
    const perModePairs = modeTypes.map((t, i) => buildFor(t, shares[i]));
    // Round-robin interleave so the session alternates skills.
    const interleaved: Array<{ pair: FactPair; type: DiMathFactsChallengeType }> = [];
    const maxLen = Math.max(...perModePairs.map((ps) => ps.length));
    for (let round = 0; round < maxLen; round++) {
      for (let m = 0; m < modeTypes.length; m++) {
        const pair = perModePairs[m][round];
        if (pair) interleaved.push({ pair, type: modeTypes[m] });
      }
    }
    challenges = interleaved
      .slice(0, count)
      .map(({ pair, type }, i) => buildChallenge(pair, i, type));
  }

  // Guarantee a runnable session even if every scope filter emptied out.
  if (challenges.length === 0) {
    challenges = EASY_SPREAD.slice(0, count)
      .map((pair, i) => buildChallenge(pair, i, 'answer_fact'));
  }

  // ── Support tier, applied deterministically at the END ─────────────
  // Gated ONLY on a tier being present, and resolved from each challenge's OWN
  // mode — difficulty is a STUDENT property, so a blended/mixed session must get
  // it too (gating on a single pinned mode is the silent no-op this layer exists
  // to kill). Code owns the support structure; the LLM only scoped the wrapper.
  //
  // Deliberately NOT injected into the Gemini prompt, unlike the math
  // references (same departure as di-sentence-reading L3). Fork A here means
  // the model's only job is the wrapper + a factScope hint — so a tier line in
  // the prompt could only do one thing: nudge it toward a different FACT RANGE.
  // That is tier→content leakage, i.e. structural difficulty through the back
  // door, and it would break the one hard rule. Operand structure is this
  // pack's structural axis and belongs to /add-structural-difficulty, not
  // here. The tier is 100% code-composed into the cue (diMathFactsScript
  // `leadInFor` + `coldAnswerGuard`).
  if (supportTier) {
    for (const ch of challenges) {
      ch.supportTier = resolveSupportStructure(ch.challengeType, supportTier).tier;
    }
    console.log(
      `[DiMathFacts] Support tier "${supportTier}" applied per-challenge (${modeTypes.length === 1 ? `single-mode ${modeTypes[0]}` : 'blended'}) — ${resolveSupportStructure(challenges[0]?.challengeType ?? 'answer_fact', supportTier).describe}`,
    );
    console.log('[DiMathFacts] Structural tier results:', challenges.map((ch) => {
      const shape = resolveProblemShape(
        ch.challengeType,
        supportTier,
        poolCeilingFor(ch.challengeType),
      );
      const pair = { a: ch.a, b: ch.b };
      const actual = shape.crossingBoundary === null
        ? structuralMagnitude(ch.challengeType, pair) <= shape.maximum
        : crossesOperandBoundary(ch.challengeType, pair, shape.crossingBoundary);
      return {
        type: ch.challengeType,
        target: shape.crossingBoundary === null
          ? `within-${shape.maximum}`
          : `cross-${shape.crossingBoundary}`,
        actual,
        saturated: shape.saturated || !actual,
      };
    }));
  }

  // Session identity = the first item's skill (a pinned mode → that mode).
  const primaryType: DiMathFactsChallengeType = challenges[0]?.challengeType ?? 'answer_fact';

  const data: DiMathFactsData = {
    title,
    description,
    challengeType: primaryType,
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
    // Flat item-set summary for the tutoring scaffold's RUNTIME STATE (catalog
    // contextKey `facts`) — present from the first auth-time prompt, before the
    // component's live context sync takes over. PRINTED PROBLEMS ONLY: the
    // answer-leak rule holds here too, so never `solvedDisplay`/`answerWord`.
    facts: challenges.map((c) => c.display).join(', '),
  };

  console.log("DI Math Facts Generated:", {
    title: data.title,
    modes: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed',
    types: challenges.map((c) => c.challengeType),
    scope: scope.kind === 'named'
      ? `named(${scope.facts.length}) [${scopeSource}]`
      : scope.kind === 'within'
        ? `within ${scope.maxSum} [${scopeSource}]`
        : `${scope.kind} [${scopeSource}]`,
    items: challenges.map((c) => `${c.display} = ${c.answerNumeral}`),
    count: challenges.length,
  });

  return data;
};
