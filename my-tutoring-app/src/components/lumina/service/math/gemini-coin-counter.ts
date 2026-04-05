import { Type, Schema } from "@google/genai";
import { CoinCounterData, CoinCounterChallenge, CoinDef, CoinType } from "../../primitives/visual-primitives/math/CoinCounter";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
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
// Coin value lookup & helpers
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

function coinDefTotal(defs: { type: string; count: number }[]): number {
  return defs.reduce((sum, d) => sum + (COIN_VALUES[d.type] ?? 0) * d.count, 0);
}

function gradeCoinPool(gradeBand: string): CoinType[] {
  if (gradeBand === "K") return ["penny", "nickel", "dime"];
  if (gradeBand === "1") return ["penny", "nickel", "dime", "quarter"];
  return ["penny", "nickel", "dime", "quarter", "half-dollar", "dollar"];
}

function resolveGradeBand(gradeLevel: string): string {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("kinder") || gl.includes("k")) return "K";
  if (gl.includes("3")) return "3";
  if (gl.includes("2")) return "2";
  return "1";
}

function gradeCoinsPrompt(gradeBand: string): string {
  if (gradeBand === "K") return "ONLY use penny (1¢), nickel (5¢), dime (10¢).";
  if (gradeBand === "1") return "Use penny (1¢), nickel (5¢), dime (10¢), quarter (25¢).";
  return "Use all coins: penny (1¢), nickel (5¢), dime (10¢), quarter (25¢), half-dollar (50¢), dollar ($1.00).";
}

// Randomize to avoid repetitive output
const SCENARIO_THEMES = [
  "a trip to the candy store",
  "a farmers' market adventure",
  "buying school supplies",
  "a lemonade stand",
  "a toy shop visit",
  "saving up for a book",
];

function randomTheme(): string {
  return SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
}

// ---------------------------------------------------------------------------
// Flat → structured helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectCoinDefs(flat: FlatChallenge, prefix: string, maxSlots: number): CoinDef[] | undefined {
  const defs: CoinDef[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const t = flat[`${prefix}${i}Type`];
    const c = flat[`${prefix}${i}Count`];
    if (isValidCoin(t) && typeof c === "number" && c > 0) {
      defs.push({ type: t as CoinType, count: c });
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

// ===========================================================================
// Per-type schemas — focused, all fields required
// ===========================================================================

const coinTypeEnum = {
  type: Type.STRING,
  description: "Coin type: 'penny', 'nickel', 'dime', 'quarter', 'half-dollar', 'dollar'",
};

const identifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the coin activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },
          coin0Type: { ...coinTypeEnum, description: "1st coin shown" },
          coin0Count: { type: Type.NUMBER, description: "1st coin count" },
          coin1Type: { ...coinTypeEnum, description: "2nd coin shown" },
          coin1Count: { type: Type.NUMBER, description: "2nd coin count" },
          coin2Type: { ...coinTypeEnum, description: "3rd coin shown" },
          coin2Count: { type: Type.NUMBER, description: "3rd coin count" },
          coin3Type: { ...coinTypeEnum, description: "4th coin shown (optional)" },
          coin3Count: { type: Type.NUMBER, description: "4th coin count (optional)" },
          targetCoin: { ...coinTypeEnum, description: "The coin the student must identify" },
          option0: { ...coinTypeEnum, description: "Answer option 1" },
          option1: { ...coinTypeEnum, description: "Answer option 2" },
          option2: { ...coinTypeEnum, description: "Answer option 3" },
          option3: { ...coinTypeEnum, description: "Answer option 4 (optional)" },
        },
        required: ["id", "instruction", "hint", "coin0Type", "coin0Count", "coin1Type", "coin1Count", "coin2Type", "coin2Count", "targetCoin", "option0", "option1", "option2"],
      },
      description: "5-6 identify challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const countSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the coin activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },
          displayedCoin0Type: { ...coinTypeEnum, description: "1st displayed coin type" },
          displayedCoin0Count: { type: Type.NUMBER, description: "1st displayed coin count" },
          displayedCoin1Type: { ...coinTypeEnum, description: "2nd displayed coin type" },
          displayedCoin1Count: { type: Type.NUMBER, description: "2nd displayed coin count" },
          displayedCoin2Type: { ...coinTypeEnum, description: "3rd displayed coin type" },
          displayedCoin2Count: { type: Type.NUMBER, description: "3rd displayed coin count" },
          displayedCoin3Type: { ...coinTypeEnum, description: "4th displayed coin type (optional)" },
          displayedCoin3Count: { type: Type.NUMBER, description: "4th displayed coin count (optional)" },
        },
        required: ["id", "instruction", "hint", "displayedCoin0Type", "displayedCoin0Count", "displayedCoin1Type", "displayedCoin1Count"],
      },
      description: "5-6 counting challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const makeAmountSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the coin activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },
          targetAmount: { type: Type.NUMBER, description: "Target amount in cents" },
          availableCoin0: { ...coinTypeEnum, description: "Available coin 1" },
          availableCoin1: { ...coinTypeEnum, description: "Available coin 2" },
          availableCoin2: { ...coinTypeEnum, description: "Available coin 3" },
          availableCoin3: { ...coinTypeEnum, description: "Available coin 4 (optional)" },
        },
        required: ["id", "instruction", "hint", "targetAmount", "availableCoin0", "availableCoin1", "availableCoin2"],
      },
      description: "5-6 make-amount challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const compareSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the coin activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },
          groupACoin0Type: { ...coinTypeEnum, description: "Group A coin 1 type" },
          groupACoin0Count: { type: Type.NUMBER, description: "Group A coin 1 count" },
          groupACoin1Type: { ...coinTypeEnum, description: "Group A coin 2 type" },
          groupACoin1Count: { type: Type.NUMBER, description: "Group A coin 2 count" },
          groupACoin2Type: { ...coinTypeEnum, description: "Group A coin 3 type (optional)" },
          groupACoin2Count: { type: Type.NUMBER, description: "Group A coin 3 count (optional)" },
          groupBCoin0Type: { ...coinTypeEnum, description: "Group B coin 1 type" },
          groupBCoin0Count: { type: Type.NUMBER, description: "Group B coin 1 count" },
          groupBCoin1Type: { ...coinTypeEnum, description: "Group B coin 2 type" },
          groupBCoin1Count: { type: Type.NUMBER, description: "Group B coin 2 count" },
          groupBCoin2Type: { ...coinTypeEnum, description: "Group B coin 3 type (optional)" },
          groupBCoin2Count: { type: Type.NUMBER, description: "Group B coin 3 count (optional)" },
        },
        required: [
          "id", "instruction", "hint",
          "groupACoin0Type", "groupACoin0Count", "groupACoin1Type", "groupACoin1Count",
          "groupBCoin0Type", "groupBCoin0Count", "groupBCoin1Type", "groupBCoin1Count",
        ],
      },
      description: "5-6 compare challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const makeChangeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the coin activity" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },
          paidAmount: { type: Type.NUMBER, description: "Amount paid in cents" },
          itemCost: { type: Type.NUMBER, description: "Item cost in cents" },
        },
        required: ["id", "instruction", "hint", "paidAmount", "itemCost"],
      },
      description: "5-6 make-change challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

