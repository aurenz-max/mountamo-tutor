import { Type, Schema } from "@google/genai";
import { MultiplicationExplorerData } from "../../primitives/visual-primitives/math/MultiplicationExplorer";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import { buildScopePromptSection } from "../scopeContext";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build: {
    promptDoc:
      `"build": Student builds equal groups or an array for the given fact, then counts the total. `
      + `hiddenValue = "product". Concrete manipulative with full guidance. `
      + `Use kid-friendly contexts (packs of stickers, wheels on cars). `
      + `Grade 2: only ×2, ×5, ×10.`,
    schemaDescription: "'build' (construct groups/arrays)",
  },
  connect: {
    promptDoc:
      `"connect": Same fact shown in all 5 representations simultaneously (groups, array, `
      + `repeated addition, number line, area model). Student identifies the connection between them. `
      + `hiddenValue = null. Pictorial with prompts — linking visual models.`,
    schemaDescription: "'connect' (link representations)",
  },
  commutative: {
    promptDoc:
      `"commutative": Flip the factors — is the product the same? Student explores `
      + `a×b vs b×a. hiddenValue = null or "product". `
      + `Pictorial with reduced prompts — apply commutative property. `
      + `Show the array rotated to demonstrate rows↔columns swap.`,
    schemaDescription: "'commutative' (apply commutative property)",
  },
  distributive: {
    promptDoc:
      `"distributive": Break a harder fact into easier parts (e.g., 7×6 = 5×6 + 2×6). `
      + `hiddenValue = "product". Transitional: mixed symbolic/pictorial. `
      + `Show the area model split into two rectangles. Grade 3+ only.`,
    schemaDescription: "'distributive' (break apart with distribution)",
  },
  missing_factor: {
    promptDoc:
      `"missing_factor": Given product and one factor, find the other factor. `
      + `hiddenValue = "factor1" or "factor2". Symbolic, single operation. `
      + `E.g., "? × 4 = 20, what is the missing number?" `
      + `Encourage skip-counting or think-backwards strategy.`,
    schemaDescription: "'missing_factor' (solve for unknown factor)",
  },
  fluency: {
    promptDoc:
      `"fluency": Quick-fire fact recall with optional time limit. `
      + `hiddenValue = "product". timeLimit: 5-8 seconds. `
      + `Symbolic, multi-step / cross-concept — rapid recall without visual aids. `
      + `No representations needed, just bare fact.`,
    schemaDescription: "'fluency' (rapid fact recall)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// All multiplication-explorer modes are T2 in the §5a tier table. B4 sweep
// replaces the prompt's "Generate 3-6" range with a templated per-mode count.

type MultiplicationExplorerChallengeType =
  | 'build'
  | 'connect'
  | 'commutative'
  | 'distributive'
  | 'missing_factor'
  | 'fluency';

const DEFAULT_INSTANCE_COUNT = 5; // T2 fallback
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<MultiplicationExplorerChallengeType, number> = {
  build: 5,            // T2 — B4 bump 3-6 → 5
  connect: 5,          // T2 — B4 bump 3-6 → 5
  commutative: 5,      // T2 — B4 bump 3-6 → 5
  distributive: 5,     // T2 — B4 bump 3-6 → 5
  missing_factor: 5,   // T2 — B4 bump 3-6 → 5
  fluency: 5,          // T2 — B4 bump 3-6 → 5
};

// ---------------------------------------------------------------------------
// Code-owned FACT POOL + modality assignment (CLASS-3)
// ---------------------------------------------------------------------------
/**
 * WHY CODE OWNS THE FACTS
 * -----------------------
 * This generator used to emit ONE `fact` and point every challenge at it, so a
 * five-challenge session was "3 × 4" asked five ways: same numbers, same picture,
 * five wordings. That is not five questions — it's one question with four
 * restatements, and it gave the adaptive engine a single data point per session.
 *
 * Now each challenge carries its OWN fact, drawn HERE rather than from the model.
 * Facts must be code-picked for the same reason array-grid's dimensions are
 * (PRD §6a #2): structured-output flash-lite converges hard per call, so "give me
 * five different facts" reliably returns 3×4 and its immediate neighbours. Code
 * enumerates the admissible facts and samples for spread; Gemini only writes the
 * words around the facts it is handed.
 *
 * The MANIFEST PIN still wins: when the lesson pins both factors it is genuinely
 * about one fact (`config.factor1 = 3, factor2 = 4`), and the session correctly
 * collapses to that fact explored across modalities. Pinning one factor means a
 * times table — every challenge keeps that factor and varies the other.
 */

/** A representation key the component can render (mirrors MultiplicationRepresentation). */
export type ExplorerRepresentation =
  | 'groups' | 'array' | 'repeated_addition' | 'number_line' | 'area_model' | 'all';

export interface ExplorerFact {
  factor1: number;
  factor2: number;
}

/**
 * Admissible factor band per grade band. Mirrors the prose rules the prompt used
 * to state ("grade 2 keeps products ≤ 50", "grade 3-4 any fact through 12×12"),
 * but as a table code can actually enumerate. A Tier-2 scope cap narrows it further.
 */
export const FACT_BAND: Record<'2-3' | '3-4', { min: number; max: number; maxProduct: number }> = {
  '2-3': { min: 2, max: 10, maxProduct: 50 },
  '3-4': { min: 2, max: 12, maxProduct: 144 },
};

/** Fisher-Yates — the only source of between-session fact variance. */
function shuffleFacts<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const factCard = (f: ExplorerFact) => `${f.factor1}x${f.factor2}`;
const factShape = (f: ExplorerFact) =>
  f.factor1 <= f.factor2 ? `${f.factor1}x${f.factor2}` : `${f.factor2}x${f.factor1}`;

/**
 * Pick `count` facts, preferring maximum spread. Selection tiers, each of which
 * only ever adds a card not already present:
 *   1. distinct PRODUCTS   — the widest spread; no two challenges share an answer.
 *   2. distinct SHAPES     — 3×4 after 2×6 (same product 12, different picture).
 *   3. distinct CARDS      — commutative reflections (4×3 after 3×4), which are a
 *      genuinely different task in a primitive whose whole point includes commutativity.
 * A pinned factor narrows the enumeration rather than filtering afterwards, so a
 * pin can never starve the pool into repeats.
 */
export function selectFacts(
  band: { min: number; max: number; maxProduct: number },
  count: number,
  opts: { pinnedFactor1?: number; pinnedFactor2?: number } = {},
): ExplorerFact[] {
  const admissible: ExplorerFact[] = [];
  const f1Lo = opts.pinnedFactor1 ?? band.min;
  const f1Hi = opts.pinnedFactor1 ?? band.max;
  const f2Lo = opts.pinnedFactor2 ?? band.min;
  const f2Hi = opts.pinnedFactor2 ?? band.max;
  for (let f1 = f1Lo; f1 <= f1Hi; f1++) {
    for (let f2 = f2Lo; f2 <= f2Hi; f2++) {
      // ×1 is not a fact worth a challenge card; the product ceiling is the grade rule.
      if (f1 < 2 || f2 < 2) continue;
      if (f1 * f2 > band.maxProduct) continue;
      admissible.push({ factor1: f1, factor2: f2 });
    }
  }

  const picked: ExplorerFact[] = [];
  const usedProducts = new Set<number>();
  const usedShapes = new Set<string>();
  const usedCards = new Set<string>();
  const take = (f: ExplorerFact) => {
    usedProducts.add(f.factor1 * f.factor2);
    usedShapes.add(factShape(f));
    usedCards.add(factCard(f));
    picked.push(f);
  };

  for (const f of shuffleFacts(admissible)) {
    if (picked.length >= count) break;
    if (usedProducts.has(f.factor1 * f.factor2)) continue;
    take(f);
  }
  for (const f of shuffleFacts(admissible)) {
    if (picked.length >= count) break;
    if (usedShapes.has(factShape(f))) continue;
    take(f);
  }
  for (const f of shuffleFacts(admissible)) {
    if (picked.length >= count) break;
    if (usedCards.has(factCard(f))) continue;
    take(f);
  }

  // Both factors pinned → the lesson IS one fact; repeat it deliberately so the
  // session explores it across modalities (the one case where that is correct).
  if (picked.length === 0 && admissible.length > 0) {
    return Array.from({ length: count }, () => admissible[0]);
  }
  if (picked.length === 1 && admissible.length === 1) {
    return Array.from({ length: count }, () => picked[0]);
  }
  if (picked.length < count) {
    console.warn(
      `[MultiplicationExplorer] only ${picked.length} distinct facts available for ${count} `
      + `challenges (band ${band.min}-${band.max}, product ≤ ${band.maxProduct}`
      + `${opts.pinnedFactor1 !== undefined ? `, factor1 pinned ${opts.pinnedFactor1}` : ''}`
      + `${opts.pinnedFactor2 !== undefined ? `, factor2 pinned ${opts.pinnedFactor2}` : ''}) `
      + `— shipping a shorter session rather than repeating a fact.`,
    );
  }
  return picked;
}

/**
 * Which modality each challenge is seen through. Round-robin over the ENABLED
 * representations is what turns a single-mode session into modality coverage —
 * "ask N questions, each through a different lens" — instead of N questions in
 * the same panel. Two types override it because the model IS the strategy:
 * `connect` needs all five at once, and `distributive` is taught on the area model.
 */
export function assignRepresentations(
  types: MultiplicationExplorerChallengeType[],
  enabled: ExplorerRepresentation[],
): ExplorerRepresentation[] {
  const cycle = enabled.filter((r) => r !== 'all');
  return types.map((t, i) => {
    if (t === 'connect') return 'all';
    if (t === 'distributive' && cycle.includes('area_model')) return 'area_model';
    if (cycle.length === 0) return 'array';
    return cycle[i % cycle.length];
  });
}

/**
 * Deterministic challenge text for a given (type, fact) — the no-LLM path.
 *
 * EVERY instruction here resolves to ONE number, because the component's only
 * answer affordance is a numeric keypad and it grades `parseInt(answer) ===
 * expected`. The pre-redesign fallbacks asked "Is 3 × 4 the same as 4 × 3?" and
 * "Do they show the same amount?" while silently expecting the product — a
 * student who answered the question as written could never be right.
 */
export function buildFallbackChallenge(
  type: MultiplicationExplorerChallengeType,
  fact: ExplorerFact,
  index: number,
): Record<string, unknown> {
  const { factor1: a, factor2: b } = fact;
  const p = a * b;
  const targetFact = `${a} × ${b} = ${p}`;
  const base = { id: `c${index + 1}`, targetFact, timeLimit: null as number | null };
  switch (type) {
    case 'connect':
      return { ...base, type, instruction: `All the pictures show ${a} × ${b}. How many are there in total?`, hiddenValue: 'product', hint: 'Every picture shows the same fact — count any one of them.', narration: `Groups, arrays and jumps all show ${a} × ${b}. Let's find the total.` };
    case 'commutative':
      return { ...base, type, instruction: `${a} × ${b} and ${b} × ${a} make the same total. What is it?`, hiddenValue: 'product', hint: 'Flip the array sideways — the total does not change.', narration: `Swapping the numbers keeps the total the same. What is it?` };
    case 'distributive':
      return { ...base, type, instruction: `Break ${a} × ${b} into easier parts. What is the total?`, hiddenValue: 'product', hint: `Try ${Math.min(5, Math.max(1, a - 1))} × ${b} plus ${a - Math.min(5, Math.max(1, a - 1))} × ${b}.`, narration: `Let's break a hard fact into easy ones!` };
    case 'missing_factor':
      return { ...base, type, instruction: `? × ${b} = ${p}. What is the missing number?`, hiddenValue: 'factor1', hint: `Count by ${b}s until you reach ${p}.`, narration: `One factor is hidden. Can you work it out?` };
    case 'fluency':
      return { ...base, type, timeLimit: 6, instruction: `Quick! What is ${a} × ${b}?`, hiddenValue: 'product', hint: `Think of ${a} groups of ${b}.`, narration: `Let's see how fast you know this one!` };
    case 'build':
    default:
      return { ...base, type: 'build', instruction: `Build ${a} groups of ${b}. How many is that in total?`, hiddenValue: 'product', hint: `Count up: ${Array.from({ length: a }, (_, i) => b * (i + 1)).join(', ')}.`, narration: `Let's build ${a} groups of ${b} and count them!` };
  }
}

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as ten-frame / counting-board): config.targetEvalMode
// says WHICH skill (task identity, matched to the objective by the manifest);
// config.difficulty says how much on-screen SUPPORT the student gets while doing it
// ('easy' = max scaffolding, 'hard' = min). The tier is per-component — the manifest
// withdraws support across Introduce → Visualize → Apply, and personalization routes
// through this field. It NEVER changes the FACT: factor1/factor2/product stay
// scope-bound; the grade band + per-mode tables own magnitude. A harder tier means
// fewer on-screen readouts/representations and a less explicit hint, never bigger
// factors. See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** Hint explicitness level — names the cognitive sub-steps to withdraw (modality #2). */
type HintDepth = 'enumerated' | 'strategy' | 'generic';

