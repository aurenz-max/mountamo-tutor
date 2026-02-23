import { Type, Schema } from "@google/genai";
import { StrategyPickerData, StrategyPickerChallenge, StrategyId } from "../../primitives/visual-primitives/math/StrategyPicker";
import { ai } from "../geminiClient";

// ============================================================================
// Setup Schema (lightweight first call)
// ============================================================================

interface SetupResult {
  title: string;
  description: string;
  gradeBand: 'K' | '1';
  maxNumber: number;
  operations: ('addition' | 'subtraction')[];
  strategiesIntroduced: StrategyId[];
  /** 3 problems: problem[0] for guided+try+compare, problem[1] for choose, problem[2] for match */
  problems: Array<{ operand1: number; operand2: number; operation: 'addition' | 'subtraction' }>;
  /** Which strategy to use for guided-strategy (problem 0) */
  guidedStrategy: StrategyId;
  /** Which strategy to use for try-another (problem 0) */
  tryAnotherStrategy: StrategyId;
  /** Which strategy the worked solution in match-strategy uses */
  matchCorrectStrategy: StrategyId;
}

const setupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Fun title for the activity (e.g., 'Many Ways to Add!', 'Strategy Toolbox')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description"
    },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          operand1: { type: Type.NUMBER, description: "First number" },
          operand2: { type: Type.NUMBER, description: "Second number" },
          operation: { type: Type.STRING, description: "'addition' or 'subtraction'" }
        },
        required: ["operand1", "operand2", "operation"]
      },
      description: "Exactly 3 arithmetic problems within maxNumber. Problem 1 is for guided+compare, problem 2 for choose-your-strategy, problem 3 for match-strategy."
    },
    guidedStrategy: {
      type: Type.STRING,
      description: "Strategy for the guided-strategy challenge. One of: counting-on, counting-back, make-ten, doubles, near-doubles, tally-marks, draw-objects"
    },
    tryAnotherStrategy: {
      type: Type.STRING,
      description: "A DIFFERENT strategy for the try-another challenge (same problem). Must differ from guidedStrategy."
    },
    matchCorrectStrategy: {
      type: Type.STRING,
      description: "Which strategy the worked-solution in the match challenge demonstrates."
    }
  },
  required: ["title", "description", "problems", "guidedStrategy", "tryAnotherStrategy", "matchCorrectStrategy"]
};

// ============================================================================
// Per-Challenge Schemas (tiny, focused)
// ============================================================================

const guidedSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Warm instruction like 'Let\\'s solve this by counting on! Start from the bigger number.'"
    },
    strategySteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 scaffold steps guiding the strategy WITHOUT revealing the answer"
    }
  },
  required: ["instruction", "strategySteps"]
};

const tryAnotherSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction for solving the SAME problem a different way, e.g. 'Now try using tally marks!'"
    },
    strategySteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-4 scaffold steps for the new strategy WITHOUT revealing the answer"
    }
  },
  required: ["instruction", "strategySteps"]
};

const compareSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'You solved it two ways! Let\\'s compare.'"
    },
    comparisonQuestion: {
      type: Type.STRING,
      description: "Reflective question like 'Which strategy felt easier for you?'"
    }
  },
  required: ["instruction", "comparisonQuestion"]
};

const chooseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Pick any strategy you like to solve this problem!'"
    }
  },
  required: ["instruction"]
};

const matchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    instruction: {
      type: Type.STRING,
      description: "Instruction like 'Someone already solved this. Which strategy did they use?'"
    },
    workedSolution: {
      type: Type.STRING,
      description: "2-3 sentence description of a worked-out solution using a specific strategy. Do NOT name the strategy in the text."
    },
    strategyOptions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 strategy names as multiple-choice options"
    }
  },
  required: ["instruction", "workedSolution", "strategyOptions"]
};

// ============================================================================
// Setup Generator
// ============================================================================

const VALID_STRATEGIES: StrategyId[] = [
  'counting-on', 'counting-back', 'make-ten', 'doubles',
  'near-doubles', 'tally-marks', 'draw-objects'
];

