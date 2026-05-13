import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

/**
 * Factor Tree Data Interface
 *
 * Multi-instance schema: a single session walks the student through 3-6 factor trees
 * of the same eval mode, surfaced sequentially. The rootValues are pre-selected by
 * the local pool service (NOT by Gemini) — Gemini structured output converges to the
 * same number every call regardless of temperature, so it cannot deliver variance.
 *
 * Gemini contributes only the wrapper metadata (title, description, mode flags).
 */
export interface FactorTreeChallenge {
  id: string;
  rootValue: number;
}

export interface FactorTreeData {
  title: string;
  description: string;
  /** 3-6 challenges. Required. */
  challenges: FactorTreeChallenge[];
  /** Session-level defaults; applied to every challenge. */
  highlightPrimes?: boolean;
  showExponentForm?: boolean;
  guidedMode?: boolean;
  allowReset?: boolean;
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  guided_small: {
    promptDoc:
      `"guided_small": Small composite numbers (4-24) with 2-3 prime factors. `
      + `guidedMode=true, allowReset=true, highlightPrimes=true, showExponentForm=true. `
      + `Focus on introducing the concept of factor trees and recognizing primes vs composites.`,
    schemaDescription: "'guided_small' (small composites with hints)",
  },
  guided_medium: {
    promptDoc:
      `"guided_medium": Medium composite numbers (24-60) with 3-4 prime factors. `
      + `guidedMode=true, allowReset=true, highlightPrimes=true, showExponentForm=true. `
      + `Students build fluency with support. Emphasize exponential form (e.g., 2^3 × 3).`,
    schemaDescription: "'guided_medium' (medium composites with hints)",
  },
  unguided: {
    promptDoc:
      `"unguided": Medium composite numbers (20-60) without factor pair hints. `
      + `guidedMode=false, allowReset=true, highlightPrimes=true, showExponentForm=true. `
      + `Student must find factor pairs independently. Tests divisibility rule knowledge.`,
    schemaDescription: "'unguided' (medium composites, no hints)",
  },
  unguided_large: {
    promptDoc:
      `"unguided_large": Larger composite numbers (40-80) without hints, reset allowed. `
      + `guidedMode=false, allowReset=true, highlightPrimes=true, showExponentForm=true. `
      + `Step up from unguided: bigger numbers with more prime factors to track.`,
    schemaDescription: "'unguided_large' (larger composites, no hints, reset allowed)",
  },
  assessment_intro: {
    promptDoc:
      `"assessment_intro": Medium-large composite numbers (40-80) with no hints and no reset. `
      + `guidedMode=false, allowReset=false, highlightPrimes=true, showExponentForm=true. `
      + `Practice the no-retry format with moderate numbers before full assessment.`,
    schemaDescription: "'assessment_intro' (medium-large composites, no hints, no reset)",
  },
  assessment: {
    promptDoc:
      `"assessment": Larger composite numbers (40-100) with no hints and no reset. `
      + `guidedMode=false, allowReset=false, highlightPrimes=true, showExponentForm=true. `
      + `Formal assessment — student must complete factorization independently on first attempt.`,
    schemaDescription: "'assessment' (large composites, no hints, no reset)",
  },
};

// ---------------------------------------------------------------------------
// Pre-selected candidate pools (per eval mode)
// ---------------------------------------------------------------------------

const CANDIDATE_POOLS: Record<string, number[]> = {
  guided_small:    [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 24],
  guided_medium:   [24, 27, 28, 30, 32, 33, 35, 36, 40, 42, 44, 45, 48, 50, 54, 56, 60],
  unguided:        [20, 21, 24, 27, 28, 30, 32, 33, 35, 36, 40, 42, 44, 45, 48, 50, 54, 56, 60],
  unguided_large:  [40, 42, 44, 45, 48, 50, 54, 56, 60, 63, 64, 70, 72, 75, 80],
  assessment_intro:[40, 42, 44, 45, 48, 50, 54, 56, 60, 63, 64, 70, 72, 75, 80],
  assessment:      [40, 42, 48, 54, 56, 60, 63, 64, 70, 72, 75, 80, 84, 90, 96, 100],
};