// ===========================================================================
// Per-type sub-generators
// ===========================================================================

async function generateIdentifyChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<CoinCounterChallenge[]> {
  const pool = gradeCoinPool(gradeBand);
  const prompt = `
Create an educational coin IDENTIFICATION activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students must identify coins by appearance. They see 3-4 coins displayed WITHOUT value labels
and must answer "Which coin is the [name]?"

${gradeCoinsPrompt(gradeBand)}

For each challenge:
- Set coin0Type/Count through coin2Type/Count (or coin3) — the coins visible on screen.
- Set targetCoin — the coin the student must pick.
- Set option0..option2 (or option3) — multiple-choice coin names. targetCoin MUST be one of the options.
- Use at least 3 different coin types per challenge.
- Vary which coin is the target across challenges.

Generate 5-6 challenges progressing in difficulty. Use warm, encouraging instructions.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: identifySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CoinCounterChallenge | null => {
      const coins = collectCoinDefs(flat, "coin", 4);
      const targetCoin = isValidCoin(flat.targetCoin) ? flat.targetCoin : undefined;
      if (!targetCoin) return null;

      let options = collectStrings(flat, "option", 4);
      // Derive options from targetCoin + pool if Gemini skipped them
      if (!options) {
        const others = pool.filter((c) => c !== targetCoin);
        const shuffled = others.sort(() => Math.random() - 0.5);
        options = [targetCoin, ...shuffled.slice(0, Math.min(3, shuffled.length))];
        options.sort(() => Math.random() - 0.5);
      }
      // Ensure targetCoin is in options
      if (!options.includes(targetCoin)) options.push(targetCoin);

      // Derive coins from options if missing
      const finalCoins: CoinDef[] = coins ?? options.map((t) => ({ type: t as CoinType, count: 1 }));

      return {
        id: flat.id as string,
        type: "identify",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Look carefully at the coins!",
        coins: finalCoins,
        targetCoin: targetCoin as CoinType,
        options: options as CoinType[],
      };
    })
    .filter((c): c is CoinCounterChallenge => c !== null);
}

async function generateCountChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
  singleCoinType: boolean,
): Promise<CoinCounterChallenge[]> {
  const coinConstraint = singleCoinType
    ? "IMPORTANT: Each challenge MUST use ONLY ONE type of coin (e.g., all pennies, or all nickels). Do NOT mix coin types within a single challenge."
    : "Each challenge MUST use at least 2 DIFFERENT coin types. Mix coins for variety (e.g., 2 dimes + 3 pennies).";

  const prompt = `
Create an educational coin COUNTING activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students count the total value of displayed coins in cents.

${gradeCoinsPrompt(gradeBand)}

${coinConstraint}

For each challenge:
- Set displayedCoin0Type/Count and displayedCoin1Type/Count (required — at least 2 coin slots).
- Optionally set displayedCoin2Type/Count and displayedCoin3Type/Count for harder challenges.
- Each count is how many of that coin (e.g., displayedCoin0Type="nickel", displayedCoin0Count=3 means 3 nickels).
- Start with 2 coin slots and progress to 3-4 for harder challenges.

Generate 5-6 challenges progressing in difficulty. Use warm, encouraging instructions.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: countSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CoinCounterChallenge | null => {
      const displayed = collectCoinDefs(flat, "displayedCoin", 4);
      if (!displayed) return null;

      // Enforce single-coin-type constraint for count-like
      if (singleCoinType) {
        const uniqueTypes = new Set(displayed.map((d) => d.type));
        if (uniqueTypes.size > 1) return null;
      }

      return {
        id: flat.id as string,
        type: "count",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Add up the value of each coin!",
        displayedCoins: displayed,
        correctTotal: coinDefTotal(displayed), // always derive
      };
    })
    .filter((c): c is CoinCounterChallenge => c !== null);
}

