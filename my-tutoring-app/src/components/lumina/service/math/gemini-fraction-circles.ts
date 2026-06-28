/**
 * Fraction Circles Generator - Dedicated service for fraction circle challenges
 *
 * Generates multi-type fraction challenges (identify, build, compare, equivalent)
 * for the modernized FractionCircles primitive with interactive challenge phases.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  FractionCirclesData,
  FractionCirclesChallenge,
} from "../../primitives/visual-primitives/math/FractionCircles";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
// ---------------------------------------------------------------------------
// Fraction "dice roll" — code owns the randomness, Gemini owns the pedagogy.
//
// Gemini's structured output converges on the canonical 1/2, 2/3, 3/4 ladder
// every run regardless of temperature, so we roll the fractions in code and feed
// the shuffled candidate set into the prompt. This is the createDiscretePool
// PATTERN specialized to a fraction PAIR — kept LOCAL here (not in the shared
// numberPoolService, which is for scalar numbers) since the shape is bespoke.
//
// The denominator set IS the scope (grade-band-legal: K-2 halves/thirds/fourths,
// 3-5 up to twelfths), so a roll can never exceed the grade ceiling. The topic
// stays authoritative in the prompt, so a named family ("fourths") still wins.
// ---------------------------------------------------------------------------

const GRADE_BAND_DENOMINATORS: Record<'K-2' | '3-5', number[]> = {
  'K-2': [2, 3, 4],
  '3-5': [2, 3, 4, 5, 6, 8, 10, 12],
};

/** Resolve K-2 vs 3-5 from a grade-context string (mirrors the post-process default). */
function resolveGradeBand(gradeContext: string): 'K-2' | '3-5' {
  const lower = gradeContext.toLowerCase();
  return lower.includes('kinder') || lower.includes('k-2') || lower.includes('1st') || lower.includes('2nd')
    ? 'K-2'
    : '3-5';
}

/** Roll a Fisher-Yates–shuffled pool of grade-legal proper fractions (the shuffle
 *  IS the entropy). Skips the trivial shade-all whole. Every grade-legal
 *  denominator is GUARANTEED at least one candidate so a topic/intent that names a
 *  fraction family (e.g. "halves and thirds") always has it available to pick —
 *  the family bias is then steered by the prompt, not regexed out of the prose. */