async function generateSetup(
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    maxNumber: number;
    operations: string[];
    strategiesIntroduced: string[];
    challengeCount: number;
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

Grade band: ${gradeBand}. Max number: ${maxNumber}. Operations: ${operations.join(', ')}.
Available strategies: ${strategies.join(', ')}.

Requirements:
- Generate exactly 3 problems. All operands and results must be within ${maxNumber}.
  - Problem 1: for guided-strategy + try-another + compare (addition preferred)
  - Problem 2: for choose-your-strategy (can be different operation)
  - Problem 3: for match-strategy
- guidedStrategy and tryAnotherStrategy must be DIFFERENT and both from: ${strategies.join(', ')}
- matchCorrectStrategy must be from: ${strategies.join(', ')}
- For subtraction: operand1 must be >= operand2 (no negative results)
- Title should be fun and engaging for young children
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: setupSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('No setup data returned from Gemini');

  // --- Validate & fix ---
  const validGradeBand = (gradeBand === 'K' || gradeBand === '1') ? gradeBand : 'K';
  const validOps = (operations as string[]).filter(o => o === 'addition' || o === 'subtraction') as ('addition' | 'subtraction')[];
  const validStrats = (strategies as string[]).filter(s => VALID_STRATEGIES.includes(s as StrategyId)) as StrategyId[];

  // Validate problems
  let problems = Array.isArray(data.problems) ? data.problems : [];
  problems = problems.map((p: Record<string, unknown>) => ({
    operand1: typeof p.operand1 === 'number' ? Math.min(Math.max(p.operand1 as number, 0), maxNumber) : 2,
    operand2: typeof p.operand2 === 'number' ? Math.min(Math.max(p.operand2 as number, 0), maxNumber) : 3,
    operation: p.operation === 'subtraction' ? 'subtraction' as const : 'addition' as const,
  }));

  // Ensure 3 problems
  while (problems.length < 3) {
    problems.push({ operand1: 2, operand2: 1, operation: 'addition' as const });
  }

  // Clamp sums/differences
  for (const p of problems) {
    if (p.operation === 'addition' && p.operand1 + p.operand2 > maxNumber) {
      p.operand2 = maxNumber - p.operand1;
      if (p.operand2 < 0) { p.operand1 = 1; p.operand2 = 1; }
    }
    if (p.operation === 'subtraction' && p.operand1 < p.operand2) {
      [p.operand1, p.operand2] = [p.operand2, p.operand1];
    }
  }

  // Validate strategies
  let guided = VALID_STRATEGIES.includes(data.guidedStrategy) ? data.guidedStrategy : validStrats[0] || 'counting-on';
  let tryAnother = VALID_STRATEGIES.includes(data.tryAnotherStrategy) ? data.tryAnotherStrategy : validStrats[1] || 'tally-marks';
  if (guided === tryAnother) {
    tryAnother = validStrats.find(s => s !== guided) || 'draw-objects';
  }
  const matchCorrect = VALID_STRATEGIES.includes(data.matchCorrectStrategy) ? data.matchCorrectStrategy : validStrats[0] || 'counting-on';

  return {
    title: data.title || 'Many Ways to Solve!',
    description: data.description || 'Solve the same problem using different strategies.',
    gradeBand: validGradeBand as 'K' | '1',
    maxNumber,
    operations: validOps.length > 0 ? validOps : ['addition'],
    strategiesIntroduced: validStrats.length > 0 ? validStrats : ['counting-on', 'tally-marks'],
    problems,
    guidedStrategy: guided,
    tryAnotherStrategy: tryAnother,
    matchCorrectStrategy: matchCorrect,
  };
}

// ============================================================================
// Per-Challenge Generators
// ============================================================================

function problemStr(p: { operand1: number; operand2: number; operation: string }): string {
  return p.operation === 'subtraction'
    ? `${p.operand1} - ${p.operand2}`
    : `${p.operand1} + ${p.operand2}`;
}

function problemResult(p: { operand1: number; operand2: number; operation: string }): number {
  return p.operation === 'subtraction' ? p.operand1 - p.operand2 : p.operand1 + p.operand2;
}

const STRATEGY_LABELS: Record<string, string> = {
  'counting-on': 'counting on (start from the bigger number and count up)',
  'counting-back': 'counting back (start from the bigger number and count down)',
  'make-ten': 'make-ten (decompose a number to fill a ten frame)',
  'doubles': 'doubles (use a known doubles fact)',
  'near-doubles': 'near-doubles (use a doubles fact and add 1)',
  'tally-marks': 'tally marks (draw tally marks for each number, then count all)',
  'draw-objects': 'drawing objects (draw circles for each number, then count all)',
};

