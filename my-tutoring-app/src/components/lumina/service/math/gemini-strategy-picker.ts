import { Type, Schema } from "@google/genai";
import { StrategyPickerData, StrategyPickerChallenge, StrategyId } from "../../primitives/visual-primitives/math/StrategyPicker";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ============================================================================
// Constants
// ============================================================================

const VALID_STRATEGIES: StrategyId[] = [
  'counting-on', 'counting-back', 'make-ten', 'doubles',
  'near-doubles', 'tally-marks', 'draw-objects',
];

const STRATEGY_LABELS: Record<string, string> = {
  'counting-on': 'counting on (start from the bigger number and count up)',
  'counting-back': 'counting back (start from the bigger number and count down)',
  'make-ten': 'make-ten (decompose a number to fill a ten frame)',
  'doubles': 'doubles (use a known doubles fact)',
  'near-doubles': 'near-doubles (use a doubles fact and add 1)',
  'tally-marks': 'tally marks (draw tally marks for each number, then count all)',
  'draw-objects': 'drawing objects (draw circles for each number, then count all)',
};

/** Default number of distinct challenges to build when the eval mode pins to one type. */
const TARGET_INSTANCE_COUNT = 4;

// ---------------------------------------------------------------------------
// Strategy constraints — which problems each strategy's visualization can
// legitimately represent. Without this, the pool service randomly pairs
// strategies with operations/operands that their visualizations can't render
// (e.g., tally-marks for subtraction shows operand1+operand2 marks, doubles
// for non-doubles shows two equal piles of the smaller operand). See QA report
// strategy-picker-2026-05-19.md / EVAL_TRACKER STP-1..STP-4.
// ---------------------------------------------------------------------------

type Operation = 'addition' | 'subtraction';
type Problem = { operand1: number; operand2: number; operation: Operation };

interface StrategyConstraint {
  operation: Operation;
  /** Optional predicate the problem must satisfy (e.g. doubles ⇒ operand1 === operand2). */
  predicate?: (p: Problem) => boolean;
}

const STRATEGY_CONSTRAINTS: Record<StrategyId, StrategyConstraint> = {
  'counting-on':   { operation: 'addition' },
  'counting-back': { operation: 'subtraction' },
  'make-ten':      { operation: 'addition', predicate: p => p.operand1 + p.operand2 >= 8 && p.operand1 + p.operand2 <= 10 },
  'doubles':       { operation: 'addition', predicate: p => p.operand1 === p.operand2 },
  'near-doubles':  { operation: 'addition', predicate: p => Math.abs(p.operand1 - p.operand2) === 1 },
  'tally-marks':   { operation: 'addition' },
  'draw-objects':  { operation: 'addition' },
};

function strategyMatchesProblem(strat: StrategyId, p: Problem): boolean {
  const c = STRATEGY_CONSTRAINTS[strat];
  if (!c) return true;
  if (c.operation !== p.operation) return false;
  if (c.predicate && !c.predicate(p)) return false;
  return true;
}

// ============================================================================
// Setup Schema (lightweight first call — title + description only)
// ============================================================================

interface SetupResult {
  title: string;
  description: string;
  gradeBand: 'K' | '1';
  maxNumber: number;
  operations: ('addition' | 'subtraction')[];
  strategiesIntroduced: StrategyId[];
}

const setupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Fun title for the activity (e.g., 'Many Ways to Add!', 'Strategy Toolbox')",
    },
    description: {
      type: Type.STRING,
      description: "1-sentence educational description",
    },
  },
  required: ["title", "description"],
};

