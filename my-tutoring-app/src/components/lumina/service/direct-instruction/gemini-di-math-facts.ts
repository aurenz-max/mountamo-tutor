/**
 * gemini-di-math-facts — pool-scoped generator for the di-math-facts
 * primitive. Fork A (pool service): the item CONTENT is a code-owned addition
 * fact pool scoped to the objective — per-challenge data is value-only
 * (operands, sums, number words), and structured-output Gemini is convergent
 * on values, so Gemini NEVER emits per-challenge facts. Gemini's only job is
 * the session wrapper (kid title + description) and a factScope hint used
 * ONLY when the objective text is too generic for the code regexes to pin a
 * scope. Operands, display, spoken problem, answer word/numeral, and ASR
 * aliases are all derived deterministically in code.
 *
 * SCOPE: the objective text is code-enforced over the model's pick (the
 * census lesson — the prompt asks, the code guarantees). Named facts
 * ("3 + 2", "three plus two") win outright; then make-ten / doubles /
 * within-N patterns; then the model's factScope; then a grade default
 * (K → within 5, else within 10).
 *
 * VARIANCE: a session never drills one answer by accident — the first
 * selection pass keeps at most ONE fact per distinct sum until the count is
 * met, zero-operand facts (a=0 or b=0) are capped at one per session, and
 * commuted duplicates (2+3 vs 3+2) are deduped by canonical key. make-ten
 * sessions are the sanctioned exception: every answer IS ten, so the
 * back-fill pass supplies the rest.
 *
 * EVAL MODES (L0) — ONE task identity at birth: `answer_fact`. Ladder
 * candidates (counting_next / fact_review / subtraction_fact) are queued on
 * the birth certificate for /add-eval-modes — not built now. The
 * resolveEvalModes call is wired so the eventual ladder drops in without
 * reshaping this generator; today every resolution lands on answer_fact.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type { DiMathFactsData } from "../../primitives/visual-primitives/direct-instruction/DiMathFacts";
import type {
  DiMathFactsChallenge,
  DiMathFactsChallengeType,
} from "../../primitives/visual-primitives/direct-instruction/diMathFactsScript";

// ── Number words + ASR aliases (code-owned) ─────────────────────────

/** Number words 0..20 — the full sum range this pack can ever speak. */
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

// ── Fact pool builder (deterministic, in code) ──────────────────────

/** Enumerate the scoped pool. Named scopes never reach here. */
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
  for (let a = 0; a <= scope.maxSum; a++) {
    for (let b = 0; b <= scope.maxSum - a; b++) {
      if (a + b >= 1) pool.push({ a, b });
    }
  }
  return pool;
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

/** Canonical key — commuted duplicates (2+3 / 3+2) collapse to one fact. */
const factKey = (p: FactPair): string =>
  p.a <= p.b ? `${p.a}+${p.b}` : `${p.b}+${p.a}`;

/**
 * Variance-enforced selection: seed facts (explicitly named by the objective)
 * are taken first and bypass the variance caps; then a first pass keeps at
 * most ONE fact per distinct sum until the count is met; then a back-fill
 * pass completes the session. Zero-operand facts are capped at one, and
 * everything dedupes on the canonical key.
 */
const selectVaried = (pool: FactPair[], count: number, seed: FactPair[] = []): FactPair[] => {
  const out: FactPair[] = [];
  const keys = new Set<string>();
  const sums = new Set<number>();
  let zeros = 0;
  const take = (p: FactPair) => {
    keys.add(factKey(p));
    sums.add(p.a + p.b);
    if (p.a === 0 || p.b === 0) zeros += 1;
    out.push(p);
  };
  for (const p of seed) {
    if (out.length >= count) break;
    if (keys.has(factKey(p))) continue;
    take(p); // the objective asked for this exact fact — it always ships
  }
  // Pass 1: distinct answers only.
  for (const p of pool) {
    if (out.length >= count) break;
    if (keys.has(factKey(p))) continue;
    if ((p.a === 0 || p.b === 0) && zeros >= 1) continue;
    if (sums.has(p.a + p.b)) continue;
    take(p);
  }
  // Pass 2: back-fill (repeat sums allowed — the make-ten case lives here).
  for (const p of pool) {
    if (out.length >= count) break;
    if (keys.has(factKey(p))) continue;
    if ((p.a === 0 || p.b === 0) && zeros >= 1) continue;
    take(p);
  }
  return out;
};

