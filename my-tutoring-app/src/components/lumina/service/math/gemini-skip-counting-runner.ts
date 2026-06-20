import { Type, Schema } from "@google/genai";
import { SkipCountingRunnerData } from "../../primitives/visual-primitives/math/SkipCountingRunner";
import { ai } from "../geminiClient";
import { createDiscretePool } from "./numberPoolService";
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

type ChallengeType = 'count_along' | 'predict' | 'fill_missing' | 'find_skip_value' | 'connect_multiplication';

const DEFAULT_INSTANCE_COUNT = 6; // tier fallback (per-challenge active time longer than pure fast-tap)
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  count_along: 6,        // B2 bump (was 3-5)
  predict: 6,            // B2 bump (was 3-5)
  fill_missing: 6,       // B2 bump (was 3-5)
  find_skip_value: 5,    // hold at current upper-end of 3-5 range
  connect_multiplication: 5, // hold at current upper-end of 3-5 range
};

function resolveCount(
  type: ChallengeType | undefined,
  override?: number,
): number {
  const fallback = type ? (COUNT_BY_MODE[type] ?? DEFAULT_INSTANCE_COUNT) : DEFAULT_INSTANCE_COUNT;
  return Math.max(1, Math.min(MAX_INSTANCE_COUNT, override ?? fallback));
}

// ---------------------------------------------------------------------------
// Skip-value entropy — a shuffled pool in the PROMPT, topic stays authoritative
// ---------------------------------------------------------------------------
// skipValue is the LEARNING TARGET (the objective literally IS "count by Ns"),
// so it is never pooled from a contiguous numeric band (that is the "Counting to
// 10" regression). But Gemini's structured output is convergent — with no entropy
// in the prompt it collapses every open objective onto 2/5. The fix is to inject
// a SHUFFLED pool of the grade-band-LEGAL intervals into the prompt and let the
// LLM decide, with the TOPIC authoritative over the pool. The candidate set IS
// the grade-band scope, so a pick can never teach past the objective; the shuffle
// is the entropy; the LLM reads the topic natively (no brittle regex, no post-LLM
// pin). See memory: schema-over-regex-and-prompt / structural-difficulty-not-numeric.