async function generateSetup(
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    operations: string[];
    strategiesIntroduced: string[];
    gradeBand: string;
  }>,
): Promise<SetupResult> {
  const gradeBand = config?.gradeBand || (gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1');
  const maxNumber = config?.maxNumber || (gradeBand === 'K' ? 5 : 10);
  const operations = config?.operations || (gradeBand === 'K' ? ['addition'] : ['addition', 'subtraction']);
  const strategies = config?.strategiesIntroduced ||
    (gradeBand === 'K'
      ? ['counting-on', 'tally-marks', 'draw-objects']
      : ['counting-on', 'counting-back', 'make-ten', 'doubles', 'tally-marks']);

  const prompt = `
Create a setup for a strategy-picker math activity teaching "${topic}" to ${gradeLevel} students.
Grade band: ${gradeBand}. Strategies in play: ${strategies.join(', ')}.

Return only:
- title: fun and engaging for young children
- description: 1-sentence educational summary
`;

  let data: { title?: string; description?: string } = {};
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: setupSchema },
    });
    data = result.text ? JSON.parse(result.text) : {};
  } catch {
    // fall through to defaults below
  }

  const validGradeBand: 'K' | '1' = (gradeBand === 'K' || gradeBand === '1') ? gradeBand : 'K';
  const validOps = (operations as string[]).filter(o => o === 'addition' || o === 'subtraction') as ('addition' | 'subtraction')[];
  const validStrats = (strategies as string[]).filter(s => VALID_STRATEGIES.includes(s as StrategyId)) as StrategyId[];

  return {
    title: data.title || 'Many Ways to Solve!',
    description: data.description || 'Solve problems using different strategies.',
    gradeBand: validGradeBand,
    maxNumber,
    operations: validOps.length > 0 ? validOps : ['addition'],
    strategiesIntroduced: validStrats.length > 0 ? validStrats : ['counting-on', 'tally-marks'],
  };
}

// ============================================================================
// Pool Service — Problems & Strategies (strategy-aware)
// ============================================================================
// Per PRD §6a #1 (pool-service for value-only data) and §6g #3 (pre-randomize
// assignments — structured-output Gemini is convergent). Selecting problems
// and strategy assignments in code rather than asking Gemini for them gives
// us deterministic variance and saves one call per session.
//
// Selection is *strategy-first*: pick the strategy, then pick a problem from
// the strategy's compatible pool (per STRATEGY_CONSTRAINTS). Pair builders
// (compare, try-another) further restrict to the intersection so both
// strategies' visualizations apply to the chosen problem.

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const FALLBACK_PROBLEM: Problem = { operand1: 2, operand2: 1, operation: 'addition' };

function enumerateProblems(
  maxNumber: number,
  operations: Operation[],
): Problem[] {
  const out: Problem[] = [];
  for (const op of operations) {
    for (let a = 1; a <= maxNumber; a++) {
      for (let b = 1; b <= maxNumber; b++) {
        if (op === 'addition' && a + b <= maxNumber) {
          out.push({ operand1: a, operand2: b, operation: 'addition' });
        } else if (op === 'subtraction' && a > b && a <= maxNumber) {
          // strict `a > b` excludes trivial a-a=0 (STP-4).
          out.push({ operand1: a, operand2: b, operation: 'subtraction' });
        }
      }
    }
  }
  return out;
}

function problemsForStrategy(
  strat: StrategyId,
  maxNumber: number,
  operations: Operation[],
): Problem[] {
  const c = STRATEGY_CONSTRAINTS[strat];
  if (!c || !operations.includes(c.operation)) return [];
  const pool = enumerateProblems(maxNumber, [c.operation]);
  return c.predicate ? pool.filter(c.predicate) : pool;
}

