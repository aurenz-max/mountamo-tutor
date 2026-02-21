/**
 * Fraction Circles Generator - Dedicated service for fraction circle challenges
 *
 * Generates multi-type fraction challenges (identify, build, compare, equivalent)
 * for the modernized FractionCircles primitive with interactive challenge phases.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type {
  FractionCirclesData,
  FractionCirclesChallenge,
} from "../../primitives/visual-primitives/math/FractionCircles";

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
 * @param config - Optional configuration including intent
 * @returns FractionCirclesData with complete challenge set
 */
export const generateFractionCircles = async (
  topic: string,
  gradeContext: string,
  config?: Partial<{ intent?: string }>
): Promise<FractionCirclesData> => {
  const prompt = `
Create an educational fraction circles activity for teaching "${topic}" to ${gradeContext} students.

CONTEXT:
- A fraction circle is a circle divided into equal slices, some of which are shaded
- Students interact with the circle to learn about fractions visually
- Intent: ${config?.intent || topic}

CHALLENGE TYPES (mix all four):
1. "identify" — A fraction circle is shown with some slices shaded. Student names the fraction (e.g., 3/4).
2. "build" — Student is given a fraction and must shade the correct number of slices on the circle.
3. "compare" — Two fraction circles are shown. Student decides which fraction is larger or smaller.
   CRITICAL: MUST include the "compareFraction" field with "numerator" and "denominator" properties.
   The compareFraction MUST use a DIFFERENT denominator from the main fraction so the circles look different.
   The two fractions should NOT be equivalent — pick fractions with genuinely different values (e.g., 1/2 vs 2/3, not 1/2 vs 2/4).
4. "equivalent" — A fraction is shown. Student builds an equivalent fraction with a different denominator.
   MUST include equivalentDenominator (a valid denominator 2-12 where the equivalent fraction has a whole-number numerator).

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

REQUIREMENTS:
1. Generate 4-6 challenges that progress in difficulty
2. Start with simpler fractions (halves, thirds) and move to harder ones
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

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: fractionCirclesSchema,
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

  // Validate challenge types
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

  // Ensure at least 4 challenges exist
  if (data.challenges.length < 4) {
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

  console.log("Fraction Circles Generated:", {
    topic,
    challengeCount: data.challenges.length,
    types: data.challenges.map((c: FractionCirclesChallenge) => c.type),
    gradeBand: data.gradeBand,
  });

  return data as FractionCirclesData;
};
