import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type {
  AdditionFactStrategiesData,
  AdditionFactChallenge,
  AdditionFactStrategy,
} from "../../primitives/visual-primitives/math/AdditionFactStrategies";
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  type ChallengeTypeDoc,
} from "../evalMode";
import { resolveObjectiveNumberWindow } from "../objectiveNumberWindow";

/**
 * Addition Fact Strategies generator (pool service).
 *
 * Gemini authors ONLY the wrapper (title, description, strategy, objectEmoji).
 * Every fact is chosen in code from the strategy's pool, so the answer key never
 * depends on the model and sessions vary run to run.
 */

// ---------------------------------------------------------------------------
// Strategy pools
// ---------------------------------------------------------------------------

export {
  ADDITION_FACT_STRATEGIES, MAX_FACT_SUM, strategyPool, strategiesWithin,
} from "../../primitives/visual-primitives/math/additionFactPools";
import {
  ADDITION_FACT_STRATEGIES, MAX_FACT_SUM, strategyPool, strategiesWithin, type Pair,
} from "../../primitives/visual-primitives/math/additionFactPools";

const pairKey = (a: number, b: number) => (a <= b ? `${a}|${b}` : `${b}|${a}`);

/** Grouping used to stop a session from collapsing onto one shape. */
function groupOf(strategy: AdditionFactStrategy, [a, b]: Pair): string | null {
  const special = strategy === 'plus_zero' ? 0 : strategy === 'plus_one' ? 1 : strategy === 'plus_two' ? 2 : null;
  if (special !== null) return a === special ? 'special-first' : 'special-second';
  if (strategy === 'facts_mixed') {
    const lo = Math.min(a, b);
    return lo <= 4 ? 'band-3-4' : lo <= 6 ? 'band-5-6' : 'band-7-8';
  }
  return null;
}

/** Minimum facts per group so plus_* mix both orders and facts_mixed spans every band. */
function minPerGroup(strategy: AdditionFactStrategy): number {
  if (strategy === 'facts_mixed') return 1;
  if (strategy === 'plus_zero' || strategy === 'plus_one' || strategy === 'plus_two') return 2;
  return 0;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const hasAdjacentPair = (facts: Pair[]) =>
  facts.some((f, i) => i > 0 && pairKey(f[0], f[1]) === pairKey(facts[i - 1][0], facts[i - 1][1]));

/** Order the facts so no two neighbours share an unordered pair. */
function arrange(facts: Pair[], rng: () => number): Pair[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = shuffle(facts, rng);
    if (!hasAdjacentPair(order)) return order;
  }
  // Greedy fallback: always place from the pair with the most facts left.
  const remaining = shuffle(facts, rng);
  const out: Pair[] = [];
  while (remaining.length) {
    const last = out.length ? pairKey(out[out.length - 1][0], out[out.length - 1][1]) : null;
    const counts = new Map<string, number>();
    remaining.forEach(([a, b]) => counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) ?? 0) + 1));
    let best = -1;
    remaining.forEach(([a, b], i) => {
      const k = pairKey(a, b);
      if (k === last) return;
      if (best < 0 || (counts.get(k) ?? 0) > (counts.get(pairKey(...remaining[best])) ?? 0)) best = i;
    });
    if (best < 0) best = 0;
    out.push(remaining.splice(best, 1)[0]);
  }
  return out;
}

export function sessionCount(strategy: AdditionFactStrategy, maxSum = MAX_FACT_SUM): number {
  const target = strategy === 'facts_mixed' ? 10 : 8;
  return Math.min(target, strategyPool(strategy, maxSum).length);
}

export interface AdditionFactSession {
  challenges: AdditionFactChallenge[];
  introExample?: { a: number; b: number };
}