function problemKey(p: Problem): string {
  return `${p.operation}:${p.operand1}:${p.operand2}`;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function intersectProblems(a: Problem[], b: Problem[]): Problem[] {
  const keys = new Set(b.map(problemKey));
  return a.filter(p => keys.has(problemKey(p)));
}

function padStrategies(strategies: StrategyId[]): StrategyId[] {
  const out = [...strategies];
  for (const s of VALID_STRATEGIES) {
    if (out.length >= 2) break;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** Pick N (strategy, problem) pairs — strategy cycled for variance, problem
 *  drawn from that strategy's compatible pool. Used by guided + match. */
function selectStrategyProblemPairs(
  count: number,
  strategies: StrategyId[],
  maxNumber: number,
  operations: Operation[],
): Array<{ strat: StrategyId; p: Problem }> {
  if (strategies.length === 0) {
    return Array.from({ length: count }, () => ({ strat: 'counting-on' as StrategyId, p: FALLBACK_PROBLEM }));
  }
  const cycled = shuffleInPlace([...strategies]);
  return Array.from({ length: count }, (_, i) => {
    const strat = cycled[i % cycled.length];
    const p = pickRandom(problemsForStrategy(strat, maxNumber, operations));
    if (p) return { strat, p };
    // Strategy has no compatible problems in this config — fall back to any
    // strategy whose pool is non-empty.
    for (const s of VALID_STRATEGIES) {
      const candidate = pickRandom(problemsForStrategy(s, maxNumber, operations));
      if (candidate) return { strat: s, p: candidate };
    }
    return { strat, p: FALLBACK_PROBLEM };
  });
}

/** Pick N (stratA, stratB, problem) triples where the problem satisfies both
 *  strategies' constraints. Used by compare + try-another. If a strategy pair
 *  has empty intersection (e.g. doubles + near-doubles), re-roll up to 20
 *  times, then fall back to a known-safe pair. */
function selectPairProblemTriples(
  count: number,
  strategies: StrategyId[],
  maxNumber: number,
  operations: Operation[],
): Array<{ stratA: StrategyId; stratB: StrategyId; p: Problem }> {
  const pool = padStrategies(strategies);
  const safePool = pool.filter(s => {
    const c = STRATEGY_CONSTRAINTS[s];
    // "Safe" strategies have no operand predicate and are always pairable.
    return c && !c.predicate;
  });

  const triples: Array<{ stratA: StrategyId; stratB: StrategyId; p: Problem }> = [];
  for (let i = 0; i < count; i++) {
    let triple: { stratA: StrategyId; stratB: StrategyId; p: Problem } | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const shuffled = shuffleInPlace([...pool]);
      const stratA = shuffled[0];
      const stratB = shuffled[1];
      if (stratA === stratB) continue;
      const p = pickRandom(intersectProblems(
        problemsForStrategy(stratA, maxNumber, operations),
        problemsForStrategy(stratB, maxNumber, operations),
      ));
      if (p) { triple = { stratA, stratB, p }; break; }
    }
    if (!triple) {
      // Fallback: pair two unconstrained safe strategies (both work on any
      // addition problem). Prefer pulling from `strategies`; if it's all
      // constrained, fall back to global VALID_STRATEGIES.
      const safeA = safePool[0] ?? 'counting-on';
      const safeB = safePool[1] ?? (safePool[0] === 'counting-on' ? 'tally-marks' : 'counting-on');
      const p = pickRandom(intersectProblems(
        problemsForStrategy(safeA, maxNumber, operations),
        problemsForStrategy(safeB, maxNumber, operations),
      )) ?? FALLBACK_PROBLEM;
      triple = { stratA: safeA, stratB: safeB, p };
    }
    triples.push(triple);
  }
  return triples;
}

// ============================================================================
// Per-Challenge Schemas (tiny, focused — unchanged)
// ============================================================================

const guidedSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Warm instruction like 'Let\\'s solve this by counting on! Start from the bigger number.'",
    },
    strategySteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 scaffold steps guiding the strategy WITHOUT revealing the answer",
    },
  },
  required: ["instruction", "strategySteps"],
};

const tryAnotherSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction for trying a different strategy on this problem",
    },
    strategySteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 scaffold steps for the new strategy WITHOUT revealing the answer",
    },
  },
  required: ["instruction", "strategySteps"],
};

const compareSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'You solved it two ways! Let\\'s compare.'",
    },
    comparisonQuestion: {
      type: Type.STRING,
      description: "Reflective question like 'Which strategy felt easier for you?'",
    },
  },
  required: ["instruction", "comparisonQuestion"],
};

const chooseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Pick any strategy you like to solve this problem!'",
    },
  },
  required: ["instruction"],
};

const matchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Someone already solved this. Which strategy did they use?'",
    },
    workedSolution: {
      type: Type.STRING,
      description: "2-3 sentence description of a worked-out solution using a specific strategy. Do NOT name the strategy in the text.",
    },
  },
  required: ["instruction", "workedSolution"],
};

// ============================================================================
// Per-Challenge Generators (parametric on problem + strategy)
// ============================================================================

function problemStr(p: Problem): string {
  return p.operation === 'subtraction'
    ? `${p.operand1} - ${p.operand2}`
    : `${p.operand1} + ${p.operand2}`;
}

