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
 * This matches the FactorTreeData interface in the component
 */
export interface FactorTreeData {
  title: string;
  description: string;
  rootValue: number;
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
      + `Good numbers: 6, 8, 10, 12, 14, 15, 16, 18, 20, 24. `
      + `Focus on introducing the concept of factor trees and recognizing primes vs composites.`,
    schemaDescription: "'guided_small' (small composites with hints)",
  },
  guided_medium: {
    promptDoc:
      `"guided_medium": Medium composite numbers (24-60) with 3-4 prime factors. `
      + `guidedMode=true, allowReset=true, highlightPrimes=true, showExponentForm=true. `
      + `Good numbers: 24, 28, 30, 36, 40, 42, 45, 48, 50, 54, 56, 60. `
      + `Students build fluency with support. Emphasize exponential form (e.g., 2^3 × 3).`,
    schemaDescription: "'guided_medium' (medium composites with hints)",
  },
  unguided: {
    promptDoc:
      `"unguided": Medium composite numbers (20-60) without factor pair hints. `
      + `guidedMode=false, allowReset=true, highlightPrimes=true, showExponentForm=true. `
      + `Good numbers: 20, 24, 28, 30, 36, 40, 42, 48, 50, 54, 56, 60. `
      + `Student must find factor pairs independently. Tests divisibility rule knowledge.`,
    schemaDescription: "'unguided' (medium composites, no hints)",
  },
  assessment: {
    promptDoc:
      `"assessment": Larger composite numbers (40-100) with no hints and no reset. `
      + `guidedMode=false, allowReset=false, highlightPrimes=true, showExponentForm=true. `
      + `Good numbers: 40, 48, 54, 56, 60, 63, 72, 80, 84, 90, 96, 100. `
      + `Formal assessment — student must complete factorization independently on first attempt.`,
    schemaDescription: "'assessment' (large composites, no hints, no reset)",
  },
};

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const factorTreeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the factor tree (e.g., 'Prime Factorization of 24')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    challengeType: {
      type: Type.STRING,
      description: "Challenge type: 'guided_small' (small composites with hints), 'guided_medium' (medium composites with hints), 'unguided' (medium composites, no hints), 'assessment' (large composites, no hints, no reset)"
    },
    rootValue: {
      type: Type.NUMBER,
      description: "Starting composite number to factor. Range 4-100. Choose numbers with clear factorizations for grade level."
    },
    highlightPrimes: {
      type: Type.BOOLEAN,
      description: "Visually distinguish prime leaves with green highlighting. Default: true"
    },
    showExponentForm: {
      type: Type.BOOLEAN,
      description: "Display final factorization in exponential form (e.g., 2^3 × 3). Default: true"
    },
    guidedMode: {
      type: Type.BOOLEAN,
      description: "Suggest valid factor pairs to help students. true for guided_small/guided_medium, false for unguided/assessment."
    },
    allowReset: {
      type: Type.BOOLEAN,
      description: "Allow students to clear and restart. true for all modes except assessment."
    }
  },
  required: ["title", "description", "challengeType", "rootValue"]
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
};

/** Enforce rootValue range and composite constraint for a given challenge type */
function validateRootValue(data: FactorTreeData & { challengeType?: string }): void {
  const ct = data.challengeType;
  const ranges: Record<string, [number, number]> = {
    guided_small: [4, 24],
    guided_medium: [24, 60],
    unguided: [20, 60],
    assessment: [40, 100],
  };
  const [min, max] = ranges[ct ?? ''] ?? [4, 100];

  // Clamp to range
  if (data.rootValue < min || data.rootValue > max) {
    const fallbacks: Record<string, number> = {
      guided_small: 12,
      guided_medium: 36,
      unguided: 36,
      assessment: 72,
    };
    console.warn(`[FactorTree] rootValue ${data.rootValue} out of range [${min}, ${max}] for ${ct}. Using fallback.`);
    data.rootValue = fallbacks[ct ?? ''] ?? 24;
  }

  // Ensure composite
  if (isPrime(data.rootValue)) {
    console.warn(`[FactorTree] rootValue ${data.rootValue} is prime. Adjusting.`);
    const adjusted = data.rootValue + 1;
    data.rootValue = isPrime(adjusted) ? adjusted + 1 : adjusted;
  }
}