function rollFractionPool(denominators: number[], count = 9): string[] {
  // One random proper fraction per denominator → guarantees family coverage.
  const covered = denominators.map((d) => `${1 + Math.floor(Math.random() * (d - 1))}/${d}`);
  // The full grade-legal set, shuffled, to fill any remaining slots with variety.
  const all: string[] = [];
  for (const d of denominators) {
    for (let n = 1; n < d; n++) all.push(`${n}/${d}`);
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const pool = [...covered];
  for (const f of all) {
    if (pool.length >= count) break;
    if (!pool.includes(f)) pool.push(f);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(count, denominators.length));
}

/** Build the prompt block that hands Gemini the rolled candidate set. Both the
 *  topic AND the per-instance intent are authoritative for the fraction family. */
function buildFractionPoolSection(gradeContext: string, intent?: string): string {
  const dens = GRADE_BAND_DENOMINATORS[resolveGradeBand(gradeContext)];
  const list = rollFractionPool(dens).join(', ');
  return `
FRACTION POOL (pre-shuffled by the adaptive system for variety):
- Candidate fractions: ${list}
- The topic${intent ? ' AND the lesson intent' : ''} ${intent ? 'are' : 'is'} AUTHORITATIVE for the fraction family: if ${intent ? 'either' : 'it'} names a family (e.g. "halves", "thirds", "tenths and twelfths") or a denominator range, use ONLY those denominators for EVERY challenge (every grade-legal denominator is represented in the pool above, so the named family is always available). You MAY repeat a fraction across challenges to stay on-family — varying the numerator is enough; treat all off-family pool entries as unavailable.
- Only when NO family is named, assign a DIFFERENT fraction from this list to each challenge — do NOT default to 1/2, 2/3, 3/4. Favor VARIED numerators, not just unit fractions.
- For 'compare': choose TWO DIFFERENT, non-equivalent fractions from the pool (the compareFraction too).
- For 'equivalent': pick a base fraction from the pool, then choose equivalentDenominator from the legal denominators so the equivalent has a whole-number numerator.
- Do NOT invent a fraction whose denominator is outside this list.`;
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": A fraction circle is shown with some slices shaded. Student names the fraction (e.g., 3/4). `
      + `K-2: denominators 2-4, warm language. 3-5: denominators 2-12. Concrete manipulative with full guidance.`,
    schemaDescription: "'identify' (name the fraction shown)",
  },
  build: {
    promptDoc:
      `"build": Student is given a fraction and must shade the correct number of slices on the circle. `
      + `K-2: simple fractions (halves, thirds, fourths). 3-5: larger denominators up to 12. `
      + `Pictorial representation with prompts.`,
    schemaDescription: "'build' (shade slices to match fraction)",
  },
  compare: {
    promptDoc:
      `"compare": Two fraction circles are shown. Student decides which fraction is larger or smaller. `
      + `CRITICAL: MUST include the "compareFraction" field with "numerator" and "denominator" properties. `
      + `The compareFraction MUST use a DIFFERENT denominator from the main fraction so the circles look different. `
      + `The two fractions should NOT be equivalent — pick fractions with genuinely different values.`,
    schemaDescription: "'compare' (compare two fractions)",
  },
  equivalent: {
    promptDoc:
      `"equivalent": A fraction is shown. Student builds an equivalent fraction with a different denominator. `
      + `MUST include equivalentDenominator (a valid denominator 2-12 where the equivalent fraction has a whole-number numerator). `
      + `Example: 2/4 equivalent with denominator 6 => 3/6, so equivalentDenominator=6.`,
    schemaDescription: "'equivalent' (find equivalent fraction)",
  },
};

// ---------------------------------------------------------------------------
// Support tiers — within-mode scaffolding withdrawal + compare proximity.
// Second axis of the two-field contract (targetEvalMode = WHICH skill,
// difficulty = HOW MUCH support within it). NEVER changes magnitude.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type FractionChallengeType = 'identify' | 'build' | 'compare' | 'equivalent';

/** Per-challenge scaffold flags written by the tier. All are DISPLAY-ONLY —
 *  the component's checkers read numerator/denominator, never these — so
 *  withdrawing a scaffold can never invalidate a correct answer. */
interface SupportScaffold {
  /** identify: state the total-slice count ("N equal pieces"); build: show the denominator slice label */
  showTotalPieces: boolean;
  /** running shaded/built tally readout (identify "M shaded", build & equivalent live count) */
  showWorkingCount: boolean;
  /** compare ONLY: numeric fraction labels under each circle and inside the choice buttons */
  showFractionLabels: boolean;
  promptLines: string[];
}

/** compare ONLY structural lever — how close the two fraction VALUES are.
 *  Prompt-shaped (the LLM picks the fractions); in-mode (still comparing two
 *  fractions) and structural (discrimination difficulty), never magnitude. */
type CompareProximity = 'far' | 'moderate' | 'close';

const TIER_GUARDRAIL =
  'Keep every denominator within 2-12 and stay inside the grade band — this tier changes only '
  + 'on-screen SUPPORT and (for compare) how CLOSE the two fraction values are, NOT raw magnitude.';