/** Default selection size — single source of truth for instance density. */
const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count prime factors with multiplicity (proxy for difficulty within a mode). */
const primeFactorCount = (n: number): number => {
  let count = 0;
  let temp = n;
  for (let i = 2; i <= temp; i++) {
    while (temp % i === 0) {
      count++;
      temp /= i;
    }
  }
  return count;
};

/** Fisher-Yates shuffle. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orchestrator: rootValue pool selection (replaces Gemini for per-instance numbers)
// ---------------------------------------------------------------------------

export interface SelectRootValuesOptions {
  /** How many distinct composites to select. Clamped to [1, MAX_INSTANCE_COUNT]. */
  count?: number;
  /** Force-include this value as the first challenge (e.g. when manifest provides one). */
  primary?: number;
}

/**
 * Pick `count` distinct composites from the candidate set for a given challenge type,
 * ordered easier-to-harder. Guarantees variance: at least one odd composite when the
 * candidate set has one. No LLM call — the candidate pools are small enough that
 * deterministic selection produces better spread than Gemini's converged output.
 */
export function selectFactorTreeRootValues(
  challengeType: string,
  options: SelectRootValuesOptions = {},
): number[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, options.count ?? DEFAULT_INSTANCE_COUNT));
  const pool = CANDIDATE_POOLS[challengeType] ?? CANDIDATE_POOLS.guided_small;

  const shuffled = shuffle(pool);
  const seen = new Set<number>();
  const selected: number[] = [];

  if (options.primary != null && pool.includes(options.primary)) {
    selected.push(options.primary);
    seen.add(options.primary);
  }

  for (const n of shuffled) {
    if (selected.length >= target) break;
    if (!seen.has(n)) {
      selected.push(n);
      seen.add(n);
    }
  }

  // Variance guarantee: include at least one odd if the pool has any.
  const oddInPool = pool.filter((n) => n % 2 !== 0);
  if (oddInPool.length > 0 && !selected.some((n) => n % 2 !== 0)) {
    const replacement = oddInPool[Math.floor(Math.random() * oddInPool.length)];
    // Replace the last picked even value (keep primary in place if it was an even).
    const swapIdx = selected.length - 1;
    if (swapIdx >= 0 && !(options.primary != null && selected[0] === options.primary && swapIdx === 0)) {
      selected[swapIdx] = replacement;
    }
  }

  // Order from easier to harder (fewer prime factors first; ties broken by value).
  selected.sort((a, b) => {
    const da = primeFactorCount(a);
    const db = primeFactorCount(b);
    if (da !== db) return da - db;
    return a - b;
  });

  // Pin primary at front even after sort.
  if (options.primary != null && selected.includes(options.primary) && selected[0] !== options.primary) {
    const idx = selected.indexOf(options.primary);
    selected.splice(idx, 1);
    selected.unshift(options.primary);
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const factorTreeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Prime Factorization Practice'). Do NOT mention specific numbers — the activity uses several composites."
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will learn from the session."
    },
    challengeType: {
      type: Type.STRING,
      description: "Challenge type for the session. Drives mode flags."
    },
    highlightPrimes: {
      type: Type.BOOLEAN,
      description: "Visually distinguish prime leaves. Default: true"
    },
    showExponentForm: {
      type: Type.BOOLEAN,
      description: "Display final factorization in exponential form (e.g., 2^3 × 3). Default: true"
    },
    guidedMode: {
      type: Type.BOOLEAN,
      description: "Suggest valid factor pairs. true for guided modes, false for unguided/assessment."
    },
    allowReset: {
      type: Type.BOOLEAN,
      description: "Allow the student to clear and restart a tree. true for all modes except assessment."
    }
  },
  required: ["title", "description", "challengeType"]
};