async function generateGuided(
  setup: SetupResult,
  gradeLevel: string,
) {
  const p = setup.problems[0];
  const strat = setup.guidedStrategy;
  const prompt = `
Create a guided-strategy challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
Strategy: ${strat} — ${STRATEGY_LABELS[strat] || strat}

Write a warm instruction telling the student to solve using ${strat}.
Write 2-4 step-by-step scaffold steps that guide the process WITHOUT revealing the answer.
BAD: "Count 3 more: 4, 5. The answer is 5!"
GOOD: "Start at the bigger number. Now count up the smaller number. What number did you land on?"
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: guidedSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackGuided(setup);

  if (!data.instruction || !Array.isArray(data.strategySteps) || data.strategySteps.length === 0) {
    return fallbackGuided(setup);
  }

  return data as { instruction: string; strategySteps: string[] };
}

async function generateTryAnotherChallenge(
  setup: SetupResult,
  gradeLevel: string,
) {
  const p = setup.problems[0];
  const strat = setup.tryAnotherStrategy;
  const prompt = `
Create a try-another challenge for ${gradeLevel} students.
The student already solved ${problemStr(p)} using ${setup.guidedStrategy}.
Now they solve the SAME problem using: ${strat} — ${STRATEGY_LABELS[strat] || strat}

Write an encouraging instruction like "Great job! Now let's try a different way."
Write 2-4 scaffold steps for ${strat} WITHOUT revealing the answer.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: tryAnotherSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackTryAnother(setup);

  if (!data.instruction || !Array.isArray(data.strategySteps) || data.strategySteps.length === 0) {
    return fallbackTryAnother(setup);
  }

  return data as { instruction: string; strategySteps: string[] };
}

async function generateCompareChallenge(
  setup: SetupResult,
  gradeLevel: string,
) {
  const s1 = setup.guidedStrategy;
  const s2 = setup.tryAnotherStrategy;
  const prompt = `
Create a compare challenge for ${gradeLevel} students.
They solved ${problemStr(setup.problems[0])} two ways: using ${s1} and ${s2}.
Both gave the same answer. Now ask a reflective question — there's no wrong answer.
Example questions: "Which strategy felt easier?", "Which way was faster for you?"
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: compareSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackCompare(setup);

  return data as { instruction: string; comparisonQuestion: string };
}

async function generateChooseChallenge(
  setup: SetupResult,
  gradeLevel: string,
) {
  const p = setup.problems[1];
  const prompt = `
Create a choose-your-strategy challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
The student picks their own strategy from a menu, then solves.
Write an encouraging instruction like "Pick any strategy you like to solve this!"
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: chooseSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.instruction) {
    return { instruction: 'Pick any strategy you like to solve this problem!' };
  }

  return data as { instruction: string };
}

async function generateMatchChallenge(
  setup: SetupResult,
  gradeLevel: string,
) {
  const p = setup.problems[2];
  const strat = setup.matchCorrectStrategy;
  const prompt = `
Create a match-strategy challenge for ${gradeLevel} students.
Problem: ${problemStr(p)} = ?
The worked solution uses: ${strat} — ${STRATEGY_LABELS[strat] || strat}

Write a 2-3 sentence workedSolution describing how someone solved it using ${strat}.
Do NOT name the strategy in the text — the student must figure it out.
Example: "I started at 6 and counted up 3 hops on the number line: 7, 8, 9." (This is counting-on but doesn't say so.)

Provide 3 strategyOptions (strategy IDs) as multiple-choice answers, one of which is "${strat}".
Available strategies: ${setup.strategiesIntroduced.join(', ')}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: matchSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) return fallbackMatch(setup);

  // Ensure correctStrategy is in strategyOptions
  if (!Array.isArray(data.strategyOptions) || data.strategyOptions.length < 2) {
    return fallbackMatch(setup);
  }
  if (!data.strategyOptions.includes(strat)) {
    data.strategyOptions[data.strategyOptions.length - 1] = strat;
  }

  return data as { instruction: string; workedSolution: string; strategyOptions: string[] };
}

// ============================================================================
// Fallbacks
// ============================================================================

function fallbackGuided(setup: SetupResult) {
  const p = setup.problems[0];
  return {
    instruction: `Let's solve ${problemStr(p)} by ${setup.guidedStrategy.replace('-', ' ')}! Follow the steps below.`,
    strategySteps: [
      'Look at the two numbers in the problem.',
      `Use the ${setup.guidedStrategy.replace('-', ' ')} strategy to work it out.`,
      'What answer did you get?',
    ],
  };
}

function fallbackTryAnother(setup: SetupResult) {
  const p = setup.problems[0];
  return {
    instruction: `Great job! Now solve ${problemStr(p)} a different way — using ${setup.tryAnotherStrategy.replace('-', ' ')}!`,
    strategySteps: [
      `This time, use ${setup.tryAnotherStrategy.replace('-', ' ')}.`,
      'Follow the visual to help you.',
      'Did you get the same answer as before?',
    ],
  };
}