/** Pure, Gemini-free session builder. */
export function buildAdditionFactSession(
  strategy: AdditionFactStrategy,
  rng: () => number = Math.random,
  maxSum = MAX_FACT_SUM,
): AdditionFactSession {
  const pool = strategyPool(strategy, maxSum);
  const count = sessionCount(strategy, maxSum);
  const isTurnaround = strategy === 'turnaround';

  const picked: Pair[] = [];
  const seen = new Set<string>();
  const tryAdd = ([a, b]: Pair): boolean => {
    const key = isTurnaround ? pairKey(a, b) : `${a}+${b}`;
    if (seen.has(key)) return false;
    seen.add(key);
    picked.push([a, b]);
    return true;
  };

  // 1. Seed the minimum from each group (variance guard).
  const minEach = minPerGroup(strategy);
  if (minEach > 0) {
    const groups = new Map<string, Pair[]>();
    pool.forEach((f) => {
      const g = groupOf(strategy, f);
      if (g) groups.set(g, [...(groups.get(g) ?? []), f]);
    });
    shuffle(Array.from(groups.keys()), rng).forEach((g) => {
      let added = 0;
      for (const f of shuffle(groups.get(g)!, rng)) {
        if (added >= minEach || picked.length >= count) break;
        if (tryAdd(f)) added++;
      }
    });
  }

  // 2. Fill the rest at random.
  for (const f of shuffle(pool, rng)) {
    if (picked.length >= count) break;
    tryAdd(f);
  }

  // 3. Orient turnaround facts at random.
  const oriented: Pair[] = isTurnaround
    ? picked.map(([a, b]) => (rng() < 0.5 ? [a, b] : [b, a]) as Pair)
    : picked;

  const ordered = arrange(oriented, rng);
  const challenges: AdditionFactChallenge[] = ordered.map(([a, b], i) => ({
    id: `afs-${i + 1}`,
    type: strategy,
    a,
    b,
    sum: a + b,
    ...(isTurnaround ? { knownFact: { a: b, b: a } } : {}),
  }));

  // 4. Intro example: a fact from the pool whose pair is NOT asked this session.
  let introExample: { a: number; b: number } | undefined;
  const introStrategies: AdditionFactStrategy[] = ['plus_zero', 'plus_one', 'doubles', 'turnaround', 'plus_two'];
  if (introStrategies.includes(strategy)) {
    const asked = new Set(challenges.map((c) => pairKey(c.a, c.b)));
    const candidate = shuffle(pool, rng).find(
      ([a, b]) => !asked.has(pairKey(a, b)) && (!isTurnaround || a !== b),
    );
    if (candidate) introExample = { a: candidate[0], b: candidate[1] };
  }

  return { challenges, ...(introExample ? { introExample } : {}) };
}

// ---------------------------------------------------------------------------
// Wrapper (Gemini) + fallbacks
// ---------------------------------------------------------------------------

const DEFAULT_EMOJI: Record<AdditionFactStrategy, string> = {
  plus_zero: '🐸', plus_one: '🐞', doubles: '🌸', turnaround: '🌰', plus_two: '🥕',
  facts_3_4: '🫐', facts_5_6: '🍪', facts_7_8: '💎', facts_mixed: '⭐',
};

const DEFAULT_WRAPPER: Record<AdditionFactStrategy, { title: string; description: string }> = {
  plus_zero: { title: 'Adding Zero', description: 'Find out what happens when you add zero to a number.' },
  plus_one: { title: 'One More', description: 'Adding one gives you the next counting number.' },
  doubles: { title: 'Double Trouble', description: 'Practise adding a number to itself.' },
  turnaround: { title: 'Turn-Around Facts', description: 'Switching the order of the numbers gives the same total.' },
  plus_two: { title: 'Two More', description: 'Adding two means counting on two from the bigger number.' },
  facts_3_4: { title: 'Facts with Threes and Fours', description: 'Practise addition facts that start with three and four.' },
  facts_5_6: { title: 'Facts with Fives and Sixes', description: 'Practise addition facts with five and six.' },
  facts_7_8: { title: 'Facts with Big Numbers', description: 'Practise the addition facts with seven, eight, and nine.' },
  facts_mixed: { title: 'Addition Fact Mix', description: 'Practise a mix of addition facts within twenty.' },
};

const asStrategy = (v: unknown): AdditionFactStrategy | null =>
  typeof v === 'string' && (ADDITION_FACT_STRATEGIES as readonly string[]).includes(v)
    ? (v as AdditionFactStrategy)
    : null;

// RegExp constructor: the tsconfig targets es5, which rejects a /u literal.
const PICTOGRAPHIC = new RegExp('\\p{Extended_Pictographic}', 'u');

export function isValidObjectEmoji(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return s.length > 0 && s.length <= 8 && !/[A-Za-z0-9]/.test(s) && PICTOGRAPHIC.test(s);
}

const leaksFact = (s: string) => s.includes('=') || /\d\s*\+\s*\d/.test(s);