async function generateMakeAmountChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<CoinCounterChallenge[]> {
  const prompt = `
Create an educational MAKE AMOUNT activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students drag coins to build a target amount.

${gradeCoinsPrompt(gradeBand)}

For each challenge:
- Set targetAmount (in cents). K: under 25¢. Grade 1: up to 50¢. Grade 2+: up to 100¢.
- Set availableCoin0..availableCoin2 (required), optionally availableCoin3 — the coin types the student can use.
- The target amount MUST be achievable using the available coins.

Generate 5-6 challenges progressing in difficulty. Use warm, encouraging instructions.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: makeAmountSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CoinCounterChallenge | null => {
      const targetAmount = typeof flat.targetAmount === "number" ? flat.targetAmount : undefined;
      if (!targetAmount || targetAmount <= 0) return null;

      const available = collectStrings(flat, "availableCoin", 4);
      if (!available) return null;

      return {
        id: flat.id as string,
        type: "make-amount",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Try different combinations of coins!",
        targetAmount,
        availableCoins: available as CoinType[],
      };
    })
    .filter((c): c is CoinCounterChallenge => c !== null);
}

async function generateCompareChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<CoinCounterChallenge[]> {
  const prompt = `
Create an educational coin COMPARISON activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students compare two groups of coins to determine which has more value.

${gradeCoinsPrompt(gradeBand)}

For each challenge:
- Set groupACoin0Type/Count and groupACoin1Type/Count (required for Group A).
- Set groupBCoin0Type/Count and groupBCoin1Type/Count (required for Group B).
- Optionally add a 3rd coin to each group (groupACoin2, groupBCoin2).
- Groups should differ by at least 5¢ so the comparison is meaningful.
- Mix the correct answer across challenges (sometimes A is more, sometimes B, rarely equal).

Generate 5-6 challenges progressing in difficulty. Use warm, encouraging instructions.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: compareSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CoinCounterChallenge | null => {
      const groupA = collectCoinDefs(flat, "groupACoin", 3);
      const groupB = collectCoinDefs(flat, "groupBCoin", 3);
      if (!groupA || !groupB) return null;

      // Always derive correctGroup from actual values
      const totalA = coinDefTotal(groupA);
      const totalB = coinDefTotal(groupB);
      const correctGroup: "A" | "B" | "equal" =
        totalA > totalB ? "A" : totalB > totalA ? "B" : "equal";

      return {
        id: flat.id as string,
        type: "compare",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Count each group's total first!",
        groupA,
        groupB,
        correctGroup,
      };
    })
    .filter((c): c is CoinCounterChallenge => c !== null);
}

