import { Type, Schema } from "@google/genai";
import { PatternBuilderData } from "../../primitives/visual-primitives/math/PatternBuilder";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------

type ChallengeType = 'extend' | 'identify_core' | 'translate' | 'create' | 'find_rule';

const DEFAULT_INSTANCE_COUNT = 6; // tier fallback (extend is largest mode; longer active time than fast-tap → capped at 6)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  extend: 6,
  identify_core: 5,
  translate: 5,
  create: 5,
  find_rule: 5,
};

function resolveCount(mode: ChallengeType | undefined): number {
  const fallback = mode && COUNT_BY_MODE[mode] != null ? COUNT_BY_MODE[mode] : DEFAULT_INSTANCE_COUNT;
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, fallback));
}

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract: config.targetEvalMode says WHICH skill (task identity —
// extend / identify_core / translate / create / find_rule, matched to the objective
// by the manifest); config.difficulty says how much on-workspace SUPPORT the student
// gets while doing it ('easy' = max scaffolding, 'hard' = min). The tier is
// per-component. It NEVER changes the pattern's LENGTH or ELEMENTS — those are the
// eval-mode / grade-band / progression axis. A harder tier toggles reveal of the
// repeating-UNIT boundary and the RULE label, so the student infers the structure
// from the sequence alone. See memory: structural-difficulty-not-numeric.

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

interface SupportScaffold {
  /** Highlight the repeating-unit boundary: rings the core positions in the GIVEN
   *  sequence + shows a "Core: …" label. Display-only — only the visible given
   *  tokens are ringed, NEVER the hidden answer cells, so this can never leak the
   *  answer. Withdrawing it forces the student to find the unit boundary themselves. */
  showCore: boolean;
  /** Reveal the pattern RULE in words (named strategy). Naming the rule hands the
   *  student the strategy; hiding it makes them infer the rule from the sequence. */
  showRule: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge type.
 * easy  = highlight the repeating unit + name the rule (workspace self-checks).
 * medium= highlight the unit, but DON'T name the rule.
 * hard  = no unit highlight, no rule — infer the structure from the sequence alone.
 * The pattern's LENGTH and ELEMENTS never change with the tier — only the cues do.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const showCore = tier !== 'hard';
  const showRule = tier === 'easy';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING only (${tier === 'easy' ? 'maximum support: the repeating unit is highlighted and the rule is named so the workspace helps the student self-check' : tier === 'medium' ? 'moderate support: the repeating unit is highlighted, but the student must name the rule themselves' : 'minimum support: no unit highlight and no rule label — the student infers the repeating structure from the sequence alone'}). Keep the pattern's LENGTH, element set, and number of repetitions exactly as the eval mode and grade band require — a harder tier NEVER changes the pattern itself, only how many cues are revealed.`,
  ];
  switch (pinnedType) {
    case 'extend':
      promptLines.push(
        tier === 'easy'
          ? 'The repeating unit is highlighted and the rule is named; instructions/hints may name the core (e.g. "the part that repeats is red-blue").'
          : tier === 'hard'
            ? 'No unit highlight and no rule label; hints should ask the student what they notice repeating, never naming the core or the next token.'
            : 'The repeating unit is highlighted, but hints should NOT name the rule — ask the student to describe what repeats.',
      );
      break;
    case 'identify_core':
      promptLines.push(
        tier === 'easy'
          ? 'A worked unit boundary is highlighted as a model and the rule is named so the student can confirm where the unit starts over.'
          : tier === 'hard'
            ? 'No boundary highlight and no rule label; the student must segment the sequence and justify where the smallest repeating unit begins.'
            : 'The unit boundary is highlighted as a cue, but the rule is not named — the student confirms the smallest repeating group themselves.',
      );
      break;
    case 'translate':
      promptLines.push(
        tier === 'easy'
          ? 'The source repeating unit is highlighted and the rule is named so the student maps a clearly bounded unit.'
          : tier === 'hard'
            ? 'No unit highlight and no rule label; the student infers the structure of the source pattern before mapping it.'
            : 'The source unit is highlighted, but the rule is not named — the student maps the highlighted unit token-by-token.',
      );
      break;
    case 'find_rule':
      promptLines.push(
        tier === 'easy'
          ? 'The rule is named and the first terms are framed as a worked unit so the student can self-check the step.'
          : tier === 'hard'
            ? 'No rule label and no term highlight; the student must discover the rule from the sequence and justify the next numbers.'
            : 'The first terms are framed as a cue, but the rule is NOT named — the student infers and states the rule themselves.',
      );
      break;
    case 'create':
      promptLines.push(
        tier === 'easy'
          ? 'A model repeating unit is highlighted and a rule is named as an example the student can imitate before building their own.'
          : tier === 'hard'
            ? 'No model unit or rule is shown; the student invents and justifies their own repeating structure unaided.'
            : 'A model unit is highlighted as a starting idea, but no rule is named — the student builds a pattern with a repeat of their own.',
      );
      break;
  }
  return { showCore, showRule, promptLines };
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  extend: {
    promptDoc:
      `"extend": Student places tokens to continue the pattern. Answer = the hidden tokens. `
      + `K-1: AB, AAB, ABB repeating with colors/shapes. 2-3: ABC, growing/number patterns. `
      + `Give 6-8 given tokens showing 2-3 full repetitions, 2-4 hidden tokens. `
      + `Concrete manipulative with full guidance. `
      + `availableTokens MUST include ALL hidden values plus 1-2 distractors.`,
    schemaDescription: "'extend' (continue the pattern)",
  },
  identify_core: {
    promptDoc:
      `"identify_core": Student selects the smallest repeating unit. Answer = the core tokens. `
      + `Show a long sequence (8-12 tokens) with 3+ repetitions. `
      + `K-1: simple AB, AAB cores. 2-3: ABC, AABB cores. `
      + `Pictorial representation with prompts.`,
    schemaDescription: "'identify_core' (find repeating unit)",
  },
  translate: {
    promptDoc:
      `"translate": Student recreates the pattern with different token types. `
      + `Answer = translated sequence. Include translationTarget with mapping. `
      + `E.g., color→shape: red-blue-red-blue becomes circle-square-circle-square. `
      + `Primarily grades 2-3.`,
    schemaDescription: "'translate' (transform representation)",
  },
  create: {
    promptDoc:
      `"create": Student builds their own pattern from available tokens. `
      + `No specific answer required — open-ended. Provide 4-6 token options. `
      + `Primarily grades 2-3. Transitional symbolic/pictorial.`,
    schemaDescription: "'create' (build original pattern)",
  },
  find_rule: {
    promptDoc:
      `"find_rule": Student continues a number/growing pattern by filling in the next values. `
      + `Answer = the hidden tokens (the next numbers in the sequence). `
      + `The instruction should ask the student to figure out the rule and continue the pattern. `
      + `Best for growing/number patterns in grades 2-3. Fully symbolic. `
      + `IMPORTANT: sequence.hidden MUST contain the correct next values. sequence.rule should describe the rule in words. `
      + `availableTokens MUST include ALL hidden values plus 3-5 plausible wrong numbers.`,
    schemaDescription: "'find_rule' (discover underlying rule)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

/**
 * Schema definition for Pattern Builder Data
 *
 * This schema defines the structure for pattern challenges including
 * repeating, growing, and number patterns for K-3 algebraic thinking.
 *
 * The `count` parameter is templated into the challenges array description so
 * Gemini receives an explicit target count rather than the legacy "3-5" range.
 */
function buildPatternBuilderSchema(count: number): Schema {
  return {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the pattern activity (e.g., 'Color Patterns', 'Growing Numbers')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    patternType: {
      type: Type.STRING,
      description: "Pattern type: 'repeating' (AB, AAB, ABC), 'growing' (1,3,5,7), or 'number' (skip counting, function rules)"
    },
    sequence: {
      type: Type.OBJECT,
      properties: {
        given: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Tokens shown to the student (the visible part of the pattern)"
        },
        hidden: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Tokens the student must fill in to extend the pattern"
        },
        core: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "The repeating unit (for repeating patterns) or first few terms (for growing patterns)"
        },
        rule: {
          type: Type.STRING,
          description: "The pattern rule in words (e.g., 'add 3 each time', 'AB repeating'). Null for simple repeating patterns."
        }
      },
      required: ["given", "hidden", "core"]
    },
    tokens: {
      type: Type.OBJECT,
      properties: {
        available: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Tokens the student can choose from. For colors: 'red','blue','green','yellow','purple','orange','pink'. For shapes: 'circle','square','triangle','star','diamond','heart'. For numbers: '1','2','3', etc."
        },
        type: {
          type: Type.STRING,
          description: "Token type: 'colors', 'shapes', 'numbers', 'emoji', or 'mixed'"
        }
      },
      required: ["available", "type"]
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'extend' (continue the pattern), 'identify_core' (find repeating unit), 'create' (build your own), 'translate' (same structure, different tokens), 'find_rule' (figure out the rule and continue the pattern)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, warm and encouraging"
          },
          answer: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Expected answer tokens (for extend/translate) or core tokens (for identify_core)"
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge (used by the tutor to introduce it)"
          },
          sequence: {
            type: Type.OBJECT,
            properties: {
              given: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Tokens shown to the student for this specific challenge"
              },
              hidden: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Tokens the student must fill in for this challenge (must match 'answer')"
              },
              core: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The minimal repeating unit for this challenge's pattern"
              }
            },
            required: ["given", "hidden", "core"],
            description: "Per-challenge sequence for single-type eval modes. Omit in multi-type mode."
          },
          translationMapping: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING, description: "Source token (e.g. 'red')" },
                target: { type: Type.STRING, description: "Target token (e.g. 'circle')" },
              },
              required: ["source", "target"],
            },
            description: "Per-challenge token mapping pairs for translate challenges in single-type mode (e.g. [{source:'red',target:'circle'}])."
          },
          availableTokens: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Selectable tokens for THIS challenge. MUST include ALL values from this challenge's sequence.hidden (the correct answers) PLUS 3-5 distractor values that are plausible but wrong. For number patterns: include the correct next numbers and nearby wrong numbers. Example: if hidden is ['18'], availableTokens could be ['15','16','17','18','19','20','22']."
          }
        },
        required: ["id", "type", "instruction", "answer", "hint", "narration", "availableTokens"]
      },
      description: `Array of exactly ${count} progressive challenges`
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showCore: {
          type: Type.BOOLEAN,
          description: "Whether to highlight the repeating core unit"
        },
        showStepNumbers: {
          type: Type.BOOLEAN,
          description: "Whether to show position numbers (useful for growing patterns)"
        },
        showRule: {
          type: Type.BOOLEAN,
          description: "Whether to reveal the rule after completion"
        },
        audioMode: {
          type: Type.BOOLEAN,
          description: "Whether to play the pattern as sounds"
        }
      },
      required: ["showCore", "showStepNumbers", "showRule", "audioMode"]
    },
    translationTarget: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether a translation challenge is included"
        },
        sourceType: {
          type: Type.STRING,
          description: "Source token type (e.g., 'colors')"
        },
        targetType: {
          type: Type.STRING,
          description: "Target token type (e.g., 'shapes')"
        },
        mapping: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING, description: "Source token (e.g., 'red')" },
              to: { type: Type.STRING, description: "Target token (e.g., 'circle')" }
            },
            required: ["from", "to"]
          },
          description: "Array of source-to-target token mappings (e.g., [{from:'red',to:'circle'},{from:'blue',to:'square'}])"
        }
      },
      required: ["enabled"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K-1' for Kindergarten-Grade 1, '2-3' for Grades 2-3"
    }
  },
    required: ["title", "description", "patternType", "sequence", "tokens", "challenges", "showOptions", "gradeBand"]
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate pattern builder data for interactive pattern activities
 *
 * This function creates pattern challenges including:
 * - Extend: Continue a given pattern (AB → AB??)
 * - Identify Core: Find the repeating unit in a long pattern
 * - Create: Build an original pattern
 * - Translate: Convert a pattern to a different representation
 * - Find Rule: Describe the rule of a growing/number pattern
 *
 * Grade-aware content:
 * - K-1: AB, AAB, ABB repeating patterns with colors/shapes. Extend and identify only.
 * - 2-3: ABC, AABB, growing patterns with numbers. Create, translate, find_rule challenges.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PatternBuilderData with complete configuration
 */