function problemResult(p: Problem): number {
  return p.operation === 'subtraction' ? p.operand1 - p.operand2 : p.operand1 + p.operand2;
}

async function generateGuidedContent(
  p: Problem,
  strat: StrategyId,
  gradeLevel: string,
): Promise<{ instruction: string; strategySteps: string[] }> {
  const prompt = `
Create a guided-strategy challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
Strategy: ${strat} — ${STRATEGY_LABELS[strat] || strat}

Write a warm instruction telling the student to solve using ${strat}.
Write 2-4 step-by-step scaffold steps that guide the process WITHOUT revealing the answer.
BAD: "Count 3 more: 4, 5. The answer is 5!"
GOOD: "Start at the bigger number. Now count up the smaller number. What number did you land on?"
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: guidedSchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (data?.instruction && Array.isArray(data.strategySteps) && data.strategySteps.length > 0) {
      return data;
    }
  } catch {
    // fall through to fallback
  }
  return fallbackGuidedContent(p, strat);
}

async function generateTryAnotherContent(
  p: Problem,
  priorStrat: StrategyId,
  newStrat: StrategyId,
  gradeLevel: string,
): Promise<{ instruction: string; strategySteps: string[] }> {
  const prompt = `
Create a try-another challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
The student might have used ${priorStrat} before. Now they solve it using: ${newStrat} — ${STRATEGY_LABELS[newStrat] || newStrat}

Write an encouraging instruction that frames this as a fresh angle on the problem
(e.g., "Try this one with ${newStrat}!" or "Let's see what ${newStrat} feels like.").
Write 2-4 scaffold steps for ${newStrat} WITHOUT revealing the answer.
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: tryAnotherSchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (data?.instruction && Array.isArray(data.strategySteps) && data.strategySteps.length > 0) {
      return data;
    }
  } catch {
    // fall through
  }
  return fallbackTryAnotherContent(p, newStrat);
}

async function generateCompareContent(
  p: Problem,
  stratA: StrategyId,
  stratB: StrategyId,
  gradeLevel: string,
): Promise<{ instruction: string; comparisonQuestion: string }> {
  const prompt = `
Create a compare challenge for ${gradeLevel} students.
They are looking at ${problemStr(p)} solved two ways: using ${stratA} and ${stratB}.
Both give the same answer. Ask a reflective question — there's no wrong answer.
Example questions: "Which strategy felt easier?", "Which way was faster for you?"
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: compareSchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (data?.instruction && data?.comparisonQuestion) return data;
  } catch {
    // fall through
  }
  return fallbackCompareContent(stratA, stratB);
}

async function generateChooseContent(
  p: Problem,
  gradeLevel: string,
): Promise<{ instruction: string }> {
  const prompt = `
Create a choose-your-strategy challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
The student picks their own strategy from a menu, then solves.
Write an encouraging instruction like "Pick any strategy you like to solve this!"
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: chooseSchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (data?.instruction) return data;
  } catch {
    // fall through
  }
  return { instruction: 'Pick any strategy you like to solve this problem!' };
}

async function generateMatchContent(
  p: Problem,
  strat: StrategyId,
  gradeLevel: string,
): Promise<{ instruction: string; workedSolution: string }> {
  const prompt = `
Create a match-strategy challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
The worked solution uses: ${strat} — ${STRATEGY_LABELS[strat] || strat}

Write a 2-3 sentence workedSolution describing how someone solved it using ${strat}.
Do NOT name the strategy in the text — the student must figure it out.
Example: "I started at 6 and counted up 3 hops on the number line: 7, 8, 9." (This is counting-on but doesn't say so.)
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: matchSchema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    if (data?.instruction && data?.workedSolution) return data;
  } catch {
    // fall through
  }
  return fallbackMatchContent(p, strat);
}

// ============================================================================
// Fallbacks (parametric)
// ============================================================================

function fallbackGuidedContent(p: Problem, strat: StrategyId) {
  return {
    instruction: `Let's solve ${problemStr(p)} by ${strat.replace('-', ' ')}! Follow the steps below.`,
    strategySteps: [
      'Look at the two numbers in the problem.',
      `Use the ${strat.replace('-', ' ')} strategy to work it out.`,
      'What answer did you get?',
    ],
  };
}

