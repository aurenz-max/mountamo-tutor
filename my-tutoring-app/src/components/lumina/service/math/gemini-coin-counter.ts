import { Type, Schema } from "@google/genai";
import { CoinCounterData } from "../../primitives/visual-primitives/math/CoinCounter";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": Identify a coin by its appearance. Student sees coins without values and picks the named one. `
      + `Show 3-4 different coins, ask "Which coin is the [nickel]?" Options are coin type names.`,
    schemaDescription: "'identify' (pick the named coin)",
  },
  count: {
    promptDoc:
      `"count": Count the total value of displayed coins in cents. `
      + `Show 2-5 mixed coins, student enters the total value. `
      + `correctTotal MUST equal the sum of all displayed coin values.`,
    schemaDescription: "'count' (total value in cents)",
  },
  "make-amount": {
    promptDoc:
      `"make-amount": Build a target amount by selecting coins. `
      + `Give a target amount in cents and a set of available coin types. `
      + `Student picks coins to reach the exact target. K: amounts under 25¢. Grade 1+: up to 100¢.`,
    schemaDescription: "'make-amount' (build target from coins)",
  },
  compare: {
    promptDoc:
      `"compare": Compare two groups of coins to determine which has more value. `
      + `Show groupA and groupB, each with 2-3 coins. correctGroup is 'A', 'B', or 'equal'. `
      + `Groups should differ by at least 5¢ so the comparison is meaningful.`,
    schemaDescription: "'compare' (which group is worth more)",
  },
  "make-change": {
    promptDoc:
      `"make-change": Calculate change from a purchase. `
      + `paidAmount > itemCost. correctChange = paidAmount - itemCost. `
      + `Use round amounts for K-1 (e.g., pay 50¢ for 35¢ item). Grade 2+ can use $1.00 payments.`,
    schemaDescription: "'make-change' (calculate change)",
  },
};

// ---------------------------------------------------------------------------
// Flattened Gemini schema (arrays → indexed fields)
// ---------------------------------------------------------------------------

const coinTypeEnum = {
  type: Type.STRING,
  description: "Coin type: 'penny', 'nickel', 'dime', 'quarter', 'half-dollar', 'dollar'",
};

const coinCounterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the coin activity (e.g., 'Counting Coins at the Store!')",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K', '1', '2', or '3'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1')" },
          type: {
            type: Type.STRING,
            description:
              "Challenge type: 'identify', 'count', 'make-amount', 'compare', 'make-change'",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },

          // identify fields (flattened coins + options)
          coin0Type: { ...coinTypeEnum, description: "1st coin type (identify)", nullable: true },
          coin0Count: { type: Type.NUMBER, description: "1st coin count", nullable: true },
          coin1Type: { ...coinTypeEnum, description: "2nd coin type (identify)", nullable: true },
          coin1Count: { type: Type.NUMBER, description: "2nd coin count", nullable: true },
          coin2Type: { ...coinTypeEnum, description: "3rd coin type (identify)", nullable: true },
          coin2Count: { type: Type.NUMBER, description: "3rd coin count", nullable: true },
          coin3Type: { ...coinTypeEnum, description: "4th coin type (identify)", nullable: true },
          coin3Count: { type: Type.NUMBER, description: "4th coin count", nullable: true },
          targetCoin: { ...coinTypeEnum, description: "Coin to identify", nullable: true },
          option0: { ...coinTypeEnum, description: "Answer option 1", nullable: true },
          option1: { ...coinTypeEnum, description: "Answer option 2", nullable: true },
          option2: { ...coinTypeEnum, description: "Answer option 3", nullable: true },
          option3: { ...coinTypeEnum, description: "Answer option 4", nullable: true },

          // count fields (flattened displayedCoins)
          displayedCoin0Type: { ...coinTypeEnum, description: "1st displayed coin type", nullable: true },
          displayedCoin0Count: { type: Type.NUMBER, description: "1st displayed coin count", nullable: true },
          displayedCoin1Type: { ...coinTypeEnum, description: "2nd displayed coin type", nullable: true },
          displayedCoin1Count: { type: Type.NUMBER, description: "2nd displayed coin count", nullable: true },
          displayedCoin2Type: { ...coinTypeEnum, description: "3rd displayed coin type", nullable: true },
          displayedCoin2Count: { type: Type.NUMBER, description: "3rd displayed coin count", nullable: true },
          displayedCoin3Type: { ...coinTypeEnum, description: "4th displayed coin type", nullable: true },
          displayedCoin3Count: { type: Type.NUMBER, description: "4th displayed coin count", nullable: true },
          correctTotal: { type: Type.NUMBER, description: "Correct total in cents (count type)", nullable: true },

          // make-amount fields
          targetAmount: { type: Type.NUMBER, description: "Target amount in cents", nullable: true },
          availableCoin0: { ...coinTypeEnum, description: "Available coin 1", nullable: true },
          availableCoin1: { ...coinTypeEnum, description: "Available coin 2", nullable: true },
          availableCoin2: { ...coinTypeEnum, description: "Available coin 3", nullable: true },
          availableCoin3: { ...coinTypeEnum, description: "Available coin 4", nullable: true },

          // compare fields (flattened groupA / groupB)
          groupACoin0Type: { ...coinTypeEnum, description: "Group A coin 1 type", nullable: true },
          groupACoin0Count: { type: Type.NUMBER, description: "Group A coin 1 count", nullable: true },
          groupACoin1Type: { ...coinTypeEnum, description: "Group A coin 2 type", nullable: true },
          groupACoin1Count: { type: Type.NUMBER, description: "Group A coin 2 count", nullable: true },
          groupACoin2Type: { ...coinTypeEnum, description: "Group A coin 3 type", nullable: true },
          groupACoin2Count: { type: Type.NUMBER, description: "Group A coin 3 count", nullable: true },
          groupBCoin0Type: { ...coinTypeEnum, description: "Group B coin 1 type", nullable: true },
          groupBCoin0Count: { type: Type.NUMBER, description: "Group B coin 1 count", nullable: true },
          groupBCoin1Type: { ...coinTypeEnum, description: "Group B coin 2 type", nullable: true },
          groupBCoin1Count: { type: Type.NUMBER, description: "Group B coin 2 count", nullable: true },
          groupBCoin2Type: { ...coinTypeEnum, description: "Group B coin 3 type", nullable: true },
          groupBCoin2Count: { type: Type.NUMBER, description: "Group B coin 3 count", nullable: true },
          correctGroup: {
            type: Type.STRING,
            description: "Which group has more: 'A', 'B', or 'equal'",
            nullable: true,
          },

          // make-change fields
          paidAmount: { type: Type.NUMBER, description: "Amount paid in cents", nullable: true },
          itemCost: { type: Type.NUMBER, description: "Item cost in cents", nullable: true },
          correctChange: { type: Type.NUMBER, description: "Correct change in cents", nullable: true },
        },
        required: ["id", "type", "instruction", "hint"],
      },
      description: "Array of 5-6 progressive challenges",
    },
  },
  required: ["title", "description", "gradeBand", "challenges"],
};

// ---------------------------------------------------------------------------
// Coin value lookup for validation
// ---------------------------------------------------------------------------

const COIN_VALUES: Record<string, number> = {
  penny: 1,
  nickel: 5,
  dime: 10,
  quarter: 25,
  "half-dollar": 50,
  dollar: 100,
};

const VALID_COIN_TYPES = Object.keys(COIN_VALUES);

function isValidCoin(c: unknown): c is string {
  return typeof c === "string" && VALID_COIN_TYPES.includes(c);
}