type PatternBuilderConfig = {
    patternType?: 'repeating' | 'growing' | 'number';
    gradeBand?: 'K-1' | '2-3';
    challengeTypes?: string[];
    tokenType?: string;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes the
     * pattern's length or elements — only how many cues (unit highlight, rule) show.
     */
    difficulty?: string;
};

export const generatePatternBuilder = async (
  ctx: GenerationContext,
): Promise<PatternBuilderData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as PatternBuilderConfig;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'pattern-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Resolve per-mode instance count ──
  // When a single-type eval mode is active, use that mode's COUNT_BY_MODE entry.
  // Otherwise fall back to DEFAULT_INSTANCE_COUNT.
  const singleMode = (evalConstraint && evalConstraint.allowedTypes.length === 1
    ? (evalConstraint.allowedTypes[0] as ChallengeType)
    : undefined);
  const count = resolveCount(singleMode);

  // ── Resolve the support tier (config.difficulty) ──
  // supportTier is the STUDENT's tier and DRIVES the per-challenge application below.
  // pinnedType (singleMode) is ONLY for the prompt tone — a blended session has no
  // single mode to describe to the LLM, but it still gets the tier applied per challenge.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType = singleMode;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT pattern length/elements)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build mode-constrained schema ──
  const baseSchema = buildPatternBuilderSchema(count);
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Mode-aware requirements: single-type eval modes get focused instructions
  const requirementsSection = evalConstraint && evalConstraint.allowedTypes.length === 1
    ? `REQUIREMENTS (${evalConstraint.allowedTypes[0].toUpperCase()}-ONLY MODE):
1. Generate exactly ${count} challenges, ALL of type '${evalConstraint.allowedTypes[0]}'
2. Each challenge MUST include its own 'sequence' field with DIFFERENT given/hidden/core arrays
3. Progress in difficulty across challenges (each challenge has a DIFFERENT pattern). Use this progression — start simple and ratchet up:
   - For 'extend': simple AB core (e.g. R,B,R,B → R,B hidden) → AAB or ABB → ABC → AABB → longer cores (ABCD or AABBC)
   - For 'translate': simple AB color→shape mapping → AAB pattern → ABC or color→letter → AABB → mixed-type translations
   - For 'identify_core': obvious AB sequence → AAB → AABB → ABC → longer cores (ABCD)
   - For 'find_rule': simple +N rule → larger step or subtraction → ×N (multiplicative) → two-step rules (×N then +M)
   NOTE: pick a number of challenges that fits the progression and the available difficulty levels for the type — don't repeat the same difficulty tier twice.
4. For 'extend' AND 'find_rule' challenges: the challenge's 'answer' MUST match that challenge's sequence.hidden token-for-token
5. For 'translate' challenges: include 'translationMapping' as [{source:'red',target:'circle'}, ...] pairs for that challenge's tokens; 'answer' = the translated version of that challenge's sequence.given
6. The top-level 'sequence' field should equal the first challenge's sequence
7. CRITICAL — each challenge's 'availableTokens' MUST include ALL values from that challenge's sequence.hidden PLUS 3-5 plausible distractors. For number patterns, include nearby wrong numbers.
8. Each challenge's sequence.given must show the pattern with at least 2 full repetitions of its core
9. Hints must guide thinking WITHOUT revealing the answer — do NOT state the answer tokens
10. Use warm, encouraging language appropriate for young children
11. Include narration text for the AI tutor`
    : `REQUIREMENTS:
1. Generate exactly ${count} challenges that progress in difficulty
2. Start with extend challenges, then move to identify_core, then create/translate
3. The 'given' sequence must clearly show the pattern (at least 2 full repetitions)
4. The 'hidden' sequence must be the natural continuation
5. The 'core' array must be the minimal repeating unit
6. For growing patterns, include a clear 'rule' string
7. CRITICAL — each challenge's 'availableTokens' MUST include ALL values from that challenge's sequence.hidden (or the top-level sequence.hidden if no per-challenge sequence) PLUS 3-5 plausible distractors
8. Use warm, encouraging instruction text appropriate for young children
9. Include meaningful hints that guide without giving away the answer
10. Include narration text the AI tutor can use
11. For translate challenges, include a translationTarget with mapping`;

  const prompt = `
Create an educational pattern building activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Pattern recognition is a foundational algebraic thinking skill
- Students progress from recognizing to extending to creating patterns
- Repeating patterns have a core unit that repeats (e.g., AB, AAB, ABC)
- Growing patterns increase by a rule (e.g., +2, +3, ×2)
- Number patterns connect to skip counting and multiplication

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Kindergarten to Grade 1 (gradeBand "K-1"):
  * Use 2-element repeating patterns: AB, AAB, ABB
  * Token type should be 'colors' or 'shapes' (NOT numbers)
  * Use bright, simple tokens: red, blue, green, yellow, circle, square, triangle, star
  * Challenges: 'extend' and 'identify_core' ONLY
  * Give 6-8 given tokens showing 2-3 full repetitions, 2-4 hidden tokens
  * Simple, warm language: "What comes next?" "Can you find the part that repeats?"
  * showCore: false initially (let them discover it)
  * showStepNumbers: false (not needed for repeating patterns)
  * Do NOT include translate or create or find_rule challenges for K-1

- Grades 2-3 (gradeBand "2-3"):
  * Use ABC, AABB, or growing patterns
  * Can use numbers, mixed tokens, or colors/shapes
  * Growing patterns: sequences like 2, 4, 6, 8 or 1, 4, 7, 10
  * Include 'extend', 'identify_core', 'create', 'translate', or 'find_rule' challenges
  * For growing patterns: give 4-6 given numbers, 2-3 hidden numbers
  * Connect to skip counting and multiplication
  * showStepNumbers: true for growing patterns
  * showRule: true (reveal after completion)
  * Can include translation challenges (color→shape or shape→number)
` : ''}