const GRADE_BAND_SKIP_VALUES: Record<'1-2' | '2-3', readonly number[]> = {
  '1-2': [2, 5, 10],
  '2-3': [2, 3, 4, 5, 10],
};

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  count_along: {
    promptDoc:
      `"count_along": Character jumps automatically, student watches and counts along. `
      + `startPosition = startFrom (e.g. 0). Use autoPlay: true. `
      + `Concrete — full guidance, rhythmic counting with visual support. `
      + `Narration should count rhythmically: "5... 10... 15..."`,
    schemaDescription: "'count_along' (follow skip-count sequence)",
  },
  predict: {
    promptDoc:
      `"predict": Student guesses the NEXT landing after startPosition. `
      + `Set startPosition to a position partway along the sequence. `
      + `Example: skip by 4, startPosition=16 → student must answer 20. `
      + `Instruction MUST match startPosition: "The rabbit is at 16. Where is the next landing?" `
      + `Pictorial with prompts — anticipate next value.`,
    schemaDescription: "'predict' (anticipate next value)",
  },
  fill_missing: {
    promptDoc:
      `"fill_missing": Some positions are hidden, student types the missing numbers. `
      + `startPosition = startFrom. Set hiddenPositions array with the positions to hide. `
      + `Pictorial with reduced prompts — complete missing terms in the sequence.`,
    schemaDescription: "'fill_missing' (complete missing terms)",
  },
  find_skip_value: {
    promptDoc:
      `"find_skip_value": Student identifies the skip amount from a displayed sequence. `
      + `startPosition = startFrom. Show several jumps and ask "How much is each jump?" `
      + `Transitional — discover the skip interval from the pattern.`,
    schemaDescription: "'find_skip_value' (discover the skip interval)",
  },
  connect_multiplication: {
    promptDoc:
      `"connect_multiplication": Student states the multiplication fact for the full journey up to startPosition. `
      + `Example: skip by 4, startPosition=28 → show 7 jumps → student answers "7 × 4 = 28". `
      + `Set targetFact to the multiplication fact string. `
      + `Instruction MUST reference startPosition. `
      + `Symbolic — link skip counting to multiplication facts.`,
    schemaDescription: "'connect_multiplication' (link to multiplication facts)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as ten-frame / counting-board): config.targetEvalMode
// says WHICH skill (task identity, matched to the objective by the manifest);
// config.difficulty says how much on-workspace SUPPORT the student gets while doing
// it ('easy' = max scaffolding, 'hard' = min). It NEVER changes skipValue / startFrom /
// endAt magnitude — the per-mode count table + grade band own those. A harder tier
// means LESS help tracking the count, never a bigger skip value or longer track.
// See memory: structural-difficulty-not-numeric.

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
  /** Arc trails over each jump — the strongest visual "how far is one jump" cue. */
  showJumpArcs: boolean;
  /** Multiplication equation (jumpCount × skipValue = position). Computes the
   *  answer for connect_multiplication, so it MUST be off at hard for that mode. */
  showEquation: boolean;
  /** Parallel array model (rows × skipValue) — concrete CPA support. */
  showArray: boolean;
  /** Ones-digit pattern readout (5,0,5,0…) — perception aid. */
  showDigitPattern: boolean;
  /** Auto-advance the jumps (watch mode). EASY-ONLY: it flips the interaction
   *  from watch to tap, so it is never on at medium/hard. */
  autoPlay: boolean;
  /** Numeric labels under the number-line ticks (prior landings). */
  showTrackLabels: boolean;
  /** Bottom sequence-chip row + "→ ?" next cue (written running record). */
  showSequenceChips: boolean;
  /** "Count by Ns" header badge AND the "+N" in the Jump button. LEAK GUARD:
   *  for find_skip_value / predict the skip value is the ANSWER, so this is off
   *  at hard for those modes (gates BOTH surfaces, not just track labels). */
  showSkipValueBadge: boolean;
  /** Structural lever for fill_missing: how many positions to hide (1 → 2 → 3).
   *  Code-enforced as valid multiples within [startFrom, endAt]. null = N/A. */
  hiddenCount: number | null;
  /** Instruction-as-scaffold hint explicitness ('explicit' → 'minimal'). */
  hintExplicitness: 'explicit' | 'guided' | 'minimal';
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with less scaffolding — never a different task, never bigger numbers.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  const easy = tier === 'easy';
  const hard = tier === 'hard';

  // Shared defaults; per-mode switch overrides where a lever is the answer or N/A.
  let showJumpArcs = !hard;
  let showEquation = easy; // off by medium for most modes
  let showArray = easy;
  let showDigitPattern = easy;
  const autoPlay = false; // mode-specific; only count_along easy turns it on
  let showTrackLabels = !hard;
  let showSequenceChips = !hard;
  let showSkipValueBadge = true;
  let hiddenCount: number | null = null;
  const hintExplicitness: SupportScaffold['hintExplicitness'] =
    easy ? 'explicit' : hard ? 'minimal' : 'guided';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING only (${
      easy
        ? 'maximum support: arcs, labels, and aids help the student track and self-check'
        : hard
          ? 'minimum support: the student tracks the sequence unaided and justifies the pattern'
          : 'moderate support: the student tracks the count themselves with a few aids'
    }). Keep skipValue, startFrom, and endAt EXACTLY in pedagogical scope; a harder tier NEVER means a bigger skip value or a longer track, only less on-screen help.`,
  ];

  switch (pinnedType) {
    case 'count_along':
      // easy: autoPlay watch + all aids; medium: student taps, arcs on, eq/array off;
      // hard: student taps, arcs off, only landing ticks, minimal labels.
      promptLines.push(
        easy
          ? 'Use autoPlay so the character demonstrates the rhythm; show arcs, the equation, the array, and digit pattern with all track labels and the sequence chips so the count is fully supported.'
          : hard
            ? 'The student taps each jump with NO arcs and only the landing ticks (numeric track labels withdrawn); narration counts rhythmically but the workspace gives minimal written support.'
            : 'The student taps each jump; keep the jump arcs but withdraw the equation and array so they track the count themselves.',
      );
      // autoPlay is the watch/tap lever — easy only.
      return {
        showJumpArcs: !hard,
        showEquation: easy,
        showArray: easy,
        showDigitPattern: easy,
        autoPlay: easy,
        showTrackLabels: !hard,
        showSequenceChips: !hard,
        showSkipValueBadge: true,
        hiddenCount: null,
        hintExplicitness,
        promptLines,
      };

    case 'predict':
      // arcs on except hard; prior landing labels thin as tier hardens; at hard the
      // skip-value cue is suppressed (it would hand the +N answer).
      showJumpArcs = !hard;
      showTrackLabels = !hard;        // hard hides prior landing labels
      showSequenceChips = !hard;
      showSkipValueBadge = !hard;     // LEAK GUARD: +N is the answer at predict
      showEquation = false;
      showArray = false;
      showDigitPattern = easy;
      promptLines.push(
        easy
          ? 'Show arcs and label prior landings; hints may give an early "+N" cue and name what to add. The next-landing cue is visible.'
          : hard
            ? 'Hide the prior-landing labels and the arcs; SUPPRESS the skip-value cue (do not show "+N") — the student must infer how much the number grows. Hints ask what changes from one landing to the next, never naming the amount.'
            : 'Show arcs with fewer prior-landing labels; offer a hint only after a couple of tries.',
      );
      break;

    case 'fill_missing':
      // structural lever: hide 1 → 2 → 3 positions; arcs withdrawn at hard;
      // neighbor labels thinned at hard.
      showJumpArcs = !hard;
      showTrackLabels = !hard;        // hard thins the neighbor labels
      showSequenceChips = !hard;
      showEquation = false;
      showArray = false;
      showDigitPattern = easy;
      hiddenCount = easy ? 1 : hard ? 3 : 2;
      promptLines.push(
        easy
          ? 'Hide exactly ONE position with both neighbors labeled and the arcs on, so the gap is easy to bridge.'
          : hard
            ? 'Hide THREE positions (a larger structural gap), turn the arcs off, and thin the neighbor labels so the student reconstructs more of the sequence unaided.'
            : 'Hide TWO positions with the arcs on so the student bridges a slightly larger gap.',
      );
      break;

    case 'find_skip_value':
      // The skip value IS the answer → suppress the badge/button cue at hard.
      showJumpArcs = !hard;
      showEquation = easy;            // equation reveals the multiplier — easy only
      showArray = easy;
      showDigitPattern = easy;
      showTrackLabels = true;         // labels are the DATA they reason from — keep on
      showSequenceChips = true;
      showSkipValueBadge = !hard;     // LEAK GUARD: badge/button names the answer
      promptLines.push(
        easy
          ? 'Show 4-5 jumps with all landing labels, the arcs, and the equation so the constant interval is easy to read off.'
          : hard
            ? 'Show only 2-3 jumps; SUPPRESS the skip-value badge and the "+N" button cue (they would reveal the answer). The student must compute the interval from the labels alone.'
            : 'Show about 3 jumps with the arcs on but the equation off.',
      );
      break;

    case 'connect_multiplication':
      // equation + array fade; at hard equation is HIDDEN (it computes the product).
      showJumpArcs = !hard;
      showArray = easy;               // array off by medium
      showEquation = !hard;           // HARD: equation off — it is the answer
      showDigitPattern = easy;
      showTrackLabels = !hard;
      showSequenceChips = !hard;
      promptLines.push(
        easy
          ? 'Show the equation and the array alongside the arcs so the jump-count → multiplication link is explicit.'
          : hard
            ? 'Turn OFF the array AND the equation and hide the prior-landing labels — the student must infer the jump count and state the multiplication fact unaided (the equation would compute the answer).'
            : 'Keep the arcs but turn the array off; the student reads the jump count themselves.',
      );
      break;
  }

  return {
    showJumpArcs,
    showEquation,
    showArray,
    showDigitPattern,
    autoPlay,
    showTrackLabels,
    showSequenceChips,
    showSkipValueBadge,
    hiddenCount,
    hintExplicitness,
    promptLines,
  };
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types) — count is templated at build time
// ---------------------------------------------------------------------------

function buildSkipCountingRunnerSchema(count: number): Schema {
  return {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the skip counting activity (e.g., 'Jump by 5s!', 'Frog Leaps by 3s')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    skipValue: {
      type: Type.NUMBER,
      description: "The skip counting value (2, 3, 4, 5, 10, etc.)"
    },
    startFrom: {
      type: Type.NUMBER,
      description: "Starting number on the number line (default 0)"
    },
    endAt: {
      type: Type.NUMBER,
      description: "Ending number on the number line (e.g., 30, 50, 100)"
    },
    direction: {
      type: Type.STRING,
      description: "Counting direction: 'forward' (default) or 'backward' (division preview for grade 3)"
    },
    character: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "Character type: 'frog', 'kangaroo', 'rabbit', 'rocket', or 'custom'"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Optional image prompt describing the character"
        }
      },
      required: ["type"]
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
            description: "Challenge type: 'count_along' (follow skip-count sequence), 'predict' (anticipate next value), 'fill_missing' (complete missing terms), 'find_skip_value' (discover the skip interval), 'connect_multiplication' (link to multiplication facts)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction text, rhythmic and encouraging"
          },
          hiddenPositions: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Positions where labels are hidden for prediction/fill challenges"
          },
          targetFact: {
            type: Type.STRING,
            description: "The multiplication fact to discover (e.g., '4 × 5 = 20'). Only for connect_multiplication type."
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge"
          },
          startPosition: {
            type: Type.NUMBER,
            description: "The position the character should be at when this challenge starts. REQUIRED for predict (the position the student predicts FROM, e.g. 16 means 'what comes after 16?') and connect_multiplication (the target position showing the full journey, e.g. 28 means show jumps from 0 to 28). Must be a multiple of skipValue from startFrom."
          }
        },
        required: ["id", "type", "instruction", "hint", "narration"]
      },
      description: `Array of exactly ${count} progressive challenges`
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showArray: {
          type: Type.BOOLEAN,
          description: "Show parallel array visualization (rows x skip value)"
        },
        showJumpArcs: {
          type: Type.BOOLEAN,
          description: "Show arc trails for each jump"
        },
        showEquation: {
          type: Type.BOOLEAN,
          description: "Show the multiplication equation (n x skipValue = position)"
        },
        showDigitPattern: {
          type: Type.BOOLEAN,
          description: "Highlight patterns in ones digits (e.g., 5,0,5,0 for 5s)"
        },
        autoPlay: {
          type: Type.BOOLEAN,
          description: "Character jumps automatically (for watch phase)"
        }
      },
      required: ["showArray", "showJumpArcs", "showEquation", "showDigitPattern", "autoPlay"]
    },
    gameMode: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether game mode is active"
        },
        type: {
          type: Type.STRING,
          description: "Game type: 'catch_the_number', 'fill_the_gaps', 'speed_count'"
        },
        timeLimit: {
          type: Type.NUMBER,
          description: "Time limit in seconds (null for no limit)"
        }
      },
      required: ["enabled"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '1-2' for Grades 1-2, '2-3' for Grades 2-3"
    }
  },
  required: ["title", "description", "skipValue", "startFrom", "endAt", "direction", "character", "challenges", "showOptions", "gradeBand"]
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateSkipCountingRunner = async (
  topic: string,
  gradeLevel: string,
  config?: {
    skipValue?: number;
    gradeBand?: '1-2' | '2-3';
    direction?: 'forward' | 'backward';
    challengeTypes?: string[];
    characterType?: string;
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-workspace scaffolding within it. NEVER changes
     * skipValue / startFrom / endAt magnitude — only labels, aids, and the
     * fill_missing gap count.
     */
    difficulty?: string;
    /** Intent or title from the manifest item. */
    intent?: string;
    /** Override for instance count (clamped to [1, MAX_INSTANCE_COUNT]). Falls back to COUNT_BY_MODE table. */
    instanceCount?: number;
  }
): Promise<SkipCountingRunnerData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'skip-counting-runner',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // For config.challengeTypes without an eval mode, use them as a hint
  const effectiveChallengeTypes = evalConstraint?.allowedTypes ?? config?.challengeTypes;

  // ── Resolve per-mode instance count (PRD_WITHIN_MODE_INSTANCE_DENSITY §5a) ──
  // When constrained to a single eval mode, look up its tier count.
  // Mixed-mode sessions (no eval mode) fall back to DEFAULT_INSTANCE_COUNT.
  const singleMode = evalConstraint?.allowedTypes.length === 1
    ? (evalConstraint.allowedTypes[0] as ChallengeType)
    : undefined;
  const targetCount = resolveCount(singleMode, config?.instanceCount);

  // ── Within-mode support tier ──
  // supportTier is the STUDENT's tier — it DRIVES the deterministic application
  // below (per challenge, from each challenge's own mode). pinnedType is ONLY for
  // the prompt tone (describes one mode to the LLM for title/instruction voice).
  const pinnedType = singleMode;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Skip-value entropy pool (prompt-level; topic authoritative) ──
  // Built per call so each independent generation rolls a fresh ordering. Skipped
  // entirely when config explicitly pins skipValue (an explicit pin needs no
  // entropy). Candidate set = the grade-band-legal intervals (== scope).
  const skipBand: '1-2' | '2-3' =
    config?.gradeBand ?? (gradeLevel.toLowerCase().includes('1') ? '1-2' : '2-3');
  const skipPool =
    config?.skipValue === undefined
      ? createDiscretePool(GRADE_BAND_SKIP_VALUES[skipBand])
      : null;
  const skipPoolSection = skipPool
    ? '\n\n' +
      skipPool.toPromptSection({
        label: 'SKIP VALUE POOL',
        noun: 'skip value',
        authoritativeSource: 'the topic',
      })
    : '';

  // ── Build mode-constrained schema (count templated into description) ──
  const baseSchema = buildSkipCountingRunnerSchema(targetCount);
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational skip counting activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Skip counting is the bridge from counting to multiplication
- When a child counts 5, 10, 15, 20, they're doing 5x1, 5x2, 5x3, 5x4
- The number line with animated jumps makes the equal-sized leaps visible
- Arrays built alongside connect to multiplication models

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Grades 1-2 (gradeBand "1-2"):
  * Skip count by 2s, 5s, and 10s ONLY
  * Forward direction only (no backward counting)
  * Start from 0, end at 20-50 depending on skip value
  * Use autoPlay: true for first challenge (count_along)
  * Challenges: 'count_along' and 'predict' only
  * Fun character: frog or kangaroo preferred
  * Rhythmic, simple narration: "5... 10... 15... what comes next?"
  * showArray: false or true for simple cases
  * showEquation: false
  * Do NOT include find_skip_value or connect_multiplication

- Grades 2-3 (gradeBand "2-3"):
  * Skip count by 2s, 3s, 4s, 5s, 10s
  * Can include backward counting (direction: 'backward') for division preview
  * Start from 0 (or higher for backward), end at 30-100
  * Include prediction and multiplication connection challenges
  * Challenges: all types including 'find_skip_value' and 'connect_multiplication'
  * showArray: true (connect to multiplication arrays)
  * showEquation: true
  * showDigitPattern: true for 5s and 10s
` : ''}