function fallbackTryAnotherContent(p: Problem, strat: StrategyId) {
  return {
    instruction: `Try ${problemStr(p)} a new way — using ${strat.replace('-', ' ')}!`,
    strategySteps: [
      `This time, use ${strat.replace('-', ' ')}.`,
      'Follow the visual to help you.',
      'What answer did you get?',
    ],
  };
}

function fallbackCompareContent(stratA: StrategyId, stratB: StrategyId) {
  return {
    instruction: `You can see this solved two ways: ${stratA.replace('-', ' ')} and ${stratB.replace('-', ' ')}.`,
    comparisonQuestion: 'Which strategy felt easier for you?',
  };
}

function fallbackMatchContent(p: Problem, strat: StrategyId) {
  const result = problemResult(p);
  const workedSolutions: Record<string, string> = {
    'counting-on': `I started at ${p.operand1} and counted up ${p.operand2} more on my fingers. I landed on ${result}.`,
    'counting-back': `I started at ${p.operand1} and counted back ${p.operand2}. I landed on ${result}.`,
    'make-ten': `I split ${p.operand2} to fill up to 10 first, then added the rest to get ${result}.`,
    'doubles': `I noticed both numbers are the same! I used my doubles fact to get ${result}.`,
    'near-doubles': `I used a doubles fact I know, then added 1 more to get ${result}.`,
    'tally-marks': `I drew ${p.operand1} tally marks, then ${p.operand2} more. I counted them all and got ${result}.`,
    'draw-objects': `I drew ${p.operand1} circles, then ${p.operand2} more. I counted them all and got ${result}.`,
  };
  return {
    instruction: 'Someone already solved this problem. Which strategy did they use?',
    workedSolution: workedSolutions[strat] || `I used a strategy to solve ${problemStr(p)} and got ${result}.`,
  };
}

// ============================================================================
// Challenge Builders (assemble StrategyPickerChallenge objects)
// ============================================================================

function buildProblemPayload(p: Problem): StrategyPickerChallenge['problem'] {
  return {
    equation: problemStr(p),
    operation: p.operation,
    operand1: p.operand1,
    operand2: p.operand2,
    result: problemResult(p),
  };
}

function buildMatchOptions(
  correct: StrategyId,
  strategiesIntroduced: StrategyId[],
  problem: Problem,
): string[] {
  // Distractors must be plausible for this problem, otherwise a savvy student
  // can eliminate them by operation/operand structure alone.
  const options: StrategyId[] = [correct];
  const plausible = strategiesIntroduced
    .filter(s => s !== correct && strategyMatchesProblem(s, problem));
  for (const s of shuffleInPlace([...plausible])) {
    if (options.length >= 3) break;
    options.push(s);
  }
  // If we still need fillers, pull from any compatible strategy in the global pool.
  if (options.length < 3) {
    for (const s of VALID_STRATEGIES) {
      if (options.length >= 3) break;
      if (!options.includes(s) && strategyMatchesProblem(s, problem)) options.push(s);
    }
  }
  return shuffleInPlace(options);
}

// ============================================================================
// Single-Mode Builders (N=4 distinct instances of one type, parallel calls)
// ============================================================================
//
// When the eval mode pins to ONE challenge type, fan out N parallel
// per-challenge Gemini calls with pre-randomized (problem, strategy) inputs.
// Variance comes from the in-code selection — not prompt phrasing — per PRD
// §6a #2 / §6g #3 (structured-output Gemini is convergent).

async function buildGuidedChallenges(
  setup: SetupResult,
  gradeLevel: string,
  count: number,
): Promise<StrategyPickerChallenge[]> {
  const pairs = selectStrategyProblemPairs(count, setup.strategiesIntroduced, setup.maxNumber, setup.operations);

  const contents = await Promise.all(
    pairs.map(({ p, strat }) => generateGuidedContent(p, strat, gradeLevel)),
  );

  return pairs.map(({ p, strat }, i) => ({
    id: `ch${i + 1}`,
    type: 'guided-strategy' as const,
    instruction: contents[i].instruction,
    problem: buildProblemPayload(p),
    assignedStrategy: strat,
    strategySteps: contents[i].strategySteps,
  }));
}