/** Enforce guidedMode / allowReset based on challenge type */
function enforceModeFlags(data: FactorTreeData & { challengeType?: string }): void {
  const ct = data.challengeType;
  if (ct === 'guided_small' || ct === 'guided_medium') {
    data.guidedMode = true;
    data.allowReset = true;
  } else if (ct === 'unguided') {
    data.guidedMode = false;
    data.allowReset = true;
  } else if (ct === 'assessment') {
    data.guidedMode = false;
    data.allowReset = false;
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateFactorTree = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rootValue?: number;
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
Create an educational factor tree visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Factor trees are branching diagrams showing prime factorization
- Students repeatedly split composite numbers into factor pairs
- The process continues until all branches end in prime numbers
- The prime factors are then collected to show the prime factorization

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Grades 3-4: Simple composite numbers (12, 18, 20, 24, 30), focus on understanding factors
- Grades 4-5: Two-digit composites (36, 48, 54, 60, 72), introduce prime factorization
- Grades 5-6: Larger numbers (84, 90, 96, 100), exponential notation, GCF/LCM applications
- Grades 6-7: More complex numbers, use for simplifying fractions and finding GCF/LCM

TOPIC-SPECIFIC GUIDANCE:
- "Introduction to factors": Use smaller numbers (12, 18, 24) with clear factor pairs
- "Prime factorization": Use numbers with multiple prime factors (24, 30, 36, 48)
- "Prime vs composite": Use numbers that illustrate the difference
- "GCF and LCM": Use pairs of related numbers (24 and 36, 48 and 60)
- "Simplifying fractions": Use numbers that are common denominators (24, 36, 48, 60)
- "Powers and exponents": Use numbers with repeated prime factors (16=2^4, 27=3^3, 72=2^3×3^2)
` : ''}

GOOD NUMBERS BY PRIME FACTOR PATTERNS:
- Two primes: 6, 10, 14, 15, 21, 22, 26, 33, 34, 35, 38, 39
- Three prime factors: 12, 18, 20, 28, 30, 42, 44, 45, 50, 52
- Four prime factors: 24, 40, 48, 54, 56, 60, 63, 72, 80, 84, 90, 96
- Powers of 2: 16, 32, 64 (for exponential form emphasis)
- Powers of 3: 27, 81 (for exponential form emphasis)
- Mixed: 36 (2^2 × 3^2), 72 (2^3 × 3^2), 100 (2^2 × 5^2)

${(() => {
  const hints: string[] = [];
  if (config?.rootValue !== undefined) hints.push(`- Root value: ${config.rootValue}`);
  if (config?.highlightPrimes !== undefined) hints.push(`- Highlight primes: ${config.highlightPrimes}`);
  if (config?.showExponentForm !== undefined) hints.push(`- Show exponent form: ${config.showExponentForm}`);
  if (config?.guidedMode !== undefined) hints.push(`- Guided mode: ${config.guidedMode}`);
  if (config?.allowReset !== undefined) hints.push(`- Allow reset: ${config.allowReset}`);
  return hints.length > 0 ? `CONFIGURATION HINTS:\n${hints.join('\n')}` : '';
})()}

REQUIREMENTS:
1. Choose a composite number appropriate for the grade level and topic
2. Write a clear, student-friendly title that includes the number being factored
3. Provide an educational description of what students will learn
4. Set challengeType to match the difficulty tier
5. Set guidedMode and allowReset to match the challengeType constraints
6. Always highlight primes and show exponent form unless specifically overridden
7. The number should have educational value for the specific topic

AVOID:
- Numbers less than 4
- Prime numbers
- Numbers greater than 100

Return the complete factor tree configuration.
`;

  logEvalModeResolution('FactorTree', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid factor tree data returned from Gemini API');
  }

  // ── Validate challengeType ──
  const validTypes = ['guided_small', 'guided_medium', 'unguided', 'assessment'];
  if (!validTypes.includes(data.challengeType)) {
    data.challengeType = evalConstraint?.allowedTypes[0] ?? 'guided_small';
  }

  // ── Validate rootValue for challenge type range ──
  validateRootValue(data);

  // ── Enforce mode flags (guidedMode, allowReset) ──
  enforceModeFlags(data);

  // ── Set defaults ──
  if (data.highlightPrimes === undefined) data.highlightPrimes = true;
  if (data.showExponentForm === undefined) data.showExponentForm = true;

  // ── Apply explicit config overrides from manifest ──
  if (config) {
    if (config.rootValue !== undefined) data.rootValue = config.rootValue;
    if (config.highlightPrimes !== undefined) data.highlightPrimes = config.highlightPrimes;
    if (config.showExponentForm !== undefined) data.showExponentForm = config.showExponentForm;
    // Don't allow config to override guidedMode/allowReset when eval mode is active
    if (!evalConstraint) {
      if (config.guidedMode !== undefined) data.guidedMode = config.guidedMode;
      if (config.allowReset !== undefined) data.allowReset = config.allowReset;
    }
  }

  // Final log
  console.log(`[FactorTree] Final: challengeType=${data.challengeType}, rootValue=${data.rootValue}, guided=${data.guidedMode}, reset=${data.allowReset}`);

  return data;
};