// ---------------------------------------------------------------------------
// Flat → structured helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectCoinDefs(flat: FlatChallenge, prefix: string, maxSlots: number) {
  const defs: { type: string; count: number }[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const t = flat[`${prefix}${i}Type`];
    const c = flat[`${prefix}${i}Count`];
    if (isValidCoin(t) && typeof c === "number" && c > 0) {
      defs.push({ type: t, count: c });
    }
  }
  return defs.length > 0 ? defs : undefined;
}

function collectStrings(flat: FlatChallenge, prefix: string, maxSlots: number) {
  const out: string[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const v = flat[`${prefix}${i}`];
    if (isValidCoin(v)) out.push(v);
  }
  return out.length > 0 ? out : undefined;
}

function coinDefTotal(defs: { type: string; count: number }[]): number {
  return defs.reduce((sum, d) => sum + (COIN_VALUES[d.type] ?? 0) * d.count, 0);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate coin counter data for interactive coin identification, counting,
 * making amounts, comparing groups, and making change.
 *
 * Grade-aware content:
 * - K: penny, nickel, dime only. Identify & simple count.
 * - Grade 1: add quarter. Count mixed sets, make small amounts.
 * - Grade 2+: all coins. Compare groups, make change.
 */
export const generateCoinCounter = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<CoinCounterData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    "coin-counter",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(coinCounterSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : coinCounterSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Randomize to avoid repetitive output
  const scenarioThemes = [
    "a trip to the candy store",
    "a farmers' market adventure",
    "buying school supplies",
    "a lemonade stand",
    "a toy shop visit",
    "saving up for a book",
  ];
  const randomTheme = scenarioThemes[Math.floor(Math.random() * scenarioThemes.length)];

  const prompt = `
Create an educational coin counting activity for teaching "${topic}" to ${gradeLevel} students.
Theme this activity around ${randomTheme}.

CONTEXT:
- Students interact with realistic coin images to build money skills.
- Coin types available: penny (1¢), nickel (5¢), dime (10¢), quarter (25¢), half-dollar (50¢), dollar ($1.00).
- Grade K: ONLY use penny, nickel, dime.
- Grade 1: add quarter.
- Grade 2+: all coins including half-dollar and dollar.

${challengeTypeSection}

FIELD GUIDELINES PER CHALLENGE TYPE:
- "identify": Set coin0Type..coin3Type with coin0Count..coin3Count (the coins shown). Set targetCoin (the coin to find). Set option0..option3 (multiple-choice coin names). Coins should NOT show their value labels.
- "count": Set displayedCoin0Type..displayedCoin3Type with counts. Set correctTotal = exact sum in cents. Double-check your math!
- "make-amount": Set targetAmount in cents. Set availableCoin0..availableCoin3 (coin types the student can use).
- "compare": Set groupACoin0Type/Count..groupACoin2Type/Count and groupBCoin0..groupBCoin2. Set correctGroup ('A', 'B', or 'equal').
- "make-change": Set paidAmount, itemCost, correctChange = paidAmount - itemCost. All in cents.

IMPORTANT MATH RULES:
- For "count" challenges: correctTotal MUST equal the sum of each displayed coin's value × count.
  Example: 2 nickels + 1 dime = 2×5 + 1×10 = 20, so correctTotal = 20.
- For "make-change": correctChange MUST equal paidAmount - itemCost.
- For "compare": correctGroup MUST match whichever group has a higher total value.

REQUIREMENTS:
1. Generate 5-6 challenges that progress in difficulty.
2. Use warm, encouraging instruction text appropriate for young children.
3. Include helpful hints that guide without giving the answer.
4. Set gradeBand based on grade level (K, 1, 2, or 3).
5. For "identify" challenges, include at least 3 different coins and 3-4 options.
6. For "count" challenges, start with 2 coins and progress to 4-5.
7. Vary challenge types across the set for engagement.

Return the complete coin counter configuration.
`;

  logEvalModeResolution("CoinCounter", config?.targetEvalMode, evalConstraint);

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
    throw new Error("No valid coin counter data returned from Gemini API");
  }

  // ── Validate gradeBand ──
  const validGrades = ["K", "1", "2", "3"];
  if (!validGrades.includes(data.gradeBand)) {
    const gl = gradeLevel.toLowerCase();
    if (gl.includes("kinder") || gl.includes("k")) data.gradeBand = "K";
    else if (gl.includes("3")) data.gradeBand = "3";
    else if (gl.includes("2")) data.gradeBand = "2";
    else data.gradeBand = "1";
  }

  // ── Reconstruct arrays from flat fields & validate per challenge ──
  const validTypes = ["identify", "count", "make-amount", "compare", "make-change"];

  // Grade-appropriate coin pools for deriving missing options
  const gradeCoinPool: CoinType[] =
    data.gradeBand === "K"
      ? ["penny", "nickel", "dime"]
      : data.gradeBand === "1"
        ? ["penny", "nickel", "dime", "quarter"]
        : ["penny", "nickel", "dime", "quarter", "half-dollar", "dollar"];

  type CoinType = "penny" | "nickel" | "dime" | "quarter" | "half-dollar" | "dollar";

  const rejectedCount = { count: 0, compare: 0, identify: 0 };

  data.challenges = (data.challenges || [])
    .filter((c: FlatChallenge) => validTypes.includes(c.type as string))
    .map((flat: FlatChallenge) => {
      const challenge: Record<string, unknown> = {
        id: flat.id,
        type: flat.type,
        instruction: flat.instruction,
        hint: flat.hint || "Look carefully at the coins!",
      };

      switch (flat.type) {
        case "identify": {
          const coins = collectCoinDefs(flat, "coin", 4);
          if (coins) challenge.coins = coins;
          if (isValidCoin(flat.targetCoin)) challenge.targetCoin = flat.targetCoin;
          let options = collectStrings(flat, "option", 4);

          // Derive options from targetCoin if Gemini didn't populate flat fields
          if (!options && isValidCoin(flat.targetCoin)) {
            const target = flat.targetCoin as CoinType;
            const others = gradeCoinPool.filter((c) => c !== target);
            // Pick 2-3 distractors, shuffle
            const shuffled = others.sort(() => Math.random() - 0.5);
            options = [target, ...shuffled.slice(0, Math.min(3, shuffled.length))];
            options.sort(() => Math.random() - 0.5); // randomize order
          }

          if (options) challenge.options = options;

          // Derive coins from options if missing (so visual display matches)
          if (!challenge.coins && Array.isArray(challenge.options)) {
            challenge.coins = (challenge.options as string[]).map((t: string) => ({
              type: t,
              count: 1,
            }));
          }

          // Ensure targetCoin is in options
          if (
            challenge.targetCoin &&
            Array.isArray(challenge.options) &&
            !challenge.options.includes(challenge.targetCoin)
          ) {
            (challenge.options as string[]).push(challenge.targetCoin as string);
          }

          // Reject if still no targetCoin
          if (!challenge.targetCoin) {
            rejectedCount.identify++;
            return null;
          }
          break;
        }
        case "count": {
          const displayed = collectCoinDefs(flat, "displayedCoin", 4);
          if (displayed) {
            challenge.displayedCoins = displayed;
            // Recompute correctTotal from actual coin values
            challenge.correctTotal = coinDefTotal(displayed);
          } else {
            // REJECT: can't render a counting challenge with no coins
            rejectedCount.count++;
            return null;
          }
          break;
        }
        case "make-amount": {
          challenge.targetAmount =
            typeof flat.targetAmount === "number" ? flat.targetAmount : 25;
          const available = collectStrings(flat, "availableCoin", 4);
          challenge.availableCoins = available ?? ["penny", "nickel", "dime", "quarter"];
          break;
        }
        case "compare": {
          const groupA = collectCoinDefs(flat, "groupACoin", 3);
          const groupB = collectCoinDefs(flat, "groupBCoin", 3);
          // REJECT if either group is missing — can't render a one-sided comparison
          if (!groupA || !groupB) {
            rejectedCount.compare++;
            return null;
          }
          challenge.groupA = groupA;
          challenge.groupB = groupB;
          // Recompute correctGroup from actual values
          const totalA = coinDefTotal(groupA);
          const totalB = coinDefTotal(groupB);
          challenge.correctGroup =
            totalA > totalB ? "A" : totalB > totalA ? "B" : "equal";
          break;
        }
        case "make-change": {
          const paid =
            typeof flat.paidAmount === "number" ? flat.paidAmount : 100;
          const cost =
            typeof flat.itemCost === "number" ? flat.itemCost : 65;
          challenge.paidAmount = paid;
          challenge.itemCost = cost;
          challenge.correctChange = paid - cost;
          break;
        }
      }

      return challenge;
    })
    .filter((c: Record<string, unknown> | null) => c !== null);

  // Log rejections
  const totalRejected = rejectedCount.count + rejectedCount.compare + rejectedCount.identify;
  if (totalRejected > 0) {
    console.warn(
      `[CoinCounter] Rejected ${totalRejected} challenge(s) with missing data: `
      + `count=${rejectedCount.count}, compare=${rejectedCount.compare}, identify=${rejectedCount.identify}`,
    );
  }

  // ── count-like constraint: filter to single-coin-type challenges ──
  if (config?.targetEvalMode === "count-like") {
    const before = data.challenges.length;
    data.challenges = data.challenges.filter((c: Record<string, unknown>) => {
      if (c.type !== "count") return true;
      const coins = c.displayedCoins as { type: string; count: number }[] | undefined;
      if (!coins) return false;
      const uniqueTypes = new Set(coins.map((d: { type: string }) => d.type));
      return uniqueTypes.size === 1;
    });
    if (data.challenges.length < before) {
      console.log(
        `[CoinCounter] count-like: filtered ${before - data.challenges.length} mixed-coin challenge(s)`,
      );
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? "identify";
    console.log(`[CoinCounter] No valid challenges — using ${fallbackType} fallback`);
    const fallbacks: Record<string, Record<string, unknown>> = {
      identify: {
        id: "c1",
        type: "identify",
        instruction: "Which coin is the nickel?",
        hint: "A nickel is bigger than a penny but smaller than a quarter.",
        coins: [
          { type: "penny", count: 1 },
          { type: "nickel", count: 1 },
          { type: "dime", count: 1 },
        ],
        targetCoin: "nickel",
        options: ["penny", "nickel", "dime"],
      },
      count: {
        id: "c1",
        type: "count",
        instruction: "How much money is shown?",
        hint: "Add up the value of each coin.",
        displayedCoins: [
          { type: "penny", count: 3 },
          { type: "nickel", count: 1 },
        ],
        correctTotal: 8,
      },
      "make-amount": {
        id: "c1",
        type: "make-amount",
        instruction: "Can you make 15¢?",
        hint: "Try using a dime and some pennies!",
        targetAmount: 15,
        availableCoins: ["penny", "nickel", "dime"],
      },
      compare: {
        id: "c1",
        type: "compare",
        instruction: "Which group has more money?",
        hint: "Count each group's total first.",
        groupA: [{ type: "dime", count: 2 }],
        groupB: [{ type: "nickel", count: 3 }],
        correctGroup: "A",
      },
      "make-change": {
        id: "c1",
        type: "make-change",
        instruction: "You pay 50¢ for a 35¢ item. What's your change?",
        hint: "Subtract the cost from what you paid.",
        paidAmount: 50,
        itemCost: 35,
        correctChange: 15,
      },
    };
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.identify];
  }

  // Final log
  const typeBreakdown = (data.challenges as Array<{ type: string }>)
    .map((c) => c.type)
    .join(", ");
  console.log(
    `[CoinCounter] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`,
  );

  return data as CoinCounterData;
};