// ---------------------------------------------------------------------------
// Mode-flag enforcement (runs after the Gemini call)
// ---------------------------------------------------------------------------

function enforceModeFlags(data: { challengeType?: string; guidedMode?: boolean; allowReset?: boolean; highlightPrimes?: boolean; showExponentForm?: boolean }): void {
  const ct = data.challengeType;
  if (ct === 'guided_small' || ct === 'guided_medium') {
    data.guidedMode = true;
    data.allowReset = true;
  } else if (ct === 'unguided' || ct === 'unguided_large') {
    data.guidedMode = false;
    data.allowReset = true;
  } else if (ct === 'assessment_intro' || ct === 'assessment') {
    data.guidedMode = false;
    data.allowReset = false;
  }
  if (data.highlightPrimes === undefined) data.highlightPrimes = true;
  if (data.showExponentForm === undefined) data.showExponentForm = true;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateFactorTree = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** Legacy single-value override. If provided, it pins challenge #1. */
    rootValue?: number;
    /** How many factor trees in this session. Default 4, max 6. */
    instanceCount?: number;
    highlightPrimes?: boolean;
    showExponentForm?: boolean;
    guidedMode?: boolean;
    allowReset?: boolean;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<FactorTreeData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'factor-tree',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(factorTreeSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : factorTreeSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge factor tree session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A factor tree session contains 3-6 separate factorizations of different composite numbers.
- The system has ALREADY pre-selected the composite numbers for each challenge; you do NOT pick numbers.
- Your job is only to write the session-level title and description, and to set the mode flags.

${challengeTypeSection}

REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific composite number — the session walks through several.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType to the correct difficulty tier.
4. Set guidedMode, allowReset, highlightPrimes, showExponentForm to match the tier constraints.

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('FactorTree', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;

  if (!wrapper) {
    throw new Error('No valid factor tree wrapper returned from Gemini API');
  }

  // ── Validate challengeType ──
  const validTypes = ['guided_small', 'guided_medium', 'unguided', 'unguided_large', 'assessment_intro', 'assessment'];
  if (!validTypes.includes(wrapper.challengeType)) {
    wrapper.challengeType = evalConstraint?.allowedTypes[0] ?? 'guided_small';
  }

  // ── Enforce mode flags (guidedMode, allowReset, defaults) ──
  enforceModeFlags(wrapper);

  // ── Apply explicit config overrides from manifest ──
  if (config) {
    if (config.highlightPrimes !== undefined) wrapper.highlightPrimes = config.highlightPrimes;
    if (config.showExponentForm !== undefined) wrapper.showExponentForm = config.showExponentForm;
    // Don't allow config to override guidedMode/allowReset when eval mode is active.
    if (!evalConstraint) {
      if (config.guidedMode !== undefined) wrapper.guidedMode = config.guidedMode;
      if (config.allowReset !== undefined) wrapper.allowReset = config.allowReset;
    }
  }

  // ── Pre-select rootValues for the session (local, deterministic-variance) ──
  const rootValues = selectFactorTreeRootValues(wrapper.challengeType, {
    count: config?.instanceCount,
    primary: config?.rootValue,
  });

  const challenges: FactorTreeChallenge[] = rootValues.map((rootValue, idx) => ({
    id: `ft-${idx + 1}`,
    rootValue,
  }));

  console.log(
    `[FactorTree] Final: challengeType=${wrapper.challengeType}, instances=${challenges.length} ` +
    `[${rootValues.join(', ')}], guided=${wrapper.guidedMode}, reset=${wrapper.allowReset}`
  );

  return {
    title: wrapper.title,
    description: wrapper.description,
    challenges,
    highlightPrimes: wrapper.highlightPrimes,
    showExponentForm: wrapper.showExponentForm,
    guidedMode: wrapper.guidedMode,
    allowReset: wrapper.allowReset,
  };
};