async function generateMakeChangeChallenges(
  topic: string,
  gradeLevel: string,
  gradeBand: string,
): Promise<CoinCounterChallenge[]> {
  const prompt = `
Create an educational MAKE CHANGE activity for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Students calculate change from a purchase. Show what was paid and item cost, student computes the difference.

${gradeCoinsPrompt(gradeBand)}

For each challenge:
- Set paidAmount (in cents) — the amount the student pays.
- Set itemCost (in cents) — what the item costs.
- paidAmount MUST be GREATER than itemCost (you can't owe negative change).
- Use round, grade-appropriate amounts:
  ${gradeBand === "K" || gradeBand === "1"
    ? "K-1: paidAmount should be 25¢, 50¢, or 75¢. itemCost should be 5-40¢."
    : "Grade 2+: paidAmount can be up to 100¢ ($1.00). itemCost up to 75¢."}
- The instruction text MUST match the numeric values exactly. If paidAmount is 50 and itemCost is 35,
  the instruction must say "50 cents" and "35 cents" — never different numbers.

Generate 5-6 challenges progressing in difficulty. Use warm, encouraging instructions.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: makeChangeSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CoinCounterChallenge | null => {
      const paid = typeof flat.paidAmount === "number" ? flat.paidAmount : undefined;
      const cost = typeof flat.itemCost === "number" ? flat.itemCost : undefined;
      if (paid == null || cost == null) return null;
      // Reject nonsensical: paid must exceed cost
      if (paid <= cost) return null;

      return {
        id: flat.id as string,
        type: "make-change",
        instruction: flat.instruction as string,
        hint: (flat.hint as string) || "Subtract the cost from what you paid!",
        paidAmount: paid,
        itemCost: cost,
        correctChange: paid - cost, // always derive
      };
    })
    .filter((c): c is CoinCounterChallenge => c !== null);
}

// ===========================================================================
// Fallbacks — one per type, correct by construction
// ===========================================================================

const FALLBACKS: Record<string, CoinCounterChallenge> = {
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

// ===========================================================================
// Main generator — dispatches to per-type sub-generators
// ===========================================================================

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
  logEvalModeResolution("CoinCounter", config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

  // ── Dispatch sub-generators in parallel ──
  const generators: Promise<CoinCounterChallenge[]>[] = [];
  const typeOrder: string[] = [];

  for (const type of allowedTypes) {
    typeOrder.push(type);
    switch (type) {
      case "identify":
        generators.push(generateIdentifyChallenges(topic, gradeLevel, gradeBand));
        break;
      case "count":
        // count-like = single coin type, count-mixed or unconstrained = mixed
        generators.push(
          generateCountChallenges(
            topic,
            gradeLevel,
            gradeBand,
            config?.targetEvalMode === "count-like",
          ),
        );
        break;
      case "make-amount":
        generators.push(generateMakeAmountChallenges(topic, gradeLevel, gradeBand));
        break;
      case "compare":
        generators.push(generateCompareChallenges(topic, gradeLevel, gradeBand));
        break;
      case "make-change":
        generators.push(generateMakeChangeChallenges(topic, gradeLevel, gradeBand));
        break;
    }
  }

  const results = await Promise.all(generators);

  // ── Combine results ──
  let challenges: CoinCounterChallenge[] = results.flat();

  // Re-assign IDs sequentially
  challenges = challenges.map((c, i) => ({ ...c, id: `c${i + 1}` }));

  // ── Fallback if empty ──
  if (challenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? "identify";
    console.log(`[CoinCounter] No valid challenges — using ${fallbackType} fallback`);
    challenges = [FALLBACKS[fallbackType] ?? FALLBACKS.identify];
  }

  // Pick title/description from the first successful result
  let title = "Coin Counting Fun!";
  let description = "Practice identifying, counting, and using coins.";
  for (let i = 0; i < results.length; i++) {
    if (results[i].length > 0) {
      // The sub-generator returned challenges but we need the wrapper title
      // Use a generic themed title since sub-generators don't return it separately
      break;
    }
  }

  // ── Build title from first successful Gemini response ──
  // Re-fetch from the raw responses would require caching; use a descriptive default
  const typeLabels: Record<string, string> = {
    identify: "Coin Identification",
    count: "Counting Coins",
    "make-amount": "Making Amounts",
    compare: "Comparing Coin Groups",
    "make-change": "Making Change",
  };
  if (allowedTypes.length === 1) {
    title = `${typeLabels[allowedTypes[0]] ?? "Coin"} Fun!`;
    description = `Practice ${(typeLabels[allowedTypes[0]] ?? "coin skills").toLowerCase()} with coins.`;
  }

  const typeBreakdown = challenges.map((c) => c.type).join(", ");
  console.log(`[CoinCounter] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title,
    description,
    challenges,
    gradeBand: gradeBand as "K" | "1" | "2" | "3",
  };
};