const DEFAULT_INSTANCE_COUNT = 5;
const MAX_INSTANCE_COUNT = 6;
/** Guaranteed-runnable easy spread — the never-empty final fallback. */
const EASY_SPREAD: FactPair[] = [
  { a: 1, b: 1 }, { a: 2, b: 1 }, { a: 2, b: 2 }, { a: 3, b: 1 }, { a: 3, b: 2 },
];

// ── Challenge builder (all fields derived — never from the LLM) ─────

const buildChallenge = (
  pair: FactPair,
  index: number,
  type: DiMathFactsChallengeType,
): DiMathFactsChallenge => {
  const sum = pair.a + pair.b;
  return {
    id: `dimf-${index + 1}-${pair.a}p${pair.b}`,
    challengeType: type,
    a: pair.a,
    b: pair.b,
    display: `${pair.a} + ${pair.b}`,
    problem: `${NUMBER_WORDS[pair.a]} plus ${NUMBER_WORDS[pair.b]}`,
    answerWord: NUMBER_WORDS[sum],
    answerNumeral: sum,
    asrAliases: aliasesFor(sum),
  };
};

// ── Gemini wrapper (title/description/scope hint ONLY — Fork A) ─────

/** Skill docs for the intent→mode router (Fork A — no schema to constrain).
 *  One identity at birth; /add-eval-modes widens this record later. */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  answer_fact: {
    promptDoc:
      `"answer_fact": the child sees ONE printed addition fact ("2 + 1") and speaks the answer number word ("three"). The base skill.`,
    schemaDescription: "'answer_fact' (say the answer to the printed fact)",
  },
};

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
        "Your read of the objective's addition-fact scope: sums within 5, sums within 10, " +
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
    [key: string]: unknown;
  },
): Promise<DiMathFactsData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // The objective's fact scope, resolved from ALL the text we have and
  // code-enforced below (topic/objective beats whatever the model picks).
  const scopeText = `${intent ?? ''} ${config?.objectiveText ?? ''} ${topic}`;
  const textScope = resolveTextScope(scopeText);

  const prompt = `Scope a brisk Direct Instruction math-facts practice (printed addition facts, spoken answers) for a young learner.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

RULES:
- Read the objective and pick the factScope that matches it: 'within_5' (sums to five), 'within_10' (sums to ten), 'make_10' (pairs that make ten), or 'doubles' (a number plus itself). A generic objective for a kindergartner means 'within_5'; otherwise 'within_10'.
- Write a warm, short kid title and a one-sentence description. They MUST NOT contain any digits or number words — the child must produce the answers, never hear or see them first.

Return the wrapper JSON only.`;

  // Resolve which eval-mode SKILL this objective calls for. One identity at
  // birth — every resolution lands on answer_fact; the call is wired so the
  // /add-eval-modes ladder drops in without reshaping this generator.
  const resolution = await resolveEvalModes(
    'di-math-facts',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeType: DiMathFactsChallengeType =
    (resolution?.allowedTypes?.[0] as DiMathFactsChallengeType | undefined) ?? 'answer_fact';

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
          "You classify the objective's addition-fact scope and write a warm kid-facing title and " +
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

  // Build the session facts — deterministic pool, variance-enforced pick.
  let pairs: FactPair[];
  if (scope.kind === 'named') {
    // Named facts win outright; back-fill from the grade-default pool if the
    // objective named fewer than a full session.
    pairs = selectVaried(shuffle(buildPool(gradeDefaultScope(gradeLevel))), count, scope.facts);
  } else {
    pairs = selectVaried(shuffle(buildPool(scope)), count);
  }

  // Guarantee a runnable session even if every scope filter emptied out.
  if (pairs.length === 0) pairs = EASY_SPREAD.slice(0, count);

  const challenges = pairs.map((pair, i) => buildChallenge(pair, i, modeType));

  const data: DiMathFactsData = {
    title,
    description,
    challengeType: challenges[0]?.challengeType ?? 'answer_fact',
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
  };

  console.log("DI Math Facts Generated:", {
    title: data.title,
    mode: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'answer_fact',
    scope: scope.kind === 'named'
      ? `named(${scope.facts.length}) [${scopeSource}]`
      : scope.kind === 'within'
        ? `within ${scope.maxSum} [${scopeSource}]`
        : `${scope.kind} [${scopeSource}]`,
    facts: challenges.map((c) => `${c.a}+${c.b}=${c.answerNumeral}`),
    count: challenges.length,
  });

  return data;
};