async function buildTryAnotherChallenges(
  setup: SetupResult,
  gradeLevel: string,
  count: number,
): Promise<StrategyPickerChallenge[]> {
  // Both strategies must apply to the problem so the instruction's "prior"
  // framing isn't nonsensical and the visualization renders correctly.
  const triples = selectPairProblemTriples(count, setup.strategiesIntroduced, setup.maxNumber, setup.operations);

  const contents = await Promise.all(
    triples.map(({ p, stratA, stratB }) => generateTryAnotherContent(p, stratA, stratB, gradeLevel)),
  );

  return triples.map(({ p, stratB }, i) => ({
    id: `ch${i + 1}`,
    type: 'try-another' as const,
    instruction: contents[i].instruction,
    problem: buildProblemPayload(p),
    assignedStrategy: stratB,
    strategySteps: contents[i].strategySteps,
  }));
}

async function buildCompareChallenges(
  setup: SetupResult,
  gradeLevel: string,
  count: number,
): Promise<StrategyPickerChallenge[]> {
  const triples = selectPairProblemTriples(count, setup.strategiesIntroduced, setup.maxNumber, setup.operations);

  const contents = await Promise.all(
    triples.map(({ p, stratA, stratB }) => generateCompareContent(p, stratA, stratB, gradeLevel)),
  );

  return triples.map(({ p, stratA, stratB }, i) => ({
    id: `ch${i + 1}`,
    type: 'compare' as const,
    instruction: contents[i].instruction,
    problem: buildProblemPayload(p),
    strategies: [stratA, stratB],
    comparisonQuestion: contents[i].comparisonQuestion,
  }));
}

async function buildChooseChallenges(
  setup: SetupResult,
  gradeLevel: string,
  count: number,
): Promise<StrategyPickerChallenge[]> {
  // Pick the problem first, then restrict the strategy menu to options that
  // actually apply (e.g., subtraction problems offer only counting-back).
  const problems: Problem[] = [];
  const seen = new Set<string>();
  while (problems.length < count) {
    const all = enumerateProblems(setup.maxNumber, setup.operations);
    if (all.length === 0) { problems.push(FALLBACK_PROBLEM); break; }
    const candidate = pickRandom(all);
    if (!candidate) break;
    const key = problemKey(candidate);
    if (problems.length < all.length && seen.has(key)) continue;
    seen.add(key);
    problems.push(candidate);
  }

  const contents = await Promise.all(problems.map((p) => generateChooseContent(p, gradeLevel)));

  return problems.map((p, i) => {
    const available = setup.strategiesIntroduced.filter(s => strategyMatchesProblem(s, p));
    return {
      id: `ch${i + 1}`,
      type: 'choose-your-strategy' as const,
      instruction: contents[i].instruction,
      problem: buildProblemPayload(p),
      // Always offer at least one option — if the strategiesIntroduced pool has
      // nothing compatible (shouldn't happen with default configs), fall back
      // to the operation's canonical strategy.
      availableStrategies: available.length > 0
        ? available
        : [p.operation === 'subtraction' ? 'counting-back' : 'counting-on'],
    };
  });
}

async function buildMatchChallenges(
  setup: SetupResult,
  gradeLevel: string,
  count: number,
): Promise<StrategyPickerChallenge[]> {
  const pairs = selectStrategyProblemPairs(count, setup.strategiesIntroduced, setup.maxNumber, setup.operations);

  const contents = await Promise.all(
    pairs.map(({ p, strat }) => generateMatchContent(p, strat, gradeLevel)),
  );

  return pairs.map(({ p, strat }, i) => ({
    id: `ch${i + 1}`,
    type: 'match-strategy' as const,
    instruction: contents[i].instruction,
    problem: buildProblemPayload(p),
    workedSolution: contents[i].workedSolution,
    strategyOptions: buildMatchOptions(strat, setup.strategiesIntroduced, p),
    correctStrategy: strat,
  }));
}

