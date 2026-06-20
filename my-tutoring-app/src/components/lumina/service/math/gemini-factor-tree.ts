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
  /** Within-mode support tier (#1): running "current factorization" self-check panel. */
  showRunningFactorization?: boolean;
  /** Within-mode support tier (#2): divisibility-strategy hint panel (guided modes only). */
  showStrategyHint?: boolean;
  /** Support tier label, threaded to the live tutor for reveal calibration. */
  supportTier?: 'easy' | 'medium' | 'hard';
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

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------

type FactorTreeChallengeType =
  | 'guided_small'
  | 'guided_medium'
  | 'unguided'
  | 'unguided_large'
  | 'assessment_intro'
  | 'assessment';

/** Default selection size — tier fallback (T1 — fast-tap factorization). */
const DEFAULT_INSTANCE_COUNT = 7;
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<FactorTreeChallengeType, number> = {
  guided_small: 7,     // T1 (pool-service) — B2 bump 4 → 7
  guided_medium: 5,    // T2 — B4 bump 4 → 5
  unguided: 5,         // T2 — B4 bump 4 → 5
  unguided_large: 5,   // T2 — B4 bump 4 → 5
  assessment_intro: 5, // T2 — B4 bump 4 → 5
  assessment: 5,       // T2 — B4 bump 4 → 5
};

// ---------------------------------------------------------------------------
// Within-mode support tiers (config.difficulty) — two axes:
//   1. scaffolding withdrawal: strategy hint, prime highlighting, running self-check
//   2. structural problem shape: split-depth bias within the SAME number pool
// The tier changes HELP and SHAPE (how many splits / tree depth), never magnitude.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** Per-primitive scaffold levers. Session-level — factor-tree runs one mode per session. */
interface SupportScaffold {
  /** Divisibility-strategy hint panel (#2 instruction). Guided modes only. */
  showStrategyHint: boolean;
  /** Green "this leaf is prime/done" highlighting (#1 perception). */
  highlightPrimes: boolean;
  /** Running "current factorization" self-check panel (#1 perception). */
  showRunningFactorization: boolean;
}

const GUIDED_MODES = new Set<FactorTreeChallengeType>(['guided_small', 'guided_medium']);
const ASSESSMENT_MODES = new Set<FactorTreeChallengeType>(['assessment_intro', 'assessment']);

const TIER_GUARDRAIL =
  "Keep every composite within the eval mode's number pool — this tier changes how much "
  + 'on-screen help the student gets and the SHAPE of the problem (number of splits / tree depth), '
  + 'NOT the size of the numbers.';

/**
 * Axis 1 — scaffolding withdrawal. Mode-aware: assessment modes are one step more
 * austere at every tier (an on-screen "hint" contradicts the assessment identity),
 * and the strategy panel only ever appears in guided modes.
 */
function resolveSupportStructure(
  mode: string,
  tier: SupportTier,
): { scaffold: SupportScaffold; promptLines: string[] } {
  const m = mode as FactorTreeChallengeType;
  const guided = GUIDED_MODES.has(m);
  const assessment = ASSESSMENT_MODES.has(m);

  const highlightPrimes = assessment ? tier === 'easy' : tier !== 'hard';
  const showRunningFactorization = assessment ? tier === 'easy' : tier !== 'hard';
  const showStrategyHint = guided && tier === 'easy';

  const promptLines: string[] = [TIER_GUARDRAIL];
  if (tier === 'easy') {
    promptLines.push(
      'EASY: maximum self-check support — prime leaves highlighted, the running factorization visible'
      + (guided ? ', plus a divisibility-strategy panel naming which rule to try.' : '.'),
    );
  } else if (tier === 'medium') {
    promptLines.push(
      'MEDIUM: prime highlighting and the running factorization stay on, but no named strategy — '
      + 'the student applies divisibility rules from memory.',
    );
  } else {
    promptLines.push(
      'HARD: the student works unaided — no strategy hint, no prime highlighting, no running '
      + 'factorization. They judge primality and track their own leaves.',
    );
  }
  return { scaffold: { showStrategyHint, highlightPrimes, showRunningFactorization }, promptLines };
}

/**
 * Axis 2 — structural problem shape. Within the mode's pool, bias rootValue selection
 * by prime-factor COUNT (steps-to-solve / tree depth): low at easy, high at hard.
 * Structural, not magnitude — 32 (2^5, 5 splits) < 35 (5×7, 1 split) yet 32 is the
 * harder tree. Enforced deterministically in selectFactorTreeRootValues.
 */
function resolveProblemShape(
  tier: SupportTier,
): { splitDepthBias: 'low' | 'high' | null; promptLines: string[] } {
  if (tier === 'easy') {
    return {
      splitDepthBias: 'low',
      promptLines: ['SHAPE: shallow trees — composites with few prime factors (1-2 splits).'],
    };
  }
  if (tier === 'hard') {
    return {
      splitDepthBias: 'high',
      promptLines: ['SHAPE: deep trees — composites with more prime factors (more splits to coordinate).'],
    };
  }
  return { splitDepthBias: null, promptLines: ['SHAPE: mixed tree depths.'] };
}