export function resolveGradeBand(gradeLevel: string): '1' | '2' {
  const g = (gradeLevel || '').toLowerCase();
  const m = g.match(/grade\s*(\d+)/) ?? g.match(/(\d+)\s*(?:st|nd|rd|th)?\s*grade/);
  if (m && parseInt(m[1], 10) >= 2) return '2';
  if (/\b(second|third|fourth|fifth|sixth)\b/.test(g)) return '2';
  return '1';
}

// Eval modes constrain the root `strategy` enum (catalog `challengeTypes` are strategy keys).
// One strategy per session, as in the source game, so a blend narrows the choice rather than mixing.
const STRATEGY_DOCS: Record<AdditionFactStrategy, ChallengeTypeDoc> = {
  plus_zero: { promptDoc: '"plus_zero": +0 facts, adding zero (n + 0, 0 + n).', schemaDescription: "'plus_zero' (+0 facts)" },
  plus_one: { promptDoc: '"plus_one": +1 facts, one more, the next number.', schemaDescription: "'plus_one' (+1 facts)" },
  doubles: { promptDoc: '"doubles": doubles 1 + 1 to 9 + 9.', schemaDescription: "'doubles' (doubles)" },
  turnaround: { promptDoc: '"turnaround": turn-around facts, commutative property, order of addends.', schemaDescription: "'turnaround' (turn-around facts)" },
  plus_two: { promptDoc: '"plus_two": +2 facts, two more, counting on two.', schemaDescription: "'plus_two' (+2 facts)" },
  facts_3_4: { promptDoc: '"facts_3_4": big facts with 3s and 4s.', schemaDescription: "'facts_3_4' (3s and 4s)" },
  facts_5_6: { promptDoc: '"facts_5_6": big facts with 5s and 6s.', schemaDescription: "'facts_5_6' (5s and 6s)" },
  facts_7_8: { promptDoc: '"facts_7_8": big facts with 7s, 8s and 9s.', schemaDescription: "'facts_7_8' (7s and 8s)" },
  facts_mixed: { promptDoc: '"facts_mixed": general addition within 20, fluency, or mixed big facts.', schemaDescription: "'facts_mixed' (mixed big facts)" },
};

const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Kid-friendly session title. Must NOT name any specific addition fact or sum.' },
    description: { type: Type.STRING, description: 'One sentence describing the practice. No specific facts or sums.' },
    strategy: {
      type: Type.STRING,
      enum: [...ADDITION_FACT_STRATEGIES],
      description: 'The addition fact strategy this session practises.',
    },
    objectEmoji: { type: Type.STRING, description: 'ONE emoji matching the topic, used as the counting object.' },
  },
  required: ['title', 'description', 'strategy', 'objectEmoji'],
};

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