async function buildSingleModeChallenges(
  singleType: string,
  setup: SetupResult,
  gradeLevel: string,
  count: number,
): Promise<StrategyPickerChallenge[]> {
  switch (singleType) {
    case 'guided-strategy':       return buildGuidedChallenges(setup, gradeLevel, count);
    case 'try-another':           return buildTryAnotherChallenges(setup, gradeLevel, count);
    case 'compare':               return buildCompareChallenges(setup, gradeLevel, count);
    case 'choose-your-strategy':  return buildChooseChallenges(setup, gradeLevel, count);
    case 'match-strategy':        return buildMatchChallenges(setup, gradeLevel, count);
    default:                      return [];
  }
}

// ============================================================================
// Multi-Mode Builder (auto-mode: one challenge per allowed type)
// ============================================================================
//
// Preserves the original behavior: a shared problem across guided / try-another
// / compare (so the "compare" phase can reference the same equation), and
// separate problems for choose-your-strategy and match-strategy.

async function buildMultiModeChallenges(
  setup: SetupResult,
  gradeLevel: string,
  allowedTypes: Set<string>,
): Promise<StrategyPickerChallenge[]> {
  // Shared problem + strategy pair for guided/try/compare (so compare can
  // legitimately reference the prior solve). Both strategies must apply to
  // the shared problem — drive selection through `selectPairProblemTriples`.
  const sharedTriple = selectPairProblemTriples(1, setup.strategiesIntroduced, setup.maxNumber, setup.operations)[0];
  const chooseProblem =
    pickRandom(enumerateProblems(setup.maxNumber, setup.operations)) ?? FALLBACK_PROBLEM;
  const matchPair = selectStrategyProblemPairs(1, setup.strategiesIntroduced, setup.maxNumber, setup.operations)[0];

  const sharedP = sharedTriple.p;
  const matchP = matchPair.p;
  const matchStrategy = matchPair.strat;

  const needGuided = allowedTypes.has('guided-strategy') || allowedTypes.has('try-another') || allowedTypes.has('compare');
  const needTryAnother = allowedTypes.has('try-another') || allowedTypes.has('compare');
  const needCompare = allowedTypes.has('compare');
  const needChoose = allowedTypes.has('choose-your-strategy');
  const needMatch = allowedTypes.has('match-strategy');

  const [guided, tryAnother, compare, choose, match] = await Promise.all([
    needGuided ? generateGuidedContent(sharedP, sharedTriple.stratA, gradeLevel) : Promise.resolve(fallbackGuidedContent(sharedP, sharedTriple.stratA)),
    needTryAnother ? generateTryAnotherContent(sharedP, sharedTriple.stratA, sharedTriple.stratB, gradeLevel) : Promise.resolve(fallbackTryAnotherContent(sharedP, sharedTriple.stratB)),
    needCompare ? generateCompareContent(sharedP, sharedTriple.stratA, sharedTriple.stratB, gradeLevel) : Promise.resolve(fallbackCompareContent(sharedTriple.stratA, sharedTriple.stratB)),
    needChoose ? generateChooseContent(chooseProblem, gradeLevel) : Promise.resolve({ instruction: 'Pick any strategy you like!' }),
    needMatch ? generateMatchContent(matchP, matchStrategy, gradeLevel) : Promise.resolve(fallbackMatchContent(matchP, matchStrategy)),
  ]);

  const chooseAvailable = setup.strategiesIntroduced.filter(s => strategyMatchesProblem(s, chooseProblem));

  const allChallenges: StrategyPickerChallenge[] = [
    {
      id: 'ch1',
      type: 'guided-strategy',
      instruction: guided.instruction,
      problem: buildProblemPayload(sharedP),
      assignedStrategy: sharedTriple.stratA,
      strategySteps: guided.strategySteps,
    },
    {
      id: 'ch2',
      type: 'try-another',
      instruction: tryAnother.instruction,
      problem: buildProblemPayload(sharedP),
      assignedStrategy: sharedTriple.stratB,
      strategySteps: tryAnother.strategySteps,
    },
    {
      id: 'ch3',
      type: 'compare',
      instruction: compare.instruction,
      problem: buildProblemPayload(sharedP),
      strategies: [sharedTriple.stratA, sharedTriple.stratB],
      comparisonQuestion: compare.comparisonQuestion,
    },
    {
      id: 'ch4',
      type: 'choose-your-strategy',
      instruction: choose.instruction,
      problem: buildProblemPayload(chooseProblem),
      availableStrategies: chooseAvailable.length > 0
        ? chooseAvailable
        : [chooseProblem.operation === 'subtraction' ? 'counting-back' : 'counting-on'],
    },
    {
      id: 'ch5',
      type: 'match-strategy',
      instruction: match.instruction,
      problem: buildProblemPayload(matchP),
      workedSolution: match.workedSolution,
      strategyOptions: buildMatchOptions(matchStrategy, setup.strategiesIntroduced, matchP),
      correctStrategy: matchStrategy,
    },
  ];

  return allChallenges.filter(c => allowedTypes.has(c.type));
}