function resolveSupportStructure(type: FractionChallengeType, tier: SupportTier): SupportScaffold {
  switch (type) {
    case 'identify':
      if (tier === 'easy')
        return { showTotalPieces: true, showWorkingCount: true, showFractionLabels: true,
          promptLines: ['identify: a caption states BOTH the total and shaded counts — keep the instruction warm and direct.'] };
      if (tier === 'medium')
        return { showTotalPieces: true, showWorkingCount: false, showFractionLabels: true,
          promptLines: ['identify: only the TOTAL slice count is shown; the student counts the shaded slices alone. Hint may name the total but NOT the shaded count.'] };
      return { showTotalPieces: false, showWorkingCount: false, showFractionLabels: true,
        promptLines: ['identify: NO count caption is shown — the student must count both total and shaded slices unaided. Hint must NOT state the numerator or denominator; ask what they see.'] };

    case 'build':
      if (tier === 'easy')
        return { showTotalPieces: true, showWorkingCount: true, showFractionLabels: true,
          promptLines: ['build: a live "shaded / total" tally updates as the student clicks — they can self-check.'] };
      if (tier === 'medium')
        return { showTotalPieces: true, showWorkingCount: false, showFractionLabels: true,
          promptLines: ['build: only the total-slice label is shown, no running shaded tally — the student tracks their own count.'] };
      return { showTotalPieces: false, showWorkingCount: false, showFractionLabels: true,
        promptLines: ['build: NO count readout — the student shades and verifies the count entirely unaided. Hint must not state how many are currently shaded.'] };

    case 'equivalent':
      if (tier === 'hard')
        return { showTotalPieces: false, showWorkingCount: false, showFractionLabels: true,
          promptLines: ['equivalent: NO live built-fraction tally — the student tracks the equivalent they are building unaided. Hint must not state the current built count.'] };
      return { showTotalPieces: true, showWorkingCount: true, showFractionLabels: true,
        promptLines: ['equivalent: the live built-fraction tally is shown so the student can compare it against the reference.'] };

    case 'compare':
      if (tier === 'easy')
        return { showTotalPieces: true, showWorkingCount: true, showFractionLabels: true,
          promptLines: ['compare: numeric fraction labels are shown under each circle and inside the buttons — visual + symbolic support.'] };
      return { showTotalPieces: true, showWorkingCount: true, showFractionLabels: false,
        promptLines: ['compare: numeric fraction labels are HIDDEN — the student judges purely from the shaded area. Hint must describe the picture ("which circle has more color?"), never the fraction values.'] };
  }
}

/** compare proximity — easy=obvious gap, hard=subtle. Other modes: no structural change. */
function resolveCompareProximity(tier: SupportTier): CompareProximity {
  return tier === 'easy' ? 'far' : tier === 'medium' ? 'moderate' : 'close';
}

const PROXIMITY_PROMPT: Record<CompareProximity, string> = {
  far: 'compare STRUCTURE: pick two fractions whose values are FAR apart (e.g. 1/2 vs 1/6) so the difference in shaded area is obvious at a glance.',
  moderate: 'compare STRUCTURE: pick two fractions a MODERATE distance apart (e.g. 1/2 vs 2/3) — distinguishable but requires a careful look.',
  close: 'compare STRUCTURE: pick two fractions CLOSE in value (e.g. 3/5 vs 5/8) so the shaded areas look similar and the student must discriminate carefully. Still keep them non-equivalent and denominators 2-12.',
};

/** Merge scaffolding + structural prompt lines into one tier block for the given in-scope modes. */
function buildTierPromptSection(modes: FractionChallengeType[], tier: SupportTier): string {
  const lines = new Set<string>();
  for (const m of modes) {
    for (const l of resolveSupportStructure(m, tier).promptLines) lines.add(l);
    if (m === 'compare') lines.add(PROXIMITY_PROMPT[resolveCompareProximity(tier)]);
  }
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}"\n`
    + `- ${TIER_GUARDRAIL}\n`
    + Array.from(lines).map((l) => `- ${l}`).join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

/**
 * Schema definition for Fraction Circles Data
 *
 * Each challenge asks the student to interact with a fraction circle in one of
 * four modes: identify (name the fraction shown), build (shade slices to match),
 * compare (decide which fraction is larger/smaller), or equivalent (find an
 * equivalent fraction with a different denominator).
 */
const fractionCirclesSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Engaging, age-appropriate title for the fraction circles activity",
    },
    description: {
      type: Type.STRING,
      description:
        "Brief educational description of what students will practise",
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "Array of 4-6 challenges mixing identify, build, compare, and equivalent types with progressive difficulty",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'fc1', 'fc2')",
          },
          type: {
            type: Type.STRING,
            description:
              "Challenge type: 'identify' (name the shaded fraction), 'build' (shade slices to match a fraction), 'compare' (decide which of two fractions is larger), 'equivalent' (build an equivalent fraction with a different denominator)",
          },
          instruction: {
            type: Type.STRING,
            description:
              "Student-facing instruction, warm and encouraging (e.g., 'What fraction of the circle is shaded?')",
          },
          denominator: {
            type: Type.NUMBER,
            description:
              "Number of equal slices the circle is divided into (2-12)",
          },
          numerator: {
            type: Type.NUMBER,
            description:
              "Number of shaded slices (0 to denominator)",
          },
          compareFraction: {
            type: Type.OBJECT,
            description:
              "Second fraction for 'compare' challenges. Must be present when type is 'compare'.",
            properties: {
              numerator: {
                type: Type.NUMBER,
                description: "Numerator of the comparison fraction",
              },
              denominator: {
                type: Type.NUMBER,
                description: "Denominator of the comparison fraction",
              },
            },
            required: ["numerator", "denominator"],
          },
          equivalentDenominator: {
            type: Type.NUMBER,
            description:
              "Target denominator for 'equivalent' challenges. Must be present when type is 'equivalent'. The student must build the same fraction value using this many slices.",
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after incorrect attempts",
          },
          narration: {
            type: Type.STRING,
            description:
              "AI tutor narration introducing this challenge",
          },
        },
        required: [
          "id",
          "type",
          "instruction",
          "denominator",
          "numerator",
          "hint",
          "narration",
        ],
      },
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K-2' or '3-5'",
    },
  },
  required: ["title", "challenges"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate Fraction Circles content
 *
 * Creates interactive fraction circle challenges for elementary math education,
 * mixing four challenge types across progressive difficulty.
 *
 * Grade-aware content:
 * - K-2: Simple fractions (halves, thirds, fourths), mostly identify & build
 * - 3-5: Larger denominators (up to 12), compare & equivalent challenges
 *
 * @param topic - The math topic or concept
 * @param gradeContext - Grade level for age-appropriate content
 * @param config - Optional configuration including intent and targetEvalMode
 * @returns FractionCirclesData with complete challenge set
 */
type FractionCirclesConfig = Partial<{
  intent: string;
  /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
  targetEvalMode: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
   */
  difficulty: string;
}>;

export const generateFractionCircles = async (ctx: GenerationContext): Promise<FractionCirclesData> => {
  const { topic } = ctx;
  const gradeContext = ctx.gradeContext;
  const config: FractionCirclesConfig = { ...(ctx.raw as FractionCirclesConfig), intent: ctx.intent };
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'fraction-circles',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Resolve the within-mode support tier (drives BOTH the prompt tone and the
  //    deterministic per-challenge scaffold application after generation) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierModes = (evalConstraint?.allowedTypes
    ?? ['identify', 'build', 'compare', 'equivalent']) as FractionChallengeType[];
  const tierSection = supportTier ? buildTierPromptSection(tierModes, supportTier) : '';

  // ── Pre-roll a grade-legal fraction pool (entropy lives in the prompt); the
  //    per-instance intent steers the family within it ──
  const fractionPoolSection = buildFractionPoolSection(gradeContext, config?.intent);

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(fractionCirclesSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : fractionCirclesSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational fraction circles activity for teaching "${topic}" to ${gradeContext} students.

CONTEXT:
- A fraction circle is a circle divided into equal slices, some of which are shaded
- Students interact with the circle to learn about fractions visually
- Intent: ${config?.intent || topic}

${challengeTypeSection}
${tierSection}
${fractionPoolSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- K-2 (gradeBand "K-2"):
  * Use denominators 2, 3, 4 only
  * Focus on identify and build challenges (at least 3 of these)
  * Include 1 compare challenge with simple fractions
  * Skip equivalent challenges or include at most 1 very simple one (e.g., 1/2 = 2/4)
  * Use warm, simple language ("How many pieces are coloured in?")

- 3-5 (gradeBand "3-5"):
  * Use denominators 2-12
  * Mix all four types roughly evenly
  * Include at least 1 compare and 1 equivalent challenge
  * Use proper fraction vocabulary ("What fraction is represented?")
  * Equivalent challenges: ensure equivalentDenominator creates a valid equivalent
    (e.g., 2/4 equivalent with denominator 6 => 3/6, so equivalentDenominator=6)
` : ''}

REQUIREMENTS:
1. Generate 4-6 challenges that progress in difficulty
2. Choose every fraction from the FRACTION POOL above — do NOT invent your own values and do NOT default to the 1/2, 2/3, 3/4 sequence. Use varied numerators across the session.
3. Each challenge needs a unique id (e.g., 'fc1', 'fc2', ...)
4. denominators must be between 2 and 12 inclusive
5. numerators must be between 0 and the denominator (inclusive)
6. For compare challenges, the compareFraction object MUST be included with numerator and denominator.
   Use a DIFFERENT denominator than the main fraction so circles look distinct (e.g., main 1/2, compare 2/3).
   The two fractions should NOT be equivalent — use genuinely different values.
7. For equivalent challenges, equivalentDenominator MUST be present (2-12) and the
   equivalent must be mathematically valid (numerator * equivalentDenominator / denominator must be a whole number)
8. Hints should guide without giving away the answer
9. Narration should be what an AI tutor would say to introduce the challenge
10. Set gradeBand to "K-2" or "3-5" based on the grade context

Return the complete fraction circles configuration.
`;

  logEvalModeResolution('FractionCircles', config?.targetEvalMode, evalConstraint);

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
    throw new Error("No valid fraction circles data returned from Gemini API");
  }

  // ---- Validation & Defaults ----

  // Ensure gradeBand is valid
  if (data.gradeBand !== "K-2" && data.gradeBand !== "3-5") {
    const lower = gradeContext.toLowerCase();
    data.gradeBand =
      lower.includes("kinder") || lower.includes("k-2") || lower.includes("1st") || lower.includes("2nd")
        ? "K-2"
        : "3-5";
  }

  // Validate challenge types (safety net — schema enum handles the eval mode case)
  const validTypes = ["identify", "build", "compare", "equivalent"];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Per-challenge validation
  for (let i = 0; i < data.challenges.length; i++) {
    const challenge = data.challenges[i] as FractionCirclesChallenge;

    // Generate ID if missing
    if (!challenge.id) {
      challenge.id = `fc${i + 1}`;
    }

    // Clamp denominator to 2-12
    if (!challenge.denominator || challenge.denominator < 2) {
      challenge.denominator = 4;
    }
    if (challenge.denominator > 12) {
      challenge.denominator = 12;
    }
    challenge.denominator = Math.round(challenge.denominator);

    // Clamp numerator to 0..denominator
    if (challenge.numerator == null || challenge.numerator < 0) {
      challenge.numerator = 1;
    }
    if (challenge.numerator > challenge.denominator) {
      challenge.numerator = challenge.denominator;
    }
    challenge.numerator = Math.round(challenge.numerator);

    // For compare challenges, ensure compareFraction is present, valid, and visually distinct
    if (challenge.type === "compare") {
      if (
        !challenge.compareFraction ||
        typeof challenge.compareFraction.numerator !== "number" ||
        typeof challenge.compareFraction.denominator !== "number"
      ) {
        // Generate a comparison fraction with a DIFFERENT denominator so it looks distinct
        const altDen = challenge.denominator <= 4
          ? challenge.denominator * 2
          : Math.max(2, challenge.denominator - 1);
        const clampedAltDen = Math.min(12, Math.max(2, altDen));
        // Pick a numerator that gives a different value (not equivalent)
        const mainVal = challenge.numerator / challenge.denominator;
        let altNum = Math.round(clampedAltDen * mainVal * 0.6); // ~60% of main => smaller
        if (altNum < 1) altNum = 1;
        if (altNum >= clampedAltDen) altNum = clampedAltDen - 1;
        challenge.compareFraction = {
          numerator: altNum,
          denominator: clampedAltDen,
        };
      }
      // Clamp compareFraction values
      const cf = challenge.compareFraction;
      cf.denominator = Math.round(
        Math.min(12, Math.max(2, cf.denominator))
      );
      cf.numerator = Math.round(
        Math.min(cf.denominator, Math.max(0, cf.numerator))
      );

      // Ensure the two fractions don't display identically (e.g. both showing "1/2")
      // If they have the same numerator AND denominator, adjust the compare fraction
      if (
        cf.numerator === challenge.numerator &&
        cf.denominator === challenge.denominator
      ) {
        // Make them visually different: use a different denominator
        const newDen = cf.denominator <= 6 ? cf.denominator * 2 : Math.max(2, cf.denominator - 1);
        cf.denominator = Math.min(12, newDen);
        // Pick a numerator that gives a genuinely different value
        cf.numerator = Math.max(1, Math.min(cf.denominator - 1, challenge.numerator + 1));
      }
    }

    // For equivalent challenges, ensure equivalentDenominator is present and valid
    if (challenge.type === "equivalent") {
      if (
        !challenge.equivalentDenominator ||
        challenge.equivalentDenominator < 2 ||
        challenge.equivalentDenominator > 12
      ) {
        // Pick a valid equivalent denominator (a multiple or factor of the current denominator, 2-12)
        const candidates: number[] = [];
        for (let d = 2; d <= 12; d++) {
          if (
            d !== challenge.denominator &&
            (challenge.numerator * d) % challenge.denominator === 0
          ) {
            candidates.push(d);
          }
        }
        challenge.equivalentDenominator =
          candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : challenge.denominator * 2 <= 12
              ? challenge.denominator * 2
              : challenge.denominator;
      }
      challenge.equivalentDenominator = Math.round(challenge.equivalentDenominator);

      // Verify the equivalence is mathematically valid; if not, fix numerator
      const equivNumerator =
        (challenge.numerator * challenge.equivalentDenominator) /
        challenge.denominator;
      if (!Number.isInteger(equivNumerator)) {
        // Adjust numerator to make a valid equivalent possible
        for (let n = 1; n <= challenge.denominator; n++) {
          if (
            (n * challenge.equivalentDenominator) % challenge.denominator ===
            0
          ) {
            challenge.numerator = n;
            break;
          }
        }
      }
    }

    // Ensure hint and narration are present
    if (!challenge.hint) {
      challenge.hint = "Look carefully at the circle and count the slices.";
    }
    if (!challenge.narration) {
      challenge.narration = "Let's look at this fraction circle together!";
    }
    if (!challenge.instruction) {
      challenge.instruction = "What fraction does this circle show?";
    }
  }

  // Ensure at least one challenge (use eval constraint fallback type)
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'identify';

    const fallbacks: Record<string, FractionCirclesChallenge> = {
      identify: {
        id: "fc1",
        type: "identify",
        instruction: "What fraction of the circle is shaded?",
        denominator: 4,
        numerator: 1,
        hint: "Count the total slices, then count the shaded ones.",
        narration: "Look at this circle. Some slices are shaded. Can you name the fraction?",
      },
      build: {
        id: "fc1",
        type: "build",
        instruction: "Shade 2 out of 3 slices to show 2/3.",
        denominator: 3,
        numerator: 2,
        hint: "You need to shade 2 slices out of 3 equal parts.",
        narration: "Now it's your turn to build a fraction! Shade the right number of slices.",
      },
      compare: {
        id: "fc1",
        type: "compare",
        instruction: "Which fraction is larger: 1/2 or 1/3?",
        denominator: 2,
        numerator: 1,
        compareFraction: { numerator: 1, denominator: 3 },
        hint: "Look at the size of the shaded area in each circle.",
        narration: "Let's compare two fractions. Which one takes up more of the circle?",
      },
      equivalent: {
        id: "fc1",
        type: "equivalent",
        instruction: "Build a fraction equivalent to 1/2 using 4 slices.",
        denominator: 2,
        numerator: 1,
        equivalentDenominator: 4,
        hint: "If the circle has 4 slices, how many do you shade to equal 1/2?",
        narration: "Can you find a fraction that looks different but has the same value?",
      },
    };

    console.log(`[FractionCircles] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.identify];
  }

  // If still fewer than 4 and no eval constraint, pad with defaults
  if (!evalConstraint && data.challenges.length < 4) {
    const defaults: FractionCirclesChallenge[] = [
      {
        id: "fc_d1",
        type: "identify",
        instruction: "What fraction of the circle is shaded?",
        denominator: 4,
        numerator: 1,
        hint: "Count the total slices, then count the shaded ones.",
        narration: "Look at this circle. Some slices are shaded. Can you name the fraction?",
      },
      {
        id: "fc_d2",
        type: "build",
        instruction: "Shade 2 out of 3 slices to show 2/3.",
        denominator: 3,
        numerator: 2,
        hint: "You need to shade 2 slices out of 3 equal parts.",
        narration: "Now it's your turn to build a fraction! Shade the right number of slices.",
      },
      {
        id: "fc_d3",
        type: "compare",
        instruction: "Which fraction is larger: 1/2 or 1/3?",
        denominator: 2,
        numerator: 1,
        compareFraction: { numerator: 1, denominator: 3 },
        hint: "Look at the size of the shaded area in each circle.",
        narration: "Let's compare two fractions. Which one takes up more of the circle?",
      },
      {
        id: "fc_d4",
        type: "equivalent",
        instruction: "Build a fraction equivalent to 1/2 using 4 slices.",
        denominator: 2,
        numerator: 1,
        equivalentDenominator: 4,
        hint: "If the circle has 4 slices, how many do you shade to equal 1/2?",
        narration: "Can you find a fraction that looks different but has the same value?",
      },
    ];

    // Fill in missing challenges from defaults
    while (data.challenges.length < 4) {
      const needed = defaults[data.challenges.length];
      if (needed) {
        data.challenges.push(needed);
      } else {
        break;
      }
    }
  }

  // Ensure title exists
  if (!data.title) {
    data.title = "Fraction Circles";
  }

  // ---- Apply the support tier deterministically, PER CHALLENGE ----
  // Difficulty is a STUDENT property: a blended/auto session gets it too, with
  // each challenge's scaffold resolved from its OWN mode. Gate only on a tier
  // being present (NOT on a single pinned mode) so blended sessions are covered.
  // Code owns the support STRUCTURE; the LLM only chose the numbers.
  if (supportTier) {
    for (const ch of data.challenges as FractionCirclesChallenge[]) {
      const sc = resolveSupportStructure(ch.type as FractionChallengeType, supportTier);
      ch.supportTier = supportTier;
      ch.showTotalPieces = sc.showTotalPieces;
      ch.showWorkingCount = sc.showWorkingCount;
      // showFractionLabels is a compare-only lever; leave others undefined (renders unaffected).
      ch.showFractionLabels = ch.type === 'compare' ? sc.showFractionLabels : undefined;
    }
    const pinnedType = evalConstraint?.allowedTypes.length === 1
      ? evalConstraint.allowedTypes[0] : undefined;
    console.log(`[FractionCircles] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`);
  }

  // Final summary log
  const typeBreakdown = (data.challenges as FractionCirclesChallenge[]).map((c) => c.type).join(', ');
  console.log(`[FractionCircles] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  console.log("Fraction Circles Generated:", {
    topic,
    challengeCount: data.challenges.length,
    types: data.challenges.map((c: FractionCirclesChallenge) => c.type),
    gradeBand: data.gradeBand,
  });

  return data as FractionCirclesData;
};