/** Merge both axes into one prompt section (tone only — code applies the actual levers). */
function buildTierPromptSection(mode: string, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(tier).promptLines,
  ];
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}" (help level + problem shape — NOT number size)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

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
  /**
   * Structural support-tier axis: bias selection toward composites with FEWER ('low',
   * easy) or MORE ('high', hard) prime factors — i.e. shallower vs deeper trees within
   * the SAME pool. null/absent → no bias (no-tier path is byte-identical to before).
   */
  splitDepthBias?: 'low' | 'high' | null;
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
  const modeCount = COUNT_BY_MODE[challengeType as FactorTreeChallengeType];
  const target = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      options.count ?? modeCount ?? DEFAULT_INSTANCE_COUNT,
    ),
  );
  const pool = CANDIDATE_POOLS[challengeType] ?? CANDIDATE_POOLS.guided_small;

  // Structural axis: restrict the candidate subset by split depth before shuffling.
  // The subset stays generous (≥ target + 1, ~55% of the pool) so the variance and
  // odd-inclusion guarantees below still hold. No bias → full pool (byte-identical path).
  let source = pool;
  if (options.splitDepthBias) {
    const sorted = [...pool].sort((a, b) => primeFactorCount(a) - primeFactorCount(b));
    const subsetSize = Math.min(
      pool.length,
      Math.max(target + 1, Math.ceil(pool.length * 0.55)),
    );
    source = options.splitDepthBias === 'low'
      ? sorted.slice(0, subsetSize)
      : sorted.slice(pool.length - subsetSize);
  }

  const shuffled = shuffle(source);
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
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much scaffolding + how deep a tree within it. NEVER changes magnitude.
     */
    difficulty?: string;
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

  // ── Resolve within-mode support tier (drives scaffolding + structural shape) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType describes the single mode to the prompt/scaffold resolver.
  const pinnedType = evalConstraint && evalConstraint.allowedTypes.length === 1
    ? (evalConstraint.allowedTypes[0] as FactorTreeChallengeType)
    : undefined;
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier)
    : '';

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge factor tree session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A factor tree session contains 3-6 separate factorizations of different composite numbers.
- The system has ALREADY pre-selected the composite numbers for each challenge; you do NOT pick numbers.
- Your job is only to write the session-level title and description, and to set the mode flags.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific composite number — the session walks through several.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType to the correct difficulty tier.
4. Set guidedMode, allowReset, highlightPrimes, showExponentForm to match the tier constraints.
5. Do NOT mention difficulty, support tiers, or scaffolding level in the title or description.

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
  // Structural axis (axis 2): bias the candidate split-depth by tier.
  const problemShape = supportTier ? resolveProblemShape(supportTier) : null;
  const rootValues = selectFactorTreeRootValues(wrapper.challengeType, {
    count: config?.instanceCount,
    primary: config?.rootValue,
    splitDepthBias: problemShape?.splitDepthBias ?? null,
  });

  const challenges: FactorTreeChallenge[] = rootValues.map((rootValue, idx) => ({
    id: `ft-${idx + 1}`,
    rootValue,
  }));

  // ── Apply within-mode support tier — scaffolding axis (axis 1) ──
  // Session-level: factor-tree runs one eval mode per session, so every challenge shares
  // the tier. Code owns the scaffold structure; Gemini only authored the wrapper text.
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier).scaffold
    : null;

  if (tierScaffold) {
    console.log(
      `[FactorTree] Support tier "${supportTier}" applied (mode ${pinnedType}): ` +
      `strategyHint=${tierScaffold.showStrategyHint}, highlightPrimes=${tierScaffold.highlightPrimes}, ` +
      `runningFactorization=${tierScaffold.showRunningFactorization}, ` +
      `splitDepthBias=${problemShape?.splitDepthBias ?? 'none'}`
    );
  }

  console.log(
    `[FactorTree] Final: challengeType=${wrapper.challengeType}, instances=${challenges.length} ` +
    `[${rootValues.join(', ')}], guided=${wrapper.guidedMode}, reset=${wrapper.allowReset}`
  );

  return {
    title: wrapper.title,
    description: wrapper.description,
    challenges,
    // Tier wins over the wrapper/config value when a tier is active.
    highlightPrimes: tierScaffold ? tierScaffold.highlightPrimes : wrapper.highlightPrimes,
    showExponentForm: wrapper.showExponentForm,
    showRunningFactorization: tierScaffold ? tierScaffold.showRunningFactorization : undefined,
    showStrategyHint: tierScaffold ? tierScaffold.showStrategyHint : undefined,
    supportTier: supportTier ?? undefined,
    guidedMode: wrapper.guidedMode,
    allowReset: wrapper.allowReset,
  };
};