interface SupportScaffold {
  /** The big fact header + per-rep product readout. CAUTION: when the product IS the
   *  asked value (hiddenValue==='product') this is the on-screen ANSWER — the apply
   *  step in code forces it OFF in that case regardless of this preference. */
  showProduct: boolean;
  /** Commutative flip button + rotated array scaffold (commutative mode). */
  showCommutativeFlip: boolean;
  /** Fact-family (× and ÷) reveal button (missing_factor / fluency families). */
  showFactFamily: boolean;
  /** Fully-worked distributive breakdown panel (distributive mode, strategy phase). */
  showDistributiveBreakdown: boolean;
  /** How many representations stay visible. 'all' = every rep; 'core' = groups+array
   *  (+ the mode's signature rep); 'minimal' = symbol-leaning. NEVER null/empty —
   *  the panels ARE the primitive (build/connect keep models at every tier). */
  repSet: 'all' | 'core' | 'minimal';
  /** Hint explicitness ladder (modality #2 — instruction-as-scaffold). */
  hintDepth: HintDepth;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-screen support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * fact with less scaffolding — never a different fact, never bigger factors.
 *
 * showProduct here is the PREFERENCE; the leak guard in the apply step (and the
 * promptLines below) force it OFF wherever the product is the asked value.
 */
function resolveSupportStructure(
  pinnedType: MultiplicationExplorerChallengeType,
  tier: SupportTier,
): SupportScaffold {
  const repSet: SupportScaffold['repSet'] =
    tier === 'easy' ? 'all' : tier === 'medium' ? 'core' : 'minimal';
  const hintDepth: HintDepth =
    tier === 'easy' ? 'enumerated' : tier === 'medium' ? 'strategy' : 'generic';

  // Defaults — per-mode switch overrides where the lever has mode-specific meaning.
  const scaffold: SupportScaffold = {
    showProduct: tier === 'easy',
    showCommutativeFlip: false,
    showFactFamily: false,
    showDistributiveBreakdown: false,
    repSet,
    hintDepth,
    promptLines: [
      `Support tier: ${tier.toUpperCase()} — this sets on-screen SCAFFOLDING only (${tier === 'easy' ? 'maximum support: readouts/representations help the student see the fact' : tier === 'medium' ? 'moderate support: the model is visible but the student tracks the total themselves' : 'minimum support: the student works the fact unaided and justifies it'}). Keep factor1, factor2 and the product within the pedagogical scope and grade band; a harder tier NEVER means bigger factors, only less on-screen help.`,
    ],
  };

  switch (pinnedType) {
    case 'build':
      // hiddenValue = product → showProduct is the ANSWER. Scaffold via reps + hint,
      // NOT the product readout. Force product OFF at every tier here.
      scaffold.showProduct = false;
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Show the full array/groups model. The hint should enumerate the skip-count chain to the total (e.g. "5, 10, 15, 20") so the student can follow the count.'
          : tier === 'hard'
            ? 'Keep the array/groups model visible but the student must count it themselves; the hint stays generic ("Use the model to find the total — count carefully").'
            : 'Keep the model visible; the hint should NAME the strategy only (e.g. "Skip-count by the group size") without listing the numbers.',
      );
      break;
    case 'connect':
      // hiddenValue = null → the product is NOT the asked value, so showProduct is a
      // legitimate "same fact" linking cue at easy and not a leak.
      scaffold.showProduct = tier === 'easy';
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Show all representations with the product visible; the instruction/hint should state explicitly that every picture shows the SAME fact.'
          : tier === 'hard'
            ? 'Show fewer representations and hide the product; give NO linking hint — the student must find what the pictures share on their own.'
            : 'Show all representations but hide the product; the hint should ask "what is the same across these pictures?" without answering it.',
      );
      break;
    case 'commutative':
      // hiddenValue = null → product not asked; flip is the scaffold lever.
      scaffold.showCommutativeFlip = tier !== 'hard';
      scaffold.showProduct = tier === 'easy';
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Provide the flip button, show both arrays and the product so the student can verify a×b and b×a land on the same total.'
          : tier === 'hard'
            ? 'No flip scaffold and product hidden — the student must PREDICT whether the total stays the same BEFORE checking, then justify why.'
            : 'Keep the flip button but hide the product; the hint should ask "is the total the same when you swap?" without confirming it.',
      );
      break;
    case 'distributive':
      // hiddenValue = product → showProduct is the ANSWER. Scaffold via the breakdown
      // panel + hint, never the product readout. Force product OFF at every tier.
      scaffold.showProduct = false;
      scaffold.showDistributiveBreakdown = tier !== 'hard';
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Show the distributive breakdown fully worked (both partial products and their sum); the hint walks the split step by step.'
          : tier === 'hard'
            ? 'No breakdown shown — the student must CHOOSE the split themselves; the hint stays generic ("Break the hard fact into two easier ones").'
            : 'Show the breakdown structure but the student fills in the partial products; the hint names which factor to split, not the parts.',
      );
      break;
    case 'missing_factor':
      // hiddenValue = factor1/factor2 → the PRODUCT is given, so showProduct is fine
      // (it is part of the prompt, not the answer). The asked factor is never shown.
      scaffold.showProduct = tier !== 'hard';
      scaffold.showFactFamily = tier === 'easy';
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Show the model and the product; the hint should give the skip-count-to-the-product chain (e.g. "Count by the known factor: 4, 8, 12, 16 — how many jumps?").'
          : tier === 'hard'
            ? 'Symbol-only — no model; the hint stays generic ("Think: what times the known factor makes the product?").'
            : 'Show the model; the hint should say "count by the known factor until you reach the product" without listing the multiples.',
      );
      break;
    case 'fluency':
      // hiddenValue = product → product readout is the ANSWER. Always OFF.
      scaffold.showProduct = false;
      scaffold.promptLines.push(
        tier === 'easy'
          ? 'Bare fact recall, no representations. Provide a brief recall hint (e.g. "Think of it as groups of the smaller factor").'
          : tier === 'hard'
            ? 'Bare fact recall, no representations and no hint — pure rapid recall (current behaviour).'
            : 'Bare fact recall, no representations and no hint.',
      );
      break;
  }
  return scaffold;
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const multiplicationExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title (e.g., 'Wheels on Cars: 4 × 3', 'Pack It Up: 5 × 6')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description tying multiplication to a concrete context"
    },
    fact: {
      type: Type.OBJECT,
      properties: {
        factor1: { type: Type.NUMBER, description: "First factor (number of groups)" },
        factor2: { type: Type.NUMBER, description: "Second factor (items per group)" },
        product: { type: Type.NUMBER, description: "Product (factor1 × factor2)" }
      },
      required: ["factor1", "factor2", "product"]
    },
    representations: {
      type: Type.OBJECT,
      properties: {
        equalGroups: { type: Type.BOOLEAN },
        array: { type: Type.BOOLEAN },
        repeatedAddition: { type: Type.BOOLEAN },
        numberLine: { type: Type.BOOLEAN },
        areaModel: { type: Type.BOOLEAN }
      },
      required: ["equalGroups", "array", "repeatedAddition", "numberLine", "areaModel"]
    },
    activeRepresentation: {
      type: Type.STRING,
      description: "Starting representation: 'groups', 'array', 'repeated_addition', 'number_line', 'area_model', or 'all'"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'build' (construct groups/arrays), 'connect' (link representations), 'commutative' (apply commutative property), 'distributive' (break apart with distribution), 'missing_factor' (solve for unknown factor), 'fluency' (rapid fact recall)"
          },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          targetFact: { type: Type.STRING, description: "e.g., '3 × 4 = 12'" },
          hiddenValue: {
            type: Type.STRING,
            nullable: true,
            description: "'factor1', 'factor2', 'product', or null"
          },
          timeLimit: {
            type: Type.NUMBER,
            nullable: true,
            description: "Seconds for fluency mode, or null"
          },
          hint: { type: Type.STRING },
          narration: { type: Type.STRING, description: "AI tutor narration for this challenge" }
        },
        required: ["id", "type", "instruction", "targetFact", "hint", "narration"]
      },
      description: "3-6 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showProduct: { type: Type.BOOLEAN },
        showFactFamily: { type: Type.BOOLEAN },
        showCommutativeFlip: { type: Type.BOOLEAN },
        showDistributiveBreakdown: { type: Type.BOOLEAN }
      },
      required: ["showProduct", "showFactFamily", "showCommutativeFlip", "showDistributiveBreakdown"]
    },
    imagePrompt: {
      type: Type.STRING,
      nullable: true,
      description: "Real-world context image prompt (e.g., 'rows of desks in a classroom')"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '2-3' or '3-4'"
    }
  },
  required: ["title", "description", "fact", "representations", "activeRepresentation", "challenges", "showOptions", "gradeBand"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type MultiplicationExplorerConfig = {
    factor1?: number;
    factor2?: number;
    gradeBand?: '2-3' | '3-4';
    challengeTypes?: string[];
    representations?: string[];
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Intent or title from the manifest item. */
    intent?: string;
    /** How many challenges in this session. Defaults from COUNT_BY_MODE (5 for all T2 modes). */
    instanceCount?: number;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes the
     * factors or the product — only readouts, representations, and hint depth.
     */
    difficulty?: string;
};

export const generateMultiplicationExplorer = async (
  ctx: GenerationContext,
): Promise<MultiplicationExplorerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config: MultiplicationExplorerConfig = { ...(ctx.raw as MultiplicationExplorerConfig), intent: ctx.intent };
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'multiplication-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Resolve per-mode instance count up-front ──
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as MultiplicationExplorerChallengeType)
      : undefined;
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount ??
        (pinnedType ? COUNT_BY_MODE[pinnedType] : undefined) ??
        DEFAULT_INSTANCE_COUNT,
    ),
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Code-owned facts (CLASS-3) ───────────────────────────────────
  // Picked BEFORE the call so the prompt can hand Gemini the exact fact each
  // challenge is about — the words it writes then match the numbers code chose,
  // and neither can drift from the other. ctx.grade is the canonical curriculum
  // grade; never parse it out of the gradeContext prose (GenerationContext:68).
  const factBandKey: '2-3' | '3-4' =
    config?.gradeBand ??
    (ctx.grade && /^\d+$/.test(ctx.grade) && parseInt(ctx.grade, 10) >= 4 ? '3-4' : '2-3');
  const sessionFacts = selectFacts(FACT_BAND[factBandKey], instanceCount, {
    pinnedFactor1: config?.factor1,
    pinnedFactor2: config?.factor2,
  });
  const factsSection = sessionFacts.length
    ? `\n## THE FACTS FOR THIS SESSION (assigned — do not choose your own)\n`
      + sessionFacts
          .map((f, i) => `- Challenge ${i + 1}: ${f.factor1} × ${f.factor2} = ${f.factor1 * f.factor2}`)
          .join('\n')
      + `\nWrite each challenge's instruction, hint and narration ABOUT ITS OWN FACT above, in order.\n`
      + `Challenge N's targetFact MUST be exactly the fact listed for challenge N.\n`
    : '';
  console.log(
    `[MultiplicationExplorer] facts (band ${factBandKey}): `
    + sessionFacts.map((f) => `${f.factor1}×${f.factor2}`).join(', '),
  );

  // ── Within-mode support tier ──
  // The eval mode owns WHAT skill; config.difficulty owns how much on-screen
  // scaffolding within it. supportTier DRIVES application (per challenge, blends
  // included); pinnedType only selects the single-mode prose for the prompt tone.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT factor/product size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(multiplicationExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : multiplicationExplorerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  // Pedagogical scope is resolved once at the registry boundary (ctx.scope). Injected
  // right after the opening line and BEFORE the grade-level guidelines so its rules
  // reframe grade as a CEILING (topic/objective wins when narrower, e.g. "facts up to
  // 5×5" keeps both factors ≤ 5).
  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `
Create an educational multiplication explorer activity for "${topic}" at ${gradeLevel} level.
${scopeSection}
CONTEXT:
The multiplication explorer connects 5 representations of the same fact:
1. Equal Groups (circles with dots — "3 groups of 4")
2. Array (rows × columns grid — "3 rows, 4 columns")
3. Repeated Addition (4 + 4 + 4)
4. Number Line (jumps of 4, 3 times)
5. Area Model (3 × 4 rectangle)

${challengeTypeSection}
${factsSection}
${tierSection}
${!evalConstraint ? `
GRADE-LEVEL GUIDELINES:
Grade 2 (gradeBand "2-3"):
  * Only ×2, ×5, ×10 facts
  * Focus on equal groups and arrays
  * Concrete contexts (packs of gum, wheels on cars, fingers on hands)
  * showDistributiveBreakdown: false
  * showCommutativeFlip: true (simple)
  * Include 'build' and 'connect' challenges only
  * Keep products ≤ 50