TOKEN TYPES:
- Colors: red, blue, green, yellow, purple, orange, pink
- Shapes: circle, square, triangle, star, diamond, heart
- Numbers: use actual number strings like "1", "2", "3"
- The 'available' array should include all tokens the student needs PLUS 1-2 distractors

${(() => {
  const hints: string[] = [];
  if (config?.patternType) hints.push(`- Pattern type: ${config.patternType}`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types to include: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.tokenType) hints.push(`- Token type: ${config.tokenType}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

${requirementsSection}

Return the complete pattern builder configuration.
`;

  logEvalModeResolution('PatternBuilder', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid pattern builder data returned from Gemini API');
  }

  // Validation: ensure patternType is valid
  const validTypes = ['repeating', 'growing', 'number'];
  if (!validTypes.includes(data.patternType)) {
    data.patternType = 'repeating';
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K-1' && data.gradeBand !== '2-3') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') || gradeLevel.toLowerCase().includes('grade 1') ? 'K-1' : '2-3';
  }

  // K-1 should not have growing or number patterns
  if (data.gradeBand === 'K-1' && data.patternType !== 'repeating') {
    data.patternType = 'repeating';
  }

  // Ensure sequence has required fields
  if (!data.sequence) {
    data.sequence = { given: ['red', 'blue', 'red', 'blue'], hidden: ['red', 'blue'], core: ['red', 'blue'], rule: null };
  }
  if (!Array.isArray(data.sequence.given)) data.sequence.given = ['red', 'blue', 'red', 'blue'];
  if (!Array.isArray(data.sequence.hidden)) data.sequence.hidden = ['red', 'blue'];
  if (!Array.isArray(data.sequence.core)) data.sequence.core = ['red', 'blue'];

  // Ensure tokens has required fields
  if (!data.tokens) {
    data.tokens = { available: ['red', 'blue', 'green'], type: 'colors' };
  }
  if (!Array.isArray(data.tokens.available) || data.tokens.available.length === 0) {
    data.tokens.available = Array.from(new Set([...data.sequence.given, ...data.sequence.hidden]));
  }

  // Ensure challenges have valid types (safety net — schema enum handles eval mode case)
  const validChallengeTypes = ['extend', 'identify_core', 'create', 'translate', 'find_rule'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Clamp to the resolved per-mode count so Gemini overproduction doesn't bloat the session.
  if (Array.isArray(data.challenges) && data.challenges.length > count) {
    data.challenges = data.challenges.slice(0, count);
  }

  // Normalize challenge answers and ensure per-challenge availableTokens include correct answers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.challenges = data.challenges.map((c: any) => {
    const hidden = Array.isArray(c.sequence?.hidden) && c.sequence.hidden.length > 0
      ? c.sequence.hidden
      : data.sequence.hidden;

    // For extend/find_rule: answer must match hidden tokens
    if (c.type === 'extend' || c.type === 'find_rule') {
      if (Array.isArray(hidden) && hidden.length > 0) {
        c = { ...c, answer: [...hidden] };
      }
    }

    // Safety net: ensure availableTokens includes all hidden values for this challenge
    const tokens: string[] = Array.isArray(c.availableTokens) ? [...c.availableTokens] : [...data.tokens.available];
    if (Array.isArray(hidden)) {
      hidden.forEach((h: string) => {
        if (!tokens.includes(h)) tokens.push(h);
      });
    }
    return { ...c, availableTokens: tokens };
  });

  // Ensure at least one challenge (use eval constraint fallback type)
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'extend';
    const fallbackTokens = Array.from(new Set([...data.tokens.available, ...data.sequence.hidden]));
    const fallbacks: Record<string, { type: string; instruction: string; answer: string[]; hint: string; narration: string; availableTokens: string[] }> = {
      extend: {
        type: 'extend',
        instruction: 'What comes next in this pattern?',
        answer: data.sequence.hidden,
        hint: 'Look at the colors. What repeats?',
        narration: "Let's figure out what comes next in this pattern!",
        availableTokens: fallbackTokens,
      },
      identify_core: {
        type: 'identify_core',
        instruction: 'Can you find the part that keeps repeating?',
        answer: data.sequence.core,
        hint: 'Look for the smallest group that starts over.',
        narration: "Every pattern has a core — the part that repeats. Can you find it?",
        availableTokens: fallbackTokens,
      },
      translate: {
        type: 'translate',
        instruction: 'Can you make the same pattern using shapes instead?',
        answer: data.sequence.given.slice(0, 4),
        hint: 'The structure stays the same — just swap each token.',
        narration: "Let's transform this pattern into a new form!",
        availableTokens: fallbackTokens,
      },
      create: {
        type: 'create',
        instruction: 'Create your own pattern using the tokens below!',
        answer: [],
        hint: 'Pick 2-3 tokens and repeat them in a pattern.',
        narration: "Now it's your turn to be the pattern maker!",
        availableTokens: fallbackTokens,
      },
      find_rule: {
        type: 'find_rule',
        instruction: 'Figure out the rule and continue the pattern!',
        answer: data.sequence.hidden,
        hint: 'How does each number change to get the next one?',
        narration: "Can you figure out the secret rule and fill in the next numbers?",
        availableTokens: fallbackTokens,
      },
    };
    console.log(`[PatternBuilder] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...(fallbacks[fallbackType] ?? fallbacks.extend) }];
  }

  // Ensure showOptions
  if (!data.showOptions) {
    data.showOptions = {
      showCore: false,
      showStepNumbers: data.patternType !== 'repeating',
      showRule: data.patternType !== 'repeating',
      audioMode: false,
    };
  }

  // Convert translationTarget.mapping from array format [{from,to}] to Record<string,string>
  if (data.translationTarget?.mapping && Array.isArray(data.translationTarget.mapping)) {
    const mappingObj: Record<string, string> = {};
    for (const entry of data.translationTarget.mapping) {
      if (entry.from && entry.to) {
        mappingObj[entry.from] = entry.to;
      }
    }
    data.translationTarget.mapping = mappingObj;
  }

  // Convert per-challenge translationMapping from array [{source,target}] to Record<string,string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.challenges = data.challenges.map((c: any) => {
    if (c.type === 'translate' && Array.isArray(c.translationMapping)) {
      const mappingObj: Record<string, string> = {};
      for (const entry of c.translationMapping) {
        if (entry.source && entry.target) {
          mappingObj[entry.source] = entry.target;
        }
      }
      return { ...c, translationMapping: mappingObj };
    }
    return c;
  });

  // Apply explicit config overrides
  if (config) {
    if (config.patternType !== undefined) data.patternType = config.patternType;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  // ── Apply the support tier deterministically (per challenge) ──
  // Difficulty is a STUDENT property: a blended/auto session gets it too — single-mode
  // just happens to give every challenge the same scaffold. We resolve each challenge's
  // scaffold from its OWN type, then drive the (global) showOptions cues and stamp
  // `supportTier` on every challenge so the live tutor calibrates its reveal level.
  // Display-only: showCore rings only the visible GIVEN core tokens (never the hidden
  // answer cells) and the checkers read sequence.hidden/core independent of these flags,
  // so withdrawing/adding cues can never leak or invalidate the answer.
  if (supportTier) {
    if (!data.showOptions) data.showOptions = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chs = data.challenges as any[];
    data.challenges = chs.map((c) => ({ ...c, supportTier }));
    // showOptions is a single global object; drive it from the tier. All challenges
    // in a session share the same tier, and showCore/showRule are tier-determined
    // (identical across modes), so a representative scaffold from the first challenge
    // is correct for the whole session.
    const repType = (chs[0]?.type as ChallengeType) ?? 'extend';
    const repScaffold = resolveSupportStructure(repType, supportTier);
    data.showOptions.showCore = repScaffold.showCore;
    data.showOptions.showRule = repScaffold.showRule;
    console.log(
      `[PatternBuilder] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → showCore=${data.showOptions.showCore}, showRule=${data.showOptions.showRule}`,
    );
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c) => c.type).join(', ');
  console.log(`[PatternBuilder] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