// ============================================================================
// Challenge type documentation (for eval mode resolution)
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'guided-strategy': {
    promptDoc:
      `"guided-strategy": Student follows a given strategy with step-by-step scaffolding to solve a problem. `
      + `Concrete, fully guided — the teacher assigns both the problem and the strategy.`,
    schemaDescription: "'guided-strategy' (follow a given strategy)",
  },
  'match-strategy': {
    promptDoc:
      `"match-strategy": Student reads a worked solution and identifies which strategy was used. `
      + `Multiple-choice recognition task — the strategy name is NOT in the solution text.`,
    schemaDescription: "'match-strategy' (identify strategy from worked solution)",
  },
  'try-another': {
    promptDoc:
      `"try-another": Student solves the SAME problem using a DIFFERENT strategy. `
      + `Builds flexibility — compare the feel of two approaches on one problem.`,
    schemaDescription: "'try-another' (solve same problem a different way)",
  },
  'compare': {
    promptDoc:
      `"compare": Metacognitive reflection — student compares two strategies they just used. `
      + `No wrong answer. Reflective question about preference, speed, or ease.`,
    schemaDescription: "'compare' (reflect on multiple strategies)",
  },
  'choose-your-strategy': {
    promptDoc:
      `"choose-your-strategy": Student picks their own strategy from a menu, then solves. `
      + `Autonomous selection — assesses strategic flexibility and preference.`,
    schemaDescription: "'choose-your-strategy' (autonomous strategy selection)",
  },
};

// ============================================================================
// Main Generator (public API)
// ============================================================================

/**
 * Generate strategy picker data.
 *
 * Architecture:
 *   1. Lightweight "setup" call → title + description.
 *   2. In-code pool service selects problems + strategy assignments.
 *   3. Per-challenge Gemini calls (parallel) for instructions, scaffold steps,
 *      worked solutions, etc.
 *
 * Branching:
 *   - Single-mode (eval mode pins to one challenge type) → N=4 distinct
 *     instances of that type via the pool-service builders.
 *   - Multi-mode (auto / no constraint) → one challenge per allowed type with
 *     a shared problem across guided / try-another / compare.
 */
export const generateStrategyPicker = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    operations: string[];
    strategiesIntroduced: string[];
    challengeCount: number;
    gradeBand: string;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>,
): Promise<StrategyPickerData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'strategy-picker',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('StrategyPicker', config?.targetEvalMode, evalConstraint);

  const allTypes = ['guided-strategy', 'try-another', 'compare', 'choose-your-strategy', 'match-strategy'];
  const allowedTypes = new Set(evalConstraint?.allowedTypes ?? allTypes);

  const setup = await generateSetup(topic, gradeLevel, config);

  let challenges: StrategyPickerChallenge[];
  if (allowedTypes.size === 1) {
    const [singleType] = Array.from(allowedTypes);
    const count = Math.max(1, config?.challengeCount ?? TARGET_INSTANCE_COUNT);
    challenges = await buildSingleModeChallenges(singleType, setup, gradeLevel, count);
  } else {
    challenges = await buildMultiModeChallenges(setup, gradeLevel, allowedTypes);
  }

  const typeBreakdown = challenges.map(c => c.type).join(', ');
  console.log(`[StrategyPicker] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title: setup.title,
    description: setup.description,
    challenges,
    maxNumber: setup.maxNumber,
    operations: setup.operations,
    strategiesIntroduced: setup.strategiesIntroduced,
    gradeBand: setup.gradeBand,
  };
};