function fallbackCompare(setup: SetupResult) {
  return {
    instruction: `You solved it two ways! Let's compare ${setup.guidedStrategy.replace('-', ' ')} and ${setup.tryAnotherStrategy.replace('-', ' ')}.`,
    comparisonQuestion: 'Which strategy felt easier for you?',
  };
}

function fallbackMatch(setup: SetupResult) {
  const p = setup.problems[2];
  const result = problemResult(p);
  const strat = setup.matchCorrectStrategy;

  // Generate a generic worked solution
  const workedSolutions: Record<string, string> = {
    'counting-on': `I started at ${p.operand1} and counted up ${p.operand2} more on my fingers. I landed on ${result}.`,
    'counting-back': `I started at ${p.operand1} and counted back ${p.operand2}. I landed on ${result}.`,
    'make-ten': `I split ${p.operand2} to fill up to 10 first, then added the rest to get ${result}.`,
    'doubles': `I noticed both numbers are the same! I used my doubles fact to get ${result}.`,
    'near-doubles': `I used a doubles fact I know, then added 1 more to get ${result}.`,
    'tally-marks': `I drew ${p.operand1} tally marks, then ${p.operand2} more. I counted them all and got ${result}.`,
    'draw-objects': `I drew ${p.operand1} circles, then ${p.operand2} more. I counted them all and got ${result}.`,
  };

  const options = [strat];
  for (const s of setup.strategiesIntroduced) {
    if (s !== strat && options.length < 3) options.push(s);
  }
  while (options.length < 3) {
    const filler = VALID_STRATEGIES.find(s => !options.includes(s));
    if (filler) options.push(filler); else break;
  }

  return {
    instruction: 'Someone already solved this problem. Which strategy did they use?',
    workedSolution: workedSolutions[strat] || `I used a strategy to solve ${problemStr(p)} and got ${result}.`,
    strategyOptions: options,
  };
}

// ============================================================================
// Main Generator (public API)
// ============================================================================

/**
 * Generate strategy picker data using parallel LLM calls.
 *
 * Architecture:
 *   1. Lightweight "setup" call → title, problems, strategy pairings
 *   2. Five parallel calls (one per challenge type) with tiny focused schemas
 *   3. Recombine into StrategyPickerData
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
  }>
): Promise<StrategyPickerData> => {
  // Step 1: Setup call
  const setup = await generateSetup(topic, gradeLevel, config);

  // Step 2: Five parallel challenge calls
  const [guided, tryAnother, compare, choose, match] = await Promise.all([
    generateGuided(setup, gradeLevel),
    generateTryAnotherChallenge(setup, gradeLevel),
    generateCompareChallenge(setup, gradeLevel),
    generateChooseChallenge(setup, gradeLevel),
    generateMatchChallenge(setup, gradeLevel),
  ]);

  // Step 3: Build problem objects
  const buildProblem = (p: { operand1: number; operand2: number; operation: string }) => ({
    equation: problemStr(p),
    operation: p.operation as 'addition' | 'subtraction',
    operand1: p.operand1,
    operand2: p.operand2,
    result: problemResult(p),
  });

  const p0 = buildProblem(setup.problems[0]);
  const p1 = buildProblem(setup.problems[1]);
  const p2 = buildProblem(setup.problems[2]);

  // Step 4: Assemble challenges
  const challenges: StrategyPickerChallenge[] = [
    {
      id: 'ch1',
      type: 'guided-strategy',
      instruction: guided.instruction,
      problem: p0,
      assignedStrategy: setup.guidedStrategy,
      strategySteps: guided.strategySteps,
    },
    {
      id: 'ch2',
      type: 'try-another',
      instruction: tryAnother.instruction,
      problem: p0, // same problem
      assignedStrategy: setup.tryAnotherStrategy,
      strategySteps: tryAnother.strategySteps,
    },
    {
      id: 'ch3',
      type: 'compare',
      instruction: compare.instruction,
      problem: p0, // same problem
      strategies: [setup.guidedStrategy, setup.tryAnotherStrategy],
      comparisonQuestion: compare.comparisonQuestion,
    },
    {
      id: 'ch4',
      type: 'choose-your-strategy',
      instruction: choose.instruction,
      problem: p1,
      availableStrategies: setup.strategiesIntroduced,
    },
    {
      id: 'ch5',
      type: 'match-strategy',
      instruction: match.instruction,
      problem: p2,
      workedSolution: match.workedSolution,
      strategyOptions: match.strategyOptions,
      correctStrategy: setup.matchCorrectStrategy,
    },
  ];

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