export async function generateAdditionFactStrategies(
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    /** Exact fact family; wins over the eval mode (e.g. a lesson on the 7s and 8s). */
    strategy?: string;
    /** Eval mode pinned by the tester/curator. Wins over intent resolution, no LLM call. */
    targetEvalMode?: string;
    /** Parent objective text — secondary routing signal. */
    objectiveText?: string;
    /** Where the levers start (easy: the objects to count on screen). Never changes the facts. */
    difficulty?: string;
    [key: string]: unknown;
  },
): Promise<AdditionFactStrategiesData> {
  const supportTier = normalizeSupportTier(config?.difficulty);
  const resolution = await resolveEvalModes(
    'addition-fact-strategies',
    { targetEvalMode: config?.targetEvalMode, intent: config?.intent, objectiveText: config?.objectiveText },
    STRATEGY_DOCS,
  );
  const modeStrategies = (resolution?.allowedTypes ?? ADDITION_FACT_STRATEGIES).filter(
    (t): t is AdditionFactStrategy => asStrategy(t) !== null,
  );
  // The lesson's own sum window ("facts with sums up to 10"). General practice → null → all sums.
  const window = await resolveObjectiveNumberWindow({
    topic,
    intent: config?.intent,
    objectiveText: config?.objectiveText,
    gradeLevel: gradeLevel || 'Grade 1',
    bandDefault: MAX_FACT_SUM,
    ceiling: MAX_FACT_SUM,
    logPrefix: 'AdditionFactStrategies',
  });
  const explicit = asStrategy(config?.strategy);
  const fillable = window === null ? modeStrategies : strategiesWithin(explicit ? [explicit] : modeStrategies, window);
  // An explicit family or a mode with nothing under the window keeps its full sums: the pin wins.
  const maxSum = window !== null && fillable.length > 0 ? window : MAX_FACT_SUM;
  if (window !== null && maxSum !== window) {
    console.warn(`[AdditionFactStrategies] sum window ${window} leaves no family in [${(explicit ? [explicit] : modeStrategies).join(', ')}]; keeping full sums.`);
  }
  const allowed = maxSum === MAX_FACT_SUM ? modeStrategies : strategiesWithin(modeStrategies, maxSum);
  // A mode with one family needs no choice; a band mode or blend lets the topic pick within it.
  const pinned = explicit ?? (allowed.length === 1 ? allowed[0] : null);
  console.log(
    `[AdditionFactStrategies] modes: ${resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} → strategies [${allowed.join(', ')}]${pinned ? ` → ${pinned}` : ''}${maxSum < MAX_FACT_SUM ? ` (sums ≤ ${maxSum})` : ''}`,
  );
  const activeSchema = resolution || maxSum < MAX_FACT_SUM
    ? constrainChallengeTypeEnum(wrapperSchema, pinned ? [pinned] : allowed, STRATEGY_DOCS, { fieldName: 'strategy', rootLevel: true })
    : wrapperSchema;

  const prompt = `
Create the wrapper for an addition fact practice session for ${gradeLevel || 'grade 1'} students.

Topic: ${topic}
${config?.intent ? `Lesson intent: ${config.intent}` : ''}
${maxSum < MAX_FACT_SUM ? `Every fact in this lesson has a sum of ${maxSum} or less.` : ''}
${pinned ? `The strategy is fixed: "${pinned}". Return exactly that value for strategy.` : `Choose the ONE strategy that best matches the topic and intent:
${allowed.map((t) => `- ${STRATEGY_DOCS[t].promptDoc}`).join('\n')}${allowed.includes('facts_mixed') ? '\nIf the topic names no band, choose facts_mixed.' : ''}`}

Rules:
1. title: short and kid-friendly. NEVER write a specific fact, sum, "+" or "=" (no "3 + 4").
2. description: one sentence, no specific facts or sums.
3. objectEmoji: exactly ONE emoji that matches the topic (e.g. 🍎 for an apple-themed lesson).
`;

  let wrapper: Record<string, unknown> | null = null;
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        temperature: 0.9,
        topP: 0.95,
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
      },
    });
    wrapper = result.text ? JSON.parse(result.text) : null;
  } catch (err) {
    console.warn('[AdditionFactStrategies] Gemini wrapper failed; using code wrapper.', err);
  }

  const chosen = asStrategy(wrapper?.strategy);
  const strategy: AdditionFactStrategy =
    pinned ??
    (chosen && allowed.includes(chosen) ? chosen : null) ??
    (allowed.includes('facts_mixed') ? 'facts_mixed' : allowed[0]);
  const fallback = DEFAULT_WRAPPER[strategy];

  let title = typeof wrapper?.title === 'string' ? wrapper.title.trim() : '';
  let description = typeof wrapper?.description === 'string' ? wrapper.description.trim() : '';
  if (!title || leaksFact(title)) {
    if (title) console.warn(`[AdditionFactStrategies] title leaks a fact ("${title}"); replaced.`);
    title = fallback.title;
  }
  if (!description || leaksFact(description)) {
    if (description) console.warn(`[AdditionFactStrategies] description leaks a fact ("${description}"); replaced.`);
    description = fallback.description;
  }

  let objectEmoji = typeof wrapper?.objectEmoji === 'string' ? wrapper.objectEmoji.trim() : '';
  if (!isValidObjectEmoji(objectEmoji)) {
    console.warn(`[AdditionFactStrategies] invalid objectEmoji "${objectEmoji}"; using default.`);
    objectEmoji = DEFAULT_EMOJI[strategy];
  }

  const session = buildAdditionFactSession(strategy, Math.random, maxSum);
  const challenges = session.challenges.filter(
    (c) =>
      Number.isInteger(c.a) && Number.isInteger(c.b) &&
      c.a >= 0 && c.a <= 9 && c.b >= 0 && c.b <= 9 &&
      c.sum === c.a + c.b && c.sum <= maxSum,
  );
  if (challenges.length !== session.challenges.length) {
    console.warn(`[AdditionFactStrategies] rejected ${session.challenges.length - challenges.length} invalid challenge(s).`);
  }

  return {
    title,
    description,
    challengeType: 'recall',
    strategy,
    objectEmoji,
    ...(session.introExample ? { introExample: session.introExample } : {}),
    challenges,
    gradeBand: resolveGradeBand(gradeLevel),
    ...(supportTier ? { supportTier } : {}),
  };
}