STARTPOSITION RULES:
Each challenge has a "startPosition" — the number-line position the character occupies when the challenge begins.
The component builds landing spots from startFrom up to startPosition automatically.
- count_along / fill_missing / find_skip_value: startPosition = startFrom (e.g. 0)
- predict: startPosition = a position partway along the sequence (e.g. 16 for skip-by-4). Instruction MUST reference startPosition.
- connect_multiplication: startPosition = the target product (e.g. 28 for 7×4). Instruction MUST reference startPosition. Include targetFact.

CRITICAL: The position mentioned in the instruction text MUST exactly match startPosition.

CHARACTER TYPES: frog, kangaroo, rabbit, rocket
- Frog: "leaping" by 2s or 3s
- Kangaroo: "hopping" by 5s
- Rabbit: "bouncing" by 2s
- Rocket: "blasting" by 10s

${(() => {
  const hints: string[] = [];
  if (config?.skipValue) hints.push(`- Skip value: ${config.skipValue} — use EXACTLY this; do not pick another interval.`);
  if (config?.gradeBand) hints.push(`- Grade band: ${config.gradeBand}`);
  if (config?.direction) hints.push(`- Direction: ${config.direction}`);
  if (effectiveChallengeTypes) hints.push(`- Challenge types: ${effectiveChallengeTypes.join(', ')}`);
  if (config?.characterType) hints.push(`- Character: ${config.characterType}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}
${skipPoolSection}

REQUIREMENTS:
1. Generate exactly ${targetCount} challenges that progress in difficulty
2. The endAt should be a multiple of skipValue (from startFrom)
3. Use rhythmic, encouraging narration that counts along: "5... 10... 15..."
4. For predict challenges, set hiddenPositions to numbers the student must guess
5. For connect_multiplication, include the targetFact string
6. Include meaningful hints
7. Choose a character that fits the story context
8. EVERY challenge MUST have a startPosition that is a valid multiple of skipValue from startFrom
9. For predict: startPosition should be a few jumps in (not 0), and instruction must reference that position
10. For connect_multiplication: startPosition should be far enough along for a meaningful multiplication fact

Return the complete skip counting runner configuration.
`;

  logEvalModeResolution('SkipCountingRunner', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid skip counting runner data returned from Gemini API');
  }

  // Validation: ensure skipValue is a positive number
  if (!data.skipValue || data.skipValue <= 0) {
    data.skipValue = 5;
  }

  // Validation: ensure direction is valid
  if (data.direction !== 'forward' && data.direction !== 'backward') {
    data.direction = 'forward';
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== '1-2' && data.gradeBand !== '2-3') {
    data.gradeBand = gradeLevel.toLowerCase().includes('1') ? '1-2' : '2-3';
  }

  // Grades 1-2 should not have backward counting
  if (data.gradeBand === '1-2' && data.direction === 'backward') {
    data.direction = 'forward';
  }

  // Grades 1-2 should only use 2, 5, or 10
  if (data.gradeBand === '1-2' && ![2, 5, 10].includes(data.skipValue)) {
    data.skipValue = 5;
  }

  // Ensure startFrom and endAt are numbers
  if (typeof data.startFrom !== 'number') data.startFrom = 0;
  if (typeof data.endAt !== 'number') data.endAt = data.skipValue * 10;

  // Ensure endAt is reachable from startFrom
  if (data.direction === 'forward' && data.endAt <= data.startFrom) {
    data.endAt = data.startFrom + data.skipValue * 10;
  }
  if (data.direction === 'backward' && data.endAt >= data.startFrom) {
    data.endAt = Math.max(0, data.startFrom - data.skipValue * 10);
  }

  // Ensure character
  if (!data.character) {
    data.character = { type: 'frog' };
  }
  const validCharacters = ['frog', 'kangaroo', 'rabbit', 'rocket', 'custom'];
  if (!validCharacters.includes(data.character.type)) {
    data.character.type = 'frog';
  }

  // Ensure challenges have valid types (safety net — schema enum handles the eval mode case)
  const validChallengeTypes = ['count_along', 'predict', 'fill_missing', 'find_skip_value', 'connect_multiplication'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Clamp challenges to targetCount (PRD_WITHIN_MODE_INSTANCE_DENSITY §5a)
  if (data.challenges.length > targetCount) {
    data.challenges = data.challenges.slice(0, targetCount);
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'count_along';
    const sv = data.skipValue;
    const sf = data.startFrom;
    const fallbacks: Record<string, { type: string; instruction: string; hint: string; narration: string; startPosition?: number; hiddenPositions?: number[]; targetFact?: string }> = {
      count_along: { type: 'count_along', instruction: `Watch the ${data.character.type} jump by ${sv}s! Count along!`, hint: `Count by ${sv}s: ${sf}, ${sf + sv}, ${sf + sv * 2}...`, narration: `Let's watch our ${data.character.type} friend jump by ${sv}s! Ready? ${sf}... ${sf + sv}... ${sf + sv * 2}...`, startPosition: sf },
      predict: { type: 'predict', instruction: `The ${data.character.type} is at ${sf + sv * 3}. Where does it land next?`, hint: `Add ${sv} to ${sf + sv * 3}.`, narration: `Can you predict the next landing spot?`, startPosition: sf + sv * 3 },
      fill_missing: { type: 'fill_missing', instruction: `Some numbers are missing! Fill in the blanks.`, hint: `Count by ${sv}s from ${sf}.`, narration: `Oh no, some numbers disappeared! Can you find them?`, startPosition: sf, hiddenPositions: [sf + sv * 2, sf + sv * 4] },
      find_skip_value: { type: 'find_skip_value', instruction: `Look at the jumps. How much is each jump?`, hint: `Find the difference between two neighbors.`, narration: `Can you figure out how far each jump goes?`, startPosition: sf },
      connect_multiplication: { type: 'connect_multiplication', instruction: `The ${data.character.type} made jumps to reach ${sf + sv * 5}. What multiplication fact is that?`, hint: `Count the jumps, then multiply: jumps × ${sv}.`, narration: `Skip counting IS multiplication!`, startPosition: sf + sv * 5, targetFact: `5 × ${sv} = ${sf + sv * 5}` },
    };
    console.log(`[SkipCountingRunner] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'c1', ...fallbacks[fallbackType] ?? fallbacks.count_along }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[SkipCountingRunner] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Ensure showOptions
  if (!data.showOptions) {
    data.showOptions = {
      showArray: data.gradeBand === '2-3',
      showJumpArcs: true,
      showEquation: data.gradeBand === '2-3',
      showDigitPattern: data.skipValue === 5 || data.skipValue === 10,
      autoPlay: false,
    };
  }

  // Ensure gameMode
  if (!data.gameMode) {
    data.gameMode = { enabled: false };
  }

  // Apply explicit config overrides
  if (config) {
    if (config.skipValue !== undefined) data.skipValue = config.skipValue;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.direction !== undefined) data.direction = config.direction;
    if (config.characterType !== undefined) data.character.type = config.characterType;
  }

  // ── Validate / compute startPosition for each challenge ──
  // Build the full sequence of valid positions
  const positions: number[] = [];
  if (data.direction === 'forward') {
    for (let pos = data.startFrom; pos <= data.endAt; pos += data.skipValue) positions.push(pos);
  } else {
    for (let pos = data.startFrom; pos >= data.endAt; pos -= data.skipValue) positions.push(pos);
  }

  const positionSet = new Set(positions);
  let progressIdx = 0; // tracks progression through sequence across challenges

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.challenges.forEach((challenge: any) => {
    // If Gemini provided a valid startPosition, use it
    if (typeof challenge.startPosition === 'number' && positionSet.has(challenge.startPosition)) {
      const idx = positions.indexOf(challenge.startPosition);
      if (idx >= 0) progressIdx = idx;
      return;
    }

    // Try to extract a position from the instruction text (e.g. "is at 16", "landed on 28")
    const posRegex = /(?:at|on|reached|landed on|is at)\s+(\d+)/i;
    const match = challenge.instruction?.match(posRegex);
    if (match) {
      const mentioned = parseInt(match[1], 10);
      if (positionSet.has(mentioned)) {
        challenge.startPosition = mentioned;
        const idx = positions.indexOf(mentioned);
        if (idx >= 0) progressIdx = idx;
        return;
      }
    }

    // For connect_multiplication, try parsing targetFact (e.g. "7 × 4 = 28")
    if (challenge.type === 'connect_multiplication' && challenge.targetFact) {
      const factMatch = challenge.targetFact.match(/=\s*(\d+)/);
      if (factMatch) {
        const product = parseInt(factMatch[1], 10);
        if (positionSet.has(product)) {
          challenge.startPosition = product;
          const idx = positions.indexOf(product);
          if (idx >= 0) progressIdx = idx;
          return;
        }
      }
    }

    // Fallback: compute a reasonable startPosition based on challenge type
    switch (challenge.type) {
      case 'count_along':
      case 'fill_missing':
      case 'find_skip_value':
        challenge.startPosition = data.startFrom;
        progressIdx = 0;
        break;
      case 'predict':
        // Place a few jumps into the sequence so the prediction isn't trivial
        progressIdx = Math.min(Math.max(progressIdx + 2, 3), positions.length - 2);
        if (progressIdx < 0) progressIdx = 0;
        challenge.startPosition = positions[progressIdx];
        break;
      case 'connect_multiplication':
        // Place far enough for a meaningful multiplication fact
        progressIdx = Math.min(Math.max(progressIdx + 3, Math.floor(positions.length * 0.5)), positions.length - 1);
        challenge.startPosition = positions[progressIdx];
        break;
      default:
        challenge.startPosition = data.startFrom;
        break;
    }
  });

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose numbers/character/text). Runs AFTER all
  // structural fixups + startPosition computation so a hard tier can withdraw the
  // already-set scaffolds. Gated ONLY on supportTier being present, and each
  // challenge's scaffold is resolved from its OWN mode (ch.type) so blended/auto
  // sessions get difficulty too. NEVER changes skipValue / startFrom / endAt. ──
  if (supportTier) {
    if (!data.showOptions) {
      data.showOptions = {
        showArray: data.gradeBand === '2-3',
        showJumpArcs: true,
        showEquation: data.gradeBand === '2-3',
        showDigitPattern: data.skipValue === 5 || data.skipValue === 10,
        autoPlay: false,
      };
    }

    // showOptions is a single object shared by all challenges. In a single-mode
    // session every challenge has the same type, so resolve from the pinned type;
    // in a blend, resolve from the FIRST challenge's mode for the shared toggles
    // and let per-challenge structural levers (hiddenCount) key off ch.type below.
    const sharedType = (pinnedType ?? data.challenges[0]?.type ?? 'count_along') as ChallengeType;
    const sharedScaffold = resolveSupportStructure(sharedType, supportTier);

    data.showOptions.showJumpArcs = sharedScaffold.showJumpArcs;
    data.showOptions.showArray = sharedScaffold.showArray;
    data.showOptions.showDigitPattern = sharedScaffold.showDigitPattern;
    data.showOptions.autoPlay = sharedScaffold.autoPlay;
    data.showOptions.showTrackLabels = sharedScaffold.showTrackLabels;
    data.showOptions.showSequenceChips = sharedScaffold.showSequenceChips;
    data.showOptions.showSkipValueBadge = sharedScaffold.showSkipValueBadge;
    // Equation: for connect_multiplication HARD it computes the answer, so it MUST
    // stay off. resolveSupportStructure already encodes showEquation=false at hard
    // for that mode (and easy-only elsewhere); honor it directly.
    data.showOptions.showEquation = sharedScaffold.showEquation;

    // ── Structural lever: fill_missing hidden-position count (1 → 2 → 3). ──
    // Hideable = every sequence multiple EXCEPT startFrom. startFrom is the
    // character's home and is always a landing spot, so checkFillMissing's
    // `!landingSpots.includes(answer)` guard makes it unsolvable if hidden.
    // endAt IS hideable: "what's the final number?" is a valid and LLM-preferred
    // fill_missing instruction. Excluding it desynced the on-screen gap from the
    // instruction (LLM asked for the end → "?" rendered mid-sequence → the correct
    // answer was rejected). Code-enforced so the count is exact regardless of LLM.
    const hideableMultiples = positions.filter((p) => p !== data.startFrom);
    for (const ch of data.challenges as Array<{ type: string; hiddenPositions?: number[] }>) {
      const sc = resolveSupportStructure(ch.type as ChallengeType, supportTier);
      if (ch.type === 'fill_missing' && sc.hiddenCount != null && hideableMultiples.length > 0) {
        const want = Math.min(sc.hiddenCount, hideableMultiples.length);
        // Prefer the LLM's chosen hidden positions if they are valid sequence
        // multiples; the instruction text was authored around them, so honoring
        // them keeps gap and instruction in sync. Top up / trim to the exact tier
        // count, evenly spaced, only when the LLM under-provided.
        const llmValid = (ch.hiddenPositions ?? []).filter((p) => hideableMultiples.includes(p));
        const chosen = new Set<number>(llmValid.slice(0, want));
        if (chosen.size < want) {
          // Spread the remaining picks evenly across the hideable multiples.
          const stride = Math.max(1, Math.floor(hideableMultiples.length / want));
          for (let i = 0; i < hideableMultiples.length && chosen.size < want; i += stride) {
            chosen.add(hideableMultiples[i]);
          }
          // Final top-up if striding under-filled.
          for (let i = 0; i < hideableMultiples.length && chosen.size < want; i++) {
            chosen.add(hideableMultiples[i]);
          }
        }
        ch.hiddenPositions = Array.from(chosen).sort((a, b) => a - b);
      }
    }

    // Persist the tier so the live tutor's reveal policy matches the on-screen
    // scaffold (component reads data.supportTier → aiPrimitiveData).
    data.supportTier = supportTier;

    console.log(
      `[SkipCountingRunner] Support tier "${supportTier}" applied per-challenge (${
        pinnedType ? `single-mode ${pinnedType}` : 'blended'
      }) → arcs=${data.showOptions.showJumpArcs}, equation=${data.showOptions.showEquation}, array=${data.showOptions.showArray}, trackLabels=${data.showOptions.showTrackLabels}, sequenceChips=${data.showOptions.showSequenceChips}, skipValueBadge=${data.showOptions.showSkipValueBadge}, autoPlay=${data.showOptions.autoPlay}`,
    );
  }

  return data;
};