Grade 3 (gradeBand "2-3" or "3-4"):
  * All facts through 10×10
  * All 5 representations
  * Commutative property emphasized
  * Introduce distributive property: 7×8 = 5×8 + 2×8
  * Include 'commutative', 'missing_factor', and 'fluency' challenges
  * showDistributiveBreakdown: true for harder facts (×6, ×7, ×8, ×9)

Grade 4 (gradeBand "3-4"):
  * Multi-digit × single-digit (e.g., 12 × 4, 23 × 3)
  * Area model emphasis for partial products
  * Division as inverse (fact family)
  * showFactFamily: true
  * All challenge types
` : ''}

${(() => {
  const hints: string[] = [];
  if (config?.factor1 !== undefined) hints.push(`- Factor 1: ${config.factor1}`);
  if (config?.factor2 !== undefined) hints.push(`- Factor 2: ${config.factor2}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.representations) hints.push(`- Representations: ${config.representations.join(', ')}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Choose a concrete, kid-friendly context (packs of stickers, rows of desks, eggs in cartons, wheels on cars)
2. product MUST equal factor1 × factor2 exactly
3. Generate EXACTLY ${instanceCount} challenges that progress in difficulty
4. Start with easier challenges and progress to harder types
5. Use the ASSIGNED fact for each challenge — do NOT invent factors of your own
6. Each challenge's instruction must be answerable by typing ONE number on a keypad.
   Never phrase a challenge as a yes/no question ("Do they show the same amount?") —
   the student answers with a number, so ask for one ("...how many in total?").
7. hiddenValue should be null for build/connect, 'product' for fluency, 'factor1' or 'factor2' for missing_factor
8. Include warm, encouraging hint and narration text
9. All 5 representations should generally be true (set false only if factor is too large for visual)
10. Set activeRepresentation to 'groups' as the starting view
11. The title must be NUMBER-FREE — the session covers several different facts, so a
    title like "Sticker Packs: 3 × 4" would be wrong. Use "Sticker Packs" instead.

Return the complete multiplication explorer configuration.
`;

  logEvalModeResolution('MultiplicationExplorer', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid multiplication explorer data returned from Gemini API');
  }

  // Validation: ensure product = factor1 × factor2
  if (data.fact) {
    data.fact.product = data.fact.factor1 * data.fact.factor2;
  }

  // gradeBand is code-owned: the facts were enumerated from FACT_BAND[factBandKey],
  // so letting Gemini report a different band would describe content it didn't pick.
  data.gradeBand = factBandKey;

  // Validation: activeRepresentation
  const validReps = ['groups', 'array', 'repeated_addition', 'number_line', 'area_model', 'all'];
  if (!validReps.includes(data.activeRepresentation)) {
    data.activeRepresentation = 'groups';
  }

  // Validation: challenge types (safety net — schema enum handles the eval mode case)
  const validChallengeTypes = ['build', 'connect', 'commutative', 'distributive', 'missing_factor', 'fluency'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Defensive count clamp — Gemini occasionally over-shoots even with an
  // explicit count in the prompt. Trim to instanceCount when over; if under,
  // accept the shorter list (fallback below handles the empty case).
  if (data.challenges.length > instanceCount) {
    data.challenges = data.challenges.slice(0, instanceCount);
  }

  // ── Fallback if empty ──
  // Build a FULL session from the code-owned facts, not a single card: one
  // challenge per fact keeps mastery-over-demo (3-6+ instances) even when the
  // model returns nothing usable.
  if (data.challenges.length === 0) {
    const fallbackType = (evalConstraint?.allowedTypes[0] ?? 'build') as MultiplicationExplorerChallengeType;
    console.log(`[MultiplicationExplorer] No valid challenges — building ${sessionFacts.length} ${fallbackType} fallbacks`);
    data.challenges = sessionFacts.map((f, i) => buildFallbackChallenge(fallbackType, f, i));
  }

  // Ensure representations object has all fields (needed before modality assignment)
  data.representations = {
    equalGroups: data.representations?.equalGroups ?? true,
    array: data.representations?.array ?? true,
    repeatedAddition: data.representations?.repeatedAddition ?? true,
    numberLine: data.representations?.numberLine ?? true,
    areaModel: data.representations?.areaModel ?? true,
  };

  // ── Stamp the code-owned fact + modality onto every challenge ──────────────
  // The prompt ASKED for these facts, but the response is not trusted to carry
  // them: this is the only writer, so what the student is asked, shown and graded
  // on comes from one source. A challenge the model returned beyond the fact pool
  // is dropped rather than given an invented fact.
  {
    const challengeList = (data.challenges as Array<Record<string, unknown>>).slice(0, sessionFacts.length);
    data.challenges = challengeList.map((c, i) => {
      const f = sessionFacts[i];
      const product = f.factor1 * f.factor2;
      return {
        ...c,
        id: String(c.id ?? `c${i + 1}`),
        fact: { factor1: f.factor1, factor2: f.factor2 },
        targetFact: `${f.factor1} × ${f.factor2} = ${product}`,
      };
    });
  }

  // The session `fact` is now only a back-compat default for consumers that
  // predate per-challenge facts; the first challenge's fact is the honest one.
  if (sessionFacts.length > 0) {
    const first = sessionFacts[0];
    data.fact = { factor1: first.factor1, factor2: first.factor2, product: first.factor1 * first.factor2 };
  }

  // Final summary log (modalities are assigned later and logged separately)
  const typeBreakdown = (data.challenges as Array<{ type: string; targetFact: string }>)
    .map((c) => `${c.type}:${c.targetFact.replace(/\s/g, '')}`)
    .join(', ');
  console.log(`[MultiplicationExplorer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Ensure showOptions
  data.showOptions = {
    showProduct: data.showOptions?.showProduct ?? true,
    showFactFamily: data.showOptions?.showFactFamily ?? (data.gradeBand === '3-4'),
    showCommutativeFlip: data.showOptions?.showCommutativeFlip ?? true,
    showDistributiveBreakdown: data.showOptions?.showDistributiveBreakdown ?? (data.gradeBand === '3-4'),
  };

  // Disable number line for large products (>50 looks cramped). Facts now vary per
  // challenge, so the guard is driven by the LARGEST product in the session — the
  // session `fact` is only the first challenge's and would let later facts through.
  const maxSessionProduct = sessionFacts.reduce((m, f) => Math.max(m, f.factor1 * f.factor2), 0);
  if (maxSessionProduct > 50) {
    data.representations.numberLine = false;
  }

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose the fact + words). Withdraws scaffolds as the tier
  // hardens — never alters factor1/factor2/product. Runs AFTER showOptions/reps
  // defaults so a hard tier can withdraw them. Gated ONLY on a tier being present
  // (so blended/auto sessions get difficulty too); each challenge resolves its OWN
  // mode from ch.type. ──
  if (supportTier) {
    const distinctTypes = Array.from(
      new Set(
        (data.challenges as Array<{ type: MultiplicationExplorerChallengeType }>).map((c) => c.type),
      ),
    );
    const hasType = (t: MultiplicationExplorerChallengeType) => distinctTypes.includes(t);

    // showProduct also drives the big fact header AND every per-rep readout — when a
    // challenge's hiddenValue IS the product, showProduct=true is the on-screen ANSWER.
    // So the readout may only be ON when NO challenge in this set hides the product.
    const anyProductHidden = (data.challenges as Array<{ hiddenValue?: string | null }>).some(
      (c) => c.hiddenValue === 'product',
    );

    // Aggregate the per-mode scaffold preferences across the (usually single-mode) set.
    let wantProduct = false;
    let wantCommutativeFlip = false;
    let wantFactFamily = false;
    let wantDistributive = false;
    let coarsestRepSet: SupportScaffold['repSet'] = 'all';
    const repRank: Record<SupportScaffold['repSet'], number> = { all: 0, core: 1, minimal: 2 };

    for (const t of distinctTypes) {
      const sc = resolveSupportStructure(t, supportTier);
      wantProduct = wantProduct || sc.showProduct;
      wantCommutativeFlip = wantCommutativeFlip || sc.showCommutativeFlip;
      wantFactFamily = wantFactFamily || sc.showFactFamily;
      wantDistributive = wantDistributive || sc.showDistributiveBreakdown;
      if (repRank[sc.repSet] > repRank[coarsestRepSet]) coarsestRepSet = sc.repSet;
    }

    // LEAK GUARD: never show the product readout when any challenge's asked value IS
    // the product (build / distributive / fluency, or an LLM-chosen product hide).
    const showProduct = wantProduct && !anyProductHidden;

    data.showOptions = {
      ...data.showOptions,
      showProduct,
      showCommutativeFlip: wantCommutativeFlip,
      showFactFamily: wantFactFamily,
      showDistributiveBreakdown: wantDistributive,
    };

    // Representation withdrawal — NEVER strip all panels (the panels ARE the primitive).
    // 'core' keeps groups + array (+ the mode's signature rep); 'minimal' keeps groups
    // + array only; 'all' leaves the LLM's choice untouched. fluency owns 'minimal'
    // but its representations are irrelevant (bare fact) so this is harmless there.
    if (coarsestRepSet !== 'all') {
      const isCore = coarsestRepSet === 'core';
      data.representations = {
        equalGroups: true, // groups + array are the irreducible core — never stripped.
        array: true,
        repeatedAddition: isCore,
        numberLine: isCore && hasType('missing_factor'),
        areaModel: isCore && hasType('distributive'),
      };
      // Re-apply the large-product number-line guard after the tier reshuffle.
      if (maxSessionProduct > 50) data.representations.numberLine = false;
    }

    // Persist the tier so the live tutor matches what's on screen (set whenever a tier
    // is present, blends included).
    data.supportTier = supportTier;

    console.log(
      `[MultiplicationExplorer] Support tier "${supportTier}" applied per-challenge ` +
        `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → ` +
        `showProduct=${showProduct}${anyProductHidden ? ' (forced off: product is asked value)' : ''}, ` +
        `flip=${wantCommutativeFlip}, factFamily=${wantFactFamily}, distributive=${wantDistributive}, reps=${coarsestRepSet}`,
    );
  }

  // Apply explicit config overrides.
  // NOTE: config.factor1/factor2 are deliberately NOT re-applied to data.fact here.
  // They were honoured up front by narrowing the fact pool in selectFacts, so every
  // challenge already respects the pin. Writing them again would desync data.fact
  // from challenge 1 — the exact split-brain this redesign removes.
  if (config) {
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  // LEAK GUARD (unconditional — covers the UNTIERED default path, not just tiers):
  // `showProduct` drives the big fact header AND every per-rep readout, so it must
  // never be ON when any challenge's asked value IS the product. The tier block above
  // already enforces this for tiered sessions; this final pass closes the no-tier path
  // (where the LLM/default showOptions could otherwise leak e.g. "2 × 5 = 10").
  if (data.showOptions?.showProduct) {
    const productIsAsked = (data.challenges as Array<{ hiddenValue?: string | null }>).some(
      (c) => c.hiddenValue === 'product',
    );
    if (productIsAsked) {
      data.showOptions = { ...data.showOptions, showProduct: false };
    }
  }

  // ── Modality assignment (LAST) ────────────────────────────────────────────
  // Runs after the support tier and config overrides have settled which panels are
  // enabled. Assigning earlier could pin a challenge to a representation the tier
  // then disables, leaving that challenge staring at a tab that no longer exists.
  {
    const enabledReps: ExplorerRepresentation[] = [
      ...(data.representations.equalGroups ? ['groups' as const] : []),
      ...(data.representations.array ? ['array' as const] : []),
      ...(data.representations.repeatedAddition ? ['repeated_addition' as const] : []),
      ...(data.representations.numberLine ? ['number_line' as const] : []),
      ...(data.representations.areaModel ? ['area_model' as const] : []),
    ];
    const list = data.challenges as Array<Record<string, unknown>>;
    const reps = assignRepresentations(
      list.map((c) => String(c.type) as MultiplicationExplorerChallengeType),
      enabledReps,
    );
    data.challenges = list.map((c, i) => ({ ...c, representation: reps[i] }));
    console.log(
      `[MultiplicationExplorer] modalities → `
      + (data.challenges as Array<{ type: string; representation: string }>)
          .map((c) => `${c.type}@${c.representation}`).join(', '),
    );
  }

  return data;
};
